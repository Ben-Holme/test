import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTransactions } from '../hooks/useTransactions'
import { accountBalance } from '../lib/ledger'
import { buildVatReport } from '../lib/vatReport'
import { formatSEK } from '../lib/formatters'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

function currentQuarter(): { from: string; to: string } {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3)
  const year = now.getFullYear()
  const from = `${year}-${String(q * 3 + 1).padStart(2, '0')}-01`
  const lastMonth = q * 3 + 3
  const lastDay = new Date(year, lastMonth, 0).getDate()
  const to = `${year}-${String(lastMonth).padStart(2, '0')}-${lastDay}`
  return { from, to }
}

export function Dashboard() {
  const { transactions, isLoading } = useTransactions()

  const bankBalance = useMemo(
    () => accountBalance(1920, transactions),
    [transactions]
  )

  const unpaidInvoices = useMemo(
    () => transactions.filter((t) => t.typ === 'faktura_ut' && t.status === 'bokförd'),
    [transactions]
  )

  const unpaidTotal = useMemo(
    () =>
      unpaidInvoices.reduce((sum, t) => {
        const row = t.rader.find((r) => r.konto === 1510)
        return sum + (row?.debet ?? 0)
      }, 0),
    [unpaidInvoices]
  )

  const { from, to } = currentQuarter()
  const vatReport = useMemo(
    () => buildVatReport(from, to, transactions),
    [from, to, transactions]
  )

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.datum.localeCompare(a.datum))
        .slice(0, 5),
    [transactions]
  )

  if (isLoading) {
    return <div className="px-8 py-8 text-neutral-500 text-sm">Laddar...</div>
  }

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-100">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">Vantör Digital AB</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">
            Banksaldo (1920)
          </div>
          <div className={`text-2xl font-bold font-mono ${bankBalance >= 0 ? 'text-neutral-100' : 'text-red-400'}`}>
            {formatSEK(bankBalance)}
          </div>
        </Card>

        <Card>
          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">
            Obetalda fakturor
          </div>
          <div className="text-2xl font-bold text-neutral-100 font-mono">
            {unpaidInvoices.length}
          </div>
          {unpaidTotal > 0 && (
            <div className="text-sm text-neutral-400 mt-1 font-mono">
              {formatSEK(unpaidTotal)}
            </div>
          )}
        </Card>

        <Card>
          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">
            Moms att betala (kv.)
          </div>
          <div className={`text-2xl font-bold font-mono ${vatReport.nettoMoms >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {formatSEK(Math.abs(vatReport.nettoMoms))}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {vatReport.nettoMoms >= 0 ? 'att betala' : 'att återfå'}
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-8">
        <Link to="/transaktioner/ny">
          <Button>+ Ny faktura / kvitto</Button>
        </Link>
        <Link to="/transaktioner">
          <Button variant="secondary">Visa alla transaktioner</Button>
        </Link>
      </div>

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-3">
            Senaste transaktioner
          </h2>
          <div className="space-y-2">
            {recentTransactions.map((t) => (
              <Link
                key={t.id}
                to={`/transaktioner/${t.id}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors"
              >
                <div>
                  <div className="text-sm text-neutral-200">{t.beskrivning}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">{t.datum}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      t.status === 'betald'
                        ? 'bg-emerald-900 text-emerald-300'
                        : t.status === 'bokförd'
                        ? 'bg-sky-900 text-sky-300'
                        : 'bg-neutral-700 text-neutral-300'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {transactions.length === 0 && (
        <Card className="text-center py-12">
          <div className="text-3xl mb-4">◻</div>
          <div className="text-neutral-400 mb-4">Inga transaktioner ännu</div>
          <Link to="/transaktioner/ny">
            <Button>Skapa din första transaktion</Button>
          </Link>
        </Card>
      )}
    </div>
  )
}
