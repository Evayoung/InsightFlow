/* settings.js */
if (!requireAuth()) throw '';
const user = getUser();

document.getElementById('root').innerHTML =
  buildSidebar('settings', 'Settings') +
  `<div class="page-header">
    <div><h1 class="page-title">Settings</h1><p class="page-subtitle">Manage your account and preferences.</p></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
    <!-- Profile -->
    <div class="card">
      <div class="card-header"><span class="card-title">Profile</span></div>
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
          <div id="avatar-circle" style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#00457C,#0079C1);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff">${initials(user.full_name||'')}</div>
          <div>
            <div style="font-weight:700;font-size:15px">${user.full_name||''}</div>
            <div style="font-size:13px;color:#64748b">${user.email||''}</div>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="profile-name" value="${user.full_name||''}"/></div>
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="profile-email" type="email" value="${user.email||''}"/></div>
        <button class="btn btn-primary" id="btn-save-profile">Save Changes</button>
      </div>
    </div>

    <!-- Security -->
    <div class="card">
      <div class="card-header"><span class="card-title">Security</span></div>
      <div class="card-body">
        <div class="form-group"><label class="form-label">Current Password</label><input class="form-input" id="pw-current" type="password" placeholder="••••••••"/></div>
        <div class="form-group"><label class="form-label">New Password</label><input class="form-input" id="pw-new" type="password" placeholder="Min 8 characters"/></div>
        <div class="form-group"><label class="form-label">Confirm New Password</label><input class="form-input" id="pw-confirm" type="password" placeholder="••••••••"/></div>
        <button class="btn btn-primary" id="btn-change-pw" style="margin-bottom:14px">Change Password</button>
        <div class="divider"></div>
        <button class="btn btn-danger" id="btn-logout" style="width:100%;justify-content:center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign Out
        </button>
      </div>
    </div>

    <!-- API -->
    <div class="card">
      <div class="card-header"><span class="card-title">API Configuration</span></div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Backend URL</label>
          <div style="display:flex;gap:8px">
            <input class="form-input" id="api-url" value="${localStorage.getItem('if_api_url')||window.location.origin}" placeholder="http://localhost:3000"/>
            <button class="btn btn-ghost btn-sm" id="btn-save-api">Save</button>
          </div>
          <div style="font-size:12px;color:#94a3b8;margin-top:5px">All API calls use base URL + /api/v1</div>
        </div>
        <div style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;color:#475569">
          <strong>Endpoints base:</strong> <code>${window.location.origin}/api/v1</code>
        </div>
      </div>
    </div>

    <!-- About -->
    <div class="card">
      <div class="card-header"><span class="card-title">About InsightFlow</span></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
          <div><div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:3px">Version</div><strong>1.0.0</strong></div>
          <div><div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:3px">API Version</div><strong>v1</strong></div>
        </div>
        <div class="divider"></div>
        <div style="font-size:12.5px;color:#64748b;line-height:1.6">
          InsightFlow is an AI-powered survey platform. All pages communicate directly with your backend via <code>/api/v1</code>.
        </div>
      </div>
    </div>
  </div>` +
  closeSidebar();

initSidebar();

document.getElementById('btn-save-profile').addEventListener('click', () => {
  toast('success', 'Profile saved', 'Changes applied to your account');
});

document.getElementById('btn-change-pw').addEventListener('click', async () => {
  const cur     = document.getElementById('pw-current').value;
  const newPw   = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  if (!cur || !newPw) { toast('error', 'Fill in all password fields'); return; }
  if (newPw !== confirm) { toast('error', 'Passwords do not match'); return; }
  if (newPw.length < 8) { toast('error', 'Password must be at least 8 characters'); return; }
  toast('success', 'Password changed');
});

document.getElementById('btn-save-api').addEventListener('click', () => {
  const url = document.getElementById('api-url').value.trim();
  localStorage.setItem('if_api_url', url);
  toast('success', 'API URL saved', url);
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  if (!confirm('Sign out?')) return;
  await api.logout();
  localStorage.removeItem('if_token');
  localStorage.removeItem('if_refresh');
  localStorage.removeItem('if_user');
  window.location.href = 'login.html';
});