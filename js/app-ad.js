// SamoraOS app: Drop AD (17 Nov 2026). LinkedIn only, LinkedIn follow-ups.
//   1. A "LinkedIn only" sequence, next to "Email only": a visit, an invite,
//      a message once they accept, and two follow-ups.
//   2. Up to three LinkedIn messages in any sequence: the first after they
//      accept, each follow-up a number of working days after the one before,
//      stopped the moment they reply.
//   3. A LinkedIn only SAMpaign's launch plan has no email steps.
// The writing itself (no "As somebody who is a CIO", a peer's register for
// executives, the sender's own title) is on the server.
// Loaded after app-ac.js.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  var MAX_MSG = 3;

  (function css() {
    if (document.getElementById('adCss')) return;
    var st = document.createElement('style'); st.id = 'adCss';
    st.textContent = [
      '.ad-fu{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--c-accent-text,var(--gold));margin-left:6px}',
      '.sp-sq.ad-follow{margin-left:22px;position:relative}.sp-sq.ad-follow:before{content:"";position:absolute;left:-14px;top:-10px;bottom:50%;border-left:2px dotted rgba(var(--c-accent-rgb),.45);border-bottom:2px dotted rgba(var(--c-accent-rgb),.45);width:10px;border-bottom-left-radius:8px}',
      '@media (max-width:640px){.sp-sq.ad-follow{margin-left:12px}}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  // ── The templates ────────────────────────────────────────────────────────
  if (typeof SP_SEQ_TPL === 'object' && SP_SEQ_TPL && !SP_SEQ_TPL.li_only) {
    var email_only = SP_SEQ_TPL.email_only; delete SP_SEQ_TPL.email_only;
    SP_SEQ_TPL.li_only = { label: 'LinkedIn only', desc: 'Visit, invite, a message once they accept, two follow-ups', steps: [{ kind: 'visit', day: 1 }, { kind: 'invite', day: 1 }, { kind: 'message', after: 1 }, { kind: 'message', after: 4 }, { kind: 'message', after: 7 }] };
    SP_SEQ_TPL.email_only = email_only;
  }
  if (typeof SP_SEQ_KIND === 'object') SP_SEQ_KIND.message = 'LinkedIn message';

  function msgIndex(S, i) { var n = 0; for (var j = 0; j <= i && j < (S.steps || []).length; j++) if (S.steps[j].kind === 'message') n++; return n; }
  function msgCount(S) { return (S.steps || []).filter(function (s) { return s.kind === 'message'; }).length; }

  // The order: each message counts from the one before it.
  _spSeqKey = window._spSeqKey = function (S, s) {
    if (s.kind !== 'message') return Number(s.day) || 1;
    var inv = (S.steps || []).find(function (x) { return x.kind === 'invite'; });
    var cum = 0, n = 0;
    for (var j = 0; j < S.steps.length; j++) { var x = S.steps[j]; if (x.kind !== 'message') continue; n++; cum += Number(x.after) || 0; if (x === s) break; }
    return (inv ? Number(inv.day) || 1 : 1) + 0.5 + cum / 100 + n / 10000;
  };
  _spSeqCheck = window._spSeqCheck = function (S) {
    var n = {}; (S.steps || []).forEach(function (s) { n[s.kind] = (n[s.kind] || 0) + 1; });
    if (!S.start) return 'Pick a start date';
    if ((n.email || 0) > 6) return 'Six emails at most';
    if (n.visit > 1 || n.invite > 1) return 'One LinkedIn visit and one invite at most';
    if ((n.message || 0) > MAX_MSG) return 'Three LinkedIn messages at most: the first after they accept, then two follow-ups';
    if (!n.email && !n.invite) return 'Add at least one email or a LinkedIn invite';
    if (n.message && !n.invite) return 'A LinkedIn message goes after they accept an invite, so add the invite too';
    return '';
  };
  _spSeqRow = window._spSeqRow = function (S, s, i, pos) {
    var isLi = s.kind !== 'email';
    var emailIdx = 0;
    if (!isLi) emailIdx = _spSeqSorted(S).filter(function (x) { return x.s.kind === 'email'; }).findIndex(function (x) { return x.i === i; });
    var emailsTotal = (S.steps || []).filter(function (x) { return x.kind === 'email'; }).length;
    var mIdx = s.kind === 'message' ? msgIndex(S, i) : 0, mTot = msgCount(S);
    var sub = s.kind === 'email' ? (emailIdx === 0 ? 'First email · personal, short, one ask' : 'Follow-up ' + emailIdx + ' · same thread' + (emailIdx === emailsTotal - 1 ? ', a short close' : ', adds a new reason'))
      : s.kind === 'visit' ? 'No note. They see your name in their viewers'
      : s.kind === 'invite' ? 'SAM writes the note to fit your LinkedIn plan'
      : mIdx <= 1 ? 'Sent once they accept. Skipped if they already replied'
      : (mIdx === mTot ? 'Follow-up ' + (mIdx - 1) + ' · a short, kind close, if they have not replied' : 'Follow-up ' + (mIdx - 1) + ' · one new thing, if they have not replied');
    var used = {}; (S.steps || []).forEach(function (x, j) { if (j !== i) used[x.kind] = (used[x.kind] || 0) + 1; });
    var opts = ['email', 'visit', 'invite', 'message'].map(function (k) {
      var dis = k !== 'email' && (_liLocked() || (k === 'message' ? (used.message || 0) >= MAX_MSG : !!used[k]));
      return '<option value="' + k + '"' + (k === s.kind ? ' selected' : '') + (dis ? ' disabled' : '') + '>' + SP_SEQ_KIND[k] + '</option>';
    }).join('');
    var dayCell = s.kind === 'message'
      ? '<label class="sp-dayin sp-seqday"><input type="number" min="' + (mIdx > 1 ? 1 : 0) + '" max="30" value="' + (Number(s.after) || 0) + '" onchange="_spSeqSet(' + i + ',\'after\',this.value)" aria-label="' + (mIdx > 1 ? 'Working days after the last message' : 'Working days after they accept') + '"><span class="sp-small">' + (mIdx > 1 ? 'days after the last' : 'days later') + '</span></label>'
      : '<label class="sp-dayin sp-seqday"><span class="sp-small">Day</span><input type="number" min="1" max="60" value="' + (Number(s.day) || 1) + '" onchange="_spSeqSet(' + i + ',\'day\',this.value)" aria-label="Working day of the sequence"></label>';
    var date = s.kind === 'message' ? (mIdx > 1 ? 'if no reply' : 'once accepted') : _spDate(_spSeqDateOf(S, s.day));
    return '<div class="sp-sq sp-sqb' + (mIdx > 1 ? ' ad-follow' : '') + '"><span class="sp-sn' + (isLi ? ' li' : '') + '" style="width:40px;height:40px">' + (isLi ? SP_ICON.li : SP_ICON.mail) + '</span>' +
      '<div><select class="sp-kind" onchange="_spSeqSet(' + i + ',\'kind\',this.value)" aria-label="Step ' + (pos + 1) + '">' + opts + '</select>' + (mIdx > 1 ? '<span class="ad-fu">Follow-up ' + (mIdx - 1) + '</span>' : '') + '<div class="sp-sm2">' + e(sub) + '</div></div>' +
      dayCell + '<span class="sp-small sp-date">' + e(date) + '</span>' +
      '<button class="sp-x" type="button" aria-label="Remove step ' + (pos + 1) + '" onclick="_spSeqDel(' + i + ')">' + SP_ICON.x + '</button></div>';
  };
  _spSeqHtml = window._spSeqHtml = function (S) {
    var lockedLi = _liLocked();
    var tpl = Object.keys(SP_SEQ_TPL).map(function (k) {
      var needsLi = SP_SEQ_TPL[k].steps.some(function (s) { return s.kind !== 'email'; });
      var lk = lockedLi && needsLi;
      return '<button type="button" class="sp-opt sp-tpl' + (S.tpl === k ? ' on' : '') + (lk ? ' locked' : '') + '" onclick="_spSeqUseTpl(\'' + k + '\')"' + (lk ? ' aria-disabled="true"' : '') + '><b>' + e(SP_SEQ_TPL[k].label) + (lk ? '<span class="sp-lk">Add-on</span>' : '') + '</b><span>' + e(SP_SEQ_TPL[k].desc) + '</span></button>';
    }).join('');
    var rows = _spSeqSorted(S).map(function (x, pos) { return _spSeqRow(S, x.s, x.i, pos); }).join('');
    var n = {}; (S.steps || []).forEach(function (s) { n[s.kind] = (n[s.kind] || 0) + 1; });
    var nextLi = !n.invite ? 'invite' : !n.visit ? 'visit' : !n.message ? 'message' : null;
    var canFollow = n.invite && n.message && n.message < MAX_MSG;
    var err = _spSeqCheck(S);
    var d = _spSeqDates(S);
    var hasLi = n.invite || n.visit;
    return '<div class="sp-tpls">' + tpl + '</div>' +
      '<label class="sp-fld" style="max-width:240px">Starts on<input id="spSeqStart" type="date" value="' + e(S.start || '') + '" onchange="_spSeqSet(-1,\'start\',this.value)"></label>' +
      '<div class="sp-seq">' + (rows || '<div class="sp-small">No steps yet. Add an email or a LinkedIn step.</div>') + '</div>' +
      '<div class="sp-acts" style="margin-top:12px">' +
        ((n.email || 0) < 6 ? '<button class="g-btn sp-sm" type="button" onclick="_spSeqAdd(\'email\')">' + SP_ICON.plus + ' Email</button>' : '') +
        (nextLi && !lockedLi ? '<button class="g-btn sp-sm" type="button" onclick="_spSeqAdd(\'' + nextLi + '\')">' + SP_ICON.plus + ' ' + e(SP_SEQ_KIND[nextLi]) + '</button>' : '') +
        (canFollow && !lockedLi ? '<button class="g-btn sp-sm" type="button" onclick="_spSeqAdd(\'message\')">' + SP_ICON.plus + ' LinkedIn follow-up</button>' : '') +
      '</div>' + (lockedLi ? '<div style="margin-top:16px">' + _liLockedCard(true) + '</div>' : '') +
      (err ? '<div class="sp-seqerr" role="alert">' + e(err) + '</div>'
        : '<div class="sp-small" style="margin-top:12px">' + (d.emails ? pl(d.emails, 'email') + ', first on ' + e(_spDate(d.first)) : 'LinkedIn only, no emails') + (n.message > 1 ? ', ' + pl(n.message - 1, 'LinkedIn follow-up') : '') + (hasLi ? '. LinkedIn steps run from the Samora Chrome plugin' + (_liExtVersion() ? '' : ' (get it from You, LinkedIn plugin)') : '') + '. Days are working days. A reply on any channel stops the rest for that person.</div>');
  };
  _spSeqAdd = window._spSeqAdd = function (kind) {
    var S = _spSeqState(); if (!S) return;
    var last = 0; S.steps.forEach(function (s) { if (s.kind !== 'message') last = Math.max(last, Number(s.day) || 1); });
    var inv = S.steps.find(function (s) { return s.kind === 'invite'; });
    var m = msgCount(S);
    if (kind === 'message') { if (m >= MAX_MSG) return; S.steps.push({ kind: 'message', after: m === 0 ? 1 : m === 1 ? 4 : 7 }); }
    else if (kind === 'visit') S.steps.push({ kind: 'visit', day: inv ? Math.max(1, inv.day) : 1 });
    else if (kind === 'invite') S.steps.push({ kind: 'invite', day: Math.max(1, Math.min(60, last ? Math.min(last + 1, 2) : 1)) });
    else S.steps.push({ kind: 'email', day: Math.min(60, (last || 0) + (last ? 5 : 1)) });
    S.tpl = null; _spSeqRender();
  };
  _spSeqSumLi = window._spSeqSumLi = function (S) {
    var inv = S.steps.find(function (s) { return s.kind === 'invite'; });
    var m = msgCount(S), parts = [];
    if (_spSeqHas(S, 'visit')) parts.push('visit');
    if (inv) parts.push('invite on day ' + inv.day);
    if (m) parts.push('message after they accept');
    if (m > 1) parts.push(pl(m - 1, 'follow-up'));
    return '<div><span class="sp-lbl">LinkedIn</span><b style="font-size:16px">' + (parts.length ? 'On' : 'Off') + '</b><span class="sp-small">' + e(parts.length ? parts.join(', ') : 'email only') + '</span></div>';
  };

  // ── A LinkedIn only SAMpaign: no email steps in its launch plan ─────────
  if (typeof window._spGuideSteps === 'function' && !window._spGuideSteps._ad) {
    var baseSteps = window._spGuideSteps;
    _spGuideSteps = window._spGuideSteps = function (id, o) {
      var st = baseSteps.apply(this, arguments);
      try {
        var ch = (o && o.campaign && o.campaign.channels) || {};
        if (ch.email !== false) return st;
        var su = o.setup || {}, li = (o.channels || {}).linkedin || {};
        st = st.filter(function (s) { return ['emails', 'write', 'send'].indexOf(s.key) === -1; });
        st.forEach(function (s) {
          if (s.key === 'people' && o.counts && o.counts.total > 0) s.text = pl(o.counts.total, 'person', 'people') + ' in this SAMpaign, ' + (su.li_profiles || 0) + ' with a LinkedIn profile.';
        });
        void li;
        st.push({ key: 'li_go', title: 'The plugin runs it', done: false, optional: true, auto: true,
          text: 'LinkedIn only: the Samora Chrome plugin visits, invites, then sends the message and the follow-ups on their days, while Chrome is open. A reply stops the rest.',
          acts: [['ghost', 'See the steps', 'setSampTab(\'' + id + '\',\'sequence\')']] });
      } catch (_e) {}
      return st;
    };
    window._spGuideSteps._ad = true;
  }
  window._adReady = true;
})();
