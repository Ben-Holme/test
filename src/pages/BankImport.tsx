import { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeStatement, toTransaction, type ParsedTransaction } from '../data/claudeImport'
import { insertTransaction } from '../data/api'
import { useQueryClient } from '@tanstack/react-query'

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const TYPE_LABELS: Record<string, string> = {
  faktura_ut: 'Faktura ut',
  kvitto_se: 'Kvitto SE',
  kvitto_eu_saas: 'EU SaaS',
  kvitto_eu_vara: 'EU Vara',
  lön: 'Lön',
  manuell: 'Manuell',
}

export function BankImport() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') ?? '')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMediaType, setImageMediaType] = useState<MediaType>('image/png')
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([])
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'done' | 'importing' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  function saveApiKey(key: string) {
    setApiKey(key)
    localStorage.setItem('anthropic_api_key', key)
  }

  function loadFile(file: File) {
    const allowed: MediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type as MediaType)) {
      setErrorMsg('Filformat stöds inte. Ladda upp JPEG, PNG, WebP eller GIF.')
      return
    }
    setImageMediaType(file.type as MediaType)
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setImagePreview(dataUrl)
      // Strip the data URL prefix to get raw base64
      setImageBase64(dataUrl.split(',')[1])
    }
    reader.readAsDataURL(file)
    setTransactions([])
    setStatus('idle')
    setErrorMsg('')
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) loadFile(file)
  }, [])

  async function analyze() {
    if (!imageBase64) return
    if (!apiKey.trim()) {
      setErrorMsg('Ange din Anthropic API-nyckel ovan.')
      return
    }
    setStatus('analyzing')
    setErrorMsg('')
    try {
      const result = await analyzeStatement(imageBase64, imageMediaType, apiKey)
      setTransactions(result)
      setStatus('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Okänt fel')
      setStatus('error')
    }
  }

  function toggle(id: string) {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    )
  }

  async function importSelected() {
    const toImport = transactions.filter((t) => t.selected)
    if (toImport.length === 0) return
    setStatus('importing')
    try {
      for (const t of toImport) {
        await insertTransaction(toTransaction(t))
      }
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      navigate('/transaktioner')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Okänt fel vid import')
      setStatus('error')
    }
  }

  const selectedCount = transactions.filter((t) => t.selected).length

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-100">Importera bankutdrag</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Ladda upp en skärmbild av ditt kontoutdrag – Claude tolkar och bokför transaktionerna.
        </p>
      </div>

      {/* API Key */}
      <div className="space-y-1">
        <label className="text-xs text-neutral-400 font-medium uppercase tracking-wide">
          Anthropic API-nyckel
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => saveApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-sky-500"
        />
        <p className="text-xs text-neutral-600">Sparas lokalt i webbläsaren.</p>
      </div>

      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg transition-colors ${
          isDragging
            ? 'border-sky-500 bg-sky-500/5'
            : 'border-neutral-700 hover:border-neutral-500'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onFileChange}
        />

        {imagePreview ? (
          <div className="p-4">
            <img
              src={imagePreview}
              alt="Förhandsvisning"
              className="max-h-80 mx-auto rounded object-contain"
            />
            <p className="text-xs text-neutral-500 text-center mt-2">
              Klicka för att byta bild
            </p>
          </div>
        ) : (
          <div className="py-16 text-center cursor-pointer">
            <div className="text-4xl mb-3 opacity-30">⬆</div>
            <p className="text-sm text-neutral-400">
              Dra och släpp eller klicka för att välja bild
            </p>
            <p className="text-xs text-neutral-600 mt-1">PNG, JPEG, WebP, GIF</p>
          </div>
        )}
      </div>

      {/* Analyze button */}
      {imageBase64 && status !== 'done' && (
        <button
          onClick={analyze}
          disabled={status === 'analyzing'}
          className="w-full py-2.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-sm font-medium text-white transition-colors"
        >
          {status === 'analyzing' ? 'Analyserar med Claude…' : 'Analysera med Claude'}
        </button>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 rounded px-4 py-3 text-sm text-red-400">
          {errorMsg}
        </div>
      )}

      {/* Results */}
      {transactions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
              Hittade {transactions.length} transaktioner
            </h2>
            <span className="text-xs text-neutral-500">{selectedCount} markerade</span>
          </div>

          <div className="space-y-2">
            {transactions.map((t) => (
              <label
                key={t.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  t.selected
                    ? 'border-sky-600/40 bg-sky-600/5'
                    : 'border-neutral-800 bg-neutral-900 opacity-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={t.selected}
                  onChange={() => toggle(t.id)}
                  className="mt-0.5 accent-sky-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-neutral-100 font-medium truncate">
                      {t.beskrivning}
                    </span>
                    <span className="text-sm text-neutral-300 font-mono shrink-0">
                      {t.belopp.toLocaleString('sv-SE', { minimumFractionDigits: 2 })} kr
                    </span>
                  </div>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-xs text-neutral-500">{t.datum}</span>
                    <span className="text-xs text-sky-500/80 bg-sky-500/10 px-1.5 rounded">
                      {TYPE_LABELS[t.typ] ?? t.typ}
                    </span>
                  </div>
                  {/* Journal rows summary */}
                  <div className="mt-1.5 grid grid-cols-3 gap-x-2 text-xs text-neutral-600 font-mono">
                    {t.rader.map((r, i) => (
                      <div key={i} className="contents">
                        <span>{r.konto}</span>
                        <span>{r.debet > 0 ? `D ${r.debet.toFixed(2)}` : ''}</span>
                        <span>{r.kredit > 0 ? `K ${r.kredit.toFixed(2)}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={importSelected}
              disabled={selectedCount === 0 || status === 'importing'}
              className="flex-1 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm font-medium text-white transition-colors"
            >
              {status === 'importing'
                ? 'Importerar…'
                : `Importera ${selectedCount} transaktion${selectedCount !== 1 ? 'er' : ''}`}
            </button>
            <button
              onClick={analyze}
              className="px-4 py-2.5 rounded border border-neutral-700 text-sm text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors"
            >
              Analysera igen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
