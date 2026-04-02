/* workspaces.js */
if (!requireAuth()) throw '';

document.getElementById('root').innerHTML =
  buildSidebar('workspaces', 'Workspaces') +
  `<div class="page-header">
    <div><h1 class="page-title">Workspaces</h1><p class="page-subtitle">Manage your workspaces and team members.</p></div>
    <button class="btn btn-primary" onclick="openModal('modal-new-ws')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Workspace
    </button>
  </div>
  <div id="ws-cards" class="grid-3 mb-4" style="margin-bottom:20px"></div>
  <div class="card" id="detail-card" style="display:none">
    <div class="card-header">
      <span class="card-title" id="detail-title">Workspace Detail</span>
      <button class="btn btn-primary btn-sm" onclick="openModal('modal-invite')" id="btn-invite">Invite Member</button>
    </div>
    <div class="tabs" style="padding:0 20px;margin-bottom:0" id="ws-tabs">
      <button class="tab-btn active" data-tab="overview">Overview</button>
      <button class="tab-btn" data-tab="members">Members</button>
      <button class="tab-btn" data-tab="settings">Settings</button>
    </div>
    <div id="tab-content" class="card-body"></div>
  </div>` +
  closeSidebar();

initSidebar();

let currentWsId = getWorkspace().id;
let workspaces = [];

async function loadWorkspaces() {
  const r = await api.listWorkspaces();
  if (!r.ok) { toast('error', r.error.message); return; }
  workspaces = r.data.items || r.data;
  renderCards();
  if (currentWsId) showDetail(currentWsId);
  else if (workspaces.length) showDetail(workspaces[0].id);
}

function renderCards() {
  document.getElementById('ws-cards').innerHTML = workspaces.map(w => {
    const active = w.id === currentWsId;
    const abbr = w.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
    return `<div class="card" style="cursor:pointer;padding:20px;border:${active?'2px solid #0079C1':'1px solid #e2e8f0'}" onclick="showDetail('${w.id}')">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="width:40px;height:40px;border-radius:10px;background:${colorOf(w.name)};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff">${abbr}</div>
        <div>
          <div style="font-family:'Instrument Serif',serif;font-style:italic;font-weight:700;color:#1a2332">${w.name}</div>
          ${badge('active')}
        </div>
        ${active ? '<span style="margin-left:auto;color:#0079C1;font-size:18px">✓</span>' : ''}
      </div>
      <div style="font-size:12.5px;color:#64748b">Created ${fmtDate(w.created_at)}</div>
    </div>`;
  }).join('') + `<div class="card" style="cursor:pointer;padding:20px;border:2px dashed #e2e8f0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:110px;gap:8px;color:#94a3b8" onclick="openModal('modal-new-ws')">
    <div style="font-size:22px">+</div>
    <div style="font-size:13px;font-weight:600">New Workspace</div>
  </div>`;
}

async function showDetail(wsId) {
  currentWsId = wsId;
  localStorage.setItem('if_workspace', JSON.stringify({ id: wsId, name: workspaces.find(w=>w.id===wsId)?.name || '' }));
  const ws = workspaces.find(w => w.id === wsId) || {};
  document.getElementById('detail-card').style.display = '';
  document.getElementById('detail-title').textContent = ws.name + ' — Detail';
  renderCards();
  showTab('overview');
}

