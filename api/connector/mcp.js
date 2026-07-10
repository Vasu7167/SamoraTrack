/**
 * MCP endpoint for Claude Desktop.
 *
 * Claude sends tool-call requests as POST with JSON body.
 * We respond synchronously — Vercel doesn't support persistent SSE,
 * but Claude's remote MCP mode works fine with request/response per call.
 */
import { resolveToken, getSession, getValidAccessToken, executeTool, TOOL_SCHEMAS } from './_tools.js';

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
  const session = token ? await getSession(token) : null;
  if (!session) {
    return res.status(401).json({ error: 'Invalid token. Visit /connector/connect to get yours.' });
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
      const accessToken = await getValidAccessToken(session, token);

      if (method === 'initialize') {
        return res.json({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'samoratrack', version: '1.0.0' } } });
      }

      if (method === 'tools/list') {
        return res.json({ jsonrpc: '2.0', id, result: { tools: toMcpTools() } });
      }

      if (method === 'tools/call') {
        const { name, arguments: args } = params || {};
        const result = await executeTool(accessToken, name, args || {});
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
