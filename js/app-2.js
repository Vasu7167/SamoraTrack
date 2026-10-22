// SamoraOS app, part 2 of 5. Loaded in order after app-1.js.
async function connectNotetaker(provider) {
  var apiKey = document.getElementById('nt-key-'+provider)?.value?.trim();
  var email  = document.getElementById('nt-email-'+provider)?.value?.trim();
  if (!apiKey) { alert('Please enter your API key'); return; }
  try {
    await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'save_user_connection', provider, api_key:apiKey, provider_email:email||null}) });
    document.getElementById('notetaker-connect-modal')?.remove();
 showToast(''+provider+' connected, click "Sync calls" to pull transcripts');
  } catch(e) { alert('Error: '+e.message); }
}

async function disconnectNotetaker(provider) {
  if (!confirm('Disconnect '+provider+'?')) return;
  try {
    await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'delete_user_connection', provider}) });
    openNotetakerConnect(); // refresh modal
    showToast('Disconnected '+provider);
  } catch(e) { alert('Error: '+e.message); }
}

async function syncNotetaker() {
  var btn = document.getElementById('notetakerSyncBtn');
  var out = document.getElementById('seqSyncOutput');
 if (btn) { btn.textContent = 'Syncing calls…'; btn.disabled = true; }
  if (out) out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">Connecting to notetaker and SAM is reading the transcripts…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'sync_notetaker'}) });
    var d = await r.json();
    if (!d.ok) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> '+esc(d.error||'Sync failed')+'</div>'; return; }
    var html = '<div style="background:var(--surface2);border-radius:var(--r-sm);padding:10px 12px;margin-top:6px">' +
      '<div style="font-size:11px;font-weight:600;color:var(--gold);margin-bottom:6px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a2.8 2.8 0 00-2.8 2.8v5.4a2.8 2.8 0 005.6 0V6.3A2.8 2.8 0 0012 3.5zM5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/></svg> '+esc(d.provider)+' synced · '+d.transcripts_analysed+'/'+d.transcripts_found+' transcripts read by SAM</div>' +
      '<div style="font-size:11px;color:var(--text3)">Full transcript → exact quotes, budget signals, action items, signal score updates. Signals visible in Intelligence tab.</div>' +
      (d.errors&&d.errors.length?'<div style="font-size:11px;color:var(--amber);margin-top:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> '+d.errors.length+' partial errors</div>':'') +
    '</div>';
    if (out) out.innerHTML = html;
    if (typeof loadPipeline === 'function') loadPipeline();
  } catch(e) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: '+esc(e.message)+'</div>'; }
 if (btn) { btn.textContent = 'Sync calls'; btn.disabled = false; }
}

async function retagSeqChannels() {
  var btn = document.getElementById('retagSeqBtn');
  var out = document.getElementById('seqSyncOutput');
 if (btn) { btn.textContent = 'Retagging…'; btn.disabled = true; }
  if (out) out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">Scanning sequencing signals and fixing channel tags based on campaign names…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'retag_seq_channels'}) });
    var d = await r.json();
    if (!d.ok) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)">'+esc(d.error||'Failed')+'</div>'; return; }
    if (out) out.innerHTML = '<div style="background:var(--surface2);border-radius:var(--r-sm);padding:10px 12px">' +
      '<div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 21V3.5M5.5 4.5h12l-2.5 4 2.5 4h-12"/></svg> Channel tags fixed</div>' +
      '<div style="font-size:11px;color:var(--text3)">Scanned '+d.total+' signals · retagged '+d.retagged+' as call/LinkedIn/WhatsApp based on campaign names</div>' +
      (d.retagged > 0 ? '<div style="font-size:11px;color:var(--text3);margin-top:4px">Run Coverage again to see updated verification</div>' : '<div style="font-size:11px;color:var(--text3);margin-top:4px">All signals already correctly tagged. If calls still show unverified, campaign name doesn\'t contain call keywords. Rename the campaign in SmartReach to include "Call" or "Phone".</div>') +
    '</div>';
  } catch(e) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: '+esc(e.message)+'</div>'; }
 if (btn) { btn.textContent = 'Fix channel tags'; btn.disabled = false; }
}

// ── Refresh the SAMpaigns ────────────────────────────────────────
// This button used to call sync_sequencing, which pulls from an external
// sequencing tool and fails with "No sequencing provider configured" for every
// org that does not run one. Samora does its own sequencing, so for most
// tenants that button could only ever produce an error.
//
// It now does what its label says: scans the rep's own inbox for replies,
// bounces and out-of-office across all their campaigns, then repaints the
// list. No external dependency, and it is the scan that actually moves a
// contact off "Not contacted".
async function refreshSampaigns() {
  var btn = document.getElementById('seqSyncBtn');
  var out = document.getElementById('seqSyncOutput');
  var label = btn ? btn.innerHTML : null;
  if (btn) { btn.textContent = 'Checking…'; btn.disabled = true; }

  // ORDER MATTERS. The common reason to press this is that a SAMpaign was
  // just created from Claude or the assistant and the page has never heard of
  // it. So reload the list FIRST: the new campaign appears in under a second.
  // The inbox scan that follows is the slow part (it reads Gmail for every
  // campaign) and it has nothing to do with whether a campaign exists, so
  // making the person wait through it before seeing their new SAMpaign was
  // backwards.
  try { await loadSampaignCampaigns(); } catch(e) {}
  if (out) out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">SAMpaigns reloaded. Checking your inbox for replies\u2026</div>';

  try {
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'sync_sampaigns' })
    });
    var d = await r.json();

    if (!d.ok) {
      // The list is already refreshed by this point, so a missing mailbox is
      // a footnote, not a failure. Say which half worked.
      if (out) out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">' +
        'SAMpaigns reloaded. <span style="color:var(--amber)">Inbox not checked: ' + esc(d.error || 'no mailbox connected') + '</span></div>';
      return;
    }

    var summary = _sampaignSyncSummary(d);
    if (summary) {
      // Statuses changed, so the cards are already stale again. One more pass.
      try { await loadSampaignCampaigns(); } catch(e) {}
      if (out) out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">' +
        '<span style="color:var(--green);font-weight:600">Updated:</span> ' + esc(summary) + '</div>';
    } else if (out) {
      out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">SAMpaigns reloaded. Nothing new in your inbox.</div>';
    }

    // If a campaign page is open, it is showing old numbers too.
    try { if (typeof _sampRefreshOpen === 'function') _sampRefreshOpen(); } catch(e) {}
    var overlay = document.getElementById('sampaign-detail-overlay');
    if (overlay) {
      var openEl = overlay.querySelector('[id^="sampaignContacts_"]');
      var cid = openEl ? (openEl.id || '').replace('sampaignContacts_', '') : '';
      if (cid) {
        try { _loadSampaignDetailPerf(cid, (window._sampaignCampaignsCache || {})[cid] || {}); } catch(e) {}
        try { _loadSampaignContactsInto(cid); } catch(e) {}
      }
    }
  } catch(e) {
    if (out) out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">SAMpaigns reloaded. <span style="color:var(--coral)">Inbox check failed: ' + esc(e.message) + '</span></div>';
  } finally {
    if (btn) { if (label) btn.innerHTML = label; else btn.textContent = 'Check replies'; btn.disabled = false; }
  }
}

// Kept for orgs that DO connect an external sequencer. Nothing calls it from
// the UI any more; the Refresh button above replaced it.
async function syncSequencing() {
  var btn = document.getElementById('seqSyncBtn');
  var out = document.getElementById('seqSyncOutput');
  if (btn) { btn.textContent = '↺ Syncing…'; btn.disabled = true; }
  if (out) out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">Connecting to SAMpaign tool…</div>';

  try {
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'sync_sequencing' })
    });
    var d = await r.json();

    if (!d.ok) {
      if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral);padding:6px 0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> ' + esc(d.error || 'Sync failed') + '</div>';
      return;
    }

    var html = '<div style="background:var(--surface2);border-radius:var(--r-sm);padding:10px 12px;margin-top:6px">' +
      '<div style="font-size:11px;font-weight:600;color:var(--green);margin-bottom:6px">↺ ' + esc(d.provider) + ' synced successfully</div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
        '<span style="font-size:12px;color:var(--text2)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> ' + (d.campaigns_fetched || 0) + ' SAMpaigns</span>' +
        '<span style="font-size:12px;color:var(--text2)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> ' + (d.signals_synced || 0) + ' signals synced</span>' +
      '</div>';

    if (d.errors && d.errors.length) {
      html += '<div style="font-size:11px;color:var(--amber);margin-top:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> ' + d.errors.length + ' partial error(s)</div>';
    }
    html += '<div style="font-size:11px;color:var(--text3);margin-top:4px">Signals mapped to accounts · visible in Pipeline → Account cards</div>';
    html += '</div>';

    if (out) out.innerHTML = html;

    // Reload pipeline if visible
    if (typeof loadPipeline === 'function' && document.getElementById('panel-pipeline')?.classList.contains('active')) {
      loadPipeline();
    }
  } catch(e) {
    if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: ' + esc(e.message) + '</div>';
  }
  if (btn) { btn.textContent = '↺ Sync'; btn.disabled = false; }
}

async function runExternalSignals(repId, resultElId) {
  var out = document.getElementById(resultElId || 'externalSignalsOutput');
  var btn = document.getElementById('externalSignalsBtn');
  if (!out) return;
  if (btn) { btn.textContent = 'Scanning…'; btn.disabled = true; }
  out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg> Scanning web for buying signals across your accounts…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'scan_external_signals' })
    });
    var data = await r.json();
    console.log('External signals response:', JSON.stringify(data, null, 2));
    if (!data.ok) { out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: ' + esc(data.error || 'Scan failed') + '</div>'; if (btn) { btn.textContent = '\ud83c\udf10 Market signals'; btn.disabled = false; } return; }

    var results = data.results || [];
    var totalSignals = data.totalSignalsDetected || 0;

    if (!totalSignals) {
      out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">No buying signals found across ' + data.accountsScanned + ' accounts. Try again later, signals refresh as news breaks.</div>';
      if (btn) { btn.textContent = '\ud83c\udf10 Market signals'; btn.disabled = false; }
      return;
    }

    var html = '<div style="font-size:11px;font-weight:600;color:var(--blue);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">\ud83c\udf10 Market Signals \u2014 ' + totalSignals + ' found across ' + data.accountsScanned + ' accounts</div>';

    results.forEach(function(r) {
      if (!r.signalsDetected) return;
      html += '<div style="font-size:11px;font-weight:600;color:var(--text);margin-top:8px;margin-bottom:4px">' + esc(r.account) + (r.region ? ' <span style="font-size:11px;color:var(--text3);background:rgba(0,0,0,0.08);border-radius:var(--r-sm);padding:1px 5px">' + esc(r.region) + '</span>' : '') + ' <span style="font-size:11px;color:var(--text3);font-weight:400">\u2014 ' + r.signalsDetected + ' signals</span></div>';
    });

    // Load signals from DB and render full content grouped by account
    try {
      var sigRes = await fetch(SB_URL + '/rest/v1/account_signals?org_id=eq.' + profile.org_id + '&is_active=eq.true&order=detected_at.desc&limit=30', {
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token }
      });
      var signals = await sigRes.json();
      if (Array.isArray(signals) && signals.length) {
        var byAcct2 = {};
        signals.forEach(function(s) { var k = s.account_name||s.account_id||'Unknown'; if (!byAcct2[k]) byAcct2[k]=[]; byAcct2[k].push(s); });
        html = '<div style="font-size:11px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg> Market Signals · ' + signals.length + ' signals across ' + Object.keys(byAcct2).length + ' accounts</div>';
        Object.entries(byAcct2).forEach(function(entry) {
          var acct2 = entry[0]; var acctSigs2 = entry[1];
          html += '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px">'+esc(acct2)+' <span style="font-size:11px;color:var(--text3);font-weight:400">'+acctSigs2.length+' signal'+(acctSigs2.length!==1?'s':'')+'</span></div>';
          acctSigs2.forEach(function(s) { html += renderMarketSignalCard(s); });
          html += '</div>';
        });
      }
    } catch(e) { /* non-fatal */ }

    out.innerHTML = html;
  } catch(e) { out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: ' + esc(e.message) + '</div>'; }
  if (btn) { btn.textContent = '\ud83c\udf10 Market signals'; btn.disabled = false; }
}

// ── OOO mail → auto task ──────────────────────────────────────────────────────
// Runs automatically on app open. Scans inbox for OOO replies, creates
// follow-up tasks on the first business day after the person returns.
// Shows a quiet notification in the Today tab (not the SAM tab).
// Shared busy-state helper for the small header buttons. Swaps the label,
// blocks a second click, and restores whatever the button said before.
function setBtnBusy(id, busyLabel) {
  var b = document.getElementById(id); if (!b) return null;
  if (b.dataset.busy === '1') return null;      // already running
  b.dataset.busy = '1';
  b.dataset.restore = b.innerHTML;
  b.classList.add('is-busy');
  b.disabled = true;
  b.textContent = busyLabel;
  return b;
}
function clearBtnBusy(id, doneLabel, holdMs) {
  var b = document.getElementById(id); if (!b) return;
  var restore = function() {
    b.innerHTML = b.dataset.restore || b.innerHTML;
    b.classList.remove('is-busy'); b.disabled = false; b.dataset.busy = '';
  };
  if (doneLabel) {
    // Say what happened before snapping back, otherwise a scan that finds
    // nothing is indistinguishable from a button that did nothing.
    b.classList.remove('is-busy'); b.textContent = doneLabel;
    setTimeout(restore, holdMs || 2200);
  } else { restore(); }
}

async function processOooMails() {
  var _btn = setBtnBusy('oooScanBtn', 'Scanning…');
  // Called on load as well as by the button, so a missing button is normal.
  try {
    var r = await fetch(EDGE_FN_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'process_ooo_mails', days:14})
    });
    var d = await r.json();
    if (!d.ok || !d.tasksCreated?.length) {
      if (_btn) clearBtnBusy('oooScanBtn', d && d.ok ? 'No new OOO replies' : 'Scan failed');
      return;
    }
    if (_btn) clearBtnBusy('oooScanBtn', d.tasksCreated.length + ' follow-up' + (d.tasksCreated.length !== 1 ? 's' : '') + ' added');
    // Show quiet banner in Today tab
    var row    = document.getElementById('oooSyncRow');
    var status = document.getElementById('oooSyncStatus');
    var dismiss = document.getElementById('oooSyncDismiss');
    if (row && status) {
      var dateList = d.tasksCreated.map(function(t) {
        var d2 = new Date(t.taskDate);
        return d2.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }) + ' (' + esc(t.senderName) + ')';
      }).join(', ');
      status.innerHTML = '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> ' + d.tasksCreated.length + ' OOO follow-up task' + (d.tasksCreated.length!==1?'s':'') + ' created, <strong>' + dateList + '</strong>';
      row.style.display = 'block';
      if (dismiss) dismiss.addEventListener('click', function(){ row.style.display='none'; });
    }
    // Refresh task list so new tasks appear immediately if they're for today
    syncDown().then(function(){ render(); });
  } catch(e) {
    // A thrown request must still release the button, otherwise it spins
    // forever and the only way out is a page reload.
    if (_btn) clearBtnBusy('oooScanBtn', 'Scan failed');
  }
}

// ── Auto-complete obvious tasks ───────────────────────────────────────────────
// Marks done any task that is clearly completed based on context:
// ── Auto-complete tasks via Gmail verification ────────────────────────────────
//
// Matching guards (precision-first, "every completion shows its receipts"):
//   • DATE  — a task for today is only ever verified by evidence dated today.
//             Past transcripts/notes/mails never complete a current-day task.
//   • PERSON— if the task names a person ("Call Aman Gautam", "connect with
//             Milind"), the evidence must reference that person, not just the
//             company. A company-only match on a person task is rejected.
//   • REGION— if the task is geography-scoped ("Reckitt Africa"), the evidence
//             must carry the same region. Conflicting-region or region-less
//             evidence is rejected so an APAC thread never closes an Africa task.
//   • COUNT — "send 15 mails" needs 15 matching sends, not 1, before completing.
var _REGION_ALIASES = {
  africa:   ['africa','african','nigeria','kenya','egypt','morocco','ghana','south africa'],
  apac:     ['apac','asia pacific','asia-pacific','sea','anz','australia','singapore','japan','korea','indonesia','philippines','vietnam','thailand','malaysia'],
  india:    ['india','indian','bharat','mumbai','delhi','bengaluru','bangalore','pune','chennai'],
  europe:   ['europe','european','emea','uk','united kingdom','germany','france','spain','italy','nordics','netherlands','poland'],
  mena:     ['mena','middle east','gcc','uae','dubai','saudi','qatar','kuwait','bahrain','oman'],
  americas: ['americas','latam','usa','united states','north america','canada','mexico','brazil','argentina','colombia']
};
function _regionsIn(text) {
  var t = (text || '').toLowerCase(), out = [];
  Object.keys(_REGION_ALIASES).forEach(function(canon) {
    var hit = _REGION_ALIASES[canon].some(function(a) {
      return new RegExp('(^|[^a-z])' + a.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&') + '([^a-z]|$)').test(t);
    });
    if (hit) out.push(canon);
  });
  return out;
}
// Regional task ⇒ evidence must share the region. Non-regional task ⇒ no gate.
function _regionGateOk(taskText, evidenceText) {
  var tr = _regionsIn(taskText);
  if (!tr.length) return true;
  var er = _regionsIn(evidenceText);
  if (!er.length) return false;                        // no region receipt → reject
  return tr.some(function(r) { return er.indexOf(r) > -1; });
}
// Pull named people from action verbs. Returns first/last name tokens to look for.
function _personsIn(taskText) {
  // Triggers matched case-insensitively (so a sentence-initial "Call ..." works);
  // the captured name must still be Capitalized to look like a proper noun.
  var re = /\b(?:call|called|connect with|catch up with|catchup with|sync with|meeting with|meet with|meet|met|ping|speak to|spoke to|reach(?:ed)? out to|follow up with|followup with|touch base with|with)\s+([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)?)/gi;
  var names = [], m;
  while ((m = re.exec(taskText || ''))) {
    var n = m[1].trim();
    if (!/^[A-Z]/.test(n)) continue;                    // must start capitalized
    if (_regionsIn(n).length) continue;                 // don't treat a place as a person
    names.push(n);
  }
  return names;
}
function _personGateOk(taskText, evidenceText) {
  var people = _personsIn(taskText);
  if (!people.length) return true;
  var own = _ownIdentityTokens();
  var ev = (evidenceText || '').toLowerCase(), tokens = [];
  people.forEach(function(p) { p.toLowerCase().split(/\s+/).forEach(function(tok) { if (tok.length >= 3 && own.indexOf(tok) === -1) tokens.push(tok); }); });
  if (!tokens.length) return true;                       // only self-named → no gate
  return tokens.some(function(tok) { return ev.indexOf(tok) > -1; });
}
// Evidence date must be today. If the evidence carries no timestamp we cannot
// prove same-day, so for date-sensitive phases we treat "no date" as pass only
// when the fetch window was already today-scoped (documented at each call site).
function _isToday(ms) {
  if (!ms) return false;
  var n = Number(ms);
  if (n < 1e12) n *= 1000;                              // seconds → ms
  return dateKey(new Date(n)) === todayKey();
}
function _evDate(o) {
  if (!o) return 0;
  return o.date || o.ts || o.timestamp || o.internalDate || o.sentAt || o.started_at || o.receivedDateTime || 0;
}
// One gate to rule them all (person + region). Date handled per call site.
function _matchGatesOk(taskText, evidenceText) {
  return _personGateOk(taskText, evidenceText) && _regionGateOk(taskText, evidenceText);
}
// Parse an explicit target count out of bulk-send tasks ("send 15 mails").
function _requiredCount(taskText) {
  var m = (taskText || '').match(/\b(\d{1,3})\s*(?:\+\s*)?(mails?|e-?mails?|messages?|msgs?|outreach(?:es)?|touch(?:es|points?)?|follow.?ups?|sequences?|contacts?|prospects?|accounts?)\b/i);
  if (!m) return 1;
  var n = parseInt(m[1], 10);
  return (n && n > 1) ? n : 1;
}
// Meeting/task boilerplate that is NOT a usable identifier. A recap can only
// complete a task if it shares a DISTINCTIVE token (a person, account or topic),
// never a generic word like "weekly" or "review" — otherwise a notetaker digest
// or notification email that merely contains "weekly" would falsely verify it.
var _GENERIC_TASK_WORDS = {};
('meeting meetings call calls sync syncs demo demos review reviews weekly biweekly monthly daily quarterly fortnightly cadence standup huddle catchup checkin touchbase brainstorm brainstorming session sessions discussion discuss align alignment update updates recap recaps notes note followup followups follow internal external team teams general misc adhoc connect chat quick roundup planning plan prep debrief retro retrospective onboarding intro introduction kickoff alignment virtual physical online zoom gmeet meet google calendar invite scheduled schedule reschedule finalize finalise about regarding discuss next steps step this that from your please today tomorrow week month with and the for our their your').split(/\s+/).forEach(function(w){ _GENERIC_TASK_WORDS[w] = 1; });
// The signed-in user's own identity tokens (from their email local-part). These
// must NEVER be used as a match key: the user is a participant on essentially
// every recap they receive, so their own name ("vasu") appears in all of their
// evidence — including colleagues' Read.ai/Fireflies recaps CC'd to them. Using
// it would let any recap verify any of their meetings.
function _ownIdentityTokens() {
  var toks = [];
  try {
    var email = ((typeof currentUser !== 'undefined' && currentUser && currentUser.email) || '').toLowerCase();
    (email.split('@')[0] || '').split(/[._\-+]+/).forEach(function(t) { if (t.length >= 3) toks.push(t); });
    // The company too: its email domain ("samoraglobal") and its name ("Samora Global").
    var dom = (email.split('@')[1] || '').split('.')[0] || '';
    if (dom.length >= 3) toks.push(dom);
    var orgName = ((typeof profile !== 'undefined' && profile && profile.org_name) || '').toLowerCase();
    orgName.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).forEach(function(t) { if (t.length >= 4 && ['global','india','group','private','limited','technologies','solutions'].indexOf(t) === -1) toks.push(t); });
    if (dom.length >= 6) ['global','india','group','tech','labs','hq'].forEach(function(sfx) { if (dom.slice(-sfx.length) === sfx && dom.length - sfx.length >= 4) toks.push(dom.slice(0, dom.length - sfx.length)); });
  } catch (e) {}
  return toks;
}
// Participants from outside your company only: your own address is on every recap you receive.
function _outsideParticipants(list) {
  var dom = ((((typeof currentUser !== 'undefined' && currentUser && currentUser.email) || '').toLowerCase()).split('@')[1]) || '';
  return (list || []).filter(function (e) { var x = String(e || '').toLowerCase(); return x && (!dom || x.split('@')[1] !== dom); });
}
function _distinctiveWords(taskText) {
  var own = _ownIdentityTokens();
  return (taskText || '').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(function(w) {
    return w.length >= 4 && !_GENERIC_TASK_WORDS[w] && own.indexOf(w) === -1;
  });
}
var _autoCompleteBusy = false;
async function autoCompleteTasks(silent) {
  if (_autoCompleteBusy) return;
  _autoCompleteBusy = true;
  var btn = document.getElementById('autoCompleteBtn');
  var out = document.getElementById('samLocalIntelOutput');
 if (!silent && btn) { btn.textContent = 'Checking evidence…'; btn.disabled = true; }
  if (!silent && out) out.innerHTML = '<div style="font-size:12px;color:var(--text3)">Checking sent mail + meeting transcripts for completed tasks…</div>';
  var today2 = todayKey();
  var d = dayData(today2);
  var count = 0;
  var now = new Date();
  var autoLog = [];

  try {
    // Phase 1: meeting/calendar tasks — require ATTENDANCE evidence, not just time passing.
    // Evidence = a notetaker transcript exists for the meeting (Fireflies/Read.ai etc.
    // only produce one if the meeting actually happened). True "joined the link" logs
    // need Google Workspace admin APIs, so transcripts are the reliable proxy.
    var calTasks = (d.tasks || []).filter(function(t) {
      return !t.done && (t.source === 'calendar' || /\bmeeting\b|\bdemo\b|\bcall\b|\bconnect\b|\bsync\b|\bcatch.?up\b/i.test(t.text));
    });
    if (calTasks.length) {
      var transcripts = [], verifiedMeetings = [], inboxNotes = [];
      // Hard lower bound = start of TODAY in local time (epoch seconds). The scan
      // can never reach into yesterday or earlier; a today task is only ever
      // matched against today's evidence.
      var _startOfToday = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
      try {
        var results = await Promise.all([
          fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_meeting_transcripts', days:1, since:_startOfToday}) }).then(function(r){return r.json();}),
          fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'verify_meetings', date: today2}) }).then(function(r){return r.json();}),
          // Notetaker recaps sitting in the inbox (Fireflies/Fathom/Otter/Read.ai/
          // Grain/tl;dv/Gong/... email you a summary). Deterministic scan, no AI.
          // A recap only exists if the meeting happened, so it is attendance proof.
          fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'list_notetaker_notes', days:1, since:_startOfToday}) }).then(function(r){return r.json();})
        ]);
        transcripts = results[0].transcripts || [];
        verifiedMeetings = results[1].meetings || [];
        inboxNotes = results[2].notes || [];
      } catch(e) { /* non-fatal */ }
      calTasks.forEach(function(task) {
        // Must be past the scheduled time (+30 min grace) if a time is present
        var timeMatch = task.text.match(/at\s+(\d{1,2}):(\d{2})/i);
        if (timeMatch) {
          var eh = parseInt(timeMatch[1], 10), em = parseInt(timeMatch[2], 10);
          var past = now.getHours() > eh || (now.getHours() === eh && now.getMinutes() > em + 30);
          if (!past) return;
        }
        var words = task.text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(function(w){
          return w.length >= 4 && !['meeting','with','call','sync','demo','catch','catchup','virtual'].includes(w);
        });
        if (!words.length) return;
        // Distinctive tokens (names/accounts/topics, generic meeting words stripped).
        // Recap/transcript evidence must overlap on one of THESE, never on a bare
        // "weekly"/"review". A task with no distinctive token (e.g. "Weekly Cadence
        // / Review") can only be closed by real calendar attendance, not a recap.
        var distinct = _distinctiveWords(task.text);
        var hasIdentity = distinct.length > 0 || _personsIn(task.text).length > 0;

        // Match the task to its own calendar event first; otherwise by
        // distinctive words (never the user's own name).
        var matchWords = distinct.length ? distinct : words;
        var calEv = (task.calendarEventId && verifiedMeetings.find(function(m) { return m.id && m.id === task.calendarEventId; })) ||
          verifiedMeetings.find(function(m) {
            var mt = ((m.title||'') + ' ' + (m.external_attendees||[]).join(' ')).toLowerCase();
            return matchWords.some(function(w){ return mt.includes(w); });
          });

        // Evidence 1 (strongest): notetaker transcript exists — but only one
        // recorded TODAY, sharing a DISTINCTIVE token, naming the right person,
        // in the right region.
        var ev = hasIdentity && transcripts.find(function(t) {
          var tt = ((t.title||'') + ' ' + _outsideParticipants(t.participants).join(' ')).toLowerCase();
          if (!distinct.some(function(w){ return tt.includes(w); })) return false;
          var td = _evDate(t);
          if (td && !_isToday(td)) return false;         // never a prior-day transcript
          return _matchGatesOk(task.text, tt);
        });
        if (ev) {
          task.done = true; task.autoCompleted = true; task.verifiedVia = 'meeting_transcript'; count++;
          autoLog.push('<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a2.8 2.8 0 00-2.8 2.8v5.4a2.8 2.8 0 005.6 0V6.3A2.8 2.8 0 0012 3.5zM5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/></svg> ' + esc(task.text.slice(0,50)) + ' → transcript "' + esc((ev.title||'').slice(0,40)) + '"');
          return;
        }
        // Evidence 1b: notetaker recap email in the inbox (today only, distinctive
        // token required so a digest/notification never verifies a meeting).
        var note = hasIdentity && inboxNotes.find(function(n) {
          var nt = ((n.title||'') + ' ' + _outsideParticipants(n.participants).join(' ')).toLowerCase();
          if (!distinct.some(function(w){ return nt.includes(w); })) return false;
          if (!_isToday(_evDate(n))) return false;        // recap must be dated today
          return _matchGatesOk(task.text, nt);
        });
        if (note) {
          task.done = true; task.autoCompleted = true; task.verifiedVia = 'notetaker_email';
          task.verifiedSource = note.provider || 'notetaker'; delete task.meetingFlag; count++;
          autoLog.push('<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a2.8 2.8 0 00-2.8 2.8v5.4a2.8 2.8 0 005.6 0V6.3A2.8 2.8 0 0012 3.5zM5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/></svg> ' + esc(task.text.slice(0,50)) + ' → meeting notes "' + esc((note.title||'').slice(0,40)) + '"');
          return;
        }
        // No recap or transcript: a cancelled or moved meeting never completes.
        if (calEv && (calEv.cancelled || calEv.rescheduled)) {
          task.meetingFlag = calEv.rescheduled ? 'rescheduled' : 'cancelled';
          return;
        }
        // Evidence 2: Post-Meeting-FollowUp-Sent — rep emailed an external
        // attendee within 36h after the event ended. verify_meetings is already
        // today-scoped; still apply person + region gates.
        if (calEv && calEv.ended && calEv.followup_sent &&
            _matchGatesOk(task.text, ((calEv.title||'') + ' ' + (calEv.external_attendees||[]).join(' ') + ' ' + (calEv.followup_subject||'')).toLowerCase())) {
          task.done = true; task.autoCompleted = true; task.verifiedVia = 'post_meeting_followup'; count++;
          autoLog.push('<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> ' + esc(task.text.slice(0,50)) + ' → Post-Meeting-FollowUp-Sent' + (calEv.followup_subject ? ' "' + esc(calEv.followup_subject.slice(0,35)) + '"' : ''));
        }
      });
    }

    // Phase 2: email/respond/outreach tasks — evidence in Gmail/Outlook sent folder
    var emailTasks = (d.tasks || []).filter(function(t) {
      if (t.done) return false;
      return /\bmail\b|\bsend\b|\brespond\b|\breply\b|\bfollow.?up\b|\breach.?out\b|\breach out\b|\bwrite\b|\bemail\b|\bshare\b|\boutreach\b|\bMOM\b|\bminutes\b|\bpointer\b/i.test(t.text);
    });

    if (emailTasks.length > 0) {
      try {
        var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_sent_today', date: today2}) });
        var sentData = await r.json();
        var sentEmails = sentData.emails || [];
        // Defensive: even if the edge widened the window, only count TODAY's sends.
        sentEmails = sentEmails.filter(function(e) { var dt = _evDate(e); return !dt || _isToday(dt); });
        emailTasks.forEach(function(task) {
          // OOO re-engagement tasks carry the contact's email address —
          // strongest possible evidence: did we actually send THEM a mail today?
          if (task.oooContactEmail) {
            var oooHit = sentEmails.find(function(e) { return ((e.to||'')+' '+(e.subject||'')).toLowerCase().includes(task.oooContactEmail); });
            if (oooHit) {
              task.done = true; task.autoCompleted = true; task.verifiedVia = 'ooo_reengage'; count++;
              autoLog.push('<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> ' + esc(task.text.slice(0,50)) + ' → sent to ' + esc(task.oooContactEmail));
            }
            return; // never fall through to fuzzy word matching for OOO tasks
          }
          var _own = _ownIdentityTokens();
          var taskWords = task.text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(function(w){return w.length>3 && !_GENERIC_TASK_WORDS[w] && _own.indexOf(w)===-1 && !['mail','send','from','have','will','been','respond','reply','reach','write','email','share','outreach','through'].includes(w);});
          // Count EVERY qualifying send (not just the first) so bulk targets are
          // honoured, and apply person + region gates to each candidate.
          var matches = sentEmails.filter(function(e) {
            var et = ((e.subject||'')+' '+(e.to||'')+' '+(e.snippet||'')).toLowerCase();
            var hits = taskWords.filter(function(w){return et.includes(w);}).length;
            var overlap = hits >= 2 || (hits >= 1 && taskWords.length <= 3);
            if (!overlap) return false;
            return _matchGatesOk(task.text, et);          // person + geography gates
          });
          var required = _requiredCount(task.text);       // "send 15 mails" → 15
          if (matches.length >= required) {
            task.done = true; task.autoCompleted = true; task.verifiedVia = 'gmail_sent';
            if (required > 1) task.verifiedCount = matches.length + '/' + required;
            delete task.sendProgress; count++;
            autoLog.push('<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> '+esc(task.text.slice(0,50))+(required>1?(' → '+matches.length+'/'+required+' sent'):(' → "'+esc((matches[0].subject||'').slice(0,40))+'"')));
          } else if (matches.length > 0 && required > 1) {
            // Partial: show progress but keep the task open until the count is met.
            task.sendProgress = matches.length + '/' + required;
          }
        });
      } catch(e) { /* non-fatal */ }
    }

    var anyProgress = (d.tasks || []).some(function(t) { return !t.done && t.sendProgress; });
    if (count > 0 || anyProgress) {
      save(today2); render();
    }
    if (count > 0) {
 showToast('Auto-completed ' + count + ' task' + (count!==1?'s':'') + (autoLog.length ? ', ' + autoLog[0].replace(/<[^>]+>/g,'').slice(0,40) : ''));
    } else if (!silent) {
      showToast('No new evidence found for open tasks');
    }
  } finally {
 if (btn) { btn.textContent = 'Auto-complete'; btn.disabled = false; }
    _autoCompleteBusy = false;
  }
}

