
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

function faStrength(data){
  const V = num(data["Value Score"]);
  const Q = num(data["Quality Score"]);
  const R = num(data["Risk Score"]);
  let base = NaN;
  if(Number.isFinite(V) && Number.isFinite(Q) && Number.isFinite(R)){
    base = 0.45*V + 0.30*Q + 0.25*R;
  }else{
    base = num(data["Screener Score"]);
  }
  return rating5FromScore(base);
}

function taStrength(data){
  const rsi = num(data["RSI14"]);
  const mdd = num(data["Max Drawdown (1y)"]);
  const atr = num(data["ATR% (14)"]);
  if(!Number.isFinite(rsi)) return null;

  let score = 50 + (rsi - 50) * 1.6;
  if(Number.isFinite(mdd)){
    if(mdd > -0.20) score += 12;
    else if(mdd > -0.35) score += 5;
    else if(mdd < -0.60) score -= 10;
    else if(mdd < -0.45) score -= 5;
  }
  if(Number.isFinite(atr)){
    if(atr > 0.12) score -= 10;
    else if(atr > 0.08) score -= 5;
  }
  score = Math.max(0, Math.min(100, score));
  return rating5FromScore(score);
}

function pillHTML(r){
  if(!r) return '<span style="color:#888;">—</span>';
  return `<span class="pill ${r.k}"><span class="pillDot"></span>${r.label}</span>`;
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
  const el = document.getElementById("scoreDetailsBody");
  const hint = document.getElementById("scoreDetailsHint");
  const drawer = document.getElementById("detailDrawer");
  if(!el) return;

  const score = num(d["Screener Score"]);
  const v = num(d["Value Score"]);
  const q = num(d["Quality Score"]);
  const r = num(d["Risk Score"]);

  let liq = num(d["Liquidity Bonus"]);
  // Fallback if Liquidity Bonus not provided by dataset yet.
  if(!Number.isFinite(liq)){
    const dv = num(d["Avg $Vol 20d"]);
    if(Number.isFinite(dv)){
      const dvs = (filteredNow.length ? filteredNow : raw)
        .map(x => num(x["Avg $Vol 20d"]))
        .filter(Number.isFinite)
        .sort((a,b)=>a-b);
      if(dvs.length){
        const idx = dvs.findIndex(x => x >= dv);
        const pr = idx >= 0 ? (idx / (dvs.length-1 || 1)) : 1.0;
        liq = pr * 10.0;
      }
    }
  }

  const parts = [
    {name:"Value", score:v, weight:0.45},
    {name:"Quality", score:q, weight:0.30},
    {name:"Risk", score:r, weight:0.25},
  ];
  const bw = pickBestWorst(parts);
  const bestTag = bw.best ? `${bw.best.name}-led` : "";
  const worstTag = bw.worst ? `Weakest: ${bw.worst.name}` : "";

  const pred =
    (Number.isFinite(v)?0.45*v:0) +
    (Number.isFinite(q)?0.30*q:0) +
    (Number.isFinite(r)?0.25*r:0) +
    (Number.isFinite(liq)?liq:0);
  const delta = Number.isFinite(score) ? (score - pred) : NaN;

  const company = String(d["Company"]||"");
  const ticker = String(d["Ticker"]||"");
  const sector = String(d["Sector"]||"");
  const price = num(d["Price"]);
  const mcap = num(d["Market Cap"]);
  const bvps = num(d["Book Value / Share (Assets-Liab)"]);
  const pb = num(d["P/B"]);
  const fcfy = num(d["FCF Yield"]);
  const dcfdisc = num(d["DCF Premium/(Discount)"]);

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
      <div>
        <div style="font-size:18px;font-weight:800;">${ticker} <small style="font-weight:500;color:#666;">${company}</small></div>
        <div><small>${sector}</small></div>
        <div class="badges">
          ${bestTag ? `<span class="badge">${bestTag}</span>` : ""}
          ${worstTag ? `<span class="badge">${worstTag}</span>` : ""}
          ${Number.isFinite(score) ? `<span class="badge">Score: ${score.toFixed(2)} / 100</span>` : `<span class="badge">Score: –</span>`}
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
        ${barRow("Value (45%)", v, 100)}
        ${barRow("Quality (30%)", q, 100)}
        ${barRow("Risk (25%)", r, 100)}
        ${barRow("Liquidity bonus (+0 to +10)", liq, 10)}
      </div>
      <div>
        <div class="card">
          <strong>How the score is formed</strong>
          <div style="margin-top:6px;">
            <small>Screener Score is a composite (0–100) built at refresh time — the UI does not recompute it.<br><br><strong>1) Component scores (each 0–100)</strong><br><strong>Value (45%)</strong>: percentile ranks of <em>DCF discount</em>, <em>FCF yield</em>, <em>MOS upside</em> (from MOS Buy Price vs Price), and <em>low P/B</em>.<br><strong>Quality (30%)</strong>: percentile ranks of <em>ROE</em>, <em>profit margin</em>, and <em>low net debt/EBITDA</em>.<br><strong>Risk (25%)</strong>: percentile ranks favoring <em>lower volatility (Vol 20d)</em>, <em>lower ATR%</em>, and <em>smaller drawdowns</em>.<br><br><strong>2) Missing data handling</strong><br>If Value/Quality/Risk inputs are missing, weights are re-normalized across available components and a small completeness penalty may apply (depending on your pipeline version).<br><br><strong>3) Liquidity Bonus (0–10)</strong><br>Avg $Vol 20d ≈ mean over ~20 trading days of (Close × Volume) in AUD.<br>LiquidityBonus = 10 × percentile_rank(Avg $Vol 20d) across the ASX universe (0=least liquid, 10=most liquid). Missing liquidity → bonus 0. Note: “–” means missing/unavailable data; it is not the same as 0.</small>
          </div>
          <div style="margin-top:10px;">
            <small>
              Computed: ${Number.isFinite(pred)?pred.toFixed(2):"–"} •
              Reported: ${Number.isFinite(score)?score.toFixed(2):"–"} •
              Δ: ${Number.isFinite(delta)?delta.toFixed(2):"–"} (rounding/clip differences)
            </small>
          </div>
        </div>
      </div>
    </div>
  `;

  if(hint) hint.textContent = "";
  openDrawer();
}


let raw = [];
let filteredNow = [];
let table = null;
let scatterChart = null;
let histChart = null;
let vqChart = null;
let divChart = null;

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
  const xEl = document.getElementById("divXMax");
  const yEl = document.getElementById("divYMax");
  const xMax = xEl ? num(xEl.value) : fx;
  const yMax = yEl ? num(yEl.value) : fy;
  return {xMax: Number.isFinite(xMax) ? xMax : fx, yMax: Number.isFinite(yMax) ? yMax : fy};
}

function wireDividendAxisControls(){
  const xEl = document.getElementById("divXMax");
  const yEl = document.getElementById("divYMax");
  const rEl = document.getElementById("divReset");

  const setLabels = ()=>{
    const x = xEl ? num(xEl.value) : NaN;
    const y = yEl ? num(yEl.value) : NaN;
    if(Number.isFinite(x)) setText("divXMaxV", Math.round(x*100) + "%");
    if(Number.isFinite(y)) setText("divYMaxV", Math.round(y*100) + "%");
  };
  const apply = ()=>{
    setLabels();
    window.__divUserSet = true;
    if(divChart){
      const win = getDivWindow(window.__divDefaults || {xMax:0.15,yMax:2.0});
      divChart.options.scales.x.min = 0;
      divChart.options.scales.x.max = win.xMax;
      divChart.options.scales.y.min = 0;
      divChart.options.scales.y.max = win.yMax;
      divChart.update("none");
    }else{
      rebuildCharts(filteredNow || raw || []);
    }
  };

  if(xEl) xEl.addEventListener("input", apply);
  if(yEl) yEl.addEventListener("input", apply);

  if(rEl){
    rEl.addEventListener("click", ()=>{
      window.__divUserSet = false;
      const d = window.__divDefaults || {xMax:0.15, yMax:2.0};
      if(xEl) xEl.value = d.xMax;
      if(yEl) yEl.value = d.yMax;
      apply();
    });
  }

  setLabels();
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





function wireTableView(){
  const sel = document.getElementById("tableView");
  if(!sel || !table) return;

  const coreFields = [
    "Ticker","Company","Sector",
    "__FA_Strength","__TA_Strength",
    "Screener Score","Price","Market Cap"
  ];

  const fundamentals = coreFields.concat([
    "DCF Premium/(Discount)","FCF Yield","Undervalued Methods Count",
    "Value Score","Quality Score","Risk Score",
    "Book Value / Share (Assets-Liab)","Net Debt/EBITDA","Avg $Vol 20d",
    "Held % Insiders","Held % Institutions",
  ]);

  const technicals = coreFields.concat([
    "RSI14","ATR% (14)","Vol (20d, ann)","Max Drawdown (1y)"
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

  function setView(fields){
    const set = new Set(fields);
    table.getColumns().forEach(col=>{
      const f = col.getField && col.getField();
      if(!f) return;
      col.setVisible(set.has(f));
    });
    safeRedraw();
  }

  function applyView(v){
    if(v==="basic") setView(coreFields);
    else if(v==="fundamentals") setView(fundamentals);
    else if(v==="technicals") setView(technicals);
    else if(v==="valuation_prices") setView(valPrices);
    else if(v==="valuation_discounts") setView(valDiscs);
    else if(v==="dividends") setView(dividends);
    else if(v==="ownership") setView(ownership);
    else if(v==="all"){
      table.getColumns().forEach(c=>{ try{ c.show(); }catch(_){ } });
      safeRedraw();
    }

    // Apply optional column control checkboxes on top of the selected view
    try{ if(window.__asxColRefresh) window.__asxColRefresh(); }catch(_){}
    safeRedraw();
  }

  sel.addEventListener("change", ()=>applyView(sel.value));
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
  setText("kpiScore", fmt2(median(rows.map(r => num(r["Screener Score"])))));
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
      {title:"FA Strength", field:"__FA_Strength", headerTooltip:"Fundamental strength rating (Very Weak → Very Strong). Derived from Value/Quality/Risk base score (45/30/25). Falls back to Screener Score if components missing.", formatter:(c)=>pillHTML(faStrength(c.getRow().getData()||{})), download:false},
      {title:"TA Strength", field:"__TA_Strength", headerTooltip:"Technical strength rating (Very Weak → Very Strong). Heuristic from RSI14 (momentum), Max Drawdown (1y) (stability), and ATR% (noise).", formatter:(c)=>pillHTML(taStrength(c.getRow().getData()||{})), download:false},

      {title:"Score", field:"Screener Score",  headerTooltip:'Screener Score (0–100). Base score is built from three component scores (each 0–100, percentile-rank based): Value (45%), Quality (30%), Risk (25). If a component is missing (NaN), weights are re-normalized across the remaining components and a small completeness penalty (up to 10 pts) is applied. Liquidity Bonus (0–10) is added on top and is purely a tradability boost: Avg $Vol 20d = average over ~20 trading days of (Close × Volume) in AUD; LiquidityBonus = 10 × percentile_rank(Avg $Vol 20d) across the universe (0=least liquid, 10=most liquid). Missing liquidity → bonus 0. Note: “–” means missing/unavailable data; it is not the same as 0.', formatter:(c)=>fmt2(num(c.getValue()))},
      {title:"Value", field:"Value Score", headerTooltip:'Value Score (0–100): percentile composite of DCF discount, FCF yield, MOS upside, and low P/B.', formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"Quality", field:"Quality Score", headerTooltip:'Quality Score (0–100): percentile composite of ROE, profit margin, and low net debt/EBITDA.', formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"Risk", field:"Risk Score", headerTooltip:'Risk Score (0–100): percentile composite favoring lower vol, lower ATR%, and smaller drawdowns.', formatter:(c)=>fmt2(num(c.getValue())), visible:false},

      {title:"Price", field:"Price", formatter:(c)=>fmt2(num(c.getValue()))},
      {title:"Mkt Cap", field:"Market Cap", formatter:(c)=>fmtInt(num(c.getValue()))},

      {title:"DCF Disc", field:"DCF Premium/(Discount)", formatter:(c)=>pct(num(c.getValue()))},
      {title:"FCF Yield", field:"FCF Yield", formatter:(c)=>pct(num(c.getValue()))},
      {title:"Undervalued Count", field:"Undervalued Methods Count", width:160, headerTooltip:"Count of methods where (Intrinsic - Price)/Price > 0. Counted: DCF, Residual Income, Asset Based, SOTP, Dividend Discount. Enable valuation columns for each method.", formatter:(c)=>{const v=num(c.getValue()); return Number.isFinite(v)?String(Math.round(v)):"";}},

      {title:"DCF $", field:"DCF Price (5yr)", headerTooltip:"DCF intrinsic price estimate (5yr model).", formatter:(c)=>fmt2(num(c.getValue())), visible:false},

      {title:"RI Disc", field:"Residual Income Premium/(Discount)", headerTooltip:"Residual Income premium/(discount): (Intrinsic - Price)/Price.", formatter:(c)=>pct(num(c.getValue())), visible:false},
      {title:"Asset Disc", field:"Asset Based Premium/(Discount)", headerTooltip:"Asset-based premium/(discount): (Intrinsic - Price)/Price.", formatter:(c)=>pct(num(c.getValue())), visible:false},
      {title:"SOTP Disc", field:"SOTP Premium/(Discount)", headerTooltip:"Sum-of-the-parts premium/(discount): (Intrinsic - Price)/Price.", formatter:(c)=>pct(num(c.getValue())), visible:false},
      {title:"DDM Disc", field:"Dividend Discount Premium/(Discount)", headerTooltip:"Dividend Discount premium/(discount): (Intrinsic - Price)/Price.", formatter:(c)=>pct(num(c.getValue())), visible:false},
      {title:"EPV Disc", field:"EPV Premium/(Discount)", headerTooltip:"Earnings Power Value premium/(discount): (Intrinsic - Price)/Price.", formatter:(c)=>pct(num(c.getValue())), visible:false},
      {title:"Opt Disc", field:"Option Pricing Premium/(Discount)", headerTooltip:"Option-pricing premium/(discount): (Intrinsic - Price)/Price.", formatter:(c)=>pct(num(c.getValue())), visible:false},

      {title:"RI $", field:"Residual Income Price", headerTooltip:"Residual Income intrinsic price estimate.", formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"Asset $", field:"Asset Based Price", headerTooltip:"Asset-based intrinsic price estimate.", formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"SOTP $", field:"SOTP Price", headerTooltip:"Sum-of-the-parts intrinsic price estimate.", formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"DDM $", field:"Dividend Discount Price", headerTooltip:"Dividend Discount Model intrinsic price estimate.", formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"EPV $", field:"Earnings Power Value (EPV) Price", headerTooltip:"EPV intrinsic price estimate.", formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"Opt $", field:"Option Pricing Value", headerTooltip:"Option-pricing intrinsic value estimate.", formatter:(c)=>fmt2(num(c.getValue())), visible:false},

      {title:"MOS Buy $", field:"MOS Buy Price", headerTooltip:"Margin-of-safety buy price = DCF price × (1 - MOS).", formatter:(c)=>fmt2(num(c.getValue())), visible:false},
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

      {title:"RSI14", field:"RSI14", formatter:(c)=>fmt2(num(c.getValue()))},
      {title:"ATR%", field:"ATR% (14)", formatter:(c)=>pct(num(c.getValue()))},
      {title:"Vol20", field:"Vol (20d, ann)", formatter:(c)=>pct(num(c.getValue()))},
      {title:"MDD", field:"Max Drawdown (1y)", formatter:(c)=>pct(num(c.getValue()))},

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

  let lastClickedKey = null;

  table.on("rowClick", function(e, row){
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
    const el = row.getElement();
    if(el) el.classList.add("asx-row-active");
    window.__asxActiveKey = key || null;
    window.__asxActiveRowEl = el || null;

    openDrawer();
    if(hint) hint.textContent = key ? `Selected: ${key}` : "Selected stock";
    try{ renderScoreDetails(d); }catch(err){ console.error(err); }

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
      scales:{
        x:{
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
    }
  }catch(e){ console.warn("Dividend chart error", e); }

}

load();