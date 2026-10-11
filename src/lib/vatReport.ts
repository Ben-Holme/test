import type { Transaction } from '../types'

export interface VatReport {
  utgåendeMoms: number // box 05: sum of 2610 + 2614 (+ legacy 4545) kredit
  ingåendeMoms: number // box 48: sum of 2640 + 2645 debet
  nettoMoms: number // box 49: utgående - ingående (positive = pay, negative = refund)
}

export function buildVatReport(
  fromDate: string,
  toDate: string,
  transactions: Transaction[]
): VatReport {
  const relevant = transactions.filter(
    (t) =>
      t.status !== 'utkast' && t.datum >= fromDate && t.datum <= toDate
  )

  const utgåendeMoms = relevant
    .flatMap((t) => t.rader)
    .filter((r) => r.konto === 2610)
    .reduce((sum, r) => sum + r.kredit, 0)

  const ingåendeMoms = relevant
    .flatMap((t) => t.rader)
    .filter((r) => r.konto === 2640)
    .reduce((sum, r) => sum + r.debet, 0)

  // Reverse-charge VAT on foreign acquisitions (EU/SaaS etc). 4545 is the
  // legacy account used before 2614/2645 existed — kept so old transactions
  // still count correctly.
  const omvändUtgåendeMoms = relevant
    .flatMap((t) => t.rader)
    .filter((r) => r.konto === 2614 || r.konto === 4545)
    .reduce((sum, r) => sum + r.kredit, 0)

  const omvändIngåendeMoms = relevant
    .flatMap((t) => t.rader)
    .filter((r) => r.konto === 2645)
    .reduce((sum, r) => sum + r.debet, 0)

  return {
    utgåendeMoms: utgåendeMoms + omvändUtgåendeMoms,
    ingåendeMoms: ingåendeMoms + omvändIngåendeMoms,
    nettoMoms: utgåendeMoms + omvändUtgåendeMoms - ingåendeMoms - omvändIngåendeMoms,
  }
}