// Hourly silent auto-complete while the app is open (+ one pass 2 min after load)
var _autoCompleteAt = 0;
function _autoCompleteSoon() { try { if (typeof currentUser !== 'undefined' && currentUser && currentUser.token && Date.now() - _autoCompleteAt > 600000) { _autoCompleteAt = Date.now(); autoCompleteTasks(true); } } catch(e) {} }
setInterval(function(){ _autoCompleteAt = 0; _autoCompleteSoon(); }, 1200000);
setTimeout(_autoCompleteSoon, 15000);
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') _autoCompleteSoon(); });

// SAMpaign inbox sync rides the exact same cadence as auto-complete: both are
// "scan my own mailbox for evidence and update state accordingly", both run
// under the signed-in user's own token, both stay silent when nothing changed.
// Offset by 30s from the auto-complete pass so two Gmail-heavy scans don't
// fire simultaneously on load.
setInterval(function(){ try { syncSampaignsQuiet(); } catch(e) {} }, 3600000);
setTimeout(function(){ try { syncSampaignsQuiet(); } catch(e) {} }, 150000);

async function runLocalIntelligence(repId, resultElId) {
  const isManager = !!repId;
  const out = document.getElementById(resultElId || 'samLocalIntelOutput');
  const btn = isManager ? null : document.getElementById('localIntelBtn');
  if (!out) return;
  if (btn) { btn.textContent = 'Scanning…'; btn.disabled = true; }
  out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">Scanning all channels \u2014 email, calendar, notetaker\u2026</div>';
  // The mailbox pass runs alongside: it credits every account in the org
  // that this mailbox spoke to, including teammates' deals.
  try { fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'mailbox_pass', rep_user_id: isManager ? repId : undefined }) }).catch(function () {}); } catch (e) {}
  try {
    const r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'local_intelligence', rep_user_id: isManager ? repId : undefined }) });
    const data = await r.json();
    console.log('local_intelligence response:', JSON.stringify(data));
    if (data.scopeError) { out.innerHTML = '<div style="font-size:12px;color:var(--coral);padding:8px 0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 10.5V7.5a5.5 5.5 0 0111 0v3M5 10.5h14v10H5z"/></svg> ' + esc(data.error || 'Gmail permissions need to be re-granted.') + '</div>'; if (btn) { btn.textContent = 'Scan'; btn.disabled = false; } return; }
    if (!data.connected) { out.innerHTML = '<div style="font-size:12px;color:var(--text3)">Gmail not connected' + (isManager?' for this rep':'') + '</div>'; if (btn) { btn.textContent = 'Scan'; btn.disabled = false; } return; }
    if (data.message) { out.innerHTML = '<div style="font-size:12px;color:var(--text3)">' + esc(data.message) + '</div>'; if (btn) { btn.textContent = 'Scan'; btn.disabled = false; } return; }
    const accounts = data.accounts || [];
    if (!accounts.length) { out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">No assigned accounts to scan</div>'; if (btn) { btn.textContent = 'Scan'; btn.disabled = false; } return; }

    const sc = data.stageCounts || {};
    let html = '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
    ['commercial','value_prop','prospective'].forEach(function(stage) {
      const cfg = DEAL_STAGE_CONFIG[stage];
      html += '<div style="flex:1;min-width:90px;background:rgba(0,0,0,0.06);border-radius:var(--r-sm);padding:8px;text-align:center">' +
        '<div style="font-size:20px;font-weight:600;color:' + cfg.color + '">' + (sc[stage]||0) + '</div>' +
        '<div style="font-size:11px;color:var(--text3)">' + cfg.icon + ' ' + cfg.label + '</div>' +
      '</div>';
    });
    html += '</div>';

    // Group accounts by stage, render each as its own section, most
    // advanced (Commercial) first since that's usually highest priority to review.
    ['commercial','value_prop','prospective','unknown'].forEach(function(stage) {
      const inStage = accounts.filter(function(a) { return a.stage === stage; });
      if (!inStage.length) return;
      const cfg = DEAL_STAGE_CONFIG[stage];
      html += '<div style="margin-bottom:14px">';
      html += '<div style="font-size:11px;font-weight:600;color:' + cfg.color + ';text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">' + cfg.icon + ' ' + cfg.label + ' (' + inStage.length + ') \u2014 <span style="font-weight:400;text-transform:none;color:var(--text3)">' + cfg.desc + '</span></div>';

      // Group by parent account for regional hierarchy display
      var stageGroups = {};
      inStage.forEach(function(a) {
        var key = a.parentAccountId || ('solo_' + a.account);
        if (!stageGroups[key]) stageGroups[key] = { accounts: [] };
        stageGroups[key].accounts.push(a);
      });

      Object.keys(stageGroups).forEach(function(key) {
        var grp = stageGroups[key];
        if (grp.accounts.length > 1) {
          var parentLabel = grp.accounts[0].account.replace(/\s+(india|middle east|europe|apac|americas|global|africa|asia|us|uk|latam|mena|sea|gcc)$/i,'').trim();
          html += '<div style="font-size:11px;color:var(--text3);font-weight:600;margin:6px 0 3px 4px;text-transform:uppercase;letter-spacing:0.04em">' + esc(parentLabel) + '</div>';
        }
        grp.accounts.forEach(function(a) {
          const stalenessBadge = a.staleness === 'cold' ? '<span style="font-size:11px;font-weight:700;color:var(--coral);background:rgba(192,82,63,0.12);border-radius:var(--r-sm);padding:1px 6px;margin-left:6px">\u2744 COLD</span>'
            : a.staleness === 'stale' ? '<span style="font-size:11px;font-weight:700;color:var(--amber);background:rgba(var(--c-accent-rgb),0.12);border-radius:var(--r-sm);padding:1px 6px;margin-left:6px">STALE</span>' : '';
          const regionBadge = a.region ? '<span style="font-size:11px;color:var(--text3);background:rgba(0,0,0,0.06);border-radius:var(--r-sm);padding:1px 6px;margin-left:5px">' + esc(a.region) + '</span>' : '';
          const indent = grp.accounts.length > 1 ? 'margin-left:10px;border-left-width:2px;' : '';
          html += '<div style="border-left:3px solid ' + cfg.color + ';' + indent + 'padding:8px 12px;margin-bottom:6px;background:rgba(0,0,0,0.04);border-radius:0 6px 6px 0">' +
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
              '<div style="font-size:12px;font-weight:600;color:var(--text)">' + esc(a.account) + regionBadge + stalenessBadge + '</div>' +
              '<div style="display:flex;gap:4px;flex-wrap:wrap">' + renderChannelBadges(a.channels) + '</div>' +
            '</div>' +
            (a.lastSentSubject ? '<div style="font-size:11px;color:var(--text3);margin-top:4px;font-style:italic">Last: "' + esc(a.lastSentSubject.slice(0,80)) + '"</div>' : '') +
          '</div>';
        });
      });
      html += '</div>';
    });

    out.innerHTML = html;
  } catch(e) { out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: ' + esc(e.message) + '</div>'; }
  if (btn) { btn.textContent = 'Scan'; btn.disabled = false; }
}

