/* personas.js */
(function () {
  const ws = getWorkspace();
  let selectedSurveyId = null;

  const GRADIENTS = [
    'linear-gradient(135deg,#1d4ed8,#3b82f6)',
    'linear-gradient(135deg,#6d28d9,#8b5cf6)',
    'linear-gradient(135deg,#059669,#10b981)',
    'linear-gradient(135deg,#b45309,#f59e0b)',
    'linear-gradient(135deg,#be123c,#f43f5e)',
  ];
  const TRAIT_THEMES = [
    ['#dbeafe','#1d4ed8'],
    ['#ede9fe','#6d28d9'],
    ['#d1fae5','#065f46'],
    ['#fef3c7','#78350f'],
    ['#fee2e2','#991b1b'],
  ];

  /* ── SHELL ── */
  buildShell('personas', 'Personas');
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Personas</h1>
        <p class="page-subtitle">AI-generated user personas from survey data.</p>
      </div>
      <div style="display:flex;gap:8px">
        <select class="form-select" id="per-survey-sel" style="width:auto;font-size:13px;padding:6px 10px">
          <option value="">Select survey…</option>
        </select>
        <button class="btn btn-ai" id="btn-gen-per">✨ Generate Personas</button>
      </div>
    </div>
    <div id="personas-content">
      <div class="card empty-state">
        <div class="empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        </div>
        <p class="empty-title">No survey selected</p>
        <p class="empty-desc">Select a survey and click Generate Personas to build AI user profiles.</p>
      </div>
    </div>
  `;
  document.getElementById('main-content').insertAdjacentHTML('afterend', '</div></div>');
  initShell();

  /* ── LOAD ── */
  populateSurveySelector('per-survey-sel', ws.id).then(preselected => {
    if (preselected) { selectedSurveyId = preselected; loadPersonas(preselected); }
  });

  async function loadPersonas(sid) {
    const el = document.getElementById('personas-content');
    el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:48px;justify-content:center;color:#94a3b8"><span class="spinner-dark"></span> Loading personas…</div>';
    const r = await api.listPersonas(sid);
    if (!r.ok) {
      el.innerHTML = '<div class="card card-body"><div class="alert alert-error">' + r.error.message + '</div></div>';
      return;
    }
    const personas = r.data.items || r.data;
    if (!personas.length) {
      el.innerHTML = '<div class="card empty-state"><div class="empty-icon">👤</div><p class="empty-title">No personas yet</p><p class="empty-desc">Click Generate Personas to build AI user profiles from this survey\'s responses.</p></div>';
      return;
    }
    renderPersonas(personas);
  }

  function renderPersonas(personas) {
    document.getElementById('personas-content').innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px">' +
      personas.map((p, i) => {
        const grad       = GRADIENTS[i % GRADIENTS.length];
        const [tbg, ttx] = TRAIT_THEMES[i % TRAIT_THEMES.length];
        const initials_p = p.name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
        const conf       = p.confidence ? Math.round((typeof p.confidence === 'number' ? p.confidence : 0.85) * 100) : 85;

        const traits = (p.key_traits || []).map(t =>
          '<span style="padding:3px 10px;background:' + tbg + ';color:' + ttx + ';border-radius:999px;font-size:12px;font-weight:500">' + t + '</span>'
        ).join('');

        const frustrations = (p.frustrations || []).map(f =>
          '<div style="display:flex;align-items:flex-start;gap:7px;font-size:13px;color:#475569;margin-bottom:5px">' +
            '<svg style="flex-shrink:0;color:#ef4444;margin-top:2px" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
            f +
          '</div>'
        ).join('');

        const goals = (p.goals || []).map(g =>
          '<div style="display:flex;align-items:flex-start;gap:7px;font-size:13px;color:#475569;margin-bottom:5px">' +
            '<svg style="flex-shrink:0;color:#10b981;margin-top:2px" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>' +
            g +
          '</div>'
        ).join('');

        return '<div class="card" style="overflow:hidden">' +
          '<div style="background:' + grad + ';padding:20px;color:#fff">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
              '<div style="width:48px;height:48px;background:rgba(255,255,255,.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800">' + initials_p + '</div>' +
              '<span style="font-size:11.5px;background:rgba(255,255,255,.2);padding:3px 10px;border-radius:999px">' + conf + '% confidence</span>' +
            '</div>' +
            '<div style="font-family:\'Instrument Serif\',serif;font-style:italic;font-size:20px;font-weight:700">' + p.name + '</div>' +
          '</div>' +
          '<div style="padding:18px">' +
            '<p style="font-size:13.5px;color:#475569;line-height:1.6;margin-bottom:16px">' + (p.summary || '') + '</p>' +
            (traits ? '<div style="margin-bottom:14px"><div style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Key Traits</div><div style="display:flex;flex-wrap:wrap;gap:6px">' + traits + '</div></div>' : '') +
            (frustrations ? '<div style="margin-bottom:14px"><div style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Frustrations</div>' + frustrations + '</div>' : '') +
            (goals ? '<div><div style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Goals</div>' + goals + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('') +
      '</div>';
  }

  /* ── GENERATE ── */
  async function generatePersonas() {
    if (!selectedSurveyId) { toast('info', 'Select a survey first'); return; }
    const btn = document.getElementById('btn-gen-per');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Generating…';

    document.getElementById('personas-content').innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;padding:56px;gap:12px">' +
        '<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#0ea5e9;font-weight:600">' +
          '<div style="width:8px;height:8px;border-radius:50%;background:#0ea5e9;animation:pulse2 1s ease-in-out infinite"></div>' +
          'Building personas via POST /surveys/{id}/personas/generate…' +
        '</div>' +
      '</div>';

    const r = await api.genPersonas(selectedSurveyId);
    btn.disabled = false;
    btn.innerHTML = '✨ Generate Personas';

    if (r.ok && r.status === 202) {
      toast('info', 'Generating…', 'Polling for results');
      await new Promise(res => setTimeout(res, 2200));
      loadPersonas(selectedSurveyId);
      toast('success', 'Personas ready!');
    } else if (r.ok) {
      renderPersonas(r.data.items || r.data);
      toast('success', 'Personas generated!');
    } else {
      toast('error', r.error.message);
      document.getElementById('personas-content').innerHTML = '<div class="card card-body"><div class="alert alert-error">' + r.error.message + '</div></div>';
    }
  }

  /* ── EVENTS ── */
  document.getElementById('per-survey-sel').addEventListener('change', e => {
    selectedSurveyId = e.target.value;
    if (selectedSurveyId) loadPersonas(selectedSurveyId);
  });
  document.getElementById('btn-gen-per').addEventListener('click', generatePersonas);
})();
