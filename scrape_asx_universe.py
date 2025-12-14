#!/usr/bin/env python3
"""
ASX All-Companies Scraper (Bi‑Monthly Snapshot)
-----------------------------------------------
- Primary source: Official ASX Listed Companies CSV (free).
- Fallback: MarketIndex "ASX listed companies" pages (polite crawl).

Outputs:
- CSV: ticker, name, sector, industry, last_extracted
- TXT (optional): tickers only, for TileScreener default symbols

Usage:
    python3 server/scripts/scrape_asx_universe.py 
        --output server/data/asx_universe.csv 
        --tickers_txt app/src/data/universe/asx_all.txt 
        [--source auto|asx_csv|marketindex] 
        [--sleep 0.5] [--max_age_days 60] [--force]

Python 3.9+ required (uses zoneinfo). Tested with Python 3.13.

Dependencies (optional fallbacks provided):
    pip install requests pandas beautifulsoup4 lxml

Notes:
- This script intentionally does NOT filter by sector; it captures the full ASX universe.
- To avoid running at every app open, it skips work when a fresh CSV (<= max_age_days) exists, unless --force.
"""

from __future__ import annotations

import argparse
import csv as pycsv
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Optional

import requests
import yfinance as yf

try:
    import pandas as pd
except Exception:
    pd = None  # Optional; we can fallback to Python csv

try:
    from bs4 import BeautifulSoup  # type: ignore
except Exception:
    BeautifulSoup = None  # Optional; only needed for MarketIndex fallback

from zoneinfo import ZoneInfo


# --------------------------------------------------------------------------------------
# Config / constants
# --------------------------------------------------------------------------------------

AWST = ZoneInfo("Australia/Perth")

ASX_CSV_URLS = [
    # Official CSV (primary). ASX has moved paths historically; include a known endpoint.
    "https://www.asx.com.au/asx/research/ASXListedCompanies.csv",
]

MARKETINDEX_LIST_URL = "https://www.marketindex.com.au/asx-listed-companies"
MARKETINDEX_UA = (
    # Use a realistic desktop browser UA to avoid 403 blocks
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0 Safari/537.36"
)


# --------------------------------------------------------------------------------------
# Data classes
# --------------------------------------------------------------------------------------

@dataclass
class CompanyRow:
    ticker: str
    name: str
    sector: str
    industry: str
    market_cap: Optional[float] = None


# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------

def now_awst_iso() -> str:
    """Return current AWST time as ISO8601 with seconds precision."""
    return datetime.now(AWST).isoformat(timespec="seconds")


def ensure_parent_dir(path: str) -> None:
    """Create the parent directory if it does not exist."""
    parent = os.path.dirname(path) or "."
    os.makedirs(parent, exist_ok=True)


def normalize_ticker(code: str) -> str:
    code = (code or "").strip().upper()
    code = re.sub(r"[^A-Z0-9]", "", code)
    return code


def ci(s: Optional[str]) -> str:
    return (s or "").strip()


