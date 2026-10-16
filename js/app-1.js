let SB_URL = localStorage.getItem('dt-sb-url') || 'https://gowpuicpmrwsohongosf.supabase.co';
let SB_KEY = localStorage.getItem('dt-sb-key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvd3B1aWNwbXJ3c29ob25nb3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTExMDgsImV4cCI6MjA5NTk2NzEwOH0.35CjODxyxOjAKp-xBOBx4oAXO_qjLyVttVaJEhp7YEg';
let API_KEY = localStorage.getItem('dt-api-key') || '';
var _userHabits = null;
// Cache buster — update this string on every deploy to purge stale service worker cache
var APP_VERSION = '20261018-01';

// ── Money in the org's own currency (2026-10-04) ───────────────────────────
// Amounts are stored in USD (deal_value_usd) and shown in the org's currency
// at today's rate from get_org_config. INR reads in lakh and crore.
var CUR_SYM = { USD: '$', INR: '\u20b9', EUR: '\u20ac', GBP: '\u00a3', AED: 'AED ', SGD: 'S$', AUD: 'A$', CAD: 'C$', JPY: '\u00a5', SAR: 'SAR ', MYR: 'RM ', IDR: 'Rp ', THB: '\u0e3f', ZAR: 'R ', NZD: 'NZ$', CHF: 'CHF ' };
function fmtMoneyIn(amount, cur) {
  cur = String(cur || 'USD').toUpperCase();
  var n = Number(amount);
  if (amount == null || !isFinite(n)) return '';
  var a = Math.abs(n), sign = n < 0 ? '-' : '';
  var one = function (x) { var r = Math.round(x * 10) / 10; return r % 1 === 0 ? String(r) : r.toFixed(1); };
  var sym = CUR_SYM[cur] || (cur + ' ');
  if (cur === 'INR') {
    if (a >= 1e7) return sign + sym + one(a / 1e7) + 'Cr';
    if (a >= 1e5) return sign + sym + one(a / 1e5) + 'L';
    if (a >= 1e3) return sign + sym + one(a / 1e3) + 'K';
    return sign + sym + Math.round(a);
  }
  if (a >= 1e9) return sign + sym + one(a / 1e9) + 'B';
  if (a >= 1e6) return sign + sym + one(a / 1e6) + 'M';
  if (a >= 1e3) return sign + sym + one(a / 1e3) + 'K';
  return sign + sym + Math.round(a);
}
function orgCur() { return String((window._orgConfig && window._orgConfig.defaultCurrency) || 'USD').toUpperCase(); }
function orgUsdRate() { var r = Number(window._orgConfig && window._orgConfig.usdRate); return r > 0 ? r : 1; }
function fmtOrgMoney(usd) {
  if (usd == null || !isFinite(Number(usd))) return '';
  var c = orgCur();
  return fmtMoneyIn(c === 'USD' ? Number(usd) : Number(usd) * orgUsdRate(), c);
}
(function() {
  if (localStorage.getItem('app-sw-version') !== APP_VERSION && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      Promise.all(regs.map(function(r){ return r.unregister(); })).then(function() {
        if (window.caches) caches.keys().then(function(ks){ ks.forEach(function(k){ caches.delete(k); }); });
        localStorage.setItem('app-sw-version', APP_VERSION);
        window.location.reload(true);
      });
    });
  }
})();
// EDGE_FN_URL is derived from SB_URL, not hardcoded — previously this stayed
// fixed to one Supabase project regardless of what URL/key someone entered
// in the setup screen, so a second tenant could configure their own
// database but every signal/intelligence feature would still silently hit
// the original org's edge function. Now it always follows SB_URL, and
// updateSupaConfig() (where SB_URL changes after initial load) keeps it in sync.
let EDGE_FN_URL = SB_URL + '/functions/v1/sam-gmail-signals';
// Google OAuth Client ID is also per-tenant (each org should use its own
// Google Cloud project — see deployment notes) — overridable the same way.
let GOOGLE_CLIENT_ID_SAM = localStorage.getItem('dt-google-client-id') || '318545862958-fgv5rapqspaff680u8l6ul2kchkpu6ph.apps.googleusercontent.com';
// Microsoft is the same shape and was NOT wired up: connectOutlook() carried a
// hardcoded empty string, so the Connect Outlook button could only ever show
// its own setup alert. The edge function has read Graph for months, which made
// Outlook look supported. It was supported with no front door.
//
// Filled in once the Azure app registration exists. Overridable per tenant the
// same way Google is, because an enterprise customer will want the consent to
// come from an app registered in THEIR directory, not ours.
let MICROSOFT_CLIENT_ID_SAM = localStorage.getItem('dt-microsoft-client-id') || '716a27e9-658b-4760-a568-6e2eccdf51a9';
let currentUser = null;
let profile = null;
let allData = {};
let viewDate = dateKey(new Date());
let dpMonth = new Date();
let authMode = 'login';
let currentTab = 'today';
const MIN = 25;
const ROLES = { super_admin: 0, manager: 1, member: 2 };

function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function parseDate(k) { const [y,m,d] = k.split('-').map(Number); return new Date(y,m-1,d); }
function todayKey() { return dateKey(new Date()); }
function fmtDate(k) { return parseDate(k).toLocaleDateString('en-IN',{day:'numeric',month:'short'}); }
function dayData(k) {
  if (!allData[k]) allData[k] = {tasks:[],issues:[],wins:[],misses:[]};
  const d = allData[k];
  if (d.priorities && d.priorities.length && (!d.tasks || !d.tasks.length)) { d.tasks = d.priorities; delete d.priorities; }
  ['tasks','issues','wins','misses'].forEach(f => { if (!d[f]) d[f] = []; });
  return d;
}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function sbHeaders(token) {
  const h = { 'apikey': SB_KEY, 'Content-Type': 'application/json' };
  const t = token || currentUser?.token;
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
}
async function refreshToken() {
  if (!SB_URL || !currentUser?.refresh_token) return false;
  try {
    const r = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: currentUser.refresh_token })
    });
    const d = await r.json();
    if (d.access_token) {
      currentUser.token = d.access_token; currentUser.refresh_token = d.refresh_token;
      localStorage.setItem('dt-user', JSON.stringify(currentUser)); return true;
    }
  } catch(e) {}
  return false;
}
async function sbGet(path, token) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, { headers: sbHeaders(token) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPost(path, body, token) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    method: 'POST',
    headers: { ...sbHeaders(token), 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return null; }
}
async function sbPatch(path, body, token) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    method: 'PATCH',
    headers: { ...sbHeaders(token), 'Prefer': 'return=representation' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return null; }
}

let signupRole = 'sdr';
function pickSignupRole(r) {
  signupRole = r;
  ['sdr','ae'].forEach(role => {
    const btn = document.getElementById('rolePick' + role.toUpperCase());
    if (btn) {
      btn.style.borderColor = role === r ? 'var(--gold)' : 'var(--border)';
      btn.style.background = role === r ? 'rgba(var(--c-accent-rgb),0.1)' : 'var(--surface2)';
      btn.style.color = role === r ? 'var(--gold)' : 'var(--text2)';
    }
  });
}
function setMode(m) {
  // 'signup' no longer exists: anything asking for it gets the request form.
  if (m === 'signup') m = 'request';
  authMode = m;
  const req = m === 'request';
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', i === (req ? 1 : 0)));
  const btn = document.getElementById('authBtn');
  btn.textContent = req ? 'Request access' : 'Sign in';
  btn.disabled = false;
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('requestIntro', req); show('requestTop', req); show('requestFields', req);
  show('passwordBlock', !req); show('forgotRow', !req);
  show('signupFields', false);
  // Google and Microsoft sign in; they cannot create an account any more, so
  // they have no place on the request form, and hiding them keeps the form
  // on one screen.
  show('ssoGoogleBtn', !req); show('ssoMicrosoftBtn', !req); show('ssoOr', !req);
  const sub = document.querySelector('#authScreen .auth-sub'); if (sub) sub.style.display = req ? 'none' : '';
  const ttl = document.querySelector('#authScreen .auth-logo'); if (ttl) ttl.textContent = req ? 'Request access to SamoraOS' : 'Sign in to SamoraOS';
  const lbl = document.getElementById('aEmailLabel'); if (lbl) lbl.textContent = req ? 'Work email' : 'Email';
  showMsg('');
}

// Request access: saves the details and tells us. Creates no account.
async function submitAccessRequest() {
  const btn = document.getElementById('authBtn');
  const val = (id) => ((document.getElementById(id) || {}).value || '').trim();
  const body = {
    action: 'request_access',
    name: val('rqName'), email: val('aEmail'), company: val('rqCompany'),
    team_size: val('rqTeam'), phone: val('rqPhone'), message: val('rqMsg'),
    website: val('rqWebsite')
  };
  if (!body.name || !body.company || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
    showMsg('Please add your name, your work email and your company.', true); return;
  }
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SB_KEY, 'apikey': SB_KEY }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) { showMsg(d.error || 'Could not send that just now. Please try again in a minute.', true); btn.disabled = false; btn.textContent = 'Request access'; return; }
    showMsg('Thanks, ' + body.name.split(/\s+/)[0] + '. We have your request and will be in touch within one working day.', false);
    btn.textContent = 'Request sent';
    ['rqName','rqCompany','rqTeam','rqPhone','rqMsg'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
  } catch (e) {
    showMsg('Connection error: ' + e.message, true); btn.disabled = false; btn.textContent = 'Request access';
  }
}

// ── First sign-in with a temporary password ──────────────────────────────
function showSetPasswordScreen() {
  try { hideSplash(true); } catch (_e) {}
  showScreen('setPwScreen');
  const m = document.getElementById('spMsg'); if (m) { m.textContent = ''; m.className = 'msg'; }
  setTimeout(() => { const i = document.getElementById('spNew'); if (i) i.focus(); }, 50);
}
async function submitFirstPassword() {
  const p1 = (document.getElementById('spNew') || {}).value || '';
  const p2 = (document.getElementById('spNew2') || {}).value || '';
  const msg = document.getElementById('spMsg'); const btn = document.getElementById('spBtn');
  const say = (t, err) => { msg.textContent = t; msg.className = 'msg' + (err ? ' err' : ' ok'); };
  if (p1.length < 8) return say('Use at least 8 characters.', true);
  if (p1 !== p2) return say('The two passwords do not match.', true);
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', {
      method: 'PUT', headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: p1, data: { must_change_password: false } })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const t = d.msg || d.error_description || d.error || ('HTTP ' + r.status);
      say(/different/i.test(t) ? 'Choose a password different from the temporary one.' : 'Could not save: ' + t, true);
      btn.disabled = false; btn.textContent = 'Save and continue'; return;
    }
    delete currentUser.must_change;
    localStorage.setItem('dt-user', JSON.stringify(currentUser));
    btn.disabled = false; btn.textContent = 'Save and continue';
    await loadProfile();
    if (profile) launchApp(); else showScreen('authScreen');
  } catch (e) {
    say('Connection error: ' + e.message, true); btn.disabled = false; btn.textContent = 'Save and continue';
  }
}
function joinOrgRequestAccess() {
  const em = (currentUser && currentUser.email) || '';
  _pendingSsoUser = false;
  doLogout();
  setTimeout(() => { setMode('request'); const e = document.getElementById('aEmail'); if (e) e.value = em; }, 50);
}
function showMsg(msg, isErr) {
  const el = document.getElementById('authMsg');
  el.textContent = msg;
  el.className = 'msg' + (msg ? (isErr ? ' err' : ' ok') : '');
}
// ── SSO sign-in ───────────────────────────────────────────────────────────
// Signing in with the mailbox provider does two jobs at once: it authenticates
// the user AND grants the mail scopes, so there is no separate "now connect
// Gmail" step afterwards. That second step is the one people skip, which is
// why a new account can sit there producing nothing.
//
// Uses Supabase's OAuth endpoint, so the provider must be enabled in
// Supabase Auth first (Dashboard > Authentication > Providers) with the same
// client id/secret already used for the Gmail connection, and the scopes
// listed below added there. Until that is done these buttons will return a
// provider-not-enabled error rather than silently doing nothing.
const SSO_SCOPES = {
  // Sign in only proves who you are. Gmail and Calendar are connected
  // separately (connectGmail), on our own domain, so the sign in screen never
  // carries a restricted Google scope. The mail tokens this used to request
  // were stored and never used.
  google: 'openid email profile',
  // Supabase calls the Microsoft provider "azure".
  microsoft: 'openid email profile offline_access Mail.Read Mail.Send Calendars.ReadWrite User.Read'
};

// ── Which providers are actually turned on ─────────────────────────────────
// GoTrue publishes this at /auth/v1/settings: {"external":{"google":false,...}}
//
// We ASK, but we do not hide. The first version of this hid the buttons for
// disabled providers, which solved the wrong problem: it stopped the raw JSON
// error page, and in exchange made a feature you are in the middle of switching
// on look like it had been removed. Hiding a control gives the person no way to
// tell "not built" from "not configured" from "I broke it".
//
// So the buttons stay. Clicking one that is not enabled says so, in words, in
// place, and does not navigate anywhere.
var _ssoEnabled = null;

async function _loadSsoProviders() {
  if (!SB_URL || !SB_KEY) return;
  try {
    var r = await fetch(SB_URL + '/auth/v1/settings', { headers: { 'apikey': SB_KEY } });
    var d = await r.json();
    _ssoEnabled = (d && d.external) || {};
  } catch (_e) {
    // Could not ask. Leave everything enabled and let the click path handle it.
    _ssoEnabled = null;
  }
}

function ssoSignIn(which) {
  if (!SB_URL || !SB_KEY) { showMsg('Sign-in is not configured in this build.', true); return; }
  var key = which === 'microsoft' ? 'azure' : 'google';
  if (_ssoEnabled && !_ssoEnabled[key]) {
    // The whole point of the probe: say it here rather than navigating the
    // person off the app to a raw JSON page they cannot come back from.
    showMsg((which === 'microsoft' ? 'Microsoft' : 'Google') +
      ' sign-in is not switched on for this workspace yet. Sign in with your email and password below, or ask your admin to enable it in Supabase.', true);
    return;
  }
  const provider = which === 'microsoft' ? 'azure' : 'google';
  const scopes = SSO_SCOPES[which] || '';
  // Land back on the app root. Supabase returns the session in the URL
  // fragment, which the existing bootstrap picks up on load.
  const redirect = window.location.origin + window.location.pathname;
  const url = SB_URL + '/auth/v1/authorize'
    + '?provider=' + encodeURIComponent(provider)
    + '&redirect_to=' + encodeURIComponent(redirect)
    + '&scopes=' + encodeURIComponent(scopes)
    // Force a refresh token back from Google, otherwise the mail connection
    // silently expires in an hour and cannot be renewed.
    + (provider === 'google' ? '&access_type=offline&prompt=consent' : '');
  window.location.href = url;
}

async function doAuth() {
  // The request form has no password, so it must branch off before the
  // email-and-password check below.
  if (authMode === 'request' || authMode === 'signup') return submitAccessRequest();
  const email = document.getElementById('aEmail').value.trim();
  const pass = document.getElementById('aPass').value;
  if (!email || !pass) { showMsg('Please enter email and password.', true); return; }
  const btn = document.getElementById('authBtn');
  btn.disabled = true; btn.textContent = 'Please wait…';
  if (!SB_URL || !SB_KEY) { localAuth(email, pass); btn.disabled = false; btn.textContent = authMode === 'login' ? 'Sign in' : 'Create account'; return; }
  try {
    if (authMode === 'signup') {
      const p2 = document.getElementById('aPass2').value;
      if (pass !== p2) { showMsg('Passwords do not match.', true); btn.disabled=false; btn.textContent='Create account'; return; }
      const orgCode = document.getElementById('aOrgCode').value.trim().toUpperCase();
      const r = await fetch(SB_URL + '/auth/v1/signup', {
        method: 'POST', headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const d = await r.json();
      if (d.error || d.error_description) { showMsg(d.error_description || d.error, true); btn.disabled=false; btn.textContent='Create account'; return; }
      if (!d.access_token) { showMsg('Check your email to confirm your account, then sign in.', false); btn.disabled=false; btn.textContent='Create account'; return; }
      const signupUser = d.user || d;
      if (!signupUser?.id) { showMsg('Signup failed, please try again.', true); btn.disabled=false; btn.textContent='Create account'; return; }
      currentUser = { id: signupUser.id, email: signupUser.email || email, token: d.access_token, refresh_token: d.refresh_token };
      localStorage.setItem('dt-user', JSON.stringify(currentUser));
      await setupProfile(orgCode);
    } else {
      const r = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST', headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const d = await r.json();
      if (d.error || d.error_description) { showMsg(d.error_description || d.msg || 'Incorrect email or password.', true); btn.disabled=false; btn.textContent='Sign in'; return; }
      const signinUser = d.user || d;
      if (!signinUser?.id) { showMsg('Sign in failed, please try again.', true); btn.disabled=false; btn.textContent='Sign in'; return; }
      currentUser = { id: signinUser.id, email: signinUser.email || email, token: d.access_token, refresh_token: d.refresh_token };
      // Created from the admin panel with a temporary password: they choose
      // their own before anything else opens. Remembered locally so a reload
      // cannot skip it.
      if (signinUser.user_metadata && signinUser.user_metadata.must_change_password === true) currentUser.must_change = true;
      localStorage.setItem('dt-user', JSON.stringify(currentUser));
      if (currentUser.must_change) { btn.disabled = false; btn.textContent = 'Sign in'; showSetPasswordScreen(); return; }
      await loadProfile();
    }
    launchApp();
  } catch(e) {
    showMsg('Connection error: ' + e.message, true);
    btn.disabled=false; btn.textContent = authMode === 'login' ? 'Sign in' : 'Create account';
  }
}
function localAuth(email, pass) {
  if (authMode === 'signup') {
    const existing = localStorage.getItem('dt-local-' + email);
    if (existing) { showMsg('Account exists. Sign in instead.', true); return; }
    const orgCode = document.getElementById('aOrgCode').value.trim().toUpperCase();
    let role = 'super_admin', orgId, orgName = email.split('@')[1] || 'My Org';
    if (orgCode) {
      const orgs = JSON.parse(localStorage.getItem('dt-local-orgs') || '{}');
      if (orgs[orgCode]) { orgId = orgs[orgCode].id; orgName = orgs[orgCode].name; role = signupRole || 'sdr'; }
      else { showMsg('Org code not found. Creating new org.', false); orgId = 'org-' + Date.now(); }
    } else { orgId = 'org-' + Date.now(); }
    if (!orgCode || role === 'super_admin') {
      const newCode = 'ORG-' + Math.random().toString(36).substring(2,6).toUpperCase();
      const orgs = JSON.parse(localStorage.getItem('dt-local-orgs') || '{}');
      orgs[newCode] = { id: orgId, name: orgName, code: newCode };
      localStorage.setItem('dt-local-orgs', JSON.stringify(orgs));
      profile = { role: 'super_admin', org_id: orgId, org_code: newCode, org_name: orgName };
    } else { profile = { role, org_id: orgId, org_code: orgCode, org_name: orgName }; }
    const u = { id: 'local-' + Date.now(), email, pass };
    localStorage.setItem('dt-local-' + email, JSON.stringify(u));
    currentUser = { id: u.id, email };
    localStorage.setItem('dt-user', JSON.stringify(currentUser));
    localStorage.setItem('dt-profile-' + currentUser.id, JSON.stringify(profile));
    launchApp();
  } else {
    const stored = localStorage.getItem('dt-local-' + email);
    if (!stored) { showMsg('No account found. Create one first.', true); return; }
    const u = JSON.parse(stored);
    if (u.pass !== pass) { showMsg('Incorrect password.', true); return; }
    currentUser = { id: u.id, email };
    const p = localStorage.getItem('dt-profile-' + currentUser.id);
    profile = p ? JSON.parse(p) : { role: 'member', org_id: 'local', org_code: '—', org_name: 'Local' };
    localStorage.setItem('dt-user', JSON.stringify(currentUser));
    launchApp();
  }
}
async function setupProfile(orgCode) {
  let role = 'super_admin', orgId, orgName, finalCode;
  if (orgCode) {
    try {
      const r = await fetch(SB_URL + '/rest/v1/organisations?org_code=eq.' + encodeURIComponent(orgCode) + '&select=id,name,org_code&limit=1', {
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
      });
      const rows = await r.json();
      if (rows && rows.length) { orgId = rows[0].id; orgName = rows[0].name; finalCode = rows[0].org_code; role = signupRole || 'sdr'; }
      else { showMsg('Org code not found. Please check and try again.', true); throw new Error('Org code not found'); }
    } catch(e) { if (e.message === 'Org code not found') throw e; showMsg('Could not verify org code: ' + e.message, true); throw e; }
  } else {
    finalCode = 'ORG-' + Math.random().toString(36).substring(2,6).toUpperCase();
    orgName = currentUser.email.split('@')[1] || 'My Organisation';
    try {
      const res = await sbPost('organisations', { org_code: finalCode, name: orgName, owner_id: currentUser.id });
      orgId = Array.isArray(res) ? res[0]?.id : res?.id;
      if (!orgId) throw new Error('no id returned');
      role = 'super_admin';
    } catch(e) { showMsg('Could not create org: ' + e.message, true); throw e; }
  }
  profile = { role, org_id: orgId, org_code: finalCode, org_name: orgName };
  try { await sbPost('user_profiles', { user_id: currentUser.id, email: currentUser.email, role, org_id: orgId }); }
  catch(e) { showMsg('Could not save profile: ' + e.message, true); throw e; }
  localStorage.setItem('dt-profile-' + currentUser.id, JSON.stringify(profile));
}
async function loadProfile() {
  if (!SB_URL) { const cached = localStorage.getItem('dt-profile-' + currentUser?.id); if (cached) profile = JSON.parse(cached); return; }
  try {
    const rows = await Promise.race([
      sbGet(`user_profiles?user_id=eq.${currentUser.id}&select=role,org_id,manager_id,is_active`),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    if (rows && rows.length) {
      const p = rows[0];
      // Removed from the org. The auth user is banned too, but a live session
      // would otherwise keep working until its token expired, so say plainly
      // what happened rather than letting them hit confusing partial failures.
      if (p.is_active === false) {
        localStorage.removeItem('dt-user');
        localStorage.removeItem('dt-profile-' + currentUser.id);
        currentUser = null; profile = null;
        try { hideSplash(true); } catch (_e) {}
        showScreen('authScreen');
        showMsg('Your access to this organisation has been removed. Contact your admin.', true);
        return;
      }
      const orgs = await sbGet(`organisations?id=eq.${p.org_id}&select=org_code,name&limit=1`);
      profile = { ...p, org_code: orgs?.[0]?.org_code || '—', org_name: orgs?.[0]?.name || 'Unknown' };
      try {
        const adm = await sbGet(`user_profiles?user_id=eq.${currentUser.id}&select=is_org_admin`);
        profile.is_org_admin = !!(adm && adm[0] && adm[0].is_org_admin);
      } catch (_e) { profile.is_org_admin = false; }
      localStorage.setItem('dt-profile-' + currentUser.id, JSON.stringify(profile));
    } else {
      // NO PROFILE. This is where SSO was dangerous.
      //
      // setupProfile('') CREATES A BRAND NEW ORGANISATION and makes the caller
      // its super_admin. That is right for someone who deliberately signed up
      // with a blank org code. It is badly wrong for someone who just clicked
      // "Continue with Google": their colleague's org already exists, and they
      // would land in a private org of one, see an empty pipeline, and have no
      // idea why.
      //
      // Password signup already asks for an org code. SSO never had the chance
      // to, so it is asked for here instead, after the fact.
      _pendingSsoUser = true;
      try { hideSplash(true); } catch (_e) {}
      _screen('joinOrgScreen');
      var jw = document.getElementById('joinWho');
      if (jw) jw.textContent = 'Signed in as ' + (currentUser.email || '');
      return;
    }
  } catch(e) { const cached = localStorage.getItem('dt-profile-' + currentUser?.id); if (cached) profile = JSON.parse(cached); }
  // get_org_config fires in background — never blocks launchApp
  try {
    fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_org_config'}) })
      .then(r=>r.json()).then(cfg=>{ if(cfg.ok){if(cfg.googleClientId)GOOGLE_CLIENT_ID_SAM=cfg.googleClientId;window._orgConfig=cfg;_applyDemoChip();try{_liCfgAt=Date.now();_liApplyLock();}catch(_e){}} }).catch(()=>{});
  } catch(e) {}
}
// ── Exactly one screen is visible, always ────────────────────────────────
// Five separate places were adding and removing .active by hand, so any path
// that added one without removing the other left BOTH mounted: the app on top
// and the login split-screen scrolled in underneath it. That is the glitch in
// the screenshot, and it is a whole class of bug rather than one bad line.
//
// Clearing every .screen before setting one makes the invariant structural
// instead of something each call site has to remember.
function showScreen(id) {
  var all = document.querySelectorAll('.screen');
  for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// Every path back to the sign-in screen goes through this. doAuth() disables
// the button and writes "Please wait…" into it, and nothing ever put it back:
// after signing out, the button stayed disabled with that text forever and the
// only way to sign in again was a hard refresh.
//
// The fix is not "reset it in doLogout". It is that the screen owns its own
// reset, so a future third route back here cannot reintroduce the same bug.
function _resetAuthForm() {
  var btn = document.getElementById('authBtn');
  if (btn) { btn.disabled = false; btn.textContent = (typeof authMode !== 'undefined' && authMode === 'signup') ? 'Create account' : 'Sign in'; }
  var msg = document.getElementById('authMsg'); if (msg) { msg.textContent = ''; }
  var pass = document.getElementById('aPass'); if (pass) pass.value = '';
  var pass2 = document.getElementById('aPass2'); if (pass2) pass2.value = '';
  var fr = document.getElementById('forgotRow');
  if (fr) fr.style.display = (typeof authMode !== 'undefined' && authMode === 'signup') ? 'none' : 'block';
}

async function doLogout() {
  // Revoke the session at Supabase, not just locally. Clearing localStorage
  // leaves the access token valid until it expires, which on a shared machine
  // means "Sign out" did not actually sign anything out.
  try {
    if (currentUser && currentUser.token && SB_URL) {
      await fetch(SB_URL + '/auth/v1/logout', {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token }
      });
    }
  } catch (_e) { /* offline: local clear below still happens */ }

  localStorage.removeItem('dt-user'); currentUser = null; profile = null; allData = {};
  // Habits are per-user server state — clear the in-memory copy so the next
  // user who signs in on this device fetches THEIR habits instead of seeing
  // (and accidentally saving over their profile with) the previous user's.
  _userHabits = null; _habitSuggestions = null;
  _resetAuthForm();
  showScreen('authScreen');
}

// ── Role hierarchy (matches edge function) ──────────────────────────────
// Tier 1: sdr, ae, member — frontline reps
// Tier 2: manager — sees direct reports
// Tier 3: director — sees cross-team
// Tier 4: executive — sees full org pipeline
// Tier 5: admin, super_admin — manages users/settings
function isRepRole(r) { return ['sdr','ae','member'].includes(r); }
function isSDR(r) { return r === 'sdr'; }
function isAE(r) { return r === 'ae' || r === 'member'; }
function canSeeTeam(r) { return ['manager','director','executive','admin','super_admin'].includes(r); }
function canSeeCrossTeam(r) { return ['director','executive','admin','super_admin'].includes(r); }
function canSeeFullOrg(r) { return ['executive','admin','super_admin'].includes(r); }
function canManageOrg(r) { return ['admin','super_admin'].includes(r); }
// Org admin is a SWITCH on top of a job role (2 Oct): a Director can be an
// admin too. Old admin and owner roles still count. Data visibility is NOT
// decided here, the server decides it from role and reporting line.
function _isOrgAdmin() { return !!profile && (profile.is_org_admin === true || ['admin','super_admin'].includes(profile.role)); }

// Header labels + role-gated nav visibility. Idempotent and network-free, so it
// can be re-applied cheaply after a background profile refresh without re-running
// the heavy launchApp (no duplicate sync badge / timers).
function _applyRoleChrome() {
  const role = profile?.role || 'member';
  const emailEl = document.getElementById('uEmail'); if (emailEl && currentUser) emailEl.textContent = currentUser.email;
  const rp = document.getElementById('uRole');
  const labels = { super_admin:'Admin', admin:'Admin', manager:'Manager', director:'Director', executive:'Executive', member:'Member', sdr:'SDR', ae:'AE' };
  const cls = { super_admin:'role-super', admin:'role-super', manager:'role-manager', director:'role-manager', executive:'role-manager', member:'role-member', sdr:'role-member', ae:'role-member' };
  if (rp) { rp.textContent = labels[role]; rp.className = 'role-pill ' + (cls[role]||'role-member'); }
  const orgEl = document.getElementById('uOrg'); if (orgEl) orgEl.textContent = profile?.org_name || '';
  const seniorRole = ['super_admin','admin','manager','director','executive'].includes(role);
  const navExec = document.getElementById('nav-exec');
  // Pipeline and SAMagic are one tab, Deals; customer signals (Intel) are on SAM.
  if (navExec) navExec.style.display = 'none';
  const navIntelBtn = document.getElementById('nav-intel');
  if (navIntelBtn) navIntelBtn.style.display = 'none';
}
// ── Needs attention + metric drill-downs ──────────────────────────────────
// Both read from these two caches, which are filled by the loaders that
// already fetch the data. Nothing here triggers a request, so the rail and
// the drill-downs cannot disagree with the numbers in the strip above them.
var _naAlerts = [], _naFeed = [];

function renderNeedsAttention() {
  var el = document.getElementById('needsAttention'); if (!el) return;
  // The count sits in the header so a collapsed rail still says how much is
  // behind it. A collapsed section that hides its own size is a trap.
  var _nc = document.getElementById('naCount');
  if (_nc) _nc.textContent = _naAlerts.length ? String(_naAlerts.length) : '';
  if (!_naAlerts.length) {
    el.innerHTML = '<div class="rail-empty">Nothing needs attention right now.</div>';
    return;
  }
  // Highest severity first, then whatever order the backend ranked them in.
  var rank = { high: 0, medium: 1, low: 2 };
  var sorted = _naAlerts.slice().sort(function(a, b) {
    return (rank[a.severity] == null ? 3 : rank[a.severity]) - (rank[b.severity] == null ? 3 : rank[b.severity]);
  });
  var sevLabel = { high: 'High', medium: 'Medium', low: 'Low' };
  el.innerHTML = sorted.slice(0, 6).map(function(a) {
    var sev = a.severity || 'low';
    return '<div class="na-row" onclick="toggleMetricDrill(\'alerts\')">' +
             '<div class="na-main">' +
               '<div class="na-name">' + esc(a.title || 'Account needs attention') + '</div>' +
               (a.detail ? '<div class="na-why">' + esc(a.detail) + '</div>' : '') +
             '</div>' +
             '<div class="na-sev ' + sev + '">' + (sevLabel[sev] || '') + '</div>' +
           '</div>';
  }).join('') +
  (sorted.length > 6
    ? '<div class="rail-empty" style="font-style:normal;cursor:pointer" onclick="toggleMetricDrill(\'alerts\')">' +
      'and ' + (sorted.length - 6) + ' more</div>'
    : '');
}

var _openDrill = null;
function toggleMetricDrill(which) {
  var host = document.getElementById('metricDrill'); if (!host) return;
  if (_openDrill === which) {   // second click closes
    _openDrill = null; host.classList.remove('on'); host.innerHTML = '';
    ['metricAlerts','metricWins'].forEach(function(id){ var e=document.getElementById(id); if(e) e.classList.remove('is-open'); });
    return;
  }
  _openDrill = which;
  ['metricAlerts','metricWins'].forEach(function(id){ var e=document.getElementById(id); if(e) e.classList.remove('is-open'); });
  var btn = document.getElementById(which === 'alerts' ? 'metricAlerts' : 'metricWins');
  if (btn) btn.classList.add('is-open');

  var title, rows;
  if (which === 'alerts') {
    title = 'All alerts';
    rows = _naAlerts.length ? _naAlerts.map(function(a) {
      var sev = a.severity || 'low';
      return '<div class="drill-row"><div style="flex:1;min-width:0">' + esc(a.title || '') +
             (a.detail ? '<div class="drill-why">' + esc(a.detail) + '</div>' : '') +
             '</div><div class="na-sev ' + sev + '">' + (sev === 'high' ? 'High' : sev === 'medium' ? 'Medium' : 'Low') + '</div></div>';
    }).join('') : '<div class="rail-empty">No active alerts.</div>';
  } else {
    title = 'Team wins, last 7 days';
    var wk = _naFeed.filter(_isThisWeek);
    rows = wk.length ? wk.map(function(f) {
      return '<div class="drill-row"><div style="flex:1;min-width:0">' + esc(f.title || '') +
             (f.body ? '<div class="drill-why">' + esc(f.body) + '</div>' : '') +
             '</div><div class="drill-when">' + _relDay(f.created_at) + '</div></div>';
    }).join('') : '<div class="rail-empty">No team wins logged this week.</div>';
  }
  host.innerHTML = '<div class="drill-head"><div class="drill-title">' + title + '</div>' +
    '<button class="drill-close" onclick="toggleMetricDrill(\'' + which + '\')">Close</button></div>' + rows;
  host.classList.add('on');
}

function _isThisWeek(f) {
  if (!f || !f.created_at) return false;
  var t = new Date(f.created_at).getTime();
  return !isNaN(t) && (Date.now() - t) <= 7 * 86400000;
}
function _relDay(iso) {
  var t = new Date(iso).getTime(); if (isNaN(t)) return '';
  var d = Math.floor((Date.now() - t) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + 'd ago';
}

// ── Today metric strip ────────────────────────────────────────────────────
// Each metric is written by whichever loader already owns that data, rather
// than the strip fetching everything itself. Open tasks are local so they
// paint immediately; alerts arrive with loadCoachingAlerts, pipeline and
// coverage with the pipeline summary, team wins with the feed. Nothing here
// adds a blocking call to the Today load, which was already the complaint.
function _setMetric(id, main, suffixHtml, positive) {
  var el = document.getElementById(id); if (!el) return;
  el.innerHTML = String(main) + (suffixHtml || '');
  el.classList.toggle('pos', !!positive);
}

function renderTodayMetrics() {
  try { if (document.getElementById('todayScore')) _scLoad(); } catch (_e) {}
  var d = dayData(viewDate);
  var open = (d.tasks || []).filter(function(t){ return !t.done && !t.carriedTo; }).length;
  _setMetric('mOpenTasks', open);
}

// Compact money. 1.28Cr and 18L read faster than 12,800,000 to an Indian
// sales team, and the unit rides small so the figure stays dominant.
function _fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return null;
  var n = Number(v);
  if (n >= 10000000) return { n: (n/10000000).toFixed(2).replace(/\.00$/,''), u: 'Cr' };
  if (n >= 100000)   return { n: (n/100000).toFixed(1).replace(/\.0$/,''),    u: 'L'  };
  if (n >= 1000)     return { n: Math.round(n/1000),                          u: 'K'  };
  return { n: Math.round(n), u: '' };
}

// Pulled once per Today load and cached, because the pipeline summary is the
// only figure here that needs a round trip of its own.
var _metricsPipelineCache = null;
async function loadTodayPipelineMetrics() {
  if (!SB_URL || !currentUser?.token) return;
  if (_metricsPipelineCache) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_pipeline' }) });
    var d = await r.json();
    _metricsPipelineCache = d;
    var s = (d && d.summary) || {};
    var m = _fmtMoneyShort(s.verified_value_usd);
    if (m) _setMetric('mVerified', m.n, m.u ? '<span class="unit">'+m.u+'</span>' : '');
    // ── ONE WORD, ONE MEANING ────────────────────────────────────────────
    //
    // THE BUG THIS FIXES. This tile said "Coverage 93%" while the Intel tab's
    // Relationship coverage panel said 0 strong, 5 partial, 7 thin out of 12.
    // Both were correct and they were measuring different things: this was
    // verified pipeline VALUE, that is stakeholder COVERAGE. Two definitions
    // of one word, side by side, is how a dashboard loses trust.
    //
    // Everywhere else in Samora, coverage means people: the Coverage check,
    // coverage gaps, relationship coverage. So this tile now means people too.
    // The verified-value number has not been lost, it is the tile immediately
    // to the left of this one, which is why showing it twice added nothing.
    try {
      // Same action and same rollup the Intel panel renders, so the two can
      // never disagree again. If that panel says 5 partial and 7 thin, this
      // tile is computed from those exact numbers.
      var cr = await fetch(EDGE_FN_URL, { method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body: JSON.stringify({ action:'get_relationship_coverage' }) });
      var cd = await cr.json();
      var ru = (cd && cd.rollup) || {};
      var strong = Number(ru.strong || 0), partial = Number(ru.partial || 0), thin = Number(ru.thin || 0);
      var totalAcc = strong + partial + thin;
      if (totalAcc > 0) {
        var covPct = Math.round(((strong + partial) / totalAcc) * 100);
        _setMetric('mCoverage', covPct, '<span class="unit">%</span>', covPct >= 60);
      }
    } catch (_e) { /* leave the dash rather than show the wrong definition */ }
  } catch (_e) { /* strip keeps its dash rather than showing a wrong number */ }
}

// ── Build marker ──────────────────────────────────────────────────────────
// Type SAMORA_BUILD in the console to see which frontend is actually loaded.
// Vercel serves js/app.js with revalidation now, but a stale browser cache or
// a deploy that did not land both look identical without this.
window.SAMORA_BUILD = {
  build: '2026-09-06-signal-hygiene',
  features: {
    orphan_followup_sweep: true,      // cancelled SAMpaigns stop asking for work
    auto_map_stakeholders: true,      // pane self-heals unmapped activity
    coverage_means_people: true,      // home tile matches the Intel panel
    digest_reports_delivered: true    // "Delivered to 1 of 6", not "sent to 6"
  }
};

// ── Splash control ────────────────────────────────────────────────────────
// Minimum 5s, then it stays as long as the load takes. Two full sweeps of the
// trace is the brand moment; the data being ready sooner does not cut it short.
//
// _splashFailsafe is not a cap on load time, it is a guard against a request
// that never settles at all. Without it a hung fetch leaves someone staring at
// a logo with no way forward, so at 25s the app is shown regardless and
// whatever data arrived is rendered. That is a stuck-state guard, not a
// deadline for a slow connection.
var _splashMin = 5000, _splashFailsafe = 25000;
var _splashShownAt = 0, _splashDone = false, _splashTimer = null, _splashDataReady = false;

function showSplash(note) {
  var el = document.getElementById('splashScreen'); if (!el) return;
  _splashShownAt = Date.now(); _splashDone = false; _splashDataReady = false;
  el.classList.remove('out'); el.classList.add('on');
  if (note) { var n = document.getElementById('splashNote'); if (n) n.textContent = note; }
  clearTimeout(_splashTimer);
  _splashTimer = setTimeout(function(){ hideSplash(true); }, _splashFailsafe);
}

// Called when the data lands. Does not dismiss on its own: if the 5s floor has
// not elapsed it just records that the load is done, and the floor timer
// dismisses when it expires.
function hideSplash(force) {
  if (_splashDone) return;
  var el = document.getElementById('splashScreen'); if (!el) return;
  _splashDataReady = true;
  var waited = Date.now() - _splashShownAt;
  if (!force && waited < _splashMin) {
    clearTimeout(_splashTimer);
    _splashTimer = setTimeout(function(){ hideSplash(true); }, _splashMin - waited);
    return;
  }
  _splashDone = true; clearTimeout(_splashTimer);
  el.classList.add('out');
  setTimeout(function(){ el.classList.remove('on'); }, 450);
}

// ── Used days (adoption, never billing) ──────────────────────────────────────
// Marks today as a day this person used SamoraOS, once per India-time day,
// on launch and whenever the app comes back to the foreground. Fire and
// forget: a failed mark must never get in the way of the app.
function _markActiveToday() {
  try {
    if (!currentUser || !currentUser.token || !SB_URL || !SB_KEY) return;
    var day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    var key = 'samora-active-' + currentUser.id;
    try { if (localStorage.getItem(key) === day) return; } catch (_e) {}
    fetch(SB_URL + '/rest/v1/rpc/mark_active', {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_source: 'app' })
    }).then(function (r) { if (r.ok) { try { localStorage.setItem(key, day); } catch (_e) {} } }).catch(function () {});
  } catch (_e) {}
}
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') _markActiveToday(); });

function launchApp() {
  showSplash('Loading your pipeline, SAMpaigns and signals…');
  _markActiveToday();
  showScreen('appScreen');
  const role = profile?.role || 'member';
  _applyRoleChrome();
  try { _renderRailMe(); } catch (e) {}
  // Every sign-in lands on Today. Sign out lives in the You tab and signing
  // out does not reload the page (nor does an installed PWA), so the You panel
  // stayed active and the next sign-in opened on You instead of Today.
  _landOnToday();
  // An unwired helper is the same as no helper. Both read the DOM that
  // launchApp has just made visible, so they run here rather than at parse
  // time when #appScreen is still hidden and widths measure as zero.
  _restoreNeedsAttentionState();
  _wireMetricScrollHint();
  // Load ICP definition for admin users (once, on launch)
  if (['super_admin','admin','manager','director','executive'].includes(role)) {
    setTimeout(loadIcpDefinition, 2000);
  }
  loadLocal(); runCarryOver();
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const todayNav = document.getElementById('nav-today'); if (todayNav) todayNav.classList.add('active');
  _lastCalDate = null;
  renderToday();    // runs first — sets section visibility immediately from local data
  renderCalStrip(); // calendar strip from local data
  render();         // full render pass

  // Sync indicator
  var syncBadge = document.createElement('div');
  syncBadge.id = 'global-sync-badge';
  syncBadge.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:4px 12px;font-size:11px;color:var(--text3);font-family:var(--sans);z-index:9998;opacity:0;transition:opacity 0.3s;pointer-events:none';
  syncBadge.textContent = '↻ Syncing…';
  document.body.appendChild(syncBadge);
  requestAnimationFrame(function(){ syncBadge.style.opacity='1'; });
  // Sync calendar events and scan OOO mails into today's task suggestions
  setTimeout(function() {
    if (currentUser?.token) {
      syncCalendarTasks(false);
      processOooMails();  // runs silently, adds tasks to future dates, shows banner if found
    }
    refreshYouTabConnections();
  }, 1500);
  setTimeout(initSortable, 200);
  // Local-only build has nothing to fetch, so the splash is purely the draw.
  if (!(SB_URL && SB_KEY)) hideSplash();
  if (SB_URL && SB_KEY) {
    syncDown().then(() => {
      runCarryOver(); _lastCalDate = null; render(); renderCalStrip();
      reconcileCalendarTasks();   // auto-carry tasks whose meetings moved/cancelled
      var badge = document.getElementById('global-sync-badge');
      if (badge) { badge.style.opacity = '0'; setTimeout(function(){ badge.remove(); }, 400); }
      hideSplash();   // real data is in and rendered
    }).catch(function() {
      // syncDown failed — still hide the badge and keep local data visible
      hideSplash(true);   // do not hold the logo open on a failed sync
      var badge = document.getElementById('global-sync-badge');
 if (badge) { badge.textContent = 'Offline: showing local data'; setTimeout(function(){ badge.style.opacity='0'; setTimeout(function(){badge.remove();},400); }, 2000); }
    });
  }
}

function loadLocal() { try { const r = localStorage.getItem('dt-v4-'+currentUser?.id); if (r) allData = JSON.parse(r); } catch(e) {} }
function saveLocal() { try { localStorage.setItem('dt-v4-'+currentUser?.id, JSON.stringify(allData)); } catch(e) {} }

async function save(k) {
  const payload = { user_id: currentUser.id, org_id: profile?.org_id, day_key: k, data: dayData(k) };
  saveLocal();
  if (!SB_URL || !currentUser?.token || !profile?.org_id) return;
  try {
    const check = await fetch(SB_URL + '/rest/v1/daytrack?user_id=eq.' + currentUser.id + '&day_key=eq.' + k + '&select=id', {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token }
    });
    const existing = await check.json();
    if (existing && existing.length > 0) {
      await fetch(SB_URL + '/rest/v1/daytrack?user_id=eq.' + currentUser.id + '&day_key=eq.' + k, {
        method: 'PATCH',
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dayData(k), org_id: profile.org_id })
      });
    } else {
      await fetch(SB_URL + '/rest/v1/daytrack', {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
  } catch(e) { console.error('Save error:', e); }
}
async function syncDown() {
  if (!SB_URL || !currentUser?.token) return;
  try {
    // 8-second timeout — if Supabase doesn't respond, don't block the UI
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(SB_URL + '/rest/v1/daytrack?user_id=eq.' + currentUser.id + '&select=day_key,data', {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token },
      signal: controller.signal
    });
    clearTimeout(timer);
    const rows = await r.json();
    if (Array.isArray(rows)) {
      rows.forEach(row => {
        const d = row.data || {};
        if (d.priorities && d.priorities.length && (!d.tasks || !d.tasks.length)) { d.tasks = d.priorities; delete d.priorities; }
        const local = allData[row.day_key];
        if ((d.tasks?.length||0) >= (local?.tasks?.length||0)) allData[row.day_key] = d;
      });
      saveLocal();
    }
  } catch(e) { console.error('syncDown error:', e); }
}

