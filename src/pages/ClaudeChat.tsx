import { useEffect, useRef, useState } from 'react'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `Du är en expert på svensk bokföring för Vantör Digital AB som använder BAS-kontoplanen.
Du hjälper användaren att förstå bokföringsposter, skapa verifikationer, tolka regler och svara på frågor om moms, BAS-konton och redovisning.
Svara koncist och på svenska om inte användaren skriver på ett annat språk.
Du kan referera till specifika BAS-konton (t.ex. 1920 Bankkonto, 2610 Utgående moms 25%) när det är relevant.`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function ClaudeChat() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') ?? '')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function saveApiKey(key: string) {
    setApiKey(key)
    localStorage.setItem('anthropic_api_key', key)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    if (!apiKey.trim()) {
      setError('Ange din Anthropic API-nyckel ovan.')
      return
    }

    const userMsg: Message = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setError('')
    setStreaming(true)

    // Add empty assistant message to stream into
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
      const stream = client.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      })

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const textDelta = event.delta as { type: 'text_delta'; text: string }
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: updated[updated.length - 1].content + textDelta.text,
            }
            return updated
          })
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Okänt fel')
      // Remove the empty assistant message on error
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setStreaming(false)
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
    setError('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Claude – Bokföringsassistent</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Fråga om BAS-konton, moms, verifikationer och redovisningsregler</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
          >
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
          <p className="text-xs text-neutral-600 mt-1.5">Sparas lokalt i webbläsaren. Behövs för att prata med Claude.</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
            <div className="text-4xl opacity-20">◆</div>
            <p className="text-sm text-neutral-500 max-w-xs">
              Ställ en fråga om bokföring, moms eller BAS-kontoplanen så hjälper Claude dig.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                'Hur bokför jag ett EU SaaS-kvitto?',
                'Vad är skillnaden på konto 3001 och 3004?',
                'Förklara omvänd skattskyldighet',
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

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-sky-600 text-white rounded-br-sm'
                  : 'bg-neutral-800 text-neutral-100 rounded-bl-sm'
              }`}
            >
              {msg.content}
              {streaming && i === messages.length - 1 && msg.role === 'assistant' && msg.content === '' && (
                <span className="inline-block w-2 h-4 bg-neutral-400 opacity-70 animate-pulse rounded-sm" />
              )}
            </div>
          </div>
        ))}

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
            placeholder="Skriv en fråga… (Enter för att skicka, Shift+Enter för ny rad)"
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
            disabled={!input.trim() || streaming}
            className="pb-3 px-4 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors text-sm font-medium shrink-0"
          >
            {streaming ? '…' : '↑'}
          </button>
        </div>
        {apiKey && (
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-neutral-700">API-nyckel inladdad</span>
            <button
              onClick={() => saveApiKey('')}
              className="text-xs text-neutral-700 hover:text-neutral-500 transition-colors"
            >
              Ta bort
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
