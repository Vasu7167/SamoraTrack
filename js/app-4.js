// SamoraOS app, part 4 of 5. Loaded in order after app-3.js.
async function submitReset() {
  var btn = document.getElementById('resetBtn');
  var p1 = document.getElementById('rPass').value || '';
  var p2 = document.getElementById('rPass2').value || '';

  if (!_recoveryToken) { _showResetExpired(); return; }
  if (p1.length < PW_MIN) { _flowMsg('resetMsg', 'Use at least ' + PW_MIN + ' characters.', 'err'); document.getElementById('rPass').focus(); return; }
  if (p1 !== p2)          { _flowMsg('resetMsg', 'The two passwords do not match.', 'err'); document.getElementById('rPass2').focus(); return; }

  btn.disabled = true; btn.textContent = 'Saving…';
  _flowMsg('resetMsg', '');
  try {
    var r = await fetch(SB_URL + '/auth/v1/user', {
      method: 'PUT',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + _recoveryToken, 'Content-Type': 'application/json' },
      // They chose this password themselves, so any "change your temporary
      // password" flag from an admin-created account no longer applies.
      body: JSON.stringify({ password: p1, data: { must_change_password: false } })
    });
    var d = {}; try { d = await r.json(); } catch (_e) {}
    if (!r.ok) {
      var txt = JSON.stringify(d);
      if (r.status === 401 || r.status === 403 || /expired|invalid|jwt/i.test(txt)) { _showResetExpired(); return; }
      var why = d.msg || d.error_description || d.error || 'Could not set the password.';
      if (/same|different from the old/i.test(why)) why = 'Choose a password you have not used before.';
      else if (/weak|pwned|leaked/i.test(why)) why = 'That password is too easy to guess or has appeared in a data breach. Try a longer, unique one.';
      _flowMsg('resetMsg', why, 'err');
      btn.disabled = false; btn.textContent = 'Set password and sign in';
      return;
    }

    _flowState(['resetForm', 'resetExpired', 'resetDone'], 'resetDone');

    // A reset usually means the old password was lost OR someone else had it.
    // Ending every other session is the safe default here.
    try {
      await fetch(SB_URL + '/auth/v1/logout?scope=others', {
        method: 'POST', headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + _recoveryToken }
      });
    } catch (_e) {}

    // Adopt the recovery session so they land inside the app, already signed
    // in. Making someone type the password they just set is a pointless step.
    var ur = await fetch(SB_URL + '/auth/v1/user', { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + _recoveryToken } });
    var u = await ur.json();
    if (u && u.id) {
      currentUser = { id: u.id, email: u.email, token: _recoveryToken, refresh_token: _recoveryRefresh || null };
      localStorage.setItem('dt-user', JSON.stringify(currentUser));
      _recoveryToken = null; _recoveryRefresh = null;
      // loadProfile() only FETCHES the profile; it never opens the app. Calling
      // it alone left "Signing you in..." on screen forever. Same sequence as
      // every other sign-in path: load, then launch.
      await loadProfile();
      // loadProfile may already have moved on (removed user, or no org yet).
      var stillHere = document.getElementById('resetScreen');
      if (stillHere && !stillHere.classList.contains('active')) return;
      if (profile) { launchApp(); return; }
      showAuth();
      return;
    }
    _recoveryToken = null; _recoveryRefresh = null;
    var sub = document.getElementById('resetDoneSub'); if (sub) sub.textContent = 'Sign in with your new password.';
    setTimeout(showAuth, 1600);
  } catch (e) {
    _flowState(['resetForm', 'resetExpired', 'resetDone'], 'resetForm');
    _flowMsg('resetMsg', 'Could not reach SamoraOS. Check your connection and try again.', 'err');
    btn.disabled = false; btn.textContent = 'Set password and sign in';
  }
}


// ── First sign-in through Google or Microsoft ───────────────────────────────
// They are authenticated but have no profile, so we do not yet know which
// organisation they belong to. Password signup asks for an org code up front;
// SSO cannot, so it is asked here.
async function joinOrg(mode) {
  var msg = document.getElementById('joinMsg');
  var code = (document.getElementById('joinCode').value || '').trim().toUpperCase();
  msg.style.color = 'var(--text3)';

  if (mode === 'join' && !code) {
    msg.style.color = 'var(--coral)';
    msg.textContent = 'Enter the code your admin gave you, or create a new organisation instead.';
    return;
  }

  var btn = document.getElementById(mode === 'join' ? 'joinBtn' : 'createOrgBtn');
  btn.disabled = true;
  var was = btn.textContent; btn.textContent = 'Working…';
  try {
    // setupProfile handles both: a code joins the existing org as a rep, a
    // blank string creates a new one with this person as super_admin.
    await setupProfile(mode === 'join' ? code : '');
    _pendingSsoUser = false;
    if (typeof launchApp === 'function') launchApp();
    else window.location.reload();
  } catch (e) {
    msg.style.color = 'var(--coral)';
    // setupProfile already writes its own message for a bad code; only speak up
    // when it did not.
    if (!msg.textContent) msg.textContent = e.message || 'Could not set that up.';
    btn.disabled = false; btn.textContent = was;
  }
}

function joinOrgCancel() {
  _pendingSsoUser = false;
  doLogout();
}

