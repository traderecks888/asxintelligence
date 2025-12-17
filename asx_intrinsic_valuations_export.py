#!/usr/bin/env python3
"""
ASX Intrinsic Valuations + Technicals → Excel/CSV/JSON (+ optional Parquet)
=========================================================================

Outputs
- Full workbook (timestamped) under data/valuations/ASX_Intrinsic_Valuations_YYYYMMDD_HHMMSS.xlsx
- Web-friendly artifacts under --public_dir (default public/data):
    - latest.xlsx   (subset of columns for Cloudflare Pages)
    - latest.csv
    - latest.json
    - latest.parquet (optional if pyarrow/fastparquet installed)
    - manifest.json

Universe refresh
- Uses scrape_asx_universe.py and only refreshes if older than --universe_max_age_days (default 30)

Data sources
- Fundamentals: Yahoo Finance via yfinance (best effort)
- Technicals: 1y daily bars via yfinance history

Run
    python asx_intrinsic_valuations_export.py --resume

Fast test
    python asx_intrinsic_valuations_export.py --limit 50 --sleep 0.15
"""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import zipfile
import shutil
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import yfinance as yf

from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter


# --------------------------------------------------------------------------------------
# Global valuation assumptions (aligned to your Core-EnhancedValuationsv5.3.py)
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
# Excel formatting
# --------------------------------------------------------------------------------------

HEADER_FILL = PatternFill(start_color="4F81BD", end_color="4F81BD", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True)


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
    if not csv_path.exists():
        return False

    # Check last_extracted column if present (mirrors your scraper style)
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
    print("[info] universe scraper:", " ".join(cmd))
    subprocess.check_call(cmd)


