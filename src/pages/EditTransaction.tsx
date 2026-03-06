import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTransaction, useTransactions } from '../hooks/useTransactions'
import { JournalRows } from '../components/domain/TransactionForm/JournalRows'
import { BilagorSection } from '../components/domain/BilagorSection'
import { StatusBadge, TypeBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { formatDate, formatSEK } from '../lib/formatters'
import { getInvoiceTotal } from '../data/bookingRules'

export function EditTransaction() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const transaction = useTransaction(id!)
  const { markPaid, remove } = useTransactions()

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

      <BilagorSection transaction={transaction} />

      <div className="flex items-center gap-3">
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
