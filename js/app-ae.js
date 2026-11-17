// SamoraOS app: Drop AE (17 Nov 2026). Professor SAM, Usage, morning
// invites, the Chrome plugin in one click.
//   1. Professor SAM: one tip at a time, with the number, where it comes from
//      ("Why?"), and one action. On a SAMpaign, in Review and on Today.
//   2. Usage: today, this week and this month, with percentages and when each
//      resets, and the sending limits (email per mailbox, LinkedIn).
//   3. Morning invites: the switch under the invite step.
//   4. "Add Samora to Chrome": the store page in a small window; Samora sees
//      the plugin arrive and connects it.
// Loaded after app-ad.js.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function call(action, body) { return _sampEdge(action, body || {}); }
  function toast(m) { try { showToast(m); } catch (_e) {} }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function senderName() { try { return (currentUser && currentUser.user_metadata && currentUser.user_metadata.full_name) || ''; } catch (_e) { return ''; } }
  var IC = {
    bulb: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.6 10.8c.7.6 1.1 1.3 1.1 2.2v.5h5v-.5c0-.9.4-1.6 1.1-2.2A6 6 0 0012 3z"/></svg>',
    x: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    spark: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    ext: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
    chrome: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><path d="M12 8.6h8.4M9.1 13.7L4.9 6.4M14.9 13.7l-4.2 7.3"/></svg>'
  };

  (function css() {
    if (document.getElementById('aeCss')) return;
    var st = document.createElement('style'); st.id = 'aeCss';
    st.textContent = [
      // Professor SAM
      '.ae-pf{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:12px;align-items:start;margin:0 0 14px;padding:14px 16px;border-radius:16px;border:1px solid rgba(var(--c-accent-rgb),.32);background:linear-gradient(135deg,rgba(var(--c-accent-rgb),.09),rgba(var(--c-accent-rgb),.02) 70%),var(--g-fill-strong,var(--surface))}',
      '.ae-pfi{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;color:#2a1d05;background:linear-gradient(135deg,#B8860B,#E8B84B 55%,#C8961E)}',
      '.ae-pfk{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-accent-text,var(--gold))}',
      '.ae-pft{font-size:14.5px;font-weight:650;color:var(--text);margin-top:2px;line-height:1.4}.ae-pfb{font-size:13px;color:var(--text2);line-height:1.5;margin-top:3px}',
      '.ae-pfa{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px}',
      '.ae-lk{all:unset;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--c-accent-text,var(--gold))}.ae-lk:hover{text-decoration:underline}.ae-lk.q{color:var(--text3);font-weight:500}',
      '.ae-lk:focus-visible,.ae-x:focus-visible{outline:2px solid var(--c-focus,var(--gold));outline-offset:2px;border-radius:4px}',
      '.ae-x{all:unset;cursor:pointer;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:var(--text3)}.ae-x:hover{background:rgba(127,127,127,.1);color:var(--text)}',
      '.ae-why{margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(127,127,127,.06);font-size:12.5px;line-height:1.5;color:var(--text2)}.ae-why div+div{margin-top:6px}.ae-why b{color:var(--text);font-weight:600}.ae-why a{color:var(--c-accent-text,var(--gold));text-decoration:none}.ae-why a:hover{text-decoration:underline}',
      '.ae-exp{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.ae-ex{font-size:12px;padding:4px 10px;border-radius:999px;background:rgba(127,127,127,.08);color:var(--text2)}.ae-ex b{color:var(--text);font-weight:650}',
      '@media (max-width:640px){.ae-pf{grid-template-columns:34px minmax(0,1fr) auto;padding:12px}.ae-pfi{width:34px;height:34px}}',
      // Usage
      '.ae-us h4{margin:18px 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);display:flex;align-items:center;gap:8px}.ae-us h4:first-child{margin-top:4px}.ae-us h4 small{margin-left:auto;font-size:11.5px;letter-spacing:0;text-transform:none;font-weight:500}',
      '.ae-m{padding:10px 0;border-top:1px solid var(--g-line,var(--border))}.ae-m:first-of-type{border-top:0}',
      '.ae-mh{display:flex;align-items:baseline;gap:8px;font-size:13.5px;color:var(--text)}.ae-mh span{flex:1;min-width:0}.ae-mh b{font-weight:650;font-variant-numeric:tabular-nums}.ae-mh b small{font-weight:500;color:var(--text3)}',
      '.ae-mb{height:7px;border-radius:999px;background:rgba(127,127,127,.14);overflow:hidden;margin-top:7px}.ae-mb i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#B8860B,#E8B84B)}',
      '.ae-m.near .ae-mb i{background:var(--c-partial,#c98a0b)}.ae-m.full .ae-mb i{background:var(--c-risk,#c0392b)}',
      '.ae-ms{font-size:12px;color:var(--text3);margin-top:5px;font-variant-numeric:tabular-nums}.ae-m.full .ae-ms{color:var(--c-risk,#c0392b)}',
      '.ae-off{font-size:12.5px;color:var(--text3);padding:8px 0}',
      '.ae-wk{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;align-items:end;height:92px;padding:6px 0 0;margin-bottom:10px}.ae-wk div{display:flex;flex-direction:column;align-items:center;gap:5px;height:100%;justify-content:flex-end}.ae-wk i{display:block;width:100%;max-width:34px;border-radius:6px 6px 2px 2px;background:rgba(var(--c-accent-rgb),.35)}.ae-wk div.t i{background:linear-gradient(180deg,#E8B84B,#B8860B)}.ae-wk span{font-size:11px;color:var(--text3)}.ae-wk em{font-style:normal;font-size:11px;color:var(--text2);font-variant-numeric:tabular-nums}',
      '.ae-sw{display:flex;align-items:flex-start;gap:10px;margin-top:12px;font-size:12.5px;color:var(--text2);line-height:1.45;cursor:pointer}.ae-sw input{margin-top:2px;accent-color:#B8860B}',
      '.ae-plan{display:inline-flex;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:999px;color:#241C05;background:linear-gradient(135deg,#B8860B,#E8B84B,#C8961E)}',
      '.ae-usm{max-width:620px!important}',
      // Morning switch and plugin
      '.ae-morn{display:flex;gap:8px;align-items:flex-start;margin-top:6px;font-size:12px;color:var(--text2);cursor:pointer;line-height:1.4}.ae-morn input{margin-top:1px;accent-color:#B8860B}',
      '.ae-add{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 16px;border-radius:14px;border:1px solid rgba(var(--c-accent-rgb),.32);background:rgba(var(--c-accent-rgb),.06);margin:12px 0}.ae-add .sp-small{flex:1;min-width:200px}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  // ══ 1. Professor SAM ═══════════════════════════════════════════════════
  var CO = window._aeCoach = window._aeCoach || { cache: {}, seen: {}, tips: {} };
  async function coachLoad(key, body, force) {
    var c = CO.cache[key];
    if (c && !force && Date.now() - c.at < 60000) return c.d;
    var d = await call('get_coach', body).catch(function () { return null; });
    CO.cache[key] = { at: Date.now(), d: d };
    return d;
  }
  function evHtml(tip) {
    var ev = tip.evidence || [];
    if (!ev.length) return '<div class="ae-why">This comes from your own numbers in Samora.</div>';
    return '<div class="ae-why">' + ev.map(function (x) { return '<div><b>' + e(x.claim) + '</b><br>' + (x.url ? '<a href="' + e(x.url) + '" target="_blank" rel="noopener">' + e(x.source) + ' ' + IC.ext + '</a>' : e(x.source)) + '</div>'; }).join('') + '</div>';
  }
  function expHtml(x) {
    if (!x) return '';
    var bits = [];
    if (x.linkedin) bits.push('<span class="ae-ex">LinkedIn: <b>' + x.linkedin.accept[0] + '% to ' + x.linkedin.accept[1] + '%</b> accept, <b>' + x.linkedin.reply[0] + '% to ' + x.linkedin.reply[1] + '%</b> of them reply</span>');
    if (x.email) bits.push('<span class="ae-ex">Email: <b>' + x.email.rate + '%</b> reply in your SAMpaigns, last 90 days (' + x.email.people + ' people)</span>');
    if (!bits.length) return '';
    return '<div class="ae-exp" title="Ranges from published benchmarks until your own numbers are enough to trust">' + bits.join('') + '</div>';
  }
  function cardHtml(key, tip, x) {
    CO.tips[tip.id] = { tip: tip, key: key };
    return '<div class="ae-pf" data-tip="' + e(tip.id) + '"><span class="ae-pfi">' + IC.bulb + '</span><div style="min-width:0"><div class="ae-pfk">Professor SAM</div><div class="ae-pft">' + e(tip.title) + '</div><div class="ae-pfb">' + e(tip.body) + '</div>' +
      expHtml(x) +
      '<div class="ae-pfa">' + (tip.action && tip.action.kind !== 'none' ? '<button class="g24-btn gold sm" type="button" onclick="aeAct(\'' + e(tip.id) + '\',this)">' + IC.spark + e(tip.action.label) + '</button>' : '<button class="g24-btn ghost sm" type="button" onclick="aeDismiss(\'' + e(tip.id) + '\')">' + e((tip.action && tip.action.label) || 'Got it') + '</button>') +
        '<button class="ae-lk" type="button" aria-expanded="false" onclick="aeWhy(this)">Why?</button><button class="ae-lk q" type="button" onclick="aeSnooze(\'' + e(tip.id) + '\')">Not now</button></div>' +
      '<div class="ae-whyw" hidden>' + evHtml(tip) + '</div></div>' +
      '<button class="ae-x" type="button" aria-label="Dismiss this tip" onclick="aeDismiss(\'' + e(tip.id) + '\')">' + IC.x + '</button></div>';
  }
  function paint(el, key, d) {
    if (!el) return;
    if (!d || !d.ok || (!d.tip && !(d.expected && (d.expected.linkedin || d.expected.email)))) { el.innerHTML = ''; return; }
    var tip = d.tip;
    if (!tip && key.indexOf('campaign:') === 0) {
      // Seen here and nowhere else: LinkedIn steps with no plugin in this Chrome.
      var cid = key.slice(9), o = (window._sampOv || {})[cid];
      var liOn = o && o.campaign && o.campaign.channels && o.campaign.channels.linkedin && o.campaign.channels.linkedin.on;
      if (liOn && typeof _liExtVersion === 'function' && !_liExtVersion() && !CO.local_off) tip = { id: 'plugin_missing', title: 'Add Samora to Chrome to run the LinkedIn steps.', body: 'The visits, invites and messages go from the Samora plugin while Chrome is open. Adding it takes two clicks.', evidence: [], action: { kind: 'install_plugin', label: 'Add Samora to Chrome' }, local: true };
    }
    if (!tip) { el.innerHTML = ''; return; }
    el.innerHTML = cardHtml(key, tip, key.indexOf('campaign:') === 0 ? d.expected : null);
    if (!CO.seen[tip.id] && !tip.local) { CO.seen[tip.id] = 1; call('coach_event', { tip_id: tip.id, event: 'shown' }).catch(function () {}); }
  }
  function slot(id, anchor, where) {
    var el = document.getElementById(id);
    if (el) return el;
    if (!anchor) return null;
    el = document.createElement('div'); el.id = id; el.className = 'ae-slot';
    anchor.insertAdjacentElement(where || 'afterend', el);
    return el;
  }
  async function coachCampaign(cid) {
    var a = document.getElementById('sampGuide_' + cid); if (!a) return;
    var el = slot('aeCoach_' + cid, a, 'afterend');
    var d = await coachLoad('campaign:' + cid, { surface: 'campaign', campaign_id: cid });
    paint(el, 'campaign:' + cid, d);
  }
  async function coachReview(cid, launch) {
    var q = document.getElementById('sampSendQueue'); if (!q) return;
    var el = slot('aeCoachRv_' + cid, q, 'beforebegin');
    var d = await coachLoad('review:' + cid + ':' + launch, { surface: 'review', campaign_id: cid, launch: launch });
    paint(el, 'review:' + cid + ':' + launch, d);
  }
  async function coachToday() {
    var b = document.getElementById('g24Brief'); if (!b) return;
    var el = slot('aeCoachToday', b, 'afterend');
    try { if (typeof _g24IsToday === 'function' && !_g24IsToday()) { el.innerHTML = ''; return; } } catch (_e) {}
    var d = await coachLoad('today', { surface: 'today' });
    paint(el, 'today', d);
  }
  window.aeCoachRefresh = function () { CO.cache = {}; };
  function hideTip(id) { document.querySelectorAll('.ae-pf[data-tip="' + id + '"]').forEach(function (n) { if (n.parentNode) n.parentNode.innerHTML = ''; }); var t = CO.tips[id]; if (t) delete CO.cache[t.key]; }
  window.aeWhy = function (btn) { var w = btn.closest('.ae-pf').querySelector('.ae-whyw'); if (!w) return; w.hidden = !w.hidden; btn.setAttribute('aria-expanded', String(!w.hidden)); };
  window.aeDismiss = function (id) { var t = CO.tips[id]; hideTip(id); if (t && t.tip.local) { CO.local_off = true; return; } call('coach_event', { tip_id: id, event: 'dismissed' }).catch(function () {}); };
  window.aeSnooze = function (id) { var t = CO.tips[id]; hideTip(id); if (t && t.tip.local) { CO.local_off = true; return; } call('coach_event', { tip_id: id, event: 'snoozed' }).catch(function () {}); };
  window.aeQuiet = async function (on) { await call('coach_event', { event: on ? 'quiet' : 'unquiet' }); CO.cache = {}; toast(on ? 'Professor SAM will stay quiet. Turn it back on in Usage.' : 'Professor SAM is back.'); };
  window.aeAct = async function (id, btn) {
    var t = CO.tips[id]; if (!t) return;
    var tip = t.tip, a = tip.action || {}, key = t.key, cid = key.split(':')[1];
    if (btn) btn.disabled = true;
    var done = true;
    try {
      if (a.kind === 'li_first') {
        await spSeqEdit(cid);
        setTimeout(function () { try { _spSeqUseTpl('li_first'); } catch (_e) {} }, 400);
        toast('LinkedIn first is set below. Check the days, then Save.');
      } else if (a.kind === 'add_li_followups') {
        // Through the sequence when it has one, so the builder shows them too.
        var oS = (window._sampOv || {})[cid], chS = oS && oS.campaign && oS.campaign.channels || {};
        var r = Array.isArray(chS.steps) && chS.steps.length && chS.start_date
          ? await call('set_sampaign_sequence', { campaign_id: cid, start_date: chS.start_date, steps: chS.steps.map(function (x) { return x.kind === 'message' ? { kind: 'message', after: Number(x.after) || 0 } : { kind: x.kind, day: Number(x.day) || 1 }; }).concat([{ kind: 'message', after: 4 }, { kind: 'message', after: 7 }]) })
          : await call('set_sampaign_linkedin', { campaign_id: cid, followups: [4, 7] });
        if (!r.ok) { done = false; toast(r.error || 'Could not add them.'); }
        else { toast('Two LinkedIn follow-ups added: 4 and 7 working days after the message. They stop when someone replies.'); try { await _sampLoadOverview(cid); } catch (_e) {} }
      } else if (a.kind === 'research_on') {
        if (typeof window.acRsToggle === 'function') await window.acRsToggle(cid, true, null); else if (typeof window.aaToggle === 'function') await window.aaToggle(cid, true, null);
      } else if (a.kind === 'rewrite') {
        var name = senderName();
        var w = await window.xWriteStart({ campaign_id: cid, kind: 'email', launch: a.launch || 1, mode: 'rewrite', which: 'drafts', instruction: a.instruction || '', contact_ids: a.contact_ids || [], sender_name: name.split(' ')[0] || '', sender_full_name: name });
        if (!w || !w.ok) { done = false; toast((w && w.error) || 'SAM could not start.'); }
        else toast('SAM is rewriting ' + pl((a.contact_ids || []).length, 'email') + ' in place. Same send time if any were queued.');
      } else if (a.kind === 'open_usage') { window.aeUsageOpen(); }
      else if (a.kind === 'open_safety') { try { switchTab('you'); } catch (_e) {} toast('Send safety is in You, under your mailbox.'); }
      else if (a.kind === 'install_plugin') { window.aeAddPlugin(); }
    } catch (err) { done = false; toast('Could not do that: ' + (err && err.message || err)); }
    if (btn) btn.disabled = false;
    if (done) { hideTip(id); if (!tip.local) call('coach_event', { tip_id: id, event: 'acted' }).catch(function () {}); }
  };

  // Mount points.
  if (typeof window._spGuideRender === 'function' && !window._spGuideRender._ae) {
    var baseGuide = window._spGuideRender;
    _spGuideRender = window._spGuideRender = function (id) { var r = baseGuide.apply(this, arguments); try { coachCampaign(id); } catch (_e) {} return r; };
    window._spGuideRender._ae = true;
  }
  if (typeof window._renderSampaignDrafts === 'function' && !window._renderSampaignDrafts._ae) {
    var baseDr = window._renderSampaignDrafts;
    window._renderSampaignDrafts = function (campaignId, drafts) {
      var h = baseDr.apply(this, arguments);
      try { var L = drafts && drafts.length ? (drafts[0].launch || 1) : 0; if (L) setTimeout(function () { coachReview(campaignId, L); }, 0); } catch (_e) {}
      return h;
    };
    window._renderSampaignDrafts._ae = true;
  }
  if (typeof window.g24RenderBrief === 'function' && !window.g24RenderBrief._ae) {
    var baseBrief = window.g24RenderBrief;
    g24RenderBrief = window.g24RenderBrief = function () { var r = baseBrief.apply(this, arguments); try { coachToday(); } catch (_e) {} return r; };
    window.g24RenderBrief._ae = true;
  }

  // ══ 2. Usage ═══════════════════════════════════════════════════════════
  function left(iso) {
    var ms = Date.parse(iso) - Date.now(); if (!(ms > 0)) return 'soon';
    var h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60000);
    if (h >= 48) return 'in ' + Math.round(h / 24) + ' days';
    return 'in ' + (h ? h + ' h ' : '') + m + ' min';
  }
  function meter(label, used, cap, resetIso, unit) {
    if (!cap) return '<div class="ae-m off"><div class="ae-mh"><span>' + e(label) + '</span><b><small>Not on your plan</small></b></div></div>';
    var pct = Math.min(100, Math.round(used / cap * 100)), tone = pct >= 100 ? ' full' : pct >= 80 ? ' near' : '';
    var sub = pct >= 100 ? 'Used up. ' + (resetIso ? 'Starts again ' + left(resetIso) + '.' : '') : (100 - pct) + '% left' + (resetIso ? ' · resets ' + left(resetIso) : '');
    return '<div class="ae-m' + tone + '"><div class="ae-mh"><span>' + e(label) + '</span><b>' + used + ' <small>of ' + cap + (unit ? ' ' + e(unit) : '') + '</small></b></div>' +
      '<div class="ae-mb" role="progressbar" aria-label="' + e(label) + '" aria-valuemin="0" aria-valuemax="' + cap + '" aria-valuenow="' + used + '"><i style="width:' + pct + '%"></i></div><div class="ae-ms">' + e(sub) + '</div></div>';
  }
  function usageHtml(d) {
    if (!d || !d.ok) return '<div class="sp-small">Could not load your usage just now.</div>';
    var ks = d.kinds || [];
    var on = ks.filter(function (k) { return k.cap; }), offK = ks.filter(function (k) { return !k.cap; });
    var mon = ks.filter(function (k) { return k.month_cap; });
    var max = Math.max.apply(null, (d.by_day || []).map(function (x) { return x.total; }).concat([1]));
    var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var wk = '<div class="ae-wk" role="img" aria-label="' + e('SAM\'s work by day, last seven days: ' + (d.by_day || []).map(function (x) { return x.total; }).join(', ')) + '">' + (d.by_day || []).map(function (x, i) {
      var dw = days[(new Date(x.day + 'T12:00:00Z').getUTCDay() + 6) % 7];
      return '<div class="' + (i === 6 ? 't' : '') + '"><em>' + x.total + '</em><i style="height:' + Math.max(4, Math.round(x.total / max * 60)) + 'px"></i><span>' + (i === 6 ? 'Today' : dw) + '</span></div>';
    }).join('') + '</div>';
    var s = d.sending || {}, em = s.email || {}, li = s.linkedin || {};
    var nextMon = (function () { var t = new Date(); var add = (8 - (t.getDay() || 7)) % 7 || 7; t.setDate(t.getDate() + add); t.setHours(0, 0, 0, 0); return t.toISOString(); })();
    return '<div class="ae-us">' +
      '<h4>Today' + (d.plan ? ' <span class="ae-plan">' + e(d.plan) + '</span>' : '') + '<small>Resets ' + e(left(d.reset_at)) + '</small></h4>' +
      on.map(function (k) { return meter(k.label, k.today, k.cap, d.reset_at); }).join('') +
      (offK.length ? '<div class="ae-off">Not on your plan: ' + e(offK.map(function (k) { return k.label; }).join(', ')) + '.</div>' : '') +
      '<h4>This week<small>' + e(pl((d.by_day || []).reduce(function (a, x) { return a + x.total; }, 0), 'thing SAM did', 'things SAM did')) + ' in seven days</small></h4>' + wk +
      '<h4>This month<small>Resets ' + e(left(d.month_reset)) + '</small></h4>' +
      (mon.length ? mon.map(function (k) { return meter(k.label, k.month, k.month_cap, d.month_reset); }).join('') : '') +
      '<div class="ae-off">' + e(ks.filter(function (k) { return k.month; }).map(function (k) { return k.label + ': ' + k.month; }).join(' · ') || 'Nothing used yet this month.') + '</div>' +
      '<h4>Sending<small>Kept low to protect your mailbox and LinkedIn</small></h4>' +
      meter('Emails from your mailbox today', em.sent_today || 0, em.cap || 0, d.reset_at) +
      meter('LinkedIn invites today', li.invites_today || 0, li.invite_cap || 0, d.reset_at) +
      meter('LinkedIn invites this week', li.invites_week || 0, li.weekly_cap || 0, nextMon, li.plan ? '(' + li.plan + ')' : '') +
      meter('LinkedIn messages today', li.messages_today || 0, li.message_cap || 0, d.reset_at) +
      '<label class="ae-sw"><input type="checkbox" ' + (li.morning !== false ? 'checked ' : '') + 'onchange="aeMorning(this.checked)"><span><b>Invites first in their morning.</b> Between 7 and 11 am where they are, whenever Chrome is open. Never waits past today.</span></label>' +
      '<label class="ae-sw"><input type="checkbox" ' + (CO.quiet ? '' : 'checked ') + 'onchange="aeQuiet(!this.checked)"><span><b>Professor SAM.</b> One tip at a time, with where the numbers come from.</span></label>' +
      '<div class="sp-small" style="margin-top:14px">Limits come from your plan and your admin, who can lower them for the team in Team &amp; access, Usage. To raise them, ask Samora.</div></div>';
  }
  window.aeUsageLoad = function () { return call('get_usage_page', {}).catch(function () { return null; }); };
  if (typeof window.g19RenderYouUsage === 'function' && !window.g19RenderYouUsage._ae) {
    g19RenderYouUsage = window.g19RenderYouUsage = async function () {
      var box = document.getElementById('youUsageBody'), chip = document.getElementById('youUsageChip');
      if (!box) return;
      box.innerHTML = '<div class="admin-card" style="margin-bottom:0"><div class="sp-small">Loading…</div></div>';
      var d = await window.aeUsageLoad();
      var near = d && d.ok ? (d.kinds || []).filter(function (k) { return k.cap && k.today / k.cap >= 0.8; }).length : 0;
      if (chip) chip.textContent = near ? near + ' near the limit' : 'Today, week, month';
      box.innerHTML = '<div class="admin-card" style="margin-bottom:0">' + usageHtml(d) + '</div>';
    };
    window.g19RenderYouUsage._ae = true;
  }
  window.aeUsageOpen = async function () {
    var m = document.getElementById('aeUsage');
    if (!m) { m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'aeUsage'; m.addEventListener('click', function (ev) { if (ev.target === m) m.remove(); }); document.body.appendChild(m); }
    m.innerHTML = '<div class="sp-mcard ae-usm" role="dialog" aria-modal="true" aria-label="Usage"><div style="display:flex;align-items:center;gap:10px"><h3 style="margin:0;flex:1">Usage</h3><button class="ae-x" type="button" aria-label="Close" onclick="document.getElementById(\'aeUsage\').remove()">' + IC.x + '</button></div><div id="aeUsageIn"><div class="sp-small" style="margin-top:12px">Loading…</div></div></div>';
    var d = await window.aeUsageLoad();
    var inEl = document.getElementById('aeUsageIn'); if (inEl) inEl.innerHTML = usageHtml(d);
  };
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { var m = document.getElementById('aeUsage'); if (m) m.remove(); } });

  // ══ 3. Morning invites ═════════════════════════════════════════════════
  window._aeMorning = window._aeMorning === undefined ? null : window._aeMorning;
  window.aeMorning = async function (on) {
    var d = await call('set_li_morning', { on: !!on });
    window._aeMorning = d && d.ok ? d.on : !!on;
    toast(window._aeMorning ? 'Invites go first in their morning when Chrome is open. Never held past today.' : 'Invites go in the usual order.');
  };
  if (typeof window._spSeqRow === 'function' && !window._spSeqRow._ae) {
    var baseRow = window._spSeqRow;
    _spSeqRow = window._spSeqRow = function (S, s, i, pos) {
      var h = baseRow.apply(this, arguments);
      if (s.kind !== 'invite') return h;
      if (window._aeMorning === null) { window._aeMorning = true; call('set_li_morning', {}).then(function (d) { if (d && d.ok && d.on === false) { window._aeMorning = false; try { _spSeqRender(); } catch (_e) {} } }); }
      var sw = '<label class="ae-morn"><input type="checkbox" ' + (window._aeMorning !== false ? 'checked ' : '') + 'onchange="aeMorning(this.checked)"><span>First in their morning, 7 to 11 am, when Chrome is open. Never waits past today.</span></label>';
      return h.replace('</div></div><label class="sp-dayin', '</div>' + sw + '</div><label class="sp-dayin');
    };
    window._spSeqRow._ae = true;
  }

  // ══ 4. Add Samora to Chrome ════════════════════════════════════════════
  var STORE = { url: (typeof LI_STORE_URL === 'string' && LI_STORE_URL) || null, asked: false };
  async function storeUrl() {
    if (STORE.url || STORE.asked) return STORE.url;
    STORE.asked = true;
    var d = await call('get_plugin_info', {}).catch(function () { return null; });
    if (d && d.ok && d.store_url) { STORE.url = d.store_url; try { LI_STORE_URL = d.store_url; } catch (_e) {} }
    else if (!d || !d.ok) STORE.asked = false;
    return STORE.url;
  }
  function chromeOk() { var ua = navigator.userAgent || ''; return /Chrome\/|Edg\/|Brave/.test(ua) && !/Mobile|Android|iPhone|iPad/.test(ua); }
  window.aeAddPlugin = async function () {
    if (!chromeOk()) { toast('Open Samora on a computer with Chrome, Edge or Brave to add the plugin.'); return; }
    if (typeof _liExtVersion === 'function' && _liExtVersion()) { try { liConnect(); } catch (_e) {} return; }
    var url = await storeUrl();
    if (!url) { try { _liSheet(_liInstallHtml()); } catch (_e) {} return; }
    var w = window.open(url, 'samoraStore', 'width=1100,height=820');
    toast('Press "Add to Chrome" in the store window. Samora connects as soon as it is added.');
    var t0 = Date.now();
    (function poll() {
      if (typeof _liExtVersion === 'function' && _liExtVersion()) { try { if (w && !w.closed) w.close(); } catch (_e) {} toast('Samora for LinkedIn is added. Connecting…'); try { liConnect(true); } catch (_e) {} return; }
      if (Date.now() - t0 > 180000) return;
      setTimeout(poll, 1000);
    })();
  };
  if (typeof window._liInstallHtml === 'function' && !window._liInstallHtml._ae) {
    var baseInst = window._liInstallHtml;
    _liInstallHtml = window._liInstallHtml = function (extra) {
      var h = baseInst.apply(this, arguments);
      if (!STORE.url) { storeUrl(); return h; }
      if (h.indexOf('ae-add') !== -1) return h;
      var add = '<div class="ae-add"><button class="g-btn sp-gold" type="button" onclick="aeAddPlugin()">' + IC.chrome + ' Add Samora to Chrome</button><span class="sp-small">Opens the Chrome Web Store on the right page. Press "Add to Chrome" there; Samora connects by itself.</span></div>';
      h = h.replace(/<div class="li-store">[\s\S]*?<\/div><div class="li-or">[^<]*<\/div>/, '')
      return h.replace(/(<div class="li-hd">[\s\S]*?<\/div><\/div>)/, '$1' + add + '<div class="li-or">or install it from a file</div>');
    };
    window._liInstallHtml._ae = true;
  }
  setTimeout(function () { try { if (typeof currentUser !== 'undefined' && currentUser && currentUser.token) storeUrl(); } catch (_e) {} }, 2000);
  window._aeReady = true;
})();
