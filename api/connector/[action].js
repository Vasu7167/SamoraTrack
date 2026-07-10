import { resolveToken, getSession, getValidAccessToken, executeTool } from './_tools.js';

export default async function handler(req, res) {
  // CORS — ChatGPT and Gemini call from their own domains
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = resolveToken(req);
  const session = token ? await getSession(token) : null;
  if (!session) return res.status(401).json({ error: 'Invalid token. Get yours at /connector/connect' });

  const action = req.query.action;
  try {
    const accessToken = await getValidAccessToken(session, token);
    const result = await executeTool(accessToken, action, req.body || {});
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
