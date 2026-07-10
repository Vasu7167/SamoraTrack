/**
 * _tools.js — shared logic for all connector API routes
 *
 * Sessions stored in Supabase mcp_sessions table.
 * No Vercel KV, no extra services — Supabase is already here.
 */

export const SB_URL   = process.env.SB_URL   || 'https://gowpuicpmrwsohongosf.supabase.co';
export const SB_ANON  = process.env.SB_ANON  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvd3B1aWNwbXJ3c29ob25nb3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTExMDgsImV4cCI6MjA5NTk2NzEwOH0.35CjODxyxOjAKp-xBOBx4oAXO_qjLyVttVaJEhp7YEg';
const SB_SERVICE      = process.env.SUPABASE_SERVICE_ROLE_KEY || SB_ANON;
export const EDGE_FN  = SB_URL + '/functions/v1/sam-gmail-signals';
export const HOST     = process.env.HOST || 'https://samoratrack.vercel.app';

// ── Session store via Supabase mcp_sessions table ─────────────────────────────
// Service role key bypasses RLS — sessions are internal server state,
// not user-visible data.

export async function saveSession(token, session) {
  const row = { token, access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at, email: session.email || null };
  await fetch(`${SB_URL}/rest/v1/mcp_sessions`, {
    method: 'POST',
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row)
  });
}

