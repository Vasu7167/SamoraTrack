import { resolveToken, authenticate, getValidAccessToken, executeTool } from './_tools.js';

export default async function handler(req, res) {
  // CORS — ChatGPT and Gemini call from their own domains
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = resolveToken(req);
  // Accepts an API key or a legacy session token. Keys are the durable path;
  // sessions still work so existing connections do not break mid-migration.
  const auth = await authenticate(token);
  if (auth.error) return res.status(auth.status || 401).json({ error: auth.error });

  const action = req.query.action;
  try {
    let result;
    try {
      result = await executeTool(auth.accessToken, action, req.body || {});
    } catch (err) {
      // Self-heal on a stale token. Expiry bookkeeping can be wrong for
      // reasons outside this code (clock skew, a session revoked server-side,
      // a rotated refresh token), and the honest signal that it IS wrong is
      // the 401 itself. Force one refresh and retry rather than making the
      // user delete and re-add the connector in Claude's settings.
      //
      // Only sessions can go stale this way. A key mints a fresh JWT on every
      // request, so a 401 there is a real authorisation failure and retrying
      // would just repeat it.
      if (err.status !== 401 || auth.kind !== 'session') throw err;
      const retryToken = await getValidAccessToken(auth.session, token, true);
      result = await executeTool(retryToken, action, req.body || {});
    }
    res.json({ ok: true, result });
  } catch (err) {
    // 401 that survived a forced refresh means the session really is dead,
    // and the caller deserves that status rather than a generic 500.
    res.status(err.status === 401 ? 401 : 500).json({ ok: false, error: err.message });
  }
}
