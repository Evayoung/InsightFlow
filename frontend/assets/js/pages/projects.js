if (!requireAuth()) throw '';

document.getElementById('root').innerHTML =
  buildSidebar('projects', 'Projects') +
  `<div class="page-header">
    <div><h1 class="page-title">Projects</h1><p class="page-subtitle" id="proj-subtitle">Loading projects...</p></div>
    <div class="page-actions">
      <select class="form-select" id="filter-status" style="width:auto;font-size:13px;padding:6px 10px">
        <option value="all">All</option><option value="active">Active</option><option value="archived">Archived</option>
      </select>
      <button class="btn btn-primary" onclick="openModal('modal-new-proj')">
        ${icon('plus')} New Project
      </button>
    </div>
  </div>
  <div id="projects-grid" class="grid-2"></div>` +
  closeSidebar();

initSidebar();

let allProjects = [];

async function resolveWorkspace() {
  let workspace = getWorkspace();
  if (workspace.id) return workspace;

  const response = await api.listWorkspaces();
  if (!response.ok) return {};

  const workspaces = response.data.items || response.data || [];
  const firstWorkspace = workspaces[0];
  if (!firstWorkspace || !firstWorkspace.id) return {};

  workspace = { id: firstWorkspace.id, name: firstWorkspace.name || '' };
  localStorage.setItem('if_workspace', JSON.stringify(workspace));
  return workspace;
}

async function loadProjects() {
  const ws = await resolveWorkspace();
  if (!ws.id) {
    document.getElementById('projects-grid').innerHTML = '<div class="card" style="grid-column:1/-1"><div class="empty-state"><div class="empty-icon">' + icon('building') + '</div><p class="empty-title">No workspace selected</p><p class="empty-desc">Select a workspace first.</p><a href="workspaces.html" class="btn btn-primary">Go to Workspaces</a></div></div>';
    document.getElementById('proj-subtitle').textContent = 'Select or create a workspace to continue.';
    return;
  }

  document.getElementById('projects-grid').innerHTML = '<div style="grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:48px;justify-content:center;color:#94a3b8"><span class="spinner-dark"></span> Loading projects...</div>';

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
    document.getElementById('projects-grid').innerHTML = '<div class="card" style="grid-column:1/-1"><div class="empty-state"><div class="empty-icon">' + icon('folder') + '</div><p class="empty-title">No projects yet</p><p class="empty-desc">Create a project to organise your surveys.</p><button class="btn btn-primary" onclick="openModal(&quot;modal-new-proj&quot;)">' + icon('plus') + ' New Project</button></div></div>';
    return;
  }

  document.getElementById('projects-grid').innerHTML = filtered.map(p => `
    <div class="card" style="padding:20px;cursor:pointer" onclick="window.location.href='surveys.html?project=${p.id}'">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-family:'Plus Jakarta Sans',sans-serif;font-style:normal;font-weight:700;font-size:15px;margin-bottom:6px">${p.name}</div>
          ${badge(p.status)}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();archiveProject('${p.id}','${p.name}')" title="Archive" style="flex-shrink:0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        </button>
      </div>
      <p style="font-size:13px;color:#64748b;margin-bottom:14px;line-height:1.5">${p.description || 'No description.'}</p>
      <div style="display:flex;align-items:center;gap:16px;font-size:12.5px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:12px;flex-wrap:wrap">
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
  const ws = await resolveWorkspace();
  const name = document.getElementById('new-proj-name').value.trim();
  const desc = document.getElementById('new-proj-desc').value.trim();
  if (!name) { toast('error', 'Name required'); return; }
  if (!ws.id) { toast('error', 'Select a workspace first'); return; }
  const r = await api.createProject(ws.id, { name, description: desc, status: 'active' });
  if (r.ok) {
    allProjects.push(r.data);
    closeModal('modal-new-proj');
    document.getElementById('new-proj-name').value = '';
    document.getElementById('new-proj-desc').value = '';
    toast('success', 'Project created', name);
    renderProjects();
  } else toast('error', r.error.message);
});

document.getElementById('filter-status').addEventListener('change', renderProjects);

loadProjects();