export async function getSession(token) {
  if (!token) return null;
  const r = await fetch(`${SB_URL}/rest/v1/mcp_sessions?token=eq.${encodeURIComponent(token)}&select=*&limit=1`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` }
  });
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0];
}

export async function updateSession(token, updates) {
  await fetch(`${SB_URL}/rest/v1/mcp_sessions?token=eq.${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
export async function supabaseLogin(email, password) {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(d.error_description || d.error || 'Login failed');
  return d;
}

export async function getValidAccessToken(session, token) {
  if (Date.now() < (session.expires_at || 0) - 120_000) return session.access_token;
  // Refresh
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Session expired — reconnect at ' + HOST + '/api/connector/connect');
  const updates = { access_token: d.access_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000, ...(d.refresh_token ? { refresh_token: d.refresh_token } : {}) };
  Object.assign(session, updates);
  await updateSession(token, updates);
  return session.access_token;
}

export function resolveToken(req) {
  const auth = (req.headers.authorization || req.headers['Authorization'] || '').replace(/^Bearer\s+/i, '');
  return auth || (req.query && req.query.token) || null;
}

// ── Edge function caller ──────────────────────────────────────────────────────
export async function edge(accessToken, action, payload = {}) {
  const r = await fetch(EDGE_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, apikey: SB_ANON },
    body: JSON.stringify({ action, ...payload })
  });
  if (!r.ok) throw new Error(`${action} failed (${r.status})`);
  return r.json();
}

// ── Date helpers ──────────────────────────────────────────────────────────────
export const today = () => new Date().toISOString().split('T')[0];

export function calcRange(period) {
  const now = new Date(); const t = today();
  if (period === 'today')     return { from: t, to: t };
  if (period === 'wtd')       { const m = new Date(now); m.setDate(now.getDate()-(now.getDay()||7)+1); return { from: m.toISOString().split('T')[0], to: t }; }
  if (period === 'last_week') { const m = new Date(now); m.setDate(now.getDate()-(now.getDay()||7)-6); const s = new Date(m); s.setDate(m.getDate()+6); return { from: m.toISOString().split('T')[0], to: s.toISOString().split('T')[0] }; }
  if (period === 'mtd')       return { from: t.slice(0,8)+'01', to: t };
  if (period === 'qtd')       { const q=Math.floor(now.getMonth()/3)*3; return { from: `${now.getFullYear()}-${String(q+1).padStart(2,'0')}-01`, to: t }; }
  return { from: t, to: t };
}

// ── Tool schemas ──────────────────────────────────────────────────────────────
export const TOOL_SCHEMAS = [
  { name: 'get_pipeline',          description: 'Pipeline with signal scores, deal values, verification tiers. Managers see team. Reps see own.',                    params: {} },
  { name: 'get_account_signals',   description: 'All signals for an account: emails, calls, LinkedIn, sequencing, notetaker intelligence.',                         params: { account: { type: 'string', required: true }, days: { type: 'number' } } },
  { name: 'get_account_timeline',  description: 'Chronological feed: every email, call, meeting, score change, deal change for an account.',                         params: { account_id: { type: 'string', required: true }, days: { type: 'number' } } },
  { name: 'get_coverage',          description: 'Which accounts have verified activity (email/call/LinkedIn/WhatsApp) and which are gaps.',                           params: { date_from: { type: 'string' }, date_to: { type: 'string' }, rep_user_id: { type: 'string' } } },
  { name: 'get_intent_vs_reality', description: 'What reps logged vs what was verified. Shows verified ✓, unverified ⚠, gaps 🚨.',                                 params: { period: { type: 'string', enum: ['today','wtd','last_week','mtd','qtd'] }, rep_user_id: { type: 'string' } } },
  { name: 'get_team_overview',     description: 'Manager view: every rep\'s tasks, wins, pipeline, hot accounts, who hasn\'t logged today.',                         params: { date: { type: 'string' } } },
  { name: 'get_daily_brief',       description: 'SAM AI brief: top 3 accounts to act on, calendar prep, coaching signal, single priority.',                          params: {} },
  { name: 'get_market_signals',    description: 'Market signals: hiring, expansion, funding, news — grounded in live web search.',                                   params: { account: { type: 'string' } } },
  { name: 'get_sequencing_stats',  description: 'SmartReach/sequencing stats: open rates, reply rates, hot prospects by rep.',                                       params: { days: { type: 'number' } } },
  { name: 'get_analytics',         description: 'Pipeline analytics: verified vs partial, rep leaderboard, signal trends, win/loss.',                                params: { period: { type: 'string', enum: ['month','quarter','year'] } } },
  { name: 'send_email',            description: 'Send email via connected Gmail or Outlook. ALWAYS confirm with user before calling.',                               params: { to: { type: 'string', required: true }, subject: { type: 'string', required: true }, body: { type: 'string', required: true }, cc: { type: 'string' }, account_name: { type: 'string' } } },
];

// ── Tool execution ────────────────────────────────────────────────────────────
export async function executeTool(accessToken, name, args = {}) {
  switch (name) {
    case 'get_pipeline': {
      const d = await edge(accessToken, 'get_pipeline');
      if (!d.deals) return d;
      return { total_pipeline_usd: d.totalValue, weighted_forecast_usd: d.weightedValue, by_tier: d.byTier, accounts: d.deals.map(a => ({ account: a.account, signal_score: a.signal_score, tier: a.tier, deal_value_usd: a.deal_value_usd, deal_type: a.deal_type, region: a.region, icp_score: a.icp_score, rep: a.rep_email?.split('@')[0] })) };
    }
    case 'get_account_signals':   return edge(accessToken, 'search_account',         { account: args.account, days: args.days || 30 });
    case 'get_account_timeline':  return edge(accessToken, 'get_account_timeline',    { account_id: args.account_id, days: args.days || 90 });
    case 'get_coverage': {
      const d = await edge(accessToken, 'account_coverage', { date_from: args.date_from || today(), date_to: args.date_to || today(), rep_user_id: args.rep_user_id || null });
      if (!d.accountGrid) return d;
      return { period: `${args.date_from||today()} → ${args.date_to||today()}`, summary: d.summary, verified: d.accountGrid.filter(a=>a.email?.verified>0||a.call?.verified>0).map(a=>({account:a.account,email:a.email?.verified,calls:a.call?.verified})), gaps: d.accountGrid.filter(a=>!a.email?.verified&&!a.call?.verified&&(a.email?.logged>0||a.call?.logged>0)).map(a=>({account:a.account,email_logged:a.email?.logged,calls_logged:a.call?.logged})), untouched: d.accountGrid.filter(a=>!a.email?.logged&&!a.call?.logged).map(a=>a.account) };
    }
    case 'get_intent_vs_reality': {
      const { from, to } = calcRange(args.period || 'last_week');
      const d = await edge(accessToken, 'intent_vs_reality', { date_from: from, date_to: to, rep_user_id: args.rep_user_id || null });
      if (!d.results) return d;
      return { period: `${from} → ${to}`, summary: { verified: d.verified, gaps: d.gaps, total: d.totalTasks, rate: d.totalTasks>0?Math.round(d.verified/d.totalTasks*100)+'%':'0%' }, results: d.results.map(r=>({date:r.date,task:r.text,account:r.account,signal:r.signal,done:r.done,outcome:r.activityOutcome||null})) };
    }
    case 'get_team_overview':     return edge(accessToken, 'get_team_digest',         { date: args.date || today() });
    case 'get_daily_brief':       return edge(accessToken, 'generate_daily_brief');
    case 'get_market_signals':    return edge(accessToken, 'scan_external_signals',   args.account ? { account: args.account } : {});
    case 'get_sequencing_stats':  return edge(accessToken, 'get_sequencing_stats',    { days: args.days || 30 });
    case 'get_analytics':         return edge(accessToken, 'get_analytics',           { period: args.period || 'month' });
    case 'send_email':            return edge(accessToken, 'send_email_via_provider', { to: args.to, subject: args.subject, body: args.body, cc: args.cc||null, account_name: args.account_name||null });
    default: throw new Error('Unknown tool: ' + name);
  }
}

// ── Schema converters ─────────────────────────────────────────────────────────
export function toOpenApiSpec(host) {
  const paths = {};
  TOOL_SCHEMAS.forEach(t => {
    const props = {};
    Object.entries(t.params).forEach(([k,v]) => { props[k] = { type: v.type||'string', ...(v.enum?{enum:v.enum}:{}), description: k }; });
    paths[`/api/connector/${t.name}`] = { post: { operationId: t.name, summary: t.description, security: [{bearerAuth:[]}], requestBody: { required: Object.keys(t.params).length>0, content: { 'application/json': { schema: { type:'object', properties: props, required: Object.entries(t.params).filter(([,v])=>v.required).map(([k])=>k) } } } }, responses: { '200': { description:'Success', content: { 'application/json': { schema: { type:'object' } } } } } } };
  });
  return { openapi:'3.0.0', info:{ title:'SamoraTrack', version:'1.0.0', description:'B2B sales intelligence API' }, servers:[{url:host}], components:{ securitySchemes:{ bearerAuth:{ type:'http', scheme:'bearer' } } }, paths };
}

export function toGeminiFunctions() {
  return TOOL_SCHEMAS.map(t => ({ name: t.name, description: t.description, parameters: { type:'OBJECT', properties: Object.fromEntries(Object.entries(t.params).map(([k,v])=>[k,{type:(v.type||'string').toUpperCase(),...(v.enum?{enum:v.enum}:{})}])), required: Object.entries(t.params).filter(([,v])=>v.required).map(([k])=>k) } }));
}
