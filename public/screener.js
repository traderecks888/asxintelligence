
function pctMaybeSmart(x){
  const n = Number(x);
  if(!Number.isFinite(n)) return "–";
  let v = n;
  if(Math.abs(v) > 1.5 && Math.abs(v) <= 200){
    v = v / 100;
  }
  return (v*100).toFixed(1) + "%";
}

window.__ASX_UI_READY = window.__ASX_UI_READY || false;
function median(arr){
  const a = arr.filter(x => Number.isFinite(x)).sort((x,y)=>x-y);
  if(!a.length) return NaN;
  const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2;
}

function quantile(arr, q){
  const a = (arr || []).filter(Number.isFinite).slice().sort((x,y)=>x-y);
  if(!a.length) return NaN;
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if(a[base+1] !== undefined){
    return a[base] + rest * (a[base+1] - a[base]);
  }
  return a[base];
}
function pct(x){ return Number.isFinite(x) ? (x*100).toFixed(1) + "%" : "–"; }


function normPct(x){
  // Accept either 0.12 (12%) or 12 (12%). Returns decimal.
  let v = num(x);
  if(!Number.isFinite(v)) return NaN;
  if(Math.abs(v) > 1.5) v = v / 100;
  return v;
}

function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }
function fmt2(x){ return Number.isFinite(x) ? x.toFixed(2) : "–"; }
function fmt4(x){ return Number.isFinite(x) ? x.toFixed(4) : "–"; }
function fmtInt(x){ return Number.isFinite(x) ? Math.round(x).toLocaleString() : "–"; }

function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }

function barRow(label, value, max){
  const v = Number.isFinite(value) ? value : NaN;
  const pctw = Number.isFinite(v) ? (clamp(v / max, 0, 1) * 100) : 0;
  const valText = Number.isFinite(v) ? (max === 10 ? v.toFixed(2) + " / 10" : v.toFixed(2) + " / 100") : "–";
  return `
    <div style="margin:8px 0;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;">
        <strong>${label}</strong>
        <small>${valText}</small>
      </div>
      <div class="bar"><div class="fill" style="width:${pctw}%;"></div></div>
    </div>`;
}

function updateDualFill(minEl, maxEl, fillEl){
  if(!minEl || !maxEl || !fillEl) return;
  const mn = num(minEl.value);
  const mx = num(maxEl.value);
  const lo = Number(minEl.min);
  const hi = Number(minEl.max);
  const span = (hi - lo) || 1;

  const leftPct = clamp((mn - lo) / span, 0, 1) * 100;
  const rightPct = clamp((mx - lo) / span, 0, 1) * 100;
  const l = Math.min(leftPct, rightPct);
  const r = Math.max(leftPct, rightPct);

  const wrap = fillEl.parentElement;
  const w = wrap ? wrap.getBoundingClientRect().width : 0;
  const thumb = 18;
  const usable = Math.max(0, w - thumb);
  const lpx = (l/100) * usable + (thumb/2);
  const rpx = (r/100) * usable + (thumb/2);

  fillEl.style.left = lpx + "px";
  fillEl.style.width = Math.max(0, rpx - lpx) + "px";
}

