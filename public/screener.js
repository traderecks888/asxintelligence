function median(arr){
  const a = arr.filter(x => Number.isFinite(x)).sort((x,y)=>x-y);
  if(!a.length) return NaN;
  const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2;
}
function pct(x){ return Number.isFinite(x) ? (x*100).toFixed(1) + "%" : "–"; }
function fmt2(x){ return Number.isFinite(x) ? x.toFixed(2) : "–"; }
function fmtInt(x){ return Number.isFinite(x) ? Math.round(x).toLocaleString() : "–"; }

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

      {title:"Score", field:"Screener Score", headerTooltip:'Screener Score (0–100). Computed from percentile ranks across the current ASX universe: Score = 0.45·Value + 0.30·Quality + 0.25·Risk + LiquidityBonus (0–10). Value: 40% DCF discount rank + 30% FCF yield rank + 20% MOS upside rank + 10% (low P/B) rank. Quality: 55% ROE rank + 30% profit margin rank + 15% (low net debt/EBITDA) rank. Risk: 45% (low vol20) rank + 25% (low ATR%) rank + 30% drawdown rank (less negative is better). Scores are relative and will shift each refresh.', formatter:(c)=>fmt2(num(c.getValue()))},
      {title:"Value", field:"Value Score", headerTooltip:'Value Score (0–100): percentile-based composite of DCF discount, FCF yield, MOS upside, and low P/B.', formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"Quality", field:"Quality Score", headerTooltip:'Quality Score (0–100): percentile-based composite of ROE, profit margin, and low net debt/EBITDA.', formatter:(c)=>fmt2(num(c.getValue())), visible:false},
      {title:"Risk", field:"Risk Score", headerTooltip:'Risk Score (0–100): percentile-based composite favoring lower vol, lower ATR%, and smaller drawdowns.', formatter:(c)=>fmt2(num(c.getValue())), visible:false},

      {title:"Price", field:"Price", formatter:(c)=>fmt2(num(c.getValue()))},
      {title:"Mkt Cap", field:"Market Cap", formatter:(c)=>fmtInt(num(c.getValue()))},

      {title:"DCF Disc", field:"DCF Premium/(Discount)", formatter:(c)=>pct(num(c.getValue()))},
      {title:"FCF Yield", field:"FCF Yield", formatter:(c)=>pct(num(c.getValue()))},
      {title:"U Count", field:"Undervalued Methods Count"},

      {title:"Book Value", field:"Book Value (Total, Assets-Liab)", formatter:(c)=>fmtInt(num(c.getValue())), visible:false},
      {title:"BV/Share", field:"Book Value / Share (Assets-Liab)", formatter:(c)=>fmt2(num(c.getValue()))},
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
