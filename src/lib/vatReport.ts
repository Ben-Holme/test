import type { Transaction } from '../types'

export interface VatReport {
  utgåendeMoms: number // box 05: sum of 2610 kredit
  ingåendeMoms: number // box 48: sum of 2640 debet
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

  // Also account for förvärvsmoms (4545) which is an additional output VAT liability
  const förvärvsmomsKredit = relevant
    .flatMap((t) => t.rader)
    .filter((r) => r.konto === 4545)
    .reduce((sum, r) => sum + r.kredit, 0)

  return {
    utgåendeMoms: utgåendeMoms + förvärvsmomsKredit,
    ingåendeMoms,
    nettoMoms: utgåendeMoms + förvärvsmomsKredit - ingåendeMoms,
  }
}