function runCarryOver() {
  const today = todayKey();
  Object.keys(allData).forEach(k => {
    const d = allData[k];
    if (!d?.tasks) return;
    d.tasks.forEach(t => {
      if (t.done && !t.addedToWins) {
        t.addedToWins = true;
        if (!d.wins) d.wins = [];
        if (!d.wins.find(w => w.text === t.text && w.fromTask))
          d.wins.push({ text: t.text, fromTask: true, done: false, completedAt: t.completedAt || null, priority: t.priority || false, delegatedBy: t.delegatedBy || null, completionNote: t.completionNote || null });
      }
    });
    if (d.misses) d.misses = d.misses.filter(m => !m.missedFrom || m.missedFrom === k);
    if (k < today) {
      if (!d.misses) d.misses = [];
      d.tasks.forEach(t => {
        if (!t.done && !t.addedToMisses) {
          t.addedToMisses = true;
          if (!d.misses.find(m => m.text === t.text && m.missedFrom === k))
            d.misses.push({ text: t.text, missedFrom: k, done: false });
        }
      });
      d.issues.forEach(issue => {
        if (!issue.addedToMisses) {
          issue.addedToMisses = true;
          if (!d.misses.find(m => m.text === issue.text && m.issueMiss))
            d.misses.push({ text: issue.text, missedFrom: k, issueMiss: true, done: false });
        }
      });
    }
    if (k === today && d.misses) d.misses = d.misses.filter(m => m.missedFrom && m.missedFrom < today);
  });
  saveLocal();
}

let _lastCalDate = null;
function render() {
  try { renderToday(); } catch(e) { console.error('renderToday:', e); }
  try { updateHeader(); } catch(e) {}
  try { updateBadges(); } catch(e) {}
  try { if (_lastCalDate !== viewDate) { _lastCalDate = viewDate; renderCalStrip(); } } catch(e) {}
  try {
    const d = dayData(viewDate);
    renderList('tasks', d.tasks); renderList('issues', d.issues); renderList('wins', d.wins); renderList('misses', d.misses);
  } catch(e) {}
  try { renderSummary(); } catch(e) {}
  try { renderMomentum(); } catch(e) {}
  try { updateSectionPillCounts(); } catch(e) {}
  try { const tdi = document.getElementById('teamDateInput'); if (tdi) tdi.value = viewDate; } catch(e) {}
}

