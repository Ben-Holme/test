import { useState } from 'react'
import { useAccounts } from '../hooks/useAccounts'
import { useTransactions } from '../hooks/useTransactions'
import { LedgerTable } from '../components/domain/LedgerTable'
import { accountBalance } from '../lib/ledger'
import { formatSEK } from '../lib/formatters'

export function Ledger() {
  const accounts = useAccounts()
  const { transactions, isLoading } = useTransactions()
  const [selectedAccount, setSelectedAccount] = useState<number>(1920)

  const account = accounts.find((a) => a.id === selectedAccount)
  const balance = accountBalance(selectedAccount, transactions)

  if (isLoading) {
    return <div className="px-8 py-8 text-neutral-500 text-sm">Laddar...</div>
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-100">Huvudbok</h1>
        <p className="text-sm text-neutral-500 mt-1">
          T-kontovy per konto
        </p>
      </div>

      <div className="flex items-end gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            Konto
          </label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(Number(e.target.value))}
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-sky-500 min-w-72"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} — {a.namn}
              </option>
            ))}
          </select>
        </div>

        {account && (
          <div className="pb-2">
            <div className="text-xs text-neutral-500 mb-1">Saldo</div>
            <div className={`text-lg font-bold font-mono ${balance >= 0 ? 'text-neutral-100' : 'text-red-400'}`}>
              {formatSEK(balance)}
            </div>
          </div>
        )}
      </div>

      {account && (
        <div>
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-3">
            {account.id} — {account.namn} ({account.typ})
          </div>
          <LedgerTable accountId={selectedAccount} transactions={transactions} />
        </div>
      )}
    </div>
  )
}
