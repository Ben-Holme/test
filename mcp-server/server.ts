import 'dotenv/config'
import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
)

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
// BAS accounts (mirrored from src/data/basAccounts.ts)
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

async function fetchTransactions(filters?: {
  status?: string
  from_date?: string
  to_date?: string
}): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*, transaction_rader(*)')
    .order('datum', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.from_date) query = query.gte('datum', filters.from_date)
  if (filters?.to_date) query = query.lte('datum', filters.to_date)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data as RawTransaction[]) ?? []).map(mapRow)
}

// ---------------------------------------------------------------------------
// Pure calculation helpers (mirrored from src/lib/)
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
// MCP server factory — creates a fresh server per request (stateless)
// ---------------------------------------------------------------------------

function createServer() {
  const server = new McpServer({
    name: 'vantör-bokföring',
    version: '1.0.0',
  })

  // --- list_accounts -------------------------------------------------------
  server.tool(
    'list_accounts',
    'List all BAS chart-of-accounts entries with account number, Swedish name and type.',
    {},
    async () => ({
      content: [{ type: 'text' as const, text: JSON.stringify(BAS_ACCOUNTS, null, 2) }],
    }),
  )

  // --- list_transactions ---------------------------------------------------
  server.tool(
    'list_transactions',
    'List transactions from the database. Optionally filter by status and/or date range.',
    {
      status: z.enum(['utkast', 'bokförd', 'betald']).optional()
        .describe('Filter by status: utkast=draft, bokförd=booked, betald=paid'),
      from_date: z.string().optional().describe('Earliest date to include, format YYYY-MM-DD'),
      to_date: z.string().optional().describe('Latest date to include, format YYYY-MM-DD'),
    },
    async ({ status, from_date, to_date }) => {
      const txns = await fetchTransactions({ status, from_date, to_date })
      return { content: [{ type: 'text' as const, text: JSON.stringify(txns, null, 2) }] }
    },
  )

  // --- get_transaction -----------------------------------------------------
  server.tool(
    'get_transaction',
    'Get a single transaction by ID, including all accounting rows.',
    {
      id: z.string().uuid().describe('Transaction UUID'),
    },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, transaction_rader(*)')
        .eq('id', id)
        .single()
      if (error || !data) throw new Error(error?.message ?? 'Transaction not found')
      return { content: [{ type: 'text' as const, text: JSON.stringify(mapRow(data as RawTransaction), null, 2) }] }
    },
  )

  // --- create_transaction --------------------------------------------------
  server.tool(
    'create_transaction',
    `Create a new transaction with balanced accounting rows.
Transaction types: faktura_ut (outgoing invoice SE), kvitto_se (receipt SE 25% VAT),
kvitto_eu_saas (EU/SaaS service), kvitto_eu_vara (EU goods reverse charge), lön (payroll), manuell (manual).
Rows must balance: sum(debet) = sum(kredit).`,
    {
      datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date YYYY-MM-DD'),
      beskrivning: z.string().describe('Description / counterparty name'),
      typ: z.enum(['faktura_ut', 'kvitto_se', 'kvitto_eu_saas', 'kvitto_eu_vara', 'lön', 'manuell'])
        .describe('Transaction type'),
      status: z.enum(['utkast', 'bokförd', 'betald']).default('bokförd')
        .describe('Status — defaults to bokförd'),
      rader: z.array(z.object({
        konto: z.number().int().describe('BAS account number'),
        debet: z.number().min(0).describe('Debit amount (0 if credit side)'),
        kredit: z.number().min(0).describe('Credit amount (0 if debit side)'),
      })).min(2).describe('Accounting rows — must be balanced'),
    },
    async ({ datum, beskrivning, typ, status, rader }) => {
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
      return { content: [{ type: 'text' as const, text: `Created transaction ${id}` }] }
    },
  )

  // --- update_transaction_status -------------------------------------------
  server.tool(
    'update_transaction_status',
    'Change the status of an existing transaction (utkast → bokförd → betald).',
    {
      id: z.string().uuid().describe('Transaction UUID'),
      status: z.enum(['utkast', 'bokförd', 'betald']).describe('New status'),
    },
    async ({ id, status }) => {
      const { error } = await supabase.from('transactions').update({ status }).eq('id', id)
      if (error) throw new Error(error.message)
      return { content: [{ type: 'text' as const, text: `Transaction ${id} updated to ${status}` }] }
    },
  )

  // --- delete_transaction --------------------------------------------------
  server.tool(
    'delete_transaction',
    'Delete a transaction and all its accounting rows. Irreversible.',
    {
      id: z.string().uuid().describe('Transaction UUID'),
    },
    async ({ id }) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return { content: [{ type: 'text' as const, text: `Deleted transaction ${id}` }] }
    },
  )

  // --- get_ledger ----------------------------------------------------------
  server.tool(
    'get_ledger',
    'Get the running-balance ledger for a single BAS account. Returns each posting with a running saldo.',
    {
      account_id: z.number().int().describe('BAS account number, e.g. 1920 for Bankkonto'),
      from_date: z.string().optional().describe('Start date YYYY-MM-DD'),
      to_date: z.string().optional().describe('End date YYYY-MM-DD'),
    },
    async ({ account_id, from_date, to_date }) => {
      const txns = await fetchTransactions({ from_date, to_date })
      const account = BAS_ACCOUNTS.find((a) => a.id === account_id)
      const rows = buildLedger(account_id, txns)
      const result = {
        account: account ?? { id: account_id, namn: 'Unknown', typ: 'unknown' },
        rows,
        closing_balance: rows.at(-1)?.saldo ?? 0,
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    },
  )

  // --- get_vat_report ------------------------------------------------------
  server.tool(
    'get_vat_report',
    `Calculate the Swedish VAT report (momsdeklaration) for a date range.
Returns: utgåendeMoms (box 05, output VAT to pay), ingåendeMoms (box 48, input VAT to reclaim),
nettoMoms (box 49, positive = pay Skatteverket, negative = reclaim).`,
    {
      from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Start date YYYY-MM-DD'),
      to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('End date YYYY-MM-DD'),
    },
    async ({ from_date, to_date }) => {
      const txns = await fetchTransactions()
      const report = buildVatReport(from_date, to_date, txns)
      const result = {
        period: `${from_date} – ${to_date}`,
        'box_05_utgåendeMoms': report.utgåendeMoms,
        'box_48_ingåendeMoms': report.ingåendeMoms,
        'box_49_nettoMoms': report.nettoMoms,
        verdict: report.nettoMoms > 0
          ? `Pay ${report.nettoMoms.toFixed(2)} kr to Skatteverket`
          : report.nettoMoms < 0
            ? `Reclaim ${Math.abs(report.nettoMoms).toFixed(2)} kr from Skatteverket`
            : 'Net zero — nothing to pay or reclaim',
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    },
  )

  return server
}

// ---------------------------------------------------------------------------
// Express HTTP server
// ---------------------------------------------------------------------------

const app = express()
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, server: 'vantör-bokföring MCP', version: '1.0.0' })
})

// MCP endpoint — stateless: fresh server+transport per request
app.all('/mcp', async (req, res) => {
  const server = createServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } finally {
    res.on('finish', () => server.close().catch(() => {}))
  }
})

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`Vantör bokföring MCP server running on http://localhost:${PORT}`)
  console.log(`  MCP endpoint: http://localhost:${PORT}/mcp`)
  console.log(`  Health check: http://localhost:${PORT}/health`)
  console.log()
  console.log('Add to iOS Claude app → Settings → MCP Servers → + Add Server')
  console.log('(use ngrok or a deployment URL for remote access)')
})