async function runCoverageCheck(repId, repEmail, resultElId) {
  const isManager = !!repId; const targetId = repId||currentUser?.id; const btnId = isManager?null:'coverageCheckBtn'; const outputId = resultElId||'samCoverageOutput';
  const btn = btnId?document.getElementById(btnId):null; const out = document.getElementById(outputId); if (!out) return;
  _coverageRepId[outputId] = repId; _coverageRepEmail[outputId] = repEmail;
  const { from, to, label } = getCoverageDateRange(outputId);
  if (btn) { btn.textContent = 'Scanning…'; btn.disabled = true; }
  out.innerHTML = renderCoveragePeriodPicker(outputId) + '<div style="font-size:12px;color:var(--text3)">Checking account coverage for '+esc(label)+'…</div>';
  try {
    const r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'account_coverage', rep_user_id: isManager?targetId:null, date_from: from, date_to: to }) });
    const data = await r.json();
    const picker = renderCoveragePeriodPicker(outputId);
    if (data.scopeError) { out.innerHTML = picker + '<div style="font-size:12px;color:var(--coral);padding:8px 0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 10.5V7.5a5.5 5.5 0 0111 0v3M5 10.5h14v10H5z"/></svg> ' + esc(data.error || 'Gmail permissions need to be re-granted, reconnect Gmail.') + '</div>'; if (btn){btn.textContent='Check today';btn.disabled=false;} return; }
    if (data.reconnectNeeded) { out.innerHTML = picker + '<div style="font-size:12px;color:var(--coral);padding:8px 0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> ' + esc(data.error || 'Gmail connection expired, reconnect Gmail.') + '</div>'; if (btn){btn.textContent='Check today';btn.disabled=false;} return; }
    if (!data.connected) {
      var covErrMsg = data.error && data.error !== 'Gmail not connected' ? data.error : ('Gmail not connected'+(isManager?' for this rep':''));
      var covErrColor = data.error && data.error === 'Unauthorized' ? 'var(--coral)' : 'var(--text3)';
      out.innerHTML = picker + '<div style="font-size:12px;color:'+covErrColor+'">'+esc(covErrMsg)+'</div>'; if (btn){btn.textContent='Check today';btn.disabled=false;} return;
    }
    const s = data.summary||{};
    const grid = data.accountGrid||[];
    if (!grid.length) {
      const emptyMsg = data.noAssignedAccounts
        ? 'No accounts assigned to this rep yet \u2014 add some in Org \u2192 Rep Accounts to start tracking coverage'
        : 'No task activity matched an assigned account for ' + esc(label);
      out.innerHTML = picker + '<div style="font-size:12px;color:var(--text3)">'+emptyMsg+'</div>'; if (btn){btn.textContent='Check today';btn.disabled=false;} return;
    }
    const pct = s.coverageRate||0; const barColor = pct>=80?'var(--green)':pct>=50?'var(--amber)':'var(--coral)';
    let html = picker;
    html += '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--text2)">'+s.coveredAccounts+'/'+s.totalAccounts+' accounts reached · '+s.totalLogged+' logged · '+s.totalVerified+' verified</span><span style="color:'+barColor+';font-weight:600">'+pct+'%</span></div><div style="height:5px;background:var(--surface2);border-radius:var(--r-sm);overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+barColor+';border-radius:var(--r-sm);transition:width 0.4s"></div></div></div>';

    if (data.hasSeqData) {
      html += '<div style="font-size:11px;color:var(--green);background:rgba(74,140,92,0.08);border:1px solid rgba(74,140,92,0.2);border-radius:var(--r-sm);padding:5px 10px;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> SmartReach signals loaded, calls, LinkedIn and WhatsApp verified where data exists</div>';
    }

    html += '<div style="margin-bottom:12px;border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden">';
    html += '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;padding:8px 12px;background:var(--surface2);border-bottom:1px solid var(--border)">Outreach by account</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead><tr style="background:var(--surface2)">' +
      '<th style="padding:6px 10px;text-align:left;color:var(--text3);font-weight:500">Account</th>' +
      '<th style="padding:6px 6px;text-align:center;color:var(--text3);font-weight:500"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Email</th>' +
      '<th style="padding:6px 6px;text-align:center;color:var(--text3);font-weight:500"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1.5 1.5M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1.5-1.5"/></svg> LinkedIn</th>' +
      '<th style="padding:6px 6px;text-align:center;color:var(--text3);font-weight:500"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5H4.5A1.5 1.5 0 003 5c0 8.8 7.2 16 16 16a1.5 1.5 0 001.5-1.5V17l-4.5-2-2.5 2.5A15 15 0 018.5 11L11 8.5z"/></svg> Calls</th>' +
      '<th style="padding:6px 6px;text-align:center;color:var(--text3);font-weight:500"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg> WA</th>' +
      '<th style="padding:6px 6px;text-align:center;color:var(--text3);font-weight:500">↩ Replies</th>' +
      '<th style="padding:6px 8px;text-align:center;color:var(--text3);font-weight:500">Signal</th>' +
      '</tr></thead><tbody>';

    grid.forEach(function(g) {
      // Generic verified/logged cell with source badge
      var cell = function(bucket) {
        if (!bucket.verified && !bucket.logged) return '<span style="color:var(--text3)">—</span>';
        var h = '';
        if (bucket.verified > 0) {
          h += '<span style="color:var(--green);font-weight:600">'+bucket.verified+'</span>';
          if (bucket.source) {
            var src = (bucket.source||'').replace('gmail+smartreach','G+SR').replace('smartreach','SR').replace('gmail','G');
            h += '<span style="font-size:11px;color:var(--text3);margin-left:2px">'+src+'</span>';
          }
        } else {
          h += '<span style="color:var(--text2)">'+bucket.logged+'</span><span style="font-size:11px;color:var(--text3)"> lgd</span>';
        }
        return h;
      };

      // Email cell — shows verified count + source + opens if available
      var emailCell = function(b) {
        if (!b.verified && !b.logged) return '<span style="color:var(--text3)">—</span>';
        var h = '';
        if (b.verified > 0) {
          h += '<span style="color:var(--green);font-weight:600">'+b.verified+'</span>';
          var src = (b.source||'').replace('gmail+smartreach','G+SR').replace('smartreach','SR').replace('gmail','G');
          if (src) h += '<span style="font-size:11px;color:var(--text3);margin-left:2px">'+src+'</span>';
          if (b.opens > 0) h += '<br><span style="font-size:11px;color:var(--amber)">'+b.opens+'\uD83D\uDC41</span>';
          // Gap warning: rep claimed much more than tools verified
          if (b.logged > b.verified * 2 && b.logged > 5)
            h += '<br><span style="font-size:11px;color:var(--amber)" title="'+b.logged+' claimed in tasks, only '+b.verified+' found in Gmail/SmartReach">'+b.logged+' lgd \u26A0</span>';
          // SmartReach has a lifetime count for this account, but it's excluded
          // from today's headline number because SmartReach doesn't expose
          // per-event timestamps — that count would be misleading as "today's" activity.
          if (b.seqNotDateAccurate && b.seqVerified > 0)
            h += '<br><span style="font-size:11px;color:var(--text3)" title="SmartReach shows '+b.seqVerified+' total signals for this account, but SmartReach doesn\u2019t timestamp individual events \u2014 excluded from today\u2019s count to avoid showing stale activity as today\u2019s">SR: '+b.seqVerified+' lifetime (not dated)</span>';
        } else {
          h += '<span style="color:var(--text2)">'+b.logged+'</span><span style="font-size:11px;color:var(--text3)"> lgd</span>';
        }
        return h;
      };

      // Call cell — uses resolveChannelSignals priority: task-done > attested > calendar > seq
      var CALL_SOURCE_LABELS = {
        'attested':    { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>', color: 'var(--green)',  label: 'Outcome logged' },
        'task-done':   { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>', color: 'var(--blue)',   label: 'Task marked done' },
        'task+sr':     { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>', color: 'var(--green)',  label: 'Done + SR activity' },
        'task+seq':    { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>', color: 'var(--green)',  label: 'Done + SR calls' },
        'calendar':    { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg>', color: 'var(--blue)',   label: 'Calendar event' },
        'seq':         { icon: '↺', color: 'var(--text3)',  label: 'SR call step' },
        'attested+calendar': { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>', color: 'var(--green)', label: 'Done + Calendar' }
      };
      var callCell = function(b) {
        if (!b.verified && !b.logged) return '<span style="color:var(--text3)">—</span>';
        var h = '';
        if (b.verified > 0) {
          var cfg = CALL_SOURCE_LABELS[b.source] || { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>', color: 'var(--green)', label: b.source || 'verified' };
          h += '<span style="color:'+cfg.color+';font-weight:600">'+b.verified+'</span>';
          h += '<span style="font-size:11px;color:'+cfg.color+';margin-left:3px" title="'+esc(b.detail||'')+'">'+cfg.icon+' '+cfg.label+'</span>';
        } else if (b.logged > 0) {
          h += '<span style="color:var(--text3)">'+b.logged+' lgd</span>';
        }
        if (b.seqNotDateAccurate && b.seqVerified > 0) {
          h += '<br><span style="font-size:11px;color:var(--text3)" title="Seq shows '+b.seqVerified+' total, excluded from today count (no per-event timestamp)">SR: '+b.seqVerified+' lifetime</span>';
        }
        return h;
      };
      var seqR = g.seqReplies || 0;
      var gmailR = Math.max(0, (g.repliesReceived||0) - seqR);
      var replyCell = g.repliesReceived > 0
        ? '<span style="color:var(--green);font-weight:600">'+g.repliesReceived+'</span>'
          + (seqR>0&&gmailR>0?'<span style="font-size:11px;color:var(--text3);margin-left:2px">G+SR</span>':seqR>0?'<span style="font-size:11px;color:var(--text3);margin-left:2px">SR</span>':'')
        : '<span style="color:var(--text3)">—</span>';

      // ── Engagement quality signal ─────────────────────────────────────────
      // Compute a quick per-account signal from what we know:
      // - Has verified outreach AND got a reply → <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg> Hot
      // - Has opens but no reply → <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Engaged, no reply
      // - Verified outreach, no engagement → <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s6 6.4 6 10.2a6 6 0 11-12 0C6 9.9 12 3.5 12 3.5z"/></svg> Sent, no signal
      // - Only logged (no tool verification) → <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg> Unverified
      // - No outreach at all → ○ Not touched
      var totalVerifiedTouches = (g.email.verified||0) + (g.linkedin.verified||0) + (g.call.verified||0) + (g.whatsapp.verified||0);
      var totalLoggedTouches   = (g.email.logged||0) + (g.linkedin.logged||0) + (g.call.logged||0) + (g.whatsapp.logged||0);
      var emailOpens = g.email.opens || 0;
      var replies    = g.repliesReceived || 0;
      var channels   = [g.email,g.linkedin,g.call,g.whatsapp].filter(function(b){return b.verified>0;}).length;

      var signal, sigColor, sigTitle;
      if (replies > 0) {
        signal='<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg>'; sigColor='var(--green)'; sigTitle='Prospect responded, pursue now';
      } else if (emailOpens > 0 && totalVerifiedTouches > 0) {
        signal='<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z"/></svg>'; sigColor='var(--amber)'; sigTitle='Opening but not replying, try a different hook or switch channel';
      } else if (totalVerifiedTouches > 0 && channels >= 2) {
        signal='<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>'; sigColor='var(--blue)'; sigTitle='Multichannel, good coverage, keep at it';
      } else if (totalVerifiedTouches > 0) {
        signal='<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s6 6.4 6 10.2a6 6 0 11-12 0C6 9.9 12 3.5 12 3.5z"/></svg>'; sigColor='var(--text3)'; sigTitle='Verified outreach, no engagement signal yet';
      } else if (totalLoggedTouches > 0) {
        signal='<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg>'; sigColor='var(--text3)'; sigTitle='Rep logged activity but no tool verification';
      } else {
        signal='○'; sigColor='var(--text3)'; sigTitle='No outreach logged';
      }

      // Per-account action hint
      var accountHint = '';
      if (signal === '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg>')  accountHint = 'Hot, follow up today';
      else if (signal === '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z"/></svg>') accountHint = 'Opening, change your hook or call';
      else if (signal === '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>') accountHint = 'Multichannel, stay consistent';
      else if (signal === '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s6 6.4 6 10.2a6 6 0 11-12 0C6 9.9 12 3.5 12 3.5z"/></svg>') accountHint = 'No engagement, try a different channel';
      else if (signal === '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg>') accountHint = 'Unverified, sync SmartReach for accuracy';

      var campaignTag = g.campaigns ? '<div style="font-size:11px;color:var(--text3);margin-top:1px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> '+esc(g.campaigns.slice(0,45))+'</div>' : '';

      // Show individual task lines as sub-bullets so managers see detail like "16 SE Asia + 10 France"
      var taskLines = (g.taskTexts || []).slice(0,4).map(function(t) {
        return '<div style="font-size:11px;color:var(--text3);padding:1px 0 1px 8px;border-left:2px solid var(--border)">'+esc(t)+'</div>';
      }).join('');

      html += '<tr style="border-top:1px solid var(--border)">' +
        '<td style="padding:7px 10px">' +
          '<div style="color:var(--text);font-weight:500;font-size:12px">'+esc(g.account)+'</div>' +
          '<div style="font-size:11px;color:'+sigColor+';margin-top:1px">'+accountHint+'</div>' +
          campaignTag + taskLines +
        '</td>' +
        '<td style="padding:7px 6px;text-align:center;vertical-align:top">'+emailCell(g.email)+'</td>' +
        '<td style="padding:7px 6px;text-align:center;vertical-align:top">'+cell(g.linkedin)+'</td>' +
        '<td style="padding:7px 6px;text-align:center;vertical-align:top">'+callCell(g.call)+'</td>' +
        '<td style="padding:7px 6px;text-align:center;vertical-align:top">'+cell(g.whatsapp)+'</td>' +
        '<td style="padding:7px 6px;text-align:center;vertical-align:top">'+replyCell+'</td>' +
        '<td style="padding:7px 8px;text-align:center;vertical-align:top">' +
          '<span style="font-size:16px" title="'+esc(sigTitle)+'">'+signal+'</span>' +
        '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<div style="font-size:11px;color:var(--text3);margin-bottom:12px;padding:0 2px">G = Gmail verified · SR = SmartReach verified · lgd = rep logged, not tool-verified · Signal: <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg> replied · <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z"/></svg> opening · <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> multichannel · <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s6 6.4 6 10.2a6 6 0 11-12 0C6 9.9 12 3.5 12 3.5z"/></svg> sent · ○ untouched</div>';

    // ── Qualitative coaching (Gemini) ────────────────────────────────────────
    // Build a concise data summary to send to Gemini
    var coachingGrid = grid.map(function(g) {
      return {
        account:         g.account,
        emails_verified: g.email.verified || 0,
        emails_logged:   g.email.logged || 0,
        opens:           g.email.opens || 0,
        linkedin:        g.linkedin.verified || 0,
        calls:           g.call.logged || 0,
        whatsapp:        g.whatsapp.verified || 0,
        replies:         g.repliesReceived || 0,
        campaign:        g.campaigns || null,
        signal:          g.signal || null
      };
    });

    html += '<div id="cov-coaching-'+outputId+'" style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-sm);padding:12px 14px">';
    html += '<div style="font-size:11px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Coaching</div>';
    html += '<div style="font-size:12px;color:var(--text3)">Analysing outreach quality…</div>';
    html += '</div>';

    out.innerHTML = html;

    // Async: fire Gemini coaching call after rendering table
    getCoverageCoaching(coachingGrid, outputId, isManager ? repEmail : currentUser?.email);
  } catch(e) { out.innerHTML = renderCoveragePeriodPicker(outputId) + '<div style="font-size:12px;color:var(--coral)">Error: ' + esc(e.message) + '</div>'; }
  if (btn) { btn.textContent = 'Refresh'; btn.disabled = false; }
}
async function getCoverageCoaching(grid, outputId, repEmail) {
  var coachEl = document.getElementById('cov-coaching-' + outputId);
  if (!coachEl) return;

  // Compute summary stats for context
  var totalAccounts = grid.length;
  var touchedAccounts = grid.filter(function(g){return g.emails_verified > 0 || g.linkedin > 0 || g.calls > 0 || g.whatsapp > 0;}).length;
  var repliedAccounts = grid.filter(function(g){return g.replies > 0;}).length;
  var totalEmails = grid.reduce(function(s,g){return s+g.emails_verified;}, 0);
  var totalOpens = grid.reduce(function(s,g){return s+g.opens;}, 0);
  var totalReplies = grid.reduce(function(s,g){return s+g.replies;}, 0);
  var openRate = totalEmails > 0 ? Math.round(totalOpens/totalEmails*100) : 0;
  var replyRate = totalEmails > 0 ? Math.round(totalReplies/totalEmails*100) : 0;
  var multichannel = grid.filter(function(g){
    var channels = [g.emails_verified>0, g.linkedin>0, g.calls>0, g.whatsapp>0].filter(Boolean).length;
    return channels >= 2;
  }).length;

  // Hot accounts (replied), cold accounts (sent but no engagement), untouched
  var hot = grid.filter(function(g){return g.replies > 0;}).map(function(g){return g.account;});
  var opening = grid.filter(function(g){return g.opens > 0 && g.replies === 0;}).map(function(g){return g.account;});
  var cold = grid.filter(function(g){return (g.emails_verified>0||g.linkedin>0) && g.opens === 0 && g.replies === 0;}).map(function(g){return g.account;});
  var untouched = grid.filter(function(g){return g.emails_verified===0 && g.linkedin===0 && g.calls===0 && g.whatsapp===0;}).map(function(g){return g.account;});

  var dataContext = 'SDR outreach data for ' + (repEmail||'rep') + ':\n' +
    '- Accounts: ' + touchedAccounts + '/' + totalAccounts + ' touched\n' +
    '- Verified email sends: ' + totalEmails + ' | Open rate: ' + openRate + '% | Reply rate: ' + replyRate + '%\n' +
    '- Multichannel accounts (2+ channels): ' + multichannel + '/' + totalAccounts + '\n' +
    (hot.length    ? '- <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg> Replied: '             + hot.join(', ') + '\n' : '') +
    (opening.length? '- <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z"/></svg> Opening, not replying: ' + opening.join(', ') + '\n' : '') +
    (cold.length   ? '- <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.8v.4"/></svg> Sent, zero engagement: ' + cold.join(', ') + '\n' : '') +
    (untouched.length ? '- ○ Not touched: '        + untouched.join(', ') + '\n' : '') +
    '\nBenchmarks: cold email open rate 25-40%, reply rate 5-12%, LinkedIn reply rate 10-20%.\n';

  var prompt = dataContext +
    '\nYou are a sharp B2B sales coach. Provide coaching in exactly 4 sections. Keep each bullet to one punchy sentence. Name specific accounts. No preamble.\n\n' +
    '1. WHAT\'S WORKING (max 2 bullets)\n' +
    '2. WHAT TO FIX NOW (max 3 bullets, specific, actionable, account-level)\n' +
    '3. THIS WEEK\'S PRIORITY (1 sentence, the single most important action)\n' +
    '4. FORECAST (2 sentences, given current activity, what outcome should the rep realistically expect? Be honest but constructive. Address "will my inputs lead to results?")\n\n' +
    'Be direct. Use sales language, not corporate speak. Do not pad with pleasantries.';

  try {
    var r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    var d = await r.json();
    var coaching = d.content?.[0]?.text || '';

    if (!coaching) { coachEl.innerHTML = '<div style="font-size:11px;color:var(--gold);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Coaching</div><div style="font-size:12px;color:var(--text3)">No coaching available</div>'; return; }

    // Parse and render the three sections
    var sections = [
      { key: "WHAT'S WORKING",       color: 'var(--green)', icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>' },
      { key: 'WHAT TO FIX NOW',      color: 'var(--coral)', icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>' },
      { key: "THIS WEEK'S PRIORITY", color: 'var(--gold)',  icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg>' },
      { key: 'FORECAST',             color: 'var(--blue)',  icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>' }
    ];

    var rendered = '<div style="font-size:11px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Coaching, '+esc(repEmail?repEmail.split('@')[0]:'you')+'</div>';

    // Also render quick stats row
    rendered += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">' +
      '<span style="font-size:12px;color:var(--text2)"><strong style="color:'+( openRate>=25?'var(--green)':openRate>=10?'var(--amber)':'var(--coral)' )+'">'+openRate+'%</strong> open rate</span>' +
      '<span style="font-size:12px;color:var(--text2)"><strong style="color:'+( replyRate>=8?'var(--green)':replyRate>=3?'var(--amber)':'var(--coral)' )+'">'+replyRate+'%</strong> reply rate</span>' +
      '<span style="font-size:12px;color:var(--text2)"><strong style="color:var(--blue)">'+multichannel+'/'+ totalAccounts+'</strong> multichannel</span>' +
      '<span style="font-size:12px;color:var(--text2)"><strong style="color:var(--green)">'+repliedAccounts+'</strong> replied</span>' +
    '</div>';

    // Render coaching text — split into sections
    var lines = coaching.split('\n').filter(function(l){return l.trim();});
    var currentSection = null;
    var buf = '';

    lines.forEach(function(line) {
      var sectionMatch = sections.find(function(s){ return line.toUpperCase().includes(s.key); });
      if (sectionMatch) {
        if (currentSection && buf) rendered += buf + '</div>';
        currentSection = sectionMatch;
        buf = '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:600;color:'+sectionMatch.color+';margin-bottom:5px">'+sectionMatch.icon+' '+sectionMatch.key+'</div>';
      } else if (line.match(/^[\-\•\*]/)) {
        buf += '<div style="font-size:12px;color:var(--text);padding:3px 0 3px 12px;border-left:2px solid '+(currentSection?.color||'var(--border)')+';margin-bottom:4px">'+esc(line.replace(/^[\-\•\*]\s*/,''))+'</div>';
      } else if (currentSection) {
        buf += '<div style="font-size:12px;color:var(--text);font-weight:500">'+esc(line)+'</div>';
      }
    });
    if (currentSection && buf) rendered += buf + '</div>';

    coachEl.innerHTML = rendered;
  } catch(e) {
    coachEl.innerHTML = '<div style="font-size:11px;color:var(--gold);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Coaching</div><div style="font-size:12px;color:var(--text3)">Coaching unavailable: '+esc(e.message)+'</div>';
  }
}

// ── You tab accordion sections ────────────────────────────────────────────────

// The card names the account being changed, because "change your password" on a
// shared machine is exactly where someone changes the wrong one.
function _pwShowEmail() {
  var el = document.getElementById('pwEmail');
  if (el && currentUser && currentUser.email) el.textContent = currentUser.email;
}
document.addEventListener('DOMContentLoaded', _pwShowEmail);

function toggleYouAcc(key) {
  if (key === 'password') _pwShowEmail();
  var el = document.getElementById('youAcc-' + key);
  if (!el) return;
  var opening = !el.classList.contains('open');
  document.querySelectorAll('#panel-you .you-acc.open').forEach(function (o) {
    if (o !== el) { o.classList.remove('open'); var b = o.querySelector('.you-row'); if (b) b.setAttribute('aria-expanded', 'false'); }
  });
  el.classList.toggle('open', opening);
  var btn = el.querySelector('.you-row'); if (btn) btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
  if (opening) setTimeout(function () {
    var r = el.getBoundingClientRect();
    if (r.top < 70 || r.top > window.innerHeight * 0.6) { try { window.scrollBy({ top: r.top - 84, behavior: 'smooth' }); } catch (e) { window.scrollBy(0, r.top - 84); } }
  }, 60);
}

// ── Accounts CSV import (individual + admin multi-user) ──────────────────────
var _acctImportRows = null;

function openAccountsImport() {
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.csv,text/csv';
  inp.onchange = function() { if (inp.files[0]) _handleAccountsCsv(inp.files[0]); };
  inp.click();
}

async function _handleAccountsCsv(file) {
  try {
    var text = await file.text();
    var rows = _parseCsv(text);
    if (rows.length < 2) { showToast('CSV appears empty'); return; }
    var headers = rows[0];
    var find = function(patterns) {
      for (var p = 0; p < patterns.length; p++) {
        for (var i = 0; i < headers.length; i++) {
          var h = headers[i].toLowerCase().trim();
          if (/(^|[^a-z])id$|\.id$/.test(h)) continue;
          if (patterns[p].test(h)) return i;
        }
      }
      return -1;
    };
    var map = {
      name:   find([/^account\s*name$/, /^company(\s*name)?$/, /^name$/, /account/, /company/]),
      domain: find([/^website$/, /^domain$/, /website/, /domain/, /url/]),
      region: find([/^region$/, /billing\s*country/, /^country$/, /region/, /country/, /territory/, /^state$/]),
      owner:  find([/owner.*e-?mail/, /e-?mail.*owner/, /^account\s*owner$/, /owner/])
    };
    if (map.name === -1) { showToast('Could not find an account/company name column'); return; }
    var seen = {};
    _acctImportRows = rows.slice(1).filter(function(r){ return r.join('').trim(); }).slice(0, 100).map(function(r) {
      var get = function(idx){ return idx >= 0 ? (r[idx]||'').trim() : ''; };
      var owner = get(map.owner);
      return { name: get(map.name), domain: get(map.domain).replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/.*$/,''),
        region: get(map.region), owner_email: owner.indexOf('@') > -1 ? owner : '' };
    }).filter(function(r){ if (!r.name || seen[r.name.toLowerCase()]) return false; seen[r.name.toLowerCase()] = 1; return true; });
    if (!_acctImportRows.length) { showToast('No account rows found'); return; }
    _renderAcctImportModal();
  } catch(e) { showToast('CSV error: ' + e.message); }
}

function _renderAcctImportModal() {
  document.getElementById('acct-import-modal')?.remove();
  var isAdmin = ['admin','super_admin'].includes((profile?.role||'').toLowerCase());
  var m = document.createElement('div');
  m.id = 'acct-import-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px';
  var inputStyle = 'width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r-sm);padding:5px 7px;color:var(--text);font-family:var(--sans);font-size:11px;outline:none';
  var h = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);max-width:680px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden">';
  h += '<div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">';
  h += '<img src="icons/icon-48.png" style="width:16px;height:16px;border-radius:50%"/>';
  h += '<span style="font-size:13px;font-weight:600;color:var(--text);flex:1">Import ' + _acctImportRows.length + ' accounts, review & edit</span>';
  h += '<button onclick="document.getElementById(\'acct-import-modal\').remove()" style="background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  h += '<div style="padding:10px 16px;font-size:11px;color:var(--text3)">Fill in anything the CRM export missed, domain powers email matching, region powers pipeline breakdowns.' + (isAdmin ? ' Rows with an owner email are assigned to that user; blank = you.' : ' All accounts will be assigned to you.') + '</div>';
  h += '<div style="flex:1;overflow-y:auto;padding:0 16px 10px"><table style="width:100%;border-collapse:collapse;font-size:11px">';
  h += '<tr style="color:var(--text3);text-align:left"><th style="padding:4px 6px;font-weight:600">Account *</th><th style="padding:4px 6px;font-weight:600">Domain</th><th style="padding:4px 6px;font-weight:600">Region</th>' + (isAdmin ? '<th style="padding:4px 6px;font-weight:600">Owner email</th>' : '') + '</tr>';
  _acctImportRows.forEach(function(r, i) {
    h += '<tr>';
    h += '<td style="padding:3px 6px"><input id="ai-name-'+i+'" value="'+esc(r.name)+'" style="'+inputStyle+'"/></td>';
    h += '<td style="padding:3px 6px"><input id="ai-domain-'+i+'" value="'+esc(r.domain)+'" placeholder="acme.com" style="'+inputStyle+'"/></td>';
    h += '<td style="padding:3px 6px"><input id="ai-region-'+i+'" value="'+esc(r.region)+'" placeholder="India" style="'+inputStyle+'"/></td>';
    if (isAdmin) h += '<td style="padding:3px 6px"><input id="ai-owner-'+i+'" value="'+esc(r.owner_email)+'" placeholder="rep@org.com" style="'+inputStyle+'"/></td>';
    h += '</tr>';
  });
  h += '</table></div>';
  h += '<div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end">';
  h += '<button onclick="document.getElementById(\'acct-import-modal\').remove()" style="padding:8px 14px;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--border2);color:var(--text2);font-family:var(--sans);font-size:12px;cursor:pointer">Cancel</button>';
  h += '<button id="acctImportGo" onclick="submitAccountsImport()" style="padding:8px 18px;border-radius:var(--r-sm);background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:12px;font-weight:700;cursor:pointer">Import accounts</button>';
  h += '</div></div>';
  m.innerHTML = h;
  document.body.appendChild(m);
}

async function submitAccountsImport() {
  var isAdmin = ['admin','super_admin'].includes((profile?.role||'').toLowerCase());
  var accounts = _acctImportRows.map(function(r, i) {
    var g = function(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    return { name: g('ai-name-'+i), domain: g('ai-domain-'+i), region: g('ai-region-'+i),
      owner_email: isAdmin ? g('ai-owner-'+i) : '' };
  }).filter(function(r){ return r.name; });
  if (!accounts.length) { showToast('No accounts to import'); return; }
  var btn = document.getElementById('acctImportGo');
  if (btn) { btn.textContent = '↻ Importing…'; btn.disabled = true; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'import_accounts', accounts: accounts }) });
    var d = await r.json();
    if (!d.ok) { showToast(d.error || 'Import failed'); if (btn) { btn.textContent = 'Import accounts'; btn.disabled = false; } return; }
    document.getElementById('acct-import-modal')?.remove();
    var msg = '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Imported ' + d.created + ' account' + (d.created!==1?'s':'') + (d.skipped ? ' · ' + d.skipped + ' already existed' : '');
    if (d.unmapped_owner_emails && d.unmapped_owner_emails.length) msg += ' · ' + d.unmapped_owner_emails.length + ' owner email(s) not found, assigned to you';
    showToast(msg);
    if (typeof loadMyAccounts === 'function') loadMyAccounts();
  } catch(e) { showToast('Error: ' + e.message); if (btn) { btn.textContent = 'Import accounts'; btn.disabled = false; } }
}

function toggleSamChatBar() {
  var bar = document.getElementById('samChatBar');
  var icon = document.getElementById('samFabIcon');
  var label = document.getElementById('samFabLabel');
  if (!bar) return;
  var opening = !bar.classList.contains('open');
  bar.classList.toggle('open', opening);
 if (icon) icon.textContent = opening ? '' : 'S';
  if (label) label.style.display = opening ? 'none' : '';
  if (opening) { var inp = document.getElementById('samChatInput'); if (inp) setTimeout(function(){ inp.focus(); }, 60); }
}

async function runSamQuery() {
  const inp = document.getElementById('samChatInput'); const out = document.getElementById('samChatOutput');
  const query = inp?.value?.trim(); if (!query || !out) return;
  inp.value = ''; out.innerHTML = '<div class="sam-chat-response"><div class="ldots"><span></span><span></span><span></span></div></div>';
  if (!API_KEY) { out.innerHTML = '<div class="sam-chat-response" style="color:var(--text3)">Add your Anthropic API key in Settings to activate SAM chat.</div>'; return; }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{'Content-Type':'application/json','x-api-key':API_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}, body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:400,messages:[{role:'user',content:'You are SAM, a sharp B2B sales intelligence agent. User asks: "'+query+'". Their tasks today: '+JSON.stringify((dayData(viewDate).tasks||[]).map(t=>t.text))+'. Give a sharp 2-3 sentence response. No fluff.'}]}) });
    const data = await r.json(); out.innerHTML = '<div class="sam-chat-response">' + esc(data.content?.[0]?.text || 'No response.') + '</div>';
  } catch(e) { out.innerHTML = '<div class="sam-chat-response" style="color:var(--coral)">Error: '+esc(e.message)+'</div>'; }
}
async function renderTeam() {
  const tl = document.getElementById('teamList'); if (!tl) return;
  const teamDateEl = document.getElementById('teamDateInput');
  const selectedDate = (teamDateEl && teamDateEl.value) ? teamDateEl.value : todayKey();
  tl.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div>Loading team data…</div>';
  if (!SB_URL || !SB_KEY) { tl.innerHTML = '<div class="empty"><div class="empty-icon"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg></div>Set up Supabase in Settings to see team data.</div>'; return; }
  if (!currentUser?.token) { tl.innerHTML = '<div class="empty"><div class="empty-icon"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 10.5V7.5a5.5 5.5 0 0111 0v3M5 10.5h14v10H5z"/></svg></div>Session expired, please sign out and sign back in.</div>'; return; }
  try {
    let q;
    const seeAll = ['super_admin','admin','director','executive'].includes(profile?.role);
    if (seeAll) q = 'user_profiles?org_id=eq.' + profile.org_id + '&is_active=not.is.false&select=user_id,email,role,manager_id';
    else q = 'user_profiles?org_id=eq.' + profile.org_id + '&manager_id=eq.' + currentUser.id + '&is_active=not.is.false&select=user_id,email,role,manager_id';
    const members = await sbGet(q);
    const others = (members || []).filter(m => m.user_id !== currentUser.id);
    if (!others.length) { tl.innerHTML = '<div class="empty"><div class="empty-icon"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20v-1.5A4.5 4.5 0 017 14h4a4.5 4.5 0 014.5 4.5V20M16 4.3a3.5 3.5 0 010 6.4M18 14.3a4.5 4.5 0 013.5 4.2V20"/></svg></div>No team members found. Share your org code for members to join.</div>'; return; }
    populateMgrRepSelect(others);
    const uids = others.map(m => m.user_id);
    const rows = await sbGet('daytrack?day_key=eq.' + selectedDate + '&user_id=in.(' + uids.join(',') + ')&select=user_id,data');
    const dataMap = {}; (rows || []).forEach(r => { dataMap[r.user_id] = r.data; });
    const roleLabelMap = { super_admin:'Admin', admin:'Admin', manager:'Manager', director:'Director', executive:'Executive', member:'Member', sdr:'SDR', ae:'AE' };
    tl.innerHTML = others.map((m, idx) => {
      const d = dataMap[m.user_id] || { tasks:[], issues:[], wins:[], misses:[] };
      const taskArr = d.tasks?.length ? d.tasks : (d.priorities || []);
      const total = taskArr.length, done = taskArr.filter(t=>t.done).length;
      const pct = total ? Math.round(done/total*100) : 0;
      const sc = calcDayScore(taskArr);
      return '<div class="member-card">' +
        '<div class="member-hdr" onclick="toggleMember(' + idx + ',\'' + m.user_id + '\')">' +
          '<div class="m-avatar">' + m.email[0].toUpperCase() + '</div>' +
          '<div class="m-info"><div class="m-name">' + esc(m.email) + ' <span class="role-pill" style="font-size:11px">' + (roleLabelMap[m.role]||'Member') + '</span></div>' +
          '<div class="m-stats"><div class="mst">Tasks <span>' + total + '</span></div><div class="mst">Done <span>' + done + '</span></div><div class="mst">Issues <span>' + (d.issues?.length||0) + '</span></div><div class="mst">Score <span style="color:' + scoreColor(sc.score) + '">' + sc.score + '</span></div></div></div>' +
          '<div class="m-pct"><div class="m-pct-num">' + pct + '%</div><div class="m-pct-lbl">complete</div></div>' +
          '<div class="m-toggle" id="mtog-' + idx + '">▾</div>' +
        '</div>' +
        '<div style="padding:8px 16px;border-top:1px solid var(--border)">' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
            '<button id="sam-btn-' + m.user_id + '" onclick="event.stopPropagation();togglePanel(\'sami-' + m.user_id + '\',function(){runSamIntelligence(\'' + m.user_id + '\',\'' + m.email + '\',\'sami-' + m.user_id + '\')})" style="flex:1;padding:8px;border-radius:var(--radius-sm);background:rgba(var(--c-accent-rgb),0.08);border:1px solid var(--border2);color:var(--gold);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> SAM Intelligence</button>' +
            '<button onclick="event.stopPropagation();togglePanel(\'cov-' + m.user_id + '\',function(){runCoverageCheck(\'' + m.user_id + '\',\'' + m.email + '\',\'cov-' + m.user_id + '\')})" style="flex:1;padding:8px;border-radius:var(--radius-sm);background:rgba(var(--c-accent-rgb),0.08);border:1px solid var(--border2);color:var(--gold);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V4M4 20h16M8 17V11M12.5 17V7.5M17 17v-4"/></svg> Coverage</button>' +
            '<button onclick="event.stopPropagation();togglePanel(\'ivr-' + m.user_id + '\',function(){runIntentVsReality(\'' + m.user_id + '\',\'ivr-' + m.user_id + '\')})" style="flex:1;padding:8px;border-radius:var(--radius-sm);background:rgba(var(--c-accent-rgb),0.08);border:1px solid var(--border2);color:var(--gold);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Intent vs Reality</button>' +
          '</div>' +
          '<div id="sami-' + m.user_id + '" style="margin-top:8px"></div>' +
          '<div id="cov-' + m.user_id + '" style="margin-top:6px"></div>' +
          '<div id="ivr-' + m.user_id + '" style="margin-top:6px"></div>' +
        '</div>' +
        '<div class="member-detail" id="mdet-' + idx + '">' + renderMemberDetail(d, m.user_id, m.email) + '</div>' +
      '</div>';
    }).join('');
  } catch(e) { tl.innerHTML = '<div class="empty"><div class="empty-icon"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg></div>Error loading team: ' + esc(e.message) + '</div>'; }
}
function renderMemberDetail(d, memberId, memberEmail) {
  const canDelegate = ['manager','super_admin','admin'].includes(profile?.role);
  const taskSection = '<div class="det-sec"><div class="det-lbl">Tasks</div>' + ((d.tasks||[]).length ? (d.tasks||[]).map(it => {
    const isPri = it.priority || it.text?.startsWith('*'); const displayTxt = it.text?.startsWith('*') ? it.text.slice(1).trim() : (it.text||'');
    return '<div class="det-item ' + (it.done?'done-item':'') + '"><span class="di-dot" style="background:' + (isPri?'var(--coral)':'var(--gold)') + '"></span><span>' + esc(displayTxt) + '</span>' + (it.completedAt?'<span style="font-size:11px;color:var(--text3);margin-left:6px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> '+it.completedAt+'</span>':'') + '</div>';
  }).join('') : '<div class="m-empty">None logged</div>') + '</div>';
  const issueSection = '<div class="det-sec"><div class="det-lbl">Issues</div>' + ((d.issues||[]).length ? (d.issues||[]).map(it => '<div class="det-item"><span class="di-dot" style="background:var(--coral)"></span>' + esc(it.text) + '</div>').join('') : '<div class="m-empty">None logged</div>') + '</div>';
  const winSection = '<div class="det-sec"><div class="det-lbl">Wins</div>' + ((d.wins||[]).length ? (d.wins||[]).map(it => {
    const displayTxt = it.text?.startsWith('*') ? it.text.slice(1).trim() : (it.text||'');
    const ts = it.completedAt ? '<span style="font-size:11px;color:var(--text3);margin-left:6px">· '+it.completedAt+'</span>' : '';
    // completionNote may be on the win directly (new saves) or on the matching task (pre-fix saves)
    const matchingTask = (d.tasks||[]).find(function(t){ return t.text===it.text && t.completionNote; });
    const noteText = it.completionNote || (matchingTask && matchingTask.completionNote) || '';
    const note = noteText ? '<div style="font-size:11px;color:var(--text2);background:var(--surface2);border-radius:var(--r-sm);padding:3px 8px;margin-top:4px;font-style:italic"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg> '+esc(noteText)+'</div>' : '';
    return '<div class="det-item"><span class="di-dot" style="background:var(--green)"></span><div style="flex:1"><span>'+esc(displayTxt)+'</span>'+ts+note+'</div></div>';
  }).join('') : '<div class="m-empty">None logged</div>') + '</div>';
  const delegateSection = canDelegate ? '<div class="det-sec"><div class="det-lbl">Delegate a task</div><div style="display:flex;gap:8px;margin-top:6px"><input class="setup-input" style="margin-bottom:0;font-size:12px;padding:7px 10px" id="delegate-input-' + memberId + '" placeholder="Task to delegate (min 25 chars)…" maxlength="300"/><button class="setup-btn" style="padding:7px 14px;font-size:12px;white-space:nowrap" onclick="delegateTask(\'' + memberId + '\',\'' + memberEmail + '\')">Send ↗</button></div></div>' : '';
  return taskSection + issueSection + winSection + delegateSection;
}
async function runSamCheck(memberId, memberEmail) {
  const resultEl = document.getElementById('sam-result-' + memberId); const btn = document.getElementById('sam-btn-' + memberId);
  if (!resultEl) return;
 if (btn) { btn.textContent = 'Scanning…'; btn.disabled = true; }
  resultEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">Reading ' + esc(memberEmail.split('@')[0]) + ' signals…</div>';
  try {
    const r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'get_rep_signals', rep_user_id: memberId, query: '', days: 30 }) });
    const data = await r.json();
    if (!data.connected) { resultEl.innerHTML = '<div style="font-size:12px;color:var(--text3)">Gmail not connected for this rep</div>'; }
    else {
      const sent = data.threads||[]; const inbox = data.inboxThreads||[]; const total = data.totalFound||0;
      let html = '<div style="font-size:11px;color:var(--green);margin-bottom:8px">Gmail connected</div>';
      html += '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">'+total+' sent emails (30 days) · '+inbox.length+' replies</div>';
      if (inbox.length>0) { html += '<div style="border-left:3px solid var(--green);padding:6px 10px;background:rgba(74,140,92,0.08);border-radius:0 6px 6px 0;margin-bottom:6px"><div style="font-size:12px;font-weight:500;color:var(--green)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg> '+inbox.length+' reply(ies) from prospect</div>'+inbox.slice(0,2).map(function(t){return '<div style="font-size:11px;color:var(--text2);margin-top:4px">'+esc(t.subject||'')+'</div>';}).join('')+'</div>'; }
      if (sent.length>0) { const last = sent[0]; html += '<div style="font-size:11px;color:var(--text3)">Last sent: <span style="color:var(--text2)">'+esc(last.subject||'')+'</span> · '+esc(last.date||'')+'</div>'; }
      resultEl.innerHTML = html;
    }
  } catch(e) { resultEl.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: ' + esc(e.message) + '</div>'; }
 if (btn) { btn.textContent = 'Refresh SAM signals'; btn.disabled = false; }
}
async function delegateTask(memberId, memberEmail) {
  const inp = document.getElementById('delegate-input-' + memberId); const text = inp.value.trim();
  if (text.length < 25) { alert('Please enter at least 25 characters.'); inp.focus(); return; }
  const selectedDate = document.getElementById('teamDateInput').value || todayKey();
  const isPriority = text.startsWith('*'); const cleanText = isPriority ? text.slice(1).trim() : text;
  const now = new Date(); const ts = now.toLocaleDateString('en-IN', { day:'numeric', month:'short' }) + ' · ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  try {
    const r = await fetch(SB_URL + '/rest/v1/rpc/delegate_task', { method: 'POST', headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_member_id: memberId, p_org_id: profile.org_id, p_day_key: selectedDate, p_task_text: cleanText, p_delegated_by: currentUser.email, p_added_at: ts, p_is_priority: isPriority }) });
    if (!r.ok) throw new Error(await r.text());
    // Notify the assignee's devices (fire-and-forget; no-op if they haven't
    // enabled notifications). Reuses the existing send_push action.
    try {
      var _mgr = (currentUser.email || '').split('@')[0];
      var _when = (selectedDate === todayKey()) ? 'today' : 'for ' + fmtDate(selectedDate);
      fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'send_push', user_ids:[memberId],
 title:'New task from ' + _mgr,
 body:(isPriority?'':'') + cleanText.slice(0,140) + ' (' + _when + ')',
          url:'/?tab=today' }) }).catch(function(){});
    } catch(e) {}
 inp.value = ''; alert('Task delegated to ' + memberEmail + ''); renderTeam();
  } catch(e) { alert('Failed to delegate: ' + e.message); }
}
function toggleMember(idx, userId) {
  const det = document.getElementById('mdet-'+idx);
  const tog = document.getElementById('mtog-'+idx);
  const open = det.classList.toggle('open');
  tog.classList.toggle('open', open);
  // When collapsing, also clear the action panels so they don't stay open
  if (!open && userId) {
    ['sami-','cov-','ivr-'].forEach(function(prefix) {
      var el = document.getElementById(prefix + userId);
      if (el) { el.innerHTML = ''; _panelOpenState[prefix + userId] = false; }
    });
  }
}

let mgrSearchPeriod = 'all';
function setMgrPeriod(period, btn) {
  mgrSearchPeriod = period;
  document.querySelectorAll('#mgr-period-all,#mgr-period-30,#mgr-period-7,#mgr-period-today,#mgr-period-custom').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  const customRange = document.getElementById('mgrCustomRange'); if (customRange) customRange.style.display = period === 'custom' ? 'flex' : 'none';
}
function populateMgrRepSelect(members) {
  // Rep dropdown removed — team account search now always searches across
  // all reps mapped to this manager in one call. Kept as a no-op so the
  // existing call site in renderTeam() doesn't need touching.
}
async function runManagerSearch() {
  const query = document.getElementById('mgrSearchInput')?.value?.trim(); const out = document.getElementById('mgrSearchOutput');
  if (!query) { if(out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Please enter an account name</div>'; return; }
  if (out) out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">Scanning ' + esc(query) + ' across your team\u2019s Gmail\u2026</div>';
  let dateFrom = '', dateTo = '';
  if (mgrSearchPeriod === 'custom') { dateFrom = document.getElementById('mgrDateFrom')?.value||''; dateTo = document.getElementById('mgrDateTo')?.value||''; }
  const daysMap = { all: 0, '30': 30, '7': 7, today: 1 };
  try {
    const r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'search_account_team', query, days: daysMap[mgrSearchPeriod] ?? 0, date_from: dateFrom, date_to: dateTo }) });
    const data = await r.json();
    if (data.error) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral);padding:8px 0">' + esc(data.error) + '</div>'; return; }
    if (data.message) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">' + esc(data.message) + '</div>'; return; }
    const reps = data.repResults || [];
    const intel = data.intelligence || [];
    let html = '<div style="background:var(--surface2);border-radius:var(--radius);padding:14px 16px;margin-bottom:10px">';
    html += '<div style="font-family:var(--serif);font-size:20px;font-weight:500;margin-bottom:8px">' + esc(query) + '</div>';
    html += '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--text3)"><span><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> <b style="color:var(--text)">' + (data.totalFound||0) + '</b> emails sent across team</span><span>↩ <b style="color:var(--green)">' + (data.totalReplies||0) + '</b> replies received</span></div>';
    html += '</div>';

    // Per-rep coverage breakdown
    if (reps.length) {
      html += '<div style="border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden;margin-bottom:12px">';
      html += '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;padding:8px 12px;background:var(--surface2);border-bottom:1px solid var(--border)">Coverage by rep</div>';
      reps.forEach(function(r) {
        if (!r.connected) {
          html += '<div style="padding:8px 12px;border-top:1px solid var(--border);font-size:12px;color:var(--text3)">' + esc(r.rep.split('@')[0]) + ' \u2014 Gmail not connected</div>';
          return;
        }
        const hasActivity = r.emailsSent > 0;
        html += '<div style="padding:8px 12px;border-top:1px solid var(--border)">' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<span style="font-size:12px;font-weight:500;color:var(--text)">' + esc(r.rep.split('@')[0]) + '</span>' +
            '<span style="font-size:11px;color:' + (hasActivity?'var(--green)':'var(--text3)') + '">' + r.emailsSent + ' sent' + (r.repliesReceived>0?' \u00b7 ' + r.repliesReceived + ' repl' + (r.repliesReceived>1?'ies':'y'):'') + '</span>' +
          '</div>' +
          (r.lastSubject ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">Last: ' + esc(r.lastSubject.slice(0,60)) + (r.lastDate?' \u00b7 '+esc(r.lastDate):'') + '</div>' : '') +
        '</div>';
      });
      html += '</div>';
    }

    // Pulled-in intelligence (same data the Intel tab shows for this account)
    if (intel.length) {
      html += '<div style="border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden">';
      html += '<div style="font-size:11px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;padding:8px 12px;background:var(--surface2);border-bottom:1px solid var(--border)">\u26a1 Account intelligence (' + intel.length + ' meeting' + (intel.length>1?'s':'') + ')</div>';
      intel.slice(0,5).forEach(function(row) {
        const sentimentColor = {positive:'var(--green)',neutral:'var(--text3)',negative:'var(--coral)'}[row.sentiment]||'var(--text3)';
        const signalCount = (row.product_feedback||[]).length + (row.pricing_signals||[]).length + (row.competitor_mentions||[]).length + (row.expansion_signals||[]).length + (row.risk_signals||[]).length;
        html += '<div style="padding:10px 12px;border-top:1px solid var(--border)">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">' +
            '<span style="font-size:11px;color:var(--text3)">' + esc(row.meeting_date||'') + ' \u00b7 ' + esc(row.meeting_subject||'') + '</span>' +
            '<span style="font-size:11px;color:' + sentimentColor + '">' + esc(row.sentiment||'') + '</span>' +
          '</div>' +
          (row.summary ? '<div style="font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:4px">' + esc(row.summary) + '</div>' : '') +
          (signalCount > 0 ? '<div style="font-size:11px;color:var(--gold)">' + signalCount + ' signal' + (signalCount>1?'s':'') + ' extracted \u2014 see Intel tab for details</div>' : '') +
        '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="font-size:11px;color:var(--text3);padding:8px 2px">No extracted intelligence for this account yet \u2014 run \u21bb Refresh in the Intel tab to scan meeting notes.</div>';
    }

    if (out) out.innerHTML = html;
  } catch(e) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral);padding:8px 0">Error: ' + esc(e.message) + '</div>'; }
}

let digestPeriod = 'wtd';
function setDigestPeriod(period, btn) {
  digestPeriod = period;
  document.querySelectorAll('#digest-period-wtd,#digest-period-prev,#digest-period-custom').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  const cr = document.getElementById('digestCustomRange'); if (cr) cr.style.display = period === 'custom' ? 'flex' : 'none';
}
function getDigestDateRange() {
  const today = todayKey();
  if (digestPeriod === 'wtd') { const d = new Date(); const day = d.getDay(); const monday = new Date(d); monday.setDate(d.getDate() - (day===0?6:day-1)); return { from: monday.toISOString().split('T')[0], to: today }; }
  if (digestPeriod === 'prev') { const d = new Date(); const day = d.getDay(); const lastMonday = new Date(d); lastMonday.setDate(d.getDate()-day-6); const lastSunday = new Date(d); lastSunday.setDate(d.getDate()-day); return { from: lastMonday.toISOString().split('T')[0], to: lastSunday.toISOString().split('T')[0] }; }
  if (digestPeriod === 'custom') return { from: document.getElementById('digestDateFrom')?.value||today, to: document.getElementById('digestDateTo')?.value||today };
  return { from: today, to: today };
}
async function sendWeeklyDigest() {
  const btn = document.getElementById('digestBtn'); const out = document.getElementById('digestOutput');
  if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }
  const { from, to } = getDigestDateRange();
  const toManager = document.getElementById('digestToManager')?.checked !== false;
  const toReps = document.getElementById('digestToReps')?.checked !== false;
  try {
    const extraEmails = (document.getElementById('digestExtraEmails')?.value||'').split(',').map(function(e){return e.trim();}).filter(function(e){return e.includes('@');});
    const r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'weekly_digest', date_from: from, date_to: to, send_to_manager: toManager, send_to_reps: toReps, extra_emails: extraEmails }) });
    const data = await r.json();
    if (data.success) {
      // Partial delivery is not success and must not read like it. Six
      // attempted, one delivered used to render as "sent to 6 people".
      var okLine = '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Delivered to ' + data.sent + ' of ' + (data.attempted || data.sent) + ' for ' + esc(data.weekLabel || '');
      var html = '<div style="font-size:12px;color:' + (data.failed ? 'var(--amber)' : 'var(--green)') + ';padding:8px 0">' + okLine + '</div>';
      if (data.failed) {
        html += '<div style="font-size:11px;color:var(--coral);padding:2px 0 6px">' + data.failed + ' rejected. ' + esc(data.hint || '') + '</div>';
        html += (data.failures || []).slice(0, 5).map(function(f) {
          return '<div style="font-size:11px;color:var(--text3)">' + esc(f.to) + ': ' + esc(f.error) + '</div>';
        }).join('');
      }
      if (out) out.innerHTML = html;
      if (btn) { btn.textContent = data.failed ? 'Sent with errors' : 'Sent'; setTimeout(function(){ btn.textContent = 'Send now'; btn.disabled = false; }, 3000); }
    }
    else {
      // Zero delivered. Lead with the diagnosis, not the raw API string.
      var msg = data.hint || data.error || 'Nothing was delivered.';
      if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral);padding:8px 0">' + esc(msg) + '</div>' +
        (data.failures || []).slice(0, 5).map(function(f) {
          return '<div style="font-size:11px;color:var(--text3)">' + esc(f.to) + ': ' + esc(f.error) + '</div>';
        }).join('');
      if (btn) { btn.textContent = 'Send now'; btn.disabled = false; }
      return;
    }
  } catch(e) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral);padding:8px 0">Error: ' + esc(e.message) + '</div>'; if (btn) { btn.textContent = 'Send now'; btn.disabled = false; } }
}
function showNudgeBanner(tasks) {
  const banner = document.getElementById('nudgeBanner'); const text = document.getElementById('nudgeText');
  if (!banner || !text) return;
  const hour = new Date().getHours(); const pending = (tasks||[]).filter(function(t){return !t.done;}).length;
  if (pending === 0 || hour < 9) { banner.style.display = 'none'; return; }
  let msg = '';
  if (hour >= 11 && hour < 13) msg = '⏰ Almost noon, ' + pending + ' task' + (pending>1?'s':'') + ' still open. Finish before 12 for max rhythm score.';
  else if (hour >= 16 && hour < 18) msg = '⏰ Last push, ' + pending + ' task' + (pending>1?'s':'') + ' to go. Complete before 6pm to stay on track.';
  if (msg) { text.textContent = msg; banner.style.display = 'block'; } else banner.style.display = 'none';
}

