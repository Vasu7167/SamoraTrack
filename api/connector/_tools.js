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

// expires_at has been read back in more than one shape depending on the
// column type: a bigint comes back as a number (or a numeric string), a
// timestamptz comes back as an ISO string. The original code did
// `Date.now() < session.expires_at - 120000`, which on an ISO string
// evaluates to `Date.now() < NaN` — always false, so it refreshed on EVERY
// call. Supabase rotates the refresh token each time it is used, so two
// concurrent tool calls would present the same refresh token, trip reuse
// detection, and get the whole token family revoked. That is what a
// connector "logging itself out" looks like from the outside.
function parseExpiry(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v);
  if (/^\d+$/.test(s)) return Number(s);         // bigint, possibly stringified
  const t = Date.parse(s);                        // ISO timestamptz
  return Number.isNaN(t) ? 0 : t;
}

export async function getValidAccessToken(session, token, force = false) {
  if (!force && Date.now() < parseExpiry(session.expires_at) - 120_000) {
    return session.access_token;
  }

  // Concurrency guard. Claude fires several tool calls in parallel; without
  // this they would all refresh at once with the same refresh token and
  // revoke each other. Re-read the row first: if another in-flight request
  // already refreshed, adopt its result instead of spending our own.
  const fresh = await getSession(token);
  if (fresh && fresh.access_token && fresh.access_token !== session.access_token) {
    Object.assign(session, fresh);
    if (Date.now() < parseExpiry(fresh.expires_at) - 120_000) return fresh.access_token;
  }

  const refreshToken = (fresh && fresh.refresh_token) || session.refresh_token;
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  const d = await r.json();
  if (!d.access_token) {
    throw new Error('Samora session expired and could not be renewed. Reconnect at ' + HOST + '/api/connector/connect');
  }
  const updates = {
    access_token: d.access_token,
    // Stored as a number. If the column is timestamptz this write will fail
    // loudly rather than silently round-trip into something unusable — which
    // is the outcome to want, because parseExpiry above tolerates both but
    // the write is where the ambiguity should be settled.
    expires_at: Date.now() + (d.expires_in || 3600) * 1000,
    ...(d.refresh_token ? { refresh_token: d.refresh_token } : {})
  };
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
  if (!r.ok) {
    let detail = '';
    try {
      const bodyText = await r.text();
      if (bodyText) {
        try {
          const parsed = JSON.parse(bodyText);
          detail = ' — ' + (parsed.error || parsed.message || bodyText).toString().slice(0, 500);
        } catch (_e) {
          detail = ' — ' + bodyText.slice(0, 500);
        }
      }
    } catch (_e) { /* body unreadable, fall back to bare status */ }
    const err = new Error(`${action} failed (${r.status})${detail}`);
    // Carried so callers can distinguish "your token is stale" from "that
    // action genuinely failed". Without it, a 401 is indistinguishable from
    // a 500 and the only recovery anyone can offer the user is "relink it".
    err.status = r.status;
    throw err;
  }
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
  { name: 'get_sampaigns',         description: 'List the caller\'s manual SAMpaigns (account-anchored outreach campaigns) with contact-count and status summary, INCLUDING campaign_goal (the specific pitch/ask for that campaign, e.g. "book a 15-min demo"). Call this first if you don\'t already have a campaign_id — campaign_goal answers "what is this campaign about", do not ask the user that if it is present.', params: {} },
  { name: 'get_sampaign_contacts', description: 'Full contact roster for one SAMpaign — enriched profile (title, seniority, LinkedIn), engagement status, and account-collision flag. Use this to personalize outreach emails. Call get_company_context too, before drafting any pitch copy, so you use the org\'s real product/ICP instead of asking the user what they sell.', params: { campaign_id: { type: 'string', required: true } } },
  { name: 'get_company_context',   description: 'What this org actually sells: product names (from Admin → Products) and ICP definition (ideal use case, target industries/geographies/stakeholders, keywords, from Admin → ICP Definition). Call this BEFORE drafting any outreach, pitch, or personalized email copy — do not ask the user what they are pitching, this answers it.', params: {} },
  { name: 'save_sampaign_drafts',  description: 'Write ONE PERSONALIZED EMAIL PER CONTACT back into a SAMpaign as drafts. This is how you deliver outreach copy: never send mail yourself, and never ask the user to copy-paste it. Workflow: get_sampaigns (goal) → get_sampaign_contacts (who, with title/seniority/LinkedIn) → get_company_context (what we sell) → write a genuinely different email per person → save here → then schedule_sampaign_drafts. Drafts do NOT send until scheduled, so it is safe to save and let the user review. A campaign sends in WAVES: launch=1 is the initial email, launch=2 is follow-up 1, launch=3 is follow-up 2, and so on (defaults to 1). You can write later waves in advance — a follow-up should reference the earlier email and add something new, never just repeat it. Re-saving the same contact and launch replaces that draft.', params: { campaign_id: { type: 'string', required: true }, drafts: { type: 'array', required: true }, launch: { type: 'number' }, generated_by: { type: 'string' } } },
  { name: 'schedule_sampaign_drafts', description: 'Turn one WAVE of saved drafts into scheduled sends, automatically spread over multiple days at a deliverability-safe rate. Pass the same launch number you saved the drafts with (defaults to 1). Follow-up waves (launch>1) start on the date already set on the campaign, so you usually do not need start_at for them. ALWAYS call with dry_run=true first and show the user the plan (how many days, how many per day, first and last send) before committing. Samora throttles on purpose: cold sending from one mailbox is safe at roughly 20-50/day, ramping up from ~8, and blasting a whole campaign at once risks the mailbox being suspended. Do not try to defeat this by scheduling batches back to back — the cap is enforced again at send time per mailbox per day.', params: { campaign_id: { type: 'string', required: true }, launch: { type: 'number' }, start_at: { type: 'string' }, daily_cap: { type: 'number' }, window_start_hour: { type: 'number' }, window_end_hour: { type: 'number' }, skip_weekends: { type: 'boolean' }, dry_run: { type: 'boolean' } } },
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
    case 'get_sampaigns':         return edge(accessToken, 'list_sampaigns', {});
    case 'get_sampaign_contacts': return edge(accessToken, 'list_sampaign_contacts', { campaign_id: args.campaign_id });
    case 'get_company_context':  return edge(accessToken, 'get_company_context', {});
    case 'save_sampaign_drafts': {
      // Normalise here rather than trusting the model's shape. Different
      // tools emit {contact_id,subject,body} vs {id,...} vs {contactId,...},
      // and a silently-dropped draft is worse than a loud rejection.
      const raw = Array.isArray(args.drafts) ? args.drafts : [];
      const drafts = raw.map(d => ({
        contact_id: d.contact_id || d.contactId || d.id || null,
        subject: d.subject || d.title || '',
        body: d.body || d.message || d.text || ''
      })).filter(d => d.contact_id);
      if (!drafts.length) throw new Error('drafts must be a non-empty array of { contact_id, subject, body }');
      return edge(accessToken, 'save_sampaign_drafts', { campaign_id: args.campaign_id, drafts, launch: args.launch || 1, generated_by: args.generated_by || 'ai' });
    }
    case 'schedule_sampaign_drafts':
      return edge(accessToken, 'schedule_sampaign_drafts', {
        campaign_id: args.campaign_id,
        launch: args.launch || 1,
        start_at: args.start_at || null,
        daily_cap: args.daily_cap ?? null,
        window_start_hour: args.window_start_hour ?? null,
        window_end_hour: args.window_end_hour ?? null,
        skip_weekends: args.skip_weekends ?? null,
        dry_run: !!args.dry_run
      });
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