def maybe_refresh_universe(scraper_path: Path, universe_csv: Path, tickers_txt: Optional[Path], max_age_days: int, source: str, sleep_s: float) -> None:
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
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        return float("nan")
    d1 = (math.log(S / K) + (r + (sigma ** 2) / 2.0) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return S * norm_cdf(d1) - K * math.exp(-r * T) * norm_cdf(d2)


def try_get_info(t: yf.Ticker) -> Dict[str, Any]:
    try:
        return t.get_info()
    except Exception:
        try:
            return t.info
        except Exception:
            return {}


def get_balance_sheet_items(t: yf.Ticker) -> Dict[str, float]:
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

    if _probe(getattr(t, "quarterly_balance_sheet", None)):
        return out
    _probe(getattr(t, "balance_sheet", None))
    return out


def clip_growth(g: float) -> float:
    if np.isnan(g):
        return DEFAULT_GROWTH_FALLBACK
    return float(max(-0.10, min(0.25, g)))


def calc_valuations(row: Dict[str, Any]) -> Dict[str, Any]:
    res: Dict[str, Any] = {}

    fcf = float(safe_get(row, "freeCashflow", 0.0) or 0.0)
    growth_raw = safe_get(row, "revenueGrowth", np.nan)
    growth = clip_growth(float(growth_raw) if not np.isnan(growth_raw) else np.nan)
    beta = float(safe_get(row, "beta", 1.0) or 1.0)

    total_debt = safe_get(row, "totalDebt", 0.0)
    total_debt = float(total_debt) if not np.isnan(total_debt) else 0.0

    cash = safe_get(row, "cash", np.nan)
    cash = float(cash) if not np.isnan(cash) else 0.0

    shares_out = safe_get(row, "sharesOutstanding", np.nan)
    shares_out = float(shares_out) if not np.isnan(shares_out) else np.nan

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

    rf = float(ASSUMPTIONS["risk_free_rate"])
    mrp = float(ASSUMPTIONS["market_risk_premium"])
    tgr = float(ASSUMPTIONS["terminal_growth_rate"])
    years = int(ASSUMPTIONS["valuation_period"])
    tax = float(ASSUMPTIONS["tax_rate"])

    cost_of_equity = rf + beta * mrp
    wacc = cost_of_equity

    res["growth_input_used"] = growth
    res["cost_of_equity"] = cost_of_equity
    res["wacc"] = wacc

    dcf_price = np.nan
    enterprise_value = np.nan
    equity_value = np.nan
    net_debt = np.nan
    dcf_estimate = ""

    if not np.isnan(shares_out) and shares_out > 0:
        try:
            projected_fcf = [fcf * ((1.0 + growth) ** y) for y in range(1, years + 1)]
            denom = max(0.01, (wacc - tgr))
            terminal_value = (projected_fcf[-1] * (1.0 + tgr)) / denom

            discounted_cf = [cf / ((1.0 + wacc) ** y) for y, cf in enumerate(projected_fcf, 1)]
            discounted_tv = terminal_value / ((1.0 + wacc) ** years)

            enterprise_value = float(sum(discounted_cf) + discounted_tv)
            net_debt = float(total_debt - cash)
            equity_value = float(enterprise_value - net_debt)
            dcf_price = float(equity_value / shares_out)

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

    res.update({"ddm_price": ddm_price, "dividend_yield": dividend_yield, "payout_ratio": payout_ratio})

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

    res.update({"epv_price": epv_price, "normalized_earnings": normalized_earnings, "epv_ebit_multiple": epv_ebit_multiple})

    ri_price = np.nan
    try:
        if not np.isnan(book_value_ps_yahoo) and not np.isnan(roe):
            residual_income = book_value_ps_yahoo * (roe - cost_of_equity)
            ri_price = float(book_value_ps_yahoo + (residual_income / (1.0 + cost_of_equity)))
    except Exception:
        pass
    res["residual_income_price"] = ri_price

    asset_price = np.nan
    try:
        nta = safe_get(row, "net_tangible_assets", np.nan)
        if not np.isnan(nta) and not np.isnan(shares_out) and shares_out > 0:
            asset_price = float((float(nta) * (1.0 + float(ASSUMPTIONS["asset_premium"]))) / shares_out)
    except Exception:
        pass
    res["asset_based_price"] = asset_price

    sotp_price = np.nan
    try:
        if not np.isnan(dcf_price):
            sotp_price = float(dcf_price * (1.0 - float(ASSUMPTIONS["sotp_discount"])))
    except Exception:
        pass
    res["sotp_price"] = sotp_price

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
    res.update({"option_value": opt_value, "option_strike": strike, "option_volatility": float(ASSUMPTIONS["volatility"])})

    peg = np.nan
    try:
        trailing_pe = safe_get(row, "trailingPE", np.nan)
        if not np.isnan(trailing_pe) and not np.isnan(earnings_growth) and earnings_growth != 0:
            peg = float(trailing_pe / (earnings_growth * 100.0))
    except Exception:
        pass
    res["peg_ratio"] = peg

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

    prem_cols = ["dcf_prem", "ri_prem", "asset_prem", "sotp_prem", "ddm_prem"]
    res["undervalued_methods_count"] = int(sum(1 for c in prem_cols if not np.isnan(res.get(c, np.nan)) and float(res[c]) > 0))

    return res


def compute_extra_metrics(info: Dict[str, Any], bs: Dict[str, float], shares_out: float) -> Dict[str, Any]:
    out: Dict[str, Any] = {}

    market_cap = safe_get(info, "marketCap", np.nan)
    fcf = safe_get(info, "freeCashflow", np.nan)
    out["fcf_yield"] = (float(fcf) / float(market_cap)) if (not np.isnan(market_cap) and market_cap and not np.isnan(fcf)) else np.nan

    book_ps = safe_get(info, "bookValue", np.nan)  # Yahoo "bookValue" is per share
    out["book_value_per_share_yahoo"] = float(book_ps) if not np.isnan(book_ps) else np.nan
    out["book_value_total_yahoo"] = (float(book_ps) * float(shares_out)) if (not np.isnan(book_ps) and not np.isnan(shares_out) and shares_out > 0) else np.nan

    equity_bs = np.nan
    if not np.isnan(bs.get("total_assets", np.nan)) and not np.isnan(bs.get("total_liabilities", np.nan)):
        equity_bs = float(bs["total_assets"]) - float(bs["total_liabilities"])
    out["book_value_total_bs_equity"] = equity_bs
    out["book_value_per_share_bs_equity"] = (float(equity_bs) / float(shares_out)) if (not np.isnan(equity_bs) and not np.isnan(shares_out) and shares_out > 0) else np.nan

    nta = bs.get("net_tangible_assets", np.nan)
    out["nta_total"] = float(nta) if not np.isnan(nta) else np.nan
    out["nta_per_share"] = (float(nta) / float(shares_out)) if (not np.isnan(nta) and not np.isnan(shares_out) and shares_out > 0) else np.nan

    out["debt_to_equity"] = safe_get(info, "debtToEquity", np.nan)
    out["current_ratio"] = safe_get(info, "currentRatio", np.nan)
    out["quick_ratio"] = safe_get(info, "quickRatio", np.nan)

    out["gross_margin"] = safe_get(info, "grossMargins", np.nan)
    out["operating_margin"] = safe_get(info, "operatingMargins", np.nan)
    out["profit_margin"] = safe_get(info, "profitMargins", np.nan)

    out["roa"] = safe_get(info, "returnOnAssets", np.nan)
    out["roe"] = safe_get(info, "returnOnEquity", np.nan)

    out["trailing_pe"] = safe_get(info, "trailingPE", np.nan)
    out["forward_pe"] = safe_get(info, "forwardPE", np.nan)
    out["price_to_book"] = safe_get(info, "priceToBook", np.nan)
    out["ev_to_ebitda"] = safe_get(info, "enterpriseToEbitda", np.nan)

    total_debt = safe_get(info, "totalDebt", np.nan)
    cash = bs.get("cash", np.nan)
    ebitda = safe_get(info, "ebitda", np.nan)
    out["net_debt_calc"] = (float(total_debt) - float(cash)) if (not np.isnan(total_debt) and not np.isnan(cash)) else np.nan
    out["net_debt_to_ebitda"] = (float(out["net_debt_calc"]) / float(ebitda)) if (not np.isnan(out["net_debt_calc"]) and not np.isnan(ebitda) and ebitda) else np.nan

    out["held_pct_insiders"] = safe_get(info, "heldPercentInsiders", np.nan)
    out["held_pct_institutions"] = safe_get(info, "heldPercentInstitutions", np.nan)
    out["short_pct_float"] = safe_get(info, "shortPercentOfFloat", np.nan)

    enterprise_value = safe_get(info, "enterpriseValue", np.nan)
    if np.isnan(enterprise_value) and not np.isnan(market_cap):
        out["enterprise_value_yahoo_or_calc"] = float(market_cap) + (float(total_debt) if not np.isnan(total_debt) else 0.0) - (float(cash) if not np.isnan(cash) else 0.0)
    else:
        out["enterprise_value_yahoo_or_calc"] = enterprise_value

    return out


def _rsi(close: pd.Series, period: int = 14) -> float:
    if close is None or len(close) < period + 2:
        return float("nan")
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    # Wilder's smoothing via EMA with alpha=1/period
    avg_gain = gain.ewm(alpha=1/period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, adjust=False).mean()

    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return float(rsi.iloc[-1])


def _atr(df: pd.DataFrame, period: int = 14) -> float:
    if df is None or df.empty or len(df) < period + 2:
        return float("nan")
    high = df["High"].astype(float)
    low = df["Low"].astype(float)
    close = df["Close"].astype(float)

    prev_close = close.shift(1)
    tr = pd.concat([
        (high - low),
        (high - prev_close).abs(),
        (low - prev_close).abs()
    ], axis=1).max(axis=1)

    atr = tr.ewm(alpha=1/period, adjust=False).mean()
    return float(atr.iloc[-1])


def compute_technicals(hist: pd.DataFrame, benchmark_rets: Optional[pd.Series] = None) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "Return 1m": np.nan,
        "Return 3m": np.nan,
        "Return 6m": np.nan,
        "Return 12m": np.nan,
        "SMA20": np.nan,
        "SMA50": np.nan,
        "SMA200": np.nan,
        "% from SMA20": np.nan,
        "% from SMA50": np.nan,
        "% from SMA200": np.nan,
        "52W High": np.nan,
        "52W Low": np.nan,
        "% From 52W High": np.nan,
        "% From 52W Low": np.nan,
        "RSI14": np.nan,
        "ATR (14)": np.nan,
        "ATR% (14)": np.nan,
        "Vol (20d, ann)": np.nan,
        "Vol (60d, ann)": np.nan,
        "Max Drawdown (1y)": np.nan,
        "Avg Vol 20d": np.nan,
        "Avg $Vol 20d": np.nan,
        "Beta vs Benchmark (1y)": np.nan,
    }
    if hist is None or hist.empty or "Close" not in hist.columns:
        return out

    df = hist.dropna(subset=["Close"]).copy()
    close = df["Close"].astype(float)

    # Returns
    def _ret(n: int) -> float:
        if len(close) <= n:
            return float("nan")
        return float(close.iloc[-1] / close.iloc[-(n+1)] - 1.0)

    out["Return 1m"] = _ret(21)
    out["Return 3m"] = _ret(63)
    out["Return 6m"] = _ret(126)
    out["Return 12m"] = _ret(252)

    # Moving averages
    sma20 = close.rolling(20).mean()
    sma50 = close.rolling(50).mean()
    sma200 = close.rolling(200).mean()
    out["SMA20"] = float(sma20.iloc[-1]) if len(sma20.dropna()) else float("nan")
    out["SMA50"] = float(sma50.iloc[-1]) if len(sma50.dropna()) else float("nan")
    out["SMA200"] = float(sma200.iloc[-1]) if len(sma200.dropna()) else float("nan")

    px = float(close.iloc[-1])
    out["% from SMA20"] = float(px / out["SMA20"] - 1.0) if np.isfinite(out["SMA20"]) and out["SMA20"] > 0 else np.nan
    out["% from SMA50"] = float(px / out["SMA50"] - 1.0) if np.isfinite(out["SMA50"]) and out["SMA50"] > 0 else np.nan
    out["% from SMA200"] = float(px / out["SMA200"] - 1.0) if np.isfinite(out["SMA200"]) and out["SMA200"] > 0 else np.nan

    # 52-week high/low (use High/Low if available else Close)
    if "High" in df.columns and "Low" in df.columns:
        out["52W High"] = float(df["High"].astype(float).max())
        out["52W Low"] = float(df["Low"].astype(float).min())
    else:
        out["52W High"] = float(close.max())
        out["52W Low"] = float(close.min())

    out["% From 52W High"] = float(px / out["52W High"] - 1.0) if np.isfinite(out["52W High"]) and out["52W High"] > 0 else np.nan
    out["% From 52W Low"] = float(px / out["52W Low"] - 1.0) if np.isfinite(out["52W Low"]) and out["52W Low"] > 0 else np.nan

    # RSI, ATR
    out["RSI14"] = _rsi(close, 14)
    atr14 = _atr(df, 14)
    out["ATR (14)"] = atr14
    out["ATR% (14)"] = float(atr14 / px) if np.isfinite(atr14) and px > 0 else np.nan

    # Volatility
    rets = close.pct_change().dropna()
    if len(rets) >= 20:
        out["Vol (20d, ann)"] = float(rets.tail(20).std(ddof=0) * math.sqrt(252))
    if len(rets) >= 60:
        out["Vol (60d, ann)"] = float(rets.tail(60).std(ddof=0) * math.sqrt(252))

    # Max drawdown
    if len(close) >= 2:
        cum = (1 + rets).fillna(0).add(1).cumprod()
        peak = cum.cummax()
        dd = (cum / peak) - 1.0
        out["Max Drawdown (1y)"] = float(dd.min())

    # Liquidity
    if "Volume" in df.columns:
        vol = df["Volume"].astype(float).dropna()
        if len(vol) >= 20:
            out["Avg Vol 20d"] = float(vol.tail(20).mean())
            out["Avg $Vol 20d"] = float(out["Avg Vol 20d"] * close.tail(20).mean())

    # Beta vs benchmark
    if benchmark_rets is not None and len(rets) > 30:
        joined = pd.concat([rets.rename("stock"), benchmark_rets.rename("bench")], axis=1).dropna()
        if len(joined) > 30 and joined["bench"].var(ddof=0) > 0:
            cov = joined.cov(ddof=0).loc["stock", "bench"]
            out["Beta vs Benchmark (1y)"] = float(cov / joined["bench"].var(ddof=0))

    return out


