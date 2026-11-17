// SamoraOS app: Drop AC (16 Nov 2026). Calmer Today, research inside the
// launch plan, welcome backs that write, and one tap to send again.
//   1. The launch plan knows about Research first: a bar with the switch and
//      how far the reading has got, a write step that says SAM is reading
//      (with "Write the usual emails now"), and LinkedIn notes that SAM writes
//      once each profile is read, not a button.
//   2. Today is one short list, grouped by what it is across SAMpaigns, the
//      first few shown; demos and what runs on its own are folded away. The
//      SAMpaign rail shows a line each, closed.
//   3. Welcome backs pass the people they are for to the writing job.
//   4. Emails Gmail asked to slow down are named for what they are, and go
//      again in one tap, as they were approved.
// Loaded after app-aa.js.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function call(action, body) { return _sampEdge(action, body || {}); }
  function toast(m) { try { showToast(m); } catch (_e) {} }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (_e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_e) {} }
  function day(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (_e) { return ''; } }
  function when(iso) { try { var d = new Date(iso); return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch (_e) { return ''; } }
  function senderName() { try { return (currentUser && currentUser.user_metadata && currentUser.user_metadata.full_name) || ''; } catch (_e) { return ''; } }
  var IC = {
    scan: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="12" height="15" rx="2.2"/><circle cx="9.5" cy="9.3" r="2.2"/><path d="M6.4 15.2c.7-1.6 1.8-2.4 3.1-2.4s2.4.8 3.1 2.4"/><circle cx="17.2" cy="15.6" r="3.1"/><path d="M19.5 17.9l2 2"/></svg>',
    spark: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    chev: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/></svg>',
    reply: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>',
    risk: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8.5v4.5M12 16.5v.1"/><path d="M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
    pen: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3z"/></svg>',
    away: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 108.5 8.5"/><path d="M12 7.5V12l3 2"/><path d="M17 3.5h4v4"/></svg>',
    li: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M8 10.5V16M8 7.8v.1M11.5 16v-3.2a2.3 2.3 0 014.6 0V16M11.5 10.5V16"/></svg>',
    deal: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17l5-5 4 4 7-8"/><path d="M15 8h5v5"/></svg>',
    demo: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    dot: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/></svg>'
  };

  (function css() {
    if (document.getElementById('acCss')) return;
    var st = document.createElement('style'); st.id = 'acCss';
    st.textContent = [
      // Research inside the launch plan
      '.ac-rs{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:14px 0 4px;padding:11px 14px;border-radius:14px;border:1px solid rgba(var(--c-accent-rgb),.3);background:linear-gradient(135deg,rgba(var(--c-accent-rgb),.10),rgba(var(--c-accent-rgb),.03) 70%)}',
      '.ac-rs.off{border-color:var(--g-line,var(--border));background:rgba(127,127,127,.05)}',
      '.ac-rsi{flex:none;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;color:var(--c-accent-text);background:rgba(var(--c-accent-rgb),.14)}',
      '.ac-rsm{flex:1;min-width:200px}.ac-rst{font-size:13.5px;font-weight:650;color:var(--text);display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.ac-rss{font-size:12.5px;color:var(--text2);margin-top:2px;line-height:1.45}.ac-rss b{color:var(--text);font-weight:650}',
      '.ac-k{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:999px;color:#241C05;background:linear-gradient(135deg,#B8860B,#E8B84B,#C8961E)}',
      '.ac-rb{display:flex;height:6px;border-radius:999px;overflow:hidden;margin-top:7px;background:rgba(127,127,127,.14);max-width:360px}.ac-rb span{display:block;height:100%}',
      '.ac-rb .r{background:linear-gradient(90deg,#B8860B,#E8B84B)}.ac-rb .w{background:repeating-linear-gradient(135deg,rgba(var(--c-accent-rgb),.5) 0 4px,rgba(var(--c-accent-rgb),.18) 4px 8px)}.ac-rb .u{background:rgba(127,127,127,.4)}.ac-rb .h{background:var(--c-risk,#c0392b);opacity:.6}',
      '.ac-rsa{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.ac-lk{all:unset;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--c-accent-text,var(--gold))}.ac-lk:hover{text-decoration:underline}.ac-lk:focus-visible{outline:2px solid var(--c-focus,var(--gold));outline-offset:2px;border-radius:4px}',
      '.g18-s.auto .g18-n{background:rgba(var(--c-accent-rgb),.16);color:var(--c-accent-text);box-shadow:inset 0 0 0 1px rgba(var(--c-accent-rgb),.45)}.g18-s.auto .g18-n svg{width:13px;height:13px}',
      '.g18-s.auto .g18-st>b small{color:var(--c-accent-text)}',
      '.ac-empty{margin:14px 0 4px;padding:12px 14px;border-radius:12px;background:rgba(127,127,127,.07);font-size:13px;color:var(--text2);line-height:1.5}.ac-empty b{color:var(--text)}',
      // Today: grouped
      '.ac-fh{display:flex;align-items:baseline;gap:10px;margin:16px 0 6px}.ac-fh h3{margin:0;font-size:15px;font-weight:650;color:var(--text)}.ac-fh small{font-size:12px;color:var(--text3)}',
      '.ac-gl{list-style:none;margin:0;padding:0;border:1px solid var(--g-line,var(--border));border-radius:16px;overflow:hidden;background:var(--g-fill,var(--surface))}',
      '.ac-g{border-top:1px solid var(--g-line,var(--border))}.ac-gl>.ac-g:first-child{border-top:0}',
      '.ac-gr{display:grid;grid-template-columns:34px minmax(0,1fr) auto 30px;gap:12px;align-items:center;padding:13px 14px}',
      '.ac-gi{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:rgba(var(--c-accent-rgb),.12);color:var(--c-accent-text,var(--gold))}',
      '.ac-gi.risk{background:rgba(196,76,60,.12);color:var(--c-risk,#c44c3c)}.ac-gi.reply{background:rgba(74,140,92,.13);color:var(--green,#3d7a4f)}.ac-gi.li{background:rgba(10,102,194,.10);color:#0a66c2}.ac-gi.quiet{background:rgba(127,127,127,.1);color:var(--text2)}',
      '.ac-gm{min-width:0}.ac-gt{font-size:14px;font-weight:650;color:var(--text);display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ac-gt i{font-style:normal;font-size:11.5px;font-weight:700;color:var(--text2);background:rgba(127,127,127,.12);border-radius:999px;padding:1px 8px}',
      '.ac-gs{font-size:12.5px;color:var(--text3);margin-top:2px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ac-ga{display:flex;align-items:center;gap:6px}',
      '.ac-x{all:unset;cursor:pointer;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:var(--text3);transition:transform .15s}.ac-x:hover{background:rgba(127,127,127,.1);color:var(--text)}.ac-x.on{transform:rotate(180deg)}.ac-x:focus-visible{outline:2px solid var(--c-focus,var(--gold));outline-offset:1px}',
      '.ac-in{padding:0 14px 6px 60px}.ac-in .g24-list .g24-row{padding:10px 0}.ac-in .g24-ic{display:none}.ac-in .g24-row{grid-template-columns:minmax(0,1fr) auto}',
      '.ac-one .g24-row{padding:13px 14px;grid-template-columns:34px minmax(0,1fr) auto;border-top:0}.ac-one .g24-ic{width:34px;height:34px;border-radius:11px}',
      '.ac-rh{display:flex;align-items:center;justify-content:space-between;gap:10px}',
      '.ac-more{all:unset;cursor:pointer;display:block;width:100%;box-sizing:border-box;text-align:center;padding:11px;font-size:13px;font-weight:600;color:var(--c-accent-text,var(--gold));border-top:1px solid var(--g-line,var(--border))}.ac-more:hover{background:rgba(var(--c-accent-rgb),.06)}.ac-more:focus-visible{outline:2px solid var(--c-focus,var(--gold));outline-offset:-2px}',
      '.ac-quiet{all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:flex;align-items:center;gap:10px;margin-top:10px;padding:10px 14px;border-radius:14px;font-size:13px;color:var(--text2)}.ac-quiet:hover{background:rgba(127,127,127,.07)}.ac-quiet b{color:var(--text);font-weight:650}.ac-quiet .ac-x{margin-left:auto;width:24px;height:24px}.ac-quiet:focus-visible{outline:2px solid var(--c-focus,var(--gold))}',
      '.ac-ql{margin:0 0 4px;padding:0 14px}',
      '.ac-clear{display:flex;gap:12px;align-items:center;padding:18px;border-radius:16px;border:1px dashed var(--g-line,var(--border));font-size:13.5px;color:var(--text2)}.ac-clear b{color:var(--text)}',
      // Today: the rail, one line each
      '.ac-rl{list-style:none;margin:6px 0 0;padding:0}.ac-rl li{border-top:1px solid var(--g-line,var(--border))}.ac-rl li:first-child{border-top:0}',
      '.ac-rr{all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:flex;align-items:center;gap:10px;padding:10px 2px;font-size:13px;color:var(--text)}.ac-rr:hover .ac-rn{text-decoration:underline}.ac-rr:focus-visible{outline:2px solid var(--c-focus,var(--gold));outline-offset:1px;border-radius:8px}',
      '.ac-rn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}',
      '.ac-dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--c-verified,#3d7a4f)}.ac-dot.do{background:var(--gold,#C8961E)}.ac-dot.risk{background:var(--c-risk,#c44c3c)}.ac-dot.demo{background:rgba(127,127,127,.45)}',
      '.ac-rc{flex:none;font-size:12px;color:var(--text3)}',
      '.ac-rli{font-size:12.5px;color:var(--text2);line-height:1.45;margin:10px 0 2px;padding:9px 11px;border-radius:11px;background:rgba(127,127,127,.06)}.ac-rli b{color:var(--text)}',
      '@media (max-width:640px){.ac-gr{grid-template-columns:34px minmax(0,1fr) 30px}.ac-gr>.ac-x{grid-column:3;grid-row:1}.ac-gr>.ac-ga,.ac-gr>span:empty{grid-column:2;grid-row:2;justify-content:flex-start;flex-wrap:wrap}.ac-gr>span:empty{display:none}.ac-one .g24-row{grid-template-columns:34px minmax(0,1fr)}.ac-in{padding:0 14px 6px 14px}.ac-rs{padding:11px 12px}.ac-rsa{width:100%}}',
      '@media (prefers-reduced-motion:reduce){.ac-x{transition:none}}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  // ══ 1. Research inside the launch plan ═════════════════════════════════
  var RS = window._aaRs = window._aaRs || {};
  function rsCached(id) { return RS[id] && RS[id].d ? RS[id].d : null; }
  function rsLoad(id, force) {
    var c = RS[id];
    if (c && c.d && !force && Date.now() - c.at < 20000) return Promise.resolve(c.d);
    if (c && c.p && !force) return c.p;
    var p = call('get_sampaign_research', { campaign_id: id }).then(function (d) { RS[id] = { at: Date.now(), d: d }; return d; }).catch(function () { return null; });
    RS[id] = Object.assign({}, c || {}, { p: p });
    return p;
  }
  function rsOn(id) { var d = rsCached(id); return !!(d && d.ok && d.on && !d.locked); }
  function rsBar(id) {
    var d = rsCached(id);
    if (!d || !d.ok) return '';
    var o = (window._sampOv || {})[id] || {}, owner = !!(o.campaign && o.campaign.is_owner);
    if (d.locked) {
      if (!d.linkedin_on) return '';
      return '<div class="ac-rs off"><span class="ac-rsi">' + IC.lock + '</span><div class="ac-rsm"><div class="ac-rst">Research first <span class="ac-k">Premium</span></div><div class="ac-rss">SAM reads each LinkedIn profile before it writes, so every note and first email opens from something true.</div></div>' +
        '<div class="ac-rsa"><button class="g-btn sp-sm" type="button" onclick="aaRequest(this)">Ask Samora to unlock</button></div></div>';
    }
    if (!d.linkedin_on) {
      return '<div class="ac-rs off"><span class="ac-rsi">' + IC.scan + '</span><div class="ac-rsm"><div class="ac-rst">Research first</div><div class="ac-rss">SAM reads each profile on LinkedIn, then writes from it. It needs the LinkedIn steps.</div></div>' +
        (owner ? '<div class="ac-rsa"><button class="g-btn sp-sm" type="button" onclick="spLiEdit(\'' + e(id) + '\',true)">Add LinkedIn</button></div>' : '') + '</div>';
    }
    var sw = '<label class="aa-sw" title="Research first"><input type="checkbox" ' + (d.on ? 'checked ' : '') + (owner ? '' : 'disabled ') + 'onchange="acRsToggle(\'' + e(id) + '\',this.checked,this)" aria-label="Research first"><i></i><span>' + (d.on ? 'On' : 'Off') + '</span></label>';
    if (!d.on) {
      return '<div class="ac-rs off"><span class="ac-rsi">' + IC.scan + '</span><div class="ac-rsm"><div class="ac-rst">Research first <span class="ac-k">Premium</span></div><div class="ac-rss">Off. SAM writes from each person’s role and company. On, it reads each profile' + (d.config && d.config.posts !== false ? ' and recent posts' : '') + ' first.</div></div><div class="ac-rsa">' + sw + '</div></div>';
    }
    var c = d.counts || {}, tot = (c.read || 0) + (c.waiting || 0) + (c.usual || 0) + (c.held || 0);
    if (!tot) {
      return '<div class="ac-rs"><span class="ac-rsi">' + IC.scan + '</span><div class="ac-rsm"><div class="ac-rst">Research first <span class="ac-k">Premium</span></div><div class="ac-rss">Nobody to read yet. SAM starts reading as soon as people with a LinkedIn profile are in this SAMpaign.</div></div><div class="ac-rsa">' + sw + '</div></div>';
    }
    var w = function (n) { return (n / tot * 100).toFixed(2) + '%'; };
    var bits = ['<b>' + (c.read || 0) + '</b> of ' + tot + ' read'];
    if (c.waiting) bits.push('<b>' + c.waiting + '</b> being read');
    if (c.usual) bits.push('<b>' + c.usual + '</b> usual text');
    if (c.held) bits.push('<b>' + c.held + '</b> held');
    var dl = c.waiting && d.next_deadline ? '. Usual text for anyone not read by ' + e(day(d.next_deadline)) : '';
    return '<div class="ac-rs"><span class="ac-rsi">' + IC.scan + '</span><div class="ac-rsm"><div class="ac-rst">Research first <span class="ac-k">Premium</span></div>' +
      '<div class="ac-rss">' + bits.join(' · ') + dl + '.</div>' +
      '<div class="ac-rb" role="img" aria-label="' + e((c.read || 0) + ' read, ' + (c.waiting || 0) + ' reading, ' + (c.usual || 0) + ' usual, ' + (c.held || 0) + ' held') + '"><span class="r" style="width:' + w(c.read || 0) + '"></span><span class="w" style="width:' + w(c.waiting || 0) + '"></span><span class="u" style="width:' + w(c.usual || 0) + '"></span><span class="h" style="width:' + w(c.held || 0) + '"></span></div></div>' +
      '<div class="ac-rsa"><button class="ac-lk" type="button" onclick="aaOpen(\'' + e(id) + '\',\'all\')">Each person</button>' + sw + '</div></div>';
  }
  window.acRsToggle = async function (id, on, el) {
    if (el) el.disabled = true;
    var d = await call('set_sampaign_research', { campaign_id: id, on: !!on });
    if (el) el.disabled = false;
    if (!d.ok) { if (el) el.checked = !on; toast(d.error || 'Could not change that.'); return; }
    RS[id] = { at: Date.now(), d: d };
    toast(on ? 'Research first is on. SAM reads each profile before it writes.' : 'Research first is off. SAM writes the usual way.');
    try { window._spLiCache && delete window._spLiCache[id]; } catch (_e) {}
    try { await _sampLoadOverview(id); } catch (_e) { try { _spGuideRender(id); } catch (_e2) {} }
    try { if (window._sampTab === 'sequence' && typeof _spRenderSeqTop === 'function') _spRenderSeqTop(id); } catch (_e) {}
  };
  window.acUsualNow = async function (id, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }
    var name = senderName();
    var r = typeof window.xWriteStart === 'function'
      ? await window.xWriteStart({ campaign_id: id, kind: 'email', launch: 1, research: 'usual_now', sender_name: name.split(' ')[0] || '', sender_full_name: name })
      : { ok: false, error: 'Refresh the page, then try again.' };
    if (btn) btn.disabled = false;
    if (!r.ok) { toast(r.error || 'SAM could not start writing.'); _spGuideRender(id); return; }
    var n = r.job && r.job.total || 0;
    toast(n ? 'SAM is writing ' + pl(n, 'email') + ' the usual way, into Review. Nothing sends until you approve.' : (r.job && r.job.note) || 'Nothing left to write.');
    setTimeout(function () { rsLoad(id, true).then(function () { _sampLoadOverview(id); }); }, 4000);
  };

  // The steps, aware of the reading.
  if (typeof window._spGuideSteps === 'function' && !window._spGuideSteps._ac) {
    var baseSteps = window._spGuideSteps;
    _spGuideSteps = window._spGuideSteps = function (id, o) {
      var st = baseSteps.apply(this, arguments);
      try {
        if (!rsOn(id)) return st;
        var d = rsCached(id), c = d.counts || {}, w1 = (o.waves || [])[0] || {}, su = o.setup || {};
        var waiting = w1.research_waiting || 0, ready = w1.ready || 0, wrote = (w1.draft || 0) + (w1.pending || 0) + (w1.sent || 0);
        var wd = (d.config && d.config.wait_days) || 2;
        st.forEach(function (s) {
          if (s.key === 'write' && waiting) {
            s.done = false;
            s.text = (wrote ? pl(wrote, 'email') + ' written. ' : '') + 'SAM is reading ' + pl(waiting, 'profile') + ' on LinkedIn first. Each first email goes into Review once that profile is read, or the usual way after ' + pl(wd, 'working day') + '.' + (ready ? ' ' + pl(ready, 'person is', 'people are') + ' ready now.' : '');
            s.acts = (ready ? [['gold', 'Write ' + pl(ready, 'email') + ' now', 'sampWriteDrafts(\'' + id + '\',1)']] : [])
              .concat([[ready ? 'ghost' : 'gold', 'Write the usual emails now', 'acUsualNow(\'' + id + '\',this)'], ['ghost', 'See each person', 'aaOpen(\'' + id + '\',\'waiting\')']]);
            s.waitRead = true;
          }
          if (s.key === 'li' && su.li_on) {
            var toGo = su.li_needs_note || 0;
            if (toGo) {
              s.auto = true; s.done = false; s.optional = true;
              s.text = 'SAM writes each note once it has read the profile, from a different detail than the email. ' + pl(toGo, 'note') + ' to go' + (c.waiting ? ', ' + c.waiting + ' still being read' : '') + '. Nothing for you to do here.';
              s.acts = [];
            }
          }
        });
      } catch (_e) {}
      return st;
    };
    window._spGuideSteps._ac = true;
  }
  // The card: the same steps, the research bar inside, a step SAM is doing
  // on its own shown as such.
  if (typeof window._spGuideRender === 'function' && !window._spGuideRender._ac) {
    var baseRender = window._spGuideRender;
    _spGuideRender = window._spGuideRender = function (id) {
      var el = document.getElementById('sampGuide_' + id); if (!el) return;
      var o = (window._sampOv || {})[id];
      if (!o || !o.ok || !o.campaign.is_owner || o.campaign.archived || o.campaign.paused_at) return baseRender.apply(this, arguments);
      var liOn = !!((o.setup || {}).li_on);
      if (!rsCached(id) && !(RS[id] && RS[id].p)) rsLoad(id).then(function () { try { _spGuideRender(id); } catch (_e) {} });
      var steps = _spGuideSteps(id, o);
      var core = steps.filter(function (s) { return !s.optional; });
      var doneN = core.filter(function (s) { return s.done; }).length;
      var nowIdx = steps.findIndex(function (s) { return !s.done && !s.optional; });
      if (nowIdx === -1 || _g18Hidden(id)) {
        baseRender.apply(this, arguments);
        return;
      }
      var bar = liOn || (rsCached(id) && rsCached(id).locked) ? rsBar(id) : '';
      var pct = Math.round(doneN / Math.max(1, core.length) * 100);
      el.innerHTML = '<section class="sp-card g18-guide"><div class="g18-gh"><div><div class="sp-lbl">Launch plan</div><div class="g18-gt">' + (doneN ? doneN + ' of ' + core.length + ' done. ' : '') + 'Next: ' + e(steps[nowIdx].title.charAt(0).toLowerCase() + steps[nowIdx].title.slice(1)) + '.</div></div>' +
        '<div class="g18-gr"><div class="g18-bar"><span style="width:' + pct + '%"></span></div><button class="g18-link" type="button" onclick="g18HideGuide(\'' + e(id) + '\', true)">Hide</button></div></div>' + bar +
        '<ol class="g18-steps">' + steps.map(function (s, i) {
          var state = s.done ? 'done' : i === nowIdx ? 'now' : s.auto ? 'auto' : s.optional ? 'opt' : 'later';
          var acts = (state === 'now' || state === 'opt' || (state === 'done' && s.acts.length) || (state === 'later' && s.key === 'li')) ? s.acts.map(function (a) {
            var gold = a[0] === 'gold' && state === 'now';
            return '<button class="g-btn sp-sm' + (gold ? ' sp-gold' : (a[0] === 'ghost' || state !== 'now') ? ' sp-ghost' : '') + '" type="button" onclick="' + a[2].replace(/"/g, '&quot;') + '">' + (gold ? SP_ICON.spark + ' ' : '') + e(a[1]) + '</button>';
          }).join('') : '';
          var num = s.done ? (s.partial ? '!' : '✓') : s.auto ? IC.spark : (i + 1);
          var tag = s.auto ? ' <small>SAM is on it</small>' : (s.optional && !s.done ? ' <small>optional</small>' : '');
          return '<li class="g18-s ' + state + (s.partial ? ' part' : '') + '"><span class="g18-n">' + num + '</span><div class="g18-st"><b>' + e(s.title) + tag + '</b><small>' + e(s.text) + '</small>' +
            (s.sig && state === 'now' ? '<div id="g18GuideSig_' + e(id) + '">' + _sigLine(1) + '</div>' : '') + '</div>' +
            (acts ? '<div class="g18-sa">' + acts + '</div>' : '') + '</li>';
        }).join('') + '</ol></section>';
      if (steps[nowIdx] && steps[nowIdx].sig && !window._sig) sigLoad(false).then(function () { var g = document.getElementById('g18GuideSig_' + id); if (g) g.innerHTML = _sigLine(1); });
    };
    window._spGuideRender._ac = true;
  }
  // The Sequence card with nobody in the SAMpaign says so, instead of an empty bar.
  if (typeof window._spLiDecorate === 'function' && !window._spLiDecorate._ac) {
    var baseLi = window._spLiDecorate;
    window._spLiDecorate = async function (id) {
      var out = await baseLi.apply(this, arguments);
      try {
        var d = rsCached(id), hero = document.getElementById('aaHero_' + id);
        if (d && d.on && hero && !hero.querySelector('.ac-empty')) {
          var c = d.counts || {};
          if (!((c.read || 0) + (c.waiting || 0) + (c.usual || 0) + (c.held || 0))) {
            hero.querySelectorAll('.aa-bar,.aa-legend,.aa-built').forEach(function (n) { n.remove(); });
            var acts = hero.querySelector('.aa-acts'); if (acts) acts.remove();
            hero.insertAdjacentHTML('beforeend', '<div class="ac-empty"><b>Nobody to read yet.</b> SAM starts reading as soon as people with a LinkedIn profile are in this SAMpaign. Find people in the People tab.</div>');
          }
        }
      } catch (_e) {}
      return out;
    };
    window._spLiDecorate._ac = true;
  }

  // ══ 3. Welcome backs: the job is for the people named ══════════════════
  if (typeof window._s1Write === 'function' && !window._s1Write._ac) {
    var baseS1 = window._s1Write;
    _s1Write = window._s1Write = function (o) {
      var b = (o && o.base) || {};
      if (o && !o.ids && Array.isArray(b.contact_ids) && b.contact_ids.length) o = Object.assign({}, o, { ids: b.contact_ids.slice() });
      return baseS1.call(this, o);
    };
    window._s1Write._ac = true;
  }

  // ══ 4. Sent again in one tap, when Gmail only asked to slow down ═══════
  async function queueAgain(cid, d) {
    var r = await call('schedule_sampaign_drafts', { campaign_id: cid, launch: d.launch, contact_ids: d.contact_ids, allow_roll: true });
    return r && r.ok ? r : { ok: false, error: (r && r.error) || 'SAM could not queue them.' };
  }
  function allSlow(d) { return d && d.ok && d.drafts > 0 && d.slow === d.drafts && Array.isArray(d.contact_ids) && d.contact_ids.length === d.drafts; }
  if (typeof window._g24SamLabel === 'function' && !window._g24SamLabel._ac) {
    var baseLabel = window._g24SamLabel;
    _g24SamLabel = window._g24SamLabel = function (x) {
      var s = (x && x.sam) || {};
      if (s.do === 'retry') return s.slow ? 'Send ' + (x.t.count > 1 ? x.t.count + ' ' : '') + 'again' : 'Send again';
      return baseLabel.apply(this, arguments);
    };
    window._g24SamLabel._ac = true;
  }
  if (typeof window.g24Handle === 'function' && !window.g24Handle._ac) {
    var baseHandle = window.g24Handle;
    g24Handle = window.g24Handle = async function (key, quiet) {
      var x = _g24Find(key);
      if (!x || !x.sam || x.sam.do !== 'retry') return baseHandle.apply(this, arguments);
      var c = x.c;
      _g24Set(key, { phase: 'working', msg: 'SAM is on it…' });
      var d = await call('retry_failed_sends', { campaign_id: c.id });
      if (!d.ok && d.needs_reconnect) { _g24Set(key, { phase: 'error', msg: d.error || 'Reconnect your mailbox first.' }); try { _spReconnectModal(c.id, null, d); } catch (_e) {} return null; }
      if (!d.ok) { _g24Set(key, { phase: 'error', msg: d.error || 'SAM could not do that.' }); return null; }
      if (!d.drafts) { _g24Set(key, { phase: 'done', msg: d.cancelled ? 'Nothing to send: they replied or bounced meanwhile.' : 'Nothing to send again.' }); return null; }
      if (allSlow(d)) {
        var q = await queueAgain(c.id, d);
        if (q.ok) {
          _g24Set(key, { phase: 'done', msg: pl(q.scheduled || d.drafts, 'email') + ' queued again' + (q.first_send ? ', from ' + when(q.first_send) : '') + '.' });
          try { tdSampLoad(true); } catch (_e) {}
          return null;
        }
      }
      var g3 = { campaign_id: c.id, campaign_name: c.name, launch: d.launch, contact_ids: d.contact_ids && d.contact_ids.length ? d.contact_ids : undefined };
      _g24Set(key, { phase: 'ready', msg: pl(d.drafts, 'email') + ' ready to go again', cta: 'Pick when they go', groups: [g3] });
      if (!quiet) g24Review([g3], key);
      return g3;
    };
    window.g24Handle._ac = true;
  }
  if (typeof window._spFailedBanner === 'function' && !window._spFailedBanner._ac) {
    var baseBanner = window._spFailedBanner;
    _spFailedBanner = window._spFailedBanner = function (id, o) {
      var t = _spFailedTotals(o);
      var c = o && o.campaign, mb = (o && o.mailbox) || {};
      if (!t.retry || t.reason !== 'slow' || !c || !c.is_owner || c.archived || mb.status === 'reconnect' || mb.status === 'none') return baseBanner.apply(this, arguments);
      return '<div class="sp-alert ok" role="status"><div><b>' + pl(t.retry, 'email') + ' did not go out' + (t.at ? ' on ' + e(_spDate(t.at)) : '') + '.</b> Gmail asked SAM to slow down. Nothing was wrong with ' + (t.retry === 1 ? 'it' : 'them') + ', and SAM now waits when this happens instead of stopping. The same ' + (t.retry === 1 ? 'email goes' : 'emails go') + ' again, spaced within your daily limit.</div>' +
        '<div class="sp-acts"><button class="g-btn sp-sm sp-gold" type="button" onclick="sampRetryFailed(\'' + e(id) + '\',' + t.launch + ')">Send ' + (t.retry === 1 ? 'it' : 'them') + ' again</button></div></div>';
    };
    window._spFailedBanner._ac = true;
  }
  if (typeof window.sampRetryFailed === 'function' && !window.sampRetryFailed._ac) {
    sampRetryFailed = window.sampRetryFailed = async function (id, launch) {
      if (window._spRetrying) return;
      window._spRetrying = true;
      try {
        var d = await call('retry_failed_sends', { campaign_id: id, launch: launch || null });
        if (!d.ok && d.needs_reconnect) { _spReconnectModal(id, launch, d); return; }
        if (!d.ok) { toast(d.error || 'Could not do that'); return; }
        var reshow = function () { if (window._sampOpenId === id) { if (window._sampTab !== 'sequence') setSampTab(id, 'sequence'); else { _spRenderSeqTop(id); loadSampaignSendQueue(id); } } };
        if (!d.drafts) {
          await _sampLoadOverview(id);
          toast(d.cancelled ? pl(d.cancelled, 'email') + ' no longer needed, cleared.' : (d.has_draft ? 'These people already have a newer draft. Schedule or delete that first.' : 'Nothing to send again.'));
          reshow(); return;
        }
        var extra = d.cancelled ? ' ' + pl(d.cancelled, 'person', 'people') + ' replied or bounced meanwhile, so theirs were cleared.' : '';
        if (allSlow(d)) {
          var q = await queueAgain(id, d);
          if (q.ok) { await _sampLoadOverview(id); window._sampLaunch = d.launch; toast(pl(q.scheduled || d.drafts, 'email') + ' queued again' + (q.first_send ? ', from ' + when(q.first_send) : '') + '. Same emails, spaced within your daily limit.' + extra); reshow(); return; }
        }
        await _sampLoadOverview(id);
        toast(pl(d.drafts, 'email') + ' ready to go again. Pick when they go out.' + extra);
        window._sampLaunch = d.launch;
        reshow();
        planSampaignDrafts(id, null, d.launch);
      } catch (err) { toast('Could not do that: ' + err.message); }
      finally { window._spRetrying = false; }
    };
    window.sampRetryFailed._ac = true;
  }

  // ══ 2. Today: one short list ══════════════════════════════════════════
  var KINDS = [
    { k: 'fix', t: 'Needs fixing', ic: 'risk', cls: 'risk' },
    { k: 'reply', t: 'Replies to answer', ic: 'reply', cls: 'reply' },
    { k: 'deal', t: 'Deals moving', ic: 'deal', cls: '', flat: true },
    { k: 'review', t: 'Ready for your review', ic: 'eye', cls: '' },
    { k: 'away', t: 'Away and back', ic: 'away', cls: '' },
    { k: 'write', t: 'Emails SAM can write', ic: 'pen', cls: '' },
    { k: 'li', t: 'LinkedIn', ic: 'li', cls: 'li' },
    { k: 'other', t: 'Also today', ic: 'dot', cls: 'quiet' }
  ];
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
  var DEMO_HIDE = false;
  function isDemo(x) { return !!(x && x.c && x.c.demo); }
  if (typeof window._g24Items === 'function' && !window._g24Items._ac) {
    var baseItems = window._g24Items;
    _g24Items = window._g24Items = function () {
      var out = baseItems.apply(this, arguments) || [];
      return DEMO_HIDE ? out.filter(function (x) { return !isDemo(x); }) : out;
    };
    window._g24Items._ac = true;
  }
  // Counts and "Let SAM take" leave demos out.
  if (typeof window._g24Counts === 'function' && !window._g24Counts._ac) {
    var baseCounts = window._g24Counts;
    _g24Counts = window._g24Counts = function () { DEMO_HIDE = true; try { return baseCounts.apply(this, arguments); } finally { DEMO_HIDE = false; } };
    window._g24Counts._ac = true;
  }
  if (typeof window.g24HandleAll === 'function' && !window.g24HandleAll._ac) {
    var baseAll = window.g24HandleAll;
    g24HandleAll = window.g24HandleAll = async function () { DEMO_HIDE = true; try { return await baseAll.apply(this, arguments); } finally { DEMO_HIDE = false; } };
    window.g24HandleAll._ac = true;
  }
  function names(list) {
    var seen = [], out = [];
    list.forEach(function (x) { if (x.c && seen.indexOf(x.c.id) === -1) { seen.push(x.c.id); out.push(x.c.name || 'a SAMpaign'); } });
    if (out.length <= 2) return out.join(' and ');
    return out.slice(0, 2).join(', ') + ' and ' + (out.length - 2) + ' more';
  }
  function busy(x) { var s = window._g24.st[x.key]; return s && ['done', 'ready', 'working'].indexOf(s.phase) !== -1; }
  function groupCta(g) {
    var can = g.items.filter(function (x) { return x.sam && !x.sam.manual && !busy(x); });
    if (g.items.length < 2 || !can.length) return '';
    var n = can.reduce(function (a, x) { return a + (x.t.count || 1); }, 0);
    var label = g.k === 'write' ? 'Let SAM write ' + n : g.k === 'review' ? 'Review ' + n : g.k === 'fix' && can.every(function (x) { return x.sam.do === 'retry' && x.sam.slow; }) ? 'Send ' + n + ' again' : g.k === 'away' ? 'Let SAM write ' + n : 'Let SAM do ' + (can.length === 1 ? 'it' : 'these');
    return '<button class="g24-btn gold sm" type="button" onclick="acGroupDo(\'' + g.k + '\')">' + IC.spark + e(label) + '</button>';
  }
  function groupHtml(g) {
    var k = g.meta;
    // One thing, or a deal (each deal is its own moment): the row itself.
    if (g.items.length === 1 || k.flat) {
      return g.items.map(function (x) { return '<li class="ac-g ac-one"><ul class="g24-list">' + _g24Row(x) + '</ul></li>'; }).join('');
    }
    var open = !!(window._g24.open['ac_' + g.k]);
    // Emails add up; mixed things (an address, late emails, a slow down) are counted as things.
    var n = g.k === 'fix' || g.k === 'other' || g.k === 'deal' ? g.items.length : g.items.reduce(function (a, x) { return a + (x.t.count || 1); }, 0);
    return '<li class="ac-g"><div class="ac-gr"><span class="ac-gi ' + k.cls + '">' + IC[k.ic] + '</span><div class="ac-gm"><div class="ac-gt">' + e(k.t) + ' <i>' + n + '</i></div><div class="ac-gs">In ' + e(names(g.items)) + '</div></div>' +
      (groupCta(g) ? '<div class="ac-ga">' + groupCta(g) + '</div>' : '<span></span>') + '<button class="ac-x' + (open ? ' on' : '') + '" type="button" aria-expanded="' + open + '" aria-label="' + (open ? 'Hide' : 'Show') + ' each one" onclick="acToggle(\'ac_' + g.k + '\')">' + IC.chev + '</button></div>' +
      (open ? '<div class="ac-in"><ul class="g24-list">' + g.items.map(_g24Row).join('') + '</ul></div>' : '') + '</li>';
  }
  window.acToggle = function (k) { window._g24.open[k] = !window._g24.open[k]; g24RenderFeed(); };
  window.acGroupDo = async function (k) {
    if (window._g24.allBusy) return;
    window._g24.allBusy = true;
    var items = _g24Items().filter(function (x) { return !isDemo(x) && (x.tone === 'do' || x.tone === 'risk') && kindOf(x) === k && x.sam && !x.sam.manual && !busy(x); });
    var groups = [], li = [];
    try {
      for (var i = 0; i < items.length; i++) { var r = await g24Handle(items[i].key, true); if (r && r.li !== undefined) li.push(r); else if (r) groups.push(r); }
    } finally { window._g24.allBusy = false; }
    try { g24RenderBrief(); g24RenderFeed(); } catch (_e) {}
    if (groups.length) g24Review(groups, null, li);
    else if (li.length) toast('SAM wrote ' + li.reduce(function (s, x) { return s + x.li; }, 0) + ' LinkedIn texts. They go out from the plugin.');
  };
  var SHOW = 4;
  if (typeof window.g24RenderFeed === 'function' && !window.g24RenderFeed._ac) {
    g24RenderFeed = window.g24RenderFeed = function () {
      var el = document.getElementById('g24Feed'); if (!el) return;
      if (typeof todayActiveSection !== 'undefined' && todayActiveSection !== 'tasks') { el.innerHTML = ''; return; }
      if (!_g24IsToday()) { el.innerHTML = ''; return; }
      if (!window._tds || !window._tds.data) { el.innerHTML = '<div class="g24-sk"><i></i><i style="width:72%"></i><i style="width:56%"></i></div>'; return; }
      var all = _g24Items();
      var demo = all.filter(isDemo), it = all.filter(function (x) { return !isDemo(x); });
      var act = it.filter(function (x) { return x.tone === 'risk' || x.tone === 'do'; });
      var calm = it.filter(function (x) { return x.tone === 'wait' || x.tone === 'done'; });
      var by = {};
      act.forEach(function (x) { var k = kindOf(x); (by[k] = by[k] || []).push(x); });
      var groups = KINDS.filter(function (k) { return by[k.k]; }).map(function (k) { return { k: k.k, meta: k, items: by[k.k] }; });
      var html = '';
      if (groups.length) {
        var more = !!window._g24.open.ac_more, shown = more ? groups : groups.slice(0, SHOW);
        html += '<div class="ac-fh"><h3>For you today</h3><small>Nothing sends until you approve</small></div><ul class="ac-gl">' + shown.map(groupHtml).join('') +
          (groups.length > SHOW ? '<li><button class="ac-more" type="button" onclick="acToggle(\'ac_more\')">' + (more ? 'Show fewer' : 'Show ' + (groups.length - SHOW) + ' more') + '</button></li>' : '') + '</ul>';
      } else {
        html += '<div class="ac-clear"><span class="g24-sam" aria-hidden="true">S</span><div><b>Nothing needs you right now.</b> SAM carries on with what is running.</div></div>';
      }
      var quiet = function (key, icon, label, list, sub) {
        if (!list.length) return '';
        var op = !!window._g24.open[key];
        var nC = []; list.forEach(function (x) { if (x.c && nC.indexOf(x.c.id) === -1) nC.push(x.c.id); });
        return '<button class="ac-quiet" type="button" aria-expanded="' + op + '" onclick="acToggle(\'' + key + '\')">' + icon + '<span><b>' + e(label) + '</b> · ' + e(sub || pl(nC.length, 'SAMpaign')) + '</span><span class="ac-x' + (op ? ' on' : '') + '">' + IC.chev + '</span></button>' +
          (op ? '<div class="ac-ql"><ul class="g24-list calm">' + list.map(_g24Row).join('') + '</ul></div>' : '');
      };
      html += quiet('calm', IC.dot, 'Running on its own', calm, pl(calm.length, 'thing'));
      html += quiet('ac_demo', IC.demo, 'Demos', demo, pl(demo.length, 'task') + ', kept apart');
      el.innerHTML = html;
    };
    window.g24RenderFeed._ac = true;
  }
  if (typeof window.g24RenderBrief === 'function' && !window.g24RenderBrief._ac) {
    var baseBrief = window.g24RenderBrief;
    g24RenderBrief = window.g24RenderBrief = function () {
      var el = document.getElementById('g24Brief'); if (!el) return;
      if (!_g24IsToday() || (!window._tds.data && !window._g24.loadedOnce)) return baseBrief.apply(this, arguments);
      var k = _g24Counts();
      var bits = [];
      if (k.replies) bits.push('<span class="g24-st">' + IC.reply + pl(k.replies, 'reply', 'replies') + '</span>');
      if (k.meet) bits.push('<span class="g24-st">' + G24_ICON.cal + pl(k.meet, 'meeting') + '</span>');
      if (k.risk) bits.push('<span class="g24-st risk">' + G24_ICON.risk + k.risk + ' to fix</span>');
      var who = typeof _g24FirstName === 'function' ? _g24FirstName() : '';
      var line = k.needs
        ? '<b>' + (who ? e(who) + ', ' : '') + pl(k.needs, 'thing', 'things') + ' for you today.</b>' + (k.sam ? ' SAM can take ' + k.sam + '.' : '')
        : '<b>' + (who ? e(who) + ', you' : 'You') + ' are clear.</b> SAM carries on with the rest.';
      el.innerHTML = '<div class="g24-bf"><span class="g24-sam" aria-hidden="true">S</span><div class="g24-bt"><div class="g24-bl">' + line + '</div>' + (bits.length ? '<div class="g24-sts">' + bits.join('') + '</div>' : '') + '</div>' +
        (k.sam ? '<button class="g24-btn gold" type="button" id="g24TakeAll" onclick="g24HandleAll()">' + G24_ICON.spark + 'Let SAM take ' + k.sam + '</button>' : '') + '</div>';
    };
    window.g24RenderBrief._ac = true;
  }

  // The rail: one line per SAMpaign, closed. The tasks are already in the list.
  // What the earlier wrappers did after drawing (Drop J: redraw Today; Drop
  // K: keep a copy for a warm start) still happens, after this drawing.
  function railAfter() {
    try { window._g24.loadedOnce = true; g24RenderAll(); } catch (_e) {}
    try { if (window._tds.data && window._tds.data.ok && typeof _g25Put === 'function') _g25Put('tds', window._tds.data); } catch (_e) {}
  }
  if (typeof window.tdSampRender === 'function' && !window.tdSampRender._ac) {
    tdSampRender = window.tdSampRender = function () { var r = railDraw(); railAfter(); return r; };
    window.tdSampRender._ac = true;
  }
  function railDraw() {
      var el = document.getElementById('todaySamp'), d = window._tds && window._tds.data;
      if (!el || !d) return;
      var cs = (d.campaigns || []).slice();
      if (!cs.length) { el.innerHTML = ''; return; }
      cs.sort(function (a, b) { return (a.demo ? 1 : 0) - (b.demo ? 1 : 0) || (b.risk - a.risk) || (b.todo - a.todo); });
      var all = !!window._tds.acAll, top = all ? cs : cs.slice(0, 5);
      var li = d.linkedin, liLine = '';
      if (li && li.plugin && !li.plugin.online) liLine = '<div class="ac-rli">LinkedIn steps go while Chrome is open. Samora in Chrome was last on <b>' + e(_spAgo(li.plugin.last_seen_at)) + '</b>.</div>';
      else if (li && li.plugin && li.plugin.version && typeof _liVerLt === 'function' && _liVerLt(li.plugin.version, LI_EXT_LATEST)) liLine = '<div class="ac-rli"><b>Update Samora in Chrome to ' + e(LI_EXT_LATEST) + '</b> so messages send on LinkedIn’s new pages.</div>';
      var rows = top.map(function (c) {
        var tone = c.demo ? 'demo' : c.risk ? 'risk' : c.todo ? 'do' : 'ok';
        var cnt = c.demo ? 'Demo' : c.risk ? c.risk + ' to fix' : c.todo ? pl(c.todo, 'task') : (c.paused ? 'Paused' : 'Running');
        return '<li><button class="ac-rr" type="button" onclick="tdsGo(\'sampaign\',\'' + e(c.id) + '\',\'overview\')"><span class="ac-dot ' + tone + '" aria-hidden="true"></span><span class="ac-rn">' + e(c.name) + '</span><span class="ac-rc">' + e(cnt) + '</span></button></li>';
      }).join('');
      el.innerHTML = '<section class="g-card tds" aria-labelledby="tdsTitle"><div class="ac-rh"><div class="sp-lbl" id="tdsTitle">Your SAMpaigns</div><button class="ac-lk" type="button" onclick="tdSampLoad(true)" aria-label="Refresh SAMpaigns">Refresh</button></div>' + liLine +
        '<ul class="ac-rl">' + rows + '</ul>' + (cs.length > 5 ? '<button class="ac-more" style="border-top:0;padding:8px" type="button" onclick="window._tds.acAll=!window._tds.acAll;tdSampRender()">' + (all ? 'Show fewer' : 'Show all ' + cs.length) + '</button>' : '') + '</section>';
  }

  window._acReady = true;
})();
