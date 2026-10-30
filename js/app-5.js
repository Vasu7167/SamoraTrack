// SamoraOS app, part 5 of 5. Loaded in order after app-4.js.
function _spInsightsHtml(id, o) {
  var ins = o.insights || {}, c = o.counts;
  if (!c.sent) return '<div class="sp-card sp-empty">Insights appear once the first emails have gone out.</div>';
  var bar = function (label, val, max, v, tone) { var w = max ? Math.round(val / max * 100) : 0; return '<div class="sp-hb"><span>' + esc(label) + '</span><div class="t"><span style="width:' + w + '%;' + (tone ? 'background:' + tone : '') + '"></span></div><span class="v">' + v + '</span></div>'; };
  var waves = (ins.by_wave || []).filter(function (w) { return w.sent; });
  var maxW = Math.max.apply(null, waves.map(function (w) { return w.rate || 0; }).concat([1]));
  var waveCard = '<section class="sp-card sp-pad"><div class="sp-ih">Which email works</div>' + waves.map(function (w) { return bar(w.label, w.rate || 0, maxW, w.replies + ' of ' + w.sent + ' · ' + (w.rate || 0) + '%'); }).join('') +
    (function () { var tot = waves.reduce(function (a, w) { return a + w.replies; }, 0); if (tot < 2) return '<div class="sp-small" style="margin-top:12px">Each reply is credited to the email it answered. More replies make this clearer.</div>'; var top = waves.slice().sort(function (a, b) { return b.replies - a.replies; })[0]; return '<div class="sp-tk2">' + esc(top.label) + ' earns ' + Math.round(top.replies / tot * 100) + '% of replies. ' + (top.launch === 1 ? 'Lead with the strongest line, not a warm-up.' : 'The follow-ups are pulling their weight; keep them adding something new.') + '</div>'; })() + '</section>';
  var sen = ins.by_seniority || [];
  var maxS = Math.max.apply(null, sen.map(function (s) { return s.rate || 0; }).concat([1]));
  var senCard = '<section class="sp-card sp-pad"><div class="sp-ih">Who replies</div>' + (sen.length ? sen.map(function (s) { return bar(s.band, s.rate || 0, maxS, s.replied + ' of ' + s.reached + ' · ' + (s.rate || 0) + '%'); }).join('') : '<div class="sp-small" style="margin-top:10px">Shows once people with titles have been reached.</div>') +
    (function () { var solid = sen.filter(function (s) { return s.reached >= 4; }); if (solid.length < 2) return '<div class="sp-small" style="margin-top:12px">Grouped by the seniority in each person\'s title.</div>'; var b = solid.slice().sort(function (x, y) { return (y.rate || 0) - (x.rate || 0); })[0]; return '<div class="sp-tk2">' + esc(b.band) + ' reply most here, at ' + (b.rate || 0) + '%. <a href="#" onclick="event.preventDefault();setSampTab(\'' + esc(id) + '\',\'people\');setTimeout(function(){try{openSampaignScoutProfile(\'' + esc(id) + '\')}catch(e){}},400)">Aim the next scout at them</a></div>'; })() + '</section>';
  var comp = (ins.by_company || []);
  var orgs = comp.slice(0, 14).map(function (x) { var cls = x.replied ? 'sp-o1' : x.reached ? 'sp-o2' : 'sp-o3'; var t = x.replied ? _spPlural(x.replied, 'reply', 'replies') + (x.interested ? ', ' + x.interested + ' interested' : '') : x.reached ? x.reached + ' reached, none yet' : (x.people ? 'not reached yet' : 'no people yet'); return '<div class="sp-org"><i class="' + cls + '"></i><span>' + esc(x.company) + ' · ' + esc(t) + '</span></div>'; }).join('');
  var engaged = comp.filter(function (x) { return x.replied; }).length;
  var gap = comp.filter(function (x) { return x.reached >= 3 && !x.replied; }).sort(function (a, b) { return b.reached - a.reached; })[0];
  var compCard = '<section class="sp-card sp-pad"><div class="sp-ih">Which companies engage</div><div class="sp-orgs">' + orgs + '</div><div class="sp-tk2">' + engaged + ' of ' + comp.length + ' ' + (comp.length === 1 ? 'company is' : 'companies are') + ' talking.' + (gap ? ' ' + esc(gap.company) + ' has ' + gap.reached + ' people reached and nothing back: try a different person or angle.' : '') + '</div></section>';
  var lag = ins.reply_lag || { bins: [] }, maxL = Math.max.apply(null, (lag.bins || []).concat([1]));
  var lagLbl = ['Same day', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', '7+'];
  var lagCard = '<section class="sp-card sp-pad"><div class="sp-ih">How fast people reply</div>' + (lag.n ? '<div class="sp-hist">' + (lag.bins || []).map(function (b, i) { return '<div><span style="height:' + Math.max(3, Math.round(b / maxL * 100)) + '%"></span><small>' + lagLbl[i] + '</small></div>'; }).join('') + '</div><div class="sp-tk2">Half reply within ' + lag.median_days + (lag.median_days === 1 ? ' day' : ' days') + '; ' + lag.within_3_days + '% within 3 days of an email. ' + (lag.within_3_days >= 80 ? 'A 4 to 5 day gap between emails loses nothing.' : 'Leave room between emails; some replies take a while.') + '</div>' : '<div class="sp-small" style="margin-top:10px">Shows once replies are timed. Reply times are recorded from the latest update on.</div>') + '</section>';
  var heat = ins.heat || { counts: [] }, flat = [].concat.apply([], heat.counts || []), maxH = Math.max.apply(null, flat.concat([1]));
  var cell = function (v) { var a = v ? 0.18 + 0.62 * (v / maxH) : 0; return '<i style="background:' + (v ? 'rgba(59,109,17,' + a.toFixed(2) + ')' : 'rgba(127,127,127,.08)') + '" title="' + v + '"></i>'; };
  var heatCard = '<section class="sp-card sp-pad"><div class="sp-ih">When replies arrive</div>' + (flat.some(Boolean) ? '<div class="sp-heat"><span></span>' + (heat.cols || []).map(function (c) { return '<span>' + c + '</span>'; }).join('') + (heat.rows || []).map(function (r, i) { return '<span>' + r + '</span>' + heat.counts[i].map(cell).join(''); }).join('') + '</div>' : '<div class="sp-small" style="margin-top:10px">Shows once replies are timed.</div>') + '</section>';
  var del = ins.deliverability || {};
  var delCard = '<section class="sp-card sp-pad"><div class="sp-ih">Deliverability</div><div style="display:flex;align-items:baseline;gap:10px;margin-top:8px;flex-wrap:wrap"><span class="sp-big ' + ((del.rate || 0) > 5 ? 'sp-r' : 'sp-g') + '">' + (del.rate || 0) + '%</span><span class="sp-muted">' + del.bounced + ' of ' + del.sent + ' bounced; the safe line is 3%</span></div>' +
    ((del.rate || 0) > 3 ? '<div class="sp-tk2">Verify addresses before the next email. Above 5%, Gmail and Outlook start trusting the mailbox less. <a href="#" onclick="event.preventDefault();sampPeopleFilterGo(\'' + esc(id) + '\')">See who bounced</a></div>' : '<div class="sp-small" style="margin-top:12px">Healthy. Keep using found or verified addresses.</div>') + '</section>';
  return '<div class="sp-ins">' + waveCard + senCard + compCard + lagCard + heatCard + delCard + '</div>';
}
function sampPeopleFilterGo(id) { window._sampaignStatusFilter = 'dead'; setSampTab(id, 'people'); }

// Refresh hooks used by the inbox sync elsewhere in the app
async function syncSampaignCampaign(campaignId) {
  showToast('Checking the mailbox…');
  var d = await _sampEdge('sync_sampaigns', { campaign_id: campaignId });
  if (!d.ok) { showToast(d.error || 'Could not check the mailbox'); return; }
  var s = (typeof _sampaignSyncSummary === 'function') ? _sampaignSyncSummary(d) : '';
  showToast(s ? 'Updated: ' + s : 'Nothing new in the mailbox');
  if (window._sampOpenId === campaignId) { await _sampLoadOverview(campaignId); setSampTab(campaignId, window._sampTab); }
}

// ── New SAMpaign ────────────────────────────────────────────────────────────
function toggleNewSampaignForm() { sampOpenWizard(); }
function _spNextWeekday(from) { var d = from ? new Date(from) : new Date(); d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
function _spAddWorkdays(iso, n) { var d = new Date(iso + 'T12:00:00'); var left = n; while (left > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) left--; } return d.toISOString().slice(0, 10); }
function sampOpenWizard() {
  // Re-read the add-on first, so a switch Samora just made shows here.
  if (!window._spWizCfgChecked) { window._spWizCfgChecked = true; _liEnsureConfig().then(function () { window._spWizCfgChecked = false; var W = window._sampW; if (W && W.step === 3) _spWizRender(); }); }
  window._sampW = { step: 1, scope: 'account', name: '', domain: '', region: '', listName: '', listRegion: '', companies: '', people: '', titles: '', goal: '', metric: 'meetings', target: '', focus: '', start: _spNextWeekday(), ups: [4, 9], li: true, writeNow: true, seq: _spSeqTpl('email_first', _spNextWeekday()) };
  var page = document.getElementById('sampWizardPage'); if (!page) return;
  _spShow('new');
  _spWizRender();
  _sampEdge('get_org_setting', { key: 'campaign_goal_templates' }).then(function (d) { try { var v = d.value; window._sampGoalTpl = Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v) : []); if (window._sampW && window._sampW.step === 2) _spWizRender(); } catch (e) {} });
}
function _spWizSave() {
  var W = window._sampW; if (!W) return;
  var v = function (id) { var el = document.getElementById(id); return el ? el.value : undefined; };
  ['name', 'domain', 'region', 'listName', 'listRegion', 'companies', 'people', 'titles', 'goal', 'metric', 'target', 'focus', 'start', 'lang'].forEach(function (k) { var x = v('spw_' + k); if (x !== undefined) W[k] = x; });
  var thp = document.querySelector('input[name="spw_thp"]:checked'); if (thp) W.thPolite = thp.value;
  if (document.getElementById('spwMaxT')) W.size = _g34SizeRead('spw');
  var csv = document.getElementById('spw_csv'); if (csv && csv.files && csv.files[0]) W.csv = csv.files[0];
  var wn = document.getElementById('spw_writeNow'); if (wn) W.writeNow = wn.checked;
  var li = document.getElementById('spw_li'); if (li) W.li = li.checked;
  document.querySelectorAll('[data-spw-up]').forEach(function (inp) { W.ups[Number(inp.getAttribute('data-spw-up'))] = Math.max(1, parseInt(inp.value, 10) || 1); });
}
function _spWizParsePeople(text) {
  var out = [], bad = 0;
  String(text || '').split(/\r?\n/).forEach(function (line) {
    var parts = line.split(/[,\t;]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!parts.length) return;
    var email = parts.find(function (p) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p); });
    var rest = parts.filter(function (p) { return p !== email; });
    if (!email && !rest.length) return;
    if (!rest[0]) { bad++; return; }
    out.push({ name: rest[0], email: email || '', title: rest[1] || '', company: rest[2] || '' });
  });
  return { rows: out, bad: bad };
}
function _spWizParseCompaniesOld(text) {
  return String(text || '').split(/\r?\n/).map(function (line) {
    var p = line.split(/[,\t;]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!p.length) return null;
    var dom = p.find(function (x) { return /\.[a-z]{2,}$/i.test(x) && !/\s/.test(x); }) || '';
    var name = p.find(function (x) { return x !== dom; }) || dom.replace(/\..*$/, '');
    return { name: name, domain: dom };
  }).filter(Boolean);
}
function _spWizDates() { var W = window._sampW; return W.seq ? _spSeqDates(W.seq).followups : W.ups.map(function (n) { return _spAddWorkdays(W.start, n); }); }
function _spWizRender() {
  var W = window._sampW, page = document.getElementById('sampWizardPage'); if (!W || !page) return;
  var steps = ['Who', 'Goal', 'Sequence', 'Review'];
  var stepper = '<div class="sp-stepper">' + steps.map(function (s, i) { var n = i + 1, cls = n === W.step ? 'on' : n < W.step ? 'done' : ''; return '<div class="' + cls + '"><b>' + (n < W.step ? '✓' : n) + '</b>' + s + '</div>'; }).join('') + '</div>';
  var body = '';
  if (W.step === 1) {
    body = '<div class="sp-ih">Who are you reaching?</div><div class="sp-opts">' +
      '<button type="button" class="sp-opt ' + (W.scope === 'account' ? 'on' : '') + '" onclick="_spWizSave();window._sampW.scope=\'account\';_spWizRender()"><b>One account</b><span>Several people inside one company. Replies feed that account in Pipeline.</span></button>' +
      '<button type="button" class="sp-opt ' + (W.scope === 'list' ? 'on' : '') + '" onclick="_spWizSave();window._sampW.scope=\'list\';_spWizRender()"><b>A list of companies</b><span>The same outreach to many companies, like 10 institutes or 40 FMCG brands.</span></button></div>' +
      (W.scope === 'account'
        ? '<div class="sp-row3"><label class="sp-fld">Company<input id="spw_name" value="' + esc(W.name) + '" placeholder="Jotun Paints"></label><label class="sp-fld">Website<input id="spw_domain" value="' + esc(W.domain) + '" placeholder="jotun.com"></label><label class="sp-fld">Region <small>optional</small><input id="spw_region" value="' + esc(W.region) + '" placeholder="UAE"></label></div>'
        : '<div class="sp-row2"><label class="sp-fld">Name of the list<input id="spw_listName" value="' + esc(W.listName) + '" placeholder="Karnataka top 10 institutes"></label><label class="sp-fld">Region <small>optional, for the whole list</small><input id="spw_listRegion" value="' + esc(W.listRegion || '') + '" placeholder="India"></label></div>' + _g19TamWizCard() + '<label class="sp-fld">Companies, one per line<small>Name and website, and a region if it differs: Acme Foods, acmefoods.com, UAE. SAM scouts people in each company\u2019s region.</small><textarea id="spw_companies" placeholder="Acme Foods, acmefoods.com&#10;Globex Retail, globexretail.com, UAE">' + esc(W.companies) + '</textarea></label>') +
      '<div class="sp-ih" style="margin-top:22px">Who inside them?</div>' +
      '<label class="sp-fld">Upload a CSV <small>Columns like name, email, title, company. Header names are flexible.</small><input id="spw_csv" type="file" accept=".csv,text/csv"></label>' + (W.csv ? '<div class="sp-small">Chosen: ' + esc(W.csv.name) + '</div>' : '') +
      '<label class="sp-fld">Or type people, one per line <small>Name, email, title, company. Email can be left out and found later.</small><textarea id="spw_people" placeholder="Anita Rao, anita@nlsiu.ac.in, Registrar">' + esc(W.people) + '</textarea></label>' +
      '<label class="sp-fld">Or let SAM find them <small>Job titles, separated by commas. SAM finds people with these titles right after you create the SAMpaign.</small><input id="spw_titles" value="' + esc(W.titles || '') + '" placeholder="Head of Sales, Marketing Director, CFO"></label>' + _g34SizeHtml(W.size, 'spw');
  } else if (W.step === 2) {
    var tpl = (window._sampGoalTpl || []).slice(0, 6).map(function (t, i) { return '<button type="button" class="sp-chip" style="cursor:pointer;border:0" onclick="var g=document.getElementById(\'spw_goal\');g.value=window._sampGoalTpl[' + i + '].goal||\'\';">' + esc(t.label || t.goal || '') + '</button>'; }).join('');
    body = '<div class="sp-ih">What should it achieve?</div>' +
      '<label class="sp-fld">Goal, in one or two sentences <small>SAM writes every email towards this.</small><textarea id="spw_goal" placeholder="Introduce Rewardify to Jotun\'s UAE leadership and ask for a 25 minute call.">' + esc(W.goal) + '</textarea></label>' +
      (tpl ? '<div class="sp-chips" style="margin-top:8px">' + tpl + '</div>' : '') +
      '<div class="sp-row2"><label class="sp-fld">Success is measured in<select id="spw_metric"><option value="meetings"' + (W.metric === 'meetings' ? ' selected' : '') + '>Meetings booked</option><option value="interested"' + (W.metric === 'interested' ? ' selected' : '') + '>Interested replies</option><option value="replies"' + (W.metric === 'replies' ? ' selected' : '') + '>Replies</option></select></label>' +
      '<label class="sp-fld">Target <small>optional</small><input id="spw_target" type="number" min="1" value="' + esc(W.target) + '" placeholder="3"></label></div>' +
      '<label class="sp-fld">Focus, shown on the card <small>optional, short</small><input id="spw_focus" maxlength="48" value="' + esc(W.focus) + '" placeholder="UAE trade marketing"></label>' + _g32WizLang(W);
  } else if (W.step === 3) {
    body = _spSeqWizBody();
  } else {
    var ppl = _spWizParsePeople(W.people).rows;
    var withEmail = ppl.filter(function (p) { return p.email; }).length;
    var who = W.scope === 'account' ? (W.name || 'one account') : (W.listName || 'a list') + ' · ' + _spPlural(_spWizParseCompanies(W.companies).length, 'company', 'companies');
    var dates2 = _spWizDates();
    body = '<div class="sp-ih">Ready to create</div>' +
      '<div class="sp-sum" style="margin-top:14px"><div><span class="sp-lbl">Reaching</span><b style="font-size:16px">' + esc(who) + '</b><span class="sp-small">' + (ppl.length ? _spPlural(ppl.length, 'person', 'people') + ' typed' : '') + (W.csv ? (ppl.length ? ' and ' : '') + 'a CSV' : '') + (!ppl.length && !W.csv ? 'add people after creating' : '') + '</span></div>' +
      _spSeqSumEmails(W.seq) + _spSeqSumFirst(W.seq) + '</div>' +
      '<div class="sp-sum" style="margin-top:12px"><div><span class="sp-lbl">Goal</span><b style="font-size:16px">' + esc(W.target ? W.target + ' ' : '') + ({ meetings: 'meetings booked', interested: 'interested replies', replies: 'replies' })[W.metric] + '</b></div>' +
      '<div><span class="sp-lbl">Mailbox</span><b style="font-size:16px">Yours</b><span class="sp-small">sends are spread to protect it</span></div>' +
      _spSeqSumLi(W.seq) + '</div>' +
      (function () { var t = String(W.titles || '').trim(); var li = W.seq ? (_spSeqHas(W.seq, 'invite') || _spSeqHas(W.seq, 'visit')) : W.li; var steps = [];
        steps.push(t ? 'SAM finds people titled ' + esc(t.split(',').slice(0, 3).join(', ')) + (ppl.length || W.csv ? ', alongside the ones you added.' : '.') : (ppl.length || W.csv ? 'Your people are added.' : 'You add people, or SAM finds them by job title. One click on the SAMpaign page.'));
        steps.push('SAM writes one email per person' + (W.lang && W.lang !== 'en' ? ' in ' + (W.lang === 'auto' ? 'each person\'s own language' : _g32Name(W.lang)) : '') + ', with your signature. You read and edit each one.');
        if (li) steps.push('SAM writes a short LinkedIn note for each invite.');
        steps.push('You press Schedule. Emails go out over a few days, follow-ups after, and everything stops for anyone who replies.');
        return '<div class="g18-next"><div class="sp-lbl">What happens next</div><ol>' + steps.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol><div class="sp-small" style="margin-top:6px">The SAMpaign page shows a launch plan with the next step as one button.</div></div>'; })() +
      '<label class="sp-check"><input id="spw_writeNow" type="checkbox"' + (W.writeNow ? ' checked' : '') + '><span>Have SAM write the first emails right after creating' + (W.csv || withEmail ? '' : ' (once people with emails are added)') + '. You review and edit every one; nothing sends until you press Schedule.</span></label>';
  }
  page.innerHTML = '<div class="sp-wiz"><button class="sp-back" type="button" onclick="sampBackToList()">' + SP_ICON.back + 'All SAMpaigns</button>' +
    '<h1 class="sp-title">New SAMpaign</h1><div class="sp-sub">Four short steps. Nothing is sent until you approve the drafts.</div>' + stepper +
    '<section class="sp-card" style="padding:24px 26px">' + body +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="_spWizBack()">' + (W.step === 1 ? 'Cancel' : 'Back') + '</button><button class="g-btn sp-gold" type="button" id="spw_next" onclick="_spWizNext()">' + (W.step === 4 ? 'Create SAMpaign' : 'Continue') + '</button></div></section></div>';
}
function _spWizBack() { var W = window._sampW; _spWizSave(); if (W.step === 1) { sampBackToList(); return; } W.step--; _spWizRender(); }
function _spWizNext() {
  var W = window._sampW; _spWizSave();
  if (W.step === 1) {
    if (W.scope === 'account') {
      if (!String(W.name).trim()) { showToast('Add the company name'); return; }
      if (!String(W.domain).trim()) { showToast('Add the company website, it links replies to the right account'); return; }
    } else {
      if (!String(W.listName).trim()) { showToast('Give the list a name'); return; }
      if (!_spWizParseCompanies(W.companies).length) { showToast('Add at least one company'); return; }
    }
    var pp = _spWizParsePeople(W.people);
    if (pp.bad) { showToast('Some lines have an email but no name. Put the name first.'); return; }
  }
  if (W.step === 2 && !String(W.goal).trim()) { showToast('Write the goal in a sentence, SAM writes towards it'); return; }
  if (W.step === 3 && W.seq) { var se = _spSeqCheck(W.seq); if (se) { showToast(se); return; } W.li = _spSeqHas(W.seq, 'invite') || _spSeqHas(W.seq, 'visit'); }
  if (W.step < 4) { W.step++; _spWizRender(); return; }
  _spWizCreate();
}
async function _spWizCreate() {
  var W = window._sampW, btn = document.getElementById('spw_next');
  if (window._spCreating) return; window._spCreating = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  try {
    var dates = _spWizDates();
    var base = { campaign_goal: String(W.goal).trim(), focus: String(W.focus).trim() || null, followup_dates: dates, goal_metric: W.metric, goal_target: parseInt(W.target, 10) || null, channels: { email: !W.seq || _spSeqHas(W.seq, 'email'), linkedin: !!W.li }, alerts_enabled: { ooo: true, replied: true, no_response: true, dead: true } };
    var d = W.scope === 'account'
      ? await _sampEdge('create_sampaign', Object.assign({ account_name: String(W.name).trim(), domain: String(W.domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), region: String(W.region).trim() || null }, base))
      : await _sampEdge('create_sampaign', Object.assign({ scope: 'list', list_name: String(W.listName).trim(), region: String(W.listRegion || '').trim() || null, accounts: _spWizParseCompanies(W.companies) }, base));
    if (!d.ok || !d.campaign) { showToast(d.error || 'Could not create the SAMpaign'); return; }
    var id = d.campaign.id, name = d.campaign.name;
    // Drop R: the language, before anything is written.
    if (W.lang && W.lang !== 'en') { try { await _sampEdge('set_outreach_language', { campaign_id: id, lang: W.lang, fallback: 'en', approve_all: true, th_polite: (W.lang === 'th' || W.lang === 'auto') ? (W.thPolite || 'none') : undefined }); } catch (e) {} }
    try { await _syncSampaignFupTasks(id, name, [], dates); } catch (e) {}
    // The whole sequence in one save: email days and LinkedIn days together.
    var seqR = null;
    if (W.seq) { try { seqR = await _spSeqSave(id, W.seq); } catch (e) { seqR = null; } }
    if ((!seqR || !seqR.ok) && W.li) { try { await _sampEdge('set_sampaign_linkedin', { campaign_id: id, on: true }); } catch (e) {} }
    var pp = _spWizParsePeople(W.people).rows;
    if (pp.length) {
      var up = await _sampEdge('upload_sampaign_contacts', { campaign_id: id, contacts: pp });
      if (!up.ok) showToast('Created, but adding people failed: ' + (up.error || ''));
    }
    if (W.csv) { try { await _uploadSampaignCsvFile(id, W.csv); } catch (e) { showToast('Created, but the CSV failed: ' + e.message); } }
    var titles = String(W.titles || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (W.size && (W.size.maxTotal || W.size.maxPerCompany || W.size.leadersOnly)) await _g34SizeSave(id, W.size);
    if (titles.length) { try { await _sampEdge('save_org_setting', { key: 'scout_profile_sampaign_' + id, value: JSON.stringify({ jobTitles: titles, departments: [], seniorities: [], locations: [] }) }); } catch (e) {} }
    showToast('SAMpaign created');
    if (W.tamAccept && W.tamAccept.length) { _sampEdge('commit_discovery', { mark_only: true, accept_ids: W.tamAccept }).catch(function () {}); }
    window._sampaignCampaignsCache = window._sampaignCampaignsCache || {};
    window._sampaignCampaignsCache[id] = Object.assign({}, d.campaign, { is_owner: true, owner_email: currentUser.email });
    openSampaignDetail(id, 'overview');
    if (titles.length || (W.size && W.size.leadersOnly)) { try { await scoutSampaignContacts(id); } catch (e) {} }
    if (W.writeNow && (!W.seq || _spSeqHas(W.seq, 'email'))) {
      var o = await _sampLoadOverview(id);
      var w1 = o && o.ok ? (o.waves || [])[0] : null;
      if (w1 && w1.ready) sampWriteDrafts(id, 1);
      else { await _sampLoadOverview(id); showToast('Next: find the people. The launch plan has it as one button.'); }
    }
  } catch (e) { showToast('Error: ' + e.message); }
  finally { window._spCreating = false; if (btn) { btn.disabled = false; btn.textContent = 'Create SAMpaign'; } }
}

// ════════════════════════════════════════════════════════════════════════════
// Samora for LinkedIn in SamoraOS (2026-10-03)
// One-click connect for the Chrome plugin, the LinkedIn plugin row in You, and
// LinkedIn steps inside each SAMpaign's Sequence: a profile visit, an invite
// with a note SAM writes, and a message once they accept.
// ════════════════════════════════════════════════════════════════════════════
var LI_STORE_URL = window.SAMORA_LI_STORE_URL || '';
var LI_ZIP_URL = '/downloads/samora-for-linkedin.zip';
var LI_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V16M8 7.8v.2M11.5 16v-3.2a2.3 2.3 0 014.6 0V16M11.5 10.5V16"/></svg>';
window._liExt = null;
function _liExtVersion() { return document.documentElement.getAttribute('data-samora-ext') || (window._liExt && window._liExt.version) || null; }
window.addEventListener('message', function (ev) {
  if (ev.source !== window || ev.origin !== location.origin) return;
  var d = ev.data;
  if (!d || d.source !== 'samora-ext') return;
  if (d.type === 'samora:hello') { window._liExt = d; try { _liRefreshChip(); } catch (e) {} }
  if (d.type === 'samora:paired' && typeof window._liPairWait === 'function') window._liPairWait(d);
});
function _liPing() { try { window.postMessage({ source: 'samora-app', type: 'samora:ping' }, location.origin); } catch (e) {} }
function _liWaitExt(ms) {
  return new Promise(function (res) {
    if (_liExtVersion()) return res(true);
    _liPing();
    var t0 = Date.now();
    var iv = setInterval(function () { if (_liExtVersion()) { clearInterval(iv); res(true); } else if (Date.now() - t0 > ms) { clearInterval(iv); res(false); } }, 150);
  });
}

// ── Connect sheet ───────────────────────────────────────────────────────────
function _liSheet(html) {
  var m = document.getElementById('liSheet');
  if (!m) {
    m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'liSheet';
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    document.body.appendChild(m);
  }
  m.innerHTML = '<div class="sp-mcard li-sheet" role="dialog" aria-modal="true" aria-label="Samora for LinkedIn">' + html + '</div>';
  return m;
}
function _liClose() { var m = document.getElementById('liSheet'); if (m) m.remove(); }
function _liInstallHtml(extra) {
  var store = LI_STORE_URL
    ? '<a class="g-btn sp-gold" href="' + esc(LI_STORE_URL) + '" target="_blank" rel="noopener">Add to Chrome</a>'
    : '';
  return '<div class="li-hd"><span class="li-mk">S</span><div><h3>Get Samora for LinkedIn</h3><p class="sp-muted">Runs the LinkedIn steps of your SAMpaigns from Chrome on this computer.</p></div></div>' +
    (extra ? '<div class="li-note">' + extra + '</div>' : '') +
    (store ? '<div class="li-store">' + store + '<span class="sp-small">From the Chrome Web Store. Updates itself.</span></div><div class="li-or">or install it from a file</div>' : '') +
    '<ol class="li-steps">' +
      '<li><b>Download</b> the plugin and unzip it. <a class="g-btn sp-sm' + (store ? '' : ' sp-gold') + '" href="' + LI_ZIP_URL + '" download>Download</a></li>' +
      '<li>Open <b>chrome://extensions</b> in a new tab and switch on <b>Developer mode</b>, top right.</li>' +
      '<li>Press <b>Load unpacked</b> and choose the unzipped folder. Samora opens this page again and connects by itself.</li>' +
    '</ol>' +
    '<div class="sp-foot"><span class="sp-small">Already installed? Reload this page.</span><span class="sp-acts"><button class="g-btn" type="button" onclick="_liClose()">Close</button><button class="g-btn" type="button" onclick="location.reload()">Reload</button></span></div>';
}
async function liConnect(auto) {
  if (!currentUser || !currentUser.token) return;
  await _liEnsureConfig();
  if (_liLocked()) { _liSheet(_liLockedCard(false)); return; }
  var has = await _liWaitExt(auto ? 2500 : 1200);
  if (!has) { _liSheet(_liInstallHtml()); return; }
  _liSheet('<div class="li-hd"><span class="li-mk">S</span><div><h3>Connecting this Chrome</h3><p class="sp-muted">One moment…</p></div></div>');
  var c = await _sampEdge('create_linkedin_pair_code', {});
  if (!c.ok || !c.code) { _liSheet('<h3>Could not connect</h3><p class="sp-muted">' + esc(c.error || 'Try again in a moment.') + '</p><div class="sp-foot"><span></span><button class="g-btn" type="button" onclick="_liClose()">Close</button></div>'); return; }
  var done = false;
  window._liPairWait = function (d) {
    if (done) return; done = true; window._liPairWait = null;
    if (d.ok) {
      _liSheet('<div class="li-hd"><span class="li-ok">✓</span><div><h3>Connected</h3><p class="sp-muted">Samora for LinkedIn is linked to ' + esc(d.user_email || currentUser.email || 'your account') + '. Finish the last step in the Samora panel on LinkedIn: choose Co-pilot or Autopilot.</p></div></div>' +
        '<div class="sp-foot"><button class="g-btn" type="button" onclick="_liClose()">Close</button><a class="g-btn sp-gold" href="https://www.linkedin.com/feed/" target="_blank" rel="noopener" onclick="_liClose()">Open LinkedIn</a></div>');
      try { _liRefreshChip(); _liRenderYou(); } catch (e) {}
    } else {
      _liSheet('<h3>' + (/already connected/i.test(d.error || '') ? 'Confirm in the Samora panel' : 'Could not connect') + '</h3><p class="sp-muted">' + esc(d.error || 'Pairing failed.') + '</p><div class="sp-foot"><span></span><button class="g-btn" type="button" onclick="_liClose()">Close</button></div>');
    }
  };
  window.postMessage({ source: 'samora-app', type: 'samora:pair-code', code: c.code }, location.origin);
  setTimeout(function () {
    if (done) return; done = true; window._liPairWait = null;
    _liSheet('<h3>The plugin did not answer</h3><p class="sp-muted">Reload this page and try again. If it keeps happening, use a code: open the Samora panel on LinkedIn and type <b class="li-code">' + esc(c.code) + '</b> (valid for 10 minutes).</p><div class="sp-foot"><span></span><button class="g-btn" type="button" onclick="_liClose()">Close</button></div>');
  }, 10000);
}
async function liShowCode() {
  var c = await _sampEdge('create_linkedin_pair_code', {});
  if (!c.ok) { showToast(c.error || 'Could not make a code'); return; }
  _liSheet('<h3>Pairing code</h3><p class="sp-muted">In the Samora panel on LinkedIn, press <b>Use a code instead</b> and type:</p><div class="li-code-big">' + esc(c.code) + '</div><p class="sp-small">Works once, for 10 minutes.</p><div class="sp-foot"><span></span><button class="g-btn" type="button" onclick="_liClose()">Done</button></div>');
}

// Arriving with ?connect=linkedin (the plugin opens this right after install)
// or ?sampaign=<id>&tab=<tab> (links from the plugin panel).
function _liHandleUrl() {
  var q = new URLSearchParams(location.search);
  var did = false;
  if (q.get('connect') === 'linkedin') { did = true; setTimeout(function () { liConnect(true); }, 300); }
  var sid = q.get('sampaign');
  if (sid && /^[0-9a-f-]{36}$/i.test(sid)) {
    did = true;
    setTimeout(function () { try { switchTab('sampaign'); setTimeout(function () { openSampaignDetail(sid, q.get('tab') || 'overview'); }, 600); } catch (e) {} }, 300);
  }
  if (did) { try { history.replaceState(null, '', location.pathname); } catch (e) {} }
}
var _liLaunchBase = launchApp;
launchApp = function () {
  var r = _liLaunchBase.apply(this, arguments);
  setTimeout(function () { try { _liHandleUrl(); } catch (e) {} }, 900);
  return r;
};

// ── You: the LinkedIn plugin row ────────────────────────────────────────────
var _liRenderYouPanelBase = renderYouPanel;
renderYouPanel = function () { var r = _liRenderYouPanelBase.apply(this, arguments); try { _liRefreshChip(); } catch (e) {} return r; };
async function _liStatus(force) {
  if (!force && window._liStatusCache && Date.now() - window._liStatusCache.at < 30000) return window._liStatusCache.d;
  var d = await _sampEdge('get_linkedin_status', {});
  window._liStatusCache = { at: Date.now(), d: d };
  return d;
}
async function _liRefreshChip() {
  var chip = document.getElementById('youLiChip'); if (!chip || !currentUser || !currentUser.token) return;
  await _liEnsureConfig();
  if (_liLocked()) { chip.textContent = 'Locked'; return; }
  var d = await _liStatus();
  var dev = d && d.ok && d.devices && d.devices[0];
  chip.textContent = dev ? (dev.online ? 'Connected' : 'Connected, offline') : (_liExtVersion() ? 'Not connected' : 'Not installed');
}
function _liAgo(iso) { if (!iso) return 'never'; var m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 2 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; }
function _liHour(h) { var hh = ((h + 11) % 12) + 1; return hh + (h < 12 || h === 24 ? ' am' : ' pm'); }
async function _liRenderYou() {
  var box = document.getElementById('youLiBody'); if (!box) return;
  await _liEnsureConfig();
  if (_liLocked()) { box.innerHTML = _liLockedCard(false); return; }
  box.innerHTML = '<div class="sp-small">Checking…</div>';
  var d = await _liStatus(true);
  if (d && d.locked) { box.innerHTML = _liLockedCard(false); return; }
  var ext = _liExtVersion();
  if (!d || !d.ok) { box.innerHTML = '<div class="sp-small">' + esc((d && d.error) || 'Could not load.') + '</div>'; return; }
  var devs = d.devices || [];
  var _liOld = (ext && _liVerLt(ext, LI_EXT_LATEST)) || devs.some(function (v) { return v.version && _liVerLt(v.version, LI_EXT_LATEST); });
  var _liUpd = _liOld ? '<div class="li-note" style="margin-bottom:10px"><b>Update to ' + LI_EXT_LATEST + '.</b> It never sends the same message twice, reads each profile so SAM writes from what it knows, and asks you about anyone who may not be a buyer. <button class="rv-link" type="button" onclick="_liSheet(_liInstallHtml())">Get the update</button></div>' : '';
  var head = devs.length
    ? devs.map(function (v) {
        return '<div class="li-dev"><span class="li-dot ' + (v.online ? 'on' : '') + '"></span><div><b>' + esc(v.label || 'Chrome') + '</b><small>' + (v.online ? 'Online now' : 'Last seen ' + _liAgo(v.last_seen_at)) + (v.linkedin_name ? ' · LinkedIn: ' + esc(v.linkedin_name) : '') + (v.version ? ' · v' + esc(v.version) : '') + '</small></div></div>';
      }).join('') +
      '<div class="li-meta"><span><b>' + (d.mode === 'autopilot' ? 'Autopilot' : 'Co-pilot') + '</b> mode</span><span>' + (d.today.invites || 0) + ' of ' + d.limit + ' invites today</span><span>' + _liHour(d.window.start) + ' to ' + _liHour(d.window.end) + (d.window.skip_weekends ? ', weekdays' : ', every day') + '</span>' + (d.queued ? '<span>' + d.queued + ' queued</span>' : '') + '</div>' +
      (d.paused_until ? '<div class="li-note">Paused until ' + esc(new Date(d.paused_until).toLocaleString()) + ' because LinkedIn showed a warning.</div>' : '')
    : '<div class="you-conn"><div class="you-conn-state">' + (ext ? 'Installed, not connected' : 'Not installed') + '</div><div class="you-conn-sub">Samora for LinkedIn runs the LinkedIn steps of your SAMpaigns from Chrome: profile visits, invites with a note, and a message once they accept. Mode, hours and limits are set in the plugin.</div></div>';
  head = _liUpd + head;
  var btns = ext
    ? '<button class="g-btn' + (devs.length ? '' : ' sp-gold') + '" type="button" onclick="liConnect(false)">' + (devs.length ? 'Reconnect this Chrome' : 'Connect this Chrome') + '</button>'
    : '<button class="g-btn sp-gold" type="button" onclick="_liSheet(_liInstallHtml())">Get the plugin</button>';
  box.innerHTML = '<div class="admin-card" style="margin-bottom:0">' + head + '<div class="li-btns">' + btns + '<button class="g-btn sp-ghost" type="button" onclick="liShowCode()">Show a code</button></div><div class="you-fine">Settings live in the plugin: the gear in the Samora panel on LinkedIn.</div></div>';
}

// ── SAMpaign Sequence: LinkedIn steps ───────────────────────────────────────
function _spRenderSeqTop(id) {
  _spRenderSeqTopBase(id);
  _spLiDecorate(id);
}
async function _spLiDecorate(id, force) {
  var steps = document.getElementById('spLiSteps_' + id), side = document.getElementById('spLiSender_' + id);
  if (!steps && !side) return;
  await _liEnsureConfig();
  if (_liLocked()) { if (steps) steps.innerHTML = '<div class="sp-step" data-k="gap" style="display:block">' + _liLockedCard(true) + '</div>'; if (side) side.innerHTML = ''; return; }
  var cache = window._spLiCache = window._spLiCache || {};
  var d = cache[id];
  if (!d || force || Date.now() - d._at > 20000) {
    d = await _sampEdge('get_sampaign_linkedin', { campaign_id: id });
    d._at = Date.now(); cache[id] = d;
  }
  steps = document.getElementById('spLiSteps_' + id); side = document.getElementById('spLiSender_' + id);
  if (!d.ok) { if (steps) steps.innerHTML = ''; if (side) side.innerHTML = ''; return; }
  if (d.locked) { if (steps) steps.innerHTML = '<div class="sp-step" data-k="gap" style="display:block">' + _liLockedCard(true) + '</div>'; if (side) side.innerHTML = ''; return; }
  var owner = d.is_owner, cfg = d.config, s = d.steps;
  var act = function (h) { return owner ? h : ''; };
  var html = '';
  if (cfg.on) {
    var accRate = s.invite.done ? Math.round(s.invite.accepted / s.invite.done * 100) : 0;
    if (cfg.visit) html += '<div class="sp-step" data-k="visit"><span class="sp-sn li">' + LI_ICON + '</span><div><div class="sp-sh">Profile visit <span class="sp-small">· day ' + (cfg.visit_day || 1) + '</span></div><div class="sp-sm2">No note. Your name shows in their viewers before the invite lands' + (s.visit.done || s.visit.queued ? ' · ' + s.visit.done + ' viewed' + (s.visit.queued ? ', ' + s.visit.queued + ' queued' : '') : '') + '</div></div><div class="sp-acts">' + act('<button class="g-btn sp-sm" type="button" onclick="spLiEdit(\'' + esc(id) + '\')">Edit</button>') + '</div></div>';
    html += '<div class="sp-step" data-k="invite"><span class="sp-sn li">' + LI_ICON + '</span><div><div class="sp-sh">LinkedIn invite with a note <span class="sp-small">· day ' + cfg.invite_day + '</span>' + (s.invite.needs_note ? ' <span class="sp-chip warn">' + s.invite.needs_note + ' need a note</span>' : '') + '</div>' +
      '<div class="sp-sm2">' + (s.invite.done ? s.invite.done + ' invited · ' + s.invite.accepted + ' accepted' : 'SAM writes each note, under 300 characters') + (s.invite.queued ? ' · ' + s.invite.queued + ' queued' : '') + '</div>' +
      (s.invite.done ? '<div class="sp-rb li"><span style="width:' + accRate + '%"></span></div><div class="sp-sm2">' + accRate + '% accepted</div>' : '') + '</div>' +
      '<div class="sp-acts">' + act(s.invite.needs_note ? '<button class="g-btn sp-sm sp-gold" type="button" onclick="spLiWrite(\'' + esc(id) + '\',\'invite\')">' + SP_ICON.spark + ' Write ' + s.invite.needs_note + ' with SAM</button>' : '<button class="g-btn sp-sm" type="button" onclick="spLiEdit(\'' + esc(id) + '\')">Edit</button>') + '</div></div>';
    if (cfg.message) html += '<div class="sp-step" data-k="message"><span class="sp-sn li">' + LI_ICON + '</span><div><div class="sp-sh">LinkedIn message <span class="sp-small">· ' + (cfg.message_after_days ? cfg.message_after_days + ' working day' + (cfg.message_after_days > 1 ? 's' : '') + ' after they accept' : 'as soon as they accept') + '</span>' + (s.message.needs_text ? ' <span class="sp-chip warn">' + s.message.needs_text + ' to write</span>' : '') + '</div>' +
      '<div class="sp-sm2">' + (s.message.done ? s.message.done + ' sent · ' + s.message.replied + ' replied on LinkedIn' : 'Builds on the invite note. Skipped for anyone who replied by email') + (s.message.queued ? ' · ' + s.message.queued + ' queued' : '') + '</div></div>' +
      '<div class="sp-acts">' + act(s.message.needs_text ? '<button class="g-btn sp-sm sp-gold" type="button" onclick="spLiWrite(\'' + esc(id) + '\',\'message\')">' + SP_ICON.spark + ' Write ' + s.message.needs_text + ' with SAM</button>' : '') + '</div></div>';
    if (d.people.no_profile) html += '<div class="sp-step li-gap" data-k="gap"><span></span><div class="sp-sm2">' + d.people.no_profile + ' ' + (d.people.no_profile === 1 ? 'person has' : 'people have') + ' no LinkedIn profile, so they get email only. <button class="sp-lnk" type="button" onclick="setSampTab(\'' + esc(id) + '\',\'people\')">Add profiles in People</button></div><span></span></div>';
  } else {
    html = '<div class="sp-step"><span class="sp-sn li">' + LI_ICON + '</span><div><div class="sp-sh">LinkedIn <span class="sp-chip">Off</span></div><div class="sp-sm2">Add a profile visit, an invite with a note and a message after they accept. They run from the Samora Chrome plugin, and a reply on either channel stops the rest.</div></div>' +
      '<div class="sp-acts">' + act('<button class="g-btn sp-sm sp-gold" type="button" onclick="spLiEdit(\'' + esc(id) + '\',true)">Add LinkedIn steps</button>') + '</div></div>';
  }
  if (steps) steps.innerHTML = html;
  if (side) side.innerHTML = _g24LiCard(id, d, owner);
}
function spLiEdit(id, turnOn) {
  var d = (window._spLiCache || {})[id] || {};
  var cfg = Object.assign({ on: true, visit: true, invite_day: 2, message: true, message_after_days: 1 }, d.config || {});
  if (turnOn) cfg.on = true;
  var opt = function (vals, cur, fmt) { return vals.map(function (v) { return '<option value="' + v + '"' + (Number(cur) === v ? ' selected' : '') + '>' + fmt(v) + '</option>'; }).join(''); };
  var m = _liSheet('<h3>LinkedIn steps</h3><p class="sp-muted">They run from the Samora Chrome plugin, alongside the emails. A reply on either channel stops everything for that person.</p>' +
    '<label class="sp-check"><input type="checkbox" id="liOn"' + (cfg.on ? ' checked' : '') + '><span><b>LinkedIn on for this SAMpaign</b></span></label>' +
    '<label class="sp-check"><input type="checkbox" id="liVisit"' + (cfg.visit ? ' checked' : '') + '><span>Profile visit on day 1<br><span class="sp-small">They see your name in their viewers before the invite lands.</span></span></label>' +
    '<div class="sp-row2"><label class="sp-fld">Invite with a note<select id="liDay">' + opt([1, 2, 3, 4, 5, 7, 10], cfg.invite_day, function (v) { return 'Day ' + v + (v === 1 ? ', with the first email' : ''); }) + '</select></label>' +
    '<label class="sp-fld">Message after they accept<select id="liAfter">' + opt([0, 1, 2, 3, 5], cfg.message_after_days, function (v) { return v ? v + ' working day' + (v > 1 ? 's' : '') + ' later' : 'Straight away'; }) + '</select></label></div>' +
    '<label class="sp-check"><input type="checkbox" id="liMsg"' + (cfg.message ? ' checked' : '') + '><span>Send the message once they accept</span></label>' +
    '<p class="sp-small" style="margin-top:14px">People without an email address get the LinkedIn steps only. People with one start on LinkedIn once their first email has gone.</p>' +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="_liClose()">Cancel</button><button class="g-btn sp-gold" type="button" id="liSave">Save</button></div>');
  m.querySelector('#liSave').onclick = async function () {
    this.disabled = true;
    var r = await _sampEdge('set_sampaign_linkedin', { campaign_id: id, on: document.getElementById('liOn').checked, visit: document.getElementById('liVisit').checked, invite_day: Number(document.getElementById('liDay').value), message: document.getElementById('liMsg').checked, message_after_days: Number(document.getElementById('liAfter').value) });
    this.disabled = false;
    if (!r.ok) { showToast(r.error || 'Could not save'); return; }
    _liClose();
    r._at = Date.now(); (window._spLiCache = window._spLiCache || {})[id] = r;
    var n = r.steps && r.steps.invite.needs_note;
    showToast(r.config.on ? (r.plan && r.plan.queued ? r.plan.queued + ' LinkedIn step' + (r.plan.queued > 1 ? 's' : '') + ' queued' : 'LinkedIn steps saved') + (n ? '. ' + n + ' note' + (n > 1 ? 's' : '') + ' to write' : '') : 'LinkedIn is off for this SAMpaign');
    _spLiDecorate(id);
    if (r.config.on && n && r.is_owner) spLiWrite(id, 'invite');
  };
}
async function spLiWrite(id, kind) {
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'liWriteModal';
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Writing"><h3>SAM is writing ' + (kind === 'invite' ? 'invite notes' : 'LinkedIn messages') + '</h3><div class="sp-small" id="liWMsg">Starting…</div><div class="sp-progress"><span id="liWBar" style="width:4%"></span></div><div class="sp-small" style="margin-top:10px">One per person, from their role, company and the first email. ' + (kind === 'invite' ? 'Under 300 characters each.' : '') + '</div><div class="sp-foot"><span></span><button class="g-btn" type="button" id="liWStop">Stop</button></div></div>';
  document.body.appendChild(m);
  var stop = false; document.getElementById('liWStop').onclick = function () { stop = true; this.textContent = 'Stopping…'; };
  var written = 0, skip = [], total = null, err = null, paced = 0, held = 0;
  // Drop S1: all of them in one go, three groups at a time.
  var s1 = await _s1Write({ action: 'write_linkedin_notes', base: { campaign_id: id, kind: kind }, chunk: 6, conc: 3, isStopped: function () { return stop; }, onProgress: _s1Bar('liWMsg', 'liWBar', 'written'), onPace: _s1Pace('liWMsg') });
  if (s1) { written = s1.written; held = s1.held; err = s1.err; }
  if (!s1) for (var i = 0; i < 40 && !stop; i++) {
    var r = await _sampEdge('write_linkedin_notes', { campaign_id: id, kind: kind, batch: 12, skip_ids: skip });
    if (!r.ok) {
      if (r.reason === 'quota' && !r.daily && paced++ < 8) { if (await _spPace(r.retry_after || 30, document.getElementById('liWMsg'), function () { return stop; })) continue; break; }
      if (r.reason === 'overloaded' && paced++ < 4) { if (await _spPace(20, document.getElementById('liWMsg'), function () { return stop; }, 'SAM is busy right now.')) continue; break; }
      err = r.error || 'SAM could not write these.'; break;
    }
    written += r.written || 0; skip = skip.concat(r.missed || []);
    if (total === null) total = written + (r.remaining || 0) + (r.missed || []).length;
    var msg = document.getElementById('liWMsg'), bar = document.getElementById('liWBar');
    if (msg) msg.textContent = written + ' written' + (total ? ' of ' + total : '');
    if (bar) bar.style.width = Math.max(4, Math.round(written / Math.max(1, total || 1) * 100)) + '%';
    held += r.held || 0;
    if (!r.remaining || (!r.written && !r.held && !(r.missed || []).length)) break;
  }
  m.remove();
  var heldTxt = held ? '. ' + held + ' need a look before they go: open Needs you' : '';
  if (err) showToast((written ? written + ' written, then: ' : '') + err); else showToast(written || held ? written + ' written and queued for LinkedIn' + heldTxt : 'Nothing left to write');
  _spLiDecorate(id, true);
}

// ════════════════════════════════════════════════════════════════════════════
// Sequence builder (2026-10-03, second drop)
// Any order across email and LinkedIn: start on LinkedIn, run both together,
// or email only. Day 1 is the start date; days are working days. The same
// builder runs in the New SAMpaign wizard and in Edit sequence.
// ════════════════════════════════════════════════════════════════════════════
var SP_SEQ_TPL = {
  email_first: { label: 'Email first', desc: 'Email on day 1, LinkedIn invite the next day', steps: [{ kind: 'email', day: 1 }, { kind: 'visit', day: 1 }, { kind: 'invite', day: 2 }, { kind: 'message', after: 1 }, { kind: 'email', day: 5 }, { kind: 'email', day: 10 }] },
  li_first: { label: 'LinkedIn first', desc: 'Visit and invite on day 1, first email on day 3', steps: [{ kind: 'visit', day: 1 }, { kind: 'invite', day: 1 }, { kind: 'message', after: 1 }, { kind: 'email', day: 3 }, { kind: 'email', day: 8 }] },
  together: { label: 'Both on day 1', desc: 'Email and invite land the same day', steps: [{ kind: 'email', day: 1 }, { kind: 'visit', day: 1 }, { kind: 'invite', day: 1 }, { kind: 'message', after: 1 }, { kind: 'email', day: 5 }, { kind: 'email', day: 10 }] },
  email_only: { label: 'Email only', desc: 'Three emails, no LinkedIn', steps: [{ kind: 'email', day: 1 }, { kind: 'email', day: 5 }, { kind: 'email', day: 10 }] }
};
var SP_SEQ_KIND = { email: 'Email', visit: 'LinkedIn visit', invite: 'LinkedIn invite', message: 'LinkedIn message' };
function _spSeqTpl(name, start) {
  var t = SP_SEQ_TPL[name] || SP_SEQ_TPL.email_first;
  return { start: start || _spNextWeekday(), tpl: name, steps: t.steps.map(function (s) { return Object.assign({}, s); }) };
}
function _spSeqHas(S, kind) { return !!(S && S.steps || []).some(function (s) { return s.kind === kind; }); }
function _spSeqKey(S, s) {
  if (s.kind !== 'message') return Number(s.day) || 1;
  var inv = (S.steps || []).find(function (x) { return x.kind === 'invite'; });
  return (inv ? Number(inv.day) || 1 : 1) + 0.5 + (Number(s.after) || 0);
}
function _spSeqSorted(S) {
  return (S.steps || []).map(function (s, i) { return { s: s, i: i }; })
    .sort(function (a, b) { return (_spSeqKey(S, a.s) - _spSeqKey(S, b.s)) || (a.i - b.i); });
}
function _spSeqDateOf(S, day) { return _spAddWorkdays(S.start, Math.max(0, (Number(day) || 1) - 1)); }
function _spSeqDates(S) {
  var emails = (S.steps || []).filter(function (s) { return s.kind === 'email'; }).map(function (s) { return Number(s.day) || 1; }).sort(function (a, b) { return a - b; });
  var dates = emails.map(function (d) { return _spSeqDateOf(S, d); });
  return { first: dates[0] || null, followups: dates.slice(1), emails: emails.length };
}
function _spSeqCheck(S) {
  var n = {}; (S.steps || []).forEach(function (s) { n[s.kind] = (n[s.kind] || 0) + 1; });
  if (!S.start) return 'Pick a start date';
  if ((n.email || 0) > 6) return 'Six emails at most';
  if (n.visit > 1 || n.invite > 1 || n.message > 1) return 'One of each LinkedIn step at most';
  if (!n.email && !n.invite) return 'Add at least one email or a LinkedIn invite';
  if (n.message && !n.invite) return 'A LinkedIn message goes after they accept an invite, so add the invite too';
  return '';
}
function _spSeqRow(S, s, i, pos) {
  var isLi = s.kind !== 'email';
  var emailIdx = 0;
  if (!isLi) emailIdx = _spSeqSorted(S).filter(function (x) { return x.s.kind === 'email'; }).findIndex(function (x) { return x.i === i; });
  var emailsTotal = (S.steps || []).filter(function (x) { return x.kind === 'email'; }).length;
  var sub = s.kind === 'email' ? (emailIdx === 0 ? 'First email · personal, short, one ask' : 'Follow-up ' + emailIdx + ' · same thread' + (emailIdx === emailsTotal - 1 ? ', a short close' : ', adds a new reason'))
    : s.kind === 'visit' ? 'No note. They see your name in their viewers'
    : s.kind === 'invite' ? 'SAM writes the note to fit your LinkedIn plan'
    : 'Sent once they accept. Skipped if they already replied';
  var used = {}; (S.steps || []).forEach(function (x, j) { if (j !== i) used[x.kind] = true; });
  var opts = ['email', 'visit', 'invite', 'message'].map(function (k) {
    var dis = k !== 'email' && (used[k] || _liLocked());
    return '<option value="' + k + '"' + (k === s.kind ? ' selected' : '') + (dis ? ' disabled' : '') + '>' + SP_SEQ_KIND[k] + '</option>';
  }).join('');
  var dayCell = s.kind === 'message'
    ? '<label class="sp-dayin sp-seqday"><input type="number" min="0" max="30" value="' + (Number(s.after) || 0) + '" onchange="_spSeqSet(' + i + ',\'after\',this.value)" aria-label="Working days after they accept"><span class="sp-small">days later</span></label>'
    : '<label class="sp-dayin sp-seqday"><span class="sp-small">Day</span><input type="number" min="1" max="60" value="' + (Number(s.day) || 1) + '" onchange="_spSeqSet(' + i + ',\'day\',this.value)" aria-label="Working day of the sequence"></label>';
  var date = s.kind === 'message' ? 'once accepted' : _spDate(_spSeqDateOf(S, s.day));
  return '<div class="sp-sq sp-sqb"><span class="sp-sn' + (isLi ? ' li' : '') + '" style="width:40px;height:40px">' + (isLi ? SP_ICON.li : SP_ICON.mail) + '</span>' +
    '<div><select class="sp-kind" onchange="_spSeqSet(' + i + ',\'kind\',this.value)" aria-label="Step ' + (pos + 1) + '">' + opts + '</select><div class="sp-sm2">' + esc(sub) + '</div></div>' +
    dayCell + '<span class="sp-small sp-date">' + esc(date) + '</span>' +
    '<button class="sp-x" type="button" aria-label="Remove step ' + (pos + 1) + '" onclick="_spSeqDel(' + i + ')">' + SP_ICON.x + '</button></div>';
}
function _spSeqHtml(S) {
  var lockedLi = _liLocked();
  var tpl = Object.keys(SP_SEQ_TPL).map(function (k) {
    var needsLi = SP_SEQ_TPL[k].steps.some(function (s) { return s.kind !== 'email'; });
    var lk = lockedLi && needsLi;
    return '<button type="button" class="sp-opt sp-tpl' + (S.tpl === k ? ' on' : '') + (lk ? ' locked' : '') + '" onclick="_spSeqUseTpl(\'' + k + '\')"' + (lk ? ' aria-disabled="true"' : '') + '><b>' + esc(SP_SEQ_TPL[k].label) + (lk ? '<span class="sp-lk">Add-on</span>' : '') + '</b><span>' + esc(SP_SEQ_TPL[k].desc) + '</span></button>';
  }).join('');
  var rows = _spSeqSorted(S).map(function (x, pos) { return _spSeqRow(S, x.s, x.i, pos); }).join('');
  var n = {}; (S.steps || []).forEach(function (s) { n[s.kind] = (n[s.kind] || 0) + 1; });
  var nextLi = !n.invite ? 'invite' : !n.visit ? 'visit' : !n.message ? 'message' : null;
  var err = _spSeqCheck(S);
  var d = _spSeqDates(S);
  var hasLi = n.invite || n.visit;
  return '<div class="sp-tpls">' + tpl + '</div>' +
    '<label class="sp-fld" style="max-width:240px">Starts on<input id="spSeqStart" type="date" value="' + esc(S.start || '') + '" onchange="_spSeqSet(-1,\'start\',this.value)"></label>' +
    '<div class="sp-seq">' + (rows || '<div class="sp-small">No steps yet. Add an email or a LinkedIn step.</div>') + '</div>' +
    '<div class="sp-acts" style="margin-top:12px">' +
      ((n.email || 0) < 6 ? '<button class="g-btn sp-sm" type="button" onclick="_spSeqAdd(\'email\')">' + SP_ICON.plus + ' Email</button>' : '') +
      (nextLi && !lockedLi ? '<button class="g-btn sp-sm" type="button" onclick="_spSeqAdd(\'' + nextLi + '\')">' + SP_ICON.plus + ' ' + esc(SP_SEQ_KIND[nextLi]) + '</button>' : '') +
    '</div>' + (lockedLi ? '<div style="margin-top:16px">' + _liLockedCard(true) + '</div>' : '') +
    (err ? '<div class="sp-seqerr" role="alert">' + esc(err) + '</div>'
      : '<div class="sp-small" style="margin-top:12px">' + (d.emails ? _spPlural(d.emails, 'email') + ', first on ' + esc(_spDate(d.first)) : 'No emails') + (hasLi ? '. LinkedIn steps run from the Samora Chrome plugin' + (_liExtVersion() ? '' : ' (get it from You, LinkedIn plugin)') : '') + '. Days are working days. A reply on any channel stops the rest for that person.</div>');
}
function _spSeqState() {
  var c = window._spSeqCtx;
  if (c && c.ctx === 'wiz') return window._sampW && window._sampW.seq;
  return c && c.S;
}
function _spSeqRender() {
  var box = document.getElementById('spSeqBox'), S = _spSeqState();
  if (box && S) box.innerHTML = _spSeqHtml(S);
}
function _spSeqSet(i, field, val) {
  var S = _spSeqState(); if (!S) return;
  if (i < 0) { if (field === 'start') S.start = val; }
  else {
    var s = S.steps[i]; if (!s) return;
    if (field === 'kind') {
      s.kind = val;
      if (val === 'message') { delete s.day; s.after = 1; } else { if (s.day == null) s.day = 2; delete s.after; }
    } else if (field === 'day') s.day = Math.max(1, Math.min(60, parseInt(val, 10) || 1));
    else if (field === 'after') s.after = Math.max(0, Math.min(30, parseInt(val, 10) || 0));
  }
  S.tpl = null; _spSeqRender();
}
function _spSeqAdd(kind) {
  var S = _spSeqState(); if (!S) return;
  var last = 0; S.steps.forEach(function (s) { if (s.kind !== 'message') last = Math.max(last, Number(s.day) || 1); });
  var inv = S.steps.find(function (s) { return s.kind === 'invite'; });
  if (kind === 'message') S.steps.push({ kind: 'message', after: 1 });
  else if (kind === 'visit') S.steps.push({ kind: 'visit', day: inv ? Math.max(1, inv.day) : 1 });
  else if (kind === 'invite') S.steps.push({ kind: 'invite', day: Math.max(1, Math.min(60, last ? Math.min(last + 1, 2) : 1)) });
  else S.steps.push({ kind: 'email', day: Math.min(60, (last || 0) + (last ? 5 : 1)) });
  S.tpl = null; _spSeqRender();
}
function _spSeqDel(i) {
  var S = _spSeqState(); if (!S) return;
  var k = S.steps[i] && S.steps[i].kind;
  S.steps.splice(i, 1);
  if (k === 'invite') S.steps = S.steps.filter(function (s) { return s.kind !== 'message'; });
  S.tpl = null; _spSeqRender();
}
function _spSeqUseTpl(name) {
  var S = _spSeqState(); if (!S) return;
  if (_liLocked() && SP_SEQ_TPL[name] && SP_SEQ_TPL[name].steps.some(function (s) { return s.kind !== 'email'; })) { showToast('LinkedIn Automation is an add-on. Ask your Samora admin to unlock it.'); return; }
  var t = _spSeqTpl(name, S.start);
  S.steps = t.steps; S.tpl = name; _spSeqRender();
}
async function _spSeqSave(id, S) {
  return await _sampEdge('set_sampaign_sequence', { campaign_id: id, start_date: S.start, steps: S.steps.map(function (s) { return s.kind === 'message' ? { kind: 'message', after: Number(s.after) || 0 } : { kind: s.kind, day: Number(s.day) || 1 }; }) });
}

// Wizard step 3 and the summary in step 4
function _spSeqWizBody() {
  var W = window._sampW;
  if (!W.seq) W.seq = _spSeqTpl('email_first', W.start || _spNextWeekday());
  if (_liLocked() && W.seq.tpl === 'email_first' && W.seq.steps.some(function (s) { return s.kind !== 'email'; })) W.seq = _spSeqTpl('email_only', W.seq.start);
  window._spSeqCtx = { ctx: 'wiz' };
  return '<div class="sp-ih">The sequence</div><div class="sp-small" style="margin-top:4px">Pick a starting shape, then change any step. Put LinkedIn first, emails first, or both on the same day.</div><div id="spSeqBox">' + _spSeqHtml(W.seq) + '</div>';
}
function _spSeqSumEmails(S) {
  var d = _spSeqDates(S);
  var lastDay = 0; S.steps.forEach(function (s) { if (s.kind === 'email') lastDay = Math.max(lastDay, Number(s.day) || 1); });
  return '<div><span class="sp-lbl">Emails</span><b>' + (d.emails ? d.emails + ' per person' : 'None') + '</b><span class="sp-small">' + (d.emails ? 'over ' + _spPlural(lastDay, 'working day') : 'LinkedIn only') + '</span></div>';
}
function _spSeqSumFirst(S) {
  var first = _spSeqSorted(S)[0];
  var d = _spSeqDates(S);
  var what = first ? (first.s.kind === 'email' ? 'Email' : 'LinkedIn') : '';
  return '<div><span class="sp-lbl">Starts</span><b>' + esc(_spDate(S.start)) + '</b><span class="sp-small">' + esc(what ? what + ' first' : '') + (d.first ? ', first email ' + esc(_spDate(d.first)) : '') + '</span></div>';
}
function _spSeqSumLi(S) {
  var inv = S.steps.find(function (s) { return s.kind === 'invite'; });
  var parts = [];
  if (_spSeqHas(S, 'visit')) parts.push('visit');
  if (inv) parts.push('invite on day ' + inv.day);
  if (_spSeqHas(S, 'message')) parts.push('message after they accept');
  return '<div><span class="sp-lbl">LinkedIn</span><b style="font-size:16px">' + (parts.length ? 'On' : 'Off') + '</b><span class="sp-small">' + esc(parts.length ? parts.join(', ') : 'email only') + '</span></div>';
}

// Edit sequence on an existing SAMpaign
function _spWorkdaysBetween(a, b) {
  var d = new Date(a + 'T12:00:00'), end = new Date(b + 'T12:00:00'), n = 0;
  if (end <= d) return 0;
  while (d < end) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n++; }
  return n;
}
function _spSeqFromCampaign(o, d) {
  var seq = d && d.sequence;
  if (seq && seq.start_date && Array.isArray(seq.steps) && seq.steps.length) {
    return { start: seq.start_date, tpl: null, steps: seq.steps.map(function (s) { return s.kind === 'message' ? { kind: 'message', after: Number(s.after) || 0 } : { kind: s.kind, day: Number(s.day) || 1 }; }) };
  }
  var c = o.campaign || {}, w1 = (o.waves || [])[0] || {};
  var start = String(w1.first_sent || w1.next_send || w1.planned_date || '').slice(0, 10) || _spNextWeekday();
  var steps = [{ kind: 'email', day: 1 }];
  (c.followup_dates || []).map(function (x) { return String(x).slice(0, 10); }).sort().forEach(function (dt) { steps.push({ kind: 'email', day: Math.min(60, _spWorkdaysBetween(start, dt) + 1) }); });
  var cfg = d && d.config;
  if (cfg && cfg.on) {
    if (cfg.visit) steps.push({ kind: 'visit', day: cfg.visit_day || 1 });
    steps.push({ kind: 'invite', day: cfg.invite_day || 2 });
    if (cfg.message) steps.push({ kind: 'message', after: cfg.message_after_days == null ? 1 : cfg.message_after_days });
  }
  return { start: start, tpl: null, steps: steps };
}
async function spSeqEdit(id, mode) {
  var o = (window._sampOv || {})[id]; if (!o || !o.ok) return;
  var d = await _sampEdge('get_sampaign_linkedin', { campaign_id: id });
  var S = _spSeqFromCampaign(o, d.ok ? d : null);
  if (mode === 'add_li' && !_liLocked() && !_spSeqHas(S, 'invite')) {
    var firstEmail = (S.steps.find(function (s) { return s.kind === 'email'; }) || { day: 1 }).day;
    S.steps.push({ kind: 'visit', day: firstEmail }, { kind: 'invite', day: firstEmail + 1 }, { kind: 'message', after: 1 });
  }
  window._spSeqCtx = { ctx: 'edit', id: id, S: S };
  var started = (o.waves || []).some(function (w) { return w.sent || w.pending; });
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'spSeqModal';
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  m.innerHTML = '<div class="sp-mcard sp-wide" role="dialog" aria-modal="true" aria-label="Edit sequence"><h3>Sequence</h3>' +
    '<div id="spSeqBox">' + _spSeqHtml(S) + '</div>' +
    (started ? '<p class="sp-small" style="margin-top:12px">Emails already sent stay as they are, and scheduled emails keep their time; move those from Drafts and queue. LinkedIn steps not yet done move to their new days.</p>' : '') +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'spSeqModal\').remove()">Cancel</button><button class="g-btn sp-gold" type="button" id="spSeqSave">Save sequence</button></div></div>';
  document.body.appendChild(m);
  document.getElementById('spSeqSave').onclick = async function () {
    var S2 = window._spSeqCtx.S, err = _spSeqCheck(S2);
    if (err) { showToast(err); return; }
    this.disabled = true; this.textContent = 'Saving…';
    var r = await _spSeqSave(id, S2);
    if (!r.ok) { this.disabled = false; this.textContent = 'Save sequence'; showToast(r.error || 'Could not save the sequence'); return; }
    try { await _syncSampaignFupTasks(id, o.campaign.name, (o.campaign.followup_dates || []).map(function (x) { return String(x).slice(0, 10); }), r.followup_dates || []); } catch (e) {}
    m.remove();
    if (window._spLiCache) delete window._spLiCache[id];
    var q = r.plan && r.plan.queued, nn = r.plan && r.plan.needs_note;
    showToast('Sequence saved' + (q ? '. ' + q + ' LinkedIn step' + (q > 1 ? 's' : '') + ' lined up' : '') + (nn ? '. ' + nn + ' invite note' + (nn > 1 ? 's' : '') + ' to write' : ''));
    await _sampLoadOverview(id); setSampTab(id, 'sequence');
    if (nn && r.config && r.config.on) spLiWrite(id, 'invite');
  };
}
// The old LinkedIn steps sheet is now part of the sequence.
function spLiEdit(id, turnOn) { spSeqEdit(id, turnOn ? 'add_li' : null); }

// Sequence tab: email and LinkedIn rows in day order once a sequence is set.
function _spRenderSeqTop(id) {
  _spRenderSeqTopBase(id);
  Promise.resolve(_spLiDecorate(id)).then(function () { _spSeqOrderTab(id); }).catch(function () {});
}
function _spSeqOrderTab(id) {
  var d = (window._spLiCache || {})[id], top = document.getElementById('sampSeqTop_' + id);
  if (!d || !d.ok || !top || !d.sequence || !d.sequence.start_date || !Array.isArray(d.sequence.steps)) return;
  var card = top.querySelector('.sp-wv > .sp-card'); if (!card) return;
  var S = { start: d.sequence.start_date, steps: d.sequence.steps };
  var emailDays = S.steps.filter(function (s) { return s.kind === 'email'; }).map(function (s) { return Number(s.day) || 1; }).sort(function (a, b) { return a - b; });
  var dayOf = { visit: null, invite: null, message: null };
  S.steps.forEach(function (s) { if (s.kind !== 'email') dayOf[s.kind] = _spSeqKey(S, s); });
  var rows = [];
  var waveRows = Array.prototype.filter.call(card.children, function (el) { return el.classList.contains('sp-step'); });
  waveRows.forEach(function (el, i) {
    var day = emailDays[i] != null ? emailDays[i] : 99 + i;
    if (emailDays[i] != null && !el.querySelector('.sp-seqd')) { var sh = el.querySelector('.sp-sh'); if (sh) sh.insertAdjacentHTML('beforeend', ' <span class="sp-small sp-seqd">· day ' + day + ' · ' + esc(_spDate(_spSeqDateOf(S, day))) + '</span>'); }
    rows.push({ el: el, day: day, o: rows.length });
  });
  var ph = document.getElementById('spLiSteps_' + id);
  if (ph) Array.prototype.slice.call(ph.children).forEach(function (el) {
    var k = el.getAttribute('data-k');
    rows.push({ el: el, day: k && dayOf[k] != null ? dayOf[k] : 200, o: rows.length });
  });
  rows.sort(function (a, b) { return (a.day - b.day) || (a.o - b.o); });
  rows.forEach(function (r) { card.appendChild(r.el); });
  if (ph) ph.remove();
}

// ── List SAMpaigns: scout every company, with progress ─────────────────────
async function scoutSampaignContacts(campaignId) {
  var o = (window._sampOv || {})[campaignId], cc = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var isList = ((o && o.campaign && o.campaign.scope) || cc.scope) === 'list';
  if (!isList) {
    showToast('Scouting more contacts…');
    var d0 = await _sampEdge('scout_sampaign_contacts', { campaign_id: campaignId });
    if (!d0.list) { _spScoutDone(campaignId, d0, d0.scouted || 0, d0.provider); return; }
    isList = true;
    if (!d0.ok) { _spScoutDone(campaignId, d0, 0); return; }
  }
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'spScoutModal';
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Scouting"><h3>Finding people at the companies in this list</h3><div class="sp-small" id="spScMsg">Looking at the first companies…</div><div class="sp-progress"><span id="spScBar" style="width:4%"></span></div><div class="sp-small" id="spScList" style="margin-top:10px"></div><div class="sp-foot"><span></span><button class="g-btn" type="button" id="spScStop">Stop</button></div></div>';
  document.body.appendChild(m);
  var stop = false; document.getElementById('spScStop').onclick = function () { stop = true; this.textContent = 'Stopping…'; };
  var skip = [], found = 0, doneCo = 0, total = null, err = null, last = null, lines = [];
  for (var i = 0; i < 12 && !stop; i++) {
    var d = await _sampEdge('scout_list_accounts', { campaign_id: campaignId, batch: 10, skip_account_ids: skip });
    last = d;
    if (!d.ok) { err = d; break; }
    if (total === null) total = (d.scanned || 0) + (d.remaining || 0);
    (d.results || []).forEach(function (r) { if (!r.found && r.note) { var k = String(r.note); window._spScNotes = window._spScNotes || {}; window._spScNotes[k] = (window._spScNotes[k] || 0) + 1; } });
    found += d.contacts_found || 0; doneCo += d.scanned || 0;
    (d.no_result_account_ids || []).forEach(function (x) { if (skip.indexOf(x) === -1) skip.push(x); });
    (d.results || []).forEach(function (r) { lines.push(esc(r.account) + ': ' + (r.found ? r.found + ' found' : esc(r.note || 'nobody matching'))); });
    var msg = document.getElementById('spScMsg'), bar = document.getElementById('spScBar'), lst = document.getElementById('spScList');
    if (msg) msg.textContent = doneCo + (total ? ' of ' + total : '') + ' companies, ' + _spPlural(found, 'person', 'people') + ' found';
    if (bar) bar.style.width = Math.max(4, Math.round(doneCo / Math.max(1, total || 1) * 100)) + '%';
    if (lst) lst.innerHTML = lines.slice(-6).join('<br>');
    if (d.stop_reason) { err = { ok: false, error: d.stop_reason, stop: true }; break; }
    if (!d.remaining || !d.scanned) break;
  }
  m.remove();
  // Drop R1: say what happened in one line: who was found, and why not.
  var notes = window._spScNotes || {}; window._spScNotes = {};
  var top = Object.keys(notes).sort(function (a, b) { return notes[b] - notes[a]; })[0] || '';
  if (err && !err.needs_targeting && (found || doneCo)) {
    showToast((found ? _spPlural(found, 'person', 'people') + ' found at ' : 'Nobody found yet at ') + _spPlural(doneCo, 'company', 'companies') + '. ' + (err.error || ''));
    try { var r3 = await _sampEdge('list_sampaign_contacts', { campaign_id: campaignId }); if (r3.ok) { window._sampaignContactsCache[campaignId] = r3.contacts || []; _sampaignContactTab = 'prospective'; _renderSampaignContacts(campaignId); } } catch (e) {}
    try { loadSampaignCampaigns(); } catch (e) {}
    return;
  }
  if (!err && !found && doneCo && top && last) last = Object.assign({}, last, { note: 'Nobody found at ' + _spPlural(doneCo, 'company', 'companies') + '. Most common reason: ' + top.replace(/[.]$/, '') + '. Companies where nobody was found do not count towards your daily limit.' });
  if (err && err.needs_targeting) {
    showToast('Tell SAM who to hunt first, then scout again. That keeps credits on the right people.');
    try { openSampaignScoutProfile(campaignId); } catch (e) {}
    return;
  }
  _spScoutDone(campaignId, err || last || {}, found);
}
async function _spScoutDone(campaignId, d, found, provider) {
  if (!d.ok && !found) { showToast(d.needs_targeting ? 'Tell SAM who to hunt first, then scout again.' : (d.error || 'Scouting is not available right now')); if (d.needs_targeting) { try { openSampaignScoutProfile(campaignId); } catch (e) {} } return; }
  showToast(found ? _spPlural(found, 'new person', 'new people') + ' scouted' + (provider ? ' via ' + provider : '') : (d.note || 'No new people found for this targeting.'));
  try {
    var r2 = await _sampEdge('list_sampaign_contacts', { campaign_id: campaignId });
    if (r2.ok) { window._sampaignContactsCache[campaignId] = r2.contacts || []; _sampaignContactTab = 'prospective'; _renderSampaignContacts(campaignId); }
  } catch (e) {}
  try { loadSampaignCampaigns(); } catch (e) {}
}

// ── Gemini pacing: wait out a per-minute limit instead of stopping ──────────
async function _spPace(secs, msgEl, isStopped, why) {
  for (var s = Math.max(5, secs || 30); s > 0; s--) {
    if (isStopped && isStopped()) return false;
    if (msgEl) msgEl.textContent = (why || 'SAM is pacing itself.') + ' Carrying on in ' + s + 's…';
    await new Promise(function (r) { setTimeout(r, 1000); });
  }
  return true;
}

// ════════════════════════════════════════════════════════════════════════════
// LinkedIn on the SAMpaign cards, the weekly scorecard, and the LinkedIn
// Automation add-on (2026-10-03, third drop)
// ════════════════════════════════════════════════════════════════════════════

// ── The add-on ──────────────────────────────────────────────────────────────
// Locked only when the server says so. Until get_org_config has answered, the
// app shows LinkedIn as it always has; the server enforces it either way.
function _liLocked() {
  var c = window._orgConfig; if (!c) return false;
  if (c.linkedinAutomation === false) return true;
  if (c.linkedinAutomation === true) return false;
  // Older server: read the add-on switch straight from the org's features.
  return !!(c.features && c.features.linkedin_automation === false);
}
function _liApplyLock() { try { document.documentElement.classList.toggle('li-locked', _liLocked()); } catch (_e) {} }
// The org config is read at sign-in, but Samora can switch the add-on on or
// off at any time, so LinkedIn surfaces re-read it when it is a minute old.
var _liCfgP = null, _liCfgAt = 0;
function _liEnsureConfig() {
  if (window._orgConfig && Date.now() - _liCfgAt < 60000) { _liApplyLock(); return Promise.resolve(window._orgConfig); }
  if (!_liCfgP) _liCfgP = _sampEdge('get_org_config').then(function (cfg) {
    if (cfg && cfg.ok) { window._orgConfig = cfg; _liCfgAt = Date.now(); }
    _liApplyLock(); _liCfgP = null;
    return window._orgConfig;
  }).catch(function () { _liCfgP = null; return window._orgConfig || null; });
  return _liCfgP;
}
var LI_LOCK_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/><circle cx="12" cy="15.5" r="1.3"/></svg>';
function _liLockedCard(compact) {
  return '<div class="li-lock' + (compact ? ' sm' : '') + '" role="note" aria-label="LinkedIn Automation is a locked add-on">' +
    '<span class="li-lock-sheen" aria-hidden="true"></span>' +
    '<div class="li-lock-mark">' + LI_LOCK_SVG + '</div>' +
    '<div class="li-lock-body"><div class="li-lock-k">Private add-on</div>' +
      '<div class="li-lock-t">LinkedIn Automation</div>' +
      '<div class="li-lock-s">Invites with a personal note, follow-ups after they accept, all moving in step with your SAMpaigns at a human pace. Unlocked for selected teams by Samora.</div>' +
      '<div class="li-lock-acts"><button class="li-lock-b" type="button" onclick="_liRequestUnlock(this)">Contact Samora to unlock</button><span class="li-lock-f">Contact the Samora team to unlock LinkedIn Automation for your organisation.</span></div>' +
    '</div></div>';
}
async function _liRequestUnlock(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  var d = await _sampEdge('request_addon', { addon: 'linkedin' });
  if (btn) { btn.textContent = d.ok ? 'Samora has your request' : 'Contact Samora to unlock'; btn.disabled = !!d.ok; }
  showToast(d.ok ? 'Sent to the Samora team. They will be in touch to unlock it.' : (d.error || 'Could not reach Samora'));
}

// ── SAMpaign cards: the LinkedIn line ───────────────────────────────────────
// Invited, accepted (with the rate), followed up, replied, interested. The
// bar is the LinkedIn funnel on the same scale as the email one above it.
function _spLiCardLine(c) {
  if (_liLocked()) return '';
  var on = !!(c.channels && c.channels.linkedin && c.channels.linkedin.on);
  var L = c.li_stats;
  if (!L && !on) return '';
  L = L || { invited: 0, accepted: 0, messaged: 0, replied: 0, interested: 0, queued: 0 };
  var inv = L.invited || 0;
  if (!inv) return '<div class="sp-lil"><span class="sp-lik">' + SP_ICON.li + '</span><span class="sp-small">' + (L.queued ? _spPlural(L.queued, 'LinkedIn step') + ' lined up in the plugin' : on ? 'LinkedIn on, nothing sent yet' : '') + '</span></div>';
  var pct = function (n) { return Math.max(0, Math.round(n / inv * 1000) / 10) + '%'; };
  var acc = Math.round((L.accepted || 0) / inv * 100);
  var tone = inv < 10 ? '' : acc >= 35 ? 'sp-g' : acc >= 20 ? 'sp-a' : 'sp-r';
  var interested = L.interested || 0, replied = L.replied || 0, accepted = L.accepted || 0;
  return '<div class="sp-lil"><span class="sp-lik">' + SP_ICON.li + '</span><div style="flex:1;min-width:0">' +
    '<div class="sp-fun sp-lifun" aria-hidden="true"><span class="sp-l1" style="width:' + pct(interested) + '"></span><span class="sp-l2" style="width:' + pct(Math.max(0, replied - interested)) + '"></span><span class="sp-l3" style="width:' + pct(Math.max(0, accepted - replied)) + '"></span><span class="sp-l4" style="width:' + pct(Math.max(0, inv - accepted)) + '"></span></div>' +
    '<div class="sp-fl"><span><b>' + inv + '</b> invited</span><span><b>' + accepted + '</b> accepted' + (inv >= 3 ? ' <b class="' + tone + '">' + acc + '%</b>' : '') + '</span><span><b>' + (L.messaged || 0) + '</b> followed up</span><span><b>' + replied + '</b> replied</span><span class="sp-g"><b class="sp-g">' + interested + '</b> interested</span>' + (L.queued ? '<span class="sp-muted">' + L.queued + ' lined up</span>' : '') + '</div></div></div>';
}

// ── Weekly scorecard ────────────────────────────────────────────────────────
window._sc = window._sc || { data: null, at: 0, view: 'me' };
async function _scLoad(force) {
  if (!currentUser || !currentUser.token) return null;
  var S = window._sc;
  if (!force && S.data && Date.now() - S.at < 60000 && S.view === S.dataView) { _scPaintAll(); return S.data; }
  var d = await _sampEdge('get_scorecard', { scope: S.view === 'team' ? 'team' : 'me' });
  if (!d || !d.ok) return null;
  S.data = d; S.at = Date.now(); S.dataView = S.view;
  _scPaintAll();
  if (d.new_wins && d.new_wins.length) _scCelebrate(d.new_wins, d);
  return d;
}
function _scPaintAll() {
  var d = window._sc.data; if (!d) return;
  var a = document.getElementById('sampScore'); if (a) a.innerHTML = _scHtml(d, false);
  var t = document.getElementById('todayScore'); if (t) t.innerHTML = _scHtml(d, true);
}
var SC_ICON = {
  invites: SP_ICON.li, li_messages: SP_ICON.chat, emails: SP_ICON.mail, followups: SP_ICON.mail,
  meetings: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17M9 14.5l2 2 4-4"/></svg>'
};
function _scHtml(d, compact) {
  var rows = (d.metrics || []).map(function (m) {
    var pct = m.target ? Math.min(100, Math.round(m.value / m.target * 100)) : 0;
    var diff = m.value - (m.last_week || 0);
    var trend = (m.last_week || m.value) ? '<span class="sc-tr ' + (diff > 0 ? 'up' : diff < 0 ? 'dn' : '') + '">' + (diff > 0 ? '+' + diff : diff < 0 ? String(diff) : 'same') + ' vs last week</span>' : '';
    return '<div class="sc-m' + (m.hit ? ' hit' : '') + '"><span class="sc-ic">' + (m.hit ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>' : (SC_ICON[m.key] || '')) + '</span>' +
      '<div class="sc-mb"><div class="sc-mh"><span>' + esc(m.label) + '</span><b>' + m.value + '<small> / ' + m.target + '</small></b></div>' +
      '<div class="sc-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + m.target + '" aria-valuenow="' + m.value + '" aria-label="' + esc(m.label) + '"><span style="width:' + pct + '%"></span></div>' +
      (compact ? '' : trend) + '</div></div>';
  }).join('');
  var head = '<div class="sc-hd"><div><div class="sp-lbl">This week</div><div class="sc-sub">' + (d.hits ? _spPlural(d.hits, 'target') + ' reached' : 'Monday to today') + (d.streak > 1 ? ' · <span class="sc-streak">' + d.streak + '-week streak</span>' : '') + '</div></div>' +
    '<div class="sc-ring" style="--p:' + (d.score || 0) + '"><span>' + (d.score || 0) + '<small>%</small></span></div></div>';
  var tabs = d.can_team && !compact ? '<div class="sp-seg sc-seg" aria-label="Whose week"><button type="button" class="' + (window._sc.view !== 'team' ? 'on' : '') + '" onclick="window._sc.view=\'me\';_scLoad(true)">Me</button><button type="button" class="' + (window._sc.view === 'team' ? 'on' : '') + '" onclick="window._sc.view=\'team\';_scLoad(true)">Team</button></div>' : '';
  var team = window._sc.view === 'team' && d.team && !compact ? '<div class="sc-team">' + d.team.map(function (t) {
    return '<div class="sc-tr2"><span class="sp-av">' + esc(_spIni(t.name)) + '</span><div style="flex:1;min-width:0"><div class="sc-tn">' + esc(t.name) + (t.is_me ? ' <span class="sp-small">you</span>' : '') + '</div><div class="sc-bar sm"><span style="width:' + t.score + '%"></span></div><div class="sp-small">' + t.metrics.map(function (m) { return m.value + ' ' + m.label.toLowerCase(); }).join(' · ') + '</div></div><b class="sc-ts">' + t.score + '%</b></div>';
  }).join('') + '</div>' : '';
  var foot = !compact ? '<div class="sc-ft">' + (d.custom_targets ? 'Targets set by your admin.' : 'Samora\'s starting targets.') + (d.can_set_targets ? ' <button class="sp-lnk" type="button" onclick="_scTargets()">Set team targets</button>' : '') + '</div>' : '';
  if (compact) return '<div class="sc-strip"><div class="sc-sh"><div class="sp-lbl">This week</div><div class="sc-ring sm" style="--p:' + (d.score || 0) + '"><span>' + (d.score || 0) + '<small>%</small></span></div>' + (d.streak > 1 ? '<span class="sc-streak">' + d.streak + '-week streak</span>' : '') + '</div><div class="sc-rows">' + rows + '</div></div>';
  return head + tabs + (team || '<div class="sc-rows">' + rows + '</div>') + foot;
}
function _scTargets() {
  var d = window._sc.data || {}, t = d.targets || {};
  var keys = [['invites', 'LinkedIn invites'], ['li_messages', 'LinkedIn messages'], ['emails', 'First emails'], ['followups', 'Follow-ups'], ['meetings', 'Meetings booked']];
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'scTargetsModal';
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Weekly targets"><h3>Weekly targets for the team</h3><p class="sp-muted" style="margin:4px 0 0">Each person, each week. Hitting one celebrates it once.</p>' +
    '<div class="sp-row2" style="margin-top:6px">' + keys.map(function (k) { return '<label class="sp-fld">' + k[1] + '<input type="number" min="0" max="1000" id="sct_' + k[0] + '" value="' + (t[k[0]] != null ? t[k[0]] : '') + '"></label>'; }).join('') + '</div>' +
    '<p class="sp-small" style="margin-top:12px">LinkedIn allows about 100 invites a week on most plans. A target above that cannot be reached.</p>' +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'scTargetsModal\').remove()">Cancel</button><button class="g-btn sp-gold" type="button" id="sctSave">Save</button></div></div>';
  document.body.appendChild(m);
  document.getElementById('sctSave').onclick = async function () {
    var v = {}; keys.forEach(function (k) { var n = parseInt(document.getElementById('sct_' + k[0]).value, 10); if (n >= 0) v[k[0]] = Math.min(1000, n); });
    this.disabled = true;
    var r = await _sampEdge('save_org_setting', { key: 'weekly_targets', value: v });
    if (!r.ok) { this.disabled = false; showToast(r.error || 'Could not save'); return; }
    m.remove(); showToast('Team targets saved'); _scLoad(true);
  };
}

// The celebration: one quiet, gold moment per target, once a week.
function _scCelebrate(wins, d) {
  var old = document.getElementById('scCele'); if (old) old.remove();
  var word = function (w) { return String(w.label || '').replace(/^(First|Follow|Meetings)/, function (x) { return x.toLowerCase(); }); };
  var names = wins.map(word);
  var line = names.length === 1 ? 'Weekly ' + names[0] + ' target hit' : names.length + ' weekly targets hit';
  var detail = wins.map(function (w) { return w.value + ' ' + word(w); }).join(' · ');
  var el = document.createElement('div'); el.id = 'scCele'; el.className = 'sc-cele'; el.setAttribute('role', 'status');
  el.innerHTML = '<canvas aria-hidden="true"></canvas><div class="sc-cele-c"><div class="sc-cele-k">Samora quota</div><div class="sc-cele-t">' + esc(line) + '</div><div class="sc-cele-s">' + esc(detail) + (d && d.streak > 1 ? ' · ' + d.streak + '-week streak' : '') + '</div></div><button type="button" class="sc-cele-x" aria-label="Close" onclick="this.parentNode.remove()">' + SP_ICON.x + '</button>';
  document.body.appendChild(el);
  requestAnimationFrame(function () { el.classList.add('on'); });
  setTimeout(function () { el.classList.remove('on'); setTimeout(function () { el.remove(); }, 500); }, 7000);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  var cv = el.querySelector('canvas'), ctx = cv.getContext && cv.getContext('2d'); if (!ctx) return;
  var W = cv.width = el.offsetWidth * 2, H = cv.height = 260 * 2;
  var cols = ['#D4AF37', '#E9C96A', '#B8892A', '#F4E3A1', '#2E7D4F'];
  var ps = []; for (var i = 0; i < 70; i++) ps.push({ x: W / 2, y: H * 0.42, vx: (Math.random() - 0.5) * 22, vy: -Math.random() * 18 - 6, r: 3 + Math.random() * 5, c: cols[i % cols.length], a: 1, s: Math.random() * 6 });
  var t0 = performance.now();
  (function frame(t) {
    var k = (t - t0) / 1000; ctx.clearRect(0, 0, W, H);
    ps.forEach(function (p) { p.vy += 0.7; p.x += p.vx; p.y += p.vy; p.a = Math.max(0, 1 - k / 1.6); ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.s + k * 6); ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); });
    if (k < 1.7) requestAnimationFrame(frame);
  })(t0);
}

// ══ Drop C (2026-10-06): SAM, Open deals and the SAMagic board ═════════════
// Three screens, one read (get_deal_board), one set of words. "Active",
// "Quiet", "Unknown", "At risk" mean the same thing on every screen because
// the server decides them once and all three render that answer.
var _sc = { data: {}, at: {}, view: { sam: 'all', samScope: 'mine', dealsScope: 'mine', boardBy: 'stage', boardFilter: 'all', boardRep: '' },
  f: { q: '', owner: '', stage: '', band: '', product: '', close: '', sort: 'value' }, samQ: '', current: '' };
var SC_ACT = { active: ['Active', 'live'], cooling: ['Cooling', 'warn'], quiet: ['Quiet', 'risk'], unknown: ['Unknown', ''], none: ['Not started', ''] };
var SC_BAND = { healthy: ['Healthy', 'live'], watch: ['Watch', 'warn'], at_risk: ['At risk', 'risk'], critical: ['Critical', 'risk crit'], unknown: ['Unknown', ''] };
var SC_ICO = {
  reply: '<path d="M10 8L5 12.5 10 17"/><path d="M5.5 12.5H14a5 5 0 015 5V19"/>',
  past: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  closing_quiet: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  champion: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  commit: '<path d="M4 12.5l5 5L20 6.5"/>',
  quiet: '<path d="M4 12h3l2-4 3 8 2-4h6"/>',
  noreply: '<path d="M4 6.5h16v11H4z"/><path d="M4 7l8 6 8-6"/>'
};
function scIco(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (SC_ICO[k] || SC_ICO.quiet) + '</svg>'; }
function scMoney(usd) { return usd ? fmtOrgMoney(usd) : ''; }
function scMoney0(usd) { return fmtOrgMoney(usd || 0) || '0'; }
function scAgo(iso) {
  if (!iso) return '';
  var d = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
}
function scInit(n) { return String(n || '?').split(/[\s._-]+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase(); }
function scPlural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function scCloseText(a) {
  if (a.d2c === null || a.d2c === undefined) return a.is_deal ? 'No close date' : '';
  if (a.d2c < 0) return Math.abs(a.d2c) + (a.d2c === -1 ? ' day late' : ' days late');
  if (a.d2c === 0) return 'Closes today';
  return 'Closes in ' + a.d2c + (a.d2c === 1 ? ' day' : ' days');
}
function scLast(a) {
  if (!a.last_at) return a.activity === 'unknown' ? 'SAM cannot see this account yet' : 'No contact yet';
  return 'Last contact ' + scAgo(a.last_at) + (a.last_by ? ' by ' + a.last_by : '') + (a.last_channel === 'meeting' ? ', in a meeting' : '');
}
function scActChip(a) {
  var m = SC_ACT[a.activity] || SC_ACT.unknown;
  var t = m[0] + (a.activity === 'quiet' && a.quiet !== null ? ' ' + a.quiet + 'd' : a.activity === 'cooling' ? ' ' + a.quiet + 'd' : '');
  return '<span class="sp-chip ' + m[1] + '" title="' + esc((_sc.defs || {})[a.activity] || '') + '"><i></i>' + esc(t) + '</span>';
}
function scBandChip(a) {
  if (!a.band) return a.is_deal ? '<span class="sp-chip" title="Scored every night at 2 am">Not scored yet</span>' : '';
  var m = SC_BAND[a.band] || SC_BAND.unknown;
  return '<span class="sp-chip ' + m[1] + '" title="' + esc(a.band_reason || '') + '"><i></i>' + esc(m[0]) + '</span>';
}

async function scFetch(scope, force) {
  var key = scope || 'mine';
  if (!force && _sc.data[key] && Date.now() - _sc.at[key] < 60000) return _sc.data[key];
  var r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
    body: JSON.stringify({ action: 'get_deal_board', scope: key }) });
  var d = await r.json();
  if (!d || !d.ok) throw new Error((d && d.error) || 'Could not load your accounts.');
  _sc.data[key] = d; _sc.at[key] = Date.now();
  _sc.defs = (d.definitions && d.definitions.words) || {};
  return d;
}
function scInvalidate() { _sc.data = {}; _sc.at = {}; }
function scRefreshCurrent() {
  scInvalidate();
  if (_sc.current === 'sam') renderScSam(true);
  else if (_sc.current === 'deals') renderScDeals(true);
  else if (_sc.current === 'board') renderScBoard(true);
}
function scLoading(el, what) { if (el && !el.querySelector('.rv-loaded')) el.innerHTML = '<div class="sp-card sp-empty">Loading ' + what + '…</div>'; }
function scError(el, e, retry) {
  el.innerHTML = '<div class="sp-card sp-empty">' + esc(e.message || String(e)) + ' <button class="g-btn" onclick="' + retry + '">Try again</button></div>';
}
function scSeg(items, on, handler) {
  return '<div class="sp-seg" role="group">' + items.map(function (x) {
    return '<button type="button" class="' + (x[0] === on ? 'on' : '') + '" aria-pressed="' + (x[0] === on) + '" onclick="' + handler + '(\'' + x[0] + '\')">' + x[1] + '</button>';
  }).join('') + '</div>';
}
function scHow() {
  var w = _sc.defs || {};
  var rows = [['Active', w.active], ['Cooling', w.cooling], ['Quiet', w.quiet], ['Unknown', w.unknown], ['Not started', w.none], ['At risk', w.at_risk], ['Reply waiting', w.reply_waiting]]
    .filter(function (x) { return x[1]; });
  return '<details class="rv-how"><summary>How SAM decides these words</summary><dl>' + rows.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') +
    '</dl><p>The same words mean the same thing on SAM, Open deals and SAMagic. Health is scored every night at 2 am.</p></details>';
}
function scMailboxBanner(d) {
  if (!d.me || d.me.mailbox === 'ok') return '';
  var txt = d.me.mailbox === 'reconnect' ? 'Your mailbox connection has expired. Reconnect it so SAM can see your accounts.' : 'Connect your mailbox so SAM can see who you speak to. Until then, your accounts show as Unknown.';
  return '<div class="sp-card rv-banner"><span>' + esc(txt) + '</span><button class="g-btn sp-gold" onclick="switchTab(\'you\')">' + (d.me.mailbox === 'reconnect' ? 'Reconnect' : 'Connect mailbox') + '</button></div>';
}

// ── The deal sheet: one place to see an account and act on it ───────────────
function scFind(id) {
  for (var k in _sc.data) { var a = (_sc.data[k].accounts || []).find(function (x) { return x.id === id; }); if (a) return a; }
  return null;
}
function _scOpenC(id) {
  var a = scFind(id); if (!a) return;
  scCloseSheet();
  var nm = esc(a.name).replace(/'/g, '&#39;'), idq = esc(a.id);
  var people = (a.people || []).map(function (p) {
    return '<li><div><b>' + esc(p.name) + '</b>' + (p.role === 'champion' ? ' <span class="sp-chip live">Champion</span>' : '') +
      '<div class="sp-small">' + esc(p.email || '') + (p.last ? ' · last contact ' + scAgo(p.last) : '') + '</div></div>' +
      (p.email ? '<a class="g-btn" href="mailto:' + esc(p.email) + '">Email</a>' : '') + '</li>';
  }).join('');
  var needs = (a.needs || []).map(function (n) { return '<li><span class="sp-ni ' + (n.tone === 'good' ? 'g' : n.tone === 'bad' ? 'r' : 'a') + '">' + scIco(n.key) + '</span><span>' + esc(n.text) + '</span></li>'; }).join('');
  var sig = (a.signals || []).map(function (s) { return '<span class="sp-chip ' + (s.tone === 'good' ? 'live' : 'risk') + '">' + esc(s.label) + '</span>'; }).join('');
  var el = document.createElement('div');
  el.id = 'scSheet'; el.className = 'rv-sheet-wrap';
  el.innerHTML = '<div class="rv-sheet" role="dialog" aria-modal="true" aria-labelledby="scSheetTitle">' +
    '<div class="rv-sheet-head"><div><div class="sp-lbl">' + (a.is_deal ? 'Deal' : 'Account') + (a.owner_name ? ' · ' + esc(a.owner_name) : '') + (a.sdr_name ? ' with ' + esc(a.sdr_name) : '') + '</div>' +
      '<h2 id="scSheetTitle">' + esc(a.name) + '</h2>' +
      '<div class="sp-chips">' + scActChip(a) + scBandChip(a) + (a.is_deal ? '<span class="sp-chip">' + esc(a.stage_label) + '</span>' : '') + (a.products || []).map(function (p) { return '<span class="sp-chip">' + esc(p) + '</span>'; }).join('') + '</div></div>' +
      '<button class="rv-x" onclick="scCloseSheet()" aria-label="Close">×</button></div>' +
    (a.is_deal ? '<div class="rv-sheet-kpis"><div><span class="sp-lbl">Value</span><b>' + esc(scMoney(a.value_usd) || 'Not set') + '</b></div><div><span class="sp-lbl">Close</span><b>' + esc(a.close ? scCloseText(a) : 'Not set') + '</b></div><div><span class="sp-lbl">Health</span><b>' + (a.health !== null && a.health !== undefined ? a.health : 'Not scored') + '</b></div></div>' : '') +
    (a.band_reason ? '<p class="rv-reason">' + esc(a.band_reason) + (a.is_deal ? ' <button class="rv-link" onclick="openHealthBreakdown(\'' + idq + '\',\'' + nm + '\')">See the score</button>' : '') + '</p>' : '') +
    (needs ? '<div class="sp-lbl" style="margin-top:16px">Needs you</div><ul class="rv-needlist">' + needs + '</ul>' : '') +
    '<div class="sp-lbl" style="margin-top:16px">Contact</div><p class="rv-p">' + esc(scLast(a)) + '.' + (a.last_reply_at ? ' Their last reply: ' + esc(scAgo(a.last_reply_at)) + '.' : '') + '</p>' +
    (sig ? '<div class="sp-chips">' + sig + '</div>' : '') +
    '<div class="sp-lbl" style="margin-top:16px">People ' + (a.people_total ? '· ' + a.people_active + ' of ' + a.people_total + ' active in 30 days' : '') + '</div>' +
    (people ? '<ul class="rv-people">' + people + '</ul>' : '<p class="rv-p">Nobody on record yet. People appear here once they are on an email or meeting.</p>') +
    '<div class="rv-sheet-acts">' +
      '<button class="g-btn sp-gold" onclick="openDealValueForm(\'' + idq + '\',\'' + nm + '\')">' + (a.is_deal ? 'Update deal' : 'Add a deal') + '</button>' +
      '<button class="g-btn" onclick="openAccountTimeline(\'' + idq + '\',\'' + nm + '\')">Timeline</button>' +
      (a.is_deal ? '<button class="g-btn" onclick="openCloseDeal(\'' + idq + '\',\'' + nm + '\')">Mark won or lost</button>' : '') +
    '</div></div>';
  el.addEventListener('click', function (e) { if (e.target === el) scCloseSheet(); });
  document.body.appendChild(el);
  document.addEventListener('keydown', scSheetKey);
  setTimeout(function () { var x = el.querySelector('.rv-x'); if (x) x.focus(); }, 30);
}
function scSheetKey(e) { if (e.key === 'Escape' && !document.getElementById('health-breakdown-modal')) scCloseSheet(); }
function scCloseSheet() { var el = document.getElementById('scSheet'); if (el) el.remove(); document.removeEventListener('keydown', scSheetKey); }

// ══ SAM: your accounts today ═══════════════════════════════════════════════
function scSamScope(s) { _sc.view.samScope = s; _sc._samFocus = 0; renderScSam(); }
function scSamFilter(f) { _sc.view.sam = f; _sc._samFocus = 0; renderScSam(); }
async function scSamRefresh(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Checking your mailbox…'; }
  try {
    await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'mailbox_pass' }) });
  } catch (e) {}
  scInvalidate(); await renderScSam(true);
}
async function renderScSam(force) {
  _sc.current = 'sam';
  var el = document.getElementById('scSam'); if (!el) return;
  scLoading(el, 'your accounts');
  var d;
  try { d = await scFetch(_sc.view.samScope, force); } catch (e) { return scError(el, e, 'renderScSam(true)'); }
  if (_sc.current !== 'sam') return;
  var s = d.summary, team = d.scope === 'team';
  var accts = d.accounts || [];
  var need = accts.filter(function (a) { return a.needs && a.needs.length; });
  // What changed this week, newest first.
  var wk = Date.now() - 7 * 86400000, changes = [];
  accts.forEach(function (a) {
    if (a.last_reply_at && Date.parse(a.last_reply_at) >= wk) {
      var who = (a.people || []).find(function (p) { return p.last && Math.abs(Date.parse(p.last) - Date.parse(a.last_reply_at)) < 120000; });
      changes.push({ t: Date.parse(a.last_reply_at), tone: 'g', ico: 'reply', id: a.id, text: '<b>' + esc(who ? who.name : 'Someone') + '</b> at ' + esc(a.name) + ' wrote', sub: scAgo(a.last_reply_at) });
    } else if (a.last_at && a.last_channel === 'meeting' && Date.parse(a.last_at) >= wk) {
      changes.push({ t: Date.parse(a.last_at), tone: 'b', ico: 'champion', id: a.id, text: 'Meeting with <b>' + esc(a.name) + '</b>' + (a.last_by ? ' (' + esc(a.last_by) + ')' : ''), sub: scAgo(a.last_at) });
    }
    (a.signals || []).forEach(function (g) {
      if (g.date && Date.parse(g.date) >= wk - 86400000) changes.push({ t: Date.parse(g.date), tone: g.tone === 'good' ? 'g' : 'r', ico: g.tone === 'good' ? 'commit' : 'closing_quiet', id: a.id, text: '<b>' + esc(a.name) + '</b>: ' + esc(g.label), sub: scAgo(g.date + 'T12:00:00Z') });
    });
  });
  changes.sort(function (x, y) { return y.t - x.t; });
  var counts = { all: accts.length, need: need.length, active: s.active, quiet: s.quiet, unknown: s.unknown, none: accts.filter(function (a) { return a.activity === 'none'; }).length };
  var f = _sc.view.sam, q = (_sc.samQ || '').toLowerCase();
  var list = accts.filter(function (a) {
    if (q && (a.name + ' ' + (a.owner_name || '') + ' ' + (a.domain || '')).toLowerCase().indexOf(q) === -1) return false;
    if (f === 'need') return a.needs && a.needs.length;
    if (f === 'all') return true;
    return a.activity === f;
  });
  var shown = list.slice(0, 200);
  el.innerHTML = '<div class="rv-loaded"></div>' +
    '<div class="page-head"><div><div class="page-title">Your accounts today</div><div class="page-sub">Who needs you, what changed, and who last spoke to each customer, from ' + (team ? 'your team\u2019s' : 'your') + ' mail and meetings.</div></div>' +
    '<div class="page-actions">' + (d.team_capable ? scSeg([['mine', 'Mine'], ['team', 'My team']], d.scope, 'scSamScope') : '') +
    '<button class="g-btn" onclick="scSamRefresh(this)">Refresh</button></div></div>' +
    scMailboxBanner(d) +
    '<section class="sp-card sp-kpis" aria-label="Today at a glance">' +
      '<div class="sp-kpi"><div class="sp-lbl">Need you today</div><div class="n">' + s.needs_you + '</div><div class="d">' + scPlural(s.replies_waiting, 'reply', 'replies') + ' waiting</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Active</div><div class="n sp-g">' + s.active + '</div><div class="d">contact in 7 days</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Quiet</div><div class="n' + (s.quiet ? ' rv-red' : '') + '">' + s.quiet + '</div><div class="d">' + d.definitions.quiet_days + ' days or more</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Closing in 30 days</div><div class="n">' + s.closing_30 + '</div><div class="d">' + (s.past_due ? scPlural(s.past_due, 'deal') + ' past due' : 'none past due') + '</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Unknown</div><div class="n">' + s.unknown + '</div><div class="d">' + (s.unknown ? 'SAM cannot see these yet' : 'SAM can see them all') + '</div></div>' +
    '</section>' +
    '<div class="sp-two">' +
      '<section class="sp-card sp-pad rv-needs" aria-label="Needs you today"><div class="sp-lbl">Needs you today · ' + need.length + '</div>' +
      (need.length ? '<ul class="rv-nlist">' + need.slice(0, 12).map(function (a) {
        var n = a.needs[0];
        return '<li><span class="sp-ni ' + (n.tone === 'good' ? 'g' : n.tone === 'bad' ? 'r' : 'a') + '">' + scIco(n.key) + '</span>' +
          '<div class="rv-nmain"><div class="rv-nt"><button class="rv-name" onclick="scOpen(\'' + esc(a.id) + '\')">' + esc(a.name) + '</button>' + (a.value_usd ? ' <span class="rv-val">' + esc(scMoney(a.value_usd)) + '</span>' : '') + (team && a.owner_name ? ' <span class="rv-owner">' + esc(a.owner_name) + '</span>' : '') + '</div>' +
          '<div class="rv-why">' + esc(n.text) + '</div><div class="sp-small">' + esc(scLast(a)) + (a.needs.length > 1 ? ' · ' + (a.needs.length - 1) + ' more' : '') + '</div></div>' +
          '<button class="g-btn rv-act" onclick="scOpen(\'' + esc(a.id) + '\')">' + esc(n.act || 'Open') + '</button></li>';
      }).join('') + '</ul>' + (need.length > 12 ? '<button class="rv-link" onclick="scSamFilter(\'need\');document.getElementById(\'scSamAll\').scrollIntoView({behavior:\'smooth\'})">See all ' + need.length + '</button>' : '')
        : '<div class="sp-empty">Nothing needs you right now. ' + (s.unknown ? 'Some accounts are Unknown, so SAM may be missing something.' : 'Good place to be.') + '</div>') +
      '</section>' +
      '<aside class="sp-card sp-pad sp-needs" aria-label="This week"><div class="sp-lbl">This week</div>' +
      (changes.length ? '<ul>' + changes.slice(0, 8).map(function (c) {
        return '<li><span class="sp-ni ' + c.tone + '">' + scIco(c.ico) + '</span><div><button class="rv-plain" onclick="scOpen(\'' + esc(c.id) + '\')">' + c.text + '</button><div class="sp-small">' + esc(c.sub) + '</div></div></li>';
      }).join('') + '</ul>' : '<div class="sp-small" style="margin-top:10px">No replies or meetings yet this week.</div>') +
      '</aside>' +
    '</div>' +
    '<section class="sp-card sp-pad rv-all" id="scSamAll" aria-label="All accounts">' +
      '<div class="rv-bar"><div class="sp-lbl">All ' + (team ? 'team ' : '') + 'accounts · ' + accts.length + '</div>' +
      '<div class="rv-tools">' + scSeg([['all', 'All ' + counts.all], ['need', 'Need you ' + counts.need], ['active', 'Active ' + counts.active], ['quiet', 'Quiet ' + counts.quiet], ['unknown', 'Unknown ' + counts.unknown], ['none', 'Not started ' + counts.none]], f, 'scSamFilter') +
      '<input class="sp-search" placeholder="Find an account" value="' + esc(_sc.samQ || '') + '" oninput="_sc.samQ=this.value;_sc._samFocus=1;clearTimeout(_sc._sq);_sc._sq=setTimeout(function(){renderScSam()},250)" aria-label="Find an account"/></div></div>' +
      (shown.length ? '<div class="rv-rows">' + shown.map(function (a) {
        return '<button class="rv-arow" onclick="scOpen(\'' + esc(a.id) + '\')"><span class="rv-an">' + esc(a.name) + (team && a.owner_name ? '<small>' + esc(a.owner_name) + '</small>' : '') + '</span>' +
          '<span>' + scActChip(a) + '</span><span class="rv-al">' + esc(scLast(a)) + '</span><span class="rv-av">' + esc(scMoney(a.value_usd)) + '</span><span>' + scBandChip(a) + '</span></button>';
      }).join('') + '</div>' + (list.length > shown.length ? '<div class="sp-small" style="margin-top:10px">Showing 200 of ' + list.length + '. Search to find the rest.</div>' : '')
        : '<div class="sp-empty">' + (accts.length ? 'Nothing matches.' : 'No accounts yet. Accounts assigned to you appear here.') + '</div>') +
    '</section>' + scHow();
  if (_sc._samFocus) { var inp = el.querySelector('.rv-all .sp-search'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
}

// ══ Open deals ═════════════════════════════════════════════════════════════
function scDealsScope(s) { _sc.view.dealsScope = s; _sc.f.owner = ''; renderScDeals(); }
function scSetF(k, v) { _sc.f[k] = v; renderScDeals(); }
function scDealsFiltered(d) {
  var f = _sc.f, q = (f.q || '').toLowerCase();
  var today = new Date(), ym = today.toISOString().slice(0, 7);
  var qEnd = new Date(Date.UTC(today.getUTCFullYear(), Math.floor(today.getUTCMonth() / 3) * 3 + 3, 0)).toISOString().slice(0, 10);
  var xs = (d.accounts || []).filter(function (a) {
    if (!a.is_deal) return false;
    if (q && (a.name + ' ' + (a.owner_name || '') + ' ' + (a.products || []).join(' ')).toLowerCase().indexOf(q) === -1) return false;
    if (f.owner && a.owner !== f.owner) return false;
    if (f.stage && (a.stage || '_none') !== f.stage) return false;
    if (f.band && (a.band || 'unscored') !== f.band) return false;
    if (f.product && (a.products || []).indexOf(f.product) === -1) return false;
    if (f.close === 'month' && !(a.close && a.close.slice(0, 7) === ym && a.d2c >= 0)) return false;
    if (f.close === 'quarter' && !(a.close && a.close <= qEnd && a.d2c >= 0)) return false;
    if (f.close === 'late' && !(a.d2c !== null && a.d2c < 0)) return false;
    if (f.close === 'none' && a.close) return false;
    return true;
  });
  var bandRank = { critical: 0, at_risk: 1, unknown: 2, watch: 3, healthy: 4 };
  xs.sort(function (x, y) {
    if (f.sort === 'close') return (x.d2c === null ? 99999 : x.d2c) - (y.d2c === null ? 99999 : y.d2c);
    if (f.sort === 'health') return (bandRank[x.band] !== undefined ? bandRank[x.band] : 5) - (bandRank[y.band] !== undefined ? bandRank[y.band] : 5) || (x.health || 0) - (y.health || 0);
    if (f.sort === 'quiet') return (y.quiet === null ? 9999 : y.quiet) - (x.quiet === null ? 9999 : x.quiet);
    return y.value_usd - x.value_usd;
  });
  return xs;
}
function scSel(k, opts, label) {
  return '<select class="rv-sel" aria-label="' + esc(label) + '" onchange="scSetF(\'' + k + '\',this.value)">' + opts.map(function (o) {
    return '<option value="' + esc(o[0]) + '"' + (String(_sc.f[k]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
  }).join('') + '</select>';
}
async function _scListDeals(force) {
  _sc.current = 'deals';
  var el = document.getElementById('scDeals'); if (!el) return;
  scLoading(el, 'your open deals');
  var d;
  try { d = await scFetch(_sc.view.dealsScope, force); } catch (e) { return scError(el, e, 'renderScDeals(true)'); }
  if (_sc.current !== 'deals') return;
  var s = d.summary, team = d.scope === 'team';
  var xs = scDealsFiltered(d);
  var tot = xs.reduce(function (n, a) { return n + a.value_usd; }, 0);
  var stOpts = [['', 'All stages']].concat((d.stages || []).map(function (x) { return [x.key, x.label]; })).concat([['_none', 'No stage']]);
  var bandOpts = [['', 'Any health'], ['healthy', 'Healthy'], ['watch', 'Watch'], ['at_risk', 'At risk'], ['critical', 'Critical'], ['unknown', 'Unknown'], ['unscored', 'Not scored yet']];
  var closeOpts = [['', 'Any close date'], ['month', 'Closing this month'], ['quarter', 'Closing this quarter'], ['late', 'Past the close date'], ['none', 'No close date']];
  var sortOpts = [['value', 'Biggest first'], ['close', 'Closing soonest'], ['health', 'Least healthy first'], ['quiet', 'Quiet longest']];
  var ownerOpts = [['', 'Everyone']].concat((d.by_owner || []).filter(function (o) { return o.deals; }).map(function (o) { return [o.user_id, o.name || 'Someone']; }));
  var prodOpts = [['', 'All products']].concat((d.products || []).map(function (p) { return [p, p]; }));
  el.innerHTML = '<div class="rv-loaded"></div>' +
    '<div class="page-head"><div><div class="page-title">Open deals</div><div class="page-sub">Every open deal, how healthy it is, and who last spoke to the customer.</div></div>' +
    '<div class="page-actions">' + (d.team_capable ? scSeg([['mine', 'Mine'], ['team', 'My team']], d.scope, 'scDealsScope') : '') +
    '<button class="g-btn" onclick="openCrmImport()" title="Upload a CRM deals export and check it against real activity">CRM audit</button>' +
    '<button class="g-btn" onclick="renderScDeals(true)">Refresh</button></div></div>' +
    '<section class="sp-card sp-kpis" aria-label="Pipeline at a glance">' +
      '<div class="sp-kpi"><div class="sp-lbl">Open pipeline</div><div class="n">' + esc(scMoney0(s.value_usd)) + '</div><div class="d">' + scPlural(s.deals, 'deal') + '</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Weighted</div><div class="n">' + esc(scMoney0(s.weighted_usd)) + '</div><div class="d">by each deal\u2019s chance to close</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Closing this quarter</div><div class="n">' + esc(scMoney0(s.closing_quarter_usd)) + '</div><div class="d">' + s.closing_30 + ' in the next 30 days</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">At risk</div><div class="n' + (s.at_risk ? ' rv-red' : '') + '">' + esc(scMoney0(s.at_risk_usd)) + '</div><div class="d">' + scPlural(s.at_risk, 'deal') + '</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Past close date</div><div class="n' + (s.past_due ? ' rv-red' : '') + '">' + s.past_due + '</div><div class="d">move the date or close them</div></div>' +
    '</section>' +
    '<div class="rv-filters">' +
      '<input class="sp-search" placeholder="Find a deal, person or product" value="' + esc(_sc.f.q) + '" oninput="_sc.f.q=this.value;clearTimeout(_sc._dq);_sc._dq=setTimeout(function(){renderScDeals();var i=document.querySelector(\'#scDeals .sp-search\');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)" aria-label="Find a deal"/>' +
      (team ? scSel('owner', ownerOpts, 'Owner') : '') + scSel('stage', stOpts, 'Stage') + scSel('band', bandOpts, 'Health') +
      (prodOpts.length > 1 ? scSel('product', prodOpts, 'Product') : '') + scSel('close', closeOpts, 'Close date') + scSel('sort', sortOpts, 'Sort') +
    '</div>' +
    '<section class="sp-card rv-dtable" aria-label="Open deals">' +
      '<div class="rv-dhead"><span>Deal</span><span>Stage</span><span class="r">Value</span><span>Close</span><span>Health</span><span>Last contact</span></div>' +
      (xs.length ? xs.map(function (a) {
        var late = a.d2c !== null && a.d2c < 0;
        return '<button class="rv-drow" onclick="scOpen(\'' + esc(a.id) + '\')">' +
          '<span class="rv-dn"><b>' + esc(a.name) + '</b><small>' + esc([team ? a.owner_name : '', (a.products || []).join(', ')].filter(Boolean).join(' · ')) + '</small></span>' +
          '<span class="rv-ds">' + esc(a.stage_label) + '</span>' +
          '<span class="rv-dv r">' + esc(scMoney(a.value_usd) || 'Not set') + '</span>' +
          '<span class="rv-dc' + (late ? ' rv-red' : '') + '">' + esc(scCloseText(a)) + '</span>' +
          '<span class="rv-dh">' + scBandChip(a) + (a.band_reason && a.band !== 'healthy' ? '<small>' + esc(a.band_reason) + '</small>' : '') + '</span>' +
          '<span class="rv-dl">' + scActChip(a) + '<small>' + esc(a.last_at ? scAgo(a.last_at) + (a.last_by ? ' · ' + a.last_by : '') : a.activity === 'unknown' ? 'not visible' : 'none yet') + '</small></span>' +
        '</button>';
      }).join('') + '<div class="rv-dfoot">' + scPlural(xs.length, 'deal') + ' · ' + esc(scMoney0(tot)) + '</div>'
        : '<div class="sp-empty">' + (s.deals ? 'No deal matches these filters. <button class="rv-link" onclick="_sc.f={q:\'\',owner:\'\',stage:\'\',band:\'\',product:\'\',close:\'\',sort:\'value\'};renderScDeals()">Clear filters</button>' : 'No open deals yet. Add a deal value to an account to see it here.') + '</div>') +
    '</section>' + scHow();
}

// ══ SAMagic: the board ═════════════════════════════════════════════════════
function scBoardBy(b) { _sc.view.boardBy = b; renderScBoard(); }
function scBoardFilter(f) { _sc.view.boardFilter = f; renderScBoard(); }
function scBoardRep(u) { _sc.view.boardRep = _sc.view.boardRep === u ? '' : u; renderScBoard(); }
async function renderScBoard(force) {
  _sc.current = 'board';
  var el = document.getElementById('scBoard'); if (!el) return;
  scLoading(el, 'the board');
  var d;
  try { d = await scFetch('team', force); } catch (e) { return scError(el, e, 'renderScBoard(true)'); }
  if (_sc.current !== 'board') return;
  var s = d.summary, v = _sc.view;
  var deals = (d.accounts || []).filter(function (a) {
    if (!a.is_deal) return false;
    if (v.boardRep && a.owner !== v.boardRep) return false;
    if (v.boardFilter === 'risk') return a.band === 'at_risk' || a.band === 'critical';
    if (v.boardFilter === 'quiet') return a.activity === 'quiet' || a.activity === 'unknown';
    if (v.boardFilter === 'closing') return a.d2c !== null && a.d2c <= 30;
    return true;
  }).sort(function (x, y) { return y.value_usd - x.value_usd; });
  var cols;
  if (v.boardBy === 'person') {
    cols = (d.by_owner || []).map(function (o) { return { key: o.user_id, label: o.name || 'Someone', items: deals.filter(function (a) { return a.owner === o.user_id; }) }; }).filter(function (c) { return c.items.length || !v.boardRep; });
  } else {
    var known = {}; (d.stages || []).forEach(function (x) { known[x.key] = 1; });
    cols = (d.stages || []).map(function (x) { return { key: x.key, label: x.label, items: deals.filter(function (a) { return a.stage === x.key; }) }; });
    var rest = deals.filter(function (a) { return !known[a.stage]; });
    if (rest.length) cols.push({ key: '', label: 'No stage', items: rest });
  }
  var team = (d.by_owner || []).filter(function (o) { return o.deals || o.mailbox !== 'ok'; });
  var mbTxt = { ok: 'Mailbox working', none: 'No mailbox connected', reconnect: 'Mailbox needs reconnecting', stale: 'Mailbox not checked lately' };
  el.innerHTML = '<div class="rv-loaded"></div>' +
    '<div class="page-head"><div><div class="page-title">SAMagic</div><div class="page-sub">Every open deal ' + (d.scope === 'team' ? 'in your team ' : '') + 'on one board. Click a person to see only their deals.</div></div>' +
    '<div class="page-actions">' + scSeg([['stage', 'By stage'], ['person', 'By person']], v.boardBy, 'scBoardBy') +
    '<button class="g-btn" onclick="renderScBoard(true)">Refresh</button></div></div>' +
    '<section class="sp-card sp-kpis rv-k4" aria-label="Team pipeline">' +
      '<div class="sp-kpi"><div class="sp-lbl">Open pipeline</div><div class="n">' + esc(scMoney0(s.value_usd)) + '</div><div class="d">' + scPlural(s.deals, 'deal') + '</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Weighted</div><div class="n">' + esc(scMoney0(s.weighted_usd)) + '</div><div class="d">by chance to close</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">At risk</div><div class="n' + (s.at_risk ? ' rv-red' : '') + '">' + esc(scMoney0(s.at_risk_usd)) + '</div><div class="d">' + scPlural(s.at_risk, 'deal') + '</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Closing this quarter</div><div class="n">' + esc(scMoney0(s.closing_quarter_usd)) + '</div><div class="d">' + s.past_due + ' past due</div></div>' +
    '</section>' +
    (team.length > 1 || d.scope === 'team' ? '<div class="rv-team" role="group" aria-label="People">' + team.map(function (o) {
      return '<button class="sp-card rv-tm' + (v.boardRep === o.user_id ? ' on' : '') + '" aria-pressed="' + (v.boardRep === o.user_id) + '" onclick="scBoardRep(\'' + esc(o.user_id) + '\')">' +
        '<span class="rv-tav">' + esc(scInit(o.name)) + '<i class="mb ' + o.mailbox + '" title="' + esc(mbTxt[o.mailbox] || '') + '"></i></span>' +
        '<span class="rv-tw"><b>' + esc(o.name || 'Someone') + '</b><small>' + scPlural(o.deals, 'deal') + ' · ' + esc(scMoney0(o.value_usd)) + '</small>' +
        '<span class="rv-tc">' + (o.at_risk ? '<span class="sp-chip risk">' + o.at_risk + ' at risk</span>' : '') + (o.quiet ? '<span class="sp-chip warn">' + o.quiet + ' quiet</span>' : '') + (o.unknown ? '<span class="sp-chip">' + o.unknown + ' unknown</span>' : '') + (o.mailbox !== 'ok' ? '<span class="sp-chip">' + esc(mbTxt[o.mailbox]) + '</span>' : '') + '</span></span></button>';
    }).join('') + '</div>' : '') +
    '<div class="rv-bbar">' + scSeg([['all', 'All deals'], ['risk', 'At risk'], ['quiet', 'Quiet or unknown'], ['closing', 'Closing in 30 days']], v.boardFilter, 'scBoardFilter') +
    (v.boardRep ? '<button class="rv-link" onclick="scBoardRep(\'' + esc(v.boardRep) + '\')">Show everyone</button>' : '') + '</div>' +
    '<div class="rv-board" role="list">' + cols.map(function (c) {
      var val = c.items.reduce(function (n, a) { return n + a.value_usd; }, 0);
      return '<section class="rv-col" role="listitem" aria-label="' + esc(c.label) + '"><header><b>' + esc(c.label) + '</b><span>' + c.items.length + ' · ' + esc(scMoney0(val)) + '</span></header>' +
        (c.items.length ? c.items.map(function (a) {
          var b = SC_BAND[a.band] || null;
          return '<button class="rv-card ' + (b ? b[1].split(' ')[0] : '') + '" onclick="scOpen(\'' + esc(a.id) + '\')">' +
            '<span class="rv-ct"><b>' + esc(a.name) + '</b><span>' + esc(scMoney(a.value_usd) || 'No value') + '</span></span>' +
            '<span class="rv-cm">' + (v.boardBy === 'person' ? esc(a.stage_label) : '<span class="rv-ini" title="' + esc(a.owner_name) + '">' + esc(scInit(a.owner_name)) + '</span>' + esc(a.owner_name)) + ' · <span class="' + (a.d2c !== null && a.d2c < 0 ? 'rv-red' : '') + '">' + esc(scCloseText(a)) + '</span></span>' +
            '<span class="rv-cb">' + scBandChip(a) + scActChip(a) + '</span>' +
            (a.band_reason && a.band !== 'healthy' ? '<span class="rv-cr">' + esc(a.band_reason) + '</span>' : '') +
          '</button>';
        }).join('') : '<div class="rv-cempty">No deals</div>') + '</section>';
    }).join('') + '</div>' + scHow();
}

// The old screens' tools stay one click away, loaded only when opened.
function scWireMore() {
  var bind = function (id, fn) { var d = document.getElementById(id); if (d && !d._scBound) { d._scBound = 1; d.addEventListener('toggle', function () { if (d.open) { try { fn(); } catch (e) {} } }); } };
  bind('scSamMore', function () {
    var seniorRole = ['super_admin', 'admin', 'manager', 'director', 'executive'].includes(profile && profile.role);
    var t = document.getElementById('samModeToggle'); if (t) t.style.display = seniorRole ? 'block' : 'none';
    setSamMode((seniorRole && _samMode === 'team') ? 'team' : 'self');
  });
  bind('scDealsMore', function () { _scOldPipeline(); });
  bind('scBoardMore', function () { loadExecDashboard(); });
  // Ask SAM stays on the SAM screen itself, not inside More.
  var panel = document.getElementById('panel-signals');
  ['samChatOutput', 'samChatBar', 'samChatFab'].forEach(function (id) { var x = document.getElementById(id); if (panel && x && x.closest('details')) panel.appendChild(x); });
}
// A rep breakdown was called on Pipeline for every manager but never written,
// so Pipeline crashed for managers ("renderRepBreakdown is not defined").
function renderRepBreakdown(data, deals, fmt) {
  var by = {};
  (deals || []).forEach(function (d) { var k = d.rep_email || 'Unassigned'; var b = by[k] || (by[k] = { n: 0, v: 0, w: 0 }); b.n++; b.v += d.deal_value_usd || 0; b.w += d.weighted_value_usd || 0; });
  var rows = Object.keys(by).sort(function (a, b) { return by[b].v - by[a].v; });
  if (!rows.length) return '';
  return '<div class="sp-card sp-pad" style="margin-top:12px"><div class="sp-lbl">By person</div>' + rows.map(function (k) {
    return '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--g-line);font-size:13px"><span>' + esc(k.split('@')[0]) + ' · ' + by[k].n + ' deal' + (by[k].n === 1 ? '' : 's') + '</span><b>' + esc((fmt || fmtOrgMoney)(by[k].v)) + '</b></div>';
  }).join('') + '</div>';
}

// ── SAMpaign: emails that did not go out (6 Oct) ────────────────────────────
// A mailbox disconnects (its password changed), the queued emails fail, and
// the rep needs one clear fix: reconnect, then send them again. Nothing is
// rewritten: the same emails go back to drafts and the scheduler spaces them
// out within the mailbox's daily limit.
function _spFailText(err) {
  var s = String(err || '');
  if (/no email address/i.test(s)) return 'Not sent: no email address.';
  if (/campaign owner|invalid_grant|token|reconnect|send permission|no mailbox|revoked|unauthori[sz]ed|\b401\b/i.test(s)) return 'Not sent: the mailbox was disconnected (its password changed or access was removed).';
  return 'Not sent: ' + s;
}
function _spFailedTotals(o) {
  var t = { retry: 0, launch: null, at: null, reason: null };
  (o && o.waves || []).forEach(function (w) {
    if (!w.retry) return;
    t.retry += w.retry;
    if (t.launch === null) { t.launch = w.launch; t.reason = w.failed_reason; }
    if (w.failed_at && (!t.at || w.failed_at < t.at)) t.at = w.failed_at;
  });
  return t;
}
function _spFailedBanner(id, o) {
  var t = _spFailedTotals(o); if (!t.retry) return '';
  var c = o.campaign, mb = o.mailbox || {};
  var when = t.at ? ' on ' + _spDate(t.at) : '';
  var head = '<b>' + _spPlural(t.retry, 'email') + ' did not go out' + when + '.</b> ';
  if (!c.is_owner || c.archived) return '<div class="sp-alert" role="status"><div>' + head + 'They were due from ' + esc(_spOwnerName(c.owner_email) || 'the owner') + '\'s mailbox, which needs reconnecting.</div></div>';
  var btn = function (label, gold, fn) { return '<button class="g-btn sp-sm' + (gold ? ' sp-gold' : '') + '" type="button" onclick="' + fn + '">' + label + '</button>'; };
  var send = btn('Send ' + (t.retry === 1 ? 'it' : 'them') + ' again', true, 'sampRetryFailed(\'' + esc(id) + '\',' + t.launch + ')');
  var who = mb.email ? ' (' + esc(mb.email) + ')' : '';
  if (mb.status === 'reconnect' || mb.status === 'none') {
    return '<div class="sp-alert" role="alert"><div>' + head + (mb.status === 'none' ? 'No mailbox is connected.' : 'Your mailbox' + who + ' is disconnected, usually after a password change.') + ' Reconnect it, then send them again. Nothing is lost: the same emails go out, spaced within your daily limit.</div>' +
      '<div class="sp-acts">' + btn('Reconnect mailbox', true, '_spReconnect(\'' + esc(id) + '\',' + t.launch + ',\'' + (mb.provider === 'microsoft' ? 'microsoft' : 'google') + '\')') + '</div></div>';
  }
  var why = t.reason === 'mailbox' ? (mb.reconnected ? 'The mailbox was disconnected then; it is connected again now.' : 'The mailbox refused to send them.') : t.reason === 'other' ? 'The mailbox refused them. Sending again usually works.' : '';
  return '<div class="sp-alert ok" role="status"><div>' + head + why + ' The same emails go out again, spaced within your daily limit.</div><div class="sp-acts">' + send + '</div></div>';
}
async function sampRetryFailed(id, launch) {
  if (window._spRetrying) return;
  window._spRetrying = true;
  try {
    var d = await _sampEdge('retry_failed_sends', { campaign_id: id, launch: launch || null });
    if (!d.ok && d.needs_reconnect) { _spReconnectModal(id, launch, d); return; }
    if (!d.ok) { showToast(d.error || 'Could not do that'); return; }
    await _sampLoadOverview(id);
    if (!d.drafts) {
      showToast(d.cancelled ? _spPlural(d.cancelled, 'email') + ' no longer needed, cleared.' : (d.has_draft ? 'These people already have a newer draft. Schedule or delete that first.' : 'Nothing to send again.'));
      if (window._sampOpenId === id) { if (window._sampTab !== 'sequence') setSampTab(id, 'sequence'); else { _spRenderSeqTop(id); loadSampaignSendQueue(id); } }
      return;
    }
    var extra = d.cancelled ? ' ' + _spPlural(d.cancelled, 'person', 'people') + ' replied or bounced meanwhile, so theirs were cleared.' : '';
    showToast(_spPlural(d.drafts, 'email') + ' ready to go again. Pick when they go out.' + extra);
    window._sampLaunch = d.launch;
    if (window._sampOpenId === id) { if (window._sampTab !== 'sequence') setSampTab(id, 'sequence'); else { _spRenderSeqTop(id); loadSampaignSendQueue(id); } }
    planSampaignDrafts(id, null, d.launch);
  } catch (e) { showToast('Could not do that: ' + e.message); }
  finally { window._spRetrying = false; }
}
function _spReconnect(id, launch, provider) {
  window._spRetryAfterConnect = { id: id, launch: launch || null };
  try { if (provider === 'microsoft') connectOutlook(); else connectGmail(); } catch (e) { showToast('Open You, then reconnect your mailbox.'); }
}
function _spReconnectModal(id, launch, d) {
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'spReconnModal';
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  var prov = d.provider === 'microsoft' ? 'microsoft' : 'google';
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Reconnect your mailbox"><h3>Reconnect your mailbox first</h3>' +
    '<p class="sp-muted" style="margin:6px 0 0;font-size:13.5px;line-height:1.55">' + esc(d.error || 'The mailbox cannot send right now.') + '</p>' +
    '<p class="sp-muted" style="margin:10px 0 0;font-size:13.5px;line-height:1.55">' + (d.count ? 'Your ' + _spPlural(d.count, 'email') + ' are kept. ' : '') + 'As soon as it is connected, SAM picks up from here and asks when to send them.</p>' +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'spReconnModal\').remove()">Not now</button><button class="g-btn sp-gold" type="button" id="spReconnGo">Reconnect ' + (prov === 'microsoft' ? 'Outlook' : 'Gmail') + '</button></div></div>';
  document.body.appendChild(m);
  document.getElementById('spReconnGo').onclick = function () { m.remove(); _spReconnect(id, launch, prov); };
}
// Right after a mailbox connects: pick up a send-again that was waiting on
// it, or offer it for every SAMpaign that has emails that did not go out.
async function _spAfterMailboxConnected() {
  try {
    var want = window._spRetryAfterConnect; window._spRetryAfterConnect = null;
    if (want && want.id) {
      if (window._sampOpenId !== want.id || window._sampView !== 'detail') { try { switchTab('sampaign'); } catch (e) {} await new Promise(function (r) { setTimeout(r, 500); }); openSampaignDetail(want.id, 'sequence'); }
      await sampRetryFailed(want.id, want.launch);
      return;
    }
    var s = await _sampEdge('failed_sends_summary', {});
    if (!s.ok || !s.total) return;
    var old = document.getElementById('spAfterConn'); if (old) old.remove();
    var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'spAfterConn';
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    var rows = (s.campaigns || []).slice(0, 6).map(function (c) {
      return '<div class="sp-day" style="align-items:center"><span><b>' + esc(c.name || 'SAMpaign') + '</b><br><small class="sp-muted">' + _spPlural(c.count, 'email') + ' · ' + esc(String(c.label || '').toLowerCase()) + (c.since ? ' · since ' + esc(_spDate(c.since)) : '') + '</small></span>' +
        '<button class="g-btn sp-sm sp-gold" type="button" onclick="_spAfterConnGo(\'' + esc(c.campaign_id) + '\',' + (Number(c.launch) || 1) + ')">Send again</button></div>';
    }).join('');
    m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Emails that did not go out"><h3>' + _spPlural(s.total, 'email') + ' did not go out</h3>' +
      '<p class="sp-muted" style="margin:6px 0 0;font-size:13.5px;line-height:1.55">Your mailbox is connected again. These were due while it was disconnected. Send them again: the same emails, spaced within your daily limit.</p>' +
      '<div class="sp-days" style="grid-template-columns:1fr">' + rows + '</div>' +
      '<div class="sp-foot"><span></span><button class="g-btn" type="button" onclick="document.getElementById(\'spAfterConn\').remove()">Later</button></div></div>';
    document.body.appendChild(m);
  } catch (e) {}
}
async function _spAfterConnGo(id, launch) {
  var m = document.getElementById('spAfterConn'); if (m) m.remove();
  try { switchTab('sampaign'); } catch (e) {}
  await new Promise(function (r) { setTimeout(r, 500); });
  openSampaignDetail(id, 'sequence');
  sampRetryFailed(id, launch);
}

// ══ Drop D (2026-10-07): SAM revamp, Deals, people journey, toasts ════════
// SAM is the screen a manager opens first: what SAM sees today in plain
// words, who needs you, your meetings with customers, how the team is doing
// and what customers are saying. Pipeline and the SAMagic board are one tab,
// Deals. The old SAM tools live in Deals, under Reports.

// ── Toasts that always go away ──────────────────────────────────────────────
// A toast raised while the tab was in the background showed itself only
// when the tab came back (requestAnimationFrame waits for a visible tab),
// after its hide timer had already run, so it stayed on screen until a
// refresh. The hide timer now starts when the toast is actually shown, and
// a click dismisses it.
function _toastShow(t, msg, ms) {
  t.textContent = msg;
  t._seq = (t._seq || 0) + 1;
  var seq = t._seq;
  clearTimeout(t._timer);
  var hide = function () { if (t._seq !== seq) return; t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(10px)'; t.style.pointerEvents = 'none'; };
  var show = function () {
    if (t._seq !== seq) return;
    t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; t.style.pointerEvents = 'auto';
    clearTimeout(t._timer); t._timer = setTimeout(hide, ms);
  };
  if (document.visibilityState === 'hidden') {
    // Hidden tab: show it on return, for its full time.
    var onVis = function () { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', onVis); show(); } };
    document.addEventListener('visibilitychange', onVis);
  } else requestAnimationFrame(show);
  t._timer = setTimeout(hide, ms + 1500);
  t.onclick = hide;
}
function showToast(msg) {
  var t = document.getElementById('samora-global-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'samora-global-toast';
    t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite');
    t.title = 'Click to dismiss';
    t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--surface);border:1px solid var(--gold);padding:10px 18px;border-radius:var(--r-md);font-size:13px;color:var(--text);z-index:100001;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;max-width:min(560px,calc(100vw - 32px));text-align:center;font-family:var(--sans);box-shadow:var(--shadow-2);cursor:pointer';
    document.body.appendChild(t);
  }
  var s = String(msg == null ? '' : msg);
  _toastShow(t, s, Math.min(9000, 3000 + Math.max(0, s.length - 60) * 40));
}
function showCFToast(msg) { showToast(msg); }

// ── Shared bits ─────────────────────────────────────────────────────────────
var _sd = { meet: null, meetAt: 0, scoped: false, dscoped: false };
function sdSenior() { return ['super_admin', 'admin', 'manager', 'director', 'executive'].indexOf((typeof profile !== 'undefined' && profile && profile.role) || '') !== -1; }
function sdFirst() {
  var n = (typeof currentUser !== 'undefined' && currentUser && currentUser.user_metadata && currentUser.user_metadata.full_name) || '';
  if (!n && typeof currentUser !== 'undefined' && currentUser && currentUser.email) n = currentUser.email.split('@')[0].split(/[._-]/)[0];
  n = String(n).trim().split(/\s+/)[0] || '';
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
}
function sdHello() {
  var h = new Date().getHours();
  var g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  var f = sdFirst();
  return g + (f ? ', ' + f : '') + '. ' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '.';
}
function sdList(xs, max) {
  xs = xs.slice(0, max || 3);
  if (xs.length <= 1) return xs.join('');
  return xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
}
function sdWho(a) {
  var f = a.last_reply_from;
  return f && f.name ? f.name : '';
}
function sdTime(iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
function sdDom(x) { return String(x || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''); }

// Today's meetings from the calendar, matched to accounts on the board.
async function sdLoadMeetings(force) {
  if (!force && _sd.meet && Date.now() - _sd.meetAt < 10 * 60000) return _sd.meet;
  var t = new Date(), key = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  try {
    var r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'verify_meetings', date: key }) });
    var d = await r.json();
    _sd.meet = (d && d.ok && Array.isArray(d.meetings)) ? d.meetings.filter(function (m) { return !m.cancelled; }) : [];
    _sd.meetReason = (d && d.reason) || (d && d.ok ? '' : 'error');
  } catch (e) { _sd.meet = []; _sd.meetReason = 'error'; }
  _sd.meetAt = Date.now();
  return _sd.meet;
}
function sdMatchMeeting(m, accts) {
  var doms = (m.external_attendees || []).map(function (e) { return sdDom(String(e).split('@')[1] || ''); }).filter(Boolean);
  var emails = (m.external_attendees || []).map(function (e) { return String(e).toLowerCase(); });
  var title = String(m.title || '').toLowerCase();
  return accts.find(function (a) {
    var ad = sdDom(a.domain);
    if (ad && doms.some(function (d) { return d === ad || d.slice(-(ad.length + 1)) === '.' + ad; })) return true;
    if ((a.people || []).some(function (p) { return p.email && emails.indexOf(String(p.email).toLowerCase()) !== -1; })) return true;
    var nm = String(a.name || '').toLowerCase().replace(/\b(pvt|private|ltd|limited|inc|llc|india|group)\b\.?/g, '').trim();
    return nm.length >= 4 && title.indexOf(nm) !== -1;
  }) || null;
}

// ══ SAM ═════════════════════════════════════════════════════════════════════
function scSamScope(s) { _sc.view.samScope = s; _sc._samFocus = 0; renderScSam(); }
async function renderScSam(force) {
  _sc.current = 'sam';
  var el = document.getElementById('scSam'); if (!el) return;
  if (!_sd.scoped) { _sd.scoped = true; if (sdSenior()) _sc.view.samScope = 'team'; }
  scLoading(el, 'what SAM sees today');
  var d;
  try { d = await scFetch(_sc.view.samScope, force); } catch (e) { return scError(el, e, 'renderScSam(true)'); }
  if (_sc.current !== 'sam') return;
  var s = d.summary, team = d.scope === 'team';
  var accts = d.accounts || [];
  var need = accts.filter(function (a) { return a.needs && a.needs.length; });

  // What changed this week, newest first, with names.
  var wk = Date.now() - 7 * 86400000, changes = [];
  accts.forEach(function (a) {
    if (a.last_reply_at && Date.parse(a.last_reply_at) >= wk) {
      if (a.last_reply_kind === 'meeting') changes.push({ t: Date.parse(a.last_reply_at), tone: 'b', ico: 'champion', id: a.id, text: 'Meeting with <b>' + esc(a.name) + '</b>' + (a.last_by ? ' (' + esc(a.last_by) + ')' : ''), sub: scAgo(a.last_reply_at) });
      else {
        var who = sdWho(a);
        changes.push({ t: Date.parse(a.last_reply_at), tone: 'g', ico: 'reply', id: a.id, text: who ? '<b>' + esc(who) + '</b> at ' + esc(a.name) + ' wrote' : '<b>' + esc(a.name) + '</b> wrote', sub: scAgo(a.last_reply_at) + (a.last_reply_from && a.last_reply_from.email && !who ? ' · ' + a.last_reply_from.email : '') });
      }
    } else if (a.last_at && a.last_channel === 'meeting' && Date.parse(a.last_at) >= wk) {
      changes.push({ t: Date.parse(a.last_at), tone: 'b', ico: 'champion', id: a.id, text: 'Meeting with <b>' + esc(a.name) + '</b>' + (a.last_by ? ' (' + esc(a.last_by) + ')' : ''), sub: scAgo(a.last_at) });
    }
  });
  changes.sort(function (x, y) { return y.t - x.t; });

  // SAM's read: the day in a few plain sentences, built from the board.
  var replies = need.filter(function (a) { return a.needs.some(function (n) { return n.key === 'reply'; }); });
  var past = accts.filter(function (a) { return a.is_deal && a.d2c !== null && a.d2c < 0; });
  var closingQuiet = need.filter(function (a) { return a.needs.some(function (n) { return n.key === 'closing_quiet'; }); });
  var quietDeals = accts.filter(function (a) { return a.is_deal && a.activity === 'quiet'; }).sort(function (x, y) { return (y.value_usd - x.value_usd) || ((y.quiet || 0) - (x.quiet || 0)); });
  var lines = [];
  if (replies.length) lines.push('<b>' + scPlural(replies.length, 'customer') + '</b> wrote and ' + (replies.length === 1 ? 'is' : 'are') + ' waiting for a reply: ' + esc(sdList(replies.map(function (a) { return a.name + (sdWho(a) ? ' (' + sdWho(a).split(' ')[0] + ')' : ''); }), 3)) + (replies.length > 3 ? ' and ' + (replies.length - 3) + ' more' : '') + '.');
  if (past.length) lines.push('<b>' + scPlural(past.length, 'deal') + '</b> ' + (past.length === 1 ? 'is' : 'are') + ' past the close date' + (past.length <= 3 ? ': ' + esc(sdList(past.map(function (a) { return a.name; }))) : '') + '. Move the date or close ' + (past.length === 1 ? 'it' : 'them') + '.');
  if (closingQuiet.length) lines.push(esc(sdList(closingQuiet.map(function (a) { return a.name; }), 2)) + ' close' + (closingQuiet.length === 1 ? 's' : '') + ' within 30 days and ' + (closingQuiet.length === 1 ? 'has' : 'have') + ' gone quiet.');
  else if (quietDeals.length) lines.push(esc(quietDeals[0].name) + (quietDeals[0].value_usd ? ' (' + esc(scMoney(quietDeals[0].value_usd)) + ')' : '') + ' has been quiet for ' + quietDeals[0].quiet + ' days' + (quietDeals.length > 1 ? ', with ' + (quietDeals.length - 1) + ' more quiet deal' + (quietDeals.length > 2 ? 's' : '') : '') + '.');
  if (team) {
    var pulse = (d.by_owner || []).slice();
    var busiest = pulse.filter(function (o) { return o.replies_waiting; }).sort(function (x, y) { return y.replies_waiting - x.replies_waiting; })[0];
    if (busiest && replies.length > 1) lines.push(esc(busiest.name || 'Someone') + ' has the most waiting: ' + scPlural(busiest.replies_waiting, 'reply', 'replies') + '.');
    var broken = pulse.filter(function (o) { return o.is_active !== false && (o.mailbox === 'reconnect' || o.mailbox === 'none'); });
    if (broken.length) lines.push(esc(sdList(broken.map(function (o) { return (o.name || 'Someone') + '’s'; }), 3)) + (broken.length > 3 ? ' and ' + (broken.length - 3) + ' more' : '') + (broken.length === 1 ? ' mailbox is' : ' mailboxes are') + ' not connected, so SAM cannot see all of the team’s accounts.');
  }
  if (!lines.length) lines.push(s.active ? 'Nothing urgent. ' + scPlural(s.active, 'account') + ' had contact this week.' : 'Nothing urgent today.');
  if (s.unknown) lines.push('SAM cannot see ' + scPlural(s.unknown, 'account') + ' yet: nobody’s connected mailbox has mail with ' + (s.unknown === 1 ? 'it' : 'them') + '.');

  // Team pulse: one row per person, most to do first.
  var pulseHtml = '';
  if (team && (d.by_owner || []).length) {
    var mbTxt = { ok: 'Mailbox working', none: 'No mailbox connected', reconnect: 'Mailbox needs reconnecting', stale: 'Mailbox not checked lately' };
    var rows = (d.by_owner || []).slice().sort(function (x, y) { return ((y.needs || 0) - (x.needs || 0)) || (y.value_usd - x.value_usd); });
    pulseHtml = '<section class="sp-card sp-pad sd-pulse" aria-label="Team pulse"><div class="sd-sh"><div><div class="sp-lbl">Team pulse</div><div class="sp-small" style="margin-top:4px">Click a person for their week: intent vs reality, coverage and what needs them.</div></div><button class="rv-link" onclick="sdGoDeals(\'person\')">Deals by person</button></div>' +
      '<div class="sd-ptab" role="table"><div class="sd-prow sd-phead" role="row"><span>Person</span><span>Need them</span><span>Replies waiting</span><span>Quiet deals</span><span>Past close</span><span class="r">Pipeline</span></div>' +
      rows.map(function (o) {
        return '<button class="sd-prow" role="row" title="Their week: intent vs reality" onclick="sdPerson(\'' + esc(o.user_id) + '\')"><span class="sd-pn"><span class="rv-tav">' + esc(scInit(o.name)) + '<i class="mb ' + esc(o.mailbox) + '" title="' + esc(mbTxt[o.mailbox] || '') + '"></i></span><b>' + esc(o.name || 'Someone') + '</b>' + (o.mailbox !== 'ok' ? '<small class="rv-red">' + esc(mbTxt[o.mailbox] || '') + '</small>' : '') + '</span>' +
          '<span data-l="Need them">' + (o.needs || 0) + '</span><span data-l="Replies waiting" class="' + (o.replies_waiting ? 'sp-g' : '') + '">' + (o.replies_waiting || 0) + '</span><span data-l="Quiet deals" class="' + (o.quiet ? 'rv-red' : '') + '">' + (o.quiet || 0) + '</span><span data-l="Past close" class="' + (o.past_due ? 'rv-red' : '') + '">' + (o.past_due || 0) + '</span><span data-l="Pipeline" class="r">' + esc(scMoney0(o.value_usd)) + '</span></button>';
      }).join('') + '</div></section>';
  }

  // What customers are saying (was the Intel tab).
  var KIND = { Commitment: 'live', Expansion: 'live', Pricing: 'warn', Product: '', Competitor: 'risk', Risk: 'risk' };
  var voice = (d.voice || []);
  var vk = _sc.view.voice || 'all';
  var kinds = []; voice.forEach(function (v) { if (kinds.indexOf(v.kind) === -1) kinds.push(v.kind); });
  var vshown = voice.filter(function (v) { return vk === 'all' || v.kind === vk; }).slice(0, 8);
  var voiceHtml = '<section class="sp-card sp-pad sd-voice" aria-label="What customers are saying"><div class="sd-sh"><div class="sp-lbl">What customers are saying · last 14 days</div><button class="rv-link" onclick="switchTab(\'intel\')">All customer signals</button></div>' +
    (voice.length ? (kinds.length > 1 ? '<div class="sd-vk">' + scSeg([['all', 'All']].concat(kinds.map(function (k) { return [k, k]; })), vk, 'sdVoiceKind') + '</div>' : '') +
      '<ul class="sd-vlist">' + vshown.map(function (v) {
        return '<li><span class="sp-chip ' + (KIND[v.kind] || '') + '">' + esc(v.kind) + '</span><div><div class="sd-vt">' + esc(v.label) + '</div><div class="sp-small"><button class="rv-plain" onclick="scOpen(\'' + esc(v.account_id) + '\')">' + esc(v.account) + '</button>' + (team && v.owner_name ? ' · ' + esc(v.owner_name) : '') + (v.date ? ' · ' + esc(scAgo(v.date + 'T12:00:00Z')) : '') + '</div></div></li>';
      }).join('') + '</ul>'
      : '<div class="sp-small" style="margin-top:10px">Nothing from meeting notes in the last 14 days. Signals appear here once your notetaker sends recaps.</div>') + '</section>';

  var f = _sc.view.sam, q = (_sc.samQ || '').toLowerCase();
  var counts = { all: accts.length, need: need.length, active: s.active, quiet: s.quiet, unknown: s.unknown, none: accts.filter(function (a) { return a.activity === 'none'; }).length };
  var list = accts.filter(function (a) {
    if (q && (a.name + ' ' + (a.owner_name || '') + ' ' + (a.domain || '')).toLowerCase().indexOf(q) === -1) return false;
    if (f === 'need') return a.needs && a.needs.length;
    if (f === 'all') return true;
    return a.activity === f;
  });
  var shown = list.slice(0, 200);
  el.innerHTML = '<div class="rv-loaded"></div>' +
    '<div class="page-head"><div><div class="page-title">SAM</div><div class="page-sub">' + esc(sdHello()) + '</div></div>' +
    '<div class="page-actions">' + (d.team_capable ? scSeg([['mine', 'Mine'], ['team', 'My team']], d.scope, 'scSamScope') : '') +
    '<button class="g-btn" onclick="scSamRefresh(this)">Refresh</button></div></div>' +
    scMailboxBanner(d) +
    '<div class="sd-top">' +
      '<section class="sp-card sp-pad sd-read" aria-label="SAM’s read"><div class="sp-lbl">SAM’s read' + (team ? ' · your team' : '') + '</div>' +
        '<ul class="sd-lines">' + lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>' +
        '<div class="sd-meet" id="sdMeet"><div class="sp-lbl">Today’s meetings</div><div class="sp-small">Checking your calendar…</div></div>' +
      '</section>' +
      '<aside class="sp-card sp-pad sp-needs" aria-label="This week"><div class="sp-lbl">This week</div>' +
      (changes.length ? '<ul>' + changes.slice(0, 8).map(function (c) {
        return '<li><span class="sp-ni ' + c.tone + '">' + scIco(c.ico) + '</span><div><button class="rv-plain" onclick="scOpen(\'' + esc(c.id) + '\')">' + c.text + '</button><div class="sp-small">' + esc(c.sub) + '</div></div></li>';
      }).join('') + '</ul>' : '<div class="sp-small" style="margin-top:10px">No replies or meetings yet this week.</div>') +
      '</aside>' +
    '</div>' +
    '<section class="sp-card sp-kpis" aria-label="At a glance">' +
      '<div class="sp-kpi"><div class="sp-lbl">Need you today</div><div class="n">' + s.needs_you + '</div><div class="d">' + scPlural(s.replies_waiting, 'reply', 'replies') + ' waiting</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Active</div><div class="n sp-g">' + s.active + '</div><div class="d">contact in 7 days</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Quiet</div><div class="n' + (s.quiet ? ' rv-red' : '') + '">' + s.quiet + '</div><div class="d">' + d.definitions.quiet_days + ' days or more</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Open pipeline</div><div class="n">' + esc(scMoney0(s.value_usd)) + '</div><div class="d">' + scPlural(s.deals, 'deal') + (s.at_risk ? ', ' + s.at_risk + ' at risk' : '') + '</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Closing in 30 days</div><div class="n">' + s.closing_30 + '</div><div class="d">' + (s.past_due ? scPlural(s.past_due, 'deal') + ' past due' : 'none past due') + '</div></div>' +
    '</section>' +
    pulseHtml +
    '<div class="sp-two">' +
      '<section class="sp-card sp-pad rv-needs" aria-label="Needs you today"><div class="sp-lbl">' + (team ? 'Needs your team today' : 'Needs you today') + ' · ' + need.length + '</div>' +
      (need.length ? '<ul class="rv-nlist">' + need.slice(0, 10).map(function (a) {
        var n = a.needs[0];
        return '<li><span class="sp-ni ' + (n.tone === 'good' ? 'g' : n.tone === 'bad' ? 'r' : 'a') + '">' + scIco(n.key) + '</span>' +
          '<div class="rv-nmain"><div class="rv-nt"><button class="rv-name" onclick="scOpen(\'' + esc(a.id) + '\')">' + esc(a.name) + '</button>' + (a.value_usd ? ' <span class="rv-val">' + esc(scMoney(a.value_usd)) + '</span>' : '') + (team && a.owner_name ? ' <span class="rv-owner">' + esc(a.owner_name) + '</span>' : '') + '</div>' +
          '<div class="rv-why">' + esc(n.text) + '</div><div class="sp-small">' + esc(scLast(a)) + (a.needs.length > 1 ? ' · ' + (a.needs.length - 1) + ' more' : '') + '</div></div>' +
          '<button class="g-btn rv-act" onclick="scOpen(\'' + esc(a.id) + '\')">' + esc(n.act || 'Open') + '</button></li>';
      }).join('') + '</ul>' + (need.length > 10 ? '<button class="rv-link" onclick="scSamFilter(\'need\');document.getElementById(\'scSamAll\').scrollIntoView({behavior:\'smooth\'})">See all ' + need.length + '</button>' : '')
        : '<div class="sp-empty">Nothing needs ' + (team ? 'your team' : 'you') + ' right now. ' + (s.unknown ? 'Some accounts are Unknown, so SAM may be missing something.' : 'Good place to be.') + '</div>') +
      '</section>' + voiceHtml +
    '</div>' +
    '<section class="sp-card sp-pad rv-all" id="scSamAll" aria-label="All accounts">' +
      '<div class="rv-bar"><div class="sp-lbl">All ' + (team ? 'team ' : '') + 'accounts · ' + accts.length + '</div>' +
      '<div class="rv-tools">' + scSeg([['all', 'All ' + counts.all], ['need', 'Need you ' + counts.need], ['active', 'Active ' + counts.active], ['quiet', 'Quiet ' + counts.quiet], ['unknown', 'Unknown ' + counts.unknown], ['none', 'Not started ' + counts.none]], f, 'scSamFilter') +
      '<input class="sp-search" placeholder="Find an account" value="' + esc(_sc.samQ || '') + '" oninput="_sc.samQ=this.value;_sc._samFocus=1;clearTimeout(_sc._sq);_sc._sq=setTimeout(function(){renderScSam()},250)" aria-label="Find an account"/></div></div>' +
      (shown.length ? '<div class="rv-rows">' + shown.map(function (a) {
        return '<button class="rv-arow" onclick="scOpen(\'' + esc(a.id) + '\')"><span class="rv-an">' + esc(a.name) + (team && a.owner_name ? '<small>' + esc(a.owner_name) + '</small>' : '') + '</span>' +
          '<span>' + scActChip(a) + '</span><span class="rv-al">' + esc(scLast(a)) + '</span><span class="rv-av">' + esc(scMoney(a.value_usd)) + '</span><span>' + scBandChip(a) + '</span></button>';
      }).join('') + '</div>' + (list.length > shown.length ? '<div class="sp-small" style="margin-top:10px">Showing 200 of ' + list.length + '. Search to find the rest.</div>' : '')
        : '<div class="sp-empty">' + (accts.length ? 'Nothing matches.' : 'No accounts yet. Accounts assigned to you appear here.') + '</div>') +
    '</section>' + scHow();
  if (_sc._samFocus) { var inp = el.querySelector('.rv-all .sp-search'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
  sdFillMeetings(d);
}
function sdVoiceKind(k) { _sc.view.voice = k; renderScSam(); }
async function sdFillMeetings(d, force) {
  var box = document.getElementById('sdMeet'); if (!box) return;
  var ms = await sdLoadMeetings(force);
  box = document.getElementById('sdMeet'); if (!box || _sc.current !== 'sam') return;
  var all = []; for (var k in _sc.data) (_sc.data[k].accounts || []).forEach(function (a) { if (!all.some(function (x) { return x.id === a.id; })) all.push(a); });
  var ext = ms.filter(function (m) { return (m.external_attendees || []).length; });
  var internal = ms.length - ext.length;
  if (!ms.length) { box.innerHTML = '<div class="sp-lbl">Today’s meetings</div><div class="sp-small">' + (_sd.meetReason === 'not_connected' ? 'Connect your mailbox to see today’s meetings here.' : _sd.meetReason === 'error' ? 'Could not read your calendar just now.' : 'No meetings on your calendar today.') + '</div>'; return; }
  box.innerHTML = '<div class="sp-lbl">Today’s meetings · ' + ms.length + '</div>' +
    (ext.length ? '<ul class="sd-mlist">' + ext.slice(0, 6).map(function (m) {
      var a = sdMatchMeeting(m, all);
      var prep = a ? [a.is_deal ? (scMoney(a.value_usd) || 'Deal, no value yet') + (a.stage_label && a.stage ? ', ' + a.stage_label.toLowerCase() : '') : '', scLast(a), a.last_reply_at && a.last_reply_kind !== 'meeting' ? 'last reply ' + scAgo(a.last_reply_at) + (sdWho(a) ? ' from ' + sdWho(a).split(' ')[0] : '') : ''].filter(Boolean).join(' · ')
        : 'With ' + sdList((m.external_attendees || []).map(function (e) { return String(e).split('@')[1] || e; }).filter(function (x, i, arr) { return arr.indexOf(x) === i; }), 2) + '. Not an account yet.';
      return '<li><span class="sd-mt">' + esc(sdTime(m.startTime)) + '</span><div><div class="sd-mn">' + esc(m.title || 'Meeting') + (m.ended ? ' <span class="sp-chip">Done</span>' : '') + '</div><div class="sp-small">' + esc(prep) + '</div></div>' +
        (a ? '<button class="g-btn sp-sm" onclick="scOpen(\'' + esc(a.id) + '\')">Prep</button>' : '') + '</li>';
    }).join('') + '</ul>' : '') +
    (internal ? '<div class="sp-small" style="margin-top:6px">' + (ext.length ? 'Plus ' : '') + scPlural(internal, 'internal meeting') + '.</div>' : '');
}
async function scSamRefresh(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Checking your mailbox…'; }
  try { await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'mailbox_pass' }) }); } catch (e) {}
  scInvalidate(); _sd.meet = null; await renderScSam(true);
}

// ══ Deals: the list, the board by stage and by person ══════════════════════
function sdGoDeals(view, owner) {
  _sc.view.dealsView = view || 'list';
  if (owner) { _sc.view.dealsScope = 'team'; _sc.f.owner = owner; }
  if (view === 'person') _sc.view.dealsScope = 'team';
  switchTab('pipeline');
}
function scDealsView(v) { _sc.view.dealsView = v; renderScDeals(); }
async function renderScDeals(force) {
  if (!_sd.dscoped) { _sd.dscoped = true; if (sdSenior()) _sc.view.dealsScope = 'team'; }
  var v = _sc.view.dealsView || 'list';
  if (v === 'list') { await _scListDeals(force); sdDealsChrome(); return; }
  _sc.current = 'deals';
  var el = document.getElementById('scDeals'); if (!el) return;
  scLoading(el, 'the board');
  var d;
  try { d = await scFetch(_sc.view.dealsScope, force); } catch (e) { return scError(el, e, 'renderScDeals(true)'); }
  if (_sc.current !== 'deals') return;
  el.innerHTML = '<div class="rv-loaded"></div>' + sdBoardHtml(d, v === 'person' ? 'person' : 'stage', 'deals');
  sdDealsChrome();
}
// The list keeps its page head; the view switch goes beside Mine / My team.
function sdDealsChrome() {
  var el = document.getElementById('scDeals'); if (!el) return;
  var title = el.querySelector('.page-title'); if (title) title.textContent = 'Deals';
  var acts = el.querySelector('.page-actions'); if (!acts || acts.querySelector('.sd-view')) return;
  var d = _sc.data[_sc.view.dealsScope] || {};
  var views = [['list', 'List'], ['stage', 'By stage']].concat(d.team_capable ? [['person', 'By person']] : []);
  var w = document.createElement('span'); w.className = 'sd-view'; w.innerHTML = scSeg(views, _sc.view.dealsView || 'list', 'scDealsView');
  acts.insertBefore(w, acts.firstChild);
}
function sdBoardHtml(d, by, where) {
  var s = d.summary, v = _sc.view;
  var rep = where === 'deals' ? (_sc.f.owner || '') : v.boardRep;
  var deals = (d.accounts || []).filter(function (a) {
    if (!a.is_deal) return false;
    if (rep && a.owner !== rep) return false;
    if (v.boardFilter === 'risk') return a.band === 'at_risk' || a.band === 'critical';
    if (v.boardFilter === 'quiet') return a.activity === 'quiet' || a.activity === 'unknown';
    if (v.boardFilter === 'closing') return a.d2c !== null && a.d2c <= 30;
    return true;
  }).sort(function (x, y) { return y.value_usd - x.value_usd; });
  var cols;
  if (by === 'person') {
    cols = (d.by_owner || []).map(function (o) { return { key: o.user_id, label: o.name || 'Someone', items: deals.filter(function (a) { return a.owner === o.user_id; }) }; }).filter(function (c) { return c.items.length || !rep; });
  } else {
    var known = {}; (d.stages || []).forEach(function (x) { known[x.key] = 1; });
    cols = (d.stages || []).map(function (x) { return { key: x.key, label: x.label, items: deals.filter(function (a) { return a.stage === x.key; }) }; });
    var rest = deals.filter(function (a) { return !known[a.stage]; });
    if (rest.length) cols.push({ key: '', label: 'No stage', items: rest });
  }
  var team = (d.by_owner || []).filter(function (o) { return o.deals || o.mailbox !== 'ok'; });
  var mbTxt = { ok: 'Mailbox working', none: 'No mailbox connected', reconnect: 'Mailbox needs reconnecting', stale: 'Mailbox not checked lately' };
  var repFn = where === 'deals' ? 'sdBoardRep' : 'scBoardRep';
  var head = where === 'deals'
    ? '<div class="page-head"><div><div class="page-title">Deals</div><div class="page-sub">Every open deal ' + (d.scope === 'team' ? 'in your team ' : '') + 'on one board. Click a person to see only their deals.</div></div>' +
      '<div class="page-actions">' + (d.team_capable ? scSeg([['mine', 'Mine'], ['team', 'My team']], d.scope, 'scDealsScope') : '') + '<button class="g-btn" onclick="renderScDeals(true)">Refresh</button></div></div>'
    : '<div class="page-head"><div><div class="page-title">SAMagic</div><div class="page-sub">Every open deal ' + (d.scope === 'team' ? 'in your team ' : '') + 'on one board. Click a person to see only their deals.</div></div>' +
      '<div class="page-actions">' + scSeg([['stage', 'By stage'], ['person', 'By person']], by, 'scBoardBy') + '<button class="g-btn" onclick="renderScBoard(true)">Refresh</button></div></div>';
  return head +
    '<section class="sp-card sp-kpis rv-k4" aria-label="Pipeline">' +
      '<div class="sp-kpi"><div class="sp-lbl">Open pipeline</div><div class="n">' + esc(scMoney0(s.value_usd)) + '</div><div class="d">' + scPlural(s.deals, 'deal') + '</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Weighted</div><div class="n">' + esc(scMoney0(s.weighted_usd)) + '</div><div class="d">by chance to close</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">At risk</div><div class="n' + (s.at_risk ? ' rv-red' : '') + '">' + esc(scMoney0(s.at_risk_usd)) + '</div><div class="d">' + scPlural(s.at_risk, 'deal') + '</div></div>' +
      '<div class="sp-kpi"><div class="sp-lbl">Closing this quarter</div><div class="n">' + esc(scMoney0(s.closing_quarter_usd)) + '</div><div class="d">' + s.past_due + ' past due</div></div>' +
    '</section>' +
    (d.scope === 'team' && team.length ? '<div class="rv-team" role="group" aria-label="People">' + team.map(function (o) {
      return '<button class="sp-card rv-tm' + (rep === o.user_id ? ' on' : '') + '" aria-pressed="' + (rep === o.user_id) + '" onclick="' + repFn + '(\'' + esc(o.user_id) + '\')">' +
        '<span class="rv-tav">' + esc(scInit(o.name)) + '<i class="mb ' + o.mailbox + '" title="' + esc(mbTxt[o.mailbox] || '') + '"></i></span>' +
        '<span class="rv-tw"><b>' + esc(o.name || 'Someone') + '</b><small>' + scPlural(o.deals, 'deal') + ' · ' + esc(scMoney0(o.value_usd)) + '</small>' +
        '<span class="rv-tc">' + (o.at_risk ? '<span class="sp-chip risk">' + o.at_risk + ' at risk</span>' : '') + (o.quiet ? '<span class="sp-chip warn">' + o.quiet + ' quiet</span>' : '') + (o.unknown ? '<span class="sp-chip">' + o.unknown + ' unknown</span>' : '') + (o.mailbox !== 'ok' ? '<span class="sp-chip">' + esc(mbTxt[o.mailbox]) + '</span>' : '') + '</span></span></button>';
    }).join('') + '</div>' : '') +
    '<div class="rv-bbar">' + scSeg([['all', 'All deals'], ['risk', 'At risk'], ['quiet', 'Quiet or unknown'], ['closing', 'Closing in 30 days']], v.boardFilter, where === 'deals' ? 'sdBoardFilter' : 'scBoardFilter') +
    (rep ? '<button class="rv-link" onclick="' + repFn + '(\'' + esc(rep) + '\')">Show everyone</button>' : '') + '</div>' +
    '<div class="rv-board" role="list">' + cols.map(function (c) {
      var val = c.items.reduce(function (n, a) { return n + a.value_usd; }, 0);
      return '<section class="rv-col" role="listitem" aria-label="' + esc(c.label) + '"><header><b>' + esc(c.label) + '</b><span>' + c.items.length + ' · ' + esc(scMoney0(val)) + '</span></header>' +
        (c.items.length ? c.items.map(function (a) {
          var b = SC_BAND[a.band] || null;
          return '<button class="rv-card ' + (b ? b[1].split(' ')[0] : '') + '" onclick="scOpen(\'' + esc(a.id) + '\')">' +
            '<span class="rv-ct"><b>' + esc(a.name) + '</b><span>' + esc(scMoney(a.value_usd) || 'No value') + '</span></span>' +
            '<span class="rv-cm">' + (by === 'person' ? esc(a.stage_label) : '<span class="rv-ini" title="' + esc(a.owner_name) + '">' + esc(scInit(a.owner_name)) + '</span>' + esc(a.owner_name)) + ' · <span class="' + (a.d2c !== null && a.d2c < 0 ? 'rv-red' : '') + '">' + esc(scCloseText(a)) + '</span></span>' +
            '<span class="rv-cb">' + scBandChip(a) + scActChip(a) + '</span>' +
            (a.band_reason && a.band !== 'healthy' ? '<span class="rv-cr">' + esc(a.band_reason) + '</span>' : '') +
          '</button>';
        }).join('') : '<div class="rv-cempty">No deals</div>') + '</section>';
    }).join('') + '</div>' + scHow();
}
function sdBoardRep(u) { _sc.f.owner = _sc.f.owner === u ? '' : u; renderScDeals(); }
function sdBoardFilter(f) { _sc.view.boardFilter = f; renderScDeals(); }
async function renderScBoard(force) {
  _sc.current = 'board';
  var el = document.getElementById('scBoard'); if (!el) return;
  scLoading(el, 'the board');
  var d;
  try { d = await scFetch('team', force); } catch (e) { return scError(el, e, 'renderScBoard(true)'); }
  if (_sc.current !== 'board') return;
  el.innerHTML = '<div class="rv-loaded"></div>' + sdBoardHtml(d, _sc.view.boardBy, 'board');
}
function scRefreshCurrent() {
  scInvalidate();
  if (_sc.current === 'sam') renderScSam(true);
  else if (_sc.current === 'deals') renderScDeals(true);
  else if (_sc.current === 'board') renderScBoard(true);
}

// The old tools move to Deals: Reports (the classic SAM brief, scan,
// call sync, coverage, intent vs reality, time by account, ICP fit) and,
// for managers, Team activity.
function scWireMore() {
  var deals = document.getElementById('panel-pipeline');
  var anchor = document.getElementById('scDealsMore');
  var move = function (id, label, sub) {
    var x = document.getElementById(id); if (!x || !deals || !anchor) return;
    if (x.parentElement !== anchor.parentElement || !x._sdMoved) { anchor.parentElement.insertBefore(x, anchor.nextSibling); x._sdMoved = 1; }
    var sum = x.querySelector('summary');
    if (sum && label) sum.innerHTML = '<span>' + label + '</span><small>' + sub + '</small>';
  };
  move('scBoardMore', 'Team activity', 'tasks, wins and issues by person');
  move('scSamMore', 'Reports', 'classic SAM brief, scan channels, call sync, coverage, intent vs reality, time by account, ICP fit');
  var bm = document.getElementById('scBoardMore'); if (bm) bm.style.display = sdSenior() ? '' : 'none';
  var bind = function (id, fn) { var d = document.getElementById(id); if (d && !d._scBound) { d._scBound = 1; d.addEventListener('toggle', function () { if (d.open) { try { fn(); } catch (e) {} } }); } };
  bind('scSamMore', function () {
    var seniorRole = sdSenior();
    var t = document.getElementById('samModeToggle'); if (t) t.style.display = seniorRole ? 'block' : 'none';
    setSamMode((seniorRole && _samMode === 'team') ? 'team' : 'self');
  });
  bind('scDealsMore', function () { _scOldPipeline(); });
  bind('scBoardMore', function () { loadExecDashboard(); });
  // Ask SAM stays on the SAM screen.
  var panel = document.getElementById('panel-signals');
  ['samChatOutput', 'samChatBar', 'samChatFab'].forEach(function (id) { var x = document.getElementById(id); if (panel && x && x.closest('details')) panel.appendChild(x); });
}

// ══ The deal sheet: who wrote, by name ═════════════════════════════════════
function scOpen(id) {
  _scOpenC(id);
  var a = scFind(id), el = document.getElementById('scSheet'); if (!a || !el) return;
  var p = [].slice.call(el.querySelectorAll('.rv-p')).find(function (x) { return /Their last reply/.test(x.textContent); });
  if (p) {
    var who = sdWho(a);
    p.textContent = scLast(a) + '. ' + (a.last_reply_kind === 'meeting' ? 'Last met: ' + scAgo(a.last_reply_at) + '.' : 'Their last reply: ' + scAgo(a.last_reply_at) + (who ? ', from ' + who : '') + '.');
  }
}

// ══ SAMpaign People: the journey (7 Oct) ═══════════════════════════════════
// One look tells you who is in the SAMpaign and how far each person got:
// not reached, in the sequence, replied, meeting, in a deal. Grouped by
// company. Someone who replied or booked a meeting moves to the deal in one
// click, and the conversation carries on there.
var SP_STAGES = [
  ['not_reached', 'Not reached', 'Not written to yet'],
  ['sequence', 'In sequence', 'Emails going out, no reply yet'],
  ['replied', 'Replied', 'Wrote back'],
  ['meeting', 'Meeting', 'Meeting booked'],
  ['deal', 'In a deal', 'On a deal’s account']
];
var SP_STAGE_CHIP = { not_reached: '', sequence: 'warn', replied: 'live', meeting: 'int', deal: 'live', dropped: 'risk' };
window._spPeople = window._spPeople || {};
window._spPeopleMode = window._spPeopleMode || {};
window._spPeopleF = window._spPeopleF || {};

function _spPeopleHost(id) { return document.getElementById('spPeople_' + id); }
async function _spRenderPeople(id, keepScroll) {
  var body = document.getElementById('sampBody_' + id); if (!body) return;
  if (window._spPeopleMode[id] === 'manage') {
    body.innerHTML = '<div class="sd-pmode"><button class="g-btn sp-sm" type="button" onclick="_spPeopleSetMode(\'' + esc(id) + '\',\'journey\')">Back to the journey</button><span class="sp-small">Change statuses, remove people, add notes.</span></div>' +
      _spPeopleChips(id) + '<div id="sampaignContacts_' + esc(id) + '"><div class="sp-small">Loading people…</div></div><div id="sampaignAddRows_' + esc(id) + '"></div>';
    _loadSampaignContactsIntoOld(id);
    return;
  }
  if (!_spPeopleHost(id)) body.innerHTML = '<div id="spPeople_' + esc(id) + '" class="sd-people"><div class="sp-card sp-empty">Loading people…</div></div>';
  var d;
  try { d = await _sampEdge('get_sampaign_people', { campaign_id: id }); } catch (e) { d = { ok: false, error: e.message }; }
  var host = _spPeopleHost(id); if (!host) return;
  if (!d.ok) { host.innerHTML = '<div class="sp-card sp-empty">' + esc(d.error || 'Could not load the people.') + ' <button class="g-btn" onclick="_spRenderPeople(\'' + esc(id) + '\')">Try again</button></div>'; return; }
  window._spPeople[id] = d;
  _spPaintPeople(id);
}
function _spPeopleSetMode(id, m) { window._spPeopleMode[id] = m; var b = document.getElementById('sampBody_' + id); if (b) b.innerHTML = ''; _spRenderPeople(id); }
function _spPeopleStage(id, st) { var f = window._spPeopleF[id] = window._spPeopleF[id] || {}; f.stage = f.stage === st ? '' : st; f.more = {}; _spPaintPeople(id); }
function _spPeopleMore(id, key) { var f = window._spPeopleF[id] = window._spPeopleF[id] || {}; f.more = f.more || {}; f.more[key] = 1; _spPaintPeople(id); }
function _spPaintPeople(id) {
  var host = _spPeopleHost(id), d = window._spPeople[id]; if (!host || !d) return;
  var f = window._spPeopleF[id] = window._spPeopleF[id] || {};
  var c = d.counts || {}, owner = d.is_owner;
  var total = (d.people || []).length;
  var q = String(f.q || '').toLowerCase();
  var people = (d.people || []).filter(function (p) {
    if (f.stage && p.stage !== f.stage) return false;
    if (q && (p.name + ' ' + p.email + ' ' + p.company + ' ' + p.title).toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
  var RANK = { deal: 0, meeting: 1, replied: 2, sequence: 3, not_reached: 4, dropped: 5 };
  var groups = {};
  people.forEach(function (p) { var k = p.account_name || p.company || 'Other'; (groups[k] = groups[k] || []).push(p); });
  var keys = Object.keys(groups).sort(function (a, b) {
    var ra = Math.min.apply(null, groups[a].map(function (p) { return RANK[p.stage]; })), rb = Math.min.apply(null, groups[b].map(function (p) { return RANK[p.stage]; }));
    return (ra - rb) || (groups[b].length - groups[a].length) || a.localeCompare(b);
  });
  var funnel = '<div class="sd-funnel" role="group" aria-label="Where people are">' + SP_STAGES.map(function (s, i) {
    var n = c[s[0]] || 0, on = f.stage === s[0];
    return (i ? '<span class="sd-fa" aria-hidden="true">›</span>' : '') + '<button type="button" class="sd-fs' + (on ? ' on' : '') + (n ? '' : ' zero') + '" aria-pressed="' + on + '" onclick="_spPeopleStage(\'' + esc(id) + '\',\'' + s[0] + '\')" title="' + esc(s[2]) + '"><b>' + n + '</b><span>' + s[1] + '</span></button>';
  }).join('') + (c.dropped ? '<button type="button" class="sd-fs sd-drop' + (f.stage === 'dropped' ? ' on' : '') + '" onclick="_spPeopleStage(\'' + esc(id) + '\',\'dropped\')" title="Bounced, opted out or not interested"><b>' + c.dropped + '</b><span>Dropped</span></button>' : '') + '</div>';
  var reached = total - (c.not_reached || 0) - (c.dropped || 0);
  var conv = reached ? Math.round(((c.replied || 0) + (c.meeting || 0) + (c.deal || 0)) / Math.max(1, reached + (c.dropped || 0)) * 100) : 0;
  var tools = owner ? '<div class="sd-ptools">' +
      '<label class="g-btn sp-sm">Upload CSV<input type="file" accept=".csv,text/csv" style="display:none" onchange="handleSampaignCsv(\'' + esc(id) + '\',this.files[0]);this.value=\'\'"/></label>' +
      '<button class="g-btn sp-sm" type="button" onclick="scoutSampaignContacts(\'' + esc(id) + '\')">Scout more contacts</button>' +
      '<button class="g-btn sp-sm" type="button" onclick="openSampaignScoutProfile(\'' + esc(id) + '\')">Who to hunt</button>' +
      '<button class="g-btn sp-sm" type="button" onclick="addSampaignContactRows(\'' + esc(id) + '\')">Add people</button>' +
      '<button class="g-btn sp-sm" type="button" onclick="enrichSampaignContacts(\'' + esc(id) + '\')">Enrich</button>' +
      '<button class="g-btn sp-sm sp-ghost" type="button" onclick="_spPeopleSetMode(\'' + esc(id) + '\',\'manage\')">Manage list</button></div>' : '';
  var shownGroups = 0, rowsOut = 0;
  var list = keys.map(function (k) {
    if (rowsOut > 400) return '';
    shownGroups++;
    var ps = groups[k].slice().sort(function (x, y) { return (RANK[x.stage] - RANK[y.stage]) || String(y.last_at || '').localeCompare(String(x.last_at || '')); });
    var lim = (f.more && f.more[k]) ? ps.length : 5;
    var head = ps.find(function (p) { return p.account_name; }) || ps[0];
    var dealP = ps.find(function (p) { return p.stage === 'deal' && p.deal_value_usd !== null; });
    var cnt = {}; ps.forEach(function (p) { cnt[p.stage] = (cnt[p.stage] || 0) + 1; });
    var sumTxt = SP_STAGES.concat([['dropped', 'Dropped']]).filter(function (s) { return cnt[s[0]]; }).map(function (s) { return cnt[s[0]] + ' ' + s[1].toLowerCase(); }).join(' · ');
    var rows = ps.slice(0, lim).map(function (p) {
      rowsOut++;
      var lab = (SP_STAGES.find(function (s) { return s[0] === p.stage; }) || ['dropped', 'Dropped'])[1];
      var when = p.last_at ? _spAgo(p.last_at) : '';
      var acts = '';
      if ((p.stage === 'replied' || p.stage === 'meeting') && d.can_move) acts += '<button class="g-btn sp-sm sp-gold" type="button" onclick="_spMoveToDeal(\'' + esc(id) + '\',\'' + esc(p.id) + '\',this)">Move to deal</button>';
      if (p.stage === 'deal' && p.account_id) acts += '<button class="g-btn sp-sm" type="button" onclick="_spOpenDeal(\'' + esc(p.account_id) + '\',\'' + esc(String(p.account_name || '').replace(/'/g, '')) + '\')">Open deal</button>';
      if ((p.stage === 'replied' || p.stage === 'meeting') && owner && p.email) acts += '<a class="g-btn sp-sm sp-ghost" href="https://mail.google.com/mail/u/0/#search/' + encodeURIComponent('from:' + p.email) + '" target="_blank" rel="noopener">Open the reply</a>';
      acts = acts + _g23PhoneHtml(id, p, owner || d.can_move);
      if (owner && p.removed) acts += '<button class="g34-rm" type="button" onclick="g34Restore(\'' + esc(id) + '\',\'' + esc(p.id) + '\')">Bring back</button>';
      else if (owner && p.stage !== 'deal' && p.stage !== 'meeting') acts += '<button class="g34-rm" type="button" aria-label="Remove ' + esc(p.name || 'this person') + ' from this SAMpaign" onclick="g34Remove(\'' + esc(id) + '\',{contact_ids:[\'' + esc(p.id) + '\']},\'' + esc(String(p.name || 'this person').replace(/'/g, '')) + '\')">Remove</button>';
      return '<li class="sd-prs" data-cid="' + esc(p.id) + '"><span class="sp-av">' + esc(_spIni(p.name || p.email)) + '</span>' +
        '<div class="sd-pm"><div class="sd-pt"><b>' + esc(p.name || p.email || 'Unnamed') + '</b>' + (p.title ? '<span class="sp-small"> · ' + esc(p.title) + '</span>' : '') + (p.linkedin_url ? ' <a class="sd-li" href="' + esc(p.linkedin_url) + '" target="_blank" rel="noopener" aria-label="LinkedIn">in</a>' : '') + '</div>' +
        '<div class="sp-small">' + esc([p.last + (when ? ' ' + when : ''), p.next].filter(Boolean).join(' · ')) + '</div>' + (typeof _g31CardLine === 'function' ? _g31CardLine(id, p) : '') + '</div>' +
        '<span class="sp-chip ' + (SP_STAGE_CHIP[p.stage] || '') + '">' + esc(lab) + '</span>' +
        (acts ? '<div class="sd-pa">' + acts + '</div>' : '') + '</li>';
    }).join('');
    var live = ps.filter(function (p) { return !p.removed && p.stage !== 'deal' && p.stage !== 'meeting'; });
    var accIdG = (ps.find(function (p) { return p.account_id; }) || {}).account_id || '';
    var rmCo = owner && live.length && keys.length > 1 ? '<button class="g34-rm" type="button" aria-label="Remove ' + esc(k) + ' from this SAMpaign" onclick="g34Remove(\'' + esc(id) + '\',{contact_ids:' + esc(JSON.stringify(live.map(function (p) { return p.id; }))) + (accIdG ? ',account_ids:[\'' + esc(accIdG) + '\']' : '') + '},\'' + esc(String(k).replace(/'/g, '')) + '\',' + live.length + ')">Remove company</button>' : '';
    return '<section class="sd-co"><header><div><b>' + esc(k) + '</b>' + (dealP ? ' <span class="sp-chip live">Deal' + (dealP.deal_value_usd ? ' ' + esc(scMoney(dealP.deal_value_usd)) : '') + '</span>' : '') + '<div class="sp-small">' + scPlural(ps.length, 'person', 'people') + ' · ' + esc(sumTxt) + '</div></div>' + rmCo + '</header>' +
      '<ul>' + rows + '</ul>' + (ps.length > lim ? '<button class="rv-link" type="button" onclick="_spPeopleMore(\'' + esc(id) + '\',\'' + esc(k.replace(/'/g, '')) + '\')">Show ' + (ps.length - lim) + ' more at ' + esc(k) + '</button>' : '') + '</section>';
  }).join('');
  host.innerHTML = '<section class="sp-card sp-pad sd-journey">' +
      '<div class="sd-sh"><div class="sp-lbl">Where people are · ' + scPlural(total, 'person', 'people') + '</div>' + (reached ? '<span class="sp-small">' + conv + '% of people reached wrote back</span>' : '') + '</div>' + funnel +
      '<div class="sd-pbar"><input class="sp-search" placeholder="Find a person or company" value="' + esc(f.q || '') + '" aria-label="Find a person or company" oninput="var F=window._spPeopleF[\'' + esc(id) + '\'];F.q=this.value;clearTimeout(F._t);F._t=setTimeout(function(){_spPaintPeople(\'' + esc(id) + '\');var i=document.querySelector(\'#spPeople_' + esc(id) + ' .sp-search\');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)"/>' +
        (f.stage ? '<button class="rv-link" type="button" onclick="_spPeopleStage(\'' + esc(id) + '\',\'' + esc(f.stage) + '\')">Show everyone</button>' : '') + '</div>' + tools +
      '<div id="sampaignAddRows_' + esc(id) + '"></div></section>' +
    (people.length ? '<div class="sd-cos">' + list + '</div>' + (shownGroups < keys.length ? '<div class="sp-small" style="margin:10px 2px">Search to find the rest.</div>' : '')
      : '<div class="sp-card sp-empty">' + (total ? 'Nobody here yet.' : 'No people in this SAMpaign yet. ' + (owner ? 'Scout contacts, upload a CSV or add people.' : '')) + '</div>');
}
function _spAgo(iso) { var d = Math.floor((Date.now() - Date.parse(iso)) / 86400000); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 14 ? d + ' days ago' : 'on ' + _spDate(iso); }
async function _spMoveToDeal(id, contactId, btn, create) {
  if (btn) { btn.disabled = true; btn.textContent = 'Moving…'; }
  var d = await _sampEdge('move_sampaign_contact_to_deal', { contact_id: contactId, create_account: !!create });
  if (!d.ok && d.needs_account) {
    if (btn) { btn.disabled = false; btn.textContent = 'Move to deal'; }
    var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'spNeedAcct';
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Track this company"><h3>Track ' + esc(d.company) + ' as an account?</h3><p class="sp-muted" style="margin:6px 0 0;font-size:13.5px;line-height:1.55">' + esc(d.company) + (d.domain ? ' (' + esc(d.domain) + ')' : '') + ' is not one of your accounts yet. Add it, with this person on it, and start the deal there.</p>' +
      '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'spNeedAcct\').remove()">Not now</button><button class="g-btn sp-gold" type="button" id="spNeedAcctGo">Add the account</button></div></div>';
    document.body.appendChild(m);
    document.getElementById('spNeedAcctGo').onclick = function () { m.remove(); _spMoveToDeal(id, contactId, null, true); };
    return;
  }
  if (!d.ok) { if (btn) { btn.disabled = false; btn.textContent = 'Move to deal'; } showToast(d.error || 'Could not move them'); return; }
  try { scInvalidate(); } catch (e) {}
  if (d.is_deal) showToast((d.already ? 'Already on ' : 'Added to the ') + d.account_name + ' deal.');
  else {
    showToast('Added to ' + d.account_name + '. Set the deal value to start the deal.');
    try { openDealValueForm(d.account_id, d.account_name); } catch (e) {}
  }
  _spRenderPeople(id);
}
async function _spOpenDeal(accountId, name) {
  try { await scFetch(_sc.view.dealsScope || 'mine'); } catch (e) {}
  if (scFind(accountId)) { scOpen(accountId); return; }
  try { await scFetch('team'); } catch (e) {}
  if (scFind(accountId)) scOpen(accountId); else openDealValueForm(accountId, name);
}
// Anything that reloads the roster (CSV, scouting, enrichment, adding
// people) refreshes the journey when the journey is what is on screen.
async function _loadSampaignContactsInto(campaignId) {
  if (_spPeopleHost(campaignId)) { clearTimeout(window['_spPR' + campaignId]); window['_spPR' + campaignId] = setTimeout(function () { _spRenderPeople(campaignId); }, 300); _sampPrimeContacts(campaignId); return; }
  return _loadSampaignContactsIntoOld(campaignId);
}
function _renderSampaignContacts(campaignId) {
  if (_spPeopleHost(campaignId)) { clearTimeout(window['_spPR' + campaignId]); window['_spPR' + campaignId] = setTimeout(function () { _spRenderPeople(campaignId); }, 300); return; }
  return _renderSampaignContactsOld(campaignId);
}

// ── New SAMpaign: a list of companies takes a region ───────────────────────
function _spWizParseCompanies(text) {
  var W = window._sampW || {};
  var listRegion = String(W.listRegion || '').trim();
  return String(text || '').split(/\r?\n/).map(function (line) {
    var p = line.split(/[,\t;]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!p.length) return null;
    var dom = p.find(function (x) { return /\.[a-z]{2,}$/i.test(x) && !/\s/.test(x); }) || '';
    var rest = p.filter(function (x) { return x !== dom; });
    var name = rest[0] || dom.replace(/\..*$/, '');
    var region = rest[1] || listRegion;
    return { name: name, domain: dom, region: region || null };
  }).filter(Boolean);
}

// ══ Drop D.1 (2026-10-07): a person's week, for managers ═══════════════════
// From SAM's Team pulse, one click on a person opens their week: what needs
// them, and intent vs reality (what they planned with customers against what
// their mail and calendar show actually happened), with coverage one more
// click away. The old SAM tools are gone from Deals.
function sdPerson(uid) {
  var d = _sc.data[_sc.view.samScope] || _sc.data.team || {};
  var o = (d.by_owner || []).find(function (x) { return x.user_id === uid; }); if (!o) return;
  scCloseSheet();
  var mine = (d.accounts || []).filter(function (a) { return a.owner === uid || a.sdr === uid; });
  var need = mine.filter(function (a) { return a.needs && a.needs.length; }).slice(0, 6);
  var mbTxt = { ok: 'Mailbox working', none: 'No mailbox connected', reconnect: 'Mailbox needs reconnecting', stale: 'Mailbox not checked lately' };
  var first = String(o.name || 'They').split(' ')[0];
  var ivrId = 'sdIvr_' + uid, covId = 'sdCov_' + uid;
  var el = document.createElement('div');
  el.id = 'scSheet'; el.className = 'rv-sheet-wrap';
  el.innerHTML = '<div class="rv-sheet sd-psheet" role="dialog" aria-modal="true" aria-labelledby="sdPersonTitle">' +
    '<div class="rv-sheet-head"><div><div class="sp-lbl">Their week</div><h2 id="sdPersonTitle">' + esc(o.name || 'Someone') + '</h2>' +
      '<div class="sp-chips"><span class="sp-chip ' + (o.mailbox === 'ok' ? 'live' : 'risk') + '"><i></i>' + esc(mbTxt[o.mailbox] || '') + '</span>' + (o.is_active === false ? '<span class="sp-chip">Deactivated</span>' : '') + '</div></div>' +
      '<button class="rv-x" onclick="scCloseSheet()" aria-label="Close">×</button></div>' +
    '<div class="rv-sheet-kpis sd-pk"><div><span class="sp-lbl">Need them</span><b>' + (o.needs || 0) + '</b></div><div><span class="sp-lbl">Replies waiting</span><b>' + (o.replies_waiting || 0) + '</b></div><div><span class="sp-lbl">Quiet deals</span><b>' + (o.quiet || 0) + '</b></div><div><span class="sp-lbl">Pipeline</span><b>' + esc(scMoney0(o.value_usd)) + '</b></div></div>' +
    '<div class="sp-lbl" style="margin-top:18px">Intent vs reality</div>' +
    '<p class="rv-p">What ' + esc(first) + ' planned with customers, against what ' + (o.mailbox === 'ok' ? 'their mail and calendar show actually happened' : 'SAM can check') + '.</p>' +
    '<div id="' + esc(ivrId) + '" class="sd-ivr"></div>' +
    (need.length ? '<div class="sp-lbl" style="margin-top:18px">Needs ' + esc(first) + ' today</div><ul class="rv-needlist">' + need.map(function (a) {
      var n = a.needs[0];
      return '<li><span class="sp-ni ' + (n.tone === 'good' ? 'g' : n.tone === 'bad' ? 'r' : 'a') + '">' + scIco(n.key) + '</span><span><button class="rv-plain" onclick="scOpen(\'' + esc(a.id) + '\')"><b>' + esc(a.name) + '</b></button> ' + esc(n.text) + '</span></li>';
    }).join('') + '</ul>' : '') +
    '<details class="sd-cov"><summary>Account coverage: which of their accounts they reached</summary><div id="' + esc(covId) + '"></div></details>' +
    '<div class="rv-sheet-acts"><button class="g-btn sp-gold" onclick="scCloseSheet();sdGoDeals(\'list\',\'' + esc(uid) + '\')">' + esc(first) + '’s deals</button><button class="g-btn" onclick="scCloseSheet()">Close</button></div></div>';
  el.addEventListener('click', function (e) { if (e.target === el) scCloseSheet(); });
  document.body.appendChild(el);
  document.addEventListener('keydown', scSheetKey);
  var det = el.querySelector('.sd-cov');
  det.addEventListener('toggle', function () { if (det.open && !det._ran) { det._ran = 1; try { runCoverageCheck(uid, o.email || '', covId); } catch (e) {} } });
  try { if (typeof _ivrPeriod !== 'undefined' && !_ivrPeriod[ivrId]) _ivrPeriod[ivrId] = 'wtd'; runIntentVsReality(uid, ivrId); } catch (e) { var x = document.getElementById(ivrId); if (x) x.innerHTML = '<div class="sp-small">Could not check: ' + esc(e.message) + '</div>'; }
  setTimeout(function () { var b = el.querySelector('.rv-x'); if (b) b.focus(); }, 30);
}

// The old SAM tools are retired: scanning and call sync run on their own.
// Intent vs reality and coverage now live on each person, from Team pulse.
function scWireMore() {
  var deals = document.getElementById('panel-pipeline');
  var anchor = document.getElementById('scDealsMore');
  var bm = document.getElementById('scBoardMore');
  if (bm && deals && anchor && !bm._sdMoved) {
    anchor.parentElement.insertBefore(bm, anchor.nextSibling); bm._sdMoved = 1;
    var s = bm.querySelector('summary'); if (s) s.innerHTML = '<span>Team activity</span><small>tasks, wins and issues by person</small>';
  }
  if (bm) bm.style.display = sdSenior() ? '' : 'none';
  // Ask SAM stays on SAM; the rest of the old SAM block is parked, unseen.
  var panel = document.getElementById('panel-signals');
  ['samChatOutput', 'samChatBar', 'samChatFab'].forEach(function (id) { var x = document.getElementById(id); if (panel && x && x.closest('details')) panel.appendChild(x); });
  var old = document.getElementById('scSamMore');
  if (old) { old.style.display = 'none'; old.open = false; }
  var bind = function (id, fn) { var d = document.getElementById(id); if (d && !d._scBound) { d._scBound = 1; d.addEventListener('toggle', function () { if (d.open) { try { fn(); } catch (e) {} } }); } };
  bind('scDealsMore', function () { _scOldPipeline(); });
  bind('scBoardMore', function () { loadExecDashboard(); });
}

// ══ Drop E (2026-10-08): SAMpaign tasks on Today ═══════════════════════════
// What each SAMpaign needs from the rep today, on email and LinkedIn, and
// whether the numbers add up (who should have had a first email, an invite or
// a message by now and has not). The same list the LinkedIn panel shows and
// the morning push names, from get_sampaign_tasks.
window._tds = window._tds || { data: null, at: 0, open: {}, touched: false };
var LI_EXT_LATEST = '1.14.0';
function _liVerLt(a, b) { var x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number); for (var i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); } return false; }
var TDS_ICON = {
  email: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M8 10.5V16M8 7.8v.1M11.5 16v-3.2a2.3 2.3 0 014.6 0V16M11.5 10.5V16"/></svg>',
  all: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z"/></svg>',
  done: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
};
function _tdsPl(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
async function tdSampLoad(force) {
  var el = document.getElementById('todaySamp');
  if (!el || typeof currentUser === 'undefined' || !currentUser || !currentUser.token) return;
  try { if (typeof viewDate !== 'undefined' && viewDate && viewDate !== todayKey()) { el.innerHTML = ''; return; } } catch (_e) {}
  if (!force && window._tds.data && Date.now() - window._tds.at < 45000) { tdSampRender(); return; }
  window._tds.at = Date.now();
  if (!window._tds.data) el.innerHTML = '<div class="g-card tds" aria-busy="true"><div class="sp-lbl">Your SAMpaigns today</div><div class="tds-sk"></div><div class="tds-sk" style="width:60%"></div></div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'get_sampaign_tasks' }) });
    var d = await r.json();
    if (d && d.ok) window._tds.data = d;
  } catch (_e) { /* keep what we had */ }
  if (!window._tds.data) { el.innerHTML = ''; return; }
  tdSampRender();
}
function tdsGo(kind, a, b) {
  if (kind === 'sampaign') { try { switchTab('sampaign'); } catch (_e) {} setTimeout(function () { openSampaignDetail(a, b || 'overview'); }, 350); return; }
  if (kind === 'linkedin') { window.open(a || 'https://www.linkedin.com/feed/', '_blank', 'noopener'); return; }
  if (kind === 'app') { try { switchTab(a || 'you'); } catch (_e) {} }
}
function tdsToggle(id) {
  var d = window._tds;
  if (!d.touched) { d.touched = true; document.querySelectorAll('#todaySamp .tds-c.open').forEach(function (x) { d.open[x.dataset.id] = true; }); }
  d.open[id] = !d.open[id];
  tdSampRender();
}
function _tdsAct(t, c) {
  var a = t.act || {}, L = { sequence: 'Open sequence', replies: 'Open replies', people: 'Open people', overview: 'Open' };
  if (a.type === 'sampaign') return '<button class="tds-a" type="button" onclick="tdsGo(\'sampaign\',\'' + esc(c.id) + '\',\'' + esc(a.tab || 'overview') + '\')">' + (L[a.tab] || 'Open') + '</button>';
  if (a.type === 'plugin') return '<button class="tds-a" type="button" title="Samora\'s panel opens from the S on any LinkedIn page" onclick="tdsGo(\'linkedin\')">Open LinkedIn</button>';
  if (a.type === 'linkedin') return '<button class="tds-a" type="button" onclick="tdsGo(\'linkedin\',\'' + esc(a.url || '') + '\')">Open</button>';
  if (a.type === 'app') return '<button class="tds-a" type="button" onclick="tdsGo(\'app\',\'' + esc(a.tab || 'you') + '\')">Open</button>';
  return '';
}
function _tdsTask(t, c) {
  var ic = t.tone === 'done' ? TDS_ICON.done : (TDS_ICON[t.channel] || TDS_ICON.all);
  var bar = t.total ? '<span class="tds-bar" aria-hidden="true"><i style="width:' + Math.round((t.done || 0) / t.total * 100) + '%"></i></span>' : '';
  return '<li class="tds-t ' + esc(t.tone) + '"><span class="tds-ic ' + esc(t.channel) + '">' + ic + '</span><span class="tds-tx"><span>' + esc(t.text) + '</span>' + bar + '</span>' + _tdsAct(t, c) + '</li>';
}
function _tdsCheck(k) {
  var pct = function (n) { return k.expected ? Math.round(n / k.expected * 100) : 0; };
  var tag = k.missing ? '<span class="sp-chip risk">' + k.missing + ' pending</span>' : k.queued ? '<span class="sp-chip li">' + k.queued + ' queued</span>' : '<span class="sp-chip live">All done</span>';
  return '<div class="tds-k"><div class="tds-kh"><span>' + esc(k.label) + '</span><b>' + k.done + ' of ' + k.expected + '</b>' + tag + '</div><div class="tds-kb" aria-hidden="true"><i style="width:' + pct(k.done) + '%"></i><i class="q" style="width:' + pct(k.queued) + '%"></i></div>' + (k.missing && k.who ? '<div class="sp-small">Pending: ' + esc(k.who) + '</div>' : '') + '</div>';
}
function tdSampRender() {
  var el = document.getElementById('todaySamp'), d = window._tds.data;
  if (!el || !d) return;
  var cs = d.campaigns || [];
  if (!cs.length) { el.innerHTML = ''; return; }
  var sm = d.summary || {}, li = d.linkedin;
  var chips = (sm.risk ? '<span class="sp-chip risk"><i></i>' + _tdsPl(sm.risk, 'thing') + ' at risk</span>' : '') +
    (sm.do ? '<span class="sp-chip warn"><i></i>' + _tdsPl(sm.do, 'task') + ' for you</span>' : '') +
    (sm.wait ? '<span class="sp-chip">' + sm.wait + ' running on their own</span>' : '') +
    (!sm.do && !sm.risk ? '<span class="sp-chip live"><i></i>All clear</span>' : '');
  var liLine = '';
  if (li) {
    var pl = li.plugin;
    liLine = '<div class="tds-li"><span class="tds-ic linkedin">' + TDS_ICON.linkedin + '</span><span>LinkedIn today: <b>' + (li.today.invites || 0) + ' of ' + li.limits.invites + '</b> invites and <b>' + (li.today.messages || 0) + '</b> messages sent' + (li.ready ? ', <b>' + li.ready + '</b> ready' : '') + '. ' +
      (pl ? (pl.online ? 'Samora in Chrome is on.' : 'Samora in Chrome was last on ' + esc(_spAgo(pl.last_seen_at)) + '; LinkedIn steps go while Chrome is open.') : 'Add Samora for LinkedIn in Chrome to run these.') +
      (pl && pl.version && _liVerLt(pl.version, LI_EXT_LATEST) ? ' <b>Update the plugin to ' + LI_EXT_LATEST + '</b> (You, LinkedIn plugin) so messages send on LinkedIn\u2019s new pages.' : '') +
      (li.synced_at ? ' Accepts and replies checked ' + esc(_spAgo(li.synced_at)) + '.' : '') + '</span></div>';
  }
  var list = cs.map(function (c, i) {
    var open = window._tds.touched ? !!window._tds.open[c.id] : ((c.risk || c.todo) && i < 3);
    var cnt = (c.risk ? '<span class="sp-chip risk">' + c.risk + ' at risk</span>' : '') + (c.todo ? '<span class="sp-chip warn">' + _tdsPl(c.todo, 'task') + '</span>' : '') + (!c.risk && !c.todo ? '<span class="sp-chip live">Clear</span>' : '');
    var ch = (c.email ? '<span class="tds-ch">' + TDS_ICON.email + '</span>' : '') + (c.linkedin ? '<span class="tds-ch li">' + TDS_ICON.linkedin + '</span>' : '');
    var miss = (c.checks || []).some(function (k) { return k.missing; });
    var checks = (c.checks || []).length ? '<details class="tds-adds"' + (miss ? ' open' : '') + '><summary>Does it add up? ' + (miss ? '<span class="sp-chip risk">pending</span>' : '<span class="sp-chip live">yes</span>') + '</summary>' + c.checks.map(_tdsCheck).join('') + '</details>' : '';
    return '<div class="tds-c' + (open ? ' open' : '') + '" data-id="' + esc(c.id) + '">' +
      '<button class="tds-ch-h" type="button" aria-expanded="' + (open ? 'true' : 'false') + '" onclick="tdsToggle(\'' + esc(c.id) + '\')"><span class="tds-n">' + esc(c.name) + '</span><span class="tds-chs">' + ch + '</span><span class="tds-cnt">' + cnt + '</span><span class="tds-chev">' + TDS_ICON.chev + '</span></button>' +
      (open ? '<ul class="tds-l">' + (c.tasks || []).map(function (t) { return _tdsTask(t, c); }).join('') + '</ul>' + checks : '') + '</div>';
  }).join('');
  el.innerHTML = '<section class="g-card tds" aria-labelledby="tdsTitle"><div class="tds-h"><div><div class="sp-lbl" id="tdsTitle">Your SAMpaigns today</div><div class="tds-sub">Email and LinkedIn, per SAMpaign. SAM checks the numbers add up so nothing is left pending.</div></div><div class="tds-chips">' + chips + '<button class="tds-a" type="button" onclick="tdSampLoad(true)" aria-label="Refresh SAMpaign tasks">Refresh</button></div></div>' + liLine + '<div class="tds-cs">' + list + '</div></section>';
}
(function () {
  if (typeof renderToday !== 'function' || renderToday._tds) return;
  var orig = renderToday;
  renderToday = function () { var r = orig.apply(this, arguments); try { tdSampLoad(); } catch (_e) {} return r; };
  renderToday._tds = true;
})();

// ════════════════════════════════════════════════════════════════════════════
// Drop G (2026-10-08): emails that read well, your signature, and a launch
// plan that tells you the next click.
// ════════════════════════════════════════════════════════════════════════════

// ── Drafts saved as plain text show as paragraphs, not one block ───────────
function _rtPlainToHtml(s) {
  s = String(s == null ? '' : s);
  if (/<\s*(br|p|b|strong|i|em|u|a|ul|ol|li|div|span)\b[^>]*>/i.test(s)) return s;
  var e = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '');
  return e.split(/\n\s*\n/).map(function (p) { return p.trim().replace(/\n/g, '<br>'); }).filter(Boolean).join('<br><br>');
}
function _rtEditor(id, html, fontSize) {
  var fs = fontSize || 13;
  return '<div class="g18-rtbar">' +
      _rtBtn(id, 'bold', 'B', 'Bold (Ctrl/Cmd+B)', 'font-weight:800') +
      _rtBtn(id, 'italic', 'I', 'Italic (Ctrl/Cmd+I)', 'font-style:italic') +
      _rtBtn(id, 'underline', 'U', 'Underline (Ctrl/Cmd+U)', 'text-decoration:underline') +
      _rtBtn(id, 'insertUnorderedList', '&#8226;&#8202;&#8212;', 'Bullet list', '') +
      _rtBtn(id, 'createLink', 'Link', 'Add a link to the selected words', '') +
      _rtBtn(id, 'removeFormat', 'Clear', 'Remove formatting', '') +
      '<span class="g18-rthint">This is how it will arrive</span>' +
    '</div>' +
    '<div id="draftBody_' + esc(id) + '" class="g18-rt" contenteditable="true" onpaste="_rtPaste(event)" onclick="event.stopPropagation()" style="font-size:' + fs + 'px">' +
      sanitizeEmailHtml(_rtPlainToHtml(html || '')) +
    '</div>';
}

// ── Signature ───────────────────────────────────────────────────────────────
window._sig = window._sig || null;
function _sigNameHint() { try { return (currentUser && currentUser.user_metadata && currentUser.user_metadata.full_name) || (profile && (profile.full_name || profile.name)) || ''; } catch (e) { return ''; } }
async function sigLoad(force) {
  if (window._sig && !force) return window._sig;
  var d = await _sampEdge('get_email_signature', { name_hint: _sigNameHint() });
  if (d.ok) window._sig = d;
  return window._sig || { signature: { html: '', on: false, followups: false }, is_default: true, default_html: '' };
}
function _sigPreview(html) { return '<div class="g18-sigprev">' + sanitizeEmailHtml(html || '') + '</div>'; }
async function sigOpenEditor(after) {
  var s = await sigLoad(true);
  var sg = s.signature || {};
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'sigModal';
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  m.innerHTML = '<div class="sp-mcard g18-sigcard" role="dialog" aria-modal="true" aria-label="Email signature"><h3>Your email signature</h3>' +
    '<p class="sp-muted" style="margin:4px 0 14px">Added under the sign-off of every SAMpaign email, whoever writes it: SAM, Claude or you. Edit it like an email.</p>' +
    _rtEditor('sig', sg.html || s.default_html || '', 13) +
    '<label class="sp-check"><input type="checkbox" id="sigOn"' + (sg.on !== false ? ' checked' : '') + '><span><b>Add it to my SAMpaign emails</b></span></label>' +
    '<label class="sp-check" style="margin-top:8px"><input type="checkbox" id="sigFups"' + (sg.followups !== false ? ' checked' : '') + '><span>Also on follow-ups <span class="sp-small">(they go in the same thread)</span></span></label>' +
    '<p class="sp-small" style="margin-top:12px">' + (s.is_default ? 'This is the default, built from your name and company. Add your title or phone number and save.' : 'Drafts and queued emails that carry your old signature get the new one when you save.') + '</p>' +
    '<div class="sp-foot"><button class="g-btn sp-ghost" type="button" id="sigReset"' + (s.is_default ? ' disabled' : '') + '>Use the default</button><span class="sp-acts"><button class="g-btn" type="button" onclick="document.getElementById(\'sigModal\').remove()">Cancel</button><button class="g-btn sp-gold" type="button" id="sigSave">Save</button></span></div></div>';
  document.body.appendChild(m);
  var done = function (d) {
    if (!d.ok) { showToast(d.error || 'Could not save the signature'); return; }
    window._sig = d; m.remove();
    showToast('Signature saved' + (d.updated_emails ? '. Updated in ' + _spPlural(d.updated_emails, 'email') : ''));
    try { _sigRenderYou(); } catch (e) {}
    if (typeof after === 'function') after(d);
  };
  document.getElementById('sigSave').onclick = async function () {
    this.disabled = true;
    var html = rtValue('sig');
    var d = await _sampEdge('save_email_signature', { html: html, on: document.getElementById('sigOn').checked, followups: document.getElementById('sigFups').checked, name_hint: _sigNameHint() });
    this.disabled = false; done(d);
  };
  document.getElementById('sigReset').onclick = async function () {
    this.disabled = true;
    var d = await _sampEdge('save_email_signature', { reset: true, on: document.getElementById('sigOn').checked, followups: document.getElementById('sigFups').checked, name_hint: _sigNameHint() });
    done(d);
  };
}
async function _sigRenderYou() {
  var box = document.getElementById('youSigBody'), chip = document.getElementById('youSigChip');
  if (!box && !chip) return;
  var s = await sigLoad(false), sg = s.signature || {};
  if (chip) chip.textContent = sg.on === false ? 'Off' : s.is_default ? 'Default' : 'On';
  if (box) box.innerHTML = '<div class="admin-card" style="margin-bottom:0"><div class="sp-small" style="margin-bottom:10px">Added under the sign-off of every SAMpaign email. ' + (sg.on === false ? '<b>Off right now.</b>' : (sg.followups === false ? 'First emails only.' : 'First emails and follow-ups.')) + '</div>' +
    _sigPreview(sg.html || s.default_html) +
    '<button class="g-btn sp-sm" type="button" style="margin-top:12px" onclick="sigOpenEditor()">Edit signature</button></div>';
}
function _sigLine(launch) {
  var s = window._sig; if (!s) return '';
  var sg = s.signature || {};
  var on = sg.on !== false && (Number(launch || 1) === 1 || sg.followups !== false);
  var who = String((sg.html || '').replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '')).split(' · ')[0];
  return '<div class="g18-sigline">' + (on ? '<span>Signed as <b>' + esc(who || 'you') + '</b>' + (s.is_default ? ' <span class="sp-small">(default)</span>' : '') + '</span>' : '<span>No signature on these</span>') +
    '<button type="button" class="g18-link" onclick="sigOpenEditor(function(){ if (window._sampOpenId) loadSampaignSendQueue(window._sampOpenId); })">' + (on ? 'Edit signature' : 'Add a signature') + '</button></div>';
}

// ── Draft review: what SAM checked, per draft ──────────────────────────────
var G18_CHECK_OK = {
  paragraphs: function (st) { return st.paragraphs >= 3 && st.longest <= 80 ? _spPlural(st.paragraphs, 'short paragraph') : null; },
  bold: function (st) { return st.bold >= 2 && st.bold <= 4 ? st.bold + ' key points in bold' : null; },
  words: function (st, launch) { var max = launch > 1 ? 110 : 170; return st.words && st.words <= max ? st.words + ' words' : null; },
  signed: function (st) { return st.signed ? 'Signed' : null; }
};
function _g18Checks(x) {
  var st = x.stats || {}, launch = x.launch || 1, issues = x.checks || [];
  var good = Object.keys(G18_CHECK_OK).map(function (k) { return G18_CHECK_OK[k](st, launch); }).filter(Boolean);
  return '<div class="g18-checks">' + good.map(function (g) { return '<span class="g18-ok">' + esc(g) + '</span>'; }).join('') +
    issues.map(function (i) { return '<span class="g18-bad ' + (i.severity === 'fix' ? 'fix' : '') + '" title="' + esc(i.detail || '') + '">' + esc(i.detail || i.code) + '</span>'; }).join('') + '</div>';
}
function _renderSampaignDrafts(campaignId, drafts) {
  if (!drafts.length) return '';
  var launch = drafts[0].launch || window._sampLaunch || 1;
  var toLook = drafts.filter(function (x) { return (x.checks || []).length; });
  var fixable = drafts.filter(function (x) { return (x.checks || []).some(function (i) { return i.severity === 'fix'; }) && !x.edited_by_human; });
  var anyPersonalised = drafts.some(function (d) { return d.personalised; });
  var label = anyPersonalised ? 'personalised draft' : 'draft';
  if (!window._sig) sigLoad(false).then(function () { var el = document.getElementById('g18Sig_' + campaignId); if (el) el.innerHTML = _sigLine(launch); });
  return '<div class="g18-drafts">' +
    '<div class="g18-dh"><div><div class="g18-dt">' + drafts.length + ' ' + label + (drafts.length !== 1 ? 's' : '') + ' to review</div>' +
      '<div class="sp-small">' + (toLook.length ? 'SAM checked every one: <b>' + (drafts.length - toLook.length) + ' ready</b>, ' + toLook.length + ' worth a look.' : 'SAM checked every one. All ready.') + ' Nothing sends until you schedule.</div></div>' +
      '<div class="g18-da">' + (fixable.length ? '<button class="g-btn sp-sm" type="button" onclick="g18Rewrite(\'' + esc(campaignId) + '\',' + launch + ',' + JSON.stringify(fixable.map(function (x) { return x.contact_id; })).replace(/"/g, '&quot;') + ')">' + SP_ICON.spark + ' Fix ' + fixable.length + ' with SAM</button>' : '') +
      '<button class="g-btn sp-sm" type="button" onclick="g34RewriteAll(\'' + esc(campaignId) + '\')">' + SP_ICON.spark + ' Rewrite all with SAM</button>' +
      '<button class="g-btn sp-sm sp-gold" type="button" onclick="planSampaignDrafts(\'' + esc(campaignId) + '\',null,' + launch + ')">Schedule ' + drafts.length + '</button></div></div>' +
    '<div id="g18Sig_' + esc(campaignId) + '">' + _sigLine(launch) + '</div>' +
    drafts.slice(0, 60).map(function (x) {
      var n = (x.checks || []).length;
      var chip = x.edited_by_human ? '<span class="sp-chip live">Edited by you</span>' : n ? '<span class="sp-chip warn">' + n + ' to look at</span>' : '<span class="sp-chip live">Ready</span>';
      return '<div class="g18-row" id="g18row_' + esc(x.id) + '">' +
        '<button type="button" class="g18-rh" onclick="_toggleDraft(\'' + esc(x.id) + '\')"><span class="sp-av lg">' + esc(_spIni(x.name || x.email)) + '</span>' +
          '<span class="g18-who"><b>' + esc(x.name || x.email || 'Someone') + '</b><small>' + esc([x.title, x.company].filter(Boolean).join(' · ')) + '</small></span>' +
          '<span class="g18-subj">' + esc(x.subject || '') + '</span>' + chip + '<span class="g18-chev" id="chev_' + esc(x.id) + '" aria-hidden="true">' + SP_ICON.arrow + '</span></button>' +
        '<div id="draft_' + esc(x.id) + '" class="g18-open" style="display:none">' +
          '<label class="g18-lab">Subject<input id="draftSubj_' + esc(x.id) + '" value="' + esc(x.subject || '') + '"></label>' +
          _rtEditor(x.id, x.body || '', 13.5) +
          _g18Checks(x) +
          '<div class="g18-acts"><button class="g-btn sp-sm sp-gold" type="button" onclick="saveSampaignDraftEdit(\'' + esc(campaignId) + '\',\'' + esc(x.id) + '\')">Save</button>' +
            '<button class="g-btn sp-sm" type="button" onclick="g18RewriteOne(\'' + esc(campaignId) + '\',' + (x.launch || 1) + ',\'' + esc(x.contact_id) + '\',\'' + esc(x.id) + '\')">' + SP_ICON.spark + ' Rewrite with SAM</button>' +
            '<button class="g-btn sp-sm sp-ghost sp-r" type="button" onclick="cancelSampaignSends(\'' + esc(campaignId) + '\',\'' + esc(x.id) + '\')">Discard</button></div>' +
          '<div id="g18rw_' + esc(x.id) + '"></div>' +
        '</div></div>';
    }).join('') + (drafts.length > 60 ? '<div class="sp-small" style="padding:10px 4px">Showing 60 of ' + drafts.length + '.</div>' : '') +
  '</div>';
}
function _toggleDraft(id) {
  var el = document.getElementById('draft_' + id); if (!el) return;
  var open = el.style.display === 'none';
  el.style.display = open ? 'block' : 'none';
  var row = document.getElementById('g18row_' + id); if (row) row.classList.toggle('on', open);
}
function g18RewriteOne(campaignId, launch, contactId, sendId) {
  var box = document.getElementById('g18rw_' + sendId); if (!box) return;
  box.innerHTML = '<div class="g18-rw"><label class="g18-lab">What should change? <small>optional</small><input id="g18rwIn_' + esc(sendId) + '" placeholder="Shorter, warmer, lead with the case study result…"></label>' +
    '<div class="g18-acts"><button class="g-btn sp-sm sp-gold" type="button" id="g18rwGo_' + esc(sendId) + '">Rewrite</button><button class="g-btn sp-sm sp-ghost" type="button" onclick="this.closest(\'.g18-rw\').remove()">Cancel</button></div></div>';
  var inp = document.getElementById('g18rwIn_' + sendId); if (inp) inp.focus();
  if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('g18rwGo_' + sendId).click(); });
  document.getElementById('g18rwGo_' + sendId).onclick = function () { g18Rewrite(campaignId, launch, [contactId], (inp && inp.value) || '', sendId); };
}
async function g18Rewrite(campaignId, launch, contactIds, instruction, reopenId) {
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'g18RwModal';
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Rewriting"><h3>SAM is rewriting ' + _spPlural(contactIds.length, 'draft') + '</h3><div class="sp-small" id="g18RwMsg">Writing, then checking each one…</div><div class="sp-progress"><span style="width:30%"></span></div></div>';
  document.body.appendChild(m);
  var done = 0, err = null;
  try {
    for (var i = 0; i < contactIds.length; i += 6) {
      var d = await _sampEdge('write_sampaign_drafts', { campaign_id: campaignId, launch: launch, replace: true, contact_ids: contactIds.slice(i, i + 6), instruction: instruction || '', sender_name: _sigNameHint().split(' ')[0] || '', sender_full_name: _sigNameHint() });
      if (!d.ok) { err = d.error || 'SAM could not rewrite these'; break; }
      done += d.written || 0;
    }
  } catch (e) { err = e.message; }
  m.remove();
  showToast(err ? err : done ? 'Rewrote ' + _spPlural(done, 'draft') + '. Have a look.' : 'Nothing to rewrite: only drafts can be rewritten.');
  await loadSampaignSendQueue(campaignId);
  // Drop S: the draft stays where it was, open, so the change is in view.
  if (reopenId) { var el = document.getElementById('draft_' + reopenId); if (el && el.style.display === 'none') _toggleDraft(reopenId); var row = document.getElementById('g18row_' + reopenId); if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}

// ── Launch plan: the next click, always visible ─────────────────────────────
function _g18Hidden(id) { try { return localStorage.getItem('sp-guide-hide-' + id) === '1'; } catch (e) { return false; } }
function g18HideGuide(id, on) { try { localStorage.setItem('sp-guide-hide-' + id, on ? '1' : '0'); } catch (e) {} _spGuideRender(id); }
function _spGuideSteps(id, o) {
  var c = o.counts || {}, su = o.setup || {}, w1 = (o.waves || [])[0] || {};
  var camp = o.campaign || {}, li = (o.channels || {}).linkedin || {};
  var where = camp.scope === 'list' ? 'the companies in this list' : (camp.name || 'this company');
  var withEmail = su.with_email != null ? su.with_email : Math.max(0, (c.total || 0) - (c.no_email || 0));
  var wrote = (w1.draft || 0) + (w1.pending || 0) + (w1.sent || 0);
  var st = [];
  st.push({ key: 'people', title: 'Find the people', done: c.total > 0,
    text: c.total > 0 ? _spPlural(c.total, 'person', 'people') + ' in this SAMpaign, ' + withEmail + ' with an email.' : 'SAM finds the decision makers at ' + where + ' by job title. Or bring your own list.',
    acts: c.total > 0 ? [['ghost', 'Find more', 'g18FindPeople(\'' + id + '\')']] : [['gold', 'Find people with SAM', 'g18FindPeople(\'' + id + '\')'], ['', 'Add my own', 'setSampTab(\'' + id + '\',\'people\')']] });
  if (c.no_email > 0 || (c.total > 0 && !withEmail)) {
    var el2 = su.email_lookup || null, missing = c.no_email || 0;
    var untried = el2 ? el2.untried : missing, notFound = el2 ? el2.not_found : 0;
    var liOnNow = !!su.li_on && !(typeof _liLocked === 'function' && _liLocked());
    st.push({ key: 'emails', title: 'Get their email addresses', done: untried === 0 && missing > 0, partial: untried === 0 && notFound > 0,
      text: untried > 0
        ? (notFound ? notFound + ' looked up already. ' : '') + _spPlural(untried, 'person has', 'people have') + ' no email yet. SAM looks them up: free when Samora already has it, otherwise about one credit per person found.'
        : withEmail + ' with an email. SAM could not find one for ' + notFound + (liOnNow ? '; LinkedIn reaches them.' : '. LinkedIn can reach them, or add an email yourself.'),
      acts: untried > 0 ? [['gold', 'Find ' + _spPlural(untried, 'email'), 'g23FindEmails(\'' + id + '\')']]
        : [['ghost', 'Try again for ' + notFound, 'g23FindEmails(\'' + id + '\',true)']].concat(liOnNow || (typeof _liLocked === 'function' && _liLocked()) ? [] : [['ghost', 'Add LinkedIn', 'spLiEdit(\'' + id + '\', true)']]) });
  }
  st.push({ key: 'write', title: 'Write the first emails', done: wrote > 0 && !w1.ready,
    text: wrote > 0 && w1.ready ? wrote + ' written. ' + _spPlural(w1.ready, 'more person is', 'more people are') + ' ready for one.' : wrote > 0 ? _spPlural(wrote, 'email') + ' written, one per person.' : 'One email per person, from their role and company: short paragraphs, the key points in bold, your signature. Nothing sends yet.',
    acts: w1.ready ? [['gold', 'Write ' + _spPlural(w1.ready, 'email') + ' with SAM', 'sampWriteDrafts(\'' + id + '\',1)'], ['ghost', 'One email for all', 'sampOpenComposer(\'' + id + '\',1)']] : [], sig: true });
  if (!(typeof _liLocked === 'function' && _liLocked())) {
    if (su.li_on) st.push({ key: 'li', title: 'Write the LinkedIn notes', done: su.li_profiles > 0 && !su.li_needs_note, optional: !su.li_profiles,
      text: !su.li_profiles ? 'Nobody here has a LinkedIn profile yet. SAM adds them as it finds people.' : su.li_needs_note ? _spPlural(su.li_needs_note, 'invite needs', 'invites need') + ' a note. SAM writes a short, personal one for each, under LinkedIn’s limit.' : _spPlural(li.notes || su.li_notes || 0, 'note') + ' written. The Samora Chrome plugin sends them.',
      acts: su.li_needs_note ? [['gold', 'Write ' + _spPlural(su.li_needs_note, 'note') + ' with SAM', 'g18LiWrite(\'' + id + '\')']] : [] });
    else st.push({ key: 'li', title: 'Add LinkedIn', done: false, optional: true,
      text: 'A profile visit, an invite with a note, and a message once they accept, from the Samora Chrome plugin. A reply on either channel stops the rest.',
      acts: [['', 'Add LinkedIn', 'spLiEdit(\'' + id + '\', true)']] });
  }
  st.push({ key: 'send', title: 'Review and schedule', done: (w1.pending || 0) + (w1.sent || 0) > 0,
    text: (w1.pending || 0) + (w1.sent || 0) > 0 ? ((w1.sent ? w1.sent + ' sent' : '') + (w1.sent && w1.pending ? ', ' : '') + (w1.pending ? w1.pending + ' scheduled from ' + _spDate(w1.next_send, true) : '') + '.') : 'Read each draft, change anything you like, then pick the day. SAM spreads the sends to keep your mailbox out of spam.',
    acts: w1.draft ? [['gold', 'Review ' + _spPlural(w1.draft, 'draft'), 'setSampTab(\'' + id + '\',\'sequence\');setTimeout(function(){sampReviewWave(\'' + id + '\',1)},300)'], ['', 'Schedule', 'planSampaignDrafts(\'' + id + '\',null,1)']] : [] });
  return st;
}
function _spGuideRender(id) {
  var el = document.getElementById('sampGuide_' + id); if (!el) return;
  var o = (window._sampOv || {})[id];
  if (!o || !o.ok || !o.campaign.is_owner || o.campaign.archived || o.campaign.paused_at) { el.innerHTML = ''; return; }
  var steps = _spGuideSteps(id, o);
  var core = steps.filter(function (s) { return !s.optional; });
  var doneN = core.filter(function (s) { return s.done; }).length;
  var nowIdx = steps.findIndex(function (s) { return !s.done && !s.optional; });
  var allDone = nowIdx === -1;
  if (allDone && _g18Hidden(id)) { el.innerHTML = ''; return; }
  if (!allDone && _g18Hidden(id)) { el.innerHTML = '<button class="g18-show" type="button" onclick="g18HideGuide(\'' + esc(id) + '\', false)">' + SP_ICON.spark + ' Launch plan · ' + doneN + ' of ' + core.length + ' done · next: ' + esc(steps[nowIdx].title.toLowerCase()) + '</button>'; return; }
  if (allDone) {
    var w1 = (o.waves || [])[0] || {}, fu = (o.campaign.followup_dates || []);
    el.innerHTML = '<section class="sp-card g18-guide g18-live"><div class="g18-gh"><div><div class="sp-lbl">Launch plan</div><div class="g18-gt">You are live.</div>' +
      '<div class="sp-small">' + (w1.pending ? 'First emails go from ' + esc(_spDate(w1.next_send, true)) + '. ' : '') + (fu.length ? 'SAM writes the follow-ups for ' + fu.map(function (d) { return _spDate(d); }).join(' and ') + ' when they are due, for you to approve. ' : '') + 'It stops for anyone who replies, bounces or opts out. Replies land in the Replies tab.</div></div>' +
      '<button class="g-btn sp-sm sp-ghost" type="button" onclick="g18HideGuide(\'' + esc(id) + '\', true)">Hide</button></div></section>';
    return;
  }
  var pct = Math.round(doneN / Math.max(1, core.length) * 100);
  el.innerHTML = '<section class="sp-card g18-guide"><div class="g18-gh"><div><div class="sp-lbl">Launch plan</div><div class="g18-gt">' + (doneN ? doneN + ' of ' + core.length + ' done. ' : '') + 'Next: ' + esc(steps[nowIdx].title.toLowerCase()) + '.</div></div>' +
    '<div class="g18-gr"><div class="g18-bar"><span style="width:' + pct + '%"></span></div><button class="g18-link" type="button" onclick="g18HideGuide(\'' + esc(id) + '\', true)">Hide</button></div></div>' +
    '<ol class="g18-steps">' + steps.map(function (s, i) {
      var state = s.done ? 'done' : i === nowIdx ? 'now' : s.optional ? 'opt' : 'later';
      var acts = (state === 'now' || state === 'opt' || (state === 'done' && s.acts.length) || (state === 'later' && s.key === 'li')) ? s.acts.map(function (a) { return '<button class="g-btn sp-sm' + (a[0] === 'gold' && state === 'now' ? ' sp-gold' : a[0] === 'ghost' || state !== 'now' ? ' sp-ghost' : '') + '" type="button" onclick="' + a[2].replace(/"/g, '&quot;') + '">' + (a[0] === 'gold' && state === 'now' ? SP_ICON.spark + ' ' : '') + esc(a[1]) + '</button>'; }).join('') : '';
      return '<li class="g18-s ' + state + (s.partial ? ' part' : '') + '"><span class="g18-n">' + (s.done ? (s.partial ? '!' : '✓') : (i + 1)) + '</span><div class="g18-st"><b>' + esc(s.title) + (s.optional && !s.done ? ' <small>optional</small>' : '') + '</b><small>' + esc(s.text) + '</small>' +
        (s.sig && state === 'now' ? '<div id="g18GuideSig_' + esc(id) + '">' + _sigLine(1) + '</div>' : '') + '</div>' +
        (acts ? '<div class="g18-sa">' + acts + '</div>' : '') + '</li>';
    }).join('') + '</ol></section>';
  if (steps[nowIdx] && steps[nowIdx].sig && !window._sig) sigLoad(false).then(function () { var g = document.getElementById('g18GuideSig_' + id); if (g) g.innerHTML = _sigLine(1); });
}
async function g18FindPeople(id) {
  var o = (window._sampOv || {})[id];
  if (o && o.setup && !o.setup.targeting) { g18AskTitles(id); return; }
  await scoutSampaignContacts(id);
  await _sampLoadOverview(id);
}
// "Who should SAM find?" in one line, for someone who has never set up
// targeting. The full "Who to hunt" form is one click away.
async function g18AskTitles(id) {
  var o = (window._sampOv || {})[id] || {}, camp = o.campaign || {};
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'g18Titles';
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Who should SAM find?"><h3>Who should SAM find?</h3>' +
    '<p class="sp-muted" style="margin:4px 0 0">The job titles of the people who would say yes to this. SAM looks for them at ' + esc(camp.scope === 'list' ? 'each company in the list' : (camp.name || 'the company')) + '.</p>' +
    '<label class="sp-fld">Job titles, separated by commas<input id="g18TitlesIn" placeholder="Head of Sales, Marketing Director, CFO"></label>' +
    '<div class="sp-chips" id="g18TitleSug" style="margin-top:10px"><span class="sp-small">Suggestions…</span></div>' +
    '<p class="sp-small" style="margin-top:12px">Each person found uses one credit from your data provider. You can change this later in People, Who to hunt.</p>' +
    '<div class="sp-foot"><button class="g-btn sp-ghost" type="button" onclick="document.getElementById(\'g18Titles\').remove();openSampaignScoutProfile(\'' + esc(id) + '\')">More options</button><span class="sp-acts"><button class="g-btn" type="button" onclick="document.getElementById(\'g18Titles\').remove()">Cancel</button><button class="g-btn sp-gold" type="button" id="g18TitlesGo">Find them</button></span></div></div>';
  document.body.appendChild(m);
  var inp = document.getElementById('g18TitlesIn'); if (inp) inp.focus();
  _sampEdge('suggest_scout_targets', { campaign_id: id }).then(function (d) {
    var box = document.getElementById('g18TitleSug'); if (!box) return;
    var list = [];
    (d.suggested_titles || []).filter(function (t) { return t && !t.excluded; }).forEach(function (t) { var v = typeof t === 'string' ? t : t.title; if (v && list.indexOf(v) === -1) list.push(v); });
    if (list.length < 4) ['Founder', 'CEO', 'Head of Sales', 'Marketing Director', 'CFO', 'Head of Operations'].forEach(function (v) { if (list.indexOf(v) === -1) list.push(v); });
    box.innerHTML = list.slice(0, 8).map(function (t) { return '<button type="button" class="sp-chip g18-sug" data-t="' + esc(t) + '">+ ' + esc(t) + '</button>'; }).join('') || '';
    box.querySelectorAll('.g18-sug').forEach(function (b) { b.onclick = function () { var cur = inp.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean); var t = b.getAttribute('data-t'); if (cur.indexOf(t) === -1) cur.push(t); inp.value = cur.join(', '); b.remove(); }; });
  }).catch(function () {});
  document.getElementById('g18TitlesGo').onclick = async function () {
    var titles = inp.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!titles.length) { showToast('Add at least one job title'); return; }
    this.disabled = true;
    var d = await _sampEdge('save_org_setting', { key: 'scout_profile_sampaign_' + id, value: JSON.stringify({ jobTitles: titles, departments: [], seniorities: [], locations: [] }) });
    if (!d.ok) { this.disabled = false; showToast(d.error || 'Could not save the job titles'); return; }
    m.remove();
    if (o.setup) o.setup.targeting = true;
    await scoutSampaignContacts(id);
    await _sampLoadOverview(id);
  };
}
async function g18FindEmails(id) { return g23FindEmails(id); }
async function g18FindEmailsOld(id) {
  var list = (window._sampaignContactsCache || {})[id];
  if (!list) { try { var r = await _sampEdge('list_sampaign_contacts', { campaign_id: id }); if (r.ok) { list = r.contacts || []; (window._sampaignContactsCache = window._sampaignContactsCache || {})[id] = list; } } catch (e) {} }
  var ids = (list || []).filter(function (x) { return x.status === 'not_contacted' && (!x.email || /^scouted\./i.test(x.email) || /@linkedin\.invalid$/i.test(x.email)); }).map(function (x) { return x.id; }).slice(0, 200);
  if (!ids.length) { showToast('Everyone here has an email.'); await _sampLoadOverview(id); return; }
  showToast('Looking up ' + _spPlural(ids.length, 'email') + '…');
  var d = await _sampEdge('enrich_sampaign_contacts', { campaign_id: id, contact_ids: ids });
  if (!d.ok) showToast(d.error || 'Email lookup is not available right now');
  else showToast((d.emails_found || 0) ? 'Found ' + _spPlural(d.emails_found, 'email') + (d.emails_not_found ? '. ' + d.emails_not_found + ' not found' : '') + '.' : 'No new emails found' + (d.note ? ': ' + d.note : '.'));
  await _sampPrimeContacts(id);
  await _sampLoadOverview(id);
}
async function g18LiWrite(id) { await spLiWrite(id, 'invite'); await _sampLoadOverview(id); }

// After SAM writes, say what it checked.
function _g18WroteMsg(written, rv) {
  if (!written) return 'Nobody was waiting for this email.';
  var bits = ['SAM wrote ' + _spPlural(written, 'draft')];
  if (rv && rv.rewritten) bits.push('rewrote ' + rv.rewritten + ' that failed its checks');
  return bits.join(' and ') + '. Review them, then schedule.';
}

// ════════════════════════════════════════════════════════════════════════════
// Drop H (2026-10-10): usage and limits, ad audiences, SAM-TAM Discovery.
// ════════════════════════════════════════════════════════════════════════════
var G19_ICON = {
  target: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg>',
  people: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a5.5 5.5 0 013.5 6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  dl: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/></svg>'
};
function _g19Cfg() { return window._orgConfig || {}; }
function _g19CanExport() { return !!_g19Cfg().canExport; }
function _g19SamTam() { return !!_g19Cfg().samTam; }
// The home buttons follow what this person may do.
function g19PaintHome() {
  var a = document.getElementById('g19AudBtn'); if (a) a.hidden = !_g19CanExport();
  var t = document.getElementById('g19TamBtn'); if (t) t.classList.toggle('g19-locked', !_g19SamTam());
}
setInterval(function () { try { if (window._orgConfig) g19PaintHome(); } catch (e) {} }, 1500);

// ── Usage: mine ─────────────────────────────────────────────────────────────
window._g19Usage = null; window._g19UsageAt = 0;
async function g19UsageLoad(force) {
  if (window._g19Usage && !force && Date.now() - window._g19UsageAt < 60000) return window._g19Usage;
  var d = await _sampEdge('get_my_usage', {});
  if (d.ok) { window._g19Usage = d; window._g19UsageAt = Date.now(); }
  return window._g19Usage;
}
function _g19Left(kind) { var u = window._g19Usage; if (!u) return null; var k = (u.kinds || []).find(function (x) { return x.kind === kind; }); return k ? Math.max(0, k.cap - k.used) : null; }
function _g19Meter(k) {
  var pct = k.cap ? Math.min(100, Math.round(k.used / k.cap * 100)) : 100;
  var tone = !k.cap ? 'off' : pct >= 100 ? 'full' : pct >= 80 ? 'near' : '';
  return '<div class="g19-m ' + tone + '"><div class="g19-mh"><span>' + esc(k.label) + '</span><b>' + (k.cap ? k.used + ' <small>of ' + k.cap + '</small>' : '<small>Off</small>') + '</b></div><div class="g19-mb"><span style="width:' + (k.cap ? pct : 0) + '%"></span></div></div>';
}
async function g19RenderYouUsage() {
  var box = document.getElementById('youUsageBody'), chip = document.getElementById('youUsageChip');
  if (!box) return;
  box.innerHTML = '<div class="admin-card" style="margin-bottom:0"><div class="sp-small">Loading…</div></div>';
  var u = await g19UsageLoad(true);
  if (!u) { box.innerHTML = '<div class="admin-card" style="margin-bottom:0"><div class="sp-small">Could not load your usage.</div></div>'; return; }
  var near = (u.kinds || []).filter(function (k) { return k.cap && k.used / k.cap >= 0.8; }).length;
  if (chip) chip.textContent = near ? near + ' near the limit' : 'Today';
  box.innerHTML = '<div class="admin-card" style="margin-bottom:0"><div class="sp-small" style="margin-bottom:10px">What you have used today, against your daily limits. Limits reset at midnight. Your admin sets them in Team &amp; access, Usage.</div>' +
    '<div class="g19-meters">' + (u.kinds || []).map(_g19Meter).join('') + '</div>' +
    (u.rights && u.rights.export ? '<div class="sp-small" style="margin-top:12px">' + G19_ICON.check + ' You can export ad audiences.</div>' : '') + '</div>';
}

// ── Ad audiences ────────────────────────────────────────────────────────────
var G19_SEG = [['reached', 'Reached'], ['engaged', 'Replied or interested'], ['not_replied', 'No reply yet'], ['everyone', 'Everyone']];
var G19_FMT = [
  ['meta', 'Meta', 'Facebook and Instagram. Emails, phone numbers and names, hashed. Meta suggests at least 1,000 people; smaller lists work best as a lookalike seed.'],
  ['linkedin_people', 'LinkedIn contacts', 'Emails hashed, with names, job titles and companies so LinkedIn can match people without an email. LinkedIn needs 300 matched members to run ads.'],
  ['linkedin_companies', 'LinkedIn companies', 'The companies only, no personal data. The surest way to reach B2B buyers: LinkedIn targets everyone there by job title.']
];
async function openAdAudience(campaignId) {
  if (!_g19CanExport()) { showToast('Exporting audiences needs your admin’s go-ahead. They can switch it on in Team & access, Usage.'); return; }
  var A = window._g19Aud = { camps: [], picked: {}, seg: 'reached', fmt: 'meta', sum: null, loading: true, only: campaignId || null };
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'g19Aud';
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  m.innerHTML = '<div class="sp-mcard g19-aud" role="dialog" aria-modal="true" aria-label="Ad audience"><div id="g19AudBody"><div class="sp-small">Loading…</div></div></div>';
  document.body.appendChild(m);
  var d = await _sampEdge('ad_audience_options', {});
  if (!d.ok) { document.getElementById('g19AudBody').innerHTML = '<h3>Ad audience</h3><p class="sp-muted">' + esc(d.error || 'Not available.') + '</p><div class="sp-foot"><span></span><button class="g-btn" type="button" onclick="document.getElementById(\'g19Aud\').remove()">Close</button></div>'; return; }
  A.camps = d.campaigns || []; A.provider = d.provider_data;
  A.camps.forEach(function (c) { A.picked[c.id] = !A.only || c.id === A.only; });
  A.loading = false;
  g19UsageLoad(false).then(function () { _g19AudRender(); });
  _g19AudRender(); _g19AudPreview();
}
function _g19AudIds() { var A = window._g19Aud; return A.camps.filter(function (c) { return A.picked[c.id]; }).map(function (c) { return c.id; }); }
function _g19AudRender() {
  var A = window._g19Aud, el = document.getElementById('g19AudBody'); if (!A || !el) return;
  var ids = _g19AudIds(), s = A.sum;
  var tile = function (n, l, tone) { return '<div class="g19-t' + (tone ? ' ' + tone : '') + '"><b>' + (n === null || n === undefined ? '…' : n) + '</b><span>' + l + '</span></div>'; };
  var left = _g19Left('reveal');
  var canFill = s && s.could_find_phone > 0 && A.fmt === 'meta';
  el.innerHTML = '<h3>Ad audience</h3><p class="sp-muted" style="margin:4px 0 0">People from your SAMpaigns, ready to upload to Meta or LinkedIn. Emails and phone numbers are hashed, so they never leave Samora readable. Anyone who opted out or said not interested is left out.</p>' +
    '<div class="g19-sec">From</div>' +
    '<div class="g19-camps">' + (A.camps.length ? A.camps.map(function (c) { return '<label class="g19-camp"><input type="checkbox" data-g19-camp="' + esc(c.id) + '"' + (A.picked[c.id] ? ' checked' : '') + '><span><b>' + esc(c.name) + '</b><small>' + _spPlural(c.people, 'person', 'people') + (c.owner ? ' · ' + esc(c.owner) : '') + '</small></span></label>'; }).join('') : '<div class="sp-small">No SAMpaigns with people yet.</div>') + '</div>' +
    '<div class="g19-sec">Who</div><div class="g19-seg">' + G19_SEG.map(function (x) { return '<button type="button" class="' + (A.seg === x[0] ? 'on' : '') + '" data-g19-seg="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
    '<div class="g19-tiles">' + tile(s ? s.usable : null, 'in the file') + tile(s ? s.with_email : null, 'with an email') + tile(s ? s.with_phone : null, 'with a phone') + tile(s ? s.companies : null, 'companies') + '</div>' +
    (s && s.left_out_provider_data ? '<div class="sp-small" style="margin-top:8px">' + _spPlural(s.left_out_provider_data, 'email or number', 'emails and numbers') + ' from Lusha, Apollo or ZoomInfo left out, as your admin has set.</div>' : '') +
    '<div class="g19-sec">Format</div><div class="g19-fmts">' + G19_FMT.map(function (f) { return '<button type="button" class="g19-fmt' + (A.fmt === f[0] ? ' on' : '') + '" data-g19-fmt="' + f[0] + '"><b>' + f[1] + '</b><span>' + f[2] + '</span></button>'; }).join('') + '</div>' +
    (canFill ? '<div class="g19-fill"><div><b>' + _spPlural(s.could_find_phone, 'person has', 'people have') + ' no phone number yet</b><small>Phone numbers lift Meta’s match rate the most. SAM can look them up from their LinkedIn profile, one paid reveal each (usually one Lusha credit)' + (left !== null ? '. You have ' + left + ' left today' : '') + '.</small></div><button class="g-btn sp-sm" type="button" data-g19-fill="1"' + (left === 0 ? ' disabled' : '') + '>Find up to ' + Math.min(s.could_find_phone, left === null ? 25 : left) + '</button></div>' : '') +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'g19Aud\').remove()">Close</button><button class="g-btn sp-gold" type="button" data-g19-dl="1"' + (!ids.length || (s && !s.usable && A.fmt !== 'linkedin_companies') ? ' disabled' : '') + '>' + G19_ICON.dl + ' Download for ' + (G19_FMT.find(function (f) { return f[0] === A.fmt; }) || G19_FMT[0])[1] + '</button></div>';
}
var _g19AudT = null;
function _g19AudPreview() {
  clearTimeout(_g19AudT);
  _g19AudT = setTimeout(async function () {
    var A = window._g19Aud; if (!A) return;
    var ids = _g19AudIds();
    if (!ids.length) { A.sum = { usable: 0, with_email: 0, with_phone: 0, companies: 0 }; _g19AudRender(); return; }
    A.sum = null; _g19AudRender();
    var d = await _sampEdge('ad_audience_preview', { campaign_ids: ids, segment: A.seg });
    if (window._g19Aud !== A) return;
    A.sum = d.ok ? d.summary : { usable: 0, with_email: 0, with_phone: 0, companies: 0 };
    if (!d.ok) showToast(d.error || 'Could not count the audience');
    _g19AudRender();
  }, 250);
}
document.addEventListener('click', async function (e) {
  var t = e.target.closest('[data-g19-seg],[data-g19-fmt],[data-g19-dl],[data-g19-fill]'); if (!t || !window._g19Aud) return;
  var A = window._g19Aud;
  if (t.hasAttribute('data-g19-seg')) { A.seg = t.getAttribute('data-g19-seg'); _g19AudPreview(); return; }
  if (t.hasAttribute('data-g19-fmt')) { A.fmt = t.getAttribute('data-g19-fmt'); _g19AudRender(); return; }
  if (t.hasAttribute('data-g19-dl')) {
    t.disabled = true; t.textContent = 'Preparing…';
    var d = await _sampEdge('ad_audience_export', { campaign_ids: _g19AudIds(), segment: A.seg, format: A.fmt });
    if (!d.ok) { showToast(d.error || 'Could not export'); _g19AudRender(); return; }
    var blob = new Blob([d.csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = d.filename || 'samora-audience.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    window._g19LastExport = d;
    showToast('Downloaded ' + _spPlural(d.rows, 'row') + '. Upload it in ' + (A.fmt === 'meta' ? 'Meta Ads Manager, Audiences, Custom audience, Customer list.' : 'LinkedIn Campaign Manager, Audiences, Upload a list.'));
    g19UsageLoad(true); _g19AudRender(); return;
  }
  if (t.hasAttribute('data-g19-fill')) { g19FillPhones(t); return; }
});
document.addEventListener('change', function (e) {
  var t = e.target; if (!t || !t.hasAttribute || !t.hasAttribute('data-g19-camp') || !window._g19Aud) return;
  window._g19Aud.picked[t.getAttribute('data-g19-camp')] = t.checked; _g19AudPreview();
});
async function g19FillPhones(btn) {
  var A = window._g19Aud; var left = _g19Left('reveal');
  var max = Math.min(A.sum.could_find_phone, left === null ? 25 : left);
  if (!max) { showToast('No reveals left today.'); return; }
  if (btn.getAttribute('data-sure') !== '1') { btn.setAttribute('data-sure', '1'); btn.textContent = 'Use up to ' + max + ' reveals?'; btn.classList.add('sp-gold'); return; }
  var d = await _sampEdge('ad_audience_phone_targets', { campaign_ids: _g19AudIds(), segment: A.seg, max: max });
  if (!d.ok) { showToast(d.error || 'Could not start'); return; }
  var list = d.targets || [];
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'g19FillM';
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Finding phone numbers"><h3>Finding phone numbers</h3><div class="sp-small" id="g19FillMsg">Starting…</div><div class="sp-progress"><span id="g19FillBar" style="width:4%"></span></div><div class="sp-small" style="margin-top:10px">Samora checks its own records first, so a number already found by your team costs nothing.</div><div class="sp-foot"><span></span><button class="g-btn" type="button" id="g19FillStop">Stop</button></div></div>';
  document.body.appendChild(m);
  var stop = false; document.getElementById('g19FillStop').onclick = function () { stop = true; this.textContent = 'Stopping…'; };
  var found = 0, done = 0, err = null;
  for (var i = 0; i < list.length && !stop; i++) {
    var r = await _sampEdge('panel_reveal_contact', { linkedin_url: list[i].linkedin_url, name: list[i].name, company: list[i].company });
    done++;
    if (!r.ok) { err = r.error || 'Stopped'; break; }
    if ((r.phones || []).length) found++;
    var msg = document.getElementById('g19FillMsg'), bar = document.getElementById('g19FillBar');
    if (msg) msg.textContent = done + ' of ' + list.length + ' checked, ' + _spPlural(found, 'number') + ' found';
    if (bar) bar.style.width = Math.max(4, Math.round(done / list.length * 100)) + '%';
  }
  m.remove();
  showToast(err ? err : 'Found ' + _spPlural(found, 'phone number') + ' for ' + _spPlural(done, 'person', 'people') + '.');
  await g19UsageLoad(true); _g19AudPreview();
}
function _g19ExportBtn(id) { return _g19CanExport() ? '<button class="g-btn" type="button" onclick="openAdAudience(\'' + esc(id) + '\')" title="People from this SAMpaign for Meta or LinkedIn ads">Ad audience</button>' : ''; }

// ── SAM-TAM Discovery (premium) ─────────────────────────────────────────────
function _g19PremiumCard(compact) {
  return '<div class="li-lock' + (compact ? ' sm' : '') + '" role="note" aria-label="SAM-TAM Discovery is a premium feature">' +
    '<span class="li-lock-sheen" aria-hidden="true"></span><div class="li-lock-mark">' + G19_ICON.target.replace('width="16" height="16"', 'width="22" height="22"') + '</div>' +
    '<div class="li-lock-body"><div class="li-lock-k">Premium</div><div class="li-lock-t">SAM-TAM Discovery</div>' +
    '<div class="li-lock-s">Describe the market you want, in a sentence. SAM finds real companies that fit, checks every website, leaves out the ones you already have, and turns your pick into a SAMpaign in one click.</div>' +
    '<div class="li-lock-acts"><button class="li-lock-b" type="button" onclick="g19RequestTam(this)">Ask Samora to unlock</button><span class="li-lock-f">Part of Samora’s premium plan.</span></div></div></div>';
}
async function g19RequestTam(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  var d = await _sampEdge('request_addon', { addon: 'sam_tam' });
  if (btn) { btn.textContent = d.ok ? 'Samora has your request' : 'Ask Samora to unlock'; btn.disabled = !!d.ok; }
  showToast(d.ok ? 'Sent to the Samora team. They will be in touch.' : (d.error || 'Could not reach Samora'));
}
function sampOpenTam(opts) {
  window._g19Tam = Object.assign({ q: '', region: '', n: 5, res: null, picked: {}, busy: false, fromWizard: false }, window._g19Tam && opts && opts.keep ? window._g19Tam : {}, opts || {});
  _spShow('tam');
  var page = document.getElementById('sampTamPage'); if (!page) return;
  _g19TamRender();
  if (_g19SamTam()) { g19UsageLoad(false).then(_g19TamRender); _g19TamIdeas(); _g24TamEarlier(true); }
}
async function _g19TamIdeas() {
  var T = window._g19Tam; if (T.ideas) return;
  T.ideas = [];
  try {
    var d = await _sampEdge('get_org_setting', { key: 'icp_definition' });
    var icp = d && d.value ? (typeof d.value === 'string' ? JSON.parse(d.value) : d.value) : {};
    var inds = (icp.target_industries || []).slice(0, 3), geos = (icp.target_geographies || []).slice(0, 2);
    inds.forEach(function (i) { T.ideas.push(i + (geos[0] ? ' companies in ' + geos[0] : ' companies')); });
    if (inds[0] && geos[1]) T.ideas.push(inds[0] + ' companies in ' + geos[1]);
  } catch (e) {}
  if (!T.ideas.length) T.ideas = ['Fintech lenders in India with 200 to 2,000 employees', 'FMCG brands in the UAE with their own distributor network', 'Private universities in Karnataka'];
  _g19TamRender();
}
function _g19TamRender() {
  var T = window._g19Tam, page = document.getElementById('sampTamPage'); if (!T || !page) return;
  var head = '<button class="sp-back" type="button" onclick="' + (T.fromWizard ? '_g19TamBack()' : 'sampBackToList()') + '">' + SP_ICON.back + (T.fromWizard ? 'Back to New SAMpaign' : 'All SAMpaigns') + '</button>' +
    '<h1 class="sp-title">SAM-TAM Discovery <span class="g19-prem">Premium</span></h1><div class="sp-sub">Find the part of your market worth reaching. Describe it in a sentence; SAM finds real companies, checks each website, and leaves out the ones you already have.</div>';
  if (!_g19SamTam()) { page.innerHTML = '<div class="sp-wiz g19-tam">' + head + '<div style="margin-top:18px">' + _g19PremiumCard(false) + '</div></div>'; return; }
  var left = _g19Left('discovery');
  var form = '<section class="sp-card sp-pad g19-tamf"><label class="sp-fld" style="margin-top:0">Describe the companies<textarea id="g19TamQ" rows="2" placeholder="Fintech lenders in India with 200 to 2,000 employees">' + esc(T.q) + '</textarea></label>' +
    (T.ideas && T.ideas.length && !T.res ? '<div class="sp-chips" style="margin-top:10px">' + T.ideas.map(function (x, i) { return '<button type="button" class="sp-chip g18-sug" onclick="window._g19Tam.q=window._g19Tam.ideas[' + i + '];_g19TamRender()">' + esc(x) + '</button>'; }).join('') + '</div>' : '') +
    '<div class="g19-tamrow"><label class="sp-fld">Region <small>optional</small><input id="g19TamR" value="' + esc(T.region) + '" placeholder="India"></label>' +
    '<div class="sp-fld">How many<div class="g19-seg">' + [2, 5, 10, 20].map(function (n) { return '<button type="button" class="' + (T.n === n ? 'on' : '') + '" onclick="_g19TamSave();window._g19Tam.n=' + n + ';_g19TamRender()">' + n + '</button>'; }).join('') + '</div></div>' +
    '<button class="g-btn sp-gold" type="button" id="g19TamGo" onclick="g19TamSearch()"' + (T.busy || left === 0 ? ' disabled' : '') + '>' + (T.busy ? 'SAM is looking…' : SP_ICON.spark + ' Find companies') + '</button></div>' +
    '<div class="sp-small" style="margin-top:8px">' + (left === null ? '' : left === 0 ? 'No searches left today. They reset at midnight.' : _spPlural(left, 'search', 'searches') + ' left today.') + ' A search counts only when SAM comes back with companies. It uses no data credits' + (T.apollo ? ' unless you use Apollo below' : '') + '.</div>' + _g26TamDbHtml(T) + '</section>';
  var res = '';
  if (!T.busy && T.err) res = _g20TamErr(T);
  if (T.busy) res = '<section class="sp-card sp-pad"><div class="g21-lk"><span class="sp-lbl">Looking for ' + T.n + ' ' + (T.n === 1 ? 'company' : 'companies') + '</span><span class="g21-el" id="g21TamEl">' + Math.max(0, Math.round((Date.now() - (T.t0 || Date.now())) / 1000)) + 's</span></div><div class="sp-progress g21-ind" style="margin-top:12px"><span></span></div><div class="sp-small" style="margin-top:10px">SAM finds companies that fit, then checks each website is real. Usually 20 to 60 seconds.</div></section>';
  if (!T.busy && T.res) {
    var c = T.res.candidates || [];
    var nPick = c.filter(function (x) { return T.picked[x.id]; }).length;
    res += '<section class="sp-card g19-tamres' + (T.res.earlier ? ' g24-earl' : '') + '">' + (T.res.earlier ? '<div class="g24-earh">' + G24_ICON.spark + '<span>Found by an earlier search' + (T.res.query ? ': <b>' + esc(T.res.query) + '</b>' : '') + '. Already checked, and using them costs no search.</span></div>' : '') + _g26TamFilters(T.res) + '<div class="g19-trh"><div><b>' + _spPlural(c.length, 'company', 'companies') + '</b><span class="sp-small"> · ' + (T.res.verified_count || 0) + ' with a checked website' + (T.res.skipped_existing ? ' · ' + T.res.skipped_existing + ' you already have left out' : '') + '</span></div>' +
      '<div class="g19-trha"><button class="g19-lnk" type="button" onclick="g19TamPick(\'verified\')">Select checked</button><button class="g19-lnk" type="button" onclick="g19TamPick(\'none\')">Clear</button></div></div>' +
      (c.length ? c.map(function (x) {
        return '<label class="g19-co' + (T.picked[x.id] ? ' on' : '') + '"><input type="checkbox" ' + (T.picked[x.id] ? 'checked ' : '') + 'onchange="window._g19Tam.picked[\'' + esc(x.id) + '\']=this.checked;_g19TamRender()">' +
          '<span class="g19-cob"><span class="g19-con"><b>' + esc(x.name) + '</b>' + (x.verified ? '<span class="g19-ver" title="' + esc(x.evidence || '') + '">' + G19_ICON.check + ' Website checked</span>' : '<span class="g19-unv" title="' + esc(x.evidence || '') + '">Not checked</span>') + (typeof _samCandScore === 'function' ? _samCandScore(x) : '') + (x._earlier ? '<span class="g26-earl" title="Found by an earlier search like this one. Already checked; using it costs no search.">Found earlier</span>' : '') + '</span>' +
          '<small>' + esc([x.domain, x.region].filter(Boolean).join(' · ')) + '</small>' + (x.description ? '<span class="g19-cod">' + esc(x.description) + '</span>' : '') + (x.source === 'warm' || x.source === 'champion' ? '<span class="g19-cod">' + esc(x.evidence || '') + '</span>' : '') + (typeof _samCandWhy === 'function' ? _samCandWhy(x) : '') + '</span>' +
          '<button type="button" class="g19-nf" title="Not a fit: SAM will not suggest it again" onclick="event.preventDefault();g19TamReject(\'' + esc(x.id) + '\')">Not a fit</button></label>';
      }).join('') : '<div class="sp-empty">No new companies for that. Try a broader description or a different region.</div>') +
      (T.res.found_by === 'knowledge' ? '<div class="sp-small" style="padding:10px 16px">Live web search was not available just now, so SAM used what it knows. Every website was still checked.</div>' : T.res.found_by === 'directory' ? '<div class="sp-small" style="padding:10px 16px">SAM\u2019s AI was not available just now, so SAM used public company directories. Every website was still checked; refine with SAM later for a closer fit.</div>' : '') +
      _g26TamNotes(T.res) + (typeof _samSourceNote === 'function' ? _samSourceNote(T.res) : '') +
      (T.res.context_note ? '<div class="sp-small" style="padding:10px 16px">' + esc(T.res.context_note) + '</div>' : '') +
      '</section>' +
      (nPick ? '<div class="g19-tambar"><span><b>' + nPick + '</b> selected</span><button class="g-btn sp-gold" type="button" onclick="g19TamUse()">' + (T.fromWizard ? 'Add ' + nPick + ' to the SAMpaign' : 'Start a SAMpaign with ' + nPick) + '</button></div>' : '');
  }
  // Drop Q: four ways to find companies. Describe keeps the form; the others have their own panel.
  var _sqm = typeof _samTamModes === 'function' ? _samTamModes(T) : '';
  var _alt = _sqm && T.mode && T.mode !== 'describe';
  page.innerHTML = '<div class="sp-wiz g19-tam">' + head + _sqm + (_alt ? _samTamModePanel(T) : form) + (T.mode === 'champions' ? '' : res) + (_alt ? '' : _g24TamEarlierHtml(T)) + '</div>';
}
function _g19TamSave() { var T = window._g19Tam; var q = document.getElementById('g19TamQ'), r = document.getElementById('g19TamR'); if (q) T.q = q.value; if (r) T.region = r.value; }
async function g19TamSearch() {
  _g19TamSave(); var T = window._g19Tam;
  if (String(T.q).trim().length < 8) { showToast('Describe the companies in a few words, like the examples'); return; }
  _g20TamStopWait(); T.err = null;
  T.busy = true; T.res = null; T.picked = {}; T.t0 = Date.now(); _g19TamRender();
  if (T.elT) clearInterval(T.elT);
  T.elT = setInterval(function () { var el = document.getElementById('g21TamEl'); if (!T.busy || !el) { clearInterval(T.elT); T.elT = null; return; } el.textContent = Math.round((Date.now() - T.t0) / 1000) + 's'; }, 1000);
  var d = await _sampEdge('discover_accounts', { description: String(T.q).trim(), region_hint: String(T.region || '').trim() || undefined, limit: T.n, use_database: (T.apollo && T.useDb) || undefined });
  T.busy = false;
  if (!d.ok) {
    if (d.locked) { window._orgConfig = Object.assign({}, window._orgConfig || {}, { samTam: false }); showToast(d.error || 'SAM-TAM Discovery is a premium feature'); _g19TamRender(); return; }
    T.err = { msg: d.error || 'SAM could not search just now. Try again in a minute.', busy: !!(d.busy || d._stopped), slow: !!(d.slow || d._stopped), quota: d.quota || null, admin: d.admin_detail || null };
    if (d.waiting && d.waiting.length) { T.res = { candidates: d.waiting, verified_count: d.waiting.filter(function (x) { return x.verified; }).length, earlier: true }; T.picked = {}; }
    g19UsageLoad(true).then(function () { if (window._g19Tam === T && !T.busy) _g19TamRender(); });
    if ((d.busy || /put the list together/.test(d.error || '')) && (T.autoTries || 0) < 2) { T.autoTries = (T.autoTries || 0) + 1; _g20TamWait(T.autoTries === 1 ? 20 : 45); }
    _g19TamRender(); _g20Reveal('.g20-err'); return;
  }
  T.autoTries = 0; setTimeout(function () { _g20Reveal('.g19-tamres'); }, 60);
  if (d.earlier_finds && d.earlier_finds.length) { d.candidates = (d.candidates || []).concat(d.earlier_finds.map(function (x) { return Object.assign({}, x, { _earlier: true }); })); d.verified_count = (d.verified_count || 0) + d.earlier_finds.filter(function (x) { return x.verified; }).length; }
  T.res = d;
  (d.candidates || []).forEach(function (x) { if (x.verified) T.picked[x.id] = true; });
  await g19UsageLoad(true);
  _g19TamRender();
}
function g19TamPick(which) { var T = window._g19Tam; T.picked = {}; if (which === 'verified') (T.res.candidates || []).forEach(function (x) { if (x.verified) T.picked[x.id] = true; }); _g19TamRender(); }
async function g19TamReject(id) {
  var T = window._g19Tam;
  T.res.candidates = (T.res.candidates || []).filter(function (x) { return x.id !== id; });
  delete T.picked[id]; _g19TamRender();
  _sampEdge('commit_discovery', { mark_only: true, reject_ids: [id] }).catch(function () {});
}
function g19TamUse() {
  var T = window._g19Tam;
  var pick = (T.res.candidates || []).filter(function (x) { return T.picked[x.id]; });
  var lines = pick.map(function (x) { return [x.name, x.domain || '', x.region || ''].filter(function (v, i) { return i < 2 || v; }).join(', ').replace(/, $/, ''); });
  if (T.fromWizard && window._sampW) {
    var W = window._sampW;
    W.companies = (String(W.companies || '').trim() ? String(W.companies).trim() + '\n' : '') + lines.join('\n');
    W.tamAccept = (W.tamAccept || []).concat(pick.map(function (x) { return x.id; }));
    _spShow('new'); _spWizRender(); showToast(_spPlural(pick.length, 'company', 'companies') + ' added to the list');
    return;
  }
  sampOpenWizard();
  var W2 = window._sampW;
  W2.scope = 'list'; W2.listName = String(T.q).trim().slice(0, 60); W2.listRegion = String(T.region || '').trim();
  W2.companies = lines.join('\n'); W2.tamAccept = pick.map(function (x) { return x.id; });
  _spWizRender();
  showToast('Your list is in. Check it, then Continue.');
}
function _g19TamBack() { _spShow('new'); _spWizRender(); }
function g19TamFromWizard() { _spWizSave(); sampOpenTam({ fromWizard: true, keep: false }); }
function _g19TamWizCard() {
  return _g19SamTam()
    ? '<button type="button" class="g19-tamcta" onclick="g19TamFromWizard()">' + G19_ICON.target + '<span><b>Find the companies with SAM-TAM Discovery</b><small>Describe your market in a sentence; SAM finds real companies and checks each website.</small></span><span class="g19-prem">Premium</span></button>'
    : '<button type="button" class="g19-tamcta locked" onclick="g19TamFromWizard()">' + G19_ICON.lock + '<span><b>SAM-TAM Discovery</b><small>Let SAM find the companies for you. Part of Samora’s premium plan.</small></span><span class="g19-prem">Premium</span></button>';
}

// ── Drop H.1 (2026-10-10): when Google's AI is busy ─────────────────────────
var G20_ICON = {
  cloud: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18.5h10a4 4 0 00.6-7.96A6 6 0 006.2 9.6 4.5 4.5 0 007 18.5z"/><path d="M12 11v3.5M12 16.8v.2"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v5M12 15.8v.2"/></svg>'
};
function _g20TamErr(T) {
  var e = T.err, left = _g19Left('discovery');
  var body = e.quota ? e.msg : e.slow
    ? 'The search took too long, so SAM stopped it. Nothing was used' + (left !== null ? ': you still have ' + _spPlural(left, 'search', 'searches') + ' today' : '') + '. Try again, or ask for fewer companies.'
    : e.busy
    ? 'SAM is under heavy load for a moment. Nothing was used' + (left !== null ? ': you still have ' + _spPlural(left, 'search', 'searches') + ' today' : '') + '. This usually clears within a minute.'
    : e.msg;
  return '<section class="sp-card sp-pad g20-err' + (e.busy ? ' busy' : '') + '" role="status" aria-live="polite">' +
    '<div class="g20-eh"><span class="g20-ei">' + (e.busy ? G20_ICON.cloud : G20_ICON.warn) + '</span><b>' + (e.quota === 'day' ? 'SAM’s AI allowance is used up for today' : e.quota ? 'SAM is pacing itself' : e.slow ? 'SAM took too long' : e.busy ? 'SAM is busy right now' : 'SAM could not search') + '</b></div>' +
    '<div class="g20-eb">' + esc(body) + '</div>' +
    (T.wait ? '<div class="g20-ew"><span class="g20-spin" aria-hidden="true"></span><span>Trying again in <b id="g20TamWait">' + T.wait + '</b>s</span></div>' : '') +
    (e.admin ? '<details class="g24-adm"><summary>For Samora: the technical reason</summary><code>' + esc(e.admin) + '</code></details>' : '') +
    (T.res && T.res.earlier ? '<div class="g24-eh">Meanwhile, companies from earlier searches are below.</div>' : '') +
    '<div class="g20-ea"><button class="g-btn sp-gold" type="button" onclick="g20TamRetryNow()">Try again now</button>' +
    (T.wait ? '<button class="g-btn" type="button" onclick="_g20TamStopWait();_g19TamRender()">Don’t retry</button>' : '') + '</div></section>';
}
function _g20TamWait(secs) {
  var T = window._g19Tam; if (!T) return;
  _g20TamStopWait();
  T.wait = secs;
  T.waitT = setInterval(function () {
    if (window._g19Tam !== T || window._sampView !== 'tam') { _g20TamStopWait(); return; }
    T.wait--;
    var el = document.getElementById('g20TamWait'); if (el) el.textContent = String(Math.max(0, T.wait));
    if (T.wait <= 0) { _g20TamStopWait(); g19TamSearch(); }
  }, 1000);
}
function _g20TamStopWait() { var T = window._g19Tam; if (!T) return; if (T.waitT) clearInterval(T.waitT); T.waitT = null; T.wait = 0; }
function g20TamRetryNow() { _g20TamStopWait(); g19TamSearch(); }
// On a phone the answer lands below the form: bring it into view once.
function _g20Reveal(sel) {
  setTimeout(function () {
    var el = document.querySelector(sel); if (!el || !el.getBoundingClientRect) return;
    var r = el.getBoundingClientRect();
    if (r.top > window.innerHeight - 120) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); } }
  }, 50);
}

// ════════════════════════════════════════════════════════════════════════════
// Drop I (2026-10-14): emails found per person, the email line on SAMpaign
// cards, LinkedIn notes and messages in Drafts and queue, a phone on click.
// ════════════════════════════════════════════════════════════════════════════
var G23_ICON = {
  phone: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h3.5l1.8 4.4-2.2 1.4a11 11 0 005.1 5.1l1.4-2.2L19 14.5V18a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7.5a2 2 0 002 2h2.5"/></svg>',
  wa: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 19.5l1.2-3.6A8 8 0 1112 20a8 8 0 01-3.9-1z"/><path d="M9.2 8.6c.3 2.6 2.6 5 5.3 5.4l1-1.2-1.6-1-.9.6c-.9-.4-1.6-1.1-2-2l.6-.9-1-1.6z"/></svg>',
  pen: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3z"/></svg>'
};

// ── Launch plan step 2: emails, person by person ─────────────────────────────
async function g23FindEmails(id, retry) {
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'g23EmM';
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Finding email addresses"><h3>Finding email addresses</h3>' +
    '<div class="sp-small" id="g23EmMsg">Checking what Samora already has…</div><div class="sp-progress"><span id="g23EmBar" style="width:4%"></span></div>' +
    '<div class="sp-small" style="margin-top:10px">Free when Samora already has it. Otherwise about one credit per person found.</div>' +
    '<div class="sp-foot"><span></span><button class="g-btn" type="button" id="g23EmStop">Stop</button></div></div>';
  document.body.appendChild(m);
  var stop = false; document.getElementById('g23EmStop').onclick = function () { stop = true; this.textContent = 'Stopping…'; };
  var found = 0, checked = 0, total = null, err = null, last = null, phones = 0, guard = 0, first = true;
  while (!stop && guard++ < 60) {
    var d = await _sampEdge('find_sampaign_emails', { campaign_id: id, batch: 8, retry: !!retry && first });
    first = false;
    if (!d.ok) { err = d.error || 'SAM could not look up emails just now.'; break; }
    last = d;
    found += d.found || 0; checked += d.checked || 0; phones += d.phones_found || 0;
    if (total === null) total = checked + (d.remaining || 0);
    var msg = document.getElementById('g23EmMsg'), bar = document.getElementById('g23EmBar');
    if (msg) msg.textContent = 'Looked up ' + checked + (total ? ' of ' + total : '') + ' · ' + _spPlural(found, 'email') + ' found';
    if (bar) bar.style.width = Math.max(4, Math.round(checked / Math.max(1, total || 1) * 100)) + '%';
    if (!d.remaining || !d.checked) break;
    retry = false;
  }
  m.remove();
  if (err) showToast(err);
  else {
    var nf = last && last.summary ? last.summary.not_found : Math.max(0, checked - found);
    showToast(checked ? ('Found ' + _spPlural(found, 'email') + (nf ? '. ' + nf + ' still without one: LinkedIn can reach them, or add an email yourself.' : '.') + (phones ? ' ' + _spPlural(phones, 'phone number') + ' came with them.' : '')) : 'Everyone here has been looked up.');
  }
  try { await _sampPrimeContacts(id); } catch (e) {}
  await _sampLoadOverview(id);
}

// ── SAMpaign cards: the email line, like the LinkedIn one ────────────────────
function _g23MailLine(c) {
  var s = c.stats || {}, q = c.queue || {}, tot = s.total || 0, sent = s.sent || 0;
  var replied = (s.replied || 0) + (s.opted_out || 0), interested = s.interested || 0, bounced = s.dead || 0;
  var w = function (n) { return tot ? Math.max(0, Math.round(n / tot * 1000) / 10) + '%' : '0%'; };
  var bits = ['<span><b>' + sent + '</b> of ' + tot + ' reached</span>', '<span><b>' + replied + '</b> replied</span>', '<span class="sp-g"><b class="sp-g">' + interested + '</b> interested</span>'];
  if (s.meetings) bits.push('<span><b>' + s.meetings + '</b> ' + (s.meetings === 1 ? 'meeting' : 'meetings') + '</span>');
  if (bounced) bits.push('<span class="sp-r"><b class="sp-r">' + bounced + '</b> bounced</span>');
  return '<div class="sp-lil g23-ml"><span class="sp-lik g23-mk" title="Email">' + SP_ICON.mail + '</span><div style="flex:1;min-width:0">' +
    '<div class="sp-fun" aria-hidden="true"><span class="sp-f1" style="width:' + w(interested) + '"></span><span class="sp-f2" style="width:' + w(Math.max(0, replied - interested)) + '"></span><span class="sp-f3" style="width:' + w(Math.max(0, sent - replied)) + '"></span></div>' +
    '<div class="sp-fl">' + bits.join('') + '</div></div></div>';
}

// ── Drafts and queue: LinkedIn notes and messages ───────────────────────────
window._g23Li = window._g23Li || {};
function _g23LiOn(id) {
  var o = (window._sampOv || {})[id], c = (o && o.campaign) || (window._sampaignCampaignsCache || {})[id] || {};
  if (typeof _liLocked === 'function' && _liLocked()) return false;
  var l = c.channels && c.channels.linkedin;
  return !!(l && typeof l === 'object' && l.on);
}
function _g23LiTabs(id) {
  if (!_g23LiOn(id)) return '';
  var L = window._g23Li[id], cnt = L && L.data ? L.data.counts : null;
  var tab = function (key, label, n, needs) {
    var on = window._sampLaunch === key;
    return '<span onclick="setSampLaunch(\'' + esc(id) + '\',\'' + key + '\')" class="g23-lt' + (on ? ' on' : '') + '">' + SP_ICON.li + '<span style="font-weight:' + (on ? '700' : '600') + '">' + label + '</span>' +
      (needs ? '<span class="g23-ltn">' + needs + ' to write</span>' : n !== null && n !== undefined ? '<span style="color:var(--text3)"> · ' + n + '</span>' : '') + '</span>';
  };
  if (!L) _g23LiLoad(id, false).then(function () { var t = document.getElementById('g23LiTabs_' + id); if (t) t.outerHTML = _g23LiTabs(id); });
  return '<span id="g23LiTabs_' + esc(id) + '" class="g23-lts">' + tab('li_invite', 'LinkedIn notes', cnt ? cnt.notes : null, cnt ? cnt.needs_note : 0) + tab('li_message', 'LinkedIn messages', cnt ? cnt.messages : null, 0) + '</span>';
}
async function _g23LiLoad(id, force) {
  var L = window._g23Li[id] = window._g23Li[id] || { filter: 'all', editing: null };
  if (L.data && !force && Date.now() - L.at < 30000) return L.data;
  if (L.p && !force) return L.p;
  L.p = _sampEdge('list_sampaign_linkedin_texts', { campaign_id: id }).then(function (d) { L.p = null; if (d.ok) { L.data = d; L.at = Date.now(); } return L.data; });
  return L.p;
}
function _g23StepTxt(p, kind) {
  var st = kind === 'invite' ? p.invite : p.message_step;
  if (p.stopped && p.stage === 'replied') return ['Replied', 'int'];
  if (st && st.status === 'removed') return ['Taken out', 'mute'];
  if (kind === 'invite') {
    if (['connected', 'messaged'].includes(p.stage)) return ['Accepted', 'live'];
    if (p.stage === 'invited' || (st && st.status === 'done')) return ['Sent' + (st && st.done_at ? ' ' + _spDate(st.done_at) : ''), 'live'];
    if (st && st.status === 'queued') return ['Lined up' + (st.not_before ? ' · ' + _spDate(st.not_before) : ''), 'warn'];
    if (st && st.status === 'failed') return ['Did not go', 'risk'];
    return p.note ? ['Ready', 'warn'] : ['Not written', 'mute'];
  }
  if (p.stage === 'messaged' || (st && st.status === 'done')) return ['Sent' + (st && st.done_at ? ' ' + _spDate(st.done_at) : ''), 'live'];
  if (st && st.status === 'queued') return ['Lined up' + (st.not_before ? ' · ' + _spDate(st.not_before) : ''), 'warn'];
  if (p.stage === 'connected') return p.message ? ['Ready', 'warn'] : ['Accepted, not written', 'mute'];
  return ['After they accept', 'mute'];
}
async function g23RenderLi(id) {
  var host = document.getElementById('g23Li'); if (!host) return;
  var kind = window._sampLaunch === 'li_message' ? 'message' : 'invite';
  var L = window._g23Li[id] = window._g23Li[id] || { filter: 'all', editing: null };
  if (!L.data) { host.innerHTML = '<div class="sp-small">Loading…</div>'; await _g23LiLoad(id, true); }
  var d = L.data; if (!d) { host.innerHTML = '<div class="sp-small">Could not load the LinkedIn steps.</div>'; return; }
  var lim = kind === 'invite' ? d.note_chars : 1900;
  var ppl = d.people.filter(function (p) {
    var st = kind === 'invite' ? p.invite : p.message_step, removed = st && st.status === 'removed';
    if (L.filter === 'removed') return removed;
    if (removed) return false;
    if (L.filter === 'todo') return kind === 'invite' ? (!p.note && p.can_edit_note) : (!p.message && p.can_edit_message && p.stage === 'connected');
    if (L.filter === 'sent') return _g23StepTxt(p, kind)[1] === 'live';
    return kind === 'invite' ? true : (!!p.message || p.stage === 'connected' || p.stage === 'messaged');
  });
  var cntOf = function (f) { var keep = L.filter; L.filter = f; var n = 0; d.people.forEach(function (p) { var st = kind === 'invite' ? p.invite : p.message_step, removed = st && st.status === 'removed'; if (f === 'removed' ? removed : !removed && (f === 'todo' ? (kind === 'invite' ? (!p.note && p.can_edit_note) : (!p.message && p.can_edit_message && p.stage === 'connected')) : f === 'sent' ? _g23StepTxt(p, kind)[1] === 'live' : (kind === 'invite' || !!p.message || p.stage === 'connected' || p.stage === 'messaged'))) n++; }); L.filter = keep; return n; };
  var chip = function (f, label) { var n = cntOf(f); return '<button type="button" class="' + (L.filter === f ? 'on' : '') + '" onclick="window._g23Li[\'' + esc(id) + '\'].filter=\'' + f + '\';g23RenderLi(\'' + esc(id) + '\')">' + label + ' <b>' + n + '</b></button>'; };
  var needs = kind === 'invite' ? d.counts.needs_note : 0;
  var head = '<div class="g23-lh"><div><b>' + (kind === 'invite' ? 'LinkedIn invite notes' : 'Messages after they accept') + '</b><div class="sp-small">' +
    (kind === 'invite' ? 'One per person, under ' + lim + ' characters, the limit on your LinkedIn plan. They go out from the Samora plugin on the days in your sequence.' : 'Sent from the plugin once someone accepts. A reply on email or LinkedIn stops the rest.') + '</div></div>' +
    (d.is_owner && needs ? '<button class="g-btn sp-gold sp-sm" type="button" onclick="g23LiWriteAll(\'' + esc(id) + '\',\'' + kind + '\')">' + SP_ICON.spark + ' Write ' + _spPlural(needs, 'note') + ' with SAM</button>' : '') +
    (d.is_owner && d.people.some(function (p) { return kind === 'invite' ? (p.note && p.can_edit_note) : (p.message && p.can_edit_message); }) ? ' <button class="g-btn sp-sm" type="button" onclick="g34LiRewriteAll(\'' + esc(id) + '\',\'' + kind + '\')">' + SP_ICON.spark + ' Rewrite all with SAM</button>' : '') + '</div>' +
    '<div class="g19-seg g23-lf">' + chip('all', 'All') + chip('todo', 'To write') + chip('sent', 'Sent') + chip('removed', 'Taken out') + '</div>';
  var rows = ppl.map(function (p) {
    var txt = kind === 'invite' ? p.note : p.message, st = _g23StepTxt(p, kind);
    var can = kind === 'invite' ? p.can_edit_note : p.can_edit_message;
    var step = kind === 'invite' ? p.invite : p.message_step, removed = step && step.status === 'removed';
    var editing = L.editing === p.id + ':' + kind;
    var body = editing
      ? '<textarea class="g23-ta" id="g23Ta_' + esc(p.id) + '" rows="' + (kind === 'invite' ? 3 : 5) + '" oninput="var n=this.value.length,c=document.getElementById(\'g23Cc_' + esc(p.id) + '\');c.textContent=n+\' / ' + lim + '\';c.classList.toggle(\'over\',n>' + lim + ')">' + esc(txt) + '</textarea>' +
        '<div class="g23-ea"><span class="g23-cc' + (txt.length > lim ? ' over' : '') + '" id="g23Cc_' + esc(p.id) + '">' + txt.length + ' / ' + lim + '</span><span class="g23-sp"></span><button class="g-btn sp-sm" type="button" onclick="window._g23Li[\'' + esc(id) + '\'].editing=null;g23RenderLi(\'' + esc(id) + '\')">Cancel</button><button class="g-btn sp-sm sp-gold" type="button" onclick="g23LiSave(\'' + esc(id) + '\',\'' + esc(p.id) + '\',\'' + kind + '\',this)">Save</button></div>'
      : txt ? '<div class="g23-tx">' + esc(txt) + '</div><div class="g23-meta">' + txt.length + ' / ' + lim + (kind === 'invite' && p.note_by ? ' · ' + (p.note_by === 'rep' ? 'edited by you' : 'written by SAM') : '') + '</div>'
      : '<div class="g23-tx none">' + (kind === 'invite' ? 'No note yet.' : p.stage === 'connected' ? 'No message yet.' : 'SAM writes it when they accept.') + '</div>';
    var acts = '';
    if (d.is_owner && !editing) {
      if (removed) acts += '<button class="g23-lk" type="button" onclick="g23LiRemove(\'' + esc(id) + '\',\'' + esc(p.id) + '\',\'' + kind + '\',true)">Put back</button>';
      else if (can) {
        acts += '<button class="g23-lk" type="button" onclick="window._g23Li[\'' + esc(id) + '\'].editing=\'' + esc(p.id) + ':' + kind + '\';g23RenderLi(\'' + esc(id) + '\');setTimeout(function(){var t=document.getElementById(\'g23Ta_' + esc(p.id) + '\');if(t){t.focus();t.setSelectionRange(t.value.length,t.value.length)}},30)">' + G23_ICON.pen + (txt ? 'Edit' : 'Write') + '</button>';
        if (kind === 'invite' || p.stage === 'connected') acts += '<button class="g23-lk" type="button" onclick="g23LiRewrite(\'' + esc(id) + '\',\'' + esc(p.id) + '\',\'' + kind + '\')">' + SP_ICON.spark + (txt ? 'Rewrite with SAM' : 'Write with SAM') + '</button>';
        acts += '<button class="g23-lk dim" type="button" onclick="g23LiRemove(\'' + esc(id) + '\',\'' + esc(p.id) + '\',\'' + kind + '\',false)">Take out of LinkedIn</button>';
      }
    }
    return '<li class="g23-lr' + (removed ? ' removed' : '') + '"><span class="sp-av">' + esc(_spIni(p.name)) + '</span><div class="g23-lm">' +
      '<div class="g23-lt1"><b>' + esc(p.name || 'Unnamed') + '</b><span class="sp-small">' + esc([p.title, p.company].filter(Boolean).join(' · ')) + '</span>' +
      '<a class="sd-li" href="' + esc(p.linkedin_url) + '" target="_blank" rel="noopener" aria-label="Open LinkedIn profile">in</a><span class="sp-chip ' + st[1] + ' g23-st">' + esc(st[0]) + '</span></div>' +
      body + (acts ? '<div class="g23-la">' + acts + '</div>' : '') + '</div></li>';
  }).join('');
  host.innerHTML = head + (rows ? '<ul class="g23-ll">' + rows + '</ul>' : '<div class="sp-empty" style="padding:22px 8px">' + (L.filter === 'removed' ? 'Nobody taken out.' : L.filter === 'todo' ? 'Nothing to write.' : kind === 'message' ? 'No messages yet. SAM writes them as people accept your invites.' : 'Nobody with a LinkedIn profile yet.') + '</div>');
}
async function g23LiSave(id, cid, kind, btn) {
  var ta = document.getElementById('g23Ta_' + cid); if (!ta) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  var d = await _sampEdge('save_sampaign_linkedin_text', { campaign_id: id, contact_id: cid, kind: kind, text: ta.value });
  if (!d.ok) { showToast(d.error || 'Could not save'); if (btn) { btn.disabled = false; btn.textContent = 'Save'; } return; }
  window._g23Li[id].editing = null;
  showToast(kind === 'invite' ? 'Note saved. The plugin sends this one.' : 'Message saved. The plugin sends this one.');
  await _g23LiLoad(id, true); g23RenderLi(id);
}
async function g23LiRemove(id, cid, kind, restore) {
  var d = await _sampEdge('remove_sampaign_linkedin_step', { campaign_id: id, contact_id: cid, kind: kind === 'message' ? 'message' : 'all', restore: !!restore });
  if (!d.ok) { showToast(d.error || 'Could not change this'); return; }
  showToast(restore ? 'Back in. SAM lines up their LinkedIn steps again.' : 'Taken out of LinkedIn. Emails carry on.');
  await _g23LiLoad(id, true); g23RenderLi(id);
  try { _sampLoadOverview(id); } catch (e) {}
}
function g23LiRewrite(id, cid, kind) {
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'g23RwM';
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Rewrite with SAM"><h3>Rewrite with SAM</h3>' +
    '<label class="sp-fld">What should change? <small>optional</small><input id="g23RwIn" placeholder="Shorter, mention their new role"></label>' +
    '<div class="sp-chips" style="margin-top:10px">' + ['Shorter', 'Warmer', 'More specific to their role', 'No question at the end'].map(function (x) { return '<button type="button" class="sp-chip g18-sug" onclick="document.getElementById(\'g23RwIn\').value=\'' + x + '\'">' + x + '</button>'; }).join('') + '</div>' +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'g23RwM\').remove()">Cancel</button><button class="g-btn sp-gold" type="button" id="g23RwGo">' + SP_ICON.spark + ' Rewrite</button></div></div>';
  document.body.appendChild(m);
  var inp = document.getElementById('g23RwIn'); inp.focus();
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('g23RwGo').click(); });
  document.getElementById('g23RwGo').onclick = async function () {
    this.disabled = true; this.textContent = 'SAM is writing…';
    var d = await _sampEdge('write_linkedin_notes', { campaign_id: id, kind: kind, contact_ids: [cid], instruction: inp.value || 'a better version' });
    m.remove();
    if (!d.ok) { showToast(d.error || 'SAM could not rewrite this'); return; }
    showToast(d.written ? 'Rewritten. Have a look.' : 'Nothing to rewrite here.');
    await _g23LiLoad(id, true); g23RenderLi(id);
  };
}
async function g23LiWriteAll(id, kind) { await spLiWrite(id, kind); await _g23LiLoad(id, true); g23RenderLi(id); try { _sampLoadOverview(id); } catch (e) {} }

// ── A phone number on click ─────────────────────────────────────────────────
function _g23PhoneHtml(id, p, can) {
  if (p.phone) {
    var digits = String(p.phone).replace(/[^\d+]/g, '');
    if (p.phone_dnc) return '<span class="g23-ph"><span class="sp-chip risk" title="Marked do not call by the data provider">Do not call</span><span class="g23-pn">' + esc(p.phone) + '</span></span>';
    return '<span class="g23-ph"><a class="g23-pn" href="tel:' + esc(digits) + '" title="Call">' + G23_ICON.phone + esc(p.phone) + '</a>' +
      '<a class="g23-pi" href="https://wa.me/' + esc(digits.replace(/^\+/, '')) + '" target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp">' + G23_ICON.wa + '</a>' +
      '<button class="g23-pi" type="button" title="Copy" aria-label="Copy number" onclick="event.stopPropagation();g23Copy(\'' + esc(p.phone) + '\')">' + G23_ICON.copy + '</button></span>';
  }
  return can ? '<button class="g23-gp" type="button" onclick="event.stopPropagation();g23GetPhone(\'' + esc(id) + '\',\'' + esc(p.id || p.contact_id) + '\',this)">' + G23_ICON.phone + 'Get phone</button>' : '';
}
function g23Copy(v) { try { navigator.clipboard.writeText(v); showToast('Copied ' + v); } catch (e) { showToast(v); } }
async function g23GetPhone(id, cid, btn) {
  var people = ((window._spPeople || {})[id] || {}).people || [];
  var p = people.find(function (x) { return x.id === cid; }) || {};
  var first = String(p.name || 'them').split(' ')[0];
  if (btn) { btn.disabled = true; btn.innerHTML = G23_ICON.phone + 'Checking…'; }
  var peek = await _sampEdge('panel_reveal_contact', { contact_id: cid, peek: true });
  if (btn) { btn.disabled = false; btn.innerHTML = G23_ICON.phone + 'Get phone'; }
  if (peek.ok && peek.revealed) { _g23PhoneDone(id, cid, peek, first); return; }
  if (!peek.ok) { showToast(peek.error || 'Phone numbers are not available right now'); return; }
  var stt = peek.state || {};
  if (stt.already) { await _g23Reveal(id, cid, first, btn); return; }
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'g23PhM';
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  var left = stt.left_today;
  m.innerHTML = '<div class="sp-mcard g23-pc" role="dialog" aria-modal="true" aria-label="Get phone number"><div class="g23-pch"><span class="g23-pci">' + G23_ICON.phone + '</span><div><h3 style="margin:0">Get ' + esc(first) + '’s phone number?</h3>' +
    '<div class="sp-small">' + esc([p.title, p.company].filter(Boolean).join(' · ')) + '</div></div></div>' +
    '<p class="sp-muted" style="margin:12px 0 0">This uses <b>1 credit</b> from your data provider. Samora keeps the number for your whole team, so nobody pays for ' + esc(first) + ' again.' + (left !== undefined && left !== null ? ' You have <b>' + left + '</b> left today.' : '') + '</p>' +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'g23PhM\').remove()">Cancel</button><button class="g-btn sp-gold" type="button" id="g23PhGo"' + (left === 0 ? ' disabled' : '') + '>' + G23_ICON.phone + ' Get phone, 1 credit</button></div></div>';
  document.body.appendChild(m);
  document.getElementById('g23PhGo').onclick = async function () { this.disabled = true; this.textContent = 'Getting it…'; await _g23Reveal(id, cid, first, null); m.remove(); };
}
async function _g23Reveal(id, cid, first, btn) {
  if (btn) { btn.disabled = true; btn.innerHTML = G23_ICON.phone + 'Getting it…'; }
  var d = await _sampEdge('panel_reveal_contact', { contact_id: cid });
  if (!d.ok) { showToast(d.error || 'Could not get the number'); if (btn) { btn.disabled = false; btn.innerHTML = G23_ICON.phone + 'Get phone'; } return; }
  _g23PhoneDone(id, cid, d, first);
}
function _g23PhoneDone(id, cid, d, first) {
  var ph = (d.phones || [])[0];
  if (!ph) { showToast(d.paid ? 'No phone number on record for ' + first + '. SAM found an email instead.' : 'No phone number found for ' + first + '. No credit was used.'); return; }
  var people = ((window._spPeople || {})[id] || {}).people || [];
  var p = people.find(function (x) { return x.id === cid; });
  if (p) { p.phone = ph.value; p.phone_dnc = /do not call/i.test(String(ph.note || '')); }
  showToast(p && p.phone_dnc ? first + '’s number is marked do not call.' : (d.cached || !d.paid ? 'Samora already had ' + first + '’s number.' : 'Got ' + first + '’s number. Saved for your team.'));
  try { _spPaintPeople(id); } catch (e) {}
}

// ════════════════════════════════════════════════════════════════════════════
// Drop J (2026-10-15): Today rebuilt around one list, Let SAM handle, the
// LinkedIn chart on the sequence page, and SAM-TAM that shows earlier finds.
// ════════════════════════════════════════════════════════════════════════════
var G24_ICON = {
  spark: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/></svg>',
  away: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 108.5 8.5"/><path d="M12 7.5V12l3 2"/><path d="M17 3.5h4v4"/></svg>',
  risk: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8.5v4.5M12 16.5v.1"/><path d="M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg>',
  reply: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  mail: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/></svg>',
  li: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M8 10.5V16M8 7.8v.1M11.5 16v-3.2a2.3 2.3 0 014.6 0V16M11.5 10.5V16"/></svg>'
};
window._g24 = window._g24 || { st: {}, open: {}, meet: null, meetDay: null, ownOpen: false };
function _g24Pl(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function _g24IsToday() { try { return typeof viewDate === 'undefined' || !viewDate || viewDate === todayKey(); } catch (e) { return true; } }
function _g24FirstName() {
  try {
    var n = (currentUser && currentUser.user_metadata && (currentUser.user_metadata.full_name || currentUser.user_metadata.name)) || '';
    n = String(n).trim().split(/\s+/)[0] || '';
    if (!n && currentUser && currentUser.email) n = String(currentUser.email).split('@')[0].split(/[._-]/)[0];
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
  } catch (e) { return ''; }
}
function _g24Day(d) { try { return new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return String(d || ''); } }

// ── What is on the day ──────────────────────────────────────────────────────
// SAMpaign tasks (from get_sampaign_tasks) and the rep's own tasks, read as
// one list. Each SAMpaign task SAM can take on carries `sam`.
function _g24Items() {
  var d = window._tds && window._tds.data, out = [];
  if (d && _g24IsToday()) (d.campaigns || []).forEach(function (c) {
    (c.tasks || []).forEach(function (t) {
      if (t.key === 'clear') return;
      out.push({ key: c.id + ':' + t.key, c: c, t: t, tone: t.tone, sam: t.sam || null });
    });
  });
  return out;
}
function _g24OwnOoo() {
  var out = [];
  try { (dayData(viewDate).tasks || []).forEach(function (t, i) { if (t && t.oooContactEmail && !t.done && !t.carriedTo && !t.samHandled) out.push({ i: i, t: t }); }); } catch (e) {}
  return out;
}
function _g24Counts() {
  var it = _g24Items(), own = [];
  try { own = (dayData(viewDate).tasks || []).filter(function (t) { return t && !t.done && !t.carriedTo; }); } catch (e) {}
  var samN = it.filter(function (x) { return x.sam && !x.sam.manual && (x.tone === 'do' || x.tone === 'risk') && !(window._g24.st[x.key] && window._g24.st[x.key].phase === 'done'); }).length + _g24OwnOoo().length;
  var needs = it.filter(function (x) { return x.tone === 'do' || x.tone === 'risk'; }).length + own.length;
  var replies = it.filter(function (x) { return /replies$/.test(x.t.key); }).reduce(function (a, x) { return a + (x.t.count || 0); }, 0);
  var meet = (window._g24.meet || []).length;
  return { needs: needs, sam: samN, replies: replies, meet: meet, risk: it.filter(function (x) { return x.tone === 'risk'; }).length, own: own.length };
}

// ── The SAM line at the top ─────────────────────────────────────────────────
function g24RenderBrief() {
  var el = document.getElementById('g24Brief'); if (!el) return;
  if (!_g24IsToday()) {
    var dd = ''; try { dd = _g24Day(viewDate); } catch (e) {}
    el.innerHTML = '<div class="g24-bf other"><div class="g24-bt"><b>' + esc(dd) + '</b><span>' + (viewDate > todayKey() ? 'Planning ahead. Tasks you add here show up on the day.' : 'Looking back. What you did and what slipped.') + '</span></div><button class="g24-btn ghost" type="button" onclick="gotoDate(todayKey())">Back to today</button></div>';
    return;
  }
  var k = _g24Counts();
  var bits = [];
  if (k.replies) bits.push('<span class="g24-st">' + G24_ICON.reply + _g24Pl(k.replies, 'reply', 'replies') + ' to answer</span>');
  if (k.meet) bits.push('<span class="g24-st">' + G24_ICON.cal + _g24Pl(k.meet, 'meeting') + '</span>');
  if (k.risk) bits.push('<span class="g24-st risk">' + G24_ICON.risk + k.risk + ' at risk</span>');
  if (k.own) bits.push('<span class="g24-st">' + G24_ICON.check + _g24Pl(k.own, 'task') + ' of yours</span>');
  var line = !window._tds.data && !window._g24.loadedOnce
    ? 'Reading your SAMpaigns, inbox and calendar…'
    : k.needs
      ? '<b>' + _g24Pl(k.needs, 'thing needs', 'things need') + ' you today.</b> ' + (k.sam ? 'SAM can take <b>' + k.sam + '</b> of them. Nothing sends until you approve.' : 'Start at the top.')
      : '<b>You are clear for now.</b> Nothing needs you. Add a task below, or start a SAMpaign.';
  el.innerHTML = '<div class="g24-bf"><span class="g24-sam" aria-hidden="true">S</span><div class="g24-bt"><div class="g24-bl">' + line + '</div>' + (bits.length ? '<div class="g24-sts">' + bits.join('') + '</div>' : '') + '</div>' +
    (k.sam ? '<button class="g24-btn gold" type="button" id="g24TakeAll" onclick="g24HandleAll()">' + G24_ICON.spark + 'Let SAM take ' + k.sam + '</button>' : '') + '</div>';
}

// ── The list: needs you, SAM can do these, running on its own ──────────────
function _g24Ch(t) { return t.channel === 'linkedin' ? 'li' : t.channel === 'email' ? 'mail' : 'all'; }
function _g24RowIcon(x) {
  if (x.tone === 'risk') return '<span class="g24-ic risk">' + G24_ICON.risk + '</span>';
  if (/replies$/.test(x.t.key)) return '<span class="g24-ic reply">' + G24_ICON.reply + '</span>';
  var ch = _g24Ch(x.t);
  return '<span class="g24-ic ' + ch + '">' + (ch === 'li' ? G24_ICON.li : ch === 'mail' ? G24_ICON.mail : G24_ICON.spark) + '</span>';
}
function _g24SamLabel(x) {
  var s = x.sam || {};
  if (s.do === 'write') return 'Let SAM write ' + (x.t.count ? x.t.count : 'them');
  if (s.do === 'review') return 'Review and approve';
  if (s.do === 'li_write') return 'Let SAM write ' + (x.t.count || '') + (s.kind === 'invite' ? ' notes' : ' messages');
  if (s.do === 'retry') return 'Let SAM send again';
  return 'Let SAM handle';
}
function _g24Row(x) {
  var st = window._g24.st[x.key] || null;
  var acts = '';
  if (st && st.phase === 'working') acts = '<span class="g24-wk"><span class="g24-spin" aria-hidden="true"></span>' + esc(st.msg || 'SAM is on it…') + '</span>';
  else if (st && st.phase === 'ready') acts = '<button class="g24-btn gold sm" type="button" onclick="g24ReviewKey(\'' + esc(x.key) + '\')">' + esc(st.cta || 'Review and approve') + '</button>';
  else if (st && st.phase === 'done') acts = '<span class="g24-done">' + G24_ICON.check + esc(st.msg || 'Done') + '</span>' + (st.link ? '<button class="g24-lk" type="button" onclick="' + st.link + '">' + esc(st.linkLabel || 'See it') + '</button>' : '');
  else {
    if (x.sam && (x.tone === 'do' || x.tone === 'risk')) acts += '<button class="g24-btn gold sm" type="button" onclick="g24Handle(\'' + esc(x.key) + '\')">' + G24_ICON.spark + esc(_g24SamLabel(x)) + '</button>';
    acts += _tdsAct(x.t, x.c).replace('class="tds-a"', 'class="g24-btn ghost sm"');
  }
  var err = st && st.phase === 'error' ? '<div class="g24-err">' + esc(st.msg) + '</div>' : '';
  var bar = x.t.total ? '<span class="g24-bar" aria-hidden="true"><i style="width:' + Math.round((x.t.done || 0) / x.t.total * 100) + '%"></i></span>' : '';
  return '<li class="g24-row ' + esc(x.tone) + (st ? ' s-' + st.phase : '') + '" data-key="' + esc(x.key) + '">' + _g24RowIcon(x) +
    '<div class="g24-rmain"><div class="g24-rt">' + esc(x.t.text) + '</div>' + bar +
    '<div class="g24-rs"><button class="g24-cn" type="button" onclick="tdsGo(\'sampaign\',\'' + esc(x.c.id) + '\',\'overview\')">' + esc(x.c.name) + '</button>' + (x.tone === 'risk' ? '<span class="g24-tag risk">At risk</span>' : '') + '</div>' + err + '</div>' +
    '<div class="g24-ra">' + acts + '</div></li>';
}
function g24RenderFeed() {
  var el = document.getElementById('g24Feed'); if (!el) return;
  if (typeof todayActiveSection !== 'undefined' && todayActiveSection !== 'tasks') { el.innerHTML = ''; return; }
  if (!_g24IsToday()) { el.innerHTML = ''; return; }
  var it = _g24Items();
  if (!window._tds.data) { el.innerHTML = '<div class="g24-sk"><i></i><i style="width:72%"></i><i style="width:56%"></i></div>'; return; }
  var rank = { risk: 0, do: 1 };
  var act = it.filter(function (x) { return x.tone === 'risk' || x.tone === 'do'; });
  var needs = act.filter(function (x) { return !x.sam; }).sort(function (a, b) { return rank[a.tone] - rank[b.tone]; });
  var sam = act.filter(function (x) { return !!x.sam; }).sort(function (a, b) { return rank[a.tone] - rank[b.tone]; });
  var calm = it.filter(function (x) { return x.tone === 'wait' || x.tone === 'done'; });
  var html = '';
  if (needs.length) html += '<div class="g24-gh"><span>Needs you</span><b>' + needs.length + '</b></div><ul class="g24-list">' + needs.map(_g24Row).join('') + '</ul>';
  if (sam.length) html += '<div class="g24-gh sam"><span>' + G24_ICON.spark + 'SAM can do these</span><b>' + sam.length + '</b><small>You approve before anything sends</small></div><ul class="g24-list">' + sam.map(_g24Row).join('') + '</ul>';
  if (calm.length) {
    var op = !!window._g24.open.calm;
    html += '<button class="g24-gh calm" type="button" aria-expanded="' + op + '" onclick="window._g24.open.calm=!window._g24.open.calm;g24RenderFeed()"><span>Running on its own</span><b>' + calm.length + '</b><i class="g24-cv' + (op ? ' on' : '') + '">' + G24_ICON.chev + '</i></button>' +
      (op ? '<ul class="g24-list calm">' + calm.map(_g24Row).join('') + '</ul>' : '');
  }
  el.innerHTML = html;
}
function g24RenderAll() { try { g24RenderBrief(); } catch (e) {} try { g24RenderFeed(); } catch (e) {} try { g24RenderSched(); } catch (e) {} try { _g24OwnHead(); } catch (e) {} }
function _g24OwnHead() {
  var h = document.querySelector('#today-tasks-section .today-sec-title'); if (!h) return;
  if (!h.dataset.g24) { h.dataset.g24 = '1'; h.innerHTML = 'Your tasks'; }
}

// ── Today's schedule (rail) ────────────────────────────────────────────────
var _g24CalP = null, _g24CalDay = null;
function _g24Cal(day) {
  if (_g24CalP && _g24CalDay === day) return _g24CalP;
  _g24CalDay = day;
  _g24CalP = fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'get_calendar_tasks', date: day, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }) })
    .then(function (r) { return r.json(); }).catch(function () { return { ok: false }; });
  return _g24CalP;
}
async function g24LoadSched() {
  if (typeof currentUser === 'undefined' || !currentUser || !currentUser.token) return;
  var day = todayKey();
  if (window._g24.meetDay === day && window._g24.meet) { g24RenderSched(); return; }
  var d = await _g24Cal(day);
  window._g24.meetDay = day;
  window._g24.meet = d && d.ok ? (d.tasks || []) : [];
  window._g24.meetOk = !!(d && d.ok);
  g24RenderSched(); g24RenderBrief();
}
function g24RenderSched() {
  var el = document.getElementById('g24Sched'); if (!el) return;
  if (!_g24IsToday()) { el.innerHTML = ''; el.hidden = true; return; }
  el.hidden = false;
  var m = window._g24.meet;
  var have = [];
  try { have = (dayData(todayKey()).tasks || []).map(function (t) { return String(t.calendarEventId || ''); }); } catch (e) {}
  var body;
  if (m === null) body = '<div class="g24-sk sm"><i></i><i style="width:60%"></i></div>';
  else if (!m.length) body = '<div class="g24-empty">' + (window._g24.meetOk === false ? 'Connect your calendar in You to see meetings here.' : 'No meetings today. Good day for outreach.') + '</div>';
  else body = '<ul class="g24-sl">' + m.map(function (x, i) {
    var added = x.calendar_event_id && have.indexOf(String(x.calendar_event_id)) !== -1;
    return '<li><span class="g24-tm">' + esc(x.time || '') + '</span><div class="g24-sm"><b>' + esc(x.title || 'Meeting') + '</b>' + (x.account_name ? '<small>' + esc(x.account_name) + '</small>' : '') + '</div>' +
      (added ? '<span class="g24-in" title="On your task list">' + G24_ICON.check + '</span>' : '<button class="g24-add" type="button" aria-label="Add ' + esc(x.title || 'meeting') + ' to your tasks" title="Add to your tasks" onclick="g24AddMeet(' + i + ')">' + G24_ICON.plus + '</button>') + '</li>';
  }).join('') + '</ul>';
  el.innerHTML = '<div class="g24-rh"><span>' + G24_ICON.cal + 'Today’s schedule</span>' + (m && m.length ? '<b>' + m.length + '</b>' : '') + '</div>' + body;
}
function g24AddMeet(i) {
  var t = (window._g24.meet || [])[i]; if (!t) return;
  var d = dayData(todayKey());
  d.tasks.push({ text: t.text, done: false, priority: false, source: 'calendar', calendarEventId: t.calendar_event_id || null, account: t.account_name || null, completionNote: (typeof stripMeetingBoilerplate === 'function' ? stripMeetingBoilerplate(t.agenda) : '') || null });
  save(todayKey()); render();
  showToast('Added to your tasks');
}

// ── Let SAM handle ─────────────────────────────────────────────────────────
function _g24Set(key, st) { window._g24.st[key] = st; g24RenderFeed(); g24RenderBrief(); }
function _g24Find(key) { return _g24Items().find(function (x) { return x.key === key; }) || null; }
function _g24Wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function _g24WriteWave(cId, launch, onMsg, extra) {
  var written = 0, skip = [], paced = 0, total = null;
  var name = (currentUser && currentUser.user_metadata && currentUser.user_metadata.full_name) || '';
  var s1 = await _s1Write({ action: 'write_sampaign_drafts', base: Object.assign({ campaign_id: cId, launch: launch, sender_name: name.split(' ')[0] || '', sender_full_name: name }, extra || {}), chunk: 4, conc: 3, onProgress: function (st) { onMsg('Written ' + st.written + ' of ' + st.total + '…'); }, onPace: function () { onMsg('SAM is pacing itself, back in a moment…'); } });
  if (s1) return s1.err && !s1.written ? { ok: false, written: 0, error: s1.err } : { ok: true, written: s1.written };
  for (var i = 0; i < 40; i++) {
    var d = await _sampEdge('write_sampaign_drafts', Object.assign({ campaign_id: cId, launch: launch, batch: 6, skip_ids: skip, sender_name: name.split(' ')[0] || '', sender_full_name: name }, extra || {}));
    if (!d.ok) {
      if ((d.reason === 'quota' && !d.daily) || d.reason === 'overloaded') { if (paced++ < 6) { onMsg('SAM is pacing itself, back in a moment…'); await _g24Wait(Math.min(45, d.retry_after || 20) * 1000); continue; } }
      return { ok: false, written: written, error: d.error || 'SAM could not write these.' };
    }
    written += d.written || 0; (d.missed || []).forEach(function (x) { skip.push(x); });
    if (total === null) total = written + (d.remaining || 0);
    onMsg('Written ' + written + (total ? ' of ' + total : '') + '…');
    if (!d.remaining || (!d.written && !(d.missed || []).length)) break;
  }
  return { ok: true, written: written };
}
async function _g24WriteLi(cId, kind, onMsg) {
  var written = 0, skip = [], paced = 0;
  var s1 = await _s1Write({ action: 'write_linkedin_notes', base: { campaign_id: cId, kind: kind }, chunk: 6, conc: 3, onProgress: function (st) { onMsg((st.written + st.held) + ' of ' + st.total + ' written…'); }, onPace: function () { onMsg('SAM is pacing itself, back in a moment…'); } });
  if (s1) return s1.err && !s1.written ? { ok: false, written: 0, error: s1.err } : { ok: true, written: s1.written };
  for (var i = 0; i < 40; i++) {
    var r = await _sampEdge('write_linkedin_notes', { campaign_id: cId, kind: kind, batch: 12, skip_ids: skip });
    if (!r.ok) {
      if ((r.reason === 'quota' && !r.daily) || r.reason === 'overloaded') { if (paced++ < 6) { onMsg('SAM is pacing itself, back in a moment…'); await _g24Wait(Math.min(45, r.retry_after || 20) * 1000); continue; } }
      return { ok: false, written: written, error: r.error || 'SAM could not write these.' };
    }
    written += r.written || 0; skip = skip.concat(r.missed || []);
    onMsg(written + ' written…');
    if (!r.remaining || (!r.written && !(r.missed || []).length)) break;
  }
  return { ok: true, written: written };
}
// One task. quiet: part of "Let SAM take all", so no review sheet of its own.
async function g24Handle(key, quiet) {
  var x = _g24Find(key); if (!x || !x.sam) return null;
  var c = x.c, s = x.sam, msg = function (m) { _g24Set(key, { phase: 'working', msg: m }); };
  msg('SAM is on it…');
  if (s.do === 'write') {
    var r = await _g24WriteWave(c.id, s.launch, msg);
    if (!r.ok && !r.written) { _g24Set(key, { phase: 'error', msg: r.error }); return null; }
    var grp = { campaign_id: c.id, campaign_name: c.name, launch: s.launch };
    _g24Set(key, { phase: 'ready', msg: 'SAM wrote ' + _g24Pl(r.written, 'email'), cta: 'Review ' + r.written + ' and approve', groups: [grp] });
    if (!quiet) g24Review([grp], key);
    return grp;
  }
  if (s.do === 'review') {
    var g2 = { campaign_id: c.id, campaign_name: c.name, launch: s.launch };
    _g24Set(key, { phase: 'ready', cta: 'Review and approve', groups: [g2] });
    if (!quiet) g24Review([g2], key);
    return g2;
  }
  if (s.do === 'li_write') {
    var r2 = await _g24WriteLi(c.id, s.kind, msg);
    if (!r2.ok && !r2.written) { _g24Set(key, { phase: 'error', msg: r2.error }); return null; }
    _g24Set(key, { phase: 'done', msg: 'SAM wrote ' + r2.written + (s.kind === 'invite' ? ' invite notes' : ' messages') + '. They go out from the plugin on their days.', link: 'g24OpenLi(\'' + esc(c.id) + '\',\'' + (s.kind === 'invite' ? 'li_invite' : 'li_message') + '\')', linkLabel: 'Read them' });
    try { tdSampLoad(true); } catch (e) {}
    return { li: r2.written, kind: s.kind, campaign_id: c.id, campaign_name: c.name };
  }
  if (s.do === 'retry') {
    var d = await _sampEdge('retry_failed_sends', { campaign_id: c.id });
    if (!d.ok && d.needs_reconnect) { _g24Set(key, { phase: 'error', msg: d.error || 'Reconnect your mailbox first.' }); try { _spReconnectModal(c.id, null, d); } catch (e) {} return null; }
    if (!d.ok) { _g24Set(key, { phase: 'error', msg: d.error || 'SAM could not do that.' }); return null; }
    if (!d.drafts) { _g24Set(key, { phase: 'done', msg: d.cancelled ? 'Nothing to send: they replied or bounced meanwhile.' : 'Nothing to send again.' }); return null; }
    var g3 = { campaign_id: c.id, campaign_name: c.name, launch: d.launch };
    _g24Set(key, { phase: 'ready', msg: _g24Pl(d.drafts, 'email') + ' ready to go again', cta: 'Pick when they go', groups: [g3] });
    if (!quiet) g24Review([g3], key);
    return g3;
  }
  return null;
}
function g24ReviewKey(key) { var st = window._g24.st[key]; if (st && st.groups) g24Review(st.groups, key); }
function g24OpenLi(id, tab) {
  try { switchTab('sampaign'); } catch (e) {}
  setTimeout(function () { openSampaignDetail(id, 'sequence'); setTimeout(function () { try { setSampLaunch(id, tab); var q = document.getElementById('sampSendQueue'); if (q) q.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }, 900); }, 350);
}

// Away messages: on the task itself.
async function g24HandleOoo(i, quiet) {
  var day = viewDate, t = (dayData(day).tasks || [])[i];
  if (!t || !t.oooContactEmail) return null;
  var key = 'ooo:' + day + ':' + i;
  var set = function (st) { window._g24.st[key] = st; setTimeout(function () { try { renderToday(); } catch (e) {} }, 0); };
  set({ phase: 'working', msg: 'SAM is writing to ' + (_g24OooName(t) || 'them') + '…' });
  var p = await _sampEdge('sam_handle_ooo', { contact_email: t.oooContactEmail, contact_name: _g24OooName(t), return_date: t.oooReturnDate || null, task_date: day, msg_id: t.oooMsgId || null });
  if (!p.ok) { set({ phase: 'error', msg: p.error || 'SAM could not do this one.' }); return null; }
  var grp = { campaign_id: p.campaign_id, campaign_name: p.campaign_name, launch: p.launch, contact_ids: [p.contact_id], start_at: p.start_at, send_day: p.send_day, ooo: { day: day, i: i, name: _g24OooName(t) } };
  if (p.existing) {
    if (p.existing.status === 'pending') { _g24MarkOoo(day, i, { campaign_id: p.campaign_id, send_at: p.existing.send_at, state: 'scheduled' }); set({ phase: 'done', msg: 'Already scheduled for ' + _g24Day(p.existing.send_at) }); return null; }
    set({ phase: 'ready', cta: 'Review the email', groups: [grp] });
    if (!quiet) g24Review([grp], key);
    return grp;
  }
  var w = await _g24WriteWave(p.campaign_id, p.launch, function (m) { set({ phase: 'working', msg: m }); }, { contact_ids: [p.contact_id], instruction: p.instruction, batch: 1 });
  if (!w.ok || !w.written) { set({ phase: 'error', msg: (w && w.error) || 'SAM could not write this one.' }); return null; }
  set({ phase: 'ready', cta: 'Review the email', groups: [grp] });
  if (!quiet) g24Review([grp], key);
  return grp;
}
function _g24OooName(t) {
  var m = String(t.oooFrom || '').replace(/<[^>]*>/g, '').replace(/["']/g, '').trim();
  if (m && m.indexOf('@') === -1) return m;
  var mt = String(t.text || '').match(/^From OOO Mail: (.+?) back from leave/);
  return mt ? mt[1] : '';
}
function _g24MarkOoo(day, i, info) {
  var t = (dayData(day).tasks || [])[i]; if (!t) return;
  t.samHandled = Object.assign({ at: new Date().toISOString() }, info);
  if (!t.done) {
    t.done = true;
    try { t.completedAt = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); } catch (e) {}
    t.completionNote = 'SAM scheduled a welcome back email' + (info.send_at ? ' for ' + _g24Day(info.send_at) : '') + '.';
  }
  try { save(day); } catch (e) {}
}
function _g24OooHtml(item, i) {
  if (!item || !item.oooContactEmail || item.carriedTo) return '';
  var key = 'ooo:' + viewDate + ':' + i, st = window._g24.st[key];
  if (item.samHandled) return '<div class="g24-oo done">' + G24_ICON.check + 'SAM scheduled a welcome back email' + (item.samHandled.send_at ? ' for ' + esc(_g24Day(item.samHandled.send_at)) : '') + '.</div>';
  if (item.done) return '';
  if (st && st.phase === 'working') return '<div class="g24-oo"><span class="g24-spin" aria-hidden="true"></span>' + esc(st.msg) + '</div>';
  if (st && st.phase === 'ready') return '<div class="g24-oo"><button class="g24-btn gold sm" type="button" onpointerdown="event.stopPropagation()" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()" onclick="event.stopPropagation();g24ReviewKey(\'' + esc(key) + '\')">Review the email</button></div>';
  if (st && st.phase === 'done') return '<div class="g24-oo done">' + G24_ICON.check + esc(st.msg) + '</div>';
  return '<div class="g24-oo">' + (st && st.phase === 'error' ? '<span class="g24-err">' + esc(st.msg) + '</span>' : '') +
    '<button class="g24-btn gold sm" type="button" onpointerdown="event.stopPropagation()" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()" onclick="event.stopPropagation();g24HandleOoo(' + i + ')">' + G24_ICON.spark + 'Let SAM handle this</button><span class="g24-hint">SAM writes a welcome back email for the day they return. You approve it.</span></div>';
}

// "Let SAM take all": every task SAM can do, then one review.
async function g24HandleAll() {
  if (window._g24.allBusy) return;
  window._g24.allBusy = true;
  var btn = document.getElementById('g24TakeAll'); if (btn) { btn.disabled = true; btn.innerHTML = '<span class="g24-spin" aria-hidden="true"></span>SAM is working…'; }
  var items = _g24Items().filter(function (x) { return x.sam && !x.sam.manual && (x.tone === 'do' || x.tone === 'risk') && !(window._g24.st[x.key] && ['done', 'ready'].indexOf(window._g24.st[x.key].phase) !== -1); });
  var ooo = _g24OwnOoo();
  var groups = [], li = [];
  for (var a = 0; a < items.length; a++) { var r = await g24Handle(items[a].key, true); if (r && r.li !== undefined) li.push(r); else if (r) groups.push(r); }
  for (var b = 0; b < ooo.length; b++) { var r2 = await g24HandleOoo(ooo[b].i, true); if (r2) groups.push(r2); }
  // Already ready from an earlier click.
  Object.keys(window._g24.st).forEach(function (k) { var st = window._g24.st[k]; if (st.phase === 'ready' && st.groups) st.groups.forEach(function (g) { if (!groups.some(function (x) { return x.campaign_id === g.campaign_id && x.launch === g.launch && String(x.contact_ids || '') === String(g.contact_ids || ''); })) groups.push(g); }); });
  window._g24.allBusy = false;
  g24RenderBrief();
  if (groups.length) g24Review(groups, null, li);
  else if (li.length) showToast('SAM wrote ' + li.reduce(function (s, x) { return s + x.li; }, 0) + ' LinkedIn texts. They go out from the plugin.');
  else showToast('Nothing left for SAM to do right now.');
}

// ── Review sheet: read, edit, remove, then approve ─────────────────────────
async function g24Review(groups, key, li) {
  var old = document.getElementById('g24Rv'); if (old) old.remove();
  var m = document.createElement('div'); m.className = 'g24-rv'; m.id = 'g24Rv';
  m.innerHTML = '<div class="g24-rvp" role="dialog" aria-modal="true" aria-labelledby="g24RvT"><div class="g24-rvh"><div><h3 id="g24RvT">Review what SAM wrote</h3><div class="g24-rvs">Nothing sends until you approve. Edit anything first.</div></div><button class="g24-x" type="button" aria-label="Close" onclick="g24CloseReview()">' + G24_ICON.x + '</button></div><div class="g24-rvb" id="g24RvB"><div class="g24-sk"><i></i><i style="width:70%"></i><i style="width:50%"></i></div></div><div class="g24-rvf" id="g24RvF"></div></div>';
  m.addEventListener('click', function (e) { if (e.target === m) g24CloseReview(); });
  document.body.appendChild(m);
  document.addEventListener('keydown', _g24Esc);
  requestAnimationFrame(function () { m.classList.add('on'); });
  var R = window._g24.rv = { groups: groups, key: key, li: li || [], rows: {}, open: null };
  var byCamp = {};
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    if (!byCamp[g.campaign_id]) byCamp[g.campaign_id] = await _sampEdge('list_sampaign_scheduled_sends', { campaign_id: g.campaign_id });
    var all = (byCamp[g.campaign_id] && byCamp[g.campaign_id].sends) || [];
    g.rows = all.filter(function (s) { return s.status === 'draft' && Number(s.launch || 1) === Number(g.launch) && (!g.contact_ids || g.contact_ids.indexOf(s.contact_id) !== -1); });
    g.rows.forEach(function (s) { R.rows[s.id] = s; });
    var plan = g.rows.length ? await _sampEdge('schedule_sampaign_drafts', { campaign_id: g.campaign_id, launch: g.launch, contact_ids: g.contact_ids || undefined, start_at: g.start_at || null, dry_run: true }) : null;
    g.plan = plan && plan.ok ? plan : null;
  }
  _g24RvRender();
}
function _g24Esc(e) { if (e.key === 'Escape') g24CloseReview(); }
function g24CloseReview() {
  var m = document.getElementById('g24Rv'); document.removeEventListener('keydown', _g24Esc);
  if (!m) return; m.classList.remove('on'); setTimeout(function () { m.remove(); }, 180);
}
function _g24Plain(html) { var b = document.createElement('div'); b.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<\/p>/gi, ' '); return (b.textContent || '').replace(/\s+/g, ' ').trim(); }
function _g24PlanText(g) {
  var p = g.plan; if (!p || !p.first_send) return '';
  var a = _g24Day(p.first_send), z = _g24Day(p.last_send);
  var t = ''; try { t = new Date(p.first_send).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch (e) {}
  return a === z ? 'Goes out ' + a + (g.rows.length === 1 && t ? ', ' + t : '') : 'Goes out ' + a + ' to ' + z;
}
function _g24RvRender() {
  var R = window._g24.rv, body = document.getElementById('g24RvB'), foot = document.getElementById('g24RvF'); if (!R || !body) return;
  var total = 0;
  var html = R.groups.map(function (g, gi) {
    total += g.rows.length;
    var label = g.ooo ? 'Welcome back' : _spWave(g.launch);
    var head = '<div class="g24-rg"><div><b>' + esc(g.campaign_name || 'SAMpaign') + '</b><span>' + esc(label) + ' · ' + _g24Pl(g.rows.length, 'email') + '</span></div><small>' + esc(_g24PlanText(g)) + '</small></div>';
    if (!g.rows.length) return head + '<div class="g24-empty">Nothing waiting here any more.</div>';
    return head + '<ul class="g24-dl">' + g.rows.map(function (s) {
      var open = R.open === s.id;
      var who = esc(s.contact_name || s.name || (s.contact && s.contact.name) || s.to_email || s.email || '');
      var co = esc(s.contact_company || (s.contact && s.contact.company) || s.company || '');
      if (!open) return '<li class="g24-dr"><button class="g24-drb" type="button" onclick="_g24RvOpen(\'' + esc(s.id) + '\')"><span class="g24-av">' + esc(_spIni(who || '?')) + '</span><span class="g24-drm"><span class="g24-drn"><b>' + who + '</b>' + (co ? '<small>' + co + '</small>' : '') + '</span><span class="g24-drs">' + esc(s.subject || '') + '</span><span class="g24-drp">' + esc(_g24Plain(s.body).slice(0, 150)) + '</span></span></button>' +
        '<button class="g24-rm" type="button" aria-label="Remove the email to ' + who + '" title="Remove" onclick="_g24RvRemove(\'' + esc(s.id) + '\')">' + G24_ICON.x + '</button></li>';
      return '<li class="g24-dr open"><div class="g24-dre"><div class="g24-drn"><span class="g24-av">' + esc(_spIni(who || '?')) + '</span><b>' + who + '</b>' + (co ? '<small>' + co + '</small>' : '') + '</div>' +
        '<label class="g24-fl">Subject<input id="draftSubj_g24_' + esc(s.id) + '" value="' + esc(s.subject || '') + '"></label>' +
        '<div class="g24-fl">Email' + _rtEditor('g24_' + s.id, s.body || '') + '</div>' +
        '<div class="g24-dra"><button class="g24-btn ghost sm" type="button" onclick="_g24RvRemove(\'' + esc(s.id) + '\')">Remove</button><span class="g24-sp"></span><button class="g24-btn ghost sm" type="button" onclick="window._g24.rv.open=null;_g24RvRender()">Cancel</button><button class="g24-btn gold sm" type="button" onclick="_g24RvSave(\'' + esc(s.id) + '\')">Save</button></div></div></li>';
    }).join('') + '</ul>';
  }).join('');
  if (R.li && R.li.length) html = '<div class="g24-linote">' + G24_ICON.li + '<span>SAM also wrote ' + R.li.map(function (x) { return x.li + (x.kind === 'invite' ? ' invite notes' : ' LinkedIn messages') + ' for ' + esc(x.campaign_name); }).join(', ') + '. They go out from the plugin on their days.</span></div>' + html;
  body.innerHTML = html || '<div class="g24-empty">Nothing to review.</div>';
  foot.innerHTML = '<button class="g24-btn ghost" type="button" onclick="g24CloseReview()">Not now</button><span class="g24-sp"></span>' + (total ? '<button class="g24-btn gold" type="button" id="g24RvGo" onclick="g24Approve()">' + G24_ICON.check + 'Approve and schedule ' + total + '</button>' : '');
}
async function _g24RvOpen(id) {
  var R = window._g24.rv; if (R.open && R.open !== id) await _g24RvSave(R.open, true);
  R.open = id; _g24RvRender();
  var el = document.getElementById('draftSubj_g24_' + id); if (el) el.focus();
}
async function _g24RvSave(id, quiet) {
  var R = window._g24.rv, s = R && R.rows[id]; if (!s) return;
  var subjEl = document.getElementById('draftSubj_g24_' + id); if (!subjEl) return;
  var subject = subjEl.value.trim(), body = rtValue('g24_' + id);
  if (!subject || rtIsEmpty(body)) { showToast('Subject and email are both needed'); return; }
  if (subject === String(s.subject || '') && body === String(s.body || '')) { if (!quiet) { R.open = null; _g24RvRender(); } return; }
  var d = await _sampEdge('update_sampaign_scheduled_send', { send_id: id, subject: subject, body: body });
  if (!d.ok) { showToast(d.error || 'Could not save'); return; }
  s.subject = subject; s.body = body;
  if (!quiet) { R.open = null; _g24RvRender(); showToast('Saved'); }
}
async function _g24RvRemove(id) {
  var R = window._g24.rv;
  var d = await _sampEdge('cancel_sampaign_scheduled_send', { send_ids: [id] });
  if (!d.ok) { showToast(d.error || 'Could not remove'); return; }
  R.groups.forEach(function (g) { g.rows = g.rows.filter(function (s) { return s.id !== id; }); });
  delete R.rows[id]; if (R.open === id) R.open = null;
  _g24RvRender(); showToast('Removed. That person gets nothing from this step.');
}
async function g24Approve() {
  var R = window._g24.rv, btn = document.getElementById('g24RvGo'); if (!R) return;
  if (R.open) await _g24RvSave(R.open, true);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="g24-spin" aria-hidden="true"></span>Scheduling…'; }
  var done = 0, firsts = [], errs = [];
  for (var i = 0; i < R.groups.length; i++) {
    var g = R.groups[i]; if (!g.rows.length) continue;
    var d = await _sampEdge('schedule_sampaign_drafts', { campaign_id: g.campaign_id, launch: g.launch, contact_ids: g.contact_ids || undefined, start_at: g.start_at || null, allow_roll: true });
    if (!d.ok) { errs.push((g.campaign_name || 'SAMpaign') + ': ' + (d.error || 'could not schedule')); continue; }
    done += d.scheduled || 0; if (d.first_send) firsts.push(d.first_send);
    if (g.ooo) _g24MarkOoo(g.ooo.day, g.ooo.i, { campaign_id: g.campaign_id, send_at: d.first_send, state: 'scheduled' });
  }
  Object.keys(window._g24.st).forEach(function (k) { var st = window._g24.st[k]; if (st.phase === 'ready' && st.groups && st.groups.every(function (g) { return R.groups.indexOf(g) !== -1 || R.groups.some(function (x) { return x.campaign_id === g.campaign_id && x.launch === g.launch; }); })) window._g24.st[k] = { phase: 'done', msg: 'Approved and scheduled' }; });
  g24CloseReview();
  firsts.sort();
  showToast(errs.length ? errs[0] : 'Scheduled ' + _g24Pl(done, 'email') + (firsts[0] ? ', first ' + _g24Day(firsts[0]) : '') + '. Change anything in Drafts and queue.');
  try { render(); } catch (e) {}
  try { tdSampLoad(true); } catch (e) {}
  g24RenderAll();
}

// ── Wiring ────────────────────────────────────────────────────────────────
(function () {
  if (typeof tdSampRender === 'function' && !tdSampRender._g24) {
    var o = tdSampRender;
    tdSampRender = function () { var r = o.apply(this, arguments); window._g24.loadedOnce = true; g24RenderAll(); return r; };
    tdSampRender._g24 = true;
  }
  if (typeof renderToday === 'function' && !renderToday._g24) {
    var o2 = renderToday;
    renderToday = function () { var r = o2.apply(this, arguments); try { document.body.classList.add('g24'); } catch (e) {} g24RenderAll(); try { g24LoadSched(); } catch (e) {} return r; };
    renderToday._g24 = true;
  }
  if (typeof updateHeader === 'function' && !updateHeader._g24) {
    var o3 = updateHeader;
    updateHeader = function () {
      var r = o3.apply(this, arguments);
      try { var g = document.getElementById('greeting'), fn = _g24FirstName(); if (g && fn) g.textContent = g.textContent.replace(/\.$/, '') + ', ' + fn + '.'; } catch (e) {}
      return r;
    };
    updateHeader._g24 = true;
  }
  try { document.body.classList.add('g24'); } catch (e) {}
})();

// ── Sequence page: email and LinkedIn charts side by side ───────────────────
function _g24Chart(days, opts) {
  var cap = Math.max(1, opts.cap || 1), mx = Math.max(cap, 1);
  days.forEach(function (d) { mx = Math.max(mx, opts.mine(d) + opts.other(d)); });
  mx = mx * 1.15;
  var bars = days.map(function (d, i) {
    var a = opts.mine(d), b = opts.other(d);
    var lbl = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.dow] || '';
    var tip = _g24Day(d.date) + ': ' + a + ' from this SAMpaign' + (b ? ', ' + b + ' from your others' : '');
    return '<div class="g24-cb' + (i === 0 ? ' today' : '') + '" title="' + esc(tip) + '"><div class="g24-cbars"><span class="m ' + (opts.tone || '') + '" style="height:' + Math.round(a / mx * 100) + '%"></span><span class="o" style="height:' + Math.round(b / mx * 100) + '%"></span>' + (a + b ? '<em>' + (a + b) + '</em>' : '') + '</div><small>' + (i === 0 ? 'Today' : lbl) + '</small></div>';
  }).join('');
  return '<div class="g24-chart"><div class="g24-cap" style="bottom:' + (22 + Math.round(106 * cap / mx)) + 'px"><b>' + esc(opts.capLabel) + '</b></div>' + bars + '</div>';
}
function _g24Rules() {
  return '<div class="g24-rules"><span>' + G24_ICON.check + 'Stops for anyone who replies, bounces or opts out, on every channel</span><span>' + G24_ICON.check + 'Follow-ups go in the same email thread</span><span>' + G24_ICON.check + 'Nothing sends until you approve the drafts</span></div>';
}
function _g24LiCard(id, d, owner) {
  var snd = d.sender || {}, dev = snd.device, cal = d.calendar, cfg = d.config || {};
  var L = window._g24.liView = window._g24.liView || {};
  var view = L[id] || 'inv';
  var lim = snd.limit || 10, inv = (snd.today && snd.today.invites) || 0;
  var status = dev
    ? '<span class="li-dot ' + (dev.online ? 'on' : '') + '"></span><b>' + esc(dev.label || 'Chrome') + '</b> · ' + (dev.online ? 'online' : 'offline') + ' · ' + (snd.mode === 'autopilot' ? 'Autopilot' : 'Co-pilot') + ' · ' + (snd.plan ? esc(snd.plan_label) + ' plan' : 'plan not confirmed') + ' · <b>' + inv + ' of ' + lim + '</b> invites today'
    : (owner ? 'Samora for LinkedIn is not connected yet. LinkedIn steps wait until it is.' : 'The owner has not connected Samora for LinkedIn yet.');
  var chart = '';
  if (cal && cal.days && cal.days.length) {
    var isInv = view === 'inv';
    chart = _g24Chart(cal.days, { cap: isInv ? cal.caps.invites : cal.caps.messages, capLabel: 'Limit ' + (isInv ? cal.caps.invites : cal.caps.messages), tone: 'li',
      mine: function (x) { return isInv ? x.inv.mine : x.msg.mine; }, other: function (x) { return isInv ? x.inv.other : x.msg.other; } });
    var over = cal.overflow && (cal.overflow.mine + cal.overflow.other);
    var foot = [];
    if (!isInv && cal.awaiting_accept) foot.push(_g24Pl(cal.awaiting_accept, 'more message goes', 'more messages go') + ' out as people accept');
    if (isInv) foot.push(cal.caps.weekly + ' a week on your plan, ' + (cal.week_sent || 0) + ' sent this week');
    if (over) foot.push(over + ' more after these 10 days');
    chart += '<div class="g24-leg"><span><i class="m li"></i>This SAMpaign</span><span><i class="o"></i>Your other SAMpaigns</span></div>' + (foot.length ? '<div class="g24-cf">' + esc(foot.join('. ')) + '.</div>' : '');
  } else if (cfg.on) chart = '<div class="g24-empty">Nothing queued on LinkedIn yet. Invites appear here once notes are written.</div>';
  return '<section class="sp-card sp-pad g24-sc li-sender"><div class="g24-sch"><span class="g24-scl li">' + G24_ICON.li + 'LinkedIn · next 10 days</span>' +
    (cal && cal.days ? '<div class="g24-seg" role="tablist"><button type="button" role="tab" aria-selected="' + (view === 'inv') + '" class="' + (view === 'inv' ? 'on' : '') + '" onclick="_g24LiView(\'' + esc(id) + '\',\'inv\')">Invites</button><button type="button" role="tab" aria-selected="' + (view === 'msg') + '" class="' + (view === 'msg' ? 'on' : '') + '" onclick="_g24LiView(\'' + esc(id) + '\',\'msg\')">Messages</button></div>' : '') + '</div>' +
    '<div class="g24-scs">' + status + (owner && !dev ? ' <button class="g24-lk" type="button" onclick="liConnect(false)">' + (_liExtVersion() ? 'Connect this Chrome' : 'Get the plugin') + '</button>' : '') + (owner && cfg.on ? ' · <button class="g24-lk" type="button" onclick="spLiEdit(\'' + esc(id) + '\')">LinkedIn steps</button>' : '') + '</div>' + chart + '</section>';
}
function _g24LiView(id, v) { window._g24.liView = window._g24.liView || {}; window._g24.liView[id] = v; _spLiDecorate(id); }

// ── SAM-TAM: what earlier searches found ───────────────────────────────────
async function _g24TamEarlier(force) {
  var T = window._g19Tam; if (!T || (T.batches && !force)) return;
  var d = await _sampEdge('list_discovery_candidates', { status: 'pending' });
  T.batches = d && d.ok ? (d.batches || []).filter(function (b) { return (b.candidates || []).length; }).slice(0, 6) : [];
  if (window._g19Tam === T && !T.busy && !T.res) _g19TamRender();
}
function _g24TamEarlierHtml(T) {
  if (!T.batches || !T.batches.length || T.res || T.busy) return '';
  return '<section class="sp-card sp-pad g24-tamE"><div class="sp-lbl">Waiting from earlier searches</div><div class="sp-small" style="margin-top:4px">Companies SAM already found and checked. Pick from them without searching again.</div><ul>' +
    T.batches.map(function (b, i) {
      var v = (b.candidates || []).filter(function (x) { return x.verified; }).length;
      return '<li><div><b>' + esc(b.query || 'Earlier search') + '</b><small>' + _g24Pl(b.candidates.length, 'company', 'companies') + (v ? ', ' + v + ' with a checked website' : '') + ' · ' + esc(_spAgo(b.created_at)) + '</small></div><button class="g24-btn ghost sm" type="button" onclick="g24TamShow(' + i + ')">Show</button></li>';
    }).join('') + '</ul></section>';
}
function g24TamShow(i) {
  var T = window._g19Tam, b = T && T.batches && T.batches[i]; if (!b) return;
  T.err = null; T.picked = {};
  T.res = { candidates: b.candidates.map(function (x) { return Object.assign({ description: '' }, x); }), verified_count: b.candidates.filter(function (x) { return x.verified; }).length, earlier: true, query: b.query };
  T.res.candidates.forEach(function (x) { if (x.verified) T.picked[x.id] = true; });
  _g19TamRender();
}

// ════════════════════════════════════════════════════════════════════════════
// Drop K (2026-10-16): a faster app. One layer in front of every call to SAM:
//   - reads asked for twice in a short while are answered from memory, and a
//     read already on its way is shared instead of sent again;
//   - anything that changes data clears that memory, so nothing goes stale;
//   - on open, calls the Today screen does not need wait a few seconds, so the
//     ones it does need come back first;
//   - the inbox away-message scan and alert rebuild run at most every few
//     hours on their own (the buttons still run them at once).
// Today also paints at once from what it showed last time, then refreshes.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  if (window._g25Fetch) return;
  var raw = window.fetch.bind(window);
  window._g25Fetch = raw;
  var MEMO = { get_user_connections: 60, get_email_provider: 60, get_habits: 90, get_enrichment_status: 120, get_email_signature: 120, get_my_usage: 30,
    get_linkedin_status: 60, get_org_config: 120, get_org_setting: 120, get_user_kv: 60, get_relationship_coverage: 120, list_team_feed: 60, get_meeting_prep: 120,
    get_calendar_tasks: 120, get_calendar_window: 300, get_coaching_alerts: 60, get_scorecard: 60, get_deal_board: 45, get_pipeline: 45, list_sampaigns: 30, get_sampaign_home: 30 };
  var LATER = { list_team_feed: 1, get_relationship_coverage: 1, get_calendar_window: 1, get_deal_board: 1, list_sampaigns: 1, get_sampaign_home: 1, get_habits: 1,
    get_enrichment_status: 1, get_email_signature: 1, get_my_usage: 1, get_linkedin_status: 1, get_meeting_prep: 1, generate_coaching_alerts: 1, process_ooo_mails: 1 };
  var EVERY = { process_ooo_mails: [2 * 3600e3, { ok: true, tasksCreated: [], skipped: 'recent' }], generate_coaching_alerts: [3 * 3600e3, { ok: true, alertsGenerated: 0, skipped: 'recent' }] };
  var READ = /^(get_|list_|check_|peek_|preview_|find_people|search_|read_)/;
  var memo = {}, flying = {};
  window._g25 = { memo: memo, stats: { hit: 0, shared: 0, sent: 0, later: 0, skipped: 0 } };
  var S = window._g25.stats;
  var isEdge = function (u) { u = String(u || ''); return (typeof EDGE_FN_URL !== 'undefined' && u === EDGE_FN_URL) || /\/functions\/v1\/sam-gmail-signals(\?|$)/.test(u); };
  var reply = function (txt, status) { return new Response(txt, { status: status || 200, headers: { 'Content-Type': 'application/json' } }); };
  var who = function () { try { return (currentUser && currentUser.id) || ''; } catch (e) { return ''; } };
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!isEdge(url) || !init || String(init.method || 'GET').toUpperCase() !== 'POST' || typeof init.body !== 'string') {
      // A direct database write (tasks, accounts) also makes remembered reads stale.
      if (/\/rest\/v1\//.test(String(url)) && init && String(init.method || 'GET').toUpperCase() !== 'GET') { for (var dk in memo) delete memo[dk]; }
      return raw(input, init);
    }
    var a = '', p = null;
    try { p = JSON.parse(init.body); a = String(p.action || ''); } catch (e) { return raw(input, init); }
    var force = p && (p.force || p.refresh || p.nocache);
    // Heavy background jobs: at most every few hours unless pressed.
    var ev = EVERY[a];
    if (ev && !(window.event && window.event.type === 'click')) {
      var k = 'g25_last_' + a + '_' + who(), last = 0;
      try { last = Number(localStorage.getItem(k)) || 0; } catch (e) {}
      if (Date.now() - last < ev[0]) { S.skipped++; return Promise.resolve(reply(JSON.stringify(ev[1]))); }
      try { localStorage.setItem(k, String(Date.now())); } catch (e) {}
    }
    // A change: forget what was read, and send it now.
    if (!READ.test(a)) { for (var mk in memo) delete memo[mk]; S.sent++; return raw(input, init); }
    var key = who() + '|' + init.body;
    var ttl = MEMO[a];
    if (ttl && !force) {
      var m = memo[key];
      if (m && Date.now() - m.at < ttl * 1000) { S.hit++; return Promise.resolve(reply(m.txt, m.status)); }
      if (flying[key]) { S.shared++; return flying[key].then(function (r) { return reply(r.txt, r.status); }); }
    }
    var go = function () {
      S.sent++;
      var pr = raw(input, init).then(function (res) {
        return res.text().then(function (txt) {
          if (ttl && res.ok) memo[key] = { txt: txt, status: res.status, at: Date.now() };
          return { txt: txt, status: res.status };
        });
      });
      if (ttl) flying[key] = pr;
      var done = function () { delete flying[key]; };
      pr.then(done, done);
      return pr.then(function (r) { return reply(r.txt, r.status); });
    };
    // On open, the Today screen goes first.
    var since = window._g25Open ? performance.now() - window._g25Open : 1e9;
    var onToday = (typeof currentTab === 'undefined') || currentTab === 'today';
    if (LATER[a] && since < 3500 && onToday) {
      S.later++;
      var wait = new Promise(function (r) { setTimeout(r, 3500 - since); });
      var lp = wait.then(go);
      if (ttl) flying[key] = lp.then(function (res) { return res.clone().text().then(function (txt) { return { txt: txt, status: res.status }; }); });
      return lp;
    }
    return go();
  };
  window._g25Forget = function () { for (var mk in memo) delete memo[mk]; };
})();

// Open: start the clock the layer above uses.
(function () {
  if (typeof launchApp === 'function' && !launchApp._g25) {
    var o = launchApp;
    launchApp = function () { window._g25Open = performance.now(); return o.apply(this, arguments); };
    launchApp._g25 = true;
  }
})();

// Today paints from last time, then refreshes.
function _g25Key(n) { try { return 'g25_' + n + '_' + ((currentUser && currentUser.id) || ''); } catch (e) { return ''; } }
function _g25Get(n, maxAgeMs) { try { var v = JSON.parse(localStorage.getItem(_g25Key(n)) || 'null'); if (v && Date.now() - v.at < maxAgeMs) return v.d; } catch (e) {} return null; }
function _g25Put(n, d) { try { localStorage.setItem(_g25Key(n), JSON.stringify({ at: Date.now(), d: d })); } catch (e) {} }
(function () {
  if (typeof tdSampLoad === 'function' && !tdSampLoad._g25) {
    var o = tdSampLoad;
    tdSampLoad = function (force) {
      if (!window._tds.data) { var c = _g25Get('tds', 12 * 3600e3); if (c && c.date === (typeof todayKey === 'function' ? todayKey() : c.date)) { window._tds.data = c; window._tds.at = 0; try { tdSampRender(); } catch (e) {} } }
      return o.apply(this, arguments);
    };
    tdSampLoad._g25 = true;
  }
  if (typeof tdSampRender === 'function' && !tdSampRender._g25) {
    var r = tdSampRender;
    tdSampRender = function () { var x = r.apply(this, arguments); try { if (window._tds.data && window._tds.data.ok) _g25Put('tds', window._tds.data); } catch (e) {} return x; };
    tdSampRender._g25 = true;
  }
  if (typeof g24LoadSched === 'function' && !g24LoadSched._g25) {
    var s = g24LoadSched;
    g24LoadSched = function () {
      var day = todayKey();
      if (!window._g24.meet) { var c = _g25Get('meet', 12 * 3600e3); if (c && c.day === day) { window._g24.meet = c.list; window._g24.meetOk = true; try { g24RenderSched(); } catch (e) {} } }
      return Promise.resolve(s.apply(this, arguments)).then(function () { if (window._g24.meetDay === day && window._g24.meetOk) _g25Put('meet', { day: day, list: window._g24.meet || [] }); });
    };
    g24LoadSched._g25 = true;
  }
})();

// ════════════════════════════════════════════════════════════════════════════
// Drop L (2026-10-17)
//  SAM-TAM: the rep can let SAM use the organisation's Apollo company database
//  (one Apollo credit a search), and sees the filters SAM read, the companies
//  left out for not being in the sector, and earlier finds for the same kind
//  of search, marked as such.
//  Today: away messages SAM has read become actions. "Back from leave": SAM
//  writes the welcome back. "Named someone to contact instead": SAM adds that
//  person to the SAMpaign and writes their first email. Nothing sends until
//  the rep approves.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  if (document.getElementById('g26css')) return;
  var st = document.createElement('style'); st.id = 'g26css';
  st.textContent =
    '.g26-db{display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:10px 12px;border:1px solid var(--border,rgba(0,0,0,.1));border-radius:10px;font-size:13px;line-height:1.45;cursor:pointer}' +
    '.g26-db input{margin-top:3px;accent-color:#B8860B}.g26-db small{display:block;color:var(--text3,#777);font-size:12px}' +
    '.g26-flt{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px 0}.g26-flt span{font-size:12px;padding:3px 9px;border-radius:999px;background:var(--bg2,rgba(0,0,0,.05));color:var(--text2,#555)}' +
    '.g26-earl{font-size:11px;padding:2px 7px;border-radius:999px;background:rgba(184,134,11,.12);color:#8a6408;margin-left:6px;white-space:nowrap}' +
    '.g26-note{padding:10px 16px;font-size:12.5px;color:var(--text2,#555);line-height:1.45}';
  document.head.appendChild(st);
})();

function _g26TamDbKey() { try { return 'g26_tam_db_' + ((currentUser && currentUser.id) || ''); } catch (e) { return 'g26_tam_db'; } }
function _g26TamDbSave() { try { localStorage.setItem(_g26TamDbKey(), window._g19Tam.useDb ? '1' : '0'); } catch (e) {} }
async function _g26TamApollo() {
  var T = window._g19Tam; if (!T || T.apollo !== undefined) return;
  T.apollo = false;
  try {
    var d = await _sampEdge('get_enrichment_status', {});
    var p = (d && d.providers) || {};
    T.apollo = !!(p.apollo_org || p.apollo_user);
    var v = null; try { v = localStorage.getItem(_g26TamDbKey()); } catch (e) {}
    T.useDb = T.apollo && v === '1';
  } catch (e) { T.apollo = false; }
  if (T.apollo) _g19TamRender();
}
function _g26TamDbHtml(T) {
  if (!T || !T.apollo) return '';
  return '<label class="g26-db"><input type="checkbox" ' + (T.useDb ? 'checked ' : '') + 'onchange="_g19TamSave();window._g19Tam.useDb=this.checked;_g26TamDbSave();_g19TamRender()">' +
    '<span><b>Use your Apollo company database</b><small>1 Apollo credit per search. SAM filters it by country, sector and size, then checks every website. Steadier results, even when SAM’s AI is busy.</small></span></label>';
}
// What SAM read from the description, above the list.
function _g26TamFilters(r) {
  var f = r && r.filters;
  if (!f || !(f.country || (f.sectors && f.sectors.length) || f.size)) return '';
  var bits = [];
  if (f.country) bits.push(f.country);
  (f.sectors || []).forEach(function (s) { bits.push(s.charAt(0).toUpperCase() + s.slice(1)); });
  if (f.size) bits.push(Number(f.size[0]).toLocaleString('en-GB') + (f.size[1] >= 1000000 ? '+' : ' to ' + Number(f.size[1]).toLocaleString('en-GB')) + ' employees');
  return '<div class="g26-flt" title="What SAM read from your description">' + bits.map(function (b) { return '<span>' + esc(b) + '</span>'; }).join('') + '</div>';
}
function _g26TamNotes(r) {
  if (!r || r.earlier) return '';
  var out = '';
  if (r.found_by === 'database') out += '<div class="g26-note">From your Apollo company database' + (r.database && r.database.credits ? ' (' + _spPlural(r.database.credits, 'credit') + ')' : '') + '. Every website was still checked.</div>';
  else if (r.database && r.database.note === 'no_key') out += '<div class="g26-note">Apollo is not connected for you, so SAM searched as usual.</div>';
  else if (r.database && !r.database.used) out += '<div class="g26-note">The Apollo company database did not answer, so SAM searched as usual. No Apollo credit was used.</div>';
  if (r.off_topic) out += '<div class="g26-note">' + _spPlural(r.off_topic, 'company', 'companies') + ' left out because ' + (r.off_topic === 1 ? 'its website does' : 'their websites do') + ' not look like ' + esc(r.sector || 'what you described') + (r.off_topic_names && r.off_topic_names.length ? ': ' + esc(r.off_topic_names.join(', ')) : '') + '.</div>';
  return out;
}
(function () {
  if (typeof sampOpenTam === 'function' && !sampOpenTam._g26) {
    var o = sampOpenTam;
    sampOpenTam = function () { var x = o.apply(this, arguments); try { if (_g19SamTam()) _g26TamApollo(); } catch (e) {} return x; };
    sampOpenTam._g26 = true;
  }
})();

// ── Today: away messages SAM has read ──────────────────────────────────────
(function () {
  if (typeof _g24SamLabel === 'function' && !_g24SamLabel._g26) {
    var o = _g24SamLabel;
    _g24SamLabel = function (x) {
      var s = (x && x.sam) || {};
      if (s.do === 'ooo_back') return (s.people || []).length > 1 ? 'Let SAM write ' + s.people.length + ' welcome backs' : 'Let SAM write the welcome back';
      if (s.do === 'ooo_alt') return (s.people || []).length > 1 ? 'Let SAM add them and write' : 'Let SAM add ' + String(((s.people || [])[0] || {}).alt && s.people[0].alt.name || 'them').split(' ')[0] + ' and write';
      return o.apply(this, arguments);
    };
    _g24SamLabel._g26 = true;
  }
  if (typeof g24Handle === 'function' && !g24Handle._g26) {
    var h = g24Handle;
    g24Handle = function (key, quiet) {
      var x = _g24Find(key);
      if (x && x.sam && (x.sam.do === 'ooo_back' || x.sam.do === 'ooo_alt')) return _g26Away(x, key, quiet);
      return h.apply(this, arguments);
    };
    g24Handle._g26 = true;
  }
})();
async function _g26Away(x, key, quiet) {
  var s = x.sam, c = x.c, back = s.do === 'ooo_back';
  var msg = function (m) { _g24Set(key, { phase: 'working', msg: m }); };
  var groups = {}, written = 0, already = 0, errs = [];
  var people = s.people || [];
  for (var i = 0; i < people.length; i++) {
    var p = people[i];
    var who = back ? String(p.name || p.email || '').split(' ')[0] : String((p.alt && (p.alt.name || p.alt.email)) || '').split(' ')[0];
    msg((back ? 'Writing to ' : 'Adding ') + (who || 'them') + '…');
    var r = back
      ? await _sampEdge('sam_handle_ooo', { contact_email: p.email, contact_name: p.name || '', return_date: p.until || null, task_date: todayKey() })
      : await _sampEdge('sam_ooo_alt', { campaign_id: c.id, contact_id: p.id });
    if (!r || !r.ok) { errs.push((r && r.error) || 'SAM could not do this one.'); continue; }
    var gk = r.campaign_id + ':' + r.launch;
    var g = groups[gk] || (groups[gk] = { campaign_id: r.campaign_id, campaign_name: r.campaign_name || c.name, launch: r.launch, contact_ids: [], start_at: r.start_at || null, send_day: r.send_day || null });
    if (r.existing) { if (r.existing.status === 'pending') { already++; continue; } g.contact_ids.push(r.contact_id); continue; }
    var w = await _g24WriteWave(r.campaign_id, r.launch, msg, { contact_ids: [r.contact_id], instruction: r.instruction, batch: 1 });
    if (!w.ok || !w.written) { errs.push((w && w.error) || 'SAM could not write this one.'); continue; }
    g.contact_ids.push(r.contact_id); written++;
  }
  var list = Object.keys(groups).map(function (k) { return groups[k]; }).filter(function (g) { return g.contact_ids.length; });
  if (!list.length) {
    _g24Set(key, already && !errs.length ? { phase: 'done', msg: already === 1 ? 'Already scheduled' : 'All already scheduled' } : { phase: 'error', msg: errs[0] || 'Nothing for SAM to write here.' });
    return null;
  }
  var n = list.reduce(function (a, g) { return a + g.contact_ids.length; }, 0);
  _g24Set(key, { phase: 'ready', msg: 'SAM wrote ' + _g24Pl(n, 'email'), cta: 'Review ' + (n > 1 ? n + ' ' : '') + 'and approve', groups: list });
  if (!quiet) g24Review(list, key);
  return list[0];
}

// ════════════════════════════════════════════════════════════════════════════
// Drop M (2026-10-17): SAM reads replies and writes the answer.
// Email: from Today ("Let SAM reply") or a SAMpaign's Replies. SAM reads the
// reply in the mailbox, writes the answer in the same thread; the rep reads,
// edits, rewrites with a word of direction, and sends. One person at a time.
// LinkedIn replies are answered from the Samora panel on LinkedIn, where the
// conversation can be read.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  if (document.getElementById('g27css')) return;
  var st = document.createElement('style'); st.id = 'g27css';
  st.textContent =
    '.g27-pg{font-size:12.5px;color:var(--text3);margin-top:2px}' +
    '.g27-q{margin:14px 0 10px;padding:12px 14px;border-radius:14px;background:var(--surface2,rgba(0,0,0,.04));border:1px solid var(--border)}' +
    '.g27-qh{display:flex;justify-content:space-between;gap:10px;font-size:12px;font-weight:650;color:var(--text2);margin-bottom:6px}' +
    '.g27-qt{font-size:13.5px;line-height:1.55;white-space:pre-wrap;color:var(--text);max-height:220px;overflow:auto}' +
    '.g27-earlier{all:unset;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--gold-ink,#8a6408);margin:2px 0 8px}' +
    '.g27-tr{margin:0 0 12px;padding-left:12px;border-left:2px solid var(--border);display:flex;flex-direction:column;gap:8px}' +
    '.g27-tr div{font-size:12.5px;line-height:1.5;color:var(--text2)} .g27-tr b{color:var(--text)}' +
    '.g27-lbl{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text3);margin:12px 0 6px}' +
    '.g27-kind{font-size:11px;font-weight:650;letter-spacing:0;text-transform:none;padding:2px 8px;border-radius:999px;background:rgba(184,134,11,.12);color:#8a6408}' +
    '.g27-subj{font-size:13px;color:var(--text2);margin-bottom:6px}' +
    '.g27-ed{min-height:150px;padding:12px 14px;border-radius:14px;border:1px solid var(--border);background:var(--c-canvas,var(--surface,#fff));font-size:14px;line-height:1.6;color:var(--text);outline:none}' +
    '.g27-ed:focus{border-color:transparent;box-shadow:0 0 0 2px #D4AF37}' +
    '.g27-redo{display:flex;gap:8px;margin-top:10px}' +
    '.g27-redo input{flex:1;min-width:0;height:36px;border-radius:999px;border:1px solid var(--border);padding:0 14px;font:inherit;font-size:13px;background:var(--c-canvas,var(--surface,#fff));color:var(--text)}' +
    '.g27-err{margin-top:10px;font-size:13px;color:var(--coral,#c0392b)}' +
    '.g27-sp{flex:1}' +
    '.g27-wk{display:flex;align-items:center;gap:10px;font-size:13.5px;color:var(--text2);padding:22px 0}';
  document.head.appendChild(st);
})();
var G27_KIND = { interested: 'Interested', question: 'Asked a question', not_now: 'Not now', referral: 'Pointed to someone', not_interested: 'Not interested', other: '' };

// people: [{ id, name, email }]; campaign: { id, name }.
function g27ReplyOpen(people, campaign, taskKey) {
  people = (people || []).filter(function (p) { return p && p.id; });
  if (!people.length) return;
  var old = document.getElementById('g27Rv'); if (old) old.remove();
  var m = document.createElement('div'); m.className = 'g24-rv'; m.id = 'g27Rv';
  m.innerHTML = '<div class="g24-rvp" role="dialog" aria-modal="true" aria-labelledby="g27T"><div class="g24-rvh"><div><h3 id="g27T">Reply</h3><div class="g27-pg" id="g27Pg"></div></div><button class="g24-x" type="button" aria-label="Close" onclick="g27Close()">' + G24_ICON.x + '</button></div><div class="g24-rvb" id="g27B"></div><div class="g24-rvf" id="g27F"></div></div>';
  m.addEventListener('click', function (e) { if (e.target === m) g27Close(); });
  document.body.appendChild(m);
  document.addEventListener('keydown', _g27Esc);
  requestAnimationFrame(function () { m.classList.add('on'); });
  window._g27 = { people: people, campaign: campaign || {}, i: 0, key: taskKey || null, sent: 0, d: null, busy: false };
  _g27Load();
}
function _g27Esc(e) { if (e.key === 'Escape' && !(window._g27 && window._g27.busy)) g27Close(); }
function g27Close() {
  var m = document.getElementById('g27Rv'); document.removeEventListener('keydown', _g27Esc);
  var R = window._g27; window._g27 = null;
  if (m) { m.classList.remove('on'); setTimeout(function () { m.remove(); }, 180); }
  if (R && R.sent) { try { tdSampLoad(true); } catch (e) {} try { _sampRefreshOpen(); } catch (e) {} }
}
function _g27Who() { var R = window._g27; return R && R.people[R.i]; }
function _g27Head() {
  var R = window._g27, p = _g27Who(); if (!R || !p) return;
  var t = document.getElementById('g27T'), pg = document.getElementById('g27Pg');
  if (t) t.textContent = 'Reply to ' + (p.name || p.email || 'them');
  if (pg) pg.textContent = (R.campaign.name ? R.campaign.name + ' · ' : '') + (R.people.length > 1 ? (R.i + 1) + ' of ' + R.people.length + ' · ' : '') + 'Nothing sends until you press Send';
}
async function _g27Load(extra) {
  var R = window._g27, p = _g27Who(); if (!R || !p) return;
  _g27Head();
  var B = document.getElementById('g27B'), F = document.getElementById('g27F');
  if (!extra) { R.d = null; B.innerHTML = '<div class="g27-wk"><span class="g24-spin" aria-hidden="true"></span>SAM is reading ' + esc(String(p.name || 'their').split(' ')[0]) + '’s ' + (p.channel === 'linkedin' ? 'LinkedIn ' : '') + 'reply and writing your answer…</div>'; F.innerHTML = ''; }
  else { R.busy = true; _g27Render(); }
  var name = (currentUser && currentUser.user_metadata && currentUser.user_metadata.full_name) || '';
  var d = await _sampEdge('sam_write_reply', Object.assign({ contact_id: p.id, channel: p.channel === 'linkedin' ? 'linkedin' : 'email', sender_full_name: name, sender_name: name.split(' ')[0] || '' }, p.purpose ? { purpose: p.purpose } : {}, (!extra && p.instruction) ? { instruction: p.instruction } : {}, extra || {}));
  if (window._g27 !== R) return;
  R.busy = false;
  if (!d.ok) {
    if (extra) { R.err = d.error || 'SAM could not rewrite it.'; _g27Render(); return; }
    B.innerHTML = '<div class="g27-err" style="margin-top:22px">' + esc(d.error || 'SAM could not write this reply.') + '</div>' + (p.channel === 'linkedin' && d.reason === 'not_seen' ? '<p class="g27-pg" style="margin-top:10px">SamoraOS learns what people wrote on LinkedIn from your Samora plugin. It checks every hour while Chrome is open.</p>' : '');
    F.innerHTML = '<span class="g27-sp"></span>' + (R.i < R.people.length - 1 ? '<button class="g24-btn ghost" type="button" onclick="_g27Next()">Next person</button>' : '') + '<button class="g24-btn ghost" type="button" onclick="g27Close()">Close</button>';
    return;
  }
  if (d.channel && p && d.channel !== p.channel) p.channel = d.channel;
  R.err = null; R.d = d; R.showEarlier = false; R.fresh = true;
  _g27Render();
}
function _g27Render() {
  var R = window._g27; if (!R || !R.d) return;
  var d = R.d, p = _g27Who(), B = document.getElementById('g27B'), F = document.getElementById('g27F');
  var keep = document.getElementById('g27Ed'); if (keep && !R.fresh) d.body = keep.innerHTML; R.fresh = false;
  var first = String(p.name || 'They').split(' ')[0];
  var li = p.channel === 'linkedin';
  var when = d.their && d.their.at ? _g24Day(d.their.at) : '';
  var earlier = (d.transcript || []).slice(0, -1).filter(function (x) { return x && x.text; });
  B.innerHTML =
    '<div class="g27-q"><div class="g27-qh"><span>' + esc(first) + ' wrote' + (li ? ' on LinkedIn' : '') + '</span><span>' + esc(when) + '</span></div><div class="g27-qt">' + esc((d.their && d.their.text) || '') + '</div>' +
      (li && d.source === 'first_line' ? '<div class="g27-pg" style="margin-top:8px">LinkedIn showed SAM the first line of this message.' + (d.thread_url ? ' <a href="' + esc(d.thread_url) + '" target="_blank" rel="noopener">Read it all on LinkedIn</a>' : '') + '</div>' : '') + '</div>' +
    (earlier.length ? '<button class="g27-earlier" type="button" onclick="window._g27.showEarlier=!window._g27.showEarlier;_g27Render()">' + (R.showEarlier ? 'Hide' : 'Show') + ' the earlier ' + (li ? 'messages' : 'emails') + ' (' + earlier.length + ')</button>' +
      (R.showEarlier ? '<div class="g27-tr">' + earlier.map(function (x) { return '<div><b>' + (x.from === 'them' ? esc(first) : 'You') + ':</b> ' + esc(String(x.text).slice(0, 400)) + '</div>'; }).join('') + '</div>' : '') : '') +
    '<div class="g27-lbl">SAM’s answer' + (G27_KIND[d.kind] ? '<span class="g27-kind">' + esc(G27_KIND[d.kind]) + '</span>' : '') + (d.language && d.language.code && d.language.code !== 'en' ? '<span class="g27-kind" title="' + esc(d.language.why || '') + '">In ' + esc(d.language.name) + '</span>' : '') + '</div>' +
    (li ? '<div class="g27-subj">A LinkedIn message · your Samora plugin sends it in your conversation with ' + esc(first) + '</div>' : '') +
    (d.subject ? '<div class="g27-subj">Subject: <b>' + esc(d.subject) + '</b> · same thread</div>' : '') +
    '<div class="g27-ed" id="g27Ed" contenteditable="' + (R.busy ? 'false' : 'true') + '" role="textbox" aria-multiline="true" aria-label="Your answer">' + _g27Safe(d.body) + '</div>' +
    '<div class="g27-redo"><input id="g27Ins" placeholder="Tell SAM what to change, e.g. shorter, offer Thursday" aria-label="What should SAM change?"' + (R.busy ? ' disabled' : '') + ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();g27Rewrite()}"><button class="g24-btn ghost sm" type="button" onclick="g27Rewrite()"' + (R.busy ? ' disabled' : '') + '>' + (R.busy ? '<span class="g24-spin" aria-hidden="true"></span>' : G24_ICON.spark) + 'Rewrite</button></div>' +
    (R.err ? '<div class="g27-err">' + esc(R.err) + '</div>' : '');
  F.innerHTML = (R.people.length > 1 && R.i < R.people.length - 1 ? '<button class="g24-btn ghost" type="button" onclick="_g27Next()"' + (R.busy ? ' disabled' : '') + '>Skip</button>' : '<button class="g24-btn ghost" type="button" onclick="g27Close()"' + (R.busy ? ' disabled' : '') + '>Cancel</button>') +
    '<span class="g27-sp"></span><button class="g24-btn gold" type="button" id="g27Send" onclick="g27Send()"' + (R.busy ? ' disabled' : '') + '>' + (R.sending ? '<span class="g24-spin" aria-hidden="true"></span>' + (li ? 'Queueing…' : 'Sending…') : (li ? 'Send on LinkedIn' : 'Send to ' + esc(first))) + '</button>';
}
// Only simple formatting survives in the editor: paragraphs, breaks, bold, italics, links.
function _g27Safe(html) {
  var b = document.createElement('div'); b.innerHTML = String(html || '');
  b.querySelectorAll('script,style,iframe,object,embed,img,svg,form,input,button').forEach(function (n) { n.remove(); });
  b.querySelectorAll('*').forEach(function (n) { [].slice.call(n.attributes).forEach(function (a) { if (!(n.tagName === 'A' && a.name === 'href' && /^https?:|^mailto:/i.test(a.value))) n.removeAttribute(a.name); }); });
  return b.innerHTML;
}
function g27Rewrite() {
  var R = window._g27; if (!R || R.busy || !R.d) return;
  var ed = document.getElementById('g27Ed'), ins = document.getElementById('g27Ins');
  if (ed) R.d.body = ed.innerHTML;
  _g27Load({ instruction: ins ? ins.value : '', current: _g24Plain(R.d.body) });
}
async function g27Send() {
  var R = window._g27; if (!R || R.busy || !R.d) return;
  var p = _g27Who(), ed = document.getElementById('g27Ed');
  var html = _g27Safe(ed ? ed.innerHTML : R.d.body);
  if (_g24Plain(html).length < 2) { R.err = 'The answer is empty.'; _g27Render(); return; }
  R.d.body = html; R.busy = true; R.sending = true; R.err = null; _g27Render();
  var li = p.channel === 'linkedin';
  var d = await _sampEdge('send_sam_reply', li ? { contact_id: p.id, channel: 'linkedin', body: _g24Plain(html) } : { contact_id: p.id, body: html, subject: R.d.subject || undefined });
  if (window._g27 !== R) return;
  R.busy = false; R.sending = false;
  if (!d.ok) { R.err = d.error || 'It did not go. Nothing was sent.'; _g27Render(); return; }
  R.sent++;
  showToast(li ? (d.note || 'Queued for LinkedIn.') : 'Sent to ' + String(p.name || p.email || 'them').split(' ')[0] + ', in the same thread');
  if (R.i < R.people.length - 1) { R.i++; _g27Load(); return; }
  if (R.key) { try { _g24Set(R.key, { phase: 'done', msg: R.sent === 1 ? 'Answered' : 'Answered ' + R.sent }); } catch (e) {} }
  g27Close();
}
function _g27Next() { var R = window._g27; if (!R) return; if (R.i < R.people.length - 1) { R.i++; _g27Load(); } else g27Close(); }

// Today: "Let SAM reply" on email replies. Not part of "Let SAM take all":
// a reply needs the rep's eyes.
(function () {
  if (typeof _g24SamLabel === 'function' && !_g24SamLabel._g27) {
    var o = _g24SamLabel;
    _g24SamLabel = function (x) { var s = (x && x.sam) || {}; if (s.do === 'reply') return (s.people || []).length > 1 ? 'Let SAM reply to ' + s.people.length : 'Let SAM reply'; return o.apply(this, arguments); };
    _g24SamLabel._g27 = true;
  }
  if (typeof g24Handle === 'function' && !g24Handle._g27) {
    var h = g24Handle;
    g24Handle = function (key, quiet) {
      var x = _g24Find(key);
      if (x && x.sam && x.sam.do === 'reply') { if (!quiet) g27ReplyOpen(x.sam.people, { id: x.c.id, name: x.c.name }, key); return Promise.resolve(null); }
      return h.apply(this, arguments);
    };
    g24Handle._g27 = true;
  }
})();
// A SAMpaign's Replies: one person.
function g27ReplyOne(campaignId, contactId, name, email, channel) {
  var o = (window._sampOv || {})[campaignId];
  g27ReplyOpen([{ id: contactId, name: name || '', email: email || '', channel: channel === 'linkedin' ? 'linkedin' : 'email' }], { id: campaignId, name: o && o.campaign ? o.campaign.name : '' }, null);
}

// ════════════════════════════════════════════════════════════════════════════
// Drop O2 (2026-10-19): SAM Power and SAM Full Power.
// You, Plan and usage (was Usage and limits): the plan, what is used today and this month, and what
// resets when. A limit is shown where it applies, as a date or a next step.
// The sending rules (mailbox and LinkedIn limits) are the same on every plan.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  if (document.getElementById('g30css')) return;
  var st = document.createElement('style'); st.id = 'g30css';
  st.textContent =
    '.g30-plan{display:flex;flex-direction:column;gap:14px}' +
    '.g30-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}' +
    '.g30-name{font-size:17px;font-weight:650;letter-spacing:-.01em;color:var(--text)}' +
    '.g30-badge{font-size:11.5px;font-weight:650;padding:3px 10px;border-radius:999px;background:rgba(184,134,11,.13);color:#8a6408}' +
    '.g30-meters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}' +
    '.g30-m{padding:11px 12px;border-radius:12px;background:var(--surface2,rgba(0,0,0,.035));display:flex;flex-direction:column;gap:6px;min-width:0}' +
    '.g30-m span{font-size:12px;color:var(--text3)} .g30-m b{font-size:18px;font-weight:650;font-variant-numeric:tabular-nums;color:var(--text)} .g30-m b small{font-size:12px;font-weight:500;color:var(--text3)}' +
    '.g30-bar{height:6px;border-radius:999px;background:var(--border);overflow:hidden} .g30-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#E8B84B,#B8860B)} .g30-bar.hi i{background:#c0392b}' +
    '.g30-lbl{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text3)}' +
    '.g30-rows{display:flex;flex-direction:column}' +
    '.g30-r{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--border);font-size:13px;color:var(--text)}' +
    '.g30-r:first-child{border-top:0} .g30-r em{font-style:normal;font-size:12.5px;color:var(--text3);font-variant-numeric:tabular-nums;text-align:right} .g30-r em.hi{color:#c0392b;font-weight:600} .g30-r em.nl{color:#2e7d32}' +
    '.g30-note{font-size:12.5px;line-height:1.5;color:var(--text2);padding:10px 12px;border-radius:12px;background:rgba(184,134,11,.08)}' +
    '.g30-foot{font-size:12px;color:var(--text3);line-height:1.5}' +
    '@media (max-width:520px){.g30-meters{grid-template-columns:1fr}}';
  document.head.appendChild(st);
})();
var G30_PLAN = null;
// The existing You card "Usage and limits" becomes "Plan and usage": one place
// for the plan, what is used, and what resets when.
async function _g30Load() {
  var box = document.getElementById('youUsageBody'), chip = document.getElementById('youUsageChip');
  if (!box || !currentUser || !currentUser.token) return;
  if (!G30_PLAN) box.innerHTML = '<div class="admin-card" style="margin-bottom:0"><div class="g30-foot">Loading…</div></div>';
  var d = await _sampEdge('get_my_plan', {});
  G30_PLAN = d && d.ok ? d : null;
  if (!G30_PLAN) { box.innerHTML = '<div class="admin-card" style="margin-bottom:0"><div class="g30-foot">' + esc((d && d.error) || 'Could not load your plan.') + '</div></div>'; return; }
  var near = (G30_PLAN.usage || []).filter(function (u) { return !u.no_limit && u.daily_cap && u.today / u.daily_cap >= 0.8; }).length;
  if (chip) chip.textContent = near ? near + ' near the limit' : (G30_PLAN.plan ? G30_PLAN.plan.label : 'Today');
  box.innerHTML = '<div class="admin-card" style="margin-bottom:0">' + _g30Html(G30_PLAN) + '</div>';
}
function _g30Num(n) { return Number(n || 0).toLocaleString('en-IN'); }
function _g30Html(d) {
  var p = d.plan;
  var meter = function (label, used, cap) {
    var pct = cap ? Math.min(100, Math.round(used / cap * 100)) : 0;
    return '<div class="g30-m"><span>' + esc(label) + '</span><b>' + _g30Num(used) + (cap ? ' <small>of ' + _g30Num(cap) + '</small>' : '') + '</b>' + (cap ? '<div class="g30-bar' + (pct >= 80 ? ' hi' : '') + '"><i style="width:' + pct + '%"></i></div>' : '') + '</div>';
  };
  var head = '<div class="g30-top"><span class="g30-name">' + esc(p ? p.label : 'No plan set yet') + '</span>' + (p ? '<span class="g30-badge">' + (p.id === 'full_power' ? 'AI without limits' : 'Daily limits on AI') + '</span>' : '') + '</div>';
  var meters = '<div class="g30-meters">' + meter('Live SAMpaigns', d.live, p && p.live_sampaigns) + meter('People in sequence', d.in_sequence, p && p.in_sequence) + '</div>';
  var near = p && ((p.live_sampaigns && d.live >= p.live_sampaigns) ? 'All ' + p.live_sampaigns + ' live SAMpaigns are in use. Pause or archive one to start another.' : (p.in_sequence && d.in_sequence >= p.in_sequence * 0.8) ? 'People in sequence: ' + _g30Num(d.in_sequence) + ' of ' + _g30Num(p.in_sequence) + '. Room opens as people reply or finish their emails.' : '');
  var order = ['ai_email', 'ai_note', 'ai_read', 'discovery', 'scout', 'enrich', 'reveal', 'export'];
  var rows = (d.usage || []).slice().sort(function (a, b) { return order.indexOf(a.kind) - order.indexOf(b.kind); }).map(function (u) {
    var val, cls = '';
    if (u.no_limit) { val = _g30Num(u.today) + ' today · no limit'; cls = 'nl'; }
    else if (!u.daily_cap) { val = 'Not on your plan'; }
    else {
      val = _g30Num(u.today) + ' of ' + _g30Num(u.daily_cap) + ' today' + (u.month_cap ? ' · ' + _g30Num(u.month) + ' of ' + _g30Num(u.month_cap) + ' this month' : '');
      if (u.today >= u.daily_cap || (u.month_cap && u.month >= u.month_cap)) cls = 'hi';
    }
    return '<div class="g30-r"><span>' + esc(u.what) + '</span><em class="' + cls + '">' + esc(val) + '</em></div>';
  }).join('');
  var up = p && p.id === 'power' && d.plans ? (d.plans.find(function (x) { return x.id === 'full_power'; }) || null) : null;
  var upsell = up ? '<div class="g30-note"><b>' + esc(up.label) + '</b> adds ' + up.live_sampaigns + ' live SAMpaigns, ' + _g30Num(up.in_sequence) + ' people in sequence, ' + up.people_per_sampaign + ' people and ' + up.companies_per_sampaign + ' companies per SAMpaign, and AI without daily limits. Ask Samora to switch.</div>' : '';
  var size = p ? '<div class="g30-foot">A SAMpaign holds up to ' + p.people_per_sampaign + ' people across ' + p.companies_per_sampaign + ' companies on this plan.</div>' : '';
  return '<div class="g30-plan">' + head + meters + (near ? '<div class="g30-note">' + esc(near) + '</div>' : '') +
    '<div><div class="g30-lbl" style="margin-bottom:4px">Today</div><div class="g30-rows">' + rows + '</div></div>' + size + upsell +
    '<div class="g30-foot">Daily limits reset at midnight India time. Sending rules are the same on every plan: each mailbox earns its daily number, and LinkedIn limits follow your LinkedIn plan.</div></div>';
}
(function () {
  if (typeof g19RenderYouUsage === 'function' && !g19RenderYouUsage._g30) { g19RenderYouUsage = function () { return _g30Load(); }; g19RenderYouUsage._g30 = true; }
  // A limit SAM met on the way (people kept to the plan) says so, once.
  if (typeof _sampEdge === 'function' && !_sampEdge._g30) {
    var e = _sampEdge;
    _sampEdge = async function () { var d = await e.apply(this, arguments); try { if (d && d.plan_note && typeof showToast === 'function') showToast(d.plan_note); } catch (x) {} return d; };
    _sampEdge._g30 = true;
  }
})();

// ════════════════════════════════════════════════════════════════════════════
// Drop P (2026-10-21): what SAM read on each person's LinkedIn profile, in the
// SAMpaign's People view. It replaces the generic role note once SAM has
// visited the profile, and says when SAM held someone (may not be a buyer) or
// a note it could not write well. Decisions are made in the Samora panel.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  if (document.getElementById('g31css')) return;
  var st = document.createElement('style'); st.id = 'g31css';
  st.textContent =
    '.g31-k{margin-top:6px;border-radius:10px;background:rgba(184,134,11,.07);padding:7px 10px;font-size:12.5px;line-height:1.45;color:var(--text2)}' +
    '.g31-k summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;color:var(--text);font-weight:550}' +
    '.g31-k summary::-webkit-details-marker{display:none}' +
    '.g31-k summary::after{content:"";width:6px;height:6px;border-right:1.5px solid var(--text3);border-bottom:1.5px solid var(--text3);transform:rotate(45deg);margin-left:auto;transition:transform .15s}' +
    '.g31-k[open] summary::after{transform:rotate(-135deg)}' +
    '.g31-k ul{margin:6px 0 0;padding-left:16px} .g31-k li{margin:2px 0} .g31-k li small{color:var(--text3)}' +
    '.g31-k .g31-o{margin-top:6px} .g31-k .g31-o b{font-weight:600;color:var(--text)}' +
    '.g31-h{margin-top:6px;border-radius:10px;padding:7px 10px;font-size:12.5px;line-height:1.45;background:rgba(192,57,43,.07);color:var(--text2)}' +
    '.g31-h b{color:var(--text);font-weight:600}';
  document.head.appendChild(st);
})();
window._g31Cards = window._g31Cards || {};
function _g31CardLine(campId, p) {
  var all = window._g31Cards[campId]; if (!all || !all.people) return '';
  var x = all.people[p.id]; if (!x) return '';
  var out = '';
  if (x.fit_hold && !x.fit_hold.kept && !x.fit_hold.skipped) out += '<div class="g31-h"><b>May not be a buyer.</b> ' + esc(x.fit_hold.why || '') + ' Their LinkedIn steps are held: keep or skip them in the Samora panel.</div>';
  else if (x.fit_hold && x.fit_hold.skipped) out += '<div class="g31-h"><b>Skipped on LinkedIn</b> as not a buyer.</div>';
  (x.write_hold || []).forEach(function (w) { out += '<div class="g31-h"><b>SAM held the ' + (w.kind === 'invite' ? 'invite note' : 'message') + '.</b> ' + esc(w.why || '') + '. Write it your way in the Samora panel.</div>'; });
  var c = x.card;
  if (c && c.facts && c.facts.length) {
    var hook = (c.hooks || [])[0], hf = hook ? (c.facts.find(function (f) { return f.id === hook.fact; }) || null) : null;
    out += '<details class="g31-k"><summary>' + G24_ICON.spark + 'What SAM read on LinkedIn' + (c.summary ? ': ' + esc(c.summary) : '') + '</summary>' +
      '<ul>' + c.facts.map(function (f) { return '<li>' + esc(f.text) + (f.from ? ' <small>' + esc(f.from) + '</small>' : '') + '</li>'; }).join('') + '</ul>' +
      (hf ? '<div class="g31-o"><b>Best opener:</b> ' + esc(hf.text) + (hook.angle ? ' (' + esc(hook.angle) + ')' : '') + '</div>' : '<div class="g31-o">No strong opener on the profile, so SAM keeps it short and honest.</div>') +
      (c.style && (c.style.tone || c.style.notes) ? '<div class="g31-o"><b>How they write:</b> ' + esc([c.style.tone, c.style.notes].filter(Boolean).join('. ')) + '</div>' : '') +
      '</details>';
  }
  return out;
}
async function _g31Load(campId) {
  var m = window._g31Cards[campId];
  if (m && Date.now() - m.at < 120000) return false;
  var d = await _sampEdge('get_person_cards', { campaign_id: campId });
  if (!d || !d.ok) { window._g31Cards[campId] = { at: Date.now(), people: {} }; return false; }
  window._g31Cards[campId] = { at: Date.now(), people: d.people || {}, language: d.language || null };
  return Object.keys(d.people || {}).length > 0;
}
(function () {
  if (typeof _spRenderPeople === 'function' && !_spRenderPeople._g31) {
    var r = _spRenderPeople;
    _spRenderPeople = async function (id) {
      var out = await r.apply(this, arguments);
      try { if (await _g31Load(id)) _spPaintPeople(id); } catch (e) {}
      return out;
    };
    _spRenderPeople._g31 = true;
  }
})();

// ════════════════════════════════════════════════════════════════════════════
// Drop R (2026-10-23): which language SAM writes in
// A SAMpaign writes in one language, or in each person's own language. The
// chip on the SAMpaign page opens the setting; People shows each person's
// language and lets the owner set one by hand; the New SAMpaign wizard asks.
// ════════════════════════════════════════════════════════════════════════════
var G32_LANGS = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'id', name: 'Bahasa Indonesia', native: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Bahasa Melayu', native: 'Bahasa Melayu' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'de', name: 'German', native: 'Deutsch' }
];
var G32_GLOBE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/></svg>';
function _g32Name(code) { var l = G32_LANGS.find(function (x) { return x.code === code; }); return l ? l.name : 'English'; }
function _g32Label(L) {
  if (!L || !L.lang || L.lang === 'en') return 'English';
  if (L.lang === 'auto') return 'Each person\'s language';
  return _g32Name(L.lang);
}
(function () {
  if (document.getElementById('g32css')) return;
  var st = document.createElement('style'); st.id = 'g32css';
  st.textContent =
    '.g32-chip{display:inline-flex;align-items:center;gap:5px;border:0;cursor:pointer;font:inherit;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;background:rgba(var(--c-accent-rgb),.13);color:var(--c-accent-text);vertical-align:1px;margin-left:2px}' +
    '.g32-chip:hover{background:rgba(var(--c-accent-rgb),.22)} .g32-chip:focus-visible{outline:2px solid var(--c-accent);outline-offset:2px}' +
    'span.g32-chip{cursor:default;background:rgba(127,127,127,.1);color:var(--text2)}' +
    '.g32-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px}' +
    '.g32-opt{position:relative;display:flex;flex-direction:column;gap:1px;padding:10px 12px 10px 36px;border-radius:12px;border:1px solid var(--g-line);cursor:pointer;min-height:44px;justify-content:center}' +
    '.g32-opt input{position:absolute;left:12px;top:50%;transform:translateY(-50%);accent-color:var(--c-accent);margin:0}' +
    '.g32-opt b{font-size:14px;font-weight:600;color:var(--text)} .g32-opt small{font-size:11.5px;color:var(--text3)}' +
    '.g32-opt:has(input:checked){border-color:var(--c-accent);background:rgba(var(--c-accent-rgb),.08)}' +
    '.g32-opt.g32-wide{grid-column:1/-1}' +
    '.g32-box{margin-top:14px;padding:12px 14px;border-radius:12px;background:rgba(127,127,127,.07);font-size:13px;line-height:1.5;color:var(--text2)}' +
    '.g32-box b{color:var(--text);font-weight:600}' +
    '.g32-pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
    '.g32-pills label{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid var(--g-line);cursor:pointer;font-size:13px;min-height:32px}' +
    '.g32-pills label:has(input:checked){border-color:var(--c-accent);background:rgba(var(--c-accent-rgb),.1)}' +
    '.g32-pills input{accent-color:var(--c-accent);margin:0}' +
    '.g32-pl{margin-top:6px;display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;font-size:12.5px;color:var(--text2)}' +
    '.g32-pl b{color:var(--text);font-weight:600} .g32-pl small{color:var(--text3)}' +
    '.g32-pl select{font:inherit;font-size:12px;padding:3px 6px;border-radius:8px;border:1px solid var(--g-line);background:var(--surface);color:var(--text)}' +
    '@media (max-width:520px){.g32-grid{grid-template-columns:minmax(0,1fr)}}';
  document.head.appendChild(st);
})();

// ── The chip on the SAMpaign page ────────────────────────────────────────────
function g32HeaderChip(id) {
  var o = (window._sampOv || {})[id]; if (!o || !o.ok) return;
  var el = document.querySelector('#sampHeader_' + CSS.escape(id) + ' .sp-sub'); if (!el || el.querySelector('.g32-chip')) return;
  var L = o.language || { lang: 'en' };
  var label = 'Writes in ' + _g32Label(L);
  el.insertAdjacentHTML('beforeend', ' · ' + (o.campaign.is_owner && !o.campaign.archived
    ? '<button class="g32-chip" type="button" onclick="g32OpenLang(\'' + esc(id) + '\')" title="Change the language SAM writes in">' + G32_GLOBE + esc(label) + '</button>'
    : '<span class="g32-chip">' + G32_GLOBE + esc(label) + '</span>'));
}
(function () {
  if (typeof _spRenderHeader === 'function' && !_spRenderHeader._g32) {
    var r = _spRenderHeader;
    _spRenderHeader = function (id) { var out = r.apply(this, arguments); try { g32HeaderChip(id); } catch (e) {} return out; };
    _spRenderHeader._g32 = true;
  }
  if (typeof sampOpenEdit === 'function' && !sampOpenEdit._g32) {
    var e = sampOpenEdit;
    sampOpenEdit = function (id) {
      var out = e.apply(this, arguments);
      try {
        var f = document.getElementById('spEdFocus'), o = (window._sampOv || {})[id];
        if (f && o && o.ok && !document.getElementById('spEdLang')) f.closest('label').insertAdjacentHTML('afterend',
          '<div class="sp-fld" id="spEdLang">Language<small>Emails, LinkedIn notes and messages, and answers to replies.</small><div><button class="g-btn sp-sm" type="button" onclick="document.getElementById(\'sampEditModal\').remove();g32OpenLang(\'' + esc(id) + '\')">' + G32_GLOBE + ' Writes in ' + esc(_g32Label(o.language)) + ' · Change</button></div></div>');
      } catch (x) {}
      return out;
    };
    sampOpenEdit._g32 = true;
  }
})();

// ── The setting ──────────────────────────────────────────────────────────────
async function g32OpenLang(id) {
  var old = document.getElementById('g32Modal'); if (old) old.remove();
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'g32Modal';
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  m.addEventListener('keydown', function (e) { if (e.key === 'Escape') m.remove(); });
  var o = (window._sampOv || {})[id] || {}, name = o.campaign ? o.campaign.name : 'this SAMpaign';
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-labelledby="g32T"><h3 id="g32T">Which language SAM writes in</h3>' +
    '<div class="sp-small">For <b>' + esc(name) + '</b>. Emails, LinkedIn notes and messages, and answers to replies. An answer always follows the language they wrote in.</div>' +
    '<div id="g32Body"><div class="sp-empty">Loading…</div></div></div>';
  document.body.appendChild(m);
  var d = await _sampEdge('get_outreach_language', { campaign_id: id });
  if (!d || !d.ok) { document.getElementById('g32Body').innerHTML = '<div class="g32-box">' + esc((d && d.error) || 'Could not load the setting.') + '</div>'; return; }
  window._g32 = { id: id, d: d, lang: d.language.lang, fallback: d.language.fallback || 'en', approve: d.language.lang === 'en' ? true : d.language.approve_all !== false, th: d.th_polite || '' };
  _g32Paint();
  var first = m.querySelector('input[name="g32l"]:checked') || m.querySelector('input[name="g32l"]'); if (first) first.focus();
}
function _g32Paint() {
  var S = window._g32; if (!S) return;
  var body = document.getElementById('g32Body'); if (!body) return;
  var opts = G32_LANGS.map(function (l) {
    return '<label class="g32-opt"><input type="radio" name="g32l" value="' + l.code + '"' + (S.lang === l.code ? ' checked' : '') + ' onchange="window._g32.lang=this.value;_g32Paint()"><b>' + esc(l.native) + '</b>' + (l.native !== l.name ? '<small>' + esc(l.name) + '</small>' : '<small>&nbsp;</small>') + '</label>';
  }).join('') + '<label class="g32-opt g32-wide"><input type="radio" name="g32l" value="auto"' + (S.lang === 'auto' ? ' checked' : '') + ' onchange="window._g32.lang=this.value;_g32Paint()"><b>Each person\'s own language</b><small>From where they are: their LinkedIn location, their name or their email address</small></label>';
  var more = '';
  if (S.lang === 'auto') {
    more += '<div class="g32-box"><b>How SAM picks.</b> Thai for people in Thailand, Bahasa Indonesia for Indonesia, Vietnamese for Vietnam, and French, German or Spanish for their countries. Malaysia, Singapore, India and the Gulf get your other language, as business there is mostly in English. You can set anyone by hand in People.' +
      '<label class="sp-fld" style="margin-top:10px">Everyone else<select id="g32Fb" onchange="window._g32.fallback=this.value">' + G32_LANGS.map(function (l) { return '<option value="' + l.code + '"' + (S.fallback === l.code ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select></label></div>';
  }
  if (S.lang === 'th' || S.lang === 'auto') {
    var p = function (v, label) { return '<label><input type="radio" name="g32th" value="' + v + '"' + (S.th === v || (!S.th && v === 'none') ? ' checked' : '') + ' onchange="window._g32.th=this.value">' + label + '</label>'; };
    more += '<div class="g32-box"><b>Your polite ending in Thai.</b> Thai writers end polite sentences differently, and SAM never guesses it from your name. This is yours, in every SAMpaign.' +
      '<div class="g32-pills" role="radiogroup" aria-label="Polite ending in Thai">' + p('khrap', 'ครับ <small>(khrap)</small>') + p('kha', 'ค่ะ <small>(kha)</small>') + p('none', 'Neither: formal Thai') + '</div></div>';
  }
  if (S.lang !== 'en') {
    more += '<label class="sp-check"><input type="checkbox" id="g32Ap"' + (S.approve ? ' checked' : '') + ' onchange="window._g32.approve=this.checked"><span><b>Show me every LinkedIn note and message before it goes</b><br><span class="sp-small">Recommended for a new language: you read each one in the Samora panel. Emails always wait for you as drafts.</span></span></label>';
  }
  body.innerHTML = '<div class="g32-grid" role="radiogroup" aria-label="Language">' + opts + '</div>' + more + '<div id="g32Pend"></div>' +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'g32Modal\').remove()">Cancel</button><span class="sp-acts"><button class="g-btn sp-gold" type="button" id="g32Save" onclick="g32Save()">Save</button></span></div>';
}
function _g32PendCount(p) {
  if (!p) return { n: 0, notes: 0, messages: 0, drafts: 0 };
  var dr = 0; Object.keys(p.drafts || {}).forEach(function (k) { dr += (p.drafts[k] || []).length; });
  var n = (p.notes || []).length, ms = (p.messages || []).length;
  return { n: n + ms + dr, notes: n, messages: ms, drafts: dr };
}
async function g32Save() {
  var S = window._g32; if (!S) return;
  var btn = document.getElementById('g32Save'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  var body = { campaign_id: S.id, lang: S.lang, fallback: S.fallback, approve_all: S.approve };
  if (S.lang === 'th' || S.lang === 'auto') body.th_polite = S.th || 'none';
  var d = await _sampEdge('set_outreach_language', body);
  if (!d || !d.ok) { if (btn) { btn.disabled = false; btn.textContent = 'Save'; } showToast((d && d.error) || 'Could not save'); return; }
  S.d = d;
  try { await _sampLoadOverview(S.id); } catch (e) {}
  try { if (window._g31Cards) delete window._g31Cards[S.id]; } catch (e) {}
  var c = _g32PendCount(d.pending);
  if (!c.n) { var mm = document.getElementById('g32Modal'); if (mm) mm.remove(); showToast(d.note || 'Saved'); try { if (window._sampTab === 'people') setSampTab(S.id, 'people'); } catch (e) {} return; }
  var parts = [];
  if (c.notes) parts.push(_spPlural(c.notes, 'invite note'));
  if (c.messages) parts.push(_spPlural(c.messages, 'LinkedIn message'));
  if (c.drafts) parts.push(_spPlural(c.drafts, 'email draft'));
  var target = S.lang === 'auto' ? 'each person\'s language' : _g32Name(S.lang);
  var pend = document.getElementById('g32Pend');
  if (pend) pend.innerHTML = '<div class="g32-box" role="status"><b>Saved.</b> ' + esc(d.note || '') + '<br><br>SAM had already written ' + esc(parts.join(', ')) + ' in another language. They have not gone. Your own words are never touched.' +
    '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px"><button class="g-btn sp-gold sp-sm" type="button" id="g32Rw" onclick="g32Rewrite()">Rewrite them in ' + esc(target) + '</button><button class="g-btn sp-sm" type="button" onclick="document.getElementById(\'g32Modal\').remove()">Keep them as they are</button></div><div class="sp-small" id="g32RwMsg" style="margin-top:8px">Uses SAM\'s AI once per text.</div></div>';
  var foot = document.querySelector('#g32Modal .sp-foot'); if (foot) foot.remove();
}
async function g32Rewrite() {
  var S = window._g32; if (!S || !S.d) return;
  var p = S.d.pending || {}, btn = document.getElementById('g32Rw'), msg = document.getElementById('g32RwMsg');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="g24-spin" aria-hidden="true"></span> Rewriting…'; }
  var done = 0, held = 0, errs = [];
  var say = function (t) { if (msg) msg.textContent = t; };
  var chunk = function (a, n) { var out = []; for (var i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
  var li = [['invite', p.notes || []], ['message', p.messages || []]];
  for (var k = 0; k < li.length; k++) {
    var parts = chunk(li[k][1], 12);
    for (var j = 0; j < parts.length; j++) {
      say('LinkedIn: ' + done + ' rewritten so far…');
      var r = await _sampEdge('write_linkedin_notes', { campaign_id: S.id, kind: li[k][0], contact_ids: parts[j], batch: 12 });
      if (r && r.ok) { done += r.written || 0; held += (r.held || 0); } else errs.push((r && r.error) || 'LinkedIn');
    }
  }
  var launches = Object.keys(p.drafts || {});
  for (var x = 0; x < launches.length; x++) {
    var ids = p.drafts[launches[x]] || [], groups = chunk(ids, 6);
    for (var y = 0; y < groups.length; y++) {
      say('Emails: ' + done + ' rewritten so far…');
      var w = await _sampEdge('write_sampaign_drafts', { campaign_id: S.id, launch: Number(launches[x]), replace: true, contact_ids: groups[y], batch: 6 });
      if (w && w.ok) done += w.written || 0; else errs.push((w && w.error) || 'emails');
    }
  }
  var mm = document.getElementById('g32Modal'); if (mm) mm.remove();
  showToast(errs.length && !done ? errs[0] : 'Rewrote ' + done + (held ? '. SAM held ' + held + ' for you in the Samora panel' : '') + (errs.length ? '. Some did not: ' + errs[0] : ''));
  try { await _sampLoadOverview(S.id); setSampTab(S.id, window._sampTab); } catch (e) {}
}

// ── People: each person's language ───────────────────────────────────────────
function _g32PersonLine(campId, p) {
  var all = (window._g31Cards || {})[campId]; if (!all || !all.people) return '';
  var x = all.people[p.id]; if (!x || !x.lang) return '';
  var o = (window._sampOv || {})[campId], own = o && o.ok && o.campaign.is_owner;
  var sel = own ? '<label class="sp-small" style="display:inline-flex;align-items:center;gap:6px"><span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Language for ' + esc(p.name || '') + '</span><select onchange="g32SetPerson(\'' + esc(campId) + '\',\'' + esc(p.id) + '\',this.value)"><option value=""' + (x.lang.set !== 'person' ? ' selected' : '') + '>As the SAMpaign</option>' +
    G32_LANGS.map(function (l) { return '<option value="' + l.code + '"' + (x.lang.set === 'person' && x.lang.code === l.code ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select></label>' : '';
  return '<div class="g32-pl">' + G32_GLOBE + '<span>Writes to them in <b>' + esc(x.lang.name) + '</b></span>' + (x.lang.why ? '<small>' + esc(x.lang.why) + '</small>' : '') + sel + '</div>';
}
async function g32SetPerson(campId, cid, code) {
  var d = await _sampEdge('set_person_language', { contact_id: cid, lang: code || null });
  if (!d || !d.ok) { showToast((d && d.error) || 'Could not save'); return; }
  showToast(d.note || 'Saved');
  try { var all = window._g31Cards[campId]; if (all && all.people && all.people[cid]) all.people[cid].lang = d.lang; _spPaintPeople(campId); } catch (e) {}
}
(function () {
  if (typeof _g31CardLine === 'function' && !_g31CardLine._g32) {
    var c = _g31CardLine;
    _g31CardLine = function (campId, p) { var a = ''; try { a = _g32PersonLine(campId, p); } catch (e) {} return a + c.apply(this, arguments); };
    _g31CardLine._g32 = true;
  }
})();

// ── New SAMpaign: the language, on the goal step ─────────────────────────────
function _g32Suggest(W) {
  var t = String((W.region || '') + ' ' + (W.listRegion || '')).toLowerCase();
  if (/thai|bangkok/.test(t)) return { code: 'th', where: 'Thailand' };
  if (/indonesia|jakarta/.test(t)) return { code: 'id', where: 'Indonesia' };
  if (/vietnam|viet nam|hanoi|ho chi minh/.test(t)) return { code: 'vi', where: 'Vietnam' };
  if (/france|paris/.test(t)) return { code: 'fr', where: 'France' };
  if (/germany|deutschland|austria/.test(t)) return { code: 'de', where: t.indexOf('austria') !== -1 ? 'Austria' : 'Germany' };
  if (/spain|españa|mexico|méxico/.test(t)) return { code: 'es', where: /spain|españa/.test(t) ? 'Spain' : 'Mexico' };
  return null;
}
function _g32WizLang(W) {
  var sug = _g32Suggest(W);
  if (W.lang === undefined) W.lang = sug ? sug.code : 'en';
  var opts = G32_LANGS.map(function (l) { return '<option value="' + l.code + '"' + (W.lang === l.code ? ' selected' : '') + '>' + esc(l.native === l.name ? l.name : l.native + ' · ' + l.name) + '</option>'; }).join('') +
    '<option value="auto"' + (W.lang === 'auto' ? ' selected' : '') + '>Each person\'s own language</option>';
  var th = (W.lang === 'th' || W.lang === 'auto') ? '<div class="g32-pills" role="radiogroup" aria-label="Your polite ending in Thai" style="margin-top:8px">' +
    [['khrap', 'ครับ'], ['kha', 'ค่ะ'], ['none', 'Neither: formal Thai']].map(function (x) { return '<label><input type="radio" name="spw_thp" value="' + x[0] + '"' + ((W.thPolite || 'none') === x[0] ? ' checked' : '') + '>' + x[1] + '</label>'; }).join('') + '</div><div class="sp-small" style="margin-top:4px">Your polite ending in Thai. SAM never guesses it.</div>' : '';
  return '<label class="sp-fld">SAM writes in <small>' + (sug && W.lang === sug.code ? 'Suggested for ' + esc(sug.where) + '. ' : '') + (W.lang !== 'en' ? 'You approve every LinkedIn note and message before it goes.' : 'Emails, LinkedIn notes and answers to replies.') + '</small>' +
    '<select id="spw_lang" onchange="_spWizSave();_spWizRender()">' + opts + '</select></label>' + th;
}

// ════════════════════════════════════════════════════════════════════════════
// Drop S (2026-10-28): rewrite all, take people out, SAMpaign size
// ════════════════════════════════════════════════════════════════════════════
(function () {
  if (document.getElementById('g34css')) return;
  var st = document.createElement('style'); st.id = 'g34css';
  st.textContent =
    '.g34-ta{width:100%;min-height:96px;resize:vertical;font:inherit;font-size:14px;line-height:1.5;padding:10px 12px;border-radius:12px;border:1px solid var(--g-line);background:var(--surface);color:var(--text)}' +
    '.g34-ta:focus{outline:2px solid var(--c-accent);outline-offset:1px}' +
    '.g34-opts{display:flex;flex-direction:column;gap:8px;margin-top:14px}' +
    '.g34-opt{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;border:1px solid var(--g-line);cursor:pointer;font-size:13.5px}' +
    '.g34-opt:has(input:checked){border-color:var(--c-accent);background:rgba(var(--c-accent-rgb),.07)}' +
    '.g34-opt input{margin-top:3px;accent-color:var(--c-accent)} .g34-opt b{font-weight:600;color:var(--text)} .g34-opt small{display:block;color:var(--text3);font-size:12px;margin-top:2px}' +
    '.g34-opt.dis{opacity:.5;cursor:not-allowed}' +
    '.g34-note{margin-top:12px;font-size:12.5px;color:var(--text2);line-height:1.5}' +
    '.g34-rm{border:0;background:none;font:inherit;font-size:12px;color:var(--text3);cursor:pointer;padding:4px 6px;border-radius:8px}' +
    '.g34-rm:hover{color:#B3412E;background:rgba(192,57,43,.07)} .g34-rm:focus-visible{outline:2px solid var(--c-accent)}' +
    '.sd-co header .g34-rm{margin-left:auto;align-self:center}' +
    '.g34-size{margin-top:14px;padding:12px 14px;border-radius:12px;background:rgba(127,127,127,.06)}' +
    '.g34-size .sp-row2{margin-top:0} .g34-size input[type=number]{max-width:100%}' +
    '.g34-sizet{font-size:12px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--text3)}';
  document.head.appendChild(st);
})();
function _g34Modal(id, title, inner) {
  var old = document.getElementById(id); if (old) old.remove();
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = id;
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  m.addEventListener('keydown', function (e) { if (e.key === 'Escape') m.remove(); });
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + '</h3>' + inner + '</div>';
  document.body.appendChild(m);
  return m;
}
var G34_IDEAS = ['Use our case study: 32% more outlets covered in 90 days', 'Shorter: under 80 words', 'Ask for a 20 minute call next week', 'Lead with their company\'s recent news'];

// ── Rewrite every email with one instruction ───────────────────────────────
async function g34RewriteAll(campaignId) {
  var sends = (window._g34Sends || {})[campaignId];
  if (!sends) { try { var r = await _sampEdge('list_sampaign_scheduled_sends', { campaign_id: campaignId }); sends = r.ok ? r.sends || [] : []; } catch (e) { sends = []; } }
  var launch = Number(window._sampLaunch) || 1;
  var inWave = sends.filter(function (x) { return (x.launch || 1) === launch; });
  var dr = inWave.filter(function (x) { return x.status === 'draft'; }), qd = inWave.filter(function (x) { return x.status === 'pending'; });
  var drEd = dr.filter(function (x) { return x.edited_by_human; }).length, qdEd = qd.filter(function (x) { return x.edited_by_human; }).length;
  var wave = launch === 1 ? 'first email' : 'follow-up ' + (launch - 1);
  var opt = function (idv, on, dis, t, sub) { return '<label class="g34-opt' + (dis ? ' dis' : '') + '"><input type="checkbox" id="' + idv + '"' + (on && !dis ? ' checked' : '') + (dis ? ' disabled' : '') + '><span><b>' + t + '</b><small>' + sub + '</small></span></label>'; };
  var m = _g34Modal('g34RwAll', 'Rewrite with SAM',
    '<div class="sp-small">Every ' + esc(wave) + ' in this SAMpaign, with one instruction. Each stays written for its own person.</div>' +
    '<label class="sp-fld">What should change in every email?<textarea class="g34-ta" id="g34RwIn" maxlength="800" placeholder="Use our case study: 32% more outlets covered in 90 days. Keep it under 90 words."></textarea></label>' +
    '<div class="sp-chips" style="margin-top:8px">' + G34_IDEAS.map(function (x, i) { return '<button type="button" class="sp-chip g18-sug" onclick="var t=document.getElementById(\'g34RwIn\');t.value=(t.value?t.value+\'. \':\'\')+G34_IDEAS[' + i + '];t.focus()">' + esc(x) + '</button>'; }).join('') + '</div>' +
    '<div class="g34-opts">' +
      opt('g34Dr', true, !dr.length, _spPlural(dr.length, 'draft'), 'Not scheduled yet.') +
      opt('g34Qd', false, !qd.length, _spPlural(qd.length, 'queued email'), 'Scheduled, not sent. Each keeps its send time.') +
      (drEd + qdEd ? opt('g34Ed', false, false, 'Also the ' + _spPlural(drEd + qdEd, 'one') + ' you edited by hand', 'Left as you wrote them unless you tick this.') : '') +
    '</div>' +
    '<div class="g34-note">Sent emails are never changed. Numbers, results and customer names you write here are used as you give them. SAM still checks every email before it is saved.</div>' +
    '<div class="sp-small" id="g34RwMsg" role="status" style="margin-top:10px"></div>' +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'g34RwAll\').remove()">Cancel</button><span class="sp-acts"><button class="g-btn sp-gold" type="button" id="g34RwGo">' + SP_ICON.spark + ' Rewrite</button></span></div>');
  var inp = document.getElementById('g34RwIn'); inp.focus();
  inp.addEventListener('input', function () { var mm = document.getElementById('g34RwMsg'); if (mm && !document.getElementById('g34RwGo').disabled) mm.textContent = ''; });
  document.getElementById('g34RwGo').onclick = async function () {
    var ins = inp.value.trim(), msg = document.getElementById('g34RwMsg');
    var wDr = document.getElementById('g34Dr').checked, wQd = document.getElementById('g34Qd').checked, ed = !!(document.getElementById('g34Ed') || {}).checked;
    if (!ins) { msg.textContent = 'Write what should change first.'; inp.focus(); return; }
    if (!wDr && !wQd) { msg.textContent = 'Pick drafts, queued emails, or both.'; return; }
    var which = wDr && wQd ? 'both' : wQd ? 'queued' : 'drafts';
    var pool = (wDr ? dr : []).concat(wQd ? qd : []).filter(function (x) { return ed || !x.edited_by_human; });
    var ids = pool.map(function (x) { return x.contact_id; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (!ids.length) { msg.textContent = 'Nothing to rewrite with these choices.'; return; }
    this.disabled = true;
    var done = 0, err = null;
    msg.innerHTML = '<span class="g24-spin" aria-hidden="true"></span> Rewriting ' + ids.length + '…';
    var sR = await _s1Write({ action: 'write_sampaign_drafts', ids: ids, chunk: 4, conc: 3, base: { campaign_id: campaignId, launch: launch, replace: true, which: which, include_edited: ed, instruction: ins, sender_name: (typeof _sigNameHint === 'function' ? _sigNameHint().split(' ')[0] : ''), sender_full_name: (typeof _sigNameHint === 'function' ? _sigNameHint() : '') },
      onProgress: function (st) { msg.innerHTML = '<span class="g24-spin" aria-hidden="true"></span> Rewritten ' + st.written + ' of ' + st.total + '…'; } });
    done = sR.written; err = sR.err;
    m.remove();
    showToast(err && !done ? err : 'Rewrote ' + _spPlural(done, 'email') + (err ? '. Stopped: ' + err : '. Same places, same send times.'));
    loadSampaignSendQueue(campaignId);
  };
}

// ── Rewrite every LinkedIn note or message ─────────────────────────────────
function g34LiRewriteAll(campaignId, kind) {
  var L = (window._g23Li || {})[campaignId], d = L && L.data; if (!d) return;
  var pick = function (own) { return d.people.filter(function (p) {
    var st = kind === 'invite' ? p.invite : p.message_step; if (st && st.status === 'removed') return false;
    if (kind === 'invite') return p.can_edit_note && p.note && (own || p.note_by !== 'rep');
    return p.can_edit_message && p.message && p.stage === 'connected';
  }); };
  var sam = pick(false), all = pick(true), mine = all.length - sam.length;
  var what = kind === 'invite' ? 'invite note' : 'message';
  var m = _g34Modal('g34LiAll', 'Rewrite with SAM',
    '<div class="sp-small">Every LinkedIn ' + what + ' not sent yet, with one instruction. Each stays written for its own person and within your plan\'s length.</div>' +
    '<label class="sp-fld">What should change?<textarea class="g34-ta" id="g34LiIn" maxlength="800" placeholder="Mention the case study. Shorter, no question at the end."></textarea></label>' +
    '<div class="g34-opts">' + (mine ? '<label class="g34-opt"><input type="checkbox" id="g34LiOwn"><span><b>Also the ' + _spPlural(mine, 'one') + ' you wrote</b><small>Left as you wrote them unless you tick this.</small></span></label>' : '') + '</div>' +
    '<div class="g34-note">' + _spPlural(sam.length, what) + ' written by SAM will be rewritten. SAM checks each one again before it can go.</div>' +
    '<div class="sp-small" id="g34LiMsg" role="status" style="margin-top:10px"></div>' +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'g34LiAll\').remove()">Cancel</button><span class="sp-acts"><button class="g-btn sp-gold" type="button" id="g34LiGo"' + (all.length ? '' : ' disabled') + '>' + SP_ICON.spark + ' Rewrite</button></span></div>');
  document.getElementById('g34LiIn').focus();
  document.getElementById('g34LiGo').onclick = async function () {
    var ins = document.getElementById('g34LiIn').value.trim(), msg = document.getElementById('g34LiMsg');
    if (!ins) { msg.textContent = 'Write what should change first.'; return; }
    var list = (document.getElementById('g34LiOwn') || {}).checked ? all : sam;
    if (!list.length) { msg.textContent = 'Nothing to rewrite with these choices.'; return; }
    this.disabled = true;
    var done = 0, held = 0, err = null;
    msg.innerHTML = '<span class="g24-spin" aria-hidden="true"></span> Rewriting ' + list.length + '…';
    var sL = await _s1Write({ action: 'write_linkedin_notes', ids: list.map(function (p) { return p.id; }), chunk: 6, conc: 3, base: { campaign_id: campaignId, kind: kind, instruction: ins },
      onProgress: function (st) { msg.innerHTML = '<span class="g24-spin" aria-hidden="true"></span> Rewritten ' + (st.written + st.held) + ' of ' + st.total + '…'; } });
    done = sL.written; held = sL.held; err = sL.err;
    m.remove();
    showToast(err && !done ? err : 'Rewrote ' + _spPlural(done, what) + (held ? '. ' + held + ' held for you in the Samora panel' : '') + (err ? '. Stopped: ' + err : '.'));
    await _g23LiLoad(campaignId, true); g23RenderLi(campaignId);
  };
}

// ── Take people or a company out of a running SAMpaign ─────────────────────
function g34Remove(campaignId, what, label, count) {
  var many = (what.contact_ids || []).length > 1 || (what.account_ids || []).length;
  var m = _g34Modal('g34RmM', many ? 'Remove ' + label + '?' : 'Remove ' + label + '?',
    '<div class="g34-note" style="margin-top:6px">' + (what.account_ids && what.account_ids.length ? 'The company leaves this SAMpaign\'s list, with ' + _spPlural(count || (what.contact_ids || []).length, 'person', 'people') + '. ' : '') +
      'Nothing more goes to ' + (many ? 'them' : 'this person') + ': emails and LinkedIn steps not yet sent are cancelled.</div>' +
    '<div class="g34-note">People never written to leave the SAMpaign. Anyone already written to keeps their history here, and a later reply from them still shows.</div>' +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'g34RmM\').remove()">Keep</button><span class="sp-acts"><button class="g-btn sp-gold" type="button" id="g34RmGo">Remove</button></span></div>');
  document.getElementById('g34RmGo').focus();
  document.getElementById('g34RmGo').onclick = async function () {
    this.disabled = true; this.textContent = 'Removing…';
    var d = await _sampEdge('remove_from_sampaign', Object.assign({ campaign_id: campaignId }, what));
    m.remove();
    if (!d.ok) { showToast(d.error || 'Could not remove'); return; }
    window._g34Undo = { campaignId: campaignId, ids: d.kept_ids || [] };
    showToast(d.note || 'Removed');
    try { await _spRenderPeople(campaignId, true); } catch (e) {}
    try { _sampLoadOverview(campaignId); } catch (e) {}
  };
}
async function g34Restore(campaignId, cid) {
  var d = await _sampEdge('restore_to_sampaign', { campaign_id: campaignId, contact_ids: [cid] });
  showToast(d.ok ? d.note : (d.error || 'Could not bring them back'));
  try { await _spRenderPeople(campaignId, true); } catch (e) {}
}

// ── SAMpaign size and "Leadership prospects only" ──────────────────────────
function _g34SizeHtml(v, prefix) {
  v = v || {};
  return '<div class="g34-size"><div class="g34-sizet">How many people</div>' +
    '<div class="sp-row2"><label class="sp-fld">Most people in this SAMpaign <small>optional</small><input type="number" min="1" max="1000" id="' + prefix + 'MaxT" value="' + esc(v.maxTotal || '') + '" placeholder="No limit"></label>' +
    '<label class="sp-fld">Most per company <small>optional</small><input type="number" min="1" max="50" id="' + prefix + 'MaxC" value="' + esc(v.maxPerCompany || '') + '" placeholder="15"></label></div>' +
    '<label class="sp-check"><input type="checkbox" id="' + prefix + 'Lead"' + (v.leadersOnly ? ' checked' : '') + '><span><b>Leadership prospects only</b><br><span class="sp-small">Founders, owners, CEOs and other C-level, Presidents, Managing Directors and Partners. Everyone else SAM finds is left out.</span></span></label></div>';
}
function _g34SizeRead(prefix) {
  var n = function (idv, max) { var el = document.getElementById(idv); var x = el ? parseInt(el.value, 10) : NaN; return x > 0 ? Math.min(max, x) : null; };
  var lead = document.getElementById(prefix + 'Lead');
  return { maxTotal: n(prefix + 'MaxT', 1000), maxPerCompany: n(prefix + 'MaxC', 50), leadersOnly: !!(lead && lead.checked) };
}
async function _g34SizeSave(campaignId, v) {
  if (!campaignId || !v) return;
  try { await _sampEdge('save_org_setting', { key: 'scout_profile_size_' + campaignId, value: JSON.stringify(v) }); } catch (e) {}
}
(function () {
  if (typeof openSampaignScoutProfile === 'function' && !openSampaignScoutProfile._g34) {
    var o = openSampaignScoutProfile;
    openSampaignScoutProfile = async function (campaignId) {
      var out = await o.apply(this, arguments);
      try {
        var cur = {};
        var r = await _sampEdge('get_org_setting', { key: 'scout_profile_size_' + campaignId });
        if (r && r.value) { try { cur = (typeof r.value === 'string' ? JSON.parse(r.value) : r.value) || {}; } catch (e) { cur = {}; } }
        var btn = document.querySelector('#samp-scout-profile-modal button[onclick="saveSampaignScoutProfile()"]');
        if (btn && !document.getElementById('g34hMaxT')) btn.insertAdjacentHTML('beforebegin', '<div style="margin-bottom:14px">' + _g34SizeHtml(cur, 'g34h') + '</div>');
      } catch (e) {}
      return out;
    };
    openSampaignScoutProfile._g34 = true;
  }
  if (typeof saveSampaignScoutProfile === 'function' && !saveSampaignScoutProfile._g34) {
    var sv = saveSampaignScoutProfile;
    saveSampaignScoutProfile = async function () {
      var size = document.getElementById('g34hMaxT') ? _g34SizeRead('g34h') : null, cid = (typeof _sampScoutCampaignId !== 'undefined') ? _sampScoutCampaignId : null;
      if (size && cid) await _g34SizeSave(cid, size);
      return sv.apply(this, arguments);
    };
    saveSampaignScoutProfile._g34 = true;
  }
})();

// ════════════════════════════════════════════════════════════════════════════
// Drop S1 (28 Oct 2026): write every note and email in one go, in parallel.
// The server lists who needs one; the app writes them in small groups, three
// at a time. A group the server stopped for time is split and tried again; a
// rate limit slows to one at a time and waits. Older servers: the old loop.
// ════════════════════════════════════════════════════════════════════════════
async function _s1Write(o) {
  var list = o.ids ? { ok: true, ids: o.ids } : await _sampEdge(o.action, Object.assign({}, o.base, { list_only: true }));
  if (list.ok && !Array.isArray(list.ids)) return null;
  if (!list.ok) return { written: 0, held: 0, total: 0, missed: [], rewritten: 0, err: list.error || 'SAM could not start.' };
  var ids = list.ids.slice(), total = ids.length, queue = [];
  for (var i = 0; i < ids.length; i += o.chunk) queue.push({ ids: ids.slice(i, i + o.chunk), tries: 0 });
  var st = { written: 0, held: 0, missed: [], rewritten: 0, err: null, total: total, conc: Math.max(1, o.conc || 3), pauseUntil: 0, busy: 0 };
  var stopped = function () { return !!(o.isStopped && o.isStopped()); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  if (o.onProgress) o.onProgress(st);
  async function worker(n) {
    while (!st.err && !stopped()) {
      if (n >= st.conc) return;
      var w = st.pauseUntil - Date.now();
      if (w > 0) { if (o.onPace) o.onPace(Math.ceil(w / 1000)); await sleep(Math.min(w, 1000)); continue; }
      var job = queue.shift();
      if (!job) { if (st.busy) { await sleep(400); continue; } return; }
      st.busy++;
      var d;
      try { d = await _sampEdge(o.action, Object.assign({}, o.base, { contact_ids: job.ids, batch: job.ids.length })); } catch (e) { d = { ok: false, _stopped: true, error: e.message }; }
      st.busy--;
      if (!d.ok) {
        job.tries++;
        if (d.reason === 'quota' && !d.daily && job.tries <= 6) { st.conc = 1; st.pauseUntil = Date.now() + Math.min(60, Math.max(10, d.retry_after || 30)) * 1000; queue.unshift(job); continue; }
        if (d.reason === 'overloaded' && job.tries <= 4) { st.pauseUntil = Date.now() + 20000; queue.unshift(job); continue; }
        if ((d._stopped || d._status >= 500) && job.tries <= 2) {
          if (job.ids.length > 1) { var h = Math.ceil(job.ids.length / 2); queue.unshift({ ids: job.ids.slice(0, h), tries: job.tries }, { ids: job.ids.slice(h), tries: job.tries }); }
          else queue.unshift(job);
          continue;
        }
        st.err = d.error || 'SAM could not write these.'; return;
      }
      st.written += d.written || 0; st.held += d.held || 0; st.missed = st.missed.concat(d.missed || []);
      if (d.review) st.rewritten += d.review.rewritten || 0;
      if (o.onProgress) o.onProgress(st);
    }
  }
  var ws = []; for (var k = 0; k < st.conc; k++) ws.push(worker(k));
  await Promise.all(ws);
  return st;
}
function _s1Bar(msgId, barId, label) {
  return function (st) {
    var done = st.written + st.held, msg = document.getElementById(msgId), bar = document.getElementById(barId);
    if (msg) msg.textContent = done + ' of ' + st.total + ' ' + label + (done < st.total ? '…' : '.');
    if (bar) bar.style.width = Math.max(4, Math.round(done / Math.max(1, st.total) * 100)) + '%';
  };
}
function _s1Pace(msgId) { return function (s) { var m = document.getElementById(msgId); if (m) m.textContent = 'SAM is pacing itself. Carrying on in ' + s + 's…'; }; }

// ════════════════════════════════════════════════════════════════════════════
// Drop T (2026-10-29): the deal journey. After a reply SAM follows what
// happened next, from evidence: the meeting and its notes, the proposal going
// out, their answer. Each step quotes the sentence that proves it, and the
// next step comes to Today. The pipeline moves when the rep says so.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  if (document.getElementById('g36css')) return;
  var st = document.createElement('style'); st.id = 'g36css';
  st.textContent =
    '.g36-card{margin:0 0 14px;padding:14px 16px;border-radius:16px;border:1px solid var(--g-line);background:var(--surface)}' +
    '.g36-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.g36-h h4{margin:0;font-size:15px;font-weight:650;color:var(--text)}' +
    '.g36-h .g36-sync{margin-left:auto;border:0;background:none;font:inherit;font-size:12.5px;color:var(--c-accent-text);cursor:pointer;padding:4px 6px;border-radius:8px}' +
    '.g36-h .g36-sync:focus-visible{outline:2px solid var(--c-accent)}' +
    '.g36-sub{font-size:12.5px;color:var(--text3);margin-top:2px}' +
    '.g36-flow{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 4px}.g36-flow span{font-size:12px;padding:4px 10px;border-radius:999px;background:rgba(127,127,127,.08);color:var(--text2)}.g36-flow span b{font-weight:700;color:var(--text);margin-left:4px}' +
    '.g36-flow span.on{background:rgba(var(--c-accent-rgb),.12);color:var(--c-accent-text)}' +
    '.g36-p{padding:12px 0;border-top:1px solid var(--g-line)}.g36-p:first-of-type{border-top:0}' +
    '.g36-pt{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.g36-pt b{font-weight:650;color:var(--text)}.g36-pt small{color:var(--text3);font-size:12.5px}' +
    '.g36-st{display:inline-flex;align-items:center;font-size:11.5px;font-weight:650;letter-spacing:.02em;padding:3px 9px;border-radius:999px;background:rgba(127,127,127,.1);color:var(--text2);margin-right:6px;vertical-align:1px}' +
    '.g36-st.ask{background:var(--c-partial-wash);color:var(--c-partial)}.g36-st.sent{background:var(--c-info-wash);color:var(--c-info)}.g36-st.neg{background:rgba(var(--c-accent-rgb),.14);color:var(--c-accent-text)}.g36-st.won{background:var(--c-verified-wash);color:var(--c-verified)}.g36-st.lost,.g36-st.risk{background:var(--c-risk-wash);color:var(--c-risk)}' +
    '.g36-ev{font-size:12.5px;color:var(--text2);line-height:1.5;margin-top:6px;padding-left:10px;border-left:2px solid var(--g-line)}.g36-ev span{color:var(--text3);white-space:nowrap}' +
    '.g36-nx{font-size:13px;color:var(--text);margin-top:8px}.g36-nx.late{color:var(--c-risk)}' +
    '.g36-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}' +
    '.g36-why{margin:10px 0 0;padding:0;list-style:none}.g36-why li{margin-top:6px}' +
    '.g36-row2{display:flex;gap:10px;margin-top:12px}.g36-row2 label{flex:1}.g36-row2 select,.g36-row2 input{width:100%}' +
    '@media (max-width:600px){.g36-h .g36-sync{margin-left:0}.g36-acts .g-btn{flex:1 1 auto}}';
  document.head.appendChild(st);
})();
var G36_CLS = { replied: '', meeting_booked: '', meeting_held: '', proposal_requested: 'ask', proposal_sent: 'sent', negotiation: 'neg', committed: 'won', lost: 'lost' };
var G36_FLOW = [['meeting_held', 'Met'], ['proposal_requested', 'Proposal asked'], ['proposal_sent', 'Proposal sent'], ['negotiation', 'Negotiating'], ['committed', 'Committed']];
function _g36Day(iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
function _g36Pill(stage, label) { return '<span class="g36-st ' + (G36_CLS[stage] || '') + '">' + esc(label || stage) + '</span>'; }
function _g36Ev(ev) {
  if (!ev) return '';
  var q = String(ev.quote || '').replace(/^Met: /, 'Met: ');
  return '<div class="g36-ev">' + (q ? '“' + esc(q.length > 170 ? q.slice(0, 167) + '…' : q) + '” ' : '') + '<span>' + esc([ev.source, _g36Day(ev.at)].filter(Boolean).join(' · ')) + '</span></div>';
}
window._g36 = window._g36 || { at: 0, busy: false, j: {} };
// Read the mailbox for meetings, proposals and answers. The server keeps it to once in 20 minutes.
async function _g36Sync(force) {
  if (window._g36.busy) return null;
  if (!force && Date.now() - window._g36.at < 10 * 60000) return null;
  window._g36.busy = true; window._g36.at = Date.now();
  var d = null;
  try { d = await _sampEdge('sync_deal_journey', force ? { force: true } : {}); } catch (e) { d = null; }
  window._g36.busy = false;
  return d;
}
(function () {
  // Today: the stage and its proof on a deal task, and the right words on SAM's button.
  if (typeof _g24Row === 'function' && !_g24Row._g36) {
    var row = _g24Row;
    _g24Row = function (x) {
      var h = row.apply(this, arguments);
      var dl = x && x.t && x.t.deal;
      if (!dl) return h;
      var ev = (dl.evidence || []).slice(-1)[0];
      return h.replace('<div class="g24-rt">', '<div class="g24-rt">' + _g36Pill(dl.stage, dl.label)).replace('<div class="g24-rs">', _g36Ev(ev) + '<div class="g24-rs">');
    };
    _g24Row._g36 = true;
  }
  if (typeof _g24SamLabel === 'function' && !_g24SamLabel._g36) {
    var lab = _g24SamLabel;
    _g24SamLabel = function (x) { var s = (x && x.sam) || {}; if (s.do === 'reply' && s.people && s.people[0] && s.people[0].purpose === 'follow_up') return 'Let SAM write the follow-up'; return lab.apply(this, arguments); };
    _g24SamLabel._g36 = true;
  }
  // Today: read the mailbox in the background; if a deal moved, Today shows it.
  if (typeof tdSampLoad === 'function' && !tdSampLoad._g36) {
    var load = tdSampLoad;
    tdSampLoad = async function (force) {
      var out = await load.apply(this, arguments);
      _g36Sync(false).then(function (d) { if (d && d.ok && d.changed) { try { load(true); } catch (e) {} } });
      return out;
    };
    tdSampLoad._g36 = true;
  }
  // People: deals in motion, at the top.
  if (typeof _spPaintPeople === 'function' && !_spPaintPeople._g36) {
    var paint = _spPaintPeople;
    _spPaintPeople = function (id) { var r = paint.apply(this, arguments); try { _g36People(id); } catch (e) {} return r; };
    _spPaintPeople._g36 = true;
  }
})();
async function _g36People(id, fresh) {
  var host = typeof _spPeopleHost === 'function' ? _spPeopleHost(id) : null; if (!host) return;
  var d = (window._spPeople || {})[id];
  var any = d && (d.people || []).some(function (p) { return p.journey && ['meeting_held', 'proposal_requested', 'proposal_sent', 'negotiation', 'committed'].indexOf(p.journey.stage) !== -1; });
  var cached = window._g36.j[id];
  if (!fresh && cached && Date.now() - cached.at < 60000) { _g36Paint(id, cached.list); return; }
  if (!any && !fresh) { _g36Paint(id, []); return; }
  var r = await _sampEdge('get_deal_journey', { campaign_id: id });
  if (!r.ok) return;
  var list = (r.people || []).filter(function (p) { return p.stage && p.stage !== 'replied' && p.stage !== 'meeting_booked'; });
  window._g36.j[id] = { at: Date.now(), list: list };
  _g36Paint(id, list);
}
function _g36Paint(id, list) {
  var host = typeof _spPeopleHost === 'function' ? _spPeopleHost(id) : null; if (!host) return;
  var old = document.getElementById('g36Card_' + id); if (old) old.remove();
  var d = (window._spPeople || {})[id] || {};
  var owner = !!d.is_owner;
  var cnt = {}; list.forEach(function (p) { cnt[p.stage] = (cnt[p.stage] || 0) + 1; });
  var card = document.createElement('section'); card.className = 'g36-card'; card.id = 'g36Card_' + id; card.setAttribute('aria-label', 'Deals in motion');
  var head = '<div class="g36-h"><div><h4>Deals in motion</h4><div class="g36-sub">From your meetings, their notes and your emails. Each step shows what proves it.</div></div>' +
    (owner ? '<button class="g36-sync" type="button" onclick="g36Refresh(\'' + esc(id) + '\',this)">Check meetings and proposals</button>' : '') + '</div>';
  if (!list.length) {
    card.innerHTML = head + '<div class="g36-sub" style="margin-top:10px">Nothing past a reply yet. When you meet someone from this SAMpaign, SAM reads the meeting notes (Calendly, Fireflies, Fathom, Google Meet and others) and follows it from there.</div>';
  } else {
    card.innerHTML = head +
      '<div class="g36-flow">' + G36_FLOW.map(function (f) { return '<span class="' + (cnt[f[0]] ? 'on' : '') + '">' + esc(f[1]) + '<b>' + (cnt[f[0]] || 0) + '</b></span>'; }).join('') + '</div>' +
      list.map(function (p) { return _g36Person(id, p, owner); }).join('');
  }
  host.insertBefore(card, host.firstChild);
}
function _g36Person(id, p, owner) {
  var ev = (p.evidence || []).filter(function (e) { return e.stage; }).slice(-2);
  var late = p.next && p.next.due && Date.parse(p.next.due) < Date.now() - 86400000;
  var acts = '';
  if (owner && p.next && (p.next.kind === 'follow_up' || p.next.kind === 'answer') && p.email) acts += '<button class="g-btn sp-sm sp-gold" type="button" onclick="g36Write(\'' + esc(id) + '\',\'' + esc(p.contact_id) + '\')">' + SP_ICON.spark + (p.next.kind === 'follow_up' ? ' Let SAM write the follow-up' : ' Let SAM write the answer') + '</button>';
  if (owner && p.suggest) acts += '<button class="g-btn sp-sm" type="button" onclick="g36Pipeline(\'' + esc(id) + '\',\'' + esc(p.contact_id) + '\')">' + (p.suggest.mode === 'add' ? 'Add to Pipeline at ' + esc(p.suggest.label) : 'Move to ' + esc(p.suggest.label) + ' in Pipeline') + '</button>';
  return '<div class="g36-p"><div class="g36-pt">' + _g36Pill(p.stage, p.label) + (p.pilot ? '<span class="g36-st">Pilot</span>' : '') + '<b>' + esc(p.name || '') + '</b><small>' + esc([p.company, p.deal ? 'in Pipeline' : ''].filter(Boolean).join(' · ')) + '</small></div>' +
    ev.map(_g36Ev).join('') +
    (p.risk ? '<div class="g36-ev">' + _g36Pill('risk', 'At risk') + '“' + esc(String(p.risk.quote || '').slice(0, 150)) + '” <span>' + esc([p.risk.source, _g36Day(p.risk.at)].filter(Boolean).join(' · ')) + '</span></div>' : '') +
    (p.next ? '<div class="g36-nx' + (late ? ' late' : '') + '"><b>Next:</b> ' + esc(p.next.text) + (p.next.due ? ' <span class="sp-small">' + (late ? 'Due since ' : 'By ') + esc(_g36Day(p.next.due)) + '</span>' : '') + '</div>' : '') +
    (acts ? '<div class="g36-acts">' + acts + '</div>' : '') + '</div>';
}
function _g36Find(id, cid) { var c = window._g36.j[id]; return c ? (c.list || []).find(function (p) { return p.contact_id === cid; }) : null; }
async function g36Refresh(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
  var d = await _g36Sync(true);
  if (btn) { btn.disabled = false; btn.textContent = 'Check meetings and proposals'; }
  if (d && !d.ok) { showToast(d.error || 'SAM could not read your mailbox.'); return; }
  if (d && d.skipped && d.reason === 'outlook') showToast(d.note);
  else showToast(d && d.changed ? 'SAM moved ' + (d.moved || []).map(function (m) { return String(m.name || '').split(' ')[0] + ' to ' + String(m.label || '').toLowerCase(); }).join(', ') + '.' : 'Nothing new since the last check.');
  window._g36.j[id] = null;
  try { await _spRenderPeople(id, true); } catch (e) {}
  _g36People(id, true);
}
function g36Write(id, cid) {
  var p = _g36Find(id, cid); if (!p) return;
  var d = (window._spPeople || {})[id] || {};
  g27ReplyOpen([{ id: p.contact_id, name: p.name, email: p.email, channel: 'email', purpose: p.next && p.next.kind === 'follow_up' ? 'follow_up' : undefined, instruction: p.next && p.next.instruction ? p.next.instruction : undefined }], { id: id, name: p.campaign || '' });
}
// Add the company to Pipeline at the stage the evidence supports, or move it there.
function g36Pipeline(id, cid) {
  var p = _g36Find(id, cid); if (!p || !p.suggest) return;
  var add = p.suggest.mode === 'add', co = p.account_name || p.company || 'this company';
  var why = (p.evidence || []).filter(function (e) { return e.stage; }).slice(-3);
  var m = _g34Modal('g36Pm', add ? 'Add ' + co + ' to Pipeline' : 'Move ' + co + ' to ' + p.suggest.label,
    '<div class="sp-small">' + (add ? 'As a deal at <b>' + esc(p.suggest.label) + '</b>, with ' + esc(p.name || 'them') + ' on it.' : 'From <b>' + esc(p.suggest.from || 'its stage') + '</b> to <b>' + esc(p.suggest.label) + '</b>.') + ' What proves it:</div>' +
    '<ul class="g36-why">' + why.map(function (e) { return '<li>' + _g36Ev(e) + '</li>'; }).join('') + '</ul>' +
    (add ? '<div class="g36-row2"><label class="sp-fld">Deal value <small>optional</small><input id="g36Val" type="number" min="0" step="1" inputmode="numeric" placeholder="Add it later"></label><label class="sp-fld">Currency<select id="g36Cur"><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option><option>AED</option><option>SGD</option></select></label></div>' : '') +
    '<div class="sp-small" id="g36Msg" role="status" style="margin-top:10px"></div>' +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'g36Pm\').remove()">Cancel</button><span class="sp-acts"><button class="g-btn sp-gold" type="button" id="g36Go">' + (add ? 'Add to Pipeline' : 'Move it') + '</button></span></div>');
  document.getElementById('g36Go').focus();
  document.getElementById('g36Go').onclick = async function () {
    var msg = document.getElementById('g36Msg'); this.disabled = true; this.textContent = 'Saving…';
    var mv = await _sampEdge('move_sampaign_contact_to_deal', { contact_id: cid, create_account: true });
    if (!mv.ok) { msg.textContent = mv.error || 'Could not add them to the account.'; this.disabled = false; this.textContent = add ? 'Add to Pipeline' : 'Move it'; return; }
    var body = { account_id: mv.account_id, deal_type: p.suggest.key };
    if (add) { var v = parseFloat((document.getElementById('g36Val') || {}).value); body.deal_value = isFinite(v) && v > 0 ? v : 0; body.deal_currency = (document.getElementById('g36Cur') || {}).value || 'INR'; }
    var up = await _sampEdge('upsert_deal_value', body);
    if (up && up.error) { msg.textContent = up.error; this.disabled = false; this.textContent = add ? 'Add to Pipeline' : 'Move it'; return; }
    m.remove();
    showToast((mv.account_name || co) + ' is in Pipeline at ' + p.suggest.label + '.' + (add && !(body.deal_value > 0) ? ' Add its value when you know it.' : ''));
    window._g36.j[id] = null;
    try { await _spRenderPeople(id, true); } catch (e) {}
    _g36People(id, true);
  };
}
