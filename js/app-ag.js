// Drop AG (26 Nov 2026): "Met with sales". The people your sales team is
// talking to (meetings, positive replies, LinkedIn replies, open deals), as a
// live list, in your sales sheet's columns, for Meta, or straight into Brevo.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function call(action, body) { return _sampEdge(action, body || {}); }
  function toast(m) { try { showToast(m); } catch (_e) {} }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function day(d) { if (!d) return ''; var t = new Date(d + 'T12:00:00Z'); return isNaN(t) ? d : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  (function css() {
    if (document.getElementById('agCss')) return;
    var st = document.createElement('style'); st.id = 'agCss';
    st.textContent = [
      '.g19-aud.ag-wide{max-width:980px}',
      '.ag-opts{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:10px}',
      '.ag-opt{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);cursor:pointer}.ag-opt input{accent-color:#B8860B;width:16px;height:16px}',
      '.ag-opt select{font:13px var(--font);color:var(--text);border:1px solid var(--c-line-strong);border-radius:10px;padding:5px 8px;background:var(--surface)}',
      '.ag-segs{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.ag-sg{font-size:12.5px;padding:5px 11px;border-radius:999px;background:var(--surface2);border:1px solid var(--border);color:var(--text2)}.ag-sg b{color:var(--text);font-variant-numeric:tabular-nums}',
      '.ag-out{font-size:12.5px;color:var(--text3);margin-top:8px;line-height:1.5}',
      '.ag-tw{margin-top:12px;border:1px solid var(--border);border-radius:14px;max-height:340px;overflow:auto}',
      '.ag-t{width:100%;border-collapse:collapse;font-size:13px}.ag-t th{position:sticky;top:0;background:var(--surface2);text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--text3);padding:8px 10px;font-weight:700}',
      '.ag-t td{padding:8px 10px;border-top:1px solid var(--border);color:var(--text2);vertical-align:top}.ag-t td b{color:var(--text);font-weight:600}.ag-t small{display:block;color:var(--text3);font-size:12px}',
      '.ag-pill{display:inline-block;font-size:11.5px;font-weight:650;padding:2px 8px;border-radius:999px;white-space:nowrap}',
      '.ag-p-deal{background:rgba(var(--c-accent-rgb),.18);color:var(--c-accent-text,var(--gold))}.ag-p-met{background:rgba(46,107,69,.14);color:var(--green,#2E6B45)}.ag-p-replied{background:rgba(59,91,153,.14);color:#3B5B99}.ag-p-connected{background:rgba(127,127,127,.14);color:var(--text2)}',
      '.ag-ic{font-size:11.5px;color:var(--text3)}',
      '.ag-br{margin-top:10px;padding:14px 16px;border-radius:14px;border:1px solid rgba(var(--c-accent-rgb),.32);background:rgba(var(--c-accent-rgb),.05)}',
      '.ag-br h4{margin:0 0 4px;font-size:14px;font-weight:650;color:var(--text)}.ag-br p{margin:0;font-size:12.5px;line-height:1.5;color:var(--text2)}',
      '.ag-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px}.ag-row input[type=password],.ag-row input[type=text],.ag-row select{flex:1;min-width:180px;font:13.5px var(--font);color:var(--text);border:1px solid var(--c-line-strong);border-radius:10px;padding:8px 10px;background:var(--surface)}',
      '.ag-last{font-size:12.5px;color:var(--text3);margin-top:8px}',
      '.ag-lk{all:unset;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--c-accent-text,var(--gold))}.ag-lk:hover{text-decoration:underline}.ag-lk:focus-visible{outline:2px solid var(--c-focus,var(--gold));outline-offset:2px;border-radius:4px}',
      '@media (max-width:640px){.ag-t .ag-hide{display:none}.ag-tw{max-height:300px}}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  var AG_FMT = [
    ['sheet', 'Sales sheet (readable)', 'Names, emails and companies you can read, in the columns your sales team fills in today. Open it in Excel or Google Sheets.', 'Sales sheet'],
    ['brevo', 'Brevo import', 'Brevo’s own column names. Import it into a list; Brevo’s Meta Ads integration can sync that list.', 'Brevo import'],
    ['meta', 'Meta upload (scrambled, not readable)', 'For Meta Ads only. Every email and name is scrambled so Meta can match people privately, so the file looks like random letters. Upload it to Meta as it is. To read the list, download the Sales sheet.', 'for Meta upload'],
    ['linkedin_companies', 'LinkedIn companies', 'The companies only, no personal data. Works at any size.', 'LinkedIn companies']
  ];
  // The older audiences say the same.
  try { if (typeof G19_FMT !== 'undefined') G19_FMT.forEach(function (f) { if (f[0] === 'meta') { f[1] = 'Meta upload (scrambled, not readable)'; f[2] = 'For Meta Ads only. Emails, phone numbers and names are scrambled so Meta can match people privately; nobody can read the file. Upload it as it is. Meta suggests at least 1,000 people.'; } }); } catch (_e) {}
  var SEG_LBL = { deal: 'Deal in progress', met: 'Met', replied: 'Replied', connected: 'Connected' };
  var LEFT = { not_interested: 'said not interested', opted_out: 'opted out', bounced: 'bounced', won: 'won clients', internal: 'your own team', lost: 'not going ahead', older: 'outside the time window' };

  if (typeof G19_SEG !== 'undefined' && !G19_SEG.some(function (x) { return x[0] === 'met_sales'; })) G19_SEG.unshift(['met_sales', 'Met with sales']);

  // Opens on "Met with sales".
  if (typeof window.openAdAudience === 'function' && !window.openAdAudience._ag) {
    var baseOpen = window.openAdAudience;
    window.openAdAudience = openAdAudience = async function (campaignId) {
      var r = baseOpen.apply(this, arguments);
      var A = window._g19Aud;
      if (A && !A._ag) { A._ag = true; A.seg = 'met_sales'; A.fmt = 'sheet'; A.opts = { li_accepted: false, not_now: false, deals: true, exclude_won: true, days: 180 }; A.people = null; A.brevo = null; }
      await r;
      if (window._g19Aud === A) { agBrevoLoad(); _g19AudPreview(); }
      return r;
    };
    window.openAdAudience._ag = true;
  }

  var baseRender = window._g19AudRender;
  window._g19AudRender = _g19AudRender = function () {
    var A = window._g19Aud, el = document.getElementById('g19AudBody');
    var card = el && el.closest('.sp-mcard'); if (card) card.classList.toggle('ag-wide', !!(A && A.seg === 'met_sales'));
    if (!A || A.seg !== 'met_sales' || !el) { if (A && typeof G19_FMT !== 'undefined' && !G19_FMT.some(function (f) { return f[0] === A.fmt; })) A.fmt = 'meta'; return baseRender.apply(this, arguments); }
    if (!AG_FMT.some(function (f) { return f[0] === A.fmt; })) A.fmt = 'sheet';
    var s = A.sum, O = A.opts || {};
    var tile = function (n, l) { return '<div class="g19-t"><b>' + (n === null || n === undefined ? '…' : n) + '</b><span>' + l + '</span></div>'; };
    var segs = s && s.by_segment ? '<div class="ag-segs">' + ['deal', 'met', 'replied', 'connected'].filter(function (k) { return s.by_segment[k] || k !== 'connected' || O.li_accepted; }).map(function (k) { return '<span class="ag-sg"><b>' + (s.by_segment[k] || 0) + '</b> ' + SEG_LBL[k].toLowerCase() + '</span>'; }).join('') + '</div>' : '';
    var lo = s && s.left_out ? Object.keys(LEFT).filter(function (k) { return s.left_out[k]; }).map(function (k) { return s.left_out[k] + ' ' + (k === 'won' && s.left_out[k] === 1 ? 'won client' : LEFT[k]); }) : [];
    var rows = A.people;
    var table = rows === null ? '<div class="sp-small" style="margin-top:12px">Loading the people…</div>'
      : !rows.length ? '<div class="sp-small" style="margin-top:12px">Nobody yet. As soon as someone takes a meeting or replies with interest, they appear here.</div>'
      : '<div class="ag-tw"><table class="ag-t"><thead><tr><th>Person</th><th>Why</th><th class="ag-hide">Stage</th><th class="ag-hide">Last</th><th class="ag-hide">Owner</th></tr></thead><tbody>' +
        rows.map(function (p) { return '<tr><td><b>' + e(p.name) + '</b><small>' + e([p.title, p.company].filter(Boolean).join(', ')) + '</small><span class="ag-ic">' + (p.has_email ? 'Email' : 'No email') + (p.has_phone ? ' · Phone' : '') + '</span></td><td><span class="ag-pill ag-p-' + e(p.segment) + '">' + e(SEG_LBL[p.segment] || p.segment) + '</span><small>' + e(p.where) + '</small></td><td class="ag-hide">' + e(p.stage) + '</td><td class="ag-hide">' + e(day(p.last)) + '</td><td class="ag-hide">' + e(p.owner) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        (s && s.people > rows.length ? '<div class="sp-small" style="margin-top:6px">Showing the first ' + rows.length + ' of ' + s.people + '. The file has everyone.</div>' : '');
    var ids = typeof _g19AudIds === 'function' ? _g19AudIds() : [];
    el.innerHTML = '<h3>Ad audience: met with sales</h3><p class="sp-muted" style="margin:4px 0 0">Everyone your sales team is talking to, found by Samora from meetings, replies, LinkedIn and open deals. Nobody fills in a sheet. People who opted out, bounced or said not interested are left out.</p>' +
      '<div class="g19-sec">Who</div><div class="g19-seg">' + G19_SEG.map(function (x) { return '<button type="button" class="' + (A.seg === x[0] ? 'on' : '') + '" data-g19-seg="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="ag-opts">' +
        '<label class="ag-opt"><input type="checkbox" data-ag-opt="li_accepted"' + (O.li_accepted ? ' checked' : '') + '> Accepted on LinkedIn, no reply yet</label>' +
        '<label class="ag-opt"><input type="checkbox" data-ag-opt="not_now"' + (O.not_now ? ' checked' : '') + '> Replied “not now”</label>' +
        '<label class="ag-opt"><input type="checkbox" data-ag-opt="deals"' + (O.deals ? ' checked' : '') + '> People on open deals</label>' +
        '<label class="ag-opt"><input type="checkbox" data-ag-opt="exclude_won"' + (O.exclude_won ? ' checked' : '') + '> Leave out won clients</label>' +
        '<label class="ag-opt">Last <select data-ag-opt="days">' + [30, 90, 180, 365].map(function (d) { return '<option value="' + d + '"' + (Number(O.days) === d ? ' selected' : '') + '>' + d + ' days</option>'; }).join('') + '</select></label>' +
      '</div>' +
      '<div class="g19-tiles">' + tile(s ? s.people : null, 'people') + tile(s ? s.with_email : null, 'with an email') + tile(s ? s.with_phone : null, 'with a phone') + tile(s ? s.companies : null, 'companies') + '</div>' + segs +
      (lo.length ? '<div class="ag-out">Left out: ' + e(lo.join(', ')) + '.</div>' : '') +
      (s && s.left_out_provider_data ? '<div class="ag-out">' + pl(s.left_out_provider_data, 'email or number', 'emails and numbers') + ' from Lusha, Apollo or ZoomInfo left out, as your admin has set.</div>' : '') +
      table +
      '<div class="g19-sec">From</div><div class="g19-camps">' + (A.camps || []).map(function (c) { return '<label class="g19-camp"><input type="checkbox" data-g19-camp="' + e(c.id) + '"' + (A.picked[c.id] ? ' checked' : '') + '><span><b>' + e(c.name) + '</b><small>' + pl(c.people, 'person', 'people') + (c.owner ? ' · ' + e(c.owner) : '') + '</small></span></label>'; }).join('') + '</div>' +
      '<div class="g19-sec">Download</div><div class="g19-fmts">' + AG_FMT.map(function (f) { return '<button type="button" class="g19-fmt' + (A.fmt === f[0] ? ' on' : '') + '" data-g19-fmt="' + f[0] + '"><b>' + f[1] + '</b><span>' + f[2] + '</span></button>'; }).join('') + '</div>' +
      '<div class="g19-sec">Brevo</div>' + agBrevoHtml(A) +
      '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'g19Aud\').remove()">Close</button><button class="g-btn sp-gold" type="button" data-ag-dl="1"' + (!ids.length || (s && !s.people) ? ' disabled' : '') + '>' + (typeof G19_ICON !== 'undefined' ? G19_ICON.dl : '') + ' Download ' + e(((AG_FMT.find(function (f) { return f[0] === A.fmt; }) || AG_FMT[0])[3])) + '</button></div>';
  };

  var basePreview = window._g19AudPreview, agT = null;
  window._g19AudPreview = _g19AudPreview = function () {
    var A = window._g19Aud;
    if (!A || A.seg !== 'met_sales') return basePreview.apply(this, arguments);
    clearTimeout(agT);
    agT = setTimeout(async function () {
      var ids = _g19AudIds();
      A.sum = null; A.people = null; _g19AudRender();
      if (!ids.length) { A.sum = { people: 0, with_email: 0, with_phone: 0, companies: 0, by_segment: {} }; A.people = []; _g19AudRender(); return; }
      var d = await call('ad_audience_preview', { campaign_ids: ids, segment: 'met_sales', opts: A.opts, list: true });
      if (window._g19Aud !== A) return;
      if (!d.ok) { toast(d.error || 'Could not count the audience'); A.sum = { people: 0, with_email: 0, with_phone: 0, companies: 0, by_segment: {} }; A.people = []; }
      else { A.sum = d.summary; A.people = d.people || []; }
      _g19AudRender();
    }, 250);
  };

  // ── Brevo ──────────────────────────────────────────────────────────────
  async function agBrevoLoad() {
    var A = window._g19Aud; if (!A) return;
    var d = await call('brevo_status', {});
    if (window._g19Aud !== A) return;
    A.brevo = d && d.ok ? d : { error: (d && d.error) || 'Could not reach Brevo settings.' };
    if (A.brevo.connected) { var l = await call('brevo_lists', {}); if (window._g19Aud === A) A.blists = l.ok ? l.lists : []; }
    _g19AudRender();
  }
  window.agBrevoLoad = agBrevoLoad;
  function agBrevoHtml(A) {
    var b = A.brevo;
    if (!b) return '<div class="ag-br"><p>Loading…</p></div>';
    if (b.error) return '<div class="ag-br"><p>' + e(b.error) + '</p></div>';
    if (!b.connected) return '<div class="ag-br"><h4>Send this list to Brevo</h4><p>Paste a Brevo API key (in Brevo: your name, SMTP &amp; API, API keys). Samora keeps it on its server; it is never shown again.</p>' +
      '<div class="ag-row"><input type="password" id="agBrevoKey" autocomplete="off" placeholder="xkeysib-…" aria-label="Brevo API key"><button class="g-btn sp-gold" type="button" data-ag-brevo="connect">Connect Brevo</button></div></div>';
    var lists = A.blists || [];
    var last = b.last ? 'Last sent ' + new Date(b.last.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + (b.last.by === 'nightly' ? ' (overnight)' : '') + ': ' + pl(b.last.sent, 'person', 'people') + ', ' + b.last.added + ' new, ' + b.last.removed + ' taken off.' + (b.last.left_out_no_email ? ' ' + b.last.left_out_no_email + ' without an email stayed out.' : '') : 'Nothing sent yet.';
    return '<div class="ag-br"><h4>Brevo' + (b.company ? ': ' + e(b.company) : '') + ' <span class="ag-ic">key ending ' + e(b.last4 || '') + '</span></h4>' +
      '<p>For ads only: Brevo’s Meta Ads integration syncs the list to a Meta audience. Do not email this list; these people have not signed up for newsletters.</p>' +
      '<div class="ag-row"><select id="agBrevoList" aria-label="Brevo list"><option value="">Pick a list…</option>' + lists.map(function (l) { return '<option value="' + l.id + '"' + (Number(b.list_id) === Number(l.id) ? ' selected' : '') + '>' + e(l.name) + ' (' + l.people + ')</option>'; }).join('') + '</select>' +
      '<input type="text" id="agBrevoNew" placeholder="or a new list: Samora: Met with sales" aria-label="New Brevo list name"><button class="g-btn" type="button" data-ag-brevo="list">Use this list</button></div>' +
      '<div class="ag-row"><button class="g-btn sp-gold" type="button" data-ag-brevo="push"' + (b.list_id ? '' : ' disabled') + '>Send to Brevo now</button>' +
      '<label class="ag-opt"><input type="checkbox" data-ag-brevo="auto"' + (b.auto ? ' checked' : '') + (b.list_id ? '' : ' disabled') + '> Keep it updated every night</label>' +
      '<span style="flex:1"></span><button class="ag-lk" type="button" data-ag-brevo="disconnect">Disconnect</button></div>' +
      '<div class="ag-last">' + e(b.list_name ? 'List: ' + b.list_name + '. ' : '') + e(last) + ' People who opt out or become clients come off the list on the next send.</div></div>';
  }

  document.addEventListener('change', function (ev) {
    var t = ev.target, A = window._g19Aud; if (!t || !A || !t.getAttribute) return;
    var k = t.getAttribute('data-ag-opt');
    if (k) { A.opts = A.opts || {}; A.opts[k] = k === 'days' ? Number(t.value) : !!t.checked; _g19AudPreview(); return; }
    if (t.getAttribute('data-ag-brevo') === 'auto') agBrevoAct('auto', t);
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-ag-dl],[data-ag-brevo]'); if (!t || !window._g19Aud) return;
    if (t.hasAttribute('data-ag-dl')) { agDownload(t); return; }
    var a = t.getAttribute('data-ag-brevo'); if (a && a !== 'auto') agBrevoAct(a, t);
  });
  async function agDownload(btn) {
    var A = window._g19Aud;
    btn.disabled = true; btn.textContent = 'Preparing…';
    var d = await call('ad_audience_export', { campaign_ids: _g19AudIds(), segment: 'met_sales', format: A.fmt, opts: A.opts });
    if (!d.ok) { toast(d.error || 'Could not export'); _g19AudRender(); return; }
    var blob = new Blob([d.csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = d.filename || 'samora-met-with-sales.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    window._g19LastExport = d;
    var where = { sheet: 'Open it in Excel or Google Sheets.', brevo: 'Import it in Brevo, Contacts, Import contacts, into one list.', meta: 'Upload it in Meta Ads Manager, Audiences, Custom audience, Customer list.', linkedin_companies: 'Upload it in LinkedIn Campaign Manager, Audiences, Upload a list.' }[A.fmt] || '';
    toast('Downloaded ' + pl(d.rows, 'row') + '. ' + where);
    try { g19UsageLoad(true); } catch (_e) {}
    _g19AudRender();
  }
  async function agBrevoAct(a, el) {
    var A = window._g19Aud, b = A.brevo || {};
    if (a === 'connect') {
      var k = (document.getElementById('agBrevoKey') || {}).value || '';
      if (!k.trim()) { toast('Paste your Brevo API key first.'); return; }
      el.disabled = true; el.textContent = 'Checking…';
      var d = await call('brevo_connect', { api_key: k.trim() });
      var inp = document.getElementById('agBrevoKey'); if (inp) inp.value = '';
      if (!d.ok) { toast(d.error || 'Could not connect Brevo'); el.disabled = false; el.textContent = 'Connect Brevo'; return; }
      toast('Brevo connected' + (d.company ? ': ' + d.company : '') + '.');
      return agBrevoLoad();
    }
    if (a === 'list') {
      var nn = ((document.getElementById('agBrevoNew') || {}).value || '').trim();
      var sel = document.getElementById('agBrevoList');
      var body = nn ? { create_list: nn } : { list_id: sel && sel.value, list_name: sel && sel.value ? sel.options[sel.selectedIndex].text.replace(/ \(\d+\)$/, '') : '' };
      if (!nn && !(sel && sel.value)) { toast('Pick a list, or type a name for a new one.'); return; }
      el.disabled = true;
      var r = await call('brevo_set', body);
      if (!r.ok) { toast(r.error || 'Could not save'); el.disabled = false; return; }
      toast('Samora will send to “' + (r.list_name || 'that list') + '”.');
      return agBrevoLoad();
    }
    if (a === 'auto') {
      var r2 = await call('brevo_set', { auto: !!el.checked, opts: A.opts });
      if (!r2.ok) { toast(r2.error || 'Could not save'); el.checked = !el.checked; return; }
      A.brevo = r2;
      toast(el.checked ? 'Samora will refresh the Brevo list every night, with these ticks.' : 'Nightly refresh is off.');
      return _g19AudRender();
    }
    if (a === 'push') {
      el.disabled = true; el.textContent = 'Sending…';
      var p = await call('brevo_push', { campaign_ids: _g19AudIds(), opts: A.opts });
      if (!p.ok) { toast(p.error || 'Could not send to Brevo'); el.disabled = false; el.textContent = 'Send to Brevo now'; return; }
      toast('Sent ' + pl(p.sent, 'person', 'people') + ' to Brevo: ' + p.added + ' new, ' + p.removed + ' taken off.');
      return agBrevoLoad();
    }
    if (a === 'disconnect') {
      if (el.getAttribute('data-sure') !== '1') { el.setAttribute('data-sure', '1'); el.textContent = 'Disconnect? Click again'; return; }
      var x = await call('brevo_disconnect', {});
      if (!x.ok) { toast(x.error || 'Could not disconnect'); return; }
      toast('Brevo disconnected. Samora no longer has the key.');
      A.brevo = x; A.blists = []; return _g19AudRender();
    }
  }
})();