let execPeriod = 'today';
function setExecPeriod(period, btn) {
  execPeriod = period;
  document.querySelectorAll('#exec-period-today,#exec-period-wtd,#exec-period-mtd,#exec-period-custom').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  const cr = document.getElementById('execCustomRange'); if (cr) cr.style.display = period === 'custom' ? 'flex' : 'none';
  if (period !== 'custom') loadExecDashboard();
}
function getExecDateRange() {
  const today = todayKey();
  if (execPeriod==='today') return {from:today,to:today,label:'Today'};
  if (execPeriod==='wtd') { const d=new Date();const day=d.getDay();const monday=new Date(d);monday.setDate(d.getDate()-(day===0?6:day-1));return {from:monday.toISOString().split('T')[0],to:today,label:'Week to date'}; }
  if (execPeriod==='mtd') { const d=new Date();return {from:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01',to:today,label:'Month to date'}; }
  if (execPeriod==='custom') { const from=document.getElementById('execDateFrom')?.value||today;const to=document.getElementById('execDateTo')?.value||today;return {from,to,label:from+' → '+to}; }
  return {from:today,to:today,label:'Today'};
}
async function loadExecDashboard() {
  const container = document.getElementById('execDashboard'); if (!container||!currentUser?.token||!profile?.org_id) return;
  container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:13px">Loading org pulse…</div>';
  try {
    const members = await sbGet('user_profiles?org_id=eq.' + profile.org_id + '&is_active=not.is.false&select=user_id,email,role');
    if (!members?.length) { container.innerHTML = '<div style="padding:20px;color:var(--text3)">No team members found</div>'; return; }
    const reps = members.filter(function(m){return m.role==='member'||m.role==='sdr'||m.role==='ae'||m.role==='manager';});
    const {from:dateFrom,to:dateTo,label:dateLabel} = getExecDateRange();
    const repData = [];
    for (const rep of reps) {
      const dt = await sbGet('daytrack?user_id=eq.' + rep.user_id + '&day_key=gte.' + dateFrom + '&day_key=lte.' + dateTo + '&select=day_key,data&order=day_key.desc');
      const allTasks=[],allWins=[],allIssues=[];
      (dt||[]).forEach(function(row){
        var date = row.date || viewDate;
        (row.data?.tasks||[]).forEach(function(t){allTasks.push(t);});
        (row.data?.wins||[]).forEach(function(w){allWins.push(Object.assign({},w,{date:date}));});
        (row.data?.issues||[]).forEach(function(i){allIssues.push(i);});
      });
      const sc = calcDayScore(allTasks);
      repData.push({email:rep.email,role:rep.role,score:sc.score,completion:sc.completion,rhythm:sc.rhythm,tasks:allTasks.length,done:allTasks.filter(function(t){return t.done;}).length,pending:allTasks.filter(function(t){return !t.done;}).length,wins:allWins.length,winItems:allWins,issues:allIssues.length,gmailConnected:false});
    }
    const avgScore = repData.length?Math.round(repData.reduce(function(s,r){return s+r.score;},0)/repData.length):0;
    const totalTasks=repData.reduce(function(s,r){return s+r.tasks;},0);
    const totalDone=repData.reduce(function(s,r){return s+r.done;},0);
    const totalWins=repData.reduce(function(s,r){return s+r.wins;},0);
    const totalIssues=repData.reduce(function(s,r){return s+r.issues;},0);
    const orgCompletionRate=totalTasks?Math.round((totalDone/totalTasks)*100):0;
    const atRisk=repData.filter(function(r){return r.score<40&&r.tasks>0;});
    const noActivity=repData.filter(function(r){return r.tasks===0;});
    const col=scoreColor(avgScore);
    let html='<div style="margin-bottom:20px"><div style="font-family:var(--serif);font-size:20px;color:var(--text);margin-bottom:2px">SAMagic</div><div style="font-size:12px;color:var(--text3)">'+dateLabel+' · '+reps.length+' reps</div></div>';
    html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';
    [{label:'Org Score',value:avgScore,suffix:'',color:scoreColor(avgScore),sub:scoreLabel(avgScore)},{label:'Completion',value:orgCompletionRate,suffix:'%',color:orgCompletionRate>=70?'var(--green)':orgCompletionRate>=50?'var(--amber)':'var(--coral)',sub:totalDone+'/'+totalTasks+' tasks done'},{label:'Wins',value:totalWins,suffix:'',color:totalWins>0?'var(--green)':'var(--text3)',sub:totalWins>0?'Across team':'None logged yet'},{label:'Issues',value:totalIssues,suffix:'',color:totalIssues>0?'var(--coral)':'var(--text3)',sub:totalIssues>0?'Flagged today':'All clear'}].forEach(function(k){html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">'+k.label+'</div><div style="font-size:26px;font-weight:500;color:'+k.color+';line-height:1;margin-bottom:4px">'+k.value+k.suffix+'</div><div style="font-size:11px;color:var(--text3)">'+k.sub+'</div></div>';});
    html+='</div>';
    html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-bottom:12px"><div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">Team scores</div>';
    repData.slice().sort(function(a,b){return b.score-a.score;}).forEach(function(r){const bc=scoreColor(r.score);const w=r.tasks>0?r.score:0;html+='<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:12px;color:var(--text2)">'+esc(r.email.split('@')[0])+'</span><span style="font-size:12px;font-weight:600;color:'+bc+'">'+( r.tasks>0?r.score:'—')+'</span></div><div style="height:4px;background:var(--surface2);border-radius:var(--r-sm);overflow:hidden"><div style="height:100%;width:'+w+'%;background:'+bc+';border-radius:var(--r-sm);transition:width 0.5s"></div></div></div>';});
    html+='</div>';
    if (atRisk.length||noActivity.length||totalIssues>0) {
      html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-bottom:12px"><div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Priorities & Risks</div>';
      if (atRisk.length) { html+='<div style="border-left:3px solid var(--coral);padding:8px 12px;background:var(--coral-lt);border-radius:0 6px 6px 0;margin-bottom:8px"><div style="font-size:12px;font-weight:500;color:var(--coral);margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> Low score ('+atRisk.length+')</div>'+atRisk.map(function(r){return '<div style="font-size:12px;color:var(--text2)">'+esc(r.email.split('@')[0])+', score '+r.score+' · '+r.pending+' tasks pending</div>';}).join('')+'</div>'; }
      if (noActivity.length) { html+='<div style="border-left:3px solid var(--amber);padding:8px 12px;background:var(--amber-lt);border-radius:0 6px 6px 0;margin-bottom:8px"><div style="font-size:12px;font-weight:500;color:var(--amber)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> No tasks logged ('+noActivity.length+')</div>'+noActivity.map(function(r){return '<div style="font-size:12px;color:var(--text2)">'+esc(r.email.split('@')[0])+'</div>';}).join('')+'</div>'; }
      html+='</div>';
    }
    html+='<button onclick="loadExecDashboard()" style="font-size:11px;color:var(--gold);background:none;border:none;cursor:pointer;font-family:var(--sans);padding:0">↻ Refresh</button>';

    // ── Wins detail (with timestamps and completion notes) ─────────────────
    const allWinsFlat = repData.flatMap(function(r){return (r.winItems||[]).map(function(w){return Object.assign({},w,{repEmail:r.email});});});
    if (allWinsFlat.length) {
      html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-top:12px">' +
        '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.8l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 10l5.9-.8z"/></svg> Team wins today ('+allWinsFlat.length+')</div>';
      allWinsFlat.forEach(function(w) {
        var repName = w.repEmail ? w.repEmail.split('@')[0] : '';
        var displayText = w.text?.startsWith('*') ? w.text.slice(1).trim() : (w.text || '');
        var ts = w.completedAt || w.addedAt || '';
        var note = w.completionNote || '';
        html += '<div style="padding:10px 12px;background:var(--bg);border-radius:var(--r-sm);margin-bottom:6px;border-left:3px solid var(--green)">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +
            '<div style="flex:1">' +
              '<div style="font-size:13px;color:var(--text);font-weight:500">'+esc(displayText)+'</div>' +
              (note ? '<div style="font-size:12px;color:var(--text2);margin-top:4px;font-style:italic;background:var(--surface2);border-radius:var(--r-sm);padding:4px 8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg> '+esc(note)+'</div>' : '') +
            '</div>' +
            '<div style="text-align:right;flex-shrink:0">' +
              '<div style="font-size:11px;color:var(--green);font-weight:600">'+esc(repName)+'</div>' +
              (ts ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(ts)+'</div>' : '') +
            '</div>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-top:12px">' +
      '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> Org, relevant meetings booked</div>' +
      '<div id="meetingsKpiOrg">Loading…</div>' +
    '</div>';

    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-top:12px">' +
      '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Live feed, org-wide</div>' +
      '<div id="teamFeedList">Loading…</div>' +
    '</div>';

    container.innerHTML = html;
    loadTeamFeed('teamFeedList');
    loadMeetingsKpiOrg();
  } catch(e) { container.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--coral)">Error: ' + esc(e.message) + '</div>'; }
}

// ── Live feed (team_feed) — org-wide positive events with reactions ────────
// Two placements share this same renderer: the Exec tab's full "Live feed"
// section (loadExecDashboard above) and a compact widget on the Today tab
// (loadTodayFeedWidget). Same data, same react_to_feed action either way.
const FEED_EVENT_ICON = { deal_won: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M9.5 20h5M12 14v6"/></svg>', champion_confirmed: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 12l-3-3 4-4 3 2 3-2 4 4-3 3M8 12l3 3 2-2 3 3M8 12l-2.5 2.5"/></svg>', momentum_up: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>', milestone: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.8l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 10l5.9-.8z"/></svg>' };
const FEED_EMOJIS = ['👏', '🔥', '🎉'];
function _feedTimeAgo(iso) {
  var diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 60) return diffMin + 'm ago';
  var diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return diffHr + 'h ago';
  return Math.round(diffHr / 24) + 'd ago';
}
function _renderFeedEntries(entries) {
  if (!entries.length) return '<div style="font-size:12px;color:var(--text3);padding:8px 0">Nothing yet, wins and milestones will show up here as they happen.</div>';
  return entries.map(function(f) {
    var icon = FEED_EVENT_ICON[f.event_type] || '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>';
    var reactionChips = FEED_EMOJIS.map(function(e) {
      var count = (f.reactions && f.reactions[e]) || 0;
      var mine = f.my_reaction === e;
      return '<button onclick="reactToFeed(\'' + f.id + '\',\'' + e + '\')" style="border:1px solid ' + (mine ? 'var(--gold)' : 'var(--border)') + ';background:' + (mine ? 'rgba(184,134,11,0.12)' : 'var(--surface2)') + ';border-radius:var(--r-md);padding:2px 8px;font-size:11px;cursor:pointer;margin-right:4px">' + e + (count ? ' ' + count : '') + '</button>';
    }).join('');
    return '<div style="padding:10px 12px;background:var(--bg);border-radius:var(--r-sm);margin-bottom:8px;border-left:3px solid var(--gold)">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px">' +
        '<div style="font-size:13px;color:var(--text);font-weight:500">' + icon + ' ' + esc(f.title) + '</div>' +
        '<div style="font-size:11px;color:var(--text3);white-space:nowrap">' + _feedTimeAgo(f.created_at) + '</div>' +
      '</div>' +
      (f.body ? '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">' + esc(f.body) + '</div>' : '') +
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<span style="font-size:11px;color:var(--text3)">' + esc(f.actor_name) + '</span>' +
        '<div>' + reactionChips + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}
async function loadTeamFeed(targetElId, limit) {
  // The element may legitimately be absent: the Today screen shows the metric
  // without rendering the feed list, and the mobile layout drops the widget
  // entirely. Returning early here is why "Weekly team wins" sat on its
  // placeholder dash forever. Same mistake as the coaching alerts panel.
  // Fetch regardless, always set the metric, and only paint the list if there
  // is somewhere to paint it.
  var el = document.getElementById(targetElId);
  if (!currentUser?.token) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'list_team_feed', limit: limit || 30 }) });
    var d = await r.json();
    window._teamFeedTarget = targetElId;
    // Team wins metric. Counted from the same payload the widget renders, so
    // the number and the list can never disagree.
    try {
      if (d.ok && Array.isArray(d.feed)) {
        _naFeed = d.feed;
        // x/y: wins in the last 7 days over everything in the feed window,
        // so the headline number is this week and the denominator is the
        // context it sits in, rather than a bare count with no scale.
        var _wk = d.feed.filter(_isThisWeek).length;
        // "0/0" is a fact. The em dash was a placeholder that never got
        // replaced, and it read as "broken" rather than "nothing yet".
        _setMetric('mTeamWins', _wk, '<span class="unit">/' + d.feed.length + '</span>');
        if (_openDrill === 'wins') { _openDrill = null; toggleMetricDrill('wins'); }
      }
    } catch(_e) {}
    if (el) el.innerHTML = (d.ok && d.feed) ? _renderFeedEntries(d.feed) : '<div style="font-size:12px;color:var(--coral)">Could not load feed.</div>';
  } catch(e) { if (el) el.innerHTML = '<div style="font-size:12px;color:var(--coral)">Could not load feed.</div>'; }
}
let _teamFeedWidgetLoaded = false;
function toggleTeamFeedWidget() {
  var body = document.getElementById('teamFeedWidgetBody');
  var chev = document.getElementById('teamFeedWidgetChev');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (chev) chev.textContent = open ? '›' : '⌄';
  if (!open && !_teamFeedWidgetLoaded) { _teamFeedWidgetLoaded = true; loadTeamFeed('teamFeedWidget', 15); }
}
async function reactToFeed(feedId, emoji) {
  try {
    await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'react_to_feed', feed_id: feedId, emoji: emoji }) });
    if (window._teamFeedTarget) loadTeamFeed(window._teamFeedTarget);
  } catch(e) { showToast('Could not react'); }
}

// ── Meetings booked KPI — relevant meetings only (external attendee, tied
// to a real account, not an existing won customer). Self view computes live
// from the rep's own calendar (and caches it for manager/exec rollups);
// team view just reads that cache. Period toggle re-fetches self, just
// re-slices the same cached list for team (cheap, no new calendar calls).
function _renderMeetingsReceipts(meetings, limit) {
  var list = (meetings || []).slice(0, limit || 8);
  if (!list.length) return '<div style="font-size:11px;color:var(--text3);padding:4px 0">No qualifying meetings in this window.</div>';
  return list.map(function(m){
    return '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);padding:3px 0;border-bottom:1px solid var(--border)">' +
      '<span>' + esc(m.account_name) + ', ' + esc(m.title||'').slice(0,40) + '</span><span>' + esc(m.date) + '</span></div>';
  }).join('');
}
let _repMeetCache = {};
async function toggleRepMeetings(userId, days, elId) {
  var el = document.getElementById(elId); if (!el || !currentUser?.token) return;
  var isOpen = el.getAttribute('data-open') === '1';
  if (isOpen) { el.style.display = 'none'; el.setAttribute('data-open','0'); return; }
  el.style.display = ''; el.setAttribute('data-open','1');
  var cacheKey = userId + '_' + days;
  if (_repMeetCache[cacheKey]) { el.innerHTML = _repMeetCache[cacheKey]; return; }
  el.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:4px 0">Loading…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_rep_meetings_detail', user_id: userId, days: days }) });
    var d = await r.json();
    var html = d.ok ? _renderMeetingsReceipts(d.meetings, 20) : '<div style="font-size:11px;color:var(--coral)">' + esc(d.error||'Could not load.') + '</div>';
    _repMeetCache[cacheKey] = html;
    el.innerHTML = html;
  } catch(e) { el.innerHTML = '<div style="font-size:11px;color:var(--coral)">Could not load.</div>'; }
}
let _meetingsKpiSelfDays = 30;
async function loadMeetingsKpiSelf(days) {
  var el = document.getElementById('meetingsKpiSelf'); if (!el || !currentUser?.token) return;
  if (days) _meetingsKpiSelfDays = days;
  el.innerHTML = '<div style="font-size:12px;color:var(--text3)">Loading meetings booked…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_meetings_kpi', days: _meetingsKpiSelfDays }) });
    var d = await r.json();
    if (!d.ok) { el.innerHTML = d.connected === false ? '<div style="font-size:12px;color:var(--text3)">Connect email to track meetings booked.</div>' : '<div style="font-size:12px;color:var(--coral)">Could not load.</div>'; return; }
    var periodBtns = [7,30,90].map(function(p){
      var active = p === _meetingsKpiSelfDays;
      return '<button onclick="loadMeetingsKpiSelf(' + p + ')" style="padding:3px 10px;border-radius:var(--r-md);border:1px solid ' + (active?'var(--gold)':'var(--border)') + ';background:' + (active?'rgba(184,134,11,0.12)':'var(--surface2)') + ';color:var(--text2);font-size:11px;cursor:pointer;margin-left:4px">' + p + 'd</button>';
    }).join('');
    var list = _renderMeetingsReceipts(d.meetings, 8);
    el.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius-lg);padding:14px 16px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> Relevant meetings booked</div>' +
        '<div>' + periodBtns + '</div>' +
      '</div>' +
      '<div style="font-size:26px;font-weight:700;color:var(--gold);margin-bottom:4px">' + (d.count||0) + '</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Last ' + _meetingsKpiSelfDays + ' days · external attendee, tied to a real account, not an existing customer</div>' +
      list +
    '</div>';
  } catch(e) { el.innerHTML = '<div style="font-size:12px;color:var(--coral)">Could not load meetings booked.</div>'; }
}
let _meetingsKpiTeamDays = 30;
async function loadMeetingsKpiTeam(days) {
  var el = document.getElementById('meetingsKpiTeam'); if (!el || !currentUser?.token) return;
  if (days) _meetingsKpiTeamDays = days;
  el.innerHTML = '<div style="font-size:12px;color:var(--text3)">Loading team meetings booked…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_team_meetings_kpi', scope:'team', days: _meetingsKpiTeamDays }) });
    var d = await r.json();
    if (!d.ok) { el.innerHTML = ''; return; }
    var periodBtns = [7,30,90].map(function(p){
      var active = p === _meetingsKpiTeamDays;
      return '<button onclick="loadMeetingsKpiTeam(' + p + ')" style="padding:3px 10px;border-radius:var(--r-md);border:1px solid ' + (active?'var(--gold)':'var(--border)') + ';background:' + (active?'rgba(184,134,11,0.12)':'var(--surface2)') + ';color:var(--text2);font-size:11px;cursor:pointer;margin-left:4px">' + p + 'd</button>';
    }).join('');
    var rows = (d.byRep||[]).map(function(r2){
      var rid = 'repMeet_team_' + r2.user_id;
      return '<div>' +
        '<div onclick="toggleRepMeetings(\'' + r2.user_id + '\',' + _meetingsKpiTeamDays + ',\'' + rid + '\')" style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);padding:5px 0;border-bottom:1px solid var(--border);cursor:pointer">' +
          '<span>' + esc(r2.name||r2.email||'—') + (r2.stale ? ' <span style="color:var(--text3);font-size:11px">(not synced yet)</span>' : '') + ' <span style="color:var(--text3);font-size:11px">▾ view meetings</span></span>' +
          '<span style="font-weight:600;color:var(--text)">' + r2.count + '</span></div>' +
        '<div id="' + rid + '" style="display:none;padding-left:8px" data-open="0"></div>' +
      '</div>';
    }).join('');
    el.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius-lg);padding:14px 16px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> Team, relevant meetings booked</div>' +
        '<div>' + periodBtns + '</div>' +
      '</div>' +
      '<div style="font-size:26px;font-weight:700;color:var(--gold);margin-bottom:8px">' + (d.total||0) + '</div>' +
      (rows || '<div style="font-size:11px;color:var(--text3)">No direct reports found.</div>') +
    '</div>';
  } catch(e) { el.innerHTML = ''; }
}
async function loadMeetingsKpiOrg() {
  var el = document.getElementById('meetingsKpiOrg'); if (!el || !currentUser?.token) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_team_meetings_kpi', scope:'org', days: 30 }) });
    var d = await r.json();
    if (!d.ok) { el.innerHTML = '<div style="font-size:12px;color:var(--text3)">Not available.</div>'; return; }
    var rows = (d.byRep||[]).sort(function(a,b){return b.count-a.count;}).slice(0,10).map(function(r2){
      var rid = 'repMeet_org_' + r2.user_id;
      return '<div>' +
        '<div onclick="toggleRepMeetings(\'' + r2.user_id + '\',30,\'' + rid + '\')" style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);padding:5px 0;border-bottom:1px solid var(--border);cursor:pointer">' +
          '<span>' + esc(r2.name||r2.email||'—') + ' <span style="color:var(--text3);font-size:11px">▾ view meetings</span></span><span style="font-weight:600;color:var(--text)">' + r2.count + '</span></div>' +
        '<div id="' + rid + '" style="display:none;padding-left:8px" data-open="0"></div>' +
      '</div>';
    }).join('');
    el.innerHTML = '<div style="font-size:26px;font-weight:700;color:var(--gold);margin-bottom:4px">' + (d.total||0) + '</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Last 30 days, org-wide · external attendee, tied to a real account, not an existing customer</div>' +
      (rows || '<div style="font-size:11px;color:var(--text3)">No data yet.</div>');
  } catch(e) { el.innerHTML = '<div style="font-size:12px;color:var(--coral)">Could not load.</div>'; }
}

let orgPeople = [];
// ── Admin: Team & access ───────────────────────────────────────────────
// The console (SamoraAccessConsole, bottom of this file) talks only to the
// org_admin_* edge actions, which return people, reporting lines, shares,
// seats and the activity log, and nothing about how SamoraOS scores or
// targets. The old People table and Manager teams card are replaced by it.
async function _sxaCall(action, body) {
  const r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify(Object.assign({ action: action }, body || {})) });
  return r.json().catch(() => ({ ok: false, error: 'HTTP ' + r.status }));
}
async function _refreshOrgPeopleForAccounts() {
  try {
    orgPeople = await sbGet(`user_profiles?org_id=eq.${profile.org_id}&is_active=not.is.false&select=user_id,email,role,manager_id`);
    const accountRepSel = document.getElementById('accountRepSelect');
    if (accountRepSel) accountRepSel.innerHTML = '<option value="">Select a rep…</option>' + orgPeople.map(p => '<option value="' + p.user_id + '">' + esc(p.email) + '</option>').join('');
  } catch (_e) { /* the console above reports its own errors */ }
}
async function renderOrg() {
  if (!SB_URL || !_isOrgAdmin()) return;
  const mount = document.getElementById('sxaMount');
  if (mount && window.SamoraAccessConsole) {
    if (window._sxaConsole && window._sxaConsole.el === mount) window._sxaConsole.load();
    else window._sxaConsole = window.SamoraAccessConsole.mount(mount, {
      call: _sxaCall, onChange: _refreshOrgPeopleForAccounts,
      // Rep Accounts used to sit under the console on every tab. It is now a
      // tab of its own; the block and its handlers are reused as they are.
      extraTabs: [{ key: 'accounts', label: 'Accounts', hostId: 'accountsSection', onShow: _refreshOrgPeopleForAccounts },
        // Drop Q: the org-wide provider keys (ZoomInfo included) and the
        // Intelligence settings, hosted here so admins can reach them.
        { key: 'providers', label: 'Data providers', hostId: 'enrichmentAdminSection', onShow: function () { try { loadEnrichmentStatus(); } catch (e) {} } },
        { key: 'intel', label: 'Intelligence', hostId: 'samIntelAdminSection', onShow: function () { if (typeof samIntelAdminLoad === 'function') samIntelAdminLoad(); } }]
    });
  }
  await _refreshOrgPeopleForAccounts();
}
function renderPeopleTable() {
  if (!orgPeople?.length) { document.getElementById('peopleList').innerHTML = '<div class="empty">No members yet.</div>'; return; }
  const rows = orgPeople.map(p => {
    const roleOpts = ['sdr','ae','manager','director','executive','admin'].map(r => `<option value="${r}" ${p.role===r?'selected':''}>${{sdr:'SDR',ae:'AE',manager:'Manager',director:'Director',executive:'Executive',admin:'Admin'}[r]||r}</option>`).join('');
    return `<tr><td>${esc(p.email)}</td><td><select class="role-select" onchange="updateRole('${p.user_id}', this.value)">${roleOpts}</select></td></tr>`;
  }).join('');
  document.getElementById('peopleList').innerHTML = `<table class="people-table"><thead><tr><th>Email</th><th>Role</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function renderAssignCard() {
  const seniorRoles = ['manager','director','executive','admin','super_admin'];
  const managers = orgPeople.filter(p => seniorRoles.includes(p.role));
  const reportees = orgPeople.filter(p => p.role==='member'||p.role==='sdr'||p.role==='ae'||p.role==='manager');
  if (!managers.length) { document.getElementById('assignCard').innerHTML = '<div class="m-empty">No senior members yet. Assign a Manager, Director or Executive role first.</div>'; return; }
  const html = managers.map(mgr => {
    const mgrMembers = reportees.filter(m => m.manager_id === mgr.user_id);
    const unassigned = reportees.filter(m => !m.manager_id || m.manager_id !== mgr.user_id);
    return `<div style="margin-bottom:16px"><div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:8px">${esc(mgr.email)}</div><div style="font-size:12px;color:var(--text3);margin-bottom:6px">Current team: ${mgrMembers.length?mgrMembers.map(m=>`<span style="color:var(--green)">${esc(m.email)}</span>`).join(', '):'none'}</div><select class="role-select" style="width:100%;padding:8px;font-size:13px" onchange="assignToManager('${mgr.user_id}', this.value); this.value=''"><option value="">+ Assign a member…</option>${unassigned.map(m=>`<option value="${m.user_id}">${esc(m.email)}</option>`).join('')}</select></div>`;
  }).join('');
  document.getElementById('assignCard').innerHTML = html;
}
// Both go through the edge function (org_update_member), which checks the
// caller is an admin of the same org. The browser can no longer write
// user_profiles directly: that permission is what let anyone set their own role.
async function _orgUpdateMember(body) {
  const r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify(Object.assign({ action: 'org_update_member' }, body)) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) throw new Error(d.error || ('HTTP ' + r.status));
}
async function updateRole(userId, newRole) { if (!SB_URL) return; try { await _orgUpdateMember({ user_id: userId, role: newRole }); await renderOrg(); } catch(e) { alert('Could not change the role: ' + e.message); await renderOrg(); } }
async function assignToManager(managerId, memberId) { if (!memberId || !SB_URL) return; try { await _orgUpdateMember({ user_id: memberId, manager_id: managerId }); await renderOrg(); } catch(e) { alert('Could not assign: ' + e.message); } }

