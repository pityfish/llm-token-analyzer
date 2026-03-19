const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const LOG_DIR = path.join(os.homedir(), '.token_usage');
const LOG_FILE = path.join(LOG_DIR, 'token_usage.jsonl');
const REPORT_FILE = path.join(LOG_DIR, 'usage_report.html');

function generateHtmlReport() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log('No usage data found.');
    return;
  }

  const lines = fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n');
  const allRecords = lines.map(line => JSON.parse(line));

  const sessionModelMap = new Map();
  allRecords.forEach(r => {
    const sid = r.sessionId || r.session_id;
    const model = r.model;
    const lut = r.sessionLastUpdated || r.lastUpdated || r.last_updated;
    const key = `${sid}_${model}`;
    const existing = sessionModelMap.get(key);
    if (!existing || new Date(lut) > new Date(existing.sessionLastUpdated || existing.lastUpdated || existing.last_updated)) {
      sessionModelMap.set(key, r);
    }
  });

  const records = Array.from(sessionModelMap.values()).map(r => {
    const dateObj = new Date(r.sessionLastUpdated || r.lastUpdated || r.last_updated);
    return {
      ...r,
      day: (r.sessionLastUpdated || r.lastUpdated || r.last_updated).split('T')[0],
      month: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`,
      tokens: r.totalTokens || r.total_tokens || 0,
      cached: r.cachedTokens || r.cached_tokens || 0
    };
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>LLM Token Master V6.2</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: -apple-system, "SF Pro Display", sans-serif; padding: 25px; background: #f5f5f7; color: #1d1d1f; }
        .container { max-width: 1400px; margin: 0 auto; position: relative; }
        .card { background: white; padding: 25px; border-radius: 18px; box-shadow: 0 8px 30px rgba(0,0,0,0.04); margin-bottom: 25px; border: 1px solid #eee; }
        .navbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; background: white; padding: 15px 30px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }
        .tab-group { display: flex; background: #f0f0f2; padding: 3px; border-radius: 10px; }
        .tab { border: none; padding: 6px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; background: transparent; color: #86868b; }
        .tab.active { background: white; color: #1d1d1f; box-shadow: 0 2px 6px rgba(0,0,0,0.1); font-weight: 600; }
        .range-picker { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #86868b; }
        select { padding: 5px 10px; border-radius: 6px; border: 1px solid #ddd; background: white; font-size: 12px; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 25px; }
        .stat-card { background: white; padding: 20px; border-radius: 16px; text-align: center; border: 1px solid #eee; }
        .stat-value { font-size: 22px; font-weight: 700; color: #0071e3; }
        .stat-label { font-size: 11px; color: #86868b; margin-top: 4px; text-transform: uppercase; }
        .main-grid { display: grid; grid-template-columns: 1.25fr 1fr; gap: 25px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 11px; color: #86868b; padding: 10px; border-bottom: 1px solid #eee; }
        td { padding: 10px; font-size: 13px; border-bottom: 1px solid #f9f9fb; }
        .token-cell { font-family: "SF Mono", monospace; color: #0071e3; font-weight: 600; text-align: right; }
        .v-tag { position: absolute; bottom: -20px; right: 0; font-size: 10px; color: #ccc; }
    </style>
</head>
<body>
    <div class="container">
        <div class="navbar">
            <h1 style="font-size: 20px; font-weight: 700;">Token Master V6.2</h1>
            <div style="display: flex; gap: 15px; align-items: center;">
                <div class="tab-group">
                    <button class="tab active" onclick="setMode('day')">Daily</button>
                    <button class="tab" onclick="setMode('month')">Monthly</button>
                    <button class="tab" onclick="setMode('all')">All Time</button>
                </div>
                <div class="range-picker" id="rangeContainer">
                    <span>From</span> <select id="startSelect" onchange="renderAll()"></select>
                    <span>To</span> <select id="endSelect" onchange="renderAll()"></select>
                </div>
            </div>
        </div>

        <div class="summary-grid">
            <div class="stat-card"><div class="stat-value" id="s-sessions">-</div><div class="stat-label">Independent Sessions</div></div>
            <div class="stat-card"><div class="stat-value" id="s-tokens">-</div><div class="stat-label">Aggregated Tokens</div></div>
            <div class="stat-card"><div class="stat-value" id="s-cost">-</div><div class="stat-label">Estimated Cost</div></div>
            <div class="stat-card"><div class="stat-value" id="s-cache">-</div><div class="stat-label">Cache Saving</div></div>
        </div>

        <div class="card">
            <h2 id="chartTitle" style="font-size: 15px; margin-bottom: 15px;">Activity Distribution Map</h2>
            <div style="height: 380px;"><canvas id="bubbleChart"></canvas></div>
        </div>

        <div class="main-grid">
            <div class="card">
                <h2>Consumption Leaderboard</h2>
                <table id="rankingTable">
                    <thead><tr><th>Session Summary</th><th style="text-align:right">Total Tokens</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
            <div class="card">
                <h2>Model Distribution Mix</h2>
                <div style="height: 300px;"><canvas id="pieChart"></canvas></div>
            </div>
        </div>
        <div class="v-tag">Last Generated: ${new Date().toLocaleString()}</div>
    </div>

    <script>
        const data = ${JSON.stringify(records)};
        const allModels = Array.from(new Set(data.map(r => r.model))).sort();
        let mode = 'day';
        let bubbleChart, pieChart;

        function initSelectors() {
            const periods = Array.from(new Set(data.map(r => mode === 'month' ? r.month : r.day))).sort();
            const startS = document.getElementById('startSelect');
            const endS = document.getElementById('endSelect');
            const container = document.getElementById('rangeContainer');

            if (mode === 'all') {
                container.style.visibility = 'hidden';
            } else {
                container.style.visibility = 'visible';
                const options = periods.map(p => \`<option value="\${p}">\${p}</option>\`).join('');
                startS.innerHTML = options;
                endS.innerHTML = options;
                startS.value = periods[Math.max(0, periods.length - (mode === 'day' ? 30 : 12))];
                endS.value = periods[periods.length - 1];
            }
        }

        function setMode(m) {
            mode = m;
            document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', ['day', 'month', 'all'][i] === mode));
            initSelectors();
            renderAll();
        }

        function renderAll() {
            let filtered = data;
            if (mode !== 'all') {
                const start = document.getElementById('startSelect').value;
                const end = document.getElementById('endSelect').value;
                filtered = data.filter(r => {
                    const val = mode === 'month' ? r.month : r.day;
                    return val >= start && val <= end;
                });
            }

            const totalT = filtered.reduce((acc, r) => acc + r.tokens, 0);
            const totalC = filtered.reduce((acc, r) => acc + r.cached, 0);
            const uniqueS = new Set(filtered.map(r => r.sessionId)).size;
            document.getElementById('s-sessions').innerText = uniqueS.toLocaleString();
            document.getElementById('s-tokens').innerText = (totalT / 1000000).toFixed(2) + 'M';
            document.getElementById('s-cost').innerText = '$' + (totalT * 0.00000013).toFixed(2);
            document.getElementById('s-cache').innerText = (totalC / 1000000).toFixed(2) + 'M';

            const rMap = new Map();
            filtered.forEach(r => {
                if (!rMap.has(r.sessionId)) rMap.set(r.sessionId, { t: r.sessionTitle, v: 0 });
                rMap.get(r.sessionId).v += r.tokens;
            });
            const top = Array.from(rMap.values()).sort((a,b) => b.v - a.v).slice(0, 15);
            document.querySelector('#rankingTable tbody').innerHTML = top.map(s => \`
                <tr><td title="\${s.t}">\${s.t.substring(0, 55)}...</td><td class="token-cell">\${s.v.toLocaleString()}</td></tr>
            \`).join('');

            updateCharts(filtered);
        }

        function updateCharts(filtered) {
            const mData = {}, bGroup = {};
            
            // 核心逻辑：决定气泡图 X 轴聚合维度
            // Daily -> 按天聚合
            // Monthly -> 按月聚合
            // All Time -> 按月聚合 (防止 X 轴过于拥挤)
            const targetX = (mode === 'day') ? 'day' : 'month';

            filtered.forEach(r => {
                mData[r.model] = (mData[r.model] || 0) + r.tokens;
                
                const xVal = r[targetX];
                const bk = xVal + '|' + r.model;
                if (!bGroup[bk]) bGroup[bk] = { x: xVal, y: r.model, v: 0 };
                bGroup[bk].v += r.tokens;
            });

            if (pieChart) pieChart.destroy();
            pieChart = new Chart(document.getElementById('pieChart'), {
                type: 'doughnut',
                data: { labels: Object.keys(mData), datasets: [{ data: Object.values(mData), backgroundColor: ['#0071e3', '#34c759', '#ff9500', '#af52de', '#ff3b30'], borderWidth: 0 }] },
                options: { maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'bottom' } } }
            });

            if (bubbleChart) bubbleChart.destroy();
            const bRaw = Object.values(bGroup);
            const xLabels = Array.from(new Set(bRaw.map(g => g.x))).sort();

            bubbleChart = new Chart(document.getElementById('bubbleChart'), {
                type: 'bubble',
                data: { datasets: [{
                    data: bRaw.map(g => ({ x: g.x, y: g.y, r: Math.min(40, Math.max(5, (Math.log10(g.v)-2) * (targetX === 'month' ? 4 : 5))), val: g.v })),
                    backgroundColor: 'rgba(0, 113, 227, 0.45)', borderColor: '#0071e3', borderWidth: 1
                }] },
                options: {
                    maintainAspectRatio: false,
                    scales: {
                        x: { type: 'category', labels: xLabels, grid: { display: false } },
                        y: { type: 'category', labels: allModels, grid: { color: '#f0f0f0' } }
                    },
                    plugins: { tooltip: { callbacks: { label: (ctx) => ' ' + ctx.raw.x + ' Usage: ' + ctx.raw.val.toLocaleString() } }, legend: { display: false } }
                }
            });
        }

        setMode('day');
    </script>
</body>
</html>
  `;

  fs.writeFileSync(REPORT_FILE, htmlContent);
  console.log(`✅ Axis-Aligned Range Dashboard V6.2 generated: ${REPORT_FILE}`);
  if (process.platform === 'darwin') exec(`open "${REPORT_FILE}"`);
}

generateHtmlReport();
