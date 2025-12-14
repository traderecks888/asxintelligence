#!/usr/bin/env python3
"""
ASX Materials & Energy Scraper (Monthly Snapshot)
------------------------------------------------
- Primary source: Official ASX Listed Companies CSV (free).
- Fallback: MarketIndex "ASX listed companies" pages (polite crawl).
- Enrichment: Yahoo Finance via yfinance (market cap, business summary).
- Output CSV columns: ticker, name, sector, industry, market_cap, products, last_extracted
- Products are comma-separated canonical tokens (e.g., IRON_ORE, COPPER, URANIUM).

Usage:
    python3 scrape_asx_materials_energy.py \
        --output data/roster/asx_materials_energy_companies.csv \
        [--limit 50] [--sleep 0.5] [--source auto|asx_csv|marketindex]

Python 3.9+ required (uses zoneinfo). Tested with Python 3.13.

Dependencies:
    pip install requests pandas yfinance beautifulsoup4 lxml
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Iterable, List, Optional, Tuple

import requests
import pandas as pd
import yfinance as yf

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
    # Official CSV (primary). ASX has moved paths historically; include a couple of known endpoints.
    "https://www.asx.com.au/asx/research/ASXListedCompanies.csv",
    # In case the above changes; add more candidates here if you have them.
]

MARKETINDEX_LIST_URL = "https://www.marketindex.com.au/asx-listed-companies"
MARKETINDEX_UA = (
    # Use a realistic desktop browser UA to avoid 403 blocks
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0 Safari/537.36"
)

TARGET_SECTORS = {"materials", "energy"}  # case-insensitive match

# Canonical product taxonomy and detection keywords (case-insensitive).
# Expand synonyms as needed; keep conservative to avoid false positives.
PRODUCT_PATTERNS: Dict[str, Iterable[str]] = {
    "IRON_ORE": [r"\biron ore\b"],
    "GOLD": [r"\bgold\b"],
    "SILVER": [r"\bsilver\b"],
    "COPPER": [r"\bcopper\b"],
    "NICKEL": [r"\bnickel\b"],
    "ZINC": [r"\bzinc\b"],
    "LITHIUM": [r"\blithium\b"],
    "COBALT": [r"\bcobalt\b"],
    "GRAPHITE": [r"\bgraphite\b"],
    "RARE_EARTHS": [r"\brare earth"],
    "TIN": [r"\btin\b"],
    "OIL": [r"\boil\b", r"\bcrude\b", r"\bpetroleum\b"],
    "GAS": [r"\bnatural gas\b", r"\blng\b", r"\bgas\b"],
    "COAL": [r"\bcoal\b"],
    "URANIUM": [r"\burani(?:um|a)\b", r"\bU3O8\b"],
    "HYDROGEN": [r"\bhydrogen\b", r"\bgreen hydrogen\b"],
}

PRODUCT_COMPILED: Dict[str, List[re.Pattern]] = {
    key: [re.compile(pat, re.IGNORECASE) for pat in pats]
    for key, pats in PRODUCT_PATTERNS.items()
}

# Stage classification patterns: producer > developer > explorer
STAGE_PATTERNS: Dict[str, Iterable[str]] = {
    "producer": [
        r"\bproducing\b",
        r"\bproduction\b",
        r"\boperating mine\b",
        r"\bcurrently producing\b",
        r"\bcommission(ed|ing)\b",
        r"\bsales\b",
        r"\brevenue\b",
        r"\bprocessing plant\b",
        r"\bmine\b",
        r"\bounces\b",
        r"\btonnes\b",
    ],
    "developer": [
        r"\bconstruction\b",
        r"\bfeasibility\b",
        r"\bdefinitive feasibility\b",
        r"\bDFS\b",
        r"\bscoping study\b",
        r"\bproject finance\b",
        r"\bdevelopment\b",
    ],
    "explorer": [
        r"\bexploration\b",
        r"\bexplorer\b",
        r"\bdrilling\b",
        r"\bprospect(s)?\b",
        r"\btenement(s)?\b",
        r"\bleases?\b",
    ],
}

STAGE_COMPILED: Dict[str, List[re.Pattern]] = {
    key: [re.compile(pat, re.IGNORECASE) for pat in pats]
    for key, pats in STAGE_PATTERNS.items()
}

# --------------------------------------------------------------------------------------
# Data classes
# --------------------------------------------------------------------------------------

@dataclass
class CompanyRow:
    ticker: str
    name: str
    sector: str
    industry: str

@dataclass
class EnrichedRow:
    ticker: str
    name: str
    sector: str
    industry: str
    market_cap: Optional[float]
    products: str
    last_extracted: str
    stage: str  # "producer" | "developer" | "explorer" | "unknown"

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
    # Drop suffixes if present accidentally; final Yahoo symbol will be appended with .AX downstream.
    code = re.sub(r"[^A-Z0-9]", "", code)
    return code


def ci(s: Optional[str]) -> str:
    return (s or "").strip()


def detect_products(text: str) -> List[str]:
    """Detect product tokens from free text with conservative context gating.
    A commodity must appear near domain-specific context words to reduce incidental mentions.
    """
    if not text:
        return []
    found = set()
    # Context words typical of actual commodity involvement
    CONTEXT_WORDS = [
        r"\bproject(s)?\b", r"\bmine(s)?\b", r"\bmining\b", r"\bdeposit(s)?\b",
        r"\bresource(s)?\b", r"\breserve(s)?\b", r"\bproduction\b", r"\bprocessing\b",
        r"\bplant\b", r"\bgrade(s)?\b", r"\bdrill(ing)?\b", r"\bexploration\b",
        r"\btenement(s)?\b", r"\bprospect(s)?\b", r"\bfeasibility\b", r"\bDFS\b",
        r"\bscoping\b", r"\bconcentrate\b", r"\boperation(s)?\b"
    ]
    CONTEXT_COMPILED = [re.compile(p, re.IGNORECASE) for p in CONTEXT_WORDS]

    text_len = len(text)
    window = 120  # characters around commodity mention to check for context

    for token, patterns in PRODUCT_COMPILED.items():
        accepted = False
        for pat in patterns:
            for m in pat.finditer(text):
                start, end = m.start(), m.end()
                left = max(0, start - window)
                right = min(text_len, end + window)
                snippet = text[left:right]
                # Accept only if at least one context word is nearby
                if any(ctx.search(snippet) for ctx in CONTEXT_COMPILED):
                    accepted = True
                    break
            if accepted:
                break
        if accepted:
            found.add(token)
    return sorted(found)

def detect_stage(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return "unknown"
    # Priority order: producer > developer > explorer
    for key in ["producer", "developer", "explorer"]:
        for pat in STAGE_COMPILED.get(key, []):
            if pat.search(t):
                return key
    return "unknown"


def read_asx_csv(timeout: float = 15.0) -> List[CompanyRow]:
    """Try multiple ASX CSV endpoints; return a list of CompanyRow."""
    last_exc = None
    for url in ASX_CSV_URLS:
        try:
            resp = requests.get(url, timeout=timeout)
            resp.raise_for_status()
            # Some ASX CSVs include a preamble line before the header.
            # Normalize by skipping lines until we see the canonical header with 3 columns.
            raw = resp.text.splitlines()
            header_idx = 0
            for i, line in enumerate(raw):
                ll = line.strip().lower()
                if ("company name" in ll) and ("asx code" in ll) and ("gics" in ll):
                    header_idx = i
                    break
            normalized = "\n".join(raw[header_idx:])
            # Try pandas first for robustness
            try:
                from io import StringIO
                df = pd.read_csv(StringIO(normalized))
            except Exception:
                # Fallback to Python csv
                rows = list(csv.DictReader(normalized.splitlines()))
                df = pd.DataFrame(rows)
        except Exception as e:
            last_exc = e
            continue

        # Try a couple of known header styles
        def find_col(cands: List[str]) -> Optional[str]:
            for cand in cands:
                for col in df.columns:
                    if str(col).strip().lower() == cand:
                        return col
            return None

        code_col = find_col(["asx code", "asx code.", "asx", "code", "ticker"])
        name_col = find_col(["company name", "name", "company"])
        sector_col = find_col(["gics industry group", "gics sector", "industry group", "industry"])
        industry_col = find_col(["industry group", "industry", "gics industry group"])

        result: List[CompanyRow] = []
        for _, r in df.iterrows():
            code = normalize_ticker(str(r.get(code_col, ""))) if code_col else ""
            name = ci(str(r.get(name_col, ""))) if name_col else ""
            sector = ci(str(r.get(sector_col, ""))) if sector_col else ""
            industry = ci(str(r.get(industry_col, ""))) if industry_col else ""
            if code and name:
                result.append(CompanyRow(code, name, sector, industry))

        if result:
            return result

    if last_exc:
        raise RuntimeError(f"Failed to fetch ASX CSV from known URLs. Last error: {last_exc}")
    raise RuntimeError("Failed to fetch ASX CSV: unknown error")


def scrape_marketindex_list(max_pages: int = 80, sleep_s: float = 0.5, timeout: float = 15.0) -> List[CompanyRow]:
    """Polite crawl of MarketIndex list (fallback). Requires BeautifulSoup if HTML parsing."""
    if BeautifulSoup is None:
        raise RuntimeError("bs4 is required to parse MarketIndex HTML. Please install beautifulsoup4.")

    session = requests.Session()
    # Add headers commonly sent by browsers to reduce bot detection 403s
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
        soup = BeautifulSoup(resp.text, "lxml")

        table = soup.find("table")
        if not table:
            break

        # Expect rows with Code | Company | Sector | ...; parse robustly
        # Try to detect column indices by header row if present
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

        time.sleep(sleep_s)

    # De-dup by ticker
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


def enrich_with_yahoo(rows: List[CompanyRow], limit: Optional[int] = None, sleep_s: float = 0.5) -> List[EnrichedRow]:
    out: List[EnrichedRow] = []
    t0 = time.time()
    extracted = now_awst_iso()

    count = 0
    for row in rows:
        if limit is not None and count >= limit:
            break

        sector = (row.sector or "").strip()
        # Filter to target sectors early
        if sector and sector.lower() not in TARGET_SECTORS:
            continue

        ticker_au = f"{row.ticker}.AX"

        mcap = None
        summary_text = ""
        try:
            t = yf.Ticker(ticker_au)
            # yfinance info API may evolve; wrap carefully
            info = {}
            try:
                info = t.get_info()  # new-style call
            except Exception:
                info = t.info  # fallback
            mcap = info.get("marketCap") or info.get("enterpriseValue")
            summary_text = info.get("longBusinessSummary") or ""
        except Exception as e:
            print(f"[warn] yfinance failure for {ticker_au}: {e}", file=sys.stderr)

        # Stage + products detection
        stage = detect_stage(summary_text)
        products_list = detect_products(summary_text)
        # Additional gating for explorers: require explicit focus phrasing near commodity
        if stage == "explorer" and products_list:
            focus_hit = re.search(r"\b(primary|principal|focus(ed)?|core|flagship)\b", summary_text, flags=re.IGNORECASE)
            gated: List[str] = []
            for tok in products_list:
                core_word = tok.lower().replace("_", " ")
                pat = re.compile(rf"\b(primary|principal|focus(ed)?|core|flagship)\b[\s\S]{{0,120}}\b{core_word}\b", re.IGNORECASE)
                if pat.search(summary_text):
                    gated.append(tok)
            products_list = gated if focus_hit else []
        # Normalize tokens with underscores for stability
        products = ", ".join(products_list) if products_list else ""

        out.append(
            EnrichedRow(
                ticker=row.ticker,
                name=row.name,
                sector=row.sector,
                industry=row.industry,
                market_cap=float(mcap) if mcap is not None else None,
                products=products,
                last_extracted=extracted,
                stage=stage,
            )
        )

        count += 1
        time.sleep(max(0.0, float(sleep_s)))

    dt = time.time() - t0
    print(f"[info] enriched {len(out)} rows in {dt:.1f}s (limit={limit})", file=sys.stderr)
    return out


def write_csv(rows: List[EnrichedRow], output_file: str) -> None:
    ensure_parent_dir(output_file)
    df = pd.DataFrame([r.__dict__ for r in rows])
    # Enforce column order
    cols = ["ticker", "name", "sector", "industry", "market_cap", "products", "last_extracted", "stage"]
    for c in cols:
        if c not in df.columns:
            df[c] = None
    df = df[cols]
    df.to_csv(output_file, index=False)
    print(f"[ok] Data saved to {output_file}")


def main() -> None:
    ap = argparse.ArgumentParser(description="ASX Materials/Energy monthly scraper → CSV")
    ap.add_argument("--output", default="data/roster/asx_materials_energy_companies.csv", help="Output CSV file path")
    ap.add_argument("--limit", type=int, default=None, help="Limit number of companies to process (debug)")
    ap.add_argument("--sleep", type=float, default=0.5, help="Sleep seconds between Yahoo calls")
    ap.add_argument("--source", default="auto", choices=["auto", "asx_csv", "marketindex"], help="Universe source")
    args = ap.parse_args()

    try:
        universe = get_universe(args.source, sleep_s=args.sleep)
    except Exception as e:
        print(f"[fatal] unable to build universe: {e}", file=sys.stderr)
        sys.exit(2)

    enriched = enrich_with_yahoo(universe, limit=args.limit, sleep_s=args.sleep)

    # Keep only Materials/Energy in case any slipped through without sector field
    filtered = [r for r in enriched if (r.sector or "").lower() in TARGET_SECTORS]

    # Write CSV
    write_csv(filtered, args.output)


if __name__ == "__main__":
    main()
