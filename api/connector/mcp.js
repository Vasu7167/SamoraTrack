/**
 * MCP endpoint for Claude Desktop.
 *
 * Claude sends tool-call requests as POST with JSON body.
 * We respond synchronously — Vercel doesn't support persistent SSE,
 * but Claude's remote MCP mode works fine with request/response per call.
 */
import { resolveToken, authenticate, getValidAccessToken, executeTool, TOOL_SCHEMAS } from './_tools.js';

// ── Server instructions ───────────────────────────────────────────────────────
// The MCP protocol lets a server send a block of guidance that the host puts in
// context at connection time. SamoraTrack sent none, so every rule lived inside
// an individual tool description — which is only read once the model is ALREADY
// considering that tool. Nothing said how to run a SAMpaign end to end, so the
// operator carried the sequence in their head and the model guessed.
//
// Keep this short enough to stay read. It is an operating manual, not a spec:
// the vocabulary, the canonical order, the rules that prevent real damage, and
// a map from what a person says to what to call. Detail belongs in the tool
// descriptions, where it is read at the moment it applies.
const INSTRUCTIONS = `SamoraTrack: B2B sales intelligence and outreach for this user's sales org.

VOCABULARY
- SAMpaign: an outreach campaign, anchored either to one ACCOUNT or to a LIST of companies.
- Wave (launch): 1 is the initial email, 2 is follow-up 1, 3 is follow-up 2. Waves are drafted and scheduled one at a time.
- Draft vs queued: a draft sends nothing. A queued (pending) email WILL go out at its send time.
- Daily cap / ramp: how many emails one mailbox may send in a day. It is earned by sending history, shared across every campaign that mailbox runs, and capped at 50.

THE ONE RULE THAT PREVENTS REAL DAMAGE
Anything already QUEUED must be changed in place, never re-drafted.
Re-saving drafts does not replace queued emails: it creates a SECOND wave, and both go out to the same people. To correct copy on scheduled mail: get_scheduled_sends, then edit_scheduled_send per row. That keeps the send time. To change timing: reschedule_scheduled_sends. To stop it: cancel_scheduled_sends, scoped by launch or date.
If you are ever unsure whether something is queued, call get_scheduled_sends. It is read-only and costs nothing.

WRITING A WAVE
1. get_draft_brief(campaign_id, launch) — one call, everything you need. Do not chain the individual tools by hand.
2. Read its warnings first. If it says a wave is already queued, stop and ask the user.
3. Write ONE GENUINELY DIFFERENT email per person. Same email with the name swapped is not personalisation and the recipient can tell. Use the person's actual role, the account's real recorded activity, and only the proof the brief returned.
4. save_sampaign_drafts, then schedule_sampaign_drafts with dry_run true. Read the plan back to the user, including today_limit and why. Only then schedule for real.

NEVER INVENT PROOF
Client names, statistics, quotations and case studies come only from the brief's proof list. An outreach email citing a result that did not happen is a liability for this user, not a flourish. If there is no proof on record, say so and write from capability alone.

SCHEDULING IS NOT BEST-EFFORT
If a day is full, scheduling REFUSES with error_code day_full and schedules nothing. Do not pass allow_roll to make the error go away: tell the user which day is full and what is occupying it, and let them choose. A different day is a different outcome and it is theirs to approve.

DESTRUCTIVE ACTIONS NEED A CLEAR YES
Cancelling queued mail, scouting or enriching (both spend credits), and committing discovered accounts all change something real. Say exactly what and how many, then wait.

WHEN THE USER SAYS...
- "what campaigns do I have" / "how is X doing" -> get_sampaigns
- "write the emails" / "draft outreach for X" -> get_draft_brief, then save_sampaign_drafts
- "fix the wording" / "the salutation is wrong" / "change the date in the email" -> get_scheduled_sends, then edit_scheduled_send. NOT new drafts.
- "send it earlier" / "move it to Monday" / "it went out on the wrong day" -> reschedule_scheduled_sends
- "stop it" / "don't send those" -> cancel_scheduled_sends, scoped
- "how many can I send today" / "why only 8" -> get_sending_limit
- "find me contacts at X" -> set_scout_targets first, then scout_sampaign_contacts or scout_list_accounts
- "find me new companies" -> discover_accounts, show the evidence, let them choose, then commit_discovery
- "we did a great job at X and they loved it" -> offer save_success_story, so future outreach can cite it

EMPTY IS AN ANSWER
If something returns nothing, say so plainly. Do not fill a gap with a plausible guess: this product's whole promise is that every number shows its receipts.`;

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
      serverInfo: { name: 'samoratrack', version: '1.1.0' },
      instructions: INSTRUCTIONS,
      tools: toMcpTools()
    });
  }

  // POST /mcp → handle tool call
  if (req.method === 'POST') {
    const { method, params, id } = req.body || {};
    try {
      const accessToken = auth.accessToken;

      if (method === 'initialize') {
        // instructions rides on the initialize result: this is the one moment
        // the host asks what this server is and how to use it.
        return res.json({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'samoratrack', version: '1.1.0' }, instructions: INSTRUCTIONS } });
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
