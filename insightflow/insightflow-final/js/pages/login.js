/* login.js */
// Redirect if already logged in
if (localStorage.getItem('if_token')) {
  window.location.href = 'dashboard.html';
}

// Tab switching
document.querySelectorAll('.auth-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('form-login').style.display   = tab === 'login'  ? '' : 'none';
    document.getElementById('form-signup').style.display  = tab === 'signup' ? '' : 'none';
  });
});

// Login
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-pw').value;
  const errEl = document.getElementById('auth-error');
  const btn   = document.getElementById('btn-login');
  if (!email || !pw) { showErr(errEl, 'Please fill in all fields'); return; }
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in…';
  const r = await api.login({ email, password: pw });
  if (r.ok) {
    localStorage.setItem('if_token',   r.data.tokens.access_token);
    localStorage.setItem('if_refresh', r.data.tokens.refresh_token);
    localStorage.setItem('if_user',    JSON.stringify(r.data.user));
    // Load first workspace
    const wsRes = await api.listWorkspaces();
    if (wsRes.ok) {
      const ws = (wsRes.data.items || wsRes.data)[0];
      if (ws) localStorage.setItem('if_workspace', JSON.stringify({ id: ws.id, name: ws.name }));
    }
    window.location.href = 'dashboard.html';
  } else {
    btn.disabled = false;
    btn.innerHTML = 'Sign in';
    showErr(errEl, r.error.message || 'Login failed. Check your credentials.');
  }
}

// Signup
async function doSignup() {
  const name  = document.getElementById('su-name').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const pw    = document.getElementById('su-pw').value;
  const errEl = document.getElementById('signup-error');
  const btn   = document.getElementById('btn-signup');
  if (!name || !email || !pw) { showErr(errEl, 'Please fill in all fields'); return; }
  if (pw.length < 8) { showErr(errEl, 'Password must be at least 8 characters'); return; }
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating…';
  const r = await api.register({ full_name: name, email, password: pw });
  if (r.ok) {
    localStorage.setItem('if_token',   r.data.tokens.access_token);
    localStorage.setItem('if_refresh', r.data.tokens.refresh_token);
    localStorage.setItem('if_user',    JSON.stringify(r.data.user));
    window.location.href = 'dashboard.html';
  } else {
    btn.disabled = false;
    btn.innerHTML = 'Create account';
    const msg = r.error.code === 'EMAIL_ALREADY_EXISTS' ? 'That email is already registered.' : (r.error.message || 'Signup failed.');
    showErr(errEl, msg);
  }
}

function showErr(el, msg) {
  el.style.display = 'flex';
  el.querySelector('span:last-child').textContent = msg;
}

document.getElementById('btn-login').addEventListener('click', doLogin);
document.getElementById('btn-signup').addEventListener('click', doSignup);
document.getElementById('login-pw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('btn-forgot').addEventListener('click', e => {
  e.preventDefault();
  toast('info', 'Password reset', 'Contact your administrator to reset your password');
});