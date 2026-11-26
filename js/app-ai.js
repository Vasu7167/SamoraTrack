// Drop AI (27 Nov 2026): LinkedIn steps that are stuck, why, and one fix for
// each; and everything in their own time: email that lands in their morning,
// LinkedIn in their working day, and calls when they are at their desk.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function call(action, body) { return _sampEdge(action, body || {}); }
  function toast(m) { try { showToast(m); } catch (_e) {} }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function first(n) { return String(n || '').split(' ')[0]; }
  function ini(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function hm(min) { var h = Math.floor(min / 60), m = min % 60, ap = h >= 12 ? 'pm' : 'am', h12 = h % 12 || 12; return h12 + (m ? ':' + String(m).padStart(2, '0') : '') + ' ' + ap; }
  function ago(iso) { var t = Date.parse(iso); if (isNaN(t)) return ''; var h = Math.round((Date.now() - t) / 3600000); return h < 1 ? 'just now' : h < 24 ? h + ' hours ago' : Math.round(h / 24) + ' days ago'; }
  function whenLocal(iso) { var t = new Date(iso); if (isNaN(t)) return ''; return t.toLocaleString('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit' }); }
  var A = function () { return window._ahApi || {}; };
  var I = function (d) { return '<svg class="ah-i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var IC = {
    call: I('<path d="M5 4h3.5l1.8 4.3-2.3 1.5a11 11 0 005.2 5.2l1.5-2.3L19 14.5V18a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"/>'),
    globe: I('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>'),
    tick: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'), retry: I('<path d="M20 11a8 8 0 00-14.6-4.5M4 4v4h4M4 13a8 8 0 0014.6 4.5M20 20v-4h-4"/>'),
    warn: I('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.1"/>'), chrome: I('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 8.8h8M9.2 13.6L5.3 6.8M14.8 13.6l-4 6.9"/>'),
    pen: I('<path d="M4 20h4L19 9l-4-4L4 16z"/>'), chev: I('<path d="M9 6l6 6-6 6"/>'), clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>')
  };
  (function css() {
    if (document.getElementById('aiCss')) return;
    var st = document.createElement('style'); st.id = 'aiCss';
    st.textContent = [
      '.ah-loc{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:5px;margin-top:4px;font-size:11.5px;font-weight:600;color:var(--text3);padding:1px 8px 1px 6px;border-radius:999px;background:var(--surface2)}.ah-loc::before{content:"";width:6px;height:6px;border-radius:50%;background:rgba(127,127,127,.45)}',
      '.ah-loc.on{color:#2E7D4F}.ah-loc.on::before{background:#2E9D5F}.ah-loc.none{font-weight:500;font-style:italic}.ah-loc.none::before{display:none}.ah-loc:hover{color:var(--text)}.ah-loc:focus-visible{outline:2px solid var(--c-accent)}',
      '.ah-their{color:var(--c-accent-text)!important;font-weight:600}',
      // LinkedIn health
      '.ai-hb{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface);margin-bottom:10px;font-size:13px;color:var(--text2)}.ai-hb b{color:var(--text)}.ai-hb > span{flex:1}',
      '.ai-hb.risk{border-color:rgba(var(--ah-mul),.4);background:linear-gradient(150deg,rgba(var(--ah-mul),.08),transparent 70%)}.ai-hb.risk .ah-i{color:var(--ah-mul-t)}',
      '.ai-g{border:1px solid var(--border);border-radius:16px;background:var(--surface);margin-bottom:10px;overflow:hidden}.ai-g.stuck{border-color:rgba(var(--ah-mul),.32)}',
      '.ai-gh{display:flex;gap:12px;align-items:center;padding:14px 16px}.ai-gh .n{min-width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-weight:700;font-variant-numeric:tabular-nums;background:rgba(var(--ah-mul),.12);color:var(--ah-mul-t)}.ai-g:not(.stuck) .ai-gh .n{background:var(--surface2);color:var(--text2)}',
      '.ai-gt{flex:1;min-width:0}.ai-gt b{font-size:14px;color:var(--text)}.ai-gt p{margin:2px 0 0;font-size:12.5px;color:var(--text3);line-height:1.45}',
      '.ai-gx{all:unset;cursor:pointer;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;color:var(--text2);transition:transform .15s}.ai-gx.on{transform:rotate(90deg)}.ai-gx:hover{background:var(--surface2)}.ai-gx:focus-visible{outline:2px solid var(--c-accent)}',
      '.ai-gl{list-style:none;margin:0;padding:0;border-top:1px solid var(--border)}.ai-gl li{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;padding:10px 16px;border-top:1px solid var(--border)}.ai-gl li:first-child{border-top:0}',
      '.ai-gl .w{font-size:12.5px;color:var(--text2)}.ai-gl .q{font-size:12.5px;color:var(--text3);margin-top:3px;white-space:pre-wrap}.ai-gl b{font-size:13.5px;color:var(--text)}',
      '.ai-team{list-style:none;margin:0;padding:0}.ai-team li{display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid var(--border)}.ai-team li:first-child{border-top:0}.ai-team .dot{width:8px;height:8px;border-radius:50%;background:rgba(127,127,127,.4)}.ai-team .dot.on{background:#2E9D5F}',
      // Their time
      '.ai-tl{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px;padding:10px 14px;border-radius:14px;background:linear-gradient(150deg,rgba(var(--c-accent-rgb),.08),rgba(var(--ah-mul),.04));border:1px solid rgba(var(--c-accent-rgb),.25);font-size:13px;color:var(--text2)}.ai-tl b{color:var(--text)}.ai-tl .sp{flex:1}',
      '.ai-zs{display:flex;gap:6px;flex-wrap:wrap}.ai-z{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text2)}.ai-z b{color:var(--text);font-variant-numeric:tabular-nums}.ai-z::before{content:"";width:7px;height:7px;border-radius:50%;background:rgba(127,127,127,.4)}.ai-z.on::before{background:#2E9D5F}',
      // Calls in Today
      '.ai-calls{margin:0 0 12px;border-radius:16px;border:1px solid rgba(var(--c-accent-rgb),.35);background:var(--surface);overflow:hidden}',
      '.ai-ch{display:flex;align-items:center;gap:10px;padding:12px 16px;background:linear-gradient(150deg,rgba(var(--c-accent-rgb),.10),rgba(var(--ah-mul),.05))}.ai-ch b{font-size:14px}.ai-ch small{color:var(--text3);font-size:12px}.ai-ch .sp{flex:1}',
      '.ai-cl{list-style:none;margin:0;padding:0}.ai-cl li{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 16px;border-top:1px solid var(--border)}',
      '.ai-cl .m b{font-size:13.5px;color:var(--text)}.ai-cl .m small{display:block;font-size:12px;color:var(--text3)}.ai-cl .t{font-size:12px;font-weight:650;padding:2px 9px;border-radius:999px;background:rgba(46,107,69,.14);color:#2E7D4F;white-space:nowrap}.ai-cl .t.later{background:var(--surface2);color:var(--text2)}',
      '.ai-ca{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
      '.ai-out{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}.ai-out button{all:unset;cursor:pointer;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid var(--border);font-size:13px;font-weight:600;color:var(--text);text-align:center}.ai-out button.on{border-color:var(--c-accent);background:rgba(var(--c-accent-rgb),.12)}.ai-out button:focus-visible{outline:2px solid var(--c-accent)}',
      '.ai-dlg textarea,.ai-dlg select,.ai-dlg input[type=search]{width:100%;box-sizing:border-box;font:inherit;font-size:13.5px;color:var(--text);border:1px solid var(--c-line-strong);border-radius:12px;padding:8px 10px;background:var(--surface)}',
      '.ai-zl{max-height:300px;overflow:auto;list-style:none;padding:0;margin:8px 0}.ai-zl button{all:unset;cursor:pointer;box-sizing:border-box;width:100%;display:flex;justify-content:space-between;padding:8px 10px;border-radius:10px;font-size:13.5px}.ai-zl button:hover,.ai-zl button:focus-visible{background:var(--surface2)}.ai-zl small{color:var(--text3)}',
      '@media (max-width:640px){.ai-cl li{grid-template-columns:28px minmax(0,1fr)}.ai-ca{grid-column:1/-1;justify-content:flex-start}.ai-out{grid-template-columns:1fr 1fr}}'
    ].join('\n');
    document.head.appendChild(st);
  })();
  function dlg(html) { var D = A().dlg; return D ? D('<div class="ai-dlg">' + html + '</div>') : Promise.resolve(null); }

  // ══ 1. LinkedIn in the Outbox: what is stuck, why, one fix each ═════════
  var AI = window._ai = window._ai || { who: null, open: {}, team: false };
  var FIXLBL = { approve: 'Approving…', requeue: 'Putting back…', rewrite: 'Writing again…', write: 'Writing…' };
  window.aiLiPaint = async function (pg, shell) {
    var H = AI.team ? await call('get_linkedin_health', { scope: 'team' }) : await call('get_linkedin_health', AI.who ? { user_id: AI.who } : {});
    var AHs = window._ah; if (!AHs || AHs.view !== 'outbox' || AHs.obCh !== 'linkedin') return;
    if (!H || !H.ok) { pg.innerHTML = shell(window.ahEmpty('outbox', 'LinkedIn did not load', e((H && H.error) || 'Try again in a moment.'), '<button class="ah-btn gold" type="button" data-ai-reload="1">Try again</button>')); return; }
    AI.h = H;
    if (!AI.team && H.is_me) { AHs.badges.li = H.stuck || 0; }
    pg.innerHTML = shell(AI.team ? teamHtml(H) : healthHtml(H));
  };
  function teamHtml(H) {
    var rows = (H.team || []).map(function (r) {
      return '<li><span class="dot' + (r.online ? ' on' : '') + '" title="' + (r.online ? 'Chrome open' : 'Chrome closed') + '"></span><span class="ah-av" aria-hidden="true">' + e(ini(r.name)) + '</span><div style="flex:1;min-width:0"><b>' + e(r.name) + '</b><small style="display:block;color:var(--text3);font-size:12px">' +
        e(r.stuck ? r.top.map(function (t) { return t.count + ' ' + t.title.toLowerCase(); }).join(' · ') : 'Nothing stuck') + (r.online ? '' : ' · Chrome closed' + (r.last_seen_at ? ', last open ' + ago(r.last_seen_at) : '')) + '</small></div>' +
        (r.stuck ? '<span class="ah-st" style="background:rgba(var(--ah-mul),.14);color:var(--ah-mul-t)">' + r.stuck + ' stuck</span>' : '<span class="ah-st meeting">Fine</span>') + '<button class="ah-btn sm" type="button" data-ai-who="' + e(r.user_id) + '">Open</button></li>';
    }).join('');
    return switchHtml() + (rows ? '<div class="ah-card"><ul class="ai-team">' + rows + '</ul></div>' : window.ahEmpty('outbox', 'Nobody on LinkedIn yet', 'When your team runs LinkedIn steps, each person shows here with anything stuck.', '', true));
  }
  function switchHtml() {
    var H = AI.h || {};
    if (!(H.can_team || AI.team || AI.who)) return '';
    return '<div class="ah-bar"><div class="ah-seg" role="group" aria-label="Whose LinkedIn"><button type="button" class="' + (!AI.team && !AI.who ? 'on' : '') + '" data-ai-scope="me">Mine</button><button type="button" class="' + (AI.team || AI.who ? 'on' : '') + '" data-ai-scope="team">Team</button></div>' + (AI.who && !AI.team ? '<span style="font-size:13px;color:var(--text2)">Viewing <b>' + e(H.name || '') + '</b></span>' : '') + '</div>';
  }
  function healthHtml(H) {
    var me = H.is_me;
    var blk = (H.blockers || []).map(function (b) {
      var btn = b.code === 'offline' || b.code === 'no_plugin' ? (me ? '<button class="ah-btn sm" type="button" data-ai-plugin="1">' + IC.chrome + (b.code === 'no_plugin' ? 'Set it up' : 'How to keep it open') + '</button>' : '') : '';
      return '<div class="ai-hb ' + (b.tone === 'risk' ? 'risk' : '') + '">' + (b.code === 'offline' || b.code === 'no_plugin' ? IC.chrome : b.code === 'hours' ? IC.clock : IC.warn) + '<span><b>' + e(b.title) + '.</b> ' + e(b.text) + '</span>' + btn + '</div>';
    }).join('');
    var hint = AI.zoneHint ? '<div class="ai-hb">' + IC.globe + '<span>' + AI.zoneHint.text + '</span>' + (me && AI.zoneHint.end ? '<button class="ah-btn sm" type="button" data-ai-hours="' + AI.zoneHint.end + '">Stretch to ' + hm(AI.zoneHint.end * 60) + '</button>' : '') + '</div>' : '';
    var stuck = (H.groups || []).filter(function (g) { return g.stuck; });
    var calm = (H.groups || []).filter(function (g) { return !g.stuck; });
    var lead = H.stuck ? '<p class="ah-pulse"><b>' + pl(H.stuck, 'step') + '</b> ' + (H.stuck === 1 ? 'needs' : 'need') + ' ' + (me ? 'you' : first(H.name)) + '. ' + (H.ready ? H.ready + ' more ' + (H.ready === 1 ? 'is' : 'are') + ' ready to go.' : '') + '</p>'
      : '<p class="ah-pulse">' + (H.ready ? '<b>' + H.ready + '</b> ready to go' + (H.online ? ', going now.' : ' once Chrome with Samora is open.') : 'Nothing waiting.') + (H.today ? ' Today: ' + H.today.invites + ' of ' + H.limits.invites + ' invites, ' + H.today.messages + ' messages.' : '') + '</p>';
    var cards = stuck.concat(calm).map(function (g) { return groupHtml(g, me); }).join('');
    var empty = !(H.groups || []).length ? window.ahEmpty('outbox', 'Nothing on LinkedIn right now', 'When a SAMpaign has LinkedIn steps, each one shows here, and anything stuck comes first with its fix.', '', true) : '';
    return switchHtml() + blk + hint + lead + cards + empty;
  }
  function groupHtml(g, me) {
    var open = !!AI.open[g.code];
    var canFix = g.fix && g.fix !== 'open' && (me || g.fix === 'requeue');
    var btn = !g.fix ? '' : g.fix === 'open' ? '<button class="ah-btn sm" type="button" data-ai-open="' + e((g.campaigns[0] || {}).id || '') + '">' + e(g.label) + '</button>'
      : canFix ? '<button class="ah-btn sm ' + (g.stuck ? 'gold' : '') + '" type="button" data-ai-fix="' + e(g.fix) + '" data-ai-group="' + e(g.code) + '">' + (g.fix === 'approve' ? IC.tick : g.fix === 'requeue' ? IC.retry : IC.pen) + e(g.fix === 'approve' ? g.label + ' ' + g.count : g.label) + '</button>'
      : '<small style="color:var(--text3);font-size:12px">' + e(first((AI.h || {}).name)) + ' does this</small>';
    var items = open ? '<ul class="ai-gl">' + (g.items || []).map(function (x) {
      var k = { invite: 'Invite', message: 'Message', followup: 'Follow-up', visit: 'Visit' }[x.kind] || x.kind;
      return '<li><span class="ah-av" aria-hidden="true">' + e(ini(x.name)) + '</span><div><b>' + e(x.name || 'Someone') + '</b> <small style="color:var(--text3)">' + e([x.company, k, x.campaign].filter(Boolean).join(' · ')) + '</small>' +
        (x.why ? '<div class="w">' + e(x.why) + '</div>' : '') + (x.at && g.code === 'later' ? '<div class="w">Due ' + e(whenLocal(x.at)) + '</div>' : '') + (x.body ? '<div class="q">' + e(String(x.body).slice(0, 300)) + '</div>' : '') + '</div></li>';
    }).join('') + (g.count > (g.items || []).length ? '<li style="display:block;color:var(--text3);font-size:12.5px">and ' + (g.count - g.items.length) + ' more</li>' : '') + '</ul>' : '';
    return '<div class="ai-g' + (g.stuck ? ' stuck' : '') + '"><div class="ai-gh"><span class="n">' + g.count + '</span><div class="ai-gt"><b>' + e(g.title) + '</b><p>' + e(g.text) + (g.campaigns && g.campaigns.length ? ' In ' + e(g.campaigns.slice(0, 3).map(function (c) { return c.name; }).join(', ')) + (g.campaigns.length > 3 ? ' and ' + (g.campaigns.length - 3) + ' more' : '') + '.' : '') + '</p></div>' + btn +
      '<button class="ai-gx' + (open ? ' on' : '') + '" type="button" aria-expanded="' + open + '" aria-label="' + (open ? 'Hide' : 'Show') + ' each one" data-ai-toggle="' + e(g.code) + '">' + IC.chev + '</button></div>' + items + '</div>';
  }
  async function liReload() { var api = A(); if (api.obLoad) await api.obLoad(); }
  document.addEventListener('click', async function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-ai-toggle],[data-ai-fix],[data-ai-open],[data-ai-scope],[data-ai-who],[data-ai-reload],[data-ai-plugin],[data-ai-hours]'); if (!t) return;
    var a;
    if ((a = t.getAttribute('data-ai-toggle'))) { AI.open[a] = !AI.open[a]; var pg = A().page && A().page(); if (pg && AI.h) pg.innerHTML = A().obShell(healthHtml(AI.h)); return; }
    if (t.hasAttribute('data-ai-reload')) return liReload();
    if ((a = t.getAttribute('data-ai-scope'))) { AI.team = a === 'team'; AI.who = null; return liReload(); }
    if ((a = t.getAttribute('data-ai-who'))) { AI.team = false; AI.who = a; return liReload(); }
    if ((a = t.getAttribute('data-ai-open'))) { try { openSampaignDetail(a, 'sequence'); } catch (_e) {} return; }
    if (t.hasAttribute('data-ai-plugin')) { try { if (typeof openLinkedInSetup === 'function') return openLinkedInSetup(); } catch (_e) {} toast('Open Chrome, sign in to the Samora plugin, and leave Chrome open. Steps go while it is open.'); return; }
    if ((a = t.getAttribute('data-ai-hours'))) { t.disabled = true; var r0 = await call('set_linkedin_settings', { window_end_hour: Number(a) }); toast(r0.ok ? 'LinkedIn steps now go until ' + hm(Number(a) * 60) + ' your time.' : (r0.error || 'Could not change it')); AI.zoneHint = null; return liReload(); }
    if ((a = t.getAttribute('data-ai-fix'))) {
      var grp = t.getAttribute('data-ai-group');
      if (a === 'approve') {
        var g = ((AI.h || {}).groups || []).find(function (x) { return x.code === grp; }) || { items: [] };
        var list = g.items.slice(0, 8).map(function (x) { return '<li><b>' + e(x.name) + '</b>, ' + e(x.campaign) + '<br><span style="color:var(--text3)">' + e(String(x.body || '').slice(0, 220)) + '</span></li>'; }).join('');
        var go = await dlg('<h3>Approve ' + pl(g.count, 'LinkedIn text') + '?</h3><p>These go from your LinkedIn as written, within your daily limits.' + (g.count > 8 ? ' The first 8 are below; the rest are in the list.' : '') + '</p><ul>' + list + '</ul><div class="ah-da"><button class="ah-btn" type="button" data-v="">Not yet</button><button class="ah-btn gold" type="button" data-v="1">Approve ' + g.count + '</button></div>');
        if (!go) return;
      }
      t.disabled = true; var lbl = t.textContent; t.textContent = FIXLBL[a] || 'Working…';
      var r = await call('fix_linkedin_steps', { fix: a, group: a === 'requeue' ? grp : undefined, user_id: AI.who || undefined });
      t.disabled = false; t.textContent = lbl;
      toast(r.ok ? r.note : (r.error || 'Could not do that'));
      if (r.ok) { var api = A(); if (api.badges) api.badges(); liReload(); }
    }
  });

  // ══ 2. Their time: one line in the Outbox, a zone on every person ═══════
  async function theirLine() {
    var el = document.getElementById('aiTheirLine'); if (!el) return;
    var d = AI.tt || await call('get_their_time', {});
    if (!d || !d.ok) return; AI.tt = d; AI.ttAt = Date.now();
    var zs = (d.zones || []).slice(0, 5).map(function (z) { return '<span class="ai-z' + (z.at_work ? ' on' : '') + '" title="' + e(z.people + ' people') + '">' + e(z.label) + ' <b>' + e(z.clock) + '</b></span>'; }).join('');
    el.innerHTML = '<div class="ai-tl">' + IC.globe + '<span>' + (d.on ? '<b>Sending in their time.</b> Each email lands ' + hm(d.email.start) + ' to ' + hm(d.email.end) + ' where they are' + (d.unknown ? '; ' + d.unknown + ' without a known zone go in your hours' : '') + '.' : '<b>Sending in your hours.</b> Their time is off.') + '</span><span class="sp"></span><span class="ai-zs">' + zs + '</span><button class="ah-btn sm" type="button" data-ai-tt="1">Change</button></div>';
  }
  var obObs = null;
  setInterval(function () {
    var el = document.getElementById('aiTheirLine');
    if (el && !el.children.length) { if (AI.tt && Date.now() - AI.ttAt > 120000) AI.tt = null; theirLine(); }
  }, 600);
  document.addEventListener('click', async function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-ai-tt]'); if (!t) return;
    var d = AI.tt || await call('get_their_time', {});
    var opts = function (sel) { var o = ''; for (var m = 360; m <= 1200; m += 30) o += '<option value="' + m + '"' + (m === sel ? ' selected' : '') + '>' + hm(m) + '</option>'; return o; };
    var v = await dlg('<form><h3>Send in their time</h3><p>Each email lands in this window in the person\'s own time zone, on their working days, never on their holidays. Your mailbox\'s daily limit still holds.</p>' +
      '<label style="display:flex;gap:8px;align-items:center;margin:8px 0;font-size:13.5px"><input type="checkbox" id="aiTtOn"' + (d.on ? ' checked' : '') + '> On</label>' +
      '<div style="display:flex;gap:8px;align-items:center;font-size:13px">From <select id="aiTtS">' + opts(d.email.start) + '</select> to <select id="aiTtE">' + opts(d.email.end) + '</select> their time</div>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin:12px 0 0;font-size:13px;color:var(--text2)"><input type="checkbox" id="aiTtLi"' + (d.li_strict ? ' checked' : '') + '> LinkedIn steps only in their working day (8 am to 6 pm). Off: SAM puts their working day first and still sends the rest.</label>' +
      '<div class="ah-da"><button class="ah-btn ghost" type="button" data-v="">Cancel</button><button class="ah-btn gold" type="button" data-v="__save">Save</button></div></form>');
    if (v !== '__save') return;
  });
  // The dialog removes itself on any data-v click; read the values just before.
  document.addEventListener('click', async function (ev) {
    var b = ev.target.closest && ev.target.closest('.ai-dlg [data-v="__save"]'); if (!b) return;
    var on = (document.getElementById('aiTtOn') || {}).checked, s = Number((document.getElementById('aiTtS') || {}).value), en = Number((document.getElementById('aiTtE') || {}).value), li = (document.getElementById('aiTtLi') || {}).checked;
    var r = await call('set_their_time', { on: !!on, email_start: s, email_end: en, li_strict: !!li });
    if (!r.ok) { toast(r.error || 'Could not save'); return; }
    AI.tt = r; toast(r.on ? 'Saved. New emails land ' + hm(r.email.start) + ' to ' + hm(r.email.end) + ' their time. What is already queued keeps its time.' : 'Saved. New emails go in your own hours.');
    var el = document.getElementById('aiTheirLine'); if (el) { el.innerHTML = ''; theirLine(); }
  }, true);
  // A person's zone: shown on People, changed in two taps.
  var ZONES = [['America/Los_Angeles', 'Los Angeles, Pacific'], ['America/Denver', 'Denver, Mountain'], ['America/Phoenix', 'Phoenix, Arizona'], ['America/Chicago', 'Chicago, Central'], ['America/New_York', 'New York, Eastern'], ['America/Toronto', 'Toronto'], ['America/Vancouver', 'Vancouver'], ['America/Mexico_City', 'Mexico City'], ['America/Sao_Paulo', 'São Paulo'],
    ['Europe/London', 'London'], ['Europe/Dublin', 'Dublin'], ['Europe/Paris', 'Paris'], ['Europe/Berlin', 'Berlin'], ['Europe/Amsterdam', 'Amsterdam'], ['Europe/Madrid', 'Madrid'], ['Europe/Zurich', 'Zurich'], ['Europe/Stockholm', 'Stockholm'], ['Europe/Istanbul', 'Istanbul'],
    ['Asia/Dubai', 'Dubai'], ['Asia/Riyadh', 'Riyadh'], ['Asia/Qatar', 'Doha'], ['Africa/Cairo', 'Cairo'], ['Africa/Johannesburg', 'Johannesburg'], ['Africa/Lagos', 'Lagos'], ['Africa/Nairobi', 'Nairobi'],
    ['Asia/Kolkata', 'India'], ['Asia/Singapore', 'Singapore'], ['Asia/Kuala_Lumpur', 'Kuala Lumpur'], ['Asia/Bangkok', 'Bangkok'], ['Asia/Jakarta', 'Jakarta'], ['Asia/Manila', 'Manila'], ['Asia/Hong_Kong', 'Hong Kong'], ['Asia/Shanghai', 'Shanghai'], ['Asia/Tokyo', 'Tokyo'], ['Asia/Seoul', 'Seoul'],
    ['Australia/Perth', 'Perth'], ['Australia/Brisbane', 'Brisbane'], ['Australia/Sydney', 'Sydney, Melbourne'], ['Pacific/Auckland', 'Auckland'], ['Pacific/Honolulu', 'Honolulu']];
  function clockIn(z) { try { return new Date().toLocaleTimeString('en-US', { timeZone: z, hour: 'numeric', minute: '2-digit' }).toLowerCase(); } catch (_e) { return ''; } }
  document.addEventListener('click', async function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-ai-zone]'); if (!t) return;
    var cid = t.getAttribute('data-ai-zone');
    var list = ZONES.map(function (z) { return '<li><button type="button" data-v="' + e(z[0]) + '"><span>' + e(z[1]) + '</span><small>' + e(clockIn(z[0])) + '</small></button></li>'; }).join('');
    var v = await dlg('<h3>Their time zone</h3><p>SAM uses it for when emails land, when LinkedIn steps go and when to call. Pick where they are.</p><input type="search" placeholder="Search a city" aria-label="Search a city" oninput="var q=this.value.toLowerCase();this.parentNode.querySelectorAll(\'.ai-zl li\').forEach(function(li){li.hidden=q&&li.textContent.toLowerCase().indexOf(q)<0})"><ul class="ai-zl">' + list + '</ul><div class="ah-da"><button class="ah-btn ghost" type="button" data-v="__clear">Let SAM work it out</button><button class="ah-btn" type="button" data-v="">Cancel</button></div>');
    if (!v) return;
    var r = await call('set_person_zone', { contact_id: cid, zone: v === '__clear' ? null : v });
    toast(r.ok ? r.note : (r.error || 'Could not change it'));
    if (r.ok && A().peopleLoad) A().peopleLoad();
  });

  // ══ 3. Today: calls when they are at their desk ═════════════════════════
  var OUT = [['connected', 'Spoke to them'], ['meeting', 'Booked a meeting'], ['no_answer', 'No answer'], ['voicemail', 'Left a voicemail'], ['call_back', 'Call back later'], ['not_interested', 'Not interested'], ['wrong_number', 'Wrong number'], ['busy', 'Line busy']];
  AI.calls = AI.calls || null;
  async function callsLoad() { var d = await call('get_call_list', {}); AI.calls = d && d.ok ? d : { ok: false, items: [] }; AI.callsAt = Date.now(); paintCalls(); }
  function callsHtml() {
    var d = AI.calls; if (!d || !d.ok) return '';
    var withPh = (d.items || []).filter(function (x) { return x.phone && !x.dnc; });
    if (!withPh.length) return '';
    var nowL = withPh.filter(function (x) { return x.now; }), next = withPh.filter(function (x) { return !x.now; }).slice(0, Math.max(0, 4 - Math.min(nowL.length, 5)));
    var show = nowL.slice(0, 5).concat(next);
    var row = function (x) {
      var tag = x.now ? '<span class="t">' + e((x.local && x.local.clock) || '') + ' there · good now</span>' : '<span class="t later">' + (x.next_at ? 'Best ' + e(whenLocal(x.next_at)) + ' your time' : 'Time zone unknown') + '</span>';
      return '<li><span class="ah-av" aria-hidden="true">' + e(ini(x.name)) + '</span><div class="m"><b>' + e(x.name) + '</b><small>' + e([x.title, x.company].filter(Boolean).join(' · ')) + '</small><small>' + e(x.why) + (x.local ? ' · ' + e(x.local.label) : '') + (x.last ? ' · last: ' + e(String(x.last.outcome).replace(/_/g, ' ')) : '') + '</small></div>' +
        '<div class="ai-ca">' + tag + '<a class="ah-btn sm gold" href="tel:' + e(String(x.phone).replace(/[^+\d]/g, '')) + '" data-ai-dial="' + e(x.contact_id) + '">' + IC.call + 'Call</a><button class="ah-btn sm" type="button" data-ai-log="' + e(x.contact_id) + '">Log</button></div></li>';
    };
    return '<section class="ai-calls" aria-label="Calls"><div class="ai-ch">' + IC.call + '<div><b>' + (nowL.length ? pl(nowL.length, 'call') + ' to make now' : 'Calls coming up') + '</b><br><small>When each person is at their desk: 10 am to noon, or 4 to 5:30 pm, their time.' + (d.need_number ? ' ' + d.need_number + ' warm ' + (d.need_number === 1 ? 'person needs' : 'people need') + ' a number.' : '') + '</small></div></div><ul class="ai-cl">' + show.map(row).join('') + '</ul></section>';
  }
  function paintCalls() {
    var feed = document.getElementById('g24Feed'); if (!feed) return;
    var old = document.getElementById('aiCalls'); var html = callsHtml();
    if (!html) { if (old) old.remove(); return; }
    if (!old) { old = document.createElement('div'); old.id = 'aiCalls'; feed.parentNode.insertBefore(old, feed); }
    old.innerHTML = html;
  }
  if (typeof window.g24RenderFeed === 'function' && !window.g24RenderFeed._ai) {
    var baseFeed = window.g24RenderFeed;
    g24RenderFeed = window.g24RenderFeed = function () {
      var r = baseFeed.apply(this, arguments);
      try { if (!AI.calls || Date.now() - (AI.callsAt || 0) > 300000) { if (!AI.callsBusy) { AI.callsBusy = true; callsLoad().finally(function () { AI.callsBusy = false; }); } } else paintCalls(); } catch (_e) {}
      return r;
    };
    window.g24RenderFeed._ai = true;
  }
  async function logCall(cid) {
    var x = ((AI.calls || {}).items || []).find(function (y) { return y.contact_id === cid; }) || { name: 'them' };
    var v = await dlg('<h3>How did the call with ' + e(first(x.name)) + ' go?</h3><div class="ai-out">' + OUT.map(function (o) { return '<button type="button" data-v="' + o[0] + '">' + e(o[1]) + '</button>'; }).join('') + '</div><p style="font-size:12.5px;color:var(--text3)">No answer, voicemail or call back: SAM brings ' + e(first(x.name)) + ' back in their next good hours.</p><div class="ah-da"><button class="ah-btn ghost" type="button" data-v="">Cancel</button></div>');
    if (!v) return;
    var r = await call('log_call', { contact_id: cid, outcome: v });
    toast(r.ok ? r.note : (r.error || 'Could not log it'));
    if (r.ok) callsLoad();
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-ai-log],[data-ai-dial]'); if (!t) return;
    if (t.hasAttribute('data-ai-log')) logCall(t.getAttribute('data-ai-log'));
    else { var cid = t.getAttribute('data-ai-dial'); setTimeout(function () { logCall(cid); }, 1500); }
  });

  // ══ 4. A Call step in the sequence ══════════════════════════════════════
  try { if (typeof SP_SEQ_KIND === 'object') SP_SEQ_KIND.call = 'Call'; } catch (_e) {}
  if (typeof window._spSeqAdd === 'function' && !window._spSeqAdd._ai) {
    var baseAdd = window._spSeqAdd;
    _spSeqAdd = window._spSeqAdd = function (kind) {
      if (kind !== 'call') return baseAdd.apply(this, arguments);
      var S = _spSeqState(); if (!S) return;
      var last = 0; S.steps.forEach(function (s) { if (s.kind !== 'message') last = Math.max(last, Number(s.day) || 1); });
      S.steps.push({ kind: 'call', day: Math.min(60, (last || 0) + 2) }); S.tpl = null; _spSeqRender();
    };
    window._spSeqAdd._ai = true;
  }
  if (typeof window._spSeqRow === 'function' && !window._spSeqRow._ai) {
    var baseRow = window._spSeqRow;
    _spSeqRow = window._spSeqRow = function (S, s, i, pos) {
      if (s.kind !== 'call') return baseRow.apply(this, arguments);
      var date = typeof _spDate === 'function' && typeof _spSeqDateOf === 'function' ? _spDate(_spSeqDateOf(S, s.day)) : '';
      return '<div class="sp-sq sp-sqb"><span class="sp-sn" style="width:40px;height:40px;color:var(--c-accent-text)">' + IC.call + '</span>' +
        '<div><b style="font-size:13.5px">Call</b><div class="sp-sm2">SAM puts it in Today when they are at their desk: 10 am to noon or 4 to 5:30 pm, their time</div></div>' +
        '<label class="sp-dayin sp-seqday"><span class="sp-small">Day</span><input type="number" min="1" max="60" value="' + (Number(s.day) || 1) + '" onchange="_spSeqSet(' + i + ',\'day\',this.value)" aria-label="Working day of the call"></label><span class="sp-small sp-date">' + e(date) + '</span>' +
        '<button class="sp-x" type="button" aria-label="Remove step ' + (pos + 1) + '" onclick="_spSeqDel(' + i + ')">' + (typeof SP_ICON === 'object' && SP_ICON.x ? SP_ICON.x : '×') + '</button></div>';
    };
    window._spSeqRow._ai = true;
  }
  if (typeof window._spSeqHtml === 'function' && !window._spSeqHtml._ai) {
    var baseHtml = window._spSeqHtml;
    _spSeqHtml = window._spSeqHtml = function (S) {
      var h = baseHtml.apply(this, arguments);
      var n = (S.steps || []).filter(function (s) { return s.kind === 'call'; }).length;
      if (n >= 3) return h;
      var btn = '<button class="g-btn sp-sm" type="button" onclick="_spSeqAdd(\'call\')">' + (typeof SP_ICON === 'object' && SP_ICON.plus ? SP_ICON.plus : '+') + ' Call</button>';
      var k = h.indexOf('<div class="sp-acts" style="margin-top:12px">');
      return k < 0 ? h : h.slice(0, k + '<div class="sp-acts" style="margin-top:12px">'.length) + btn + h.slice(k + '<div class="sp-acts" style="margin-top:12px">'.length);
    };
    window._spSeqHtml._ai = true;
  }

  // ══ 5. LinkedIn hours that match where their people are ════════════════
  // If most people's working day falls after the rep's LinkedIn hours end, say
  // so once on the LinkedIn view, with a one-tap stretch.
  var baseLi = window.aiLiPaint;
  window.aiLiPaint = async function (pg, shell) {
    try {
      if (!AI.tt) AI.tt = await call('get_their_time', {});
      var H0 = AI.h, d = AI.tt;
      AI.zoneHint = null;
      if (d && d.ok && d.zones && d.zones.length) {
        var top = d.zones[0], share = top.people / Math.max(1, d.known || 1);
        var from = top.their_day_in_mine && top.their_day_in_mine.from;
        if (share >= 0.4 && from != null && from >= 15 * 60) {
          var end = Math.min(23, Math.ceil(from / 60) + 3);
          AI.zoneHint = { text: '<b>Most of your people are in ' + e(top.label) + '.</b> Their working day starts at ' + hm(from) + ' your time, so steps that go in your daytime land at night for them.', end: end };
        }
      }
      void H0;
    } catch (_e) {}
    return baseLi(pg, shell);
  };

  window._aiReady = true;
})();
