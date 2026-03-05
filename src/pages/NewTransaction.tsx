import { useNavigate } from 'react-router-dom'
import type { Transaction } from '../types'
import { useTransactions } from '../hooks/useTransactions'
import { TransactionForm } from '../components/domain/TransactionForm'

export function NewTransaction() {
  const navigate = useNavigate()
  const { add } = useTransactions()

  function handleSave(t: Transaction) {
    add(t)
    navigate('/transaktioner')
  }

  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-100">Ny transaktion</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Välj typ för automatisk kontering, eller välj Manuell.
        </p>
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <TransactionForm onSave={handleSave} onCancel={() => navigate('/transaktioner')} />
      </div>
    </div>
  )
}
