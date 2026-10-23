// ══ Samora Intelligence UI, Drop Q (2026-10-22) ═════════════════════════════
// Buying intent on a deal, SAM-TAM's new ways to find companies (like your won
// deals, from your activity, champions who moved) and the admin's
// Intelligence settings. Every score shows the parts it is made of.

// ── Shared bits ─────────────────────────────────────────────────────────────
function _samBandCol(b) { return b === 'hot' ? 'var(--green)' : b === 'warm' ? 'var(--amber)' : 'var(--text3)'; }
function _samScoreCol(s) { return s == null ? 'var(--text3)' : s >= 70 ? 'var(--green)' : s >= 45 ? 'var(--amber)' : 'var(--text3)'; }
function _samPartsHTML(parts, opts) {
  opts = opts || {};
  var list = (parts || []).filter(function (p) { return opts.all || p.known !== false; });
  if (!list.length) return '';
  return '<div class="sq-parts">' + list.map(function (p) {
    var neg = p.got < 0, w = p.max ? Math.max(0, Math.min(100, Math.round(100 * Math.abs(p.got) / p.max))) : 0;
    return '<div class="sq-part' + (p.known === false ? ' unk' : '') + '">' +
      '<span class="sq-pl">' + esc(p.label) + '</span>' +
      '<span class="sq-bar"><i style="width:' + w + '%;background:' + (neg ? 'var(--coral)' : 'var(--gold)') + '"></i></span>' +
      '<span class="sq-pv">' + (neg ? '' : '+') + p.got + '<small>/' + p.max + '</small></span>' +
      '<span class="sq-pw">' + esc(p.why || '') + (p.items && p.items.length ? '<small>' + p.items.map(esc).join(' · ') + '</small>' : '') + '</span></div>';
  }).join('') + '</div>';
}

// ── Buying intent on a deal ─────────────────────────────────────────────────
function _samIntentHTML(it) {
  if (!it) return '';
  var col = _samBandCol(it.band);
  var label = it.band === 'hot' ? 'Buying now' : it.band === 'warm' ? 'Warming up' : 'Quiet';
  var act = (it.parts || []).filter(function (p) { return p.group === 'activity'; }), trg = (it.parts || []).filter(function (p) { return p.group === 'triggers'; });
  return '<section class="sq-intent">' +
    '<div class="sq-ih"><div class="sq-score" style="border-color:' + col + ';color:' + col + '">' + it.score + '</div>' +
    '<div class="sq-ihb"><div class="sq-k">' + _samoraIntelLabel('Buying intent') + '</div><div class="sq-band" style="color:' + col + '">' + label + '</div>' +
    '<div class="sq-sub">Up to 60 from your own conversations, up to 40 from company events. Updated ' + esc(_spAgo(it.computed_at) || 'today') + '.</div></div>' +
    '<button class="sq-lnk" type="button" onclick="_samIntentFill(_currentDealDetail.deal.id, true)">Update</button></div>' +
    (act.length ? '<div class="sq-gh">From your conversations</div>' + _samPartsHTML(act) : '') +
    (trg.length ? '<div class="sq-gh">Company events</div>' + _samPartsHTML(trg) : '') +
    (!act.length && !trg.length ? '<div class="sq-sub" style="padding:4px 0 2px">Nothing yet: no replies, meetings or company events in the last 30 days.</div>' : '') +
    '</section>';
}
async function _samIntentFill(accountId, refresh) {
  var box = document.getElementById('samIntentBox'); if (!box || !accountId) return;
  if (refresh) box.style.opacity = '.55';
  var d = await _sampEdge('get_account_intent', { account_id: accountId, refresh: !!refresh });
  box.style.opacity = '';
  if (d.ok && d.intent) box.innerHTML = _samIntentHTML(d.intent);
  else if (d.needs_migration) box.innerHTML = '<div class="sq-sub">Buying intent needs the Drop Q database update. Ask your Samora admin.</div>';
}