function renderList(key, items) {
  const el = document.getElementById('list-' + key);
  if (!el) return;
  const cfg = { tasks:['<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>','No tasks yet'], issues:['<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>','No issues logged'], wins:['<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.8l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 10l5.9-.8z"/></svg>','No wins yet'], misses:['○','No misses, all clear!'] };
  if (!items?.length) { el.innerHTML = `<div class="empty"><div class="empty-icon">${cfg[key][0]}</div>${cfg[key][1]}</div>`; return; }
  el.innerHTML = items.map((item, i) => {
    if (key === 'tasks') {
      const isPriority = item.priority || item.text.startsWith('*');
      const displayText = item.text.startsWith('*') ? item.text.slice(1).trim() : item.text;
      const priorityBadge = isPriority ? '<span class="priority-badge">Priority</span>' : '';
      const delegatedBadge = item.delegatedBy ? `<span class="delegated-badge">↓ from ${item.delegatedBy.split('@')[0]}</span>` : '';
      const tsMeta = item.addedAt ? `<div class="item-meta">${item.delegatedBy?'Delegated ':'Added '}${item.addedAt}${item.completedAt?' · Completed '+item.completedAt:''}</div>` : '';
      return `<div class="item ${item.done?'done':''} ${isPriority?'priority-task':''}" data-task-idx="${i}"><div class="drag-handle"><svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" opacity="0.5"><circle cx="4" cy="3" r="1.5"/><circle cx="8" cy="3" r="1.5"/><circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg></div><div class="chk ${item.done?'on':''}" onclick="toggle(${i})"></div><div style="flex:1"><div class="item-text">${esc(displayText)} ${priorityBadge}${delegatedBadge}</div>${tsMeta}</div><button class="idel" onclick="del('tasks',${i})"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
    }
    if (key === 'wins') {
      const isPriority = item.priority === true || item.text?.startsWith('*');
      const isDelegated = !!(item.delegatedBy);
      const displayText = item.text?.startsWith('*') ? item.text.slice(1).trim() : (item.text || '');
      const extraClass = isPriority ? 'priority-task' : isDelegated ? 'delegated-win' : '';
      const priorityBadge = isPriority ? '<span class="priority-badge">Priority</span>' : '';
      const delegatedBadge = isDelegated ? `<span class="delegated-badge">↓ from ${item.delegatedBy.split('@')[0]}</span>` : '';
      const winTs = item.completedAt ? `<div class="item-meta">${item.fromTask?'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> completed · ':isDelegated?'↓ delegated · ':''}${item.completedAt}</div>` : (item.fromTask ? '<div class="item-meta"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> from completed task</div>' : '');
      const noteHtml = item.completionNote ? `<div style="font-size:11px;color:var(--text2);background:var(--surface2);border-radius:var(--r-sm);padding:4px 8px;margin-top:4px;font-style:italic"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg> ${esc(item.completionNote)}</div>` : '';
      return `<div class="item win-item ${extraClass}"><div class="idot dg"></div><div style="flex:1"><div class="item-text">${esc(displayText)} ${priorityBadge}${delegatedBadge}</div>${winTs}${noteHtml}</div><button class="idel" onclick="del('wins',${i})"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
    }
    if (key === 'misses') {
      const missLabel = item.issueMiss ? '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Unresolved issue' : '○ Incomplete task';
      const hasComment = item.comment && item.comment.trim();
      const commentVal = esc(item.comment || '');
      const onchange = "saveMissComment('" + viewDate + "'," + i + ",this.value)";
      return '<div class="item miss-item"><div class="idot dm"></div><div style="flex:1">' +
        '<div class="item-text">' + esc(item.text) + '</div>' +
        '<div class="item-meta">' + missLabel + ' · ' + fmtDate(item.missedFrom) + '</div>' +
        '<div class="miss-comment-row"><input class="miss-comment-input" placeholder="Add reason…" maxlength="200" value="' + commentVal + '" onchange="' + onchange + '" onblur="' + onchange + '"/>' +
        (hasComment ? '<span class="miss-comment-badge"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg></span>' : '') + '</div>' +
        '<div class="miss-actions"><button class="miss-carry-btn" onclick="openCarryForward(' + i + ',\'' + esc(item.text) + '\')">↗ Carry forward</button></div>' +
      '</div></div>';
    }
    const issueTs = item.addedAt ? `<div class="item-meta">${item.anonymous?'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 10.5V7.5a5.5 5.5 0 0111 0v3M5 10.5h14v10H5z"/></svg> Anonymous · ':''}Logged ${item.addedAt}</div>` : (item.anonymous ? '<div class="item-meta"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 10.5V7.5a5.5 5.5 0 0111 0v3M5 10.5h14v10H5z"/></svg> Anonymous</div>' : '');
    const anonBadge = item.anonymous ? '<span style="font-size:11px;background:rgba(var(--c-accent-rgb),0.15);color:var(--gold);border-radius:var(--r-sm);padding:1px 6px;margin-left:6px;font-weight:600">Anon</span>' : '';
    return `<div class="item"><div class="idot dc"></div><div style="flex:1"><div class="item-text">${esc(item.text)}${anonBadge}</div>${issueTs}</div><button class="idel" onclick="del('issues',${i})"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
  }).join('');
}

function updateHeader() {
  const h = new Date().getHours();
  document.getElementById('greeting').textContent = h<12?'Good morning.':h<17?'Good afternoon.':'Good evening.';
  const isToday = viewDate === todayKey(), isFuture = viewDate > todayKey();
  const pill = document.getElementById('datePill');
  pill.textContent = (isToday ? 'Today' : fmtDate(viewDate)) + ' ▾';
  pill.className = 'date-pill' + (isToday?' today':isFuture?' future':'');
  const d = dayData(viewDate);
  const taskList = d.tasks?.length ? d.tasks : (d.priorities || []);
  const total = taskList.length, done = taskList.filter(t=>t.done).length;
  const pct = total ? Math.round(done/total*100) : 0;
  document.getElementById('progFill').style.width = pct + '%';
  // The label used to live in its own band above the date strip, saying the
  // same thing as the Open tasks metric. It now sits beside the Tasks heading,
  // next to the list it describes. Kept null-safe: the element is hidden, and
  // other screens do not render it at all.
  var _pl = document.getElementById('progLbl');
  if (_pl) _pl.textContent = total ? done + ' of ' + total + ' done' : 'No tasks yet';
  var _tc = document.getElementById('tasksDoneCount');
  if (_tc) _tc.textContent = total ? done + ' of ' + total + ' done' : '';
}
// Needs attention: collapsible, and the choice sticks. On a phone the rail
// sits below the task list, so leaving it open pushes the rest of the day off
// screen. On desktop it is a peripheral glance and stays open by default.
function toggleNeedsAttention() {
  var h = document.getElementById('railHead');
  if (!h) return;
  var collapsed = h.classList.toggle('rail-collapsed');
  try { localStorage.setItem('naCollapsed', collapsed ? '1' : '0'); } catch (_e) {}
}
function _restoreNeedsAttentionState() {
  var h = document.getElementById('railHead');
  if (!h) return;
  var v = null;
  try { v = localStorage.getItem('naCollapsed'); } catch (_e) {}
  // No stored preference: collapsed on a phone, open on a wide screen.
  var collapse = (v === null) ? (window.innerWidth <= 900) : (v === '1');
  h.classList.toggle('rail-collapsed', collapse);
}

// Scroll affordance for the metric strip. The scrollbar is hidden by design,
// so without this there is nothing to say four more metrics exist to the right.
// The chevron fades out once there is nothing left to scroll to.
function _wireMetricScrollHint() {
  var wrap = document.getElementById('todayMetricsWrap');
  var strip = document.getElementById('todayMetrics');
  if (!wrap || !strip || strip._hintWired) return;
  strip._hintWired = true;
  var upd = function() {
    var atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4;
    // Nothing to scroll at all (wide screen, or few metrics) also counts.
    wrap.classList.toggle('at-end', atEnd || strip.scrollWidth <= strip.clientWidth + 4);
  };
  strip.addEventListener('scroll', upd, { passive: true });
  window.addEventListener('resize', upd);
  upd();
}

function updateBadges() {
  const d = dayData(viewDate);
  ['tasks','issues','wins','misses'].forEach(k => { const el = document.getElementById('b-'+k); if(el) el.textContent = d[k]?.length||0; });
}
function renderSummary() {
  const sg = document.getElementById('sumGrid'); if (!sg) return;
  const d = dayData(viewDate);
  const total = d.tasks.length, done = d.tasks.filter(t=>t.done).length;
  sg.innerHTML = `
    <div class="sstat"><div class="snum purple">${total}</div><div class="slbl">Tasks</div></div>
    <div class="sstat"><div class="snum green">${done}</div><div class="slbl">Done</div></div>
    <div class="sstat"><div class="snum coral">${d.issues.length}</div><div class="slbl">Issues</div></div>
    <div class="sstat"><div class="snum miss">${d.misses.length}</div><div class="slbl">Misses</div></div>`;
}
function renderCalStrip() {
  const strip = document.getElementById('calStrip');
  if (!strip) return;
  const dow = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const days = [];
  for (let i = -7; i <= 7; i++) { const d = new Date(); d.setDate(d.getDate() + i); days.push(d); }
  strip.innerHTML = days.map(function(d) {
    const k = dateKey(d);
    const isToday = (k === todayKey()), isActive = (k === viewDate);
    const hd = allData[k] && ((allData[k].tasks && allData[k].tasks.length) || (allData[k].issues && allData[k].issues.length));
    const cls = 'cal-d' + (isActive ? ' active' : '') + (isToday ? ' today-m' : '') + (hd && !isActive ? ' has-d' : '');
    return '<div class="' + cls + '" onclick="gotoDate(\'' + k + '\')">' +
      '<div class="cal-dow">' + dow[d.getDay()] + '</div>' +
      '<div class="cal-num">' + d.getDate() + '</div></div>';
  }).join('');
}
function toggleDp() {
  const dp = document.getElementById('dpDrop');
  if (dp.classList.contains('open')) { dp.classList.remove('open'); return; }
  dpMonth = parseDate(viewDate); renderDp(); dp.classList.add('open');
}
document.addEventListener('click', e => { if (!e.target.closest('.datepicker-wrap')) document.getElementById('dpDrop').classList.remove('open'); });
function renderDp() {
  const dp = document.getElementById('dpDrop');
  const y = dpMonth.getFullYear(), m = dpMonth.getMonth();
  const mn = dpMonth.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  const first = new Date(y,m,1), last = new Date(y,m+1,0);
  let html = `<div class="dp-hdr"><button class="dp-nav" onclick="dpShift(-1);event.stopPropagation()">‹</button><span class="dp-mon">${mn}</span><button class="dp-nav" onclick="dpShift(1);event.stopPropagation()">›</button></div><div class="dp-grid">`;
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => html += `<div class="dp-dow">${d}</div>`);
  for (let i=0; i<first.getDay(); i++) html += `<div class="dp-d"></div>`;
  for (let d=1; d<=last.getDate(); d++) {
    const k = dateKey(new Date(y,m,d));
    const isT = k===todayKey(), isS = k===viewDate, hd = allData[k]&&(allData[k].tasks?.length||allData[k].issues?.length);
    html += `<div class="dp-d ${isT?'dp-today':''} ${isS?'dp-sel':''} ${hd?'dp-dot':''}" onclick="gotoDate('${k}');document.getElementById('dpDrop').classList.remove('open');event.stopPropagation()">${d}</div>`;
  }
  dp.innerHTML = html + '</div>';
}
function dpShift(n) { dpMonth = new Date(dpMonth.getFullYear(), dpMonth.getMonth()+n, 1); renderDp(); }

function addItem(key) {
  const ids = { tasks:'pInput', issues:'iInput', wins:'aInput' };
  const inp = document.getElementById(ids[key]);
  const text = inp.value.trim();
  if (text.length < MIN) {
    const hm = { tasks:'ch-p', issues:'ch-i', wins:'ch-a' };
    const el = document.getElementById(hm[key]);
    if (el) { el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500); }
    inp.focus(); return;
  }
  const now = new Date();
  const ts = now.toLocaleDateString('en-IN', { day:'numeric', month:'short' }) + ' · ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const isPriority = text.startsWith('*');
  const cleanText = isPriority ? text.slice(1).trim() : text;
  const isAnon = key === 'issues' && isAnonymous();
  if (isPriority && key === 'tasks') dayData(viewDate)[key].push({ text: cleanText, done: false, addedAt: ts, priority: true });
  else if (isAnon) dayData(viewDate)[key].push({ text, done: false, addedAt: ts, anonymous: true });
  else dayData(viewDate)[key].push({ text, done: false, addedAt: ts });
  inp.value = ''; updateCBar({ tasks:'p', issues:'i', wins:'a' }[key]);
  runCarryOver(); render(); save(viewDate);
}
function toggle(i) {
  const t = dayData(viewDate).tasks[i];
  t.done = !t.done; t.addedToWins = false;
  if (t.done) {
    const now = new Date(); t.completedAt = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    dayData(viewDate).wins = dayData(viewDate).wins.filter(w => !(w.text===t.text && w.fromTask));
  } else { t.completedAt = null; }
  runCarryOver(); render(); save(viewDate);
}
function del(key, i) { dayData(viewDate)[key].splice(i,1); runCarryOver(); render(); save(viewDate); }
function shiftDay(n) { const d=parseDate(viewDate); d.setDate(d.getDate()+n); viewDate=dateKey(d); _lastCalDate = null; render(); }
function gotoDate(k) { _lastCalDate = null; viewDate = k; render(); }
function updateCBar(t) {
  const map = { p:'pInput', i:'iInput', a:'aInput' };
  if (!map[t]) return;
  const el = document.getElementById(map[t]);
  if (!el) return;
  const val = el.value.length;
  const pct = Math.min(100, Math.round(val/MIN*100));
  const bar = document.getElementById('cb-'+t), fill = document.getElementById('cf-'+t);
  if (!bar||!fill) return;
  bar.classList.toggle('vis', val > 0);
  fill.style.width = pct + '%';
  fill.className = 'cfill' + (val >= MIN ? ' ok' : '');
}

// DOM-only reset to Today: no renders, because on sign-in the data has not
// loaded yet and the normal load path renders Today once it has.
function _landOnToday() {
  currentTab = 'today';
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-today'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.id === 'nav-today'));
  document.body.setAttribute('data-tab', 'today');
  todayActiveSection = 'tasks';
  document.querySelectorAll('.today-section-btn').forEach(b => b.classList.toggle('active', b.id === 'tsb-tasks'));
  ['tasks','issues','wins','misses'].forEach(sec => {
    const el = document.getElementById('today-' + sec + '-section');
    if (el) el.style.display = sec === 'tasks' ? '' : 'none';
  });
  const addBox = document.getElementById('today-add-box'); if (addBox) addBox.style.display = '';
  try { window.scrollTo(0, 0); } catch (_e) {}
}

function switchTab(tab) {
  // SAMagic is the board inside Deals now.
  if (tab === 'exec') { try { _sc.view.dealsView = 'stage'; } catch (e) {} tab = 'pipeline'; }
  currentTab = tab;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const panelMap = { tasks:'today', issues:'today', wins:'today', misses:'today', settings:'you', org:'you', intel:'intel' };
  const actualPanel = panelMap[tab] || tab;
  const panel = document.getElementById('panel-' + actualPanel);
  if (panel) panel.classList.add('active');
  const navMap = { tasks:'today', issues:'today', wins:'today', misses:'today', settings:'you', org:'you', intel:'signals' };
  const navId = navMap[tab] || tab;
  const navBtn = document.getElementById('nav-' + navId);
  if (navBtn) navBtn.classList.add('active');
  // The greeting, date navigator, progress bar and calendar strip live in
  // .app rather than inside the Today panel, so they used to render on every
  // tab. They are Today's furniture: a date picker means nothing on Intel,
  // and it was also squeezing those panels' layout. Marking the active tab on
  // <body> lets CSS scope them without moving the markup, which other code
  // reads by id.
  document.body.setAttribute('data-tab', actualPanel);
  if (['tasks','issues','wins','misses'].includes(tab)) { if (tab !== 'misses') setTodaySection(tab); renderToday(); }
  if (tab === 'today') { setTodaySection('tasks'); renderToday(); }
  if (tab === 'settings') { renderSettings(); if (currentUser?.token && _isOrgAdmin()) { loadNotificationRules(); } }
  if (tab === 'you') { renderYouPanel(); refreshYouTabConnections(); loadHabitsSection(); loadEnrichmentStatus(); try { _sigRenderYou(); } catch (e) {} try { g19RenderYouUsage(); } catch (e) {} }
  if (tab === 'review') renderSummary();
  if (tab === 'exec') { scWireMore(); renderScBoard(); const bm = document.getElementById('scBoardMore'); if (bm && bm.open) loadExecDashboard(); }
  if (tab === 'signals') {
    // The new SAM screen loads first; the older SAM tools load only when
    // their section is opened.
    scWireMore(); renderScSam();
    const samMore = document.getElementById('scSamMore');
    if (samMore && samMore.open) {
      const seniorRole = ['super_admin','admin','manager','director','executive'].includes(profile?.role);
      const toggleEl = document.getElementById('samModeToggle');
      if (toggleEl) toggleEl.style.display = seniorRole ? 'block' : 'none';
      const mode = (seniorRole && _samMode === 'team') ? 'team' : 'self';
      setSamMode(mode);
    }
  }
  // SAMpaign is its own tab now. It used to be populated lazily when the SAM
  // tab's "signal" sub-tab was opened, which no longer happens, so it loads
  // here instead. Guarded on empty so switching tabs does not re-render and
  // discard in-progress state in the workspace.
  if (tab === 'sampaign') {
    var spSec = document.getElementById('sampaignManualSection');
    if (spSec && !spSec.innerHTML.trim()) loadSampaignWorkspace();
  }
  if (tab === 'intel') { loadIntelligence(); }
  if (tab === 'pipeline') { scWireMore(); renderScDeals(); const pm = document.getElementById('scDealsMore'); if (pm && pm.open) _scOldPipeline(); }
  if (tab === 'org') { if (currentUser?.refresh_token) { refreshToken().then(() => renderOrg()); } else { renderOrg(); } }
}
let _samMode = 'self';
function setSamMode(mode) {
  _samMode = mode;
  const selfBtn = document.getElementById('samModeSelfBtn'), teamBtn = document.getElementById('samModeTeamBtn');
  const selfEl = document.getElementById('samSelfMode'), teamEl = document.getElementById('samTeamMode');
  if (mode === 'team') {
    if (selfBtn) { selfBtn.style.background = 'transparent'; selfBtn.style.color = 'var(--text2)'; }
    if (teamBtn) { teamBtn.style.background = 'var(--gold)'; teamBtn.style.color = 'var(--c-canvas)'; }
    if (selfEl) selfEl.style.display = 'none';
    if (teamEl) teamEl.style.display = 'block';
    const tdi = document.getElementById('teamDateInput'); if (tdi) tdi.value = viewDate;
    renderTeam();
    loadForecastPanel();
    loadMeetingsKpiTeam();
  } else {
    if (selfBtn) { selfBtn.style.background = 'var(--gold)'; selfBtn.style.color = 'var(--c-canvas)'; }
    if (teamBtn) { teamBtn.style.background = 'transparent'; teamBtn.style.color = 'var(--text2)'; }
    if (selfEl) selfEl.style.display = 'block';
    if (teamEl) teamEl.style.display = 'none';
    renderSamAlerts(); loadSamSignals();
    // Show relevant sections
    var localIntelSec = document.getElementById('samLocalIntelSection'); if (localIntelSec) localIntelSec.style.display = 'block';
    var briefSec = document.getElementById('samBriefSection'); if (briefSec) briefSec.style.display = 'block';
    // Init sub-tabs
    setSamSubTab(_samSubTab || 'signal');
    // Brief date
    var briefDate = document.getElementById('samBriefDate');
    if (briefDate) briefDate.textContent = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
    loadSamBrief(false);
    loadHabitsSection();
    // Show connection banner if not connected (non-blocking — check status async)
    fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_email_provider'}) })
      .then(function(r){ return r.json(); }).then(function(d) {
        var banner = document.getElementById('samConnectionBanner');
        var sub    = document.getElementById('samGmailSub');
        if (d.connected) {
          if (banner) banner.style.display = 'none';
 if (sub) sub.textContent = d.demo ? 'Demo workspace: mailbox evidence is simulated' : '' + (d.provider==='microsoft'?'Outlook':'Gmail') + ' · ' + esc(d.email);
        } else {
          if (banner) banner.style.display = 'block';
          if (sub) sub.textContent = 'Connect Gmail or Outlook in You tab to enable signal verification';
        }
      }).catch(function(){});
  }
}
function switchToOrgPanel() {
  if (!_isOrgAdmin()) return;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-org').classList.add('active');
  renderOrg();
}

let todayActiveSection = 'tasks';
function setTodaySection(section) {
  todayActiveSection = section;
  document.querySelectorAll('.today-section-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('tsb-' + section); if (btn) btn.classList.add('active');
  ['tasks','issues','wins','misses'].forEach(s => {
    const el = document.getElementById('today-' + s + '-section');
    if (el) el.style.display = s === section ? '' : 'none';
  });
  const addBox = document.getElementById('today-add-box'); if (addBox) addBox.style.display = section === 'misses' ? 'none' : '';
  renderToday();
  if (section === 'tasks') setTimeout(initSortable, 50);
  const input = document.getElementById('todayInput');
  const addBtn = document.getElementById('todayAddBtn');
  const anonRow = document.getElementById('today-anon-row');
  const tmplRow = document.getElementById('today-template-row');
  if (input) {
    const myRole = profile?.role || 'member';
    const isSDRRole = myRole === 'sdr';
    const ph = { tasks: isSDRRole ? 'Log outreach or coverage task (min 25 chars)…' : 'Log a deal or meeting task (min 25 chars)…', issues: 'Describe the blocker (min 25 chars)…', wins: isSDRRole ? 'Log a connection, reply or meeting booked…' : 'Log a deal advance, proposal sent or close…' };
    const roleTipEl = document.getElementById('roleTipToday');
    if (roleTipEl) roleTipEl.innerHTML = isSDRRole ? 'SDR focus: coverage · outreach · connections · meetings booked · <span style="color:var(--gold);font-weight:700">*</span> for priority' : 'AE focus: deal quality · pipeline movement · proposals · closes · <span style="color:var(--gold);font-weight:700">*</span> for priority';
    input.placeholder = ph[section] || 'Add…';
  }
  if (addBtn) { const bg = { tasks:'var(--gold)', issues:'var(--coral)', wins:'var(--green)' }; addBtn.style.background = bg[section] || 'var(--gold)'; addBtn.style.color = section === 'wins' ? '#0f0f13' : 'var(--c-canvas)'; }
  if (anonRow) anonRow.style.display = section === 'issues' ? 'block' : 'none';
  if (tmplRow) tmplRow.style.display = section === 'tasks' ? 'flex' : 'none';
}
function updateTodayBar() { updateCBar({ tasks:'p', issues:'i', wins:'a' }[todayActiveSection] || 'p'); }
function addTodayItem() {
  const inp = document.getElementById('todayInput'); if (!inp) return;
  const text = inp.value.trim();
  if (text.length < MIN) { const hint = document.getElementById('ch-today'); if (hint) { hint.classList.add('show'); setTimeout(() => hint.classList.remove('show'), 2500); } inp.focus(); return; }
  const key = todayActiveSection;
  const now = new Date();
  const ts = now.toLocaleDateString('en-IN', { day:'numeric', month:'short' }) + ' · ' + now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
  const isPriority = text.startsWith('*');
  const cleanText = isPriority ? text.slice(1).trim() : text;
  const isAnon = key === 'issues' && document.getElementById('todayAnonToggle')?.checked;
  if (isPriority && key === 'tasks') dayData(viewDate)[key].push({ text: cleanText, done: false, addedAt: ts, priority: true });
  else if (isAnon) dayData(viewDate)[key].push({ text, done: false, addedAt: ts, anonymous: true });
  else dayData(viewDate)[key].push({ text, done: false, addedAt: ts });
  inp.value = '';
  runCarryOver(); renderToday(); render(); save(viewDate);
}
function renderToday() {
  // Always set section visibility first — even if content rendering fails,
  // the correct section will be shown. This is the default-safe approach.
  var _secIds = { tasks:'today-tasks-section', issues:'today-issues-section', wins:'today-wins-section', misses:'today-misses-section' };
  Object.keys(_secIds).forEach(function(k) {
    var el = document.getElementById(_secIds[k]);
    if (el) el.style.display = (k === todayActiveSection) ? '' : 'none';
  });

  const d = dayData(viewDate);
  const sections = [
    { key:'tasks', listId:'today-list-tasks', secId:'today-tasks-section' },
    { key:'issues', listId:'today-list-issues', secId:'today-issues-section' },
    { key:'wins', listId:'today-list-wins', secId:'today-wins-section' },
    { key:'misses', listId:'today-list-misses', secId:'today-misses-section' },
  ];
  sections.forEach(s => {
    const listEl = document.getElementById(s.listId);
    const items = d[s.key] || [];
    if (listEl) listEl.innerHTML = renderListHTML(s.key, items);
    const secEl = document.getElementById(s.secId);
    if (secEl) secEl.style.display = (todayActiveSection === s.key) ? '' : 'none';
    if (todayActiveSection === s.key && !items.length && listEl) {
      const msg = { tasks:'No tasks yet, add what you need to get done today', issues:'No issues logged today', wins:'No wins yet, complete a task or log one', misses: viewDate === todayKey() ? 'No misses yet' : 'No misses on this date' };
      listEl.innerHTML = '<div class="empty-msg" style="padding:20px 0;color:var(--text3);font-size:14px;text-align:center">' + msg[s.key] + '</div>';
    }
  });
  const addBox = document.getElementById('today-add-box'); if (addBox) addBox.style.display = todayActiveSection === 'misses' ? 'none' : '';
  updateSectionPillCounts();
  renderTodayMetrics();
  initSortable();
  const d2 = dayData(viewDate);
  renderProductivityBanner(d2.tasks||[]);
  showNudgeBanner(d2.tasks||[]);
  // Load coaching alerts once per session on Today tab
  if (!_coachingAlertsLoaded && currentUser?.token) {
    _coachingAlertsLoaded = true;
    loadCoachingAlerts();
    loadMeetingPrep();
    // Metric strip sources. Fired in parallel and never awaited, so a slow
    // one leaves its own metric as a dash instead of holding up the others
    // or the render. The strip is glanceable, not load bearing.
    loadTodayPipelineMetrics();
    try { loadTeamFeed('teamFeedWidget', 30); } catch (_e) {}
    // Auto-generate fresh alerts silently on first Today tab load
    fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'generate_coaching_alerts'}) }).then(function(r){return r.json();}).then(function(d){
      if (d.ok && d.alertsGenerated > 0) loadCoachingAlerts();
    }).catch(function(){});
  }
}

function renderListHTML(key, items) {
  if (!items.length) return '<div class="empty-msg">Nothing logged yet</div>';
  return items.map((item, i) => {
    if (key === 'tasks') {
      const isPriority = item.priority === true || (item.text||'').startsWith('*');
      const displayText = (item.text||'').startsWith('*') ? item.text.slice(1).trim() : (item.text||'');
      const priorityBadge = isPriority ? '<span class="priority-badge">Priority</span>' : '';
      const delegatedBadge = item.delegatedBy ? '<span class="delegated-badge">\u2193 ' + esc(item.delegatedBy.split('@')[0]) + '</span>' : '';
      // Auto-completion evidence badge \u2014 shows HOW Samora verified the task
      const notetakerNames = { fireflies:'Fireflies', fathom:'Fathom', otter:'Otter', read_ai:'Read.ai', grain:'Grain', tldv:'tl;dv', gong:'Gong', avoma:'Avoma', fellow:'Fellow', meetgeek:'MeetGeek', notta:'Notta', spinach:'Spinach', sembly:'Sembly', supernormal:'Supernormal', krisp:'Krisp', circleback:'CircleBack' };
      const verifyLabels = { gmail_sent: '\u2709 Verified \u00b7 ' + (item.verifiedCount ? item.verifiedCount + ' sent' : 'sent mail'), meeting_transcript: '\ud83c\udf99 Verified \u00b7 transcript', post_meeting_followup: '\ud83d\udcc5 Post-Meeting-FollowUp-Sent', notetaker_email: '\ud83c\udf99 Verified \u00b7 ' + (notetakerNames[item.verifiedSource] ? notetakerNames[item.verifiedSource] + ' notes' : 'meeting notes') };
      // Partial bulk-send progress (e.g. 3/15 sent): shown while the task stays open.
      const progressBadge = (!item.done && item.sendProgress)
        ? '<span style="font-size:11px;font-weight:700;color:var(--amber);background:rgba(var(--c-accent-rgb),0.12);border-radius:var(--r-sm);padding:1px 6px;margin-left:6px;white-space:nowrap">\u2709 ' + esc(item.sendProgress) + ' sent</span>'
        : '';
      const verifyBadge = (item.autoCompleted && verifyLabels[item.verifiedVia])
        ? '<span style="font-size:11px;font-weight:700;color:var(--green);background:rgba(74,140,92,0.12);border-radius:var(--r-sm);padding:1px 6px;margin-left:6px;white-space:nowrap">' + verifyLabels[item.verifiedVia] + '</span>'
        : (item.meetingFlag ? '<span style="font-size:11px;font-weight:700;color:var(--amber);background:rgba(var(--c-accent-rgb),0.12);border-radius:var(--r-sm);padding:1px 6px;margin-left:6px;white-space:nowrap">\u26a0 Meeting ' + item.meetingFlag + '</span>' : progressBadge);
      const carryMeta = item.carriedFrom ? '<div class="item-meta" style="color:var(--gold)">↗ Carried from ' + fmtDate(item.carriedFrom) + (item.carryReason?' · '+item.carryReason:'') + '</div>' : (item.carriedTo ? '<div class="item-meta" style="color:var(--text3)">' + (item.rescheduled ? '⟳ Rescheduled to ' : '⟶ Moved to ') + (item.carriedToLabel||item.carriedTo) + '</div>' : '');
      // Alt-contact CTA — surfaced when an OOO reply named someone else to
      // reach in the meantime (see extractAltContact in process_ooo_mails).
      // Snippet is the raw matched line, shown as the receipt so the rep can
      // eyeball it before trusting the extracted email/phone.
      const altContactCta = (item.altContactEmail || item.altContactPhone)
        ? '<div class="item-meta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:2px">' +
            '<span style="color:var(--text3)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6.5h6l2 2.5h9v11h-17z"/></svg> Alt contact while OOO' + (item.altContactSnippet ? ': "' + esc(item.altContactSnippet) + '"' : '') + '</span>' +
            (item.altContactEmail ? '<a href="mailto:' + esc(item.altContactEmail) + '" style="font-size:11px;font-weight:600;color:var(--gold);text-decoration:none;border:1px solid var(--border2);border-radius:var(--r-sm);padding:1px 7px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> ' + esc(item.altContactEmail) + '</a>' : '') +
            (item.altContactPhone ? '<a href="tel:' + esc(item.altContactPhone.replace(/[^\d+]/g,'')) + '" style="font-size:11px;font-weight:600;color:var(--gold);text-decoration:none;border:1px solid var(--border2);border-radius:var(--r-sm);padding:1px 7px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5H4.5A1.5 1.5 0 003 5c0 8.8 7.2 16 16 16a1.5 1.5 0 001.5-1.5V17l-4.5-2-2.5 2.5A15 15 0 018.5 11L11 8.5z"/></svg> ' + esc(item.altContactPhone) + '</a>' : '') +
          '</div>'
        : '';
      const tsMeta = (item.addedAt ? '<div class="item-meta">' + (item.delegatedBy?'Delegated ':'Added ') + item.addedAt + (item.completedAt?' · Completed '+item.completedAt:'') + '</div>' : '') + carryMeta + altContactCta + _g24OooHtml(item, i);
      return '<div class="item ' + (item.done?'done':'') + ' ' + (isPriority?'priority-task':'') + '" data-task-idx="' + i + '" data-carry-text="' + esc(displayText) + '"' + (item.carriedTo?' style="opacity:0.5"':'') + '>' +
        '<div class="drag-handle"><svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor"><circle cx="4" cy="3" r="1.5"/><circle cx="8" cy="3" r="1.5"/><circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg></div>' +
        '<div class="chk ' + (item.done?'on':'') + '" onclick="' + (item.carriedTo?'':'toggleFromToday('+i+')') + '"' + (item.carriedTo?' title="Task moved forward"':'') + '></div>' +
        '<div style="flex:1"><div class="item-text">' + esc(displayText) + ' ' + priorityBadge + delegatedBadge + verifyBadge + '</div>' + tsMeta +
        '<button class="icarry" onclick="window._doCarry(event)">\u2197 Move</button>' +
        '<button class="icarry" onclick="window._openReminderFromTask(event)" style="margin-left:4px">\u23F0 Remind</button></div>' +
        '<button class="idel" onclick="delFromToday(\'tasks\',' + i + ')"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
    }
    if (key === 'wins') {
      const isPriority = item.priority === true || (item.text||'').startsWith('*');
      const isDelegated = !!item.delegatedBy;
      const displayText = (item.text||'').startsWith('*') ? item.text.slice(1).trim() : (item.text||'');
      const extraClass = isPriority ? 'priority-task' : isDelegated ? 'delegated-win' : '';
      const priorityBadge = isPriority ? '<span class="priority-badge">Priority</span>' : '';
      const delegatedBadge = isDelegated ? '<span class="delegated-badge">\u2193 ' + esc(item.delegatedBy.split('@')[0]) + '</span>' : '';
      const winTs = item.completedAt ? '<div class="item-meta">' + (item.fromTask?'\u2726 completed · ':isDelegated?'\u2193 delegated · ':'') + item.completedAt + '</div>' : (item.fromTask ? '<div class="item-meta">\u2726 from completed task</div>' : '');
      return '<div class="item win-item ' + extraClass + '"><div class="idot dg"></div><div style="flex:1"><div class="item-text">' + esc(displayText) + ' ' + priorityBadge + delegatedBadge + '</div>' + winTs + '</div><button class="idel" onclick="delFromToday(\'wins\',' + i + ')"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
    }
    if (key === 'misses') {
      const missLabel = item.issueMiss ? '\u26a1 Unresolved issue' : '\u25cb Incomplete task';
      const hasComment = item.comment && item.comment.trim();
      const commentVal = esc(item.comment || '');
      const onchange = "saveMissComment('" + viewDate + "'," + i + ",this.value)";
      return '<div class="item miss-item"><div class="idot dm"></div><div style="flex:1">' +
        '<div class="item-text">' + esc(item.text) + '</div>' +
        '<div class="item-meta">' + missLabel + ' from ' + fmtDate(item.missedFrom) + '</div>' +
        '<div class="miss-comment-row"><input class="miss-comment-input" placeholder="Add reason\u2026" maxlength="200" value="' + commentVal + '" onchange="' + onchange + '" onblur="' + onchange + '"/>' +
        (hasComment ? '<span class="miss-comment-badge">\u2713</span>' : '') + '</div>' +
      '</div></div>';
    }
    const issueTs = item.addedAt ? '<div class="item-meta">' + (item.anonymous?'\uD83D\uDD12 Anonymous · ':'') + 'Logged ' + item.addedAt + '</div>' : (item.anonymous ? '<div class="item-meta">\uD83D\uDD12 Anonymous</div>' : '');
    const anonBadge = item.anonymous ? '<span style="font-size:11px;background:rgba(var(--c-accent-rgb),0.15);color:var(--gold);border-radius:var(--r-sm);padding:1px 6px;margin-left:6px;font-weight:600">Anon</span>' : '';
    return '<div class="item"><div class="idot dc"></div><div style="flex:1"><div class="item-text">' + esc(item.text) + anonBadge + '</div>' + issueTs + '</div><button class="idel" onclick="delFromToday(\'issues\',' + i + ')"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  }).join('');
}

function toggleFromToday(i) {
  const t = dayData(viewDate).tasks[i];
  if (t.carriedTo) return;
  if (!t.done) {
    window._confirmDoneIdx = i;
    document.getElementById('doneConfirmText').textContent = t.text;
    document.getElementById('doneConfirmComment').value = '';

    // Detect if this is an unverifiable channel task and show structured outcome fields
    const lower = (t.text || '').toLowerCase();
    const isLinkedIn  = /linkedin|li connect|inmail|connection request/i.test(lower);
    const isWhatsApp  = /whatsapp|whatsapp|wp message/i.test(lower);
    const isCall      = /\bcall(s|ing|ed)?\b|\bphone\b|\bdial\b/.test(lower) && !/\bemail\b|\bmail\b/.test(lower);
    const isUnverifiable = isLinkedIn || isWhatsApp || isCall;

    const structuredSection = document.getElementById('doneStructuredSection');
    const outcomeSelect = document.getElementById('doneOutcomeSelect');
    const channelHint = document.getElementById('doneChannelHint');

    if (structuredSection && outcomeSelect && channelHint) {
      if (isUnverifiable) {
        structuredSection.style.display = 'block';
 channelHint.textContent = isLinkedIn ? 'LinkedIn activity' : isWhatsApp ? 'WhatsApp activity' : 'Call activity';
        // Populate outcome options based on channel
        const liOptions = '<option value="">Outcome…</option><option value="requests_sent">Requests sent</option><option value="connections_accepted">Connections accepted</option><option value="messages_sent">Messages sent</option><option value="replies_received">Replies received</option><option value="meeting_booked">Meeting booked</option>';
        const waOptions = '<option value="">Outcome…</option><option value="messages_sent">Messages sent</option><option value="replies_received">Replies received</option><option value="meeting_booked">Meeting booked</option><option value="no_response">No response yet</option>';
        const callOptions = '<option value="">Outcome…</option><option value="no_answer">No answer / voicemail</option><option value="spoke_briefly">Spoke briefly</option><option value="full_conversation">Full conversation</option><option value="meeting_booked">Meeting booked</option><option value="not_interested">Not interested</option>';
        outcomeSelect.innerHTML = isLinkedIn ? liOptions : isWhatsApp ? waOptions : callOptions;
      } else {
        structuredSection.style.display = 'none';
      }
    }

    document.getElementById('doneConfirmModal').style.display = 'flex';
    return;
  }
  t.done = false; t.completedAt = null; t.addedToWins = false;
  runCarryOver(); renderToday(); render(); save(viewDate);
}

window._confirmDone = function() {
  var i = window._confirmDoneIdx;
  var t = dayData(viewDate).tasks[i];
  var comment = document.getElementById('doneConfirmComment').value.trim();
  var outcome = document.getElementById('doneOutcomeSelect')?.value || '';
  var count   = document.getElementById('doneCountInput')?.value?.trim() || '';

  t.done = true; t.addedToWins = false;
  var now = new Date(); t.completedAt = now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});

  // Build structured completion note for unverifiable channels
  var structuredNote = '';
  if (outcome) {
    var outcomeLabels = { requests_sent:'Requests sent', connections_accepted:'Connections accepted', messages_sent:'Messages sent', replies_received:'Replies received', meeting_booked:'Meeting booked', no_response:'No response yet', no_answer:'No answer', spoke_briefly:'Spoke briefly', full_conversation:'Full conversation', not_interested:'Not interested' };
    structuredNote = (outcomeLabels[outcome] || outcome) + (count ? ' · ' + count : '');
    if (comment) structuredNote += ' · ' + comment;
  } else {
    structuredNote = comment;
  }

  if (structuredNote) t.completionNote = structuredNote;
  if (outcome) t.activityOutcome = outcome;  // store structured outcome separately for scoring

  dayData(viewDate).wins = dayData(viewDate).wins.filter(function(w){ return !(w.text===t.text && w.fromTask); });
  document.getElementById('doneConfirmModal').style.display = 'none';
  runCarryOver(); renderToday(); render(); save(viewDate);
};
window._cancelDone = function() { document.getElementById('doneConfirmModal').style.display = 'none'; };
function delFromToday(key, i) { dayData(viewDate)[key].splice(i, 1); runCarryOver(); renderToday(); render(); save(viewDate); }

function renderYouPanel() {
  const email = currentUser?.email || '';
  const initials = email.substring(0,2).toUpperCase();
  const av = document.getElementById('youAvatar'); if (av) av.textContent = initials;
  const em = document.getElementById('youEmailDisplay'); if (em) em.textContent = email;
  const rp = document.getElementById('youRolePill'); if (rp) { rp.textContent = (((window._orgConfig && window._orgConfig.roleLabels) || {})[profile?.role]) || (profile?.role||'').replace('_',' '); rp.className = 'role-pill rp-'+(profile?.role||''); }
  const op = document.getElementById('youOrgPill'); if (op) { op.textContent = profile?.org_name || profile?.org_code || ''; op.style.display = op.textContent ? '' : 'none'; }
  const nm = document.getElementById('youNameDisplay');
  if (nm) {
    var full = (currentUser && currentUser.user_metadata && currentUser.user_metadata.full_name) || profile?.full_name || profile?.name || '';
    if (!full && email) full = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    nm.textContent = full || 'Your account';
    if (av && full) { var w = full.trim().split(/\s+/); av.textContent = ((w[0] || '')[0] + ((w[1] || '')[0] || (w[0] || '')[1] || '')).toUpperCase(); }
  }
  const mr = document.getElementById('youMomentumRow');
  if (mr) {
    const streak = calcStreak(); const momentum = calcMomentum();
    const fire = streak>=7?'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg>':streak>=3?'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>':'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>';
    mr.innerHTML = '<div class="streak-badge"><div class="streak-fire">'+fire+'</div><div class="streak-info"><div class="streak-num">'+streak+'</div><div class="streak-lbl">'+(streak===1?'1 day streak':streak+' day streak')+' (weekdays)</div></div></div><div class="momentum-bar-wrap"><div class="momentum-lbl"><span>5-day momentum</span><span style="color:var(--gold);font-weight:600">'+momentum+'%</span></div><div class="momentum-bar"><div class="momentum-fill" style="width:'+momentum+'%"></div></div></div>';
  }
  // The old themeMenuLabel button is gone, replaced by the Appearance panel.
  // Re-render it here so the selected theme and size are correct whenever the
  // You tab is drawn, including after a device-theme change while on auto.
  try { renderAppearancePanel(); } catch(e) {}
  var isAdm = _isOrgAdmin();
  var ab = document.getElementById('youAdminBlock'); if (ab) ab.hidden = !isAdm;
  var ap = document.getElementById('youAdminPill'); if (ap) ap.hidden = !isAdm || /admin/.test(profile?.role || '');
  var ft = document.getElementById('youFoot'); if (ft) ft.textContent = 'SamoraOS \u00b7 version ' + APP_VERSION;
  try { refreshInstallStatus(); } catch (e) {}
  try { _renderRailMe(); _renderYouSetup(); } catch (e) {}
  loadMyAccounts();
}
async function loadSamSignals() {
  if (!currentUser?.token) return;
  const feed = document.getElementById('samFeed');
  const statusEl = document.getElementById('samGmailStatus'); if (statusEl) statusEl.style.display = 'block';
  try {
    const r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'get_signals' }) });
    const data = await r.json();
    if (data.error) { renderGmailNotConnected(); return; }
    const label = document.getElementById('samGmailLabel'); const sub = document.getElementById('samGmailSub'); const btn = document.getElementById('samGmailBtn');
 if (label) label.textContent = 'Gmail connected'; if (sub) sub.textContent = 'Signals refreshed from your sent folder';
    if (btn) { btn.textContent = 'Refresh'; btn.onclick = loadSamSignals; }
    const signals = data.signals ?? data.analysis?.signals ?? [];
    const rawAnalysis = data.analysis;
    if (!signals || !signals.length) {
      if (rawAnalysis?.summary) { feed.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;font-size:14px;color:var(--text2);line-height:1.7"><div style="font-size:11px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> SAM Analysis</div>' + esc(rawAnalysis.summary) + '</div>'; }
      else { feed.innerHTML = '<div style="text-align:center;padding:32px 20px;color:var(--text3);font-size:13px">No strong signals found, pipeline looks healthy <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg></div>'; }
      return;
    }
    renderSignalCards(signals);
  } catch(e) { renderGmailNotConnected(); }
}
// ── Demo workspace ─────────────────────────────────────────────────────────
// org_settings.features.demo_workspace marks an org as a demo (Flick2Know for
// the FieldAssist demo). The data is simulated, so the app says so in one
// small chip rather than passing it off as someone's live mailbox: every
// number shows its receipts, and in a demo the receipt is "simulated".
function _isDemoWorkspace() { return !!(window._orgConfig && window._orgConfig.features && window._orgConfig.features.demo_workspace); }
function _applyDemoChip() {
  var have = document.getElementById('demoChip');
  if (!_isDemoWorkspace()) { if (have) have.remove(); return; }
  if (have) return;
  var org = document.getElementById('uOrg');
  if (!org || !org.parentNode) return;
  var chip = document.createElement('span');
  chip.id = 'demoChip';
  chip.title = 'This workspace runs on simulated activity for demonstrations';
  chip.textContent = 'Demo workspace';
  chip.style.cssText = 'font-size:11px;font-weight:600;letter-spacing:.02em;color:var(--gold);background:rgba(var(--c-accent-rgb),0.12);border:1px solid rgba(var(--c-accent-rgb),0.35);border-radius:var(--r-md);padding:3px 10px';
  org.parentNode.insertBefore(chip, org.nextSibling);
}

function renderGmailNotConnected() {
  if (_isDemoWorkspace()) {
    var dl = document.getElementById('samGmailLabel'); var ds = document.getElementById('samGmailSub');
    if (dl) dl.textContent = 'Demo mailbox'; if (ds) ds.textContent = 'Demo workspace: mailbox evidence is simulated';
    var df = document.getElementById('samFeed');
    if (df) df.innerHTML = '<div style="text-align:center;padding:32px 20px;color:var(--text3);font-size:13px;line-height:1.6">Demo workspace: live inbox signals appear here once a mailbox is connected.<br>Intent vs Reality and the Team tab run on the simulated activity.</div>';
    return;
  }
  const label = document.getElementById('samGmailLabel'); const sub = document.getElementById('samGmailSub');
  if (label) label.textContent = 'Gmail not connected'; if (sub) sub.textContent = 'Connect your Gmail to see live email signals';
  const feed = document.getElementById('samFeed');
  if (feed) feed.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text3)"><div style="font-size:34px;margin-bottom:12px;opacity:0.3"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg></div><div style="font-size:14px;color:var(--text2);margin-bottom:6px">Gmail not connected</div><div style="font-size:12px">Click Connect Gmail above to start seeing email signals</div></div>';
}
function renderSignalCards(signals) {
  const typeMap = { hot:{cls:'buying',icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg>',label:'Hot signal'}, warm:{cls:'neutral',icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>',label:'Active account'}, cold:{cls:'dying',icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.8v.4"/></svg>',label:'Going cold'}, no_followup:{cls:'dying',icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg>',label:'No follow-up'}, at_risk:{cls:'dying',icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg>',label:'At risk'} };
  const feed = document.getElementById('samFeed'); if (!feed) return;
  feed.innerHTML = signals.map(s => {
    const t = typeMap[s.type] || typeMap.warm;
    return '<div class="sam-card ' + t.cls + '"><div class="sam-card-header"><span class="sam-tag ' + t.cls + '">' + t.icon + ' ' + t.label + '</span><span class="sam-time">' + (s.daysAgo?s.daysAgo+' days ago':'Recent') + '</span></div><div class="sam-account">' + esc(s.account) + '</div><div class="sam-body">' + esc(s.body) + '</div><div class="sam-action' + (t.cls==='dying'?' dying-action':'') + '"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.8v.4"/></svg> ' + esc(s.action) + '</div></div>';
  }).join('');
}
function connectOutlook() {
  // Microsoft OAuth 2.0 authorization URL
  // 'common' tenant = supports personal accounts (Hotmail, Outlook.com)
  //                    + work accounts (Microsoft 365, Exchange Online)
  const MS_CLIENT_ID = MICROSOFT_CLIENT_ID_SAM;
  if (!MS_CLIENT_ID) {
    alert('Outlook is not configured yet.\n\nYour Samora admin needs to:\n1. Register an app in Azure (Microsoft Entra ID → App registrations)\n2. Add the redirect URI: ' + window.location.origin + '\n3. Grant the delegated permissions Mail.Read, Mail.Send, Calendars.ReadWrite, User.Read, offline_access\n4. Put the application (client) ID into SamoraOS, and the client secret into the edge function as MICROSOFT_CLIENT_SECRET');
    return;
  }
  const redirectUri = window.location.origin;
  // Must match MS_SCOPES in the edge function. The grant is decided HERE, at
  // consent time: widening the copy in the edge function alone changes nothing,
  // because the refresh token only ever carries what this URL asked for.
  //
  // Mail.Send is what makes SAMpaign sending possible at all.
  // Calendars.ReadWrite is what the calendar-write path has been asking reps to
  // reconnect for, back when reconnecting requested read only.
  const scopes = 'Mail.Read Mail.Send Calendars.ReadWrite offline_access User.Read';
  const state = 'user_' + currentUser.id; // carry user context through OAuth
  const authUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize' +
    '?client_id=' + encodeURIComponent(MS_CLIENT_ID) +
    '&response_type=code' +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&scope=' + encodeURIComponent(scopes) +
    '&state=' + encodeURIComponent(state) +
    '&response_mode=query';
  window.location.href = authUrl;
}

async function handleMicrosoftCallback(code) {
  if (!code) return;
  if (!currentUser?.token) { alert('Please sign in first, then connect Outlook.'); return; }
  try {
    var btn = document.getElementById('samOutlookBtn');
    if (btn) { btn.textContent = 'Connecting…'; btn.disabled = true; }
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'exchange_microsoft_code', code, redirect_uri: window.location.origin })
    });
    var d = await r.json();
    if (d.ok) {
 showToast('Outlook connected: ' + d.email);
      try { _spAfterMailboxConnected(); } catch (_e) {}
      try { refreshYouTabConnections(); } catch (_e) {}
      var sub = document.getElementById('samGmailSub');
 if (sub) sub.textContent = 'Outlook connected · ' + d.email;
 if (btn) { btn.textContent = 'Outlook connected'; btn.style.background = 'var(--green)'; }
    } else {
      alert('Outlook connection failed: ' + (d.error || 'Unknown error'));
      if (btn) { btn.textContent = 'Connect Outlook'; btn.disabled = false; }
    }
  } catch(e) {
    alert('Error: ' + e.message);
    var btn2 = document.getElementById('samOutlookBtn');
    if (btn2) { btn2.textContent = 'Connect Outlook'; btn2.disabled = false; }
  }
}

// ── Calendar → Today task sync ─────────────────────────────────────────────────
var _calTasksFetched = '';
var _calendarTasksPending = [];

async function syncCalendarTasks(force) {
  var today2 = todayKey();
  if (!force && _calTasksFetched === today2) return;
  var row = document.getElementById('calendarSyncRow');
  var status = document.getElementById('calSyncStatus');
  try {
    var d = await _g24Cal(today2);
    if (!d.ok || !d.tasks || !d.tasks.length) return;
    _calTasksFetched = today2;
    var existing = (dayData(today2).tasks || []).map(function(t){return t.text.toLowerCase();});
    var newTasks = d.tasks.filter(function(t){ return !existing.some(function(e){return e.includes(t.title.toLowerCase().slice(0,20));}); });
    if (!newTasks.length) return;
    // Store tasks in a global array — buttons reference by index only.
    // Never embed raw agenda/title text into onclick attributes: meeting
    // invite bodies (Zoom/Teams/Meet boilerplate) often contain quotes,
    // newlines and HTML-breaking characters that corrupt inline attributes.
    _calendarTasksPending = newTasks;
    if (row && status) {
      row.style.display = 'block';
      var btnsHtml = newTasks.map(function(t, i) {
        return '<button data-cal-idx="'+i+'" class="cal-add-btn" style="margin:0 3px;padding:2px 7px;border-radius:var(--r-md);background:rgba(var(--c-accent-rgb),0.15);border:1px solid var(--border2);color:var(--gold);font-family:var(--sans);font-size:11px;cursor:pointer">+'+esc(t.title.slice(0,25))+'</button>';
      }).join('');
      status.innerHTML = '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> ' + newTasks.length + ' calendar event' + (newTasks.length!==1?'s':'') + ' today, ' + btnsHtml +
        '<button id="calAddAllBtn" style="margin-left:6px;padding:2px 8px;border-radius:var(--r-md);background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer">Add all</button>';
      // Wire up listeners after HTML is inserted — no inline onclick with embedded data
      status.querySelectorAll('.cal-add-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var idx = parseInt(btn.getAttribute('data-cal-idx'), 10);
          addCalendarTaskByIndex(idx);
        });
      });
      var addAllBtn = document.getElementById('calAddAllBtn');
      if (addAllBtn) addAllBtn.addEventListener('click', addAllCalendarTasks);
    }
  } catch(e) { /* non-fatal */ }
}

function addCalendarTaskByIndex(idx) {
  var t = _calendarTasksPending[idx];
  if (!t) return;
  // Strip common meeting-invite boilerplate from the agenda before storing —
  // "System reference", "For organizers:", "Privacy and security" etc. are
  // Zoom/Teams/Meet footer text, not useful task context.
  var cleanAgenda = stripMeetingBoilerplate(t.agenda);
  var d = dayData(viewDate);
  d.tasks.push({ text: t.text, done:false, priority:false, source:'calendar', calendarEventId: t.calendar_event_id||null, account: t.account_name||null, completionNote: cleanAgenda||null });
  save(viewDate); render();
 showToast('Added from calendar');
}

function addAllCalendarTasks() {
  var d = dayData(viewDate);
  var existing = d.tasks.map(function(t){return t.text.toLowerCase();});
  _calendarTasksPending.forEach(function(t) {
    if (!existing.some(function(e){return e.includes(t.title.toLowerCase().slice(0,20));})) {
      d.tasks.push({ text:t.text, done:false, priority:false, source:'calendar', calendarEventId:t.calendar_event_id||null, account:t.account_name||null, completionNote: stripMeetingBoilerplate(t.agenda)||null });
    }
  });
  save(viewDate); render();
  var row = document.getElementById('calendarSyncRow'); if (row) row.style.display = 'none';
 showToast('Calendar events added as tasks');
}

// ── Reconcile calendar-sourced tasks when a meeting is moved/cancelled ─────────
// If a calendar event tied to a task has been rescheduled to another day, carry
// the task to that day; if the meeting was cancelled, flag it. Only touches
// today+future days and open (not done) calendar tasks. Idempotent.
async function reconcileCalendarTasks() {
  if (!currentUser || !currentUser.token) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'get_calendar_window', days:21, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
    var d = await r.json();
    if (!d || !d.ok || !Array.isArray(d.events)) return;
    var byId = {}; d.events.forEach(function(e){ if (e && e.id) byId[e.id] = e; });
    var today = todayKey(), affected = {}, moved = 0;
    Object.keys(allData).forEach(function(k){
      if (k < today) return;                         // never disturb past history
      var day = allData[k]; if (!day || !day.tasks) return;
      day.tasks.slice().forEach(function(t){
        if (!t || t.done || t.carriedTo || t.source !== 'calendar' || !t.calendarEventId) return;
        var ev = byId[t.calendarEventId];
        if (!ev) return;                             // not in window → leave as is
        if (ev.status === 'cancelled') { if (t.meetingFlag !== 'cancelled') { t.meetingFlag = 'cancelled'; affected[k] = 1; } return; }
        if (ev.date && ev.date !== k) {              // meeting moved to a new day
          var dest = dayData(ev.date);
          if (!dest.tasks.some(function(x){ return x.calendarEventId === t.calendarEventId; })) {
            // Live, actionable copy on the NEW day.
            var nt = Object.assign({}, t);
            delete nt.carriedTo; delete nt.carriedToLabel; delete nt.rescheduled; delete nt.addedToMisses; delete nt.addedToWins; delete nt.meetingFlag;
            nt.carriedFrom = k; nt.carryReason = 'meeting rescheduled';
            dest.tasks.push(nt);
          }
          // Keep a SUBDUED record on the original day noting where it went.
          t.carriedTo = ev.date; t.carriedToLabel = fmtDate(ev.date); t.rescheduled = true; t.addedToMisses = true;
          affected[k] = 1; affected[ev.date] = 1; moved++;
        }
      });
    });
    var dates = Object.keys(affected);
    if (dates.length) {
      saveLocal();
      dates.forEach(function(dk){ try { save(dk); } catch(e){} });
      render();
 if (moved) showToast('' + moved + ' rescheduled meeting' + (moved>1?'s':'') + ' moved to ' + (moved>1?'their new dates':'its new date'));
    }
  } catch(e) { /* non-fatal */ }
}

function stripMeetingBoilerplate(text) {
  if (!text) return '';
  // Cut off at common invite-footer markers — everything after these is
  // boilerplate (join links, dial-in numbers, privacy notices) not agenda content
  var cutMarkers = ['System reference', 'For organizers:', 'Privacy and security', 'Meeting options', '________________', 'Join Zoom Meeting', 'Join Microsoft Teams', 'Join with Google Meet'];
  var cutIdx = text.length;
  cutMarkers.forEach(function(marker) {
    var i = text.indexOf(marker);
    if (i > -1 && i < cutIdx) cutIdx = i;
  });
  return text.slice(0, cutIdx).trim().slice(0, 300);
}

function dismissCalSync() {
  var row = document.getElementById('calendarSyncRow'); if (row) row.style.display = 'none';
}

// ── You tab refresh ────────────────────────────────────────────────────────────
// ── AI Connector ──────────────────────────────────────────────────────────────
var _connectorToken = null;
var _currentInstallCmd  = '';
// The connector URL people paste into Claude. os.samoraglobal.com, not the
// vercel.app alias, and not window.location.origin: Claude draws a custom
// connector's icon from the favicon of the URL's registrable domain, and for
// anything on *.vercel.app that domain is Vercel's, so it is always the grey
// globe. Same deployment either way; only the icon differs.
var CONNECTOR_CANONICAL_HOST = 'https://os.samoraglobal.com';
var _connectorHost  = CONNECTOR_CANONICAL_HOST;

// Issues an API key, not a login session.
//
// The old flow handed out a Supabase session token. A session is built for a
// person sitting at a browser: it expires, its refresh token rotates and is
// single-use, and it can be killed server-side without the connector ever
// knowing. That is why this connection died roughly daily and had to be
// removed and re-added in Claude by hand.
//
// A key has no expiry and nothing to rotate. Same button, same URLs, same
// install commands — the credential inside them is just a different kind of
// thing now.
async function getConnectorToken() {
  var btn    = document.getElementById('connectorBtn');
  var status = document.getElementById('connectorStatus');
  if (btn) { btn.textContent = 'Connecting…'; btn.disabled = true; }
  try {
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'create_connector_key', label: 'Claude connector' })
    });
    var d = await r.json();

    // Falls back to the old session token if the key action is not deployed
    // yet, so this page keeps working during the rollout rather than showing
    // an error for something the user cannot fix.
    var usedKey = true;
    if (!d.ok || !d.key) {
      usedKey = false;
      var r2 = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
        body: JSON.stringify({ action: 'get_connector_token' })
      });
      d = await r2.json();
      if (!d.ok) {
        if (status) status.textContent = 'Error: ' + esc(d.error || 'Failed');
 if (btn) { btn.textContent = 'Connect to AI'; btn.disabled = false; }
        return;
      }
    }

    _connectorToken = usedKey ? d.key : d.token;
    // The edge function's HOST env var wins only if it is a real domain.
    // A stale samoratrack.vercel.app there would quietly bring the globe back.
    _connectorHost  = (d.host && !/\.vercel\.app\/?$/i.test(d.host)) ? String(d.host).replace(/\/$/, '') : CONNECTOR_CANONICAL_HOST;
    document.getElementById('connectorNotGenerated').style.display = 'none';
    document.getElementById('connectorGenerated').style.display    = 'block';
    // Populate the Teams/MCP URL field
    var mcpUrlEl = document.getElementById('claudeMcpUrl');
    if (mcpUrlEl) mcpUrlEl.textContent = _connectorHost + '/api/connector/mcp?token=' + _connectorToken;
    // Populate the browser URL (same URL — claude.ai Integrations uses the same endpoint)
    var browserUrlEl = document.getElementById('claudeBrowserUrl');
    if (browserUrlEl) browserUrlEl.textContent = _connectorHost + '/api/connector/mcp?token=' + _connectorToken;

    var expiry = document.getElementById('connectorExpiry');
    if (expiry) {
      if (usedKey) {
        // The headline of this whole change, so it says so plainly.
        expiry.innerHTML = '<span style="color:var(--green)">This key does not expire.</span> Copy the URL now, it is shown once.';
      } else if (d.expires_at) {
        var days = Math.round((d.expires_at - Date.now()) / 86400000);
        expiry.textContent = 'Token valid for ' + days + ' more days';
      }
    }
    if (usedKey) renderConnectorKeys();
  } catch(e) {
    if (status) status.textContent = 'Error: ' + esc(e.message);
 if (btn) { btn.textContent = 'Connect to AI'; btn.disabled = false; }
  }
}

// Lists keys by prefix, with last use and a revoke control. Keys are cheap to
// create, so without a list they quietly pile up and nobody can tell which
// machine holds which. Last used is the one signal that says which is dead.
async function renderConnectorKeys() {
  var box = document.getElementById('connectorKeysPanel');
  if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'list_connector_keys' })
    });
    var d = await r.json();
    var keys = (d && d.keys) || [];
    var live = keys.filter(function(k){ return !k.revoked_at; });
    if (!live.length) { box.innerHTML = ''; return; }

    box.innerHTML =
      '<div style="font-size:11px;color:var(--text3);margin:10px 0 6px;text-transform:uppercase;letter-spacing:0.5px">Your keys</div>' +
      live.map(function(k) {
        var used = k.last_used_at
          ? 'last used ' + _relDays(k.last_used_at)
          : 'never used';
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;background:var(--bg);border:1px solid var(--border2);border-radius:var(--r-sm);margin-bottom:4px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:11px;font-family:monospace;color:var(--text2)">' + esc(k.key_prefix) + '…</div>' +
            '<div style="font-size:11px;color:var(--text3)">' + esc(k.label || 'Key') + ' · ' + used + '</div>' +
          '</div>' +
          '<button onclick="revokeConnectorKey(\'' + k.id + '\')" style="background:none;border:1px solid var(--border2);border-radius:var(--r-sm);color:var(--text3);font-size:11px;cursor:pointer;padding:3px 8px;font-family:var(--sans)">Revoke</button>' +
        '</div>';
      }).join('');
  } catch(e) { box.innerHTML = ''; }
}

function _relDays(iso) {
  var t = new Date(iso).getTime();
  if (!t) return 'unknown';
  var days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return days + ' days ago';
}

async function revokeConnectorKey(keyId) {
  if (!confirm('Revoke this key? Any Claude connection using it stops working immediately.')) return;
  try {
    await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'revoke_connector_key', key_id: keyId })
    });
    renderConnectorKeys();
  } catch(e) { alert('Could not revoke: ' + e.message); }
}

function getClaudeConfig() {
  return JSON.stringify({ mcpServers: { samoratrack: { url: _connectorHost + '/api/connector/mcp?token=' + _connectorToken } } }, null, 2);
}

function showClaudeInstallCmd(platform) {
  var mcpUrl = _connectorHost + '/api/connector/mcp?token=' + _connectorToken;
  var panel  = document.getElementById('claudeInstallCmdPanel');
  var lbl    = document.getElementById('claudeInstallPlatformLabel');
  var cmdEl  = document.getElementById('claudeInstallCmd');
  var step1  = document.getElementById('claudeInstallStep1');
  var step2  = document.getElementById('claudeInstallStep2');
  if (!panel) return;
  if (platform === 'mac') {
 lbl.textContent = 'Mac, paste this in Terminal (no file download, no security warning)';
    step1.innerHTML   = 'Step 1: Press <strong>Cmd + Space</strong> → type <strong>Terminal</strong> → press Enter';
    _currentInstallCmd = "python3 -c \"import json,os; p=os.path.expanduser('~/Library/Application Support/Claude/claude_desktop_config.json'); c=json.load(open(p)) if os.path.exists(p) else {}; c.setdefault('mcpServers',{})['samoratrack']={'url':'" + mcpUrl + "'}; json.dump(c,open(p,'w'),indent=2); print('Done! Restart Claude Desktop.')\"";
    step2.innerHTML   = 'Step 2: Paste the command above → press <strong>Enter</strong><br>Step 3: Quit Claude Desktop (Cmd+Q) → reopen → look for <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.2 14.4a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1v.2a2 2 0 01-4 0v-.1a1.6 1.6 0 00-2.8-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 010-4h.1a1.6 1.6 0 001.1-2.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 014 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7h.2a2 2 0 010 4h-.1a1.6 1.6 0 00-1.4 1.1z"/></svg> in chat';
  } else {
 lbl.textContent = 'Windows, paste this in PowerShell';
    step1.innerHTML   = 'Step 1: Press <strong>Win + X</strong> → click <strong>Terminal</strong> or <strong>PowerShell</strong>';
    _currentInstallCmd = '$p="$env:APPDATA\\Claude\\claude_desktop_config.json"; if(Test-Path $p){$c=Get-Content $p|ConvertFrom-Json}else{$c=[PSCustomObject]@{}}; if(!$c.mcpServers){$c|Add-Member mcpServers([PSCustomObject]@{})}; $c.mcpServers|Add-Member samoratrack @{url="' + mcpUrl + '"} -Force; $c|ConvertTo-Json -Depth 5|Set-Content $p; Write-Host "Done! Restart Claude Desktop."';
    step2.innerHTML   = 'Step 2: Paste the command → press <strong>Enter</strong><br>Step 3: Close and reopen Claude Desktop → look for <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.2 14.4a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1v.2a2 2 0 01-4 0v-.1a1.6 1.6 0 00-2.8-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 010-4h.1a1.6 1.6 0 001.1-2.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 014 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7h.2a2 2 0 010 4h-.1a1.6 1.6 0 00-1.4 1.1z"/></svg> in chat';
  }
  cmdEl.textContent   = _currentInstallCmd;
  panel.style.display = 'block';
}

function copyInstallCmd() {
  var btn = document.getElementById('copyCmdBtn');
  navigator.clipboard.writeText(_currentInstallCmd).then(function() {
 if (btn) { btn.textContent = 'Copied!'; btn.style.background = 'var(--green)'; }
    setTimeout(function() { if (btn) { btn.textContent = 'Copy'; btn.style.background = 'var(--gold)'; } }, 2000);
  });
}

function copyField(el) {
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(function() {
    var orig = el.style.color; el.style.color = 'var(--green)';
    setTimeout(function() { el.style.color = orig; }, 1500);
  });
}

function copyGPTSetup() {
  var host = _connectorHost; var token = _connectorToken;
  var text = 'SamoraOS → ChatGPT Custom GPT (admin setup)\n\n1. chat.openai.com → My GPTs → Create a GPT → Configure tab\n2. Name: "SamoraOS Intelligence"\n3. Actions → Create new action → Import from URL:\n   ' + host + '/api/connector/openapi.json\n4. Authentication: API Key → Bearer → token: ' + token + '\n5. Save → Publish → Share GPT link with team\n\nTeam clicks the link. No setup. Just chat.\n\nExample: "What is going wrong with my pipeline?", "Who needs coaching?", "Analyse last week IVR"';
  navigator.clipboard.writeText(text).then(function() { showToast('ChatGPT setup steps copied'); });
}

function copyGeminiSetup() {
  var host = _connectorHost; var token = _connectorToken;
  var text = 'SamoraOS → Gemini (admin setup)\n\nAPI base: ' + host + '/api/connector\nAuth: Authorization: Bearer ' + token + '\nSchema: GET ' + host + '/api/connector/gemini-tools\n\nEndpoints (POST):\n  /get_pipeline, /get_coverage, /get_intent_vs_reality\n  /get_team_overview, /get_daily_brief, /get_account_signals\n\nFor Gems: gemini.google.com → Gems → Create → add API config above → Share link';
  navigator.clipboard.writeText(text).then(function() { showToast('Gemini setup steps copied'); });
}

// ── Enrichment provider management ───────────────────────────────────────────
var _enrichKeyProvider = '';
var _userHabits = null;  // null = not yet loaded, [] = loaded but empty

function showEnrichmentInput(provider) {
  _enrichKeyProvider = provider;
  var panel = document.getElementById('enrichmentKeyInput');
  var hint  = document.getElementById('enrichmentKeyHint');
  var links = { apollo:'apollo.io → Settings → API', lusha:'lusha.com → Settings → API', hunter:'hunter.io → API' };
  if (hint)  hint.textContent = 'Get your key at ' + links[provider];
  if (panel) panel.style.display = 'block';
  document.getElementById('enrichmentKeyValue')?.focus();
}

async function saveEnrichmentKey(provider, scope) {
  var val = scope === 'org'
    ? document.getElementById(provider + 'OrgKey')?.value?.trim()
    : document.getElementById('enrichmentKeyValue')?.value?.trim();
  if (!val) { showToast('Paste an API key first'); return; }
  try {
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'save_enrichment_key', provider, scope, key: val })
    });
    var d = await r.json();
    if (d.ok) {
      showToast(provider.charAt(0).toUpperCase() + provider.slice(1) + ' connected');
      _updateEnrichmentStatus(provider, scope, true);
      if (scope === 'user') {
        document.getElementById('enrichmentKeyInput').style.display = 'none';
        document.getElementById('enrichmentKeyValue').value = '';
      } else {
        document.getElementById(provider + 'OrgKey').value = '';
      }
    } else { showToast('Error: ' + (d.error || 'Save failed')); }
  } catch(e) { showToast('Error: ' + e.message); }
}

// via: 'user' | 'org' | null. The distinction matters to the rep, because
// removing a personal key does NOT disconnect a provider the org has set, and
// the row used to read "Not connected" on a provider that was working fine
// through the org key.
function _updateEnrichmentStatus(provider, scope, connected, via) {
  var elId  = provider + (scope === 'org' ? 'OrgStatus' : 'UserStatus');
  var btnId = provider + (scope === 'org' ? 'OrgBtn'    : 'UserBtn');
  var el  = document.getElementById(elId);
  var btn = document.getElementById(btnId);

  var label = !connected ? 'Not connected'
    : (scope === 'user' && via === 'org') ? '\u2713 Connected via your organisation'
    : '\u2713 Connected';
  if (el) { el.textContent = label; el.style.color = connected ? 'var(--green)' : 'var(--text3)'; }

  if (btn && scope === 'user') {
    // Only a key this person owns can be removed by this person. An org key
    // belongs to the admin, so the button offers to override it instead.
    if (via === 'user') { btn.textContent = 'Disconnect'; btn.onclick = function(){ disconnectEnrichment(provider); }; }
    else if (via === 'org') { btn.textContent = 'Use my own key'; btn.onclick = function(){ showEnrichmentInput(provider); }; }
    else { btn.textContent = 'Connect'; btn.onclick = function(){ showEnrichmentInput(provider); }; }
  }
}

async function disconnectEnrichment(provider) {
  if (!confirm('Remove your personal ' + provider + ' key?')) return;
  try {
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'clear_enrichment_key', provider: provider, scope: 'user' })
    });
    var d = await r.json();
    if (d.ok) { showToast(d.note || 'Disconnected'); loadEnrichmentStatus(); }
    else showToast('Error: ' + (d.error || 'Could not disconnect'));
  } catch(e) { showToast('Error: ' + e.message); }
}

async function loadEnrichmentStatus() {
  // Paint the known-nothing state first. The buttons no longer carry an inline
  // onclick, so without this they would be dead until the request returns.
  ['apollo','lusha','hunter'].forEach(function(p) {
    _updateEnrichmentStatus(p, 'user', false, null);
    _updateEnrichmentStatus(p, 'org',  false, null);
  });
  try {
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'get_enrichment_status' })
    });
    var d = await r.json();
    if (d.ok && d.providers) {
      ['apollo','lusha','hunter'].forEach(function(p) {
        var hasOrg  = !!d.providers[p + '_org'];
        var hasUser = !!d.providers[p + '_user'];
        _updateEnrichmentStatus(p, 'org', hasOrg, hasOrg ? 'org' : null);
        // A personal key wins over the org key, so that is what the row
        // reports. Previously this branch only ran when a USER key existed,
        // which is why an org-key-only setup read as "Not connected" to every
        // rep while enrichment was quietly working.
        _updateEnrichmentStatus(p, 'user', hasUser || hasOrg, hasUser ? 'user' : (hasOrg ? 'org' : null));
      });
    }
  } catch(e) {}
}

// The Gmail and Outlook buttons on the You tab carry their state in
// data-state (idle, busy, connected, broken, other) and the CSS draws it.
// Nothing here paints colours or rewrites the button's markup.
function _youProvider(id, state, text) {
  var b = document.getElementById(id); if (!b) return;
  b.setAttribute('data-state', state);
  b.disabled = state === 'busy';
  var s = b.querySelector('.you-provider-s'); if (s) s.textContent = text;
  var name = id === 'youOutlookBtn' ? 'Outlook' : 'Gmail';
  b.setAttribute('aria-label', name + ': ' + (state === 'connected' ? 'connected' : state === 'broken' ? 'needs reconnecting' : text));
}
async function refreshYouTabConnections() {
  // Sync connection status labels from edge function
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_email_provider'}) });
    var d = await r.json();
    var lbl = document.getElementById('youEmailConnLabel');
    var sub = document.getElementById('youEmailConnSub');
    var chip = document.getElementById('youEmailChip');
    var setChip = function (cls, t) { if (chip) { chip.className = 'you-row-v you-chip ' + cls; chip.textContent = t; } };
    if (d.connected) {
      var pname = d.provider === 'microsoft' ? 'Outlook' : 'Gmail';
      // A dead grant leaves the row in place, so "connected" alone was green
      // while every sync failed. healthy === false is the state that matters.
      var broken = d.healthy === false;
      if (lbl) lbl.textContent = d.demo ? 'Demo mailbox (simulated)' : (broken ? pname + ' needs reconnecting' : pname + ' connected');
      if (sub) sub.textContent = broken
        ? (d.email ? d.email + '. ' : '') + (d.reason || 'Reconnect to resume syncing.') + ' Until then no replies, signals or coverage can be read from this mailbox.'
        : (d.demo ? 'Demo workspace: mailbox evidence is simulated, nothing is read from a live inbox' : (d.email || '') + ' \u00b7 replies, calendar and signals sync from here');
      if (lbl) lbl.setAttribute('data-state', broken ? 'broken' : 'ok');
      var mine = d.provider === 'microsoft' ? 'youOutlookBtn' : 'youGmailBtn';
      var other = d.provider === 'microsoft' ? 'youGmailBtn' : 'youOutlookBtn';
      _youProvider(mine, broken ? 'broken' : 'connected', broken ? 'Reconnect' : (d.demo ? 'Demo' : 'Connected'));
      _youProvider(other, 'other', 'Switch');
      setChip(broken ? 'bad' : 'ok', broken ? 'Reconnect' : pname);
      _youSetupSet('email', !broken);
    } else {
      if (lbl) { lbl.textContent = 'Not connected'; lbl.setAttribute('data-state', 'idle'); }
      if (sub) sub.textContent = 'Connect your work mailbox to turn on coverage checks, reply tracking, calendar sync and your SAM brief.';
      _youProvider('youGmailBtn', 'idle', 'Connect');
      _youProvider('youOutlookBtn', 'idle', 'Connect');
      setChip('warn', 'Not connected');
      _youSetupSet('email', false);
    }
    var disc = document.getElementById('youMailDisconnect');
    if (disc) disc.hidden = !(d.connected && !d.demo);
    // Also update SAM tab label
    var samLbl = document.getElementById('samGmailLabel'); var samSub = document.getElementById('samGmailSub');
    if (d.connected) {
 if (samLbl) samLbl.textContent = (d.provider === 'microsoft' ? 'Outlook' : 'Gmail') + (d.healthy === false ? ' needs reconnecting' : ' connected');
      if (samSub) samSub.textContent = d.healthy === false ? (d.reason || 'Reconnect under Settings.') : (d.demo ? 'Demo workspace: mailbox evidence is simulated' : 'Signals refreshed · ' + esc(d.email));
      if (d.demo && samLbl) samLbl.textContent = 'Demo mailbox';
    }
  } catch(e) {}

  // Habits preview
  if (_userHabits !== null) { _updateHabitsPreview(); }

  // Notetaker status
  try {
    var nr = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_user_connections'}) });
    var nd = await nr.json();
    var ns = document.getElementById('youNotetakerStatus');
    _youSetupSet('notetaker', !!(nd.connections && nd.connections.length));
    if (ns && nd.connections && nd.connections.length) {
      ns.innerHTML = nd.connections.map(function(c){ return '<span style="color:var(--green)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> '+esc(c.provider)+(c.provider_email?' ('+esc(c.provider_email)+')':'')+'</span>'; }).join(', ');
    }
  } catch(e) {}

  // Push notification status
  refreshPushStatus();
}

// ── Push notifications (Web Push, VAPID) ──────────────────────────────────────
// Requires: a VAPID public key (set below), the sw.js push handlers, and the
// edge actions save_push_subscription / remove_push_subscription / send_push.
// iOS note: only works when SamoraTrack is installed to the Home Screen.
// Public VAPID key — safe to embed. MUST match the VAPID_PUBLIC_KEY secret set
// on the edge function. If you generated a different key pair, replace the
// fallback string below. Read LAZILY (via _getVapidKey) because window._orgConfig
// is populated asynchronously after load, so evaluating it once at parse time
// would always miss it.
var VAPID_PUBLIC_KEY_FALLBACK = 'BOSxqHYKqUfcnxAk_JGPO6Qmz7o85d538CiwQ3asDWyGPu0C9OC3BZPmcW790AzJ6tyDHa5SmjTLCfkqfS2l_qU';
function _getVapidKey() {
  try { return (window._orgConfig && window._orgConfig.vapidPublicKey) || VAPID_PUBLIC_KEY_FALLBACK; }
  catch (e) { return VAPID_PUBLIC_KEY_FALLBACK; }
}
function _urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var raw = atob(base64);
  var out = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function _pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
function _isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// ══ INSTALL AS AN APP ══════════════════════════════════════════════════════
// Android Chrome, Edge and Samsung Internet fire beforeinstallprompt once the
// manifest, icons and service worker qualify. We hold on to it so OUR button
// can open the browser's real install dialog: one tap, then it is on the home
// screen. iPhone has no such event and no API at all; Apple only allows Share,
// then Add to Home Screen, so there the button opens a three-step guide.
var _deferredInstall = null;
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  _deferredInstall = e;
  _maybeShowInstallBar();
  try { refreshInstallStatus(); } catch (_e) {}
});
window.addEventListener('appinstalled', function () {
  _deferredInstall = null;
  _hideInstallBar();
  try { showToast('SamoraOS is on your home screen'); } catch (_e) {}
  try { refreshInstallStatus(); } catch (_e) {}
});
function _isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function _isPhoneSized() {
  return window.matchMedia('(max-width: 899px)').matches && window.matchMedia('(pointer: coarse)').matches;
}
async function installSamoraApp() {
  if (_isStandalone()) { try { showToast('You are already using the installed app'); } catch (_e) {} return; }
  if (_deferredInstall) {
    var ev = _deferredInstall;
    _deferredInstall = null;            // a prompt can only be used once
    try {
      ev.prompt();
      var choice = await ev.userChoice;
      if (choice && choice.outcome === 'accepted') _hideInstallBar();
    } catch (e) { _showInstallGuide(); }
    try { refreshInstallStatus(); } catch (_e) {}
    return;
  }
  _showInstallGuide();
}
function _showInstallGuide() {
  document.getElementById('installSheet')?.remove();
  var ios = _isIOS();
  var shareIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>';
  var steps = ios
    ? ['Tap the Share button ' + shareIcon + ' in the browser bar (bottom of the screen in Safari, top right in Chrome).',
       'Scroll down the list and tap <strong>Add to Home Screen</strong>.',
       'Tap <strong>Add</strong>. SamoraOS now opens from its own icon, full screen.']
    : ['Open your browser menu (the three dots, top right).',
       'Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.',
       'Confirm. SamoraOS now opens from its own icon, full screen.'];
  var el = document.createElement('div');
  el.className = 'install-sheet'; el.id = 'installSheet';
  el.innerHTML = '<div class="install-sheet-in" onclick="event.stopPropagation()">' +
    '<h3>Add SamoraOS to your home screen</h3>' +
    '<p>' + (ios ? 'On iPhone this takes three taps. It is also what lets SamoraOS send you notifications.' : 'Your browser did not offer a one-tap install here, so it takes three taps from its menu.') + '</p>' +
    steps.map(function (t, i) { return '<div class="install-step"><b>' + (i + 1) + '</b><div>' + t + '</div></div>'; }).join('') +
    '<button class="install-sheet-done" onclick="document.getElementById(\'installSheet\').remove()">Got it</button>' +
  '</div>';
  el.addEventListener('click', function () { el.remove(); });
  document.body.appendChild(el);
}

// The bar itself. Phones only, never inside the installed app, and once
// dismissed it stays away for two weeks: the You tab keeps a permanent
// Install row for anyone who changes their mind.
function _installDismissedRecently() {
  try { var t = parseInt(localStorage.getItem('dt-install-dismissed') || '0', 10); return t && (Date.now() - t) < 14 * 86400000; } catch (e) { return false; }
}
function dismissInstallBar() {
  try { localStorage.setItem('dt-install-dismissed', String(Date.now())); } catch (e) {}
  _hideInstallBar();
}
function _hideInstallBar() { var b = document.getElementById('installBar'); if (b) b.classList.remove('show'); }
function _maybeShowInstallBar() {
  if (_isStandalone() || !_isPhoneSized() || _installDismissedRecently()) return;
  var b = document.getElementById('installBar');
  if (!b) {
    b = document.createElement('div');
    b.id = 'installBar'; b.className = 'install-bar';
    b.innerHTML = '<img src="/icons/icon-96.png" alt="">' +
      '<div><div class="install-bar-t">Get SamoraOS on your home screen</div><div class="install-bar-s">Opens full screen, like an app</div></div>' +
      '<button class="install-bar-go" onclick="installSamoraApp()">Install</button>' +
      '<button class="install-bar-x" aria-label="Not now" onclick="dismissInstallBar()">×</button>';
    document.body.appendChild(b);
  }
  // On the sign-in screen nothing else lives at the bottom. Inside the app the
  // bottom belongs to the nav bar and the SAM button, so the bar sits on top.
  var onAuth = !!document.getElementById('authScreen')?.classList.contains('active');
  b.classList.toggle('at-bottom', onAuth);
  b.classList.toggle('at-top', !onAuth);
  b.classList.add('show');
}
function refreshInstallStatus() {
  // The row exists for phones and tablets that are not yet running the
  // installed app. Inside the app, or on a desktop browser, it said "already
  // installed" or offered something nobody needs, so it is not shown at all.
  var row = document.getElementById('youAcc-install');
  if (row) row.style.display = (_isStandalone() || !(_isPhoneSized() || _isIOS())) ? 'none' : '';
  var st = document.getElementById('youInstallStatus');
  var btn = document.getElementById('youInstallBtn');
  if (!st || !btn) return;
  if (_isStandalone()) {
    st.innerHTML = '<span style="color:var(--green)">Installed. You are using the app now.</span>';
    btn.style.display = 'none';
  } else if (_deferredInstall) {
    st.textContent = 'Ready to install in one tap.';
    btn.style.display = ''; btn.textContent = 'Install SamoraOS';
  } else {
    st.textContent = _isIOS() ? 'On iPhone this is three taps from the Share menu.' : 'Install from your browser menu, or tap below for the steps.';
    btn.style.display = ''; btn.textContent = _isIOS() ? 'Show me how' : 'Install SamoraOS';
  }
}
// iPhone never fires beforeinstallprompt, so offer the guide on a timer
// instead. Android waits for the event, so the button always works first time.
setTimeout(function () { if (_isIOS()) _maybeShowInstallBar(); }, 2500);
// Re-place the bar when the user signs in or out, since the auth screen and
// the app want it at different edges.
(function () {
  var hook = function () {
    var scr = document.getElementById('authScreen');
    if (!scr) return;
    new MutationObserver(function () {
      var b = document.getElementById('installBar');
      if (b && b.classList.contains('show')) _maybeShowInstallBar();
    }).observe(scr, { attributes: true, attributeFilter: ['class'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
})();
function _youPushChip(cls, t) { var c = document.getElementById('youPushChip'); if (c) { c.className = 'you-row-v you-chip ' + cls; c.textContent = t; } _youSetupSet('push', cls === 'ok'); }
async function refreshPushStatus() {
  var statusEl = document.getElementById('youPushStatus');
  var btn = document.getElementById('pushToggleBtn');
  var testBtn = document.getElementById('pushTestBtn');
  var hint = document.getElementById('youPushHint');
  if (!statusEl || !btn) return;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!_pushSupported()) {
    statusEl.innerHTML = '<span style="color:var(--text3)">Not supported on this browser</span>';
    _youPushChip('', 'Unavailable');
    btn.style.display = 'none';
    if (hint) hint.textContent = isIOS ? 'On iPhone, open SamoraOS from the Home Screen (Share → Add to Home Screen) to enable notifications.' : '';
    return;
  }
  if (isIOS && !_isStandalone()) {
    statusEl.innerHTML = '<span style="color:var(--amber)">Install to Home Screen first</span>';
    _youPushChip('warn', 'Install first');
    btn.style.display = 'none';
    if (hint) hint.textContent = 'On iPhone: tap Share → Add to Home Screen, then open SamoraOS from the new icon to turn on notifications.';
    return;
  }
  var subbed = false;
  try {
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    subbed = !!sub;
  } catch(e) {}
  if (Notification.permission === 'denied') {
    statusEl.innerHTML = '<span style="color:var(--coral)">Blocked in browser settings</span>';
    _youPushChip('bad', 'Blocked');
    btn.style.display = 'none';
    if (hint) hint.textContent = 'Notifications are blocked. Re-enable them for this site in your browser/site settings, then reload.';
    return;
  }
  if (subbed) {
    statusEl.innerHTML = '<span style="color:var(--green)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Notifications on for this device</span>';
 btn.textContent = 'Turn off'; btn.style.background = 'var(--surface2)'; btn.style.color = 'var(--text2)'; btn.style.border = '1px solid var(--border2)';
    if (testBtn) testBtn.style.display = '';
    if (hint) hint.textContent = '';
    _youPushChip('ok', 'On');
  } else {
    statusEl.innerHTML = '<span style="color:var(--text3)">Off on this device</span>';
 btn.textContent = 'Enable notifications'; btn.style.background = 'var(--gold)'; btn.style.color = 'var(--c-on-accent)'; btn.style.border = 'none';
    if (testBtn) testBtn.style.display = 'none';
    if (hint) hint.textContent = '';
    _youPushChip('', 'Off');
  }
}
async function togglePushNotifications() {
  var reg = await navigator.serviceWorker.ready;
  var sub = await reg.pushManager.getSubscription();
  if (sub) { await disablePushNotifications(); } else { await enablePushNotifications(); }
}
async function enablePushNotifications() {
  var btn = document.getElementById('pushToggleBtn');
  if (!_pushSupported()) { showToast('Push not supported on this browser'); return; }
  var VAPID_PUBLIC_KEY = _getVapidKey();
  if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.indexOf('REPLACE_WITH') === 0) { showToast('Push key not configured yet'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Enabling…'; }
  try {
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') { showToast('Notification permission not granted'); return; }
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    var json = sub.toJSON();
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'save_push_subscription', endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent }) });
    var d = await r.json();
 if (d.ok) showToast('Notifications enabled'); else showToast('Could not save subscription');
  } catch(e) { showToast('Enable failed: ' + (e.message||'error')); }
  finally { if (btn) btn.disabled = false; refreshPushStatus(); }
}
async function disablePushNotifications() {
  var btn = document.getElementById('pushToggleBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Turning off…'; }
  try {
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (sub) {
      var endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'remove_push_subscription', endpoint: endpoint }) }).catch(function(){});
    }
    showToast('Notifications turned off');
  } catch(e) { showToast('Could not turn off'); }
  finally { if (btn) btn.disabled = false; refreshPushStatus(); }
}
async function sendTestPush() {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
 body:JSON.stringify({ action:'send_push', to_self:true, title:'SamoraOS', body:'Notifications are working.', url:'/' }) });
    var d = await r.json();
    showToast(d.ok ? 'Test sent, check your notifications' : 'Test failed: ' + (d.error||''));
  } catch(e) { showToast('Test failed'); }
}

// ── Reminders ────────────────────────────────────────────────────────────────
// One-off or repeating reminders, delivered by the sam-cron function's
// run_reminders sweep. Can be opened blank (from the You tab) or prefilled
// from a specific task (from the Today list).
window._pendingReminderTaskIdx = null;
window._openReminder = function() {
  window._pendingReminderTaskIdx = null;
  var modal = document.getElementById('reminderModal'); if (!modal) return;
  document.getElementById('reminderTitle').value = '';
  var now = new Date(); now.setMinutes(now.getMinutes() + 30);
  document.getElementById('reminderDate').value = now.toISOString().slice(0,10);
  document.getElementById('reminderTime').value = now.toTimeString().slice(0,5);
  document.getElementById('reminderRepeat').value = 'none';
  modal.style.display = 'flex';
};
window._openReminderFromTask = function(e) {
  e.stopPropagation();
  var item = e.target.closest('[data-task-idx]');
  var idx = item ? parseInt(item.getAttribute('data-task-idx')) : null;
  var rawText = item ? (item.getAttribute('data-carry-text') || '') : '';
  var tmp = document.createElement('textarea'); tmp.innerHTML = rawText;
  window._openReminder();
  window._pendingReminderTaskIdx = idx;
  document.getElementById('reminderTitle').value = tmp.value || '';
};
function closeReminderModal() {
  var modal = document.getElementById('reminderModal'); if (modal) modal.style.display = 'none';
}
async function confirmCreateReminder() {
  var title = document.getElementById('reminderTitle').value.trim();
  var date = document.getElementById('reminderDate').value;
  var time = document.getElementById('reminderTime').value;
  var repeat = document.getElementById('reminderRepeat').value;
  if (!title) { alert('Please enter what this reminder is for'); return; }
  if (!date || !time) { alert('Please choose a date and time'); return; }
  var when = new Date(date + 'T' + time);
  if (isNaN(when.getTime())) { alert('Invalid date/time'); return; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'create_reminder', title: title, remind_at: when.toISOString(), repeat: repeat, url: '/?tab=today' }) });
    var d = await r.json();
    if (d.ok) { showToast('⏰ Reminder set'); closeReminderModal(); loadReminders(); }
    else showToast('Could not set reminder: ' + (d.error||''));
  } catch(e) { showToast('Could not set reminder'); }
}
async function loadReminders() {
  var el = document.getElementById('remindersList'); if (!el) return;
  el.textContent = 'Loading…';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'list_reminders' }) });
    var d = await r.json();
    var rows = (d.ok && d.reminders) || [];
    if (!rows.length) { el.innerHTML = '<div style="padding:6px 0">No upcoming reminders.</div>'; return; }
    var REPEAT_LABEL = { none:'Once', daily:'Daily', weekdays:'Weekdays', weekly:'Weekly' };
    el.innerHTML = rows.map(function(rm) {
      var when = new Date(rm.remind_at);
      var whenLbl = when.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}) + ' · ' + when.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<div style="flex:1"><div style="color:var(--text);font-size:13px">' + esc(rm.title) + '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + whenLbl + (rm.repeat !== 'none' ? ' · ' + REPEAT_LABEL[rm.repeat] : '') + '</div></div>' +
        '<button onclick="cancelReminder(\'' + rm.id + '\')" style="background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
    }).join('');
  } catch(e) { el.textContent = 'Could not load reminders.'; }
}
async function cancelReminder(id) {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'cancel_reminder', id: id }) });
    var d = await r.json();
    if (d.ok) { showToast('Reminder cancelled'); loadReminders(); }
    else showToast('Could not cancel');
  } catch(e) { showToast('Could not cancel'); }
}

// ── Fix market signals — show actual signal content ────────────────────────────
// The previous implementation only showed the account summary ("4 signals").
// Re-render the signal cards properly after fetch.
function renderMarketSignalCard(s) {
  if (!s) return '';
  var SIGNAL_TYPE_CONFIG2 = {
    hiring_signal: { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20v-1.5A4.5 4.5 0 017 14h4a4.5 4.5 0 014.5 4.5V20M16 4.3a3.5 3.5 0 010 6.4M18 14.3a4.5 4.5 0 013.5 4.2V20"/></svg>', label: 'Hiring', color: 'var(--blue)' },
    expansion:     { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>', label: 'Expansion', color: 'var(--green)' },
    funding:       { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v10M14.8 9.3A3 3 0 0012 7.8h-.4a2.2 2.2 0 000 4.4h.8a2.2 2.2 0 010 4.4H12a3 3 0 01-2.8-1.5"/></svg>', label: 'Funding', color: 'var(--green)' },
    leadership:    { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11.5a4 4 0 100-8 4 4 0 000 8zM4.5 20.5v-1A5.5 5.5 0 0110 14h4a5.5 5.5 0 015.5 5.5v1"/></svg>', label: 'Leadership change', color: 'var(--amber)' },
    news:          { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4.5h14v15H8.5a3.5 3.5 0 01-3.5-3.5z"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/></svg>', label: 'News', color: 'var(--text3)' },
    competitor:    { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l9 9M20 4l-9 9M4 20l5-5M20 20l-5-5"/></svg>',  label: 'Competitor move', color: 'var(--coral)' },
    at_risk:       { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg>', label: 'Risk signal', color: 'var(--coral)' },
    hot:           { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg>', label: 'Hot signal', color: 'var(--gold)' },
  };
  var ext = s.extracted || s.signal_payload || {};
  var sType = s.signal_type || 'news';
  var cfg = SIGNAL_TYPE_CONFIG2[sType] || { icon: '○', label: sType, color: 'var(--text3)' };
  var headline = ext.headline || s.raw_text || s.summary || '';
  var detail   = ext.detail   || s.detail   || '';
  var sourceUrl = ext.source_url || s.source_url || '';
  var sourceName = ext.source_name || s.source_name || '';
  var acctName = s.account_name || '';
  return '<div style="border-left:3px solid '+cfg.color+';padding:8px 10px;margin-bottom:6px;background:rgba(0,0,0,0.04);border-radius:0 6px 6px 0">' +
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">' +
      (acctName ? '<span style="font-size:11px;font-weight:600;color:var(--text)">'+esc(acctName)+'</span><span style="font-size:11px;color:var(--text3)">·</span>' : '') +
      '<span style="font-size:11px;padding:1px 7px;border-radius:var(--r-md);background:'+cfg.color+'20;color:'+cfg.color+';font-weight:600">'+cfg.icon+' '+cfg.label+'</span>' +
      (s.confidence >= 80 ? '<span style="font-size:11px;color:var(--green)">High confidence</span>' : '') +
    '</div>' +
    '<div style="font-size:12px;color:var(--text);line-height:1.5">'+esc(headline.slice(0,160))+'</div>' +
    (detail ? '<div style="font-size:11px;color:var(--text2);margin-top:3px;line-height:1.4">'+esc(detail.slice(0,180))+'</div>' : '') +
    (sourceUrl ? '<a href="'+esc(sourceUrl)+'" target="_blank" rel="noopener" style="font-size:11px;color:var(--blue);text-decoration:none;margin-top:3px;display:inline-block">'+esc(sourceName||'Source')+' →</a>' : '') +
  '</div>';
}

// Ends Samora's access to your mailbox: Google's grant is revoked, the stored
// tokens are deleted, and emails still queued from this mailbox are cancelled.
async function disconnectMailbox() {
  if (!currentUser || !currentUser.token) return;
  var post = function (body) {
    return fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  };
  var pending = 0;
  try { var p = await post({ action: 'disconnect_mailbox', preview: true }); pending = (p && p.pending) || 0; } catch (_e) {}
  var line = 'Disconnect your mailbox? Samora stops using your mail and calendar right away.' +
    (pending ? '\n\n' + pending + (pending === 1 ? ' scheduled email' : ' scheduled emails') + ' from this mailbox will be cancelled.' : '') +
    '\n\nYou can connect again at any time.';
  if (!confirm(line)) return;
  var btn = document.getElementById('youMailDisconnect'); if (btn) btn.disabled = true;
  try {
    var d = await post({ action: 'disconnect_mailbox' });
    if (!d || !d.ok) throw new Error((d && d.error) || 'Could not disconnect');
    showToast('Mailbox disconnected' + (d.cancelled ? ', ' + d.cancelled + (d.cancelled === 1 ? ' scheduled email' : ' scheduled emails') + ' cancelled' : '') + '.');
  } catch (e) {
    showToast('Could not disconnect: ' + e.message);
  } finally {
    if (btn) btn.disabled = false;
    try { refreshYouTabConnections(); } catch (_e) {}
  }
}

function connectGmail() {
  // The narrowest scopes the server uses, and exactly the ones listed for
  // Google verification: read mail (replies, out of office, meeting notes),
  // send the mail the rep schedules, read the calendar. Nothing modifies or
  // labels mail, so gmail.modify is not asked for.
  const scope = encodeURIComponent('openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.readonly');
  // Follows whichever host the app is open on (os.samoraglobal.com or
  // samoratrack.vercel.app). Both must be listed as authorised redirect URIs on
  // the SamoraStack Google OAuth client, or Google answers redirect_uri_mismatch.
  // Previously hardcoded to vercel.app, which on the new domain produced a
  // popup that completed and a message the browser silently discarded.
  const redirectUri = window.location.origin + '/gmail-callback.html';
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + GOOGLE_CLIENT_ID_SAM + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&response_type=code&scope=' + scope + '&access_type=offline&prompt=consent';
  const popup = window.open(url, 'gmail_oauth', 'width=500,height=600,left=200,top=100');
  window.addEventListener('message', async function handler(e) {
    if (e.origin !== window.location.origin) return;
    if (!e.data?.code) return;
    window.removeEventListener('message', handler);
    if (popup) popup.close();
    const btn = document.getElementById('samGmailBtn'); const label = document.getElementById('samGmailLabel');
    if (btn) { btn.textContent = 'Connecting…'; btn.disabled = true; }
    if (label) label.textContent = 'Connecting Gmail…';
    _youProvider('youGmailBtn', 'busy', 'Connecting');
    try {
      const r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'connect_gmail', code: e.data.code, redirect_uri: redirectUri, email: '' }) });
      const data = await r.json();
      if (data.ok || data.success) {
 if (label) label.textContent = 'Gmail connected' + (data.email ? ': ' + data.email : '');
        try { showToast('Gmail connected'); refreshYouTabConnections(); } catch (_e) {}
        try { _spAfterMailboxConnected(); } catch (_e) {}
        const sub = document.getElementById('samGmailSub'); if (sub) sub.textContent = 'Signals loading…';
        if (btn) { btn.textContent = 'Refresh'; btn.disabled = false; btn.onclick = loadSamSignals; }
        loadSamSignals();
      } else { throw new Error(data.error || 'Connection failed'); }
    } catch(err) {
      if (label) label.textContent = 'Connection failed: ' + err.message;
      if (btn) { btn.textContent = 'Try again'; btn.disabled = false; btn.onclick = connectGmail; }
      _youProvider('youGmailBtn', 'idle', 'Try again');
    }
  });
}

let _sortable = null;
function initSortable() {
  if (todayActiveSection !== 'tasks') return;
  const el = document.getElementById('today-list-tasks'); if (!el) return;
  if (typeof Sortable === 'undefined') return;
  try { if (_sortable) _sortable.destroy(); } catch(e) {}
  _sortable = null;
  try {
    _sortable = Sortable.create(el, {
      animation: 150, handle: '.drag-handle', ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
      onEnd: function(evt) {
        if (evt.oldIndex === evt.newIndex) return;
        const d = dayData(viewDate);
        const moved = d.tasks.splice(evt.oldIndex, 1)[0];
        d.tasks.splice(evt.newIndex, 0, moved);
        save(viewDate); updateBadges(); updateSectionPillCounts();
      }
    });
  } catch(e) {}
}

function calcDayScore(tasks) {
  if (!tasks || !tasks.length) return { score: 0, completion: 0, rhythm: 0, breakdown: [] };
  let completionPts = 0, rhythmPts = 0;
  const maxCompletion = 60, maxRhythm = 40;
  const breakdown = [];
  tasks.forEach(function(t) {
    const isPriority = t.priority || (t.text||'').startsWith('*');
    const basePoints = isPriority ? 2 : 1;
    if (t.done) {
      completionPts += basePoints;
      let rhythmMultiplier = 1.0, rhythmLabel = 'On time';
      if (t.completedAt) {
        const completedHour = parseInt((t.completedAt || '').split(':')[0]) || 12;
        if (completedHour < 12) { rhythmMultiplier = 1.5; rhythmLabel = 'Before noon <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.8l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 10l5.9-.8z"/></svg>'; }
        else if (completedHour < 15) { rhythmMultiplier = 1.2; rhythmLabel = 'Before 3pm <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>'; }
        else if (completedHour < 18) { rhythmMultiplier = 1.0; rhythmLabel = 'Before 6pm'; }
        else { rhythmMultiplier = 0.7; rhythmLabel = 'After 6pm'; }
      }
      rhythmPts += basePoints * rhythmMultiplier;
      breakdown.push({ text: (t.text||'').slice(0,40), done: true, rhythmLabel, priority: isPriority });
    } else { breakdown.push({ text: (t.text||'').slice(0,40), done: false, rhythmLabel: 'Not done', priority: isPriority }); }
  });
  const maxPossibleCompletion = tasks.length * 2;
  const maxPossibleRhythm = tasks.length * 2 * 1.5;
  const completionScore = Math.round((completionPts / Math.max(maxPossibleCompletion, 1)) * maxCompletion);
  const rhythmScore = Math.round((rhythmPts / Math.max(maxPossibleRhythm, 1)) * maxRhythm);
  return { score: Math.min(100, completionScore + rhythmScore), completion: completionScore, rhythm: rhythmScore, breakdown };
}
function calcWeekScore(dateScores) {
  if (!dateScores.length) return 0;
  const weights = { 1:1.2, 2:1.1, 3:1.0, 4:1.0, 5:0.9 };
  let total = 0, totalWeight = 0;
  dateScores.forEach(function(d) { const day = new Date(d.date).getDay() || 7; const w = weights[day] || 1; total += d.score * w; totalWeight += w; });
  return Math.round(total / Math.max(totalWeight, 1));
}
function scoreColor(score) { return score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--coral)'; }
function scoreLabel(score) { return score >= 80 ? 'On track' : score >= 60 ? 'Getting there' : score >= 40 ? 'Needs focus' : 'Behind'; }

function renderProductivityBanner(tasks) {
  // Daily score / rhythm banner removed to reclaim screen space.
  var _pb0 = document.getElementById('productivityBanner'); if (_pb0) { _pb0.innerHTML=''; _pb0.style.display='none'; } return;
  const banner = document.getElementById('productivityBanner'); if (!banner) return;
  const { score, completion, rhythm } = calcDayScore(tasks);
  const col = scoreColor(score); const label = scoreLabel(score);
  const pending = tasks.filter(function(t){return !t.done;}).length;
  const done = tasks.filter(function(t){return t.done;}).length;
  const hour = new Date().getHours();
  const r = 28, cx = 36, cy = 36, circ = 2 * Math.PI * r, filled = circ * (score / 100);
  const ringHtml = '<svg width="72" height="72" viewBox="0 0 72 72"><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--surface2)" stroke-width="6"/><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="6" stroke-dasharray="'+filled+' '+(circ-filled)+'" stroke-linecap="round" style="transition:stroke-dasharray 0.5s"/></svg>';
  const weekDates = [];
  const today_ = new Date();
  for (let i = 4; i >= 0; i--) { const d = new Date(today_); d.setDate(today_.getDate()-i); const key = d.toISOString().split('T')[0]; const dd = dayData(key); const dayScore = (dd.tasks||[]).length ? calcDayScore(dd.tasks).score : null; weekDates.push({ date: key, score: dayScore, isToday: i===0, label: ['M','T','W','T','F','S','S'][d.getDay()===0?6:d.getDay()-1] }); }
  const weekScore = calcWeekScore(weekDates.filter(function(d){return d.score!==null;}).map(function(d){return {date:d.date,score:d.score};}));
  let nudge = '';
  if (pending > 0) {
    if (hour < 12) nudge = pending+' task'+(pending>1?'s':'')+' open, finish by noon for a perfect score';
    else if (hour < 15) nudge = pending+' task'+(pending>1?'s':'')+' open, close them before 3pm';
    else if (hour < 18) nudge = pending+' task'+(pending>1?'s':'')+' remaining, finish before 6pm';
    else nudge = pending+' task'+(pending>1?'s':'')+' still open, complete them now';
  } else if (tasks.length > 0) { nudge = 'All done! Great work today <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M9.5 20h5M12 14v6"/></svg>'; }
  banner.style.display = 'block';
  // Compact by default: one row (ring + label + mini week bars), everything
  // else behind the "details" toggle. The tasks list is the hero of this
  // screen, the score banner is a glance, not a dashboard.
  var _bnOpen = window._scoreBannerOpen ? 'block' : 'none';
  var _bnChev = window._scoreBannerOpen ? '▴' : '▾';
  banner.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius-lg);padding:8px 12px">' +
    '<div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="window._scoreBannerOpen=!window._scoreBannerOpen;renderProductivityBanner(dayData(todayKey()).tasks||[])">' +
    '<div class="score-ring" style="transform:scale(0.72);transform-origin:left center;margin-right:-18px">' + ringHtml + '<div class="score-num" style="color:'+col+'">'+score+'</div></div>' +
    '<div style="flex:1;min-width:0">' +
      '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="font-size:13px;font-weight:600;color:'+col+'">'+label+'</span><span style="font-size:11px;color:var(--text3)">'+done+'/'+tasks.length+' done</span>' +
      (nudge?'<span style="font-size:11px;color:var(--text3);font-style:italic">'+esc(nudge)+'</span>':'') + '</div>' +
    '</div>' +
    '<div style="display:flex;gap:3px;align-items:flex-end;flex-shrink:0;width:90px">' +
      weekDates.map(function(d){ const h=d.score!==null?Math.max(3,Math.round((d.score/100)*16)):3; const bc=d.score!==null?scoreColor(d.score):'var(--surface2)'; const opacity=d.isToday?'1':'0.5'; return '<div style="flex:1;text-align:center"><div style="height:'+h+'px;background:'+bc+';border-radius:var(--r-sm);opacity:'+opacity+'"></div></div>'; }).join('') +
    '</div>' +
    '<span style="font-size:11px;color:var(--text3);flex-shrink:0">'+_bnChev+'</span>' +
    '</div>' +
    '<div style="display:'+_bnOpen+';padding-top:8px;margin-top:6px;border-top:1px solid var(--border)">' +
      '<div style="display:flex;gap:12px;margin-bottom:6px"><div style="font-size:11px;color:var(--text3)">Completion <span style="color:var(--text2);font-weight:500">'+completion+'</span></div><div style="font-size:11px;color:var(--text3)">Rhythm <span style="color:var(--text2);font-weight:500">'+rhythm+'</span></div><div style="font-size:11px;color:var(--text3)">Week avg <span style="color:var(--text2);font-weight:500">'+weekScore+'</span></div></div>' +
      '<div style="display:flex;gap:4px;align-items:flex-end;margin-bottom:6px">' +
        weekDates.map(function(d){ const h=d.score!==null?Math.max(4,Math.round((d.score/100)*22)):4; const bc=d.score!==null?scoreColor(d.score):'var(--surface2)'; const opacity=d.isToday?'1':'0.5'; return '<div style="flex:1;text-align:center"><div style="height:'+h+'px;background:'+bc+';border-radius:var(--r-sm);opacity:'+opacity+';margin-bottom:2px"></div><div style="font-size:11px;color:'+(d.isToday?'var(--gold)':'var(--text3)')+'">'+d.label+'</div></div>'; }).join('') +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><div style="font-size:11px;color:var(--green)">● Before noon = 1.5×</div><div style="font-size:11px;color:var(--amber)">● Before 3pm = 1.2×</div><div style="font-size:11px;color:var(--text3)">● Before 6pm = 1×</div><div style="font-size:11px;color:var(--coral)">● After 6pm = 0.7×</div></div>' +
    '</div></div>';
}

let samSearchPeriod = 'all';
function setSamPeriod(period, btn) {
  samSearchPeriod = period;
  document.querySelectorAll('.sam-period-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  const customRange = document.getElementById('samCustomRange'); if (customRange) customRange.style.display = period === 'custom' ? 'flex' : 'none';
  if (period === 'custom') { const to = new Date(); const from = new Date(); from.setDate(from.getDate()-30); const fmt = d => d.toISOString().split('T')[0]; const fromEl = document.getElementById('samDateFrom'); const toEl = document.getElementById('samDateTo'); if (fromEl && !fromEl.value) fromEl.value = fmt(from); if (toEl && !toEl.value) toEl.value = fmt(to); }
}
async function runSamAccountSearch() {
  const query = document.getElementById('samSearchInput')?.value?.trim(); if (!query || !currentUser?.token) return;
  const out = document.getElementById('samSearchOutput');
  if (out) out.innerHTML = '<div style="padding:12px;font-size:13px;color:var(--text3)">Scanning Gmail for ' + esc(query) + '…</div>';
  let dateFrom = '', dateTo = '';
  if (samSearchPeriod === 'custom') { dateFrom = document.getElementById('samDateFrom')?.value||''; dateTo = document.getElementById('samDateTo')?.value||''; }
  try {
    const r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'search_account', query, days: samSearchPeriod==='all'?0:parseInt(samSearchPeriod), date_from: dateFrom, date_to: dateTo }) });
    const data = await r.json();
    if (!data.connected) { if (out) out.innerHTML = '<div style="font-size:13px;color:var(--coral);padding:12px">Gmail not connected</div>'; return; }
    if (!data.threads?.length) { if (out) out.innerHTML = '<div style="font-size:13px;color:var(--text3);padding:12px">No sent emails found for "' + esc(query) + '"</div>'; return; }
    const a = data.analysis || {};
    const totalFound = data.totalFound || data.threads?.length || 0;
    const totalReplies = data.inboxThreads?.length || 0;
    const intel = data.intelligence || [];
    const sentimentColor = {positive:'var(--green)',neutral:'var(--amber)',negative:'var(--coral)'}[a.sentiment]||'var(--text3)';

    let html = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius-lg);padding:16px;margin-top:8px">';
    html += '<div style="font-family:var(--serif);font-size:20px;font-weight:500;margin-bottom:8px">' + esc(query) + '</div>';

    // Coverage summary — sent + replies, all channels we have evidence for
    html += '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px;font-size:12px;color:var(--text3)">' +
      '<span><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> <b style="color:var(--text)">' + totalFound + '</b> emails sent</span>' +
      '<span>↩ <b style="color:' + (totalReplies>0?'var(--green)':'var(--text3)') + '">' + totalReplies + '</b> replies received</span>';
    if (a.sentiment) html += '<span style="padding:2px 8px;border-radius:var(--r-md);background:rgba(0,0,0,0.1);color:'+sentimentColor+';font-weight:500">'+a.sentiment+'</span>';
    html += '</div>';

    if (a.summary) html += '<div style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:14px;padding:12px 14px;background:var(--surface2);border-radius:var(--radius);border-left:3px solid var(--gold)"><div style="font-size:11px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> SAM Analysis</div>' + esc(a.summary) + '</div>';

    // Recent replies — the actual evidence of two-way engagement, not just outbound
    if (data.inboxThreads?.length) {
      html += '<div style="margin-bottom:14px">';
      html += '<div style="font-size:11px;font-weight:600;color:var(--green);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">↩ Recent replies</div>';
      data.inboxThreads.slice(0,3).forEach(function(t) {
        html += '<div style="background:rgba(74,140,92,0.06);border:1px solid rgba(74,140,92,0.2);border-radius:var(--r-sm);padding:8px 12px;margin-bottom:6px">' +
          '<div style="font-size:12px;font-weight:500;color:var(--text)">' + esc(t.subject||'') + '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + esc(t.from||'') + ' · ' + esc(t.date||'') + '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    if (data.threads?.length) { const last = data.threads[0]; html += '<div style="font-size:11px;color:var(--text3);margin-bottom:4px">Last sent: <span style="color:var(--text2)">' + esc(last.subject||'') + '</span> · ' + esc(last.date||'') + '</div>'; }
    html += '</div>';

    // Pulled-in intelligence — same data the Intel tab shows for this account
    if (intel.length) {
      html += '<div style="border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden;margin-top:10px">';
      html += '<div style="font-size:11px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;padding:8px 12px;background:var(--surface2);border-bottom:1px solid var(--border)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Account intelligence (' + intel.length + ' meeting' + (intel.length>1?'s':'') + ')</div>';
      intel.slice(0,5).forEach(function(row) {
        const sc = {positive:'var(--green)',neutral:'var(--text3)',negative:'var(--coral)'}[row.sentiment]||'var(--text3)';
        const signalCount = (row.product_feedback||[]).length + (row.pricing_signals||[]).length + (row.competitor_mentions||[]).length + (row.expansion_signals||[]).length + (row.risk_signals||[]).length;
        html += '<div style="padding:10px 12px;border-top:1px solid var(--border)">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">' +
            '<span style="font-size:11px;color:var(--text3)">' + esc(row.meeting_date||'') + ' · ' + esc(row.meeting_subject||'') + '</span>' +
            '<span style="font-size:11px;color:' + sc + '">' + esc(row.sentiment||'') + '</span>' +
          '</div>' +
          (row.summary ? '<div style="font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:4px">' + esc(row.summary) + '</div>' : '') +
          (signalCount > 0 ? '<div style="font-size:11px;color:var(--gold)">' + signalCount + ' signal' + (signalCount>1?'s':'') + ' extracted, see Intel tab for details</div>' : '') +
        '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style=\"font-size:11px;color:var(--text3);padding:8px 2px\">No extracted intelligence for this account yet, run ↻ Refresh in the Intel tab to scan meeting notes.</div>';
    }

    // Find this account in pipeline to link to deal Signals tab
    var matchedDeal = null;
    if (_pipelineData) {
      var allDeals = [...(_pipelineData.verified||[]),...(_pipelineData.partial||[]),...(_pipelineData.unverified||[])];
      matchedDeal = allDeals.find(function(d) { return (d.account||'').toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().includes((d.account||'').toLowerCase().split(' ')[0]); });
    }
    if (matchedDeal) {
      html += '<button onclick="openDealDetail(\'' + esc(matchedDeal.id) + '\',\'' + esc(matchedDeal.account) + '\');setTimeout(function(){switchDealTab(\'signals\');},400)" style="width:100%;margin-top:10px;padding:9px;border-radius:var(--r-sm);background:rgba(58,110,168,0.08);border:1px solid rgba(58,110,168,0.2);color:var(--blue);font-family:var(--sans);font-size:12px;font-weight:500;cursor:pointer;text-align:center"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg> View market signals for ' + esc(matchedDeal.account) + ' →</button>';
    }

    if (out) out.innerHTML = html;
  } catch(e) { if (out) out.innerHTML = '<div style="font-size:13px;color:var(--coral);padding:12px">Error: ' + esc(e.message) + '</div>'; }
}
function renderSamAlerts() {
  const alerts = document.getElementById('samAlerts'); if (!alerts) return;
  const d = dayData(viewDate);
  const incomplete = (d.tasks||[]).filter(t => !t.done);
  if (incomplete.length > 0) alerts.innerHTML = '<div style="background:rgba(var(--c-accent-rgb),0.1);border:1px solid var(--border2);border-radius:var(--radius);padding:12px 16px;margin-bottom:8px;font-size:13px;color:var(--text2)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> <strong style="color:var(--gold)">'+incomplete.length+' task'+(incomplete.length>1?'s':'')+' pending today</strong>, log your progress in Today tab</div>';
  else alerts.innerHTML = '';
}
async function loadMyAccounts() {
  const list = document.getElementById('myAccountsList'); if (!list || !currentUser?.token || !profile?.org_id) return;
  try {
    // Unified mapping: show accounts where I'm the owner/AE OR the assigned SDR
    const rows = await sbGet('org_accounts?or=(user_id.eq.' + currentUser.id + ',sdr_user_id.eq.' + currentUser.id + ')&org_id=eq.' + profile.org_id + '&select=id,account_name,domain,additional_domains,region,deal_value,deal_value_usd,user_id,sdr_user_id&order=account_name');
    _youSetupSet('accounts', !!(rows && rows.length));
    if (!rows || !rows.length) { list.innerHTML = '<div style="font-size:12px;color:var(--text3);font-style:italic">No accounts assigned yet.</div>'; return; }
    var _canAssignTeam = ['manager','director','executive','admin','super_admin'].includes(profile?.role);
    list.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px">' + rows.map(r => {
      var hasValue = r.deal_value != null;
      var extraDomains = (r.additional_domains || []).length;
      var valueTag = hasValue
        ? '<span style="font-size:11px;color:var(--green);font-weight:500">' + (r.deal_value_usd ? fmtOrgMoney(r.deal_value_usd) : fmtMoneyIn(r.deal_value, r.deal_currency || orgCur())) + '</span>'
        : '';
      return '<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:var(--surface2);border-radius:var(--r-md)">' +
        '<span style="font-size:12px;color:var(--text)">' + esc(r.account_name) + '</span>' +
        (r.region ? '<span style="font-size:11px;color:var(--text3);background:rgba(0,0,0,0.1);border-radius:var(--r-sm);padding:1px 5px">' + esc(r.region) + '</span>' : '') +
        valueTag +
        '<button onclick="openDealValueForm(\'' + r.id + '\',\'' + esc(r.account_name) + '\')" style="background:none;border:none;color:' + (hasValue ? 'var(--text3)' : 'var(--amber)') + ';cursor:pointer;font-size:11px;padding:0" title="' + (hasValue ? 'Edit deal value' : 'Add deal value') + '">' + (hasValue ? '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v10M14.8 9.3A3 3 0 0012 7.8h-.4a2.2 2.2 0 000 4.4h.8a2.2 2.2 0 010 4.4H12a3 3 0 01-2.8-1.5"/></svg>' : '+ $') + '</button>' +
        '<button onclick="openDomainManager(\'' + r.id + '\',\'' + esc(r.account_name) + '\',\'' + esc(r.domain||'') + '\',' + JSON.stringify(r.additional_domains||[]) + ')" style="background:none;border:none;color:' + (extraDomains ? 'var(--green)' : 'var(--text3)') + ';cursor:pointer;font-size:11px;padding:0" title="Manage email domains for signal matching"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg>' + (extraDomains ? '<sup style=\'font-size:11px\'>+'+extraDomains+'</sup>' : '') + '</button>' +
        (r.sdr_user_id && r.sdr_user_id === currentUser.id && r.user_id !== currentUser.id
          ? '<span style="font-size:11px;font-weight:700;color:var(--gold);background:rgba(var(--c-accent-rgb),0.12);border-radius:var(--r-sm);padding:1px 5px" title="You are the SDR on this account">SDR</span>' : '') +
        (_canAssignTeam
          ? '<button onclick="openTeamAssign(\'' + r.id + '\',\'' + esc(r.account_name) + '\',\'' + (r.user_id||'') + '\',\'' + (r.sdr_user_id||'') + '\')" style="background:none;border:none;color:' + (r.sdr_user_id ? 'var(--green)' : 'var(--text3)') + ';cursor:pointer;font-size:11px;padding:0" title="Assign AE / SDR"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20v-1.5A4.5 4.5 0 017 14h4a4.5 4.5 0 014.5 4.5V20M16 4.3a3.5 3.5 0 010 6.4M18 14.3a4.5 4.5 0 013.5 4.2V20"/></svg></button>' : '') +
        '<button onclick="removeMyAccount(\'' + r.id + '\')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;padding:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '</div>';
    }).join('') + '</div>';
  } catch(e) { list.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: ' + esc(e.message) + '</div>'; }
}
function toggleAddMyAccount() { const row = document.getElementById('myAccountAddRow'); if (row) row.style.display = row.style.display === 'none' ? 'flex' : 'none'; }

// ── Domain Manager ────────────────────────────────────────────────────────────
// Lets reps add alternative email domains for an account so signal matching
// catches all country-specific variants (in.lactalis.com, lactalis.fr, etc.)
// Brand root matching handles most cases automatically — this is the manual
// override for edge cases where the root alone isn't distinctive enough.
var _dmAccountId = null;
function openDomainManager(accountId, accountName, primaryDomain, extraDomains) {
  _dmAccountId = accountId;
  document.getElementById('dm-modal')?.remove();
  var existing = (extraDomains || []);
  var rows = existing.map(function(d, i) {
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
      '<input value="' + esc(d) + '" placeholder="e.g. in.lactalis.com" style="flex:1;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:13px;font-family:var(--sans);outline:none" class="dm-domain-input" />' +
      '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>';
  }).join('');

  var modal = document.createElement('div');
  modal.id = 'dm-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:480px;padding:20px;max-height:85vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg> Domain aliases</div>' +
        '<div style="font-size:12px;color:var(--text3);margin-top:2px">' + esc(accountName) + (primaryDomain ? ' · primary: ' + primaryDomain : '') + '</div>' +
      '</div>' +
      '<button onclick="document.getElementById(\'dm-modal\').remove()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;padding:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +
    '<div style="background:var(--surface2);border-radius:var(--r-sm);padding:10px 12px;margin-bottom:14px;font-size:12px;color:var(--text3);line-height:1.5">' +
      '<strong style="color:var(--text2)">How brand root matching works:</strong> SAM automatically detects that <em>in.lactalis.com</em>, <em>lactalis.fr</em> and <em>lactalis.sa</em> all belong to Lactalis by stripping the country subdomain and TLD. ' +
      'Only add domains here if automatic matching misses them, for example when the company uses a completely different domain for a specific region.' +
    '</div>' +
    '<div id="dm-domain-rows">' + rows + '</div>' +
    '<button onclick="addDmRow()" style="width:100%;padding:9px;border:1px dashed var(--border2);border-radius:var(--r-sm);background:none;color:var(--text3);font-size:13px;cursor:pointer;margin-bottom:14px">+ Add another domain</button>' +
    '<button onclick="saveDomains()" style="width:100%;padding:12px;border:none;border-radius:var(--r-md);background:var(--gold);color:var(--c-canvas);font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans)">Save domains</button>' +
    '<p style="font-size:11px;color:var(--text3);text-align:center;margin-top:8px">Changes take effect on next Coverage check or SmartReach sync</p>' +
  '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);
}

function addDmRow() {
  var container = document.getElementById('dm-domain-rows');
  if (!container) return;
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px';
  row.innerHTML = '<input placeholder="e.g. lactalis-international.fr" style="flex:1;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:13px;font-family:var(--sans);outline:none" class="dm-domain-input" />' +
    '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  container.appendChild(row);
  row.querySelector('input').focus();
}

async function saveDomains() {
  if (!_dmAccountId) return;
  var inputs = document.querySelectorAll('#dm-domain-rows .dm-domain-input');
  var domains = [];
  inputs.forEach(function(inp) {
    var v = inp.value.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (v) domains.push(v);
  });
  try {
    await fetch(SB_URL + '/rest/v1/org_accounts?id=eq.' + _dmAccountId, {
      method: 'PATCH',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ additional_domains: domains })
    });
    document.getElementById('dm-modal')?.remove();
    loadMyAccounts();
    showToast('Domain aliases saved');
  } catch(e) { alert('Save failed: ' + e.message); }
}
async function addMyAccount() {
  const name = document.getElementById('myAccountName')?.value?.trim();
  const region = document.getElementById('myAccountRegion')?.value?.trim() || null;
  const domain = document.getElementById('myAccountDomain')?.value?.trim() || null;
  if (!name) return;

  // Auto-link to parent if a standalone account with this exact name already exists
  // and the rep is adding a regional branch of it
  let parentId = null;
  if (region) {
    try {
      const pr = await fetch(SB_URL + '/rest/v1/org_accounts?org_id=eq.' + profile.org_id + '&account_name=eq.' + encodeURIComponent(name) + '&select=id&limit=1', {
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token }
      });
      const existing = await pr.json();
      if (Array.isArray(existing) && existing.length) parentId = existing[0].id;
    } catch(e) { /* non-fatal */ }
  }

  try {
    const body = { org_id: profile.org_id, user_id: currentUser.id, account_name: name, domain, added_by: currentUser.id };
    if (region) body.region = region;
    if (parentId) body.parent_account_id = parentId;
    const r = await fetch(SB_URL + '/rest/v1/org_accounts', {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(await r.text());
    document.getElementById('myAccountName').value = '';
    if (document.getElementById('myAccountRegion')) document.getElementById('myAccountRegion').value = '';
    document.getElementById('myAccountDomain').value = '';
    toggleAddMyAccount(); loadMyAccounts();
  } catch(e) { if (e.message.includes('duplicate')||e.message.includes('unique')) alert(name+' already in your list'); else alert('Error: '+e.message); }
}
async function removeMyAccount(id) {
  try { await fetch(SB_URL + '/rest/v1/org_accounts?id=eq.' + id, { method: 'DELETE', headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token } }); loadMyAccounts(); }
  catch(e) { alert('Error: ' + e.message); }
}
// Source icon/label map — extend here when WhatsApp/LinkedIn/Calling integrations land.
var INTEL_SOURCE_CONFIG = {
  calendar:    { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg>', label: 'Calendar meeting', color: 'var(--gold)' },
  notetaker:   { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a2.8 2.8 0 00-2.8 2.8v5.4a2.8 2.8 0 005.6 0V6.3A2.8 2.8 0 0012 3.5zM5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/></svg>', label: 'Notetaker', color: '#A78BFA' },
  email_sent:  { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg>', label: 'Email sent', color: 'var(--green)' },
  email_reply: { icon: '↩', label: 'Email reply received', color: 'var(--green)' },
  whatsapp:    { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg>', label: 'WhatsApp', color: '#25D366' },
  linkedin:    { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1.5 1.5M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1.5-1.5"/></svg>', label: 'LinkedIn', color: '#0A66C2' },
  phone_call:  { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5H4.5A1.5 1.5 0 003 5c0 8.8 7.2 16 16 16a1.5 1.5 0 001.5-1.5V17l-4.5-2-2.5 2.5A15 15 0 018.5 11L11 8.5z"/></svg>', label: 'Call log', color: 'var(--amber)' },
  none:        { icon: '○', label: 'No evidence', color: 'var(--text3)' }
};
function renderSourceBadge(source) {
  var cfg = INTEL_SOURCE_CONFIG[source] || INTEL_SOURCE_CONFIG.none;
  return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:' + cfg.color + ';background:rgba(0,0,0,0.12);border-radius:var(--r-sm);padding:2px 7px;letter-spacing:0.02em">' + cfg.icon + ' ' + cfg.label + '</span>';
}

var _ivrPeriod = {}, _ivrRepId = {}, _ivrData = {}, _ivrSeq = {};
function setIvrPeriod(outputId, period, btn) {
  _ivrPeriod[outputId] = period;
  var wrap = document.getElementById('ivrperiod-' + outputId);
  if (wrap) wrap.querySelectorAll('button').forEach(function(b) { b.style.background='var(--surface2)'; b.style.color='var(--text2)'; b.style.borderColor='var(--border)'; });
  if (btn) { btn.style.background='var(--gold)'; btn.style.color='var(--c-canvas)'; btn.style.borderColor='var(--gold)'; }
  var customRow = document.getElementById('ivrcustom-' + outputId);
  if (customRow) customRow.style.display = period === 'custom' ? 'flex' : 'none';
  if (period !== 'custom') runIntentVsReality(_ivrRepId[outputId], outputId);
}
function renderIvrPeriodPicker(outputId) {
  var active = _ivrPeriod[outputId] || 'last_week';
  var mk = function(period, label) {
    var isActive = active === period;
    return '<button onclick="setIvrPeriod(\''+outputId+'\',\''+period+'\',this)" style="padding:4px 10px;border-radius:var(--r-md);font-size:11px;cursor:pointer;font-family:var(--sans);border:1px solid '+(isActive?'var(--gold)':'var(--border)')+';background:'+(isActive?'var(--gold)':'var(--surface2)')+';color:'+(isActive?'var(--c-canvas)':'var(--text2)')+'">'+label+'</button>';
  };
  return '<div id="ivrperiod-'+outputId+'" style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">' +
    mk('today','Today') +
    mk('wtd','WTD') +
    mk('last_week','Last week') +
    mk('mtd','MTD') +
    mk('qtd','QTD') +
    mk('custom','Custom ↗') +
  '</div>' +
  '<div id="ivrcustom-'+outputId+'" style="display:'+(active==='custom'?'flex':'none')+';gap:8px;align-items:center;margin-bottom:10px">' +
    '<input type="date" id="ivrfrom-'+outputId+'" style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r-sm);padding:5px 8px;color:var(--text);font-family:var(--sans);font-size:12px"/>' +
    '<span style="font-size:11px;color:var(--text3)">to</span>' +
    '<input type="date" id="ivrto-'+outputId+'" style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r-sm);padding:5px 8px;color:var(--text);font-family:var(--sans);font-size:12px"/>' +
    '<button onclick="runIntentVsReality(\''+(_ivrRepId[outputId]||'')+'\',\''+outputId+'\')" style="padding:5px 12px;border-radius:var(--r-sm);background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer">Apply</button>' +
  '</div>';
}
var _ivrAllResults = {};
var _ivrFilter = {};
function setIvrFilter(outputId, filter) {
  _ivrFilter[outputId] = filter;
  renderIvrResults(outputId);
}
function renderIvrResults(outputId) {
  var out = document.getElementById(outputId || 'ivrOutput');
  if (!out) return;
  var allResults = _ivrAllResults[outputId] || [];
  var filter = _ivrFilter[outputId] || 'all';
  var isManager = !!(_ivrRepId[outputId]);
  var data = _ivrData[outputId] || {};
  var s = data.summary || {};
  var picker = isManager ? renderIvrPeriodPicker(outputId) : '';
  var pct = s.verificationRate || 0;
  var barColor = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--coral)';

  // ── Stat boxes — clickable to filter ─────────────────────────────────────
  var mkBox = function(label, value, color, filterKey) {
    var isActive = filter === filterKey;
    return '<div onclick="setIvrFilter(\'' + outputId + '\',\'' + filterKey + '\')" style="background:' + (isActive ? color.replace('var(--','rgba(').replace(')',',.15)') : 'var(--surface2)') + ';border-radius:var(--r-sm);padding:10px 6px;text-align:center;cursor:pointer;border:2px solid ' + (isActive ? color : 'transparent') + ';transition:all 0.15s">' +
      '<div style="font-size:20px;font-weight:700;color:' + color + '">' + value + '</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + label + '</div>' +
    '</div>';
  };

  var html = picker;
  if (data.demo) html += '<div style="font-size:11px;color:var(--gold);background:rgba(var(--c-accent-rgb),0.10);border:1px solid rgba(var(--c-accent-rgb),0.30);border-radius:var(--r-md);padding:5px 9px;margin-bottom:10px">Demo workspace: evidence below is simulated, not read from a live mailbox</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">';
  html += mkBox('All tasks', s.total || 0, 'var(--text)', 'all');
  html += mkBox('Verified', s.verified || 0, 'var(--green)', 'verified');
  html += mkBox('Self-reported', s.taskDone || 0, 'var(--blue)', 'task_done');
  html += mkBox('Gaps', s.gaps || 0, 'var(--coral)', 'gap');
  html += '</div>';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><div style="flex:1;height:5px;background:var(--surface2);border-radius:var(--r-sm);overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:var(--r-sm)"></div></div><div style="font-size:12px;font-weight:600;color:' + barColor + '">' + pct + '% verified</div></div>';
  html += '<div style="font-size:11px;color:var(--text3);margin-bottom:10px">Self-reported = marked done with no external proof (LinkedIn, WhatsApp). Not counted in verified %.</div>';

  // Filter results
  var filtered = filter === 'all' ? allResults :
    filter === 'verified'  ? allResults.filter(function(r) { return ['verified','verified_hot','partial_count','attested'].includes(r.signal); }) :
    filter === 'task_done' ? allResults.filter(function(r) { return r.signal === 'task_done'; }) :
    filter === 'gap'      ? allResults.filter(function(r) { return r.signal === 'gap'; }) :
    filter === 'unverified' ? allResults.filter(function(r) { return r.signal === 'unverified' || r.signal === 'no_source'; }) :
    allResults;

  if (!filtered.length) {
    html += '<div style="font-size:12px;color:var(--text3);padding:12px 0;text-align:center">No tasks match this filter.</div>';
    out.innerHTML = html; return;
  }

  var sigMap = {
    gap:             { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg>', color: 'var(--coral)',  bg: 'rgba(192,82,63,0.08)',  badge: 'Not done · not found in Gmail' },
    unverified:      { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg>',  color: 'var(--amber)',  bg: 'rgba(var(--c-accent-rgb),0.08)', badge: 'Done · not found in Gmail' },
    verified:        { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>',  color: 'var(--green)',  bg: 'rgba(74,140,92,0.08)',  badge: 'Email sent' },
    verified_hot:    { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg>', color: 'var(--green)',  bg: 'rgba(74,140,92,0.12)',  badge: 'Email sent · reply received' },
    partial_count:   { icon: '◑',  color: 'var(--amber)',  bg: 'rgba(var(--c-accent-rgb),0.08)', badge: 'Fewer emails found than claimed' },
    done_not_logged: { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.8v.4"/></svg>', color: 'var(--text3)',  bg: 'var(--surface2)',        badge: 'Found in Gmail · not logged' },
    no_source:       { icon: '○',  color: 'var(--text3)',  bg: 'var(--surface2)',        badge: 'No integration available' },
    internal:        { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg>', color: 'var(--text3)',  bg: 'var(--surface2)',        badge: 'Internal task · not externally verifiable' },
    internal_pending:{ icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg>', color: 'var(--text3)',  bg: 'var(--surface2)',        badge: 'Internal task · not done yet' },
    // Call / LinkedIn / WhatsApp rep-confirmed signals
    attested:        { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>',  color: 'var(--green)',  bg: 'rgba(74,140,92,0.08)',  badge: 'Done · outcome logged (self-attested)' },
    task_done:       { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>',  color: 'var(--blue)',    bg: 'rgba(58,110,168,0.08)', badge: 'Marked done, no external verification (LinkedIn/WhatsApp/calls cannot be verified externally yet)' },
  };

  filtered.forEach(function(r) {
    var sig = r.signal || 'unknown';
    var cfg = sigMap[sig] || { icon: '○', color: 'var(--text3)', bg: 'var(--surface2)', badge: '' };
    var sourceBadge = (r.source && r.source !== 'none') ? renderSourceBadge(r.source) : '';

    // Reply analysis — show reasoning for how the reply was classified
    var replyAnalysisHtml = '';
    if (r.replyAnalysis) {
      var ra = r.replyAnalysis;
      var raColor = ra.type === 'positive' ? 'var(--green)' : ra.type === 'ooo' ? 'var(--amber)' : ra.type === 'negative' ? 'var(--coral)' : 'var(--text3)';
      var raIcon  = ra.type === 'positive' ? '↩' : ra.type === 'ooo' ? '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg>' : ra.type === 'negative' ? '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' : '?';
      var raLabel = ra.type === 'positive' ? 'Positive reply' : ra.type === 'ooo' ? 'Out of office' : ra.type === 'negative' ? 'Negative / opt-out' : 'Neutral reply';
      replyAnalysisHtml = '<div style="margin-top:5px;padding:5px 8px;background:rgba(0,0,0,0.06);border-radius:var(--r-sm);display:flex;gap:6px;align-items:flex-start">' +
        '<span style="font-size:11px;font-weight:700;color:' + raColor + ';flex-shrink:0">' + raIcon + ' ' + raLabel + '</span>' +
        (ra.snippet ? '<span style="font-size:11px;color:var(--text3);font-style:italic">"' + esc(ra.snippet.slice(0, 100)) + (ra.snippet.length > 100 ? '…' : '') + '"</span>' : '') +
      '</div>';
    }

    // Intent badge for non-obvious classifications
    var intentBadge = '';
    if (r.intent === 'internal' || r.intent === 'internal_pending') {
      intentBadge = '<div style="font-size:11px;color:var(--text3);margin-top:3px;font-style:italic"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg> Internal task, not externally verifiable</div>';
    } else if (r.signal === 'attested') {
      var outcomeLabels = { no_answer:'No answer', spoke_briefly:'Spoke briefly', full_conversation:'Full conversation', meeting_booked:'Meeting booked <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg>', not_interested:'Not interested', requests_sent:'Requests sent', connections_accepted:'Connections accepted', messages_sent:'Messages sent', replies_received:'Replies received' };
      var outcomeLabel = outcomeLabels[r.activityOutcome] || r.activityOutcome || '';
      intentBadge = '<div style="font-size:11px;color:var(--green);margin-top:4px;font-weight:600"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> ' + esc(outcomeLabel) + (r.completionNote ? ', "' + esc(r.completionNote.slice(0,80)) + '"' : '') + '</div>';
    } else if (r.signal === 'task_done') {
      intentBadge = '<div style="font-size:11px;color:var(--blue);margin-top:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Marked done, add outcome via "Log outcome" for stronger verification</div>';
    } else if (r.intent === 'linkedin') {
      intentBadge = '<div style="font-size:11px;color:var(--text3);margin-top:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1.5 1.5M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1.5-1.5"/></svg> LinkedIn, use close-out form to log outcome</div>';
    } else if (r.intent === 'call') {
      intentBadge = '<div style="font-size:11px;color:var(--text3);margin-top:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5H4.5A1.5 1.5 0 003 5c0 8.8 7.2 16 16 16a1.5 1.5 0 001.5-1.5V17l-4.5-2-2.5 2.5A15 15 0 018.5 11L11 8.5z"/></svg> Call, use close-out form to log outcome when marking done</div>';
    }

    // Quantity mismatch display
    var quantityNote = '';
    if (r.quantityClaimed > 1) {
      var found = r.emailsFound || 0;
      var claimed = r.quantityClaimed;
      var ratio = r.verificationRatio || 0;
      var qColor = ratio >= 60 ? 'var(--green)' : ratio >= 30 ? 'var(--amber)' : 'var(--coral)';
      if (r.signal === 'partial_count') {
        quantityNote = '<div style="font-size:11px;margin-top:4px;padding:4px 8px;background:rgba(var(--c-accent-rgb),0.1);border-radius:var(--r-sm);color:var(--amber)">◑ ' + found + ' of ' + claimed + ' emails found in Gmail (' + ratio + '%), ' + (claimed - found) + ' unverified</div>';
      } else if (found > 0) {
        quantityNote = '<div style="font-size:11px;color:var(--text3);margin-top:3px">' + found + '/' + claimed + ' emails verified in Gmail</div>';
      }
    }

    var noSourceNote = sig === 'no_source' ? '<div style="font-size:11px;color:var(--text3);margin-top:4px;font-style:italic">Completed, log the outcome when marking done for a self-attested signal</div>' : '';

    html += '<div style="border-left:3px solid ' + cfg.color + ';padding:9px 12px;margin-bottom:5px;background:' + cfg.bg + ';border-radius:0 7px 7px 0">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +
        '<div style="font-size:12px;font-weight:500;color:var(--text);flex:1">' + cfg.icon + ' ' + esc(r.text || '') + '</div>' +
        sourceBadge +
      '</div>' +
      (r.account ? '<div style="font-size:11px;color:var(--text3);margin-top:3px">Account: ' + esc(r.account) + '</div>' : '') +
      (r.emailSubject ? '<div style="font-size:11px;color:var(--text3);margin-top:3px;font-style:italic">"' + esc(r.emailSubject.slice(0, 80)) + '"</div>' : '') +
      replyAnalysisHtml +
      intentBadge +
      quantityNote +
      noSourceNote +
    '</div>';
  });

  out.innerHTML = html;
}

async function runIntentVsReality(repId, outputId, periodOverride) {
  _ivrRepId[outputId || 'ivrOutput'] = repId;
  var isManager = !!repId;
  var out = document.getElementById(outputId || 'ivrOutput');
  var btn = document.getElementById('ivrBtn');
  if (!out) return;
  if (btn && !isManager) { btn.textContent = 'Scanning…'; btn.disabled = true; }
  var today = todayKey();
  var dateFrom, dateTo, periodLabel;
  // Allow period override from self-mode period picker
  if (!isManager && periodOverride) { _ivrPeriod[outputId || 'ivrOutput'] = periodOverride; }
  var _calcPeriod = function(period, refDate) {
    var d = parseDate(refDate);
    var dow = d.getDay(); // 0=Sun
    if (period === 'today') return { from: refDate, to: refDate, label: refDate === today ? 'today' : refDate };
    if (period === 'wtd') {
      var mon = new Date(d); mon.setDate(d.getDate() - (dow===0?6:dow-1));
      return { from: dateKey(mon), to: refDate, label: 'WTD' };
    }
    if (period === 'last_week') {
      var thisMon = new Date(d); thisMon.setDate(d.getDate() - (dow===0?6:dow-1));
      var lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
      var lastSun = new Date(thisMon); lastSun.setDate(thisMon.getDate() - 1);
      return { from: dateKey(lastMon), to: dateKey(lastSun), label: 'Last week' };
    }
    if (period === 'mtd') {
      var m1 = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';
      return { from: m1, to: refDate, label: 'MTD' };
    }
    if (period === 'qtd') {
      var qMonth = Math.floor(d.getMonth()/3)*3;
      var q1 = d.getFullYear()+'-'+String(qMonth+1).padStart(2,'0')+'-01';
      return { from: q1, to: refDate, label: 'QTD' };
    }
    // custom
    return { from: document.getElementById('ivrfrom-'+outputId)?.value || refDate, to: document.getElementById('ivrto-'+outputId)?.value || refDate, label: 'Custom' };
  };

  if (isManager) {
    var period = _ivrPeriod[outputId] || 'last_week';
    var teamDateEl = document.getElementById('teamDateInput');
    var viewingDate = (teamDateEl && teamDateEl.value) ? teamDateEl.value : today;
    var calc = _calcPeriod(period, viewingDate);
    dateFrom = calc.from; dateTo = calc.to; periodLabel = calc.label;
  } else {
    var calc2 = _calcPeriod(_ivrPeriod[outputId] || 'last_week', today);
    dateFrom = calc2.from; dateTo = calc2.to; periodLabel = calc2.label;
  }
  var picker = isManager ? renderIvrPeriodPicker(outputId) : '';
  out.innerHTML = picker + '<div style="font-size:12px;color:var(--text3);padding:8px 0">Checking intent vs reality for ' + esc(periodLabel) + '…</div>';
  // Race guard: only the latest request for this panel is allowed to render.
  // Without this, a slower earlier scan (e.g. the default range on tab open)
  // resolves after your new selection and overwrites it — the "flips to a
  // larger range after a few seconds" bug.
  var _ivrKey = outputId || 'ivrOutput';
  var _ivrToken = (_ivrSeq[_ivrKey] = (_ivrSeq[_ivrKey] || 0) + 1);
  try {
    var r2 = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'intent_vs_reality', rep_user_id: isManager?repId:null, date_from: dateFrom, date_to: dateTo }) });
    var data = await r2.json();
    if (_ivrToken !== _ivrSeq[_ivrKey]) return;  // a newer selection superseded this one
    if (data.scopeError) { out.innerHTML = picker + '<div style="font-size:12px;color:var(--coral);padding:8px 0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 10.5V7.5a5.5 5.5 0 0111 0v3M5 10.5h14v10H5z"/></svg> ' + esc(data.error || 'Gmail permissions need to be re-granted.') + '</div>'; if (btn&&!isManager){btn.textContent='Check this week';btn.disabled=false;} return; }
    if (data.reconnectNeeded) { out.innerHTML = picker + '<div style="font-size:12px;color:var(--coral);padding:8px 0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> ' + esc(data.error || 'Gmail connection expired.') + '</div>'; if (btn&&!isManager){btn.textContent='Check this week';btn.disabled=false;} return; }
    if (!data.connected) {
      var ivrErrMsg = data.error && data.error !== 'Gmail not connected' ? data.error : ('Gmail not connected'+(isManager?' for this rep':''));
      var ivrErrColor = data.error && data.error === 'Unauthorized' ? 'var(--coral)' : 'var(--text3)';
      out.innerHTML = picker + '<div style="font-size:12px;color:'+ivrErrColor+'">'+esc(ivrErrMsg)+'</div>'; if (btn&&!isManager){btn.textContent='Check this week';btn.disabled=false;} return;
    }
    var results = data.results || [];
    if (data.debug) console.log('IVR diagnostic:', data.debug);
    if (!results.length) { out.innerHTML = picker + '<div style="font-size:12px;color:var(--text3)">No outreach tasks found for ' + esc(periodLabel) + '</div>'; if (btn&&!isManager){btn.textContent='Check this week';btn.disabled=false;} return; }
    // Store results for filter rendering
    _ivrAllResults[outputId || 'ivrOutput'] = results;
    _ivrData[outputId || 'ivrOutput'] = data;
    _ivrFilter[outputId || 'ivrOutput'] = 'all';
    renderIvrResults(outputId || 'ivrOutput');
  } catch(e) { out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: ' + esc(e.message) + '</div>'; }
  if (btn&&!isManager) { btn.textContent = 'Refresh'; btn.disabled = false; }
}
// Coverage period state — keyed by output element id so multiple rep cards
// in the Team tab can each remember their own selected period independently.
var _coveragePeriod = {};
function setCoveragePeriod(outputId, period, btn) {
  _coveragePeriod[outputId] = period;
  var wrap = document.getElementById('covperiod-' + outputId);
  if (wrap) wrap.querySelectorAll('button').forEach(function(b) { b.style.background = 'var(--surface2)'; b.style.color = 'var(--text2)'; b.style.borderColor = 'var(--border)'; });
  if (btn) { btn.style.background = 'var(--gold)'; btn.style.color = 'var(--c-canvas)'; btn.style.borderColor = 'var(--gold)'; }
  var customRow = document.getElementById('covcustom-' + outputId);
  if (customRow) customRow.style.display = period === 'custom' ? 'flex' : 'none';
  if (period !== 'custom') runCoverageCheck(_coverageRepId[outputId], _coverageRepEmail[outputId], outputId);
}
var _coverageRepId = {}, _coverageRepEmail = {};

function getCoverageDateRange(outputId) {
  const period = _coveragePeriod[outputId] || 'week';
  const today = todayKey();
  const teamDateEl = document.getElementById('teamDateInput');
  const viewingDate = (teamDateEl && teamDateEl.value) ? teamDateEl.value : today;
  if (period === 'today') return { from: viewingDate, to: viewingDate, label: viewingDate === today ? 'today' : viewingDate };
  if (period === 'week') {
    const d = parseDate(viewingDate); const day = d.getDay();
    const monday = new Date(d); monday.setDate(d.getDate() - (day===0?6:day-1));
    return { from: dateKey(monday), to: viewingDate, label: 'this week' };
  }
  if (period === 'month') {
    const d = parseDate(viewingDate);
    return { from: d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01', to: viewingDate, label: 'this month' };
  }
  if (period === 'custom') {
    const fromEl = document.getElementById('covfrom-' + outputId), toEl = document.getElementById('covto-' + outputId);
    const from = fromEl?.value || viewingDate, to = toEl?.value || viewingDate;
    return { from, to, label: from + ' \u2192 ' + to };
  }
  return { from: viewingDate, to: viewingDate, label: viewingDate };
}

function renderCoveragePeriodPicker(outputId) {
  const active = _coveragePeriod[outputId] || 'week';
  const mk = function(period, label) {
    const isActive = active === period;
    return '<button onclick="setCoveragePeriod(\''+outputId+'\',\''+period+'\',this)" style="padding:4px 10px;border-radius:var(--r-md);font-size:11px;cursor:pointer;font-family:var(--sans);border:1px solid '+(isActive?'var(--gold)':'var(--border)')+';background:'+(isActive?'var(--gold)':'var(--surface2)')+';color:'+(isActive?'var(--c-canvas)':'var(--text2)')+'">'+label+'</button>';
  };
  return '<div id="covperiod-'+outputId+'" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
    mk('today','Today') + mk('week','This week') + mk('month','This month') + mk('custom','Custom range') +
    '</div>' +
    '<div id="covcustom-'+outputId+'" style="display:'+(active==='custom'?'flex':'none')+';gap:8px;align-items:center;margin-bottom:10px">' +
      '<input type="date" id="covfrom-'+outputId+'" style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r-sm);padding:5px 8px;color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<span style="font-size:11px;color:var(--text3)">to</span>' +
      '<input type="date" id="covto-'+outputId+'" style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r-sm);padding:5px 8px;color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<button onclick="runCoverageCheck(\''+(_coverageRepId[outputId]||'')+'\',\''+(_coverageRepEmail[outputId]||'')+'\',\''+outputId+'\')" style="padding:5px 12px;border-radius:var(--r-sm);background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer">Apply</button>' +
    '</div>';
}

// Generic open/close toggle for the per-rep action panels (SAM Signals,
// Coverage, Intent vs Reality) in the Team tab. Previously clicking these
// buttons only ever fetched and re-rendered into an ever-growing output div
// with no way to collapse it again — clicking a second time just re-ran the
// same fetch. Now: first click opens (runs the action), second click closes
// (clears the panel) without re-fetching, third click re-opens fresh.
var _panelOpenState = {};
function togglePanel(outputId, runFn) {
  const out = document.getElementById(outputId);
  if (!out) return;
  const isOpen = _panelOpenState[outputId] && out.innerHTML.trim().length > 0;
  if (isOpen) {
    out.innerHTML = '';
    _panelOpenState[outputId] = false;
  } else {
    _panelOpenState[outputId] = true;
    runFn();
  }
}

// Signal-type display config for local (rule-based) intelligence — icon,
// label, and color per detected pattern. Extend here as new pattern types
// are added server-side.
var DEAL_STAGE_CONFIG = {
  commercial:  { label: 'Commercial', icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3z"/></svg>', color: 'var(--green)', desc: 'NDA / proposal / pricing being shared' },
  value_prop:  { label: 'Value Prop', icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.8v.4"/></svg>', color: 'var(--gold)', desc: 'Requirements & demo discussions underway' },
  prospective: { label: 'Prospective', icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>', color: 'var(--text2)', desc: 'Outreach started, demo not yet confirmed' },
  unknown:     { label: 'No activity yet', icon: '○', color: 'var(--text3)', desc: 'Assigned account, nothing detected in 90 days' }
};
var CHANNEL_ICON_CONFIG = {
  email: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg>', calendar: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg>', notetaker: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a2.8 2.8 0 00-2.8 2.8v5.4a2.8 2.8 0 005.6 0V6.3A2.8 2.8 0 0012 3.5zM5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/></svg>', call: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5H4.5A1.5 1.5 0 003 5c0 8.8 7.2 16 16 16a1.5 1.5 0 001.5-1.5V17l-4.5-2-2.5 2.5A15 15 0 018.5 11L11 8.5z"/></svg>', whatsapp: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg>', linkedin: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1.5 1.5M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1.5-1.5"/></svg>'
};

function renderChannelBadges(channels) {
  var parts = [];
  if (channels.email.sent > 0 || channels.email.replies > 0) {
    parts.push('<span title="Email" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--text2);background:rgba(0,0,0,0.08);border-radius:var(--r-sm);padding:2px 6px">' + CHANNEL_ICON_CONFIG.email + ' ' + channels.email.sent + (channels.email.replies>0?'/'+channels.email.replies+'\u21a9':'') + '</span>');
  }
  if (channels.calendar.meetings > 0) {
    parts.push('<span title="Calendar meetings" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--text2);background:rgba(0,0,0,0.08);border-radius:var(--r-sm);padding:2px 6px">' + CHANNEL_ICON_CONFIG.calendar + ' ' + channels.calendar.meetings + '</span>');
  }
  if (channels.notetaker.count > 0) {
    parts.push('<span title="Notetaker" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--text2);background:rgba(0,0,0,0.08);border-radius:var(--r-sm);padding:2px 6px">' + CHANNEL_ICON_CONFIG.notetaker + ' ' + channels.notetaker.count + '</span>');
  }
  // Future channels — shown greyed-out as "not connected" rather than
  // omitted, so it's visible these exist as a roadmap, not forgotten.
  ['call','whatsapp','linkedin'].forEach(function(ch) {
    if (!channels[ch].integrated) {
      parts.push('<span title="' + ch + ' \u2014 no integration yet" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--text3);opacity:0.4;background:rgba(0,0,0,0.05);border-radius:var(--r-sm);padding:2px 6px">' + CHANNEL_ICON_CONFIG[ch] + '</span>');
    }
  });
  return parts.join(' ');
}

async function runSamIntelligence(repId, repEmail, resultElId) {
  const out = document.getElementById(resultElId);
  if (!out) return;
  out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Running SAM Intelligence…</div>';

  // Run both in parallel — neither depends on the other
  const [samResult, intelResult] = await Promise.allSettled([
    fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'get_rep_signals', rep_user_id: repId, query: '', days: 30 }) }).then(r => r.json()),
    fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'local_intelligence', rep_user_id: repId }) }).then(r => r.json())
  ]);

  const samData = samResult.status === 'fulfilled' ? samResult.value : null;
  const intelData = intelResult.status === 'fulfilled' ? intelResult.value : null;

  let html = '';

  // ── Deal stage pipeline (from local_intelligence) ──
  if (intelData && intelData.ok && intelData.accounts?.length) {
    const sc = intelData.stageCounts || {};
    html += '<div style="margin-bottom:12px">';
    html += '<div style="font-size:11px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> SAM Intelligence, Deal Pipeline</div>';
    html += '<div style="display:flex;gap:6px;margin-bottom:10px">';
    [{stage:'commercial',icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3z"/></svg>',color:'var(--green)',label:'Commercial'},{stage:'value_prop',icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.8v.4"/></svg>',color:'var(--gold)',label:'Value Prop'},{stage:'prospective',icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>',color:'var(--text2)',label:'Prospective'}].forEach(function(s) {
      html += '<div style="flex:1;background:rgba(0,0,0,0.06);border-radius:var(--r-sm);padding:6px;text-align:center"><div style="font-size:16px;font-weight:600;color:'+s.color+'">'+(sc[s.stage]||0)+'</div><div style="font-size:11px;color:var(--text3)">'+s.icon+' '+s.label+'</div></div>';
    });
    html += '</div>';
    ['commercial','value_prop','prospective'].forEach(function(stage) {
      const stageAccounts = intelData.accounts.filter(function(a) { return a.stage === stage && a.hasAnyActivity; });
      if (!stageAccounts.length) return;
      const cfg = DEAL_STAGE_CONFIG[stage];

      // Group by parent — accounts sharing the same parentAccountId are
      // sub-entities of the same global company (e.g. Ferrero India +
      // Ferrero Middle East both under Ferrero). Show them indented under
      // a shared parent label so the rep immediately sees the full picture.
      var groups = {};
      stageAccounts.forEach(function(a) {
        var key = a.parentAccountId || ('standalone_' + a.account);
        if (!groups[key]) groups[key] = { parentName: a.parentAccountId ? a.account.replace(/\s+(india|middle east|europe|apac|americas|global|africa|asia|us|uk|latam|mena|sea|gcc)$/i,'').trim() : null, accounts: [] };
        groups[key].accounts.push(a);
      });

      Object.keys(groups).forEach(function(key) {
        var grp = groups[key];
        if (grp.accounts.length > 1 && grp.parentName) {
          html += '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin:6px 0 3px 0">' + esc(grp.parentName) + '</div>';
        }
        grp.accounts.forEach(function(a) {
          var stalenessBadge = a.staleness==='cold'?'<span style="font-size:11px;font-weight:700;color:var(--coral);background:rgba(192,82,63,0.12);border-radius:var(--r-sm);padding:1px 5px;margin-left:4px">\u2744 COLD</span>':a.staleness==='stale'?'<span style="font-size:11px;color:var(--amber);margin-left:4px">STALE</span>':'';
          var regionBadge = a.region ? '<span style="font-size:11px;color:var(--text3);background:rgba(0,0,0,0.06);border-radius:var(--r-sm);padding:1px 6px;margin-left:4px">' + esc(a.region) + '</span>' : '';
          var indent = (grp.accounts.length > 1 && grp.parentName) ? 'margin-left:10px;border-left-width:2px;' : '';
          html += '<div style="border-left:3px solid '+cfg.color+';'+indent+'padding:6px 10px;margin-bottom:4px;background:rgba(0,0,0,0.04);border-radius:0 6px 6px 0">' +
            '<div style="font-size:12px;font-weight:600;color:var(--text)">'+cfg.icon+' '+esc(a.account)+regionBadge+stalenessBadge+'</div>' +
            '<div style="display:flex;gap:4px;margin-top:3px">'+renderChannelBadges(a.channels)+'</div>' +
            (a.lastSentSubject?'<div style="font-size:11px;color:var(--text3);margin-top:2px;font-style:italic">'+esc(a.lastSentSubject.slice(0,70))+'</div>':'') +
          '</div>';
        });
      });
    });
    html += '</div>';
  } else if (intelData && intelData.reconnectNeeded) {
    html += '<div style="font-size:12px;color:var(--coral);margin-bottom:8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> '+esc(intelData.error||'Gmail connection expired')+'</div>';
  }

  // ── Email/Gmail signals (from get_rep_signals) ──
  if (samData && samData.connected && samData.signals?.length) {
    html += '<div style="margin-top:4px"><div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Recent email signals</div>';
    samData.signals.slice(0, 5).forEach(function(s) {
      html += '<div style="background:var(--surface2);border-radius:var(--r-sm);padding:7px 10px;margin-bottom:4px"><div style="font-size:12px;font-weight:500;color:var(--text)">'+esc(s.account||'')+'</div><div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(s.subject||s.snippet||'')+'</div></div>';
    });
    html += '</div>';
  } else if (samData && !samData.connected) {
    html += '<div style="font-size:12px;color:var(--text3)">Gmail not connected for this rep</div>';
  }

  if (!html) html = '<div style="font-size:12px;color:var(--text3);padding:8px 0">No signals found, add accounts in Org → Rep Accounts</div>';
  out.innerHTML = html;
}

var SIGNAL_TYPE_CONFIG = {
  expansion:      { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg>', label: 'Expansion',      color: 'var(--green)' },
  hiring:         { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20v-1.5A4.5 4.5 0 017 14h4a4.5 4.5 0 014.5 4.5V20M16 4.3a3.5 3.5 0 010 6.4M18 14.3a4.5 4.5 0 013.5 4.2V20"/></svg>', label: 'Hiring',          color: 'var(--blue)' },
  leadership:     { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11.5a4 4 0 100-8 4 4 0 000 8zM4.5 20.5v-1A5.5 5.5 0 0110 14h4a5.5 5.5 0 015.5 5.5v1"/></svg>', label: 'Leadership',      color: 'var(--gold)' },
  funding:        { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v10M14.8 9.3A3 3 0 0012 7.8h-.4a2.2 2.2 0 000 4.4h.8a2.2 2.2 0 010 4.4H12a3 3 0 01-2.8-1.5"/></svg>', label: 'Funding',         color: 'var(--green)' },
  partnership:    { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 12l-3-3 4-4 3 2 3-2 4 4-3 3M8 12l3 3 2-2 3 3M8 12l-2.5 2.5"/></svg>', label: 'Partnership',     color: 'var(--text2)' },
  earnings:       { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V4M4 20h16M8 17V11M12.5 17V7.5M17 17v-4"/></svg>', label: 'Earnings',        color: 'var(--text2)' },
  restructuring:  { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg>', label: 'Restructuring',   color: 'var(--coral)' },
  product_launch: { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>', label: 'Product launch',  color: 'var(--amber)' }
};

// Pure renderer — returns an html string for ONE analytics source (either
// get_sequencing_stats or get_manual_sampaign_stats; both now share the same
// response shape, including `benchmarks`, deliberately, so this one function
// serves both). opts.title is the section label so the two sources render as
// clearly distinguishable blocks rather than looking like one merged number.
// Active status filter for the campaign contact roster, driven by clicking a
// performance tile. Global (not per-campaign) for the same reason
// _sampaignContactTab is: only one campaign overlay is ever open at a time.
window._sampaignStatusFilter = null;

var _SAMPAIGN_STATUS_LABELS = {
  not_contacted: 'Not contacted', sent: 'Sent', opened: 'Opened',
  replied: 'Replied', ooo: 'OOO', no_response: 'No reply',
  dead: 'Dead', opted_out: 'Opted out'
};
function _sampaignStatusLabel(k) { return _SAMPAIGN_STATUS_LABELS[k] || k; }

// Clicking a performance tile filters the roster below to that status.
// Passing null clears it. Re-clicking the active tile also clears, so the
// tiles toggle rather than trapping you in a filtered view.
function setSampaignStatusFilter(campaignId, status) {
  window._sampaignStatusFilter = (window._sampaignStatusFilter === status) ? null : status;
  // A status filter and the Active/Prospective tabs would otherwise fight
  // each other (e.g. filter=sent while the Prospective tab is showing only
  // not_contacted would render an empty list for no visible reason). The
  // filter wins, and the tabs are hidden while one is active.
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
  _loadSampaignDetailPerf(campaignId, c);
  _renderSampaignContacts(campaignId);
  var box = document.getElementById('sampaignContacts_'+campaignId);
  if (box && window._sampaignStatusFilter) box.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// Same LinkedIn treatment the contact roster uses: solid when enrichment
// found a real profile URL, faint with a people-search fallback when it
// hasn't. Shared so the two places can't drift apart.
function _sampaignLinkedInIcon(url, name) {
  var href = url ? url : ('https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(name || ''));
  var op = url ? '1' : '0.3';
  return '<a href="'+esc(href)+'" target="_blank" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;color:#0A66C2;opacity:'+op+';text-decoration:none;flex-shrink:0" title="'+(url?'Open LinkedIn profile':'Search LinkedIn (not enriched yet)')+'"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>';
}

function _renderSampaignAnalyticsBlock(d, opts) {
  opts = opts || {};
  var s = d.org_summary;
  var bm = d.benchmarks;
  var html = '';

  // ── Rate indicator helper ─────────────────────────────────────────────
  var rateColor = function(rate, good, avg) {
    return rate >= good ? 'var(--green)' : rate >= avg ? 'var(--amber)' : 'var(--coral)';
  };
  var rateLabel = function(rate, good, avg) {
    return rate >= good ? '↑ above benchmark' : rate >= avg ? '≈ avg' : '↓ below benchmark';
  };

  // ── Org summary strip ─────────────────────────────────────────────────
  // Base 4 tiles always present; OOO/No-reply tiles only appear when the
  // source actually returns those buckets (today: the manual path) — an
  // honest per-source grid rather than always-5-columns with blanks.
  // `filter` is the roster status each tile drills into. null = show everything
  // (Prospects is the "all contacts" tile, so it doubles as clear-filter).
  // Tiles are only interactive when opts.campaignId is set, i.e. when there's
  // actually a contact roster on screen to filter — the shared tool-synced
  // analytics view has no roster, so there it stays a plain readout.
  var tiles = [
    { label: 'Prospects', val: s.total_prospects, filter: null },
    { label: 'Sent', val: s.sent, filter: 'sent' },
    { label: 'Opened', val: s.opened, rate: s.open_rate, good: bm.open_rate.good, avg: bm.open_rate.avg, filter: 'opened' },
    { label: 'Replied', val: s.replied, rate: s.reply_rate, good: bm.reply_rate.good, avg: bm.reply_rate.avg, filter: 'replied' }
  ];
  if (s.ooo !== undefined) tiles.push({ label: 'OOO', val: s.ooo, color: 'var(--amber)', filter: 'ooo' });
  if (s.no_response !== undefined) tiles.push({ label: 'No reply', val: s.no_response, color: 'var(--text3)', filter: 'no_response' });
  tiles.push({ label: 'Dead', val: s.bounced||0, color: 'var(--coral)', sub: s.sent>0?Math.round((s.bounced||0)/s.sent*100)+'% of sent':'no longer working', filter: 'dead' });

  html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 14px;margin-bottom:10px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px">' +
 esc(opts.title||'SAMpaign Analytics') +
      (d.synced_at ? '<span style="font-weight:400;margin-left:8px">Last sync: '+new Date(d.synced_at).toLocaleDateString()+'</span>' : '') +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat('+tiles.length+',1fr);gap:8px">' +
      tiles.map(function(t) {
        var color = t.color || (t.rate !== undefined ? rateColor(t.rate, t.good, t.avg) : 'var(--text)');
        var sub = t.sub !== undefined ? t.sub : (t.rate !== undefined ? t.rate+'% · '+rateLabel(t.rate,t.good,t.avg) : '');
        var clickable = !!opts.campaignId;
        var isActive = clickable && (window._sampaignStatusFilter || null) === (t.filter || null);
        // An empty bucket has nothing to drill into, so it stays inert rather
        // than offering a click that would land on an empty list.
        var hasRows = t.val > 0 || t.filter === null;
        var interactive = clickable && hasRows;
        return '<div' +
          (interactive ? ' onclick="setSampaignStatusFilter(\''+esc(opts.campaignId)+'\','+(t.filter?'\''+t.filter+'\'':'null')+')"' : '') +
          ' style="background:'+(isActive?'var(--surface2)':'var(--surface)')+';border-radius:var(--r-sm);padding:10px;text-align:center;' +
            'border:1px solid '+(isActive?color:'transparent')+';' +
            (interactive?'cursor:pointer;':'') +
            (clickable && !hasRows?'opacity:0.55;':'') + '"' +
          (interactive ? ' title="Show only '+esc(t.label)+'"' : '') + '>' +
          '<div style="font-size:20px;font-weight:700;color:'+color+'">'+t.val+'</div>' +
          '<div style="font-size:11px;color:var(--text3)">'+t.label+'</div>' +
          (sub?'<div style="font-size:11px;color:'+color+';margin-top:2px">'+sub+'</div>':'') +
        '</div>';
      }).join('') +
    '</div>' +
    (opts.campaignId && window._sampaignStatusFilter
      ? '<div style="margin-top:8px;font-size:11px;color:var(--text3)">Showing <strong style="color:var(--text)">'+esc(_sampaignStatusLabel(window._sampaignStatusFilter))+'</strong> only in the contact list below · ' +
        '<span onclick="setSampaignStatusFilter(\''+esc(opts.campaignId)+'\',null)" style="color:var(--gold);cursor:pointer;text-decoration:underline dotted">show all</span></div>'
      : '') +
    // Benchmark bar
    '<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:6px">'+bm.open_rate.label+' · '+bm.reply_rate.label+'</div>' +
      '<div style="display:flex;gap:4px;height:6px">' +
        '<div style="flex:'+s.replied+';background:var(--green);border-radius:var(--r-sm)" title="Replied"></div>' +
        '<div style="flex:'+(s.opened-s.replied)+';background:var(--amber);border-radius:var(--r-sm)" title="Opened, not replied"></div>' +
        '<div style="flex:'+(s.sent-s.opened-(s.bounced||0))+';background:var(--border2);border-radius:var(--r-sm)" title="Sent, not opened"></div>' +
        '<div style="flex:'+(s.bounced||0)+';background:var(--coral);opacity:0.5;border-radius:var(--r-sm)" title="Bounced"></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-top:4px">' +
        '<span style="font-size:11px;color:var(--green)">■ Replied</span>' +
        '<span style="font-size:11px;color:var(--amber)">■ Opened</span>' +
        '<span style="font-size:11px;color:var(--text3)">■ Sent</span>' +
        '<span style="font-size:11px;color:var(--coral)">■ Bounced</span>' +
      '</div>' +
    '</div>' +
  '</div>';

  // ── Hot signals (replied prospects) ───────────────────────────────────
  if (d.hot_signals && d.hot_signals.length) {
    html += '<div style="background:rgba(74,140,92,0.08);border:1px solid rgba(74,140,92,0.25);border-radius:var(--r-md);padding:12px 14px;margin-bottom:10px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg> Replied prospects ('+d.hot_signals.length+') · Act now</div>' +
      d.hot_signals.map(function(h) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-top:1px solid rgba(74,140,92,0.15)">' +
          '<div>' +
            '<div style="font-size:12px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:5px">' +
              (h.prospect_name||h.prospect_email||'Unknown') +
              _sampaignLinkedInIcon(h.linkedin_url, h.prospect_name || h.prospect_email) +
            '</div>' +
            '<div style="font-size:11px;color:var(--text3)">'+(h.prospect_title?esc(h.prospect_title)+' · ':'')+(h.prospect_company||'')+(h.account_name&&h.account_name!==h.prospect_company?' · matched: <strong>'+esc(h.account_name)+'</strong>':'')+'</div>' +
            '<div style="font-size:11px;color:var(--text3);margin-top:1px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> '+esc(h.campaign_name||'')+(h.opens?' · '+h.opens+' opens':'')+'</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0">' +
            '<span style="font-size:11px;font-weight:700;color:var(--green);background:rgba(74,140,92,0.12);border-radius:var(--r-sm);padding:3px 8px">↩ Replied</span>' +
            (h.account_id ? '' : '<div style="font-size:11px;color:var(--amber);margin-top:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> Not linked to account</div>') +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  // ── By rep table ──────────────────────────────────────────────────────
  if (d.by_rep && d.by_rep.length) {
    html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 14px;margin-bottom:10px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11.5a4 4 0 100-8 4 4 0 000 8zM4.5 20.5v-1A5.5 5.5 0 0110 14h4a5.5 5.5 0 015.5 5.5v1"/></svg> By rep</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
      '<thead><tr style="border-bottom:1px solid var(--border)">' +
        '<th style="text-align:left;padding:4px 8px;color:var(--text3);font-weight:500">Rep</th>' +
        '<th style="text-align:center;padding:4px 6px;color:var(--text3);font-weight:500">Prospects</th>' +
        '<th style="text-align:center;padding:4px 6px;color:var(--text3);font-weight:500">Sent</th>' +
        '<th style="text-align:center;padding:4px 6px;color:var(--text3);font-weight:500">Open %</th>' +
        '<th style="text-align:center;padding:4px 6px;color:var(--text3);font-weight:500">Reply %</th>' +
        '<th style="text-align:left;padding:4px 6px;color:var(--text3);font-weight:500">SAMpaigns</th>' +
      '</tr></thead><tbody>' +
      d.by_rep.map(function(rep) {
        var oc = rateColor(rep.open_rate, bm.open_rate.good, bm.open_rate.avg);
        var rc = rateColor(rep.reply_rate, bm.reply_rate.good, bm.reply_rate.avg);
        return '<tr style="border-bottom:1px solid var(--border)">' +
          '<td style="padding:7px 8px"><div style="font-weight:600;color:var(--text)">'+esc(rep.rep_name)+'</div><div style="font-size:11px;color:var(--text3)">'+esc(rep.rep_email.split('@')[0])+'</div></td>' +
          '<td style="text-align:center;padding:7px 6px;color:var(--text)">'+rep.prospects+'</td>' +
          '<td style="text-align:center;padding:7px 6px;color:var(--text)">'+rep.sent+'</td>' +
          '<td style="text-align:center;padding:7px 6px"><span style="color:'+oc+';font-weight:600">'+rep.open_rate+'%</span></td>' +
          '<td style="text-align:center;padding:7px 6px"><span style="color:'+rc+';font-weight:600">'+rep.reply_rate+'%</span></td>' +
          '<td style="padding:7px 6px;font-size:11px;color:var(--text3)">'+esc((rep.campaigns||[]).slice(0,2).join(', '))+'</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

    // ── By account ────────────────────────────────────────────────────────
    if (d.by_account && d.by_account.length) {
      html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 14px;margin-bottom:10px">' +
        '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20.5V5.5L13 3v17.5M13 9.5h7v11M4 20.5h17M7.5 8h2M7.5 12h2M7.5 16h2M16 13h1.5M16 16.5h1.5"/></svg> By account</div>';

      d.by_account.forEach(function(acct) {
        var sigColor = acct.signal==='hot'?'var(--green)':acct.signal==='warm'?'var(--amber)':'var(--text3)';
        var sigIcon  = acct.signal==='hot'?'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg>':acct.signal==='warm'?'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z"/></svg>':'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s6 6.4 6 10.2a6 6 0 11-12 0C6 9.9 12 3.5 12 3.5z"/></svg>';
        var oc = rateColor(acct.open_rate, bm.open_rate.good, bm.open_rate.avg);
        var rc = rateColor(acct.reply_rate, bm.reply_rate.good, bm.reply_rate.avg);

        html += '<div style="padding:10px 0;border-bottom:1px solid var(--border)">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
            '<div>' +
              '<div style="font-size:12px;font-weight:600;color:var(--text)">'+sigIcon+' '+esc(acct.account_name||acct.prospect_company||'Unknown')+'</div>' +
              '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+acct.contacts+' contact'+(acct.contacts!==1?'s':'')+' · '+(acct.campaigns||[]).slice(0,2).join(', ')+'</div>' +
              // Collision flag — active deal found for this domain
              (acct.collision && !acct.collision.is_same_user ?
                '<div style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:3px 8px;background:rgba(var(--c-accent-rgb),0.12);border:1px solid rgba(var(--c-accent-rgb),0.25);border-radius:var(--r-sm)">' +
                '<span style="font-size:11px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg></span>' +
                '<span style="font-size:11px;color:var(--amber);font-weight:500">Active deal: <strong>' + esc(acct.collision.deal_name) + '</strong>' +
                (acct.collision.deal_value ? ' ' + esc(acct.collision.deal_value) : '') +
                ' · AE: ' + esc(acct.collision.ae) + ', coordinate before outreach</span>' +
                '</div>' : '') +
              (acct.collision && acct.collision.is_same_user ?
                '<div style="font-size:11px;color:var(--green);margin-top:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Your own deal, sequences aligned</div>' : '') +
            '</div>' +
            '<div style="display:flex;gap:10px;text-align:center">' +
              '<div><div style="font-size:13px;font-weight:600;color:var(--text)">'+acct.sent+'</div><div style="font-size:11px;color:var(--text3)">sent</div></div>' +
              '<div><div style="font-size:13px;font-weight:600;color:'+oc+'">'+acct.open_rate+'%</div><div style="font-size:11px;color:var(--text3)">opens</div></div>' +
              '<div><div style="font-size:13px;font-weight:600;color:'+rc+'">'+acct.reply_rate+'%</div><div style="font-size:11px;color:var(--text3)">replies</div></div>' +
              (acct.bounced ? '<div><div style="font-size:13px;font-weight:600;color:var(--coral)">'+acct.bounced+'</div><div style="font-size:11px;color:var(--text3)">dead</div></div>' : '') +
            '</div>' +
          '</div>' +
          // Contact detail rows (show replied/opened/bounced status per contact)
          (acct.contacts_detail && acct.contacts_detail.length ?
            '<div style="margin-top:6px;padding-left:12px">' +
            acct.contacts_detail.slice(0,4).map(function(c) {
              var badge = c.bounced ? '<span style="font-size:11px;font-weight:700;color:var(--coral);background:rgba(212,90,90,0.12);border-radius:var(--r-sm);padding:1px 5px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a7.5 7.5 0 00-4 13.9V20h8v-2.6A7.5 7.5 0 0012 3.5zM9.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM14.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg> dead</span>'
                        : c.replied ? '<span style="font-size:11px;font-weight:700;color:var(--green);background:rgba(74,140,92,0.12);border-radius:var(--r-sm);padding:1px 5px">↩ replied</span>'
                        : c.opened ? '<span style="font-size:11px;color:var(--amber)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z"/></svg> opened'+(c.opens>1?' ×'+c.opens:'')+'</span>'
                        : '<span style="font-size:11px;color:var(--text3)">sent</span>';
              return '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;color:var(--text2)">' +
                '<span>'+esc(c.name||c.email||'—')+'</span>'+badge+'</div>';
            }).join('') +
            (acct.contacts_detail.length>4?'<div style="font-size:11px;color:var(--text3)">+'+( acct.contacts_detail.length-4)+' more</div>':'') +
            '</div>' : '') +
        '</div>';
      });
      html += '</div>';
    }

    // ── Dead contacts (bounced, no longer working) ──────────────────────────
    // Defensive: only renders once get_sequencing_stats returns dead_contacts
    // (per-contact bounce receipts). Until then this section is simply absent
    // rather than showing a broken/empty box — honest empty state.
    if (d.dead_contacts && d.dead_contacts.length) {
      html += '<div style="background:rgba(212,90,90,0.06);border:1px solid rgba(212,90,90,0.2);border-radius:var(--r-md);padding:12px 14px;margin-bottom:10px">' +
        '<div style="font-size:11px;font-weight:700;color:var(--coral);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a7.5 7.5 0 00-4 13.9V20h8v-2.6A7.5 7.5 0 0012 3.5zM9.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM14.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg> Dead contacts ('+d.dead_contacts.length+') · bounced, no longer working</div>' +
        d.dead_contacts.map(function(c) {
          return '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid rgba(212,90,90,0.12)">' +
            '<div>' +
              '<div style="font-size:12px;font-weight:600;color:var(--text)">'+esc(c.name||c.email||'Unknown')+'</div>' +
              '<div style="font-size:11px;color:var(--text3)">'+esc(c.company||c.account_name||'')+(c.campaign_name?' · <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> '+esc(c.campaign_name):'')+'</div>' +
            '</div>' +
            '<span style="font-size:11px;font-weight:700;color:var(--coral);background:rgba(212,90,90,0.12);border-radius:var(--r-sm);padding:3px 8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a7.5 7.5 0 00-4 13.9V20h8v-2.6A7.5 7.5 0 0012 3.5zM9.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM14.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg> dead</span>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    // ── By SAMpaign ───────────────────────────────────────────────────────
    if (d.by_campaign && d.by_campaign.length) {
      html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 14px;margin-bottom:10px">' +
        '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> By SAMpaign (sorted by reply rate)</div>' +
        d.by_campaign.map(function(c) {
          var bar = c.sent > 0 ? Math.max(4, Math.round(c.open_rate / 100 * 100)) : 4;
          var rc = rateColor(c.reply_rate, bm.reply_rate.good, bm.reply_rate.avg);
          return '<div style="padding:8px 0;border-bottom:1px solid var(--border)">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
              '<div style="font-size:12px;font-weight:500;color:var(--text)">'+esc(c.campaign_name||c.campaign_id)+'</div>' +
              '<div style="display:flex;gap:8px;font-size:11px">' +
                '<span style="color:var(--text3)">'+c.prospects+' prospects</span>' +
                '<span style="color:var(--amber)">'+c.open_rate+'% open</span>' +
                '<span style="color:'+rc+';font-weight:600">'+c.reply_rate+'% reply</span>' +
              '</div>' +
            '</div>' +
            '<div style="height:4px;background:var(--surface);border-radius:var(--r-sm);overflow:hidden;display:flex">' +
              '<div style="width:'+Math.round(c.reply_rate/Math.max(c.open_rate||1,1)*bar)+'%;background:var(--green)"></div>' +
              '<div style="width:'+Math.round((1-c.reply_rate/Math.max(c.open_rate||1,1))*bar)+'%;background:var(--amber)"></div>' +
            '</div>' +
            (c.hot_accounts&&c.hot_accounts.length?'<div style="font-size:11px;color:var(--green);margin-top:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg> Replies from: '+esc(c.hot_accounts.join(', '))+'</div>':'') +
          '</div>';
        }).join('') +
      '</div>';
    }

    return html;
}

// Fetches BOTH SAMpaign analytics sources (tool-synced SmartReach and the
// manual/no-tool path) in parallel and renders each through the shared
// helper above, clearly labeled so they read as two lenses on one workspace
// rather than a merged number — matches the "SAMpaign is one thing with two
// paths" decision from earlier this session. Either source renders its own
// honest empty state if it has nothing yet; neither blocks the other.
async function loadSequencingStats() {
  var btn = document.getElementById('seqStatsBtn');
  var out = document.getElementById('seqStatsOutput');
  if (!out) return;
 if (btn) { btn.textContent = 'Loading…'; btn.disabled = true; }
  out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">Crunching SAMpaign signals…</div>';

  try {
    var results = await Promise.all([
      fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'get_sequencing_stats', days: 90 }) }).then(function(r){ return r.json(); }).catch(function(e){ return { ok:false, error:e.message }; }),
      fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'get_manual_sampaign_stats' }) }).then(function(r){ return r.json(); }).catch(function(e){ return { ok:false, error:e.message }; })
    ]);
    var toolD = results[0], manualD = results[1];
    var html = '';

    if (toolD.ok && toolD.org_summary && toolD.org_summary.total_prospects > 0) {
      html += _renderSampaignAnalyticsBlock(toolD, { title: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Tool-synced (SmartReach) · last 90 days' });
    } else if (!toolD.ok) {
      html += '<div style="font-size:11px;color:var(--coral);margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> Tool-synced: ' + esc(toolD.error||'Failed to load') + '</div>';
    }

    if (manualD.ok && manualD.org_summary && manualD.org_summary.total_prospects > 0) {
      html += _renderSampaignAnalyticsBlock(manualD, { title: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg> My SAMpaigns (manual)' });
    } else if (!manualD.ok) {
      html += '<div style="font-size:11px;color:var(--coral)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> Manual: ' + esc(manualD.error||'Failed to load') + '</div>';
    }

    out.innerHTML = html || '<div style="font-size:12px;color:var(--text3)">No SAMpaign data yet, sync a sequencing tool or upload contacts to a manual SAMpaign above.</div>';

  } catch(e) {
    if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: '+esc(e.message)+'</div>';
  }
 if (btn) { btn.innerHTML = '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg> Analytics'; btn.disabled = false; }
}

// ── SAM Sub-tab navigation ─────────────────────────────────────────────────────
var _samSubTab = 'signal';
var _selfIvrPeriod = 'last_week';

function setSelfIvrPeriod(period, btn) {
  _selfIvrPeriod = period;
  document.querySelectorAll('#ivrperiod-ivrOutput button').forEach(function(b) {
    b.style.background = 'var(--surface2)'; b.style.borderColor = 'var(--border)'; b.style.color = 'var(--text2)';
  });
  if (btn) { btn.style.background = 'var(--gold)'; btn.style.borderColor = 'var(--gold)'; btn.style.color = 'var(--c-canvas)'; }
  runIntentVsReality(null, 'ivrOutput', period);
}

function setSamSubTab(tab) {
  _samSubTab = tab;
  ['signal','coverage','ivr'].forEach(function(t) {
    var content = document.getElementById('samSub-'+t);
    var btn     = document.getElementById('ssTab-'+t);
    if (content) content.style.display = t === tab ? 'block' : 'none';
    if (btn) {
      btn.style.background = t === tab ? 'var(--gold)' : 'transparent';
      btn.style.color      = t === tab ? 'var(--c-canvas)' : 'var(--text2)';
      btn.style.fontWeight = t === tab ? '600' : '500';
    }
  });
  // Auto-run coverage when switching to that tab for the first time
  if (tab === 'coverage') {
    var covOut = document.getElementById('samCoverageOutput');
    if (covOut && !covOut.innerHTML.trim()) runCoverageCheck(null, null, 'samCoverageOutput');
  }
  // Auto-run IVR when switching to that tab
  if (tab === 'ivr') {
    var ivrOut = document.getElementById('ivrOutput');
    if (ivrOut && !ivrOut.innerHTML.trim()) runIntentVsReality(null, 'ivrOutput', _selfIvrPeriod);
  }
  // The SAMpaign workspace used to be lazily populated here, when the SAM
  // tab's Signal sub-tab was first shown. It now lives in its own top-level
  // tab and loads from switchTab('sampaign'), so this hook is gone rather
  // than left pointing at markup that is no longer in this panel.
}

// ── SAM Daily Brief ───────────────────────────────────────────────────────────
var _briefLoadedDate = '';
var _BRIEF_CACHE_KEY = 'samora_brief_cache';

// Honest labels for why today's brief could not be generated. The server
// sends cache_reason (quota, key_invalid, model_unavailable, ...). Before
// 2026-09-30 every cached brief was labelled "Gemini quota reached", which hid
// a month of non-quota failures.
function _briefFailText(reason, status) {
  switch (reason) {
    case 'quota':                 return 'SAM has used its writing allowance for now';
    case 'key_invalid':           return 'SAM\u2019s AI key for your organisation is invalid or expired';
    case 'access_denied':         return 'SAM\u2019s AI key for your organisation was refused';
    case 'model_unavailable':     return 'SAM\u2019s AI model is unavailable just now';
    case 'grounding_unavailable': return 'SAM\u2019s web search is not available for your organisation';
    case 'blocked':               return 'SAM declined to write this brief';
    case 'truncated':             return 'SAM\u2019s brief was cut off';
    case 'empty':                 return 'SAM came back with an empty brief';
    case 'network':               return 'Could not reach SAM\u2019s AI';
    case 'overloaded':            return 'SAM was too busy to write today\u2019s brief';
    case 'not_configured':        return 'SAM\u2019s AI is not set up for your organisation';
    case 'legacy':                return 'SAM could not refresh today\u2019s brief';
    default:                      return 'SAM could not write today\u2019s brief' + (status ? ' (error ' + status + ')' : '');
  }
}
function _briefDateLabel(ymd) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
  if (!m) return 'an earlier day';
  var mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m[2] - 1];
  return (+m[3]) + ' ' + mon + ' ' + m[1];
}
function _briefBanner(reason, ymd, status) {
  return '<div style="font-size:11px;color:var(--amber);margin-top:8px;padding:4px 8px;background:rgba(var(--c-accent-rgb),0.1);border-radius:var(--r-sm)">' + '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> ' +
    esc(_briefFailText(reason, status) + ': showing your brief from ' + _briefDateLabel(ymd)) + '</div>';
}

async function loadSamBrief(force) {
  var todayKey2 = new Date().toISOString().split('T')[0];
  if (!force && _briefLoadedDate === todayKey2) return;
  var out = document.getElementById('samBriefOutput');
  var btn = document.getElementById('samBriefRefreshBtn');
  if (!out) return;
  if (btn) btn.textContent = '↻';
  out.innerHTML = '<div style="font-size:12px;color:var(--text3);display:flex;align-items:center;gap:6px"><span style="animation:spin 1s linear infinite;display:inline-block">↻</span> SAM is reading your pipeline…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'generate_daily_brief', tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
    });
    var d = await r.json();
    // ANY failure (not only quota) falls back to the last brief this device
    // saw, labelled with what actually went wrong.
    if (!d.ok) {
      var why = d.reason || ((d.error||'').toLowerCase().indexOf('quota') !== -1 ? 'quota' : 'unknown');
      var cached = localStorage.getItem(_BRIEF_CACHE_KEY);
      if (cached) {
        try {
          var c = JSON.parse(cached);
          out.innerHTML = renderBriefHtml(c.brief, c.brief_structured) + _briefBanner(why, c.date, d.status);
          return;
        } catch(e2) {}
      }
      out.innerHTML = '<div style="font-size:12px;color:var(--amber)">' + '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> ' + esc(_briefFailText(why, d.status)) + ' ' + esc(why === 'quota' ? 'The brief will refresh when the quota resets.' : 'No earlier brief is saved on this device yet.') + '</div>';
      return;
    }
    if (d.daily_limit && force) showToast('SAM brief refreshes once per day: showing today’s brief');
    _briefLoadedDate = todayKey2;
    if (!d.cached) { try { localStorage.setItem(_BRIEF_CACHE_KEY, JSON.stringify({ brief: d.brief, brief_structured: d.brief_structured, date: todayKey2 })); } catch(e) {} }
    // A same-day cached brief (daily_limit) is the normal once-a-day path, not
    // a failure, so it gets no warning. Only a genuinely stale brief does.
    out.innerHTML = renderBriefHtml(d.brief, d.brief_structured) +
      ((d.cached && !d.daily_limit) ? _briefBanner(d.cache_reason || 'legacy', d.cached_date, d.cache_reason_status) : '');
  } catch(e) { out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: '+esc(e.message)+'</div>'; }
}

// Coerce a brief into a structured object, tolerating raw JSON strings, code
// fences, and TRUNCATED JSON (Gemini sometimes stops mid-string on the coaching
// line). Salvages top_accounts (a bracket-balanced array is usually still valid
// even when the outer object is cut off later) and the scalar text fields.
function _coerceBrief(brief) {
  if (brief && typeof brief === 'object') return brief;
  if (typeof brief !== 'string') return null;
  var txt = brief.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { var clean = JSON.parse(txt); if (clean && typeof clean === 'object') return clean; } catch (e) {}

  var out = {};
  var ti = txt.indexOf('"top_accounts"');
  if (ti !== -1) {
    var bs = txt.indexOf('[', ti);
    if (bs !== -1) {
      var depth = 0, end = -1, inStr = false, escd = false;
      for (var i = bs; i < txt.length; i++) {
        var ch = txt[i];
        if (inStr) { if (escd) escd = false; else if (ch === '\\') escd = true; else if (ch === '"') inStr = false; continue; }
        if (ch === '"') inStr = true;
        else if (ch === '[') depth++;
        else if (ch === ']') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end !== -1) { try { out.top_accounts = JSON.parse(txt.slice(bs, end + 1)); } catch (e) {} }
    }
  }
  ['coaching_signal', 'calendar_prep', 'priority_before_noon'].forEach(function (k) {
    var m = txt.match(new RegExp('"' + k + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)'));
    if (m && m[1]) {
      var v = m[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
      if (v) out[k] = v;
    }
  });
  return (out.top_accounts || out.coaching_signal || out.calendar_prep || out.priority_before_noon) ? out : null;
}

function renderBriefHtml(brief, brief_structured) {
  var obj = _coerceBrief(brief);
  var html = '';
  if (obj && (obj.top_accounts || obj.coaching_signal || obj.calendar_prep || obj.priority_before_noon)) {
    var topAccts = obj.top_accounts || [];
    if (topAccts.length) {
      html += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V4M4 20h16M8 17V11M12.5 17V7.5M17 17v-4"/></svg> Top 3 accounts today</div>';
      topAccts.slice(0, 3).forEach(function (a) {
        var sc = a.score >= 60 ? 'var(--green)' : a.score >= 35 ? 'var(--amber)' : 'var(--text3)';
        html += '<div style="padding:8px 10px;background:rgba(0,0,0,0.04);border-radius:var(--r-sm);margin-bottom:5px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:3px"><span style="font-size:12px;font-weight:600;color:var(--text)">' + esc(a.name) + '</span>';
        if (a.score) html += '<span style="font-size:11px;font-weight:700;color:' + sc + ';background:' + sc + '18;padding:1px 6px;border-radius:var(--r-sm)">' + a.score + '</span>';
        html += '</div>';
        if (a.reason) html += '<div style="font-size:11px;color:var(--text3);margin-bottom:3px">' + esc(a.reason) + '</div>';
        if (a.action) html += '<div style="font-size:11px;font-weight:600;color:var(--gold)">→ ' + esc(a.action) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    if (obj.calendar_prep && obj.calendar_prep !== 'null') html += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> Calendar prep</div><div style="font-size:12px;color:var(--text2);line-height:1.5">' + esc(obj.calendar_prep) + '</div></div>';
    if (obj.coaching_signal) html += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Coaching</div><div style="font-size:12px;color:var(--text2);line-height:1.5">' + esc(obj.coaching_signal) + '</div></div>';
    if (obj.priority_before_noon) html += '<div style="padding:8px 12px;background:rgba(74,140,92,0.08);border:1px solid rgba(74,140,92,0.2);border-radius:var(--r-sm)"><div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Priority before noon</div><div style="font-size:12px;font-weight:600;color:var(--text)">' + esc(obj.priority_before_noon) + '</div></div>';
    return html;
  }
  // Never dump raw JSON at the user. If it still looks like JSON we could not
  // salvage, ask for a refresh instead of showing braces.
  if (typeof brief === 'string' && brief.trim().length > 10) {
    var t = brief.trim();
    if (t[0] === '{' || t[0] === '[' || /^```/.test(t)) {
      return '<div style="font-size:12px;color:var(--text3);line-height:1.5">Your brief did not finish writing (the model was cut off). Tap ↻ to regenerate it.</div>';
    }
    return '<div style="font-size:12px;color:var(--text2);white-space:pre-wrap;line-height:1.7">' + esc(brief) + '</div>';
  }
  return '<div style="font-size:12px;color:var(--text3)">Brief could not be generated, run Scan channels first to build pipeline context.</div>';
}

