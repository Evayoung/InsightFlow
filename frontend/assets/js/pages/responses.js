if (!requireAuth()) throw '';

const ws = getWorkspace();

document.getElementById('root').innerHTML =
  buildSidebar('responses', 'Responses') +
  `<div class="page-header">
    <div><h1 class="page-title">Responses</h1><p class="page-subtitle">View and analyze individual survey responses.</p></div>
    <button class="btn btn-ghost" id="btn-export">${icon('download')} Export CSV</button>
  </div>

  <div id="survey-switcher" class="filter-bar" style="margin-bottom:16px"></div>

  <div class="stats-grid" id="resp-stats" style="margin-bottom:16px;grid-template-columns:repeat(4,1fr)">
    <div class="stat-card" style="--bar:#0079C1"><div class="stat-label">Total Responses</div><div class="stat-value" id="st-total">-</div></div>
    <div class="stat-card" style="--bar:#10b981"><div class="stat-label">Completion Rate</div><div class="stat-value" id="st-comp">-</div></div>
    <div class="stat-card" style="--bar:#f59e0b"><div class="stat-label">Avg Score</div><div class="stat-value" id="st-score">-</div></div>
    <div class="stat-card" style="--bar:#6d28d9"><div class="stat-label">Positive Sentiment</div><div class="stat-value" id="st-pos">-</div></div>
  </div>

  <div class="card" id="resp-card">
    <div class="card-header">
      <span class="card-title" id="resp-card-title">Select a survey</span>
      <span class="badge badge-gray" id="resp-count">0 responses</span>
    </div>
    <div id="resp-table-wrap">
      <div class="empty-state"><div class="empty-icon">${icon('responses')}</div><p class="empty-title">Select a survey above</p></div>
    </div>
  </div>` +
  closeSidebar();

initSidebar();

let selectedSurveyId = null;
const params = new URLSearchParams(window.location.search);

async function loadSurveySwitcher() {
  if (!ws.id) return;
  const pr = await api.listProjects(ws.id);
  if (!pr.ok) return;

  const allSurveys = [];
  for (const p of (pr.data.items || pr.data)) {
    const r = await api.listSurveys(p.id);
    if (r.ok) (r.data.items || r.data).forEach(s => allSurveys.push({ ...s, _pname: p.name }));
  }

  const sw = document.getElementById('survey-switcher');
  if (allSurveys.length === 0) {
    sw.innerHTML = '<span style="font-size:13px;color:#94a3b8">No surveys found. <a href="surveys.html" class="text-link">Create one.</a></span>';
    return;
  }

  const urlSurvey = params.get('survey');
  selectedSurveyId = urlSurvey || allSurveys[0]?.id;

  sw.innerHTML = allSurveys.map(sv =>
    `<button class="btn ${sv.id === selectedSurveyId ? 'btn-primary' : 'btn-ghost'} btn-sm" data-svid="${sv.id}">
      ${sv.title.split(' ').slice(0,4).join(' ')}${sv.title.split(' ').length > 4 ? '...' : ''}
      <span style="opacity:.6;font-size:11px;margin-left:3px">${sv.response_count || 0}</span>
    </button>`
  ).join('');

  sw.querySelectorAll('[data-svid]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSurveyId = btn.dataset.svid;
      sw.querySelectorAll('[data-svid]').forEach(b => { b.className = b.dataset.svid === selectedSurveyId ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'; });
      loadResponses(selectedSurveyId, allSurveys.find(s => s.id === selectedSurveyId));
    });
  });

  if (selectedSurveyId) loadResponses(selectedSurveyId, allSurveys.find(s => s.id === selectedSurveyId));
}

