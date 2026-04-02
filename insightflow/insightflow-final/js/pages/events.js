/* events.js — Admin Events & Audit Log */
(function () {
  const ws = getWorkspace();
  let allEvents  = [];
  let filterCat  = 'all';
  let searchTerm = '';

  /* ── SHELL ── */
  buildShell('events', 'Events & Audit Log');
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Events &amp; Audit Log</h1>
        <p class="page-subtitle">Usage and audit events across your workspace.</p>
      </div>
    </div>

    <div style="position:relative;max-width:380px;margin-bottom:16px">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </span>
      <input id="evt-search" class="form-input" placeholder="Search events…" style="padding-left:34px"/>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="filter-pill active" data-filter="all" id="pill-all">All</button>
      <button class="filter-pill" data-filter="usage" id="pill-usage">Usage</button>
      <button class="filter-pill" data-filter="audit" id="pill-audit">Audit</button>
    </div>

    <div class="card" style="overflow:hidden">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:36px"><input type="checkbox" id="chk-all" style="cursor:pointer"/></th>
              <th>Type</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Resource</th>
              <th>Details</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody id="events-tbody">
            <tr><td colspan="7" style="padding:40px;text-align:center;color:#94a3b8"><span class="spinner-dark"></span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('main-content').insertAdjacentHTML('afterend', '</div></div>');
  initShell();

  /* ── TYPE COLORS ── */
  const TYPE_COLORS = {
    'survey.published':           ['#dbeafe','#1d4ed8'],
    'insights.generated':         ['#ede9fe','#5b21b6'],
    'member.invited':             ['#d1fae5','#065f46'],
    'report.generated':           ['#cffafe','#155e75'],
    'project.created':            ['#fef3c7','#78350f'],
    'survey.response':            ['#dcfce7','#15803d'],
    'workspace.settings_updated': ['#fee2e2','#991b1b'],
    'personas.generated':         ['#fae8ff','#7e22ce'],
  };

  /* ── LOAD ── */
  async function loadEvents() {
    const r = await api.listEvents(ws.id);
    if (r.ok) {
      allEvents = r.data.items || r.data;
    } else {
      allEvents = [];
    }
    updateCounts();
    renderTable();
  }

  /* ── UPDATE COUNTS ── */
  function updateCounts() {
    const total = allEvents.length;
    const usage = allEvents.filter(e => e.category === 'usage').length;
    const audit = allEvents.filter(e => e.category === 'audit').length;
    document.getElementById('pill-all').textContent   = 'All (' + total + ')';
    document.getElementById('pill-usage').textContent = 'Usage (' + usage + ')';
    document.getElementById('pill-audit').textContent = 'Audit (' + audit + ')';
  }

  /* ── FILTER & RENDER ── */
  function filtered() {
    return allEvents
      .filter(e => filterCat === 'all' || e.category === filterCat)
      .filter(e => {
        if (!searchTerm) return true;
        const t = searchTerm.toLowerCase();
        return (e.type     || '').toLowerCase().includes(t)
            || (e.action   || '').toLowerCase().includes(t)
            || (e.actor    || '').toLowerCase().includes(t)
            || (e.resource || '').toLowerCase().includes(t)
            || (e.details  || '').toLowerCase().includes(t);
      });
  }

  function renderTable() {
    const rows  = filtered();
    const tbody = document.getElementById('events-tbody');

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="padding:48px;text-align:center;color:#94a3b8">' +
        (allEvents.length === 0
          ? 'No events yet — events will appear here as your workspace is used.'
          : 'No events match your search.') +
        '</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(e => {
      const [bg, tx] = TYPE_COLORS[e.type] || ['#f1f5f9', '#64748b'];
      const time     = fmtTime(e.created_at || e.time || '');
      return '<tr>' +
        '<td><input type="checkbox" style="cursor:pointer"/></td>' +
        '<td><span style="background:' + bg + ';color:' + tx + ';padding:2px 8px;border-radius:5px;font-size:11.5px;font-weight:600;font-family:monospace;white-space:nowrap">' + (e.type || '') + '</span></td>' +
        '<td style="font-size:13px;color:#1a2332">' + (e.action || '') + '</td>' +
        '<td style="font-size:13px;color:#475569">' + (e.actor || '') + '</td>' +
        '<td style="font-size:13px;font-weight:600;color:#1a2332">' + (e.resource || '') + '</td>' +
        '<td style="font-size:12.5px;color:#64748b;max-width:260px">' + (e.details || '') + '</td>' +
        '<td style="font-size:12px;color:#94a3b8;white-space:nowrap">' + time + '</td>' +
      '</tr>';
    }).join('');
  }

  /* ── EVENTS ── */
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterCat = btn.dataset.filter;
      renderTable();
    });
  });

  document.getElementById('evt-search').addEventListener('input', e => {
    searchTerm = e.target.value;
    renderTable();
  });

  document.getElementById('chk-all').addEventListener('change', e => {
    document.querySelectorAll('#events-tbody input[type=checkbox]').forEach(c => c.checked = e.target.checked);
  });

  loadEvents();
})();