async function loadRepAccounts() {
  const repId = document.getElementById('accountRepSelect')?.value; const list = document.getElementById('repAccountsList'); const addRow = document.getElementById('addAccountRow');
  if (!repId) { if (list) list.innerHTML = ''; if (addRow) addRow.style.display = 'none'; return; }
  if (addRow) addRow.style.display = 'flex';
  if (list) list.innerHTML = '<div style="font-size:12px;color:var(--text3)">Loading…</div>';
  try {
    const rows = await sbGet('org_accounts?user_id=eq.' + repId + '&org_id=eq.' + profile.org_id + '&select=id,account_name,domain&order=account_name');
    if (!rows || !rows.length) { list.innerHTML = '<div style="font-size:12px;color:var(--text3);font-style:italic">No accounts assigned yet</div>'; return; }
    list.innerHTML = rows.map(r => '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--surface2);border-radius:var(--r-sm);margin-bottom:5px"><div><div style="font-size:13px;color:var(--text)">' + esc(r.account_name) + '</div>' + (r.domain?'<div style="font-size:11px;color:var(--text3)">'+esc(r.domain)+'</div>':'') + '</div><button onclick="removeRepAccount(\''+r.id+'\')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>').join('');
  } catch(e) { list.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: ' + esc(e.message) + '</div>'; }
}
var _accountNameTimer = null;
async function onAccountNameInput(val) {
  // Debounce — wait for the rep to pause typing before searching
  clearTimeout(_accountNameTimer);
  const suggestion = document.getElementById('parentMatchSuggestion');
  if (!val || val.length < 3) { if (suggestion) suggestion.style.display = 'none'; return; }
  _accountNameTimer = setTimeout(async function() {
    try {
      // Search for existing accounts in this org whose name contains the typed string
      const r = await fetch(SB_URL + '/rest/v1/org_accounts?org_id=eq.' + profile.org_id + '&account_name=ilike.' + encodeURIComponent('%' + val + '%') + '&select=id,account_name,region,parent_account_id&limit=5', {
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token }
      });
      const matches = await r.json();
      if (!Array.isArray(matches) || !matches.length) { suggestion.style.display = 'none'; return; }

      // Find parent candidates — rows that are either already a parent (region='Global' or has children)
      // or standalone rows with the same or very similar name
      const exactOrParent = matches.filter(function(m) {
        return m.account_name.toLowerCase() === val.toLowerCase() ||
               m.account_name.toLowerCase().replace(/\s+(global|worldwide)$/i,'').trim() === val.toLowerCase().trim();
      });

      if (!exactOrParent.length) { suggestion.style.display = 'none'; return; }

      const parent = exactOrParent[0];
      const existingBranches = matches.filter(function(m) { return m.parent_account_id === parent.id || m.id === parent.id; });
      const branchList = existingBranches.filter(function(m) { return m.region && m.region !== 'Global'; }).map(function(m) { return m.region; }).join(' · ');

      document.getElementById('parentMatchText').textContent =
        '"' + parent.account_name + '" already exists' + (branchList ? ', existing branches: ' + branchList : '') + '. Add as branch?';
      document.getElementById('parentMatchActions').innerHTML =
        '<button onclick="setParentMatch(\'' + parent.id + '\',\'' + parent.account_name.replace(/'/g,"\\'") + '\')" style="padding:3px 10px;border-radius:var(--r-md);background:var(--gold2);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer;margin-right:6px">Yes, add as branch</button>' +
        '<button onclick="clearParentMatch()" style="padding:3px 10px;border-radius:var(--r-md);background:transparent;border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:11px;cursor:pointer">No, standalone</button>';
      suggestion.style.display = 'block';
    } catch(e) { /* non-fatal — just don't show suggestion */ }
  }, 400);
}
function setParentMatch(parentId, parentName) {
  document.getElementById('newAccountParentId').value = parentId;
  document.getElementById('parentMatchSuggestion').style.display = 'none';
  // Pre-fill region field focus prompt
  const regionInput = document.getElementById('newAccountRegion');
  if (regionInput && !regionInput.value) { regionInput.focus(); }
}
function clearParentMatch() {
  document.getElementById('newAccountParentId').value = '';
  document.getElementById('parentMatchSuggestion').style.display = 'none';
}

async function addRepAccount() {
  const repId = document.getElementById('accountRepSelect')?.value;
  const name = document.getElementById('newAccountName')?.value?.trim();
  const region = document.getElementById('newAccountRegion')?.value?.trim() || null;
  const domain = document.getElementById('newAccountDomain')?.value?.trim() || null;
  const parentId = document.getElementById('newAccountParentId')?.value?.trim() || null;
  if (!repId || !name) { alert('Select a rep and enter account name'); return; }

  // If a region was typed but no parent was explicitly selected, do one more
  // check — find any existing standalone account with the same base name and
  // link to it automatically. This catches the case where the rep skips the
  // suggestion prompt but types "Ferrero" + region "India".
  let resolvedParentId = parentId;
  if (!resolvedParentId && region) {
    try {
      const pr = await fetch(SB_URL + '/rest/v1/org_accounts?org_id=eq.' + profile.org_id + '&account_name=eq.' + encodeURIComponent(name) + '&select=id&limit=1', {
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token }
      });
      const existing = await pr.json();
      if (Array.isArray(existing) && existing.length) resolvedParentId = existing[0].id;
    } catch(e) { /* non-fatal */ }
  }

  try {
    const body = { org_id: profile.org_id, user_id: repId, account_name: name, domain, added_by: currentUser.id };
    if (region) body.region = region;
    if (resolvedParentId) body.parent_account_id = resolvedParentId;

    const r = await fetch(SB_URL + '/rest/v1/org_accounts', {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(await r.text());
    document.getElementById('newAccountName').value = '';
    document.getElementById('newAccountRegion').value = '';
    document.getElementById('newAccountDomain').value = '';
    document.getElementById('newAccountParentId').value = '';
    document.getElementById('parentMatchSuggestion').style.display = 'none';
    loadRepAccounts();
  } catch(e) {
    if (e.message.includes('duplicate') || e.message.includes('unique')) alert(name + ' is already assigned to this rep');
    else alert('Error: ' + e.message);
  }
}
async function removeRepAccount(id) {
  if (!confirm('Remove this account?')) return;
  try { await fetch(SB_URL + '/rest/v1/org_accounts?id=eq.' + id, { method: 'DELETE', headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token } }); loadRepAccounts(); }
  catch(e) { alert('Error: ' + e.message); }
}
function copyOrgCode() { const code = profile?.org_code || ''; navigator.clipboard?.writeText(code).then(() => alert('Copied: ' + code)).catch(() => alert('Your org code: ' + code)); }

function renderSettings() {
  // Org-wide notification rules and enrichment keys are for admins. Health
  // score weights are Samora's (2 Oct), so that card never shows here; the
  // server refuses the write anyway.
  var _adm = _isOrgAdmin();
  ['notifRulesAdminSection', 'enrichmentAdminSection', 'samIntelAdminSection'].forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = _adm ? '' : 'none'; });
  if (_adm && currentUser?.token && typeof samIntelAdminLoad === 'function') samIntelAdminLoad();
  var _hw = document.getElementById('healthWeightsSection'); if (_hw) _hw.style.display = 'none';
 document.getElementById('apiBadge').textContent = API_KEY ? 'set' : 'not set';
  document.getElementById('apiBadge').className = API_KEY ? 'badge-ok' : 'badge-no';
 document.getElementById('supaBadge').textContent = (SB_URL && SB_KEY) ? 'connected' : 'not set';
  document.getElementById('supaBadge').className = (SB_URL && SB_KEY) ? 'badge-ok' : 'badge-no';
  if (API_KEY) document.getElementById('apiInput').placeholder = '••••• (saved, paste to update)';
  if (SB_URL) document.getElementById('supaUrl').value = SB_URL;
}
function saveApiKey() { const v = document.getElementById('apiInput').value.trim(); if (!v) return; API_KEY = v; localStorage.setItem('dt-api-key', v); document.getElementById('apiInput').value = ''; renderSettings(); alert('API key saved!'); }
async function saveSupabase() {
  const url = document.getElementById('supaUrl').value.trim().replace(/\/$/,''); const key = document.getElementById('supaKey').value.trim();
  if (!url || !key) { showSS('Enter both URL and anon key.', false); return; }
  SB_URL = url; SB_KEY = key; localStorage.setItem('dt-sb-url', url); localStorage.setItem('dt-sb-key', key);
  EDGE_FN_URL = SB_URL + '/functions/v1/sam-gmail-signals'; // keep in sync with whichever project is now configured
 try { await fetch(url + '/rest/v1/daytrack?limit=1', { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }); showSS('Connected! Syncing…', true); renderSettings(); await syncDown(); runCarryOver(); render(); showSS('All synced', true); }
  catch(e) { showSS('Could not connect: ' + e.message, false); }
}
function showSS(msg, ok) { const el = document.getElementById('syncStatus'); el.textContent = msg; el.className = 'sstatus ' + (ok?'ok':'err'); }
function clearToday() { if (!confirm('Clear all data for this day?')) return; allData[viewDate]={tasks:[],issues:[],wins:[],misses:[]}; save(viewDate); render(); }

let reviewPeriod = 'daily';
function setReviewPeriod(period) {
  reviewPeriod = period;
  document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
  document.getElementById('rtab-' + period).classList.add('active');
  const labels = { daily: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> Daily review', weekly: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> Weekly review', monthly: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> Monthly review' };
  document.getElementById('reviewLabel').innerHTML = labels[period];
  document.getElementById('aiBody').textContent = 'Hit Refresh for Claude\'s ' + period + ' review.';
  document.getElementById('aiHints').style.display = 'none';
}
function getPeriodData() {
  const today = new Date(); let days = [];
  if (reviewPeriod === 'daily') { days = [viewDate]; }
  else if (reviewPeriod === 'weekly') { for (let i = 6; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate()-i); days.push(dateKey(d)); } }
  else { for (let i = 29; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate()-i); days.push(dateKey(d)); } }
  let totalTasks=0,doneTasks=0,totalIssues=0,totalWins=0,totalMisses=0,taskTexts=[],issueTexts=[],winTexts=[];
  days.forEach(k => { const d = allData[k]; if (!d) return; totalTasks+=d.tasks?.length||0; doneTasks+=d.tasks?.filter(t=>t.done).length||0; totalIssues+=d.issues?.length||0; totalWins+=d.wins?.filter(w=>!w.fromTask).length||0; totalMisses+=d.misses?.length||0; if (d.tasks?.length) taskTexts.push(...d.tasks.slice(0,3).map(t=>t.text+(t.done?' <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>':''))); if (d.issues?.length) issueTexts.push(...d.issues.slice(0,2).map(i=>i.text)); if (d.wins?.length) winTexts.push(...d.wins.filter(w=>!w.fromTask).slice(0,2).map(w=>w.text)); });
  return {days,totalTasks,doneTasks,totalIssues,totalWins,totalMisses,taskTexts,issueTexts,winTexts};
}
async function runReview() {
  const body = document.getElementById('aiBody');
  const d = dayData(viewDate); const total = d.tasks.length, done = d.tasks.filter(t=>t.done).length;
  renderSummary();
  const pd = getPeriodData(); const pct = pd.totalTasks ? Math.round(pd.doneTasks/pd.totalTasks*100) : 0;
  const periodLabel = reviewPeriod==='daily' ? fmtDate(viewDate) : reviewPeriod==='weekly' ? 'this week' : 'this month';
  const fallback = `<strong>${reviewPeriod.charAt(0).toUpperCase()+reviewPeriod.slice(1)} summary, ${periodLabel}</strong><br><br><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> ${pd.totalTasks} tasks, ${pd.doneTasks} done (${pct}%)<br><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> ${pd.totalIssues} issues<br><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.8l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 10l5.9-.8z"/></svg> ${pd.totalWins} wins<br>○ ${pd.totalMisses} misses`;
  if (!API_KEY) { body.innerHTML = fallback + '<br><br><em style="color:var(--text3)">Add your Anthropic key in Settings for AI insights.</em>'; return; }
  if (!pd.totalTasks && !pd.totalIssues && !pd.totalWins) { body.textContent = 'Nothing logged for this period yet.'; return; }
  body.innerHTML = '<div class="ldots"><span></span><span></span><span></span></div>';
  document.getElementById('aiHints').style.display = 'none';
  const myRole = profile?.role || 'member'; const isSDRRole = myRole === 'sdr';
  const roleContext = isSDRRole ? 'This person is an SDR. Focus on coverage, outreach, connections, meetings booked.' : 'This person is an AE. Focus on deal quality, pipeline progression, proposals, closings.';
  let prompt;
  if (reviewPeriod === 'daily') {
    const pList = d.tasks.map(t=>`- ${t.text} (${t.done?'done':'pending'})`).join('\n')||'None';
    const iList = d.issues.map(i=>`- ${i.text}`).join('\n')||'None';
    const aList = d.wins.filter(w=>!w.fromTask).map(a=>`- ${a.text}`).join('\n')||'None';
    prompt = viewDate > todayKey() ? `Tasks planned for ${viewDate}:\n${pList}\n\nGive a short encouraging planning note in 2-3 sentences.` : `You are a warm productivity coach. ${roleContext}\n\nReview this day (${viewDate}) in 3 short flowing paragraphs, no bullets, under 110 words.\n\nTasks (${done}/${total}):\n${pList}\nIssues:\n${iList}\nExtra wins:\n${aList}`;
  } else {
    prompt = `You are a strategic productivity coach. ${roleContext}\n\nGive a ${reviewPeriod} performance review.\n\nStats: ${pd.totalTasks} tasks, ${pd.doneTasks} done (${pct}%), ${pd.totalIssues} issues, ${pd.totalWins} wins, ${pd.totalMisses} misses.\n\n4 short paragraphs: (1) overall, (2) patterns, (3) what went well, (4) 2-3 recommendations. Under 180 words. No bullets.`;
  }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{'Content-Type':'application/json','x-api-key':API_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}, body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:reviewPeriod==='daily'?300:500,messages:[{role:'user',content:prompt}]}) });
    const data = await r.json();
    if (data.error) { body.innerHTML = fallback + `<br><br><em style="color:var(--coral)">${data.error.message}</em>`; return; }
    body.textContent = data.content?.[0]?.text || 'No response.';
    document.getElementById('aiHints').style.display = 'flex';
  } catch(e) { body.innerHTML = fallback + `<br><br><em style="color:var(--text3)">AI unavailable: ${e.message}</em>`; }
}
async function askQ(q) {
  if (!API_KEY) return;
  const body = document.getElementById('aiBody');
  body.innerHTML = '<div class="ldots"><span></span><span></span><span></span></div>';
  document.getElementById('aiHints').style.display = 'none';
  const d = dayData(viewDate);
  const ctx = `Tasks: ${d.tasks.map(t=>t.text+(t.done?' (done)':'')).join(', ')||'none'}. Issues: ${d.issues.map(i=>i.text).join(', ')||'none'}.`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type':'application/json','x-api-key':API_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' }, body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:200, messages:[{role:'user',content:`Context: ${ctx}\nQuestion: ${q}\nAnswer in 2-3 sentences, warm and practical.`}] }) });
    const data = await r.json(); body.textContent = data.content?.[0]?.text || 'No response.';
    document.getElementById('aiHints').style.display = 'flex';
  } catch(e) { body.textContent = 'Could not reach the API.'; }
}
// ═══════════════════════════════════════════════════════════════════════════
// APPEARANCE — theme + interface scale.
//
// dt-theme is 'light' | 'dark' | 'auto'. Existing installs hold 'light' or
// 'dark' already, so their behaviour is unchanged; 'auto' is opt-in.
//
// FONT SIZE, and why it scales the whole interface rather than only text:
// this file sets sizes inline as pixels (font-size:11px and so on) in
// hundreds of places, so changing a root font-size or a CSS variable would
// move almost nothing. Restyling every one of those to rem would be a large,
// risky sweep with plenty of chances to break a layout. CSS `zoom` on the
// root element scales type, padding and controls together, which keeps
// spacing proportional instead of leaving big text crammed into small boxes.
// It is applied to documentElement rather than body so that position:fixed
// overlays (the SAMpaign detail sheet, modals, the toast) scale with
// everything else instead of being measured against a zoomed ancestor.
const APPR_SCALES = [
  { key: 'small',   value: 0.9,  label: 'Small',   px: 13 },
  { key: 'default', value: 1,    label: 'Default', px: 16 },
  { key: 'large',   value: 1.15, label: 'Large',   px: 20 }
];

function getAppearance() {
  const t = localStorage.getItem('dt-theme');
  return {
    theme: (t === 'light' || t === 'dark' || t === 'auto') ? t : 'light',
    scale: parseFloat(localStorage.getItem('dt-font-scale') || '1') || 1
  };
}
function appearanceIsDark(a) {
  a = a || getAppearance();
  return a.theme === 'dark' || (a.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
function applyAppearance() {
  const a = getAppearance();
  const dark = appearanceIsDark(a);
  document.body.classList.toggle('dark-mode', dark);
  document.body.classList.toggle('light-mode', !dark);
  // data-theme is what the brand token roles key off.
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  // Empty string rather than '1' so the property is removed entirely at
  // default scale, leaving zero chance of it interfering with anything.
  document.documentElement.style.zoom = (a.scale === 1) ? '' : String(a.scale);
  renderAppearancePanel();
}
function setAppearanceTheme(mode) {
  localStorage.setItem('dt-theme', mode);
  applyAppearance();
}
function setAppearanceAuto(on) {
  if (on) localStorage.setItem('dt-theme', 'auto');
  // Turning auto OFF keeps whatever is on screen right now, rather than
  // snapping to a default the person did not choose.
  else localStorage.setItem('dt-theme', appearanceIsDark() ? 'dark' : 'light');
  applyAppearance();
}
function setAppearanceScale(v) {
  localStorage.setItem('dt-font-scale', String(v));
  applyAppearance();
 showToast('Interface size updated');
}

// Miniature of the app, so the choice is shown rather than described.
function _apprPreview(dark) {
  const bg    = dark ? '#131417' : '#FAF7F2';
  const card  = dark ? '#1D1F24' : '#FFFFFF';
  const line  = dark ? '#2C2F36' : '#E8E2D8';
  const text  = dark ? '#E8E4DE' : '#2A2620';
  const muted = dark ? '#6E7178' : '#B8B0A4';
  return '<svg viewBox="0 0 84 116" style="width:100%;max-width:84px;height:auto;display:block;margin:0 auto;border-radius:var(--r-sm)">' +
    '<rect width="84" height="116" rx="8" fill="'+bg+'"/>' +
    '<rect x="7" y="8" width="30" height="4" rx="2" fill="'+text+'"/>' +
    '<circle cx="74" cy="10" r="4" fill="#C8961E"/>' +
    '<rect x="7" y="18" width="70" height="26" rx="5" fill="'+card+'" stroke="'+line+'"/>' +
    '<rect x="12" y="23" width="26" height="4" rx="2" fill="'+muted+'"/>' +
    '<rect x="12" y="31" width="40" height="6" rx="3" fill="#C8961E"/>' +
    '<rect x="7" y="49" width="70" height="20" rx="5" fill="'+card+'" stroke="'+line+'"/>' +
    '<rect x="12" y="55" width="34" height="3" rx="1.5" fill="'+text+'"/>' +
    '<rect x="12" y="61" width="22" height="3" rx="1.5" fill="'+muted+'"/>' +
    '<rect x="7" y="74" width="70" height="20" rx="5" fill="'+card+'" stroke="'+line+'"/>' +
    '<rect x="12" y="80" width="40" height="3" rx="1.5" fill="'+text+'"/>' +
    '<rect x="12" y="86" width="18" height="3" rx="1.5" fill="'+muted+'"/>' +
    '<rect x="7" y="101" width="70" height="9" rx="4" fill="'+card+'" stroke="'+line+'"/>' +
    '<circle cx="19" cy="105.5" r="2" fill="#C8961E"/><circle cx="34" cy="105.5" r="2" fill="'+muted+'"/>' +
    '<circle cx="49" cy="105.5" r="2" fill="'+muted+'"/><circle cx="64" cy="105.5" r="2" fill="'+muted+'"/>' +
  '</svg>';
}

function renderAppearancePanel() {
  const a = getAppearance();
  const dark = appearanceIsDark(a);
  const auto = a.theme === 'auto';
  // On auto, neither card is "chosen" — the device is choosing. Marking one
  // as selected would misrepresent who is in control, so the active one is
  // only outlined faintly and labelled.
  const cardStyle = (isDarkCard) => {
    const on = auto ? false : (isDarkCard === dark);
    const following = auto && (isDarkCard === dark);
    return 'flex:1;cursor:pointer;border-radius:var(--r-md);padding:10px;text-align:center;' +
      'border:2px solid ' + (on ? 'var(--gold)' : (following ? 'rgba(var(--c-accent-rgb),0.35)' : 'var(--border2)')) + ';' +
      'background:' + (on ? 'rgba(var(--c-accent-rgb),0.08)' : 'transparent') + ';';
  };
  const lightEl = document.getElementById('apprCardLight');
  const darkEl  = document.getElementById('apprCardDark');
  if (lightEl) {
    lightEl.setAttribute('style', cardStyle(false));
    lightEl.innerHTML = _apprPreview(false) +
      '<div style="font-size:12px;font-weight:600;color:var(--text);margin-top:7px">Light</div>' +
      (auto && !dark ? '<div style="font-size:11px;color:var(--text3)">following device</div>' : '');
  }
  if (darkEl) {
    darkEl.setAttribute('style', cardStyle(true));
    darkEl.innerHTML = _apprPreview(true) +
      '<div style="font-size:12px;font-weight:600;color:var(--text);margin-top:7px">Dark</div>' +
      (auto && dark ? '<div style="font-size:11px;color:var(--text3)">following device</div>' : '');
  }
  const tog = document.getElementById('apprAutoToggle');
  if (tog) tog.checked = auto;

  const row = document.getElementById('apprFontRow');
  if (row) {
    row.innerHTML = APPR_SCALES.map(function(s) {
      const on = Math.abs(a.scale - s.value) < 0.001;
      return '<div onclick="setAppearanceScale('+s.value+')" style="flex:1;cursor:pointer;text-align:center;padding:14px 6px;border-radius:var(--r-md);' +
        'border:2px solid '+(on?'var(--gold)':'var(--border2)')+';background:'+(on?'rgba(var(--c-accent-rgb),0.08)':'transparent')+'">' +
        '<div style="font-size:'+s.px+'px;font-weight:600;color:var(--text);line-height:1">Aa</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:7px">'+s.label+'</div>' +
      '</div>';
    }).join('');
  }
}

function initTheme() {
  applyAppearance();
  // Only meaningful on 'auto', but harmless otherwise — applyAppearance
  // re-reads the preference each time and ignores the device unless asked to.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
    if (getAppearance().theme === 'auto') applyAppearance();
  });
}
// Kept for any older call site: flips between explicit light and dark.
function toggleTheme() { setAppearanceTheme(appearanceIsDark() ? 'light' : 'dark'); }
function updateThemeIcon(mode) { const btn = document.getElementById('themeToggle'); if (btn) btn.textContent = mode === 'dark' ? 'Light' : 'Dark'; }

let activeRecognition = null;
function toggleVoice(inputId, btnId) {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { alert('Voice input not supported in this browser. Try Chrome or Safari.'); return; }
  const btn = document.getElementById(btnId);
 if (activeRecognition) { activeRecognition.stop(); activeRecognition = null; btn.classList.remove('recording'); btn.textContent = ''; return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; const recognition = new SR();
  recognition.lang = 'en-IN'; recognition.continuous = false; recognition.interimResults = false;
 recognition.onstart = () => { btn.classList.add('recording'); btn.textContent = ''; };
  recognition.onresult = (e) => { const transcript = e.results[0][0].transcript; const inp = document.getElementById(inputId); inp.value = (inp.value + ' ' + transcript).trim(); inp.dispatchEvent(new Event('input')); inp.focus(); };
 recognition.onend = () => { btn.classList.remove('recording'); btn.textContent = ''; activeRecognition = null; };
 recognition.onerror = () => { btn.classList.remove('recording'); btn.textContent = ''; activeRecognition = null; };
  activeRecognition = recognition; recognition.start();
}

function isWeekday(dateStr) { const d = parseDate(dateStr); const day = d.getDay(); return day !== 0 && day !== 6; }
function calcStreak() {
  let streak = 0; let d = new Date(); d.setDate(d.getDate()-1);
  while (true) { const k = dateKey(d); if (!isWeekday(k)) { d.setDate(d.getDate()-1); continue; } const data = allData[k]; const tasks = data?.tasks||[]; const done = tasks.filter(t=>t.done).length; if (!tasks.length || done===0) break; streak++; d.setDate(d.getDate()-1); if (streak>365) break; }
  return streak;
}
function calcMomentum() {
  let total=0,done=0,days=0; const d=new Date(); d.setDate(d.getDate()-1);
  while (days<5) { const k=dateKey(d); if (isWeekday(k)) { const data=allData[k]; const tasks=data?.tasks||[]; total+=tasks.length; done+=tasks.filter(t=>t.done).length; days++; } d.setDate(d.getDate()-1); }
  return total ? Math.round((done/total)*100) : 0;
}
function renderMomentum() {
  // Streak / 5-day momentum row removed to reclaim screen space.
  var _mr0 = document.getElementById('momentumRow'); if (_mr0) { _mr0.innerHTML=''; _mr0.style.display='none'; } return;
  const streak=calcStreak(); const momentum=calcMomentum(); const mr=document.getElementById('momentumRow'); if (!mr) return;
  if (streak===0&&momentum===0){mr.innerHTML='';return;}
  const fireEmoji=streak>=7?'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg>':streak>=3?'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>':'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>';
  mr.innerHTML='<div class="streak-badge"><div class="streak-fire">'+fireEmoji+'</div><div class="streak-info"><div class="streak-num">'+streak+'</div><div class="streak-lbl">'+(streak===1?'1 day streak':streak+' day streak')+' (weekdays)</div></div></div><div class="momentum-bar-wrap"><div class="momentum-lbl"><span>5-day momentum</span><span style="color:var(--gold);font-weight:600">'+momentum+'%</span></div><div class="momentum-bar"><div class="momentum-fill" style="width:'+momentum+'%"></div></div></div>';
}

function tmplKey() {
  const uid = currentUser?.id; if (!uid) return null;
  const legacyKey = 'dt-tmpl-undefined'; const legacyData = localStorage.getItem(legacyKey);
  if (legacyData && legacyData !== '[]') { try { const existing = JSON.parse(localStorage.getItem('dt-tmpl-' + uid)||'[]'); if (!existing.length) localStorage.setItem('dt-tmpl-' + uid, legacyData); } catch {} localStorage.removeItem(legacyKey); }
  return 'dt-tmpl-' + uid;
}
// ── Task templates: server backed, localStorage as a cache ──────────────
// These used to live ONLY in localStorage, so a rep who opened the app on a
// different laptop, cleared their browser, or got a new machine lost every
// template they had written, with no way back and nobody able to help. They
// are now kept per user on the server and mirrored locally, so the list
// follows the person and still paints instantly before the fetch returns.
//
// Both keep their synchronous signatures on purpose: they are called from
// render and click handlers throughout this file, and going async would have
// meant touching every one of them.
var _tmplCache = null;
var _tmplLoading = false;

function getTemplates() {
  if (_tmplCache) return _tmplCache;
  const k = tmplKey(); if (!k) return [];
  try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; }
}

function saveTemplates(list) {
  _tmplCache = list;
  const k = tmplKey(); if (k) { try { localStorage.setItem(k, JSON.stringify(list)); } catch(e) {} }
  try {
    fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'set_user_kv', key:'task_templates', value: JSON.stringify(list) }) });
  } catch(e) { /* the local copy is saved already; a failed sync is not a lost template */ }
}

// Runs once. Pulls the server copy, and the first time a rep with existing
// local templates signs in, pushes those up rather than letting an empty
// server copy overwrite what they already had.
async function ensureTaskTemplatesLoaded(onReady) {
  if (_tmplCache || _tmplLoading) { if (onReady) onReady(); return; }
  _tmplLoading = true;
  let server = [];
  try {
    const r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'get_user_kv', key:'task_templates' }) });
    const d = await r.json();
    const raw = d && d.value;
    server = typeof raw === 'string' ? JSON.parse(raw || '[]') : (Array.isArray(raw) ? raw : []);
  } catch(e) { server = []; }

  let local = [];
  const k = tmplKey();
  if (k) { try { local = JSON.parse(localStorage.getItem(k) || '[]'); } catch(e) { local = []; } }

  if (!server.length && local.length) {
    _tmplCache = local;
    saveTemplates(local);
  } else {
    _tmplCache = server;
    if (k) { try { localStorage.setItem(k, JSON.stringify(server)); } catch(e) {} }
  }
  _tmplLoading = false;
  if (onReady) onReady();
}
function buildTasksText() {
  const d = dayData(viewDate);
  const tasks = d.tasks || [];
  if (!tasks.length) return null;

  // Format date as DD/MM/YYYY
  const parts = viewDate.split('-');
  const dateStr = parts[2] + '/' + parts[1] + '/' + parts[0];

  // Header line with sender name
  const senderName = profile?.org_name || currentUser?.email?.split('@')[0] || 'Me';
  let text = '*Priorities for ' + dateStr + '*\n';
  text += '_Shared by ' + senderName + '_\n\n';

  // Tasks with serial numbers, priorities marked with a star. Plain text output
  // (WhatsApp/email/preview), never HTML: icons must stay as characters here.
  let sno = 1;
  tasks.forEach(function(t) {
    if (!t.text) return;
    const displayText = t.text.startsWith('*') ? t.text.slice(1).trim() : t.text;
 const done = t.done ? '' : '';
 const priority = (t.priority || t.text.startsWith('*')) ? '' : '';
    text += sno + '. ' + done + priority + displayText + '\n';
    sno++;
  });

  // Summary line
  const total = tasks.length;
  const done = tasks.filter(function(t) { return t.done; }).length;
  text += '\n_' + done + '/' + total + ' completed_';
  return text;
}