// ═══════════════════════════════════════════════════════════════════════════
// TEAM & ACCESS CONSOLE (2026-10-02)
// One component, two homes: the customer's admin inside SamoraOS (their own
// org) and Samora's admin panel (any org). Same edge actions behind both, so
// the two can never disagree about who reports to whom or who sees what.
//
// It renders ONLY what org_admin_get returns: people, reporting lines, shares,
// seats and the activity log. There is deliberately nothing here about
// scoring, signals, providers or settings.
//
// mount(el, { call(action, body) -> json, orgId?: string, onChange?: fn })
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // The org's own names for roles (org_settings.role_labels, edited in Samora
  // admin) replace these defaults wherever a role is shown or picked.
  var ROLE_DEFAULT = { sdr: 'SDR', ae: 'AE', manager: 'Manager', director: 'Director', executive: 'Executive',
                     member: 'Member (old role)', admin: 'Admin (old role)', super_admin: 'Account owner' };
  function applyRoleLabels(map) {
    Object.keys(ROLE_LABEL).forEach(function (k) { delete ROLE_LABEL[k]; });
    Object.keys(ROLE_DEFAULT).forEach(function (k) { ROLE_LABEL[k] = ROLE_DEFAULT[k]; });
    if (!map || typeof map !== 'object') return;
    ['sdr', 'ae', 'manager', 'director', 'executive'].forEach(function (k) {
      var v = map[k]; if (typeof v === 'string' && v.trim()) ROLE_LABEL[k] = v.trim().slice(0, 40);
    });
    if (typeof map.member === 'string' && map.member.trim()) ROLE_LABEL.member = map.member.trim().slice(0, 40) + ' (old role)';
  }
  var ROLE_LABEL = { sdr: 'SDR', ae: 'AE', manager: 'Manager', director: 'Director', executive: 'Executive',
                     member: 'Member (old role)', admin: 'Admin (old role)', super_admin: 'Account owner' };
  var WHY_LABEL = { self: 'Themselves', org: 'Whole organisation', team: 'In their team', shared: 'Shared', shared_team: 'Shared, with team' };

  function h(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function initials(p) {
    var src = (p.name || p.email || '?').replace(/@.*/, '');
    var parts = src.split(/[\s._-]+/).filter(Boolean);
    return ((parts[0] || '?')[0] + ((parts[1] || '')[0] || '')).toUpperCase();
  }
  function who(p) { return p ? (p.name || p.email) : 'Unknown'; }
  function fmtWhen(iso) {
    try { return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }

  function Console(el, opts) {
    this.el = el;
    this.call = opts.call;
    this.orgId = opts.orgId || null;
    this.onChange = opts.onChange || function () {};
    // Host-provided tabs: an existing block of the host page shown inside the
    // console (the app's Rep Accounts list). { key, label, hostId, onShow }
    this.extraTabs = opts.extraTabs || [];
    // The Samora admin panel has its own, fuller company cards, so it turns
    // this tab off. Both edit the same ICP object and product table.
    this.showProfile = opts.showProfile !== false;
    this.profile = null;
    this.tab = 'people';
    this.data = null;
    this.query = '';
    this.accessFor = null;
    this.collapsed = {};
    var self = this;
    el.addEventListener('click', function (e) { self._click(e); });
    el.addEventListener('change', function (e) { self._change(e); });
    el.addEventListener('input', function (e) {
      if (e.target && e.target.getAttribute('data-sxa') === 'search') { self.query = e.target.value.toLowerCase(); self._renderBody(); }
    });
  }

  Console.prototype._body = function (extra) {
    var b = extra || {};
    if (this.orgId) b.org_id = this.orgId;
    return b;
  };

  Console.prototype.load = async function () {
    if (!this.data) this.el.innerHTML = '<div class="sxa"><div class="sxa-empty">Loading your team…</div></div>';
    var d;
    try { d = await this.call('org_admin_get', this._body()); } catch (e) { d = { ok: false, error: e.message }; }
    if (!d || !d.ok) {
      this.el.innerHTML = '<div class="sxa"><div class="sxa-empty sxa-err">' + h((d && d.error) || 'Could not load your team.') + '</div></div>';
      return;
    }
    this.data = d;
    applyRoleLabels(d.role_labels || (this.orgId ? null : (window._orgConfig && window._orgConfig.roleLabels)));
    if (!this.pfDirty) this.profile = null;
    this.byId = {};
    var self = this;
    d.people.forEach(function (p) { self.byId[p.user_id] = p; });
    if (!this.accessFor || !this.byId[this.accessFor]) {
      var first = d.people.filter(function (p) { return p.is_active; })[0];
      this.accessFor = first ? first.user_id : null;
    }
    this.render();
  };

  // ── shell ──────────────────────────────────────────────────────────────
  Console.prototype.render = function () {
    var d = this.data, seats = d.seats || {};
    var active = d.people.filter(function (p) { return p.is_active; }).length;
    var full = seats.limit && seats.active >= seats.limit;
    var seatTxt = seats.limit ? (seats.active + ' of ' + seats.limit + ' seats used') : (active + ' active ' + (active === 1 ? 'person' : 'people'));
    var tabs = [['people', 'People'], ['tree', 'Reporting lines'], ['access', 'Data access']];
    this.extraTabs.forEach(function (x) { tabs.push([x.key, x.label]); });
    if (this.showProfile) tabs.push(['profile', 'Company profile']);
    tabs.push(['calendar', 'Work calendar']);
    tabs.push(['currency', 'Currency']);
    tabs.push(['reveals', 'Usage']);
    tabs.push(['mailboxes', 'Mailboxes']);
    tabs.push(['log', 'Activity']);
    this._parkHosted();
    var self = this;
    this.el.innerHTML =
      '<div class="sxa">' +
        '<div class="sxa-head">' +
          '<div><div class="sxa-title">Team &amp; access</div>' +
          '<div class="sxa-sub">Who is on ' + h(d.org.name || 'your organisation') + ', who they report to, whose work they can see' + (this.showProfile ? ', and who you sell to.' : '.') + '</div></div>' +
          '<div class="sxa-head-r">' +
            '<span class="sxa-chip' + (full ? ' sxa-chip-warn' : '') + '" title="' + (seats.limit ? 'Seats on your plan' : 'No seat cap set') + '">' + h(seatTxt) + '</span>' +
            '<button class="sxa-btn sxa-btn-gold" data-sxa="add"' + (full && !d.me.is_samora ? ' disabled title="All seats are in use. Remove someone first, or ask Samora for more seats."' : '') + '>+ Add person</button>' +
          '</div>' +
        '</div>' +
        '<div class="sxa-tabs" role="tablist">' + tabs.map(function (t) {
          return '<button role="tab" class="sxa-tab' + (self.tab === t[0] ? ' on' : '') + '" data-sxa="tab" data-v="' + t[0] + '">' + t[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="sxa-body" id="sxa-body"></div>' +
      '</div>';
    this._renderBody();
  };

  // Hosted blocks are moved INTO the console while their tab is open and
  // parked in a hidden holder otherwise, so re-rendering the console never
  // destroys them (their own event handlers and state survive).
  Console.prototype._parkHosted = function () {
    var hold = document.getElementById('sxa-hold');
    if (!hold) { hold = document.createElement('div'); hold.id = 'sxa-hold'; hold.style.display = 'none'; document.body.appendChild(hold); }
    var moved = this.el.querySelectorAll('[data-sxa-hosted]');
    for (var i = 0; i < moved.length; i++) hold.appendChild(moved[i]);
    // First time round, the host's block is still where the page put it
    // (under the console). Take it out of the page so it only ever shows
    // inside its own tab.
    this.extraTabs.forEach(function (x) {
      var host = document.getElementById(x.hostId);
      if (host && host.parentNode !== hold && !host.closest('#sxa-body')) { host.setAttribute('data-sxa-hosted', '1'); hold.appendChild(host); }
    });
  };

  Console.prototype._renderBody = function () {
    var body = this.el.querySelector('#sxa-body');
    if (!body) return;
    this._parkHosted();
    var extra = this.extraTabs.filter(function (x) { return x.key === this.tab; }, this)[0];
    if (extra) {
      var host = document.getElementById(extra.hostId);
      body.innerHTML = '';
      if (host) { host.setAttribute('data-sxa-hosted', '1'); host.style.display = ''; body.appendChild(host); }
      else body.innerHTML = '<div class="sxa-empty">Not available here.</div>';
      if (extra.onShow) { try { extra.onShow(); } catch (e) {} }
      return;
    }
    if (this.tab === 'profile') { this._renderProfile(body); return; }
    if (this.tab === 'calendar') { this._renderCalendar(body); return; }
    if (this.tab === 'currency') { this._renderCurrency(body); return; }
    if (this.tab === 'reveals') { this._renderReveals(body); return; }
    if (this.tab === 'mailboxes') { this._renderMailboxes(body); return; }
    if (this.tab === 'people') body.innerHTML = this._people();
    else if (this.tab === 'tree') body.innerHTML = this._tree();
    else if (this.tab === 'access') body.innerHTML = this._access();
    else { body.innerHTML = '<div class="sxa-empty">Loading activity…</div>'; this._loadLog(); }
  };

  // The toast lives on <body>, not inside the console: every save reloads and
  // re-renders the console, which would otherwise wipe the "Saved" message the
  // moment it appeared.
  Console.prototype.toast = function (msg, bad) {
    var t = document.getElementById('sxa-toast-global');
    if (!t) { t = document.createElement('div'); t.id = 'sxa-toast-global'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'sxa-toast show' + (bad ? ' bad' : '');
    clearTimeout(this._tt);
    this._tt = setTimeout(function () { t.className = 'sxa-toast'; }, bad ? 5200 : 2400);
  };

  // ── People ─────────────────────────────────────────────────────────────
  Console.prototype._roleSelect = function (p) {
    var roles = this.data.roles.slice();
    if (roles.indexOf(p.role) === -1) roles.unshift(p.role);
    return '<select class="sxa-sel" data-sxa="role" data-id="' + p.user_id + '" aria-label="Role for ' + h(who(p)) + '">' +
      roles.map(function (r) { return '<option value="' + r + '"' + (r === p.role ? ' selected' : '') + (ROLE_LABEL[r] && /old role|owner/.test(ROLE_LABEL[r]) && r !== p.role ? ' disabled' : '') + '>' + h(ROLE_LABEL[r] || r) + '</option>'; }).join('') +
    '</select>';
  };

  // Managers offered for p: active, not p, and not anyone already under p
  // (that would be a loop; the server refuses it too).
  Console.prototype._managerOptions = function (p) {
    var under = this._under(p.user_id), self = this;
    var opts = this.data.people.filter(function (m) { return m.is_active && m.user_id !== p.user_id && !under[m.user_id]; })
      .sort(function (a, b) { return who(a).localeCompare(who(b)); });
    var current = p.manager_id && this.byId[p.manager_id];
    var html = '<option value="">No manager</option>';
    if (current && !current.is_active) html += '<option value="' + current.user_id + '" selected disabled>' + h(who(current)) + ' (removed)</option>';
    return html + opts.map(function (m) { return '<option value="' + m.user_id + '"' + (m.user_id === p.manager_id ? ' selected' : '') + '>' + h(who(m)) + ' · ' + h(ROLE_LABEL[m.role] || m.role) + '</option>'; }).join('');
  };

  Console.prototype._under = function (rootId) {
    var kids = {}, out = {};
    this.data.people.forEach(function (p) { if (p.manager_id) (kids[p.manager_id] = kids[p.manager_id] || []).push(p.user_id); });
    var q = (kids[rootId] || []).slice(), seen = {}; seen[rootId] = 1;
    while (q.length) { var id = q.shift(); if (seen[id]) continue; seen[id] = 1; out[id] = 1; (kids[id] || []).forEach(function (k) { q.push(k); }); }
    return out;
  };

  Console.prototype._people = function () {
    var q = this.query, self = this, me = this.data.me.user_id;
    var match = function (p) { return !q || (who(p) + ' ' + p.email + ' ' + (ROLE_LABEL[p.role] || p.role)).toLowerCase().indexOf(q) !== -1; };
    var act = this.data.people.filter(function (p) { return p.is_active && match(p); });
    // Old, removed logins of someone who is active again are not a separate
    // person, and several removed logins of one person are one row.
    var activeEmails = {};
    this.data.people.forEach(function (p) { if (p.is_active) activeEmails[String(p.email).toLowerCase()] = 1; });
    var goneSeen = {}, goneCount = {};
    this.data.people.forEach(function (p) { if (!p.is_active) { var k = String(p.email).toLowerCase(); goneCount[k] = (goneCount[k] || 0) + 1; } });
    var gone = this.data.people.filter(function (p) {
      var k = String(p.email).toLowerCase();
      if (p.is_active || activeEmails[k] || goneSeen[k] || !match(p)) return false;
      goneSeen[k] = 1; return true;
    });
    var row = function (p) {
      var isMe = p.user_id === me && !self.data.me.is_samora;
      var legacyAdmin = p.role === 'admin' || p.role === 'super_admin';
      var reports = Object.keys(self._under(p.user_id)).length;
      return '<div class="sxa-row">' +
        '<div class="sxa-person"><span class="sxa-av">' + h(initials(p)) + '</span><div class="sxa-pw">' +
          '<div class="sxa-pn">' + h(who(p)) + (isMe ? ' <span class="sxa-you">You</span>' : '') + '</div>' +
          '<div class="sxa-pe">' + h(p.email) + (reports ? ' · ' + reports + ' under them' : '') + '</div></div></div>' +
        '<label class="sxa-cell"><span class="sxa-lbl">Role</span>' + (isMe ? '<span class="sxa-static">' + h(ROLE_LABEL[p.role] || p.role) + '</span>' : self._roleSelect(p)) + '</label>' +
        '<label class="sxa-cell"><span class="sxa-lbl">Reports to</span><select class="sxa-sel" data-sxa="mgr" data-id="' + p.user_id + '" aria-label="Manager for ' + h(who(p)) + '">' + self._managerOptions(p) + '</select></label>' +
        '<label class="sxa-cell sxa-cell-sw" title="' + (isMe ? 'You cannot change your own admin access.' : legacyAdmin ? 'Admin by their old role. Pick a job role to manage this switch.' : 'Admins manage people, reporting lines and access. It does not change whose data they see.') + '">' +
          '<span class="sxa-lbl">Admin</span><input type="checkbox" class="sxa-sw" data-sxa="admin" data-id="' + p.user_id + '"' + (p.is_org_admin ? ' checked' : '') + (isMe || legacyAdmin ? ' disabled' : '') + '/></label>' +
        '<div class="sxa-cell sxa-cell-act">' + (isMe ? '' : '<button class="sxa-btn sxa-btn-ghost" data-sxa="remove" data-id="' + p.user_id + '">Remove</button>') + '</div>' +
      '</div>';
    };
    return '<div class="sxa-tools"><input class="sxa-in" data-sxa="search" placeholder="Find a person" value="' + h(this.query) + '"/>' +
      '<span class="sxa-note">Admin lets someone manage the team. What they can see still follows their role and reporting line.</span></div>' +
      (act.length ? '<div class="sxa-list">' + act.map(row).join('') + '</div>' : '<div class="sxa-empty">' + (q ? 'Nobody matches that.' : 'No active people yet. Add someone to get started.') + '</div>') +
      (gone.length ? '<details class="sxa-gone"><summary>Removed (' + gone.length + '). Their history stays in reports.</summary>' +
        gone.map(function (p) {
          return '<div class="sxa-row sxa-row-gone"><div class="sxa-person"><span class="sxa-av">' + h(initials(p)) + '</span><div class="sxa-pw"><div class="sxa-pn">' + h(who(p)) + '</div><div class="sxa-pe">' + h(p.email) + '</div></div></div>' +
            '<div class="sxa-cell sxa-cell-act"><button class="sxa-btn sxa-btn-ghost" data-sxa="restore" data-id="' + p.user_id + '">Restore</button></div></div>';
        }).join('') + '</details>' : '');
  };

  // ── Reporting lines ────────────────────────────────────────────────────
  Console.prototype._tree = function () {
    var people = this.data.people.filter(function (p) { return p.is_active; });
    var byId = this.byId, self = this;
    var kids = {};
    people.forEach(function (p) {
      var m = p.manager_id && byId[p.manager_id] && byId[p.manager_id].is_active ? p.manager_id : null;
      (kids[m || '_root'] = kids[m || '_root'] || []).push(p);
    });
    var rank = { executive: 0, super_admin: 0, admin: 1, director: 2, manager: 3, ae: 4, sdr: 5, member: 6 };
    var sort = function (a) { return a.sort(function (x, y) { return ((rank[x.role] || 9) - (rank[y.role] || 9)) || who(x).localeCompare(who(y)); }); };
    var count = function (id) { return Object.keys(self._under(id)).length; };
    var node = function (p, depth) {
      var ch = sort(kids[p.user_id] || []);
      var open = !self.collapsed[p.user_id];
      var orphan = p.manager_id && byId[p.manager_id] && !byId[p.manager_id].is_active;
      return '<li class="sxa-node">' +
        '<div class="sxa-card' + (orphan ? ' sxa-card-warn' : '') + '">' +
          (ch.length ? '<button class="sxa-tw" data-sxa="fold" data-id="' + p.user_id + '" aria-label="' + (open ? 'Collapse' : 'Expand') + '">' + (open ? '▾' : '▸') + '</button>' : '<span class="sxa-tw sxa-tw-x"></span>') +
          '<span class="sxa-av sxa-av-s">' + h(initials(p)) + '</span>' +
          '<div class="sxa-pw"><div class="sxa-pn">' + h(who(p)) + (p.is_org_admin ? ' <span class="sxa-badge">Admin</span>' : '') + '</div>' +
          '<div class="sxa-pe">' + h(ROLE_LABEL[p.role] || p.role) + (ch.length ? ' · ' + count(p.user_id) + ' in team' : '') + (orphan ? ' · their manager was removed' : '') + '</div></div>' +
          '<select class="sxa-sel sxa-sel-s" data-sxa="mgr" data-id="' + p.user_id + '" aria-label="Move ' + h(who(p)) + '">' + self._managerOptions(p) + '</select>' +
        '</div>' +
        (ch.length && open ? '<ul class="sxa-ul">' + ch.map(function (c) { return node(c, depth + 1); }).join('') + '</ul>' : '') +
      '</li>';
    };
    var roots = sort(kids._root || []);
    var leaders = roots.filter(function (p) { return (kids[p.user_id] || []).length || ['executive', 'director', 'manager', 'super_admin', 'admin'].indexOf(p.role) !== -1; });
    var unplaced = roots.filter(function (p) { return leaders.indexOf(p) === -1; });
    return '<div class="sxa-note sxa-note-block">Executives see everyone. Managers and Directors see everyone below them here, at any depth. Everyone else sees their own work, plus anything shared with them under Data access. Use the menu on any card to move that person.</div>' +
      (leaders.length ? '<ul class="sxa-ul sxa-ul-root">' + leaders.map(function (p) { return node(p, 0); }).join('') + '</ul>' : '') +
      (unplaced.length ? '<div class="sxa-sec">Not in a team yet (' + unplaced.length + ')</div><div class="sxa-sub sxa-sub-tight">Only Executives can see their work until they report to someone.</div>' +
        '<ul class="sxa-ul sxa-ul-root">' + unplaced.map(function (p) { return node(p, 0); }).join('') + '</ul>' : '') +
      (!people.length ? '<div class="sxa-empty">No active people yet.</div>' : '');
  };

  // ── Data access ────────────────────────────────────────────────────────
  Console.prototype._access = function () {
    var d = this.data, byId = this.byId, self = this;
    var active = d.people.filter(function (p) { return p.is_active; }).sort(function (a, b) { return who(a).localeCompare(who(b)); });
    if (!active.length) return '<div class="sxa-empty">No active people yet.</div>';
    var pid = this.accessFor;
    var acc = (d.access[pid] || { sees: {}, tier: 'self' });
    var sees = Object.keys(acc.sees).filter(function (id) { return id !== pid && byId[id] && byId[id].is_active; });
    var seesRemoved = Object.keys(acc.sees).filter(function (id) { return id !== pid && byId[id] && !byId[id].is_active; }).length;
    var seenBy = active.filter(function (v) { return v.user_id !== pid && d.access[v.user_id] && d.access[v.user_id].sees[pid]; });
    var chip = function (why) { return '<span class="sxa-why sxa-why-' + why + '">' + h(WHY_LABEL[why] || why) + '</span>'; };
    var li = function (p, why) { return '<li><span class="sxa-av sxa-av-s">' + h(initials(p)) + '</span><span class="sxa-li-n">' + h(who(p)) + (p.is_active ? '' : ' <span class="sxa-muted">(removed)</span>') + '</span>' + chip(why) + '</li>'; };
    var pick = function (attr, sel, excl) {
      return '<select class="sxa-sel" data-sxa="' + attr + '">' + active.filter(function (p) { return p.user_id !== excl; }).map(function (p) {
        return '<option value="' + p.user_id + '"' + (p.user_id === sel ? ' selected' : '') + '>' + h(who(p)) + ' · ' + h(ROLE_LABEL[p.role] || p.role) + '</option>';
      }).join('') + '</select>';
    };
    var shares = d.grants.filter(function (g) { return byId[g.viewer_user_id] && byId[g.subject_user_id]; });
    var tierLine = acc.tier === 'org' ? 'As ' + (ROLE_LABEL[byId[pid].role] || byId[pid].role) + ', sees the whole organisation.'
                 : acc.tier === 'team' ? 'Sees everyone below them in Reporting lines, plus anything shared.'
                 : 'Sees their own work, plus anything shared with them.';
    var firstOther = active.filter(function (p) { return p.user_id !== pid; })[0];
    return '<div class="sxa-acc">' +
      '<div class="sxa-acc-pick"><span class="sxa-lbl">Person</span>' + pick('acc-person', pid, null) + '<div class="sxa-note">' + h(tierLine) + '</div></div>' +
      '<div class="sxa-acc-cols">' +
        '<div class="sxa-acc-col"><div class="sxa-sec">Can see (' + sees.length + ')</div>' +
          (sees.length ? '<ul class="sxa-acc-ul">' + sees.sort(function (a, b) { return who(byId[a]).localeCompare(who(byId[b])); }).map(function (id) { return li(byId[id], acc.sees[id]); }).join('') + '</ul>' : '<div class="sxa-empty sxa-empty-s">Only their own work.</div>') +
          (seesRemoved ? '<div class="sxa-note" style="margin-top:6px">Plus the past work of ' + seesRemoved + ' removed ' + (seesRemoved === 1 ? 'login' : 'logins') + '.</div>' : '') +
        '</div>' +
        '<div class="sxa-acc-col"><div class="sxa-sec">Can be seen by (' + seenBy.length + ')</div>' +
          (seenBy.length ? '<ul class="sxa-acc-ul">' + seenBy.map(function (v) { return li(v, d.access[v.user_id].sees[pid]); }).join('') + '</ul>' : '<div class="sxa-empty sxa-empty-s">Nobody else yet.</div>') +
        '</div>' +
      '</div>' +
      '<div class="sxa-share">' +
        '<div class="sxa-sec">Share access</div>' +
        '<div class="sxa-share-row"><span>Let</span>' + pick('sh-viewer', pid, null) + '<span>also see</span>' + pick('sh-subject', firstOther ? firstOther.user_id : null, null) +
          '<label class="sxa-inl"><input type="checkbox" data-sxa="sh-team" checked/> and everyone under them</label>' +
          '<button class="sxa-btn sxa-btn-gold" data-sxa="share">Share</button></div>' +
        (shares.length ? '<ul class="sxa-acc-ul sxa-shares">' + shares.map(function (g) {
          return '<li><span class="sxa-li-n">' + h(who(byId[g.viewer_user_id])) + ' <span class="sxa-muted">sees</span> ' + h(who(byId[g.subject_user_id])) + (g.include_team ? ' <span class="sxa-muted">and their team</span>' : '') + '</span>' +
            '<button class="sxa-btn sxa-btn-ghost" data-sxa="unshare" data-v="' + g.viewer_user_id + '" data-s="' + g.subject_user_id + '">Remove</button></li>';
        }).join('') + '</ul>' : '<div class="sxa-note">No extra shares. Everyone sees what their role and reporting line give them.</div>') +
      '</div>' +
    '</div>';
  };

  // ── Activity ───────────────────────────────────────────────────────────
  Console.prototype._loadLog = async function () {
    var body = this.el.querySelector('#sxa-body');
    var d;
    try { d = await this.call('org_admin_audit', this._body()); } catch (e) { d = { ok: false, error: e.message }; }
    if (this.tab !== 'log' || !body) return;
    if (!d.ok) { body.innerHTML = '<div class="sxa-empty sxa-err">' + h(d.error || 'Could not load activity.') + '</div>'; return; }
    if (!d.entries.length) { body.innerHTML = '<div class="sxa-empty">No changes recorded yet. Every change to people, reporting lines and access will appear here.</div>'; return; }
    var said = function (e) {
      var x = e.detail || {}, t = h(e.target_email || 'someone'), parts = [];
      if (e.action === 'person_added') return 'added ' + t + ' as ' + h(ROLE_LABEL[x.role] || x.role || '') + (x.is_org_admin ? ', with admin' : '');
      if (e.action === 'person_restored') return 'restored ' + t;
      if (e.action === 'person_removed') return 'removed ' + t + (x.reports_moved_up ? ' (' + x.reports_moved_up + ' moved up to their manager)' : '');
      if (e.action === 'access_shared') return 'let ' + t + ' see ' + h(x.subject_email || '') + (x.include_team ? ' and their team' : '');
      if (e.action === 'access_removed') return 'stopped ' + t + ' seeing ' + h(x.subject_email || '');
      if (e.action === 'product_added') return 'added the product ' + h(x.product || '');
      if (e.action === 'product_updated') return 'updated the product ' + h(x.product || '');
      if (e.action === 'product_removed') return 'removed the product ' + h(x.product || '');
      if (e.action === 'icp_updated') return 'updated the ideal customer profile' + (x.fields && x.fields.indexOf('target_stakeholders') !== -1 ? ', including target designations' : '');
      if (e.action === 'test_data_removed') return 'removed test data for ' + t + (x.summary ? ': ' + h(x.summary) : '');
      if (e.action === 'accounts_exported') return 'downloaded the account list (' + (x.count || 0) + ' accounts)';
      if (e.action === 'accounts_imported') return 'uploaded accounts: ' + (x.added || 0) + ' added, ' + (x.updated || 0) + ' updated' + (x.failed ? ', ' + x.failed + ' could not be saved' : '');
      if (x.role) parts.push('role ' + h(ROLE_LABEL[x.role.from] || x.role.from || 'none') + ' to ' + h(ROLE_LABEL[x.role.to] || x.role.to));
      if (x.admin) parts.push(x.admin.to ? 'turned admin on' : 'turned admin off');
      if (x.manager) parts.push('manager ' + h(x.manager.from || 'none') + ' to ' + h(x.manager.to || 'none'));
      return 'changed ' + t + ': ' + (parts.join(', ') || 'details');
    };
    body.innerHTML = '<ul class="sxa-log">' + d.entries.map(function (e) {
      return '<li><span class="sxa-when">' + h(fmtWhen(e.created_at)) + '</span><span><b>' + h(e.actor_is_samora ? 'Samora' : (e.actor_email || 'An admin')) + '</b> ' + said(e) + '</span></li>';
    }).join('') + '</ul>';
  };

  // ── events ─────────────────────────────────────────────────────────────
  Console.prototype._click = function (e) {
    var t = e.target.closest ? e.target.closest('[data-sxa]') : null;
    if (!t || t.disabled) return;
    var a = t.getAttribute('data-sxa'), id = t.getAttribute('data-id');
    if (a === 'tab') { this.tab = t.getAttribute('data-v'); this.render(); }
    else if (a === 'fold') { this.collapsed[id] = !this.collapsed[id]; this._renderBody(); }
    else if (a === 'add') this._addModal();
    else if (a === 'remove') this._removeModal(id);
    else if (a === 'restore') this._restore(id);
    else if (a === 'share') this._share();
    else if (a === 'unshare') this._unshare(t.getAttribute('data-v'), t.getAttribute('data-s'));
    else if (a === 'chip-x') this._chipRemove(t);
    else if (a === 'pf-save') this._saveProfile();
    else if (a === 'pf-score') this._scoreAccounts(t);
    else if (a === 'prod-add') this._productModal(null);
    else if (a === 'prod-edit') this._productModal(t.getAttribute('data-id'));
    else if (a === 'prod-del') this._productRemove(t.getAttribute('data-id'));
    else if (a.indexOf('cal-') === 0) this._calClick(a, t);
    else if (a === 'mb-refresh') this._renderMailboxes(this.el.querySelector('#sxa-body'), true);
    else if (a === 'mb-scan') this._mbScan(t);
    else if (a === 'cur-save') this._saveCurrency(t);
    else if (a === 'rev-save') this._saveReveals(t);
    else if (a.indexOf('use-') === 0) this._g19Act(a, t);
  };

  Console.prototype._change = function (e) {
    var t = e.target, a = t.getAttribute && t.getAttribute('data-sxa'), id = t.getAttribute && t.getAttribute('data-id');
    if (a === 'role') this._update(id, { role: t.value }, t);
    else if (a === 'mgr') this._update(id, { manager_id: t.value || null }, t);
    else if (a === 'admin') this._update(id, { is_org_admin: !!t.checked }, t);
    else if (a === 'acc-person') { this.accessFor = t.value; this._renderBody(); }
  };

  Console.prototype._update = async function (id, change, ctrl) {
    if (ctrl) ctrl.disabled = true;
    var d;
    try { d = await this.call('org_update_member', this._body(Object.assign({ user_id: id }, change))); } catch (e) { d = { ok: false, error: e.message }; }
    if (!d || !d.ok) { this.toast((d && d.error) || 'Could not save.', true); await this.load(); return; }
    this.toast('Saved');
    await this.load();
    this.onChange();
  };

  Console.prototype._share = async function () {
    var v = this.el.querySelector('[data-sxa="sh-viewer"]'), s = this.el.querySelector('[data-sxa="sh-subject"]'), tm = this.el.querySelector('[data-sxa="sh-team"]');
    if (!v || !s) return;
    if (v.value === s.value) { this.toast('Everyone already sees their own work. Pick two different people.', true); return; }
    var d;
    try { d = await this.call('org_admin_set_access', this._body({ viewer_user_id: v.value, subject_user_id: s.value, include_team: !!(tm && tm.checked) })); } catch (e) { d = { ok: false, error: e.message }; }
    if (!d.ok) { this.toast(d.error || 'Could not share.', true); return; }
    this.accessFor = v.value;
    this.toast('Shared');
    await this.load();
  };

  Console.prototype._unshare = async function (viewer, subject) {
    var d;
    try { d = await this.call('org_admin_set_access', this._body({ viewer_user_id: viewer, subject_user_id: subject, remove: true })); } catch (e) { d = { ok: false, error: e.message }; }
    if (!d.ok) { this.toast(d.error || 'Could not remove.', true); return; }
    this.toast('Share removed');
    await this.load();
  };

  Console.prototype._restore = async function (id) {
    var d;
    try { d = await this.call('admin_reactivate_user', { org_id: this.data.org.id, user_id: id }); } catch (e) { d = { ok: false, error: e.message }; }
    if (!d.ok) { this.toast(d.error || 'Could not restore.', true); return; }
    this.toast('Restored. Their sign-in works again.');
    await this.load();
    this.onChange();
  };


  // ── Company profile: ICP + products ────────────────────────────────────
  // Same object the Samora admin edits (org_settings.icp_definition) and the
  // same product table, so whatever is saved here is what Samora sees.
  var PF_LISTS = [
    ['target_stakeholders', 'Designations you target', 'Who you sell to. Samora finds and ranks these people first when scouting contacts.', 'e.g. VP Sales, Head of Trade Marketing, CMO'],
    ['target_industries', 'Industries', '', 'e.g. FMCG, Consumer Durables, Pharma'],
    ['target_geographies', 'Geographies', '', 'e.g. India, Middle East'],
    ['keywords', 'Keywords', 'Words that signal a good fit when they show up in an account or a conversation.', 'e.g. loyalty, counterfeit, retail execution']
  ];

  Console.prototype._renderProfile = async function (body) {
    var self = this;
    if (!this.profile) {
      body.innerHTML = '<div class="sxa-empty">Loading your company profile…</div>';
      var d;
      try { d = await this.call('org_admin_profile_get', this._body()); } catch (e) { d = { ok: false, error: e.message }; }
      if (this.tab !== 'profile') return;
      if (!d || !d.ok) { body.innerHTML = '<div class="sxa-empty sxa-err">' + h((d && d.error) || 'Could not load the profile.') + '</div>'; return; }
      this.profile = { icp: d.icp, products: d.products };
      this.pfDirty = false;
    }
    var icp = this.profile.icp, prods = this.profile.products;
    var chips = function (key) {
      return (icp[key] || []).map(function (v, i) { return '<span class="sxa-chipv">' + h(v) + '<button data-sxa="chip-x" data-k="' + key + '" data-i="' + i + '" aria-label="Remove ' + h(v) + '">×</button></span>'; }).join('');
    };
    body.innerHTML =
      '<div class="sxa-pf">' +
        '<div class="sxa-sec" style="margin-top:4px">Ideal customer profile</div>' +
        '<div class="sxa-note">Samora uses this to rank accounts and to decide whose details to find. The Samora team sees exactly what you save here.</div>' +
        PF_LISTS.map(function (f) {
          return '<div class="sxa-f"><span class="sxa-lbl">' + h(f[1]) + '</span>' +
            '<div class="sxa-chips" data-k="' + f[0] + '">' + chips(f[0]) +
            '<input class="sxa-chip-in" data-pf-list="' + f[0] + '" placeholder="' + h((icp[f[0]] || []).length ? 'Add another, press Enter' : f[3]) + '"/></div>' +
            (f[2] ? '<div class="sxa-note">' + h(f[2]) + '</div>' : '') + '</div>';
        }).join('') +
        '<div class="sxa-f2">' +
          '<label class="sxa-f"><span class="sxa-lbl">Company size</span><input class="sxa-in" data-pf="target_company_size" value="' + h(icp.target_company_size) + '" placeholder="e.g. 500 to 50,000 employees"/></label>' +
          '<label class="sxa-f"><span class="sxa-lbl">Typical deal size (USD)</span><input class="sxa-in" data-pf="ideal_deal_size_usd" type="number" min="0" value="' + (icp.ideal_deal_size_usd == null ? '' : h(icp.ideal_deal_size_usd)) + '" placeholder="e.g. 50000"/></label>' +
        '</div>' +
        '<label class="sxa-f"><span class="sxa-lbl">The problem you solve for them</span><textarea class="sxa-in" data-pf="ideal_use_case" rows="3" placeholder="e.g. Brand protection and loyalty for consumer brands selling through distributors">' + h(icp.ideal_use_case) + '</textarea></label>' +
        '<div class="sxa-actions" style="justify-content:flex-start">' +
          '<button class="sxa-btn sxa-btn-gold" data-sxa="pf-save"' + (this.pfDirty ? '' : ' disabled') + '>' + (this.pfDirty ? 'Save profile' : 'Saved') + '</button>' +
          '<button class="sxa-btn sxa-btn-ghost" data-sxa="pf-score" title="Re-scores every account against this profile">Score accounts against this profile</button>' +
        '</div>' +
        '<div class="sxa-sec" style="display:flex;justify-content:space-between;align-items:center"><span>Products (' + prods.length + ')</span><button class="sxa-btn sxa-btn-ghost" data-sxa="prod-add">+ Add product</button></div>' +
        '<div class="sxa-note">What you sell. Samora maps conversations to these and drafts outreach around them, so add, rename or retire products as your offer changes.</div>' +
        (prods.length ? '<div class="sxa-list" style="margin-top:8px">' + prods.map(function (p) {
          return '<div class="sxa-prod"><div class="sxa-pw" style="flex:1"><div class="sxa-pn">' + h(p.name) + (p.category ? ' <span class="sxa-muted">· ' + h(p.category) + '</span>' : '') + '</div>' +
            (p.description ? '<div class="sxa-pe sxa-wrap">' + h(p.description) + '</div>' : '') +
            (p.keywords && p.keywords.length ? '<div class="sxa-kw">' + p.keywords.map(function (k) { return '<span>' + h(k) + '</span>'; }).join('') + '</div>' : '') + '</div>' +
            '<div class="sxa-prod-act"><button class="sxa-btn sxa-btn-ghost" data-sxa="prod-edit" data-id="' + p.id + '">Edit</button><button class="sxa-btn sxa-btn-ghost" data-sxa="prod-del" data-id="' + p.id + '">Remove</button></div></div>';
        }).join('') + '</div>' : '<div class="sxa-empty sxa-empty-s">No products yet. Add what you sell so Samora can match conversations to it.</div>') +
      '</div>';
    // inputs
    var mark = function () { self.pfDirty = true; var b = body.querySelector('[data-sxa="pf-save"]'); if (b) { b.disabled = false; b.textContent = 'Save profile'; } };
    body.querySelectorAll('[data-pf]').forEach(function (el) {
      el.addEventListener('input', function () {
        var k = el.getAttribute('data-pf');
        self.profile.icp[k] = k === 'ideal_deal_size_usd' ? (el.value === '' ? null : Number(el.value)) : el.value;
        mark();
      });
    });
    body.querySelectorAll('[data-pf-list]').forEach(function (el) {
      var commit = function () {
        var k = el.getAttribute('data-pf-list'), parts = el.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        if (!parts.length) return false;
        var list = self.profile.icp[k] = self.profile.icp[k] || [];
        parts.forEach(function (v) { if (!list.some(function (x) { return x.toLowerCase() === v.toLowerCase(); })) list.push(v); });
        el.value = ''; mark(); return true;
      };
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (commit()) { var k = el.getAttribute('data-pf-list'); self._renderProfile(body).then(function () { var n = body.querySelector('[data-pf-list="' + k + '"]'); if (n) n.focus(); }); } }
        else if (e.key === 'Backspace' && !el.value) { var k2 = el.getAttribute('data-pf-list'); if ((self.profile.icp[k2] || []).length) { self.profile.icp[k2].pop(); mark(); self._renderProfile(body).then(function () { var n = body.querySelector('[data-pf-list="' + k2 + '"]'); if (n) n.focus(); }); } }
      });
      // Deferred, so a click on Save that caused this blur still lands.
      el.addEventListener('blur', function () { if (commit()) setTimeout(function () { if (self.tab === 'profile') self._renderProfile(body); }, 180); });
    });
  };

  // ── Work calendar (2026-10-04) ─────────────────────────────────────────
  // Working days, hours, time zone, the morning digest hour and holidays.
  // Samora sends no notifications on days off and holidays, and outreach
  // waits for the next working day.
  var CAL_DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
  var CAL_TZ = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Singapore', 'Asia/Jakarta', 'Asia/Tokyo', 'Australia/Sydney', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Africa/Johannesburg', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Sao_Paulo', 'UTC'];
  function calHour(n) { n = Number(n); if (n === 0 || n === 24) return '12 am'; if (n === 12) return '12 pm'; return n < 12 ? n + ' am' : (n - 12) + ' pm'; }
  function calDateLabel(iso) {
    try { return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); } catch (e) { return iso; }
  }
  function calParseDate(s) {
    s = String(s || '').trim().replace(/^["']|["']$/g, '');
    var m, pad = function (x) { return String(x).padStart(2, '0'); };
    var ok = function (y, mo, d) { var iso = y + '-' + pad(mo) + '-' + pad(d); var t = Date.parse(iso + 'T12:00:00Z'); return isNaN(t) || new Date(t).toISOString().slice(0, 10) !== iso ? null : iso; };
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/))) return ok(m[1], m[2], m[3]);
    // Day first, the way Indian and European lists are written.
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/))) return ok(m[3], m[2], m[1]);
    var t = Date.parse(s + ' 12:00 UTC');
    return isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
  }
  // "date, name" per line; a header row or blank lines are skipped.
  function calParseList(text) {
    var out = [], bad = 0, first = true;
    String(text || '').split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var isFirst = first; first = false;
      var cells = line.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(function (c) { return c.trim().replace(/^"|"$/g, ''); });
      var date = null, name = '';
      for (var i = 0; i < cells.length; i++) { var d = calParseDate(cells[i]); if (d) { date = d; name = cells.filter(function (_, j) { return j !== i; }).join(' ').trim(); break; } }
      if (date) out.push({ date: date, name: name.slice(0, 80) });
      else if (!(isFirst && /date|holiday|name|day/i.test(line))) bad++;
    });
    return { rows: out, bad: bad };
  }

  Console.prototype._renderCalendar = async function (body) {
    var self = this;
    if (!this.cal) {
      body.innerHTML = '<div class="sxa-empty">Loading your work calendar…</div>';
      var d;
      try { d = await this.call('org_admin_calendar_get', this._body()); } catch (e) { d = { ok: false, error: e.message }; }
      if (this.tab !== 'calendar') return;
      if (!d || !d.ok) { body.innerHTML = '<div class="sxa-empty sxa-err">' + h((d && d.error) || 'Could not load the calendar.') + '</div>'; return; }
      this.cal = d.calendar; this.calDirty = false;
    }
    var c = this.cal;
    var today = new Date().toISOString().slice(0, 10);
    var upcoming = c.holidays.filter(function (x) { return x.date >= today; });
    var past = c.holidays.length - upcoming.length;
    var tzs = CAL_TZ.indexOf(c.timezone) === -1 ? [c.timezone].concat(CAL_TZ) : CAL_TZ;
    var hours = function (from, to, sel) { var o = ''; for (var i = from; i <= to; i++) o += '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + calHour(i) + '</option>'; return o; };
    body.innerHTML =
      '<div class="sxa-pf">' +
        '<div class="sxa-sec" style="margin-top:4px">Working days</div>' +
        '<div class="sxa-note">Samora sends nothing on days off and holidays. SAMpaign emails and LinkedIn steps wait for the next working day.</div>' +
        '<div class="sxa-cal-days" role="group" aria-label="Working days">' + CAL_DAYS.map(function (x) {
          var on = c.work_days.indexOf(x[0]) !== -1;
          return '<button type="button" class="sxa-cal-day' + (on ? ' on' : '') + '" data-sxa="cal-day" data-v="' + x[0] + '" aria-pressed="' + on + '">' + x[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="sxa-f2">' +
          '<label class="sxa-f"><span class="sxa-lbl">Time zone</span><select class="sxa-in" data-cal="timezone">' + tzs.map(function (z) { return '<option' + (z === c.timezone ? ' selected' : '') + '>' + h(z) + '</option>'; }).join('') + '</select></label>' +
          '<label class="sxa-f"><span class="sxa-lbl">Morning digest at</span><select class="sxa-in" data-cal="digest_hour">' + hours(c.start_hour, c.end_hour - 1, c.digest_hour) + '</select></label>' +
        '</div>' +
        '<div class="sxa-f2">' +
          '<label class="sxa-f"><span class="sxa-lbl">Day starts</span><select class="sxa-in" data-cal="start_hour">' + hours(0, 23, c.start_hour) + '</select></label>' +
          '<label class="sxa-f"><span class="sxa-lbl">Day ends</span><select class="sxa-in" data-cal="end_hour">' + hours(1, 24, c.end_hour) + '</select></label>' +
        '</div>' +
        '<div class="sxa-sec" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span>Holidays (' + upcoming.length + ' coming up)</span>' +
          '<span style="display:flex;gap:6px;flex-wrap:wrap"><button class="sxa-btn sxa-btn-ghost" data-sxa="cal-upload">Upload a list</button><input type="file" accept=".csv,.txt,text/csv,text/plain" data-sxa-file="cal" hidden/></span></div>' +
        '<div class="sxa-note">Beyond the weekly days off. Upload a CSV or text file with a date and a name on each line, for example <b>26/01/2027, Republic Day</b>.</div>' +
        '<div class="sxa-cal-add">' +
          '<input class="sxa-in" type="date" data-cal-new="date" aria-label="Holiday date"/>' +
          '<input class="sxa-in" data-cal-new="name" placeholder="Name, e.g. Diwali" aria-label="Holiday name"/>' +
          '<button class="sxa-btn sxa-btn-ghost" data-sxa="cal-add">Add</button>' +
        '</div>' +
        (upcoming.length ? '<div class="sxa-list sxa-cal-list">' + upcoming.map(function (x) {
          return '<div class="sxa-cal-row"><span class="sxa-cal-date">' + h(calDateLabel(x.date)) + '</span><span class="sxa-cal-name">' + h(x.name || 'Holiday') + '</span>' +
            '<button class="sxa-btn sxa-btn-ghost" data-sxa="cal-del" data-v="' + h(x.date) + '" aria-label="Remove ' + h(x.name || x.date) + '">Remove</button></div>';
        }).join('') + '</div>' : '<div class="sxa-empty sxa-empty-s">No holidays added yet.</div>') +
        (past ? '<div class="sxa-note">' + past + ' past ' + (past === 1 ? 'holiday is' : 'holidays are') + ' kept for the record.</div>' : '') +
        '<div class="sxa-actions" style="justify-content:flex-start">' +
          '<button class="sxa-btn sxa-btn-gold" data-sxa="cal-save"' + (this.calDirty ? '' : ' disabled') + '>' + (this.calDirty ? 'Save calendar' : 'Saved') + '</button>' +
        '</div>' +
      '</div>';
    var mark = function () { self.calDirty = true; var b = body.querySelector('[data-sxa="cal-save"]'); if (b) { b.disabled = false; b.textContent = 'Save calendar'; } };
    body.querySelectorAll('[data-cal]').forEach(function (el) {
      el.addEventListener('change', function () {
        var k = el.getAttribute('data-cal');
        c[k] = k === 'timezone' ? el.value : parseInt(el.value, 10);
        if (k === 'start_hour' || k === 'end_hour') {
          if (c.end_hour <= c.start_hour) c.end_hour = Math.min(24, c.start_hour + 1);
          if (c.digest_hour < c.start_hour || c.digest_hour >= c.end_hour) c.digest_hour = c.start_hour;
          mark(); self._renderCalendar(body); return;
        }
        mark();
      });
    });
    var file = body.querySelector('[data-sxa-file="cal"]');
    if (file) file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var res = calParseList(rd.result);
        if (!res.rows.length) { self.toast('No dates found in that file. Use one holiday per line: date, name.', true); return; }
        var have = {}; c.holidays.forEach(function (x) { have[x.date] = x; });
        var added = 0;
        res.rows.forEach(function (x) { if (!have[x.date]) { c.holidays.push(x); have[x.date] = x; added++; } else if (x.name && !have[x.date].name) have[x.date].name = x.name; });
        c.holidays.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
        mark(); self._renderCalendar(body);
        self.toast(added + (added === 1 ? ' holiday' : ' holidays') + ' added' + (res.bad ? ', ' + res.bad + (res.bad === 1 ? ' line' : ' lines') + ' skipped' : '') + '. Save to keep them.');
      };
      rd.readAsText(f);
    });
  };

  Console.prototype._calClick = function (a, t) {
    var c = this.cal, body = this.el.querySelector('#sxa-body');
    if (!c) return;
    if (a === 'cal-day') {
      var v = parseInt(t.getAttribute('data-v'), 10), i = c.work_days.indexOf(v);
      if (i === -1) c.work_days.push(v); else if (c.work_days.length > 1) c.work_days.splice(i, 1); else { this.toast('Keep at least one working day.', true); return; }
      c.work_days.sort(); this.calDirty = true; this._renderCalendar(body);
    } else if (a === 'cal-add') {
      var dEl = body.querySelector('[data-cal-new="date"]'), nEl = body.querySelector('[data-cal-new="name"]');
      var d = calParseDate(dEl && dEl.value);
      if (!d) { this.toast('Pick a date first.', true); return; }
      var ex = c.holidays.filter(function (x) { return x.date === d; })[0];
      if (ex) { if (nEl && nEl.value.trim()) ex.name = nEl.value.trim().slice(0, 80); }
      else c.holidays.push({ date: d, name: (nEl && nEl.value.trim().slice(0, 80)) || '' });
      c.holidays.sort(function (x, y) { return x.date < y.date ? -1 : 1; });
      this.calDirty = true; this._renderCalendar(body);
    } else if (a === 'cal-del') {
      var dd = t.getAttribute('data-v');
      c.holidays = c.holidays.filter(function (x) { return x.date !== dd; });
      this.calDirty = true; this._renderCalendar(body);
    } else if (a === 'cal-upload') {
      var f = body.querySelector('[data-sxa-file="cal"]'); if (f) f.click();
    } else if (a === 'cal-save') {
      this._saveCalendar(t);
    }
  };

  // ── Currency (2026-10-07) ──────────────────────────────────────────────
  // The currency every amount in SamoraOS is shown in. Deals are stored in
  // US dollars as well, so this changes how they read, never their value.
  var CUR_NAMES = { INR: 'Indian rupee', USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', AED: 'UAE dirham', SAR: 'Saudi riyal', QAR: 'Qatari riyal', KWD: 'Kuwaiti dinar', BHD: 'Bahraini dinar', OMR: 'Omani rial',
    SGD: 'Singapore dollar', AUD: 'Australian dollar', NZD: 'New Zealand dollar', CAD: 'Canadian dollar', JPY: 'Japanese yen', CNY: 'Chinese yuan', HKD: 'Hong Kong dollar', IDR: 'Indonesian rupiah', MYR: 'Malaysian ringgit',
    THB: 'Thai baht', PHP: 'Philippine peso', VND: 'Vietnamese dong', BDT: 'Bangladeshi taka', LKR: 'Sri Lankan rupee', NPR: 'Nepalese rupee', PKR: 'Pakistani rupee', ZAR: 'South African rand', KES: 'Kenyan shilling',
    NGN: 'Nigerian naira', EGP: 'Egyptian pound', CHF: 'Swiss franc', SEK: 'Swedish krona', NOK: 'Norwegian krone', DKK: 'Danish krone', BRL: 'Brazilian real', MXN: 'Mexican peso' };
  Console.prototype._renderCurrency = async function (body) {
    var self = this;
    if (!this.cur) {
      body.innerHTML = '<div class="sxa-empty">Loading your currency…</div>';
      var d;
      try { d = await this.call('org_admin_currency_get', this._body()); } catch (e) { d = { ok: false, error: e.message }; }
      if (this.tab !== 'currency') return;
      if (!d || !d.ok) { body.innerHTML = '<div class="sxa-empty sxa-err">' + h((d && d.error) || 'Could not load the currency.') + '</div>'; return; }
      this.cur = d;
    }
    var c = this.cur;
    body.innerHTML =
      '<div class="sxa-pf">' +
        '<div class="sxa-sec" style="margin-top:4px">Currency</div>' +
        '<div class="sxa-note">Every amount in SamoraOS is shown in this currency: deal values, pipeline, the morning digest and SAM. Deals keep their value; only how they read changes.</div>' +
        '<label class="sxa-f" style="max-width:420px"><span class="sxa-lbl">Show amounts in</span><select class="sxa-in" data-sxa="cur-pick" id="sxaCurPick">' +
          (c.currencies || []).map(function (k) { return '<option value="' + k + '"' + (k === c.currency ? ' selected' : '') + '>' + k + ' · ' + h(CUR_NAMES[k] || k) + '</option>'; }).join('') +
        '</select></label>' +
        '<div class="sxa-note">Now: <b>' + h(c.currency) + '</b>' + (c.currency !== 'USD' && c.usd_rate ? ', 1 US dollar = ' + h(String(Math.round(c.usd_rate * 100) / 100)) + ' ' + h(c.currency) + '. A deal of 100,000 US dollars reads ' + h(c.example || '') + '.' : '.') + ' Rates update daily.</div>' +
        '<div class="sxa-actions" style="justify-content:flex-start"><button class="sxa-btn sxa-btn-gold" data-sxa="cur-save">Save currency</button></div>' +
      '</div>';
  };
  Console.prototype._saveCurrency = async function (btn) {
    var pick = this.el.querySelector('#sxaCurPick'); if (!pick) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var d;
    try { d = await this.call('org_admin_currency_save', this._body({ currency: pick.value })); } catch (e) { d = { ok: false, error: e.message }; }
    if (!d || !d.ok) { this.toast((d && d.error) || 'Could not save.', true); if (btn) { btn.disabled = false; btn.textContent = 'Save currency'; } return; }
    this.cur = Object.assign({}, this.cur, d);
    // This org's own app re-reads money at once.
    try { var mine = !this.orgId || (typeof profile !== 'undefined' && profile && String(profile.org_id) === String(this.orgId)); if (mine) { window._orgConfig = window._orgConfig || {}; window._orgConfig.defaultCurrency = d.currency; window._orgConfig.usdRate = d.usd_rate; } } catch (e) {}
    try { if (typeof scInvalidate === 'function') scInvalidate(); } catch (e) {}
    this.toast('Amounts now show in ' + d.currency);
    this._renderCurrency(this.el.querySelector('#sxa-body'));
  };

  // ── Contact reveals (2026-10-08) ───────────────────────────────────────
  // Each rep's daily limit for revealing a phone and email from the LinkedIn
  // panel, and this month's reveals by person. A reveal is saved for the
  // whole org, so the same person is never paid for twice.
  Console.prototype._renderReveals = async function (body) {
    if (!this.rev) {
      body.innerHTML = '<div class="sxa-empty">Loading…</div>';
      var d;
      try { d = await this.call('org_admin_reveals_get', this._body()); } catch (e) { d = { ok: false, error: e.message }; }
      if (this.tab !== 'reveals') return;
      if (!d || !d.ok) { body.innerHTML = '<div class="sxa-empty sxa-err">' + h((d && d.error) || 'Could not load.') + '</div>'; return; }
      this.rev = d;
    }
    var r = this.rev;
    var rows = (r.month || []).map(function (m) { return '<tr><td>' + h(m.name) + '</td><td style="text-align:right">' + m.paid + '</td><td style="text-align:right">' + m.free + '</td><td style="text-align:right">' + m.found + '</td></tr>'; }).join('');
    body.innerHTML =
      '<div class="sxa-pf">' +
        '<div class="sxa-sec" style="margin-top:4px">Contact reveals</div>' +
        '<div class="sxa-note">Reps reveal a person’s phone and email with one click in Samora for LinkedIn. Samora checks its own records first, then Lusha and Apollo. A reveal is saved for the whole team, so nobody pays for the same person twice.</div>' +
        '<label class="sxa-f" style="max-width:260px"><span class="sxa-lbl">Reveals per rep per day</span><input class="sxa-in" type="number" min="0" max="1000" id="sxaRevCap" value="' + h(String(r.cap)) + '"></label>' +
        '<div class="sxa-note">0 switches reveals off. Each paid reveal usually uses one Lusha or Apollo credit.</div>' +
        '<div class="sxa-actions" style="justify-content:flex-start"><button class="sxa-btn sxa-btn-gold" data-sxa="rev-save">Save limit</button></div>' +
        '<div class="sxa-sec">This month</div>' +
        (rows ? '<table class="sxa-tbl" style="width:100%;max-width:560px"><thead><tr><th style="text-align:left">Person</th><th style="text-align:right">Paid</th><th style="text-align:right">Free</th><th style="text-align:right">With a phone</th></tr></thead><tbody>' + rows + '</tbody></table><div class="sxa-note">' + r.total_paid + (r.total_paid === 1 ? ' paid reveal, ' : ' paid reveals, ') + r.total_found + ' with a phone number.</div>' : '<div class="sxa-note">No reveals yet this month.</div>') +
      '</div>';
  };
  Console.prototype._saveReveals = async function (btn) {
    var inp = this.el.querySelector('#sxaRevCap'); if (!inp) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var d;
    try { d = await this.call('org_admin_reveals_save', this._body({ cap: inp.value })); } catch (e) { d = { ok: false, error: e.message }; }
    if (!d || !d.ok) { this.toast((d && d.error) || 'Could not save.', true); if (btn) { btn.disabled = false; btn.textContent = 'Save limit'; } return; }
    this.rev = d;
    this.toast(d.cap ? 'Each rep can reveal ' + d.cap + ' a day' : 'Reveals are off');
    this._renderReveals(this.el.querySelector('#sxa-body'));
  };

  Console.prototype._saveCalendar = async function (btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var d;
    try { d = await this.call('org_admin_calendar_save', this._body({ calendar: this.cal })); } catch (e) { d = { ok: false, error: e.message }; }
    if (!d || !d.ok) { this.toast((d && d.error) || 'Could not save.', true); if (btn) { btn.disabled = false; btn.textContent = 'Save calendar'; } return; }
    this.cal = d.calendar; this.calDirty = false;
    this.toast('Calendar saved');
    this._renderCalendar(this.el.querySelector('#sxa-body'));
  };

  // ── Mailboxes (2026-10-05) ─────────────────────────────────────────────
  // Whose mailbox SAM can check, when it last did, and what it found. Every
  // connected mailbox credits every account in the org, so one person's
  // missing mailbox is why a whole set of deals looks quiet.
  var MB_STATUS = {
    ok: ['Working', 'ok'], partial: ['Partly checked', 'warn'], error: ['Could not check', 'bad'],
    reconnect: ['Reconnect needed', 'bad'], no_mailbox: ['Not connected', 'off'], waiting: ['Not checked yet', 'off']
  };
  function mbAgo(iso) {
    if (!iso) return 'Never';
    var m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + ' min ago';
    var hr = Math.round(m / 60);
    if (hr < 24) return hr + (hr === 1 ? ' hour ago' : ' hours ago');
    var d = Math.round(hr / 24);
    return d + (d === 1 ? ' day ago' : ' days ago');
  }

  Console.prototype._renderMailboxes = async function (body, fresh) {
    var self = this;
    if (!this.mb || fresh) {
      if (!this.mb) body.innerHTML = '<div class="sxa-empty">Loading mailboxes…</div>';
      var d;
      try { d = await this.call('org_admin_mailboxes', this._body()); } catch (e) { d = { ok: false, error: e.message }; }
      if (this.tab !== 'mailboxes') return;
      if (!d || !d.ok) { body.innerHTML = '<div class="sxa-empty sxa-err">' + h((d && d.error) || 'Could not load mailboxes.') + '</div>'; return; }
      this.mb = d.people || [];
    }
    var nameOf = {};
    ((this.data && this.data.people) || []).forEach(function (p) { nameOf[p.user_id] = p.name || ''; });
    var rows = this.mb.slice().sort(function (a, b) {
      var rank = function (x) { return x.status === 'reconnect' || x.status === 'error' ? 0 : x.status === 'no_mailbox' ? 1 : 2; };
      return rank(a) - rank(b) || String(a.email).localeCompare(String(b.email));
    });
    var count = function (f) { return rows.filter(f).length; };
    var nOk = count(function (x) { return x.status === 'ok' || x.status === 'partial'; });
    var nFix = count(function (x) { return x.status === 'reconnect' || x.status === 'error'; });
    var nNone = count(function (x) { return x.status === 'no_mailbox'; });
    body.innerHTML =
      '<div class="sxa-pf">' +
        '<div class="sxa-note">SAM checks each connected mailbox and calendar every two hours. Whoever spoke to a customer, every deal with that customer gets the credit, so one missing mailbox can make a whole set of deals look quiet.</div>' +
        '<div class="sxa-mb-sum">' +
          '<span class="sxa-mb-n"><b>' + nOk + '</b> working</span>' +
          '<span class="sxa-mb-n' + (nFix ? ' bad' : '') + '"><b>' + nFix + '</b> need attention</span>' +
          '<span class="sxa-mb-n"><b>' + nNone + '</b> not connected</span>' +
          '<button type="button" class="sxa-btn sxa-btn-ghost" data-sxa="mb-refresh">Refresh</button>' +
        '</div>' +
        (rows.length ? '<div class="sxa-list">' + rows.map(function (x) {
          var s = MB_STATUS[x.status] || MB_STATUS.waiting;
          var nm = nameOf[x.user_id] || x.name || x.email;
          var found = x.accounts == null ? '' : !x.accounts ? 'Nothing new' : x.accounts + (x.accounts === 1 ? ' account' : ' accounts') + (x.teammate_accounts ? ', ' + x.teammate_accounts + ' of a teammate' : '');
          return '<div class="sxa-row sxa-mb-row">' +
            '<div class="sxa-person"><span class="sxa-av">' + h(initials({ name: nm, email: x.email })) + '</span><div class="sxa-pw">' +
              '<div class="sxa-pn">' + h(nm) + '</div><div class="sxa-pe">' + h(x.mailbox ? x.provider + ' · ' + x.mailbox : x.email) + '</div></div></div>' +
            '<div class="sxa-cell' + (x.provider ? '' : ' sxa-mb-blank') + '"><span class="sxa-lbl">Last checked</span><span class="sxa-static" title="' + h(x.last_pass_at ? fmtWhen(x.last_pass_at) : '') + '">' + h(x.provider ? mbAgo(x.last_ok_at || x.last_pass_at) : '') + '</span></div>' +
            '<div class="sxa-cell' + (x.provider ? '' : ' sxa-mb-blank') + '"><span class="sxa-lbl">Last check found</span><span class="sxa-static">' + h(found) + '</span></div>' +
            '<div class="sxa-cell"><span class="sxa-mb-st ' + s[1] + '" title="' + h(x.error || '') + '">' + h(s[0]) + '</span></div>' +
            '<div class="sxa-cell sxa-cell-act">' + (x.provider && x.status !== 'reconnect' ? '<button type="button" class="sxa-btn sxa-btn-ghost" data-sxa="mb-scan" data-id="' + h(x.user_id) + '">Check now</button>' : '') + '</div>' +
            (x.status === 'reconnect' || x.status === 'error' ? '<div class="sxa-mb-why">' + h(x.status === 'reconnect' ? (nm + ' needs to reconnect their mailbox under You, Email.') : (x.error || 'The last check failed.')) + '</div>' : '') +
          '</div>';
        }).join('') + '</div>' : '<div class="sxa-empty">Nobody here yet.</div>') +
      '</div>';
  };

  Console.prototype._mbScan = async function (btn) {
    var id = btn.getAttribute('data-id');
    btn.disabled = true; var was = btn.textContent; btn.textContent = 'Checking…';
    var d;
    try { d = await this.call('org_admin_mailbox_scan', this._body({ user_id: id })); } catch (e) { d = { ok: false, error: e.message }; }
    if (d && d.ok) this.toast('Checked: ' + (d.messages || 0) + ' emails, ' + (d.accounts_credited || 0) + ' accounts credited');
    else if (d && d.skipped) this.toast('Already being checked. Try again in a minute.');
    else this.toast((d && d.error) || 'Could not check this mailbox.', true);
    btn.disabled = false; btn.textContent = was;
    if (this.tab === 'mailboxes') this._renderMailboxes(this.el.querySelector('#sxa-body'), true);
  };

  Console.prototype._chipRemove = function (btn) {
    var k = btn.getAttribute('data-k'), i = parseInt(btn.getAttribute('data-i'), 10);
    if (!this.profile || !this.profile.icp[k]) return;
    this.profile.icp[k].splice(i, 1);
    this.pfDirty = true;
    this._renderProfile(this.el.querySelector('#sxa-body'));
  };

  Console.prototype._saveProfile = async function () {
    // Anything typed into a list but not yet turned into a chip still counts.
    var self = this;
    this.el.querySelectorAll('[data-pf-list]').forEach(function (el) {
      var k = el.getAttribute('data-pf-list'), list = self.profile.icp[k] = self.profile.icp[k] || [];
      el.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (v) { if (!list.some(function (x) { return x.toLowerCase() === v.toLowerCase(); })) list.push(v); });
      el.value = '';
    });
    var btn = this.el.querySelector('[data-sxa="pf-save"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var d;
    try { d = await this.call('org_admin_profile_save', this._body({ icp: this.profile.icp })); } catch (e) { d = { ok: false, error: e.message }; }
    if (!d || !d.ok) { this.toast((d && d.error) || 'Could not save.', true); if (btn) { btn.disabled = false; btn.textContent = 'Save profile'; } return; }
    this.profile.icp = d.icp;
    this.pfDirty = false;
    this.toast('Profile saved');
    this._renderProfile(this.el.querySelector('#sxa-body'));
  };

  Console.prototype._scoreAccounts = async function (btn) {
    if (this.pfDirty) { this.toast('Save the profile first, so accounts are scored against what you see here.', true); return; }
    btn.disabled = true; var label = btn.textContent; btn.textContent = 'Scoring…';
    var d;
    try { d = await this.call('compute_icp_scores', {}); } catch (e) { d = { ok: false, error: e.message }; }
    btn.disabled = false; btn.textContent = label;
    if (!d || !d.ok) { this.toast((d && d.error) || 'Could not score accounts right now.', true); return; }
    this.toast('Scored ' + (d.scored || 0) + ' accounts against your profile');
  };

  Console.prototype._productModal = function (id) {
    var self = this, p = id ? this.profile.products.filter(function (x) { return x.id === id; })[0] : null;
    var m = this._modal(
      '<div class="sxa-title">' + (p ? 'Edit product' : 'Add a product') + '</div>' +
      '<div class="sxa-sub">Samora matches conversations to your products and drafts outreach around them.</div>' +
      '<label class="sxa-f"><span class="sxa-lbl">Name</span><input class="sxa-in" data-f="name" value="' + h(p ? p.name : '') + '" placeholder="e.g. Loyalty platform"/></label>' +
      '<label class="sxa-f"><span class="sxa-lbl">Category</span><input class="sxa-in" data-f="category" value="' + h(p ? p.category : '') + '" placeholder="Optional, e.g. Core, Add-on, Services"/></label>' +
      '<label class="sxa-f"><span class="sxa-lbl">What it does</span><textarea class="sxa-in" data-f="description" rows="3" placeholder="The problem it solves, in a sentence or two">' + h(p ? p.description : '') + '</textarea></label>' +
      '<label class="sxa-f"><span class="sxa-lbl">Keywords</span><input class="sxa-in" data-f="keywords" value="' + h(p ? (p.keywords || []).join(', ') : '') + '" placeholder="Words buyers use about it, separated by commas"/></label>' +
      '<div class="sxa-msg" data-f="msg"></div>' +
      '<div class="sxa-actions"><button class="sxa-btn sxa-btn-ghost" data-f="cancel">Cancel</button><button class="sxa-btn sxa-btn-gold" data-f="go">' + (p ? 'Save' : 'Add product') + '</button></div>'
    );
    var q = function (k) { return m.querySelector('[data-f="' + k + '"]'); };
    q('cancel').onclick = function () { m.remove(); };
    q('go').onclick = async function () {
      if (!q('name').value.trim()) { q('msg').textContent = 'Give the product a name.'; q('msg').className = 'sxa-msg bad'; return; }
      q('go').disabled = true;
      var body = { name: q('name').value.trim(), category: q('category').value.trim(), description: q('description').value.trim(),
                   keywords: q('keywords').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean) };
      if (p) body.id = p.id;
      var r;
      try { r = await self.call('org_admin_product_save', self._body(body)); } catch (e) { r = { ok: false, error: e.message }; }
      if (!r.ok) { q('msg').textContent = r.error || 'Could not save.'; q('msg').className = 'sxa-msg bad'; q('go').disabled = false; return; }
      m.remove();
      self.toast(p ? 'Product updated' : 'Product added');
      self.profile = null;
      self._renderBody();
    };
  };

  Console.prototype._productRemove = function (id) {
    var self = this, p = this.profile.products.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var m = this._modal(
      '<div class="sxa-title">Remove ' + h(p.name) + '?</div>' +
      '<div class="sxa-sub">It stops being offered for new matching and outreach. Deals already linked to it keep their history.</div>' +
      '<div class="sxa-actions"><button class="sxa-btn sxa-btn-ghost" data-f="cancel">Cancel</button><button class="sxa-btn sxa-btn-bad" data-f="go">Remove product</button></div>'
    );
    m.querySelector('[data-f="cancel"]').onclick = function () { m.remove(); };
    m.querySelector('[data-f="go"]').onclick = async function () {
      var r;
      try { r = await self.call('org_admin_product_remove', self._body({ id: id })); } catch (e) { r = { ok: false, error: e.message }; }
      m.remove();
      if (!r.ok) { self.toast(r.error || 'Could not remove.', true); return; }
      self.toast(p.name + ' removed');
      self.profile = null;
      self._renderBody();
    };
  };

  // ── modals ─────────────────────────────────────────────────────────────
  Console.prototype._modal = function (html) {
    var m = document.createElement('div');
    m.className = 'sxa-modal-bg';
    m.innerHTML = '<div class="sxa sxa-modal" role="dialog" aria-modal="true">' + html + '</div>';
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    document.body.appendChild(m);
    var f = m.querySelector('input,select,button'); if (f) f.focus();
    return m;
  };

  Console.prototype._addModal = function () {
    var self = this, d = this.data, seats = d.seats || {};
    var mgrs = d.people.filter(function (p) { return p.is_active; }).sort(function (a, b) { return who(a).localeCompare(who(b)); });
    var m = this._modal(
      '<div class="sxa-title">Add a person</div>' +
      '<div class="sxa-sub">They get a welcome email with a temporary password and set their own on first sign-in.' + (seats.limit ? ' Uses 1 of the ' + (seats.limit - seats.active) + ' seats left on your plan.' : '') + '</div>' +
      '<label class="sxa-f"><span class="sxa-lbl">Work email</span><input class="sxa-in" data-f="email" type="email" placeholder="name@company.com" autocomplete="off"/></label>' +
      '<label class="sxa-f"><span class="sxa-lbl">Full name</span><input class="sxa-in" data-f="name" placeholder="Optional"/></label>' +
      '<div class="sxa-f2"><label class="sxa-f"><span class="sxa-lbl">Role</span><select class="sxa-sel" data-f="role">' + d.roles.map(function (r) { return '<option value="' + r + '"' + (r === 'ae' ? ' selected' : '') + '>' + h(ROLE_LABEL[r] || r) + '</option>'; }).join('') + '</select></label>' +
      '<label class="sxa-f"><span class="sxa-lbl">Reports to</span><select class="sxa-sel" data-f="mgr"><option value="">No manager yet</option>' + mgrs.map(function (p) { return '<option value="' + p.user_id + '">' + h(who(p)) + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="sxa-inl sxa-f"><input type="checkbox" data-f="admin"/> Also make them an admin</label>' +
      '<div class="sxa-msg" data-f="msg"></div>' +
      '<div class="sxa-actions"><button class="sxa-btn sxa-btn-ghost" data-f="cancel">Cancel</button><button class="sxa-btn sxa-btn-gold" data-f="go">Add and send invite</button></div>'
    );
    var q = function (k) { return m.querySelector('[data-f="' + k + '"]'); };
    q('cancel').onclick = function () { m.remove(); };
    q('go').onclick = async function () {
      var email = q('email').value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { q('msg').textContent = 'Enter a valid work email.'; q('msg').className = 'sxa-msg bad'; return; }
      q('go').disabled = true; q('go').textContent = 'Adding…';
      var r;
      try { r = await self.call('org_admin_invite', self._body({ email: email, name: q('name').value.trim(), role: q('role').value, manager_id: q('mgr').value || null, is_org_admin: q('admin').checked })); } catch (e) { r = { ok: false, error: e.message }; }
      if (!r.ok) { q('msg').textContent = r.error || 'Could not add.'; q('msg').className = 'sxa-msg bad'; q('go').disabled = false; q('go').textContent = 'Add and send invite'; return; }
      var done = '<div class="sxa-title">' + (r.status === 'restored' ? 'Welcome back' : 'Added') + '</div>' +
        (r.email_sent ? '<div class="sxa-sub">' + h(email) + ' has a welcome email with their sign-in details.</div>'
          : '<div class="sxa-sub">The welcome email did not go out' + (r.email_error ? ' (' + h(r.email_error) + ')' : '') + '. Share this temporary password with ' + h(email) + ' yourself. It is shown once.</div>' +
            (r.temp_password ? '<div class="sxa-code">' + h(r.temp_password) + '</div>' : '')) +
        (r.warning ? '<div class="sxa-msg bad">' + h(r.warning) + '</div>' : '') + (r.note ? '<div class="sxa-note">' + h(r.note) + '</div>' : '') +
        '<div class="sxa-actions"><button class="sxa-btn sxa-btn-gold" data-f="ok">Done</button></div>';
      m.querySelector('.sxa-modal').innerHTML = done;
      q('ok').onclick = function () { m.remove(); };
      await self.load();
      self.onChange();
    };
  };

  Console.prototype._removeModal = function (id) {
    var self = this, p = this.byId[id], d = this.data;
    var reports = d.people.filter(function (x) { return x.is_active && x.manager_id === id; });
    var up = p.manager_id && this.byId[p.manager_id];
    var m = this._modal(
      '<div class="sxa-title">Remove ' + h(who(p)) + '?</div>' +
      '<div class="sxa-sub">Their sign-in stops today and their seat frees up. Their past work stays in your reports. You can restore them later.</div>' +
      (reports.length ? '<div class="sxa-note sxa-note-block">' + reports.length + ' ' + (reports.length === 1 ? 'person reports' : 'people report') + ' to them. They will move up to ' + h(up ? who(up) : 'no manager') + '.</div>' : '') +
      '<div data-f="reassign"></div><div class="sxa-msg" data-f="msg"></div>' +
      '<div class="sxa-actions"><button class="sxa-btn sxa-btn-ghost" data-f="cancel">Cancel</button><button class="sxa-btn sxa-btn-bad" data-f="go">Remove access</button></div>'
    );
    var q = function (k) { return m.querySelector('[data-f="' + k + '"]'); };
    q('cancel').onclick = function () { m.remove(); };
    q('go').onclick = async function () {
      q('go').disabled = true;
      var sel = m.querySelector('[data-f="heir"]');
      var body = { org_id: d.org.id, user_id: id };
      if (sel) body.reassign_to = sel.value;
      var r;
      try { r = await self.call('admin_deactivate_user', body); } catch (e) { r = { ok: false, error: e.message }; }
      if (r && r.needs_reassignment) {
        var heirs = d.people.filter(function (x) { return x.is_active && x.user_id !== id; });
        q('reassign').innerHTML = '<div class="sxa-note sxa-note-block">' + h(who(p)) + ' owns ' + r.owned_count + ' account' + (r.owned_count === 1 ? '' : 's') + '. Pick who takes them over, so no deal is left without an owner.</div>' +
          '<label class="sxa-f"><span class="sxa-lbl">Hand accounts to</span><select class="sxa-sel" data-f="heir">' +
          heirs.map(function (x) { return '<option value="' + x.user_id + '"' + (up && x.user_id === up.user_id ? ' selected' : '') + '>' + h(who(x)) + '</option>'; }).join('') + '</select></label>';
        q('go').disabled = false; q('go').textContent = 'Hand over and remove';
        return;
      }
      if (!r || !r.ok) { q('msg').textContent = (r && r.error) || 'Could not remove.'; q('msg').className = 'sxa-msg bad'; q('go').disabled = false; return; }
      m.remove();
      self.toast(who(p) + ' removed' + (r.reassigned_accounts ? ', ' + r.reassigned_accounts + ' accounts handed over' : ''));
      await self.load();
      self.onChange();
    };
  };

  // ── Usage: the admin's tab (Team & access) ──────────────────────────────────
  Console.prototype._renderReveals = async function (body) {
    if (!this.use) {
      body.innerHTML = '<div class="sxa-empty">Loading…</div>';
      var d, rv;
      try { d = await this.call('org_admin_usage_get', this._body()); } catch (e) { d = { ok: false, error: e.message }; }
      try { rv = await this.call('org_admin_reveals_get', this._body()); } catch (e) { rv = null; }
      if (this.tab !== 'reveals') return;
      if (!d || !d.ok) { body.innerHTML = '<div class="sxa-empty sxa-err">' + h((d && d.error) || 'Could not load.') + '</div>'; return; }
      this.use = d; this.rev = rv && rv.ok ? rv : null;
    }
    var u = this.use, self = this;
    var kinds = u.kinds || [];
    var short = { ai_email: 'Emails', ai_note: 'LinkedIn notes', ai_read: 'Reads', reveal: 'Reveals', scout: 'People search', enrich: 'Look-ups', discovery: 'SAM-TAM', export: 'Exports' };
    var team = '<div class="g19-tl">' + kinds.map(function (k) {
      return '<label class="g19-tf"><span>' + h(k.label) + '<small>Samora limit ' + k.samora_cap + (k.month_cap !== null && k.month_cap !== undefined ? ' a day, ' + k.month_cap + ' a month for the team (' + k.month_used + ' used)' : ' a day') + '</small></span>' +
        '<input class="sxa-in" type="number" min="0" max="' + k.samora_cap + '" data-g19-team="' + k.kind + '" value="' + (k.team_cap === null || k.team_cap === undefined ? '' : k.team_cap) + '" placeholder="' + k.samora_cap + '"></label>';
    }).join('') + '</div>';
    var rows = (u.people || []).map(function (p) {
      var open = self.useOpen === p.user_id;
      var chips = p.usage.filter(function (x) { return x.used > 0 || x.kind === 'ai_email'; }).map(function (x) {
        var full = x.cap && x.used >= x.cap;
        return '<span class="g19-uc' + (full ? ' full' : '') + '" title="' + h(short[x.kind] || x.kind) + '">' + h(short[x.kind] || x.kind) + ' <b>' + x.used + '</b>/' + x.cap + '</span>';
      }).join('');
      var edit = open ? '<tr class="g19-edit"><td colspan="3"><div class="g19-tl">' + p.usage.map(function (x) {
        var ov = p.overrides && p.overrides[x.kind] !== undefined ? p.overrides[x.kind] : '';
        return '<label class="g19-tf"><span>' + h(short[x.kind] || x.kind) + '<small>now ' + x.cap + ' a day</small></span><input class="sxa-in" type="number" min="0" data-g19-p="' + x.kind + '" value="' + ov + '" placeholder="Team limit"></label>';
      }).join('') + '</div><div class="sxa-actions" style="justify-content:flex-start"><button class="sxa-btn sxa-btn-gold" data-sxa="use-person" data-v="' + h(p.user_id) + '">Save ' + h(p.name.split(' ')[0]) + '’s limits</button><button class="sxa-btn" data-sxa="use-open" data-v="">Close</button></div><div class="sxa-note">Empty means the team limit. Never above Samora’s.</div></td></tr>' : '';
      return '<tr><td><b>' + h(p.name) + '</b><div class="sxa-note" style="margin:2px 0 0">' + h(p.email) + '</div></td><td><div class="g19-ucs">' + (chips || '<span class="sxa-note">Nothing yet today</span>') + '</div><button class="g19-lnk" data-sxa="use-open" data-v="' + h(p.user_id) + '">' + (open ? 'Editing' : 'Limits') + '</button></td>' +
        '<td style="text-align:right"><button class="toggle-pill' + (p.can_export ? ' on' : '') + '" role="switch" aria-checked="' + p.can_export + '" aria-label="' + h(p.name) + ' can export audiences" data-sxa="use-export" data-v="' + h(p.user_id) + '"><i></i></button></td></tr>' + edit;
    }).join('');
    var ex = (u.exports || []).map(function (x) { return '<tr><td>' + h(new Date(x.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</td><td>' + h(x.by) + '</td><td>' + h({ meta: 'Meta', linkedin_people: 'LinkedIn contacts', linkedin_companies: 'LinkedIn companies' }[x.format] || x.format) + '</td><td style="text-align:right">' + x.rows + '</td></tr>'; }).join('');
    var r = this.rev;
    var rrows = r ? (r.month || []).map(function (m) { return '<tr><td>' + h(m.name) + '</td><td style="text-align:right">' + m.paid + '</td><td style="text-align:right">' + m.free + '</td><td style="text-align:right">' + m.found + '</td></tr>'; }).join('') : '';
    body.innerHTML = '<div class="sxa-pf">' +
      (u.note ? '<div class="sxa-note" style="color:var(--c-partial)">' + h(u.note) + '</div>' : '') +
      '<div class="sxa-sec" style="margin-top:4px">Daily limits for the team</div>' +
      '<div class="sxa-note">Limits keep costs predictable and stop anything running in a loop. Samora sets the most your plan allows; you can set lower ones for everyone here, or for one person below.</div>' + team +
      '<div class="sxa-actions" style="justify-content:flex-start"><button class="sxa-btn sxa-btn-gold" data-sxa="use-team">Save team limits</button></div>' +
      '<div class="sxa-sec">People today</div>' +
      '<table class="sxa-tbl g19-ptbl" style="width:100%"><thead><tr><th style="text-align:left">Person</th><th style="text-align:left">Used today</th><th style="text-align:right">Can export audiences</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="sxa-sec">Ad audience exports</div>' +
      '<label class="g19-sw"><button class="toggle-pill' + (u.export_provider_data ? ' on' : '') + '" role="switch" aria-checked="' + !!u.export_provider_data + '" data-sxa="use-provider"><i></i></button><span><b>Include phone numbers and emails found through Lusha or Apollo</b><small>Off by default. Their contracts usually limit data to your own internal use; check yours before switching this on. Your own records and people’s replies are always included.</small></span></label>' +
      (ex ? '<table class="sxa-tbl" style="width:100%;max-width:640px;margin-top:10px"><thead><tr><th style="text-align:left">When</th><th style="text-align:left">Who</th><th style="text-align:left">Format</th><th style="text-align:right">Rows</th></tr></thead><tbody>' + ex + '</tbody></table>' : '<div class="sxa-note">No exports yet.</div>') +
      (r ? '<div class="sxa-sec">Contact reveals this month</div>' + (rrows ? '<table class="sxa-tbl" style="width:100%;max-width:560px"><thead><tr><th style="text-align:left">Person</th><th style="text-align:right">Paid</th><th style="text-align:right">Free</th><th style="text-align:right">With a phone</th></tr></thead><tbody>' + rrows + '</tbody></table>' : '<div class="sxa-note">No reveals yet this month.</div>') : '') +
    '</div>';
  };
  Console.prototype._g19Save = async function (payload, okMsg) {
    var d;
    try { d = await this.call('org_admin_usage_save', this._body(payload)); } catch (e) { d = { ok: false, error: e.message }; }
    if (!d || !d.ok) { this.toast((d && d.error) || 'Could not save.', true); return; }
    this.use = d;
    try { var rv = await this.call('org_admin_reveals_get', this._body()); if (rv && rv.ok) this.rev = rv; } catch (e) {}
    this.toast(d.note || okMsg);
    this._renderReveals(this.el.querySelector('#sxa-body'));
  };
  Console.prototype._g19Act = function (a, t) {
    var self = this;
    if (a === 'use-open') { this.useOpen = t.getAttribute('data-v') || null; this._renderReveals(this.el.querySelector('#sxa-body')); return true; }
    if (a === 'use-team') { var def = {}; this.el.querySelectorAll('[data-g19-team]').forEach(function (i) { def[i.getAttribute('data-g19-team')] = i.value === '' ? null : i.value; }); this._g19Save({ defaults: def }, 'Team limits saved'); return true; }
    if (a === 'use-person') { var caps = {}; this.el.querySelectorAll('[data-g19-p]').forEach(function (i) { caps[i.getAttribute('data-g19-p')] = i.value === '' ? null : i.value; }); this.useOpen = null; this._g19Save({ person: { user_id: t.getAttribute('data-v'), caps: caps } }, 'Limits saved'); return true; }
    if (a === 'use-export') { var on = !t.classList.contains('on'); t.classList.toggle('on', on); this._g19Save({ export_user: { user_id: t.getAttribute('data-v'), on: on } }, on ? 'They can export audiences now' : 'Export switched off for them'); return true; }
    if (a === 'use-provider') { var on2 = !t.classList.contains('on'); t.classList.toggle('on', on2); this._g19Save({ export_provider_data: on2 }, on2 ? 'Lusha and Apollo data will be included in exports' : 'Lusha and Apollo data stay out of exports'); return true; }
    void self;
    return false;
  };


  window.SamoraAccessConsole = {
    mount: function (el, opts) {
      if (!el) return null;
      var c = new Console(el, opts || {});
      c.load();
      return c;
    }
  };
})();

// ══ Scroll arrows for every sideways strip (2026-10-02) ═══════════════════════
// A strip that scrolls sideways with a hidden scrollbar gives no clue that more
// sits off screen. Any strip listed here gets a round arrow on each side that
// has more to show; it appears only while there is somewhere to go, and a tap
// moves by most of a screen. Attached by observation, so strips drawn later
// (Team & access tabs, Pipeline views) are covered without each caller asking.
(function () {
  var SEL = '.metric-strip,.cal-strip,.pdt-bar,.sxa-tabs,.today-sections,[data-hscroll]';
  var MASK = { 'sxa-tabs': 1, 'today-sections': 1, 'cal-strip': 1 };
  var live = [];
  function arrow(dir) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'sh-btn sh-' + dir; b.hidden = true; b.tabIndex = -1;
    b.setAttribute('aria-label', dir === 'l' ? 'Show earlier items' : 'Show more items');
    b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (dir === 'l' ? 'M14.5 6l-6 6 6 6' : 'M9.5 6l6 6-6 6') + '"/></svg>';
    return b;
  }
  function place(el) {
    var s = el._sh; if (!s) return;
    if (!el.isConnected || !s.l.isConnected) return;
    var visible = el.offsetParent !== null && el.clientWidth > 0;
    var over = visible && el.scrollWidth > el.clientWidth + 4;
    var atL = el.scrollLeft <= 2, atR = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    el.classList.toggle('sh-fl', over && !atL);
    el.classList.toggle('sh-fr', over && !atR);
    s.l.hidden = !(over && !atL); s.r.hidden = !(over && !atR);
    if (!over) return;
    var mid = el.offsetTop + el.offsetHeight / 2;
    s.l.style.top = s.r.style.top = mid + 'px';
    s.l.style.left = (el.offsetLeft + 2) + 'px';
    s.r.style.left = (el.offsetLeft + el.offsetWidth - 30) + 'px';
  }
  function attach(el) {
    if (el._sh && el._sh.l.isConnected) return;
    var p = el.parentNode; if (!p || p.nodeType !== 1) return;
    if (getComputedStyle(p).position === 'static') p.style.position = 'relative';
    var l = arrow('l'), r = arrow('r');
    p.insertBefore(l, el); p.insertBefore(r, el.nextSibling);
    el._sh = { l: l, r: r };
    for (var k in MASK) if (el.classList.contains(k)) el.classList.add('sh-mask');
    var go = function (dir) { el.scrollBy({ left: dir * Math.max(140, el.clientWidth * 0.7), behavior: 'smooth' }); };
    l.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); go(-1); });
    r.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); go(1); });
    el.addEventListener('scroll', function () { place(el); }, { passive: true });
    if (window.ResizeObserver) { try { new ResizeObserver(function () { place(el); }).observe(el); } catch (e) {} }
    live.push(el);
    // A strip drawn with its selected item off screen scrolls to show it
    var act = el.querySelector('.on,.active,[aria-selected="true"]');
    if (act && el.scrollWidth > el.clientWidth + 4) {
      var er = el.getBoundingClientRect(), ar = act.getBoundingClientRect();
      if (ar.left < er.left || ar.right > er.right) el.scrollLeft += (ar.left - er.left) - (el.clientWidth - ar.width) / 2;
    }
  }
  var queued = false;
  function scan() {
    queued = false;
    var els = document.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) attach(els[i]);
    live = live.filter(function (el) { return el.isConnected; });
    live.forEach(place);
  }
  function soon() { if (!queued) { queued = true; setTimeout(scan, 120); } }
  window._scrollHintsRefresh = soon;
  function start() {
    scan();
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var t = muts[i].target;
          if (t && t.classList && (t.classList.contains('sh-btn') || t.classList.contains('sh-fl') || t.classList.contains('sh-fr'))) continue;
          soon(); return;
        }
      }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
    window.addEventListener('resize', soon, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

// ══ Rail identity (desktop) ═══════════════════════════════════════════════════
// The foot of the rail says who is signed in and to which company, the way
// Linear, Slack and Notion do, and opens You. It also gives the long empty
// rail a reason to end where it does.
function _renderRailMe() {
  var b = document.getElementById('railMe'); if (!b || !currentUser) return;
  var full = (currentUser.user_metadata && currentUser.user_metadata.full_name) || (profile && (profile.full_name || profile.name)) || '';
  var email = currentUser.email || '';
  if (!full && email) full = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  var w = (full || email).trim().split(/\s+/);
  var ini = ((w[0] || '')[0] || '') + ((w[1] || '')[0] || (w[0] || '')[1] || '');
  document.getElementById('railMeAv').textContent = ini.toUpperCase();
  document.getElementById('railMeName').textContent = full || email;
  var org = (profile && (profile.org_name || profile.org_code)) || '';
  var roleKey = profile && profile.role;
  var labels = (window._orgConfig && window._orgConfig.roleLabels) || {};
  var role = roleKey ? (labels[roleKey] || roleKey.replace('_', ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); })) : '';
  document.getElementById('railMeOrg').textContent = [role, org].filter(Boolean).join(' · ');
  b.title = email;
  b.hidden = false;
}

