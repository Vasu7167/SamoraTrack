// Drop AJ (28 Nov 2026): deals SAM spots outside SAMpaigns, confirmed in one
// tap; and your meetings in SamoraOS, with Join, so the calendar app can stay shut.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function call(action, body) { return _sampEdge(action, Object.assign({ tz: tz() }, body || {})); }
  function tz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_e) { return ''; } }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function first(n) { return String(n || '').split(' ')[0]; }
  function ini(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function day(iso) { var t = new Date(iso); if (isNaN(t)) return ''; return t.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function hm(iso) { var t = new Date(iso); if (isNaN(t)) return ''; return t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(':00', ''); }
  function ymd(d) { var t = d instanceof Date ? d : new Date(d); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }
  function money(n, cur) { if (n == null || n === '') return ''; try { return new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 0 }).format(Number(n)); } catch (_e) { return (cur || '') + ' ' + Number(n).toLocaleString(); } }
  var I = function (d) { return '<svg class="aj-i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var IC = {
    spark: I('<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
    cal: I('<path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/>'), video: I('<rect x="3.5" y="6.5" width="12" height="11" rx="2"/><path d="M15.5 10.5l5-3v9l-5-3"/>'),
    pin: I('<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'), inb: I('<path d="M4 6.5h16v11H4z"/><path d="M4 7l8 6 8-6"/>'),
    out: I('<path d="M4 12l16-7-6 16-3-7z"/>'), notes: I('<path d="M6 3.5h9l3 3v14H6z"/><path d="M9 10h6M9 13.5h6M9 17h4"/>'), chat: I('<path d="M5 5.5h14v10H10l-4 3.5v-3.5H5z"/>'),
    ask: I('<path d="M9.5 9a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17v.1"/><circle cx="12" cy="12" r="8.5"/>'), commit: I('<path d="M4.5 12.5l5 5L19.5 7"/>'), terms: I('<path d="M5 5.5h14M5 10h14M5 14.5h9"/><circle cx="17.5" cy="17.5" r="2.5"/>'),
    x: I('<path d="M6 6l12 12M18 6L6 18"/>'), plus: I('<path d="M12 5v14M5 12h14"/>'), ext: I('<path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 14v5.5H4.5V7H10"/>'), clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    arrow: I('<path d="M5 12h14M13 6l6 6-6 6"/>'), undo: I('<path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 010 10h-2"/>')
  };
  (function css() {
    if (document.getElementById('ajCss')) return;
    var st = document.createElement('style'); st.id = 'ajCss';
    st.textContent = [
      '.aj-i{flex:none}a.ah-btn{text-decoration:none}body:has(#ajStack) .aj-toast{bottom:96px}',
      // Today: the spotted line
      '.aj-spot{position:relative;margin:0 0 14px;padding:14px 16px;border-radius:18px;border:1px solid rgba(var(--ah-mul),.28);background:linear-gradient(130deg,rgba(var(--ah-mul),.10),rgba(212,175,55,.07) 55%,transparent 90%),var(--surface);box-shadow:0 14px 34px -18px rgba(var(--ah-mul),.55)}',
      '.aj-sl{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.aj-ico{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,#2A1A11,#3B2518);color:#E8C55A;flex:none;box-shadow:0 0 0 1px rgba(232,197,90,.3)}',
      '.aj-st{flex:1;min-width:180px}.aj-st b{display:block;font-size:15px;color:var(--text)}.aj-st small{display:block;margin-top:2px;font-size:12.5px;color:var(--text3);line-height:1.45}',
      '.aj-logos{display:flex}.aj-logos span{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;font-size:11px;font-weight:800;background:var(--surface2);color:var(--text2);border:2px solid var(--surface);margin-left:-6px}.aj-logos span:first-child{margin-left:0}',
      '.aj-acts0{display:flex;gap:8px;flex-wrap:wrap}',
      '.aj-bar{height:6px;border-radius:999px;background:var(--surface2);overflow:hidden;margin-top:10px}.aj-bar i{display:block;height:100%;background:linear-gradient(90deg,#B8860B,#E8B84B);border-radius:999px;transition:width .4s}',
      '.aj-nx{list-style:none;margin:12px 0 0;padding:10px 0 0;border-top:1px solid var(--border);display:grid;gap:8px}.aj-nx li{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text2);min-width:0}',
      '.aj-nx .c{all:unset;cursor:pointer;font-weight:700;color:var(--text)}.aj-nx .c:hover{text-decoration:underline}.aj-nx .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.aj-nx .c:focus-visible{outline:2px solid var(--c-accent)}',
      '.aj-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(var(--c-accent-rgb),.16);color:var(--c-accent-text);white-space:nowrap}.aj-chip.mul{background:rgba(var(--ah-mul),.12);color:var(--ah-mul-t)}.aj-chip.dim{background:var(--surface2);color:var(--text3)}',
      // The stack
      '.aj-dw{position:fixed;inset:0;z-index:9000;background:rgba(14,9,6,.62);backdrop-filter:blur(3px);display:grid;place-items:center;padding:16px}',
      '.aj-stk{width:min(600px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;border-radius:22px;overflow:hidden;background:var(--surface);color:var(--text);box-shadow:0 30px 80px rgba(0,0,0,.45),0 0 0 1px rgba(232,197,90,.18)}',
      '.aj-sh{display:flex;align-items:center;gap:12px;padding:14px 18px;background:linear-gradient(135deg,#2A1A11,#3B2518 70%,#4A1E35);color:#EFE3C8}.aj-sh .eb{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#E8C55A}.aj-sh .sub{font-size:12.5px;color:rgba(239,227,200,.75)}',
      '.aj-dots{display:flex;gap:5px;margin-top:6px}.aj-dots i{width:18px;height:4px;border-radius:999px;background:rgba(239,227,200,.22)}.aj-dots i.on{background:#E8C55A}.aj-dots i.done{background:rgba(232,197,90,.5)}',
      '.aj-x{all:unset;cursor:pointer;margin-left:auto;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#EFE3C8}.aj-x:hover{background:rgba(255,255,255,.08)}.aj-x:focus-visible{outline:2px solid #E8C55A}',
      '.aj-body{overflow:auto;padding:18px 18px 6px;touch-action:pan-y}',
      '.aj-card{transition:transform .22s ease,opacity .22s ease}.aj-card.out-r{transform:translateX(110%) rotate(4deg);opacity:0}.aj-card.out-l{transform:translateX(-110%) rotate(-4deg);opacity:0}.aj-card.out-d{transform:translateY(30px);opacity:0}',
      '.aj-ch{display:flex;align-items:center;gap:12px}.aj-logo{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:17px;font-weight:800;background:linear-gradient(135deg,rgba(212,175,55,.25),rgba(var(--ah-mul),.18));color:var(--text)}',
      '.aj-ch h2{margin:0;font-size:21px;line-height:1.2}.aj-ch small{display:block;font-size:12.5px;color:var(--text3);margin-top:2px}',
      '.aj-ppl{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 4px}.aj-p{display:inline-flex;align-items:center;gap:7px;padding:3px 10px 3px 3px;border-radius:999px;background:var(--surface2);font-size:12.5px;color:var(--text)}.aj-p i{font-style:normal;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:10.5px;font-weight:800;background:rgba(var(--c-accent-rgb),.2);color:var(--c-accent-text)}',
      '.aj-lbl{display:block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin:14px 0 6px}',
      '.aj-why{font-size:14px;line-height:1.55;color:var(--text);margin:0}',
      '.aj-proof{list-style:none;margin:0;padding:0;border:1px solid var(--border);border-radius:14px;overflow:hidden}.aj-proof li{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:10px;align-items:start;padding:10px 12px;border-top:1px solid var(--border)}.aj-proof li:first-child{border-top:0}',
      '.aj-proof .k{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--surface2);color:var(--text2)}.aj-proof .k.ask,.aj-proof .k.commit,.aj-proof .k.terms{background:rgba(var(--ah-mul),.12);color:var(--ah-mul-t)}.aj-proof .k.meeting,.aj-proof .k.meeting_next{background:rgba(var(--c-accent-rgb),.16);color:var(--c-accent-text)}',
      '.aj-proof b{display:block;font-size:13px;color:var(--text);line-height:1.4}.aj-proof small{display:block;font-size:12px;color:var(--text3);margin-top:2px;line-height:1.4}.aj-proof a{font-size:12px;font-weight:600;color:var(--c-accent-text);text-decoration:none;white-space:nowrap}.aj-proof a:hover{text-decoration:underline}',
      '.aj-nextl{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(var(--c-accent-rgb),.08);font-size:13.5px;color:var(--text)}.aj-nextl span{flex:1}',
      '.aj-sug{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;margin-top:4px}.aj-sug label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:var(--text3)}',
      '.aj-sug select,.aj-sug input{font:inherit;font-size:14px;color:var(--text);background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:8px 10px;min-width:0}.aj-sug select:focus,.aj-sug input:focus{outline:2px solid var(--c-accent);outline-offset:1px}',
      '.aj-vin{display:flex;align-items:center;gap:6px}.aj-vin em{font-style:normal;font-size:13px;color:var(--text2)}.aj-vin input{flex:1}.aj-vf{grid-column:1/-1;font-size:12px;color:var(--text3);margin-top:-2px}',
      '.aj-own{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text3);margin-top:10px}',
      '.aj-rs{display:flex;flex-wrap:wrap;gap:8px;padding:12px 18px 0}.aj-rs[hidden]{display:none}.aj-rs p{width:100%;margin:0;font-size:13px;font-weight:600;color:var(--text)}.aj-rs button{all:unset;cursor:pointer;font-size:13px;font-weight:600;padding:7px 13px;border-radius:999px;border:1px solid var(--border);color:var(--text)}.aj-rs button:hover,.aj-rs button:focus-visible{border-color:rgba(var(--ah-mul),.6);color:var(--ah-mul-t);outline:none}',
      '.aj-foot{display:flex;gap:8px;align-items:center;padding:14px 18px;border-top:1px solid var(--border)}.aj-foot .sp{flex:1}.aj-foot kbd{font:inherit;font-size:10.5px;font-weight:700;padding:1px 5px;border-radius:5px;background:rgba(0,0,0,.08);opacity:.7}.ah-btn.gold kbd{background:rgba(0,0,0,.12)}',
      '.aj-tl{all:unset;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--text3)}.aj-tl:hover{color:var(--text)}.aj-tl:focus-visible{outline:2px solid var(--c-accent)}',
      '.aj-done{text-align:center;padding:34px 18px}.aj-done h2{margin:12px 0 6px;font-size:20px}.aj-done p{margin:0 0 16px;color:var(--text2);font-size:14px}.aj-done .aj-ico{margin:0 auto;width:52px;height:52px;border-radius:16px}',
      // Toast with Undo
      '.aj-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9500;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);padding:11px 12px 11px 16px;border-radius:14px;background:#2A1A11;color:#EFE3C8;font-size:13.5px;box-shadow:0 16px 40px rgba(0,0,0,.4),0 0 0 1px rgba(232,197,90,.25)}',
      '.aj-toast button{all:unset;cursor:pointer;font-weight:700;color:#E8C55A;padding:4px 8px;border-radius:8px;white-space:nowrap}.aj-toast button:hover,.aj-toast button:focus-visible{background:rgba(255,255,255,.08)}',
      // Tell SAM
      '.aj-tell textarea{width:100%;min-height:84px;box-sizing:border-box;font:inherit;font-size:14px;color:var(--text);background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:10px 12px;resize:vertical}.aj-tell textarea:focus{outline:2px solid var(--c-accent);outline-offset:1px}',
      '.aj-src{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;align-items:center;font-size:12.5px;color:var(--text3)}.aj-src button{all:unset;cursor:pointer;font-size:12.5px;font-weight:600;padding:5px 11px;border-radius:999px;border:1px solid var(--border);color:var(--text2)}.aj-src button.on{border-color:transparent;background:rgba(var(--c-accent-rgb),.2);color:var(--c-accent-text)}.aj-src button:focus-visible{outline:2px solid var(--c-accent)}',
      // Pipeline: the Spotted lane
      '.aj-only{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ah-mul-t);margin:-2px 0 8px}.rv-col.aj-col{background:linear-gradient(180deg,rgba(var(--ah-mul),.07),transparent 60%);border:1px dashed rgba(var(--ah-mul),.35)}.rv-col.aj-col header small{display:block;font-size:11px;color:var(--text3);font-weight:500}',
      '.rv-card.aj-ghost{border:1.5px dashed rgba(var(--ah-mul),.45)!important;background:transparent!important}.rv-card.aj-ghost .aj-gw{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;color:var(--text3);line-height:1.4;margin-top:4px}.rv-card.aj-ghost .aj-gr{font-size:12px;font-weight:700;color:var(--ah-mul-t);margin-top:6px}',
      // Your meetings
      '.aj-days{display:flex;gap:5px;overflow-x:auto;margin:4px 0 8px;padding-bottom:2px;scrollbar-width:none}.aj-days::-webkit-scrollbar{display:none}',
      '.aj-days button{all:unset;cursor:pointer;flex:1 0 38px;display:flex;flex-direction:column;align-items:center;min-width:38px;padding:5px 2px;border-radius:12px;border:1px solid var(--border);font-size:11px;font-weight:600;color:var(--text3)}.aj-days button b{font-size:14px;color:var(--text);font-variant-numeric:tabular-nums}.aj-days button i{font-style:normal;width:5px;height:5px;border-radius:50%;margin-top:3px;background:transparent}.aj-days button i.on{background:#C8961E}',
      '.aj-days button.on{border-color:transparent;background:linear-gradient(135deg,#2A1A11,#3B2518);color:#E8C55A}.aj-days button.on b{color:#EFE3C8}.aj-days button:focus-visible{outline:2px solid var(--c-accent)}',
      '.aj-ml{list-style:none;margin:0;padding:0}.aj-ml li{display:grid;grid-template-columns:46px minmax(0,1fr);gap:10px;padding:10px 0;border-top:1px solid var(--border)}.aj-ml li:first-child{border-top:0}',
      '.aj-ml .tm{font-size:13px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums;line-height:1.2}.aj-ml .tm small{display:block;font-size:11px;font-weight:500;color:var(--text3)}',
      '.aj-ml .mm b{display:block;font-size:13.5px;color:var(--text);line-height:1.35;overflow-wrap:anywhere}.aj-ml .mm small{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px;color:var(--text3);margin-top:3px}',
      '.aj-ml .ma{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}.aj-ml .ma a.ic{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;color:var(--text3)}.aj-ml .ma a.ic:hover{background:var(--surface2);color:var(--text)}',
      '.aj-ml li.past{opacity:.55}.aj-ml li.now .tm{color:var(--ah-mul-t)}.aj-live{display:inline-flex;align-items:center;gap:5px;font-weight:700;color:var(--ah-mul-t)}.aj-live::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 0 0 rgba(var(--ah-mul),.6);animation:ajPulse 1.6s infinite}',
      '@keyframes ajPulse{0%{box-shadow:0 0 0 0 rgba(var(--ah-mul),.55)}70%{box-shadow:0 0 0 8px rgba(var(--ah-mul),0)}100%{box-shadow:0 0 0 0 rgba(var(--ah-mul),0)}}',
      '@media (prefers-reduced-motion:reduce){.aj-card,.aj-bar i{transition:none}.aj-live::before{animation:none}}',
      '@media (max-width:600px){.aj-dw{padding:0;place-items:end center}.aj-stk{border-radius:22px 22px 0 0;max-height:94vh}.aj-foot kbd{display:none}.aj-foot{flex-wrap:wrap}.aj-foot .ah-btn{flex:1;justify-content:center}.aj-foot .sp{display:none}.aj-sug{grid-template-columns:1fr}.aj-spot .aj-logos{display:none}}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  var AJ = window._aj = window._aj || { d: null, at: 0, busy: false, scanning: false, prog: null, stack: null, cal: null, calAt: 0, day: null };
  var KIND_IC = { email_in: IC.inb, email_out: IC.out, email_cc: IC.inb, meeting: IC.cal, meeting_next: IC.video, notes: IC.notes, told: IC.chat, ask: IC.ask, commit: IC.commit, terms: IC.terms };
  var KIND_TX = { new: 'New company', existing: 'An account with no deal yet', expansion: 'Already a customer: expansion' };

  // ══ Data ═══════════════════════════════════════════════════════════════
  async function load(force) {
    if (!force && AJ.d && Date.now() - AJ.at < 60000) return AJ.d;
    if (AJ.busy) return AJ.d;
    AJ.busy = true;
    try { var d = await call('get_spotted_deals', {}); if (d && d.ok) { AJ.d = d; AJ.at = Date.now(); } } catch (_e) {}
    AJ.busy = false;
    return AJ.d;
  }
  async function scan(firstRun, quiet) {
    if (AJ.scanning) return;
    AJ.scanning = true; AJ.prog = { read: 0, total: null }; if (!quiet) paintSpot();
    var r = null;
    try {
      for (var i = 0; i < 40; i++) {
        r = await call('scan_spotted_deals', i === 0 ? { first: !!firstRun } : {});
        if (!r || !r.ok) break;
        AJ.prog = { read: r.read || 0, total: r.total || null };
        if (!quiet) paintSpot();
        if (r.done) break;
      }
    } catch (_e) {}
    AJ.scanning = false; AJ.prog = null;
    await load(true); paintSpot(); repaintBoard();
    if (!quiet && r) { if (r.ok && r.done) toast(r.note || 'Done.'); else if (r && r.error) toast(r.error); }
    if (r && r.moved && r.moved.length) toast('SAM moved ' + r.moved[0].company + ' to ' + r.moved[0].to_label + ', from "' + String(r.moved[0].quote || '').slice(0, 60) + '".');
  }
  function toast(msg, actions) {
    var old = document.getElementById('ajToast'); if (old) old.remove();
    var t = document.createElement('div'); t.id = 'ajToast'; t.className = 'aj-toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<span>' + e(msg) + '</span>' + (actions || []).map(function (a, i) { return '<button type="button" data-aj-ta="' + i + '">' + e(a.label) + '</button>'; }).join('');
    t.addEventListener('click', function (ev) { var b = ev.target.closest('[data-aj-ta]'); if (!b) return; var a = actions[Number(b.getAttribute('data-aj-ta'))]; t.remove(); if (a && a.fn) a.fn(); });
    document.body.appendChild(t);
    clearTimeout(AJ.tt); AJ.tt = setTimeout(function () { if (t.parentNode) t.remove(); }, actions && actions.length ? 9000 : 5000);
  }

  // ══ 1. Today: "SAM spotted N possible deals" ═══════════════════════════
  function spotHtml() {
    var d = AJ.d; if (!d) return '';
    var tell = '<button class="ah-btn sm ghost" type="button" data-aj-tell>' + IC.chat + 'Tell SAM</button>';
    if (AJ.scanning) {
      var p = AJ.prog || {}, pct = p.total ? Math.min(100, Math.round(p.read / p.total * 100)) : 8;
      return '<div class="aj-sl"><span class="aj-ico">' + IC.spark + '</span><div class="aj-st"><b>SAM is reading your last ' + (d.first_run ? '90 days' : 'few days') + '</b><small>' + (p.total ? e(p.read.toLocaleString()) + ' of ' + e(p.total.toLocaleString()) + ' emails, and your calendar.' : 'Your calendar and email.') + ' You can keep working.</small></div></div><div class="aj-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>';
    }
    if (d.mailbox === 'none' || d.mailbox === 'reconnect') {
      return '<div class="aj-sl"><span class="aj-ico">' + IC.spark + '</span><div class="aj-st"><b>' + (d.mailbox === 'none' ? 'Connect your mailbox so SAM can spot deals' : 'Reconnect your mailbox so SAM can spot deals') + '</b><small>SAM finds conversations that look like deals in your email and calendar, outside SAMpaigns.</small></div><div class="aj-acts0"><button class="ah-btn sm gold" type="button" onclick="try{switchTab(\'you\')}catch(_e){}">' + (d.mailbox === 'none' ? 'Connect' : 'Reconnect') + '</button>' + tell + '</div></div>';
    }
    if (d.first_run) {
      return '<div class="aj-sl"><span class="aj-ico">' + IC.spark + '</span><div class="aj-st"><b>Find deals that started outside SAMpaigns</b><small>SAM reads your last 90 days of email and calendar for meetings, pricing and proposals with companies that are not in Pipeline. You confirm each one. Only you see them.</small></div><div class="aj-acts0"><button class="ah-btn sm gold" type="button" data-aj-scan>Look back 90 days</button>' + tell + '</div></div>';
    }
    var n = (d.counts || {}).open || 0;
    var nx = (d.next_steps || []).slice(0, 3);
    var nxHtml = nx.length ? '<ul class="aj-nx" aria-label="Next steps on your outside deals">' + nx.map(function (x) {
      var j = x.next && x.next.join;
      return '<li><button class="c" type="button" data-aj-room="' + e(x.account_id) + '" data-aj-name="' + e(x.company) + '">' + e(x.company) + '</button>' + (x.stage_label ? '<span class="aj-chip">' + e(x.stage_label) + '</span>' : '') + '<span class="t">' + e(x.next ? x.next.text : '') + '</span>' + (j ? '<a class="ah-btn sm gold" href="' + e(j) + '" target="_blank" rel="noopener">' + IC.video + 'Join</a>' : '') + '</li>';
    }).join('') + '</ul>' : '';
    if (!n) return nx.length ? '<div class="aj-sl"><span class="aj-ico">' + IC.spark + '</span><div class="aj-st"><b>Your outside deals</b><small>Nothing new that looks like a deal. SAM checks your email and calendar every few hours.</small></div><div class="aj-acts0">' + tell + '</div></div>' + nxHtml : '';
    var logos = (d.cards || []).slice(0, 3).map(function (c) { return '<span title="' + e(c.company) + '">' + e(ini(c.company)) + '</span>'; }).join('');
    var names = (d.cards || []).slice(0, 2).map(function (c) { return c.company; });
    return '<div class="aj-sl"><span class="aj-ico">' + IC.spark + '</span><div class="aj-st"><b>SAM spotted ' + pl(n, 'possible deal') + '</b><small>' + e(names.join(', ') + (n > 2 ? ' and ' + (n - 2) + ' more' : '')) + ', from your email and calendar. Only you see these until you track one.</small></div>' +
      '<div class="aj-logos" aria-hidden="true">' + logos + '</div><div class="aj-acts0"><button class="ah-btn sm gold" type="button" data-aj-open>Review ' + n + '</button>' + tell + '</div></div>' + nxHtml;
  }
  function paintSpot() {
    var feed = document.getElementById('g24Feed'); if (!feed) return;
    var old = document.getElementById('ajSpot');
    var off = (typeof todayActiveSection !== 'undefined' && todayActiveSection !== 'tasks');
    var html = off ? '' : spotHtml();
    if (!html) { if (old) old.remove(); return; }
    if (!old) { old = document.createElement('section'); old.id = 'ajSpot'; old.className = 'aj-spot'; old.setAttribute('aria-label', 'Possible deals'); var calls = document.getElementById('aiCalls'); feed.parentNode.insertBefore(old, calls && calls.parentNode === feed.parentNode ? calls : feed); }
    old.innerHTML = html;
  }
  async function refreshToday() {
    await load(false); paintSpot();
    var d = AJ.d;
    if (d && d.stale && !d.first_run && !AJ.scanning && !d.mailbox_none && Date.now() - (AJ.autoAt || 0) > 600000) { AJ.autoAt = Date.now(); scan(false, true); }
  }
  if (typeof window.g24RenderFeed === 'function' && !window.g24RenderFeed._aj) {
    var baseFeed = window.g24RenderFeed;
    g24RenderFeed = window.g24RenderFeed = function () {
      var r = baseFeed.apply(this, arguments);
      try { if (!AJ.d || Date.now() - AJ.at > 60000) refreshToday(); else paintSpot(); } catch (_e) {}
      return r;
    };
    window.g24RenderFeed._aj = true;
  }

  // ══ 2. The stack: one card at a time ═══════════════════════════════════
  function stageOpts(c) {
    var st = (AJ.d && AJ.d.stages) || [];
    return st.map(function (s) { return '<option value="' + e(s.key) + '"' + (c.stage && c.stage.key === s.key ? ' selected' : '') + '>' + e(s.label) + '</option>'; }).join('');
  }
  function cardHtml(c) {
    var ppl = (c.people || []).slice(0, 5).map(function (p) { return '<span class="aj-p" title="' + e(p.email || '') + '"><i>' + e(ini(p.name)) + '</i>' + e(p.name) + '</span>'; }).join('');
    var proof = (c.proof || []).map(function (x) {
      var link = x.join ? '<a href="' + e(x.join) + '" target="_blank" rel="noopener">Join</a>' : x.link ? '<a href="' + e(x.link) + '" target="_blank" rel="noopener">Open</a>' : '';
      return '<li><span class="k ' + e(x.kind) + '">' + (KIND_IC[x.kind] || IC.notes) + '</span><div><b>' + e(x.title) + '</b><small>' + e([x.quote, day(x.at)].filter(Boolean).join(' · ')) + '</small></div>' + link + '</li>';
    }).join('');
    var v = c.value, cur = (v && v.currency) || (AJ.d && AJ.d.currency) || 'USD';
    var nx = c.next || {};
    return '<article class="aj-card" data-aj-card="' + e(c.key) + '">' +
      '<div class="aj-ch"><span class="aj-logo" aria-hidden="true">' + e(ini(c.company)) + '</span><div><h2>' + e(c.company) + '</h2><small>' + e([c.domain, KIND_TX[c.kind] || ''].filter(Boolean).join(' · ')) + '</small></div></div>' +
      (ppl ? '<div class="aj-ppl" aria-label="People">' + ppl + '</div>' : '') +
      '<span class="aj-lbl">Why SAM thinks so</span><p class="aj-why">' + e(c.why) + '</p>' +
      (proof ? '<span class="aj-lbl">The proof</span><ul class="aj-proof">' + proof + '</ul>' : '') +
      (nx.text ? '<span class="aj-lbl">Next</span><div class="aj-nextl">' + IC.arrow + '<span>' + e(nx.text) + '</span>' + (nx.join ? '<a class="ah-btn sm gold" href="' + e(nx.join) + '" target="_blank" rel="noopener">' + IC.video + 'Join</a>' : '') + '</div>' : '') +
      '<span class="aj-lbl">If you track it</span><div class="aj-sug"><label>Stage<select data-aj-stage aria-label="Stage">' + stageOpts(c) + '</select></label>' +
      '<label>Value<span class="aj-vin"><em>' + e(cur) + '</em><input data-aj-value data-cur="' + e(cur) + '" inputmode="numeric" placeholder="Add when you know" value="' + (v ? e(v.amount) : '') + '" aria-label="Deal value in ' + e(cur) + '"></span></label>' +
      (v ? '<div class="aj-vf">' + e(money(v.amount, v.currency)) + ' came up in ' + e(v.from) + '.</div>' : '') + '</div>' +
      '<div class="aj-own">' + IC.clock + '<span>Owner: you. SAM moves it on from the evidence, with Undo. Won only when you say.</span></div>' +
    '</article>';
  }
  function stackHtml() {
    var S = AJ.stack, list = S.list, c = list[S.i];
    var dots = list.map(function (_x, i) { return '<i class="' + (i === S.i ? 'on' : i < S.i ? 'done' : '') + '"></i>'; }).join('');
    if (!c) {
      return '<header class="aj-sh"><div><div class="eb">All caught up</div></div><button class="aj-x" type="button" data-aj-close aria-label="Close">' + IC.x + '</button></header>' +
        '<div class="aj-body"><div class="aj-done"><span class="aj-ico">' + IC.commit + '</span><h2>That is all for now</h2><p>' + (S.tracked ? pl(S.tracked, 'deal') + ' added to Pipeline. ' : '') + 'SAM keeps watching your email and calendar.</p>' +
        '<div class="aj-acts0" style="justify-content:center"><button class="ah-btn gold" type="button" data-aj-pipe>Open Pipeline</button><button class="ah-btn" type="button" data-aj-tell>' + IC.chat + 'Tell SAM about one</button></div></div></div>';
    }
    return '<header class="aj-sh"><div><div class="eb">Possible deal ' + (S.i + 1) + ' of ' + list.length + '</div><div class="aj-dots" aria-hidden="true">' + dots + '</div></div><button class="aj-x" type="button" data-aj-close aria-label="Close">' + IC.x + '</button></header>' +
      '<div class="aj-body">' + cardHtml(c) + '</div>' +
      '<div class="aj-rs" hidden><p>What is ' + e(c.company) + '? SAM remembers, for the whole team.</p>' + [['vendor', 'A vendor'], ['partner', 'A partner'], ['investor', 'An investor'], ['hiring', 'Hiring'], ['customer', 'Already a customer'], ['personal', 'Personal'], ['other', 'Something else']].map(function (r) { return '<button type="button" data-aj-reason="' + r[0] + '">' + r[1] + '</button>'; }).join('') + '</div>' +
      '<footer class="aj-foot"><button class="ah-btn" type="button" data-aj-no>Not a deal <kbd>N</kbd></button><button class="ah-btn ghost" type="button" data-aj-later>Later <kbd>L</kbd></button><span class="sp"></span><button class="ah-btn gold" type="button" data-aj-yes>' + IC.plus + 'Track it <kbd>Y</kbd></button></footer>';
  }
  function paintStack() {
    var w = document.getElementById('ajStack'); if (!w || !AJ.stack) return;
    w.querySelector('.aj-stk').innerHTML = stackHtml();
    var c = AJ.stack.list[AJ.stack.i];
    var f = w.querySelector(c ? '[data-aj-yes]' : '[data-aj-pipe]'); if (f) f.focus();
    wireSwipe(w.querySelector('.aj-card'));
  }
  async function openStack(key) {
    var d = await load(false);
    if (!d || !d.cards) return;
    var list = d.cards.slice();
    if (key) { var k = list.findIndex(function (c) { return c.key === key; }); if (k > 0) list.unshift(list.splice(k, 1)[0]); }
    AJ.stack = { list: list, i: 0, tracked: 0 };
    var old = document.getElementById('ajStack'); if (old) old.remove();
    var w = document.createElement('div'); w.id = 'ajStack'; w.className = 'aj-dw';
    w.innerHTML = '<div class="aj-stk" role="dialog" aria-modal="true" aria-label="Possible deals"></div>';
    w.addEventListener('click', function (ev) { if (ev.target === w) closeStack(); });
    document.body.appendChild(w);
    document.addEventListener('keydown', stackKey);
    paintStack();
  }
  function closeStack() { var w = document.getElementById('ajStack'); if (w) w.remove(); document.removeEventListener('keydown', stackKey); AJ.stack = null; paintSpot(); repaintBoard(); }
  function stackKey(ev) {
    if (!AJ.stack) return;
    if (ev.key === 'Escape') { var rs = document.querySelector('#ajStack .aj-rs'); if (rs && !rs.hidden) { rs.hidden = true; return; } closeStack(); return; }
    var tag = (ev.target && ev.target.tagName) || ''; if (/INPUT|SELECT|TEXTAREA/.test(tag) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var k = ev.key.toLowerCase();
    if (k === 'y') { ev.preventDefault(); act('yes'); } else if (k === 'n') { ev.preventDefault(); act('no'); } else if (k === 'l') { ev.preventDefault(); act('later'); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); move(1); } else if (ev.key === 'ArrowLeft') { ev.preventDefault(); move(-1); }
  }
  function move(n) { var S = AJ.stack; if (!S) return; S.i = Math.max(0, Math.min(S.list.length, S.i + n)); paintStack(); }
  function leave(dir) {
    return new Promise(function (res) {
      var c = document.querySelector('#ajStack .aj-card'); if (!c) return res();
      c.classList.add(dir === 'r' ? 'out-r' : dir === 'l' ? 'out-l' : 'out-d');
      setTimeout(res, window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200);
    });
  }
  function gone(key) {
    if (AJ.d && AJ.d.cards) { AJ.d.cards = AJ.d.cards.filter(function (c) { return c.key !== key; }); if (AJ.d.counts) AJ.d.counts.open = Math.max(0, (AJ.d.counts.open || 1) - 1); }
    var S = AJ.stack; if (S) { S.list.splice(S.i, 1); if (S.i > S.list.length) S.i = S.list.length; }
  }
  async function act(kind) {
    var S = AJ.stack; if (!S || S.busy) return;
    var c = S.list[S.i]; if (!c) return;
    var w = document.getElementById('ajStack');
    if (kind === 'no') { var rs = w.querySelector('.aj-rs'); rs.hidden = !rs.hidden; if (!rs.hidden) { var b = rs.querySelector('button'); if (b) b.focus(); } return; }
    S.busy = true;
    try {
      if (kind === 'yes') {
        var st = w.querySelector('[data-aj-stage]'), vi = w.querySelector('[data-aj-value]');
        var body = { key: c.key, stage_key: st ? st.value : undefined };
        if (vi && String(vi.value).trim() !== '') { body.value = String(vi.value).replace(/[^\d.]/g, ''); body.currency = vi.getAttribute('data-cur'); }
        var r = await call('track_spotted_deal', body);
        if (!r.ok) { toast(r.error || 'Could not add it.'); return; }
        await leave('r'); gone(c.key); S.tracked++;
        toast(r.note, [].concat(r.undo ? [{ label: 'Undo', fn: function () { undoTrack(r.undo.contact_id, c); } }] : []).concat([{ label: 'Open deal', fn: function () { closeStack(); openRoom(r.account_id, r.account_name); } }]));
        AJ.at = 0;
      } else if (kind === 'later') {
        var r2 = await call('snooze_spotted_deal', { key: c.key });
        if (!r2.ok) { toast(r2.error || 'Could not do that.'); return; }
        await leave('l'); gone(c.key); toast(r2.note);
      }
    } finally { S.busy = false; }
    paintStack(); try { scInvalidate(); } catch (_e) {}
  }
  async function dismiss(reason) {
    var S = AJ.stack; if (!S || S.busy) return; var c = S.list[S.i]; if (!c) return;
    S.busy = true;
    var r = await call('dismiss_spotted_deal', { key: c.key, reason: reason });
    S.busy = false;
    if (!r.ok) { toast(r.error || 'Could not do that.'); return; }
    await leave('d'); gone(c.key);
    toast(r.note, [{ label: 'Undo', fn: async function () { var u = await call('dismiss_spotted_deal', { key: c.key, undo: true }); toast(u.ok ? u.note : (u.error || 'Could not undo.')); AJ.at = 0; await load(true); paintSpot(); } }]);
    paintStack();
  }
  async function undoTrack(cid, c) {
    var r = await call('undo_deal_move', { contact_id: cid });
    toast(r.ok ? r.note : (r.error || 'Could not undo.'));
    if (r.ok && AJ.stack) { AJ.stack.tracked = Math.max(0, AJ.stack.tracked - 1); if (c) { AJ.stack.list.splice(AJ.stack.i, 0, c); paintStack(); } }
    if (r.ok) { AJ.at = 0; await load(true); paintSpot(); repaintBoard(); try { scInvalidate(); scRefreshCurrent(); } catch (_e) {} }
  }
  function openRoom(id, name) { try { if (typeof zRoomOpen === 'function') return zRoomOpen(id, name); } catch (_e) {} try { scOpen(id); } catch (_e2) {} }
  // Swipe on a phone: right to track, left for later.
  function wireSwipe(card) {
    if (!card || card._aj) return; card._aj = true;
    var x0 = null, y0 = null, dx = 0;
    card.addEventListener('pointerdown', function (ev) { if (ev.pointerType === 'mouse' || ev.target.closest('input,select,a,button')) return; x0 = ev.clientX; y0 = ev.clientY; dx = 0; card.style.transition = 'none'; });
    card.addEventListener('pointermove', function (ev) { if (x0 === null) return; dx = ev.clientX - x0; if (Math.abs(ev.clientY - y0) > Math.abs(dx) + 12) { x0 = null; card.style.transform = ''; return; } card.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 40) + 'deg)'; });
    var end = function () { if (x0 === null) return; x0 = null; card.style.transition = ''; card.style.transform = ''; if (dx > 90) act('yes'); else if (dx < -90) act('later'); };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  }

  // ══ 3. Tell SAM ═════════════════════════════════════════════════════════
  async function tellSam() {
    var srcs = [['whatsapp', 'WhatsApp'], ['linkedin', 'LinkedIn'], ['call', 'A call'], ['in_person', 'In person'], ['other', 'Other']];
    var w = document.createElement('div'); w.className = 'ah-dw'; w.style.zIndex = '9600';
    w.innerHTML = '<form class="ah-dlg aj-tell" role="dialog" aria-modal="true" aria-labelledby="ajTellH"><h3 id="ajTellH">Tell SAM about a deal</h3><p>For what SAM cannot see: WhatsApp, a call, a dinner. One line is enough: who, which company, what is next.</p>' +
      '<textarea id="ajTellT" maxlength="400" placeholder="Met Rishabh from RightChoice, onboarding Monday" aria-label="What happened"></textarea>' +
      '<div class="aj-src" role="group" aria-label="Where it happened"><span>Where:</span>' + srcs.map(function (s) { return '<button type="button" data-src="' + s[0] + '" aria-pressed="false">' + s[1] + '</button>'; }).join('') + '</div>' +
      '<div class="ah-da"><button class="ah-btn ghost" type="button" data-x>Cancel</button><button class="ah-btn gold" type="submit">Add it</button></div></form>';
    var src = '';
    var done = function () { w.remove(); document.removeEventListener('keydown', key); };
    var key = function (ev) { if (ev.key === 'Escape') done(); };
    w.addEventListener('click', function (ev) {
      if (ev.target === w || ev.target.closest('[data-x]')) return done();
      var b = ev.target.closest('[data-src]'); if (!b) return;
      src = src === b.getAttribute('data-src') ? '' : b.getAttribute('data-src');
      w.querySelectorAll('[data-src]').forEach(function (x) { var on = x.getAttribute('data-src') === src; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    });
    w.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var t = String(document.getElementById('ajTellT').value || '').trim();
      var btn = w.querySelector('[type="submit"]'); btn.disabled = true; btn.textContent = 'Adding…';
      var r = await call('tell_sam', { text: t, source: src || undefined });
      btn.disabled = false; btn.textContent = 'Add it';
      if (!r.ok) { toast(r.error || 'Could not add it.'); return; }
      done(); toast(r.note);
      AJ.at = 0; await load(true); paintSpot(); repaintBoard();
      if (r.card && r.card.status === 'open') { if (AJ.stack) { AJ.stack.list.splice(AJ.stack.i, 0, r.card); paintStack(); } else openStack(r.card.key); }
    });
    document.addEventListener('keydown', key);
    document.body.appendChild(w);
    setTimeout(function () { var x = document.getElementById('ajTellT'); if (x) x.focus(); }, 20);
  }

  // ══ 4. Pipeline: the Spotted lane before the first stage ═══════════════
  function laneHtml() {
    var d = AJ.d; if (!d || !d.cards || !d.cards.length) return '';
    return '<section class="rv-col aj-col" role="listitem" aria-label="Spotted by SAM"><header><b>Spotted by SAM</b><span>' + d.cards.length + '</span></header><div class="aj-only">' + IC.spark + 'Only you see these until you track one</div>' +
      d.cards.slice(0, 8).map(function (c) {
        return '<button class="rv-card aj-ghost" type="button" data-aj-open="' + e(c.key) + '"><span class="rv-ct"><b>' + e(c.company) + '</b><span>' + e(c.value ? money(c.value.amount, c.value.currency) : '') + '</span></span>' +
          '<span class="rv-cm">' + e(c.stage && c.stage.label ? 'Suggested: ' + c.stage.label : 'Possible deal') + '</span><span class="aj-gw">' + e(c.why) + '</span><span class="aj-gr">Review</span></button>';
      }).join('') + '</section>';
  }
  if (typeof window.sdBoardHtml === 'function' && !window.sdBoardHtml._aj) {
    var baseBoard = window.sdBoardHtml;
    sdBoardHtml = window.sdBoardHtml = function (d, by, where) {
      var h = baseBoard.apply(this, arguments);
      if (by === 'person') return h;
      if (!AJ.d) { if (!AJ.boardWait) { AJ.boardWait = true; load(false).then(function () { AJ.boardWait = false; if (AJ.d && AJ.d.cards && AJ.d.cards.length) repaintBoard(); }); } return h; }
      var lane = laneHtml(); if (!lane) return h;
      var mk = '<div class="rv-board" role="list">', k = h.indexOf(mk);
      return k < 0 ? h : h.slice(0, k + mk.length) + lane + h.slice(k + mk.length);
    };
    window.sdBoardHtml._aj = true;
  }
  // The list view: one line above the deals, with the same Review.
  function stripHtml() {
    var d = AJ.d; if (!d || !d.cards || !d.cards.length) return '';
    var n = d.cards.length;
    return '<span class="aj-ico">' + IC.spark + '</span><div class="aj-st"><b>Spotted by SAM: ' + pl(n, 'possible deal') + '</b><small>' + e(d.cards.slice(0, 3).map(function (c) { return c.company + (c.stage && c.stage.label ? ' (' + c.stage.label + ')' : ''); }).join(', ')) + '. Only you see these until you track one.</small></div><div class="aj-acts0"><button class="ah-btn sm gold" type="button" data-aj-open>Review ' + n + '</button></div>';
  }
  function paintStrip() {
    var el = document.getElementById('scDeals'); if (!el) return;
    var old = document.getElementById('ajStrip');
    var listView = typeof _sc !== 'undefined' && (_sc.view.dealsView || 'list') === 'list';
    var html = listView ? stripHtml() : '';
    if (!html) { if (old) old.remove(); return; }
    if (!old) { old = document.createElement('section'); old.id = 'ajStrip'; old.className = 'aj-spot aj-sl'; old.setAttribute('aria-label', 'Spotted by SAM'); var head = el.querySelector('.page-head'); if (head && head.parentNode) head.parentNode.insertBefore(old, head.nextSibling); else el.insertBefore(old, el.firstChild); }
    old.innerHTML = html;
  }
  if (typeof window.renderScDeals === 'function' && !window.renderScDeals._aj) {
    var baseDeals = window.renderScDeals;
    renderScDeals = window.renderScDeals = async function () {
      var r = await baseDeals.apply(this, arguments);
      try { if (!AJ.d) await load(false); paintStrip(); } catch (_e) {}
      return r;
    };
    window.renderScDeals._aj = true;
  }
  function repaintBoard() {
    try { paintStrip(); } catch (_e) {}
    try {
      if (typeof _sc === 'undefined') return;
      if (_sc.current === 'board' && document.getElementById('scBoard')) renderScBoard();
      else if (_sc.current === 'deals' && document.getElementById('scDeals') && (_sc.view.dealsView || 'list') === 'stage') renderScDeals();
    } catch (_e) {}
  }

  // ══ 5. Your meetings, with Join ════════════════════════════════════════
  async function calLoad(force) {
    if (!force && AJ.cal && Date.now() - AJ.calAt < 120000) return AJ.cal;
    var d = null;
    try { d = await call('get_my_calendar', { days: 7, from: ymd(new Date()) }); } catch (_e) { d = null; }
    AJ.cal = d; AJ.calAt = Date.now();
    return d;
  }
  var baseLoadSched = window.g24LoadSched, baseRenderSched = window.g24RenderSched;
  async function ajLoadSched() {
    if (typeof currentUser === 'undefined' || !currentUser || !currentUser.token) return;
    var d = await calLoad(false);
    if (!d || !d.ok || !Array.isArray(d.events)) { AJ.cal = null; if (baseLoadSched) return baseLoadSched.apply(this, arguments); return; }
    // The day's meetings keep feeding the brief and "add to tasks".
    var today = ymd(new Date());
    try {
      window._g24 = window._g24 || {};
      window._g24.meetDay = (typeof todayKey === 'function') ? todayKey() : today;
      window._g24.meetOk = d.connected !== false;
      window._g24.meet = d.events.filter(function (x) { return x.day === today && !x.all_day; }).map(function (x) {
        var acc = x.company && x.company.account_id ? x.company.name : null;
        return { text: (acc ? x.title : 'Meeting: ' + x.title) + ' at ' + hm(x.start), time: hm(x.start), title: x.title, account_id: x.company ? x.company.account_id : null, account_name: acc, source: 'calendar', calendar_event_id: x.id, agenda: x.agenda || null };
      });
    } catch (_e) {}
    ajRenderSched();
    try { g24RenderBrief(); } catch (_e) {}
  }
  function meetRow(x, i) {
    var now = Date.now(), s = Date.parse(x.start), en = Date.parse(x.end);
    var live = s <= now && en > now, soon = s > now && s - now < 3600e3, past = en <= now;
    var who = (x.attendees || []).filter(function (a) { return a.external; }).map(function (a) { return first(a.name); }).slice(0, 3);
    var co = x.company;
    var coChip = co ? (co.is_deal && co.stage_label ? '<span class="aj-chip">' + e(co.name) + ' · ' + e(co.stage_label) + '</span>' : co.spotted ? '<span class="aj-chip mul">' + e(co.name) + ' · possible deal</span>' : co.won ? '<span class="aj-chip">' + e(co.name) + ' · customer</span>' : '<span class="aj-chip dim">' + e(co.name) + '</span>') : '';
    var when = live ? '<span class="aj-live">Now</span>' : soon ? '<span class="aj-live">In ' + Math.max(1, Math.round((s - now) / 60000)) + ' min</span>' : '';
    var join = x.join && !past ? '<a class="ah-btn sm gold" href="' + e(x.join.url) + '" target="_blank" rel="noopener" data-aj-join="' + e(x.id) + '" aria-label="Join ' + e(x.title) + ' on ' + e(x.join.label) + '">' + IC.video + 'Join</a>' : '';
    var prep = co && co.account_id ? '<button class="ah-btn sm" type="button" data-aj-room="' + e(co.account_id) + '" data-aj-name="' + e(co.name) + '">' + (co.is_deal ? 'Prep' : 'Account') + '</button>' : co && co.spotted ? '<button class="ah-btn sm mul" type="button" data-aj-open="' + e(co.spotted) + '">Review deal</button>' : '';
    var have = false; try { have = (dayData(todayKey()).tasks || []).some(function (t) { return String(t.calendarEventId || '') === String(x.id); }); } catch (_e) {}
    var add = x.day !== ymd(new Date()) || x.all_day || past ? '' : have ? '<span class="aj-chip dim">' + IC.commit + 'On your tasks</span>' : '<button class="ah-btn sm ghost" type="button" data-aj-task="' + e(x.id) + '" aria-label="Add ' + e(x.title) + ' to your tasks">' + IC.plus + 'Task</button>';
    var open = x.open_url ? '<a class="ic" href="' + e(x.open_url) + '" target="_blank" rel="noopener" title="Open in your calendar" aria-label="Open ' + e(x.title) + ' in your calendar">' + IC.ext + '</a>' : '';
    var place = x.in_person && x.location ? '<span>' + IC.pin + e(x.location) + '</span>' : x.join ? '<span>' + IC.video + e(x.join.label) + '</span>' : '';
    var t = x.all_day ? '<div class="tm">All<small>day</small></div>' : '<div class="tm">' + e(hm(x.start).replace(/ (am|pm)$/, '')) + '<small>' + e((hm(x.start).match(/(am|pm)$/) || [''])[0]) + '</small></div>';
    return '<li class="' + (live ? 'now' : past ? 'past' : '') + '">' + t + '<div class="mm"><b>' + e(x.title) + '</b><small>' + when + coChip + (who.length ? '<span>' + e(who.join(', ')) + ((x.external || 0) > who.length ? ' +' + (x.external - who.length) : '') + '</span>' : '') + place + '</small>' +
      (join || prep || add || open ? '<div class="ma">' + join + prep + add + open + '</div>' : '') + '</div></li>';
  }
  function ajRenderSched() {
    var el = document.getElementById('g24Sched'); if (!el) return;
    if (typeof _g24IsToday === 'function' && !_g24IsToday()) { el.innerHTML = ''; el.hidden = true; return; }
    var d = AJ.cal;
    if (!d || !d.ok) { if (baseRenderSched) return baseRenderSched.apply(this, arguments); return; }
    el.hidden = false;
    if (d.connected === false || d.error) { el.innerHTML = '<div class="g24-rh"><span>' + IC.cal + 'Your meetings</span></div><div class="g24-empty">' + (d.reason === 'none' ? 'Connect your calendar in You to see your meetings here, with Join.' : 'Reconnect your calendar in You to see your meetings here.') + '</div>'; return; }
    var days = []; var base = new Date(); base.setHours(12, 0, 0, 0);
    for (var i = 0; i < 7; i++) { var t = new Date(base.getTime() + i * 86400000); days.push(ymd(t)); }
    if (!AJ.day || days.indexOf(AJ.day) < 0) AJ.day = days[0];
    var by = {}; d.events.slice().sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); }).forEach(function (x) { (by[x.day] = by[x.day] || []).push(x); });
    var pills = days.map(function (k, i) {
      var t = new Date(k + 'T12:00:00'), n = (by[k] || []).length;
      var top = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : t.toLocaleDateString('en-GB', { weekday: 'short' });
      return '<button type="button" role="tab" aria-selected="' + (k === AJ.day) + '" class="' + (k === AJ.day ? 'on' : '') + '" data-aj-day="' + k + '" aria-label="' + e(t.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })) + ', ' + pl(n, 'meeting') + '">' + e(top) + '<b>' + t.getDate() + '</b><i class="' + (n ? 'on' : '') + '"></i></button>';
    }).join('');
    var list = (by[AJ.day] || []).filter(function (x) { return !x.all_day; }).concat((by[AJ.day] || []).filter(function (x) { return x.all_day; }));
    var isToday = AJ.day === days[0];
    var body = list.length ? '<ul class="aj-ml">' + list.map(meetRow).join('') + '</ul>' : '<div class="g24-empty">' + (isToday ? 'No meetings today. Good day for outreach.' : 'No meetings that day.') + '</div>';
    var n0 = (by[days[0]] || []).length;
    el.innerHTML = '<div class="g24-rh"><span>' + IC.cal + 'Your meetings</span>' + (n0 ? '<b>' + n0 + ' today</b>' : '') + '</div><div class="aj-days" role="tablist" aria-label="Day">' + pills + '</div>' + body;
  }
  g24LoadSched = window.g24LoadSched = ajLoadSched;
  g24RenderSched = window.g24RenderSched = function () { if (AJ.cal && AJ.cal.ok) return ajRenderSched(); if (baseRenderSched) return baseRenderSched.apply(this, arguments); };
  // Keep "Now" and "In 5 min" true while Today is open.
  setInterval(function () { try { if (AJ.cal && AJ.cal.ok && document.getElementById('g24Sched') && !document.hidden) ajRenderSched(); } catch (_e) {} }, 60000);

  // ══ Clicks ═════════════════════════════════════════════════════════════
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-aj-open],[data-aj-tell],[data-aj-scan],[data-aj-close],[data-aj-yes],[data-aj-no],[data-aj-later],[data-aj-reason],[data-aj-pipe],[data-aj-room],[data-aj-day],[data-aj-task]');
    if (!t) return;
    if (t.hasAttribute('data-aj-open')) { ev.preventDefault(); openStack(t.getAttribute('data-aj-open') || null); }
    else if (t.hasAttribute('data-aj-tell')) tellSam();
    else if (t.hasAttribute('data-aj-scan')) scan(true, false);
    else if (t.hasAttribute('data-aj-close')) closeStack();
    else if (t.hasAttribute('data-aj-yes')) act('yes');
    else if (t.hasAttribute('data-aj-no')) act('no');
    else if (t.hasAttribute('data-aj-later')) act('later');
    else if (t.hasAttribute('data-aj-reason')) dismiss(t.getAttribute('data-aj-reason'));
    else if (t.hasAttribute('data-aj-pipe')) { closeStack(); try { switchTab('exec'); } catch (_e) {} }
    else if (t.hasAttribute('data-aj-room')) openRoom(t.getAttribute('data-aj-room'), t.getAttribute('data-aj-name'));
    else if (t.hasAttribute('data-aj-day')) { AJ.day = t.getAttribute('data-aj-day'); ajRenderSched(); var b = document.querySelector('[data-aj-day="' + AJ.day + '"]'); if (b) b.focus(); }
    else if (t.hasAttribute('data-aj-task')) {
      var id = t.getAttribute('data-aj-task'), m = (window._g24 && window._g24.meet || []).findIndex(function (x) { return x.calendar_event_id === id; });
      if (m >= 0 && typeof g24AddMeet === 'function') { g24AddMeet(m); setTimeout(ajRenderSched, 0); }
    }
  });

  window._ajApi = { load: load, scan: scan, openStack: openStack, tellSam: tellSam, calLoad: calLoad };
  window._ajReady = true;
})();
