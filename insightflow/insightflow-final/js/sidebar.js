/* ============================================================
   sidebar.js — injects sidebar + topnav shell into #shell
   Usage: call buildShell(activePage, pageTitle) then initShell()
   ============================================================ */

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',  href: 'dashboard.html',  icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' },
  { id: 'workspaces', label: 'Workspaces', href: 'workspaces.html', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
  { id: 'projects',   label: 'Projects',   href: 'projects.html',   icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' },
  { id: 'surveys',    label: 'Surveys',    href: 'surveys.html',    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>' },
  { id: 'responses',  label: 'Responses',  href: 'responses.html',  icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
];

const NAV_ADV = [
  { id: 'insights',   label: 'Insights',   href: 'insights.html',   icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>' },
  { id: 'personas',   label: 'Personas',   href: 'personas.html',   icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>' },
  { id: 'analytics',  label: 'Analytics',  href: 'analytics.html',  icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
  { id: 'reports',    label: 'Reports',    href: 'reports.html',    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
  { id: 'events',     label: 'Events',     href: 'events.html',     icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/></svg>' },
];

function buildShell(activePage, pageTitle) {
  const user = getUser();
  const ws   = getWorkspace();
  const ab   = ws.name ? ws.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'WS';

  function navLink(item) {
    const active = item.id === activePage ? ' active' : '';
    return '<a class="nav-item' + active + '" href="' + item.href + '">' + item.icon + '<span>' + item.label + '</span></a>';
  }

  const shell = document.getElementById('shell');
  shell.innerHTML =
    // ── SIDEBAR ──
    '<aside class="sidebar">' +
      '<div class="sidebar-logo">' +
        '<div class="logo-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>' +
        '<span class="logo-text">Insight<b>Flow</b></span>' +
      '</div>' +

      '<div class="ws-switcher">' +
        '<button class="ws-btn" id="ws-toggle">' +
          '<div class="ws-avatar" id="ws-avatar" style="background:' + colorOf(ws.name || '') + '">' + ab + '</div>' +
          '<span class="ws-name" id="ws-label">' + (ws.name || 'No workspace') + '</span>' +
          '<span class="ws-chevron"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg></span>' +
        '</button>' +
        '<div class="ws-dropdown" id="ws-dd">' +
          '<div id="ws-dd-list"></div>' +
          '<div class="ws-dd-divider"></div>' +
          '<div class="ws-dd-item" id="btn-new-ws-dd">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
            '<span>New Workspace</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<nav class="sidebar-nav">' +
        NAV.map(navLink).join('') +
        '<div class="nav-section">Advanced</div>' +
        NAV_ADV.map(navLink).join('') +
      '</nav>' +

      '<div class="sidebar-footer">' +
        '<a class="nav-item' + (activePage === 'settings' ? ' active' : '') + '" href="settings.html">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
          '<span>Settings</span>' +
        '</a>' +
        '<a class="user-row" href="settings.html">' +
          '<div class="user-avatar">' + initials(user.full_name || '') + '</div>' +
          '<div class="user-info" style="min-width:0">' +
            '<div class="name truncate">' + (user.full_name || '') + '</div>' +
            '<div class="email truncate">' + (user.email || '') + '</div>' +
          '</div>' +
        '</a>' +
      '</div>' +
    '</aside>' +

    // ── MAIN ──
    '<div class="main-area">' +
      '<header class="topnav">' +
        '<nav class="breadcrumb">' +
          '<a href="dashboard.html">InsightFlow</a>' +
          '<span>›</span>' +
          (ws.name ? '<a href="workspaces.html">' + ws.name + '</a><span>›</span>' : '') +
          '<span class="current">' + pageTitle + '</span>' +
        '</nav>' +
        '<div class="topnav-right">' +
          '<button class="icon-btn" id="btn-notif">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
          '</button>' +
          '<div class="topnav-avatar" onclick="window.location.href=\'settings.html\'">' + initials(user.full_name || '') + '</div>' +
        '</div>' +
      '</header>' +
      '<div class="page-content" id="main-content">';
    // page-content is closed by each page after inserting its own HTML
}

function closeShell() {
  // Close the open divs from buildShell
  const mc = document.getElementById('main-content');
  if (mc) {
    // Already open — nothing to do, pages write into it directly
  }
}

function initShell() {
  // WS dropdown
  const toggle = document.getElementById('ws-toggle');
  const dd     = document.getElementById('ws-dd');
  if (toggle && dd) {
    toggle.addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
    document.addEventListener('click', () => dd.classList.remove('open'));
  }

  // Load workspaces for dropdown
  api.listWorkspaces().then(r => {
    if (!r.ok) return;
    const ws   = getWorkspace();
    const list = document.getElementById('ws-dd-list');
    if (!list) return;
    list.innerHTML = (r.data.items || r.data).map(w => {
      const ab = w.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
      return '<div class="ws-dd-item" data-wsid="' + w.id + '" data-wsname="' + w.name + '">' +
        '<div style="width:20px;height:20px;border-radius:4px;background:' + colorOf(w.name) + ';display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#fff">' + ab + '</div>' +
        '<span style="flex:1">' + w.name + '</span>' +
        (w.id === ws.id ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0079C1" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' : '') +
      '</div>';
    }).join('');

    list.querySelectorAll('[data-wsid]').forEach(el => {
      el.addEventListener('click', () => {
        localStorage.setItem('if_workspace', JSON.stringify({ id: el.dataset.wsid, name: el.dataset.wsname }));
        window.location.reload();
      });
    });
  });

  // New workspace
  const newWs = document.getElementById('btn-new-ws-dd');
  if (newWs) newWs.addEventListener('click', () => window.location.href = 'workspaces.html');

  // Bell
  const bell = document.getElementById('btn-notif');
  if (bell) bell.addEventListener('click', () => toast('info', 'Notifications', 'No new notifications'));
}
