/**
 * Vantör Bokföring — MCP server as a Supabase Edge Function
 *
 * Implements the MCP Streamable HTTP transport (stateless, one request/response per call).
 * The Claude iOS app connects to:
 *   https://<project>.supabase.co/functions/v1/mcp
 * with header:
 *   Authorization: Bearer <supabase-anon-key>
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// CORS headers — needed so the web app can also call this directly if wanted
// ---------------------------------------------------------------------------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mcp-session-id',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// ---------------------------------------------------------------------------
// Types (mirrored from src/types/index.ts)
// ---------------------------------------------------------------------------

type TransactionStatus = 'utkast' | 'bokförd' | 'betald'
type TransactionType = 'faktura_ut' | 'kvitto_se' | 'kvitto_eu_saas' | 'kvitto_eu_vara' | 'lön' | 'manuell'

interface TransaktionsRad { konto: number; debet: number; kredit: number }

interface Transaction {
  id: string
  datum: string
  beskrivning: string
  typ: TransactionType
  status: TransactionStatus
  rader: TransaktionsRad[]
  bilagor: string[]
}

interface RawTransaction {
  id: string
  datum: string
  beskrivning: string
  typ: string
  status: string
  bilagor: string[]
  transaction_rader: { id: string; konto: number; debet: number; kredit: number }[]
}

// ---------------------------------------------------------------------------
// BAS accounts
// ---------------------------------------------------------------------------

const BAS_ACCOUNTS = [
  { id: 1510, namn: 'Kundfordringar', typ: 'tillgång' },
  { id: 1650, namn: 'Momsfordran', typ: 'tillgång' },
  { id: 1920, namn: 'Bankkonto', typ: 'tillgång' },
  { id: 2610, namn: 'Utgående moms 25%', typ: 'skuld' },
  { id: 2640, namn: 'Ingående moms', typ: 'tillgång' },
  { id: 2650, namn: 'Momsredovisning', typ: 'skuld' },
  { id: 3001, namn: 'Försäljning tjänster SE 25%', typ: 'intäkt' },
  { id: 3004, namn: 'Försäljning tjänster EU (omvänd)', typ: 'intäkt' },
  { id: 3006, namn: 'Försäljning tjänster export', typ: 'intäkt' },
  { id: 4000, namn: 'Inköp varor/tjänster SE', typ: 'kostnad' },
  { id: 4545, namn: 'Förvärvsmoms utländska tjänster', typ: 'kostnad' },
  { id: 5400, namn: 'Förbrukningsinventarier', typ: 'kostnad' },
  { id: 6570, namn: 'Licenser & SaaS', typ: 'kostnad' },
]

// ---------------------------------------------------------------------------
// MCP tool definitions (JSON Schema — note: inputSchema, not input_schema)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'list_accounts',
    description: 'List all BAS chart-of-accounts entries with account number, Swedish name and type.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_transactions',
    description: 'List transactions from the database. Optionally filter by status and/or date range.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['utkast', 'bokförd', 'betald'], description: 'Filter by status' },
        from_date: { type: 'string', description: 'Earliest date YYYY-MM-DD' },
        to_date: { type: 'string', description: 'Latest date YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_transaction',
    description: 'Get a single transaction by UUID, including all accounting rows.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Transaction UUID' } },
      required: ['id'],
    },
  },
  {
    name: 'create_transaction',
    description: `Create a new transaction with balanced accounting rows.
Types: faktura_ut (outgoing invoice SE 25%), kvitto_se (receipt SE 25%),
kvitto_eu_saas (EU/SaaS e.g. GitHub/Slack/AWS), kvitto_eu_vara (EU goods reverse charge),
lön (payroll), manuell (custom).
Rows MUST balance: sum(debet) = sum(kredit).`,
    inputSchema: {
      type: 'object',
      properties: {
        datum: { type: 'string', description: 'Date YYYY-MM-DD' },
        beskrivning: { type: 'string', description: 'Description or counterparty name' },
        typ: {
          type: 'string',
          enum: ['faktura_ut', 'kvitto_se', 'kvitto_eu_saas', 'kvitto_eu_vara', 'lön', 'manuell'],
        },
        status: { type: 'string', enum: ['utkast', 'bokförd', 'betald'], description: 'Defaults to bokförd' },
        rader: {
          type: 'array',
          description: 'Journal rows — must be balanced',
          items: {
            type: 'object',
            properties: {
              konto: { type: 'number', description: 'BAS account number e.g. 6570' },
              debet: { type: 'number', minimum: 0 },
              kredit: { type: 'number', minimum: 0 },
            },
            required: ['konto', 'debet', 'kredit'],
          },
        },
      },
      required: ['datum', 'beskrivning', 'typ', 'rader'],
    },
  },
  {
    name: 'update_transaction_status',
    description: 'Change the status of an existing transaction (utkast → bokförd → betald).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Transaction UUID' },
        status: { type: 'string', enum: ['utkast', 'bokförd', 'betald'] },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'delete_transaction',
    description: 'Delete a transaction and all its accounting rows. Irreversible.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Transaction UUID' } },
      required: ['id'],
    },
  },
  {
    name: 'get_ledger',
    description: 'Get running-balance ledger for a single BAS account. Returns each posting with a running saldo.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'number', description: 'BAS account number e.g. 1920' },
        from_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to_date: { type: 'string', description: 'End date YYYY-MM-DD' },
      },
      required: ['account_id'],
    },
  },
  {
    name: 'get_vat_report',
    description: `Calculate Swedish VAT report (momsdeklaration) for a date range.
Returns: utgåendeMoms (box 05), ingåendeMoms (box 48), nettoMoms (box 49, positive = pay Skatteverket).`,
    inputSchema: {
      type: 'object',
      properties: {
        from_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to_date: { type: 'string', description: 'End date YYYY-MM-DD' },
      },
      required: ['from_date', 'to_date'],
    },
  },
]

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function mapRow(raw: RawTransaction): Transaction {
  return {
    id: raw.id,
    datum: raw.datum,
    beskrivning: raw.beskrivning,
    typ: raw.typ as TransactionType,
    status: raw.status as TransactionStatus,
    bilagor: raw.bilagor ?? [],
    rader: (raw.transaction_rader ?? []).map((r) => ({
      konto: r.konto,
      debet: Number(r.debet),
      kredit: Number(r.kredit),
    })),
  }
}

// ---------------------------------------------------------------------------
// Calculation helpers
// ---------------------------------------------------------------------------

function buildLedger(accountId: number, transactions: Transaction[]) {
  const rows: { datum: string; beskrivning: string; debet: number; kredit: number; saldo: number }[] = []
  const relevant = transactions
    .filter((t) => t.status !== 'utkast')
    .filter((t) => t.rader.some((r) => r.konto === accountId))
    .sort((a, b) => a.datum.localeCompare(b.datum))

  let saldo = 0
  for (const t of relevant) {
    for (const r of t.rader) {
      if (r.konto !== accountId) continue
      saldo += r.debet - r.kredit
      rows.push({ datum: t.datum, beskrivning: t.beskrivning, debet: r.debet, kredit: r.kredit, saldo })
    }
  }
  return rows
}

function buildVatReport(fromDate: string, toDate: string, transactions: Transaction[]) {
  const relevant = transactions.filter(
    (t) => t.status !== 'utkast' && t.datum >= fromDate && t.datum <= toDate,
  )
  const utgående = relevant.flatMap((t) => t.rader).filter((r) => r.konto === 2610).reduce((s, r) => s + r.kredit, 0)
  const ingående = relevant.flatMap((t) => t.rader).filter((r) => r.konto === 2640).reduce((s, r) => s + r.debet, 0)
  const förvärvs = relevant.flatMap((t) => t.rader).filter((r) => r.konto === 4545).reduce((s, r) => s + r.kredit, 0)
  return {
    utgåendeMoms: utgående + förvärvs,
    ingåendeMoms: ingående,
    nettoMoms: utgående + förvärvs - ingående,
  }
}

// ---------------------------------------------------------------------------
// Tool executor
// ---------------------------------------------------------------------------

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  if (name === 'list_accounts') {
    return JSON.stringify(BAS_ACCOUNTS, null, 2)
  }

  if (name === 'list_transactions') {
    let query = supabase
      .from('transactions')
      .select('*, transaction_rader(*)')
      .order('datum', { ascending: false })
    if (args.status) query = query.eq('status', args.status)
    if (args.from_date) query = query.gte('datum', args.from_date)
    if (args.to_date) query = query.lte('datum', args.to_date)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return JSON.stringify(((data as RawTransaction[]) ?? []).map(mapRow), null, 2)
  }

  if (name === 'get_transaction') {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, transaction_rader(*)')
      .eq('id', args.id)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Transaction not found')
    return JSON.stringify(mapRow(data as RawTransaction), null, 2)
  }

  if (name === 'create_transaction') {
    const { datum, beskrivning, typ, status = 'bokförd', rader } = args as {
      datum: string
      beskrivning: string
      typ: TransactionType
      status?: TransactionStatus
      rader: TransaktionsRad[]
    }

    const { data: txRow, error: txError } = await supabase
      .from('transactions')
      .insert({ datum, beskrivning, typ, status, bilagor: [] })
      .select('id')
      .single()

    if (txError || !txRow) throw new Error(txError?.message ?? 'Insert failed')
    const id = (txRow as { id: string }).id

    const { error: raderError } = await supabase
      .from('transaction_rader')
      .insert(rader.map((r) => ({ transaction_id: id, ...r })))

    if (raderError) throw new Error(raderError.message)
    return `Verifikation skapad: ${id}`
  }

  if (name === 'update_transaction_status') {
    const { error } = await supabase
      .from('transactions')
      .update({ status: args.status })
      .eq('id', args.id)
    if (error) throw new Error(error.message)
    return `Transaction ${args.id} updated to ${args.status}`
  }

  if (name === 'delete_transaction') {
    const { error } = await supabase.from('transactions').delete().eq('id', args.id)
    if (error) throw new Error(error.message)
    return `Deleted transaction ${args.id}`
  }

  if (name === 'get_ledger') {
    const { account_id, from_date, to_date } = args as { account_id: number; from_date?: string; to_date?: string }
    let query = supabase.from('transactions').select('*, transaction_rader(*)')
    if (from_date) query = query.gte('datum', from_date)
    if (to_date) query = query.lte('datum', to_date)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    const txns = ((data as RawTransaction[]) ?? []).map(mapRow)
    const account = BAS_ACCOUNTS.find((a) => a.id === account_id)
    const rows = buildLedger(account_id, txns)
    return JSON.stringify({
      account: account ?? { id: account_id, namn: 'Unknown', typ: 'unknown' },
      rows,
      closing_balance: rows.at(-1)?.saldo ?? 0,
    }, null, 2)
  }

  if (name === 'get_vat_report') {
    const { from_date, to_date } = args as { from_date: string; to_date: string }
    const { data, error } = await supabase.from('transactions').select('*, transaction_rader(*)')
    if (error) throw new Error(error.message)
    const txns = ((data as RawTransaction[]) ?? []).map(mapRow)
    const report = buildVatReport(from_date, to_date, txns)
    return JSON.stringify({
      period: `${from_date} – ${to_date}`,
      box_05_utgåendeMoms: report.utgåendeMoms,
      box_48_ingåendeMoms: report.ingåendeMoms,
      box_49_nettoMoms: report.nettoMoms,
      verdict: report.nettoMoms > 0
        ? `Betala ${report.nettoMoms.toFixed(2)} kr till Skatteverket`
        : report.nettoMoms < 0
          ? `Återfå ${Math.abs(report.nettoMoms).toFixed(2)} kr från Skatteverket`
          : 'Netto noll',
    }, null, 2)
  }

  throw new Error(`Unknown tool: ${name}`)
}

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

function ok(id: unknown, result: unknown): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, result }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
}

function err(id: unknown, message: string, code = -32000): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const path = url.pathname
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const BASE = `https://${url.host}/functions/v1/mcp`

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  // OAuth discovery
  if (path.endsWith('/.well-known/oauth-authorization-server')) {
    return new Response(JSON.stringify({
      issuer: BASE,
      authorization_endpoint: `${BASE}/authorize`,
      token_endpoint: `${BASE}/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // OAuth authorize — immediately redirect to callback with static code
  if (path.endsWith('/authorize')) {
    const redirectUri = url.searchParams.get('redirect_uri')
    const state = url.searchParams.get('state')
    if (!redirectUri) return new Response('Missing redirect_uri', { status: 400, headers: CORS })
    const callback = new URL(redirectUri)
    callback.searchParams.set('code', 'static_code')
    if (state) callback.searchParams.set('state', state)
    return Response.redirect(callback.toString(), 302)
  }

  // OAuth token exchange — return anon key as access token
  if (path.endsWith('/token') && req.method === 'POST') {
    return new Response(JSON.stringify({
      access_token: ANON_KEY,
      token_type: 'bearer',
      expires_in: 3600,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // Health check
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ ok: true, server: 'vantör-bokföring', tools: TOOLS.length }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  // Validate Bearer token
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : url.searchParams.get('apikey') ?? ''
  if (token !== ANON_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json', 'WWW-Authenticate': `Bearer realm="${BASE}"` },
    })
  }

  // Create Supabase client (service role bypasses RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return err(null, 'Invalid JSON', -32700)
  }

  const { method, params, id } = body as {
    method: string
    params?: Record<string, unknown>
    id?: unknown
  }

  // Notifications (no id) — acknowledge with 204
  if (id === undefined) {
    return new Response(null, { status: 204, headers: CORS })
  }

  try {
    if (method === 'initialize') {
      return ok(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'vantör-bokföring', version: '1.0.0' },
      })
    }

    if (method === 'tools/list') {
      return ok(id, { tools: TOOLS })
    }

    if (method === 'tools/call') {
      const { name, arguments: toolArgs = {} } = (params ?? {}) as {
        name: string
        arguments?: Record<string, unknown>
      }
      const text = await executeTool(name, toolArgs, supabase)
      return ok(id, { content: [{ type: 'text', text }] })
    }

    if (method === 'ping') {
      return ok(id, {})
    }

    return err(id, `Method not found: ${method}`, -32601)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return ok(id, {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    })
  }
})
