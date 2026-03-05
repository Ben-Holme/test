import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTransactions } from '../hooks/useTransactions'
import { TransactionList } from '../components/domain/TransactionList'
import { Button } from '../components/ui/Button'
import type { TransactionStatus, TransactionType } from '../types'

const ALL = 'all'

export function Transactions() {
  const { transactions, markPaid, remove } = useTransactions()
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>(ALL)
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>(ALL)

  const filtered = transactions
    .filter((t) => statusFilter === ALL || t.status === statusFilter)
    .filter((t) => typeFilter === ALL || t.typ === typeFilter)
    .sort((a, b) => b.datum.localeCompare(a.datum))

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Transaktioner</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {filtered.length} av {transactions.length} poster
          </p>
        </div>
        <Link to="/transaktioner/ny">
          <Button>+ Ny transaktion</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | 'all')}
          className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value={ALL}>Alla statusar</option>
          <option value="utkast">Utkast</option>
          <option value="bokförd">Bokförd</option>
          <option value="betald">Betald</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'all')}
          className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value={ALL}>Alla typer</option>
          <option value="faktura_ut">Faktura ut</option>
          <option value="kvitto_se">Kvitto SE</option>
          <option value="kvitto_eu_saas">SaaS utland</option>
          <option value="manuell">Manuell</option>
        </select>
      </div>

      <TransactionList
        transactions={filtered}
        onMarkPaid={markPaid}
        onDelete={remove}
      />
    </div>
  )
}
