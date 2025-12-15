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
let table = null;
let scatterChart = null;
let histChart = null;

async function load(){
  const m = await fetch("/data/manifest.json", {cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);
  document.getElementById("meta").textContent = m
    ? `Last update: ${m.generated_at_local} • Rows: ${m.rows}`
    : `manifest.json not found (run the GitHub Action once)`;

  raw = await fetch("/data/latest.json", {cache:"no-store"}).then(r=>r.json());
  bootUI(raw);
}

function bootUI(rows){
  const sectors = Array.from(new Set(rows.map(r => r["Sector"]).filter(Boolean))).sort();
  const sel = document.getElementById("sector");
  sel.innerHTML = `<option value="">All sectors</option>` + sectors.map(s=>`<option>${s}</option>`).join("");

  document.getElementById("kpiRows").textContent = rows.length.toLocaleString();
  document.getElementById("kpiDCF").textContent = pct(median(rows.map(r => r["DCF Premium/(Discount)"])));
  document.getElementById("kpiFCF").textContent = pct(median(rows.map(r => r["FCF Yield"])));
  document.getElementById("kpiUC").textContent = fmt2(median(rows.map(r => r["Undervalued Methods Count"])));

  table = new Tabulator("#table", {
    data: rows,
    height: "650px",
    layout: "fitColumns",
    pagination: true,
    paginationSize: 50,
    movableColumns: true,
    initialSort: [
      {column:"Undervalued Methods Count", dir:"desc"},
      {column:"DCF Premium/(Discount)", dir:"desc"},
      {column:"FCF Yield", dir:"desc"},
    ],
    columns: [
      {title:"Ticker", field:"Ticker", width:90, headerFilter:true},
      {title:"Company", field:"Company", minWidth:220, headerFilter:true},
      {title:"Sector", field:"Sector", width:160, headerFilter:true},

      {title:"Price", field:"Price", formatter:(c)=>fmt2(c.getValue())},
      {title:"Mkt Cap", field:"Market Cap", formatter:(c)=>fmtInt(c.getValue())},

      {title:"DCF", field:"DCF Price (5yr)", formatter:(c)=>fmt2(c.getValue())},
      {title:"DCF Disc", field:"DCF Premium/(Discount)", formatter:(c)=>pct(c.getValue())},
      {title:"FCF Yield", field:"FCF Yield", formatter:(c)=>pct(c.getValue())},
      {title:"U Count", field:"Undervalued Methods Count"},

      {title:"RSI14", field:"RSI14", formatter:(c)=>fmt2(c.getValue())},
      {title:"ATR%", field:"ATR% (14)", formatter:(c)=>pct(c.getValue())},
      {title:"Vol20", field:"Vol (20d, ann)", formatter:(c)=>pct(c.getValue())},
      {title:"MDD", field:"Max Drawdown (1y)", formatter:(c)=>pct(c.getValue())},

      {title:"% from 52W High", field:"% From 52W High", formatter:(c)=>pct(c.getValue()), visible:false},
      {title:"% from 52W Low", field:"% From 52W Low", formatter:(c)=>pct(c.getValue()), visible:falseTitle:false, visible:false},
      {title:"Ret 3m", field:"Return 3m", formatter:(c)=>pct(c.getValue()), visible:false},
      {title:"Ret 12m", field:"Return 12m", formatter:(c)=>pct(c.getValue()), visible:false},

      {title:"ROE", field:"ROE", formatter:(c)=>pct(c.getValue()), visible:false},
      {title:"P/B", field:"P/B", formatter:(c)=>fmt2(c.getValue()), visible:false},
      {title:"NetDebt/EBITDA", field:"Net Debt/EBITDA", formatter:(c)=>fmt2(c.getValue()), visible:false},
      {title:"Beta", field:"Beta vs Benchmark (1y)", formatter:(c)=>fmt2(c.getValue()), visible:false},

      {title:"Data Q", field:"Data Quality Score", formatter:(c)=>fmt2(c.getValue()), visible:false},
    ],
  });

  rebuildCharts(rows);

  document.getElementById("apply").onclick = applyFilters;
  document.getElementById("reset").onclick = () => {
    document.getElementById("q").value = "";
    document.getElementById("sector").value = "";
    document.getElementById("minMcap").value = "";
    document.getElementById("minFcf").value = "";
    document.getElementById("minU").value = "";
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
  const minMcap = Number(document.getElementById("minMcap").value);
  const minFcf  = Number(document.getElementById("minFcf").value);
  const minU    = Number(document.getElementById("minU").value);

  const filtered = raw.filter(r => {
    if(q){
      const t = String(r["Ticker"]||"").toLowerCase();
      const c = String(r["Company"]||"").toLowerCase();
      if(!t.includes(q) && !c.includes(q)) return false;
    }
    if(sector && r["Sector"] !== sector) return false;
    if(Number.isFinite(minMcap) && Number.isFinite(r["Market Cap"]) && r["Market Cap"] < minMcap) return false;
    if(Number.isFinite(minFcf) && Number.isFinite(r["FCF Yield"]) && r["FCF Yield"] < minFcf) return false;
    if(Number.isFinite(minU) && Number.isFinite(r["Undervalued Methods Count"]) && r["Undervalued Methods Count"] < minU) return false;
    return true;
  });

  table.setData(filtered);
  rebuildCharts(filtered);
}

function rebuildCharts(rows){
  const pts = rows
    .map(r => ({
      x: r["DCF Premium/(Discount)"],
      y: r["FCF Yield"],
      r: Math.max(2, Math.min(16, (Number(r["Market Cap"])||0) / 5e10 * 16)),
      label: r["Ticker"]
    }))
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

  const scatterCtx = document.getElementById("scatter");
  if(scatterChart) scatterChart.destroy();
  scatterChart = new Chart(scatterCtx, {
    type: "bubble",
    data: { datasets: [{ label: "Stocks", data: pts }]},
    options: {
      parsing:false,
      plugins:{ tooltip:{
        callbacks:{
          label:(ctx)=> `${ctx.raw.label}: DCF ${pct(ctx.raw.x)} • FCF ${pct(ctx.raw.y)}`
        }
      }},
      scales:{
        x:{ title:{display:true,text:"DCF premium/(discount)"} },
        y:{ title:{display:true,text:"FCF yield"} }
      }
    }
  });

  const counts = rows.map(r => r["Undervalued Methods Count"]).filter(Number.isFinite);
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
