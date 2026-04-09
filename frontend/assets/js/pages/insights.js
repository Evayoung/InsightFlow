if (!requireAuth()) throw '';

function pageHTML() {
  return `
  <div class="page-header">
    <div>
      <h1 class="page-title">Insights</h1>
      <p class="page-subtitle" id="insights-sub">AI-powered analysis for your survey</p>
    </div>
    <div class="page-actions">
      <select class="form-select" id="ins-survey-sel" style="width:auto;font-size:13px;padding:6px 10px"><option value="">Select survey...</option></select>
      <button class="btn btn-ghost" id="btn-refresh-ins">${icon('refresh')} Refresh</button>
      <button class="btn btn-ai" id="btn-run-ins">${icon('play')} Run Analysis</button>
    </div>
  </div>
  <div id="ins-content">
    <div class="empty-state card">
      <div class="empty-icon">${icon('insights')}</div>
      <p class="empty-title">No survey selected</p>
      <p class="empty-desc">Select a survey above, then run AI analysis to generate insights.</p>
    </div>
  </div>`;
}

function initPage() {
  let selectedSurveyId = null;
  const ws = getWorkspace();

  async function loadSurveys() {
    if (!ws.id) return;
    const pr = await api.listProjects(ws.id);
    if (!pr.ok) return;
    const sel = document.getElementById('ins-survey-sel');
    for (const p of (pr.data.items || pr.data)) {
      const r = await api.listSurveys(p.id);
      if (!r.ok) continue;
      (r.data.items || r.data).forEach(s => {
        const o = document.createElement('option');
        o.value = s.id;
        o.textContent = s.title + ' (' + p.name + ')';
        sel.appendChild(o);
      });
    }
    const urlSid = new URLSearchParams(window.location.search).get('survey');
    if (urlSid) { sel.value = urlSid; selectedSurveyId = urlSid; loadInsights(urlSid); }
  }

  async function loadInsights(sid) {
    const el = document.getElementById('ins-content');
    el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:48px;justify-content:center;color:#94a3b8"><span class="spinner-dark"></span> Loading insights...</div>';
    const r = await api.latestInsights(sid);
    if (!r.ok) {
      el.innerHTML = '<div class="card card-body"><div class="alert alert-error">' + r.error.message + '</div><p style="color:#64748b;font-size:13.5px;margin-top:8px">No insights have been generated yet. Click <strong>Run Analysis</strong> to start.</p></div>';
      return;
    }
    renderInsights(r.data);
  }

  function renderInsights(d) {
    const dist = d.sentiment_distribution || {};
    const pos = Math.round((dist.positive || 0) * 100);
    const neu = Math.round((dist.neutral || 0) * 100);
    const neg = Math.round((dist.negative || 0) * 100);
    document.getElementById('insights-sub').textContent = 'AI-powered analysis | Generated ' + fmtTime(d.generated_at);

    document.getElementById('ins-content').innerHTML = `
      <div class="insight-hero">
        <div style="font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.5;margin-bottom:8px">AI Overview</div>
        <p style="font-size:15px;line-height:1.65">${d.overview || ''}</p>
      </div>

      <div class="stack-grid-2" style="margin-top:14px">
        <div class="card">
          <div class="card-header"><span class="card-title">Sentiment Distribution</span></div>
          <div class="card-body">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px;gap:8px;flex-wrap:wrap">
              <span style="color:#059669;font-weight:600">Positive ${pos}%</span>
              <span style="color:#64748b">Neutral ${neu}%</span>
              <span style="color:#dc2626;font-weight:600">Negative ${neg}%</span>
            </div>
            <div style="display:flex;height:10px;border-radius:999px;overflow:hidden;gap:2px">
              <div style="flex:${Math.max(pos, 1)};background:#10b981;border-radius:999px 0 0 999px"></div>
              <div style="flex:${Math.max(neu, 1)};background:#d1d5db"></div>
              <div style="flex:${Math.max(neg, 1)};background:#ef4444;border-radius:0 999px 999px 0"></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Run History</span></div>
          <div id="run-history-list" style="max-height:160px;overflow-y:auto"></div>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="card-header"><span class="card-title">Themes (${(d.themes || []).length})</span></div>
        <div class="card-body grid-2">
          ${(d.themes || []).map(t => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;gap:12px;flex-wrap:wrap">
              <span style="font-size:13.5px;color:#1a2332">${t.label}</span>
              <span style="font-size:13px;font-weight:700;color:#1a2332">${t.count} mentions</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="card-header"><span class="card-title">Recommendations</span></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:14px">
          ${(d.recommendations || []).map(rec => {
            const colors = { high:'#ef4444', medium:'#f59e0b', low:'#10b981' };
            const c = colors[rec.priority] || '#94a3b8';
            return `<div style="border-left:4px solid ${c};padding-left:14px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:10.5px;font-weight:700;text-transform:uppercase;color:${c}">${rec.priority}</span>
              </div>
              <div style="font-weight:700;font-size:14px;color:#1a2332;margin-bottom:4px">${rec.title}</div>
              <p style="font-size:13px;color:#475569">${rec.detail}</p>
            </div>`;
          }).join('')}
        </div>
      </div>`;

    loadRunHistory();
  }

  async function loadRunHistory() {
    if (!selectedSurveyId) return;
    const el = document.getElementById('run-history-list');
    if (!el) return;
    el.innerHTML = '<div style="padding:14px 16px;font-size:13px;color:#94a3b8">Run history from API...</div>';
  }

  async function runAnalysis() {
    if (!selectedSurveyId) { toast('info', 'Select a survey first'); return; }
    const btn = document.getElementById('btn-run-ins');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Running...';
    const el = document.getElementById('ins-content');
    el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;padding:56px;gap:12px"><div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#0ea5e9;font-weight:600"><div style="width:8px;height:8px;border-radius:50%;background:#0ea5e9;animation:pulse2 1s ease-in-out infinite"></div>Running AI analysis via POST /surveys/{id}/insights/run...</div></div>';

    const r = await api.runInsights(selectedSurveyId);
    const reset = () => { btn.disabled = false; btn.innerHTML = icon('play') + ' Run Analysis'; };

    if (r.ok && r.status === 202) {
      toast('info', 'Analysis running...', 'Polling for results');
      let attempts = 0;
      const poll = async () => {
        attempts += 1;
        await new Promise(res => setTimeout(res, 2500));
        const lat = await api.latestInsights(selectedSurveyId);
        if (lat.ok) { reset(); renderInsights(lat.data); toast('success', 'Insights ready'); }
        else if (attempts < 5) poll();
        else { reset(); loadInsights(selectedSurveyId); toast('error', 'Analysis timed out'); }
      };
      poll();
    } else if (r.ok) { reset(); renderInsights(r.data); toast('success', 'Insights ready'); }
    else { reset(); toast('error', r.error.message); el.innerHTML = '<div class="card card-body"><div class="alert alert-error">' + r.error.message + '</div></div>'; }
  }

  document.getElementById('ins-survey-sel').addEventListener('change', e => {
    selectedSurveyId = e.target.value;
    if (selectedSurveyId) loadInsights(selectedSurveyId);
  });
  document.getElementById('btn-run-ins').addEventListener('click', runAnalysis);
  document.getElementById('btn-refresh-ins').addEventListener('click', () => { if (selectedSurveyId) loadInsights(selectedSurveyId); });
  loadSurveys();
}

document.getElementById('root').innerHTML = buildSidebar('insights', 'Insights') + pageHTML() + closeSidebar();
initSidebar();
initPage();