// ── Sales Habits ──────────────────────────────────────────────────────────────
var DEFAULT_HABITS = [
  { id:'h1', title:'LinkedIn outreach', channel:'linkedin', days:[1,2,3,4,5], start_time:'09:00', time_of_day:'morning', duration_mins:30, active:true },
  { id:'h2', title:'Email batch / follow-ups', channel:'email', days:[1,2,3,4,5], start_time:'10:00', time_of_day:'morning', duration_mins:45, active:true },
  { id:'h3', title:'Pipeline review & SamoraOS log', channel:'other', days:[1,5], start_time:'16:00', time_of_day:'afternoon', duration_mins:20, active:true },
];
var CHANNEL_ICONS = { linkedin:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1.5 1.5M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1.5-1.5"/></svg>', email:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg>', call:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5H4.5A1.5 1.5 0 003 5c0 8.8 7.2 16 16 16a1.5 1.5 0 001.5-1.5V17l-4.5-2-2.5 2.5A15 15 0 018.5 11L11 8.5z"/></svg>', whatsapp:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg>', other:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.2 14.4a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1v.2a2 2 0 01-4 0v-.1a1.6 1.6 0 00-2.8-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 010-4h.1a1.6 1.6 0 001.1-2.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 014 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7h.2a2 2 0 010 4h-.1a1.6 1.6 0 00-1.4 1.1z"/></svg>' };
var DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var TIME_LABELS = { morning:'Morning (8-12)', afternoon:'Afternoon (12-5)', evening:'Evening (5+)', anytime:'Anytime' };
// Concrete start times (30-min slots) — clean two-way calendar sync.
// time_of_day is kept only as a derived legacy field for old saved habits.
var HABIT_TIME_SLOTS = (function(){ var out=[]; for (var hh=6; hh<=21; hh++){ ['00','30'].forEach(function(mm){ out.push(String(hh).padStart(2,'0')+':'+mm); }); } return out; })();
function _habitTimeLabel(h) {
  if (h.start_time && /^\d{1,2}:\d{2}$/.test(h.start_time)) return h.start_time;
  return TIME_LABELS[h.time_of_day] || 'Anytime';
}
function _timeOfDayFromStart(t) {
  var hh = parseInt((t||'').split(':')[0]);
  return isNaN(hh) ? 'anytime' : hh < 12 ? 'morning' : hh < 17 ? 'afternoon' : 'evening';
}

async function loadHabitsSection() {
  // Guard: if already loaded, just re-render
  if (_userHabits !== null) { _updateHabitsPreview(); renderHabitsSection(); applyHabitsToToday(); return; }

  // Fetch with hard 5-second timeout — habits NEVER block on network
  // If fetch hangs or fails for any reason, we fall back to DEFAULT_HABITS immediately
  try {
    var result = await Promise.race([
      fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (currentUser?.token || ''), 'apikey': SB_KEY },
        body: JSON.stringify({ action: 'get_habits' })
      }).then(function(r) { return r.json(); }),
      new Promise(function(resolve) { setTimeout(function() { resolve({ _timeout: true }); }, 5000); })
    ]);
    if (result && !result._timeout && Array.isArray(result.habits)) {
      // Defaults ONLY for someone who has NEVER set habits.
      //
      // This used to key off result.habits.length, which meant an empty list
      // re-seeded the three defaults — so deleting every habit was impossible.
      // They came back on the next load, every time. An empty list is a valid
      // answer ("I want none"); it is not the same as never having chosen.
      //
      // The server now says which it is via `configured`. The fallback below
      // handles an older edge function that does not send the flag yet: in
      // that case only an empty list AND no flag falls back, which is the old
      // behaviour, so deploying the client first cannot break anything.
      var neverConfigured = (result.configured === false) ||
                            (result.configured === undefined && result.habits.length === 0);
      _userHabits = neverConfigured
        ? DEFAULT_HABITS.map(function(h){ return Object.assign({}, h); })
        : result.habits;
    } else {
      // Timeout / bad response: leave habits unloaded so the next visit
      // retries — do NOT show defaults that could get saved over real data.
      _userHabits = null;
    }
  } catch(e) {
    _userHabits = null;
  }
  if (_userHabits === null) {
    var prevEl = document.getElementById('youHabitsPreview');
    if (prevEl) prevEl.textContent = 'Couldn’t load your habits. Check connection and reopen this tab.';
    return;
  }

  _updateHabitsPreview();
  renderHabitsSection();
  applyHabitsToToday();
}

