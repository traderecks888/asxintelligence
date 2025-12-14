#!/usr/bin/env python3
"""
ASX Intrinsic Valuations Export → Excel
======================================

What it does
- Builds/refreshes the full ASX universe once per month (default) using your existing universe scraper.
- Pulls Yahoo Finance (via yfinance) fundamentals for each ticker.
- Computes the intrinsic value methods from your Core Enhanced Valuations file:
    - DCF (5yr)
    - Residual Income
    - Asset Based (NTA)
    - SOTP (DCF minus discount)
    - Dividend Discount
    - Earnings Power Value (EPV)
    - Reverse DCF (implied growth)
    - Option Pricing (Black-Scholes ATM call proxy)
- Adds book value (total) + book value per share (both Yahoo and balance-sheet-derived).
- Adds a handful of quant-friendly fields (FCF yield, leverage ratios, margin metrics, etc.)
- Writes a single .xlsx with:
    - Valuations (main sheet)
    - Assumptions (global model parameters)
    - Valuation Formulas (method notes)

Expected folder layout (recommended)
.
├─ asx_intrinsic_valuations_export.py        (this file)
├─ scrape_asx_universe.py                   (your scraper)
├─ scrape_asx_materials_energy.py           (optional, for products/stage enrichment)
└─ data/
   ├─ universe/asx_universe.csv
   ├─ roster/asx_materials_energy_companies.csv   (optional)
   └─ valuations/ASX_Intrinsic_Valuations_YYYYMMDD_HHMMSS.xlsx

Install deps
    pip install pandas yfinance openpyxl numpy requests beautifulsoup4 lxml

Run (default paths)
    python asx_intrinsic_valuations_export.py

Run (fast dev test)
    python asx_intrinsic_valuations_export.py --limit 50 --sleep 0.15

Notes
- Yahoo/yfinance is a best-effort data source. Many fields will be missing for some tickers.
- 2000+ tickers can take a while. Use --resume so you can stop/restart without losing progress.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd
import yfinance as yf

from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter


# --------------------------------------------------------------------------------------
# Global valuation assumptions (copied from your Core-EnhancedValuationsv5.3.py)
# --------------------------------------------------------------------------------------

ASSUMPTIONS: Dict[str, float] = {
    "risk_free_rate": 0.04,
    "market_risk_premium": 0.06,
    "terminal_growth_rate": 0.02,
    "valuation_period": 5,
    "tax_rate": 0.30,
    "sotp_discount": 0.20,
    "margin_of_safety": 0.25,
    "asset_premium": 0.10,
    "dividend_growth_rate": 0.03,
    "option_years": 5,
    "volatility": 0.30,
}

DEFAULT_GROWTH_FALLBACK = 0.05  # used if revenueGrowth is missing


# --------------------------------------------------------------------------------------
# Excel formatting (lightweight, fast)
# --------------------------------------------------------------------------------------

HEADER_FILL = PatternFill(start_color="4F81BD", end_color="4F81BD", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True)


# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------

def now_stamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def safe_get(d: Dict[str, Any], key: str, default=np.nan):
    try:
        v = d.get(key, default)
        return default if v is None else v
    except Exception:
        return default


def ensure_parent_dir(p: Path) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)


def parse_iso(dt_str: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(dt_str)
    except Exception:
        return None


def is_csv_fresh(csv_path: Path, max_age_days: int) -> bool:
    """Mirror the 'freshness' logic your scrape_asx_universe.py uses (last_extracted, else mtime)."""
    if not csv_path.exists():
        return False

    try:
        df = pd.read_csv(csv_path)
        if "last_extracted" in df.columns and not df.empty:
            ts = None
            for v in df["last_extracted"].dropna().astype(str).tolist():
                dv = parse_iso(v)
                if dv and (ts is None or dv > ts):
                    ts = dv
            if ts is not None:
                return (datetime.now(ts.tzinfo) if ts.tzinfo else datetime.now()) - ts <= timedelta(days=max_age_days)
    except Exception:
        pass

    try:
        mtime = datetime.fromtimestamp(csv_path.stat().st_mtime)
        return datetime.now() - mtime <= timedelta(days=max_age_days)
    except Exception:
        return False


def run_universe_scraper(scraper_path: Path, output_csv: Path, tickers_txt: Optional[Path], max_age_days: int, source: str, sleep_s: float) -> None:
    """Run your scrape_asx_universe.py as a subprocess."""
    cmd = [
        sys.executable,
        str(scraper_path),
        "--output", str(output_csv),
        "--source", source,
        "--sleep", str(sleep_s),
        "--max_age_days", str(max_age_days),
    ]
    if tickers_txt is not None:
        cmd += ["--tickers_txt", str(tickers_txt)]

    # Intentionally DO NOT pass --force by default: your scraper already re-scrapes when stale.
    print("[info] universe scraper:", " ".join(cmd))
    subprocess.check_call(cmd)


def maybe_refresh_universe(scraper_path: Path, universe_csv: Path, tickers_txt: Optional[Path], max_age_days: int, source: str, sleep_s: float) -> None:
    """Refresh the universe CSV only if missing or older than max_age_days."""
    if is_csv_fresh(universe_csv, max_age_days=max_age_days):
        print(f"[skip] universe CSV looks fresh (<= {max_age_days} days): {universe_csv}")
        return
    print(f"[run] refreshing ASX universe (max_age_days={max_age_days}) -> {universe_csv}")
    run_universe_scraper(scraper_path, universe_csv, tickers_txt, max_age_days=max_age_days, source=source, sleep_s=sleep_s)


def normalize_ticker(code: str) -> str:
    return (code or "").strip().upper().replace(".AX", "")


def yahoo_symbol(code: str) -> str:
    return f"{normalize_ticker(code)}.AX"


# Normal CDF without SciPy: N(x) = 0.5*(1 + erf(x/sqrt(2)))
def norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def black_scholes_call(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Black-Scholes call option pricing model."""
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        return float("nan")
    d1 = (math.log(S / K) + (r + (sigma ** 2) / 2.0) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return S * norm_cdf(d1) - K * math.exp(-r * T) * norm_cdf(d2)


def try_get_info(t: yf.Ticker) -> Dict[str, Any]:
    """yfinance changed APIs over time; be conservative."""
    try:
        return t.get_info()  # new-style
    except Exception:
        try:
            return t.info  # legacy
        except Exception:
            return {}


def get_balance_sheet_items(t: yf.Ticker) -> Dict[str, float]:
    """Pull a small set of balance sheet items (quarterly first, then annual)."""
    out = {
        "cash": np.nan,
        "total_assets": np.nan,
        "total_liabilities": np.nan,
        "net_tangible_assets": np.nan,
    }

    def _probe(sheet) -> bool:
        if sheet is None:
            return False
        try:
            idx = getattr(sheet, "index", [])
            if idx is None:
                return False

            # Cash
            for item in ["Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments"]:
                if item in idx:
                    out["cash"] = float(sheet.loc[item].iloc[0])
                    break

            if "Total Assets" in idx:
                out["total_assets"] = float(sheet.loc["Total Assets"].iloc[0])

            for item in ["Total Liabilities Net Minority Interest", "Total Liabilities"]:
                if item in idx:
                    out["total_liabilities"] = float(sheet.loc[item].iloc[0])
                    break

            if "Net Tangible Assets" in idx:
                out["net_tangible_assets"] = float(sheet.loc["Net Tangible Assets"].iloc[0])
            elif not np.isnan(out["total_assets"]) and not np.isnan(out["total_liabilities"]):
                out["net_tangible_assets"] = out["total_assets"] - out["total_liabilities"]

            return not all(np.isnan(v) for v in out.values())
        except Exception:
            return False

    # Prefer quarterly
    if _probe(getattr(t, "quarterly_balance_sheet", None)):
        return out
    _probe(getattr(t, "balance_sheet", None))
    return out


def clip_growth(g: float) -> float:
    """Guardrail: Yahoo growth series can be wild or NaN."""
    if np.isnan(g):
        return DEFAULT_GROWTH_FALLBACK
    # Clamp to a sensible-ish band for a quick-and-dirty DCF
    return float(max(-0.10, min(0.25, g)))


def calc_valuations(row: Dict[str, Any]) -> Dict[str, Any]:
    """Compute valuation methods (mirrors your Core Enhanced Valuations logic)."""
    res: Dict[str, Any] = {}

    # Inputs
    fcf = float(safe_get(row, "freeCashflow", 0.0) or 0.0)
    growth_raw = safe_get(row, "revenueGrowth", np.nan)
    growth = clip_growth(float(growth_raw) if not np.isnan(growth_raw) else np.nan)
    beta = float(safe_get(row, "beta", 1.0) or 1.0)

    total_debt = safe_get(row, "totalDebt", 0.0)
    total_debt = float(total_debt) if not np.isnan(total_debt) else 0.0

    cash = safe_get(row, "cash", np.nan)
    cash = float(cash) if not np.isnan(cash) else 0.0

    shares_out = safe_get(row, "sharesOutstanding", np.nan)
    if np.isnan(shares_out) or shares_out <= 0:
        shares_out = np.nan

    current_price = safe_get(row, "currentPrice", np.nan)
    current_price = float(current_price) if not np.isnan(current_price) else np.nan

    book_value_ps_yahoo = safe_get(row, "bookValue", np.nan)  # per share
    book_value_ps_yahoo = float(book_value_ps_yahoo) if not np.isnan(book_value_ps_yahoo) else np.nan

    roe = safe_get(row, "returnOnEquity", np.nan)
    roe = float(roe) if not np.isnan(roe) else np.nan

    total_revenue = safe_get(row, "totalRevenue", np.nan)
    total_revenue = float(total_revenue) if not np.isnan(total_revenue) else np.nan

    operating_margin = safe_get(row, "operatingMargins", np.nan)
    operating_margin = float(operating_margin) if not np.isnan(operating_margin) else np.nan

    ebitda = safe_get(row, "ebitda", np.nan)
    ebitda = float(ebitda) if not np.isnan(ebitda) else np.nan

    dividend_rate = safe_get(row, "dividendRate", np.nan)
    dividend_rate = float(dividend_rate) if not np.isnan(dividend_rate) else np.nan

    dividend_yield = safe_get(row, "dividendYield", np.nan)
    dividend_yield = float(dividend_yield) if not np.isnan(dividend_yield) else np.nan

    trailing_eps = safe_get(row, "trailingEps", np.nan)
    trailing_eps = float(trailing_eps) if not np.isnan(trailing_eps) else np.nan

    earnings_growth = safe_get(row, "earningsGrowth", np.nan)
    earnings_growth = float(earnings_growth) if not np.isnan(earnings_growth) else np.nan

    # Global rates
    rf = float(ASSUMPTIONS["risk_free_rate"])
    mrp = float(ASSUMPTIONS["market_risk_premium"])
    tgr = float(ASSUMPTIONS["terminal_growth_rate"])
    years = int(ASSUMPTIONS["valuation_period"])
    tax = float(ASSUMPTIONS["tax_rate"])

    cost_of_equity = rf + beta * mrp
    wacc = cost_of_equity  # equity-only version like your core file

    res["growth_input_used"] = growth
    res["cost_of_equity"] = cost_of_equity
    res["wacc"] = wacc

    # DCF
    dcf_price = np.nan
    enterprise_value = np.nan
    equity_value = np.nan
    net_debt = np.nan
    dcf_estimate = ""

    if not np.isnan(shares_out) and shares_out > 0:
        try:
            projected_fcf = [fcf * ((1.0 + growth) ** y) for y in range(1, years + 1)]
            # Guard: wacc - tgr must be > 0
            denom = max(0.01, (wacc - tgr))
            terminal_value = (projected_fcf[-1] * (1.0 + tgr)) / denom

            discounted_cf = [cf / ((1.0 + wacc) ** y) for y, cf in enumerate(projected_fcf, 1)]
            discounted_tv = terminal_value / ((1.0 + wacc) ** years)

            enterprise_value = float(sum(discounted_cf) + discounted_tv)
            net_debt = float(total_debt - cash)
            equity_value = float(enterprise_value - net_debt)
            dcf_price = float(equity_value / shares_out) if shares_out else np.nan

            if not np.isnan(current_price) and not np.isnan(dcf_price):
                dcf_estimate = "Undervalued" if dcf_price > current_price else "Overvalued"
        except Exception:
            pass

    res.update({
        "enterprise_value_dcf": enterprise_value,
        "equity_value_dcf": equity_value,
        "net_debt": net_debt,
        "dcf_price": dcf_price,
        "dcf_estimate": dcf_estimate,
    })

    # Dividend Discount Model
    ddm_price = np.nan
    payout_ratio = np.nan
    try:
        g_div = float(ASSUMPTIONS["dividend_growth_rate"])
        if not np.isnan(dividend_rate) and dividend_rate > 0 and (cost_of_equity - g_div) > 0:
            ddm_price = float(dividend_rate / (cost_of_equity - g_div))
        if not np.isnan(dividend_rate) and not np.isnan(trailing_eps) and trailing_eps > 0:
            payout_ratio = float(dividend_rate / trailing_eps)
    except Exception:
        pass

    res.update({
        "ddm_price": ddm_price,
        "dividend_yield": dividend_yield,
        "payout_ratio": payout_ratio,
    })

    # Earnings Power Value (EPV)
    epv_price = np.nan
    normalized_earnings = np.nan
    epv_ebit_multiple = np.nan
    try:
        if not np.isnan(total_revenue) and not np.isnan(operating_margin):
            normalized_earnings = float(total_revenue * operating_margin * (1.0 - tax))
            epv = float(normalized_earnings / cost_of_equity) if cost_of_equity > 0 else np.nan
            if not np.isnan(shares_out) and shares_out > 0:
                epv_price = float((epv + cash - total_debt) / shares_out)
            if not np.isnan(ebitda) and ebitda > 0 and not np.isnan(epv):
                epv_ebit_multiple = float(epv / ebitda)
    except Exception:
        pass

    res.update({
        "epv_price": epv_price,
        "normalized_earnings": normalized_earnings,
        "epv_ebit_multiple": epv_ebit_multiple,
    })

    # Residual Income
    ri_price = np.nan
    try:
        if not np.isnan(book_value_ps_yahoo) and not np.isnan(roe):
            residual_income = book_value_ps_yahoo * (roe - cost_of_equity)
            ri_price = float(book_value_ps_yahoo + (residual_income / (1.0 + cost_of_equity)))
    except Exception:
        pass
    res["residual_income_price"] = ri_price

    # Asset Based (NTA)
    asset_price = np.nan
    try:
        nta = safe_get(row, "net_tangible_assets", np.nan)
        if not np.isnan(nta) and not np.isnan(shares_out) and shares_out > 0:
            asset_price = float((float(nta) * (1.0 + float(ASSUMPTIONS["asset_premium"]))) / shares_out)
    except Exception:
        pass
    res["asset_based_price"] = asset_price

    # SOTP (discount to DCF)
    sotp_price = np.nan
    try:
        if not np.isnan(dcf_price):
            sotp_price = float(dcf_price * (1.0 - float(ASSUMPTIONS["sotp_discount"])))
    except Exception:
        pass
    res["sotp_price"] = sotp_price

    # Reverse DCF (implied growth)
    implied_g = np.nan
    try:
        if not np.isnan(current_price) and current_price > 0 and not np.isnan(shares_out) and shares_out > 0 and fcf > 0:
            target_equity = current_price * shares_out
            target_ev = target_equity + total_debt - cash

            low, high = -0.10, 0.20
            tolerance = 0.001

            for _ in range(100):
                mid = (low + high) / 2.0
                projected_fcf = [fcf * ((1.0 + mid) ** y) for y in range(1, years + 1)]
                denom = max(0.01, (wacc - tgr))
                terminal_value = (projected_fcf[-1] * (1.0 + tgr)) / denom
                calc_ev = sum([cf / ((1.0 + wacc) ** y) for y, cf in enumerate(projected_fcf, 1)]) + (terminal_value / ((1.0 + wacc) ** years))

                if calc_ev > target_ev:
                    high = mid
                else:
                    low = mid

                if abs(calc_ev - target_ev) < tolerance:
                    break

            implied_g = float(mid)
    except Exception:
        pass
    res["reverse_dcf_implied_growth"] = implied_g

    # Option Pricing proxy (ATM 5y call)
    opt_value = np.nan
    strike = np.nan
    try:
        if not np.isnan(current_price) and current_price > 0:
            strike = float(current_price)
            opt_value = float(black_scholes_call(
                S=float(current_price),
                K=strike,
                T=float(ASSUMPTIONS["option_years"]),
                r=float(ASSUMPTIONS["risk_free_rate"]),
                sigma=float(ASSUMPTIONS["volatility"]),
            ))
    except Exception:
        pass
    res.update({
        "option_value": opt_value,
        "option_strike": strike,
        "option_volatility": float(ASSUMPTIONS["volatility"]),
    })

    # PEG Ratio
    peg = np.nan
    try:
        trailing_pe = safe_get(row, "trailingPE", np.nan)
        if not np.isnan(trailing_pe) and not np.isnan(earnings_growth) and earnings_growth != 0:
            peg = float(trailing_pe / (earnings_growth * 100.0))
    except Exception:
        pass
    res["peg_ratio"] = peg

    # Premium/discounts
    def _prem(v: float) -> float:
        if np.isnan(current_price) or current_price <= 0 or np.isnan(v):
            return np.nan
        return float((v - current_price) / current_price)

    res.update({
        "dcf_prem": _prem(dcf_price),
        "ri_prem": _prem(ri_price),
        "asset_prem": _prem(asset_price),
        "sotp_prem": _prem(sotp_price),
        "ddm_prem": _prem(ddm_price),
        "epv_prem": _prem(epv_price),
        "opt_prem": _prem(opt_value),
        "margin_of_safety": float(ASSUMPTIONS["margin_of_safety"]),
        "mos_buy_price": float(dcf_price * (1.0 - float(ASSUMPTIONS["margin_of_safety"]))) if not np.isnan(dcf_price) else np.nan,
    })

    # "Undervalued Methods Count" like your core file
    prem_cols = ["dcf_prem", "ri_prem", "asset_prem", "sotp_prem", "ddm_prem"]
    res["undervalued_methods_count"] = int(sum(1 for c in prem_cols if not np.isnan(res.get(c, np.nan)) and float(res[c]) > 0))

    return res


def compute_extra_metrics(info: Dict[str, Any], bs: Dict[str, float], shares_out: float) -> Dict[str, Any]:
    """Add a few practical value/quality/leverage fields."""
    out: Dict[str, Any] = {}
    market_cap = safe_get(info, "marketCap", np.nan)
    enterprise_value = safe_get(info, "enterpriseValue", np.nan)

    fcf = safe_get(info, "freeCashflow", np.nan)
    if not np.isnan(market_cap) and market_cap and not np.isnan(fcf):
        out["fcf_yield"] = float(fcf) / float(market_cap)
    else:
        out["fcf_yield"] = np.nan

    # Book value total + per share (two ways)
    book_ps = safe_get(info, "bookValue", np.nan)  # Yahoo "bookValue" is per share
    out["book_value_per_share_yahoo"] = float(book_ps) if not np.isnan(book_ps) else np.nan
    if not np.isnan(book_ps) and not np.isnan(shares_out) and shares_out > 0:
        out["book_value_total_yahoo"] = float(book_ps) * float(shares_out)
    else:
        out["book_value_total_yahoo"] = np.nan

    equity_bs = np.nan
    if not np.isnan(bs.get("total_assets", np.nan)) and not np.isnan(bs.get("total_liabilities", np.nan)):
        equity_bs = float(bs["total_assets"]) - float(bs["total_liabilities"])
    out["book_value_total_bs_equity"] = equity_bs
    if not np.isnan(equity_bs) and not np.isnan(shares_out) and shares_out > 0:
        out["book_value_per_share_bs_equity"] = float(equity_bs) / float(shares_out)
    else:
        out["book_value_per_share_bs_equity"] = np.nan

    # NTA per share
    nta = bs.get("net_tangible_assets", np.nan)
    out["nta_total"] = float(nta) if not np.isnan(nta) else np.nan
    if not np.isnan(nta) and not np.isnan(shares_out) and shares_out > 0:
        out["nta_per_share"] = float(nta) / float(shares_out)
    else:
        out["nta_per_share"] = np.nan

    # Leverage ratios (as provided by Yahoo, if present)
    out["debt_to_equity"] = safe_get(info, "debtToEquity", np.nan)
    out["current_ratio"] = safe_get(info, "currentRatio", np.nan)
    out["quick_ratio"] = safe_get(info, "quickRatio", np.nan)

    # Margins (quality)
    out["gross_margin"] = safe_get(info, "grossMargins", np.nan)
    out["operating_margin"] = safe_get(info, "operatingMargins", np.nan)
    out["profit_margin"] = safe_get(info, "profitMargins", np.nan)

    out["roa"] = safe_get(info, "returnOnAssets", np.nan)
    out["roe"] = safe_get(info, "returnOnEquity", np.nan)

    # Common value multiples
    out["trailing_pe"] = safe_get(info, "trailingPE", np.nan)
    out["forward_pe"] = safe_get(info, "forwardPE", np.nan)
    out["price_to_book"] = safe_get(info, "priceToBook", np.nan)
    out["ev_to_ebitda"] = safe_get(info, "enterpriseToEbitda", np.nan)

    # Optionality: leverage vs EBITDA
    total_debt = safe_get(info, "totalDebt", np.nan)
    cash = bs.get("cash", np.nan)
    ebitda = safe_get(info, "ebitda", np.nan)
    if not np.isnan(total_debt) and not np.isnan(cash):
        out["net_debt_calc"] = float(total_debt) - float(cash)
    else:
        out["net_debt_calc"] = np.nan
    if not np.isnan(out["net_debt_calc"]) and not np.isnan(ebitda) and ebitda and float(ebitda) != 0:
        out["net_debt_to_ebitda"] = float(out["net_debt_calc"]) / float(ebitda)
    else:
        out["net_debt_to_ebitda"] = np.nan

    # Ownership / short interest (if present)
    out["held_pct_insiders"] = safe_get(info, "heldPercentInsiders", np.nan)
    out["held_pct_institutions"] = safe_get(info, "heldPercentInstitutions", np.nan)
    out["short_pct_float"] = safe_get(info, "shortPercentOfFloat", np.nan)

    # Prefer EV from Yahoo if present; else compute
    if np.isnan(enterprise_value) and not np.isnan(market_cap):
        out["enterprise_value_yahoo_or_calc"] = float(market_cap) + (float(total_debt) if not np.isnan(total_debt) else 0.0) - (float(cash) if not np.isnan(cash) else 0.0)
    else:
        out["enterprise_value_yahoo_or_calc"] = enterprise_value

    return out


def format_sheet(ws) -> None:
    ws.freeze_panes = "B2"
    ws.auto_filter.ref = ws.dimensions

    # Header style
    for cell in ws[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # Column widths (cap to keep Excel snappy)
    for col_idx, col in enumerate(ws.iter_cols(min_row=1, max_row=1), start=1):
        header = ws.cell(row=1, column=col_idx).value
        width = min(28, max(10, len(str(header)) + 2))
        ws.column_dimensions[get_column_letter(col_idx)].width = width


def build_formulas_sheet(writer: pd.ExcelWriter) -> None:
    """Same idea as Core-EnhancedValuations: a human-readable sheet."""
    formulas = {
        "DCF Valuation": [
            "1. Project Free Cash Flows for N years",
            "2. Calculate Terminal Value (Gordon growth)",
            "3. Discount all cash flows at WACC (here: Cost of Equity)",
            "4. Convert EV → equity → per-share",
            "Assumptions:",
            f"Risk Free Rate: {ASSUMPTIONS['risk_free_rate']*100:.2f}%",
            f"Market Risk Premium: {ASSUMPTIONS['market_risk_premium']*100:.2f}%",
            f"Terminal Growth: {ASSUMPTIONS['terminal_growth_rate']*100:.2f}%",
            f"Valuation Period: {ASSUMPTIONS['valuation_period']} years",
        ],
        "Dividend Discount Model": [
            "Price = Dividend / (Cost of Equity - Dividend Growth)",
            f"Dividend Growth: {ASSUMPTIONS['dividend_growth_rate']*100:.2f}%",
            "Dividend = dividendRate (Yahoo) if available",
        ],
        "Residual Income Model": [
            "Price = Book Value per Share + Residual Income / (1 + Cost of Equity)",
            "Residual Income = BVPS * (ROE - Cost of Equity)",
        ],
        "Asset Based (NTA)": [
            "Price = (Net Tangible Assets * (1 + Asset Premium)) / Shares Outstanding",
            f"Asset Premium: {ASSUMPTIONS['asset_premium']*100:.2f}%",
        ],
        "SOTP": [
            "SOTP Price = DCF Price * (1 - SOTP Discount)",
            f"SOTP Discount: {ASSUMPTIONS['sotp_discount']*100:.2f}%",
        ],
        "Earnings Power Value (EPV)": [
            "Normalized Earnings = Revenue * Operating Margin * (1 - Tax Rate)",
            f"Tax Rate: {ASSUMPTIONS['tax_rate']*100:.2f}%",
            "EPV = Normalized Earnings / Cost of Equity",
            "EPV Price = (EPV + Cash - Debt) / Shares Outstanding",
        ],
        "Reverse DCF": [
            "Solves for the growth rate that makes DCF EV ≈ current market EV",
            "Binary search between -10% and +20% growth",
        ],
        "Option Pricing": [
            "Black-Scholes: 5y at-the-money call (proxy for 'optionality')",
            f"Volatility: {ASSUMPTIONS['volatility']*100:.2f}%",
            f"Option Years: {ASSUMPTIONS['option_years']}",
        ],
        "Margin of Safety": [
            f"MOS Buy Price = DCF Price * (1 - {ASSUMPTIONS['margin_of_safety']*100:.2f}%)",
        ],
    }

    max_len = max(len(v) for v in formulas.values())
    for k in formulas:
        formulas[k] += [""] * (max_len - len(formulas[k]))

    df = pd.DataFrame(formulas)
    df.to_excel(writer, sheet_name="Valuation Formulas", index=False)
    ws = writer.book["Valuation Formulas"]
    ws.freeze_panes = "A2"
    for cell in ws[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for col in ws.columns:
        ws.column_dimensions[get_column_letter(col[0].column)].width = 38
        for cell in col:
            cell.alignment = Alignment(wrap_text=True, vertical="top")


def write_assumptions_sheet(writer: pd.ExcelWriter) -> None:
    df = pd.DataFrame(
        [{"parameter": k, "value": v} for k, v in ASSUMPTIONS.items()]
        + [{"parameter": "growth_fallback_if_missing", "value": DEFAULT_GROWTH_FALLBACK}]
    )
    df.to_excel(writer, sheet_name="Assumptions", index=False)
    ws = writer.book["Assumptions"]
    ws.freeze_panes = "A2"
    for cell in ws[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 18


# --------------------------------------------------------------------------------------
# Main run
# --------------------------------------------------------------------------------------

@dataclass
class UniverseRow:
    ticker: str
    name: str = ""
    sector: str = ""
    industry: str = ""
    market_cap: Optional[float] = None


def load_universe(universe_csv: Path) -> List[UniverseRow]:
    df = pd.read_csv(universe_csv)

    # Accept a couple of common column spellings
    col_ticker = "ticker" if "ticker" in df.columns else ("Code" if "Code" in df.columns else None)
    if col_ticker is None:
        raise ValueError(f"Universe CSV is missing a ticker column: {universe_csv}")

    def _col(name: str) -> str:
        return name if name in df.columns else ""

    rows: List[UniverseRow] = []
    for _, r in df.iterrows():
        t = normalize_ticker(str(r[col_ticker]))
        if not t:
            continue
        rows.append(UniverseRow(
            ticker=t,
            name=str(r[_col("name")]) if _col("name") else str(r.get("Company name", "")),
            sector=str(r[_col("sector")]) if _col("sector") else str(r.get("GICS industry group", "")),
            industry=str(r[_col("industry")]) if _col("industry") else str(r.get("Industry group", "")),
            market_cap=float(r["market_cap"]) if "market_cap" in df.columns and str(r.get("market_cap", "")).strip() not in ["", "nan", "None"] else None,
        ))
    return rows


def maybe_load_materials_energy(roster_csv: Path) -> Optional[pd.DataFrame]:
    """Optional join: products/stage columns from scrape_asx_materials_energy.py output."""
    if not roster_csv.exists():
        return None
    try:
        df = pd.read_csv(roster_csv)
        if "ticker" not in df.columns:
            return None
        df["ticker"] = df["ticker"].astype(str).map(normalize_ticker)
        # Keep only the useful columns
        keep = [c for c in ["ticker", "products", "stage"] if c in df.columns]
        return df[keep].drop_duplicates("ticker")
    except Exception:
        return None


def fetch_one(ticker_code: str, company: UniverseRow) -> Optional[Dict[str, Any]]:
    sym = yahoo_symbol(ticker_code)
    t = yf.Ticker(sym)
    info = try_get_info(t)
    if not info:
        return None

    bs = get_balance_sheet_items(t)

    current_price = safe_get(info, "currentPrice", np.nan)
    market_cap = safe_get(info, "marketCap", np.nan)

    shares_out = safe_get(info, "sharesOutstanding", np.nan)
    if (np.isnan(shares_out) or shares_out <= 0) and not np.isnan(market_cap) and not np.isnan(current_price) and current_price:
        shares_out = float(market_cap) / float(current_price)

    # Base row
    row: Dict[str, Any] = {
        "ticker": ticker_code,
        "company_name": company.name or safe_get(info, "shortName", ""),
        "sector": company.sector,
        "industry": company.industry,
        "currency": safe_get(info, "currency", "AUD"),
        "asof": datetime.now().strftime("%Y-%m-%d"),
        # Yahoo raw keys we care about
        "currentPrice": current_price,
        "marketCap": market_cap,
        "sharesOutstanding": shares_out,
        "beta": safe_get(info, "beta", np.nan),
        "freeCashflow": safe_get(info, "freeCashflow", np.nan),
        "revenueGrowth": safe_get(info, "revenueGrowth", np.nan),
        "earningsGrowth": safe_get(info, "earningsGrowth", np.nan),
        "totalDebt": safe_get(info, "totalDebt", np.nan),
        "bookValue": safe_get(info, "bookValue", np.nan),  # per share
        "returnOnEquity": safe_get(info, "returnOnEquity", np.nan),
        "trailingPE": safe_get(info, "trailingPE", np.nan),
        "enterpriseToEbitda": safe_get(info, "enterpriseToEbitda", np.nan),
        "priceToBook": safe_get(info, "priceToBook", np.nan),
        "dividendYield": safe_get(info, "dividendYield", np.nan),
        "dividendRate": safe_get(info, "dividendRate", np.nan),
        "trailingEps": safe_get(info, "trailingEps", np.nan),
        "totalRevenue": safe_get(info, "totalRevenue", np.nan),
        "ebitda": safe_get(info, "ebitda", np.nan),
        "operatingMargins": safe_get(info, "operatingMargins", np.nan),
        # Balance-sheet derived
        "cash": bs["cash"],
        "total_assets": bs["total_assets"],
        "total_liabilities": bs["total_liabilities"],
        "net_tangible_assets": bs["net_tangible_assets"],
    }

    # Valuations
    val = calc_valuations(row)
    row.update(val)

    # Extra metrics (book totals, yields, leverage ratios, etc.)
    extras = compute_extra_metrics(info, bs, float(row["sharesOutstanding"]) if not np.isnan(row["sharesOutstanding"]) else np.nan)
    row.update(extras)

    # Friendly rename for output columns
    out_row = {
        "Ticker": row["ticker"],
        "Company": row["company_name"],
        "Sector": row["sector"],
        "Industry": row["industry"],
        "Currency": row["currency"],
        "As Of": row["asof"],
        "Price": row["currentPrice"],
        "Market Cap": row["marketCap"],
        "Shares Out": row["sharesOutstanding"],
        "Cash": row["cash"],
        "Total Debt": row["totalDebt"],
        "Net Debt (Debt - Cash)": row.get("net_debt", np.nan),
        "Total Assets": row["total_assets"],
        "Total Liabilities": row["total_liabilities"],
        "NTA": row["net_tangible_assets"],
        "NTA / Share": row["nta_per_share"],

        # Book value (explicit)
        "Book Value (Total, Yahoo)": row["book_value_total_yahoo"],
        "Book Value / Share (Yahoo)": row["book_value_per_share_yahoo"],
        "Book Value (Total, Assets-Liab)": row["book_value_total_bs_equity"],
        "Book Value / Share (Assets-Liab)": row["book_value_per_share_bs_equity"],

        # Intrinsic values (prices)
        "DCF Price (5yr)": row["dcf_price"],
        "Residual Income Price": row["residual_income_price"],
        "Asset Based Price": row["asset_based_price"],
        "SOTP Price": row["sotp_price"],
        "Dividend Discount Price": row["ddm_price"],
        "Earnings Power Value (EPV) Price": row["epv_price"],
        "Option Pricing Value": row["option_value"],

        # Diagnostics
        "DCF Estimate": row["dcf_estimate"],
        "Reverse DCF Implied Growth": row["reverse_dcf_implied_growth"],
        "PEG Ratio": row["peg_ratio"],
        "Normalized Earnings": row["normalized_earnings"],
        "EPV/EBITDA Multiple": row["epv_ebit_multiple"],

        # Premium/(Discount) vs price
        "DCF Premium/(Discount)": row["dcf_prem"],
        "Residual Income Premium/(Discount)": row["ri_prem"],
        "Asset Based Premium/(Discount)": row["asset_prem"],
        "SOTP Premium/(Discount)": row["sotp_prem"],
        "Dividend Discount Premium/(Discount)": row["ddm_prem"],
        "EPV Premium/(Discount)": row["epv_prem"],
        "Option Pricing Premium/(Discount)": row["opt_prem"],

        "Margin of Safety": row["margin_of_safety"],
        "MOS Buy Price": row["mos_buy_price"],
        "Undervalued Methods Count": row["undervalued_methods_count"],

        # Inputs / parameters used (per company + global)
        "FCF (Yahoo)": row["freeCashflow"],
        "Revenue Growth (Yahoo)": row["revenueGrowth"],
        "Growth Input Used": row["growth_input_used"],
        "Beta": row["beta"],
        "Risk Free Rate": ASSUMPTIONS["risk_free_rate"],
        "Market Risk Premium": ASSUMPTIONS["market_risk_premium"],
        "Cost of Equity": row["cost_of_equity"],
        "WACC": row["wacc"],
        "Terminal Growth Rate": ASSUMPTIONS["terminal_growth_rate"],
        "Valuation Period (yrs)": ASSUMPTIONS["valuation_period"],
        "Tax Rate": ASSUMPTIONS["tax_rate"],
        "Asset Premium": ASSUMPTIONS["asset_premium"],
        "SOTP Discount": ASSUMPTIONS["sotp_discount"],
        "Dividend Growth Rate": ASSUMPTIONS["dividend_growth_rate"],
        "Option Years": ASSUMPTIONS["option_years"],
        "Option Volatility": ASSUMPTIONS["volatility"],
        "Option Strike": row["option_strike"],

        # Extra quant fields
        "FCF Yield": row["fcf_yield"],
        "Trailing PE": row["trailing_pe"],
        "Forward PE": row["forward_pe"],
        "P/B": row["price_to_book"],
        "EV/EBITDA": row["ev_to_ebitda"],
        "Gross Margin": row["gross_margin"],
        "Operating Margin": row["operating_margin"],
        "Profit Margin": row["profit_margin"],
        "ROA": row["roa"],
        "ROE": row["roe"],
        "Debt/Equity": row["debt_to_equity"],
        "Current Ratio": row["current_ratio"],
        "Quick Ratio": row["quick_ratio"],
        "Net Debt/EBITDA": row["net_debt_to_ebitda"],
        "Held % Insiders": row["held_pct_insiders"],
        "Held % Institutions": row["held_pct_institutions"],
        "Short % Float": row["short_pct_float"],
        "Enterprise Value (Yahoo/Calc)": row["enterprise_value_yahoo_or_calc"],
    }

    return out_row


def main() -> None:
    ap = argparse.ArgumentParser(description="Compute intrinsic values for all ASX tickers and export to Excel.")
    ap.add_argument("--scraper", default="scrape_asx_universe.py", help="Path to scrape_asx_universe.py")
    ap.add_argument("--universe_csv", default="data/universe/asx_universe.csv", help="Universe CSV output (cached)")
    ap.add_argument("--tickers_txt", default="", help="Optional tickers TXT output (cached)")
    ap.add_argument("--universe_max_age_days", type=int, default=30, help="Refresh universe only if older than this many days")
    ap.add_argument("--universe_source", default="auto", choices=["auto", "asx_csv", "marketindex"], help="Universe source")
    ap.add_argument("--universe_sleep", type=float, default=0.5, help="Polite sleep for fallback crawling (universe script)")
    ap.add_argument("--materials_energy_csv", default="data/roster/asx_materials_energy_companies.csv", help="Optional: join products/stage if exists")
    ap.add_argument("--output_xlsx", default="", help="Output Excel path (default: data/valuations/...)")
    ap.add_argument("--public_dir", default="public/data", help="Also write latest.* (xlsx/csv/json[/parquet]) into this directory for Cloudflare Pages")
    ap.add_argument("--sleep", type=float, default=0.25, help="Sleep seconds between Yahoo calls (valuations)")
    ap.add_argument("--limit", type=int, default=0, help="Limit tickers (debug). 0 = no limit")
    ap.add_argument("--resume", action="store_true", help="Resume from a progress CSV if present")
    ap.add_argument("--progress_csv", default="data/valuations/_progress_intrinsic.csv", help="Progress CSV for --resume")
    args = ap.parse_args()

    scraper_path = Path(args.scraper).resolve()
    universe_csv = Path(args.universe_csv).resolve()
    tickers_txt = Path(args.tickers_txt).resolve() if args.tickers_txt else None

    # 1) Universe refresh (monthly)
    maybe_refresh_universe(
        scraper_path=scraper_path,
        universe_csv=universe_csv,
        tickers_txt=tickers_txt,
        max_age_days=args.universe_max_age_days,
        source=args.universe_source,
        sleep_s=args.universe_sleep,
    )

    # 2) Load universe
    universe = load_universe(universe_csv)
    if args.limit and args.limit > 0:
        universe = universe[: args.limit]
    print(f"[info] tickers to process: {len(universe)}")

    # Optional join: products/stage (from your materials/energy scraper)
    me_df = maybe_load_materials_energy(Path(args.materials_energy_csv).resolve())

    # 3) Resume support
    progress_csv = Path(args.progress_csv).resolve()
    processed = set()
    rows_out: List[Dict[str, Any]] = []

    if args.resume and progress_csv.exists():
        try:
            prev = pd.read_csv(progress_csv)
            if "Ticker" in prev.columns:
                processed = set(prev["Ticker"].astype(str).map(normalize_ticker).tolist())
                rows_out = prev.to_dict(orient="records")
            print(f"[resume] loaded {len(processed)} processed tickers from {progress_csv}")
        except Exception as e:
            print(f"[warn] failed to read progress csv; starting fresh: {e}")

    # 4) Main loop
    t0 = time.time()
    for i, u in enumerate(universe, start=1):
        if u.ticker in processed:
            continue

        print(f"[{i}/{len(universe)}] {u.ticker}")
        try:
            r = fetch_one(u.ticker, u)
            if r is not None:
                rows_out.append(r)
                processed.add(u.ticker)
        except Exception as e:
            print(f"[warn] {u.ticker} failed: {e}")

        # Flush progress every 50 tickers
        if args.resume and (len(processed) % 50 == 0):
            ensure_parent_dir(progress_csv)
            pd.DataFrame(rows_out).to_csv(progress_csv, index=False)

        time.sleep(max(0.0, float(args.sleep)))

    dt = time.time() - t0
    print(f"[done] processed={len(processed)} rows in {dt/60.0:.1f} min")

    if not rows_out:
        print("[fatal] no data collected; aborting.")
        sys.exit(2)

    df = pd.DataFrame(rows_out)

    # Add products/stage if we have it
    if me_df is not None:
        df["_ticker_norm"] = df["Ticker"].astype(str).map(normalize_ticker)
        me_df2 = me_df.copy()
        me_df2["_ticker_norm"] = me_df2["ticker"].astype(str).map(normalize_ticker)
        df = df.merge(me_df2[["_ticker_norm"] + [c for c in ["products", "stage"] if c in me_df2.columns]],
                      on="_ticker_norm", how="left")
        if "products" in df.columns:
            df.rename(columns={"products": "Products (Materials/Energy)", "stage": "Stage (Materials/Energy)"}, inplace=True)
        df.drop(columns=["_ticker_norm"], inplace=True)

    # Order columns (best-effort)
    preferred = [
        "Ticker","Company","Sector","Industry","Products (Materials/Energy)","Stage (Materials/Energy)",
        "Price","Market Cap","Shares Out",
        "DCF Price (5yr)","Residual Income Price","Asset Based Price","SOTP Price","Dividend Discount Price","Earnings Power Value (EPV) Price","Option Pricing Value",
        "DCF Premium/(Discount)","Residual Income Premium/(Discount)","Asset Based Premium/(Discount)","SOTP Premium/(Discount)","Dividend Discount Premium/(Discount)","EPV Premium/(Discount)","Option Pricing Premium/(Discount)",
        "Undervalued Methods Count","MOS Buy Price","Margin of Safety",
        "Book Value (Total, Yahoo)","Book Value / Share (Yahoo)","Book Value (Total, Assets-Liab)","Book Value / Share (Assets-Liab)","NTA","NTA / Share",
        "FCF (Yahoo)","Revenue Growth (Yahoo)","Growth Input Used","Beta","Cost of Equity","WACC",
        "FCF Yield","Trailing PE","Forward PE","P/B","EV/EBITDA","Net Debt/EBITDA",
        "ROE","ROA","Gross Margin","Operating Margin","Profit Margin",
        "Debt/Equity","Current Ratio","Quick Ratio",
        "Held % Insiders","Held % Institutions","Short % Float",
        "Reverse DCF Implied Growth","PEG Ratio","Normalized Earnings","EPV/EBITDA Multiple",
        "Enterprise Value (Yahoo/Calc)",
        "Cash","Total Debt","Net Debt (Debt - Cash)","Total Assets","Total Liabilities",
        "Risk Free Rate","Market Risk Premium","Terminal Growth Rate","Valuation Period (yrs)","Tax Rate","Asset Premium","SOTP Discount","Dividend Growth Rate","Option Years","Option Volatility","Option Strike",
        "Currency","As Of","DCF Estimate",
    ]
    cols = [c for c in preferred if c in df.columns] + [c for c in df.columns if c not in preferred]
    df = df[cols]

    # Output path
    if args.output_xlsx:
        out_xlsx = Path(args.output_xlsx).resolve()
    else:
        out_xlsx = Path("data/valuations").resolve() / f"ASX_Intrinsic_Valuations_{now_stamp()}.xlsx"
    ensure_parent_dir(out_xlsx)

    # 5) Write Excel
    with pd.ExcelWriter(out_xlsx, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Valuations", index=False)
        write_assumptions_sheet(writer)
        build_formulas_sheet(writer)

        # Formatting on main sheet
        ws = writer.book["Valuations"]
        format_sheet(ws)

    # Keep progress CSV as a bonus artifact for later runs
    if args.resume:
        ensure_parent_dir(progress_csv)
        df.to_csv(progress_csv, index=False)

    print(f"[ok] wrote: {out_xlsx}")

    # 6) Also export into public_dir for Cloudflare Pages (latest.*)
    import shutil
    public_dir = Path(args.public_dir).resolve()
    public_dir.mkdir(parents=True, exist_ok=True)

    # Copy Excel to a stable filename
    latest_xlsx = public_dir / "latest.xlsx"
    try:
        shutil.copy2(out_xlsx, latest_xlsx)
    except Exception:
        # Fallback: write a fresh workbook
        with pd.ExcelWriter(latest_xlsx, engine="openpyxl") as writer2:
            df.to_excel(writer2, sheet_name="Valuations", index=False)

    # CSV + JSON (machine-friendly)
    df.to_csv(public_dir / "latest.csv", index=False)
    df.to_json(public_dir / "latest.json", orient="records")

    # Parquet (optional: requires pyarrow or fastparquet)
    parquet_path = public_dir / "latest.parquet"
    try:
        df.to_parquet(parquet_path, index=False)
    except Exception:
        if parquet_path.exists():
            try:
                parquet_path.unlink()
            except Exception:
                pass

    # Manifest metadata
    manifest = {
        "generated_at_local": datetime.now().isoformat(timespec="seconds"),
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "files": {
            "xlsx": "latest.xlsx",
            "csv": "latest.csv",
            "json": "latest.json",
            "parquet": ("latest.parquet" if parquet_path.exists() else None),
        },
    }
    (public_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")



if __name__ == "__main__":
    main()
