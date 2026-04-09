(function () {
  function getConfiguredApiOrigin() {
    var configured = (localStorage.getItem('if_api_url') || '').trim();
    var base = configured || window.location.origin;
    return base.replace(/\/$/, '');
  }

  function apiBase() {
    return getConfiguredApiOrigin() + '/api/v1';
  }

  function loginPageHref() {
    return 'login.html';
  }

  function initials(name) {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map(function (word) { return (word[0] || ''); }).join('').toUpperCase();
  }

  function colorOf(name) {
    var palette = ['#0079C1', '#00457C', '#0e7490', '#6d28d9', '#0f766e', '#b45309', '#9f1239', '#1d4ed8'];
    var hash = 0;
    (name || '').split('').forEach(function (char) {
      hash = (hash << 5) - hash + char.charCodeAt(0);
    });
    return palette[Math.abs(hash) % palette.length];
  }

  function fmtDate(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtTime(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function badge(status) {
    var map = {
      published: 'badge-green', live: 'badge-green', active: 'badge-green', completed: 'badge-green',
      draft: 'badge-gray', archived: 'badge-gray',
      pending: 'badge-yellow', closed: 'badge-yellow',
      queued: 'badge-cyan', running: 'badge-blue',
      failed: 'badge-red', error: 'badge-red',
      owner: 'badge-blue', admin: 'badge-purple', editor: 'badge-cyan', viewer: 'badge-gray',
      high: 'badge-red', medium: 'badge-yellow', low: 'badge-cyan',
      positive: 'badge-green', neutral: 'badge-yellow', negative: 'badge-red'
    };
    return '<span class="badge ' + (map[status] || 'badge-gray') + '">' + (status || '') + '</span>';
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem('if_user') || '{}'); } catch (error) { return {}; }
  }

  function sanitizeWorkspace(workspace) {
    if (!workspace || typeof workspace !== 'object') return {};
    var id = workspace.id;
    if (!id || id === 'undefined' || id === 'null') return {};
    return {
      id: id,
      name: workspace.name || ''
    };
  }

  function getWorkspace() {
    try {
      var parsed = JSON.parse(localStorage.getItem('if_workspace') || '{}');
      var sanitized = sanitizeWorkspace(parsed);
      if (!sanitized.id) localStorage.removeItem('if_workspace');
      return sanitized;
    } catch (error) {
      localStorage.removeItem('if_workspace');
      return {};
    }
  }

  function saveSession(session) {
    if (!session) return;
    if (session.tokens) {
      localStorage.setItem('if_token', session.tokens.access_token);
      localStorage.setItem('if_refresh', session.tokens.refresh_token);
    }
    if (session.user) {
      localStorage.setItem('if_user', JSON.stringify(session.user));
    }
  }

  function clearSession() {
    localStorage.removeItem('if_token');
    localStorage.removeItem('if_refresh');
    localStorage.removeItem('if_user');
    localStorage.removeItem('if_workspace');
    sessionStorage.removeItem('if_cache');
  }

  function requireAuth() {
    if (!localStorage.getItem('if_token')) {
      window.location.href = loginPageHref();
      return false;
    }
    return true;
  }

  function getCacheStore() {
    try {
      return JSON.parse(sessionStorage.getItem('if_cache') || '{}');
    } catch (error) {
      return {};
    }
  }

  function setCacheStore(store) {
    sessionStorage.setItem('if_cache', JSON.stringify(store));
  }

  function cacheGet(key, ttlMs) {
    var store = getCacheStore();
    var entry = store[key];
    if (!entry) return null;
    if ((Date.now() - entry.ts) > ttlMs) {
      delete store[key];
      setCacheStore(store);
      return null;
    }
    return entry.value;
  }

  function cacheSet(key, value) {
    var store = getCacheStore();
    store[key] = { ts: Date.now(), value: value };
    setCacheStore(store);
    return value;
  }

  function normalizeCompletionRate(rate) {
    if (rate == null) return 0;
    return rate > 1 ? rate / 100 : rate;
  }

  function buildPublicSurveyUrl(slug) {
    var base = window.location.pathname.indexOf('/pages/') >= 0 ? '../public-survey.html' : './public-survey.html';
    return new URL(base + '?slug=' + encodeURIComponent(slug), window.location.href).href;
  }

  function downloadReportAsset(asset) {
    if (!asset || !asset.asset_id || !asset.download_token) return;
    var url = apiBase() + '/exports/' + asset.asset_id + '/download?token=' + encodeURIComponent(asset.download_token);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  var ICONS = {
    dashboard: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg>',
    workspace: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    project: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
    survey: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"></rect><path d="M9 7h6M9 11h6M9 15h4"></path></svg>',
    responses: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
    insights: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>',
    personas: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"></path></svg>',
    analytics: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
    reports: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
    settings: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    chevDown: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    plus: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    bell: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    menu: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    sparkles: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z"></path><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"></path><path d="M5 14l.7 1.6L7.3 16l-1.6.7L5 18.3l-.7-1.6L2.7 16l1.6-.7L5 14z"></path></svg>',
    building: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-4"></path><path d="M9 9h.01"></path><path d="M9 13h.01"></path><path d="M9 17h.01"></path><path d="M13 13h.01"></path><path d="M13 17h.01"></path><path d="M17 13h.01"></path><path d="M17 17h.01"></path></svg>',
    folder: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"></path></svg>',
    clipboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="3" width="8" height="4" rx="1"></rect><path d="M16 5h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3"></path></svg>',
    user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"></path></svg>',
    hand: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-4 0v5"></path><path d="M14 10V4a2 2 0 0 0-4 0v8"></path><path d="M10 10.5V6a2 2 0 0 0-4 0V15a5 5 0 0 0 5 5h3a6 6 0 0 0 6-6v-3a2 2 0 0 0-2-2"></path></svg>',
    target: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M2 12h2M20 12h2"></path></svg>',
    brain: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.5 3a3.5 3.5 0 0 0-3.5 3.5V8a2.5 2.5 0 0 0 0 5v1.5A3.5 3.5 0 0 0 9.5 18H10"></path><path d="M14.5 3A3.5 3.5 0 0 1 18 6.5V8a2.5 2.5 0 0 1 0 5v1.5A3.5 3.5 0 0 1 14.5 18H14"></path><path d="M10 18v2"></path><path d="M14 18v2"></path><path d="M12 6v12"></path><path d="M9 9h3"></path><path d="M12 15h3"></path></svg>',
    chart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>',
    mail: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"></rect><polyline points="3 7 12 13 21 7"></polyline></svg>',
    lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
    link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    globe: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
    download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
    refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>',
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
    checkCircle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="9 12 11 14 15 10"></polyline></svg>',
    alertCircle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
  };

  function icon(name, className) {
    var svg = ICONS[name] || '';
    if (!svg) return '';
    if (!className) return svg;
    return svg.replace('<svg ', '<svg class="' + className + '" ');
  }

  var toastId = 0;
  function toast(type, title, msg, duration) {
    if (msg === void 0) msg = '';
    if (duration === void 0) duration = 4000;
    var rack = document.getElementById('toast-rack');
    if (!rack) return;
    toastId += 1;
    var icons = {
      success: icon('checkCircle'),
      error: icon('alertCircle'),
      info: icon('sparkles')
    };
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = [
      '<div class="toast-icon">' + (icons[type] || 'i') + '</div>',
      '<div class="flex-1">',
      '<div class="toast-title">' + title + '</div>',
      msg ? '<div class="toast-msg">' + msg + '</div>' : '',
      '</div>',
      '<button class="toast-close" type="button" aria-label="Close notification">' + icon('close') + '</button>'
    ].join('');
    var closeBtn = el.querySelector('.toast-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { el.remove(); });
    rack.appendChild(el);
    window.setTimeout(function () { el.remove(); }, duration);
  }

  function openModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
  }

  function closeModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
  }

  async function safeJson(response) {
    var text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (error) {
      return {};
    }
  }

  async function refreshTokens() {
    var refreshToken = localStorage.getItem('if_refresh');
    if (!refreshToken) return false;
    try {
      var response = await fetch(apiBase() + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      if (!response.ok) {
        clearSession();
        return false;
      }
      var data = await safeJson(response);
      localStorage.setItem('if_token', data.access_token);
      localStorage.setItem('if_refresh', data.refresh_token);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function apiCall(method, path, body, isPublic) {
    if (isPublic === void 0) isPublic = false;
    var headers = { 'Content-Type': 'application/json' };
    var token = localStorage.getItem('if_token');
    if (token && !isPublic) headers.Authorization = 'Bearer ' + token;
    var options = { method: method, headers: headers };
    if (body !== undefined) options.body = JSON.stringify(body);

    try {
      var response = await fetch(apiBase() + path, options);
      if (response.status === 401 && !isPublic) {
        var refreshed = await refreshTokens();
        if (!refreshed) {
          window.location.href = loginPageHref();
          return { ok: false, status: 401, error: { code: 'SESSION_EXPIRED', message: 'Session expired. Please sign in again.' } };
        }
        options.headers.Authorization = 'Bearer ' + localStorage.getItem('if_token');
        response = await fetch(apiBase() + path, options);
      }

      var data = await safeJson(response);
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: data.error || { code: 'REQUEST_FAILED', message: data.detail || ('Request failed (' + response.status + ')') }
        };
      }
      return { ok: true, status: response.status, data: data };
    } catch (error) {
      return { ok: false, status: 0, error: { code: 'NETWORK', message: 'Network error - backend unreachable' } };
    }
  }

  async function withCache(key, ttlMs, loader) {
    var cached = cacheGet(key, ttlMs);
    if (cached) return { ok: true, status: 200, data: cached };
    var loaded = await loader();
    if (loaded.ok) cacheSet(key, loaded.data);
    return loaded;
  }

  var api = {
    call: apiCall,

    login: function (body) { return apiCall('POST', '/auth/login', body, true); },
    register: function (body) { return apiCall('POST', '/auth/register', body, true); },
    logout: function () { return apiCall('POST', '/auth/logout', { refresh_token: localStorage.getItem('if_refresh') }); },
    me: function () { return apiCall('GET', '/auth/me'); },
    forgotPassword: function (body) { return apiCall('POST', '/auth/password/forgot', body, true); },
    verifyResetToken: function (body) { return apiCall('POST', '/auth/password/reset/verify', body, true); },
    resetPassword: function (body) { return apiCall('POST', '/auth/password/reset', body, true); },

    listWorkspaces: function () { return apiCall('GET', '/workspaces'); },
    createWorkspace: function (body) { return apiCall('POST', '/workspaces', body); },
    updateWorkspace: function (workspaceId, body) { return apiCall('PATCH', '/workspaces/' + workspaceId, body); },
    listMembers: function (workspaceId) { return apiCall('GET', '/workspaces/' + workspaceId + '/members'); },
    inviteMember: function (workspaceId, body) { return apiCall('POST', '/workspaces/' + workspaceId + '/members/invite', body); },
    removeMember: function (workspaceId, memberId) { return apiCall('DELETE', '/workspaces/' + workspaceId + '/members/' + memberId); },

    listProjects: function (workspaceId) { return apiCall('GET', '/workspaces/' + workspaceId + '/projects'); },
    createProject: function (workspaceId, body) { return apiCall('POST', '/workspaces/' + workspaceId + '/projects', body); },
    getProject: function (projectId) { return apiCall('GET', '/projects/' + projectId); },
    updateProject: function (projectId, body) { return apiCall('PATCH', '/projects/' + projectId, body); },
    archiveProject: function (projectId) { return apiCall('DELETE', '/projects/' + projectId); },

    getSurvey: function (surveyId) { return apiCall('GET', '/surveys/' + surveyId); },
    createSurvey: function (projectId, body) { return apiCall('POST', '/projects/' + projectId + '/surveys', body); },
    updateSurvey: function (surveyId, body) { return apiCall('PATCH', '/surveys/' + surveyId, body); },
    publishSurvey: function (surveyId, body) { return apiCall('POST', '/surveys/' + surveyId + '/publish', body || {}); },
    closeSurvey: function (surveyId) { return apiCall('POST', '/surveys/' + surveyId + '/close'); },
    archiveSurvey: function (surveyId) { return apiCall('POST', '/surveys/' + surveyId + '/archive'); },
    aiGenerate: function (surveyId, body) { return apiCall('POST', '/surveys/' + surveyId + '/ai-generate', body); },
    biasCheck: function (surveyId, body) { return apiCall('POST', '/surveys/' + surveyId + '/bias-check', body); },
    addQuestion: function (surveyId, body) { return apiCall('POST', '/surveys/' + surveyId + '/questions', body); },
    updateQuestion: function (surveyId, questionId, body) { return apiCall('PATCH', '/surveys/' + surveyId + '/questions/' + questionId, body); },
    deleteQuestion: function (surveyId, questionId) { return apiCall('DELETE', '/surveys/' + surveyId + '/questions/' + questionId); },

    publicSurvey: function (slug) { return apiCall('GET', '/public/surveys/' + slug, undefined, true); },
    submitResponse: function (slug, body) { return apiCall('POST', '/public/surveys/' + slug + '/responses', body, true); },

    listResponses: function (surveyId) { return apiCall('GET', '/surveys/' + surveyId + '/responses'); },
    getResponse: function (surveyId, responseId) { return apiCall('GET', '/surveys/' + surveyId + '/responses/' + responseId); },

    runInsights: function (surveyId, body) { return apiCall('POST', '/surveys/' + surveyId + '/insights/run', body || {}); },
    latestInsights: function (surveyId) { return apiCall('GET', '/surveys/' + surveyId + '/insights/latest'); },

    genPersonas: function (surveyId, body) { return apiCall('POST', '/surveys/' + surveyId + '/personas/generate', body || {}); },
    listPersonas: function (surveyId) { return apiCall('GET', '/surveys/' + surveyId + '/personas'); },

    createReport: function (surveyId, body) { return apiCall('POST', '/surveys/' + surveyId + '/reports', body); },
    listReports: function (surveyId) { return apiCall('GET', '/surveys/' + surveyId + '/reports'); },
    getReport: function (surveyId, reportId) { return apiCall('GET', '/surveys/' + surveyId + '/reports/' + reportId); },

    surveyAnalytics: async function (surveyId) {
      return withCache('survey-analytics:' + surveyId, 30000, async function () {
        var response = await apiCall('GET', '/surveys/' + surveyId + '/analytics/completion');
        if (!response.ok) return response;
        response.data.completion_rate = normalizeCompletionRate(response.data.completion_rate);
        return response;
      });
    },

    listSurveys: async function (projectId) {
      var response = await apiCall('GET', '/projects/' + projectId + '/surveys');
      if (!response.ok) return response;
      var items = response.data.items || response.data || [];
      var enriched = await Promise.all(items.map(async function (survey) {
        var analytics = await api.surveyAnalytics(survey.id);
        if (!analytics.ok) return Object.assign({}, survey, { response_count: 0, completion_rate: 0 });
        return Object.assign({}, survey, {
          response_count: analytics.data.total_responses || 0,
          completion_rate: analytics.data.completion_rate || 0,
          generated_ai_surveys: analytics.data.generated_ai_surveys || 0,
          completed_ai_surveys: analytics.data.completed_ai_surveys || 0
        });
      }));
      return {
        ok: true,
        status: response.status,
        data: Array.isArray(response.data)
          ? enriched
          : Object.assign({}, response.data, { items: enriched, count: response.data.count || enriched.length })
      };
    },

    wsAnalytics: async function (workspaceId) {
      return withCache('workspace-analytics:' + workspaceId, 20000, async function () {
        var projectsResponse = await api.listProjects(workspaceId);
        if (!projectsResponse.ok) return projectsResponse;
        var projects = projectsResponse.data.items || projectsResponse.data || [];
        var surveyGroups = await Promise.all(projects.map(function (project) { return api.listSurveys(project.id); }));
        var surveys = [];
        surveyGroups.forEach(function (group, index) {
          if (!group.ok) return;
          var items = group.data.items || group.data || [];
          items.forEach(function (survey) {
            surveys.push(Object.assign({}, survey, { _project_id: projects[index].id, _project_name: projects[index].name }));
          });
        });

        var totalResponses = surveys.reduce(function (sum, survey) { return sum + (survey.response_count || 0); }, 0);
        var completionRates = surveys.map(function (survey) { return survey.completion_rate || 0; });
        var avgCompletion = completionRates.length
          ? completionRates.reduce(function (sum, rate) { return sum + rate; }, 0) / completionRates.length
          : 0;

        return {
          ok: true,
          status: 200,
          data: {
            total_projects: projects.length,
            total_surveys: surveys.length,
            live_surveys: surveys.filter(function (survey) { return survey.status === 'published'; }).length,
            total_responses: totalResponses,
            avg_completion: avgCompletion,
            generated_ai_surveys: surveys.reduce(function (sum, survey) { return sum + (survey.generated_ai_surveys || 0); }, 0),
            completed_surveys: surveys.reduce(function (sum, survey) { return sum + (survey.completed_ai_surveys || 0); }, 0)
          }
        };
      });
    },

    workspaceActivity: async function (workspaceId) {
      var projectsResponse = await api.listProjects(workspaceId);
      if (!projectsResponse.ok) return projectsResponse;
      var projects = projectsResponse.data.items || projectsResponse.data || [];
      var projectEvents = projects.map(function (project) {
        return {
          category: 'audit',
          type: 'project.created',
          action: 'Project created',
          actor: 'Workspace member',
          resource: project.name,
          details: project.description || 'Project is available for survey organization.',
          created_at: project.created_at
        };
      });

      var surveyGroups = await Promise.all(projects.map(function (project) { return api.listSurveys(project.id); }));
      var surveys = [];
      surveyGroups.forEach(function (group, index) {
        if (!group.ok) return;
        (group.data.items || group.data || []).forEach(function (survey) {
          surveys.push(Object.assign({}, survey, { _project_name: projects[index].name }));
        });
      });

      var surveyEvents = surveys.map(function (survey) {
        var statusType = survey.status === 'published' ? 'survey.published' : 'survey.created';
        var action = survey.status === 'published' ? 'Survey published' : 'Survey created';
        return {
          category: survey.status === 'published' ? 'audit' : 'usage',
          type: statusType,
          action: action,
          actor: 'Workspace member',
          resource: survey.title,
          details: survey._project_name + ' / ' + survey.status,
          created_at: survey.updated_at || survey.created_at
        };
      });

      var reportEvents = [];
      for (var i = 0; i < surveys.length; i += 1) {
        var survey = surveys[i];
        var reportsResponse = await api.listReports(survey.id);
        if (!reportsResponse.ok) continue;
        (reportsResponse.data.items || reportsResponse.data || []).forEach(function (report) {
          reportEvents.push({
            category: 'usage',
            type: report.status === 'completed' ? 'report.generated' : 'report.' + report.status,
            action: report.status === 'completed' ? 'Report generated' : 'Report job ' + report.status,
            actor: 'InsightFlow',
            resource: survey.title,
            details: report.template + ' / ' + report.format,
            created_at: report.completed_at || report.created_at
          });
        });
      }

      var items = projectEvents.concat(surveyEvents).concat(reportEvents)
        .filter(function (event) { return !!event.created_at; })
        .sort(function (left, right) { return new Date(right.created_at) - new Date(left.created_at); });

      return { ok: true, status: 200, data: { items: items, count: items.length } };
    }
  };

  var NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: 'dashboard.html' },
    { id: 'workspaces', label: 'Workspaces', icon: 'workspace', href: 'workspaces.html' },
    { id: 'projects', label: 'Projects', icon: 'project', href: 'projects.html' },
    { id: 'surveys', label: 'Surveys', icon: 'survey', href: 'surveys.html' },
    { id: 'responses', label: 'Responses', icon: 'responses', href: 'responses.html' }
  ];
  var ADV_ITEMS = [
    { id: 'insights', label: 'Insights', icon: 'insights', href: 'insights.html' },
    { id: 'personas', label: 'Personas', icon: 'personas', href: 'personas.html' },
    { id: 'analytics', label: 'Analytics', icon: 'analytics', href: 'analytics.html' },
    { id: 'reports', label: 'Reports', icon: 'reports', href: 'reports.html' }
  ];

  function buildSidebar(activePage, pageTitle) {
    var user = getUser();
    var workspace = getWorkspace();
    var wsAbbr = workspace.name ? workspace.name.split(' ').map(function (word) { return word[0]; }).join('').slice(0, 2).toUpperCase() : 'WS';

    function navLink(item) {
      var active = item.id === activePage ? ' active' : '';
      return '<a class="nav-item' + active + '" href="' + item.href + '">' + (ICONS[item.icon] || '') + item.label + '</a>';
    }

    return [
      '<div class="sidebar-backdrop" id="sidebar-backdrop"></div>',
      '<div class="app-shell">',
      '<aside class="sidebar" id="app-sidebar">',
      '<div class="sidebar-logo"><div class="logo-icon">' + ICONS.insights + '</div><span class="logo-text">Insight<b>Flow</b></span></div>',
      '<div class="ws-switcher">',
      '<button class="ws-btn" id="ws-toggle" type="button">',
      '<div class="ws-avatar" style="background:' + colorOf(workspace.name || '') + '">' + wsAbbr + '</div>',
      '<span class="ws-name">' + (workspace.name || 'No workspace selected') + '</span>',
      ICONS.chevDown,
      '</button>',
      '<div class="ws-dropdown" id="ws-dd">',
      '<div id="ws-dd-list"></div>',
      '<div class="ws-dd-divider"></div>',
      '<div class="ws-dd-item" id="btn-new-ws">' + ICONS.plus + '<span>New Workspace</span></div>',
      '</div>',
      '</div>',
      '<nav class="sidebar-nav">',
      NAV_ITEMS.map(navLink).join(''),
      '<div class="nav-section">Advanced</div>',
      ADV_ITEMS.map(navLink).join(''),
      '</nav>',
      '<div class="sidebar-footer">',
      '<a class="nav-item' + (activePage === 'settings' ? ' active' : '') + '" href="settings.html">' + ICONS.settings + 'Settings</a>',
      '<a class="user-row" href="settings.html">',
      '<div class="user-avatar">' + initials(user.full_name || '') + '</div>',
      '<div class="user-info" style="min-width:0">',
      '<div class="name truncate">' + (user.full_name || '') + '</div>',
      '<div class="email truncate">' + (user.email || '') + '</div>',
      '</div>',
      '</a>',
      '</div>',
      '</aside>',
      '<div class="main-area">',
      '<header class="topnav">',
      '<button class="topnav-menu-btn mobile-only" id="btn-sidebar-toggle" type="button">' + ICONS.menu + '</button>',
      '<nav class="breadcrumb">',
      '<a href="dashboard.html">InsightFlow</a>',
      '<span>&gt;</span>',
      workspace.name ? '<a href="workspaces.html">' + workspace.name + '</a><span>&gt;</span>' : '',
      '<span class="crumb-current">' + pageTitle + '</span>',
      '</nav>',
      '<div class="topnav-right">',
      '<button class="icon-btn" id="btn-notif" type="button">' + ICONS.bell + '</button>',
      '<div class="topnav-avatar">' + initials(user.full_name || '') + '</div>',
      '</div>',
      '</header>',
      '<div class="page-content" id="page-main">'
    ].join('');
  }

  function closeSidebar() {
    return '</div></div></div>';
  }

  function toggleSidebar(forceOpen) {
    var sidebar = document.getElementById('app-sidebar');
    var backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;
    var shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', shouldOpen);
    backdrop.classList.toggle('open', shouldOpen);
  }

  function initSidebar() {
    var toggle = document.getElementById('btn-sidebar-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () { toggleSidebar(); });
    }
    var backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.addEventListener('click', function () { toggleSidebar(false); });

    var btn = document.getElementById('ws-toggle');
    var dd = document.getElementById('ws-dd');
    if (btn && dd) {
      btn.addEventListener('click', function (event) {
        event.stopPropagation();
        dd.classList.toggle('open');
      });
      document.addEventListener('click', function () { dd.classList.remove('open'); });
    }

    api.listWorkspaces().then(function (response) {
      if (!response.ok) return;
      var workspaces = response.data.items || response.data || [];
      var current = getWorkspace();
      var list = document.getElementById('ws-dd-list');
      if (!list) return;
      list.innerHTML = workspaces.map(function (workspace) {
        var abbr = workspace.name.split(' ').map(function (word) { return word[0]; }).join('').slice(0, 2).toUpperCase();
        var isCurrent = workspace.id === current.id;
        return '<div class="ws-dd-item" data-wsid="' + workspace.id + '" data-wsname="' + workspace.name + '">' +
          '<div class="ws-avatar" style="background:' + colorOf(workspace.name) + ';width:20px;height:20px;border-radius:4px">' + abbr + '</div>' +
          '<span style="flex:1">' + workspace.name + '</span>' +
          (isCurrent ? ICONS.check : '') +
          '</div>';
      }).join('');

      Array.prototype.slice.call(list.querySelectorAll('[data-wsid]')).forEach(function (item) {
        item.addEventListener('click', function () {
          localStorage.setItem('if_workspace', JSON.stringify({ id: item.dataset.wsid, name: item.dataset.wsname }));
          window.location.reload();
        });
      });
    });

    var newWorkspace = document.getElementById('btn-new-ws');
    if (newWorkspace) newWorkspace.addEventListener('click', function () { window.location.href = 'workspaces.html'; });

    var notifications = document.getElementById('btn-notif');
    if (notifications) {
      notifications.addEventListener('click', function () {
        toast('info', 'Notifications', 'No new notifications right now.');
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        Array.prototype.slice.call(document.querySelectorAll('.modal-overlay.open')).forEach(function (modal) {
          modal.classList.remove('open');
        });
        toggleSidebar(false);
      }
    });
  }

  window.api = api;
  window.initials = initials;
  window.colorOf = colorOf;
  window.fmtDate = fmtDate;
  window.fmtTime = fmtTime;
  window.badge = badge;
  window.getUser = getUser;
  window.getWorkspace = getWorkspace;
  window.saveSession = saveSession;
  window.clearSession = clearSession;
  window.requireAuth = requireAuth;
  window.toast = toast;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.buildSidebar = buildSidebar;
  window.closeSidebar = closeSidebar;
  window.initSidebar = initSidebar;
  window.buildPublicSurveyUrl = buildPublicSurveyUrl;
  window.downloadReportAsset = downloadReportAsset;
  window.icon = icon;
})();
