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
  { id: 1920, namn: 'Plusgiro', typ: 'tillgång' },
  { id: 1930, namn: 'Bankkonto', typ: 'tillgång' },
  { id: 2610, namn: 'Utgående moms 25%', typ: 'skuld' },
  { id: 2614, namn: 'Utgående moms omvänd skattskyldighet 25%', typ: 'skuld' },
  { id: 2640, namn: 'Ingående moms', typ: 'tillgång' },
  { id: 2645, namn: 'Beräknad ingående moms på förvärv från utlandet', typ: 'tillgång' },
  { id: 2650, namn: 'Momsredovisning', typ: 'skuld' },
  { id: 3001, namn: 'Försäljning tjänster SE 25%', typ: 'intäkt' },
  { id: 3004, namn: 'Försäljning tjänster EU (omvänd)', typ: 'intäkt' },
  { id: 3006, namn: 'Försäljning tjänster export', typ: 'intäkt' },
  { id: 4000, namn: 'Inköp varor/tjänster SE', typ: 'kostnad' },
  { id: 4545, namn: 'Förvärvsmoms utländska tjänster', typ: 'kostnad' },
  { id: 5400, namn: 'Förbrukningsinventarier', typ: 'kostnad' },
  { id: 6570, namn: 'Licenser & SaaS', typ: 'kostnad' },
  { id: 6592, namn: 'Bankavgifter', typ: 'kostnad' },
  { id: 6810, namn: 'Registreringsavgifter', typ: 'kostnad' },
  { id: 7010, namn: 'Löner', typ: 'kostnad' },
  { id: 1630, namn: 'Skattekonto (Skatteverket)', typ: 'tillgång' },
  { id: 1830, namn: 'Andelar i andra företag', typ: 'tillgång' },
  { id: 2081, namn: 'Aktiekapital', typ: 'eget_kapital' },
  { id: 2091, namn: 'Balanserat resultat', typ: 'eget_kapital' },
  { id: 2099, namn: 'Årets resultat', typ: 'eget_kapital' },
  { id: 2510, namn: 'Skatteskulder', typ: 'skuld' },
  { id: 2518, namn: 'Betald preliminärskatt', typ: 'tillgång' },
  { id: 2710, namn: 'Personalskatt', typ: 'skuld' },
  { id: 2730, namn: 'Arbetsgivaravgifter', typ: 'skuld' },
]

// ---------------------------------------------------------------------------
// Attachment validation — type is detected from the file's own magic bytes,
// never trusted from a Content-Type header or a caller-supplied hint, so a
// mislabeled or malicious upload can't slip into the bucket.
// ---------------------------------------------------------------------------

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10 MB