def format_sheet(ws) -> None:
    ws.freeze_panes = "B2"
    ws.auto_filter.ref = ws.dimensions
    for cell in ws[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for col_idx in range(1, ws.max_column + 1):
        header = ws.cell(row=1, column=col_idx).value
        width = min(28, max(10, len(str(header)) + 2))
        ws.column_dimensions[get_column_letter(col_idx)].width = width


@dataclass
class UniverseRow:
    ticker: str
    name: str = ""
    sector: str = ""
    industry: str = ""


def load_universe(universe_csv: Path) -> List[UniverseRow]:
    df = pd.read_csv(universe_csv)
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
        ))
    return rows


def maybe_load_materials_energy(roster_csv: Path) -> Optional[pd.DataFrame]:
    if not roster_csv.exists():
        return None
    try:
        df = pd.read_csv(roster_csv)
        if "ticker" not in df.columns:
            return None
        df["ticker"] = df["ticker"].astype(str).map(normalize_ticker)
        keep = [c for c in ["ticker", "products", "stage"] if c in df.columns]
        return df[keep].drop_duplicates("ticker")
    except Exception:
        return None


def fetch_history(symbol: str, period: str, interval: str) -> pd.DataFrame:
    t = yf.Ticker(symbol)
    try:
        h = t.history(period=period, interval=interval, auto_adjust=True)
        return h if isinstance(h, pd.DataFrame) else pd.DataFrame()
    except Exception:
        return pd.DataFrame()


