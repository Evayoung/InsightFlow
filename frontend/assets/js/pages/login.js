function toast(type, msg, dur = 4000) {
  const rack = document.getElementById('toast-rack');
  const icons = { success: 'OK', error: '!', info: 'i' };
  const colors = { success: '#34d399', error: '#f87171', info: '#60a5fa' };
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span style="color:${colors[type]||'#60a5fa'};font-size:16px;flex-shrink:0">${icons[type]||'i'}</span><span>${msg}</span>`;
  rack.appendChild(el);
  setTimeout(() => el.style.opacity = '0', dur - 300);
  setTimeout(() => el.remove(), dur);
}

let currentTab = 'login';

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('form-login').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('form-signup').style.display = tab === 'signup' ? '' : 'none';
  document.getElementById('form-forgot').style.display = 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('err-box').classList.remove('show');

  const heads = {
    login: ['Welcome back', 'Sign in to your account to continue'],
    signup: ['Create account', 'Join InsightFlow and start collecting insights'],
  };
  document.querySelector('.form-heading').textContent = heads[tab][0];
  document.getElementById('form-sub').textContent = heads[tab][1];
}

function showForgot() {
  document.getElementById('form-login').style.display = 'none';
  document.getElementById('form-signup').style.display = 'none';
  document.getElementById('form-forgot').style.display = '';
  document.querySelector('.form-heading').textContent = 'Reset password';
  document.getElementById('form-sub').textContent = 'Enter your email and we\'ll send a reset link';
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById('err-box').classList.remove('show');
}

function showError(msg) {
  const box = document.getElementById('err-box');
  document.getElementById('err-msg').textContent = msg;
  box.classList.add('show');
}

function checkPw(pw) {
  const rules = [
    ['rule-len', pw.length >= 8],
    ['rule-upper', /[A-Z]/.test(pw)],
    ['rule-lower', /[a-z]/.test(pw)],
    ['rule-num', /[0-9]/.test(pw)],
    ['rule-special', /[^a-zA-Z0-9]/.test(pw)],
  ];
  rules.forEach(([id, ok]) => document.getElementById(id).classList.toggle('ok', ok));
}

function isStrongPassword(pw) {
  return pw.length >= 8
    && /[A-Z]/.test(pw)
    && /[a-z]/.test(pw)
    && /[0-9]/.test(pw)
    && /[^a-zA-Z0-9]/.test(pw);
}

async function primeWorkspaceSelection() {
  const response = await api.listWorkspaces();
  if (!response.ok) return;
  const workspace = (response.data.items || response.data)[0];
  if (workspace) {
    localStorage.setItem('if_workspace', JSON.stringify({ id: workspace.id, name: workspace.name }));
  }
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-pw').value;
  if (!email || !pw) {
    showError('Please fill in both fields.');
    return;
  }

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in...';
  document.getElementById('err-box').classList.remove('show');

  const response = await api.login({ email, password: pw });
  if (response.ok) {
    saveSession(response.data);
    await primeWorkspaceSelection();
    toast('success', 'Welcome back! Redirecting...');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
    return;
  }

  btn.disabled = false;
  btn.innerHTML = 'Sign in';
  showError(response.error.message || 'Invalid email or password.');
}

async function doSignup() {
  const name = document.getElementById('su-name').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const pw = document.getElementById('su-pw').value;
  if (!name) {
    showError('Full name is required.');
    return;
  }
  if (!email) {
    showError('Email address is required.');
    return;
  }
  if (!isStrongPassword(pw)) {
    showError('Password must include uppercase, lowercase, number, special character, and be at least 8 characters.');
    return;
  }

  const btn = document.getElementById('btn-signup');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating account...';
  document.getElementById('err-box').classList.remove('show');

  const response = await api.register({ full_name: name, email, password: pw });
  if (response.ok) {
    saveSession(response.data);
    toast('success', 'Account created! Setting up your workspace...');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
    return;
  }

  btn.disabled = false;
  btn.innerHTML = 'Create account';
  const msg = response.error.code === 'EMAIL_ALREADY_EXISTS'
    ? 'An account with that email already exists.'
    : (response.error.message || 'Signup failed. Please try again.');
  showError(msg);
}

async function doForgot() {
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) {
    showError('Please enter your email address.');
    return;
  }

  const btn = document.getElementById('btn-forgot');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending reset link...';
  document.getElementById('err-box').classList.remove('show');

  const response = await api.forgotPassword({ email });
  btn.disabled = false;
  btn.innerHTML = 'Send reset link';
  if (!response.ok) {
    showError(response.error.message || 'Unable to send reset link.');
    return;
  }

  toast('info', 'If this email exists, a reset link has been sent.');
  document.getElementById('forgot-email').value = '';
  document.getElementById('form-sub').textContent = 'Check your inbox for the reset link. You can request another one in a moment if needed.';
}

document.getElementById('btn-login').addEventListener('click', doLogin);
document.getElementById('btn-signup').addEventListener('click', doSignup);
document.getElementById('btn-forgot').addEventListener('click', doForgot);

document.getElementById('login-pw').addEventListener('keydown', event => { if (event.key === 'Enter') doLogin(); });
document.getElementById('login-email').addEventListener('keydown', event => { if (event.key === 'Enter') document.getElementById('login-pw').focus(); });
document.getElementById('su-pw').addEventListener('keydown', event => { if (event.key === 'Enter') doSignup(); });

if (localStorage.getItem('if_token')) {
  window.location.href = 'dashboard.html';
}
