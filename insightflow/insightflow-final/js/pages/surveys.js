/* surveys.js */
if (!requireAuth()) throw '';

const ws = getWorkspace();

document.getElementById('root').innerHTML =
  buildSidebar('surveys', 'Surveys') +
  `<div class="page-header">
    <div><h1 class="page-title">Surveys</h1><p class="page-subtitle" id="surv-subtitle">Loading…</p></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ai" id="btn-ai-gen">✨ AI Generate</button>
      <button class="btn btn-primary" id="btn-new-surv">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Survey
      </button>
    </div>
  </div>

  <!-- Filters -->
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
    <div style="position:relative;flex:1;min-width:200px;max-width:300px">
      <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </span>
      <input class="form-input" id="surv-search" placeholder="Search surveys…" style="padding-left:32px"/>
    </div>
    <div class="tabs" style="margin-bottom:0;border-bottom:none;gap:0" id="surv-filter-tabs">
      <button class="tab-btn active" data-filter="all">All</button>
      <button class="tab-btn" data-filter="published">Live</button>
      <button class="tab-btn" data-filter="draft">Draft</button>
      <button class="tab-btn" data-filter="closed">Closed</button>
    </div>
    <select class="form-select" id="proj-filter" style="width:auto;font-size:13px;padding:6px 10px">
      <option value="">All Projects</option>
    </select>
  </div>

  <div id="surveys-list"></div>` +
  closeSidebar();

initSidebar();

let allSurveys = [], allProjects = [], filterStatus = 'all', filterProject = '', searchTerm = '';

async function loadData() {
  if (!ws.id) {
    document.getElementById('surveys-list').innerHTML = '<div class="card"><div class="empty-state"><p class="empty-title">No workspace selected</p><a href="workspaces.html" class="btn btn-primary">Go to Workspaces</a></div></div>';
    return;
  }

  const pr = await api.listProjects(ws.id);
  if (!pr.ok) { toast('error', pr.error.message); return; }
  allProjects = pr.data.items || pr.data;

  // Populate project filter
  const projSel = document.getElementById('proj-filter');
  projSel.innerHTML = '<option value="">All Projects</option>' + allProjects.map(p => '<option value="' + p.id + '">' + p.name + '</option>').join('');

  // Populate project dropdown in modal
  const sProjSel = document.getElementById('s-project');
  const active = allProjects.filter(p => p.status === 'active');
  sProjSel.innerHTML = active.length === 0
    ? '<option value="">No active projects — create one first</option>'
    : active.map(p => '<option value="' + p.id + '">' + p.name + '</option>').join('');

  // Load surveys for all projects
  allSurveys = [];
  document.getElementById('surveys-list').innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:48px;justify-content:center;color:#94a3b8"><span class="spinner-dark"></span> Loading surveys…</div>';
  await Promise.all(allProjects.map(async p => {
    const r = await api.listSurveys(p.id);
    if (r.ok) (r.data.items || r.data).forEach(s => allSurveys.push({ ...s, _projectName: p.name, _projectId: p.id }));
  }));

  // Check URL params
  const params = new URLSearchParams(window.location.search);
  if (params.get('project')) filterProject = params.get('project');
  if (params.get('action') === 'new') { openModal('modal-new-surv'); history.replaceState(null, '', window.location.pathname); }

  document.getElementById('surv-subtitle').textContent = allSurveys.length + ' surveys across ' + allProjects.length + ' projects';
  renderSurveys();
}

function renderSurveys() {
  let filtered = allSurveys
    .filter(s => filterStatus === 'all' || s.status === filterStatus)
    .filter(s => !filterProject || s._projectId === filterProject)
    .filter(s => !searchTerm || s.title.toLowerCase().includes(searchTerm.toLowerCase()));

  if (filtered.length === 0) {
    document.getElementById('surveys-list').innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></svg></div><p class="empty-title">' + (searchTerm ? 'No surveys match your search' : 'No surveys yet') + '</p><p class="empty-desc">' + (searchTerm ? 'Try a different search term.' : 'Create your first survey.') + '</p>' + (searchTerm ? '' : '<button class="btn btn-primary" onclick="openModal('modal-new-surv')">+ New Survey</button>') + '</div></div>';
    return;
  }

  document.getElementById('surveys-list').innerHTML = filtered.map(sv => {
    const comp = sv.completion_rate ? Math.round(sv.completion_rate * 100) : 0;
    const pc   = comp > 70 ? '#10b981' : comp > 40 ? '#f59e0b' : '#ef4444';
    let actions = '';
    if (sv.status === 'published' && sv.public_slug) {
      actions += '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();copyLink('' + sv.public_slug + '')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Share</button>';
    }
    if (sv.status === 'draft') {
      actions += '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();publishSurvey('' + sv.id + '')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Publish</button>';
    }
    actions += '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();runBiasCheck('' + sv.id + '')">✨ Bias</button>';
    actions += '<a href="responses.html?survey=' + sv.id + '" class="btn btn-ghost btn-sm" onclick="event.stopPropagation()">Responses</a>';
    return `<div class="survey-card" style="margin-bottom:10px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
        <div>
          <div style="font-family:'Instrument Serif',serif;font-style:italic;font-weight:700;font-size:15px;margin-bottom:6px">${sv.title}</div>
          <div style="display:flex;align-items:center;gap:8px">${badge(sv.status)}<span style="font-size:12px;color:#94a3b8">${sv._projectName || ''}</span></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0">${actions}</div>
      </div>
      <p style="font-size:13px;color:#64748b;margin-bottom:10px">${sv.goal || sv.description || 'No description.'}</p>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div class="prog-track" style="flex:1"><div class="prog-fill" style="width:${comp}%;background:${pc}"></div></div>
        <span style="font-size:11.5px;color:#94a3b8;flex-shrink:0">${comp}% completion</span>
      </div>
      <div style="display:flex;align-items:center;gap:16px;font-size:12px;color:#94a3b8">
        <span>${sv.response_count || 0} responses</span>
        <span style="margin-left:auto">${fmtDate(sv.created_at)}</span>
      </div>
    </div>`;
  }).join('');
}

