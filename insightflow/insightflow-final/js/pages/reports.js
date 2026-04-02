/* reports.js */
(function () {
  const ws = getWorkspace();
  let selectedSurveyId = null;

  /* ── SHELL ── */
  buildShell('reports', 'Reports');
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Reports</h1>
        <p class="page-subtitle">Generate and download reports.</p>
      </div>
      <div style="display:flex;gap:8px">
        <select class="form-select" id="rep-survey-sel" style="width:auto;font-size:13px;padding:6px 10px">
          <option value="">Select survey…</option>
        </select>
        <button class="btn btn-primary" id="btn-new-report">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Report
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title" id="rep-card-title">Reports</span>
      </div>
      <div id="reports-content">
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <p class="empty-title">Select a survey above</p>
          <p class="empty-desc">Choose a survey to view and create reports.</p>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div class="modal-overlay" id="modal-new-report">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">Create Report</h3>
          <button class="modal-close" onclick="closeModal('modal-new-report')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Format</label>
            <select class="form-select" id="rep-format">
              <option value="pdf">PDF</option>
              <option value="slides">Slides</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Template</label>
            <select class="form-select" id="rep-template">
              <option value="executive_summary">Executive Summary</option>
              <option value="detailed_analysis">Detailed Analysis</option>
              <option value="stakeholder_brief">Stakeholder Brief</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal('modal-new-report')">Cancel</button>
          <button class="btn btn-primary" id="btn-confirm-report">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Create Report Job
          </button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('main-content').insertAdjacentHTML('afterend', '</div></div>');
  initShell();

  /* ── LOAD SURVEYS ── */
  populateSurveySelector('rep-survey-sel', ws.id).then(preselected => {
    if (preselected) { selectedSurveyId = preselected; loadReports(preselected); }
  });

  /* ── LOAD REPORTS ── */
  async function loadReports(sid) {
    const el = document.getElementById('reports-content');
    el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:40px;justify-content:center;color:#94a3b8"><span class="spinner-dark"></span> Loading reports…</div>';

    const r = await api.listReports(sid);
    if (!r.ok) { el.innerHTML = '<div style="padding:20px"><div class="alert alert-error">' + r.error.message + '</div></div>'; return; }

    const reports = r.data.items || r.data;
    const sel = document.getElementById('rep-survey-sel');
    document.getElementById('rep-card-title').textContent = (sel.options[sel.selectedIndex]?.text || 'Reports') + ' — Reports';

    if (!reports.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><p class="empty-title">No reports yet</p><p class="empty-desc">Create your first report to export insights.</p></div>';
      return;
    }

    el.innerHTML = '<div style="padding:0">' + reports.map(rep => {
      const isPdf  = rep.format === 'pdf';
      const isDone = rep.status === 'completed';
      const isGen  = rep.status === 'queued' || rep.status === 'running';

      const icoColor = isPdf ? '#2563eb' : '#ea580c';
      const icoBg    = isPdf ? '#eff6ff' : '#fff7ed';
      const icoSvg   = isPdf
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';

      const dotColor   = isDone ? '#10b981' : isGen ? '#f59e0b' : '#ef4444';
      const statusText = isDone ? 'Completed' : isGen ? 'Generating' : (rep.status || '');
      const label      = (rep.template || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      const dlBtn = isDone && rep.asset
        ? '<button onclick="window.open(\'/api/v1/exports/' + rep.asset.asset_id + '/download\',\'_blank\')" style="background:none;border:none;cursor:pointer;color:#94a3b8;padding:4px;display:flex;align-items:center" title="Download"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>'
        : isGen ? '<span class="spinner-dark"></span>' : '';

      return '<div style="display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid #f0f4f9">' +
        '<div style="width:40px;height:40px;background:' + icoBg + ';border-radius:9px;display:flex;align-items:center;justify-content:center;color:' + icoColor + ';flex-shrink:0">' + icoSvg + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:600;font-size:14px;color:#1a2332">' + label + '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:#94a3b8;margin-top:3px">' +
            '<span>' + (rep.format || '').toUpperCase() + '</span>' +
            '<span>·</span><span>' + label.toLowerCase() + '</span>' +
            '<span>·</span><span>' + fmtDate(rep.created_at) + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<div style="display:flex;align-items:center;gap:6px">' +
            '<div style="width:7px;height:7px;border-radius:50%;background:' + dotColor + '"></div>' +
            '<span style="font-size:13px;color:#475569">' + statusText + '</span>' +
          '</div>' +
          dlBtn +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  /* ── EVENTS ── */
  document.getElementById('rep-survey-sel').addEventListener('change', e => {
    selectedSurveyId = e.target.value;
    if (selectedSurveyId) loadReports(selectedSurveyId);
  });

  document.getElementById('btn-new-report').addEventListener('click', () => {
    if (!selectedSurveyId) { toast('info', 'Select a survey first'); return; }
    openModal('modal-new-report');
  });

  document.getElementById('btn-confirm-report').addEventListener('click', async () => {
    const format = document.getElementById('rep-format').value;
    const tmpl   = document.getElementById('rep-template').value;
    const r = await api.createReport(selectedSurveyId, { format, template: tmpl });
    if (r.ok) {
      closeModal('modal-new-report');
      toast('success', 'Report job queued', format.toUpperCase() + ' · ' + tmpl.replace(/_/g, ' '));
      loadReports(selectedSurveyId);
    } else {
      toast('error', r.error.message);
    }
  });
})();
