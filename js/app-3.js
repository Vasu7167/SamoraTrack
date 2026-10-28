// SamoraOS app, part 3 of 5. Loaded in order after app-2.js.
function renderNotificationRules(cfg) {
  var host = document.getElementById('notifRulesForm'); if (!host) return;
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var h = '';
  // Master switch
  h += '<label style="display:flex;align-items:center;gap:10px;padding:8px 0;margin-bottom:6px;border-bottom:1px solid var(--border);cursor:pointer">' + _chk('nr-enabled', cfg.enabled) + '<span style="font-size:13px;font-weight:600;color:var(--text)">Push notifications enabled for this org</span></label>';
  // Rule rows
  h += NOTIF_RULE_META.map(function(m){
    var rc = cfg.rules[m.key] || { enabled:false };
    var params = m.params.map(function(p){
      return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--text3)">'+esc(p.label)+' '+_num('nr-'+m.key+'-'+p.key, rc[p.key]!=null?rc[p.key]:p.def)+' '+esc(p.suffix)+'</span>';
    }).join('<span style="margin:0 4px"></span>');
    return '<div style="padding:10px 0;border-bottom:1px solid var(--border)">' +
      '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">' + _chk('nr-rule-'+m.key, rc.enabled) +
      '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--text)">'+m.icon+' '+esc(m.label)+'</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(m.desc)+'</div>' +
      (params ? '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">'+params+'</div>' : '') +
      '</div></label></div>';
  }).join('');
  // Quiet hours + weekly digest
  h += '<div style="padding:12px 0;border-bottom:1px solid var(--border)">' +
    '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' + _chk('nr-quiet', cfg.quiet_hours.enabled) +
    '<span style="font-size:13px;font-weight:600;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5.2l3.2 2"/></svg> Quiet hours</span></label>' +
    '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:11px;color:var(--text3)">No pushes from '+_num('nr-quiet-start', cfg.quiet_hours.start)+' :00 to '+_num('nr-quiet-end', cfg.quiet_hours.end)+' :00 (local)</div></div>';
  h += '<div style="padding:12px 0">' +
    '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' + _chk('nr-digest', cfg.weekly_digest.enabled) +
    '<span style="font-size:13px;font-weight:600;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Weekly digest</span></label>' +
    '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:11px;color:var(--text3)">Send on <select id="nr-digest-day" style="padding:5px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-family:var(--sans);font-size:12px">'+days.map(function(d,i){return '<option value="'+i+'"'+(i===cfg.weekly_digest.day?' selected':'')+'>'+d+'</option>';}).join('')+'</select> at '+_num('nr-digest-hour', cfg.weekly_digest.hour)+' :00</div></div>';
  // Save
  h += '<div style="display:flex;gap:8px;margin-top:14px;align-items:center">' +
    '<button onclick="saveNotificationRules()" style="padding:8px 16px;border-radius:var(--r-sm);background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer">Save rules</button>' +
    '<button onclick="renderNotificationRules(NOTIFICATION_RULE_DEFAULTS)" style="padding:8px 12px;border-radius:var(--r-sm);background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:12px;cursor:pointer">Reset to default</button>' +
    '<span id="nr-status" style="font-size:12px;color:var(--text3)"></span></div>';
  host.innerHTML = h;
}
async function loadNotificationRules() {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_org_setting', key:'notification_rules'}) });
    var d = await r.json();
    var saved = null; try { saved = d.value ? JSON.parse(d.value) : null; } catch(e) {}
    _notificationRulesCache = _mergeNotifRules(saved);
  } catch(e) { _notificationRulesCache = _mergeNotifRules(null); }
  window._notificationRules = _notificationRulesCache;
  renderNotificationRules(_notificationRulesCache);
}
async function saveNotificationRules() {
  var g = function(id){ return document.getElementById(id); };
  var cfg = _mergeNotifRules(null);
  cfg.enabled = g('nr-enabled') ? g('nr-enabled').checked : true;
  cfg.quiet_hours = { enabled: g('nr-quiet')?.checked, start: parseInt(g('nr-quiet-start')?.value||'21',10), end: parseInt(g('nr-quiet-end')?.value||'8',10) };
  cfg.weekly_digest = { enabled: g('nr-digest')?.checked, day: parseInt(g('nr-digest-day')?.value||'1',10), hour: parseInt(g('nr-digest-hour')?.value||'8',10) };
  NOTIF_RULE_META.forEach(function(m){
    var rc = { enabled: g('nr-rule-'+m.key)?.checked };
    m.params.forEach(function(p){ var el = g('nr-'+m.key+'-'+p.key); rc[p.key] = el ? (parseInt(el.value,10)||0) : p.def; });
    cfg.rules[m.key] = rc;
  });
  var st = g('nr-status');
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'save_org_setting', key:'notification_rules', value:JSON.stringify(cfg)}) });
    var d = await r.json();
 if (d.ok) { _notificationRulesCache = cfg; window._notificationRules = cfg; showToast('Notification rules saved'); if(st){st.textContent='Saved';st.style.color='var(--green)';setTimeout(function(){st.textContent='';},3000);} }
    else showToast('Could not save rules');
  } catch(e) { showToast('Error: ' + e.message); }
}

// ── Feature 1: Deal velocity sparkline ────────────────────────────────────────
function _renderSparkline(history) {
  if (!history || history.length < 2) return '';
  var scores = history.map(function(h) { return typeof h === 'object' ? (h.health || h.score || 0) : 0; });
  var min = Math.min.apply(null, scores);
  var max = Math.max.apply(null, scores);
  var range = max - min || 1;
  var w = 36, h = 14, pts = scores.length;
  var points = scores.map(function(s, i) {
    var x = Math.round((i / (pts - 1)) * (w - 2)) + 1;
    var y = Math.round(h - 1 - ((s - min) / range) * (h - 3)) + 1;
    return x + ',' + y;
  }).join(' ');
  var last = scores[scores.length - 1];
  var first = scores[0];
  var color = last > first ? '#4a8c5c' : last < first ? '#c0523f' : '#888';
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="margin-left:5px;flex-shrink:0" title="' + pts + '-day trend">' +
    '<polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
}

// ── Feature 2: Meeting prep ────────────────────────────────────────────────────
var _meetingPrepData = null;

async function loadMeetingPrep() {
  var container = document.getElementById('meetingPrepSection'); if (!container) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_meeting_prep', target_date: new Date().toISOString().split('T')[0]}) });
    var d = await r.json();
    _meetingPrepData = d;
    if (!d.ok || !d.meetings || !d.meetings.length) {
      // No calendar events at all tomorrow
      container.style.display = 'none'; return;
    }
    var meetings = d.meetings.filter(function(m) { return m.account_name; }); // only matched meetings
    if (!meetings.length) {
      // Calendar events exist but none matched pipeline accounts — show light hint
      container.style.display = 'block';
      container.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:6px 10px;background:var(--surface2);border-radius:var(--r-sm);margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> ' + d.meetings.length + ' meeting' + (d.meetings.length!==1?'s':'') + ' today, none matched pipeline accounts by attendee or name</div>';
      return;
    }

    var html = '<div style="margin-bottom:12px">';
    // Collapsible header — collapsed by default to save screen space
    html += '<div onclick="_toggleMeetingPrepList()" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r-sm);user-select:none">';
    html += '<span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;flex:1"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> Today\'s meetings · ' + meetings.length + '</span>';
    html += '<span id="meetingPrepChevron" style="font-size:11px;color:var(--text3)">▸</span>';
    html += '</div>';
    html += '<div id="meetingPrepList" style="display:none;margin-top:8px">';

    window._mtgRosters = [];  // rebuilt on every render, indexes stay in sync
    meetings.forEach(function(m) {
      var hScore = m.health_score || 0;
      var hColor = hScore >= 70 ? 'var(--green)' : hScore >= 40 ? 'var(--amber)' : 'var(--coral)';
      var time = '';
      try { time = new Date(m.startTime).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}); } catch(e) {}

      // Register the attendee roster up front so the Intel button can sit in the header
      var _rosterIdx = -1;
      if (m.stakeholders_attending && m.stakeholders_attending.length) {
        window._mtgRosters = window._mtgRosters || [];
        _rosterIdx = window._mtgRosters.push(m.stakeholders_attending) - 1;
      }
      html += '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:9px 12px;margin-bottom:6px;cursor:pointer" onclick="_togglePrepDetail(\'' + esc(m.account_id||'') + '\')">';
      // Header row: name/time left, Samora Intel + health right (uses the free space)
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">';
      html += '<span style="font-size:13px;flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg></span>';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-size:13px;font-weight:500;color:var(--text)">' + esc(m.account_name) + '</div>';
      html += '<div style="font-size:11px;color:var(--text3)">' + esc(m.title) + (time ? ' · ' + time : '') + '</div>';
      html += '</div>';
      if (_rosterIdx >= 0) html += _samoraIntelBtn('event.stopPropagation();openMeetingInsights(' + _rosterIdx + ')', true);
      if (hScore) html += '<span style="font-size:11px;padding:2px 7px;border-radius:var(--r-sm);background:'+hColor+'18;color:'+hColor+'" title="Deal health">H:' + hScore + '</span>';
      html += '</div>';

      // Talking points (MEDDPICC gaps)
      if (m.talking_points && m.talking_points.length) {
        html += '<div style="font-size:11px;color:var(--text3);margin-bottom:5px;font-weight:500">Discuss in this meeting:</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px">';
        m.talking_points.forEach(function(tp) {
          html += '<span style="font-size:11px;padding:2px 8px;border-radius:var(--r-sm);background:rgba(var(--c-accent-rgb),0.1);color:var(--gold)">→ ' + esc(tp) + '</span>';
        });
        html += '</div>';
      }

      // Stakeholders attending
      if (m.stakeholders_attending && m.stakeholders_attending.length) {
        html += '<div style="font-size:11px;color:var(--text3);margin-bottom:3px">Attending: ' +
          m.stakeholders_attending.map(function(s) {
            return '<strong>' + esc(s.full_name||'') + '</strong>' + (s.title ? ' (' + esc(s.title) + ')' : '');
          }).join(', ') + '</div>';
      }

      // Last email
      if (m.last_email) {
        html += '<div style="font-size:11px;color:var(--text3);border-top:1px solid var(--border);margin-top:6px;padding-top:5px">';
        html += '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Last: <em>' + esc(m.last_email.subject||'') + '</em>';
        if (m.last_email.snippet) html += ', ' + esc(m.last_email.snippet.slice(0,80)) + '…';
        html += '</div>';
      }

      // Last transcript action items
      if (m.last_transcript && m.last_transcript.action_items) {
        html += '<div style="font-size:11px;color:var(--text3);margin-top:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg> Open items: ' + esc(m.last_transcript.action_items.slice(0,100)) + '</div>';
      }

      html += '</div>';
    });
    html += '</div></div>';
    container.innerHTML = html;
    container.style.display = 'block';
  } catch(e) { console.error('Meeting prep error:', e); }
}

function _toggleMeetingPrepList() {
  var l = document.getElementById('meetingPrepList');
  var c = document.getElementById('meetingPrepChevron');
  if (!l) return;
  var open = l.style.display !== 'none';
  l.style.display = open ? 'none' : 'block';
  if (c) c.textContent = open ? '▸' : '▾';
}

function _togglePrepDetail(accountId) {
  if (accountId && _pipelineData) {
    var all = [...(_pipelineData.verified||[]),...(_pipelineData.partial||[]),...(_pipelineData.unverified||[])];
    var deal = all.find(function(d) { return d.id === accountId; });
    if (deal) openDealDetail(accountId, deal.account);
  }
}

// ── Feature 4: Manager forecast view ──────────────────────────────────────────
var _forecastData = null;

async function loadForecastPanel() {
  var container = document.getElementById('forecastPanel'); if (!container) return;
  container.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">↻ Computing forecast…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_forecast'}) });
    _forecastData = await r.json();
    var d = _forecastData;
    if (!d.ok) { container.innerHTML = ''; return; }

    var fmt = function(v) { return fmtOrgMoney(v || 0); };
    var trend = function(v) { return !v ? '' : v > 0 ? '<span style="color:var(--green)">↑' + fmt(Math.abs(v)) + '</span>' : '<span style="color:var(--coral)">↓' + fmt(Math.abs(v)) + '</span>'; };

    var html = '<div style="margin-bottom:14px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V4M4 20h16M8 17V11M12.5 17V7.5M17 17v-4"/></svg> Forecast</div>';
    html += '<button onclick="loadForecastPanel()" style="font-size:11px;padding:2px 8px;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);cursor:pointer">↻ Refresh</button>';
    html += '</div>';

    // KPI row
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">';
    html += '<div style="background:rgba(74,140,92,0.08);border:1px solid rgba(74,140,92,0.2);border-radius:var(--r-sm);padding:9px 10px"><div style="font-size:11px;color:var(--green);font-weight:600;margin-bottom:2px">Verified</div><div style="font-size:16px;font-weight:600;color:var(--text)">' + fmt(d.verified) + '</div>' + (d.trend ? '<div style="font-size:11px">' + trend(d.trend.verifiedChange) + ' vs last wk</div>' : '') + '</div>';
    html += '<div style="background:rgba(var(--c-accent-rgb),0.08);border:1px solid rgba(var(--c-accent-rgb),0.2);border-radius:var(--r-sm);padding:9px 10px"><div style="font-size:11px;color:var(--amber);font-weight:600;margin-bottom:2px">Nurture</div><div style="font-size:16px;font-weight:600;color:var(--text)">' + fmt(d.nurture) + '</div><div style="font-size:11px;color:var(--text3)">' + (d.buckets&&d.buckets.nurture?d.buckets.nurture.length:0) + ' deals</div></div>';
    html += '<div style="background:rgba(192,82,63,0.08);border:1px solid rgba(192,82,63,0.2);border-radius:var(--r-sm);padding:9px 10px"><div style="font-size:11px;color:var(--coral);font-weight:600;margin-bottom:2px">At risk</div><div style="font-size:16px;font-weight:600;color:var(--text)">' + fmt(d.atRisk) + '</div>' + (d.trend ? '<div style="font-size:11px">' + trend(d.trend.atRiskChange) + ' vs last wk</div>' : '') + '</div>';
    html += '</div>';

    // Won / Lost MTD
    if (d.wonMtd || d.lostMtd) {
      html += '<div style="display:flex;gap:6px;margin-bottom:10px">';
      html += '<div style="flex:1;background:var(--surface2);border-radius:var(--r-sm);padding:8px 10px"><div style="font-size:11px;color:var(--text3);margin-bottom:1px">Won MTD</div><div style="font-size:14px;font-weight:600;color:var(--green)">' + fmt(d.wonMtd) + '</div></div>';
      html += '<div style="flex:1;background:var(--surface2);border-radius:var(--r-sm);padding:8px 10px"><div style="font-size:11px;color:var(--text3);margin-bottom:1px">Lost MTD</div><div style="font-size:14px;font-weight:600;color:var(--coral)">' + fmt(d.lostMtd) + '</div></div>';
      html += '<div style="flex:1;background:var(--surface2);border-radius:var(--r-sm);padding:8px 10px"><div style="font-size:11px;color:var(--text3);margin-bottom:1px">Pipeline</div><div style="font-size:14px;font-weight:600;color:var(--text)">' + fmt(d.total_pipeline) + '</div></div>';
      html += '</div>';
    }

    // Closing soon
    if (d.closingSoon && d.closingSoon.length) {
      html += '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Closing in 14 days</div>';
      d.closingSoon.forEach(function(deal) {
        var hc = deal.health >= 70 ? 'var(--green)' : deal.health >= 40 ? 'var(--amber)' : 'var(--coral)';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">';
        html += '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;color:var(--text)">' + esc(deal.account) + '</div>';
        html += '<div style="font-size:11px;color:var(--text3)">' + esc(deal.rep) + (deal.region?' · '+esc(deal.region):'') + '</div></div>';
        html += '<div style="text-align:right;flex-shrink:0"><div style="font-size:12px;font-weight:500;color:var(--text)">' + fmt(deal.value) + '</div>';
        html += '<div style="font-size:11px;color:' + (deal.daysToClose<=3?'var(--coral)':'var(--text3)') + '">' + deal.daysToClose + 'd</div></div>';
        html += '<span style="font-size:11px;padding:1px 6px;border-radius:var(--r-sm);background:'+hc+'18;color:'+hc+'">H:' + (deal.health||'-') + '</span>';
        html += '</div>';
      });
    }

    html += '</div>';
    container.innerHTML = html;
  } catch(e) { container.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: ' + esc(e.message) + '</div>'; }
}

// ── SDR Attribution ───────────────────────────────────────────────────────────
var _orgMembers = null;

async function _ensureOrgMembers() {
  // NB: empty array must NOT count as "loaded" — a single failed fetch would
  // otherwise poison the cache and every dropdown stays empty forever.
  if (_orgMembers && _orgMembers.length) return _orgMembers;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_org_members'}) });
    var d = await r.json();
    _orgMembers = Array.isArray(d.members) ? d.members : [];
    if (!_orgMembers.length && d.error) showToast('Could not load team members: ' + d.error);
  } catch(e) { _orgMembers = []; showToast('Could not load team members'); }
  return _orgMembers;
}

// ── Team assignment: AE + SDR on one account (manager+) ──────────────────────
// One account row, both roles mapped — the SDR and AE always work the SAME
// stored account. "No AE" = manager takes ownership.
async function openTeamAssign(accountId, accountName, currentAe, currentSdr) {
  await _ensureOrgMembers();
  document.getElementById('teamAssignPanel')?.remove();
  var panel = document.createElement('div');
  panel.id = 'teamAssignPanel';
  panel.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center';
  var memberOpts = function(selected, roleFilter) {
    return '<option value="">None</option>' + (_orgMembers||[]).filter(function(m){ return !roleFilter || roleFilter.includes(m.role) || !m.role; }).map(function(m) {
      var name = m.display_name || (m.email||'').split('@')[0];
      return '<option value="' + esc(m.user_id) + '"' + (m.user_id === selected ? ' selected' : '') + '>' + esc(name) + ' (' + esc(m.role||'member') + ')</option>';
    }).join('');
  };
  var html = '<div style="background:var(--bg);border-radius:var(--r-md);padding:20px;width:320px;max-width:90vw" onclick="event.stopPropagation()">';
  html += '<div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20v-1.5A4.5 4.5 0 017 14h4a4.5 4.5 0 014.5 4.5V20M16 4.3a3.5 3.5 0 010 6.4M18 14.3a4.5 4.5 0 013.5 4.2V20"/></svg> Assign team</div>';
  html += '<div style="font-size:12px;color:var(--text3);margin-bottom:14px">' + esc(accountName) + ', AE and SDR share this one account record, so both always see the same data.</div>';
  html += '<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--text3);margin-bottom:5px">AE / Owner <span style="opacity:.7">(None = you own it)</span></div>';
  html += '<select id="taAeSelect" style="width:100%;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-family:var(--sans);font-size:13px;outline:none">' + memberOpts(currentAe, null) + '</select></div>';
  html += '<div style="margin-bottom:14px"><div style="font-size:11px;color:var(--text3);margin-bottom:5px">SDR</div>';
  html += '<select id="taSdrSelect" style="width:100%;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-family:var(--sans);font-size:13px;outline:none">' + memberOpts(currentSdr, null) + '</select></div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<button onclick="saveTeamAssign(\'' + esc(accountId) + '\')" style="flex:1;padding:9px;border-radius:var(--r-sm);background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer">Save</button>';
  html += '<button onclick="document.getElementById(\'teamAssignPanel\').remove()" style="padding:9px 14px;border-radius:var(--r-sm);background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:12px;cursor:pointer">Cancel</button>';
  html += '</div></div>';
  panel.innerHTML = html;
  panel.addEventListener('click', function(e) { if (e.target === panel) panel.remove(); });
  document.body.appendChild(panel);
}

async function saveTeamAssign(accountId) {
  var ae  = document.getElementById('taAeSelect')?.value || '';
  var sdr = document.getElementById('taSdrSelect')?.value || '';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'assign_account_team', account_id:accountId, ae_user_id:ae, sdr_user_id:sdr }) });
    var d = await r.json();
    if (!d.ok) { showToast(d.error || 'Assignment failed'); return; }
    document.getElementById('teamAssignPanel')?.remove();
    showToast('Team assigned');
    loadMyAccounts();
  } catch(e) { showToast('Error: ' + e.message); }
}

async function showAttributionPicker(dealId) {
  // Load org members if not cached
  if (!_orgMembers) {
    try {
      var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({action:'get_org_members'}) });
      var d = await r.json();
      _orgMembers = d.members || [];
    } catch(e) { _orgMembers = []; }
  }
  // Remove any existing picker
  document.getElementById('attributionPickerPanel')?.remove();
  var panel = document.createElement('div');
  panel.id = 'attributionPickerPanel';
  panel.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center';
  var html = '<div style="background:var(--bg);border-radius:var(--r-md);padding:20px;width:320px;max-width:90vw" onclick="event.stopPropagation()">';
  html += '<div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">Tag SDR origin</div>';
  html += '<div style="font-size:12px;color:var(--text3);margin-bottom:14px">Who sourced this deal? This is used for SDR attribution in pipeline reporting.</div>';
  html += '<div style="margin-bottom:12px">';
  html += '<div style="font-size:11px;color:var(--text3);margin-bottom:5px">Select SDR</div>';
  html += '<select id="attrSdrSelect" style="width:100%;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-family:var(--sans);font-size:13px;outline:none">';
  html += '<option value="">Select team member</option>';
  (_orgMembers || []).forEach(function(m) {
    var name = m.display_name || (m.email||'').split('@')[0];
    html += '<option value="' + esc(m.user_id) + '">' + esc(name) + ' (' + esc(m.role||'') + ')</option>';
  });
  html += '</select></div>';
  html += '<div style="margin-bottom:14px">';
  html += '<div style="font-size:11px;color:var(--text3);margin-bottom:5px">Sequence / campaign (optional)</div>';
  html += '<input type="text" id="attrSeqInput" placeholder="e.g. Ferrero EMEA Q3 sequence" style="width:100%;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-family:var(--sans);font-size:13px;outline:none;box-sizing:border-box"/>';
  html += '</div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<button onclick="saveAttribution(\'' + esc(dealId) + '\')" style="flex:1;padding:9px;border-radius:var(--r-sm);background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer">Save</button>';
  html += '<button onclick="document.getElementById(\'attributionPickerPanel\').remove()" style="padding:9px 14px;border-radius:var(--r-sm);background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:12px;cursor:pointer">Cancel</button>';
  html += '</div></div>';
  panel.innerHTML = html;
  panel.addEventListener('click', function(e) { if (e.target === panel) panel.remove(); });
  document.body.appendChild(panel);
}

async function saveAttribution(dealId) {
  var sdrId = document.getElementById('attrSdrSelect')?.value;
  var seq   = document.getElementById('attrSeqInput')?.value?.trim();
  if (!sdrId) { showToast('Select a team member first'); return; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'set_deal_attribution', account_id:dealId, originated_by:sdrId, converted_from_sequence:seq||null}) });
    var d = await r.json();
    if (d.ok) {
      document.getElementById('attributionPickerPanel')?.remove();
      showToast('SDR attribution saved');
      // Update deal in local pipeline data
      var member = (_orgMembers||[]).find(function(m) { return m.user_id === sdrId; });
      if (_currentDealDetail && member) {
        _currentDealDetail.deal.originated_by_name = member.display_name || (member.email||'').split('@')[0];
        _currentDealDetail.deal.converted_from_sequence = seq || null;
        document.getElementById('deal-detail-body').innerHTML = _buildDealOverviewHTML(_currentDealDetail.deal);
      }
    }
  } catch(e) { showToast('Error: ' + e.message); }
}

async function clearDealAttribution(dealId) {
  try {
    await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'set_deal_attribution', account_id:dealId, originated_by:null, converted_from_sequence:null}) });
    if (_currentDealDetail) {
      _currentDealDetail.deal.originated_by_name = null;
      _currentDealDetail.deal.converted_from_sequence = null;
      document.getElementById('deal-detail-body').innerHTML = _buildDealOverviewHTML(_currentDealDetail.deal);
    }
    showToast('Attribution cleared');
  } catch(e) {}
}

async function loadHealthWeights() {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_org_setting', key:'health_score_weights'}) });
    var d = await r.json();
    if (d.value) {
      var w = JSON.parse(d.value);
      ['signal','meddpicc','recency','champion','close'].forEach(function(k) {
        var el = document.getElementById('hw-' + k) ;
        if (el && w[k] != null) el.value = String(w[k]);
      });
      _updateHwTotal();
    }
  } catch(e) {}
}

function resetHealthWeights() {
  var defaults = {signal:30, meddpicc:25, recency:20, champion:10, close:15};
  Object.entries(defaults).forEach(function(e) {
    var el = document.getElementById('hw-' + e[0]) ;
    if (el) el.value = String(e[1]);
  });
  _updateHwTotal();
}

async function _saveAllMeddpicc(accountId) {
  var btn = document.getElementById('meddpiccSaveBtn');
  var st  = document.getElementById('meddpiccSaveStatus');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
  // Collect all input values from the MEDDPICC pane
  var fields = {};
  document.querySelectorAll('[id^="mf-"]').forEach(function(el) {
    var field = (el ).id.replace('mf-', '');
    fields[field] = (el ).value;
  });
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'save_meddpicc', account_id:accountId, fields}) });
    var d = await r.json();
    if (d.ok) {
      _meddpiccDirty = false;
 if (st) { st.textContent = 'All saved'; st.style.color = 'var(--green)'; }
      showToast('MEDDPICC saved');
    }
  } catch(e) {
    if (st) { st.textContent = 'Save failed'; st.style.color = 'var(--coral)'; }
  }
  if (btn) { btn.textContent = 'Save changes'; btn.disabled = false; }
}

// Branded label for features powered by the Samora local intelligence layer
function _samoraIntelLabel(text) {
  return '<span style="display:inline-flex;align-items:center;gap:7px;justify-content:center;flex-wrap:wrap">'
    + '<img src="icons/icon-48.png" alt="Samora" style="width:16px;height:16px;border-radius:50%;flex-shrink:0"/>'
    + '<span>' + text + '</span>'
    + '<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;background:rgba(var(--c-accent-rgb),0.12);padding:2px 6px;border-radius:var(--r-sm);flex-shrink:0">Samora Intelligence</span>'
    + '</span>';
}

async function enrichDeal(accountId, accountName) {
  var body = document.getElementById('deal-detail-body');
  var status = document.getElementById('enrichDealStatus');
  var btn = document.getElementById('enrichDealBtn');

  // Step 1: fetch domain from account record to pre-populate confirmation
  if (btn) { btn.textContent = '↻ Loading…'; btn.disabled = true; }
  var domain = '';
  try {
    var dr = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_account_domain', account_id:accountId}) });
    var dd = await dr.json();
    domain = dd.domain || '';
  } catch(e) {}
  if (btn) { btn.innerHTML = _samoraIntelLabel('Find contacts from Gmail &amp; SmartReach activity'); btn.disabled = false; }

  // Step 2: show confirmation panel so human can verify domain before searching
  var confirmHtml = '<div style="margin-top:10px;background:var(--surface2);border-radius:var(--r-md);padding:12px">' +
    '<div style="font-size:12px;font-weight:500;color:var(--text);margin-bottom:4px">Confirm company domain</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">We\'ll scan Gmail and SmartReach for emails linked to this domain, scoped to this deal\'s keywords.</div>' +
    '<div style="display:flex;gap:8px;align-items:center">' +
      '<input type="text" id="enrichDomainInput" value="' + esc(domain) + '" placeholder="e.g. ferrero.com"' +
        ' style="flex:1;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-family:var(--sans);font-size:13px;outline:none"/>' +
      '<button onclick="_runEnrich(\'' + esc(accountId) + '\',\'' + esc(accountName) + '\')" ' +
        'style="padding:8px 14px;border-radius:var(--r-sm);background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer">Search</button>' +
      '<button onclick="this.parentElement.parentElement.remove()" ' +
        'style="padding:8px 10px;border-radius:var(--r-sm);background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:12px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +
    '<div id="enrichRunStatus" style="font-size:11px;color:var(--text3);margin-top:6px"></div>' +
  '</div>';

  // Inject below the enrich button
  var existing = document.getElementById('enrichConfirmPanel');
  if (existing) existing.remove();
  var panel = document.createElement('div');
  panel.id = 'enrichConfirmPanel';
  panel.innerHTML = confirmHtml;
  var enrichBtn = document.getElementById('enrichDealBtn');
  if (enrichBtn) enrichBtn.insertAdjacentElement('afterend', panel);
  document.getElementById('enrichDomainInput')?.focus();
}

async function _runEnrich(accountId, accountName) {
  var domainInput = document.getElementById('enrichDomainInput');
  var runStatus = document.getElementById('enrichRunStatus');
  var domain = domainInput ? domainInput.value.trim().replace(/^https?:\/\//,'').replace(/\/.*$/,'') : '';
  if (!domain) { if(runStatus) runStatus.textContent = 'Enter a domain first'; return; }
  var searchBtn = domainInput?.nextElementSibling;
  if (searchBtn) { searchBtn.textContent = '↻ Scanning…'; searchBtn.disabled = true; }
  if (runStatus) runStatus.textContent = 'Scanning Gmail and SmartReach…';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'enrich_account', account_id:accountId, account_name:accountName, domain}) });
    var d = await r.json();
    var panel = document.getElementById('enrichConfirmPanel');
    if (d.ok && !d.cached) {
 showToast('Found ' + d.count + ' contacts' + (d.enriched ? ' · ' + d.enriched + ' enriched' : ''));
      if (panel) panel.remove();
      var sRes = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({action:'get_stakeholders', account_id:accountId}) });
      var sData = await sRes.json();
      if (_currentDealDetail) _currentDealDetail.stakeholders = sData.stakeholders||[];
      _renderStakeholdersPane(_currentDealDetail?.stakeholders||[], {id:accountId, account:accountName});
    } else if (d.cached) {
      if (runStatus) { runStatus.textContent = 'Already enriched. Refreshing…'; }
      var r2 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({action:'enrich_account', account_id:accountId, account_name:accountName, domain, refresh:true}) });
      var d2 = await r2.json();
      if (panel) panel.remove();
 showToast(d2.ok ? 'Refreshed ' + d2.count + ' contacts' : 'Refresh failed');
      var sRes2 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({action:'get_stakeholders', account_id:accountId}) });
      if (_currentDealDetail) _currentDealDetail.stakeholders = (await sRes2.json()).stakeholders||[];
      _renderStakeholdersPane(_currentDealDetail?.stakeholders||[], {id:accountId, account:accountName});
    } else {
      if (runStatus) { runStatus.style.color = 'var(--coral)'; runStatus.textContent = d.error || 'No contacts found'; }
      if (searchBtn) { searchBtn.textContent = 'Search'; searchBtn.disabled = false; }
    }
  } catch(e) {
    if (runStatus) runStatus.textContent = 'Error: ' + e.message;
    if (searchBtn) { searchBtn.textContent = 'Search'; searchBtn.disabled = false; }
  }
}


// ── Delegated click handler for pipeline edit-close-date buttons ─────────────
// Using data attributes means no inline onclick with escaped strings.
// One listener on the document catches all current and future pipeline cards.
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.edit-close-date-btn');
  if (btn) {
    editCloseDate(
      btn.getAttribute('data-opp-id'),
      btn.getAttribute('data-account'),
      btn.getAttribute('data-close')
    );
  }
});

function showCFToast(msg){let t=document.getElementById('cf-toast');if(!t){t=document.createElement('div');t.id='cf-toast';t.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--surface);border:1px solid var(--gold);padding:10px 18px;border-radius:var(--r-sm);font-size:13px;color:var(--text);z-index:9998;opacity:0;transition:all .3s;pointer-events:none;white-space:nowrap;font-family:var(--font)';document.body.appendChild(t);}t.textContent=msg;requestAnimationFrame(()=>{t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';});clearTimeout(t._timer);t._timer=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(10px)';},3000);}
document.addEventListener('click',e=>{const m=document.getElementById('carryFwdModal');if(m&&e.target===m)closeCarryForward();});

// ══ SIGN-IN ORBITAL ════════════════════════════════════════════════════════
// The website hero diagram (samora-github-ready/js/main.js buildOrbit), on
// the sign-in screen's left pane. Same five systems, same fourteen sources,
// same angles, same 720x620 geometry. The only differences are deliberate:
//
//  - It is laid out on a FIXED stage and scaled to the pane as one piece.
//    The website rebuilt the layout for narrower boxes and got overlapping
//    chips for its trouble; a uniform scale cannot overlap anything the
//    desktop layout does not already overlap.
//  - Spokes are not links. On the website they go to feature pages; here a
//    click would navigate someone away from a half-typed password.
//  - The particle loops STOP when the sign-in screen is hidden. Otherwise
//    nineteen requestAnimationFrame loops would keep running behind the app
//    for the whole session, animating something nobody can see.
const AUTH_OS_SPOKES = [
  { t: 'Daily Command', ic: '☀︎', a: -90, d: 'Brief before the first coffee. Meetings pre-researched. Alerts that name the blocker.' },
  { t: 'SAMpaigns',     ic: '✉︎', a: -18, d: 'Scout, enrich, draft and schedule outreach anchored to the account.' },
  { t: 'Pipeline',      ic: '◈',       a:  54, d: 'Three-tier verification, coverage tables and a forecast that carries its evidence.' },
  { t: 'Intelligence',  ic: '◎',       a: 126, d: 'Detective SAM investigates any account across every channel at once.' },
  { t: 'SAMagic',       ic: '✦',       a: 198, d: 'Ask the verified pipeline directly. The exec and board view, unfiltered.' }
];
const AUTH_OS_SOURCES = [
  { t: 'Gmail',      a: -74 }, { t: 'Calendar',   a: -54 }, { t: 'Outlook',  a: -34 },
  { t: 'SmartReach', a:  -2 }, { t: 'Apollo',     a:  18 }, { t: 'Lusha',    a:  38 },
  { t: 'Read.ai',    a:  70 }, { t: 'Notetakers', a:  90 }, { t: 'Claude',   a: 110 },
  { t: 'Salesforce', a: 142 }, { t: 'LinkedIn',   a: 162 }, { t: 'Zoho',     a: 182 },
  { t: 'WhatsApp',   a: 214 }, { t: 'Market intel', a: 254 }
];
function _authOrbitLive() {
  const scr = document.getElementById('authScreen');
  return !!(scr && scr.classList.contains('active'));
}
function buildAuthOrbit() {
  const viz = document.getElementById('authOrbit');
  const stage = document.getElementById('authOrbitStage');
  if (!viz || !stage) return;
  // Clear whatever a previous build left, particles included. Their loops
  // check isConnected and end themselves once removed.
  stage.querySelectorAll('.aos-src,.aos-spoke,.aos-line,.aos-flow,.aos-hint').forEach(function (n) { n.remove(); });
  // Let flexbox decide the box's height afresh. A height pinned by an earlier
  // build (the fallback path below) would otherwise be measured as if it were
  // the space available, and the orbital would never grow back.
  viz.style.height = '';
  const avail = viz.clientWidth;
  // Below 900px the whole pane is display:none, so there is nothing to size.
  if (!avail || !_authOrbitLive()) return;

  const W = 720, H = 620, HH = H + 34;   // +34: the hint line below the stage
  // Fit BOTH dimensions. Scaling to width alone made the orbital as tall as
  // the pane was wide, so on a wide screen the tagline was pushed below the
  // fold and the sign-in page scrolled. The pane is now exactly one screen
  // tall (CSS) and this box gets whatever height is left after the brand row
  // and the tagline.
  const availH = viz.clientHeight;
  // Up to 1.12x when the column has room (the wide-screen split gives it a
  // whole column), never so large the cards collide.
  // On wide screens the orbital has its own column. The outer source chips
  // already overhang the 720px frame by ~40px a side; that overhang lands in
  // the column gap and the pane padding, so the frame itself must not bleed
  // (at 1.12x SmartReach was clipped by the form pane).
  const wide = window.matchMedia('(min-width: 1200px)').matches;
  const sc = availH > 120 ? Math.min(wide ? 1.2 : 1.12, avail / W, availH / HH) : Math.min(1, avail / W);
  stage.style.transform = 'scale(' + sc + ')';
  // Centre the scaled stage in the space it was given.
  stage.style.left = (wide ? (avail - W * sc) / 2 : Math.max(0, (avail - W * sc) / 2)) + 'px';
  stage.style.top = availH > 120 ? Math.max(0, (availH - HH * sc) / 2) + 'px' : '0px';
  if (availH <= 120) viz.style.height = Math.round(HH * sc) + 'px';
  // Type back up by the inverse of the scale, capped: past 1.2 the cards
  // grow into each other, which is the exact failure this layout avoids.
  stage.style.setProperty('--k', String(Math.min(1 / sc, wide ? 1.32 : 1.2).toFixed(3)));

  const cx = W / 2, cy = H / 2;
  const irx = Math.min(W * 0.355, 245), iry = Math.min(H * 0.325, 195);
  const orx = Math.min(W * 0.492, 350), ory = Math.min(H * 0.468, 288);
  const coreR = 90;
  const moving = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // One travelling dot from (x,y) toward the core. Stops for good when its
  // node is removed, and idles (without rescheduling work) while the sign-in
  // screen is hidden.
  function flow(dot, x, y, reach, base, spread, delay, peak) {
    (function run() {
      const dur = base + Math.random() * spread;
      const start = performance.now() + Math.random() * delay;
      (function step(now) {
        if (!dot.isConnected) return;
        if (!_authOrbitLive()) { dot.remove(); return; }
        const t = (now - start) / dur;
        if (t < 0) { requestAnimationFrame(step); return; }
        if (t >= 1) { run(); return; }
        const e = t * t * (3 - 2 * t);
        dot.style.left = (x + (cx - x) * e * reach) + 'px';
        dot.style.top  = (y + (cy - y) * e * reach) + 'px';
        dot.style.opacity = String(Math.sin(t * Math.PI) * peak);
        requestAnimationFrame(step);
      })(performance.now());
    })();
  }

  AUTH_OS_SOURCES.forEach(function (n, i) {
    const r = n.a * Math.PI / 180;
    const x = cx + Math.cos(r) * orx, y = cy + Math.sin(r) * ory;
    const el = document.createElement('div');
    el.className = 'aos-src';
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.animationDelay = (0.9 + i * 0.05) + 's';
    el.innerHTML = '<i></i>' + esc(n.t);
    stage.appendChild(el);
    if (moving) {
      const dot = document.createElement('div');
      dot.className = 'aos-flow aos-flow--src';
      stage.appendChild(dot);
      flow(dot, x, y, 0.9, 3200, 2600, 4200, 0.75);
    }
  });

  AUTH_OS_SPOKES.forEach(function (n, i) {
    const r = n.a * Math.PI / 180;
    const x = cx + Math.cos(r) * irx, y = cy + Math.sin(r) * iry;
    const sp = document.createElement('div');
    sp.className = 'aos-spoke';
    sp.tabIndex = 0;
    sp.style.left = x + 'px'; sp.style.top = y + 'px';
    sp.style.animationDelay = (0.35 + i * 0.1) + 's';
    sp.innerHTML =
      '<div class="aos-spoke-in">' +
        '<div class="aos-sp-top"><span class="aos-sp-ic">' + n.ic + '</span><span class="aos-sp-t">' + esc(n.t) + '</span></div>' +
        '<div class="aos-sp-d">' + esc(n.d) + '</div>' +
      '</div>';
    stage.appendChild(sp);

    const dx = cx - x, dy = cy - y;
    const ln = document.createElement('div');
    ln.className = 'aos-line';
    ln.style.left = x + 'px'; ln.style.top = y + 'px';
    ln.style.width = Math.max(Math.sqrt(dx * dx + dy * dy) - coreR, 0) + 'px';
    ln.style.transform = 'rotate(' + (Math.atan2(dy, dx) * 180 / Math.PI) + 'deg)';
    ln.style.opacity = '0';
    ln.style.transition = 'opacity .9s ' + (0.6 + i * 0.1) + 's';
    stage.appendChild(ln);
    requestAnimationFrame(function () { ln.style.opacity = '1'; });

    if (moving) {
      const p = document.createElement('div');
      p.className = 'aos-flow';
      stage.appendChild(p);
      flow(p, x, y, 0.86, 2600, 1800, 2200, 0.9);
    }
  });

  const hint = document.createElement('div');
  hint.className = 'aos-hint';
  hint.textContent = 'HOVER A SYSTEM TO EXPLORE';
  stage.appendChild(hint);
}
(function wireAuthOrbit() {
  // Build whenever the sign-in screen becomes visible (first load, and after
  // every logout), and clear it when it is hidden so nothing animates behind
  // the app.
  const go = function () { try { buildAuthOrbit(); } catch (e) { console.warn('auth orbit', e); } };
  const hook = function () {
    const scr = document.getElementById('authScreen');
    if (!scr) return;
    new MutationObserver(go).observe(scr, { attributes: true, attributeFilter: ['class'] });
    go();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
  // Webfonts change card widths after first paint. Rebuild once they land so
  // the hover widths are measured against the real type.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
  let rt = null, lastW = window.innerWidth, lastH = window.innerHeight;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      // Height matters now too: the orbital fits the pane in both directions.
      if (window.innerWidth === lastW && window.innerHeight === lastH) return;
      lastW = window.innerWidth; lastH = window.innerHeight;
      go();
    }, 200);
  });
})();

(async function init() {
  initTheme();
  // Check for Microsoft OAuth callback immediately on load
  // (runs before auth check so we can capture the code before URL cleanup)
  const _msParams = new URLSearchParams(window.location.search);
  const _msCode   = _msParams.get('code');
  const _msError  = _msParams.get('error');
  if (_msCode || _msError) {
    // Clean URL immediately, handle after auth context is established
    window.history.replaceState({}, document.title, window.location.pathname);
    if (_msCode) {
      // Store code temporarily — will exchange after auth loads
      sessionStorage.setItem('ms_pending_code', _msCode);
    }
    // Microsoft sends ?error= back when consent is refused or blocked, most
    // often "Approval required" in a tenant that has user consent switched
    // off. This used to be swallowed: the URL was cleaned and the rep landed
    // back on the app with no idea why Outlook still was not connected.
    if (_msError && !_msCode) {
      const _msDesc = String(_msParams.get('error_description') || '').split(/\r?\n/)[0].slice(0, 220);
      const _msMsg = _msError === 'access_denied'
        ? 'Outlook was not connected. Your organisation requires an administrator to approve SamoraOS before you can connect. Ask your IT admin, or your Samora contact, for the admin approval link.'
        : 'Outlook was not connected. Microsoft said: ' + (_msDesc || _msError);
      setTimeout(function () { alert(_msMsg); }, 600);
    }
  }
  setInterval(async () => { if (currentUser?.refresh_token) await refreshToken(); }, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && currentUser?.token) {
      await syncDown(); runCarryOver(); _lastCalDate = null; render(); reconcileCalendarTasks();
    }
  });
  // ── OAuth return ────────────────────────────────────────────────────────
  // Supabase sends the session back in the URL FRAGMENT, not the query string,
  // so it never reaches the server and nothing picks it up unless we look.
  // Without this the SSO buttons complete the provider dance and then dump the
  // user straight back on the login screen, which looks like the button is
  // broken. Runs before the stored-session check so a fresh sign-in wins over
  // a stale cached one.
  try {
    // Which SSO providers are switched on. Fired here and not awaited: the
    // buttons hide themselves when it lands, and sign-in must never wait on it.
    _loadSsoProviders();

    const frag = (window.location.hash || '').replace(/^#/, '');

    // A password-recovery link comes back looking EXACTLY like an OAuth return:
    // #access_token=...&refresh_token=...  The only thing that separates them is
    // type=recovery. Without this branch the OAuth handler below would adopt the
    // token as an ordinary sign-in and drop the person straight into the app,
    // never asking for the new password they clicked the link to set.
    if (frag && /(^|&)type=recovery(&|$)/.test(frag)) {
      const rq = new URLSearchParams(frag);
      _recoveryToken   = rq.get('access_token');
      _recoveryRefresh = rq.get('refresh_token');
      // Out of the address bar immediately: it is a live credential for this
      // account and it should not survive a copied URL or a shared screen.
      history.replaceState(null, '', window.location.pathname + window.location.search);
      if (_recoveryToken) {
        let rEmail = '';
        try {
          const ru = await fetch(SB_URL + '/auth/v1/user', { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + _recoveryToken } });
          const rud = await ru.json();
          if (!ru.ok) { try { hideSplash(true); } catch (_e) {} _showResetExpired(); return; }
          rEmail = (rud && rud.email) || '';
        } catch (_e) {}
        try { hideSplash(true); } catch (_e) {}
        _openResetScreen(rEmail);
        return;
      }
    }

    // An expired or already-used link comes back as #error=... with no token.
    // Saying so beats dropping them on a sign-in screen with no explanation.
    if (frag && /(^|&)error/.test(frag)) {
      const eq = new URLSearchParams(frag);
      history.replaceState(null, '', window.location.pathname + window.location.search);
      // An expired email link arrives as error_code=otp_expired ("Email link
      // is invalid or has expired"). OAuth errors are left alone. Show the dedicated
      // expired state (with a one-tap "send a new link"), not a hidden message.
      if (/otp_expired|email link/i.test((eq.get('error_code') || '') + ' ' + (eq.get('error_description') || ''))) {
        try { hideSplash(true); } catch (_e) {}
        _showResetExpired();
        return;
      }
    }

    if (frag && frag.indexOf('access_token=') !== -1) {
      const q = new URLSearchParams(frag);
      const at = q.get('access_token'), rt = q.get('refresh_token');
      if (at) {
        // Identify the user from the token rather than trusting the fragment.
        const ur = await fetch(SB_URL + '/auth/v1/user', { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + at } });
        const u = await ur.json();
        if (u && u.id) {
          currentUser = { id: u.id, email: u.email, token: at, refresh_token: rt };
          localStorage.setItem('dt-user', JSON.stringify(currentUser));
          // The provider token is what actually reads the mailbox. Stash it so
          // the existing Gmail/Graph plumbing can adopt it instead of asking
          // the user to connect their mail a second time.
          const pt = q.get('provider_token'), prt = q.get('provider_refresh_token');
          if (pt) sessionStorage.setItem('sso_provider_token', pt);
          if (prt) sessionStorage.setItem('sso_provider_refresh_token', prt);
        }
      }
      // Strip the fragment so a refresh does not replay it and so the tokens
      // are not left sitting in the address bar.
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  } catch (_e) { /* fall through to the normal login screen */ }

  const saved = localStorage.getItem('dt-user');
  if (saved) {
    currentUser = JSON.parse(saved);
    // Always load profile from cache first so launchApp has role/org data
    const cachedProfile = localStorage.getItem('dt-profile-' + currentUser?.id);
    if (cachedProfile) { try { profile = JSON.parse(cachedProfile); } catch(e) {} }
    // Refresh token if we have one (non-blocking — launchApp runs after)
    if (currentUser?.refresh_token) {
      const ok = await refreshToken();
      if (!ok) { localStorage.removeItem('dt-user'); currentUser = null; registerSW(); return; }
    }
    if (currentUser?.must_change) { showSetPasswordScreen(); registerSW(); return; }
    const _finishLaunch = function() {
      const pendingCode = sessionStorage.getItem('ms_pending_code');
      if (pendingCode) {
        sessionStorage.removeItem('ms_pending_code');
        setTimeout(function() { handleMicrosoftCallback(pendingCode); }, 500);
      }
    };
    if (profile) {
      // Fast path: we already have a cached profile, so paint the app NOW and
      // refresh the profile from the network in the background. This removes a
      // blocking round-trip (and loadProfile's 5s timeout) from first paint.
      launchApp();
      _finishLaunch();
      loadProfile().then(function() { try { _applyRoleChrome(); } catch(e) {} });
    } else {
      // No cached profile — must load it before we can launch.
      await loadProfile();
      if (profile) { launchApp(); _finishLaunch(); }
      else { localStorage.removeItem('dt-user'); }
    }
  }
  registerSW();
})();

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner();
        });
      });
    }).catch(()=>{});
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'SW_UPDATED') showUpdateBanner();
    });
  }
}

function showUpdateBanner() {
  if (document.getElementById('st-update-banner')) return;
  const b = document.createElement('div');
  b.id = 'st-update-banner';
  b.innerHTML = '<div style="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--c-surface);border:1px solid var(--c-accent);padding:.65rem 1rem;border-radius:var(--r-sm);display:flex;align-items:center;gap:.85rem;font-family:var(--font);font-size:13px;color:#D6CFC4;z-index:9999;box-shadow:var(--shadow-2);white-space:nowrap;animation:fadeIn .3s ease"><span><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> New version ready</span><button onclick="window.location.reload(true)" style="background:var(--c-accent);color:var(--c-canvas);border:none;padding:.28rem .75rem;border-radius:var(--r-sm);cursor:pointer;font-size:12px;font-weight:500;font-family:var(--font)">Update</button><button onclick="document.getElementById(\'st-update-banner\').remove()" style="background:none;border:none;color:#78716C;cursor:pointer;font-size:14px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  document.body.appendChild(b);
  setTimeout(() => { if (b.parentNode) b.remove(); }, 12000);
}


// ══════════════════════════════════════════════════════════
// ACCOUNT INTELLIGENCE
// ══════════════════════════════════════════════════════════
var _intelData = null;
var _intelType = 'all';

async function refreshIntelligence() {
  var btn = document.getElementById('intelRefreshBtn');
  var feed = document.getElementById('intelFeed');
  var isManager = canSeeTeam(profile ? profile.role : '');
  var repFilterEl = document.getElementById('intelRepFilter');
  var repFilter = (isManager && repFilterEl) ? repFilterEl.value : '';
  if (btn) { btn.textContent = '↻ Scanning…'; btn.disabled = true; }
  if (feed) feed.innerHTML = '<div style="text-align:center;padding:48px 0;color:var(--text3);font-size:14px">Scanning ' + (repFilter ? 'this rep\'s' : 'your') + ' named accounts \u2014 AI signals + SAM pattern detection…</div>';

  var days = parseInt((document.getElementById('intelDaysFilter') || {}).value || '30') || 30;
  var aiData = null, samData = null, aiScopeError = false;

  // SAM (rule-based) scan — runs independently of AI quota/availability, so
  // it always has a chance to populate even when Gemini is exhausted.
  try {
    var rSam = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'local_intelligence', rep_user_id: repFilter || undefined })
    });
    samData = await rSam.json();
  } catch(e) { samData = { ok: false, error: e.message }; }

  // AI (Gemini) extraction — may fail on quota; that's fine, SAM results
  // above are unaffected and already captured.
  try {
    var rAi = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'extract_intelligence', days_back: days, rep_user_id: repFilter || undefined })
    });
    aiData = await rAi.json();
    if (aiData.scopeError) aiScopeError = true;
  } catch(e) { aiData = { ok: false, error: e.message }; }

  if (aiScopeError) {
    if (feed) feed.innerHTML = '<div style="text-align:center;padding:48px 0">' +
      '<div style="font-size:34px;margin-bottom:12px;opacity:0.5"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 10.5V7.5a5.5 5.5 0 0111 0v3M5 10.5h14v10H5z"/></svg></div>' +
      '<div style="font-size:14px;color:var(--text2);margin-bottom:6px;font-weight:600">Gmail permissions need to be re-granted</div>' +
      '<div style="font-size:12px;color:var(--text3);max-width:380px;margin:0 auto;line-height:1.6">' + esc(repFilter ? 'This rep\'s' : 'Your') + ' Gmail connection is missing read access. ' + esc(repFilter ? 'They need' : 'Go') + ' to the SAM tab and click "Connect Gmail" again to re-grant permissions \u2014 simply refreshing the token will not fix this.</div>' +
    '</div>';
    if (btn) { btn.textContent = '↻ Refresh'; btn.disabled = false; }
    return;
  }

  // Always load whatever intelligence now exists (AI rows, SAM rows, or
  // both) — SAM rows persist via local_intelligence even if AI failed.
  await loadIntelligence();

  // Build a status banner reflecting what actually happened in each path.
  var banners = '';
  if (samData && samData.ok && samData.count > 0) {
    banners += '<div style="background:rgba(74,140,92,0.08);border:1px solid rgba(74,140,92,0.25);border-radius:var(--radius);padding:10px 14px;margin-bottom:8px;font-size:12px;color:var(--text2)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> <strong style="color:var(--green)">SAM Intelligence</strong>: ' + samData.count + ' account' + (samData.count>1?'s':'') + ' scanned (no AI quota used)</div>';
  }
  if (aiData && aiData.geminiQuotaExhausted && aiData.message) {
    banners += '<div style="background:rgba(var(--c-accent-rgb),0.1);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 14px;margin-bottom:8px;font-size:12px;color:var(--text2);line-height:1.6">⏳ <strong style="color:var(--gold)">AI Tool Signals limited</strong>: ' + esc(aiData.message) + '</div>';
  } else if (aiData && aiData.ok && aiData.processed > 0) {
    banners += '<div style="background:rgba(var(--c-accent-rgb),0.08);border:1px solid rgba(var(--c-accent-rgb),0.25);border-radius:var(--radius);padding:10px 14px;margin-bottom:8px;font-size:12px;color:var(--text2)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8.5h10v9H7zM10 12.5v1M14 12.5v1M12 5v3.5M9.5 17.5v3M14.5 17.5v3M4.5 11.5v3M19.5 11.5v3"/></svg> <strong style="color:var(--gold)">AI Tool Signals</strong>: ' + aiData.processed + ' meeting' + (aiData.processed>1?'s':'') + ' analysed</div>';
  }
  if (banners && feed) {
    var bannerWrap = document.createElement('div');
    bannerWrap.innerHTML = banners;
    feed.insertBefore(bannerWrap, feed.firstChild);
  }
  if (btn) { btn.textContent = '↻ Refresh'; btn.disabled = false; }
}

function renderIntelDebug(data) {
  var debug = data.debug || [];
  if (data.geminiQuotaExhausted && data.message) {
    return '<div style="text-align:center;padding:48px 0;color:var(--text3);font-size:14px">' +
      '<div style="font-size:34px;margin-bottom:12px;opacity:0.5">⏳</div>' +
      '<div style="font-weight:600;color:var(--gold);margin-bottom:8px">SAM has reached its limit for now</div>' +
      '<div style="max-width:420px;margin:0 auto;line-height:1.6;font-size:13px">' + esc(data.message) + '</div>' +
    '</div>';
  }
  if (data.message) {
    return '<div style="text-align:center;padding:48px 0;color:var(--text3);font-size:14px">' + esc(data.message) + '<br><span style="font-size:12px">Add accounts in Org \u2192 Rep Accounts</span></div>';
  }
  if (!debug.length) {
    return '<div style="text-align:center;padding:48px 0;color:var(--text3);font-size:14px">No notetaker emails found for your named accounts.<br><span style="font-size:12px">Processed: ' + (data.processed||0) + ' \u00b7 Skipped: ' + (data.skipped||0) + '</span></div>';
  }
  var rows = debug.map(function(d) {
    var parts = [];
    if (d.strictSearchFound !== undefined) parts.push('strict: ' + d.strictSearchFound + ', fallback: ' + d.fallbackSearchFound);
    if (d.notetakerEmailsFound !== undefined) parts.push('found: ' + d.notetakerEmailsFound + (d.usedFallback ? ' (fallback)' : ' (strict)'));
    if (d.geminiKeyMissing) parts.push('<span style="color:var(--coral)">Gemini API key not set</span>');
    if (d.geminiApiError) parts.push('<span style="color:var(--coral)">Gemini API error: ' + esc(JSON.stringify(d.geminiApiError)) + '</span>');
    if (d.geminiNoMatch) parts.push('<span style="color:var(--amber)">Gemini returned no JSON-shaped text' + (d.geminiFinishReason ? ' (finish: '+esc(d.geminiFinishReason)+')' : '') + '</span>');
    if (d.geminiJsonParseError) parts.push('<span style="color:var(--coral)">JSON parse failed: ' + esc(d.geminiJsonParseError) + (d.geminiFinishReason ? ' (finish: '+esc(d.geminiFinishReason)+')' : '') + '</span>');
    if (d.geminiRawText) parts.push('<span style="color:var(--text3);font-style:italic">raw: ' + esc(d.geminiRawText.slice(0,200)) + '\u2026</span>');
    if (d.geminiError) parts.push('<span style="color:var(--coral)">Gemini error: ' + esc(d.geminiError) + '</span>');
    if (d.dbInsertError) parts.push('<span style="color:var(--coral)">DB insert failed (' + d.status + '): ' + esc(d.dbInsertError) + '</span>');
    if (d.dbReadError) parts.push('<span style="color:var(--coral)">DB read failed: ' + esc(JSON.stringify(d.dbReadError)) + '</span>');
    if (d.gmailApiError) parts.push('<span style="color:var(--coral)">Gmail API error: ' + esc(JSON.stringify(d.gmailApiError)) + '</span>');
    if (d.subject) parts.push('subject: "' + esc(d.subject) + '"');
    return '<div style="background:var(--surface2);border-radius:var(--r-sm);padding:10px 14px;margin-bottom:8px;text-align:left">' +
      '<div style="font-size:13px;font-weight:600;color:var(--text)">' + esc(d.account || '') + '</div>' +
      '<div style="font-size:12px;color:var(--text3);margin-top:4px;line-height:1.6">' + parts.join('<br>') + '</div>' +
    '</div>';
  }).join('');
  return '<div style="padding:24px 0">' +
    '<div style="text-align:center;color:var(--text3);font-size:14px;margin-bottom:16px">No intelligence extracted \u2014 here\'s why, per account:</div>' +
    rows +
  '</div>';
}

// ── Pipeline Intelligence ────────────────────────────────────────────────────
var _pipelineData = null;
var _pipelineView = 'combined';
var _pipelineDashTab = 'overview';
var _pipelineFilters = { tier: '', product: '', stream: '', region: '', rep: '' };

function setPipelineView(view) {
  _pipelineView = view;
  document.querySelectorAll('.pv-btn').forEach(function(b) { b.classList.remove('active'); });
  var btn = document.getElementById('pv-' + view);
  if (btn) btn.classList.add('active');
  if (_pipelineData) { renderPipelineChart(_pipelineData); renderPipelineDeals(_pipelineData); }
}

function setPipelineDashTab(tab) {
  var activeBtn = document.getElementById('pdt-' + tab);
  if (activeBtn && activeBtn.scrollIntoView) { try { activeBtn.scrollIntoView({ block:'nearest', inline:'center', behavior:'smooth' }); } catch(e) {} }
  _pipelineDashTab = tab;
  document.querySelectorAll('.pdt-btn').forEach(function(b) { b.classList.remove('active'); });
  var btn = document.getElementById('pdt-' + tab);
  if (btn) btn.classList.add('active');
  if (_pipelineData) renderPipelineDashboard(_pipelineData);
}

function applyPipelineFilters() {
  _pipelineFilters.tier    = document.getElementById('pipe-filter-tier')?.value    || '';
  _pipelineFilters.product = document.getElementById('pipe-filter-product')?.value || '';
  _pipelineFilters.stream  = document.getElementById('pipe-filter-stream')?.value  || '';
  _pipelineFilters.region  = document.getElementById('pipe-filter-region')?.value  || '';
  _pipelineFilters.rep     = document.getElementById('pipe-filter-rep')?.value     || '';
  if (_pipelineData) { renderPipelineDashboard(_pipelineData); renderPipelineChart(_pipelineData); renderPipelineDeals(_pipelineData); }
}

function clearPipelineFilters() {
  _pipelineFilters = { tier:'', product:'', stream:'', region:'', rep:'' };
  ['pipe-filter-tier','pipe-filter-product','pipe-filter-stream','pipe-filter-region','pipe-filter-rep'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  if (_pipelineData) { renderPipelineDashboard(_pipelineData); renderPipelineChart(_pipelineData); renderPipelineDeals(_pipelineData); }
}

function getFilteredDeals(data) {
  // The live pipeline = verified + partial + unverified (excludes won/lost)
  var all = [...(data.verified||[]), ...(data.partial||[]), ...(data.unverified||[])];
  return all.filter(function(d) {
    if (_pipelineFilters.tier && d.tier !== _pipelineFilters.tier) return false;
    if (_pipelineFilters.region && d.region !== _pipelineFilters.region) return false;
    if (_pipelineFilters.rep && d.rep_user_id !== _pipelineFilters.rep) return false;
    return true;
  });
}

function populatePipelineFilters(data) {
  // Reps dropdown
  var repSel = document.getElementById('pipe-filter-rep');
  if (repSel) {
    var repMap = {};
    var allDeals = [...(data.verified||[]), ...(data.partial||[]), ...(data.unverified||[])];
    allDeals.forEach(function(d) {
      if (d.rep_user_id && d.rep_email) repMap[d.rep_user_id] = d.rep_email.split('@')[0].replace(/\./g,' ').replace(/\b\w/g, function(c){return c.toUpperCase();});
    });
    repSel.innerHTML = '<option value="">All reps</option>' +
      Object.entries(repMap).map(function(e){ return '<option value="'+esc(e[0])+'">'+esc(e[1])+'</option>'; }).join('');
  }
  // Region dropdown
  var regSel = document.getElementById('pipe-filter-region');
  if (regSel) {
    var regions = {};
    var allDeals2 = [...(data.verified||[]), ...(data.partial||[]), ...(data.unverified||[])];
    allDeals2.forEach(function(d) { if (d.region) regions[d.region] = true; });
    regSel.innerHTML = '<option value="">All regions</option>' +
      Object.keys(regions).sort().map(function(r){ return '<option value="'+esc(r)+'">'+esc(r)+'</option>'; }).join('');
  }
  // Products dropdown — from productBreakdown in pipeline response
  var prodSel = document.getElementById('pipe-filter-product');
  if (prodSel) {
    var prodKeys = Object.keys(data.productBreakdown || {}).filter(function(k){ return k !== 'No product'; });
    prodSel.innerHTML = '<option value="">All products</option>' + prodKeys.map(function(p){ return '<option value="'+esc(p)+'">'+esc(p)+'</option>'; }).join('');
  }
  // Stream dropdown — from regionBreakdown deal_type breakdown
  var strmSel = document.getElementById('pipe-filter-stream');
  if (strmSel) {
    var strms = {};
    var allDeals3 = [...(data.verified||[]), ...(data.partial||[]), ...(data.unverified||[])];
    allDeals3.forEach(function(d) { if (d.deal_type) strms[d.deal_type] = true; });
    strmSel.innerHTML = '<option value="">All stages/streams</option>' + Object.keys(strms).sort().map(function(k){ return '<option value="'+esc(k)+'">'+esc(k)+'</option>'; }).join('');
  }
  var prodSel = document.getElementById('pipe-filter-product');
  if (prodSel && _orgProducts?.length) {
    var opts = '<option value="">All products</option>' +
      _orgProducts.map(function(p) { return '<option value="'+p.id+'">'+esc(p.name)+'</option>'; }).join('');
    prodSel.innerHTML = opts;
  }
  // Regions dropdown
  var regSel = document.getElementById('pipe-filter-region');
  if (regSel) {
    var regions = new Set();
    [...(data.verified||[]),(data.partial||[]),(data.unverified||[])].flat().forEach(function(d) { if (d.region) regions.add(d.region); });
    regSel.innerHTML = '<option value="">All regions</option>' +
      Array.from(regions).sort().map(function(r) { return '<option value="'+esc(r)+'">'+esc(r)+'</option>'; }).join('');
  }
  // Revenue stream types from org config
  var streamSel = document.getElementById('pipe-filter-stream');
  if (streamSel) {
    var streamTypes = window._orgConfig?.revenue_stream_types || [];
    streamSel.innerHTML = '<option value="">All revenue streams</option>' +
      streamTypes.map(function(s) { return '<option value="'+esc(s.key||s.label)+'">'+esc(s.label)+'</option>'; }).join('');
  }
}

function renderPipelineDashboard(data) {
  var el = document.getElementById('pipelineDashboard');
  if (!el) return;
  var fmtUsd = function(v) { return fmtOrgMoney(v || 0); };
  var deals = getFilteredDeals(data);
  var html = '';

  if (_pipelineDashTab === 'byProduct') {
    html += renderByProductChart(deals, fmtUsd);
  } else if (_pipelineDashTab === 'byStream') {
    html += renderByStreamChart(deals, fmtUsd);
  } else if (_pipelineDashTab === 'byRegion') {
    if (canSeeTeam(profile?.role)) html += renderRepBreakdown(data, deals, fmtUsd);
  } else if (_pipelineDashTab === 'winloss') {
    html += renderWinLossChart(data, fmtUsd);
  } else if (_pipelineDashTab === 'attention') {
    html += renderAttentionPanel(deals, data, fmtUsd);
  } else {
    if (canSeeFullOrg(profile?.role)) html += renderExecInsights(data, deals, fmtUsd);
    else if (canSeeCrossTeam(profile?.role)) html += renderDirectorInsights(data, deals, fmtUsd);
    else if (canSeeTeam(profile?.role)) html += renderManagerInsights(data, deals, fmtUsd);
    else html += renderRepInsights(data, deals, fmtUsd);
  }

  el.innerHTML = html;
}

// ── Win / Loss summary ────────────────────────────────────────────────────────
function renderWinLossChart(data, fmtUsd) {
  var won  = (data.won  || []);
  var lost = (data.lost || []);
  if (!won.length && !lost.length) {
    return '<div style="text-align:center;padding:32px 0;color:var(--text3)">' +
      '<div style="font-size:26px;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M9.5 20h5M12 14v6"/></svg></div>' +
      '<div style="font-size:14px;font-weight:500;color:var(--text2);margin-bottom:4px">No closed deals yet</div>' +
      '<div style="font-size:12px">Mark deals as Won or Lost using the close deal button on each pipeline card.</div>' +
    '</div>';
  }
  var wonVal  = won.reduce(function(s,d){return s+(d.actual_value_usd||d.deal_value_usd||0);},0);
  var lostVal = lost.reduce(function(s,d){return s+(d.actual_value_usd||d.deal_value_usd||0);},0);
  var total   = wonVal + lostVal;
  var winRate = won.length + lost.length > 0 ? Math.round(won.length / (won.length + lost.length) * 100) : 0;
  var html = '';
  // KPI strip
  html += '<div style="display:flex;gap:8px;margin-bottom:16px">' +
    kpi('Win rate', winRate + '%', winRate >= 50 ? 'var(--green)' : 'var(--amber)') +
    kpi('Deals won', won.length, 'var(--green)') +
    kpi('Deals lost', lost.length, 'var(--coral)') +
    kpi('Won value', fmtUsd(wonVal), 'var(--green)') +
  '</div>';
  // Win/loss bar
  if (total > 0) {
    var wonPct = Math.round(wonVal / total * 100);
    html += '<div style="margin-bottom:16px">' +
      '<div style="display:flex;height:14px;border-radius:var(--r-sm);overflow:hidden;margin-bottom:4px">' +
        '<div style="width:'+wonPct+'%;background:var(--green)"></div>' +
        '<div style="flex:1;background:var(--coral)"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3)">' +
        '<span style="color:var(--green)">Won: '+fmtUsd(wonVal)+'</span>' +
        '<span style="color:var(--coral)">Lost: '+fmtUsd(lostVal)+'</span>' +
      '</div></div>';
  }
  // Won deals
  if (won.length) {
    html += '<div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M9.5 20h5M12 14v6"/></svg> Won deals</div>';
    won.forEach(function(d) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<span style="font-size:14px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M9.5 20h5M12 14v6"/></svg></span>' +
        '<div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--text)">'+esc(d.account)+'</div>' +
        '<div style="font-size:11px;color:var(--text3)">'+(d.close_reason?esc(d.close_reason):'')+(d.won_at?' · '+d.won_at.slice(0,10):'')+'</div></div>' +
        '<span style="font-size:12px;font-weight:600;color:var(--green)">'+fmtUsd(d.actual_value_usd||d.deal_value_usd||0)+'</span>' +
      '</div>';
    });
  }
  // Lost deals
  if (lost.length) {
    html += '<div style="font-size:11px;font-weight:700;color:var(--coral);text-transform:uppercase;letter-spacing:0.06em;margin:12px 0 8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg> Lost deals</div>';
    lost.forEach(function(d) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<span style="font-size:14px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>' +
        '<div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--text)">'+esc(d.account)+'</div>' +
        '<div style="font-size:11px;color:var(--text3)">'+(d.close_reason?esc(d.close_reason):'')+(d.lost_at?' · '+d.lost_at.slice(0,10):'')+'</div></div>' +
        '<span style="font-size:12px;color:var(--text3)">'+fmtUsd(d.deal_value_usd||0)+'</span>' +
      '</div>';
    });
  }
  return html;
}

function kpi(label, val, color) {
  return '<div style="flex:1;background:var(--surface2);border-radius:var(--r-md);padding:10px;text-align:center">' +
    '<div style="font-size:20px;font-weight:700;color:'+(color||'var(--text)')+'">'+val+'</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+label+'</div></div>';
}

// ── Shared bar chart helper ────────────────────────────────────────────────
function mkBars(rows, maxVal, fmtUsd) {
  if (!rows.length) return '<div style="font-size:12px;color:var(--text3);padding:8px 0">No data</div>';
  var COLORS = ['#3A6EA8','#A07824','#4A8C5C','#C0523F','#7B5EA7','#2E8B8B'];
  return rows.map(function(r, i) {
    var pct = maxVal > 0 ? Math.max(4, r.val / maxVal * 100) : 4;
    var color = r.color || COLORS[i % COLORS.length];
    // Stacked bar: verified (green) + partial (amber) + unverified (grey) if breakdown available
    var barHtml;
    if (r.verified !== undefined) {
      var verPct = r.val > 0 ? r.verified / r.val * pct : 0;
      var parPct = r.val > 0 ? (r.partial || 0) / r.val * pct : 0;
      var unvPct = Math.max(0, pct - verPct - parPct);
      barHtml = '<div style="flex:1;height:10px;background:rgba(0,0,0,0.1);border-radius:var(--r-sm);overflow:hidden;display:flex">' +
        (verPct>0?'<div style="height:100%;width:'+verPct+'%;background:#4A8C5C"></div>':'') +
        (parPct>0?'<div style="height:100%;width:'+parPct+'%;background:#A07824"></div>':'') +
        (unvPct>0?'<div style="height:100%;width:'+unvPct+'%;background:#888780"></div>':'') +
      '</div>';
    } else {
      barHtml = '<div style="flex:1;height:10px;background:rgba(0,0,0,0.1);border-radius:var(--r-sm);overflow:hidden">' +
        '<div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:var(--r-sm)"></div>' +
      '</div>';
    }
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">' +
      '<div style="font-size:12px;color:var(--text2);width:76px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+esc(r.label)+'">'+esc(r.label)+'</div>' +
      barHtml +
      '<div style="font-size:12px;color:var(--text);font-weight:600;width:46px;text-align:right;flex-shrink:0">'+fmtUsd(r.val)+'</div>' +
      (r.count !== undefined ? '<div style="font-size:11px;color:var(--text3);width:22px;flex-shrink:0">'+r.count+'d</div>' : '') +
    '</div>';
  }).join('');
}

// ── Role header card wrapper ──────────────────────────────────────────────
function mkRoleCard(roleLabel, roleColor, title, subtitle, content) {
  var cardId = 'rolecard-' + Math.random().toString(36).slice(2,7);
  return '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);overflow:hidden;margin-bottom:10px" id="'+cardId+'">' +
    '<div style="padding:16px 18px 12px;border-bottom:1px solid var(--border)">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between">' +
        '<div>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
            '<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:var(--r-md);background:'+roleColor+';color:#fff">'+esc(roleLabel)+'</span>' +
          '</div>' +
          '<div style="font-size:16px;font-weight:700;color:var(--text)">'+esc(title)+'</div>' +
          '<div style="font-size:12px;color:var(--text3);font-style:italic;margin-top:2px">'+esc(subtitle)+'</div>' +
        '</div>' +
        '<div style="position:relative">' +
          '<button onclick="togglePipelineCardMenu(\''+cardId+'\')" style="font-size:20px;color:var(--text3);cursor:pointer;padding:4px 8px;background:none;border:none;border-radius:var(--r-sm);line-height:1" title="Options">&#8943;</button>' +
          '<div id="menu-'+cardId+'" style="display:none;position:absolute;right:0;top:28px;background:var(--bg);border:1px solid var(--border2);border-radius:var(--r-sm);box-shadow:var(--shadow-2);z-index:99;min-width:160px;padding:4px 0">' +
            '<button onclick="switchTab(\'pipeline\')" style="width:100%;text-align:left;padding:8px 14px;font-size:13px;color:var(--text);background:none;border:none;cursor:pointer;font-family:var(--sans)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V4M4 20h16M8 17V11M12.5 17V7.5M17 17v-4"/></svg> View pipeline</button>' +
            '<button onclick="setPipelineDashTab(\'attention\')" style="width:100%;text-align:left;padding:8px 14px;font-size:13px;color:var(--text);background:none;border:none;cursor:pointer;font-family:var(--sans)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Needs attention</button>' +
            '<button onclick="setPipelineDashTab(\'byRegion\')" style="width:100%;text-align:left;padding:8px 14px;font-size:13px;color:var(--text);background:none;border:none;cursor:pointer;font-family:var(--sans)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg> By region</button>' +
 '<button onclick="setPipelineDashTab(\'byProduct\')" style="width:100%;text-align:left;padding:8px 14px;font-size:13px;color:var(--text);background:none;border:none;cursor:pointer;font-family:var(--sans)">By product</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div style="padding:16px 18px">'+content+'</div>' +
  '</div>';
}

function togglePipelineCardMenu(cardId) {
  var menu = document.getElementById('menu-'+cardId);
  if (!menu) return;
  var isOpen = menu.style.display !== 'none';
  // Close all other menus first
  document.querySelectorAll('[id^="menu-rolecard"]').forEach(function(m){ m.style.display='none'; });
  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    setTimeout(function(){ document.addEventListener('click', function handler(e){ menu.style.display='none'; document.removeEventListener('click',handler); }); }, 10);
  }
}

function mkMetricCard(label, value, sub, color) {
  return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px">' +
    '<div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;font-weight:600">'+esc(label)+'</div>' +
    '<div style="font-size:26px;font-weight:700;color:'+(color||'var(--text)')+'">'+value+'</div>' +
    (sub ? '<div style="font-size:11px;color:var(--text3);margin-top:3px">'+esc(sub)+'</div>' : '') +
  '</div>';
}

function mkAlertRow(dot, text) {
  return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">' +
    (dot ? '<div style="width:8px;height:8px;border-radius:50%;background:'+dot+';flex-shrink:0"></div>' : '<div style="width:8px;height:8px;flex-shrink:0"></div>') +
    '<div style="font-size:13px;color:var(--text)">'+text+'</div>' +
  '</div>';
}

// ── AE / SDR ─────────────────────────────────────────────────────────────
function renderRepInsights(data, deals, fmtUsd) {
  var today = new Date();
  var verified = deals.filter(function(d){return d.tier==='verified';});
  var partial  = deals.filter(function(d){return d.tier==='partial';});
  var unverif  = deals.filter(function(d){return d.tier==='unverified';});
  var totalVal = deals.reduce(function(s,d){return s+d.deal_value_usd;},0);
  var closing  = deals.filter(function(d){
    if (!d.expected_close) return false;
    var dt=new Date(d.expected_close), qEnd=new Date(today.getFullYear(),Math.floor(today.getMonth()/3)*3+3,0);
    return dt<=qEnd;
  });
  var closingVal  = closing.reduce(function(s,d){return s+d.deal_value_usd;},0);
  var closingW    = closing.reduce(function(s,d){return s+d.weighted_value_usd;},0);
  var hot         = deals.filter(function(d){return (d.signal_score||0)>=60;});
  var attn        = deals.filter(function(d){return d.expected_close && new Date(d.expected_close)<today;});
  var needsAttn   = attn.length + unverif.filter(function(d){return d.deal_value_usd>5000;}).length;

  // By product bars
  var byProduct = {};
  var PCOLS = ['#3A6EA8','#A07824','#4A8C5C','#C0523F','#7B5EA7','#2E8B8B'];
  deals.forEach(function(d){var k=d.product_name||'No product';if(!byProduct[k])byProduct[k]={val:0,i:Object.keys(byProduct).length};byProduct[k].val+=d.deal_value_usd;});
  var productRows = Object.entries(byProduct).sort(function(a,b){return b[1].val-a[1].val;}).slice(0,5).map(function(e){return {label:e[0],val:e[1].val,color:PCOLS[e[1].i%PCOLS.length]};});
  var maxP = Math.max.apply(null,productRows.map(function(r){return r.val;})||[1]);

  // Action items
  var actionItems = [];
  attn.forEach(function(d){actionItems.push({dot:'var(--coral)',text:esc(d.account)+' \u2014 close date passed ('+d.expected_close+')'});});
  hot.slice(0,3).forEach(function(d){if(!attn.find(function(a){return a.id===d.id;}))actionItems.push({dot:'var(--amber)',text:esc(d.account)+' \u2014 score '+d.signal_score+' \uD83D\uDD25 follow up now'});});
  unverif.filter(function(d){return d.deal_value_usd>5000;}).slice(0,2).forEach(function(d){actionItems.push({dot:'var(--blue)',text:esc(d.account)+' \u2014 confirm AI hint '+fmtUsd(d.deal_value_usd)});});
  if (!actionItems.length) actionItems.push({dot:'var(--green)',text:'\u2705 No urgent actions \u2014 pipeline looks healthy'});

  var inner = '';

  // Top 3 metrics
  inner += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">' +
    mkMetricCard('My pipeline', fmtUsd(totalVal), verified.length+' verified \u00b7 '+partial.length+' partial \u00b7 '+unverif.length+' unverified', 'var(--text)') +
    mkMetricCard('Closing this quarter', fmtUsd(closingVal), closing.length+' deals \u00b7 weighted '+fmtUsd(closingW), 'var(--green)') +
    mkMetricCard('Needs attention', needsAttn.toString(), 'Going cold or past close', needsAttn>0?'var(--amber)':'var(--green)') +
  '</div>';

  // Product bars + action items side by side
  inner += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';

  if (productRows.length) {
    inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px">Pipeline by product</div>' +
      mkBars(productRows, maxP, fmtUsd) +
    '</div>';
  }

  inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Action items</div>' +
    actionItems.slice(0,5).map(function(a){return mkAlertRow(a.dot,a.text);}).join('') +
  '</div>';

  inner += '</div>';

  return mkRoleCard('AE / SDR','#3B5BA5','My pipeline health','"Am I on track? What needs my attention today?"', inner);
}

// ── Manager ───────────────────────────────────────────────────────────────
function renderManagerInsights(data, deals, fmtUsd) {
  var today = new Date();
  var verified = deals.filter(function(d){return d.tier==='verified';});
  var verifiedVal = verified.reduce(function(s,d){return s+d.deal_value_usd;},0);
  var totalVal = deals.reduce(function(s,d){return s+d.deal_value_usd;},0);
  var pct = totalVal > 0 ? Math.round(verifiedVal/totalVal*100) : 0;
  var pctColor = pct>=50?'var(--green)':pct>=35?'var(--amber)':'var(--coral)';

  // Pipeline by rep — group by email, show first name only
  var byRep = {};
  deals.forEach(function(d){
    var email = d.rep_email || '';
    var name = email ? email.split('@')[0].split('.')[0] : (d.rep_user_id?.slice(0,6) || 'Unknown');
    name = name.charAt(0).toUpperCase() + name.slice(1); // capitalise
    if (!byRep[name]) byRep[name] = {val:0,verified:0,partial:0,count:0};
    byRep[name].val += d.deal_value_usd;
    byRep[name].count++;
    if (d.tier==='verified') byRep[name].verified += d.deal_value_usd;
    if (d.tier==='partial') byRep[name].partial += d.deal_value_usd;
  });
  var repRows = Object.entries(byRep).sort(function(a,b){return b[1].val-a[1].val;}).slice(0,8).map(function(e){
    var verPct = e[1].val>0?e[1].verified/e[1].val:0;
    var c = verPct>=0.5?'#4A8C5C':verPct>=0.3?'#A07824':'#888780';
    return {label:e[0], val:e[1].val, verified:e[1].verified, partial:e[1].partial, color:c, count:e[1].count};
  });
  var maxR = Math.max.apply(null, repRows.map(function(r){return r.val;})||[1]);

  // Coverage gaps
  var gaps = [];
  var noDeals = data.regionBreakdown?.filter(function(r){return r.verified_usd===0&&r.total_usd>0;}) || [];
  if (noDeals.length) noDeals.forEach(function(r){gaps.push({dot:'var(--coral)',text:esc(r.region)+' region \u2014 '+fmtUsd(r.total_usd)+' with zero verified deals'});});
  var atRisk = deals.filter(function(d){return d.expected_close&&new Date(d.expected_close)<today;});
  if (atRisk.length) gaps.push({dot:'var(--amber)',text:atRisk.length+' deal'+(atRisk.length>1?'s':'') + ' past expected close date across team'});
  var partial = deals.filter(function(d){return d.tier==='partial';});
  if (partial.length > deals.length*0.5) gaps.push({dot:'var(--amber)',text:'>50% of pipeline is partial \u2014 coach reps to run SAM signals'});
  var unverif = deals.filter(function(d){return d.tier==='unverified';});
  if (unverif.length) gaps.push({dot:'var(--blue)',text:unverif.length+' AI hints ('+fmtUsd(unverif.reduce(function(s,d){return s+d.deal_value_usd;},0))+') awaiting rep confirmation'});
  if (!gaps.length) gaps.push({dot:'var(--green)',text:'\u2705 No coverage gaps detected'});

  var inner = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';

  // Rep bars
  inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px">Pipeline by rep</div>' +
    (repRows.length ? mkBars(repRows, maxR, fmtUsd) : '<div style="font-size:12px;color:var(--text3)">No deal data yet</div>') +
    '<div style="display:flex;gap:10px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">' +
      '<div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:var(--r-sm);background:#4A8C5C"></div><span style="font-size:11px;color:var(--text3)">Verified</span></div>' +
      '<div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:var(--r-sm);background:#A07824"></div><span style="font-size:11px;color:var(--text3)">Partial</span></div>' +
      '<div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:var(--r-sm);background:#888780"></div><span style="font-size:11px;color:var(--text3)">Unverified</span></div>' +
    '</div>' +
  '</div>';

  // Coverage gaps
  inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Coverage gaps</div>' +
    gaps.slice(0,5).map(function(g){return mkAlertRow(g.dot,g.text);}).join('') +
  '</div>';

  inner += '</div>';

  // Bottom metrics
  inner += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
    '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Verified pipeline (team)</div>' +
      '<div style="font-size:26px;font-weight:700;color:var(--green)">'+fmtUsd(verifiedVal)+'</div>' +
      '<div style="height:6px;background:rgba(0,0,0,0.15);border-radius:var(--r-sm);margin:8px 0;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+pctColor+';border-radius:var(--r-sm)"></div></div>' +
      '<div style="font-size:11px;color:var(--text3)">'+pct+'% of total \u2014 target: 60%</div>' +
    '</div>' +
    mkMetricCard('Deals at risk', atRisk.length.toString(), 'Past close date or going cold', atRisk.length>0?'var(--coral)':'var(--green)') +
  '</div>';

  return mkRoleCard('Manager','#A07824','Team performance','"Who needs coaching? Where are the gaps?"', inner);
}

// ── Director ──────────────────────────────────────────────────────────────
function renderDirectorInsights(data, deals, fmtUsd) {
  var regions = (data.regionBreakdown || []).slice(0,5);
  var maxR = Math.max.apply(null, regions.map(function(r){return r.total_usd;})||[1]);
  var regionRows = regions.map(function(r,i){return {label:r.region,val:r.total_usd,color:['#3A6EA8','#A07824','#4A8C5C','#C0523F','#7B5EA7'][i%5]};});

  var verified = deals.filter(function(d){return d.tier==='verified';});
  var verifiedVal = verified.reduce(function(s,d){return s+d.deal_value_usd;},0);
  var totalVal = deals.reduce(function(s,d){return s+d.deal_value_usd;},0);
  var confPct = totalVal>0?Math.round(verifiedVal/totalVal*100):0;
  var weakRegions = regions.filter(function(r){return r.verified_usd===0;});

  var inner = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';

  inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px">Pipeline by region</div>' +
    (regionRows.length ? mkBars(regionRows, maxR, fmtUsd) : '<div style="font-size:12px;color:var(--text3)">No regional data</div>') +
  '</div>';

  var alerts = weakRegions.map(function(r){return {dot:'var(--coral)',text:esc(r.region)+' \u2014 '+fmtUsd(r.total_usd)+' with no verified deals'};});
  if (!alerts.length) alerts.push({dot:'var(--green)',text:'\u2705 All regions have verified pipeline'});
  inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Regional risk signals</div>' +
    alerts.map(function(a){return mkAlertRow(a.dot,a.text);}).join('') +
  '</div>';

  inner += '</div>';

  inner += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">' +
    mkMetricCard('Total pipeline', fmtUsd(totalVal), deals.length+' deals across '+regions.length+' regions', 'var(--text)') +
    mkMetricCard('Forecast confidence', confPct+'%', 'verified vs total pipeline', confPct>=50?'var(--green)':confPct>=35?'var(--amber)':'var(--coral)') +
    mkMetricCard('Regions with no verified deals', weakRegions.length.toString(), weakRegions.map(function(r){return r.region;}).join(', ')||'All clear', weakRegions.length?'var(--coral)':'var(--green)') +
  '</div>';

  return mkRoleCard('Director','#3B5BA5','Cross-team pipeline intelligence','"Where is growth coming from? Where is the risk?"', inner);
}

// ── CXO / Exec ────────────────────────────────────────────────────────────
function renderExecInsights(data, deals, fmtUsd) {
  var s = data.summary || {};
  var confPct = s.total_value_usd>0?Math.round(s.verified_value_usd/s.total_value_usd*100):0;
  var weightedPct = s.total_value_usd>0?Math.round(s.weighted_value_usd/s.total_value_usd*100):0;
  var pctColor = confPct>=50?'var(--green)':confPct>=35?'var(--amber)':'var(--coral)';

  // Product performance bars
  var byProduct = {};
  var PCOLS = ['#3A6EA8','#A07824','#4A8C5C','#C0523F','#7B5EA7'];
  deals.forEach(function(d){var k=d.product_name||'Unclassified';if(!byProduct[k])byProduct[k]={val:0,verified:0,i:Object.keys(byProduct).length};byProduct[k].val+=d.deal_value_usd;if(d.tier==='verified')byProduct[k].verified+=d.deal_value_usd;});
  var productRows = Object.entries(byProduct).sort(function(a,b){return b[1].val-a[1].val;}).slice(0,5).map(function(e){return {label:e[0],val:e[1].val,color:PCOLS[e[1].i%PCOLS.length]};});
  var maxP = Math.max.apply(null,productRows.map(function(r){return r.val;})||[1]);

  var inner = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">' +
    mkMetricCard('Total org pipeline', fmtUsd(s.total_value_usd||0), fmtUsd(s.weighted_value_usd||0)+' weighted \u00b7 '+fmtUsd(s.closing_this_quarter_usd||0)+' this quarter', 'var(--text)') +
    mkMetricCard('Forecast confidence', confPct+'%', 'of pipeline is fully verified', pctColor) +
    mkMetricCard('Win probability', weightedPct+'%', 'weighted vs total pipeline', 'var(--blue)') +
  '</div>';

  inner += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';

  if (productRows.length) {
    inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px">Product line performance</div>' +
      mkBars(productRows, maxP, fmtUsd) +
    '</div>';
  }

  // Top risk signals
  var risks = [];
  var unverif = deals.filter(function(d){return d.tier==='unverified';});
  if (unverif.length) risks.push({dot:'var(--amber)',text:fmtUsd(unverif.reduce(function(s,d){return s+d.deal_value_usd;},0))+' unverified \u2014 awaiting rep confirmation'});
  var noVerRegions = (data.regionBreakdown||[]).filter(function(r){return r.verified_usd===0&&r.total_usd>0;});
  noVerRegions.forEach(function(r){risks.push({dot:'var(--coral)',text:esc(r.region)+' \u2014 '+fmtUsd(r.total_usd)+' pipeline, zero verified'});});
  var today = new Date();
  var atRisk = deals.filter(function(d){return d.expected_close&&new Date(d.expected_close)<today;});
  if (atRisk.length) risks.push({dot:'var(--coral)',text:atRisk.length+' deal'+(atRisk.length>1?'s':'')+' past close date \u2014 need exec review'});
  if (!risks.length) risks.push({dot:'var(--green)',text:'\u2705 No critical pipeline risks detected'});

  inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Top risk signals</div>' +
    risks.slice(0,5).map(function(r){return mkAlertRow(r.dot,r.text);}).join('') +
  '</div>';

  inner += '</div>';

  return mkRoleCard('CXO / Exec','#4A8C5C','Org pipeline intelligence','"Are we going to hit the number? Where is the risk?"', inner);
}

// ── Attention panel ───────────────────────────────────────────────────────
function renderAttentionPanel(deals, data, fmtUsd) {
  var today = new Date();
  var alerts = [];
  deals.forEach(function(d) {
    if (d.expected_close && new Date(d.expected_close) < today)
      alerts.push({dot:'var(--coral)', text:esc(d.account)+' \u2014 close date passed ('+d.expected_close+')'});
  });
  var unverifiedHV = deals.filter(function(d){return d.tier==='unverified'&&d.deal_value_usd>5000;});
  if (unverifiedHV.length)
    alerts.push({dot:'var(--amber)',text:unverifiedHV.length+' high-value AI hints need confirmation \u2014 '+fmtUsd(unverifiedHV.reduce(function(s,d){return s+d.deal_value_usd;},0))+' at stake'});
  (data.regionBreakdown||[]).filter(function(r){return r.verified_usd===0&&r.total_usd>0;}).forEach(function(r){
    alerts.push({dot:'var(--amber)',text:esc(r.region)+' \u2014 '+fmtUsd(r.total_usd)+' pipeline with zero verified deals'});
  });
  if (!alerts.length)
    return '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:20px;text-align:center;color:var(--green);font-size:14px;font-weight:600">\u2705 No immediate attention items \u2014 pipeline looks healthy.</div>';

  return '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);overflow:hidden">' +
    '<div style="padding:14px 18px;border-bottom:1px solid var(--border)">' +
      '<div style="font-size:14px;font-weight:700;color:var(--text)">Action items</div>' +
      '<div style="font-size:12px;color:var(--text3);font-style:italic">'+alerts.length+' items need your attention</div>' +
    '</div>' +
    '<div style="padding:8px 18px">' +
      alerts.map(function(a){return mkAlertRow(a.dot,a.text);}).join('') +
    '</div>' +
  '</div>';
}

// ── CRM CSV Audit (Samora Intelligence — deterministic, no AI) ────────────────
var _crmAudit = null; // { headers, rawRows, mapping, results, summary, missing }

function openCrmImport() { document.getElementById('crmCsvInput')?.click(); }

// Minimal RFC-4180-ish CSV parser — handles quoted fields, embedded commas/newlines
function _parseCsv(text) {
  var rows = [], row = [], field = '', inQ = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Auto-detect CRM columns by header name — Zoho, HubSpot, Salesforce, Pipedrive variants
function _detectCrmColumns(headers) {
  // Pattern-priority search: most specific pattern wins across ALL headers,
  // and ID-ish columns (Account Name.id, ACCOUNTID…) are never picked.
  var find = function(patterns) {
    for (var p = 0; p < patterns.length; p++) {
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i].toLowerCase().trim();
        if (/(^|[^a-z])id$|\.id$|^id($|[^a-z])/.test(h)) continue;
        if (patterns[p].test(h)) return i;
      }
    }
    return -1;
  };
  return {
    name:          find([/^(deal|potential|opportunity)\s*name$/, /^deal$/, /^potential$/, /^opportunity$/, /deal.*name/, /potential.*name/]),
    account:       find([/^account\s*name$/, /^company(\s*name)?$/, /^organi[sz]ation$/, /account/, /company/]),
    stage:         find([/^stage$/, /deal.*stage/, /stage/]),
    amount:        find([/^amount$/, /^deal\s*value$/, /^value$/, /amount/, /revenue/]),
    close_date:    find([/clos(e|ing)\s*date/, /expected.*close/]),
    last_activity: find([/last\s*activity/, /modified\s*time/, /last\s*contacted/, /last\s*update/, /activity\s*date/]),
    owner:         find([/owner/, /deal\s*owner/, /assigned/]),
    email:         find([/^email$/, /contact.*email/, /e-?mail/])
  };
}

async function handleCrmCsv(file) {
  if (!file) return;
  var section = document.getElementById('crmAuditSection');
  var btn = document.getElementById('crmImportBtn');
  if (btn) { btn.textContent = '↻ Reading…'; btn.disabled = true; }
  try {
    var text = await file.text();
    var rows = _parseCsv(text);
    if (rows.length < 2) { showToast('CSV appears empty'); return; }
    var headers = rows[0];
    var map = _detectCrmColumns(headers);
    if (map.name === -1 && map.account === -1) { showToast('Could not find a deal/account name column'); return; }

    var payloadRows = rows.slice(1).filter(function(r){ return r.join('').trim(); }).slice(0, 200).map(function(r) {
      var get = function(idx){ return idx >= 0 ? (r[idx]||'').trim() : ''; };
      return { name: get(map.name) || get(map.account), account: get(map.account) || get(map.name),
        stage: get(map.stage), amount: get(map.amount), close_date: get(map.close_date),
        last_activity: get(map.last_activity), owner: get(map.owner), email: get(map.email) };
    });

    if (section) section.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:10px"><span style="animation:spin 1s linear infinite;display:inline-block">↻</span> Verifying ' + payloadRows.length + ' deals against Gmail, calendar & sequencing evidence…</div>';

    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'crm_verify', rows: payloadRows }) });
    var d = await r.json();
    if (!d.ok) { if (section) section.innerHTML = '<div style="font-size:12px;color:var(--coral);padding:10px">' + esc(d.error||'Verification failed') + '</div>'; return; }

    _crmAudit = { headers: headers, rawRows: rows.slice(1), mapping: map, results: d.results, summary: d.summary, missing: d.missing_from_crm || [], fileName: file.name };
    _renderCrmAudit();
  } catch(e) { showToast('CSV error: ' + e.message); }
  finally { if (btn) { btn.textContent = '⇪ CRM audit'; btn.disabled = false; } }
}

function _renderCrmAudit() {
  var section = document.getElementById('crmAuditSection');
  if (!section || !_crmAudit) return;
  var s = _crmAudit.summary;
  var statusMeta = {
    verified:      { col:'var(--green)', label:'Verified',     icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>' },
    cooling:       { col:'var(--amber)', label:'Cooling',      icon:'◐' },
    at_risk:       { col:'var(--coral)', label:'At risk',      icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg>' },
    no_evidence:   { col:'var(--coral)', label:'No evidence',  icon:'∅' },
    not_in_samora: { col:'var(--text3)', label:'Not tracked',  icon:'—' }
  };
  var html = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:14px">';
  // Branded header
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">';
  html += '<img src="icons/icon-48.png" alt="Samora" style="width:18px;height:18px;border-radius:50%"/>';
  html += '<span style="font-size:13px;font-weight:600;color:var(--text)">CRM Verification Report</span>';
  html += '<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;background:rgba(var(--c-accent-rgb),0.12);padding:2px 6px;border-radius:var(--r-sm)">Samora Intelligence</span>';
  html += '<span style="flex:1"></span>';
  html += '<button onclick="exportCrmEnriched()" style="padding:4px 12px;border-radius:var(--r-md);background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5M4.5 19.5h15"/></svg> Export enriched CSV</button>';
  html += '<button onclick="_crmAudit=null;document.getElementById(\'crmAuditSection\').innerHTML=\'\'" style="padding:4px 8px;border-radius:var(--r-md);background:var(--surface2);border:1px solid var(--border2);color:var(--text3);font-size:11px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  html += '</div>';
  // The headline — CRM says vs reality
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
  var chip = function(num, label, col) {
    return '<div style="flex:1;min-width:90px;background:var(--surface2);border-radius:var(--r-sm);padding:8px 10px;text-align:center"><div style="font-size:16px;font-weight:700;color:' + col + '">' + num + '</div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">' + label + '</div></div>';
  };
  html += chip(s.total_rows, 'CRM deals', 'var(--text)');
  html += chip(s.verified, 'Verified ≤14d', 'var(--green)');
  html += chip(s.at_risk + s.cooling, 'Cooling / at risk', 'var(--amber)');
  html += chip(s.no_evidence, 'No evidence', 'var(--coral)');
  html += chip(s.trust_pct + '%', 'Pipeline you can trust', s.trust_pct >= 60 ? 'var(--green)' : 'var(--coral)');
  html += '</div>';
  if (s.deals_with_optimism_gap > 0) {
    html += '<div style="font-size:12px;color:var(--text2);background:rgba(192,82,63,0.08);border-left:3px solid var(--coral);border-radius:0 6px 6px 0;padding:8px 12px;margin-bottom:12px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/></svg> <strong>' + s.deals_with_optimism_gap + ' deal' + (s.deals_with_optimism_gap!==1?'s':'') + '</strong> show CRM activity more recent than any verified evidence, average gap <strong>' + s.avg_optimism_gap_days + ' days</strong>. This is the difference between what was logged and what actually happened.</div>';
  }
  // Table
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
  html += '<tr style="color:var(--text3);text-align:left"><th style="padding:5px 8px;font-weight:600">CRM deal</th><th style="padding:5px 8px;font-weight:600">CRM last activity</th><th style="padding:5px 8px;font-weight:600">Verified last contact</th><th style="padding:5px 8px;font-weight:600">Gap</th><th style="padding:5px 8px;font-weight:600">Days dark</th><th style="padding:5px 8px;font-weight:600">Status</th></tr>';
  _crmAudit.results.forEach(function(rw) {
    var m = statusMeta[rw.status] || statusMeta.not_in_samora;
    html += '<tr style="border-top:1px solid var(--border)">';
    html += '<td style="padding:6px 8px;color:var(--text);font-weight:500">' + esc(rw.crm_name) + (rw.matched && rw.samora_account !== rw.crm_name ? '<div style="font-size:11px;color:var(--text3)">→ ' + esc(rw.samora_account) + '</div>' : '') + '</td>';
    html += '<td style="padding:6px 8px;color:var(--text2)">' + esc(rw.crm_last_activity || '—') + '</td>';
    html += '<td style="padding:6px 8px;color:var(--text2)">' + esc(rw.samora_last_verified_contact || '—') + '</td>';
    html += '<td style="padding:6px 8px;color:' + (rw.gap_days > 7 ? 'var(--coral)' : 'var(--text2)') + ';font-weight:' + (rw.gap_days > 7 ? '700' : '400') + '">' + (rw.gap_days != null ? (rw.gap_days > 0 ? '+' : '') + rw.gap_days + 'd' : '—') + '</td>';
    html += '<td style="padding:6px 8px;color:var(--text2)">' + (rw.samora_days_dark != null ? rw.samora_days_dark + 'd' : '—') + '</td>';
    html += '<td style="padding:6px 8px"><span style="color:' + m.col + ';font-weight:600">' + m.icon + ' ' + m.label + '</span></td>';
    html += '</tr>';
  });
  html += '</table></div>';
  // Deals Samora tracks that the CRM is missing
  if (_crmAudit.missing.length) {
    html += '<div style="margin-top:10px;font-size:11px;color:var(--text3)">Also in Samora but not in this export: ' + _crmAudit.missing.map(function(x){ return esc(x.account); }).join(', ') + '</div>';
  }
  html += '</div>';
  section.innerHTML = html;
}

function exportCrmEnriched() {
  if (!_crmAudit) return;
  var q = function(v) { v = v == null ? '' : String(v); return (v.indexOf(',') >= 0 || v.indexOf('"') >= 0 || v.indexOf('\n') >= 0) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var extra = ['samora_status','samora_health_score','samora_signal_score','samora_last_verified_contact','samora_days_dark','samora_gap_days','samora_champion_identified','samora_seq_touchpoints','samora_seq_replies'];
  var out = _crmAudit.headers.map(q).join(',') + ',' + extra.join(',') + '\n';
  _crmAudit.rawRows.forEach(function(raw, i) {
    var rw = _crmAudit.results[i];
    var extras = rw ? [rw.status, rw.samora_health_score, rw.samora_signal_score, rw.samora_last_verified_contact, rw.samora_days_dark, rw.gap_days, rw.samora_champion_identified, rw.seq_touchpoints, rw.seq_replies] : ['','','','','','','','',''];
    out += raw.map(q).join(',') + ',' + extras.map(q).join(',') + '\n';
  });
  var blob = new Blob([out], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (_crmAudit.fileName || 'crm').replace(/\.csv$/i, '') + '_samora_verified.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── SDR pipeline-generation panel ─────────────────────────────────────────────
// SDRs carry generation targets, not revenue targets. This panel credits the
// SDR's real work: net-new stakeholders brought into discussion + attributed pipeline.
async function loadSdrPanel() {
  var panel = document.getElementById('sdrGenPanel');
  if (!panel) return;
  if ((profile?.role||'').toLowerCase() !== 'sdr') { panel.innerHTML = ''; return; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'get_sdr_stats', days: 30 }) });
    var d = await r.json();
    if (!d.ok) { panel.innerHTML = ''; return; }
    var chip = function(num, label, col) {
      return '<div style="flex:1;min-width:80px;background:var(--surface2);border-radius:var(--r-md);padding:10px;text-align:center"><div style="font-size:20px;font-weight:700;color:'+(col||'var(--text)')+'">'+num+'</div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-top:2px">'+label+'</div></div>';
    };
    var pipeK = fmtOrgMoney(d.pipeline_generated_usd || 0);
    var html = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:14px;margin-bottom:14px">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">';
    html += '<img src="icons/icon-48.png" style="width:16px;height:16px;border-radius:50%"/>';
    html += '<span style="font-size:13px;font-weight:600;color:var(--text);flex:1">Pipeline Generation · last 30 days</span>';
    html += '<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;background:rgba(var(--c-accent-rgb),0.12);padding:2px 6px;border-radius:var(--r-sm)">SDR</span>';
    html += '</div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
    html += chip(d.new_prospects, 'New stakeholders contacted', 'var(--text)');
    html += chip(d.new_prospects_engaged, 'Brought into discussion', 'var(--green)');
    html += chip(d.engagement_rate + '%', 'Engagement rate', d.engagement_rate >= 10 ? 'var(--green)' : 'var(--amber)');
    html += chip(d.new_companies_touched, 'New companies', 'var(--text)');
    html += '</div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    html += chip(pipeK, 'Pipeline generated', 'var(--gold)');
    html += chip(d.pipeline_generated_deals, 'Deals sourced', 'var(--gold)');
    html += chip(d.accounts_sourced_period, 'Sourced this period', 'var(--text)');
    html += '</div>';
    if (d.recent_new_engaged && d.recent_new_engaged.length) {
      html += '<div style="margin-top:10px;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">↩ Newest stakeholders in discussion</div>';
      html += '<div style="display:flex;gap:5px;flex-wrap:wrap">';
      d.recent_new_engaged.forEach(function(p) {
        html += '<span style="font-size:11px;padding:3px 9px;border-radius:var(--r-sm);background:rgba(74,140,92,0.1);color:var(--green)">'+esc(p.name)+(p.company?' · '+esc(p.company):'')+'</span>';
      });
      html += '</div>';
    }
    if (!d.pipeline_generated_deals) {
      html += '<div style="margin-top:8px;font-size:11px;color:var(--text3)">Pipeline attribution comes from the AE/manager tagging "SDR sourced this" on a deal.</div>';
    }
    html += '</div>';
    panel.innerHTML = html;
  } catch(e) { panel.innerHTML = ''; }
}

// ── SDR Playground ────────────────────────────────────────────────────────────
// SDRs see the deals their team's AEs/managers are working on, can create new
// leads (scoutable prospective accounts), and generate prospective contacts with
// the same scout flow AEs use. Team = everyone under the SDR's manager_id, plus
// the manager. Leads = accounts where they are the assigned SDR (sdr_user_id).
window._sdrDeals = {};
function _sdrDealCard(a, kind) {
  var v = a.deal_value_usd ? fmtOrgMoney(a.deal_value_usd) : '';
  var owner = (a._owner_email||'').split('@')[0];
  var meta = [a.region?esc(a.region):'', owner?('AE: '+esc(owner)):'', v].filter(Boolean).join(' · ');
  return '<div onclick="openSdrScout(\''+esc(a.id)+'\',\''+esc(a.account_name)+'\')" style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:10px 12px;margin-bottom:6px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px">' +
    '<div style="min-width:0"><div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(a.account_name)+(kind==='lead'?' <span style="font-size:11px;font-weight:700;color:var(--gold);background:rgba(var(--c-accent-rgb),0.12);border-radius:var(--r-sm);padding:1px 5px;vertical-align:middle">MY LEAD</span>':'')+'</div>' +
    (meta?'<div style="font-size:11px;color:var(--text3);margin-top:2px">'+meta+'</div>':'') + '</div>' +
    '<div style="font-size:11px;color:var(--gold);flex-shrink:0;white-space:nowrap"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Scout ›</div></div>';
}
async function loadSdrPlayground() {
  var panel = document.getElementById('sdrPlayground');
  if (!panel) return;
  // Lead sourcing only — SAMpaign (manual campaigns + analytics) moved to
  // the SAM tab (see loadSampaignWorkspace), open to sdr/ae/manager there,
  // since outreach belongs alongside the rest of SAM Agent's signal
  // intelligence, not tucked into the Pipeline tab. This container stays
  // SDR-only: sourcing leads for AEs to work is a distinct concept from
  // running outreach on them.
  if ((profile?.role||'').toLowerCase() !== 'sdr') { panel.innerHTML = ''; return; }
  panel.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">Loading your team\'s deals…</div>';
  window._sdrDeals = {};
  try {
    var org = profile.org_id, mgr = profile.manager_id || null;
    // Team = peers under my manager + the manager themselves.
    var teamIds = [];
    var emailById = {};
    if (mgr) {
      var peers = await sbGet('user_profiles?org_id=eq.'+org+'&manager_id=eq.'+mgr+'&is_active=not.is.false&select=user_id,email,role');
      (peers||[]).forEach(function(p){ if (p.user_id !== currentUser.id) { teamIds.push(p.user_id); emailById[p.user_id]=p.email; } });
      teamIds.push(mgr);
      try { var mgrRow = await sbGet('user_profiles?user_id=eq.'+mgr+'&select=user_id,email&limit=1'); if (mgrRow&&mgrRow[0]) emailById[mgr]=mgrRow[0].email; } catch(e){}
    }
    // My leads (I'm the assigned SDR).
    var myLeads = await sbGet('org_accounts?org_id=eq.'+org+'&sdr_user_id=eq.'+currentUser.id+'&select=id,account_name,domain,region,deal_value_usd,user_id,sdr_user_id&order=account_name');
    // Team deals (owned by an AE/manager on my team), excluding ones I already source.
    var teamDeals = [];
    if (teamIds.length) {
      teamDeals = await sbGet('org_accounts?org_id=eq.'+org+'&user_id=in.('+teamIds.join(',')+')&deal_status=not.in.(won,lost)&select=id,account_name,domain,region,deal_value_usd,user_id,sdr_user_id&order=account_name&limit=100') || [];
    }
    var mine = (myLeads||[]);
    var mineIds = new Set(mine.map(function(a){return a.id;}));
    teamDeals = teamDeals.filter(function(a){ return !mineIds.has(a.id); });
    teamDeals.forEach(function(a){ a._owner_email = emailById[a.user_id] || ''; });
    mine.concat(teamDeals).forEach(function(a){ window._sdrDeals[a.id] = { id:a.id, account:a.account_name, deal_value_usd:a.deal_value_usd||0, stage:'prospective', region:a.region||'' }; });

    var html = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:14px;margin-bottom:14px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><span style="font-size:13px;font-weight:600;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z"/></svg> Lead Sourcing</span>' +
      '<button onclick="toggleSdrLeadForm()" id="sdrNewLeadBtn" style="font-size:11px;font-weight:600;padding:5px 12px;border-radius:var(--r-sm);background:var(--gold);border:none;color:var(--c-canvas);cursor:pointer;font-family:var(--sans)">+ New lead</button></div>';
    // Create-lead form (hidden by default)
    html += '<div id="sdrLeadForm" style="display:none;background:var(--surface2);border-radius:var(--r-md);padding:10px;margin-bottom:12px">' +
      '<div style="display:flex;flex-direction:column;gap:6px">' +
      '<input id="sdrLeadName" placeholder="Company / account name" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/>' +
      '<div style="display:flex;gap:6px"><input id="sdrLeadDomain" placeholder="domain.com" style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/>' +
      '<input id="sdrLeadRegion" placeholder="Region (e.g. APAC)" style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/></div>' +
      '<div style="font-size:11px;color:var(--text3)">Domain powers contact scouting; region keeps prospects geo-consistent.</div>' +
      '<button onclick="createSdrLead()" style="padding:9px;border:none;border-radius:var(--r-sm);background:var(--gold);color:var(--c-canvas);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--sans)">Create lead &amp; open</button>' +
      '</div></div>';
    // My leads
    html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:4px 0 6px">My leads ('+mine.length+')</div>';
    html += mine.length ? mine.map(function(a){ return _sdrDealCard(a,'lead'); }).join('') : '<div style="font-size:11px;color:var(--text3);padding:2px 0 8px">No leads yet. Create one to start scouting contacts.</div>';
    // Team deals
    html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 6px">Team deals ('+teamDeals.length+')</div>';
    html += teamDeals.length ? teamDeals.map(function(a){ return _sdrDealCard(a,'team'); }).join('') : '<div style="font-size:11px;color:var(--text3);padding:2px 0">' + (mgr?'No open deals on your team yet.':'You are not linked to a manager yet, so no team deals to show. Ask your manager to assign you.') + '</div>';
    html += '</div>';
    panel.innerHTML = html;
  } catch(e) { panel.innerHTML = '<div style="font-size:11px;color:var(--coral);padding:6px 0">Could not load playground: '+esc(e.message)+'</div>'; }
}

// ── Manual SAMpaigns (no sequencing tool) ───────────────────────────────────
// Lets an AE/SDR/Manager run outreach entirely inside Samora — create a
// campaign, set a follow-up cadence, upload a contact list (CSV — same
// convention as the existing CRM-audit upload, no new client-side library),
// log status per contact, and let sam-cron's run_sampaign_followups handle
// the reminders. Deliberately separate from tool-synced SAMpaign Analytics
// (get_sequencing_stats): different data, different alert engine, kept
// honest rather than blended into one number.
window._sampaignExpanded = {};
window._sampaignContactsCache = {};

// Renders the role-gated "My SAMpaigns" create-form + list into
// #sampaignManualSection (inside the #sampaignWorkspace card on the SAM
// tab's Signal sub-tab). Manager sees their own + direct reports' campaigns
// (list_sampaigns is already role-tiered the same way get_sequencing_stats
// is — self/team/org via canSeeTeam/canSeeCrossTeam/canSeeFullOrg), so no
// backend change was needed for "manager should see the team's analytics
// too" — this was purely a frontend wiring gap.
// ═══════════════════════════════════════════════════════════════════════════
// SAMpaign SCHEDULER — write once, queue it, let it go out on time.
//
// Sends leave from the rep's own Gmail via a narrow server action, so they
// land at the scheduled minute whether or not anyone is logged in. The queue
// deliberately shows every individual recipient BEFORE anything is sent:
// scheduled outbound that you cannot inspect in advance is how accidents
// happen.
// ═══════════════════════════════════════════════════════════════════════════
var _SAMPAIGN_SEND_VARS = [
  { k: '{{first_name}}', d: 'First name only' },
  { k: '{{name}}',       d: 'Full name' },
  { k: '{{company}}',    d: 'Company' },
  { k: '{{title}}',      d: 'Job title' }
];

function openSampaignComposer(campaignId) {
  document.getElementById('sampaign-composer-modal')?.remove();
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var all = (window._sampaignContactsCache || {})[campaignId] || [];
  var sendable = (typeof _sampSendableFor === 'function') ? _sampSendableFor(all, window._sampComposerLaunch || 1)
    : all.filter(function(x){ return x.email && x.status === 'not_contacted'; });
  window._sampComposerLaunch = null;
  var noEmail = all.filter(function(x){ return !x.email; }).length;

  // Default to the next weekday at 9am. A default that lands on Saturday, or
  // three minutes from now, is a trap.
  var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);

  var m = document.createElement('div');
  m.id = 'sampaign-composer-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);z-index:100000;display:flex;align-items:flex-end;justify-content:center';
  m.innerHTML = '<div style="background:var(--bg);border-radius:3px 18px 0 0;width:100%;max-width:640px;max-height:92vh;overflow-y:auto;padding:20px" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">' +
      '<div><div style="font-size:16px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Schedule outreach</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(c.name||'SAMpaign')+' · sends from your own Gmail</div></div>' +
      '<button onclick="document.getElementById(\'sampaign-composer-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3);padding:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +
    (sendable.length
      ? '<div style="font-size:11px;color:var(--text2);background:var(--surface2);border-radius:var(--r-sm);padding:8px 10px;margin-bottom:10px">Will queue <strong>'+sendable.length+'</strong> contact'+(sendable.length!==1?'s':'')+' who have an email and have not been contacted yet.'+(noEmail?' <span style="color:var(--gold)">'+noEmail+' skipped, no email yet.</span>':'')+'</div>'
      : '<div style="font-size:11px;color:var(--coral);background:rgba(196,90,74,0.08);border-radius:var(--r-sm);padding:8px 10px;margin-bottom:10px">No contacts are ready to send to. They need an email address and a "Not contacted" status.</div>') +
    '<input id="sampSendSubject" placeholder="Subject" style="width:100%;box-sizing:border-box;padding:9px 11px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:13px;margin-bottom:6px"/>' +
    '<textarea id="sampSendBody" rows="9" placeholder="Hi {{first_name}},&#10;&#10;..." style="width:100%;box-sizing:border-box;padding:9px 11px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:13px;resize:vertical;line-height:1.5"></textarea>' +
    '<div style="display:flex;gap:5px;flex-wrap:wrap;margin:7px 0">' +
      '<span style="font-size:11px;color:var(--text3);align-self:center">Insert:</span>' +
      _SAMPAIGN_SEND_VARS.map(function(v){
        return '<span onclick="_sampInsertVar(\''+v.k+'\')" title="'+esc(v.d)+'" style="cursor:pointer;font-size:11px;font-family:var(--mono,monospace);color:var(--gold);background:rgba(var(--c-accent-rgb),0.1);border:1px solid rgba(var(--c-accent-rgb),0.25);border-radius:var(--r-sm);padding:3px 7px">'+esc(v.k)+'</span>';
      }).join('') +
    '</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:10px">Filled in per person at send time, so anything Enrich finds between now and then is used. A variable with no value becomes blank, never the raw {{tag}}.</div>' +
    // Which wave this copy belongs to. Follow-ups already have a date on the
    // campaign, so picking one here also fixes when it goes out.
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">' +
      '<span style="font-size:11px;color:var(--text3)">Wave</span>' +
      '<select id="sampSendLaunch" onchange="_sampComposerLaunchChanged(\''+esc(campaignId)+'\')" style="padding:6px 9px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px">' +
        (function(){
          var dates = (c.followup_dates||[]).map(function(x){ return String(x).slice(0,10); }).sort();
          var opts = '<option value="1">Initial send</option>';
          dates.forEach(function(dt, i) {
            opts += '<option value="'+(i+2)+'">Follow-up '+(i+1)+' · '+new Date(dt+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})+'</option>';
          });
          return opts;
        })() +
      '</select>' +
      '<span id="sampSendLaunchHint" style="font-size:11px;color:var(--text3)"></span>' +
    '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
      '<span style="font-size:11px;color:var(--text3)">Start</span>' +
      '<input type="date" id="sampSendDate" value="'+dateKey(d)+'" style="padding:7px 9px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<input type="time" id="sampSendTime" value="09:00" style="padding:7px 9px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<span id="sampSendWhen" style="font-size:11px;color:var(--text3)"></span>' +
    '</div>' +
    '<div id="sampSendWeekendWarn"></div>' +
    '<div id="sampSendLimit" style="margin-top:8px"></div>' +
    '<button onclick="submitSampaignSchedule(\''+esc(campaignId)+'\')" '+(sendable.length?'':'disabled')+' style="width:100%;margin-top:10px;padding:11px;border-radius:var(--r-md);background:'+(sendable.length?'var(--green)':'var(--border2)')+';border:none;color:#fff;font-size:14px;font-weight:700;cursor:'+(sendable.length?'pointer':'not-allowed')+';font-family:var(--sans)">Prepare '+(sendable.length||0)+' email'+(sendable.length!==1?'s':'')+'</button>' +
    '<div id="sampSendQueue" style="margin-top:14px"></div>' +
  '</div>';
  m.addEventListener('click', function(){ m.remove(); });
  document.body.appendChild(m);
  ['sampSendDate','sampSendTime'].forEach(function(id){
    document.getElementById(id)?.addEventListener('change', _sampSendWhenHint);
  });
  _sampSendWhenHint();
  loadSampaignSendQueue(campaignId);
  _loadSendingLimit();
}

// Today's allowance, shown BEFORE anyone writes anything. A limit discovered
// by being refused reads as a broken tool — which is exactly how this
// surfaced with Prachi.
async function _loadSendingLimit() {
  var box = document.getElementById('sampSendLimit');
  if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'get_sending_limit' }) });
    var d = await r.json();
    if (!d.ok) { box.innerHTML = ''; return; }
    var used = (d.sent_today || 0) + (d.queued_today || 0);
    var pct = d.today_limit ? Math.min(100, Math.round((used / d.today_limit) * 100)) : 0;
    box.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:9px 11px">' +
      '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
        '<span style="font-size:11px;font-weight:600;color:var(--text)">'+d.remaining_today+' of '+d.today_limit+' left to send today</span>' +
        '<span style="font-size:11px;color:var(--text3)">'+esc(d.reason||'')+'</span>' +
      '</div>' +
      '<div style="height:4px;border-radius:var(--r-sm);background:var(--border2);margin-top:6px;overflow:hidden">' +
        '<div style="height:100%;width:'+pct+'%;background:'+(pct>=100?'var(--coral)':'var(--gold)')+'"></div>' +
      '</div>' +
      // Stated plainly because both of these are things a rep would otherwise
      // learn by being surprised: the budget is shared with follow-ups, and
      // going over delays rather than drops.
      '<div style="font-size:11px;color:var(--text3);margin-top:6px;line-height:1.5">First emails and follow-ups share this number. Anything over it moves to the next day, nothing is lost. Your limit rises as the mailbox builds a sending history.</div>' +
    '</div>';
  } catch(e) { box.innerHTML = ''; }
}

function _sampSendWhenHint() {
  var dv = document.getElementById('sampSendDate')?.value;
  var tv = document.getElementById('sampSendTime')?.value || '09:00';
  var warn = document.getElementById('sampSendWeekendWarn');
  var hint = document.getElementById('sampSendWhen');
  if (!dv) return;
  var dt = new Date(dv + 'T' + tv);
  if (hint) hint.textContent = isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'short' });
  // Same weekend honesty as the follow-up picker: flag it, never override.
  if (warn) {
    var wknd = dt.getDay() === 0 || dt.getDay() === 6;
    warn.innerHTML = wknd ? '<div style="font-size:11px;color:var(--coral);margin-top:2px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> That is a weekend. Fine if deliberate, worth a second look if not.</div>' : '';
  }
}

function _sampInsertVar(v) {
  var ta = document.getElementById('sampSendBody');
  if (!ta) return;
  var s = ta.selectionStart || 0, e = ta.selectionEnd || 0;
  ta.value = ta.value.slice(0, s) + v + ta.value.slice(e);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = s + v.length;
}

async function submitSampaignSchedule(campaignId) {
  var subject = document.getElementById('sampSendSubject')?.value?.trim();
  var body = document.getElementById('sampSendBody')?.value;
  var dv = document.getElementById('sampSendDate')?.value;
  var tv = document.getElementById('sampSendTime')?.value || '09:00';
  if (!subject) { showToast('Add a subject'); return; }
  if (!body || !body.trim()) { showToast('Add a message'); return; }
  if (!dv) { showToast('Pick a date'); return; }
  var when = new Date(dv + 'T' + tv);
  if (isNaN(when.getTime())) { showToast('That date/time is not valid'); return; }
  if (when.getTime() < Date.now()) { showToast('That time has already passed'); return; }

  var all = (window._sampaignContactsCache || {})[campaignId] || [];
  var _wave = parseInt(document.getElementById('sampSendLaunch')?.value || '1', 10) || 1;
  var sendable = (typeof _sampSendableFor === 'function') ? _sampSendableFor(all, _wave)
    : all.filter(function(x){ return x.email && x.status === 'not_contacted'; });
  if (!sendable.length) { showToast('No one is ready for this email yet'); return; }

  // Two steps on purpose, and the same two the AI path uses: write drafts,
  // then schedule them through the warm-up engine. This used to call
  // schedule_sampaign_send, which stamped ONE identical send time on every
  // recipient — the whole campaign leaving in the same minute, which is what
  // gets a mailbox suspended. Template sends now get the same spreading,
  // the same review step and the same daily cap as personalised ones.
  var launch = parseInt(document.getElementById('sampSendLaunch')?.value || '1', 10) || 1;
  try {
    var drafts = sendable.map(function(c){ return { contact_id: c.id, subject: subject, body: body }; });
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'save_sampaign_drafts', campaign_id: campaignId, drafts: drafts, generated_by: 'template', personalised: false, launch: launch }) });
    var d = await r.json();
 if (!d.ok) { showToast('' + (d.error || 'Could not prepare')); return; }
 showToast('Prepared ' + d.saved + ', now pick the schedule');
    window._sampLaunch = launch;
    loadSampaignSendQueue(campaignId);
    // Straight into the same dry-run preview, seeded with the time chosen
    // above, so the person sees the real multi-day plan before committing.
    planSampaignDrafts(campaignId, when.toISOString(), launch);
  } catch(e) { showToast('Error: ' + e.message); }
}

// A follow-up already has a date on the campaign, so choosing that wave sets
// the start date too rather than leaving two controls that can disagree.
function _sampComposerLaunchChanged(campaignId) {
  var n = parseInt(document.getElementById('sampSendLaunch')?.value || '1', 10) || 1;
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var hint = document.getElementById('sampSendLaunchHint');
  var dateEl = document.getElementById('sampSendDate');
  if (n === 1) { if (hint) hint.textContent = ''; return; }
  var dates = (c.followup_dates || []).map(function(x){ return String(x).slice(0,10); }).sort();
  var dt = dates[n - 2];
  if (dt && dateEl) { dateEl.value = dt; _sampSendWhenHint(); }
  if (hint) hint.textContent = dt ? 'Date taken from the campaign schedule' : 'No date set for this follow-up yet';
}

// Drafts written by an AI tool via the connector. Reviewed here BEFORE
// anything is scheduled: copy that goes straight from a model into a send
// queue means the first human to read it is the prospect.
// ── Email body editing: rich text, not raw markup ────────────────────────────
// Bodies have always been HTML — the assistant writes <b> and <br>, and so does
// anyone who formats a draft. But the editor was a <textarea> showing the
// ESCAPED source, so a rep opening a draft to fix a name saw a wall of tags and
// had to hand-write markup to add emphasis. Nothing about that is obvious, and
// getting it wrong was invisible until the mail landed.
//
// A contenteditable surface with a toolbar shows what the recipient will see.
// document.execCommand is deprecated but is the only thing every browser still
// implements for this, and the alternative is a selection-model editor, which
// is a large amount of code to own for six buttons.
var RT_ALLOWED = { B:1, STRONG:1, I:1, EM:1, U:1, A:1, BR:1, P:1, UL:1, OL:1, LI:1, DIV:1, SPAN:1 };

// ALLOWLIST, not a denylist. The recurring lesson in this codebase: naming what
// is forbidden always misses something. Anything not named here is UNWRAPPED
// rather than deleted, because the words matter and the tag does not — a paste
// from Word should lose its <o:p> wrappers, not the sentence inside them.
function sanitizeEmailHtml(html) {
  var box = document.createElement('div');
  box.innerHTML = String(html == null ? '' : html);
  box.querySelectorAll('script,style,meta,link,iframe,object,embed,img').forEach(function(n){ n.remove(); });
  for (var guard = 0; guard < 500; guard++) {
    var all = box.querySelectorAll('*'), bad = null;
    for (var i = 0; i < all.length; i++) { if (!RT_ALLOWED[all[i].tagName]) { bad = all[i]; break; } }
    if (!bad) break;
    var p = bad.parentNode;
    while (bad.firstChild) p.insertBefore(bad.firstChild, bad);
    p.removeChild(bad);
  }
  // Every attribute goes except a safe href. Inline styles from a paste are the
  // main way a draft ends up looking like a marketing blast in the inbox.
  box.querySelectorAll('*').forEach(function(n){
    Array.prototype.slice.call(n.attributes).forEach(function(a){
      var keep = n.tagName === 'A' && a.name === 'href' && /^(https?:|mailto:)/i.test(String(a.value).trim());
      if (!keep) n.removeAttribute(a.name);
    });
    if (n.tagName === 'A') { n.setAttribute('target','_blank'); n.setAttribute('rel','noopener noreferrer'); }
  });
  return box.innerHTML;
}
function rtIsEmpty(html) {
  var box = document.createElement('div');
  box.innerHTML = String(html || '').replace(/<\s*br\s*\/?\s*>/gi, ' ');
  return !(box.textContent || '').trim();
}
// Reads whichever editor is on the page. The textarea branch stays so that a
// surface not yet converted keeps working rather than silently saving blank.
function rtValue(id) {
  var el = document.getElementById('draftBody_' + id);
  if (!el) return '';
  return el.isContentEditable ? sanitizeEmailHtml(el.innerHTML) : String(el.value || '');
}
function _rtCmd(id, cmd) {
  var el = document.getElementById('draftBody_' + id);
  if (!el) return;
  el.focus();
  if (cmd === 'createLink') {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed) { showToast('Select the words to link first'); return; }
    var url = prompt('Link to:', 'https://');
    if (!url) return;
    document.execCommand('createLink', false, url);
    return;
  }
  document.execCommand(cmd, false, null);
}
// Paste as plain text, deliberately. Pasting from Word or a browser carries
// mso- styles, fixed pixel fonts and background colours that survive into the
// sent mail, look like a template, and cost deliverability.
function _rtPaste(e) {
  e.preventDefault();
  var t = ((e.clipboardData || window.clipboardData).getData('text/plain') || '');
  document.execCommand('insertText', false, t);
}
function _rtBtn(id, cmd, label, title, extra) {
  // onmousedown preventDefault is load-bearing: without it the click blurs the
  // editor, the selection collapses, and the command applies to nothing.
  return '<button type="button" title="'+title+'" onmousedown="event.preventDefault()" ' +
    'onclick="event.stopPropagation();_rtCmd(\''+esc(id)+'\',\''+cmd+'\')" ' +
    'style="min-width:26px;height:24px;padding:0 6px;border:1px solid var(--border2);background:var(--surface);color:var(--text2);' +
    'border-radius:var(--r-sm);cursor:pointer;font-family:var(--sans);font-size:11px;line-height:1;'+(extra||'')+'">'+label+'</button>';
}
function _rtEditor(id, html, fontSize) {
  var fs = fontSize || 12;
  return '<div style="display:flex;gap:3px;align-items:center;margin-bottom:4px;flex-wrap:wrap">' +
      _rtBtn(id, 'bold', 'B', 'Bold (Ctrl/Cmd+B)', 'font-weight:800') +
      _rtBtn(id, 'italic', 'I', 'Italic (Ctrl/Cmd+I)', 'font-style:italic') +
      _rtBtn(id, 'underline', 'U', 'Underline (Ctrl/Cmd+U)', 'text-decoration:underline') +
      _rtBtn(id, 'insertUnorderedList', '&#8226;&#8202;&#8212;', 'Bullet list', '') +
      _rtBtn(id, 'createLink', 'Link', 'Add a link to the selected words', '') +
      _rtBtn(id, 'removeFormat', 'Clear', 'Remove formatting', '') +
      '<span style="font-size:11px;color:var(--text3);margin-left:auto">This is how it will arrive</span>' +
    '</div>' +
    '<div id="draftBody_'+esc(id)+'" contenteditable="true" onpaste="_rtPaste(event)" onclick="event.stopPropagation()" ' +
      'style="width:100%;box-sizing:border-box;min-height:150px;padding:8px 10px;border-radius:var(--r-sm);border:1px solid var(--border2);' +
      'background:var(--bg);color:var(--text);font-family:var(--sans);font-size:'+fs+'px;line-height:1.6;overflow-wrap:anywhere;outline:none">' +
      sanitizeEmailHtml(html || '') +
    '</div>';
}

function _renderSampaignDrafts(campaignId, drafts) {
  if (!drafts.length) return '';
  var byTool = {};
  drafts.forEach(function(d){ var k = d.generated_by || 'ai'; byTool[k] = (byTool[k]||0)+1; });
  // One shared body sent to everyone is not personalisation, and calling it
  // that in the review header would be a small lie that compounds.
  var anyPersonalised = drafts.some(function(d){ return d.personalised; });
  var label = anyPersonalised ? 'personalised draft' : 'draft';
  return '<div style="border:1px solid rgba(var(--c-accent-rgb),0.3);border-radius:var(--r-md);padding:11px;margin-bottom:10px;background:rgba(var(--c-accent-rgb),0.05)">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;flex-wrap:wrap">' +
      '<span style="font-size:11px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3z"/></svg> '+drafts.length+' '+label+(drafts.length!==1?'s':'')+' to review</span>' +
      '<span style="font-size:11px;color:var(--text3)">'+Object.keys(byTool).map(function(k){ return esc(k)+' · '+byTool[k]; }).join(', ')+'</span>' +
      '<span onclick="cancelSampaignSends(\''+esc(campaignId)+'\',null,\'Discard all '+drafts.length+' draft'+(drafts.length!==1?'s':'')+'? The copy is deleted and cannot be recovered.\')" style="margin-left:auto;font-size:11px;color:var(--coral);cursor:pointer">Discard all</span>' +
      '<span onclick="planSampaignDrafts(\''+esc(campaignId)+'\',null,window._sampLaunch)" style="font-size:11px;font-weight:600;color:var(--gold);cursor:pointer">Preview send plan →</span>' +
    '</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:7px">Nothing sends until you schedule it. Click a draft to read and edit it.</div>' +
    drafts.slice(0, 40).map(function(x) {
      return '<div style="border-top:1px solid var(--border);padding:6px 0">' +
        '<div onclick="_toggleDraft(\''+esc(x.id)+'\')" style="cursor:pointer;display:flex;gap:7px;align-items:baseline">' +
          '<span style="font-size:11px;font-weight:600;color:var(--text);flex-shrink:0">'+esc(x.name||x.email||'—')+'</span>' +
          '<span style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.subject||'')+'</span>' +
          (x.edited_by_human ? '<span style="font-size:11px;color:var(--green);flex-shrink:0;margin-left:auto">edited</span>' : '') +
        '</div>' +
        '<div id="draft_'+esc(x.id)+'" style="display:none;margin-top:6px">' +
          '<input id="draftSubj_'+esc(x.id)+'" value="'+esc(x.subject||'')+'" style="width:100%;box-sizing:border-box;padding:6px 8px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:11px;margin-bottom:4px"/>' +
          _rtEditor(x.id, x.body || '', 11) +
          '<div style="display:flex;gap:6px;margin-top:4px">' +
            '<button onclick="saveSampaignDraftEdit(\''+esc(campaignId)+'\',\''+esc(x.id)+'\')" style="font-size:11px;font-weight:600;padding:5px 10px;border-radius:var(--r-sm);background:var(--green);border:none;color:#fff;cursor:pointer;font-family:var(--sans)">Save edit</button>' +
            '<span onclick="cancelSampaignSends(\''+esc(campaignId)+'\',\''+esc(x.id)+'\')" style="font-size:11px;color:var(--coral);cursor:pointer;align-self:center">Discard</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}
function _toggleDraft(id) {
  var el = document.getElementById('draft_'+id);
  if (!el) return;
  var open = el.style.display === 'none';
  el.style.display = open ? 'block' : 'none';
  // The chevron is the only persistent signal of which row is open once the
  // body has scrolled, so it turns rather than staying static.
  var chev = document.getElementById('chev_'+id);
  if (chev) chev.style.transform = open ? 'rotate(180deg)' : '';
  var row = chev && chev.parentElement;
  if (row && row.classList) row.classList.toggle('open', open);
}
// Edits go through update_sampaign_scheduled_send, NOT save_sampaign_drafts.
// The latter writes status='draft' with a null send_at, so using it to fix a
// typo in a queued email would silently un-schedule it — the send would just
// stop happening, with no symptom until someone noticed the mail never
// arrived. This updates the text in place and leaves status and send time
// exactly as they were.
async function saveSampaignDraftEdit(campaignId, sendId) {
  var subject = document.getElementById('draftSubj_'+sendId)?.value?.trim();
  // Sanitised on the way out, so what is stored is what the editor allows —
  // never whatever a paste dragged in.
  var body = rtValue(sendId);
  if (!subject || rtIsEmpty(body)) { showToast('Subject and body are both needed'); return; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'update_sampaign_scheduled_send', send_id: sendId, subject: subject, body: body }) });
    var d = await r.json();
 if (!d.ok) { showToast('' + (d.error||'Could not save')); return; }
 showToast('' + (d.note || 'Updated'));
    loadSampaignSendQueue(campaignId);
  } catch(e) { showToast('Error: '+e.message); }
}

// dry_run first, always. Committing a multi-day send plan without showing it
// is exactly the surprise this feature exists to prevent.
async function planSampaignDrafts(campaignId, startAt, launch) {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'schedule_sampaign_drafts', campaign_id: campaignId, start_at: startAt || null, launch: launch || window._sampLaunch || 1, dry_run: true }) });
    var d = await r.json();
 if (!d.ok) { showToast('' + (d.error||'Could not plan')); return; }
    var days = Object.keys(d.per_day||{}).sort();
    var lines = days.map(function(k){ return k + ': ' + d.per_day[k]; }).join('\n');
    var first = d.first_send ? new Date(d.first_send).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
    var last  = d.last_send  ? new Date(d.last_send).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
    var msg = d.scheduled + ' emails over ' + d.days + ' day' + (d.days!==1?'s':'') + '\n\n' +
      lines + '\n\n' +
      'First: ' + first + '\nLast:  ' + last + '\n\n' +
      // Why this many today, in the rep's words rather than policy numbers.
      'Today you can send ' + (d.today_limit || d.policy.daily_cap) + ' (' + (d.ramp_reason || 'current limit') + ').\n' +
      (d.overrode_ramp ? 'You asked for more than the suggested number, so this overrides it.\n' : '') +
      'Sending window ' + d.policy.window_start_hour + ':00-' + d.policy.window_end_hour + ':00' + (d.policy.skip_weekends ? ', weekdays only' : '') + '.\n\n' +
      'First emails and follow-ups share the same daily number. Spreading them out protects the mailbox, sending a whole campaign at once is what gets inboxes blocked.\n\nSchedule these now?';
    if (!confirm(msg)) return;
    var r2 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'schedule_sampaign_drafts', campaign_id: campaignId, start_at: startAt || null, launch: launch || window._sampLaunch || 1 }) });
    var d2 = await r2.json();
 if (!d2.ok) { showToast('' + (d2.error||'Could not schedule')); return; }
 showToast('Scheduled ' + d2.scheduled + ' over ' + d2.days + ' day' + (d2.days!==1?'s':''));
    loadSampaignSendQueue(campaignId);
  } catch(e) { showToast('Error: '+e.message); }
}

// Which wave is being viewed. Null means "the first one that has anything",
// resolved on load, so opening Launches lands somewhere useful rather than on
// an empty wave 1 after the initial send has gone out.
window._sampLaunch = null;
function setSampLaunch(campaignId, n) {
  window._sampLaunch = n;
  loadSampaignSendQueue(campaignId);
}

// Sub-tab strip: one per wave the campaign can have. A wave with nothing in
// it is still shown but dimmed, because "follow-up 2 exists and is empty" is
// information — it is the prompt to go and write it.
function _renderLaunchTabs(campaignId, byLaunch, maxLaunch) {
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var dates = (c.followup_dates || []).map(function(d){ return String(d).slice(0,10); }).sort();
  var out = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">';
  for (var n = 1; n <= maxLaunch; n++) {
    var rows = byLaunch[n] || [];
    var on = window._sampLaunch === n;
    var drafts = rows.filter(function(x){ return x.status === 'draft'; }).length;
    // WHAT IS SCHEDULED BEATS WHAT WAS CONFIGURED.
    // This read only campaign.followup_dates, so a wave with 23 emails queued
    // for tomorrow still displayed "no date set" — because the campaign row had
    // no fixed date and the wave had been scheduled by relative days instead.
    // The label was answering "was a date typed into the campaign" while the
    // user was asking "when does this go out". Real send times are the truth;
    // the configured date is the fallback for a wave not yet queued.
    var queuedAt = rows
      .filter(function(x){ return x.status === 'pending' && x.send_at; })
      .map(function(x){ return x.send_at; })
      .sort();
    var when;
    if (n === 1 && !queuedAt.length) when = '';
    else if (queuedAt.length) {
      var first = new Date(queuedAt[0]);
      var last = new Date(queuedAt[queuedAt.length - 1]);
      var fmt = function(dt){ return dt.toLocaleDateString('en-GB',{day:'numeric',month:'short'}); };
      // A wave spread across days is described as a range, because "8 Sept"
      // for something running 8 to 10 Sept is a quiet lie.
      when = fmt(first) === fmt(last) ? fmt(first) : fmt(first) + '–' + fmt(last);
    }
    else if (n > 1 && dates[n-2]) when = new Date(dates[n-2]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
    else if (n > 1 && rows.some(function(x){ return x.status === 'draft'; })) when = 'not scheduled yet';
    else when = n === 1 ? '' : 'no date set';
    out += '<span onclick="setSampLaunch(\''+esc(campaignId)+'\','+n+')" style="cursor:pointer;font-size:11px;padding:6px 11px;border-radius:var(--r-sm);' +
      'border:1px solid '+(on?'var(--gold)':'var(--border2)')+';background:'+(on?'rgba(var(--c-accent-rgb),0.09)':'transparent')+';' +
      'color:'+(rows.length?'var(--text)':'var(--text3)')+'">' +
      '<span style="font-weight:'+(on?'700':'600')+'">'+(n===1?'Initial send':'Follow-up '+(n-1))+'</span>' +
      (when ? '<span style="color:var(--text3)"> · '+esc(when)+'</span>' : '') +
      (drafts ? '<span style="font-size:11px;font-weight:700;background:rgba(var(--c-accent-rgb),0.16);color:var(--gold);border-radius:var(--r-sm);padding:1px 5px;margin-left:5px">'+drafts+' to review</span>'
              : (rows.length ? '<span style="color:var(--text3);font-size:11px"> · '+rows.length+'</span>' : '<span style="color:var(--text3);font-size:11px"> · empty</span>')) +
    '</span>';
  }
  out += _g23LiTabs(campaignId);
  out += '</div>';
  return out;
}

async function loadSampaignSendQueue(campaignId) {
  var box = document.getElementById('sampSendQueue');
  if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'list_sampaign_scheduled_sends', campaign_id: campaignId, name_hint: (typeof _sigNameHint === 'function' ? _sigNameHint() : '') }) });
    var d = await r.json();
    var all = (d.ok && d.sends) ? d.sends : [];
    window._g34Sends = window._g34Sends || {}; window._g34Sends[campaignId] = all;

    // Group by wave. How many waves exist is a property of the CAMPAIGN
    // (initial send + one per follow-up date), not of what happens to be in
    // the table — otherwise an unwritten follow-up would be invisible and
    // there would be nothing to click to go and write it.
    var camp = (window._sampaignCampaignsCache || {})[campaignId] || {};
    var maxLaunch = Math.max(1, ((camp.followup_dates || []).length + 1),
                             all.reduce(function(m,x){ return Math.max(m, x.launch||1); }, 1));
    var byLaunch = {};
    all.forEach(function(x){ var n = x.launch || 1; (byLaunch[n] = byLaunch[n] || []).push(x); });

    // Land on the wave that needs attention: first with drafts, else first
    // with anything, else wave 1.
    if (window._sampLaunch == null) {
      var withDrafts = null, withAny = null;
      for (var n = 1; n <= maxLaunch; n++) {
        var rows = byLaunch[n] || [];
        if (!withDrafts && rows.some(function(x){ return x.status === 'draft'; })) withDrafts = n;
        if (!withAny && rows.length) withAny = n;
      }
      window._sampLaunch = withDrafts || withAny || 1;
    }

    // Badge counts drafts across ALL waves — it is asking "does anything need
    // reviewing", which is not a per-wave question.
    window._sampDraftCount = window._sampDraftCount || {};
    window._sampDraftCount[campaignId] = all.filter(function(x){ return x.status === 'draft'; }).length;
    try { _renderSampTabs(campaignId); } catch(e) {}

    var tabsHtml = _renderLaunchTabs(campaignId, byLaunch, maxLaunch);
    if (typeof window._sampLaunch === 'string' && /^li_/.test(window._sampLaunch)) {
      box.innerHTML = tabsHtml + '<div id="g23Li"></div>';
      g23RenderLi(campaignId);
      return;
    }
    var mine = byLaunch[window._sampLaunch] || [];

    if (!mine.length) {
      box.innerHTML = tabsHtml +
        '<div style="text-align:center;padding:24px 16px;border:1px dashed var(--border2);border-radius:var(--r-md)">' +
          '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Nothing written for this wave yet</div>' +
          '<div style="font-size:11px;color:var(--text3);line-height:1.55">Use Schedule below to write it yourself, or ask Claude to draft one email per person for '+
            (window._sampLaunch === 1 ? 'the initial send' : 'follow-up ' + (window._sampLaunch - 1)) + '.</div>' +
        '</div>';
      return;
    }

    d.sends = mine;
    // Drafts are shown separately and above: they need a decision, the queue
    // is just a record of one already made.
    var draftRows = d.sends.filter(function(x){ return x.status === 'draft'; });
    d.sends = d.sends.filter(function(x){ return x.status !== 'draft'; });
    var draftHtml = _renderSampaignDrafts(campaignId, draftRows);
    if (!d.sends.length) { box.innerHTML = tabsHtml + draftHtml; return; }
    var META = {
      pending:   { label:'Queued',    color:'var(--gold)' },
      sent:      { label:'Sent',      color:'var(--green)' },
      failed:    { label:'Not sent',  color:'var(--coral)' },
      cancelled: { label:'Cancelled', color:'var(--text3)' },
      blocked_no_email: { label:'No email', color:'var(--text3)' }
    };
    // Summary counts the WAVE being viewed, not the campaign, so the numbers
    // agree with the rows underneath them.
    var s = { pending:0, sent:0, failed:0, cancelled:0 };
    d.sends.forEach(function(x){ s[x.status] = (s[x.status]||0) + 1; });
    box.innerHTML = tabsHtml + draftHtml +
      // Hover state makes the rows read as clickable before anyone clicks.
      '<style>.samp-send-row:hover{background:var(--surface)}.samp-send-row.open{background:var(--surface)}</style>' +
      '<div style="border-top:1px solid var(--border);padding-top:11px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">' +
        '<span style="font-size:11px;font-weight:700;color:var(--text)">Queue</span>' +
        Object.keys(META).filter(function(k){ return s[k]; }).map(function(k){
          return '<span style="font-size:11px;font-weight:600;color:'+META[k].color+'">'+s[k]+' '+META[k].label.toLowerCase()+'</span>';
        }).join('<span style="color:var(--text3)">·</span>') +
        (s.failed && d.is_owner ? '<button type="button" class="g-btn sp-sm sp-gold" onclick="sampRetryFailed(\''+esc(campaignId)+'\','+(window._sampLaunch||1)+')" style="margin-left:auto">Send again</button>' : '') +
        (s.pending && d.is_owner ? '<button type="button" class="g-btn sp-sm" onclick="g34RewriteAll(\''+esc(campaignId)+'\')" style="'+(s.failed ? '' : 'margin-left:auto;')+'">Rewrite queued with SAM</button>' : '') +
        (s.pending ? '<span onclick="cancelSampaignSends(\''+esc(campaignId)+'\',null)" style="'+(s.failed || d.is_owner ? '' : 'margin-left:auto;')+'font-size:11px;color:var(--coral);cursor:pointer">Cancel all queued</span>' : '') +
      '</div>' +
      // Grouped by send day. A flat list of 48 rows spanning four dates makes
      // the reader parse every timestamp to work out where one day ends; a
      // date header answers "what goes out on Monday" at a glance, which is
      // the question someone reviewing a queue actually has.
      (function() {
        var rows = d.sends.slice(0, 120);
        var groups = [], lastKey = null;
        rows.forEach(function(x) {
          // The null check has to come first: new Date(null) is the epoch,
          // not an invalid date, so an undated row would silently group under
          // "Thu 1 Jan 1970" instead of being called out as having no date.
          var dt = x.send_at ? new Date(x.send_at) : null;
          var key = (!dt || isNaN(dt.getTime())) ? 'nodate' : dt.toISOString().slice(0, 10);
          if (key !== lastKey) { groups.push({ key: key, date: dt, items: [] }); lastKey = key; }
          groups[groups.length - 1].items.push(x);
        });
        return groups.map(function(g) {
          var head = g.key === 'nodate' ? 'No date' :
            g.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          return '<div style="display:flex;align-items:baseline;justify-content:space-between;margin:14px 0 4px">' +
              '<span style="font-size:11px;font-weight:700;color:var(--text2)">'+esc(head)+'</span>' +
              '<span style="font-size:11px;color:var(--text3)">'+g.items.length+' email'+(g.items.length!==1?'s':'')+'</span>' +
            '</div>' +
            g.items.map(function(x) {
              var mm = META[x.status] || META.pending;
              var when = new Date(x.send_at);
              // A manager can READ a report's queued email but not change it —
              // same read/write split as everywhere else in SAMpaign. This
              // previously required ownership even to open the row, so a
              // manager saw 48 unopenable lines with no indication why.
              var editable = (x.status === 'pending') && d.is_owner;
              var readable = true;
              var who = x.name || x.email || '—';
              var initial = String(who).trim().charAt(0).toUpperCase() || '?';
              return '<div class="samp-send-row" onclick="_toggleDraft(\''+esc(x.id)+'\')" ' +
                  'style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--r-md);cursor:pointer;transition:background .12s">' +
                  '<span style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:var(--surface);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text3)">'+esc(initial)+'</span>' +
                  '<span style="min-width:0;flex:1">' +
                    '<span style="display:block;font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(who)+'</span>' +
                    '<span style="display:block;font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(x.email||'')+'</span>' +
                  '</span>' +
                  '<span style="font-size:11px;color:var(--text3);white-space:nowrap;flex-shrink:0">'+(isNaN(when.getTime())?'':when.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}))+'</span>' +
                  '<span style="font-size:11px;font-weight:700;color:'+mm.color+';background:rgba(128,128,128,0.10);border-radius:var(--r-sm);padding:2px 7px;white-space:nowrap;flex-shrink:0">'+mm.label+'</span>' +
                  (editable ? '<span onclick="event.stopPropagation();cancelSampaignSends(\''+esc(campaignId)+'\',\''+esc(x.id)+'\')" style="cursor:pointer;color:var(--text3);font-size:13px;flex-shrink:0;padding:0 2px" title="Cancel this one"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>' : '') +
                  '<span id="chev_'+esc(x.id)+'" style="font-size:11px;color:var(--text3);flex-shrink:0;transition:transform .15s">▾</span>' +
                '</div>' +
                '<div id="draft_'+esc(x.id)+'" style="display:none;padding:2px 10px 12px 46px">' +
                  (editable
                    ? '<input id="draftSubj_'+esc(x.id)+'" value="'+esc(x.subject||'')+'" style="width:100%;box-sizing:border-box;padding:7px 9px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px;font-weight:600;margin-bottom:5px"/>' +
                      _rtEditor(x.id, x.body || '', 12) +
                      '<div style="display:flex;gap:9px;align-items:center;margin-top:6px">' +
                        '<button onclick="event.stopPropagation();saveSampaignDraftEdit(\''+esc(campaignId)+'\',\''+esc(x.id)+'\')" style="font-size:11px;font-weight:600;padding:6px 13px;border-radius:var(--r-sm);background:var(--green);border:none;color:#fff;cursor:pointer;font-family:var(--sans)">Save edit</button>' +
                        '<span style="font-size:11px;color:var(--text3)">Send time stays the same</span>' +
                      '</div>'
                    // Read-only for sent, cancelled, and for anyone who is not
                    // the owner. An editable box on delivered mail would let
                    // the UI show corrected text the recipient never received.
                    : '<div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:5px">'+esc(x.subject||'')+'</div>' +
                      // Rendered, not escaped. A sent email shown as raw markup
                      // is unreadable, and worse, it looks like what the
                      // recipient got — which for one week it actually was.
                      '<div style="font-size:12px;color:var(--text2);line-height:1.6;background:var(--surface);border-radius:var(--r-sm);padding:10px 12px;border:1px solid var(--border);overflow-wrap:anywhere">'+sanitizeEmailHtml(x.body||'')+'</div>' +
                      '<div style="font-size:11px;color:var(--text3);margin-top:5px">'+
                        (x.status==='sent' ? 'Already sent, read only'
                         : x.status==='cancelled' ? 'Cancelled, never sent'
                         : !d.is_owner ? 'Read only, this is '+esc((camp.owner_email||'the owner').split('@')[0])+'’s campaign'
                         : 'Read only')+'</div>') +
                '</div>' +
                (x.error ? '<div style="font-size:11px;color:var(--coral);padding:0 10px 8px 46px" title="'+esc(x.error)+'">'+esc(x.status === 'failed' ? _spFailText(x.error) : x.error)+'</div>' : '');
            }).join('');
        }).join('');
      })() +
    '</div>';
  } catch(e) { box.innerHTML = ''; }
}

async function cancelSampaignSends(campaignId, sendId, confirmMsg) {
  var payload = sendId
    ? { action:'cancel_sampaign_scheduled_send', send_ids:[sendId] }
    : { action:'cancel_sampaign_scheduled_send', campaign_id: campaignId, all_pending: true };
  if (!sendId && !confirm(confirmMsg || 'Cancel every queued email for this SAMpaign?')) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify(payload) });
    var d = await r.json();
 if (!d.ok) { showToast('' + (d.error||'Could not cancel')); return; }
    // Drafts are deleted, queued sends are cancelled — report whichever
    // actually happened rather than always saying "cancelled 0", which is
    // what the old version did for drafts.
    var parts = [];
    if (d.discarded) parts.push(d.discarded + ' draft' + (d.discarded!==1?'s':'') + ' discarded');
    if (d.cancelled) parts.push(d.cancelled + ' queued cancelled');
 showToast(parts.length ? '' + parts.join(', ') : 'Nothing to remove');
    loadSampaignSendQueue(campaignId);
  } catch(e) { showToast('Error: ' + e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECTIVE SAM — person intelligence from whatever you happen to know.
//
// Backed by detective_sam_lookup, which searches the org's OWN data first
// (stakeholders, SAMpaign contacts) before spending a provider credit. An
// address that came from real correspondence beats a pattern-inferred guess
// and costs nothing, so internal always wins and every field is labelled
// with where it came from.
// ═══════════════════════════════════════════════════════════════════════════
// She, not he — the reference character is female. Long wavy hair, lashes,
// lip, earring. The gold S is her TIE, drawn large and high enough in the
// collar V to sit fully inside the clip circle: the first version put it at
// the very bottom edge, where the circular mask ate it.
// viewBox is cropped around the circle rather than rescaled, so the geometry
// is identical to what was reviewed.
function _detectiveSamAvatar(size) {
  var s = size || 44, cid = 'dsC' + s;
  return '<svg width="'+s+'" height="'+s+'" viewBox="190 10 300 300" style="flex-shrink:0;display:block">' +
    '<defs><clipPath id="'+cid+'"><circle cx="340" cy="160" r="150"/></clipPath>' +
      '<linearGradient id="h'+cid+'" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#3B2A1E"/><stop offset="38%" stop-color="#6B4A2E"/>' +
        '<stop offset="72%" stop-color="#A87C4C"/><stop offset="100%" stop-color="#CDA470"/>' +
      '</linearGradient></defs>' +
    '<circle cx="340" cy="160" r="150" fill="#F2E9DC"/>' +
    '<g clip-path="url(#'+cid+')">' +
      '<path d="M246 148 Q246 50 340 46 Q434 50 434 148 L434 206 Q434 220 414 222 L266 222 Q246 220 246 206 Z" fill="#2E2016" opacity="0.55"/>' +
      '<path d="M252 148 Q252 56 340 52 Q428 56 428 148 L428 200 Q428 214 410 216 L270 216 Q252 214 252 200 Z" fill="url(#h'+cid+')"/>' +
      '<path d="M252 210 Q252 120 300 100 L318 108 Q272 132 268 212 Z" fill="#2E2016" opacity="0.28"/>' +
      '<path d="M270 104 Q306 66 372 72 Q412 78 420 104 Q384 84 336 92 Q296 99 278 122 Z" fill="url(#h'+cid+')"/>' +
      '<path d="M262 300 Q268 236 300 214 L340 246 L380 214 Q412 236 418 300 Z" fill="#7B4E2C"/>' +
      '<path d="M300 214 L340 246 L380 214 L380 300 L300 300 Z" fill="#FBF8F3"/>' +
      '<path d="M304 212 L340 244 L322 300 L300 300 Z" fill="#E7E1D6"/>' +
      '<path d="M376 212 L340 244 L358 300 L380 300 Z" fill="#E7E1D6"/>' +
      '<path d="M316 246 L364 246 L352 300 L328 300 Z" fill="#3B2A1B"/>' +
      '<path d="M320 172 L360 172 L360 206 L320 206 Z" fill="#E8BE9E"/>' +
      '<ellipse cx="340" cy="130" rx="51" ry="57" fill="#F2CDAC"/>' +
      '<circle cx="316" cy="128" r="21" fill="#26211C"/>' +
      '<circle cx="364" cy="128" r="21" fill="#26211C"/>' +
      '<path d="M303 116 Q311 109 322 114 Q311 120 306 128 Z" fill="#FFFFFF" opacity="0.5"/>' +
      '<path d="M351 116 Q359 109 370 114 Q359 120 354 128 Z" fill="#FFFFFF" opacity="0.5"/>' +
      '<circle cx="325" cy="137" r="3.5" fill="#FFFFFF" opacity="0.28"/>' +
      '<circle cx="373" cy="137" r="3.5" fill="#FFFFFF" opacity="0.28"/>' +
      '<circle cx="316" cy="128" r="21" fill="none" stroke="#0F0D0B" stroke-width="2.5"/>' +
      '<circle cx="364" cy="128" r="21" fill="none" stroke="#0F0D0B" stroke-width="2.5"/>' +
      '<path d="M337 128 L343 128" stroke="#26211C" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M295 126 L278 119" stroke="#26211C" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M385 126 L402 119" stroke="#26211C" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M328 164 Q340 157 352 164 Q340 177 328 164 Z" fill="#C05F5C"/>' +
      '<circle cx="293" cy="150" r="6" fill="#E8B84B"/>' +
      '<ellipse cx="340" cy="72" rx="94" ry="17" fill="#7A4A2A"/>' +
      '<path d="M278 74 Q282 20 340 16 Q398 20 402 74 Z" fill="#8A5A38"/>' +
      '<path d="M278 68 Q340 84 402 68 L402 76 Q340 92 278 76 Z" fill="#5E3620"/>' +
      '<path d="M354 168 Q396 176 406 200" stroke="#4A2E1C" stroke-width="8" fill="none" stroke-linecap="round"/>' +
      '<path d="M396 200 Q396 232 420 232 Q444 232 444 200 Z" fill="#5E3A22"/>' +
      '<ellipse cx="420" cy="200" rx="24" ry="7" fill="#3A2314"/>' +
      '<path d="M416 180 Q404 164 420 150 Q436 136 424 120" stroke="#D6CDC1" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>' +
      '<text x="340" y="300" text-anchor="middle" font-family="Georgia,serif" font-size="66" font-weight="700" fill="#C8961E">S</text>' +
      '<text x="340" y="297" text-anchor="middle" font-family="Georgia,serif" font-size="66" font-weight="700" fill="#F0C660">S</text>' +
    '</g>' +
    '<circle cx="340" cy="160" r="150" fill="none" stroke="#C8961E" stroke-width="6"/>' +
  '</svg>';
}

// The branding chip on its own. _samoraIntelLabel(text) interpolates its
// argument, so calling it with none rendered the literal string "undefined"
// next to the logo — that was the stray word in the header.
function _samoraIntelChip() {
  return '<span style="display:inline-flex;align-items:center;gap:6px">' +
    '<img src="icons/icon-48.png" alt="Samora" style="width:15px;height:15px;border-radius:50%;flex-shrink:0"/>' +
    '<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;background:rgba(var(--c-accent-rgb),0.12);padding:2px 6px;border-radius:var(--r-sm);white-space:nowrap">Samora Intelligence</span>' +
  '</span>';
}

function _magnifierIcon(sz, col) {
  var s = sz || 14;
  return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="'+(col||'currentColor')+'" stroke-width="2.4" stroke-linecap="round" style="flex-shrink:0"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 L21 21"/></svg>';
}

function detectiveSamCardHtml() {
  // Classes, not inline styles, because this needs a media query. The chip
  // carries white-space:nowrap, so on a narrow screen it could not shrink and
  // overflowed its flex parent straight underneath the Investigate button.
  // Below 560px the card stacks and the button goes full width.
  return '<div class="dsam-card">' +
    '<div class="dsam-row">' +
      _detectiveSamAvatar(46) +
      '<div class="dsam-main">' +
        '<div class="dsam-title">' +
          '<span style="font-size:14px;font-weight:700;color:var(--text)">Detective SAM</span>' +
          _samoraIntelChip() +
        '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">Find anyone: LinkedIn, emails, phone numbers, current and past employers.</div>' +
      '</div>' +
      '<button onclick="openDetectiveSam()" class="dsam-btn">' +
        _magnifierIcon(14, '#2A1F0C') + 'Investigate</button>' +
    '</div>' +
  '</div>';
}

window._dsResult = null;

function openDetectiveSam() {
  document.getElementById('detective-sam-modal')?.remove();
  var m = document.createElement('div');
  m.id = 'detective-sam-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);z-index:100000;display:flex;align-items:flex-end;justify-content:center';
  m.innerHTML = '<div style="background:var(--bg);border-radius:3px 18px 0 0;width:100%;max-width:640px;max-height:92vh;overflow-y:auto;padding:20px" onclick="event.stopPropagation()">' +
    '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">' +
      _detectiveSamAvatar(52) +
      '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span style="font-size:16px;font-weight:700;color:var(--text)">Detective SAM</span>'+_samoraIntelChip()+'</div>' +
        '<div style="font-size:13px;color:var(--text2);margin-top:3px">Who do you wish to get intelligence on?</div>' +
      '</div>' +
      '<button onclick="document.getElementById(\'detective-sam-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3);padding:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:7px">Fill in whatever you know. More detail means a better match, a company domain helps most.</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
      '<input id="dsName" placeholder="Full name" style="padding:8px 10px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<input id="dsCompany" placeholder="Company" style="padding:8px 10px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<input id="dsDomain" placeholder="Company domain (e.g. acme.com)" style="padding:8px 10px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<input id="dsEmail" placeholder="Email (if known)" style="padding:8px 10px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<input id="dsPhone" placeholder="Phone (if known)" style="padding:8px 10px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<input id="dsLinkedin" placeholder="LinkedIn URL (if known)" style="padding:8px 10px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
    '</div>' +
    '<button id="dsSearchBtn" onclick="runDetectiveSam()" style="width:100%;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px;border-radius:var(--r-md);background:var(--c-accent-solid);border:none;color:#2A1F0C;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans)">' +
      _magnifierIcon(17, '#2A1F0C') + 'Search</button>' +
    '<div id="dsResults" style="margin-top:14px"></div>' +
  '</div>';
  m.addEventListener('click', function(){ m.remove(); });
  document.body.appendChild(m);
  setTimeout(function(){ document.getElementById('dsName')?.focus(); }, 50);
}

var _DS_SRC_META = {
  internal: { label: 'Your own data', color: 'var(--green)' },
  lusha:    { label: 'Lusha',        color: 'var(--blue)' },
  apollo:   { label: 'Apollo',       color: 'var(--blue)' },
  zoominfo: { label: 'ZoomInfo',     color: 'var(--blue)' },
  hunter:   { label: 'Hunter',       color: 'var(--amber)' }
};
function _dsSrcChip(src, note) {
  var m = _DS_SRC_META[src] || { label: src, color: 'var(--text3)' };
  return '<span style="font-size:11px;font-weight:600;color:'+m.color+';background:rgba(128,128,128,0.09);border-radius:var(--r-sm);padding:2px 6px;white-space:nowrap" title="'+esc(note||'')+'">'+esc(m.label)+(note?' · '+esc(note):'')+'</span>';
}

async function runDetectiveSam() {
  var btn = document.getElementById('dsSearchBtn');
  var out = document.getElementById('dsResults');
  var q = {
    name: document.getElementById('dsName')?.value?.trim() || '',
    company: document.getElementById('dsCompany')?.value?.trim() || '',
    domain: document.getElementById('dsDomain')?.value?.trim() || '',
    email: document.getElementById('dsEmail')?.value?.trim() || '',
    phone: document.getElementById('dsPhone')?.value?.trim() || '',
    linkedin_url: document.getElementById('dsLinkedin')?.value?.trim() || ''
  };
  if (!q.name && !q.email && !q.phone && !q.linkedin_url) { showToast('Give a name, email, phone or LinkedIn to search on'); return; }
  if (btn) { btn.disabled = true; btn.style.opacity = '0.65'; btn.innerHTML = _magnifierIcon(17,'#2A1F0C') + 'Investigating…'; }
  if (out) out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:10px 0">Checking your own records first, then the enrichment providers…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify(Object.assign({ action:'detective_sam_lookup' }, q)) });
    var d = await r.json();
    if (!d.ok) { out.innerHTML = '<div style="font-size:12px;color:var(--coral)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> '+esc(d.error||'Search failed')+'</div>'; return; }
    window._dsResult = d;
    out.innerHTML = _renderDetectiveSamResult(d);
  } catch(e) {
    if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: '+esc(e.message)+'</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = _magnifierIcon(17,'#2A1F0C') + 'Search'; }
  }
}

function _renderDetectiveSamResult(d) {
  var p = d.profile || {};
  var fs = d.field_sources || {};
  var html = '';

  if (!d.found) {
    html += '<div style="background:var(--surface2);border-radius:var(--r-md);padding:14px;font-size:12px;color:var(--text2)">Nothing found on that person yet.</div>';
  } else {
    html += '<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r-md);padding:14px">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">' +
        '<div style="min-width:0">' +
          '<div style="font-size:16px;font-weight:700;color:var(--text)">'+esc(p.name||'Unknown')+'</div>' +
          (p.title ? '<div style="font-size:12px;color:var(--text2);margin-top:2px">'+esc(p.title)+(p.current_org?' · '+esc(p.current_org):'')+'</div>' : (p.current_org?'<div style="font-size:12px;color:var(--text2);margin-top:2px">'+esc(p.current_org)+'</div>':'')) +
          (p.location ? '<div style="font-size:11px;color:var(--text3);margin-top:2px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 21V3.5M5.5 4.5h12l-2.5 4 2.5 4h-12"/></svg> '+esc(p.location)+'</div>' : '') +
        '</div>' +
        (p.linkedin_url ? '<a href="'+esc(p.linkedin_url)+'" target="_blank" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#fff;background:#0A66C2;border-radius:var(--r-sm);padding:6px 10px;text-decoration:none;flex-shrink:0">in LinkedIn</a>' : '') +
      '</div>';

    if ((d.emails||[]).length) {
      html += '<div style="margin-top:12px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Email'+(d.emails.length>1?'s':'')+' ('+d.emails.length+')</div>' +
        d.emails.map(function(e){
          return '<div style="display:flex;align-items:center;gap:7px;padding:4px 0;flex-wrap:wrap">' +
            '<span style="font-size:12px;color:var(--text);font-weight:600">'+esc(e.value)+'</span>' + _dsSrcChip(e.source, e.note) +
 '<span onclick="navigator.clipboard?.writeText(\''+esc(e.value)+'\');showToast(\'Copied\')" style="cursor:pointer;font-size:10px;color:var(--text3);margin-left:auto">copy</span>' +
          '</div>';
        }).join('') + '</div>';
    }
    if ((d.phones||[]).length) {
      html += '<div style="margin-top:12px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5H4.5A1.5 1.5 0 003 5c0 8.8 7.2 16 16 16a1.5 1.5 0 001.5-1.5V17l-4.5-2-2.5 2.5A15 15 0 018.5 11L11 8.5z"/></svg> Phone'+(d.phones.length>1?'s':'')+' ('+d.phones.length+')</div>' +
        d.phones.map(function(e){
          return '<div style="display:flex;align-items:center;gap:7px;padding:4px 0;flex-wrap:wrap">' +
            '<span style="font-size:12px;color:var(--text);font-weight:600">'+esc(e.value)+'</span>' + _dsSrcChip(e.source, e.note) +
 '<span onclick="navigator.clipboard?.writeText(\''+esc(e.value)+'\');showToast(\'Copied\')" style="cursor:pointer;font-size:10px;color:var(--text3);margin-left:auto">copy</span>' +
          '</div>';
        }).join('') + '</div>';
    }
    if ((p.previous_orgs||[]).length) {
      html += '<div style="margin-top:12px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20.5V5.5L13 3v17.5M13 9.5h7v11M4 20.5h17M7.5 8h2M7.5 12h2M7.5 16h2M16 13h1.5M16 16.5h1.5"/></svg> Previously</div>' +
        p.previous_orgs.slice(0,6).map(function(h){
          var yrs = [String(h.start||'').slice(0,4), String(h.end||'').slice(0,4)].filter(Boolean).join(', ');
          return '<div style="display:flex;align-items:baseline;gap:7px;padding:3px 0;border-top:1px solid var(--border)">' +
            '<span style="font-size:12px;color:var(--text);font-weight:600">'+esc(h.organization)+'</span>' +
            (h.title?'<span style="font-size:11px;color:var(--text3)">'+esc(h.title)+'</span>':'') +
            (yrs?'<span style="font-size:11px;color:var(--text3);margin-left:auto">'+esc(yrs)+'</span>':'') +
          '</div>';
        }).join('') + '</div>';
    }
    if (p.seniority || p.department) {
      html += '<div style="margin-top:10px;font-size:11px;color:var(--text3)">'+[p.seniority,p.department].filter(Boolean).map(esc).join(' · ')+'</div>';
    }

    // The brief. Deterministic, derived from what was actually found, and
    // every line carries the evidence it rests on rather than asserting.
    if ((d.intel||[]).length) {
      html += '<div style="margin-top:13px;padding-top:11px;border-top:1px solid var(--border)">' +
        '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px">' +
          _detectiveSamAvatar(22) +
          '<span style="font-size:11px;font-weight:700;color:var(--text)">Here is what Detective SAM would like you to know about '+esc((p.name||'them').split(' ')[0])+' before you reach out</span>' +
        '</div>' +
        d.intel.map(function(it) {
          return '<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 9px;margin-bottom:4px;background:rgba(var(--c-accent-rgb),0.07);border-radius:var(--r-sm)">' +
            '<span style="flex-shrink:0;font-size:12px">'+esc(it.icon||'•')+'</span>' +
            '<div style="min-width:0">' +
              '<div style="font-size:11px;color:var(--text);line-height:1.45">'+esc(it.text)+'</div>' +
              (it.basis ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">based on: '+esc(it.basis)+'</div>' : '') +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }
    // Only shown when there is actually something to attribute. "Sources:
    // none" under a result is a contradiction, and absent data needs no
    // announcement.
    if ((d.sources_used||[]).length) {
      html += '<div style="margin-top:11px;padding-top:9px;border-top:1px solid var(--border);font-size:11px;color:var(--text3)">Sources: '+d.sources_used.map(function(s){ return (_DS_SRC_META[s]||{label:s}).label; }).join(', ')+(d.internal_hits?' · '+d.internal_hits+' match'+(d.internal_hits!==1?'es':'')+' already in your data':'')+'</div>';
    }
    html += '</div>';
  }

  (d.notes||[]).forEach(function(n){
    html += '<div style="margin-top:8px;font-size:11px;color:var(--amber);background:rgba(212,160,74,0.08);border-radius:var(--r-sm);padding:8px 10px">ⓘ '+esc(n)+'</div>';
  });

  if (d.found) html += _dsActionsHtml();
  return html;
}

// "What now?" — asked once a result exists, rather than assuming.
function _dsActionsHtml() {
  var camps = window._sampaignCampaignsCache || {};
  var ids = Object.keys(camps);
  var opts = ids.map(function(id){ return '<option value="'+esc(id)+'">'+esc(camps[id].name||'SAMpaign')+'</option>'; }).join('');
  return '<div style="margin-top:12px;background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:12px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text);margin-bottom:8px">What do you want to do with this?</div>' +
    (ids.length
      ? '<div style="display:flex;gap:6px;align-items:center;margin-bottom:7px">' +
          '<select id="dsCampaignPick" style="flex:1;padding:7px 9px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px">'+opts+'</select>' +
          '<button onclick="dsAddToSampaign()" style="font-size:11px;font-weight:600;padding:7px 12px;border-radius:var(--r-sm);background:var(--green);border:none;color:#fff;cursor:pointer;font-family:var(--sans);white-space:nowrap">Add to SAMpaign</button>' +
        '</div>'
      : '<div style="font-size:11px;color:var(--text3);margin-bottom:7px">No SAMpaigns yet, create one to add people to it.</div>') +
    '<div style="display:flex;gap:6px;align-items:center;margin-bottom:7px">' +
      '<input id="dsAccountSearch" placeholder="Account name to attach as stakeholder…" oninput="dsFindAccounts(this.value)" style="flex:1;padding:7px 9px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
    '</div>' +
    '<div id="dsAccountResults"></div>' +
    '<div style="font-size:11px;color:var(--text3);margin-top:6px">Saved to an account, they are marked <strong>prospective</strong> until you have actually contacted them, so coverage and champion metrics stay honest.</div>' +
    '<div style="text-align:right;margin-top:8px"><span onclick="document.getElementById(\'detective-sam-modal\').remove()" style="font-size:11px;color:var(--text3);cursor:pointer">Just show me, close</span></div>' +
  '</div>';
}

async function dsAddToSampaign() {
  var d = window._dsResult; if (!d) return;
  var cid = document.getElementById('dsCampaignPick')?.value;
  if (!cid) { showToast('Pick a SAMpaign'); return; }
  var p = d.profile || {};
  var contact = {
    name: p.name || '', email: (d.emails||[])[0]?.value || '',
    phone: (d.phones||[])[0]?.value || '', company: p.current_org || p.company || '', title: p.title || ''
  };
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'upload_sampaign_contacts', campaign_id: cid, contacts: [contact] }) });
    var j = await r.json();
    if (!j.ok) { showToast('Error: '+(j.error||'Could not add')); return; }
 showToast(j.added ? 'Added to SAMpaign' : 'Already in that SAMpaign');
  } catch(e) { showToast('Error: '+e.message); }
}

var _dsAcctTimer = null;
function dsFindAccounts(q) {
  clearTimeout(_dsAcctTimer);
  var box = document.getElementById('dsAccountResults');
  if (!box) return;
  if (!q || q.trim().length < 2) { box.innerHTML = ''; return; }
  _dsAcctTimer = setTimeout(function() {
    var needle = q.trim().toLowerCase();
    // Search the pipeline already loaded in this session rather than adding a
    // lookup endpoint for something the client already holds. _pipelineData
    // is the global; the `allDeals` arrays elsewhere in this file are local
    // to their own functions and not reachable from here.
    var pd = (typeof _pipelineData !== 'undefined' && _pipelineData) ? _pipelineData : null;
    if (!pd) { box.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:3px 0">Open the Pipeline tab once so your accounts are loaded, then try again.</div>'; return; }
    var pool = [].concat(pd.verified||[], pd.partial||[], pd.unverified||[]);
    var hits = pool.filter(function(a){ return String(a.account_name||'').toLowerCase().indexOf(needle) !== -1; }).slice(0, 5);
    if (!hits.length) { box.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:3px 0">No matching account in your pipeline.</div>'; return; }
    box.innerHTML = hits.map(function(a){
      return '<div onclick="dsSaveStakeholder(\''+esc(a.id)+'\',\''+esc(a.account_name)+'\')" style="cursor:pointer;font-size:11px;color:var(--text);padding:5px 7px;border-radius:var(--r-sm);background:var(--surface2);margin-top:3px">＋ '+esc(a.account_name)+'</div>';
    }).join('');
  }, 200);
}

async function dsSaveStakeholder(accountId, accountName) {
  var d = window._dsResult; if (!d) return;
  var p = d.profile || {};
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'detective_sam_save_stakeholder', account_id: accountId,
        name: p.name, email: (d.emails||[])[0]?.value || null, phone: (d.phones||[])[0]?.value || null,
        title: p.title, linkedin_url: p.linkedin_url, seniority: p.seniority, department: p.department }) });
    var j = await r.json();
    if (!j.ok) { showToast('Error: '+(j.error||'Could not save')); return; }
 showToast(j.added ? 'Added to '+accountName+' as prospective' : (j.note||'Already a stakeholder'));
  } catch(e) { showToast('Error: '+e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════
// Follow-up scheduler — pick actual calendar dates, with weekends in red.
//
// Replaces the old "3,7,14 days after send" box. Day offsets meant you had to
// do date arithmetic in your head at creation time, so follow-up 2 would
// quietly land on a Saturday. Here you see the calendar while choosing, and
// weekends are marked, so a weekend date is always a deliberate choice.
//
// State is keyed by scope: 'new' for the create form, or the campaignId for
// an edit form, so both can be open at once without colliding.
// ═══════════════════════════════════════════════════════════════════════════
window._fupState = {};        // scope -> ['2026-08-05', ...]
window._fupCalOpen = null;    // 'scope:index' of the open calendar, if any
window._fupCalMonth = {};     // 'scope:index' -> {y, m} being browsed

var _FUP_MAX = 5;
var _FUP_DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var _FUP_MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function _fupIsWeekend(key) { var d = parseDate(key); return d.getDay() === 0 || d.getDay() === 6; }
function _fupPretty(key) {
  var d = parseDate(key);
  return _FUP_DOW[d.getDay()] + ' ' + d.getDate() + ' ' + _FUP_MON[d.getMonth()];
}
// Default suggestion for a newly added follow-up: a week after the previous
// one (or a week out from today for the first), nudged off a weekend since an
// unreviewed default landing on Saturday is the exact trap this replaces.
function _fupSuggest(existing) {
  var base = existing.length ? parseDate(existing[existing.length - 1]) : new Date();
  var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return dateKey(d);
}

function _fupGet(scope) { return window._fupState[scope] || (window._fupState[scope] = []); }

function _fupSetCount(scope, n) {
  var cur = _fupGet(scope);
  n = Math.max(0, Math.min(_FUP_MAX, parseInt(n, 10) || 0));
  while (cur.length > n) cur.pop();
  while (cur.length < n) cur.push(_fupSuggest(cur));
  window._fupCalOpen = null;
  _fupRender(scope);
}
function _fupAdd(scope) {
  var cur = _fupGet(scope);
  if (cur.length >= _FUP_MAX) { showToast('Up to ' + _FUP_MAX + ' follow-ups'); return; }
  cur.push(_fupSuggest(cur));
  _fupRender(scope);
}
function _fupRemove(scope, i) {
  var cur = _fupGet(scope);
  cur.splice(i, 1);
  window._fupCalOpen = null;
  _fupRender(scope);
}
function _fupToggleCal(scope, i) {
  var key = scope + ':' + i;
  window._fupCalOpen = (window._fupCalOpen === key) ? null : key;
  if (window._fupCalOpen) {
    var d = parseDate(_fupGet(scope)[i]);
    window._fupCalMonth[key] = { y: d.getFullYear(), m: d.getMonth() };
  }
  _fupRender(scope);
}
function _fupNavMonth(scope, i, delta) {
  var key = scope + ':' + i;
  var cur = window._fupCalMonth[key] || { y: new Date().getFullYear(), m: new Date().getMonth() };
  var d = new Date(cur.y, cur.m + delta, 1);
  window._fupCalMonth[key] = { y: d.getFullYear(), m: d.getMonth() };
  _fupRender(scope);
}
function _fupPick(scope, i, key) {
  var cur = _fupGet(scope);
  cur[i] = key;
  // Dates stay in chronological order so "follow-up 2" always means the
  // second one that happens, regardless of the order they were filled in.
  cur.sort();
  window._fupCalOpen = null;
  _fupRender(scope);
}

function _fupCalendarHtml(scope, i) {
  var key = scope + ':' + i;
  var sel = _fupGet(scope)[i];
  var mm = window._fupCalMonth[key] || { y: parseDate(sel).getFullYear(), m: parseDate(sel).getMonth() };
  var first = new Date(mm.y, mm.m, 1);
  var startPad = first.getDay();
  var daysInMonth = new Date(mm.y, mm.m + 1, 0).getDate();
  var todayK = todayKey();
  var taken = _fupGet(scope);

  var head = _FUP_DOW.map(function(d, idx) {
    var wk = (idx === 0 || idx === 6);
    return '<div style="font-size:11px;font-weight:700;text-align:center;padding:3px 0;color:'+(wk?'var(--coral)':'var(--text3)')+'">'+d.charAt(0)+'</div>';
  }).join('');

  var cells = '';
  for (var p = 0; p < startPad; p++) cells += '<div></div>';
  for (var day = 1; day <= daysInMonth; day++) {
    var k = dateKey(new Date(mm.y, mm.m, day));
    var dow = new Date(mm.y, mm.m, day).getDay();
    var wknd = (dow === 0 || dow === 6);
    var isSel = (k === sel);
    var isPast = k < todayK;
    var isDupe = taken.indexOf(k) !== -1 && !isSel;
    var col = isSel ? '#fff' : (wknd ? 'var(--coral)' : 'var(--text)');
    var bg = isSel ? 'var(--gold)' : (wknd ? 'rgba(196,90,74,0.07)' : 'transparent');
    var dis = isPast || isDupe;
    cells += '<div' + (dis ? '' : ' onclick="_fupPick(\''+esc(scope)+'\','+i+',\''+k+'\')"') +
      ' title="'+(isDupe?'Already used by another follow-up':(isPast?'In the past':(wknd?'Weekend':'')))+'"' +
      ' style="text-align:center;font-size:11px;padding:5px 0;border-radius:var(--r-sm);background:'+bg+';color:'+col+';' +
        (dis ? 'opacity:0.28;' : 'cursor:pointer;') + (isSel?'font-weight:700;':'') + '">' + day + '</div>';
  }

  return '<div style="margin-top:6px;padding:8px;border:1px solid var(--border2);border-radius:var(--r-sm);background:var(--bg)">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">' +
      '<span onclick="_fupNavMonth(\''+esc(scope)+'\','+i+',-1)" style="cursor:pointer;padding:2px 7px;font-size:13px;color:var(--text3)">‹</span>' +
      '<span style="font-size:11px;font-weight:700;color:var(--text)">'+_FUP_MON[mm.m]+' '+mm.y+'</span>' +
      '<span onclick="_fupNavMonth(\''+esc(scope)+'\','+i+',1)" style="cursor:pointer;padding:2px 7px;font-size:13px;color:var(--text3)">›</span>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">' + head + cells + '</div>' +
    '<div style="font-size:11px;color:var(--coral);margin-top:5px">Weekends in red</div>' +
  '</div>';
}

function _fupRender(scope) {
  var box = document.getElementById('fupRows_' + scope);
  if (!box) return;
  var dates = _fupGet(scope);
  var html = '';

  if (!dates.length) {
    html += '<div style="font-size:11px;color:var(--text3);padding:4px 0">No follow-ups, one send only.</div>';
  }
  dates.forEach(function(k, i) {
    var wknd = _fupIsWeekend(k);
    var open = (window._fupCalOpen === scope + ':' + i);
    html += '<div style="border:1px solid '+(wknd?'rgba(196,90,74,0.35)':'var(--border2)')+';border-radius:var(--r-sm);padding:7px 9px;background:var(--bg)">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<span style="font-size:11px;font-weight:600;color:var(--text3);min-width:74px">Follow-up '+(i+1)+'</span>' +
        '<span onclick="_fupToggleCal(\''+esc(scope)+'\','+i+')" style="flex:1;font-size:12px;font-weight:600;color:'+(wknd?'var(--coral)':'var(--text)')+';cursor:pointer">' +
          '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> '+_fupPretty(k)+(wknd?' <span style="font-size:11px;font-weight:600">· weekend</span>':'') +
        '</span>' +
        '<span onclick="_fupRemove(\''+esc(scope)+'\','+i+')" style="cursor:pointer;color:var(--text3);font-size:13px;padding:0 2px" title="Remove this follow-up"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>' +
      '</div>' +
      (open ? _fupCalendarHtml(scope, i) : '') +
    '</div>';
  });

  html += '<div style="display:flex;align-items:center;gap:8px;margin-top:2px">' +
    (dates.length < _FUP_MAX
      ? '<span onclick="_fupAdd(\''+esc(scope)+'\')" style="font-size:11px;font-weight:600;color:var(--gold);cursor:pointer">+ Add follow-up</span>'
      : '<span style="font-size:11px;color:var(--text3)">Maximum '+_FUP_MAX+' follow-ups</span>') +
  '</div>';

  box.innerHTML = html;
  var sel = document.getElementById('fupCount_' + scope);
  if (sel && String(sel.value) !== String(dates.length)) sel.value = String(dates.length);
}

// The whole control: count dropdown + rows + add button.
function _fupEditorHtml(scope, initial) {
  window._fupState[scope] = (initial || []).map(function(d){ return String(d).slice(0,10); }).sort();
  window._fupCalOpen = null;
  var n = window._fupState[scope].length;
  var opts = '';
  for (var i = 0; i <= _FUP_MAX; i++) opts += '<option value="'+i+'"'+(i===n?' selected':'')+'>'+i+'</option>';
  return '<div style="display:flex;flex-direction:column;gap:6px">' +
    '<div style="display:flex;align-items:center;gap:8px">' +
      '<span style="font-size:11px;color:var(--text3)">How many follow-ups?</span>' +
      '<select id="fupCount_'+esc(scope)+'" onchange="_fupSetCount(\''+esc(scope)+'\',this.value)" style="padding:5px 8px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px">'+opts+'</select>' +
      '<span style="font-size:11px;color:var(--text3)">Pick the actual dates, weekends are flagged</span>' +
    '</div>' +
    '<div id="fupRows_'+esc(scope)+'" style="display:flex;flex-direction:column;gap:5px"></div>' +
  '</div>';
}

function loadSampaignWorkspace() {
  var role = (profile?.role||'').toLowerCase();
  var el = document.getElementById('sampaignManualSection');
  if (!el) return;
  // Detective SAM is a research tool, not a campaign tool, so it is NOT
  // behind the sdr/ae/manager gate the SAMpaign workspace sits behind —
  // anyone who needs to look a person up should be able to.
  // The allowlist used to be ['sdr','ae','manager'], which silently excluded
  // director, executive, admin and super_admin: they saw the Detective SAM
  // card and no SAMpaign workspace at all, so they could not create one.
  //
  // That contradicted the backend, which never had such a gate.
  // create_sampaign has no role check, and list_sampaigns has EXPLICIT
  // branches for canSeeCrossTeam (director) and canSeeFullOrg (executive,
  // admin) to widen which owners they see. Those branches only make sense if
  // those roles can reach the screen, so the frontend was the thing that was
  // wrong.
  //
  // Everyone gets the workspace now. The backend already scopes what each
  // role can SEE, so the gate here was doing nothing except hiding a feature
  // from the people most likely to be setting it up for their team.
  var scopeLabel = ['director'].includes(role) ? ' (you + your teams)'
                 : ['executive','admin','super_admin'].includes(role) ? ' (whole organisation)'
                 : role === 'manager' ? ' (you + your team)'
                 : '';
  el.innerHTML =
    detectiveSamCardHtml() +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
      '<span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">SAMpaigns</span>' +
      '<button onclick="toggleNewSampaignForm()" id="sampaignNewBtn" style="font-size:11px;font-weight:600;padding:5px 12px;border-radius:var(--r-sm);background:var(--green);border:none;color:#fff;cursor:pointer;font-family:var(--sans)">+ New SAMpaign</button>' +
    '</div>' +
    '<div id="sampaignNewForm" style="display:none;background:var(--surface2);border-radius:var(--r-md);padding:10px;margin-bottom:12px">' +
      '<div style="display:flex;flex-direction:column;gap:6px">' +
      '<div style="font-size:11px;color:var(--text3)">Same as an SDR lead, a SAMpaign is anchored to a real tracked account, so contacts you upload/scout belong to it by construction.</div>' +
      '<input id="sampaignName" placeholder="Company name (e.g. Acme Corp)" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/>' +
      '<input id="sampaignDomain" placeholder="Domain (e.g. acme.com)" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/>' +
      '<input id="sampaignRegion" placeholder="Region (optional)" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/>' +
      '<div style="font-size:11px;color:var(--text3)">Campaign goal / ask, what are you pitching and what do you want them to do? (used by AI drafting tools, e.g. Claude via connector)</div>' +
      '<select id="sampaignGoalTemplate" onchange="applyGoalTemplate()" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface2);color:var(--text);font-family:var(--sans);font-size:12px;display:none"></select>' +
      '<div style="display:flex;gap:10px;align-items:center">' +
        '<a id="sampaignGoalSave" onclick="saveGoalAsTemplate()" style="font-size:11px;color:var(--gold);cursor:pointer;display:none">Save this goal for next time</a>' +
        '<a id="sampaignGoalForget" onclick="forgetGoalTemplate()" style="font-size:11px;color:var(--text3);cursor:pointer;display:none">Forget selected</a>' +
      '</div>' +
      '<textarea id="sampaignGoal" rows="2" placeholder="e.g. Introduce our retail execution platform, get a 15-min discovery call booked with the regional sales lead" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans);resize:vertical;height:48px"></textarea>' +
      '<div style="font-size:11px;color:var(--text3)">Who is this one for? A short label so you can tell it apart later (e.g. RTM leadership, Plant heads)</div>' +
      '<input id="sampaignFocus" maxlength="48" placeholder="Focus (e.g. RTM leadership)" style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/>' +
      '<div style="font-size:11px;color:var(--text3)">Follow-up schedule, these become tasks on your own list for those days</div>' +
      _fupEditorHtml('new', [_fupSuggest([])]) +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--text2)">' +
        '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="sampaignAlertOoo" checked/> OOO alerts</label>' +
        '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="sampaignAlertReplied" checked/> Reply alerts</label>' +
        '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="sampaignAlertNoResp" checked/> No-response alerts</label>' +
        '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="sampaignAlertDead" checked/> Dead-contact alerts</label>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">Who are you reaching out to? Type them in, attach a CSV, or do neither and add people later.</div>' +
      '<div><span onclick="addSampaignContactRows(\'new\')" style="font-size:11px;font-weight:600;color:var(--green);cursor:pointer">＋ Add people manually</span></div>' +
      '<div id="sampaignAddRows_new"></div>' +
      '<div style="font-size:11px;color:var(--text3)">Or attach a CSV (name, email, phone, company, title)</div>' +
      '<input type="file" id="sampaignNewCsv" accept=".csv,text/csv" style="font-size:11px;color:var(--text2)"/>' +
      '<button id="createSampaignBtn" onclick="createSampaign()" style="padding:9px;border:none;border-radius:var(--r-sm);background:var(--green);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--sans)">Create SAMpaign</button>' +
      '</div></div>' +
    '<div id="sampaignListToolbar"></div>' +
    '<div id="sampaignCampaignsList"><div style="font-size:12px;color:var(--text3);padding:6px 0">Loading…</div></div>';
  _fupRender('new');
  loadGoalTemplates();
  loadSampaignCampaigns();
}

// ═══════════════════════════════════════════════════════════════════════════
// Follow-up tasks — put each follow-up on the owner's own task list for its
// date, and move it when the date changes.
//
// Written client-side into allData + save(dayKey), the same path every other
// task uses, rather than having the edge function write into daytrack behind
// the app's back. Two reasons: the person editing the campaign is by
// definition the owner (edit is owner-only), so their own session already has
// the right identity and the right local state; and a server-side write would
// race the client's own copy of allData, which syncDown resolves by task
// count, not by recency.
//
// Tasks are keyed `sampaign:{campaignId}:{stage}` so a date change MOVES the
// task instead of leaving a duplicate behind. Completion is not carried
// across a move on purpose: if you reschedule follow-up 2, it hasn't been
// done yet, so re-opening it is the truthful state.
// ═══════════════════════════════════════════════════════════════════════════
function _fupTaskId(campaignId, stage) { return 'sampaign:' + campaignId + ':' + stage; }

async function _syncSampaignFupTasks(campaignId, campaignName, oldDates, newDates) {
  if (typeof allData === 'undefined' || typeof save !== 'function') return 0;
  oldDates = (oldDates || []).map(function(d){ return String(d).slice(0,10); });
  newDates = (newDates || []).map(function(d){ return String(d).slice(0,10); });

  // Every day that might need rewriting: anywhere this campaign had a task
  // before, plus anywhere it should have one now.
  var touched = {};
  oldDates.concat(newDates).forEach(function(k){ touched[k] = true; });

  // Strip this campaign's follow-up tasks from all affected days first, so a
  // moved date can't leave an orphan behind on the old day.
  Object.keys(touched).forEach(function(k) {
    var d = dayData(k);
    d.tasks = (d.tasks || []).filter(function(t){ return !(t && t.sampaignId === campaignId); });
  });

  // Then place one task per follow-up on its (new) date.
  newDates.forEach(function(k, i) {
    var d = dayData(k);
    d.tasks.push({
      id: _fupTaskId(campaignId, i + 1),
      text: 'Follow-up ' + (i + 1) + ', ' + (campaignName || 'SAMpaign'),
      done: false,
      source: 'sampaign',
      sampaignId: campaignId,
      fupStage: i + 1,
      createdAt: new Date().toISOString()
    });
  });

  var keys = Object.keys(touched);
  for (var i = 0; i < keys.length; i++) { try { await save(keys[i]); } catch(e) {} }
  // Report only genuine reschedules (a date that changed), not first-time
  // creation, so the toast doesn't claim work it didn't do.
  var movedCount = newDates.filter(function(k){ return oldDates.indexOf(k) === -1; }).length;
  return oldDates.length ? movedCount : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// A DELETED CAMPAIGN MUST STOP ASKING FOR WORK
//
// THE BUG THIS FIXES. _syncSampaignFupTasks writes follow-up tasks into day
// storage. deleteSampaignCampaign archives the campaign server-side and
// cancels queued sends, but nothing ever removed those local tasks. So
// "Follow-up 1 - Ferrero Germany" kept appearing every morning for a campaign
// that had been cancelled, and the only way to clear it was by hand, one task
// at a time, forever.
//
// Two halves, and BOTH are needed:
//   1. purge on delete, so it stops happening, and
//   2. a sweep on load, so the backlog already sitting in day storage from
//      campaigns deleted before this fix clears itself.
// Half 1 alone would leave the existing mess permanent.
// ═══════════════════════════════════════════════════════════════════════════

// Strip one campaign's follow-up tasks from every day that still carries them.
async function _purgeSampaignFupTasks(campaignId) {
  if (typeof allData === 'undefined' || typeof save !== 'function') return 0;
  // Sweep day storage rather than trusting a list of dates: a task can sit on
  // a day the campaign no longer references, which is exactly how orphans
  // survive a reschedule.
  var days = {};
  Object.keys(allData || {}).forEach(function(k) {
    var d = allData[k];
    if (d && d.tasks && d.tasks.some(function(t){ return t && t.sampaignId === campaignId; })) days[k] = true;
  });

  var removed = 0;
  var keys = Object.keys(days);
  for (var i = 0; i < keys.length; i++) {
    var d = dayData(keys[i]);
    var before = (d.tasks || []).length;
    d.tasks = (d.tasks || []).filter(function(t){ return !(t && t.sampaignId === campaignId); });
    removed += before - d.tasks.length;
    try { await save(keys[i]); } catch(e) {}
  }
  return removed;
}

// Self-healing sweep. Anything sourced from a SAMpaign that is no longer in
// the live list is an orphan, and clears itself the next time the tab loads.
// Only runs on a SUCCESSFUL fetch of the campaign list: an empty list from a
// failed request would otherwise wipe every follow-up the rep has.
async function _sweepOrphanFupTasks(liveCampaignIds) {
  if (typeof allData === 'undefined' || typeof save !== 'function') return 0;
  if (!Array.isArray(liveCampaignIds)) return 0;
  var live = {};
  liveCampaignIds.forEach(function(id){ live[id] = true; });

  var removed = 0, touched = [];
  Object.keys(allData || {}).forEach(function(k) {
    var d = allData[k];
    if (!d || !d.tasks || !d.tasks.length) return;
    var before = d.tasks.length;
    d.tasks = d.tasks.filter(function(t) {
      if (!t || t.source !== 'sampaign' || !t.sampaignId) return true;
      return !!live[t.sampaignId];
    });
    if (d.tasks.length !== before) { removed += before - d.tasks.length; touched.push(k); }
  });
  for (var i = 0; i < touched.length; i++) { try { await save(touched[i]); } catch(e) {} }
  return removed;
}

function toggleNewSampaignForm() {
  var f = document.getElementById('sampaignNewForm'); if (!f) return;
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  if (f.style.display === 'block') document.getElementById('sampaignName')?.focus();
}

// ── Campaign goal templates ───────────────────────────────────
// Two tiers. The org list is the house pitches, kept by an admin so everyone
// runs the same campaign the same way. The personal list is the goal THIS rep
// keeps reusing, which is nobody else's business and should not need an admin.
// Personal ones are stored server side, so they survive a new laptop.
var _goalTemplates = [];      // { label, goal, mine }
async function loadGoalTemplates() {
  var org = [], mine = [];
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'get_org_setting', key:'campaign_goal_templates' }) });
    var d = await r.json();
    var raw = d && d.value;
    org = typeof raw === 'string' ? JSON.parse(raw || '[]') : (Array.isArray(raw) ? raw : []);
  } catch(e) { org = []; }
  try {
    var r2 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'get_user_kv', key:'campaign_goal_templates' }) });
    var d2 = await r2.json();
    var raw2 = d2 && d2.value;
    mine = typeof raw2 === 'string' ? JSON.parse(raw2 || '[]') : (Array.isArray(raw2) ? raw2 : []);
  } catch(e) { mine = []; }

  _goalTemplates = mine.map(function(t){ return { label: t.label, goal: t.goal, mine: true }; })
    .concat(org.map(function(t){ return { label: t.label, goal: t.goal, mine: false }; }));

  var save = document.getElementById('sampaignGoalSave');
  if (save) save.style.display = '';
  var sel = document.getElementById('sampaignGoalTemplate');
  if (!sel) return;
  if (!_goalTemplates.length) { sel.style.display = 'none'; return; }
  var opt = function(t, i){ return '<option value="'+i+'">'+esc(t.label || ('Template '+(i+1)))+'</option>'; };
  var html = '<option value="">Start from a saved goal, or write your own below</option>';
  var mineOpts = _goalTemplates.map(function(t,i){ return t.mine ? opt(t,i) : ''; }).join('');
  var orgOpts  = _goalTemplates.map(function(t,i){ return t.mine ? '' : opt(t,i); }).join('');
  if (mineOpts) html += '<optgroup label="My goals">' + mineOpts + '</optgroup>';
  if (orgOpts)  html += '<optgroup label="Shared across your organisation">' + orgOpts + '</optgroup>';
  sel.innerHTML = html;
  sel.style.display = '';
  _syncGoalTemplateButtons();
}

function _syncGoalTemplateButtons() {
  var sel = document.getElementById('sampaignGoalTemplate');
  var del = document.getElementById('sampaignGoalForget');
  if (!del) return;
  var t = sel ? _goalTemplates[parseInt(sel.value, 10)] : null;
  // Only a rep's OWN template is theirs to remove. Deleting the org's copy for
  // everyone, from a create form, would be a surprise nobody could undo.
  del.style.display = (t && t.mine) ? '' : 'none';
}

function applyGoalTemplate() {
  var sel = document.getElementById('sampaignGoalTemplate');
  var box = document.getElementById('sampaignGoal');
  _syncGoalTemplateButtons();
  if (!sel || !box) return;
  var t = _goalTemplates[parseInt(sel.value, 10)];
  if (!t) return;
  if (box.value.trim() && !confirm('Replace the goal you have written with the "' + (t.label||'selected') + '" template?')) { sel.value = ''; _syncGoalTemplateButtons(); return; }
  box.value = t.goal || '';
  box.focus();
}

async function _saveMyGoalTemplates(list) {
  await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
    body: JSON.stringify({ action:'set_user_kv', key:'campaign_goal_templates', value: JSON.stringify(list) }) });
}

async function saveGoalAsTemplate() {
  var box = document.getElementById('sampaignGoal');
  var goal = box ? box.value.trim() : '';
  if (!goal) { showToast('Write the goal first, then save it as a template'); return; }
  var label = prompt('Name this goal so you can find it again:', goal.slice(0, 40));
  if (!label || !label.trim()) return;
  var mine = _goalTemplates.filter(function(t){ return t.mine; }).map(function(t){ return { label: t.label, goal: t.goal }; });
  var at = -1;
  for (var i = 0; i < mine.length; i++) { if ((mine[i].label||'').toLowerCase() === label.trim().toLowerCase()) { at = i; break; } }
  if (at >= 0) mine[at] = { label: label.trim(), goal: goal }; else mine.push({ label: label.trim(), goal: goal });
  try {
    await _saveMyGoalTemplates(mine);
    showToast(at >= 0 ? 'Template updated' : 'Saved to your goals');
    await loadGoalTemplates();
  } catch(e) { showToast('Could not save: ' + e.message); }
}

async function forgetGoalTemplate() {
  var sel = document.getElementById('sampaignGoalTemplate');
  var t = sel ? _goalTemplates[parseInt(sel.value, 10)] : null;
  if (!t || !t.mine) return;
  if (!confirm('Remove "' + (t.label||'this goal') + '" from your saved goals?')) return;
  var mine = _goalTemplates.filter(function(x){ return x.mine && x.label !== t.label; }).map(function(x){ return { label: x.label, goal: x.goal }; });
  try {
    await _saveMyGoalTemplates(mine);
    showToast('Removed');
    if (sel) sel.value = '';
    await loadGoalTemplates();
  } catch(e) { showToast('Could not remove: ' + e.message); }
}

// Guards the whole submit, not just the button, because the button can be
// re-enabled by a re-render while a request is still in flight.
var _creatingSampaign = false;
async function createSampaign() {
  if (_creatingSampaign) return;
  var accountName = document.getElementById('sampaignName')?.value?.trim();
  var domain = document.getElementById('sampaignDomain')?.value?.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'');
  var region = document.getElementById('sampaignRegion')?.value?.trim() || null;
  if (!accountName) { showToast('Enter a company name'); return; }
  if (!domain) { showToast('Enter a domain, SAMpaigns are anchored to a tracked account, same as an SDR lead'); return; }
  var campaignGoal = document.getElementById('sampaignGoal')?.value?.trim() || null;
  var followup_dates = (window._fupState['new'] || []).slice();
  var alerts_enabled = {
    ooo: !!document.getElementById('sampaignAlertOoo')?.checked,
    replied: !!document.getElementById('sampaignAlertReplied')?.checked,
    no_response: !!document.getElementById('sampaignAlertNoResp')?.checked,
    dead: !!document.getElementById('sampaignAlertDead')?.checked
  };
  var csvFile = document.getElementById('sampaignNewCsv')?.files?.[0] || null;
  // Collected BEFORE the create call so a validation problem (bad email
  // format) stops us here rather than after a campaign already exists.
  var typedContacts = null;
  if ((window._sampAddRows['new'] || []).length) {
    typedContacts = _collectSampAddRows('new');
    if (!typedContacts) return;
  }
  // Tell the person something is happening. A create takes a few seconds and
  // a silent button reads as a dead button, which is why people clicked it
  // repeatedly and ended up with three campaigns.
  _creatingSampaign = true;
  var _btn = document.getElementById('createSampaignBtn');
  var _btnLabel = _btn ? _btn.textContent : null;
  if (_btn) { _btn.disabled = true; _btn.style.opacity = '0.65'; _btn.style.cursor = 'wait'; _btn.textContent = 'Creating SAMpaign…'; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'create_sampaign', account_name: accountName, domain: domain, region: region, campaign_goal: campaignGoal, focus: (document.getElementById('sampaignFocus')?.value||'').trim() || null, followup_dates: followup_dates, alerts_enabled: alerts_enabled }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not create SAMpaign')); return; }
 showToast(d.account_linked ? 'SAMpaign linked to existing account' : 'SAMpaign + account created');
    // Put the follow-ups on the owner's own task list for those days.
    if (d.campaign?.id) await _syncSampaignFupTasks(d.campaign.id, accountName, [], followup_dates);
    document.getElementById('sampaignName').value = '';
    document.getElementById('sampaignDomain').value = '';
    document.getElementById('sampaignRegion').value = '';
    document.getElementById('sampaignGoal').value = '';
    var fEl = document.getElementById('sampaignFocus'); if (fEl) fEl.value = '';
    _fupState['new'] = [_fupSuggest([])];
    _fupRender('new');
    toggleNewSampaignForm();
    // One-motion audience definition: people typed into the form and/or a CSV
    // attached at creation both go straight into the campaign we just made —
    // name it and define who it targets in one step (Outreach.io's pattern),
    // rather than forcing a separate pass right afterwards. Adding MORE
    // people later, from the campaign itself, still works unchanged.
    if (d.campaign?.id && typedContacts && typedContacts.length) {
      try {
        var ar = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
          body: JSON.stringify({ action:'upload_sampaign_contacts', campaign_id: d.campaign.id, contacts: typedContacts }) });
        var ad = await ar.json();
 if (ad.ok) showToast('Added ' + (ad.added||0) + ' contact' + ((ad.added||0)!==1?'s':'') + (ad.need_email ? ' · ' + ad.need_email + ' need an email lookup' : ''));
      } catch(e) { showToast('Campaign created, but adding people failed: '+e.message); }
      window._sampAddRows['new'] = null;
      var addBox = document.getElementById('sampaignAddRows_new'); if (addBox) addBox.innerHTML = '';
    }
    if (csvFile && d.campaign?.id) {
      await _uploadSampaignCsvFile(d.campaign.id, csvFile);
      var csvEl = document.getElementById('sampaignNewCsv'); if (csvEl) csvEl.value = '';
    }
    loadSampaignCampaigns();
  } catch(e) { showToast('Error: '+e.message); }
  finally {
    _creatingSampaign = false;
    var _b = document.getElementById('createSampaignBtn');
    if (_b) { _b.disabled = false; _b.style.opacity = ''; _b.style.cursor = 'pointer'; if (_btnLabel) _b.textContent = _btnLabel; }
  }
}

// Active / Archived sub-tab, plus WHOSE SAMpaigns to show. Both live in
// module state rather than the DOM so a re-render after edit, delete or
// restore keeps whatever the user was looking at.
//
// Since 2026-09-27 everyone in the org can see every SAMpaign (read only for
// ones they do not own; the server still refuses every write). The filter is:
//   'mine'  only mine
//   'all'   everyone in the org (the default)
//   'pick'  a chosen set of people, ticked in the people menu
// Remembered per browser, because a rep who only wants their own list should
// not have to re-choose it every time they open the tab.
window._sampaignView = window._sampaignView || 'active';
(function () {
  var f = 'all', picked = [];
  try {
    var saved = JSON.parse(localStorage.getItem('dt-samp-owner-filter') || 'null');
    if (saved && (saved.f === 'mine' || saved.f === 'all' || saved.f === 'pick')) f = saved.f;
    if (saved && Array.isArray(saved.picked)) picked = saved.picked.filter(function (x) { return typeof x === 'string'; });
  } catch (e) {}
  window._sampaignOwnerFilter = window._sampaignOwnerFilter || f;
  window._sampaignPicked = window._sampaignPicked || picked;
})();
function _saveSampaignOwnerFilter() {
  try { localStorage.setItem('dt-samp-owner-filter', JSON.stringify({ f: window._sampaignOwnerFilter, picked: window._sampaignPicked || [] })); } catch (e) {}
}

function setSampaignView(v) {
  window._sampaignView = (v === 'archived') ? 'archived' : 'active';
  loadSampaignCampaigns();
}
function setSampaignOwnerFilter(v) {
  window._sampaignOwnerFilter = (v === 'mine' || v === 'pick') ? v : 'all';
  // Choosing "pick" with nobody ticked would show an empty list that looks
  // like a bug. Start from yourself, which is the one person always present.
  if (window._sampaignOwnerFilter === 'pick' && !(window._sampaignPicked || []).length && currentUser) {
    window._sampaignPicked = [currentUser.id];
  }
  _saveSampaignOwnerFilter();
  loadSampaignCampaigns();
}
function toggleSampaignPicked(uid, on) {
  var set = (window._sampaignPicked || []).slice();
  var i = set.indexOf(uid);
  if (on && i === -1) set.push(uid);
  if (!on && i !== -1) set.splice(i, 1);
  window._sampaignPicked = set;
  window._sampaignOwnerFilter = 'pick';
  _saveSampaignOwnerFilter();
  // Keep the menu open while ticking several people: re-render the list only.
  window._sampaignPeopleMenuOpen = true;
  loadSampaignCampaigns();
}
function toggleSampaignPeopleMenu(ev) {
  if (ev) ev.stopPropagation();
  window._sampaignPeopleMenuOpen = !window._sampaignPeopleMenuOpen;
  var m = document.getElementById('sampaignPeopleMenu');
  if (m) m.style.display = window._sampaignPeopleMenuOpen ? 'block' : 'none';
}
// A click anywhere outside the people menu closes it.
document.addEventListener('click', function (e) {
  if (!window._sampaignPeopleMenuOpen) return;
  var m = document.getElementById('sampaignPeopleMenu');
  var b = document.getElementById('sampaignPeopleBtn');
  if (m && (m.contains(e.target) || (b && b.contains(e.target)))) return;
  window._sampaignPeopleMenuOpen = false;
  if (m) m.style.display = 'none';
});
// Which owners the current filter admits. Shared by the list and its empty state.
function _sampaignOwnerAdmits(ownerId) {
  var f = window._sampaignOwnerFilter;
  if (f === 'mine') return !!currentUser && ownerId === currentUser.id;
  if (f === 'pick') return (window._sampaignPicked || []).indexOf(ownerId) !== -1;
  return true;
}

// The toolbar is rendered from the SERVER's owner roster, not from the
// campaigns on screen. If it were built from results, filtering to a rep with
// no campaigns in this view would remove them from the dropdown and strand
// the user on an empty list with no way back.
function _renderSampaignToolbar(d) {
  var host = document.getElementById('sampaignListToolbar');
  if (!host) return;
  var counts = d.counts || {};
  var owners = d.owners || [];
  var view = window._sampaignView;

  var tab = function(key, label, n) {
    var on = view === key;
    return '<button onclick="setSampaignView(\''+key+'\')" style="padding:5px 11px;border:none;border-bottom:2px solid '+(on?'var(--gold)':'transparent')+
      ';background:none;color:'+(on?'var(--text)':'var(--text3)')+';font-size:12px;font-weight:'+(on?'700':'500')+
      ';cursor:pointer;font-family:var(--sans)">'+label+(n != null ? ' <span style="color:var(--text3);font-weight:500">'+n+'</span>' : '')+'</button>';
  };

  var filter = '';
  // Only worth showing when there is more than one person in the org.
  if (owners.length > 1) {
    var f = window._sampaignOwnerFilter;
    var picked = window._sampaignPicked || [];
    var seg = function(key, label) {
      var on = f === key;
      return '<button onclick="setSampaignOwnerFilter(\''+key+'\')" style="padding:4px 10px;border:none;border-radius:var(--r-sm);background:'+(on?'var(--surface)':'transparent')+
        ';color:'+(on?'var(--text)':'var(--text3)')+';font-size:11px;font-weight:'+(on?'700':'500')+';cursor:pointer;font-family:var(--sans);'+(on?'box-shadow:0 0 0 1px var(--border2)':'')+'">'+label+'</button>';
    };
    var pickLabel = f === 'pick' ? 'People (' + picked.length + ')' : 'People';
    var menuRows = owners.map(function(o) {
      var lbl = (o.user_id === d.me) ? o.name + ' (me)' : o.name;
      var on = picked.indexOf(o.user_id) !== -1;
      return '<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:12px;color:var(--text);cursor:pointer;white-space:nowrap">' +
        '<input type="checkbox" '+(on?'checked ':'')+'onchange="toggleSampaignPicked(\''+esc(o.user_id)+'\', this.checked)" style="accent-color:var(--gold)">' +
        esc(lbl) + '</label>';
    }).join('');
    filter =
      '<div style="position:relative;display:flex;align-items:center;gap:2px;background:var(--surface2);border-radius:var(--r-md);padding:2px">' +
        seg('mine','Mine') + seg('all','Everyone') +
        '<button id="sampaignPeopleBtn" onclick="toggleSampaignPeopleMenu(event)" style="padding:4px 10px;border:none;border-radius:var(--r-sm);background:'+(f==='pick'?'var(--surface)':'transparent')+
          ';color:'+(f==='pick'?'var(--text)':'var(--text3)')+';font-size:11px;font-weight:'+(f==='pick'?'700':'500')+';cursor:pointer;font-family:var(--sans);'+(f==='pick'?'box-shadow:0 0 0 1px var(--border2)':'')+'">'+pickLabel+' ▾</button>' +
        '<div id="sampaignPeopleMenu" style="display:'+(window._sampaignPeopleMenuOpen?'block':'none')+';position:absolute;right:0;top:calc(100% + 4px);z-index:50;min-width:200px;max-height:280px;overflow-y:auto;background:var(--bg);border:1px solid var(--border2);border-radius:var(--r-md);box-shadow:0 10px 30px rgba(0,0,0,.18);padding:4px 0">' +
          menuRows +
        '</div>' +
      '</div>';
  }


  host.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid var(--border2);margin:4px 0 10px">' +
      '<div style="display:flex;gap:2px">' + tab('active','Active',counts.active) + tab('archived','Archived',counts.archived) + '</div>' +
      '<div style="padding-bottom:4px">' + filter + '</div>' +
    '</div>';
}

async function loadSampaignCampaigns() {
  var el = document.getElementById('sampaignCampaignsList');
  if (!el) return;
  var viewing = window._sampaignView;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'list_sampaigns', view: viewing, scope: 'org' }) });
    var d = await r.json();
    if (!d.ok) { el.innerHTML = '<div style="font-size:11px;color:var(--coral)">'+esc(d.error||'Failed to load')+'</div>'; return; }
    _renderSampaignToolbar(d);

    var all = d.campaigns || [];

    // Self-healing, per the standing rule that a backlog must never need
    // clearing by hand. Guarded twice on purpose:
    //   - only on the DEFAULT view, because the archived view is a list of
    //     dead campaigns and sweeping against it would delete the tasks of
    //     every LIVE one, and
    //   - only on d.ok, already checked above, so a failed request cannot
    //     present an empty list as "no campaigns exist".
    if (!viewing || viewing === 'active') {
      try {
        var swept = await _sweepOrphanFupTasks(all.map(function(c){ return c.id; }));
        if (swept) showToast('Cleared ' + swept + ' follow-up task' + (swept === 1 ? '' : 's') + ' from deleted SAMpaigns');
      } catch(e) {}
    }

    // Filtering client-side is deliberate: the roster and counts already came
    // back with the list, so switching person is instant and cannot produce a
    // stale count.
    if (window._sampaignOwnerFilter && window._sampaignOwnerFilter !== 'all') {
      all = all.filter(function(c) { return _sampaignOwnerAdmits(c.owner_user_id); });
    }
    d = Object.assign({}, d, { campaigns: all });

    if (!all.length) {
      // Honest empty states: "none in this view" is a different fact from
      // "none at all", and telling the user which one they are looking at is
      // the difference between a filter and a bug.
      var why = viewing === 'archived'
        ? (window._sampaignOwnerFilter === 'mine' ? 'You have nothing archived.' : window._sampaignOwnerFilter === 'pick' ? ((window._sampaignPicked || []).length ? 'Nothing archived for the people you picked.' : 'Nobody is ticked. Choose people from the People menu.') : 'Nothing archived. Deleted SAMpaigns appear here and can be restored.')
        : (window._sampaignOwnerFilter === 'mine' ? 'You have no active SAMpaigns. Create one above, or switch to Everyone to see what colleagues are running.' : window._sampaignOwnerFilter === 'pick' ? ((window._sampaignPicked || []).length ? 'No active SAMpaigns for the people you picked.' : 'Nobody is ticked. Choose people from the People menu.') : 'No manual SAMpaigns yet. Create one above, or use a connected sequencing tool for SAMpaign Analytics instead.');
      el.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:4px 0">'+esc(why)+'</div>';
      return;
    }
    // Cache full campaign objects (name/followup_dates/alerts_enabled) so the
    // edit form can prefill instantly without a second fetch.
    window._sampaignCampaignsCache = {};
    d.campaigns.forEach(function(c) { window._sampaignCampaignsCache[c.id] = c; });
    // ── Card layout mirrors the detail view: same headline number, same
    // meaning. Reply rate leads because it answers "is this working"; the
    // contact count is inventory and sits secondary. The previous card led
    // with the count and showed status pills only when non-zero, so cards
    // were inconsistent widths and told you nothing about performance.
    el.innerHTML = d.campaigns.map(function(c) {
      var s = c.stats || {};
      var isOwner = (typeof c.is_owner === 'boolean') ? c.is_owner : (c.owner_user_id === currentUser.id || !c.owner_user_id);
      var sent = s.sent || 0;
      var rate = sent > 0 ? Math.round(((s.replied || 0) / sent) * 100) : null;
      var rateCol = rate === null ? 'var(--text3)' : rate >= 12 ? 'var(--green)' : rate >= 7 ? 'var(--amber)' : 'var(--coral)';

      // Two campaigns can share a company name (one per quarter, per region,
      // per SDR). Without a second identifier they are indistinguishable in
      // the list, which was happening with the two TotalEnergies rows.
      var sub = [];
      // Focus leads: when three campaigns share an account name it is the
      // only thing that says which is which, so it goes before the counts.
      if (c.focus) sub.push('<strong style="color:var(--text2)">'+esc(c.focus)+'</strong>');
      sub.push((s.total || 0) + ' contact' + ((s.total || 0) !== 1 ? 's' : ''));
      if (c.owner_email) sub.push(esc(c.owner_email.split('@')[0]));
      // Said on the card, not discovered by clicking: a colleague's SAMpaign
      // opens read only, and the edit and delete buttons are simply absent.
      if (!isOwner) sub.push('<span style="color:var(--text3);font-style:italic">view only</span>');
      if (c.created_at) sub.push('from ' + new Date(c.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' }));

      // Fixed order, always the same slots, so the eye learns one position
      // per meaning instead of re-reading every card.
      var pill = function(n, label, color) {
        if (!n) return '';
        return '<span style="font-size:11px;font-weight:700;color:'+color+';background:rgba(128,128,128,0.10);border-radius:var(--r-sm);padding:2px 6px;white-space:nowrap">'+n+' '+label+'</span>';
      };
      var pills = [ pill(s.replied,'replied','var(--green)'), pill(s.ooo,'OOO','var(--amber)'),
                    pill(s.no_response,'no reply','var(--text3)'), pill(s.dead,'dead','var(--coral)') ].join('');

      // "F1 · 21 · due 10 Aug" needed decoding. Spelled out, and only the
      // single most urgent wave is shown — the rest are one click away.
      var next = (c.followup_schedule || []).slice().sort(function(a,b){ return String(a.next_due).localeCompare(String(b.next_due)); })[0];
      var nextChip = '';
      if (next) {
        var d2 = new Date(next.next_due);
        var lbl = isNaN(d2.getTime()) ? '' : d2.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
        var overdue = !isNaN(d2.getTime()) && d2 < new Date(new Date().toDateString());
        nextChip = '<span style="font-size:11px;color:'+(overdue?'var(--coral)':'var(--text3)')+'">' +
          (overdue ? 'Follow-up ' + next.stage + ' overdue since ' : 'Follow-up ' + next.stage + ' due ') + lbl +
          ' · ' + next.count + ' contact' + (next.count !== 1 ? 's' : '') + '</span>';
      }

      return '<div class="g-card" style="padding:14px 16px;margin-bottom:10px">' +
        '<div onclick="openSampaignDetail(\''+esc(c.id)+'\')" style="cursor:pointer">' +
          '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">' +
            '<div style="min-width:0;display:flex;align-items:baseline;gap:9px;flex-wrap:wrap">' +
              '<span style="font-size:14px;font-weight:700;color:var(--text)">'+esc(c.name)+'</span>' +
              (rate !== null
                ? '<span style="font-size:13px;font-weight:700;color:'+rateCol+'">'+rate+'%</span><span style="font-size:11px;color:var(--text3)">reply</span>'
                : '<span style="font-size:11px;color:var(--text3)">not sent yet</span>') +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:3px;flex-shrink:0">' +
              (viewing === 'archived'
                ? (isOwner ? '<button onclick="event.stopPropagation();restoreSampaignCampaign(\''+esc(c.id)+'\',\''+esc(c.name)+'\')" title="Restore SAMpaign" style="background:none;border:none;color:var(--green);font-size:11px;font-weight:700;cursor:pointer;padding:3px 7px;font-family:var(--sans)">Restore</button>' : '<span style="font-size:11px;color:var(--text3)">archived</span>')
                : '') +
              ((viewing !== 'archived' && isOwner) ? '<button onclick="event.stopPropagation();toggleEditSampaignForm(\''+esc(c.id)+'\')" title="Edit SAMpaign" style="background:none;border:none;color:var(--text3);font-size:13px;cursor:pointer;padding:3px 5px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3z"/></svg></button>' : '') +
              ((viewing !== 'archived' && isOwner) ? '<button onclick="event.stopPropagation();deleteSampaignCampaign(\''+esc(c.id)+'\',\''+esc(c.name)+'\')" title="Delete SAMpaign" style="background:none;border:none;color:var(--coral);font-size:13px;cursor:pointer;padding:3px 5px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 6.5h15M9 6.5V4h6v2.5M6.5 6.5V20h11V6.5M10 10v6M14 10v6"/></svg></button>' : '') +
              '<span title="Open" style="font-size:12px;color:var(--gold)">⤢</span>' +
            '</div>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:3px">'+sub.join(' · ')+'</div>' +
          (pills ? '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px">'+pills+'</div>' : '') +
          (nextChip ? '<div style="margin-top:6px">'+nextChip+'</div>' : '') +
        '</div>' +
        '<div id="sampaignEdit_'+esc(c.id)+'" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border2)"></div>' +
      '</div>';
    }).join('');
  } catch(e) { el.innerHTML = '<div style="font-size:11px;color:var(--coral)">Error: '+esc(e.message)+'</div>'; }
}

// Restore an archived SAMpaign. Says plainly what does NOT come back:
// archiving cancelled the queued sends and cleared the follow-up dates, and
// silently re-arming a month-old queue would email people about a campaign
// they were dropped from.
async function restoreSampaignCampaign(campaignId, name) {
  if (!confirm('Restore "' + name + '"?\n\nIt returns to Active. Follow-ups and queued emails were cancelled when it was deleted and will NOT be rescheduled automatically.')) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'restore_sampaign', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not restore SAMpaign')); return; }
    showToast('SAMpaign restored to Active');
    loadSampaignCampaigns();
  } catch(e) { showToast('Error: '+e.message); }
}

// ── Edit SAMpaign: name / follow-up cadence / alert toggles. Domain/account
// linkage is deliberately not editable here — that is a structural decision,
// recreate the campaign if it needs to change.
function toggleEditSampaignForm(campaignId) {
  var box = document.getElementById('sampaignEdit_'+campaignId);
  if (!box) return;
  if (box.style.display === 'none') {
    var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
    var a = c.alerts_enabled || {};
    box.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<input id="editSampaignName_'+esc(campaignId)+'" value="'+esc(c.name||'')+'" placeholder="Campaign name" style="padding:7px 10px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
        '<textarea id="editSampaignGoal_'+esc(campaignId)+'" rows="2" placeholder="Campaign goal / ask, what are you pitching, what do you want them to do?" style="padding:7px 10px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px;resize:vertical;height:46px">'+esc(c.campaign_goal||'')+'</textarea>' +
        '<input id="editSampaignFocus_'+esc(campaignId)+'" maxlength="48" value="'+esc(c.focus||'')+'" placeholder="Focus (e.g. RTM leadership)" style="padding:7px 10px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
        '<div style="font-size:11px;color:var(--text3)">Follow-up schedule, moving a date moves its task too</div>' +
        _fupEditorHtml(campaignId, c.followup_dates || []) +
        '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--text2)">' +
          '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="editSampaignAlertOoo_'+esc(campaignId)+'" '+(a.ooo?'checked':'')+'/> OOO</label>' +
          '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="editSampaignAlertReplied_'+esc(campaignId)+'" '+(a.replied?'checked':'')+'/> Replied</label>' +
          '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="editSampaignAlertNoResp_'+esc(campaignId)+'" '+(a.no_response?'checked':'')+'/> No response</label>' +
          '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="editSampaignAlertDead_'+esc(campaignId)+'" '+(a.dead?'checked':'')+'/> Dead</label>' +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button onclick="saveSampaignEdit(\''+esc(campaignId)+'\')" style="flex:1;padding:7px;border-radius:var(--r-sm);background:var(--gold);border:none;color:#fff;font-size:12px;font-weight:600;cursor:pointer">Save changes</button>' +
          '<button onclick="toggleEditSampaignForm(\''+esc(campaignId)+'\')" style="padding:7px 12px;border-radius:var(--r-sm);background:none;border:1px solid var(--border2);color:var(--text3);font-size:12px;cursor:pointer">Cancel</button>' +
        '</div>' +
      '</div>';
    box.style.display = 'block';
    _fupRender(campaignId);
  } else {
    box.style.display = 'none';
  }
}

async function saveSampaignEdit(campaignId) {
  var name = document.getElementById('editSampaignName_'+campaignId)?.value?.trim();
  var campaignGoal = document.getElementById('editSampaignGoal_'+campaignId)?.value ?? '';
  var cachedC = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var oldDates = (cachedC.followup_dates || []).map(function(d){ return String(d).slice(0,10); });
  var followup_dates = (window._fupState[campaignId] || []).slice();
  var alerts_enabled = {
    ooo: !!document.getElementById('editSampaignAlertOoo_'+campaignId)?.checked,
    replied: !!document.getElementById('editSampaignAlertReplied_'+campaignId)?.checked,
    no_response: !!document.getElementById('editSampaignAlertNoResp_'+campaignId)?.checked,
    dead: !!document.getElementById('editSampaignAlertDead_'+campaignId)?.checked
  };
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'update_sampaign', campaign_id: campaignId, name: name, campaign_goal: campaignGoal, focus: (document.getElementById('editSampaignFocus_'+campaignId)?.value||'').trim(), followup_dates: followup_dates, alerts_enabled: alerts_enabled }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not update SAMpaign')); return; }
    var moved = await _syncSampaignFupTasks(campaignId, name || cachedC.name, oldDates, followup_dates);
 showToast('SAMpaign updated' + (moved ? ' · ' + moved + ' task' + (moved!==1?'s':'') + ' rescheduled' : ''));
    loadSampaignCampaigns();
  } catch(e) { showToast('Error: '+e.message); }
}

// Soft delete (archive) — reversible, matches existing codebase convention
// of a native confirm() for destructive actions (see e.g. "Remove this
// account?", "Disconnect provider?").
async function deleteSampaignCampaign(campaignId, name) {
  if (!confirm('Delete "'+name+'" and hide all its contacts? This can be undone by an admin, but not from here.')) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'archive_sampaign', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not delete SAMpaign')); return; }
    // Report what was actually disarmed. A rep deleting a campaign with 40
    // queued emails should see that they were cancelled, not a bare "deleted".
    var stopped = [];
    if (d.cancelled_sends) stopped.push(d.cancelled_sends + ' queued email' + (d.cancelled_sends === 1 ? '' : 's'));
    if (d.cleared_followups) stopped.push(d.cleared_followups + ' follow-up' + (d.cleared_followups === 1 ? '' : 's'));
    // The tasks this campaign created are work it was asking for. Cancel the
    // campaign, cancel the ask.
    var clearedTasks = 0;
    try { clearedTasks = await _purgeSampaignFupTasks(campaignId); } catch(e) {}
    if (clearedTasks) stopped.push(clearedTasks + ' follow-up task' + (clearedTasks === 1 ? '' : 's'));
    showToast(stopped.length ? 'SAMpaign archived, ' + stopped.join(' and ') + ' cancelled' : 'SAMpaign archived');
    loadSampaignCampaigns();
    if (typeof render === 'function') { try { render(); } catch(e) {} }
  } catch(e) { showToast('Error: '+e.message); }
}

// Fetches + caches + renders one campaign's contact roster into whatever
// div#sampaignContacts_{campaignId} currently exists in the DOM — agnostic
// to where that div lives (inline in a card, or inside the detail overlay
// below), same "just target the id" pattern _renderSampaignContacts already
// uses. Shared by openSampaignDetail (initial load) and anywhere else that
// needs a post-mutation refresh (CSV upload, scout, enrich).
async function _loadSampaignContactsIntoOld(campaignId) {
  var box = document.getElementById('sampaignContacts_'+campaignId);
  if (!box) return;
  box.innerHTML = '<div style="font-size:11px;color:var(--text3)">Loading contacts…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'list_sampaign_contacts', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) { box.innerHTML = '<div style="font-size:11px;color:var(--coral)">'+esc(d.error||'Failed')+'</div>'; return; }
    window._sampaignContactsCache[campaignId] = d.contacts || [];
    _renderSampaignContacts(campaignId);
  } catch(e) { box.innerHTML = '<div style="font-size:11px;color:var(--coral)">Error: '+esc(e.message)+'</div>'; }
}

// ── SAMpaign detail — full-screen overlay ───────────────────────────────────
// Clicking a campaign card used to expand its contact roster inline, which
// got cluttered fast on a list of several campaigns each with dozens of
// contacts. Now it opens a single dedicated overlay instead: campaign
// header, this campaign's own performance analytics (scoped
// get_manual_sampaign_stats call, same renderer used for the org-wide
// SAMpaign Analytics view), the follow-up schedule in full, then the
// existing contact roster (Active/Prospective tabs, scout, enrich, CSV
// upload — all unchanged, just relocated). Same bottom-sheet modal
// convention as openSampaignContactInsight (spc-insight-modal) for visual
// consistency with the rest of the app.
// True only when the signed-in user owns this campaign. Mutating actions
// (sync, upload, scout, enrich, promote) are all owner-only on the backend;
// managers get read visibility. Compares on email because list_sampaigns
// returns owner_email, not owner_user_id.
function _isSampaignOwner(c) {
  if (!c) return false;
  // The server now says so directly. The email comparison below remains for
  // cached objects from an older response.
  if (typeof c.is_owner === 'boolean') return c.is_owner;
  var me = ((typeof currentUser !== 'undefined' && currentUser && currentUser.email) || '').toLowerCase();
  if (!me) return false;
  if (!c.owner_email) return true;   // single-owner view, nothing to contradict
  return String(c.owner_email).toLowerCase() === me;
}

// ═══════════════════════════════════════════════════════════════════════════
// SAMpaign detail — restructured after Kite's instrument view.
//
// The old overlay was one long scroll: performance, follow-up schedule,
// trend, contacts, add-people, drafts and queue all stacked. Everything was
// visible, so nothing was prominent, and the two things a rep actually needs
// on opening ("is this working?" and "is anything waiting on me?") were
// buried among the things they rarely touch.
//
// Three ideas taken from Kite:
//   1. ONE headline number. Kite leads with price and change; a campaign's
//      equivalent is reply rate against benchmark. Contact count is inventory,
//      not performance, so it moves to the right as secondary.
//   2. A divided metric strip, label above value, thin rules between — the
//      PE / P/B row. Scannable without reading.
//   3. Everything else behind tabs, so the default view is small.
// ═══════════════════════════════════════════════════════════════════════════
window._sampTab = 'overview';

async function openSampaignDetail(campaignId) {
  document.getElementById('sampaign-detail-overlay')?.remove();
  // Fresh overlay starts unfiltered and on Overview — a filter or tab left
  // over from the last campaign would silently hide most of this one.
  window._sampaignStatusFilter = null;
  window._sampTab = 'overview';
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var isOwner = _isSampaignOwner(c);

  var modal = document.createElement('div');
  modal.id = 'sampaign-detail-overlay';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);z-index:99999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML =
    '<div style="background:var(--bg);border-radius:3px 18px 0 0;width:100%;max-width:720px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -10px 50px rgba(0,0,0,0.35)" onclick="event.stopPropagation()">' +
      // ── Header: fixed, never scrolls away ──
      '<div style="padding:18px 20px 0;flex-shrink:0">' +
        '<div id="sampHeader_'+esc(campaignId)+'"></div>' +
        '<div id="sampTabs_'+esc(campaignId)+'" style="display:flex;gap:20px;margin-top:14px;border-bottom:1px solid var(--border)"></div>' +
      '</div>' +
      // ── Body: the only scrolling region ──
      '<div id="sampBody_'+esc(campaignId)+'" style="flex:1;overflow-y:auto;padding:16px 20px 20px;min-height:180px">' +
        '<div style="font-size:11px;color:var(--text3)">Loading…</div>' +
      '</div>' +
      // ── Footer: actions always reachable, never scrolled past ──
      '<div style="flex-shrink:0;display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--border);background:var(--surface2)">' +
        (isOwner
          ? '<button id="sampaignSyncBtn_'+esc(campaignId)+'" onclick="syncSampaignCampaign(\''+esc(campaignId)+'\')" style="font-size:12px;font-weight:600;color:var(--gold);padding:8px 16px;border-radius:var(--r-sm);background:transparent;border:1px solid rgba(var(--c-accent-rgb),0.4);cursor:pointer;font-family:var(--sans)">Refresh</button>' +
            '<button onclick="openSampaignComposer(\''+esc(campaignId)+'\')" style="font-size:12px;font-weight:600;color:#fff;padding:8px 16px;border-radius:var(--r-sm);background:var(--green);border:none;cursor:pointer;font-family:var(--sans)">Schedule</button>'
          : '<span style="font-size:11px;color:var(--text3);align-self:center;margin-right:auto">Syncs from '+esc((c.owner_email||'the owner').split('@')[0])+'’s inbox, hourly</span>') +
        '<button onclick="document.getElementById(\'sampaign-detail-overlay\').remove()" style="font-size:12px;font-weight:600;color:var(--text3);padding:8px 16px;border-radius:var(--r-sm);background:transparent;border:1px solid var(--border2);cursor:pointer;font-family:var(--sans)">Close</button>' +
      '</div>' +
    '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);

  // Must go through setSampTab rather than calling the loader directly: the
  // body starts as a placeholder, and it is setSampTab that creates the
  // containers each loader writes into. Calling _loadSampaignDetailPerf here
  // would target a #sampaignDetailPerf that does not exist yet, silently do
  // nothing, and leave the panel on "Loading…" forever.
  setSampTab(campaignId, 'overview');
  // Fetched once in the background so the Queue tab's badge is accurate
  // before anyone opens that tab.
  _primeSampDraftCount(campaignId);
}

// Badge-only fetch. Deliberately does not render anything — it exists so the
// tab strip can say "6" without the rep having to go looking.
async function _primeSampDraftCount(campaignId) {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'list_sampaign_scheduled_sends', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) return;
    window._sampDraftCount = window._sampDraftCount || {};
    window._sampDraftCount[campaignId] = (d.summary && d.summary.draft) || 0;
    _renderSampTabs(campaignId);
  } catch(e) { /* badge is a nicety, never block the overlay on it */ }
}

function _sampTabDefs(campaignId) {
  var pending = (window._sampDraftCount || {})[campaignId] || 0;
  return [
    { key: 'overview', label: 'Overview' },
    { key: 'contacts', label: 'Contacts' },
    // The badge is the point: the one tab that may be waiting on a decision
    // says so without being opened.
    { key: 'queue',    label: 'Launches', badge: pending },
    { key: 'trend',    label: 'Trend' }
  ];
}

function _renderSampTabs(campaignId) {
  var el = document.getElementById('sampTabs_' + campaignId);
  if (!el) return;
  el.innerHTML = _sampTabDefs(campaignId).map(function(t) {
    var on = window._sampTab === t.key;
    return '<span onclick="setSampTab(\''+esc(campaignId)+'\',\''+t.key+'\')" ' +
      'style="font-size:13px;font-weight:'+(on?'700':'500')+';padding-bottom:9px;cursor:pointer;white-space:nowrap;' +
        'border-bottom:2px solid '+(on?'var(--gold)':'transparent')+';color:'+(on?'var(--text)':'var(--text3)')+'">' +
      esc(t.label) +
      (t.badge ? '<span style="font-size:11px;font-weight:700;background:rgba(var(--c-accent-rgb),0.16);color:var(--gold);border-radius:var(--r-sm);padding:1px 6px;margin-left:5px">'+t.badge+'</span>' : '') +
    '</span>';
  }).join('');
}

function setSampTab(campaignId, tab) {
  window._sampTab = tab;
  _renderSampTabs(campaignId);
  var body = document.getElementById('sampBody_' + campaignId);
  if (!body) return;
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};

  if (tab === 'overview') {
    body.innerHTML = '<div id="sampaignDetailPerf"></div><div id="sampaignDetailSchedule"></div>';
    _loadSampaignDetailPerf(campaignId, c);
  } else if (tab === 'contacts') {
    body.innerHTML = '<div id="sampaignContacts_'+esc(campaignId)+'"><div style="font-size:11px;color:var(--text3)">Loading contacts…</div></div>' +
                     '<div id="sampaignAddRows_'+esc(campaignId)+'"></div>';
    _loadSampaignContactsInto(campaignId);
  } else if (tab === 'queue') {
    body.innerHTML = '<div id="sampSendQueue"><div style="font-size:11px;color:var(--text3)">Loading queue…</div></div>';
    loadSampaignSendQueue(campaignId);
  } else if (tab === 'trend') {
    body.innerHTML = '<div id="sampaignDetailTrend"><div style="font-size:11px;color:var(--text3)">Loading…</div></div>';
    _loadSampaignTrend(campaignId);
  }
}

// Header: one headline number, everything else secondary.
function _renderSampHeader(campaignId, d) {
  var el = document.getElementById('sampHeader_' + campaignId);
  if (!el) return;
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var s = (d && d.org_summary) || {};
  var bm = (d && d.benchmarks) || { reply_rate: { good: 12, avg: 7 } };
  var rate = s.reply_rate || 0;
  var good = bm.reply_rate.good, avg = bm.reply_rate.avg;
  var col = rate >= good ? 'var(--green)' : rate >= avg ? 'var(--amber)' : 'var(--coral)';
  var verdict = rate >= good ? 'above benchmark' : rate >= avg ? 'around average' : 'below benchmark';

  el.innerHTML =
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">' +
      '<div style="min-width:0">' +
        '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">' +
          '<span style="font-size:16px;font-weight:700;color:var(--text)">'+esc(c.name||'SAMpaign')+'</span>' +
          '<span style="color:var(--border2)">|</span>' +
          '<span style="font-size:16px;font-weight:700;color:'+col+'">'+rate+'%</span>' +
          '<span style="font-size:11px;color:'+col+'">'+verdict+' (reply rate)</span>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+
          (c.focus ? '<strong style="color:var(--text2)">'+esc(c.focus)+'</strong> · ' : '')+
          esc((c.owner_email||'').split('@')[0]||'')+
          (c.created_at ? ' · started '+new Date(c.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '')+
        '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0">' +
        '<div style="font-size:16px;font-weight:700;color:var(--text)">'+(s.total_prospects||0)+'</div>' +
        '<div style="font-size:11px;color:var(--text3)">contacts</div>' +
      '</div>' +
    '</div>';
}

// Period selector, Kite's YTD/1M/1Y row. Days, not labels, so the filter is
// a simple slice.
window._sampTrendDays = 30;
function setSampTrendPeriod(campaignId, days) {
  window._sampTrendDays = days;
  _loadSampaignTrend(campaignId);
}

// Performance over time, from the nightly snapshots. Live counts can only say
// where a campaign IS; only stored history says whether it is improving,
// which is the question worth acting on. A line drawn through one point is a
// fiction, so below two snapshots this says so plainly rather than drawing
// something meaningless or rendering nothing and looking broken.
async function _loadSampaignTrend(campaignId) {
  var box = document.getElementById('sampaignDetailTrend');
  if (!box) return;
  var periods = [ { d: 7, l: '7D' }, { d: 30, l: '30D' }, { d: 3650, l: 'All' } ];
  var picker = '<div style="display:flex;gap:16px;margin-bottom:12px">' +
    periods.map(function(p) {
      var on = window._sampTrendDays === p.d;
      return '<span onclick="setSampTrendPeriod(\''+esc(campaignId)+'\','+p.d+')" style="font-size:12px;font-weight:'+(on?'700':'500')+';color:'+(on?'var(--gold)':'var(--text3)')+';cursor:pointer;border-bottom:2px solid '+(on?'var(--gold)':'transparent')+';padding-bottom:3px">'+p.l+'</span>';
    }).join('') + '</div>';

  try {
    var r = await fetch(SB_URL + '/rest/v1/sampaign_perf_snapshots?campaign_id=eq.' + campaignId + '&select=snapshot_date,total,sent,replied,ooo,dead,no_response&order=snapshot_date.asc&limit=400', {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token }
    });
    var all = await r.json();
    if (!Array.isArray(all)) all = [];
    var cutoff = new Date(Date.now() - window._sampTrendDays * 86400000).toISOString().slice(0, 10);
    var rows = all.filter(function(x){ return String(x.snapshot_date) >= cutoff; });

    if (rows.length < 2) {
      // Explains itself instead of being an empty tab. The nightly job is the
      // thing being waited on, so name it and say when.
      box.innerHTML = picker +
        '<div style="text-align:center;padding:26px 16px;border:1px dashed var(--border2);border-radius:var(--r-md)">' +
          '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:5px">History starts building tonight</div>' +
          '<div style="font-size:11px;color:var(--text3);line-height:1.55">A snapshot of this campaign is recorded once a day, so the first line appears after two nights.' +
          (all.length === 1 ? '<br>One day recorded so far.' : '') + '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:9px">Live numbers are on Overview in the meantime.</div>' +
        '</div>';
      return;
    }

    var maxV = Math.max.apply(null, rows.map(function(x){ return x.total || 0; })) || 1;
    var W = 100, H = 34;
    var line = function(key, col) {
      var pts = rows.map(function(x, i) {
        var px = rows.length > 1 ? (i / (rows.length - 1)) * W : 0;
        var py = H - ((x[key] || 0) / maxV) * H;
        return px.toFixed(1) + ',' + py.toFixed(1);
      }).join(' ');
      return '<polyline points="'+pts+'" fill="none" stroke="'+col+'" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
    };
    var last = rows[rows.length - 1], first = rows[0];
    var delta = function(k) {
      var v = (last[k]||0) - (first[k]||0);
      return v === 0 ? '' : (v > 0 ? ' +' + v : ' ' + v);
    };

    box.innerHTML = picker + '<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r-md);padding:11px;margin-bottom:8px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg> Trend</span>' +
        '<span style="font-size:11px;color:var(--text3)">'+rows.length+' days · '+esc(String(first.snapshot_date).slice(5))+' to '+esc(String(last.snapshot_date).slice(5))+'</span>' +
      '</div>' +
      '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;height:44px;display:block">' +
        line('sent', 'var(--blue)') + line('replied', 'var(--green)') + line('dead', 'var(--coral)') +
      '</svg>' +
      '<div style="display:flex;gap:12px;margin-top:5px;flex-wrap:wrap">' +
        '<span style="font-size:11px;color:var(--blue)">■ Sent '+(last.sent||0)+esc(delta('sent'))+'</span>' +
        '<span style="font-size:11px;color:var(--green)">■ Replied '+(last.replied||0)+esc(delta('replied'))+'</span>' +
        '<span style="font-size:11px;color:var(--coral)">■ Dead '+(last.dead||0)+esc(delta('dead'))+'</span>' +
      '</div>' +
    '</div>';
  } catch(e) { box.innerHTML = ''; }
}

// Shared by openSampaignDetail (initial load) and syncSampaignCampaign (post-sync
// refresh) so both paths render performance + follow-up schedule identically.
async function _loadSampaignDetailPerf(campaignId, c) {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'get_manual_sampaign_stats', campaign_id: campaignId }) });
    var d = await r.json();
    // The header always updates, even when the body is showing another tab —
    // the headline number should never go stale behind a tab switch.
    _renderSampHeader(campaignId, d);

    var perfBox = document.getElementById('sampaignDetailPerf');
    if (perfBox) {
      if (d.ok && d.org_summary && d.org_summary.total_prospects > 0) {
        perfBox.innerHTML = _sampGoalBlock(campaignId) + _sampMetricStrip(d, campaignId) + _sampHotSignals(d);
      } else if (!d.ok) {
        perfBox.innerHTML = '<div style="font-size:11px;color:var(--coral)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> '+esc(d.error||'Could not load performance')+'</div>';
      } else {
        // Goal shows here too. A brand-new campaign is exactly when someone
        // is about to write copy against it, so hiding it on the empty state
        // would remove it at the moment it is most needed.
        perfBox.innerHTML = _sampGoalBlock(campaignId) +
          '<div style="font-size:12px;color:var(--text3);padding:14px 0;text-align:center">Nothing has happened yet.<br><span style="font-size:11px">Add contacts, then Schedule or Refresh.</span></div>';
      }
    }
    var schedBox = document.getElementById('sampaignDetailSchedule');
    if (schedBox && c && c.followup_schedule && c.followup_schedule.length) {
      var fmt = function(iso) { var dt = new Date(iso); return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-GB', { day:'numeric', month:'short' }); };
      schedBox.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:8px 0 6px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Follow-up schedule</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
        c.followup_schedule.map(function(fs) {
          var overdue = new Date(fs.next_due) < new Date(new Date().toDateString());
          return '<span style="font-size:11px;font-weight:600;color:'+(overdue?'var(--coral)':'var(--gold)')+';background:'+(overdue?'rgba(196,90,74,0.1)':'rgba(var(--c-accent-rgb),0.1)')+';border:1px solid '+(overdue?'rgba(196,90,74,0.25)':'rgba(var(--c-accent-rgb),0.25)')+';border-radius:var(--r-sm);padding:5px 10px">Follow-up '+fs.stage+', '+fs.count+' contact'+(fs.count!==1?'s':'')+', '+(overdue?'overdue since':'scheduled')+' '+fmt(fs.next_due)+'</span>';
        }).join('') +
        '</div>';
    }
  } catch(e) {
    var perfBox2 = document.getElementById('sampaignDetailPerf');
    if (perfBox2) perfBox2.innerHTML = '<div style="font-size:11px;color:var(--coral)">Error: '+esc(e.message)+'</div>';
  }
}

// The campaign goal, restored to Overview. It used to live in the header
// subtitle and was lost in the tab rebuild — which mattered more than it
// looks: the goal is what every AI-written email is generated against, so a
// rep reviewing drafts needs to see what they were supposed to be aiming at.
// Long goals are clamped with a Read more rather than pushed off screen,
// since these are often a paragraph pasted from a brief.
window._sampGoalOpen = false;
function toggleSampGoal(campaignId) {
  window._sampGoalOpen = !window._sampGoalOpen;
  var el = document.getElementById('sampGoalText');
  var lnk = document.getElementById('sampGoalMore');
  if (!el) return;
  if (window._sampGoalOpen) {
    el.style.webkitLineClamp = 'unset'; el.style.display = 'block';
    if (lnk) lnk.textContent = 'Show less';
  } else {
    el.style.display = '-webkit-box'; el.style.webkitLineClamp = '2';
    if (lnk) lnk.textContent = 'Read more';
  }
}
function _sampGoalBlock(campaignId) {
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var goal = (c.campaign_goal || '').trim();
  if (!goal) {
    // Names the two ways to fix it, including the one the user is most likely
    // already in. A campaign written through Claude arrives with no goal, and
    // telling that person to go and find a pencil is the wrong instruction:
    // the assistant can set it from the conversation it just had.
    return '<div style="font-size:11px;color:var(--text3);margin-bottom:12px">' +
      'No goal set. Every email is written against it, so outreach here will read generic. ' +
      'Ask Claude to set the campaign goal, or add one with the pencil on the campaign.</div>';
  }
  var long = goal.length > 150;
  return '<div style="margin-bottom:14px">' +
    '<div id="sampGoalText" style="font-size:12px;color:var(--text2);line-height:1.6;' +
      (long ? 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden' : '') + '">' +
      esc(goal) + '</div>' +
    (long ? '<span id="sampGoalMore" onclick="toggleSampGoal(\''+esc(campaignId)+'\')" style="font-size:11px;font-weight:600;color:var(--gold);cursor:pointer">Read more</span>' : '') +
  '</div>';
}

// Kite's PE / Sector PE / P/B row: label above, value below, hairline rules
// between. Clickable, so each cell is also the filter for that bucket — the
// number and the way to see what it is made of are the same control.
function _sampMetricStrip(d, campaignId) {
  var s = d.org_summary || {};
  var bm = d.benchmarks || { reply_rate: { good: 12 } };
  var cells = [
    { label: 'Sent',    val: s.sent || 0,        filter: 'sent' },
    { label: 'Opened',  val: s.opened || 0,      filter: 'opened' },
    { label: 'Replied', val: s.replied || 0,     filter: 'replied', color: 'var(--green)' },
    { label: 'OOO',     val: s.ooo || 0,         filter: 'ooo',     color: 'var(--amber)' },
    { label: 'No reply',val: s.no_response || 0, filter: 'no_response' },
    { label: 'Dead',    val: s.bounced || 0,     filter: 'dead',    color: 'var(--coral)' }
  ];
  var rate = s.reply_rate || 0, good = bm.reply_rate.good || 12;
  // Marker position is clamped so an unusually good campaign pins at the end
  // rather than running off the bar.
  var pos = Math.max(0, Math.min(100, (rate / good) * 100));

  var html = '<div style="display:flex;border-top:1px solid var(--border);border-bottom:1px solid var(--border);flex-wrap:wrap">';
  cells.forEach(function(c, i) {
    if (i) html += '<div style="width:1px;background:var(--border)"></div>';
    html += '<div onclick="setSampTab(\''+esc(campaignId)+'\',\'contacts\');setSampaignStatusFilter(\''+esc(campaignId)+'\',\''+c.filter+'\')" ' +
      'style="flex:1;min-width:62px;padding:11px 10px;cursor:pointer" title="Show these contacts">' +
      '<div style="font-size:11px;color:var(--text3)">'+c.label+'</div>' +
      '<div style="font-size:16px;font-weight:700;color:'+(c.val?(c.color||'var(--text)'):'var(--text3)')+';margin-top:2px">'+c.val+'</div>' +
    '</div>';
  });
  html += '</div>';

  // The 52-week-range analogue: where this campaign's reply rate sits between
  // nothing and a genuinely good result. Answers "am I doing well" without
  // needing to know what a good reply rate is.
  html += '<div style="padding:12px 2px 4px">' +
    '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3)">' +
      '<span>0%</span><span>reply rate vs industry</span><span>'+good+'%</span>' +
    '</div>' +
    '<div style="height:5px;border-radius:var(--r-sm);margin-top:6px;background:linear-gradient(90deg,var(--coral),var(--amber),var(--green))"></div>' +
    '<div style="position:relative;height:12px">' +
      '<span style="position:absolute;left:'+pos.toFixed(1)+'%;transform:translateX(-50%);font-size:11px;color:var(--text)">▲</span>' +
    '</div>' +
  '</div>';
  return html;
}

// Replied prospects, kept on Overview because it is the one thing that should
// interrupt whatever else the rep was about to do.
function _sampHotSignals(d) {
  var hot = d.hot_signals || [];
  if (!hot.length) return '';
  return '<div style="margin-top:14px;border:1px solid rgba(74,140,92,0.3);background:rgba(74,140,92,0.07);border-radius:var(--r-md);padding:12px 14px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">Replied · act now</div>' +
    hot.map(function(h) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 0">' +
        '<div style="min-width:0">' +
          '<div style="font-size:13px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:5px">' +
            esc(h.prospect_name||h.prospect_email||'Unknown') + _sampaignLinkedInIcon(h.linkedin_url, h.prospect_name||h.prospect_email) +
          '</div>' +
          '<div style="font-size:11px;color:var(--text3)">'+(h.prospect_title?esc(h.prospect_title)+' · ':'')+esc(h.prospect_company||'')+'</div>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

// Turns a sync response into "3 sent, 1 replied, 2 OOO" style text.
function _sampaignSyncSummary(d) {
  var parts = [];
  if (d.sent_detected) parts.push(d.sent_detected + ' sent');
  if (d.replied_detected) parts.push(d.replied_detected + ' replied');
  if (d.ooo_auto_detected) parts.push(d.ooo_auto_detected + ' OOO');
  if (d.bounced_detected) parts.push(d.bounced_detected + ' bounced');
  return parts.join(', ');
}

// Manual inbox sync for ONE campaign — scans the rep's own Gmail for this
// campaign's contacts (sent/replied/OOO/bounced) and re-buckets them right
// now, rather than waiting for the hourly pass. Runs under the rep's own
// login against only their own mailbox (see sync_sampaigns_patch.ts).
async function syncSampaignCampaign(campaignId) {
  var btn = document.getElementById('sampaignSyncBtn_'+campaignId);
 if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = 'Refreshing…'; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'sync_sampaigns', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) {
 showToast('' + (d.error || 'Sync failed'));
    } else {
      var summary = _sampaignSyncSummary(d);
 showToast(summary ? 'Refreshed: ' + summary : '' + (d.note || 'Up to date, nothing new.'));
      var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
      _loadSampaignDetailPerf(campaignId, c);
      _loadSampaignContactsInto(campaignId);
      // Refresh the list behind the panel too. The button reads "Refresh" now,
      // so it should refresh the SAMpaigns, not just the one open in front of
      // you: reply counts and stage changes land on the cards as well.
      try { loadSampaignCampaigns(); } catch(e) {}
    }
  } catch(e) {
 showToast('Sync error: ' + e.message);
  } finally {
 if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Refresh'; }
  }
}

// Background sync across ALL of this rep's active SAMpaigns. Same idea as
// autoCompleteTasks(silent): runs quietly on a timer, reads only the signed-in
// user's own mailbox, and stays silent when nothing changed so it never nags.
// Only speaks up (a toast) when it actually re-bucketed something, and only
// refreshes visible UI if the relevant panel happens to be open.
var _sampaignSyncBusy = false;
async function syncSampaignsQuiet() {
  if (_sampaignSyncBusy) return;
  if (typeof currentUser === 'undefined' || !currentUser || !currentUser.token) return;
  _sampaignSyncBusy = true;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'sync_sampaigns' }) });
    var d = await r.json();
    // No Gmail connected / no campaigns yet are normal states, not errors
    // worth interrupting anyone over — stay silent.
    if (!d.ok) return;
    var summary = _sampaignSyncSummary(d);
    if (!summary) return;
 showToast('SAMpaign sync: ' + summary);
    // Refresh whatever's on screen, if anything.
    try { if (typeof _sampRefreshOpen === 'function') _sampRefreshOpen(); } catch(e) {}
    var overlay = document.getElementById('sampaign-detail-overlay');
    if (overlay) {
      var openId = (overlay.querySelector('[id^="sampaignContacts_"]') || {}).id || '';
      var cid = openId.replace('sampaignContacts_', '');
      if (cid) {
        var c = (window._sampaignCampaignsCache || {})[cid] || {};
        _loadSampaignDetailPerf(cid, c);
        _loadSampaignContactsInto(cid);
      }
    }
    if (typeof loadSampaignCampaigns === 'function' && document.getElementById('sampaignCampaignsList')) {
      try { loadSampaignCampaigns(); } catch(e) {}
    }
  } catch(e) { /* non-fatal, try again next tick */ }
  finally { _sampaignSyncBusy = false; }
}

// Active/Prospective split mirrors the account Stakeholders tab's existing
// _stkTab pattern (not_contacted = prospective, everything else = active) —
// one shared global tab var is fine since only one campaign's panel is ever
// expanded at a time, same assumption _stkTab already makes.
var _sampaignContactTab = 'active';
function setSampaignContactTab(campaignId, tab) {
  _sampaignContactTab = tab;
  _renderSampaignContacts(campaignId);
}

function _renderSampaignContactsOld(campaignId) {
  var box = document.getElementById('sampaignContacts_'+campaignId);
  if (!box) return;
  var all = window._sampaignContactsCache[campaignId] || [];
  var active = all.filter(function(c){ return c.status !== 'not_contacted'; });
  var prospective = all.filter(function(c){ return c.status === 'not_contacted'; });
  // Tile-driven status filter wins over the tab split when one is set.
  // Note "Sent" on the tiles counts everything that left the mailbox
  // (sent/opened/replied/ooo/no_response/dead), matching how the backend
  // computes it, so clicking that tile must not narrow to status==='sent'
  // alone or the count on the tile wouldn't match the list underneath.
  var statusFilter = window._sampaignStatusFilter || null;
  var contacts;
  if (statusFilter === 'sent') {
    contacts = all.filter(function(c){ return c.status !== 'not_contacted'; });
  } else if (statusFilter === 'opened') {
    contacts = all.filter(function(c){ return c.status === 'opened' || c.status === 'replied'; });
  } else if (statusFilter) {
    contacts = all.filter(function(c){ return c.status === statusFilter; });
  } else {
    contacts = _sampaignContactTab === 'prospective' ? prospective : active;
  }
  var STATUS_META = {
    not_contacted: { label:'Not contacted', color:'var(--text3)' },
    sent:          { label:'Sent',          color:'var(--blue)' },
    opened:        { label:'Opened',        color:'var(--amber)' },
    replied:       { label:'Replied',       color:'var(--green)' },
    ooo:           { label:'OOO',           color:'var(--amber)' },
    no_response:   { label:'No response',   color:'var(--text3)' },
    dead:          { label:'Dead',          color:'var(--coral)' },
    opted_out:     { label:'Opted out',     color:'var(--text3)' }
  };
  // Counts as "needs enrichment" if never touched OR touched but still has
  // no LinkedIn/outreach note (e.g. ran before those fields existed, or the
  // provider missed) — matches the backend's own retry filter exactly, so
  // the button doesn't permanently disappear after one attempt.
  var unenriched = all.filter(function(c){ return !c.enriched_at || (!c.linkedin_url && !c.outreach_note); }).length;

  var tab = function(key, label, n) {
    var on = _sampaignContactTab === key;
    return '<span onclick="setSampaignContactTab(\''+esc(campaignId)+'\',\''+key+'\')" style="padding:5px 10px;cursor:pointer;font-size:11px;font-weight:600;border-bottom:2px solid '+(on?'var(--gold)':'transparent')+';color:'+(on?'var(--text)':'var(--text3)')+'">'+label+' <span style="font-size:11px;color:var(--text3)">'+n+'</span></span>';
  };
  // A tile filter takes precedence over the Active/Prospective tabs: showing
  // both at once would let you pick contradictory views (filter=Sent while on
  // the Prospective tab renders an empty list for no visible reason). While a
  // filter is on, the tabs are replaced by a single clearable filter chip.
  var html;
  if (statusFilter) {
    html = '<div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border2);margin-bottom:8px;padding-bottom:6px">' +
      '<span style="font-size:11px;font-weight:600;color:var(--text)">'+esc(_sampaignStatusLabel(statusFilter))+'</span>' +
      '<span style="font-size:11px;color:var(--text3)">'+contacts.length+' contact'+(contacts.length!==1?'s':'')+'</span>' +
      '<span onclick="setSampaignStatusFilter(\''+esc(campaignId)+'\',null)" style="margin-left:auto;font-size:11px;color:var(--gold);cursor:pointer;text-decoration:underline dotted"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg> clear filter</span>' +
    '</div>';
  } else {
    html = '<div style="display:flex;gap:2px;border-bottom:1px solid var(--border2);margin-bottom:8px">' +
      tab('active','Active',active.length) + tab('prospective','Prospective',prospective.length) +
    '</div>';
  }

  html += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
    '<label style="font-size:11px;color:var(--gold);padding:5px 10px;border-radius:var(--r-sm);background:rgba(var(--c-accent-rgb),0.1);border:1px solid rgba(var(--c-accent-rgb),0.25);cursor:pointer">⇪ Upload CSV<input type="file" accept=".csv,text/csv" style="display:none" onchange="handleSampaignCsv(\''+esc(campaignId)+'\',this.files[0]);this.value=\'\'"/></label>' +
    '<button onclick="scoutSampaignContacts(\''+esc(campaignId)+'\')" style="font-size:11px;color:var(--gold);padding:5px 10px;border-radius:var(--r-sm);background:rgba(var(--c-accent-rgb),0.1);border:1px solid rgba(var(--c-accent-rgb),0.25);cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16 16l5 5"/></svg> Scout more contacts</button>' +
    '<span onclick="openSampaignScoutProfile(\''+esc(campaignId)+'\')" style="font-size:11px;color:var(--text3);cursor:pointer;text-decoration:underline dotted"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Who to hunt</span>' +
    '<button onclick="addSampaignContactRows(\''+esc(campaignId)+'\')" style="font-size:11px;color:var(--green);padding:5px 10px;border-radius:var(--r-sm);background:rgba(74,140,92,0.1);border:1px solid rgba(74,140,92,0.3);cursor:pointer">＋ Add people</button>' +
    // Always rendered, never conditional on unenriched>0. It used to vanish
    // entirely once every contact had been enriched, which reads as "the
    // button is broken" rather than "there is nothing to do" — and left no
    // way to re-run enrichment after adding people or rotating a provider.
    '<button onclick="enrichSampaignContacts(\''+esc(campaignId)+'\')" style="font-size:11px;color:var(--blue);padding:5px 10px;border-radius:var(--r-sm);background:rgba(74,158,255,0.1);border:1px solid rgba(74,158,255,0.25);cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> Enrich'+(unenriched?' '+unenriched+' contact'+(unenriched!==1?'s':''):'')+'</button>' +
    '<span style="font-size:11px;color:var(--text3)">Columns: name, email, phone, company, title (header names flexible)</span>' +
    '</div>' +
    '<div id="sampaignAddRows_'+esc(campaignId)+'"></div>';
  if (!contacts.length) {
    html += '<div style="font-size:11px;color:var(--text3)">' + (statusFilter ? 'No contacts with status "'+esc(_sampaignStatusLabel(statusFilter))+'" in this SAMpaign.' : (_sampaignContactTab==='prospective' ? 'No prospects yet, upload a CSV or scout more contacts above.' : 'No active contacts yet, mark someone sent/opened/replied to move them here.')) + '</div>';
  } else {
    html += contacts.map(function(c) {
      var meta = STATUS_META[c.status] || STATUS_META.not_contacted;
      var opts = Object.keys(STATUS_META).map(function(k){ return '<option value="'+k+'"'+(k===c.status?' selected':'')+'>'+STATUS_META[k].label+'</option>'; }).join('');
      // Domain-collision flag — visibility only, does NOT merge this contact
      // into org_accounts/stakeholders. Same semantics + shape as
      // get_sequencing_stats' by_account collision (open deal on the
      // matched account = deal_value_usd set, not won/lost).
      var collisionLine = '';
      if (c.collision) {
        collisionLine = '<div style="font-size:11px;margin-top:2px;color:'+(c.collision.is_same_user?'var(--green)':'var(--amber)')+'">' +
          (c.collision.is_same_user
            ? '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Your own tracked account'
            : '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Active deal: <strong>'+esc(c.collision.account_name)+'</strong>'+(c.collision.deal_value?' '+esc(c.collision.deal_value):'')+' · AE: '+esc(c.collision.ae)+', coordinate before outreach') +
        '</div>';
      }
      // Promote to stakeholder — only once the contact has actually replied
      // (the "outcomes flow back" moment) AND is linked to a real tracked
      // account. No account match yet → explain rather than fake a button.
      var promoteBtn = '';
      if (c.status === 'replied') {
        promoteBtn = c.account_id
          ? '<button onclick="promoteSampaignContact(\''+esc(c.id)+'\',\''+esc(campaignId)+'\')" style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:var(--r-sm);background:rgba(74,158,255,0.1);border:1px solid rgba(74,158,255,0.3);color:var(--blue);cursor:pointer;margin-top:3px">→ Promote to stakeholder</button>'
          : '<div style="font-size:11px;color:var(--text3);margin-top:3px">No matching tracked account yet, link one to promote</div>';
      }
      // LinkedIn: an actual logo tag (not a text link), same icon + fallback
      // pattern as the stakeholder roster (_stkRowHtml) — full opacity when
      // enrichment found a real profile URL, faint + a people-search fallback
      // when it hasn't (yet).
      var liHref = c.linkedin_url ? c.linkedin_url : ('https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(c.name || ''));
      var liOpacity = c.linkedin_url ? '1' : '0.3';
      // Clicking the icon copies the connection note AND opens the profile in
      // one motion. Sending a LinkedIn invite cannot be automated from here —
      // the rep has to do it by hand — so the only useful thing the product
      // can do is have the right words already on the clipboard at the moment
      // the invite box opens. Without a note it just opens the profile.
      var hasNote = !!(c.linkedin_note && c.linkedin_note.trim());
      var liTitle = hasNote ? 'Copy connection note and open profile'
                            : (c.linkedin_url ? 'Open LinkedIn profile' : 'Search LinkedIn (not enriched yet)');
      var liIcon = '<a href="'+esc(liHref)+'" target="_blank"' +
        (hasNote ? ' onclick="event.stopPropagation();_copyLinkedInNote(\''+esc(c.id)+'\')"' : ' onclick="event.stopPropagation()"') +
        ' style="display:inline-flex;align-items:center;color:#0A66C2;opacity:'+liOpacity+';text-decoration:none;flex-shrink:0;position:relative" title="'+esc(liTitle)+'"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>' +
        (hasNote ? '<span style="position:absolute;top:-3px;right:-4px;width:6px;height:6px;border-radius:50%;background:var(--green)"></span>' : '') +
        '</a>' +
        '<span onclick="event.stopPropagation();_toggleLinkedInNote(\''+esc(c.id)+'\')" style="cursor:pointer;font-size:11px;font-weight:600;color:'+(hasNote?'var(--gold)':'var(--text3)')+';white-space:nowrap" title="Write or edit the connection note">'+(hasNote?'note':'+ note')+'</span>';
      var titleLine = (c.title || c.seniority) ? '<div style="font-size:11px;color:var(--text2);margin-top:1px;display:flex;align-items:center;gap:5px"><span>'+esc([c.title, c.seniority].filter(Boolean).join(' · '))+'</span>'+liIcon+'</div>' : '<div style="margin-top:1px">'+liIcon+'</div>';
      // Enrichment-derived talking point — computed once at enrich/scout time
      // from title/seniority/department (deterministic, no AI, no Gmail
      // dependency), so it's there for contacts who haven't been emailed yet.
      // This is the field the earlier click-through insight modal couldn't
      // give prospects, since they have no message history to read.
      var noteLine = c.outreach_note ? '<div style="font-size:11px;color:var(--gold);margin-top:3px;display:flex;gap:5px;align-items:flex-start;background:rgba(var(--c-accent-rgb),0.06);border-radius:var(--r-sm);padding:4px 7px"><span style="flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg></span><span>'+esc(c.outreach_note)+'</span></div>' : '';
      var intelBtn = _samoraIntelBtn('openSampaignContactInsight(\''+esc(c.id)+'\',\''+esc(c.name||c.email||'')+'\')', true);
      // Editor is collapsed by default — most rows do not need it open, and
      // 54 always-visible textareas would bury the roster.
      var noteLen = (c.linkedin_note || '').length;
      var noteEditor = '<div id="liNote_'+esc(c.id)+'" style="display:none;margin-top:5px">' +
          '<textarea id="liNoteText_'+esc(c.id)+'" maxlength="300" rows="3" oninput="_liNoteCount(\''+esc(c.id)+'\')" placeholder="Connection note, max 300 characters…" style="width:100%;box-sizing:border-box;padding:7px 9px;border-radius:var(--r-sm);border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:11px;line-height:1.5;resize:vertical">'+esc(c.linkedin_note||'')+'</textarea>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap">' +
            '<button onclick="event.stopPropagation();saveLinkedInNote(\''+esc(c.id)+'\',\''+esc(campaignId)+'\')" style="font-size:11px;font-weight:600;padding:5px 11px;border-radius:var(--r-sm);background:var(--green);border:none;color:#fff;cursor:pointer;font-family:var(--sans)">Save note</button>' +
            '<span id="liNoteCount_'+esc(c.id)+'" style="font-size:11px;color:var(--text3)">'+noteLen+' / 300</span>' +
            (c.linkedin_note_by ? '<span style="font-size:11px;color:var(--text3)">written by '+esc(c.linkedin_note_by)+'</span>' : '') +
          '</div>' +
        '</div>';
      return '<div style="padding:6px 0;border-top:1px solid var(--border)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px">' +
        '<div style="min-width:0;flex:1"><div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(c.name||c.email||'—')+'</div>' +
        '<div style="font-size:11px;color:var(--text3)">' +
          // A scouted contact the provider could not resolve carries a
          // PLACEHOLDER address like scouted.samuelernest@snu.edu.in. It looks
          // like an address and is not one, and showing it as though it were
          // invites a rep to trust it. The "no email yet" branch below already
          // existed and simply never fired, because c.email was set.
          //
          // Sending to these is blocked server-side, but the list should say
          // so rather than leaving the rep to notice the prefix.
          (c.email && !/^scouted\.[a-z0-9]*@/i.test(c.email)
            // A found email is an inference, not a fact — Hunter scores it
            // because it is guessing the pattern from other addresses at the
            // domain. Label it, never let it sit unmarked next to one the rep
            // typed in themselves.
            ? esc(c.email) + (c.email_source ? '<span style="color:var(--gold)" title="Found by '+esc(c.email_source)+(c.email_confidence!=null?', '+c.email_confidence+'% confidence':'')+', not supplied"> ◇'+(c.email_confidence!=null?' '+c.email_confidence+'%':'')+'</span>' : '')
            : '<span style="color:var(--gold)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16 16l5 5"/></svg> no email yet, run Enrich to look it up</span>') +
          (c.company?' · '+esc(c.company):'') +
        '</div>' + titleLine + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">' + intelBtn +
        '<select onchange="setSampaignContactStatus(\''+esc(c.id)+'\',this.value,\''+esc(campaignId)+'\')" style="font-size:11px;font-weight:600;color:'+meta.color+';background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);padding:3px 6px">'+opts+'</select>' +
        '<span onclick="removeSampaignContact(\''+esc(c.id)+'\',\''+esc(campaignId)+'\',\''+esc(c.name||c.email||'')+'\')" style="cursor:pointer;color:var(--text3);font-size:13px;padding:0 2px" title="Remove from SAMpaign"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>' +
        '</div></div>' + noteEditor + noteLine + collisionLine + promoteBtn +
      '</div>';
    }).join('');
  }
  box.innerHTML = html;
}

// Auto-detect contact columns by header name — flexible, same pattern as
// _detectCrmColumns (CRM audit upload) so headers don't need to match exactly.
function _detectSampaignColumns(headers) {
  var find = function(patterns) {
    for (var p = 0; p < patterns.length; p++) {
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i].toLowerCase().trim();
        if (patterns[p].test(h)) return i;
      }
    }
    return -1;
  };
  return {
    name:    find([/^(full\s*)?name$/, /^contact(\s*name)?$/, /first.*name/]),
    email:   find([/^email$/, /e-?mail/]),
    phone:   find([/^phone$/, /mobile/, /contact\s*number/]),
    company: find([/^compan(y|ies)$/, /^account(\s*name)?$/, /organi[sz]ation/]),
    title:   find([/^title$/, /^job\s*title$/, /designation/, /role/])
  };
}

// Shared by handleSampaignCsv (upload-to-existing-campaign) and createSampaign
// (attach-at-creation) so both paths parse + post contacts identically.
async function _uploadSampaignCsvFile(campaignId, file) {
  if (!file) return;
  try {
    var text = await file.text();
    var rows = _parseCsv(text);
    if (rows.length < 2) { showToast('CSV appears empty'); return; }
    var headers = rows[0];
    var map = _detectSampaignColumns(headers);
    if (map.email === -1) { showToast('Could not find an email column, email is required per contact'); return; }
    var get = function(r, idx) { return idx >= 0 ? (r[idx]||'').trim() : ''; };
    var contacts = rows.slice(1).filter(function(r){ return r.join('').trim(); }).slice(0, 2000).map(function(r) {
      return { name: get(r,map.name), email: get(r,map.email), phone: get(r,map.phone), company: get(r,map.company), title: get(r,map.title) };
    });
    showToast('Uploading '+contacts.length+' contacts…');
    var res = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'upload_sampaign_contacts', campaign_id: campaignId, contacts: contacts }) });
    var d = await res.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Upload failed')); return; }
 showToast('Added '+d.added+(d.skipped?' · skipped '+d.skipped+' duplicate/invalid':''));
    // Power up the bare CSV row with real title/seniority/LinkedIn since the
    // email is already in hand — same enrichment keys as stakeholder scout,
    // just a by-email lookup instead of a by-domain search. Best-effort: a
    // missing/quota-exhausted key just means contacts stay unenriched, never
    // blocks the upload itself.
    if (d.added > 0) {
      try {
        var er = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
          body: JSON.stringify({ action:'enrich_sampaign_contacts', campaign_id: campaignId }) });
        var ed = await er.json();
 if (ed.ok && ed.checked > 0) showToast('Checked '+ed.checked+', matched '+ed.enriched+' via '+(ed.provider||'—')+(ed.linkedin_found!==undefined?', '+ed.linkedin_found+' with LinkedIn':''));
      } catch(e) { /* enrichment is best-effort, upload already succeeded */ }
    }
  } catch(e) { showToast('CSV error: '+e.message); }
}

// "Pull more profiles" — mirrors scoutStakeholders() on the account
// Stakeholders tab, just pointed at this campaign's contact list instead.
async function scoutSampaignContacts(campaignId) {
  try {
 showToast('Scouting more contacts…');
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'scout_sampaign_contacts', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Scout unavailable')); return; }
    if (!d.scouted) { showToast(d.error || 'No new prospects found for this profile.'); return; }
 showToast(''+d.scouted+' prospect'+(d.scouted!==1?'s':'')+' scouted via '+(d.provider||'enrichment'));
    var r2 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'list_sampaign_contacts', campaign_id: campaignId }) });
    var d2 = await r2.json();
    if (d2.ok) { window._sampaignContactsCache[campaignId] = d2.contacts || []; _sampaignContactTab = 'prospective'; _renderSampaignContacts(campaignId); }
    loadSampaignCampaigns();
  } catch(e) { showToast('Error: '+e.message); }
}

// ── SAMpaign "Who to hunt": same criteria capability as the deal
// Stakeholders tab's openScoutProfile/saveScoutProfile, scoped per campaign
// instead of per account (a rep may want a broad Sales/Marketing net for
// outreach here, and a narrower MEDDPICC-role hunt on the same account's
// deal stakeholders — different purposes, so a separate override). Reuses
// the same generic get_org_setting/save_org_setting actions and the same
// _SCOUT_DEPTS/_SCOUT_SENIORITIES chip lists, just a campaign-scoped key
// (scout_profile_sampaign_<campaign_id>) instead of an account-scoped one.
var _sampScoutCampaignId = null;
// ═══════════════════════════════════════════════════════════════════════════
// Manual add-people — type contacts straight into the campaign instead of
// going via a CSV or a Lusha scout. Same destination as both of those
// (upload_sampaign_contacts), so dedupe-by-email, domain matching to the
// tracked account, and every downstream behaviour are identical. No new
// backend action: this is a different way to enter the same data, not a
// different kind of data.
// ═══════════════════════════════════════════════════════════════════════════
window._sampAddRows = {};   // campaignId -> [{name,email,phone,company,title}]

function _blankContactRow() { return { name:'', email:'', phone:'', company:'', title:'' }; }

function addSampaignContactRows(campaignId) {
  var box = document.getElementById('sampaignAddRows_' + campaignId);
  if (!box) return;
  // Toggle closed if already open, so the button works both ways.
  if (box.innerHTML.trim() && window._sampAddRows[campaignId]) {
    window._sampAddRows[campaignId] = null; box.innerHTML = ''; return;
  }
  window._sampAddRows[campaignId] = [_blankContactRow()];
  _renderSampAddRows(campaignId);
}

function _sampAddRowField(campaignId, i, field, val) {
  var rows = window._sampAddRows[campaignId]; if (!rows || !rows[i]) return;
  rows[i][field] = val;
}
function _sampAddAnotherRow(campaignId) {
  var rows = window._sampAddRows[campaignId]; if (!rows) return;
  if (rows.length >= 25) { showToast('Add up to 25 at a time, or upload a CSV'); return; }
  rows.push(_blankContactRow());
  _renderSampAddRows(campaignId, true);
}
function _sampRemoveAddRow(campaignId, i) {
  var rows = window._sampAddRows[campaignId]; if (!rows) return;
  rows.splice(i, 1);
  if (!rows.length) rows.push(_blankContactRow());
  _renderSampAddRows(campaignId);
}

function _renderSampAddRows(campaignId, focusLast) {
  var box = document.getElementById('sampaignAddRows_' + campaignId);
  var rows = window._sampAddRows[campaignId];
  if (!box || !rows) return;
  var f = function(i, field, label, req, val) {
    return '<input value="'+esc(val||'')+'" placeholder="'+esc(label)+(req?' *':'')+'" ' +
      'oninput="_sampAddRowField(\''+esc(campaignId)+'\','+i+',\''+field+'\',this.value)" ' +
      'style="flex:1;min-width:0;padding:5px 7px;border-radius:var(--r-sm);border:1px solid '+(req?'rgba(var(--c-accent-rgb),0.4)':'var(--border2)')+';background:var(--bg);color:var(--text);font-family:var(--sans);font-size:11px"/>';
  };
  var html = '<div style="border:1px solid var(--border2);border-radius:var(--r-sm);padding:9px;margin-bottom:8px;background:var(--surface)">' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:6px">Add people manually · give a <strong style="color:var(--gold)">name or an email</strong>, the rest is optional</div>';
  rows.forEach(function(r, i) {
    // Neither name nor email is individually required — you need one of the
    // two. Not knowing someone's address is the normal starting point, and
    // Enrich looks it up from the account domain plus their name.
    var noEmail = !!((r.name||'').trim()) && !((r.email||'').trim());
    html += '<div style="margin-bottom:5px">' +
      '<div style="display:flex;gap:4px;align-items:center">' +
        f(i,'name','Name',false,r.name) + f(i,'email','Email',false,r.email) +
        f(i,'company','Company',false,r.company) + f(i,'title','Title',false,r.title) +
        '<span onclick="_sampRemoveAddRow(\''+esc(campaignId)+'\','+i+')" style="cursor:pointer;color:var(--text3);font-size:13px;padding:0 3px;flex-shrink:0" title="Remove this row"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>' +
      '</div>' +
      (noEmail ? '<div style="font-size:11px;color:var(--gold);margin-top:2px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16 16l5 5"/></svg> No email, Enrich will try to find it from the account domain</div>' : '') +
    '</div>';
  });
  html += '<div style="display:flex;gap:8px;align-items:center;margin-top:7px">' +
      '<span onclick="_sampAddAnotherRow(\''+esc(campaignId)+'\')" style="font-size:11px;font-weight:600;color:var(--gold);cursor:pointer">+ Add another person</span>' +
      '<button onclick="submitSampaignContactRows(\''+esc(campaignId)+'\')" style="margin-left:auto;font-size:11px;font-weight:600;padding:5px 12px;border-radius:var(--r-sm);background:var(--green);border:none;color:#fff;cursor:pointer;font-family:var(--sans)">Add to SAMpaign</button>' +
      '<span onclick="addSampaignContactRows(\''+esc(campaignId)+'\')" style="font-size:11px;color:var(--text3);cursor:pointer">Cancel</span>' +
    '</div></div>';
  box.innerHTML = html;
  if (focusLast) { var ins = box.querySelectorAll('input'); if (ins.length) ins[Math.max(0, ins.length - 4)].focus(); }
}

// Collect + validate the typed rows. Shared by the in-campaign form and the
// creation form, which is why it returns the array rather than posting.
function _collectSampAddRows(campaignId) {
  var rows = window._sampAddRows[campaignId] || [];
  var contacts = rows
    .map(function(r){ return { name:(r.name||'').trim(), email:(r.email||'').trim(), phone:(r.phone||'').trim(), company:(r.company||'').trim(), title:(r.title||'').trim() }; })
    .filter(function(r){ return r.email || r.name; });
  if (!contacts.length) { showToast('Add a name or an email for at least one person'); return null; }
  // Only validate addresses that were actually typed — a blank email is a
  // legitimate "look this up for me", not a mistake.
  var bad = contacts.filter(function(r){ return r.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email); });
  if (bad.length) { showToast('Check the email format: ' + bad[0].email); return null; }
  return contacts;
}

async function submitSampaignContactRows(campaignId) {
  var contacts = _collectSampAddRows(campaignId);
  if (!contacts) return;
  try {
    var res = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'upload_sampaign_contacts', campaign_id: campaignId, contacts: contacts }) });
    var d = await res.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not add contacts')); return; }
 showToast('Added ' + (d.added||0) + (d.need_email ? ' · ' + d.need_email + ' need an email lookup' : '') + (d.skipped ? ' · ' + d.skipped + ' skipped (already in this SAMpaign)' : ''));
    window._sampAddRows[campaignId] = null;
    var box = document.getElementById('sampaignAddRows_'+campaignId); if (box) box.innerHTML = '';
    await _loadSampaignContactsInto(campaignId);
    var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
    _loadSampaignDetailPerf(campaignId, c);
  } catch(e) { showToast('Error: '+e.message); }
}

// ── LinkedIn connection notes ───────────────────────────────────────────────
// LinkedIn caps a connection note at 300 characters. Two things worth knowing
// beyond the length, because no code here can work around either: free
// accounts get roughly five personalised invitations per MONTH (past that
// LinkedIn sends the request but silently drops the note), and the invite
// itself cannot be automated — the rep opens the profile and pastes. So the
// only useful job for the product is having the right words on the clipboard
// at the exact moment the invite box opens.
function _toggleLinkedInNote(contactId) {
  var el = document.getElementById('liNote_' + contactId);
  if (!el) return;
  var open = el.style.display === 'none';
  el.style.display = open ? 'block' : 'none';
  if (open) document.getElementById('liNoteText_' + contactId)?.focus();
}

function _liNoteCount(contactId) {
  var ta = document.getElementById('liNoteText_' + contactId);
  var out = document.getElementById('liNoteCount_' + contactId);
  if (!ta || !out) return;
  var n = ta.value.length;
  out.textContent = n + ' / 300';
  // Amber past 200: sources disagree on whether free LinkedIn accounts are
  // held to 200 rather than 300, so this warns instead of blocking.
  out.style.color = n > 300 ? 'var(--coral)' : n > 200 ? 'var(--amber)' : 'var(--text3)';
  out.title = n > 200 ? 'Some free LinkedIn accounts cap notes at 200 characters' : '';
}

async function saveLinkedInNote(contactId, campaignId) {
  var ta = document.getElementById('liNoteText_' + contactId);
  if (!ta) return;
  var note = ta.value.replace(/\s+/g, ' ').trim();
  if (!note) { showToast('Write something first'); return; }
  if (note.length > 300) { showToast('Too long by ' + (note.length - 300) + ' characters'); return; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'save_sampaign_linkedin_notes', campaign_id: campaignId, generated_by: 'manual', notes: [{ contact_id: contactId, note: note }] }) });
    var d = await r.json();
 if (!d.ok || !d.saved) { showToast('' + (d.note || d.error || 'Could not save')); return; }
 showToast('Note saved');
    _loadSampaignContactsInto(campaignId);
  } catch(e) { showToast('Error: ' + e.message); }
}

// Copies on the way to the profile. The anchor still navigates, so this runs
// alongside rather than instead of opening LinkedIn.
function _copyLinkedInNote(contactId) {
  var all = window._sampaignContactsCache || {};
  var found = null;
  Object.keys(all).forEach(function(k) {
    (all[k] || []).forEach(function(c) { if (c.id === contactId) found = c; });
  });
  if (!found || !found.linkedin_note) return;
  try {
    navigator.clipboard.writeText(found.linkedin_note);
 showToast('Note copied, paste it into the invite');
  } catch(e) {
    // Clipboard can be blocked by permissions or a non-secure context, and
    // failing silently would leave the rep pasting whatever was there before.
    showToast('Could not copy automatically, open the note and copy it');
  }
}

// ── Remove a contact from the campaign ──────────────────────────────────────
// Hard delete, deliberately. A soft-delete flag would need filtering added to
// every read path (roster, stats, sync, follow-up ladder, MCP connector
// tools) and missing one is exactly how archived campaigns kept feeding
// analytics earlier. Deleting the row means "removed" is true everywhere by
// construction, including anything reading this data over the connector,
// with no filter to forget.
async function removeSampaignContact(contactId, campaignId, label) {
  if (!confirm('Remove ' + (label || 'this contact') + ' from the SAMpaign?\n\nThey stop being counted in performance, stop receiving follow-ups, and disappear from anything reading this campaign. This cannot be undone.')) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'remove_sampaign_contacts', campaign_id: campaignId, contact_ids: [contactId] }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not remove')); return; }
 showToast('Removed from SAMpaign');
    await _loadSampaignContactsInto(campaignId);
    var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
    _loadSampaignDetailPerf(campaignId, c);
  } catch(e) { showToast('Error: '+e.message); }
}

async function openSampaignScoutProfile(campaignId) {
  _sampScoutCampaignId = campaignId;
  document.getElementById('samp-scout-profile-modal')?.remove();
  var orgP = { departments: ['Sales','Marketing','Strategy'], seniorities: ['Senior','Leadership','CXO'], jobTitles: [], locations: [] };
  var campP = null;
  try {
    var reqs = [
      fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({ action:'get_org_setting', key:'stakeholder_scout_profile' }) }).then(function(r){return r.json();}),
      fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({ action:'get_org_setting', key:'scout_profile_sampaign_'+campaignId }) }).then(function(r){return r.json();})
    ];
    var res = await Promise.all(reqs);
    if (res[0] && res[0].value) { var p = JSON.parse(res[0].value); ['departments','seniorities','jobTitles','locations'].forEach(function(k){ if (Array.isArray(p[k])) orgP[k] = p[k]; }); }
    if (res[1] && res[1].value) { try { var cp = JSON.parse(res[1].value); if (cp && (cp.departments||cp.seniorities||cp.jobTitles||cp.locations)) campP = cp; } catch(e){} }
  } catch(e) {}
  var usingCamp = !!campP;
  var cur = campP || orgP;
  var chip = function(group, val, on) {
    return '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:5px 10px;border-radius:var(--r-md);border:1px solid ' + (on?'var(--gold)':'var(--border2)') + ';background:' + (on?'rgba(var(--c-accent-rgb),0.08)':'transparent') + ';color:' + (on?'var(--gold)':'var(--text2)') + ';cursor:pointer;margin:0 6px 6px 0"><input type="checkbox" data-group="' + group + '" value="' + val + '"' + (on?' checked':'') + ' style="margin:0">' + val + '</label>';
  };
  var inputStyle = 'width:100%;padding:9px 11px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:13px;font-family:var(--sans);outline:none';
  var modal = document.createElement('div');
  modal.id = 'samp-scout-profile-modal';
  // z-index:100000 — this modal opens FROM the campaign detail overlay
  // (99999), so anything at or below that renders behind it. 10000 was fine
  // while it was only reachable from the plain campaign row, and silently
  // broke the moment the overlay was introduced. Same failure mode the toast
  // had. Toast now sits one above this, at 100001.
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100000;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:520px;padding:20px;max-height:85vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div style="font-size:14px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Who to hunt for this SAMpaign</div><button onclick="document.getElementById(\'samp-scout-profile-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<label style="display:flex;align-items:center;gap:8px;margin:8px 0 12px;cursor:pointer"><input type="checkbox" id="samp-scout-toggle"' + (usingCamp?' checked':'') + ' style="width:15px;height:15px;accent-color:var(--gold)"><span style="font-size:12px;color:var(--text2)">Custom targets for <b>this SAMpaign only</b> (otherwise edits the org default)</span></label>' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Job titles (primary, comma separated)</div>' +
    '<textarea id="samp-scout-titles" rows="2" placeholder="e.g. CFO, Chief Financial Officer, VP Finance, Head of Procurement, Owner" style="' + inputStyle + ';resize:vertical;height:54px">' + esc((cur.jobTitles||[]).join(', ')) + '</textarea>' +
    '<div style="font-size:11px;color:var(--text3);margin:4px 0 8px">These match real titles at the account. Leave blank to use departments + seniority.</div>' +
    // Filled asynchronously. A blank box is the reason this form goes unused,
    // so the suggestions are the point of it, not decoration.
    '<div id="samp-scout-suggest" style="margin-bottom:12px;max-height:172px;overflow-y:auto"><div style="font-size:11px;color:var(--text3)">Looking at which titles have replied to you…</div></div>' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Departments</div>' +
    '<div style="margin-bottom:14px">' + _SCOUT_DEPTS.map(function(x){ return chip('dept', x, (cur.departments||[]).indexOf(x) !== -1); }).join('') + '</div>' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Seniority</div>' +
    '<div style="margin-bottom:14px">' + _SCOUT_SENIORITIES.map(function(x){ return chip('sen', x, (cur.seniorities||[]).indexOf(x) !== -1); }).join('') + '</div>' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Locations (optional, comma separated)</div>' +
    '<input id="samp-scout-locs" value="' + esc((cur.locations||[]).join(', ')) + '" placeholder="e.g. India, APAC" style="' + inputStyle + ';margin-bottom:16px"/>' +
    '<button onclick="saveSampaignScoutProfile()" style="width:100%;padding:12px;border:none;border-radius:var(--r-md);background:var(--gold);color:var(--c-canvas);font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans)">Save</button>' +
  '</div>';
  modal.addEventListener('click', function(){ modal.remove(); });
  document.body.appendChild(modal);
  // Only after the modal is in the DOM, or the suggestion box does not exist
  // yet and this writes into nothing. Not awaited: the form is usable while
  // suggestions load.
  _loadScoutSuggestions(campaignId);
}

// Suggestions come from this org's OWN outreach history: which titles have
// actually replied. That is evidence, not a guess about the market, so each
// chip carries its count and the rep can disagree with it.
async function _loadScoutSuggestions(campaignId) {
  var box = document.getElementById('samp-scout-suggest');
  if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'suggest_scout_targets', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) { box.innerHTML = ''; return; }

    // Chips are an aid, not the content of the dialog. Twelve of them stacked
    // pushed Departments and Seniority below the fold and made the suggestion
    // list look like the form itself. Six by default, the rest one tap away.
    var chipBtn = function(title, proven, count, why) {
      return '<button type="button" onclick="_addScoutTitle(' + JSON.stringify(title).replace(/"/g,'&quot;') + ')"' +
        (why ? ' title="' + esc(why) + '"' : '') +
        ' style="font-size:11px;line-height:1.2;padding:3px 8px;margin:0 4px 4px 0;border-radius:var(--r-md);cursor:pointer;' +
        'font-family:var(--sans);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
        'border:1px solid ' + (proven ? 'var(--green)' : 'var(--border2)') + ';' +
        'background:' + (proven ? 'rgba(74,140,92,0.10)' : 'transparent') + ';' +
        'color:' + (proven ? 'var(--green)' : 'var(--text2)') + '">+ ' + esc(title) +
        (proven && count ? ' <span style="opacity:.7">' + count + '</span>' : '') + '</button>';
    };

    var h = '';
    var titles = d.suggested_titles || [];
    if (titles.length) {
      var head = titles.slice(0, 6), rest = titles.slice(6);
      h += '<div style="font-size:11px;color:var(--text3);margin-bottom:5px">Tap to add. Green has replied to you before.</div>';
      h += '<div>' + head.map(function(t){ return chipBtn(t.title, t.replied > 0, t.replied, t.why); }).join('');
      if (rest.length) {
        h += '<span id="samp-scout-rest" style="display:none">' + rest.map(function(t){ return chipBtn(t.title, t.replied > 0, t.replied, t.why); }).join('') + '</span>';
        h += '<button type="button" id="samp-scout-more" onclick="document.getElementById(\'samp-scout-rest\').style.display=\'inline\';this.remove()" ' +
             'style="font-size:11px;padding:3px 8px;margin:0 4px 4px 0;border-radius:var(--r-md);border:1px dashed var(--border2);background:transparent;color:var(--text3);cursor:pointer;font-family:var(--sans)">' + rest.length + ' more</button>';
      }
      h += '</div>';
    } else if (d.note) {
      h += '<div style="font-size:11px;color:var(--text3)">' + esc(d.note) + '</div>';
    }

    var eng = (d.already_engaged || []).filter(function(x){ return x.title; }).slice(0, 4);
    if (eng.length) {
      h += '<div style="font-size:11px;color:var(--text3);margin:7px 0 4px">Already engaged here</div><div>' +
           eng.map(function(x){ return chipBtn(x.title, false, 0, x.role || ''); }).join('') + '</div>';
    }

    // Location is prefilled, not just suggested, because the campaign name
    // already stated it and making the rep retype it is busywork.
    if ((d.suggested_locations || []).length) {
      var locEl = document.getElementById('samp-scout-locs');
      if (locEl && !locEl.value.trim()) {
        locEl.value = d.suggested_locations.join(', ');
        h += '<div style="font-size:11px;color:var(--text3);margin-top:8px">Location prefilled from ' + esc(d.location_source || 'this campaign') + '. Clear it to search everywhere.</div>';
      }
    }
    box.innerHTML = h;
  } catch(e) { box.innerHTML = ''; }
}

function _addScoutTitle(title) {
  var ta = document.getElementById('samp-scout-titles');
  if (!ta) return;
  var cur = ta.value.split(',').map(function(x){ return x.trim(); }).filter(Boolean);
  if (cur.some(function(x){ return x.toLowerCase() === String(title).toLowerCase(); })) return;
  cur.push(title);
  ta.value = cur.join(', ');
  // Titles are the PRIMARY Lusha filter and override departments/seniority
  // entirely, so say so the moment the rep starts using them.
  var box = document.getElementById('samp-scout-suggest');
  if (box && !document.getElementById('samp-scout-titlenote')) {
    var n = document.createElement('div');
    n.id = 'samp-scout-titlenote';
    n.style.cssText = 'font-size:11px;color:var(--gold);margin-top:8px';
    n.textContent = 'Job titles take precedence: departments and seniority below are ignored while this box has anything in it.';
    box.appendChild(n);
  }
}

async function saveSampaignScoutProfile() {
  var depts = [], sens = [];
  document.querySelectorAll('#samp-scout-profile-modal input[type=checkbox][data-group]').forEach(function(c){
    if (!c.checked) return;
    if (c.getAttribute('data-group') === 'dept') depts.push(c.value); else sens.push(c.value);
  });
  var csv = function(id){ var el = document.getElementById(id); return el ? el.value.split(',').map(function(x){return x.trim();}).filter(Boolean) : []; };
  var profile = { departments: depts, seniorities: sens, jobTitles: csv('samp-scout-titles'), locations: csv('samp-scout-locs') };
  var perCampaign = !!(document.getElementById('samp-scout-toggle') && document.getElementById('samp-scout-toggle').checked);
  try {
    if (perCampaign && _sampScoutCampaignId) {
      await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'save_org_setting', key:'scout_profile_sampaign_'+_sampScoutCampaignId, value: JSON.stringify(profile) }) });
 showToast('Custom targets saved for this SAMpaign');
    } else {
      var _r0 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'save_org_setting', key:'stakeholder_scout_profile', value: JSON.stringify(profile) }) });
      var _d0 = await _r0.json().catch(function(){ return {}; });
      if (!_d0.ok) { showToast(_d0.error || 'Could not save the organisation default.'); return; }
      if (_sampScoutCampaignId) await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'save_org_setting', key:'scout_profile_sampaign_'+_sampScoutCampaignId, value: JSON.stringify({}) }) });
 showToast('Org default targets saved');
    }
    document.getElementById('samp-scout-profile-modal')?.remove();
  } catch(e) { showToast('Error: ' + e.message); }
}

async function enrichSampaignContacts(campaignId) {
  try {
 showToast('Enriching contacts…');
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'enrich_sampaign_contacts', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Enrichment unavailable')); return; }
    // Surface the real match rate, not just "done" — this is what tells you
    // whether the provider is genuinely working (checked>0) vs just missing
    // LinkedIn for these specific people (linkedin_found low/0, has a note
    // explaining it's a coverage limit, not a bug).
    var msg = '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> Checked '+d.checked+', matched '+d.enriched+' via '+(d.provider||'—')+(d.linkedin_found!==undefined?', '+d.linkedin_found+' with LinkedIn':'');
    if (d.note) msg += ', '+d.note;
    showToast(msg);
    var r2 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'list_sampaign_contacts', campaign_id: campaignId }) });
    var d2 = await r2.json();
    if (d2.ok) { window._sampaignContactsCache[campaignId] = d2.contacts || []; _renderSampaignContacts(campaignId); }
  } catch(e) { showToast('Error: '+e.message); }
}

async function handleSampaignCsv(campaignId, file) {
  if (!file) return;
  await _uploadSampaignCsvFile(campaignId, file);
  await _loadSampaignContactsInto(campaignId);
  loadSampaignCampaigns();
}

// The "outcomes flow back" moment: once a contact has actually replied AND
// is linked to a tracked account (account_id, set by the domain match in
// upload_sampaign_contacts), let the rep add them to that account's real
// Stakeholders tab. Does not create a new account — a contact with no
// account match stays out of the CRM layer, same as CLAUDE.md's
// activity-proven-only rule.
async function promoteSampaignContact(contactId, campaignId) {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'promote_sampaign_contact_to_stakeholder', contact_id: contactId }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not promote')); return; }
 showToast('Added to stakeholders on '+(d.account_name||'the account'));
  } catch(e) { showToast('Error: '+e.message); }
}

async function setSampaignContactStatus(contactId, status, campaignId) {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'update_contact_status', contact_id: contactId, status: status }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not update')); return; }
    var list = window._sampaignContactsCache[campaignId] || [];
    var idx = list.findIndex(function(c){ return c.id === contactId; });
    // Merge (not replace) — update_contact_status only returns the raw
    // sampaign_contacts row, not the computed `collision` field list_
    // sampaign_contacts adds, so a plain replace would drop that badge.
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], d.contact);
    _renderSampaignContacts(campaignId); // a status change can move a contact between the Active/Prospective tabs
    loadSampaignCampaigns(); // refresh badge counts on the collapsed header too
  } catch(e) { showToast('Error: '+e.message); }
}
function toggleSdrLeadForm() {
  var f = document.getElementById('sdrLeadForm'); if (!f) return;
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  if (f.style.display === 'block') document.getElementById('sdrLeadName')?.focus();
}
async function createSdrLead() {
  var name = document.getElementById('sdrLeadName')?.value?.trim();
  var domain = document.getElementById('sdrLeadDomain')?.value?.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'') || null;
  var region = document.getElementById('sdrLeadRegion')?.value?.trim() || null;
  if (!name) { showToast('Enter a company name'); return; }
  try {
    var body = { org_id: profile.org_id, user_id: currentUser.id, sdr_user_id: currentUser.id, added_by: currentUser.id, account_name: name, domain: domain };
    if (region) body.region = region;
    var r = await fetch(SB_URL + '/rest/v1/org_accounts', { method:'POST', headers:{'apikey':SB_KEY,'Authorization':'Bearer '+currentUser.token,'Content-Type':'application/json','Prefer':'return=representation'}, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    var rows = await r.json();
    var created = Array.isArray(rows) ? rows[0] : rows;
 showToast('Lead created');
    await loadSdrPlayground();
    if (created && created.id) { window._sdrDeals[created.id] = { id:created.id, account:name, deal_value_usd:0, stage:'prospective', region:region||'' }; openSdrScout(created.id, name); }
  } catch(e) { if ((e.message||'').match(/duplicate|unique/)) showToast(name+' already exists'); else showToast('Error: '+e.message); }
}

function loadPipeline() {
  scRefreshCurrent();
  var m = document.getElementById('scDealsMore');
  if (m && m.open) return _scOldPipeline();
  return Promise.resolve();
}
async function _scOldPipeline() {
  var btn = document.getElementById('pipelineRefreshBtn');
  if (btn) btn.textContent = '↻ Loading…';
  var promptsEl = document.getElementById('pipelinePrompts');
  var summaryEl = document.getElementById('pipelineSummary');
  var chartEl = document.getElementById('pipelineChart');
  var dealsEl = document.getElementById('pipelineDeals');
  if (chartEl) chartEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:20px 0;text-align:center">Loading pipeline…</div>';

  try {
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'get_pipeline' })
    });
    _pipelineData = await r.json();
    if (!_pipelineData.ok) { if (chartEl) chartEl.innerHTML = '<div style="color:var(--coral);font-size:12px">' + esc(_pipelineData.error || 'Failed to load pipeline') + '</div>'; return; }

    // SDR role: show pipeline-generation panel (generation targets, not revenue)
    loadSdrPanel();
    loadSdrPlayground();

    // Prompts
    if (promptsEl && _pipelineData.prompts?.length) {
      promptsEl.innerHTML = _pipelineData.prompts.map(function(p) {
        return '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-sm);padding:8px 12px;margin-bottom:6px;font-size:12px;color:var(--text)">' + esc(p) + '</div>';
      }).join('');
    }

    populatePipelineFilters(_pipelineData);
    renderPipelineDashboard(_pipelineData);
    renderPipelineChart(_pipelineData);
    renderPipelineDeals(_pipelineData);
  } catch(e) {
    if (chartEl) chartEl.innerHTML = '<div style="color:var(--coral);font-size:12px">Error: ' + esc(e.message) + '</div>';
  }
  if (btn) btn.textContent = '↻ Refresh';
}

function renderPipelineChart(data) {
  var chartEl = document.getElementById('pipelineChart');
  if (!chartEl) return;

  var regions = data.regionBreakdown || [];
  if (!regions.length) { chartEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:16px 0;text-align:center">No pipeline data yet, add deal values to your accounts to see the chart.</div>'; return; }

  // Stage colours from org config
  var stageColors = { prospective: '#888780', value_prop: '#A07824', commercial: '#3B6D11', unknown: '#555' };
  var dealStages = data.dealStages || [{ key:'prospective',label:'Prospective' },{ key:'value_prop',label:'Value Prop' },{ key:'commercial',label:'Commercial' }];
  var fmtUsd = function(v) { return fmtOrgMoney(v || 0); };

  // Filter by current view
  var filteredRegions = regions.map(function(r) {
    var total = _pipelineView === 'verified'   ? r.verified_usd :
                _pipelineView === 'partial'    ? r.partial_usd :
                _pipelineView === 'unverified' ? r.unverified_usd : r.total_usd;
    return Object.assign({}, r, { display_usd: total });
  }).filter(function(r) { return r.display_usd > 0; }).sort(function(a, b) { return b.display_usd - a.display_usd; });

  if (!filteredRegions.length) { chartEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:16px 0;text-align:center">No ' + _pipelineView + ' deals yet.</div>'; return; }

  var maxUsd = Math.max.apply(null, filteredRegions.map(function(r) { return r.display_usd; }));

  var html = '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Region × Stage pipeline</div>';

  // Legend
  html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">';
  dealStages.forEach(function(s) {
    var color = stageColors[s.key] || '#888';
    html += '<div style="display:flex;align-items:center;gap:4px"><div style="width:10px;height:10px;border-radius:var(--r-sm);background:' + color + '"></div><span style="font-size:11px;color:var(--text3)">' + esc(s.label) + '</span></div>';
  });
  if (_pipelineView === 'combined') {
    html += '<div style="display:flex;align-items:center;gap:4px"><div style="width:10px;height:10px;border-radius:var(--r-sm);background:repeating-linear-gradient(45deg,#888,#888 1px,transparent 1px,transparent 5px);border:1px solid #888"></div><span style="font-size:11px;color:var(--text3)">Unverified (AI)</span></div>';
  }
  html += '</div>';

  filteredRegions.forEach(function(r) {
    var barWidth = maxUsd > 0 ? Math.max(4, r.display_usd / maxUsd * 100) : 0;
    html += '<div style="margin-bottom:10px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">';
    html += '<span style="font-size:12px;font-weight:500;color:var(--text)">' + esc(r.region) + '</span>';
    html += '<span style="font-size:11px;color:var(--text2)">' + fmtUsd(r.display_usd) + ' · ' + r.deals + ' deal' + (r.deals !== 1 ? 's' : '') + '</span>';
    html += '</div>';

    // Stacked bar
    html += '<div style="height:22px;background:var(--surface);border-radius:var(--r-sm);overflow:hidden;position:relative">';

    // For stage breakdown within the bar
    var stages = r.stages || {};
    var stageTotal = Object.values(stages).reduce(function(s, st) { return s + (st.usd || 0); }, 0);
    var x = 0;
    dealStages.forEach(function(s) {
      var st = stages[s.key];
      if (!st || !st.usd) return;
      var pct = stageTotal > 0 ? st.usd / stageTotal * barWidth : 0;
      var color = stageColors[s.key] || '#888';
      html += '<div style="position:absolute;top:0;left:' + x + '%;width:' + pct + '%;height:100%;background:' + color + '"></div>';
      x += pct;
    });

    // Unverified overlay (hatched) in combined view
    if (_pipelineView === 'combined' && r.unverified_usd > 0 && r.total_usd > 0) {
      var unvPct = r.unverified_usd / r.total_usd * barWidth;
      html += '<div style="position:absolute;top:0;right:0;width:' + unvPct + '%;height:100%;background:repeating-linear-gradient(45deg,rgba(136,135,128,0.3),rgba(136,135,128,0.3) 2px,transparent 2px,transparent 6px);border-left:1px solid rgba(255,255,255,0.3)"></div>';
    }

    html += '</div>';
    html += '</div>';
  });

  // Closing this quarter highlight
  var cq = (data.summary || {}).closing_this_quarter_usd || 0;
  if (cq > 0) {
    html += '<div style="margin-top:10px;padding:8px 12px;background:rgba(74,140,92,0.1);border:1px solid rgba(74,140,92,0.3);border-radius:var(--r-sm);font-size:11px;color:var(--green)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> <strong>' + fmtUsd(cq) + '</strong> expected to close this quarter</div>';
  }

  chartEl.innerHTML = html;
}

function renderPipelineDeals(data) {
  var el = document.getElementById('pipelineDeals');
  if (!el) return;

  var deals = _pipelineView === 'verified'   ? (data.verified || []) :
              _pipelineView === 'partial'    ? (data.partial  || []) :
              _pipelineView === 'unverified' ? (data.unverified || []) :
              [...(data.verified || []), ...(data.partial || []), ...(data.unverified || [])];

  deals.sort(function(a, b) { return (b.deal_value_usd || 0) - (a.deal_value_usd || 0); });

  if (!deals.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:16px 0;text-align:center">No deals in this view yet.</div>'; return; }

  var stageColors = { prospective: '#888780', value_prop: '#A07824', commercial: '#3B6D11', unknown: '#555' };
  var fmtUsd = function(v) { if (!v) return 'Not set'; return fmtOrgMoney(v); };
  var tierConfig = {
    verified:   { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>', label: 'Verified',   color: 'var(--green)' },
    partial:    { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>', label: 'Partial',    color: 'var(--amber)' },
    unverified: { icon: '〜', label: 'Unverified', color: 'var(--text3)' }
  };

  // ── Group deals by company brand root ─────────────────────────────────────
  // "Ferrero India IR" + "Ferrero India Route Opt" → group under "Ferrero"
  var brandRoot = function(name) {
    return (name || '').split(/[\s\-_\/]/)[0].toLowerCase();
  };
  var groups = {};
  var groupOrder = [];
  deals.forEach(function(d) {
    var root = brandRoot(d.account);
    if (!groups[root]) { groups[root] = []; groupOrder.push(root); }
    groups[root].push(d);
  });

  var renderDealCard = function(d) {
    var stageColor = stageColors[d.stage] || 'var(--text3)';
    var prob = d.close_probability || 0;
    var tc = tierConfig[d.tier] || tierConfig.unverified;
    var localValue = d.deal_value ? (d.deal_currency || 'USD') + ' ' + Number(d.deal_value).toLocaleString() : null;
    var scoreBar = d.signal_score != null
      ? '<div style="display:inline-flex;align-items:center;gap:4px;margin-left:6px"><div style="width:40px;height:4px;background:var(--border2);border-radius:var(--r-sm);overflow:hidden"><div style="height:100%;background:' + (d.signal_score>=60?'var(--green)':d.signal_score>=40?'var(--amber)':'var(--coral)') + ';width:' + d.signal_score + '%"></div></div><span style="font-size:11px;color:var(--text3)">' + d.signal_score + '</span></div>'
      : '';
    var healthBadge = d.health_score != null
      ? '<span onclick="event.stopPropagation();openHealthBreakdown(\'' + esc(d.id) + '\',\'' + esc(d.account) + '\')" style="font-size:11px;padding:1px 5px;border-radius:var(--r-sm);margin-left:4px;cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px;background:' +
        (d.health_score>=70?'rgba(74,140,92,0.15)':d.health_score>=40?'rgba(var(--c-accent-rgb),0.15)':'rgba(192,82,63,0.15)') +
        ';color:' + (d.health_score>=70?'var(--green)':d.health_score>=40?'var(--amber)':'var(--coral)') +
        '" title="Why this score? Tap for rule-level breakdown">H:' + d.health_score + '</span>'
      : '';
    var sparkline = _renderSparkline(d.score_history || []);
    // Rep initials badge
    var repInitials = (d.rep_email||'').split('@')[0].split(/[._]/).map(function(w){return w[0]||'';}).slice(0,2).join('').toUpperCase();
    var repBadge = repInitials ? '<span style="font-size:11px;width:18px;height:18px;border-radius:50%;background:var(--surface2);border:1px solid var(--border2);display:inline-flex;align-items:center;justify-content:center;color:var(--text3);flex-shrink:0" title="' + esc((d.rep_email||'').split('@')[0]) + '">' + repInitials + '</span>' : '';

    return '<div class="deal-card-row" data-deal-id="' + esc(d.id) + '" data-deal-account="' + esc(d.account) + '" style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px 12px;margin-bottom:6px;cursor:pointer;transition:border-color 0.15s" onmouseenter="this.style.borderColor=\'var(--gold)\'" onmouseleave="this.style.borderColor=\'var(--border2)\'">' +
      '<div style="display:flex;align-items:flex-start;gap:10px">' +
        '<div style="flex:1">' +
          '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">' +
            repBadge +
            '<span style="font-size:12px;font-weight:500;color:var(--text)">' + esc(d.account) + '</span>' +
            (d.region ? '<span style="font-size:11px;color:var(--text3);background:rgba(0,0,0,0.08);border-radius:var(--r-sm);padding:1px 6px">' + esc(d.region) + '</span>' : '') +
            '<span style="font-size:11px;font-weight:600;padding:1px 7px;border-radius:var(--r-md);background:' + stageColor + '22;color:' + stageColor + '">' + esc(d.stage) + '</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">' +
            '<span style="font-size:11px;color:' + tc.color + ';font-weight:500">' + tc.icon + ' ' + tc.label + '</span>' +
            scoreBar + healthBadge + sparkline +
          '</div>' +
          // Risk chips — named, deterministic, each carries its evidence (tap to see)
          ((d.risks && d.risks.length)
            ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px">' + d.risks.map(function(rk) {
                var rc = rk.severity === 'high' ? 'var(--coral)' : rk.severity === 'medium' ? 'var(--amber)' : 'var(--text3)';
                return '<span onclick="event.stopPropagation();showToast(this.dataset.ev)" data-ev="' + esc((rk.evidence || '').replace(/"/g, '&quot;')) + '" title="' + esc(rk.evidence || '') + '" style="font-size:11px;font-weight:600;padding:1px 6px;border-radius:var(--r-sm);border:1px solid ' + rc + ';color:' + rc + ';cursor:help">' + esc(rk.label) + '</span>';
              }).join('') + '</div>'
            : '') +
          '<div style="font-size:11px;color:var(--text3);font-style:italic;margin-bottom:4px">' + esc(d.verification_reason || '') + '</div>' +
          (d.hint_context ? '<div style="font-size:11px;color:var(--text3);font-style:italic">"' + esc(d.hint_context.slice(0, 100)) + '"</div>' : '') +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:2px">' +
            (localValue ? '<span style="font-size:11px;color:var(--text2)">Local: ' + localValue + '</span>' : '') +
 '<span class="edit-close-date-btn" data-opp-id="'+esc(d.id||'')+'" data-account="'+esc(d.account||'')+'" data-close="'+esc(d.expected_close||'')+'" style="font-size:11px;color:'+(d.expected_close?'var(--gold)':'var(--text3)')+';cursor:pointer;'+(d.expected_close?'font-weight:600':'')+'">'+( d.expected_close?''+d.expected_close:'+ Set close date')+'</span>' +
            (d.licenses_units ? '<span style="font-size:11px;color:var(--text3)">' + d.licenses_units + ' units</span>' : '') +
            (d.icp_score != null ? '<span style="font-size:11px;font-weight:600;padding:1px 6px;border-radius:var(--r-sm);background:' + (d.icp_score>=70?'rgba(74,140,92,.15)':d.icp_score>=40?'rgba(var(--c-accent-rgb),.15)':'rgba(136,135,128,.15)') + ';color:' + (d.icp_score>=70?'var(--green)':d.icp_score>=40?'var(--gold)':'var(--text3)') + '" title="ICP fit: ' + esc(d.icp_notes||'') + '">ICP ' + d.icp_score + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0">' +
          '<div style="font-size:16px;font-weight:600;color:var(--gold)">' + fmtUsd(d.deal_value_usd) + '</div>' +
          '<div style="font-size:11px;color:var(--text3)">USD</div>' +
          '<div style="margin-top:4px;font-size:11px;color:var(--text3)">' + prob + '% → ' + fmtUsd(d.weighted_value_usd) + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">' +
 '<button onclick="' + (d.tier==='verified' ? 'openDealValueForm(\''+d.id+'\',\''+esc(d.account)+'\')' : d.tier==='partial' ? 'boostSignals(\''+d.id+'\',\''+esc(d.account)+'\')' : 'openDealValueForm(\''+d.id+'\',\''+esc(d.account)+'\')') + '" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid ' + (d.tier==='verified'?'var(--border2)':d.tier==='partial'?'var(--amber)':'var(--green)') + ';background:transparent;color:' + (d.tier==='verified'?'var(--text3)':d.tier==='partial'?'var(--amber)':'var(--green)') + ';cursor:pointer">' + (d.tier==='verified'?'Edit':d.tier==='partial'?'Boost':'Confirm') + '</button>' +
            '<button onclick="openAccountTimeline(\''+esc(d.id)+'\',\''+esc(d.account)+'\')" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 10px;border-radius:var(--r-sm);border:1px solid rgba(var(--c-accent-rgb),0.4);background:rgba(var(--c-accent-rgb),0.08);color:var(--gold);font-weight:600;cursor:pointer"><img src="icons/icon-48.png" alt="" style="width:12px;height:12px;border-radius:50%"/>Timeline</button>' +
            '<button onclick="openCloseDeal(\''+esc(d.id)+'\',\''+esc(d.account)+'\')" style="font-size:11px;padding:3px 10px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer">Close deal</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  };

  var html = '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Deal breakdown</div>';

  groupOrder.forEach(function(root) {
    var group = groups[root];
    if (group.length === 1) {
      // Single deal — render directly with LinkedIn icon
      var d = group[0];
      var liLink = d.company_linkedin_url
        ? '<a href="' + esc(d.company_linkedin_url) + '" target="_blank" onclick="event.stopPropagation()" title="LinkedIn company page" style="display:inline-flex;align-items:center;color:#0A66C2;opacity:0.85;text-decoration:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>'
        : '';
      // Inject liLink into first name span — we do it via a wrapper
      html += renderDealCard(d).replace(
        '<span style="font-size:12px;font-weight:500;color:var(--text)">' + esc(d.account) + '</span>',
        '<span style="font-size:12px;font-weight:500;color:var(--text)">' + esc(d.account) + '</span>' + liLink
      );
    } else {
      // Multiple deals for same company — show company header + grouped cards
      var totalVal = group.reduce(function(s, d) { return s + (d.deal_value_usd||0); }, 0);
      var liLink2 = group[0].company_linkedin_url
        ? '<a href="' + esc(group[0].company_linkedin_url) + '" target="_blank" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;color:#0A66C2;opacity:0.85;text-decoration:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>'
        : '';
      var repAvatars = group.map(function(d) {
        var ini = (d.rep_email||'').split('@')[0].split(/[._]/).map(function(w){return w[0]||'';}).slice(0,2).join('').toUpperCase();
        return '<span style="font-size:11px;width:20px;height:20px;border-radius:50%;background:var(--surface2);border:1px solid var(--border2);display:inline-flex;align-items:center;justify-content:center;color:var(--text3);margin-left:-4px" title="' + esc((d.rep_email||'').split('@')[0]) + '">' + ini + '</span>';
      }).join('');

      html += '<div style="border:1px solid var(--border2);border-radius:var(--r-md);padding:10px 12px;margin-bottom:8px;background:var(--bg)">';
      // Company header row
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)">';
      html += '<span style="font-size:13px;font-weight:600;color:var(--text)">' + esc(group[0].account.split(/[\s]/)[0]) + '</span>';
      html += liLink2;
      html += '<span style="font-size:11px;color:var(--text3)">' + group.length + ' opportunities</span>';
      html += '<span style="font-size:11px;font-weight:600;color:var(--gold);margin-left:auto">' + fmtUsd(totalVal) + ' total</span>';
      html += '<div style="display:flex;margin-left:8px">' + repAvatars + '</div>';
      html += '</div>';
      // Sub-deals
      group.forEach(function(d) {
        html += renderDealCard(d);
      });
      html += '</div>';
    }
  });

  el.innerHTML = html;
}


// ── Close Deal Modal ──────────────────────────────────────────────────────────
// ── Edit close date per opportunity ──────────────────────────────────────────
async function editCloseDate(oppId, accountName, currentDate) {
  document.getElementById('edit-close-modal')?.remove();
  var modal = document.createElement('div');
  modal.id = 'edit-close-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;z-index:9999';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:480px;padding:22px 20px" onclick="event.stopPropagation()">' +
 '<div style="font-size:15px;font-weight:700;margin-bottom:4px">Edit close date</div>' +
    '<div style="font-size:12px;color:var(--text3);margin-bottom:14px">' + esc(String(accountName||'')) + '</div>' +
    '<input type="date" id="editCloseDateInput" value="' + esc(String(currentDate||'')) + '" style="width:100%;padding:11px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-family:var(--sans);font-size:14px;outline:none;margin-bottom:14px"/>' +
    '<button id="saveCloseDateBtn" style="width:100%;padding:12px;background:var(--gold);border:none;border-radius:var(--r-md);color:var(--c-canvas);font-family:var(--sans);font-size:14px;font-weight:700;cursor:pointer">Save</button>' +
    '<button id="cancelCloseDateBtn" style="width:100%;padding:10px;background:none;border:none;color:var(--text3);font-family:var(--sans);font-size:13px;cursor:pointer;margin-top:4px">Cancel</button>' +
  '</div>';
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
  document.getElementById('saveCloseDateBtn').addEventListener('click', function(){ saveCloseDate(oppId); });
  document.getElementById('cancelCloseDateBtn').addEventListener('click', function(){ modal.remove(); });
}

async function saveCloseDate(oppId) {
  var val = document.getElementById('editCloseDateInput')?.value;
  if (!val) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'update_opportunity_field', opportunity_id:oppId, field:'expected_close', value:val}) });
    var d = await r.json();
    if (d.ok) { showToast('Close date updated'); document.getElementById('edit-close-modal')?.remove(); loadPipeline(); }
    else { showToast('Error: ' + (d.error||'Failed')); }
  } catch(e) { showToast('Error: ' + e.message); }
}

function openCloseDeal(opportunityId, accountName) {
  document.getElementById('close-deal-modal')?.remove();
  var modal = document.createElement('div');
  modal.id = 'close-deal-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:480px;padding:22px 20px" onclick="event.stopPropagation()">' +
    '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">Close deal</div>' +
    '<div style="font-size:12px;color:var(--text3);margin-bottom:16px">' + esc(accountName) + '</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:14px">' +
 '<button id="cd-won-btn" onclick="setCloseStatus(\'won\')" style="flex:1;padding:12px;border-radius:10px;border:2px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--sans);font-size:14px;font-weight:600;cursor:pointer">Won</button>' +
 '<button id="cd-lost-btn" onclick="setCloseStatus(\'lost\')" style="flex:1;padding:12px;border-radius:10px;border:2px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--sans);font-size:14px;font-weight:600;cursor:pointer">Lost</button>' +
    '</div>' +
    '<div id="cd-won-fields" style="display:none;margin-bottom:12px">' +
      '<label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Actual close value (USD)</label>' +
      '<input id="cd-actual-value" type="number" placeholder="e.g. 45000" style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-family:var(--sans);font-size:14px;outline:none;box-sizing:border-box"/>' +
    '</div>' +
    '<div id="cd-lost-fields" style="display:none;margin-bottom:12px">' +
      '<label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Loss reason</label>' +
      '<select id="cd-reason" style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-family:var(--sans);font-size:13px;outline:none">' +
        '<option value="">Select reason…</option>' +
        '<option value="price">Price / budget</option>' +
        '<option value="competitor">Lost to competitor</option>' +
        '<option value="no_decision">No decision / shelved</option>' +
        '<option value="timing">Bad timing</option>' +
        '<option value="product_fit">Product fit</option>' +
        '<option value="champion_left">Champion left the company</option>' +
        '<option value="other">Other</option>' +
      '</select>' +
    '</div>' +
    '<button onclick="confirmCloseDeal(\'' + esc(opportunityId) + '\')" style="width:100%;padding:13px;border:none;border-radius:var(--r-md);background:var(--gold);color:var(--c-canvas);font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans)">Confirm close</button>' +
    '<button onclick="document.getElementById(\'close-deal-modal\').remove()" style="width:100%;padding:10px;border:none;background:none;color:var(--text3);font-size:13px;cursor:pointer;font-family:var(--sans);margin-top:4px">Cancel</button>' +
  '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);
}
var _cdStatus = '';
function setCloseStatus(status) {
  _cdStatus = status;
  var wonBtn = document.getElementById('cd-won-btn'), lostBtn = document.getElementById('cd-lost-btn');
  var wonF = document.getElementById('cd-won-fields'), lostF = document.getElementById('cd-lost-fields');
  if (wonBtn) wonBtn.style.borderColor = status==='won' ? 'var(--green)' : 'var(--border)';
  if (lostBtn) lostBtn.style.borderColor = status==='lost' ? 'var(--coral)' : 'var(--border)';
  if (wonF) wonF.style.display = status==='won' ? 'block' : 'none';
  if (lostF) lostF.style.display = status==='lost' ? 'block' : 'none';
}
async function confirmCloseDeal(opportunityId) {
  if (!_cdStatus) { alert('Select Won or Lost'); return; }
  var actualValue = document.getElementById('cd-actual-value')?.value;
  var reason = document.getElementById('cd-reason')?.value;
  try {
    await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'close_opportunity', opportunity_id:opportunityId, status:_cdStatus, close_reason:reason||null, actual_value_usd:actualValue?parseFloat(actualValue):null })
    });
    document.getElementById('close-deal-modal')?.remove();
 showToast(_cdStatus === 'won' ? 'Deal marked Won' : 'Deal marked Lost');
    if (typeof loadPipeline === 'function') loadPipeline();
  } catch(e) { alert('Error: ' + e.message); }
}

// ── Account Timeline ──────────────────────────────────────────────────────────
var _tlDays = 60;
async function openAccountTimeline(accountId, accountName) {
  document.getElementById('timeline-modal')?.remove();
  window._tlAcct = { id: accountId, name: accountName };
  var modal = document.createElement('div');
  modal.id = 'timeline-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  var rangeBtns = [30,60,180].map(function(dn){
    var on = _tlDays === dn;
    return '<span onclick="_setTimelineDays(' + dn + ')" style="padding:3px 11px;cursor:pointer;font-size:11px;background:' + (on?'var(--surface)':'transparent') + ';color:' + (on?'var(--text)':'var(--text3)') + '">' + dn + 'd</span>';
  }).join('');
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:520px;padding:20px;max-height:82vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
      '<div><div style="font-size:14px;font-weight:700;color:var(--text)">Account timeline</div><div id="timeline-sub" style="font-size:12px;color:var(--text3)">' + esc(accountName) + ' · last ' + _tlDays + ' days</div></div>' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span id="timeline-range" style="display:inline-flex;border:1px solid var(--border2);border-radius:var(--r-sm);overflow:hidden">' + rangeBtns + '</span>' +
 '<button onclick="document.getElementById(\'timeline-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"></button>' +
      '</div>' +
    '</div>' +
    '<div style="margin-bottom:12px">' + _samoraIntelLabel('Intelligence-guided timeline') + '</div>' +
    '<div id="timeline-body"><div style="font-size:12px;color:var(--text3);padding:20px 0;text-align:center">Loading…</div></div>' +
  '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);
  _loadTimelineBody();
}

function _setTimelineDays(dn) {
  _tlDays = dn;
  ['30','60','180'].forEach(function(){});
  var rng = document.getElementById('timeline-range');
  if (rng) rng.innerHTML = [30,60,180].map(function(x){
    var on = _tlDays === x;
    return '<span onclick="_setTimelineDays(' + x + ')" style="padding:3px 11px;cursor:pointer;font-size:11px;background:' + (on?'var(--surface)':'transparent') + ';color:' + (on?'var(--text)':'var(--text3)') + '">' + x + 'd</span>';
  }).join('');
  var sub = document.getElementById('timeline-sub');
  if (sub && window._tlAcct) sub.textContent = window._tlAcct.name + ' · last ' + _tlDays + ' days';
  _loadTimelineBody();
}

async function _loadTimelineBody() {
  var body = document.getElementById('timeline-body');
  if (!body || !window._tlAcct) return;
  body.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:20px 0;text-align:center">Loading…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'get_account_timeline', account_id:window._tlAcct.id, days:_tlDays }) });
    var data = await r.json();
    body = document.getElementById('timeline-body'); if (!body) return;
    var acts = (data.activities || data.timeline || []).filter(function(e){ return e && e.date; });
    var series = data.score_series || [];
    if (!acts.length && !series.length) { body.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:20px 0;text-align:center">No activity found in the last ' + _tlDays + ' days.</div>'; return; }
    body.innerHTML = _renderTimelineIntel(acts, data.engagement, series, data) + _renderTimelineEvents(acts);
  } catch(e) {
    var b = document.getElementById('timeline-body');
    if (b) b.innerHTML = '<div style="color:var(--coral);font-size:12px">Error: ' + esc(e.message) + '</div>';
  }
}

// Days since a date. Returns null for anything unparseable OR in the future.
//
// This previously returned a raw subtraction, so a future dated row produced a
// NEGATIVE number, which surfaced as "Last touch -1d ago" and "touched in the
// last -1 days". Worse than the wrong label: the temperature rule below is
// `daysQuiet <= 3`, and a negative satisfies that, so one scheduled meeting
// made a dead account read "Hot". An account at 11/100 health, dark 35 days,
// was being shown as the hottest thing on the page.
//
// A future date is not a touch. It has not happened yet.
function _tlDaysAgo(dateStr) {
  var t = new Date(dateStr).getTime();
  if (isNaN(t)) return null;
  var d = Math.floor((Date.now() - t) / 86400000);
  return d < 0 ? null : d;
}

// ── Samora Intelligence panel: temperature, momentum, activity, engagement ───
function _renderTimelineIntel(acts, engagement, series, meta) {
  series = (series || []).filter(function(s){ return s && s.date; }).slice().sort(function(a,b){ return new Date(a.date) - new Date(b.date); });
  var firstScore = series.length ? series[0].score : null;
  var lastScore = series.length ? series[series.length - 1].score : null;
  var scoreDelta = (firstScore != null && lastScore != null) ? lastScore - firstScore : null;

  // Only activity that has ALREADY happened counts as a touch. A scheduled
  // meeting is a plan, not contact, and letting one in is what produced the
  // negative "last touch" and the false Hot reading.
  var _now = Date.now();
  var actDates = acts.map(function(a){ return a.date; }).filter(function(dt){
    if (!dt) return false;
    var t = new Date(dt).getTime();
    return !isNaN(t) && t <= _now;
  }).sort();
  var lastDate = actDates.length ? actDates[actDates.length - 1] : null;
  // Score history is a fallback ONLY. A score changing is Samora recalculating,
  // not somebody being contacted, so it must never masquerade as a touch when
  // real activity exists.
  if (!lastDate && series.length) {
    var pastScores = series.filter(function(s){ var t=new Date(s.date).getTime(); return !isNaN(t) && t <= _now; });
    lastDate = pastScores.length ? pastScores[pastScores.length - 1].date : null;
  }
  var daysQuiet = lastDate ? _tlDaysAgo(lastDate) : null;

  // ── The backend's answer wins ────────────────────────────────────────────
  // Deriving last touch from the activity list makes it WINDOW DEPENDENT, and
  // that is what produced the contradiction where one account read "6d ago" on
  // the 30d view and "29d ago" on the 60d view. The list is deduplicated by
  // label, so a repeated label could drop its most recent instance once a
  // wider window pulled in an older one.
  //
  // last_touch_days is computed server-side from real mailbox timestamps and
  // trusted meeting records, independent of the window, and it is the same
  // number the pipeline "Dark Nd" chip now reads. One account, one answer.
  if (meta && meta.last_touch_days != null && meta.last_touch_days >= 0) {
    daysQuiet = meta.last_touch_days;
  }

  var activeDays = {};
  acts.forEach(function(a){ if (a.date) activeDays[a.date.slice(0,10)] = 1; });
  var nActiveDays = Object.keys(activeDays).length;
  var realTouches = acts.filter(function(a){ return a.type !== 'score_change'; }).length;

  var sent = { positive:0, negative:0, neutral:0 };
  acts.forEach(function(a){ if (a.sentiment && sent[a.sentiment] != null) sent[a.sentiment]++; });
  var sentTot = sent.positive + sent.negative + sent.neutral;

  var temp, tempColor, tempWhy;
  // Ordered so the null case is caught first and every branch below can rely
  // on daysQuiet being a real non-negative number.
  if (daysQuiet == null) { temp = 'Quiet'; tempColor = 'var(--text3)'; tempWhy = 'no past activity on record'; }
  else if (daysQuiet <= 3 && (scoreDelta || 0) > 0) { temp = 'Hot'; tempColor = 'var(--coral)'; tempWhy = 'touched ' + (daysQuiet === 0 ? 'today' : daysQuiet + ' day' + (daysQuiet===1?'':'s') + ' ago') + ', signal rising'; }
  else if ((scoreDelta || 0) > 0 && daysQuiet <= 14) { temp = 'Warming'; tempColor = 'var(--amber)'; tempWhy = 'signal up ' + scoreDelta + ' points, active this fortnight'; }
  else if (daysQuiet <= 14) { temp = 'Steady'; tempColor = 'var(--green)'; tempWhy = 'consistent contact, last touch ' + daysQuiet + ' day' + (daysQuiet===1?'':'s') + ' ago'; }
  else if (daysQuiet <= 30 || (scoreDelta || 0) < 0) { temp = 'Cooling'; tempColor = 'var(--amber)'; tempWhy = daysQuiet + ' days quiet' + ((scoreDelta||0) < 0 ? ', signal slipping' : ''); }
  else { temp = 'Cold'; tempColor = 'var(--coral)'; tempWhy = 'no activity for ' + daysQuiet + ' days'; }

  var momTxt = scoreDelta == null ? 'n/a' : (scoreDelta > 0 ? '+' + scoreDelta : String(scoreDelta));
  var momColor = scoreDelta == null ? 'var(--text3)' : (scoreDelta > 0 ? 'var(--green)' : scoreDelta < 0 ? 'var(--coral)' : 'var(--text3)');
  var momSub = (firstScore != null && lastScore != null) ? firstScore + ' to ' + lastScore : 'no score history';

  var tiles = [
    { label:'Temperature', value: temp, sub:'', color: tempColor },
    { label:'Signal momentum', value: momTxt, sub: momSub, color: momColor },
    { label:'Last touch', value: daysQuiet == null ? 'n/a' : (daysQuiet === 0 ? 'today' : daysQuiet + 'd ago'), sub: nActiveDays + ' active day' + (nActiveDays===1?'':'s'), color: (daysQuiet != null && daysQuiet <= 14) ? 'var(--green)' : 'var(--amber)' },
    { label:'Activities', value: String(realTouches), sub:'meetings, mails, notes', color:'var(--text)' }
  ];

  var h = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:14px;margin-bottom:16px">';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
    '<span style="font-size:13px;font-weight:700;color:' + tempColor + '">' + temp + '</span>' +
    '<span style="font-size:12px;color:var(--text3)">' + esc(tempWhy) + '</span>' +
  '</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">';
  tiles.forEach(function(t) {
    h += '<div style="background:var(--surface2);border-radius:var(--r-md);padding:9px 11px">' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:2px">' + t.label + '</div>' +
      '<div style="font-size:16px;font-weight:700;color:' + t.color + ';line-height:1.1">' + esc(t.value) + '</div>' +
      (t.sub ? '<div style="font-size:11px;color:var(--text3);margin-top:1px">' + esc(t.sub) + '</div>' : '') +
    '</div>';
  });
  h += '</div>';

  if (engagement && engagement.sent != null) {
    var eg = engagement;
    var latTxt = eg.reply_latency_hours == null ? 'n/a' : eg.reply_latency_hours < 24 ? eg.reply_latency_hours + 'h' : Math.round(eg.reply_latency_hours / 24) + 'd';
    var eTiles = [
      { label:'Reply rate', value: eg.reply_rate != null ? eg.reply_rate + '%' : 'n/a', color:'var(--gold)' },
      { label:'Reply speed', value: latTxt, color: (eg.reply_latency_hours != null && eg.reply_latency_hours <= 48) ? 'var(--green)' : 'var(--text2)' },
      { label:'Msgs / 14d', value: String(eg.thread_velocity_14d || 0), color: eg.thread_velocity_14d ? 'var(--green)' : 'var(--text3)' },
      { label:'Contacts', value: String(eg.contacts_seen || 0) + (eg.new_contacts_14d ? ' (+' + eg.new_contacts_14d + ')' : ''), color: eg.new_contacts_14d ? 'var(--green)' : 'var(--text2)' }
    ];
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border2)">';
    eTiles.forEach(function(t) {
      h += '<div style="text-align:center"><div style="font-size:14px;font-weight:700;color:' + t.color + '">' + esc(t.value) + '</div><div style="font-size:11px;color:var(--text3)">' + t.label + '</div></div>';
    });
    h += '</div>';
    var notes = [];
    if (eg.new_contacts_14d) notes.push(eg.new_contacts_14d + ' new contact' + (eg.new_contacts_14d===1?'':'s') + ' entered the thread this fortnight, buying group widening');
    if (eg.inbound_initiated) notes.push('they emailed first, inbound-initiated');
    if (eg.sent && !eg.replies) notes.push(eg.sent + ' sent, no reply yet');
    if (notes.length) h += '<div style="font-size:11px;color:var(--text3);margin-top:6px;font-style:italic">' + esc(notes.join(' · ')) + '</div>';
  }

  if (sentTot) {
    var pos = Math.round(sent.positive / sentTot * 100);
    h += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border2)">' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:4px"><span>Sentiment across ' + sentTot + ' activit' + (sentTot===1?'y':'ies') + '</span><span>' + pos + '% positive</span></div>' +
      '<div style="display:flex;height:5px;border-radius:var(--r-sm);overflow:hidden;background:var(--surface2)">' +
        (sent.positive ? '<div style="width:' + (sent.positive/sentTot*100) + '%;background:var(--green)"></div>' : '') +
        (sent.neutral ? '<div style="width:' + (sent.neutral/sentTot*100) + '%;background:var(--text3)"></div>' : '') +
        (sent.negative ? '<div style="width:' + (sent.negative/sentTot*100) + '%;background:var(--coral)"></div>' : '') +
      '</div>' +
    '</div>';
  }
  h += '</div>';
  return h;
}

// ── Activity feed: each event with sentiment, signal impact, and a why toggle ─
function _renderTimelineEvents(acts) {
  var sentColors = { positive:'var(--green)', negative:'var(--coral)', neutral:'var(--text3)' };
  var fmt = function(d) { return d ? new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : ''; };
  var h = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Activity</div>';
  if (!acts.length) {
    return h + '<div style="font-size:12px;color:var(--text3);font-style:italic;padding:4px 0">No account activity in the window. Signal has held steady.</div>';
  }
  h += acts.map(function(a, idx) {
    var col = sentColors[a.sentiment] || 'var(--text3)';
    var wid = 'tlwhy-' + idx;
    var chip = '';
    if (a.delta != null && a.delta !== 0) {
      var dc = a.delta > 0 ? 'var(--green)' : 'var(--coral)';
      chip = '<span style="font-size:11px;font-weight:700;color:' + dc + ';background:var(--surface2);padding:1px 7px;border-radius:var(--r-sm);flex-shrink:0">' + (a.delta > 0 ? '+' : '') + a.delta + '</span>';
    } else if (a.impact === 'up') {
      chip = '<span style="font-size:11px;color:var(--green);flex-shrink:0" title="lifts the signal">▲</span>';
    } else if (a.impact === 'down') {
      chip = '<span style="font-size:11px;color:var(--coral);flex-shrink:0" title="weighs on the signal">▼</span>';
    }
    return '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">' +
      '<div style="width:44px;flex-shrink:0;text-align:right;font-size:11px;color:var(--text3);padding-top:3px">' + esc(fmt(a.date)) + '</div>' +
      '<div style="width:3px;flex-shrink:0;background:' + col + ';border-radius:var(--r-sm)"></div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:7px">' +
          '<span style="font-size:12px;font-weight:600;color:var(--text);flex:1;min-width:0">' + esc(a.title || '') + '</span>' +
          chip +
        '</div>' +
        (a.body ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + esc(a.body.slice(0,120)) + '</div>' : '') +
        (a.why ? '<div style="margin-top:3px">' +
          '<span onclick="toggleIntelDrill(\'' + wid + '\')" style="font-size:11px;color:var(--gold);cursor:pointer;user-select:none">why?</span>' +
          '<div id="' + wid + '" style="display:none;font-size:11px;color:var(--text2);line-height:1.5;margin-top:4px;padding:8px 10px;background:var(--surface2);border-radius:var(--r-sm)">' + esc(a.why) + '</div>' +
        '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');
  return h;
}

// ── "Why this score?" — rule-level health-score breakdown ────────────────────
// Transparency principle: every number shows its receipts.
async function openHealthBreakdown(accountId, accountName) {
  document.getElementById('health-breakdown-modal')?.remove();
  var modal = document.createElement('div');
  modal.id = 'health-breakdown-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:520px;padding:20px;max-height:80vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
      '<div><div style="font-size:14px;font-weight:700;color:var(--text)">Why this score?</div><div style="font-size:12px;color:var(--text3)">' + esc(accountName) + ' · deal health breakdown</div></div>' +
 '<button onclick="document.getElementById(\'health-breakdown-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"></button>' +
    '</div>' +
    '<div style="margin-bottom:12px">' + _samoraIntelLabel('Deterministic rules, no AI in this number') + '</div>' +
    '<div id="health-breakdown-body"><div style="font-size:12px;color:var(--text3);padding:20px 0;text-align:center">Loading…</div></div>' +
  '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);

  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'get_health_breakdown', account_id:accountId }) });
    var data = await r.json();
    var body = document.getElementById('health-breakdown-body');
    if (!body) return;
    if (!data.ok || !data.components || !data.components.length) {
      // Honest empty state — never fake a breakdown
      body.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:20px 8px;text-align:center;line-height:1.5">' +
        'No breakdown available for this score yet.<br>It may have been computed before the transparency update. It will populate on the next scoring run.</div>';
      return;
    }

    var rows = data.components.map(function(c) {
      // Customers get how strongly each rule is met; the weights behind the
      // score stay with Samora and the server no longer sends them. A Samora
      // admin still gets points and weights.
      var hasFormula = c.weight != null;
      var pts = Math.round(c.points || 0);
      var maxPts = c.weight || 0;
      var pct = hasFormula ? (maxPts ? Math.min(100, Math.round((pts / maxPts) * 100)) : 0) : Math.max(0, Math.min(100, Number(c.strength) || 0));
      var strengthWord = pct >= 70 ? 'Strong' : pct >= 40 ? 'Partial' : pct > 0 ? 'Weak' : 'Missing';
      var barColor = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--coral)';
      return '<div style="padding:10px 0;border-bottom:1px solid var(--border)">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">' +
          '<span style="font-size:12px;font-weight:600;color:var(--text)">' + esc(c.label || c.key || '') + (hasFormula ? ' <span style="font-weight:400;color:var(--text3)">· weight ' + maxPts + '%</span>' : '') + '</span>' +
          '<span style="font-size:12px;font-weight:700;color:' + barColor + '">' + (hasFormula ? pts + ' / ' + maxPts : strengthWord) + '</span>' +
        '</div>' +
        '<div style="height:4px;background:var(--border2);border-radius:var(--r-sm);overflow:hidden;margin-bottom:5px"><div style="height:100%;width:' + pct + '%;background:' + barColor + '"></div></div>' +
        (c.raw ? '<div style="font-size:11px;color:var(--text2)">' + esc(c.raw) + '</div>' : '') +
        (c.evidence ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">Evidence: ' + esc(c.evidence) + (c.evidence_date ? ' · ' + esc(new Date(c.evidence_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})) : '') + '</div>' : '') +
      '</div>';
    }).join('');

    var computedAt = data.computed_at ? new Date(data.computed_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : null;
    body.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 4px">' +
        '<span style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em">Rule</span>' +
        '<span style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em">' + ((data.components[0] && data.components[0].weight != null) ? 'Points' : 'Strength') + '</span>' +
      '</div>' +
      rows +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0 4px">' +
        '<span style="font-size:13px;font-weight:700;color:var(--text)">Health score</span>' +
        '<span style="font-size:16px;font-weight:700;color:var(--gold)">' + (data.health_score != null ? data.health_score : '—') + ' / 100</span>' +
      '</div>' +
      (computedAt ? '<div style="font-size:11px;color:var(--text3);text-align:right">Computed ' + esc(computedAt) + '</div>' : '') +
      '<div style="font-size:11px;color:var(--text3);margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">The score combines these rules. What each one found is shown above.</div>';
  } catch(e) {
    var b = document.getElementById('health-breakdown-body');
    if (b) b.innerHTML = '<div style="color:var(--coral);font-size:12px">Error: ' + esc(e.message) + '</div>';
  }
}

// ── ICP Definition & Scoring ──────────────────────────────────────────────────
async function loadIcpDefinition() {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_org_setting', key:'icp_definition'}) });
    var d = await r.json();
    var el = document.getElementById('icpDefinitionInput');
    if (el && d.value) el.value = d.value;
  } catch(e) { /* non-fatal */ }
}

async function saveIcpDefinition() {
  var btn    = document.getElementById('saveIcpBtn');
  var badge  = document.getElementById('icpSavedBadge');
  var status = document.getElementById('icpScoreStatus');
  var val    = document.getElementById('icpDefinitionInput')?.value?.trim();
  if (!val) { showToast('Please enter an ICP definition first'); return; }
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'save_org_setting', key:'icp_definition', value:val}) });
    var d = await r.json();
    if (d.ok) {
      if (badge) badge.style.display = 'inline';
      if (status) status.textContent = 'Saved, click "Score accounts now" to update ICP scores.';
      showToast('ICP definition saved');
    } else { showToast('Error: ' + (d.error || 'Save failed')); }
  } catch(e) { showToast('Error: ' + e.message); }
  if (btn) { btn.textContent = 'Save ICP definition'; btn.disabled = false; }
}

async function runIcpScoring() {
  var btn     = document.querySelector('[onclick="runIcpScoring()"]');
  var samBtn  = document.getElementById('icp-score-btn');
  var status  = document.getElementById('icpScoreStatus');
  var results = document.getElementById('icpScoreResults');
 [btn, samBtn].forEach(function(b){ if(b){b.textContent='Scoring…';b.disabled=true;} });
 if (status) status.textContent = 'SAM is scoring your accounts…';
  if (results) results.innerHTML = '';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'compute_icp_scores'}) });
    var d = await r.json();
    if (!d.ok) { if (status) status.textContent = 'Error: ' + (d.error||'Scoring failed'); return; }
 if (status) status.textContent = 'Scored ' + (d.scored||0) + ' accounts';
    showToast('ICP scored: ' + (d.scored||0) + ' accounts updated');
    if (d.scores && d.scores.length && results) {
      results.innerHTML = '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Results</div>' +
        d.scores.sort(function(a,b){return (b.icp_score||0)-(a.icp_score||0);}).map(function(s) {
          var c = (s.icp_score||0)>=70?'var(--green)':(s.icp_score||0)>=40?'var(--amber)':'var(--text3)';
          return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">' +
            '<span style="font-size:12px;font-weight:700;color:'+c+';min-width:30px;text-align:right">'+(s.icp_score??'?')+'</span>' +
            '<span style="font-size:12px;color:var(--text);flex:1">'+esc(s.account_name||'')+'</span>' +
            (s.icp_notes?'<span style="font-size:11px;color:var(--text3);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(s.icp_notes)+'">'+esc(s.icp_notes.slice(0,45))+'</span>':'') +
          '</div>';
        }).join('');
    }
    if (typeof loadPipeline === 'function') loadPipeline();
  } catch(e) { if (status) status.textContent = 'Error: ' + e.message; }
 [btn, samBtn].forEach(function(b){ if(b){b.textContent=b===samBtn?'Score ICP fit':'Score accounts now';b.disabled=false;} });
}

async function computeIcpScores() { runIcpScoring(); }  // alias for SAM tab button


// ── Deal Value & Revenue Streams Modal ──────────────────────────────────────
// ── Deal Modal State ──────────────────────────────────────────────────────────
var _dealGroups    = [];
var _dealAccountId = '';
var _dealAccountName = '';
var _dealOpportunityId = null;
var _orgProducts   = [];
var _orgStreamTypes = [  // populated fresh on modal open, fallback always has items
  {key:'license_mrr',  label:'License MRR',          type:'MRR'},
  {key:'impl',         label:'Implementation',        type:'one_time'},
  {key:'support_qrr',  label:'Support & Maintenance', type:'QRR'},
  {key:'training',     label:'Training',              type:'one_time'}
];

async function openDealValueForm(accountId, accountName, opportunityId) {
  _dealAccountId    = accountId;
  _dealAccountName  = accountName;
  _dealOpportunityId = opportunityId || null;
  document.getElementById('deal-value-modal')?.remove();

  // Show brief loading state
  var loader = document.createElement('div');
  loader.id = 'deal-value-modal';
  loader.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:flex-end;justify-content:center;z-index:999';
  loader.innerHTML = '<div style="background:var(--bg);border-radius:3px 20px 0 0;width:100%;max-width:560px;padding:24px;text-align:center"><div style="font-size:13px;color:var(--text3)">Loading\u2026</div></div>';
  document.body.appendChild(loader);

  // Always re-fetch org config + products to ensure stream types are fresh
  try {
    var [cfgRes, prodRes] = await Promise.all([
      fetch(EDGE_FN_URL, { method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({action:'get_org_config'}) }),
      fetch(EDGE_FN_URL, { method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({action:'get_products'}) })
    ]);
    var cfg  = await cfgRes.json();
    var prod = await prodRes.json();
    if (cfg.ok)  {
      window._orgConfig = cfg;
      if (cfg.revenueStreamTypes && cfg.revenueStreamTypes.length) {
        _orgStreamTypes = cfg.revenueStreamTypes;
      }
    }
    _orgProducts = prod.products || [];
  } catch(e) { _orgProducts = []; }

  // Start with one empty group
  _dealGroups = [{ productId:'', streams:[{name:'',amount:'',currency:window._orgConfig?.defaultCurrency||'USD'}] }];
  renderDealModal();
}

function renderDealModal() {
  document.getElementById('deal-value-modal')?.remove();

  // Use module-level variables — no closure scope issues
  var ST = _orgStreamTypes; // guaranteed to have items (set in openDealValueForm)
  var FX = {USD:1,INR:0.012,EUR:1.08,GBP:1.27,AED:0.272,SAR:0.267,SGD:0.74,AUD:0.65,CAD:0.73,MXN:0.058,BRL:0.19};
  var CCY = ['USD','INR','EUR','GBP','AED','SAR','SGD','AUD','CAD','MXN','BRL'];
  var TYPE_C = {MRR:'#3A6EA8',QRR:'#4A8C5C',ARR:'#7B5EA7',one_time:'#A07824'};

  function fmt(v) { return fmtOrgMoney(v || 0); }

  function getType(name) {
    var d = ST.find(function(t){return (t.key||t.label)===name;});
    return d ? d.type : 'one_time';
  }

  function groupTotal(g) {
    return g.streams.reduce(function(sum,s){
      var usd = (parseFloat(s.amount)||0) * (FX[s.currency]||1);
      var t = getType(s.name);
      return sum + (t==='MRR'?usd*12:t==='QRR'?usd*4:usd);
    }, 0);
  }

  // Build stream options HTML — called with module-level ST, always has items
  function streamOpts(selectedName) {
    return '<option value="">\u2014 Select revenue stream \u2014</option>' +
      ST.map(function(t) {
        var val = t.key || t.label;
        return '<option value="'+esc(val)+'"'+(selectedName===val?' selected':'')+'>'+esc(t.label)+'</option>';
      }).join('');
  }

  function streamRow(s, si, gi, canRemove) {
    var type = getType(s.name);
    var tc = TYPE_C[type] || '#888';
    var badge = type ? '<span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:var(--r-sm);background:'+tc+'18;color:'+tc+';white-space:nowrap">'+type.replace('one_time','One-time')+'</span>' : '';
    return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 12px;margin-bottom:8px">' +

      // Line 1: stream selector + badge + remove button
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<select onchange="_dealGroups['+gi+'].streams['+si+'].name=this.value;renderDealModal()" '+
          'style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);padding:9px 10px;'+
          'color:var(--text);font-family:var(--sans);font-size:13px;outline:none">' +
          streamOpts(s.name) +
        '</select>' +
        badge +
        (canRemove ? '<button onclick="_dealGroups['+gi+'].streams.splice('+si+',1);renderDealModal()" '+
          'style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px;line-height:1;padding:2px 4px;flex-shrink:0">\u00d7</button>' : '') +
      '</div>' +

      // Line 2: amount + currency
      '<div style="display:flex;gap:8px;margin-bottom:8px">' +
        '<input type="number" placeholder="Amount" value="'+(s.amount||'')+'" '+
          'oninput="_dealGroups['+gi+'].streams['+si+'].amount=this.value;updateDealTotal()" '+
          'style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);'+
          'padding:9px 12px;color:var(--text);font-family:var(--sans);font-size:14px;outline:none;text-align:right;font-weight:600"/>' +
        '<select onchange="_dealGroups['+gi+'].streams['+si+'].currency=this.value" '+
          'style="width:75px;flex-shrink:0;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);'+
          'padding:9px 6px;color:var(--text);font-family:var(--sans);font-size:12px;outline:none">' +
          CCY.map(function(c){return '<option'+(s.currency===c?' selected':'')+'>'+c+'</option>';}).join('') +
        '</select>' +
      '</div>' +

      // Line 3: units/licenses (always visible, clearly labelled)
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<div style="font-size:11px;color:var(--text3);flex-shrink:0">Units / licenses / outlets</div>' +
        '<input type="number" placeholder="e.g. 500" value="'+(s.units||'')+'" '+
          'oninput="_dealGroups['+gi+'].streams['+si+'].units=this.value" '+
          'style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);'+
          'padding:7px 10px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none;text-align:right"/>' +
        '<div style="font-size:11px;color:var(--text3);flex-shrink:0">optional</div>' +
      '</div>' +

    '</div>';
  }

  function groupBlock(g, gi) {
    var gTotal = groupTotal(g);
    var prodOpts = '<option value="">\uD83D\uDCE6 Select product/offering\u2026</option>' +
      _orgProducts.map(function(p){
        return '<option value="'+p.id+'"'+(g.productId===p.id?' selected':'')+'>'+esc(p.name)+(p.category?' \u00b7 '+esc(p.category):'')+' </option>';
      }).join('') +
      (_orgProducts.length===0?'<option value="__none">No products, log as general deal</option>':'');

    return '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:14px 16px;margin-bottom:10px">' +
      // Product selector header
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
        '<select onchange="_dealGroups['+gi+'].productId=this.value" '+
          'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);'+
          'padding:9px 12px;color:var(--text);font-family:var(--sans);font-size:14px;font-weight:600;outline:none">' +
          prodOpts +
        '</select>' +
        (gTotal>0 ? '<span style="font-size:14px;font-weight:700;color:var(--gold);flex-shrink:0">'+fmt(gTotal)+'</span>' : '') +
        (_dealGroups.length>1 ? '<button onclick="_dealGroups.splice('+gi+',1);renderDealModal()" '+
          'style="flex-shrink:0;background:none;border:none;border-radius:var(--r-sm);color:var(--coral);cursor:pointer;font-size:12px;padding:4px 0">Remove</button>' : '') +
      '</div>' +
      // Stream rows
      g.streams.map(function(s,si){ return streamRow(s, si, gi, g.streams.length>1); }).join('') +
      // Add stream link
      '<button onclick="_dealGroups['+gi+'].streams.push({name:\'\',amount:\'\',currency:_orgStreamTypes[0]&&\'USD\',units:\'\'}); renderDealModal()" '+
        'style="font-size:12px;color:var(--text3);background:none;border:none;cursor:pointer;padding:4px 0;display:flex;align-items:center;gap:4px">'+
        '+ Add another revenue stream to this offering</button>' +
    '</div>';
  }

  // Grand total
  var grand = _dealGroups.reduce(function(s,g){return s+groupTotal(g);},0);
  var breakdown = _dealGroups.filter(function(g){return groupTotal(g)>0;}).map(function(g){
    var pname = (_orgProducts.find(function(p){return p.id===g.productId;})||{}).name || 'General deal';
    return '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:3px">'+
      '<span>'+esc(pname)+'</span><span style="font-weight:600">'+fmt(groupTotal(g))+'</span></div>';
  }).join('');

  var overlay = document.createElement('div');
  overlay.id = 'deal-value-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:flex-end;justify-content:center;z-index:999';

  overlay.innerHTML =
    '<div style="background:var(--bg);border-top:1px solid var(--border2);border-radius:3px 20px 0 0;'+
      'width:100%;max-width:560px;max-height:92vh;overflow-y:auto;animation:slideUp 0.25s ease">' +

      // ── Header ──
      '<div style="position:sticky;top:0;background:var(--bg);z-index:1;padding:14px 20px;border-bottom:1px solid var(--border)">' +
        '<div style="width:36px;height:4px;background:var(--border2);border-radius:var(--r-sm);margin:0 auto 12px"></div>' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between">' +
          '<div>' +
            '<div style="font-size:20px;font-weight:700;color:var(--text)">\uD83D\uDCB0 '+esc(_dealAccountName)+'</div>' +
            '<div style="font-size:12px;color:var(--text3);margin-top:2px">Log each product being discussed separately</div>' +
          '</div>' +
          '<button onclick="document.getElementById(\'deal-value-modal\').remove()" '+
            'style="background:var(--surface2);border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;'+
            'color:var(--text3);font-size:16px;display:flex;align-items:center;justify-content:center">\u00d7</button>' +
        '</div>' +
      '</div>' +

      '<div style="padding:16px 20px">' +

        // ── Offerings ──
        '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">'+
          'Offerings in discussion ('+_dealGroups.length+')</div>' +
        _dealGroups.map(groupBlock).join('') +
        '<button onclick="_dealGroups.push({productId:\'\',streams:[{name:\'\',amount:\'\',currency:\'USD\',units:\'\'}]});renderDealModal()" '+
          'style="width:100%;padding:11px;background:transparent;border:1.5px dashed var(--border2);border-radius:var(--r-md);'+
          'color:var(--gold);font-family:var(--sans);font-size:13px;font-weight:600;cursor:pointer;margin-bottom:16px">+ Add another offering</button>' +

        // ── Total ──
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;margin-bottom:16px">' +
          (breakdown || '') +
          '<div style="'+(breakdown?'border-top:1px solid var(--border);margin-top:8px;padding-top:8px;':'')+
            'display:flex;justify-content:space-between;align-items:center">' +
            '<div>' +
              '<div style="font-size:12px;color:var(--text3)">Total deal value (USD)</div>' +
              '<div style="font-size:11px;color:var(--text3);margin-top:1px">MRR\u00d712 \u00b7 QRR\u00d74 \u00b7 One-time\u00d71</div>' +
            '</div>' +
            '<div id="deal-total-display" style="font-size:26px;font-weight:700;color:var(--gold)">'+fmt(grand)+'</div>' +
          '</div>' +
        '</div>' +

        // ── Deal details ──
        '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">Deal details</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">' +
          '<div><div style="font-size:11px;color:var(--text3);margin-bottom:5px">Expected close</div>'+
            '<input id="dv-close" type="date" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);padding:10px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none"/></div>' +
          '<div><div style="font-size:11px;color:var(--text3);margin-bottom:5px">Deal type</div>'+
            '<select id="dv-type" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);padding:10px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none">'+
              ['new_business','expansion','renewal','upsell'].map(function(t){return '<option value="'+t+'">'+t.replace('_',' ')+'</option>';}).join('')+
            '</select></div>' +
        '</div>' +

        // ── Probability note ──
        '<div style="background:var(--surface2);border-radius:var(--r-md);padding:10px 14px;margin-bottom:18px;display:flex;gap:10px">' +
          '<span style="font-size:20px">\uD83E\uDDE0</span>' +
          '<div style="font-size:12px;color:var(--text3)"><strong style="color:var(--text2)">Close probability</strong> is auto-derived from stage + conversation signals each time you scan channels.</div>' +
        '</div>' +

        // ── Save ──
        '<button onclick="saveDealValue()" '+
          'style="width:100%;padding:14px;background:var(--gold);border:none;border-radius:var(--r-md);'+
          'color:var(--c-canvas);font-family:var(--sans);font-size:14px;font-weight:700;cursor:pointer">Save opportunities</button>' +
        '<div id="dv-status" style="font-size:12px;margin-top:10px;text-align:center"></div>' +

      '</div>' +
    '</div>';

  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function updateDealTotal() {
  var FX = {USD:1,INR:0.012,EUR:1.08,GBP:1.27,AED:0.272,SAR:0.267,SGD:0.74,AUD:0.65,CAD:0.73,MXN:0.058,BRL:0.19};
  if (orgCur() !== 'USD') FX[orgCur()] = 1 / orgUsdRate();
  var total = 0;
  _dealGroups.forEach(function(g){
    g.streams.forEach(function(s){
      var usd = (parseFloat(s.amount)||0) * (FX[s.currency]||1);
      var def = _orgStreamTypes.find(function(t){return (t.key||t.label)===s.name;});
      var t = def ? def.type : 'one_time';
      total += (t==='MRR'?usd*12:t==='QRR'?usd*4:usd);
    });
  });
  var el = document.getElementById('deal-total-display');
  if (el) el.textContent = fmtOrgMoney(total);
  return total;
}

async function saveDealValue() {
  var statusEl = document.getElementById('dv-status');
  var FX = {USD:1,INR:0.012,EUR:1.08,GBP:1.27,AED:0.272,SAR:0.267,SGD:0.74,AUD:0.65,CAD:0.73,MXN:0.058,BRL:0.19};
  if (orgCur() !== 'USD') FX[orgCur()] = 1 / orgUsdRate();
  var dealType  = document.getElementById('dv-type')?.value  || 'new_business';
  var closeDate = document.getElementById('dv-close')?.value || null;

  // Validate — at least one group with a value
  var validGroups = _dealGroups.filter(function(g){
    return g.streams.some(function(s){return s.name && parseFloat(s.amount)>0;});
  });
  if (!validGroups.length) {
    if (statusEl){statusEl.textContent='Select a stream and enter an amount for at least one offering';statusEl.style.color='var(--coral)';} return;
  }

  if (statusEl){statusEl.textContent='Saving\u2026';statusEl.style.color='var(--text3)';}

  var saved = 0;
  var errors = [];

  for (var gi=0; gi<validGroups.length; gi++) {
    var g = validGroups[gi];
    var validStreams = g.streams.filter(function(s){return s.name&&parseFloat(s.amount)>0;});
    var groupUsd = validStreams.reduce(function(sum,s){
      var usd=(parseFloat(s.amount)||0)*(FX[s.currency]||1);
      var def=_orgStreamTypes.find(function(t){return (t.key||t.label)===s.name;});
      var t=def?.type||'one_time';
      return sum+(t==='MRR'?usd*12:t==='QRR'?usd*4:usd);
    },0);
    var primary = validStreams[0];
    try {
      var r = await fetch(EDGE_FN_URL, {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body: JSON.stringify({
          action:'upsert_opportunity',
          account_id: _dealAccountId,
          product_id: g.productId||null,
          deal_value: parseFloat(primary.amount),
          deal_currency: primary.currency||'USD',
          deal_value_usd: Math.round(groupUsd),
          revenue_streams: validStreams.map(function(s){
            var def=_orgStreamTypes.find(function(t){return (t.key||t.label)===s.name;});
            return {key:def?.key||s.name,label:def?.label||s.name,type:def?.type||'one_time',amount:parseFloat(s.amount),currency:s.currency};
          }),
          deal_type: dealType,
          expected_close: closeDate,
          stage: 'prospective'
        })
      });
      var d = await r.json();
      if (d.ok) saved++; else errors.push(d.error||'Save failed');
    } catch(e){ errors.push(e.message); }
  }

  if (errors.length) {
    if (statusEl){statusEl.textContent='Saved '+saved+', '+errors.length+' error(s): '+errors[0];statusEl.style.color='var(--coral)';}
  } else {
    if (statusEl){statusEl.textContent='\u2713 Saved '+saved+' opportunit'+(saved===1?'y':'ies');statusEl.style.color='var(--green)';}
    setTimeout(function(){ document.getElementById('deal-value-modal')?.remove(); loadMyAccounts(); if(typeof loadPipeline==='function') loadPipeline(); }, 1600);
  }
}

function boostSignals(accountId, accountName) {
  switchTab('signals');
  setTimeout(function() {
    var out = document.getElementById('samLocalIntelOutput');
 if (out) out.innerHTML = '<div style="font-size:12px;color:var(--amber);padding:8px 0">Run "Scan channels" to generate signals for <strong>' + esc(accountName) + '</strong> and move it to verified pipeline.</div>';
    var section = document.getElementById('samLocalIntelSection');
    if (section) section.style.display = 'block';
  }, 300);
}

// ── Relationship coverage depth (deterministic, receipts per deal) ───────────
async function loadRelationshipCoverage() {
  var box = document.getElementById('relationshipCoverage'); if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_relationship_coverage' }) });
    var d = await r.json();
    if (!d.ok) { box.innerHTML = ''; return; }
    var ru = d.rollup || {};
    var deals = d.deals || [];
    var h = '<div style="margin-bottom:10px">' + _samoraIntelLabel('Relationship coverage, deterministic') + '</div>';

    var tiles = [
      { label:'Strong', value: String(ru.strong||0), color:'var(--green)', sub:'well covered' },
      { label:'Partial', value: String(ru.partial||0), color:'var(--amber)', sub:'one gap' },
      { label:'Thin', value: String(ru.thin||0), color:'var(--coral)', sub:'multiple gaps' },
      { label:'Ghost contacts', value: String(ru.ghost_contacts||0), color: ru.ghost_contacts?'var(--amber)':'var(--green)', sub:'enriched, never reached' }
    ];
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:6px">';
    tiles.forEach(function(t) {
      h += '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:11px 13px">' +
        '<div style="font-size:11px;color:var(--text3);margin-bottom:3px">' + t.label + '</div>' +
        '<div style="font-size:20px;font-weight:600;color:' + t.color + ';line-height:1.1">' + t.value + '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + t.sub + '</div>' +
      '</div>';
    });
    h += '</div>';

    var gradeCol = { thin:'var(--coral)', partial:'var(--amber)', strong:'var(--green)' };
    var withGaps = deals.filter(function(dl){ return dl.gaps && dl.gaps.length; });
    h += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:14px 0 6px">Coverage gaps' + (d.scope !== 'self' ? ' (' + d.scope + ')' : '') + '</div>';
    if (!withGaps.length) {
      h += '<div style="font-size:12px;color:var(--text3);font-style:italic;padding:4px 0 6px">Every open deal is well covered for its stage.</div>';
    } else {
      withGaps.forEach(function(dl) {
        var col = gradeCol[dl.grade] || 'var(--text3)';
        h += '<div onclick="openAccountTimeline(\'' + esc(dl.account_id) + '\',\'' + esc(dl.name||'') + '\')" style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;margin-bottom:4px;background:var(--surface);border-left:2px solid ' + col + ';border-radius:0 8px 8px 0;cursor:pointer">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">' +
              '<span style="font-size:12px;font-weight:600;color:var(--text)">' + esc(dl.name) + '</span>' +
              '<span style="font-size:11px;color:var(--text3)">' + esc(dl.value_label) + ' · ' + esc(dl.stage) + '</span>' +
              '<span style="font-size:11px;color:' + col + ';font-weight:700;text-transform:uppercase">' + dl.grade + '</span>' +
            '</div>' +
            '<div style="font-size:11px;color:var(--text3)">' + dl.active + ' of ' + dl.total + ' contacts active' + (dl.senior_active ? ', senior engaged' : ', no senior') + '</div>' +
            '<div style="font-size:11px;color:var(--text2);margin-top:2px">' + dl.gaps.map(function(g){ return esc(g); }).join(' · ') + '</div>' +
          '</div>' +
          '<span style="color:var(--text3);font-size:12px;flex-shrink:0">›</span>' +
        '</div>';
      });
    }
    box.innerHTML = h;
  } catch(e) { box.innerHTML = ''; }
}

// ── Correlated signal states (named deterministic verdicts) ──────────────────
async function loadSignalStates() {
  var box = document.getElementById('signalStates'); if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_signal_states' }) });
    var d = await r.json();
    if (!d.ok || !d.states || !d.states.length) { box.innerHTML = ''; return; }
    var meta = {
 at_risk_to_competitor: { icon:'', color:'var(--coral)' },
 champion_less_closing: { icon:'', color:'var(--coral)' },
 silent_high_value: { icon:'', color:'var(--coral)' },
 pricing_squeeze: { icon:'', color:'var(--amber)' },
 expansion_ready: { icon:'', color:'var(--green)' }
    };
    var h = '<div style="margin-bottom:10px">' + _samoraIntelLabel('Signal states, deterministic verdicts') + '</div>';
    h += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">What the signals add up to' + (d.scope !== 'self' ? ' (' + d.scope + ')' : '') + '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px">';
    d.states.forEach(function(s) {
      var m = meta[s.state] || { icon:'•', color:'var(--text3)' };
      h += '<div onclick="openAccountTimeline(\'' + esc(s.account_id) + '\',\'' + esc(s.account||'') + '\')" style="background:var(--surface);border:1px solid var(--border2);border-left:2px solid ' + m.color + ';border-radius:0 10px 10px 0;padding:10px 12px;cursor:pointer">' +
        '<div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">' +
          '<span style="font-size:14px;flex-shrink:0">' + m.icon + '</span>' +
          '<span style="font-size:12px;font-weight:600;color:var(--text);flex:1;min-width:0">' + esc(s.headline) + '</span>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text3);line-height:1.4">' + esc(s.evidence) + '</div>' +
      '</div>';
    });
    h += '</div>';
    box.innerHTML = h;
  } catch(e) { box.innerHTML = ''; }
}

// ── Deal velocity + forecast integrity (deterministic, receipts per line) ────
async function loadVelocityForecast() {
  var box = document.getElementById('velocityForecast'); if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_velocity_forecast' }) });
    var d = await r.json();
    if (!d.ok) { box.innerHTML = ''; return; }
    var f = d.forecast || {};
    var vel = d.velocity || [];
    var fmtK = function(v){ return fmtOrgMoney(v || 0); };

    var h = '<div style="margin-bottom:10px">' + _samoraIntelLabel('Forecast integrity, deterministic') + '</div>';

    // ── Forecast integrity tiles ─────────────────────────────────────────
    var tiles = [
      { label:'At risk', value: fmtK(f.at_risk_usd||0), sub: (f.at_risk_deals||[]).length + ' deal' + ((f.at_risk_deals||[]).length!==1?'s':'') + ' flagged', color: f.at_risk_usd ? 'var(--coral)' : 'var(--green)', key:'atrisk' },
      { label:'Unverified value', value: fmtK(f.happy_ears_usd||0), sub: (f.happy_ears_count||0) + ' below signal 40', color: f.happy_ears_usd ? 'var(--amber)' : 'var(--green)', key:'happy' },
      { label:'No close date', value: fmtK(f.no_date_usd||0), sub: (f.no_date_count||0) + ' deal' + ((f.no_date_count||0)!==1?'s':''), color: f.no_date_usd ? 'var(--amber)' : 'var(--green)', key:'nodate' },
      { label:'Verified', value: (f.verified_pct||0) + '%', sub: fmtK(f.verified_usd||0) + ' of ' + fmtK(f.total_usd||0), color:'var(--green)', key:'ver' }
    ];
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:6px">';
    tiles.forEach(function(t) {
      var clickable = (t.key === 'atrisk' && (f.at_risk_deals||[]).length) || (t.key === 'happy' && (f.happy_ears_deals||[]).length);
      h += '<div ' + (clickable ? 'onclick="_toggleFcDrill(\'' + t.key + '\')" style="cursor:pointer;' : 'style="') + 'background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:11px 13px">' +
        '<div style="font-size:11px;color:var(--text3);margin-bottom:3px">' + t.label + (clickable ? ' <span style="color:var(--text3);font-size:11px">tap</span>' : '') + '</div>' +
        '<div style="font-size:20px;font-weight:600;color:' + t.color + ';line-height:1.1">' + t.value + '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + esc(t.sub) + '</div>' +
      '</div>';
    });
    h += '</div>';

    // At-risk drill (hidden): which dollars, and why.
    var drill = function(key, deals, label) {
      var x = '<div id="fcDrill-' + key + '" style="display:none;background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:10px 12px;margin-bottom:6px">';
      x += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">' + label + '</div>';
      deals.forEach(function(dl) {
        x += '<div onclick="openAccountTimeline(\'' + esc(dl.account_id) + '\',\'' + esc(dl.name||'') + '\')" style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border);cursor:pointer">' +
          '<span style="font-size:12px;font-weight:600;color:var(--text);min-width:90px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(dl.name) + '</span>' +
          '<span style="font-size:11px;color:var(--text3);flex:1;min-width:0">' + esc(dl.reasons ? dl.reasons.join(', ') : ('signal ' + dl.signal_score + ', unverified')) + '</span>' +
          '<span style="font-size:12px;font-weight:700;color:var(--text2);flex-shrink:0">' + fmtK(dl.value||0) + '</span>' +
        '</div>';
      });
      x += '</div>';
      return x;
    };
    if ((f.at_risk_deals||[]).length) h += drill('atrisk', f.at_risk_deals, 'At-risk dollars, and why');
    if ((f.happy_ears_deals||[]).length) h += drill('happy', f.happy_ears_deals, 'Unverified value, rep entered but signal below 40');

    // ── Slipping / stuck deals ───────────────────────────────────────────
    var stateMeta = {
      regressed: { icon:'↘', color:'var(--coral)' },
 slipping: { icon:'', color:'var(--coral)' },
      stalled:   { icon:'⏸', color:'var(--amber)' },
 plateau: { icon:'', color:'var(--amber)' }
    };
    h += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:14px 0 6px">Losing momentum' + (d.scope !== 'self' ? ' (' + d.scope + ')' : '') + '</div>';
    if (!vel.length) {
      h += '<div style="font-size:12px;color:var(--text3);font-style:italic;padding:4px 0 6px">No deals slipping or stuck. Momentum looks healthy.</div>';
    } else {
      vel.forEach(function(v) {
        var m = stateMeta[v.state] || { icon:'•', color:'var(--text3)' };
        h += '<div onclick="openAccountTimeline(\'' + esc(v.account_id) + '\',\'' + esc(v.name||'') + '\')" style="display:flex;align-items:flex-start;gap:8px;padding:7px 10px;margin-bottom:4px;background:var(--surface);border-left:2px solid ' + m.color + ';border-radius:0 8px 8px 0;cursor:pointer">' +
          '<span style="font-size:12px;flex-shrink:0">' + m.icon + '</span>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:12px;font-weight:500;color:var(--text)">' + esc(v.headline) + '</div>' +
            '<div style="font-size:11px;color:var(--text3);margin-top:1px">' + esc(v.evidence) + '</div>' +
          '</div>' +
          '<span style="color:var(--text3);font-size:12px;flex-shrink:0">›</span>' +
        '</div>';
      });
    }
    box.innerHTML = h;
  } catch(e) { box.innerHTML = ''; }
}

function _toggleFcDrill(key) {
  var el = document.getElementById('fcDrill-' + key); if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ── Revenue Truth Console: 5 derived numbers + what changed this week ────────
// All deterministic (DB deltas, zero AI). Every line carries its evidence.
async function loadIntelConsole() {
  var box = document.getElementById('intelConsole'); if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_intel_console' }) });
    var d = await r.json();
    if (!d.ok) { box.innerHTML = ''; return; }
    var st = d.strip || {};
    var fmtK = function(v){ return fmtOrgMoney(v || 0); };
    var fd = st.forecast_delta;
    var fdVal = fd ? (fd.verified_change >= 0 ? '+' : '') + fmtK(Math.abs(fd.verified_change)).replace('$', fd.verified_change < 0 ? '-$' : '$') : 'n/a';
    var fdCol = fd ? (fd.verified_change >= 0 ? 'var(--green)' : 'var(--coral)') : 'var(--text3)';
    var changes = d.changes || [];
 var typeIcon = { signal_drop:'', signal_gain:'', tier_up:'', tier_down:'', went_dark:'', single_threaded:'', champion_quiet:'', close_slipped:'⏰', competitor_spike:'' };
    var sevCol = { high:'var(--coral)', medium:'var(--amber)', low:'var(--green)' };
    var needsDecision = changes.filter(function(c){ return c.severity === 'high'; });
    var forAwareness = changes.filter(function(c){ return c.severity !== 'high'; });

    // ── Headline: one deterministic sentence, the entry point for everything below ──
    var headline = 'Verified pipeline is ' + fmtK(st.verified_usd||0) + ' (' + (st.verified_pct||0) + '% of ' + fmtK(st.total_usd||0) + ' total).';
    if (fd) headline += ' ' + (fd.verified_change >= 0 ? 'Up' : 'Down') + ' ' + fmtK(Math.abs(fd.verified_change)) + ' this week.';
    if (needsDecision.length) headline += ' ' + needsDecision.length + ' deal' + (needsDecision.length !== 1 ? 's need' : ' needs') + ' a decision.';
    else headline += ' Nothing urgent flagged this week.';
    var h = '<div style="font-size:14px;font-weight:600;color:var(--text);line-height:1.4;padding:2px 0 12px">' + esc(headline) + '</div>';

    // ── Truth strip, demoted: 3 headline tiles + 2 folded behind a toggle ──
    var primaryCards = [
      { label:'Verified pipeline', value: fmtK(st.verified_usd||0), sub: st.verified_pct + '% of ' + fmtK(st.total_usd||0), color:'var(--green)' },
      { label:'Verified moved 7d', value: fdVal, sub: fd ? fd.from_date + ' to ' + fd.to_date : 'needs 2 snapshots', color: fdCol },
      { label:'High risks', value: String(st.high_risks||0), sub:'of ' + (st.total_deals||0) + ' open deals', color: st.high_risks ? 'var(--coral)' : 'var(--green)' }
    ];
    var moreCards = [
      { label:'Dark >14d', value: String(st.dark_deals||0), sub:'no verified contact', color: st.dark_deals ? 'var(--amber)' : 'var(--green)' },
      { label:'Single-threaded', value: String(st.single_threaded||0), sub:'one active contact', color: st.single_threaded ? 'var(--amber)' : 'var(--green)' }
    ];
    var tile = function(c) {
      return '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:10px 12px">' +
        '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">' + c.label + '</div>' +
        '<div style="font-size:20px;font-weight:600;color:' + c.color + ';line-height:1.1">' + esc(c.value) + '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + esc(c.sub) + '</div>' +
      '</div>';
    };
    var stripOpen = !!window._intelStripOpen;
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:6px">' + primaryCards.map(tile).join('') + '</div>';
    if (stripOpen) h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:6px">' + moreCards.map(tile).join('') + '</div>';
    h += '<div onclick="window._intelStripOpen=!window._intelStripOpen;loadIntelConsole()" style="font-size:11px;color:var(--text3);cursor:pointer;user-select:none;margin-bottom:14px">' + (stripOpen ? '▴ fewer numbers' : '▾ dark deals, single-threaded count') + '</div>';

    // ── Needs a decision: high-severity changes, always visible ──────────
    var changeRow = function(c) {
      var col = sevCol[c.severity] || 'var(--text3)';
      var click = c.account_id ? 'openAccountTimeline(\'' + esc(c.account_id) + '\',\'' + esc(c.account||'') + '\')' : '';
      return '<div ' + (click ? 'onclick="' + click + '" ' : '') + 'style="display:flex;align-items:flex-start;gap:8px;padding:7px 10px;margin-bottom:4px;background:var(--surface);border-left:2px solid ' + col + ';border-radius:0 8px 8px 0;' + (click ? 'cursor:pointer' : '') + '">' +
        '<span style="font-size:12px;flex-shrink:0">' + (typeIcon[c.type]||'•') + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:12px;font-weight:500;color:var(--text)">' + esc(c.headline) + '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:1px">' + esc(c.evidence||'') + '</div>' +
        '</div>' +
        (click ? '<span style="color:var(--text3);font-size:12px;flex-shrink:0">›</span>' : '') +
      '</div>';
    };
    h += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Needs a decision' + (d.scope !== 'self' ? ' (' + d.scope + ')' : '') + '</div>';
    if (!needsDecision.length) {
      h += '<div style="font-size:12px;color:var(--text3);font-style:italic;padding:4px 0 10px">Nothing urgent. Steady week.</div>';
    } else {
      needsDecision.forEach(function(c) { h += changeRow(c); });
    }

    // ── For your awareness: medium/low severity, collapsed by default ─────
    if (forAwareness.length) {
      var awareOpen = !!window._intelAwareOpen;
      h += '<div onclick="window._intelAwareOpen=!window._intelAwareOpen;loadIntelConsole()" style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:var(--surface2);border-radius:var(--r-sm);cursor:pointer;user-select:none;margin:10px 0 ' + (awareOpen ? '5px' : '0') + '">' +
        '<span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">For your awareness · ' + forAwareness.length + '</span>' +
        '<span style="font-size:11px;color:var(--text3)">' + (awareOpen ? '▴' : '▾') + '</span>' +
      '</div>';
      if (awareOpen) forAwareness.forEach(function(c) { h += changeRow(c); });
    }
    // Marker: the async rollup below (manager+ only) inserts itself here.
    h += '<div id="intelRollupMarker"></div>';
    box.innerHTML = h;
    // Cross-deal pattern boards used to render here. They now feed the unified
    // Signal intelligence section below (theme trend arrows), so we stash the
    // pattern trends and re-render that section instead of drawing a duplicate.
    window._intelPatterns = d.patterns || {};
    if (_intelData && typeof renderIntelFeed === 'function') renderIntelFeed();
    if (canSeeTeam(profile ? profile.role : '')) _loadIntelCoachingRollup();
    _loadIntelAttention();
  } catch(e) { box.innerHTML = ''; }
}

// ── Manager/director rollup: who on the team needs a nudge, aggregated from ──
// coaching_alerts (already generated, zero new AI). Inserts itself just above
// the exploratory patterns/attention sections via #intelRollupMarker.
async function _loadIntelCoachingRollup() {
  var marker = document.getElementById('intelRollupMarker'); if (!marker || !marker.parentNode) return;
  try {
    var call = function() {
      return fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'get_coaching_rollup' }) });
    };
    var r = await call();
    // This section fires last in a long await chain; if the session token has
    // lapsed by now the gateway 401s. Refresh once and retry before giving up.
    if (r.status === 401 && currentUser && currentUser.refresh_token) {
      var ok = await refreshToken();
      if (ok) r = await call();
    }
    var d = await r.json();
    if (!d.ok || !d.reps || !d.reps.length) return;
    var sevColor = { high:'var(--coral)', medium:'var(--amber)', low:'var(--blue)' };
    var h = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:2px 0 8px">Your team, ' + d.total_alerts + ' open alert' + (d.total_alerts!==1?'s':'') + '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:6px">';
    d.reps.slice(0, 8).forEach(function(rep) {
      h += '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:12px 14px">';
      h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border2)">';
      h += '<span style="font-size:12px;font-weight:700;color:var(--text)">' + esc(rep.name) + '</span>';
      h += '<div style="display:flex;gap:4px">';
      if (rep.high) h += '<span style="font-size:11px;font-weight:700;color:var(--coral);background:var(--coral-lt);padding:2px 7px;border-radius:var(--r-sm)">' + rep.high + ' high</span>';
      if (rep.medium) h += '<span style="font-size:11px;font-weight:700;color:var(--amber);background:var(--amber-lt);padding:2px 7px;border-radius:var(--r-sm)">' + rep.medium + ' med</span>';
      if (!rep.high && !rep.medium && rep.low) h += '<span style="font-size:11px;font-weight:700;color:var(--text3);background:rgba(150,150,150,0.1);padding:2px 7px;border-radius:var(--r-sm)">' + rep.low + ' low</span>';
      h += '</div></div>';
      if (!rep.alerts || !rep.alerts.length) {
        h += '<div style="font-size:11px;color:var(--text3);font-style:italic">No open alerts</div>';
      } else {
        rep.alerts.forEach(function(a) {
          var col = sevColor[a.severity] || 'var(--text3)';
          h += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:11px;color:var(--text2)">' +
            '<span style="width:5px;height:5px;border-radius:50%;background:' + col + ';flex-shrink:0"></span>' +
            '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a.title) + '</span>' +
          '</div>';
        });
      }
      h += '</div>';
    });
    h += '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = h;
    marker.parentNode.insertBefore(wrap, marker);
  } catch(e) { /* rollup is optional, never blocks the console */ }
}

// ── Attention allocation: your calendar hours vs deal health ─────────────────
// Reuses get_time_analytics (Google Calendar based, per-user). Appended below
// the console so a slow calendar read never blocks the strip.
async function _loadIntelAttention() {
  var box = document.getElementById('intelConsole'); if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_time_analytics', days: 30 }) });
    var d = await r.json();
    if (!d.ok || !d.by_account || !d.by_account.length) return;
    var over = d.by_account.filter(function(a){ return a.mismatch === 'over_invested'; }).slice(0, 3);
    var under = d.by_account.filter(function(a){ return a.mismatch === 'under_invested'; }).slice(0, 3);
    if (!over.length && !under.length) return;
    var col = function(title, icon, rows, accent, tone) {
      var c = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:12px 14px;flex:1;min-width:200px">';
      c += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:9px;padding-bottom:8px;border-bottom:1px solid var(--border2)">' +
        '<span style="font-size:14px;line-height:1">' + icon + '</span>' +
        '<span style="font-size:11px;font-weight:700;color:var(--text2)">' + title + '</span>' +
      '</div>';
      if (!rows.length) {
        c += '<div style="font-size:11px;color:var(--text3);font-style:italic">None flagged this month</div>';
      } else {
        c += '<div style="display:flex;flex-direction:column;gap:7px">';
        rows.forEach(function(a) {
          c += '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="width:6px;height:6px;border-radius:50%;background:' + accent + ';flex-shrink:0"></span>' +
            '<span style="font-size:11px;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a.account_name) + '</span>' +
            '<span style="font-size:11px;font-weight:600;color:' + accent + ';background:' + tone + ';padding:2px 7px;border-radius:var(--r-sm);white-space:nowrap">' + a.hours + 'h · sig ' + (a.signal_score != null ? a.signal_score : '–') + '</span>' +
          '</div>';
        });
        c += '</div>';
      }
      c += '</div>';
      return c;
    };
    var h = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px">Your attention vs deal health, 30 days of calendar</div>';
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      col('Over-invested', '⏳', over, 'var(--amber)', 'var(--amber-lt)') +
 col('Under-invested', '', under, 'var(--green)', 'var(--green-lt)') +
    '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = h;
    box.appendChild(wrap);
  } catch(e) { /* attention section is optional */ }
}

async function loadIntelligence() {
  loadIntelConsole();  // fire in parallel, renders its own section
  loadVelocityForecast();  // deterministic velocity + forecast integrity, own section
  loadRelationshipCoverage();  // coverage depth by stage, own section
  loadSignalStates();  // correlated deterministic verdicts, own section
  var feed = document.getElementById('intelFeed');
  var isManager = canSeeTeam(profile ? profile.role : '');
  var days = parseInt((document.getElementById('intelDaysFilter') || {}).value || '30') || 30;
  if (isManager) await populateIntelRepFilter();
  var repFilterEl = document.getElementById('intelRepFilter');
  var repFilter = repFilterEl ? repFilterEl.value : '';
  try {
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'get_intelligence', days_back: days, view: 'accounts', rep_user_id: isManager && repFilter ? repFilter : (isManager ? null : undefined) })
    });
    var data = await r.json();
    _intelData = data;
    renderIntelFeed();
  } catch(e) {
    if (feed) feed.innerHTML = '<div style="text-align:center;padding:48px 0;color:var(--coral);font-size:13px">Error loading intelligence: ' + esc(e.message) + '</div>';
  }
}

let _intelRepsCache = null;
async function populateIntelRepFilter() {
  var sel = document.getElementById('intelRepFilter');
  if (!sel || !profile?.org_id) return;
  try {
    if (!_intelRepsCache) {
      var seeAllReps = ['super_admin','admin','director','executive'].includes(profile.role);
      var q = 'user_profiles?org_id=eq.' + profile.org_id + '&is_active=not.is.false&select=user_id,email,role,manager_id&order=email';
      var allMembers = await sbGet(q);
      // Only show frontline reps (member/sdr/ae), never managers/admins/super_admins themselves.
      var reps = (allMembers || []).filter(function(p) {
        return ['member','sdr','ae'].includes(p.role);
      });
      // Plain managers only see their own direct reports; senior roles see the whole org's reps.
      if (!seeAllReps) {
        reps = reps.filter(function(p) { return p.manager_id === currentUser.id; });
      }
      _intelRepsCache = reps;
    }
    var current = sel.value;
    sel.innerHTML = '<option value="">All reps</option>' + (_intelRepsCache || []).map(function(p) {
      return '<option value="' + p.user_id + '">' + esc(p.email.split('@')[0]) + '</option>';
    }).join('');
    sel.value = current;
  } catch(e) { /* keep default */ }
}

var _intelSource = 'all';
function setIntelSource(source, btn) {
  _intelSource = source;
  ['all','ai','sam'].forEach(function(s) {
    var b = document.getElementById('intel-src-' + s);
    if (b) b.classList.toggle('active', s === source);
  });
  renderIntelFeed();
}

function setIntelType(type, btn) {
  _intelType = type;
  // Scope to the category row only — querySelectorAll('.intel-tab') would
  // otherwise also deactivate the source-row buttons above it, since both
  // rows share the same CSS class.
  var categoryRow = btn ? btn.parentElement : null;
  if (categoryRow) {
    categoryRow.querySelectorAll('.intel-tab').forEach(function(b) { b.classList.remove('active'); });
  }
  if (btn) btn.classList.add('active');
  renderIntelFeed();
}

function renderIntelligence() { loadIntelligence(); }

var _intelLens = 'theme';
function setIntelLens(lens) {
  _intelLens = lens;
  renderIntelFeed();
}

var _INTEL_CATS = [
 { key:'expansion_signals', pkey:'expansion', label:'Expansion', icon:'', color:'var(--green)', upGood:true },
 { key:'risk_signals', pkey:'deal_risks', label:'Deal risks', icon:'', color:'var(--coral)', upGood:false },
 { key:'competitor_mentions', pkey:'competitors', label:'Competitors', icon:'', color:'var(--amber)', upGood:false },
 { key:'pricing_signals', pkey:'pricing', label:'Pricing pressure', icon:'', color:'var(--coral)', upGood:false },
 { key:'product_feedback', pkey:'product_gaps', label:'Product gaps', icon:'', color:'rgba(99,102,241,.85)', upGood:false }
];
var _INTEL_JUNK_TYPES = ['staleness'];

function _samChip() { return '<span style="font-size:9px;font-weight:700;color:var(--gold);background:rgba(var(--c-accent-rgb),0.14);border-radius:4px;padding:2px 7px;white-space:nowrap">SAM</span>'; }
function _aiChip() { return '<span style="font-size:9px;font-weight:700;color:var(--text3);background:rgba(150,150,150,0.14);border-radius:4px;padding:2px 7px;white-space:nowrap">AI</span>'; }

function renderIntelFeed() {
  var feed = document.getElementById('intelFeed');
  var stats = document.getElementById('intelStats');
  if (stats) stats.style.display = 'none';
  if (!feed || !_intelData) return;
  var allRows = _intelData.rows || [];
  var rows = _intelSource === 'all' ? allRows : allRows.filter(function(r) { return (r.source || 'ai') === _intelSource; });

  if (!rows.length) {
    feed.innerHTML = '<div style="text-align:center;padding:48px 0;color:var(--text3);font-size:14px">No intelligence yet.<br><span style="font-size:12px">Click ↻ Refresh to scan meeting notes.</span></div>';
    return;
  }

  var flat = [];
  var junk = [];
  var byAccount = {};
  rows.forEach(function(row) {
    var acct = row.account_name || 'Unknown';
    var a = byAccount[acct] || (byAccount[acct] = { name: acct, rows: [], signals: [], sentiment: {}, lastDate: '' });
    a.rows.push(row);
    if (row.meeting_date && row.meeting_date > a.lastDate) a.lastDate = row.meeting_date;
    if (row.sentiment) a.sentiment[row.sentiment] = (a.sentiment[row.sentiment] || 0) + 1;
    _INTEL_CATS.forEach(function(cat) {
      if (_intelType !== 'all' && _intelType !== cat.key) return;
      (row[cat.key] || []).forEach(function(s) {
        var rec = Object.assign({}, s, { _cat: cat.key, _date: row.meeting_date, _subject: row.meeting_subject, _source: row.source || 'ai', _account: acct });
        if (s && s.type && _INTEL_JUNK_TYPES.indexOf(s.type) !== -1) { junk.push(rec); return; }
        flat.push(rec); a.signals.push(rec);
      });
    });
  });

  var samCount = flat.filter(function(s){ return s._source === 'sam'; }).length;
  var aiCount = flat.length - samCount;
  var sentPos = rows.filter(function(r){ return r.sentiment === 'positive'; }).length;
  var sentTot = rows.filter(function(r){ return r.sentiment; }).length;
  var posPct = sentTot ? Math.round(sentPos / sentTot * 100) : null;
  var acctCount = Object.keys(byAccount).length;

  var tiles = [
    { label:'Live signals', value: String(flat.length), sub: 'across ' + acctCount + ' account' + (acctCount!==1?'s':''), color:'var(--text)' },
 { label:'SAM verified', value: String(samCount), sub: 'rules-proven, certain', color:'var(--gold)' },
 { label:'AI assisted', value: String(aiCount), sub: 'supplementary hints', color:'var(--text2)' },
    { label:'Sentiment', value: posPct != null ? posPct + '%' : 'n/a', sub: posPct != null ? 'positive-leaning' : 'no reads', color: posPct != null && posPct >= 50 ? 'var(--green)' : 'var(--text3)' }
  ];
  var h = '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px">' +
    '<span style="font-size:16px;font-weight:600;color:var(--text)">Signal intelligence</span>' +
    '<span style="display:inline-flex;border:1px solid var(--border2);border-radius:var(--r-sm);overflow:hidden;font-size:12px">' +
      '<span id="intel-lens-theme" onclick="setIntelLens(\'theme\')" style="padding:4px 12px;cursor:pointer;background:' + (_intelLens==='theme'?'var(--surface)':'transparent') + ';color:' + (_intelLens==='theme'?'var(--text)':'var(--text3)') + '">By theme</span>' +
      '<span id="intel-lens-account" onclick="setIntelLens(\'account\')" style="padding:4px 12px;cursor:pointer;background:' + (_intelLens==='account'?'var(--surface)':'transparent') + ';color:' + (_intelLens==='account'?'var(--text)':'var(--text3)') + '">By account</span>' +
    '</span></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">';
  tiles.forEach(function(t) {
    h += '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:11px 13px">' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:3px">' + t.label + '</div>' +
      '<div style="font-size:20px;font-weight:600;color:' + t.color + ';line-height:1.1">' + t.value + '</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + t.sub + '</div>' +
    '</div>';
  });
  h += '</div>';

  h += (_intelLens === 'account') ? _renderIntelAccountLens(byAccount) : _renderIntelThemeLens(flat, junk);
  feed.innerHTML = h;
}

function _renderIntelThemeLens(flat, junk) {
  var pats = window._intelPatterns || {};
  var built = _INTEL_CATS.map(function(cat) {
    if (_intelType !== 'all' && _intelType !== cat.key) return null;
    var sigs = flat.filter(function(s){ return s._cat === cat.key; });
    var prior = 0;
    (pats[cat.pkey] || []).forEach(function(e){ prior += (e.prior || 0); });
    return { cat: cat, sigs: sigs, count: sigs.length, prior: prior, delta: sigs.length - prior };
  }).filter(Boolean);

  var active = built.filter(function(b){ return b.count > 0; }).sort(function(a,b){ return b.count - a.count; });
  var quiet = built.filter(function(b){ return b.count === 0; });

  var h = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Themes, ranked by volume</div>';
  if (!active.length) {
    h += '<div style="font-size:12px;color:var(--text3);font-style:italic;padding:4px 0 10px">No conversation signals in this window.</div>';
  }
  h += '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);overflow:hidden;margin-bottom:8px">';
  active.forEach(function(b, i) {
    var rid = 'intel-theme-' + b.cat.key;
    var samN = b.sigs.filter(function(s){ return s._source === 'sam'; }).length;
    var deltaCol = b.delta === 0 ? 'var(--text3)' : ((b.delta > 0) === b.cat.upGood ? 'var(--green)' : 'var(--coral)');
    var deltaTxt = b.delta === 0 ? 'flat' : (b.delta > 0 ? '+' + b.delta : String(b.delta));
    h += '<div onclick="toggleIntelDrill(\'' + rid + '\')" style="padding:12px 14px;cursor:pointer;' + (i ? 'border-top:1px solid var(--border2)' : '') + '">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:16px;flex-shrink:0">' + b.cat.icon + '</span>' +
        '<span style="flex:1;min-width:0;font-size:14px;font-weight:600;color:var(--text)">' + b.cat.label + '</span>' +
        (samN ? '<span style="font-size:11px;color:var(--gold);font-weight:600">' + samN + ' SAM</span>' : '') +
        '<span style="font-size:16px;font-weight:600;color:var(--text);min-width:26px;text-align:right">' + b.count + '</span>' +
        '<span style="font-size:11px;font-weight:700;color:' + deltaCol + ';background:var(--surface2);padding:2px 8px;border-radius:var(--r-md);min-width:34px;text-align:center">' + deltaTxt + '</span>' +
        '<span id="chevron-' + rid + '" style="font-size:16px;color:var(--text3)">›</span>' +
      '</div>' +
      '<div id="' + rid + '" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border2)">' + _renderThemeReceipts(b.sigs) + '</div>' +
    '</div>';
  });
  h += '</div>';

  if (quiet.length) {
    h += '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Quiet this month: ' + quiet.map(function(b){ return b.cat.label.toLowerCase(); }).join(', ') + '</div>';
  }
  if (junk.length) {
    h += '<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;background:var(--surface2);border-radius:var(--r-md);opacity:.9">' +
      '<span style="font-size:14px;flex-shrink:0">⏳</span>' +
      '<span style="flex:1;font-size:12px;color:var(--text3)">Auto-detected: staleness</span>' +
      '<span style="font-size:11px;color:var(--text3)">' + junk.length + ' accounts, system-derived, not a talking point</span>' +
    '</div>';
  }
  return h;
}

function _renderThemeReceipts(sigs) {
  var sam = sigs.filter(function(s){ return s._source === 'sam'; });
  var ai  = sigs.filter(function(s){ return s._source !== 'sam'; });
  var line = function(s) {
    return '<div style="display:flex;gap:8px;padding:4px 0;font-size:12px">' +
      '<span style="font-weight:600;color:var(--text);min-width:74px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s._account) + '</span>' +
      '<span style="flex:1;color:var(--text2);font-style:italic">' + esc(s.quote || s.context || s.name || '(no detail captured)') + '</span>' +
      '<span style="color:var(--text3);flex-shrink:0">' + esc((s._date || '').slice(5, 10)) + '</span>' +
    '</div>';
  };
  var h = '';
  if (sam.length) {
    h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' + _samChip() + '<span style="font-size:11px;color:var(--gold);font-weight:600">Certain, rules-proven</span></div>';
    h += sam.map(line).join('');
  }
  if (ai.length) {
    h += '<div style="display:flex;align-items:center;gap:6px;margin:' + (sam.length?'10px':'0') + ' 0 4px">' + _aiChip() + '<span style="font-size:11px;color:var(--text3)">Supplementary, AI-read</span></div>';
    h += ai.map(line).join('');
  }
  return h || '<div style="font-size:12px;color:var(--text3)">No detail captured.</div>';
}

function _renderIntelAccountLens(byAccount) {
  var nowMs = Date.now();
  var accts = Object.values(byAccount).map(function(a) {
    var risk = a.signals.filter(function(s){ return s._cat === 'risk_signals'; }).length;
    var exp  = a.signals.filter(function(s){ return s._cat === 'expansion_signals'; }).length;
    var samN = a.signals.filter(function(s){ return s._source === 'sam'; }).length;
    var daysDark = a.lastDate ? Math.round((nowMs - new Date(a.lastDate).getTime()) / 86400000) : 999;
    var sentEntries = Object.entries(a.sentiment).sort(function(x,y){ return y[1]-x[1]; });
    var domSent = sentEntries.length ? sentEntries[0][0] : 'neutral';
    var score = risk * 3 + (daysDark > 14 && daysDark < 999 ? 2 : 0) + exp + a.signals.length * 0.1;
    return { a: a, risk: risk, exp: exp, samN: samN, daysDark: daysDark, domSent: domSent, score: score };
  }).sort(function(x,y){ return y.score - x.score; });

  var sentMap = { positive:{c:'var(--green)',bg:'rgba(74,140,92,0.12)'}, negative:{c:'var(--coral)',bg:'rgba(192,82,63,0.12)'}, neutral:{c:'var(--text3)',bg:'var(--surface2)'} };
  var h = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Hot accounts, most actionable signal now</div>';
  h += '<div style="display:flex;flex-direction:column;gap:8px">';
  accts.forEach(function(x, idx) {
    var a = x.a;
    var rid = 'intel-acct-' + idx;
    var sm = sentMap[x.domSent] || sentMap.neutral;
    var initials = (a.name || '?').replace(/[^A-Za-z0-9 ]/g,'').split(/\s+/).map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase() || '?';
    var meta = a.signals.length + ' signal' + (a.signals.length!==1?'s':'') + ', ' + a.rows.length + ' meeting' + (a.rows.length!==1?'s':'') + (x.samN ? ', ' + x.samN + ' SAM-verified' : '');
    var flag = x.risk ? '<span style="font-size:11px;color:var(--coral);background:rgba(192,82,63,0.12);padding:2px 8px;border-radius:var(--r-md);white-space:nowrap">' + x.risk + ' risk</span>'
             : (x.daysDark > 14 && x.daysDark < 999 ? '<span style="font-size:11px;color:var(--amber);background:rgba(201,151,62,0.12);padding:2px 8px;border-radius:var(--r-md);white-space:nowrap">dark ' + x.daysDark + 'd</span>' : '');
    h += '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);overflow:hidden">' +
      '<div onclick="toggleIntelDrill(\'' + rid + '\')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer">' +
        '<div style="width:34px;height:34px;border-radius:50%;background:' + sm.bg + ';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:' + sm.c + ';flex-shrink:0">' + esc(initials) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:14px;font-weight:700;color:var(--text)">' + esc(a.name) + '</div>' +
          '<div style="font-size:11px;color:var(--text3)">' + esc(meta) + '</div>' +
        '</div>' +
        flag +
        '<span style="font-size:11px;color:' + sm.c + ';background:' + sm.bg + ';padding:2px 8px;border-radius:var(--r-md);white-space:nowrap">' + x.domSent + '</span>' +
        '<span id="chevron-' + rid + '" style="font-size:16px;color:var(--text3)">›</span>' +
      '</div>' +
      '<div id="' + rid + '" style="display:none;padding:0 14px 12px">' + _renderAccountReceipts(a) + '</div>' +
    '</div>';
  });
  h += '</div>';
  return h;
}

function _renderAccountReceipts(a) {
  var catMeta = {}; _INTEL_CATS.forEach(function(c){ catMeta[c.key] = c; });
  var byMeeting = {};
  a.signals.forEach(function(s) {
    var key = (s._date || 'Undated') + ' · ' + (s._subject || '');
    (byMeeting[key] || (byMeeting[key] = [])).push(s);
  });
  return Object.entries(byMeeting).map(function(entry) {
    return '<div style="margin-bottom:8px;padding:10px 12px;background:var(--surface2);border-radius:var(--r-sm)">' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:600">' + esc(entry[0]) + '</div>' +
      entry[1].map(function(s) {
        var cm = catMeta[s._cat] || { icon:'○', label:'', color:'var(--text3)' };
        return '<div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-top:1px solid var(--border)">' +
          '<span style="font-size:13px;flex-shrink:0">' + cm.icon + '</span>' +
          '<div style="flex:1">' +
            '<span style="font-size:11px;font-weight:600;color:' + cm.color + '">' + cm.label + '</span> ' +
            (s._source === 'sam' ? _samChip() : _aiChip()) +
            '<div style="font-size:12px;color:var(--text);margin-top:2px">' + esc(s.quote || s.context || s.name || '') + '</div>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }).join('');
}

function toggleIntelDrill(id) {
  var el = document.getElementById(id);
  var chevron = document.getElementById('chevron-'+id);
  if (!el) return;
  var open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(90deg)';
}

window.refreshIntelligence = refreshIntelligence;
window.loadIntelligence = loadIntelligence;
window.renderIntelligence = renderIntelligence;
window.renderIntelFeed = renderIntelFeed;
window.setIntelType = setIntelType;
window.setIntelLens = setIntelLens;
window.openCarryForward = typeof openCarryForward !== 'undefined' ? openCarryForward : function(){};
window.openCarryFromTask = typeof openCarryFromTask !== 'undefined' ? openCarryFromTask : function(){};
window.closeCarryForward = typeof closeCarryForward !== 'undefined' ? closeCarryForward : function(){};
window.confirmCarryForward = typeof confirmCarryForward !== 'undefined' ? confirmCarryForward : function(){};
window.selectCarryDate = typeof selectCarryDate !== 'undefined' ? selectCarryDate : function(){};

// ============================================================================
// CHANGE PASSWORD
//
// Runs entirely between the browser and Supabase Auth. The password NEVER goes
// to sam-gmail-signals, is never written to any table of ours, and never
// appears in a URL. There is no reason for our backend to see it, and every
// place a password exists is a place it can leak.
//
// WHY THE CURRENT PASSWORD IS REQUIRED
//   PUT /auth/v1/user does not ask for it. So on its own, anyone holding a live
//   session — a borrowed laptop, an unlocked machine, a stolen token — could
//   change the password and lock the real owner out of their own account.
//   Re-authenticating first proves the person at the keyboard is the account
//   holder and not merely someone sitting in front of their session.
//
// The re-auth also hands back a fresh token, which is what the change is then
// made with. That matters if Supabase is configured to require a recent login
// for sensitive updates.
// ============================================================================

var PW_MIN = 10;   // Supabase's own floor is 6. Six is not a password.

function _pwStrength() {
  var v = document.getElementById('pwNew').value || '';
  var hint = document.getElementById('pwHint');
  if (!hint) return;
  if (!v) { hint.textContent = 'At least ' + PW_MIN + ' characters.'; hint.style.color = 'var(--text3)'; return; }
  if (v.length < PW_MIN) {
    hint.textContent = (PW_MIN - v.length) + ' more character' + ((PW_MIN - v.length) === 1 ? '' : 's') + ' needed.';
    hint.style.color = 'var(--text3)';
    return;
  }
  // Length is the honest signal. Character-class rules mostly teach people to
  // write Password1! so we do not pretend those are strength.
  var varied = /[a-z]/.test(v) && /[A-Z0-9]/.test(v);
  hint.textContent = varied ? 'Long enough.' : 'Long enough. A mix of cases or numbers is harder to guess.';
  hint.style.color = 'var(--green)';
}

function _pwSay(text, isError) {
  var el = document.getElementById('pwMsg');
  if (!el) return;
  el.textContent = text || '';
  el.style.color = isError ? 'var(--red, #C4553D)' : 'var(--text3)';
}

async function changePassword() {
  var btn     = document.getElementById('pwBtn');
  var current = document.getElementById('pwCurrent').value || '';
  var next    = document.getElementById('pwNew').value || '';
  var confirm = document.getElementById('pwConfirm').value || '';
  var others  = document.getElementById('pwSignOutOthers').checked;

  if (!current)            { _pwSay('Enter your current password.', true); return; }
  if (next.length < PW_MIN){ _pwSay('The new password needs at least ' + PW_MIN + ' characters.', true); return; }
  if (next !== confirm)    { _pwSay('The two new passwords do not match.', true); return; }
  if (next === current)    { _pwSay('That is your current password. Choose a different one.', true); return; }

  btn.disabled = true; btn.textContent = 'Changing…';
  _pwSay('Checking your current password…');

  try {
    // 1. Prove it is really them.
    var reauth = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email, password: current })
    });
    var rd = await reauth.json();
    if (!reauth.ok || !rd.access_token) {
      // Deliberately specific: this is the user's own account and telling them
      // the current password is wrong is not an information leak, it is the
      // only useful thing to say.
      _pwSay('That current password is not right.', true);
      btn.disabled = false; btn.textContent = 'Change password';
      return;
    }

    // 2. Change it, using the token we just earned.
    _pwSay('Saving the new password…');
    var upd = await fetch(SB_URL + '/auth/v1/user', {
      method: 'PUT',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + rd.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: next })
    });
    var ud = await upd.json();
    if (!upd.ok) {
      _pwSay(ud.msg || ud.error_description || ud.error || 'Supabase refused the change.', true);
      btn.disabled = false; btn.textContent = 'Change password';
      return;
    }

    // 3. Keep this session alive on the NEW credentials. Without this the app
    //    carries on with the pre-change token and the rep is silently logged
    //    out at the next refresh, which reads as "the change broke something".
    currentUser.token = rd.access_token;
    currentUser.refresh_token = rd.refresh_token;
    localStorage.setItem('dt-user', JSON.stringify(currentUser));

    // 4. Other devices. Done AFTER the change, so a failure here cannot leave
    //    them signed out with the old password still live.
    var othersNote = '';
    if (others) {
      try {
        var lo = await fetch(SB_URL + '/auth/v1/logout?scope=others', {
          method: 'POST',
          headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token }
        });
        othersNote = lo.ok
          ? ' Your other devices have been signed out.'
          : ' Your password changed, but other devices could not be signed out, sign out manually there.';
      } catch (e) {
        othersNote = ' Your password changed, but other devices could not be signed out, sign out manually there.';
      }
    }

    document.getElementById('pwCurrent').value = '';
    document.getElementById('pwNew').value = '';
    document.getElementById('pwConfirm').value = '';
    _pwStrength();
    _pwSay('Password changed.' + othersNote);
    if (typeof showToast === 'function') showToast('Password changed');
  } catch (e) {
    _pwSay('Could not reach the server: ' + e.message, true);
  }
  btn.disabled = false; btn.textContent = 'Change password';
}

// ============================================================================
// FORGOT PASSWORD
//
// Two halves, separated by an email:
//   1. sendReset()   -> POST /auth/v1/recover. Supabase emails a link.
//   2. the link lands back here with #type=recovery in the FRAGMENT, which
//      _catchRecovery() picks up and turns into the "set a new password" screen.
//
// Same rule as the change-password flow: the password only ever travels between
// this browser and Supabase Auth. sam-gmail-signals is not involved and has no
// reason to be.
// ============================================================================

function _screen(id) {
  document.querySelectorAll('.screen').forEach(function(el) { el.classList.remove('active'); });
  var t = document.getElementById(id);
  if (t) t.classList.add('active');
}

// Show a message in one of the .msg boxes. The class is what makes it visible:
// .msg is display:none until it carries err / ok / info. Setting only the text
// (as this flow used to) produced messages nobody could see, which is why
// "Send the link" appeared to do nothing and the reset button seemed dead.
function _flowMsg(el, text, kind) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (!el) return;
  el.textContent = text || '';
  el.style.color = '';
  el.className = 'msg' + (text ? ' ' + (kind || 'err') : '');
}

function _flowState(ids, show) {
  ids.forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = id === show ? '' : 'none'; });
}

function _validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

function showForgot(prefill) {
  var a = document.getElementById('aEmail');
  var f = document.getElementById('fEmail');
  // Carry over whatever they already typed. Retyping an email you just entered,
  // while locked out, is a small insult.
  if (f) f.value = (typeof prefill === 'string' && prefill) ? prefill : ((a && a.value) || f.value || '');
  _flowMsg('forgotMsg', '');
  _flowState(['forgotForm', 'forgotSent'], 'forgotForm');
  var btn = document.getElementById('forgotBtn'); if (btn) { btn.disabled = false; btn.textContent = 'Send reset link'; }
  _screen('forgotScreen');
  if (f) setTimeout(function () { f.focus(); }, 30);
}

function forgotDifferent() {
  _flowMsg('forgotMsg', '');
  _flowState(['forgotForm', 'forgotSent'], 'forgotForm');
  var f = document.getElementById('fEmail'); if (f) { f.select(); f.focus(); }
}

function showAuth() {
  _resetAuthForm();
  _screen('authScreen');
}

// Supabase allows one recovery email per address per 60 seconds. The resend
// button counts that down instead of letting people click into a silent 429.
var _resendTimer;
function _resendCooldown(sec) {
  var b = document.getElementById('fResend'); if (!b) return;
  clearInterval(_resendTimer);
  var left = sec;
  var tick = function () {
    if (left <= 0) { clearInterval(_resendTimer); b.disabled = false; b.textContent = 'Resend link'; return; }
    b.disabled = true; b.textContent = 'Resend link in ' + left + 's'; left--;
  };
  tick(); _resendTimer = setInterval(tick, 1000);
}

async function sendReset(isResend) {
  var btn = document.getElementById(isResend ? 'fResend' : 'forgotBtn');
  var email = (document.getElementById('fEmail').value || '').trim().toLowerCase();

  if (!_validEmail(email)) {
    _flowMsg('forgotMsg', 'Enter the full email address you sign in with, like name@company.com.', 'err');
    var fe = document.getElementById('fEmail'); if (fe) fe.focus();
    return;
  }
  _flowMsg('forgotMsg', '');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  var status = 0;
  try {
    // GoTrue reads redirect_to from the QUERY STRING on /recover (that is what
    // supabase-js sends); in the JSON body it is silently ignored. The target
    // must also be listed in Supabase Auth, URL Configuration, Redirect URLs.
    var r = await fetch(SB_URL + '/auth/v1/recover?redirect_to=' + encodeURIComponent(window.location.origin + '/'), {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });
    status = r.status;
  } catch (e) {
    // A network failure is the one outcome we can honestly report: nothing
    // left this device, so "check your inbox" would be a lie.
    if (btn) { btn.disabled = false; btn.textContent = isResend ? 'Resend link' : 'Send reset link'; }
    _flowMsg('forgotMsg', 'Could not reach SamoraOS. Check your connection and try again.', 'err');
    if (isResend) _flowState(['forgotForm', 'forgotSent'], 'forgotForm');
    return;
  }

  // Otherwise ALWAYS the same answer, whether or not the address has an
  // account. Anything else turns this box into a tool for checking who works
  // where. A 429 (asked again within 60s) also lands here: an earlier link is
  // already on its way.
  var to = document.getElementById('fSentTo'); if (to) to.textContent = email;
  _flowState(['forgotForm', 'forgotSent'], 'forgotSent');
  if (btn && !isResend) { btn.disabled = false; btn.textContent = 'Send reset link'; }
  _resendCooldown(60);
  if (typeof showToast === 'function') showToast(isResend ? 'Sent again. Check your inbox.' : 'Reset link sent. Check your inbox.');
}

function _togglePw(btn) {
  var inp = btn && btn.parentNode ? btn.parentNode.querySelector('input') : null;
  if (!inp) return;
  var show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? 'Hide' : 'Show';
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
}

function _rPwHint() {
  var v = document.getElementById('rPass').value || '';
  var v2 = document.getElementById('rPass2').value || '';
  var len = document.getElementById('rRuleLen'), mt = document.getElementById('rRuleMatch');
  if (len) len.classList.toggle('ok', v.length >= PW_MIN);
  if (mt) mt.classList.toggle('ok', v.length > 0 && v === v2);
  var m = document.getElementById('resetMsg');
  if (m && m.classList.contains('err')) _flowMsg(m, '');
}

// Set by the recovery-link handler in init(). Held in memory only: a recovery
// token is a bearer credential for the account and localStorage is the wrong
// home for it.
//
// NO INITIALISERS HERE, on purpose. init() is an async IIFE near the top of
// this file: it stores the token and then awaits. While it waits, the rest of
// the file finishes executing, and "var _recoveryToken = null" down here used
// to run AFTER the token was stored and wipe it. Result: the reset button
// found no token and (invisibly) reported an expired link. A bare "var" is
// hoisted without an assignment, so it cannot clobber anything.
var _pendingSsoUser;
var _recoveryToken;
var _recoveryRefresh;
var _resetEmail;

// Prepare the reset screen for a fresh link (called from init()).
function _openResetScreen(email) {
  _resetEmail = email || '';
  var who = document.getElementById('resetWho');
  if (who) who.textContent = email ? 'For ' + email : '';
  var u = document.getElementById('rUser'); if (u) u.value = email || '';
  ['rPass', 'rPass2'].forEach(function (id) { var e = document.getElementById(id); if (e) { e.value = ''; e.type = 'password'; } });
  document.querySelectorAll('#resetScreen .pw-eye').forEach(function (b) { b.textContent = 'Show'; });
  _rPwHint(); _flowMsg('resetMsg', '');
  var btn = document.getElementById('resetBtn'); if (btn) { btn.disabled = false; btn.textContent = 'Set password and sign in'; }
  _flowState(['resetForm', 'resetExpired', 'resetDone'], 'resetForm');
  _screen('resetScreen');
  setTimeout(function () { var rp = document.getElementById('rPass'); if (rp) rp.focus(); }, 30);
}

function _showResetExpired() {
  _flowState(['resetForm', 'resetExpired', 'resetDone'], 'resetExpired');
  _screen('resetScreen');
}

