import type { TransactionStatus, TransactionType } from '../../types'

const statusClasses: Record<TransactionStatus, string> = {
  utkast: 'bg-neutral-700 text-neutral-300',
  bokförd: 'bg-sky-900 text-sky-300',
  betald: 'bg-emerald-900 text-emerald-300',
}

const statusLabels: Record<TransactionStatus, string> = {
  utkast: 'Utkast',
  bokförd: 'Bokförd',
  betald: 'Betald',
}

const typeLabels: Record<TransactionType, string> = {
  faktura_ut: 'Faktura ut',
  kvitto_se: 'Kvitto SE',
  kvitto_eu_saas: 'SaaS utland',
  kvitto_eu_vara: 'Kvitto EU',
  lön: 'Lön',
  manuell: 'Manuell',
}

export function StatusBadge({ status }: { status: TransactionStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  )
}

export function TypeBadge({ typ }: { typ: TransactionType }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-800 text-neutral-400">
      {typeLabels[typ]}
    </span>
  )
}
