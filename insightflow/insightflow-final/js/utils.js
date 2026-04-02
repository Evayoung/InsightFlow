/* ============================================================
   utils.js — shared utilities used by every page
   ============================================================ */

/* ── AUTH ── */
function getUser()      { try { return JSON.parse(localStorage.getItem('if_user') || '{}'); }      catch { return {}; } }
function getWorkspace() { try { return JSON.parse(localStorage.getItem('if_workspace') || '{}'); } catch { return {}; } }

function requireAuth() {
  if (!localStorage.getItem('if_token')) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

/* ── FORMAT ── */
function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

function colorOf(name) {
  const palette = ['#0079C1','#00457C','#0e7490','#6d28d9','#0f766e','#b45309','#9f1239','#1d4ed8'];
  let h = 0;
  for (const c of (name || '')) h = (h << 5) - h + c.charCodeAt(0);
  return palette[Math.abs(h) % palette.length];
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function badge(status) {
  const map = {
    published: 'badge-green',  live: 'badge-green',    active: 'badge-green', completed: 'badge-green',
    draft:     'badge-gray',   archived: 'badge-gray',
    pending:   'badge-yellow', closed:   'badge-yellow',
    queued:    'badge-cyan',   running:  'badge-blue',
    failed:    'badge-red',    error:    'badge-red',
    owner:     'badge-blue',   admin:    'badge-purple', editor: 'badge-cyan', viewer: 'badge-gray',
    high:      'badge-red',    medium:   'badge-yellow', low:    'badge-cyan',
    positive:  'badge-green',  neutral:  'badge-yellow', negative: 'badge-red',
  };
  return '<span class="badge ' + (map[status] || 'badge-gray') + '">' + (status || '') + '</span>';
}

/* ── TOAST ── */
let _toastId = 0;
function toast(type, title, msg, duration) {
  const rack = document.getElementById('toast-rack');
  if (!rack) return;
  const id   = ++_toastId;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const el    = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML =
    '<div class="toast-icon">' + (icons[type] || 'ℹ') + '</div>' +
    '<div style="flex:1;min-width:0">' +
      '<div class="toast-title">' + title + '</div>' +
      (msg ? '<div class="toast-msg">' + msg + '</div>' : '') +
    '</div>' +
    '<button class="toast-close" onclick="this.closest(\'.toast\').remove()">×</button>';
  rack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, (duration || 4000) - 300);
  setTimeout(() => el.remove(), duration || 4000);
}

/* ── MODAL ── */
function openModal(id)  { const m = document.getElementById(id); if (m) m.classList.add('open');    }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('open'); }

/* ── SURVEY SELECTOR HELPER ── */
async function populateSurveySelector(selId, wsId) {
  const sel = document.getElementById(selId);
  if (!sel || !wsId) return;
  const pr = await api.listProjects(wsId);
  if (!pr.ok) return;
  for (const p of (pr.data.items || pr.data)) {
    const r = await api.listSurveys(p.id);
    if (!r.ok) continue;
    (r.data.items || r.data).forEach(s => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.title.slice(0, 50) + ' (' + p.name + ')';
      sel.appendChild(o);
    });
  }
  // Pre-select from URL ?survey=xxx
  const urlSid = new URLSearchParams(window.location.search).get('survey');
  if (urlSid && sel.querySelector('option[value="' + urlSid + '"]')) {
    sel.value = urlSid;
    return urlSid;
  }
  return null;
}

/* ── KEYBOARD ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});
