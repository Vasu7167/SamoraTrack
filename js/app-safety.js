// SamoraOS app: send safety (Drop W, 3 Nov 2026).
// Nothing broken goes out, and nothing that bounces.
//   1. The Send check card on a SAMpaign's Emails tab: every draft and queued
//      email checked the way the send checks it, with what to do about each.
//   2. The Send safety tab in Team & access: the rules, an optional
//      verification service, and mailboxes paused for bounces.
// Loaded after app-4.js. Talks only to the edge function; provider keys never
// reach the browser (only their last four).
(function () {
  'use strict';

  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  async function call(action, body) {
    var r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify(Object.assign({ action: action }, body || {})) });
    var d = {}; try { d = await r.json(); } catch (_e) {}
    if (!r.ok && d.ok === undefined) d.ok = false;
    return d;
  }
  function toast(m) { try { showToast(m); } catch (_e) {} }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (_e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_e) {} }
  var PROVIDER = { zerobounce: 'ZeroBounce', neverbounce: 'NeverBounce', millionverifier: 'MillionVerifier' };

  // How SamoraOS rates an address. The same five words everywhere.
  var TIER = {
    proven:   { label: 'Proven',   cls: 'pv', what: 'You have emailed with them, or an earlier email was delivered.', then: 'Goes' },
    verified: { label: 'Verified', cls: 'vf', what: 'Confirmed by your data provider or verification service.', then: 'Goes' },
    likely:   { label: 'Likely',   cls: 'lk', what: 'The domain takes mail and the address is written the company’s way.', then: 'Goes' },
    risky:    { label: 'Risky',    cls: 'rk', what: 'Might bounce: a shared inbox, a domain that bounced others, or not the company’s usual pattern.', then: 'Held for the owner' },
    invalid:  { label: 'Invalid',  cls: 'iv', what: 'Will bounce, or must not be emailed: bounced before, opted out, typo domain, no mail server.', then: 'Never sends' }
  };
  var ORDER = ['proven', 'verified', 'likely', 'risky', 'invalid'];

  var ICON = {
    shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    pause: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/></svg>',
    redo: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    chev: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    tick: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  function css() {
    if (document.getElementById('wsCss')) return;
    var st = document.createElement('style'); st.id = 'wsCss';
    st.textContent = [
      '.ws-card{border:1px solid var(--border);border-radius:var(--r-md);background:var(--surface);margin:2px 0 14px;overflow:hidden}',
      '.ws-card.ws-pz{border-color:var(--coral)}',
      '.ws-hd{display:flex;align-items:center;gap:9px;padding:12px 14px 0}',
      '.ws-hd .ws-ic{color:var(--gold);display:flex}',
      '.ws-t{font-size:13px;font-weight:700;color:var(--text);white-space:nowrap}',
      '.ws-chip{white-space:nowrap;font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;background:rgba(var(--c-accent-rgb),.12);padding:2px 6px;border-radius:var(--r-sm)}',
      '.ws-sp{flex:1}',
      '.ws-when{font-size:11px;color:var(--text3);white-space:nowrap}',
      '.ws-ib{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;border:1px solid transparent;background:none;color:var(--text3);cursor:pointer}',
      '.ws-ib:hover{background:var(--bg);border-color:var(--border)}',
      '.ws-ib:focus-visible,.ws-b:focus-visible,.ws-seg button:focus-visible{outline:2px solid var(--gold);outline-offset:1px}',
      '.ws-ib.spin svg{animation:wsSpin .8s linear infinite}',
      '@keyframes wsSpin{to{transform:rotate(360deg)}}',
      '.ws-bd{padding:10px 14px 14px}',
      '.ws-head{font-size:15px;font-weight:700;color:var(--text);line-height:1.35;margin:0 0 3px}',
      '.ws-sub{font-size:12px;color:var(--text2);line-height:1.5}',
      '.ws-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0 8px}',
      '.ws-st{border:1px solid var(--border);border-radius:10px;padding:9px 11px;background:var(--bg);text-align:left;cursor:default}',
      'button.ws-st{cursor:pointer;font-family:inherit}',
      'button.ws-st:hover{border-color:var(--border2)}',
      'button.ws-st.on{box-shadow:inset 0 0 0 1.5px currentColor}',
      '.ws-st b{display:block;font-size:22px;line-height:1.1;font-weight:700;font-variant-numeric:tabular-nums}',
      '.ws-st span{display:block;font-size:11px;font-weight:600;color:var(--text2);margin-top:2px}',
      '.ws-st.g{color:var(--green)}.ws-st.a{color:var(--amber)}.ws-st.c{color:var(--coral)}',
      '.ws-bar{display:flex;height:6px;border-radius:999px;overflow:hidden;background:var(--border);gap:2px}',
      '.ws-bar i{display:block;height:100%;transition:width .45s cubic-bezier(.2,.8,.2,1)}',
      '.ws-bar .g{background:var(--green)}.ws-bar .a{background:var(--amber)}.ws-bar .c{background:var(--coral)}',
      '.ws-sec{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin:14px 0 7px}',
      '.ws-tiers{display:flex;flex-wrap:wrap;gap:6px}',
      '.ws-tier{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--text2);border:1px solid var(--border);border-radius:999px;padding:3px 10px 3px 8px;background:var(--bg)}',
      '.ws-tier b{color:var(--text);font-variant-numeric:tabular-nums}',
      '.ws-tier.z{opacity:.45}',
      '.ws-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;display:inline-block}',
      '.ws-dot.pv{background:var(--green)}.ws-dot.vf{background:var(--c-info,#2f6db5)}.ws-dot.lk{background:transparent;box-shadow:inset 0 0 0 2px var(--green)}.ws-dot.rk{background:var(--amber)}.ws-dot.iv{background:var(--coral)}',
      '.ws-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--text2);white-space:nowrap}',
      '.ws-list{display:flex;flex-direction:column;gap:6px}',
      '.ws-it{display:grid;grid-template-columns:28px 1fr auto;gap:4px 10px;align-items:start;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--bg)}',
      '.ws-it.a{border-left:3px solid var(--amber)}.ws-it.c{border-left:3px solid var(--coral)}',
      '.ws-av{width:28px;height:28px;border-radius:50%;background:var(--surface);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text3)}',
      '.ws-nm{font-size:12.5px;font-weight:600;color:var(--text);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ws-em{font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ws-why{grid-column:2 / 4;font-size:12px;line-height:1.5;color:var(--text)}',
      '.ws-why2{grid-column:2 / 4;font-size:11.5px;line-height:1.45;color:var(--text3)}',
      '.ws-acts{grid-column:2 / 4;display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}',
      '.ws-b{font-family:inherit;font-size:11.5px;font-weight:600;padding:5px 11px;border-radius:8px;border:1px solid var(--border2);background:var(--surface);color:var(--text);cursor:pointer;line-height:1.3}',
      '.ws-b:hover{border-color:var(--text3)}',
      '.ws-b.gold{background:var(--gold);border-color:var(--gold);color:var(--c-on-accent,#fff)}',
      '.ws-b.warn{color:var(--amber);border-color:var(--amber)}',
      '.ws-b.sure{background:var(--amber);border-color:var(--amber);color:#fff}',
      '.ws-b.ghost{border-color:transparent;background:none;color:var(--text3)}',
      '.ws-b.ghost:hover{color:var(--coral)}',
      '.ws-b:disabled{opacity:.55;cursor:default}',
      '.ws-tag{font-size:10.5px;font-weight:700;color:var(--text3);border:1px solid var(--border);border-radius:6px;padding:1px 6px;white-space:nowrap}',
      '.ws-ft{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}',
      '.ws-ft .ws-note{flex:1 1 220px}',
      '.ws-note{font-size:11.5px;color:var(--text3);line-height:1.5}',
      '.ws-pzb{display:flex;gap:11px;align-items:flex-start;padding:12px 14px;background:var(--c-risk-wash,rgba(179,38,30,.07));border-bottom:1px solid var(--border)}',
      '.ws-pzb .ws-ic{color:var(--coral);display:flex;margin-top:1px}',
      '.ws-pzb .ws-pt{font-size:13px;font-weight:700;color:var(--text)}',
      '.ws-pzb .ws-pd{font-size:12px;color:var(--text2);line-height:1.5;margin-top:2px}',
      '.ws-sk{height:10px;border-radius:6px;background:linear-gradient(90deg,var(--border) 0%,var(--surface) 50%,var(--border) 100%);background-size:200% 100%;animation:wsSk 1.2s ease-in-out infinite}',
      '@keyframes wsSk{to{background-position:-200% 0}}',
      '.ws-ok{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text)}',
      '.ws-ok .ws-tk{display:inline-flex;width:20px;height:20px;border-radius:50%;align-items:center;justify-content:center;background:var(--c-verified-wash,rgba(30,107,58,.1));color:var(--green)}',
      '.ws-flash{animation:wsFlash 1.6s ease-out}',
      '@keyframes wsFlash{0%{box-shadow:0 0 0 3px rgba(var(--c-accent-rgb),.55)}100%{box-shadow:0 0 0 0 rgba(var(--c-accent-rgb),0)}}',
      // Team & access, Send safety
      '.wss-hero{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:start;border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;background:var(--surface)}',
      '.wss-hero h3{margin:0 0 4px;font-size:15px;color:var(--text)}',
      '.wss-nums{display:flex;gap:8px}',
      '.wss-n{min-width:84px;border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--bg)}',
      '.wss-n b{display:block;font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.1}',
      '.wss-n span{font-size:11px;color:var(--text2);font-weight:600}',
      '.wss-n.a b{color:var(--amber)}.wss-n.c b{color:var(--coral)}',
      '.wss-why{grid-column:1 / 3;display:flex;flex-direction:column;gap:5px}',
      '.wss-wr{display:grid;grid-template-columns:minmax(0,1fr) 120px 28px;gap:8px;align-items:center;font-size:12px;color:var(--text2)}',
      '.wss-wr i{display:block;height:6px;border-radius:999px;background:var(--amber);opacity:.8}',
      '.wss-wr em{font-style:normal;text-align:right;font-variant-numeric:tabular-nums;color:var(--text)}',
      '.wss-row{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--border)}',
      '.wss-row:last-child{border-bottom:none}',
      '.wss-row .wss-tx{flex:1;min-width:0}',
      '.wss-row .wss-lb{font-size:13px;font-weight:600;color:var(--text)}',
      '.wss-row .wss-ds{font-size:12px;color:var(--text3);line-height:1.5;margin-top:2px}',
      '.wss-always{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}',
      '.wss-always span{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text2);border:1px solid var(--border);border-radius:999px;padding:3px 9px;background:var(--bg)}',
      '.wss-always svg{color:var(--green)}',
      '.ws-seg{display:inline-flex;flex-wrap:wrap;border:1px solid var(--border2);border-radius:10px;padding:2px;gap:2px;background:var(--bg)}',
      '.ws-seg button{font-family:inherit;font-size:12px;font-weight:600;border:none;background:none;color:var(--text2);padding:6px 12px;border-radius:8px;cursor:pointer}',
      '.ws-seg button.on{background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.12)}',
      '.wss-key{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
      '.wss-key input{flex:1 1 240px;min-width:0}',
      '.wss-conn{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--bg);margin-top:8px}',
      '.wss-conn .ws-tk{display:inline-flex;width:22px;height:22px;border-radius:50%;align-items:center;justify-content:center;background:var(--c-verified-wash,rgba(30,107,58,.1));color:var(--green)}',
      '.wss-leg{display:grid;grid-template-columns:auto 1fr auto;gap:8px 12px;align-items:baseline;font-size:12px}',
      '.wss-leg .k{display:inline-flex;align-items:center;gap:6px;font-weight:700;color:var(--text)}',
      '.wss-leg .d{color:var(--text2);line-height:1.45}',
      '.wss-leg .t{font-weight:600;color:var(--text3);white-space:nowrap;text-align:right}',
      '@media (max-width:600px){.ws-hd{gap:7px;padding:12px 12px 0}.ws-when{display:none}.ws-chip{font-size:9px;letter-spacing:.05em;padding:2px 5px}.ws-pzb>div{flex-basis:calc(100% - 30px)!important}.ws-pzb .ws-b{margin-left:29px}.ws-bd{padding:10px 12px 12px}.ws-pzb{flex-wrap:wrap}.ws-stats{gap:6px}.ws-st{padding:8px}.ws-st b{font-size:19px}.ws-it{grid-template-columns:28px 1fr}.ws-it .ws-badge{grid-column:2}.ws-why,.ws-why2,.ws-acts{grid-column:1 / 3}',
      '.wss-hero{grid-template-columns:1fr}.wss-why{grid-column:1}.wss-nums{flex-wrap:wrap}.wss-wr{grid-template-columns:minmax(0,1fr) 70px 24px}.wss-leg{grid-template-columns:auto 1fr}.wss-leg .t{grid-column:2;text-align:left;margin-top:-4px}}',
      '@media (prefers-reduced-motion:reduce){.ws-bar i,.ws-ib.spin svg,.ws-sk,.ws-flash{transition:none;animation:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function initial(x) { return (String(x.name || x.email || '?').trim().charAt(0) || '?').toUpperCase(); }
  function ago(iso) {
    var t = Date.parse(iso || ''); if (!t) return '';
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  function when(iso) { var t = Date.parse(iso || ''); return t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function tierBadge(t) { if (!t || !TIER[t.tier]) return ''; var T = TIER[t.tier]; return '<span class="ws-badge" title="' + e(T.what) + '"><i class="ws-dot ' + T.cls + '"></i>' + T.label + '</span>'; }

  // ══ 1. The Send check card ═══════════════════════════════════════════════
  var S = window._wsState = window._wsState || { cache: {}, filter: {}, sure: {}, busy: {} };
  function key(cid, launch) { return cid + '|' + (launch || 1); }

  // Called by loadSampaignSendQueue after it paints the wave.
  window.wsRenderCheck = async function (cid, launch, isOwner, opts) {
    css();
    var k = key(cid, launch), box = document.getElementById('wsCheck');
    if (!box) return;
    box.setAttribute('data-k', k);
    var cached = S.cache[k];
    if (cached) paint(box, cid, launch, cached);
    else box.innerHTML = '<div class="ws-card" role="region" aria-label="Send check" aria-busy="true">' + head(null, true) +
      '<div class="ws-bd"><div class="ws-sub" style="margin-bottom:10px">Checking every email and address…</div><div class="ws-sk" style="width:100%"></div><div class="ws-sk" style="width:62%;margin-top:8px"></div></div></div>';
    var d;
    try { d = await call('check_sampaign_emails', { campaign_id: cid, launch: launch || 1, verify: !!(opts && opts.verify) }); } catch (er) { d = { ok: false, error: er.message }; }
    box = document.getElementById('wsCheck');
    if (!box || box.getAttribute('data-k') !== k) return;
    if (!d || !d.ok) {
      if (!cached) box.innerHTML = '<div class="ws-card" role="region" aria-label="Send check">' + head(null) + '<div class="ws-bd"><div class="ws-note">The send check could not run just now. Every email is still checked as it leaves.</div></div></div>';
      return d;
    }
    d.at = new Date().toISOString(); d.cid = cid; d.isOwner = isOwner !== false && d.is_owner !== false;
    S.cache[k] = d;
    if (!d.summary.total && !d.paused) { box.innerHTML = ''; return d; }
    paint(box, cid, launch, d);
    return d;
  };

  function head(d, spinning) {
    return '<div class="ws-hd"><span class="ws-ic">' + ICON.shield + '</span><span class="ws-t">Send check</span><span class="ws-chip">Samora Intelligence</span><span class="ws-sp"></span>' +
      (d ? '<span class="ws-when">Checked ' + e(ago(d.at)) + '</span>' : '') +
      '<button type="button" class="ws-ib' + (spinning ? ' spin' : '') + '" data-ws="recheck" title="Check again" aria-label="Check again">' + ICON.redo + '</button>' +
      (d && !d.summary.hold && !d.summary.block ? '<button type="button" class="ws-ib" data-ws="fold" aria-expanded="' + (lsGet('ws-fold') === '1' ? 'false' : 'true') + '" title="Show or hide the detail" aria-label="Show or hide the detail">' + ICON.chev + '</button>' : '') +
      '</div>';
  }

  function paint(box, cid, launch, d) {
    var k = key(cid, launch), sm = d.summary, own = d.isOwner;
    var f = S.filter[k] || (sm.hold ? 'hold' : 'block');
    var pz = d.paused;
    var html = '<div class="ws-card' + (pz ? ' ws-pz' : '') + '" role="region" aria-label="Send check" data-cid="' + e(cid) + '" data-l="' + (launch || 1) + '">';
    if (pz) {
      html += '<div class="ws-pzb" role="alert"><span class="ws-ic">' + ICON.pause + '</span><div style="flex:1;min-width:0">' +
        '<div class="ws-pt">Sending is paused for ' + (own ? 'your mailbox' : 'this SAMpaign’s mailbox') + '</div>' +
        '<div class="ws-pd">' + e((pz.bounced || 0) + ' of the ' + plural(pz.sent || 0, 'email') + ' sent in the last day bounced (' + (pz.rate != null ? pz.rate : '?') + '%, the limit is ' + (pz.limit_pct || 2) + '%).' + (pz.paused_at ? ' Paused ' + when(pz.paused_at) + '.' : '')) +
        ' Queued emails wait here and nothing is lost. Look at the bounced addresses in People, then resume.</div></div>' +
        '<button type="button" class="ws-b gold" data-ws="resume">Resume sending</button></div>';
    }
    html += head(d);
    var folded = !sm.hold && !sm.block && lsGet('ws-fold') === '1';
    html += '<div class="ws-bd">';
    if (!sm.total) {
      html += '<div class="ws-note">Nothing in this wave is waiting to go.</div></div></div>';
      box.innerHTML = html; return;
    }
    var tierTotal = ORDER.reduce(function (a, t) { return a + (d.tiers[t] || 0); }, 0);
    if (!sm.hold && !sm.block) {
      html += '<div class="ws-ok"><span class="ws-tk">' + ICON.tick + '</span><span><b>All ' + plural(sm.total, 'email') + ' ready.</b> Each reads right, and each address can take mail.</span></div>';
    } else {
      var parts = [];
      if (sm.ready) parts.push(sm.ready + ' ready');
      if (sm.hold) parts.push(sm.hold + ' need' + (sm.hold === 1 ? 's' : '') + ' you');
      if (sm.block) parts.push(sm.block + ' will not send');
      html += '<div class="ws-head">' + e(parts.join(', ')) + '</div>' +
        '<div class="ws-sub">' + (sm.hold ? 'Held emails wait for ' + (own ? 'you' : 'the owner') + ' and go once fixed or released. ' : '') + (sm.block ? 'Blocked ones never go: the address would bounce or must not be emailed.' : '') + '</div>';
    }
    if (!folded) {
      html += '<div class="ws-stats" role="group" aria-label="Emails by result">' +
        '<div class="ws-st g"><b>' + sm.ready + '</b><span>Ready</span></div>' +
        (sm.hold ? '<button type="button" class="ws-st a' + (f === 'hold' ? ' on' : '') + '" data-ws="filter" data-v="hold" aria-pressed="' + (f === 'hold') + '"><b>' + sm.hold + '</b><span>Held for ' + (own ? 'you' : 'the owner') + '</span></button>' : '<div class="ws-st a"><b>0</b><span>Held</span></div>') +
        (sm.block ? '<button type="button" class="ws-st c' + (f === 'block' ? ' on' : '') + '" data-ws="filter" data-v="block" aria-pressed="' + (f === 'block') + '"><b>' + sm.block + '</b><span>Will not send</span></button>' : '<div class="ws-st c"><b>0</b><span>Blocked</span></div>') +
        '</div>' +
        '<div class="ws-bar" aria-hidden="true"><i class="g" style="width:' + (sm.ready / sm.total * 100) + '%"></i><i class="a" style="width:' + (sm.hold / sm.total * 100) + '%"></i><i class="c" style="width:' + (sm.block / sm.total * 100) + '%"></i></div>';
      if (tierTotal) {
        html += '<div class="ws-sec">Addresses</div><div class="ws-tiers">' + ORDER.map(function (t) {
          var n = d.tiers[t] || 0, T = TIER[t];
          return '<span class="ws-tier' + (n ? '' : ' z') + '" title="' + e(T.label + ': ' + T.what + ' ' + T.then + '.') + '"><i class="ws-dot ' + T.cls + '"></i>' + T.label + ' <b>' + n + '</b></span>';
        }).join('') + '</div>';
      }
      var rows = (d.rows || []).filter(function (r) { return r.verdict === f; });
      if (rows.length) {
        html += '<div class="ws-sec">' + (f === 'hold' ? 'Held for ' + (own ? 'you' : 'the owner') : 'Will not send') + '</div><div class="ws-list">' + rows.slice(0, 60).map(function (r) { return item(r, own, k); }).join('') +
          (rows.length > 60 ? '<div class="ws-note">And ' + (rows.length - 60) + ' more like these.</div>' : '') + '</div>';
      }
      var risky = (d.rows || []).filter(function (r) { return r.trust && r.trust.tier === 'risky' && r.verdict !== 'block'; }).length;
      var heldAll = (d.rows || []).filter(function (r) { return r.verdict === 'hold'; }).map(function (r) { return r.id; });
      var ft = '';
      if (risky && d.policy && d.policy.verifier && own) ft += '<button type="button" class="ws-b" data-ws="verify">Verify ' + plural(risky, 'risky address', 'risky addresses') + ' with ' + e(PROVIDER[d.policy.verifier] || d.policy.verifier) + '</button>';
      if (f === 'hold' && heldAll.length > 1 && own) ft += S.sure[k + '|all'] ? '<button type="button" class="ws-b sure" data-ws="all-go">Yes, send all ' + heldAll.length + '</button><button type="button" class="ws-b ghost" data-ws="all-no">Keep them held</button>' : '<button type="button" class="ws-b warn" data-ws="all">Send all ' + heldAll.length + ' anyway</button>';
      var note = '';
      if (risky && !(d.policy && d.policy.verifier)) note = 'Want risky addresses checked before they go? ' + ((typeof profile !== 'undefined' && profile && profile.is_org_admin) ? 'Add ZeroBounce, NeverBounce or MillionVerifier in Team &amp; access, Send safety.' : 'Ask an admin to add a verification service in Team &amp; access.');
      else if (sm.hold || sm.block) note = 'Every email is checked again as it leaves. Fixing one puts it back in the queue at its time.';
      if (ft || note) html += '<div class="ws-ft">' + (note ? '<span class="ws-note">' + note + '</span>' : '') + ft + '</div>';
    }
    html += '</div></div>';
    box.innerHTML = html;
    if (!box._wsWired) { box._wsWired = true; box.addEventListener('click', onCardClick); }
  }

  function item(r, own, k) {
    var iss = r.issues || [], t = r.trust || null;
    var first = iss.length ? iss[0].text : (t ? (r.verdict === 'block' ? t.reason : 'Risky address: ' + t.reason) : 'Needs a look.');
    var second = iss.length > 1 ? iss.slice(1).map(function (i) { return i.text; }).join(' ') : '';
    if (iss.length && t && (t.tier === 'risky' || (r.verdict === 'block' && t.tier === 'invalid'))) second = (second ? second + ' ' : '') + 'Address: ' + t.reason;
    var stTag = r.status === 'draft' ? 'Draft' : r.status === 'held' ? 'Held' : r.status === 'blocked' ? 'Blocked' : 'Queued';
    var acts = '';
    if (own) {
      if (r.verdict === 'hold') {
        acts += '<button type="button" class="ws-b" data-ws="open" data-id="' + e(r.id) + '">' + (iss.length ? 'Fix the email' : 'Open') + '</button>';
        acts += S.sure[k + '|' + r.id]
          ? '<button type="button" class="ws-b sure" data-ws="go" data-id="' + e(r.id) + '">Yes, send it</button><button type="button" class="ws-b ghost" data-ws="no" data-id="' + e(r.id) + '">Keep it held</button>'
          : '<button type="button" class="ws-b warn" data-ws="send" data-id="' + e(r.id) + '">Send anyway</button>';
      }
      acts += '<button type="button" class="ws-b ghost" data-ws="remove" data-id="' + e(r.id) + '">Remove</button>';
    }
    return '<div class="ws-it ' + (r.verdict === 'hold' ? 'a' : 'c') + '" data-row="' + e(r.id) + '">' +
      '<span class="ws-av" aria-hidden="true">' + e(initial(r)) + '</span>' +
      '<span style="min-width:0"><span class="ws-nm" style="display:block">' + e(r.name || r.email || 'No name') + (r.company ? '<span style="font-weight:400;color:var(--text3)"> · ' + e(r.company) + '</span>' : '') + '</span><span class="ws-em" style="display:block">' + e(r.email || 'No email address') + '</span></span>' +
      '<span style="display:flex;gap:8px;align-items:center">' + tierBadge(t) + '<span class="ws-tag">' + stTag + '</span></span>' +
      '<div class="ws-why">' + e(first) + '</div>' +
      (second ? '<div class="ws-why2">' + e(second) + '</div>' : '') +
      (r.english && r.english.body ? '<details class="ws-why2 ws-en"><summary style="cursor:pointer;font-weight:600;color:var(--text2)">Read it in English' + (r.english.state === 'stale' ? ' (out of date)' : '') + '</summary><div style="margin-top:6px;white-space:pre-wrap;color:var(--text2)">' + (r.english.subject ? '<b>' + e(r.english.subject) + '</b>\n' : '') + e(r.english.body) + '</div></details>' : '') +
      (acts ? '<div class="ws-acts">' + acts + '</div>' : '') +
    '</div>';
  }

  function cardCtx(el) { var c = el.closest('.ws-card'); return c ? { cid: c.getAttribute('data-cid'), launch: parseInt(c.getAttribute('data-l'), 10) || 1 } : null; }
  function repaint(cx) { var box = document.getElementById('wsCheck'), d = S.cache[key(cx.cid, cx.launch)]; if (box && d) paint(box, cx.cid, cx.launch, d); }
  function reloadQueue(cid) { try { loadSampaignSendQueue(cid); } catch (_e) {} }

  async function onCardClick(ev) {
    var b = ev.target.closest ? ev.target.closest('[data-ws]') : null;
    if (!b || b.disabled) return;
    var cx = cardCtx(b); if (!cx) return;
    var a = b.getAttribute('data-ws'), id = b.getAttribute('data-id'), k = key(cx.cid, cx.launch), d = S.cache[k] || {};
    if (a === 'recheck') { b.classList.add('spin'); await window.wsRenderCheck(cx.cid, cx.launch, d.isOwner); return; }
    if (a === 'fold') { lsSet('ws-fold', lsGet('ws-fold') === '1' ? '0' : '1'); repaint(cx); return; }
    if (a === 'filter') { S.filter[k] = b.getAttribute('data-v'); repaint(cx); return; }
    if (a === 'send') { S.sure[k + '|' + id] = 1; repaint(cx); var y = document.querySelector('.ws-it[data-row="' + id + '"] [data-ws="go"]'); if (y) y.focus(); return; }
    if (a === 'no') { delete S.sure[k + '|' + id]; repaint(cx); return; }
    if (a === 'all') { S.sure[k + '|all'] = 1; repaint(cx); return; }
    if (a === 'all-no') { delete S.sure[k + '|all']; repaint(cx); return; }
    if (a === 'open') { openEmail(id); return; }
    if (a === 'go' || a === 'all-go') {
      var ids = a === 'go' ? [id] : (d.rows || []).filter(function (r) { return r.verdict === 'hold'; }).map(function (r) { return r.id; });
      b.disabled = true; b.textContent = 'Releasing…';
      var r = await call('release_held_sends', { send_ids: ids, override: true });
      delete S.sure[k + '|' + id]; delete S.sure[k + '|all'];
      if (!r.ok) { toast(r.error || 'Could not release.'); repaint(cx); return; }
      var drafts = ids.filter(function (x) { var row = (d.rows || []).find(function (q) { return q.id === x; }); return row && row.status === 'draft'; }).length;
      toast(ids.length === 1
        ? (drafts ? 'Cleared. It goes when you schedule this wave.' : 'Released. It goes at its time, or in a couple of minutes if that has passed.')
        : 'Released ' + ids.length + '. Each goes at its time.');
      reloadQueue(cx.cid); return;
    }
    if (a === 'remove') {
      b.disabled = true;
      var rr = await call('cancel_sampaign_scheduled_send', { send_ids: [id] });
      if (!rr.ok) { toast(rr.error || 'Could not remove.'); b.disabled = false; return; }
      toast(rr.discarded ? 'Draft removed.' : 'Removed from the queue. Nothing goes to them in this wave.');
      reloadQueue(cx.cid); return;
    }
    if (a === 'verify') {
      var was = b.textContent; b.disabled = true; b.textContent = 'Checking with ' + (PROVIDER[d.policy.verifier] || 'the service') + '…';
      var before = (d.rows || []).filter(function (q) { return q.trust && q.trust.tier === 'risky'; }).map(function (q) { return q.email; });
      var nd = await window.wsRenderCheck(cx.cid, cx.launch, d.isOwner, { verify: true });
      if (!nd || !nd.ok) { b.disabled = false; b.textContent = was; toast('The verification service did not answer. Try again in a minute.'); return; }
      var res = { good: 0, bad: 0, still: 0 };
      (nd.rows || []).forEach(function (q) { if (before.indexOf(q.email) === -1 || !q.trust) return; if (q.trust.tier === 'verified') res.good++; else if (q.trust.tier === 'invalid') res.bad++; else res.still++; });
      toast((PROVIDER[d.policy.verifier] || 'The service') + ' checked ' + before.length + ': ' + [res.good ? res.good + ' valid' : '', res.bad ? res.bad + ' would bounce' : '', res.still ? res.still + ' still uncertain' : ''].filter(Boolean).join(', ') + '.');
      if (res.good) reloadQueue(cx.cid);
      return;
    }
    if (a === 'resume') {
      b.disabled = true; b.textContent = 'Resuming…';
      var rs = await call('resume_sending', {});
      if (!rs.ok) { toast(rs.error || 'Could not resume.'); b.disabled = false; b.textContent = 'Resume sending'; return; }
      toast('Sending again. Bounces are counted fresh from now.');
      Object.keys(S.cache).forEach(function (kk) { if (S.cache[kk]) S.cache[kk].paused = null; });
      reloadQueue(cx.cid);
    }
  }

  // Opens the email in the list below, scrolls to it and lights it up.
  function openEmail(id) {
    var el = document.getElementById('draft_' + id);
    if (!el) { toast('Open the wave this email is in to edit it.'); return; }
    if (el.style.display === 'none') { try { _toggleDraft(id); } catch (_e) { el.style.display = 'block'; } }
    var row = el.previousElementSibling && el.previousElementSibling.classList.contains('samp-send-row') ? el.previousElementSibling : el;
    try { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_e) { row.scrollIntoView(); }
    el.classList.remove('ws-flash'); void el.offsetWidth; el.classList.add('ws-flash');
    var inp = document.getElementById('draftSubj_' + id); if (inp) setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (_e) {} }, 350);
  }
  window.wsOpenEmail = openEmail;

  // A held or blocked row in the queue says why, in the right colour.
  window.wsReasonLine = function (x) {
    if (!x || !x.error || (x.status !== 'held' && x.status !== 'blocked')) return '';
    var txt = String(x.error).replace(/^(Held|Blocked):\s*/, '');
    return '<div style="font-size:11px;line-height:1.45;color:' + (x.status === 'held' ? 'var(--amber)' : 'var(--coral)') + ';padding:0 10px 8px 46px">' + (x.status === 'held' ? 'Held: ' : 'Will not send: ') + e(txt) + '</div>';
  };

  // ══ 2. Team & access, Send safety ════════════════════════════════════════
  window.wsSafetyTab = async function (body, con, fresh) {
    css();
    if (!con.ws || fresh) {
      if (!con.ws) body.innerHTML = '<div class="sxa-empty">Loading send safety…</div>';
      var d; try { d = await con.call('get_send_safety', con._body()); } catch (er) { d = { ok: false, error: er.message }; }
      if (con.tab !== 'sendsafe') return;
      if (!d || !d.ok) { body.innerHTML = '<div class="sxa-empty sxa-err">' + e((d && d.error) || 'Could not load send safety.') + '</div>'; return; }
      con.ws = d; con.wsDraft = { hold_risky: d.settings.hold_risky, pause_pct: d.settings.pause_pct }; con.wsDirty = false;
      if (!con.wsProv) con.wsProv = (d.verifier && d.verifier.provider) || 'zerobounce';
      con.wsEditKey = !d.verifier;
    }
    var D = con.ws, s = con.wsDraft, v = D.verifier, l7 = D.last7 || { held: 0, blocked: 0, top: [] };
    var maxTop = l7.top.reduce(function (m, x) { return Math.max(m, x.n); }, 1);
    var pctOpts = [1, 2, 3, 4, 5, 7, 10, 15, 20].map(function (n) { return '<option value="' + n + '"' + (n === s.pause_pct ? ' selected' : '') + '>' + n + '%</option>'; }).join('');
    body.innerHTML = '<div class="sxa-pf">' +
      '<div class="wss-hero">' +
        '<div><h3>Nothing broken goes out, and nothing that bounces</h3>' +
        '<div class="sxa-note">Every SAMpaign email is checked as it leaves: no gaps where a {{tag}} was, no wrong names, nothing written for the writer. Every address is rated before it is used. Held emails wait for their owner in the SAMpaign; blocked ones never go.</div></div>' +
        '<div class="wss-nums"><div class="wss-n a"><b>' + l7.held + '</b><span>Held, 7 days</span></div><div class="wss-n c"><b>' + l7.blocked + '</b><span>Blocked, 7 days</span></div></div>' +
        (l7.top.length ? '<div class="wss-why"><div class="sxa-sec" style="margin:6px 0 2px">Most common reasons</div>' + l7.top.map(function (x) {
          return '<div class="wss-wr"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + e(x.reason) + '">' + e(x.reason) + '</span><i style="width:' + Math.max(8, Math.round(x.n / maxTop * 100)) + '%"></i><em>' + x.n + '</em></div>';
        }).join('') + '</div>' : '') +
      '</div>' +

      '<div class="sxa-sec">Rules</div>' +
      '<div class="wss-row"><div class="wss-tx"><div class="wss-lb">Hold risky addresses for the owner</div><div class="wss-ds">Shared inboxes (info@, sales@), domains that bounced others lately, and addresses not written the way the company writes them. The owner sees each one in the SAMpaign and decides.</div></div>' +
        '<input type="checkbox" class="sxa-sw" data-sxa="ws-hold"' + (s.hold_risky ? ' checked' : '') + ' aria-label="Hold risky addresses"/></div>' +
      '<div class="wss-row"><div class="wss-tx"><div class="wss-lb">Pause a mailbox that bounces</div><div class="wss-ds">When bounces in a day reach this share of what it sent (and at least ' + (D.settings.pause_min || 3) + '), that mailbox stops sending SAMpaign email until its owner or an admin resumes it. Protects the domain’s reputation for everyone.</div></div>' +
        '<select class="sxa-in" data-sxa="ws-pct" aria-label="Bounce limit" style="width:auto">' + pctOpts + '</select></div>' +
      '<div class="wss-row"><div class="wss-tx"><div class="wss-lb">Always on</div><div class="wss-always">' +
        ['Bounced before, in any SAMpaign', 'Asked not to be contacted', 'Typo domains (gmial.com)', 'Throwaway inboxes', 'Domains with no mail server', 'Empty emails'].map(function (x) { return '<span>' + ICON.tick + e(x) + '</span>'; }).join('') +
        '</div><div class="wss-ds" style="margin-top:6px">These never send. Unfilled {{tags}}, a greeting with the wrong name and words meant for the writer are held for the owner.</div></div></div>' +
      '<div class="sxa-actions" style="justify-content:flex-start"><button class="sxa-btn sxa-btn-gold" data-sxa="ws-save"' + (con.wsDirty ? '' : ' disabled') + '>' + (con.wsDirty ? 'Save rules' : 'Saved') + '</button></div>' +

      '<div class="sxa-sec">Verification service <span style="text-transform:none;letter-spacing:0;font-weight:600">(optional)</span></div>' +
      '<div class="sxa-note">SamoraOS rates every address itself, at no cost. For the risky ones, a verification service can ask the mail server whether the mailbox exists before anything is sent. Each address checked uses one credit from your account with them, only when an owner presses Verify or an email is about to go.</div>' +
      (v && !con.wsEditKey
        ? '<div class="wss-conn"><span class="ws-tk">' + ICON.tick + '</span><span style="flex:1;min-width:0;font-size:12.5px"><b>' + e(PROVIDER[v.provider] || v.provider) + '</b> connected · key ' + e(v.key_hint) + (v.saved_at ? ' · saved ' + e(new Date(v.saved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) : '') + '</span>' +
          '<button class="sxa-btn sxa-btn-ghost" data-sxa="ws-replace">Replace key</button><button class="sxa-btn sxa-btn-ghost" data-sxa="ws-remove-key">Remove</button></div>'
        : '<div style="margin-top:10px"><div class="ws-seg" role="radiogroup" aria-label="Verification service">' + Object.keys(PROVIDER).map(function (p) {
            return '<button type="button" role="radio" aria-checked="' + (con.wsProv === p) + '" class="' + (con.wsProv === p ? 'on' : '') + '" data-sxa="ws-prov" data-v="' + p + '">' + PROVIDER[p] + '</button>';
          }).join('') + '</div>' +
          '<div class="wss-key"><input class="sxa-in" type="password" autocomplete="off" spellcheck="false" data-sxa="ws-key" placeholder="Paste your ' + e(PROVIDER[con.wsProv]) + ' API key" aria-label="API key"/>' +
          '<button class="sxa-btn sxa-btn-gold" data-sxa="ws-savekey">Test and save</button>' + (v ? '<button class="sxa-btn sxa-btn-ghost" data-sxa="ws-cancelkey">Cancel</button>' : '') + '</div>' +
          '<div class="sxa-note" style="margin-top:6px">The key is tested with one made-up address first, saved only if it works, and never shown again.</div></div>') +

      '<div class="sxa-sec">Paused mailboxes</div>' +
      (D.paused && D.paused.length
        ? '<div class="sxa-list">' + D.paused.map(function (p) {
            return '<div class="sxa-row" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="sxa-av">' + e(initial(p)) + '</span>' +
              '<span style="flex:1;min-width:160px"><span class="sxa-pn" style="display:block">' + e(p.name || p.email) + '</span><span class="sxa-pe" style="display:block">' + e((p.bounced || 0) + ' of ' + (p.sent || 0) + ' bounced (' + (p.rate != null ? p.rate : '?') + '%)' + (p.paused_at ? ', paused ' + when(p.paused_at) : '')) + '</span></span>' +
              '<span class="sxa-mb-st bad">Paused</span><button class="sxa-btn sxa-btn-ghost" data-sxa="ws-resume" data-id="' + e(p.user_id) + '">Resume</button></div>';
          }).join('') + '</div>'
        : '<div class="sxa-note">None. Every mailbox is sending.</div>') +

      '<div class="sxa-sec">How SamoraOS rates an address</div>' +
      '<div class="wss-leg">' + ORDER.map(function (t) { var T = TIER[t]; return '<span class="k"><i class="ws-dot ' + T.cls + '"></i>' + T.label + '</span><span class="d">' + e(T.what) + '</span><span class="t">' + e(T.then === 'Held for the owner' && !s.hold_risky ? 'Goes (holding is off)' : T.then) + '</span>'; }).join('') + '</div>' +
    '</div>';
  };

  window.wsSafetyChange = function (a, t, con) {
    if (!con.wsDraft) return;
    if (a === 'ws-hold') con.wsDraft.hold_risky = !!t.checked;
    else if (a === 'ws-pct') con.wsDraft.pause_pct = parseInt(t.value, 10);
    else return;
    con.wsDirty = con.wsDraft.hold_risky !== con.ws.settings.hold_risky || con.wsDraft.pause_pct !== con.ws.settings.pause_pct;
    window.wsSafetyTab(con.el.querySelector('#sxa-body'), con);
  };

  window.wsSafetyClick = async function (a, t, con) {
    var body = con.el.querySelector('#sxa-body');
    var save = async function (settings, busy) {
      var was = t.textContent; t.disabled = true; t.textContent = busy;
      var d; try { d = await con.call('save_send_safety', con._body({ settings: settings })); } catch (er) { d = { ok: false, error: er.message }; }
      if (!d || !d.ok) { con.toast((d && d.error) || 'Could not save.', true); t.disabled = false; t.textContent = was; return null; }
      con.ws = d; con.wsDraft = { hold_risky: d.settings.hold_risky, pause_pct: d.settings.pause_pct }; con.wsDirty = false;
      return d;
    };
    if (a === 'ws-save') {
      if (await save({ hold_risky: con.wsDraft.hold_risky, pause_pct: con.wsDraft.pause_pct }, 'Saving…')) { con.toast('Saved. The next send uses these rules.'); window.wsSafetyTab(body, con); }
      return;
    }
    if (a === 'ws-prov') { con.wsProv = t.getAttribute('data-v'); window.wsSafetyTab(body, con); var k0 = body.querySelector('[data-sxa="ws-key"]'); if (k0) k0.focus(); return; }
    if (a === 'ws-replace') { con.wsEditKey = true; window.wsSafetyTab(body, con); var k1 = body.querySelector('[data-sxa="ws-key"]'); if (k1) k1.focus(); return; }
    if (a === 'ws-cancelkey') { con.wsEditKey = false; window.wsSafetyTab(body, con); return; }
    if (a === 'ws-savekey') {
      var inp = body.querySelector('[data-sxa="ws-key"]'), key = inp ? inp.value.trim() : '';
      if (key.length < 8) { con.toast('Paste the API key from your ' + PROVIDER[con.wsProv] + ' account.', true); if (inp) inp.focus(); return; }
      var d = await save({ verifier: { provider: con.wsProv, key: key } }, 'Testing…');
      if (inp) inp.value = '';
      if (d) { con.wsEditKey = false; con.toast(PROVIDER[con.wsProv] + ' connected. Risky addresses can be verified from now.'); window.wsSafetyTab(body, con); }
      return;
    }
    if (a === 'ws-remove-key') {
      if (await save({ verifier: null }, 'Removing…')) { con.wsEditKey = true; con.toast('Removed. SamoraOS keeps rating addresses on its own.'); window.wsSafetyTab(body, con); }
      return;
    }
    if (a === 'ws-resume') {
      t.disabled = true; t.textContent = 'Resuming…';
      var r; try { r = await con.call('resume_sending', con._body({ user_id: t.getAttribute('data-id') })); } catch (er) { r = { ok: false, error: er.message }; }
      if (!r || !r.ok) { con.toast((r && r.error) || 'Could not resume.', true); t.disabled = false; t.textContent = 'Resume'; return; }
      con.toast('Sending again. Bounces are counted fresh from now.');
      window.wsSafetyTab(body, con, true);
    }
  };
})();
