// SamoraOS, Drop U (2026-11-02). Loaded after app-5.js.
//   1. A banner when your mailbox is not connected or has stopped, saying
//      what you get back by reconnecting.
//   2. You, Notifications: what leaders get every morning (everyone sees
//      this when the pulse is on), and the switch for those who receive it.
//   3. Links from the daily pulse email: ?open=deals, replies, meetings,
//      team, connect-mailbox.
(function () {
  'use strict';
  var css = '' +
    '.mbh-banner{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:10px 16px 0;padding:12px 14px;border-radius:var(--r-md,10px);' +
      'border:1px solid rgba(179,38,30,.28);background:rgba(179,38,30,.06);color:var(--text,#1f1b14);font-size:13px;line-height:1.45}' +
    '.mbh-banner b{font-weight:700}.mbh-banner .mbh-t{flex:1 1 260px;min-width:0}' +
    '.mbh-banner .mbh-go{padding:8px 14px;border-radius:var(--r-sm,6px);background:var(--gold,#c49a2a);border:none;color:#18160F;font-weight:700;font-size:12px;cursor:pointer;font-family:var(--sans)}' +
    '.mbh-banner .mbh-x{padding:8px 10px;border-radius:var(--r-sm,6px);background:transparent;border:1px solid var(--border2,#d8d3c4);color:var(--text2,#5f5e5a);font-size:12px;cursor:pointer;font-family:var(--sans)}' +
    '.ypl{margin-top:14px;padding-top:12px;border-top:1px solid var(--border,#e6e0d2);font-size:12px;color:var(--text3,#7a756b);line-height:1.5}' +
    '.ypl-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;color:var(--text,#1f1b14);font-size:13px}' +
    '.ypl-row input{appearance:none;-webkit-appearance:none;width:36px;height:20px;border-radius:999px;background:var(--border2,#d8d3c4);position:relative;cursor:pointer;flex:none}' +
    '.ypl-row input::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s;box-shadow:0 1px 2px rgba(0,0,0,.25)}' +
    '.ypl-row input:checked{background:var(--gold,#c49a2a)}.ypl-row input:checked::after{left:18px}';
  try { var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); } catch (e) {}

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  async function edge(action, body) {
    try {
      var r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify(Object.assign({ action: action }, body || {})) });
      return await r.json();
    } catch (e) { return { ok: false, error: 'No connection' }; }
  }
  var health = null;
  function snoozed() { try { var v = localStorage.getItem('mbh-snooze'); return v && Date.now() < Number(v); } catch (e) { return false; } }
  function snooze() { try { localStorage.setItem('mbh-snooze', String(Date.now() + 86400000)); } catch (e) {} }

  function connect() {
    try { switchTab('you'); } catch (e) {}
    setTimeout(function () {
      try { var acc = document.getElementById('youAcc-email'); if (acc && !acc.classList.contains('open')) toggleYouAcc('email'); } catch (e) {}
      try { if (health && health.provider === 'Outlook' && typeof connectOutlook === 'function') connectOutlook(); else if (health && health.provider === 'Gmail' && typeof connectGmail === 'function') connectGmail(); } catch (e) {}
    }, 350);
  }
  window.samoraConnectMailbox = connect;

  function renderBanner() {
    var el = document.getElementById('mbHealthBanner');
    var s = health && health.ok ? health.status : null;
    if (!s || s === 'connected' || snoozed()) { if (el) el.remove(); return; }
    var host = document.querySelector('.app');
    if (!host) return;
    if (!el) { el = document.createElement('div'); el.id = 'mbHealthBanner'; el.className = 'mbh-banner'; el.setAttribute('role', 'status'); host.insertBefore(el, host.firstChild); }
    var msg = s === 'none'
      ? '<b>Connect your mailbox</b> to get customer replies at the top of Today, prep before every meeting, and credit for every customer email on your deals.'
      : '<b>Your mailbox connection has stopped.</b> Reconnect to get your replies on Today, meeting prep and credit for your work back. Tick every box ' + (health.provider === 'Outlook' ? 'Microsoft' : 'Google') + ' shows.';
    el.innerHTML = '<span class="mbh-t">' + msg + '</span><button type="button" class="mbh-go">' + (s === 'none' ? 'Connect' : 'Reconnect') + '</button><button type="button" class="mbh-x">Later</button>';
    el.querySelector('.mbh-go').onclick = connect;
    el.querySelector('.mbh-x').onclick = function () { snooze(); el.remove(); };
  }

  function renderYou() {
    var acc = document.getElementById('youAcc-notifications');
    var card = acc && acc.querySelector('.admin-card');
    if (!card || !health || !health.ok || !health.pulse || !health.pulse.enabled) { var old = document.getElementById('youPulseBox'); if (old) old.remove(); return; }
    var box = document.getElementById('youPulseBox');
    if (!box) { box = document.createElement('div'); box.id = 'youPulseBox'; box.className = 'ypl'; card.appendChild(box); }
    var p = health.pulse;
    box.innerHTML = '<div><b style="color:var(--text)">Daily team summary.</b> Your leaders get a short email each working morning with counts from connected mailboxes and calendars: customer emails, replies, meetings, SAMpaign and LinkedIn steps, and deals that moved. What your emails say is never included.</div>' +
      (p.recipient ? '<label class="ypl-row"><span>Send me the leader daily pulse</span><input type="checkbox" id="youPulseOn"' + (p.opted_out ? '' : ' checked') + ' aria-label="Send me the leader daily pulse"></label>' : '');
    var cb = document.getElementById('youPulseOn');
    if (cb) cb.onchange = async function () {
      cb.disabled = true;
      var d = await edge('set_leader_pulse_opt_out', { off: !cb.checked });
      cb.disabled = false;
      if (!d || !d.ok) { cb.checked = !cb.checked; try { showToast((d && d.error) || 'Could not save.'); } catch (e) {} return; }
      health.pulse.opted_out = !cb.checked;
      try { showToast(cb.checked ? 'You will get the daily pulse each working morning.' : 'Daily pulse off for you.'); } catch (e) {}
    };
  }

  async function load() {
    if (typeof currentUser === 'undefined' || !currentUser || !currentUser.token) return;
    var d = await edge('my_mailbox_health', {});
    if (!d || !d.ok) return;
    health = d; renderBanner(); renderYou();
  }
  window.samoraMailboxHealth = function () { return health; };

  // Links from the pulse email.
  function handleOpen() {
    var q = new URLSearchParams(location.search), o = q.get('open');
    if (!o) return;
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    setTimeout(function () {
      try {
        if (o === 'deals') { switchTab('pipeline'); }
        else if (o === 'replies') { switchTab('today'); }
        else if (o === 'meetings') { switchTab('today'); var m = document.getElementById('meetingPrepSection'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        else if (o === 'team') { if (typeof switchToOrgPanel === 'function') switchToOrgPanel(); else switchTab('org'); setTimeout(function () { try { if (window._sxaConsole) { window._sxaConsole.tab = 'mailboxes'; window._sxaConsole.render(); } } catch (e) {} }, 800); }
        else if (o === 'connect-mailbox') { connect(); }
      } catch (e) {}
    }, 500);
  }

  var base = launchApp;
  launchApp = function () {
    var r = base.apply(this, arguments);
    setTimeout(function () { handleOpen(); load(); }, 1200);
    return r;
  };
  var baseYou = typeof renderYouPanel === 'function' ? renderYouPanel : null;
  if (baseYou) renderYouPanel = function () { var r = baseYou.apply(this, arguments); try { renderYou(); } catch (e) {} return r; };
  // Recheck after a reconnect (the OAuth window posts back and the You tab refreshes).
  var baseRefresh = typeof refreshYouTabConnections === 'function' ? refreshYouTabConnections : null;
  if (baseRefresh) refreshYouTabConnections = async function () { var r = await baseRefresh.apply(this, arguments); try { setTimeout(load, 1500); } catch (e) {} return r; };
})();