// ── SAM-TAM: modes ──────────────────────────────────────────────────────────
var SQ_MODES = [
  ['describe', 'Describe', 'Say what you want in a sentence'],
  ['lookalike', 'Like my won deals', 'Companies that look like the ones you closed'],
  ['warm', 'From your activity', 'Companies you already email but have not added'],
  ['champions', 'Champions who moved', 'People who knew you, now somewhere new']
];
function _samTamModes(T) {
  T.mode = T.mode || 'describe';
  return '<div class="sq-modes" role="tablist">' + SQ_MODES.map(function (m) {
    return '<button type="button" role="tab" aria-selected="' + (T.mode === m[0]) + '" class="sq-mode' + (T.mode === m[0] ? ' on' : '') + '" onclick="_samTamSetMode(\'' + m[0] + '\')"><b>' + m[1] + '</b><small>' + m[2] + '</small></button>';
  }).join('') + '</div>';
}
function _samTamSetMode(m) {
  var T = window._g19Tam; if (!T || T.busy) return;
  _g19TamSave(); T.mode = m; T.res = null; T.err = null; T.picked = {};
  if (m === 'lookalike' && !T.fp) _samTamLoadFp();
  if (m === 'champions') _samChampLoad(false);
  _g19TamRender();
}
async function _samTamLoadFp() {
  var T = window._g19Tam; T.fp = { loading: true }; _g19TamRender();
  var d = await _sampEdge('sam_fingerprint', {});
  T.fp = d.ok ? d : { error: d.error || 'Could not read your won deals.' };
  _g19TamRender();
}
function _samTamModePanel(T) {
  var left = _g19Left('discovery');
  if (T.mode === 'lookalike') {
    var f = T.fp || {};
    var body = f.loading ? '<div class="sp-small">Reading your won deals…</div>'
      : f.error ? '<div class="sp-small">' + esc(f.error) + '</div>'
      : (!f.n_won && !f.icp_used) ? '<div class="sp-small">No won deals yet, and no ICP to go on. Mark deals as won, or fill in the ICP in Admin.</div>'
      : '<div class="sq-fp">' +
        '<div class="sq-fph">' + _samoraIntelLabel(f.n_won ? 'What your ' + f.n_won + ' won deal' + (f.n_won === 1 ? '' : 's') + ' have in common' : 'Your ICP, until you win deals') + '</div>' +
        _samFpRow('Industry', f.industries) + _samFpRow('Size', f.sizes) + _samFpRow('Country', f.countries) +
        (f.titles && f.titles.length ? '<div class="sq-fpr"><span>Who engaged</span><span>' + f.titles.slice(0, 6).map(esc).join(', ') + '</span></div>' : '') +
        '<div class="sp-small" style="margin-top:6px">' + esc((f.receipts || []).join('; ')) + (f.weights_note ? '. ' + esc(f.weights_note) : '') + '</div></div>';
    return '<section class="sp-card sp-pad">' + body +
      '<div class="g19-tamrow" style="margin-top:12px"><div class="sp-fld">How many<div class="g19-seg">' + [5, 10, 20].map(function (n) { return '<button type="button" class="' + (T.n === n ? 'on' : '') + '" onclick="window._g19Tam.n=' + n + ';_g19TamRender()">' + n + '</button>'; }).join('') + '</div></div>' +
      '<button class="g-btn sp-gold" type="button" onclick="_samTamLookalike()"' + (T.busy || left === 0 || f.loading || f.error || (!f.n_won && !f.icp_used) ? ' disabled' : '') + '>' + (T.busy ? 'SAM is looking…' : SP_ICON.spark + ' Find lookalikes') + '</button></div></section>';
  }
  if (T.mode === 'warm') {
    return '<section class="sp-card sp-pad"><div class="sp-small" style="margin-top:0">SAM looks at the last 90 days of your sent email, your sequences and your SAMpaigns, and finds companies you are already talking to that are not accounts yet. Only email addresses are read, never the messages. It uses no searches and no credits.</div>' +
      '<div class="g19-tamrow" style="margin-top:12px"><label class="sq-chk"><input type="checkbox" id="sqWarmMail"' + (T.warmMail === false ? '' : ' checked') + ' onchange="window._g19Tam.warmMail=this.checked"> Include my sent email</label>' +
      '<button class="g-btn sp-gold" type="button" onclick="_samTamWarm()"' + (T.busy ? ' disabled' : '') + '>' + (T.busy ? 'SAM is looking…' : SP_ICON.spark + ' Find warm companies') + '</button></div></section>';
  }
  if (T.mode === 'champions') return _samChampHTML(T);
  return '';
}
function _samFpRow(label, arr) {
  if (!arr || !arr.length) return '';
  return '<div class="sq-fpr"><span>' + label + '</span><span>' + arr.slice(0, 3).map(function (x) { return esc(x.label) + ' <small>' + x.pct + '%</small>'; }).join(', ') + '</span></div>';
}
async function _samTamRun(action, payload, queryLabel) {
  var T = window._g19Tam; T.err = null; T.busy = true; T.res = null; T.picked = {}; T.t0 = Date.now(); _g19TamRender();
  var d = await _sampEdge(action, payload);
  T.busy = false;
  if (!d.ok) { T.err = { msg: d.error || 'SAM could not search just now. Try again in a minute.', busy: !!d.busy, slow: !!d.slow, quota: d.quota || null, admin: d.admin_detail || null }; _g19TamRender(); return; }
  T.res = d; T.q = d.query || queryLabel || T.q;
  (d.candidates || []).forEach(function (x) { if (x.verified && (x.score == null || x.score >= 50)) T.picked[x.id] = true; });
  if (typeof g19UsageLoad === 'function') await g19UsageLoad(true);
  _g19TamRender(); setTimeout(function () { _g20Reveal('.g19-tamres'); }, 60);
}
function _samTamLookalike() { var T = window._g19Tam; _samTamRun('discover_accounts', { mode: 'lookalike', limit: T.n || 10 }, 'Like my won deals'); }
function _samTamWarm() { var T = window._g19Tam; _samTamRun('discover_warm_accounts', { limit: T.n > 5 ? T.n : 10, include_mailbox: T.warmMail !== false }, 'From your activity'); }