function esc(s){
  // Minimal HTML escaping to keep the details drawer safe.
  const str = (s === null || s === undefined) ? "" : String(s);
  return str.replace(/[&<>"']/g, (ch)=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[ch]));
}


// Valuation cell coloring (subtle, readable)
const VAL_BG_UP   = "rgba(34, 197, 94, 0.16)";   // soft green
const VAL_BG_DOWN = "rgba(239, 68, 68, 0.14)";   // soft red

function clearValBg(cell){
  const el = cell && cell.getElement ? cell.getElement() : null;
  if(!el) return;
  el.style.backgroundColor = "";
}

function setValBg(cell, upDown){ // upDown: true = green, false = red, null = clear
  const el = cell && cell.getElement ? cell.getElement() : null;
  if(!el) return;
  if(upDown === true) el.style.backgroundColor = VAL_BG_UP;
  else if(upDown === false) el.style.backgroundColor = VAL_BG_DOWN;
  else el.style.backgroundColor = "";
}

function fmtValPrice(cell){
  const v = num(cell.getValue());
  const row = cell.getRow ? cell.getRow() : null;
  const data = row && row.getData ? row.getData() : null;
  const px = data ? num(data["Price"]) : NaN;

  if(Number.isFinite(v) && Number.isFinite(px) && px > 0){
    setValBg(cell, v > px ? true : (v < px ? false : null));
  }else{
    clearValBg(cell);
  }
  return fmt2(v);
}

function fmtValDisc(cell){
  const v = num(cell.getValue()); // e.g. 0.12 == +12%
  if(Number.isFinite(v)){
    setValBg(cell, v > 0 ? true : (v < 0 ? false : null));
  }else{
    clearValBg(cell);
  }
  return pct(v);
}


function pctSmart(x){
  // Handles both fraction (0.08) and percent (8.0) inputs safely.
  const n = Number(x);
  if(!Number.isFinite(n)) return "";
  let v = n;
  // If value looks like a percent (e.g., 8.0 for 8%), convert to fraction.
  if(Math.abs(v) > 1.5 && Math.abs(v) <= 200){
    v = v / 100;
  }
  return (v*100).toFixed(1) + "%";
}


function rating5FromScore(x){
  const v = num(x);
  if(!Number.isFinite(v)) return null;
  if(v >= 80) return {k:"vs", label:"Very Strong"};
  if(v >= 60) return {k:"s",  label:"Strong"};
  if(v >= 40) return {k:"a",  label:"Average"};
  if(v >= 20) return {k:"w",  label:"Weak"};
  return {k:"vw", label:"Very Weak"};
}


function strengthRank(r){
  // Order: blank, very weak, weak, average, strong, very strong.
  if(!r) return 0;
  if(r.k==="vw") return 1;
  if(r.k==="w")  return 2;
  if(r.k==="a")  return 3;
  if(r.k==="s")  return 4;
  if(r.k==="vs") return 5;
  return 0;
}

// Custom sorter so FA/TA strengths sort logically.
// Supports both sort directions via the "dir" argument.
function strengthSorter(_a, _b, aRow, bRow, column){
  const field = column && column.getField ? column.getField() : "";
  const ad = aRow && aRow.getData ? aRow.getData() : null;
  const bd = bRow && bRow.getData ? bRow.getData() : null;

  const ar = field==="__TA_Strength" ? taStrength(ad||{}) : faStrength(ad||{});
  const br = field==="__TA_Strength" ? taStrength(bd||{}) : faStrength(bd||{});

  return strengthRank(ar) - strengthRank(br);
}

function faStrength(data){
  const base = faBaseScore(data);
  return rating5FromScore(base);
}



function liquidityBonus(data){
  // Liquidity bonus is a small additive bonus (0..10) based on trading dollar volume.
  // Prefer dataset-provided value; otherwise derive percentile rank from Avg $Vol 20d.
  let liq = num(data["Liquidity Bonus"]);
  if(Number.isFinite(liq)) return clamp(liq, 0, 10);

  const dv = num(data["Avg $Vol 20d"]);
  if(!Number.isFinite(dv)) return NaN;

  // Use current filtered universe if available, otherwise raw.
  const src = (typeof filteredNow !== "undefined" && filteredNow && filteredNow.length) ? filteredNow : (typeof raw !== "undefined" ? raw : []);
  const dvs = (src || [])
    .map(x => num(x["Avg $Vol 20d"]))
    .filter(Number.isFinite)
    .sort((a,b)=>a-b);

  if(!dvs.length) return NaN;

  // percentile rank 0..1
  let lo = 0, hi = dvs.length-1;
  while(lo < hi){
    const mid = (lo+hi)>>1;
    if(dvs[mid] < dv) lo = mid+1; else hi = mid;
  }
  const pr = (dvs.length <= 1) ? 0 : (lo / (dvs.length-1));
  liq = pr * 10.0;
  return clamp(liq, 0, 10);
}
function faBaseScore(data){
  const V = num(data["Value Score"]);
  const Q = num(data["Quality Score"]);
  const R = num(data["Risk Score"]);

  // Fundamental base score: 45% Value + 30% Quality + 25% Risk, plus a small liquidity bonus (0..10).
  if(Number.isFinite(V) && Number.isFinite(Q) && Number.isFinite(R)){
    const base = 0.45*V + 0.30*Q + 0.25*R;
    const liq = liquidityBonus(data);
    const total = Number.isFinite(liq) ? (base + liq) : base;
    return clamp(total, 0, 100);
  }

  // Fallback to dataset-provided screener score if components missing.
  const s = num(data["Screener Score"]);
  return Number.isFinite(s) ? clamp(s, 0, 100) : NaN;
}



function taCompositeParts(data){
  // Mirrors taCompositeScore(), but returns component scores for explanation.
  const rsi = num(data["RSI14"]);
  const atr = normPct(data["ATR% (14)"]);
  const mdd = num(data["Max Drawdown (1y)"]);
  const distD = normPct(data["% Dist SMA200D"]);
  const distW = normPct(data["% Dist SMA200W"]);
  const adx = num(data["ADX14"]);
  const macdH = num(data["MACD Hist (12,26,9)"]);
  const stochK = num(data["Stoch %K (14)"]);

  const rrD = num(data["R:R (D)"]);
  const rrW = num(data["R:R (W)"]);
  const rrM = num(data["R:R (M)"]);

  // Trend: above long-term MAs is good; deep below is bad.
  function distToScore(d){
    if(!Number.isFinite(d)) return NaN;
    if(d >= 0.25) return 95;
    if(d >= 0.12) return 85;
    if(d >= 0.05) return 72;
    if(d >= 0.00) return 60;
    if(d >= -0.05) return 45;
    if(d >= -0.12) return 30;
    return 18;
  }
  const td = distToScore(distD);
  const tw = distToScore(distW);
  const trendParts = [td, tw].filter(Number.isFinite);
  const trend = trendParts.length ? trendParts.reduce((a,b)=>a+b,0)/trendParts.length : NaN;

  // Momentum: RSI + MACD hist + Stoch K (lightweight)
  function rsiToScore(x){
    if(!Number.isFinite(x)) return NaN;
    if(x >= 70) return 85;
    if(x >= 60) return 75;
    if(x >= 50) return 62;
    if(x >= 40) return 48;
    if(x >= 30) return 35;
    return 22;
  }
  function macdToScore(h){
    if(!Number.isFinite(h)) return NaN;
    if(h >= 0.12) return 82;
    if(h >= 0.05) return 72;
    if(h >= 0.00) return 60;
    if(h >= -0.05) return 45;
    return 30;
  }
  function stochToScore(k){
    if(!Number.isFinite(k)) return NaN;
    if(k >= 80) return 78;
    if(k >= 60) return 68;
    if(k >= 40) return 58;
    if(k >= 20) return 45;
    return 35;
  }
  const momParts = [rsiToScore(rsi), macdToScore(macdH), stochToScore(stochK)].filter(Number.isFinite);
  const mom = momParts.length ? (0.55*momParts[0] + 0.25*(momParts[1]||55) + 0.20*(momParts[2]||55)) : NaN;

  // Trend strength (ADX)
  function adxToScore(a){
    if(!Number.isFinite(a)) return NaN;
    if(a >= 35) return 85;
    if(a >= 25) return 72;
    if(a >= 20) return 62;
    if(a >= 15) return 52;
    return 45;
  }
  const strength = adxToScore(adx);

  // Reward/Risk (use average of D/W/M if available)
  function rrToScore(rr){
    if(!Number.isFinite(rr)) return NaN;
    if(rr >= 4.0) return 95;
    if(rr >= 3.0) return 88;
    if(rr >= 2.0) return 78;
    if(rr >= 1.5) return 68;
    if(rr >= 1.0) return 58;
    if(rr >= 0.7) return 48;
    return 38;
  }
  const rrScores = [rrToScore(rrD), rrToScore(rrW), rrToScore(rrM)].filter(Number.isFinite);
  const rrScore = rrScores.length ? rrScores.reduce((a,b)=>a+b,0)/rrScores.length : NaN;

  // Penalty (volatility + drawdown)
  let penalty = 0;
  if(Number.isFinite(atr)){
    if(atr > 0.12) penalty += 14;
    else if(atr > 0.08) penalty += 8;
    else if(atr < 0.03) penalty -= 2;
  }
  if(Number.isFinite(mdd)){
    if(mdd < -0.60) penalty += 14;
    else if(mdd < -0.45) penalty += 8;
    else if(mdd > -0.25) penalty -= 3;
  }
  penalty = clamp(penalty, -5, 25);

  // Final composite mirrors taCompositeScore weights
  const base = (Number.isFinite(trend)?0.35*trend:0) +
               (Number.isFinite(mom)?0.25*mom:0) +
               (Number.isFinite(strength)?0.15*strength:0) +
               (Number.isFinite(rrScore)?0.15*rrScore:0) +
               0.10*55;
  const total = clamp(base - penalty, 0, 100);

  return {trend, mom, strength, rrScore, penalty, total};
}
function taCompositeScore(data){
  // Pro-grade TA composite using multiple indicators.
  // Returns 0..100, or NaN if we can't compute anything meaningful.
  const price = num(data["Price"]);

  const rsi = num(data["RSI14"]);
  const atr = normPct(data["ATR% (14)"]);        // ~0.05 == 5%
  const mdd = num(data["Max Drawdown (1y)"]);    // negative decimal
  const distD = normPct(data["% Dist SMA200D"]);
  const distW = normPct(data["% Dist SMA200W"]);
  const adx = num(data["ADX14"]);
  const macdH = num(data["MACD Hist (12,26,9)"]);
  const stochK = num(data["Stoch %K (14)"]);

  // Support/Resistance reward:risk ratios (already computed)
  const rrD = num(data["R:R (D)"]);
  const rrW = num(data["R:R (W)"]);
  const rrM = num(data["R:R (M)"]);

  // Determine whether we have enough signal
  const hasMomentum = Number.isFinite(rsi) || (Number.isFinite(macdH) && Number.isFinite(price) && price>0);
  const hasTrend = Number.isFinite(distD) || Number.isFinite(distW) || Number.isFinite(adx);
  const hasRR = Number.isFinite(rrD) || Number.isFinite(rrW) || Number.isFinite(rrM);
  if(!hasMomentum && !hasTrend && !hasRR) return NaN;

  // Trend alignment (price vs long MAs)
  let trend = 50;
  if(Number.isFinite(distD)) trend += 120*distD;   // +10% => +12
  if(Number.isFinite(distW)) trend += 80*distW;    // +10% => +8
  trend = clamp(trend, 0, 100);

  // Momentum (RSI + MACD histogram scaled to price + mild Stoch contribution)
  let mom = 50;
  if(Number.isFinite(rsi)) mom += (rsi - 50) * 1.2;
  if(Number.isFinite(macdH) && Number.isFinite(price) && price > 0){
    const histPct = macdH / price;  // ~0.01 == 1% of price
    if(Number.isFinite(histPct)) mom += 600 * histPct;
  }
  if(Number.isFinite(stochK)) mom += (stochK - 50) * 0.25;
  mom = clamp(mom, 0, 100);

  // Trend strength (ADX)
  let strength = NaN;
  if(Number.isFinite(adx)){
    strength = clamp(50 + (adx - 20)*2.0, 20, 90); // <20 weak, >25 trending
  }else{
    strength = 50;
  }

  // Reward/Risk (use best available timeframe, but don't let outliers dominate)
  function rrToScore(rr){
    if(!Number.isFinite(rr) || rr <= 0) return NaN;
    if(rr >= 3.0) return 88;
    if(rr >= 2.0) return 78;
    if(rr >= 1.5) return 68;
    if(rr >= 1.0) return 58;
    if(rr >= 0.7) return 48;
    return 38;
  }
  const rrScores = [rrToScore(rrD), rrToScore(rrW), rrToScore(rrM)].filter(Number.isFinite);
  const rrScore = rrScores.length ? rrScores.reduce((a,b)=>a+b,0)/rrScores.length : 55;

  // Stability / risk penalty
  let penalty = 0;
  if(Number.isFinite(atr)){
    if(atr > 0.12) penalty += 14;
    else if(atr > 0.08) penalty += 8;
    else if(atr < 0.03) penalty -= 2;
  }
  if(Number.isFinite(mdd)){
    if(mdd < -0.60) penalty += 14;
    else if(mdd < -0.45) penalty += 8;
    else if(mdd > -0.25) penalty -= 3;
  }
  penalty = clamp(penalty, -5, 25);

  // Composite (weights chosen to be robust across regimes)
  let score = 0.35*trend + 0.25*mom + 0.15*strength + 0.15*rrScore + 0.10*55;
  score = clamp(score - penalty, 0, 100);
  return score;
}

function taStrength(data){
  const s = taCompositeScore(data);
  return Number.isFinite(s) ? rating5FromScore(s) : null;
}

function totalScore(data){
  // Combined score: fundamentals drive most of the edge; technicals help timing + regime fit.
  const fa = faBaseScore(data);
  const ta = taCompositeScore(data);
  if(Number.isFinite(fa) && Number.isFinite(ta)){
    return clamp(0.65*fa + 0.35*ta, 0, 100);
  }
  return Number.isFinite(fa) ? clamp(fa, 0, 100) : (Number.isFinite(ta) ? clamp(ta, 0, 100) : NaN);
}


function pillHTML(r){
  if(!r) return '<span style="color:#888;">—</span>';

  // Subtle strength coloring (only these cells get background color)
  let bg = "";
  if(r.k==="vw") bg = "rgba(239, 68, 68, 0.18)";      // very weak (red)
  else if(r.k==="w") bg = "rgba(239, 68, 68, 0.10)";  // weak (lighter red)
  else if(r.k==="s") bg = "rgba(34, 197, 94, 0.12)";  // strong (green)
  else if(r.k==="vs") bg = "rgba(34, 197, 94, 0.18)"; // very strong (stronger green)
  // average stays uncolored/neutral

  const style = bg ? ` style="background:${bg};"` : "";
  return `<span class="pill ${r.k}"${style}><span class="pillDot"></span>${r.label}</span>`;
}

function pickBestWorst(parts){
  const finite = parts.filter(p => Number.isFinite(p.score));
  if(!finite.length) return {best:null, worst:null};
  const best = finite.reduce((a,b)=> (b.score>a.score)?b:a);
  const worst = finite.reduce((a,b)=> (b.score<a.score)?b:a);
  return {best, worst};
}
function openDrawer(){
  const drawer = document.getElementById("detailDrawer");
  if(drawer) drawer.classList.add("is-open");
}
function closeDrawer(){
  const drawer = document.getElementById("detailDrawer");
  if(drawer) drawer.classList.remove("is-open");
}
function wireDrawerClose(){
  const btn = document.getElementById("drawerClose");
  if(!btn) return;
  btn.addEventListener("click", ()=>{
    // mimic toggle-off on the active row
    if(window.__asxActiveRowEl){
      window.__asxActiveRowEl.classList.remove("asx-row-active");
    }
    window.__asxActiveKey = null;
    window.__asxActiveRowEl = null;
    const body = document.getElementById("scoreDetailsBody");
    const hint = document.getElementById("scoreDetailsHint");
    if(body) body.innerHTML = "";
    if(hint) hint.textContent = "Click a row in the table";
    closeDrawer();
  });
}



function renderScoreDetails(d){
  try{
  const el = document.getElementById("scoreDetailsBody");
  const hint = document.getElementById("scoreDetailsHint");
  if(!el) return;

  const ticker = esc(d["Ticker"] || d["Code"] || "");
  const company = esc(d["Company"] || d["Name"] || "");
  const sector = esc(d["Sector"] || "");

  const price = num(d["Price"]);
  const mcap = num(d["Market Cap"]);

  // Scores
  const fa = Number.isFinite(num(d["__FA_Score"])) ? num(d["__FA_Score"]) : faBaseScore(d);
  const ta = Number.isFinite(num(d["__TA_Score"])) ? num(d["__TA_Score"]) : taCompositeScore(d);
  const total = Number.isFinite(num(d["__Total_Score"])) ? num(d["__Total_Score"]) : totalScore(d);

  // Fundamental components (if available)
  const V = num(d["Value Score"]);
  const Q = num(d["Quality Score"]);
  const R = num(d["Risk Score"]);
  const liq = liquidityBonus(d);

  // TA parts for explanation
  const tp = taCompositeParts(d);

  // Legacy dataset score (optional)
  const legacy = num(d["Screener Score"]);

  // small context metrics
  const bvps = num(d["Book Value / Share (Assets-Liab)"]);
  const pb = num(d["P/B"]);
  const fcfy = num(d["FCF Yield"]);
  const dcfdisc = num(d["DCF Premium/(Discount)"]);

  // Tags: best/worst component (FA) + TA trend info
  const parts = [
    {k:"Value", v:V},
    {k:"Quality", v:Q},
    {k:"Risk", v:R},
    {k:"Liquidity", v:Number.isFinite(liq)?(liq*10):NaN} // scale to compare
  ].filter(x=>Number.isFinite(x.v));

  parts.sort((a,b)=>b.v-a.v);
  const bestTag = parts.length ? (`Best: ${parts[0].k}`) : "";
  const worstTag = parts.length ? (`Weakest: ${parts[parts.length-1].k}`) : "";

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
      <div>
        <div style="font-size:18px;font-weight:800;">${ticker} <small style="font-weight:500;color:#666;">${company}</small></div>
        <div><small>${sector}</small></div>
        <div class="badges">
          ${bestTag ? `<span class="badge">${bestTag}</span>` : ""}
          ${worstTag ? `<span class="badge">${worstTag}</span>` : ""}
          ${Number.isFinite(total) ? `<span class="badge">Total: ${total.toFixed(2)} / 100</span>` : `<span class="badge">Total: –</span>`}
          ${Number.isFinite(fa) ? `<span class="badge">FA: ${fa.toFixed(1)}</span>` : ""}
          ${Number.isFinite(ta) ? `<span class="badge">TA: ${ta.toFixed(1)}</span>` : ""}
        </div>
      </div>

      <div>
        <small>
          Price: ${Number.isFinite(price)?price.toFixed(2):"–"} •
          Mkt cap: ${Number.isFinite(mcap)?Math.round(mcap).toLocaleString():"–"}<br>
          BV/Share: ${Number.isFinite(bvps)?bvps.toFixed(2):"–"} •
          P/B: ${Number.isFinite(pb)?pb.toFixed(2):"–"} •
          FCFy: ${Number.isFinite(fcfy)?(fcfy*100).toFixed(1)+"%":"–"} •
          DCF disc: ${Number.isFinite(dcfdisc)?(dcfdisc*100).toFixed(1)+"%":"–"}
        </small>
      </div>
    </div>

    <div class="grid2">
      <div>
        ${barRow("Total score (65% FA + 35% TA)", total, 100)}
        ${barRow("Fundamental base (FA)", fa, 100)}
        ${barRow("Technical composite (TA)", ta, 100)}
      </div>
      <div>
        <div class="card">
          <strong>How the scoring works</strong>
          <div style="margin-top:6px;">
            <small>
              <b>Total Score</b> blends fundamentals (FA) and technicals (TA): <b>0.65×FA + 0.35×TA</b> (capped 0–100).
              <br>
              <b>FA</b> = 45% Value + 30% Quality + 25% Risk + Liquidity bonus (0..10). If the component scores are missing, the app falls back to the dataset’s “Screener Score”.
              <br>
              <b>TA</b> combines trend (distance to SMA200D/SMA200W), momentum (RSI/MACD/Stoch), trend strength (ADX), and multi-timeframe Reward:Risk, with penalties for high ATR% and deep 1y drawdown.
              <br>
              Note: “–” means missing/unavailable; it is not the same as 0.
            </small>
          </div>
          <div style="margin-top:10px;">
            <small>
              Legacy dataset score: ${Number.isFinite(legacy)?legacy.toFixed(2):"–"} •
              Current Total: ${Number.isFinite(total)?total.toFixed(2):"–"}
            </small>
          </div>
        </div>
      </div>
    </div>

    <div class="grid2" style="margin-top:12px;">
      <div class="card">
        <strong>Fundamentals breakdown</strong>
        <div style="margin-top:8px;">
          ${barRow("Value (45%)", V, 100)}
          ${barRow("Quality (30%)", Q, 100)}
          ${barRow("Risk (25%)", R, 100)}
          ${barRow("Liquidity bonus (+0..+10)", liq, 10)}
        </div>
      </div>
      <div class="card">
        <strong>Technicals breakdown</strong>
        <div style="margin-top:8px;">
          ${barRow("Trend (SMA200D/SMA200W)", tp.trend, 100)}
          ${barRow("Momentum (RSI/MACD/Stoch)", tp.mom, 100)}
          ${barRow("Trend strength (ADX)", tp.strength, 100)}
          ${barRow("Reward:Risk (D/W/M)", tp.rrScore, 100)}
          ${barRow("Penalty (ATR% + Drawdown)", (Number.isFinite(tp.penalty)?(tp.penalty/25*100):NaN), 100)}
        </div>
        <div style="margin-top:8px;">
          <small style="color:#666;">
            Penalty is shown as a % of max penalty (25). Higher penalty reduces TA score.
          </small>
        </div>
      </div>
    </div>
  `;

  if(hint) hint.textContent = "";
  openDrawer();
  }catch(e){
    console.error("renderScoreDetails failed", e);
    const el = document.getElementById("scoreDetailsBody");
    if(el){
      el.innerHTML = `<div class="card"><strong>Could not render details.</strong><div style="margin-top:6px;"><small>${esc(e && (e.message||String(e)) )}</small></div><div style="margin-top:6px;"><small>Tip: hard-refresh and re-run the pipeline if indicators are missing.</small></div></div>`;
    }
    openDrawer();
  }
}


let raw = [];
let filteredNow = [];
let table = null;
let scatterChart = null;
let histChart = null;
let vqChart = null;
let divChart = null;
let rrgChart = null;
let __rrgPayload = null;

function setMeta(msg){ const el = document.getElementById("meta"); if(el) el.textContent = msg; }
function showErr(msg){
  const el = document.getElementById("err");
  if(!el) return;
  el.style.display = "block";
  el.innerHTML = msg;
}
function hideErr(){ const el = document.getElementById("err"); if(el) el.style.display="none"; }

function formatWhen(s){
  if(!s) return "";
  try{
    const d = new Date(s);
    return new Intl.DateTimeFormat(undefined,{
      weekday:"short", year:"numeric", month:"short", day:"2-digit",
      hour:"2-digit", minute:"2-digit"
    }).format(d);
  }catch(e){
    return s;
  }
}

async function fetchJson(url){
  const r = await fetch(url, {cache:"no-store"});
  if(!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return await r.json();
}

function num(v){
  if (v === null || v === undefined || v === "") return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function setText(id, txt){
  const el = document.getElementById(id);
  if(el) el.textContent = txt;
}
function normFrac(v){
  const n = Number(v);
  if(!Number.isFinite(n)) return NaN;
  if(Math.abs(n) > 1.5 && Math.abs(n) <= 200) return n/100;
  return n;
}

function applyPreset(){
  const p = document.getElementById("preset").value;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };

  if(p === "deep_value"){
    set("minMcap", 50_000_000);
    set("minFcf", 0.05);
    set("minU", 2);
    set("minDV", 250_000);
    set("minROE", "");
    set("maxND", 3.5);
    set("maxVol", "");
    set("maxATR", "");
    set("minScore", 55);
  } else if(p === "quality"){
    set("minMcap", 100_000_000);
    set("minFcf", 0.02);
    set("minU", 0);
    set("minROE", 0.15);
    set("maxND", 2.0);
    set("minDV", 250_000);
    set("maxVol", 0.55);
    set("maxATR", 0.07);
    set("minScore", 60);
  } else if(p === "mean_reversion"){
    set("minMcap", 50_000_000);
    set("minFcf", "");
    set("minU", 0);
    set("minROE", "");
    set("maxND", "");
    set("minDV", 150_000);
    set("maxVol", "");
    set("maxATR", "");
    set("minScore", 45);
  }
}

function sliderLabel(id, val){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = pct(val);
}

function getChartWindow(){
  const xMin = num(document.getElementById("xMin").value);
  const xMax = num(document.getElementById("xMax").value);
  const yMin = num(document.getElementById("yMin").value);
  const yMax = num(document.getElementById("yMax").value);
  return {xMin, xMax, yMin, yMax};
}


function getDivWindow(fallback){
  const fx = fallback && Number.isFinite(fallback.xMax) ? fallback.xMax : 0.15;
  const fy = fallback && Number.isFinite(fallback.yMax) ? fallback.yMax : 2.0;
  const fminx = fallback && Number.isFinite(fallback.xMin) ? fallback.xMin : 0.0;
  const fminy = fallback && Number.isFinite(fallback.yMin) ? fallback.yMin : 0.0;

  const xMinEl = document.getElementById("divXMin");
  const xMaxEl = document.getElementById("divXMax");
  const yMinEl = document.getElementById("divYMin");
  const yMaxEl = document.getElementById("divYMax");

  const xMin = xMinEl ? num(xMinEl.value)/100 : fminx;
  const xMax = xMaxEl ? num(xMaxEl.value)/100 : fx;
  const yMin = yMinEl ? num(yMinEl.value)/100 : fminy;
  const yMax = yMaxEl ? num(yMaxEl.value)/100 : fy;

  return {xMin, xMax, yMin, yMax};
}

function wireDividendAxisControls(){
  const xMinEl = document.getElementById("divXMin");
  const xMaxEl = document.getElementById("divXMax");
  const yMinEl = document.getElementById("divYMin");
  const yMaxEl = document.getElementById("divYMax");
  const xFillEl = document.getElementById("divXFill");
  const yFillEl = document.getElementById("divYFill");
  const rEl = document.getElementById("divReset");

  if(!xMinEl || !xMaxEl || !yMinEl || !yMaxEl) return;

  const clampPair = (aEl, bEl)=>{
    const a = num(aEl.value), b = num(bEl.value);
    if(a > b){
      if(document.activeElement === aEl) bEl.value = aEl.value;
      else aEl.value = bEl.value;
    }
  };

  const setLabels = ()=>{
    const xmin = num(xMinEl.value), xmax = num(xMaxEl.value);
    const ymin = num(yMinEl.value), ymax = num(yMaxEl.value);
    setText("divXRangeV", `${Math.round(xmin)}%–${Math.round(xmax)}%`);
    setText("divYRangeV", `${Math.round(ymin)}%–${Math.round(ymax)}%`);
    updateDualFill(xMinEl, xMaxEl, xFillEl);
    updateDualFill(yMinEl, yMaxEl, yFillEl);
  };

  const apply = ()=>{
    clampPair(xMinEl, xMaxEl);
    clampPair(yMinEl, yMaxEl);
    setLabels();
    window.__divUserSet = true;

    const win = getDivWindow(window.__divDefaults || {xMin:0,xMax:0.15,yMin:0,yMax:2.0});
    if(divChart){
      divChart.options.scales.x.min = win.xMin;
      divChart.options.scales.x.max = win.xMax;
      divChart.options.scales.y.min = win.yMin;
      divChart.options.scales.y.max = win.yMax;
      divChart.update("none");
    }else{
      rebuildCharts(filteredNow || raw || []);
    }
  };

  const reset = ()=>{
    xMinEl.value = "0";
    xMaxEl.value = "15";
    yMinEl.value = "0";
    yMaxEl.value = "200";
    window.__divUserSet = false;
    setLabels();
    if(divChart){
      divChart.options.scales.x.min = 0;
      divChart.options.scales.x.max = 0.15;
      divChart.options.scales.y.min = 0;
      divChart.options.scales.y.max = 2.0;
      divChart.update("none");
    }
  };

  xMinEl.addEventListener("input", apply);
  xMaxEl.addEventListener("input", apply);
  yMinEl.addEventListener("input", apply);
  yMaxEl.addEventListener("input", apply);
  if(rEl) rEl.addEventListener("click", (e)=>{ e.preventDefault(); reset(); });

  setLabels();
  window.addEventListener("resize", ()=>setTimeout(setLabels, 0));
}



function wireColumnControls(){
  const key = document.getElementById("colShowIncome");
  const allDiv = document.getElementById("colShowAllDiv");
  const allHold = document.getElementById("colShowAllHold");
  const valDisc = document.getElementById("colShowValDisc");
  const valPriceT = document.getElementById("colShowValPrices");
  if(!table) return;

  // Column groups
  const keyIncome = [
    "Dividend Yield (Latest, Calc)",
    "Dividend Yield Δ% (Yahoo→Calc)",
    "Held % Insiders",
    "Held % Institutions",
  ];

  const allDividend = [
    "Dividend Rate (Yahoo)",
    "Dividend Yield (Yahoo)",
    "Dividend Yield (Latest, Calc)",
    "Dividend Yield Δ% (Yahoo→Calc)",
    "Payout Ratio (Yahoo)",
    "5Y Avg Dividend Yield (Yahoo)",
    "Ex-Dividend Date (Yahoo)",
    "Last Dividend Value (Yahoo)",
    "Last Dividend Date (Yahoo)",
  ];
  const allHoldings = [
    "Held % Insiders",
    "Held % Institutions",
  ];

  const valDiscounts = [
    "Residual Income Premium/(Discount)",
    "Asset Based Premium/(Discount)",
    "SOTP Premium/(Discount)",
    "Dividend Discount Premium/(Discount)",
    "EPV Premium/(Discount)",
    "Option Pricing Premium/(Discount)",
  ];

  const valPriceFields = [
    "DCF Price (5yr)",
    "Residual Income Price",
    "Asset Based Price",
    "SOTP Price",
    "Dividend Discount Price",
    "Earnings Power Value (EPV) Price",
    "Option Pricing Value",
    "MOS Buy Price",
    "Margin of Safety",
  ];


  const showFields = (fields, show) => {
    fields.forEach(f=>{
      const col = table.getColumn(f);
      if(!col) return;
      try{ show ? col.show() : col.hide(); }catch(e){}
    });
  };

  const refresh = ()=>{
    // Base: hide all dividend/holdings except key set (which is on by default)
    showFields(allDividend, false);
    showFields(allHoldings, false);
    showFields(valDiscounts, false);
    showFields(valPriceFields, false);

    // Key toggle
    if(key && key.checked){
      showFields(keyIncome, true);
    }

    // All toggles override
    if(allDiv && allDiv.checked){
      showFields(allDividend, true);
    }
    if(allHold && allHold.checked){
      showFields(allHoldings, true);
    }

    if(valDisc && valDisc.checked){
      showFields(valDiscounts, true);
    }
    if(valPriceT && valPriceT.checked){
      showFields(valPriceFields, true);
    }
  };
  window.__asxColRefresh = refresh;


  if(key) key.addEventListener("change", refresh);
  if(allDiv) allDiv.addEventListener("change", refresh);
  if(allHold) allHold.addEventListener("change", refresh);
  if(valDisc) valDisc.addEventListener("change", refresh);
  if(valPriceT) valPriceT.addEventListener("change", refresh);

  refresh();
}






function ensureTableViewStyles(){
  if(document.getElementById("asx-tableview-style")) return;
  const css = `
    /* Table view segmented control */
    .seg{display:inline-flex;align-items:center;border:1px solid rgba(0,0,0,.10);border-radius:12px;overflow:hidden;box-shadow:0 1px 0 rgba(0,0,0,.02);vertical-align:middle;}
    .seg button{appearance:none;border:0;background:#fff;padding:6px 10px;font-size:12px;line-height:18px;color:#444;cursor:pointer;white-space:nowrap;}
    .seg button:hover{background:rgba(0,0,0,.04);}
    .seg button.active{background:rgba(17, 94, 89, .10);color:#0f4f4a;font-weight:600;}
    .seg button + button{border-left:1px solid rgba(0,0,0,.08);}
    /* Responsive: show dropdown on narrow screens, segmented on wide screens */
    @media (max-width: 900px){ #tableViewSeg{display:none !important;} }
    @media (min-width: 901px){ #tableView{display:none !important;} }
  `;
  const st = document.createElement("style");
  st.id = "asx-tableview-style";
  st.textContent = css;
  document.head.appendChild(st);
}

function wireTableView(){
  const sel = document.getElementById("tableView");
  if(!sel || !table) return;

  ensureTableViewStyles();

  // Create segmented control next to the dropdown (desktop), keep the <select> for mobile/accessibility.
  let seg = document.getElementById("tableViewSeg");
  if(!seg){
    seg = document.createElement("div");
    seg.id = "tableViewSeg";
    seg.className = "seg";
    const label = sel.closest("label") || sel.parentElement;
    if(label) label.appendChild(seg);
  }

  const views = [
    ["basic", "Basic"],
    ["fundamentals", "Fundamentals"],
    ["technicals", "Technicals"],
    ["valuation_prices", "Valuation $"],
    ["valuation_discounts", "Valuation %"],
    ["dividends", "Dividends"],
    ["ownership", "Ownership"],
    ["all", "All"],
  ];

  // (Re)build buttons
  if(seg && !seg.dataset.built){
    seg.dataset.built = "1";
    for(const [val, txt] of views){
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = txt;
      b.dataset.view = val;
      b.addEventListener("click", ()=>{
        sel.value = val;
        sel.dispatchEvent(new Event("change"));
      });
      seg.appendChild(b);
    }
  }

  const coreFields = [
    "Ticker","Company","Sector",
    "__FA_Strength","__TA_Strength",
    "__Total_Score","Price","Market Cap",
    "Book Value / Share (Assets-Liab)",
    "R:R (D)","R:R (W)","R:R (M)"
  ];

  const fundamentals = coreFields.concat([
    "DCF Premium/(Discount)","FCF Yield","Undervalued Methods Count",
    "Value Score","Quality Score","Risk Score",
    "Book Value / Share (Assets-Liab)","Net Debt/EBITDA","Avg $Vol 20d",
    "Held % Insiders","Held % Institutions",
  ]);
  const technicals = coreFields.concat([
    "RSI14",
    "ATR% (14)",
    "Vol (20d, ann)",
    "Max Drawdown (1y)",
    "% Dist SMA200D",
    "SMA200W",
    "% Dist SMA200W",
    "MACD Hist (12,26,9)",
    "ADX14",
    "Stoch %K (14)",
    "Stoch %D (3)",
    "BB %B (20,2)",
    "BB Width (20,2)",
    "Support D1",
    "Support D1 %",
    "Support D2",
    "Support D2 %",
    "Resistance D1",
    "Resistance D1 %",
    "Resistance D2",
    "Resistance D2 %",
    "R:R (D)",
    "Support W1",
    "Support W1 %",
    "Support W2",
    "Support W2 %",
    "Resistance W1",
    "Resistance W1 %",
    "Resistance W2",
    "Resistance W2 %",
    "R:R (W)",
    "Support M1",
    "Support M1 %",
    "Support M2",
    "Support M2 %",
    "Resistance M1",
    "Resistance M1 %",
    "Resistance M2",
    "Resistance M2 %",
    "R:R (M)"
  ]);


const taLevels = coreFields.concat([
    "Support D1","Support D1 %","Support D2","Support D2 %","Resistance D1","Resistance D1 %","Resistance D2","Resistance D2 %","R:R (D)",
    "Support W1","Support W1 %","Support W2","Support W2 %","Resistance W1","Resistance W1 %","Resistance W2","Resistance W2 %","R:R (W)",
    "Support M1","Support M1 %","Support M2","Support M2 %","Resistance M1","Resistance M1 %","Resistance M2","Resistance M2 %","R:R (M)"
  ]);

  const valPrices = coreFields.concat([
    "DCF Price (5yr)","Residual Income Price","Asset Based Price","SOTP Price",
    "Dividend Discount Price","Earnings Power Value (EPV) Price","Option Pricing Value",
    "MOS Buy Price","Margin of Safety"
  ]);

  const valDiscs = coreFields.concat([
    "DCF Premium/(Discount)",
    "Residual Income Premium/(Discount)","Asset Based Premium/(Discount)","SOTP Premium/(Discount)",
    "Dividend Discount Premium/(Discount)","EPV Premium/(Discount)","Option Pricing Premium/(Discount)",
    "Margin of Safety"
  ]);

  const dividends = coreFields.concat([
    "Dividend Rate (Yahoo)","Dividend Yield (Yahoo)","Dividend Yield (Latest, Calc)","Dividend Yield Δ% (Yahoo→Calc)",
    "Payout Ratio (Yahoo)","5Y Avg Dividend Yield (Yahoo)","Ex-Dividend Date (Yahoo)",
    "Last Dividend Value (Yahoo)","Last Dividend Date (Yahoo)",
  ]);

  const ownership = coreFields.concat([
    "Held % Insiders","Held % Institutions","Avg $Vol 20d"
  ]);

  function setColumnVisible(col, on){
    try{
      if(typeof col.setVisible === "function"){ col.setVisible(!!on); return; }
    }catch(_){}
    try{
      if(!!on && typeof col.show === "function"){ col.show(); return; }
      if(!on && typeof col.hide === "function"){ col.hide(); return; }
    }catch(_){}
    // Last resort: table-level show/hide by field
    try{
      const f = col.getField && col.getField();
      if(!f) return;
      if(!!on && typeof table.showColumn === "function"){ table.showColumn(f); return; }
      if(!on && typeof table.hideColumn === "function"){ table.hideColumn(f); return; }
    }catch(_){}
  }

  function setView(fields){
    const set = new Set(fields);
    table.getColumns().forEach(col=>{
      const f = col.getField && col.getField();
      if(!f) return;
      setColumnVisible(col, set.has(f));
    });
    safeRedraw();
  }

  function applyView(v){
    if(v==="basic") setView(coreFields);
    else if(v==="fundamentals") setView(fundamentals);
    else if(v==="technicals") setView(technicals);
    else if(v==="ta_levels") setView(taLevels);
    else if(v==="valuation_prices") setView(valPrices);
    else if(v==="valuation_discounts") setView(valDiscs);
    else if(v==="dividends") setView(dividends);
    else if(v==="ownership") setView(ownership);
    else if(v==="all"){
      table.getColumns().forEach(c=>setColumnVisible(c,true));
      safeRedraw();
    }


    // Column toggles (checkboxes) are designed to augment the Basic view.
    // For other views, we keep the view authoritative to avoid columns being hidden again by refresh().
    const toggleIds = ["colShowIncome","colShowAllDiv","colShowAllHold","colShowValDisc","colShowValPrices"];
    const enableToggles = (on)=>{
      toggleIds.forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.disabled = !on;
      });
    };

    if(v==="basic"){
      enableToggles(true);
      try{ if(window.__asxColRefresh) window.__asxColRefresh(); }catch(_){}
    }else{
      enableToggles(false);
    }
    safeRedraw();

    // Update segmented active state
    if(seg){
      Array.from(seg.querySelectorAll("button")).forEach(b=>{
        b.classList.toggle("active", b.dataset.view === v);
      });
    }
  }

  sel.addEventListener("change", ()=>applyView(sel.value));

  // Initialize
  applyView(sel.value || "basic");
}


function safeRedraw(){
  try{
    const holder = document.querySelector("#table .tabulator-tableholder");
    const sl = holder ? holder.scrollLeft : 0;
    const st = holder ? holder.scrollTop : 0;
    table.redraw(false);
    if(holder){
      holder.scrollLeft = sl;
      holder.scrollTop = st;
    }
  }catch(e){}
}


let __macroTipEl = null;

function ensureMacroTipEl(){
  if(__macroTipEl) return __macroTipEl;
  __macroTipEl = document.getElementById("macroTip");
  return __macroTipEl;
}

function positionTip(el, evt){
  if(!el || !evt) return;
  const pad = 12;
  const vw = window.innerWidth || 1024;
  const vh = window.innerHeight || 768;
  const rect = el.getBoundingClientRect();
  let x = evt.clientX + pad;
  let y = evt.clientY + pad;
  const w = rect.width || 320;
  const h = rect.height || 120;
  if(x + w + pad > vw) x = Math.max(pad, evt.clientX - w - pad);
  if(y + h + pad > vh) y = Math.max(pad, evt.clientY - h - pad);
  el.style.left = x + "px";
  el.style.top = y + "px";
}

function showMacroTip(html, evt){
  const el = ensureMacroTipEl();
  if(!el) return;
  el.innerHTML = html;
  el.style.display = "block";
  positionTip(el, evt);
}

function hideMacroTip(){
  const el = ensureMacroTipEl();
  if(!el) return;
  el.style.display = "none";
}

function wireMacroTileTooltips(){
  const tips = {
    macroRegime: {
      title: "Regime",
      body: `A quick read on <b>risk-on</b> vs <b>risk-off</b> using only your <b>current filtered universe</b>.<br><br>
<b>Derived as:</b><br>
• <code>Breadth</code> = % of stocks with <code>Return 1m &gt; 0</code><br>
• <code>Vol</code> = median <code>Vol (20d, ann)</code><br><br>
<b>Heuristic:</b><br>
• Risk-on if breadth ≥ 55% and vol ≤ 35%<br>
• Risk-off if breadth ≤ 45% and vol ≥ 35%<br>
• Otherwise Mixed.<br><span class="muted">Signal, not prophecy.</span>`
    },
    macroBreadth: {
      title: "Breadth",
      body: `Participation: fraction of stocks up over the last month.<br><br>
<b>Formula:</b> <code>#(Return 1m &gt; 0) / #(Return 1m available)</code> within your filtered results.`
    },
    macroVol: {
      title: "Median Vol",
      body: `Typical volatility in your filtered universe.<br><br>
<b>Derived as:</b> median of <code>Vol (20d, ann)</code> across stocks with data.`
    },
    macroValuePocket: {
      title: "Value pocket",
      body: `How many names look "cheap + cash-generative" at the same time.<br><br>
<b>Rule:</b> <code>DCF Premium/(Discount) &gt; 0</code> AND <code>FCF Yield &gt; 5%</code>.<br>
Tile shows the % of filtered stocks that satisfy both.`
    },
    macroIncome: {
      title: "Income",
      body: `Dividend snapshot for your filtered universe.<br><br>
<b>Yield:</b> median of <code>Dividend Yield (Latest, Calc)</code> for payers (yield &gt; 0).<br>
<b>Payers:</b> % of filtered stocks with a positive calculated yield.<br>
<b>Payout:</b> median <code>Payout Ratio (Yahoo)</code> where available.`
    },
    macroSector: {
      title: "Leading sector",
      body: `Sector with the highest median <code>Screener Score</code> (only sectors with <code>n ≥ 6</code>).`
    }
  };

  const bind = (id) => {
    const valEl = document.getElementById(id);
    if(!valEl) return;
    const card = valEl.closest(".card") || valEl;
    const t = tips[id];
    if(!t) return;
    const mk = () => `<strong>${t.title}</strong><div>${t.body}</div>`;
    card.addEventListener("mouseenter", (evt)=>showMacroTip(mk(), evt));
    card.addEventListener("mousemove", (evt)=>positionTip(ensureMacroTipEl(), evt));
    card.addEventListener("mouseleave", hideMacroTip);
  };

  Object.keys(tips).forEach(bind);
}

function wireSliders(){
  const ids = ["xMin","xMax","yMin","yMax"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener("input", () => {
      const win = getChartWindow();
      sliderLabel("xMinV", win.xMin);
      sliderLabel("xMaxV", win.xMax);
      sliderLabel("yMinV", win.yMin);
      sliderLabel("yMaxV", win.yMax);
      rebuildCharts(filteredNow.length ? filteredNow : raw);
    });
  });

  const win = getChartWindow();
  sliderLabel("xMinV", win.xMin);
  sliderLabel("xMaxV", win.xMax);
  sliderLabel("yMinV", win.yMin);
  sliderLabel("yMaxV", win.yMax);
}

async function load(){
  try{
    hideErr();

    let m = null;
    try { m = await fetchJson("/data/manifest.json"); } catch(e) {}
    const when = m ? formatWhen(m.generated_at_perth || m.generated_at_local || m.generated_at_utc) : "";
    setMeta(m ? `Last update: ${when} • Rows: ${m.rows}` : "Loading dataset…");

    let rows = null;
    try{ rows = await fetchJson("/data/latest_web.json"); }
    catch(e1){ rows = await fetchJson("/data/latest.json"); }

    if(!Array.isArray(rows) || rows.length === 0) throw new Error("Dataset loaded but appears empty.");

    raw = rows;
    filteredNow = rows;

    try{ bootUI(raw); }catch(e){ throw e; }
    window.__ASX_UI_READY = true;
    setMeta(m ? `Last update: ${when} • Rows: ${m.rows}` : `Loaded • Rows: ${raw.length}`);
    try{ await loadRRG(); }catch(e){}
  }catch(err){
    console.error(err);
    try{ if(window.__asxFatal) window.__asxFatal("Could not load data", err); }catch(e){}
    setMeta("Error loading dataset");
    showErr(
      `<strong>Could not load data.</strong><br>` +
      `Open <code>/data/latest_web.json</code> to confirm it exists, then hard-refresh.<br>` +
      `<small>${String(err).replaceAll("<","&lt;").replaceAll(">","&gt;")}</small>`
    );
  }
}


function updateMacroTiles(rows){
  try{
    const n = rows.length || 0;
    if(!n){
      setText("macroRegime","–"); setText("macroBreadth","–"); setText("macroVol","–");
      setText("macroValuePocket","–"); setText("macroIncome","–"); setText("macroSector","–");
      setText("macroRegimeHint",""); setText("macroIncomeHint",""); setText("macroSectorHint","");
      return;
    }

    const ret1m = rows.map(r=>num(r["Return 1m"])).filter(Number.isFinite);
    const breadth = ret1m.length ? (ret1m.filter(x=>x>0).length / ret1m.length) : NaN;

    const vol = rows.map(r=>num(r["Vol (20d, ann)"])).filter(Number.isFinite);
    const volMed = vol.length ? median(vol) : NaN;

    const vp = rows.filter(r => num(r["DCF Premium/(Discount)"]) > 0 && num(r["FCF Yield"]) > 0.05).length;
    const vpPct = vp / n;

    const dy = rows.map(r=>normFrac(r["Dividend Yield (Latest, Calc)"])).filter(x=>Number.isFinite(x) && x>0);
    const dyMed = dy.length ? median(dy) : NaN;
    const pay = rows.map(r=>normFrac(r["Payout Ratio (Yahoo)"])).filter(Number.isFinite);
    const payMed = pay.length ? median(pay) : NaN;

    // Leading sector by median score
    const bySector = {};
    rows.forEach(r=>{
      const s = r["Sector"] || "—";
      const sc = num(r["Screener Score"]);
      if(!Number.isFinite(sc)) return;
      (bySector[s] ||= []).push(sc);
    });
    let bestSector = "—", bestMed = NaN, bestN = 0;
    Object.entries(bySector).forEach(([s, arr])=>{
      if(arr.length < 6) return;
      const m = median(arr);
      if(!Number.isFinite(bestMed) || m > bestMed){
        bestMed = m; bestSector = s; bestN = arr.length;
      }
    });

    // Simple regime label heuristic
    let regime = "Mixed";
    if(Number.isFinite(breadth) && Number.isFinite(volMed)){
      if(breadth >= 0.55 && volMed <= 0.35) regime = "Risk-on";
      else if(breadth <= 0.45 && volMed >= 0.35) regime = "Risk-off";
    }

    setText("macroRegime", regime);
    setText("macroRegimeHint", `Breadth ${Number.isFinite(breadth)?Math.round(breadth*100):"–"}% • Vol ${Number.isFinite(volMed)?pctSmart(volMed):"–"}`);
    setText("macroBreadth", Number.isFinite(breadth) ? (Math.round(breadth*100)+"%") : "–");
    setText("macroVol", Number.isFinite(volMed) ? pctSmart(volMed) : "–");
    setText("macroValuePocket", Math.round(vpPct*100)+"%");

    if(Number.isFinite(dyMed)){
      const payersPct = Math.round((dy.length / n) * 100);
      setText("macroIncome", pctSmart(dyMed));
      setText("macroIncomeHint", `Payers ${payersPct}% • Payout med ${Number.isFinite(payMed)?pctSmart(payMed):"–"}`);
    }else{
      setText("macroIncome","–");
      setText("macroIncomeHint", "");
    }

    setText("macroSector", bestSector);
    setText("macroSectorHint", Number.isFinite(bestMed) ? (`Median score ${fmt2(bestMed)} (n=${bestN})`) : "");
  }catch(e){
    console.warn("macro tiles error", e);
  }
}

function bootUI(rows){

  // Derived scoring fields (computed client-side so we don't need to regenerate the dataset)
  rows.forEach(r=>{
    try{
      r["__FA_Score"] = faBaseScore(r);
      r["__TA_Score"] = taCompositeScore(r);
      r["__Total_Score"] = totalScore(r);
    }catch(_){
      // keep row intact; UI will still load
    }
  });

  // Defensive UI guards: don't hard-crash if optional UI blocks are missing.
  if(!document.querySelector("#table")){
    throw new Error("UI template mismatch: missing #table element in screener.html");
  }

  const sectors = Array.from(new Set(rows.map(r => r["Sector"]).filter(Boolean))).sort();
  const sel = document.getElementById("sector");
  if(sel) sel.innerHTML = `<option value="">All sectors</option>` + sectors.map(s=>`<option>${s}</option>`).join("");

  setText("kpiRows", rows.length.toLocaleString());
  setText("kpiDCF", pct(median(rows.map(r => num(r["DCF Premium/(Discount)"]))))); 
  setText("kpiFCF", pct(median(rows.map(r => num(r["FCF Yield"])))));
  setText("kpiScore", fmt2(median(rows.map(r => num(r["__Total_Score"])))));
  updateMacroTiles(rows);

  table = new Tabulator("#table", {
    data: rows,
    height: "650px",
    layout: "fitData",
    responsiveLayout: false,
    columnDefaults: {minWidth: 120, headerWordWrap: true},
    pagination: true,
    paginationSize: 50,
    movableColumns: true,

    rowTooltip: function(e, row){
  const d = row.getData();

  function rehighlightActiveRow(){
    try{
      const key = window.__asxActiveKey;
      if(!key) return;
      const rows = table.getRows();
      let found = false;
      rows.forEach(r=>{
        const d = r.getData() || {};
        const k = String(d["Ticker"] || r.getIndex() || "");
        const el = r.getElement();
        if(!el) return;
        if(k === key){
          el.classList.add("asx-row-active");
          window.__asxActiveRowEl = el;
          found = true;
        }else{
          el.classList.remove("asx-row-active");
        }
      });
      if(!found){
        // active row not present anymore -> collapse panel
        window.__asxActiveKey = null;
        window.__asxActiveRowEl = null;
        const drawer = document.getElementById("detailDrawer");
        const body = document.getElementById("scoreDetailsBody");
        const hint = document.getElementById("scoreDetailsHint");
        closeDrawer();
        if(body) body.innerHTML = "";
        if(hint) hint.textContent = "Click a row in the table to populate it.";
      }
    }catch(e){}
  }

  try{
    table.on("dataFiltered", ()=>setTimeout(rehighlightActiveRow, 0));
    table.on("dataSorted", ()=>setTimeout(rehighlightActiveRow, 0));
    table.on("pageLoaded", ()=>setTimeout(rehighlightActiveRow, 0));
    table.on("renderComplete", ()=>setTimeout(rehighlightActiveRow, 0));
  }catch(e){}
const s = num(d["Screener Score"]);
  const v = num(d["Value Score"]);
  const q = num(d["Quality Score"]);
  const r = num(d["Risk Score"]);
  const lb = num(d["Liquidity Bonus"]);
  const lbTxt = Number.isFinite(lb) ? (" • +Liq " + lb.toFixed(1)) : "";
  return "Score " + (Number.isFinite(s)?s.toFixed(1):"–") +
         " • V " + (Number.isFinite(v)?v.toFixed(0):"–") +
         " • Q " + (Number.isFinite(q)?q.toFixed(0):"–") +
         " • R " + (Number.isFinite(r)?r.toFixed(0):"–") +
         lbTxt;
},
    initialSort: [
      {column:"Screener Score", dir:"desc"},
      {column:"Undervalued Methods Count", dir:"desc"},
      {column:"DCF Premium/(Discount)", dir:"desc"},
      {column:"FCF Yield", dir:"desc"},
    ],
    columns: [
      {title:"Ticker", field:"Ticker",  width:90, headerFilter:true},
      {title:"Company", field:"Company",  minWidth:220, headerFilter:true},
      {title:"Sector", field:"Sector", width:160, headerFilter:true},
      {title:"FA Strength", field:"__FA_Strength", headerTooltip:"Fundamental strength rating (Very Weak → Very Strong) derived from the Fundamental base score: 45% Value + 30% Quality + 25% Risk + Liquidity bonus (0..10, capped at 100). Falls back to dataset Screener Score if components are missing.", formatter:(c)=>pillHTML(faStrength(c.getRow().getData()||{})), sorter:strengthSorter, download:false},
      {title:"TA Strength", field:"__TA_Strength", headerTooltip:"Technical strength rating (Very Weak → Very Strong) derived from the TA composite (0–100): trend (distance to SMA200D/SMA200W), momentum (RSI14, MACD histogram, Stoch %K), trend strength (ADX14), and Reward:Risk (D/W/M), with penalties for high ATR% and deep 1y drawdown. Designed for timing/regime-fit, not intrinsic value.", formatter:(c)=>pillHTML(taStrength(c.getRow().getData()||{})), sorter:strengthSorter, download:false},
      {title:"FA Score", field:"__FA_Score", formatter:(c)=>fmt2(num(c.getValue())), visible:false, headerTooltip:"Fundamentals base score (0–100): 45% Value + 30% Quality + 25% Risk."},
      {title:"TA Score", field:"__TA_Score", formatter:(c)=>fmt2(num(c.getValue())), visible:false, headerTooltip:"Technicals composite score (0–100) derived from trend (200D/200W), momentum (RSI/MACD/Stoch), trend strength (ADX), reward:risk (S/R), and volatility/drawdown penalties."},


      {title:"Score", field:"__Total_Score",  headerTooltip:"Total Score (0–100): 65% Fundamental base + 35% Technical composite. Fundamental base = 45% Value + 30% Quality + 25% Risk + Liquidity bonus (0..10, capped). Technical composite blends trend (SMA200D/SMA200W distance), momentum (RSI/MACD/Stoch), trend strength (ADX), and multi-timeframe R:R, with penalties for high ATR% and deep 1y drawdown. “–” means missing/unavailable; it is not the same as 0.", formatter:(c)=>fmt2(num(c.getValue()))},
      {title:"Value", field:"Value Score", headerTooltip:'Value Score (0–100): percentile composite of DCF discount, FCF yield, MOS upside, and low P/B.', formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"Quality", field:"Quality Score", headerTooltip:'Quality Score (0–100): percentile composite of ROE, profit margin, and low net debt/EBITDA.', formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"Risk", field:"Risk Score", headerTooltip:'Risk Score (0–100): percentile composite favoring lower vol, lower ATR%, and smaller drawdowns.', formatter:(c)=>fmt2(num(c.getValue())), visible:false},

      {title:"Price", field:"Price", formatter:(c)=>fmt2(num(c.getValue()))},
      {title:"Mkt Cap", field:"Market Cap", formatter:(c)=>fmtInt(num(c.getValue()))},

      {title:"DCF Disc", field:"DCF Premium/(Discount)", formatter:(c)=>fmtValDisc(c)},
      {title:"FCF Yield", field:"FCF Yield", formatter:(c)=>pct(num(c.getValue()))},
      {title:"Undervalued Count", field:"Undervalued Methods Count", width:160, headerTooltip:"Count of methods where (Intrinsic - Price)/Price > 0. Counted: DCF, Residual Income, Asset Based, SOTP, Dividend Discount. Enable valuation columns for each method.", formatter:(c)=>{const v=num(c.getValue()); return Number.isFinite(v)?String(Math.round(v)):"";}},

      {title:"DCF $", field:"DCF Price (5yr)", headerTooltip:"DCF intrinsic price estimate (5yr model).", formatter:(c)=>fmtValPrice(c), visible:false},

      {title:"RI Disc", field:"Residual Income Premium/(Discount)", headerTooltip:"Residual Income premium/(discount): (Intrinsic - Price)/Price.", formatter:(c)=>fmtValDisc(c), visible:false},
      {title:"Asset Disc", field:"Asset Based Premium/(Discount)", headerTooltip:"Asset-based premium/(discount): (Intrinsic - Price)/Price.", formatter:(c)=>fmtValDisc(c), visible:false},
      {title:"SOTP Disc", field:"SOTP Premium/(Discount)", headerTooltip:"Sum-of-the-parts premium/(discount): (Intrinsic - Price)/Price.", formatter:(c)=>fmtValDisc(c), visible:false},
      {title:"DDM Disc", field:"Dividend Discount Premium/(Discount)", headerTooltip:"Dividend Discount premium/(discount): (Intrinsic - Price)/Price.", formatter:(c)=>fmtValDisc(c), visible:false},
      {title:"EPV Disc", field:"EPV Premium/(Discount)", headerTooltip:"Earnings Power Value premium/(discount): (Intrinsic - Price)/Price.", formatter:(c)=>fmtValDisc(c), visible:false},
      {title:"Opt Disc", field:"Option Pricing Premium/(Discount)", headerTooltip:"Option-pricing premium/(discount): (Intrinsic - Price)/Price.", formatter:(c)=>fmtValDisc(c), visible:false},

      {title:"RI $", field:"Residual Income Price", headerTooltip:"Residual Income intrinsic price estimate.", formatter:(c)=>fmtValPrice(c), visible:false},
      {title:"Asset $", field:"Asset Based Price", headerTooltip:"Asset-based intrinsic price estimate.", formatter:(c)=>fmtValPrice(c), visible:false},
      {title:"SOTP $", field:"SOTP Price", headerTooltip:"Sum-of-the-parts intrinsic price estimate.", formatter:(c)=>fmtValPrice(c), visible:false},
      {title:"DDM $", field:"Dividend Discount Price", headerTooltip:"Dividend Discount Model intrinsic price estimate.", formatter:(c)=>fmtValPrice(c), visible:false},
      {title:"EPV $", field:"Earnings Power Value (EPV) Price", headerTooltip:"EPV intrinsic price estimate.", formatter:(c)=>fmtValPrice(c), visible:false},
      {title:"Opt $", field:"Option Pricing Value", headerTooltip:"Option-pricing intrinsic value estimate.", formatter:(c)=>fmtValPrice(c), visible:false},

      {title:"MOS Buy $", field:"MOS Buy Price", headerTooltip:"Margin-of-safety buy price = DCF price × (1 - MOS).", formatter:(c)=>fmtValPrice(c), visible:false},
      {title:"MOS", field:"Margin of Safety", headerTooltip:"Configured margin-of-safety % used to compute MOS Buy Price.", formatter:(c)=>pct(num(c.getValue())), visible:false},

      {title:"Book Value", field:"Book Value (Total, Assets-Liab)", formatter:(c)=>fmtInt(num(c.getValue())), visible:false},
      {title:"BV/Share", field:"Book Value / Share (Assets-Liab)", formatter:(c)=>fmt2(num(c.getValue()))},
      {title:"Held% Ins", field:"Held % Insiders", headerTooltip:'Estimated % of shares held by insiders (data-source reported).', formatter:(c)=>pct(num(c.getValue())), visible:false},
      {title:"Held% Inst", field:"Held % Institutions", headerTooltip:'Estimated % of shares held by institutions (data-source reported).', formatter:(c)=>pct(num(c.getValue())), visible:false},

      // Dividend fields (revamped): Yahoo raw + calculated latest yield
      {title:"Div Rate", field:"Dividend Rate (Yahoo)", headerTooltip:"Trailing annual dividend rate (cash per share) from Yahoo where available.", formatter:(c)=>fmt4(num(c.getValue())), visible:false},
      {title:"Div Yld (Y!)", field:"Dividend Yield (Yahoo)", headerTooltip:"Dividend yield from Yahoo (may lag price).", formatter:(c)=>pctSmart(num(c.getValue())), visible:false},
      {title:"Div Yld (Calc)", field:"Dividend Yield (Latest, Calc)", headerTooltip:"Calculated: trailing annual dividend rate ÷ latest share price.", formatter:(c)=>pct(num(c.getValue())), visible:true},
      {title:"Div Δ% (Y!→Calc)", field:"Dividend Yield Δ% (Yahoo→Calc)", headerTooltip:"Relative % difference between Yahoo's dividendYield and the calculated yield (from dividendRate ÷ latest price).", formatter:(c)=>pct(num(c.getValue())), visible:false},
      {title:"Payout", field:"Payout Ratio (Yahoo)", headerTooltip:"Payout ratio from Yahoo where available.", formatter:(c)=>pct(num(c.getValue())), visible:false},
      {title:"5Y Avg Yld", field:"5Y Avg Dividend Yield (Yahoo)", headerTooltip:"Five-year average dividend yield from Yahoo.", formatter:(c)=>pctSmart(num(c.getValue())), visible:false},
      {title:"Ex-Div", field:"Ex-Dividend Date (Yahoo)", headerTooltip:"Ex-dividend date from Yahoo.", visible:false},
      {title:"Last Div", field:"Last Dividend Value (Yahoo)", headerTooltip:"Last dividend amount (cash per share) from Yahoo.", formatter:(c)=>fmt4(num(c.getValue())), visible:false},
      {title:"Last Div Dt", field:"Last Dividend Date (Yahoo)", headerTooltip:"Last dividend date from Yahoo.", visible:false},

      {title:"BV/Share (Yahoo)", field:"Book Value / Share (Yahoo)", formatter:(c)=>fmt2(num(c.getValue())), visible:false},

      {title:"RSI14", field:"RSI14", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Relative Strength Index (14). 0-100 momentum oscillator; ~>70 strong/extended, ~<30 weak/oversold (context matters)."},
      {title:"%Dist 200D", field:"% Dist SMA200D", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"% distance of current price vs 200-day SMA. Positive = above SMA (trend tailwind). Negative = below SMA (trend headwind).", visible:false},
      {title:"%Dist 200W", field:"% Dist SMA200W", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"% distance of current price vs 200-week SMA. Long-horizon trend filter.", visible:false},
      {title:"SMA200W", field:"SMA200W", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"200-week simple moving average (weekly closes).", visible:false},
      {title:"MACD Hist", field:"MACD Hist (12,26,9)", formatter:(c)=>fmt4(num(c.getValue())), headerTooltip:"MACD histogram = MACD line minus signal line. Positive and rising often implies strengthening momentum.", visible:false},
      {title:"ADX14", field:"ADX14", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"ADX (14) measures trend strength (not direction). ~<20 weak/range, ~>25 trending.", visible:false},
      {title:"Stoch %K", field:"Stoch %K (14)", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Stochastic %K (14). Roughly: >80 overbought, <20 oversold (context matters).", visible:false},
      {title:"Stoch %D", field:"Stoch %D (3)", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Stochastic %D (3) is a smoothed signal line for %K.", visible:false},
      {title:"BB %B", field:"BB %B (20,2)", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Bollinger %B position inside bands (0=lower band, 1=upper band).", visible:false},
      {title:"BB Width", field:"BB Width (20,2)", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Bollinger bandwidth (upper-lower)/mid. Higher = more volatility; lower = compression.", visible:false},
      // Multi-timeframe Support/Resistance + R:R
      {title:"D Sup1", field:"Support D1", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Nearest DAILY support (pivot-based).", visible:false},
      {title:"D Sup1%", field:"Support D1 %", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Distance down to DAILY support 1 as % of current price.", visible:false},
      {title:"D Sup2", field:"Support D2", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Second-nearest DAILY support (pivot-based).", visible:false},
      {title:"D Sup2%", field:"Support D2 %", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Distance down to DAILY support 2 as % of current price.", visible:false},
      {title:"D Res1", field:"Resistance D1", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Nearest DAILY resistance (pivot-based).", visible:false},
      {title:"D Res1%", field:"Resistance D1 %", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Distance up to DAILY resistance 1 as % of current price.", visible:false},
      {title:"D Res2", field:"Resistance D2", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Second-nearest DAILY resistance (pivot-based).", visible:false},
      {title:"D Res2%", field:"Resistance D2 %", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Distance up to DAILY resistance 2 as % of current price.", visible:false},
      {title:"D R:R", field:"R:R (D)", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Daily Reward:Risk = (% to nearest resistance) / (% to nearest support). Higher can mean better asymmetry (but watch quality of levels).", visible:false},

      {title:"W Sup1", field:"Support W1", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Nearest WEEKLY support (pivot-based).", visible:false},
      {title:"W Sup1%", field:"Support W1 %", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Distance down to WEEKLY support 1 as % of current price.", visible:false},
      {title:"W Sup2", field:"Support W2", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Second-nearest WEEKLY support (pivot-based).", visible:false},
      {title:"W Sup2%", field:"Support W2 %", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Distance down to WEEKLY support 2 as % of current price.", visible:false},
      {title:"W Res1", field:"Resistance W1", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Nearest WEEKLY resistance (pivot-based).", visible:false},
      {title:"W Res1%", field:"Resistance W1 %", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Distance up to WEEKLY resistance 1 as % of current price.", visible:false},
      {title:"W Res2", field:"Resistance W2", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Second-nearest WEEKLY resistance (pivot-based).", visible:false},
      {title:"W Res2%", field:"Resistance W2 %", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Distance up to WEEKLY resistance 2 as % of current price.", visible:false},
      {title:"W R:R", field:"R:R (W)", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Weekly Reward:Risk using nearest weekly resistance/support.", visible:false},

      {title:"M Sup1", field:"Support M1", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Nearest MONTHLY support (pivot-based).", visible:false},
      {title:"M Sup1%", field:"Support M1 %", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Distance down to MONTHLY support 1 as % of current price.", visible:false},
      {title:"M Sup2", field:"Support M2", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Second-nearest MONTHLY support (pivot-based).", visible:false},
      {title:"M Sup2%", field:"Support M2 %", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Distance down to MONTHLY support 2 as % of current price.", visible:false},
      {title:"M Res1", field:"Resistance M1", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Nearest MONTHLY resistance (pivot-based).", visible:false},
      {title:"M Res1%", field:"Resistance M1 %", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Distance up to MONTHLY resistance 1 as % of current price.", visible:false},
      {title:"M Res2", field:"Resistance M2", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Second-nearest MONTHLY resistance (pivot-based).", visible:false},
      {title:"M Res2%", field:"Resistance M2 %", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Distance up to MONTHLY resistance 2 as % of current price.", visible:false},
      {title:"M R:R", field:"R:R (M)", formatter:(c)=>fmt2(num(c.getValue())), headerTooltip:"Monthly Reward:Risk using nearest monthly resistance/support.", visible:false},

      {title:"ATR%", field:"ATR% (14)", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Average True Range % (14). A rough volatility gauge: higher = more daily range."},
      {title:"Vol20", field:"Vol (20d, ann)", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Annualised volatility from last 20 trading days (std of returns)."},
      {title:"MDD", field:"Max Drawdown (1y)", formatter:(c)=>pct(num(c.getValue())), headerTooltip:"Maximum peak-to-trough drawdown over the last ~1 year. Lower (more negative) = nastier downswings."},

      {title:"Avg $Vol 20d", field:"Avg $Vol 20d", formatter:(c)=>fmtInt(num(c.getValue())), visible:false},
      {title:"NetDebt/EBITDA", field:"Net Debt/EBITDA", formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"ROE", field:"ROE", formatter:(c)=>pct(num(c.getValue())), visible:false},
    ],
  });

  // Keep header/body aligned without resetting scroll position
  try{
    table.on("dataLoaded", ()=>setTimeout(safeRedraw, 0));
    table.on("columnVisibilityChanged", ()=>setTimeout(safeRedraw, 0));
    table.on("columnResized", ()=>setTimeout(safeRedraw, 0));
    window.addEventListener("resize", ()=>setTimeout(safeRedraw, 50));
  }catch(e){}


  wireSliders();
  wireDividendAxisControls();
  wireMacroTileTooltips();
  wireDrawerClose();
  rebuildCharts(rows);

  wireColumnControls();
  wireTableView();
  

  // Click a row to see full score breakdown without cluttering the table.

  

function safeRowElement(row){
  // Tabulator RowComponent element accessor across versions
  try{
    if(row){
      if(typeof row.getElement === "function") return row.getElement();
      if(row.getElement && row.getElement.nodeType===1) return row.getElement;
      // internal fallbacks (best-effort)
      if(row._row && row._row.element) return row._row.element;
    }
  }catch(_){}
  return null;
}
let lastClickedKey = null;

  table.on("rowClick", function(e, row){
  try{
    const d = row.getData() || {};
    const key = String(d["Ticker"] || row.getIndex() || "");

    const drawer = document.getElementById("detailDrawer");
    const body = document.getElementById("scoreDetailsBody");
    const hint = document.getElementById("scoreDetailsHint");

    // Toggle logic:
    // - click a row: select + expand panel
    // - click the same row again: unselect + collapse panel
    // - click a different row: move selection + update panel
    if(window.__asxActiveKey && key && window.__asxActiveKey === key){
      // toggle OFF
      if(window.__asxActiveRowEl){
        window.__asxActiveRowEl.classList.remove("asx-row-active");
      }
      window.__asxActiveKey = null;
      window.__asxActiveRowEl = null;
      closeDrawer();
      if(body) body.innerHTML = "";
      if(hint) hint.textContent = "Click a row in the table to populate it.";
      return;
    }

    // Switching to a new row
    if(window.__asxActiveRowEl){
      window.__asxActiveRowEl.classList.remove("asx-row-active");
    }
    const el = safeRowElement(row);
    if(el) el.classList.add("asx-row-active");
    window.__asxActiveKey = key || null;
    window.__asxActiveRowEl = el || null;

    openDrawer();
    if(hint) hint.textContent = key ? `Selected: ${key}` : "Selected stock";
    try{ renderScoreDetails(d); }catch(err){ console.error(err); }

  
  }catch(err){
    console.error(err);
    // Do not kill the whole app on a row click error; just show a hint in the drawer.
    try{
      const hint = document.getElementById("scoreDetailsHint");
      if(hint) hint.textContent = "Could not render this row's details (see console).";
    }catch(_){}
  }

});



document.getElementById("preset").addEventListener("change", () => {
    applyPreset();
    applyFilters();
  });

  document.getElementById("apply").onclick = applyFilters;
  document.getElementById("reset").onclick = () => {
    document.getElementById("preset").value = "";
    ["q","sector","minMcap","minFcf","minU","minROE","maxND","minDV","maxVol","maxATR","minScore"].forEach(id=>{
      const el = document.getElementById(id); if(el) el.value = "";
    });
    filteredNow = raw;
    table.setData(raw);
    rebuildCharts(raw);
  };

  document.getElementById("dl").onclick = () => {
    table.download("csv", "asx_filtered.csv");
  };

  // RRG controls
  const rrgBtn = document.getElementById("rrgReload");
  if(rrgBtn) rrgBtn.onclick = () => loadRRG();
  const rrgTf = document.getElementById("rrgTf");
  if(rrgTf) rrgTf.onchange = () => renderRRG();

  // Initial load
  loadRRG();
}

function applyFilters(){
  const q = document.getElementById("q").value.trim().toLowerCase();
  const sector = document.getElementById("sector").value;

  const minMcap = num(document.getElementById("minMcap").value);
  const minFcf  = num(document.getElementById("minFcf").value);
  const minU    = num(document.getElementById("minU").value);

  const minROE  = num(document.getElementById("minROE").value);
  const maxND   = num(document.getElementById("maxND").value);
  const minDV   = num(document.getElementById("minDV").value);
  const maxVol  = num(document.getElementById("maxVol").value);
  const maxATR  = num(document.getElementById("maxATR").value);
  const minScore = num(document.getElementById("minScore").value);

  const preset = document.getElementById("preset").value;

  const out = raw.filter(r => {
    if(q){
      const t = String(r["Ticker"]||"").toLowerCase();
      const c = String(r["Company"]||"").toLowerCase();
      if(!t.includes(q) && !c.includes(q)) return false;
    }
    if(sector && r["Sector"] !== sector) return false;

    const mcap = num(r["Market Cap"]);
    const fcfy = num(r["FCF Yield"]);
    const ucnt = num(r["Undervalued Methods Count"]);
    const roe  = num(r["ROE"]);
    const nd   = num(r["Net Debt/EBITDA"]);
    const dv   = num(r["Avg $Vol 20d"]);
    const vol  = num(r["Vol (20d, ann)"]);
    const atr  = num(r["ATR% (14)"]);
    const score = num(r["Screener Score"]);
    const rsi = num(r["RSI14"]);
    const fromHigh = num(r["% From 52W High"]);

    if(Number.isFinite(minMcap) && Number.isFinite(mcap) && mcap < minMcap) return false;
    if(Number.isFinite(minFcf) && Number.isFinite(fcfy) && fcfy < minFcf) return false;
    if(Number.isFinite(minU) && Number.isFinite(ucnt) && ucnt < minU) return false;

    if(Number.isFinite(minROE) && Number.isFinite(roe) && roe < minROE) return false;
    if(Number.isFinite(maxND) && Number.isFinite(nd) && nd > maxND) return false;
    if(Number.isFinite(minDV) && Number.isFinite(dv) && dv < minDV) return false;
    if(Number.isFinite(maxVol) && Number.isFinite(vol) && vol > maxVol) return false;
    if(Number.isFinite(maxATR) && Number.isFinite(atr) && atr > maxATR) return false;
    if(Number.isFinite(minScore) && Number.isFinite(score) && score < minScore) return false;

    if(preset === "mean_reversion"){
      if(Number.isFinite(rsi) && rsi > 35) return false;
      if(Number.isFinite(fromHigh) && fromHigh > -0.20) return false;
    }

    return true;
  });

  filteredNow = out;
  table.setData(out);
  rebuildCharts(out);

  document.getElementById("kpiRows").textContent = out.length.toLocaleString();
  document.getElementById("kpiDCF").textContent = pct(median(out.map(r => num(r["DCF Premium/(Discount)"]))));
  document.getElementById("kpiFCF").textContent = pct(median(out.map(r => num(r["FCF Yield"]))));
  document.getElementById("kpiScore").textContent = fmt2(median(out.map(r => num(r["Screener Score"]))));
  updateMacroTiles(out);
}

function rebuildCharts(rows){
  const win = getChartWindow();

  const ptsAll = rows
    .map(r => ({
      x: num(r["DCF Premium/(Discount)"]),
      y: num(r["FCF Yield"]),
      m: num(r["Market Cap"]) || 0,
      label: r["Ticker"]
    }))
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
    .filter(p => p.x >= win.xMin && p.x <= win.xMax && p.y >= win.yMin && p.y <= win.yMax);

  ptsAll.sort((a,b)=>b.m-a.m);
  const N = Math.min(900, ptsAll.length);
  const pts = ptsAll.slice(0, N).map(p => ({
    x: p.x,
    y: p.y,
    r: Math.max(2, Math.min(16, p.m / 5e10 * 16)),
    label: p.label
  }));

  const scatterCtx = document.getElementById("scatter");
  if(scatterChart) scatterChart.destroy();
  scatterChart = new Chart(scatterCtx, {
    type: "bubble",
    data: { datasets: [{ label: `Top ${N} by mkt cap (in view)`, data: pts }]},
    options: {
      parsing:false,
      interaction:{ mode:"nearest", intersect:false },
      plugins:{ tooltip:{
        callbacks:{
          label:(ctx)=> `${ctx.raw.label}: DCF ${pct(ctx.raw.x)} • FCF ${pct(ctx.raw.y)}`
        }
      }},
      scales:{
        x:{ title:{display:true,text:"DCF premium/(discount)"},
            min: win.xMin, max: win.xMax },
        y:{ title:{display:true,text:"FCF yield"},
            min: win.yMin, max: win.yMax }
      }
    }
  });

  const counts = rows.map(r => num(r["Undervalued Methods Count"])).filter(Number.isFinite);
  const max = counts.length ? Math.max(...counts) : 0;
  const bins = Array.from({length: max+1}, (_,i)=>i);
  const freq = bins.map(b => counts.filter(x=>x===b).length);
  // Sector median screener score (top sectors)
  const bySector = new Map();
  rows.forEach(r=>{
    const s = r["Sector"] || "Unknown";
    const sc = num(r["Screener Score"]);
    if(!Number.isFinite(sc)) return;
    if(!bySector.has(s)) bySector.set(s, []);
    bySector.get(s).push(sc);
  });

  const sectorStats = Array.from(bySector.entries()).map(([s, arr])=>{
    return {sector:s, med: median(arr), n: arr.length};
  }).sort((a,b)=>b.med-a.med);

  const top = sectorStats.slice(0, 18);
  const labels = top.map(x=>x.sector);
  const data = top.map(x=>x.med);

  const histCtx = document.getElementById("hist");
  if(histChart) histChart.destroy();
  histChart = new Chart(histCtx, {
    type:"bar",
    data:{ labels, datasets:[{label:"Median Screener Score", data}]},
    options:{
      plugins:{
        legend:{display:false},
        tooltip:{
          callbacks:{
            label:(ctx)=>{
              const i = ctx.dataIndex;
              const st = top[i];
              return `${st.sector}: median ${st.med.toFixed(1)} (n=${st.n})`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks:{
            autoSkip:false,
            maxRotation:45,
            minRotation:45,
            callback:(v, i)=> {
              const s = labels[i] || "";
              return s.length > 14 ? (s.slice(0,14)+"…") : s;
            }
          },
          title:{display:true,text:"Sector (top by median score)"}
        },
        y:{ title:{display:true,text:"Median Screener Score"}, suggestedMin:0, suggestedMax:100 }
      }
    }
  });

  // --- Value vs Quality quadrant map ---
  try{
    const vqAll = rows.map(r => ({
      x: num(r["Value Score"]),
      y: num(r["Quality Score"]),
      m: num(r["Market Cap"]) || 0,
      label: r["Ticker"],
      score: num(r["Screener Score"]),
      risk: num(r["Risk Score"]),
    })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

    vqAll.sort((a,b)=>b.m-a.m);
    const NVQ = Math.min(900, vqAll.length);
    const vqPts = vqAll.slice(0, NVQ).map(p => ({
      x: p.x, y: p.y,
      r: Math.max(2, Math.min(16, p.m / 5e10 * 16)),
      label: p.label,
      score: p.score,
      risk: p.risk
    }));

    const vqCtx = document.getElementById("vq");
    if(vqCtx){
      if(vqChart) vqChart.destroy();
      vqChart = new Chart(vqCtx, {
        type:"bubble",
        data:{ datasets:[{ label:`Top ${NVQ} by mkt cap (in view)`, data: vqPts }]},
        options:{
          parsing:false,
          interaction:{ mode:"nearest", intersect:false },
          plugins:{ tooltip:{ callbacks:{ label:(ctx)=>{
            const p = ctx.raw;
            const s = Number.isFinite(p.score) ? fmt2(p.score) : "–";
            const r = Number.isFinite(p.risk) ? fmt2(p.risk) : "–";
            return `${p.label}: V ${fmt2(p.x)} • Q ${fmt2(p.y)} • Score ${s} • Risk ${r}`;
          }}}},
          scales:{
            x:{ title:{display:true,text:"Value score"}, suggestedMin:0, suggestedMax:100 },
            y:{ title:{display:true,text:"Quality score"}, suggestedMin:0, suggestedMax:100 }
          }
        }
      });
    }
  }catch(e){ console.warn("VQ chart error", e); }

  // --- Dividend sustainability map (Yield vs Payout) ---
  try{
    const divAll = rows.map(r => ({
      x: normFrac(r["Dividend Yield (Latest, Calc)"]),
      y: normFrac(r["Payout Ratio (Yahoo)"]),
      m: num(r["Market Cap"]) || 0,
      label: r["Ticker"],
      score: num(r["Screener Score"])
    }))
    .filter(p => Number.isFinite(p.x) && p.x > 0 && Number.isFinite(p.y) && p.y >= 0);

    divAll.sort((a,b)=>b.m-a.m);
    const ND = Math.min(900, divAll.length);
    const divPts = divAll.slice(0, ND).map(p => ({
      x: p.x, y: p.y,
      r: Math.max(2, Math.min(16, p.m / 5e10 * 16)),
      label: p.label,
      score: p.score
    }));

    const divCtx = document.getElementById("divmap");
    if(divCtx){
      if(divChart) divChart.destroy();
      divChart = new Chart(divCtx, {
        type:"bubble",
        data:{ datasets:[{ label:`Top ${ND} by mkt cap (dividend payers)`, data: divPts }]},
        options:{
          parsing:false,
          interaction:{ mode:"nearest", intersect:false },
          plugins:{ tooltip:{ callbacks:{ label:(ctx)=>{
            const p = ctx.raw;
            const s = Number.isFinite(p.score) ? fmt2(p.score) : "–";
            return `${p.label}: Yield ${pctSmart(p.x)} • Payout ${pctSmart(p.y)} • Score ${s}`;
          }}}},
          scales:{
            x:{ title:{display:true,text:"Dividend yield (latest, calc)"},
                ticks:{ callback:(v)=> (Number(v)*100).toFixed(0)+"%" },
                suggestedMin:0, suggestedMax:0.15 },
            y:{ title:{display:true,text:"Payout ratio"},
                ticks:{ callback:(v)=> (Number(v)*100).toFixed(0)+"%" },
                suggestedMin:0, suggestedMax:2.0 }
          }
        }
      });
      window.__divDefaults = {xMin:0,xMax:0.15,yMin:0,yMax:2.0};

    }
  }catch(e){ console.warn("Dividend chart error", e); }

}


// -------------------------
// RRG (Relative Rotation Graph) — ported features from tilescreener reference
// - Algo toggle: JdK + Simple
// - TF toggle: daily/weekly/monthly (static bundle in rrg_sectors.json)
// - Tail slider (5–20)
// - Quadrant shading + labels
// - Head labels
// - Click head point to isolate; click again to restore
// -------------------------

let __rrgBundle = null;
let __rrgState = {
  tf: "weekly",
  algo: "jdk",
  tail: 16,
  selected: null,     // sector name
  stageFilter: null,  // "Leading"|"Improving"|"Weakening"|"Lagging"|null
  autoFit: true,
};

const RRG_COLORS = {
  Improving: "#3b82f6",
  Leading: "#22c55e",
  Weakening: "#f59e0b",
  Lagging: "#ef4444",
};

// White-background friendly theme (higher contrast than the dark-mode tuned defaults)
const RRG_THEME = {
  // We keep the overall site white, but render the RRG plot area as "dark mode"
  // because it dramatically improves contrast for trails/heads/labels.
  plotBg: "#0b1020",
  text: "#0f172a",                 // surrounding UI (white background)
  muted: "#334155",
  border: "#cbd5e1",

  // Inside-plot styling (dark plot area)
  grid: "rgba(255, 255, 255, 0.08)",
  crosshair: "rgba(255, 255, 255, 0.22)",
  labelFill: "rgba(255, 255, 255, 0.80)",
  labelStroke: "rgba(0, 0, 0, 0.75)",
  tailBorder: "rgba(255, 255, 255, 0.90)",
};

function intFromHex(h2){
  const n = parseInt(h2, 16);
  return Number.isFinite(n) ? n : 0;
}
function hexToRgba(hex, a){
  const h = String(hex||"").replace("#","");
  if(h.length != 6) return hex;
  const r = intFromHex(h.slice(0,2));
  const g = intFromHex(h.slice(2,4));
  const b = intFromHex(h.slice(4,6));
  const alpha = (a===undefined || a===null) ? 1 : a;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


function rrgQuadrant(x, y){
  if(!Number.isFinite(x) || !Number.isFinite(y)) return "—";
  if(x >= 100 && y >= 100) return "Leading";
  if(x >= 100 && y < 100)  return "Weakening";
  if(x < 100 && y < 100)   return "Lagging";
  return "Improving";
}

function rrgGetView(bundle, tf, algo){
  const block = bundle?.data?.[tf]?.[algo];
  const meta = bundle?.data?.[tf]?.meta || {};
  const err  = bundle?.data?.[tf]?.error || null;
  const series = block?.series || [];
  return { series, meta, err };
}

function rrgBuildSeriesForChart(seriesIn){
  const out = [];
  for(const s of (seriesIn || [])){
    const trail = Array.isArray(s.trail) ? s.trail.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)) : [];
    const latest = (s.latest && Number.isFinite(s.latest.x) && Number.isFinite(s.latest.y)) ? s.latest : (trail.length ? trail[trail.length-1] : null);
    if(!latest) continue;
    out.push({
      name: s.name || s.symbol || "",
      symbol: s.symbol || "",
      trail,
      latest,
      quad: rrgQuadrant(latest.x, latest.y),
    });
  }
  out.sort((a,b)=> (b.latest.x - a.latest.x));
  return out;
}

function rrgAutoDomain(series){
  const xs = [];
  const ys = [];
  for(const s of series){
    for(const p of (s.trail || [])){
      xs.push(p.x); ys.push(p.y);
    }
    xs.push(s.latest.x); ys.push(s.latest.y);
  }
  if(xs.length < 1 || ys.length < 1){
    return { x:[80,120], y:[80,120] };
  }
  const lowX = Math.min(...xs), highX = Math.max(...xs);
  const lowY = Math.min(...ys), highY = Math.max(...ys);
  const dx = Math.max(Math.abs(highX - 100), Math.abs(100 - lowX));
  const dy = Math.max(Math.abs(highY - 100), Math.abs(100 - lowY));
  const pad = 0.10;
  const rx = Math.max(4, dx * (1+pad));
  const ry = Math.max(4, dy * (1+pad));
  return { x:[100-rx, 100+rx], y:[100-ry, 100+ry] };
}

function rrgRenderLegends(series){
  const stageEl = document.getElementById("rrgStageLegend");
  if(stageEl){
    const counts = {Leading:0, Improving:0, Weakening:0, Lagging:0};
    for(const s of series) counts[s.quad] = (counts[s.quad]||0) + 1;

    const stages = ["Leading","Improving","Weakening","Lagging"];
    stageEl.innerHTML = stages.map(st=>{
      const active = (__rrgState.stageFilter === st);
      const c = RRG_COLORS[st] || "#999";
      return `
        <button data-stage="${esc(st)}"
          style="display:inline-flex;align-items:center;gap:8px;border:1px solid ${RRG_THEME.border};border-radius:999px;padding:5px 11px;font-size:12px;background:${active?'#f1f5f9':'#fff'};color:${RRG_THEME.text};cursor:pointer;box-shadow:0 1px 0 rgba(15,23,42,0.05);">
          <span style="width:10px;height:10px;border-radius:999px;background:${c};display:inline-block;border:1px solid rgba(15,23,42,0.25);"></span>
          <span style="font-weight:700">${esc(st)}</span>
          <span style="color:#64748b">${counts[st]||0}</span>
        </button>
      `;
    }).join("") + ( __rrgState.stageFilter ? `<button id="rrgStageClear" style="border:none;background:transparent;color:#64748b;text-decoration:underline;cursor:pointer;font-size:12px;">Clear</button>` : "");

    stageEl.querySelectorAll("button[data-stage]").forEach(btn=>{
      btn.onclick = () => {
        const st = btn.getAttribute("data-stage");
        __rrgState.stageFilter = (__rrgState.stageFilter === st) ? null : st;
        renderRRG();
      };
    });
    const clr = document.getElementById("rrgStageClear");
    if(clr) clr.onclick = () => { __rrgState.stageFilter = null; renderRRG(); };
  }

  const el = document.getElementById("rrgLegend");
  if(!el) return;
  el.innerHTML = series.map(s=>{
    const active = (__rrgState.selected === s.name);
    const c = RRG_COLORS[s.quad] || "#999";
    return `
      <button data-name="${esc(s.name)}"
        style="display:inline-flex;align-items:center;gap:8px;border:1px solid ${RRG_THEME.border};border-radius:10px;padding:6px 10px;font-size:12px;background:${active?'#f1f5f9':'#fff'};color:${RRG_THEME.text};cursor:pointer;box-shadow:0 1px 0 rgba(15,23,42,0.05);">
        <span style="width:10px;height:10px;border-radius:3px;background:${c};display:inline-block;border:1px solid rgba(15,23,42,0.25);"></span>
        <span style="font-weight:700">${esc(s.name)}</span>
      </button>
    `;
  }).join("");

  el.querySelectorAll("button[data-name]").forEach(btn=>{
    btn.onclick = () => {
      const nm = btn.getAttribute("data-name");
      __rrgState.selected = (__rrgState.selected === nm) ? null : nm;
      renderRRG();
    };
  });
}

function rrgRenderTable(series, metaNote){
  const el = document.getElementById("rrgTable");
  if(!el) return;

  const rows = series.slice().sort((a,b)=> (b.latest.y - a.latest.y) || (b.latest.x - a.latest.x))
    .map(s=>{
      const x = Number.isFinite(s.latest.x) ? s.latest.x.toFixed(2) : "—";
      const y = Number.isFinite(s.latest.y) ? s.latest.y.toFixed(2) : "—";
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(s.name)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(s.symbol||"")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${x}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${y}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(s.quad)}</td>
      </tr>`;
    }).join("");

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
      <small>${esc(metaNote || "")}</small>
      ${__rrgState.selected ? `<small><strong>Selected:</strong> ${esc(__rrgState.selected)}</small>` : `<small style="color:#666;">Click a head point or legend to isolate</small>`}
    </div>
    <div style="overflow:auto;">
      <table style="border-collapse:collapse;width:100%;min-width:520px;font-size:12px;">
        <thead>
          <tr>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:6px 8px;">Sector</th>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:6px 8px;">Symbol</th>
            <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px 8px;">RS-Ratio</th>
            <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px 8px;">RS-Mom</th>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:6px 8px;">Quadrant</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="5" style="padding:8px;"><small>No RRG data for this view yet.</small></td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function renderRRG(){
  const canvas = document.getElementById("rrg");
  if(!canvas) return;

  const tfSel = document.getElementById("rrgTf");
  const algoSel = document.getElementById("rrgAlgo");
  const tailEl = document.getElementById("rrgTail");
  const tailV  = document.getElementById("rrgTailV");

  const tf = tfSel ? tfSel.value : __rrgState.tf;
  const algo = algoSel ? algoSel.value : __rrgState.algo;
  const tail = tailEl ? Number(tailEl.value) : __rrgState.tail;

  __rrgState.tf = tf;
  __rrgState.algo = algo;
  __rrgState.tail = tail;
  if(tailV) tailV.textContent = String(tail);

  const { series: raw, meta, err } = rrgGetView(__rrgBundle, tf, algo);

  if(err){
    const el = document.getElementById("rrgTable");
    if(el) el.innerHTML = `<small>RRG data error: <code>${esc(err)}</code></small>`;
  }

  let series = rrgBuildSeriesForChart(raw);

  if(__rrgState.stageFilter){
    series = series.filter(s => s.quad === __rrgState.stageFilter);
  }

  if(__rrgState.selected){
    series = series.filter(s => s.name === __rrgState.selected);
  }

  for(const s of series){
    const base = Array.isArray(s.trail) ? s.trail : [];
    const sliced = base.slice(-Math.max(5, Math.min(20, tail)));

    // Always ensure we have at least one visible point (the head).
    if(!sliced.length && s.latest){
      sliced.push(s.latest);
    }else if(sliced.length && s.latest && (s.latest.t !== sliced[sliced.length-1].t)){
      sliced.push(s.latest);
    }

    s.trail = sliced;
  }

  let dom = __rrgState.autoFit ? rrgAutoDomain(series) : (rrgChart ? {x:[rrgChart.options.scales.x.min, rrgChart.options.scales.x.max], y:[rrgChart.options.scales.y.min, rrgChart.options.scales.y.max]} : {x:[80,120], y:[80,120]});

  // Keep the 100/100 crosshair in view so we always see 4 quadrants.
  dom = {
    x: [Math.min(dom.x[0], 96), Math.max(dom.x[1], 104)],
    y: [Math.min(dom.y[0], 96), Math.max(dom.y[1], 104)],
  };


  const datasets = series.map(s=>{
    const color = RRG_COLORS[s.quad] || "#444";
    return {
      type: "line",
      label: s.name,
      parsing: false,
      data: (s.trail || []).map((p, idx)=>({
        x: p.x, y: p.y, t: p.t, name: s.name, symbol: s.symbol,
        __last: idx === (s.trail.length - 1)
      })),
      showLine: true,
      tension: 0.15,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointRadius: (ctx)=> {
        const n = ctx.dataset.data.length;
        return (ctx.dataIndex === n-1) ? 8 : 5;
      },
      pointHoverRadius: (ctx)=> {
        const n = ctx.dataset.data.length;
        return (ctx.dataIndex === n-1) ? 12 : 9;
      },
      pointBorderWidth: (ctx)=> {
        const n = ctx.dataset.data.length;
        return (ctx.dataIndex === n-1) ? 3 : 2;
      },
      pointBackgroundColor: (ctx)=> {
        const n = ctx.dataset.data.length;
        // Head point should match its quadrant color (filled).
        if(ctx.dataIndex === n-1) return color;
        // Tail points slightly translucent so trails are readable on white.
        return hexToRgba(color, 0.65);
      },
      pointBorderColor: (ctx)=> {
        // Dark outline so points never disappear on white.
        return RRG_THEME.tailBorder;
      },
    };
  });

  const pluginQuadrants = {
    id: "rrgQuadrantsFull",
    beforeDatasetsDraw(chart){
      const {ctx, chartArea, scales} = chart;
      if(!chartArea) return;
      const x100 = scales.x.getPixelForValue(100);
      const y100 = scales.y.getPixelForValue(100);

      ctx.save();
      ctx.beginPath();
      ctx.rect(chartArea.left, chartArea.top, chartArea.right-chartArea.left, chartArea.bottom-chartArea.top);
      ctx.clip();

      // Dark plot background (matches tilescreener reference behavior)
      ctx.fillStyle = RRG_THEME.plotBg;
      ctx.fillRect(chartArea.left, chartArea.top, chartArea.right-chartArea.left, chartArea.bottom-chartArea.top);

      const fill = (x0,y0,w,h,c)=>{ ctx.fillStyle=c; ctx.fillRect(x0,y0,w,h); };
      fill(chartArea.left, chartArea.top, x100-chartArea.left, y100-chartArea.top, "rgba(59,130,246,0.18)"); // Improving
      fill(x100, chartArea.top, chartArea.right-x100, y100-chartArea.top, "rgba(34,197,94,0.18)"); // Leading
      fill(x100, y100, chartArea.right-x100, chartArea.bottom-y100, "rgba(245,158,11,0.18)"); // Weakening
      fill(chartArea.left, y100, x100-chartArea.left, chartArea.bottom-y100, "rgba(239,68,68,0.18)"); // Lagging
      ctx.restore();
    },
    afterDraw(chart){
      const {ctx, chartArea, scales} = chart;
      if(!chartArea) return;
      const x100 = scales.x.getPixelForValue(100);
      const y100 = scales.y.getPixelForValue(100);

      ctx.save();
      ctx.setLineDash([4,4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = RRG_THEME.crosshair;
      ctx.beginPath();
      ctx.moveTo(x100, chartArea.top);
      ctx.lineTo(x100, chartArea.bottom);
      ctx.moveTo(chartArea.left, y100);
      ctx.lineTo(chartArea.right, y100);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = "700 14px system-ui,-apple-system,Segoe UI,Roboto";
      ctx.fillStyle = RRG_THEME.labelFill;
      ctx.strokeStyle = RRG_THEME.labelStroke;
      ctx.lineWidth = 3;

      function label(txt, x, y, align){
        ctx.textAlign = align || "left";
        ctx.strokeText(txt, x, y);
        ctx.fillText(txt, x, y);
      }
      label("Improving", chartArea.left + 10, chartArea.top + 18, "left");
      label("Leading",   chartArea.right - 10, chartArea.top + 18, "right");
      label("Lagging",   chartArea.left + 10, chartArea.bottom - 10, "left");
      label("Weakening", chartArea.right - 10, chartArea.bottom - 10, "right");
      ctx.restore();
    }
  };

  const pluginHeadLabels = {
    id: "rrgHeadLabels",
    afterDatasetsDraw(chart){
      const {ctx} = chart;
      ctx.save();
      ctx.font = "600 13px system-ui,-apple-system,Segoe UI,Roboto";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.lineWidth = 4;
      for(let i=0;i<chart.data.datasets.length;i++){
        const ds = chart.data.datasets[i];
        if(ds.hidden) continue;
        const data = ds.data || [];
        if(!data.length) continue;
        const meta = chart.getDatasetMeta(i);
        const el = meta.data?.[data.length-1];
        if(!el) continue;
        const x = el.x + 8;
        const y = el.y - 10;
        const txt = ds.label || "";
        if(__rrgState.selected && txt !== __rrgState.selected) continue;
        ctx.strokeText(txt, x, y);
        ctx.fillText(txt, x, y);
      }
      ctx.restore();
    }
  };

  if(rrgChart) rrgChart.destroy();

  rrgChart = new Chart(canvas, {
    type: "scatter",
    data: { datasets },
    options: {
      maintainAspectRatio: false,
      animation: false,
      interaction:{ mode:"nearest", intersect:true },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const p = ctx.raw || {};
              const nm = p.name || ctx.dataset.label || "";
              const x = Number.isFinite(p.x) ? p.x.toFixed(2) : "—";
              const y = Number.isFinite(p.y) ? p.y.toFixed(2) : "—";
              const q = rrgQuadrant(p.x, p.y);
              return `${nm}: ${x}, ${y} (${q})`;
            }
          }
        }
      },
      scales: {
        x: {
          type: "linear",
          title: {display:true, text:"RS-Ratio", color: RRG_THEME.text},
          ticks: { color: RRG_THEME.muted },
          grid: { color: RRG_THEME.grid },
          border: { color: RRG_THEME.border },
          min: dom.x[0],
          max: dom.x[1]
        },
        y: {
          type: "linear",
          title: {display:true, text:"RS-Momentum", color: RRG_THEME.text},
          ticks: { color: RRG_THEME.muted },
          grid: { color: RRG_THEME.grid },
          border: { color: RRG_THEME.border },
          min: dom.y[0],
          max: dom.y[1]
        }
      },
      onClick: (evt, elements, chart) => {
        const pts = chart.getElementsAtEventForMode(evt, "nearest", {intersect:true}, true);
        if(!pts.length) return;
        const hit = pts[0];
        const dsIndex = hit.datasetIndex;
        const ds = chart.data.datasets[dsIndex];
        // Only toggle when clicking the "head" (last point) to match the reference UX.
        if(hit.index !== (ds.data.length - 1)) return;
        const name = ds.label;
        __rrgState.selected = (__rrgState.selected === name) ? null : name;
        renderRRG();
      }
    },
    plugins: [pluginQuadrants, pluginHeadLabels]
  });

  canvas.onwheel = (e) => {
    e.preventDefault();
    if(!rrgChart) return;
    const zoomIn = e.deltaY < 0;
    const factor = zoomIn ? 0.9 : 1.1;
    const x0 = rrgChart.options.scales.x.min, x1 = rrgChart.options.scales.x.max;
    const y0 = rrgChart.options.scales.y.min, y1 = rrgChart.options.scales.y.max;
    const rx = Math.max(4, (x1 - x0) * factor);
    const ry = Math.max(4, (y1 - y0) * factor);
    rrgChart.options.scales.x.min = 100 - rx/2;
    rrgChart.options.scales.x.max = 100 + rx/2;
    rrgChart.options.scales.y.min = 100 - ry/2;
    rrgChart.options.scales.y.max = 100 + ry/2;
    __rrgState.autoFit = false;
    rrgChart.update("none");
  };

  const metaNote = `Updated: ${__rrgBundle?.at ? formatWhen(__rrgBundle.at) : "—"} • Bench: ${__rrgBundle?.bench || "—"} • TF: ${tf} • Algo: ${algo}`;
  rrgRenderLegends(rrgBuildSeriesForChart(raw));
  rrgRenderTable(rrgBuildSeriesForChart(raw), metaNote);
}

async function loadRRG(){
  try{
    __rrgBundle = await fetchJson(`data/rrg_sectors.json?ts=${Date.now()}`);
    if(!__rrgBundle || !__rrgBundle.data){
      const el = document.getElementById("rrgTable");
      if(el) el.innerHTML = `<small>RRG file found, but it looks like an older schema. Re-run the pipeline to regenerate <code>public/data/rrg_sectors.json</code>.</small>`;
      return;
    }
    renderRRG();
  }catch(e){
    const el = document.getElementById("rrgTable");
    if(el) el.innerHTML = `<small>RRG data not found yet. Expected <code>public/data/rrg_sectors.json</code>. Run the pipeline once.</small>`;
  }
}

// Wire controls (safe even if elements absent)
(function initRrgControls(){
  const rrgBtn = document.getElementById("rrgReload");
  if(rrgBtn) rrgBtn.onclick = () => loadRRG();

  const tfSel = document.getElementById("rrgTf");
  if(tfSel) tfSel.onchange = () => renderRRG();

  const algoSel = document.getElementById("rrgAlgo");
  if(algoSel) algoSel.onchange = () => renderRRG();

  const tailEl = document.getElementById("rrgTail");
  const tailV  = document.getElementById("rrgTailV");
  if(tailEl){
    tailEl.oninput = () => {
      if(tailV) tailV.textContent = String(tailEl.value);
      renderRRG();
    };
  }

  const fitBtn = document.getElementById("rrgFit");
  if(fitBtn) fitBtn.onclick = () => { __rrgState.autoFit = true; renderRRG(); };

  const resetBtn = document.getElementById("rrgReset");
  if(resetBtn) resetBtn.onclick = () => {
    __rrgState.autoFit = false;
    if(rrgChart){
      rrgChart.options.scales.x.min = 80;
      rrgChart.options.scales.x.max = 120;
      rrgChart.options.scales.y.min = 80;
      rrgChart.options.scales.y.max = 120;
      rrgChart.update("none");
    }else{
      renderRRG();
    }
  };
})();



load();