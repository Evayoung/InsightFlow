const token = new URLSearchParams(window.location.search).get('token');

function updateRules(password) {
  const checks = [
    ['rule-len', password.length >= 8],
    ['rule-upper', /[A-Z]/.test(password)],
    ['rule-lower', /[a-z]/.test(password)],
    ['rule-num', /[0-9]/.test(password)],
    ['rule-special', /[^A-Za-z0-9]/.test(password)],
  ];
  for (const [id, valid] of checks) {
    document.getElementById(id)?.classList.toggle('ok', valid);
  }
}

function strongEnough(password) {
  return password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function renderInvalid(message) {
  document.getElementById('reset-copy').textContent = message;
  document.getElementById('reset-root').innerHTML = `
    <div class="alert alert-error">This password reset link is invalid or has expired.</div>
    <a class="btn btn-primary" href="./pages/login.html">Return to sign in</a>
  `;
}

function renderForm() {
  document.getElementById('reset-copy').textContent = 'Choose a strong new password for your InsightFlow account.';
  document.getElementById('reset-root').innerHTML = `
    <form id="reset-form">
      <div class="form-group">
        <label class="form-label">New Password</label>
        <input class="form-input" id="new-password" type="password" placeholder="Enter a strong new password"/>
        <div class="rules">
          <div class="rule" id="rule-len"><span class="rule-dot"></span>At least 8 characters</div>
          <div class="rule" id="rule-upper"><span class="rule-dot"></span>At least one uppercase letter</div>
          <div class="rule" id="rule-lower"><span class="rule-dot"></span>At least one lowercase letter</div>
          <div class="rule" id="rule-num"><span class="rule-dot"></span>At least one number</div>
          <div class="rule" id="rule-special"><span class="rule-dot"></span>At least one special character</div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Confirm New Password</label>
        <input class="form-input" id="confirm-password" type="password" placeholder="Repeat the new password"/>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <a href="./pages/login.html" style="font-size:13px;color:#64748b;text-decoration:none">Back to sign in</a>
        <button class="btn btn-primary" id="btn-reset" type="submit">Update Password</button>
      </div>
    </form>
  `;

  const passwordInput = document.getElementById('new-password');
  passwordInput.addEventListener('input', event => updateRules(event.target.value));

  document.getElementById('reset-form').addEventListener('submit', async event => {
    event.preventDefault();
    const password = passwordInput.value;
    const confirm = document.getElementById('confirm-password').value;
    if (!strongEnough(password)) {
      toast('error', 'Weak password', 'Use uppercase, lowercase, number, special character, and at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      toast('error', 'Passwords do not match', 'Re-enter the same password in both fields.');
      return;
    }

    const button = document.getElementById('btn-reset');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Updating...';
    const response = await api.resetPassword({ token, new_password: password });
    if (!response.ok) {
      button.disabled = false;
      button.textContent = 'Update Password';
      toast('error', 'Reset failed', response.error.message);
      return;
    }

    document.getElementById('reset-root').innerHTML = `
      <div class="alert alert-success">Password updated successfully.</div>
      <a class="btn btn-primary" href="./pages/login.html">Continue to sign in</a>
    `;
  });
}

async function verifyToken() {
  if (!token) {
    renderInvalid('The reset link is missing a token parameter.');
    return;
  }
  const response = await api.verifyResetToken({ token });
  if (!response.ok || !response.data.valid) {
    renderInvalid('The reset link has expired or is no longer valid.');
    return;
  }
  renderForm();
}

verifyToken();

