if (!requireAuth()) throw '';

function pageHTML() {
  return `
  <div class="page-header">
    <div>
      <h1 class="page-title">Reports</h1>
      <p class="page-subtitle">Generate and download reports.</p>
    </div>
    <div class="page-actions">
      <select class="form-select" id="rep-survey-sel" style="width:auto;font-size:13px;padding:6px 10px"><option value="">Select survey...</option></select>
      <button class="btn btn-primary" id="btn-new-report">${icon('plus')} New Report</button>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title" id="rep-card-title">Reports</span></div>
    <div id="reports-content">
      <div class="empty-state">
        <div class="empty-icon">${icon('reports')}</div>
        <p class="empty-title">Select a survey above</p>
        <p class="empty-desc">Choose a survey to view and create reports.</p>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="modal-new-report">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">Create Report</h3>
        <button class="modal-close" onclick="closeModal('modal-new-report')" aria-label="Close modal">${icon('close')}</button>
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
        <button class="btn btn-primary" id="btn-confirm-report">${icon('reports')} Create Report Job</button>
      </div>
    </div>
  </div>`;
}

function initPage() {
  const ws = getWorkspace();
  let selectedSurveyId = null;

  async function loadSurveys() {
    if (!ws.id) return;
    const pr = await api.listProjects(ws.id);
    if (!pr.ok) return;
    const sel = document.getElementById('rep-survey-sel');
    for (const p of (pr.data.items || pr.data)) {
      const r = await api.listSurveys(p.id);
      if (!r.ok) continue;
      (r.data.items || r.data).forEach(s => {
        const o = document.createElement('option');
        o.value = s.id; o.textContent = s.title.slice(0, 45); sel.appendChild(o);
      });
    }
    const urlSid = new URLSearchParams(window.location.search).get('survey');
    if (urlSid) { sel.value = urlSid; selectedSurveyId = urlSid; loadReports(urlSid); }
  }

  async function loadReports(sid) {
    const el = document.getElementById('reports-content');
    el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:40px;justify-content:center;color:#94a3b8"><span class="spinner-dark"></span> Loading reports...</div>';
    const r = await api.listReports(sid);
    if (!r.ok) { el.innerHTML = '<div style="padding:20px"><div class="alert alert-error">' + r.error.message + '</div></div>'; return; }
    const reports = r.data.items || r.data;
    const sv = document.getElementById('rep-survey-sel');
    document.getElementById('rep-card-title').textContent = (sv.options[sv.selectedIndex]?.text || 'Reports') + ' - Reports';

    if (!reports.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('reports') + '</div><p class="empty-title">No reports yet</p><p class="empty-desc">Create your first report to export insights.</p></div>';
      return;
    }

    el.innerHTML = '<div style="padding:8px 0">' + reports.map(rep => {
      const isPdf = rep.format === 'pdf';
      const isDone = rep.status === 'completed';
      const isGen = rep.status === 'queued' || rep.status === 'running';
      const icoColor = isPdf ? '#2563eb' : '#ea580c';
      const icoBg = isPdf ? '#eff6ff' : '#fff7ed';
      const icoSvg = isPdf ? icon('reports') : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
      const statusDot = isDone ? '#10b981' : isGen ? '#f59e0b' : '#ef4444';
      const statusText = isDone ? 'Completed' : isGen ? 'Generating' : rep.status;
      const templateLabel = (rep.template || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const dlBtn = isDone && rep.asset
        ? `<button onclick="downloadReportAsset({ asset_id: '${rep.asset.asset_id}', download_token: '${rep.asset.download_token}' })" style="background:none;border:none;cursor:pointer;color:#94a3b8;padding:4px" title="Download">${icon('download')}</button>`
        : isGen
        ? `<span class="spinner-dark"></span>`
        : '';
      return `<div style="display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid #f0f4f9;flex-wrap:wrap">
        <div style="width:40px;height:40px;background:${icoBg};border-radius:9px;display:flex;align-items:center;justify-content:center;color:${icoColor};flex-shrink:0">${icoSvg}</div>
        <div style="flex:1;min-width:220px">
          <div style="font-weight:600;font-size:14px;color:#1a2332">${templateLabel}</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:#94a3b8;margin-top:3px;flex-wrap:wrap">
            <span>${rep.format?.toUpperCase()}</span>
            <span>|</span><span>${templateLabel.toLowerCase()}</span>
            <span>|</span><span>${fmtDate(rep.created_at)}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-left:auto;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:7px;height:7px;border-radius:50%;background:${statusDot}"></div>
            <span style="font-size:13px;color:#475569">${statusText}</span>
          </div>
          ${dlBtn}
        </div>
      </div>`;
    }).join('') + '</div>';
  }

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
    const tmpl = document.getElementById('rep-template').value;
    const r = await api.createReport(selectedSurveyId, { format, template: tmpl });
    if (r.ok) {
      closeModal('modal-new-report');
      toast('success', 'Report job queued', format.toUpperCase() + ' | ' + tmpl.replace(/_/g, ' '));
      loadReports(selectedSurveyId);
    } else toast('error', r.error.message);
  });

  loadSurveys();
}

document.getElementById('root').innerHTML = buildSidebar('reports', 'Reports') + pageHTML() + closeSidebar();
initSidebar();
initPage();
