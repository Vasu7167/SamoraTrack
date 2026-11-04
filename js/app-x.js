// SamoraOS app: Drop X (4 Nov 2026).
//   1. Who a SAMpaign finds, said on the SAMpaign, and people found before a
//      change of titles marked as such.
//   2. Demo SAMpaigns from a prospect's website (Samora staff only).
//   3. English beside every email and LinkedIn note or message in another
//      language, with Edit in English.
//   4. Rewrite with SAM on every queued email, not only drafts.
//   5. Writing that finishes in one click: the server writes, the app shows
//      progress in a dock that survives refresh and a closed tab.
// Loaded after app-safety.js.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function call(action, body) { return _sampEdge(action, body || {}); }
  function toast(m) { try { showToast(m); } catch (_e) {} }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (_e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_e) {} }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function signedIn() { try { return typeof currentUser !== 'undefined' && !!currentUser && !!currentUser.token; } catch (_e) { return false; } }
  function narrow() { return window.matchMedia && window.matchMedia('(max-width: 640px)').matches; }
  var IC = {
    spark: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.9L19 9.7l-4.2 3 1.4 5.3L12 15l-4.2 3 1.4-5.3L5 9.7l5.2-1.8z"/></svg>',
    globe: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    tick: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    pen: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3z"/></svg>',
    target: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/></svg>',
    demo: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'
  };

  // ── Styles ──────────────────────────────────────────────────────────────
  (function css() {
    if (document.getElementById('xCss')) return;
    var st = document.createElement('style'); st.id = 'xCss';
    st.textContent = [
      // the writing dock
      '.xj-dock{position:fixed;right:18px;bottom:18px;z-index:1200;display:flex;flex-direction:column;gap:8px;width:340px;max-width:calc(100vw - 32px)}',
      '@media (max-width:640px){.xj-dock{right:16px;left:16px;width:auto;bottom:calc(72px + env(safe-area-inset-bottom,0px))}}',
      '.xj-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.14),0 2px 6px rgba(0,0,0,.06);padding:12px 14px;animation:xjIn .22s cubic-bezier(.2,.8,.2,1)}',
      '@keyframes xjIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
      '.xj-h{display:flex;align-items:flex-start;gap:10px}',
      '.xj-ic{flex-shrink:0;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(var(--c-accent-rgb),.13);color:var(--gold)}',
      '.xj-ic.ok{background:var(--c-verified-wash,rgba(30,107,58,.1));color:var(--green)}.xj-ic.wait{background:var(--c-partial-wash,rgba(184,134,11,.12));color:var(--amber)}.xj-ic.bad{background:var(--c-risk-wash,rgba(179,38,30,.08));color:var(--coral)}',
      '.xj-t{font-size:13px;font-weight:700;color:var(--text);line-height:1.3}',
      '.xj-s{font-size:11.5px;color:var(--text3);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.xj-x{margin-left:auto;flex-shrink:0;border:none;background:none;color:var(--text3);cursor:pointer;padding:4px;border-radius:6px;display:flex}',
      '.xj-x:hover{background:var(--bg)}',
      '.xj-bar{height:5px;border-radius:999px;background:var(--border);overflow:hidden;margin:10px 0 6px}',
      '.xj-bar i{display:block;height:100%;background:linear-gradient(90deg,#B8860B,#E8B84B,#C8961E);border-radius:999px;transition:width .5s cubic-bezier(.2,.8,.2,1)}',
      '.xj-bar.run i{background-size:200% 100%;animation:xjSh 1.6s linear infinite}',
      '@keyframes xjSh{to{background-position:-200% 0}}',
      '.xj-m{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--text2)}',
      '.xj-n{font-size:12px;color:var(--text2);line-height:1.5;margin-top:8px}',
      '.xj-f{margin-top:8px;border-top:1px solid var(--border);padding-top:8px;display:flex;flex-direction:column;gap:4px;max-height:140px;overflow:auto}',
      '.xj-f div{font-size:11.5px;color:var(--text2)}.xj-f b{color:var(--text);font-weight:600}',
      '.xj-a{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}',
      '.xb{font-family:inherit;font-size:11.5px;font-weight:600;padding:5px 11px;border-radius:8px;border:1px solid var(--border2);background:var(--surface);color:var(--text);cursor:pointer;line-height:1.3;display:inline-flex;align-items:center;gap:6px}',
      '.xb:hover{border-color:var(--text3)}.xb.gold{background:var(--gold);border-color:var(--gold);color:var(--c-on-accent,#fff)}.xb.ghost{border-color:transparent;background:none;color:var(--text3)}.xb:disabled{opacity:.55;cursor:default}',
      '.xb:focus-visible,.xj-x:focus-visible,.x-seg button:focus-visible{outline:2px solid var(--gold);outline-offset:1px}',
      // English beside
      '.x-bi{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}',
      '.x-bi>.x-src{min-width:0}',
      '.x-en{border:1px solid var(--border);border-radius:10px;background:var(--bg);padding:10px 12px;min-width:0}',
      '.x-enh{display:flex;align-items:center;gap:7px;margin-bottom:6px;flex-wrap:wrap}',
      '.x-enl{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);display:inline-flex;align-items:center;gap:5px}',
      '.x-st{font-size:10.5px;font-weight:700;border-radius:999px;padding:2px 8px;border:1px solid var(--border)}',
      '.x-st.stale{color:var(--amber);border-color:var(--amber);background:var(--c-partial-wash,transparent)}.x-st.missing{color:var(--text3)}',
      '.x-ens{font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:4px}',
      '.x-enb{font-size:12.5px;color:var(--text2);line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.x-enb.stale{opacity:.6}',
      '.x-ena{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}',
      '.x-ent{width:100%;box-sizing:border-box;border:1px solid var(--border2);border-radius:8px;background:var(--surface);color:var(--text);font:inherit;font-size:12.5px;line-height:1.55;padding:8px 10px;resize:vertical;min-height:90px}',
      '.x-ent.sub{min-height:0;font-weight:600;margin-bottom:6px}',
      '.x-seg{display:none;border:1px solid var(--border2);border-radius:10px;padding:2px;gap:2px;background:var(--bg);margin-bottom:8px;width:max-content}',
      '.x-seg button{font-family:inherit;font-size:12px;font-weight:600;border:none;background:none;color:var(--text2);padding:5px 12px;border-radius:8px;cursor:pointer}',
      '.x-seg button.on{background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.12)}',
      '@media (max-width:640px){.x-bi{grid-template-columns:1fr}.x-seg{display:inline-flex}.x-bi[data-show="src"]>.x-en{display:none}.x-bi[data-show="en"]>.x-src{display:none}}',
      '.x-lien{margin-top:6px;border-left:3px solid rgba(var(--c-accent-rgb),.45);padding:4px 0 4px 10px;font-size:12px;color:var(--text2);line-height:1.5}',
      '.x-lien .x-enl{margin-right:6px}',
      // targeting and demo
      '.x-tg{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;color:var(--text2);border:1px solid var(--border);border-radius:10px;padding:8px 12px;background:var(--surface);margin:0 0 12px}',
      '.x-tg .x-tgi{color:var(--gold);display:flex}.x-tg b{color:var(--text)}',
      '.x-tg .x-src{font-size:11px;font-weight:700;color:var(--text3);border:1px solid var(--border);border-radius:999px;padding:1px 8px}',
      '.x-tg .x-src.own{color:var(--green);border-color:var(--green)}.x-tg .x-src.demo{color:var(--gold);border-color:var(--gold)}',
      '.x-lnk{border:none;background:none;color:var(--c-accent-text,var(--gold));font:inherit;font-size:12px;font-weight:600;cursor:pointer;padding:0;margin-left:auto}',
      '.x-earlier{font-size:10.5px;font-weight:700;color:var(--text3);border:1px dashed var(--border2);border-radius:999px;padding:1px 7px;margin-left:6px;white-space:nowrap}',
      '.x-demo{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-radius:12px;padding:10px 14px;margin:10px 0 0;background:linear-gradient(90deg,rgba(184,134,11,.10),rgba(232,184,75,.06));border:1px solid rgba(var(--c-accent-rgb),.35)}',
      '.x-demo .x-di{color:var(--gold);display:flex}.x-demo b{color:var(--text)}.x-demo .x-dd{font-size:12px;color:var(--text2);flex:1;min-width:180px}',
      '.x-chip-demo{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gold);background:rgba(var(--c-accent-rgb),.12);border-radius:999px;padding:2px 8px;margin-left:8px;vertical-align:middle}',
      // demo setup
      '.x-dm{position:fixed;inset:0;z-index:1300;background:rgba(10,8,4,.45);display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px;overflow:auto}',
      '.x-dmc{background:var(--surface);border-radius:16px;width:100%;max-width:680px;box-shadow:0 24px 60px rgba(0,0,0,.25);padding:22px 22px 18px;animation:xjIn .2s ease-out}',
      '.x-dmc h3{margin:0 0 4px;font-size:18px;color:var(--text)}',
      '.x-dmc .x-sub{font-size:12.5px;color:var(--text2);line-height:1.5;margin-bottom:14px}',
      '.x-row{display:flex;gap:8px;flex-wrap:wrap}',
      '.x-in{flex:1 1 220px;min-width:0;box-sizing:border-box;height:38px;border:1px solid var(--border2);border-radius:10px;background:var(--bg);color:var(--text);font:inherit;font-size:13.5px;padding:0 12px}',
      '.x-sel{height:38px;border:1px solid var(--border2);border-radius:10px;background:var(--bg);color:var(--text);font:inherit;font-size:13px;padding:0 10px}',
      '.x-pf{display:grid;grid-template-columns:150px 1fr;gap:10px 14px;margin-top:16px;align-items:start}',
      '.x-pf label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);padding-top:9px}',
      '.x-pf textarea,.x-pf input{width:100%;box-sizing:border-box;border:1px solid var(--border2);border-radius:10px;background:var(--bg);color:var(--text);font:inherit;font-size:13px;padding:8px 10px;line-height:1.45;resize:vertical}',
      '.x-pf .x-hint{grid-column:2;font-size:11px;color:var(--text3);margin-top:-6px}',
      '@media (max-width:640px){.x-pf{grid-template-columns:1fr}.x-pf label{padding-top:2px}.x-pf .x-hint{grid-column:1}}',
      '.x-foot{display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:18px;flex-wrap:wrap}',
      '.x-foot .x-note{font-size:11.5px;color:var(--text3);margin-right:auto;flex:1 1 220px}',
      '.x-sk{height:10px;border-radius:6px;margin:8px 0;background:linear-gradient(90deg,var(--border) 0%,var(--surface) 50%,var(--border) 100%);background-size:200% 100%;animation:xjSh 1.2s ease-in-out infinite}',
      '@media (prefers-reduced-motion:reduce){.xj-card,.x-dmc{animation:none}.xj-bar i,.xj-bar.run i,.x-sk{animation:none;transition:none}}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  // ══ 5. Writing jobs and the dock ══════════════════════════════════════
  var XJ = window._xJobs = window._xJobs || { jobs: {}, t: null, gone: {}, onDone: {} };
  var VERB = function (j) {
    var u = j.unit || ['item', 'items'];
    var n = j.total || 0, w = j.kind === 'translate' ? 'Translating' : j.mode === 'rewrite' ? 'Rewriting' : 'Writing';
    if (j.state === 'done') return (j.kind === 'translate' ? 'Translated ' : j.mode === 'rewrite' ? 'Rewrote ' : 'Wrote ') + plural(j.done - (j.held || 0) + (j.held || 0), u[0], u[1]);
    if (j.state === 'waiting') return 'Paused at ' + j.done + ' of ' + n + ' ' + u[1];
    if (j.state === 'cancelled') return 'Stopped at ' + j.done + ' of ' + n;
    if (j.state === 'stopped') return 'Could not finish';
    return w + ' ' + plural(n, u[0], u[1]);
  };
  function doneNote(j) {
    var parts = [], nf = (j.failed || []).length, nh = j.held || 0;
    if (nf) parts.push(plural(nf, 'person', 'people') + ' could not be written.');
    if (nh) parts.push(nh === 1 ? '1 needs a look before it goes.' : nh + ' need a look before they go.');
    return parts.length ? '<div class="xj-n">' + e(parts.join(' ')) + '</div>' : '';
  }
  function eta(s) { if (!s) return ''; if (s < 50) return 'under a minute left'; var m = Math.round(s / 60); return 'about ' + plural(m, 'minute') + ' left'; }
  function dockEl() {
    var d = document.getElementById('xjDock');
    if (!d) { d = document.createElement('div'); d.id = 'xjDock'; d.className = 'xj-dock'; d.setAttribute('role', 'status'); d.setAttribute('aria-live', 'polite'); document.body.appendChild(d); d.addEventListener('click', onDock); }
    return d;
  }
  function dockRender() {
    var list = Object.keys(XJ.jobs).map(function (k) { return XJ.jobs[k]; }).filter(function (j) { return !XJ.gone[j.id]; })
      .sort(function (a, b) { return String(b.started_at || '').localeCompare(String(a.started_at || '')); }).slice(0, 3);
    var d = dockEl();
    if (!list.length) { d.innerHTML = ''; return; }
    d.innerHTML = list.map(function (j) {
      var run = j.state === 'running', pct = j.total ? Math.round((j.done + (j.failed || []).length) / j.total * 100) : 0;
      var ic = j.state === 'done' ? (j.failed && j.failed.length ? 'wait' : 'ok') : j.state === 'waiting' ? 'wait' : j.state === 'stopped' ? 'bad' : '';
      var icon = j.state === 'done' && !(j.failed || []).length ? IC.tick : j.state === 'running' ? IC.spark : IC.pen;
      var meta = run ? '<div class="xj-m"><span>' + j.done + ' of ' + j.total + ' done</span><span>' + e(/pacing/.test(j.note || '') ? 'SAM is pacing itself' : eta(j.eta_s) || 'starting…') + '</span></div>' : '';
      var fail = (j.failed || []).length && j.state !== 'running' ? '<div class="xj-f">' + j.failed.slice(0, 20).map(function (f) { return '<div><b>' + e(f.name || 'Someone') + '</b>: ' + e(f.why || '') + '</div>'; }).join('') + '</div>' : '';
      var acts = run || j.state === 'waiting'
        ? '<button class="xb ghost" type="button" data-xj="cancel" data-id="' + e(j.id) + '">Stop</button>'
        : ((j.failed || []).length ? '<button class="xb gold" type="button" data-xj="retry" data-id="' + e(j.id) + '">Try again for ' + j.failed.length + '</button>' : '') +
          '<button class="xb" type="button" data-xj="open" data-id="' + e(j.id) + '">Open</button>';
      return '<div class="xj-card" data-job="' + e(j.id) + '">' +
        '<div class="xj-h"><span class="xj-ic ' + ic + '">' + icon + '</span><div style="min-width:0;flex:1"><div class="xj-t">' + e(VERB(j)) + '</div><div class="xj-s">' + e(j.campaign_name || '') + (run ? ' · you can close this tab' : '') + '</div></div>' +
          (run ? '' : '<button class="xj-x" type="button" data-xj="dismiss" data-id="' + e(j.id) + '" aria-label="Dismiss">' + IC.x + '</button>') + '</div>' +
        (run || j.state === 'waiting' ? '<div class="xj-bar' + (run ? ' run' : '') + '" aria-hidden="true"><i style="width:' + Math.max(4, pct) + '%"></i></div>' : '') + meta +
        (!run && j.state === 'done' ? doneNote(j) : (j.note && !run ? '<div class="xj-n">' + e(j.note) + '</div>' : '')) + fail +
        '<div class="xj-a">' + acts + '</div></div>';
    }).join('');
  }
  async function onDock(ev) {
    var b = ev.target.closest ? ev.target.closest('[data-xj]') : null; if (!b) return;
    var a = b.getAttribute('data-xj'), j = XJ.jobs[b.getAttribute('data-id')]; if (!j) return;
    if (a === 'dismiss') { XJ.gone[j.id] = 1; lsSet('xj-gone', JSON.stringify(XJ.gone)); dockRender(); return; }
    if (a === 'cancel') { b.disabled = true; var r = await call('cancel_write_job', { job_id: j.id }); if (r.ok) { XJ.jobs[j.id] = Object.assign(j, r.job, { campaign_name: j.campaign_name }); toast('Stopped. What SAM wrote is kept.'); refreshViews(j); } dockRender(); return; }
    if (a === 'open') { XJ.gone[j.id] = 1; dockRender(); try { openSampaignDetail(j.campaign_id, j.kind === 'email' ? 'sequence' : 'sequence'); if (j.kind !== 'email') setTimeout(function () { try { setSampLaunch(j.campaign_id, j.kind === 'message' ? 'li_message' : 'li_invite'); } catch (_e) {} }, 900); } catch (_e) {} return; }
    if (a === 'retry') { XJ.gone[j.id] = 1; await start({ campaign_id: j.campaign_id, kind: j.kind, launch: j.launch, mode: j.mode, contact_ids: (j.failed || []).map(function (f) { return f.contact_id; }) }); }
  }
  function refreshViews(j) {
    try {
      if (window._sampOpenId !== j.campaign_id) return;
      if (j.kind === 'email' && typeof loadSampaignSendQueue === 'function' && document.getElementById('sampSendQueue')) loadSampaignSendQueue(j.campaign_id);
      if (j.kind !== 'email' && document.getElementById('g23Li') && typeof _g23LiLoad === 'function') _g23LiLoad(j.campaign_id, true).then(function () { g23RenderLi(j.campaign_id); });
      if (typeof _sampLoadOverview === 'function') _sampLoadOverview(j.campaign_id);
    } catch (_e) {}
  }
  async function poll() {
    clearTimeout(XJ.t);
    if (!signedIn()) { XJ.t = setTimeout(poll, 4000); return; }
    var r = await call('get_write_jobs', {}).catch(function () { return { ok: false }; });
    if (r && r.ok) {
      var seen = {};
      (r.jobs || []).forEach(function (j) {
        seen[j.id] = 1;
        var before = XJ.jobs[j.id];
        XJ.jobs[j.id] = j;
        if (before && before.state === 'running' && j.state !== 'running') {
          refreshViews(j);
          if (XJ.onDone[j.id]) { try { XJ.onDone[j.id](j); } catch (_e) {} delete XJ.onDone[j.id]; }
          if (j.state === 'done' && !(j.failed || []).length) setTimeout(function () { XJ.gone[j.id] = 1; dockRender(); }, 9000);
        } else if (before && j.state === 'running' && j.done > before.done && j.kind !== 'email') {
          // Notes appear as they are written.
          if (!XJ._lr || Date.now() - XJ._lr > 4000) { XJ._lr = Date.now(); refreshViews(j); }
        }
      });
      Object.keys(XJ.jobs).forEach(function (k) { if (!seen[k] && XJ.jobs[k].state !== 'running') delete XJ.jobs[k]; });
      dockRender();
    }
    var live = Object.keys(XJ.jobs).some(function (k) { return XJ.jobs[k].state === 'running'; });
    var waiting = Object.keys(XJ.jobs).some(function (k) { return XJ.jobs[k].state === 'waiting'; });
    XJ.t = setTimeout(poll, live ? 2000 : waiting ? 60000 : 0) ;
    if (!live && !waiting) clearTimeout(XJ.t);
  }
  window.xjPoll = poll;
  try { XJ.gone = JSON.parse(lsGet('xj-gone') || '{}') || {}; } catch (_e) { XJ.gone = {}; }
  // Picks up a job started in another tab, or before a refresh.
  setTimeout(function () { if (signedIn()) poll(); }, 1500);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && Object.keys(XJ.jobs).length) poll(); });

  async function start(p) {
    var r = await call('start_write_job', p);
    if (r.ok && !r.job) return { ok: false, needs_sql: true };
    if (!r.ok) return r;
    var nm = ((window._sampaignCampaignsCache || {})[p.campaign_id] || {}).name || '';
    XJ.jobs[r.job.id] = Object.assign({ campaign_name: nm }, r.job);
    delete XJ.gone[r.job.id];
    dockRender(); poll();
    return r;
  }
  window.xWriteStart = start;
  window.xWriteWait = function (jobId, onProgress) {
    return new Promise(function (resolve) {
      XJ.onDone[jobId] = resolve;
      (function tick() { var j = XJ.jobs[jobId]; if (j && onProgress) onProgress(j); if (!j || j.state === 'running') setTimeout(tick, 1000); else { delete XJ.onDone[jobId]; resolve(j); } })();
    });
  };

  // Every "write them all" in the app goes through the server now. A caller
  // that shows its own progress still gets it; closing the tab no longer stops SAM.
  var _s1Old = window._s1Write;
  window._s1Write = async function (o) {
    var b = o.base || {};
    var kind = o.action === 'write_sampaign_drafts' ? 'email' : o.action === 'write_linkedin_notes' ? (b.kind === 'message' ? 'message' : 'invite') : null;
    if (!kind) return _s1Old ? _s1Old(o) : null;
    var r = await start({ campaign_id: b.campaign_id, kind: kind, launch: b.launch || 1, mode: kind === 'email' ? (b.replace ? 'rewrite' : 'write') : (b.instruction ? 'rewrite' : 'write'),
      which: b.which || 'drafts', include_edited: !!b.include_edited, instruction: b.instruction || '', sender_name: b.sender_name || '', sender_full_name: b.sender_full_name || '', contact_ids: o.ids || undefined });
    if (!r.ok) { if (r.needs_sql && _s1Old) return _s1Old(o); return { written: 0, held: 0, total: 0, missed: [], rewritten: 0, err: r.error || 'SAM could not start.' }; }
    var j = r.job;
    var stopped = false;
    var j2 = await new Promise(function (resolve) {
      (function tick() {
        var cur = XJ.jobs[j.id] || j;
        if (o.onProgress) o.onProgress({ written: Math.max(0, cur.done - (cur.held || 0)), held: cur.held || 0, total: cur.total, missed: [], rewritten: 0 });
        if (o.isStopped && o.isStopped() && !stopped) { stopped = true; call('cancel_write_job', { job_id: j.id }).then(function () { poll(); }); }
        if (cur.state !== 'running') return resolve(cur);
        setTimeout(tick, 900);
      })();
    });
    return { written: Math.max(0, j2.done - (j2.held || 0)), held: j2.held || 0, total: j2.total, missed: (j2.failed || []).map(function (f) { return f.contact_id; }), rewritten: 0,
      err: j2.state === 'waiting' || j2.state === 'stopped' ? j2.note : null, job: j2 };
  };

  // The two big "write them all" buttons hand over to the dock straight away.
  var _liOld = window.spLiWrite, _wdOld = window.sampWriteDrafts;
  window.spLiWrite = async function (id, kind) {
    var r = await start({ campaign_id: id, kind: kind === 'message' ? 'message' : 'invite' });
    if (!r.ok && r.needs_sql && _liOld) return _liOld(id, kind);
    if (!r.ok) { toast(r.error || 'SAM could not start writing.'); return; }
    if (r.already) toast('SAM is already writing these. Progress is in the corner.');
    else if (!r.job.total) toast(r.job.note || 'Nothing left to write.');
    else toast('SAM is writing ' + plural(r.job.total, kind === 'message' ? 'message' : 'note') + '. You can carry on, or close the tab.');
  };
  window.sampWriteDrafts = async function (id, launch) {
    var name = (signedIn() && currentUser.user_metadata && currentUser.user_metadata.full_name) || '';
    var r = await start({ campaign_id: id, kind: 'email', launch: launch || 1, sender_name: name.split(' ')[0] || '', sender_full_name: name });
    if (!r.ok && r.needs_sql && _wdOld) return _wdOld(id, launch);
    if (!r.ok) { toast(r.error || 'SAM could not start writing.'); return; }
    if (!r.job.total) { toast(r.job.note || 'Nothing left to write.'); return; }
    toast(r.already ? 'SAM is already writing this wave. Progress is in the corner.' : 'SAM is writing ' + plural(r.job.total, 'email') + '. Drafts appear as they are ready.');
    XJ.onDone[r.job.id] = function () { try { _sampLoadOverview(id).then(function () { if (window._sampOpenId === id) { if (window._sampTab !== 'sequence') setSampTab(id, 'sequence'); else _spRenderSeqTop(id); } }); } catch (_e) {} };
  };

  // ══ 3. English beside other languages ═════════════════════════════════
  // A draft or queued email: the original (its editor or its text) on the
  // left, the English on the right; on a phone, a toggle.
  var LANGN = function (x) { return (x.english && x.english.lang) || 'the original'; };
  function enCard(ref, en, opts) {
    var st = en.state, body = en.body || '';
    var head = '<div class="x-enh"><span class="x-enl">' + IC.globe + 'In English</span>' + (st === 'stale' ? '<span class="x-st stale">Out of date, refreshing</span>' : st === 'missing' ? '<span class="x-st missing">Being translated</span>' : '') + '</div>';
    if (st === 'missing') return head + '<div class="x-sk" style="width:90%"></div><div class="x-sk" style="width:70%"></div><div class="x-sk" style="width:80%"></div>';
    return head + (en.subject ? '<div class="x-ens">' + e(en.subject) + '</div>' : '') + '<div class="x-enb' + (st === 'stale' ? ' stale' : '') + '">' + e(body) + '</div>' +
      (opts.editable ? '<div class="x-ena"><button class="xb" type="button" data-xen="edit" data-ref="' + e(ref) + '">' + IC.pen + 'Edit in English</button></div>' : '') +
      '<div class="sp-small" style="margin-top:6px;font-size:11px;color:var(--text3)">For reading only. ' + e(opts.lang ? 'What goes out is the ' + opts.lang + '.' : 'It is never sent.') + '</div>';
  }
  window.xBi = function (x, srcHtml, editable) {
    if (!x || !x.english) return srcHtml;
    var ref = 'send:' + x.id, lang = x.english.lang;
    var pick = lsGet('x-bi') === 'en' && narrow() ? 'en' : 'src';
    return '<div class="x-seg" role="tablist" aria-label="Language"><button type="button" class="' + (pick === 'src' ? 'on' : '') + '" data-xen="show" data-v="src" data-ref="' + e(ref) + '">' + e(lang) + '</button><button type="button" class="' + (pick === 'en' ? 'on' : '') + '" data-xen="show" data-v="en" data-ref="' + e(ref) + '">English</button></div>' +
      '<div class="x-bi" data-ref="' + e(ref) + '" data-show="' + pick + '"><div class="x-src">' + srcHtml + '</div><div class="x-en" id="xEn_' + e(x.id) + '">' + enCard(ref, x.english, { editable: editable, lang: lang }) + '</div></div>';
  };
  // A LinkedIn note or message: one line of English under it.
  window.xLiEn = function (campaignId, p, kind) {
    var en = kind === 'invite' ? p.note_en : p.message_en;
    if (!en) return '';
    var ref = (kind === 'invite' ? 'li_invite:' : 'li_message:') + p.id;
    if (en.state === 'missing') return '<div class="x-lien"><span class="x-enl">' + IC.globe + 'In English</span><span class="sp-small">Being translated…</span></div>';
    return '<div class="x-lien" data-ref="' + e(ref) + '"><span class="x-enl">' + IC.globe + 'In English</span>' + (en.state === 'stale' ? '<span class="x-st stale">Out of date, refreshing</span> ' : '') +
      '<span class="x-enb' + (en.state === 'stale' ? ' stale' : '') + '" style="white-space:normal">' + e(en.body) + '</span>' +
      (p.can_edit_note || p.can_edit_message ? ' <button class="x-lnk" style="margin-left:6px" type="button" data-xen="edit" data-ref="' + e(ref) + '" data-cid="' + e(campaignId) + '">Edit in English</button>' : '') + '</div>';
  };

  // Edit in English: the rep writes the English, SAM carries it over.
  function enFind(ref) {
    var m = ref.split(':'), kind = m[0], id = m[1];
    if (kind === 'send') {
      var all = []; Object.keys(window._g34Sends || {}).forEach(function (k) { all = all.concat(window._g34Sends[k] || []); });
      var x = all.find(function (s) { return s.id === id; });
      return x ? { kind: kind, id: id, campaign_id: x.campaign_id || window._sampOpenId, en: x.english || {}, isEmail: true } : null;
    }
    var L = window._g23Li || {}, found = null;
    Object.keys(L).forEach(function (cid) { var d = L[cid] && L[cid].data; if (!d) return; var p = (d.people || []).find(function (q) { return q.id === id; }); if (p) found = { kind: kind, id: id, campaign_id: cid, en: (kind === 'li_invite' ? p.note_en : p.message_en) || {}, isEmail: false, lim: kind === 'li_invite' ? d.note_chars : 1900 }; });
    return found;
  }
  function enEditOpen(ref) {
    var f = enFind(ref); if (!f) return;
    var lang = f.en.lang || 'the original';
    var m = document.createElement('div'); m.className = 'x-dm'; m.id = 'xEnEdit';
    m.innerHTML = '<div class="x-dmc" role="dialog" aria-modal="true" aria-labelledby="xEnT"><h3 id="xEnT">Edit in English</h3>' +
      '<div class="x-sub">Change the English the way you want it. SAM rewrites the ' + e(lang) + ' to say the same, keeps the rest as it was, and checks it again before it can go.</div>' +
      (f.isEmail ? '<input class="x-ent sub" id="xEnS" value="' + e(f.en.subject || '') + '" aria-label="Subject in English">' : '') +
      '<textarea class="x-ent" id="xEnB" rows="' + (f.isEmail ? 9 : 4) + '" aria-label="Text in English">' + e(f.en.body || '') + '</textarea>' +
      '<div class="x-foot"><span class="x-note" id="xEnMsg">What you write here is used as you give it.</span><button class="xb" type="button" id="xEnC">Cancel</button><button class="xb gold" type="button" id="xEnGo">' + IC.spark + 'Carry over to ' + e(lang) + '</button></div></div>';
    m.addEventListener('click', function (ev) { if (ev.target === m) m.remove(); });
    document.body.appendChild(m);
    var ta = document.getElementById('xEnB'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    document.getElementById('xEnC').onclick = function () { m.remove(); };
    document.getElementById('xEnGo').onclick = async function () {
      var b = this; b.disabled = true; b.innerHTML = '<span class="g24-spin" aria-hidden="true"></span>SAM is writing the ' + e(lang) + '…';
      var r = await call('edit_in_english', { ref: ref, english_subject: f.isEmail ? document.getElementById('xEnS').value : undefined, english_body: ta.value });
      if (!r.ok) { b.disabled = false; b.innerHTML = IC.spark + 'Carry over to ' + e(lang); document.getElementById('xEnMsg').textContent = r.error || 'SAM could not carry that over.'; return; }
      m.remove(); toast(r.note || 'Saved.');
      if (f.isEmail) { try { loadSampaignSendQueue(f.campaign_id); } catch (_e) {} }
      else { try { _g23LiLoad(f.campaign_id, true).then(function () { g23RenderLi(f.campaign_id); }); } catch (_e) {} }
    };
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-xen]') : null; if (!b) return;
    var a = b.getAttribute('data-xen'), ref = b.getAttribute('data-ref');
    if (a === 'edit') { ev.stopPropagation(); enEditOpen(ref); return; }
    if (a === 'show') {
      ev.stopPropagation();
      var v = b.getAttribute('data-v'); lsSet('x-bi', v);
      var seg = b.parentElement, bi = seg && seg.nextElementSibling;
      if (bi && bi.classList.contains('x-bi')) bi.setAttribute('data-show', v);
      [].forEach.call(seg.querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
    }
  }, true);
  // Translations land a few seconds after SAM writes or after an edit: the
  // queue and the notes refresh themselves once, quietly, while one is pending.
  function settle(kind, campaignId, has) {
    var k = kind + campaignId; XJ['_s' + k] = XJ['_s' + k] || 0;
    if (!has || XJ['_s' + k] > 6) { if (!has) XJ['_s' + k] = 0; return; }
    XJ['_s' + k]++;
    setTimeout(function () {
      if (window._sampOpenId !== campaignId) return;
      if (kind === 'q' && document.getElementById('sampSendQueue')) { var y = window.scrollY; loadSampaignSendQueue(campaignId).then(function () { window.scrollTo(0, y); }); }
      if (kind === 'li' && document.getElementById('g23Li')) _g23LiLoad(campaignId, true).then(function () { g23RenderLi(campaignId); });
    }, 4500);
  }
  window.xSettleQueue = function (campaignId, sends) { settle('q', campaignId, (sends || []).some(function (s) { return s.english && s.english.state !== 'ready'; }) && !document.querySelector('#sampSendQueue [id^="draft_"]:not([style*="none"])')); };
  window.xSettleLi = function (campaignId, d) { settle('li', campaignId, !!(d && (d.people || []).some(function (p) { return (p.note_en && p.note_en.state !== 'ready') || (p.message_en && p.message_en.state !== 'ready'); })) && !(window._g23Li[campaignId] || {}).editing); };

  // Answers to replies: their message and SAM's answer, in English too.
  if (typeof window._g27Render === 'function' && !window._g27Render._x) {
    var _g27Old = window._g27Render;
    window._g27Render = function () {
      var out = _g27Old.apply(this, arguments);
      try {
        var R = window._g27, d = R && R.d; if (!d || !d.english) return out;
        var B = document.getElementById('g27B'); if (!B) return out;
        var q = B.querySelector('.g27-qt');
        if (q && d.english.theirs && !B.querySelector('.x-lien.theirs')) q.insertAdjacentHTML('afterend', '<div class="x-lien theirs"><span class="x-enl">' + IC.globe + 'In English</span><span class="x-enb" style="white-space:normal">' + e(d.english.theirs) + '</span></div>');
        var ed = document.getElementById('g27Ed');
        if (ed && !B.querySelector('.x-en.ans')) {
          var stale = !!R.enStale;
          ed.insertAdjacentHTML('afterend', '<div class="x-en ans" style="margin-top:8px"><div class="x-enh"><span class="x-enl">' + IC.globe + 'SAM\'s answer in English</span><span class="x-st stale" id="xAnsSt"' + (stale ? '' : ' hidden') + '>Out of date</span>' + (d.english.state !== 'ready' ? '<span class="x-st missing">Not available</span>' : '') + '</div>' +
            (d.english.subject ? '<div class="x-ens">' + e(d.english.subject) + '</div>' : '') + '<div class="x-enb' + (stale ? ' stale' : '') + '" id="xAnsB">' + e(d.english.body || '') + '</div>' +
            '<div class="x-ena"><button class="xb" type="button" id="xAnsR"' + (stale ? '' : ' hidden') + '>' + IC.globe + 'Refresh the English</button></div>' +
            '<div class="sp-small" style="margin-top:6px;font-size:11px;color:var(--text3)">For reading only. What goes out is the ' + e(d.english.lang || 'original') + '.</div></div>');
          ed.addEventListener('input', function () { R.enStale = true; var s1 = document.getElementById('xAnsSt'), b1 = document.getElementById('xAnsB'), r1 = document.getElementById('xAnsR'); if (s1) s1.hidden = false; if (b1) b1.classList.add('stale'); if (r1) r1.hidden = false; });
          var rb = document.getElementById('xAnsR');
          if (rb) rb.onclick = async function () {
            rb.disabled = true; rb.innerHTML = '<span class="g24-spin" aria-hidden="true"></span>Translating…';
            var x = await call('translate_text', { lang: d.language && d.language.code, channel: d.channel, items: [{ subject: d.subject || '', body: ed.innerHTML }] });
            if (!x.ok) { rb.disabled = false; rb.innerHTML = IC.globe + 'Refresh the English'; toast(x.error || 'Could not translate.'); return; }
            d.english.body = x.items[0].body; if (x.items[0].subject) d.english.subject = x.items[0].subject; R.enStale = false;
            var b2 = document.getElementById('xAnsB'), s2 = document.getElementById('xAnsSt'); if (b2) { b2.textContent = d.english.body; b2.classList.remove('stale'); } if (s2) s2.hidden = true; rb.hidden = true; rb.disabled = false; rb.innerHTML = IC.globe + 'Refresh the English';
          };
        }
      } catch (_e) {}
      return out;
    };
    window._g27Render._x = true;
  }

  // ══ 1. Who this SAMpaign finds ═══════════════════════════════════════
  var TG = window._xTg = window._xTg || {};
  async function targeting(id, force) {
    if (TG[id] && !force && Date.now() - TG[id].at < 60000) return TG[id];
    var r = await call('get_sampaign_targeting', { campaign_id: id });
    if (r.ok) { r.at = Date.now(); TG[id] = r; }
    return r;
  }
  window.xTargeting = targeting;
  function tgHtml(id, t, owner) {
    if (!t || !t.ok) return '';
    var src = t.source === 'sampaign' ? ['own', 'Set on this SAMpaign'] : t.source === 'demo' ? ['demo', 'From the demo profile'] : t.source === 'company_profile' ? ['', 'From Company profile'] : ['', 'No titles set'];
    var titles = (t.titles || []).slice(0, 6);
    return '<div class="x-tg" id="xTg_' + e(id) + '"><span class="x-tgi">' + IC.target + '</span><span>Finding <b>' + (titles.length ? e(titles.join(', ')) + (t.titles.length > 6 ? ' and ' + (t.titles.length - 6) + ' more' : '') : 'anyone at each company') + '</b></span><span class="x-src ' + src[0] + '">' + src[1] + '</span>' +
      (owner && t.source !== 'demo' ? '<button class="x-lnk" type="button" onclick="openSampaignScoutProfile(\'' + e(id) + '\')">' + (t.source === 'sampaign' ? 'Change' : 'Set titles for this SAMpaign') + '</button>' : '') + '</div>';
  }
  if (typeof window._spPaintPeople === 'function' && !window._spPaintPeople._x) {
    var _ppOld = window._spPaintPeople;
    window._spPaintPeople = function (id) {
      var out = _ppOld.apply(this, arguments);
      try {
        var host = _spPeopleHost(id), d = window._spPeople[id];
        if (host && d) {
          (d.people || []).forEach(function (p) { if (!p.found_with_earlier) return; var li = host.querySelector('li.sd-prs[data-cid="' + p.id + '"] .sd-pt'); if (li && !li.querySelector('.x-earlier')) li.insertAdjacentHTML('beforeend', '<span class="x-earlier" title="Found before this SAMpaign\'s titles changed">Found with the earlier titles</span>'); });
          var paint = function (t) { var old = document.getElementById('xTg_' + id); if (old) old.remove(); var h = tgHtml(id, t, !!d.is_owner); if (h && host.isConnected) host.insertAdjacentHTML('afterbegin', h); };
          if (TG[id]) paint(TG[id]);
          targeting(id).then(paint);
        }
      } catch (_e) {}
      return out;
    };
    window._spPaintPeople._x = true;
  }
  // Who to hunt also takes the SAMpaign's own industries and company size,
  // which beat Company profile for fit and finding, field by field.
  if (typeof window.openSampaignScoutProfile === 'function' && !window.openSampaignScoutProfile._x) {
    var _opOld = window.openSampaignScoutProfile;
    window.openSampaignScoutProfile = async function (campaignId) {
      var out = await _opOld.apply(this, arguments);
      try {
        var locs = document.getElementById('samp-scout-locs'); if (!locs || document.getElementById('xScoutInd')) return out;
        var cur = {}; var r = await call('get_org_setting', { key: 'scout_profile_sampaign_' + campaignId }); if (r && r.value) { try { cur = (typeof r.value === 'string' ? JSON.parse(r.value) : r.value) || {}; } catch (_e) { cur = {}; } }
        var st = locs.getAttribute('style') || '';
        var lab = function (t) { return '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">' + t + '</div>'; };
        locs.insertAdjacentHTML('afterend', lab('Industries (optional, this SAMpaign only)') + '<input id="xScoutInd" value="' + e((cur.industries || []).join(', ')) + '" placeholder="e.g. Manufacturing, Retail" style="' + e(st) + '"/>' +
          lab('Company size (optional)') + '<input id="xScoutSize" value="' + e(cur.companySize || '') + '" placeholder="e.g. 200 to 2,000 employees" style="' + e(st) + '"/>' +
          '<div style="font-size:11.5px;color:var(--text3);margin:-8px 0 16px">Anything set here wins over Company profile for this SAMpaign. Left empty, Company profile is used.</div>');
      } catch (_e) {}
      return out;
    };
    window.openSampaignScoutProfile._x = true;
  }
  // Saving Who to hunt: the extra fields go with it, and the line refreshes.
  if (typeof window.saveSampaignScoutProfile === 'function' && !window.saveSampaignScoutProfile._x) {
    var _svOld = window.saveSampaignScoutProfile;
    window.saveSampaignScoutProfile = async function () {
      var cid = (typeof _sampScoutCampaignId !== 'undefined') ? _sampScoutCampaignId : null, extra = null, base = null;
      try {
        var csv = function (id) { var el = document.getElementById(id); return el ? el.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : []; };
        var per = document.getElementById('samp-scout-toggle'); per = !!(per && per.checked);
        if (per && cid && document.getElementById('xScoutInd')) {
          var depts = [], sens = [];
          document.querySelectorAll('#samp-scout-profile-modal input[type=checkbox][data-group]').forEach(function (c) { if (!c.checked) return; if (c.getAttribute('data-group') === 'dept') depts.push(c.value); else sens.push(c.value); });
          base = { departments: depts, seniorities: sens, jobTitles: csv('samp-scout-titles'), locations: csv('samp-scout-locs') };
          extra = { industries: csv('xScoutInd'), companySize: (document.getElementById('xScoutSize').value || '').trim() };
        }
      } catch (_e) { extra = null; }
      var out = await _svOld.apply(this, arguments);
      try {
        if (extra && (extra.industries.length || extra.companySize)) { var v = Object.assign({}, base); if (extra.industries.length) v.industries = extra.industries; if (extra.companySize) v.companySize = extra.companySize; await call('save_org_setting', { key: 'scout_profile_sampaign_' + cid, value: JSON.stringify(v) }); }
        var id = window._sampOpenId; if (id) { delete TG[id]; if (typeof _spRenderPeople === 'function' && window._sampTab === 'people') _spRenderPeople(id, true); }
      } catch (_e) {}
      return out;
    };
    window.saveSampaignScoutProfile._x = true;
  }

  // ══ 2. Demo SAMpaigns ═════════════════════════════════════════════════
  var DS = window._xDemo = window._xDemo || { can: null, by: {} };
  async function demoAccess() { if (DS.can !== null) return DS.can; var r = await call('demo_status', {}); DS.can = !!(r.ok && r.can_demo); return DS.can; }
  function daysLeft(iso) { var t = Date.parse(iso || ''); if (!t) return null; return Math.max(0, Math.ceil((t - Date.now()) / 86400000)); }
  if (typeof window._spRenderHeader === 'function' && !window._spRenderHeader._x) {
    var _hOld = window._spRenderHeader;
    window._spRenderHeader = function (id) {
      var out = _hOld.apply(this, arguments);
      var paint = function (d) {
        var el = document.getElementById('sampHeader_' + id); if (!el || !d || !d.demo) return;
        var t = el.querySelector('.sp-title'); if (t && !t.querySelector('.x-chip-demo')) t.insertAdjacentHTML('beforeend', '<span class="x-chip-demo">' + IC.demo + 'Demo</span>');
        if (el.querySelector('.x-demo')) return;
        var left = daysLeft(d.demo.expires_at);
        var head = el.querySelector('.sp-head > div') || el;
        head.insertAdjacentHTML('beforeend', '<div class="x-demo" role="note"><span class="x-di">' + IC.demo + '</span><span class="x-dd"><b>Demo for ' + e(d.demo.company) + '.</b> Finding, fit and writing follow ' + e(d.demo.company) + '\'s profile. Nothing is ever sent or scheduled from here, and it stays out of team numbers.' +
          (left !== null ? ' Deleted ' + (left <= 0 ? 'today' : left === 1 ? 'tomorrow' : 'in ' + left + ' days') + ' unless kept.' : '') + '</span>' +
          (DS.can ? '<button class="xb gold" type="button" onclick="xDemoFind(\'' + e(id) + '\')">' + IC.spark + 'Find their market</button><button class="xb" type="button" onclick="xDemoEdit(\'' + e(id) + '\')">Profile</button><button class="xb" type="button" onclick="xDemoKeep(\'' + e(id) + '\')">Keep 7 more days</button><button class="xb ghost" type="button" onclick="xDemoDelete(\'' + e(id) + '\',this)">Delete demo</button>' : '') + '</div>');
      };
      if (DS.by[id]) paint(DS.by[id]);
      call('demo_status', { campaign_id: id }).then(function (d) { if (d && d.ok) { DS.can = !!d.can_demo; DS.by[id] = d; paint(d); } });
      return out;
    };
    window._spRenderHeader._x = true;
  }
  if (typeof window._spNextLine === 'function' && !window._spNextLine._x) {
    var _nlOld = window._spNextLine;
    window._spNextLine = function (c) { return c && c.demo ? 'Demo SAMpaign. Nothing is ever sent from it.' : _nlOld.apply(this, arguments); };
    window._spNextLine._x = true;
  }
  // The button on the SAMpaigns page, for Samora staff only.
  function demoButton() {
    var acts = document.querySelector('#sampHomeView .page-actions'); if (!acts || document.getElementById('xDemoBtn')) return;
    demoAccess().then(function (ok) {
      if (!ok || document.getElementById('xDemoBtn')) return;
      var nb = acts.querySelector('.sp-gold');
      var b = document.createElement('button'); b.id = 'xDemoBtn'; b.className = 'g-btn'; b.type = 'button'; b.title = 'Set SamoraOS up as a prospect\'s own, for a demo'; b.innerHTML = IC.demo + ' Set up for a demo';
      b.onclick = function () { xDemoOpen(); };
      acts.insertBefore(b, nb || null);
    });
  }
  if (typeof window._sampLoadHome === 'function' && !window._sampLoadHome._x) {
    var _homeOld = window._sampLoadHome;
    window._sampLoadHome = async function () { var out = await _homeOld.apply(this, arguments); try { demoButton(); } catch (_e) {} return out; };
    window._sampLoadHome._x = true;
  }
  var FIELDS = [['company', 'Company', 'text'], ['what_they_sell', 'What they sell', 'area'], ['products', 'Products', 'list'], ['competitors', 'Competitors', 'list'], ['industries', 'They sell to', 'list', 'Industries'],
    ['company_size', 'Company size', 'text'], ['geographies', 'Where', 'list'], ['buyer_titles', 'Buyers', 'list', 'Who signs'], ['influencer_titles', 'Influencers', 'list'], ['keywords', 'What they solve', 'list']];
  function profileForm(p) {
    return '<div class="x-pf">' + FIELDS.map(function (f) {
      var v = p[f[0]], id = 'xDf_' + f[0];
      var input = f[2] === 'area' ? '<textarea id="' + id + '" rows="2">' + e(v || '') + '</textarea>'
        : f[2] === 'list' ? '<textarea id="' + id + '" rows="' + (f[0].indexOf('titles') > 0 ? 2 : 1) + '">' + e((v || []).join(', ')) + '</textarea>'
        : '<input id="' + id + '" value="' + e(v || '') + '">';
      return '<label for="' + id + '">' + f[1] + '</label>' + input + (f[2] === 'list' && f[0] === 'buyer_titles' ? '<div class="x-hint">Comma separated. These are who Find people looks for in this demo.</div>' : '');
    }).join('') + '</div>';
  }
  function profileRead(lang) {
    var p = {}; FIELDS.forEach(function (f) { var el = document.getElementById('xDf_' + f[0]); if (!el) return; p[f[0]] = f[2] === 'list' ? el.value.split(/[,\n]/).map(function (x) { return x.trim(); }).filter(Boolean) : el.value.trim(); });
    p.language = lang || 'en'; return p;
  }
  var LANGS = [['en', 'English'], ['de', 'German'], ['fr', 'French'], ['es', 'Spanish'], ['th', 'Thai'], ['id', 'Indonesian'], ['vi', 'Vietnamese'], ['ar', 'Arabic'], ['hi', 'Hindi'], ['ja', 'Japanese']];
  window.xDemoOpen = function (existingId) {
    var old = document.getElementById('xDemoM'); if (old) old.remove();
    var m = document.createElement('div'); m.className = 'x-dm'; m.id = 'xDemoM';
    m.innerHTML = '<div class="x-dmc" role="dialog" aria-modal="true" aria-labelledby="xDemoT"><h3 id="xDemoT">' + IC.demo + ' Set up for a demo</h3>' +
      '<div class="x-sub">Type the prospect\'s website. SAM reads it and sets up a SAMpaign as if SamoraOS were theirs: who they sell to, their buyers, their products. Your Company profile is never touched, and nothing is ever sent from a demo.</div>' +
      '<div class="x-row"><input class="x-in" id="xDemoW" placeholder="timextender.com" aria-label="Their website" autocomplete="off" spellcheck="false"><select class="x-sel" id="xDemoL" aria-label="Language SAM writes in">' + LANGS.map(function (l) { return '<option value="' + l[0] + '">' + l[1] + '</option>'; }).join('') + '</select><button class="xb gold" type="button" id="xDemoGo" style="height:38px;padding:0 16px">' + IC.spark + 'Read the website</button></div>' +
      '<div id="xDemoBody"></div></div>';
    m.addEventListener('click', function (ev) { if (ev.target === m) m.remove(); });
    document.body.appendChild(m);
    var w = document.getElementById('xDemoW'); w.focus();
    w.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') document.getElementById('xDemoGo').click(); });
    document.getElementById('xDemoGo').onclick = async function () {
      var b = this, site = w.value.trim(), body = document.getElementById('xDemoBody');
      if (!site) { w.focus(); return; }
      b.disabled = true; b.innerHTML = '<span class="g24-spin" aria-hidden="true"></span>Reading…';
      body.innerHTML = '<div style="margin-top:16px"><div class="sp-small">SAM is reading ' + e(site) + '…</div><div class="x-sk" style="width:92%"></div><div class="x-sk" style="width:76%"></div><div class="x-sk" style="width:84%"></div></div>';
      var r = await call('demo_profile_draft', { website: site, language: document.getElementById('xDemoL').value });
      b.disabled = false; b.innerHTML = IC.spark + 'Read again';
      if (!r.ok) { body.innerHTML = '<div class="sp-small" style="margin-top:14px;color:var(--coral)">' + e(r.error || 'SAM could not read that website.') + '</div>'; return; }
      body.innerHTML = '<div class="sp-small" style="margin-top:14px">' + e(r.note || '') + '</div>' + profileForm(r.profile) +
        '<div class="x-foot"><span class="x-note">Deleted after 7 days unless kept. Only Samora staff see demos.</span><button class="xb" type="button" onclick="document.getElementById(\'xDemoM\').remove()">Cancel</button><button class="xb gold" type="button" id="xDemoUse">' + IC.tick + (existingId ? 'Use for this SAMpaign' : 'Create the demo SAMpaign') + '</button></div>';
      document.getElementById('xDemoUse').onclick = async function () {
        var u = this; u.disabled = true; u.textContent = 'Setting up…';
        var prof = profileRead(document.getElementById('xDemoL').value);
        var x = existingId ? await call('demo_save', { campaign_id: existingId, profile: prof, website: r.website }) : await call('demo_create', { profile: prof, website: r.website });
        if (!x.ok) { u.disabled = false; u.textContent = 'Try again'; toast(x.error || 'Could not set it up.'); return; }
        m.remove();
        var id = existingId || x.campaign.id;
        toast('Demo for ' + prof.company + ' is ready. Find people next.');
        try { if (typeof loadSampaignCampaigns === 'function') loadSampaignCampaigns(); } catch (_e) {}
        try { delete TG[id]; DS.by[id] = null; openSampaignDetail(id, 'people'); } catch (_e) {}
      };
    };
  };
  window.xDemoEdit = async function (id) {
    var d = await call('demo_status', { campaign_id: id });
    if (!d.ok || !d.demo) return;
    xDemoOpen(id);
    var body = document.getElementById('xDemoBody'), w = document.getElementById('xDemoW');
    if (w) w.value = d.demo.website || '';
    var lang = (d.demo.profile && d.demo.profile.language) || 'en'; var sel = document.getElementById('xDemoL'); if (sel) sel.value = lang;
    body.innerHTML = profileForm(d.demo.profile || {}) + '<div class="x-foot"><span class="x-note">Changes apply to Find people and to what SAM writes next.</span><button class="xb" type="button" onclick="document.getElementById(\'xDemoM\').remove()">Cancel</button><button class="xb gold" type="button" id="xDemoSave">' + IC.tick + 'Save the profile</button></div>';
    document.getElementById('xDemoSave').onclick = async function () {
      this.disabled = true;
      var x = await call('demo_save', { campaign_id: id, profile: profileRead(sel ? sel.value : lang) });
      if (!x.ok) { this.disabled = false; toast(x.error || 'Could not save.'); return; }
      document.getElementById('xDemoM').remove(); toast('Saved.'); delete TG[id]; DS.by[id] = null; _spRenderHeader(id);
    };
  };
  // SAM-TAM for the demo: their market, scored on their profile, added to the demo.
  window.xDemoFind = async function (id) {
    var d = DS.by[id] || await call('demo_status', { campaign_id: id });
    var p = (d && d.demo && d.demo.profile) || {};
    var q = [(p.industries || []).join(' and ') || 'Companies', p.company_size ? 'with ' + p.company_size : '', (p.geographies || []).length ? 'in ' + p.geographies.join(', ') : '', p.what_they_sell ? 'that need ' + String(p.what_they_sell).replace(/\.$/, '').toLowerCase() : ''].filter(Boolean).join(' ');
    try { sampOpenTam({ demoCampaignId: id, q: q.slice(0, 200), region: (p.geographies || [])[0] || '', n: 10 }); } catch (_e) { toast('SAM-TAM is not available here.'); }
  };
  if (typeof window._g19TamRender === 'function' && !window._g19TamRender._x) {
    var _tamOld = window._g19TamRender;
    window._g19TamRender = function () {
      var out = _tamOld.apply(this, arguments);
      try {
        var T = window._g19Tam, page = document.getElementById('sampTamPage'); if (!T || !T.demoCampaignId || !page) return out;
        var d = DS.by[T.demoCampaignId], co = d && d.demo ? d.demo.company : 'the demo';
        var wiz = page.querySelector('.sp-wiz'); if (wiz && !wiz.querySelector('.x-demo')) wiz.insertAdjacentHTML('afterbegin', '<div class="x-demo" style="margin:0 0 12px"><span class="x-di">' + IC.demo + '</span><span class="x-dd"><b>Finding ' + e(co) + '\'s market.</b> Fit is scored on ' + e(co) + '\'s profile, and what you pick is added to the demo SAMpaign.</span></div>');
        var go = page.querySelector('.g19-tambar .g-btn'); if (go) { var n = (T.res && (T.res.candidates || []).filter(function (x) { return T.picked[x.id]; }).length) || 0; go.textContent = 'Add ' + n + ' to the demo'; }
      } catch (_e) {}
      return out;
    };
    window._g19TamRender._x = true;
  }
  window.xDemoAddCompanies = async function (id, pick) {
    var r = await call('add_list_companies', { campaign_id: id, accounts: (pick || []).map(function (x) { return { name: x.name, domain: x.domain || '', region: x.region || '' }; }) });
    if (!r.ok) { toast(r.error || 'Could not add them.'); return; }
    toast(r.note || 'Added.');
    try { window._g19Tam.demoCampaignId = null; openSampaignDetail(id, 'people'); } catch (_e) {}
  };
  window.xDemoKeep = async function (id) { var r = await call('demo_keep', { campaign_id: id }); toast(r.ok ? r.note : (r.error || 'Could not keep it.')); if (r.ok) { DS.by[id] = null; var el = document.querySelector('#sampHeader_' + id + ' .x-demo'); if (el) el.remove(); _spRenderHeader(id); } };
  window.xDemoDelete = async function (id, btn) {
    if (btn && !btn._sure) { btn._sure = true; btn.textContent = 'Yes, delete it'; btn.classList.remove('ghost'); setTimeout(function () { if (btn) { btn._sure = false; btn.textContent = 'Delete demo'; btn.classList.add('ghost'); } }, 4000); return; }
    var r = await call('demo_delete', { campaign_id: id });
    if (!r.ok) { toast(r.error || 'Could not delete it.'); return; }
    toast('Demo deleted.');
    try { if (typeof sampBackToHome === 'function') sampBackToHome(); else if (typeof switchTab === 'function') switchTab('sampaign'); } catch (_e) {}
    try { loadSampaignCampaigns(); } catch (_e) {}
  };
})();