// ══ You: setup checklist (desktop side column) ═════════════════════════════════
// Five things that decide how much SamoraOS can do for this person. Each line
// says what is done or the next action, and opens the matching row. Values
// arrive from the checks the tab already runs; unknown stays neutral.
var _youSetup = { email: null, push: null, accounts: null, habits: null, notetaker: null };
function _youSetupSet(k, v) {
  if (_youSetup[k] === v) return;
  _youSetup[k] = v;
  try { _renderYouSetup(); } catch (e) {}
}
var _YOU_SETUP = [
  { k: 'email', acc: 'email', done: 'Mailbox connected', todo: 'Connect your mailbox' },
  { k: 'accounts', acc: 'accounts', done: 'Accounts assigned to you', todo: 'Add the accounts you work' },
  { k: 'habits', acc: 'habits', done: 'Daily habits set', todo: 'Set your daily habits' },
  { k: 'push', acc: 'notifications', done: 'Notifications on here', todo: 'Turn on notifications' },
  { k: 'notetaker', acc: 'notetaker', done: 'Notetaker connected', todo: 'Connect a notetaker' }
];
function _renderYouSetup() {
  var box = document.getElementById('youSetup'); if (!box) return;
  if (typeof _userHabits !== 'undefined' && _userHabits !== null) _youSetup.habits = !!(_userHabits && _userHabits.length);
  var known = _YOU_SETUP.filter(function (s) { return _youSetup[s.k] !== null; });
  if (_youSetup.email === null) { box.hidden = true; return; }
  var done = _YOU_SETUP.filter(function (s) { return _youSetup[s.k] === true; }).length;
  var total = _YOU_SETUP.length, pct = Math.round(done / total * 100);
  var R = 15, C = 2 * Math.PI * R, off = C * (1 - done / total);
  var ring = '<svg class="you-setup-ring" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">' +
    '<circle cx="20" cy="20" r="' + R + '" fill="none" stroke="currentColor" stroke-opacity=".14" stroke-width="4"/>' +
    '<circle cx="20" cy="20" r="' + R + '" fill="none" stroke="var(--c-accent)" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 20 20)"/></svg>';
  var tick = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  box.innerHTML =
    '<div class="you-setup-head">' + ring + '<div><div class="you-setup-t">' + (done === total ? 'You are all set' : 'Your setup') + '</div>' +
    '<div class="you-setup-s">' + done + ' of ' + total + ' done</div></div></div>' +
    '<ul class="you-setup-list">' + _YOU_SETUP.map(function (s) {
      var v = _youSetup[s.k];
      var st = v === true ? 'ok' : v === false ? 'todo' : 'wait';
      return '<li><button type="button" class="you-setup-i ' + st + '" onclick="_youGo(\'' + s.acc + '\')">' +
        '<span class="you-setup-dot">' + (st === 'ok' ? tick : '') + '</span>' +
        '<span class="you-setup-l">' + (st === 'ok' ? s.done : s.todo) + '</span>' +
        (st === 'todo' ? '<span class="you-setup-go" aria-hidden="true"></span>' : '') + '</button></li>';
    }).join('') + '</ul>';
  box.hidden = false;
  box.setAttribute('data-pct', pct);
}
function _youGo(acc) {
  var el = document.getElementById('youAcc-' + acc); if (!el) return;
  if (!el.classList.contains('open')) {
    var btn = el.querySelector('.you-row');
    if (btn) btn.click(); else toggleYouAcc(acc);
  } else {
    var r = el.getBoundingClientRect();
    try { window.scrollBy({ top: r.top - 84, behavior: 'smooth' }); } catch (e) { window.scrollBy(0, r.top - 84); }
  }
}