async function loadResponses(sid, survey) {
  document.getElementById('resp-card-title').textContent = survey?.title || 'Survey';
  document.getElementById('resp-table-wrap').innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:40px;justify-content:center;color:#94a3b8"><span class="spinner-dark"></span> Loading responses...</div>';

  const r = await api.listResponses(sid);
  if (!r.ok) {
    document.getElementById('resp-table-wrap').innerHTML = '<div class="card-body"><div class="alert alert-error">' + r.error.message + '</div></div>';
    return;
  }

  const responses = r.data.items || r.data;
  document.getElementById('resp-count').textContent = responses.length + ' responses';
  document.getElementById('st-total').textContent = responses.length;

  if (responses.length > 0) {
    const complete = responses.filter(r => r.is_complete !== false).length;
    const comp = Math.round(complete / responses.length * 100);
    const scores = responses.filter(r => r.score).map(r => r.score);
    const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';
    const pos = responses.filter(r => r.sentiment === 'positive').length;
    const posPct = Math.round(pos / responses.length * 100);
    document.getElementById('st-comp').textContent = comp + '%';
    document.getElementById('st-score').textContent = avgScore + (scores.length ? '/10' : '');
    document.getElementById('st-pos').textContent = posPct + '%';
  }

  if (responses.length === 0) {
    document.getElementById('resp-table-wrap').innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('responses') + '</div><p class="empty-title">No responses yet</p><p class="empty-desc">Responses will appear here once your survey is live and collecting data.</p></div>';
    return;
  }

  const sentBg = { positive:'#d1fae5', neutral:'#fef3c7', negative:'#fee2e2' };
  const sentTx = { positive:'#065f46', neutral:'#78350f', negative:'#991b1b' };

  const rows = responses.map(resp => {
    const sc = resp.score || 0;
    const sent = resp.sentiment || 'neutral';
    const sCol = sc >= 8 ? { bg:'#d1fae5', tx:'#065f46' } : sc >= 5 ? { bg:'#fef3c7', tx:'#78350f' } : { bg:'#fee2e2', tx:'#991b1b' };
    const payload = JSON.stringify(resp).replace(/"/g, '&quot;');
    return `<tr onclick="viewResponse('${resp.id}',${payload})">
      <td style="font-weight:600">Respondent #${(resp.id || '').slice(-6)}</td>
      <td>${sc ? '<div style="width:32px;height:32px;border-radius:50%;background:' + sCol.bg + ';color:' + sCol.tx + ';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">' + sc + '</div>' : '<span style="color:#94a3b8">-</span>'}</td>
      <td><span class="badge" style="background:${sentBg[sent] || '#f1f5f9'};color:${sentTx[sent] || '#64748b'}">${sent}</span></td>
      <td style="color:#64748b;font-size:12.5px">${fmtTime(resp.submitted_at)}</td>
      <td>${badge(resp.is_complete !== false ? 'completed' : 'pending')}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();viewResponse('${resp.id}',${payload})">View</button></td>
    </tr>`;
  }).join('');

  document.getElementById('resp-table-wrap').innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>Respondent</th><th>Score</th><th>Sentiment</th><th>Submitted</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function viewResponse(id, resp) {
  const answers = (resp.answers || []).map((a, i) =>
    `<div style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;margin-bottom:8px">
      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Answer ${i + 1}</div>
      <div style="font-size:13.5px;color:#1a2332">${Array.isArray(a.value) ? a.value.join(', ') : (a.value || '-')}</div>
    </div>`
  ).join('');

  document.getElementById('resp-detail-body').innerHTML =
    `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      ${badge(resp.is_complete !== false ? 'completed' : 'pending')}
      <span class="badge badge-gray">${fmtTime(resp.submitted_at)}</span>
      ${resp.score ? '<span class="badge badge-blue">Score: ' + resp.score + '</span>' : ''}
      ${resp.sentiment ? badge(resp.sentiment) : ''}
    </div>` + (answers || '<p style="color:#94a3b8">No answers recorded.</p>');

  openModal('modal-response');
}

document.getElementById('btn-export').addEventListener('click', () => {
  if (!selectedSurveyId) { toast('info', 'Select a survey first'); return; }
  toast('info', 'Export started', 'Your CSV will download shortly');
  window.open('/api/v1/surveys/' + selectedSurveyId + '/responses/export?format=csv', '_blank');
});

loadSurveySwitcher();
