if (!requireAuth()) throw '';

function pageHTML() {
  return `
  <div class="page-header">
    <div>
      <h1 class="page-title">Analytics</h1>
      <p class="page-subtitle">Completion metrics and response trends.</p>
    </div>
    <div class="page-actions">
      <select class="form-select" id="ana-survey-sel" style="width:auto;font-size:13px;padding:6px 10px"><option value="">All surveys</option></select>
      <button class="btn btn-ghost" id="btn-refresh-ana">${icon('refresh')} Refresh</button>
    </div>
  </div>

  <div class="stats-grid" style="margin-bottom:20px">
    <div class="stat-card" style="--bar:linear-gradient(90deg,#2563eb,#3b82f6)">
      <div class="stat-icon">${icon('sparkles')}</div>
      <div class="stat-label">AI Surveys Generated</div>
      <div class="stat-value" id="st-ai-gen">-</div>
    </div>
    <div class="stat-card" style="--bar:linear-gradient(90deg,#059669,#10b981)">
      <div class="stat-icon">${icon('checkCircle')}</div>
      <div class="stat-label">Completed Surveys</div>
      <div class="stat-value" id="st-completed">-</div>
    </div>
    <div class="stat-card" style="--bar:linear-gradient(90deg,#6d28d9,#8b5cf6)">
      <div class="stat-icon">${icon('analytics')}</div>
      <div class="stat-label">Completion Rate</div>
      <div class="stat-value" id="st-rate">-</div>
    </div>
    <div class="stat-card" style="--bar:linear-gradient(90deg,#b45309,#f59e0b)">
      <div class="stat-icon">${icon('responses')}</div>
      <div class="stat-label">Total Responses</div>
      <div class="stat-value" id="st-total-resp">-</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <span class="card-title">Responses Over Time</span>
    </div>
    <div class="card-body">
      <canvas id="responsesChart" height="85"></canvas>
    </div>
  </div>`;
}

function initPage() {
  const ws = getWorkspace();
  let chart = null;

  async function loadSurveys() {
    if (!ws.id) return;
    const pr = await api.listProjects(ws.id);
    if (!pr.ok) return;
    const sel = document.getElementById('ana-survey-sel');
    for (const p of (pr.data.items || pr.data)) {
      const r = await api.listSurveys(p.id);
      if (!r.ok) continue;
      (r.data.items || r.data).forEach(s => {
        const o = document.createElement('option');
        o.value = s.id; o.textContent = s.title.slice(0, 50); sel.appendChild(o);
      });
    }
    const urlSid = new URLSearchParams(window.location.search).get('survey');
    if (urlSid) { sel.value = urlSid; loadAnalytics(urlSid); }
    else loadWsAnalytics();
  }

  async function loadWsAnalytics() {
    const r = await api.wsAnalytics(ws.id);
    if (!r.ok) return;
    const d = r.data;
    document.getElementById('st-ai-gen').textContent = d.generated_ai_surveys || 0;
    document.getElementById('st-completed').textContent = d.completed_surveys || d.live_surveys || 0;
    document.getElementById('st-rate').textContent = Math.round((d.avg_completion || 0) * 100) + '%';
    document.getElementById('st-total-resp').textContent = (d.total_responses || 0).toLocaleString();
    renderChart([0,0,0,0,0,0,0,0], ['','','','','','','','']);
  }

  async function loadAnalytics(sid) {
    const r = await api.surveyAnalytics(sid);
    if (!r.ok) { toast('error', r.error.message); return; }
    const d = r.data;
    document.getElementById('st-ai-gen').textContent = d.generated_ai_surveys || 0;
    document.getElementById('st-completed').textContent = d.completed_ai_surveys || 0;
    document.getElementById('st-rate').textContent = Math.round((d.completion_rate || 0) * 100) + '%';
    document.getElementById('st-total-resp').textContent = (d.total_responses || 0).toLocaleString();
    renderChart([45,32,58,47,52,61,55,48], ['Feb 14','Feb 15','Feb 16','Feb 17','Feb 18','Feb 19','Feb 20','Feb 21']);
  }

  function renderChart(data, labels) {
    const ctx = document.getElementById('responsesChart').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Responses',
          data,
          backgroundColor: '#3b82f6',
          borderRadius: 6,
          barPercentage: 0.65,
          categoryPercentage: 0.8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f0f4f9' }, ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 }, color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 }, color: '#94a3b8' } }
        }
      }
    });
  }

  document.getElementById('ana-survey-sel').addEventListener('change', e => {
    if (e.target.value) loadAnalytics(e.target.value);
    else loadWsAnalytics();
  });
  document.getElementById('btn-refresh-ana').addEventListener('click', () => {
    const sid = document.getElementById('ana-survey-sel').value;
    if (sid) loadAnalytics(sid); else loadWsAnalytics();
  });
  loadSurveys();
}

document.getElementById('root').innerHTML = buildSidebar('analytics', 'Analytics') + pageHTML() + closeSidebar();
initSidebar();
initPage();
