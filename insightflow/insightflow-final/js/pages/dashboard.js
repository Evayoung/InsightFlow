/* dashboard.js */
if (!requireAuth()) throw '';

const ws   = getWorkspace();
const user = getUser();

document.getElementById('root').innerHTML =
  buildSidebar('dashboard', 'Dashboard') +
  `<div class="page-header">
    <div>
      <h1 class="page-title" id="greeting">Good day</h1>
      <p class="page-subtitle">Here's what's happening across your workspace.</p>
    </div>
    <button class="btn btn-primary" id="btn-new-survey">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      New Survey
    </button>
  </div>

  <!-- Stats -->
  <div class="stats-grid" id="stats-grid">
    <div class="stat-card" style="--bar:linear-gradient(90deg,#00457C,#0079C1)"><div class="stat-label">Active Projects</div><div class="stat-value" id="st-projects">—</div></div>
    <div class="stat-card" style="--bar:linear-gradient(90deg,#0079C1,#00B4E6)"><div class="stat-label">Live Surveys</div><div class="stat-value" id="st-surveys">—</div></div>
    <div class="stat-card" style="--bar:linear-gradient(90deg,#0e7490,#06b6d4)"><div class="stat-label">Total Responses</div><div class="stat-value" id="st-responses">—</div></div>
    <div class="stat-card" style="--bar:linear-gradient(90deg,#6d28d9,#8b5cf6)"><div class="stat-label">Avg Completion</div><div class="stat-value" id="st-completion">—</div></div>
  </div>

  <!-- Recent surveys table -->
  <div class="card">
    <div class="card-header">
      <span class="card-title">Recent Surveys</span>
      <a href="surveys.html" class="btn btn-ghost btn-sm">See all →</a>
    </div>
    <div id="surveys-wrap">
      <div style="display:flex;align-items:center;justify-content:center;padding:48px;gap:10px;color:#94a3b8">
        <span class="spinner-dark"></span> Loading surveys…
      </div>
    </div>
  </div>` +
  closeSidebar();

initSidebar();

// Set greeting
const hour = new Date().getHours();
const name = (user.full_name || 'there').split(' ')[0];
document.getElementById('greeting').textContent =
  (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening') + ', ' + name + ' 👋';

// Load data
async function loadDashboard() {
  if (!ws.id) {
    document.getElementById('surveys-wrap').innerHTML =
      '<div class="empty-state"><div class="empty-icon">🏢</div><p class="empty-title">No workspace selected</p><p class="empty-desc">Create or select a workspace to get started.</p><a href="workspaces.html" class="btn btn-primary">Go to Workspaces</a></div>';
    return;
  }

  // Analytics
  const an = await api.wsAnalytics(ws.id);
  if (an.ok) {
    const d = an.data;
    document.getElementById('st-projects').textContent  = d.total_projects || 0;
    document.getElementById('st-surveys').textContent   = d.live_surveys || 0;
    document.getElementById('st-responses').textContent = (d.total_responses || 0).toLocaleString();
    document.getElementById('st-completion').textContent = Math.round((d.avg_completion || 0) * 100) + '%';
  }

  // Projects → surveys
  const pr = await api.listProjects(ws.id);
  if (!pr.ok) { document.getElementById('surveys-wrap').innerHTML = '<div class="empty-state"><div class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></svg></div><p class="empty-title">No surveys yet</p><p class="empty-desc">Create a project and add your first survey.</p></div>'; return; }

  const projects = pr.data.items || pr.data;
  if (projects.length === 0) {
    document.getElementById('surveys-wrap').innerHTML = '<div class="empty-state"><div class="empty-icon">📁</div><p class="empty-title">No projects yet</p><p class="empty-desc">Create a project to organise your surveys.</p><a href="projects.html" class="btn btn-primary">Create Project</a></div>';
    return;
  }

  let allSurveys = [];
  for (const p of projects.slice(0, 3)) {
    const r = await api.listSurveys(p.id);
    if (r.ok) (r.data.items || r.data).forEach(s => allSurveys.push({ ...s, _project: p.name }));
  }

  if (allSurveys.length === 0) {
    document.getElementById('surveys-wrap').innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p class="empty-title">No surveys yet</p><p class="empty-desc">Create your first survey to start collecting responses.</p><a href="surveys.html" class="btn btn-primary">Create Survey</a></div>';
    return;
  }

  const rows = allSurveys.slice(0, 8).map(sv => {
    const comp = sv.completion_rate ? Math.round(sv.completion_rate * 100) : 0;
    const pc   = comp > 70 ? '#10b981' : comp > 40 ? '#f59e0b' : '#ef4444';
    return `<tr onclick="window.location.href='responses.html?survey=${sv.id}'">
      <td style="font-weight:600">${sv.title}</td>
      <td style="color:#64748b;font-size:12.5px">${sv._project || ''}</td>
      <td>${badge(sv.status)}</td>
      <td>${sv.response_count || 0}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="prog-track" style="width:72px"><div class="prog-fill" style="width:${comp}%;background:${pc}"></div></div>
          <span style="font-size:11.5px;color:#94a3b8">${comp}%</span>
        </div>
      </td>
      <td><a href="responses.html?survey=${sv.id}" class="btn btn-ghost btn-sm" onclick="event.stopPropagation()">View</a></td>
    </tr>`;
  }).join('');

  document.getElementById('surveys-wrap').innerHTML =
    '<div class="table-wrap"><table class="data-table"><thead><tr><th>Survey</th><th>Project</th><th>Status</th><th>Responses</th><th>Completion</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

loadDashboard();

document.getElementById('btn-new-survey').addEventListener('click', () => {
  window.location.href = 'surveys.html?action=new';
});