def data_quality_score(r: Dict[str, Any]) -> float:
    keys = [
        "Price", "Market Cap", "Shares Out", "FCF (Yahoo)",
        "Revenue Growth (Yahoo)", "Beta", "Book Value / Share (Yahoo)",
        "Total Debt", "Cash", "ROE", "DCF Price (5yr)",
        "Vol (20d, ann)", "Avg $Vol 20d",
    ]
    ok = 0
    for k in keys:
        v = r.get(k, np.nan)
        if v is None:
            continue
        if isinstance(v, (int, float)) and np.isnan(v):
            continue
        ok += 1
    return float(ok / len(keys))


def fetch_one(ticker_code: str, company: UniverseRow, benchmark_rets: Optional[pd.Series], history_period: str, history_interval: str, disable_technicals: bool) -> Optional[Dict[str, Any]]:
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

    base: Dict[str, Any] = {
        "ticker": ticker_code,
        "company_name": company.name or safe_get(info, "shortName", ""),
        "sector": company.sector,
        "industry": company.industry,
        "currency": safe_get(info, "currency", "AUD"),
        "asof": datetime.now().strftime("%Y-%m-%d"),
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
        "cash": bs["cash"],
        "total_assets": bs["total_assets"],
        "total_liabilities": bs["total_liabilities"],
        "net_tangible_assets": bs["net_tangible_assets"],
    }

    base.update(calc_valuations(base))
    extras = compute_extra_metrics(info, bs, float(base["sharesOutstanding"]) if not np.isnan(base["sharesOutstanding"]) else np.nan)
    base.update(extras)

    # Technicals (1y daily)
    tech: Dict[str, Any] = {}
    if not disable_technicals:
        hist = fetch_history(sym, history_period, history_interval)
        tech = compute_technicals(hist, benchmark_rets=benchmark_rets)
    else:
        tech = compute_technicals(pd.DataFrame(), benchmark_rets=None)

    # Output row (stable user-facing columns)
    out_row: Dict[str, Any] = {
        "Ticker": base["ticker"],
        "Company": base["company_name"],
        "Sector": base["sector"],
        "Industry": base["industry"],
        "Currency": base["currency"],
        "As Of": base["asof"],

        "Price": base["currentPrice"],
        "Market Cap": base["marketCap"],
        "Shares Out": base["sharesOutstanding"],

        "Cash": base["cash"],
        "Total Debt": base["totalDebt"],
        "Net Debt (Debt - Cash)": base.get("net_debt", np.nan),
        "Total Assets": base["total_assets"],
        "Total Liabilities": base["total_liabilities"],
        "NTA": base["net_tangible_assets"],
        "NTA / Share": base.get("nta_per_share", np.nan),

        "Book Value (Total, Yahoo)": base.get("book_value_total_yahoo", np.nan),
        "Book Value / Share (Yahoo)": base.get("book_value_per_share_yahoo", np.nan),
        "Book Value (Total, Assets-Liab)": base.get("book_value_total_bs_equity", np.nan),
        "Book Value / Share (Assets-Liab)": base.get("book_value_per_share_bs_equity", np.nan),

        "DCF Price (5yr)": base.get("dcf_price", np.nan),
        "Residual Income Price": base.get("residual_income_price", np.nan),
        "Asset Based Price": base.get("asset_based_price", np.nan),
        "SOTP Price": base.get("sotp_price", np.nan),
        "Dividend Discount Price": base.get("ddm_price", np.nan),
        "Earnings Power Value (EPV) Price": base.get("epv_price", np.nan),
        "Option Pricing Value": base.get("option_value", np.nan),

        "DCF Estimate": base.get("dcf_estimate", ""),

        "DCF Premium/(Discount)": base.get("dcf_prem", np.nan),
        "Residual Income Premium/(Discount)": base.get("ri_prem", np.nan),
        "Asset Based Premium/(Discount)": base.get("asset_prem", np.nan),
        "SOTP Premium/(Discount)": base.get("sotp_prem", np.nan),
        "Dividend Discount Premium/(Discount)": base.get("ddm_prem", np.nan),
        "EPV Premium/(Discount)": base.get("epv_prem", np.nan),
        "Option Pricing Premium/(Discount)": base.get("opt_prem", np.nan),

        "Undervalued Methods Count": base.get("undervalued_methods_count", np.nan),
        "Margin of Safety": base.get("margin_of_safety", np.nan),
        "MOS Buy Price": base.get("mos_buy_price", np.nan),

        "FCF (Yahoo)": base.get("freeCashflow", np.nan),
        "Revenue Growth (Yahoo)": base.get("revenueGrowth", np.nan),
        "Growth Input Used": base.get("growth_input_used", np.nan),
        "Beta": base.get("beta", np.nan),
        "Risk Free Rate": ASSUMPTIONS["risk_free_rate"],
        "Market Risk Premium": ASSUMPTIONS["market_risk_premium"],
        "Cost of Equity": base.get("cost_of_equity", np.nan),
        "WACC": base.get("wacc", np.nan),
        "Terminal Growth Rate": ASSUMPTIONS["terminal_growth_rate"],
        "Valuation Period (yrs)": ASSUMPTIONS["valuation_period"],
        "Tax Rate": ASSUMPTIONS["tax_rate"],

        "FCF Yield": base.get("fcf_yield", np.nan),
        "Trailing PE": base.get("trailing_pe", np.nan),
        "Forward PE": base.get("forward_pe", np.nan),
        "P/B": base.get("price_to_book", np.nan),
        "EV/EBITDA": base.get("ev_to_ebitda", np.nan),
        "Net Debt/EBITDA": base.get("net_debt_to_ebitda", np.nan),

        "ROA": base.get("roa", np.nan),
        "ROE": base.get("roe", np.nan),
        "Gross Margin": base.get("gross_margin", np.nan),
        "Operating Margin": base.get("operating_margin", np.nan),
        "Profit Margin": base.get("profit_margin", np.nan),

        "Debt/Equity": base.get("debt_to_equity", np.nan),
        "Current Ratio": base.get("current_ratio", np.nan),
        "Quick Ratio": base.get("quick_ratio", np.nan),

        "Held % Insiders": base.get("held_pct_insiders", np.nan),
        "Held % Institutions": base.get("held_pct_institutions", np.nan),
        "Short % Float": base.get("short_pct_float", np.nan),

        "Reverse DCF Implied Growth": base.get("reverse_dcf_implied_growth", np.nan),
        "PEG Ratio": base.get("peg_ratio", np.nan),

        "Enterprise Value (Yahoo/Calc)": base.get("enterprise_value_yahoo_or_calc", np.nan),
    }

    # Add technical columns with the exact names the screener expects
    out_row.update(tech)

    # Add a simple completeness score for quick filtering
    out_row["Data Quality Score"] = data_quality_score(out_row)

    return out_row


