// SamoraOS app: Drop Z1 (9 Nov 2026).
//   Search on SAMpaigns finds a SAMpaign by its name, its owner, or a person
//   or company in it. "srinivas" lists every SAMpaign with a Srinivas in it,
//   says who matched, and one click opens People filtered to them.
// Loaded after app-z.js.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // Escapes, then marks what was searched for.
  function hi(text, q) {
    var t = String(text || ''), i = q ? t.toLowerCase().indexOf(q) : -1;
    if (i < 0) return e(t);
    return e(t.slice(0, i)) + '<mark>' + e(t.slice(i, i + q.length)) + '</mark>' + e(t.slice(i + q.length));
  }
  var IC = {
    person: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.9-3.6 3.7-5.6 7-5.6s6.1 2 7 5.6"/></svg>',
    company: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V6.5L11 4v16M11 9h9v11M7.5 9v.01M7.5 12.5v.01M7.5 16v.01M14.5 13h2M14.5 16.5h2M3 20h18"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>'
  };

  (function css() {
    if (document.getElementById('z1Css')) return;
    var st = document.createElement('style'); st.id = 'z1Css';
    st.textContent = [
      '.z1-hits{display:flex;flex-wrap:wrap;gap:6px;margin:7px 0 2px}',
      '.z1-hit{display:inline-flex;align-items:center;gap:6px;max-width:100%;border:1px solid rgba(var(--c-accent-rgb),.38);background:rgba(var(--c-accent-rgb),.09);color:var(--text);border-radius:999px;padding:4px 11px 4px 9px;font:inherit;font-size:12.5px;line-height:1.3;cursor:pointer;text-align:left}',
      '.z1-hit:hover,.z1-hit:focus-visible{background:rgba(var(--c-accent-rgb),.18);outline:none;border-color:rgba(var(--c-accent-rgb),.7)}',
      '.z1-hit svg{flex:none;color:var(--c-accent-text)}',
      '.z1-hit span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.z1-hit small{color:var(--text-muted,inherit);opacity:.8;font-size:11.5px}',
      '.z1-hit mark,.z1-sum mark,.sp-cn mark{background:rgba(var(--c-accent-rgb),.32);color:inherit;border-radius:3px;padding:0 1px}',
      '.z1-sum{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;margin:0 2px 12px;font-size:13px;color:var(--text-muted,inherit)}',
      '.z1-sum svg{color:var(--c-accent-text)}',
      '.z1-sum b{color:var(--text)}',
      '.z1-sum button{background:none;border:0;padding:0;font:inherit;color:var(--c-accent-text);text-decoration:underline;text-underline-offset:3px;cursor:pointer}',
      '.z1-wait{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid rgba(var(--c-accent-rgb),.35);border-top-color:var(--c-accent-text);animation:z1Spin .8s linear infinite}',
      '@keyframes z1Spin{to{transform:rotate(360deg)}}',
      '@media (max-width:640px){.z1-hit{font-size:12px}.z1-hits{gap:5px}}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  var S = window._z1Search = window._z1Search || { q: '', hits: null, archived: [], busy: false, t: null, seq: 0 };
  function qNow() { return String(window._sampSearch || '').trim().toLowerCase(); }

  function run(qRaw) {
    var q = String(qRaw || '').trim().toLowerCase();
    clearTimeout(S.t);
    if (q.length < 2) { S.q = q; S.hits = null; S.archived = []; S.busy = false; return; }
    if (q === S.q && S.hits) return;
    S.busy = true;
    S.t = setTimeout(function () {
      var my = ++S.seq;
      _sampEdge('search_sampaigns', { q: q }).then(function (d) {
        if (my !== S.seq) return;
        S.busy = false; S.q = q;
        S.hits = d && d.ok ? (d.hits || {}) : {};
        S.archived = d && d.ok ? (d.archived_list || []) : [];
        if (qNow() === q) window._spRenderRows();
      }).catch(function () { if (my === S.seq) { S.busy = false; S.hits = {}; if (qNow() === q) window._spRenderRows(); } });
    }, 260);
  }

  // Opens the SAMpaign on People, filtered to who matched.
  window.z1OpenHit = function (ev, id, term) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    window._spPeopleF = window._spPeopleF || {};
    window._spPeopleF[id] = { q: term };
    openSampaignDetail(id, 'people');
  };
  window.z1ShowArchived = function () { setSampaignView('archived'); };

  var baseToolbar = window._spRenderToolbar;
  window._spRenderToolbar = function (d) {
    baseToolbar(d);
    var inp = document.getElementById('sampSearch'); if (!inp) return;
    inp.placeholder = 'Search a SAMpaign, person or company';
    inp.setAttribute('aria-label', 'Search SAMpaigns by name, owner, person or company');
    inp.oninput = function () { window._sampSearch = this.value; run(this.value); window._spRenderRows(); };
    if (qNow().length >= 2 && (!S.hits || S.q !== qNow())) run(qNow());
  };

  function hitHtml(id, h, q) {
    var out = [];
    (h.people || []).slice(0, 2).forEach(function (p) {
      out.push('<button type="button" class="z1-hit" onclick="z1OpenHit(event,\'' + e(id) + '\',\'' + e(String(p.name || '').replace(/'/g, '')) + '\')" aria-label="Open ' + e(p.name) + ' in People">' + IC.person +
        '<span>' + hi(p.name, q) + (p.company ? ' <small>' + e(p.company) + '</small>' : '') + '</span></button>');
    });
    var morePeople = (h.people_count || 0) - Math.min(2, (h.people || []).length);
    if (morePeople > 0) out.push('<button type="button" class="z1-hit" onclick="z1OpenHit(event,\'' + e(id) + '\',\'' + e(q.replace(/'/g, '')) + '\')">' + IC.person + '<span>' + morePeople + ' more</span></button>');
    (h.companies || []).slice(0, 2).forEach(function (c) {
      out.push('<button type="button" class="z1-hit" onclick="z1OpenHit(event,\'' + e(id) + '\',\'' + e(String(c.name || '').replace(/'/g, '')) + '\')" aria-label="Open ' + e(c.name) + ' in People">' + IC.company +
        '<span>' + hi(c.name, q) + (c.people ? ' <small>' + c.people + (c.people === 1 ? ' person' : ' people') + '</small>' : '') + '</span></button>');
    });
    var moreCo = (h.company_count || 0) - Math.min(2, (h.companies || []).length);
    if (moreCo > 0) out.push('<button type="button" class="z1-hit" onclick="z1OpenHit(event,\'' + e(id) + '\',\'' + e(q.replace(/'/g, '')) + '\')">' + IC.company + '<span>' + moreCo + ' more</span></button>');
    return out.length ? '<div class="z1-hits">' + out.join('') + '</div>' : '';
  }

  var baseRows = window._spRenderRows;
  window._spRenderRows = function () {
    var el = document.getElementById('sampaignCampaignsList'), d = window._sampList;
    var q = qNow();
    if (!el || !d || q.length < 2) return baseRows();
    var hits = S.q === q && S.hits ? S.hits : {};
    var byName = function (c) { return (c.name + ' ' + (c.owner_email || '') + ' ' + (c.focus || '')).toLowerCase().indexOf(q) !== -1; };
    var keep = (d.campaigns || []).filter(function (c) { return byName(c) || hits[c.id]; });
    // The base list does the owner and channel filters and draws each row.
    var saveList = window._sampList, saveQ = window._sampSearch;
    window._sampList = Object.assign({}, d, { campaigns: keep });
    window._sampSearch = '';
    try { baseRows(); } finally { window._sampList = saveList; window._sampSearch = saveQ; }
    var rows = el.querySelectorAll('.sp-row');
    var shown = 0, byPerson = 0, byCompany = 0, byNameN = 0;
    Array.prototype.forEach.call(rows, function (row) {
      var m = String(row.getAttribute('onclick') || '').match(/openSampaignDetail\('([^']+)'/); if (!m) return;
      shown++;
      var id = m[1], c = (d.campaigns || []).find(function (x) { return x.id === id; }) || {}, h = hits[id];
      var cn = row.querySelector('.sp-cn');
      if (cn && c.name && String(c.name).toLowerCase().indexOf(q) !== -1) { cn.innerHTML = hi(c.name, q); byNameN++; }
      if (h) {
        if (h.people_count) byPerson++; else if (h.company_count) byCompany++;
        if (cn) cn.insertAdjacentHTML('afterend', hitHtml(id, h, q));
      }
    });
    var arch = (window._sampaignView || 'active') === 'active' ? (S.archived || []) : [];
    var archLine = arch.length ? '<span>Also in ' + arch.length + ' archived: ' + arch.slice(0, 3).map(function (a) { return '<b>' + e(a.name) + '</b>'; }).join(', ') + ' <button type="button" onclick="z1ShowArchived()">Show archived</button></span>' : '';
    var busy = S.busy || S.q !== q;
    if (!shown) {
      el.innerHTML = '<div class="sp-card sp-empty">' + (busy ? '<span class="z1-wait" aria-hidden="true"></span> Looking for "' + e(q) + '" in every SAMpaign\'s people and companies…'
        : 'No SAMpaign, person or company matches "' + e(q) + '".' + (archLine ? '<div class="z1-sum" style="justify-content:center;margin-top:10px">' + archLine + '</div>' : '')) + '</div>';
      return;
    }
    var bits = [];
    if (byNameN) bits.push(byNameN + ' by name');
    if (byPerson) bits.push(byPerson + ' with a person');
    if (byCompany) bits.push(byCompany + ' with a company');
    el.insertAdjacentHTML('afterbegin', '<div class="z1-sum" role="status">' + IC.search + '<span><b>' + shown + (shown === 1 ? ' SAMpaign' : ' SAMpaigns') + '</b> for "' + e(q) + '"' + (bits.length ? ': ' + bits.join(', ') : '') + '</span>' +
      (busy ? '<span><span class="z1-wait" aria-hidden="true"></span> checking people and companies</span>' : '') + archLine + '</div>');
  };
})();