// Score chip and its parts on each candidate.
function _samCandScore(x) {
  if (x.score == null) return '';
  var col = _samScoreCol(x.score);
  var src = x.source === 'warm' ? 'Warmth' : x.source === 'champion' ? 'Champion' : 'Fit';
  return '<button type="button" class="sq-chip" style="color:' + col + ';border-color:' + col + '" title="Why this score" onclick="event.preventDefault();event.stopPropagation();_samCandToggle(\'' + esc(x.id) + '\')">' + src + ' ' + x.score + '</button>';
}
function _samCandWhy(x) {
  if (!x.score_parts || !x.score_parts.length || !(window._g19Tam.open || {})[x.id]) return '';
  var w = x.score_parts.filter(function (p) { return p.group === 'warmth'; }), l = x.score_parts.filter(function (p) { return p.group !== 'warmth'; });
  return '<span class="sq-why">' + (w.length ? '<span class="sq-gh">From your activity</span>' + _samPartsHTML(w) : '') + (l.length ? '<span class="sq-gh">Compared with your won deals</span>' + _samPartsHTML(l, { all: true }) : '') + '</span>';
}
function _samCandToggle(id) { var T = window._g19Tam; T.open = T.open || {}; T.open[id] = !T.open[id]; _g19TamRender(); }
function _samSourceNote(res) {
  if (!res) return '';
  if (res.found_by === 'activity') return '<div class="sp-small" style="padding:10px 16px">From your own email and outreach. No searches or credits used.' + (res.mailbox === 'not_connected' ? ' Connect Gmail or Outlook in the You tab to include your sent email.' : '') + '</div>';
  if (res.database && res.database.source && /zoominfo/.test(res.database.source)) return '<div class="sp-small" style="padding:10px 16px">Found in ZoomInfo’s company database (no ZoomInfo credits used)' + (res.found_by === 'database' ? ', so SAM’s AI was not needed.' : ', with SAM’s web search for the rest.') + '</div>';
  return '';
}