function sniffAttachmentType(bytes: Uint8Array): { ext: string; mime: string } | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { ext: 'pdf', mime: 'application/pdf' } // %PDF
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' }
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' }
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { ext: 'gif', mime: 'image/gif' } // GIF8
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { ext: 'webp', mime: 'image/webp' } // RIFF....WEBP
  }
  return null
}

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
        bilagor: {
          type: 'array',
          description: 'Optional list of attachment URLs (uploaded via the web app)',
          items: { type: 'string' },
        },
      },
      required: ['datum', 'beskrivning', 'typ', 'rader'],
    },
  },
  {
    name: 'update_transaction',
    description: `Edit the description and/or journal rows of an existing DRAFT (utkast) transaction in place — no delete+recreate needed.
Only works when the transaction's status is utkast; bokförd/betald transactions must go through update_transaction_status or delete_transaction instead.
Omit \`beskrivning\` or \`rader\` to leave that field unchanged. If \`rader\` is given it replaces all rows and must balance: sum(debet) = sum(kredit).`,
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Transaction UUID' },
        beskrivning: { type: 'string', description: 'New description (optional)' },
        rader: {
          type: 'array',
          description: 'Replacement journal rows — must balance (optional)',
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
      required: ['id'],
    },
  },
  {
    name: 'upload_attachment',
    description: `Upload a receipt/invoice attachment (PDF or image) and link it to an existing transaction.
Provide exactly one of:
  - \`source_url\`: the server fetches it directly — the robust path, works with e.g. Stripe receipt links.
  - \`file_base64\`: base64-encoded file data (a data: URI prefix is stripped automatically) — fallback for files attached directly in chat. Slower and less reliable for large files.
File type is detected from the actual file content (not any provided hint) and restricted to PDF, PNG, JPEG, GIF or WEBP. Max size ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`,
    inputSchema: {
      type: 'object',
      properties: {
        transaction_id: { type: 'string', description: 'Transaction UUID to attach the file to' },
        source_url: { type: 'string', description: 'URL the server should fetch the file from' },
        file_base64: { type: 'string', description: 'Base64-encoded file data (fallback for chat attachments)' },
      },
      required: ['transaction_id'],
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
  // Reverse-charge VAT on foreign acquisitions. 4545 is the legacy account used
  // before 2614/2645 existed — kept so old transactions still count correctly.
  const omvändUtgående = relevant.flatMap((t) => t.rader).filter((r) => r.konto === 2614 || r.konto === 4545).reduce((s, r) => s + r.kredit, 0)
  const omvändIngående = relevant.flatMap((t) => t.rader).filter((r) => r.konto === 2645).reduce((s, r) => s + r.debet, 0)
  return {
    utgåendeMoms: utgående + omvändUtgående,
    ingåendeMoms: ingående + omvändIngående,
    nettoMoms: utgående + omvändUtgående - ingående - omvändIngående,
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
    let { datum, beskrivning, typ, status = 'bokförd', rader, bilagor = [] } = args as {
      datum: string
      beskrivning: string
      typ: TransactionType
      status?: TransactionStatus
      rader: TransaktionsRad[] | string
      bilagor?: string[] | string
    }

    // Some MCP clients serialize array/object params as JSON strings instead
    // of native arrays — parse defensively rather than crashing on `.map`.
    if (typeof rader === 'string') {
      try {
        rader = JSON.parse(rader)
      } catch {
        throw new Error('Invalid `rader`: expected an array of journal rows, got a string that is not valid JSON')
      }
    }
    if (typeof bilagor === 'string') {
      try {
        bilagor = JSON.parse(bilagor)
      } catch {
        throw new Error('Invalid `bilagor`: expected an array of URLs, got a string that is not valid JSON')
      }
    }

    if (!Array.isArray(rader)) throw new Error('`rader` must be an array of journal rows')
    if (!Array.isArray(bilagor)) throw new Error('`bilagor` must be an array of attachment URLs')

    // Validate before writing anything.
    if (rader.length === 0) throw new Error('`rader` cannot be empty — at least one journal row is required')

    rader.forEach((r, i) => {
      if (r == null || typeof r !== 'object') throw new Error(`rader[${i}] is not a valid row object`)
      if (r.konto === undefined || r.konto === null) throw new Error(`rader[${i}] is missing \`konto\``)
      if (r.debet === undefined || r.debet === null) throw new Error(`rader[${i}] is missing \`debet\``)
      if (r.kredit === undefined || r.kredit === null) throw new Error(`rader[${i}] is missing \`kredit\``)
    })

    const sumDebet = rader.reduce((s, r) => s + Number(r.debet), 0)
    const sumKredit = rader.reduce((s, r) => s + Number(r.kredit), 0)
    if (Math.round(sumDebet * 100) !== Math.round(sumKredit * 100)) {
      throw new Error(
        `Rader are not balanced: sum(debet)=${sumDebet.toFixed(2)} !== sum(kredit)=${sumKredit.toFixed(2)}`,
      )
    }

    // Header + rows are inserted atomically in a single Postgres function —
    // if the rows insert fails, the header insert is rolled back too, so we
    // never leave an orphaned transaction with zero rows.
    const { data: id, error } = await supabase.rpc('create_transaction_with_rows', {
      p_datum: datum,
      p_beskrivning: beskrivning,
      p_typ: typ,
      p_status: status,
      p_bilagor: bilagor,
      p_rader: rader,
    })

    if (error) throw new Error(error.message)
    return `Verifikation skapad: ${id}`
  }

  if (name === 'update_transaction') {
    let { id, beskrivning, rader } = args as {
      id: string
      beskrivning?: string
      rader?: TransaktionsRad[] | string
    }

    if (!id) throw new Error('`id` is required')

    if (typeof rader === 'string') {
      try {
        rader = JSON.parse(rader)
      } catch {
        throw new Error('Invalid `rader`: expected an array of journal rows, got a string that is not valid JSON')
      }
    }

    if (rader !== undefined) {
      if (!Array.isArray(rader)) throw new Error('`rader` must be an array of journal rows')
      if (rader.length === 0) throw new Error('`rader` cannot be empty')

      rader.forEach((r, i) => {
        if (r == null || typeof r !== 'object') throw new Error(`rader[${i}] is not a valid row object`)
        if (r.konto === undefined || r.konto === null) throw new Error(`rader[${i}] is missing \`konto\``)
        if (r.debet === undefined || r.debet === null) throw new Error(`rader[${i}] is missing \`debet\``)
        if (r.kredit === undefined || r.kredit === null) throw new Error(`rader[${i}] is missing \`kredit\``)
      })

      const sumDebet = rader.reduce((s, r) => s + Number(r.debet), 0)
      const sumKredit = rader.reduce((s, r) => s + Number(r.kredit), 0)
      if (Math.round(sumDebet * 100) !== Math.round(sumKredit * 100)) {
        throw new Error(
          `Rader are not balanced: sum(debet)=${sumDebet.toFixed(2)} !== sum(kredit)=${sumKredit.toFixed(2)}`,
        )
      }
    }

    if (beskrivning === undefined && rader === undefined) {
      throw new Error('Provide at least one of `beskrivning` or `rader` to update')
    }

    const { error } = await supabase.rpc('update_transaction_with_rows', {
      p_id: id,
      p_beskrivning: beskrivning ?? null,
      p_rader: rader ?? null,
    })
    if (error) throw new Error(error.message)
    return `Verifikation ${id} uppdaterad`
  }

  if (name === 'upload_attachment') {
    const { transaction_id, source_url, file_base64 } = args as {
      transaction_id: string
      source_url?: string
      file_base64?: string
    }

    if (!transaction_id) throw new Error('`transaction_id` is required')
    if (!source_url && !file_base64) throw new Error('Provide either `source_url` or `file_base64`')
    if (source_url && file_base64) throw new Error('Provide only one of `source_url` or `file_base64`, not both')

    const { data: txRow, error: txError } = await supabase
      .from('transactions')
      .select('id, bilagor')
      .eq('id', transaction_id)
      .single()
    if (txError || !txRow) throw new Error(txError?.message ?? `Transaction ${transaction_id} not found`)

    let bytes: Uint8Array

    if (source_url) {
      let res: Response
      try {
        res = await fetch(source_url)
      } catch (e) {
        throw new Error(`Could not fetch source_url: ${e instanceof Error ? e.message : String(e)}`)
      }
      if (!res.ok) throw new Error(`source_url returned ${res.status} ${res.statusText}`)
      const contentLength = res.headers.get('content-length')
      if (contentLength && Number(contentLength) > MAX_ATTACHMENT_BYTES) {
        throw new Error(`File too large: ${contentLength} bytes (max ${MAX_ATTACHMENT_BYTES})`)
      }
      bytes = new Uint8Array(await res.arrayBuffer())
    } else {
      const base64 = file_base64!.replace(/^data:[^;]+;base64,/, '')
      try {
        bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      } catch {
        throw new Error('`file_base64` is not valid base64 data')
      }
    }

    if (bytes.byteLength === 0) throw new Error('File is empty')
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new Error(`File too large: ${bytes.byteLength} bytes (max ${MAX_ATTACHMENT_BYTES})`)
    }

    const detected = sniffAttachmentType(bytes)
    if (!detected) {
      throw new Error('Unsupported file type — only PDF and images (PNG/JPEG/GIF/WEBP) are allowed')
    }

    const path = `${transaction_id}/${Date.now()}.${detected.ext}`
    const { error: uploadError } = await supabase.storage
      .from('bilagor')
      .upload(path, bytes, { contentType: detected.mime })
    if (uploadError) throw new Error(uploadError.message)

    const { data: publicUrlData } = supabase.storage.from('bilagor').getPublicUrl(path)
    const url = publicUrlData.publicUrl

    const existingBilagor = (txRow as { bilagor: string[] }).bilagor ?? []
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ bilagor: [...existingBilagor, url] })
      .eq('id', transaction_id)
    if (updateError) throw new Error(updateError.message)

    return `Bilaga uppladdad och kopplad till ${transaction_id}: ${url}`
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

  // Protected Resource Metadata (RFC 9728) — tells clients where our auth server is
  if (path.endsWith('/.well-known/oauth-protected-resource')) {
    return new Response(JSON.stringify({
      resource: BASE,
      authorization_servers: [BASE],
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
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