async function publishSurvey(id) {
  const r = await api.publishSurvey(id);
  if (r.ok) {
    const slug = r.data.public_slug;
    allSurveys = allSurveys.map(s => s.id === id ? { ...s, status: 'published', public_slug: slug } : s);
    renderSurveys();
    const url = window.location.origin + '/public/surveys/' + slug;
    document.getElementById('pub-url').value = url;
    document.getElementById('btn-copy-link').onclick = () => { navigator.clipboard?.writeText(url); toast('success', 'Link copied!'); };
    openModal('modal-pub-result');
  } else toast('error', r.error.message);
}

function copyLink(slug) {
  const url = window.location.origin + '/public/surveys/' + slug;
  navigator.clipboard?.writeText(url);
  toast('success', 'Link copied!', url);
}

async function runBiasCheck(sid) {
  openModal('modal-bias');
  const r = await api.biasCheck(sid, { questions: [] });
  const body = document.getElementById('bias-body');
  if (!r.ok) { body.innerHTML = '<div class="alert alert-error">' + r.error.message + '</div>'; return; }
  const issues = r.data.issues || [];
  if (issues.length === 0) {
    body.innerHTML = '<div class="alert alert-success">✓ No bias issues found — questions look great!</div>';
    return;
  }
  body.innerHTML = '<div class="alert alert-warn">' + issues.length + ' potential bias issue(s) found</div>' +
    issues.map(iss => `<div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">${badge(iss.severity)}<span style="font-size:12px;color:#64748b">${iss.reason}</span></div>
      <div style="font-size:13px;color:#475569;margin-bottom:8px"><strong>Original:</strong> <em>"${iss.original || ''}"</em></div>
      <div style="font-size:13px;color:#065f46;background:#d1fae5;border:1px solid #a7f3d0;border-radius:7px;padding:8px">
        ✓ <strong>Suggested:</strong> "${iss.suggested_rewrite || ''}"
      </div>
    </div>`).join('');
}

// Events
document.getElementById('btn-new-surv').addEventListener('click', () => openModal('modal-new-surv'));
document.getElementById('btn-ai-gen').addEventListener('click', () => {
  toast('info', 'AI Generator', 'Fill in the survey form and click Create Draft — AI generation requires a survey ID');
  openModal('modal-new-surv');
});
document.getElementById('btn-confirm-surv').addEventListener('click', async () => {
  const title    = document.getElementById('s-title').value.trim();
  const goal     = document.getElementById('s-goal').value.trim();
  const audience = document.getElementById('s-audience').value.trim();
  const lang     = document.getElementById('s-lang').value;
  const pid      = document.getElementById('s-project').value;
  const errEl    = document.getElementById('surv-error');
  errEl.style.display = 'none';
  if (!title || title.length < 3) { errEl.textContent = 'Title must be at least 3 characters.'; errEl.style.display = 'flex'; return; }
  if (!goal) { errEl.textContent = 'Goal is required.'; errEl.style.display = 'flex'; return; }
  if (!pid)  { errEl.textContent = 'Select a project first.'; errEl.style.display = 'flex'; return; }
  const r = await api.createSurvey(pid, { title, goal, target_audience: audience, language: lang, status: 'draft' });
  if (r.ok) {
    const p = allProjects.find(p => p.id === pid);
    allSurveys.push({ ...r.data, _projectName: p?.name, _projectId: pid });
    closeModal('modal-new-surv');
    toast('success', 'Survey created!', title);
    renderSurveys();
  } else { errEl.textContent = r.error.message || 'Failed to create survey.'; errEl.style.display = 'flex'; }
});

document.querySelectorAll('#surv-filter-tabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#surv-filter-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterStatus = btn.dataset.filter;
    renderSurveys();
  });
});
document.getElementById('surv-search').addEventListener('input', e => { searchTerm = e.target.value; renderSurveys(); });
document.getElementById('proj-filter').addEventListener('change', e => { filterProject = e.target.value; renderSurveys(); });

loadData();