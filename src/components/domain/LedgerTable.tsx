import type { Transaction } from '../../types'
import { buildLedger } from '../../lib/ledger'
import { formatDate, formatSEK } from '../../lib/formatters'

interface LedgerTableProps {
  accountId: number
  transactions: Transaction[]
}

export function LedgerTable({ accountId, transactions }: LedgerTableProps) {
  const rows = buildLedger(accountId, transactions)

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-500 text-sm">
        Inga bokförda poster på detta konto
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-neutral-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-800/50 text-neutral-400 text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Datum</th>
            <th className="text-left px-4 py-3">Beskrivning</th>
            <th className="text-right px-4 py-3">Debet</th>
            <th className="text-right px-4 py-3">Kredit</th>
            <th className="text-right px-4 py-3">Saldo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-neutral-800/20 transition-colors">
              <td className="px-4 py-3 text-neutral-400 whitespace-nowrap font-mono text-xs">
                {formatDate(row.datum)}
              </td>
              <td className="px-4 py-3 text-neutral-300 max-w-xs truncate">
                {row.beskrivning}
              </td>
              <td className="px-4 py-3 text-right font-mono text-neutral-200">
                {row.debet > 0 ? formatSEK(row.debet) : ''}
              </td>
              <td className="px-4 py-3 text-right font-mono text-neutral-200">
                {row.kredit > 0 ? formatSEK(row.kredit) : ''}
              </td>
              <td
                className={`px-4 py-3 text-right font-mono font-medium ${
                  row.saldo >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {formatSEK(row.saldo)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
