import { useState, useEffect, useRef } from 'react'
import { useTransactions } from '../../hooks/useTransactions'
import { getBilagaUrl } from '../../data/api'
import type { Transaction } from '../../types'

function fileIcon(path: string) {
  const ext = path.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext ?? '')) return '🖼'
  if (ext === 'pdf') return '📄'
  return '📎'
}

function basename(path: string) {
  return path.split('/').pop() ?? path
}

interface Props {
  transaction: Transaction
}

export function BilagorSection({ transaction }: Props) {
  const { attachFile, detachFile, isAttaching } = useTransactions()
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [urlErrors, setUrlErrors] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch signed URLs for all attachments
  useEffect(() => {
    for (const path of transaction.bilagor) {
      if (urls[path] || urlErrors.has(path)) continue
      getBilagaUrl(path)
        .then((url) => setUrls((prev) => ({ ...prev, [path]: url })))
        .catch(() => setUrlErrors((prev) => new Set([...prev, path])))
    }
  }, [transaction.bilagor]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    for (const file of Array.from(files)) {
      await attachFile({ transactionId: transaction.id, file })
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-4">
      <h3 className="text-sm font-medium text-neutral-400 mb-3">Underlag</h3>

      {transaction.bilagor.length === 0 ? (
        <p className="text-sm text-neutral-600 mb-4">Inga bifogade underlag.</p>
      ) : (
        <ul className="mb-4 divide-y divide-neutral-800">
          {transaction.bilagor.map((path) => (
            <li key={path} className="flex items-center gap-3 py-2.5">
              <span className="text-base leading-none">{fileIcon(path)}</span>
              {urls[path] ? (
                <a
                  href={urls[path]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm text-sky-400 hover:text-sky-300 truncate transition-colors"
                >
                  {basename(path)}
                </a>
              ) : (
                <span className="flex-1 text-sm text-neutral-400 truncate">
                  {urlErrors.has(path) ? (
                    <span className="text-red-400">{basename(path)} (ej åtkomlig)</span>
                  ) : (
                    basename(path)
                  )}
                </span>
              )}
              <button
                onClick={() => detachFile({ transactionId: transaction.id, path })}
                className="text-xs text-neutral-600 hover:text-red-400 transition-colors px-1"
                title="Ta bort bilaga"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={isAttaching}
        />
        <span className="text-base leading-none">📎</span>
        <span>{isAttaching ? 'Laddar upp…' : 'Bifoga underlag'}</span>
      </label>
    </div>
  )
}
