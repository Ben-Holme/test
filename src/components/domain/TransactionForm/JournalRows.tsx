import type { TransaktionsRad } from '../../../types'
import { useAccounts } from '../../../hooks/useAccounts'
import { formatSEK } from '../../../lib/formatters'

interface JournalRowsProps {
  rader: TransaktionsRad[]
  onChange?: (rader: TransaktionsRad[]) => void
  readOnly?: boolean
}

export function JournalRows({ rader, onChange, readOnly = false }: JournalRowsProps) {
  const accounts = useAccounts()

  function accountName(id: number) {
    const acc = accounts.find((a) => a.id === id)
    return acc ? `${id} ${acc.namn}` : `${id}`
  }

  function updateRow(index: number, field: 'debet' | 'kredit', raw: string) {
    if (!onChange) return
    const val = parseFloat(raw) || 0
    const updated = rader.map((r, i) =>
      i === index ? { ...r, [field]: val } : r
    )
    onChange(updated)
  }

  function addRow() {
    if (!onChange) return
    onChange([...rader, { konto: 1920, debet: 0, kredit: 0 }])
  }

  function removeRow(index: number) {
    if (!onChange) return
    onChange(rader.filter((_, i) => i !== index))
  }

  function updateKonto(index: number, raw: string) {
    if (!onChange) return
    const konto = parseInt(raw) || 0
    const updated = rader.map((r, i) => (i === index ? { ...r, konto } : r))
    onChange(updated)
  }

  const totalDebet = rader.reduce((s, r) => s + r.debet, 0)
  const totalKredit = rader.reduce((s, r) => s + r.kredit, 0)
  const balanced = Math.abs(totalDebet - totalKredit) < 0.005

  if (readOnly && rader.length === 0) return null

  return (
    <div className="mt-4">
      <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
        Konteringsrader
      </div>
      <div className="rounded-lg border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-800/50 text-neutral-400 text-xs">
              <th className="text-left px-3 py-2">Konto</th>
              <th className="text-right px-3 py-2">Debet</th>
              <th className="text-right px-3 py-2">Kredit</th>
              {!readOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {rader.map((r, i) => (
              <tr key={i} className="bg-neutral-900/50">
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span className="font-mono text-neutral-300">{accountName(r.konto)}</span>
                  ) : (
                    <input
                      type="number"
                      value={r.konto || ''}
                      onChange={(e) => updateKonto(i, e.target.value)}
                      className="w-full bg-transparent font-mono text-neutral-200 focus:outline-none"
                      placeholder="Kontonr"
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {readOnly ? (
                    <span className={`font-mono ${r.debet > 0 ? 'text-neutral-100' : 'text-neutral-600'}`}>
                      {r.debet > 0 ? formatSEK(r.debet) : '—'}
                    </span>
                  ) : (
                    <input
                      type="number"
                      value={r.debet || ''}
                      onChange={(e) => updateRow(i, 'debet', e.target.value)}
                      className="w-full bg-transparent font-mono text-right text-neutral-200 focus:outline-none"
                      placeholder="0"
                      min="0"
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {readOnly ? (
                    <span className={`font-mono ${r.kredit > 0 ? 'text-neutral-100' : 'text-neutral-600'}`}>
                      {r.kredit > 0 ? formatSEK(r.kredit) : '—'}
                    </span>
                  ) : (
                    <input
                      type="number"
                      value={r.kredit || ''}
                      onChange={(e) => updateRow(i, 'kredit', e.target.value)}
                      className="w-full bg-transparent font-mono text-right text-neutral-200 focus:outline-none"
                      placeholder="0"
                      min="0"
                    />
                  )}
                </td>
                {!readOnly && (
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-neutral-600 hover:text-red-400 transition-colors text-xs"
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-neutral-800/30 text-xs font-medium">
              <td className="px-3 py-2 text-neutral-400">Summa</td>
              <td className="px-3 py-2 text-right font-mono text-neutral-200">
                {formatSEK(totalDebet)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-neutral-200">
                {formatSEK(totalKredit)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {!readOnly && (
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={addRow}
            className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
          >
            + Lägg till rad
          </button>
          {!balanced && rader.length > 0 && (
            <span className="text-xs text-red-400">
              Obalanserad: {formatSEK(Math.abs(totalDebet - totalKredit))}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
