// SamoraOS app: Drop Z (6 Nov 2026).
//   1. The deal room: one page per deal. Where it stands and how SAM knows,
//      health and what would raise it, MEDDPICC with what SAM found (confirm
//      in one click), the buying group, the terms, who is on hold.
//   2. Pause a company or a person from a SAMpaign's People, in every
//      SAMpaign, without removing anyone. Resume the same way.
//   3. Resuming a SAMpaign says first what stays on hold, and why.
// Loaded after app-y.js.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function call(action, body) { return _sampEdge(action, body || {}); }
  function toast(m) { try { showToast(m); } catch (_e) {} }
  function day(iso, long) { var d = new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' }); }
  function ago(iso) { if (!iso) return ''; var n = Math.floor((Date.now() - Date.parse(String(iso).length === 10 ? iso + 'T12:00:00' : iso)) / 86400000); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago'; }
  function ini(n) { return String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (x) { return x[0]; }).join('').toUpperCase(); }
  function money(v, cur) { if (v == null) return ''; try { return new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en-GB', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 0 }).format(v); } catch (_e) { return (cur || '') + ' ' + v; } }
  var IC = {
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    meeting: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.3c2.4.1 4 1.6 4.5 4.2"/></svg>',
    calendar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/></svg>',
    ask: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 18.5V6.8A2.3 2.3 0 017.3 4.5h9.4A2.3 2.3 0 0119 6.8v6.4a2.3 2.3 0 01-2.3 2.3H9z"/><path d="M10 9.3a2 2 0 113 1.7c-.7.4-1 .8-1 1.5M12 14.6v.1"/></svg>',
    proposal: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4M9 12h6M9 15.5h6"/></svg>',
    terms: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l4.2 4.2L19.5 6"/><path d="M4.5 6.5h7"/></svg>',
    reply: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>',
    sam: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z"/></svg>',
    pause: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>',
    play: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 5l11 7-11 7z"/></svg>',
    tick: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
    up: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>'
  };

  (function css() {
    if (document.getElementById('zCss')) return;
    var st = document.createElement('style'); st.id = 'zCss';
    st.textContent = [
      '.zr-wrap{position:fixed;inset:0;z-index:9990;background:rgba(20,16,10,.42);display:flex;align-items:stretch;justify-content:center;padding:3vh 18px;animation:zrFade .18s ease}',
      '@keyframes zrFade{from{opacity:0}to{opacity:1}}@keyframes zrUp{from{transform:translateY(12px);opacity:.4}to{transform:none;opacity:1}}',
      '.zr{background:var(--bg);color:var(--text);width:100%;max-width:1180px;border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden;animation:zrUp .24s cubic-bezier(.2,.8,.2,1)}',
      '.zr-head{padding:20px 26px 16px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,rgba(var(--c-accent-rgb),.07),transparent 70%)}',
      '.zr-top{display:flex;align-items:flex-start;gap:16px}.zr-tt{flex:1;min-width:0}',
      '.zr-eyebrow{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);font-weight:650}',
      '.zr-tt h2{margin:4px 0 8px;font-size:26px;line-height:1.15;font-weight:700;letter-spacing:-.01em}',
      '.zr-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
      '.zr-chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:rgba(127,127,127,.1);color:var(--text2)}',
      '.zr-chip.gold{background:rgba(var(--c-accent-rgb),.14);color:var(--c-accent-text)}.zr-chip.ok{background:var(--c-verified-wash);color:var(--c-verified)}.zr-chip.warn{background:var(--c-partial-wash);color:var(--c-partial)}.zr-chip.risk{background:var(--c-risk-wash);color:var(--c-risk)}',
      '.zr-x{border:0;background:rgba(127,127,127,.1);color:var(--text2);width:36px;height:36px;border-radius:50%;cursor:pointer;display:grid;place-items:center;flex:none}.zr-x:hover{background:rgba(127,127,127,.18)}.zr-x:focus-visible{outline:2px solid var(--c-accent)}',
      '.zr-kpis{display:grid;grid-template-columns:auto repeat(4,minmax(0,1fr));gap:12px;margin-top:16px;align-items:stretch}',
      '.zr-ring{display:flex;align-items:center;gap:12px;padding:8px 16px 8px 8px;border-radius:16px;background:var(--surface);border:1px solid var(--border)}',
      '.zr-ring svg{flex:none}.zr-ring b{display:block;font-size:13px;font-weight:650}.zr-ring small{display:block;font-size:12px;color:var(--text3);max-width:180px}',
      '.zr-kpi{padding:10px 14px;border-radius:16px;background:var(--surface);border:1px solid var(--border)}.zr-kpi span{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);font-weight:650}.zr-kpi b{display:block;font-size:17px;font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums}.zr-kpi small{display:block;font-size:12px;color:var(--text3);margin-top:2px}',
      '.zr-next{display:flex;align-items:center;gap:12px;margin-top:14px;padding:12px 14px;border-radius:14px;background:var(--surface);border:1px solid rgba(var(--c-accent-rgb),.35)}',
      '.zr-next .zr-nt{flex:1;font-size:14px;line-height:1.45}.zr-next .zr-nt b{color:var(--c-accent-text);margin-right:6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase}',
      '.zr-acts{display:flex;gap:8px;flex-wrap:wrap}',
      '.zr-body{flex:1;overflow-y:auto;padding:20px 26px 28px;display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:18px;align-content:start}',
      '.zr-col{display:flex;flex-direction:column;gap:18px;min-width:0}',
      '.zr-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:16px 18px}',
      '.zr-card h3{margin:0 0 2px;font-size:14.5px;font-weight:700}.zr-card .zr-sub{font-size:12.5px;color:var(--text3);margin-bottom:12px}',
      // journey track
      '.zr-track{display:flex;gap:0;margin:6px 0 2px;position:relative}',
      '.zr-step{flex:1;position:relative;text-align:center;padding-top:22px;font-size:12px;color:var(--text3);min-width:0}',
      '.zr-step:before{content:"";position:absolute;top:8px;left:0;right:0;height:3px;background:rgba(127,127,127,.18)}.zr-step:first-child:before{left:50%}.zr-step:last-child:before{right:50%}',
      '.zr-step.done:before{background:var(--c-accent)}.zr-step.current~.zr-step:before{background:rgba(127,127,127,.18)}',
      '.zr-step i{position:absolute;top:2px;left:50%;margin-left:-7.5px;width:15px;height:15px;border-radius:50%;background:var(--bg);border:3px solid rgba(127,127,127,.3);box-sizing:border-box}',
      '.zr-step.done i{background:var(--c-accent);border-color:var(--c-accent)}.zr-step.current i{box-shadow:0 0 0 5px rgba(var(--c-accent-rgb),.2)}',
      '.zr-step b{display:block;color:var(--text2);font-weight:600;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.zr-step.done b{color:var(--text)}',
      // timeline
      '.zr-tl{list-style:none;margin:0;padding:0}.zr-tl li{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--border)}.zr-tl li:first-child{border-top:0}',
      '.zr-ic{flex:none;width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:rgba(127,127,127,.1);color:var(--text2)}',
      '.zr-ic.meeting,.zr-ic.calendar{background:var(--c-info-wash);color:var(--c-info)}.zr-ic.terms,.zr-ic.sam{background:rgba(var(--c-accent-rgb),.14);color:var(--c-accent-text)}.zr-ic.reply,.zr-ic.ask{background:var(--c-verified-wash);color:var(--c-verified)}',
      '.zr-tm{flex:1;min-width:0}.zr-tm .zr-q{font-size:13.5px;line-height:1.5;color:var(--text)}.zr-tm small{display:block;font-size:12px;color:var(--text3);margin-top:3px}',
      // terms
      '.zr-terms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.zr-terms div{padding:10px 12px;border-radius:12px;background:rgba(127,127,127,.06)}.zr-terms span{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);font-weight:650}.zr-terms b{display:block;font-size:14px;margin-top:3px;font-weight:650;line-height:1.35}',
      // health
      '.zr-bars{list-style:none;margin:0;padding:0}.zr-bars li{padding:8px 0}.zr-bh{display:flex;justify-content:space-between;font-size:13px;font-weight:600}.zr-bh em{font-style:normal;color:var(--text3);font-weight:500;font-variant-numeric:tabular-nums}',
      '.zr-bar{height:7px;border-radius:99px;background:rgba(127,127,127,.14);margin:6px 0 4px;overflow:hidden}.zr-bar i{display:block;height:100%;border-radius:99px;background:var(--c-accent);transition:width .5s ease}',
      '.zr-bars small{font-size:12px;color:var(--text3);line-height:1.4;display:block}',
      '.zr-gaps{list-style:none;margin:12px 0 0;padding:12px 0 0;border-top:1px dashed var(--border)}.zr-gaps li{display:flex;gap:10px;align-items:flex-start;padding:7px 0;font-size:13px;line-height:1.45}',
      '.zr-gaps .zr-dot{flex:none;width:8px;height:8px;border-radius:50%;margin-top:6px;background:var(--c-partial)}.zr-gaps .risk .zr-dot{background:var(--c-risk)}.zr-gaps .wait .zr-dot{background:var(--text3)}.zr-gaps .do .zr-dot{background:var(--c-accent)}',
      '.zr-gaps .zr-gt{flex:1}.zr-gaps .zr-gain{flex:none;font-size:11.5px;font-weight:700;color:var(--c-verified);display:inline-flex;align-items:center;gap:2px}',
      '.zr-mini{border:1px solid var(--border);background:var(--bg);color:var(--text);font:inherit;font-size:12px;font-weight:600;padding:5px 10px;border-radius:999px;cursor:pointer;white-space:nowrap}.zr-mini:hover{border-color:var(--c-accent)}.zr-mini.gold{background:var(--c-accent);border-color:var(--c-accent);color:#1A1610}.zr-mini:focus-visible{outline:2px solid var(--c-accent);outline-offset:1px}',
      // meddpicc
      '.zr-md{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
      '.zr-mf{border:1px solid var(--border);border-radius:14px;padding:10px 12px;background:var(--bg);display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.zr-mf.sam{border-style:dashed;border-color:rgba(var(--c-accent-rgb),.55)}.zr-mf.confirmed{border-color:var(--c-verified)}.zr-mf.unknown{background:rgba(127,127,127,.04)}',
      '.zr-mh{display:flex;align-items:center;gap:8px}.zr-ml{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;font-size:11.5px;font-weight:800;background:rgba(127,127,127,.12);color:var(--text2);flex:none}',
      '.zr-mf.confirmed .zr-ml{background:var(--c-verified-wash);color:var(--c-verified)}.zr-mf.sam .zr-ml{background:rgba(var(--c-accent-rgb),.16);color:var(--c-accent-text)}',
      '.zr-mh b{font-size:12.5px;flex:1}.zr-ms{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text3)}.zr-mf.sam .zr-ms{color:var(--c-accent-text)}.zr-mf.confirmed .zr-ms{color:var(--c-verified)}',
      '.zr-mv{font-size:12.5px;line-height:1.45;color:var(--text);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.zr-mf.unknown .zr-mv{color:var(--text3)}',
      '.zr-mq{font-size:11.5px;color:var(--text3)}.zr-mb{display:flex;gap:6px;margin-top:auto}',
      '.zr-mf input{width:100%;font:inherit;font-size:12.5px;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);box-sizing:border-box}',
      // people
      '.zr-pp{list-style:none;margin:0;padding:0}.zr-pp li{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--border)}.zr-pp li:first-child{border-top:0}',
      '.zr-av{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;background:rgba(var(--c-accent-rgb),.16);color:var(--c-accent-text);flex:none}',
      '.zr-pm{flex:1;min-width:0}.zr-pm b{font-size:13.5px}.zr-pm small{display:block;font-size:12px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.zr-hold{margin-top:12px;padding:10px 12px;border-radius:12px;background:rgba(127,127,127,.07);font-size:12.5px;color:var(--text2);display:flex;align-items:center;gap:10px}.zr-hold span{flex:1}',
      '.zr-sk{height:12px;border-radius:6px;background:rgba(127,127,127,.12);margin:10px 0;animation:zrPulse 1.2s ease-in-out infinite}@keyframes zrPulse{50%{opacity:.5}}',
      '@media (max-width:900px){.zr-body{grid-template-columns:1fr}.zr-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.zr-kpis .zr-ring{grid-column:1/-1}}',
      '.zr-step b.s{display:none}',
      '@media (max-width:640px){.zr-wrap{padding:0}.zr{border-radius:0;max-width:none;display:block;overflow-y:auto}.zr-head{padding:16px 16px 12px}.zr-body{padding:14px 16px 24px;overflow:visible}.zr-tt h2{font-size:22px}.zr-md{grid-template-columns:1fr}.zr-terms{grid-template-columns:1fr}.zr-next{flex-direction:column;align-items:stretch}.zr-next .zr-acts{width:100%}.zr-next .zr-acts .g-btn{flex:1 1 auto}.zr-step b{font-size:11px}.zr-step b.l{display:none}.zr-step b.s{display:block}.zr-step small{display:none}}',
      // People: pause controls
      '.zp-co{display:inline-flex;align-items:center;gap:6px;margin-left:8px;vertical-align:1px}',
      '.zp-chip{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:650;padding:3px 9px;border-radius:999px;background:rgba(127,127,127,.1);color:var(--text2)}.zp-chip.deal{background:rgba(var(--c-accent-rgb),.14);color:var(--c-accent-text)}',
      '.zp-btn{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--border);background:var(--surface);color:var(--text2);font:inherit;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;cursor:pointer}.zp-btn:hover{border-color:var(--c-accent);color:var(--text)}.zp-btn:focus-visible{outline:2px solid var(--c-accent)}',
      '.sd-prs.zp-held{opacity:.78}.sd-prs.zp-held .sp-av{filter:grayscale(1)}',
      // resume summary
      '.zs-list{list-style:none;margin:12px 0 0;padding:0}.zs-list li{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--border);font-size:13.5px;line-height:1.45}.zs-list li:first-child{border-top:0}.zs-list small{display:block;color:var(--text3);font-size:12.5px}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  // ── 1. The deal room ───────────────────────────────────────────────────
  var BAND = { healthy: ['Healthy', 'var(--c-verified)', 'ok'], watch: ['Watch', 'var(--c-partial)', 'warn'], at_risk: ['At risk', 'var(--c-risk)', 'risk'], critical: ['Critical', 'var(--c-risk)', 'risk'], unknown: ['Not scored', 'var(--text3)', ''] };
  function ring(score, band) {
    var b = BAND[band] || BAND.unknown, r = 26, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, Number(score) || 0));
    return '<svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Health ' + e(v) + ' of 100"><circle cx="32" cy="32" r="' + r + '" fill="none" stroke="rgba(127,127,127,.16)" stroke-width="7"/>' +
      '<circle cx="32" cy="32" r="' + r + '" fill="none" stroke="' + b[1] + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (c * v / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 32 32)"/>' +
      '<text x="32" y="37" text-anchor="middle" font-size="17" font-weight="700" fill="currentColor">' + (score == null ? '–' : e(v)) + '</text></svg>';
  }
  window._zr = window._zr || { d: null, id: null };
  function close() { var el = document.getElementById('zRoom'); if (el) el.remove(); document.removeEventListener('keydown', key); }
  function key(ev) { if (ev.key === 'Escape' && !document.querySelector('.sp-modal')) close(); }
  window.zRoomClose = close;
  window.zRoomOpen = async function (id, name) {
    close();
    var el = document.createElement('div'); el.id = 'zRoom'; el.className = 'zr-wrap';
    el.innerHTML = '<div class="zr" role="dialog" aria-modal="true" aria-label="Deal ' + e(name || '') + '"><div class="zr-head"><div class="zr-top"><div class="zr-tt"><div class="zr-eyebrow">Deal</div><h2>' + e(name || 'Loading…') + '</h2></div><button class="zr-x" type="button" aria-label="Close" onclick="zRoomClose()">' + IC.x + '</button></div></div>' +
      '<div class="zr-body"><div class="zr-col"><div class="zr-card"><div class="zr-sk" style="width:40%"></div><div class="zr-sk"></div><div class="zr-sk" style="width:70%"></div></div></div><div class="zr-col"><div class="zr-card"><div class="zr-sk" style="width:50%"></div><div class="zr-sk"></div></div></div></div></div>';
    el.addEventListener('click', function (ev) { if (ev.target === el) close(); });
    document.body.appendChild(el);
    document.addEventListener('keydown', key);
    var d = await call('get_deal_room', { account_id: id });
    if (!document.getElementById('zRoom')) return;
    if (!d.ok) { el.querySelector('.zr-body').innerHTML = '<div class="zr-card">' + e(d.error || 'Could not open this deal.') + '</div>'; return; }
    window._zr = { d: d, id: id };
    paint();
    var x = el.querySelector('.zr-x'); if (x) x.focus();
  };
  function paint() {
    var d = window._zr.d, el = document.getElementById('zRoom'); if (!d || !el) return;
    var a = d.account, b = BAND[a.band] || BAND.unknown, nx = d.next, L = d.lead;
    var chips = (d.phase_label ? '<span class="zr-chip gold">' + e(d.phase_label) + '</span>' : '') + (a.stage_label ? '<span class="zr-chip">' + e(a.stage_label) + '</span>' : '') +
      (L && L.pilot ? '<span class="zr-chip">Pilot</span>' : '') + (a.status === 'won' ? '<span class="zr-chip ok">Won</span>' : '') + (L && L.hands_off ? '<span class="zr-chip" title="You set the stage, so SAM leaves it to you">Stage set by you</span>' : '');
    var valTxt = a.value ? money(a.value, a.currency) : 'Not set';
    var acts = '<div class="zr-acts">' +
      (nx && nx.sam && L ? '<button class="g-btn sp-gold" type="button" onclick="zRoomSam()">' + IC.sam + ' Let SAM write it</button>' : '') +
      (L && L.next_meeting ? '<button class="g-btn" type="button" onclick="zRoomPrep()">' + IC.calendar + ' Prep for the call</button>' : '') +
      '<button class="g-btn" type="button" onclick="zRoomClose();openDealValueForm(\'' + e(a.id) + '\',\'' + e(String(a.name).replace(/'/g, '')) + '\')">Update deal</button>' +
      (a.is_deal ? '<button class="g-btn" type="button" onclick="zRoomClose();openCloseDeal(\'' + e(a.id) + '\',\'' + e(String(a.name).replace(/'/g, '')) + '\')">Mark won or lost</button>' : '') + '</div>';
    var head = '<div class="zr-top"><div class="zr-tt"><div class="zr-eyebrow">Deal' + (a.owner ? ' · ' + e(a.owner) : '') + (a.domain ? ' · ' + e(a.domain) : '') + '</div><h2>' + e(a.name) + '</h2><div class="zr-chips">' + chips + '</div></div>' +
      '<button class="zr-x" type="button" aria-label="Close" onclick="zRoomClose()">' + IC.x + '</button></div>' +
      '<div class="zr-kpis"><div class="zr-ring">' + ring(a.health, a.band) + '<div><b style="color:' + b[1] + '">' + e(b[0]) + '</b><small>' + e(a.reason || (a.health == null ? 'Scored once it is a deal' : '')) + '</small></div></div>' +
        '<div class="zr-kpi"><span>Value</span><b>' + e(valTxt) + '</b><small>' + (a.value_usd && a.currency !== 'USD' ? e(money(a.value_usd, 'USD')) : (a.value ? '&nbsp;' : 'Add it when you know it')) + '</small></div>' +
        '<div class="zr-kpi"><span>Close</span><b>' + e(a.expected_close ? day(a.expected_close, true) : 'Not set') + '</b><small>' + (a.close_by_sam ? 'Found by SAM, from your email' : a.expected_close ? '&nbsp;' : 'Set one to plan the month') + '</small></div>' +
        '<div class="zr-kpi"><span>In this stage</span><b>' + e(L && L.stage_at ? ago(L.stage_at).replace(' ago', '') : '–') + '</b><small>' + e(L ? L.label : '') + '</small></div>' +
        '<div class="zr-kpi"><span>Signal</span><b>' + e(a.signal == null ? '–' : a.signal + '/100') + '</b><small>From the evidence</small></div></div>' +
      (nx ? '<div class="zr-next"><div class="zr-nt"><b>Next</b>' + e(String(nx.text || '').replace(/^\S+ \S+ \([^)]*\): /, '')) + '</div>' + acts + '</div>' : '<div class="zr-next"><div class="zr-nt"><b>Next</b>Nothing is due. SAM is watching the mailbox and calendar.</div>' + acts + '</div>');
    // Left column
    var track = '<div class="zr-card"><h3>Where it stands</h3><div class="zr-sub">Each step is proven by a meeting, an email or a recap.</div><div class="zr-track">' + (d.track || []).map(function (t) {
      var SH = { replied: 'Replied', meeting_booked: 'Booked', meeting_held: 'Met', proposal_sent: 'Proposal', negotiation: 'Negotiate', committed: 'Go-ahead', won: 'Won' };
      return '<div class="zr-step' + (t.done ? ' done' : '') + (t.current ? ' current' : '') + '"><i></i><b class="l">' + e(t.label) + '</b><b class="s">' + e(SH[t.key] || t.label) + '</b><small>' + e(t.at ? day(t.at) : '') + '</small></div>';
    }).join('') + '</div></div>';
    var tl = (d.timeline || []).map(function (x) {
      return '<li><span class="zr-ic ' + e(x.kind) + '">' + (IC[x.kind] || IC.sam) + '</span><div class="zr-tm"><div class="zr-q">' + (x.kind === 'sam' ? '' : (x.label ? '<b>' + e(x.label) + '.</b> ' : '')) + (x.kind === 'sam' ? e(x.quote) : '“' + e(String(x.quote || '').slice(0, 220)) + '”') + '</div><small>' + e([x.person, x.source, day(x.at, true)].filter(Boolean).join(' · ')) + '</small></div></li>';
    }).join('');
    var tlCard = '<div class="zr-card"><h3>What happened</h3><div class="zr-sub">Newest first. The words are theirs and yours, not SAM’s.</div>' + (tl ? '<ul class="zr-tl">' + tl + '</ul>' : '<div class="zr-sub">Nothing yet. A reply, a meeting or a proposal starts the story.</div>') + '</div>';
    var T = d.terms, termsCard = '';
    if (T) {
      var cell = function (lab, v) { return v ? '<div><span>' + e(lab) + '</span><b>' + e(v) + '</b></div>' : ''; };
      termsCard = '<div class="zr-card"><h3>Terms on the table</h3><div class="zr-sub">From your email' + (T.at ? ' of ' + e(day(T.at, true)) : '') + '.</div><div class="zr-terms">' +
        cell('Fee', T.fee ? money(T.fee.amount, T.fee.currency) : '') + cell('Length', T.length ? T.length.n + ' ' + T.length.unit + (T.length.n === 1 ? '' : 's') : '') + cell('Success', T.success && T.success.text) +
        cell('Start', T.start ? day(T.start.date, true) : '') + cell('After the pilot', T.after && T.after.text) + cell('Paper', T.loi ? (T.loi.name || 'LOI attached') : '') + '</div></div>';
    }
    // Right column
    var H = d.health;
    var bars = H ? '<ul class="zr-bars">' + (H.components || []).map(function (c) {
      var pct = c.weight ? Math.max(0, Math.round(c.points / c.weight * 100)) : 0;
      return '<li><div class="zr-bh"><span>' + e(c.label) + '</span><em>' + e(c.points) + ' / ' + e(c.weight) + '</em></div><div class="zr-bar"><i style="width:' + pct + '%"></i></div><small>' + e(c.raw || '') + '</small></li>';
    }).join('') + '</ul>' : '<div class="zr-sub">Scored once it is a deal.</div>';
    var gaps = (d.gaps || []).map(function (g, i) {
      var btn = '';
      if (g.key === 'confirm') btn = '<button class="zr-mini" type="button" onclick="document.getElementById(\'zrMedd\').scrollIntoView({behavior:\'smooth\',block:\'start\'})">Review</button>';
      else if (g.key === 'value' && g.fee) btn = '<button class="zr-mini gold" type="button" onclick="zRoomUseFee(this)">Use it</button>';
      else if (g.key === 'close' && g.date) btn = '<button class="zr-mini gold" type="button" onclick="zRoomClose2(\'' + e(g.date) + '\',this)">Set ' + e(day(g.date)) + '</button>';
      else if (g.field) btn = '<button class="zr-mini" type="button" onclick="zRoomEdit(\'' + e(g.field) + '\')">Add</button>';
      return '<li class="' + e(g.tone) + '"><span class="zr-dot"></span><span class="zr-gt">' + e(g.text) + '</span>' + (g.gain ? '<span class="zr-gain">' + IC.up + e(g.gain) + '</span>' : '') + btn + '</li>';
    }).join('');
    var healthCard = '<div class="zr-card"><h3>Health</h3><div class="zr-sub">Five parts, weighted by your organisation. Every number shows its working.</div>' + bars +
      (gaps ? '<div class="zr-eyebrow" style="margin-top:14px">What would raise it</div><ul class="zr-gaps">' + gaps + '</ul>' : '') + '</div>';
    var md = (d.meddpicc || []).map(function (m) {
      var cls = m.status === 'confirmed' ? 'confirmed' : m.by === 'sam' ? 'sam' : m.status === 'unknown' && !m.value ? 'unknown' : '';
      var stTxt = m.status === 'confirmed' ? 'Confirmed' : m.by === 'sam' ? 'SAM found' : m.status === 'unknown' && !m.value ? 'Not known' : m.status === 'missing' ? 'Missing' : 'Yours';
      var btns = m.by === 'sam' ? '<button class="zr-mini gold" type="button" onclick="zRoomConfirm(\'' + e(m.key) + '\',this)">' + IC.tick + ' Confirm</button><button class="zr-mini" type="button" onclick="zRoomEdit(\'' + e(m.key) + '\')">Edit</button>'
        : m.status === 'confirmed' ? '<button class="zr-mini" type="button" onclick="zRoomEdit(\'' + e(m.key) + '\')">Edit</button>'
        : '<button class="zr-mini" type="button" onclick="zRoomEdit(\'' + e(m.key) + '\')">' + (m.value ? 'Edit' : 'Add') + '</button>' + (m.value ? '<button class="zr-mini" type="button" onclick="zRoomConfirm(\'' + e(m.key) + '\',this)">' + IC.tick + ' Confirm</button>' : '');
      return '<div class="zr-mf ' + cls + '" id="zrM_' + e(m.key) + '"><div class="zr-mh"><span class="zr-ml">' + e(m.letter) + '</span><b>' + e(m.label) + '</b><span class="zr-ms">' + e(stTxt) + '</span></div>' +
        '<div class="zr-mv">' + e(m.value || m.ask) + '</div>' + (m.by === 'sam' && m.source ? '<div class="zr-mq">From ' + e(m.source) + (m.at ? ' · ' + e(day(m.at)) : '') + '</div>' : '') + '<div class="zr-mb">' + btns + '</div></div>';
    }).join('');
    var nSam = (d.meddpicc || []).filter(function (m) { return m.by === 'sam'; }).length;
    var meddCard = '<div class="zr-card" id="zrMedd"><div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><h3 style="flex:1">MEDDPICC</h3>' + (nSam ? '<button class="zr-mini gold" type="button" onclick="zRoomConfirmAll(this)">' + IC.tick + ' Confirm all ' + nSam + '</button>' : '') + '</div>' +
      '<div class="zr-sub">' + (nSam ? 'SAM found ' + nSam + ' from your meetings and emails. They count half until you confirm.' : 'What you know about how they buy.') + '</div><div class="zr-md">' + md + '</div></div>';
    var ppl = (d.people || []).map(function (p) {
      return '<li><span class="zr-av">' + e(ini(p.name)) + '</span><div class="zr-pm"><b>' + e(p.name) + '</b>' + (p.role === 'champion' ? ' <span class="zr-chip gold" style="padding:2px 8px;font-size:11px">Champion</span>' : '') +
        '<small>' + e([p.title, p.last ? 'last contact ' + ago(p.last) : 'no contact yet'].filter(Boolean).join(' · ')) + '</small></div></li>';
    }).join('');
    var holds = (d.holds || []).map(function (h) {
      var names = h.people.map(function (p) { return String(p.name || '').split(' ')[0]; });
      return '<div class="zr-hold">' + IC.pause + '<span>' + e(names.slice(0, 3).join(', ') + (names.length > 3 ? ' and ' + (names.length - 3) + ' more' : '')) + (h.manual ? ' paused by you.' : ' on hold while the deal is live.') + '</span><button class="zr-mini" type="button" onclick="zRoomResume(\'' + e(h.key) + '\',this)">' + IC.play + ' Resume</button></div>';
    }).join('');
    var pauseBtn = !(d.holds || []).some(function (h) { return h.manual && h.kind === 'company'; }) && L ? '<div class="zr-hold">' + IC.pause + '<span>Stop all outreach to ' + e(a.name) + ' in every SAMpaign, without removing anyone.</span><button class="zr-mini" type="button" onclick="zRoomPause(this)">Pause company</button></div>' : '';
    var peopleCard = '<div class="zr-card"><h3>Buying group</h3><div class="zr-sub">' + ((d.people || []).length ? (d.people || []).length + ' on the account' + (d.company_people ? ', ' + d.company_people + ' in your SAMpaigns' : '') : 'Nobody on the account yet') + '.</div>' + (ppl ? '<ul class="zr-pp">' + ppl + '</ul>' : '') + holds + pauseBtn + '</div>';
    el.querySelector('.zr').innerHTML = '<div class="zr-head">' + head + '</div><div class="zr-body"><div class="zr-col">' + track + termsCard + tlCard + '</div><div class="zr-col">' + healthCard + meddCard + peopleCard + '</div></div>';
  }
  async function reload() { var id = window._zr.id; var d = await call('get_deal_room', { account_id: id }); if (d.ok) { window._zr.d = d; paint(); } try { scInvalidate(); } catch (_e) {} }
  window.zRoomConfirm = async function (k, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var f = {}; f[k + '_status'] = 'confirmed';
    await call('save_meddpicc', { account_id: window._zr.id, fields: f });
    toast('Confirmed. It now counts in full.'); reload();
  };
  window.zRoomConfirmAll = async function (btn) {
    var ks = (window._zr.d.meddpicc || []).filter(function (m) { return m.by === 'sam'; }).map(function (m) { return m.key; });
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var f = {}; ks.forEach(function (k) { f[k + '_status'] = 'confirmed'; });
    await call('save_meddpicc', { account_id: window._zr.id, fields: f });
    toast('Confirmed ' + ks.length + '. They count in full now.'); reload();
  };
  var VAL = { metrics: 'metrics_value', economic_buyer: 'economic_buyer_name', decision_criteria: 'decision_criteria_value', decision_process: 'decision_process_value', paper_process: 'paper_process_value', identified_pain: 'identified_pain_value', champion: 'champion_name', competition: 'competition_value' };
  window.zRoomEdit = function (k) {
    var tile = document.getElementById('zrM_' + k); if (!tile) return;
    var m = (window._zr.d.meddpicc || []).find(function (x) { return x.key === k; }) || {};
    tile.scrollIntoView({ behavior: 'smooth', block: 'center' });
    tile.querySelector('.zr-mv').outerHTML = '<input id="zrIn_' + e(k) + '" value="' + e(m.value || '') + '" placeholder="' + e(m.ask || '') + '" aria-label="' + e(m.label) + '">';
    tile.querySelector('.zr-mb').innerHTML = '<button class="zr-mini gold" type="button" onclick="zRoomSave(\'' + e(k) + '\',this)">Save</button><button class="zr-mini" type="button" onclick="zRoomRepaint()">Cancel</button>';
    var inp = document.getElementById('zrIn_' + k); inp.focus();
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') zRoomSave(k); if (ev.key === 'Escape') { ev.stopPropagation(); paint(); } });
  };
  window.zRoomRepaint = paint;
  window.zRoomSave = async function (k, btn) {
    var v = (document.getElementById('zrIn_' + k) || {}).value || '';
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var f = {}; f[VAL[k]] = v.trim(); f[k + '_status'] = v.trim() ? 'confirmed' : 'unknown';
    await call('save_meddpicc', { account_id: window._zr.id, fields: f });
    toast('Saved.'); reload();
  };
  window.zRoomUseFee = async function (btn) {
    var g = (window._zr.d.gaps || []).find(function (x) { return x.key === 'value'; }); if (!g || !g.fee) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var r = await call('upsert_deal_value', { account_id: window._zr.id, deal_value: g.fee.amount, deal_currency: g.fee.currency });
    toast(r && r.error ? r.error : 'Deal value set: ' + money(g.fee.amount, g.fee.currency) + '.'); reload();
  };
  window.zRoomClose2 = async function (date, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var r = await call('upsert_deal_value', { account_id: window._zr.id, expected_close: date });
    toast(r && r.error ? r.error : 'Close date set: ' + day(date, true) + '.'); reload();
  };
  window.zRoomResume = async function (k, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Resuming…'; }
    var r = await call('release_account_hold', { key: k });
    toast(r.ok ? r.note : (r.error || 'Could not resume.')); reload();
  };
  window.zRoomPause = async function (btn) {
    var L = window._zr.d.lead; if (!L) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Pausing…'; }
    var r = await call('pause_outreach', { contact_id: L.contact_id, scope: 'company' });
    toast(r.ok ? r.note : (r.error || 'Could not pause.')); reload();
  };
  window.zRoomSam = function () {
    var d = window._zr.d, L = d.lead, nx = d.next; if (!L || !nx) return;
    try { g27ReplyOpen([{ id: L.contact_id, name: L.name, email: L.email, channel: 'email', purpose: nx.sam === 'follow_up' ? 'follow_up' : undefined }], { id: L.campaign_id, name: '' }); } catch (_e) { toast('Open the SAMpaign to write it.'); }
  };
  window.zRoomPrep = function () {
    var d = window._zr.d, L = d.lead || {}, m = L.next_meeting || {};
    var first = String(L.name || 'them').split(' ')[0];
    var ask = (d.timeline || []).find(function (x) { return x.kind === 'reply' || x.kind === 'ask'; });
    var unknown = (d.meddpicc || []).filter(function (x) { return x.status === 'unknown' && !x.value; });
    var inner = '<div class="y-prep">' + '<div class="y-when">' + e(m.title || 'Call with ' + first) + (m.at ? ' · ' + e(day(m.at, true)) : '') + '</div>' +
      (ask ? '<h5>What ' + e(first) + ' said last</h5><div class="y-ask">“' + e(ask.quote) + '”</div>' : '') +
      (d.terms ? '<h5>Terms on the table</h5><div class="y-ask">' + e([d.terms.fee ? money(d.terms.fee.amount, d.terms.fee.currency) : '', d.terms.length ? d.terms.length.n + ' ' + d.terms.length.unit + 's' : '', d.terms.success ? d.terms.success.text : '', d.terms.start ? 'start ' + day(d.terms.start.date, true) : ''].filter(Boolean).join(' · ')) + '</div>' : '') +
      (unknown.length ? '<h5>Find out on the call</h5><ol>' + unknown.map(function (u) { return '<li>' + e(u.ask) + '</li>'; }).join('') + '</ol>' : '') +
      '<div class="sp-foot"><button class="g-btn sp-gold" type="button" onclick="document.getElementById(\'zPrepM\').remove()">Done</button></div></div>';
    _g34Modal('zPrepM', 'Prep: call with ' + first, inner);
  };
  // Every way into a deal opens the room.
  if (typeof scOpen === 'function' && !scOpen._z) {
    var sc0 = scOpen;
    scOpen = function (id) { var a = (typeof scFind === 'function') ? scFind(id) : null; if (a && !a.is_deal && !(a.people && a.people.length)) return sc0.apply(this, arguments); zRoomOpen(id, a ? a.name : ''); };
    scOpen._z = true; window.scOpen = scOpen;
  }
  if (typeof openDealDetail === 'function' && !openDealDetail._z) {
    var od0 = openDealDetail;
    openDealDetail = function (id, name, tab) { if (tab) return od0.apply(this, arguments); zRoomOpen(id, name); };
    openDealDetail._z = true; window.openDealDetail = openDealDetail;
  }

  // ── 2. People: pause or resume a company or a person ───────────────────
  if (typeof _spPaintPeople === 'function' && !_spPaintPeople._z) {
    var pp0 = _spPaintPeople;
    _spPaintPeople = function (id) {
      var r = pp0.apply(this, arguments);
      try { decorate(id); } catch (_e) {}
      return r;
    };
    _spPaintPeople._z = true;
  }
  function decorate(id) {
    var host = typeof _spPeopleHost === 'function' ? _spPeopleHost(id) : null, d = (window._spPeople || {})[id];
    if (!host || !d || !(d.is_owner || d.can_move)) return;
    var by = {}; (d.people || []).forEach(function (p) { by[p.id] = p; });
    host.querySelectorAll('section.sd-co').forEach(function (sec) {
      var ps = [].slice.call(sec.querySelectorAll('li.sd-prs')).map(function (li) { return by[li.dataset.cid]; }).filter(Boolean);
      if (!ps.length) return;
      var co = ps.find(function (p) { return p.held && p.held.kind === 'company'; });
      var hb = sec.querySelector('header b'); if (!hb || sec.querySelector('.zp-co')) return;
      var name = (ps[0].account_name || ps[0].company || 'this company');
      var html = co ? '<span class="zp-co"><span class="zp-chip ' + (co.held.manual ? '' : 'deal') + '">' + IC.pause + (co.held.manual ? 'Paused by you' : 'On hold: ' + e(String(co.held.lead || '').split(' ')[0]) + ' is in a deal') + '</span><button class="zp-btn" type="button" onclick="zpResume(\'' + e(id) + '\',\'' + e(co.held.key) + '\',null,this)">' + IC.play + 'Resume</button></span>'
        : '<span class="zp-co"><button class="zp-btn" type="button" aria-label="Pause ' + e(name) + ' in every SAMpaign" onclick="zpPause(\'' + e(id) + '\',\'' + e(ps[0].id) + '\',\'company\',this)">' + IC.pause + 'Pause company</button></span>';
      hb.insertAdjacentHTML('afterend', html);
    });
    host.querySelectorAll('li.sd-prs').forEach(function (li) {
      var p = by[li.dataset.cid]; if (!p || li.querySelector('.zp-btn')) return;
      if (p.stage === 'deal' || p.stage === 'meeting') return;
      var pa = li.querySelector('.sd-pa'); if (!pa) { pa = document.createElement('div'); pa.className = 'sd-pa'; li.appendChild(pa); }
      if (p.held) { li.classList.add('zp-held'); pa.insertAdjacentHTML('afterbegin', '<button class="zp-btn" type="button" onclick="zpResume(\'' + e(id) + '\',\'' + e(p.held.key) + '\',' + (p.held.kind === 'person' ? 'null' : '\'' + e(p.id) + '\'') + ',this)">' + IC.play + 'Resume</button>'); }
      else pa.insertAdjacentHTML('afterbegin', '<button class="zp-btn" type="button" aria-label="Pause ' + e(p.name || 'this person') + ' in every SAMpaign" onclick="zpPause(\'' + e(id) + '\',\'' + e(p.id) + '\',\'person\',this)">' + IC.pause + 'Pause</button>');
    });
  }
  window.zpPause = async function (id, cid, scope, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Pausing…'; }
    var r = await call('pause_outreach', { contact_id: cid, scope: scope });
    toast(r.ok ? r.note : (r.error || 'Could not pause.'));
    try { await _spRenderPeople(id, true); } catch (_e) {}
  };
  window.zpResume = async function (id, key, cid, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Resuming…'; }
    var r = await call('release_account_hold', cid ? { key: key, contact_id: cid } : { key: key });
    toast(r.ok ? r.note : (r.error || 'Could not resume.'));
    try { await _spRenderPeople(id, true); } catch (_e) {}
  };

  // ── 3. Resuming a SAMpaign: what stays on hold, said first ─────────────
  if (typeof sampPause === 'function' && !sampPause._z) {
    var sp0 = sampPause;
    sampPause = async function (id, pause, confirmed) {
      if (pause || confirmed) return sp0.call(this, id, pause);
      var h = await call('get_account_holds', { campaign_id: id });
      var list = (h && h.ok && h.holds) || [];
      if (!list.length && !(h && h.replied)) return sp0.call(this, id, pause);
      var rows = list.map(function (g) {
        var n = g.people.length, who = g.people.slice(0, 3).map(function (p) { return String(p.name || '').split(' ')[0]; }).join(', ') + (n > 3 ? ' and ' + (n - 3) + ' more' : '');
        return '<li>' + IC.pause + '<div><b>' + e(g.kind === 'person' ? who : (g.company || 'A company')) + '</b>' + (g.kind === 'person' ? '' : ' · ' + n + (n === 1 ? ' person' : ' people')) +
          '<small>' + e(g.manual ? 'Paused by you. Resume them from People when you are ready.' : String(g.lead || 'A colleague').split(' ')[0] + ' is in a deal with you (' + (g.stage_label || 'live') + '). SAM keeps ' + (g.kind === 'person' ? 'them' : 'the rest of ' + (g.company || 'them')) + ' on hold until the deal is done.') + (g.kind !== 'person' && !g.manual ? '' : '') + '</small></div></li>';
      }).join('') + (h.replied ? '<li>' + IC.reply + '<div><b>' + h.replied + (h.replied === 1 ? ' person who replied' : ' people who replied') + '</b><small>They get no more follow-ups. SAM writes to them only when you answer.</small></div></li>' : '');
      var md = _g34Modal('zResumeM', 'Resume this SAMpaign?', '<div class="sp-small">Everyone else carries on where they left off. These stay as they are:</div><ul class="zs-list">' + rows + '</ul>' +
        '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'zResumeM\').remove()">Not now</button><span class="sp-acts"><button class="g-btn sp-gold" type="button" id="zResumeGo">' + IC.play + ' Resume the rest</button></span></div>');
      var go = document.getElementById('zResumeGo'); go.focus();
      go.onclick = function () { md.remove(); sp0.call(window, id, false); };
    };
    sampPause._z = true; window.sampPause = sampPause;
  }
})();
