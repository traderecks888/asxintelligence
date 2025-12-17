function median(arr){
  const a = arr.filter(x => Number.isFinite(x)).sort((x,y)=>x-y);
  if(!a.length) return NaN;
  const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2;
}
function pct(x){ return Number.isFinite(x) ? (x*100).toFixed(1) + "%" : "–"; }
function fmt2(x){ return Number.isFinite(x) ? x.toFixed(2) : "–"; }
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

function pickBestWorst(parts){
  const finite = parts.filter(p => Number.isFinite(p.score));
  if(!finite.length) return {best:null, worst:null};
  const best = finite.reduce((a,b)=> (b.score>a.score)?b:a);
  const worst = finite.reduce((a,b)=> (b.score<a.score)?b:a);
  return {best, worst};
}

function renderScoreDetails(d){
  const el = document.getElementById("scoreDetailsBody");
  const hint = document.getElementById("scoreDetailsHint");
  const det = document.getElementById("scoreDetails");
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
            <small>Screener Score is a composite (0–100).<br>Base score uses component scores (0–100): Value (45%), Quality (30%), Risk (25%).<br>If a component is missing (NaN), weights are re-normalized across what exists and a small completeness penalty (up to 10 pts) is applied.<br><br><strong>Liquidity Bonus (0–10)</strong><br>Avg $Vol 20d ≈ mean over ~20 trading days of (Close × Volume) in AUD.<br>LiquidityBonus = 10 × percentile_rank(Avg $Vol 20d) across the ASX universe (0=least liquid, 10=most liquid).<br>Missing liquidity → bonus 0.<br></small>
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
  if(det) det.open = true;
}


let raw = [];
let filteredNow = [];
let table = null;
let scatterChart = null;
let histChart = null;

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
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
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

    bootUI(raw);
    setMeta(m ? `Last update: ${when} • Rows: ${m.rows}` : `Loaded • Rows: ${raw.length}`);
  }catch(err){
    console.error(err);
    setMeta("Error loading dataset");
    showErr(
      `<strong>Could not load data.</strong><br>` +
      `Open <code>/data/latest_web.json</code> to confirm it exists, then hard-refresh.<br>` +
      `<small>${String(err).replaceAll("<","&lt;").replaceAll(">","&gt;")}</small>`
    );
  }
}

function bootUI(rows){
  const sectors = Array.from(new Set(rows.map(r => r["Sector"]).filter(Boolean))).sort();
  const sel = document.getElementById("sector");
  if(sel) sel.innerHTML = `<option value="">All sectors</option>` + sectors.map(s=>`<option>${s}</option>`).join("");

  document.getElementById("kpiRows").textContent = rows.length.toLocaleString();
  document.getElementById("kpiDCF").textContent = pct(median(rows.map(r => num(r["DCF Premium/(Discount)"]))));
  document.getElementById("kpiFCF").textContent = pct(median(rows.map(r => num(r["FCF Yield"]))));
  document.getElementById("kpiScore").textContent = fmt2(median(rows.map(r => num(r["Screener Score"]))));

  table = new Tabulator("#table", {
    data: rows,
    height: "650px",
    layout: "fitColumns",
    pagination: true,
    paginationSize: 50,
    movableColumns: true,
    rowTooltip: function(e, row){
  const d = row.getData();
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
      {title:"Ticker", field:"Ticker", width:90, headerFilter:true},
      {title:"Company", field:"Company", minWidth:220, headerFilter:true},
      {title:"Sector", field:"Sector", width:160, headerFilter:true},

      {title:"Score", field:"Screener Score", headerTooltip:'Screener Score (0–100). Base score is built from three component scores (each 0–100, percentile-rank based): Value (45%), Quality (30%), Risk (25). If a component is missing (NaN), weights are re-normalized across the remaining components and a small completeness penalty (up to 10 pts) is applied. Liquidity Bonus (0–10) is added on top and is purely a tradability boost: Avg $Vol 20d = average over ~20 trading days of (Close × Volume) in AUD; LiquidityBonus = 10 × percentile_rank(Avg $Vol 20d) across the universe (0=least liquid, 10=most liquid). Missing liquidity → bonus 0.', formatter:(c)=>fmt2(num(c.getValue()))},
      {title:"Value", field:"Value Score", headerTooltip:'Value Score (0–100): percentile composite of DCF discount, FCF yield, MOS upside, and low P/B.', formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"Quality", field:"Quality Score", headerTooltip:'Quality Score (0–100): percentile composite of ROE, profit margin, and low net debt/EBITDA.', formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"Risk", field:"Risk Score", headerTooltip:'Risk Score (0–100): percentile composite favoring lower vol, lower ATR%, and smaller drawdowns.', formatter:(c)=>fmt2(num(c.getValue())), visible:false},

      {title:"Price", field:"Price", formatter:(c)=>fmt2(num(c.getValue()))},
      {title:"Mkt Cap", field:"Market Cap", formatter:(c)=>fmtInt(num(c.getValue()))},

      {title:"DCF Disc", field:"DCF Premium/(Discount)", formatter:(c)=>pct(num(c.getValue()))},
      {title:"FCF Yield", field:"FCF Yield", formatter:(c)=>pct(num(c.getValue()))},
      {title:"U Count", field:"Undervalued Methods Count"},

      {title:"Book Value", field:"Book Value (Total, Assets-Liab)", formatter:(c)=>fmtInt(num(c.getValue())), visible:false},
      {title:"BV/Share", field:"Book Value / Share (Assets-Liab)", formatter:(c)=>fmt2(num(c.getValue()))},

      {title:"Div/Share", field:"Last Dividend / Share", formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"Div Yld Ann", field:"Dividend Yield (Announced)", formatter:(c)=>pct(num(c.getValue())), visible:false},
      {title:"Div Yld Now", field:"Dividend Yield (Current)", formatter:(c)=>pct(num(c.getValue())), visible:false},
      {title:"Div Yld Δ%", field:"Dividend Yield Δ%", formatter:(c)=>pct(num(c.getValue())), visible:false},
      {title:"Held% Ins", field:"Held % Insiders", formatter:(c)=>pct(num(c.getValue())), visible:false},
      {title:"Held% Inst", field:"Held % Institutions", formatter:(c)=>pct(num(c.getValue())), visible:false},

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

  wireSliders();
  rebuildCharts(rows);

  // Click a row to see full score breakdown without cluttering the table.
  table.on("rowClick", function(e, row){
    try{ renderScoreDetails(row.getData()); }catch(err){ console.error(err); }
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

  const histCtx = document.getElementById("hist");
  if(histChart) histChart.destroy();
  histChart = new Chart(histCtx, {
    type:"bar",
    data:{ labels: bins.map(String), datasets:[{label:"Count", data: freq}]},
    options:{ plugins:{legend:{display:false}}, scales:{x:{title:{display:true,text:"Undervalued methods count"}}, y:{title:{display:true,text:"Number of stocks"}}}}
  });
}

load();
