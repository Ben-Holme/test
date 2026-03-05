import type { Transaction } from '../types'

export interface LedgerRow {
  transactionId: string
  datum: string
  beskrivning: string
  debet: number
  kredit: number
  saldo: number
}

export function buildLedger(
  accountId: number,
  transactions: Transaction[]
): LedgerRow[] {
  const rows: LedgerRow[] = []

  const relevant = transactions
    .filter((t) => t.status !== 'utkast')
    .filter((t) => t.rader.some((r) => r.konto === accountId))
    .sort((a, b) => a.datum.localeCompare(b.datum))

  let saldo = 0
  for (const t of relevant) {
    for (const r of t.rader) {
      if (r.konto !== accountId) continue
      saldo += r.debet - r.kredit
      rows.push({
        transactionId: t.id,
        datum: t.datum,
        beskrivning: t.beskrivning,
        debet: r.debet,
        kredit: r.kredit,
        saldo,
      })
    }
  }

  return rows
}

/** Net balance for a given account across all booked/paid transactions */
export function accountBalance(
  accountId: number,
  transactions: Transaction[]
): number {
  return transactions
    .filter((t) => t.status !== 'utkast')
    .flatMap((t) => t.rader)
    .filter((r) => r.konto === accountId)
    .reduce((sum, r) => sum + r.debet - r.kredit, 0)
}