function _updateHabitsPreview() {
  var prev = document.getElementById('youHabitsPreview');
  if (!prev) return;
  var activeCount = (_userHabits || []).filter(function(h) { return h.active; }).length;
  prev.textContent = activeCount > 0
    ? activeCount + ' active habit' + (activeCount !== 1 ? 's' : '') + ', auto-generating tasks daily'
    : 'No habits configured yet. Tap "Edit habits" to set up recurring activities.';
}

function renderHabitsSection() {
  // samHabitsOutput was in the old SAM tab — habits now live in You tab (youHabitsPreview)
  // Only renders in SAM tab if the div still exists (legacy)
  var out = document.getElementById('samHabitsOutput');
  var todayDow = new Date().getDay();
  var todayHabits = (_userHabits||[]).filter(function(h) { return h.active && (h.days||[]).includes(todayDow); });
  if (!out) return; // You tab is handled separately in loadHabitsSection
  if (!todayHabits.length) { out.innerHTML = '<div style="font-size:12px;color:var(--text3);font-style:italic">No habits for today. <button onclick="openHabitEditor()" style="background:none;border:none;color:var(--gold);cursor:pointer;font-family:var(--sans);font-size:12px">Configure habits →</button></div>'; return; }
  out.innerHTML = todayHabits.map(function(h) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">' +
      '<span style="font-size:16px">'+(CHANNEL_ICONS[h.channel]||'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.2 14.4a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1v.2a2 2 0 01-4 0v-.1a1.6 1.6 0 00-2.8-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 010-4h.1a1.6 1.6 0 001.1-2.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 014 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7h.2a2 2 0 010 4h-.1a1.6 1.6 0 00-1.4 1.1z"/></svg>')+'</span>' +
      '<div style="flex:1"><div style="font-size:12px;font-weight:500;color:var(--text)">'+esc(h.title)+'</div>' +
      '<div style="font-size:11px;color:var(--text3)">'+_habitTimeLabel(h)+' · '+h.duration_mins+' min</div></div>' +
      '<span style="font-size:11px;color:var(--green);font-weight:600">AUTO</span>' +
    '</div>';
  }).join('') + '<div style="margin-top:6px"><button onclick="openHabitEditor()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-family:var(--sans);font-size:11px;padding:0">Edit habits →</button></div>';
}

