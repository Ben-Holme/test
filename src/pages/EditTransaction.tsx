import { useState, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTransaction, useTransactions } from '../hooks/useTransactions'
import { JournalRows } from '../components/domain/TransactionForm/JournalRows'
import { StatusBadge, TypeBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { formatDate, formatSEK } from '../lib/formatters'
import { getInvoiceTotal } from '../data/bookingRules'
import { uploadBilaga, deleteBilaga, updateTransactionBilagor } from '../data/api'

export function EditTransaction() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const transaction = useTransaction(id!)
  const { markBokförd, markPaid, remove } = useTransactions()
  const [bilagor, setBilagor] = useState<string[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentBilagor = bilagor ?? transaction?.bilagor ?? []

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!transaction) return
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const urls = await Promise.all(files.map((f) => uploadBilaga(transaction.id, f)))
      const updated = [...currentBilagor, ...urls]
      await updateTransactionBilagor(transaction.id, updated)
      setBilagor(updated)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveBilaga(url: string) {
    if (!transaction) return
    await deleteBilaga(url)
    const updated = currentBilagor.filter((u) => u !== url)
    await updateTransactionBilagor(transaction.id, updated)
    setBilagor(updated)
  }

  if (!transaction) {
    return (
      <div className="px-8 py-8">
        <div className="text-neutral-400">Transaktion hittades inte.</div>
        <Link to="/transaktioner" className="text-sky-400 text-sm mt-2 inline-block">
          ← Tillbaka
        </Link>
      </div>
    )
  }

  function handleDelete() {
    remove(transaction!.id)
    navigate('/transaktioner')
  }

  const total = getInvoiceTotal(transaction.rader)

  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-2">
        <Link to="/transaktioner" className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
          ← Transaktioner
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-100 mb-2">
            {transaction.beskrivning}
          </h1>
          <div className="flex items-center gap-2">
            <StatusBadge status={transaction.status} />
            <TypeBadge typ={transaction.typ} />
            <span className="text-xs text-neutral-500">{formatDate(transaction.datum)}</span>
          </div>
        </div>
        {total > 0 && (
          <div className="text-right">
            <div className="text-xs text-neutral-500 mb-1">Belopp</div>
            <div className="text-xl font-bold font-mono text-neutral-100">
              {formatSEK(total)}
            </div>
          </div>
        )}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-4">
        <JournalRows rader={transaction.rader} readOnly />
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
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
        {currentBilagor.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {currentBilagor.map((url) => {
              const name = url.split('/').pop() ?? 'fil'
              const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name)
              return (
                <div key={url} className="relative group">
                  {isImage ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={name} className="h-20 w-20 object-cover rounded border border-neutral-700 hover:opacity-80 transition-opacity" />
                    </a>
                  ) : (
                    <a href={url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-2 rounded border border-neutral-700 text-xs text-neutral-300 hover:text-neutral-100"
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
        ) : (
          <div className="text-xs text-neutral-600">Inga bilagor</div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {transaction.status === 'utkast' && (
          <Button
            onClick={() => {
              markBokförd(transaction.id)
              navigate('/transaktioner')
            }}
          >
            Bokför
          </Button>
        )}
        {transaction.typ === 'faktura_ut' && transaction.status === 'bokförd' && (
          <Button
            onClick={() => {
              markPaid(transaction.id)
              navigate('/transaktioner')
            }}
          >
            Markera betald
          </Button>
        )}
        <Button variant="danger" onClick={handleDelete}>
          Ta bort
        </Button>
      </div>
    </div>
  )
}
