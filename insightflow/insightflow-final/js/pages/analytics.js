/* analytics.js */
(function () {
  const ws = getWorkspace();
  let chart = null;

  /* ── SHELL ── */
  buildShell('analytics', 'Analytics');
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Analytics</h1>
        <p class="page-subtitle">Completion metrics and response trends.</p>
      </div>
      <div style="display:flex;gap:8px">
        <select class="form-select" id="ana-survey-sel" style="width:auto;font-size:13px;padding:6px 10px">
          <option value="">All surveys</option>
        </select>
        <button class="btn btn-ghost" id="btn-refresh-ana">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Refresh
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card" style="--bar:linear-gradient(90deg,#2563eb,#3b82f6)">
        <div class="stat-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M22 2l-10 10-4-4"/></svg>
        </div>
        <div class="stat-label">AI Surveys Generated</div>
        <div class="stat-value" id="st-ai-gen">—</div>
      </div>
      <div class="stat-card" style="--bar:linear-gradient(90deg,#059669,#10b981)">
        <div class="stat-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
        </div>
        <div class="stat-label">Completed Surveys</div>
        <div class="stat-value" id="st-completed">—</div>
      </div>
      <div class="stat-card" style="--bar:linear-gradient(90deg,#6d28d9,#8b5cf6)">
        <div class="stat-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
        </div>
        <div class="stat-label">Completion Rate</div>
        <div class="stat-value" id="st-rate">—</div>
      </div>
      <div class="stat-card" style="--bar:linear-gradient(90deg,#b45309,#f59e0b)">
        <div class="stat-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="stat-label">Total Responses</div>
        <div class="stat-value" id="st-total-resp">—</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Responses Over Time</span></div>
      <div class="card-body">
        <canvas id="responsesChart" height="85"></canvas>
      </div>
    </div>
  `;
  document.getElementById('main-content').insertAdjacentHTML('afterend', '</div></div>');
  initShell();

  /* ── LOAD ── */
  populateSurveySelector('ana-survey-sel', ws.id).then(preselected => {
    if (preselected) loadSurveyAnalytics(preselected);
    else loadWsAnalytics();
  });

  async function loadWsAnalytics() {
    if (!ws.id) return;
    const r = await api.wsAnalytics(ws.id);
    if (r.ok) {
      const d = r.data;
      document.getElementById('st-ai-gen').textContent     = d.generated_ai_surveys || 0;
      document.getElementById('st-completed').textContent  = d.live_surveys || 0;
      document.getElementById('st-rate').textContent       = Math.round((d.avg_completion || 0) * 100) + '%';
      document.getElementById('st-total-resp').textContent = (d.total_responses || 0).toLocaleString();
    }
    renderChart([], []);
  }

  async function loadSurveyAnalytics(sid) {
    const r = await api.surveyAnalytics(sid);
    if (!r.ok) { toast('error', r.error.message); return; }
    const d = r.data;
    document.getElementById('st-ai-gen').textContent     = d.generated_ai_surveys || 0;
    document.getElementById('st-completed').textContent  = d.completed_ai_surveys || 0;
    document.getElementById('st-rate').textContent       = Math.round((d.completion_rate || 0) * 100) + '%';
    document.getElementById('st-total-resp').textContent = (d.total_responses || 0).toLocaleString();

    // Build chart from responses if available, otherwise use empty placeholders
    const labels = d.response_timeline?.map(p => fmtDate(p.date)) || [];
    const values = d.response_timeline?.map(p => p.count) || [];
    renderChart(values, labels);
  }

  function renderChart(data, labels) {
    const ctx = document.getElementById('responsesChart');
    if (!ctx) return;
    if (chart) { chart.destroy(); chart = null; }
    if (typeof Chart === 'undefined') return;

    chart = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['No data'],
        datasets: [{
          label: 'Responses',
          data: data.length ? data : [0],
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
          y: {
            beginAtZero: true,
            grid: { color: '#f0f4f9' },
            ticks: { font: { family: '\'Plus Jakarta Sans\', sans-serif', size: 12 }, color: '#94a3b8' }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: '\'Plus Jakarta Sans\', sans-serif', size: 12 }, color: '#94a3b8' }
          }
        }
      }
    });
  }

  /* ── EVENTS ── */
  document.getElementById('ana-survey-sel').addEventListener('change', e => {
    if (e.target.value) loadSurveyAnalytics(e.target.value);
    else loadWsAnalytics();
  });
  document.getElementById('btn-refresh-ana').addEventListener('click', () => {
    const sid = document.getElementById('ana-survey-sel').value;
    if (sid) loadSurveyAnalytics(sid); else loadWsAnalytics();
  });
})();
