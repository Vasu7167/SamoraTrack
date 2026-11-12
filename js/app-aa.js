// SamoraOS app: Drop AA (12 Nov 2026). Research first.
//   SAM visits each LinkedIn profile first, reads it (and recent posts), and
//   only then writes the invite note, the message and the first email, each
//   from a different true detail. The Sequence shows how far the reading has
//   got; every person and every draft says what it was built on. Someone with
//   nothing to read in time gets the usual text. A premium add-on, switched on
//   per organisation by Samora; off, everything works as before.
// Loaded after app-z2.js.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function call(action, body) { return _sampEdge(action, body || {}); }
  function toast(m) { try { showToast(m); } catch (_e) {} }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function day(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (_e) { return ''; } }
  function low(s) { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); }
  function ini(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  var IC = {
    scan: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="12" height="15" rx="2.2"/><circle cx="9.5" cy="9.3" r="2.2"/><path d="M6.4 15.2c.7-1.6 1.8-2.4 3.1-2.4s2.4.8 3.1 2.4"/><circle cx="17.2" cy="15.6" r="3.1"/><path d="M19.5 17.9l2 2"/></svg>',
    spark: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    x: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    lock: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/></svg>',
    ext: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>'
  };
  var WHY = { no_profile: 'No LinkedIn profile', unavailable: 'Profile not available', visit_failed: 'The visit could not go', thin: 'Too little on the profile', timeout: 'Not read in time', reading: 'Reading now', visit_queued: 'Visit queued', visit_planned: 'Visit planned', not_buyer: 'Not a buyer', skipped: 'Skipped', profile: 'Profile read' };
  var FROM = { post: 'Their post', headline: 'Headline', about: 'About', experience: 'Experience', activity: 'Activity', education: 'Education', mutuals: 'Mutual connections' };
  var STATE = { read: 'Read', waiting: 'Reading', usual: 'Usual text', held: 'Held' };

  (function css() {
    if (document.getElementById('aaCss')) return;
    var st = document.createElement('style'); st.id = 'aaCss';
    st.textContent = [
      '.aa-hero{position:relative;overflow:hidden;margin:0 0 14px;padding:18px 20px 16px;border-radius:18px;border:1px solid rgba(var(--c-accent-rgb),.32);background:linear-gradient(160deg,rgba(var(--c-accent-rgb),.11),rgba(var(--c-accent-rgb),.03) 55%),var(--g-fill-strong,var(--surface));box-shadow:var(--g-card-shadow,none)}',
      '.aa-hero.off{border-color:var(--g-line,var(--border));background:var(--g-fill-strong,var(--surface))}',
      '.aa-top{display:flex;gap:14px;align-items:flex-start}',
      '.aa-mark{flex:none;width:42px;height:42px;border-radius:13px;display:grid;place-items:center;color:var(--c-accent-text);background:rgba(var(--c-accent-rgb),.14);border:1px solid rgba(var(--c-accent-rgb),.35)}',
      '.aa-hd{flex:1;min-width:0}.aa-t{font-size:15.5px;font-weight:650;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.aa-k{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 8px;border-radius:999px;color:var(--c-on-accent,#241C05);background:linear-gradient(135deg,#B8860B,#E8B84B,#C8961E)}',
      '.aa-s{font-size:13px;line-height:1.5;color:var(--text2);margin-top:3px}.aa-top{align-items:center}.aa-d{margin:2px 64px 0 56px}',
      '.aa-sw{position:relative;display:inline-flex;align-items:center;gap:8px;flex:none;cursor:pointer;font-size:12.5px;color:var(--text2)}.aa-sw input{position:absolute;opacity:0;width:0;height:0}',
      '.aa-sw i{position:relative;width:40px;height:23px;border-radius:999px;background:rgba(127,127,127,.32);transition:.15s;display:inline-block}.aa-sw i:after{content:"";position:absolute;left:3px;top:3px;width:17px;height:17px;border-radius:50%;background:#fff;transition:.15s;box-shadow:0 1px 3px rgba(0,0,0,.25)}',
      '.aa-sw input:checked+i{background:linear-gradient(135deg,#B8860B,#E8B84B)}.aa-sw input:checked+i:after{left:20px}.aa-sw input:focus-visible+i{outline:2px solid rgba(var(--c-accent-rgb),.8);outline-offset:2px}.aa-sw input:disabled+i{opacity:.5}',
      '.aa-bar{display:flex;height:10px;border-radius:999px;overflow:hidden;margin:16px 0 12px;background:rgba(127,127,127,.12)}.aa-bar span{display:block;height:100%;transition:width .4s ease}',
      '.aa-bar .r{background:linear-gradient(90deg,#B8860B,#E8B84B)}.aa-bar .w{background:repeating-linear-gradient(135deg,rgba(var(--c-accent-rgb),.42) 0 5px,rgba(var(--c-accent-rgb),.16) 5px 10px);animation:aaFlow 1.6s linear infinite;background-size:28px 28px}',
      '.aa-bar .u{background:rgba(127,127,127,.38)}.aa-bar .h{background:var(--c-risk,#c0392b);opacity:.7}',
      '@keyframes aaFlow{to{background-position:28px 0}}@media (prefers-reduced-motion:reduce){.aa-bar .w{animation:none}}',
      '.aa-legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px 18px}',
      '.aa-lg{display:flex;gap:9px;align-items:flex-start;font-size:13px;line-height:1.4;padding:2px 0;background:none;border:0;color:inherit;text-align:left;cursor:pointer;border-radius:8px;font-family:inherit}.aa-lg:hover b{text-decoration:underline}',
      '.aa-lg i{flex:none;width:10px;height:10px;border-radius:3px;margin-top:4px}.aa-lg i.r{background:linear-gradient(135deg,#B8860B,#E8B84B)}.aa-lg i.w{background:rgba(var(--c-accent-rgb),.35);outline:1px dashed rgba(var(--c-accent-rgb),.8)}.aa-lg i.u{background:rgba(127,127,127,.4)}.aa-lg i.h{background:var(--c-risk,#c0392b);opacity:.7}',
      '.aa-lg b{font-weight:650}.aa-lg small{display:block;color:var(--text3);font-size:12px}',
      '.aa-built{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--g-line,var(--border))}',
      '.aa-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:4px 10px;border-radius:999px;background:rgba(127,127,127,.09);color:var(--text2)}.aa-pill b{color:var(--text);font-weight:650}',
      '.aa-pill.g{background:rgba(var(--c-accent-rgb),.14);color:var(--c-accent-text)}.aa-pill.g b{color:inherit}',
      '.aa-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px}',
      '.aa-note{margin-top:12px;font-size:12.5px;line-height:1.5;color:var(--text2);padding:9px 12px;border-radius:12px;background:rgba(127,127,127,.07)}.aa-note b{color:var(--text)}',
      '.aa-lockline{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.aa-lockline .aa-s{flex:1;min-width:220px}',
      '.sp-chip.aa{background:rgba(var(--c-accent-rgb),.16);color:var(--c-accent-text)}',
      // People and drafts
      '.aa-line{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12.5px;color:var(--text2)}',
      '.aa-line .aa-pill{font-size:11.5px;padding:2px 8px}.aa-lk{background:none;border:0;padding:0;color:var(--c-accent-text);font:inherit;font-weight:600;cursor:pointer}.aa-lk:hover{text-decoration:underline}',
      '.aa-bo{margin:10px 0 4px;padding:10px 12px;border-radius:12px;border:1px solid rgba(var(--c-accent-rgb),.28);background:rgba(var(--c-accent-rgb),.06);font-size:12.5px;line-height:1.5}.aa-bo b{font-weight:650}.aa-bo small{color:var(--text3)}',
      '.aa-bo.u{border-color:var(--g-line,var(--border));background:rgba(127,127,127,.06)}',
      // The sheet
      '.aa-sh{max-width:680px!important;padding:0!important;display:flex;flex-direction:column;max-height:min(760px,calc(100vh - 40px))}',
      '.aa-shh{display:flex;align-items:center;gap:10px;padding:18px 20px 12px;border-bottom:1px solid var(--g-line,var(--border))}.aa-shh h3{margin:0;font-size:16px;flex:1;min-width:0}',
      '.aa-ib{width:34px;height:34px;border-radius:10px;border:0;background:transparent;color:inherit;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.aa-ib:hover{background:rgba(var(--c-accent-rgb),.14)}.aa-ib:focus-visible{outline:2px solid rgba(var(--c-accent-rgb),.8)}',
      '.aa-tabs{display:flex;gap:6px;padding:12px 20px 4px;flex-wrap:wrap}.aa-tab{border:1px solid var(--g-line,var(--border));background:transparent;color:var(--text2);border-radius:999px;padding:5px 12px;font:inherit;font-size:12.5px;cursor:pointer}.aa-tab.on{background:rgba(var(--c-accent-rgb),.16);border-color:rgba(var(--c-accent-rgb),.5);color:var(--text);font-weight:600}',
      '.aa-q{margin:8px 20px 4px;width:calc(100% - 40px);box-sizing:border-box;padding:9px 12px;border-radius:12px;border:1px solid var(--border2,var(--border));background:var(--bg);color:var(--text);font:inherit;font-size:13.5px}',
      '.aa-ls{overflow:auto;flex:1;padding:4px 10px 14px}.aa-row{display:flex;gap:12px;align-items:center;width:100%;padding:10px 10px;border:0;border-radius:12px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}.aa-row:hover,.aa-row:focus-visible{background:rgba(127,127,127,.08);outline:none}',
      '.aa-av{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:12.5px;font-weight:700;background:rgba(var(--c-accent-rgb),.16);color:var(--c-accent-text)}',
      '.aa-rw{flex:1;min-width:0}.aa-rw b{display:block;font-size:13.5px;font-weight:600}.aa-rw small{display:block;font-size:12px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.aa-st{flex:none;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:999px;background:rgba(127,127,127,.1);color:var(--text2)}.aa-st.read{background:rgba(var(--c-accent-rgb),.18);color:var(--c-accent-text)}.aa-st.held{background:var(--c-risk-wash,rgba(192,57,43,.1));color:var(--c-risk,#c0392b)}.aa-st.waiting{background:transparent;border:1px dashed rgba(var(--c-accent-rgb),.7);color:var(--c-accent-text)}',
      '.aa-em{padding:30px 20px;text-align:center;color:var(--text3);font-size:13.5px}',
      '.aa-pd{overflow:auto;padding:14px 20px 20px}.aa-pd h4{margin:18px 0 8px;font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--text3)}',
      '.aa-f{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:10px;font-size:13.5px;line-height:1.45}.aa-f+.aa-f{margin-top:2px}.aa-f.op{background:rgba(var(--c-accent-rgb),.1);box-shadow:inset 3px 0 0 #D4AF37}',
      '.aa-f em{flex:none;font-style:normal;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(127,127,127,.12);color:var(--text2);margin-top:1px}.aa-f em.post{background:rgba(var(--c-accent-rgb),.2);color:var(--c-accent-text)}',
      '.aa-bi{display:grid;grid-template-columns:110px minmax(0,1fr);gap:4px 12px;font-size:13px;line-height:1.45;padding:8px 0;border-top:1px solid var(--g-line,var(--border))}.aa-bi:first-of-type{border-top:0}.aa-bi span{color:var(--text3)}',
      '.aa-pdacts{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}',
      '.aa-set{display:flex;gap:14px;flex-wrap:wrap;align-items:center;padding:10px 20px 14px;border-top:1px solid var(--g-line,var(--border));font-size:13px;color:var(--text2)}.aa-set select{font:inherit;padding:5px 8px;border-radius:8px;border:1px solid var(--border2,var(--border));background:var(--bg);color:var(--text)}',
      '@media (max-width:640px){.aa-hero{padding:16px}.aa-d{margin:10px 0 0}.aa-bi{grid-template-columns:1fr}.aa-sh{max-height:calc(100vh - 20px)}}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  // ── Data ───────────────────────────────────────────────────────────────
  var RS = window._aaRs = window._aaRs || {};
  async function load(id, force) {
    var c = RS[id];
    if (c && !force && Date.now() - c.at < 20000) return c.d;
    if (c && c.p && !force) return c.p;
    var p = call('get_sampaign_research', { campaign_id: id }).then(function (d) { RS[id] = { at: Date.now(), d: d }; return d; }).catch(function () { return null; });
    RS[id] = Object.assign({}, c || {}, { p: p });
    return p;
  }
  function cached(id) { return RS[id] && RS[id].d ? RS[id].d : null; }
  function personAnywhere(contactId) {
    for (var k in RS) { var d = RS[k] && RS[k].d; if (d && d.on && d.people && d.people[contactId]) return { camp: k, d: d, p: d.people[contactId] }; }
    return null;
  }

  // ── The hero card on the Sequence tab ──────────────────────────────────
  function legend(cls, n, label, sub, tab, id) {
    if (!n) return '';
    return '<button class="aa-lg" type="button" onclick="aaOpen(\'' + e(id) + '\',\'' + tab + '\')"><i class="' + cls + '"></i><span><b>' + n + '</b> ' + e(label) + (sub ? '<small>' + e(sub) + '</small>' : '') + '</span></button>';
  }
  function usualWhy(d) {
    var w = d.usual_why || {}, out = [];
    Object.keys(w).sort(function (a, b) { return w[b] - w[a]; }).forEach(function (k) { out.push(w[k] + ' ' + low(WHY[k] || k)); });
    return out.join(' · ');
  }
  function heroHtml(id, d) {
    if (!d || !d.ok) return '';
    var owner = d.is_owner;
    if (d.locked) {
      if (!d.linkedin_on) return '';
      return '<div class="aa-hero off" id="aaHero_' + e(id) + '"><div class="aa-lockline"><div class="aa-mark">' + IC.lock + '</div>' +
        '<div class="aa-s"><span class="aa-t">Research first <span class="aa-k">Premium</span></span>SAM reads each LinkedIn profile and recent posts before it writes, so every note and first email opens from something true about that person.</div>' +
        '<button class="g-btn sp-sm" type="button" onclick="aaRequest(this)">Ask Samora to unlock</button></div></div>';
    }
    if (!d.linkedin_on) {
      return '<div class="aa-hero off" id="aaHero_' + e(id) + '"><div class="aa-top"><div class="aa-mark">' + IC.scan + '</div><div class="aa-hd"><div class="aa-t">Research first</div>' +
        '<div class="aa-s">SAM reads each person\'s LinkedIn profile during a quiet visit, then writes from it. Add LinkedIn steps to this SAMpaign to use it.</div>' +
        (owner ? '<div class="aa-acts"><button class="g-btn sp-sm sp-gold" type="button" onclick="spLiEdit(\'' + e(id) + '\',true)">Add LinkedIn steps</button></div>' : '') + '</div></div></div>';
    }
    var sw = '<label class="aa-sw" title="Research first"><input type="checkbox" ' + (d.on ? 'checked ' : '') + (owner ? '' : 'disabled ') + 'onchange="aaToggle(\'' + e(id) + '\',this.checked,this)" aria-label="Research first"><i></i></label>';
    if (!d.on) {
      return '<div class="aa-hero off" id="aaHero_' + e(id) + '"><div class="aa-top"><div class="aa-mark">' + IC.scan + '</div><div class="aa-hd"><div class="aa-t">Research first <span class="sp-chip">Off</span></div></div>' + sw + '</div>' +
        '<div class="aa-s aa-d">Right now SAM writes from each person\'s role and company. Turn this on and SAM visits each profile first, reads it' + (d.config && d.config.posts !== false ? ' and their recent posts' : '') + ', and writes the note, the message and the first email from what it found. Anyone it cannot read within ' + pl((d.config && d.config.wait_days) || 2, 'working day') + ' gets the usual text.</div></div>';
    }
    var c = d.counts || {}, t = d.texts || { notes: {}, messages: {}, emails: {} };
    var tot = Math.max(1, c.read + c.waiting + c.usual + c.held);
    var w = function (n) { return (n / tot * 100).toFixed(2) + '%'; };
    var bar = '<div class="aa-bar" role="img" aria-label="' + e(c.read + ' read, ' + c.waiting + ' being read, ' + c.usual + ' usual text, ' + c.held + ' held') + '">' +
      '<span class="r" style="width:' + w(c.read) + '"></span><span class="w" style="width:' + w(c.waiting) + '"></span><span class="u" style="width:' + w(c.usual) + '"></span><span class="h" style="width:' + w(c.held) + '"></span></div>';
    var strong = c.read ? [c.strong ? pl(c.strong, 'strong opener') : 'no strong openers yet', c.with_posts ? c.with_posts + ' from their posts' : ''].filter(Boolean).join(' · ') : '';
    var legendH = '<div class="aa-legend">' +
      legend('r', c.read, c.read === 1 ? 'profile read' : 'profiles read', strong, 'read', id) +
      legend('w', c.waiting, 'SAM is reading', d.next_deadline ? 'Usual text for anyone not read by ' + day(d.next_deadline) : 'Visits queued in the plugin', 'waiting', id) +
      legend('u', c.usual, 'the usual text', usualWhy(d), 'usual', id) +
      legend('h', c.held, 'held, not a buyer', 'Keep or skip them in the Samora panel', 'held', id) + '</div>';
    var em = t.emails || {}, nt = t.notes || {}, ms = t.messages || {};
    var pills = [];
    var p = function (label, from, all, gold) { if (!all) return; pills.push('<span class="aa-pill' + (gold ? ' g' : '') + '">' + e(label) + ' <b>' + from + ' of ' + all + '</b> from their profile</span>'); };
    p('Notes', nt.profile || 0, (nt.profile || 0) + (nt.usual || 0), (nt.profile || 0) > 0);
    p('First emails', em.profile || 0, (em.profile || 0) + (em.usual || 0), (em.profile || 0) > 0);
    p('Messages', ms.profile || 0, (ms.profile || 0) + (ms.usual || 0), (ms.profile || 0) > 0);
    if (em.waiting) pills.push('<span class="aa-pill">' + pl(em.waiting, 'first email') + ' waiting for the profile</span>');
    if (em.in_review) pills.push('<span class="aa-pill">' + em.in_review + ' in Review</span>');
    var notes = '';
    if (em.stale) notes += '<div class="aa-note"><b>' + pl(em.stale, 'draft was', 'drafts were') + ' written before the profile was read.</b> SAM writes ' + (em.stale === 1 ? 'it' : 'them') + ' again from the profile, in place. Anything you edited stays as you left it.</div>';
    if (d.plugin && !d.plugin.posts_ready && d.config.posts) notes += '<div class="aa-note"><b>Update the Samora plugin to 1.16</b> so SAM reads recent posts too. Until then it reads the profile.</div>';
    if (!d.plugin) notes += '<div class="aa-note"><b>No Samora plugin is connected yet.</b> The visits run from the plugin in Chrome. Until it runs, everyone gets the usual text after ' + pl(d.config.wait_days, 'working day') + '.</div>';
    if (!d.email_on) notes += '';
    var readyNow = (em.none || 0);
    return '<div class="aa-hero" id="aaHero_' + e(id) + '"><div class="aa-top"><div class="aa-mark">' + IC.scan + '</div><div class="aa-hd">' +
      '<div class="aa-t">Research first <span class="aa-k">Premium</span></div></div>' + sw + '</div>' +
      '<div class="aa-s aa-d">SAM visits each profile first and reads it' + (d.config.posts ? ' and their recent posts' : '') + '. Then it writes the note, the message and the first email, each opening from a different true detail. Nothing is sent until you approve.</div>' +
      bar + legendH +
      (pills.length ? '<div class="aa-built">' + pills.join('') + '</div>' : '') + notes +
      '<div class="aa-acts">' + (owner && readyNow ? '<button class="g-btn sp-sm sp-gold" type="button" onclick="aaWriteReady(\'' + e(id) + '\',this)">' + IC.spark + ' Write ' + pl(readyNow, 'ready email') + ' now</button>' : '') +
        '<button class="g-btn sp-sm" type="button" onclick="aaOpen(\'' + e(id) + '\',\'all\')">See each person</button></div></div>';
  }
  function paintHero(id) {
    var box = document.getElementById('sampSeqTop_' + id); if (!box) return;
    var d = cached(id);
    var old = document.getElementById('aaHero_' + id);
    var html = heroHtml(id, d);
    if (old) { if (html) old.outerHTML = html; else old.remove(); return; }
    if (html) box.insertAdjacentHTML('afterbegin', html);
  }
  // The steps say what happens in this mode.
  function relabel(id) {
    var d = cached(id); if (!d || !d.on) return;
    var box = document.getElementById('sampSeqTop_' + id); if (!box) return;
    var c = d.counts || {};
    var vis = box.querySelector('.sp-step[data-k="visit"]');
    if (vis && !vis.getAttribute('data-aa')) {
      vis.setAttribute('data-aa', '1');
      var sh = vis.querySelector('.sp-sh'), sm = vis.querySelector('.sp-sm2');
      if (sh) sh.innerHTML = 'SAM reads their profile <span class="sp-small">· first</span> <span class="sp-chip aa">Research first</span>';
      if (sm) sm.textContent = 'A quiet visit: SAM reads their profile' + (d.config.posts ? ' and recent posts' : '') + ', then writes. ' + [c.read ? c.read + ' read' : '', c.waiting ? c.waiting + ' to read' : ''].filter(Boolean).join(', ');
    }
    var inv = box.querySelector('.sp-step[data-k="invite"]');
    if (inv && !inv.getAttribute('data-aa')) {
      inv.setAttribute('data-aa', '1');
      var ish = inv.querySelector('.sp-sh'); if (ish) ish.insertAdjacentHTML('beforeend', ' <span class="sp-chip aa">After the profile is read</span>');
      var ism = inv.querySelector('.sp-sm2'); if (ism && /SAM writes each note/.test(ism.textContent)) ism.textContent = ism.textContent.replace('SAM writes each note, under 300 characters', 'SAM writes each note from what it read, opening from a different detail than the email');
    }
    var msg = box.querySelector('.sp-step[data-k="message"]');
    if (msg && !msg.getAttribute('data-aa')) {
      msg.setAttribute('data-aa', '1');
      var msm = msg.querySelector('.sp-sm2'); if (msm && /Builds on the invite note/.test(msm.textContent)) msm.textContent = msm.textContent.replace('Builds on the invite note', 'Builds on the note and what SAM read, never repeats them');
    }
    var o = (window._sampOv || {})[id], w1 = o && o.waves ? o.waves.find(function (w) { return w.launch === 1; }) : null;
    var ph = document.getElementById('spLiSteps_' + id);
    var row = ph ? ph.previousElementSibling : box.querySelector('.sp-wv .sp-card > .sp-step:not([data-k])');
    if (row && w1 && (w1.research_waiting || w1.research_held) && !row.getAttribute('data-aa')) {
      row.setAttribute('data-aa', '1');
      var rsh = row.querySelector('.sp-sh'); if (rsh && w1.research_waiting) rsh.insertAdjacentHTML('beforeend', ' <span class="sp-chip aa">' + w1.research_waiting + ' waiting for their profile</span>');
      var rsm = row.querySelector('.sp-sm2'); if (rsm) rsm.textContent = (rsm.textContent && !/Nobody is waiting/.test(rsm.textContent) ? rsm.textContent + ' · ' : '') + 'SAM writes each one into Review once their profile is read';
    }
  }
  if (typeof window._spLiDecorate === 'function' && !window._spLiDecorate._aa) {
    var baseLi = window._spLiDecorate;
    window._spLiDecorate = async function (id, force) {
      var pr = load(id, !!force);
      var out = await baseLi.apply(this, arguments);
      try { await pr; paintHero(id); relabel(id); } catch (_e) {}
      return out;
    };
    window._spLiDecorate._aa = true;
  }

  // ── Actions ────────────────────────────────────────────────────────────
  async function refresh(id) {
    await load(id, true);
    paintHero(id);
    try { if (typeof _spLiDecorate === 'function') await _spLiDecorate(id, true); } catch (_e) {}
    if (document.getElementById('aaSheet')) paintSheet();
  }
  window.aaToggle = async function (id, on, el) {
    if (el) el.disabled = true;
    var d = await call('set_sampaign_research', { campaign_id: id, on: !!on });
    if (el) el.disabled = false;
    if (!d.ok) { if (el) el.checked = !on; toast(d.error || 'Could not change that.'); return; }
    RS[id] = { at: Date.now(), d: d };
    toast(on ? 'Research first is on. SAM reads each profile before it writes.' : 'Research first is off. SAM writes the usual way.');
    try { window._spLiCache && delete window._spLiCache[id]; } catch (_e) {}
    try { if (typeof _spRenderSeqTop === 'function') _spRenderSeqTop(id); else paintHero(id); } catch (_e) { paintHero(id); }
  };
  window.aaRequest = async function (btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    var d = await call('request_addon', { addon: 'research' });
    if (btn) { btn.textContent = d.ok ? 'Samora has your request' : 'Ask Samora to unlock'; btn.disabled = !!d.ok; }
    toast(d.ok ? 'Sent to the Samora team. They will be in touch.' : (d.error || 'Could not reach Samora'));
  };
  window.aaWriteReady = async function (id, btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = IC.spark + ' Starting…'; }
    var d = await call('run_research_sweep', { campaign_id: id });
    if (!d.ok) { toast(d.error || 'Could not start that.'); if (btn) btn.disabled = false; return; }
    toast(d.people ? 'SAM is writing ' + pl(d.people, 'first email') + ' into Review.' : 'Nothing is ready to write yet: SAM is still reading.');
    setTimeout(function () { refresh(id); }, 2500);
  };
  window.aaUsualNow = async function (id, cid, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Writing…'; }
    var d = await call('write_sampaign_drafts', { campaign_id: id, launch: 1, research: 'usual_now', only_ids: [cid], batch: 1 });
    if (btn) btn.disabled = false;
    if (!d.ok) { toast(d.error || 'Could not write it.'); if (btn) btn.textContent = 'Write the usual email now'; return; }
    toast(d.written ? 'Written the usual way, and waiting in Review.' : (d.note || 'Nothing to write for them.'));
    refresh(id);
  };
  window.aaSet = async function (id, key, val) {
    var b = { campaign_id: id, on: true }; b[key] = val;
    var d = await call('set_sampaign_research', b);
    if (!d.ok) { toast(d.error || 'Could not save that.'); return; }
    RS[id] = { at: Date.now(), d: d }; toast('Saved.'); paintHero(id); paintSheet();
  };

  // ── Each person: the sheet ─────────────────────────────────────────────
  var SH = { id: null, tab: 'all', q: '', person: null };
  window.aaOpen = function (id, tab) {
    SH.id = id; SH.tab = tab || 'all'; SH.q = ''; SH.person = null;
    var m = document.getElementById('aaSheet');
    if (!m) {
      m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'aaSheet';
      m.addEventListener('click', function (ev) { if (ev.target === m) aaClose(); });
      document.addEventListener('keydown', function esc(ev) { if (ev.key === 'Escape' && document.getElementById('aaSheet')) { aaClose(); } });
      document.body.appendChild(m);
    }
    paintSheet();
    if (!cached(id)) load(id).then(paintSheet);
  };
  window.aaClose = function () { var m = document.getElementById('aaSheet'); if (m) m.remove(); };
  window.aaTab = function (t) { SH.tab = t; paintSheet(); };
  window.aaQ = function (v) { SH.q = v; var ls = document.getElementById('aaLs'); if (ls) ls.innerHTML = listHtml(); };
  window.aaPerson = async function (cid) {
    SH.person = { id: cid, loading: true }; paintSheet();
    var d = await call('get_sampaign_research', { campaign_id: SH.id, contact_id: cid });
    SH.person = d && d.ok && d.person ? d.person : { id: cid, error: (d && d.error) || 'Could not load this person.' };
    paintSheet();
  };
  window.aaBack = function () { SH.person = null; paintSheet(); };
  function peopleList() {
    var d = cached(SH.id); if (!d || !d.people) return [];
    var names = {};
    try { ((window._sampaignContactsCache || {})[SH.id] || []).forEach(function (c) { names[c.id] = c; }); } catch (_e) {}
    return Object.keys(d.people).map(function (k) { var c = names[k] || {}; return Object.assign({ id: k, name: c.name || '', company: c.company || '', title: c.title || '' }, d.people[k]); });
  }
  function listHtml() {
    var all = peopleList();
    var q = SH.q.toLowerCase().trim();
    var rows = all.filter(function (p) { return (SH.tab === 'all' || p.state === SH.tab) && (!q || (p.name + ' ' + p.company).toLowerCase().indexOf(q) !== -1); });
    var order = { read: 0, waiting: 1, usual: 2, held: 3 };
    rows.sort(function (a, b) { return (order[a.state] - order[b.state]) || String(a.name).localeCompare(String(b.name)); });
    if (!rows.length) return '<div class="aa-em">' + (all.length ? 'Nobody here.' : 'Loading…') + '</div>';
    return rows.slice(0, 300).map(function (p) {
      var sub = p.state === 'read' ? (p.opener ? 'Opens from: ' + p.opener.t : 'Read, no strong opener: kept short and honest')
        : p.state === 'waiting' ? (WHY[p.why] || 'Reading') + (p.deadline && p.why !== 'reading' ? ' · usual text after ' + day(p.deadline) : '')
        : WHY[p.why] || '';
      return '<button class="aa-row" type="button" onclick="aaPerson(\'' + e(p.id) + '\')"><span class="aa-av">' + e(ini(p.name)) + '</span><span class="aa-rw"><b>' + e(p.name || 'Someone') + (p.company ? ' <span style="font-weight:400;color:var(--text3)">· ' + e(p.company) + '</span>' : '') + '</b><small>' + e(sub) + '</small></span><span class="aa-st ' + e(p.state) + '">' + e(STATE[p.state] || p.state) + '</span></button>';
    }).join('');
  }
  function builtRow(label, u, text) {
    if (!u && !text) return '<div class="aa-bi"><span>' + e(label) + '</span><div style="color:var(--text3)">Not written yet</div></div>';
    if (!u) return '<div class="aa-bi"><span>' + e(label) + '</span><div>Written before research first was on</div></div>';
    return '<div class="aa-bi"><span>' + e(label) + '</span><div>' + (u.usual ? '<b>The usual text</b>' + (u.f ? '' : '') : u.f ? '<b>' + e(u.f) + '</b> ' + e(u.t || '') + (u.from ? ' <small style="color:var(--text3)">· ' + e(FROM[u.from] || u.from) + '</small>' : '') : '<b>Kept short and honest</b>: nothing on the profile made a natural opener') + '</div></div>';
  }
  function personHtml(p) {
    if (p.loading) return '<div class="aa-em">Loading what SAM read…</div>';
    if (p.error) return '<div class="aa-em">' + e(p.error) + '</div>';
    var c = p.card, opF = c && c.hooks && c.hooks[0] ? c.hooks[0].fact : null;
    var h = '<div class="aa-pd"><div style="display:flex;gap:12px;align-items:center"><span class="aa-av" style="width:44px;height:44px;font-size:14px">' + e(ini(p.name)) + '</span><div style="flex:1;min-width:0"><div style="font-weight:650;font-size:15px">' + e(p.name || 'Someone') + '</div><div class="sp-small">' + e([p.title, p.company].filter(Boolean).join(' · ')) + '</div></div><span class="aa-st ' + e(p.state) + '">' + e(STATE[p.state] || p.state) + '</span></div>';
    if (c && c.facts && c.facts.length) {
      h += '<h4>What SAM read' + (c.at ? ' · ' + e(day(c.at)) : '') + (c.posts_read ? ' · ' + pl(c.posts || 0, 'recent post') : '') + '</h4>' + (c.summary ? '<div class="sp-small" style="margin-bottom:6px">' + e(c.summary) + '</div>' : '') +
        c.facts.map(function (f) { return '<div class="aa-f' + (f.id === opF ? ' op' : '') + '"><em class="' + (f.from === 'post' ? 'post' : '') + '">' + e(FROM[f.from] || f.from || 'Profile') + '</em><span>' + e(f.text) + (f.id === opF ? ' <small style="color:var(--c-accent-text);font-weight:600">· best opener</small>' : '') + '</span></div>'; }).join('');
      if (c.style && (c.style.tone || c.style.notes)) h += '<div class="sp-small" style="margin-top:8px"><b>How they write:</b> ' + e([c.style.tone, c.style.notes].filter(Boolean).join('. ')) + '</div>';
    } else {
      h += '<h4>What SAM read</h4><div class="aa-note">' + (p.state === 'waiting' ? 'SAM has not read this profile yet. ' + (p.why === 'reading' ? 'The visit just happened: the card is being written.' : 'The visit is queued in your Samora plugin.') + (p.deadline && p.why !== 'reading' ? ' If it is not read by <b>' + e(day(p.deadline)) + '</b>, they get the usual text.' : '') : 'Nothing to read: ' + e(low(WHY[p.why] || '')) + '. They get the usual text, which pretends nothing.') + '</div>';
    }
    var u = p.used || {}, t = p.texts || {};
    h += '<h4>Built on</h4>' + builtRow('Invite note', u.invite, t.invite) + builtRow('First email', u.email, t.email) + builtRow('Message', u.message, t.message);
    h += '<div class="aa-pdacts">' +
      (p.state === 'waiting' && SH.id && cached(SH.id) && cached(SH.id).is_owner && !(t.email) ? '<button class="g-btn sp-sm" type="button" onclick="aaUsualNow(\'' + e(SH.id) + '\',\'' + e(p.id) + '\',this)">Write the usual email now</button>' : '') +
      (t.email && t.email.status === 'draft' ? '<button class="g-btn sp-sm sp-gold" type="button" onclick="aaClose();sampReviewWave(\'' + e(SH.id) + '\',1)">Open in Review</button>' : '') +
      (p.linkedin_url ? '<a class="g-btn sp-sm sp-ghost" href="' + e(p.linkedin_url) + '" target="_blank" rel="noopener">Their profile ' + IC.ext + '</a>' : '') + '</div></div>';
    return h;
  }
  function paintSheet() {
    var m = document.getElementById('aaSheet'); if (!m || !SH.id) return;
    var d = cached(SH.id) || {};
    var c = d.counts || {};
    var head = SH.person
      ? '<div class="aa-shh"><button class="aa-ib" type="button" onclick="aaBack()" aria-label="Back">' + IC.back + '</button><h3>Each person</h3><button class="aa-ib" type="button" onclick="aaClose()" aria-label="Close">' + IC.x + '</button></div>'
      : '<div class="aa-shh"><span class="aa-mark" style="width:34px;height:34px;border-radius:11px">' + IC.scan + '</span><h3>Research first: each person</h3><button class="aa-ib" type="button" onclick="aaClose()" aria-label="Close">' + IC.x + '</button></div>';
    var body;
    if (SH.person) body = personHtml(SH.person);
    else {
      var tabs = [['all', 'All', (c.read || 0) + (c.waiting || 0) + (c.usual || 0) + (c.held || 0)], ['read', 'Read', c.read], ['waiting', 'Reading', c.waiting], ['usual', 'Usual text', c.usual], ['held', 'Held', c.held]];
      body = '<div class="aa-tabs" role="tablist">' + tabs.map(function (t) { return '<button class="aa-tab' + (SH.tab === t[0] ? ' on' : '') + '" role="tab" aria-selected="' + (SH.tab === t[0]) + '" type="button" onclick="aaTab(\'' + t[0] + '\')">' + t[1] + ' ' + (t[2] || 0) + '</button>'; }).join('') + '</div>' +
        '<input class="aa-q" type="search" placeholder="Find a person or company" value="' + e(SH.q) + '" oninput="aaQ(this.value)" aria-label="Find a person or company">' +
        '<div class="aa-ls" id="aaLs">' + listHtml() + '</div>' +
        (d.is_owner && d.on ? '<div class="aa-set"><label class="aa-sw"><input type="checkbox" ' + (d.config.posts ? 'checked ' : '') + 'onchange="aaSet(\'' + e(SH.id) + '\',\'posts\',this.checked)"><i></i><span>Read recent posts</span></label>' +
          '<label>Usual text after <select onchange="aaSet(\'' + e(SH.id) + '\',\'wait_days\',Number(this.value))">' + [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (d.config.wait_days === n ? ' selected' : '') + '>' + pl(n, 'working day') + '</option>'; }).join('') + '</select></label></div>' : '');
    }
    m.innerHTML = '<div class="sp-mcard aa-sh" role="dialog" aria-modal="true" aria-label="Research first">' + head + body + '</div>';
  }

  // ── People tab: one line per person ────────────────────────────────────
  if (typeof window._g31CardLine === 'function' && !window._g31CardLine._aa) {
    var baseLine = window._g31CardLine;
    window._g31CardLine = function (campId, p) {
      var out = baseLine.apply(this, arguments) || '';
      try {
        var d = cached(campId); if (!d || !d.on || !d.people || !p || !d.people[p.id]) return out;
        var x = d.people[p.id], u = x.used || {};
        var st = '<span class="aa-st ' + e(x.state) + '">' + e(STATE[x.state] || x.state) + '</span>';
        var bits = [];
        if (x.state === 'waiting') bits.push(e(WHY[x.why] || 'Reading') + (x.deadline && x.why !== 'reading' ? ', usual text after ' + e(day(x.deadline)) : ''));
        else if (x.state === 'usual') bits.push(e(WHY[x.why] || ''));
        ['invite', 'email'].forEach(function (k) { var v = u[k]; if (!v) return; bits.push('<span class="aa-pill' + (v.usual ? '' : ' g') + '">' + (k === 'invite' ? 'Note' : 'Email') + ': ' + (v.usual ? 'usual' : v.f ? e(FROM[v.from] || v.f) : 'short and honest') + '</span>'); });
        out += '<div class="aa-line">' + st + bits.join(' ') + ' <button class="aa-lk" type="button" onclick="event.stopPropagation();aaOpen(\'' + e(campId) + '\');aaPerson(\'' + e(p.id) + '\')">What SAM read</button></div>';
      } catch (_e) {}
      return out;
    };
    window._g31CardLine._aa = true;
  }
  if (typeof window._g31Load === 'function' && !window._g31Load._aa) {
    var baseLoad = window._g31Load;
    window._g31Load = async function (campId) {
      var had = !!cached(campId);
      var r = await Promise.all([baseLoad.apply(this, arguments), load(campId)]);
      var d = r[1];
      return !!r[0] || (!had && !!(d && d.on));
    };
    window._g31Load._aa = true;
  }

  // ── Review: each draft says what it was built on ───────────────────────
  if (typeof window._g18Checks === 'function' && !window._g18Checks._aa) {
    var baseChecks = window._g18Checks;
    window._g18Checks = function (x) {
      var out = baseChecks.apply(this, arguments) || '';
      try {
        if (!x || (x.launch || 1) !== 1) return out;
        var f = personAnywhere(x.contact_id); if (!f) return out;
        var u = (f.p.used || {}).email;
        if (!u) return out;
        var head = u.usual ? '<div class="aa-bo u"><b>Written the usual way.</b> <small>' + e(WHY[f.p.why] || 'Nothing on the profile to open from') + '.</small>'
          : u.f ? '<div class="aa-bo"><b>Built on what SAM read:</b> ' + e(u.t || '') + ' <small>· ' + e(FROM[u.from] || 'Profile') + '</small>'
          : '<div class="aa-bo"><b>From their profile.</b> <small>Nothing made a natural opener, so SAM kept it short and honest.</small>';
        out = head + ' <button class="aa-lk" type="button" onclick="aaOpen(\'' + e(f.camp) + '\');aaPerson(\'' + e(x.contact_id) + '\')">What SAM read</button></div>' + out;
      } catch (_e) {}
      return out;
    };
    window._g18Checks._aa = true;
  }
  if (typeof window._renderSampaignDrafts === 'function' && !window._renderSampaignDrafts._aa) {
    var baseDrafts = window._renderSampaignDrafts;
    var chip = function (campaignId, drafts) {
      var d = cached(campaignId); if (!d || !d.on) return;
      drafts.forEach(function (x) {
        var p = (d.people || {})[x.contact_id], u = p && p.used && p.used.email;
        var row = document.getElementById('g18row_' + x.id); if (!row || !u || row.querySelector('.aa-dc')) return;
        var subj = row.querySelector('.g18-subj'); if (!subj) return;
        subj.insertAdjacentHTML('afterend', '<span class="sp-chip aa-dc' + (u.usual ? '' : ' aa') + '" title="' + e(u.usual ? 'Written the usual way' : (u.t || 'From their profile')) + '">' + (u.usual ? 'Usual' : u.from === 'post' ? 'From their post' : 'From profile') + '</span>');
      });
    };
    window._renderSampaignDrafts = function (campaignId, drafts) {
      var html = baseDrafts.apply(this, arguments);
      try {
        if (drafts && drafts.length && (drafts[0].launch || 1) === 1) {
          setTimeout(function () {
            if (cached(campaignId)) chip(campaignId, drafts);
            else load(campaignId).then(function (d) { if (d && d.on) { chip(campaignId, drafts); } });
          }, 0);
        }
      } catch (_e) {}
      return html;
    };
    window._renderSampaignDrafts._aa = true;
  }

  // ── The bell knows this kind ───────────────────────────────────────────
  window._aaReady = true;
})();
