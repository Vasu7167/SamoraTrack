import { supabaseLogin, saveSession } from './_tools.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const d = await supabaseLogin(email, password);
    const token = Buffer.from(email + ':' + Date.now()).toString('base64').replace(/[^a-zA-Z0-9]/g,'').slice(0,32);
    await saveSession(token, {
      access_token:  d.access_token,
      refresh_token: d.refresh_token,
      expires_at:    Date.now() + (d.expires_in || 3600) * 1000,
      email
    });
    res.json({ ok: true, token, email });
  } catch (err) {
    res.status(401).json({ ok: false, error: err.message });
  }
}