function applyHabitsToToday() {
  // Auto-inject today's habit tasks into SamoraTrack if not already there
  var d = dayData(viewDate);
  var todayDow = new Date().getDay();
  var todayHabits = (_userHabits||[]).filter(function(h) { return h.active && (h.days||[]).includes(todayDow); });
  todayHabits.forEach(function(h) {
    var alreadyExists = (d.tasks||[]).some(function(t) { return t.text === h.title && t.fromHabit; });
    if (!alreadyExists) {
      d.tasks.push({ text:h.title, done:false, priority:false, fromHabit:true, habitId:h.id, addedAt: new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}) });
    }
  });
  if (todayHabits.length) { save(viewDate); render(); }
}

function openHabitEditor() {
  document.getElementById('habit-modal')?.remove();
  var habits = _userHabits || [];
  var modal = document.createElement('div');
  modal.id = 'habit-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  var habitRows = habits.map(function(h, i) {
    var dayBtns = [1,2,3,4,5,6,0].map(function(dow) {
      var active = (h.days||[]).includes(dow);
      return '<button onclick="toggleHabitDay('+i+','+dow+')" style="width:28px;height:24px;border-radius:var(--r-sm);border:1px solid var(--border);background:'+(active?'var(--gold)':'transparent')+';color:'+(active?'var(--c-canvas)':'var(--text3)')+';font-size:11px;cursor:pointer;font-family:var(--sans)">'+DAY_NAMES[dow]+'</button>';
    }).join('');
    return '<div style="padding:12px;background:var(--surface2);border-radius:var(--r-md);margin-bottom:8px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<span style="font-size:20px">'+(CHANNEL_ICONS[h.channel]||'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.2 14.4a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1v.2a2 2 0 01-4 0v-.1a1.6 1.6 0 00-2.8-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 010-4h.1a1.6 1.6 0 001.1-2.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 014 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7h.2a2 2 0 010 4h-.1a1.6 1.6 0 00-1.4 1.1z"/></svg>')+'</span>' +
        '<input value="'+esc(h.title)+'" onchange="_userHabits['+i+'].title=this.value" style="flex:1;padding:6px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-family:var(--sans);font-size:13px;outline:none"/>' +
        (h.from_calendar || h.pushed_to_calendar
          ? '<span title="Lives on your calendar" style="font-size:12px;flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg></span>'
          : '<button onclick="pushHabitToCalendar('+i+')" title="Create a recurring calendar event from this habit" style="background:none;border:none;color:var(--gold);cursor:pointer;font-size:12px;padding:2px;flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg>↗</button>') +
        '<button onclick="removeHabit('+i+')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:2px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">'+dayBtns+'</div>' +
      '<div style="display:flex;gap:8px">' +
        '<select onchange="_userHabits['+i+'].channel=this.value" style="flex:1;padding:5px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:12px;outline:none">' +
          ['email','linkedin','call','whatsapp','other'].map(function(c){return '<option value="'+c+'"'+(h.channel===c?' selected':'')+'>'+(CHANNEL_ICONS[c]||'')+'  '+c+'</option>';}).join('') +
        '</select>' +
        '<select onchange="_userHabits['+i+'].start_time=this.value;_userHabits['+i+'].time_of_day=_timeOfDayFromStart(this.value)" style="flex:1;padding:5px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:12px;outline:none">' +
          HABIT_TIME_SLOTS.map(function(t){return '<option value="'+t+'"'+(h.start_time===t?' selected':'')+'>'+t+'</option>';}).join('') +
        '</select>' +
        '<input type="number" value="'+h.duration_mins+'" min="5" max="240" onchange="_userHabits['+i+'].duration_mins=parseInt(this.value)" style="width:56px;padding:5px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:12px;outline:none" placeholder="mins"/>' +
      '</div>' +
    '</div>';
  }).join('');

  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:500px;padding:20px;max-height:90vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
      '<div style="font-size:14px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Sales Habits</div>' +
      '<button onclick="document.getElementById(\'habit-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--text3);margin-bottom:14px">Habits auto-generate tasks in SamoraOS on the days you choose. Set it once, forget it.</div>' +
    _renderHabitSuggestions() +
    '<div id="habit-rows">'+habitRows+'</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px">' +
      '<button onclick="addHabit()" style="flex:1;padding:9px;border:1px dashed var(--border2);border-radius:var(--r-sm);background:none;color:var(--text3);font-size:13px;cursor:pointer">+ Add habit</button>' +
      '<button onclick="detectCalendarHabits()" id="detectHabitsBtn" style="flex:1;padding:9px;border:1px dashed var(--gold);border-radius:var(--r-sm);background:none;color:var(--gold);font-size:13px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> Detect from calendar</button>' +
    '</div>' +
    '<button onclick="saveHabits()" style="width:100%;padding:12px;border:none;border-radius:var(--r-md);background:var(--gold);color:var(--c-canvas);font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans)">Save habits</button>' +
  '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);
}