// ══ Team & access, Accounts: bulk download and upload (2026-10-02) ════════════
// Download every account as a CSV, edit it in Excel or Sheets, upload it back.
// Rows with an Account ID update that account, rows without one are added.
// The server returns a plan first; nothing changes until Apply is pressed.
var _acctBulk = null;
var ACCT_BULK_COLS = ['Account ID', 'Account name', 'Domain', 'Region', 'Owner email', 'SDR email'];

function _acctCsvCell(v) {
  var s = String(v == null ? '' : v);
  // Spreadsheet apps run cells that start with these as formulas
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
async function _acctBulkCall(body) {
  var r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify(body) });
  var d = {}; try { d = await r.json(); } catch (e) {}
  if (!r.ok && d.ok === undefined) d.ok = false;
  return d;
}
async function acctBulkDownload(btn) {
  if (btn) { btn.disabled = true; btn.dataset.t = btn.innerHTML; btn.innerHTML = 'Preparing…'; }
  try {
    var d = await _acctBulkCall({ action: 'org_admin_accounts_export' });
    if (!d.ok) { showToast(d.error || 'Could not download accounts'); return; }
    var lines = [ACCT_BULK_COLS.join(',')].concat((d.rows || []).map(function (a) {
      return [a.id, a.name, a.domain, a.region, a.owner_email, a.sdr_email].map(_acctCsvCell).join(',');
    }));
    var blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    var org = ((profile && (profile.org_name || profile.org_code)) || 'accounts').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = org + '-accounts-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    showToast((d.rows || []).length ? 'Downloaded ' + d.rows.length + ' account' + (d.rows.length === 1 ? '' : 's') : 'Downloaded an empty file with the columns to fill in');
  } catch (e) { showToast('Download failed: ' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.t; } }
}
function acctBulkUpload() {
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.csv,text/csv';
  inp.onchange = function () { if (inp.files[0]) _acctBulkRead(inp.files[0]); };
  inp.click();
}
async function _acctBulkRead(file) {
  try {
    var text = (await file.text()).replace(/^﻿/, '');
    var rows = _parseCsv(text);
    if (rows.length < 2) { showToast('The file has no rows under the headings'); return; }
    var head = rows[0].map(function (h) { return String(h || '').toLowerCase().replace(/[^a-z]/g, ''); });
    var col = function (names) { for (var i = 0; i < names.length; i++) { var k = head.indexOf(names[i]); if (k !== -1) return k; } return -1; };
    var map = {
      id: col(['accountid', 'id']),
      name: col(['accountname', 'account', 'company', 'companyname', 'name']),
      domain: col(['domain', 'website', 'url']),
      region: col(['region', 'country', 'territory']),
      owner: col(['owneremail', 'owner', 'accountowner', 'aeemail', 'repemail']),
      sdr: col(['sdremail', 'sdr'])
    };
    if (map.name === -1 && map.id === -1) { showToast('Could not find an Account name column. Download the file first to get the headings.'); return; }
    var body = rows.slice(1).map(function (r, i) {
      var g = function (k) { return k >= 0 ? String(r[k] || '').trim().replace(/^'(?=[=+\-@])/, '') : ''; };
      return { line: i + 2, id: g(map.id), name: g(map.name), domain: g(map.domain), region: g(map.region), owner_email: g(map.owner), sdr_email: g(map.sdr) };
    }).filter(function (r) { return r.id || r.name || r.domain || r.owner_email; });
    if (!body.length) { showToast('The file has no rows under the headings'); return; }
    _acctBulk = { file: file.name, rows: body };
    _acctBulkModal({ loading: true });
    var d = await _acctBulkCall({ action: 'org_admin_accounts_import', rows: body });
    if (!d.ok) { _acctBulkModal({ error: d.error || 'Could not read the file' }); return; }
    _acctBulk.plan = d;
    _acctBulkModal({ plan: d });
  } catch (e) { showToast('Could not read the file: ' + e.message); }
}
function _acctBulkClose() { var m = document.getElementById('acctBulkModal'); if (m) m.remove(); }
function _acctBulkModal(state) {
  var m = document.getElementById('acctBulkModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'acctBulkModal'; m.className = 'bulk-modal';
    m.addEventListener('click', function (e) { if (e.target === m) _acctBulkClose(); });
    document.body.appendChild(m);
  }
  var title = '<div class="bulk-h"><div><div class="bulk-t">Upload accounts</div><div class="bulk-s">' + esc((_acctBulk && _acctBulk.file) || '') + '</div></div>' +
    '<button class="bulk-x" onclick="_acctBulkClose()" aria-label="Close">×</button></div>';
  if (state.loading) { m.innerHTML = '<div class="bulk-card">' + title + '<div class="bulk-wait">Checking ' + _acctBulk.rows.length + ' row' + (_acctBulk.rows.length === 1 ? '' : 's') + ' against your team and accounts…</div></div>'; return; }
  if (state.error) { m.innerHTML = '<div class="bulk-card">' + title + '<div class="bulk-err">' + esc(state.error) + '</div><div class="bulk-f"><button class="g-btn" onclick="_acctBulkClose()">Close</button></div></div>'; return; }
  if (state.done) {
    var d = state.done;
    var msg = (d.added ? d.added + ' added' : '') + (d.added && d.updated ? ', ' : '') + (d.updated ? d.updated + ' updated' : '');
    m.innerHTML = '<div class="bulk-card">' + title +
      '<div class="bulk-ok"><span class="bulk-okdot"></span>' + esc(msg || 'Nothing needed changing') + '</div>' +
      ((d.failed || []).length ? '<div class="bulk-err">' + d.failed.length + ' row' + (d.failed.length === 1 ? '' : 's') + ' could not be saved: ' + d.failed.slice(0, 5).map(function (f) { return 'line ' + f.line + ' (' + esc(f.name || '') + ')'; }).join(', ') + '</div>' : '') +
      '<div class="bulk-f"><button class="g-btn" onclick="_acctBulkClose()">Done</button></div></div>';
    return;
  }
  var p = state.plan, s = p.summary || {};
  var chip = function (n, label, cls) { return '<span class="bulk-chip ' + cls + '"><b>' + n + '</b> ' + label + '</span>'; };
  var rows = (p.plan || []).filter(function (r) { return r.status !== 'same'; });
  var line = function (r) {
    var what;
    if (r.status === 'add') what = 'New, owner ' + esc(r.owner_email || '') + (r.owner_is_you ? ' (you, no owner in the file)' : '');
    else if (r.status === 'update') what = r.changes.map(function (c) { return esc(c.field) + ': ' + (c.from ? esc(c.from) : '<i>blank</i>') + ' to ' + esc(c.to); }).join('; ');
    else what = esc(r.reason || '');
    var tag = r.status === 'add' ? 'Add' : r.status === 'update' ? 'Update' : 'Skip';
    return '<li class="bulk-r ' + r.status + '"><span class="bulk-tag">' + tag + '</span><span class="bulk-rn"><b>' + esc(r.name || '(no name)') + '</b><small>Line ' + r.line + ' · ' + what + '</small></span></li>';
  };
  var todo = (s.add || 0) + (s.update || 0);
  m.innerHTML = '<div class="bulk-card">' + title +
    '<div class="bulk-chips">' + chip(s.add || 0, 'to add', 'add') + chip(s.update || 0, 'to update', 'update') + chip(s.same || 0, 'unchanged', 'same') + chip(s.skip || 0, 'with problems', 'skip') + '</div>' +
    (rows.length ? '<ul class="bulk-list">' + rows.map(line).join('') + '</ul>' : '<div class="bulk-wait">Everything in the file already matches SamoraOS.</div>') +
    (p.total > (p.plan || []).length ? '<div class="bulk-note">Showing the first ' + p.plan.length + ' of ' + p.total + ' rows.</div>' : '') +
    '<div class="bulk-note">Blank cells leave a value as it is. Rows with problems are left out; fix them in the file and upload again.</div>' +
    '<div class="bulk-f"><button class="g-btn" onclick="_acctBulkClose()">Cancel</button>' +
    '<button class="g-btn bulk-go" id="acctBulkGo" ' + (todo ? '' : 'disabled') + ' onclick="_acctBulkApply()">' +
    (todo ? (s.add ? 'Add ' + s.add : '') + (s.add && s.update ? ' and ' : '') + (s.update ? 'update ' + s.update : '') : 'Nothing to change') + '</button></div></div>';
}
async function _acctBulkApply() {
  var b = document.getElementById('acctBulkGo'); if (b) { b.disabled = true; b.textContent = 'Saving…'; }
  try {
    var d = await _acctBulkCall({ action: 'org_admin_accounts_import', rows: _acctBulk.rows, apply: true });
    if (!d.ok) { _acctBulkModal({ error: d.error || 'Could not save' }); return; }
    _acctBulkModal({ done: d });
    try { if (document.getElementById('accountRepSelect') && document.getElementById('accountRepSelect').value) loadRepAccounts(); } catch (e) {}
    try { loadMyAccounts(); } catch (e) {}
  } catch (e) { _acctBulkModal({ error: e.message }); }
}

// ══ SAMpaigns, revamped (2026-10-02) ═════════════════════════════════════════
// Home: a portfolio band, campaign rows that say what each one needs next, and
// a Needs you column. A full page per SAMpaign with Overview, People,
// Sequence, Replies and Insights. A four step New SAMpaign. Email and LinkedIn
// sit side by side; LinkedIn is marked soon until the extension ships.
//
// The older functions stay where they are and these later declarations win.
// People and Sequence keep the existing contact roster, drafts review and
// queue, so nothing those already do is lost.
var SP_ICON = {
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>',
  li: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5v6M8 7.5v.5M11.5 16.5v-3.5a2.2 2.2 0 014.4 0v3.5M11.5 12.5v4"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16v10H8l-4 3z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14v14H5zM8 9h8M8 13h5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 3.9L2.6 17.4A1.6 1.6 0 004 19.8h16a1.6 1.6 0 001.4-2.4L13.7 3.9a1.6 1.6 0 00-2.8 0z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12.5V4h8.5l8.5 8.5-8 8z"/><circle cx="8" cy="8.5" r="1.3"/></svg>',
  plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  spark: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>'
};
var SP_TYPES = { interested: ['Interested', 'int'], referral: ['Referral', 'ref'], not_now: ['Not now', 'later'], not_interested: ['Not interested', 'no'], other: ['To label', ''], ooo: ['Out of office', 'warn'], bounce: ['Bounced', 'risk'] };

async function _sampEdge(action, body) {
  var r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify(Object.assign({ action: action }, body || {})) });
  var d = {}; try { d = await r.json(); } catch (e) { d = { ok: false, error: 'Unexpected response (' + r.status + ')' }; }
  if (d.ok === undefined) d.ok = r.ok;
  d._status = r.status;
  if (!d.ok && !d.error) {
    d._stopped = [502, 503, 504, 546].includes(r.status) || /WORKER_LIMIT|wall ?clock|timeout|timed out/i.test(String(d.code || d.message || d.msg || ''));
    d.error = d._stopped ? 'SAM took too long and was stopped. Nothing was used. Try again.' : (d.message || d.msg || 'Unexpected response (' + r.status + ')');
  }
  return d;
}
function _spIni(s) { var w = String(s || '').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean); return ((w[0] || '?')[0] + ((w[1] || '')[0] || '')).toUpperCase(); }
function _spOwnerName(email) { var l = String(email || '').split('@')[0].split(/[._-]/)[0] || ''; return l ? l.charAt(0).toUpperCase() + l.slice(1) : ''; }
function _spDate(iso, withTime) {
  if (!iso) return '';
  var d = new Date(iso); if (isNaN(d.getTime())) return '';
  var o = { day: 'numeric', month: 'short' }; if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; }
  return d.toLocaleString('en-GB', o);
}
function _spAgo(iso) {
  if (!iso) return '';
  var m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (m < 60) return Math.max(1, Math.round(m)) + ' min ago';
  if (m < 1440) return Math.round(m / 60) + (Math.round(m / 60) === 1 ? ' hour ago' : ' hours ago');
  var d = Math.round(m / 1440); return d === 1 ? 'yesterday' : d < 14 ? d + ' days ago' : _spDate(iso);
}
function _spWave(n) { n = Number(n) || 1; return n <= 1 ? 'First email' : 'Follow-up ' + (n - 1); }
function _spPlural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function _spRate(s) {
  var del = Math.max(0, (s.sent || 0) - (s.dead || 0)), rep = (s.replied || 0) + (s.opted_out || 0);
  return del > 0 ? Math.round(rep / del * 1000) / 10 : null;
}
function _spShow(view) {
  window._sampView = view;
  var home = document.getElementById('sampHomeView'), det = document.getElementById('sampDetailPage'), wiz = document.getElementById('sampWizardPage');
  if (home) home.hidden = view !== 'home';
  if (det) det.hidden = view !== 'detail';
  if (wiz) wiz.hidden = view !== 'new';
  var tam = document.getElementById('sampTamPage'); if (tam) tam.hidden = view !== 'tam';
  try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
}

