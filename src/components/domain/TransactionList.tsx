import { useNavigate } from 'react-router-dom'
import type { Transaction } from '../../types'
import { StatusBadge, TypeBadge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { formatDate, formatSEK } from '../../lib/formatters'
import { getInvoiceTotal } from '../../data/bookingRules'

interface TransactionListProps {
  transactions: Transaction[]
  onMarkPaid?: (id: string) => void
  onDelete?: (id: string) => void
}

export function TransactionList({
  transactions,
  onMarkPaid,
  onDelete,
}: TransactionListProps) {
  const navigate = useNavigate()

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-500">
        <div className="text-4xl mb-3">◻</div>
        <div className="text-sm">Inga transaktioner än</div>
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
            <th className="text-left px-4 py-3">Typ</th>
            <th className="text-right px-4 py-3">Belopp</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {transactions.map((t) => {
            const total = getInvoiceTotal(t.rader)
            return (
              <tr
                key={t.id}
                className="hover:bg-neutral-800/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/transaktioner/${t.id}`)}
              >
                <td className="px-4 py-3 text-neutral-400 whitespace-nowrap font-mono text-xs">
                  {formatDate(t.datum)}
                </td>
                <td className="px-4 py-3 text-neutral-100 max-w-xs truncate">
                  {t.beskrivning}
                </td>
                <td className="px-4 py-3">
                  <TypeBadge typ={t.typ} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-neutral-200 whitespace-nowrap">
                  {total > 0 ? formatSEK(total) : '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div
                    className="flex items-center justify-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t.typ === 'faktura_ut' && t.status === 'bokförd' && onMarkPaid && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onMarkPaid(t.id)}
                      >
                        Markera betald
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(t.id)}
                      >
                        Ta bort
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
