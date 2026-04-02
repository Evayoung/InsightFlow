/* projects.js */
if (!requireAuth()) throw '';

const ws = getWorkspace();

document.getElementById('root').innerHTML =
  buildSidebar('projects', 'Projects') +
  `<div class="page-header">
    <div><h1 class="page-title">Projects</h1><p class="page-subtitle" id="proj-subtitle">Loading projects…</p></div>
    <div style="display:flex;gap:8px">
      <select class="form-select" id="filter-status" style="width:auto;font-size:13px;padding:6px 10px">
        <option value="all">All</option><option value="active">Active</option><option value="archived">Archived</option>
      </select>
      <button class="btn btn-primary" onclick="openModal('modal-new-proj')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Project
      </button>
    </div>
  </div>
  <div id="projects-grid" class="grid-2"></div>` +
  closeSidebar();

initSidebar();

let allProjects = [];

async function loadProjects() {
  if (!ws.id) {
    document.getElementById('projects-grid').innerHTML = '<div class="card" style="grid-column:1/-1"><div class="empty-state"><div class="empty-icon">🏢</div><p class="empty-title">No workspace selected</p><p class="empty-desc">Select a workspace first.</p><a href="workspaces.html" class="btn btn-primary">Go to Workspaces</a></div></div>';
    return;
  }

  document.getElementById('projects-grid').innerHTML = '<div style="grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:48px;justify-content:center;color:#94a3b8"><span class="spinner-dark"></span> Loading projects…</div>';

  const r = await api.listProjects(ws.id);
  if (!r.ok) { toast('error', r.error.message); return; }
  allProjects = r.data.items || r.data;
  document.getElementById('proj-subtitle').textContent = allProjects.length + ' project' + (allProjects.length !== 1 ? 's' : '') + ' in ' + ws.name;
  renderProjects();
}

function renderProjects() {
  const filter = document.getElementById('filter-status').value;
  const filtered = filter === 'all' ? allProjects : allProjects.filter(p => p.status === filter);

  if (filtered.length === 0) {
    document.getElementById('projects-grid').innerHTML = '<div class="card" style="grid-column:1/-1"><div class="empty-state"><div class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div><p class="empty-title">No projects yet</p><p class="empty-desc">Create a project to organise your surveys.</p><button class="btn btn-primary" onclick="openModal('modal-new-proj')">+ New Project</button></div></div>';
    return;
  }

  document.getElementById('projects-grid').innerHTML = filtered.map(p => `
    <div class="card" style="padding:20px;cursor:pointer" onclick="window.location.href='surveys.html?project=${p.id}'">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
        <div>
          <div style="font-family:'Instrument Serif',serif;font-style:italic;font-weight:700;font-size:15px;margin-bottom:6px">${p.name}</div>
          ${badge(p.status)}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();archiveProject('${p.id}','${p.name}')" title="Archive"
          style="flex-shrink:0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        </button>
      </div>
      <p style="font-size:13px;color:#64748b;margin-bottom:14px;line-height:1.5">${p.description || 'No description.'}</p>
      <div style="display:flex;align-items:center;gap:16px;font-size:12.5px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:12px">
        <span>Created ${fmtDate(p.created_at)}</span>
        <a href="surveys.html?project=${p.id}" class="btn btn-primary btn-sm" onclick="event.stopPropagation()" style="margin-left:auto">View Surveys</a>
      </div>
    </div>
  `).join('');
}

async function archiveProject(id, name) {
  if (!confirm('Archive "' + name + '"? Data is preserved.')) return;
  const r = await api.archiveProject(id);
  if (r.ok || r.status === 204) {
    allProjects = allProjects.map(p => p.id === id ? { ...p, status: 'archived' } : p);
    toast('success', 'Project archived', name);
    renderProjects();
  } else toast('error', r.error.message);
}

document.getElementById('btn-confirm-proj').addEventListener('click', async () => {
  const name = document.getElementById('new-proj-name').value.trim();
  const desc = document.getElementById('new-proj-desc').value.trim();
  if (!name) { toast('error', 'Name required'); return; }
  const r = await api.createProject(ws.id, { name, description: desc, status: 'active' });
  if (r.ok) {
    allProjects.push(r.data);
    closeModal('modal-new-proj');
    document.getElementById('new-proj-name').value = '';
    document.getElementById('new-proj-desc').value = '';
    toast('success', 'Project created!', name);
    renderProjects();
  } else toast('error', r.error.message);
});

document.getElementById('filter-status').addEventListener('change', renderProjects);

loadProjects();