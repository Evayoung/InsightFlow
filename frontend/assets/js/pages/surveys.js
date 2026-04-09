if (!requireAuth()) throw '';

const ws = getWorkspace();
let createMode = 'manual';

document.getElementById('root').innerHTML =
  buildSidebar('surveys', 'Surveys') +
  `<div class="page-header">
    <div><h1 class="page-title">Surveys</h1><p class="page-subtitle" id="surv-subtitle">Loading...</p></div>
    <div class="page-actions">
      <button class="btn btn-ai" id="btn-ai-gen">${icon('sparkles')} AI Generate</button>
      <button class="btn btn-primary" id="btn-new-surv">${icon('plus')} New Survey</button>
    </div>
  </div>

  <div class="filter-bar survey-filter-bar">
    <div class="survey-filter-group">
      <div class="search-shell">
        <span class="search-icon">${icon('search')}</span>
        <input class="form-input" id="surv-search" placeholder="Search surveys..."/>
      </div>
      <div class="tabs survey-filter-tabs" id="surv-filter-tabs">
        <button class="tab-btn active" data-filter="all">All</button>
        <button class="tab-btn" data-filter="published">Live</button>
        <button class="tab-btn" data-filter="draft">Draft</button>
        <button class="tab-btn" data-filter="closed">Closed</button>
      </div>
    </div>
    <select class="form-select survey-project-filter" id="proj-filter">
      <option value="">All Projects</option>
    </select>
  </div>

  <div id="surveys-list"></div>` +
  closeSidebar();

initSidebar();

let allSurveys = [], allProjects = [], filterStatus = 'all', filterProject = '', searchTerm = '';

function surveyEditorHref(id, mode) {
  const url = new URL('survey-editor.html', window.location.href);
  url.searchParams.set('survey', id);
  if (mode) url.searchParams.set('mode', mode);
  return url.pathname + url.search;
}

function openCreateModal(mode) {
  createMode = mode;
  document.getElementById('survey-modal-title').textContent = mode === 'ai' ? 'Create AI Survey' : 'Create Survey';
  document.getElementById('btn-confirm-surv').textContent = mode === 'ai' ? 'Create Draft and Generate' : 'Create Draft';
  document.getElementById('ai-create-fields').classList.toggle('hidden', mode !== 'ai');
  openModal('modal-new-surv');
}

function getCreateAiConfig() {
  return {
    question_count: Number(document.getElementById('s-ai-count').value || 8),
    tone: document.getElementById('s-ai-tone').value || 'neutral',
    constraints: document.getElementById('s-ai-constraints').value.split(/\r?\n/).map(item => item.trim()).filter(Boolean),
  };
}

async function loadData() {
  if (!ws.id) {
    document.getElementById('surveys-list').innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon">' + icon('building') + '</div><p class="empty-title">No workspace selected</p><a href="workspaces.html" class="btn btn-primary">Go to Workspaces</a></div></div>';
    return;
  }

  const pr = await api.listProjects(ws.id);
  if (!pr.ok) { toast('error', pr.error.message); return; }
  allProjects = pr.data.items || pr.data;

  const projSel = document.getElementById('proj-filter');
  projSel.innerHTML = '<option value="">All Projects</option>' + allProjects.map(p => '<option value="' + p.id + '">' + p.name + '</option>').join('');

  const sProjSel = document.getElementById('s-project');
  const active = allProjects.filter(p => p.status === 'active');
  sProjSel.innerHTML = active.length === 0
    ? '<option value="">No active projects - create one first</option>'
    : active.map(p => '<option value="' + p.id + '">' + p.name + '</option>').join('');

  allSurveys = [];
  document.getElementById('surveys-list').innerHTML = '<div class="loading-state"><span class="spinner-dark"></span> Loading surveys...</div>';
  await Promise.all(allProjects.map(async p => {
    const r = await api.listSurveys(p.id);
    if (r.ok) (r.data.items || r.data).forEach(s => allSurveys.push({ ...s, _projectName: p.name, _projectId: p.id }));
  }));

  const params = new URLSearchParams(window.location.search);
  if (params.get('project')) filterProject = params.get('project');
  if (params.get('action') === 'new') { openCreateModal('manual'); history.replaceState(null, '', window.location.pathname); }

  document.getElementById('surv-subtitle').textContent = allSurveys.length + ' surveys across ' + allProjects.length + ' projects';
  renderSurveys();
}

function getCompletionMeta(sv) {
  const comp = sv.completion_rate ? Math.round(sv.completion_rate * 100) : 0;
  const color = comp > 70 ? '#10b981' : comp > 40 ? '#f59e0b' : '#ef4444';
  return { comp, color };
}