// ── Habits ⇄ Calendar bridge ─────────────────────────────────────────────────
var _habitSuggestions = null;

function _renderHabitSuggestions() {
  if (!_habitSuggestions || !_habitSuggestions.length) return '';
  var h = '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> Detected from your calendar</div>';
  _habitSuggestions.forEach(function(s, i) {
    var dayLbl = (s.days||[]).map(function(d){ return DAY_NAMES[d]; }).join('·');
    h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(var(--c-accent-rgb),0.07);border:1px solid rgba(var(--c-accent-rgb),0.2);border-radius:var(--r-sm);margin-bottom:5px">';
    h += '<span style="font-size:13px">'+(CHANNEL_ICONS[s.channel]||'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg>')+'</span>';
    h += '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(s.title)+'</div>';
    h += '<div style="font-size:11px;color:var(--text3)">'+dayLbl+' · '+esc(s.start_time||'')+' · '+s.duration_mins+'m · seen '+s.occurrences+'×'+(s.is_recurring_series?' · recurring series':'')+'</div></div>';
    h += '<button onclick="addSuggestedHabit('+i+')" style="padding:4px 10px;border-radius:var(--r-sm);background:var(--gold);border:none;color:var(--c-canvas);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--sans);flex-shrink:0">+ Add</button>';
    h += '<button onclick="_habitSuggestions.splice('+i+',1);openHabitEditor()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:0 2px;flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    h += '</div>';
  });
  h += '</div>';
  return h;
}