def main() -> None:
    ap = argparse.ArgumentParser(description="Compute intrinsic values + technicals for all ASX tickers and export to Excel/CSV/JSON.")
    ap.add_argument("--scraper", default="scrape_asx_universe.py", help="Path to scrape_asx_universe.py")
    ap.add_argument("--universe_csv", default="data/universe/asx_universe.csv", help="Universe CSV output (cached)")
    ap.add_argument("--tickers_txt", default="", help="Optional tickers TXT output (cached)")
    ap.add_argument("--universe_max_age_days", type=int, default=30, help="Refresh universe only if older than this many days")
    ap.add_argument("--universe_source", default="auto", choices=["auto", "asx_csv", "marketindex"], help="Universe source")
    ap.add_argument("--universe_sleep", type=float, default=0.5, help="Sleep for fallback crawling (universe script)")
    ap.add_argument("--materials_energy_csv", default="data/roster/asx_materials_energy_companies.csv", help="Optional join (products/stage) if exists")
    ap.add_argument("--output_xlsx", default="", help="Output Excel path (default: data/valuations/...)")
    ap.add_argument("--public_dir", default="public/data", help="Write latest.* outputs into this directory for Cloudflare Pages")
    ap.add_argument("--sleep", type=float, default=0.25, help="Sleep seconds between Yahoo calls")
    ap.add_argument("--limit", type=int, default=0, help="Limit tickers for testing (0 = no limit)")
    ap.add_argument("--resume", action="store_true", help="Resume from a progress CSV if present")
    ap.add_argument("--progress_csv", default="data/valuations/_progress_intrinsic.csv", help="Progress CSV for --resume")
    ap.add_argument("--benchmark", default="^AXJO", help="Benchmark ticker for beta calc (default ^AXJO)")
    ap.add_argument("--history_period", default="1y", help="yfinance history period (default 1y)")
    ap.add_argument("--history_interval", default="1d", help="yfinance history interval (default 1d)")
    ap.add_argument("--disable_technicals", action="store_true", help="Disable technical calculations (faster)")
    args = ap.parse_args()

    scraper_path = Path(args.scraper).resolve()
    universe_csv = Path(args.universe_csv).resolve()
    tickers_txt = Path(args.tickers_txt).resolve() if args.tickers_txt else None

    maybe_refresh_universe(
        scraper_path=scraper_path,
        universe_csv=universe_csv,
        tickers_txt=tickers_txt,
        max_age_days=args.universe_max_age_days,
        source=args.universe_source,
        sleep_s=args.universe_sleep,
    )

    universe = load_universe(universe_csv)
    if args.limit and args.limit > 0:
        universe = universe[: args.limit]
    print(f"[info] tickers to process: {len(universe)}")

    me_df = maybe_load_materials_energy(Path(args.materials_energy_csv).resolve())

    # Benchmark returns (daily)
    benchmark_rets = None
    if not args.disable_technicals:
        try:
            b_hist = fetch_history(args.benchmark, args.history_period, args.history_interval)
            if not b_hist.empty and "Close" in b_hist.columns:
                benchmark_rets = b_hist["Close"].astype(float).pct_change().dropna()
        except Exception:
            benchmark_rets = None

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

    t0 = time.time()
    for i, u in enumerate(universe, start=1):
        if u.ticker in processed:
            continue

        print(f"[{i}/{len(universe)}] {u.ticker}")
        try:
            r = fetch_one(
                u.ticker, u,
                benchmark_rets=benchmark_rets,
                history_period=args.history_period,
                history_interval=args.history_interval,
                disable_technicals=args.disable_technicals
            )
            if r is not None:
                rows_out.append(r)
                processed.add(u.ticker)
        except Exception as e:
            print(f"[warn] {u.ticker} failed: {e}")

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

    # Optional join: materials/energy products/stage
    if me_df is not None:
        df["_ticker_norm"] = df["Ticker"].astype(str).map(normalize_ticker)
        me_df2 = me_df.copy()
        me_df2["_ticker_norm"] = me_df2["ticker"].astype(str).map(normalize_ticker)
        df = df.merge(me_df2[["_ticker_norm"] + [c for c in ["products", "stage"] if c in me_df2.columns]],
                      on="_ticker_norm", how="left")
        if "products" in df.columns:
            df.rename(columns={"products": "Products (Materials/Energy)", "stage": "Stage (Materials/Energy)"}, inplace=True)
        df.drop(columns=["_ticker_norm"], inplace=True)

    
    # ----------------------------------------------------------------------------------
    # Screener scoring (0-100): Value + Quality + Risk (+ liquidity)
    # ----------------------------------------------------------------------------------
    def _pct_rank(s: pd.Series, ascending: bool = True) -> pd.Series:
        s2 = pd.to_numeric(s, errors="coerce")
        return s2.rank(pct=True, ascending=ascending)

    # Value: DCF discount, FCF yield, MOS upside, low P/B
    df["_v_dcf"] = _pct_rank(df.get("DCF Premium/(Discount)", pd.Series(dtype=float)), ascending=True)
    df["_v_fcf"] = _pct_rank(df.get("FCF Yield", pd.Series(dtype=float)), ascending=True)
    mos_up = np.where(
        (pd.to_numeric(df.get("Price", np.nan), errors="coerce") > 0) & pd.notnull(df.get("MOS Buy Price")),
        (pd.to_numeric(df.get("MOS Buy Price"), errors="coerce") - pd.to_numeric(df.get("Price"), errors="coerce")) / pd.to_numeric(df.get("Price"), errors="coerce"),
        np.nan
    )
    df["_v_mos"] = pd.Series(mos_up).rank(pct=True, ascending=True)
    df["_v_pb"]  = 1.0 - _pct_rank(df.get("P/B", pd.Series(dtype=float)), ascending=True)  # lower is better

    value_score = (0.40*df["_v_dcf"] + 0.30*df["_v_fcf"] + 0.20*df["_v_mos"] + 0.10*df["_v_pb"]) * 100.0

    # Quality: ROE, profit margin, low leverage
    df["_q_roe"] = _pct_rank(df.get("ROE", pd.Series(dtype=float)), ascending=True)
    df["_q_pm"]  = _pct_rank(df.get("Profit Margin", pd.Series(dtype=float)), ascending=True)
    df["_q_nd"]  = 1.0 - _pct_rank(df.get("Net Debt/EBITDA", pd.Series(dtype=float)), ascending=True)  # lower is better
    quality_score = (0.55*df["_q_roe"] + 0.30*df["_q_pm"] + 0.15*df["_q_nd"]) * 100.0

    # Risk: lower vol, lower ATR%, smaller drawdowns
    df["_r_vol"] = 1.0 - _pct_rank(df.get("Vol (20d, ann)", pd.Series(dtype=float)), ascending=True)
    df["_r_atr"] = 1.0 - _pct_rank(df.get("ATR% (14)", pd.Series(dtype=float)), ascending=True)
    # Max Drawdown is negative; "less negative" is better.
    df["_r_mdd"] = _pct_rank(df.get("Max Drawdown (1y)", pd.Series(dtype=float)), ascending=True)
    risk_score = (0.45*df["_r_vol"] + 0.25*df["_r_atr"] + 0.30*df["_r_mdd"]) * 100.0

    # Liquidity bonus (avg $ volume)
    df["_liq"] = _pct_rank(df.get("Avg $Vol 20d", pd.Series(dtype=float)), ascending=True)
    liquidity_bonus = df["_liq"] * 10.0  # +0 to +10

    df["Value Score"] = value_score.round(2)
    df["Quality Score"] = quality_score.round(2)
    df["Risk Score"] = risk_score.round(2)
    df["Screener Score"] = (0.45*value_score + 0.30*quality_score + 0.25*risk_score + liquidity_bonus).clip(0,100).round(2)


    # Output path (full workbook)
    if args.output_xlsx:
        out_xlsx = Path(args.output_xlsx).resolve()
    else:
        out_xlsx = Path("data/valuations").resolve() / f"ASX_Intrinsic_Valuations_{now_stamp()}.xlsx"
    ensure_parent_dir(out_xlsx)

    # Write full workbook (Valuations only for speed; you can add extra sheets later)
    with pd.ExcelWriter(out_xlsx, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Valuations", index=False)
        ws = writer.book["Valuations"]
        format_sheet(ws)

    if args.resume:
        ensure_parent_dir(progress_csv)
        df.to_csv(progress_csv, index=False)

    print(f"[ok] wrote: {out_xlsx}")

    # Export web artifacts
    public_dir = Path(args.public_dir).resolve()
    public_dir.mkdir(parents=True, exist_ok=True)

    # Publish a "full" Excel download for humans (kept separate from the screener JSON)
    # Cloudflare Pages has per-file size limits; if the workbook is large we publish a zipped copy instead.
    FULL_XLSX_MAX_BYTES = 24 * 1024 * 1024  # keep a little buffer under 25 MiB
    full_xlsx_name = None
    full_xlsx_zip_name = None
    try:
        size_bytes = out_xlsx.stat().st_size
        if size_bytes <= FULL_XLSX_MAX_BYTES:
            full_target = public_dir / "latest_full.xlsx"
            shutil.copy2(out_xlsx, full_target)
            full_xlsx_name = "latest_full.xlsx"
        else:
            zip_target = public_dir / "latest_full.xlsx.zip"
            with zipfile.ZipFile(zip_target, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.write(out_xlsx, arcname="latest_full.xlsx")
            full_xlsx_zip_name = "latest_full.xlsx.zip"
    except Exception:
        pass

    # Web-friendly subset (keeps latest.xlsx smaller for Cloudflare Pages)
    WEB_COLS = [
        "Ticker","Company","Sector","Industry",
        "Price","Market Cap",
        "DCF Price (5yr)","DCF Premium/(Discount)","FCF Yield","Undervalued Methods Count",
        "RSI14","ATR% (14)","Vol (20d, ann)","Max Drawdown (1y)",
        "Return 1m","Return 3m","Return 12m",
        "% From 52W High","% From 52W Low",
        "Avg $Vol 20d","Avg Vol 20d",
        "Beta vs Benchmark (1y)",
        "ROE","P/B","Net Debt/EBITDA",
        "MOS Buy Price","Margin of Safety",
        "Data Quality Score",
        "As Of",,
        "Screener Score",
        "Value Score",
        "Quality Score",
        "Risk Score",
        "Book Value (Total, Assets-Liab)",
        "Book Value / Share (Assets-Liab)",
        "Book Value / Share (Yahoo)",
        "Profit Margin"
    ]
    web_df = df[[c for c in WEB_COLS if c in df.columns]].copy()

    # Web JSON (smaller, used by screener UI)
    web_df.to_json(public_dir / "latest_web.json", orient="records")

    latest_xlsx = public_dir / "latest.xlsx"
    with pd.ExcelWriter(latest_xlsx, engine="openpyxl") as writer2:
        web_df.to_excel(writer2, sheet_name="Valuations", index=False)
        ws2 = writer2.book["Valuations"]
        format_sheet(ws2)

    # CSV + JSON (full dataset; UI uses JSON)
    df.to_csv(public_dir / "latest.csv", index=False)
    df.to_json(public_dir / "latest.json", orient="records")

    # Parquet (optional)
    parquet_path = public_dir / "latest.parquet"
    parquet_ok = False
    try:
        df.to_parquet(parquet_path, index=False)
        parquet_ok = True
    except Exception:
        if parquet_path.exists():
            try:
                parquet_path.unlink()
            except Exception:
                pass

    perth = ZoneInfo("Australia/Perth")
    generated_utc = datetime.now(ZoneInfo("UTC")).isoformat(timespec="seconds")
    generated_perth = datetime.now(perth).isoformat(timespec="seconds")

    manifest = {
        "generated_at_utc": generated_utc,
        "generated_at_perth": generated_perth,
        "generated_at_local": datetime.now().isoformat(timespec="seconds"),
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "benchmark": args.benchmark,
        "history_period": args.history_period,
        "history_interval": args.history_interval,
        "files": {
            "xlsx": "latest.xlsx",
            "csv": "latest.csv",
            "json": "latest.json",
            "parquet": ("latest.parquet" if parquet_ok else None),
        },
    }
    (public_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"[ok] wrote web exports to: {public_dir}")


if __name__ == "__main__":
    main()