// ── Champions who moved ─────────────────────────────────────────────────────
async function _samChampLoad(check) {
  var T = window._g19Tam; T.champ = Object.assign({}, T.champ || {}, { loading: true }); _g19TamRender();
  var d = await _sampEdge(check ? 'track_champions' : 'list_champion_moves', check ? {} : {});
  T.champ = d.ok ? { moves: d.moves || [], zoominfo: !!d.zoominfo, note: d.note || null, checked: d.checked, ran: !!check } : { error: d.error || 'Could not load.' };
  _g19TamRender();
}
function _samChampHTML(T) {
  var c = T.champ || { loading: true };
  var head = '<div class="sq-chh"><div class="sp-small" style="margin:0">SAM checks the people you won with, and your champions, for job moves once a month. When one lands somewhere new, that company is a warm way in.' + (c.zoominfo === false ? ' Without ZoomInfo SAM can only tell when their email starts bouncing.' : '') + '</div>' +
    '<button class="g-btn" type="button" onclick="_samChampLoad(true)"' + (c.loading ? ' disabled' : '') + '>' + (c.loading ? 'Checking…' : 'Check now') + '</button></div>';
  if (c.loading) return '<section class="sp-card sp-pad">' + head + '</section>';
  if (c.error) return '<section class="sp-card sp-pad">' + head + '<div class="sp-small">' + esc(c.error) + '</div></section>';
  var rows = (c.moves || []).map(function (m) {
    return '<div class="sq-mv"><div class="sq-mvb"><b>' + esc(m.person_name) + '</b>' + (m.to_company ? ' is now at <b>' + esc(m.to_company) + '</b>' + (m.to_title ? ' as ' + esc(m.to_title) : '') : ' may have left ' + esc(m.from_company || 'their company')) +
      '<small>' + esc(m.evidence || '') + ' Spotted ' + esc(_spAgo(m.detected_at)) + '.</small></div>' +
      '<div class="sq-mva">' + (m.to_company ? '<button class="g-btn sp-gold" type="button" onclick="_samChampDecide(\'' + esc(m.id) + '\',\'stage\')">Add to SAM-TAM finds</button>' : '') +
      '<button class="sq-dis" type="button" onclick="_samChampDecide(\'' + esc(m.id) + '\',\'dismiss\')">Dismiss</button></div></div>';
  }).join('');
  return '<section class="sp-card sp-pad">' + head + (rows || '<div class="sp-empty">' + (c.ran ? 'Checked ' + _spPlural(c.checked || 0, 'person', 'people') + '. No moves found.' : 'No moves found yet. SAM checks every night; or press Check now.') + '</div>') + (c.note ? '<div class="sp-small">' + esc(c.note) + '</div>' : '') + '</section>';
}
async function _samChampDecide(id, decision) {
  var d = await _sampEdge('champion_move_decide', { id: id, decision: decision });
  if (!d.ok) { showToast(d.error || 'Could not do that'); return; }
  var T = window._g19Tam; T.champ.moves = (T.champ.moves || []).filter(function (m) { return m.id !== id; });
  showToast(decision === 'stage' ? 'Added. Find it under earlier finds in SAM-TAM.' : 'Dismissed');
  if (decision === 'stage' && d.candidate) { T.mode = 'describe'; T.res = { candidates: [d.candidate], verified_count: 1, query: 'Champions who moved' }; T.picked = {}; T.picked[d.candidate.id] = true; }
  _g19TamRender();
}