def parse_iso(dt_str: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(dt_str)
    except Exception:
        return None


# --------------------------------------------------------------------------------------
# Sources
# --------------------------------------------------------------------------------------

def read_asx_csv(timeout: float = 15.0) -> List[CompanyRow]:
    """Try multiple ASX CSV endpoints; return a list of CompanyRow."""
    last_exc = None
    for url in ASX_CSV_URLS:
        try:
            resp = requests.get(url, timeout=timeout)
            resp.raise_for_status()
            raw = resp.text.splitlines()
            header_idx = 0
            for i, line in enumerate(raw):
                ll = line.strip().lower()
                if ("company name" in ll) and ("asx code" in ll) and ("gics" in ll):
                    header_idx = i
                    break
            normalized = "\n".join(raw[header_idx:])

            # Parse with pandas if available, else Python csv
            if pd is not None:
                from io import StringIO
                df = pd.read_csv(StringIO(normalized))
                rows_iter = df.to_dict(orient="records")
                col_map = {str(c).strip().lower(): c for c in df.columns}
            else:
                rows_iter = list(pycsv.DictReader(normalized.splitlines()))
                col_map = {}
                if rows_iter:
                    col_map = {str(c).strip().lower(): c for c in rows_iter[0].keys()}
        except Exception as e:
            last_exc = e
            continue

        # Try a couple of known header styles
        def find_col(cands: List[str]) -> Optional[str]:
            for cand in cands:
                if cand in col_map:
                    return col_map[cand]
            return None

        code_col = find_col(["asx code", "asx code.", "asx", "code", "ticker"]) or col_map.get("asx code", "ASX code")
        name_col = find_col(["company name", "name", "company"]) or col_map.get("company name", "Company name")
        sector_col = find_col(["gics industry group", "gics sector", "industry group", "industry"]) or col_map.get("gics industry group", "GICS industry group")
        industry_col = find_col(["industry group", "industry", "gics industry group"]) or col_map.get("industry group", "Industry group")

        result: List[CompanyRow] = []
        for r in rows_iter:
            code = normalize_ticker(str(r.get(code_col, "")))
            name = ci(str(r.get(name_col, "")))
            sector = ci(str(r.get(sector_col, "")))
            industry = ci(str(r.get(industry_col, "")))
            if code and name:
                result.append(CompanyRow(code, name, sector, industry))

        if result:
            return result

    if last_exc:
        raise RuntimeError(f"Failed to fetch ASX CSV from known URLs. Last error: {last_exc}")
    raise RuntimeError("Failed to fetch ASX CSV: unknown error")


def scrape_marketindex_list(max_pages: int = 80, sleep_s: float = 0.5, timeout: float = 15.0) -> List[CompanyRow]:
    """Polite crawl of MarketIndex list (fallback).
    Tries BeautifulSoup if available; otherwise uses a conservative regex-based parser.
    """
    session = requests.Session()
    session.headers.update({
        "User-Agent": MARKETINDEX_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": "https://www.marketindex.com.au/",
        "Connection": "keep-alive",
    })

    results: List[CompanyRow] = []
    for page in range(1, max_pages + 1):
        url = MARKETINDEX_LIST_URL if page == 1 else f"{MARKETINDEX_LIST_URL}?page={page}"
        resp = session.get(url, timeout=timeout)
        if resp.status_code == 404:
            break
        resp.raise_for_status()

        if BeautifulSoup is not None:
            soup = BeautifulSoup(resp.text, "lxml")
            table = soup.find("table")
            if not table:
                break

            col_idx = {"code": 0, "company": 1, "sector": 2}
            thead = table.find("thead")
            if thead:
                headers = [th.get_text(strip=True).lower() for th in thead.find_all("th")]
                for i, h in enumerate(headers):
                    if "code" in h:
                        col_idx["code"] = i
                    elif "company" in h:
                        col_idx["company"] = i
                    elif "sector" in h:
                        col_idx["sector"] = i

            tbody = table.find("tbody") or table
            for tr in tbody.find_all("tr"):
                tds = [td.get_text(strip=True) for td in tr.find_all("td")]
                if len(tds) < max(col_idx.values()) + 1:
                    continue
                code = normalize_ticker(tds[col_idx["code"]])
                name = (tds[col_idx["company"]]).strip()
                sector = (tds[col_idx["sector"]]).strip()
                industry = ""  # not provided by MI list
                if code and name:
                    results.append(CompanyRow(code, name, sector, industry))
        else:
            import re as _re
            # Coarsely find the first table and extract rows
            table_m = _re.search(r"<table[\s\S]*?</table>", resp.text, flags=_re.IGNORECASE | _re.DOTALL)
            if not table_m:
                break
            table_html = table_m.group(0)
            # Extract header to map column positions
            header_m = _re.search(r"<thead[\s\S]*?</thead>", table_html, flags=_re.IGNORECASE | _re.DOTALL)
            col_idx = {"code": 0, "company": 1, "sector": 2}
            if header_m:
                headers = _re.findall(r"<th[^>]*>([\s\S]*?)</th>", header_m.group(0), flags=_re.IGNORECASE)
                headers_norm = [ _re.sub(r"<.*?>", "", h).strip().lower() for h in headers ]
                for i, h in enumerate(headers_norm):
                    if "code" in h:
                        col_idx["code"] = i
                    elif "company" in h:
                        col_idx["company"] = i
                    elif "sector" in h:
                        col_idx["sector"] = i

            # Body rows
            body_m = _re.search(r"<tbody[\s\S]*?</tbody>", table_html, flags=_re.IGNORECASE | _re.DOTALL)
            body_html = body_m.group(0) if body_m else table_html
            rows_html = _re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", body_html, flags=_re.IGNORECASE)
            for tr_html in rows_html:
                cells = _re.findall(r"<td[^>]*>([\s\S]*?)</td>", tr_html, flags=_re.IGNORECASE)
                if len(cells) < max(col_idx.values()) + 1:
                    continue
                # Strip tags
                tds = [ _re.sub(r"<.*?>", "", c).strip() for c in cells ]
                code = normalize_ticker(tds[col_idx["code"]])
                name = (tds[col_idx["company"]]).strip()
                sector = (tds[col_idx["sector"]]).strip()
                industry = ""
                if code and name:
                    results.append(CompanyRow(code, name, sector, industry))

        time.sleep(sleep_s)

    dedup: Dict[str, CompanyRow] = {}
    for row in results:
        dedup[row.ticker] = row
    return list(dedup.values())


def get_universe(source: str, sleep_s: float) -> List[CompanyRow]:
    source = (source or "auto").lower().strip()
    if source == "asx_csv":
        return read_asx_csv()
    if source == "marketindex":
        return scrape_marketindex_list(sleep_s=sleep_s)

    # auto
    try:
        rows = read_asx_csv()
        if rows:
            return rows
    except Exception as e:
        print(f"[warn] primary ASX CSV failed: {e}", file=sys.stderr)

    print("[info] falling back to MarketIndex list", file=sys.stderr)
    return scrape_marketindex_list(sleep_s=sleep_s)


# --------------------------------------------------------------------------------------
# Outputs
# --------------------------------------------------------------------------------------

def yahoo_symbol_from_code(code: str) -> str:
    code = normalize_ticker(code)
    return f"{code}.AX"

def fetch_market_caps(rows: List[CompanyRow], sleep_s: float = 0.05) -> Dict[str, Optional[float]]:
    """Fetch market caps using yfinance per symbol (robust Yahoo crumb handling).
    Returns dict of normalized ticker -> market_cap (float) or None.
    """
    caps: Dict[str, Optional[float]] = {}
    codes = [r.ticker for r in rows]
    for code in codes:
        sym = yahoo_symbol_from_code(code)
        mc_val: Optional[float] = None
        try:
            t = yf.Ticker(sym)
            info = {}
            try:
                info = t.get_info()
            except Exception:
                info = t.info
            v = info.get("marketCap") or info.get("enterpriseValue")
            if isinstance(v, (int, float)):
                mc_val = float(v)
        except Exception:
            mc_val = None
        caps[normalize_ticker(code)] = mc_val
        time.sleep(sleep_s)
    return caps

def write_csv(rows: List[CompanyRow], output_file: str) -> None:
    ensure_parent_dir(output_file)
    extracted = now_awst_iso()
    if pd is not None:
        df = pd.DataFrame([{**r.__dict__, "last_extracted": extracted} for r in rows])
        cols = ["ticker", "name", "sector", "industry", "market_cap", "last_extracted"]
        for c in cols:
            if c not in df.columns:
                df[c] = None
        df = df[cols]
        df.to_csv(output_file, index=False)
    else:
        cols = ["ticker", "name", "sector", "industry", "market_cap", "last_extracted"]
        with open(output_file, "w", newline="", encoding="utf-8") as f:
            w = pycsv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            for r in rows:
                w.writerow({
                    "ticker": r.ticker,
                    "name": r.name,
                    "sector": r.sector,
                    "industry": r.industry,
                    "market_cap": r.market_cap if r.market_cap is not None else "",
                    "last_extracted": extracted,
                })
    print(f"[ok] CSV saved to {output_file} ({len(rows)} rows)")


def write_tickers_txt(rows: List[CompanyRow], txt_path: Optional[str]) -> None:
    if not txt_path:
        return
    ensure_parent_dir(txt_path)
    extracted = now_awst_iso()
    # Prepare comment header and one ticker per line, sorted by market cap desc, N/A at end
    lines = [f"# ASX universe tickers (no filters)", f"# last_extracted: {extracted}", f"# sort: market_cap desc, NA last"]
    # Dedup and sort by market cap
    dedup: Dict[str, Optional[float]] = {}
    for r in rows:
        if r.ticker not in dedup:
            dedup[r.ticker] = r.market_cap
    ordered = sorted(dedup.items(), key=lambda kv: (kv[1] is None, -(kv[1] or 0.0)))
    lines.extend([code for code, _ in ordered])
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"[ok] Tickers saved to {txt_path} ({len(dedup)} codes)")


