import { HOST } from './_tools.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html><head>
<title>Connect SamoraTrack to AI</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F5F0E8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#FAF7F2;border:1px solid #D6CFC4;border-radius:16px;padding:32px;max-width:480px;width:100%}
.logo{font-size:11px;font-weight:700;color:#A07824;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px}
h1{font-size:22px;font-weight:700;margin-bottom:6px;color:#1A1712}
.sub{font-size:14px;color:#78716C;margin-bottom:24px;line-height:1.5}
label{display:block;font-size:12px;font-weight:600;color:#3D3A34;margin-bottom:4px}
input{width:100%;padding:10px 12px;border:1px solid #D6CFC4;border-radius:8px;font-size:14px;background:#EDE8DF;margin-bottom:14px;outline:none;color:#1A1712;-webkit-appearance:none}
button{width:100%;padding:12px;background:#A07824;border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:600;cursor:pointer}
.err{color:#C0523F;font-size:13px;margin-top:8px;display:none}
.result{margin-top:20px;display:none}
.result h2{font-size:13px;font-weight:700;color:#1A1712;margin-bottom:14px}
.platform{background:#EDE8DF;border:1px solid #D6CFC4;border-radius:10px;padding:14px;margin-bottom:10px}
.p-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.p-icon{font-size:18px}
.p-name{font-size:13px;font-weight:600;color:#1A1712}
.p-url{font-size:11px;font-family:monospace;color:#3A6EA8;background:#fff;padding:6px 8px;border-radius:6px;border:1px solid #D6CFC4;word-break:break-all;margin-bottom:6px;cursor:pointer;display:block;user-select:all}
.p-steps{font-size:11px;color:#78716C;line-height:1.6}
.copied{color:#4A8C5C;font-size:10px;margin-left:6px;display:none}
</style>
</head>
<body>
<div class="card">
  <div class="logo">✦ SamoraTrack</div>
  <h1>Connect to your AI</h1>
  <p class="sub">Sign in once. Use SamoraTrack from Claude, ChatGPT, or Gemini — scoped to your role.</p>
  <label>Email</label>
  <input type="email" id="email" placeholder="your@company.com" autocomplete="email"/>
  <label>Password</label>
  <input type="password" id="pass" placeholder="Your SamoraTrack password"/>
  <button onclick="connect()" id="btn">Connect →</button>
  <div class="err" id="err"></div>

  <div class="result" id="result">
    <h2>✓ Connected — pick your AI:</h2>

    <div class="platform">
      <div class="p-header"><span class="p-icon">🟣</span><span class="p-name">Claude Desktop</span></div>
      <div class="p-url" id="claude-url" onclick="copyEl(this,'c1')" title="Click to copy"></div>
      <span class="copied" id="c1">Copied!</span>
      <div class="p-steps">
        Settings → Developer → Edit Config → add under "mcpServers":<br>
        <code style="font-size:10px;background:#fff;padding:2px 4px;border-radius:3px">{"samoratrack":{"url":"&lt;paste URL above&gt;"}}</code><br>
        Save → restart Claude Desktop → look for 🔨 hammer icon
      </div>
    </div>

    <div class="platform">
      <div class="p-header"><span class="p-icon">🟢</span><span class="p-name">ChatGPT (Custom GPT Actions)</span></div>
      <div class="p-url" onclick="copyEl(this,'c2')" title="Click to copy">${HOST}/api/connector/openapi.json</div>
      <span class="copied" id="c2">Copied!</span>
      <div class="p-steps">
        ChatGPT → Explore GPTs → Create → Configure → Actions → Import from URL above<br>
        Authentication: API Key → Bearer → paste your token:<br>
        <span id="chatgpt-token" style="font-family:monospace;font-size:10px;background:#fff;padding:2px 6px;border-radius:3px;border:1px solid #D6CFC4;cursor:pointer" onclick="copyEl(this,'c3')"></span>
        <span class="copied" id="c3">Copied!</span>
      </div>
    </div>

    <div class="platform">
      <div class="p-header"><span class="p-icon">🔵</span><span class="p-name">Google Gemini (API)</span></div>
      <div class="p-url" onclick="copyEl(this,'c4')" title="Click to copy">${HOST}/api/connector/gemini-tools</div>
      <span class="copied" id="c4">Copied!</span>
      <div class="p-steps">
        Fetch the URL above → pass function_declarations to generativeModel<br>
        Call results with: POST /api/connector/{toolName} + Bearer token
      </div>
    </div>

    <div class="platform" style="background:rgba(160,117,42,0.06);border-color:rgba(160,117,42,0.3)">
      <div class="p-header"><span class="p-icon">🔑</span><span class="p-name">Your token (valid 7 days)</span></div>
      <div class="p-url" id="token-display" onclick="copyEl(this,'c5')" title="Click to copy"></div>
      <span class="copied" id="c5">Copied!</span>
      <div class="p-steps">Keep this private. Return here to get a new one when it expires.</div>
    </div>
  </div>
</div>
<script>
async function connect() {
  const email = document.getElementById('email').value.trim();
  const pass  = document.getElementById('pass').value;
  const err   = document.getElementById('err');
  const btn   = document.getElementById('btn');
  err.style.display = 'none';
  if (!email || !pass) { err.textContent='Enter email and password'; err.style.display='block'; return; }
  btn.textContent = 'Connecting…'; btn.disabled = true;
  try {
    const r = await fetch('/api/connector/auth', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});
    const d = await r.json();
    if (!d.ok) { err.textContent=d.error||'Login failed'; err.style.display='block'; btn.textContent='Connect →'; btn.disabled=false; return; }
    const mcpUrl = window.location.origin + '/api/connector/mcp?token=' + d.token;
    document.getElementById('claude-url').textContent    = mcpUrl;
    document.getElementById('chatgpt-token').textContent = d.token;
    document.getElementById('token-display').textContent = d.token;
    document.getElementById('result').style.display = 'block';
    btn.textContent = '✓ Connected'; btn.style.background = '#4A8C5C';
  } catch(e) { err.textContent='Error: '+e.message; err.style.display='block'; btn.textContent='Connect →'; btn.disabled=false; }
}
function copyEl(el, copyId) {
  navigator.clipboard.writeText(el.textContent).then(() => {
    const c = document.getElementById(copyId);
    c.style.display='inline'; setTimeout(()=>c.style.display='none', 1500);
  });
}
document.addEventListener('keydown', e => { if(e.key==='Enter') connect(); });
</script>
</body></html>`);
}
