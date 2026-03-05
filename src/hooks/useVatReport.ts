import { useMemo } from 'react'
import { useTransactions } from './useTransactions'
import { buildVatReport } from '../lib/vatReport'
import type { VatReport } from '../lib/vatReport'

export function useVatReport(fromDate: string, toDate: string): VatReport {
  const { transactions } = useTransactions()
  return useMemo(
    () => buildVatReport(fromDate, toDate, transactions),
    [fromDate, toDate, transactions]
  )
}
