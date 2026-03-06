import { useState, useRef } from 'react'
import type { Transaction, TransactionType } from '../../../types'
import { useTransactionForm } from './useTransactionForm'
import { JournalRows } from './JournalRows'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Select } from '../../ui/Select'
import { v4 as uuidv4 } from 'uuid'
import { uploadBilaga, deleteBilaga } from '../../../data/api'

const typeOptions = [
  { value: 'faktura_ut', label: 'Faktura ut' },
  { value: 'kvitto_se', label: 'Kvitto (Sverige)' },
  { value: 'kvitto_eu_saas', label: 'SaaS utland (EU/USA)' },
  { value: 'kvitto_eu_vara', label: 'Kvitto EU-vara' },
  { value: 'manuell', label: 'Manuell kontering' },
]

const invoiceSubtypeOptions = [
  { value: 'se', label: 'Sverige (25% moms)' },
  { value: 'eu', label: 'EU-företag (omvänd skattskyldighet)' },
  { value: 'export', label: 'Export (utanför EU)' },
]

interface TransactionFormProps {
  initial?: Partial<Transaction>
  onSave: (t: Transaction) => void
  onCancel: () => void
}

export function TransactionForm({ initial, onSave, onCancel }: TransactionFormProps) {
  const [transactionId] = useState(() => initial?.id ?? uuidv4())
  const [bilagor, setBilagor] = useState<string[]>(initial?.bilagor ?? [])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    values,
    invoiceSubtype,
    setInvoiceSubtype,
    setField,
    setRader,
    isAutoBooked,
    isBalanced,
  } = useTransactionForm(
    initial
      ? {
          datum: initial.datum,
          beskrivning: initial.beskrivning,
          typ: initial.typ,
          status: initial.status,
          rader: initial.rader,
          belopp: '',
        }
      : undefined
  )

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const urls = await Promise.all(files.map((f) => uploadBilaga(transactionId, f)))
      setBilagor((prev) => [...prev, ...urls])
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveBilaga(url: string) {
    await deleteBilaga(url)
    setBilagor((prev) => prev.filter((u) => u !== url))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isBalanced && values.rader.length > 0) return

    const t: Transaction = {
      id: transactionId,
      datum: values.datum,
      beskrivning: values.beskrivning,
      typ: values.typ,
      status: values.status,
      rader: values.rader,
      bilagor,
    }
    onSave(t)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Typ"
          value={values.typ}
          onChange={(e) => setField('typ', e.target.value as TransactionType)}
          options={typeOptions}
        />
        <Input
          label="Datum"
          type="date"
          value={values.datum}
          onChange={(e) => setField('datum', e.target.value)}
          required
        />
      </div>

      {values.typ === 'faktura_ut' && (
        <Select
          label="Mottagare"
          value={invoiceSubtype}
          onChange={(e) => setInvoiceSubtype(e.target.value as 'se' | 'eu' | 'export')}
          options={invoiceSubtypeOptions}
        />
      )}

      <Input
        label="Beskrivning"
        type="text"
        value={values.beskrivning}
        onChange={(e) => setField('beskrivning', e.target.value)}
        placeholder="t.ex. Konsulttjänster mars, Faktura #001"
        required
      />

      {isAutoBooked && (
        <Input
          label="Belopp (exkl. moms) SEK"
          type="number"
          value={values.belopp}
          onChange={(e) => setField('belopp', e.target.value)}
          placeholder="0.00"
          min="0"
          step="0.01"
        />
      )}

      <JournalRows
        rader={values.rader}
        onChange={isAutoBooked ? undefined : setRader}
        readOnly={isAutoBooked}
      />

      {values.typ === 'manuell' && (
        <JournalRows
          rader={values.rader}
          onChange={setRader}
          readOnly={false}
        />
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-400">Bilagor</span>
          <button
            type="button"
            className="text-xs text-sky-400 hover:text-sky-300 disabled:opacity-50"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Laddar upp…' : '+ Lägg till'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        {bilagor.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {bilagor.map((url) => {
              const name = url.split('/').pop() ?? 'fil'
              const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name)
              return (
                <div key={url} className="relative group">
                  {isImage ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={name} className="h-16 w-16 object-cover rounded border border-neutral-700" />
                    </a>
                  ) : (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded border border-neutral-700 text-xs text-neutral-300 hover:text-neutral-100"
                    >
                      📄 {name}
                    </a>
                  )}
                  <button
                    type="button"
                    className="absolute -top-1 -right-1 bg-neutral-900 text-neutral-400 hover:text-red-400 rounded-full w-4 h-4 text-xs hidden group-hover:flex items-center justify-center"
                    onClick={() => handleRemoveBilaga(url)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Avbryt
        </Button>
        <Button
          type="submit"
          disabled={values.rader.length === 0 || (!isBalanced && values.typ === 'manuell')}
        >
          Spara transaktion
        </Button>
      </div>
    </form>
  )
}