def is_fresh(output_file: str, max_age_days: int) -> bool:
    if not os.path.exists(output_file):
        return False
    # Try to read last_extracted from CSV; if missing, use file mtime
    try:
        if pd is not None:
            df = pd.read_csv(output_file)
            if "last_extracted" in df.columns and not df.empty:
                # Use max timestamp across rows
                ts = None
                for v in df["last_extracted"].dropna().astype(str).tolist():
                    dv = parse_iso(v)
                    if dv and (ts is None or dv > ts):
                        ts = dv
                if ts is not None:
                    age = datetime.now(ts.tzinfo or AWST) - ts
                    return age <= timedelta(days=max_age_days)
        else:
            with open(output_file, "r", encoding="utf-8") as f:
                reader = pycsv.DictReader(f)
                ts = None
                for row in reader:
                    dv = parse_iso(str(row.get("last_extracted", "")))
                    if dv and (ts is None or dv > ts):
                        ts = dv
                if ts is not None:
                    age = datetime.now(ts.tzinfo or AWST) - ts
                    return age <= timedelta(days=max_age_days)
    except Exception:
        pass

    try:
        mtime = datetime.fromtimestamp(os.path.getmtime(output_file), tz=AWST)
        age = datetime.now(AWST) - mtime
        return age <= timedelta(days=max_age_days)
    except Exception:
        return False


