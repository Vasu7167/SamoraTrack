/* SamoraOS website visitors (Drop Q). Tells SamoraOS which COMPANY visited
   which page, so your reps know an account is looking. No cookies, nothing
   stored in the browser, no personal data: SamoraOS looks up the company from
   the network and never keeps the IP address.
   Does nothing when the visitor has Global Privacy Control or Do Not Track on.
   With data-consent="required" it waits until your consent banner calls
   window.samoraConsent(true). */
(function () {
  var s = document.currentScript; if (!s) return;
  var k = s.getAttribute('data-k'); if (!k) return;
  var nav = navigator || {};
  if (nav.globalPrivacyControl === true || nav.doNotTrack === '1' || window.doNotTrack === '1') return;
  var URL_ = 'https://gowpuicpmrwsohongosf.supabase.co/functions/v1/sam-gmail-signals';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvd3B1aWNwbXJ3c29ob25nb3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTExMDgsImV4cCI6MjA5NTk2NzEwOH0.35CjODxyxOjAKp-xBOBx4oAXO_qjLyVttVaJEhp7YEg';
  var sent = {};
  function send() {
    var p = location.pathname || '/'; if (sent[p]) return; sent[p] = 1;
    try {
      fetch(URL_, { method: 'POST', keepalive: true, mode: 'cors', credentials: 'omit',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY, 'apikey': KEY },
        body: JSON.stringify({ action: 'site_visit', k: k, p: p }) }).catch(function () {});
    } catch (e) {}
  }
  var needConsent = s.getAttribute('data-consent') === 'required';
  var ok = !needConsent;
  window.samoraConsent = function (yes) { ok = !!yes; if (ok) send(); };
  if (ok) send();
  // Single-page sites: count page changes too.
  var push = history.pushState;
  history.pushState = function () { var r = push.apply(this, arguments); if (ok) setTimeout(send, 0); return r; };
  window.addEventListener('popstate', function () { if (ok) send(); });
})();