function shareTasksMenu() {
  const text = buildTasksText();
  if (!text) { alert('No tasks to share today.'); return; }

  var existing = document.getElementById('share-menu-popup');
  if (existing) { existing.remove(); return; }

  var overlay = document.createElement('div');
  overlay.id = 'share-menu-popup';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:flex-end;justify-content:center;z-index:999;padding:0';

  var parts = viewDate.split('-');
  var dateStr = parts[2] + '/' + parts[1] + '/' + parts[0];

  overlay.innerHTML =
    '<div style="background:var(--bg);border-top:1px solid var(--border2);border-radius:var(--radius-lg) var(--radius-lg) 0 0;width:100%;max-width:480px;padding:0 0 24px 0;animation:slideUp 0.25s ease">' +
      '<div style="width:40px;height:4px;background:var(--border2);border-radius:var(--r-sm);margin:12px auto 16px"></div>' +
      '<div style="padding:0 20px">' +
        '<div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">Share today\'s priorities</div>' +
        '<div style="font-size:12px;color:var(--text3);margin-bottom:20px">' + dateStr + ' · ' + (buildTasksText()?.split('\n').filter(function(l){return l.match(/^\d+\./);}).length || 0) + ' tasks</div>' +

        '<button onclick="shareWhatsApp()" style="width:100%;padding:13px 16px;background:rgba(37,211,102,0.08);border:1px solid rgba(37,211,102,0.25);border-radius:var(--radius);color:#128C7E;font-family:var(--sans);font-size:14px;font-weight:500;cursor:pointer;margin-bottom:10px;text-align:left;display:flex;align-items:center;gap:12px">' +
          '<span style="font-size:20px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg></span>' +
          '<div><div style="font-weight:600">Share via WhatsApp</div><div style="font-size:12px;color:var(--text3);font-weight:400">Opens WhatsApp with your priorities pre-filled</div></div>' +
        '</button>' +

        '<button onclick="shareEmail()" style="width:100%;padding:13px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--sans);font-size:14px;font-weight:500;cursor:pointer;margin-bottom:10px;text-align:left;display:flex;align-items:center;gap:12px">' +
          '<span style="font-size:20px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg></span>' +
          '<div><div style="font-weight:600">Share via Email</div><div style="font-size:12px;color:var(--text3);font-weight:400">Opens your mail app with subject and body</div></div>' +
        '</button>' +

        '<button onclick="copyTaskText()" id="copy-tasks-btn" style="width:100%;padding:13px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--sans);font-size:14px;font-weight:500;cursor:pointer;margin-bottom:16px;text-align:left;display:flex;align-items:center;gap:12px">' +
          '<span style="font-size:20px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg></span>' +
          '<div><div style="font-weight:600">Copy to clipboard</div><div style="font-size:12px;color:var(--text3);font-weight:400">Paste anywhere, Slack, Teams, SMS</div></div>' +
        '</button>' +

        '<button onclick="document.getElementById(\'share-menu-popup\').remove()" style="width:100%;padding:11px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text3);font-family:var(--sans);font-size:13px;cursor:pointer">Cancel</button>' +
      '</div>' +
    '</div>';

  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function shareWhatsApp() {
  var text = buildTasksText();
  if (!text) return;
  document.getElementById('share-menu-popup')?.remove();
  // WhatsApp URL scheme — opens WhatsApp with pre-filled message
  var url = 'https://wa.me/?text=' + encodeURIComponent(text);
  window.open(url, '_blank');
}

function shareEmail() {
  var text = buildTasksText();
  if (!text) return;
  document.getElementById('share-menu-popup')?.remove();
  var parts = viewDate.split('-');
  var dateStr = parts[2] + '/' + parts[1] + '/' + parts[0];
  var subject = 'Priorities for ' + dateStr;
  // Convert WhatsApp formatting (*bold*, _italic_) to plain text for email
  var body = text.replace(/\*/g, '').replace(/_/g, '');
  window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}

function copyTaskText() {
  var text = buildTasksText();
  if (!text) return;
  // Plain text version without WhatsApp markdown
  var plain = text.replace(/\*/g, '').replace(/_/g, '');
  navigator.clipboard.writeText(plain).then(function() {
    var btn = document.getElementById('copy-tasks-btn');
 if (btn) { btn.textContent = 'Copied!'; btn.style.color = 'var(--green)'; setTimeout(function() { document.getElementById('share-menu-popup')?.remove(); }, 1200); }
  });
}

function openTemplateManager() { document.getElementById('templateModal').style.display = 'flex'; renderTemplateList(); }
function closeTemplateManager() { document.getElementById('templateModal').style.display = 'none'; }
function renderTemplateList() {
  // First paint uses whatever is cached locally, then repaints once the server
  // copy lands, so the list is never blank while the fetch is in flight.
  if (!_tmplCache) ensureTaskTemplatesLoaded(function(){ renderTemplateList(); });
  const templates = getTemplates(); const list = document.getElementById('tmplList'); const count = document.getElementById('tmplCount');
  count.textContent = templates.length ? `(${templates.length})` : '';
  if (!templates.length) { list.innerHTML = '<div style="font-size:13px;color:var(--text3);font-style:italic;padding:8px 0">No template tasks yet. Add some above.</div>'; return; }
  list.innerHTML = templates.map((t, i) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:var(--r-sm);margin-bottom:6px"><input type="checkbox" id="tmpl-chk-${i}" checked style="accent-color:var(--gold);width:16px;height:16px;flex-shrink:0"><input type="text" value="${esc(t)}" id="tmpl-txt-${i}" style="flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:var(--font);font-size:13px" onchange="updateTemplateTask(${i}, this.value)"/><button onclick="deleteTemplateTask(${i})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`).join('');
}
function addTemplateTask() { const inp = document.getElementById('tmplInput'); const text = inp.value.trim(); const hint = document.getElementById('tmplHint'); if (text.length < 25) { hint.style.display='block'; inp.focus(); return; } hint.style.display='none'; const templates = getTemplates(); templates.push(text); saveTemplates(templates); inp.value = ''; renderTemplateList(); }
function updateTemplateTask(i, newVal) { const templates = getTemplates(); if (newVal.trim().length >= 25) templates[i] = newVal.trim(); saveTemplates(templates); }
function deleteTemplateTask(i) { const templates = getTemplates(); templates.splice(i, 1); saveTemplates(templates); renderTemplateList(); }
function loadTemplateToday() {
  const templates = getTemplates(); if (!templates.length) { alert('No template tasks saved yet.'); return; }
  const now = new Date(); const ts = now.toLocaleDateString('en-IN', { day:'numeric', month:'short' }) + ' · ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const d = dayData(viewDate); let added = 0;
  templates.forEach((text, i) => {
    const chk = document.getElementById('tmpl-chk-' + i); const editedTxt = document.getElementById('tmpl-txt-' + i)?.value?.trim() || text;
    if (!chk || !chk.checked) return; if (d.tasks.find(t => t.text === editedTxt)) return;
    const isPriority = editedTxt.startsWith('*'); const cleanText = isPriority ? editedTxt.slice(1).trim() : editedTxt;
    d.tasks.push({ text: cleanText, done: false, addedAt: ts, priority: isPriority }); added++;
  });
  if (added === 0) { alert('All selected tasks are already in today\'s list.'); return; }
  runCarryOver(); render(); save(viewDate); closeTemplateManager();
}
document.addEventListener('click', e => { const modal = document.getElementById('templateModal'); if (modal && e.target === modal) closeTemplateManager(); });

function updateSectionPillCounts() {
  const d = dayData(viewDate);
  const counts = { tasks:d.tasks?.length||0, issues:d.issues?.length||0, wins:d.wins?.length||0, misses:d.misses?.length||0 };
  const labels = { tasks:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> Tasks', issues:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Issues', wins:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.8l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 10l5.9-.8z"/></svg> Wins', misses:'○ Misses' };
  Object.keys(counts).forEach(k => { const btn = document.getElementById('tsb-'+k); if (btn) btn.innerHTML = labels[k]+(counts[k]?(' ('+counts[k]+')'):''); });
}
function saveMissComment(dayKey, idx, comment) { const d = dayData(dayKey); if (!d.misses[idx]) return; d.misses[idx].comment = comment.trim(); save(dayKey); renderToday(); }
function isAnonymous() { const toggle = document.getElementById('anonToggle'); return toggle ? toggle.checked : false; }

let _cfMissIdx = null, _cfTaskKey = null, _cfTaskIdx = null;
function openCarryFromTask(btn) {
  const idx = parseInt(btn.dataset.taskidx);
  const raw = btn.dataset.tasktext||''; const tmp = document.createElement('textarea'); tmp.innerHTML = raw; const txt = tmp.value;
  openCarryForward(null, txt, 'tasks', idx);
}
function openCarryForward(missIdx, taskText, taskKey, taskIdx) {
  _cfMissIdx = missIdx!=null?missIdx:null; _cfTaskKey = taskKey||null; _cfTaskIdx = taskIdx!=null?taskIdx:null;
  document.getElementById('carryFwdTaskText').textContent = taskText;
  document.getElementById('carryFwdReason').value = '';
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const dayAfter=new Date();dayAfter.setDate(dayAfter.getDate()+2);
  const nextMon=new Date();const daysToMon=(8-nextMon.getDay())%7||7;nextMon.setDate(nextMon.getDate()+daysToMon);
  const fmt=d=>d.toISOString().split('T')[0]; const lbl=d=>d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  const quickDays=document.getElementById('carryFwdQuickDays');
  quickDays.innerHTML=[{label:'Tomorrow · '+lbl(tomorrow),val:fmt(tomorrow)},{label:lbl(dayAfter),val:fmt(dayAfter)},{label:'Next Mon · '+lbl(nextMon),val:fmt(nextMon)}].map(opt=>'<button onclick="selectCarryDate(\''+opt.val+'\')" id="cfq-'+opt.val+'" style="padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text2);font-family:var(--font);font-size:12px;cursor:pointer;white-space:nowrap">'+opt.label+'</button>').join('');
  document.getElementById('carryFwdDate').value=fmt(tomorrow); selectCarryDate(fmt(tomorrow));
  document.getElementById('carryFwdModal').style.display='flex';
  setTimeout(()=>document.getElementById('carryFwdReason').focus(),200);
}
function selectCarryDate(val) {
  document.getElementById('carryFwdDate').value=val;
  document.querySelectorAll('[id^="cfq-"]').forEach(b=>{const on=b.id==='cfq-'+val;b.style.background=on?'var(--gold)':'var(--surface2)';b.style.color=on?'var(--c-canvas)':'var(--text2)';b.style.borderColor=on?'var(--gold)':'var(--border)';});
}
document.addEventListener('change',e=>{if(e.target.id==='carryFwdDate')selectCarryDate(e.target.value);});
function closeCarryForward(){document.getElementById('carryFwdModal').style.display='none';_cfMissIdx=null;_cfTaskKey=null;_cfTaskIdx=null;}
function confirmCarryForward(){
  const targetDate=document.getElementById('carryFwdDate').value; const reason=document.getElementById('carryFwdReason').value.trim(); const taskText=document.getElementById('carryFwdTaskText').textContent;
  if(!targetDate){alert('Please choose a date.');return;} if(targetDate<=viewDate){alert('Please choose a future date.');return;}
  const now=new Date(); const ts=now.toLocaleDateString('en-IN',{day:'numeric',month:'short'})+' · '+now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
  const d=dayData(targetDate); if(!d.tasks)d.tasks=[];
  if(!d.tasks.find(t=>t.text===taskText))d.tasks.push({text:taskText,done:false,addedAt:ts,priority:false,carriedFrom:viewDate,carryReason:reason||null});
  save(targetDate);
  if(_cfMissIdx!==null){const miss=dayData(viewDate).misses?.[_cfMissIdx];if(miss){miss.carriedTo=targetDate;miss.carryReason=reason||null;}save(viewDate);}
  if(_cfTaskKey&&_cfTaskIdx!==null){const task=dayData(viewDate)[_cfTaskKey]?.[_cfTaskIdx];if(task){task.carriedTo=targetDate;task.carryReason=reason||null;}save(viewDate);}
  runCarryOver();render();closeCarryForward();
  const targetLabel=new Date(targetDate+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
 showCFToast('Carried forward to '+targetLabel+'');
}
// ── showToast — global toast notification ─────────────────────────────────────
function showToast(msg) {
  var t = document.getElementById('samora-global-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'samora-global-toast';
    // z-index:100001 — the top of the stack, deliberately. Layering, highest
    // last: full-screen overlays 99999 (incl. the SAMpaign detail view),
    // modals opened FROM those overlays 100000 (scout profile), toast 100001.
    // A toast fired while anything is open must always be visible, since it
    // is often the only report of whether the action worked.
    t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--surface);border:1px solid var(--gold);padding:10px 18px;border-radius:var(--r-md);font-size:13px;color:var(--text);z-index:100001;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;white-space:nowrap;font-family:var(--sans);box-shadow:var(--shadow-2)';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(function() { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(10px)'; }, 3000);
}

// ── renderByProductChart ─────────────────────────────────────────────────────
function renderByProductChart(deals, fmtUsd) {
  // Use productBreakdown from pipeline response — comes from account_opportunities
  // joined to org_products, which is where products are actually defined and stored.
  var breakdown = (_pipelineData && _pipelineData.productBreakdown) || {};
  var rows = Object.entries(breakdown)
    .filter(function(e){ return e[0] !== 'No product' && e[1].value > 0; })
    .sort(function(a, b){ return b[1].value - a[1].value; })
    .map(function(e){ return { label: e[0], val: e[1].value }; });
  var maxVal = rows.length ? Math.max.apply(null, rows.map(function(r){return r.val;})) : 0;
  if (!rows.length) return '<div style="font-size:12px;color:var(--text3);padding:16px 0">No product breakdown found. Assign products to deals using the deal breakdown section, or verify that products are set up in Admin → Products.</div>';
  return '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px">Pipeline by product</div>' +
    mkBars(rows, maxVal, fmtUsd);
}

// ── renderByStreamChart ─────────────────────────────────────────────────────
function renderByStreamChart(deals, fmtUsd) {
  var byStream = {};
  deals.forEach(function(d) {
    var streams = d.revenue_streams || [];
    if (streams.length) {
      streams.forEach(function(s) {
        var k = s.name || s.key || s.type || 'Other';
        if (!byStream[k]) byStream[k] = { val: 0, verified: 0, partial: 0 };
        var amt = parseFloat(s.amount_usd) || parseFloat(s.amount) || d.deal_value_usd || 0;
        byStream[k].val += amt;
        if (d.tier === 'verified') byStream[k].verified += amt;
        else if (d.tier === 'partial') byStream[k].partial += amt;
      });
    } else {
      var k2 = d.deal_type || 'Unknown';
      if (!byStream[k2]) byStream[k2] = { val: 0, verified: 0, partial: 0 };
      byStream[k2].val += d.deal_value_usd || 0;
      if (d.tier === 'verified') byStream[k2].verified += d.deal_value_usd || 0;
      else if (d.tier === 'partial') byStream[k2].partial += d.deal_value_usd || 0;
    }
  });
  var rows = Object.entries(byStream).sort(function(a, b) { return b[1].val - a[1].val; }).map(function(e) {
    return { label: e[0], val: e[1].val, verified: e[1].verified, partial: e[1].partial };
  });
  var maxVal = Math.max.apply(null, rows.map(function(r) { return r.val; }));
  if (!rows.length) return '<div style="font-size:12px;color:var(--text3);padding:16px 0">No revenue stream data, save deals with stream breakdowns to see this view.</div>';
  return '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px">Pipeline by revenue stream</div>' +
    mkBars(rows, maxVal, fmtUsd);
}

// ── Deal card click → detail modal ────────────────────────────────────────────
document.addEventListener('click', function(e) {
  var card = e.target.closest('.deal-card-row');
  if (!card) return;
  if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('a')) return;
  openDealDetail(card.getAttribute('data-deal-id'), card.getAttribute('data-deal-account'));
});

var _dealDetailTab = 'overview';
var _currentDealDetail = null;

function openSdrScout(dealId, accountName) { _stkTab = 'prospective'; openDealDetail(dealId, accountName, 'stakeholders'); }
async function openDealDetail(dealId, accountName, initialTab) {
  document.getElementById('deal-detail-modal')?.remove();
  var deal = null;
  if (_pipelineData) {
    var all = [...(_pipelineData.verified||[]), ...(_pipelineData.partial||[]), ...(_pipelineData.unverified||[])];
    deal = all.find(function(d) { return d.id === dealId; });
  }
  // SDR playground deals/leads aren't in _pipelineData — fall back to that lookup.
  if (!deal && window._sdrDeals && window._sdrDeals[dealId]) deal = window._sdrDeals[dealId];
  if (!deal) return;
  _dealDetailTab = initialTab || 'weekly';
  var modal = document.createElement('div');
  modal.id = 'deal-detail-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = _buildDealDetailHTML(deal);
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
  _loadDealDetailData(dealId, deal);
}

function _buildDealDetailHTML(deal) {
  var fmtUsd = function(v) { return !v ? 'Not set' : fmtOrgMoney(v); };
  return '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:540px;max-height:85vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="padding:16px 16px 0;position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--border);z-index:1">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">' +
        '<div><div style="font-size:16px;font-weight:600;color:var(--text)">' + esc(deal.account) + '</div>' +
        '<div style="font-size:12px;color:var(--text3);margin-top:2px">' + fmtUsd(deal.deal_value_usd) + ' · ' + esc(deal.stage||'') + '</div></div>' +
        '<button onclick="document.getElementById(\'deal-detail-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '</div>' +
      '<div style="display:flex;gap:0;margin-bottom:-1px">' +
        _dealTab('weekly','<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> Weekly Check') + _dealTab('overview','<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V4M4 20h16M8 17V11M12.5 17V7.5M17 17v-4"/></svg> Overview') + _dealTab('stakeholders','<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20v-1.5A4.5 4.5 0 017 14h4a4.5 4.5 0 014.5 4.5V20M16 4.3a3.5 3.5 0 010 6.4M18 14.3a4.5 4.5 0 013.5 4.2V20"/></svg> Stakeholders') + _dealTab('meddpicc','<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> MEDDPICC') + _dealTab('signals','<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg> Signals') +
      '</div>' +
    '</div>' +
    '<div id="deal-detail-body" style="padding:16px"><div style="padding:24px 0;text-align:center;font-size:12px;color:var(--text3)">Loading weekly check…</div></div>' +
  '</div>';
}

function _dealTab(key, label) {
  var a = _dealDetailTab === key;
  return '<button onclick="switchDealTab(\'' + key + '\')" id="ddtab-' + key + '" style="padding:7px 14px;border:none;border-bottom:2px solid ' + (a?'var(--gold)':'transparent') + ';background:none;color:' + (a?'var(--gold)':'var(--text3)') + ';font-family:var(--sans);font-size:12px;font-weight:' + (a?'600':'400') + ';cursor:pointer">' + label + '</button>';
}

function switchDealTab(tab) {
  _dealDetailTab = tab;
  ['weekly','overview','stakeholders','meddpicc','signals'].forEach(function(t) {
    var b = document.getElementById('ddtab-' + t); if (!b) return;
    b.style.borderBottomColor = t===tab?'var(--gold)':'transparent';
    b.style.color = t===tab?'var(--gold)':'var(--text3)';
    b.style.fontWeight = t===tab?'600':'400';
  });
  var body = document.getElementById('deal-detail-body'); if (!body) return;
  if (tab === 'weekly'       && _currentDealDetail) { _renderWeeklyCheckPane(_currentDealDetail.deal); return; }
  if (tab === 'overview'     && _currentDealDetail) { body.innerHTML = _buildDealOverviewHTML(_currentDealDetail.deal); return; }
  if (tab === 'stakeholders' && _currentDealDetail) { _renderStakeholdersPane(_currentDealDetail.stakeholders, _currentDealDetail.deal); return; }
  if (tab === 'meddpicc'     && _currentDealDetail) { _renderMeddpiccPane(_currentDealDetail.meddpicc, _currentDealDetail.deal); return; }
  if (tab === 'signals'      && _currentDealDetail) { _renderSignalsPane(_currentDealDetail.deal); return; }
  body.innerHTML = '<div style="font-size:12px;color:var(--text3)">Loading…</div>';
}

async function _loadDealDetailData(dealId, deal) {
  try {
    var [mRes, sRes] = await Promise.all([
      fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_meddpicc', account_id:dealId}) }),
      fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_stakeholders', account_id:dealId}) })
    ]);
    var mData = await mRes.json(); var sData = await sRes.json();
    var stakeholders = sData.stakeholders || [];
    // Is there proven contact on this account that no person is attached to?
    // The backend decides; the pane just acts on it.
    window._stkUnmapped = !!sData.unmapped_activity;

    // Auto-refresh if contacts exist but ALL have no activity data (stale pre-signal enrichment)
    // This silently re-enriches in background to pick up Gmail activity signals
    var allUncontacted = stakeholders.length > 0 && stakeholders.every(function(s) {
      return !s.last_contacted_at && !s.contact_count && !s.title;
    });
    if (allUncontacted) {
      try {
        var rr = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
          body:JSON.stringify({action:'enrich_account', account_id:dealId, account_name:deal.account, refresh:true}) });
        var rrd = await rr.json();
        if (rrd.ok) {
          var sRes2 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
            body:JSON.stringify({action:'get_stakeholders', account_id:dealId}) });
          stakeholders = (await sRes2.json()).stakeholders || stakeholders;
        }
      } catch(e) {}
    }

    _currentDealDetail = { deal, meddpicc: mData.meddpicc||null, stakeholders };
  } catch(e) { _currentDealDetail = { deal, meddpicc:null, stakeholders:[] }; }
  var body = document.getElementById('deal-detail-body'); if (!body) return;
  if (_dealDetailTab === 'weekly')       _renderWeeklyCheckPane(deal);
  if (_dealDetailTab === 'overview')     body.innerHTML = _buildDealOverviewHTML(deal);
  if (_dealDetailTab === 'stakeholders') _renderStakeholdersPane(_currentDealDetail.stakeholders, deal);
  if (_dealDetailTab === 'meddpicc')     _renderMeddpiccPane(_currentDealDetail.meddpicc, deal);
  if (_dealDetailTab === 'signals')      _renderSignalsPane(deal);
}

// ── Weekly Check pane ─────────────────────────────────────────────────────────
// Per-account "what's right / what's wrong / do this week", every line with its
// receipt. Deterministic (get_account_weekly_check); serves cached on failure.
async function _renderWeeklyCheckPane(deal, forceRefresh) {
  var body = document.getElementById('deal-detail-body'); if (!body) return;
  body.innerHTML = '<div style="padding:24px 0;text-align:center;font-size:12px;color:var(--text3)">Reading the account…</div>';
  var d;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_account_weekly_check', account_id:deal.id, refresh: !!forceRefresh}) });
    d = await r.json();
  } catch(e) { d = null; }
  if (!d || (!d.ok && !d.going_right)) {
    body.innerHTML = '<div style="padding:20px 0;text-align:center;font-size:12px;color:var(--text3)">Couldn\'t load the weekly check.<br><button onclick="_renderWeeklyCheckPane(_currentDealDetail.deal, true)" style="margin-top:8px;font-size:11px;padding:5px 12px;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--border2);color:var(--gold);cursor:pointer;font-family:var(--sans)">↻ Try again</button></div>';
    return;
  }
  var h = d.header || {};
  var verdictCfg = {
    on_track:        { label: 'On track',        color: 'var(--green)', bg: 'rgba(74,140,92,0.12)',  icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>' },
    needs_attention: { label: 'Needs attention', color: 'var(--amber)', bg: 'rgba(var(--c-accent-rgb),0.14)', icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg>' },
    at_risk:         { label: 'At risk',          color: 'var(--coral)', bg: 'rgba(200,80,70,0.12)',  icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' }
  }[d.verdict] || { label: 'Reviewed', color: 'var(--text2)', bg: 'var(--surface2)', icon: '•' };
  var fmtUsd = function(v){ return !v ? 'Not set' : fmtOrgMoney(v); };

  var html = '<div style="margin-bottom:10px">' + _samoraIntelLabel('Weekly account check · every line shows its receipt') + '</div>';

  // Verdict + vitals
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
    '<span style="font-size:12px;font-weight:700;color:'+verdictCfg.color+';background:'+verdictCfg.bg+';border-radius:var(--r-sm);padding:4px 10px">'+verdictCfg.icon+' '+verdictCfg.label+'</span>' +
    (d.cached ? '<span style="font-size:11px;color:var(--text3);background:var(--surface2);border-radius:var(--r-sm);padding:2px 6px">cached</span>' : '') +
    '</div>';

  var vitals = [];
  if (h.health_score != null) vitals.push(['Health', h.health_score + '/100']);
  if (h.signal_score != null) vitals.push(['Signal', h.signal_score + '/100']);
  vitals.push(['Value', fmtUsd(h.value_usd)]);
  if (h.days_to_close != null) vitals.push(['Close in', h.days_to_close + 'd']);
  vitals.push(['Active contacts', h.active_contacts != null ? String(h.active_contacts) : '—']);
  vitals.push(['Last touch', h.days_since_contact != null ? h.days_since_contact + 'd ago' : 'never']);
  if (d.momentum && d.momentum.signal_delta_7d != null) vitals.push(['7d momentum', (d.momentum.signal_delta_7d>=0?'+':'') + d.momentum.signal_delta_7d]);
  html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">' + vitals.map(function(v){
    return '<div style="flex:1;min-width:72px;background:var(--surface2);border-radius:var(--r-sm);padding:7px 8px;text-align:center"><div style="font-size:13px;font-weight:600;color:var(--text)">'+esc(v[1])+'</div><div style="font-size:11px;color:var(--text3)">'+esc(v[0])+'</div></div>';
  }).join('') + '</div>';

  var section = function(title, color, items, render) {
    if (!items || !items.length) return '';
    var s = '<div style="font-size:11px;font-weight:700;color:'+color+';text-transform:uppercase;letter-spacing:0.06em;margin:14px 0 8px">'+title+'</div>';
    return s + items.map(render).join('');
  };

  html += section('<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> What\'s going right', 'var(--green)', d.going_right, function(w){
    return '<div style="background:rgba(74,140,92,0.06);border-left:2px solid var(--green);border-radius:0 6px 6px 0;padding:8px 10px;margin-bottom:6px">' +
      '<div style="font-size:12px;font-weight:600;color:var(--text)">'+esc(w.point)+'</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(w.evidence)+'</div></div>';
  });

  html += section('<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> What needs attention', 'var(--coral)', d.going_wrong, function(w){
    var sv = w.severity === 'high' ? { c:'var(--coral)', bg:'rgba(200,80,70,0.06)' } : { c:'var(--amber)', bg:'rgba(var(--c-accent-rgb),0.06)' };
    return '<div style="background:'+sv.bg+';border-left:2px solid '+sv.c+';border-radius:0 6px 6px 0;padding:8px 10px;margin-bottom:6px">' +
      '<div style="font-size:12px;font-weight:600;color:var(--text)">'+esc(w.point)+' <span style="font-size:11px;font-weight:700;color:'+sv.c+';text-transform:uppercase">· '+esc(w.severity)+'</span></div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(w.evidence)+'</div></div>';
  });

  if (d.do_this_week && d.do_this_week.length) {
    html += '<div style="font-size:11px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin:14px 0 8px">→ Do this week</div>';
    html += d.do_this_week.map(function(t, i){
      return '<div style="display:flex;gap:8px;align-items:flex-start;background:rgba(var(--c-accent-rgb),0.06);border:1px solid rgba(var(--c-accent-rgb),0.2);border-radius:var(--r-sm);padding:8px 10px;margin-bottom:6px">' +
        '<span style="font-size:11px;font-weight:700;color:var(--gold);flex-shrink:0">'+(i+1)+'.</span>' +
        '<div><div style="font-size:12px;font-weight:600;color:var(--text)">'+esc(t.action)+'</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(t.why)+'</div></div></div>';
    }).join('');
  }

  if (!d.going_right.length && !d.going_wrong.length) {
    html += '<div style="padding:16px 0;text-align:center;font-size:12px;color:var(--text3)">Not enough activity on this account yet to assess. Enrich contacts and log a meeting to start the read.</div>';
  }

  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;font-size:11px;color:var(--text3)">' +
    '<span>'+(d.computed_at ? 'Checked '+_fmtRelTime(d.computed_at) : '')+'</span>' +
    '<button onclick="_renderWeeklyCheckPane(_currentDealDetail.deal, true)" style="background:none;border:none;color:var(--gold);cursor:pointer;font-size:11px;font-family:var(--sans);padding:0">↻ Re-check</button></div>';

  body.innerHTML = html;
}
function _fmtRelTime(iso) {
  try { var s = (Date.now() - new Date(iso).getTime())/1000;
    if (s < 90) return 'just now';
    if (s < 3600) return Math.round(s/60)+'m ago';
    if (s < 86400) return Math.round(s/3600)+'h ago';
    return Math.round(s/86400)+'d ago';
  } catch(e) { return ''; }
}

// ── Local Intelligence Engine ─────────────────────────────────────────────────
// All functions here use server-side rules engine. No external AI.

async function loadCoachingAlerts() {
  // The old collapsible alerts panel was removed from the Today rail: the
  // rail now shows Needs attention, and the full list lives behind the Alerts
  // metric. This function is still the only thing that fetches alerts, so it
  // must run WITHOUT that element or the metric and the rail both stay empty.
  var panel = document.getElementById('coachingAlertsPanel');
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_coaching_alerts', role: profile?.role||'member'}) });
    var d = await r.json();
    var alerts = d.alerts || [];
    // Feed the Today metric strip from data this loader already has,
    // rather than fetching alerts twice.
    try {
      var _hi = alerts.filter(function(a){ return a.severity === 'high'; }).length;
      _setMetric('mAlerts', alerts.length, _hi ? ' <span class="hi">' + _hi + ' high</span>' : '');
      _naAlerts = alerts;
      renderNeedsAttention();
      if (_openDrill === 'alerts') { _openDrill = null; toggleMetricDrill('alerts'); }
    } catch(_e) {}
    if (!alerts.length) {
      if (panel) panel.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:11px;color:var(--text3)">No active alerts</span><button onclick="runCoachingAlerts()" style="font-size:11px;padding:2px 8px;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);cursor:pointer">↻ Check now</button></div>';
      return;
    }
    var sevColor = {high:'var(--coral)', medium:'var(--amber)', low:'var(--blue)'};
    var typeIcon  = {dark_account:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5.2l3.2 2"/></svg>', no_champion:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11.5a4 4 0 100-8 4 4 0 000 8zM4.5 20.5v-1A5.5 5.5 0 0110 14h4a5.5 5.5 0 015.5 5.5v1"/></svg>', meddpicc_gap:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg>', close_at_risk:'⏰', velocity_stall:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/></svg>'};
    // Collapsed by default to a single summary line: the tasks list owns this
    // screen. High-severity count keeps urgency visible without the space.
    var highCount = alerts.filter(function(a){ return a.severity === 'high'; }).length;
    var bodyOpen = !!window._alertsPanelOpen;
    var html = '<div style="margin-bottom:6px">';
    html += '<div onclick="window._alertsPanelOpen=!window._alertsPanelOpen;loadCoachingAlerts()" style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:var(--surface2);border-radius:var(--r-sm);cursor:pointer;user-select:none;margin-bottom:' + (bodyOpen ? '5px' : '0') + '">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> ' + alerts.length + ' alert' + (alerts.length!==1?'s':'') + (highCount ? ' · <span style="color:var(--coral)">' + highCount + ' high</span>' : '') + '</div>';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<button onclick="event.stopPropagation();runCoachingAlerts()" style="font-size:11px;padding:1px 7px;border-radius:var(--r-sm);background:var(--surface);border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);cursor:pointer">↻</button>';
    html += '<span style="font-size:11px;color:var(--text3)">' + (bodyOpen ? '▴' : '▾') + '</span>';
    html += '</div></div>';
    html += '<div style="display:' + (bodyOpen ? 'block' : 'none') + '">';
    var VISIBLE_ALERTS = 5;
    function alertRow(a) {
      var col = sevColor[a.severity] || 'var(--text3)';
      var h = '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;margin-bottom:3px;background:var(--surface2);border-left:2px solid ' + col + ';border-radius:0 5px 5px 0">';
      h += '<span style="font-size:11px;flex-shrink:0">' + (typeIcon[a.alert_type]||'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg>') + '</span>';
      h += '<span style="font-size:11px;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(a.detail||'') + '">' + esc(a.title) + '</span>';
      h += '<button onclick="dismissAlert(\'' + a.id + '\')" style="font-size:11px;background:none;border:none;color:var(--text3);cursor:pointer;padding:0 2px;flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
      h += '</div>';
      return h;
    }
    alerts.slice(0, VISIBLE_ALERTS).forEach(function(a) { html += alertRow(a); });
    if (alerts.length > VISIBLE_ALERTS) {
      html += '<div id="coachingAlertsMore" style="display:none">';
      alerts.slice(VISIBLE_ALERTS).forEach(function(a) { html += alertRow(a); });
      html += '</div>';
      html += '<div id="coachingAlertsMoreBtn" onclick="_toggleCoachingAlerts()" style="font-size:11px;color:var(--gold);padding:3px 0 0 8px;cursor:pointer;user-select:none">+' + (alerts.length-VISIBLE_ALERTS) + ' more ▾</div>';
    }
    html += '</div>';  // collapsible body
    html += '</div>';
    // Guarded: the element no longer exists on Today. Throwing here would
    // abort the function AFTER the caches were filled but BEFORE anything
    // downstream ran, which is the worst kind of half-failure.
    if (panel) panel.innerHTML = html;
  } catch(e) { /* non-fatal */ }
}

function _toggleCoachingAlerts() {
  var more = document.getElementById('coachingAlertsMore');
  var btn = document.getElementById('coachingAlertsMoreBtn');
  if (!more || !btn) return;
  var open = more.style.display !== 'none';
  more.style.display = open ? 'none' : 'block';
  var hiddenCount = more.children.length;
  btn.textContent = open ? '+' + hiddenCount + ' more ▾' : 'show less ▴';
}

async function dismissAlert(alertId) {
  try {
    await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'dismiss_alert', alert_id:alertId}) });
    loadCoachingAlerts();
  } catch(e) {}
}

async function runDealHealth() {
  showToast('Computing deal health scores…');
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'compute_deal_health'}) });
    var d = await r.json();
    if (d.ok) {
 showToast('Health scored ' + d.dealsScored + ' deals');
      // Reload pipeline to show updated health scores
      if (typeof loadPipeline === 'function') loadPipeline();
    }
  } catch(e) { showToast('Error: ' + e.message); }
}

async function runForecast() {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'compute_forecast'}) });
    var d = await r.json();
    return d;
  } catch(e) { return null; }
}

async function runCoachingAlerts() {
  showToast('Running coaching alert engine…');
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'generate_coaching_alerts'}) });
    var d = await r.json();
    if (d.ok) {
 showToast('' + d.alertsGenerated + ' new alerts from ' + d.dealsChecked + ' deals');
      loadCoachingAlerts();
    }
  } catch(e) { showToast('Error: ' + e.message); }
}

async function refreshStakeholderSignals(accountId) {
  showToast('Refreshing stakeholder signals…');
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'refresh_stakeholder_signals', account_id: accountId}) });
    var d = await r.json();
 if (d.ok) showToast('Refreshed ' + d.refreshed + ' of ' + d.total + ' contacts');
    return d;
  } catch(e) { showToast('Error: ' + e.message); return null; }
}

async function inferMeddpiccFromTranscripts(accountId) {
  showToast('Scanning transcripts for MEDDPICC signals…');
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'infer_meddpicc_from_transcripts', account_id:accountId}) });
    var d = await r.json();
 if (d.ok) showToast('Inferred ' + d.inferred + ' MEDDPICC fields from transcripts');
    else showToast(d.message || d.error || 'No signals found');
    return d;
  } catch(e) { showToast('Error: ' + e.message); return null; }
}

// Load coaching alerts on Today tab render
var _coachingAlertsLoaded = false;
async function saveCompanyLinkedIn(accountId, url) {
  var clean = (url || '').trim();
  if (!clean) return;
  // Normalise: ensure it starts with https://
  if (clean && !clean.startsWith('http')) clean = 'https://' + clean;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'save_company_linkedin', account_id:accountId, linkedin_url:clean}) });
    var d = await r.json();
    if (d.ok) {
      showToast('LinkedIn URL saved');
      // Update the deal in local pipeline data so icon appears without reload
      if (_pipelineData) {
        var all = [...(_pipelineData.verified||[]),...(_pipelineData.partial||[]),...(_pipelineData.unverified||[])];
        var deal = all.find(function(x){ return x.id === accountId; });
        if (deal) deal.company_linkedin_url = clean;
      }
      if (_currentDealDetail && _currentDealDetail.deal) _currentDealDetail.deal.company_linkedin_url = clean;
    }
  } catch(e) {}
}

async function _renderSignalsPane(deal, forceRefresh, _retried) {
  var body = document.getElementById('deal-detail-body'); if (!body) return;
  body.innerHTML = '<div style="padding:20px 0;text-align:center;font-size:13px;color:var(--text3)">↻ ' + (_retried ? 'Still working on' : forceRefresh ? 'Refreshing' : 'Loading signals for') + ' ' + esc(deal.account) + '…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_market_signals', account_id:deal.id, account_name:deal.account, region:deal.region||'', refresh: !!forceRefresh}) });
    var d = await r.json();
    // The first uncached fetch runs a live AI call that occasionally returns
    // an unparseable/empty payload — which is why it used to take two manual
    // refreshes. Detect that empty shape and retry once automatically.
    var _broken = !d || d.error || (!d.verdict && !(d.signals && d.signals.length) && !(d.regional_signals && d.regional_signals.length) && !d.summary && !d.company_industry);
    if (_broken && !_retried) { return _renderSignalsPane(deal, true, true); }
    if (_broken) {
      body.innerHTML = '<div style="padding:20px 0;text-align:center;font-size:12px;color:var(--text3)">Couldn\'t load signals right now.<br><button onclick="_renderSignalsPane(_currentDealDetail.deal, true)" style="margin-top:8px;font-size:11px;padding:5px 12px;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--border2);color:var(--gold);cursor:pointer;font-family:var(--sans)">↻ Try again</button></div>';
      return;
    }
    var html = '';
    var typeIcons = {hiring:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20v-1.5A4.5 4.5 0 017 14h4a4.5 4.5 0 014.5 4.5V20M16 4.3a3.5 3.5 0 010 6.4M18 14.3a4.5 4.5 0 013.5 4.2V20"/></svg>',funding:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v10M14.8 9.3A3 3 0 0012 7.8h-.4a2.2 2.2 0 000 4.4h.8a2.2 2.2 0 010 4.4H12a3 3 0 01-2.8-1.5"/></svg>',expansion:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>',contraction:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/></svg>',leadership:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11.5a4 4 0 100-8 4 4 0 000 8zM4.5 20.5v-1A5.5 5.5 0 0110 14h4a5.5 5.5 0 015.5 5.5v1"/></svg>',technology:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.2 14.4a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1v.2a2 2 0 01-4 0v-.1a1.6 1.6 0 00-2.8-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 010-4h.1a1.6 1.6 0 001.1-2.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 014 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7h.2a2 2 0 010 4h-.1a1.6 1.6 0 00-1.4 1.1z"/></svg>',financial:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V4M4 20h16M8 17V11M12.5 17V7.5M17 17v-4"/></svg>',competitive:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M9.5 20h5M12 14v6"/></svg>'};
    var sigColors = {positive:'var(--green)',negative:'var(--coral)',neutral:'var(--amber)'};
    if (d.cached) {
      // Fresh shared cache (<24h) = the NORMAL path — one rep fetches, the
      // whole deal team reads it. Stale cache = quota-degraded fallback.
      var cachedAtMs = d.cached_at ? new Date(d.cached_at).getTime() : 0;
      // Drop Q: an answer kept because nothing about the account changed is as
      // good as a fresh one, so it reads like one.
      var isFreshShare = (cachedAtMs && (Date.now() - cachedAtMs) < 24*3600*1000) || /changed/.test(d.cache_reason || '');
      var cachedLbl = d.cached_at ? new Date(d.cached_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : 'earlier';
      html += isFreshShare
        ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--text3);margin-bottom:10px;padding:4px 8px;background:var(--surface2);border-radius:var(--r-sm)"><span><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6.5h6l2 2.5h9v11h-17z"/></svg> ' + (/changed/.test(d.cache_reason || '') ? 'From ' + esc(cachedLbl) + ': nothing about this account has changed since' : 'Shared team fetch from ' + esc(cachedLbl) + ', saved AI quota') + '</span><button onclick="_renderSignalsPane(_currentDealDetail.deal, true)" style="background:none;border:none;color:var(--gold);cursor:pointer;font-size:11px;font-family:var(--sans);padding:0;flex-shrink:0">↻ Refresh live</button></div>'
        : '<div style="font-size:11px;color:var(--amber);margin-bottom:10px;padding:4px 8px;background:rgba(var(--c-accent-rgb),0.1);border-radius:var(--r-sm)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> Live refresh unavailable (AI quota): showing signals from ' + esc(cachedLbl) + '</div>';
    }

    function renderSignalCards(signals) {
      if (!signals || !signals.length) return '<div style="font-size:12px;color:var(--text3);padding:8px 0;font-style:italic">No signals found for this scope.</div>';
      var h = '';
      signals.forEach(function(s) {
        var col = sigColors[s.signal] || 'var(--border)';
        h += '<div style="background:var(--bg);border-radius:var(--r-sm);padding:9px 11px;margin-bottom:6px;border-left:3px solid '+col+'">';
        h += '<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:3px">';
        h += '<span style="font-size:13px;flex-shrink:0">'+(typeIcons[s.type]||'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 21V3.5M5.5 4.5h12l-2.5 4 2.5 4h-12"/></svg>')+'</span>';
        h += '<div style="flex:1"><div style="font-size:12px;font-weight:500;color:var(--text)">'+esc(s.title||'')+'</div>';
        if (s.date||s.source) h += '<div style="font-size:11px;color:var(--text3);margin-top:1px">'+(s.date?esc(s.date):'')+(s.date&&s.source?' · ':'')+esc(s.source||'')+'</div>';
        h += '</div>';
        h += '<span style="font-size:11px;padding:2px 6px;border-radius:var(--r-sm);background:'+col+'22;color:'+col+';flex-shrink:0">'+esc(s.signal||'')+'</span>';
        h += '</div>';
        if (s.detail) h += '<div style="font-size:11px;color:var(--text2);line-height:1.5;margin-bottom:3px">'+esc(s.detail)+'</div>';
        if (s.why_it_matters) h += '<div style="font-size:11px;color:var(--amber);font-style:italic"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.8v.4"/></svg> '+esc(s.why_it_matters)+'</div>';
        h += '</div>';
      });
      return h;
    }

    // Buying intent (Drop Q): rules over your own activity and company events.
    html += '<div id="samIntentBox">' + (d.intent && typeof _samIntentHTML === 'function' ? _samIntentHTML(d.intent) : '') + '</div>';

    // Verdict
    if (d.verdict) {
      var vp = d.verdict.split('|'), vl = vp[0]||'', vr = vp[1]||'';
      var vc = vl.includes('Approach') ? 'var(--green)' : vl.includes('Deprioritise') ? 'var(--coral)' : 'var(--amber)';
      html += '<div style="border-radius:var(--r-md);border:1px solid '+vc+';background:'+vc+'18;padding:10px 14px;margin-bottom:12px">';
      html += '<div style="font-size:11px;font-weight:700;color:'+vc+';text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">'+esc(vl)+'</div>';
      if (vr) html += '<div style="font-size:12px;color:var(--text2)">'+esc(vr)+'</div>';
      html += '</div>';
    }

    // Company meta + tech stack
    var meta = [d.company_industry, d.company_size, d.company_funding].filter(Boolean);
    if (meta.length) html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'+meta.map(function(m){return '<span style="font-size:11px;background:var(--surface2);border-radius:var(--r-sm);padding:2px 8px">'+esc(m)+'</span>';}).join('')+'</div>';
    if (d.company_technologies && d.company_technologies.length) {
      html += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">';
      d.company_technologies.forEach(function(t){ html += '<span style="font-size:11px;background:rgba(58,110,168,0.1);color:var(--blue);border-radius:var(--r-sm);padding:2px 6px">'+esc(String(t))+'</span>'; });
      html += '</div>';
    }

    // Lusha intent
    if (d.intent_signals && d.intent_signals.length) {
      html += '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Research intent · Lusha</div>';
      html += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px">';
      d.intent_signals.forEach(function(s) {
        var score = (s.metadata && s.metadata.topicScore) || 0;
        var trendRaw = s.metadata && s.metadata.topicTrend;
        var trend = (!isNaN(parseInt(trendRaw))) ? parseInt(trendRaw) : 0;
        var col = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--amber)' : 'var(--text3)';
        html += '<span style="font-size:11px;padding:3px 9px;border-radius:var(--r-sm);background:var(--surface2);border-left:3px solid '+col+'">';
        html += esc(s.topicName||'') + ' <span style="color:'+col+'">'+score+'</span>';
        if (trend !== 0) html += ' <span style="color:'+(trend>0?'var(--green)':'var(--coral)')+';">'+(trend>0?'↑':'↓')+Math.abs(trend)+'</span>';
        html += '</span>';
      });
      html += '</div>';
    }

    // Helper for section header
    function sectionHead(numeral, label, count) {
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;margin-top:4px">'
        + '<span style="font-size:11px;font-weight:700;color:var(--text3);font-style:italic">'+numeral+'</span>'
        + '<span style="font-size:12px;font-weight:600;color:var(--text)">'+label+'</span>'
        + (count ? '<span style="font-size:11px;background:var(--surface2);border-radius:var(--r-sm);padding:1px 6px;color:var(--text3)">'+count+' signals</span>' : '')
        + '</div>';
    }

    var globalSigs   = d.signals          || [];
    var regionalSigs = d.regional_signals  || [];
    var countrySigs  = d.country_signals   || [];
    var globalSum    = d.summary           || '';
    var regionalSum  = d.regional_summary  || '';
    var countrySum   = d.country_summary   || '';
    var regionLabel  = d.deal_region || 'Regional';
    var countryLabel = (d.deal_region || '').split(/[,\/ \-]/)[0].trim() || 'Country';
    // Don't show III if country is same as region (e.g. both = "India")
    var showCountry  = countryLabel && countryLabel.toLowerCase() !== regionLabel.toLowerCase();

    // ── I. Global ───────────────────────────────────────────────────────────
    html += '<div style="background:var(--surface2);border-radius:var(--r-md);padding:12px;margin-bottom:10px">';
    html += sectionHead('I.', 'Global', globalSigs.length);
    if (globalSum) {
      var sumStyle = globalSum.startsWith('AI parse error') || globalSum.startsWith('Signal fetch') ? 'color:var(--coral)' : 'color:var(--text2)';
      html += '<div style="font-size:12px;line-height:1.6;margin-bottom:10px;'+sumStyle+'">'+esc(globalSum)+'</div>';
    }
    html += renderSignalCards(globalSigs);
    html += '</div>';

    // ── II. Regional ────────────────────────────────────────────────────────
    html += '<div style="background:var(--surface2);border-radius:var(--r-md);padding:12px;margin-bottom:10px">';
    html += sectionHead('II.', regionLabel, regionalSigs.length);
    if (regionalSum) html += '<div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:10px">'+esc(regionalSum)+'</div>';
    html += renderSignalCards(regionalSigs);
    html += '</div>';

    // ── III. Country — only if different from region ────────────────────────
    if (showCountry) {
      html += '<div style="background:var(--surface2);border-radius:var(--r-md);padding:12px;margin-bottom:10px">';
      html += sectionHead('III.', countryLabel, countrySigs.length);
      if (countrySum) html += '<div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:10px">'+esc(countrySum)+'</div>';
      html += renderSignalCards(countrySigs);
      html += '</div>';
    }

    body.innerHTML = html;
    if (!d.intent && typeof _samIntentFill === 'function') _samIntentFill(deal.id, false);
  } catch(e) {
    body.innerHTML = '<div style="font-size:12px;color:var(--coral);padding:8px">Error: '+esc(e.message)+'</div>';
  }
}


function _switchSignalScope(scope) {
  ['global','regional','country'].forEach(function(k) {
    var tab = document.getElementById('sst-'+k);
    var pane = document.getElementById('ssc-'+k);
    if (tab) { tab.style.borderBottomColor = k===scope?'var(--gold)':'transparent'; tab.style.color = k===scope?'var(--gold)':'var(--text3)'; tab.style.fontWeight = k===scope?'600':'400'; }
    if (pane) pane.style.display = k===scope?'block':'none';
  });
}




function _buildDealOverviewHTML(deal) {
  if (!deal) return '';
  var fmtUsd = function(v) { return !v ? 'Not set' : fmtOrgMoney(v); };
  var rows = [['Deal value', fmtUsd(deal.deal_value_usd)],['Weighted', fmtUsd(deal.weighted_value_usd)],['Signal score', deal.signal_score!=null ? deal.signal_score+' / 100' : '—'],['Expected close', deal.expected_close||'—'],['Probability', deal.close_probability ? deal.close_probability+'%':'—'],['Rep', (deal.rep_email||'').split('@')[0]||'—'],['Region', deal.region||'—'],['ICP score', deal.icp_score!=null ? deal.icp_score+' / 100':'Not scored']];
  var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">';
  rows.forEach(function(r){ html += '<div style="background:var(--surface2);border-radius:var(--r-sm);padding:9px 11px"><div style="font-size:11px;color:var(--text3);margin-bottom:2px">'+r[0]+'</div><div style="font-size:14px;font-weight:500;color:var(--text)">'+esc(String(r[1]))+'</div></div>'; });
  html += '</div>';
  // SDR attribution row
  html += '<div style="background:var(--surface2);border-radius:var(--r-sm);padding:8px 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px">';
  html += '<span style="font-size:11px;color:var(--text3);flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Sourced by</span>';
  if (deal.originated_by_name) {
    html += '<span style="font-size:12px;font-weight:500;color:var(--text)">'+esc(deal.originated_by_name)+'</span>';
    if (deal.converted_from_sequence) html += '<span style="font-size:11px;color:var(--text3)"> · via '+esc(deal.converted_from_sequence)+'</span>';
    html += '<button onclick="clearDealAttribution(\''+esc(deal.id)+'\')" style="margin-left:auto;font-size:11px;background:none;border:none;color:var(--text3);cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  } else {
    html += '<button onclick="showAttributionPicker(\''+esc(deal.id)+'\')" style="font-size:11px;padding:2px 10px;border-radius:var(--r-sm);background:none;border:1px dashed var(--border2);color:var(--text3);font-family:var(--sans);cursor:pointer">+ Tag SDR origin</button>';
  }
  html += '</div>';
  html += '<div style="display:flex;gap:8px;margin-bottom:10px">';
  html += '<button onclick="switchDealTab(\'stakeholders\')" style="flex:1;padding:9px;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--border2);color:var(--text2);font-family:var(--sans);font-size:12px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20v-1.5A4.5 4.5 0 017 14h4a4.5 4.5 0 014.5 4.5V20M16 4.3a3.5 3.5 0 010 6.4M18 14.3a4.5 4.5 0 013.5 4.2V20"/></svg> Stakeholders</button>';
  html += '<button onclick="switchDealTab(\'meddpicc\')" style="flex:1;padding:9px;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--border2);color:var(--text2);font-family:var(--sans);font-size:12px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> MEDDPICC</button>';
  html += '<button onclick="switchDealTab(\'signals\')" style="flex:1;padding:9px;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--border2);color:var(--text2);font-family:var(--sans);font-size:12px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg> Signals</button>';
  html += '<button onclick="openCloseDeal(\''+esc(deal.id)+'\',\''+esc(deal.account)+'\')" style="flex:1;padding:9px;border-radius:var(--r-sm);background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:12px;cursor:pointer">Close deal</button>';
  html += '</div>';
  // Company LinkedIn URL field
  var liUrl = deal.company_linkedin_url || '';
  html += '<div style="background:var(--surface2);border-radius:var(--r-sm);padding:9px 12px;display:flex;align-items:center;gap:8px">';
  html += '<svg width="13" height="13" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
  html += '<input type="url" id="dealLinkedInInput" value="' + esc(liUrl) + '" placeholder="linkedin.com/company/ferrero" onblur="saveCompanyLinkedIn(\'' + esc(deal.id) + '\',this.value)" style="flex:1;background:none;border:none;outline:none;font-family:var(--sans);font-size:12px;color:var(--text);min-width:0"/>';
  if (liUrl) html += '<a href="' + esc(liUrl) + '" target="_blank" style="font-size:11px;color:#0A66C2;white-space:nowrap">Open ↗</a>';
  html += '</div>';
  return html;
}

// ── Samora Intel button: branded entry point for stakeholder insights ────────
function _samoraIntelBtn(onclickStr, compact) {
  return '<button onclick="' + onclickStr + '" title="Samora Intelligence: how to work with them" style="display:inline-flex;align-items:center;gap:5px;background:rgba(var(--c-accent-rgb),0.12);border:1px solid rgba(var(--c-accent-rgb),0.35);border-radius:var(--r-md);padding:' + (compact ? '2px 8px' : '6px 12px') + ';cursor:pointer;flex-shrink:0">'
    + '<img src="icons/icon-48.png" alt="" style="width:' + (compact ? 12 : 16) + 'px;height:' + (compact ? 12 : 16) + 'px;border-radius:50%"/>'
    + '<span style="font-size:' + (compact ? 9 : 10) + 'px;font-weight:700;letter-spacing:.08em;color:var(--gold);text-transform:uppercase;font-family:var(--sans)">Samora Intel</span>'
    + '</button>';
}

// ── Meeting insights roster: all stakeholders in a meeting, tap for insight ──
function openMeetingInsights(idx) {
  var roster = (window._mtgRosters || [])[idx] || [];
  document.getElementById('mtg-insight-modal')?.remove();
  var modal = document.createElement('div');
  modal.id = 'mtg-insight-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  var rows = roster.map(function(s, i) {
    var initials = (s.full_name || '?').split(' ').map(function(w){ return w[0] || ''; }).slice(0,2).join('').toUpperCase();
    var insLbl = s.insight && s.insight.label
      ? '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:var(--r-md);background:rgba(var(--c-accent-rgb),0.12);color:var(--gold)">' + esc(s.insight.label) + '</span>'
      : '<span style="font-size:11px;color:var(--text3)">Not assessed yet, tap to read</span>';
    var click = s.id ? 'openStakeholderInsight(\'' + esc(s.id) + '\',\'' + esc(s.full_name||'') + '\')' : '';
    return '<div onclick="' + click + '" style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--border);cursor:' + (s.id ? 'pointer' : 'default') + '">' +
      '<div style="width:34px;height:34px;border-radius:50%;background:var(--surface2);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--text2);flex-shrink:0">' + esc(initials) + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:13px;font-weight:500;color:var(--text)">' + esc(s.full_name||'') + '</div>' +
        (s.title ? '<div style="font-size:11px;color:var(--text3)">' + esc(s.title) + '</div>' : '') +
        (s.insight && s.insight.tip ? '<div style="font-size:11px;color:var(--text2);margin-top:2px">→ ' + esc(s.insight.tip) + '</div>' : '') +
      '</div>' + insLbl +
      (s.id ? '<span style="color:var(--text3);font-size:14px;flex-shrink:0">›</span>' : '') +
    '</div>';
  }).join('');
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:480px;padding:20px;max-height:85vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
      '<div style="font-size:14px;font-weight:700;color:var(--text)">Who is in this meeting</div>' +
      '<button onclick="document.getElementById(\'mtg-insight-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +
    '<div style="margin-bottom:12px">' + _samoraIntelLabel('Tap a person for how to work with them') + '</div>' +
    (rows || '<div style="font-size:12px;color:var(--text3);padding:16px 0;text-align:center">No matched stakeholders for this meeting yet.</div>') +
  '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);
}

// ── Stakeholder insight: plain-English "how to work with them" ───────────────
// One style chip + up to 5 direct pointers + MEDDPICC flags, receipts on tap.
// Never shows framework jargon. Org-shared cache — one fetch serves the team.
async function openStakeholderInsight(stakeholderId, name, opts) {
  opts = opts || {};
  document.getElementById('stk-insight-modal')?.remove();
  var modal = document.createElement('div');
  modal.id = 'stk-insight-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:480px;padding:20px;max-height:85vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
      '<div style="font-size:14px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z"/></svg> ' + esc(name) + '</div>' +
      '<button onclick="document.getElementById(\'stk-insight-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +
    '<div style="margin-bottom:12px">' + _samoraIntelLabel('Read from their own messages, receipts on tap') + '</div>' +
    '<div id="stk-insight-body"><div style="font-size:12px;color:var(--text3);padding:16px 0;text-align:center">Reading their communication…</div></div>' +
  '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);

  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_stakeholder_insight', stakeholder_id:stakeholderId, refresh:!!opts.refresh, web_research:!!opts.web }) });
    var d = await r.json();
    var body = document.getElementById('stk-insight-body');
    if (!body) return;
    if (!d.ok) { body.innerHTML = '<div style="color:var(--coral);font-size:12px">' + esc(d.error||'Insight unavailable') + '</div>'; return; }

    var h = '';
    if (d.stakeholder && (d.stakeholder.title || d.stakeholder.role)) {
      h += '<div style="font-size:11px;color:var(--text3);margin-bottom:10px">' + esc(d.stakeholder.title||'') + (d.stakeholder.role ? ' · ' + esc(d.stakeholder.role.replace(/_/g,' ')) : '') + '</div>';
    }
    if (d.style) {
      var confLbl = d.style.confidence === 'high' ? 'high confidence' : d.style.confidence === 'moderate' ? 'moderate confidence' : 'early read';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">' +
        '<span style="font-size:13px;font-weight:700;padding:3px 10px;border-radius:var(--r-md);background:rgba(var(--c-accent-rgb),0.12);color:var(--gold)">' + esc(d.style.label) + '</span>' +
        '<span style="font-size:11px;color:var(--text3)">' + confLbl + ' · ' + d.style.messages_scanned + ' messages</span>' +
        '<span onclick="var el=document.getElementById(\'stk-receipts\');el.style.display=el.style.display===\'none\'?\'block\':\'none\'" style="font-size:11px;color:var(--gold);cursor:pointer;text-decoration:underline dotted">why?</span>' +
      '</div>';
      h += '<div id="stk-receipts" style="display:none;background:var(--surface2);border-radius:var(--r-sm);padding:8px 10px;margin-bottom:8px">' +
        (d.style.receipts||[]).map(function(rc){ return '<div style="font-size:11px;color:var(--text2);padding:2px 0">· ' + esc(rc) + '</div>'; }).join('') + '</div>';
    } else if (d.archetype) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:13px;font-weight:700;padding:3px 10px;border-radius:var(--r-md);background:var(--surface2);color:var(--text2)">' + esc(d.archetype.label) + '</span>' +
        '<span style="font-size:11px;color:var(--text3)">based on their role: style not assessed yet (too few messages)</span></div>';
    } else {
      h += '<div style="font-size:12px;color:var(--text3);padding:8px 0">' + esc(d.empty_reason || 'Not enough information yet.') + '</div>';
    }

    if (d.tips && d.tips.length) {
      h += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:10px 0 6px">When talking to them</div>';
      d.tips.forEach(function(tip) {
        h += '<div style="display:flex;gap:7px;padding:5px 0;font-size:12px;color:var(--text)"><span style="color:var(--gold);flex-shrink:0">→</span><span>' + esc(tip) + '</span></div>';
      });
    }
    if (d.meddpicc_flags && d.meddpicc_flags.length) {
      h += '<div style="font-size:11px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.06em;margin:10px 0 6px">Deal gaps this person can close</div>';
      d.meddpicc_flags.forEach(function(f) {
        h += '<div style="display:flex;gap:7px;padding:5px 0;font-size:12px;color:var(--text2)"><span style="color:var(--amber);flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 21V3.5M5.5 4.5h12l-2.5 4 2.5 4h-12"/></svg></span><span>' + esc(f) + '</span></div>';
      });
    }
    if (d.web && d.web.bullets && d.web.bullets.length) {
      h += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:10px 0 6px">Public footprint</div>';
      d.web.bullets.forEach(function(b) { h += '<div style="display:flex;gap:7px;padding:4px 0;font-size:12px;color:var(--text2)"><span style="flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16 16l5 5"/></svg></span><span>' + esc(b) + '</span></div>'; });
      h += '<div style="font-size:11px;color:var(--amber);margin-top:4px">' + esc(d.web.label||'') + '</div>';
    } else if (!d.web) {
      h += '<button onclick="openStakeholderInsight(\'' + esc(stakeholderId) + '\',\'' + esc(name) + '\',{web:true})" style="width:100%;margin-top:12px;padding:8px;border-radius:var(--r-sm);background:none;border:1px dashed var(--border2);color:var(--text3);font-family:var(--sans);font-size:11px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16 16l5 5"/></svg> Check public footprint (uses AI: one search, shared with team)</button>';
    }
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:8px;border-top:1px solid var(--border)">' +
      '<span style="font-size:11px;color:var(--text3)">' + (d.cached ? '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6.5h6l2 2.5h9v11h-17z"/></svg> Shared team read from ' + esc((d.computed_at||'').slice(0,10)) : 'Computed just now') + '</span>' +
      '<span onclick="openStakeholderInsight(\'' + esc(stakeholderId) + '\',\'' + esc(name) + '\',{refresh:true})" style="font-size:11px;color:var(--gold);cursor:pointer">↻ Recompute</span>' +
    '</div>';
    body.innerHTML = h;
  } catch(e) {
    var b = document.getElementById('stk-insight-body');
    if (b) b.innerHTML = '<div style="color:var(--coral);font-size:12px">Error: ' + esc(e.message) + '</div>';
  }
}

// ── SAMpaign contact insight: same "how to work with them" pattern as
// openStakeholderInsight, reused for uploaded/scouted campaign contacts.
// Only real differences: account-collision flag instead of MEDDPICC flags,
// and a "Copy for email" button since this exists to feed a personalised
// outreach draft, not a deal-coaching conversation.
async function openSampaignContactInsight(contactId, name, opts) {
  opts = opts || {};
  document.getElementById('spc-insight-modal')?.remove();
  var modal = document.createElement('div');
  modal.id = 'spc-insight-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:480px;padding:20px;max-height:85vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
      '<div style="font-size:14px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z"/></svg> ' + esc(name) + '</div>' +
      '<button onclick="document.getElementById(\'spc-insight-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +
    '<div style="margin-bottom:12px">' + _samoraIntelLabel('Read from their own messages, receipts on tap') + '</div>' +
    '<div id="spc-insight-body"><div style="font-size:12px;color:var(--text3);padding:16px 0;text-align:center">Reading their communication…</div></div>' +
  '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);

  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_sampaign_contact_insight', contact_id:contactId, refresh:!!opts.refresh, web_research:!!opts.web }) });
    var d = await r.json();
    var body = document.getElementById('spc-insight-body');
    if (!body) return;
    if (!d.ok) { body.innerHTML = '<div style="color:var(--coral);font-size:12px">' + esc(d.error||'Insight unavailable') + '</div>'; return; }

    var h = '';
    if (d.contact && d.contact.title) {
      h += '<div style="font-size:11px;color:var(--text3);margin-bottom:10px">' + esc(d.contact.title||'') + (d.contact.company ? ' · ' + esc(d.contact.company) : '') + '</div>';
    }
    if (d.style) {
      var confLbl = d.style.confidence === 'high' ? 'high confidence' : d.style.confidence === 'moderate' ? 'moderate confidence' : 'early read';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">' +
        '<span style="font-size:13px;font-weight:700;padding:3px 10px;border-radius:var(--r-md);background:rgba(var(--c-accent-rgb),0.12);color:var(--gold)">' + esc(d.style.label) + '</span>' +
        '<span style="font-size:11px;color:var(--text3)">' + confLbl + ' · ' + d.style.messages_scanned + ' messages</span>' +
        '<span onclick="var el=document.getElementById(\'spc-receipts\');el.style.display=el.style.display===\'none\'?\'block\':\'none\'" style="font-size:11px;color:var(--gold);cursor:pointer;text-decoration:underline dotted">why?</span>' +
      '</div>';
      h += '<div id="spc-receipts" style="display:none;background:var(--surface2);border-radius:var(--r-sm);padding:8px 10px;margin-bottom:8px">' +
        (d.style.receipts||[]).map(function(rc){ return '<div style="font-size:11px;color:var(--text2);padding:2px 0">· ' + esc(rc) + '</div>'; }).join('') + '</div>';
    } else if (d.archetype) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:13px;font-weight:700;padding:3px 10px;border-radius:var(--r-md);background:var(--surface2);color:var(--text2)">' + esc(d.archetype.label) + '</span>' +
        '<span style="font-size:11px;color:var(--text3)">based on their title: style not assessed yet (too few messages)</span></div>';
    } else {
      h += '<div style="font-size:12px;color:var(--text3);padding:8px 0">' + esc(d.empty_reason || 'Not enough information yet.') + '</div>';
    }

    if (d.tips && d.tips.length) {
      h += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:10px 0 6px">When talking to them</div>';
      d.tips.forEach(function(tip) {
        h += '<div style="display:flex;gap:7px;padding:5px 0;font-size:12px;color:var(--text)"><span style="color:var(--gold);flex-shrink:0">→</span><span>' + esc(tip) + '</span></div>';
      });
    }
    if (d.account_flags && d.account_flags.length) {
      h += '<div style="font-size:11px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.06em;margin:10px 0 6px">Account context</div>';
      d.account_flags.forEach(function(f) {
        h += '<div style="display:flex;gap:7px;padding:5px 0;font-size:12px;color:var(--text2)"><span style="color:var(--amber);flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 21V3.5M5.5 4.5h12l-2.5 4 2.5 4h-12"/></svg></span><span>' + esc(f) + '</span></div>';
      });
    }
    if (d.web && d.web.bullets && d.web.bullets.length) {
      h += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:10px 0 6px">Public footprint</div>';
      d.web.bullets.forEach(function(b) { h += '<div style="display:flex;gap:7px;padding:4px 0;font-size:12px;color:var(--text2)"><span style="flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16 16l5 5"/></svg></span><span>' + esc(b) + '</span></div>'; });
      h += '<div style="font-size:11px;color:var(--amber);margin-top:4px">' + esc(d.web.label||'') + '</div>';
    } else if (!d.web) {
      h += '<button onclick="openSampaignContactInsight(\'' + esc(contactId) + '\',\'' + esc(name) + '\',{web:true})" style="width:100%;margin-top:12px;padding:8px;border-radius:var(--r-sm);background:none;border:1px dashed var(--border2);color:var(--text3);font-family:var(--sans);font-size:11px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16 16l5 5"/></svg> Check public footprint (uses AI: one search, shared with team)</button>';
    }
    if ((d.tips && d.tips.length) || (d.web && d.web.bullets && d.web.bullets.length)) {
      h += '<button id="spc-copy-btn" onclick="_copySampaignInsight(\'' + esc(contactId) + '\')" style="width:100%;margin-top:10px;padding:8px;border-radius:var(--r-sm);background:rgba(74,158,255,0.08);border:1px solid rgba(74,158,255,0.3);color:var(--blue);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg> Copy for email draft</button>';
    }
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:8px;border-top:1px solid var(--border)">' +
      '<span style="font-size:11px;color:var(--text3)">' + (d.cached ? '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6.5h6l2 2.5h9v11h-17z"/></svg> Shared team read from ' + esc((d.computed_at||'').slice(0,10)) : 'Computed just now') + '</span>' +
      '<span onclick="openSampaignContactInsight(\'' + esc(contactId) + '\',\'' + esc(name) + '\',{refresh:true})" style="font-size:11px;color:var(--gold);cursor:pointer">↻ Recompute</span>' +
    '</div>';
    body.innerHTML = h;
    window._spcInsightData = window._spcInsightData || {};
    window._spcInsightData[contactId] = { name: name, tips: d.tips||[], web: (d.web && d.web.bullets) || [], style: d.style, archetype: d.archetype };
  } catch(e) {
    var b = document.getElementById('spc-insight-body');
    if (b) b.innerHTML = '<div style="color:var(--coral);font-size:12px">Error: ' + esc(e.message) + '</div>';
  }
}

// Plain-text summary of the insight, ready to paste into a compose window.
function _copySampaignInsight(contactId) {
  var d = (window._spcInsightData || {})[contactId];
  if (!d) return;
  var lines = [];
  if (d.style) lines.push('Communication style: ' + d.style.label);
  else if (d.archetype) lines.push('Likely archetype: ' + d.archetype.label);
  if (d.tips && d.tips.length) { lines.push(''); lines.push('When writing to ' + d.name + ':'); d.tips.forEach(function(t){ lines.push('- ' + t); }); }
  if (d.web && d.web.length) { lines.push(''); lines.push('Public footprint:'); d.web.forEach(function(b){ lines.push('- ' + b); }); }
  var text = lines.join('\n');
 navigator.clipboard.writeText(text).then(function(){ showToast('Copied, paste into your draft'); }).catch(function(){ showToast('Could not copy, select the text manually'); });
}

var _stkTab = 'active';
function _stkIsActive(s) { return !!s.last_contacted_at || (s.contact_count || 0) > 0; }

function _stkRowHtml(s) {
  var roleLabels = {champion:'Champion',economic_buyer:'Economic buyer',blocker:'Blocker',decision_maker:'Decision maker',influencer:'Influencer',end_user:'End user',not_relevant:'Not relevant'};
  var roleBgs = {champion:'rgba(74,140,92,0.15)',economic_buyer:'rgba(58,110,168,0.15)',blocker:'rgba(192,82,63,0.15)'};
  var isNR = s.meddpicc_role === 'not_relevant';
  var initials = (s.full_name || '?').split(' ').map(function(w){ return w[0] || ''; }).slice(0,2).join('').toUpperCase();
  var recencyStr = 'Not yet contacted', recencyColor = 'var(--text3)';
  if (s.last_contacted_at) {
    var days = Math.round((Date.now() - new Date(s.last_contacted_at).getTime()) / 86400000);
    if (days <= 0) { recencyStr = 'Today'; recencyColor = 'var(--green)'; }
    else if (days <= 7) { recencyStr = days + 'd ago'; recencyColor = 'var(--green)'; }
    else if (days <= 30) { recencyStr = days + 'd ago'; recencyColor = 'var(--amber)'; }
    else { recencyStr = days + 'd ago'; recencyColor = 'var(--coral)'; }
  }
  var liHref = s.linkedin_url ? s.linkedin_url : ('https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(s.full_name || ''));
  var liOpacity = s.linkedin_url ? (isNR ? '0.4' : '1') : (isNR ? '0.2' : '0.35');
  var roleHtml = (s.meddpicc_role && s.meddpicc_role !== 'not_relevant') ? '<span style="font-size:11px;padding:1px 6px;border-radius:var(--r-sm);background:' + (roleBgs[s.meddpicc_role] || 'rgba(0,0,0,0.06)') + ';color:var(--text2);margin-left:4px">' + esc(roleLabels[s.meddpicc_role] || s.meddpicc_role) + '</span>' : '';
  var deptChip = s.department ? '<span style="font-size:11px;color:var(--text3);background:var(--surface2);border-radius:var(--r-sm);padding:1px 6px;margin-left:4px">' + esc(s.department) + '</span>' : '';
  var html = '<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);opacity:' + (isNR ? '0.45' : '1') + '">';
  html += '<div style="width:34px;height:34px;border-radius:50%;background:var(--surface2);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--text2);flex-shrink:0">' + esc(initials) + '</div>';
  html += '<div style="flex:1;min-width:0">';
  html += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;flex-wrap:wrap">';
  html += '<span style="font-size:13px;font-weight:500;color:var(--text)">' + esc(s.full_name || '') + '</span>';
  html += '<a href="' + esc(liHref) + '" target="_blank" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;color:#0A66C2;opacity:' + liOpacity + ';text-decoration:none"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>';
  html += roleHtml + deptChip;
  html += '</div>';
  var titleStr = s.title ? esc(s.title) : '<span style="color:var(--border2);font-style:italic">No title</span>';
  var locStr = s.location ? ' &nbsp;·&nbsp; <span><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 21V3.5M5.5 4.5h12l-2.5 4 2.5 4h-12"/></svg> ' + esc(s.location) + '</span>' : '';
  html += '<div style="font-size:11px;color:var(--text3);margin-bottom:4px">' + titleStr + locStr + '</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  html += '<span style="font-size:11px;color:' + recencyColor + '"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> ' + recencyStr + '</span>';
  if (s.contact_count > 0) html += '<span style="font-size:11px;color:var(--text3)">' + s.contact_count + ' emails</span>';
  html += '</div></div>';
  html += '<select onchange="saveStakeholderRole(\'' + s.id + '\',this.value)" style="font-size:11px;padding:3px 6px;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--border2);color:var(--text2);font-family:var(--sans);flex-shrink:0">';
  ['','champion','economic_buyer','decision_maker','influencer','blocker','end_user','not_relevant'].forEach(function(rv){
    html += '<option value="' + rv + '"' + (s.meddpicc_role === rv ? ' selected' : '') + '>' + (rv ? (roleLabels[rv] || rv) : 'Set role…') + '</option>';
  });
  html += '</select>';
  html += _samoraIntelBtn('openStakeholderInsight(\'' + s.id + '\',\'' + esc(s.full_name||'') + '\')', true);
  html += '</div>';
  return html;
}

function _renderStakeholdersPane(stakeholders, deal) {
  var body = document.getElementById('deal-detail-body'); if (!body) return;
  window._stkDeal = deal;
  window._stkAll = stakeholders || [];
  var all = window._stkAll;
  var active = all.filter(_stkIsActive);
  var prospective = all.filter(function(s){ return !_stkIsActive(s); });
  var list = _stkTab === 'active' ? active : prospective;

  var tab = function(key, label, n) {
    var on = _stkTab === key;
    return '<span onclick="setStkTab(\'' + key + '\')" style="padding:6px 12px;cursor:pointer;font-size:12px;font-weight:600;border-bottom:2px solid ' + (on?'var(--gold)':'transparent') + ';color:' + (on?'var(--text)':'var(--text3)') + '">' + label + ' <span style="font-size:11px;color:var(--text3)">' + n + '</span></span>';
  };
  var html = '<div style="display:flex;gap:6px;border-bottom:1px solid var(--border2);margin-bottom:12px">' +
    tab('active','Active', active.length) + tab('prospective','Prospective', prospective.length) + '</div>';

  // ── TWO MEANINGS OF "ACTIVE", AGAIN ─────────────────────────────────
  // This tab counts anyone with interaction EVER. Coverage counts anyone
  // contacted in the LAST 30 DAYS. So this pane said "Active 20" while
  // coverage said "0 of 20 contacts active" on the same account, and both
  // were right. Show the 30-day number here so the two reconcile on screen
  // instead of looking like a bug.
  var recent30 = active.filter(function(s) {
    if (!s.last_contacted_at) return false;
    return (Date.now() - new Date(s.last_contacted_at).getTime()) / 86400000 <= 30;
  }).length;

  if (_stkTab === 'active') {
    html += '<div style="font-size:11px;color:var(--text3);margin-bottom:10px">People with real interaction: replies, calendar invites, and anyone on the thread. <strong>' + recent30 + ' of ' + active.length + '</strong> in the last 30 days, which is the number coverage counts.</div>';
  } else {
    html += '<div style="font-size:11px;color:var(--text3);margin-bottom:10px">People reached out to or scouted, not yet interacting. They move to Active once they engage.</div>';
  }

  if (!list.length) {
    html += '<div style="padding:14px 0;text-align:center;font-size:12px;color:var(--text3)">' + (_stkTab === 'active' ? 'No active contacts yet. Sync recent activity or find contacts below.' : 'No prospects yet. Scout stakeholders for this account below.') + '</div>';
  } else {
    var sorted = list.slice().sort(function(a,b){
      if (a.meddpicc_role && a.meddpicc_role !== 'not_relevant' && !(b.meddpicc_role && b.meddpicc_role !== 'not_relevant')) return -1;
      if (b.meddpicc_role && b.meddpicc_role !== 'not_relevant' && !(a.meddpicc_role && a.meddpicc_role !== 'not_relevant')) return 1;
      var da = a.last_contacted_at || '0', db = b.last_contacted_at || '0';
      return da > db ? -1 : da < db ? 1 : 0;
    });
    sorted.forEach(function(s){ html += _stkRowHtml(s); });
  }

  var dealId = deal && deal.id || '';
  if (_stkTab === 'active') {
    html += '<button onclick="enrichDeal(\'' + esc(dealId) + '\',\'' + esc(deal && deal.account || '') + '\')" id="enrichDealBtn" style="width:100%;margin-top:12px;padding:10px;border-radius:var(--r-sm);background:var(--surface2);border:1px dashed var(--border2);color:var(--text2);font-family:var(--sans);font-size:12px;cursor:pointer">' + _samoraIntelLabel('Find &amp; enrich contacts from activity') + '</button>';
    html += '<div id="enrichDealStatus" style="font-size:11px;color:var(--text3);margin-top:6px"></div>';
    html += '<button onclick="syncActiveStakeholders(\'' + esc(dealId) + '\')" id="syncActiveBtn" style="width:100%;margin-top:6px;padding:8px;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:11px;cursor:pointer">↻ Sync recent contacts from Gmail &amp; calendar</button>';
    html += '<div id="stkAutoSyncNote" style="font-size:11px;color:var(--text3);margin-top:6px"></div>';
  } else {
    html += '<button onclick="scoutStakeholders(\'' + esc(dealId) + '\')" id="scoutBtn" style="width:100%;margin-top:12px;padding:10px;border-radius:var(--r-sm);background:rgba(var(--c-accent-rgb),0.08);border:1px solid rgba(var(--c-accent-rgb),0.4);color:var(--gold);font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer">' + _samoraIntelLabel('Scout stakeholders for this account') + '</button>';
    html += '<div id="scoutStatus" style="font-size:11px;color:var(--text3);margin-top:6px"></div>';
    html += '<div onclick="openScoutProfile(\'' + esc(dealId) + '\')" style="font-size:11px;color:var(--text3);text-align:center;margin-top:8px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Who to hunt (job titles &amp; targets)</div>';
  }
  body.innerHTML = html;

  // Fire and forget: if the account has proven contact that no person is
  // attached to, map it now rather than waiting for someone to press a button.
  if (_stkTab === 'active') { _autoMapActivityToStakeholders(deal, all); }
}

function setStkTab(t) { _stkTab = t; _renderStakeholdersPane(window._stkAll, window._stkDeal); }

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-MAP ACTIVITY TO PEOPLE
//
// There was no auto-refresh for stakeholders. sync_active_stakeholders only
// ever ran from the "Sync recent contacts" button, so an account could show
// verified two-way contact yesterday and still list nobody who had spoken.
// That is how Ferrero's procurement manager could agree commercial terms and
// not appear in the contact list at all.
//
// The account already knows last_verified_contact, written by the scan from
// real two-way email. If that is MORE RECENT than the newest contact date on
// any known stakeholder, there is activity nobody is mapped to, and that is a
// fact, not a guess. So run the sync, once per account per session, rather
// than waiting for someone to notice and press a button.
//
// Once per session because it costs Gmail calls. Not on a timer, because the
// signal that it is needed is precisely this mismatch.
// ═══════════════════════════════════════════════════════════════════════════
window._stkAutoSynced = window._stkAutoSynced || {};

async function _autoMapActivityToStakeholders(deal, stakeholders) {
  if (!deal || !deal.id) return false;
  if (window._stkAutoSynced[deal.id]) return false;

  // The backend computes this: it has both the account's proven-contact date
  // and every stakeholder's last_contacted_at, so the rule lives in one place.
  if (!window._stkUnmapped) return false;

  window._stkAutoSynced[deal.id] = true;
  var note = document.getElementById('stkAutoSyncNote');
  if (note) note.textContent = 'Activity here is not mapped to anyone yet, matching it to people…';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'sync_active_stakeholders', account_id: deal.id, days: 90 }) });
    var d = await r.json();
    if (d && d.ok && d.discovered) {
      if (note) note.textContent = 'Matched ' + d.discovered + ' contact' + (d.discovered === 1 ? '' : 's') + ' from recent activity.';
      window._stkUnmapped = false;   // _reloadStakeholders sets it again from the server
      _reloadStakeholders(deal.id);
      return true;
    }
    window._stkUnmapped = false;     // asked and answered, do not loop
    // Nothing found is a real answer, not a failure. Say so rather than
    // leaving a spinner that implies work is still happening.
    if (note) note.textContent = d && d.ok
      ? 'Recent activity could not be matched to anyone at this domain.'
      : ((d && d.error) || 'Could not check recent activity.');
  } catch (e) {
    if (note) note.textContent = 'Could not check recent activity.';
  }
  return false;
}

async function _reloadStakeholders(dealId) {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({ action:'get_stakeholders', account_id:dealId }) });
    var d = await r.json();
    var stk = d.stakeholders || [];
    window._stkUnmapped = !!d.unmapped_activity;
    if (_currentDealDetail) _currentDealDetail.stakeholders = stk;
    _renderStakeholdersPane(stk, window._stkDeal || (_currentDealDetail && _currentDealDetail.deal));
  } catch(e) {}
}

async function syncActiveStakeholders(dealId) {
  var st = document.getElementById('syncActiveBtn'); if (st) { st.textContent = '↻ Scanning Gmail & calendar…'; st.disabled = true; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({ action:'sync_active_stakeholders', account_id:dealId, days:90 }) });
    var d = await r.json();
    if (!d.ok) { if (st){st.textContent='↻ Sync recent contacts from Gmail & calendar';st.disabled=false;} showToast(d.error || 'Sync unavailable'); return; }
 showToast(d.discovered ? '' + d.discovered + ' contact' + (d.discovered!==1?'s':'') + ' synced' : 'No new recent contacts found');
    _stkTab = 'active';
    _reloadStakeholders(dealId);
  } catch(e) { if (st){st.textContent='↻ Sync recent contacts from Gmail & calendar';st.disabled=false;} showToast('Error: ' + e.message); }
}

async function scoutStakeholders(dealId) {
  var st = document.getElementById('scoutStatus'); if (st) st.innerHTML = '<span style="color:var(--gold)">Scouting stakeholders by your scout profile…</span>';
  var btn = document.getElementById('scoutBtn'); if (btn) btn.disabled = true;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({ action:'scout_stakeholders', account_id:dealId }) });
    var d = await r.json();
    if (btn) btn.disabled = false;
    if (!d.ok) { if (st) st.innerHTML = '<span style="color:var(--coral)">' + esc(d.error || 'Scout unavailable') + '</span>'; return; }
    if (!d.scouted) { if (st) st.innerHTML = '<span style="color:var(--text3)">' + esc(d.error || 'No new prospects found for this profile.') + '</span>'; return; }
 showToast('' + d.scouted + ' prospect' + (d.scouted!==1?'s':'') + ' scouted via ' + (d.provider||'enrichment'));
    _stkTab = 'prospective';
    _reloadStakeholders(dealId);
  } catch(e) { if (btn) btn.disabled = false; if (st) st.innerHTML = '<span style="color:var(--coral)">Error: ' + esc(e.message) + '</span>'; }
}

var _SCOUT_DEPTS = ['Sales','Strategy','Marketing','HR','Finance','Operations','IT','Product','Engineering'];
var _SCOUT_SENIORITIES = ['Mid','Senior','Leadership','CXO'];
var _scoutAcctId = null;
async function openScoutProfile(accountId) {
  _scoutAcctId = accountId || null;
  document.getElementById('scout-profile-modal')?.remove();
  var orgP = { departments: ['Sales','Marketing','Strategy'], seniorities: ['Senior','Leadership','CXO'], jobTitles: [], locations: [] };
  var acctP = null;
  try {
    var reqs = [ fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({ action:'get_org_setting', key:'stakeholder_scout_profile' }) }).then(function(r){return r.json();}) ];
    if (accountId) reqs.push(fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({ action:'get_org_setting', key:'scout_profile_'+accountId }) }).then(function(r){return r.json();}));
    var res = await Promise.all(reqs);
    if (res[0] && res[0].value) { var p = JSON.parse(res[0].value); ['departments','seniorities','jobTitles','locations'].forEach(function(k){ if (Array.isArray(p[k])) orgP[k] = p[k]; }); }
    if (res[1] && res[1].value) { try { var ap = JSON.parse(res[1].value); if (ap && (ap.departments||ap.seniorities||ap.jobTitles||ap.locations)) acctP = ap; } catch(e){} }
  } catch(e) {}
  var usingAcct = !!acctP;                 // per-account override exists → edit that
  var cur = acctP || orgP;
  var chip = function(group, val, on) {
    return '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:5px 10px;border-radius:var(--r-md);border:1px solid ' + (on?'var(--gold)':'var(--border2)') + ';background:' + (on?'rgba(var(--c-accent-rgb),0.08)':'transparent') + ';color:' + (on?'var(--gold)':'var(--text2)') + ';cursor:pointer;margin:0 6px 6px 0"><input type="checkbox" data-group="' + group + '" value="' + val + '"' + (on?' checked':'') + ' style="margin:0">' + val + '</label>';
  };
  var inputStyle = 'width:100%;padding:9px 11px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:13px;font-family:var(--sans);outline:none';
  var modal = document.createElement('div');
  modal.id = 'scout-profile-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:520px;padding:20px;max-height:85vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div style="font-size:14px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Who to hunt</div><button onclick="document.getElementById(\'scout-profile-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    (accountId ? '<label style="display:flex;align-items:center;gap:8px;margin:8px 0 12px;cursor:pointer"><input type="checkbox" id="scout-acct-toggle"' + (usingAcct?' checked':'') + ' style="width:15px;height:15px;accent-color:var(--gold)"><span style="font-size:12px;color:var(--text2)">Custom targets for <b>this account only</b> (otherwise edits the org default)</span></label>' : '<div style="font-size:12px;color:var(--text3);margin-bottom:12px">Org default targets. Applies to every account unless overridden.</div>') +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Job titles (primary, comma separated)</div>' +
    '<textarea id="scout-titles" rows="2" placeholder="e.g. CFO, Chief Financial Officer, VP Finance, Head of Procurement, Owner" style="' + inputStyle + ';resize:vertical;height:54px">' + esc((cur.jobTitles||[]).join(', ')) + '</textarea>' +
    '<div style="font-size:11px;color:var(--text3);margin:4px 0 12px">These match real titles at the account. Leave blank to use departments + seniority.</div>' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Departments</div>' +
    '<div style="margin-bottom:14px">' + _SCOUT_DEPTS.map(function(x){ return chip('dept', x, (cur.departments||[]).indexOf(x) !== -1); }).join('') + '</div>' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Seniority</div>' +
    '<div style="margin-bottom:14px">' + _SCOUT_SENIORITIES.map(function(x){ return chip('sen', x, (cur.seniorities||[]).indexOf(x) !== -1); }).join('') + '</div>' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Locations (optional, comma separated)</div>' +
    '<input id="scout-locs" value="' + esc((cur.locations||[]).join(', ')) + '" placeholder="e.g. Italy, Europe" style="' + inputStyle + ';margin-bottom:16px"/>' +
    '<button onclick="saveScoutProfile()" style="width:100%;padding:12px;border:none;border-radius:var(--r-md);background:var(--gold);color:var(--c-canvas);font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans)">Save</button>' +
  '</div>';
  modal.addEventListener('click', function(){ modal.remove(); });
  document.body.appendChild(modal);
}

async function saveScoutProfile() {
  var depts = [], sens = [];
  document.querySelectorAll('#scout-profile-modal input[type=checkbox][data-group]').forEach(function(c){
    if (!c.checked) return;
    if (c.getAttribute('data-group') === 'dept') depts.push(c.value); else sens.push(c.value);
  });
  var csv = function(id){ var el = document.getElementById(id); return el ? el.value.split(',').map(function(x){return x.trim();}).filter(Boolean) : []; };
  var profile = { departments: depts, seniorities: sens, jobTitles: csv('scout-titles'), locations: csv('scout-locs') };
  var perAccount = !!(document.getElementById('scout-acct-toggle') && document.getElementById('scout-acct-toggle').checked);
  try {
    if (perAccount && _scoutAcctId) {
      await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'save_org_setting', key:'scout_profile_'+_scoutAcctId, value: JSON.stringify(profile) }) });
 showToast('Custom targets saved for this account');
    } else {
      // Saving the org default. If a per-account override existed, clear it so
      // this account follows the default again.
      // Sequential on purpose: the org default is now limited to managers and
      // admins, and the per-account override must survive a refused default.
      var _r0 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'save_org_setting', key:'stakeholder_scout_profile', value: JSON.stringify(profile) }) });
      var _d0 = await _r0.json().catch(function(){ return {}; });
      if (!_d0.ok) { showToast(_d0.error || 'Could not save the organisation default.'); return; }
      if (_scoutAcctId) await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'save_org_setting', key:'scout_profile_'+_scoutAcctId, value: JSON.stringify({}) }) });
 showToast('Org default targets saved');
    }
    document.getElementById('scout-profile-modal')?.remove();
  } catch(e) { showToast('Error: ' + e.message); }
}


function _renderMeddpiccPane(m, deal) {
  var body = document.getElementById('deal-detail-body'); if (!body||!deal) return;
  // Auto-infer button — rules-based, reads from call transcripts, no AI needed
  var autoInferBtn = '<div style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">' +
    '<div style="font-size:11px;color:var(--text3)">Edit fields or auto-fill from call transcripts</div>' +
    '<button onclick="inferMeddpiccFromTranscripts(\'' + esc(deal.id) + '\').then(function(d){if(d&&d.ok){_loadDealDetailData(\'' + esc(deal.id) + '\',{id:\'' + esc(deal.id) + '\',account:\'' + esc(deal.account) + '\'})}})" style="padding:5px 10px;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--border2);color:var(--text2);font-family:var(--sans);font-size:11px;cursor:pointer">' + _samoraIntelLabel('Auto-fill from calls') + '</button>' +
  '</div>';
  var fields = [
    {key:'metrics',letter:'M',label:'Metrics',valKey:'metrics_value',hint:'What measurable outcome does the buyer want?'},
    {key:'economic_buyer',letter:'E',label:'Economic buyer',valKey:'economic_buyer_name',hint:'Who has final budget authority?'},
    {key:'decision_criteria',letter:'D',label:'Decision criteria',valKey:'decision_criteria_value',hint:'How will they evaluate solutions?'},
    {key:'decision_process',letter:'D',label:'Decision process',valKey:'decision_process_value',hint:'Who approves, in what order?'},
    {key:'paper_process',letter:'P',label:'Paper process',valKey:'paper_process_value',hint:'Legal, procurement, security needed?'},
    {key:'identified_pain',letter:'I',label:'Identified pain',valKey:'identified_pain_value',hint:'What specific problem are they solving?'},
    {key:'champion',letter:'C',label:'Champion',valKey:'champion_name',hint:'Who internally advocates for this deal?'},
    {key:'competition',letter:'C',label:'Competition',valKey:'competition_value',hint:'What other options are they evaluating?'},
  ];
  var statusColors = {confirmed:'var(--green)',partial:'var(--amber)',missing:'var(--coral)',unknown:'var(--text3)'};
  var html = autoInferBtn;
  fields.forEach(function(f) {
    var status = m ? (m[f.key+'_status']||'unknown') : 'unknown';
    var value  = m ? (m[f.valKey]||'') : '';
    html += '<div style="background:var(--surface2);border-radius:var(--r-sm);padding:10px 12px;margin-bottom:7px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
        '<span style="font-size:11px;color:var(--text3);font-weight:700;min-width:14px">'+f.letter+'</span>' +
        '<span style="font-size:12px;font-weight:500;color:var(--text);flex:1">'+f.label+'</span>' +
        '<select onchange="saveMeddpiccField(\''+deal.id+'\',\''+f.key+'_status\',this.value)" style="font-size:11px;padding:2px 5px;border-radius:var(--r-sm);background:var(--surface);border:1px solid var(--border2);color:'+statusColors[status]+';font-family:var(--sans)">' +
          ['unknown','confirmed','partial','missing'].map(function(o){ return '<option value="'+o+'"'+(status===o?' selected':'')+' style="color:var(--text)">'+o+'</option>'; }).join('') +
        '</select>' +
      '</div>' +
      '<input type="text" id="mf-'+f.valKey+'" value="'+esc(value)+'" placeholder="'+esc(f.hint)+'" ' +
        'oninput="_meddpiccChanged(\'' + deal.id + '\')" ' +
        'onblur="saveMeddpiccField(\'' + deal.id + '\',\'' + f.valKey + '\',this.value)" ' +
        'style="width:100%;padding:6px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-family:var(--sans);font-size:12px;outline:none"/>' +
    '</div>';
  });
  // Save All button + status indicator
  html += '<div style="margin-top:12px;display:flex;align-items:center;gap:8px">';
  html += '<button id="meddpiccSaveBtn" onclick="_saveAllMeddpicc(\''+deal.id+'\')" style="padding:9px 18px;border-radius:var(--r-sm);background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer">Save changes</button>';
  html += '<span id="meddpiccSaveStatus" style="font-size:11px;color:var(--text3)"></span>';
  html += '</div>';
  body.innerHTML = html;
}

async function saveStakeholderRole(id, role) {
  await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'save_stakeholder_role', stakeholder_id:id, role}) });
  showToast('Role saved');
}

async function saveMeddpiccField(accountId, field, value) {
  var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'save_meddpicc', account_id:accountId, fields:{[field]:value}}) });
  var d = await r.json();
  if (d.ok) {
    var st = document.getElementById('meddpiccSaveStatus');
 if (st) { st.textContent = 'Saved'; st.style.color = 'var(--green)'; setTimeout(function(){ st.textContent=''; }, 2000); }
  }
}

var _meddpiccDirty = false;
function _meddpiccChanged(accountId) {
  _meddpiccDirty = true;
  var st = document.getElementById('meddpiccSaveStatus');
  if (st) { st.textContent = 'Unsaved changes'; st.style.color = 'var(--amber)'; }
}

// ── Health score weights ──────────────────────────────────────────────────────
function _updateHwTotal() {
  var ids = ['hw-signal','hw-meddpicc','hw-recency','hw-champion','hw-close'];
  var total = ids.reduce(function(s,id){ return s + (parseInt(document.getElementById(id)?.value||'0')||0); }, 0);
  var el = document.getElementById('hw-total');
  if (el) { el.textContent = String(total); el.style.color = total===100?'var(--green)':'var(--coral)'; }
  return total;
}

async function saveHealthWeights() {
  var total = _updateHwTotal();
  if (total !== 100) { showToast('Weights must add up to 100 (currently ' + total + ')'); return; }
  var weights = {
    signal:   parseInt(document.getElementById('hw-signal')?.value||'30'),
    meddpicc: parseInt(document.getElementById('hw-meddpicc')?.value||'25'),
    recency:  parseInt(document.getElementById('hw-recency')?.value||'20'),
    champion: parseInt(document.getElementById('hw-champion')?.value||'10'),
    close:    parseInt(document.getElementById('hw-close')?.value||'15')
  };
  var st = document.getElementById('hw-status');
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'save_org_setting', key:'health_score_weights', value:JSON.stringify(weights)}) });
    var d = await r.json();
 if (d.ok) { showToast('Health weights saved'); if(st){st.textContent='Saved';st.style.color='var(--green)';setTimeout(function(){st.textContent='';},3000);} }
  } catch(e) { showToast('Error: ' + e.message); }
}

// ── Org notification rules ────────────────────────────────────────────────────
// Configurable per organisation. Stored in org_settings key `notification_rules`
// (reused generic save_org_setting / get_org_setting). Every future push trigger
// reads these before firing, so each org decides what it gets notified about.
var NOTIFICATION_RULE_DEFAULTS = {
  version: 1,
  enabled: true,
  quiet_hours: { enabled: true, start: 21, end: 8 },   // local hours; no pushes in window
  weekly_digest: { enabled: true, day: 1, hour: 8 },    // day 0=Sun..6=Sat
  rules: {
    weekly_check_at_risk:        { enabled: true,  min_value_k: 0 },
    deal_gone_dark:              { enabled: true,  days: 14, min_value_k: 25 },
    champion_missing_near_close: { enabled: true,  days_to_close: 30 },
    competitor_risk:             { enabled: true },
    momentum_drop:               { enabled: true,  points: 5 },
    ooo_reengage:                { enabled: true },
    manager_rollup:              { enabled: false }
  }
};
var NOTIF_RULE_META = [
  { key:'weekly_check_at_risk', icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg>', label:'Account flips to at-risk', desc:'When the Weekly Check verdict turns At risk, alert the account owner.', params:[{ key:'min_value_k', label:'Only if deal ≥', suffix:'k$', def:0 }] },
  { key:'deal_gone_dark', icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5.2l3.2 2"/></svg>', label:'Open deal goes quiet', desc:'No contact logged on an open deal for a while.', params:[{ key:'days', label:'After', suffix:'days', def:14 },{ key:'min_value_k', label:'Deal ≥', suffix:'k$', def:25 }] },
  { key:'champion_missing_near_close', icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M9.5 20h5M12 14v6"/></svg>', label:'Closing soon without a champion', desc:'Expected close is near and no champion is tagged.', params:[{ key:'days_to_close', label:'Within', suffix:'days', def:30 }] },
  { key:'competitor_risk', icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l9 9M20 4l-9 9M4 20l5-5M20 20l-5-5"/></svg>', label:'Competitor active in account', desc:'A competitor is mentioned alongside pricing or risk signals.', params:[] },
  { key:'momentum_drop', icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/></svg>', label:'Signal momentum drops', desc:'Signal score falls over a 7 day window.', params:[{ key:'points', label:'By ≥', suffix:'pts', def:5 }] },
  { key:'ooo_reengage', icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg>', label:'Contact out-of-office ends', desc:'Nudge the owner to re-engage when a contact returns.', params:[] },
  { key:'manager_rollup', icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11.5a4 4 0 100-8 4 4 0 000 8zM4.5 20.5v-1A5.5 5.5 0 0110 14h4a5.5 5.5 0 015.5 5.5v1"/></svg>', label:'Manager team at-risk summary', desc:'Managers get a digest of their team\'s at-risk accounts.', params:[] }
];
var _notificationRulesCache = null;
function _mergeNotifRules(saved) {
  var base = JSON.parse(JSON.stringify(NOTIFICATION_RULE_DEFAULTS));
  if (!saved || typeof saved !== 'object') return base;
  base.enabled = saved.enabled !== false;
  if (saved.quiet_hours) base.quiet_hours = Object.assign(base.quiet_hours, saved.quiet_hours);
  if (saved.weekly_digest) base.weekly_digest = Object.assign(base.weekly_digest, saved.weekly_digest);
  if (saved.rules) Object.keys(base.rules).forEach(function(k){ if (saved.rules[k]) base.rules[k] = Object.assign(base.rules[k], saved.rules[k]); });
  return base;
}
function _chk(id, on) { return '<input type="checkbox" id="'+id+'"'+(on?' checked':'')+' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer">'; }
function _num(id, val, w) { return '<input type="number" id="'+id+'" value="'+(val==null?'':val)+'" style="width:'+(w||48)+'px;padding:5px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-family:var(--sans);font-size:12px;outline:none">'; }
