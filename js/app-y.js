// SamoraOS app: Drop Y (5 Nov 2026). Conversations become deals.
//   1. Today: every live deal is on it, paused SAMpaign or not, in the right
//      list: a call today, a proposal to send or a go-ahead to close (Needs
//      you), an answer or a nudge (SAM can do these), what SAM is watching
//      and what it moved in Pipeline, with Undo (Running on its own).
//   2. A call today has its prep one click away: where it stands, what they
//      asked, the proof, and what to come out of the call with.
//   3. Everyone else at that company waits, with one-click Resume.
//   4. Each SAMpaign shows its companies from conversation to deal:
//      Evaluating, Commercial, Won. SAMpaigns home counts them all.
// Loaded after app-x.js.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function call(action, body) { return _sampEdge(action, body || {}); }
  function toast(m) { try { showToast(m); } catch (_e) {} }
  function day(iso) { var d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function time(iso) { var d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(':00', ''); }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  var IC = {
    cal: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/></svg>',
    undo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>',
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 5l11 7-11 7z"/></svg>',
    won: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
    pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>'
  };

  (function css() {
    if (document.getElementById('yCss')) return;
    var st = document.createElement('style'); st.id = 'yCss';
    st.textContent = [
      '.y-ph{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:650;letter-spacing:.02em;padding:3px 9px;border-radius:999px;vertical-align:1px;margin-right:6px;white-space:nowrap}',
      '.y-ph.evaluation{background:var(--c-partial-wash);color:var(--c-partial)}',
      '.y-ph.commercial{background:rgba(var(--c-accent-rgb),.14);color:var(--c-accent-text)}',
      '.y-ph.won{background:var(--c-verified-wash);color:var(--c-verified)}',
      '.y-ph.lost{background:var(--c-risk-wash);color:var(--c-risk)}',
      '.y-ph.hold{background:rgba(127,127,127,.1);color:var(--text2)}',
      '.y-ph i{width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block}',
      // the funnel on a SAMpaign
      '.y-fn{margin:0 0 14px;padding:16px 18px;border-radius:16px;border:1px solid var(--g-line,var(--border));background:var(--surface)}',
      '.y-fn-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.y-fn-h h4{margin:0;font-size:15px;font-weight:650;color:var(--text)}.y-fn-h small{color:var(--text3);font-size:12.5px}',
      '.y-steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:14px 0 4px}',
      '.y-step{position:relative;padding:10px 12px;border-radius:12px;background:rgba(127,127,127,.06)}',
      '.y-step b{display:block;font-size:22px;line-height:1.1;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums}',
      '.y-step span{font-size:12px;color:var(--text3)}',
      '.y-step.evaluation{background:var(--c-partial-wash)}.y-step.evaluation b{color:var(--c-partial)}',
      '.y-step.commercial{background:rgba(var(--c-accent-rgb),.12)}.y-step.commercial b{color:var(--c-accent-text)}',
      '.y-step.won{background:var(--c-verified-wash)}.y-step.won b{color:var(--c-verified)}',
      '.y-step.zero b{opacity:.45}',
      '.y-cos{list-style:none;margin:12px 0 0;padding:0}',
      '.y-co{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--g-line,var(--border))}',
      '.y-co .y-ph{min-width:104px;justify-content:center}.y-co .y-cm{flex:1;min-width:0}.y-co .y-cm b{font-weight:650;color:var(--text)}.y-co .y-cm small{display:block;color:var(--text3);font-size:12.5px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.y-note{font-size:12.5px;color:var(--text3);margin-top:10px;display:flex;align-items:center;gap:6px}',
      '@media (max-width:640px){.y-steps{grid-template-columns:repeat(3,minmax(0,1fr))}.y-steps .y-step.rp,.y-steps .y-step.mt{display:none}.y-co{flex-wrap:wrap}}',
      // the call prep
      '.y-prep{max-width:560px}.y-prep h5{margin:16px 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);font-weight:650}',
      '.y-prep .y-when{display:flex;align-items:center;gap:8px;color:var(--text2);font-size:13.5px;margin-top:4px}',
      '.y-prep ul{margin:0;padding:0;list-style:none}.y-prep ul li{padding:7px 0 7px 12px;border-left:2px solid var(--g-line,var(--border));font-size:13px;color:var(--text2);line-height:1.5}',
      '.y-prep ul li span{color:var(--text3);white-space:nowrap}',
      '.y-prep .y-ask{padding:10px 12px;border-radius:10px;background:rgba(var(--c-accent-rgb),.08);color:var(--text);font-size:13.5px;line-height:1.5}',
      '.y-prep ol{margin:0;padding-left:18px;font-size:13.5px;color:var(--text);line-height:1.6}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  function phasePill(ph, label) { return ph ? '<span class="y-ph ' + e(ph) + '"><i></i>' + e(label || ph) + '</span>' : ''; }
  function reloadToday() { try { if (typeof tdSampLoad === 'function') tdSampLoad(true); } catch (_e) {} }
  function findItem(key) { try { return (_g24Items() || []).find(function (x) { return x.key === key; }) || null; } catch (_e) { return null; } }

  // ── 1. Today: the phase on each deal row, and its own buttons ───────────
  if (typeof _g24Row === 'function' && !_g24Row._y) {
    var row0 = _g24Row;
    _g24Row = function (x) {
      var h = row0.apply(this, arguments);
      var t = x && x.t; if (!t) return h;
      var st = window._g24.st[x.key];
      if (st && st.phase !== 'error') return h;
      var btns = '';
      if (t.deal && t.key.indexOf('deal_') === 0) {
        h = h.replace('<div class="g24-rt">', '<div class="g24-rt">' + phasePill(t.deal.phase, t.deal.phase_label));
        if (t.next_kind === 'meeting_today' || t.next_kind === 'meeting') btns += '<button class="g24-btn ' + (t.next_kind === 'meeting_today' ? 'gold' : 'ghost') + ' sm" type="button" onclick="yPrep(\'' + e(x.key) + '\')">' + IC.cal + 'Prep for the call</button>';
        if (t.next_kind === 'close' && t.deal.account_id) btns += '<button class="g24-btn gold sm" type="button" onclick="yWon(\'' + e(x.key) + '\',this)">' + IC.won + 'Mark it won</button>';
      }
      if (t.move) {
        h = h.replace('<div class="g24-rt">', '<div class="g24-rt">' + phasePill(t.deal && t.deal.phase, t.deal && t.deal.phase_label));
        btns += '<button class="g24-btn ghost sm" type="button" onclick="yUndo(\'' + e(x.key) + '\',this)">' + IC.undo + 'Undo</button>';
      }
      if (t.hold) {
        h = h.replace('<div class="g24-rt">', '<div class="g24-rt"><span class="y-ph hold">' + IC.pause + 'On hold</span>');
        btns += '<button class="g24-btn ' + (t.tone === 'do' ? 'gold' : 'ghost') + ' sm" type="button" onclick="yResume(\'' + e(x.key) + '\',this)">' + IC.play + (t.hold.people.length > 1 ? 'Resume all ' + t.hold.people.length : 'Resume') + '</button>';
      }
      if (btns) h = h.replace('<div class="g24-ra">', '<div class="g24-ra">' + btns);
      return h;
    };
    _g24Row._y = true;
  }

  window.yUndo = async function (key, btn) {
    var x = findItem(key); if (!x || !x.t.deal) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Undoing…'; }
    var r = await call('undo_deal_move', { contact_id: x.t.deal.contact_id });
    toast(r.ok ? r.note : (r.error || 'Could not undo that.'));
    reloadToday();
  };
  window.yResume = async function (key, btn) {
    var x = findItem(key); if (!x || !x.t.hold) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Resuming…'; }
    var r = await call('release_account_hold', { key: x.t.hold.key });
    toast(r.ok ? r.note : (r.error || 'Could not resume them.'));
    reloadToday();
  };
  window.yWon = async function (key, btn) {
    var x = findItem(key); if (!x || !x.t.deal || !x.t.deal.account_id) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var r = await call('close_opportunity', { opportunity_id: x.t.deal.account_id, status: 'won' });
    if (r && r.error) { toast(r.error); if (btn) { btn.disabled = false; btn.textContent = 'Mark it won'; } return; }
    toast((x.t.deal.company || 'The deal') + ' is won. Well done. Add the final value in Pipeline.');
    reloadToday();
  };

  // ── 2. The call prep ───────────────────────────────────────────────────
  var GOAL = {
    meeting_booked: ['Find out what made them take the call, and who else decides.', 'Agree one clear next step with a date.'],
    meeting_held: ['Agree the next step you left open last time.', 'Confirm who else needs to see it.'],
    proposal_requested: ['Check what the proposal must cover before you send it.', 'Agree when they will decide.'],
    proposal_sent: ['Walk them through the proposal and hear their concerns.', 'Agree the pilot scope and a start date.'],
    negotiation: ['Answer their questions on cost, setup and the pilot, plainly.', 'Agree the pilot terms: scope, people, length, success measure.', 'Leave with a date to start, and what you need from them.'],
    committed: ['Confirm the paperwork and who signs.', 'Set the kick-off date.']
  };
  window.yPrep = function (key) {
    var x = findItem(key); if (!x || !x.t.deal) return;
    var t = x.t, dl = t.deal, m = t.meeting || {};
    var first = String(dl.name || 'them').split(' ')[0];
    var ev = (dl.evidence || []).slice().reverse();
    var ask = ev.find(function (v) { return v.stage === 'negotiation' || v.kind === 'ask_proposal' || v.kind === 'ask_access'; });
    var goals = GOAL[dl.stage] || GOAL.meeting_held;
    var inner = '<div class="y-prep">' +
      '<div class="y-when">' + IC.cal + e(m.title || 'Call with ' + first) + (m.at ? ' · ' + e(day(m.at)) + ', ' + e(time(m.at)) : '') + '</div>' +
      '<h5>Where it stands</h5><div>' + phasePill(dl.phase, dl.phase_label) + '<span class="g36-st">' + e(dl.label) + '</span>' + (dl.pilot ? '<span class="g36-st">Pilot</span>' : '') + '<span class="sp-small">' + e(dl.company || '') + '</span></div>' +
      (ask ? '<h5>What ' + e(first) + ' asked</h5><div class="y-ask">“' + e(ask.quote) + '”<div class="sp-small" style="margin-top:4px">' + e([ask.source, day(ask.at)].filter(Boolean).join(' · ')) + '</div></div>' : '') +
      '<h5>Come out of the call with</h5><ol>' + goals.map(function (g) { return '<li>' + e(g) + '</li>'; }).join('') + '</ol>' +
      '<h5>How it got here</h5><ul>' + (dl.evidence || []).map(function (v) { return '<li>“' + e(String(v.quote || '').slice(0, 170)) + '” <span>' + e([v.source, day(v.at)].filter(Boolean).join(' · ')) + '</span></li>'; }).join('') + '</ul>' +
      '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'yPrepM\').remove()">Close</button><span class="sp-acts"><button class="g-btn sp-gold" type="button" onclick="document.getElementById(\'yPrepM\').remove();tdsGo(\'sampaign\',\'' + e(x.c.id) + '\',\'people\')">Open the deal</button></span></div></div>';
    var md = _g34Modal('yPrepM', 'Prep: call with ' + first, inner);
    var b = md.querySelector('.sp-gold'); if (b) b.focus();
  };

  // ── 4. The SAMpaign: from conversation to deal ─────────────────────────
  function funnelHtml(id, dz) {
    if (!dz) return '';
    var any = (dz.accounts || []).length || dz.replied;
    if (!any) return '';
    var step = function (cls, n, label) { return '<div class="y-step ' + cls + (n ? '' : ' zero') + '"><b>' + e(n) + '</b><span>' + e(label) + '</span></div>'; };
    var rows = (dz.accounts || []).slice(0, 8).map(function (a) {
      return '<li class="y-co">' + phasePill(a.phase, a.label) + '<div class="y-cm"><b>' + e(a.company || 'A company') + '</b><small>' + e([a.person, a.stage_label, a.at ? 'since ' + day(a.at) : ''].filter(Boolean).join(' · ')) + '</small></div>' +
        '<button class="g-btn sp-sm" type="button" onclick="setSampTab(\'' + e(id) + '\',\'people\')">Open</button></li>';
    }).join('');
    return '<section class="y-fn" aria-label="From conversation to deal"><div class="y-fn-h"><h4>From conversation to deal</h4><small>Companies, by the furthest person. SAM moves them from the evidence: meetings, proposals, their answers.</small></div>' +
      '<div class="y-steps">' + step('rp', dz.replied || 0, 'replied') + step('mt', dz.meetings || 0, 'meetings') + step('evaluation', dz.evaluation, 'evaluating') + step('commercial', dz.commercial, 'commercial' + (dz.committed ? ', ' + dz.committed + ' committed' : '')) + step('won', dz.won, 'won') + '</div>' +
      (rows ? '<ul class="y-cos">' + rows + '</ul>' : '<div class="y-note">No company past a reply yet. A meeting with anyone here starts it.</div>') +
      (dz.held ? '<div class="y-note">' + IC.pause + plural(dz.held, 'person is', 'people are') + ' on hold because a colleague is in a deal with you. Resume them from Today.</div>' : '') + '</section>';
  }
  if (typeof _spOverviewHtml === 'function' && !_spOverviewHtml._y) {
    var ov0 = _spOverviewHtml;
    _spOverviewHtml = function (id, o) {
      var h = ov0.apply(this, arguments);
      try { var f = funnelHtml(id, o && o.deals); if (f) h = h.replace('<div class="sp-ov"><div class="sp-col">', '<div class="sp-ov"><div class="sp-col">' + f); } catch (_e) {}
      return h;
    };
    _spOverviewHtml._y = true;
  }
  if (typeof _spKpisHtml === 'function' && !_spKpisHtml._y) {
    var kp0 = _spKpisHtml;
    _spKpisHtml = function (k) {
      var h = kp0.apply(this, arguments);
      var dz = k && k.deals; if (!dz) return h;
      var tot = (dz.evaluation || 0) + (dz.commercial || 0) + (dz.won || 0);
      var names = (dz.accounts || []).filter(function (a) { return a.phase !== 'lost'; }).slice(0, 3).map(function (a) { return a.company; }).filter(Boolean).join(', ');
      return h + '<div class="sp-kpi"><div class="sp-lbl">Deals from SAMpaigns</div><div class="n sp-g">' + e(tot) + '</div><div class="d">' + e(dz.evaluation + ' evaluating · ' + dz.commercial + ' commercial · ' + dz.won + ' won') + (names ? '<br>' + e(names) : '') + '</div></div>';
    };
    _spKpisHtml._y = true;
  }

  // ── Deals in motion (People): SAM's move, Undo, the next call ───────────
  if (typeof _g36Person === 'function' && !_g36Person._y) {
    var gp0 = _g36Person;
    _g36Person = function (id, p, owner) {
      var h = gp0.apply(this, arguments);
      var extra = '';
      if (p.next_meeting && p.next_meeting.at) extra += '<div class="g36-nx">' + IC.cal + ' <b>Call:</b> ' + e(day(p.next_meeting.at) + ', ' + time(p.next_meeting.at)) + (p.next_meeting.title ? ' · ' + e(p.next_meeting.title) : '') + '</div>';
      var mv = (p.deal_moves || []).filter(function (m) { return !m.undone; }).slice(-1)[0];
      if (mv) extra += '<div class="g36-ev">' + e(mv.created ? 'SAM added it to Pipeline at ' + mv.to_label : 'SAM moved it to ' + mv.to_label) + ' <span>' + e(day(mv.at)) + '</span>' + (owner ? ' <button class="g36-sync" style="margin-left:6px" type="button" onclick="yUndoP(\'' + e(id) + '\',\'' + e(p.contact_id) + '\',this)">Undo</button>' : '') + '</div>';
      else if (p.hands_off) extra += '<div class="g36-ev"><span>You set this deal\'s stage, so SAM leaves it to you.</span></div>';
      var ph = phasePill(p.phase, p.phase ? ({ evaluation: 'Evaluating', commercial: 'Commercial', lost: 'Not going ahead' })[p.phase] : '');
      h = h.replace('<div class="g36-pt">', '<div class="g36-pt">' + ph);
      return extra ? h.replace(/<\/div>$/, extra + '</div>') : h;
    };
    _g36Person._y = true;
  }
  window.yUndoP = async function (id, cid, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Undoing…'; }
    var r = await call('undo_deal_move', { contact_id: cid });
    toast(r.ok ? r.note : (r.error || 'Could not undo that.'));
    try { window._g36.j[id] = null; _g36People(id, true); } catch (_e) {}
  };
})();
