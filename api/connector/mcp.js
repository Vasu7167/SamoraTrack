/**
 * MCP endpoint for Claude Desktop.
 *
 * Claude sends tool-call requests as POST with JSON body.
 * We respond synchronously — Vercel doesn't support persistent SSE,
 * but Claude's remote MCP mode works fine with request/response per call.
 */
import { resolveToken, authenticate, getValidAccessToken, executeTool, TOOL_SCHEMAS } from './_tools.js';

// Convert schemas to MCP format
function toMcpTools() {
  return TOOL_SCHEMAS.map(t => ({
    name: t.name, description: t.description,
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(Object.entries(t.params).map(([k,v]) => [k,{type:v.type||'string',...(v.enum?{enum:v.enum}:{}),description:k}])),
      required: Object.entries(t.params).filter(([,v])=>v.required).map(([k])=>k)
    }
  }));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = resolveToken(req);
  // Accepts an API key or a legacy session token.
  const auth = await authenticate(token);
  if (auth.error) {
    return res.status(auth.status || 401).json({ error: auth.error });
  }

  // GET /mcp → return tool list (MCP initialize response)
  if (req.method === 'GET') {
    return res.json({
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'samoratrack', version: '1.0.0' },
      tools: toMcpTools()
    });
  }

  // POST /mcp → handle tool call
  if (req.method === 'POST') {
    const { method, params, id } = req.body || {};
    try {
      const accessToken = auth.accessToken;

      if (method === 'initialize') {
        return res.json({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'samoratrack', version: '1.0.0' } } });
      }

      if (method === 'tools/list') {
        return res.json({ jsonrpc: '2.0', id, result: { tools: toMcpTools() } });
      }

      if (method === 'tools/call') {
        const { name, arguments: args } = params || {};
        let result;
        try {
          result = await executeTool(accessToken, name, args || {});
        } catch (err) {
          // Same self-heal as the REST route. This is the path Claude
          // actually uses, so it is the one that matters most: a stale token
          // here is what forced the user to remove and re-add the connector.
          //
          // Keys mint a fresh JWT per request, so there is nothing stale to
          // heal — a 401 there is a real authorisation failure.
          if (err.status !== 401 || auth.kind !== 'session') throw err;
          const retryToken = await getValidAccessToken(auth.session, token, true);
          result = await executeTool(retryToken, name, args || {});
        }
        return res.json({
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        });
      }

      return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
    } catch (err) {
      return res.json({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } });
    }
  }

  res.status(405).json({ error: 'GET or POST only' });
}

// Vercel config — allow larger body, longer timeout for Gemini/pipeline calls
export const config = { api: { bodyParser: { sizeLimit: '1mb' }, responseLimit: false } };