// ── Home ────────────────────────────────────────────────────────────────────
async function loadSampaignWorkspace() {
  var host = document.getElementById('sampaignManualSection');
  if (!host) return;
  _spShow('home');
  host.innerHTML =
    '<section class="sp-card sp-kpis" id="sampKpis" aria-label="Your SAMpaigns at a glance">' + _spKpisHtml(null) + '</section>' +
    '<div class="sp-note" id="sampKpiNote" hidden></div>' +
    '<div class="sp-two"><div><div class="sp-bar" id="sampaignListToolbar"></div><div class="sp-list" id="sampaignCampaignsList"><div class="sp-empty">Loading SAMpaigns…</div></div></div>' +
    '<div class="sp-side"><section class="sp-card sp-pad sp-score" id="sampScore" aria-label="Your week"><div class="sp-lbl">This week</div><div class="sp-small" style="margin-top:10px">Counting…</div></section>' +
    '<aside class="sp-card sp-pad sp-needs" id="sampNeeds" aria-label="Needs you"><div class="sp-lbl">Needs you</div><div class="sp-small" style="margin-top:10px">Checking…</div></aside></div></div>';
  try { if (typeof loadGoalTemplates === 'function') loadGoalTemplates(); } catch (e) {}
  loadSampaignCampaigns();
}
function _spKpisHtml(k) {
  var v = function (x, suf) { return k ? x : '<span class="sp-muted">…</span>'; };
  var med = k && k.median_reply_days !== null && k.median_reply_days !== undefined ? k.median_reply_days + '<small>days</small>' : (k ? '<span class="sp-muted">n/a</span>' : '');
  return '<div class="sp-kpi"><div class="sp-lbl">Live</div><div class="n">' + v(k && k.live) + '</div><div class="d">' + (k ? (k.paused ? k.paused + ' paused, ' : '') + k.archived + ' archived' : '&nbsp;') + '</div></div>' +
    '<div class="sp-kpi"><div class="sp-lbl">People in flight</div><div class="n">' + v(k && k.in_flight) + '</div><div class="d">' + (k ? k.reached + ' reached so far' : '&nbsp;') + '</div></div>' +
    '<div class="sp-kpi"><div class="sp-lbl">Replies, 7 days</div><div class="n sp-g">' + v(k && k.replies_7d) + '</div><div class="d">' + (k ? k.interested_7d + ' interested' + (k.referrals_7d ? ', ' + _spPlural(k.referrals_7d, 'referral') : '') : '&nbsp;') + '</div></div>' +
    '<div class="sp-kpi"><div class="sp-lbl">Meetings booked</div><div class="n">' + v(k && k.meetings) + '</div><div class="d">' + (k ? 'from ' + _spPlural(k.replies_total, 'reply', 'replies') + ' in all' : '&nbsp;') + '</div></div>' +
    '<div class="sp-kpi"><div class="sp-lbl">Typical reply time</div><div class="n">' + (k ? med : '<span class="sp-muted">…</span>') + '</div><div class="d">' + (k ? (k.median_reply_days !== null ? 'half of replies come faster' : 'shows once replies are timed') : '&nbsp;') + '</div></div>';
}
async function _sampLoadHome() {
  var scope = window._sampaignOwnerFilter === 'mine' ? 'mine' : 'org';
  var d = await _sampEdge('get_sampaign_home', { scope: scope });
  var box = document.getElementById('sampKpis'), needs = document.getElementById('sampNeeds'), note = document.getElementById('sampKpiNote');
  if (!d.ok) { if (needs) needs.innerHTML = '<div class="sp-lbl">Needs you</div><div class="sp-small" style="margin-top:10px">' + esc(d.error || 'Could not load') + '</div>'; return; }
  window._sampHome = d;
  if (box) box.innerHTML = _spKpisHtml(d.kpis);
  if (note) { note.hidden = !!d.kpis.captured; note.textContent = d.kpis.captured ? '' : 'Reply times, reply types and meetings start recording once the latest database update has run.'; }
  if (needs) needs.innerHTML = _spNeedsHtml(d.needs || []);
  _scLoad();
}
function _spNeedsHtml(items) {
  var li = function (cls, icon, title, sub, btn) { return '<li><span class="sp-ni ' + cls + '">' + icon + '</span><div class="sp-nt">' + title + (sub ? '<small>' + sub + '</small>' : '') + (btn || '') + '</div></li>'; };
  var go = function (cid, tab, label, extra) { return '<button class="g-btn sp-sm" type="button" onclick="openSampaignDetail(\'' + esc(cid) + '\',\'' + tab + '\'' + (extra ? ',' + extra : '') + ')">' + label + '</button>'; };
  var html = items.map(function (n) {
    var camp = esc(n.campaign_name || '');
    if (n.kind === 'interested') return li('g', SP_ICON.chat, '<b>' + esc(n.name) + '</b> is interested', [esc(n.company || ''), camp, _spAgo(n.at)].filter(Boolean).join(' · '), go(n.campaign_id, 'replies', 'Reply and book'));
    if (n.kind === 'referral') return li('b', SP_ICON.chat, '<b>' + esc(n.name) + '</b> pointed you to someone', [esc(n.company || ''), camp, _spAgo(n.at)].filter(Boolean).join(' · '), go(n.campaign_id, 'replies', 'See the reply'));
    if (n.kind === 'drafts') return li('a', SP_ICON.doc, _spPlural(n.count, 'draft') + ' ready for review', camp + ' · ' + _spWave(n.launch).toLowerCase(), go(n.campaign_id, 'sequence', 'Review drafts'));
    if (n.kind === 'unlabelled') return li('a', SP_ICON.tag, _spPlural(n.count, 'reply', 'replies') + ' to label', camp, go(n.campaign_id, 'replies', 'Label them'));
    if (n.kind === 'bounces') return li('r', SP_ICON.warn, _spPlural(n.count, 'email') + ' bounced', camp + ' · last 14 days', go(n.campaign_id, 'people', 'Find new addresses', '\'dead\''));
    if (n.kind === 'failed') return li('r', SP_ICON.warn, _spPlural(n.count, 'email') + ' did not go out', camp + (n.mailbox ? ' · mailbox disconnected' : ''), '<button class="g-btn sp-sm sp-gold" type="button" onclick="openSampaignDetail(\'' + esc(n.campaign_id) + '\',\'sequence\');sampRetryFailed(\'' + esc(n.campaign_id) + '\',' + (Number(n.launch) || 1) + ')">' + (n.mailbox ? 'Fix and send again' : 'Send again') + '</button>');
    if (n.kind === 'overdue') return li('a', SP_ICON.clock, _spWave(n.stage + 1) + ' is overdue', camp + ' · ' + _spPlural(n.count, 'person', 'people') + (n.since ? ' since ' + _spDate(n.since) : ''), go(n.campaign_id, 'sequence', 'Write it'));
    if (n.kind === 'linkedin') return li('b', SP_ICON.li, _spPlural(n.count, 'LinkedIn note') + ' written', 'Waiting in the LinkedIn plugin', '');
    return '';
  }).join('');
  return '<div class="sp-lbl">Needs you' + (items.length ? ' · ' + items.length : '') + '</div>' + (html ? '<ul>' + html + '</ul>' : '<div class="sp-small" style="margin-top:10px">Nothing needs you right now. New replies and drafts show up here first.</div>');
}