# --------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description="ASX All-Companies scraper → CSV/TXT")
    ap.add_argument("--output", default="server/data/asx_universe.csv", help="Output CSV file path")
    ap.add_argument("--tickers_txt", default="app/src/data/universe/asx_all.txt", help="Output tickers TXT path (optional)")
    ap.add_argument("--source", default="auto", choices=["auto", "asx_csv", "marketindex"], help="Universe source")
    ap.add_argument("--sleep", type=float, default=0.5, help="Sleep seconds between MarketIndex page requests (fallback)")
    ap.add_argument("--max_age_days", type=int, default=60, help="Skip if existing CSV is fresh (<= days), unless --force")
    ap.add_argument("--force", action="store_true", help="Force re-scrape even if CSV appears fresh")
    args = ap.parse_args()

    if not args.force and is_fresh(args.output, max_age_days=args.max_age_days):
        print(f"[skip] {args.output} appears fresh (<= {args.max_age_days} days). Use --force to refresh.")
        return

    try:
        universe = get_universe(args.source, sleep_s=args.sleep)
    except Exception as e:
        print(f"[fatal] unable to build universe: {e}", file=sys.stderr)
        sys.exit(2)

    # Enrich with Yahoo market caps, then sort by market cap desc (None last)
    try:
        caps = fetch_market_caps(universe, sleep_s=0.05)
        for r in universe:
            r.market_cap = caps.get(r.ticker, None)
    except Exception as e:
        print(f"[warn] market cap enrichment failed: {e}", file=sys.stderr)

    universe.sort(key=lambda r: (r.market_cap is None, -(r.market_cap or 0.0)))

    # Write outputs
    write_csv(universe, args.output)
    write_tickers_txt(universe, args.tickers_txt)


if __name__ == "__main__":
    main()