async function detectCalendarHabits() {
  var btn = document.getElementById('detectHabitsBtn');
  if (btn) { btn.textContent = '↻ Scanning…'; btn.disabled = true; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'detect_calendar_habits', tz: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
    var d = await r.json();
 if (!d.ok) { showToast(d.error || 'Detection failed'); if (btn) { btn.textContent = 'Detect from calendar'; btn.disabled = false; } return; }
    var existing = {};
    (_userHabits||[]).forEach(function(h){ existing[(h.title||'').toLowerCase().replace(/\s*· sam habit$/,'')] = 1; });
    _habitSuggestions = (d.suggestions||[]).filter(function(s){ return !existing[(s.title||'').toLowerCase()]; });
 if (!_habitSuggestions.length) { showToast('No new recurring patterns found in the last 4 weeks'); if (btn) { btn.textContent = 'Detect from calendar'; btn.disabled = false; } return; }
    openHabitEditor(); // re-render with suggestions section
 } catch(e) { showToast('Error: ' + e.message); if (btn) { btn.textContent = 'Detect from calendar'; btn.disabled = false; } }
}

function addSuggestedHabit(i) {
  var s = _habitSuggestions[i]; if (!s) return;
  _userHabits.push({ id:'h'+Date.now(), title:s.title, channel:s.channel||'other', days:s.days||[1,2,3,4,5],
    time_of_day:s.time_of_day||'morning', duration_mins:s.duration_mins||30, active:true,
    from_calendar:true, start_time:s.start_time||null });
  _habitSuggestions.splice(i, 1);
  openHabitEditor();
}

async function pushHabitToCalendar(i) {
  var h = _userHabits[i]; if (!h) return;
  if (!(h.days||[]).length) { showToast('Pick at least one day first'); return; }
  showToast('Creating recurring calendar event…');
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'push_habit_to_calendar', habit:h, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
    var d = await r.json();
    if (!d.ok) { showToast(d.error || 'Could not create event'); return; }
    h.pushed_to_calendar = true;
    fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'save_habits', habits:_userHabits }) }).catch(function(){});
 showToast('Recurring event created, first on ' + (d.first_occurrence||'next matching day'));
    openHabitEditor();
  } catch(e) { showToast('Error: ' + e.message); }
}

function toggleHabitDay(idx, dow) {
  var h = _userHabits[idx]; if (!h) return;
  var days = h.days || [];
  var i = days.indexOf(dow);
  if (i >= 0) days.splice(i,1); else days.push(dow);
  h.days = days;
  openHabitEditor(); // re-render with updated state
}

function removeHabit(idx) { _userHabits.splice(idx, 1); openHabitEditor(); }
function addHabit() {
  _userHabits.push({ id:'h'+Date.now(), title:'New habit', channel:'other', days:[1,2,3,4,5], start_time:'09:00', time_of_day:'morning', duration_mins:30, active:true });
  openHabitEditor();
}

async function saveHabits() {
  try {
    await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'save_habits',habits:_userHabits}) });
    document.getElementById('habit-modal')?.remove();
    renderHabitsSection();
    applyHabitsToToday();
    showToast('Habits saved');
  } catch(e) { alert('Save failed: '+e.message); }
}

// ── Time-by-Account Analytics ─────────────────────────────────────────────────
async function loadTimeAnalytics() {
  var btn = document.getElementById('timeAnalyticsBtn');
  var out = document.getElementById('timeAnalyticsOutput');
  if (!out) return;
 if (btn) { btn.textContent = 'Analysing…'; btn.disabled = true; }
  out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">Reading last 30 days of calendar…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_time_analytics',days:30}) });
    var d = await r.json();
    if (!d.ok) { out.innerHTML = '<div style="font-size:12px;color:var(--coral)">'+esc(d.error||'Failed')+'</div>'; return; }

    var html = '<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 14px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5.2l3.2 2"/></svg> How you spent your time · last 30 days</div>' +
      '<div style="display:flex;gap:12px;margin-bottom:12px">' +
        '<div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--text)">'+d.customer_hours+'h</div><div style="font-size:11px;color:var(--text3)">Customer</div></div>' +
        '<div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--text3)">'+d.internal_hours+'h</div><div style="font-size:11px;color:var(--text3)">Internal</div></div>' +
        '<div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--text3)">'+d.unclassified_hours+'h</div><div style="font-size:11px;color:var(--text3)">Other</div></div>' +
      '</div>';

    // Mismatches — the most useful part
    if (d.mismatches.over_invested.length || d.mismatches.under_invested.length) {
      html += '<div style="padding:8px 10px;border-radius:var(--r-sm);margin-bottom:10px;background:rgba(var(--c-accent-rgb),0.08)">';
      if (d.mismatches.under_invested.length) html += '<div style="font-size:11px;color:var(--green);margin-bottom:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg> Hot accounts you\'re under-investing in: <strong>'+d.mismatches.under_invested.join(', ')+'</strong></div>';
      if (d.mismatches.over_invested.length) html += '<div style="font-size:11px;color:var(--amber)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> Cold accounts consuming your time: <strong>'+d.mismatches.over_invested.join(', ')+'</strong></div>';
      html += '</div>';
    }

    var maxMins = Math.max.apply(null, (d.by_account||[]).map(function(a){return a.minutes;})||[1]);
    html += d.by_account.slice(0,8).map(function(a) {
      var pct = maxMins > 0 ? a.minutes/maxMins*100 : 0;
      var sigColor = a.signal_score >= 60 ? 'var(--green)' : a.signal_score >= 35 ? 'var(--amber)' : 'var(--text3)';
      var misColor = a.mismatch === 'under_invested' ? 'var(--green)' : a.mismatch === 'over_invested' ? 'var(--amber)' : 'transparent';
      var misIcon  = a.mismatch === 'under_invested' ? '↑ invest more' : a.mismatch === 'over_invested' ? '↓ over-indexed' : '';
      return '<div style="margin-bottom:7px">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:2px">' +
          '<span style="font-size:12px;color:var(--text)">'+esc(a.account_name)+'</span>' +
          '<div style="display:flex;gap:8px;align-items:center">' +
            (misIcon ? '<span style="font-size:11px;color:'+misColor+';font-weight:700">'+misIcon+'</span>' : '') +
            (a.signal_score != null ? '<span style="font-size:11px;color:'+sigColor+';font-weight:600">sig '+a.signal_score+'</span>' : '') +
            '<span style="font-size:12px;color:var(--text2);font-weight:500">'+a.hours+'h</span>' +
          '</div>' +
        '</div>' +
        '<div style="height:5px;background:var(--surface);border-radius:var(--r-sm);overflow:hidden">' +
          '<div style="height:100%;width:'+pct+'%;background:'+(a.mismatch==='over_invested'?'var(--amber)':a.mismatch==='under_invested'?'var(--green)':'var(--gold)')+';border-radius:var(--r-sm)"></div>' +
        '</div>' +
      '</div>';
    }).join('');

    html += '</div>';
    out.innerHTML = html;
  } catch(e) { out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: '+esc(e.message)+'</div>'; }
 if (btn) { btn.textContent = 'Time by account'; btn.disabled = false; }
}

async function scanNotetakerEmails() {
  var btn = document.getElementById('scanCallsBtn');
  var out = document.getElementById('seqSyncOutput');
 if (btn) { btn.textContent = 'Scanning…'; btn.disabled = true; }
  if (out) out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">Scanning Gmail for meeting notes from any notetaker tool…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'scan_notetaker_emails', days:30}) });
    var d = await r.json();
    if (!d.ok) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)">'+esc(d.error||'Scan failed')+'</div>'; return; }
    if (out) out.innerHTML = '<div style="background:var(--surface2);border-radius:var(--r-sm);padding:10px 12px;margin-top:6px">' +
      '<div style="font-size:11px;font-weight:600;color:var(--gold);margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Email scan complete · '+d.processed+'/'+d.scanned+' notes extracted</div>' +
      '<div style="font-size:11px;color:var(--text3)">Works with Fireflies, Fathom, Otter, Grain, tl;dv, Gong, any tool that emails you. Zero extra config needed.</div>' +
      (d.titles&&d.titles.length?'<div style="font-size:11px;color:var(--text2);margin-top:4px">'+d.titles.slice(0,3).map(function(t){return esc(t)}).join(' · ')+'</div>':'') +
    '</div>';
  } catch(e) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: '+esc(e.message)+'</div>'; }
 if (btn) { btn.textContent = 'Scan call emails'; btn.disabled = false; }
}

// ── Per-user notetaker connection ─────────────────────────────────────────────
async function openNotetakerConnect() {
  document.getElementById('notetaker-connect-modal')?.remove();
  // Load existing connections
  var existingConns = [];
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_user_connections'}) });
    var d = await r.json();
    existingConns = d.connections || [];
  } catch(e) {}

  var connList = existingConns.map(function(c) {
    var provIcons = { fireflies:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg>', read_ai:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z"/></svg>', fathom:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>', otter:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>', grain:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>', gong:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg>' };
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface2);border-radius:var(--r-sm);margin-bottom:6px">' +
      '<div><span style="font-size:14px">'+(provIcons[c.provider]||'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5v5M15 3.5v5M6.5 8.5h11v3a5.5 5.5 0 01-11 0zM12 17v4"/></svg>')+'</span> <strong style="font-size:13px">'+esc(c.provider)+'</strong>'+(c.provider_email?' <span style="font-size:11px;color:var(--text3)">'+esc(c.provider_email)+'</span>':'')+'</div>' +
      '<button onclick="disconnectNotetaker(\''+esc(c.provider)+'\')" style="background:none;border:1px solid var(--border);border-radius:var(--r-sm);padding:4px 10px;font-size:11px;color:var(--coral);cursor:pointer;font-family:var(--sans)">Disconnect</button>' +
    '</div>';
  }).join('');

  var providers = [
    { id:'fireflies', name:'Fireflies.ai', icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg>', help:'Settings → Integrations → API → Generate key', available:true },
    { id:'read_ai',   name:'Read.ai',      icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z"/></svg>', help:'app.read.ai → Settings → API → Get access token', available:true },
    { id:'fathom',    name:'Fathom',       icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>', help:'Coming soon, use email scanning for now', available:false },
    { id:'otter',     name:'Otter.ai',     icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>', help:'Coming soon, use email scanning for now', available:false },
    { id:'grain',     name:'Grain',        icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>', help:'Coming soon, use email scanning for now', available:false },
  ].filter(function(p) { return !existingConns.some(function(c){return c.provider===p.id;}); });

  var modal = document.createElement('div');
  modal.id = 'notetaker-connect-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:500px;padding:20px;max-height:80vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
      '<div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5v5M15 3.5v5M6.5 8.5h11v3a5.5 5.5 0 01-11 0zM12 17v4"/></svg> Connect your notetaker</div>' +
        '<div style="font-size:12px;color:var(--text3);margin-top:2px">Your personal connection, independent of your org. Direct API gives full transcripts + richer signals.</div>' +
      '</div>' +
      '<button onclick="document.getElementById(\'notetaker-connect-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +

    // Email scan note — always available
    '<div style="background:rgba(74,140,92,0.08);border:1px solid rgba(74,140,92,0.2);border-radius:var(--r-sm);padding:10px 12px;margin-bottom:14px">' +
      '<div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Email scanning always works, zero config</div>' +
      '<div style="font-size:11px;color:var(--text3)">Fireflies, Fathom, Otter, Grain, tl;dv, Gong, Avoma, if it emails you a meeting summary, Samora parses it automatically. Use "Scan call emails" in SAM Intelligence. Direct API connection gives full transcripts with higher signal quality.</div>' +
    '</div>' +

    (existingConns.length ? '<div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:8px">CONNECTED</div>' + connList : '') +

    (providers.length ? '<div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:10px">ADD CONNECTION</div>' +
    providers.map(function(p) {
      var available = p.available;
      return '<div style="padding:12px;background:var(--surface2);border-radius:var(--r-md);margin-bottom:8px">' +
        '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">'+p.icon+' '+p.name+(available?'':' <span style="font-size:11px;color:var(--text3)">(coming)</span>')+'</div>' +
        (available ? '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">'+p.help+'</div>' +
        '<div style="display:flex;gap:8px">' +
          '<input id="nt-key-'+p.id+'" type="password" placeholder="API key / access token" style="flex:1;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:13px;font-family:var(--sans);outline:none"/>' +
          '<input id="nt-email-'+p.id+'" type="email" placeholder="Your email at '+p.name+'" style="flex:1;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:13px;font-family:var(--sans);outline:none"/>' +
        '</div>' +
        '<button onclick="connectNotetaker(\''+p.id+'\')" style="width:100%;margin-top:8px;padding:9px;border:none;border-radius:var(--r-sm);background:var(--gold);color:var(--c-canvas);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--sans)">Connect '+p.name+'</button>'
        : '<div style="font-size:11px;color:var(--text3)">'+p.help+'</div>') +
      '</div>';
    }).join('') : '') +
  '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);
}