async function loadSampaignCampaigns() {
  var el = document.getElementById('sampaignCampaignsList');
  if (!el || !currentUser || !currentUser.token) return;
  var viewing = window._sampaignView || 'active';
  try {
    await _liEnsureConfig();
    var d = await _sampEdge('list_sampaigns', { view: viewing, scope: 'org' });
    if (!d.ok) { el.innerHTML = '<div class="sp-empty sp-r">' + esc(d.error || 'Could not load SAMpaigns') + '</div>'; return; }
    window._sampList = d;
    window._sampaignCampaignsCache = window._sampaignCampaignsCache || {};
    (d.campaigns || []).forEach(function (c) { window._sampaignCampaignsCache[c.id] = c; });
    if (viewing === 'active') { try { var swept = await _sweepOrphanFupTasks((d.campaigns || []).map(function (c) { return c.id; })); if (swept) showToast('Cleared ' + _spPlural(swept, 'follow-up task') + ' from deleted SAMpaigns'); } catch (e) {} }
    _spRenderToolbar(d);
    _spRenderRows();
    _sampLoadHome();
  } catch (e) { el.innerHTML = '<div class="sp-empty sp-r">Error: ' + esc(e.message) + '</div>'; }
}
function _spRenderToolbar(d) {
  var bar = document.getElementById('sampaignListToolbar'); if (!bar) return;
  var f = window._sampaignOwnerFilter || 'all', v = window._sampaignView || 'active';
  var owners = d.owners || [];
  var people = owners.length > 1 ? '<div class="sp-seg" style="position:relative" aria-label="Whose SAMpaigns">' +
      '<button type="button" class="' + (f === 'mine' ? 'on' : '') + '" onclick="setSampaignOwnerFilter(\'mine\')">Mine</button>' +
      '<button type="button" class="' + (f === 'all' ? 'on' : '') + '" onclick="setSampaignOwnerFilter(\'all\')">Everyone</button>' +
      '<button type="button" id="sampaignPeopleBtn" class="' + (f === 'pick' ? 'on' : '') + '" onclick="toggleSampaignPeopleMenu(event)" aria-haspopup="true">People' + (f === 'pick' ? ' ' + (window._sampaignPicked || []).length : '') + '</button>' +
      '<div class="sp-menu" id="sampaignPeopleMenu" style="display:' + (window._sampaignPeopleMenuOpen ? 'block' : 'none') + '">' +
        owners.map(function (o) { var on = (window._sampaignPicked || []).indexOf(o.user_id) !== -1; return '<label><input type="checkbox" ' + (on ? 'checked ' : '') + 'onchange="toggleSampaignPicked(\'' + esc(o.user_id) + '\', this.checked)">' + esc(o.name || o.email) + '</label>'; }).join('') +
      '</div></div>' : '';
  bar.innerHTML =
    '<div class="sp-seg" aria-label="Active or archived"><button type="button" class="' + (v === 'active' ? 'on' : '') + '" onclick="setSampaignView(\'active\')">Active ' + ((d.counts && d.counts.active) || 0) + '</button><button type="button" class="' + (v === 'archived' ? 'on' : '') + '" onclick="setSampaignView(\'archived\')">Archived ' + ((d.counts && d.counts.archived) || 0) + '</button></div>' +
    people +
    '<div class="sp-seg" aria-label="Channel"><button type="button" class="' + (window._spChan === 'li' ? '' : 'on') + '" onclick="window._spChan=\'all\';_spRenderToolbar(window._sampList||{});_spRenderRows()">All channels</button><button type="button" class="' + (window._spChan === 'li' ? 'on' : '') + '" onclick="window._spChan=\'li\';_spRenderToolbar(window._sampList||{});_spRenderRows()">With LinkedIn</button></div>' +
    '<input class="sp-search" type="search" id="sampSearch" aria-label="Search SAMpaigns" placeholder="Search a SAMpaign or owner" value="' + esc(window._sampSearch || '') + '" oninput="window._sampSearch=this.value;_spRenderRows()">';
}
function _spNextLine(c) {
  var s = c.stats || {}, q = c.queue || {};
  var sched = (c.followup_schedule || []).slice().sort(function (a, b) { return String(a.next_due).localeCompare(String(b.next_due)); })[0];
  if (c.archived) return 'Archived. Nothing sends.';
  if (c.paused) return 'Paused. Queued emails are back in drafts until you schedule them again.';
  if (!s.total) return 'Add people to get started';
  if (q.drafts) return _spPlural(q.drafts, 'draft') + ' ready for review';
  if (q.failed) return _spPlural(q.failed, 'email') + ' could not be sent. Open to see why';
  if (q.pending) return _spPlural(q.pending, 'email') + ' scheduled, next on ' + _spDate(q.next_send, true);
  if (sched && new Date(sched.next_due).getTime() < Date.now() - 86400000) return _spWave(sched.stage + 1) + ' overdue since ' + _spDate(sched.next_due) + ', ' + _spPlural(sched.count, 'person', 'people');
  if (sched) return _spWave(sched.stage + 1) + ' due ' + _spDate(sched.next_due) + ' for ' + _spPlural(sched.count, 'person', 'people');
  if (!s.sent) return 'Write the first emails';
  return 'All emails sent. Waiting for replies';
}
function _spRenderRows() {
  var el = document.getElementById('sampaignCampaignsList'); var d = window._sampList; if (!el || !d) return;
  var q = String(window._sampSearch || '').trim().toLowerCase();
  var all = (d.campaigns || []).filter(function (c) { return _sampaignOwnerAdmits(c.owner_user_id); })
    .filter(function (c) { return !q || (c.name + ' ' + (c.owner_email || '') + ' ' + (c.focus || '')).toLowerCase().indexOf(q) !== -1; })
    .filter(function (c) { return window._spChan !== 'li' || !!(c.channels && c.channels.linkedin && c.channels.linkedin.on); });
  if (!all.length) {
    var why = window._sampaignView === 'archived' ? 'Nothing archived here.' : q ? 'No SAMpaign matches "' + esc(q) + '".' : (window._sampaignOwnerFilter === 'mine' ? 'You have no live SAMpaigns yet.' : 'No live SAMpaigns yet.');
    el.innerHTML = '<div class="sp-card sp-empty">' + why + (window._sampaignView !== 'archived' ? '<div style="margin-top:12px"><button class="g-btn sp-gold" type="button" onclick="toggleNewSampaignForm()">' + SP_ICON.plus + ' New SAMpaign</button></div>' : '') + '</div>';
    return;
  }
  el.innerHTML = all.map(function (c) {
    var s = c.stats || {}, tot = s.total || 0, q2 = c.queue || {};
    var rate = _spRate(s), replied = (s.replied || 0) + (s.opted_out || 0), interested = s.interested || 0;
    var w = function (n) { return tot ? Math.max(0, Math.round(n / tot * 1000) / 10) + '%' : '0%'; };
    var tone = rate === null ? 'sp-muted' : rate >= 12 ? 'sp-g' : rate >= 7 ? 'sp-a' : 'sp-r';
    var note = rate === null ? (s.sent ? 'too early to tell' : 'nothing sent yet') : rate >= 12 ? 'reply rate, above 12%' : rate >= 7 ? 'reply rate, around average' : 'reply rate, below average';
    var flags = [];
    if (c.paused) flags.push('<span class="sp-chip warn">Paused</span>');
    if (s.dead) flags.push('<span class="sp-chip risk">' + s.dead + ' bounced</span>');
    if (q2.failed) flags.push('<span class="sp-chip risk">' + q2.failed + ' failed</span>');
    if (q2.drafts) flags.push('<span class="sp-chip warn">' + q2.drafts + ' to review</span>');
    var owner = _spOwnerName(c.owner_email) || 'Someone';
    var acts = c.is_owner ? (window._sampaignView === 'archived'
        ? '<button class="g-btn sp-sm" type="button" onclick="event.stopPropagation();restoreSampaignCampaign(\'' + esc(c.id) + '\',\'' + esc(c.name).replace(/'/g, '&#39;') + '\')">Restore</button>' : '') : '';
    return '<div class="sp-row" role="link" tabindex="0" onclick="openSampaignDetail(\'' + esc(c.id) + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openSampaignDetail(\'' + esc(c.id) + '\')}">' +
      '<div><div class="sp-cn">' + esc(c.name) + '</div>' +
        '<div class="sp-cm"><span class="sp-av">' + esc(_spIni(c.owner_email)) + '</span>' + esc(owner) + (c.is_owner ? '' : ' · view only') + ' · ' + (c.scope === 'list' ? 'a list of companies' : 'one account') + (c.focus ? ' · ' + esc(c.focus) : '') + '</div>' +
        '<div class="sp-chips"><span class="sp-chip ' + (c.paused ? 'warn' : 'live') + '"><i></i>Email</span>' + (c.channels && c.channels.linkedin && c.channels.linkedin.on ? '<span class="sp-chip li"><i></i>LinkedIn</span>' : '') + flags.join('') + '</div></div>' +
      '<div>' + _g23MailLine(c) + _spLiCardLine(c) + '</div>' +
      '<div class="sp-rate"><div class="n ' + tone + '">' + (rate === null ? 'n/a' : rate + '%') + '</div><small>' + note + '</small></div>' +
      '<div class="sp-next">' + SP_ICON.arrow + '<span>' + esc(_spNextLine(c)) + '</span>' + (acts ? '<span class="sp-rowacts">' + acts + '</span>' : '') + '</div>' +
    '</div>';
  }).join('');
}

// ── Detail page ─────────────────────────────────────────────────────────────
var SP_TABS = [['overview', 'Overview'], ['people', 'People'], ['sequence', 'Sequence'], ['replies', 'Replies'], ['insights', 'Insights']];
function openSampaignDetail(campaignId, tab, filter) {
  var page = document.getElementById('sampDetailPage'); if (!page) return;
  window._sampOpenId = campaignId;
  window._sampTab = tab === 'contacts' ? 'people' : tab === 'queue' ? 'sequence' : tab === 'trend' ? 'insights' : (tab || 'overview');
  window._sampaignStatusFilter = filter || null;
  var id = esc(campaignId);
  page.innerHTML = '<button class="sp-back" type="button" onclick="sampBackToList()">' + SP_ICON.back + 'All SAMpaigns</button>' +
    '<div id="sampHeader_' + id + '"></div>' +
    '<div id="sampGuide_' + id + '"></div>' +
    '<div class="sp-tabs" data-hscroll role="tablist" id="sampTabs_' + id + '"></div>' +
    '<div id="sampBody_' + id + '"><div class="sp-empty">Loading…</div></div>';
  _spShow('detail');
  _spRenderHeader(campaignId);
  _renderSampTabs(campaignId);
  _sampLoadOverview(campaignId).then(function () { setSampTab(campaignId, window._sampTab); });
  // The composer and the contact roster read this cache; fill it up front.
  _sampPrimeContacts(campaignId);
}
function sampBackToList() {
  window._sampOpenId = null;
  _spShow('home');
  loadSampaignCampaigns();
}
async function _sampPrimeContacts(id) {
  try { var d = await _sampEdge('list_sampaign_contacts', { campaign_id: id }); if (d.ok) { window._sampaignContactsCache = window._sampaignContactsCache || {}; window._sampaignContactsCache[id] = d.contacts || []; } } catch (e) {}
}
async function _sampLoadOverview(id) {
  var d = await _sampEdge('get_sampaign_overview', { campaign_id: id });
  window._sampOv = window._sampOv || {};
  if (d.ok) {
    window._sampOv[id] = d;
    var c = (window._sampaignCampaignsCache || {})[id] || {};
    window._sampaignCampaignsCache = window._sampaignCampaignsCache || {};
    window._sampaignCampaignsCache[id] = Object.assign({}, c, { id: id, name: d.campaign.name, owner_email: d.campaign.owner_email, is_owner: d.campaign.is_owner, campaign_goal: d.campaign.campaign_goal, focus: d.campaign.focus, followup_dates: d.campaign.followup_dates });
  } else window._sampOv[id] = { ok: false, error: d.error };
  _spRenderHeader(id); _renderSampTabs(id);
  try { _spGuideRender(id); } catch (e) {}
  return d;
}
function _sampRefreshOpen() {
  var id = window._sampOpenId; if (!id || window._sampView !== 'detail') return;
  _sampLoadOverview(id).then(function () { if (window._sampTab !== 'people' && window._sampTab !== 'sequence') setSampTab(id, window._sampTab); else _spRenderSeqTop(id); });
}
function _spStatus(o) {
  var c = o.campaign;
  if (c.archived) return ['Archived', 'idle'];
  if (c.paused_at) return ['Paused', 'paused'];
  if (!o.counts.sent && !(o.waves || []).some(function (w) { return w.pending; })) return ['Not started', 'idle'];
  return ['Live', 'live'];
}
function _spRenderHeader(id) {
  var el = document.getElementById('sampHeader_' + id); if (!el) return;
  var o = (window._sampOv || {})[id];
  var cached = (window._sampaignCampaignsCache || {})[id] || {};
  if (!o || !o.ok) {
    el.innerHTML = '<div class="sp-head"><div><h1 class="sp-title">' + esc(cached.name || 'SAMpaign') + '</h1>' + (o && o.error ? '<div class="sp-sub sp-r">' + esc(o.error) + '</div>' : '') + '</div></div>';
    return;
  }
  var c = o.campaign, st = _spStatus(o), n = o.next || {};
  var owner = _spOwnerName(c.owner_email);
  var sub = [owner + (c.is_owner ? ' (you)' : ''), c.scope === 'list' ? 'a list of companies' : 'one account', _spPlural(o.counts.total, 'person', 'people'), c.created_at ? 'started ' + _spDate(c.created_at) : ''].filter(Boolean).join(' · ');
  var goal = o.goal ? '<div class="sp-sub" style="margin-top:8px"><b>Goal:</b> ' + (o.goal.target ? o.goal.current + ' of ' + o.goal.target + ' ' : o.goal.current + ' ') + ({ meetings: 'meetings booked', interested: 'interested replies', replies: 'replies' })[o.goal.metric] + '</div>' : '';
  var primary = '';
  if (c.is_owner && !c.archived) {
    if (n.kind === 'paused') primary = '<button class="g-btn sp-gold" type="button" onclick="sampPause(\'' + esc(id) + '\', false)">Resume</button>';
    else if (n.kind === 'review') primary = '<button class="g-btn sp-gold" type="button" onclick="setSampTab(\'' + esc(id) + '\',\'sequence\')">' + esc(n.label) + '</button>';
    else if (n.kind === 'write') primary = '<button class="g-btn sp-gold" type="button" onclick="sampWriteDrafts(\'' + esc(id) + '\',' + n.launch + ')">' + SP_ICON.spark + ' ' + esc(n.label) + '</button>';
  }
  var acts = c.is_owner && !c.archived
    ? (c.paused_at ? '' : '<button class="g-btn" type="button" onclick="sampPause(\'' + esc(id) + '\', true)">Pause</button>') +
      '<button class="g-btn" type="button" onclick="sampOpenEdit(\'' + esc(id) + '\')">Edit</button>' +
      '<button class="g-btn" type="button" onclick="syncSampaignCampaign(\'' + esc(id) + '\')" title="Check the mailbox for new replies now">Check replies</button>' + primary
    : '<span class="sp-chip">View only · syncs from ' + esc(owner || 'the owner') + '\'s mailbox</span>';
  acts += _g19ExportBtn(id);
  el.innerHTML = '<div class="sp-head"><div style="min-width:0;flex:1"><h1 class="sp-title">' + esc(c.name) + '<span class="sp-pill ' + st[1] + '"><i></i>' + st[0] + '</span></h1>' +
    '<div class="sp-sub">' + esc(sub) + '</div>' + goal + _spFailedBanner(id, o) +
    (c.campaign_goal ? '<p class="sp-goal clamp" id="sampGoal_' + esc(id) + '">' + esc(c.campaign_goal) + '</p>' + (c.campaign_goal.length > 180 ? '<button class="sp-back" style="margin:4px 0 0;font-weight:600;color:var(--c-accent-text)" type="button" onclick="var g=document.getElementById(\'sampGoal_' + esc(id) + '\');g.classList.toggle(\'clamp\');this.textContent=g.classList.contains(\'clamp\')?\'Read more\':\'Show less\'">Read more</button>' : '') : '') +
    '</div><div class="sp-acts">' + acts + '</div></div>';
}
function _renderSampTabs(id) {
  var el = document.getElementById('sampTabs_' + id); if (!el) return;
  var o = (window._sampOv || {})[id];
  var cnt = { people: o && o.ok ? o.counts.total : '', sequence: o && o.ok ? (o.waves || []).reduce(function (a, w) { return a + (w.draft || 0); }, 0) : 0, replies: o && o.ok ? (o.replies || []).filter(function (r) { return r.status === 'replied' || r.status === 'opted_out'; }).length : '' };
  el.innerHTML = SP_TABS.map(function (t) {
    var on = window._sampTab === t[0];
    var c = cnt[t[0]];
    var badge = t[0] === 'sequence' ? (c ? '<small class="hot">' + c + ' to review</small>' : '') : (c !== undefined && c !== '' ? '<small>' + c + '</small>' : '');
    return '<button type="button" role="tab" aria-selected="' + on + '" class="' + (on ? 'on' : '') + '" onclick="setSampTab(\'' + esc(id) + '\',\'' + t[0] + '\')">' + t[1] + badge + '</button>';
  }).join('');
}
function setSampTab(id, tab) {
  if (tab === 'contacts') tab = 'people'; else if (tab === 'queue') tab = 'sequence'; else if (tab === 'trend') tab = 'insights';
  window._sampTab = tab;
  _renderSampTabs(id);
  var body = document.getElementById('sampBody_' + id); if (!body) return;
  var o = (window._sampOv || {})[id];
  if (tab === 'people') {
    body.innerHTML = '';
    _spRenderPeople(id);
    return;
  }
  if (tab === 'sequence') {
    body.innerHTML = '<div id="sampSeqTop_' + esc(id) + '"></div><div class="sp-lbl" style="margin:6px 0 10px">Drafts and queue</div><div class="sp-card sp-pad" id="sampSendQueue"><div class="sp-small">Loading…</div></div>';
    _spRenderSeqTop(id);
    loadSampaignSendQueue(id);
    return;
  }
  if (!o || !o.ok) { body.innerHTML = '<div class="sp-card sp-empty">' + esc((o && o.error) || 'Loading…') + '</div>'; return; }
  if (tab === 'overview') body.innerHTML = _spOverviewHtml(id, o);
  else if (tab === 'replies') body.innerHTML = _spRepliesHtml(id, o);
  else if (tab === 'insights') body.innerHTML = _spInsightsHtml(id, o);
}

// Overview
function _spOverviewHtml(id, o) {
  var c = o.counts, r = o.rate, ch = o.channels, h = o.health;
  var take = (o.take || []).length
    ? '<ul>' + o.take.map(function (t) { return '<li class="' + esc(t.tone || '') + '"><b>' + esc(t.title) + '</b> ' + esc(t.text) + '</li>'; }).join('') + '</ul>'
    : '<p class="sp-small" style="margin:10px 0 0">SAM writes its take once a few emails have gone out.</p>';
  var conv = function (a, b) { return b > 0 ? Math.round(a / b * 100) + '%' : ''; };
  var tile = function (n, label, extra, cls) { return '<div class="sp-st' + (cls ? ' ' + cls : '') + '"><div class="n">' + n + '</div><small>' + label + '</small>' + (extra ? '<em>' + extra + '</em>' : '') + '</div>'; };
  var li = ch.linkedin || {};
  var act = (o.act_now || []).map(function (p) { return _spPersonRow(id, o, p, true); }).join('');
  var gaugePos = function (v) { return Math.max(0, Math.min(100, (v / 24) * 100)); };
  var waves = (o.waves || []);
  var tl = waves.map(function (w) {
    var done = w.sent > 0 && !w.pending && !w.draft, cls = done ? 'done' : '';
    var line = w.sent ? (w.first_sent ? _spDate(w.first_sent) + (w.last_sent && _spDate(w.last_sent) !== _spDate(w.first_sent) ? ' to ' + _spDate(w.last_sent) : '') + ' · ' : '') + w.sent + ' sent · ' + _spPlural(w.replies, 'reply', 'replies') : '';
    if (w.draft) line = _spPlural(w.draft, 'draft') + ' ready for review';
    else if (w.pending) line = (line ? line + ' · ' : '') + w.pending + ' scheduled from ' + _spDate(w.next_send, true);
    else if (!w.sent) line = w.planned_date ? 'Planned for ' + _spDate(w.planned_date) + (w.ready ? ' · ' + w.ready + ' ready' : '') : (w.ready ? w.ready + ' ready to write' : 'Not started');
    return '<div class="sp-tli ' + cls + '">' + esc(w.label) + '<small>' + esc(line) + '</small></div>' + (w.launch === 1 ? (li.status === 'live' ? '<div class="sp-tli li">LinkedIn invite with a note<small>' + (li.invited || 0) + ' invited · ' + (li.connected || 0) + ' accepted · ' + (li.replied || 0) + ' replied</small></div>' : '<div class="sp-tli soon">LinkedIn steps<small>Off for this SAMpaign' + (li.notes ? ' · ' + li.notes + ' notes written' : '') + '</small></div>') : '');
  }).join('');
  return '<div class="sp-ov"><div class="sp-col">' +
    '<section class="sp-card sp-pad sp-take"><div class="sp-lbl">SAM\'s take</div>' + take + '<div class="sp-small">From ' + _spPlural(c.sent, 'email') + ' sent and ' + _spPlural(c.replied, 'reply', 'replies') + ', as of ' + _spDate(o.as_of, true) + '.</div></section>' +
    '<section class="sp-card sp-pad"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div class="sp-lbl">Outcome by channel</div><span class="sp-small">A reply on any channel stops the rest for that person</span></div>' +
      '<div class="sp-track"><div class="sp-tk" style="color:var(--c-accent-text)">' + SP_ICON.mail + '<span style="color:var(--text)">Email</span></div>' + tile(c.sent, 'reached of ' + c.total) + tile('<span class="sp-g">' + c.replied + '</span>', 'replied', conv(c.replied, c.delivered)) + tile('<span class="sp-g">' + c.by_type.interested + '</span>', 'interested', conv(c.by_type.interested, c.replied)) + tile(c.meetings, c.meetings === 1 ? 'meeting booked' : 'meetings booked', conv(c.meetings, c.by_type.interested)) + '</div>' +
      '<div class="sp-track"><div class="sp-tk" style="color:var(--c-info)">' + SP_ICON.li + '<span style="color:var(--text)">LinkedIn</span>' + (li.status === 'live' ? '' : '<span class="sp-soon">Off</span>') + '</div>' + tile(li.notes || 0, 'notes written') + tile(li.invited || 0, 'invited', '', li.status === 'live' ? '' : 'dim') + tile(li.connected || 0, 'accepted', '', li.status === 'live' ? '' : 'dim') + tile(li.replied || 0, 'replied', '', li.status === 'live' ? '' : 'dim') + '</div>' +
    '</section>' +
    '<section class="sp-card sp-pad"><div class="sp-lbl">Act now' + ((o.act_now || []).length ? ' · ' + o.act_now.length : '') + '</div>' + (act || '<p class="sp-small" style="margin:10px 0 0">No replies waiting on you.</p>') + '</section>' +
  '</div><div class="sp-col">' +
    '<section class="sp-card sp-pad"><div class="sp-lbl">Reply rate</div>' +
      (r.reply_rate === null ? '<p class="sp-small" style="margin:10px 0 0">Shows once emails have been delivered.</p>' :
      '<div style="display:flex;align-items:baseline;gap:10px;margin-top:8px;flex-wrap:wrap"><span class="sp-big ' + (r.reply_rate >= 12 ? 'sp-g' : r.reply_rate >= 7 ? 'sp-a' : 'sp-r') + '">' + r.reply_rate + '%</span><span class="sp-muted">' + c.replied + ' of ' + c.delivered + ' delivered</span></div>' +
      '<div class="sp-gauge"><div class="sp-gm" style="left:' + gaugePos(r.reply_rate) + '%"><b>' + r.reply_rate + '%</b></div><span class="sp-gt" style="left:' + gaugePos(7) + '%">Average 7%</span><span class="sp-gt" style="left:' + gaugePos(12) + '%">Good 12%</span>' + (r.org_median !== null ? '<span class="sp-gt" style="left:' + gaugePos(r.org_median) + '%;top:-20px">Your org ' + r.org_median + '%</span>' : '') + '</div>' +
      '<div class="sp-small">Benchmarks for cold B2B email. "Your org" is the median of your organisation\'s SAMpaigns.</div>') +
    '</section>' +
    '<section class="sp-card sp-pad"><div class="sp-lbl">Sequence</div><div class="sp-tl">' + tl + '</div><button class="g-btn sp-sm" type="button" onclick="setSampTab(\'' + esc(id) + '\',\'sequence\')">Open the sequence</button></section>' +
    '<section class="sp-card sp-pad"><div class="sp-lbl">Health</div>' +
      '<div class="sp-hl" style="margin-top:6px"><span>Bounce rate</span><b class="' + (h.bounce_rate > 5 ? 'sp-r' : '') + '">' + (h.bounce_rate === null ? 'n/a' : h.bounce_rate + '%' + (h.bounce_rate > 5 ? ', check addresses' : '')) + '</b></div>' +
      '<div class="sp-hl"><span>Sending pace</span><b>' + (h.pace_per_day ? h.pace_per_day + ' a day of ' + h.cap + ' allowed' : 'Nothing scheduled') + '</b></div>' +
      '<div class="sp-hl"><span>Mailbox</span><b class="' + (h.mailbox_connected ? 'sp-g' : 'sp-r') + '">' + (h.mailbox_connected ? 'Connected' : 'Not connected') + '</b></div>' +
      '<div class="sp-hl"><span>Opted out</span><b>' + h.opted_out + '</b></div>' +
      (c.no_email ? '<div class="sp-hl"><span>Still need an email</span><b class="sp-a">' + c.no_email + '</b></div>' : '') +
    '</section>' +
  '</div></div>';
}
function _spPersonRow(id, o, p, compact) {
  var t = SP_TYPES[p.reply_type] || ['Replied', ''];
  var can = o.campaign.can_label && (p.status === 'replied' || p.status === 'opted_out');
  var when = p.via === 'linkedin' ? 'Replied on LinkedIn' + (p.linkedin_replied_at || p.replied_at ? ' · ' + _spAgo(p.linkedin_replied_at || p.replied_at) : '')
    : p.replied_at ? 'Replied to the ' + _spWave(p.replied_wave).toLowerCase() + ' · ' + _spAgo(p.replied_at) + (p.lag_days !== null && p.lag_days !== undefined ? ' · ' + (p.lag_days < 1 ? 'same day' : Math.round(p.lag_days) + (Math.round(p.lag_days) === 1 ? ' day' : ' days') + ' after') : '')
    : p.bounced_at ? 'Bounced · ' + _spAgo(p.bounced_at) : p.status === 'ooo' ? 'Away message, the sequence continues after it' : 'Replied before reply times were recorded';
  var opts = ['interested', 'referral', 'not_now', 'not_interested', 'other'].map(function (k) { return '<option value="' + k + '"' + (p.reply_type === k ? ' selected' : '') + '>' + SP_TYPES[k][0] + '</option>'; }).join('');
  var mail = o.campaign.is_owner && p.email ? '<a class="g-btn sp-sm' + (p.reply_type === 'interested' ? ' sp-gold' : '') + '" href="https://mail.google.com/mail/u/0/#search/' + encodeURIComponent('from:' + p.email) + '" target="_blank" rel="noopener">Open the reply</a>' : '';
  var meet = can ? (p.meeting_booked_at ? '<button class="g-btn sp-sm" type="button" onclick="sampMarkMeeting(\'' + esc(id) + '\',\'' + esc(p.contact_id) + '\',false)">Meeting booked ' + _spDate(p.meeting_booked_at) + ', undo</button>' : '<button class="g-btn sp-sm" type="button" onclick="sampMarkMeeting(\'' + esc(id) + '\',\'' + esc(p.contact_id) + '\',true)">Mark meeting booked</button>') : (p.meeting_booked_at ? '<span class="sp-chip int">Meeting booked</span>' : '');
  var label = can ? '<label class="sp-small" style="display:inline-flex;align-items:center;gap:6px">Label <select class="sp-sel" onchange="sampSetReply(\'' + esc(id) + '\',\'' + esc(p.contact_id) + '\',this.value)">' + opts + '</select></label>' : '';
  var liSam = o.campaign.is_owner && p.status === 'replied' && p.via === 'linkedin' && p.linkedin_url ? '<button class="g-btn sp-sm sp-gold" type="button" onclick="g27ReplyOne(\'' + esc(id) + '\',\'' + esc(p.contact_id) + '\',\'' + esc(String(p.name || '').replace(/'/g, '')) + '\',\'\',\'linkedin\')">Reply with SAM</button>' : '';
  var samBtn = liSam || (o.campaign.is_owner && p.email && p.status === 'replied' && p.via !== 'linkedin' && p.reply_type_source !== 'linkedin' && p.reply_type !== 'bounce') ? liSam || '<button class="g-btn sp-sm sp-gold" type="button" onclick="g27ReplyOne(\'' + esc(id) + '\',\'' + esc(p.contact_id) + '\',\'' + esc(String(p.name || '').replace(/'/g, '')) + '\',\'' + esc(p.email) + '\')">Reply with SAM</button>' : '';
  var liBtn = p.linkedin_url ? '<a class="g-btn sp-sm sp-ghost" href="' + esc(p.linkedin_url) + '" target="_blank" rel="noopener">LinkedIn</a>' : '';
  return '<div class="sp-pp"><span class="sp-av lg">' + esc(_spIni(p.name || p.email)) + '</span><div class="sp-pn"><b>' + esc(p.name || p.email) + '</b> <span class="sp-chip ' + t[1] + '">' + t[0] + (p.reply_type_source === 'human' ? '' : (p.reply_type && p.reply_type !== 'bounce' && p.reply_type !== 'ooo' && p.reply_type !== 'other' ? ' · by SAM' : '')) + '</span>' +
    '<small>' + esc([p.title, p.company].filter(Boolean).join(' · ')) + '</small><small>' + esc(when) + '</small>' +
    ((samBtn || mail || meet || label || liBtn) && p.status !== 'dead' && p.status !== 'ooo' ? '<div class="sp-pa">' + samBtn + mail + meet + label + liBtn + '</div>' : '') + '</div></div>';
}
async function sampSetReply(id, contactId, type) {
  var d = await _sampEdge('set_sampaign_reply', { contact_id: contactId, reply_type: type });
  if (!d.ok) { showToast(d.error || 'Could not save the label'); return; }
  showToast('Label saved');
  _sampRefreshOpen();
}
async function sampMarkMeeting(id, contactId, booked) {
  var d = await _sampEdge('mark_sampaign_meeting', { contact_id: contactId, booked: booked });
  if (!d.ok) { showToast(d.error || 'Could not save'); return; }
  showToast(booked ? 'Meeting recorded' : 'Meeting removed');
  _sampRefreshOpen();
}

// People: the existing roster, with quick filters on top
function _spPeopleChips(id) {
  var o = (window._sampOv || {})[id]; var c = o && o.ok ? o.counts : null;
  var f = window._sampaignStatusFilter || null, tab = (typeof _sampaignContactTab !== 'undefined') ? _sampaignContactTab : 'active';
  var b = function (key, label, n) { var on = key === 'prospective' ? (!f && tab === 'prospective') : key === 'all' ? (!f && tab !== 'prospective') : f === key; return '<button type="button" class="' + (on ? 'on' : '') + '" onclick="sampPeopleFilter(\'' + esc(id) + '\',\'' + key + '\')">' + label + (n !== null && n !== undefined ? '<b>' + n + '</b>' : '') + '</button>'; };
  return '<div class="sp-pf" id="sampPeopleChips_' + esc(id) + '">' + b('all', 'Reached', c ? c.sent : null) + b('replied', 'Replied', c ? c.replied : null) + b('sent', 'In sequence', null) + b('ooo', 'Away', c ? c.ooo : null) + b('dead', 'Bounced', c ? c.bounced : null) + b('prospective', 'Not reached', c ? c.not_reached : null) + '</div>';
}
function sampPeopleFilter(id, key) {
  if (key === 'prospective') { window._sampaignStatusFilter = null; try { _sampaignContactTab = 'prospective'; } catch (e) {} }
  else if (key === 'all') { window._sampaignStatusFilter = null; try { _sampaignContactTab = 'active'; } catch (e) {} }
  else { window._sampaignStatusFilter = key; }
  var chips = document.getElementById('sampPeopleChips_' + id);
  if (chips) chips.outerHTML = _spPeopleChips(id);
  _renderSampaignContacts(id);
}
// The old status filter also redrew the old overview; here it only filters.
function setSampaignStatusFilter(campaignId, status) {
  window._sampaignStatusFilter = (window._sampaignStatusFilter === status) ? null : status;
  _renderSampaignContacts(campaignId);
}

// Sequence: what each email did, what is next, and the mailbox calendar
function _spRenderSeqTopBase(id) {
  var box = document.getElementById('sampSeqTop_' + id); if (!box) return;
  var o = (window._sampOv || {})[id];
  if (!o || !o.ok) { box.innerHTML = ''; return; }
  var owner = o.campaign.is_owner && !o.campaign.archived;
  var totalReplies = (o.waves || []).reduce(function (a, w) { return a + w.replies; }, 0);
  var li = o.channels.linkedin || {};
  var steps = (o.waves || []).map(function (w) {
    var share = totalReplies ? Math.round(w.replies / totalReplies * 100) : 0;
    var bits = [];
    if (w.sent) bits.push(w.sent + ' sent' + (w.first_sent ? ' from ' + _spDate(w.first_sent) : ''));
    if (w.sent) bits.push(_spPlural(w.replies, 'reply', 'replies') + (w.bounces ? ', ' + w.bounces + ' bounced' : ''));
    if (w.pending) bits.push(w.pending + ' scheduled from ' + _spDate(w.next_send, true));
    if (!w.sent && !w.pending && w.planned_date) bits.push('planned for ' + _spDate(w.planned_date));
    if (w.retry) bits.push(w.retry + ' did not go out' + (w.failed_reason === 'mailbox' ? ': mailbox disconnected' : ''));
    else if (w.failed && !w.retry_waiting) bits.push(w.failed + ' failed');
    if (w.waiting_on && !w.sent && !w.pending) bits.push('waiting for ' + _spWave(w.launch - 1).toLowerCase() + ' to go out to ' + _spPlural(w.waiting_on, 'person', 'people'));
    var acts = '';
    if (owner) {
      if (w.draft) acts = '<button class="g-btn sp-sm sp-gold" type="button" onclick="sampReviewWave(\'' + esc(id) + '\',' + w.launch + ')">Review ' + w.draft + '</button><button class="g-btn sp-sm" type="button" onclick="planSampaignDrafts(\'' + esc(id) + '\',null,' + w.launch + ')">Schedule</button>';
      else if (w.ready && !w.pending) acts = '<button class="g-btn sp-sm sp-gold" type="button" onclick="sampWriteDrafts(\'' + esc(id) + '\',' + w.launch + ')">' + SP_ICON.spark + ' Write ' + w.ready + ' with SAM</button><button class="g-btn sp-sm" type="button" onclick="sampOpenComposer(\'' + esc(id) + '\',' + w.launch + ')">One email for all</button>';
      else if (w.sent || w.pending || w.retry) acts = '<button class="g-btn sp-sm" type="button" onclick="sampReviewWave(\'' + esc(id) + '\',' + w.launch + ')">See emails</button>';
      if (w.retry) acts = '<button class="g-btn sp-sm sp-gold" type="button" onclick="sampRetryFailed(\'' + esc(id) + '\',' + w.launch + ')">Send ' + w.retry + ' again</button>' + acts;
    }
    var row = '<div class="sp-step"><span class="sp-sn">' + SP_ICON.mail + '</span><div><div class="sp-sh">' + esc(w.label) + (w.draft ? ' <span class="sp-chip warn">' + w.draft + ' to review</span>' : '') + (w.launch > 1 ? ' <span class="sp-small">· same thread</span>' : '') + '</div>' +
      '<div class="sp-sm2">' + esc(bits.join(' · ') || (w.ready ? w.ready + ' ready to write' : 'Nobody is waiting for this email yet')) + '</div>' +
      (w.sent ? '<div class="sp-rb"><span style="width:' + share + '%"></span></div><div class="sp-sm2">' + share + '% of replies</div>' : '') + '</div><div class="sp-acts">' + acts + '</div></div>';
    if (w.launch === 1) row += '<div id="spLiSteps_' + esc(id) + '"></div>';
    return row;
  }).join('');
  var cal = o.calendar || { days: [], cap: 25 };
  var maxV = Math.max(cal.cap, 1) * 1.2;
  var bars = (cal.days || []).map(function (d) {
    var other = Math.max(0, d.all - d.mine);
    var lbl = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.dow] || '';
    return '<div class="sp-cb" title="' + esc(_spDate(d.date) + ': ' + d.mine + ' from this SAMpaign, ' + other + ' from others') + '"><div class="bars"><span class="o" style="height:' + Math.round(other / maxV * 100) + '%"></span><span class="m" style="height:' + Math.round(d.mine / maxV * 100) + '%"></span></div><small>' + lbl + '</small></div>';
  }).join('');
  box.innerHTML = '<div class="sp-wv"><section class="sp-card"><div class="sp-pad" style="padding-bottom:6px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div class="sp-lbl">Sequence · email and LinkedIn</div>' + (owner ? '<button class="g-btn sp-sm sp-ghost" type="button" onclick="spSeqEdit(\'' + esc(id) + '\')">Edit sequence</button>' : '') + '</div>' + steps + _g24Rules() + '</section>' +
    '<div class="sp-col">' + _g24MailCard(o, cal) + '<div id="spLiSender_' + esc(id) + '"></div></div></div>';
}
function _g24MailCard(o, cal) {
  var h = o.health || {};
  var chart = (cal.days || []).length ? _g24Chart(cal.days, { cap: cal.cap, capLabel: 'Limit ' + cal.cap, mine: function (d) { return d.mine; }, other: function (d) { return Math.max(0, d.all - d.mine); } }) : '<div class="g24-empty">Nothing scheduled from this mailbox yet.</div>';
  return '<section class="sp-card sp-pad g24-sc"><div class="g24-sch"><span class="g24-scl mail">' + G24_ICON.mail + 'Email · next 10 days</span></div>' +
    '<div class="g24-scs"><span class="li-dot ' + (h.mailbox_connected ? 'on' : '') + '"></span><b>' + (h.mailbox_connected ? 'Mailbox connected' : 'Mailbox not connected') + '</b>' + (h.pace_per_day ? ' · ' + h.pace_per_day + ' a day planned of ' + (h.cap || cal.cap) + ' allowed' : ' · nothing scheduled') + '</div>' +
    chart + '<div class="g24-leg"><span><i class="m"></i>This SAMpaign</span><span><i class="o"></i>Your other SAMpaigns</span><span class="g24-lf">A full day moves to the next free day</span></div></section>';
}
function sampReviewWave(id, launch) {
  window._sampLaunch = launch;
  loadSampaignSendQueue(id);
  var q = document.getElementById('sampSendQueue'); if (q) q.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function sampOpenComposer(id, launch) {
  window._sampComposerLaunch = launch || 1;
  openSampaignComposer(id);
  var sel = document.getElementById('sampSendLaunch');
  if (sel) { sel.value = String(launch || 1); try { _sampComposerLaunchChanged(id); } catch (e) {} }
}
function _sampSendableFor(all, launch) {
  launch = Number(launch) || 1;
  return (all || []).filter(function (x) {
    if (!x.email || /^scouted\./i.test(x.email) || /@linkedin\.invalid$/i.test(x.email)) return false;
    return launch === 1 ? x.status === 'not_contacted' : ['sent', 'opened', 'no_response', 'ooo'].indexOf(x.status) !== -1;
  });
}

// Write drafts with SAM, a few people at a time, with progress
async function sampWriteDrafts(id, launch) {
  if (window._sampWriting) return;
  window._sampWriting = true;
  var o = (window._sampOv || {})[id];
  var w = o && o.ok ? (o.waves || []).find(function (x) { return x.launch === launch; }) : null;
  var total = (w && w.ready) || 0;
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'sampWriteModal';
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Writing drafts"><h3>SAM is writing ' + esc(_spWave(launch).toLowerCase()) + '</h3><div class="sp-small" id="sampWriteMsg">Starting…</div><div class="sp-progress"><span id="sampWriteBar" style="width:4%"></span></div><div class="sp-small" style="margin-top:10px">One email per person, from their role and company: short paragraphs, the key points in bold, your signature. SAM checks each one and rewrites any that fall short. Nothing sends until you review and schedule.</div><div class="sp-foot"><span></span><button class="g-btn" type="button" id="sampWriteStop">Stop</button></div></div>';
  document.body.appendChild(m);
  var stop = false; document.getElementById('sampWriteStop').onclick = function () { stop = true; this.textContent = 'Stopping…'; };
  var written = 0, skip = [], err = null, guard = 0, paced = 0, rvAgg = { rewritten: 0 };
  var name = (currentUser && currentUser.user_metadata && currentUser.user_metadata.full_name) || '';
  try {
    while (!stop && guard++ < 40) {
      var d = await _sampEdge('write_sampaign_drafts', { campaign_id: id, launch: launch, batch: 6, skip_ids: skip, sender_name: name.split(' ')[0] || '', sender_full_name: name });
      if (d.ok && d.review) rvAgg.rewritten += d.review.rewritten || 0;
      if (!d.ok) {
        if (d.reason === 'quota' && !d.daily && paced++ < 8) { if (await _spPace(d.retry_after || 30, document.getElementById('sampWriteMsg'), function () { return stop; })) continue; break; }
        if (d.reason === 'overloaded' && paced++ < 4) { if (await _spPace(20, document.getElementById('sampWriteMsg'), function () { return stop; }, 'SAM is busy right now.')) continue; break; }
        err = d.error || 'Could not write drafts'; break;
      }
      written += d.written || 0;
      (d.missed || []).forEach(function (x) { skip.push(x); });
      var done = total ? Math.min(100, Math.round(written / total * 100)) : 100;
      var msg = document.getElementById('sampWriteMsg'); if (msg) msg.textContent = 'Written ' + written + (total ? ' of ' + total : '') + (d.remaining ? '…' : '.');
      var bar = document.getElementById('sampWriteBar'); if (bar) bar.style.width = Math.max(4, done) + '%';
      if (!d.remaining || (!d.written && !(d.missed || []).length)) break;
    }
  } catch (e) { err = e.message; }
  window._sampWriting = false;
  m.remove();
  if (err) {
    var mm = document.createElement('div'); mm.className = 'sp-modal';
    mm.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true"><h3>' + (written ? 'Wrote ' + written + ', then stopped' : 'SAM could not write these') + '</h3><p class="sp-muted" style="margin:6px 0 0">' + esc(err) + '</p><div class="sp-foot"><button class="g-btn" type="button" onclick="this.closest(\'.sp-modal\').remove()">Close</button><button class="g-btn sp-gold" type="button" onclick="this.closest(\'.sp-modal\').remove();sampOpenComposer(\'' + esc(id) + '\',' + launch + ')">Write one email for all</button></div></div>';
    document.body.appendChild(mm);
  } else showToast(_g18WroteMsg(written, rvAgg));
  await _sampLoadOverview(id);
  if (window._sampTab !== 'sequence') setSampTab(id, 'sequence'); else { _spRenderSeqTop(id); }
  window._sampLaunch = launch; loadSampaignSendQueue(id);
}

// Scheduling plan, shown in the app instead of a browser dialog
async function planSampaignDrafts(campaignId, startAt, launch) {
  launch = launch || window._sampLaunch || 1;
  var d = await _sampEdge('schedule_sampaign_drafts', { campaign_id: campaignId, start_at: startAt || null, launch: launch, dry_run: true });
  if (!d.ok) { showToast(d.error || 'Could not plan'); return; }
  var days = Object.keys(d.per_day || {}).sort();
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'sampPlanModal';
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Send plan"><h3>Schedule ' + _spPlural(d.scheduled || d.drafts || 0, 'email') + '</h3>' +
    '<div class="sp-muted" style="font-size:13.5px">' + esc(_spWave(launch)) + ' over ' + _spPlural(d.days || days.length, 'day') + ', first ' + esc(_spDate(d.first_send, true)) + ', last ' + esc(_spDate(d.last_send, true)) + '.</div>' +
    '<div class="sp-days">' + days.map(function (k) { return '<div class="sp-day"><span>' + esc(new Date(k + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })) + '</span><b>' + d.per_day[k] + '</b></div>'; }).join('') + '</div>' +
    '<div class="sp-small" style="margin-top:12px">Today this mailbox can send ' + (d.today_limit || (d.policy && d.policy.daily_cap) || '') + ' (' + esc(d.ramp_reason || 'current limit') + '). ' +
      (d.policy ? 'Sending between ' + d.policy.window_start_hour + ':00 and ' + d.policy.window_end_hour + ':00' + (d.policy.skip_weekends ? ', weekdays only' : '') + '. ' : '') +
      (d.late ? 'This was planned for ' + esc(_spDate(d.planned_for)) + ', which has passed, so it starts at the next free slot. ' : d.rolled ? 'The day you picked is already full, so this starts on the next free day. ' : '') + 'Spacing sends out is what keeps the mailbox out of spam.</div>' +
    '<div class="sp-foot"><button class="g-btn" type="button" onclick="document.getElementById(\'sampPlanModal\').remove()">Not yet</button><button class="g-btn sp-gold" type="button" id="sampPlanGo">Schedule</button></div></div>';
  document.body.appendChild(m);
  document.getElementById('sampPlanGo').onclick = async function () {
    this.disabled = true; this.textContent = 'Scheduling…';
    var d2 = await _sampEdge('schedule_sampaign_drafts', { campaign_id: campaignId, start_at: startAt || null, launch: launch, allow_roll: !!d.rolled });
    m.remove();
    if (!d2.ok) { showToast(d2.error || 'Could not schedule'); return; }
    showToast('Scheduled ' + d2.scheduled + ' over ' + _spPlural(d2.days, 'day'));
    loadSampaignSendQueue(campaignId);
    if (window._sampOpenId === campaignId) _sampRefreshOpen();
  };
}

// Pause and resume
async function sampPause(id, pause) {
  var d = await _sampEdge('pause_sampaign', { campaign_id: id, paused: pause });
  if (!d.ok) { showToast(d.error || 'Could not change this'); return; }
  if (pause) showToast('Paused.' + (d.moved_to_drafts ? ' ' + _spPlural(d.moved_to_drafts, 'queued email') + ' moved back to drafts.' : ' Nothing was queued.'));
  else showToast(d.drafts ? 'Resumed. Schedule the ' + _spPlural(d.drafts, 'draft') + ' when ready.' : 'Resumed.');
  await _sampLoadOverview(id);
  setSampTab(id, pause ? window._sampTab : (d.drafts ? 'sequence' : window._sampTab));
}

// Edit: name, goal, focus, goal measure and follow-up dates
function sampOpenEdit(id) {
  var o = (window._sampOv || {})[id]; if (!o || !o.ok) return;
  var c = o.campaign;
  var dates = (c.followup_dates || []).slice();
  window._sampEditDates = dates;
  var m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'sampEditModal';
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  m.innerHTML = '<div class="sp-mcard" role="dialog" aria-modal="true" aria-label="Edit SAMpaign"><h3>Edit SAMpaign</h3>' +
    '<label class="sp-fld">Name<input id="spEdName" value="' + esc(c.name) + '"></label>' +
    '<label class="sp-fld">Goal<textarea id="spEdGoal">' + esc(c.campaign_goal || '') + '</textarea></label>' +
    '<label class="sp-fld">Focus, shown on the card<input id="spEdFocus" maxlength="48" value="' + esc(c.focus || '') + '"></label>' +
    '<div class="sp-row2"><label class="sp-fld">Success is measured in<select id="spEdMetric"><option value="">Not set</option><option value="meetings"' + (c.goal_metric === 'meetings' ? ' selected' : '') + '>Meetings booked</option><option value="interested"' + (c.goal_metric === 'interested' ? ' selected' : '') + '>Interested replies</option><option value="replies"' + (c.goal_metric === 'replies' ? ' selected' : '') + '>Replies</option></select></label>' +
      '<label class="sp-fld">Target<input id="spEdTarget" type="number" min="1" value="' + esc(c.goal_target || '') + '"></label></div>' +
    '<div class="sp-fld">Sequence<small>' + _spPlural(1 + (c.followup_dates || []).length, 'email') + ((o.channels && o.channels.linkedin && o.channels.linkedin.on) ? ' and LinkedIn steps' : '') + '. Order, days and LinkedIn steps.</small><div><button class="g-btn sp-sm" type="button" onclick="document.getElementById(\'sampEditModal\').remove();spSeqEdit(\'' + esc(id) + '\')">Edit sequence</button></div></div>' +
    '<div class="sp-foot"><button class="g-btn sp-ghost sp-r" type="button" onclick="document.getElementById(\'sampEditModal\').remove();deleteSampaignCampaign(\'' + esc(id) + '\',\'' + esc(c.name).replace(/'/g, '&#39;') + '\').then(function(){sampBackToList()})">Archive</button><span class="sp-acts"><button class="g-btn" type="button" onclick="document.getElementById(\'sampEditModal\').remove()">Cancel</button><button class="g-btn sp-gold" type="button" id="spEdSave">Save</button></span></div></div>';
  document.body.appendChild(m);
  _sampEditDatesRender();
  document.getElementById('spEdSave').onclick = async function () {
    var name = document.getElementById('spEdName').value.trim();
    if (!name) { showToast('Give it a name'); return; }
    var newDates = (window._sampEditDates || []).filter(Boolean).sort();
    var metric = document.getElementById('spEdMetric').value || null;
    var target = parseInt(document.getElementById('spEdTarget').value, 10) || null;
    this.disabled = true;
    var d = await _sampEdge('update_sampaign', { campaign_id: id, name: name, campaign_goal: document.getElementById('spEdGoal').value, focus: document.getElementById('spEdFocus').value, followup_dates: newDates, goal_metric: metric, goal_target: metric ? target : null });
    if (!d.ok) { this.disabled = false; showToast(d.error || 'Could not save'); return; }
    try { await _syncSampaignFupTasks(id, name, dates, newDates); } catch (e) {}
    m.remove(); showToast('Saved');
    await _sampLoadOverview(id); setSampTab(id, window._sampTab);
  };
}
function _sampEditDatesRender() {
  var box = document.getElementById('spEdDates'); if (!box) return;
  box.innerHTML = (window._sampEditDates || []).map(function (dt, i) {
    return '<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span class="sp-small" style="width:92px">Follow-up ' + (i + 1) + '</span><input type="date" value="' + esc(dt) + '" onchange="window._sampEditDates[' + i + ']=this.value" style="flex:1"><button class="sp-x" type="button" aria-label="Remove follow-up ' + (i + 1) + '" onclick="window._sampEditDates.splice(' + i + ',1);_sampEditDatesRender()">' + SP_ICON.x + '</button></div>';
  }).join('') || '<div class="sp-small" style="margin-top:6px">No follow-ups yet.</div>';
}
function sampEditAddDate() {
  var list = window._sampEditDates || (window._sampEditDates = []);
  var last = list.length ? new Date(list[list.length - 1] + 'T12:00:00') : new Date();
  last.setDate(last.getDate() + 5); while (last.getDay() === 0 || last.getDay() === 6) last.setDate(last.getDate() + 1);
  list.push(last.toISOString().slice(0, 10)); _sampEditDatesRender();
}

// Replies
function _spRepliesHtml(id, o) {
  var f = window._sampReplyFilter || 'all';
  var rows = o.replies || [];
  var cnt = function (k) { return rows.filter(function (r) { return r.reply_type === k; }).length; };
  var keys = [['all', 'All', rows.length], ['interested', 'Interested', cnt('interested')], ['referral', 'Referral', cnt('referral')], ['not_now', 'Not now', cnt('not_now')], ['not_interested', 'Not interested', cnt('not_interested')], ['other', 'To label', cnt('other')], ['ooo', 'Away', cnt('ooo')], ['bounce', 'Bounced', cnt('bounce')]];
  var chips = keys.filter(function (k) { return k[0] === 'all' || k[2]; }).map(function (k) { return '<button type="button" class="' + (f === k[0] ? 'on' : '') + '" onclick="window._sampReplyFilter=\'' + k[0] + '\';setSampTab(\'' + esc(id) + '\',\'replies\')">' + k[1] + '<b>' + k[2] + '</b></button>'; }).join('');
  var list = rows.filter(function (r) { return f === 'all' || r.reply_type === f; });
  return '<div class="sp-bar" style="justify-content:space-between"><div class="sp-pf" style="margin:0">' + chips + '</div><span class="sp-small">SAM labels each reply from its opening lines. Change any label; the text stays in the mailbox.</span></div>' +
    '<section class="sp-card" style="padding:4px 18px">' + (list.length ? list.map(function (p) { return _spPersonRow(id, o, p); }).join('') : '<div class="sp-empty">No replies here yet.</div>') + '</section>';
}

// Insights