function renderSurveys() {
  const filtered = allSurveys
    .filter(s => filterStatus === 'all' || s.status === filterStatus)
    .filter(s => !filterProject || s._projectId === filterProject)
    .filter(s => !searchTerm || s.title.toLowerCase().includes(searchTerm.toLowerCase()));

  if (filtered.length === 0) {
    document.getElementById('surveys-list').innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon">' + icon('clipboard') + '</div><p class="empty-title">' + (searchTerm ? 'No surveys match your search' : 'No surveys yet') + '</p><p class="empty-desc">' + (searchTerm ? 'Try a different search term.' : 'Create your first survey.') + '</p>' + (searchTerm ? '' : '<div class="page-actions"><button class="btn btn-ai" onclick="openCreateModal(&quot;ai&quot;)">' + icon('sparkles') + ' AI Generate</button><button class="btn btn-primary" onclick="openCreateModal(&quot;manual&quot;)">' + icon('plus') + ' New Survey</button></div>') + '</div></div>';
    return;
  }

  document.getElementById('surveys-list').innerHTML = filtered.map(sv => {
    const { comp, color } = getCompletionMeta(sv);
    const editorHref = surveyEditorHref(sv.id);
    let actions = '<a href="' + editorHref + '" class="btn btn-ghost btn-sm" onclick="event.stopPropagation()">Edit</a>';
    if (sv.status === 'published' && sv.public_slug) {
      actions += '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();copyLink(&quot;' + sv.public_slug + '&quot;)">' + icon('link') + ' Share</button>';
    }
    if (sv.status === 'draft') {
      actions += '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();publishSurvey(&quot;' + sv.id + '&quot;)">' + icon('globe') + ' Publish</button>';
    }
    actions += '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();runBiasCheck(&quot;' + sv.id + '&quot;)">' + icon('sparkles') + ' Bias</button>';
    actions += '<a href="responses.html?survey=' + sv.id + '" class="btn btn-ghost btn-sm" onclick="event.stopPropagation()">Responses</a>';
    return `<div class="survey-card" style="margin-bottom:10px" onclick="window.location.href='${editorHref}'">
      <div class="survey-card-head">
        <div>
          <h3 class="survey-card-title">${sv.title}</h3>
          <div class="survey-card-meta">${badge(sv.status)}${sv.generated_by_ai ? badge('positive') : ''}<span class="survey-project-name">${sv._projectName || ''}</span></div>
        </div>
        <div class="survey-card-actions">${actions}</div>
      </div>
      <p class="survey-card-copy">${sv.goal || sv.description || 'No description.'}</p>
      <div class="survey-card-progress">
        <div class="prog-track"><div class="prog-fill" style="width:${comp}%;background:${color}"></div></div>
        <span class="survey-card-progress-text">${comp}% completion</span>
      </div>
      <div class="survey-card-footer">
        <span>${sv.response_count || 0} responses</span>
        <span class="end">${fmtDate(sv.created_at)}</span>
      </div>
    </div>`;
  }).join('');
}

async function publishSurvey(id) {
  const r = await api.publishSurvey(id, {});
  if (r.ok) {
    allSurveys = allSurveys.map(s => s.id === id ? { ...s, status: 'published', public_slug: r.data.public_slug } : s);
    renderSurveys();
    const url = buildPublicSurveyUrl(r.data.public_slug);
    document.getElementById('pub-url').value = url;
    document.getElementById('btn-copy-link').onclick = () => { navigator.clipboard?.writeText(url); toast('success', 'Link copied'); };
    openModal('modal-pub-result');
  } else toast('error', r.error.message || 'Unable to publish survey');
}

function copyLink(slug) {
  const url = buildPublicSurveyUrl(slug);
  navigator.clipboard?.writeText(url);
  toast('success', 'Link copied', url);
}

async function runBiasCheck(sid) {
  openModal('modal-bias');
  const r = await api.biasCheck(sid, { questions: [] });
  const body = document.getElementById('bias-body');
  if (!r.ok) { body.innerHTML = '<div class="alert alert-error">' + r.error.message + '</div>'; return; }
  const issues = r.data.issues || [];
  if (issues.length === 0) {
    body.innerHTML = '<div class="alert alert-success">' + icon('checkCircle') + ' No bias issues found - questions look great.</div>';
    return;
  }
  body.innerHTML = '<div class="alert alert-warn">' + issues.length + ' potential bias issue(s) found</div>' +
    issues.map(iss => `<div class="card bias-issue-card">
      <div class="card-body">
      <div class="bias-issue-head">${badge(iss.severity)}<span class="inline-note">${iss.reason}</span></div>
      <div class="bias-issue-copy"><strong>Suggested rewrite:</strong> ${iss.suggested_rewrite || ''}</div>
      </div>
    </div>`).join('');
}

async function createSurveyDraft() {
  const title = document.getElementById('s-title').value.trim();
  const goal = document.getElementById('s-goal').value.trim();
  const audience = document.getElementById('s-audience').value.trim();
  const lang = document.getElementById('s-lang').value;
  const pid = document.getElementById('s-project').value;
  const errEl = document.getElementById('surv-error');
  errEl.style.display = 'none';
  if (!title || title.length < 3) { errEl.textContent = 'Title must be at least 3 characters.'; errEl.style.display = 'flex'; return; }
  if (!goal) { errEl.textContent = 'Goal is required.'; errEl.style.display = 'flex'; return; }
  if (!pid) { errEl.textContent = 'Select a project first.'; errEl.style.display = 'flex'; return; }
  const r = await api.createSurvey(pid, { title, goal, target_audience: audience, language: lang });
  if (!r.ok) {
    errEl.textContent = r.error.message || 'Failed to create survey.';
    errEl.style.display = 'flex';
    return;
  }

  closeModal('modal-new-surv');
  if (createMode === 'ai') {
    const config = getCreateAiConfig();
    sessionStorage.setItem('if_pending_ai:' + r.data.id, JSON.stringify({
      goal,
      target_audience: audience || null,
      question_count: config.question_count,
      tone: config.tone,
      constraints: config.constraints,
    }));
    window.location.href = surveyEditorHref(r.data.id, 'ai');
    return;
  }
  window.location.href = surveyEditorHref(r.data.id, 'manual');
}

window.openCreateModal = openCreateModal;
document.getElementById('btn-new-surv').addEventListener('click', () => openCreateModal('manual'));
document.getElementById('btn-ai-gen').addEventListener('click', () => openCreateModal('ai'));
document.getElementById('btn-confirm-surv').addEventListener('click', createSurveyDraft);
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
