// Drop AF (18 Nov 2026): the proof SAM will use, shown before anything is
// written; a signature that names another company; a story added in a line;
// a wider people search for a company where nobody was found.
(function () {
  'use strict';
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function call(action, body) { return _sampEdge(action, body || {}); }
  function toast(m) { try { showToast(m); } catch (_e) {} }
  function pl(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function list(a, j) { a = a || []; return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' ' + (j || 'and') + ' ' + a[a.length - 1]; }
  var IC = {
    proof: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.4-3 8.3-7 10-4-1.7-7-5.6-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    pen: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>'
  };
  (function css() {
    if (document.getElementById('afCss')) return;
    var st = document.createElement('style'); st.id = 'afCss';
    st.textContent = [
      '.af-pr{margin:0 0 14px;border-radius:16px;border:1px solid var(--g-line,var(--border));background:var(--g-fill-strong,var(--surface));overflow:hidden}',
      '.af-row{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;align-items:start;padding:12px 16px;font-size:13px;line-height:1.5;color:var(--text2)}',
      '.af-row+.af-row{border-top:1px solid var(--g-line,var(--border))}',
      '.af-row>i{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;color:var(--c-accent-text,var(--gold));background:rgba(var(--c-accent-rgb),.12)}',
      '.af-row.warn>i{color:var(--c-partial,#b7791f);background:rgba(201,138,11,.14)}',
      '.af-row b{color:var(--text);font-weight:650}.af-k{display:block;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:1px}',
      '.af-chip{display:inline-flex;align-items:center;padding:1px 9px;margin:2px 4px 2px 0;border-radius:999px;font-size:12.5px;font-weight:650;color:var(--text);background:rgba(var(--c-accent-rgb),.14)}',
      '.af-chip.miss{background:transparent;border:1px dashed rgba(var(--c-accent-rgb),.55);color:var(--text2);font-weight:600}',
      '.af-lk{all:unset;cursor:pointer;font-weight:650;color:var(--c-accent-text,var(--gold))}.af-lk:hover{text-decoration:underline}.af-lk:focus-visible{outline:2px solid var(--c-focus,var(--gold));outline-offset:2px;border-radius:4px}',
      '.af-st{display:grid;gap:12px;margin-top:14px}.af-sr{padding:12px 14px;border-radius:14px;border:1px solid var(--g-line,var(--border))}',
      '.af-sr .sp-fld{margin-top:8px}.af-sr .sp-fld:first-child{margin-top:0}.af-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.af-pub{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:12.5px;color:var(--text2);cursor:pointer}.af-pub input{accent-color:#B8860B}',
      '.af-act{display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}',
      '@media (max-width:640px){.af-row{padding:11px 12px}.af-two{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  // ── What SAM will cite, under the launch plan ───────────────────────────
  var PR = window._afProof = window._afProof || {};
  async function proofLoad(cid, force) {
    var c = PR[cid];
    if (c && !force && Date.now() - c.at < 60000) return c.d;
    var d = await call('get_sampaign_proof', { campaign_id: cid }).catch(function () { return null; });
    PR[cid] = { at: Date.now(), d: d };
    return d;
  }
  function proofHtml(cid, d) {
    if (!d || !d.ok || d.demo) return '';
    var p = d.proof || {}, rows = [];
    var chips = function (ns, miss) { return (ns || []).map(function (n) { return '<span class="af-chip' + (miss && miss.indexOf(n) !== -1 ? ' miss' : '') + '">' + e(n) + '</span>'; }).join(''); };
    if (p.from === 'goal') {
      rows.push('<div class="af-row"><i>' + IC.proof + '</i><div><span class="af-k">Proof SAM will use</span>' + chips(p.names, p.missing) + ' <span>named in your goal.</span>' +
        (p.missing && p.missing.length ? '<div>SAM will name ' + e(list(p.missing)) + ' as ' + (p.missing.length === 1 ? 'a customer' : 'customers') + ' and claim no results. <button class="af-lk" type="button" onclick="afAddStory(\'' + e(cid) + '\')">Add what changed for ' + (p.missing.length === 1 ? 'them' : 'each') + '</button></div>' : '') +
        (p.skipped && p.skipped.length ? '<div>' + e(list(p.skipped)) + ' ' + (p.skipped.length === 1 ? 'is' : 'are') + ' not used in this SAMpaign.</div>' : '') + '</div></div>');
    } else if (p.from === 'stories') {
      rows.push('<div class="af-row"><i>' + IC.proof + '</i><div><span class="af-k">Proof SAM may use</span>' + chips(p.names) + ' <span>from your success stories.</span><div>To use other customers here, name them in the goal: "existing clients like A and B".</div></div></div>');
    } else {
      rows.push('<div class="af-row"><i>' + IC.proof + '</i><div><span class="af-k">Proof</span><b>No customer proof yet.</b> SAM will not name any customers. Name them in the goal, or <button class="af-lk" type="button" onclick="afAddStory(\'' + e(cid) + '\')">add a story</button>.</div></div>');
    }
    if (d.signature && d.signature.other_company) rows.push('<div class="af-row warn"><i>' + IC.pen + '</i><div><span class="af-k">Signature</span>Your emails are signed <b>' + e(d.signature.other_company) + '</b>, not ' + e(d.signature.org_name || 'your company') + '. <button class="af-lk" type="button" onclick="afEditSig(\'' + e(cid) + '\')">Edit signature</button></div></div>');
    return '<div class="af-pr" role="note" aria-label="What SAM will say about you">' + rows.join('') + '</div>';
  }
  async function proofPaint(cid, force) {
    var g = document.getElementById('sampGuide_' + cid); if (!g) return;
    var el = document.getElementById('afProof_' + cid);
    if (!el) { el = document.createElement('div'); el.id = 'afProof_' + cid; g.insertAdjacentElement('afterend', el); }
    if (!g.innerHTML.trim()) { el.innerHTML = ''; return; }
    var d = await proofLoad(cid, force);
    el.innerHTML = proofHtml(cid, d);
  }
  window.afProofRefresh = function (cid) { delete PR[cid]; return proofPaint(cid, true); };
  if (typeof window._spGuideRender === 'function' && !window._spGuideRender._af) {
    var baseGuide = window._spGuideRender;
    _spGuideRender = window._spGuideRender = function (id) { var r = baseGuide.apply(this, arguments); try { proofPaint(id); } catch (_e) {} return r; };
    window._spGuideRender._af = true;
  }

  // ── Signature ───────────────────────────────────────────────────────────
  window.afEditSig = function (cid) {
    if (typeof sigOpenEditor !== 'function') { toast('Your signature is in You, under Email signature.'); return; }
    sigOpenEditor(function () { try { window.aeCoachRefresh && window.aeCoachRefresh(); } catch (_e) {} if (cid) window.afProofRefresh(cid); });
  };

  // ── A story in a line ───────────────────────────────────────────────────
  window.afAddStory = function (cid) {
    var d = (PR[cid] || {}).d || {}, p = d.proof || {};
    var names = (p.missing && p.missing.length ? p.missing : ['']).slice(0, 4);
    var old = document.getElementById('afStory'); if (old) old.remove();
    var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'afStory';
    m.addEventListener('click', function (ev) { if (ev.target === m) m.remove(); });
    m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-labelledby="afStH"><h3 id="afStH">What changed for ' + (names[0] && names.length === 1 ? e(names[0]) : 'them') + '?</h3>' +
      '<div class="sp-small">One line each is enough. SAM cites exactly what you write and nothing more.</div><div class="af-st">' +
      names.map(function (n, i) {
        return '<div class="af-sr" data-i="' + i + '"><label class="sp-fld">Customer<input class="afN" value="' + e(n) + '" maxlength="80" placeholder="Customer name"></label>' +
          '<div class="af-two"><label class="sp-fld">What changed<input class="afH" maxlength="160" placeholder="3,000 electricians enrolled in 60 days"></label><label class="sp-fld">A number, if any<input class="afM" maxlength="40" placeholder="3,000"></label></div>' +
          '<label class="af-pub"><input type="checkbox" class="afP" checked> SAM may name them in emails</label></div>';
      }).join('') + '</div><div class="af-act"><button class="g-btn sp-sm sp-ghost" type="button" onclick="document.getElementById(\'afStory\').remove()">Cancel</button><button class="g24-btn gold sm" type="button" id="afStSave">Save</button></div></div>';
    document.body.appendChild(m);
    var first = m.querySelector(names[0] ? '.afH' : '.afN'); if (first) first.focus();
    document.getElementById('afStSave').onclick = async function () {
      var rows = Array.prototype.slice.call(m.querySelectorAll('.af-sr')).map(function (r) { return { client_name: r.querySelector('.afN').value.trim(), headline: r.querySelector('.afH').value.trim(), metric: r.querySelector('.afM').value.trim(), usable_publicly: r.querySelector('.afP').checked }; }).filter(function (x) { return x.client_name && x.headline; });
      if (!rows.length) { toast('Write what changed for at least one customer.'); return; }
      this.disabled = true; this.textContent = 'Saving…';
      var ok = 0;
      for (var i = 0; i < rows.length; i++) { var r = await call('save_success_story', Object.assign({ title: rows[i].client_name }, rows[i], { metric: rows[i].metric || null })).catch(function () { return null; }); if (r && r.ok) ok++; }
      m.remove();
      toast(ok ? pl(ok, 'story', 'stories') + ' saved. SAM will cite ' + (ok === 1 ? 'it' : 'them') + ' from the next email it writes.' : 'Could not save. Try again in a minute.');
      if (ok && cid) window.afProofRefresh(cid);
    };
  };
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { var m = document.getElementById('afStory'); if (m) m.remove(); } });

  // ── Professor SAM's new actions ─────────────────────────────────────────
  if (typeof window.aeAct === 'function' && !window.aeAct._af) {
    var baseAct = window.aeAct;
    window.aeAct = async function (id, btn) {
      var CO = window._aeCoach || {}, t = (CO.tips || {})[id];
      var a = t && t.tip && t.tip.action || {}, cid = t ? String(t.key || '').split(':')[1] : '';
      if (['open_signature', 'find_people', 'add_story'].indexOf(a.kind) === -1) return baseAct.apply(this, arguments);
      var done = true;
      if (a.kind === 'open_signature') window.afEditSig(cid);
      else if (a.kind === 'add_story') window.afAddStory(cid);
      else if (a.kind === 'find_people') {
        if (btn) { btn.disabled = true; btn.textContent = 'Searching…'; }
        var found = 0, notes = [];
        for (var i = 0; i < (a.account_ids || []).length; i++) {
          var r = await call('scout_sampaign_contacts', { campaign_id: cid, account_id: a.account_ids[i], widen: true }).catch(function () { return null; });
          var n = r && r.ok ? (r.contacts_found || r.scouted || (r.contacts || []).length || 0) : 0;
          found += n; if (!n) notes.push((a.names || [])[i] || 'one company');
        }
        if (btn) btn.disabled = false;
        done = found > 0;
        toast(found ? pl(found, 'person', 'people') + ' found' + (notes.length ? '. Still nobody at ' + list(notes) + '.' : '.') : 'Still nobody at ' + list(notes.length ? notes : a.names || []) + '. Add people by hand, or try their LinkedIn page.');
        if (found) { try { await _sampLoadOverview(cid); } catch (_e) {} }
      }
      var el = document.querySelector('.ae-pf[data-tip="' + id + '"]');
      if (done && el && el.parentNode) el.parentNode.innerHTML = '';
      if (done) { try { delete CO.cache[t.key]; } catch (_e) {} call('coach_event', { tip_id: id, event: 'acted' }).catch(function () {}); }
    };
    window.aeAct._af = true;
  }
})();
