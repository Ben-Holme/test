import { useEffect, useRef, useState } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import { useQueryClient } from '@tanstack/react-query'
import { fetchTransactions, insertTransaction } from '../data/api'
import { BAS_ACCOUNTS } from '../data/basAccounts'
import type { Transaction, TransactionType, TransactionStatus, TransaktionsRad } from '../types'

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Du är en expert på svensk bokföring för Vantör Digital AB som använder BAS-kontoplanen.
Du hjälper användaren att skapa bokföringsposter, förstå verifikationer, tolka regler och svara på frågor om moms, BAS-konton och redovisning.

När användaren vill lägga till en bokföringspost, använd verktyget create_transaction.
Välj alltid rätt transaktionstyp och bygg korrekta verifikationsrader (debet = kredit).
Svara koncist och på svenska om inte användaren skriver på ett annat språk.

Tillgängliga transaktionstyper:
- faktura_ut: utgående faktura SE 25% moms (Dr 1510 / Kr 3001 + Kr 2610)
- kvitto_se: inköpskvitto Sverige 25% moms (Dr 5400 + Dr 2640 / Kr 1920)
- kvitto_eu_saas: EU/SaaS-tjänst t.ex. GitHub, Slack, AWS (Dr 6570 + Dr 2640 / Kr 1920 + Kr 4545)
- kvitto_eu_vara: EU-vara omvänd skattskyldighet
- lön: löneutbetalning (Dr 7010 / Kr 1920)
- manuell: övrigt`

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_accounts',
    description: 'List all available BAS chart-of-accounts entries.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_transactions',
    description: 'List recent transactions from the database, optionally filtered.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['utkast', 'bokförd', 'betald'], description: 'Filter by status' },
        from_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to_date: { type: 'string', description: 'End date YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'create_transaction',
    description: `Create a new balanced bookkeeping transaction. Rows must balance: sum(debet) = sum(kredit).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        datum: { type: 'string', description: 'Date YYYY-MM-DD' },
        beskrivning: { type: 'string', description: 'Description / counterparty' },
        typ: {
          type: 'string',
          enum: ['faktura_ut', 'kvitto_se', 'kvitto_eu_saas', 'kvitto_eu_vara', 'lön', 'manuell'],
        },
        status: { type: 'string', enum: ['bokförd', 'utkast'], description: 'Defaults to bokförd' },
        rader: {
          type: 'array',
          description: 'Accounting rows — must be balanced (sum debet = sum kredit)',
          items: {
            type: 'object',
            properties: {
              konto: { type: 'number', description: 'BAS account number' },
              debet: { type: 'number' },
              kredit: { type: 'number' },
            },
            required: ['konto', 'debet', 'kredit'],
          },
        },
      },
      required: ['datum', 'beskrivning', 'typ', 'rader'],
    },
  },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DisplayMsg = {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolName?: string
  toolStatus?: 'pending' | 'done' | 'error'
}

type ApiMsg =
  | { role: 'user'; content: string | Anthropic.ToolResultBlockParam[] }
  | { role: 'assistant'; content: string | Anthropic.ContentBlock[] }

// ---------------------------------------------------------------------------
// Tool labels for display
// ---------------------------------------------------------------------------

