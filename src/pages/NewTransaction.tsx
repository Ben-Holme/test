import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Transaction } from '../types'
import { useTransactions } from '../hooks/useTransactions'
import { TransactionForm } from '../components/domain/TransactionForm'
import { uploadBilaga, updateBilagor } from '../data/api'

export function NewTransaction() {
  const navigate = useNavigate()
  const { add } = useTransactions()
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSave({ id: _id, ...rest }: Transaction) {
    const created = await add(rest)
    if (pendingFiles.length > 0) {
      setUploading(true)
      try {
        const paths: string[] = []
        for (const file of pendingFiles) {
          const path = await uploadBilaga(created.id, file)
          paths.push(path)
        }
        await updateBilagor(created.id, paths)
      } finally {
        setUploading(false)
      }
    }
    navigate('/transaktioner')
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setPendingFiles((prev) => [...prev, ...files])
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-100">Ny transaktion</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Välj typ för automatisk kontering, eller välj Manuell.
        </p>
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-4">
        <TransactionForm onSave={handleSave} onCancel={() => navigate('/transaktioner')} />
      </div>

      {/* File staging — files are uploaded right after the transaction is created */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Underlag</h3>

        {pendingFiles.length > 0 && (
          <ul className="mb-4 divide-y divide-neutral-800">
            {pendingFiles.map((file, i) => (
              <li key={`${file.name}-${i}`} className="flex items-center gap-3 py-2.5">
                <span className="text-base leading-none">
                  {file.type.startsWith('image/') ? '🖼' : '📄'}
                </span>
                <span className="flex-1 text-sm text-neutral-300 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-xs text-neutral-600 hover:text-red-400 transition-colors px-1"
                  title="Ta bort"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {pendingFiles.length === 0 && (
          <p className="text-sm text-neutral-600 mb-4">
            Valfritt — bifoga kvitto eller faktura.
          </p>
        )}

        <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            className="sr-only"
            onChange={handleFileInput}
            disabled={uploading}
          />
          <span className="text-base leading-none">📎</span>
          <span>{uploading ? 'Laddar upp…' : 'Bifoga underlag'}</span>
        </label>
      </div>
    </div>
  )
}