async function showTab(tab) {
  document.querySelectorAll('#ws-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const ws = workspaces.find(w => w.id === currentWsId) || {};
  const el = document.getElementById('tab-content');

  if (tab === 'overview') {
    const an = await api.wsAnalytics(currentWsId);
    const d  = an.ok ? an.data : {};
    el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div><div class="stat-label">Name</div><strong>${ws.name}</strong></div>
      <div><div class="stat-label">Total Surveys</div><strong>${d.total_surveys || 0}</strong></div>
      <div><div class="stat-label">Total Responses</div><strong>${(d.total_responses || 0).toLocaleString()}</strong></div>
      <div><div class="stat-label">Avg Completion</div><strong>${Math.round((d.avg_completion||0)*100)}%</strong></div>
      <div><div class="stat-label">Created</div><span style="color:#64748b;font-size:13px">${fmtDate(ws.created_at)}</span></div>
    </div>`;
  } else if (tab === 'members') {
    el.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:20px;color:#94a3b8"><span class="spinner-dark"></span> Loading members…</div>';
    const r = await api.listMembers(currentWsId);
    if (!r.ok) { el.innerHTML = '<div class="alert alert-error">' + r.error.message + '</div>'; return; }
    const members = r.data.items || r.data;
    el.innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
      <tbody>${members.map(m => `<tr>
        <td><div style="display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:50%;background:${colorOf(m.full_name||m.email)};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0">${initials(m.full_name||m.email)}</div>
          <span style="font-weight:600">${m.full_name || '—'}</span></div></td>
        <td style="color:#64748b">${m.email}</td>
        <td>${badge(m.role)}</td>
        <td>${badge(m.status)}</td>
        <td style="color:#64748b;font-size:12.5px">${m.joined_at ? fmtDate(m.joined_at) : 'Pending'}</td>
        <td>${m.role !== 'owner' ? `<button class="btn btn-danger btn-sm" onclick="removeMember('${m.id}','${m.email}')">Remove</button>` : ''}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } else {
    el.innerHTML = `<div style="max-width:380px">
      <div class="form-group"><label class="form-label">Workspace Name</label><input class="form-input" id="ws-name-edit" value="${ws.name}"/></div>
      <button class="btn btn-primary" id="btn-save-ws">Save Changes</button>
      <div class="divider"></div>
      <button class="btn btn-danger" onclick="if(confirm('Delete this workspace? This cannot be undone.')) toast('error','Not implemented','Contact support to delete a workspace')">Delete Workspace</button>
    </div>`;
    document.getElementById('btn-save-ws').addEventListener('click', async () => {
      const name = document.getElementById('ws-name-edit').value.trim();
      if (!name) return;
      const r = await api.updateWorkspace(currentWsId, { name });
      if (r.ok) {
        workspaces = workspaces.map(w => w.id === currentWsId ? { ...w, name } : w);
        localStorage.setItem('if_workspace', JSON.stringify({ id: currentWsId, name }));
        toast('success', 'Workspace updated', name);
        renderCards();
        document.getElementById('detail-title').textContent = name + ' — Detail';
      } else toast('error', r.error.message);
    });
  }
}

async function removeMember(mid, email) {
  if (!confirm('Remove ' + email + ' from this workspace?')) return;
  const r = await api.removeMember(currentWsId, mid);
  if (r.ok || r.status === 204) { toast('success', 'Member removed', email); showTab('members'); }
  else toast('error', r.error.message);
}

// Tab click
document.addEventListener('click', e => {
  const tb = e.target.closest('#ws-tabs .tab-btn');
  if (tb) showTab(tb.dataset.tab);
});

// Create workspace
document.getElementById('btn-confirm-ws').addEventListener('click', async () => {
  const name = document.getElementById('new-ws-name').value.trim();
  if (!name) { toast('error', 'Name required'); return; }
  const r = await api.createWorkspace({ name });
  if (r.ok) {
    workspaces.push(r.data);
    closeModal('modal-new-ws');
    document.getElementById('new-ws-name').value = '';
    toast('success', 'Workspace created!', name);
    renderCards();
    showDetail(r.data.id);
  } else toast('error', r.error.message);
});

// Invite member
document.getElementById('btn-confirm-invite').addEventListener('click', async () => {
  const email = document.getElementById('invite-email').value.trim();
  const role  = document.getElementById('invite-role').value;
  if (!email) { toast('error', 'Email required'); return; }
  const r = await api.inviteMember(currentWsId, { email, role });
  if (r.ok) { toast('success', 'Invite sent!', email); closeModal('modal-invite'); showTab('members'); }
  else toast('error', r.error.message);
});

loadWorkspaces();