/* ============================================================
   api.js — every route from spec
   Base: /api/v1  |  Auth: Bearer token  |  401 → auto-refresh
   ============================================================ */

const API = '/api/v1';

const api = {
  _token()  { return localStorage.getItem('if_token'); },
  _rt()     { return localStorage.getItem('if_refresh'); },

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    const t = this._token();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  },

  async _refresh() {
    const rt = this._rt();
    if (!rt) return false;
    try {
      const r = await fetch(API + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt })
      });
      if (!r.ok) { localStorage.clear(); return false; }
      const d = await r.json();
      localStorage.setItem('if_token',   d.access_token);
      localStorage.setItem('if_refresh', d.refresh_token);
      return true;
    } catch { return false; }
  },

  async call(method, path, body, isPublic) {
    const opts = { method, headers: this._headers() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    try {
      let r = await fetch(API + path, opts);
      if (r.status === 401 && !isPublic) {
        const ok = await this._refresh();
        if (ok) { opts.headers = this._headers(); r = await fetch(API + path, opts); }
        else {
          localStorage.clear();
          window.location.href = 'login.html';
          return { ok: false, error: { message: 'Session expired' } };
        }
      }
      let data;
      try { data = await r.json(); } catch { data = {}; }
      if (!r.ok) return { ok: false, status: r.status, error: data.error || { code: 'ERR', message: 'Request failed (' + r.status + ')' } };
      return { ok: true, status: r.status, data };
    } catch {
      return { ok: false, status: 0, error: { code: 'NETWORK', message: 'Network error — backend unreachable' } };
    }
  },

  /* ── AUTH ── */
  login:    b   => api.call('POST', '/auth/login',    b,   true),
  register: b   => api.call('POST', '/auth/register', b,   true),
  logout:   ()  => api.call('POST', '/auth/logout', { refresh_token: api._rt() }),
  me:       ()  => api.call('GET',  '/auth/me'),

  /* ── WORKSPACES ── */
  listWorkspaces:  ()         => api.call('GET',    '/workspaces'),
  createWorkspace: b          => api.call('POST',   '/workspaces', b),
  updateWorkspace: (id, b)    => api.call('PATCH',  '/workspaces/' + id, b),
  wsAnalytics:     id         => api.call('GET',    '/workspaces/' + id + '/analytics/overview'),
  listMembers:     wid        => api.call('GET',    '/workspaces/' + wid + '/members'),
  inviteMember:    (wid, b)   => api.call('POST',   '/workspaces/' + wid + '/members/invite', b),
  removeMember:    (wid, mid) => api.call('DELETE', '/workspaces/' + wid + '/members/' + mid),

  /* ── PROJECTS ── */
  listProjects:   wid         => api.call('GET',    '/workspaces/' + wid + '/projects'),
  createProject:  (wid, b)    => api.call('POST',   '/workspaces/' + wid + '/projects', b),
  archiveProject: id          => api.call('DELETE', '/projects/' + id),

  /* ── SURVEYS ── */
  listSurveys:    pid         => api.call('GET',    '/projects/' + pid + '/surveys'),
  createSurvey:   (pid, b)    => api.call('POST',   '/projects/' + pid + '/surveys', b),
  getSurvey:      id          => api.call('GET',    '/surveys/' + id),
  updateSurvey:   (id, b)     => api.call('PATCH',  '/surveys/' + id, b),
  publishSurvey:  id          => api.call('POST',   '/surveys/' + id + '/publish', {}),
  closeSurvey:    id          => api.call('POST',   '/surveys/' + id + '/close'),
  archiveSurvey:  id          => api.call('POST',   '/surveys/' + id + '/archive'),
  aiGenerate:     (id, b)     => api.call('POST',   '/surveys/' + id + '/ai-generate', b),
  biasCheck:      (id, b)     => api.call('POST',   '/surveys/' + id + '/bias-check', b),
  addQuestion:    (id, b)     => api.call('POST',   '/surveys/' + id + '/questions', b),
  updateQuestion: (s, q, b)   => api.call('PATCH',  '/surveys/' + s + '/questions/' + q, b),
  deleteQuestion: (s, q)      => api.call('DELETE', '/surveys/' + s + '/questions/' + q),

  /* ── PUBLIC (no auth) ── */
  publicSurvey:   slug        => api.call('GET',  '/public/surveys/' + slug, undefined, true),
  submitResponse: (slug, b)   => api.call('POST', '/public/surveys/' + slug + '/responses', b, true),

  /* ── RESPONSES ── */
  listResponses:  sid         => api.call('GET', '/surveys/' + sid + '/responses'),
  getResponse:    (sid, rid)  => api.call('GET', '/surveys/' + sid + '/responses/' + rid),

  /* ── INSIGHTS ── */
  runInsights:    (id, b)     => api.call('POST', '/surveys/' + id + '/insights/run', b || {}),
  latestInsights: id          => api.call('GET',  '/surveys/' + id + '/insights/latest'),
  insightRun:     (sid, rid)  => api.call('GET',  '/surveys/' + sid + '/insights/runs/' + rid),

  /* ── PERSONAS ── */
  genPersonas:    (id, b)     => api.call('POST', '/surveys/' + id + '/personas/generate', b || {}),
  listPersonas:   id          => api.call('GET',  '/surveys/' + id + '/personas'),

  /* ── REPORTS ── */
  createReport:   (id, b)     => api.call('POST', '/surveys/' + id + '/reports', b),
  listReports:    id          => api.call('GET',  '/surveys/' + id + '/reports'),
  getReport:      (sid, rid)  => api.call('GET',  '/surveys/' + sid + '/reports/' + rid),

  /* ── ANALYTICS ── */
  surveyAnalytics: id         => api.call('GET', '/surveys/' + id + '/analytics/completion'),

  /* ── EVENTS ── */
  listEvents:     wid         => api.call('GET', '/workspaces/' + wid + '/events'),
};
