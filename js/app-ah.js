// Drop AH (27 Nov 2026): People across SAMpaigns, one live SAMpaign per
// person, the Outbox, Today by type with a focused session, Ask SAM about an
// account, starter SAMpaigns, the account as one stream, and empty states
// that say what to do next.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function call(action, body) { return _sampEdge(action, body || {}); }
  function toast(m) { try { showToast(m); } catch (_e) {} }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function ini(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function first(n) { return String(n || '').split(' ')[0]; }
  function ago(iso) {
    if (!iso) return ''; var t = Date.parse(iso); if (isNaN(t)) return '';
    var d = Math.round((Date.now() - t) / 60000);
    if (d < 0) { var f = -d; return f < 60 ? 'in ' + f + ' min' : f < 1440 ? 'in ' + Math.round(f / 60) + ' h' : 'in ' + Math.round(f / 1440) + ' d'; }
    return d < 1 ? 'just now' : d < 60 ? d + ' min ago' : d < 1440 ? Math.round(d / 60) + ' h ago' : d < 2880 ? 'yesterday' : Math.round(d / 1440) + ' days ago';
  }
  function dayLbl(iso) {
    var t = new Date(iso); if (isNaN(t)) return '';
    var a = new Date(); a.setHours(0, 0, 0, 0); var b = new Date(t); b.setHours(0, 0, 0, 0);
    var n = Math.round((b - a) / 86400000);
    if (n === 0) return 'Today'; if (n === -1) return 'Yesterday'; if (n === 1) return 'Tomorrow';
    return t.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function tm(iso) { var t = new Date(iso); return isNaN(t) ? '' : t.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }); }
  function shortDay(iso) { var t = new Date(iso); return isNaN(t) ? '' : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }

  var I = function (d, w) { return '<svg class="ah-i" width="' + (w || 16) + '" height="' + (w || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var IC = {
    open: I('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>'),
    add: I('<path d="M12 5v14M5 12h14"/>'),
    mail: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>'),
    li: I('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V16M8 7.6v.1M12 16v-3.2a2.3 2.3 0 014.6 0V16M12 10.5V16"/>'),
    call: I('<path d="M5 4h3.5l1.8 4.3-2.3 1.5a11 11 0 005.2 5.2l1.5-2.3L19 14.5V18a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"/>'),
    x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
    spark: I('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
    search: I('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
    warn: I('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.1"/>'),
    stop: I('<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>'),
    play: I('<path d="M7 5l12 7-12 7z"/>'),
    next: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    back: I('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    meeting: I('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    reply: I('<path d="M10 8L4 13l6 5M4 13h10a6 6 0 016 6"/>'),
    email: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>'),
    deal: I('<path d="M4 17l5-5 4 4 7-8"/><path d="M14 8h6v6"/>'),
    crm: I('<path d="M4 7h16M4 12h10M4 17h7"/>'),
    risk: I('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.1"/>'),
    save: I('<path d="M6 4h10l4 4v12H4V4z"/><path d="M8 4v5h7"/>'),
    star: I('<path d="M12 4l2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8z"/>'),
    retry: I('<path d="M20 11a8 8 0 00-14.6-4.5M4 4v4h4M4 13a8 8 0 0014.6 4.5M20 20v-4h-4"/>')
  };

  (function css() {
    if (document.getElementById('ahCss')) return;
    var st = document.createElement('style'); st.id = 'ahCss';
    st.textContent = [
      ':root{--ah-brown:#2A1A11;--ah-brown2:#3B2518;--ah-gold:#D4AF37;--ah-gold2:#E8C55A;--ah-mul:122,36,84;--ah-mul-t:#9C2F6B}',
      '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ah-mul-t:#E07BB4}}:root[data-theme="dark"],html.dark{--ah-mul-t:#E07BB4}',
      '.ah-i{flex:none;vertical-align:-3px}',
      // Empty states: dark brown, gold line art, a mulberry glow.
      '.ah-empty{position:relative;overflow:hidden;display:flex;align-items:center;gap:20px;padding:22px 24px;border-radius:18px;background:linear-gradient(155deg,var(--ah-brown2),var(--ah-brown));color:#EFE9DF;isolation:isolate}',
      '.ah-empty::before{content:"";position:absolute;inset:-40% -10% auto auto;width:70%;height:160%;background:radial-gradient(closest-side,rgba(var(--ah-mul),.55),rgba(var(--ah-mul),0));filter:blur(8px);z-index:-1;animation:ahGlow 9s ease-in-out infinite alternate}',
      '@keyframes ahGlow{from{transform:translate(0,0)}to{transform:translate(-14%,8%)}}@media (prefers-reduced-motion:reduce){.ah-empty::before{animation:none}}',
      '.ah-empty svg.ah-art{flex:none;width:96px;height:96px}.ah-empty h4{margin:0 0 4px;font-size:16px;font-weight:650;color:var(--ah-gold2)}.ah-empty p{margin:0;font-size:13.5px;line-height:1.5;color:rgba(239,233,223,.82)}',
      '.ah-empty .ah-ea{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}',
      '.ah-empty.sm{padding:16px 18px;gap:14px}.ah-empty.sm svg.ah-art{width:64px;height:64px}.ah-empty.sm h4{font-size:14.5px}.ah-empty.sm p{font-size:12.5px}',
      '@media (max-width:560px){.ah-empty{flex-direction:column;align-items:flex-start;text-align:left}}',
      '.ah-btn{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;font-weight:600;padding:7px 13px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;white-space:nowrap}.ah-btn:hover{border-color:var(--c-accent)}.ah-btn:focus-visible{outline:2px solid var(--c-accent);outline-offset:2px}',
      '.ah-btn.gold{background:linear-gradient(135deg,#B8860B,#E8B84B 55%,#C8961E);border-color:transparent;color:#1E140C}.ah-btn.gold:hover{filter:brightness(1.05)}',
      '.ah-btn.ghost{background:transparent}.ah-btn.mul{border-color:rgba(var(--ah-mul),.45);color:var(--ah-mul-t);background:rgba(var(--ah-mul),.06)}.ah-btn.sm{font-size:12px;padding:4px 10px}.ah-btn[disabled]{opacity:.55;cursor:default}',
      '.ah-empty .ah-btn{border-color:rgba(232,197,90,.4);background:rgba(255,255,255,.04);color:#EFE9DF}.ah-empty .ah-btn.gold{color:#1E140C}',
      // Sub navigation in SAMpaigns
      '.ah-tabs{display:flex;gap:4px;padding:4px;border-radius:999px;background:var(--surface2);border:1px solid var(--border);width:max-content;max-width:100%;overflow-x:auto;margin:4px 0 12px}',
      '.ah-tab{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:7px;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:600;color:var(--text2);white-space:nowrap}.ah-tab:hover{color:var(--text)}.ah-tab:focus-visible{outline:2px solid var(--c-accent)}',
      '.ah-tab.on{background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.12)}.ah-tab i{font-style:normal;font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;background:rgba(var(--ah-mul),.14);color:var(--ah-mul-t)}.ah-tab i.g{background:rgba(var(--c-accent-rgb),.18);color:var(--c-accent-text)}',
      // Page
      '.ah-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}.ah-head h2{margin:0;font-size:24px;font-weight:700;letter-spacing:-.01em}.ah-head p{margin:4px 0 0;color:var(--text2);font-size:13.5px}',
      '.ah-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:6px 0 12px}',
      '.ah-kpi{all:unset;cursor:pointer;box-sizing:border-box;padding:12px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface);display:flex;flex-direction:column;gap:2px;min-width:0}.ah-kpi:hover{border-color:var(--c-accent)}.ah-kpi:focus-visible{outline:2px solid var(--c-accent)}',
      '.ah-kpi b{font-size:22px;font-variant-numeric:tabular-nums;color:var(--text)}.ah-kpi span{font-size:12.5px;color:var(--text2)}.ah-kpi small{font-size:11.5px;color:var(--text3)}',
      '.ah-kpi.fix{border-color:rgba(var(--ah-mul),.4);background:linear-gradient(150deg,rgba(var(--ah-mul),.08),transparent 70%)}.ah-kpi.fix b{color:var(--ah-mul-t)}.ah-kpi.on{box-shadow:inset 0 0 0 2px var(--c-accent)}',
      '.ah-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}',
      '.ah-srch{flex:1 1 220px;display:flex;align-items:center;gap:6px;border:1px solid var(--c-line-strong);border-radius:999px;padding:0 12px;background:var(--surface);color:var(--text3);min-width:0}.ah-srch input{all:unset;flex:1;font-size:13.5px;padding:8px 0;color:var(--text);min-width:0}',
      '.ah-sel{font:inherit;font-size:13px;color:var(--text);border:1px solid var(--c-line-strong);border-radius:999px;padding:7px 10px;background:var(--surface);max-width:220px}',
      '.ah-seg{display:inline-flex;border:1px solid var(--c-line-strong);border-radius:999px;overflow:hidden}.ah-seg button{all:unset;cursor:pointer;font-size:12.5px;font-weight:600;padding:7px 12px;color:var(--text2)}.ah-seg button.on{background:var(--text);color:var(--bg)}.ah-seg button:focus-visible{outline:2px solid var(--c-accent)}',
      '.ah-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}',
      '.ah-chip{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;padding:5px 11px;border-radius:999px;border:1px solid var(--border);color:var(--text2);background:var(--surface)}.ah-chip:hover{color:var(--text)}.ah-chip b{font-variant-numeric:tabular-nums;color:var(--text3);font-weight:700}.ah-chip.on{border-color:var(--c-accent);background:rgba(var(--c-accent-rgb),.12);color:var(--text)}.ah-chip.on b{color:var(--c-accent-text)}.ah-chip:focus-visible{outline:2px solid var(--c-accent)}',
      // People table
      '.ah-card{border:1px solid var(--border);border-radius:16px;background:var(--surface);overflow:hidden}',
      '.ah-t{width:100%;border-collapse:collapse;font-size:13px}.ah-t th{text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--text3);padding:10px 12px;font-weight:700;background:var(--surface2);white-space:nowrap}',
      '.ah-t td{padding:10px 12px;border-top:1px solid var(--border);vertical-align:top;color:var(--text2)}.ah-t tr.fix td:first-child{box-shadow:inset 3px 0 0 rgba(var(--ah-mul),.9)}.ah-t tr:hover td{background:rgba(127,127,127,.035)}',
      '.ah-who{display:flex;gap:10px;align-items:flex-start;min-width:0}.ah-av{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;background:rgba(var(--c-accent-rgb),.16);color:var(--c-accent-text);flex:none}',
      '.ah-who b{color:var(--text);font-weight:650;font-size:13.5px}.ah-who small,.ah-t small{display:block;color:var(--text3);font-size:12px;line-height:1.4}',
      '.ah-st{display:inline-block;font-size:11.5px;font-weight:650;padding:2px 9px;border-radius:999px;white-space:nowrap;background:rgba(127,127,127,.12);color:var(--text2)}',
      '.ah-st.deal{background:rgba(var(--c-accent-rgb),.18);color:var(--c-accent-text)}.ah-st.meeting{background:rgba(46,107,69,.15);color:#2E7D4F}.ah-st.replied{background:rgba(59,91,153,.15);color:#4569B0}.ah-st.dropped{background:rgba(127,127,127,.1);color:var(--text3)}',
      '.ah-flag{display:inline-flex;align-items:center;gap:5px;margin-top:6px;font-size:11.5px;font-weight:650;padding:3px 9px;border-radius:999px;background:rgba(var(--ah-mul),.12);color:var(--ah-mul-t)}',
      '.ah-fix{margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '.ah-acts{display:flex;gap:4px;justify-content:flex-end}.ah-ib{all:unset;cursor:pointer;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;color:var(--text2)}.ah-ib:hover{background:var(--surface2);color:var(--text)}.ah-ib:focus-visible{outline:2px solid var(--c-accent)}.ah-ib[aria-disabled="true"]{opacity:.3;cursor:default;pointer-events:none}',
      '.ah-ck{width:16px;height:16px;accent-color:#B8860B}',
      '.ah-bulk{position:sticky;bottom:12px;z-index:5;margin-top:10px;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;background:var(--ah-brown);color:#EFE9DF;box-shadow:0 10px 30px rgba(0,0,0,.25)}.ah-bulk span{flex:1;font-size:13px}',
      '.ah-more{all:unset;cursor:pointer;display:block;text-align:center;padding:10px;font-size:13px;font-weight:600;color:var(--c-accent-text);border-top:1px solid var(--border)}',
      '@media (max-width:560px){.ah-tab{padding:6px 10px;font-size:12.5px}.ah-tab i{padding:1px 5px}}',
      '@media (max-width:760px){.ah-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.ah-t thead{display:none}.ah-t,.ah-t tbody,.ah-t tr,.ah-t td{display:block;width:100%;box-sizing:border-box}.ah-t tr{border-top:1px solid var(--border);padding:8px 0}.ah-t td{border:0;padding:4px 12px}.ah-t td.ah-hm{display:none}.ah-acts{justify-content:flex-start}.ah-head h2{font-size:21px}.ah-sel{max-width:none;flex:1 1 40%}}',
      // Outbox
      '.ah-ob{list-style:none;margin:0;padding:0}.ah-ob li{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:12px;padding:12px 14px;border-top:1px solid var(--border);align-items:start}.ah-ob li:first-child{border-top:0}',
      '.ah-obm{min-width:0}.ah-obm b{color:var(--text);font-size:13.5px}.ah-obm .s{font-weight:650;color:var(--text);font-size:13px;margin-top:2px}.ah-obm .p{color:var(--text3);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ah-obr{text-align:right;font-size:12px;color:var(--text3);display:flex;flex-direction:column;gap:6px;align-items:flex-end}',
      '.ah-dh{padding:8px 14px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;color:var(--text3);background:var(--surface2)}',
      '.ah-banner{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:14px;border:1px solid rgba(var(--ah-mul),.35);background:rgba(var(--ah-mul),.06);margin-bottom:10px;font-size:13px;color:var(--text2)}.ah-banner b{color:var(--text)}.ah-banner span{flex:1}',
      '.ah-pulse{font-size:13px;color:var(--text2);margin:0 0 10px}.ah-pulse b{color:var(--text)}',
      '@media (max-width:560px){.ah-ob li{grid-template-columns:28px minmax(0,1fr)}.ah-obr{grid-column:2;align-items:flex-start;text-align:left;flex-direction:row;flex-wrap:wrap}}',
      // Dialog
      '.ah-dw{position:fixed;inset:0;z-index:2100;background:rgba(12,8,6,.55);display:grid;place-items:center;padding:16px}',
      '.ah-dlg{width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;border-radius:18px;background:var(--surface);color:var(--text);box-shadow:0 24px 60px rgba(0,0,0,.35);padding:20px}',
      '.ah-dlg h3{margin:0 0 6px;font-size:17px}.ah-dlg p{margin:0 0 10px;font-size:13.5px;color:var(--text2);line-height:1.5}.ah-dlg ul{margin:6px 0 12px;padding-left:18px;font-size:13px;color:var(--text2)}.ah-dlg .ah-da{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}',
      '.ah-pick{list-style:none;padding:0;margin:8px 0}.ah-pick li{margin:0}.ah-pick button{all:unset;cursor:pointer;box-sizing:border-box;width:100%;display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:12px;font-size:13.5px}.ah-pick button:hover,.ah-pick button:focus-visible{background:var(--surface2)}.ah-pick small{color:var(--text3)}',
      // Today chips and session
      '.ah-tbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 10px}.ah-tbar .ah-chips{margin:0;flex:1}',
      '.ah-sw{position:fixed;inset:0;z-index:2000;background:radial-gradient(1200px 600px at 80% -10%,rgba(var(--ah-mul),.35),transparent 60%),rgba(14,9,6,.72);display:flex;align-items:center;justify-content:center;padding:16px}',
      '.ah-ss{width:min(720px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;border-radius:22px;background:var(--surface);box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden}',
      '.ah-sh{display:flex;align-items:center;gap:12px;padding:16px 18px 10px}.ah-sh b{font-size:15px}.ah-sh small{color:var(--text3);font-size:12.5px}.ah-sh .sp{flex:1}',
      '.ah-pg{height:4px;background:var(--surface2)}.ah-pg i{display:block;height:100%;background:linear-gradient(90deg,#B8860B,#E8B84B);transition:width .25s}',
      '.ah-sb{padding:14px 18px;overflow:auto;flex:1}.ah-sb .g24-list{margin:0}',
      '.ah-sf{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:12px 18px;border-top:1px solid var(--border)}.ah-sf small{color:var(--text3);font-size:12px}',
      '@media (max-width:640px){.ah-sw{padding:0;align-items:stretch}.ah-ss{border-radius:0;max-height:none;height:100%}.ah-sf small{display:none}}',
      // Ask SAM
      '.ah-ask{padding:2px 0}.ah-askq{display:flex;gap:6px;margin-top:10px}.ah-askq input{flex:1;min-width:0;font:inherit;font-size:13.5px;color:var(--text);border:1px solid var(--c-line-strong);border-radius:999px;padding:8px 12px;background:var(--surface)}',
      '.ah-ans{margin-top:12px;padding:14px 16px;border-radius:14px;border:1px solid rgba(var(--c-accent-rgb),.3);background:linear-gradient(160deg,rgba(var(--c-accent-rgb),.07),rgba(var(--ah-mul),.04))}',
      '.ah-ans h5{margin:0 0 8px;font-size:14.5px;line-height:1.45;color:var(--text)}.ah-ans ol,.ah-ans ul{margin:0;padding-left:18px}.ah-ans li{font-size:13.5px;line-height:1.5;color:var(--text2);margin:6px 0}',
      '.ah-src{display:inline-flex;align-items:center;gap:4px;margin:3px 4px 0 0;font-size:11.5px;padding:2px 8px;border-radius:999px;background:var(--surface2);color:var(--text3);cursor:pointer;border:0;font-family:inherit}.ah-src:hover{color:var(--text)}.ah-src em{font-style:normal;font-weight:700;color:var(--c-accent-text)}',
      '.ah-nx{margin-top:10px;display:flex;gap:8px;align-items:flex-start;font-size:13.5px;color:var(--text)}.ah-nx .ah-i{color:var(--c-accent-text);margin-top:2px}',
      '.ah-meta{margin-top:8px;font-size:12px;color:var(--text3)}.ah-meta button{all:unset;cursor:pointer;color:var(--c-accent-text);font-weight:600}',
      '.ah-sk{height:12px;border-radius:6px;background:rgba(127,127,127,.14);margin:9px 0;animation:ahPl 1.2s ease-in-out infinite}@keyframes ahPl{50%{opacity:.45}}',
      // Activity
      '.ah-act{list-style:none;margin:8px 0 0;padding:0}.ah-act li.d{font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;color:var(--text3);padding:12px 0 4px}',
      '.ah-act li.i{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;padding:8px 0;border-top:1px solid var(--border)}.ah-act li.d + li.i{border-top:0}',
      '.ah-act li.i.hl{background:rgba(var(--c-accent-rgb),.12);border-radius:10px}',
      '.ah-ai{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:var(--surface2);color:var(--text2)}',
      '.ah-ai.meeting,.ah-ai.deal{background:rgba(var(--c-accent-rgb),.16);color:var(--c-accent-text)}.ah-ai.reply{background:rgba(46,107,69,.14);color:#2E7D4F}.ah-ai.linkedin{background:rgba(59,91,153,.14);color:#4569B0}.ah-ai.risk{background:rgba(var(--ah-mul),.14);color:var(--ah-mul-t)}',
      '.ah-at{font-size:13.5px;color:var(--text);font-weight:600;line-height:1.4}.ah-aq{font-size:13px;color:var(--text2);line-height:1.45;margin-top:2px}.ah-am{font-size:12px;color:var(--text3);margin-top:2px}',
      // Starters
      '.ah-sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}',
      '.ah-stc{position:relative;display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:18px;border:1px solid var(--border);background:var(--surface);min-width:0}',
      '.ah-stc.pick{border-color:rgba(var(--c-accent-rgb),.6);box-shadow:0 0 0 1px rgba(var(--c-accent-rgb),.25),0 12px 30px rgba(var(--ah-mul),.12)}',
      '.ah-stc h4{margin:0;font-size:16px}.ah-stc p{margin:0;font-size:13px;color:var(--text2);line-height:1.45}',
      '.ah-badge{position:absolute;top:14px;right:14px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:linear-gradient(135deg,#B8860B,#E8B84B);color:#1E140C}',
      '.ah-trk{display:flex;align-items:flex-end;gap:3px;height:58px;padding:8px 10px;border-radius:12px;background:linear-gradient(160deg,var(--ah-brown2),var(--ah-brown));overflow:hidden}',
      '.ah-trk span{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}.ah-trk i{display:block;width:100%;max-width:26px;border-radius:5px 5px 2px 2px}.ah-trk i.e{background:#E8C55A;height:26px}.ah-trk i.l{background:#8FA8DA;height:18px}.ah-trk small{font-size:10px;color:rgba(239,233,223,.7);white-space:nowrap}',
      '.ah-nums{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.ah-nums div{padding:8px;border-radius:10px;background:var(--surface2)}.ah-nums b{display:block;font-size:15px;font-variant-numeric:tabular-nums}.ah-nums small{font-size:11px;color:var(--text3)}',
      '.ah-yours{font-size:12.5px;color:var(--text2)}.ah-yours b{color:var(--text)}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  // ══ Empty states ══════════════════════════════════════════════════════
  var ART = {
    people: '<circle cx="34" cy="38" r="11"/><circle cx="64" cy="34" r="13"/><path d="M16 78c2-12 10-19 18-19s14 4 17 11M44 80c3-14 11-22 20-22s18 8 20 22"/>',
    outbox: '<rect x="14" y="30" width="56" height="40" rx="6"/><path d="M15 33l27 20 27-20"/><path d="M62 20l22-6-6 22-6-7-10 7 4-11z"/>',
    activity: '<path d="M24 16v68"/><circle cx="24" cy="26" r="5"/><circle cx="24" cy="50" r="5"/><circle cx="24" cy="74" r="5"/><path d="M36 26h40M36 50h30M36 74h36"/>',
    ask: '<path d="M18 24h52a8 8 0 018 8v26a8 8 0 01-8 8H42l-14 12V66H18a8 8 0 01-8-8V32a8 8 0 018-8z"/><path d="M44 34l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>',
    today: '<circle cx="48" cy="48" r="20"/><path d="M48 14v8M48 74v8M14 48h8M74 48h8M24 24l6 6M66 66l6 6M24 72l6-6M66 30l6-6"/><path d="M40 48l6 6 11-12"/>',
    starters: '<rect x="12" y="20" width="30" height="24" rx="5"/><rect x="54" y="20" width="30" height="24" rx="5"/><rect x="12" y="54" width="30" height="24" rx="5"/><path d="M60 66h18M69 57v18"/>',
    done: '<circle cx="48" cy="48" r="28"/><path d="M36 49l8 8 16-18"/>'
  };
  function art(kind) { return '<svg class="ah-art" viewBox="0 0 96 96" fill="none" stroke="#E8C55A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ART[kind] || ART.today) + '</svg>'; }
  window.ahEmpty = function (kind, title, line, acts, small) {
    return '<div class="ah-empty' + (small ? ' sm' : '') + '" role="status">' + art(kind) + '<div><h4>' + e(title) + '</h4><p>' + line + '</p>' + (acts ? '<div class="ah-ea">' + acts + '</div>' : '') + '</div></div>';
  };

  // ══ SAMpaigns: three views, one short nav ══════════════════════════════
  var AH = window._ah = window._ah || { view: 'home', people: null, pf: { scope: 'mine', stage: null, owner: '', campaign_id: '', q: '', overlap: false }, sel: {}, ob: null, obTab: null, obScope: 'mine', badges: {} };
  function page() {
    var pg = document.getElementById('ahPage');
    if (!pg) {
      var tam = document.getElementById('sampTamPage') || document.getElementById('sampWizardPage');
      if (!tam || !tam.parentNode) return null;
      pg = document.createElement('div'); pg.id = 'ahPage'; pg.hidden = true;
      tam.parentNode.insertBefore(pg, tam.nextSibling);
    }
    return pg;
  }
  function navHtml(cur) {
    var B = AH.badges || {};
    var t = function (k, lbl, badge, gold) { return '<button class="ah-tab' + (cur === k ? ' on' : '') + '" type="button" role="tab" aria-selected="' + (cur === k) + '" data-ah-nav="' + k + '">' + lbl + (badge ? '<i' + (gold ? ' class="g"' : '') + '>' + e(badge) + '</i>' : '') + '</button>'; };
    return '<nav class="ah-tabs" role="tablist" aria-label="SAMpaign views">' + t('home', 'SAMpaigns') + t('people', 'People', B.fix ? B.fix + ' to fix' : '') + t('outbox', 'Outbox', (B.failed || 0) + (B.li || 0) ? ((B.failed || 0) + (B.li || 0)) + ((B.li && !B.failed) ? ' stuck' : B.failed && !B.li ? ' failed' : ' to fix') : (B.drafts ? B.drafts + ' to review' : ''), !((B.failed || 0) + (B.li || 0))) + '</nav>';
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-ah-nav]'); if (!b) return;
    var v = b.getAttribute('data-ah-nav');
    if (v === 'home') { try { loadSampaignWorkspace(); } catch (_e) { _spShow('home'); } return; }
    ahGo(v);
  });
  function homeNav() {
    var home = document.getElementById('sampHomeView'); if (!home) return;
    var head = home.querySelector('.page-head'); if (!head) return;
    var n = document.getElementById('ahHomeNav');
    if (!n) { n = document.createElement('div'); n.id = 'ahHomeNav'; head.parentNode.insertBefore(n, head.nextSibling); }
    n.innerHTML = navHtml('home');
  }
  window.ahGo = function (v) {
    AH.view = v;
    try { _spShow(v); } catch (_e) {}
    if (v === 'people') peopleLoad();
    else if (v === 'outbox') obLoad();
    else if (v === 'starters') startersLoad();
  };
  if (typeof window._spShow === 'function' && !window._spShow._ah) {
    var baseShow = window._spShow;
    _spShow = window._spShow = function (view) {
      var r = baseShow.apply(this, arguments);
      var pg = page();
      var mine = ['people', 'outbox', 'starters'].indexOf(view) !== -1;
      if (pg) pg.hidden = !mine;
      if (!mine) AH.view = view;
      if (view === 'home') { homeNav(); badgesLoad(); }
      return r;
    };
    window._spShow._ah = true;
  }
  // Counts for the nav: what needs fixing, what failed. Quietly, after the home loads.
  var badgeAt = 0;
  async function badgesLoad(force) {
    if (!force && Date.now() - badgeAt < 60000) { homeNav(); return; }
    badgeAt = Date.now();
    try {
      var o = await call('get_outbox', { tab: 'failed', limit: 20 });
      if (o && o.ok) { AH.badges.failed = o.counts.failed || 0; AH.badges.drafts = o.counts.drafts || 0; }
      var p = await call('get_people_view', { scope: 'mine', limit: 20 });
      if (p && p.ok) AH.badges.fix = (p.overlaps || 0) + (p.dnc_live || 0);
      var lh = await call('get_linkedin_health', {});
      if (lh && lh.ok) AH.badges.li = lh.stuck || 0;
    } catch (_e) {}
    homeNav();
  }

  // ══ 1. People ═════════════════════════════════════════════════════════
  var STAGE = { deal: 'In a deal', meeting: 'Meeting', replied: 'Replied', sequence: 'In sequence', not_reached: 'Not reached', dropped: 'Stopped' };
  var SHOW_N = 60;
  async function peopleLoad(keepSel) {
    var pg = page(); if (!pg) return;
    if (!AH.people) pg.innerHTML = peopleShell('<div class="ah-card" style="padding:16px"><div class="ah-sk" style="width:40%"></div><div class="ah-sk"></div><div class="ah-sk" style="width:70%"></div><div class="ah-sk" style="width:55%"></div></div>');
    var f = AH.pf;
    var d = await call('get_people_view', { scope: f.scope, stage: f.stage, owner: f.owner || null, campaign_id: f.campaign_id || null, q: f.q || null, overlap: f.overlap, limit: 600 });
    if (AH.view !== 'people') return;
    if (!d || !d.ok) { pg.innerHTML = peopleShell(window.ahEmpty('people', 'People did not load', e((d && d.error) || 'Try again in a moment.'), '<button class="ah-btn gold" type="button" onclick="ahGo(\'people\')">Try again</button>')); return; }
    AH.people = d; AH.shown = SHOW_N;
    if (!keepSel) AH.sel = {};
    AH.badges.fix = f.scope === 'mine' && !f.owner && !f.campaign_id && !f.q ? (d.overlaps || 0) + (d.dnc_live || 0) : AH.badges.fix;
    peoplePaint();
  }
  function peopleShell(inner) {
    return navHtml('people') + '<div class="ah-head"><div><h2>People</h2><p>Everyone in your SAMpaigns, one row each: where they are, what happened last, and what is next.</p></div></div>' + inner;
  }
  function peoplePaint() {
    var pg = page(), d = AH.people, f = AH.pf; if (!pg || !d) return;
    var c = d.counts || {};
    var fixN = (d.overlaps || 0) + (d.dnc_live || 0);
    var kpi = function (key, n, lbl, sub, cls) { var on = key === 'fix' ? f.overlap : f.stage === key; return '<button class="ah-kpi ' + (cls || '') + (on ? ' on' : '') + '" type="button" data-ah-k="' + key + '" aria-pressed="' + on + '"><b>' + n + '</b><span>' + e(lbl) + '</span><small>' + e(sub) + '</small></button>'; };
    var kpis = '<div class="ah-kpis">' + kpi('fix', fixN, 'Need a fix', fixN ? 'Two SAMpaigns, or said stop' : 'Nobody written to twice', fixN ? 'fix' : '') +
      kpi('replied', c.replied || 0, 'Replied, no meeting yet', 'Your warmest next step') + kpi('meeting', c.meeting || 0, 'Meetings', 'Booked or held') + kpi('deal', c.deal || 0, 'In a deal', 'On an open deal') + '</div>';
    var views = '<option value="">Views</option>' +
      [['all', 'Everyone'], ['fix', 'Need a fix'], ['warm', 'Replied, no meeting'], ['mine', 'Only mine']].map(function (v) { return '<option value="b:' + v[0] + '">' + e(v[1]) + '</option>'; }).join('') +
      (d.views || []).map(function (v) { return '<option value="s:' + e(v.id) + '">' + e(v.name) + '</option>'; }).join('');
    var bar = '<div class="ah-bar"><label class="ah-srch">' + IC.search + '<input id="ahPq" type="search" placeholder="Search name, company, title or email" value="' + e(f.q) + '" aria-label="Search people"></label>' +
      '<div class="ah-seg" role="group" aria-label="Whose people"><button type="button" class="' + (f.scope === 'mine' ? 'on' : '') + '" data-ah-scope="mine">Mine</button><button type="button" class="' + (f.scope === 'org' ? 'on' : '') + '" data-ah-scope="org">Everyone</button></div>' +
      '<select class="ah-sel" id="ahPown" aria-label="Owner"><option value="">Any owner</option>' + (d.owners || []).map(function (o) { return '<option value="' + e(o.user_id) + '"' + (f.owner === o.user_id ? ' selected' : '') + '>' + e(o.name) + '</option>'; }).join('') + '</select>' +
      '<select class="ah-sel" id="ahPcmp" aria-label="SAMpaign"><option value="">Any SAMpaign</option>' + (d.campaigns || []).map(function (o) { return '<option value="' + e(o.id) + '"' + (f.campaign_id === o.id ? ' selected' : '') + '>' + e(o.name) + '</option>'; }).join('') + '</select>' +
      '<select class="ah-sel" id="ahPview" aria-label="Saved views">' + views + '</select>' +
      '<button class="ah-btn sm" type="button" id="ahPsave">' + IC.save + 'Save view</button></div>';
    var chips = '<div class="ah-chips" role="group" aria-label="Stage">' + '<button class="ah-chip' + (!f.stage && !f.overlap ? ' on' : '') + '" type="button" data-ah-st="">All <b>' + (d.total || 0) + '</b></button>' +
      Object.keys(STAGE).map(function (k) { return c[k] ? '<button class="ah-chip' + (f.stage === k ? ' on' : '') + '" type="button" data-ah-st="' + k + '">' + e(STAGE[k]) + ' <b>' + c[k] + '</b></button>' : ''; }).join('') + '</div>';
    var rows = d.people || [];
    var body;
    if (!rows.length) {
      var filtered = f.stage || f.owner || f.campaign_id || f.q || f.overlap;
      body = filtered ? window.ahEmpty('people', 'Nobody matches', 'Loosen a filter, or search for someone else.', '<button class="ah-btn gold" type="button" data-ah-clear="1">Clear filters</button>')
        : f.scope === 'mine' ? window.ahEmpty('people', 'Nobody in your SAMpaigns yet', 'Start a SAMpaign and SAM finds the right people at each company, then shows them all here.', '<button class="ah-btn gold" type="button" onclick="toggleNewSampaignForm()">' + IC.add + 'New SAMpaign</button><button class="ah-btn" type="button" data-ah-scope="org">See everyone\'s</button>')
        : window.ahEmpty('people', 'Nobody in any SAMpaign yet', 'Once your team starts SAMpaigns, every person shows here once, wherever they are.', '<button class="ah-btn gold" type="button" onclick="toggleNewSampaignForm()">' + IC.add + 'New SAMpaign</button>');
    } else {
      var n = Math.min(rows.length, AH.shown || SHOW_N);
      body = '<div class="ah-card"><table class="ah-t"><thead><tr><th style="width:28px"><input class="ah-ck" type="checkbox" id="ahPall" aria-label="Select all shown"></th><th>Person</th><th>Stage</th><th>Last</th><th>Next</th><th>SAMpaign</th><th class="ah-hm">Owner</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
        rows.slice(0, n).map(personRow).join('') + '</tbody></table>' + (rows.length > n ? '<button class="ah-more" type="button" data-ah-more="1">Show ' + Math.min(SHOW_N, rows.length - n) + ' more of ' + rows.length + '</button>' : '') + '</div>';
    }
    var selN = Object.keys(AH.sel).length;
    var bulk = selN ? '<div class="ah-bulk" role="region" aria-label="Selected people"><span><b>' + pl(selN, 'person', 'people') + '</b> selected</span><button class="ah-btn gold sm" type="button" data-ah-addsel="1">' + IC.add + 'Add to SAMpaign</button><button class="ah-btn sm ghost" style="color:#EFE9DF" type="button" data-ah-unsel="1">Clear</button></div>' : '';
    var excl = d.exclusive === false ? '<div class="ah-pulse">' + IC.warn + ' One live SAMpaign per person is switched off for your organisation.' + (d.can_admin ? ' <button class="ah-btn sm" type="button" data-ah-excl="on">Switch it on</button>' : '') + '</div>' : '';
    pg.innerHTML = peopleShell(kpis + excl + bar + chips + body + bulk);
    var q = document.getElementById('ahPq');
    if (q) { var tmr = null; q.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(function () { AH.pf.q = q.value.trim(); peopleLoad(); }, 350); }); }
    var ow = document.getElementById('ahPown'); if (ow) ow.onchange = function () { AH.pf.owner = ow.value; peopleLoad(); };
    var cm = document.getElementById('ahPcmp'); if (cm) cm.onchange = function () { AH.pf.campaign_id = cm.value; peopleLoad(); };
    var vw = document.getElementById('ahPview'); if (vw) vw.onchange = function () { applyView(vw.value); };
    var sv = document.getElementById('ahPsave'); if (sv) sv.onclick = saveView;
    var all = document.getElementById('ahPall'); if (all) all.onchange = function () { (AH.people.people || []).slice(0, AH.shown || SHOW_N).forEach(function (r) { if (all.checked) AH.sel[r.contact_id] = r; else delete AH.sel[r.contact_id]; }); peoplePaint(); };
  }
  function personRow(r) {
    var fix = r.overlap || (r.dnc_live && r.dnc_live.length);
    var sel = !!AH.sel[r.contact_id];
    var flags = '';
    if (r.dnc_live && r.dnc_live.length) {
      flags = '<span class="ah-flag">' + IC.stop + 'Said stop, still live in ' + e(r.dnc_live.map(function (m) { return m.campaign; }).join(' and ')) + '</span>' +
        '<div class="ah-fix">' + r.dnc_live.map(function (m) { return m.mine ? '<button class="ah-btn sm mul" type="button" data-ah-rm="' + e(m.campaign_id) + '|' + e(m.contact_id) + '">Take out of ' + e(m.campaign) + '</button>' : '<small>' + e(m.campaign) + ' is a colleague\'s: ask them to take ' + e(first(r.name)) + ' out.</small>'; }).join('') + '</div>';
    } else if (r.overlap) {
      var live = (r.sampaigns || []).filter(function (m) { return m.active; });
      var keep = live[0];
      var others = live.slice(1);
      flags = '<span class="ah-flag">' + IC.warn + 'In ' + live.length + ' live SAMpaigns</span><div class="ah-fix">' +
        others.map(function (m) { return m.mine ? '<button class="ah-btn sm mul" type="button" data-ah-rm="' + e(m.campaign_id) + '|' + e(m.contact_id) + '">Keep in ' + e(keep.campaign) + ' only</button>' : '<small>Also in ' + e(m.campaign) + ' (' + e(first(m.owner)) + ')</small>'; }).join('') + '</div>';
    }
    var em = r.email && /@/.test(r.email), liU = r.linkedin_url, ph = r.phone;
    var acts = '<div class="ah-acts">' +
      '<button class="ah-ib" type="button" title="Open" aria-label="Open ' + e(r.name) + '" data-ah-open="' + e(r.campaign_id) + '|' + e(r.account_id || '') + '|' + (r.stage === 'deal' ? 1 : 0) + '">' + IC.open + '</button>' +
      '<button class="ah-ib" type="button" title="Add to SAMpaign" aria-label="Add ' + e(r.name) + ' to a SAMpaign" data-ah-add="' + e(r.contact_id) + '">' + IC.add + '</button>' +
      '<a class="ah-ib" ' + (em ? 'href="mailto:' + e(r.email) + '"' : 'aria-disabled="true"') + ' title="Email" aria-label="Email ' + e(r.name) + '">' + IC.mail + '</a>' +
      '<a class="ah-ib" ' + (liU ? 'href="' + e(liU) + '" target="_blank" rel="noopener"' : 'aria-disabled="true"') + ' title="LinkedIn" aria-label="LinkedIn profile of ' + e(r.name) + '">' + IC.li + '</a>' +
      '<a class="ah-ib" ' + (ph ? 'href="tel:' + e(String(ph).replace(/[^+\d]/g, '')) + '"' : 'aria-disabled="true"') + ' title="' + (ph ? 'Call ' + e(ph) : 'No number yet') + '" aria-label="Call ' + e(r.name) + '">' + IC.call + '</a></div>';
    var more = (r.sampaigns || []).length > 1 ? ' <small>+' + ((r.sampaigns || []).length - 1) + ' more</small>' : '';
    return '<tr class="' + (fix ? 'fix' : '') + '" data-cid="' + e(r.contact_id) + '"><td><input class="ah-ck" type="checkbox" data-ah-sel="' + e(r.contact_id) + '"' + (sel ? ' checked' : '') + ' aria-label="Select ' + e(r.name) + '"></td>' +
      '<td><div class="ah-who"><span class="ah-av" aria-hidden="true">' + e(ini(r.name)) + '</span><div style="min-width:0"><b>' + e(r.name || r.email) + '</b><small>' + e([r.title, r.company].filter(Boolean).join(' · ')) + '</small>' + (r.local ? '<button class="ah-loc' + (r.local.at_work ? ' on' : '') + '" type="button" data-ai-zone="' + e(r.contact_id) + '" title="' + e('From ' + (r.local.why || 'what SAM knows') + '. Change it') + '">' + e(r.local.clock + ' · ' + r.local.label) + '</button>' : '<button class="ah-loc none" type="button" data-ai-zone="' + e(r.contact_id) + '">Set their time zone</button>') + flags + '</div></div></td>' +
      '<td><span class="ah-st ' + e(r.stage) + '">' + e(STAGE[r.stage] || r.stage) + '</span></td>' +
      '<td>' + e(r.last || '') + (r.last_at ? '<small>' + e(ago(r.last_at)) + '</small>' : '') + '</td>' +
      '<td>' + (r.next ? e(r.next) : '<small>Nothing due</small>') + '</td>' +
      '<td>' + e(r.campaign) + more + '</td><td class="ah-hm">' + e(r.owner) + '</td><td>' + acts + '</td></tr>';
  }
  function applyView(v) {
    var f = AH.pf;
    var reset = function () { f.stage = null; f.owner = ''; f.campaign_id = ''; f.q = ''; f.overlap = false; };
    if (v === 'b:all') { reset(); f.scope = 'org'; }
    else if (v === 'b:fix') { reset(); f.overlap = true; }
    else if (v === 'b:warm') { reset(); f.stage = 'replied'; }
    else if (v === 'b:mine') { reset(); f.scope = 'mine'; }
    else if (/^s:/.test(v)) {
      var sv = ((AH.people && AH.people.views) || []).find(function (x) { return x.id === v.slice(2); });
      if (!sv) return; reset(); var F = sv.filters || {};
      f.stage = F.stage || null; f.owner = F.owner || ''; f.campaign_id = F.campaign_id || ''; f.q = F.q || ''; f.overlap = !!F.overlap; f.scope = F.scope || 'mine';
    } else return;
    peopleLoad();
  }
  async function saveView() {
    var name = await ahPrompt('Save this view', 'Give it a short name, like "Replied this week".', 'Name');
    if (!name) return;
    var f = AH.pf;
    var r = await call('save_people_view', { name: name, filters: { stage: f.stage, owner: f.owner, campaign_id: f.campaign_id, q: f.q, overlap: f.overlap, scope: f.scope } });
    if (!r.ok) { toast(r.error || 'Could not save it'); return; }
    if (AH.people) AH.people.views = r.views;
    toast('Saved "' + name + '". It is in Views.'); peoplePaint();
  }
  // Clicks inside People.
  document.addEventListener('click', async function (ev) {
    var pg = document.getElementById('ahPage'); if (!pg || pg.hidden || !pg.contains(ev.target) || AH.view !== 'people') return;
    var t = ev.target.closest('button,input,a'); if (!t) return;
    var a;
    if ((a = t.getAttribute('data-ah-k'))) { if (a === 'fix') { AH.pf.overlap = !AH.pf.overlap; AH.pf.stage = null; } else { AH.pf.stage = AH.pf.stage === a ? null : a; AH.pf.overlap = false; } peopleLoad(); }
    else if (t.hasAttribute('data-ah-st')) { AH.pf.stage = t.getAttribute('data-ah-st') || null; AH.pf.overlap = false; peopleLoad(); }
    else if ((a = t.getAttribute('data-ah-scope'))) { AH.pf.scope = a; peopleLoad(); }
    else if (t.getAttribute('data-ah-clear')) { AH.pf = { scope: AH.pf.scope, stage: null, owner: '', campaign_id: '', q: '', overlap: false }; peopleLoad(); }
    else if (t.getAttribute('data-ah-more')) { AH.shown = (AH.shown || SHOW_N) + SHOW_N; peoplePaint(); }
    else if ((a = t.getAttribute('data-ah-sel'))) { var r = (AH.people.people || []).find(function (x) { return x.contact_id === a; }); if (t.checked && r) AH.sel[a] = r; else delete AH.sel[a]; peoplePaint(); }
    else if (t.getAttribute('data-ah-unsel')) { AH.sel = {}; peoplePaint(); }
    else if (t.getAttribute('data-ah-addsel')) { addTo(Object.keys(AH.sel)); }
    else if ((a = t.getAttribute('data-ah-add'))) { addTo([a]); }
    else if ((a = t.getAttribute('data-ah-excl'))) { var x = await call('set_people_exclusive', { off: a !== 'on' }); if (x.ok) { toast('One live SAMpaign per person is on.'); peopleLoad(true); } else toast(x.error || 'Could not change it'); }
    else if ((a = t.getAttribute('data-ah-rm'))) {
      var parts = a.split('|');
      t.disabled = true; t.textContent = 'Taking out…';
      var res = await call('remove_from_sampaign', { campaign_id: parts[0], contact_ids: [parts[1]] });
      if (!res.ok) { toast(res.error || 'Could not do that'); t.disabled = false; return; }
      toast(res.note || 'Done. Nothing more goes from that SAMpaign.');
      badgeAt = 0; peopleLoad(true);
    }
    else if ((a = t.getAttribute('data-ah-open'))) {
      var p = a.split('|');
      if (p[2] === '1' && p[1] && typeof zRoomOpen === 'function') { zRoomOpen(p[1], ''); return; }
      try { openSampaignDetail(p[0], 'people'); } catch (_e) {}
    }
  });

  // Add to a SAMpaign of yours, with the one-SAMpaign rule explained, not hidden.
  async function addTo(ids) {
    var mine = ((AH.people && AH.people.campaigns) || []).filter(function (c) { return c.mine; });
    if (!mine.length) { toast('You have no live SAMpaign to add them to. Start one first.'); return; }
    var pick = await ahChoose('Add ' + (ids.length === 1 ? (first(((AH.people.people || []).find(function (x) { return x.contact_id === ids[0]; }) || {}).name) || 'them') : pl(ids.length, 'person', 'people')) + ' to a SAMpaign', 'Only your own SAMpaigns are listed. People who said stop anywhere are never added.', mine.map(function (c) { return { id: c.id, label: c.name }; }));
    if (!pick) return;
    var r = await call('add_people_to_sampaign', { campaign_id: pick, contact_ids: ids });
    if (!r.ok) { toast(r.error || 'Could not add them'); return; }
    if (r.needs_confirm && r.blocked.length) {
      var list = r.blocked.map(function (b) { return '<li><b>' + e(b.name) + '</b>, in ' + e(b.in.map(function (m) { return m.campaign; }).join(' and ')) + '</li>'; }).join('');
      var go = await ahConfirm((r.added ? r.added + ' added. ' : '') + pl(r.blocked.length, 'person is', 'people are') + ' already being written to',
        'One live SAMpaign per person keeps your outreach from reading as spam. Add them anyway only if the other SAMpaign is about to stop.<ul>' + list + '</ul>', 'Add anyway', 'Leave them out');
      if (go) {
        var r2 = await call('add_people_to_sampaign', { campaign_id: pick, contact_ids: r.blocked.map(function (b) { return b.contact_id; }), allow_overlap: true });
        toast(r2.note || 'Added.');
      } else toast(r.added ? r.note.split('. ')[0] + '.' : 'Nobody added.');
    } else toast(r.note || 'Added.');
    AH.sel = {}; badgeAt = 0; peopleLoad();
  }
  // Small dialogs, in Samora's look, never the browser's.
  function dlg(html) {
    return new Promise(function (res) {
      var w = document.createElement('div'); w.className = 'ah-dw'; w.innerHTML = '<div class="ah-dlg" role="dialog" aria-modal="true">' + html + '</div>';
      var done = function (v) { w.remove(); document.removeEventListener('keydown', key); res(v); };
      var key = function (ev) { if (ev.key === 'Escape') done(null); };
      w.addEventListener('click', function (ev) { if (ev.target === w) return done(null); var b = ev.target.closest('[data-v]'); if (b) done(b.getAttribute('data-v') === '__input' ? (w.querySelector('input') || {}).value : b.getAttribute('data-v')); });
      w.addEventListener('submit', function (ev) { ev.preventDefault(); done((w.querySelector('input') || {}).value); });
      document.addEventListener('keydown', key); document.body.appendChild(w);
      var f = w.querySelector('input,button[data-v]'); if (f) f.focus();
    });
  }
  function ahChoose(title, sub, opts) { return dlg('<h3>' + e(title) + '</h3><p>' + e(sub) + '</p><ul class="ah-pick">' + opts.map(function (o) { return '<li><button type="button" data-v="' + e(o.id) + '"><span>' + e(o.label) + '</span><small>' + IC.next + '</small></button></li>'; }).join('') + '</ul><div class="ah-da"><button class="ah-btn ghost" type="button" data-v="">Cancel</button></div>'); }
  function ahConfirm(title, html, yes, no) { return dlg('<h3>' + e(title) + '</h3><p>' + html + '</p><div class="ah-da"><button class="ah-btn" type="button" data-v="">' + e(no) + '</button><button class="ah-btn gold" type="button" data-v="1">' + e(yes) + '</button></div>').then(function (v) { return !!v; }); }
  function ahPrompt(title, sub, label) { return dlg('<form><h3>' + e(title) + '</h3><p>' + e(sub) + '</p><label class="ah-srch" style="display:flex"><input type="text" maxlength="40" aria-label="' + e(label) + '" placeholder="' + e(label) + '"></label><div class="ah-da"><button class="ah-btn ghost" type="button" data-v="">Cancel</button><button class="ah-btn gold" type="submit">Save</button></div></form>').then(function (v) { return v ? String(v).trim() : ''; }); }

  // ══ 2. Outbox ═════════════════════════════════════════════════════════
  var OB_TABS = [['failed', 'Failed'], ['drafts', 'Drafts'], ['scheduled', 'Scheduled'], ['all', 'All']];
  async function obLoad() {
    var pg = page(); if (!pg) return;
    pg.innerHTML = obShell('<div class="ah-card" style="padding:16px"><div class="ah-sk" style="width:35%"></div><div class="ah-sk"></div><div class="ah-sk" style="width:65%"></div></div>');
    if (AH.obCh === 'linkedin' && typeof window.aiLiPaint === 'function') return window.aiLiPaint(pg, obShell);
    var d = await call('get_outbox', { tab: AH.obTab, scope: AH.obScope, limit: 300 });
    if (AH.view !== 'outbox') return;
    if (!d || !d.ok) { pg.innerHTML = obShell(window.ahEmpty('outbox', 'The Outbox did not load', e((d && d.error) || 'Try again in a moment.'), '<button class="ah-btn gold" type="button" onclick="ahGo(\'outbox\')">Try again</button>')); return; }
    AH.ob = d; AH.obTab = d.tab;
    AH.badges.failed = d.scope === 'mine' ? d.counts.failed : AH.badges.failed; AH.badges.drafts = d.scope === 'mine' ? d.counts.drafts : AH.badges.drafts;
    obPaint();
  }
  function obShell(inner) {
    var li = AH.obCh === 'linkedin', B = AH.badges || {};
    var ch = typeof window.aiLiPaint === 'function' ? '<div class="ah-seg" role="tablist" aria-label="Channel"><button type="button" role="tab" aria-selected="' + !li + '" class="' + (li ? '' : 'on') + '" data-ob-ch="email">Email</button><button type="button" role="tab" aria-selected="' + li + '" class="' + (li ? 'on' : '') + '" data-ob-ch="linkedin">LinkedIn' + (B.li ? ' · ' + B.li + ' stuck' : '') + '</button></div>' : '';
    return navHtml('outbox') + '<div class="ah-head"><div><h2>Outbox</h2><p>' + (li ? 'Every LinkedIn step across your SAMpaigns: what is waiting, what is stuck and why, with one fix for each.' : 'Every email across your SAMpaigns that is written, queued or stuck. Changes happen in place, in the SAMpaign.') + '</p></div>' + ch + '</div>' + (li ? '' : '<div id="aiTheirLine"></div>') + inner;
  }
  function obPaint() {
    var pg = page(), d = AH.ob; if (!pg || !d) return;
    var c = d.counts || {};
    var tabs = '<div class="ah-bar"><div class="ah-chips" role="tablist" aria-label="Outbox" style="margin:0;flex:1">' + OB_TABS.map(function (t) {
      var n = t[0] === 'all' ? (c.drafts + c.scheduled + c.failed + c.sent) : c[t[0]];
      return '<button class="ah-chip' + (d.tab === t[0] ? ' on' : '') + '" type="button" role="tab" aria-selected="' + (d.tab === t[0]) + '" data-ob-tab="' + t[0] + '">' + e(t[1]) + ' <b>' + (n || 0) + '</b></button>';
    }).join('') + '</div>' + (d.can_team ? '<div class="ah-seg" role="group" aria-label="Whose emails"><button type="button" class="' + (d.scope === 'mine' ? 'on' : '') + '" data-ob-scope="mine">Mine</button><button type="button" class="' + (d.scope === 'team' ? 'on' : '') + '" data-ob-scope="team">Team</button></div>' : '') + '</div>';
    var pulse = '<p class="ah-pulse">' + [d.today ? '<b>' + pl(d.today, 'email') + '</b> ' + (d.today === 1 ? 'goes' : 'go') + ' out today' : 'Nothing else goes out today', d.next_at ? 'next ' + e(dayLbl(d.next_at).toLowerCase() === 'today' ? 'at ' + tm(d.next_at) : dayLbl(d.next_at) + ' ' + tm(d.next_at)) : '', d.sent_today ? '<b>' + d.sent_today + '</b> sent today' : ''].filter(Boolean).join(' · ') + '</p>';
    var banners = '';
    if (d.tab === 'failed' || d.tab === 'all') banners = (d.failed_groups || []).map(function (g) {
      var why = g.kind === 'slow' ? 'Gmail asked SAM to slow down. Nothing was wrong with ' + (g.n === 1 ? 'it' : 'them') + '.' : g.kind === 'mailbox' ? 'Your mailbox needs reconnecting first.' : g.kind === 'no_email' ? 'No email address yet.' : 'It did not go out.';
      var btn = g.kind === 'no_email' ? '<button class="ah-btn sm" type="button" data-ob-open="' + e(g.campaign_id) + '|people">Open People</button>' : '<button class="ah-btn sm gold" type="button" data-ob-retry="' + e(g.campaign_id) + '|' + g.launch + '">' + IC.retry + 'Send again</button>';
      return '<div class="ah-banner">' + IC.warn + '<span><b>' + pl(g.n, 'email') + ' in ' + e(g.campaign) + '</b> did not go out. ' + e(why) + '</span>' + btn + '</div>';
    }).join('');
    var items = d.items || [];
    var body;
    if (!items.length) {
      var E = { failed: ['Nothing failed', 'Every email that was due went out. SAM tells you here the moment one does not.'], drafts: ['No drafts waiting', 'When SAM writes a wave, it waits here for your review before anything is scheduled.'], scheduled: ['Nothing queued', 'Approve a wave and its emails line up here, spaced within your daily limit.'], all: ['Your Outbox is empty', 'Start a SAMpaign and SAM writes the first emails for you to review.'] }[d.tab] || ['Nothing here', ''];
      body = window.ahEmpty('outbox', E[0], e(E[1]), d.tab === 'all' ? '<button class="ah-btn gold" type="button" onclick="toggleNewSampaignForm()">' + IC.add + 'New SAMpaign</button>' : (c.drafts && d.tab !== 'drafts' ? '<button class="ah-btn gold" type="button" data-ob-tab="drafts">Review ' + pl(c.drafts, 'draft') + '</button>' : ''));
    } else {
      var last = '';
      body = '<div class="ah-card"><ul class="ah-ob">' + items.map(function (x) {
        var h = '';
        if (d.tab === 'scheduled' || d.tab === 'all') { var dl = x.at ? dayLbl(x.at) : ''; if (dl !== last) { h = '<li class="ah-dh" style="display:block">' + e(dl || 'No date') + '</li>'; last = dl; } }
        var st = x.status === 'failed' ? '<span class="ah-st" style="background:rgba(var(--ah-mul),.14);color:var(--ah-mul-t)">' + e(x.reason || 'Failed') + '</span>' : x.status === 'draft' ? '<span class="ah-st">Draft</span>' : x.status === 'sent' ? '<span class="ah-st meeting">Sent</span>' : x.held ? '<span class="ah-st">Held</span>' : '<span class="ah-st deal">' + e(tm(x.at)) + '</span>';
        return h + '<li><span class="ah-av" aria-hidden="true">' + e(ini(x.name)) + '</span><div class="ah-obm"><b>' + e(x.name) + '</b> <small style="color:var(--text3)">' + e([x.company, x.wave].filter(Boolean).join(' · ')) + '</small><div class="s">' + e(x.subject || '(no subject)') + '</div><div class="p">' + e(x.preview) + '</div></div>' +
          '<div class="ah-obr">' + st + (x.their && (x.status === 'pending' || x.status === 'held') ? '<small class="ah-their">' + e(x.their.clock + ' in ' + x.their.label) + '</small>' : '') + '<small>' + e(x.campaign) + (x.status === 'sent' ? ' · ' + e(ago(x.at)) : '') + '</small><button class="ah-btn sm" type="button" data-ob-open="' + e(x.campaign_id) + '|sequence">' + (x.status === 'draft' ? 'Review' : 'Open') + '</button></div></li>';
      }).join('') + '</ul>' + (d.total > items.length ? '<div class="ah-more" style="cursor:default">' + (d.total - items.length) + ' more in the SAMpaigns</div>' : '') + '</div>';
    }
    pg.innerHTML = obShell(tabs + pulse + banners + body);
  }
  document.addEventListener('click', async function (ev) {
    var pg = document.getElementById('ahPage'); if (!pg || pg.hidden || !pg.contains(ev.target) || AH.view !== 'outbox') return;
    var t = ev.target.closest('button'); if (!t) return;
    var a;
    if ((a = t.getAttribute('data-ob-ch'))) { AH.obCh = a === 'linkedin' ? 'linkedin' : 'email'; obLoad(); }
    else if ((a = t.getAttribute('data-ob-tab'))) { AH.obTab = a; obLoad(); }
    else if ((a = t.getAttribute('data-ob-scope'))) { AH.obScope = a; obLoad(); }
    else if ((a = t.getAttribute('data-ob-open'))) { var p = a.split('|'); try { openSampaignDetail(p[0], p[1] || 'sequence'); } catch (_e) {} }
    else if ((a = t.getAttribute('data-ob-retry'))) {
      var q = a.split('|'); t.disabled = true; t.textContent = 'Sending again…';
      try { await sampRetryFailed(q[0], Number(q[1]) || null); } catch (_e) {}
      if (AH.view === 'outbox') { badgeAt = 0; obLoad(); }
    }
  });

  // ══ 3. Starter SAMpaigns ══════════════════════════════════════════════
  var KIND_L = { email: 'Email', visit: 'Visit', invite: 'Invite', message: 'Message' };
  function track(t) {
    var inv = (t.steps.find(function (s) { return s.kind === 'invite'; }) || {}).day || 1;
    var cum = 0;
    var arr = t.steps.map(function (s) { var d = s.kind === 'message' ? (cum += (s.after || 0), inv + cum) : (s.day || 1); return { k: s.kind, d: d }; }).sort(function (a, b) { return a.d - b.d; });
    return '<div class="ah-trk" aria-label="' + e(arr.map(function (x) { return KIND_L[x.k] + ' on day ' + x.d; }).join(', ')) + '">' + arr.map(function (x) { return '<span title="' + e(KIND_L[x.k] + ', day ' + x.d) + '"><i class="' + (x.k === 'email' ? 'e' : 'l') + '"></i><small>' + x.d + '</small></span>'; }).join('') + '</div>';
  }
  async function startersLoad() {
    var pg = page(); if (!pg) return;
    var shell = function (inner) { return '<div class="ah-head"><div><h2>Start a SAMpaign</h2><p>Pick a shape. Every one shows its steps and what it did for your team, before you start. You can change any step after.</p></div><button class="ah-btn" type="button" data-st-blank="1">Start from scratch</button></div>' + inner; };
    pg.innerHTML = shell('<div class="ah-sg">' + [1, 2, 3].map(function () { return '<div class="ah-stc"><div class="ah-sk" style="width:50%"></div><div class="ah-sk" style="height:58px"></div><div class="ah-sk"></div></div>'; }).join('') + '</div>');
    var d = await call('get_starter_sampaigns', {});
    if (AH.view !== 'starters') return;
    if (!d || !d.ok) { pg.innerHTML = shell(window.ahEmpty('starters', 'Starters did not load', 'You can still start from scratch.', '<button class="ah-btn gold" type="button" data-st-blank="1">Start from scratch</button>')); return; }
    AH.starters = d;
    var cards = d.starters.map(function (t) {
      var y = t.yours || {}, isPick = d.pick && d.pick.key === t.key;
      var nums = y.reply_rate != null
        ? '<div class="ah-nums"><div><b>' + y.reply_rate + '%</b><small>replied</small></div><div><b>' + (y.meeting_rate != null ? y.meeting_rate + '%' : '0%') + '</b><small>met</small></div><div><b>' + y.reached + '</b><small>people</small></div></div><div class="ah-yours">Your team, ' + pl(y.sampaigns, 'SAMpaign') + ', last 6 months</div>'
        : '<div class="ah-yours">' + (y.reached ? 'Tried on ' + pl(y.reached, 'person', 'people') + ' so far. SAM shows a rate from ' + d.min_people + '.' : 'Not tried by your team yet. SAM shows your own numbers once it has run.') + '</div>';
      return '<div class="ah-stc' + (isPick ? ' pick' : '') + '">' + (isPick ? '<span class="ah-badge">' + IC.star + ' SAM\'s pick</span>' : '') + '<h4>' + e(t.label) + '</h4><p>' + e(t.for) + '</p>' + track(t) +
        '<div class="ah-yours">' + [t.emails ? '<b>' + pl(t.emails, 'email') + '</b>' : '', t.linkedin_steps ? '<b>' + pl(t.linkedin_steps, 'LinkedIn step') + '</b>' : ''].filter(Boolean).join(' and ') + ' over ' + pl(t.days, 'working day') + '<br><small style="color:var(--text3)"><span style="color:#B8860B">&#9632;</span> email &nbsp;<span style="color:#6F8CC8">&#9632;</span> LinkedIn &nbsp;numbers are working days</small></div>' + nums +
        (isPick ? '<div class="ah-yours" style="color:var(--c-accent-text)">' + e(d.pick.why) + '</div>' : '') +
        '<div style="margin-top:auto">' + (t.locked ? '<button class="ah-btn" type="button" disabled>LinkedIn add-on needed</button>' : '<button class="ah-btn ' + (isPick ? 'gold' : '') + '" type="button" data-st-use="' + e(t.key) + '">Start with this ' + IC.next + '</button>') + '</div></div>';
    }).join('');
    pg.innerHTML = shell('<div class="ah-sg">' + cards + '</div>');
  }
  var baseWizard = typeof window.sampOpenWizard === 'function' ? window.sampOpenWizard : null;
  function useStarter(key) {
    if (!baseWizard) return;
    baseWizard();
    var W = window._sampW;
    if (key && W && typeof _spSeqTpl === 'function' && typeof SP_SEQ_TPL === 'object' && SP_SEQ_TPL[key]) {
      W.seq = _spSeqTpl(key, W.start); W.starter = key; W.li = key !== 'email_only';
      try { _spWizRender(); } catch (_e) {}
    }
  }
  window.ahUseStarter = useStarter;
  if (typeof window.toggleNewSampaignForm === 'function' && !window.toggleNewSampaignForm._ah) {
    toggleNewSampaignForm = window.toggleNewSampaignForm = function () {
      try { if (typeof switchTab === 'function' && typeof currentTab !== 'undefined' && currentTab !== 'sampaign') switchTab('sampaign'); } catch (_e) {}
      ahGo('starters');
    };
    window.toggleNewSampaignForm._ah = true;
  }
  document.addEventListener('click', function (ev) {
    var pg = document.getElementById('ahPage'); if (!pg || pg.hidden || !pg.contains(ev.target) || AH.view !== 'starters') return;
    var t = ev.target.closest('button'); if (!t) return;
    if (t.getAttribute('data-st-blank')) useStarter(null);
    else if (t.getAttribute('data-st-use')) useStarter(t.getAttribute('data-st-use'));
  });

  // ══ 4. Ask SAM about an account ═══════════════════════════════════════
  var ASK = [['weekly', 'Weekly update'], ['competition', 'Competition'], ['red_flags', 'Red flags'], ['asks', 'What they asked for']];
  window._ahAsk = window._ahAsk || {};
  function askHtml(acc, name, host, compact) {
    var S = window._ahAsk[host] || {};
    return '<div class="ah-ask" data-ask-host="' + e(host) + '" data-acc="' + e(acc) + '" data-name="' + e(name || '') + '"><div class="ah-chips" role="group" aria-label="Ask SAM about ' + e(name || 'this account') + '" style="margin:' + (compact ? '6px 0 0' : '8px 0 0') + '">' +
      ASK.map(function (q) { return '<button class="ah-chip' + (S.kind === q[0] ? ' on' : '') + '" type="button" data-ask="' + q[0] + '">' + (q[0] === 'weekly' ? IC.spark : '') + e(q[1]) + '</button>'; }).join('') + '</div>' +
      (compact ? '' : '<form class="ah-askq" data-askf="1"><input type="text" maxlength="300" placeholder="Ask anything about ' + e(name || 'this account') + '" aria-label="Your question" value="' + e(S.question || '') + '"><button class="ah-btn gold sm" type="submit">Ask</button></form>') +
      '<div class="ah-ansh">' + (S.html || '') + '</div></div>';
  }
  function srcHtml(s) { return '<button class="ah-src" type="button" data-src-at="' + e(s.at) + '" data-src-t="' + e(s.title) + '" title="' + e(s.title) + '"><em>' + s.n + '</em>' + e(String(s.title).slice(0, 48)) + ' · ' + e(shortDay(s.at)) + '</button>'; }
  function answerHtml(r) {
    if (!r.ok) return '<div class="ah-ans"><h5>' + e(r.error || 'SAM could not answer that.') + '</h5></div>';
    if (r.empty) return window.ahEmpty('ask', 'Nothing on record yet', e(r.note), '', true);
    var A = r.answer;
    var h = '<div class="ah-ans" role="status">';
    if (A) {
      h += '<h5>' + e(A.headline) + '</h5><ul>' + (A.points || []).map(function (p) { return '<li>' + e(p.text) + (p.sources && p.sources.length ? '<div>' + p.sources.map(srcHtml).join('') + '</div>' : '') + '</li>'; }).join('') + '</ul>' +
        (A.next ? '<div class="ah-nx">' + IC.next + '<span><b>Next:</b> ' + e(A.next) + '</span></div>' : '');
    } else {
      h += '<h5>' + e(r.label) + ': what is on record</h5><ul>' + (r.facts || []).map(function (p) { return '<li>' + e(p.text) + (p.sources && p.sources.length ? '<div>' + p.sources.map(srcHtml).join('') + '</div>' : '') + '</li>'; }).join('') + '</ul>';
    }
    var meta = [];
    if (r.note) meta.push(e(r.note));
    else if (r.by === 'sam') meta.push('From ' + pl(r.evidence, 'thing', 'things') + ' on record' + (A && A.confidence ? ', ' + e(A.confidence) + ' confidence' : '') + (r.cached && r.at ? ' · ' + e(ago(r.at)) : ''));
    if (r.by === 'sam') meta.push('<button type="button" data-ask-refresh="' + e(r.kind) + '">Ask again</button>');
    return h + '<div class="ah-meta">' + meta.join(' · ') + '</div></div>';
  }
  async function ask(host, kind, question, refresh) {
    var box = document.querySelector('[data-ask-host="' + host + '"]'); if (!box) return;
    var acc = box.getAttribute('data-acc');
    var S = window._ahAsk[host] = { kind: kind, question: question || '', html: '<div class="ah-ans"><div class="ah-sk" style="width:60%"></div><div class="ah-sk"></div><div class="ah-sk" style="width:80%"></div></div>' };
    box.querySelectorAll('[data-ask]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-ask') === kind); });
    box.querySelector('.ah-ansh').innerHTML = S.html;
    var r = await call('ask_account', { account_id: acc, kind: kind, question: question || null, refresh: !!refresh });
    S.html = answerHtml(r || { ok: false });
    var b2 = document.querySelector('[data-ask-host="' + host + '"] .ah-ansh'); if (b2) b2.innerHTML = S.html;
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-ask],[data-ask-refresh],[data-src-at]'); if (!t) return;
    var box = t.closest('[data-ask-host]'); if (!box) return;
    var host = box.getAttribute('data-ask-host');
    if (t.hasAttribute('data-ask')) ask(host, t.getAttribute('data-ask'));
    else if (t.hasAttribute('data-ask-refresh')) { var S = window._ahAsk[host] || {}; ask(host, S.kind || 'weekly', S.question, true); }
    else if (t.hasAttribute('data-src-at')) {
      // Jump to the line in Activity, when it is on the page.
      var at = t.getAttribute('data-src-at'), ti = t.getAttribute('data-src-t');
      var li = Array.prototype.find.call(document.querySelectorAll('.ah-act li.i'), function (x) { return x.getAttribute('data-at') === at && x.getAttribute('data-t') === ti; });
      if (li) { li.scrollIntoView({ behavior: 'smooth', block: 'center' }); li.classList.add('hl'); setTimeout(function () { li.classList.remove('hl'); }, 1800); }
    }
  });
  document.addEventListener('submit', function (ev) {
    var f = ev.target.closest && ev.target.closest('[data-askf]'); if (!f) return;
    ev.preventDefault();
    var box = f.closest('[data-ask-host]'); var q = (f.querySelector('input') || {}).value || '';
    if (q.trim().length < 4) { toast('Type a question first.'); return; }
    ask(box.getAttribute('data-ask-host'), 'free', q.trim());
  });

  // ══ 5. The account as one stream ══════════════════════════════════════
  var AK = [['', 'All'], ['meeting', 'Meetings'], ['reply', 'Replies'], ['linkedin', 'LinkedIn'], ['call', 'Calls'], ['email', 'Emails'], ['deal', 'Deal'], ['crm', 'Changes'], ['risk', 'Risks']];
  var AIC = { meeting: IC.meeting, reply: IC.reply, linkedin: IC.li, call: IC.call, email: IC.email, deal: IC.deal, crm: IC.crm, risk: IC.risk };
  window._ahAct = window._ahAct || {};
  function actHtml(id) {
    var A = window._ahAct[id] || {};
    var head = '<h3>Activity</h3><div class="zr-sub">Everything on this account, newest first: meetings, replies, LinkedIn, emails, the deal and Pipeline changes. The words are theirs and yours.</div>';
    if (!A.d) return head + '<div class="ah-sk" style="width:50%"></div><div class="ah-sk"></div><div class="ah-sk" style="width:75%"></div>';
    var d = A.d;
    if (!d.ok) return head + '<div class="zr-sub">' + e(d.error || 'Activity did not load.') + '</div>';
    if (!d.total) return head + window.ahEmpty('activity', 'Nothing on record yet', 'A reply, a meeting, a LinkedIn answer or a change in Pipeline starts the story. SAM adds each one here as it happens.', '', true);
    var k = A.kind || '';
    var list = (d.items || []).filter(function (x) { return !k || x.kind === k; });
    var n = Math.min(list.length, A.shown || 25), last = '';
    var chips = '<div class="ah-chips" role="group" aria-label="Show">' + AK.map(function (c) { var cnt = c[0] ? (d.counts[c[0]] || 0) : d.total; return (c[0] && !cnt) ? '' : '<button class="ah-chip' + (k === c[0] ? ' on' : '') + '" type="button" data-act-k="' + c[0] + '">' + e(c[1]) + ' <b>' + cnt + '</b></button>'; }).join('') + '</div>';
    var rows = list.slice(0, n).map(function (x) {
      var dl = dayLbl(x.at), h = '';
      if (dl !== last) { h = '<li class="d">' + e(dl) + '</li>'; last = dl; }
      return h + '<li class="i" data-at="' + e(x.at) + '" data-t="' + e(x.title) + '"><span class="ah-ai ' + e(x.kind) + '">' + (AIC[x.kind] || IC.crm) + '</span><div><div class="ah-at">' + e(x.title) + '</div>' + (x.quote ? '<div class="ah-aq">“' + e(String(x.quote).slice(0, 260)) + '”</div>' : '') + '<div class="ah-am">' + e([x.source, /T12:00:00(\.000)?Z$/.test(String(x.at)) ? '' : tm(x.at)].filter(Boolean).join(' · ')) + '</div></div></li>';
    }).join('');
    var quiet = d.last_theirs ? '<div class="zr-sub" style="margin-top:4px">Last from them: <b>' + e(d.last_theirs.title) + '</b>, ' + e(ago(d.last_theirs.at)) + '.</div>' : '<div class="zr-sub" style="margin-top:4px">Nobody there has answered yet.</div>';
    return head + quiet + chips + '<ul class="ah-act">' + rows + '</ul>' + (list.length > n ? '<button class="ah-more" type="button" data-act-more="1">Show ' + Math.min(25, list.length - n) + ' more</button>' : '');
  }
  async function actLoad(id) {
    window._ahAct[id] = { d: null };
    var d = await call('get_account_activity', { account_id: id });
    window._ahAct[id] = { d: d || { ok: false } };
    var el = document.getElementById('ahActCard'); if (el && el.getAttribute('data-acc') === id) el.innerHTML = actHtml(id);
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-act-k],[data-act-more]'); if (!t) return;
    var card = t.closest('#ahActCard'); if (!card) return;
    var id = card.getAttribute('data-acc'), A = window._ahAct[id] || {};
    if (t.hasAttribute('data-act-k')) { A.kind = t.getAttribute('data-act-k'); A.shown = 25; } else A.shown = (A.shown || 25) + 25;
    card.innerHTML = actHtml(id);
  });

  // The deal room: Ask SAM at the top on the right; Activity first on the left,
  // in place of "What happened". Survives every repaint of the room.
  function dealInject() {
    var zr = document.querySelector('#zRoom .zr'); if (!zr) return;
    var body = zr.querySelector('.zr-body'); var Z = window._zr || {};
    if (!body || !Z.d || !Z.d.account || body.querySelector('#ahActCard')) return;
    var id = Z.d.account.id, name = Z.d.account.name;
    var cols = body.querySelectorAll('.zr-col'); if (cols.length < 2) return;
    Array.prototype.forEach.call(cols[0].querySelectorAll('.zr-card'), function (c) { var h = c.querySelector('h3'); if (h && /^What happened/.test(h.textContent)) c.remove(); });
    var act = document.createElement('div'); act.className = 'zr-card'; act.id = 'ahActCard'; act.setAttribute('data-acc', id);
    cols[0].insertBefore(act, cols[0].firstChild);
    if (!window._ahAct[id] || window._ahAct[id].stale) actLoad(id); else act.innerHTML = actHtml(id);
    if (!window._ahAct[id].d) act.innerHTML = actHtml(id);
    var ak = document.createElement('div'); ak.className = 'zr-card'; ak.id = 'ahAskCard';
    ak.innerHTML = '<h3>Ask SAM</h3><div class="zr-sub">Answers from this account\'s emails, meetings and notes, with the source of every line.</div>' + askHtml(id, name, 'deal_' + id);
    cols[1].insertBefore(ak, cols[1].firstChild);
  }
  var zObs = null;
  function watchRoom() {
    var el = document.getElementById('zRoom');
    if (!el) { if (zObs) { zObs.disconnect(); zObs = null; } return; }
    if (zObs && zObs._el === el) return;
    if (zObs) zObs.disconnect();
    zObs = new MutationObserver(function () { dealInject(); }); zObs._el = el;
    zObs.observe(el, { childList: true, subtree: true });
    dealInject();
  }
  if (typeof window.zRoomOpen === 'function' && !window.zRoomOpen._ah) {
    var baseRoom = window.zRoomOpen;
    zRoomOpen = window.zRoomOpen = async function (id) {
      if (window._ahAct[id]) window._ahAct[id].stale = true;
      delete window._ahAsk['deal_' + id];
      var p = baseRoom.apply(this, arguments);
      setTimeout(watchRoom, 0);
      var r = await p; watchRoom(); dealInject(); return r;
    };
    window.zRoomOpen._ah = true;
  }

  // ══ 6. Today: by type, and a focused session ══════════════════════════
  var TK = [['reply', 'Replies'], ['review', 'Review'], ['li', 'LinkedIn'], ['fix', 'Fix'], ['write', 'Write'], ['deal', 'Deals'], ['away', 'Away']];
  function kindOf(x) {
    var k = String((x.t && x.t.key) || '');
    if (x.tone === 'risk') return 'fix';
    if (/replies$/.test(k) || k === 'li_reply_queued') return 'reply';
    if (k === 'drafts' || (x.sam && x.sam.do === 'review')) return 'review';
    if (/^ooo_/.test(k)) return 'away';
    if (k === 'wave' || (x.sam && x.sam.do === 'write')) return 'write';
    if (/^li_/.test(k)) return 'li';
    if (/^deal|^dealmove_|^hold_/.test(k)) return 'deal';
    return 'other';
  }
  function todo() {
    var all = []; try { all = _g24Items() || []; } catch (_e) {}
    return all.filter(function (x) { return !(x.c && x.c.demo) && (x.tone === 'do' || x.tone === 'risk'); });
  }
  function dealAcc(x) { var d = x && x.t && x.t.deal; return d && d.account_id ? { id: d.account_id, name: d.company || d.name || '' } : null; }
  window._ahT = window._ahT || { kind: '' };
  function todayBar(items) {
    var by = {}; items.forEach(function (x) { var k = kindOf(x); by[k] = (by[k] || 0) + 1; });
    var K = window._ahT.kind;
    var chips = '<button class="ah-chip' + (!K ? ' on' : '') + '" type="button" data-tk="">All <b>' + items.length + '</b></button>' +
      TK.map(function (t) { return by[t[0]] ? '<button class="ah-chip' + (K === t[0] ? ' on' : '') + '" type="button" data-tk="' + t[0] + '">' + e(t[1]) + ' <b>' + by[t[0]] + '</b></button>' : ''; }).join('');
    var n = K ? (by[K] || 0) : items.length;
    return '<div class="ah-tbar"><div class="ah-chips" role="group" aria-label="Show by type">' + chips + '</div>' + (n ? '<button class="ah-btn gold sm" type="button" data-tk-start="1">' + IC.play + 'Start a session · ' + n + '</button>' : '') + '</div>';
  }
  function askRow(x, host) { var a = dealAcc(x); return a ? '<div style="padding:0 12px 10px">' + askHtml(a.id, a.name, host, true) + '</div>' : ''; }
  if (typeof window.g24RenderFeed === 'function' && !window.g24RenderFeed._ah) {
    var baseFeed = window.g24RenderFeed;
    g24RenderFeed = window.g24RenderFeed = function () {
      var r = baseFeed.apply(this, arguments);
      try {
        var el = document.getElementById('g24Feed');
        if (el && window._tds && window._tds.data && (typeof _g24IsToday !== 'function' || _g24IsToday()) && !(typeof todayActiveSection !== 'undefined' && todayActiveSection !== 'tasks')) {
          var items = todo();
          var K = window._ahT.kind;
          if (K && !items.some(function (x) { return kindOf(x) === K; })) K = window._ahT.kind = '';
          if (items.length) {
            if (K) {
              var mine = items.filter(function (x) { return kindOf(x) === K; });
              var lbl = (TK.find(function (t) { return t[0] === K; }) || [K, K])[1];
              el.innerHTML = todayBar(items) + '<div class="ac-fh"><h3>' + e(lbl) + '</h3><small>Nothing sends until you approve</small></div><ul class="g24-list">' +
                mine.map(function (x) { return _g24Row(x) + (K === 'deal' ? '<li style="list-style:none">' + askRow(x, 'today_' + x.key) + '</li>' : ''); }).join('') + '</ul>';
            } else el.insertAdjacentHTML('afterbegin', todayBar(items));
          }
          var clear = el.querySelector('.ac-clear');
          if (clear) clear.outerHTML = window.ahEmpty('today', 'Nothing needs you right now', 'SAM carries on with what is running, and puts anything new here the moment it lands.', '<button class="ah-btn" type="button" onclick="switchTab(\'sampaign\')">Open SAMpaigns</button>');
        }
        sessPaint();
      } catch (_e) {}
      return r;
    };
    window.g24RenderFeed._ah = true;
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-tk],[data-tk-start]'); if (!t) return;
    if (t.hasAttribute('data-tk')) { window._ahT.kind = t.getAttribute('data-tk'); try { g24RenderFeed(); } catch (_e) {} }
    else sessStart(window._ahT.kind);
  });
  // A session: one thing at a time, Next, Skip, End.
  var SS = null;
  function sessStart(kind) {
    var items = todo().filter(function (x) { return !kind || kindOf(x) === kind; });
    if (!items.length) { toast('Nothing to work through.'); return; }
    SS = { kind: kind, keys: items.map(function (x) { return x.key; }), i: 0, done: 0, skipped: 0 };
    var w = document.createElement('div'); w.className = 'ah-sw'; w.id = 'ahSess';
    w.innerHTML = '<div class="ah-ss" role="dialog" aria-modal="true" aria-label="Session"></div>';
    w.addEventListener('click', function (ev) { if (ev.target === w) sessEnd(); });
    document.body.appendChild(w);
    document.addEventListener('keydown', sessKey);
    sessPaint();
    var nx = w.querySelector('[data-ss="next"]'); if (nx) nx.focus();
  }
  function sessKey(ev) {
    if (!SS || document.querySelector('.ah-dw,.sp-modal,#g24Rv')) return;
    if (ev.key === 'Escape') sessEnd();
    else if (ev.key === 'ArrowRight' && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) sessMove(1);
    else if (ev.key === 'ArrowLeft' && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) sessMove(-1);
  }
  function sessEnd() { SS = null; var w = document.getElementById('ahSess'); if (w) w.remove(); document.removeEventListener('keydown', sessKey); try { g24RenderFeed(); } catch (_e) {} }
  window.ahSessionEnd = sessEnd;
  function sessMove(d, skip) {
    if (!SS) return;
    if (d > 0) { var st = (window._g24 && window._g24.st[SS.keys[SS.i]]) || null; if (st && ['done', 'ready'].indexOf(st.phase) !== -1) SS.done++; else if (skip) SS.skipped++; }
    SS.i = Math.max(0, Math.min(SS.keys.length, SS.i + d));
    sessPaint();
  }
  function sessPaint() {
    var w = document.getElementById('ahSess'); if (!w || !SS) return;
    var box = w.querySelector('.ah-ss');
    var lbl = SS.kind ? (TK.find(function (t) { return t[0] === SS.kind; }) || ['', 'Today'])[1] : 'Everything today';
    var total = SS.keys.length;
    if (SS.i >= total) {
      box.innerHTML = '<div class="ah-sh"><b>' + e(lbl) + '</b><span class="sp"></span><button class="ah-ib" type="button" aria-label="Close" data-ss="end">' + IC.x + '</button></div><div class="ah-pg"><i style="width:100%"></i></div><div class="ah-sb">' +
        window.ahEmpty('done', 'Session done', 'You went through ' + pl(total, 'thing') + (SS.skipped ? ', ' + SS.skipped + ' skipped for later' : '') + '. SAM carries on with the rest.', '<button class="ah-btn gold" type="button" data-ss="end">Back to Today</button>') + '</div>';
      return;
    }
    var key = SS.keys[SS.i];
    var x = (function () { try { return (_g24Items() || []).find(function (y) { return y.key === key; }); } catch (_e) { return null; } })();
    var body = x ? '<ul class="g24-list">' + _g24Row(x) + '</ul>' + (kindOf(x) === 'deal' ? '<div style="margin-top:10px"><div class="zr-sub" style="font-size:12.5px;color:var(--text3)">Ask SAM about ' + e((dealAcc(x) || {}).name || 'this account') + '</div>' + askRow(x, 'sess_' + key).replace('padding:0 12px 10px', 'padding:0') + '</div>' : '')
      : window.ahEmpty('done', 'Handled', 'This one is done. Go on to the next.', '', true);
    var cname = x && x.c ? x.c.name : '';
    box.innerHTML = '<div class="ah-sh"><div><b>' + e(lbl) + '</b><br><small>' + (SS.i + 1) + ' of ' + total + (cname ? ' · ' + e(cname) : '') + '</small></div><span class="sp"></span><button class="ah-ib" type="button" aria-label="End session" data-ss="end">' + IC.x + '</button></div>' +
      '<div class="ah-pg" aria-hidden="true"><i style="width:' + Math.round(SS.i / total * 100) + '%"></i></div><div class="ah-sb">' + body + '</div>' +
      '<div class="ah-sf"><button class="ah-btn ghost" type="button" data-ss="back"' + (SS.i ? '' : ' disabled') + '>' + IC.back + 'Back</button><small>Arrow keys move, Esc ends</small><div style="display:flex;gap:8px"><button class="ah-btn" type="button" data-ss="skip">Skip</button><button class="ah-btn gold" type="button" data-ss="next">' + (SS.i === total - 1 ? 'Finish' : 'Next') + IC.next + '</button></div></div>';
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-ss]'); if (!t || !SS) return;
    var a = t.getAttribute('data-ss');
    if (a === 'end') sessEnd(); else if (a === 'next') sessMove(1); else if (a === 'skip') sessMove(1, true); else if (a === 'back') sessMove(-1);
  });

  // ══ 7. Professor SAM's one-click fix for people written to twice ══════
  if (typeof window.aeAct === 'function' && !window.aeAct._ah) {
    var baseAct = window.aeAct;
    window.aeAct = async function (id, btn) {
      var CO = window._aeCoach || {}, t = (CO.tips || {})[id];
      var a = t && t.tip && t.tip.action || {};
      if (a.kind !== 'remove_overlap') return baseAct.apply(this, arguments);
      if (btn) { btn.disabled = true; btn.textContent = 'Taking out…'; }
      var r = await call('remove_from_sampaign', { campaign_id: a.campaign_id, contact_ids: a.contact_ids || [] });
      if (btn) btn.disabled = false;
      if (!r.ok) { toast(r.error || 'Could not do that'); return; }
      toast(r.note || 'Done. Nothing more goes to them from this SAMpaign.');
      var el = document.querySelector('.ae-pf[data-tip="' + id + '"]'); if (el && el.parentNode) el.parentNode.innerHTML = '';
      try { delete CO.cache[t.key]; } catch (_e) {}
      call('coach_event', { tip_id: id, event: 'acted' }).catch(function () {});
      badgeAt = 0;
      try { await _sampLoadOverview(a.campaign_id); } catch (_e) {}
    };
    window.aeAct._ah = true;
  }

  // ══ 8. Empty SAMpaign list: say what to do ════════════════════════════
  var listObs = null;
  function listEmpty() {
    var el = document.getElementById('sampaignCampaignsList'); if (!el) return;
    if (!listObs) { listObs = new MutationObserver(listEmpty); listObs.observe(el, { childList: true }); }
    var em = el.querySelector(':scope > .sp-card.sp-empty');
    if (!em || em.getAttribute('data-ah')) return;
    if (!em.querySelector('button')) return;
    em.setAttribute('data-ah', '1');
    em.style.cssText = 'padding:0;border:0;background:none';
    em.innerHTML = window.ahEmpty('starters', 'No SAMpaigns here yet', 'Pick a starter and SAM finds the people, writes each first email for you to review, and follows up until they answer.', '<button class="ah-btn gold" type="button" onclick="toggleNewSampaignForm()">' + IC.add + 'Start a SAMpaign</button>');
  }
  setInterval(function () { if (document.getElementById('sampaignCampaignsList') && !listObs) listEmpty(); }, 1500);

  window._ahApi = { page: page, obShell: obShell, obLoad: obLoad, peopleLoad: function () { return peopleLoad(true); }, badges: function () { badgeAt = 0; return badgesLoad(true); }, dlg: dlg, IC: IC, art: art };
  window._ahReady = true;
})();
