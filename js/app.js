let SB_URL = localStorage.getItem('dt-sb-url') || 'https://gowpuicpmrwsohongosf.supabase.co';
let SB_KEY = localStorage.getItem('dt-sb-key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvd3B1aWNwbXJ3c29ob25nb3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTExMDgsImV4cCI6MjA5NTk2NzEwOH0.35CjODxyxOjAKp-xBOBx4oAXO_qjLyVttVaJEhp7YEg';
let API_KEY = localStorage.getItem('dt-api-key') || '';
var _userHabits = null;
// Cache buster — update this string on every deploy to purge stale service worker cache
var APP_VERSION = '20260712-04';
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
  authMode = m;
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', i === (m==='login'?0:1)));
  document.getElementById('authBtn').textContent = m === 'login' ? 'Sign in' : 'Create account';
  document.getElementById('signupFields').style.display = m === 'signup' ? 'block' : 'none';
  const rp = document.getElementById('rolePickerWrap');
  if (rp) rp.style.display = m === 'signup' ? 'block' : 'none';
  if (m === 'signup') pickSignupRole('sdr');
  showMsg('');
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
  google: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.readonly',
    'email', 'profile'
  ].join(' '),
  // Supabase calls the Microsoft provider "azure".
  microsoft: 'openid email profile offline_access Mail.Read Mail.Send Calendars.Read'
};

function ssoSignIn(which) {
  if (!SB_URL || !SB_KEY) { showMsg('Sign-in is not configured in this build.', true); return; }
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
      if (!signupUser?.id) { showMsg('Signup failed — please try again.', true); btn.disabled=false; btn.textContent='Create account'; return; }
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
      if (!signinUser?.id) { showMsg('Sign in failed — please try again.', true); btn.disabled=false; btn.textContent='Sign in'; return; }
      currentUser = { id: signinUser.id, email: signinUser.email || email, token: d.access_token, refresh_token: d.refresh_token };
      localStorage.setItem('dt-user', JSON.stringify(currentUser));
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
      sbGet(`user_profiles?user_id=eq.${currentUser.id}&select=role,org_id,manager_id`),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    if (rows && rows.length) {
      const p = rows[0];
      const orgs = await sbGet(`organisations?id=eq.${p.org_id}&select=org_code,name&limit=1`);
      profile = { ...p, org_code: orgs?.[0]?.org_code || '—', org_name: orgs?.[0]?.name || 'Unknown' };
      localStorage.setItem('dt-profile-' + currentUser.id, JSON.stringify(profile));
    } else { await setupProfile(''); }
  } catch(e) { const cached = localStorage.getItem('dt-profile-' + currentUser?.id); if (cached) profile = JSON.parse(cached); }
  // get_org_config fires in background — never blocks launchApp
  try {
    fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_org_config'}) })
      .then(r=>r.json()).then(cfg=>{ if(cfg.ok){if(cfg.googleClientId)GOOGLE_CLIENT_ID_SAM=cfg.googleClientId;window._orgConfig=cfg;} }).catch(()=>{});
  } catch(e) {}
}
function doLogout() {
  localStorage.removeItem('dt-user'); currentUser = null; profile = null; allData = {};
  // Habits are per-user server state — clear the in-memory copy so the next
  // user who signs in on this device fetches THEIR habits instead of seeing
  // (and accidentally saving over their profile with) the previous user's.
  _userHabits = null; _habitSuggestions = null;
  document.getElementById('appScreen').classList.remove('active');
  document.getElementById('authScreen').classList.add('active');
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
  if (navExec) navExec.style.display = ['director','executive','admin','super_admin'].includes(role) ? '' : 'none';
  const navIntelBtn = document.getElementById('nav-intel');
  if (navIntelBtn) navIntelBtn.style.display = seniorRole ? '' : 'none';
}
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

function launchApp() {
  showSplash('Reading your pipeline…');
  document.getElementById('authScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('active');
  const role = profile?.role || 'member';
  _applyRoleChrome();
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
  syncBadge.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:4px 12px;font-size:11px;color:var(--text3);font-family:var(--sans);z-index:9998;opacity:0;transition:opacity 0.3s;pointer-events:none';
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
 if (badge) { badge.textContent = 'Offline — showing local data'; setTimeout(function(){ badge.style.opacity='0'; setTimeout(function(){badge.remove();},400); }, 2000); }
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
  const cfg = { tasks:['<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>','No tasks yet'], issues:['<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>','No issues logged'], wins:['<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.8l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 10l5.9-.8z"/></svg>','No wins yet'], misses:['○','No misses — all clear!'] };
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
      const noteHtml = item.completionNote ? `<div style="font-size:11px;color:var(--text2);background:var(--surface2);border-radius:2px;padding:4px 8px;margin-top:4px;font-style:italic"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg> ${esc(item.completionNote)}</div>` : '';
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
    const anonBadge = item.anonymous ? '<span style="font-size:11px;background:rgba(var(--c-accent-rgb),0.15);color:var(--gold);border-radius:2px;padding:1px 6px;margin-left:6px;font-weight:600">Anon</span>' : '';
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
  document.getElementById('progLbl').textContent = total ? done + ' of ' + total + ' done' : 'No tasks yet';
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

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const panelMap = { tasks:'today', issues:'today', wins:'today', misses:'today', settings:'you', org:'you', intel:'intel' };
  const actualPanel = panelMap[tab] || tab;
  const panel = document.getElementById('panel-' + actualPanel);
  if (panel) panel.classList.add('active');
  const navMap = { tasks:'today', issues:'today', wins:'today', misses:'today', settings:'you', org:'you', intel:'intel' };
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
  if (tab === 'settings') { renderSettings(); if (currentUser?.token) { loadHealthWeights(); loadNotificationRules(); } }
  if (tab === 'you') { renderYouPanel(); refreshYouTabConnections(); loadHabitsSection(); loadEnrichmentStatus(); }
  if (tab === 'review') renderSummary();
  if (tab === 'exec') loadExecDashboard();
  if (tab === 'signals') {
    const seniorRole = ['super_admin','admin','manager','director','executive'].includes(profile?.role);
    const toggleEl = document.getElementById('samModeToggle');
    if (toggleEl) toggleEl.style.display = seniorRole ? 'block' : 'none';
    const mode = (seniorRole && _samMode === 'team') ? 'team' : 'self';
    setSamMode(mode);
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
  if (tab === 'pipeline') { loadPipeline(); loadMeetingsKpiSelf(); }
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
 if (sub) sub.textContent = '' + (d.provider==='microsoft'?'Outlook':'Gmail') + ' · ' + esc(d.email);
        } else {
          if (banner) banner.style.display = 'block';
          if (sub) sub.textContent = 'Connect Gmail or Outlook in You tab to enable signal verification';
        }
      }).catch(function(){});
  }
}
function switchToOrgPanel() {
  if (!['super_admin','admin'].includes(profile?.role)) return;
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
      const msg = { tasks:'No tasks yet — add what you need to get done today', issues:'No issues logged today', wins:'No wins yet — complete a task or log one', misses: viewDate === todayKey() ? 'No misses yet' : 'No misses on this date' };
      listEl.innerHTML = '<div class="empty-msg" style="padding:20px 0;color:var(--text3);font-size:14px;text-align:center">' + msg[s.key] + '</div>';
    }
  });
  const addBox = document.getElementById('today-add-box'); if (addBox) addBox.style.display = todayActiveSection === 'misses' ? 'none' : '';
  updateSectionPillCounts();
  initSortable();
  const d2 = dayData(viewDate);
  renderProductivityBanner(d2.tasks||[]);
  showNudgeBanner(d2.tasks||[]);
  // Load coaching alerts once per session on Today tab
  if (!_coachingAlertsLoaded && currentUser?.token) {
    _coachingAlertsLoaded = true;
    loadCoachingAlerts();
    loadMeetingPrep();
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
        ? '<span style="font-size:11px;font-weight:700;color:var(--amber);background:rgba(var(--c-accent-rgb),0.12);border-radius:2px;padding:1px 6px;margin-left:6px;white-space:nowrap">\u2709 ' + esc(item.sendProgress) + ' sent</span>'
        : '';
      const verifyBadge = (item.autoCompleted && verifyLabels[item.verifiedVia])
        ? '<span style="font-size:11px;font-weight:700;color:var(--green);background:rgba(74,140,92,0.12);border-radius:2px;padding:1px 6px;margin-left:6px;white-space:nowrap">' + verifyLabels[item.verifiedVia] + '</span>'
        : (item.meetingFlag ? '<span style="font-size:11px;font-weight:700;color:var(--amber);background:rgba(var(--c-accent-rgb),0.12);border-radius:2px;padding:1px 6px;margin-left:6px;white-space:nowrap">\u26a0 Meeting ' + item.meetingFlag + '</span>' : progressBadge);
      const carryMeta = item.carriedFrom ? '<div class="item-meta" style="color:var(--gold)">↗ Carried from ' + fmtDate(item.carriedFrom) + (item.carryReason?' · '+item.carryReason:'') + '</div>' : (item.carriedTo ? '<div class="item-meta" style="color:var(--text3)">' + (item.rescheduled ? '⟳ Rescheduled to ' : '⟶ Moved to ') + (item.carriedToLabel||item.carriedTo) + '</div>' : '');
      // Alt-contact CTA — surfaced when an OOO reply named someone else to
      // reach in the meantime (see extractAltContact in process_ooo_mails).
      // Snippet is the raw matched line, shown as the receipt so the rep can
      // eyeball it before trusting the extracted email/phone.
      const altContactCta = (item.altContactEmail || item.altContactPhone)
        ? '<div class="item-meta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:2px">' +
            '<span style="color:var(--text3)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6.5h6l2 2.5h9v11h-17z"/></svg> Alt contact while OOO' + (item.altContactSnippet ? ': "' + esc(item.altContactSnippet) + '"' : '') + '</span>' +
            (item.altContactEmail ? '<a href="mailto:' + esc(item.altContactEmail) + '" style="font-size:11px;font-weight:600;color:var(--gold);text-decoration:none;border:1px solid var(--border2);border-radius:2px;padding:1px 7px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> ' + esc(item.altContactEmail) + '</a>' : '') +
            (item.altContactPhone ? '<a href="tel:' + esc(item.altContactPhone.replace(/[^\d+]/g,'')) + '" style="font-size:11px;font-weight:600;color:var(--gold);text-decoration:none;border:1px solid var(--border2);border-radius:2px;padding:1px 7px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5H4.5A1.5 1.5 0 003 5c0 8.8 7.2 16 16 16a1.5 1.5 0 001.5-1.5V17l-4.5-2-2.5 2.5A15 15 0 018.5 11L11 8.5z"/></svg> ' + esc(item.altContactPhone) + '</a>' : '') +
          '</div>'
        : '';
      const tsMeta = (item.addedAt ? '<div class="item-meta">' + (item.delegatedBy?'Delegated ':'Added ') + item.addedAt + (item.completedAt?' · Completed '+item.completedAt:'') + '</div>' : '') + carryMeta + altContactCta;
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
    const anonBadge = item.anonymous ? '<span style="font-size:11px;background:rgba(var(--c-accent-rgb),0.15);color:var(--gold);border-radius:2px;padding:1px 6px;margin-left:6px;font-weight:600">Anon</span>' : '';
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
  const rp = document.getElementById('youRolePill'); if (rp) { rp.textContent = (profile?.role||'').replace('_',' '); rp.className = 'role-pill rp-'+(profile?.role||''); }
  const op = document.getElementById('youOrgPill'); if (op) op.textContent = profile?.org_code || profile?.org_name || '';
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
  const orgBtn = document.getElementById('orgMenuBtn'); if (orgBtn) orgBtn.style.display = ['super_admin','admin'].includes(profile?.role) ? '' : 'none';
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
      else { feed.innerHTML = '<div style="text-align:center;padding:32px 20px;color:var(--text3);font-size:13px">No strong signals found — pipeline looks healthy <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg></div>'; }
      return;
    }
    renderSignalCards(signals);
  } catch(e) { renderGmailNotConnected(); }
}
function renderGmailNotConnected() {
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
  const MS_CLIENT_ID = ''; // Set this after Azure App Registration
  if (!MS_CLIENT_ID) {
    alert('Microsoft integration setup required.\n\nAsk your Samora admin to:\n1. Create an Azure App Registration\n2. Add MICROSOFT_CLIENT_ID to edge function secrets\n3. Set the redirect URI to: ' + window.location.origin);
    return;
  }
  const redirectUri = window.location.origin;
  const scopes = 'Mail.Read Calendars.Read offline_access User.Read';
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
 showToast('Outlook connected — ' + d.email);
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
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_calendar_tasks', date: today2, tz: Intl.DateTimeFormat().resolvedOptions().timeZone}) });
    var d = await r.json();
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
        return '<button data-cal-idx="'+i+'" class="cal-add-btn" style="margin:0 3px;padding:2px 7px;border-radius:3px;background:rgba(var(--c-accent-rgb),0.15);border:1px solid var(--border2);color:var(--gold);font-family:var(--sans);font-size:11px;cursor:pointer">+'+esc(t.title.slice(0,25))+'</button>';
      }).join('');
      status.innerHTML = '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> ' + newTasks.length + ' calendar event' + (newTasks.length!==1?'s':'') + ' today — ' + btnsHtml +
        '<button id="calAddAllBtn" style="margin-left:6px;padding:2px 8px;border-radius:3px;background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer">Add all</button>';
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
var _connectorHost  = 'https://samoratrack.vercel.app';

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
    _connectorHost  = d.host || 'https://samoratrack.vercel.app';
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
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;background:var(--bg);border:1px solid var(--border2);border-radius:2px;margin-bottom:4px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:11px;font-family:monospace;color:var(--text2)">' + esc(k.key_prefix) + '…</div>' +
            '<div style="font-size:11px;color:var(--text3)">' + esc(k.label || 'Key') + ' · ' + used + '</div>' +
          '</div>' +
          '<button onclick="revokeConnectorKey(\'' + k.id + '\')" style="background:none;border:1px solid var(--border2);border-radius:2px;color:var(--text3);font-size:11px;cursor:pointer;padding:3px 8px;font-family:var(--sans)">Revoke</button>' +
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
 lbl.textContent = 'Mac — paste this in Terminal (no file download, no security warning)';
    step1.innerHTML   = 'Step 1: Press <strong>Cmd + Space</strong> → type <strong>Terminal</strong> → press Enter';
    _currentInstallCmd = "python3 -c \"import json,os; p=os.path.expanduser('~/Library/Application Support/Claude/claude_desktop_config.json'); c=json.load(open(p)) if os.path.exists(p) else {}; c.setdefault('mcpServers',{})['samoratrack']={'url':'" + mcpUrl + "'}; json.dump(c,open(p,'w'),indent=2); print('Done! Restart Claude Desktop.')\"";
    step2.innerHTML   = 'Step 2: Paste the command above → press <strong>Enter</strong><br>Step 3: Quit Claude Desktop (Cmd+Q) → reopen → look for <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.2 14.4a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1v.2a2 2 0 01-4 0v-.1a1.6 1.6 0 00-2.8-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 010-4h.1a1.6 1.6 0 001.1-2.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 014 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7h.2a2 2 0 010 4h-.1a1.6 1.6 0 00-1.4 1.1z"/></svg> in chat';
  } else {
 lbl.textContent = 'Windows — paste this in PowerShell';
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
  var text = 'SamoraTrack → ChatGPT Custom GPT (admin setup)\n\n1. chat.openai.com → My GPTs → Create a GPT → Configure tab\n2. Name: "SamoraTrack Intelligence"\n3. Actions → Create new action → Import from URL:\n   ' + host + '/api/connector/openapi.json\n4. Authentication: API Key → Bearer → token: ' + token + '\n5. Save → Publish → Share GPT link with team\n\nTeam clicks the link. No setup. Just chat.\n\nExample: "What is going wrong with my pipeline?", "Who needs coaching?", "Analyse last week IVR"';
  navigator.clipboard.writeText(text).then(function() { showToast('ChatGPT setup steps copied'); });
}

function copyGeminiSetup() {
  var host = _connectorHost; var token = _connectorToken;
  var text = 'SamoraTrack → Gemini (admin setup)\n\nAPI base: ' + host + '/api/connector\nAuth: Authorization: Bearer ' + token + '\nSchema: GET ' + host + '/api/connector/gemini-tools\n\nEndpoints (POST):\n  /get_pipeline, /get_coverage, /get_intent_vs_reality\n  /get_team_overview, /get_daily_brief, /get_account_signals\n\nFor Gems: gemini.google.com → Gems → Create → add API config above → Share link';
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

function _updateEnrichmentStatus(provider, scope, connected) {
  var elId = provider + (scope === 'org' ? 'OrgStatus' : 'UserStatus');
  var btnId = provider + (scope === 'org' ? 'OrgBtn'    : 'UserBtn');
  var el = document.getElementById(elId);
  var btn = document.getElementById(btnId);
 if (el) el.textContent = connected ? 'Connected' : 'Not connected';
  if (el)  el.style.color = connected ? 'var(--green)' : 'var(--text3)';
  if (btn && scope === 'user') btn.textContent = connected ? 'Change' : 'Connect';
}

async function loadEnrichmentStatus() {
  try {
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'get_enrichment_status' })
    });
    var d = await r.json();
    if (d.ok && d.providers) {
      ['apollo','lusha','hunter'].forEach(function(p) {
        if (d.providers[p + '_org'])  _updateEnrichmentStatus(p, 'org',  true);
        if (d.providers[p + '_user']) _updateEnrichmentStatus(p, 'user', true);
      });
    }
  } catch(e) {}
}

async function refreshYouTabConnections() {
  // Sync connection status labels from edge function
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_email_provider'}) });
    var d = await r.json();
    var lbl = document.getElementById('youEmailConnLabel');
    var sub = document.getElementById('youEmailConnSub');
    var gmailBtn = document.getElementById('youGmailBtn');
    var outlookBtn = document.getElementById('youOutlookBtn');
    if (d.connected) {
      var icon = d.provider === 'microsoft' ? '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Outlook' : '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Gmail';
      if (lbl) lbl.innerHTML = '<span style="color:var(--green)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg></span> ' + icon + ' connected — ' + esc(d.email);
      if (sub) sub.textContent = 'Signals refreshed from your ' + (d.provider === 'microsoft' ? 'Outlook' : 'Gmail') + ' account';
 if (gmailBtn && d.provider === 'google') { gmailBtn.textContent = 'Gmail connected'; gmailBtn.style.background = 'var(--green)'; }
 if (outlookBtn && d.provider === 'microsoft') { outlookBtn.textContent = 'Outlook connected'; outlookBtn.style.background = 'var(--green)'; }
    }
    // Also update SAM tab label
    var samLbl = document.getElementById('samGmailLabel'); var samSub = document.getElementById('samGmailSub');
    if (d.connected) {
 if (samLbl) samLbl.textContent = '' + (d.provider === 'microsoft' ? 'Outlook' : 'Gmail') + ' connected';
      if (samSub) samSub.textContent = 'Signals refreshed · ' + esc(d.email);
    }
  } catch(e) {}

  // Habits preview
  if (_userHabits !== null) { _updateHabitsPreview(); }

  // Notetaker status
  try {
    var nr = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_user_connections'}) });
    var nd = await nr.json();
    var ns = document.getElementById('youNotetakerStatus');
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
async function refreshPushStatus() {
  var statusEl = document.getElementById('youPushStatus');
  var btn = document.getElementById('pushToggleBtn');
  var testBtn = document.getElementById('pushTestBtn');
  var hint = document.getElementById('youPushHint');
  if (!statusEl || !btn) return;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!_pushSupported()) {
    statusEl.innerHTML = '<span style="color:var(--text3)">Not supported on this browser</span>';
    btn.style.display = 'none';
    if (hint) hint.textContent = isIOS ? 'On iPhone, open SamoraTrack from the Home Screen (Share → Add to Home Screen) to enable notifications.' : '';
    return;
  }
  if (isIOS && !_isStandalone()) {
    statusEl.innerHTML = '<span style="color:var(--amber)">Install to Home Screen first</span>';
    btn.style.display = 'none';
    if (hint) hint.textContent = 'On iPhone: tap Share → Add to Home Screen, then open SamoraTrack from the new icon to turn on notifications.';
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
    btn.style.display = 'none';
    if (hint) hint.textContent = 'Notifications are blocked. Re-enable them for this site in your browser/site settings, then reload.';
    return;
  }
  if (subbed) {
    statusEl.innerHTML = '<span style="color:var(--green)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Notifications on for this device</span>';
 btn.textContent = 'Turn off'; btn.style.background = 'var(--surface2)'; btn.style.color = 'var(--text2)'; btn.style.border = '1px solid var(--border2)';
    if (testBtn) testBtn.style.display = '';
    if (hint) hint.textContent = '';
  } else {
    statusEl.innerHTML = '<span style="color:var(--text3)">Off on this device</span>';
 btn.textContent = 'Enable notifications'; btn.style.background = 'var(--gold)'; btn.style.color = 'var(--c-on-accent)'; btn.style.border = 'none';
    if (testBtn) testBtn.style.display = 'none';
    if (hint) hint.textContent = '';
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
 body:JSON.stringify({ action:'send_push', to_self:true, title:'SamoraTrack', body:'Notifications are working.', url:'/' }) });
    var d = await r.json();
    showToast(d.ok ? 'Test sent — check your notifications' : 'Test failed: ' + (d.error||''));
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
      '<span style="font-size:11px;padding:1px 7px;border-radius:3px;background:'+cfg.color+'20;color:'+cfg.color+';font-weight:600">'+cfg.icon+' '+cfg.label+'</span>' +
      (s.confidence >= 80 ? '<span style="font-size:11px;color:var(--green)">High confidence</span>' : '') +
    '</div>' +
    '<div style="font-size:12px;color:var(--text);line-height:1.5">'+esc(headline.slice(0,160))+'</div>' +
    (detail ? '<div style="font-size:11px;color:var(--text2);margin-top:3px;line-height:1.4">'+esc(detail.slice(0,180))+'</div>' : '') +
    (sourceUrl ? '<a href="'+esc(sourceUrl)+'" target="_blank" rel="noopener" style="font-size:11px;color:var(--blue);text-decoration:none;margin-top:3px;display:inline-block">'+esc(sourceName||'Source')+' →</a>' : '') +
  '</div>';
}

function connectGmail() {
  const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email');
  const redirectUri = 'https://samoratrack.vercel.app/gmail-callback.html';
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + GOOGLE_CLIENT_ID_SAM + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&response_type=code&scope=' + scope + '&access_type=offline&prompt=consent';
  const popup = window.open(url, 'gmail_oauth', 'width=500,height=600,left=200,top=100');
  window.addEventListener('message', async function handler(e) {
    if (e.origin !== 'https://samoratrack.vercel.app') return;
    if (!e.data?.code) return;
    window.removeEventListener('message', handler);
    if (popup) popup.close();
    const btn = document.getElementById('samGmailBtn'); const label = document.getElementById('samGmailLabel');
    if (btn) { btn.textContent = 'Connecting…'; btn.disabled = true; }
    if (label) label.textContent = 'Connecting Gmail…';
    try {
      const r = await fetch(EDGE_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY }, body: JSON.stringify({ action: 'connect_gmail', code: e.data.code, redirect_uri: redirectUri, email: '' }) });
      const data = await r.json();
      if (data.ok || data.success) {
 if (label) label.textContent = 'Gmail connected — ' + (data.email || '');
        const sub = document.getElementById('samGmailSub'); if (sub) sub.textContent = 'Signals loading…';
        if (btn) { btn.textContent = 'Refresh'; btn.disabled = false; btn.onclick = loadSamSignals; }
        loadSamSignals();
      } else { throw new Error(data.error || 'Connection failed'); }
    } catch(err) {
      if (label) label.textContent = 'Connection failed: ' + err.message;
      if (btn) { btn.textContent = 'Try again'; btn.disabled = false; btn.onclick = connectGmail; }
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
    if (hour < 12) nudge = pending+' task'+(pending>1?'s':'')+' open — finish by noon for a perfect score';
    else if (hour < 15) nudge = pending+' task'+(pending>1?'s':'')+' open — close them before 3pm';
    else if (hour < 18) nudge = pending+' task'+(pending>1?'s':'')+' remaining — finish before 6pm';
    else nudge = pending+' task'+(pending>1?'s':'')+' still open — complete them now';
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
      weekDates.map(function(d){ const h=d.score!==null?Math.max(3,Math.round((d.score/100)*16)):3; const bc=d.score!==null?scoreColor(d.score):'var(--surface2)'; const opacity=d.isToday?'1':'0.5'; return '<div style="flex:1;text-align:center"><div style="height:'+h+'px;background:'+bc+';border-radius:2px;opacity:'+opacity+'"></div></div>'; }).join('') +
    '</div>' +
    '<span style="font-size:11px;color:var(--text3);flex-shrink:0">'+_bnChev+'</span>' +
    '</div>' +
    '<div style="display:'+_bnOpen+';padding-top:8px;margin-top:6px;border-top:1px solid var(--border)">' +
      '<div style="display:flex;gap:12px;margin-bottom:6px"><div style="font-size:11px;color:var(--text3)">Completion <span style="color:var(--text2);font-weight:500">'+completion+'</span></div><div style="font-size:11px;color:var(--text3)">Rhythm <span style="color:var(--text2);font-weight:500">'+rhythm+'</span></div><div style="font-size:11px;color:var(--text3)">Week avg <span style="color:var(--text2);font-weight:500">'+weekScore+'</span></div></div>' +
      '<div style="display:flex;gap:4px;align-items:flex-end;margin-bottom:6px">' +
        weekDates.map(function(d){ const h=d.score!==null?Math.max(4,Math.round((d.score/100)*22)):4; const bc=d.score!==null?scoreColor(d.score):'var(--surface2)'; const opacity=d.isToday?'1':'0.5'; return '<div style="flex:1;text-align:center"><div style="height:'+h+'px;background:'+bc+';border-radius:2px;opacity:'+opacity+';margin-bottom:2px"></div><div style="font-size:11px;color:'+(d.isToday?'var(--gold)':'var(--text3)')+'">'+d.label+'</div></div>'; }).join('') +
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
    if (a.sentiment) html += '<span style="padding:2px 8px;border-radius:3px;background:rgba(0,0,0,0.1);color:'+sentimentColor+';font-weight:500">'+a.sentiment+'</span>';
    html += '</div>';

    if (a.summary) html += '<div style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:14px;padding:12px 14px;background:var(--surface2);border-radius:var(--radius);border-left:3px solid var(--gold)"><div style="font-size:11px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> SAM Analysis</div>' + esc(a.summary) + '</div>';

    // Recent replies — the actual evidence of two-way engagement, not just outbound
    if (data.inboxThreads?.length) {
      html += '<div style="margin-bottom:14px">';
      html += '<div style="font-size:11px;font-weight:600;color:var(--green);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">↩ Recent replies</div>';
      data.inboxThreads.slice(0,3).forEach(function(t) {
        html += '<div style="background:rgba(74,140,92,0.06);border:1px solid rgba(74,140,92,0.2);border-radius:2px;padding:8px 12px;margin-bottom:6px">' +
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
      html += '<div style="border:1px solid var(--border);border-radius:2px;overflow:hidden;margin-top:10px">';
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
          (signalCount > 0 ? '<div style="font-size:11px;color:var(--gold)">' + signalCount + ' signal' + (signalCount>1?'s':'') + ' extracted — see Intel tab for details</div>' : '') +
        '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style=\"font-size:11px;color:var(--text3);padding:8px 2px\">No extracted intelligence for this account yet — run ↻ Refresh in the Intel tab to scan meeting notes.</div>';
    }

    // Find this account in pipeline to link to deal Signals tab
    var matchedDeal = null;
    if (_pipelineData) {
      var allDeals = [...(_pipelineData.verified||[]),...(_pipelineData.partial||[]),...(_pipelineData.unverified||[])];
      matchedDeal = allDeals.find(function(d) { return (d.account||'').toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().includes((d.account||'').toLowerCase().split(' ')[0]); });
    }
    if (matchedDeal) {
      html += '<button onclick="openDealDetail(\'' + esc(matchedDeal.id) + '\',\'' + esc(matchedDeal.account) + '\');setTimeout(function(){switchDealTab(\'signals\');},400)" style="width:100%;margin-top:10px;padding:9px;border-radius:2px;background:rgba(58,110,168,0.08);border:1px solid rgba(58,110,168,0.2);color:var(--blue);font-family:var(--sans);font-size:12px;font-weight:500;cursor:pointer;text-align:center"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg> View market signals for ' + esc(matchedDeal.account) + ' →</button>';
    }

    if (out) out.innerHTML = html;
  } catch(e) { if (out) out.innerHTML = '<div style="font-size:13px;color:var(--coral);padding:12px">Error: ' + esc(e.message) + '</div>'; }
}
function renderSamAlerts() {
  const alerts = document.getElementById('samAlerts'); if (!alerts) return;
  const d = dayData(viewDate);
  const incomplete = (d.tasks||[]).filter(t => !t.done);
  if (incomplete.length > 0) alerts.innerHTML = '<div style="background:rgba(var(--c-accent-rgb),0.1);border:1px solid var(--border2);border-radius:var(--radius);padding:12px 16px;margin-bottom:8px;font-size:13px;color:var(--text2)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> <strong style="color:var(--gold)">'+incomplete.length+' task'+(incomplete.length>1?'s':'')+' pending today</strong> — log your progress in Today tab</div>';
  else alerts.innerHTML = '';
}
async function loadMyAccounts() {
  const list = document.getElementById('myAccountsList'); if (!list || !currentUser?.token || !profile?.org_id) return;
  try {
    // Unified mapping: show accounts where I'm the owner/AE OR the assigned SDR
    const rows = await sbGet('org_accounts?or=(user_id.eq.' + currentUser.id + ',sdr_user_id.eq.' + currentUser.id + ')&org_id=eq.' + profile.org_id + '&select=id,account_name,domain,additional_domains,region,deal_value,deal_value_usd,user_id,sdr_user_id&order=account_name');
    if (!rows || !rows.length) { list.innerHTML = '<div style="font-size:12px;color:var(--text3);font-style:italic">No accounts assigned yet.</div>'; return; }
    var _canAssignTeam = ['manager','director','executive','admin','super_admin'].includes(profile?.role);
    list.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px">' + rows.map(r => {
      var hasValue = r.deal_value != null;
      var extraDomains = (r.additional_domains || []).length;
      var valueTag = hasValue
        ? '<span style="font-size:11px;color:var(--green);font-weight:500">$' + (r.deal_value_usd ? Math.round(r.deal_value_usd/1000)+'K' : r.deal_value) + '</span>'
        : '';
      return '<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:var(--surface2);border-radius:3px">' +
        '<span style="font-size:12px;color:var(--text)">' + esc(r.account_name) + '</span>' +
        (r.region ? '<span style="font-size:11px;color:var(--text3);background:rgba(0,0,0,0.1);border-radius:2px;padding:1px 5px">' + esc(r.region) + '</span>' : '') +
        valueTag +
        '<button onclick="openDealValueForm(\'' + r.id + '\',\'' + esc(r.account_name) + '\')" style="background:none;border:none;color:' + (hasValue ? 'var(--text3)' : 'var(--amber)') + ';cursor:pointer;font-size:11px;padding:0" title="' + (hasValue ? 'Edit deal value' : 'Add deal value') + '">' + (hasValue ? '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v10M14.8 9.3A3 3 0 0012 7.8h-.4a2.2 2.2 0 000 4.4h.8a2.2 2.2 0 010 4.4H12a3 3 0 01-2.8-1.5"/></svg>' : '+ $') + '</button>' +
        '<button onclick="openDomainManager(\'' + r.id + '\',\'' + esc(r.account_name) + '\',\'' + esc(r.domain||'') + '\',' + JSON.stringify(r.additional_domains||[]) + ')" style="background:none;border:none;color:' + (extraDomains ? 'var(--green)' : 'var(--text3)') + ';cursor:pointer;font-size:11px;padding:0" title="Manage email domains for signal matching"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg>' + (extraDomains ? '<sup style=\'font-size:11px\'>+'+extraDomains+'</sup>' : '') + '</button>' +
        (r.sdr_user_id && r.sdr_user_id === currentUser.id && r.user_id !== currentUser.id
          ? '<span style="font-size:11px;font-weight:700;color:var(--gold);background:rgba(var(--c-accent-rgb),0.12);border-radius:2px;padding:1px 5px" title="You are the SDR on this account">SDR</span>' : '') +
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
      '<input value="' + esc(d) + '" placeholder="e.g. in.lactalis.com" style="flex:1;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;color:var(--text);font-size:13px;font-family:var(--sans);outline:none" class="dm-domain-input" />' +
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
    '<div style="background:var(--surface2);border-radius:2px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:var(--text3);line-height:1.5">' +
      '<strong style="color:var(--text2)">How brand root matching works:</strong> SAM automatically detects that <em>in.lactalis.com</em>, <em>lactalis.fr</em> and <em>lactalis.sa</em> all belong to Lactalis by stripping the country subdomain and TLD. ' +
      'Only add domains here if automatic matching misses them — for example when the company uses a completely different domain for a specific region.' +
    '</div>' +
    '<div id="dm-domain-rows">' + rows + '</div>' +
    '<button onclick="addDmRow()" style="width:100%;padding:9px;border:1px dashed var(--border2);border-radius:2px;background:none;color:var(--text3);font-size:13px;cursor:pointer;margin-bottom:14px">+ Add another domain</button>' +
    '<button onclick="saveDomains()" style="width:100%;padding:12px;border:none;border-radius:3px;background:var(--gold);color:var(--c-canvas);font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans)">Save domains</button>' +
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
  row.innerHTML = '<input placeholder="e.g. lactalis-international.fr" style="flex:1;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;color:var(--text);font-size:13px;font-family:var(--sans);outline:none" class="dm-domain-input" />' +
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
  return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:' + cfg.color + ';background:rgba(0,0,0,0.12);border-radius:2px;padding:2px 7px;letter-spacing:0.02em">' + cfg.icon + ' ' + cfg.label + '</span>';
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
    return '<button onclick="setIvrPeriod(\''+outputId+'\',\''+period+'\',this)" style="padding:4px 10px;border-radius:3px;font-size:11px;cursor:pointer;font-family:var(--sans);border:1px solid '+(isActive?'var(--gold)':'var(--border)')+';background:'+(isActive?'var(--gold)':'var(--surface2)')+';color:'+(isActive?'var(--c-canvas)':'var(--text2)')+'">'+label+'</button>';
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
    '<input type="date" id="ivrfrom-'+outputId+'" style="background:var(--surface2);border:1px solid var(--border2);border-radius:2px;padding:5px 8px;color:var(--text);font-family:var(--sans);font-size:12px"/>' +
    '<span style="font-size:11px;color:var(--text3)">to</span>' +
    '<input type="date" id="ivrto-'+outputId+'" style="background:var(--surface2);border:1px solid var(--border2);border-radius:2px;padding:5px 8px;color:var(--text);font-family:var(--sans);font-size:12px"/>' +
    '<button onclick="runIntentVsReality(\''+(_ivrRepId[outputId]||'')+'\',\''+outputId+'\')" style="padding:5px 12px;border-radius:2px;background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer">Apply</button>' +
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
    return '<div onclick="setIvrFilter(\'' + outputId + '\',\'' + filterKey + '\')" style="background:' + (isActive ? color.replace('var(--','rgba(').replace(')',',.15)') : 'var(--surface2)') + ';border-radius:2px;padding:10px 6px;text-align:center;cursor:pointer;border:2px solid ' + (isActive ? color : 'transparent') + ';transition:all 0.15s">' +
      '<div style="font-size:20px;font-weight:700;color:' + color + '">' + value + '</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + label + '</div>' +
    '</div>';
  };

  var html = picker;
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">';
  html += mkBox('All tasks', s.total || 0, 'var(--text)', 'all');
  html += mkBox('Verified', s.verified || 0, 'var(--green)', 'verified');
  html += mkBox('Self-reported', s.taskDone || 0, 'var(--blue)', 'task_done');
  html += mkBox('Gaps', s.gaps || 0, 'var(--coral)', 'gap');
  html += '</div>';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><div style="flex:1;height:5px;background:var(--surface2);border-radius:2px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:2px"></div></div><div style="font-size:12px;font-weight:600;color:' + barColor + '">' + pct + '% verified</div></div>';
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
    task_done:       { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>',  color: 'var(--blue)',    bg: 'rgba(58,110,168,0.08)', badge: 'Marked done — no external verification (LinkedIn/WhatsApp/calls cannot be verified externally yet)' },
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
      replyAnalysisHtml = '<div style="margin-top:5px;padding:5px 8px;background:rgba(0,0,0,0.06);border-radius:2px;display:flex;gap:6px;align-items:flex-start">' +
        '<span style="font-size:11px;font-weight:700;color:' + raColor + ';flex-shrink:0">' + raIcon + ' ' + raLabel + '</span>' +
        (ra.snippet ? '<span style="font-size:11px;color:var(--text3);font-style:italic">"' + esc(ra.snippet.slice(0, 100)) + (ra.snippet.length > 100 ? '…' : '') + '"</span>' : '') +
      '</div>';
    }

    // Intent badge for non-obvious classifications
    var intentBadge = '';
    if (r.intent === 'internal' || r.intent === 'internal_pending') {
      intentBadge = '<div style="font-size:11px;color:var(--text3);margin-top:3px;font-style:italic"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg> Internal task — not externally verifiable</div>';
    } else if (r.signal === 'attested') {
      var outcomeLabels = { no_answer:'No answer', spoke_briefly:'Spoke briefly', full_conversation:'Full conversation', meeting_booked:'Meeting booked <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg>', not_interested:'Not interested', requests_sent:'Requests sent', connections_accepted:'Connections accepted', messages_sent:'Messages sent', replies_received:'Replies received' };
      var outcomeLabel = outcomeLabels[r.activityOutcome] || r.activityOutcome || '';
      intentBadge = '<div style="font-size:11px;color:var(--green);margin-top:4px;font-weight:600"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> ' + esc(outcomeLabel) + (r.completionNote ? ' — "' + esc(r.completionNote.slice(0,80)) + '"' : '') + '</div>';
    } else if (r.signal === 'task_done') {
      intentBadge = '<div style="font-size:11px;color:var(--blue);margin-top:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Marked done — add outcome via "Log outcome" for stronger verification</div>';
    } else if (r.intent === 'linkedin') {
      intentBadge = '<div style="font-size:11px;color:var(--text3);margin-top:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1.5 1.5M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1.5-1.5"/></svg> LinkedIn — use close-out form to log outcome</div>';
    } else if (r.intent === 'call') {
      intentBadge = '<div style="font-size:11px;color:var(--text3);margin-top:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5H4.5A1.5 1.5 0 003 5c0 8.8 7.2 16 16 16a1.5 1.5 0 001.5-1.5V17l-4.5-2-2.5 2.5A15 15 0 018.5 11L11 8.5z"/></svg> Call — use close-out form to log outcome when marking done</div>';
    }

    // Quantity mismatch display
    var quantityNote = '';
    if (r.quantityClaimed > 1) {
      var found = r.emailsFound || 0;
      var claimed = r.quantityClaimed;
      var ratio = r.verificationRatio || 0;
      var qColor = ratio >= 60 ? 'var(--green)' : ratio >= 30 ? 'var(--amber)' : 'var(--coral)';
      if (r.signal === 'partial_count') {
        quantityNote = '<div style="font-size:11px;margin-top:4px;padding:4px 8px;background:rgba(var(--c-accent-rgb),0.1);border-radius:2px;color:var(--amber)">◑ ' + found + ' of ' + claimed + ' emails found in Gmail (' + ratio + '%) — ' + (claimed - found) + ' unverified</div>';
      } else if (found > 0) {
        quantityNote = '<div style="font-size:11px;color:var(--text3);margin-top:3px">' + found + '/' + claimed + ' emails verified in Gmail</div>';
      }
    }

    var noSourceNote = sig === 'no_source' ? '<div style="font-size:11px;color:var(--text3);margin-top:4px;font-style:italic">Completed — log the outcome when marking done for a self-attested signal</div>' : '';

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
    return '<button onclick="setCoveragePeriod(\''+outputId+'\',\''+period+'\',this)" style="padding:4px 10px;border-radius:3px;font-size:11px;cursor:pointer;font-family:var(--sans);border:1px solid '+(isActive?'var(--gold)':'var(--border)')+';background:'+(isActive?'var(--gold)':'var(--surface2)')+';color:'+(isActive?'var(--c-canvas)':'var(--text2)')+'">'+label+'</button>';
  };
  return '<div id="covperiod-'+outputId+'" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
    mk('today','Today') + mk('week','This week') + mk('month','This month') + mk('custom','Custom range') +
    '</div>' +
    '<div id="covcustom-'+outputId+'" style="display:'+(active==='custom'?'flex':'none')+';gap:8px;align-items:center;margin-bottom:10px">' +
      '<input type="date" id="covfrom-'+outputId+'" style="background:var(--surface2);border:1px solid var(--border2);border-radius:2px;padding:5px 8px;color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<span style="font-size:11px;color:var(--text3)">to</span>' +
      '<input type="date" id="covto-'+outputId+'" style="background:var(--surface2);border:1px solid var(--border2);border-radius:2px;padding:5px 8px;color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<button onclick="runCoverageCheck(\''+(_coverageRepId[outputId]||'')+'\',\''+(_coverageRepEmail[outputId]||'')+'\',\''+outputId+'\')" style="padding:5px 12px;border-radius:2px;background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer">Apply</button>' +
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
    parts.push('<span title="Email" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--text2);background:rgba(0,0,0,0.08);border-radius:2px;padding:2px 6px">' + CHANNEL_ICON_CONFIG.email + ' ' + channels.email.sent + (channels.email.replies>0?'/'+channels.email.replies+'\u21a9':'') + '</span>');
  }
  if (channels.calendar.meetings > 0) {
    parts.push('<span title="Calendar meetings" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--text2);background:rgba(0,0,0,0.08);border-radius:2px;padding:2px 6px">' + CHANNEL_ICON_CONFIG.calendar + ' ' + channels.calendar.meetings + '</span>');
  }
  if (channels.notetaker.count > 0) {
    parts.push('<span title="Notetaker" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--text2);background:rgba(0,0,0,0.08);border-radius:2px;padding:2px 6px">' + CHANNEL_ICON_CONFIG.notetaker + ' ' + channels.notetaker.count + '</span>');
  }
  // Future channels — shown greyed-out as "not connected" rather than
  // omitted, so it's visible these exist as a roadmap, not forgotten.
  ['call','whatsapp','linkedin'].forEach(function(ch) {
    if (!channels[ch].integrated) {
      parts.push('<span title="' + ch + ' \u2014 no integration yet" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--text3);opacity:0.4;background:rgba(0,0,0,0.05);border-radius:2px;padding:2px 6px">' + CHANNEL_ICON_CONFIG[ch] + '</span>');
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
    html += '<div style="font-size:11px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> SAM Intelligence — Deal Pipeline</div>';
    html += '<div style="display:flex;gap:6px;margin-bottom:10px">';
    [{stage:'commercial',icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3z"/></svg>',color:'var(--green)',label:'Commercial'},{stage:'value_prop',icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.8v.4"/></svg>',color:'var(--gold)',label:'Value Prop'},{stage:'prospective',icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>',color:'var(--text2)',label:'Prospective'}].forEach(function(s) {
      html += '<div style="flex:1;background:rgba(0,0,0,0.06);border-radius:2px;padding:6px;text-align:center"><div style="font-size:16px;font-weight:600;color:'+s.color+'">'+(sc[s.stage]||0)+'</div><div style="font-size:11px;color:var(--text3)">'+s.icon+' '+s.label+'</div></div>';
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
          var stalenessBadge = a.staleness==='cold'?'<span style="font-size:11px;font-weight:700;color:var(--coral);background:rgba(192,82,63,0.12);border-radius:2px;padding:1px 5px;margin-left:4px">\u2744 COLD</span>':a.staleness==='stale'?'<span style="font-size:11px;color:var(--amber);margin-left:4px">STALE</span>':'';
          var regionBadge = a.region ? '<span style="font-size:11px;color:var(--text3);background:rgba(0,0,0,0.06);border-radius:2px;padding:1px 6px;margin-left:4px">' + esc(a.region) + '</span>' : '';
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
      html += '<div style="background:var(--surface2);border-radius:2px;padding:7px 10px;margin-bottom:4px"><div style="font-size:12px;font-weight:500;color:var(--text)">'+esc(s.account||'')+'</div><div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(s.subject||s.snippet||'')+'</div></div>';
    });
    html += '</div>';
  } else if (samData && !samData.connected) {
    html += '<div style="font-size:12px;color:var(--text3)">Gmail not connected for this rep</div>';
  }

  if (!html) html = '<div style="font-size:12px;color:var(--text3);padding:8px 0">No signals found — add accounts in Org → Rep Accounts</div>';
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

  html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:12px 14px;margin-bottom:10px">' +
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
          ' style="background:'+(isActive?'var(--surface2)':'var(--surface)')+';border-radius:2px;padding:10px;text-align:center;' +
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
        '<div style="flex:'+s.replied+';background:var(--green);border-radius:2px" title="Replied"></div>' +
        '<div style="flex:'+(s.opened-s.replied)+';background:var(--amber);border-radius:2px" title="Opened, not replied"></div>' +
        '<div style="flex:'+(s.sent-s.opened-(s.bounced||0))+';background:var(--border2);border-radius:2px" title="Sent, not opened"></div>' +
        '<div style="flex:'+(s.bounced||0)+';background:var(--coral);opacity:0.5;border-radius:2px" title="Bounced"></div>' +
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
    html += '<div style="background:rgba(74,140,92,0.08);border:1px solid rgba(74,140,92,0.25);border-radius:3px;padding:12px 14px;margin-bottom:10px">' +
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
            '<span style="font-size:11px;font-weight:700;color:var(--green);background:rgba(74,140,92,0.12);border-radius:2px;padding:3px 8px">↩ Replied</span>' +
            (h.account_id ? '' : '<div style="font-size:11px;color:var(--amber);margin-top:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> Not linked to account</div>') +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  // ── By rep table ──────────────────────────────────────────────────────
  if (d.by_rep && d.by_rep.length) {
    html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:12px 14px;margin-bottom:10px">' +
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
      html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:12px 14px;margin-bottom:10px">' +
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
                '<div style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:3px 8px;background:rgba(var(--c-accent-rgb),0.12);border:1px solid rgba(var(--c-accent-rgb),0.25);border-radius:2px">' +
                '<span style="font-size:11px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg></span>' +
                '<span style="font-size:11px;color:var(--amber);font-weight:500">Active deal: <strong>' + esc(acct.collision.deal_name) + '</strong>' +
                (acct.collision.deal_value ? ' ' + esc(acct.collision.deal_value) : '') +
                ' · AE: ' + esc(acct.collision.ae) + ' — coordinate before outreach</span>' +
                '</div>' : '') +
              (acct.collision && acct.collision.is_same_user ?
                '<div style="font-size:11px;color:var(--green);margin-top:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Your own deal — sequences aligned</div>' : '') +
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
              var badge = c.bounced ? '<span style="font-size:11px;font-weight:700;color:var(--coral);background:rgba(212,90,90,0.12);border-radius:2px;padding:1px 5px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a7.5 7.5 0 00-4 13.9V20h8v-2.6A7.5 7.5 0 0012 3.5zM9.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM14.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg> dead</span>'
                        : c.replied ? '<span style="font-size:11px;font-weight:700;color:var(--green);background:rgba(74,140,92,0.12);border-radius:2px;padding:1px 5px">↩ replied</span>'
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
      html += '<div style="background:rgba(212,90,90,0.06);border:1px solid rgba(212,90,90,0.2);border-radius:3px;padding:12px 14px;margin-bottom:10px">' +
        '<div style="font-size:11px;font-weight:700;color:var(--coral);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a7.5 7.5 0 00-4 13.9V20h8v-2.6A7.5 7.5 0 0012 3.5zM9.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM14.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg> Dead contacts ('+d.dead_contacts.length+') · bounced, no longer working</div>' +
        d.dead_contacts.map(function(c) {
          return '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid rgba(212,90,90,0.12)">' +
            '<div>' +
              '<div style="font-size:12px;font-weight:600;color:var(--text)">'+esc(c.name||c.email||'Unknown')+'</div>' +
              '<div style="font-size:11px;color:var(--text3)">'+esc(c.company||c.account_name||'')+(c.campaign_name?' · <svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> '+esc(c.campaign_name):'')+'</div>' +
            '</div>' +
            '<span style="font-size:11px;font-weight:700;color:var(--coral);background:rgba(212,90,90,0.12);border-radius:2px;padding:3px 8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a7.5 7.5 0 00-4 13.9V20h8v-2.6A7.5 7.5 0 0012 3.5zM9.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM14.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg> dead</span>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    // ── By SAMpaign ───────────────────────────────────────────────────────
    if (d.by_campaign && d.by_campaign.length) {
      html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:12px 14px;margin-bottom:10px">' +
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
            '<div style="height:4px;background:var(--surface);border-radius:2px;overflow:hidden;display:flex">' +
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

    out.innerHTML = html || '<div style="font-size:12px;color:var(--text3)">No SAMpaign data yet — sync a sequencing tool or upload contacts to a manual SAMpaign above.</div>';

  } catch(e) {
    if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: '+esc(e.message)+'</div>';
  }
 if (btn) { btn.textContent = 'Seq stats'; btn.disabled = false; }
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
    if (!d.ok && (d.error||'').toLowerCase().includes('quota')) {
      var cached = localStorage.getItem(_BRIEF_CACHE_KEY);
      if (cached) {
        try {
          var c = JSON.parse(cached);
          out.innerHTML = renderBriefHtml(c.brief, c.brief_structured) +
            '<div style="font-size:11px;color:var(--amber);margin-top:8px;padding:4px 8px;background:rgba(var(--c-accent-rgb),0.1);border-radius:2px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> Gemini quota reached — showing brief from ' + esc(c.date||'earlier') + '</div>';
          return;
        } catch(e2) {}
      }
      out.innerHTML = '<div style="font-size:12px;color:var(--amber)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> Gemini quota reached for today. Brief will refresh tomorrow.</div>';
      return;
    }
    if (!d.ok) { out.innerHTML = '<div style="font-size:12px;color:var(--text3)">'+esc(d.error||'Brief unavailable')+'</div>'; return; }
    if (d.daily_limit && force) showToast('SAM brief refreshes once per day: showing today’s brief');
    _briefLoadedDate = todayKey2;
    if (!d.cached) { try { localStorage.setItem(_BRIEF_CACHE_KEY, JSON.stringify({ brief: d.brief, brief_structured: d.brief_structured, date: todayKey2 })); } catch(e) {} }
    out.innerHTML = renderBriefHtml(d.brief, d.brief_structured) +
      (d.cached ? '<div style="font-size:11px;color:var(--amber);margin-top:8px;padding:4px 8px;background:rgba(var(--c-accent-rgb),0.1);border-radius:2px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> Gemini quota reached — showing last brief from ' + esc(d.cached_date||'earlier') + '</div>' : '');
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
        html += '<div style="padding:8px 10px;background:rgba(0,0,0,0.04);border-radius:2px;margin-bottom:5px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:3px"><span style="font-size:12px;font-weight:600;color:var(--text)">' + esc(a.name) + '</span>';
        if (a.score) html += '<span style="font-size:11px;font-weight:700;color:' + sc + ';background:' + sc + '18;padding:1px 6px;border-radius:2px">' + a.score + '</span>';
        html += '</div>';
        if (a.reason) html += '<div style="font-size:11px;color:var(--text3);margin-bottom:3px">' + esc(a.reason) + '</div>';
        if (a.action) html += '<div style="font-size:11px;font-weight:600;color:var(--gold)">→ ' + esc(a.action) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    if (obj.calendar_prep && obj.calendar_prep !== 'null') html += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> Calendar prep</div><div style="font-size:12px;color:var(--text2);line-height:1.5">' + esc(obj.calendar_prep) + '</div></div>';
    if (obj.coaching_signal) html += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Coaching</div><div style="font-size:12px;color:var(--text2);line-height:1.5">' + esc(obj.coaching_signal) + '</div></div>';
    if (obj.priority_before_noon) html += '<div style="padding:8px 12px;background:rgba(74,140,92,0.08);border:1px solid rgba(74,140,92,0.2);border-radius:2px"><div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Priority before noon</div><div style="font-size:12px;font-weight:600;color:var(--text)">' + esc(obj.priority_before_noon) + '</div></div>';
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
  return '<div style="font-size:12px;color:var(--text3)">Brief could not be generated — run Scan channels first to build pipeline context.</div>';
}

// ── Sales Habits ──────────────────────────────────────────────────────────────
var DEFAULT_HABITS = [
  { id:'h1', title:'LinkedIn outreach', channel:'linkedin', days:[1,2,3,4,5], start_time:'09:00', time_of_day:'morning', duration_mins:30, active:true },
  { id:'h2', title:'Email batch / follow-ups', channel:'email', days:[1,2,3,4,5], start_time:'10:00', time_of_day:'morning', duration_mins:45, active:true },
  { id:'h3', title:'Pipeline review & SamoraTrack log', channel:'other', days:[1,5], start_time:'16:00', time_of_day:'afternoon', duration_mins:20, active:true },
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
      // Defaults ONLY when the server confirms this user has no habits yet.
      // On error/timeout we must NOT fall back to DEFAULT_HABITS — a later
      // "Save habits" would overwrite the user's real server-side habits.
      _userHabits = result.habits.length ? result.habits : DEFAULT_HABITS.map(function(h){ return Object.assign({}, h); });
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
    ? activeCount + ' active habit' + (activeCount !== 1 ? 's' : '') + ' — auto-generating tasks daily'
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
      return '<button onclick="toggleHabitDay('+i+','+dow+')" style="width:28px;height:24px;border-radius:2px;border:1px solid var(--border);background:'+(active?'var(--gold)':'transparent')+';color:'+(active?'var(--c-canvas)':'var(--text3)')+';font-size:11px;cursor:pointer;font-family:var(--sans)">'+DAY_NAMES[dow]+'</button>';
    }).join('');
    return '<div style="padding:12px;background:var(--surface2);border-radius:3px;margin-bottom:8px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<span style="font-size:20px">'+(CHANNEL_ICONS[h.channel]||'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.2 14.4a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1v.2a2 2 0 01-4 0v-.1a1.6 1.6 0 00-2.8-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 010-4h.1a1.6 1.6 0 001.1-2.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 014 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7h.2a2 2 0 010 4h-.1a1.6 1.6 0 00-1.4 1.1z"/></svg>')+'</span>' +
        '<input value="'+esc(h.title)+'" onchange="_userHabits['+i+'].title=this.value" style="flex:1;padding:6px 8px;background:var(--bg);border:1px solid var(--border);border-radius:2px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none"/>' +
        (h.from_calendar || h.pushed_to_calendar
          ? '<span title="Lives on your calendar" style="font-size:12px;flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg></span>'
          : '<button onclick="pushHabitToCalendar('+i+')" title="Create a recurring calendar event from this habit" style="background:none;border:none;color:var(--gold);cursor:pointer;font-size:12px;padding:2px;flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg>↗</button>') +
        '<button onclick="removeHabit('+i+')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:2px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">'+dayBtns+'</div>' +
      '<div style="display:flex;gap:8px">' +
        '<select onchange="_userHabits['+i+'].channel=this.value" style="flex:1;padding:5px;background:var(--bg);border:1px solid var(--border);border-radius:2px;color:var(--text);font-size:12px;outline:none">' +
          ['email','linkedin','call','whatsapp','other'].map(function(c){return '<option value="'+c+'"'+(h.channel===c?' selected':'')+'>'+(CHANNEL_ICONS[c]||'')+'  '+c+'</option>';}).join('') +
        '</select>' +
        '<select onchange="_userHabits['+i+'].start_time=this.value;_userHabits['+i+'].time_of_day=_timeOfDayFromStart(this.value)" style="flex:1;padding:5px;background:var(--bg);border:1px solid var(--border);border-radius:2px;color:var(--text);font-size:12px;outline:none">' +
          HABIT_TIME_SLOTS.map(function(t){return '<option value="'+t+'"'+(h.start_time===t?' selected':'')+'>'+t+'</option>';}).join('') +
        '</select>' +
        '<input type="number" value="'+h.duration_mins+'" min="5" max="240" onchange="_userHabits['+i+'].duration_mins=parseInt(this.value)" style="width:56px;padding:5px;background:var(--bg);border:1px solid var(--border);border-radius:2px;color:var(--text);font-size:12px;outline:none" placeholder="mins"/>' +
      '</div>' +
    '</div>';
  }).join('');

  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:500px;padding:20px;max-height:90vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
      '<div style="font-size:14px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Sales Habits</div>' +
      '<button onclick="document.getElementById(\'habit-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--text3);margin-bottom:14px">Habits auto-generate tasks in SamoraTrack on the days you choose. Set it once, forget it.</div>' +
    _renderHabitSuggestions() +
    '<div id="habit-rows">'+habitRows+'</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px">' +
      '<button onclick="addHabit()" style="flex:1;padding:9px;border:1px dashed var(--border2);border-radius:2px;background:none;color:var(--text3);font-size:13px;cursor:pointer">+ Add habit</button>' +
      '<button onclick="detectCalendarHabits()" id="detectHabitsBtn" style="flex:1;padding:9px;border:1px dashed var(--gold);border-radius:2px;background:none;color:var(--gold);font-size:13px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> Detect from calendar</button>' +
    '</div>' +
    '<button onclick="saveHabits()" style="width:100%;padding:12px;border:none;border-radius:3px;background:var(--gold);color:var(--c-canvas);font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans)">Save habits</button>' +
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
    h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(var(--c-accent-rgb),0.07);border:1px solid rgba(var(--c-accent-rgb),0.2);border-radius:2px;margin-bottom:5px">';
    h += '<span style="font-size:13px">'+(CHANNEL_ICONS[s.channel]||'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg>')+'</span>';
    h += '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(s.title)+'</div>';
    h += '<div style="font-size:11px;color:var(--text3)">'+dayLbl+' · '+esc(s.start_time||'')+' · '+s.duration_mins+'m · seen '+s.occurrences+'×'+(s.is_recurring_series?' · recurring series':'')+'</div></div>';
    h += '<button onclick="addSuggestedHabit('+i+')" style="padding:4px 10px;border-radius:2px;background:var(--gold);border:none;color:var(--c-canvas);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--sans);flex-shrink:0">+ Add</button>';
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
 showToast('Recurring event created — first on ' + (d.first_occurrence||'next matching day'));
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

    var html = '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:12px 14px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5.2l3.2 2"/></svg> How you spent your time · last 30 days</div>' +
      '<div style="display:flex;gap:12px;margin-bottom:12px">' +
        '<div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--text)">'+d.customer_hours+'h</div><div style="font-size:11px;color:var(--text3)">Customer</div></div>' +
        '<div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--text3)">'+d.internal_hours+'h</div><div style="font-size:11px;color:var(--text3)">Internal</div></div>' +
        '<div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--text3)">'+d.unclassified_hours+'h</div><div style="font-size:11px;color:var(--text3)">Other</div></div>' +
      '</div>';

    // Mismatches — the most useful part
    if (d.mismatches.over_invested.length || d.mismatches.under_invested.length) {
      html += '<div style="padding:8px 10px;border-radius:2px;margin-bottom:10px;background:rgba(var(--c-accent-rgb),0.08)">';
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
        '<div style="height:5px;background:var(--surface);border-radius:2px;overflow:hidden">' +
          '<div style="height:100%;width:'+pct+'%;background:'+(a.mismatch==='over_invested'?'var(--amber)':a.mismatch==='under_invested'?'var(--green)':'var(--gold)')+';border-radius:2px"></div>' +
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
    if (out) out.innerHTML = '<div style="background:var(--surface2);border-radius:2px;padding:10px 12px;margin-top:6px">' +
      '<div style="font-size:11px;font-weight:600;color:var(--gold);margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Email scan complete · '+d.processed+'/'+d.scanned+' notes extracted</div>' +
      '<div style="font-size:11px;color:var(--text3)">Works with Fireflies, Fathom, Otter, Grain, tl;dv, Gong — any tool that emails you. Zero extra config needed.</div>' +
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
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface2);border-radius:2px;margin-bottom:6px">' +
      '<div><span style="font-size:14px">'+(provIcons[c.provider]||'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5v5M15 3.5v5M6.5 8.5h11v3a5.5 5.5 0 01-11 0zM12 17v4"/></svg>')+'</span> <strong style="font-size:13px">'+esc(c.provider)+'</strong>'+(c.provider_email?' <span style="font-size:11px;color:var(--text3)">'+esc(c.provider_email)+'</span>':'')+'</div>' +
      '<button onclick="disconnectNotetaker(\''+esc(c.provider)+'\')" style="background:none;border:1px solid var(--border);border-radius:2px;padding:4px 10px;font-size:11px;color:var(--coral);cursor:pointer;font-family:var(--sans)">Disconnect</button>' +
    '</div>';
  }).join('');

  var providers = [
    { id:'fireflies', name:'Fireflies.ai', icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg>', help:'Settings → Integrations → API → Generate key', available:true },
    { id:'read_ai',   name:'Read.ai',      icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z"/></svg>', help:'app.read.ai → Settings → API → Get access token', available:true },
    { id:'fathom',    name:'Fathom',       icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>', help:'Coming soon — use email scanning for now', available:false },
    { id:'otter',     name:'Otter.ai',     icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>', help:'Coming soon — use email scanning for now', available:false },
    { id:'grain',     name:'Grain',        icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>', help:'Coming soon — use email scanning for now', available:false },
  ].filter(function(p) { return !existingConns.some(function(c){return c.provider===p.id;}); });

  var modal = document.createElement('div');
  modal.id = 'notetaker-connect-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:500px;padding:20px;max-height:80vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
      '<div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5v5M15 3.5v5M6.5 8.5h11v3a5.5 5.5 0 01-11 0zM12 17v4"/></svg> Connect your notetaker</div>' +
        '<div style="font-size:12px;color:var(--text3);margin-top:2px">Your personal connection — independent of your org. Direct API gives full transcripts + richer signals.</div>' +
      '</div>' +
      '<button onclick="document.getElementById(\'notetaker-connect-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +

    // Email scan note — always available
    '<div style="background:rgba(74,140,92,0.08);border:1px solid rgba(74,140,92,0.2);border-radius:2px;padding:10px 12px;margin-bottom:14px">' +
      '<div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:3px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Email scanning always works — zero config</div>' +
      '<div style="font-size:11px;color:var(--text3)">Fireflies, Fathom, Otter, Grain, tl;dv, Gong, Avoma — if it emails you a meeting summary, Samora parses it automatically. Use "Scan call emails" in SAM Intelligence. Direct API connection gives full transcripts with higher signal quality.</div>' +
    '</div>' +

    (existingConns.length ? '<div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:8px">CONNECTED</div>' + connList : '') +

    (providers.length ? '<div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:10px">ADD CONNECTION</div>' +
    providers.map(function(p) {
      var available = p.available;
      return '<div style="padding:12px;background:var(--surface2);border-radius:3px;margin-bottom:8px">' +
        '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">'+p.icon+' '+p.name+(available?'':' <span style="font-size:11px;color:var(--text3)">(coming)</span>')+'</div>' +
        (available ? '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">'+p.help+'</div>' +
        '<div style="display:flex;gap:8px">' +
          '<input id="nt-key-'+p.id+'" type="password" placeholder="API key / access token" style="flex:1;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:2px;color:var(--text);font-size:13px;font-family:var(--sans);outline:none"/>' +
          '<input id="nt-email-'+p.id+'" type="email" placeholder="Your email at '+p.name+'" style="flex:1;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:2px;color:var(--text);font-size:13px;font-family:var(--sans);outline:none"/>' +
        '</div>' +
        '<button onclick="connectNotetaker(\''+p.id+'\')" style="width:100%;margin-top:8px;padding:9px;border:none;border-radius:2px;background:var(--gold);color:var(--c-canvas);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--sans)">Connect '+p.name+'</button>'
        : '<div style="font-size:11px;color:var(--text3)">'+p.help+'</div>') +
      '</div>';
    }).join('') : '') +
  '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);
}

async function connectNotetaker(provider) {
  var apiKey = document.getElementById('nt-key-'+provider)?.value?.trim();
  var email  = document.getElementById('nt-email-'+provider)?.value?.trim();
  if (!apiKey) { alert('Please enter your API key'); return; }
  try {
    await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'save_user_connection', provider, api_key:apiKey, provider_email:email||null}) });
    document.getElementById('notetaker-connect-modal')?.remove();
 showToast(''+provider+' connected — click "Sync calls" to pull transcripts');
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
  if (out) out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">Connecting to notetaker and analysing transcripts with Gemini…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'sync_notetaker'}) });
    var d = await r.json();
    if (!d.ok) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> '+esc(d.error||'Sync failed')+'</div>'; return; }
    var html = '<div style="background:var(--surface2);border-radius:2px;padding:10px 12px;margin-top:6px">' +
      '<div style="font-size:11px;font-weight:600;color:var(--gold);margin-bottom:6px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a2.8 2.8 0 00-2.8 2.8v5.4a2.8 2.8 0 005.6 0V6.3A2.8 2.8 0 0012 3.5zM5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/></svg> '+esc(d.provider)+' synced · '+d.transcripts_analysed+'/'+d.transcripts_found+' transcripts analysed via Gemini</div>' +
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
    if (out) out.innerHTML = '<div style="background:var(--surface2);border-radius:2px;padding:10px 12px">' +
      '<div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 21V3.5M5.5 4.5h12l-2.5 4 2.5 4h-12"/></svg> Channel tags fixed</div>' +
      '<div style="font-size:11px;color:var(--text3)">Scanned '+d.total+' signals · retagged '+d.retagged+' as call/LinkedIn/WhatsApp based on campaign names</div>' +
      (d.retagged > 0 ? '<div style="font-size:11px;color:var(--text3);margin-top:4px">Run Coverage again to see updated verification</div>' : '<div style="font-size:11px;color:var(--text3);margin-top:4px">All signals already correctly tagged. If calls still show unverified — campaign name doesn\'t contain call keywords. Rename the campaign in SmartReach to include "Call" or "Phone".</div>') +
    '</div>';
  } catch(e) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: '+esc(e.message)+'</div>'; }
 if (btn) { btn.textContent = 'Fix channel tags'; btn.disabled = false; }
}

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

    var html = '<div style="background:var(--surface2);border-radius:2px;padding:10px 12px;margin-top:6px">' +
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
      out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">No buying signals found across ' + data.accountsScanned + ' accounts. Try again later — signals refresh as news breaks.</div>';
      if (btn) { btn.textContent = '\ud83c\udf10 Market signals'; btn.disabled = false; }
      return;
    }

    var html = '<div style="font-size:11px;font-weight:600;color:var(--blue);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">\ud83c\udf10 Market Signals \u2014 ' + totalSignals + ' found across ' + data.accountsScanned + ' accounts</div>';

    results.forEach(function(r) {
      if (!r.signalsDetected) return;
      html += '<div style="font-size:11px;font-weight:600;color:var(--text);margin-top:8px;margin-bottom:4px">' + esc(r.account) + (r.region ? ' <span style="font-size:11px;color:var(--text3);background:rgba(0,0,0,0.08);border-radius:2px;padding:1px 5px">' + esc(r.region) + '</span>' : '') + ' <span style="font-size:11px;color:var(--text3);font-weight:400">\u2014 ' + r.signalsDetected + ' signals</span></div>';
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
      status.innerHTML = '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> ' + d.tasksCreated.length + ' OOO follow-up task' + (d.tasksCreated.length!==1?'s':'') + ' created — <strong>' + dateList + '</strong>';
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
  } catch (e) {}
  return toks;
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

        // Match the task to a verified calendar event by title-word overlap
        var calEv = verifiedMeetings.find(function(m) {
          var mt = ((m.title||'') + ' ' + (m.external_attendees||[]).join(' ')).toLowerCase();
          return words.some(function(w){ return mt.includes(w); });
        });
        // Negative evidence: cancelled or rescheduled → never auto-complete
        if (calEv && (calEv.cancelled || calEv.rescheduled)) {
          task.meetingFlag = calEv.cancelled ? 'cancelled' : 'rescheduled';
          return;
        }

        // Evidence 1 (strongest): notetaker transcript exists — but only one
        // recorded TODAY, sharing a DISTINCTIVE token, naming the right person,
        // in the right region.
        var ev = hasIdentity && transcripts.find(function(t) {
          var tt = ((t.title||'') + ' ' + (t.participants||[]).join(' ')).toLowerCase();
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
          var nt = ((n.title||'') + ' ' + (n.participants||[]).join(' ')).toLowerCase();
          if (!distinct.some(function(w){ return nt.includes(w); })) return false;
          if (!_isToday(_evDate(n))) return false;        // recap must be dated today
          return _matchGatesOk(task.text, nt);
        });
        if (note) {
          task.done = true; task.autoCompleted = true; task.verifiedVia = 'notetaker_email';
          task.verifiedSource = note.provider || 'notetaker'; count++;
          autoLog.push('<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a2.8 2.8 0 00-2.8 2.8v5.4a2.8 2.8 0 005.6 0V6.3A2.8 2.8 0 0012 3.5zM5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/></svg> ' + esc(task.text.slice(0,50)) + ' → meeting notes "' + esc((note.title||'').slice(0,40)) + '"');
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
 showToast('Auto-completed ' + count + ' task' + (count!==1?'s':'') + (autoLog.length ? ' — ' + autoLog[0].replace(/<[^>]+>/g,'').slice(0,40) : ''));
    } else if (!silent) {
      showToast('No new evidence found for open tasks');
    }
  } finally {
 if (btn) { btn.textContent = 'Auto-complete'; btn.disabled = false; }
    _autoCompleteBusy = false;
  }
}

// Hourly silent auto-complete while the app is open (+ one pass 2 min after load)
setInterval(function(){ try { if (typeof currentUser !== 'undefined' && currentUser && currentUser.token) autoCompleteTasks(true); } catch(e) {} }, 3600000);
setTimeout(function(){ try { if (typeof currentUser !== 'undefined' && currentUser && currentUser.token) autoCompleteTasks(true); } catch(e) {} }, 120000);

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
      html += '<div style="flex:1;min-width:90px;background:rgba(0,0,0,0.06);border-radius:2px;padding:8px;text-align:center">' +
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
          const stalenessBadge = a.staleness === 'cold' ? '<span style="font-size:11px;font-weight:700;color:var(--coral);background:rgba(192,82,63,0.12);border-radius:2px;padding:1px 6px;margin-left:6px">\u2744 COLD</span>'
            : a.staleness === 'stale' ? '<span style="font-size:11px;font-weight:700;color:var(--amber);background:rgba(var(--c-accent-rgb),0.12);border-radius:2px;padding:1px 6px;margin-left:6px">STALE</span>' : '';
          const regionBadge = a.region ? '<span style="font-size:11px;color:var(--text3);background:rgba(0,0,0,0.06);border-radius:2px;padding:1px 6px;margin-left:5px">' + esc(a.region) + '</span>' : '';
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
    if (data.scopeError) { out.innerHTML = picker + '<div style="font-size:12px;color:var(--coral);padding:8px 0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 10.5V7.5a5.5 5.5 0 0111 0v3M5 10.5h14v10H5z"/></svg> ' + esc(data.error || 'Gmail permissions need to be re-granted — reconnect Gmail.') + '</div>'; if (btn){btn.textContent='Check today';btn.disabled=false;} return; }
    if (data.reconnectNeeded) { out.innerHTML = picker + '<div style="font-size:12px;color:var(--coral);padding:8px 0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> ' + esc(data.error || 'Gmail connection expired — reconnect Gmail.') + '</div>'; if (btn){btn.textContent='Check today';btn.disabled=false;} return; }
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
    html += '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--text2)">'+s.coveredAccounts+'/'+s.totalAccounts+' accounts reached · '+s.totalLogged+' logged · '+s.totalVerified+' verified</span><span style="color:'+barColor+';font-weight:600">'+pct+'%</span></div><div style="height:5px;background:var(--surface2);border-radius:2px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+barColor+';border-radius:2px;transition:width 0.4s"></div></div></div>';

    if (data.hasSeqData) {
      html += '<div style="font-size:11px;color:var(--green);background:rgba(74,140,92,0.08);border:1px solid rgba(74,140,92,0.2);border-radius:2px;padding:5px 10px;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> SmartReach signals loaded — calls, LinkedIn and WhatsApp verified where data exists</div>';
    }

    html += '<div style="margin-bottom:12px;border:1px solid var(--border);border-radius:2px;overflow:hidden">';
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
          h += '<br><span style="font-size:11px;color:var(--text3)" title="Seq shows '+b.seqVerified+' total — excluded from today count (no per-event timestamp)">SR: '+b.seqVerified+' lifetime</span>';
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
        signal='<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg>'; sigColor='var(--green)'; sigTitle='Prospect responded — pursue now';
      } else if (emailOpens > 0 && totalVerifiedTouches > 0) {
        signal='<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z"/></svg>'; sigColor='var(--amber)'; sigTitle='Opening but not replying — try a different hook or switch channel';
      } else if (totalVerifiedTouches > 0 && channels >= 2) {
        signal='<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>'; sigColor='var(--blue)'; sigTitle='Multichannel — good coverage, keep at it';
      } else if (totalVerifiedTouches > 0) {
        signal='<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s6 6.4 6 10.2a6 6 0 11-12 0C6 9.9 12 3.5 12 3.5z"/></svg>'; sigColor='var(--text3)'; sigTitle='Verified outreach, no engagement signal yet';
      } else if (totalLoggedTouches > 0) {
        signal='<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg>'; sigColor='var(--text3)'; sigTitle='Rep logged activity but no tool verification';
      } else {
        signal='○'; sigColor='var(--text3)'; sigTitle='No outreach logged';
      }

      // Per-account action hint
      var accountHint = '';
      if (signal === '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 01-11 0c0-2 1-3.4 1-3.4s.6 1.6 1.8 1.6c1.6 0 1.4-3.4 2.7-7.2z"/></svg>')  accountHint = 'Hot — follow up today';
      else if (signal === '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z"/></svg>') accountHint = 'Opening — change your hook or call';
      else if (signal === '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>') accountHint = 'Multichannel — stay consistent';
      else if (signal === '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5s6 6.4 6 10.2a6 6 0 11-12 0C6 9.9 12 3.5 12 3.5z"/></svg>') accountHint = 'No engagement — try a different channel';
      else if (signal === '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg>') accountHint = 'Unverified — sync SmartReach for accuracy';

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

    html += '<div id="cov-coaching-'+outputId+'" style="background:var(--surface);border:1px solid var(--border2);border-radius:2px;padding:12px 14px">';
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
    '2. WHAT TO FIX NOW (max 3 bullets — specific, actionable, account-level)\n' +
    '3. THIS WEEK\'S PRIORITY (1 sentence — the single most important action)\n' +
    '4. FORECAST (2 sentences — given current activity, what outcome should the rep realistically expect? Be honest but constructive. Address "will my inputs lead to results?")\n\n' +
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

    var rendered = '<div style="font-size:11px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Coaching — '+esc(repEmail?repEmail.split('@')[0]:'you')+'</div>';

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
function toggleYouAcc(key) {
  var el = document.getElementById('youAcc-' + key);
  if (el) el.classList.toggle('open');
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
  var inputStyle = 'width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:2px;padding:5px 7px;color:var(--text);font-family:var(--sans);font-size:11px;outline:none';
  var h = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;max-width:680px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden">';
  h += '<div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">';
  h += '<img src="icons/icon-48.png" style="width:16px;height:16px;border-radius:50%"/>';
  h += '<span style="font-size:13px;font-weight:600;color:var(--text);flex:1">Import ' + _acctImportRows.length + ' accounts — review & edit</span>';
  h += '<button onclick="document.getElementById(\'acct-import-modal\').remove()" style="background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  h += '<div style="padding:10px 16px;font-size:11px;color:var(--text3)">Fill in anything the CRM export missed — domain powers email matching, region powers pipeline breakdowns.' + (isAdmin ? ' Rows with an owner email are assigned to that user; blank = you.' : ' All accounts will be assigned to you.') + '</div>';
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
  h += '<button onclick="document.getElementById(\'acct-import-modal\').remove()" style="padding:8px 14px;border-radius:2px;background:var(--surface2);border:1px solid var(--border2);color:var(--text2);font-family:var(--sans);font-size:12px;cursor:pointer">Cancel</button>';
  h += '<button id="acctImportGo" onclick="submitAccountsImport()" style="padding:8px 18px;border-radius:2px;background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:12px;font-weight:700;cursor:pointer">Import accounts</button>';
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
    if (d.unmapped_owner_emails && d.unmapped_owner_emails.length) msg += ' · ' + d.unmapped_owner_emails.length + ' owner email(s) not found — assigned to you';
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
  if (!currentUser?.token) { tl.innerHTML = '<div class="empty"><div class="empty-icon"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 10.5V7.5a5.5 5.5 0 0111 0v3M5 10.5h14v10H5z"/></svg></div>Session expired — please sign out and sign back in.</div>'; return; }
  try {
    let q;
    const seeAll = ['super_admin','admin','director','executive'].includes(profile?.role);
    if (seeAll) q = 'user_profiles?org_id=eq.' + profile.org_id + '&select=user_id,email,role,manager_id';
    else q = 'user_profiles?org_id=eq.' + profile.org_id + '&manager_id=eq.' + currentUser.id + '&select=user_id,email,role,manager_id';
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
    const note = noteText ? '<div style="font-size:11px;color:var(--text2);background:var(--surface2);border-radius:2px;padding:3px 8px;margin-top:4px;font-style:italic"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg> '+esc(noteText)+'</div>' : '';
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
      html += '<div style="border:1px solid var(--border);border-radius:2px;overflow:hidden;margin-bottom:12px">';
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
      html += '<div style="border:1px solid var(--border);border-radius:2px;overflow:hidden">';
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
    if (data.success) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--green);padding:8px 0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Digest sent to ' + data.sent + ' people for ' + data.weekLabel + '</div>'; if (btn) { btn.textContent = 'Sent'; setTimeout(() => { btn.textContent = 'Send now'; btn.disabled = false; }, 3000); } }
    else { throw new Error(data.error || 'Failed to send'); }
  } catch(e) { if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral);padding:8px 0">Error: ' + esc(e.message) + '</div>'; if (btn) { btn.textContent = 'Send now'; btn.disabled = false; } }
}
function showNudgeBanner(tasks) {
  const banner = document.getElementById('nudgeBanner'); const text = document.getElementById('nudgeText');
  if (!banner || !text) return;
  const hour = new Date().getHours(); const pending = (tasks||[]).filter(function(t){return !t.done;}).length;
  if (pending === 0 || hour < 9) { banner.style.display = 'none'; return; }
  let msg = '';
  if (hour >= 11 && hour < 13) msg = '⏰ Almost noon — ' + pending + ' task' + (pending>1?'s':'') + ' still open. Finish before 12 for max rhythm score.';
  else if (hour >= 16 && hour < 18) msg = '⏰ Last push — ' + pending + ' task' + (pending>1?'s':'') + ' to go. Complete before 6pm to stay on track.';
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
    const members = await sbGet('user_profiles?org_id=eq.' + profile.org_id + '&select=user_id,email,role');
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
    repData.slice().sort(function(a,b){return b.score-a.score;}).forEach(function(r){const bc=scoreColor(r.score);const w=r.tasks>0?r.score:0;html+='<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:12px;color:var(--text2)">'+esc(r.email.split('@')[0])+'</span><span style="font-size:12px;font-weight:600;color:'+bc+'">'+( r.tasks>0?r.score:'—')+'</span></div><div style="height:4px;background:var(--surface2);border-radius:2px;overflow:hidden"><div style="height:100%;width:'+w+'%;background:'+bc+';border-radius:2px;transition:width 0.5s"></div></div></div>';});
    html+='</div>';
    if (atRisk.length||noActivity.length||totalIssues>0) {
      html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-bottom:12px"><div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Priorities & Risks</div>';
      if (atRisk.length) { html+='<div style="border-left:3px solid var(--coral);padding:8px 12px;background:var(--coral-lt);border-radius:0 6px 6px 0;margin-bottom:8px"><div style="font-size:12px;font-weight:500;color:var(--coral);margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> Low score ('+atRisk.length+')</div>'+atRisk.map(function(r){return '<div style="font-size:12px;color:var(--text2)">'+esc(r.email.split('@')[0])+' — score '+r.score+' · '+r.pending+' tasks pending</div>';}).join('')+'</div>'; }
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
        html += '<div style="padding:10px 12px;background:var(--bg);border-radius:2px;margin-bottom:6px;border-left:3px solid var(--green)">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +
            '<div style="flex:1">' +
              '<div style="font-size:13px;color:var(--text);font-weight:500">'+esc(displayText)+'</div>' +
              (note ? '<div style="font-size:12px;color:var(--text2);margin-top:4px;font-style:italic;background:var(--surface2);border-radius:2px;padding:4px 8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg> '+esc(note)+'</div>' : '') +
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
      '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> Org — relevant meetings booked</div>' +
      '<div id="meetingsKpiOrg">Loading…</div>' +
    '</div>';

    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-top:12px">' +
      '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Live feed — org-wide</div>' +
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
  if (!entries.length) return '<div style="font-size:12px;color:var(--text3);padding:8px 0">Nothing yet — wins and milestones will show up here as they happen.</div>';
  return entries.map(function(f) {
    var icon = FEED_EVENT_ICON[f.event_type] || '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg>';
    var reactionChips = FEED_EMOJIS.map(function(e) {
      var count = (f.reactions && f.reactions[e]) || 0;
      var mine = f.my_reaction === e;
      return '<button onclick="reactToFeed(\'' + f.id + '\',\'' + e + '\')" style="border:1px solid ' + (mine ? 'var(--gold)' : 'var(--border)') + ';background:' + (mine ? 'rgba(184,134,11,0.12)' : 'var(--surface2)') + ';border-radius:3px;padding:2px 8px;font-size:11px;cursor:pointer;margin-right:4px">' + e + (count ? ' ' + count : '') + '</button>';
    }).join('');
    return '<div style="padding:10px 12px;background:var(--bg);border-radius:2px;margin-bottom:8px;border-left:3px solid var(--gold)">' +
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
  var el = document.getElementById(targetElId); if (!el || !currentUser?.token) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'list_team_feed', limit: limit || 30 }) });
    var d = await r.json();
    window._teamFeedTarget = targetElId;
    el.innerHTML = (d.ok && d.feed) ? _renderFeedEntries(d.feed) : '<div style="font-size:12px;color:var(--coral)">Could not load feed.</div>';
  } catch(e) { el.innerHTML = '<div style="font-size:12px;color:var(--coral)">Could not load feed.</div>'; }
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
      '<span>' + esc(m.account_name) + ' — ' + esc(m.title||'').slice(0,40) + '</span><span>' + esc(m.date) + '</span></div>';
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
      return '<button onclick="loadMeetingsKpiSelf(' + p + ')" style="padding:3px 10px;border-radius:3px;border:1px solid ' + (active?'var(--gold)':'var(--border)') + ';background:' + (active?'rgba(184,134,11,0.12)':'var(--surface2)') + ';color:var(--text2);font-size:11px;cursor:pointer;margin-left:4px">' + p + 'd</button>';
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
      return '<button onclick="loadMeetingsKpiTeam(' + p + ')" style="padding:3px 10px;border-radius:3px;border:1px solid ' + (active?'var(--gold)':'var(--border)') + ';background:' + (active?'rgba(184,134,11,0.12)':'var(--surface2)') + ';color:var(--text2);font-size:11px;cursor:pointer;margin-left:4px">' + p + 'd</button>';
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
        '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> Team — relevant meetings booked</div>' +
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
async function renderOrg() {
  document.getElementById('orgCodeDisplay').textContent = profile?.org_code || '—';
  const isSuperAdmin = ['super_admin','admin'].includes(profile?.role);
  const peopleCard = document.getElementById('peopleCard'); const assignSection = document.getElementById('assignSection');
  if (peopleCard) peopleCard.style.display = isSuperAdmin ? '' : 'none';
  if (assignSection) assignSection.style.display = isSuperAdmin ? '' : 'none';
  if (!SB_URL || !isSuperAdmin) return;
  try {
    orgPeople = await sbGet(`user_profiles?org_id=eq.${profile.org_id}&select=user_id,email,role,manager_id`);
    renderPeopleTable(); renderAssignCard();
    const accountRepSel = document.getElementById('accountRepSelect');
    if (accountRepSel) accountRepSel.innerHTML = '<option value="">Select a rep…</option>' + orgPeople.map(p => '<option value="' + p.user_id + '">' + esc(p.email) + '</option>').join('');
  } catch(e) { document.getElementById('peopleList').innerHTML = `<div class="empty">Error: ${e.message}</div>`; }
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
async function updateRole(userId, newRole) { if (!SB_URL) return; try { await sbPatch(`user_profiles?user_id=eq.${userId}`, { role: newRole }); await renderOrg(); } catch(e) { alert('Error updating role: ' + e.message); } }
async function assignToManager(managerId, memberId) { if (!memberId || !SB_URL) return; try { await sbPatch(`user_profiles?user_id=eq.${memberId}`, { manager_id: managerId }); await renderOrg(); } catch(e) { alert('Error assigning member: ' + e.message); } }

async function loadRepAccounts() {
  const repId = document.getElementById('accountRepSelect')?.value; const list = document.getElementById('repAccountsList'); const addRow = document.getElementById('addAccountRow');
  if (!repId) { if (list) list.innerHTML = ''; if (addRow) addRow.style.display = 'none'; return; }
  if (addRow) addRow.style.display = 'flex';
  if (list) list.innerHTML = '<div style="font-size:12px;color:var(--text3)">Loading…</div>';
  try {
    const rows = await sbGet('org_accounts?user_id=eq.' + repId + '&org_id=eq.' + profile.org_id + '&select=id,account_name,domain&order=account_name');
    if (!rows || !rows.length) { list.innerHTML = '<div style="font-size:12px;color:var(--text3);font-style:italic">No accounts assigned yet</div>'; return; }
    list.innerHTML = rows.map(r => '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--surface2);border-radius:2px;margin-bottom:5px"><div><div style="font-size:13px;color:var(--text)">' + esc(r.account_name) + '</div>' + (r.domain?'<div style="font-size:11px;color:var(--text3)">'+esc(r.domain)+'</div>':'') + '</div><button onclick="removeRepAccount(\''+r.id+'\')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>').join('');
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
        '"' + parent.account_name + '" already exists' + (branchList ? ' — existing branches: ' + branchList : '') + '. Add as branch?';
      document.getElementById('parentMatchActions').innerHTML =
        '<button onclick="setParentMatch(\'' + parent.id + '\',\'' + parent.account_name.replace(/'/g,"\\'") + '\')" style="padding:3px 10px;border-radius:3px;background:var(--gold2);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer;margin-right:6px">Yes, add as branch</button>' +
        '<button onclick="clearParentMatch()" style="padding:3px 10px;border-radius:3px;background:transparent;border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:11px;cursor:pointer">No, standalone</button>';
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
 document.getElementById('apiBadge').textContent = API_KEY ? 'set' : 'not set';
  document.getElementById('apiBadge').className = API_KEY ? 'badge-ok' : 'badge-no';
 document.getElementById('supaBadge').textContent = (SB_URL && SB_KEY) ? 'connected' : 'not set';
  document.getElementById('supaBadge').className = (SB_URL && SB_KEY) ? 'badge-ok' : 'badge-no';
  if (API_KEY) document.getElementById('apiInput').placeholder = '••••• (saved — paste to update)';
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
  const fallback = `<strong>${reviewPeriod.charAt(0).toUpperCase()+reviewPeriod.slice(1)} summary — ${periodLabel}</strong><br><br><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> ${pd.totalTasks} tasks, ${pd.doneTasks} done (${pct}%)<br><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> ${pd.totalIssues} issues<br><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.8l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 10l5.9-.8z"/></svg> ${pd.totalWins} wins<br>○ ${pd.totalMisses} misses`;
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
  return '<svg viewBox="0 0 84 116" style="width:100%;max-width:84px;height:auto;display:block;margin:0 auto;border-radius:2px">' +
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
    return 'flex:1;cursor:pointer;border-radius:3px;padding:10px;text-align:center;' +
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
      return '<div onclick="setAppearanceScale('+s.value+')" style="flex:1;cursor:pointer;text-align:center;padding:14px 6px;border-radius:3px;' +
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
function getTemplates() { const k = tmplKey(); if (!k) return []; try { return JSON.parse(localStorage.getItem(k)||'[]'); } catch { return []; } }
function saveTemplates(list) { const k = tmplKey(); if (!k) return; localStorage.setItem(k, JSON.stringify(list)); }
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
      '<div style="width:40px;height:4px;background:var(--border2);border-radius:2px;margin:12px auto 16px"></div>' +
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
          '<div><div style="font-weight:600">Copy to clipboard</div><div style="font-size:12px;color:var(--text3);font-weight:400">Paste anywhere — Slack, Teams, SMS</div></div>' +
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
  const templates = getTemplates(); const list = document.getElementById('tmplList'); const count = document.getElementById('tmplCount');
  count.textContent = templates.length ? `(${templates.length})` : '';
  if (!templates.length) { list.innerHTML = '<div style="font-size:13px;color:var(--text3);font-style:italic;padding:8px 0">No template tasks yet. Add some above.</div>'; return; }
  list.innerHTML = templates.map((t, i) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:2px;margin-bottom:6px"><input type="checkbox" id="tmpl-chk-${i}" checked style="accent-color:var(--gold);width:16px;height:16px;flex-shrink:0"><input type="text" value="${esc(t)}" id="tmpl-txt-${i}" style="flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:var(--font);font-size:13px" onchange="updateTemplateTask(${i}, this.value)"/><button onclick="deleteTemplateTask(${i})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`).join('');
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
  quickDays.innerHTML=[{label:'Tomorrow · '+lbl(tomorrow),val:fmt(tomorrow)},{label:lbl(dayAfter),val:fmt(dayAfter)},{label:'Next Mon · '+lbl(nextMon),val:fmt(nextMon)}].map(opt=>'<button onclick="selectCarryDate(\''+opt.val+'\')" id="cfq-'+opt.val+'" style="padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;color:var(--text2);font-family:var(--font);font-size:12px;cursor:pointer;white-space:nowrap">'+opt.label+'</button>').join('');
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
    t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--surface);border:1px solid var(--gold);padding:10px 18px;border-radius:3px;font-size:13px;color:var(--text);z-index:100001;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;white-space:nowrap;font-family:var(--sans);box-shadow:var(--shadow-2)';
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
  if (!rows.length) return '<div style="font-size:12px;color:var(--text3);padding:16px 0">No revenue stream data — save deals with stream breakdowns to see this view.</div>';
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
  var fmtUsd = function(v) { return !v ? '—' : v>=1e6 ? '$'+(v/1e6).toFixed(1)+'M' : '$'+Math.round(v/1e3)+'K'; };
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
    body.innerHTML = '<div style="padding:20px 0;text-align:center;font-size:12px;color:var(--text3)">Couldn\'t load the weekly check.<br><button onclick="_renderWeeklyCheckPane(_currentDealDetail.deal, true)" style="margin-top:8px;font-size:11px;padding:5px 12px;border-radius:2px;background:var(--surface2);border:1px solid var(--border2);color:var(--gold);cursor:pointer;font-family:var(--sans)">↻ Try again</button></div>';
    return;
  }
  var h = d.header || {};
  var verdictCfg = {
    on_track:        { label: 'On track',        color: 'var(--green)', bg: 'rgba(74,140,92,0.12)',  icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>' },
    needs_attention: { label: 'Needs attention', color: 'var(--amber)', bg: 'rgba(var(--c-accent-rgb),0.14)', icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg>' },
    at_risk:         { label: 'At risk',          color: 'var(--coral)', bg: 'rgba(200,80,70,0.12)',  icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' }
  }[d.verdict] || { label: 'Reviewed', color: 'var(--text2)', bg: 'var(--surface2)', icon: '•' };
  var fmtUsd = function(v){ return !v ? '—' : v>=1e6 ? '$'+(v/1e6).toFixed(1)+'M' : '$'+Math.round(v/1e3)+'K'; };

  var html = '<div style="margin-bottom:10px">' + _samoraIntelLabel('Weekly account check · every line shows its receipt') + '</div>';

  // Verdict + vitals
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
    '<span style="font-size:12px;font-weight:700;color:'+verdictCfg.color+';background:'+verdictCfg.bg+';border-radius:2px;padding:4px 10px">'+verdictCfg.icon+' '+verdictCfg.label+'</span>' +
    (d.cached ? '<span style="font-size:11px;color:var(--text3);background:var(--surface2);border-radius:2px;padding:2px 6px">cached</span>' : '') +
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
    return '<div style="flex:1;min-width:72px;background:var(--surface2);border-radius:2px;padding:7px 8px;text-align:center"><div style="font-size:13px;font-weight:600;color:var(--text)">'+esc(v[1])+'</div><div style="font-size:11px;color:var(--text3)">'+esc(v[0])+'</div></div>';
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
      return '<div style="display:flex;gap:8px;align-items:flex-start;background:rgba(var(--c-accent-rgb),0.06);border:1px solid rgba(var(--c-accent-rgb),0.2);border-radius:2px;padding:8px 10px;margin-bottom:6px">' +
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
  var panel = document.getElementById('coachingAlertsPanel'); if (!panel) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_coaching_alerts', role: profile?.role||'member'}) });
    var d = await r.json();
    var alerts = d.alerts || [];
    if (!alerts.length) {
      panel.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:11px;color:var(--text3)">No active alerts</span><button onclick="runCoachingAlerts()" style="font-size:11px;padding:2px 8px;border-radius:2px;background:var(--surface2);border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);cursor:pointer">↻ Check now</button></div>';
      return;
    }
    var sevColor = {high:'var(--coral)', medium:'var(--amber)', low:'var(--blue)'};
    var typeIcon  = {dark_account:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5.2l3.2 2"/></svg>', no_champion:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11.5a4 4 0 100-8 4 4 0 000 8zM4.5 20.5v-1A5.5 5.5 0 0110 14h4a5.5 5.5 0 015.5 5.5v1"/></svg>', meddpicc_gap:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg>', close_at_risk:'⏰', velocity_stall:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/></svg>'};
    // Collapsed by default to a single summary line: the tasks list owns this
    // screen. High-severity count keeps urgency visible without the space.
    var highCount = alerts.filter(function(a){ return a.severity === 'high'; }).length;
    var bodyOpen = !!window._alertsPanelOpen;
    var html = '<div style="margin-bottom:6px">';
    html += '<div onclick="window._alertsPanelOpen=!window._alertsPanelOpen;loadCoachingAlerts()" style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:var(--surface2);border-radius:2px;cursor:pointer;user-select:none;margin-bottom:' + (bodyOpen ? '5px' : '0') + '">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> ' + alerts.length + ' alert' + (alerts.length!==1?'s':'') + (highCount ? ' · <span style="color:var(--coral)">' + highCount + ' high</span>' : '') + '</div>';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<button onclick="event.stopPropagation();runCoachingAlerts()" style="font-size:11px;padding:1px 7px;border-radius:2px;background:var(--surface);border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);cursor:pointer">↻</button>';
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
    panel.innerHTML = html;
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
      body.innerHTML = '<div style="padding:20px 0;text-align:center;font-size:12px;color:var(--text3)">Couldn\'t load signals right now.<br><button onclick="_renderSignalsPane(_currentDealDetail.deal, true)" style="margin-top:8px;font-size:11px;padding:5px 12px;border-radius:2px;background:var(--surface2);border:1px solid var(--border2);color:var(--gold);cursor:pointer;font-family:var(--sans)">↻ Try again</button></div>';
      return;
    }
    var html = '';
    var typeIcons = {hiring:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20v-1.5A4.5 4.5 0 017 14h4a4.5 4.5 0 014.5 4.5V20M16 4.3a3.5 3.5 0 010 6.4M18 14.3a4.5 4.5 0 013.5 4.2V20"/></svg>',funding:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v10M14.8 9.3A3 3 0 0012 7.8h-.4a2.2 2.2 0 000 4.4h.8a2.2 2.2 0 010 4.4H12a3 3 0 01-2.8-1.5"/></svg>',expansion:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>',contraction:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/></svg>',leadership:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11.5a4 4 0 100-8 4 4 0 000 8zM4.5 20.5v-1A5.5 5.5 0 0110 14h4a5.5 5.5 0 015.5 5.5v1"/></svg>',technology:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.2 14.4a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1v.2a2 2 0 01-4 0v-.1a1.6 1.6 0 00-2.8-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 010-4h.1a1.6 1.6 0 001.1-2.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 014 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7h.2a2 2 0 010 4h-.1a1.6 1.6 0 00-1.4 1.1z"/></svg>',financial:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V4M4 20h16M8 17V11M12.5 17V7.5M17 17v-4"/></svg>',competitive:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M9.5 20h5M12 14v6"/></svg>'};
    var sigColors = {positive:'var(--green)',negative:'var(--coral)',neutral:'var(--amber)'};
    if (d.cached) {
      // Fresh shared cache (<24h) = the NORMAL path — one rep fetches, the
      // whole deal team reads it. Stale cache = quota-degraded fallback.
      var cachedAtMs = d.cached_at ? new Date(d.cached_at).getTime() : 0;
      var isFreshShare = cachedAtMs && (Date.now() - cachedAtMs) < 24*3600*1000;
      var cachedLbl = d.cached_at ? new Date(d.cached_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : 'earlier';
      html += isFreshShare
        ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--text3);margin-bottom:10px;padding:4px 8px;background:var(--surface2);border-radius:2px"><span><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6.5h6l2 2.5h9v11h-17z"/></svg> Shared team fetch from ' + esc(cachedLbl) + ', saved AI quota</span><button onclick="_renderSignalsPane(_currentDealDetail.deal, true)" style="background:none;border:none;color:var(--gold);cursor:pointer;font-size:11px;font-family:var(--sans);padding:0;flex-shrink:0">↻ Refresh live</button></div>'
        : '<div style="font-size:11px;color:var(--amber);margin-bottom:10px;padding:4px 8px;background:rgba(var(--c-accent-rgb),0.1);border-radius:2px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> Live refresh unavailable (AI quota): showing signals from ' + esc(cachedLbl) + '</div>';
    }

    function renderSignalCards(signals) {
      if (!signals || !signals.length) return '<div style="font-size:12px;color:var(--text3);padding:8px 0;font-style:italic">No signals found for this scope.</div>';
      var h = '';
      signals.forEach(function(s) {
        var col = sigColors[s.signal] || 'var(--border)';
        h += '<div style="background:var(--bg);border-radius:2px;padding:9px 11px;margin-bottom:6px;border-left:3px solid '+col+'">';
        h += '<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:3px">';
        h += '<span style="font-size:13px;flex-shrink:0">'+(typeIcons[s.type]||'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 21V3.5M5.5 4.5h12l-2.5 4 2.5 4h-12"/></svg>')+'</span>';
        h += '<div style="flex:1"><div style="font-size:12px;font-weight:500;color:var(--text)">'+esc(s.title||'')+'</div>';
        if (s.date||s.source) h += '<div style="font-size:11px;color:var(--text3);margin-top:1px">'+(s.date?esc(s.date):'')+(s.date&&s.source?' · ':'')+esc(s.source||'')+'</div>';
        h += '</div>';
        h += '<span style="font-size:11px;padding:2px 6px;border-radius:2px;background:'+col+'22;color:'+col+';flex-shrink:0">'+esc(s.signal||'')+'</span>';
        h += '</div>';
        if (s.detail) h += '<div style="font-size:11px;color:var(--text2);line-height:1.5;margin-bottom:3px">'+esc(s.detail)+'</div>';
        if (s.why_it_matters) h += '<div style="font-size:11px;color:var(--amber);font-style:italic"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.8v.4"/></svg> '+esc(s.why_it_matters)+'</div>';
        h += '</div>';
      });
      return h;
    }

    // Verdict
    if (d.verdict) {
      var vp = d.verdict.split('|'), vl = vp[0]||'', vr = vp[1]||'';
      var vc = vl.includes('Approach') ? 'var(--green)' : vl.includes('Deprioritise') ? 'var(--coral)' : 'var(--amber)';
      html += '<div style="border-radius:3px;border:1px solid '+vc+';background:'+vc+'18;padding:10px 14px;margin-bottom:12px">';
      html += '<div style="font-size:11px;font-weight:700;color:'+vc+';text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">'+esc(vl)+'</div>';
      if (vr) html += '<div style="font-size:12px;color:var(--text2)">'+esc(vr)+'</div>';
      html += '</div>';
    }

    // Company meta + tech stack
    var meta = [d.company_industry, d.company_size, d.company_funding].filter(Boolean);
    if (meta.length) html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'+meta.map(function(m){return '<span style="font-size:11px;background:var(--surface2);border-radius:2px;padding:2px 8px">'+esc(m)+'</span>';}).join('')+'</div>';
    if (d.company_technologies && d.company_technologies.length) {
      html += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">';
      d.company_technologies.forEach(function(t){ html += '<span style="font-size:11px;background:rgba(58,110,168,0.1);color:var(--blue);border-radius:2px;padding:2px 6px">'+esc(String(t))+'</span>'; });
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
        html += '<span style="font-size:11px;padding:3px 9px;border-radius:2px;background:var(--surface2);border-left:3px solid '+col+'">';
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
        + (count ? '<span style="font-size:11px;background:var(--surface2);border-radius:2px;padding:1px 6px;color:var(--text3)">'+count+' signals</span>' : '')
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
    html += '<div style="background:var(--surface2);border-radius:3px;padding:12px;margin-bottom:10px">';
    html += sectionHead('I.', 'Global', globalSigs.length);
    if (globalSum) {
      var sumStyle = globalSum.startsWith('AI parse error') || globalSum.startsWith('Signal fetch') ? 'color:var(--coral)' : 'color:var(--text2)';
      html += '<div style="font-size:12px;line-height:1.6;margin-bottom:10px;'+sumStyle+'">'+esc(globalSum)+'</div>';
    }
    html += renderSignalCards(globalSigs);
    html += '</div>';

    // ── II. Regional ────────────────────────────────────────────────────────
    html += '<div style="background:var(--surface2);border-radius:3px;padding:12px;margin-bottom:10px">';
    html += sectionHead('II.', regionLabel, regionalSigs.length);
    if (regionalSum) html += '<div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:10px">'+esc(regionalSum)+'</div>';
    html += renderSignalCards(regionalSigs);
    html += '</div>';

    // ── III. Country — only if different from region ────────────────────────
    if (showCountry) {
      html += '<div style="background:var(--surface2);border-radius:3px;padding:12px;margin-bottom:10px">';
      html += sectionHead('III.', countryLabel, countrySigs.length);
      if (countrySum) html += '<div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:10px">'+esc(countrySum)+'</div>';
      html += renderSignalCards(countrySigs);
      html += '</div>';
    }

    body.innerHTML = html;
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
  var fmtUsd = function(v) { return !v ? '—' : v>=1e6 ? '$'+(v/1e6).toFixed(1)+'M' : '$'+Math.round(v/1e3)+'K'; };
  var rows = [['Deal value', fmtUsd(deal.deal_value_usd)],['Weighted', fmtUsd(deal.weighted_value_usd)],['Signal score', deal.signal_score!=null ? deal.signal_score+' / 100' : '—'],['Expected close', deal.expected_close||'—'],['Probability', deal.close_probability ? deal.close_probability+'%':'—'],['Rep', (deal.rep_email||'').split('@')[0]||'—'],['Region', deal.region||'—'],['ICP score', deal.icp_score!=null ? deal.icp_score+' / 100':'Not scored']];
  var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">';
  rows.forEach(function(r){ html += '<div style="background:var(--surface2);border-radius:2px;padding:9px 11px"><div style="font-size:11px;color:var(--text3);margin-bottom:2px">'+r[0]+'</div><div style="font-size:14px;font-weight:500;color:var(--text)">'+esc(String(r[1]))+'</div></div>'; });
  html += '</div>';
  // SDR attribution row
  html += '<div style="background:var(--surface2);border-radius:2px;padding:8px 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px">';
  html += '<span style="font-size:11px;color:var(--text3);flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Sourced by</span>';
  if (deal.originated_by_name) {
    html += '<span style="font-size:12px;font-weight:500;color:var(--text)">'+esc(deal.originated_by_name)+'</span>';
    if (deal.converted_from_sequence) html += '<span style="font-size:11px;color:var(--text3)"> · via '+esc(deal.converted_from_sequence)+'</span>';
    html += '<button onclick="clearDealAttribution(\''+esc(deal.id)+'\')" style="margin-left:auto;font-size:11px;background:none;border:none;color:var(--text3);cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  } else {
    html += '<button onclick="showAttributionPicker(\''+esc(deal.id)+'\')" style="font-size:11px;padding:2px 10px;border-radius:2px;background:none;border:1px dashed var(--border2);color:var(--text3);font-family:var(--sans);cursor:pointer">+ Tag SDR origin</button>';
  }
  html += '</div>';
  html += '<div style="display:flex;gap:8px;margin-bottom:10px">';
  html += '<button onclick="switchDealTab(\'stakeholders\')" style="flex:1;padding:9px;border-radius:2px;background:var(--surface2);border:1px solid var(--border2);color:var(--text2);font-family:var(--sans);font-size:12px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20v-1.5A4.5 4.5 0 017 14h4a4.5 4.5 0 014.5 4.5V20M16 4.3a3.5 3.5 0 010 6.4M18 14.3a4.5 4.5 0 013.5 4.2V20"/></svg> Stakeholders</button>';
  html += '<button onclick="switchDealTab(\'meddpicc\')" style="flex:1;padding:9px;border-radius:2px;background:var(--surface2);border:1px solid var(--border2);color:var(--text2);font-family:var(--sans);font-size:12px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> MEDDPICC</button>';
  html += '<button onclick="switchDealTab(\'signals\')" style="flex:1;padding:9px;border-radius:2px;background:var(--surface2);border:1px solid var(--border2);color:var(--text2);font-family:var(--sans);font-size:12px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg> Signals</button>';
  html += '<button onclick="openCloseDeal(\''+esc(deal.id)+'\',\''+esc(deal.account)+'\')" style="flex:1;padding:9px;border-radius:2px;background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:12px;cursor:pointer">Close deal</button>';
  html += '</div>';
  // Company LinkedIn URL field
  var liUrl = deal.company_linkedin_url || '';
  html += '<div style="background:var(--surface2);border-radius:2px;padding:9px 12px;display:flex;align-items:center;gap:8px">';
  html += '<svg width="13" height="13" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
  html += '<input type="url" id="dealLinkedInInput" value="' + esc(liUrl) + '" placeholder="linkedin.com/company/ferrero" onblur="saveCompanyLinkedIn(\'' + esc(deal.id) + '\',this.value)" style="flex:1;background:none;border:none;outline:none;font-family:var(--sans);font-size:12px;color:var(--text);min-width:0"/>';
  if (liUrl) html += '<a href="' + esc(liUrl) + '" target="_blank" style="font-size:11px;color:#0A66C2;white-space:nowrap">Open ↗</a>';
  html += '</div>';
  return html;
}

// ── Samora Intel button: branded entry point for stakeholder insights ────────
function _samoraIntelBtn(onclickStr, compact) {
  return '<button onclick="' + onclickStr + '" title="Samora Intelligence: how to work with them" style="display:inline-flex;align-items:center;gap:5px;background:rgba(var(--c-accent-rgb),0.12);border:1px solid rgba(var(--c-accent-rgb),0.35);border-radius:3px;padding:' + (compact ? '2px 8px' : '6px 12px') + ';cursor:pointer;flex-shrink:0">'
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
      ? '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:3px;background:rgba(var(--c-accent-rgb),0.12);color:var(--gold)">' + esc(s.insight.label) + '</span>'
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
        '<span style="font-size:13px;font-weight:700;padding:3px 10px;border-radius:3px;background:rgba(var(--c-accent-rgb),0.12);color:var(--gold)">' + esc(d.style.label) + '</span>' +
        '<span style="font-size:11px;color:var(--text3)">' + confLbl + ' · ' + d.style.messages_scanned + ' messages</span>' +
        '<span onclick="var el=document.getElementById(\'stk-receipts\');el.style.display=el.style.display===\'none\'?\'block\':\'none\'" style="font-size:11px;color:var(--gold);cursor:pointer;text-decoration:underline dotted">why?</span>' +
      '</div>';
      h += '<div id="stk-receipts" style="display:none;background:var(--surface2);border-radius:2px;padding:8px 10px;margin-bottom:8px">' +
        (d.style.receipts||[]).map(function(rc){ return '<div style="font-size:11px;color:var(--text2);padding:2px 0">· ' + esc(rc) + '</div>'; }).join('') + '</div>';
    } else if (d.archetype) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:13px;font-weight:700;padding:3px 10px;border-radius:3px;background:var(--surface2);color:var(--text2)">' + esc(d.archetype.label) + '</span>' +
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
      h += '<button onclick="openStakeholderInsight(\'' + esc(stakeholderId) + '\',\'' + esc(name) + '\',{web:true})" style="width:100%;margin-top:12px;padding:8px;border-radius:2px;background:none;border:1px dashed var(--border2);color:var(--text3);font-family:var(--sans);font-size:11px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16 16l5 5"/></svg> Check public footprint (uses AI: one search, shared with team)</button>';
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
        '<span style="font-size:13px;font-weight:700;padding:3px 10px;border-radius:3px;background:rgba(var(--c-accent-rgb),0.12);color:var(--gold)">' + esc(d.style.label) + '</span>' +
        '<span style="font-size:11px;color:var(--text3)">' + confLbl + ' · ' + d.style.messages_scanned + ' messages</span>' +
        '<span onclick="var el=document.getElementById(\'spc-receipts\');el.style.display=el.style.display===\'none\'?\'block\':\'none\'" style="font-size:11px;color:var(--gold);cursor:pointer;text-decoration:underline dotted">why?</span>' +
      '</div>';
      h += '<div id="spc-receipts" style="display:none;background:var(--surface2);border-radius:2px;padding:8px 10px;margin-bottom:8px">' +
        (d.style.receipts||[]).map(function(rc){ return '<div style="font-size:11px;color:var(--text2);padding:2px 0">· ' + esc(rc) + '</div>'; }).join('') + '</div>';
    } else if (d.archetype) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:13px;font-weight:700;padding:3px 10px;border-radius:3px;background:var(--surface2);color:var(--text2)">' + esc(d.archetype.label) + '</span>' +
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
      h += '<button onclick="openSampaignContactInsight(\'' + esc(contactId) + '\',\'' + esc(name) + '\',{web:true})" style="width:100%;margin-top:12px;padding:8px;border-radius:2px;background:none;border:1px dashed var(--border2);color:var(--text3);font-family:var(--sans);font-size:11px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16 16l5 5"/></svg> Check public footprint (uses AI: one search, shared with team)</button>';
    }
    if ((d.tips && d.tips.length) || (d.web && d.web.bullets && d.web.bullets.length)) {
      h += '<button id="spc-copy-btn" onclick="_copySampaignInsight(\'' + esc(contactId) + '\')" style="width:100%;margin-top:10px;padding:8px;border-radius:2px;background:rgba(74,158,255,0.08);border:1px solid rgba(74,158,255,0.3);color:var(--blue);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg> Copy for email draft</button>';
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
  var roleHtml = (s.meddpicc_role && s.meddpicc_role !== 'not_relevant') ? '<span style="font-size:11px;padding:1px 6px;border-radius:2px;background:' + (roleBgs[s.meddpicc_role] || 'rgba(0,0,0,0.06)') + ';color:var(--text2);margin-left:4px">' + esc(roleLabels[s.meddpicc_role] || s.meddpicc_role) + '</span>' : '';
  var deptChip = s.department ? '<span style="font-size:11px;color:var(--text3);background:var(--surface2);border-radius:2px;padding:1px 6px;margin-left:4px">' + esc(s.department) + '</span>' : '';
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
  html += '<select onchange="saveStakeholderRole(\'' + s.id + '\',this.value)" style="font-size:11px;padding:3px 6px;border-radius:2px;background:var(--surface2);border:1px solid var(--border2);color:var(--text2);font-family:var(--sans);flex-shrink:0">';
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

  if (_stkTab === 'active') {
    html += '<div style="font-size:11px;color:var(--text3);margin-bottom:10px">People with real interaction: replies, calendar invites, and anyone on the thread.</div>';
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
    html += '<button onclick="enrichDeal(\'' + esc(dealId) + '\',\'' + esc(deal && deal.account || '') + '\')" id="enrichDealBtn" style="width:100%;margin-top:12px;padding:10px;border-radius:2px;background:var(--surface2);border:1px dashed var(--border2);color:var(--text2);font-family:var(--sans);font-size:12px;cursor:pointer">' + _samoraIntelLabel('Find &amp; enrich contacts from activity') + '</button>';
    html += '<div id="enrichDealStatus" style="font-size:11px;color:var(--text3);margin-top:6px"></div>';
    html += '<button onclick="syncActiveStakeholders(\'' + esc(dealId) + '\')" id="syncActiveBtn" style="width:100%;margin-top:6px;padding:8px;border-radius:2px;background:var(--surface2);border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:11px;cursor:pointer">↻ Sync recent contacts from Gmail &amp; calendar</button>';
  } else {
    html += '<button onclick="scoutStakeholders(\'' + esc(dealId) + '\')" id="scoutBtn" style="width:100%;margin-top:12px;padding:10px;border-radius:2px;background:rgba(var(--c-accent-rgb),0.08);border:1px solid rgba(var(--c-accent-rgb),0.4);color:var(--gold);font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer">' + _samoraIntelLabel('Scout stakeholders for this account') + '</button>';
    html += '<div id="scoutStatus" style="font-size:11px;color:var(--text3);margin-top:6px"></div>';
    html += '<div onclick="openScoutProfile(\'' + esc(dealId) + '\')" style="font-size:11px;color:var(--text3);text-align:center;margin-top:8px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Who to hunt (job titles &amp; targets)</div>';
  }
  body.innerHTML = html;
}

function setStkTab(t) { _stkTab = t; _renderStakeholdersPane(window._stkAll, window._stkDeal); }

async function _reloadStakeholders(dealId) {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({ action:'get_stakeholders', account_id:dealId }) });
    var d = await r.json();
    var stk = d.stakeholders || [];
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
    return '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:5px 10px;border-radius:3px;border:1px solid ' + (on?'var(--gold)':'var(--border2)') + ';background:' + (on?'rgba(var(--c-accent-rgb),0.08)':'transparent') + ';color:' + (on?'var(--gold)':'var(--text2)') + ';cursor:pointer;margin:0 6px 6px 0"><input type="checkbox" data-group="' + group + '" value="' + val + '"' + (on?' checked':'') + ' style="margin:0">' + val + '</label>';
  };
  var inputStyle = 'width:100%;padding:9px 11px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;color:var(--text);font-size:13px;font-family:var(--sans);outline:none';
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
    '<button onclick="saveScoutProfile()" style="width:100%;padding:12px;border:none;border-radius:3px;background:var(--gold);color:var(--c-canvas);font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans)">Save</button>' +
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
      var jobs = [ fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'save_org_setting', key:'stakeholder_scout_profile', value: JSON.stringify(profile) }) }) ];
      if (_scoutAcctId) jobs.push(fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'save_org_setting', key:'scout_profile_'+_scoutAcctId, value: JSON.stringify({}) }) }));
      await Promise.all(jobs);
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
    '<button onclick="inferMeddpiccFromTranscripts(\'' + esc(deal.id) + '\').then(function(d){if(d&&d.ok){_loadDealDetailData(\'' + esc(deal.id) + '\',{id:\'' + esc(deal.id) + '\',account:\'' + esc(deal.account) + '\'})}})" style="padding:5px 10px;border-radius:2px;background:var(--surface2);border:1px solid var(--border2);color:var(--text2);font-family:var(--sans);font-size:11px;cursor:pointer">' + _samoraIntelLabel('Auto-fill from calls') + '</button>' +
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
    html += '<div style="background:var(--surface2);border-radius:2px;padding:10px 12px;margin-bottom:7px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
        '<span style="font-size:11px;color:var(--text3);font-weight:700;min-width:14px">'+f.letter+'</span>' +
        '<span style="font-size:12px;font-weight:500;color:var(--text);flex:1">'+f.label+'</span>' +
        '<select onchange="saveMeddpiccField(\''+deal.id+'\',\''+f.key+'_status\',this.value)" style="font-size:11px;padding:2px 5px;border-radius:2px;background:var(--surface);border:1px solid var(--border2);color:'+statusColors[status]+';font-family:var(--sans)">' +
          ['unknown','confirmed','partial','missing'].map(function(o){ return '<option value="'+o+'"'+(status===o?' selected':'')+' style="color:var(--text)">'+o+'</option>'; }).join('') +
        '</select>' +
      '</div>' +
      '<input type="text" id="mf-'+f.valKey+'" value="'+esc(value)+'" placeholder="'+esc(f.hint)+'" ' +
        'oninput="_meddpiccChanged(\'' + deal.id + '\')" ' +
        'onblur="saveMeddpiccField(\'' + deal.id + '\',\'' + f.valKey + '\',this.value)" ' +
        'style="width:100%;padding:6px 8px;background:var(--bg);border:1px solid var(--border);border-radius:2px;color:var(--text);font-family:var(--sans);font-size:12px;outline:none"/>' +
    '</div>';
  });
  // Save All button + status indicator
  html += '<div style="margin-top:12px;display:flex;align-items:center;gap:8px">';
  html += '<button id="meddpiccSaveBtn" onclick="_saveAllMeddpicc(\''+deal.id+'\')" style="padding:9px 18px;border-radius:2px;background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer">Save changes</button>';
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
function _num(id, val, w) { return '<input type="number" id="'+id+'" value="'+(val==null?'':val)+'" style="width:'+(w||48)+'px;padding:5px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;color:var(--text);font-family:var(--sans);font-size:12px;outline:none">'; }
function renderNotificationRules(cfg) {
  var host = document.getElementById('notifRulesForm'); if (!host) return;
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var h = '';
  // Master switch
  h += '<label style="display:flex;align-items:center;gap:10px;padding:8px 0;margin-bottom:6px;border-bottom:1px solid var(--border);cursor:pointer">' + _chk('nr-enabled', cfg.enabled) + '<span style="font-size:13px;font-weight:600;color:var(--text)">Push notifications enabled for this org</span></label>';
  // Rule rows
  h += NOTIF_RULE_META.map(function(m){
    var rc = cfg.rules[m.key] || { enabled:false };
    var params = m.params.map(function(p){
      return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--text3)">'+esc(p.label)+' '+_num('nr-'+m.key+'-'+p.key, rc[p.key]!=null?rc[p.key]:p.def)+' '+esc(p.suffix)+'</span>';
    }).join('<span style="margin:0 4px"></span>');
    return '<div style="padding:10px 0;border-bottom:1px solid var(--border)">' +
      '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">' + _chk('nr-rule-'+m.key, rc.enabled) +
      '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--text)">'+m.icon+' '+esc(m.label)+'</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(m.desc)+'</div>' +
      (params ? '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">'+params+'</div>' : '') +
      '</div></label></div>';
  }).join('');
  // Quiet hours + weekly digest
  h += '<div style="padding:12px 0;border-bottom:1px solid var(--border)">' +
    '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' + _chk('nr-quiet', cfg.quiet_hours.enabled) +
    '<span style="font-size:13px;font-weight:600;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5.2l3.2 2"/></svg> Quiet hours</span></label>' +
    '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:11px;color:var(--text3)">No pushes from '+_num('nr-quiet-start', cfg.quiet_hours.start)+' :00 to '+_num('nr-quiet-end', cfg.quiet_hours.end)+' :00 (local)</div></div>';
  h += '<div style="padding:12px 0">' +
    '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' + _chk('nr-digest', cfg.weekly_digest.enabled) +
    '<span style="font-size:13px;font-weight:600;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Weekly digest</span></label>' +
    '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:11px;color:var(--text3)">Send on <select id="nr-digest-day" style="padding:5px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;color:var(--text);font-family:var(--sans);font-size:12px">'+days.map(function(d,i){return '<option value="'+i+'"'+(i===cfg.weekly_digest.day?' selected':'')+'>'+d+'</option>';}).join('')+'</select> at '+_num('nr-digest-hour', cfg.weekly_digest.hour)+' :00</div></div>';
  // Save
  h += '<div style="display:flex;gap:8px;margin-top:14px;align-items:center">' +
    '<button onclick="saveNotificationRules()" style="padding:8px 16px;border-radius:2px;background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer">Save rules</button>' +
    '<button onclick="renderNotificationRules(NOTIFICATION_RULE_DEFAULTS)" style="padding:8px 12px;border-radius:2px;background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:12px;cursor:pointer">Reset to default</button>' +
    '<span id="nr-status" style="font-size:12px;color:var(--text3)"></span></div>';
  host.innerHTML = h;
}
async function loadNotificationRules() {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_org_setting', key:'notification_rules'}) });
    var d = await r.json();
    var saved = null; try { saved = d.value ? JSON.parse(d.value) : null; } catch(e) {}
    _notificationRulesCache = _mergeNotifRules(saved);
  } catch(e) { _notificationRulesCache = _mergeNotifRules(null); }
  window._notificationRules = _notificationRulesCache;
  renderNotificationRules(_notificationRulesCache);
}
async function saveNotificationRules() {
  var g = function(id){ return document.getElementById(id); };
  var cfg = _mergeNotifRules(null);
  cfg.enabled = g('nr-enabled') ? g('nr-enabled').checked : true;
  cfg.quiet_hours = { enabled: g('nr-quiet')?.checked, start: parseInt(g('nr-quiet-start')?.value||'21',10), end: parseInt(g('nr-quiet-end')?.value||'8',10) };
  cfg.weekly_digest = { enabled: g('nr-digest')?.checked, day: parseInt(g('nr-digest-day')?.value||'1',10), hour: parseInt(g('nr-digest-hour')?.value||'8',10) };
  NOTIF_RULE_META.forEach(function(m){
    var rc = { enabled: g('nr-rule-'+m.key)?.checked };
    m.params.forEach(function(p){ var el = g('nr-'+m.key+'-'+p.key); rc[p.key] = el ? (parseInt(el.value,10)||0) : p.def; });
    cfg.rules[m.key] = rc;
  });
  var st = g('nr-status');
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'save_org_setting', key:'notification_rules', value:JSON.stringify(cfg)}) });
    var d = await r.json();
 if (d.ok) { _notificationRulesCache = cfg; window._notificationRules = cfg; showToast('Notification rules saved'); if(st){st.textContent='Saved';st.style.color='var(--green)';setTimeout(function(){st.textContent='';},3000);} }
    else showToast('Could not save rules');
  } catch(e) { showToast('Error: ' + e.message); }
}

// ── Feature 1: Deal velocity sparkline ────────────────────────────────────────
function _renderSparkline(history) {
  if (!history || history.length < 2) return '';
  var scores = history.map(function(h) { return typeof h === 'object' ? (h.health || h.score || 0) : 0; });
  var min = Math.min.apply(null, scores);
  var max = Math.max.apply(null, scores);
  var range = max - min || 1;
  var w = 36, h = 14, pts = scores.length;
  var points = scores.map(function(s, i) {
    var x = Math.round((i / (pts - 1)) * (w - 2)) + 1;
    var y = Math.round(h - 1 - ((s - min) / range) * (h - 3)) + 1;
    return x + ',' + y;
  }).join(' ');
  var last = scores[scores.length - 1];
  var first = scores[0];
  var color = last > first ? '#4a8c5c' : last < first ? '#c0523f' : '#888';
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="margin-left:5px;flex-shrink:0" title="' + pts + '-day trend">' +
    '<polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
}

// ── Feature 2: Meeting prep ────────────────────────────────────────────────────
var _meetingPrepData = null;

async function loadMeetingPrep() {
  var container = document.getElementById('meetingPrepSection'); if (!container) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_meeting_prep', target_date: new Date().toISOString().split('T')[0]}) });
    var d = await r.json();
    _meetingPrepData = d;
    if (!d.ok || !d.meetings || !d.meetings.length) {
      // No calendar events at all tomorrow
      container.style.display = 'none'; return;
    }
    var meetings = d.meetings.filter(function(m) { return m.account_name; }); // only matched meetings
    if (!meetings.length) {
      // Calendar events exist but none matched pipeline accounts — show light hint
      container.style.display = 'block';
      container.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:6px 10px;background:var(--surface2);border-radius:2px;margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> ' + d.meetings.length + ' meeting' + (d.meetings.length!==1?'s':'') + ' today — none matched pipeline accounts by attendee or name</div>';
      return;
    }

    var html = '<div style="margin-bottom:12px">';
    // Collapsible header — collapsed by default to save screen space
    html += '<div onclick="_toggleMeetingPrepList()" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;background:var(--surface2);border:1px solid var(--border2);border-radius:2px;user-select:none">';
    html += '<span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;flex:1"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> Today\'s meetings · ' + meetings.length + '</span>';
    html += '<span id="meetingPrepChevron" style="font-size:11px;color:var(--text3)">▸</span>';
    html += '</div>';
    html += '<div id="meetingPrepList" style="display:none;margin-top:8px">';

    window._mtgRosters = [];  // rebuilt on every render, indexes stay in sync
    meetings.forEach(function(m) {
      var hScore = m.health_score || 0;
      var hColor = hScore >= 70 ? 'var(--green)' : hScore >= 40 ? 'var(--amber)' : 'var(--coral)';
      var time = '';
      try { time = new Date(m.startTime).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}); } catch(e) {}

      // Register the attendee roster up front so the Intel button can sit in the header
      var _rosterIdx = -1;
      if (m.stakeholders_attending && m.stakeholders_attending.length) {
        window._mtgRosters = window._mtgRosters || [];
        _rosterIdx = window._mtgRosters.push(m.stakeholders_attending) - 1;
      }
      html += '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:9px 12px;margin-bottom:6px;cursor:pointer" onclick="_togglePrepDetail(\'' + esc(m.account_id||'') + '\')">';
      // Header row: name/time left, Samora Intel + health right (uses the free space)
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">';
      html += '<span style="font-size:13px;flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg></span>';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-size:13px;font-weight:500;color:var(--text)">' + esc(m.account_name) + '</div>';
      html += '<div style="font-size:11px;color:var(--text3)">' + esc(m.title) + (time ? ' · ' + time : '') + '</div>';
      html += '</div>';
      if (_rosterIdx >= 0) html += _samoraIntelBtn('event.stopPropagation();openMeetingInsights(' + _rosterIdx + ')', true);
      if (hScore) html += '<span style="font-size:11px;padding:2px 7px;border-radius:2px;background:'+hColor+'18;color:'+hColor+'" title="Deal health">H:' + hScore + '</span>';
      html += '</div>';

      // Talking points (MEDDPICC gaps)
      if (m.talking_points && m.talking_points.length) {
        html += '<div style="font-size:11px;color:var(--text3);margin-bottom:5px;font-weight:500">Discuss in this meeting:</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px">';
        m.talking_points.forEach(function(tp) {
          html += '<span style="font-size:11px;padding:2px 8px;border-radius:2px;background:rgba(var(--c-accent-rgb),0.1);color:var(--gold)">→ ' + esc(tp) + '</span>';
        });
        html += '</div>';
      }

      // Stakeholders attending
      if (m.stakeholders_attending && m.stakeholders_attending.length) {
        html += '<div style="font-size:11px;color:var(--text3);margin-bottom:3px">Attending: ' +
          m.stakeholders_attending.map(function(s) {
            return '<strong>' + esc(s.full_name||'') + '</strong>' + (s.title ? ' (' + esc(s.title) + ')' : '');
          }).join(', ') + '</div>';
      }

      // Last email
      if (m.last_email) {
        html += '<div style="font-size:11px;color:var(--text3);border-top:1px solid var(--border);margin-top:6px;padding-top:5px">';
        html += '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Last: <em>' + esc(m.last_email.subject||'') + '</em>';
        if (m.last_email.snippet) html += ' — ' + esc(m.last_email.snippet.slice(0,80)) + '…';
        html += '</div>';
      }

      // Last transcript action items
      if (m.last_transcript && m.last_transcript.action_items) {
        html += '<div style="font-size:11px;color:var(--text3);margin-top:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3.5h6v3H9zM7 5H5.5v15h13V5H17"/></svg> Open items: ' + esc(m.last_transcript.action_items.slice(0,100)) + '</div>';
      }

      html += '</div>';
    });
    html += '</div></div>';
    container.innerHTML = html;
    container.style.display = 'block';
  } catch(e) { console.error('Meeting prep error:', e); }
}

function _toggleMeetingPrepList() {
  var l = document.getElementById('meetingPrepList');
  var c = document.getElementById('meetingPrepChevron');
  if (!l) return;
  var open = l.style.display !== 'none';
  l.style.display = open ? 'none' : 'block';
  if (c) c.textContent = open ? '▸' : '▾';
}

function _togglePrepDetail(accountId) {
  if (accountId && _pipelineData) {
    var all = [...(_pipelineData.verified||[]),...(_pipelineData.partial||[]),...(_pipelineData.unverified||[])];
    var deal = all.find(function(d) { return d.id === accountId; });
    if (deal) openDealDetail(accountId, deal.account);
  }
}

// ── Feature 4: Manager forecast view ──────────────────────────────────────────
var _forecastData = null;

async function loadForecastPanel() {
  var container = document.getElementById('forecastPanel'); if (!container) return;
  container.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">↻ Computing forecast…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_forecast'}) });
    _forecastData = await r.json();
    var d = _forecastData;
    if (!d.ok) { container.innerHTML = ''; return; }

    var fmt = function(v) { return !v ? '$0' : v >= 1000000 ? '$' + (v/1000000).toFixed(1) + 'M' : '$' + Math.round(v/1000) + 'K'; };
    var trend = function(v) { return !v ? '' : v > 0 ? '<span style="color:var(--green)">↑' + fmt(Math.abs(v)) + '</span>' : '<span style="color:var(--coral)">↓' + fmt(Math.abs(v)) + '</span>'; };

    var html = '<div style="margin-bottom:14px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V4M4 20h16M8 17V11M12.5 17V7.5M17 17v-4"/></svg> Forecast</div>';
    html += '<button onclick="loadForecastPanel()" style="font-size:11px;padding:2px 8px;border-radius:2px;background:var(--surface2);border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);cursor:pointer">↻ Refresh</button>';
    html += '</div>';

    // KPI row
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">';
    html += '<div style="background:rgba(74,140,92,0.08);border:1px solid rgba(74,140,92,0.2);border-radius:2px;padding:9px 10px"><div style="font-size:11px;color:var(--green);font-weight:600;margin-bottom:2px">Verified</div><div style="font-size:16px;font-weight:600;color:var(--text)">' + fmt(d.verified) + '</div>' + (d.trend ? '<div style="font-size:11px">' + trend(d.trend.verifiedChange) + ' vs last wk</div>' : '') + '</div>';
    html += '<div style="background:rgba(var(--c-accent-rgb),0.08);border:1px solid rgba(var(--c-accent-rgb),0.2);border-radius:2px;padding:9px 10px"><div style="font-size:11px;color:var(--amber);font-weight:600;margin-bottom:2px">Nurture</div><div style="font-size:16px;font-weight:600;color:var(--text)">' + fmt(d.nurture) + '</div><div style="font-size:11px;color:var(--text3)">' + (d.buckets&&d.buckets.nurture?d.buckets.nurture.length:0) + ' deals</div></div>';
    html += '<div style="background:rgba(192,82,63,0.08);border:1px solid rgba(192,82,63,0.2);border-radius:2px;padding:9px 10px"><div style="font-size:11px;color:var(--coral);font-weight:600;margin-bottom:2px">At risk</div><div style="font-size:16px;font-weight:600;color:var(--text)">' + fmt(d.atRisk) + '</div>' + (d.trend ? '<div style="font-size:11px">' + trend(d.trend.atRiskChange) + ' vs last wk</div>' : '') + '</div>';
    html += '</div>';

    // Won / Lost MTD
    if (d.wonMtd || d.lostMtd) {
      html += '<div style="display:flex;gap:6px;margin-bottom:10px">';
      html += '<div style="flex:1;background:var(--surface2);border-radius:2px;padding:8px 10px"><div style="font-size:11px;color:var(--text3);margin-bottom:1px">Won MTD</div><div style="font-size:14px;font-weight:600;color:var(--green)">' + fmt(d.wonMtd) + '</div></div>';
      html += '<div style="flex:1;background:var(--surface2);border-radius:2px;padding:8px 10px"><div style="font-size:11px;color:var(--text3);margin-bottom:1px">Lost MTD</div><div style="font-size:14px;font-weight:600;color:var(--coral)">' + fmt(d.lostMtd) + '</div></div>';
      html += '<div style="flex:1;background:var(--surface2);border-radius:2px;padding:8px 10px"><div style="font-size:11px;color:var(--text3);margin-bottom:1px">Pipeline</div><div style="font-size:14px;font-weight:600;color:var(--text)">' + fmt(d.total_pipeline) + '</div></div>';
      html += '</div>';
    }

    // Closing soon
    if (d.closingSoon && d.closingSoon.length) {
      html += '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Closing in 14 days</div>';
      d.closingSoon.forEach(function(deal) {
        var hc = deal.health >= 70 ? 'var(--green)' : deal.health >= 40 ? 'var(--amber)' : 'var(--coral)';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">';
        html += '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;color:var(--text)">' + esc(deal.account) + '</div>';
        html += '<div style="font-size:11px;color:var(--text3)">' + esc(deal.rep) + (deal.region?' · '+esc(deal.region):'') + '</div></div>';
        html += '<div style="text-align:right;flex-shrink:0"><div style="font-size:12px;font-weight:500;color:var(--text)">' + fmt(deal.value) + '</div>';
        html += '<div style="font-size:11px;color:' + (deal.daysToClose<=3?'var(--coral)':'var(--text3)') + '">' + deal.daysToClose + 'd</div></div>';
        html += '<span style="font-size:11px;padding:1px 6px;border-radius:2px;background:'+hc+'18;color:'+hc+'">H:' + (deal.health||'-') + '</span>';
        html += '</div>';
      });
    }

    html += '</div>';
    container.innerHTML = html;
  } catch(e) { container.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: ' + esc(e.message) + '</div>'; }
}

// ── SDR Attribution ───────────────────────────────────────────────────────────
var _orgMembers = null;

async function _ensureOrgMembers() {
  // NB: empty array must NOT count as "loaded" — a single failed fetch would
  // otherwise poison the cache and every dropdown stays empty forever.
  if (_orgMembers && _orgMembers.length) return _orgMembers;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_org_members'}) });
    var d = await r.json();
    _orgMembers = Array.isArray(d.members) ? d.members : [];
    if (!_orgMembers.length && d.error) showToast('Could not load team members: ' + d.error);
  } catch(e) { _orgMembers = []; showToast('Could not load team members'); }
  return _orgMembers;
}

// ── Team assignment: AE + SDR on one account (manager+) ──────────────────────
// One account row, both roles mapped — the SDR and AE always work the SAME
// stored account. "No AE" = manager takes ownership.
async function openTeamAssign(accountId, accountName, currentAe, currentSdr) {
  await _ensureOrgMembers();
  document.getElementById('teamAssignPanel')?.remove();
  var panel = document.createElement('div');
  panel.id = 'teamAssignPanel';
  panel.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center';
  var memberOpts = function(selected, roleFilter) {
    return '<option value="">— None —</option>' + (_orgMembers||[]).filter(function(m){ return !roleFilter || roleFilter.includes(m.role) || !m.role; }).map(function(m) {
      var name = m.display_name || (m.email||'').split('@')[0];
      return '<option value="' + esc(m.user_id) + '"' + (m.user_id === selected ? ' selected' : '') + '>' + esc(name) + ' (' + esc(m.role||'member') + ')</option>';
    }).join('');
  };
  var html = '<div style="background:var(--bg);border-radius:3px;padding:20px;width:320px;max-width:90vw" onclick="event.stopPropagation()">';
  html += '<div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20v-1.5A4.5 4.5 0 017 14h4a4.5 4.5 0 014.5 4.5V20M16 4.3a3.5 3.5 0 010 6.4M18 14.3a4.5 4.5 0 013.5 4.2V20"/></svg> Assign team</div>';
  html += '<div style="font-size:12px;color:var(--text3);margin-bottom:14px">' + esc(accountName) + ' — AE and SDR share this one account record, so both always see the same data.</div>';
  html += '<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--text3);margin-bottom:5px">AE / Owner <span style="opacity:.7">(None = you own it)</span></div>';
  html += '<select id="taAeSelect" style="width:100%;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none">' + memberOpts(currentAe, null) + '</select></div>';
  html += '<div style="margin-bottom:14px"><div style="font-size:11px;color:var(--text3);margin-bottom:5px">SDR</div>';
  html += '<select id="taSdrSelect" style="width:100%;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none">' + memberOpts(currentSdr, null) + '</select></div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<button onclick="saveTeamAssign(\'' + esc(accountId) + '\')" style="flex:1;padding:9px;border-radius:2px;background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer">Save</button>';
  html += '<button onclick="document.getElementById(\'teamAssignPanel\').remove()" style="padding:9px 14px;border-radius:2px;background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:12px;cursor:pointer">Cancel</button>';
  html += '</div></div>';
  panel.innerHTML = html;
  panel.addEventListener('click', function(e) { if (e.target === panel) panel.remove(); });
  document.body.appendChild(panel);
}

async function saveTeamAssign(accountId) {
  var ae  = document.getElementById('taAeSelect')?.value || '';
  var sdr = document.getElementById('taSdrSelect')?.value || '';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'assign_account_team', account_id:accountId, ae_user_id:ae, sdr_user_id:sdr }) });
    var d = await r.json();
    if (!d.ok) { showToast(d.error || 'Assignment failed'); return; }
    document.getElementById('teamAssignPanel')?.remove();
    showToast('Team assigned');
    loadMyAccounts();
  } catch(e) { showToast('Error: ' + e.message); }
}

async function showAttributionPicker(dealId) {
  // Load org members if not cached
  if (!_orgMembers) {
    try {
      var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({action:'get_org_members'}) });
      var d = await r.json();
      _orgMembers = d.members || [];
    } catch(e) { _orgMembers = []; }
  }
  // Remove any existing picker
  document.getElementById('attributionPickerPanel')?.remove();
  var panel = document.createElement('div');
  panel.id = 'attributionPickerPanel';
  panel.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center';
  var html = '<div style="background:var(--bg);border-radius:3px;padding:20px;width:320px;max-width:90vw" onclick="event.stopPropagation()">';
  html += '<div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">Tag SDR origin</div>';
  html += '<div style="font-size:12px;color:var(--text3);margin-bottom:14px">Who sourced this deal? This is used for SDR attribution in pipeline reporting.</div>';
  html += '<div style="margin-bottom:12px">';
  html += '<div style="font-size:11px;color:var(--text3);margin-bottom:5px">Select SDR</div>';
  html += '<select id="attrSdrSelect" style="width:100%;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none">';
  html += '<option value="">— Select team member —</option>';
  (_orgMembers || []).forEach(function(m) {
    var name = m.display_name || (m.email||'').split('@')[0];
    html += '<option value="' + esc(m.user_id) + '">' + esc(name) + ' (' + esc(m.role||'') + ')</option>';
  });
  html += '</select></div>';
  html += '<div style="margin-bottom:14px">';
  html += '<div style="font-size:11px;color:var(--text3);margin-bottom:5px">Sequence / campaign (optional)</div>';
  html += '<input type="text" id="attrSeqInput" placeholder="e.g. Ferrero EMEA Q3 sequence" style="width:100%;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none;box-sizing:border-box"/>';
  html += '</div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<button onclick="saveAttribution(\'' + esc(dealId) + '\')" style="flex:1;padding:9px;border-radius:2px;background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer">Save</button>';
  html += '<button onclick="document.getElementById(\'attributionPickerPanel\').remove()" style="padding:9px 14px;border-radius:2px;background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:12px;cursor:pointer">Cancel</button>';
  html += '</div></div>';
  panel.innerHTML = html;
  panel.addEventListener('click', function(e) { if (e.target === panel) panel.remove(); });
  document.body.appendChild(panel);
}

async function saveAttribution(dealId) {
  var sdrId = document.getElementById('attrSdrSelect')?.value;
  var seq   = document.getElementById('attrSeqInput')?.value?.trim();
  if (!sdrId) { showToast('Select a team member first'); return; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'set_deal_attribution', account_id:dealId, originated_by:sdrId, converted_from_sequence:seq||null}) });
    var d = await r.json();
    if (d.ok) {
      document.getElementById('attributionPickerPanel')?.remove();
      showToast('SDR attribution saved');
      // Update deal in local pipeline data
      var member = (_orgMembers||[]).find(function(m) { return m.user_id === sdrId; });
      if (_currentDealDetail && member) {
        _currentDealDetail.deal.originated_by_name = member.display_name || (member.email||'').split('@')[0];
        _currentDealDetail.deal.converted_from_sequence = seq || null;
        document.getElementById('deal-detail-body').innerHTML = _buildDealOverviewHTML(_currentDealDetail.deal);
      }
    }
  } catch(e) { showToast('Error: ' + e.message); }
}

async function clearDealAttribution(dealId) {
  try {
    await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'set_deal_attribution', account_id:dealId, originated_by:null, converted_from_sequence:null}) });
    if (_currentDealDetail) {
      _currentDealDetail.deal.originated_by_name = null;
      _currentDealDetail.deal.converted_from_sequence = null;
      document.getElementById('deal-detail-body').innerHTML = _buildDealOverviewHTML(_currentDealDetail.deal);
    }
    showToast('Attribution cleared');
  } catch(e) {}
}

async function loadHealthWeights() {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_org_setting', key:'health_score_weights'}) });
    var d = await r.json();
    if (d.value) {
      var w = JSON.parse(d.value);
      ['signal','meddpicc','recency','champion','close'].forEach(function(k) {
        var el = document.getElementById('hw-' + k) ;
        if (el && w[k] != null) el.value = String(w[k]);
      });
      _updateHwTotal();
    }
  } catch(e) {}
}

function resetHealthWeights() {
  var defaults = {signal:30, meddpicc:25, recency:20, champion:10, close:15};
  Object.entries(defaults).forEach(function(e) {
    var el = document.getElementById('hw-' + e[0]) ;
    if (el) el.value = String(e[1]);
  });
  _updateHwTotal();
}

async function _saveAllMeddpicc(accountId) {
  var btn = document.getElementById('meddpiccSaveBtn');
  var st  = document.getElementById('meddpiccSaveStatus');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
  // Collect all input values from the MEDDPICC pane
  var fields = {};
  document.querySelectorAll('[id^="mf-"]').forEach(function(el) {
    var field = (el ).id.replace('mf-', '');
    fields[field] = (el ).value;
  });
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'save_meddpicc', account_id:accountId, fields}) });
    var d = await r.json();
    if (d.ok) {
      _meddpiccDirty = false;
 if (st) { st.textContent = 'All saved'; st.style.color = 'var(--green)'; }
      showToast('MEDDPICC saved');
    }
  } catch(e) {
    if (st) { st.textContent = 'Save failed'; st.style.color = 'var(--coral)'; }
  }
  if (btn) { btn.textContent = 'Save changes'; btn.disabled = false; }
}

// Branded label for features powered by the Samora local intelligence layer
function _samoraIntelLabel(text) {
  return '<span style="display:inline-flex;align-items:center;gap:7px;justify-content:center;flex-wrap:wrap">'
    + '<img src="icons/icon-48.png" alt="Samora" style="width:16px;height:16px;border-radius:50%;flex-shrink:0"/>'
    + '<span>' + text + '</span>'
    + '<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;background:rgba(var(--c-accent-rgb),0.12);padding:2px 6px;border-radius:2px;flex-shrink:0">Samora Intelligence</span>'
    + '</span>';
}

async function enrichDeal(accountId, accountName) {
  var body = document.getElementById('deal-detail-body');
  var status = document.getElementById('enrichDealStatus');
  var btn = document.getElementById('enrichDealBtn');

  // Step 1: fetch domain from account record to pre-populate confirmation
  if (btn) { btn.textContent = '↻ Loading…'; btn.disabled = true; }
  var domain = '';
  try {
    var dr = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'get_account_domain', account_id:accountId}) });
    var dd = await dr.json();
    domain = dd.domain || '';
  } catch(e) {}
  if (btn) { btn.innerHTML = _samoraIntelLabel('Find contacts from Gmail &amp; SmartReach activity'); btn.disabled = false; }

  // Step 2: show confirmation panel so human can verify domain before searching
  var confirmHtml = '<div style="margin-top:10px;background:var(--surface2);border-radius:3px;padding:12px">' +
    '<div style="font-size:12px;font-weight:500;color:var(--text);margin-bottom:4px">Confirm company domain</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">We\'ll scan Gmail and SmartReach for emails linked to this domain, scoped to this deal\'s keywords.</div>' +
    '<div style="display:flex;gap:8px;align-items:center">' +
      '<input type="text" id="enrichDomainInput" value="' + esc(domain) + '" placeholder="e.g. ferrero.com"' +
        ' style="flex:1;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:2px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none"/>' +
      '<button onclick="_runEnrich(\'' + esc(accountId) + '\',\'' + esc(accountName) + '\')" ' +
        'style="padding:8px 14px;border-radius:2px;background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer">Search</button>' +
      '<button onclick="this.parentElement.parentElement.remove()" ' +
        'style="padding:8px 10px;border-radius:2px;background:none;border:1px solid var(--border2);color:var(--text3);font-family:var(--sans);font-size:12px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +
    '<div id="enrichRunStatus" style="font-size:11px;color:var(--text3);margin-top:6px"></div>' +
  '</div>';

  // Inject below the enrich button
  var existing = document.getElementById('enrichConfirmPanel');
  if (existing) existing.remove();
  var panel = document.createElement('div');
  panel.id = 'enrichConfirmPanel';
  panel.innerHTML = confirmHtml;
  var enrichBtn = document.getElementById('enrichDealBtn');
  if (enrichBtn) enrichBtn.insertAdjacentElement('afterend', panel);
  document.getElementById('enrichDomainInput')?.focus();
}

async function _runEnrich(accountId, accountName) {
  var domainInput = document.getElementById('enrichDomainInput');
  var runStatus = document.getElementById('enrichRunStatus');
  var domain = domainInput ? domainInput.value.trim().replace(/^https?:\/\//,'').replace(/\/.*$/,'') : '';
  if (!domain) { if(runStatus) runStatus.textContent = 'Enter a domain first'; return; }
  var searchBtn = domainInput?.nextElementSibling;
  if (searchBtn) { searchBtn.textContent = '↻ Scanning…'; searchBtn.disabled = true; }
  if (runStatus) runStatus.textContent = 'Scanning Gmail and SmartReach…';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({action:'enrich_account', account_id:accountId, account_name:accountName, domain}) });
    var d = await r.json();
    var panel = document.getElementById('enrichConfirmPanel');
    if (d.ok && !d.cached) {
 showToast('Found ' + d.count + ' contacts' + (d.enriched ? ' · ' + d.enriched + ' enriched' : ''));
      if (panel) panel.remove();
      var sRes = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({action:'get_stakeholders', account_id:accountId}) });
      var sData = await sRes.json();
      if (_currentDealDetail) _currentDealDetail.stakeholders = sData.stakeholders||[];
      _renderStakeholdersPane(_currentDealDetail?.stakeholders||[], {id:accountId, account:accountName});
    } else if (d.cached) {
      if (runStatus) { runStatus.textContent = 'Already enriched. Refreshing…'; }
      var r2 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({action:'enrich_account', account_id:accountId, account_name:accountName, domain, refresh:true}) });
      var d2 = await r2.json();
      if (panel) panel.remove();
 showToast(d2.ok ? 'Refreshed ' + d2.count + ' contacts' : 'Refresh failed');
      var sRes2 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({action:'get_stakeholders', account_id:accountId}) });
      if (_currentDealDetail) _currentDealDetail.stakeholders = (await sRes2.json()).stakeholders||[];
      _renderStakeholdersPane(_currentDealDetail?.stakeholders||[], {id:accountId, account:accountName});
    } else {
      if (runStatus) { runStatus.style.color = 'var(--coral)'; runStatus.textContent = d.error || 'No contacts found'; }
      if (searchBtn) { searchBtn.textContent = 'Search'; searchBtn.disabled = false; }
    }
  } catch(e) {
    if (runStatus) runStatus.textContent = 'Error: ' + e.message;
    if (searchBtn) { searchBtn.textContent = 'Search'; searchBtn.disabled = false; }
  }
}


// ── Delegated click handler for pipeline edit-close-date buttons ─────────────
// Using data attributes means no inline onclick with escaped strings.
// One listener on the document catches all current and future pipeline cards.
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.edit-close-date-btn');
  if (btn) {
    editCloseDate(
      btn.getAttribute('data-opp-id'),
      btn.getAttribute('data-account'),
      btn.getAttribute('data-close')
    );
  }
});

function showCFToast(msg){let t=document.getElementById('cf-toast');if(!t){t=document.createElement('div');t.id='cf-toast';t.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--surface);border:1px solid var(--gold);padding:10px 18px;border-radius:2px;font-size:13px;color:var(--text);z-index:9998;opacity:0;transition:all .3s;pointer-events:none;white-space:nowrap;font-family:var(--font)';document.body.appendChild(t);}t.textContent=msg;requestAnimationFrame(()=>{t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';});clearTimeout(t._timer);t._timer=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(10px)';},3000);}
document.addEventListener('click',e=>{const m=document.getElementById('carryFwdModal');if(m&&e.target===m)closeCarryForward();});

(async function init() {
  initTheme();
  // Check for Microsoft OAuth callback immediately on load
  // (runs before auth check so we can capture the code before URL cleanup)
  const _msParams = new URLSearchParams(window.location.search);
  const _msCode   = _msParams.get('code');
  const _msError  = _msParams.get('error');
  if (_msCode || _msError) {
    // Clean URL immediately, handle after auth context is established
    window.history.replaceState({}, document.title, window.location.pathname);
    if (_msCode) {
      // Store code temporarily — will exchange after auth loads
      sessionStorage.setItem('ms_pending_code', _msCode);
    }
  }
  setInterval(async () => { if (currentUser?.refresh_token) await refreshToken(); }, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && currentUser?.token) {
      await syncDown(); runCarryOver(); _lastCalDate = null; render(); reconcileCalendarTasks();
    }
  });
  // ── OAuth return ────────────────────────────────────────────────────────
  // Supabase sends the session back in the URL FRAGMENT, not the query string,
  // so it never reaches the server and nothing picks it up unless we look.
  // Without this the SSO buttons complete the provider dance and then dump the
  // user straight back on the login screen, which looks like the button is
  // broken. Runs before the stored-session check so a fresh sign-in wins over
  // a stale cached one.
  try {
    const frag = (window.location.hash || '').replace(/^#/, '');
    if (frag && frag.indexOf('access_token=') !== -1) {
      const q = new URLSearchParams(frag);
      const at = q.get('access_token'), rt = q.get('refresh_token');
      if (at) {
        // Identify the user from the token rather than trusting the fragment.
        const ur = await fetch(SB_URL + '/auth/v1/user', { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + at } });
        const u = await ur.json();
        if (u && u.id) {
          currentUser = { id: u.id, email: u.email, token: at, refresh_token: rt };
          localStorage.setItem('dt-user', JSON.stringify(currentUser));
          // The provider token is what actually reads the mailbox. Stash it so
          // the existing Gmail/Graph plumbing can adopt it instead of asking
          // the user to connect their mail a second time.
          const pt = q.get('provider_token'), prt = q.get('provider_refresh_token');
          if (pt) sessionStorage.setItem('sso_provider_token', pt);
          if (prt) sessionStorage.setItem('sso_provider_refresh_token', prt);
        }
      }
      // Strip the fragment so a refresh does not replay it and so the tokens
      // are not left sitting in the address bar.
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  } catch (_e) { /* fall through to the normal login screen */ }

  const saved = localStorage.getItem('dt-user');
  if (saved) {
    currentUser = JSON.parse(saved);
    // Always load profile from cache first so launchApp has role/org data
    const cachedProfile = localStorage.getItem('dt-profile-' + currentUser?.id);
    if (cachedProfile) { try { profile = JSON.parse(cachedProfile); } catch(e) {} }
    // Refresh token if we have one (non-blocking — launchApp runs after)
    if (currentUser?.refresh_token) {
      const ok = await refreshToken();
      if (!ok) { localStorage.removeItem('dt-user'); currentUser = null; registerSW(); return; }
    }
    const _finishLaunch = function() {
      const pendingCode = sessionStorage.getItem('ms_pending_code');
      if (pendingCode) {
        sessionStorage.removeItem('ms_pending_code');
        setTimeout(function() { handleMicrosoftCallback(pendingCode); }, 500);
      }
    };
    if (profile) {
      // Fast path: we already have a cached profile, so paint the app NOW and
      // refresh the profile from the network in the background. This removes a
      // blocking round-trip (and loadProfile's 5s timeout) from first paint.
      launchApp();
      _finishLaunch();
      loadProfile().then(function() { try { _applyRoleChrome(); } catch(e) {} });
    } else {
      // No cached profile — must load it before we can launch.
      await loadProfile();
      if (profile) { launchApp(); _finishLaunch(); }
      else { localStorage.removeItem('dt-user'); }
    }
  }
  registerSW();
})();

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner();
        });
      });
    }).catch(()=>{});
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'SW_UPDATED') showUpdateBanner();
    });
  }
}

function showUpdateBanner() {
  if (document.getElementById('st-update-banner')) return;
  const b = document.createElement('div');
  b.id = 'st-update-banner';
  b.innerHTML = '<div style="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--c-surface);border:1px solid var(--c-accent);padding:.65rem 1rem;border-radius:2px;display:flex;align-items:center;gap:.85rem;font-family:var(--font);font-size:13px;color:#D6CFC4;z-index:9999;box-shadow:var(--shadow-2);white-space:nowrap;animation:fadeIn .3s ease"><span><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> New version ready</span><button onclick="window.location.reload(true)" style="background:var(--c-accent);color:var(--c-canvas);border:none;padding:.28rem .75rem;border-radius:2px;cursor:pointer;font-size:12px;font-weight:500;font-family:var(--font)">Update</button><button onclick="document.getElementById(\'st-update-banner\').remove()" style="background:none;border:none;color:#78716C;cursor:pointer;font-size:14px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  document.body.appendChild(b);
  setTimeout(() => { if (b.parentNode) b.remove(); }, 12000);
}


// ══════════════════════════════════════════════════════════
// ACCOUNT INTELLIGENCE
// ══════════════════════════════════════════════════════════
var _intelData = null;
var _intelType = 'all';

async function refreshIntelligence() {
  var btn = document.getElementById('intelRefreshBtn');
  var feed = document.getElementById('intelFeed');
  var isManager = canSeeTeam(profile ? profile.role : '');
  var repFilterEl = document.getElementById('intelRepFilter');
  var repFilter = (isManager && repFilterEl) ? repFilterEl.value : '';
  if (btn) { btn.textContent = '↻ Scanning…'; btn.disabled = true; }
  if (feed) feed.innerHTML = '<div style="text-align:center;padding:48px 0;color:var(--text3);font-size:14px">Scanning ' + (repFilter ? 'this rep\'s' : 'your') + ' named accounts \u2014 AI signals + SAM pattern detection…</div>';

  var days = parseInt((document.getElementById('intelDaysFilter') || {}).value || '30') || 30;
  var aiData = null, samData = null, aiScopeError = false;

  // SAM (rule-based) scan — runs independently of AI quota/availability, so
  // it always has a chance to populate even when Gemini is exhausted.
  try {
    var rSam = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'local_intelligence', rep_user_id: repFilter || undefined })
    });
    samData = await rSam.json();
  } catch(e) { samData = { ok: false, error: e.message }; }

  // AI (Gemini) extraction — may fail on quota; that's fine, SAM results
  // above are unaffected and already captured.
  try {
    var rAi = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'extract_intelligence', days_back: days, rep_user_id: repFilter || undefined })
    });
    aiData = await rAi.json();
    if (aiData.scopeError) aiScopeError = true;
  } catch(e) { aiData = { ok: false, error: e.message }; }

  if (aiScopeError) {
    if (feed) feed.innerHTML = '<div style="text-align:center;padding:48px 0">' +
      '<div style="font-size:34px;margin-bottom:12px;opacity:0.5"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 10.5V7.5a5.5 5.5 0 0111 0v3M5 10.5h14v10H5z"/></svg></div>' +
      '<div style="font-size:14px;color:var(--text2);margin-bottom:6px;font-weight:600">Gmail permissions need to be re-granted</div>' +
      '<div style="font-size:12px;color:var(--text3);max-width:380px;margin:0 auto;line-height:1.6">' + esc(repFilter ? 'This rep\'s' : 'Your') + ' Gmail connection is missing read access. ' + esc(repFilter ? 'They need' : 'Go') + ' to the SAM tab and click "Connect Gmail" again to re-grant permissions \u2014 simply refreshing the token will not fix this.</div>' +
    '</div>';
    if (btn) { btn.textContent = '↻ Refresh'; btn.disabled = false; }
    return;
  }

  // Always load whatever intelligence now exists (AI rows, SAM rows, or
  // both) — SAM rows persist via local_intelligence even if AI failed.
  await loadIntelligence();

  // Build a status banner reflecting what actually happened in each path.
  var banners = '';
  if (samData && samData.ok && samData.count > 0) {
    banners += '<div style="background:rgba(74,140,92,0.08);border:1px solid rgba(74,140,92,0.25);border-radius:var(--radius);padding:10px 14px;margin-bottom:8px;font-size:12px;color:var(--text2)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> <strong style="color:var(--green)">SAM Intelligence</strong> \u2014 ' + samData.count + ' account' + (samData.count>1?'s':'') + ' scanned (no AI quota used)</div>';
  }
  if (aiData && aiData.geminiQuotaExhausted && aiData.message) {
    banners += '<div style="background:rgba(var(--c-accent-rgb),0.1);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 14px;margin-bottom:8px;font-size:12px;color:var(--text2);line-height:1.6">⏳ <strong style="color:var(--gold)">AI Tool Signals limited</strong> \u2014 ' + esc(aiData.message) + '</div>';
  } else if (aiData && aiData.ok && aiData.processed > 0) {
    banners += '<div style="background:rgba(var(--c-accent-rgb),0.08);border:1px solid rgba(var(--c-accent-rgb),0.25);border-radius:var(--radius);padding:10px 14px;margin-bottom:8px;font-size:12px;color:var(--text2)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8.5h10v9H7zM10 12.5v1M14 12.5v1M12 5v3.5M9.5 17.5v3M14.5 17.5v3M4.5 11.5v3M19.5 11.5v3"/></svg> <strong style="color:var(--gold)">AI Tool Signals</strong> \u2014 ' + aiData.processed + ' meeting' + (aiData.processed>1?'s':'') + ' analysed</div>';
  }
  if (banners && feed) {
    var bannerWrap = document.createElement('div');
    bannerWrap.innerHTML = banners;
    feed.insertBefore(bannerWrap, feed.firstChild);
  }
  if (btn) { btn.textContent = '↻ Refresh'; btn.disabled = false; }
}

function renderIntelDebug(data) {
  var debug = data.debug || [];
  if (data.geminiQuotaExhausted && data.message) {
    return '<div style="text-align:center;padding:48px 0;color:var(--text3);font-size:14px">' +
      '<div style="font-size:34px;margin-bottom:12px;opacity:0.5">⏳</div>' +
      '<div style="font-weight:600;color:var(--gold);margin-bottom:8px">Gemini quota limit reached</div>' +
      '<div style="max-width:420px;margin:0 auto;line-height:1.6;font-size:13px">' + esc(data.message) + '</div>' +
    '</div>';
  }
  if (data.message) {
    return '<div style="text-align:center;padding:48px 0;color:var(--text3);font-size:14px">' + esc(data.message) + '<br><span style="font-size:12px">Add accounts in Org \u2192 Rep Accounts</span></div>';
  }
  if (!debug.length) {
    return '<div style="text-align:center;padding:48px 0;color:var(--text3);font-size:14px">No notetaker emails found for your named accounts.<br><span style="font-size:12px">Processed: ' + (data.processed||0) + ' \u00b7 Skipped: ' + (data.skipped||0) + '</span></div>';
  }
  var rows = debug.map(function(d) {
    var parts = [];
    if (d.strictSearchFound !== undefined) parts.push('strict: ' + d.strictSearchFound + ', fallback: ' + d.fallbackSearchFound);
    if (d.notetakerEmailsFound !== undefined) parts.push('found: ' + d.notetakerEmailsFound + (d.usedFallback ? ' (fallback)' : ' (strict)'));
    if (d.geminiKeyMissing) parts.push('<span style="color:var(--coral)">Gemini API key not set</span>');
    if (d.geminiApiError) parts.push('<span style="color:var(--coral)">Gemini API error: ' + esc(JSON.stringify(d.geminiApiError)) + '</span>');
    if (d.geminiNoMatch) parts.push('<span style="color:var(--amber)">Gemini returned no JSON-shaped text' + (d.geminiFinishReason ? ' (finish: '+esc(d.geminiFinishReason)+')' : '') + '</span>');
    if (d.geminiJsonParseError) parts.push('<span style="color:var(--coral)">JSON parse failed: ' + esc(d.geminiJsonParseError) + (d.geminiFinishReason ? ' (finish: '+esc(d.geminiFinishReason)+')' : '') + '</span>');
    if (d.geminiRawText) parts.push('<span style="color:var(--text3);font-style:italic">raw: ' + esc(d.geminiRawText.slice(0,200)) + '\u2026</span>');
    if (d.geminiError) parts.push('<span style="color:var(--coral)">Gemini error: ' + esc(d.geminiError) + '</span>');
    if (d.dbInsertError) parts.push('<span style="color:var(--coral)">DB insert failed (' + d.status + '): ' + esc(d.dbInsertError) + '</span>');
    if (d.dbReadError) parts.push('<span style="color:var(--coral)">DB read failed: ' + esc(JSON.stringify(d.dbReadError)) + '</span>');
    if (d.gmailApiError) parts.push('<span style="color:var(--coral)">Gmail API error: ' + esc(JSON.stringify(d.gmailApiError)) + '</span>');
    if (d.subject) parts.push('subject: "' + esc(d.subject) + '"');
    return '<div style="background:var(--surface2);border-radius:2px;padding:10px 14px;margin-bottom:8px;text-align:left">' +
      '<div style="font-size:13px;font-weight:600;color:var(--text)">' + esc(d.account || '') + '</div>' +
      '<div style="font-size:12px;color:var(--text3);margin-top:4px;line-height:1.6">' + parts.join('<br>') + '</div>' +
    '</div>';
  }).join('');
  return '<div style="padding:24px 0">' +
    '<div style="text-align:center;color:var(--text3);font-size:14px;margin-bottom:16px">No intelligence extracted \u2014 here\'s why, per account:</div>' +
    rows +
  '</div>';
}

// ── Pipeline Intelligence ────────────────────────────────────────────────────
var _pipelineData = null;
var _pipelineView = 'combined';
var _pipelineDashTab = 'overview';
var _pipelineFilters = { tier: '', product: '', stream: '', region: '', rep: '' };

function setPipelineView(view) {
  _pipelineView = view;
  document.querySelectorAll('.pv-btn').forEach(function(b) { b.classList.remove('active'); });
  var btn = document.getElementById('pv-' + view);
  if (btn) btn.classList.add('active');
  if (_pipelineData) { renderPipelineChart(_pipelineData); renderPipelineDeals(_pipelineData); }
}

function setPipelineDashTab(tab) {
  var activeBtn = document.getElementById('pdt-' + tab);
  if (activeBtn && activeBtn.scrollIntoView) { try { activeBtn.scrollIntoView({ block:'nearest', inline:'center', behavior:'smooth' }); } catch(e) {} }
  _pipelineDashTab = tab;
  document.querySelectorAll('.pdt-btn').forEach(function(b) { b.classList.remove('active'); });
  var btn = document.getElementById('pdt-' + tab);
  if (btn) btn.classList.add('active');
  if (_pipelineData) renderPipelineDashboard(_pipelineData);
}

function applyPipelineFilters() {
  _pipelineFilters.tier    = document.getElementById('pipe-filter-tier')?.value    || '';
  _pipelineFilters.product = document.getElementById('pipe-filter-product')?.value || '';
  _pipelineFilters.stream  = document.getElementById('pipe-filter-stream')?.value  || '';
  _pipelineFilters.region  = document.getElementById('pipe-filter-region')?.value  || '';
  _pipelineFilters.rep     = document.getElementById('pipe-filter-rep')?.value     || '';
  if (_pipelineData) { renderPipelineDashboard(_pipelineData); renderPipelineChart(_pipelineData); renderPipelineDeals(_pipelineData); }
}

function clearPipelineFilters() {
  _pipelineFilters = { tier:'', product:'', stream:'', region:'', rep:'' };
  ['pipe-filter-tier','pipe-filter-product','pipe-filter-stream','pipe-filter-region','pipe-filter-rep'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  if (_pipelineData) { renderPipelineDashboard(_pipelineData); renderPipelineChart(_pipelineData); renderPipelineDeals(_pipelineData); }
}

function getFilteredDeals(data) {
  // The live pipeline = verified + partial + unverified (excludes won/lost)
  var all = [...(data.verified||[]), ...(data.partial||[]), ...(data.unverified||[])];
  return all.filter(function(d) {
    if (_pipelineFilters.tier && d.tier !== _pipelineFilters.tier) return false;
    if (_pipelineFilters.region && d.region !== _pipelineFilters.region) return false;
    if (_pipelineFilters.rep && d.rep_user_id !== _pipelineFilters.rep) return false;
    return true;
  });
}

function populatePipelineFilters(data) {
  // Reps dropdown
  var repSel = document.getElementById('pipe-filter-rep');
  if (repSel) {
    var repMap = {};
    var allDeals = [...(data.verified||[]), ...(data.partial||[]), ...(data.unverified||[])];
    allDeals.forEach(function(d) {
      if (d.rep_user_id && d.rep_email) repMap[d.rep_user_id] = d.rep_email.split('@')[0].replace(/\./g,' ').replace(/\b\w/g, function(c){return c.toUpperCase();});
    });
    repSel.innerHTML = '<option value="">All reps</option>' +
      Object.entries(repMap).map(function(e){ return '<option value="'+esc(e[0])+'">'+esc(e[1])+'</option>'; }).join('');
  }
  // Region dropdown
  var regSel = document.getElementById('pipe-filter-region');
  if (regSel) {
    var regions = {};
    var allDeals2 = [...(data.verified||[]), ...(data.partial||[]), ...(data.unverified||[])];
    allDeals2.forEach(function(d) { if (d.region) regions[d.region] = true; });
    regSel.innerHTML = '<option value="">All regions</option>' +
      Object.keys(regions).sort().map(function(r){ return '<option value="'+esc(r)+'">'+esc(r)+'</option>'; }).join('');
  }
  // Products dropdown — from productBreakdown in pipeline response
  var prodSel = document.getElementById('pipe-filter-product');
  if (prodSel) {
    var prodKeys = Object.keys(data.productBreakdown || {}).filter(function(k){ return k !== 'No product'; });
    prodSel.innerHTML = '<option value="">All products</option>' + prodKeys.map(function(p){ return '<option value="'+esc(p)+'">'+esc(p)+'</option>'; }).join('');
  }
  // Stream dropdown — from regionBreakdown deal_type breakdown
  var strmSel = document.getElementById('pipe-filter-stream');
  if (strmSel) {
    var strms = {};
    var allDeals3 = [...(data.verified||[]), ...(data.partial||[]), ...(data.unverified||[])];
    allDeals3.forEach(function(d) { if (d.deal_type) strms[d.deal_type] = true; });
    strmSel.innerHTML = '<option value="">All stages/streams</option>' + Object.keys(strms).sort().map(function(k){ return '<option value="'+esc(k)+'">'+esc(k)+'</option>'; }).join('');
  }
  var prodSel = document.getElementById('pipe-filter-product');
  if (prodSel && _orgProducts?.length) {
    var opts = '<option value="">All products</option>' +
      _orgProducts.map(function(p) { return '<option value="'+p.id+'">'+esc(p.name)+'</option>'; }).join('');
    prodSel.innerHTML = opts;
  }
  // Regions dropdown
  var regSel = document.getElementById('pipe-filter-region');
  if (regSel) {
    var regions = new Set();
    [...(data.verified||[]),(data.partial||[]),(data.unverified||[])].flat().forEach(function(d) { if (d.region) regions.add(d.region); });
    regSel.innerHTML = '<option value="">All regions</option>' +
      Array.from(regions).sort().map(function(r) { return '<option value="'+esc(r)+'">'+esc(r)+'</option>'; }).join('');
  }
  // Revenue stream types from org config
  var streamSel = document.getElementById('pipe-filter-stream');
  if (streamSel) {
    var streamTypes = window._orgConfig?.revenue_stream_types || [];
    streamSel.innerHTML = '<option value="">All revenue streams</option>' +
      streamTypes.map(function(s) { return '<option value="'+esc(s.key||s.label)+'">'+esc(s.label)+'</option>'; }).join('');
  }
}

function renderPipelineDashboard(data) {
  var el = document.getElementById('pipelineDashboard');
  if (!el) return;
  var fmtUsd = function(v) { return !v ? '$0' : v >= 1000000 ? '$'+(v/1000000).toFixed(1)+'M' : v >= 1000 ? '$'+Math.round(v/1000)+'K' : '$'+v; };
  var deals = getFilteredDeals(data);
  var html = '';

  if (_pipelineDashTab === 'byProduct') {
    html += renderByProductChart(deals, fmtUsd);
  } else if (_pipelineDashTab === 'byStream') {
    html += renderByStreamChart(deals, fmtUsd);
  } else if (_pipelineDashTab === 'byRegion') {
    if (canSeeTeam(profile?.role)) html += renderRepBreakdown(data, deals, fmtUsd);
  } else if (_pipelineDashTab === 'winloss') {
    html += renderWinLossChart(data, fmtUsd);
  } else if (_pipelineDashTab === 'attention') {
    html += renderAttentionPanel(deals, data, fmtUsd);
  } else {
    if (canSeeFullOrg(profile?.role)) html += renderExecInsights(data, deals, fmtUsd);
    else if (canSeeCrossTeam(profile?.role)) html += renderDirectorInsights(data, deals, fmtUsd);
    else if (canSeeTeam(profile?.role)) html += renderManagerInsights(data, deals, fmtUsd);
    else html += renderRepInsights(data, deals, fmtUsd);
  }

  el.innerHTML = html;
}

// ── Win / Loss summary ────────────────────────────────────────────────────────
function renderWinLossChart(data, fmtUsd) {
  var won  = (data.won  || []);
  var lost = (data.lost || []);
  if (!won.length && !lost.length) {
    return '<div style="text-align:center;padding:32px 0;color:var(--text3)">' +
      '<div style="font-size:26px;margin-bottom:10px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M9.5 20h5M12 14v6"/></svg></div>' +
      '<div style="font-size:14px;font-weight:500;color:var(--text2);margin-bottom:4px">No closed deals yet</div>' +
      '<div style="font-size:12px">Mark deals as Won or Lost using the close deal button on each pipeline card.</div>' +
    '</div>';
  }
  var wonVal  = won.reduce(function(s,d){return s+(d.actual_value_usd||d.deal_value_usd||0);},0);
  var lostVal = lost.reduce(function(s,d){return s+(d.actual_value_usd||d.deal_value_usd||0);},0);
  var total   = wonVal + lostVal;
  var winRate = won.length + lost.length > 0 ? Math.round(won.length / (won.length + lost.length) * 100) : 0;
  var html = '';
  // KPI strip
  html += '<div style="display:flex;gap:8px;margin-bottom:16px">' +
    kpi('Win rate', winRate + '%', winRate >= 50 ? 'var(--green)' : 'var(--amber)') +
    kpi('Deals won', won.length, 'var(--green)') +
    kpi('Deals lost', lost.length, 'var(--coral)') +
    kpi('Won value', fmtUsd(wonVal), 'var(--green)') +
  '</div>';
  // Win/loss bar
  if (total > 0) {
    var wonPct = Math.round(wonVal / total * 100);
    html += '<div style="margin-bottom:16px">' +
      '<div style="display:flex;height:14px;border-radius:2px;overflow:hidden;margin-bottom:4px">' +
        '<div style="width:'+wonPct+'%;background:var(--green)"></div>' +
        '<div style="flex:1;background:var(--coral)"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3)">' +
        '<span style="color:var(--green)">Won: '+fmtUsd(wonVal)+'</span>' +
        '<span style="color:var(--coral)">Lost: '+fmtUsd(lostVal)+'</span>' +
      '</div></div>';
  }
  // Won deals
  if (won.length) {
    html += '<div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M9.5 20h5M12 14v6"/></svg> Won deals</div>';
    won.forEach(function(d) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<span style="font-size:14px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M9.5 20h5M12 14v6"/></svg></span>' +
        '<div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--text)">'+esc(d.account)+'</div>' +
        '<div style="font-size:11px;color:var(--text3)">'+(d.close_reason?esc(d.close_reason):'')+(d.won_at?' · '+d.won_at.slice(0,10):'')+'</div></div>' +
        '<span style="font-size:12px;font-weight:600;color:var(--green)">'+fmtUsd(d.actual_value_usd||d.deal_value_usd||0)+'</span>' +
      '</div>';
    });
  }
  // Lost deals
  if (lost.length) {
    html += '<div style="font-size:11px;font-weight:700;color:var(--coral);text-transform:uppercase;letter-spacing:0.06em;margin:12px 0 8px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg> Lost deals</div>';
    lost.forEach(function(d) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<span style="font-size:14px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>' +
        '<div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--text)">'+esc(d.account)+'</div>' +
        '<div style="font-size:11px;color:var(--text3)">'+(d.close_reason?esc(d.close_reason):'')+(d.lost_at?' · '+d.lost_at.slice(0,10):'')+'</div></div>' +
        '<span style="font-size:12px;color:var(--text3)">'+fmtUsd(d.deal_value_usd||0)+'</span>' +
      '</div>';
    });
  }
  return html;
}

function kpi(label, val, color) {
  return '<div style="flex:1;background:var(--surface2);border-radius:3px;padding:10px;text-align:center">' +
    '<div style="font-size:20px;font-weight:700;color:'+(color||'var(--text)')+'">'+val+'</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+label+'</div></div>';
}

// ── Shared bar chart helper ────────────────────────────────────────────────
function mkBars(rows, maxVal, fmtUsd) {
  if (!rows.length) return '<div style="font-size:12px;color:var(--text3);padding:8px 0">No data</div>';
  var COLORS = ['#3A6EA8','#A07824','#4A8C5C','#C0523F','#7B5EA7','#2E8B8B'];
  return rows.map(function(r, i) {
    var pct = maxVal > 0 ? Math.max(4, r.val / maxVal * 100) : 4;
    var color = r.color || COLORS[i % COLORS.length];
    // Stacked bar: verified (green) + partial (amber) + unverified (grey) if breakdown available
    var barHtml;
    if (r.verified !== undefined) {
      var verPct = r.val > 0 ? r.verified / r.val * pct : 0;
      var parPct = r.val > 0 ? (r.partial || 0) / r.val * pct : 0;
      var unvPct = Math.max(0, pct - verPct - parPct);
      barHtml = '<div style="flex:1;height:10px;background:rgba(0,0,0,0.1);border-radius:2px;overflow:hidden;display:flex">' +
        (verPct>0?'<div style="height:100%;width:'+verPct+'%;background:#4A8C5C"></div>':'') +
        (parPct>0?'<div style="height:100%;width:'+parPct+'%;background:#A07824"></div>':'') +
        (unvPct>0?'<div style="height:100%;width:'+unvPct+'%;background:#888780"></div>':'') +
      '</div>';
    } else {
      barHtml = '<div style="flex:1;height:10px;background:rgba(0,0,0,0.1);border-radius:2px;overflow:hidden">' +
        '<div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:2px"></div>' +
      '</div>';
    }
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">' +
      '<div style="font-size:12px;color:var(--text2);width:76px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+esc(r.label)+'">'+esc(r.label)+'</div>' +
      barHtml +
      '<div style="font-size:12px;color:var(--text);font-weight:600;width:46px;text-align:right;flex-shrink:0">'+fmtUsd(r.val)+'</div>' +
      (r.count !== undefined ? '<div style="font-size:11px;color:var(--text3);width:22px;flex-shrink:0">'+r.count+'d</div>' : '') +
    '</div>';
  }).join('');
}

// ── Role header card wrapper ──────────────────────────────────────────────
function mkRoleCard(roleLabel, roleColor, title, subtitle, content) {
  var cardId = 'rolecard-' + Math.random().toString(36).slice(2,7);
  return '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;overflow:hidden;margin-bottom:10px" id="'+cardId+'">' +
    '<div style="padding:16px 18px 12px;border-bottom:1px solid var(--border)">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between">' +
        '<div>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
            '<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:3px;background:'+roleColor+';color:#fff">'+esc(roleLabel)+'</span>' +
          '</div>' +
          '<div style="font-size:16px;font-weight:700;color:var(--text)">'+esc(title)+'</div>' +
          '<div style="font-size:12px;color:var(--text3);font-style:italic;margin-top:2px">'+esc(subtitle)+'</div>' +
        '</div>' +
        '<div style="position:relative">' +
          '<button onclick="togglePipelineCardMenu(\''+cardId+'\')" style="font-size:20px;color:var(--text3);cursor:pointer;padding:4px 8px;background:none;border:none;border-radius:2px;line-height:1" title="Options">&#8943;</button>' +
          '<div id="menu-'+cardId+'" style="display:none;position:absolute;right:0;top:28px;background:var(--bg);border:1px solid var(--border2);border-radius:2px;box-shadow:var(--shadow-2);z-index:99;min-width:160px;padding:4px 0">' +
            '<button onclick="switchTab(\'pipeline\')" style="width:100%;text-align:left;padding:8px 14px;font-size:13px;color:var(--text);background:none;border:none;cursor:pointer;font-family:var(--sans)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V4M4 20h16M8 17V11M12.5 17V7.5M17 17v-4"/></svg> View pipeline</button>' +
            '<button onclick="setPipelineDashTab(\'attention\')" style="width:100%;text-align:left;padding:8px 14px;font-size:13px;color:var(--text);background:none;border:none;cursor:pointer;font-family:var(--sans)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Needs attention</button>' +
            '<button onclick="setPipelineDashTab(\'byRegion\')" style="width:100%;text-align:left;padding:8px 14px;font-size:13px;color:var(--text);background:none;border:none;cursor:pointer;font-family:var(--sans)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 000 18 14 14 0 000-18z"/></svg> By region</button>' +
 '<button onclick="setPipelineDashTab(\'byProduct\')" style="width:100%;text-align:left;padding:8px 14px;font-size:13px;color:var(--text);background:none;border:none;cursor:pointer;font-family:var(--sans)">By product</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div style="padding:16px 18px">'+content+'</div>' +
  '</div>';
}

function togglePipelineCardMenu(cardId) {
  var menu = document.getElementById('menu-'+cardId);
  if (!menu) return;
  var isOpen = menu.style.display !== 'none';
  // Close all other menus first
  document.querySelectorAll('[id^="menu-rolecard"]').forEach(function(m){ m.style.display='none'; });
  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    setTimeout(function(){ document.addEventListener('click', function handler(e){ menu.style.display='none'; document.removeEventListener('click',handler); }); }, 10);
  }
}

function mkMetricCard(label, value, sub, color) {
  return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:14px 16px">' +
    '<div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;font-weight:600">'+esc(label)+'</div>' +
    '<div style="font-size:26px;font-weight:700;color:'+(color||'var(--text)')+'">'+value+'</div>' +
    (sub ? '<div style="font-size:11px;color:var(--text3);margin-top:3px">'+esc(sub)+'</div>' : '') +
  '</div>';
}

function mkAlertRow(dot, text) {
  return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">' +
    (dot ? '<div style="width:8px;height:8px;border-radius:50%;background:'+dot+';flex-shrink:0"></div>' : '<div style="width:8px;height:8px;flex-shrink:0"></div>') +
    '<div style="font-size:13px;color:var(--text)">'+text+'</div>' +
  '</div>';
}

// ── AE / SDR ─────────────────────────────────────────────────────────────
function renderRepInsights(data, deals, fmtUsd) {
  var today = new Date();
  var verified = deals.filter(function(d){return d.tier==='verified';});
  var partial  = deals.filter(function(d){return d.tier==='partial';});
  var unverif  = deals.filter(function(d){return d.tier==='unverified';});
  var totalVal = deals.reduce(function(s,d){return s+d.deal_value_usd;},0);
  var closing  = deals.filter(function(d){
    if (!d.expected_close) return false;
    var dt=new Date(d.expected_close), qEnd=new Date(today.getFullYear(),Math.floor(today.getMonth()/3)*3+3,0);
    return dt<=qEnd;
  });
  var closingVal  = closing.reduce(function(s,d){return s+d.deal_value_usd;},0);
  var closingW    = closing.reduce(function(s,d){return s+d.weighted_value_usd;},0);
  var hot         = deals.filter(function(d){return (d.signal_score||0)>=60;});
  var attn        = deals.filter(function(d){return d.expected_close && new Date(d.expected_close)<today;});
  var needsAttn   = attn.length + unverif.filter(function(d){return d.deal_value_usd>5000;}).length;

  // By product bars
  var byProduct = {};
  var PCOLS = ['#3A6EA8','#A07824','#4A8C5C','#C0523F','#7B5EA7','#2E8B8B'];
  deals.forEach(function(d){var k=d.product_name||'No product';if(!byProduct[k])byProduct[k]={val:0,i:Object.keys(byProduct).length};byProduct[k].val+=d.deal_value_usd;});
  var productRows = Object.entries(byProduct).sort(function(a,b){return b[1].val-a[1].val;}).slice(0,5).map(function(e){return {label:e[0],val:e[1].val,color:PCOLS[e[1].i%PCOLS.length]};});
  var maxP = Math.max.apply(null,productRows.map(function(r){return r.val;})||[1]);

  // Action items
  var actionItems = [];
  attn.forEach(function(d){actionItems.push({dot:'var(--coral)',text:esc(d.account)+' \u2014 close date passed ('+d.expected_close+')'});});
  hot.slice(0,3).forEach(function(d){if(!attn.find(function(a){return a.id===d.id;}))actionItems.push({dot:'var(--amber)',text:esc(d.account)+' \u2014 score '+d.signal_score+' \uD83D\uDD25 follow up now'});});
  unverif.filter(function(d){return d.deal_value_usd>5000;}).slice(0,2).forEach(function(d){actionItems.push({dot:'var(--blue)',text:esc(d.account)+' \u2014 confirm AI hint '+fmtUsd(d.deal_value_usd)});});
  if (!actionItems.length) actionItems.push({dot:'var(--green)',text:'\u2705 No urgent actions \u2014 pipeline looks healthy'});

  var inner = '';

  // Top 3 metrics
  inner += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">' +
    mkMetricCard('My pipeline', fmtUsd(totalVal), verified.length+' verified \u00b7 '+partial.length+' partial \u00b7 '+unverif.length+' unverified', 'var(--text)') +
    mkMetricCard('Closing this quarter', fmtUsd(closingVal), closing.length+' deals \u00b7 weighted '+fmtUsd(closingW), 'var(--green)') +
    mkMetricCard('Needs attention', needsAttn.toString(), 'Going cold or past close', needsAttn>0?'var(--amber)':'var(--green)') +
  '</div>';

  // Product bars + action items side by side
  inner += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';

  if (productRows.length) {
    inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:14px 16px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px">Pipeline by product</div>' +
      mkBars(productRows, maxP, fmtUsd) +
    '</div>';
  }

  inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:14px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Action items</div>' +
    actionItems.slice(0,5).map(function(a){return mkAlertRow(a.dot,a.text);}).join('') +
  '</div>';

  inner += '</div>';

  return mkRoleCard('AE / SDR','#3B5BA5','My pipeline health','"Am I on track? What needs my attention today?"', inner);
}

// ── Manager ───────────────────────────────────────────────────────────────
function renderManagerInsights(data, deals, fmtUsd) {
  var today = new Date();
  var verified = deals.filter(function(d){return d.tier==='verified';});
  var verifiedVal = verified.reduce(function(s,d){return s+d.deal_value_usd;},0);
  var totalVal = deals.reduce(function(s,d){return s+d.deal_value_usd;},0);
  var pct = totalVal > 0 ? Math.round(verifiedVal/totalVal*100) : 0;
  var pctColor = pct>=50?'var(--green)':pct>=35?'var(--amber)':'var(--coral)';

  // Pipeline by rep — group by email, show first name only
  var byRep = {};
  deals.forEach(function(d){
    var email = d.rep_email || '';
    var name = email ? email.split('@')[0].split('.')[0] : (d.rep_user_id?.slice(0,6) || 'Unknown');
    name = name.charAt(0).toUpperCase() + name.slice(1); // capitalise
    if (!byRep[name]) byRep[name] = {val:0,verified:0,partial:0,count:0};
    byRep[name].val += d.deal_value_usd;
    byRep[name].count++;
    if (d.tier==='verified') byRep[name].verified += d.deal_value_usd;
    if (d.tier==='partial') byRep[name].partial += d.deal_value_usd;
  });
  var repRows = Object.entries(byRep).sort(function(a,b){return b[1].val-a[1].val;}).slice(0,8).map(function(e){
    var verPct = e[1].val>0?e[1].verified/e[1].val:0;
    var c = verPct>=0.5?'#4A8C5C':verPct>=0.3?'#A07824':'#888780';
    return {label:e[0], val:e[1].val, verified:e[1].verified, partial:e[1].partial, color:c, count:e[1].count};
  });
  var maxR = Math.max.apply(null, repRows.map(function(r){return r.val;})||[1]);

  // Coverage gaps
  var gaps = [];
  var noDeals = data.regionBreakdown?.filter(function(r){return r.verified_usd===0&&r.total_usd>0;}) || [];
  if (noDeals.length) noDeals.forEach(function(r){gaps.push({dot:'var(--coral)',text:esc(r.region)+' region \u2014 '+fmtUsd(r.total_usd)+' with zero verified deals'});});
  var atRisk = deals.filter(function(d){return d.expected_close&&new Date(d.expected_close)<today;});
  if (atRisk.length) gaps.push({dot:'var(--amber)',text:atRisk.length+' deal'+(atRisk.length>1?'s':'') + ' past expected close date across team'});
  var partial = deals.filter(function(d){return d.tier==='partial';});
  if (partial.length > deals.length*0.5) gaps.push({dot:'var(--amber)',text:'>50% of pipeline is partial \u2014 coach reps to run SAM signals'});
  var unverif = deals.filter(function(d){return d.tier==='unverified';});
  if (unverif.length) gaps.push({dot:'var(--blue)',text:unverif.length+' AI hints ('+fmtUsd(unverif.reduce(function(s,d){return s+d.deal_value_usd;},0))+') awaiting rep confirmation'});
  if (!gaps.length) gaps.push({dot:'var(--green)',text:'\u2705 No coverage gaps detected'});

  var inner = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';

  // Rep bars
  inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:14px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px">Pipeline by rep</div>' +
    (repRows.length ? mkBars(repRows, maxR, fmtUsd) : '<div style="font-size:12px;color:var(--text3)">No deal data yet</div>') +
    '<div style="display:flex;gap:10px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">' +
      '<div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:#4A8C5C"></div><span style="font-size:11px;color:var(--text3)">Verified</span></div>' +
      '<div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:#A07824"></div><span style="font-size:11px;color:var(--text3)">Partial</span></div>' +
      '<div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:#888780"></div><span style="font-size:11px;color:var(--text3)">Unverified</span></div>' +
    '</div>' +
  '</div>';

  // Coverage gaps
  inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:14px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Coverage gaps</div>' +
    gaps.slice(0,5).map(function(g){return mkAlertRow(g.dot,g.text);}).join('') +
  '</div>';

  inner += '</div>';

  // Bottom metrics
  inner += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
    '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:14px 16px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Verified pipeline (team)</div>' +
      '<div style="font-size:26px;font-weight:700;color:var(--green)">'+fmtUsd(verifiedVal)+'</div>' +
      '<div style="height:6px;background:rgba(0,0,0,0.15);border-radius:2px;margin:8px 0;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+pctColor+';border-radius:2px"></div></div>' +
      '<div style="font-size:11px;color:var(--text3)">'+pct+'% of total \u2014 target: 60%</div>' +
    '</div>' +
    mkMetricCard('Deals at risk', atRisk.length.toString(), 'Past close date or going cold', atRisk.length>0?'var(--coral)':'var(--green)') +
  '</div>';

  return mkRoleCard('Manager','#A07824','Team performance','"Who needs coaching? Where are the gaps?"', inner);
}

// ── Director ──────────────────────────────────────────────────────────────
function renderDirectorInsights(data, deals, fmtUsd) {
  var regions = (data.regionBreakdown || []).slice(0,5);
  var maxR = Math.max.apply(null, regions.map(function(r){return r.total_usd;})||[1]);
  var regionRows = regions.map(function(r,i){return {label:r.region,val:r.total_usd,color:['#3A6EA8','#A07824','#4A8C5C','#C0523F','#7B5EA7'][i%5]};});

  var verified = deals.filter(function(d){return d.tier==='verified';});
  var verifiedVal = verified.reduce(function(s,d){return s+d.deal_value_usd;},0);
  var totalVal = deals.reduce(function(s,d){return s+d.deal_value_usd;},0);
  var confPct = totalVal>0?Math.round(verifiedVal/totalVal*100):0;
  var weakRegions = regions.filter(function(r){return r.verified_usd===0;});

  var inner = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';

  inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:14px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px">Pipeline by region</div>' +
    (regionRows.length ? mkBars(regionRows, maxR, fmtUsd) : '<div style="font-size:12px;color:var(--text3)">No regional data</div>') +
  '</div>';

  var alerts = weakRegions.map(function(r){return {dot:'var(--coral)',text:esc(r.region)+' \u2014 '+fmtUsd(r.total_usd)+' with no verified deals'};});
  if (!alerts.length) alerts.push({dot:'var(--green)',text:'\u2705 All regions have verified pipeline'});
  inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:14px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Regional risk signals</div>' +
    alerts.map(function(a){return mkAlertRow(a.dot,a.text);}).join('') +
  '</div>';

  inner += '</div>';

  inner += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">' +
    mkMetricCard('Total pipeline', fmtUsd(totalVal), deals.length+' deals across '+regions.length+' regions', 'var(--text)') +
    mkMetricCard('Forecast confidence', confPct+'%', 'verified vs total pipeline', confPct>=50?'var(--green)':confPct>=35?'var(--amber)':'var(--coral)') +
    mkMetricCard('Regions with no verified deals', weakRegions.length.toString(), weakRegions.map(function(r){return r.region;}).join(', ')||'All clear', weakRegions.length?'var(--coral)':'var(--green)') +
  '</div>';

  return mkRoleCard('Director','#3B5BA5','Cross-team pipeline intelligence','"Where is growth coming from? Where is the risk?"', inner);
}

// ── CXO / Exec ────────────────────────────────────────────────────────────
function renderExecInsights(data, deals, fmtUsd) {
  var s = data.summary || {};
  var confPct = s.total_value_usd>0?Math.round(s.verified_value_usd/s.total_value_usd*100):0;
  var weightedPct = s.total_value_usd>0?Math.round(s.weighted_value_usd/s.total_value_usd*100):0;
  var pctColor = confPct>=50?'var(--green)':confPct>=35?'var(--amber)':'var(--coral)';

  // Product performance bars
  var byProduct = {};
  var PCOLS = ['#3A6EA8','#A07824','#4A8C5C','#C0523F','#7B5EA7'];
  deals.forEach(function(d){var k=d.product_name||'Unclassified';if(!byProduct[k])byProduct[k]={val:0,verified:0,i:Object.keys(byProduct).length};byProduct[k].val+=d.deal_value_usd;if(d.tier==='verified')byProduct[k].verified+=d.deal_value_usd;});
  var productRows = Object.entries(byProduct).sort(function(a,b){return b[1].val-a[1].val;}).slice(0,5).map(function(e){return {label:e[0],val:e[1].val,color:PCOLS[e[1].i%PCOLS.length]};});
  var maxP = Math.max.apply(null,productRows.map(function(r){return r.val;})||[1]);

  var inner = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">' +
    mkMetricCard('Total org pipeline', fmtUsd(s.total_value_usd||0), fmtUsd(s.weighted_value_usd||0)+' weighted \u00b7 '+fmtUsd(s.closing_this_quarter_usd||0)+' this quarter', 'var(--text)') +
    mkMetricCard('Forecast confidence', confPct+'%', 'of pipeline is fully verified', pctColor) +
    mkMetricCard('Win probability', weightedPct+'%', 'weighted vs total pipeline', 'var(--blue)') +
  '</div>';

  inner += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';

  if (productRows.length) {
    inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:14px 16px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px">Product line performance</div>' +
      mkBars(productRows, maxP, fmtUsd) +
    '</div>';
  }

  // Top risk signals
  var risks = [];
  var unverif = deals.filter(function(d){return d.tier==='unverified';});
  if (unverif.length) risks.push({dot:'var(--amber)',text:fmtUsd(unverif.reduce(function(s,d){return s+d.deal_value_usd;},0))+' unverified \u2014 awaiting rep confirmation'});
  var noVerRegions = (data.regionBreakdown||[]).filter(function(r){return r.verified_usd===0&&r.total_usd>0;});
  noVerRegions.forEach(function(r){risks.push({dot:'var(--coral)',text:esc(r.region)+' \u2014 '+fmtUsd(r.total_usd)+' pipeline, zero verified'});});
  var today = new Date();
  var atRisk = deals.filter(function(d){return d.expected_close&&new Date(d.expected_close)<today;});
  if (atRisk.length) risks.push({dot:'var(--coral)',text:atRisk.length+' deal'+(atRisk.length>1?'s':'')+' past close date \u2014 need exec review'});
  if (!risks.length) risks.push({dot:'var(--green)',text:'\u2705 No critical pipeline risks detected'});

  inner += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:14px 16px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Top risk signals</div>' +
    risks.slice(0,5).map(function(r){return mkAlertRow(r.dot,r.text);}).join('') +
  '</div>';

  inner += '</div>';

  return mkRoleCard('CXO / Exec','#4A8C5C','Org pipeline intelligence','"Are we going to hit the number? Where is the risk?"', inner);
}

// ── Attention panel ───────────────────────────────────────────────────────
function renderAttentionPanel(deals, data, fmtUsd) {
  var today = new Date();
  var alerts = [];
  deals.forEach(function(d) {
    if (d.expected_close && new Date(d.expected_close) < today)
      alerts.push({dot:'var(--coral)', text:esc(d.account)+' \u2014 close date passed ('+d.expected_close+')'});
  });
  var unverifiedHV = deals.filter(function(d){return d.tier==='unverified'&&d.deal_value_usd>5000;});
  if (unverifiedHV.length)
    alerts.push({dot:'var(--amber)',text:unverifiedHV.length+' high-value AI hints need confirmation \u2014 '+fmtUsd(unverifiedHV.reduce(function(s,d){return s+d.deal_value_usd;},0))+' at stake'});
  (data.regionBreakdown||[]).filter(function(r){return r.verified_usd===0&&r.total_usd>0;}).forEach(function(r){
    alerts.push({dot:'var(--amber)',text:esc(r.region)+' \u2014 '+fmtUsd(r.total_usd)+' pipeline with zero verified deals'});
  });
  if (!alerts.length)
    return '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:20px;text-align:center;color:var(--green);font-size:14px;font-weight:600">\u2705 No immediate attention items \u2014 pipeline looks healthy.</div>';

  return '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;overflow:hidden">' +
    '<div style="padding:14px 18px;border-bottom:1px solid var(--border)">' +
      '<div style="font-size:14px;font-weight:700;color:var(--text)">Action items</div>' +
      '<div style="font-size:12px;color:var(--text3);font-style:italic">'+alerts.length+' items need your attention</div>' +
    '</div>' +
    '<div style="padding:8px 18px">' +
      alerts.map(function(a){return mkAlertRow(a.dot,a.text);}).join('') +
    '</div>' +
  '</div>';
}

// ── CRM CSV Audit (Samora Intelligence — deterministic, no AI) ────────────────
var _crmAudit = null; // { headers, rawRows, mapping, results, summary, missing }

function openCrmImport() { document.getElementById('crmCsvInput')?.click(); }

// Minimal RFC-4180-ish CSV parser — handles quoted fields, embedded commas/newlines
function _parseCsv(text) {
  var rows = [], row = [], field = '', inQ = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Auto-detect CRM columns by header name — Zoho, HubSpot, Salesforce, Pipedrive variants
function _detectCrmColumns(headers) {
  // Pattern-priority search: most specific pattern wins across ALL headers,
  // and ID-ish columns (Account Name.id, ACCOUNTID…) are never picked.
  var find = function(patterns) {
    for (var p = 0; p < patterns.length; p++) {
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i].toLowerCase().trim();
        if (/(^|[^a-z])id$|\.id$|^id($|[^a-z])/.test(h)) continue;
        if (patterns[p].test(h)) return i;
      }
    }
    return -1;
  };
  return {
    name:          find([/^(deal|potential|opportunity)\s*name$/, /^deal$/, /^potential$/, /^opportunity$/, /deal.*name/, /potential.*name/]),
    account:       find([/^account\s*name$/, /^company(\s*name)?$/, /^organi[sz]ation$/, /account/, /company/]),
    stage:         find([/^stage$/, /deal.*stage/, /stage/]),
    amount:        find([/^amount$/, /^deal\s*value$/, /^value$/, /amount/, /revenue/]),
    close_date:    find([/clos(e|ing)\s*date/, /expected.*close/]),
    last_activity: find([/last\s*activity/, /modified\s*time/, /last\s*contacted/, /last\s*update/, /activity\s*date/]),
    owner:         find([/owner/, /deal\s*owner/, /assigned/]),
    email:         find([/^email$/, /contact.*email/, /e-?mail/])
  };
}

async function handleCrmCsv(file) {
  if (!file) return;
  var section = document.getElementById('crmAuditSection');
  var btn = document.getElementById('crmImportBtn');
  if (btn) { btn.textContent = '↻ Reading…'; btn.disabled = true; }
  try {
    var text = await file.text();
    var rows = _parseCsv(text);
    if (rows.length < 2) { showToast('CSV appears empty'); return; }
    var headers = rows[0];
    var map = _detectCrmColumns(headers);
    if (map.name === -1 && map.account === -1) { showToast('Could not find a deal/account name column'); return; }

    var payloadRows = rows.slice(1).filter(function(r){ return r.join('').trim(); }).slice(0, 200).map(function(r) {
      var get = function(idx){ return idx >= 0 ? (r[idx]||'').trim() : ''; };
      return { name: get(map.name) || get(map.account), account: get(map.account) || get(map.name),
        stage: get(map.stage), amount: get(map.amount), close_date: get(map.close_date),
        last_activity: get(map.last_activity), owner: get(map.owner), email: get(map.email) };
    });

    if (section) section.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:10px"><span style="animation:spin 1s linear infinite;display:inline-block">↻</span> Verifying ' + payloadRows.length + ' deals against Gmail, calendar & sequencing evidence…</div>';

    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'crm_verify', rows: payloadRows }) });
    var d = await r.json();
    if (!d.ok) { if (section) section.innerHTML = '<div style="font-size:12px;color:var(--coral);padding:10px">' + esc(d.error||'Verification failed') + '</div>'; return; }

    _crmAudit = { headers: headers, rawRows: rows.slice(1), mapping: map, results: d.results, summary: d.summary, missing: d.missing_from_crm || [], fileName: file.name };
    _renderCrmAudit();
  } catch(e) { showToast('CSV error: ' + e.message); }
  finally { if (btn) { btn.textContent = '⇪ CRM audit'; btn.disabled = false; } }
}

function _renderCrmAudit() {
  var section = document.getElementById('crmAuditSection');
  if (!section || !_crmAudit) return;
  var s = _crmAudit.summary;
  var statusMeta = {
    verified:      { col:'var(--green)', label:'Verified',     icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>' },
    cooling:       { col:'var(--amber)', label:'Cooling',      icon:'◐' },
    at_risk:       { col:'var(--coral)', label:'At risk',      icon:'<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg>' },
    no_evidence:   { col:'var(--coral)', label:'No evidence',  icon:'∅' },
    not_in_samora: { col:'var(--text3)', label:'Not tracked',  icon:'—' }
  };
  var html = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:14px">';
  // Branded header
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">';
  html += '<img src="icons/icon-48.png" alt="Samora" style="width:18px;height:18px;border-radius:50%"/>';
  html += '<span style="font-size:13px;font-weight:600;color:var(--text)">CRM Verification Report</span>';
  html += '<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;background:rgba(var(--c-accent-rgb),0.12);padding:2px 6px;border-radius:2px">Samora Intelligence</span>';
  html += '<span style="flex:1"></span>';
  html += '<button onclick="exportCrmEnriched()" style="padding:4px 12px;border-radius:3px;background:var(--gold);border:none;color:var(--c-canvas);font-family:var(--sans);font-size:11px;font-weight:600;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5M4.5 19.5h15"/></svg> Export enriched CSV</button>';
  html += '<button onclick="_crmAudit=null;document.getElementById(\'crmAuditSection\').innerHTML=\'\'" style="padding:4px 8px;border-radius:3px;background:var(--surface2);border:1px solid var(--border2);color:var(--text3);font-size:11px;cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  html += '</div>';
  // The headline — CRM says vs reality
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
  var chip = function(num, label, col) {
    return '<div style="flex:1;min-width:90px;background:var(--surface2);border-radius:2px;padding:8px 10px;text-align:center"><div style="font-size:16px;font-weight:700;color:' + col + '">' + num + '</div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">' + label + '</div></div>';
  };
  html += chip(s.total_rows, 'CRM deals', 'var(--text)');
  html += chip(s.verified, 'Verified ≤14d', 'var(--green)');
  html += chip(s.at_risk + s.cooling, 'Cooling / at risk', 'var(--amber)');
  html += chip(s.no_evidence, 'No evidence', 'var(--coral)');
  html += chip(s.trust_pct + '%', 'Pipeline you can trust', s.trust_pct >= 60 ? 'var(--green)' : 'var(--coral)');
  html += '</div>';
  if (s.deals_with_optimism_gap > 0) {
    html += '<div style="font-size:12px;color:var(--text2);background:rgba(192,82,63,0.08);border-left:3px solid var(--coral);border-radius:0 6px 6px 0;padding:8px 12px;margin-bottom:12px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/></svg> <strong>' + s.deals_with_optimism_gap + ' deal' + (s.deals_with_optimism_gap!==1?'s':'') + '</strong> show CRM activity more recent than any verified evidence — average gap <strong>' + s.avg_optimism_gap_days + ' days</strong>. This is the difference between what was logged and what actually happened.</div>';
  }
  // Table
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
  html += '<tr style="color:var(--text3);text-align:left"><th style="padding:5px 8px;font-weight:600">CRM deal</th><th style="padding:5px 8px;font-weight:600">CRM last activity</th><th style="padding:5px 8px;font-weight:600">Verified last contact</th><th style="padding:5px 8px;font-weight:600">Gap</th><th style="padding:5px 8px;font-weight:600">Days dark</th><th style="padding:5px 8px;font-weight:600">Status</th></tr>';
  _crmAudit.results.forEach(function(rw) {
    var m = statusMeta[rw.status] || statusMeta.not_in_samora;
    html += '<tr style="border-top:1px solid var(--border)">';
    html += '<td style="padding:6px 8px;color:var(--text);font-weight:500">' + esc(rw.crm_name) + (rw.matched && rw.samora_account !== rw.crm_name ? '<div style="font-size:11px;color:var(--text3)">→ ' + esc(rw.samora_account) + '</div>' : '') + '</td>';
    html += '<td style="padding:6px 8px;color:var(--text2)">' + esc(rw.crm_last_activity || '—') + '</td>';
    html += '<td style="padding:6px 8px;color:var(--text2)">' + esc(rw.samora_last_verified_contact || '—') + '</td>';
    html += '<td style="padding:6px 8px;color:' + (rw.gap_days > 7 ? 'var(--coral)' : 'var(--text2)') + ';font-weight:' + (rw.gap_days > 7 ? '700' : '400') + '">' + (rw.gap_days != null ? (rw.gap_days > 0 ? '+' : '') + rw.gap_days + 'd' : '—') + '</td>';
    html += '<td style="padding:6px 8px;color:var(--text2)">' + (rw.samora_days_dark != null ? rw.samora_days_dark + 'd' : '—') + '</td>';
    html += '<td style="padding:6px 8px"><span style="color:' + m.col + ';font-weight:600">' + m.icon + ' ' + m.label + '</span></td>';
    html += '</tr>';
  });
  html += '</table></div>';
  // Deals Samora tracks that the CRM is missing
  if (_crmAudit.missing.length) {
    html += '<div style="margin-top:10px;font-size:11px;color:var(--text3)">Also in Samora but not in this export: ' + _crmAudit.missing.map(function(x){ return esc(x.account); }).join(', ') + '</div>';
  }
  html += '</div>';
  section.innerHTML = html;
}

function exportCrmEnriched() {
  if (!_crmAudit) return;
  var q = function(v) { v = v == null ? '' : String(v); return (v.indexOf(',') >= 0 || v.indexOf('"') >= 0 || v.indexOf('\n') >= 0) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var extra = ['samora_status','samora_health_score','samora_signal_score','samora_last_verified_contact','samora_days_dark','samora_gap_days','samora_champion_identified','samora_seq_touchpoints','samora_seq_replies'];
  var out = _crmAudit.headers.map(q).join(',') + ',' + extra.join(',') + '\n';
  _crmAudit.rawRows.forEach(function(raw, i) {
    var rw = _crmAudit.results[i];
    var extras = rw ? [rw.status, rw.samora_health_score, rw.samora_signal_score, rw.samora_last_verified_contact, rw.samora_days_dark, rw.gap_days, rw.samora_champion_identified, rw.seq_touchpoints, rw.seq_replies] : ['','','','','','','','',''];
    out += raw.map(q).join(',') + ',' + extras.map(q).join(',') + '\n';
  });
  var blob = new Blob([out], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (_crmAudit.fileName || 'crm').replace(/\.csv$/i, '') + '_samora_verified.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── SDR pipeline-generation panel ─────────────────────────────────────────────
// SDRs carry generation targets, not revenue targets. This panel credits the
// SDR's real work: net-new stakeholders brought into discussion + attributed pipeline.
async function loadSdrPanel() {
  var panel = document.getElementById('sdrGenPanel');
  if (!panel) return;
  if ((profile?.role||'').toLowerCase() !== 'sdr') { panel.innerHTML = ''; return; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'get_sdr_stats', days: 30 }) });
    var d = await r.json();
    if (!d.ok) { panel.innerHTML = ''; return; }
    var chip = function(num, label, col) {
      return '<div style="flex:1;min-width:80px;background:var(--surface2);border-radius:3px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:700;color:'+(col||'var(--text)')+'">'+num+'</div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-top:2px">'+label+'</div></div>';
    };
    var pipeK = d.pipeline_generated_usd >= 1000000 ? '$'+(d.pipeline_generated_usd/1000000).toFixed(1)+'M' : '$'+Math.round(d.pipeline_generated_usd/1000)+'K';
    var html = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:14px;margin-bottom:14px">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">';
    html += '<img src="icons/icon-48.png" style="width:16px;height:16px;border-radius:50%"/>';
    html += '<span style="font-size:13px;font-weight:600;color:var(--text);flex:1">Pipeline Generation · last 30 days</span>';
    html += '<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;background:rgba(var(--c-accent-rgb),0.12);padding:2px 6px;border-radius:2px">SDR</span>';
    html += '</div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
    html += chip(d.new_prospects, 'New stakeholders contacted', 'var(--text)');
    html += chip(d.new_prospects_engaged, 'Brought into discussion', 'var(--green)');
    html += chip(d.engagement_rate + '%', 'Engagement rate', d.engagement_rate >= 10 ? 'var(--green)' : 'var(--amber)');
    html += chip(d.new_companies_touched, 'New companies', 'var(--text)');
    html += '</div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    html += chip(pipeK, 'Pipeline generated', 'var(--gold)');
    html += chip(d.pipeline_generated_deals, 'Deals sourced', 'var(--gold)');
    html += chip(d.accounts_sourced_period, 'Sourced this period', 'var(--text)');
    html += '</div>';
    if (d.recent_new_engaged && d.recent_new_engaged.length) {
      html += '<div style="margin-top:10px;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">↩ Newest stakeholders in discussion</div>';
      html += '<div style="display:flex;gap:5px;flex-wrap:wrap">';
      d.recent_new_engaged.forEach(function(p) {
        html += '<span style="font-size:11px;padding:3px 9px;border-radius:2px;background:rgba(74,140,92,0.1);color:var(--green)">'+esc(p.name)+(p.company?' · '+esc(p.company):'')+'</span>';
      });
      html += '</div>';
    }
    if (!d.pipeline_generated_deals) {
      html += '<div style="margin-top:8px;font-size:11px;color:var(--text3)">Pipeline attribution comes from the AE/manager tagging "SDR sourced this" on a deal.</div>';
    }
    html += '</div>';
    panel.innerHTML = html;
  } catch(e) { panel.innerHTML = ''; }
}

// ── SDR Playground ────────────────────────────────────────────────────────────
// SDRs see the deals their team's AEs/managers are working on, can create new
// leads (scoutable prospective accounts), and generate prospective contacts with
// the same scout flow AEs use. Team = everyone under the SDR's manager_id, plus
// the manager. Leads = accounts where they are the assigned SDR (sdr_user_id).
window._sdrDeals = {};
function _sdrDealCard(a, kind) {
  var v = a.deal_value_usd ? (a.deal_value_usd>=1e6 ? '$'+(a.deal_value_usd/1e6).toFixed(1)+'M' : '$'+Math.round(a.deal_value_usd/1e3)+'K') : '';
  var owner = (a._owner_email||'').split('@')[0];
  var meta = [a.region?esc(a.region):'', owner?('AE: '+esc(owner)):'', v].filter(Boolean).join(' · ');
  return '<div onclick="openSdrScout(\''+esc(a.id)+'\',\''+esc(a.account_name)+'\')" style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:10px 12px;margin-bottom:6px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px">' +
    '<div style="min-width:0"><div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(a.account_name)+(kind==='lead'?' <span style="font-size:11px;font-weight:700;color:var(--gold);background:rgba(var(--c-accent-rgb),0.12);border-radius:2px;padding:1px 5px;vertical-align:middle">MY LEAD</span>':'')+'</div>' +
    (meta?'<div style="font-size:11px;color:var(--text3);margin-top:2px">'+meta+'</div>':'') + '</div>' +
    '<div style="font-size:11px;color:var(--gold);flex-shrink:0;white-space:nowrap"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Scout ›</div></div>';
}
async function loadSdrPlayground() {
  var panel = document.getElementById('sdrPlayground');
  if (!panel) return;
  // Lead sourcing only — SAMpaign (manual campaigns + analytics) moved to
  // the SAM tab (see loadSampaignWorkspace), open to sdr/ae/manager there,
  // since outreach belongs alongside the rest of SAM Agent's signal
  // intelligence, not tucked into the Pipeline tab. This container stays
  // SDR-only: sourcing leads for AEs to work is a distinct concept from
  // running outreach on them.
  if ((profile?.role||'').toLowerCase() !== 'sdr') { panel.innerHTML = ''; return; }
  panel.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">Loading your team\'s deals…</div>';
  window._sdrDeals = {};
  try {
    var org = profile.org_id, mgr = profile.manager_id || null;
    // Team = peers under my manager + the manager themselves.
    var teamIds = [];
    var emailById = {};
    if (mgr) {
      var peers = await sbGet('user_profiles?org_id=eq.'+org+'&manager_id=eq.'+mgr+'&select=user_id,email,role');
      (peers||[]).forEach(function(p){ if (p.user_id !== currentUser.id) { teamIds.push(p.user_id); emailById[p.user_id]=p.email; } });
      teamIds.push(mgr);
      try { var mgrRow = await sbGet('user_profiles?user_id=eq.'+mgr+'&select=user_id,email&limit=1'); if (mgrRow&&mgrRow[0]) emailById[mgr]=mgrRow[0].email; } catch(e){}
    }
    // My leads (I'm the assigned SDR).
    var myLeads = await sbGet('org_accounts?org_id=eq.'+org+'&sdr_user_id=eq.'+currentUser.id+'&select=id,account_name,domain,region,deal_value_usd,user_id,sdr_user_id&order=account_name');
    // Team deals (owned by an AE/manager on my team), excluding ones I already source.
    var teamDeals = [];
    if (teamIds.length) {
      teamDeals = await sbGet('org_accounts?org_id=eq.'+org+'&user_id=in.('+teamIds.join(',')+')&deal_status=not.in.(won,lost)&select=id,account_name,domain,region,deal_value_usd,user_id,sdr_user_id&order=account_name&limit=100') || [];
    }
    var mine = (myLeads||[]);
    var mineIds = new Set(mine.map(function(a){return a.id;}));
    teamDeals = teamDeals.filter(function(a){ return !mineIds.has(a.id); });
    teamDeals.forEach(function(a){ a._owner_email = emailById[a.user_id] || ''; });
    mine.concat(teamDeals).forEach(function(a){ window._sdrDeals[a.id] = { id:a.id, account:a.account_name, deal_value_usd:a.deal_value_usd||0, stage:'prospective', region:a.region||'' }; });

    var html = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:14px;margin-bottom:14px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><span style="font-size:13px;font-weight:600;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z"/></svg> Lead Sourcing</span>' +
      '<button onclick="toggleSdrLeadForm()" id="sdrNewLeadBtn" style="font-size:11px;font-weight:600;padding:5px 12px;border-radius:2px;background:var(--gold);border:none;color:var(--c-canvas);cursor:pointer;font-family:var(--sans)">+ New lead</button></div>';
    // Create-lead form (hidden by default)
    html += '<div id="sdrLeadForm" style="display:none;background:var(--surface2);border-radius:3px;padding:10px;margin-bottom:12px">' +
      '<div style="display:flex;flex-direction:column;gap:6px">' +
      '<input id="sdrLeadName" placeholder="Company / account name" style="padding:8px 10px;border:1px solid var(--border);border-radius:2px;background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/>' +
      '<div style="display:flex;gap:6px"><input id="sdrLeadDomain" placeholder="domain.com" style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:2px;background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/>' +
      '<input id="sdrLeadRegion" placeholder="Region (e.g. APAC)" style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:2px;background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/></div>' +
      '<div style="font-size:11px;color:var(--text3)">Domain powers contact scouting; region keeps prospects geo-consistent.</div>' +
      '<button onclick="createSdrLead()" style="padding:9px;border:none;border-radius:2px;background:var(--gold);color:var(--c-canvas);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--sans)">Create lead &amp; open</button>' +
      '</div></div>';
    // My leads
    html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:4px 0 6px">My leads ('+mine.length+')</div>';
    html += mine.length ? mine.map(function(a){ return _sdrDealCard(a,'lead'); }).join('') : '<div style="font-size:11px;color:var(--text3);padding:2px 0 8px">No leads yet. Create one to start scouting contacts.</div>';
    // Team deals
    html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 6px">Team deals ('+teamDeals.length+')</div>';
    html += teamDeals.length ? teamDeals.map(function(a){ return _sdrDealCard(a,'team'); }).join('') : '<div style="font-size:11px;color:var(--text3);padding:2px 0">' + (mgr?'No open deals on your team yet.':'You are not linked to a manager yet, so no team deals to show. Ask your manager to assign you.') + '</div>';
    html += '</div>';
    panel.innerHTML = html;
  } catch(e) { panel.innerHTML = '<div style="font-size:11px;color:var(--coral);padding:6px 0">Could not load playground: '+esc(e.message)+'</div>'; }
}

// ── Manual SAMpaigns (no sequencing tool) ───────────────────────────────────
// Lets an AE/SDR/Manager run outreach entirely inside Samora — create a
// campaign, set a follow-up cadence, upload a contact list (CSV — same
// convention as the existing CRM-audit upload, no new client-side library),
// log status per contact, and let sam-cron's run_sampaign_followups handle
// the reminders. Deliberately separate from tool-synced SAMpaign Analytics
// (get_sequencing_stats): different data, different alert engine, kept
// honest rather than blended into one number.
window._sampaignExpanded = {};
window._sampaignContactsCache = {};

// Renders the role-gated "My SAMpaigns" create-form + list into
// #sampaignManualSection (inside the #sampaignWorkspace card on the SAM
// tab's Signal sub-tab). Manager sees their own + direct reports' campaigns
// (list_sampaigns is already role-tiered the same way get_sequencing_stats
// is — self/team/org via canSeeTeam/canSeeCrossTeam/canSeeFullOrg), so no
// backend change was needed for "manager should see the team's analytics
// too" — this was purely a frontend wiring gap.
// ═══════════════════════════════════════════════════════════════════════════
// SAMpaign SCHEDULER — write once, queue it, let it go out on time.
//
// Sends leave from the rep's own Gmail via a narrow server action, so they
// land at the scheduled minute whether or not anyone is logged in. The queue
// deliberately shows every individual recipient BEFORE anything is sent:
// scheduled outbound that you cannot inspect in advance is how accidents
// happen.
// ═══════════════════════════════════════════════════════════════════════════
var _SAMPAIGN_SEND_VARS = [
  { k: '{{first_name}}', d: 'First name only' },
  { k: '{{name}}',       d: 'Full name' },
  { k: '{{company}}',    d: 'Company' },
  { k: '{{title}}',      d: 'Job title' }
];

function openSampaignComposer(campaignId) {
  document.getElementById('sampaign-composer-modal')?.remove();
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var all = (window._sampaignContactsCache || {})[campaignId] || [];
  var sendable = all.filter(function(x){ return x.email && x.status === 'not_contacted'; });
  var noEmail = all.filter(function(x){ return !x.email; }).length;

  // Default to the next weekday at 9am. A default that lands on Saturday, or
  // three minutes from now, is a trap.
  var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);

  var m = document.createElement('div');
  m.id = 'sampaign-composer-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);z-index:100000;display:flex;align-items:flex-end;justify-content:center';
  m.innerHTML = '<div style="background:var(--bg);border-radius:3px 18px 0 0;width:100%;max-width:640px;max-height:92vh;overflow-y:auto;padding:20px" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">' +
      '<div><div style="font-size:16px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Schedule outreach</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(c.name||'SAMpaign')+' · sends from your own Gmail</div></div>' +
      '<button onclick="document.getElementById(\'sampaign-composer-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3);padding:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +
    (sendable.length
      ? '<div style="font-size:11px;color:var(--text2);background:var(--surface2);border-radius:2px;padding:8px 10px;margin-bottom:10px">Will queue <strong>'+sendable.length+'</strong> contact'+(sendable.length!==1?'s':'')+' who have an email and have not been contacted yet.'+(noEmail?' <span style="color:var(--gold)">'+noEmail+' skipped, no email yet.</span>':'')+'</div>'
      : '<div style="font-size:11px;color:var(--coral);background:rgba(196,90,74,0.08);border-radius:2px;padding:8px 10px;margin-bottom:10px">No contacts are ready to send to. They need an email address and a "Not contacted" status.</div>') +
    '<input id="sampSendSubject" placeholder="Subject" style="width:100%;box-sizing:border-box;padding:9px 11px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:13px;margin-bottom:6px"/>' +
    '<textarea id="sampSendBody" rows="9" placeholder="Hi {{first_name}},&#10;&#10;..." style="width:100%;box-sizing:border-box;padding:9px 11px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:13px;resize:vertical;line-height:1.5"></textarea>' +
    '<div style="display:flex;gap:5px;flex-wrap:wrap;margin:7px 0">' +
      '<span style="font-size:11px;color:var(--text3);align-self:center">Insert:</span>' +
      _SAMPAIGN_SEND_VARS.map(function(v){
        return '<span onclick="_sampInsertVar(\''+v.k+'\')" title="'+esc(v.d)+'" style="cursor:pointer;font-size:11px;font-family:var(--mono,monospace);color:var(--gold);background:rgba(var(--c-accent-rgb),0.1);border:1px solid rgba(var(--c-accent-rgb),0.25);border-radius:2px;padding:3px 7px">'+esc(v.k)+'</span>';
      }).join('') +
    '</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:10px">Filled in per person at send time, so anything Enrich finds between now and then is used. A variable with no value becomes blank, never the raw {{tag}}.</div>' +
    // Which wave this copy belongs to. Follow-ups already have a date on the
    // campaign, so picking one here also fixes when it goes out.
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">' +
      '<span style="font-size:11px;color:var(--text3)">Wave</span>' +
      '<select id="sampSendLaunch" onchange="_sampComposerLaunchChanged(\''+esc(campaignId)+'\')" style="padding:6px 9px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px">' +
        (function(){
          var dates = (c.followup_dates||[]).map(function(x){ return String(x).slice(0,10); }).sort();
          var opts = '<option value="1">Initial send</option>';
          dates.forEach(function(dt, i) {
            opts += '<option value="'+(i+2)+'">Follow-up '+(i+1)+' · '+new Date(dt+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})+'</option>';
          });
          return opts;
        })() +
      '</select>' +
      '<span id="sampSendLaunchHint" style="font-size:11px;color:var(--text3)"></span>' +
    '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
      '<span style="font-size:11px;color:var(--text3)">Start</span>' +
      '<input type="date" id="sampSendDate" value="'+dateKey(d)+'" style="padding:7px 9px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<input type="time" id="sampSendTime" value="09:00" style="padding:7px 9px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<span id="sampSendWhen" style="font-size:11px;color:var(--text3)"></span>' +
    '</div>' +
    '<div id="sampSendWeekendWarn"></div>' +
    '<div id="sampSendLimit" style="margin-top:8px"></div>' +
    '<button onclick="submitSampaignSchedule(\''+esc(campaignId)+'\')" '+(sendable.length?'':'disabled')+' style="width:100%;margin-top:10px;padding:11px;border-radius:3px;background:'+(sendable.length?'var(--green)':'var(--border2)')+';border:none;color:#fff;font-size:14px;font-weight:700;cursor:'+(sendable.length?'pointer':'not-allowed')+';font-family:var(--sans)">Prepare '+(sendable.length||0)+' email'+(sendable.length!==1?'s':'')+'</button>' +
    '<div id="sampSendQueue" style="margin-top:14px"></div>' +
  '</div>';
  m.addEventListener('click', function(){ m.remove(); });
  document.body.appendChild(m);
  ['sampSendDate','sampSendTime'].forEach(function(id){
    document.getElementById(id)?.addEventListener('change', _sampSendWhenHint);
  });
  _sampSendWhenHint();
  loadSampaignSendQueue(campaignId);
  _loadSendingLimit();
}

// Today's allowance, shown BEFORE anyone writes anything. A limit discovered
// by being refused reads as a broken tool — which is exactly how this
// surfaced with Prachi.
async function _loadSendingLimit() {
  var box = document.getElementById('sampSendLimit');
  if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'get_sending_limit' }) });
    var d = await r.json();
    if (!d.ok) { box.innerHTML = ''; return; }
    var used = (d.sent_today || 0) + (d.queued_today || 0);
    var pct = d.today_limit ? Math.min(100, Math.round((used / d.today_limit) * 100)) : 0;
    box.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:9px 11px">' +
      '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
        '<span style="font-size:11px;font-weight:600;color:var(--text)">'+d.remaining_today+' of '+d.today_limit+' left to send today</span>' +
        '<span style="font-size:11px;color:var(--text3)">'+esc(d.reason||'')+'</span>' +
      '</div>' +
      '<div style="height:4px;border-radius:2px;background:var(--border2);margin-top:6px;overflow:hidden">' +
        '<div style="height:100%;width:'+pct+'%;background:'+(pct>=100?'var(--coral)':'var(--gold)')+'"></div>' +
      '</div>' +
      // Stated plainly because both of these are things a rep would otherwise
      // learn by being surprised: the budget is shared with follow-ups, and
      // going over delays rather than drops.
      '<div style="font-size:11px;color:var(--text3);margin-top:6px;line-height:1.5">First emails and follow-ups share this number. Anything over it moves to the next day, nothing is lost. Your limit rises as the mailbox builds a sending history.</div>' +
    '</div>';
  } catch(e) { box.innerHTML = ''; }
}

function _sampSendWhenHint() {
  var dv = document.getElementById('sampSendDate')?.value;
  var tv = document.getElementById('sampSendTime')?.value || '09:00';
  var warn = document.getElementById('sampSendWeekendWarn');
  var hint = document.getElementById('sampSendWhen');
  if (!dv) return;
  var dt = new Date(dv + 'T' + tv);
  if (hint) hint.textContent = isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'short' });
  // Same weekend honesty as the follow-up picker: flag it, never override.
  if (warn) {
    var wknd = dt.getDay() === 0 || dt.getDay() === 6;
    warn.innerHTML = wknd ? '<div style="font-size:11px;color:var(--coral);margin-top:2px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> That is a weekend. Fine if deliberate, worth a second look if not.</div>' : '';
  }
}

function _sampInsertVar(v) {
  var ta = document.getElementById('sampSendBody');
  if (!ta) return;
  var s = ta.selectionStart || 0, e = ta.selectionEnd || 0;
  ta.value = ta.value.slice(0, s) + v + ta.value.slice(e);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = s + v.length;
}

async function submitSampaignSchedule(campaignId) {
  var subject = document.getElementById('sampSendSubject')?.value?.trim();
  var body = document.getElementById('sampSendBody')?.value;
  var dv = document.getElementById('sampSendDate')?.value;
  var tv = document.getElementById('sampSendTime')?.value || '09:00';
  if (!subject) { showToast('Add a subject'); return; }
  if (!body || !body.trim()) { showToast('Add a message'); return; }
  if (!dv) { showToast('Pick a date'); return; }
  var when = new Date(dv + 'T' + tv);
  if (isNaN(when.getTime())) { showToast('That date/time is not valid'); return; }
  if (when.getTime() < Date.now()) { showToast('That time has already passed'); return; }

  var all = (window._sampaignContactsCache || {})[campaignId] || [];
  var sendable = all.filter(function(x){ return x.email && x.status === 'not_contacted'; });
  if (!sendable.length) { showToast('No contacts ready to send to'); return; }

  // Two steps on purpose, and the same two the AI path uses: write drafts,
  // then schedule them through the warm-up engine. This used to call
  // schedule_sampaign_send, which stamped ONE identical send time on every
  // recipient — the whole campaign leaving in the same minute, which is what
  // gets a mailbox suspended. Template sends now get the same spreading,
  // the same review step and the same daily cap as personalised ones.
  var launch = parseInt(document.getElementById('sampSendLaunch')?.value || '1', 10) || 1;
  try {
    var drafts = sendable.map(function(c){ return { contact_id: c.id, subject: subject, body: body }; });
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'save_sampaign_drafts', campaign_id: campaignId, drafts: drafts, generated_by: 'template', personalised: false, launch: launch }) });
    var d = await r.json();
 if (!d.ok) { showToast('' + (d.error || 'Could not prepare')); return; }
 showToast('Prepared ' + d.saved + ', now pick the schedule');
    window._sampLaunch = launch;
    loadSampaignSendQueue(campaignId);
    // Straight into the same dry-run preview, seeded with the time chosen
    // above, so the person sees the real multi-day plan before committing.
    planSampaignDrafts(campaignId, when.toISOString(), launch);
  } catch(e) { showToast('Error: ' + e.message); }
}

// A follow-up already has a date on the campaign, so choosing that wave sets
// the start date too rather than leaving two controls that can disagree.
function _sampComposerLaunchChanged(campaignId) {
  var n = parseInt(document.getElementById('sampSendLaunch')?.value || '1', 10) || 1;
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var hint = document.getElementById('sampSendLaunchHint');
  var dateEl = document.getElementById('sampSendDate');
  if (n === 1) { if (hint) hint.textContent = ''; return; }
  var dates = (c.followup_dates || []).map(function(x){ return String(x).slice(0,10); }).sort();
  var dt = dates[n - 2];
  if (dt && dateEl) { dateEl.value = dt; _sampSendWhenHint(); }
  if (hint) hint.textContent = dt ? 'Date taken from the campaign schedule' : 'No date set for this follow-up yet';
}

// Drafts written by an AI tool via the connector. Reviewed here BEFORE
// anything is scheduled: copy that goes straight from a model into a send
// queue means the first human to read it is the prospect.
function _renderSampaignDrafts(campaignId, drafts) {
  if (!drafts.length) return '';
  var byTool = {};
  drafts.forEach(function(d){ var k = d.generated_by || 'ai'; byTool[k] = (byTool[k]||0)+1; });
  // One shared body sent to everyone is not personalisation, and calling it
  // that in the review header would be a small lie that compounds.
  var anyPersonalised = drafts.some(function(d){ return d.personalised; });
  var label = anyPersonalised ? 'personalised draft' : 'draft';
  return '<div style="border:1px solid rgba(var(--c-accent-rgb),0.3);border-radius:3px;padding:11px;margin-bottom:10px;background:rgba(var(--c-accent-rgb),0.05)">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;flex-wrap:wrap">' +
      '<span style="font-size:11px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3z"/></svg> '+drafts.length+' '+label+(drafts.length!==1?'s':'')+' to review</span>' +
      '<span style="font-size:11px;color:var(--text3)">'+Object.keys(byTool).map(function(k){ return esc(k)+' · '+byTool[k]; }).join(', ')+'</span>' +
      '<span onclick="cancelSampaignSends(\''+esc(campaignId)+'\',null,\'Discard all '+drafts.length+' draft'+(drafts.length!==1?'s':'')+'? The copy is deleted and cannot be recovered.\')" style="margin-left:auto;font-size:11px;color:var(--coral);cursor:pointer">Discard all</span>' +
      '<span onclick="planSampaignDrafts(\''+esc(campaignId)+'\',null,window._sampLaunch)" style="font-size:11px;font-weight:600;color:var(--gold);cursor:pointer">Preview send plan →</span>' +
    '</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:7px">Nothing sends until you schedule it. Click a draft to read and edit it.</div>' +
    drafts.slice(0, 40).map(function(x) {
      return '<div style="border-top:1px solid var(--border);padding:6px 0">' +
        '<div onclick="_toggleDraft(\''+esc(x.id)+'\')" style="cursor:pointer;display:flex;gap:7px;align-items:baseline">' +
          '<span style="font-size:11px;font-weight:600;color:var(--text);flex-shrink:0">'+esc(x.name||x.email||'—')+'</span>' +
          '<span style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.subject||'')+'</span>' +
          (x.edited_by_human ? '<span style="font-size:11px;color:var(--green);flex-shrink:0;margin-left:auto">edited</span>' : '') +
        '</div>' +
        '<div id="draft_'+esc(x.id)+'" style="display:none;margin-top:6px">' +
          '<input id="draftSubj_'+esc(x.id)+'" value="'+esc(x.subject||'')+'" style="width:100%;box-sizing:border-box;padding:6px 8px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:11px;margin-bottom:4px"/>' +
          '<textarea id="draftBody_'+esc(x.id)+'" rows="7" style="width:100%;box-sizing:border-box;padding:6px 8px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:11px;line-height:1.5;resize:vertical">'+esc(x.body||'')+'</textarea>' +
          '<div style="display:flex;gap:6px;margin-top:4px">' +
            '<button onclick="saveSampaignDraftEdit(\''+esc(campaignId)+'\',\''+esc(x.id)+'\')" style="font-size:11px;font-weight:600;padding:5px 10px;border-radius:2px;background:var(--green);border:none;color:#fff;cursor:pointer;font-family:var(--sans)">Save edit</button>' +
            '<span onclick="cancelSampaignSends(\''+esc(campaignId)+'\',\''+esc(x.id)+'\')" style="font-size:11px;color:var(--coral);cursor:pointer;align-self:center">Discard</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}
function _toggleDraft(id) {
  var el = document.getElementById('draft_'+id);
  if (!el) return;
  var open = el.style.display === 'none';
  el.style.display = open ? 'block' : 'none';
  // The chevron is the only persistent signal of which row is open once the
  // body has scrolled, so it turns rather than staying static.
  var chev = document.getElementById('chev_'+id);
  if (chev) chev.style.transform = open ? 'rotate(180deg)' : '';
  var row = chev && chev.parentElement;
  if (row && row.classList) row.classList.toggle('open', open);
}
// Edits go through update_sampaign_scheduled_send, NOT save_sampaign_drafts.
// The latter writes status='draft' with a null send_at, so using it to fix a
// typo in a queued email would silently un-schedule it — the send would just
// stop happening, with no symptom until someone noticed the mail never
// arrived. This updates the text in place and leaves status and send time
// exactly as they were.
async function saveSampaignDraftEdit(campaignId, sendId) {
  var subject = document.getElementById('draftSubj_'+sendId)?.value?.trim();
  var body = document.getElementById('draftBody_'+sendId)?.value;
  if (!subject || !body || !body.trim()) { showToast('Subject and body are both needed'); return; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'update_sampaign_scheduled_send', send_id: sendId, subject: subject, body: body }) });
    var d = await r.json();
 if (!d.ok) { showToast('' + (d.error||'Could not save')); return; }
 showToast('' + (d.note || 'Updated'));
    loadSampaignSendQueue(campaignId);
  } catch(e) { showToast('Error: '+e.message); }
}

// dry_run first, always. Committing a multi-day send plan without showing it
// is exactly the surprise this feature exists to prevent.
async function planSampaignDrafts(campaignId, startAt, launch) {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'schedule_sampaign_drafts', campaign_id: campaignId, start_at: startAt || null, launch: launch || window._sampLaunch || 1, dry_run: true }) });
    var d = await r.json();
 if (!d.ok) { showToast('' + (d.error||'Could not plan')); return; }
    var days = Object.keys(d.per_day||{}).sort();
    var lines = days.map(function(k){ return k + ': ' + d.per_day[k]; }).join('\n');
    var first = d.first_send ? new Date(d.first_send).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
    var last  = d.last_send  ? new Date(d.last_send).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
    var msg = d.scheduled + ' emails over ' + d.days + ' day' + (d.days!==1?'s':'') + '\n\n' +
      lines + '\n\n' +
      'First: ' + first + '\nLast:  ' + last + '\n\n' +
      // Why this many today, in the rep's words rather than policy numbers.
      'Today you can send ' + (d.today_limit || d.policy.daily_cap) + ' (' + (d.ramp_reason || 'current limit') + ').\n' +
      (d.overrode_ramp ? 'You asked for more than the suggested number, so this overrides it.\n' : '') +
      'Sending window ' + d.policy.window_start_hour + ':00-' + d.policy.window_end_hour + ':00' + (d.policy.skip_weekends ? ', weekdays only' : '') + '.\n\n' +
      'First emails and follow-ups share the same daily number. Spreading them out protects the mailbox — sending a whole campaign at once is what gets inboxes blocked.\n\nSchedule these now?';
    if (!confirm(msg)) return;
    var r2 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'schedule_sampaign_drafts', campaign_id: campaignId, start_at: startAt || null, launch: launch || window._sampLaunch || 1 }) });
    var d2 = await r2.json();
 if (!d2.ok) { showToast('' + (d2.error||'Could not schedule')); return; }
 showToast('Scheduled ' + d2.scheduled + ' over ' + d2.days + ' day' + (d2.days!==1?'s':''));
    loadSampaignSendQueue(campaignId);
  } catch(e) { showToast('Error: '+e.message); }
}

// Which wave is being viewed. Null means "the first one that has anything",
// resolved on load, so opening Launches lands somewhere useful rather than on
// an empty wave 1 after the initial send has gone out.
window._sampLaunch = null;
function setSampLaunch(campaignId, n) {
  window._sampLaunch = n;
  loadSampaignSendQueue(campaignId);
}

// Sub-tab strip: one per wave the campaign can have. A wave with nothing in
// it is still shown but dimmed, because "follow-up 2 exists and is empty" is
// information — it is the prompt to go and write it.
function _renderLaunchTabs(campaignId, byLaunch, maxLaunch) {
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var dates = (c.followup_dates || []).map(function(d){ return String(d).slice(0,10); }).sort();
  var out = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">';
  for (var n = 1; n <= maxLaunch; n++) {
    var rows = byLaunch[n] || [];
    var on = window._sampLaunch === n;
    var drafts = rows.filter(function(x){ return x.status === 'draft'; }).length;
    // Launch 1 is the initial send and has no follow-up date; waves above it
    // are dated by the campaign's own follow-up schedule.
    var when = n === 1 ? '' : (dates[n-2] ? new Date(dates[n-2]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : 'no date set');
    out += '<span onclick="setSampLaunch(\''+esc(campaignId)+'\','+n+')" style="cursor:pointer;font-size:11px;padding:6px 11px;border-radius:2px;' +
      'border:1px solid '+(on?'var(--gold)':'var(--border2)')+';background:'+(on?'rgba(var(--c-accent-rgb),0.09)':'transparent')+';' +
      'color:'+(rows.length?'var(--text)':'var(--text3)')+'">' +
      '<span style="font-weight:'+(on?'700':'600')+'">'+(n===1?'Initial send':'Follow-up '+(n-1))+'</span>' +
      (when ? '<span style="color:var(--text3)"> · '+esc(when)+'</span>' : '') +
      (drafts ? '<span style="font-size:11px;font-weight:700;background:rgba(var(--c-accent-rgb),0.16);color:var(--gold);border-radius:2px;padding:1px 5px;margin-left:5px">'+drafts+' to review</span>'
              : (rows.length ? '<span style="color:var(--text3);font-size:11px"> · '+rows.length+'</span>' : '<span style="color:var(--text3);font-size:11px"> · empty</span>')) +
    '</span>';
  }
  out += '</div>';
  return out;
}

async function loadSampaignSendQueue(campaignId) {
  var box = document.getElementById('sampSendQueue');
  if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'list_sampaign_scheduled_sends', campaign_id: campaignId }) });
    var d = await r.json();
    var all = (d.ok && d.sends) ? d.sends : [];

    // Group by wave. How many waves exist is a property of the CAMPAIGN
    // (initial send + one per follow-up date), not of what happens to be in
    // the table — otherwise an unwritten follow-up would be invisible and
    // there would be nothing to click to go and write it.
    var camp = (window._sampaignCampaignsCache || {})[campaignId] || {};
    var maxLaunch = Math.max(1, ((camp.followup_dates || []).length + 1),
                             all.reduce(function(m,x){ return Math.max(m, x.launch||1); }, 1));
    var byLaunch = {};
    all.forEach(function(x){ var n = x.launch || 1; (byLaunch[n] = byLaunch[n] || []).push(x); });

    // Land on the wave that needs attention: first with drafts, else first
    // with anything, else wave 1.
    if (window._sampLaunch == null) {
      var withDrafts = null, withAny = null;
      for (var n = 1; n <= maxLaunch; n++) {
        var rows = byLaunch[n] || [];
        if (!withDrafts && rows.some(function(x){ return x.status === 'draft'; })) withDrafts = n;
        if (!withAny && rows.length) withAny = n;
      }
      window._sampLaunch = withDrafts || withAny || 1;
    }

    // Badge counts drafts across ALL waves — it is asking "does anything need
    // reviewing", which is not a per-wave question.
    window._sampDraftCount = window._sampDraftCount || {};
    window._sampDraftCount[campaignId] = all.filter(function(x){ return x.status === 'draft'; }).length;
    try { _renderSampTabs(campaignId); } catch(e) {}

    var tabsHtml = _renderLaunchTabs(campaignId, byLaunch, maxLaunch);
    var mine = byLaunch[window._sampLaunch] || [];

    if (!mine.length) {
      box.innerHTML = tabsHtml +
        '<div style="text-align:center;padding:24px 16px;border:1px dashed var(--border2);border-radius:3px">' +
          '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Nothing written for this wave yet</div>' +
          '<div style="font-size:11px;color:var(--text3);line-height:1.55">Use Schedule below to write it yourself, or ask Claude to draft one email per person for '+
            (window._sampLaunch === 1 ? 'the initial send' : 'follow-up ' + (window._sampLaunch - 1)) + '.</div>' +
        '</div>';
      return;
    }

    d.sends = mine;
    // Drafts are shown separately and above: they need a decision, the queue
    // is just a record of one already made.
    var draftRows = d.sends.filter(function(x){ return x.status === 'draft'; });
    d.sends = d.sends.filter(function(x){ return x.status !== 'draft'; });
    var draftHtml = _renderSampaignDrafts(campaignId, draftRows);
    if (!d.sends.length) { box.innerHTML = tabsHtml + draftHtml; return; }
    var META = {
      pending:   { label:'Queued',    color:'var(--gold)' },
      sent:      { label:'Sent',      color:'var(--green)' },
      failed:    { label:'Failed',    color:'var(--coral)' },
      cancelled: { label:'Cancelled', color:'var(--text3)' }
    };
    // Summary counts the WAVE being viewed, not the campaign, so the numbers
    // agree with the rows underneath them.
    var s = { pending:0, sent:0, failed:0, cancelled:0 };
    d.sends.forEach(function(x){ s[x.status] = (s[x.status]||0) + 1; });
    box.innerHTML = tabsHtml + draftHtml +
      // Hover state makes the rows read as clickable before anyone clicks.
      '<style>.samp-send-row:hover{background:var(--surface)}.samp-send-row.open{background:var(--surface)}</style>' +
      '<div style="border-top:1px solid var(--border);padding-top:11px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">' +
        '<span style="font-size:11px;font-weight:700;color:var(--text)">Queue</span>' +
        Object.keys(META).filter(function(k){ return s[k]; }).map(function(k){
          return '<span style="font-size:11px;font-weight:600;color:'+META[k].color+'">'+s[k]+' '+META[k].label.toLowerCase()+'</span>';
        }).join('<span style="color:var(--text3)">·</span>') +
        (s.pending ? '<span onclick="cancelSampaignSends(\''+esc(campaignId)+'\',null)" style="margin-left:auto;font-size:11px;color:var(--coral);cursor:pointer">Cancel all queued</span>' : '') +
      '</div>' +
      // Grouped by send day. A flat list of 48 rows spanning four dates makes
      // the reader parse every timestamp to work out where one day ends; a
      // date header answers "what goes out on Monday" at a glance, which is
      // the question someone reviewing a queue actually has.
      (function() {
        var rows = d.sends.slice(0, 120);
        var groups = [], lastKey = null;
        rows.forEach(function(x) {
          // The null check has to come first: new Date(null) is the epoch,
          // not an invalid date, so an undated row would silently group under
          // "Thu 1 Jan 1970" instead of being called out as having no date.
          var dt = x.send_at ? new Date(x.send_at) : null;
          var key = (!dt || isNaN(dt.getTime())) ? 'nodate' : dt.toISOString().slice(0, 10);
          if (key !== lastKey) { groups.push({ key: key, date: dt, items: [] }); lastKey = key; }
          groups[groups.length - 1].items.push(x);
        });
        return groups.map(function(g) {
          var head = g.key === 'nodate' ? 'No date' :
            g.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          return '<div style="display:flex;align-items:baseline;justify-content:space-between;margin:14px 0 4px">' +
              '<span style="font-size:11px;font-weight:700;color:var(--text2)">'+esc(head)+'</span>' +
              '<span style="font-size:11px;color:var(--text3)">'+g.items.length+' email'+(g.items.length!==1?'s':'')+'</span>' +
            '</div>' +
            g.items.map(function(x) {
              var mm = META[x.status] || META.pending;
              var when = new Date(x.send_at);
              // A manager can READ a report's queued email but not change it —
              // same read/write split as everywhere else in SAMpaign. This
              // previously required ownership even to open the row, so a
              // manager saw 48 unopenable lines with no indication why.
              var editable = (x.status === 'pending') && d.is_owner;
              var readable = true;
              var who = x.name || x.email || '—';
              var initial = String(who).trim().charAt(0).toUpperCase() || '?';
              return '<div class="samp-send-row" onclick="_toggleDraft(\''+esc(x.id)+'\')" ' +
                  'style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:3px;cursor:pointer;transition:background .12s">' +
                  '<span style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:var(--surface);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text3)">'+esc(initial)+'</span>' +
                  '<span style="min-width:0;flex:1">' +
                    '<span style="display:block;font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(who)+'</span>' +
                    '<span style="display:block;font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(x.email||'')+'</span>' +
                  '</span>' +
                  '<span style="font-size:11px;color:var(--text3);white-space:nowrap;flex-shrink:0">'+(isNaN(when.getTime())?'':when.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}))+'</span>' +
                  '<span style="font-size:11px;font-weight:700;color:'+mm.color+';background:rgba(128,128,128,0.10);border-radius:2px;padding:2px 7px;white-space:nowrap;flex-shrink:0">'+mm.label+'</span>' +
                  (editable ? '<span onclick="event.stopPropagation();cancelSampaignSends(\''+esc(campaignId)+'\',\''+esc(x.id)+'\')" style="cursor:pointer;color:var(--text3);font-size:13px;flex-shrink:0;padding:0 2px" title="Cancel this one"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>' : '') +
                  '<span id="chev_'+esc(x.id)+'" style="font-size:11px;color:var(--text3);flex-shrink:0;transition:transform .15s">▾</span>' +
                '</div>' +
                '<div id="draft_'+esc(x.id)+'" style="display:none;padding:2px 10px 12px 46px">' +
                  (editable
                    ? '<input id="draftSubj_'+esc(x.id)+'" value="'+esc(x.subject||'')+'" style="width:100%;box-sizing:border-box;padding:7px 9px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px;font-weight:600;margin-bottom:5px"/>' +
                      '<textarea id="draftBody_'+esc(x.id)+'" rows="8" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px;line-height:1.6;resize:vertical">'+esc(x.body||'')+'</textarea>' +
                      '<div style="display:flex;gap:9px;align-items:center;margin-top:6px">' +
                        '<button onclick="event.stopPropagation();saveSampaignDraftEdit(\''+esc(campaignId)+'\',\''+esc(x.id)+'\')" style="font-size:11px;font-weight:600;padding:6px 13px;border-radius:2px;background:var(--green);border:none;color:#fff;cursor:pointer;font-family:var(--sans)">Save edit</button>' +
                        '<span style="font-size:11px;color:var(--text3)">Send time stays the same</span>' +
                      '</div>'
                    // Read-only for sent, cancelled, and for anyone who is not
                    // the owner. An editable box on delivered mail would let
                    // the UI show corrected text the recipient never received.
                    : '<div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:5px">'+esc(x.subject||'')+'</div>' +
                      '<div style="font-size:12px;color:var(--text2);white-space:pre-wrap;line-height:1.6;background:var(--surface);border-radius:2px;padding:10px 12px;border:1px solid var(--border)">'+esc(x.body||'')+'</div>' +
                      '<div style="font-size:11px;color:var(--text3);margin-top:5px">'+
                        (x.status==='sent' ? 'Already sent, read only'
                         : x.status==='cancelled' ? 'Cancelled, never sent'
                         : !d.is_owner ? 'Read only — this is '+esc((camp.owner_email||'the owner').split('@')[0])+'’s campaign'
                         : 'Read only')+'</div>') +
                '</div>' +
                (x.error ? '<div style="font-size:11px;color:var(--coral);padding:0 10px 8px 46px">'+esc(x.error)+'</div>' : '');
            }).join('');
        }).join('');
      })() +
    '</div>';
  } catch(e) { box.innerHTML = ''; }
}

async function cancelSampaignSends(campaignId, sendId, confirmMsg) {
  var payload = sendId
    ? { action:'cancel_sampaign_scheduled_send', send_ids:[sendId] }
    : { action:'cancel_sampaign_scheduled_send', campaign_id: campaignId, all_pending: true };
  if (!sendId && !confirm(confirmMsg || 'Cancel every queued email for this SAMpaign?')) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify(payload) });
    var d = await r.json();
 if (!d.ok) { showToast('' + (d.error||'Could not cancel')); return; }
    // Drafts are deleted, queued sends are cancelled — report whichever
    // actually happened rather than always saying "cancelled 0", which is
    // what the old version did for drafts.
    var parts = [];
    if (d.discarded) parts.push(d.discarded + ' draft' + (d.discarded!==1?'s':'') + ' discarded');
    if (d.cancelled) parts.push(d.cancelled + ' queued cancelled');
 showToast(parts.length ? '' + parts.join(', ') : 'Nothing to remove');
    loadSampaignSendQueue(campaignId);
  } catch(e) { showToast('Error: ' + e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECTIVE SAM — person intelligence from whatever you happen to know.
//
// Backed by detective_sam_lookup, which searches the org's OWN data first
// (stakeholders, SAMpaign contacts) before spending a provider credit. An
// address that came from real correspondence beats a pattern-inferred guess
// and costs nothing, so internal always wins and every field is labelled
// with where it came from.
// ═══════════════════════════════════════════════════════════════════════════
// She, not he — the reference character is female. Long wavy hair, lashes,
// lip, earring. The gold S is her TIE, drawn large and high enough in the
// collar V to sit fully inside the clip circle: the first version put it at
// the very bottom edge, where the circular mask ate it.
// viewBox is cropped around the circle rather than rescaled, so the geometry
// is identical to what was reviewed.
function _detectiveSamAvatar(size) {
  var s = size || 44, cid = 'dsC' + s;
  return '<svg width="'+s+'" height="'+s+'" viewBox="190 10 300 300" style="flex-shrink:0;display:block">' +
    '<defs><clipPath id="'+cid+'"><circle cx="340" cy="160" r="150"/></clipPath>' +
      '<linearGradient id="h'+cid+'" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#3B2A1E"/><stop offset="38%" stop-color="#6B4A2E"/>' +
        '<stop offset="72%" stop-color="#A87C4C"/><stop offset="100%" stop-color="#CDA470"/>' +
      '</linearGradient></defs>' +
    '<circle cx="340" cy="160" r="150" fill="#F2E9DC"/>' +
    '<g clip-path="url(#'+cid+')">' +
      '<path d="M246 148 Q246 50 340 46 Q434 50 434 148 L434 206 Q434 220 414 222 L266 222 Q246 220 246 206 Z" fill="#2E2016" opacity="0.55"/>' +
      '<path d="M252 148 Q252 56 340 52 Q428 56 428 148 L428 200 Q428 214 410 216 L270 216 Q252 214 252 200 Z" fill="url(#h'+cid+')"/>' +
      '<path d="M252 210 Q252 120 300 100 L318 108 Q272 132 268 212 Z" fill="#2E2016" opacity="0.28"/>' +
      '<path d="M270 104 Q306 66 372 72 Q412 78 420 104 Q384 84 336 92 Q296 99 278 122 Z" fill="url(#h'+cid+')"/>' +
      '<path d="M262 300 Q268 236 300 214 L340 246 L380 214 Q412 236 418 300 Z" fill="#7B4E2C"/>' +
      '<path d="M300 214 L340 246 L380 214 L380 300 L300 300 Z" fill="#FBF8F3"/>' +
      '<path d="M304 212 L340 244 L322 300 L300 300 Z" fill="#E7E1D6"/>' +
      '<path d="M376 212 L340 244 L358 300 L380 300 Z" fill="#E7E1D6"/>' +
      '<path d="M316 246 L364 246 L352 300 L328 300 Z" fill="#3B2A1B"/>' +
      '<path d="M320 172 L360 172 L360 206 L320 206 Z" fill="#E8BE9E"/>' +
      '<ellipse cx="340" cy="130" rx="51" ry="57" fill="#F2CDAC"/>' +
      '<circle cx="316" cy="128" r="21" fill="#26211C"/>' +
      '<circle cx="364" cy="128" r="21" fill="#26211C"/>' +
      '<path d="M303 116 Q311 109 322 114 Q311 120 306 128 Z" fill="#FFFFFF" opacity="0.5"/>' +
      '<path d="M351 116 Q359 109 370 114 Q359 120 354 128 Z" fill="#FFFFFF" opacity="0.5"/>' +
      '<circle cx="325" cy="137" r="3.5" fill="#FFFFFF" opacity="0.28"/>' +
      '<circle cx="373" cy="137" r="3.5" fill="#FFFFFF" opacity="0.28"/>' +
      '<circle cx="316" cy="128" r="21" fill="none" stroke="#0F0D0B" stroke-width="2.5"/>' +
      '<circle cx="364" cy="128" r="21" fill="none" stroke="#0F0D0B" stroke-width="2.5"/>' +
      '<path d="M337 128 L343 128" stroke="#26211C" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M295 126 L278 119" stroke="#26211C" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M385 126 L402 119" stroke="#26211C" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M328 164 Q340 157 352 164 Q340 177 328 164 Z" fill="#C05F5C"/>' +
      '<circle cx="293" cy="150" r="6" fill="#E8B84B"/>' +
      '<ellipse cx="340" cy="72" rx="94" ry="17" fill="#7A4A2A"/>' +
      '<path d="M278 74 Q282 20 340 16 Q398 20 402 74 Z" fill="#8A5A38"/>' +
      '<path d="M278 68 Q340 84 402 68 L402 76 Q340 92 278 76 Z" fill="#5E3620"/>' +
      '<path d="M354 168 Q396 176 406 200" stroke="#4A2E1C" stroke-width="8" fill="none" stroke-linecap="round"/>' +
      '<path d="M396 200 Q396 232 420 232 Q444 232 444 200 Z" fill="#5E3A22"/>' +
      '<ellipse cx="420" cy="200" rx="24" ry="7" fill="#3A2314"/>' +
      '<path d="M416 180 Q404 164 420 150 Q436 136 424 120" stroke="#D6CDC1" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>' +
      '<text x="340" y="300" text-anchor="middle" font-family="Georgia,serif" font-size="66" font-weight="700" fill="#C8961E">S</text>' +
      '<text x="340" y="297" text-anchor="middle" font-family="Georgia,serif" font-size="66" font-weight="700" fill="#F0C660">S</text>' +
    '</g>' +
    '<circle cx="340" cy="160" r="150" fill="none" stroke="#C8961E" stroke-width="6"/>' +
  '</svg>';
}

// The branding chip on its own. _samoraIntelLabel(text) interpolates its
// argument, so calling it with none rendered the literal string "undefined"
// next to the logo — that was the stray word in the header.
function _samoraIntelChip() {
  return '<span style="display:inline-flex;align-items:center;gap:6px">' +
    '<img src="icons/icon-48.png" alt="Samora" style="width:15px;height:15px;border-radius:50%;flex-shrink:0"/>' +
    '<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;background:rgba(var(--c-accent-rgb),0.12);padding:2px 6px;border-radius:2px;white-space:nowrap">Samora Intelligence</span>' +
  '</span>';
}

function _magnifierIcon(sz, col) {
  var s = sz || 14;
  return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="'+(col||'currentColor')+'" stroke-width="2.4" stroke-linecap="round" style="flex-shrink:0"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 L21 21"/></svg>';
}

function detectiveSamCardHtml() {
  return '<div style="background:var(--surface2);border:1px solid rgba(var(--c-accent-rgb),0.28);border-radius:3px;padding:12px;margin-bottom:14px">' +
    '<div style="display:flex;align-items:center;gap:11px">' +
      _detectiveSamAvatar(46) +
      '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">' +
          '<span style="font-size:14px;font-weight:700;color:var(--text)">Detective SAM</span>' +
          _samoraIntelChip() +
        '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">Find anyone: LinkedIn, emails, phone numbers, current and past employers.</div>' +
      '</div>' +
      '<button onclick="openDetectiveSam()" style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:8px 14px;border-radius:3px;background:var(--c-accent-solid);border:none;color:#2A1F0C;cursor:pointer;font-family:var(--sans);flex-shrink:0">' +
        _magnifierIcon(14, '#2A1F0C') + 'Investigate</button>' +
    '</div>' +
  '</div>';
}

window._dsResult = null;

function openDetectiveSam() {
  document.getElementById('detective-sam-modal')?.remove();
  var m = document.createElement('div');
  m.id = 'detective-sam-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);z-index:100000;display:flex;align-items:flex-end;justify-content:center';
  m.innerHTML = '<div style="background:var(--bg);border-radius:3px 18px 0 0;width:100%;max-width:640px;max-height:92vh;overflow-y:auto;padding:20px" onclick="event.stopPropagation()">' +
    '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">' +
      _detectiveSamAvatar(52) +
      '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span style="font-size:16px;font-weight:700;color:var(--text)">Detective SAM</span>'+_samoraIntelChip()+'</div>' +
        '<div style="font-size:13px;color:var(--text2);margin-top:3px">Who do you wish to get intelligence on?</div>' +
      '</div>' +
      '<button onclick="document.getElementById(\'detective-sam-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3);padding:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:7px">Fill in whatever you know. More detail means a better match, a company domain helps most.</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
      '<input id="dsName" placeholder="Full name" style="padding:8px 10px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<input id="dsCompany" placeholder="Company" style="padding:8px 10px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<input id="dsDomain" placeholder="Company domain (e.g. acme.com)" style="padding:8px 10px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<input id="dsEmail" placeholder="Email (if known)" style="padding:8px 10px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<input id="dsPhone" placeholder="Phone (if known)" style="padding:8px 10px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
      '<input id="dsLinkedin" placeholder="LinkedIn URL (if known)" style="padding:8px 10px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
    '</div>' +
    '<button id="dsSearchBtn" onclick="runDetectiveSam()" style="width:100%;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px;border-radius:3px;background:var(--c-accent-solid);border:none;color:#2A1F0C;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans)">' +
      _magnifierIcon(17, '#2A1F0C') + 'Search</button>' +
    '<div id="dsResults" style="margin-top:14px"></div>' +
  '</div>';
  m.addEventListener('click', function(){ m.remove(); });
  document.body.appendChild(m);
  setTimeout(function(){ document.getElementById('dsName')?.focus(); }, 50);
}

var _DS_SRC_META = {
  internal: { label: 'Your own data', color: 'var(--green)' },
  lusha:    { label: 'Lusha',        color: 'var(--blue)' },
  apollo:   { label: 'Apollo',       color: 'var(--blue)' },
  hunter:   { label: 'Hunter',       color: 'var(--amber)' }
};
function _dsSrcChip(src, note) {
  var m = _DS_SRC_META[src] || { label: src, color: 'var(--text3)' };
  return '<span style="font-size:11px;font-weight:600;color:'+m.color+';background:rgba(128,128,128,0.09);border-radius:2px;padding:2px 6px;white-space:nowrap" title="'+esc(note||'')+'">'+esc(m.label)+(note?' · '+esc(note):'')+'</span>';
}

async function runDetectiveSam() {
  var btn = document.getElementById('dsSearchBtn');
  var out = document.getElementById('dsResults');
  var q = {
    name: document.getElementById('dsName')?.value?.trim() || '',
    company: document.getElementById('dsCompany')?.value?.trim() || '',
    domain: document.getElementById('dsDomain')?.value?.trim() || '',
    email: document.getElementById('dsEmail')?.value?.trim() || '',
    phone: document.getElementById('dsPhone')?.value?.trim() || '',
    linkedin_url: document.getElementById('dsLinkedin')?.value?.trim() || ''
  };
  if (!q.name && !q.email && !q.phone && !q.linkedin_url) { showToast('Give a name, email, phone or LinkedIn to search on'); return; }
  if (btn) { btn.disabled = true; btn.style.opacity = '0.65'; btn.innerHTML = _magnifierIcon(17,'#2A1F0C') + 'Investigating…'; }
  if (out) out.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:10px 0">Checking your own records first, then the enrichment providers…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify(Object.assign({ action:'detective_sam_lookup' }, q)) });
    var d = await r.json();
    if (!d.ok) { out.innerHTML = '<div style="font-size:12px;color:var(--coral)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> '+esc(d.error||'Search failed')+'</div>'; return; }
    window._dsResult = d;
    out.innerHTML = _renderDetectiveSamResult(d);
  } catch(e) {
    if (out) out.innerHTML = '<div style="font-size:12px;color:var(--coral)">Error: '+esc(e.message)+'</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = _magnifierIcon(17,'#2A1F0C') + 'Search'; }
  }
}

function _renderDetectiveSamResult(d) {
  var p = d.profile || {};
  var fs = d.field_sources || {};
  var html = '';

  if (!d.found) {
    html += '<div style="background:var(--surface2);border-radius:3px;padding:14px;font-size:12px;color:var(--text2)">Nothing found on that person yet.</div>';
  } else {
    html += '<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:3px;padding:14px">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">' +
        '<div style="min-width:0">' +
          '<div style="font-size:16px;font-weight:700;color:var(--text)">'+esc(p.name||'Unknown')+'</div>' +
          (p.title ? '<div style="font-size:12px;color:var(--text2);margin-top:2px">'+esc(p.title)+(p.current_org?' · '+esc(p.current_org):'')+'</div>' : (p.current_org?'<div style="font-size:12px;color:var(--text2);margin-top:2px">'+esc(p.current_org)+'</div>':'')) +
          (p.location ? '<div style="font-size:11px;color:var(--text3);margin-top:2px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 21V3.5M5.5 4.5h12l-2.5 4 2.5 4h-12"/></svg> '+esc(p.location)+'</div>' : '') +
        '</div>' +
        (p.linkedin_url ? '<a href="'+esc(p.linkedin_url)+'" target="_blank" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#fff;background:#0A66C2;border-radius:2px;padding:6px 10px;text-decoration:none;flex-shrink:0">in LinkedIn</a>' : '') +
      '</div>';

    if ((d.emails||[]).length) {
      html += '<div style="margin-top:12px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Email'+(d.emails.length>1?'s':'')+' ('+d.emails.length+')</div>' +
        d.emails.map(function(e){
          return '<div style="display:flex;align-items:center;gap:7px;padding:4px 0;flex-wrap:wrap">' +
            '<span style="font-size:12px;color:var(--text);font-weight:600">'+esc(e.value)+'</span>' + _dsSrcChip(e.source, e.note) +
 '<span onclick="navigator.clipboard?.writeText(\''+esc(e.value)+'\');showToast(\'Copied\')" style="cursor:pointer;font-size:10px;color:var(--text3);margin-left:auto">copy</span>' +
          '</div>';
        }).join('') + '</div>';
    }
    if ((d.phones||[]).length) {
      html += '<div style="margin-top:12px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5H4.5A1.5 1.5 0 003 5c0 8.8 7.2 16 16 16a1.5 1.5 0 001.5-1.5V17l-4.5-2-2.5 2.5A15 15 0 018.5 11L11 8.5z"/></svg> Phone'+(d.phones.length>1?'s':'')+' ('+d.phones.length+')</div>' +
        d.phones.map(function(e){
          return '<div style="display:flex;align-items:center;gap:7px;padding:4px 0;flex-wrap:wrap">' +
            '<span style="font-size:12px;color:var(--text);font-weight:600">'+esc(e.value)+'</span>' + _dsSrcChip(e.source, e.note) +
 '<span onclick="navigator.clipboard?.writeText(\''+esc(e.value)+'\');showToast(\'Copied\')" style="cursor:pointer;font-size:10px;color:var(--text3);margin-left:auto">copy</span>' +
          '</div>';
        }).join('') + '</div>';
    }
    if ((p.previous_orgs||[]).length) {
      html += '<div style="margin-top:12px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20.5V5.5L13 3v17.5M13 9.5h7v11M4 20.5h17M7.5 8h2M7.5 12h2M7.5 16h2M16 13h1.5M16 16.5h1.5"/></svg> Previously</div>' +
        p.previous_orgs.slice(0,6).map(function(h){
          var yrs = [String(h.start||'').slice(0,4), String(h.end||'').slice(0,4)].filter(Boolean).join(' – ');
          return '<div style="display:flex;align-items:baseline;gap:7px;padding:3px 0;border-top:1px solid var(--border)">' +
            '<span style="font-size:12px;color:var(--text);font-weight:600">'+esc(h.organization)+'</span>' +
            (h.title?'<span style="font-size:11px;color:var(--text3)">'+esc(h.title)+'</span>':'') +
            (yrs?'<span style="font-size:11px;color:var(--text3);margin-left:auto">'+esc(yrs)+'</span>':'') +
          '</div>';
        }).join('') + '</div>';
    }
    if (p.seniority || p.department) {
      html += '<div style="margin-top:10px;font-size:11px;color:var(--text3)">'+[p.seniority,p.department].filter(Boolean).map(esc).join(' · ')+'</div>';
    }

    // The brief. Deterministic, derived from what was actually found, and
    // every line carries the evidence it rests on rather than asserting.
    if ((d.intel||[]).length) {
      html += '<div style="margin-top:13px;padding-top:11px;border-top:1px solid var(--border)">' +
        '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px">' +
          _detectiveSamAvatar(22) +
          '<span style="font-size:11px;font-weight:700;color:var(--text)">Here is what Detective SAM would like you to know about '+esc((p.name||'them').split(' ')[0])+' before you reach out</span>' +
        '</div>' +
        d.intel.map(function(it) {
          return '<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 9px;margin-bottom:4px;background:rgba(var(--c-accent-rgb),0.07);border-radius:2px">' +
            '<span style="flex-shrink:0;font-size:12px">'+esc(it.icon||'•')+'</span>' +
            '<div style="min-width:0">' +
              '<div style="font-size:11px;color:var(--text);line-height:1.45">'+esc(it.text)+'</div>' +
              (it.basis ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">based on: '+esc(it.basis)+'</div>' : '') +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }
    // Only shown when there is actually something to attribute. "Sources:
    // none" under a result is a contradiction, and absent data needs no
    // announcement.
    if ((d.sources_used||[]).length) {
      html += '<div style="margin-top:11px;padding-top:9px;border-top:1px solid var(--border);font-size:11px;color:var(--text3)">Sources: '+d.sources_used.map(function(s){ return (_DS_SRC_META[s]||{label:s}).label; }).join(', ')+(d.internal_hits?' · '+d.internal_hits+' match'+(d.internal_hits!==1?'es':'')+' already in your data':'')+'</div>';
    }
    html += '</div>';
  }

  (d.notes||[]).forEach(function(n){
    html += '<div style="margin-top:8px;font-size:11px;color:var(--amber);background:rgba(212,160,74,0.08);border-radius:2px;padding:8px 10px">ⓘ '+esc(n)+'</div>';
  });

  if (d.found) html += _dsActionsHtml();
  return html;
}

// "What now?" — asked once a result exists, rather than assuming.
function _dsActionsHtml() {
  var camps = window._sampaignCampaignsCache || {};
  var ids = Object.keys(camps);
  var opts = ids.map(function(id){ return '<option value="'+esc(id)+'">'+esc(camps[id].name||'SAMpaign')+'</option>'; }).join('');
  return '<div style="margin-top:12px;background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:12px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text);margin-bottom:8px">What do you want to do with this?</div>' +
    (ids.length
      ? '<div style="display:flex;gap:6px;align-items:center;margin-bottom:7px">' +
          '<select id="dsCampaignPick" style="flex:1;padding:7px 9px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px">'+opts+'</select>' +
          '<button onclick="dsAddToSampaign()" style="font-size:11px;font-weight:600;padding:7px 12px;border-radius:2px;background:var(--green);border:none;color:#fff;cursor:pointer;font-family:var(--sans);white-space:nowrap">Add to SAMpaign</button>' +
        '</div>'
      : '<div style="font-size:11px;color:var(--text3);margin-bottom:7px">No SAMpaigns yet, create one to add people to it.</div>') +
    '<div style="display:flex;gap:6px;align-items:center;margin-bottom:7px">' +
      '<input id="dsAccountSearch" placeholder="Account name to attach as stakeholder…" oninput="dsFindAccounts(this.value)" style="flex:1;padding:7px 9px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
    '</div>' +
    '<div id="dsAccountResults"></div>' +
    '<div style="font-size:11px;color:var(--text3);margin-top:6px">Saved to an account, they are marked <strong>prospective</strong> until you have actually contacted them, so coverage and champion metrics stay honest.</div>' +
    '<div style="text-align:right;margin-top:8px"><span onclick="document.getElementById(\'detective-sam-modal\').remove()" style="font-size:11px;color:var(--text3);cursor:pointer">Just show me, close</span></div>' +
  '</div>';
}

async function dsAddToSampaign() {
  var d = window._dsResult; if (!d) return;
  var cid = document.getElementById('dsCampaignPick')?.value;
  if (!cid) { showToast('Pick a SAMpaign'); return; }
  var p = d.profile || {};
  var contact = {
    name: p.name || '', email: (d.emails||[])[0]?.value || '',
    phone: (d.phones||[])[0]?.value || '', company: p.current_org || p.company || '', title: p.title || ''
  };
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'upload_sampaign_contacts', campaign_id: cid, contacts: [contact] }) });
    var j = await r.json();
    if (!j.ok) { showToast('Error: '+(j.error||'Could not add')); return; }
 showToast(j.added ? 'Added to SAMpaign' : 'Already in that SAMpaign');
  } catch(e) { showToast('Error: '+e.message); }
}

var _dsAcctTimer = null;
function dsFindAccounts(q) {
  clearTimeout(_dsAcctTimer);
  var box = document.getElementById('dsAccountResults');
  if (!box) return;
  if (!q || q.trim().length < 2) { box.innerHTML = ''; return; }
  _dsAcctTimer = setTimeout(function() {
    var needle = q.trim().toLowerCase();
    // Search the pipeline already loaded in this session rather than adding a
    // lookup endpoint for something the client already holds. _pipelineData
    // is the global; the `allDeals` arrays elsewhere in this file are local
    // to their own functions and not reachable from here.
    var pd = (typeof _pipelineData !== 'undefined' && _pipelineData) ? _pipelineData : null;
    if (!pd) { box.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:3px 0">Open the Pipeline tab once so your accounts are loaded, then try again.</div>'; return; }
    var pool = [].concat(pd.verified||[], pd.partial||[], pd.unverified||[]);
    var hits = pool.filter(function(a){ return String(a.account_name||'').toLowerCase().indexOf(needle) !== -1; }).slice(0, 5);
    if (!hits.length) { box.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:3px 0">No matching account in your pipeline.</div>'; return; }
    box.innerHTML = hits.map(function(a){
      return '<div onclick="dsSaveStakeholder(\''+esc(a.id)+'\',\''+esc(a.account_name)+'\')" style="cursor:pointer;font-size:11px;color:var(--text);padding:5px 7px;border-radius:2px;background:var(--surface2);margin-top:3px">＋ '+esc(a.account_name)+'</div>';
    }).join('');
  }, 200);
}

async function dsSaveStakeholder(accountId, accountName) {
  var d = window._dsResult; if (!d) return;
  var p = d.profile || {};
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'detective_sam_save_stakeholder', account_id: accountId,
        name: p.name, email: (d.emails||[])[0]?.value || null, phone: (d.phones||[])[0]?.value || null,
        title: p.title, linkedin_url: p.linkedin_url, seniority: p.seniority, department: p.department }) });
    var j = await r.json();
    if (!j.ok) { showToast('Error: '+(j.error||'Could not save')); return; }
 showToast(j.added ? 'Added to '+accountName+' as prospective' : (j.note||'Already a stakeholder'));
  } catch(e) { showToast('Error: '+e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════
// Follow-up scheduler — pick actual calendar dates, with weekends in red.
//
// Replaces the old "3,7,14 days after send" box. Day offsets meant you had to
// do date arithmetic in your head at creation time, so follow-up 2 would
// quietly land on a Saturday. Here you see the calendar while choosing, and
// weekends are marked, so a weekend date is always a deliberate choice.
//
// State is keyed by scope: 'new' for the create form, or the campaignId for
// an edit form, so both can be open at once without colliding.
// ═══════════════════════════════════════════════════════════════════════════
window._fupState = {};        // scope -> ['2026-08-05', ...]
window._fupCalOpen = null;    // 'scope:index' of the open calendar, if any
window._fupCalMonth = {};     // 'scope:index' -> {y, m} being browsed

var _FUP_MAX = 5;
var _FUP_DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var _FUP_MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function _fupIsWeekend(key) { var d = parseDate(key); return d.getDay() === 0 || d.getDay() === 6; }
function _fupPretty(key) {
  var d = parseDate(key);
  return _FUP_DOW[d.getDay()] + ' ' + d.getDate() + ' ' + _FUP_MON[d.getMonth()];
}
// Default suggestion for a newly added follow-up: a week after the previous
// one (or a week out from today for the first), nudged off a weekend since an
// unreviewed default landing on Saturday is the exact trap this replaces.
function _fupSuggest(existing) {
  var base = existing.length ? parseDate(existing[existing.length - 1]) : new Date();
  var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return dateKey(d);
}

function _fupGet(scope) { return window._fupState[scope] || (window._fupState[scope] = []); }

function _fupSetCount(scope, n) {
  var cur = _fupGet(scope);
  n = Math.max(0, Math.min(_FUP_MAX, parseInt(n, 10) || 0));
  while (cur.length > n) cur.pop();
  while (cur.length < n) cur.push(_fupSuggest(cur));
  window._fupCalOpen = null;
  _fupRender(scope);
}
function _fupAdd(scope) {
  var cur = _fupGet(scope);
  if (cur.length >= _FUP_MAX) { showToast('Up to ' + _FUP_MAX + ' follow-ups'); return; }
  cur.push(_fupSuggest(cur));
  _fupRender(scope);
}
function _fupRemove(scope, i) {
  var cur = _fupGet(scope);
  cur.splice(i, 1);
  window._fupCalOpen = null;
  _fupRender(scope);
}
function _fupToggleCal(scope, i) {
  var key = scope + ':' + i;
  window._fupCalOpen = (window._fupCalOpen === key) ? null : key;
  if (window._fupCalOpen) {
    var d = parseDate(_fupGet(scope)[i]);
    window._fupCalMonth[key] = { y: d.getFullYear(), m: d.getMonth() };
  }
  _fupRender(scope);
}
function _fupNavMonth(scope, i, delta) {
  var key = scope + ':' + i;
  var cur = window._fupCalMonth[key] || { y: new Date().getFullYear(), m: new Date().getMonth() };
  var d = new Date(cur.y, cur.m + delta, 1);
  window._fupCalMonth[key] = { y: d.getFullYear(), m: d.getMonth() };
  _fupRender(scope);
}
function _fupPick(scope, i, key) {
  var cur = _fupGet(scope);
  cur[i] = key;
  // Dates stay in chronological order so "follow-up 2" always means the
  // second one that happens, regardless of the order they were filled in.
  cur.sort();
  window._fupCalOpen = null;
  _fupRender(scope);
}

function _fupCalendarHtml(scope, i) {
  var key = scope + ':' + i;
  var sel = _fupGet(scope)[i];
  var mm = window._fupCalMonth[key] || { y: parseDate(sel).getFullYear(), m: parseDate(sel).getMonth() };
  var first = new Date(mm.y, mm.m, 1);
  var startPad = first.getDay();
  var daysInMonth = new Date(mm.y, mm.m + 1, 0).getDate();
  var todayK = todayKey();
  var taken = _fupGet(scope);

  var head = _FUP_DOW.map(function(d, idx) {
    var wk = (idx === 0 || idx === 6);
    return '<div style="font-size:11px;font-weight:700;text-align:center;padding:3px 0;color:'+(wk?'var(--coral)':'var(--text3)')+'">'+d.charAt(0)+'</div>';
  }).join('');

  var cells = '';
  for (var p = 0; p < startPad; p++) cells += '<div></div>';
  for (var day = 1; day <= daysInMonth; day++) {
    var k = dateKey(new Date(mm.y, mm.m, day));
    var dow = new Date(mm.y, mm.m, day).getDay();
    var wknd = (dow === 0 || dow === 6);
    var isSel = (k === sel);
    var isPast = k < todayK;
    var isDupe = taken.indexOf(k) !== -1 && !isSel;
    var col = isSel ? '#fff' : (wknd ? 'var(--coral)' : 'var(--text)');
    var bg = isSel ? 'var(--gold)' : (wknd ? 'rgba(196,90,74,0.07)' : 'transparent');
    var dis = isPast || isDupe;
    cells += '<div' + (dis ? '' : ' onclick="_fupPick(\''+esc(scope)+'\','+i+',\''+k+'\')"') +
      ' title="'+(isDupe?'Already used by another follow-up':(isPast?'In the past':(wknd?'Weekend':'')))+'"' +
      ' style="text-align:center;font-size:11px;padding:5px 0;border-radius:2px;background:'+bg+';color:'+col+';' +
        (dis ? 'opacity:0.28;' : 'cursor:pointer;') + (isSel?'font-weight:700;':'') + '">' + day + '</div>';
  }

  return '<div style="margin-top:6px;padding:8px;border:1px solid var(--border2);border-radius:2px;background:var(--bg)">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">' +
      '<span onclick="_fupNavMonth(\''+esc(scope)+'\','+i+',-1)" style="cursor:pointer;padding:2px 7px;font-size:13px;color:var(--text3)">‹</span>' +
      '<span style="font-size:11px;font-weight:700;color:var(--text)">'+_FUP_MON[mm.m]+' '+mm.y+'</span>' +
      '<span onclick="_fupNavMonth(\''+esc(scope)+'\','+i+',1)" style="cursor:pointer;padding:2px 7px;font-size:13px;color:var(--text3)">›</span>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">' + head + cells + '</div>' +
    '<div style="font-size:11px;color:var(--coral);margin-top:5px">Weekends in red</div>' +
  '</div>';
}

function _fupRender(scope) {
  var box = document.getElementById('fupRows_' + scope);
  if (!box) return;
  var dates = _fupGet(scope);
  var html = '';

  if (!dates.length) {
    html += '<div style="font-size:11px;color:var(--text3);padding:4px 0">No follow-ups — one send only.</div>';
  }
  dates.forEach(function(k, i) {
    var wknd = _fupIsWeekend(k);
    var open = (window._fupCalOpen === scope + ':' + i);
    html += '<div style="border:1px solid '+(wknd?'rgba(196,90,74,0.35)':'var(--border2)')+';border-radius:2px;padding:7px 9px;background:var(--bg)">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<span style="font-size:11px;font-weight:600;color:var(--text3);min-width:74px">Follow-up '+(i+1)+'</span>' +
        '<span onclick="_fupToggleCal(\''+esc(scope)+'\','+i+')" style="flex:1;font-size:12px;font-weight:600;color:'+(wknd?'var(--coral)':'var(--text)')+';cursor:pointer">' +
          '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> '+_fupPretty(k)+(wknd?' <span style="font-size:11px;font-weight:600">· weekend</span>':'') +
        '</span>' +
        '<span onclick="_fupRemove(\''+esc(scope)+'\','+i+')" style="cursor:pointer;color:var(--text3);font-size:13px;padding:0 2px" title="Remove this follow-up"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>' +
      '</div>' +
      (open ? _fupCalendarHtml(scope, i) : '') +
    '</div>';
  });

  html += '<div style="display:flex;align-items:center;gap:8px;margin-top:2px">' +
    (dates.length < _FUP_MAX
      ? '<span onclick="_fupAdd(\''+esc(scope)+'\')" style="font-size:11px;font-weight:600;color:var(--gold);cursor:pointer">+ Add follow-up</span>'
      : '<span style="font-size:11px;color:var(--text3)">Maximum '+_FUP_MAX+' follow-ups</span>') +
  '</div>';

  box.innerHTML = html;
  var sel = document.getElementById('fupCount_' + scope);
  if (sel && String(sel.value) !== String(dates.length)) sel.value = String(dates.length);
}

// The whole control: count dropdown + rows + add button.
function _fupEditorHtml(scope, initial) {
  window._fupState[scope] = (initial || []).map(function(d){ return String(d).slice(0,10); }).sort();
  window._fupCalOpen = null;
  var n = window._fupState[scope].length;
  var opts = '';
  for (var i = 0; i <= _FUP_MAX; i++) opts += '<option value="'+i+'"'+(i===n?' selected':'')+'>'+i+'</option>';
  return '<div style="display:flex;flex-direction:column;gap:6px">' +
    '<div style="display:flex;align-items:center;gap:8px">' +
      '<span style="font-size:11px;color:var(--text3)">How many follow-ups?</span>' +
      '<select id="fupCount_'+esc(scope)+'" onchange="_fupSetCount(\''+esc(scope)+'\',this.value)" style="padding:5px 8px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px">'+opts+'</select>' +
      '<span style="font-size:11px;color:var(--text3)">Pick the actual dates, weekends are flagged</span>' +
    '</div>' +
    '<div id="fupRows_'+esc(scope)+'" style="display:flex;flex-direction:column;gap:5px"></div>' +
  '</div>';
}

function loadSampaignWorkspace() {
  var role = (profile?.role||'').toLowerCase();
  var el = document.getElementById('sampaignManualSection');
  if (!el) return;
  // Detective SAM is a research tool, not a campaign tool, so it is NOT
  // behind the sdr/ae/manager gate the SAMpaign workspace sits behind —
  // anyone who needs to look a person up should be able to.
  if (!['sdr','ae','manager'].includes(role)) { el.innerHTML = detectiveSamCardHtml(); return; }
  el.innerHTML =
    detectiveSamCardHtml() +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
      '<span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">My SAMpaigns'+(role==='manager'?' (you + your team)':'')+'</span>' +
      '<button onclick="toggleNewSampaignForm()" id="sampaignNewBtn" style="font-size:11px;font-weight:600;padding:5px 12px;border-radius:2px;background:var(--green);border:none;color:#fff;cursor:pointer;font-family:var(--sans)">+ New SAMpaign</button>' +
    '</div>' +
    '<div id="sampaignNewForm" style="display:none;background:var(--surface2);border-radius:3px;padding:10px;margin-bottom:12px">' +
      '<div style="display:flex;flex-direction:column;gap:6px">' +
      '<div style="font-size:11px;color:var(--text3)">Same as an SDR lead — a SAMpaign is anchored to a real tracked account, so contacts you upload/scout belong to it by construction.</div>' +
      '<input id="sampaignName" placeholder="Company name (e.g. Acme Corp)" style="padding:8px 10px;border:1px solid var(--border);border-radius:2px;background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/>' +
      '<input id="sampaignDomain" placeholder="Domain (e.g. acme.com)" style="padding:8px 10px;border:1px solid var(--border);border-radius:2px;background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/>' +
      '<input id="sampaignRegion" placeholder="Region (optional)" style="padding:8px 10px;border:1px solid var(--border);border-radius:2px;background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/>' +
      '<div style="font-size:11px;color:var(--text3)">Campaign goal / ask — what are you pitching and what do you want them to do? (used by AI drafting tools, e.g. Claude via connector)</div>' +
      '<textarea id="sampaignGoal" rows="2" placeholder="e.g. Introduce our retail execution platform, get a 15-min discovery call booked with the regional sales lead" style="padding:8px 10px;border:1px solid var(--border);border-radius:2px;background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans);resize:vertical;height:48px"></textarea>' +
      '<div style="font-size:11px;color:var(--text3)">Who is this one for? A short label so you can tell it apart later (e.g. RTM leadership, Plant heads)</div>' +
      '<input id="sampaignFocus" maxlength="48" placeholder="Focus (e.g. RTM leadership)" style="padding:8px 10px;border:1px solid var(--border);border-radius:2px;background:var(--bg);color:var(--text);font-size:13px;font-family:var(--sans)"/>' +
      '<div style="font-size:11px;color:var(--text3)">Follow-up schedule — these become tasks on your own list for those days</div>' +
      _fupEditorHtml('new', [_fupSuggest([])]) +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--text2)">' +
        '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="sampaignAlertOoo" checked/> OOO alerts</label>' +
        '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="sampaignAlertReplied" checked/> Reply alerts</label>' +
        '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="sampaignAlertNoResp" checked/> No-response alerts</label>' +
        '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="sampaignAlertDead" checked/> Dead-contact alerts</label>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">Who are you reaching out to? Type them in, attach a CSV, or do neither and add people later.</div>' +
      '<div><span onclick="addSampaignContactRows(\'new\')" style="font-size:11px;font-weight:600;color:var(--green);cursor:pointer">＋ Add people manually</span></div>' +
      '<div id="sampaignAddRows_new"></div>' +
      '<div style="font-size:11px;color:var(--text3)">Or attach a CSV (name, email, phone, company, title)</div>' +
      '<input type="file" id="sampaignNewCsv" accept=".csv,text/csv" style="font-size:11px;color:var(--text2)"/>' +
      '<button onclick="createSampaign()" style="padding:9px;border:none;border-radius:2px;background:var(--green);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--sans)">Create SAMpaign</button>' +
      '</div></div>' +
    '<div id="sampaignCampaignsList"><div style="font-size:12px;color:var(--text3);padding:6px 0">Loading…</div></div>';
  _fupRender('new');
  loadSampaignCampaigns();
}

// ═══════════════════════════════════════════════════════════════════════════
// Follow-up tasks — put each follow-up on the owner's own task list for its
// date, and move it when the date changes.
//
// Written client-side into allData + save(dayKey), the same path every other
// task uses, rather than having the edge function write into daytrack behind
// the app's back. Two reasons: the person editing the campaign is by
// definition the owner (edit is owner-only), so their own session already has
// the right identity and the right local state; and a server-side write would
// race the client's own copy of allData, which syncDown resolves by task
// count, not by recency.
//
// Tasks are keyed `sampaign:{campaignId}:{stage}` so a date change MOVES the
// task instead of leaving a duplicate behind. Completion is not carried
// across a move on purpose: if you reschedule follow-up 2, it hasn't been
// done yet, so re-opening it is the truthful state.
// ═══════════════════════════════════════════════════════════════════════════
function _fupTaskId(campaignId, stage) { return 'sampaign:' + campaignId + ':' + stage; }

async function _syncSampaignFupTasks(campaignId, campaignName, oldDates, newDates) {
  if (typeof allData === 'undefined' || typeof save !== 'function') return 0;
  oldDates = (oldDates || []).map(function(d){ return String(d).slice(0,10); });
  newDates = (newDates || []).map(function(d){ return String(d).slice(0,10); });

  // Every day that might need rewriting: anywhere this campaign had a task
  // before, plus anywhere it should have one now.
  var touched = {};
  oldDates.concat(newDates).forEach(function(k){ touched[k] = true; });

  // Strip this campaign's follow-up tasks from all affected days first, so a
  // moved date can't leave an orphan behind on the old day.
  Object.keys(touched).forEach(function(k) {
    var d = dayData(k);
    d.tasks = (d.tasks || []).filter(function(t){ return !(t && t.sampaignId === campaignId); });
  });

  // Then place one task per follow-up on its (new) date.
  newDates.forEach(function(k, i) {
    var d = dayData(k);
    d.tasks.push({
      id: _fupTaskId(campaignId, i + 1),
      text: 'Follow-up ' + (i + 1) + ' — ' + (campaignName || 'SAMpaign'),
      done: false,
      source: 'sampaign',
      sampaignId: campaignId,
      fupStage: i + 1,
      createdAt: new Date().toISOString()
    });
  });

  var keys = Object.keys(touched);
  for (var i = 0; i < keys.length; i++) { try { await save(keys[i]); } catch(e) {} }
  // Report only genuine reschedules (a date that changed), not first-time
  // creation, so the toast doesn't claim work it didn't do.
  var movedCount = newDates.filter(function(k){ return oldDates.indexOf(k) === -1; }).length;
  return oldDates.length ? movedCount : 0;
}

function toggleNewSampaignForm() {
  var f = document.getElementById('sampaignNewForm'); if (!f) return;
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  if (f.style.display === 'block') document.getElementById('sampaignName')?.focus();
}

async function createSampaign() {
  var accountName = document.getElementById('sampaignName')?.value?.trim();
  var domain = document.getElementById('sampaignDomain')?.value?.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'');
  var region = document.getElementById('sampaignRegion')?.value?.trim() || null;
  if (!accountName) { showToast('Enter a company name'); return; }
  if (!domain) { showToast('Enter a domain — SAMpaigns are anchored to a tracked account, same as an SDR lead'); return; }
  var campaignGoal = document.getElementById('sampaignGoal')?.value?.trim() || null;
  var followup_dates = (window._fupState['new'] || []).slice();
  var alerts_enabled = {
    ooo: !!document.getElementById('sampaignAlertOoo')?.checked,
    replied: !!document.getElementById('sampaignAlertReplied')?.checked,
    no_response: !!document.getElementById('sampaignAlertNoResp')?.checked,
    dead: !!document.getElementById('sampaignAlertDead')?.checked
  };
  var csvFile = document.getElementById('sampaignNewCsv')?.files?.[0] || null;
  // Collected BEFORE the create call so a validation problem (bad email
  // format) stops us here rather than after a campaign already exists.
  var typedContacts = null;
  if ((window._sampAddRows['new'] || []).length) {
    typedContacts = _collectSampAddRows('new');
    if (!typedContacts) return;
  }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'create_sampaign', account_name: accountName, domain: domain, region: region, campaign_goal: campaignGoal, focus: (document.getElementById('sampaignFocus')?.value||'').trim() || null, followup_dates: followup_dates, alerts_enabled: alerts_enabled }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not create SAMpaign')); return; }
 showToast(d.account_linked ? 'SAMpaign linked to existing account' : 'SAMpaign + account created');
    // Put the follow-ups on the owner's own task list for those days.
    if (d.campaign?.id) await _syncSampaignFupTasks(d.campaign.id, accountName, [], followup_dates);
    document.getElementById('sampaignName').value = '';
    document.getElementById('sampaignDomain').value = '';
    document.getElementById('sampaignRegion').value = '';
    document.getElementById('sampaignGoal').value = '';
    var fEl = document.getElementById('sampaignFocus'); if (fEl) fEl.value = '';
    _fupState['new'] = [_fupSuggest([])];
    _fupRender('new');
    toggleNewSampaignForm();
    // One-motion audience definition: people typed into the form and/or a CSV
    // attached at creation both go straight into the campaign we just made —
    // name it and define who it targets in one step (Outreach.io's pattern),
    // rather than forcing a separate pass right afterwards. Adding MORE
    // people later, from the campaign itself, still works unchanged.
    if (d.campaign?.id && typedContacts && typedContacts.length) {
      try {
        var ar = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
          body: JSON.stringify({ action:'upload_sampaign_contacts', campaign_id: d.campaign.id, contacts: typedContacts }) });
        var ad = await ar.json();
 if (ad.ok) showToast('Added ' + (ad.added||0) + ' contact' + ((ad.added||0)!==1?'s':'') + (ad.need_email ? ' · ' + ad.need_email + ' need an email lookup' : ''));
      } catch(e) { showToast('Campaign created, but adding people failed: '+e.message); }
      window._sampAddRows['new'] = null;
      var addBox = document.getElementById('sampaignAddRows_new'); if (addBox) addBox.innerHTML = '';
    }
    if (csvFile && d.campaign?.id) {
      await _uploadSampaignCsvFile(d.campaign.id, csvFile);
      var csvEl = document.getElementById('sampaignNewCsv'); if (csvEl) csvEl.value = '';
    }
    loadSampaignCampaigns();
  } catch(e) { showToast('Error: '+e.message); }
}

async function loadSampaignCampaigns() {
  var el = document.getElementById('sampaignCampaignsList');
  if (!el) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'list_sampaigns' }) });
    var d = await r.json();
    if (!d.ok) { el.innerHTML = '<div style="font-size:11px;color:var(--coral)">'+esc(d.error||'Failed to load')+'</div>'; return; }
    if (!d.campaigns || !d.campaigns.length) { el.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:4px 0">No manual SAMpaigns yet. Create one above, or use a connected sequencing tool for SAMpaign Analytics instead.</div>'; return; }
    // Cache full campaign objects (name/followup_dates/alerts_enabled) so the
    // edit form can prefill instantly without a second fetch.
    window._sampaignCampaignsCache = {};
    d.campaigns.forEach(function(c) { window._sampaignCampaignsCache[c.id] = c; });
    // ── Card layout mirrors the detail view: same headline number, same
    // meaning. Reply rate leads because it answers "is this working"; the
    // contact count is inventory and sits secondary. The previous card led
    // with the count and showed status pills only when non-zero, so cards
    // were inconsistent widths and told you nothing about performance.
    el.innerHTML = d.campaigns.map(function(c) {
      var s = c.stats || {};
      var isOwner = c.owner_user_id === currentUser.id || !c.owner_user_id;
      var sent = s.sent || 0;
      var rate = sent > 0 ? Math.round(((s.replied || 0) / sent) * 100) : null;
      var rateCol = rate === null ? 'var(--text3)' : rate >= 12 ? 'var(--green)' : rate >= 7 ? 'var(--amber)' : 'var(--coral)';

      // Two campaigns can share a company name (one per quarter, per region,
      // per SDR). Without a second identifier they are indistinguishable in
      // the list, which was happening with the two TotalEnergies rows.
      var sub = [];
      // Focus leads: when three campaigns share an account name it is the
      // only thing that says which is which, so it goes before the counts.
      if (c.focus) sub.push('<strong style="color:var(--text2)">'+esc(c.focus)+'</strong>');
      sub.push((s.total || 0) + ' contact' + ((s.total || 0) !== 1 ? 's' : ''));
      if (c.owner_email) sub.push(esc(c.owner_email.split('@')[0]));
      if (c.created_at) sub.push('from ' + new Date(c.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' }));

      // Fixed order, always the same slots, so the eye learns one position
      // per meaning instead of re-reading every card.
      var pill = function(n, label, color) {
        if (!n) return '';
        return '<span style="font-size:11px;font-weight:700;color:'+color+';background:rgba(128,128,128,0.10);border-radius:2px;padding:2px 6px;white-space:nowrap">'+n+' '+label+'</span>';
      };
      var pills = [ pill(s.replied,'replied','var(--green)'), pill(s.ooo,'OOO','var(--amber)'),
                    pill(s.no_response,'no reply','var(--text3)'), pill(s.dead,'dead','var(--coral)') ].join('');

      // "F1 · 21 · due 10 Aug" needed decoding. Spelled out, and only the
      // single most urgent wave is shown — the rest are one click away.
      var next = (c.followup_schedule || []).slice().sort(function(a,b){ return String(a.next_due).localeCompare(String(b.next_due)); })[0];
      var nextChip = '';
      if (next) {
        var d2 = new Date(next.next_due);
        var lbl = isNaN(d2.getTime()) ? '' : d2.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
        var overdue = !isNaN(d2.getTime()) && d2 < new Date(new Date().toDateString());
        nextChip = '<span style="font-size:11px;color:'+(overdue?'var(--coral)':'var(--text3)')+'">' +
          (overdue ? 'Follow-up ' + next.stage + ' overdue since ' : 'Follow-up ' + next.stage + ' due ') + lbl +
          ' · ' + next.count + ' contact' + (next.count !== 1 ? 's' : '') + '</span>';
      }

      return '<div style="background:var(--surface2);border-radius:3px;padding:11px 13px;margin-bottom:8px">' +
        '<div onclick="openSampaignDetail(\''+esc(c.id)+'\')" style="cursor:pointer">' +
          '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">' +
            '<div style="min-width:0;display:flex;align-items:baseline;gap:9px;flex-wrap:wrap">' +
              '<span style="font-size:14px;font-weight:700;color:var(--text)">'+esc(c.name)+'</span>' +
              (rate !== null
                ? '<span style="font-size:13px;font-weight:700;color:'+rateCol+'">'+rate+'%</span><span style="font-size:11px;color:var(--text3)">reply</span>'
                : '<span style="font-size:11px;color:var(--text3)">not sent yet</span>') +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:3px;flex-shrink:0">' +
              (isOwner ? '<button onclick="event.stopPropagation();toggleEditSampaignForm(\''+esc(c.id)+'\')" title="Edit SAMpaign" style="background:none;border:none;color:var(--text3);font-size:13px;cursor:pointer;padding:3px 5px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3z"/></svg></button>' : '') +
              (isOwner ? '<button onclick="event.stopPropagation();deleteSampaignCampaign(\''+esc(c.id)+'\',\''+esc(c.name)+'\')" title="Delete SAMpaign" style="background:none;border:none;color:var(--coral);font-size:13px;cursor:pointer;padding:3px 5px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 6.5h15M9 6.5V4h6v2.5M6.5 6.5V20h11V6.5M10 10v6M14 10v6"/></svg></button>' : '') +
              '<span title="Open" style="font-size:12px;color:var(--gold)">⤢</span>' +
            '</div>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:3px">'+sub.join(' · ')+'</div>' +
          (pills ? '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px">'+pills+'</div>' : '') +
          (nextChip ? '<div style="margin-top:6px">'+nextChip+'</div>' : '') +
        '</div>' +
        '<div id="sampaignEdit_'+esc(c.id)+'" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border2)"></div>' +
      '</div>';
    }).join('');
  } catch(e) { el.innerHTML = '<div style="font-size:11px;color:var(--coral)">Error: '+esc(e.message)+'</div>'; }
}

// ── Edit SAMpaign: name / follow-up cadence / alert toggles. Domain/account
// linkage is deliberately not editable here — that is a structural decision,
// recreate the campaign if it needs to change.
function toggleEditSampaignForm(campaignId) {
  var box = document.getElementById('sampaignEdit_'+campaignId);
  if (!box) return;
  if (box.style.display === 'none') {
    var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
    var a = c.alerts_enabled || {};
    box.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<input id="editSampaignName_'+esc(campaignId)+'" value="'+esc(c.name||'')+'" placeholder="Campaign name" style="padding:7px 10px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
        '<textarea id="editSampaignGoal_'+esc(campaignId)+'" rows="2" placeholder="Campaign goal / ask — what are you pitching, what do you want them to do?" style="padding:7px 10px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px;resize:vertical;height:46px">'+esc(c.campaign_goal||'')+'</textarea>' +
        '<input id="editSampaignFocus_'+esc(campaignId)+'" maxlength="48" value="'+esc(c.focus||'')+'" placeholder="Focus (e.g. RTM leadership)" style="padding:7px 10px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:12px"/>' +
        '<div style="font-size:11px;color:var(--text3)">Follow-up schedule — moving a date moves its task too</div>' +
        _fupEditorHtml(campaignId, c.followup_dates || []) +
        '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--text2)">' +
          '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="editSampaignAlertOoo_'+esc(campaignId)+'" '+(a.ooo?'checked':'')+'/> OOO</label>' +
          '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="editSampaignAlertReplied_'+esc(campaignId)+'" '+(a.replied?'checked':'')+'/> Replied</label>' +
          '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="editSampaignAlertNoResp_'+esc(campaignId)+'" '+(a.no_response?'checked':'')+'/> No response</label>' +
          '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="editSampaignAlertDead_'+esc(campaignId)+'" '+(a.dead?'checked':'')+'/> Dead</label>' +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button onclick="saveSampaignEdit(\''+esc(campaignId)+'\')" style="flex:1;padding:7px;border-radius:2px;background:var(--gold);border:none;color:#fff;font-size:12px;font-weight:600;cursor:pointer">Save changes</button>' +
          '<button onclick="toggleEditSampaignForm(\''+esc(campaignId)+'\')" style="padding:7px 12px;border-radius:2px;background:none;border:1px solid var(--border2);color:var(--text3);font-size:12px;cursor:pointer">Cancel</button>' +
        '</div>' +
      '</div>';
    box.style.display = 'block';
    _fupRender(campaignId);
  } else {
    box.style.display = 'none';
  }
}

async function saveSampaignEdit(campaignId) {
  var name = document.getElementById('editSampaignName_'+campaignId)?.value?.trim();
  var campaignGoal = document.getElementById('editSampaignGoal_'+campaignId)?.value ?? '';
  var cachedC = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var oldDates = (cachedC.followup_dates || []).map(function(d){ return String(d).slice(0,10); });
  var followup_dates = (window._fupState[campaignId] || []).slice();
  var alerts_enabled = {
    ooo: !!document.getElementById('editSampaignAlertOoo_'+campaignId)?.checked,
    replied: !!document.getElementById('editSampaignAlertReplied_'+campaignId)?.checked,
    no_response: !!document.getElementById('editSampaignAlertNoResp_'+campaignId)?.checked,
    dead: !!document.getElementById('editSampaignAlertDead_'+campaignId)?.checked
  };
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'update_sampaign', campaign_id: campaignId, name: name, campaign_goal: campaignGoal, focus: (document.getElementById('editSampaignFocus_'+campaignId)?.value||'').trim(), followup_dates: followup_dates, alerts_enabled: alerts_enabled }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not update SAMpaign')); return; }
    var moved = await _syncSampaignFupTasks(campaignId, name || cachedC.name, oldDates, followup_dates);
 showToast('SAMpaign updated' + (moved ? ' · ' + moved + ' task' + (moved!==1?'s':'') + ' rescheduled' : ''));
    loadSampaignCampaigns();
  } catch(e) { showToast('Error: '+e.message); }
}

// Soft delete (archive) — reversible, matches existing codebase convention
// of a native confirm() for destructive actions (see e.g. "Remove this
// account?", "Disconnect provider?").
async function deleteSampaignCampaign(campaignId, name) {
  if (!confirm('Delete "'+name+'" and hide all its contacts? This can be undone by an admin, but not from here.')) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'archive_sampaign', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not delete SAMpaign')); return; }
 showToast('SAMpaign deleted');
    loadSampaignCampaigns();
  } catch(e) { showToast('Error: '+e.message); }
}

// Fetches + caches + renders one campaign's contact roster into whatever
// div#sampaignContacts_{campaignId} currently exists in the DOM — agnostic
// to where that div lives (inline in a card, or inside the detail overlay
// below), same "just target the id" pattern _renderSampaignContacts already
// uses. Shared by openSampaignDetail (initial load) and anywhere else that
// needs a post-mutation refresh (CSV upload, scout, enrich).
async function _loadSampaignContactsInto(campaignId) {
  var box = document.getElementById('sampaignContacts_'+campaignId);
  if (!box) return;
  box.innerHTML = '<div style="font-size:11px;color:var(--text3)">Loading contacts…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'list_sampaign_contacts', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) { box.innerHTML = '<div style="font-size:11px;color:var(--coral)">'+esc(d.error||'Failed')+'</div>'; return; }
    window._sampaignContactsCache[campaignId] = d.contacts || [];
    _renderSampaignContacts(campaignId);
  } catch(e) { box.innerHTML = '<div style="font-size:11px;color:var(--coral)">Error: '+esc(e.message)+'</div>'; }
}

// ── SAMpaign detail — full-screen overlay ───────────────────────────────────
// Clicking a campaign card used to expand its contact roster inline, which
// got cluttered fast on a list of several campaigns each with dozens of
// contacts. Now it opens a single dedicated overlay instead: campaign
// header, this campaign's own performance analytics (scoped
// get_manual_sampaign_stats call, same renderer used for the org-wide
// SAMpaign Analytics view), the follow-up schedule in full, then the
// existing contact roster (Active/Prospective tabs, scout, enrich, CSV
// upload — all unchanged, just relocated). Same bottom-sheet modal
// convention as openSampaignContactInsight (spc-insight-modal) for visual
// consistency with the rest of the app.
// True only when the signed-in user owns this campaign. Mutating actions
// (sync, upload, scout, enrich, promote) are all owner-only on the backend;
// managers get read visibility. Compares on email because list_sampaigns
// returns owner_email, not owner_user_id.
function _isSampaignOwner(c) {
  if (!c) return false;
  var me = ((typeof currentUser !== 'undefined' && currentUser && currentUser.email) || '').toLowerCase();
  if (!me) return false;
  if (!c.owner_email) return true;   // single-owner view, nothing to contradict
  return String(c.owner_email).toLowerCase() === me;
}

// ═══════════════════════════════════════════════════════════════════════════
// SAMpaign detail — restructured after Kite's instrument view.
//
// The old overlay was one long scroll: performance, follow-up schedule,
// trend, contacts, add-people, drafts and queue all stacked. Everything was
// visible, so nothing was prominent, and the two things a rep actually needs
// on opening ("is this working?" and "is anything waiting on me?") were
// buried among the things they rarely touch.
//
// Three ideas taken from Kite:
//   1. ONE headline number. Kite leads with price and change; a campaign's
//      equivalent is reply rate against benchmark. Contact count is inventory,
//      not performance, so it moves to the right as secondary.
//   2. A divided metric strip, label above value, thin rules between — the
//      PE / P/B row. Scannable without reading.
//   3. Everything else behind tabs, so the default view is small.
// ═══════════════════════════════════════════════════════════════════════════
window._sampTab = 'overview';

async function openSampaignDetail(campaignId) {
  document.getElementById('sampaign-detail-overlay')?.remove();
  // Fresh overlay starts unfiltered and on Overview — a filter or tab left
  // over from the last campaign would silently hide most of this one.
  window._sampaignStatusFilter = null;
  window._sampTab = 'overview';
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var isOwner = _isSampaignOwner(c);

  var modal = document.createElement('div');
  modal.id = 'sampaign-detail-overlay';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);z-index:99999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML =
    '<div style="background:var(--bg);border-radius:3px 18px 0 0;width:100%;max-width:720px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -10px 50px rgba(0,0,0,0.35)" onclick="event.stopPropagation()">' +
      // ── Header: fixed, never scrolls away ──
      '<div style="padding:18px 20px 0;flex-shrink:0">' +
        '<div id="sampHeader_'+esc(campaignId)+'"></div>' +
        '<div id="sampTabs_'+esc(campaignId)+'" style="display:flex;gap:20px;margin-top:14px;border-bottom:1px solid var(--border)"></div>' +
      '</div>' +
      // ── Body: the only scrolling region ──
      '<div id="sampBody_'+esc(campaignId)+'" style="flex:1;overflow-y:auto;padding:16px 20px 20px;min-height:180px">' +
        '<div style="font-size:11px;color:var(--text3)">Loading…</div>' +
      '</div>' +
      // ── Footer: actions always reachable, never scrolled past ──
      '<div style="flex-shrink:0;display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--border);background:var(--surface2)">' +
        (isOwner
          ? '<button id="sampaignSyncBtn_'+esc(campaignId)+'" onclick="syncSampaignCampaign(\''+esc(campaignId)+'\')" style="font-size:12px;font-weight:600;color:var(--gold);padding:8px 16px;border-radius:2px;background:transparent;border:1px solid rgba(var(--c-accent-rgb),0.4);cursor:pointer;font-family:var(--sans)">Sync inbox</button>' +
            '<button onclick="openSampaignComposer(\''+esc(campaignId)+'\')" style="font-size:12px;font-weight:600;color:#fff;padding:8px 16px;border-radius:2px;background:var(--green);border:none;cursor:pointer;font-family:var(--sans)">Schedule</button>'
          : '<span style="font-size:11px;color:var(--text3);align-self:center;margin-right:auto">Syncs from '+esc((c.owner_email||'the owner').split('@')[0])+'’s inbox, hourly</span>') +
        '<button onclick="document.getElementById(\'sampaign-detail-overlay\').remove()" style="font-size:12px;font-weight:600;color:var(--text3);padding:8px 16px;border-radius:2px;background:transparent;border:1px solid var(--border2);cursor:pointer;font-family:var(--sans)">Close</button>' +
      '</div>' +
    '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);

  // Must go through setSampTab rather than calling the loader directly: the
  // body starts as a placeholder, and it is setSampTab that creates the
  // containers each loader writes into. Calling _loadSampaignDetailPerf here
  // would target a #sampaignDetailPerf that does not exist yet, silently do
  // nothing, and leave the panel on "Loading…" forever.
  setSampTab(campaignId, 'overview');
  // Fetched once in the background so the Queue tab's badge is accurate
  // before anyone opens that tab.
  _primeSampDraftCount(campaignId);
}

// Badge-only fetch. Deliberately does not render anything — it exists so the
// tab strip can say "6" without the rep having to go looking.
async function _primeSampDraftCount(campaignId) {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'list_sampaign_scheduled_sends', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) return;
    window._sampDraftCount = window._sampDraftCount || {};
    window._sampDraftCount[campaignId] = (d.summary && d.summary.draft) || 0;
    _renderSampTabs(campaignId);
  } catch(e) { /* badge is a nicety, never block the overlay on it */ }
}

function _sampTabDefs(campaignId) {
  var pending = (window._sampDraftCount || {})[campaignId] || 0;
  return [
    { key: 'overview', label: 'Overview' },
    { key: 'contacts', label: 'Contacts' },
    // The badge is the point: the one tab that may be waiting on a decision
    // says so without being opened.
    { key: 'queue',    label: 'Launches', badge: pending },
    { key: 'trend',    label: 'Trend' }
  ];
}

function _renderSampTabs(campaignId) {
  var el = document.getElementById('sampTabs_' + campaignId);
  if (!el) return;
  el.innerHTML = _sampTabDefs(campaignId).map(function(t) {
    var on = window._sampTab === t.key;
    return '<span onclick="setSampTab(\''+esc(campaignId)+'\',\''+t.key+'\')" ' +
      'style="font-size:13px;font-weight:'+(on?'700':'500')+';padding-bottom:9px;cursor:pointer;white-space:nowrap;' +
        'border-bottom:2px solid '+(on?'var(--gold)':'transparent')+';color:'+(on?'var(--text)':'var(--text3)')+'">' +
      esc(t.label) +
      (t.badge ? '<span style="font-size:11px;font-weight:700;background:rgba(var(--c-accent-rgb),0.16);color:var(--gold);border-radius:2px;padding:1px 6px;margin-left:5px">'+t.badge+'</span>' : '') +
    '</span>';
  }).join('');
}

function setSampTab(campaignId, tab) {
  window._sampTab = tab;
  _renderSampTabs(campaignId);
  var body = document.getElementById('sampBody_' + campaignId);
  if (!body) return;
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};

  if (tab === 'overview') {
    body.innerHTML = '<div id="sampaignDetailPerf"></div><div id="sampaignDetailSchedule"></div>';
    _loadSampaignDetailPerf(campaignId, c);
  } else if (tab === 'contacts') {
    body.innerHTML = '<div id="sampaignContacts_'+esc(campaignId)+'"><div style="font-size:11px;color:var(--text3)">Loading contacts…</div></div>' +
                     '<div id="sampaignAddRows_'+esc(campaignId)+'"></div>';
    _loadSampaignContactsInto(campaignId);
  } else if (tab === 'queue') {
    body.innerHTML = '<div id="sampSendQueue"><div style="font-size:11px;color:var(--text3)">Loading queue…</div></div>';
    loadSampaignSendQueue(campaignId);
  } else if (tab === 'trend') {
    body.innerHTML = '<div id="sampaignDetailTrend"><div style="font-size:11px;color:var(--text3)">Loading…</div></div>';
    _loadSampaignTrend(campaignId);
  }
}

// Header: one headline number, everything else secondary.
function _renderSampHeader(campaignId, d) {
  var el = document.getElementById('sampHeader_' + campaignId);
  if (!el) return;
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var s = (d && d.org_summary) || {};
  var bm = (d && d.benchmarks) || { reply_rate: { good: 12, avg: 7 } };
  var rate = s.reply_rate || 0;
  var good = bm.reply_rate.good, avg = bm.reply_rate.avg;
  var col = rate >= good ? 'var(--green)' : rate >= avg ? 'var(--amber)' : 'var(--coral)';
  var verdict = rate >= good ? 'above benchmark' : rate >= avg ? 'around average' : 'below benchmark';

  el.innerHTML =
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">' +
      '<div style="min-width:0">' +
        '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">' +
          '<span style="font-size:16px;font-weight:700;color:var(--text)">'+esc(c.name||'SAMpaign')+'</span>' +
          '<span style="color:var(--border2)">|</span>' +
          '<span style="font-size:16px;font-weight:700;color:'+col+'">'+rate+'%</span>' +
          '<span style="font-size:11px;color:'+col+'">'+verdict+' (reply rate)</span>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+
          (c.focus ? '<strong style="color:var(--text2)">'+esc(c.focus)+'</strong> · ' : '')+
          esc((c.owner_email||'').split('@')[0]||'')+
          (c.created_at ? ' · started '+new Date(c.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '')+
        '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0">' +
        '<div style="font-size:16px;font-weight:700;color:var(--text)">'+(s.total_prospects||0)+'</div>' +
        '<div style="font-size:11px;color:var(--text3)">contacts</div>' +
      '</div>' +
    '</div>';
}

// Period selector, Kite's YTD/1M/1Y row. Days, not labels, so the filter is
// a simple slice.
window._sampTrendDays = 30;
function setSampTrendPeriod(campaignId, days) {
  window._sampTrendDays = days;
  _loadSampaignTrend(campaignId);
}

// Performance over time, from the nightly snapshots. Live counts can only say
// where a campaign IS; only stored history says whether it is improving,
// which is the question worth acting on. A line drawn through one point is a
// fiction, so below two snapshots this says so plainly rather than drawing
// something meaningless or rendering nothing and looking broken.
async function _loadSampaignTrend(campaignId) {
  var box = document.getElementById('sampaignDetailTrend');
  if (!box) return;
  var periods = [ { d: 7, l: '7D' }, { d: 30, l: '30D' }, { d: 3650, l: 'All' } ];
  var picker = '<div style="display:flex;gap:16px;margin-bottom:12px">' +
    periods.map(function(p) {
      var on = window._sampTrendDays === p.d;
      return '<span onclick="setSampTrendPeriod(\''+esc(campaignId)+'\','+p.d+')" style="font-size:12px;font-weight:'+(on?'700':'500')+';color:'+(on?'var(--gold)':'var(--text3)')+';cursor:pointer;border-bottom:2px solid '+(on?'var(--gold)':'transparent')+';padding-bottom:3px">'+p.l+'</span>';
    }).join('') + '</div>';

  try {
    var r = await fetch(SB_URL + '/rest/v1/sampaign_perf_snapshots?campaign_id=eq.' + campaignId + '&select=snapshot_date,total,sent,replied,ooo,dead,no_response&order=snapshot_date.asc&limit=400', {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + currentUser.token }
    });
    var all = await r.json();
    if (!Array.isArray(all)) all = [];
    var cutoff = new Date(Date.now() - window._sampTrendDays * 86400000).toISOString().slice(0, 10);
    var rows = all.filter(function(x){ return String(x.snapshot_date) >= cutoff; });

    if (rows.length < 2) {
      // Explains itself instead of being an empty tab. The nightly job is the
      // thing being waited on, so name it and say when.
      box.innerHTML = picker +
        '<div style="text-align:center;padding:26px 16px;border:1px dashed var(--border2);border-radius:3px">' +
          '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:5px">History starts building tonight</div>' +
          '<div style="font-size:11px;color:var(--text3);line-height:1.55">A snapshot of this campaign is recorded once a day, so the first line appears after two nights.' +
          (all.length === 1 ? '<br>One day recorded so far.' : '') + '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:9px">Live numbers are on Overview in the meantime.</div>' +
        '</div>';
      return;
    }

    var maxV = Math.max.apply(null, rows.map(function(x){ return x.total || 0; })) || 1;
    var W = 100, H = 34;
    var line = function(key, col) {
      var pts = rows.map(function(x, i) {
        var px = rows.length > 1 ? (i / (rows.length - 1)) * W : 0;
        var py = H - ((x[key] || 0) / maxV) * H;
        return px.toFixed(1) + ',' + py.toFixed(1);
      }).join(' ');
      return '<polyline points="'+pts+'" fill="none" stroke="'+col+'" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
    };
    var last = rows[rows.length - 1], first = rows[0];
    var delta = function(k) {
      var v = (last[k]||0) - (first[k]||0);
      return v === 0 ? '' : (v > 0 ? ' +' + v : ' ' + v);
    };

    box.innerHTML = picker + '<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:3px;padding:11px;margin-bottom:8px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg> Trend</span>' +
        '<span style="font-size:11px;color:var(--text3)">'+rows.length+' days · '+esc(String(first.snapshot_date).slice(5))+' to '+esc(String(last.snapshot_date).slice(5))+'</span>' +
      '</div>' +
      '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;height:44px;display:block">' +
        line('sent', 'var(--blue)') + line('replied', 'var(--green)') + line('dead', 'var(--coral)') +
      '</svg>' +
      '<div style="display:flex;gap:12px;margin-top:5px;flex-wrap:wrap">' +
        '<span style="font-size:11px;color:var(--blue)">■ Sent '+(last.sent||0)+esc(delta('sent'))+'</span>' +
        '<span style="font-size:11px;color:var(--green)">■ Replied '+(last.replied||0)+esc(delta('replied'))+'</span>' +
        '<span style="font-size:11px;color:var(--coral)">■ Dead '+(last.dead||0)+esc(delta('dead'))+'</span>' +
      '</div>' +
    '</div>';
  } catch(e) { box.innerHTML = ''; }
}

// Shared by openSampaignDetail (initial load) and syncSampaignCampaign (post-sync
// refresh) so both paths render performance + follow-up schedule identically.
async function _loadSampaignDetailPerf(campaignId, c) {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'get_manual_sampaign_stats', campaign_id: campaignId }) });
    var d = await r.json();
    // The header always updates, even when the body is showing another tab —
    // the headline number should never go stale behind a tab switch.
    _renderSampHeader(campaignId, d);

    var perfBox = document.getElementById('sampaignDetailPerf');
    if (perfBox) {
      if (d.ok && d.org_summary && d.org_summary.total_prospects > 0) {
        perfBox.innerHTML = _sampGoalBlock(campaignId) + _sampMetricStrip(d, campaignId) + _sampHotSignals(d);
      } else if (!d.ok) {
        perfBox.innerHTML = '<div style="font-size:11px;color:var(--coral)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5M10.3 4.2L2.9 17.4a1.6 1.6 0 001.4 2.4h15.4a1.6 1.6 0 001.4-2.4L13.7 4.2a1.6 1.6 0 00-3.4 0z"/></svg> '+esc(d.error||'Could not load performance')+'</div>';
      } else {
        // Goal shows here too. A brand-new campaign is exactly when someone
        // is about to write copy against it, so hiding it on the empty state
        // would remove it at the moment it is most needed.
        perfBox.innerHTML = _sampGoalBlock(campaignId) +
          '<div style="font-size:12px;color:var(--text3);padding:14px 0;text-align:center">Nothing has happened yet.<br><span style="font-size:11px">Add contacts, then Schedule or Sync inbox.</span></div>';
      }
    }
    var schedBox = document.getElementById('sampaignDetailSchedule');
    if (schedBox && c && c.followup_schedule && c.followup_schedule.length) {
      var fmt = function(iso) { var dt = new Date(iso); return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-GB', { day:'numeric', month:'short' }); };
      schedBox.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:8px 0 6px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6h17v12h-17zM3.5 6.5l8.5 6 8.5-6"/></svg> Follow-up schedule</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
        c.followup_schedule.map(function(fs) {
          var overdue = new Date(fs.next_due) < new Date(new Date().toDateString());
          return '<span style="font-size:11px;font-weight:600;color:'+(overdue?'var(--coral)':'var(--gold)')+';background:'+(overdue?'rgba(196,90,74,0.1)':'rgba(var(--c-accent-rgb),0.1)')+';border:1px solid '+(overdue?'rgba(196,90,74,0.25)':'rgba(var(--c-accent-rgb),0.25)')+';border-radius:2px;padding:5px 10px">Follow-up '+fs.stage+' — '+fs.count+' contact'+(fs.count!==1?'s':'')+', '+(overdue?'overdue since':'scheduled')+' '+fmt(fs.next_due)+'</span>';
        }).join('') +
        '</div>';
    }
  } catch(e) {
    var perfBox2 = document.getElementById('sampaignDetailPerf');
    if (perfBox2) perfBox2.innerHTML = '<div style="font-size:11px;color:var(--coral)">Error: '+esc(e.message)+'</div>';
  }
}

// The campaign goal, restored to Overview. It used to live in the header
// subtitle and was lost in the tab rebuild — which mattered more than it
// looks: the goal is what every AI-written email is generated against, so a
// rep reviewing drafts needs to see what they were supposed to be aiming at.
// Long goals are clamped with a Read more rather than pushed off screen,
// since these are often a paragraph pasted from a brief.
window._sampGoalOpen = false;
function toggleSampGoal(campaignId) {
  window._sampGoalOpen = !window._sampGoalOpen;
  var el = document.getElementById('sampGoalText');
  var lnk = document.getElementById('sampGoalMore');
  if (!el) return;
  if (window._sampGoalOpen) {
    el.style.webkitLineClamp = 'unset'; el.style.display = 'block';
    if (lnk) lnk.textContent = 'Show less';
  } else {
    el.style.display = '-webkit-box'; el.style.webkitLineClamp = '2';
    if (lnk) lnk.textContent = 'Read more';
  }
}
function _sampGoalBlock(campaignId) {
  var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
  var goal = (c.campaign_goal || '').trim();
  if (!goal) {
    return '<div style="font-size:11px;color:var(--text3);margin-bottom:12px">' +
      'No goal set. Add one with the pencil on the campaign — it is what Claude writes every email against.</div>';
  }
  var long = goal.length > 150;
  return '<div style="margin-bottom:14px">' +
    '<div id="sampGoalText" style="font-size:12px;color:var(--text2);line-height:1.6;' +
      (long ? 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden' : '') + '">' +
      esc(goal) + '</div>' +
    (long ? '<span id="sampGoalMore" onclick="toggleSampGoal(\''+esc(campaignId)+'\')" style="font-size:11px;font-weight:600;color:var(--gold);cursor:pointer">Read more</span>' : '') +
  '</div>';
}

// Kite's PE / Sector PE / P/B row: label above, value below, hairline rules
// between. Clickable, so each cell is also the filter for that bucket — the
// number and the way to see what it is made of are the same control.
function _sampMetricStrip(d, campaignId) {
  var s = d.org_summary || {};
  var bm = d.benchmarks || { reply_rate: { good: 12 } };
  var cells = [
    { label: 'Sent',    val: s.sent || 0,        filter: 'sent' },
    { label: 'Opened',  val: s.opened || 0,      filter: 'opened' },
    { label: 'Replied', val: s.replied || 0,     filter: 'replied', color: 'var(--green)' },
    { label: 'OOO',     val: s.ooo || 0,         filter: 'ooo',     color: 'var(--amber)' },
    { label: 'No reply',val: s.no_response || 0, filter: 'no_response' },
    { label: 'Dead',    val: s.bounced || 0,     filter: 'dead',    color: 'var(--coral)' }
  ];
  var rate = s.reply_rate || 0, good = bm.reply_rate.good || 12;
  // Marker position is clamped so an unusually good campaign pins at the end
  // rather than running off the bar.
  var pos = Math.max(0, Math.min(100, (rate / good) * 100));

  var html = '<div style="display:flex;border-top:1px solid var(--border);border-bottom:1px solid var(--border);flex-wrap:wrap">';
  cells.forEach(function(c, i) {
    if (i) html += '<div style="width:1px;background:var(--border)"></div>';
    html += '<div onclick="setSampTab(\''+esc(campaignId)+'\',\'contacts\');setSampaignStatusFilter(\''+esc(campaignId)+'\',\''+c.filter+'\')" ' +
      'style="flex:1;min-width:62px;padding:11px 10px;cursor:pointer" title="Show these contacts">' +
      '<div style="font-size:11px;color:var(--text3)">'+c.label+'</div>' +
      '<div style="font-size:16px;font-weight:700;color:'+(c.val?(c.color||'var(--text)'):'var(--text3)')+';margin-top:2px">'+c.val+'</div>' +
    '</div>';
  });
  html += '</div>';

  // The 52-week-range analogue: where this campaign's reply rate sits between
  // nothing and a genuinely good result. Answers "am I doing well" without
  // needing to know what a good reply rate is.
  html += '<div style="padding:12px 2px 4px">' +
    '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3)">' +
      '<span>0%</span><span>reply rate vs industry</span><span>'+good+'%</span>' +
    '</div>' +
    '<div style="height:5px;border-radius:2px;margin-top:6px;background:linear-gradient(90deg,var(--coral),var(--amber),var(--green))"></div>' +
    '<div style="position:relative;height:12px">' +
      '<span style="position:absolute;left:'+pos.toFixed(1)+'%;transform:translateX(-50%);font-size:11px;color:var(--text)">▲</span>' +
    '</div>' +
  '</div>';
  return html;
}

// Replied prospects, kept on Overview because it is the one thing that should
// interrupt whatever else the rep was about to do.
function _sampHotSignals(d) {
  var hot = d.hot_signals || [];
  if (!hot.length) return '';
  return '<div style="margin-top:14px;border:1px solid rgba(74,140,92,0.3);background:rgba(74,140,92,0.07);border-radius:3px;padding:12px 14px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">Replied · act now</div>' +
    hot.map(function(h) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 0">' +
        '<div style="min-width:0">' +
          '<div style="font-size:13px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:5px">' +
            esc(h.prospect_name||h.prospect_email||'Unknown') + _sampaignLinkedInIcon(h.linkedin_url, h.prospect_name||h.prospect_email) +
          '</div>' +
          '<div style="font-size:11px;color:var(--text3)">'+(h.prospect_title?esc(h.prospect_title)+' · ':'')+esc(h.prospect_company||'')+'</div>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

// Turns a sync response into "3 sent, 1 replied, 2 OOO" style text.
function _sampaignSyncSummary(d) {
  var parts = [];
  if (d.sent_detected) parts.push(d.sent_detected + ' sent');
  if (d.replied_detected) parts.push(d.replied_detected + ' replied');
  if (d.ooo_auto_detected) parts.push(d.ooo_auto_detected + ' OOO');
  if (d.bounced_detected) parts.push(d.bounced_detected + ' bounced');
  return parts.join(', ');
}

// Manual inbox sync for ONE campaign — scans the rep's own Gmail for this
// campaign's contacts (sent/replied/OOO/bounced) and re-buckets them right
// now, rather than waiting for the hourly pass. Runs under the rep's own
// login against only their own mailbox (see sync_sampaigns_patch.ts).
async function syncSampaignCampaign(campaignId) {
  var btn = document.getElementById('sampaignSyncBtn_'+campaignId);
 if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = 'Syncing…'; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'sync_sampaigns', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) {
 showToast('' + (d.error || 'Sync failed'));
    } else {
      var summary = _sampaignSyncSummary(d);
 showToast(summary ? 'Synced: ' + summary : '' + (d.note || 'Inbox scanned, nothing new.'));
      var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
      _loadSampaignDetailPerf(campaignId, c);
      _loadSampaignContactsInto(campaignId);
    }
  } catch(e) {
 showToast('Sync error: ' + e.message);
  } finally {
 if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Sync inbox'; }
  }
}

// Background sync across ALL of this rep's active SAMpaigns. Same idea as
// autoCompleteTasks(silent): runs quietly on a timer, reads only the signed-in
// user's own mailbox, and stays silent when nothing changed so it never nags.
// Only speaks up (a toast) when it actually re-bucketed something, and only
// refreshes visible UI if the relevant panel happens to be open.
var _sampaignSyncBusy = false;
async function syncSampaignsQuiet() {
  if (_sampaignSyncBusy) return;
  if (typeof currentUser === 'undefined' || !currentUser || !currentUser.token) return;
  _sampaignSyncBusy = true;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'sync_sampaigns' }) });
    var d = await r.json();
    // No Gmail connected / no campaigns yet are normal states, not errors
    // worth interrupting anyone over — stay silent.
    if (!d.ok) return;
    var summary = _sampaignSyncSummary(d);
    if (!summary) return;
 showToast('SAMpaign sync: ' + summary);
    // Refresh whatever's on screen, if anything.
    var overlay = document.getElementById('sampaign-detail-overlay');
    if (overlay) {
      var openId = (overlay.querySelector('[id^="sampaignContacts_"]') || {}).id || '';
      var cid = openId.replace('sampaignContacts_', '');
      if (cid) {
        var c = (window._sampaignCampaignsCache || {})[cid] || {};
        _loadSampaignDetailPerf(cid, c);
        _loadSampaignContactsInto(cid);
      }
    }
    if (typeof loadSampaignCampaigns === 'function' && document.getElementById('sampaignCampaignsList')) {
      try { loadSampaignCampaigns(); } catch(e) {}
    }
  } catch(e) { /* non-fatal, try again next tick */ }
  finally { _sampaignSyncBusy = false; }
}

// Active/Prospective split mirrors the account Stakeholders tab's existing
// _stkTab pattern (not_contacted = prospective, everything else = active) —
// one shared global tab var is fine since only one campaign's panel is ever
// expanded at a time, same assumption _stkTab already makes.
var _sampaignContactTab = 'active';
function setSampaignContactTab(campaignId, tab) {
  _sampaignContactTab = tab;
  _renderSampaignContacts(campaignId);
}

function _renderSampaignContacts(campaignId) {
  var box = document.getElementById('sampaignContacts_'+campaignId);
  if (!box) return;
  var all = window._sampaignContactsCache[campaignId] || [];
  var active = all.filter(function(c){ return c.status !== 'not_contacted'; });
  var prospective = all.filter(function(c){ return c.status === 'not_contacted'; });
  // Tile-driven status filter wins over the tab split when one is set.
  // Note "Sent" on the tiles counts everything that left the mailbox
  // (sent/opened/replied/ooo/no_response/dead), matching how the backend
  // computes it, so clicking that tile must not narrow to status==='sent'
  // alone or the count on the tile wouldn't match the list underneath.
  var statusFilter = window._sampaignStatusFilter || null;
  var contacts;
  if (statusFilter === 'sent') {
    contacts = all.filter(function(c){ return c.status !== 'not_contacted'; });
  } else if (statusFilter === 'opened') {
    contacts = all.filter(function(c){ return c.status === 'opened' || c.status === 'replied'; });
  } else if (statusFilter) {
    contacts = all.filter(function(c){ return c.status === statusFilter; });
  } else {
    contacts = _sampaignContactTab === 'prospective' ? prospective : active;
  }
  var STATUS_META = {
    not_contacted: { label:'Not contacted', color:'var(--text3)' },
    sent:          { label:'Sent',          color:'var(--blue)' },
    opened:        { label:'Opened',        color:'var(--amber)' },
    replied:       { label:'Replied',       color:'var(--green)' },
    ooo:           { label:'OOO',           color:'var(--amber)' },
    no_response:   { label:'No response',   color:'var(--text3)' },
    dead:          { label:'Dead',          color:'var(--coral)' },
    opted_out:     { label:'Opted out',     color:'var(--text3)' }
  };
  // Counts as "needs enrichment" if never touched OR touched but still has
  // no LinkedIn/outreach note (e.g. ran before those fields existed, or the
  // provider missed) — matches the backend's own retry filter exactly, so
  // the button doesn't permanently disappear after one attempt.
  var unenriched = all.filter(function(c){ return !c.enriched_at || (!c.linkedin_url && !c.outreach_note); }).length;

  var tab = function(key, label, n) {
    var on = _sampaignContactTab === key;
    return '<span onclick="setSampaignContactTab(\''+esc(campaignId)+'\',\''+key+'\')" style="padding:5px 10px;cursor:pointer;font-size:11px;font-weight:600;border-bottom:2px solid '+(on?'var(--gold)':'transparent')+';color:'+(on?'var(--text)':'var(--text3)')+'">'+label+' <span style="font-size:11px;color:var(--text3)">'+n+'</span></span>';
  };
  // A tile filter takes precedence over the Active/Prospective tabs: showing
  // both at once would let you pick contradictory views (filter=Sent while on
  // the Prospective tab renders an empty list for no visible reason). While a
  // filter is on, the tabs are replaced by a single clearable filter chip.
  var html;
  if (statusFilter) {
    html = '<div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border2);margin-bottom:8px;padding-bottom:6px">' +
      '<span style="font-size:11px;font-weight:600;color:var(--text)">'+esc(_sampaignStatusLabel(statusFilter))+'</span>' +
      '<span style="font-size:11px;color:var(--text3)">'+contacts.length+' contact'+(contacts.length!==1?'s':'')+'</span>' +
      '<span onclick="setSampaignStatusFilter(\''+esc(campaignId)+'\',null)" style="margin-left:auto;font-size:11px;color:var(--gold);cursor:pointer;text-decoration:underline dotted"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg> clear filter</span>' +
    '</div>';
  } else {
    html = '<div style="display:flex;gap:2px;border-bottom:1px solid var(--border2);margin-bottom:8px">' +
      tab('active','Active',active.length) + tab('prospective','Prospective',prospective.length) +
    '</div>';
  }

  html += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
    '<label style="font-size:11px;color:var(--gold);padding:5px 10px;border-radius:2px;background:rgba(var(--c-accent-rgb),0.1);border:1px solid rgba(var(--c-accent-rgb),0.25);cursor:pointer">⇪ Upload CSV<input type="file" accept=".csv,text/csv" style="display:none" onchange="handleSampaignCsv(\''+esc(campaignId)+'\',this.files[0]);this.value=\'\'"/></label>' +
    '<button onclick="scoutSampaignContacts(\''+esc(campaignId)+'\')" style="font-size:11px;color:var(--gold);padding:5px 10px;border-radius:2px;background:rgba(var(--c-accent-rgb),0.1);border:1px solid rgba(var(--c-accent-rgb),0.25);cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16 16l5 5"/></svg> Scout more contacts</button>' +
    '<span onclick="openSampaignScoutProfile(\''+esc(campaignId)+'\')" style="font-size:11px;color:var(--text3);cursor:pointer;text-decoration:underline dotted"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Who to hunt</span>' +
    '<button onclick="addSampaignContactRows(\''+esc(campaignId)+'\')" style="font-size:11px;color:var(--green);padding:5px 10px;border-radius:2px;background:rgba(74,140,92,0.1);border:1px solid rgba(74,140,92,0.3);cursor:pointer">＋ Add people</button>' +
    // Always rendered, never conditional on unenriched>0. It used to vanish
    // entirely once every contact had been enriched, which reads as "the
    // button is broken" rather than "there is nothing to do" — and left no
    // way to re-run enrichment after adding people or rotating a provider.
    '<button onclick="enrichSampaignContacts(\''+esc(campaignId)+'\')" style="font-size:11px;color:var(--blue);padding:5px 10px;border-radius:2px;background:rgba(74,158,255,0.1);border:1px solid rgba(74,158,255,0.25);cursor:pointer"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> Enrich'+(unenriched?' '+unenriched+' contact'+(unenriched!==1?'s':''):'')+'</button>' +
    '<span style="font-size:11px;color:var(--text3)">Columns: name, email, phone, company, title (header names flexible)</span>' +
    '</div>' +
    '<div id="sampaignAddRows_'+esc(campaignId)+'"></div>';
  if (!contacts.length) {
    html += '<div style="font-size:11px;color:var(--text3)">' + (statusFilter ? 'No contacts with status "'+esc(_sampaignStatusLabel(statusFilter))+'" in this SAMpaign.' : (_sampaignContactTab==='prospective' ? 'No prospects yet — upload a CSV or scout more contacts above.' : 'No active contacts yet — mark someone sent/opened/replied to move them here.')) + '</div>';
  } else {
    html += contacts.map(function(c) {
      var meta = STATUS_META[c.status] || STATUS_META.not_contacted;
      var opts = Object.keys(STATUS_META).map(function(k){ return '<option value="'+k+'"'+(k===c.status?' selected':'')+'>'+STATUS_META[k].label+'</option>'; }).join('');
      // Domain-collision flag — visibility only, does NOT merge this contact
      // into org_accounts/stakeholders. Same semantics + shape as
      // get_sequencing_stats' by_account collision (open deal on the
      // matched account = deal_value_usd set, not won/lost).
      var collisionLine = '';
      if (c.collision) {
        collisionLine = '<div style="font-size:11px;margin-top:2px;color:'+(c.collision.is_same_user?'var(--green)':'var(--amber)')+'">' +
          (c.collision.is_same_user
            ? '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Your own tracked account'
            : '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg> Active deal: <strong>'+esc(c.collision.account_name)+'</strong>'+(c.collision.deal_value?' '+esc(c.collision.deal_value):'')+' · AE: '+esc(c.collision.ae)+' — coordinate before outreach') +
        '</div>';
      }
      // Promote to stakeholder — only once the contact has actually replied
      // (the "outcomes flow back" moment) AND is linked to a real tracked
      // account. No account match yet → explain rather than fake a button.
      var promoteBtn = '';
      if (c.status === 'replied') {
        promoteBtn = c.account_id
          ? '<button onclick="promoteSampaignContact(\''+esc(c.id)+'\',\''+esc(campaignId)+'\')" style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:2px;background:rgba(74,158,255,0.1);border:1px solid rgba(74,158,255,0.3);color:var(--blue);cursor:pointer;margin-top:3px">→ Promote to stakeholder</button>'
          : '<div style="font-size:11px;color:var(--text3);margin-top:3px">No matching tracked account yet — link one to promote</div>';
      }
      // LinkedIn: an actual logo tag (not a text link), same icon + fallback
      // pattern as the stakeholder roster (_stkRowHtml) — full opacity when
      // enrichment found a real profile URL, faint + a people-search fallback
      // when it hasn't (yet).
      var liHref = c.linkedin_url ? c.linkedin_url : ('https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(c.name || ''));
      var liOpacity = c.linkedin_url ? '1' : '0.3';
      // Clicking the icon copies the connection note AND opens the profile in
      // one motion. Sending a LinkedIn invite cannot be automated from here —
      // the rep has to do it by hand — so the only useful thing the product
      // can do is have the right words already on the clipboard at the moment
      // the invite box opens. Without a note it just opens the profile.
      var hasNote = !!(c.linkedin_note && c.linkedin_note.trim());
      var liTitle = hasNote ? 'Copy connection note and open profile'
                            : (c.linkedin_url ? 'Open LinkedIn profile' : 'Search LinkedIn (not enriched yet)');
      var liIcon = '<a href="'+esc(liHref)+'" target="_blank"' +
        (hasNote ? ' onclick="event.stopPropagation();_copyLinkedInNote(\''+esc(c.id)+'\')"' : ' onclick="event.stopPropagation()"') +
        ' style="display:inline-flex;align-items:center;color:#0A66C2;opacity:'+liOpacity+';text-decoration:none;flex-shrink:0;position:relative" title="'+esc(liTitle)+'"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>' +
        (hasNote ? '<span style="position:absolute;top:-3px;right:-4px;width:6px;height:6px;border-radius:50%;background:var(--green)"></span>' : '') +
        '</a>' +
        '<span onclick="event.stopPropagation();_toggleLinkedInNote(\''+esc(c.id)+'\')" style="cursor:pointer;font-size:11px;font-weight:600;color:'+(hasNote?'var(--gold)':'var(--text3)')+';white-space:nowrap" title="Write or edit the connection note">'+(hasNote?'note':'+ note')+'</span>';
      var titleLine = (c.title || c.seniority) ? '<div style="font-size:11px;color:var(--text2);margin-top:1px;display:flex;align-items:center;gap:5px"><span>'+esc([c.title, c.seniority].filter(Boolean).join(' · '))+'</span>'+liIcon+'</div>' : '<div style="margin-top:1px">'+liIcon+'</div>';
      // Enrichment-derived talking point — computed once at enrich/scout time
      // from title/seniority/department (deterministic, no AI, no Gmail
      // dependency), so it's there for contacts who haven't been emailed yet.
      // This is the field the earlier click-through insight modal couldn't
      // give prospects, since they have no message history to read.
      var noteLine = c.outreach_note ? '<div style="font-size:11px;color:var(--gold);margin-top:3px;display:flex;gap:5px;align-items:flex-start;background:rgba(var(--c-accent-rgb),0.06);border-radius:2px;padding:4px 7px"><span style="flex-shrink:0"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg></span><span>'+esc(c.outreach_note)+'</span></div>' : '';
      var intelBtn = _samoraIntelBtn('openSampaignContactInsight(\''+esc(c.id)+'\',\''+esc(c.name||c.email||'')+'\')', true);
      // Editor is collapsed by default — most rows do not need it open, and
      // 54 always-visible textareas would bury the roster.
      var noteLen = (c.linkedin_note || '').length;
      var noteEditor = '<div id="liNote_'+esc(c.id)+'" style="display:none;margin-top:5px">' +
          '<textarea id="liNoteText_'+esc(c.id)+'" maxlength="300" rows="3" oninput="_liNoteCount(\''+esc(c.id)+'\')" placeholder="Connection note, max 300 characters…" style="width:100%;box-sizing:border-box;padding:7px 9px;border-radius:2px;border:1px solid var(--border2);background:var(--bg);color:var(--text);font-family:var(--sans);font-size:11px;line-height:1.5;resize:vertical">'+esc(c.linkedin_note||'')+'</textarea>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap">' +
            '<button onclick="event.stopPropagation();saveLinkedInNote(\''+esc(c.id)+'\',\''+esc(campaignId)+'\')" style="font-size:11px;font-weight:600;padding:5px 11px;border-radius:2px;background:var(--green);border:none;color:#fff;cursor:pointer;font-family:var(--sans)">Save note</button>' +
            '<span id="liNoteCount_'+esc(c.id)+'" style="font-size:11px;color:var(--text3)">'+noteLen+' / 300</span>' +
            (c.linkedin_note_by ? '<span style="font-size:11px;color:var(--text3)">written by '+esc(c.linkedin_note_by)+'</span>' : '') +
          '</div>' +
        '</div>';
      return '<div style="padding:6px 0;border-top:1px solid var(--border)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px">' +
        '<div style="min-width:0;flex:1"><div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(c.name||c.email||'—')+'</div>' +
        '<div style="font-size:11px;color:var(--text3)">' +
          (c.email
            // A found email is an inference, not a fact — Hunter scores it
            // because it is guessing the pattern from other addresses at the
            // domain. Label it, never let it sit unmarked next to one the rep
            // typed in themselves.
            ? esc(c.email) + (c.email_source ? '<span style="color:var(--gold)" title="Found by '+esc(c.email_source)+(c.email_confidence!=null?', '+c.email_confidence+'% confidence':'')+', not supplied"> ◇'+(c.email_confidence!=null?' '+c.email_confidence+'%':'')+'</span>' : '')
            : '<span style="color:var(--gold)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16 16l5 5"/></svg> no email yet — run Enrich to look it up</span>') +
          (c.company?' · '+esc(c.company):'') +
        '</div>' + titleLine + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">' + intelBtn +
        '<select onchange="setSampaignContactStatus(\''+esc(c.id)+'\',this.value,\''+esc(campaignId)+'\')" style="font-size:11px;font-weight:600;color:'+meta.color+';background:var(--bg);border:1px solid var(--border);border-radius:2px;padding:3px 6px">'+opts+'</select>' +
        '<span onclick="removeSampaignContact(\''+esc(c.id)+'\',\''+esc(campaignId)+'\',\''+esc(c.name||c.email||'')+'\')" style="cursor:pointer;color:var(--text3);font-size:13px;padding:0 2px" title="Remove from SAMpaign"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>' +
        '</div></div>' + noteEditor + noteLine + collisionLine + promoteBtn +
      '</div>';
    }).join('');
  }
  box.innerHTML = html;
}

// Auto-detect contact columns by header name — flexible, same pattern as
// _detectCrmColumns (CRM audit upload) so headers don't need to match exactly.
function _detectSampaignColumns(headers) {
  var find = function(patterns) {
    for (var p = 0; p < patterns.length; p++) {
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i].toLowerCase().trim();
        if (patterns[p].test(h)) return i;
      }
    }
    return -1;
  };
  return {
    name:    find([/^(full\s*)?name$/, /^contact(\s*name)?$/, /first.*name/]),
    email:   find([/^email$/, /e-?mail/]),
    phone:   find([/^phone$/, /mobile/, /contact\s*number/]),
    company: find([/^compan(y|ies)$/, /^account(\s*name)?$/, /organi[sz]ation/]),
    title:   find([/^title$/, /^job\s*title$/, /designation/, /role/])
  };
}

// Shared by handleSampaignCsv (upload-to-existing-campaign) and createSampaign
// (attach-at-creation) so both paths parse + post contacts identically.
async function _uploadSampaignCsvFile(campaignId, file) {
  if (!file) return;
  try {
    var text = await file.text();
    var rows = _parseCsv(text);
    if (rows.length < 2) { showToast('CSV appears empty'); return; }
    var headers = rows[0];
    var map = _detectSampaignColumns(headers);
    if (map.email === -1) { showToast('Could not find an email column — email is required per contact'); return; }
    var get = function(r, idx) { return idx >= 0 ? (r[idx]||'').trim() : ''; };
    var contacts = rows.slice(1).filter(function(r){ return r.join('').trim(); }).slice(0, 2000).map(function(r) {
      return { name: get(r,map.name), email: get(r,map.email), phone: get(r,map.phone), company: get(r,map.company), title: get(r,map.title) };
    });
    showToast('Uploading '+contacts.length+' contacts…');
    var res = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'upload_sampaign_contacts', campaign_id: campaignId, contacts: contacts }) });
    var d = await res.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Upload failed')); return; }
 showToast('Added '+d.added+(d.skipped?' · skipped '+d.skipped+' duplicate/invalid':''));
    // Power up the bare CSV row with real title/seniority/LinkedIn since the
    // email is already in hand — same enrichment keys as stakeholder scout,
    // just a by-email lookup instead of a by-domain search. Best-effort: a
    // missing/quota-exhausted key just means contacts stay unenriched, never
    // blocks the upload itself.
    if (d.added > 0) {
      try {
        var er = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
          body: JSON.stringify({ action:'enrich_sampaign_contacts', campaign_id: campaignId }) });
        var ed = await er.json();
 if (ed.ok && ed.checked > 0) showToast('Checked '+ed.checked+', matched '+ed.enriched+' via '+(ed.provider||'—')+(ed.linkedin_found!==undefined?', '+ed.linkedin_found+' with LinkedIn':''));
      } catch(e) { /* enrichment is best-effort, upload already succeeded */ }
    }
  } catch(e) { showToast('CSV error: '+e.message); }
}

// "Pull more profiles" — mirrors scoutStakeholders() on the account
// Stakeholders tab, just pointed at this campaign's contact list instead.
async function scoutSampaignContacts(campaignId) {
  try {
 showToast('Scouting more contacts…');
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'scout_sampaign_contacts', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Scout unavailable')); return; }
    if (!d.scouted) { showToast(d.error || 'No new prospects found for this profile.'); return; }
 showToast(''+d.scouted+' prospect'+(d.scouted!==1?'s':'')+' scouted via '+(d.provider||'enrichment'));
    var r2 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'list_sampaign_contacts', campaign_id: campaignId }) });
    var d2 = await r2.json();
    if (d2.ok) { window._sampaignContactsCache[campaignId] = d2.contacts || []; _sampaignContactTab = 'prospective'; _renderSampaignContacts(campaignId); }
    loadSampaignCampaigns();
  } catch(e) { showToast('Error: '+e.message); }
}

// ── SAMpaign "Who to hunt": same criteria capability as the deal
// Stakeholders tab's openScoutProfile/saveScoutProfile, scoped per campaign
// instead of per account (a rep may want a broad Sales/Marketing net for
// outreach here, and a narrower MEDDPICC-role hunt on the same account's
// deal stakeholders — different purposes, so a separate override). Reuses
// the same generic get_org_setting/save_org_setting actions and the same
// _SCOUT_DEPTS/_SCOUT_SENIORITIES chip lists, just a campaign-scoped key
// (scout_profile_sampaign_<campaign_id>) instead of an account-scoped one.
var _sampScoutCampaignId = null;
// ═══════════════════════════════════════════════════════════════════════════
// Manual add-people — type contacts straight into the campaign instead of
// going via a CSV or a Lusha scout. Same destination as both of those
// (upload_sampaign_contacts), so dedupe-by-email, domain matching to the
// tracked account, and every downstream behaviour are identical. No new
// backend action: this is a different way to enter the same data, not a
// different kind of data.
// ═══════════════════════════════════════════════════════════════════════════
window._sampAddRows = {};   // campaignId -> [{name,email,phone,company,title}]

function _blankContactRow() { return { name:'', email:'', phone:'', company:'', title:'' }; }

function addSampaignContactRows(campaignId) {
  var box = document.getElementById('sampaignAddRows_' + campaignId);
  if (!box) return;
  // Toggle closed if already open, so the button works both ways.
  if (box.innerHTML.trim() && window._sampAddRows[campaignId]) {
    window._sampAddRows[campaignId] = null; box.innerHTML = ''; return;
  }
  window._sampAddRows[campaignId] = [_blankContactRow()];
  _renderSampAddRows(campaignId);
}

function _sampAddRowField(campaignId, i, field, val) {
  var rows = window._sampAddRows[campaignId]; if (!rows || !rows[i]) return;
  rows[i][field] = val;
}
function _sampAddAnotherRow(campaignId) {
  var rows = window._sampAddRows[campaignId]; if (!rows) return;
  if (rows.length >= 25) { showToast('Add up to 25 at a time, or upload a CSV'); return; }
  rows.push(_blankContactRow());
  _renderSampAddRows(campaignId, true);
}
function _sampRemoveAddRow(campaignId, i) {
  var rows = window._sampAddRows[campaignId]; if (!rows) return;
  rows.splice(i, 1);
  if (!rows.length) rows.push(_blankContactRow());
  _renderSampAddRows(campaignId);
}

function _renderSampAddRows(campaignId, focusLast) {
  var box = document.getElementById('sampaignAddRows_' + campaignId);
  var rows = window._sampAddRows[campaignId];
  if (!box || !rows) return;
  var f = function(i, field, label, req, val) {
    return '<input value="'+esc(val||'')+'" placeholder="'+esc(label)+(req?' *':'')+'" ' +
      'oninput="_sampAddRowField(\''+esc(campaignId)+'\','+i+',\''+field+'\',this.value)" ' +
      'style="flex:1;min-width:0;padding:5px 7px;border-radius:2px;border:1px solid '+(req?'rgba(var(--c-accent-rgb),0.4)':'var(--border2)')+';background:var(--bg);color:var(--text);font-family:var(--sans);font-size:11px"/>';
  };
  var html = '<div style="border:1px solid var(--border2);border-radius:2px;padding:9px;margin-bottom:8px;background:var(--surface)">' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:6px">Add people manually · give a <strong style="color:var(--gold)">name or an email</strong>, the rest is optional</div>';
  rows.forEach(function(r, i) {
    // Neither name nor email is individually required — you need one of the
    // two. Not knowing someone's address is the normal starting point, and
    // Enrich looks it up from the account domain plus their name.
    var noEmail = !!((r.name||'').trim()) && !((r.email||'').trim());
    html += '<div style="margin-bottom:5px">' +
      '<div style="display:flex;gap:4px;align-items:center">' +
        f(i,'name','Name',false,r.name) + f(i,'email','Email',false,r.email) +
        f(i,'company','Company',false,r.company) + f(i,'title','Title',false,r.title) +
        '<span onclick="_sampRemoveAddRow(\''+esc(campaignId)+'\','+i+')" style="cursor:pointer;color:var(--text3);font-size:13px;padding:0 3px;flex-shrink:0" title="Remove this row"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>' +
      '</div>' +
      (noEmail ? '<div style="font-size:11px;color:var(--gold);margin-top:2px"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16 16l5 5"/></svg> No email — Enrich will try to find it from the account domain</div>' : '') +
    '</div>';
  });
  html += '<div style="display:flex;gap:8px;align-items:center;margin-top:7px">' +
      '<span onclick="_sampAddAnotherRow(\''+esc(campaignId)+'\')" style="font-size:11px;font-weight:600;color:var(--gold);cursor:pointer">+ Add another person</span>' +
      '<button onclick="submitSampaignContactRows(\''+esc(campaignId)+'\')" style="margin-left:auto;font-size:11px;font-weight:600;padding:5px 12px;border-radius:2px;background:var(--green);border:none;color:#fff;cursor:pointer;font-family:var(--sans)">Add to SAMpaign</button>' +
      '<span onclick="addSampaignContactRows(\''+esc(campaignId)+'\')" style="font-size:11px;color:var(--text3);cursor:pointer">Cancel</span>' +
    '</div></div>';
  box.innerHTML = html;
  if (focusLast) { var ins = box.querySelectorAll('input'); if (ins.length) ins[Math.max(0, ins.length - 4)].focus(); }
}

// Collect + validate the typed rows. Shared by the in-campaign form and the
// creation form, which is why it returns the array rather than posting.
function _collectSampAddRows(campaignId) {
  var rows = window._sampAddRows[campaignId] || [];
  var contacts = rows
    .map(function(r){ return { name:(r.name||'').trim(), email:(r.email||'').trim(), phone:(r.phone||'').trim(), company:(r.company||'').trim(), title:(r.title||'').trim() }; })
    .filter(function(r){ return r.email || r.name; });
  if (!contacts.length) { showToast('Add a name or an email for at least one person'); return null; }
  // Only validate addresses that were actually typed — a blank email is a
  // legitimate "look this up for me", not a mistake.
  var bad = contacts.filter(function(r){ return r.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email); });
  if (bad.length) { showToast('Check the email format: ' + bad[0].email); return null; }
  return contacts;
}

async function submitSampaignContactRows(campaignId) {
  var contacts = _collectSampAddRows(campaignId);
  if (!contacts) return;
  try {
    var res = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'upload_sampaign_contacts', campaign_id: campaignId, contacts: contacts }) });
    var d = await res.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not add contacts')); return; }
 showToast('Added ' + (d.added||0) + (d.need_email ? ' · ' + d.need_email + ' need an email lookup' : '') + (d.skipped ? ' · ' + d.skipped + ' skipped (already in this SAMpaign)' : ''));
    window._sampAddRows[campaignId] = null;
    var box = document.getElementById('sampaignAddRows_'+campaignId); if (box) box.innerHTML = '';
    await _loadSampaignContactsInto(campaignId);
    var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
    _loadSampaignDetailPerf(campaignId, c);
  } catch(e) { showToast('Error: '+e.message); }
}

// ── LinkedIn connection notes ───────────────────────────────────────────────
// LinkedIn caps a connection note at 300 characters. Two things worth knowing
// beyond the length, because no code here can work around either: free
// accounts get roughly five personalised invitations per MONTH (past that
// LinkedIn sends the request but silently drops the note), and the invite
// itself cannot be automated — the rep opens the profile and pastes. So the
// only useful job for the product is having the right words on the clipboard
// at the exact moment the invite box opens.
function _toggleLinkedInNote(contactId) {
  var el = document.getElementById('liNote_' + contactId);
  if (!el) return;
  var open = el.style.display === 'none';
  el.style.display = open ? 'block' : 'none';
  if (open) document.getElementById('liNoteText_' + contactId)?.focus();
}

function _liNoteCount(contactId) {
  var ta = document.getElementById('liNoteText_' + contactId);
  var out = document.getElementById('liNoteCount_' + contactId);
  if (!ta || !out) return;
  var n = ta.value.length;
  out.textContent = n + ' / 300';
  // Amber past 200: sources disagree on whether free LinkedIn accounts are
  // held to 200 rather than 300, so this warns instead of blocking.
  out.style.color = n > 300 ? 'var(--coral)' : n > 200 ? 'var(--amber)' : 'var(--text3)';
  out.title = n > 200 ? 'Some free LinkedIn accounts cap notes at 200 characters' : '';
}

async function saveLinkedInNote(contactId, campaignId) {
  var ta = document.getElementById('liNoteText_' + contactId);
  if (!ta) return;
  var note = ta.value.replace(/\s+/g, ' ').trim();
  if (!note) { showToast('Write something first'); return; }
  if (note.length > 300) { showToast('Too long by ' + (note.length - 300) + ' characters'); return; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'save_sampaign_linkedin_notes', campaign_id: campaignId, generated_by: 'manual', notes: [{ contact_id: contactId, note: note }] }) });
    var d = await r.json();
 if (!d.ok || !d.saved) { showToast('' + (d.note || d.error || 'Could not save')); return; }
 showToast('Note saved');
    _loadSampaignContactsInto(campaignId);
  } catch(e) { showToast('Error: ' + e.message); }
}

// Copies on the way to the profile. The anchor still navigates, so this runs
// alongside rather than instead of opening LinkedIn.
function _copyLinkedInNote(contactId) {
  var all = window._sampaignContactsCache || {};
  var found = null;
  Object.keys(all).forEach(function(k) {
    (all[k] || []).forEach(function(c) { if (c.id === contactId) found = c; });
  });
  if (!found || !found.linkedin_note) return;
  try {
    navigator.clipboard.writeText(found.linkedin_note);
 showToast('Note copied — paste it into the invite');
  } catch(e) {
    // Clipboard can be blocked by permissions or a non-secure context, and
    // failing silently would leave the rep pasting whatever was there before.
    showToast('Could not copy automatically — open the note and copy it');
  }
}

// ── Remove a contact from the campaign ──────────────────────────────────────
// Hard delete, deliberately. A soft-delete flag would need filtering added to
// every read path (roster, stats, sync, follow-up ladder, MCP connector
// tools) and missing one is exactly how archived campaigns kept feeding
// analytics earlier. Deleting the row means "removed" is true everywhere by
// construction, including anything reading this data over the connector,
// with no filter to forget.
async function removeSampaignContact(contactId, campaignId, label) {
  if (!confirm('Remove ' + (label || 'this contact') + ' from the SAMpaign?\n\nThey stop being counted in performance, stop receiving follow-ups, and disappear from anything reading this campaign. This cannot be undone.')) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'remove_sampaign_contacts', campaign_id: campaignId, contact_ids: [contactId] }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not remove')); return; }
 showToast('Removed from SAMpaign');
    await _loadSampaignContactsInto(campaignId);
    var c = (window._sampaignCampaignsCache || {})[campaignId] || {};
    _loadSampaignDetailPerf(campaignId, c);
  } catch(e) { showToast('Error: '+e.message); }
}

async function openSampaignScoutProfile(campaignId) {
  _sampScoutCampaignId = campaignId;
  document.getElementById('samp-scout-profile-modal')?.remove();
  var orgP = { departments: ['Sales','Marketing','Strategy'], seniorities: ['Senior','Leadership','CXO'], jobTitles: [], locations: [] };
  var campP = null;
  try {
    var reqs = [
      fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({ action:'get_org_setting', key:'stakeholder_scout_profile' }) }).then(function(r){return r.json();}),
      fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({ action:'get_org_setting', key:'scout_profile_sampaign_'+campaignId }) }).then(function(r){return r.json();})
    ];
    var res = await Promise.all(reqs);
    if (res[0] && res[0].value) { var p = JSON.parse(res[0].value); ['departments','seniorities','jobTitles','locations'].forEach(function(k){ if (Array.isArray(p[k])) orgP[k] = p[k]; }); }
    if (res[1] && res[1].value) { try { var cp = JSON.parse(res[1].value); if (cp && (cp.departments||cp.seniorities||cp.jobTitles||cp.locations)) campP = cp; } catch(e){} }
  } catch(e) {}
  var usingCamp = !!campP;
  var cur = campP || orgP;
  var chip = function(group, val, on) {
    return '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:5px 10px;border-radius:3px;border:1px solid ' + (on?'var(--gold)':'var(--border2)') + ';background:' + (on?'rgba(var(--c-accent-rgb),0.08)':'transparent') + ';color:' + (on?'var(--gold)':'var(--text2)') + ';cursor:pointer;margin:0 6px 6px 0"><input type="checkbox" data-group="' + group + '" value="' + val + '"' + (on?' checked':'') + ' style="margin:0">' + val + '</label>';
  };
  var inputStyle = 'width:100%;padding:9px 11px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;color:var(--text);font-size:13px;font-family:var(--sans);outline:none';
  var modal = document.createElement('div');
  modal.id = 'samp-scout-profile-modal';
  // z-index:100000 — this modal opens FROM the campaign detail overlay
  // (99999), so anything at or below that renders behind it. 10000 was fine
  // while it was only reachable from the plain campaign row, and silently
  // broke the moment the overlay was introduced. Same failure mode the toast
  // had. Toast now sits one above this, at 100001.
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100000;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:520px;padding:20px;max-height:85vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div style="font-size:14px;font-weight:700;color:var(--text)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13a1 1 0 100-2 1 1 0 000 2z"/></svg> Who to hunt for this SAMpaign</div><button onclick="document.getElementById(\'samp-scout-profile-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<label style="display:flex;align-items:center;gap:8px;margin:8px 0 12px;cursor:pointer"><input type="checkbox" id="samp-scout-toggle"' + (usingCamp?' checked':'') + ' style="width:15px;height:15px;accent-color:var(--gold)"><span style="font-size:12px;color:var(--text2)">Custom targets for <b>this SAMpaign only</b> (otherwise edits the org default)</span></label>' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Job titles (primary, comma separated)</div>' +
    '<textarea id="samp-scout-titles" rows="2" placeholder="e.g. CFO, Chief Financial Officer, VP Finance, Head of Procurement, Owner" style="' + inputStyle + ';resize:vertical;height:54px">' + esc((cur.jobTitles||[]).join(', ')) + '</textarea>' +
    '<div style="font-size:11px;color:var(--text3);margin:4px 0 12px">These match real titles at the account. Leave blank to use departments + seniority.</div>' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Departments</div>' +
    '<div style="margin-bottom:14px">' + _SCOUT_DEPTS.map(function(x){ return chip('dept', x, (cur.departments||[]).indexOf(x) !== -1); }).join('') + '</div>' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Seniority</div>' +
    '<div style="margin-bottom:14px">' + _SCOUT_SENIORITIES.map(function(x){ return chip('sen', x, (cur.seniorities||[]).indexOf(x) !== -1); }).join('') + '</div>' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Locations (optional, comma separated)</div>' +
    '<input id="samp-scout-locs" value="' + esc((cur.locations||[]).join(', ')) + '" placeholder="e.g. India, APAC" style="' + inputStyle + ';margin-bottom:16px"/>' +
    '<button onclick="saveSampaignScoutProfile()" style="width:100%;padding:12px;border:none;border-radius:3px;background:var(--gold);color:var(--c-canvas);font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans)">Save</button>' +
  '</div>';
  modal.addEventListener('click', function(){ modal.remove(); });
  document.body.appendChild(modal);
}

async function saveSampaignScoutProfile() {
  var depts = [], sens = [];
  document.querySelectorAll('#samp-scout-profile-modal input[type=checkbox][data-group]').forEach(function(c){
    if (!c.checked) return;
    if (c.getAttribute('data-group') === 'dept') depts.push(c.value); else sens.push(c.value);
  });
  var csv = function(id){ var el = document.getElementById(id); return el ? el.value.split(',').map(function(x){return x.trim();}).filter(Boolean) : []; };
  var profile = { departments: depts, seniorities: sens, jobTitles: csv('samp-scout-titles'), locations: csv('samp-scout-locs') };
  var perCampaign = !!(document.getElementById('samp-scout-toggle') && document.getElementById('samp-scout-toggle').checked);
  try {
    if (perCampaign && _sampScoutCampaignId) {
      await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'save_org_setting', key:'scout_profile_sampaign_'+_sampScoutCampaignId, value: JSON.stringify(profile) }) });
 showToast('Custom targets saved for this SAMpaign');
    } else {
      var jobs = [ fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'save_org_setting', key:'stakeholder_scout_profile', value: JSON.stringify(profile) }) }) ];
      if (_sampScoutCampaignId) jobs.push(fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'save_org_setting', key:'scout_profile_sampaign_'+_sampScoutCampaignId, value: JSON.stringify({}) }) }));
      await Promise.all(jobs);
 showToast('Org default targets saved');
    }
    document.getElementById('samp-scout-profile-modal')?.remove();
  } catch(e) { showToast('Error: ' + e.message); }
}

async function enrichSampaignContacts(campaignId) {
  try {
 showToast('Enriching contacts…');
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'enrich_sampaign_contacts', campaign_id: campaignId }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Enrichment unavailable')); return; }
    // Surface the real match rate, not just "done" — this is what tells you
    // whether the provider is genuinely working (checked>0) vs just missing
    // LinkedIn for these specific people (linkedin_found low/0, has a note
    // explaining it's a coverage limit, not a bug).
    var msg = '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg> Checked '+d.checked+', matched '+d.enriched+' via '+(d.provider||'—')+(d.linkedin_found!==undefined?', '+d.linkedin_found+' with LinkedIn':'');
    if (d.note) msg += ' — '+d.note;
    showToast(msg);
    var r2 = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body: JSON.stringify({ action:'list_sampaign_contacts', campaign_id: campaignId }) });
    var d2 = await r2.json();
    if (d2.ok) { window._sampaignContactsCache[campaignId] = d2.contacts || []; _renderSampaignContacts(campaignId); }
  } catch(e) { showToast('Error: '+e.message); }
}

async function handleSampaignCsv(campaignId, file) {
  if (!file) return;
  await _uploadSampaignCsvFile(campaignId, file);
  await _loadSampaignContactsInto(campaignId);
  loadSampaignCampaigns();
}

// The "outcomes flow back" moment: once a contact has actually replied AND
// is linked to a tracked account (account_id, set by the domain match in
// upload_sampaign_contacts), let the rep add them to that account's real
// Stakeholders tab. Does not create a new account — a contact with no
// account match stays out of the CRM layer, same as CLAUDE.md's
// activity-proven-only rule.
async function promoteSampaignContact(contactId, campaignId) {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'promote_sampaign_contact_to_stakeholder', contact_id: contactId }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not promote')); return; }
 showToast('Added to stakeholders on '+(d.account_name||'the account'));
  } catch(e) { showToast('Error: '+e.message); }
}

async function setSampaignContactStatus(contactId, status, campaignId) {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'update_contact_status', contact_id: contactId, status: status }) });
    var d = await r.json();
    if (!d.ok) { showToast('Error: '+(d.error||'Could not update')); return; }
    var list = window._sampaignContactsCache[campaignId] || [];
    var idx = list.findIndex(function(c){ return c.id === contactId; });
    // Merge (not replace) — update_contact_status only returns the raw
    // sampaign_contacts row, not the computed `collision` field list_
    // sampaign_contacts adds, so a plain replace would drop that badge.
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], d.contact);
    _renderSampaignContacts(campaignId); // a status change can move a contact between the Active/Prospective tabs
    loadSampaignCampaigns(); // refresh badge counts on the collapsed header too
  } catch(e) { showToast('Error: '+e.message); }
}
function toggleSdrLeadForm() {
  var f = document.getElementById('sdrLeadForm'); if (!f) return;
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  if (f.style.display === 'block') document.getElementById('sdrLeadName')?.focus();
}
async function createSdrLead() {
  var name = document.getElementById('sdrLeadName')?.value?.trim();
  var domain = document.getElementById('sdrLeadDomain')?.value?.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'') || null;
  var region = document.getElementById('sdrLeadRegion')?.value?.trim() || null;
  if (!name) { showToast('Enter a company name'); return; }
  try {
    var body = { org_id: profile.org_id, user_id: currentUser.id, sdr_user_id: currentUser.id, added_by: currentUser.id, account_name: name, domain: domain };
    if (region) body.region = region;
    var r = await fetch(SB_URL + '/rest/v1/org_accounts', { method:'POST', headers:{'apikey':SB_KEY,'Authorization':'Bearer '+currentUser.token,'Content-Type':'application/json','Prefer':'return=representation'}, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    var rows = await r.json();
    var created = Array.isArray(rows) ? rows[0] : rows;
 showToast('Lead created');
    await loadSdrPlayground();
    if (created && created.id) { window._sdrDeals[created.id] = { id:created.id, account:name, deal_value_usd:0, stage:'prospective', region:region||'' }; openSdrScout(created.id, name); }
  } catch(e) { if ((e.message||'').match(/duplicate|unique/)) showToast(name+' already exists'); else showToast('Error: '+e.message); }
}

async function loadPipeline() {
  var btn = document.getElementById('pipelineRefreshBtn');
  if (btn) btn.textContent = '↻ Loading…';
  var promptsEl = document.getElementById('pipelinePrompts');
  var summaryEl = document.getElementById('pipelineSummary');
  var chartEl = document.getElementById('pipelineChart');
  var dealsEl = document.getElementById('pipelineDeals');
  if (chartEl) chartEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:20px 0;text-align:center">Loading pipeline…</div>';

  try {
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'get_pipeline' })
    });
    _pipelineData = await r.json();
    if (!_pipelineData.ok) { if (chartEl) chartEl.innerHTML = '<div style="color:var(--coral);font-size:12px">' + esc(_pipelineData.error || 'Failed to load pipeline') + '</div>'; return; }

    // SDR role: show pipeline-generation panel (generation targets, not revenue)
    loadSdrPanel();
    loadSdrPlayground();

    // Prompts
    if (promptsEl && _pipelineData.prompts?.length) {
      promptsEl.innerHTML = _pipelineData.prompts.map(function(p) {
        return '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:2px;padding:8px 12px;margin-bottom:6px;font-size:12px;color:var(--text)">' + esc(p) + '</div>';
      }).join('');
    }

    populatePipelineFilters(_pipelineData);
    renderPipelineDashboard(_pipelineData);
    renderPipelineChart(_pipelineData);
    renderPipelineDeals(_pipelineData);
  } catch(e) {
    if (chartEl) chartEl.innerHTML = '<div style="color:var(--coral);font-size:12px">Error: ' + esc(e.message) + '</div>';
  }
  if (btn) btn.textContent = '↻ Refresh';
}

function renderPipelineChart(data) {
  var chartEl = document.getElementById('pipelineChart');
  if (!chartEl) return;

  var regions = data.regionBreakdown || [];
  if (!regions.length) { chartEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:16px 0;text-align:center">No pipeline data yet — add deal values to your accounts to see the chart.</div>'; return; }

  // Stage colours from org config
  var stageColors = { prospective: '#888780', value_prop: '#A07824', commercial: '#3B6D11', unknown: '#555' };
  var dealStages = data.dealStages || [{ key:'prospective',label:'Prospective' },{ key:'value_prop',label:'Value Prop' },{ key:'commercial',label:'Commercial' }];
  var fmtUsd = function(v) { return v >= 1000000 ? '$'+(v/1000000).toFixed(1)+'M' : '$'+Math.round(v/1000)+'K'; };

  // Filter by current view
  var filteredRegions = regions.map(function(r) {
    var total = _pipelineView === 'verified'   ? r.verified_usd :
                _pipelineView === 'partial'    ? r.partial_usd :
                _pipelineView === 'unverified' ? r.unverified_usd : r.total_usd;
    return Object.assign({}, r, { display_usd: total });
  }).filter(function(r) { return r.display_usd > 0; }).sort(function(a, b) { return b.display_usd - a.display_usd; });

  if (!filteredRegions.length) { chartEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:16px 0;text-align:center">No ' + _pipelineView + ' deals yet.</div>'; return; }

  var maxUsd = Math.max.apply(null, filteredRegions.map(function(r) { return r.display_usd; }));

  var html = '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Region × Stage pipeline</div>';

  // Legend
  html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">';
  dealStages.forEach(function(s) {
    var color = stageColors[s.key] || '#888';
    html += '<div style="display:flex;align-items:center;gap:4px"><div style="width:10px;height:10px;border-radius:2px;background:' + color + '"></div><span style="font-size:11px;color:var(--text3)">' + esc(s.label) + '</span></div>';
  });
  if (_pipelineView === 'combined') {
    html += '<div style="display:flex;align-items:center;gap:4px"><div style="width:10px;height:10px;border-radius:2px;background:repeating-linear-gradient(45deg,#888,#888 1px,transparent 1px,transparent 5px);border:1px solid #888"></div><span style="font-size:11px;color:var(--text3)">Unverified (AI)</span></div>';
  }
  html += '</div>';

  filteredRegions.forEach(function(r) {
    var barWidth = maxUsd > 0 ? Math.max(4, r.display_usd / maxUsd * 100) : 0;
    html += '<div style="margin-bottom:10px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">';
    html += '<span style="font-size:12px;font-weight:500;color:var(--text)">' + esc(r.region) + '</span>';
    html += '<span style="font-size:11px;color:var(--text2)">' + fmtUsd(r.display_usd) + ' · ' + r.deals + ' deal' + (r.deals !== 1 ? 's' : '') + '</span>';
    html += '</div>';

    // Stacked bar
    html += '<div style="height:22px;background:var(--surface);border-radius:2px;overflow:hidden;position:relative">';

    // For stage breakdown within the bar
    var stages = r.stages || {};
    var stageTotal = Object.values(stages).reduce(function(s, st) { return s + (st.usd || 0); }, 0);
    var x = 0;
    dealStages.forEach(function(s) {
      var st = stages[s.key];
      if (!st || !st.usd) return;
      var pct = stageTotal > 0 ? st.usd / stageTotal * barWidth : 0;
      var color = stageColors[s.key] || '#888';
      html += '<div style="position:absolute;top:0;left:' + x + '%;width:' + pct + '%;height:100%;background:' + color + '"></div>';
      x += pct;
    });

    // Unverified overlay (hatched) in combined view
    if (_pipelineView === 'combined' && r.unverified_usd > 0 && r.total_usd > 0) {
      var unvPct = r.unverified_usd / r.total_usd * barWidth;
      html += '<div style="position:absolute;top:0;right:0;width:' + unvPct + '%;height:100%;background:repeating-linear-gradient(45deg,rgba(136,135,128,0.3),rgba(136,135,128,0.3) 2px,transparent 2px,transparent 6px);border-left:1px solid rgba(255,255,255,0.3)"></div>';
    }

    html += '</div>';
    html += '</div>';
  });

  // Closing this quarter highlight
  var cq = (data.summary || {}).closing_this_quarter_usd || 0;
  if (cq > 0) {
    html += '<div style="margin-top:10px;padding:8px 12px;background:rgba(74,140,92,0.1);border:1px solid rgba(74,140,92,0.3);border-radius:2px;font-size:11px;color:var(--green)"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"/></svg> <strong>' + fmtUsd(cq) + '</strong> expected to close this quarter</div>';
  }

  chartEl.innerHTML = html;
}

function renderPipelineDeals(data) {
  var el = document.getElementById('pipelineDeals');
  if (!el) return;

  var deals = _pipelineView === 'verified'   ? (data.verified || []) :
              _pipelineView === 'partial'    ? (data.partial  || []) :
              _pipelineView === 'unverified' ? (data.unverified || []) :
              [...(data.verified || []), ...(data.partial || []), ...(data.unverified || [])];

  deals.sort(function(a, b) { return (b.deal_value_usd || 0) - (a.deal_value_usd || 0); });

  if (!deals.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:16px 0;text-align:center">No deals in this view yet.</div>'; return; }

  var stageColors = { prospective: '#888780', value_prop: '#A07824', commercial: '#3B6D11', unknown: '#555' };
  var fmtUsd = function(v) { if (!v) return '—'; return v >= 1000000 ? '$'+(v/1000000).toFixed(1)+'M' : '$'+Math.round(v/1000)+'K'; };
  var tierConfig = {
    verified:   { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>', label: 'Verified',   color: 'var(--green)' },
    partial:    { icon: '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3L5 13.5h5.5L9.5 21l8.5-10.5h-5.5z"/></svg>', label: 'Partial',    color: 'var(--amber)' },
    unverified: { icon: '〜', label: 'Unverified', color: 'var(--text3)' }
  };

  // ── Group deals by company brand root ─────────────────────────────────────
  // "Ferrero India IR" + "Ferrero India Route Opt" → group under "Ferrero"
  var brandRoot = function(name) {
    return (name || '').split(/[\s\-_\/]/)[0].toLowerCase();
  };
  var groups = {};
  var groupOrder = [];
  deals.forEach(function(d) {
    var root = brandRoot(d.account);
    if (!groups[root]) { groups[root] = []; groupOrder.push(root); }
    groups[root].push(d);
  });

  var renderDealCard = function(d) {
    var stageColor = stageColors[d.stage] || 'var(--text3)';
    var prob = d.close_probability || 0;
    var tc = tierConfig[d.tier] || tierConfig.unverified;
    var localValue = d.deal_value ? (d.deal_currency || 'USD') + ' ' + Number(d.deal_value).toLocaleString() : null;
    var scoreBar = d.signal_score != null
      ? '<div style="display:inline-flex;align-items:center;gap:4px;margin-left:6px"><div style="width:40px;height:4px;background:var(--border2);border-radius:2px;overflow:hidden"><div style="height:100%;background:' + (d.signal_score>=60?'var(--green)':d.signal_score>=40?'var(--amber)':'var(--coral)') + ';width:' + d.signal_score + '%"></div></div><span style="font-size:11px;color:var(--text3)">' + d.signal_score + '</span></div>'
      : '';
    var healthBadge = d.health_score != null
      ? '<span onclick="event.stopPropagation();openHealthBreakdown(\'' + esc(d.id) + '\',\'' + esc(d.account) + '\')" style="font-size:11px;padding:1px 5px;border-radius:2px;margin-left:4px;cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px;background:' +
        (d.health_score>=70?'rgba(74,140,92,0.15)':d.health_score>=40?'rgba(var(--c-accent-rgb),0.15)':'rgba(192,82,63,0.15)') +
        ';color:' + (d.health_score>=70?'var(--green)':d.health_score>=40?'var(--amber)':'var(--coral)') +
        '" title="Why this score? Tap for rule-level breakdown">H:' + d.health_score + '</span>'
      : '';
    var sparkline = _renderSparkline(d.score_history || []);
    // Rep initials badge
    var repInitials = (d.rep_email||'').split('@')[0].split(/[._]/).map(function(w){return w[0]||'';}).slice(0,2).join('').toUpperCase();
    var repBadge = repInitials ? '<span style="font-size:11px;width:18px;height:18px;border-radius:50%;background:var(--surface2);border:1px solid var(--border2);display:inline-flex;align-items:center;justify-content:center;color:var(--text3);flex-shrink:0" title="' + esc((d.rep_email||'').split('@')[0]) + '">' + repInitials + '</span>' : '';

    return '<div class="deal-card-row" data-deal-id="' + esc(d.id) + '" data-deal-account="' + esc(d.account) + '" style="background:var(--surface);border:1px solid var(--border2);border-radius:2px;padding:10px 12px;margin-bottom:6px;cursor:pointer;transition:border-color 0.15s" onmouseenter="this.style.borderColor=\'var(--gold)\'" onmouseleave="this.style.borderColor=\'var(--border2)\'">' +
      '<div style="display:flex;align-items:flex-start;gap:10px">' +
        '<div style="flex:1">' +
          '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">' +
            repBadge +
            '<span style="font-size:12px;font-weight:500;color:var(--text)">' + esc(d.account) + '</span>' +
            (d.region ? '<span style="font-size:11px;color:var(--text3);background:rgba(0,0,0,0.08);border-radius:2px;padding:1px 6px">' + esc(d.region) + '</span>' : '') +
            '<span style="font-size:11px;font-weight:600;padding:1px 7px;border-radius:3px;background:' + stageColor + '22;color:' + stageColor + '">' + esc(d.stage) + '</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">' +
            '<span style="font-size:11px;color:' + tc.color + ';font-weight:500">' + tc.icon + ' ' + tc.label + '</span>' +
            scoreBar + healthBadge + sparkline +
          '</div>' +
          // Risk chips — named, deterministic, each carries its evidence (tap to see)
          ((d.risks && d.risks.length)
            ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px">' + d.risks.map(function(rk) {
                var rc = rk.severity === 'high' ? 'var(--coral)' : rk.severity === 'medium' ? 'var(--amber)' : 'var(--text3)';
                return '<span onclick="event.stopPropagation();showToast(this.dataset.ev)" data-ev="' + esc((rk.evidence || '').replace(/"/g, '&quot;')) + '" title="' + esc(rk.evidence || '') + '" style="font-size:11px;font-weight:600;padding:1px 6px;border-radius:2px;border:1px solid ' + rc + ';color:' + rc + ';cursor:help">' + esc(rk.label) + '</span>';
              }).join('') + '</div>'
            : '') +
          '<div style="font-size:11px;color:var(--text3);font-style:italic;margin-bottom:4px">' + esc(d.verification_reason || '') + '</div>' +
          (d.hint_context ? '<div style="font-size:11px;color:var(--text3);font-style:italic">"' + esc(d.hint_context.slice(0, 100)) + '"</div>' : '') +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:2px">' +
            (localValue ? '<span style="font-size:11px;color:var(--text2)">Local: ' + localValue + '</span>' : '') +
 '<span class="edit-close-date-btn" data-opp-id="'+esc(d.id||'')+'" data-account="'+esc(d.account||'')+'" data-close="'+esc(d.expected_close||'')+'" style="font-size:11px;color:'+(d.expected_close?'var(--gold)':'var(--text3)')+';cursor:pointer;'+(d.expected_close?'font-weight:600':'')+'">'+( d.expected_close?''+d.expected_close:'+ Set close date')+'</span>' +
            (d.licenses_units ? '<span style="font-size:11px;color:var(--text3)">' + d.licenses_units + ' units</span>' : '') +
            (d.icp_score != null ? '<span style="font-size:11px;font-weight:600;padding:1px 6px;border-radius:2px;background:' + (d.icp_score>=70?'rgba(74,140,92,.15)':d.icp_score>=40?'rgba(var(--c-accent-rgb),.15)':'rgba(136,135,128,.15)') + ';color:' + (d.icp_score>=70?'var(--green)':d.icp_score>=40?'var(--gold)':'var(--text3)') + '" title="ICP fit: ' + esc(d.icp_notes||'') + '">ICP ' + d.icp_score + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0">' +
          '<div style="font-size:16px;font-weight:600;color:var(--gold)">' + fmtUsd(d.deal_value_usd) + '</div>' +
          '<div style="font-size:11px;color:var(--text3)">USD</div>' +
          '<div style="margin-top:4px;font-size:11px;color:var(--text3)">' + prob + '% → ' + fmtUsd(d.weighted_value_usd) + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">' +
 '<button onclick="' + (d.tier==='verified' ? 'openDealValueForm(\''+d.id+'\',\''+esc(d.account)+'\')' : d.tier==='partial' ? 'boostSignals(\''+d.id+'\',\''+esc(d.account)+'\')' : 'openDealValueForm(\''+d.id+'\',\''+esc(d.account)+'\')') + '" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid ' + (d.tier==='verified'?'var(--border2)':d.tier==='partial'?'var(--amber)':'var(--green)') + ';background:transparent;color:' + (d.tier==='verified'?'var(--text3)':d.tier==='partial'?'var(--amber)':'var(--green)') + ';cursor:pointer">' + (d.tier==='verified'?'Edit':d.tier==='partial'?'Boost':'Confirm') + '</button>' +
            '<button onclick="openAccountTimeline(\''+esc(d.id)+'\',\''+esc(d.account)+'\')" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 10px;border-radius:2px;border:1px solid rgba(var(--c-accent-rgb),0.4);background:rgba(var(--c-accent-rgb),0.08);color:var(--gold);font-weight:600;cursor:pointer"><img src="icons/icon-48.png" alt="" style="width:12px;height:12px;border-radius:50%"/>Timeline</button>' +
            '<button onclick="openCloseDeal(\''+esc(d.id)+'\',\''+esc(d.account)+'\')" style="font-size:11px;padding:3px 10px;border-radius:2px;border:1px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer">Close deal</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  };

  var html = '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Deal breakdown</div>';

  groupOrder.forEach(function(root) {
    var group = groups[root];
    if (group.length === 1) {
      // Single deal — render directly with LinkedIn icon
      var d = group[0];
      var liLink = d.company_linkedin_url
        ? '<a href="' + esc(d.company_linkedin_url) + '" target="_blank" onclick="event.stopPropagation()" title="LinkedIn company page" style="display:inline-flex;align-items:center;color:#0A66C2;opacity:0.85;text-decoration:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>'
        : '';
      // Inject liLink into first name span — we do it via a wrapper
      html += renderDealCard(d).replace(
        '<span style="font-size:12px;font-weight:500;color:var(--text)">' + esc(d.account) + '</span>',
        '<span style="font-size:12px;font-weight:500;color:var(--text)">' + esc(d.account) + '</span>' + liLink
      );
    } else {
      // Multiple deals for same company — show company header + grouped cards
      var totalVal = group.reduce(function(s, d) { return s + (d.deal_value_usd||0); }, 0);
      var liLink2 = group[0].company_linkedin_url
        ? '<a href="' + esc(group[0].company_linkedin_url) + '" target="_blank" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;color:#0A66C2;opacity:0.85;text-decoration:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>'
        : '';
      var repAvatars = group.map(function(d) {
        var ini = (d.rep_email||'').split('@')[0].split(/[._]/).map(function(w){return w[0]||'';}).slice(0,2).join('').toUpperCase();
        return '<span style="font-size:11px;width:20px;height:20px;border-radius:50%;background:var(--surface2);border:1px solid var(--border2);display:inline-flex;align-items:center;justify-content:center;color:var(--text3);margin-left:-4px" title="' + esc((d.rep_email||'').split('@')[0]) + '">' + ini + '</span>';
      }).join('');

      html += '<div style="border:1px solid var(--border2);border-radius:3px;padding:10px 12px;margin-bottom:8px;background:var(--bg)">';
      // Company header row
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)">';
      html += '<span style="font-size:13px;font-weight:600;color:var(--text)">' + esc(group[0].account.split(/[\s]/)[0]) + '</span>';
      html += liLink2;
      html += '<span style="font-size:11px;color:var(--text3)">' + group.length + ' opportunities</span>';
      html += '<span style="font-size:11px;font-weight:600;color:var(--gold);margin-left:auto">' + fmtUsd(totalVal) + ' total</span>';
      html += '<div style="display:flex;margin-left:8px">' + repAvatars + '</div>';
      html += '</div>';
      // Sub-deals
      group.forEach(function(d) {
        html += renderDealCard(d);
      });
      html += '</div>';
    }
  });

  el.innerHTML = html;
}


// ── Close Deal Modal ──────────────────────────────────────────────────────────
// ── Edit close date per opportunity ──────────────────────────────────────────
async function editCloseDate(oppId, accountName, currentDate) {
  document.getElementById('edit-close-modal')?.remove();
  var modal = document.createElement('div');
  modal.id = 'edit-close-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;z-index:9999';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:480px;padding:22px 20px" onclick="event.stopPropagation()">' +
 '<div style="font-size:15px;font-weight:700;margin-bottom:4px">Edit close date</div>' +
    '<div style="font-size:12px;color:var(--text3);margin-bottom:14px">' + esc(String(accountName||'')) + '</div>' +
    '<input type="date" id="editCloseDateInput" value="' + esc(String(currentDate||'')) + '" style="width:100%;padding:11px;background:var(--surface2);border:1px solid var(--border);border-radius:3px;color:var(--text);font-family:var(--sans);font-size:14px;outline:none;margin-bottom:14px"/>' +
    '<button id="saveCloseDateBtn" style="width:100%;padding:12px;background:var(--gold);border:none;border-radius:3px;color:var(--c-canvas);font-family:var(--sans);font-size:14px;font-weight:700;cursor:pointer">Save</button>' +
    '<button id="cancelCloseDateBtn" style="width:100%;padding:10px;background:none;border:none;color:var(--text3);font-family:var(--sans);font-size:13px;cursor:pointer;margin-top:4px">Cancel</button>' +
  '</div>';
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
  document.getElementById('saveCloseDateBtn').addEventListener('click', function(){ saveCloseDate(oppId); });
  document.getElementById('cancelCloseDateBtn').addEventListener('click', function(){ modal.remove(); });
}

async function saveCloseDate(oppId) {
  var val = document.getElementById('editCloseDateInput')?.value;
  if (!val) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'update_opportunity_field', opportunity_id:oppId, field:'expected_close', value:val}) });
    var d = await r.json();
    if (d.ok) { showToast('Close date updated'); document.getElementById('edit-close-modal')?.remove(); loadPipeline(); }
    else { showToast('Error: ' + (d.error||'Failed')); }
  } catch(e) { showToast('Error: ' + e.message); }
}

function openCloseDeal(opportunityId, accountName) {
  document.getElementById('close-deal-modal')?.remove();
  var modal = document.createElement('div');
  modal.id = 'close-deal-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:480px;padding:22px 20px" onclick="event.stopPropagation()">' +
    '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">Close deal</div>' +
    '<div style="font-size:12px;color:var(--text3);margin-bottom:16px">' + esc(accountName) + '</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:14px">' +
 '<button id="cd-won-btn" onclick="setCloseStatus(\'won\')" style="flex:1;padding:12px;border-radius:10px;border:2px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--sans);font-size:14px;font-weight:600;cursor:pointer">Won</button>' +
 '<button id="cd-lost-btn" onclick="setCloseStatus(\'lost\')" style="flex:1;padding:12px;border-radius:10px;border:2px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--sans);font-size:14px;font-weight:600;cursor:pointer">Lost</button>' +
    '</div>' +
    '<div id="cd-won-fields" style="display:none;margin-bottom:12px">' +
      '<label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Actual close value (USD)</label>' +
      '<input id="cd-actual-value" type="number" placeholder="e.g. 45000" style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;color:var(--text);font-family:var(--sans);font-size:14px;outline:none;box-sizing:border-box"/>' +
    '</div>' +
    '<div id="cd-lost-fields" style="display:none;margin-bottom:12px">' +
      '<label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Loss reason</label>' +
      '<select id="cd-reason" style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:2px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none">' +
        '<option value="">Select reason…</option>' +
        '<option value="price">Price / budget</option>' +
        '<option value="competitor">Lost to competitor</option>' +
        '<option value="no_decision">No decision / shelved</option>' +
        '<option value="timing">Bad timing</option>' +
        '<option value="product_fit">Product fit</option>' +
        '<option value="champion_left">Champion left the company</option>' +
        '<option value="other">Other</option>' +
      '</select>' +
    '</div>' +
    '<button onclick="confirmCloseDeal(\'' + esc(opportunityId) + '\')" style="width:100%;padding:13px;border:none;border-radius:3px;background:var(--gold);color:var(--c-canvas);font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans)">Confirm close</button>' +
    '<button onclick="document.getElementById(\'close-deal-modal\').remove()" style="width:100%;padding:10px;border:none;background:none;color:var(--text3);font-size:13px;cursor:pointer;font-family:var(--sans);margin-top:4px">Cancel</button>' +
  '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);
}
var _cdStatus = '';
function setCloseStatus(status) {
  _cdStatus = status;
  var wonBtn = document.getElementById('cd-won-btn'), lostBtn = document.getElementById('cd-lost-btn');
  var wonF = document.getElementById('cd-won-fields'), lostF = document.getElementById('cd-lost-fields');
  if (wonBtn) wonBtn.style.borderColor = status==='won' ? 'var(--green)' : 'var(--border)';
  if (lostBtn) lostBtn.style.borderColor = status==='lost' ? 'var(--coral)' : 'var(--border)';
  if (wonF) wonF.style.display = status==='won' ? 'block' : 'none';
  if (lostF) lostF.style.display = status==='lost' ? 'block' : 'none';
}
async function confirmCloseDeal(opportunityId) {
  if (!_cdStatus) { alert('Select Won or Lost'); return; }
  var actualValue = document.getElementById('cd-actual-value')?.value;
  var reason = document.getElementById('cd-reason')?.value;
  try {
    await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'close_opportunity', opportunity_id:opportunityId, status:_cdStatus, close_reason:reason||null, actual_value_usd:actualValue?parseFloat(actualValue):null })
    });
    document.getElementById('close-deal-modal')?.remove();
 showToast(_cdStatus === 'won' ? 'Deal marked Won' : 'Deal marked Lost');
    if (typeof loadPipeline === 'function') loadPipeline();
  } catch(e) { alert('Error: ' + e.message); }
}

// ── Account Timeline ──────────────────────────────────────────────────────────
var _tlDays = 60;
async function openAccountTimeline(accountId, accountName) {
  document.getElementById('timeline-modal')?.remove();
  window._tlAcct = { id: accountId, name: accountName };
  var modal = document.createElement('div');
  modal.id = 'timeline-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  var rangeBtns = [30,60,180].map(function(dn){
    var on = _tlDays === dn;
    return '<span onclick="_setTimelineDays(' + dn + ')" style="padding:3px 11px;cursor:pointer;font-size:11px;background:' + (on?'var(--surface)':'transparent') + ';color:' + (on?'var(--text)':'var(--text3)') + '">' + dn + 'd</span>';
  }).join('');
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:520px;padding:20px;max-height:82vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
      '<div><div style="font-size:14px;font-weight:700;color:var(--text)">Account timeline</div><div id="timeline-sub" style="font-size:12px;color:var(--text3)">' + esc(accountName) + ' · last ' + _tlDays + ' days</div></div>' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span id="timeline-range" style="display:inline-flex;border:1px solid var(--border2);border-radius:2px;overflow:hidden">' + rangeBtns + '</span>' +
 '<button onclick="document.getElementById(\'timeline-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"></button>' +
      '</div>' +
    '</div>' +
    '<div style="margin-bottom:12px">' + _samoraIntelLabel('Intelligence-guided timeline') + '</div>' +
    '<div id="timeline-body"><div style="font-size:12px;color:var(--text3);padding:20px 0;text-align:center">Loading…</div></div>' +
  '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);
  _loadTimelineBody();
}

function _setTimelineDays(dn) {
  _tlDays = dn;
  ['30','60','180'].forEach(function(){});
  var rng = document.getElementById('timeline-range');
  if (rng) rng.innerHTML = [30,60,180].map(function(x){
    var on = _tlDays === x;
    return '<span onclick="_setTimelineDays(' + x + ')" style="padding:3px 11px;cursor:pointer;font-size:11px;background:' + (on?'var(--surface)':'transparent') + ';color:' + (on?'var(--text)':'var(--text3)') + '">' + x + 'd</span>';
  }).join('');
  var sub = document.getElementById('timeline-sub');
  if (sub && window._tlAcct) sub.textContent = window._tlAcct.name + ' · last ' + _tlDays + ' days';
  _loadTimelineBody();
}

async function _loadTimelineBody() {
  var body = document.getElementById('timeline-body');
  if (!body || !window._tlAcct) return;
  body.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:20px 0;text-align:center">Loading…</div>';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'get_account_timeline', account_id:window._tlAcct.id, days:_tlDays }) });
    var data = await r.json();
    body = document.getElementById('timeline-body'); if (!body) return;
    var acts = (data.activities || data.timeline || []).filter(function(e){ return e && e.date; });
    var series = data.score_series || [];
    if (!acts.length && !series.length) { body.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:20px 0;text-align:center">No activity found in the last ' + _tlDays + ' days.</div>'; return; }
    body.innerHTML = _renderTimelineIntel(acts, data.engagement, series) + _renderTimelineEvents(acts);
  } catch(e) {
    var b = document.getElementById('timeline-body');
    if (b) b.innerHTML = '<div style="color:var(--coral);font-size:12px">Error: ' + esc(e.message) + '</div>';
  }
}

function _tlDaysAgo(dateStr) { return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000); }

// ── Samora Intelligence panel: temperature, momentum, activity, engagement ───
function _renderTimelineIntel(acts, engagement, series) {
  series = (series || []).filter(function(s){ return s && s.date; }).slice().sort(function(a,b){ return new Date(a.date) - new Date(b.date); });
  var firstScore = series.length ? series[0].score : null;
  var lastScore = series.length ? series[series.length - 1].score : null;
  var scoreDelta = (firstScore != null && lastScore != null) ? lastScore - firstScore : null;

  var actDates = acts.map(function(a){ return a.date; }).filter(Boolean).sort();
  var lastDate = actDates.length ? actDates[actDates.length - 1] : (series.length ? series[series.length - 1].date : null);
  var daysQuiet = lastDate ? _tlDaysAgo(lastDate) : null;

  var activeDays = {};
  acts.forEach(function(a){ if (a.date) activeDays[a.date.slice(0,10)] = 1; });
  var nActiveDays = Object.keys(activeDays).length;
  var realTouches = acts.filter(function(a){ return a.type !== 'score_change'; }).length;

  var sent = { positive:0, negative:0, neutral:0 };
  acts.forEach(function(a){ if (a.sentiment && sent[a.sentiment] != null) sent[a.sentiment]++; });
  var sentTot = sent.positive + sent.negative + sent.neutral;

  var temp, tempColor, tempWhy;
  if (daysQuiet == null) { temp = 'Quiet'; tempColor = 'var(--text3)'; tempWhy = 'no dated activity on record'; }
  else if (daysQuiet <= 3 && (scoreDelta || 0) > 0) { temp = 'Hot'; tempColor = 'var(--coral)'; tempWhy = 'touched in the last ' + daysQuiet + ' day' + (daysQuiet===1?'':'s') + ', signal rising'; }
  else if ((scoreDelta || 0) > 0 && daysQuiet <= 14) { temp = 'Warming'; tempColor = 'var(--amber)'; tempWhy = 'signal up ' + scoreDelta + ' points, active this fortnight'; }
  else if (daysQuiet <= 14) { temp = 'Steady'; tempColor = 'var(--green)'; tempWhy = 'consistent contact, last touch ' + daysQuiet + ' day' + (daysQuiet===1?'':'s') + ' ago'; }
  else if (daysQuiet <= 30 || (scoreDelta || 0) < 0) { temp = 'Cooling'; tempColor = 'var(--amber)'; tempWhy = daysQuiet + ' days quiet' + ((scoreDelta||0) < 0 ? ', signal slipping' : ''); }
  else { temp = 'Cold'; tempColor = 'var(--coral)'; tempWhy = 'no activity for ' + daysQuiet + ' days'; }

  var momTxt = scoreDelta == null ? 'n/a' : (scoreDelta > 0 ? '+' + scoreDelta : String(scoreDelta));
  var momColor = scoreDelta == null ? 'var(--text3)' : (scoreDelta > 0 ? 'var(--green)' : scoreDelta < 0 ? 'var(--coral)' : 'var(--text3)');
  var momSub = (firstScore != null && lastScore != null) ? firstScore + ' to ' + lastScore : 'no score history';

  var tiles = [
    { label:'Temperature', value: temp, sub:'', color: tempColor },
    { label:'Signal momentum', value: momTxt, sub: momSub, color: momColor },
    { label:'Last touch', value: daysQuiet == null ? 'n/a' : (daysQuiet === 0 ? 'today' : daysQuiet + 'd ago'), sub: nActiveDays + ' active day' + (nActiveDays===1?'':'s'), color: (daysQuiet != null && daysQuiet <= 14) ? 'var(--green)' : 'var(--amber)' },
    { label:'Activities', value: String(realTouches), sub:'meetings, mails, notes', color:'var(--text)' }
  ];

  var h = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:14px;margin-bottom:16px">';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
    '<span style="font-size:13px;font-weight:700;color:' + tempColor + '">' + temp + '</span>' +
    '<span style="font-size:12px;color:var(--text3)">' + esc(tempWhy) + '</span>' +
  '</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">';
  tiles.forEach(function(t) {
    h += '<div style="background:var(--surface2);border-radius:3px;padding:9px 11px">' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:2px">' + t.label + '</div>' +
      '<div style="font-size:16px;font-weight:700;color:' + t.color + ';line-height:1.1">' + esc(t.value) + '</div>' +
      (t.sub ? '<div style="font-size:11px;color:var(--text3);margin-top:1px">' + esc(t.sub) + '</div>' : '') +
    '</div>';
  });
  h += '</div>';

  if (engagement && engagement.sent != null) {
    var eg = engagement;
    var latTxt = eg.reply_latency_hours == null ? 'n/a' : eg.reply_latency_hours < 24 ? eg.reply_latency_hours + 'h' : Math.round(eg.reply_latency_hours / 24) + 'd';
    var eTiles = [
      { label:'Reply rate', value: eg.reply_rate != null ? eg.reply_rate + '%' : 'n/a', color:'var(--gold)' },
      { label:'Reply speed', value: latTxt, color: (eg.reply_latency_hours != null && eg.reply_latency_hours <= 48) ? 'var(--green)' : 'var(--text2)' },
      { label:'Msgs / 14d', value: String(eg.thread_velocity_14d || 0), color: eg.thread_velocity_14d ? 'var(--green)' : 'var(--text3)' },
      { label:'Contacts', value: String(eg.contacts_seen || 0) + (eg.new_contacts_14d ? ' (+' + eg.new_contacts_14d + ')' : ''), color: eg.new_contacts_14d ? 'var(--green)' : 'var(--text2)' }
    ];
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border2)">';
    eTiles.forEach(function(t) {
      h += '<div style="text-align:center"><div style="font-size:14px;font-weight:700;color:' + t.color + '">' + esc(t.value) + '</div><div style="font-size:11px;color:var(--text3)">' + t.label + '</div></div>';
    });
    h += '</div>';
    var notes = [];
    if (eg.new_contacts_14d) notes.push(eg.new_contacts_14d + ' new contact' + (eg.new_contacts_14d===1?'':'s') + ' entered the thread this fortnight, buying group widening');
    if (eg.inbound_initiated) notes.push('they emailed first, inbound-initiated');
    if (eg.sent && !eg.replies) notes.push(eg.sent + ' sent, no reply yet');
    if (notes.length) h += '<div style="font-size:11px;color:var(--text3);margin-top:6px;font-style:italic">' + esc(notes.join(' · ')) + '</div>';
  }

  if (sentTot) {
    var pos = Math.round(sent.positive / sentTot * 100);
    h += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border2)">' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:4px"><span>Sentiment across ' + sentTot + ' activit' + (sentTot===1?'y':'ies') + '</span><span>' + pos + '% positive</span></div>' +
      '<div style="display:flex;height:5px;border-radius:2px;overflow:hidden;background:var(--surface2)">' +
        (sent.positive ? '<div style="width:' + (sent.positive/sentTot*100) + '%;background:var(--green)"></div>' : '') +
        (sent.neutral ? '<div style="width:' + (sent.neutral/sentTot*100) + '%;background:var(--text3)"></div>' : '') +
        (sent.negative ? '<div style="width:' + (sent.negative/sentTot*100) + '%;background:var(--coral)"></div>' : '') +
      '</div>' +
    '</div>';
  }
  h += '</div>';
  return h;
}

// ── Activity feed: each event with sentiment, signal impact, and a why toggle ─
function _renderTimelineEvents(acts) {
  var sentColors = { positive:'var(--green)', negative:'var(--coral)', neutral:'var(--text3)' };
  var fmt = function(d) { return d ? new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : ''; };
  var h = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Activity</div>';
  if (!acts.length) {
    return h + '<div style="font-size:12px;color:var(--text3);font-style:italic;padding:4px 0">No account activity in the window. Signal has held steady.</div>';
  }
  h += acts.map(function(a, idx) {
    var col = sentColors[a.sentiment] || 'var(--text3)';
    var wid = 'tlwhy-' + idx;
    var chip = '';
    if (a.delta != null && a.delta !== 0) {
      var dc = a.delta > 0 ? 'var(--green)' : 'var(--coral)';
      chip = '<span style="font-size:11px;font-weight:700;color:' + dc + ';background:var(--surface2);padding:1px 7px;border-radius:2px;flex-shrink:0">' + (a.delta > 0 ? '+' : '') + a.delta + '</span>';
    } else if (a.impact === 'up') {
      chip = '<span style="font-size:11px;color:var(--green);flex-shrink:0" title="lifts the signal">▲</span>';
    } else if (a.impact === 'down') {
      chip = '<span style="font-size:11px;color:var(--coral);flex-shrink:0" title="weighs on the signal">▼</span>';
    }
    return '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">' +
      '<div style="width:44px;flex-shrink:0;text-align:right;font-size:11px;color:var(--text3);padding-top:3px">' + esc(fmt(a.date)) + '</div>' +
      '<div style="width:3px;flex-shrink:0;background:' + col + ';border-radius:2px"></div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:7px">' +
          '<span style="font-size:12px;font-weight:600;color:var(--text);flex:1;min-width:0">' + esc(a.title || '') + '</span>' +
          chip +
        '</div>' +
        (a.body ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + esc(a.body.slice(0,120)) + '</div>' : '') +
        (a.why ? '<div style="margin-top:3px">' +
          '<span onclick="toggleIntelDrill(\'' + wid + '\')" style="font-size:11px;color:var(--gold);cursor:pointer;user-select:none">why?</span>' +
          '<div id="' + wid + '" style="display:none;font-size:11px;color:var(--text2);line-height:1.5;margin-top:4px;padding:8px 10px;background:var(--surface2);border-radius:2px">' + esc(a.why) + '</div>' +
        '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');
  return h;
}

// ── "Why this score?" — rule-level health-score breakdown ────────────────────
// Transparency principle: every number shows its receipts.
async function openHealthBreakdown(accountId, accountName) {
  document.getElementById('health-breakdown-modal')?.remove();
  var modal = document.createElement('div');
  modal.id = 'health-breakdown-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = '<div style="background:var(--bg);border-radius:3px 16px 0 0;width:100%;max-width:520px;padding:20px;max-height:80vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
      '<div><div style="font-size:14px;font-weight:700;color:var(--text)">Why this score?</div><div style="font-size:12px;color:var(--text3)">' + esc(accountName) + ' · deal health breakdown</div></div>' +
 '<button onclick="document.getElementById(\'health-breakdown-modal\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3)"></button>' +
    '</div>' +
    '<div style="margin-bottom:12px">' + _samoraIntelLabel('Deterministic rules, no AI in this number') + '</div>' +
    '<div id="health-breakdown-body"><div style="font-size:12px;color:var(--text3);padding:20px 0;text-align:center">Loading…</div></div>' +
  '</div>';
  modal.addEventListener('click', function() { modal.remove(); });
  document.body.appendChild(modal);

  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body: JSON.stringify({ action:'get_health_breakdown', account_id:accountId }) });
    var data = await r.json();
    var body = document.getElementById('health-breakdown-body');
    if (!body) return;
    if (!data.ok || !data.components || !data.components.length) {
      // Honest empty state — never fake a breakdown
      body.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:20px 8px;text-align:center;line-height:1.5">' +
        'No breakdown available for this score yet.<br>It may have been computed before the transparency update. It will populate on the next scoring run.</div>';
      return;
    }

    var rows = data.components.map(function(c) {
      var pts = Math.round(c.points || 0);
      var maxPts = c.weight || 0;
      var pct = maxPts ? Math.min(100, Math.round((pts / maxPts) * 100)) : 0;
      var barColor = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--coral)';
      return '<div style="padding:10px 0;border-bottom:1px solid var(--border)">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">' +
          '<span style="font-size:12px;font-weight:600;color:var(--text)">' + esc(c.label || c.key || '') + ' <span style="font-weight:400;color:var(--text3)">· weight ' + maxPts + '%</span></span>' +
          '<span style="font-size:12px;font-weight:700;color:' + barColor + '">' + pts + ' / ' + maxPts + '</span>' +
        '</div>' +
        '<div style="height:4px;background:var(--border2);border-radius:2px;overflow:hidden;margin-bottom:5px"><div style="height:100%;width:' + pct + '%;background:' + barColor + '"></div></div>' +
        (c.raw ? '<div style="font-size:11px;color:var(--text2)">' + esc(c.raw) + '</div>' : '') +
        (c.evidence ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">Evidence: ' + esc(c.evidence) + (c.evidence_date ? ' · ' + esc(new Date(c.evidence_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})) : '') + '</div>' : '') +
      '</div>';
    }).join('');

    var computedAt = data.computed_at ? new Date(data.computed_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : null;
    body.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 4px">' +
        '<span style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em">Rule</span>' +
        '<span style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em">Points</span>' +
      '</div>' +
      rows +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0 4px">' +
        '<span style="font-size:13px;font-weight:700;color:var(--text)">Health score</span>' +
        '<span style="font-size:16px;font-weight:700;color:var(--gold)">' + (data.health_score != null ? data.health_score : '—') + ' / 100</span>' +
      '</div>' +
      (computedAt ? '<div style="font-size:11px;color:var(--text3);text-align:right">Computed ' + esc(computedAt) + '</div>' : '') +
      '<div style="font-size:11px;color:var(--text3);margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">Weights are org-configurable in Admin → Deal health score weights.</div>';
  } catch(e) {
    var b = document.getElementById('health-breakdown-body');
    if (b) b.innerHTML = '<div style="color:var(--coral);font-size:12px">Error: ' + esc(e.message) + '</div>';
  }
}

// ── ICP Definition & Scoring ──────────────────────────────────────────────────
async function loadIcpDefinition() {
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'get_org_setting', key:'icp_definition'}) });
    var d = await r.json();
    var el = document.getElementById('icpDefinitionInput');
    if (el && d.value) el.value = d.value;
  } catch(e) { /* non-fatal */ }
}

async function saveIcpDefinition() {
  var btn    = document.getElementById('saveIcpBtn');
  var badge  = document.getElementById('icpSavedBadge');
  var status = document.getElementById('icpScoreStatus');
  var val    = document.getElementById('icpDefinitionInput')?.value?.trim();
  if (!val) { showToast('Please enter an ICP definition first'); return; }
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'save_org_setting', key:'icp_definition', value:val}) });
    var d = await r.json();
    if (d.ok) {
      if (badge) badge.style.display = 'inline';
      if (status) status.textContent = 'Saved — click "Score accounts now" to update ICP scores.';
      showToast('ICP definition saved');
    } else { showToast('Error: ' + (d.error || 'Save failed')); }
  } catch(e) { showToast('Error: ' + e.message); }
  if (btn) { btn.textContent = 'Save ICP definition'; btn.disabled = false; }
}

async function runIcpScoring() {
  var btn     = document.querySelector('[onclick="runIcpScoring()"]');
  var samBtn  = document.getElementById('icp-score-btn');
  var status  = document.getElementById('icpScoreStatus');
  var results = document.getElementById('icpScoreResults');
 [btn, samBtn].forEach(function(b){ if(b){b.textContent='Scoring…';b.disabled=true;} });
 if (status) status.textContent = 'Gemini is scoring your accounts…';
  if (results) results.innerHTML = '';
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY}, body:JSON.stringify({action:'compute_icp_scores'}) });
    var d = await r.json();
    if (!d.ok) { if (status) status.textContent = 'Error: ' + (d.error||'Scoring failed'); return; }
 if (status) status.textContent = 'Scored ' + (d.scored||0) + ' accounts';
    showToast('ICP scored: ' + (d.scored||0) + ' accounts updated');
    if (d.scores && d.scores.length && results) {
      results.innerHTML = '<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Results</div>' +
        d.scores.sort(function(a,b){return (b.icp_score||0)-(a.icp_score||0);}).map(function(s) {
          var c = (s.icp_score||0)>=70?'var(--green)':(s.icp_score||0)>=40?'var(--amber)':'var(--text3)';
          return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">' +
            '<span style="font-size:12px;font-weight:700;color:'+c+';min-width:30px;text-align:right">'+(s.icp_score??'?')+'</span>' +
            '<span style="font-size:12px;color:var(--text);flex:1">'+esc(s.account_name||'')+'</span>' +
            (s.icp_notes?'<span style="font-size:11px;color:var(--text3);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(s.icp_notes)+'">'+esc(s.icp_notes.slice(0,45))+'</span>':'') +
          '</div>';
        }).join('');
    }
    if (typeof loadPipeline === 'function') loadPipeline();
  } catch(e) { if (status) status.textContent = 'Error: ' + e.message; }
 [btn, samBtn].forEach(function(b){ if(b){b.textContent=b===samBtn?'Score ICP fit':'Score accounts now';b.disabled=false;} });
}

async function computeIcpScores() { runIcpScoring(); }  // alias for SAM tab button


// ── Deal Value & Revenue Streams Modal ──────────────────────────────────────
// ── Deal Modal State ──────────────────────────────────────────────────────────
var _dealGroups    = [];
var _dealAccountId = '';
var _dealAccountName = '';
var _dealOpportunityId = null;
var _orgProducts   = [];
var _orgStreamTypes = [  // populated fresh on modal open, fallback always has items
  {key:'license_mrr',  label:'License MRR',          type:'MRR'},
  {key:'impl',         label:'Implementation',        type:'one_time'},
  {key:'support_qrr',  label:'Support & Maintenance', type:'QRR'},
  {key:'training',     label:'Training',              type:'one_time'}
];

async function openDealValueForm(accountId, accountName, opportunityId) {
  _dealAccountId    = accountId;
  _dealAccountName  = accountName;
  _dealOpportunityId = opportunityId || null;
  document.getElementById('deal-value-modal')?.remove();

  // Show brief loading state
  var loader = document.createElement('div');
  loader.id = 'deal-value-modal';
  loader.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:flex-end;justify-content:center;z-index:999';
  loader.innerHTML = '<div style="background:var(--bg);border-radius:3px 20px 0 0;width:100%;max-width:560px;padding:24px;text-align:center"><div style="font-size:13px;color:var(--text3)">Loading\u2026</div></div>';
  document.body.appendChild(loader);

  // Always re-fetch org config + products to ensure stream types are fresh
  try {
    var [cfgRes, prodRes] = await Promise.all([
      fetch(EDGE_FN_URL, { method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({action:'get_org_config'}) }),
      fetch(EDGE_FN_URL, { method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({action:'get_products'}) })
    ]);
    var cfg  = await cfgRes.json();
    var prod = await prodRes.json();
    if (cfg.ok)  {
      window._orgConfig = cfg;
      if (cfg.revenueStreamTypes && cfg.revenueStreamTypes.length) {
        _orgStreamTypes = cfg.revenueStreamTypes;
      }
    }
    _orgProducts = prod.products || [];
  } catch(e) { _orgProducts = []; }

  // Start with one empty group
  _dealGroups = [{ productId:'', streams:[{name:'',amount:'',currency:window._orgConfig?.defaultCurrency||'USD'}] }];
  renderDealModal();
}

function renderDealModal() {
  document.getElementById('deal-value-modal')?.remove();

  // Use module-level variables — no closure scope issues
  var ST = _orgStreamTypes; // guaranteed to have items (set in openDealValueForm)
  var FX = {USD:1,INR:0.012,EUR:1.08,GBP:1.27,AED:0.272,SAR:0.267,SGD:0.74,AUD:0.65,CAD:0.73,MXN:0.058,BRL:0.19};
  var CCY = ['USD','INR','EUR','GBP','AED','SAR','SGD','AUD','CAD','MXN','BRL'];
  var TYPE_C = {MRR:'#3A6EA8',QRR:'#4A8C5C',ARR:'#7B5EA7',one_time:'#A07824'};

  function fmt(v) { return !v?'$0':v>=1e6?'$'+(v/1e6).toFixed(1)+'M':v>=1000?'$'+Math.round(v/1000)+'K':'$'+Math.round(v); }

  function getType(name) {
    var d = ST.find(function(t){return (t.key||t.label)===name;});
    return d ? d.type : 'one_time';
  }

  function groupTotal(g) {
    return g.streams.reduce(function(sum,s){
      var usd = (parseFloat(s.amount)||0) * (FX[s.currency]||1);
      var t = getType(s.name);
      return sum + (t==='MRR'?usd*12:t==='QRR'?usd*4:usd);
    }, 0);
  }

  // Build stream options HTML — called with module-level ST, always has items
  function streamOpts(selectedName) {
    return '<option value="">\u2014 Select revenue stream \u2014</option>' +
      ST.map(function(t) {
        var val = t.key || t.label;
        return '<option value="'+esc(val)+'"'+(selectedName===val?' selected':'')+'>'+esc(t.label)+'</option>';
      }).join('');
  }

  function streamRow(s, si, gi, canRemove) {
    var type = getType(s.name);
    var tc = TYPE_C[type] || '#888';
    var badge = type ? '<span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:2px;background:'+tc+'18;color:'+tc+';white-space:nowrap">'+type.replace('one_time','One-time')+'</span>' : '';
    return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:10px 12px;margin-bottom:8px">' +

      // Line 1: stream selector + badge + remove button
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<select onchange="_dealGroups['+gi+'].streams['+si+'].name=this.value;renderDealModal()" '+
          'style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:2px;padding:9px 10px;'+
          'color:var(--text);font-family:var(--sans);font-size:13px;outline:none">' +
          streamOpts(s.name) +
        '</select>' +
        badge +
        (canRemove ? '<button onclick="_dealGroups['+gi+'].streams.splice('+si+',1);renderDealModal()" '+
          'style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px;line-height:1;padding:2px 4px;flex-shrink:0">\u00d7</button>' : '') +
      '</div>' +

      // Line 2: amount + currency
      '<div style="display:flex;gap:8px;margin-bottom:8px">' +
        '<input type="number" placeholder="Amount" value="'+(s.amount||'')+'" '+
          'oninput="_dealGroups['+gi+'].streams['+si+'].amount=this.value;updateDealTotal()" '+
          'style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:2px;'+
          'padding:9px 12px;color:var(--text);font-family:var(--sans);font-size:14px;outline:none;text-align:right;font-weight:600"/>' +
        '<select onchange="_dealGroups['+gi+'].streams['+si+'].currency=this.value" '+
          'style="width:75px;flex-shrink:0;background:var(--surface2);border:1px solid var(--border);border-radius:2px;'+
          'padding:9px 6px;color:var(--text);font-family:var(--sans);font-size:12px;outline:none">' +
          CCY.map(function(c){return '<option'+(s.currency===c?' selected':'')+'>'+c+'</option>';}).join('') +
        '</select>' +
      '</div>' +

      // Line 3: units/licenses (always visible, clearly labelled)
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<div style="font-size:11px;color:var(--text3);flex-shrink:0">Units / licenses / outlets</div>' +
        '<input type="number" placeholder="e.g. 500" value="'+(s.units||'')+'" '+
          'oninput="_dealGroups['+gi+'].streams['+si+'].units=this.value" '+
          'style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:2px;'+
          'padding:7px 10px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none;text-align:right"/>' +
        '<div style="font-size:11px;color:var(--text3);flex-shrink:0">optional</div>' +
      '</div>' +

    '</div>';
  }

  function groupBlock(g, gi) {
    var gTotal = groupTotal(g);
    var prodOpts = '<option value="">\uD83D\uDCE6 Select product/offering\u2026</option>' +
      _orgProducts.map(function(p){
        return '<option value="'+p.id+'"'+(g.productId===p.id?' selected':'')+'>'+esc(p.name)+(p.category?' \u00b7 '+esc(p.category):'')+' </option>';
      }).join('') +
      (_orgProducts.length===0?'<option value="__none">No products — log as general deal</option>':'');

    return '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:14px 16px;margin-bottom:10px">' +
      // Product selector header
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
        '<select onchange="_dealGroups['+gi+'].productId=this.value" '+
          'style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:2px;'+
          'padding:9px 12px;color:var(--text);font-family:var(--sans);font-size:14px;font-weight:600;outline:none">' +
          prodOpts +
        '</select>' +
        (gTotal>0 ? '<span style="font-size:14px;font-weight:700;color:var(--gold);flex-shrink:0">'+fmt(gTotal)+'</span>' : '') +
        (_dealGroups.length>1 ? '<button onclick="_dealGroups.splice('+gi+',1);renderDealModal()" '+
          'style="flex-shrink:0;background:none;border:none;border-radius:2px;color:var(--coral);cursor:pointer;font-size:12px;padding:4px 0">Remove</button>' : '') +
      '</div>' +
      // Stream rows
      g.streams.map(function(s,si){ return streamRow(s, si, gi, g.streams.length>1); }).join('') +
      // Add stream link
      '<button onclick="_dealGroups['+gi+'].streams.push({name:\'\',amount:\'\',currency:_orgStreamTypes[0]&&\'USD\',units:\'\'}); renderDealModal()" '+
        'style="font-size:12px;color:var(--text3);background:none;border:none;cursor:pointer;padding:4px 0;display:flex;align-items:center;gap:4px">'+
        '+ Add another revenue stream to this offering</button>' +
    '</div>';
  }

  // Grand total
  var grand = _dealGroups.reduce(function(s,g){return s+groupTotal(g);},0);
  var breakdown = _dealGroups.filter(function(g){return groupTotal(g)>0;}).map(function(g){
    var pname = (_orgProducts.find(function(p){return p.id===g.productId;})||{}).name || 'General deal';
    return '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:3px">'+
      '<span>'+esc(pname)+'</span><span style="font-weight:600">'+fmt(groupTotal(g))+'</span></div>';
  }).join('');

  var overlay = document.createElement('div');
  overlay.id = 'deal-value-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:flex-end;justify-content:center;z-index:999';

  overlay.innerHTML =
    '<div style="background:var(--bg);border-top:1px solid var(--border2);border-radius:3px 20px 0 0;'+
      'width:100%;max-width:560px;max-height:92vh;overflow-y:auto;animation:slideUp 0.25s ease">' +

      // ── Header ──
      '<div style="position:sticky;top:0;background:var(--bg);z-index:1;padding:14px 20px;border-bottom:1px solid var(--border)">' +
        '<div style="width:36px;height:4px;background:var(--border2);border-radius:2px;margin:0 auto 12px"></div>' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between">' +
          '<div>' +
            '<div style="font-size:20px;font-weight:700;color:var(--text)">\uD83D\uDCB0 '+esc(_dealAccountName)+'</div>' +
            '<div style="font-size:12px;color:var(--text3);margin-top:2px">Log each product being discussed separately</div>' +
          '</div>' +
          '<button onclick="document.getElementById(\'deal-value-modal\').remove()" '+
            'style="background:var(--surface2);border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;'+
            'color:var(--text3);font-size:16px;display:flex;align-items:center;justify-content:center">\u00d7</button>' +
        '</div>' +
      '</div>' +

      '<div style="padding:16px 20px">' +

        // ── Offerings ──
        '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">'+
          'Offerings in discussion ('+_dealGroups.length+')</div>' +
        _dealGroups.map(groupBlock).join('') +
        '<button onclick="_dealGroups.push({productId:\'\',streams:[{name:\'\',amount:\'\',currency:\'USD\',units:\'\'}]});renderDealModal()" '+
          'style="width:100%;padding:11px;background:transparent;border:1.5px dashed var(--border2);border-radius:3px;'+
          'color:var(--gold);font-family:var(--sans);font-size:13px;font-weight:600;cursor:pointer;margin-bottom:16px">+ Add another offering</button>' +

        // ── Total ──
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:3px;padding:14px 16px;margin-bottom:16px">' +
          (breakdown || '') +
          '<div style="'+(breakdown?'border-top:1px solid var(--border);margin-top:8px;padding-top:8px;':'')+
            'display:flex;justify-content:space-between;align-items:center">' +
            '<div>' +
              '<div style="font-size:12px;color:var(--text3)">Total deal value (USD)</div>' +
              '<div style="font-size:11px;color:var(--text3);margin-top:1px">MRR\u00d712 \u00b7 QRR\u00d74 \u00b7 One-time\u00d71</div>' +
            '</div>' +
            '<div id="deal-total-display" style="font-size:26px;font-weight:700;color:var(--gold)">'+fmt(grand)+'</div>' +
          '</div>' +
        '</div>' +

        // ── Deal details ──
        '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">Deal details</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">' +
          '<div><div style="font-size:11px;color:var(--text3);margin-bottom:5px">Expected close</div>'+
            '<input id="dv-close" type="date" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:3px;padding:10px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none"/></div>' +
          '<div><div style="font-size:11px;color:var(--text3);margin-bottom:5px">Deal type</div>'+
            '<select id="dv-type" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:3px;padding:10px;color:var(--text);font-family:var(--sans);font-size:13px;outline:none">'+
              ['new_business','expansion','renewal','upsell'].map(function(t){return '<option value="'+t+'">'+t.replace('_',' ')+'</option>';}).join('')+
            '</select></div>' +
        '</div>' +

        // ── Probability note ──
        '<div style="background:var(--surface2);border-radius:3px;padding:10px 14px;margin-bottom:18px;display:flex;gap:10px">' +
          '<span style="font-size:20px">\uD83E\uDDE0</span>' +
          '<div style="font-size:12px;color:var(--text3)"><strong style="color:var(--text2)">Close probability</strong> is auto-derived from stage + conversation signals each time you scan channels.</div>' +
        '</div>' +

        // ── Save ──
        '<button onclick="saveDealValue()" '+
          'style="width:100%;padding:14px;background:var(--gold);border:none;border-radius:3px;'+
          'color:var(--c-canvas);font-family:var(--sans);font-size:14px;font-weight:700;cursor:pointer">Save opportunities</button>' +
        '<div id="dv-status" style="font-size:12px;margin-top:10px;text-align:center"></div>' +

      '</div>' +
    '</div>';

  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function updateDealTotal() {
  var FX = {USD:1,INR:0.012,EUR:1.08,GBP:1.27,AED:0.272,SAR:0.267,SGD:0.74,AUD:0.65,CAD:0.73,MXN:0.058,BRL:0.19};
  var total = 0;
  _dealGroups.forEach(function(g){
    g.streams.forEach(function(s){
      var usd = (parseFloat(s.amount)||0) * (FX[s.currency]||1);
      var def = _orgStreamTypes.find(function(t){return (t.key||t.label)===s.name;});
      var t = def ? def.type : 'one_time';
      total += (t==='MRR'?usd*12:t==='QRR'?usd*4:usd);
    });
  });
  var el = document.getElementById('deal-total-display');
  if (el) el.textContent = total>=1000000?'$'+(total/1000000).toFixed(1)+'M':total>=1000?'$'+Math.round(total/1000)+'K':'$'+Math.round(total);
  return total;
}

async function saveDealValue() {
  var statusEl = document.getElementById('dv-status');
  var FX = {USD:1,INR:0.012,EUR:1.08,GBP:1.27,AED:0.272,SAR:0.267,SGD:0.74,AUD:0.65,CAD:0.73,MXN:0.058,BRL:0.19};
  var dealType  = document.getElementById('dv-type')?.value  || 'new_business';
  var closeDate = document.getElementById('dv-close')?.value || null;

  // Validate — at least one group with a value
  var validGroups = _dealGroups.filter(function(g){
    return g.streams.some(function(s){return s.name && parseFloat(s.amount)>0;});
  });
  if (!validGroups.length) {
    if (statusEl){statusEl.textContent='Select a stream and enter an amount for at least one offering';statusEl.style.color='var(--coral)';} return;
  }

  if (statusEl){statusEl.textContent='Saving\u2026';statusEl.style.color='var(--text3)';}

  var saved = 0;
  var errors = [];

  for (var gi=0; gi<validGroups.length; gi++) {
    var g = validGroups[gi];
    var validStreams = g.streams.filter(function(s){return s.name&&parseFloat(s.amount)>0;});
    var groupUsd = validStreams.reduce(function(sum,s){
      var usd=(parseFloat(s.amount)||0)*(FX[s.currency]||1);
      var def=_orgStreamTypes.find(function(t){return (t.key||t.label)===s.name;});
      var t=def?.type||'one_time';
      return sum+(t==='MRR'?usd*12:t==='QRR'?usd*4:usd);
    },0);
    var primary = validStreams[0];
    try {
      var r = await fetch(EDGE_FN_URL, {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body: JSON.stringify({
          action:'upsert_opportunity',
          account_id: _dealAccountId,
          product_id: g.productId||null,
          deal_value: parseFloat(primary.amount),
          deal_currency: primary.currency||'USD',
          deal_value_usd: Math.round(groupUsd),
          revenue_streams: validStreams.map(function(s){
            var def=_orgStreamTypes.find(function(t){return (t.key||t.label)===s.name;});
            return {key:def?.key||s.name,label:def?.label||s.name,type:def?.type||'one_time',amount:parseFloat(s.amount),currency:s.currency};
          }),
          deal_type: dealType,
          expected_close: closeDate,
          stage: 'prospective'
        })
      });
      var d = await r.json();
      if (d.ok) saved++; else errors.push(d.error||'Save failed');
    } catch(e){ errors.push(e.message); }
  }

  if (errors.length) {
    if (statusEl){statusEl.textContent='Saved '+saved+', '+errors.length+' error(s): '+errors[0];statusEl.style.color='var(--coral)';}
  } else {
    if (statusEl){statusEl.textContent='\u2713 Saved '+saved+' opportunit'+(saved===1?'y':'ies');statusEl.style.color='var(--green)';}
    setTimeout(function(){ document.getElementById('deal-value-modal')?.remove(); loadMyAccounts(); if(typeof loadPipeline==='function') loadPipeline(); }, 1600);
  }
}

function boostSignals(accountId, accountName) {
  switchTab('signals');
  setTimeout(function() {
    var out = document.getElementById('samLocalIntelOutput');
 if (out) out.innerHTML = '<div style="font-size:12px;color:var(--amber);padding:8px 0">Run "Scan channels" to generate signals for <strong>' + esc(accountName) + '</strong> and move it to verified pipeline.</div>';
    var section = document.getElementById('samLocalIntelSection');
    if (section) section.style.display = 'block';
  }, 300);
}

// ── Relationship coverage depth (deterministic, receipts per deal) ───────────
async function loadRelationshipCoverage() {
  var box = document.getElementById('relationshipCoverage'); if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_relationship_coverage' }) });
    var d = await r.json();
    if (!d.ok) { box.innerHTML = ''; return; }
    var ru = d.rollup || {};
    var deals = d.deals || [];
    var h = '<div style="margin-bottom:10px">' + _samoraIntelLabel('Relationship coverage, deterministic') + '</div>';

    var tiles = [
      { label:'Strong', value: String(ru.strong||0), color:'var(--green)', sub:'well covered' },
      { label:'Partial', value: String(ru.partial||0), color:'var(--amber)', sub:'one gap' },
      { label:'Thin', value: String(ru.thin||0), color:'var(--coral)', sub:'multiple gaps' },
      { label:'Ghost contacts', value: String(ru.ghost_contacts||0), color: ru.ghost_contacts?'var(--amber)':'var(--green)', sub:'enriched, never reached' }
    ];
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:6px">';
    tiles.forEach(function(t) {
      h += '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:11px 13px">' +
        '<div style="font-size:11px;color:var(--text3);margin-bottom:3px">' + t.label + '</div>' +
        '<div style="font-size:20px;font-weight:600;color:' + t.color + ';line-height:1.1">' + t.value + '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + t.sub + '</div>' +
      '</div>';
    });
    h += '</div>';

    var gradeCol = { thin:'var(--coral)', partial:'var(--amber)', strong:'var(--green)' };
    var withGaps = deals.filter(function(dl){ return dl.gaps && dl.gaps.length; });
    h += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:14px 0 6px">Coverage gaps' + (d.scope !== 'self' ? ' (' + d.scope + ')' : '') + '</div>';
    if (!withGaps.length) {
      h += '<div style="font-size:12px;color:var(--text3);font-style:italic;padding:4px 0 6px">Every open deal is well covered for its stage.</div>';
    } else {
      withGaps.forEach(function(dl) {
        var col = gradeCol[dl.grade] || 'var(--text3)';
        h += '<div onclick="openAccountTimeline(\'' + esc(dl.account_id) + '\',\'' + esc(dl.name||'') + '\')" style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;margin-bottom:4px;background:var(--surface);border-left:2px solid ' + col + ';border-radius:0 8px 8px 0;cursor:pointer">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">' +
              '<span style="font-size:12px;font-weight:600;color:var(--text)">' + esc(dl.name) + '</span>' +
              '<span style="font-size:11px;color:var(--text3)">' + esc(dl.value_label) + ' · ' + esc(dl.stage) + '</span>' +
              '<span style="font-size:11px;color:' + col + ';font-weight:700;text-transform:uppercase">' + dl.grade + '</span>' +
            '</div>' +
            '<div style="font-size:11px;color:var(--text3)">' + dl.active + ' of ' + dl.total + ' contacts active' + (dl.senior_active ? ', senior engaged' : ', no senior') + '</div>' +
            '<div style="font-size:11px;color:var(--text2);margin-top:2px">' + dl.gaps.map(function(g){ return esc(g); }).join(' · ') + '</div>' +
          '</div>' +
          '<span style="color:var(--text3);font-size:12px;flex-shrink:0">›</span>' +
        '</div>';
      });
    }
    box.innerHTML = h;
  } catch(e) { box.innerHTML = ''; }
}

// ── Correlated signal states (named deterministic verdicts) ──────────────────
async function loadSignalStates() {
  var box = document.getElementById('signalStates'); if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_signal_states' }) });
    var d = await r.json();
    if (!d.ok || !d.states || !d.states.length) { box.innerHTML = ''; return; }
    var meta = {
 at_risk_to_competitor: { icon:'', color:'var(--coral)' },
 champion_less_closing: { icon:'', color:'var(--coral)' },
 silent_high_value: { icon:'', color:'var(--coral)' },
 pricing_squeeze: { icon:'', color:'var(--amber)' },
 expansion_ready: { icon:'', color:'var(--green)' }
    };
    var h = '<div style="margin-bottom:10px">' + _samoraIntelLabel('Signal states, deterministic verdicts') + '</div>';
    h += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">What the signals add up to' + (d.scope !== 'self' ? ' (' + d.scope + ')' : '') + '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px">';
    d.states.forEach(function(s) {
      var m = meta[s.state] || { icon:'•', color:'var(--text3)' };
      h += '<div onclick="openAccountTimeline(\'' + esc(s.account_id) + '\',\'' + esc(s.account||'') + '\')" style="background:var(--surface);border:1px solid var(--border2);border-left:2px solid ' + m.color + ';border-radius:0 10px 10px 0;padding:10px 12px;cursor:pointer">' +
        '<div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">' +
          '<span style="font-size:14px;flex-shrink:0">' + m.icon + '</span>' +
          '<span style="font-size:12px;font-weight:600;color:var(--text);flex:1;min-width:0">' + esc(s.headline) + '</span>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text3);line-height:1.4">' + esc(s.evidence) + '</div>' +
      '</div>';
    });
    h += '</div>';
    box.innerHTML = h;
  } catch(e) { box.innerHTML = ''; }
}

// ── Deal velocity + forecast integrity (deterministic, receipts per line) ────
async function loadVelocityForecast() {
  var box = document.getElementById('velocityForecast'); if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_velocity_forecast' }) });
    var d = await r.json();
    if (!d.ok) { box.innerHTML = ''; return; }
    var f = d.forecast || {};
    var vel = d.velocity || [];
    var fmtK = function(v){ return v >= 1000000 ? '$' + (v/1000000).toFixed(1) + 'M' : '$' + Math.round(v/1000) + 'K'; };

    var h = '<div style="margin-bottom:10px">' + _samoraIntelLabel('Forecast integrity, deterministic') + '</div>';

    // ── Forecast integrity tiles ─────────────────────────────────────────
    var tiles = [
      { label:'At risk', value: fmtK(f.at_risk_usd||0), sub: (f.at_risk_deals||[]).length + ' deal' + ((f.at_risk_deals||[]).length!==1?'s':'') + ' flagged', color: f.at_risk_usd ? 'var(--coral)' : 'var(--green)', key:'atrisk' },
      { label:'Unverified value', value: fmtK(f.happy_ears_usd||0), sub: (f.happy_ears_count||0) + ' below signal 40', color: f.happy_ears_usd ? 'var(--amber)' : 'var(--green)', key:'happy' },
      { label:'No close date', value: fmtK(f.no_date_usd||0), sub: (f.no_date_count||0) + ' deal' + ((f.no_date_count||0)!==1?'s':''), color: f.no_date_usd ? 'var(--amber)' : 'var(--green)', key:'nodate' },
      { label:'Verified', value: (f.verified_pct||0) + '%', sub: fmtK(f.verified_usd||0) + ' of ' + fmtK(f.total_usd||0), color:'var(--green)', key:'ver' }
    ];
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:6px">';
    tiles.forEach(function(t) {
      var clickable = (t.key === 'atrisk' && (f.at_risk_deals||[]).length) || (t.key === 'happy' && (f.happy_ears_deals||[]).length);
      h += '<div ' + (clickable ? 'onclick="_toggleFcDrill(\'' + t.key + '\')" style="cursor:pointer;' : 'style="') + 'background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:11px 13px">' +
        '<div style="font-size:11px;color:var(--text3);margin-bottom:3px">' + t.label + (clickable ? ' <span style="color:var(--text3);font-size:11px">tap</span>' : '') + '</div>' +
        '<div style="font-size:20px;font-weight:600;color:' + t.color + ';line-height:1.1">' + t.value + '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + esc(t.sub) + '</div>' +
      '</div>';
    });
    h += '</div>';

    // At-risk drill (hidden): which dollars, and why.
    var drill = function(key, deals, label) {
      var x = '<div id="fcDrill-' + key + '" style="display:none;background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:10px 12px;margin-bottom:6px">';
      x += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">' + label + '</div>';
      deals.forEach(function(dl) {
        x += '<div onclick="openAccountTimeline(\'' + esc(dl.account_id) + '\',\'' + esc(dl.name||'') + '\')" style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border);cursor:pointer">' +
          '<span style="font-size:12px;font-weight:600;color:var(--text);min-width:90px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(dl.name) + '</span>' +
          '<span style="font-size:11px;color:var(--text3);flex:1;min-width:0">' + esc(dl.reasons ? dl.reasons.join(', ') : ('signal ' + dl.signal_score + ', unverified')) + '</span>' +
          '<span style="font-size:12px;font-weight:700;color:var(--text2);flex-shrink:0">' + fmtK(dl.value||0) + '</span>' +
        '</div>';
      });
      x += '</div>';
      return x;
    };
    if ((f.at_risk_deals||[]).length) h += drill('atrisk', f.at_risk_deals, 'At-risk dollars, and why');
    if ((f.happy_ears_deals||[]).length) h += drill('happy', f.happy_ears_deals, 'Unverified value, rep entered but signal below 40');

    // ── Slipping / stuck deals ───────────────────────────────────────────
    var stateMeta = {
      regressed: { icon:'↘', color:'var(--coral)' },
 slipping: { icon:'', color:'var(--coral)' },
      stalled:   { icon:'⏸', color:'var(--amber)' },
 plateau: { icon:'', color:'var(--amber)' }
    };
    h += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:14px 0 6px">Losing momentum' + (d.scope !== 'self' ? ' (' + d.scope + ')' : '') + '</div>';
    if (!vel.length) {
      h += '<div style="font-size:12px;color:var(--text3);font-style:italic;padding:4px 0 6px">No deals slipping or stuck. Momentum looks healthy.</div>';
    } else {
      vel.forEach(function(v) {
        var m = stateMeta[v.state] || { icon:'•', color:'var(--text3)' };
        h += '<div onclick="openAccountTimeline(\'' + esc(v.account_id) + '\',\'' + esc(v.name||'') + '\')" style="display:flex;align-items:flex-start;gap:8px;padding:7px 10px;margin-bottom:4px;background:var(--surface);border-left:2px solid ' + m.color + ';border-radius:0 8px 8px 0;cursor:pointer">' +
          '<span style="font-size:12px;flex-shrink:0">' + m.icon + '</span>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:12px;font-weight:500;color:var(--text)">' + esc(v.headline) + '</div>' +
            '<div style="font-size:11px;color:var(--text3);margin-top:1px">' + esc(v.evidence) + '</div>' +
          '</div>' +
          '<span style="color:var(--text3);font-size:12px;flex-shrink:0">›</span>' +
        '</div>';
      });
    }
    box.innerHTML = h;
  } catch(e) { box.innerHTML = ''; }
}

function _toggleFcDrill(key) {
  var el = document.getElementById('fcDrill-' + key); if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ── Revenue Truth Console: 5 derived numbers + what changed this week ────────
// All deterministic (DB deltas, zero AI). Every line carries its evidence.
async function loadIntelConsole() {
  var box = document.getElementById('intelConsole'); if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_intel_console' }) });
    var d = await r.json();
    if (!d.ok) { box.innerHTML = ''; return; }
    var st = d.strip || {};
    var fmtK = function(v){ return v >= 1000000 ? '$' + (v/1000000).toFixed(1) + 'M' : '$' + Math.round(v/1000) + 'K'; };
    var fd = st.forecast_delta;
    var fdVal = fd ? (fd.verified_change >= 0 ? '+' : '') + fmtK(Math.abs(fd.verified_change)).replace('$', fd.verified_change < 0 ? '-$' : '$') : 'n/a';
    var fdCol = fd ? (fd.verified_change >= 0 ? 'var(--green)' : 'var(--coral)') : 'var(--text3)';
    var changes = d.changes || [];
 var typeIcon = { signal_drop:'', signal_gain:'', tier_up:'', tier_down:'', went_dark:'', single_threaded:'', champion_quiet:'', close_slipped:'⏰', competitor_spike:'' };
    var sevCol = { high:'var(--coral)', medium:'var(--amber)', low:'var(--green)' };
    var needsDecision = changes.filter(function(c){ return c.severity === 'high'; });
    var forAwareness = changes.filter(function(c){ return c.severity !== 'high'; });

    // ── Headline: one deterministic sentence, the entry point for everything below ──
    var headline = 'Verified pipeline is ' + fmtK(st.verified_usd||0) + ' (' + (st.verified_pct||0) + '% of ' + fmtK(st.total_usd||0) + ' total).';
    if (fd) headline += ' ' + (fd.verified_change >= 0 ? 'Up' : 'Down') + ' ' + fmtK(Math.abs(fd.verified_change)) + ' this week.';
    if (needsDecision.length) headline += ' ' + needsDecision.length + ' deal' + (needsDecision.length !== 1 ? 's need' : ' needs') + ' a decision.';
    else headline += ' Nothing urgent flagged this week.';
    var h = '<div style="font-size:14px;font-weight:600;color:var(--text);line-height:1.4;padding:2px 0 12px">' + esc(headline) + '</div>';

    // ── Truth strip, demoted: 3 headline tiles + 2 folded behind a toggle ──
    var primaryCards = [
      { label:'Verified pipeline', value: fmtK(st.verified_usd||0), sub: st.verified_pct + '% of ' + fmtK(st.total_usd||0), color:'var(--green)' },
      { label:'Verified moved 7d', value: fdVal, sub: fd ? fd.from_date + ' to ' + fd.to_date : 'needs 2 snapshots', color: fdCol },
      { label:'High risks', value: String(st.high_risks||0), sub:'of ' + (st.total_deals||0) + ' open deals', color: st.high_risks ? 'var(--coral)' : 'var(--green)' }
    ];
    var moreCards = [
      { label:'Dark >14d', value: String(st.dark_deals||0), sub:'no verified contact', color: st.dark_deals ? 'var(--amber)' : 'var(--green)' },
      { label:'Single-threaded', value: String(st.single_threaded||0), sub:'one active contact', color: st.single_threaded ? 'var(--amber)' : 'var(--green)' }
    ];
    var tile = function(c) {
      return '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:10px 12px">' +
        '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">' + c.label + '</div>' +
        '<div style="font-size:20px;font-weight:600;color:' + c.color + ';line-height:1.1">' + esc(c.value) + '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + esc(c.sub) + '</div>' +
      '</div>';
    };
    var stripOpen = !!window._intelStripOpen;
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:6px">' + primaryCards.map(tile).join('') + '</div>';
    if (stripOpen) h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:6px">' + moreCards.map(tile).join('') + '</div>';
    h += '<div onclick="window._intelStripOpen=!window._intelStripOpen;loadIntelConsole()" style="font-size:11px;color:var(--text3);cursor:pointer;user-select:none;margin-bottom:14px">' + (stripOpen ? '▴ fewer numbers' : '▾ dark deals, single-threaded count') + '</div>';

    // ── Needs a decision: high-severity changes, always visible ──────────
    var changeRow = function(c) {
      var col = sevCol[c.severity] || 'var(--text3)';
      var click = c.account_id ? 'openAccountTimeline(\'' + esc(c.account_id) + '\',\'' + esc(c.account||'') + '\')' : '';
      return '<div ' + (click ? 'onclick="' + click + '" ' : '') + 'style="display:flex;align-items:flex-start;gap:8px;padding:7px 10px;margin-bottom:4px;background:var(--surface);border-left:2px solid ' + col + ';border-radius:0 8px 8px 0;' + (click ? 'cursor:pointer' : '') + '">' +
        '<span style="font-size:12px;flex-shrink:0">' + (typeIcon[c.type]||'•') + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:12px;font-weight:500;color:var(--text)">' + esc(c.headline) + '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:1px">' + esc(c.evidence||'') + '</div>' +
        '</div>' +
        (click ? '<span style="color:var(--text3);font-size:12px;flex-shrink:0">›</span>' : '') +
      '</div>';
    };
    h += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Needs a decision' + (d.scope !== 'self' ? ' (' + d.scope + ')' : '') + '</div>';
    if (!needsDecision.length) {
      h += '<div style="font-size:12px;color:var(--text3);font-style:italic;padding:4px 0 10px">Nothing urgent. Steady week.</div>';
    } else {
      needsDecision.forEach(function(c) { h += changeRow(c); });
    }

    // ── For your awareness: medium/low severity, collapsed by default ─────
    if (forAwareness.length) {
      var awareOpen = !!window._intelAwareOpen;
      h += '<div onclick="window._intelAwareOpen=!window._intelAwareOpen;loadIntelConsole()" style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:var(--surface2);border-radius:2px;cursor:pointer;user-select:none;margin:10px 0 ' + (awareOpen ? '5px' : '0') + '">' +
        '<span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">For your awareness · ' + forAwareness.length + '</span>' +
        '<span style="font-size:11px;color:var(--text3)">' + (awareOpen ? '▴' : '▾') + '</span>' +
      '</div>';
      if (awareOpen) forAwareness.forEach(function(c) { h += changeRow(c); });
    }
    // Marker: the async rollup below (manager+ only) inserts itself here.
    h += '<div id="intelRollupMarker"></div>';
    box.innerHTML = h;
    // Cross-deal pattern boards used to render here. They now feed the unified
    // Signal intelligence section below (theme trend arrows), so we stash the
    // pattern trends and re-render that section instead of drawing a duplicate.
    window._intelPatterns = d.patterns || {};
    if (_intelData && typeof renderIntelFeed === 'function') renderIntelFeed();
    if (canSeeTeam(profile ? profile.role : '')) _loadIntelCoachingRollup();
    _loadIntelAttention();
  } catch(e) { box.innerHTML = ''; }
}

// ── Manager/director rollup: who on the team needs a nudge, aggregated from ──
// coaching_alerts (already generated, zero new AI). Inserts itself just above
// the exploratory patterns/attention sections via #intelRollupMarker.
async function _loadIntelCoachingRollup() {
  var marker = document.getElementById('intelRollupMarker'); if (!marker || !marker.parentNode) return;
  try {
    var call = function() {
      return fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
        body:JSON.stringify({ action:'get_coaching_rollup' }) });
    };
    var r = await call();
    // This section fires last in a long await chain; if the session token has
    // lapsed by now the gateway 401s. Refresh once and retry before giving up.
    if (r.status === 401 && currentUser && currentUser.refresh_token) {
      var ok = await refreshToken();
      if (ok) r = await call();
    }
    var d = await r.json();
    if (!d.ok || !d.reps || !d.reps.length) return;
    var sevColor = { high:'var(--coral)', medium:'var(--amber)', low:'var(--blue)' };
    var h = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:2px 0 8px">Your team, ' + d.total_alerts + ' open alert' + (d.total_alerts!==1?'s':'') + '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:6px">';
    d.reps.slice(0, 8).forEach(function(rep) {
      h += '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:12px 14px">';
      h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border2)">';
      h += '<span style="font-size:12px;font-weight:700;color:var(--text)">' + esc(rep.name) + '</span>';
      h += '<div style="display:flex;gap:4px">';
      if (rep.high) h += '<span style="font-size:11px;font-weight:700;color:var(--coral);background:var(--coral-lt);padding:2px 7px;border-radius:2px">' + rep.high + ' high</span>';
      if (rep.medium) h += '<span style="font-size:11px;font-weight:700;color:var(--amber);background:var(--amber-lt);padding:2px 7px;border-radius:2px">' + rep.medium + ' med</span>';
      if (!rep.high && !rep.medium && rep.low) h += '<span style="font-size:11px;font-weight:700;color:var(--text3);background:rgba(150,150,150,0.1);padding:2px 7px;border-radius:2px">' + rep.low + ' low</span>';
      h += '</div></div>';
      if (!rep.alerts || !rep.alerts.length) {
        h += '<div style="font-size:11px;color:var(--text3);font-style:italic">No open alerts</div>';
      } else {
        rep.alerts.forEach(function(a) {
          var col = sevColor[a.severity] || 'var(--text3)';
          h += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:11px;color:var(--text2)">' +
            '<span style="width:5px;height:5px;border-radius:50%;background:' + col + ';flex-shrink:0"></span>' +
            '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a.title) + '</span>' +
          '</div>';
        });
      }
      h += '</div>';
    });
    h += '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = h;
    marker.parentNode.insertBefore(wrap, marker);
  } catch(e) { /* rollup is optional, never blocks the console */ }
}

// ── Attention allocation: your calendar hours vs deal health ─────────────────
// Reuses get_time_analytics (Google Calendar based, per-user). Appended below
// the console so a slow calendar read never blocks the strip.
async function _loadIntelAttention() {
  var box = document.getElementById('intelConsole'); if (!box) return;
  try {
    var r = await fetch(EDGE_FN_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+currentUser.token,'apikey':SB_KEY},
      body:JSON.stringify({ action:'get_time_analytics', days: 30 }) });
    var d = await r.json();
    if (!d.ok || !d.by_account || !d.by_account.length) return;
    var over = d.by_account.filter(function(a){ return a.mismatch === 'over_invested'; }).slice(0, 3);
    var under = d.by_account.filter(function(a){ return a.mismatch === 'under_invested'; }).slice(0, 3);
    if (!over.length && !under.length) return;
    var col = function(title, icon, rows, accent, tone) {
      var c = '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:12px 14px;flex:1;min-width:200px">';
      c += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:9px;padding-bottom:8px;border-bottom:1px solid var(--border2)">' +
        '<span style="font-size:14px;line-height:1">' + icon + '</span>' +
        '<span style="font-size:11px;font-weight:700;color:var(--text2)">' + title + '</span>' +
      '</div>';
      if (!rows.length) {
        c += '<div style="font-size:11px;color:var(--text3);font-style:italic">None flagged this month</div>';
      } else {
        c += '<div style="display:flex;flex-direction:column;gap:7px">';
        rows.forEach(function(a) {
          c += '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="width:6px;height:6px;border-radius:50%;background:' + accent + ';flex-shrink:0"></span>' +
            '<span style="font-size:11px;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a.account_name) + '</span>' +
            '<span style="font-size:11px;font-weight:600;color:' + accent + ';background:' + tone + ';padding:2px 7px;border-radius:2px;white-space:nowrap">' + a.hours + 'h · sig ' + (a.signal_score != null ? a.signal_score : '–') + '</span>' +
          '</div>';
        });
        c += '</div>';
      }
      c += '</div>';
      return c;
    };
    var h = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px">Your attention vs deal health, 30 days of calendar</div>';
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      col('Over-invested', '⏳', over, 'var(--amber)', 'var(--amber-lt)') +
 col('Under-invested', '', under, 'var(--green)', 'var(--green-lt)') +
    '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = h;
    box.appendChild(wrap);
  } catch(e) { /* attention section is optional */ }
}

async function loadIntelligence() {
  loadIntelConsole();  // fire in parallel, renders its own section
  loadVelocityForecast();  // deterministic velocity + forecast integrity, own section
  loadRelationshipCoverage();  // coverage depth by stage, own section
  loadSignalStates();  // correlated deterministic verdicts, own section
  var feed = document.getElementById('intelFeed');
  var isManager = canSeeTeam(profile ? profile.role : '');
  var days = parseInt((document.getElementById('intelDaysFilter') || {}).value || '30') || 30;
  if (isManager) await populateIntelRepFilter();
  var repFilterEl = document.getElementById('intelRepFilter');
  var repFilter = repFilterEl ? repFilterEl.value : '';
  try {
    var r = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token, 'apikey': SB_KEY },
      body: JSON.stringify({ action: 'get_intelligence', days_back: days, view: 'accounts', rep_user_id: isManager && repFilter ? repFilter : (isManager ? null : undefined) })
    });
    var data = await r.json();
    _intelData = data;
    renderIntelFeed();
  } catch(e) {
    if (feed) feed.innerHTML = '<div style="text-align:center;padding:48px 0;color:var(--coral);font-size:13px">Error loading intelligence: ' + esc(e.message) + '</div>';
  }
}

let _intelRepsCache = null;
async function populateIntelRepFilter() {
  var sel = document.getElementById('intelRepFilter');
  if (!sel || !profile?.org_id) return;
  try {
    if (!_intelRepsCache) {
      var seeAllReps = ['super_admin','admin','director','executive'].includes(profile.role);
      var q = 'user_profiles?org_id=eq.' + profile.org_id + '&select=user_id,email,role,manager_id&order=email';
      var allMembers = await sbGet(q);
      // Only show frontline reps (member/sdr/ae), never managers/admins/super_admins themselves.
      var reps = (allMembers || []).filter(function(p) {
        return ['member','sdr','ae'].includes(p.role);
      });
      // Plain managers only see their own direct reports; senior roles see the whole org's reps.
      if (!seeAllReps) {
        reps = reps.filter(function(p) { return p.manager_id === currentUser.id; });
      }
      _intelRepsCache = reps;
    }
    var current = sel.value;
    sel.innerHTML = '<option value="">All reps</option>' + (_intelRepsCache || []).map(function(p) {
      return '<option value="' + p.user_id + '">' + esc(p.email.split('@')[0]) + '</option>';
    }).join('');
    sel.value = current;
  } catch(e) { /* keep default */ }
}

var _intelSource = 'all';
function setIntelSource(source, btn) {
  _intelSource = source;
  ['all','ai','sam'].forEach(function(s) {
    var b = document.getElementById('intel-src-' + s);
    if (b) b.classList.toggle('active', s === source);
  });
  renderIntelFeed();
}

function setIntelType(type, btn) {
  _intelType = type;
  // Scope to the category row only — querySelectorAll('.intel-tab') would
  // otherwise also deactivate the source-row buttons above it, since both
  // rows share the same CSS class.
  var categoryRow = btn ? btn.parentElement : null;
  if (categoryRow) {
    categoryRow.querySelectorAll('.intel-tab').forEach(function(b) { b.classList.remove('active'); });
  }
  if (btn) btn.classList.add('active');
  renderIntelFeed();
}

function renderIntelligence() { loadIntelligence(); }

var _intelLens = 'theme';
function setIntelLens(lens) {
  _intelLens = lens;
  renderIntelFeed();
}

var _INTEL_CATS = [
 { key:'expansion_signals', pkey:'expansion', label:'Expansion', icon:'', color:'var(--green)', upGood:true },
 { key:'risk_signals', pkey:'deal_risks', label:'Deal risks', icon:'', color:'var(--coral)', upGood:false },
 { key:'competitor_mentions', pkey:'competitors', label:'Competitors', icon:'', color:'var(--amber)', upGood:false },
 { key:'pricing_signals', pkey:'pricing', label:'Pricing pressure', icon:'', color:'var(--coral)', upGood:false },
 { key:'product_feedback', pkey:'product_gaps', label:'Product gaps', icon:'', color:'rgba(99,102,241,.85)', upGood:false }
];
var _INTEL_JUNK_TYPES = ['staleness'];

function _samChip() { return '<span style="font-size:9px;font-weight:700;color:var(--gold);background:rgba(var(--c-accent-rgb),0.14);border-radius:4px;padding:2px 7px;white-space:nowrap">SAM</span>'; }
function _aiChip() { return '<span style="font-size:9px;font-weight:700;color:var(--text3);background:rgba(150,150,150,0.14);border-radius:4px;padding:2px 7px;white-space:nowrap">AI</span>'; }

function renderIntelFeed() {
  var feed = document.getElementById('intelFeed');
  var stats = document.getElementById('intelStats');
  if (stats) stats.style.display = 'none';
  if (!feed || !_intelData) return;
  var allRows = _intelData.rows || [];
  var rows = _intelSource === 'all' ? allRows : allRows.filter(function(r) { return (r.source || 'ai') === _intelSource; });

  if (!rows.length) {
    feed.innerHTML = '<div style="text-align:center;padding:48px 0;color:var(--text3);font-size:14px">No intelligence yet.<br><span style="font-size:12px">Click ↻ Refresh to scan meeting notes.</span></div>';
    return;
  }

  var flat = [];
  var junk = [];
  var byAccount = {};
  rows.forEach(function(row) {
    var acct = row.account_name || 'Unknown';
    var a = byAccount[acct] || (byAccount[acct] = { name: acct, rows: [], signals: [], sentiment: {}, lastDate: '' });
    a.rows.push(row);
    if (row.meeting_date && row.meeting_date > a.lastDate) a.lastDate = row.meeting_date;
    if (row.sentiment) a.sentiment[row.sentiment] = (a.sentiment[row.sentiment] || 0) + 1;
    _INTEL_CATS.forEach(function(cat) {
      if (_intelType !== 'all' && _intelType !== cat.key) return;
      (row[cat.key] || []).forEach(function(s) {
        var rec = Object.assign({}, s, { _cat: cat.key, _date: row.meeting_date, _subject: row.meeting_subject, _source: row.source || 'ai', _account: acct });
        if (s && s.type && _INTEL_JUNK_TYPES.indexOf(s.type) !== -1) { junk.push(rec); return; }
        flat.push(rec); a.signals.push(rec);
      });
    });
  });

  var samCount = flat.filter(function(s){ return s._source === 'sam'; }).length;
  var aiCount = flat.length - samCount;
  var sentPos = rows.filter(function(r){ return r.sentiment === 'positive'; }).length;
  var sentTot = rows.filter(function(r){ return r.sentiment; }).length;
  var posPct = sentTot ? Math.round(sentPos / sentTot * 100) : null;
  var acctCount = Object.keys(byAccount).length;

  var tiles = [
    { label:'Live signals', value: String(flat.length), sub: 'across ' + acctCount + ' account' + (acctCount!==1?'s':''), color:'var(--text)' },
 { label:'SAM verified', value: String(samCount), sub: 'rules-proven, certain', color:'var(--gold)' },
 { label:'AI assisted', value: String(aiCount), sub: 'supplementary hints', color:'var(--text2)' },
    { label:'Sentiment', value: posPct != null ? posPct + '%' : 'n/a', sub: posPct != null ? 'positive-leaning' : 'no reads', color: posPct != null && posPct >= 50 ? 'var(--green)' : 'var(--text3)' }
  ];
  var h = '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px">' +
    '<span style="font-size:16px;font-weight:600;color:var(--text)">Signal intelligence</span>' +
    '<span style="display:inline-flex;border:1px solid var(--border2);border-radius:2px;overflow:hidden;font-size:12px">' +
      '<span id="intel-lens-theme" onclick="setIntelLens(\'theme\')" style="padding:4px 12px;cursor:pointer;background:' + (_intelLens==='theme'?'var(--surface)':'transparent') + ';color:' + (_intelLens==='theme'?'var(--text)':'var(--text3)') + '">By theme</span>' +
      '<span id="intel-lens-account" onclick="setIntelLens(\'account\')" style="padding:4px 12px;cursor:pointer;background:' + (_intelLens==='account'?'var(--surface)':'transparent') + ';color:' + (_intelLens==='account'?'var(--text)':'var(--text3)') + '">By account</span>' +
    '</span></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">';
  tiles.forEach(function(t) {
    h += '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;padding:11px 13px">' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:3px">' + t.label + '</div>' +
      '<div style="font-size:20px;font-weight:600;color:' + t.color + ';line-height:1.1">' + t.value + '</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + t.sub + '</div>' +
    '</div>';
  });
  h += '</div>';

  h += (_intelLens === 'account') ? _renderIntelAccountLens(byAccount) : _renderIntelThemeLens(flat, junk);
  feed.innerHTML = h;
}

function _renderIntelThemeLens(flat, junk) {
  var pats = window._intelPatterns || {};
  var built = _INTEL_CATS.map(function(cat) {
    if (_intelType !== 'all' && _intelType !== cat.key) return null;
    var sigs = flat.filter(function(s){ return s._cat === cat.key; });
    var prior = 0;
    (pats[cat.pkey] || []).forEach(function(e){ prior += (e.prior || 0); });
    return { cat: cat, sigs: sigs, count: sigs.length, prior: prior, delta: sigs.length - prior };
  }).filter(Boolean);

  var active = built.filter(function(b){ return b.count > 0; }).sort(function(a,b){ return b.count - a.count; });
  var quiet = built.filter(function(b){ return b.count === 0; });

  var h = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Themes, ranked by volume</div>';
  if (!active.length) {
    h += '<div style="font-size:12px;color:var(--text3);font-style:italic;padding:4px 0 10px">No conversation signals in this window.</div>';
  }
  h += '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;overflow:hidden;margin-bottom:8px">';
  active.forEach(function(b, i) {
    var rid = 'intel-theme-' + b.cat.key;
    var samN = b.sigs.filter(function(s){ return s._source === 'sam'; }).length;
    var deltaCol = b.delta === 0 ? 'var(--text3)' : ((b.delta > 0) === b.cat.upGood ? 'var(--green)' : 'var(--coral)');
    var deltaTxt = b.delta === 0 ? 'flat' : (b.delta > 0 ? '+' + b.delta : String(b.delta));
    h += '<div onclick="toggleIntelDrill(\'' + rid + '\')" style="padding:12px 14px;cursor:pointer;' + (i ? 'border-top:1px solid var(--border2)' : '') + '">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:16px;flex-shrink:0">' + b.cat.icon + '</span>' +
        '<span style="flex:1;min-width:0;font-size:14px;font-weight:600;color:var(--text)">' + b.cat.label + '</span>' +
        (samN ? '<span style="font-size:11px;color:var(--gold);font-weight:600">' + samN + ' SAM</span>' : '') +
        '<span style="font-size:16px;font-weight:600;color:var(--text);min-width:26px;text-align:right">' + b.count + '</span>' +
        '<span style="font-size:11px;font-weight:700;color:' + deltaCol + ';background:var(--surface2);padding:2px 8px;border-radius:3px;min-width:34px;text-align:center">' + deltaTxt + '</span>' +
        '<span id="chevron-' + rid + '" style="font-size:16px;color:var(--text3)">›</span>' +
      '</div>' +
      '<div id="' + rid + '" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border2)">' + _renderThemeReceipts(b.sigs) + '</div>' +
    '</div>';
  });
  h += '</div>';

  if (quiet.length) {
    h += '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Quiet this month: ' + quiet.map(function(b){ return b.cat.label.toLowerCase(); }).join(', ') + '</div>';
  }
  if (junk.length) {
    h += '<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;background:var(--surface2);border-radius:3px;opacity:.9">' +
      '<span style="font-size:14px;flex-shrink:0">⏳</span>' +
      '<span style="flex:1;font-size:12px;color:var(--text3)">Auto-detected: staleness</span>' +
      '<span style="font-size:11px;color:var(--text3)">' + junk.length + ' accounts, system-derived, not a talking point</span>' +
    '</div>';
  }
  return h;
}

function _renderThemeReceipts(sigs) {
  var sam = sigs.filter(function(s){ return s._source === 'sam'; });
  var ai  = sigs.filter(function(s){ return s._source !== 'sam'; });
  var line = function(s) {
    return '<div style="display:flex;gap:8px;padding:4px 0;font-size:12px">' +
      '<span style="font-weight:600;color:var(--text);min-width:74px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s._account) + '</span>' +
      '<span style="flex:1;color:var(--text2);font-style:italic">' + esc(s.quote || s.context || s.name || '(no detail captured)') + '</span>' +
      '<span style="color:var(--text3);flex-shrink:0">' + esc((s._date || '').slice(5, 10)) + '</span>' +
    '</div>';
  };
  var h = '';
  if (sam.length) {
    h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' + _samChip() + '<span style="font-size:11px;color:var(--gold);font-weight:600">Certain, rules-proven</span></div>';
    h += sam.map(line).join('');
  }
  if (ai.length) {
    h += '<div style="display:flex;align-items:center;gap:6px;margin:' + (sam.length?'10px':'0') + ' 0 4px">' + _aiChip() + '<span style="font-size:11px;color:var(--text3)">Supplementary, AI-read</span></div>';
    h += ai.map(line).join('');
  }
  return h || '<div style="font-size:12px;color:var(--text3)">No detail captured.</div>';
}

function _renderIntelAccountLens(byAccount) {
  var nowMs = Date.now();
  var accts = Object.values(byAccount).map(function(a) {
    var risk = a.signals.filter(function(s){ return s._cat === 'risk_signals'; }).length;
    var exp  = a.signals.filter(function(s){ return s._cat === 'expansion_signals'; }).length;
    var samN = a.signals.filter(function(s){ return s._source === 'sam'; }).length;
    var daysDark = a.lastDate ? Math.round((nowMs - new Date(a.lastDate).getTime()) / 86400000) : 999;
    var sentEntries = Object.entries(a.sentiment).sort(function(x,y){ return y[1]-x[1]; });
    var domSent = sentEntries.length ? sentEntries[0][0] : 'neutral';
    var score = risk * 3 + (daysDark > 14 && daysDark < 999 ? 2 : 0) + exp + a.signals.length * 0.1;
    return { a: a, risk: risk, exp: exp, samN: samN, daysDark: daysDark, domSent: domSent, score: score };
  }).sort(function(x,y){ return y.score - x.score; });

  var sentMap = { positive:{c:'var(--green)',bg:'rgba(74,140,92,0.12)'}, negative:{c:'var(--coral)',bg:'rgba(192,82,63,0.12)'}, neutral:{c:'var(--text3)',bg:'var(--surface2)'} };
  var h = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Hot accounts, most actionable signal now</div>';
  h += '<div style="display:flex;flex-direction:column;gap:8px">';
  accts.forEach(function(x, idx) {
    var a = x.a;
    var rid = 'intel-acct-' + idx;
    var sm = sentMap[x.domSent] || sentMap.neutral;
    var initials = (a.name || '?').replace(/[^A-Za-z0-9 ]/g,'').split(/\s+/).map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase() || '?';
    var meta = a.signals.length + ' signal' + (a.signals.length!==1?'s':'') + ', ' + a.rows.length + ' meeting' + (a.rows.length!==1?'s':'') + (x.samN ? ', ' + x.samN + ' SAM-verified' : '');
    var flag = x.risk ? '<span style="font-size:11px;color:var(--coral);background:rgba(192,82,63,0.12);padding:2px 8px;border-radius:3px;white-space:nowrap">' + x.risk + ' risk</span>'
             : (x.daysDark > 14 && x.daysDark < 999 ? '<span style="font-size:11px;color:var(--amber);background:rgba(201,151,62,0.12);padding:2px 8px;border-radius:3px;white-space:nowrap">dark ' + x.daysDark + 'd</span>' : '');
    h += '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:3px;overflow:hidden">' +
      '<div onclick="toggleIntelDrill(\'' + rid + '\')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer">' +
        '<div style="width:34px;height:34px;border-radius:50%;background:' + sm.bg + ';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:' + sm.c + ';flex-shrink:0">' + esc(initials) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:14px;font-weight:700;color:var(--text)">' + esc(a.name) + '</div>' +
          '<div style="font-size:11px;color:var(--text3)">' + esc(meta) + '</div>' +
        '</div>' +
        flag +
        '<span style="font-size:11px;color:' + sm.c + ';background:' + sm.bg + ';padding:2px 8px;border-radius:3px;white-space:nowrap">' + x.domSent + '</span>' +
        '<span id="chevron-' + rid + '" style="font-size:16px;color:var(--text3)">›</span>' +
      '</div>' +
      '<div id="' + rid + '" style="display:none;padding:0 14px 12px">' + _renderAccountReceipts(a) + '</div>' +
    '</div>';
  });
  h += '</div>';
  return h;
}

function _renderAccountReceipts(a) {
  var catMeta = {}; _INTEL_CATS.forEach(function(c){ catMeta[c.key] = c; });
  var byMeeting = {};
  a.signals.forEach(function(s) {
    var key = (s._date || 'Undated') + ' · ' + (s._subject || '');
    (byMeeting[key] || (byMeeting[key] = [])).push(s);
  });
  return Object.entries(byMeeting).map(function(entry) {
    return '<div style="margin-bottom:8px;padding:10px 12px;background:var(--surface2);border-radius:2px">' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:600">' + esc(entry[0]) + '</div>' +
      entry[1].map(function(s) {
        var cm = catMeta[s._cat] || { icon:'○', label:'', color:'var(--text3)' };
        return '<div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-top:1px solid var(--border)">' +
          '<span style="font-size:13px;flex-shrink:0">' + cm.icon + '</span>' +
          '<div style="flex:1">' +
            '<span style="font-size:11px;font-weight:600;color:' + cm.color + '">' + cm.label + '</span> ' +
            (s._source === 'sam' ? _samChip() : _aiChip()) +
            '<div style="font-size:12px;color:var(--text);margin-top:2px">' + esc(s.quote || s.context || s.name || '') + '</div>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }).join('');
}

function toggleIntelDrill(id) {
  var el = document.getElementById(id);
  var chevron = document.getElementById('chevron-'+id);
  if (!el) return;
  var open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(90deg)';
}

window.refreshIntelligence = refreshIntelligence;
window.loadIntelligence = loadIntelligence;
window.renderIntelligence = renderIntelligence;
window.renderIntelFeed = renderIntelFeed;
window.setIntelType = setIntelType;
window.setIntelLens = setIntelLens;
window.openCarryForward = typeof openCarryForward !== 'undefined' ? openCarryForward : function(){};
window.openCarryFromTask = typeof openCarryFromTask !== 'undefined' ? openCarryFromTask : function(){};
window.closeCarryForward = typeof closeCarryForward !== 'undefined' ? closeCarryForward : function(){};
window.confirmCarryForward = typeof confirmCarryForward !== 'undefined' ? confirmCarryForward : function(){};
window.selectCarryDate = typeof selectCarryDate !== 'undefined' ? selectCarryDate : function(){};
