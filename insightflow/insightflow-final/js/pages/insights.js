/* insights.js */
(function () {
  const ws = getWorkspace();
  let selectedSurveyId = null;

  /* ── RENDER SHELL ── */
  buildShell('insights', 'Insights');
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Insights</h1>
        <p class="page-subtitle" id="ins-sub">AI-powered analysis for your survey</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select class="form-select" id="ins-survey-sel" style="width:auto;font-size:13px;padding:6px 10px">
          <option value="">Select survey…</option>
        </select>
        <button class="btn btn-ghost" id="btn-refresh-ins">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Refresh
        </button>
        <button class="btn btn-ai" id="btn-run-ins">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Run Analysis
        </button>
      </div>
    </div>
    <div id="ins-content">
      <div class="card empty-state">
        <div class="empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <p class="empty-title">No survey selected</p>
        <p class="empty-desc">Select a survey above, then run AI analysis to generate insights.</p>
      </div>
    </div>
  `;
  document.getElementById('main-content').insertAdjacentHTML('afterend', '</div></div>');
  initShell();

  /* ── LOAD SURVEYS ── */
  populateSurveySelector('ins-survey-sel', ws.id).then(preselected => {
    if (preselected) { selectedSurveyId = preselected; loadInsights(preselected); }
  });

  /* ── LOAD INSIGHTS ── */
  async function loadInsights(sid) {
    const el = document.getElementById('ins-content');
    el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:48px;justify-content:center;color:#94a3b8"><span class="spinner-dark"></span> Loading insights…</div>';
    const r = await api.latestInsights(sid);
    if (!r.ok) {
      el.innerHTML = '<div class="card card-body"><div class="alert alert-error">' + r.error.message + '</div><p style="color:#64748b;font-size:13.5px;margin-top:8px">No insights yet. Click <strong>Run Analysis</strong> to start.</p></div>';
      return;
    }
    renderInsights(r.data);
  }

  /* ── RENDER INSIGHTS ── */
  function renderInsights(d) {
    const dist = d.sentiment_distribution || {};
    const pos  = Math.round((dist.positive || 0) * 100);
    const neu  = Math.round((dist.neutral  || 0) * 100);
    const neg  = Math.round((dist.negative || 0) * 100);

    document.getElementById('ins-sub').textContent = 'AI-powered analysis · Generated ' + fmtTime(d.generated_at);

    const themes = (d.themes || []).map(t =>
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px">' +
        '<span style="font-size:13.5px;color:#1a2332">' + t.label + '</span>' +
        '<span style="font-size:13px;font-weight:700;color:#1a2332">' + t.count + ' mentions</span>' +
      '</div>'
    ).join('');

    const recColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
    const recs = (d.recommendations || []).map(rec => {
      const c = recColors[rec.priority] || '#94a3b8';
      return '<div style="border-left:4px solid ' + c + ';padding-left:14px">' +
        '<div style="font-size:10.5px;font-weight:700;text-transform:uppercase;color:' + c + ';margin-bottom:4px">' + (rec.priority || '') + '</div>' +
        '<div style="font-weight:700;font-size:14px;color:#1a2332;margin-bottom:4px">' + (rec.title || '') + '</div>' +
        '<p style="font-size:13px;color:#475569;line-height:1.5">' + (rec.detail || '') + '</p>' +
      '</div>';
    }).join('');

    document.getElementById('ins-content').innerHTML =
      '<div class="insight-hero">' +
        '<div style="font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.5;margin-bottom:8px">AI Overview</div>' +
        '<p style="font-size:15px;line-height:1.65">' + (d.overview || '') + '</p>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">' +
        '<div class="card">' +
          '<div class="card-header"><span class="card-title">Sentiment Distribution</span></div>' +
          '<div class="card-body">' +
            '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px">' +
              '<span style="color:#059669;font-weight:600">Positive ' + pos + '%</span>' +
              '<span style="color:#64748b">Neutral ' + neu + '%</span>' +
              '<span style="color:#dc2626;font-weight:600">Negative ' + neg + '%</span>' +
            '</div>' +
            '<div style="display:flex;height:10px;border-radius:999px;overflow:hidden;gap:2px">' +
              '<div style="flex:' + pos + ';background:#10b981;border-radius:999px 0 0 999px"></div>' +
              '<div style="flex:' + neu + ';background:#d1d5db"></div>' +
              '<div style="flex:' + neg + ';background:#ef4444;border-radius:0 999px 999px 0"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-header"><span class="card-title">Run History</span></div>' +
          '<div id="run-history-list"><div style="padding:14px 16px;font-size:13px;color:#94a3b8">Fetched via GET /surveys/{id}/insights/latest</div></div>' +
        '</div>' +
      '</div>' +

      (themes ? '<div class="card" style="margin-bottom:14px"><div class="card-header"><span class="card-title">Themes (' + (d.themes || []).length + ')</span></div><div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + themes + '</div></div>' : '') +

      (recs ? '<div class="card"><div class="card-header"><span class="card-title">Recommendations</span></div><div class="card-body" style="display:flex;flex-direction:column;gap:16px">' + recs + '</div></div>' : '');
  }

  /* ── RUN ANALYSIS ── */
  async function runAnalysis() {
    if (!selectedSurveyId) { toast('info', 'Select a survey first'); return; }
    const btn = document.getElementById('btn-run-ins');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Running…';

    document.getElementById('ins-content').innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;padding:56px;gap:12px">' +
        '<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#0ea5e9;font-weight:600">' +
          '<div style="width:8px;height:8px;border-radius:50%;background:#0ea5e9;animation:pulse2 1s ease-in-out infinite"></div>' +
          'Running AI analysis via POST /surveys/{id}/insights/run…' +
        '</div>' +
      '</div>';

    const reset = () => {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Analysis';
    };

    const r = await api.runInsights(selectedSurveyId);
    if (r.ok && r.status === 202) {
      toast('info', 'Analysis running…', 'Polling for results');
      let attempts = 0;
      const poll = async () => {
        attempts++;
        await new Promise(res => setTimeout(res, 2500));
        const lat = await api.latestInsights(selectedSurveyId);
        if (lat.ok) { reset(); renderInsights(lat.data); toast('success', 'Insights ready!'); }
        else if (attempts < 5) poll();
        else { reset(); loadInsights(selectedSurveyId); toast('error', 'Analysis timed out'); }
      };
      poll();
    } else if (r.ok) {
      reset();
      renderInsights(r.data);
      toast('success', 'Insights ready!');
    } else {
      reset();
      toast('error', r.error.message);
      document.getElementById('ins-content').innerHTML = '<div class="card card-body"><div class="alert alert-error">' + r.error.message + '</div></div>';
    }
  }

  /* ── EVENTS ── */
  document.getElementById('ins-survey-sel').addEventListener('change', e => {
    selectedSurveyId = e.target.value;
    if (selectedSurveyId) loadInsights(selectedSurveyId);
  });
  document.getElementById('btn-run-ins').addEventListener('click', runAnalysis);
  document.getElementById('btn-refresh-ins').addEventListener('click', () => { if (selectedSurveyId) loadInsights(selectedSurveyId); });
})();