// ── Admin: Intelligence settings ────────────────────────────────────────────
var _sqAdm = null;
async function samIntelAdminLoad() {
  var box = document.getElementById('samIntelAdminBody'); if (!box) return;
  var d = await _sampEdge('get_intel_settings', { app_origin: window.location.origin });
  var sec = document.getElementById('samIntelAdminSection');
  if (!d.ok) { if (sec) sec.style.display = d._status === 403 ? 'none' : ''; box.innerHTML = '<div class="sp-small">' + esc(d.error || 'Could not load.') + '</div>'; return; }
  _sqAdm = { s: d.settings, zi: d.zoominfo, credits: d.credits_this_month || {}, snippet: d.snippet, topics: null, fp: null };
  _sqAdmRender();
  _sampEdge('sam_fingerprint', {}).then(function (f) { if (_sqAdm && f.ok) { _sqAdm.fp = f; _sqAdmRender(); } });
  if (d.zoominfo) _sampEdge('zoominfo_topics', {}).then(function (t) { if (_sqAdm) { _sqAdm.topics = t.ok ? t : { error: t.error }; _sqAdmRender(); } });
}
function _sqSw(key, label, sub, on, disabled) {
  return '<label class="g19-sw sq-sw"><button type="button" class="toggle-pill' + (on ? ' on' : '') + '" role="switch" aria-checked="' + !!on + '"' + (disabled ? ' disabled' : '') + ' onclick="_sqToggle(\'' + key + '\')"><i></i></button><span><b>' + label + '</b><small>' + sub + '</small></span></label>';
}
function _sqNum(key, v, min, max) { return '<input class="sq-num" type="number" min="' + min + '" max="' + max + '" value="' + esc(v) + '" onchange="_sqAdm.s.' + key + '=Number(this.value);_sqAdm.dirty=true">'; }
function _sqToggle(k) { _sqAdm.s[k] = !_sqAdm.s[k]; _sqAdm.dirty = true; _sqAdmRender(); }
function _sqAdmRender() {
  var box = document.getElementById('samIntelAdminBody'); if (!box || !_sqAdm) return;
  var S = _sqAdm.s, zi = _sqAdm.zi, cr = _sqAdm.credits, f = _sqAdm.fp, tp = _sqAdm.topics;
  var noZi = zi ? '' : ' (connect ZoomInfo above first)';
  var h = '';
  h += '<div class="admin-card"><div class="admin-card-title">' + _samoraIntelLabel('What SAM learns from your wins') + '</div>' +
    (f ? '<div class="sq-fp" style="margin-top:8px">' + _samFpRow('Industry', f.industries) + _samFpRow('Size', f.sizes) + _samFpRow('Country', f.countries) +
      (f.titles && f.titles.length ? '<div class="sq-fpr"><span>Who engaged</span><span>' + f.titles.slice(0, 6).map(esc).join(', ') + '</span></div>' : '') +
      '<div class="sp-small" style="margin-top:6px">' + esc((f.receipts || []).join('; ') || 'No won deals yet.') + '. ' + esc(f.weights_note || '') + '</div></div>' : '<div class="sp-small">Loading…</div>') +
    '<div class="sp-small" style="margin-top:8px">Fit scores on accounts and SAM-TAM finds compare each company with this, using rules rather than AI, and show the parts that matched.</div></div>';

  h += '<div class="admin-card"><div class="admin-card-title">Free, on by default</div>' +
    _sqSw('zi_database', 'Search ZoomInfo’s company database in SAM-TAM', 'Uses no ZoomInfo credits. When it finds enough, SAM’s AI is not needed for the search' + noZi + '.', S.zi_database, !zi) +
    _sqSw('zi_new_execs', 'New leaders at your accounts', 'Each account weekly: new C-level, VP and Director hires in the last 90 days, added to the account’s signals. No credits' + noZi + '.', S.zi_new_execs, !zi) +
    _sqSw('champions', 'Champions who moved', 'Monthly per person. With ZoomInfo SAM sees where they went; without it, only that their email bounced.', S.champions) +
    '<div class="sq-row"><span>Ask SAM’s AI about an account again at most every</span>' + _sqNum('signals_max_age_days', S.signals_max_age_days, 1, 60) + '<span>days when nothing about it has changed</span></div>' +
    '<div class="sq-row"><span>Scan the web for account news at most every</span>' + _sqNum('ext_scan_every_days', S.ext_scan_every_days, 1, 60) + '<span>days</span></div></div>';

  h += '<div class="admin-card"><div class="admin-card-title">Uses ZoomInfo credits, off by default</div>' +
    _sqSw('zi_company_credits', 'Company details for won deals', 'For won accounts with no size or industry, so lookalikes have more to go on. 1 credit per company, kept for 30 days' + noZi + '.', S.zi_company_credits, !zi) +
    (S.zi_company_credits ? '<div class="sq-row"><span>At most</span>' + _sqNum('zi_company_monthly_cap', S.zi_company_monthly_cap, 0, 1000) + '<span>a month. Used this month: ' + (cr.zi_company || 0) + '</span></div>' : '') +
    _sqSw('zi_topics_on', 'Research topics', 'Which of your topics each account is researching, weekly. 1 credit per company that has signals' + noZi + '.', S.zi_topics_on, !zi) +
    (S.zi_topics_on ? '<div class="sq-row"><span>At most</span>' + _sqNum('zi_topics_monthly_cap', S.zi_topics_monthly_cap, 0, 10000) + '<span>companies a month. Used this month: ' + (cr.zi_topics || 0) + '</span></div>' + _sqTopicsHTML(S, tp) : '') + '</div>';

  h += '<div class="admin-card"><div class="admin-card-title">Website visitors, off by default</div>' +
    '<div class="sp-small" style="margin-top:0">A small script on your website tells SamoraOS which <b>companies</b> visit which pages. No cookies, nothing stored in the visitor’s browser, and SamoraOS never keeps an IP address. It does nothing for visitors with Global Privacy Control or Do Not Track on, and by default it waits for your consent banner. 1 ZoomInfo credit per company identified; homes and phones cost nothing.</div>' +
    (!S.visitors_consent_confirmed_at ? '<label class="sq-chk" style="margin-top:10px"><input type="checkbox" id="sqConsent"' + (_sqAdm.consent ? ' checked' : '') + ' onchange="_sqAdm.consent=this.checked"> My website asks visitors for consent to analytics, or we have another lawful basis for this</label>' : '<div class="sp-small">Consent confirmed ' + esc(String(S.visitors_consent_confirmed_at || '').slice(0, 10)) + '.</div>') +
    '<div class="sq-row"><span>Your website</span><input class="sq-txt" id="sqHosts" placeholder="example.com" value="' + esc((S.visitors_hosts || []).join(', ')) + '" oninput="_sqAdm.dirty=true"></div>' +
    _sqSw('visitors_on', 'Show me companies visiting my website', zi ? 'Only works on the website above.' : 'Connect ZoomInfo above first.', S.visitors_on, !zi) +
    (S.visitors_on ? '<div class="sq-row"><span>At most</span>' + _sqNum('visitors_daily_cap', S.visitors_daily_cap, 0, 2000) + '<span>lookups a day. Identified this month: ' + (cr.visitors || 0) + '</span></div>' : '') +
    (_sqAdm.snippet ? '<div class="sq-snip"><code>' + esc(_sqAdm.snippet) + '</code><button class="g-btn" type="button" onclick="navigator.clipboard.writeText(_sqAdm.snippet).then(function(){showToast(\'Copied\')})">Copy</button></div><div class="sp-small">Paste it before &lt;/head&gt;. When your consent banner gets a yes, call <code>samoraConsent(true)</code>. Remove data-consent="required" only if you have another lawful basis.</div>' : '') + '</div>';

  h += '<div style="display:flex;gap:10px;align-items:center;justify-content:flex-end"><span class="sp-small" id="sqSaveMsg"></span><button class="g-btn sp-gold" type="button" onclick="_sqSave()">Save</button></div>';
  box.innerHTML = h;
}
function _sqTopicsHTML(S, tp) {
  var chosen = S.zi_topics || [];
  var h = '<div class="sq-topics"><div class="sq-gh">Your topics (' + chosen.length + ')</div><div class="sp-chips">' +
    (chosen.length ? chosen.map(function (t, i) { return '<button type="button" class="sp-chip on" onclick="_sqAdm.s.zi_topics.splice(' + i + ',1);_sqAdm.dirty=true;_sqAdmRender()">' + esc(t) + ' ×</button>'; }).join('') : '<span class="sp-small">None chosen yet.</span>') + '</div>';
  if (!tp) return h + '<div class="sp-small">Loading ZoomInfo’s topics…</div></div>';
  if (tp.error) return h + '<div class="sp-small">' + esc(tp.error) + '</div></div>';
  var sug = (tp.suggested || []).filter(function (s) { return chosen.indexOf(s.topic) < 0; });
  if (sug.length) h += '<div class="sq-gh">Suggested from your ICP and products</div><div class="sp-chips">' + sug.slice(0, 12).map(function (s) {
    return '<button type="button" class="sp-chip" title="Shares: ' + esc(s.because.join(', ')) + '" onclick="_sqAddTopic(' + esc(JSON.stringify(s.topic)) + ')">+ ' + esc(s.topic) + '</button>'; }).join('') + '</div>';
  h += '<div class="sq-row"><input class="sq-txt" id="sqTopicQ" placeholder="Search ' + (tp.total || '') + ' ZoomInfo topics" onkeydown="if(event.key===\'Enter\')_sqTopicSearch()"><button class="g-btn" type="button" onclick="_sqTopicSearch()">Search</button></div>';
  if (tp.matches && tp.matches.length) h += '<div class="sp-chips">' + tp.matches.map(function (t) { return '<button type="button" class="sp-chip" onclick="_sqAddTopic(' + esc(JSON.stringify(t.name)) + ')">+ ' + esc(t.name) + '</button>'; }).join('') + '</div>';
  return h + '</div>';
}
function _sqAddTopic(t) { var a = _sqAdm.s.zi_topics = _sqAdm.s.zi_topics || []; if (a.indexOf(t) < 0 && a.length < 50) a.push(t); _sqAdm.dirty = true; _sqAdmRender(); }
async function _sqTopicSearch() {
  var q = (document.getElementById('sqTopicQ') || {}).value || '';
  var t = await _sampEdge('zoominfo_topics', { q: q });
  if (t.ok) { _sqAdm.topics = t; _sqAdmRender(); var el = document.getElementById('sqTopicQ'); if (el) el.value = q; }
}
async function _sqSave() {
  var S = Object.assign({}, _sqAdm.s);
  var hosts = ((document.getElementById('sqHosts') || {}).value || '').split(/[\s,]+/).filter(Boolean);
  S.visitors_hosts = hosts;
  var msg = document.getElementById('sqSaveMsg'); if (msg) msg.textContent = 'Saving…';
  var d = await _sampEdge('save_intel_settings', { settings: S, visitors_consent: !!_sqAdm.consent, app_origin: window.location.origin });
  if (!d.ok) { if (msg) msg.textContent = ''; showToast(d.error || 'Could not save'); return; }
  _sqAdm.s = d.settings; _sqAdm.snippet = d.snippet; _sqAdm.credits = d.credits_this_month || _sqAdm.credits; _sqAdm.dirty = false;
  _sqAdmRender(); showToast('Saved');
}
