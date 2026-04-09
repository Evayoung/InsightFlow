if (!requireAuth()) throw '';

function pageHTML() {
  return `
  <div class="page-header">
    <div>
      <h1 class="page-title">Personas</h1>
      <p class="page-subtitle">AI-generated user personas from survey data.</p>
    </div>
    <div class="page-actions">
      <select class="form-select" id="per-survey-sel" style="width:auto;font-size:13px;padding:6px 10px"><option value="">Select survey...</option></select>
      <button class="btn btn-ai" id="btn-gen-per">${icon('sparkles')} Generate Personas</button>
    </div>
  </div>
  <div id="personas-content">
    <div class="empty-state card">
      <div class="empty-icon">${icon('user')}</div>
      <p class="empty-title">No survey selected</p>
      <p class="empty-desc">Select a survey and click Generate Personas.</p>
    </div>
  </div>`;
}

function initPage() {
  const ws = getWorkspace();
  let selectedSurveyId = null;

  const GRADIENTS = [
    'linear-gradient(135deg,#1d4ed8,#3b82f6)',
    'linear-gradient(135deg,#6d28d9,#8b5cf6)',
    'linear-gradient(135deg,#059669,#10b981)',
    'linear-gradient(135deg,#b45309,#f59e0b)',
    'linear-gradient(135deg,#be123c,#f43f5e)',
  ];
  const TRAIT_COLORS = [
    ['#dbeafe','#1d4ed8'],
    ['#ede9fe','#6d28d9'],
    ['#d1fae5','#065f46'],
    ['#fef3c7','#78350f'],
    ['#fee2e2','#991b1b'],
  ];

  async function loadSurveys() {
    if (!ws.id) return;
    const pr = await api.listProjects(ws.id);
    if (!pr.ok) return;
    const sel = document.getElementById('per-survey-sel');
    for (const p of (pr.data.items || pr.data)) {
      const r = await api.listSurveys(p.id);
      if (!r.ok) continue;
      (r.data.items || r.data).forEach(s => {
        const o = document.createElement('option');
        o.value = s.id; o.textContent = s.title + ' (' + p.name + ')'; sel.appendChild(o);
      });
    }
    const urlSid = new URLSearchParams(window.location.search).get('survey');
    if (urlSid) { sel.value = urlSid; selectedSurveyId = urlSid; loadPersonas(urlSid); }
  }

  async function loadPersonas(sid) {
    const el = document.getElementById('personas-content');
    el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:48px;justify-content:center;color:#94a3b8"><span class="spinner-dark"></span> Loading personas...</div>';
    const r = await api.listPersonas(sid);
    if (!r.ok) { el.innerHTML = '<div class="card card-body"><div class="alert alert-error">' + r.error.message + '</div></div>'; return; }
    const personas = r.data.items || r.data;
    if (!personas.length) {
      el.innerHTML = '<div class="empty-state card"><div class="empty-icon">' + icon('user') + '</div><p class="empty-title">No personas yet</p><p class="empty-desc">Click Generate Personas to build AI user profiles.</p></div>';
      return;
    }
    renderPersonas(personas);
  }

  function renderPersonas(personas) {
    document.getElementById('personas-content').innerHTML =
      '<div class="grid-3">' +
      personas.map((p, i) => {
        const grad = GRADIENTS[i % GRADIENTS.length];
        const [tbg, ttx] = TRAIT_COLORS[i % TRAIT_COLORS.length];
        const personInitials = p.name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
        const confidence = p.confidence ? Math.round((typeof p.confidence === 'number' ? p.confidence : 0.85) * 100) : 85;
        return `<div class="card" style="overflow:hidden">
          <div style="background:${grad};padding:20px;color:#fff">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:12px;flex-wrap:wrap">
              <div style="width:48px;height:48px;background:rgba(255,255,255,.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800">${personInitials}</div>
              <span style="font-size:11.5px;background:rgba(255,255,255,.2);padding:3px 10px;border-radius:999px">${confidence}% confidence</span>
            </div>
            <div style="font-family:'Plus Jakarta Sans',sans-serif;font-style:normal;font-size:20px;font-weight:700">${p.name}</div>
          </div>
          <div style="padding:18px">
            <p style="font-size:13.5px;color:#475569;line-height:1.6;margin-bottom:16px">${p.summary}</p>
            <div style="margin-bottom:14px">
              <div style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Key Traits</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px">${(p.key_traits || []).map(t => `<span style="padding:3px 10px;background:${tbg};color:${ttx};border-radius:999px;font-size:12px;font-weight:500">${t}</span>`).join('')}</div>
            </div>
            <div style="margin-bottom:14px">
              <div style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Frustrations</div>
              ${(p.frustrations || []).map(f => `<div style="display:flex;align-items:flex-start;gap:7px;font-size:13px;color:#475569;margin-bottom:5px">${icon('alertCircle')}<span>${f}</span></div>`).join('')}
            </div>
            <div>
              <div style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Goals</div>
              ${(p.goals || []).map(g => `<div style="display:flex;align-items:flex-start;gap:7px;font-size:13px;color:#475569;margin-bottom:5px">${icon('checkCircle')}<span>${g}</span></div>`).join('')}
            </div>
          </div>
        </div>`;
      }).join('') + '</div>';
  }

  async function generatePersonas() {
    if (!selectedSurveyId) { toast('info', 'Select a survey first'); return; }
    const btn = document.getElementById('btn-gen-per');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generating...';
    document.getElementById('personas-content').innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;padding:56px;gap:12px"><div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#0ea5e9;font-weight:600"><div style="width:8px;height:8px;border-radius:50%;background:#0ea5e9;animation:pulse2 1s ease-in-out infinite"></div>Building personas via POST /surveys/{id}/personas/generate...</div></div>';
    const r = await api.genPersonas(selectedSurveyId);
    btn.disabled = false; btn.innerHTML = icon('sparkles') + ' Generate Personas';
    if (r.ok && r.status === 202) { toast('info', 'Generating...', 'Polling for results'); await new Promise(res => setTimeout(res, 2200)); loadPersonas(selectedSurveyId); }
    else if (r.ok) { renderPersonas(r.data.items || r.data); toast('success', 'Personas generated'); }
    else { toast('error', r.error.message); document.getElementById('personas-content').innerHTML = '<div class="card card-body"><div class="alert alert-error">' + r.error.message + '</div></div>'; }
  }

  document.getElementById('per-survey-sel').addEventListener('change', e => {
    selectedSurveyId = e.target.value;
    if (selectedSurveyId) loadPersonas(selectedSurveyId);
  });
  document.getElementById('btn-gen-per').addEventListener('click', generatePersonas);
  loadSurveys();
}

document.getElementById('root').innerHTML = buildSidebar('personas', 'Personas') + pageHTML() + closeSidebar();
initSidebar();
initPage();