const TOOL_LABELS: Record<string, string> = {
  create_transaction: 'Skapar verifikation',
  list_transactions: 'Hämtar transaktioner',
  list_accounts: 'Hämtar konton',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClaudeChat() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') ?? '')
  const [messages, setMessages] = useState<DisplayMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const apiHistoryRef = useRef<ApiMsg[]>([])
  const queryClient = useQueryClient()

  function saveApiKey(key: string) {
    setApiKey(key)
    localStorage.setItem('anthropic_api_key', key)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // -------------------------------------------------------------------------
  // Tool execution — calls data/api.ts directly (Supabase, no MCP server needed)
  // -------------------------------------------------------------------------

  async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    if (name === 'list_accounts') {
      return JSON.stringify(BAS_ACCOUNTS, null, 2)
    }

    if (name === 'list_transactions') {
      const all = await fetchTransactions()
      let txns = all
      if (input.status) txns = txns.filter((t) => t.status === input.status)
      if (input.from_date) txns = txns.filter((t) => t.datum >= (input.from_date as string))
      if (input.to_date) txns = txns.filter((t) => t.datum <= (input.to_date as string))
      return JSON.stringify(txns, null, 2)
    }

    if (name === 'create_transaction') {
      const t = input as {
        datum: string
        beskrivning: string
        typ: TransactionType
        status?: TransactionStatus
        rader: TransaktionsRad[]
      }
      const created: Transaction = await insertTransaction({
        datum: t.datum,
        beskrivning: t.beskrivning,
        typ: t.typ,
        status: t.status ?? 'bokförd',
        rader: t.rader,
        bilagor: [],
      })
      // Refresh transaction list in the rest of the app
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      return `Verifikation skapad med ID ${created.id}`
    }

    throw new Error(`Okänt verktyg: ${name}`)
  }

  // -------------------------------------------------------------------------
  // Send — handles tool use loop
  // -------------------------------------------------------------------------

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    if (!apiKey.trim()) {
      setError('Ange din Anthropic API-nyckel ovan.')
      return
    }

    const userDisplay: DisplayMsg = { role: 'user', content: text }
    const userApi: ApiMsg = { role: 'user', content: text }

    setMessages((prev) => [...prev, userDisplay])
    apiHistoryRef.current = [...apiHistoryRef.current, userApi]
    setInput('')
    setError('')
    setLoading(true)

    // Placeholder assistant bubble
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

    try {
      let currentHistory = [...apiHistoryRef.current]

      // Tool-use loop
      while (true) {
        const response = await client.messages.create({
          model: 'claude-opus-4-6',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          messages: currentHistory,
        })

        if (response.stop_reason === 'end_turn') {
          const textBlock = response.content.find((b) => b.type === 'text')
          const replyText = textBlock?.type === 'text' ? textBlock.text : ''
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: replyText }
            return updated
          })
          apiHistoryRef.current = [
            ...currentHistory,
            { role: 'assistant', content: response.content },
          ]
          break
        }

        if (response.stop_reason === 'tool_use') {
          // Show any text Claude produced before calling the tool
          const textBlock = response.content.find((b) => b.type === 'text')
          if (textBlock?.type === 'text' && textBlock.text) {
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: textBlock.text }
              return updated
            })
          } else {
            // Remove empty placeholder
            setMessages((prev) => prev.slice(0, -1))
          }

          currentHistory = [...currentHistory, { role: 'assistant', content: response.content }]

          const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
          const toolResults: Anthropic.ToolResultBlockParam[] = []

          for (const block of toolUseBlocks) {
            // Show pending tool bubble
            setMessages((prev) => [
              ...prev,
              { role: 'tool', content: TOOL_LABELS[block.name] ?? block.name, toolName: block.name, toolStatus: 'pending' },
            ])

            try {
              const result = await executeTool(block.name, block.input as Record<string, unknown>)
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1 && m.toolStatus === 'pending'
                    ? { ...m, toolStatus: 'done' }
                    : m,
                ),
              )
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err)
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: errMsg, is_error: true })
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === prev.length - 1 && m.toolStatus === 'pending'
                    ? { ...m, toolStatus: 'error', content: `Fel: ${errMsg}` }
                    : m,
                ),
              )
            }
          }

          currentHistory = [...currentHistory, { role: 'user', content: toolResults }]
          // New assistant placeholder for the follow-up response
          setMessages((prev) => [...prev, { role: 'assistant', content: '' }])
          continue
        }

        // Unexpected stop reason
        break
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Okänt fel')
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        return last?.role === 'assistant' && last.content === '' ? prev.slice(0, -1) : prev
      })
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function clearChat() {
    setMessages([])
    apiHistoryRef.current = []
    setError('')
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Claude – Bokföringsassistent</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Skapa verifikationer och fråga om BAS-konton, moms och redovisningsregler
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">
            Rensa
          </button>
        )}
      </div>

      {/* API Key (shown when missing) */}
      {!apiKey && (
        <div className="flex-shrink-0 px-6 py-3 bg-amber-500/5 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <span className="text-xs text-amber-400 font-medium whitespace-nowrap">API-nyckel</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => saveApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-sky-500"
            />
          </div>
          <p className="text-xs text-neutral-600 mt-1.5">Sparas lokalt i webbläsaren.</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
            <div className="text-4xl opacity-20">◆</div>
            <p className="text-sm text-neutral-500 max-w-xs">
              Beskriv en transaktion så bokför Claude den åt dig, eller ställ en fråga om redovisning.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                'Bokför ett GitHub-abonnemang 99 kr idag',
                'Lägg till en utgående faktura på 10 000 kr',
                'Hur bokför jag ett EU SaaS-kvitto?',
                'Visa de senaste transaktionerna',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus() }}
                  className="text-xs px-3 py-1.5 rounded-full border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          // Tool activity bubble
          if (msg.role === 'tool') {
            return (
              <div key={i} className="flex justify-start">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border ${
                  msg.toolStatus === 'pending'
                    ? 'border-neutral-700 text-neutral-500 bg-neutral-900'
                    : msg.toolStatus === 'done'
                      ? 'border-emerald-800/50 text-emerald-500 bg-emerald-500/5'
                      : 'border-red-800/50 text-red-400 bg-red-500/5'
                }`}>
                  {msg.toolStatus === 'pending' && (
                    <span className="w-3 h-3 rounded-full border border-neutral-500 border-t-transparent animate-spin" />
                  )}
                  {msg.toolStatus === 'done' && <span className="text-emerald-500">✓</span>}
                  {msg.toolStatus === 'error' && <span>✗</span>}
                  <span>{msg.content}</span>
                </div>
              </div>
            )
          }

          return (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-sky-600 text-white rounded-br-sm'
                    : 'bg-neutral-800 text-neutral-100 rounded-bl-sm'
                }`}
              >
                {msg.content}
                {loading && i === messages.length - 1 && msg.role === 'assistant' && msg.content === '' && (
                  <span className="inline-flex gap-0.5">
                    {[0, 1, 2].map((j) => (
                      <span
                        key={j}
                        className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce"
                        style={{ animationDelay: `${j * 150}ms` }}
                      />
                    ))}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-neutral-800">
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Beskriv en transaktion eller ställ en fråga… (Enter för att skicka)"
            rows={1}
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-sky-500 resize-none leading-relaxed"
            style={{ maxHeight: '160px', overflowY: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 160) + 'px'
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="px-4 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors text-sm font-medium shrink-0"
          >
            {loading ? '…' : '↑'}
          </button>
        </div>
        {apiKey && (
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-neutral-700">API-nyckel inladdad</span>
            <button onClick={() => saveApiKey('')} className="text-xs text-neutral-700 hover:text-neutral-500 transition-colors">
              Ta bort
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
