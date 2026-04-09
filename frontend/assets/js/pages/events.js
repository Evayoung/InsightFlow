if (!requireAuth()) throw '';

function pageHTML() {
  return `
  <div class="page-header">
    <div>
      <h1 class="page-title">Events &amp; Audit Log</h1>
      <p class="page-subtitle">Usage and audit events across your workspace.</p>
    </div>
  </div>

  <div class="search-shell" style="margin-bottom:16px;max-width:380px">
    <span class="search-icon">${icon('search')}</span>
    <input id="evt-search" class="form-input" placeholder="Search events..."/>
  </div>

  <div class="filter-bar" style="margin-bottom:16px">
    <button class="evt-filter-btn active" data-filter="all" style="padding:6px 14px;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:#0079C1;color:#fff;transition:all .15s">All</button>
    <button class="evt-filter-btn" data-filter="usage" style="padding:6px 14px;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:#f1f5f9;color:#475569;transition:all .15s">Usage</button>
    <button class="evt-filter-btn" data-filter="audit" style="padding:6px 14px;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:#f1f5f9;color:#475569;transition:all .15s">Audit</button>
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
  </div>`;
}

function initPage() {
  const ws = getWorkspace();
  let allEvents = [];
  let filterCat = 'all';
  let searchTerm = '';

  const CAT_COLORS = {
    'survey.published': ['#dbeafe','#1d4ed8'],
    'insights.generated': ['#ede9fe','#5b21b6'],
    'member.invited': ['#d1fae5','#065f46'],
    'report.generated': ['#cffafe','#155e75'],
    'project.created': ['#fef3c7','#78350f'],
    'survey.response': ['#dcfce7','#15803d'],
    'workspace.settings_updated': ['#fee2e2','#991b1b'],
    'personas.generated': ['#fae8ff','#7e22ce'],
  };

  async function loadEvents() {
    const r = await api.workspaceActivity(ws.id);
    allEvents = r.ok ? (r.data.items || r.data) : [];
    renderTable();
    updateCounts();
  }

  function updateCounts() {
    const all = allEvents.length;
    const usage = allEvents.filter(e => e.category === 'usage').length;
    const audit = allEvents.filter(e => e.category === 'audit').length;
    document.querySelectorAll('.evt-filter-btn').forEach(btn => {
      if (btn.dataset.filter === 'all') btn.textContent = 'All (' + all + ')';
      if (btn.dataset.filter === 'usage') btn.textContent = 'Usage (' + usage + ')';
      if (btn.dataset.filter === 'audit') btn.textContent = 'Audit (' + audit + ')';
    });
  }

  function filtered() {
    return allEvents
      .filter(e => filterCat === 'all' || e.category === filterCat)
      .filter(e => {
        if (!searchTerm) return true;
        const t = searchTerm.toLowerCase();
        return (e.type || '').toLowerCase().includes(t)
          || (e.action || '').toLowerCase().includes(t)
          || (e.actor || '').toLowerCase().includes(t)
          || (e.resource || '').toLowerCase().includes(t)
          || (e.details || '').toLowerCase().includes(t);
      });
  }

  function renderTable() {
    const rows = filtered();
    const tbody = document.getElementById('events-tbody');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="padding:48px;text-align:center;color:#94a3b8">' + (allEvents.length === 0 ? 'No events yet - events will appear here as your workspace is used.' : 'No events match your search.') + '</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(e => {
      const [bg, tx] = CAT_COLORS[e.type] || ['#f1f5f9','#64748b'];
      return `<tr>
        <td><input type="checkbox" style="cursor:pointer"/></td>
        <td><span style="background:${bg};color:${tx};padding:2px 8px;border-radius:5px;font-size:11.5px;font-weight:600;font-family:monospace;white-space:nowrap">${e.type || ''}</span></td>
        <td style="font-size:13px;color:#1a2332">${e.action || ''}</td>
        <td style="font-size:13px;color:#475569">${e.actor || ''}</td>
        <td style="font-size:13px;font-weight:600;color:#1a2332">${e.resource || ''}</td>
        <td style="font-size:12.5px;color:#64748b;max-width:260px">${e.details || ''}</td>
        <td style="font-size:12px;color:#94a3b8;white-space:nowrap">${fmtTime(e.created_at || e.time)}</td>
      </tr>`;
    }).join('');
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.evt-filter-btn');
    if (!btn) return;
    document.querySelectorAll('.evt-filter-btn').forEach(b => {
      b.style.background = '#f1f5f9'; b.style.color = '#475569';
    });
    btn.style.background = '#0079C1'; btn.style.color = '#fff';
    filterCat = btn.dataset.filter;
    renderTable();
  });

  document.getElementById('evt-search').addEventListener('input', e => {
    searchTerm = e.target.value; renderTable();
  });

  document.getElementById('chk-all').addEventListener('change', e => {
    document.querySelectorAll('#events-tbody input[type=checkbox]').forEach(c => c.checked = e.target.checked);
  });

  loadEvents();
}

document.getElementById('root').innerHTML = buildSidebar('', 'Events & Audit Log') + pageHTML() + closeSidebar();
initSidebar();
initPage();
