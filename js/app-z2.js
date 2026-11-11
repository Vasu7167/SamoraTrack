// SamoraOS app: Drop Z2 (11 Nov 2026).
//   1. The send plan you can change: how many go each day, who goes first,
//      and which day a company goes on. The mailbox's earned pace is shown on
//      every day, and going above it is asked for, never silent.
//   2. Notifications: a bell on every screen with what happened in your
//      SAMpaigns (replies, meetings, deals, problems, roundups), and what
//      reaches your phone and how often.
//   3. SAM-TAM says what it understood before it searches, and after it, what
//      it left out and why, and why each company fits.
// Loaded after app-z1.js.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function call(action, body) { return _sampEdge(action, body || {}); }
  function toast(m) { try { showToast(m); } catch (_e) {} }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function ago(iso) { var m = Math.floor((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : Math.floor(m / 1440) === 1 ? 'yesterday' : Math.floor(m / 1440) + ' days ago'; }
  var IC = {
    bell: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 004 0"/></svg>',
    gear: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
    x: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    reply: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>',
    li: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5.3 8.5h3v10h-3zM6.8 4a1.7 1.7 0 110 3.5 1.7 1.7 0 010-3.5zM10.5 8.5h2.9v1.4c.4-.8 1.4-1.6 2.9-1.6 3.1 0 3.7 2 3.7 4.7v5.5h-3v-4.9c0-1.2 0-2.6-1.6-2.6s-1.9 1.2-1.9 2.5v5h-3z"/></svg>',
    meet: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    deal: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17l5-5 4 4 7-8"/><path d="M15 8h5v5"/></svg>',
    warn: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.2"/></svg>',
    sum: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
    ok: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4L19 7"/></svg>',
    minus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>',
    down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>'
  };

  (function css() {
    if (document.getElementById('z2Css')) return;
    var st = document.createElement('style'); st.id = 'z2Css';
    st.textContent = [
      // Bell
      '.z2-bell{position:fixed;top:14px;right:16px;z-index:9300;width:42px;height:42px;border-radius:50%;border:1px solid var(--border);background:var(--surface,var(--bg));color:var(--text);display:none;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 22px -8px rgba(0,0,0,.35);transition:transform .15s ease}',
      '.z2-bell.on{display:flex}.z2-bell:hover{transform:translateY(-1px)}.z2-bell:focus-visible{outline:2px solid rgba(var(--c-accent-rgb),.8);outline-offset:2px}',
      // In the desktop rail, next to the name: never over a page's own controls.
      '.z2-bell.in-rail{position:relative;top:auto;right:auto;margin-left:auto;width:34px;height:34px;box-shadow:none;border-color:transparent;background:transparent}.z2-bell.in-rail:hover{background:rgba(var(--c-accent-rgb),.12);transform:none}',
      '.z2-bp.from-rail{top:14px;left:calc(var(--z2-rail,232px) + 10px);right:auto}',
      '.z2-bell b{position:absolute;top:-3px;right:-3px;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:linear-gradient(135deg,#B8860B,#E8B84B);color:#1c1408;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid var(--bg)}',
      '.z2-bp{position:fixed;top:64px;right:16px;z-index:9310;width:min(400px,calc(100vw - 32px));max-height:min(620px,calc(100vh - 90px));display:flex;flex-direction:column;background:var(--surface,var(--bg));color:var(--text);border:1px solid var(--border);border-radius:18px;box-shadow:0 30px 70px -20px rgba(0,0,0,.45);overflow:hidden;animation:z2In .16s ease}',
      '@keyframes z2In{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}',
      '.z2-bph{display:flex;align-items:center;gap:8px;padding:14px 14px 12px 18px;border-bottom:1px solid var(--border)}.z2-bph h3{margin:0;font-size:15.5px;flex:1}',
      '.z2-ib{width:32px;height:32px;border-radius:10px;border:0;background:transparent;color:inherit;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.z2-ib:hover,.z2-ib.on{background:rgba(var(--c-accent-rgb),.14)}',
      '.z2-bl{overflow:auto;flex:1}.z2-bl ul{list-style:none;margin:0;padding:6px}',
      '.z2-it{display:flex;gap:11px;padding:11px 12px;border-radius:12px;cursor:pointer;align-items:flex-start}.z2-it:hover{background:rgba(127,127,127,.08)}',
      '.z2-it .i{flex:none;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(127,127,127,.12);color:var(--text-muted,inherit)}',
      '.z2-it.good .i{background:rgba(var(--c-accent-rgb),.18);color:var(--c-accent-text)}.z2-it.risk .i{background:rgba(214,84,64,.16);color:#d65440}',
      '.z2-it .t{font-size:13.5px;font-weight:600;line-height:1.35}.z2-it .b{font-size:12.5px;line-height:1.45;color:var(--text-muted,inherit);margin-top:2px}.z2-it .w{font-size:11.5px;opacity:.7;margin-top:4px}',
      '.z2-it.new .t:after{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:#E8B84B;margin-left:7px;vertical-align:2px}',
      '.z2-em{padding:34px 22px;text-align:center;font-size:13.5px;color:var(--text-muted,inherit);line-height:1.55}',
      '.z2-set{padding:6px 18px 18px;overflow:auto}.z2-set h4{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;margin:16px 0 8px;color:var(--text-muted,inherit)}',
      '.z2-tg{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:13.5px;cursor:pointer}.z2-tg>span:first-child{flex:1;min-width:0}.z2-tg small{display:block;font-size:12px;color:var(--text-muted,inherit)}',
      '.z2-sw{position:relative;display:inline-block;width:38px;height:22px;flex:none}.z2-sw input{opacity:0;width:0;height:0;position:absolute}.z2-sw i{position:absolute;inset:0;border-radius:999px;background:rgba(127,127,127,.3);transition:.15s}',
      '.z2-sw i:after{content:"";position:absolute;width:16px;height:16px;left:3px;top:3px;border-radius:50%;background:#fff;transition:.15s}.z2-sw input:checked+i{background:linear-gradient(135deg,#B8860B,#E8B84B)}.z2-sw input:checked+i:after{left:19px}.z2-sw input:focus-visible+i{outline:2px solid rgba(var(--c-accent-rgb),.8);outline-offset:2px}',
      '.z2-seg{display:flex;flex-wrap:wrap;gap:6px}.z2-seg button{border:1px solid var(--border);background:transparent;color:inherit;border-radius:999px;padding:7px 12px;font:inherit;font-size:12.5px;cursor:pointer}.z2-seg button.on{background:rgba(var(--c-accent-rgb),.16);border-color:rgba(var(--c-accent-rgb),.7);font-weight:600}',
      '.z2-push{display:flex;gap:10px;align-items:center;padding:11px 12px;border-radius:12px;background:rgba(var(--c-accent-rgb),.08);font-size:13px;line-height:1.45}.z2-push span{flex:1}',
      '.z2-lnk{background:none;border:0;padding:0;font:inherit;color:var(--c-accent-text);text-decoration:underline;text-underline-offset:3px;cursor:pointer}',
      // Send plan
      '.z2-pl{max-width:640px!important}',
      '.z2-pl h3{margin:0 0 4px}.z2-sub{font-size:13.5px;color:var(--text-muted,inherit);line-height:1.5}',
      '.z2-lbl{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted,inherit);margin:16px 0 8px}',
      '.z2-dl{display:flex;flex-direction:column;gap:8px}',
      '.z2-d{border:1px solid var(--border);border-radius:14px;padding:10px 12px}.z2-d.over{border-color:rgba(214,140,40,.7);background:rgba(214,140,40,.06)}',
      '.z2-dr{display:flex;align-items:center;gap:10px}.z2-dn{flex:1;min-width:0}.z2-dn b{font-size:14px}.z2-dn small{display:block;font-size:12px;color:var(--text-muted,inherit);margin-top:2px}',
      '.z2-st{display:flex;align-items:center;border:1px solid var(--border);border-radius:10px;overflow:hidden}.z2-st button{width:32px;height:32px;border:0;background:transparent;color:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center}.z2-st button:hover{background:rgba(127,127,127,.1)}',
      '.z2-st input{width:46px;height:32px;border:0;border-left:1px solid var(--border);border-right:1px solid var(--border);background:transparent;color:inherit;text-align:center;font:inherit;font-weight:700;font-size:14px;-moz-appearance:textfield}.z2-st input::-webkit-inner-spin-button{display:none}',
      '.z2-bar{height:5px;border-radius:999px;background:rgba(127,127,127,.15);margin-top:9px;position:relative;overflow:hidden}.z2-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,#B8860B,#E8B84B)}.z2-d.over .z2-bar i{background:#d68c28}',
      '.z2-tog{background:none;border:0;padding:6px 0 0;font:inherit;font-size:12.5px;color:var(--c-accent-text);cursor:pointer;display:inline-flex;align-items:center;gap:4px}',
      '.z2-cos{margin-top:8px;display:flex;flex-direction:column;gap:6px}.z2-co{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:7px 9px;border-radius:10px;background:rgba(127,127,127,.06)}.z2-co span{flex:1;min-width:0}.z2-co small{color:var(--text-muted,inherit)}',
      '.z2-co select{font:inherit;font-size:12px;padding:4px 6px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:inherit;max-width:150px}',
      '.z2-add{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px}.z2-add select{font:inherit;font-size:13px;padding:6px 8px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:inherit}',
      '.z2-note{font-size:12.5px;line-height:1.5;padding:9px 11px;border-radius:10px;background:rgba(127,127,127,.07);margin-top:10px}.z2-note.warn{background:rgba(214,140,40,.1)}',
      '.z2-ack{display:flex;gap:9px;align-items:flex-start;font-size:13px;margin-top:10px;line-height:1.45;cursor:pointer}',
      '.z2-busy{opacity:.55;pointer-events:none;transition:opacity .15s}',
      // SAM-TAM
      '.z2-br{margin-top:10px;font-size:12.5px;color:var(--text-muted,inherit);display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '.z2-br .c{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;background:rgba(var(--c-accent-rgb),.12);color:var(--text);font-size:12.5px}.z2-br .c.not{background:rgba(214,84,64,.12)}',
      '.z2-br .u{flex-basis:100%;font-size:12px;margin-top:2px}.z2-br .v{flex-basis:100%;color:#d68c28}',
      '.z2-why{display:block;font-size:12.5px;line-height:1.5;margin-top:5px;color:var(--text)}.z2-why b{font-weight:600}.z2-why em{font-style:normal;color:var(--text-muted,inherit)}',
      '.z2-tn{padding:12px 16px;font-size:13px;line-height:1.55;border-top:1px solid var(--border)}.z2-tn details{margin-top:4px}.z2-tn summary{cursor:pointer;color:var(--c-accent-text);font-size:12.5px}.z2-tn ul{margin:6px 0 0 18px;padding:0;font-size:12.5px;color:var(--text-muted,inherit)}',
      '@media (max-width:640px){.z2-bell{top:10px;right:12px;width:38px;height:38px}.z2-bp{top:56px;right:12px;left:12px;width:auto}.z2-dr{flex-wrap:wrap}.z2-co{flex-wrap:wrap}.z2-co select{max-width:none;width:100%}}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  // ═══ 1. Notifications ══════════════════════════════════════════════════════
  var N = window._z2N = window._z2N || { items: [], unread: 0, prefs: null, open: false, view: 'list', t: null, devices: 0, times: null, loaded: false };
  function signedIn() { try { return !!(currentUser && currentUser.token); } catch (_e) { return false; } }
  function bellEl() {
    var b = document.getElementById('z2Bell');
    if (!b) {
      b = document.createElement('button'); b.id = 'z2Bell'; b.type = 'button'; b.className = 'z2-bell';
      b.setAttribute('aria-label', 'Notifications'); b.setAttribute('aria-haspopup', 'dialog');
      b.onclick = function (ev) { ev.stopPropagation(); N.open ? z2BellClose() : z2BellOpen(); };
      document.body.appendChild(b);
    }
    return b;
  }
  // Desktop: the bell sits in the left rail by the name. Phone: top right.
  function place() {
    var b = bellEl(), rail = document.querySelector('.rail-brand');
    var inRail = !!(rail && getComputedStyle(rail).display !== 'none' && rail.getBoundingClientRect().width > 0);
    if (inRail && b.parentNode !== rail) { rail.appendChild(b); b.classList.add('in-rail'); }
    else if (!inRail && b.parentNode !== document.body) { document.body.appendChild(b); b.classList.remove('in-rail'); }
    if (inRail) { var nav = rail.closest('.bottom-nav'); if (nav) document.documentElement.style.setProperty('--z2-rail', Math.round(nav.getBoundingClientRect().right) + 'px'); }
    return inRail;
  }
  window.addEventListener('resize', function () { place(); if (N.open) z2BellClose(); });
  function paintBell() {
    var b = bellEl(); place();
    b.classList.toggle('on', signedIn());
    b.innerHTML = IC.bell + (N.unread ? '<b>' + (N.unread > 9 ? '9+' : N.unread) + '</b>' : '');
    b.setAttribute('aria-label', N.unread ? 'Notifications, ' + N.unread + ' new' : 'Notifications');
  }
  async function load() {
    if (!signedIn()) { paintBell(); return; }
    try {
      var d = await call('get_notifications', {});
      if (d && d.ok) { N.items = d.items || []; N.unread = d.unread || 0; N.prefs = d.prefs; N.devices = d.devices || 0; N.times = d.roundup_times || null; N.pushReady = d.push_ready; N.seen = d.seen_at; N.loaded = true; }
    } catch (_e) {}
    paintBell(); if (N.open) paintPanel();
  }
  window.z2NotifLoad = load;
  function iconFor(k) { return k === 'reply' ? IC.reply : k === 'li_reply' || k === 'accept' ? IC.li : k === 'meeting' ? IC.meet : k === 'deal' ? IC.deal : k === 'problem' ? IC.warn : k === 'roundup' ? IC.sum : IC.bell; }
  function route(url) {
    var q; try { q = new URL(url, location.origin).searchParams; } catch (_e) { return; }
    z2BellClose();
    var sid = q.get('sampaign');
    if (sid) { try { switchTab('sampaign'); setTimeout(function () { openSampaignDetail(sid, q.get('tab') || 'overview'); }, 350); } catch (_e) {} return; }
    try { switchTab('today'); } catch (_e) {}
  }
  window.z2NotifGo = function (i) { var it = N.items[i]; if (it) route(it.url || '/?open=replies'); };
  function paintPanel() {
    var p = document.getElementById('z2BellP'); if (!p) return;
    var seen = N.seenBefore ? Date.parse(N.seenBefore) : 0;
    var head = '<div class="z2-bph"><h3 id="z2BellT">' + (N.view === 'set' ? 'What reaches you' : 'Notifications') + '</h3>' +
      '<button type="button" class="z2-ib' + (N.view === 'set' ? ' on' : '') + '" aria-label="Notification settings" aria-pressed="' + (N.view === 'set') + '" onclick="z2BellView(\'' + (N.view === 'set' ? 'list' : 'set') + '\')">' + IC.gear + '</button>' +
      '<button type="button" class="z2-ib" aria-label="Close" onclick="z2BellClose()">' + IC.x + '</button></div>';
    if (N.view === 'set') { p.innerHTML = head + '<div class="z2-set">' + setHtml() + '</div>'; return; }
    var list = !N.loaded ? '<div class="z2-em">Loading…</div>' : !N.items.length
      ? '<div class="z2-em">Nothing yet. Replies, meetings booked, deals SAM moves and your SAMpaign roundups land here.' + (N.devices ? '' : '<div style="margin-top:12px"><button type="button" class="z2-lnk" onclick="z2BellView(\'set\')">Get them on your phone too</button></div>') + '</div>'
      : '<ul>' + N.items.map(function (it, i) {
          var fresh = Date.parse(it.at) > seen;
          return '<li class="z2-it' + (it.tone ? ' ' + e(it.tone) : '') + (fresh ? ' new' : '') + '" role="button" tabindex="0" onclick="z2NotifGo(' + i + ')" onkeydown="if(event.key===\'Enter\')z2NotifGo(' + i + ')"><span class="i">' + iconFor(it.kind) + '</span><span><div class="t">' + e(it.title) + '</div>' + (it.body ? '<div class="b">' + e(it.body) + '</div>' : '') + '<div class="w">' + e(ago(it.at)) + '</div></span></li>';
        }).join('') + '</ul>';
    p.innerHTML = head + (N.loaded && !N.devices && N.items.length ? '<div style="padding:10px 14px 0"><div class="z2-push"><span>These reach your phone only once push is on for it.</span><button type="button" class="z2-lnk" onclick="z2BellView(\'set\')">Turn on</button></div></div>' : '') + '<div class="z2-bl">' + list + '</div>';
  }
  function tg(key, label, sub) {
    var on = !N.prefs || N.prefs[key] !== false;
    return '<label class="z2-tg"><span>' + e(label) + (sub ? '<small>' + e(sub) + '</small>' : '') + '</span><span class="z2-sw"><input type="checkbox" ' + (on ? 'checked ' : '') + 'onchange="z2Pref(\'' + key + '\',this.checked)"><i></i></span></label>';
  }
  function setHtml() {
    var pr = N.prefs || {}, t = N.times || {};
    var perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    var pushLine = !N.pushReady ? 'Phone notifications are not set up for SamoraOS yet. Everything still lands in this bell.'
      : perm === 'unsupported' ? 'This browser cannot show notifications. Everything still lands in this bell.'
      : perm === 'denied' ? 'Notifications are blocked for SamoraOS in this browser. Allow them in the browser settings to get them here.'
      : N.devices ? 'On for ' + pl(N.devices, 'device') + '. Add your phone by opening SamoraOS there and turning it on.'
      : 'Not on for this device yet.';
    var canOn = N.pushReady && perm !== 'denied' && perm !== 'unsupported';
    var hh = function (h) { return h == null ? '' : (h < 10 ? '0' : '') + h + ':00'; };
    var R = [['off', 'Off'], ['eod', 'End of day'], ['both', 'Midday and end of day'], ['every2h', 'Every 2 hours']];
    return '<div class="z2-push" style="margin-top:12px"><span>' + e(pushLine) + '</span>' + (canOn ? '<button type="button" class="g-btn sp-sm sp-gold" onclick="z2PushOn()">' + (N.devices ? 'Add this device' : 'Turn on') + '</button>' : '') + '</div>' +
      '<h4>Tell me at once</h4>' + tg('reply', 'Email replies', 'Who replied, and the first words') + tg('li_reply', 'LinkedIn replies') + tg('meeting', 'Meetings booked') + tg('deal', 'Deals SAM adds or moves', 'Each one with Undo in Today') + tg('problem', 'Problems', 'Sending paused for bounces, a mailbox to reconnect') + tg('accept', 'Invites accepted', 'Off by default: they can be many') +
      '<h4>SAMpaign roundup</h4><div class="z2-seg" role="radiogroup" aria-label="How often">' + R.map(function (r) { return '<button type="button" role="radio" aria-checked="' + (pr.roundup === r[0]) + '" class="' + (pr.roundup === r[0] ? 'on' : '') + '" onclick="z2Pref(\'roundup\',\'' + r[0] + '\')">' + r[1] + '</button>'; }).join('') + '</div>' +
      '<div class="sp-small" style="margin-top:8px;line-height:1.5">' + (pr.roundup === 'off' ? 'No roundups. Replies and problems still come at once.' : pr.roundup === 'every2h' ? 'Every 2 hours in your working day, and nothing when nothing happened.' : (pr.roundup === 'both' ? 'At ' + hh(t.midday) + ' and ' + hh(t.eod) : 'At ' + hh(t.eod)) + (t.timezone ? ' (' + e(t.timezone) + ')' : '') + ', on working days: sent, replies, accepted, what waits for you, what goes tomorrow. Nothing is sent when nothing happened.') + '</div>' +
      '<div style="margin-top:12px"><button type="button" class="z2-lnk" onclick="z2RoundupNow(this)">Show me today’s roundup now</button></div><div id="z2RNow"></div>' +
      '<div class="sp-small" style="margin-top:16px;line-height:1.5">Inside your organisation’s quiet hours nothing buzzes; it waits here.</div>';
  }
  window.z2BellView = function (v) { N.view = v; paintPanel(); };
  window.z2Pref = async function (k, v) {
    N.prefs = Object.assign({}, N.prefs || {}); N.prefs[k] = v; paintPanel();
    var b = {}; b[k] = v;
    var d = await call('save_notification_prefs', { prefs: b });
    if (d && d.ok) { N.prefs = d.prefs; paintPanel(); } else toast((d && d.error) || 'Could not save that');
  };
  window.z2PushOn = async function () {
    try { if (typeof enablePushNotifications === 'function') await enablePushNotifications(); } catch (_e) {}
    await load(); if (N.open) paintPanel();
  };
  window.z2RoundupNow = async function (btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Reading today…'; }
    var d = await call('run_sampaign_roundup', { preview: true });
    var host = document.getElementById('z2RNow'); if (btn) { btn.disabled = false; btn.textContent = 'Show me today’s roundup now'; }
    if (!host) return;
    host.innerHTML = d && d.ok ? '<div class="z2-note"><b>' + e(d.preview ? d.preview.title : 'Nothing to say yet') + '</b><br>' + e(d.preview ? d.preview.body : d.note) + '</div>' : '<div class="z2-note warn">' + e((d && d.error) || 'Could not read today') + '</div>';
  };
  window.z2BellOpen = async function () {
    if (!signedIn()) return;
    z2BellClose();
    N.open = true; N.view = 'list'; N.seenBefore = N.seen || null;
    var p = document.createElement('div'); p.id = 'z2BellP'; p.className = 'z2-bp' + (place() ? ' from-rail' : ''); p.setAttribute('role', 'dialog'); p.setAttribute('aria-labelledby', 'z2BellT');
    p.addEventListener('click', function (ev) { ev.stopPropagation(); });
    document.body.appendChild(p); paintPanel();
    bellEl().setAttribute('aria-expanded', 'true');
    await load();
    if (N.unread) { N.unread = 0; paintBell(); call('mark_notifications_read', {}).then(function (d) { if (d && d.ok) N.seen = new Date().toISOString(); }).catch(function () {}); }
  };
  window.z2BellClose = function () {
    var p = document.getElementById('z2BellP'); if (p) p.remove();
    N.open = false; var b = document.getElementById('z2Bell'); if (b) b.setAttribute('aria-expanded', 'false');
  };
  document.addEventListener('click', function () { if (N.open) z2BellClose(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && N.open) { z2BellClose(); try { bellEl().focus(); } catch (_e) {} } });
  function tick() { if (document.visibilityState === 'visible') load(); }
  (function start() {
    paintBell();
    if (typeof launchApp === 'function' && !launchApp._z2) {
      var base = launchApp;
      launchApp = function () { var r = base.apply(this, arguments); setTimeout(load, 1200); return r; };
      launchApp._z2 = true;
    }
    if (N.t) clearInterval(N.t);
    N.t = setInterval(tick, 90000);
    document.addEventListener('visibilitychange', tick);
    setTimeout(load, 1500);
  })();

  // ═══ 2. The send plan you can change ═══════════════════════════════════════
  var SP = null;
  function planBody() {
    var b = { campaign_id: SP.cid, start_at: SP.startAt || null, launch: SP.launch };
    if (SP.order && SP.order !== 'listed') b.order = SP.order;
    if (Object.keys(SP.perDay).length) b.per_day = SP.perDay;
    if (Object.keys(SP.coDays).length) b.company_days = SP.coDays;
    return b;
  }
  async function planFetch() {
    var card = document.querySelector('#z2Plan .sp-mcard'); if (card) card.classList.add('z2-busy');
    var my = SP.seq = (SP.seq || 0) + 1;
    var d = await call('schedule_sampaign_drafts', Object.assign(planBody(), { dry_run: true }));
    if (!SP || my !== SP.seq) return;
    if (card) card.classList.remove('z2-busy');
    if (!d.ok) { SP.err = d.error || 'Could not plan this'; if (!SP.d) { closePlan(); toast(SP.err); return; } }
    else { SP.err = null; SP.d = d; }
    paintPlan();
  }
  function closePlan() { var m = document.getElementById('z2Plan'); if (m) m.remove(); SP = null; document.removeEventListener('keydown', planEsc); }
  function planEsc(ev) { if (ev.key === 'Escape') closePlan(); }
  window.planSampaignDrafts = async function (campaignId, startAt, launch) {
    closePlan();
    SP = { cid: campaignId, startAt: startAt || null, launch: launch || window._sampLaunch || 1, order: 'listed', perDay: {}, coDays: {}, open: {}, ack: false, d: null };
    var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'z2Plan';
    m.addEventListener('click', function (ev) { if (ev.target === m) closePlan(); });
    m.innerHTML = '<div class="sp-mcard z2-pl" role="dialog" aria-modal="true" aria-labelledby="z2PlT"><h3 id="z2PlT">Planning…</h3><div class="z2-sub">SAM is working out the days.</div></div>';
    document.body.appendChild(m);
    document.addEventListener('keydown', planEsc);
    await planFetch();
  };
  window.z2PlanClose = closePlan;
  function setCounts(mut) {
    // Every day on screen becomes the rep's own number once they change one.
    var days = (SP.d && SP.d.days) || [], pd = {};
    if (Object.keys(SP.perDay).length) Object.keys(SP.perDay).forEach(function (k) { pd[k] = SP.perDay[k]; });
    else days.forEach(function (x) { pd[x.date] = x.count; });
    mut(pd);
    Object.keys(pd).forEach(function (k) { if (!(pd[k] > 0)) delete pd[k]; });
    SP.perDay = pd; SP.ack = false;
    // Shown at once; SAM's re-plan follows a moment later.
    days.forEach(function (x) { if (x.date in pd) { x.count = pd[x.date]; x.above_safe = x.used + x.count > x.safe; } });
    clearTimeout(SP.t); SP.t = setTimeout(planFetch, 280);
    paintPlan(true);
  }
  window.z2PlanStep = function (day, by) { setCounts(function (pd) { pd[day] = Math.max(0, Math.min(50, (pd[day] || 0) + by)); }); };
  window.z2PlanSet = function (day, v) { setCounts(function (pd) { pd[day] = Math.max(0, Math.min(50, parseInt(v, 10) || 0)); }); };
  window.z2PlanAdd = function (day) { if (!day) return; setCounts(function (pd) { var room = ((SP.d.calendar || []).find(function (c) { return c.date === day; }) || {}).room || 5; pd[day] = Math.max(1, Math.min(room || 5, 10)); }); };
  window.z2PlanOrder = function (o) { SP.order = o; SP.ack = false; planFetch(); };
  window.z2PlanMove = function (key, day) { if (day) SP.coDays[key] = day; else delete SP.coDays[key]; SP.ack = false; planFetch(); };
  window.z2PlanOpen = function (day) { SP.open[day] = !SP.open[day]; paintPlan(); };
  window.z2PlanAck = function (v) { SP.ack = !!v; paintPlan(); };
  window.z2PlanReset = function () { SP.perDay = {}; SP.coDays = {}; SP.order = 'listed'; SP.ack = false; planFetch(); };
  function paintPlan(soft) {
    var m = document.getElementById('z2Plan'); if (!m || !SP || !SP.d) return;
    var d = SP.d, days = d.days || [], cal = d.calendar || [];
    var total = days.reduce(function (s, x) { return s + x.count; }, 0);
    var over = days.filter(function (x) { return x.above_safe; });
    var custom = Object.keys(SP.perDay).length || Object.keys(SP.coDays).length || SP.order !== 'listed';
    var ord = [['listed', 'As written'], ['spread', 'Spread companies'], ['fit', 'Best fit first']];
    var dayOpts = function (sel) { return '<option value="">Day SAM picks</option>' + cal.map(function (c) { return '<option value="' + c.date + '"' + (sel === c.date ? ' selected' : '') + '>' + e(c.label) + '</option>'; }).join(''); };
    var dayHtml = days.map(function (x) {
      var pct = Math.min(100, Math.round((x.used + x.count) / Math.max(1, x.safe) * 100));
      var cos = {}; x.people.forEach(function (p) { (cos[p.key] = cos[p.key] || { name: p.company, key: p.key, n: 0, names: [] }).n++; cos[p.key].names.push(p.name); });
      var coList = Object.keys(cos).map(function (k) { return cos[k]; });
      return '<div class="z2-d' + (x.above_safe ? ' over' : '') + '"><div class="z2-dr"><div class="z2-dn"><b>' + e(x.label) + '</b><small>' + (x.used ? x.used + ' already go that day. ' : '') + 'This mailbox has earned ' + x.safe + ' a day' + (x.above_safe ? ', so this is above it' : '') + '</small></div>' +
        '<div class="z2-st" role="group" aria-label="Emails on ' + e(x.label) + '"><button type="button" aria-label="One fewer" onclick="z2PlanStep(\'' + x.date + '\',-1)">' + IC.minus + '</button><input type="number" min="0" max="50" inputmode="numeric" value="' + x.count + '" aria-label="Emails on ' + e(x.label) + '" onchange="z2PlanSet(\'' + x.date + '\',this.value)"><button type="button" aria-label="One more" onclick="z2PlanStep(\'' + x.date + '\',1)">' + IC.plus + '</button></div></div>' +
        '<div class="z2-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
        '<button type="button" class="z2-tog" aria-expanded="' + !!SP.open[x.date] + '" onclick="z2PlanOpen(\'' + x.date + '\')">' + IC.down + pl(coList.length, 'company', 'companies') + ', ' + pl(x.count, 'person', 'people') + '</button>' +
        (SP.open[x.date] ? '<div class="z2-cos">' + coList.map(function (c) { return '<div class="z2-co"><span><b>' + e(c.name) + '</b> <small>' + e(c.names.slice(0, 3).join(', ') + (c.names.length > 3 ? ' and ' + (c.names.length - 3) + ' more' : '')) + '</small></span><select aria-label="Day for ' + e(c.name) + '" onchange="z2PlanMove(\'' + e(c.key) + '\',this.value)">' + dayOpts(SP.coDays[c.key] || '') + '</select></div>'; }).join('') + '</div>' : '') +
        '</div>';
    }).join('');
    var free = cal.filter(function (c) { return !days.some(function (x) { return x.date === c.date; }); });
    var notes = '';
    if (d.order_note) notes += '<div class="z2-note">' + e(d.order_note) + '</div>';
    if (d.auto_tail) notes += '<div class="z2-note">' + pl(d.auto_tail, 'email was', 'emails were') + ' left over, so SAM put ' + (d.auto_tail === 1 ? 'it' : 'them') + ' on the next working days at the pace the mailbox has earned.</div>';
    if (SP.err) notes += '<div class="z2-note warn">' + e(SP.err) + '</div>';
    if (over.length) notes += '<label class="z2-ack"><input type="checkbox" ' + (SP.ack ? 'checked ' : '') + 'onchange="z2PlanAck(this.checked)"><span>' + e(over.map(function (x) { return x.label; }).join(', ')) + (over.length === 1 ? ' is' : ' are') + ' above what this mailbox has earned. Sending faster than that is how email lands in spam and the mailbox gets paused. <b>Send it anyway.</b></span></label>';
    var card = m.querySelector('.sp-mcard'); var keepScroll = card ? card.scrollTop : 0;
    card.innerHTML = '<h3 id="z2PlT">Schedule ' + pl(total, 'email') + '</h3>' +
      '<div class="z2-sub">' + e(_spWave(SP.launch)) + ' over ' + pl(days.length, 'day') + (days.length ? ', ' + e(days[0].label) + (days.length > 1 ? ' to ' + e(days[days.length - 1].label) : '') : '') + '. ' + (d.policy ? 'Sending between ' + d.policy.window_start_hour + ':00 and ' + d.policy.window_end_hour + ':00' + (d.policy.skip_weekends ? ' on working days' : '') + ', a few minutes apart.' : '') + '</div>' +
      '<div class="z2-lbl">Who goes first</div><div class="z2-seg" role="radiogroup" aria-label="Who goes first">' + ord.map(function (o) { return '<button type="button" role="radio" aria-checked="' + (SP.order === o[0]) + '" class="' + (SP.order === o[0] ? 'on' : '') + '" onclick="z2PlanOrder(\'' + o[0] + '\')">' + o[1] + '</button>'; }).join('') + '</div>' +
      '<div class="z2-lbl">How many each day</div><div class="z2-dl">' + dayHtml + '</div>' +
      (free.length ? '<div class="z2-add"><span>Add a day</span><select aria-label="Add a day" onchange="z2PlanAdd(this.value)"><option value="">Pick a day</option>' + free.map(function (c) { return '<option value="' + c.date + '">' + e(c.label) + ' (room for ' + c.room + ')</option>'; }).join('') + '</select></div>' : '') +
      notes +
      '<div class="sp-foot">' + (custom ? '<button class="g-btn" type="button" onclick="z2PlanReset()">Let SAM plan it</button><span style="flex:1"></span>' : '') + '<button class="g-btn" type="button" onclick="z2PlanClose()">Not yet</button><button class="g-btn sp-gold" type="button" id="z2PlanGo"' + ((over.length && !SP.ack) || SP.err || !total ? ' disabled' : '') + ' onclick="z2PlanGo()">Schedule ' + total + '</button></div>';
    if (soft && card) card.scrollTop = keepScroll;
  }
  window.z2PlanGo = async function () {
    if (!SP) return;
    var btn = document.getElementById('z2PlanGo'); if (btn) { btn.disabled = true; btn.textContent = 'Scheduling…'; }
    var custom = Object.keys(SP.perDay).length || Object.keys(SP.coDays).length || SP.order !== 'listed';
    var b = Object.assign(planBody(), custom ? {} : { allow_roll: !!(SP.d && SP.d.rolled) }, SP.ack ? { accept_above_safe: true } : {});
    var cid = SP.cid;
    var d = await call('schedule_sampaign_drafts', b);
    if (!d.ok) { if (SP) { SP.err = d.error || 'Could not schedule'; paintPlan(); } return; }
    closePlan();
    toast('Scheduled ' + d.scheduled + ' over ' + pl(d.days || 1, 'day'));
    try { loadSampaignSendQueue(cid); } catch (_e) {}
    try { if (window._sampOpenId === cid) _sampRefreshOpen(); } catch (_e) {}
  };

  // ═══ 3. SAM-TAM: what SAM understood, what it left out, why each fits ══════
  var TB = { t: null, q: '', d: null, seq: 0 };
  function briefHtml(b) {
    if (!b || !(b.chips || []).length) return '';
    return '<span>SAM will look for</span>' + b.chips.map(function (c) { return '<span class="c' + (c.k === 'not' ? ' not' : '') + '">' + e(c.label) + '</span>'; }).join('') +
      ((b.unread || []).length ? '<span class="u">SAM cannot check this from the outside, so it searches on the rest: “' + e(b.unread[0]) + '”.</span>' : '') +
      (b.vague ? '<span class="v">Say what kind of companies, for example “manufacturing companies in Telangana”.</span>' : '');
  }
  function readBrief(v) {
    clearTimeout(TB.t);
    var q = String(v || '').trim();
    if (q.length < 8) { TB.d = null; TB.q = q; var h0 = document.getElementById('z2TamBrief'); if (h0) h0.innerHTML = ''; return; }
    TB.t = setTimeout(async function () {
      var my = ++TB.seq;
      var reg = (document.getElementById('g19TamR') || {}).value || '';
      var d = await call('read_tam_brief', { description: q, region_hint: reg }).catch(function () { return null; });
      if (my !== TB.seq || !d || !d.ok) return;
      TB.d = d; TB.q = q;
      var h = document.getElementById('z2TamBrief'); if (h) h.innerHTML = briefHtml(d);
    }, 380);
  }
  if (typeof _g19TamRender === 'function' && !_g19TamRender._z2) {
    var baseTam = _g19TamRender;
    _g19TamRender = function () {
      var r = baseTam.apply(this, arguments);
      var ta = document.getElementById('g19TamQ');
      if (ta && !document.getElementById('z2TamBrief')) {
        var host = document.createElement('div'); host.id = 'z2TamBrief'; host.className = 'z2-br'; host.setAttribute('aria-live', 'polite');
        ta.closest('label') ? ta.closest('label').insertAdjacentElement('afterend', host) : ta.insertAdjacentElement('afterend', host);
        if (TB.d && TB.q === String(ta.value || '').trim()) host.innerHTML = briefHtml(TB.d); else if (String(ta.value || '').trim().length >= 8) readBrief(ta.value);
        ta.addEventListener('input', function () { readBrief(ta.value); });
      }
      return r;
    };
    _g19TamRender._z2 = true;
  }
  if (typeof _samCandWhy === 'function' && !_samCandWhy._z2) {
    var baseWhy = _samCandWhy;
    _samCandWhy = function (x) {
      var parts = (x && x.score_parts) || [];
      var fit = parts.filter(function (p) { return p.group === 'fit' && p.key !== 'fit_note'; });
      var note = parts.find(function (p) { return p.key === 'fit_note'; });
      var line = fit.length ? '<span class="z2-why"><b>Why it fits:</b> ' + fit.map(function (p) { return e(p.label) + ' <em>(' + e(String(p.why || '').replace(/^It says: /, '')) + ')</em>'; }).join(' · ') + (note ? ' <em>· Not confirmed: ' + e(note.why) + '</em>' : '') + '</span>' : '';
      var rest = Object.assign({}, x, { score_parts: parts.filter(function (p) { return p.group !== 'fit'; }) });
      return line + baseWhy(rest);
    };
    _samCandWhy._z2 = true;
  }
  if (typeof _g26TamNotes === 'function' && !_g26TamNotes._z2) {
    var baseNotes = _g26TamNotes;
    _g26TamNotes = function (r) {
      var out = baseNotes(r);
      if (!r || r.earlier) return out;
      var h = '';
      if (r.brief && (r.brief.chips || []).length) h += '<div class="z2-br" style="margin:0 0 6px">' + briefHtml({ chips: r.brief.chips, unread: r.brief.unread }).replace('SAM will look for', 'SAM searched for') + '</div>';
      if (r.fewer_than_asked) h += '<div><b>' + r.fewer_than_asked.found + ' of the ' + r.fewer_than_asked.asked + ' you asked for fit everything.</b> SAM does not fill the list with companies that do not.' + (r.fewer_than_asked.can_look_wider ? ' <button type="button" class="z2-lnk" onclick="z2TamWider(this)">Also search the web</button>' : '') + '</div>';
      if (r.dropped_line) h += '<div style="margin-top:4px">SAM looked at ' + (r.looked_at || 'the') + ' companies and left out the ones that did not fit: ' + e(r.dropped_line) + '.' + ((r.dropped_names || []).length ? '<details><summary>Which ones</summary><ul>' + r.dropped_names.map(function (n) { return '<li>' + e(n) + '</li>'; }).join('') + '</ul></details>' : '') + '</div>';
      if ((r.not_found || []).length) h += '<div style="margin-top:4px">SAM could not find: <b>' + e(r.not_found.join(', ')) + '</b>. Add ' + (r.not_found.length === 1 ? 'it' : 'them') + ' by hand in the SAMpaign.</div>';
      // The older finds were checked less strictly; the generic "left out" line repeats the new one.
      if (h) out = out.replace(/<div class="g26-note">[^<]*left out because[\s\S]*?<\/div>/, '');
      return (h ? '<div class="z2-tn">' + h + '</div>' : '') + out;
    };
    _g26TamNotes._z2 = true;
  }
  window.z2TamWider = async function (btn) {
    var T = window._g19Tam; if (!T || !T.res) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Searching the web…'; }
    var d = await call('discover_accounts', { description: String(T.q || '').trim(), region_hint: String(T.region || '').trim() || undefined, limit: T.n, use_database: false });
    if (!d.ok) { toast(d.error || 'SAM could not search the web just now'); if (btn) { btn.disabled = false; btn.textContent = 'Also search the web'; } return; }
    var have = {}; (T.res.candidates || []).forEach(function (x) { have[x.id] = 1; });
    var add = (d.candidates || []).filter(function (x) { return !have[x.id]; });
    T.res.candidates = (T.res.candidates || []).concat(add);
    add.forEach(function (x) { if (x.verified) T.picked[x.id] = true; });
    T.res.fewer_than_asked = T.res.candidates.length < (T.res.asked_for || T.n) ? { found: T.res.candidates.length, asked: T.res.asked_for || T.n, can_look_wider: false } : null;
    toast(add.length ? 'SAM found ' + pl(add.length, 'more company', 'more companies') + ' on the web' : 'Nothing more on the web fits everything you asked');
    try { g19UsageLoad(true); } catch (_e) {}
    _g19TamRender();
  };
  if (typeof _g24TamEarlierHtml === 'function' && !_g24TamEarlierHtml._z2) {
    var baseEarl = _g24TamEarlierHtml;
    _g24TamEarlierHtml = function (T) {
      if (T && T.batches) T.batches.forEach(function (b) { if (b.before_fit_check && !b._z2) { b._z2 = true; b.query = (b.query || 'Earlier search') + ' (older search, checked less strictly: look before you use it)'; } });
      if (T && T.batches) T.batches.sort(function (a, b) { return (a.before_fit_check ? 1 : 0) - (b.before_fit_check ? 1 : 0); });
      return baseEarl(T);
    };
    _g24TamEarlierHtml._z2 = true;
  }
})();
