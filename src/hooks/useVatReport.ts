import { useMemo } from 'react'
import { useStore } from '../data/store'
import { buildVatReport } from '../lib/vatReport'
import type { VatReport } from '../lib/vatReport'

export function useVatReport(fromDate: string, toDate: string): VatReport {
  const { state } = useStore()
  return useMemo(
    () => buildVatReport(fromDate, toDate, state.transactions),
    [fromDate, toDate, state.transactions]
  )
}
