import type { TransaktionsRad, TransactionType } from '../types'

/** SE invoice: Dr 1510 (incl. 25% moms) / Kr 3001 + Kr 2610 */
export function raderFakturaUtSE(belopp: number): TransaktionsRad[] {
  const moms = Math.round(belopp * 0.25 * 100) / 100
  const total = belopp + moms
  return [
    { konto: 1510, debet: total, kredit: 0 },
    { konto: 3001, debet: 0, kredit: belopp },
    { konto: 2610, debet: 0, kredit: moms },
  ]
}

/** EU invoice (reverse charge): Dr 1510 / Kr 3004 */
export function raderFakturaUtEU(belopp: number): TransaktionsRad[] {
  return [
    { konto: 1510, debet: belopp, kredit: 0 },
    { konto: 3004, debet: 0, kredit: belopp },
  ]
}

/** Export invoice (outside EU): Dr 1510 / Kr 3006 */
export function raderFakturaUtExport(belopp: number): TransaktionsRad[] {
  return [
    { konto: 1510, debet: belopp, kredit: 0 },
    { konto: 3006, debet: 0, kredit: belopp },
  ]
}

/** SE receipt: Dr 5400 (cost) + Dr 2640 (VAT) / Kr 1930 (total) */
export function raderKvittoSE(belopp: number): TransaktionsRad[] {
  const moms = Math.round(belopp * 0.25 * 100) / 100
  const total = belopp + moms
  return [
    { konto: 5400, debet: belopp, kredit: 0 },
    { konto: 2640, debet: moms, kredit: 0 },
    { konto: 1930, debet: 0, kredit: total },
  ]
}

/** SaaS/EU service: Dr 6570 + Dr 2640 / Kr 1930 + Kr 4545 */
export function raderKvittoEUSaaS(belopp: number): TransaktionsRad[] {
  const moms = Math.round(belopp * 0.25 * 100) / 100
  return [
    { konto: 6570, debet: belopp, kredit: 0 },
    { konto: 2640, debet: moms, kredit: 0 },
    { konto: 1930, debet: 0, kredit: belopp },
    { konto: 4545, debet: 0, kredit: moms },
  ]
}

/** Bank settlement for paid invoice: Dr 1930 / Kr 1510 */
export function raderBetalningFaktura(belopp: number): TransaktionsRad[] {
  return [
    { konto: 1930, debet: belopp, kredit: 0 },
    { konto: 1510, debet: 0, kredit: belopp },
  ]
}

/** Returns booking rows for a given transaction type and amount (ex. VAT) */
export function autoBookRader(
  typ: TransactionType,
  belopp: number
): TransaktionsRad[] {
  switch (typ) {
    case 'faktura_ut':
      return raderFakturaUtSE(belopp)
    case 'kvitto_se':
      return raderKvittoSE(belopp)
    case 'kvitto_eu_saas':
      return raderKvittoEUSaaS(belopp)
    case 'kvitto_eu_vara':
      return raderFakturaUtEU(belopp) // placeholder
    default:
      return []
  }
}

/** Returns the total amount on account 1510 (kundfordran) for an invoice */
export function getInvoiceTotal(rader: TransaktionsRad[]): number {
  const rad = rader.find((r) => r.konto === 1510)
  return rad ? rad.debet : 0
}

/**
 * Returns a display amount for any transaction type:
 * - Outgoing invoice: 1510 debet (receivable incl. VAT)
 * - Expense/receipt: 1930 kredit (cash out)
 * - Payment received: 1930 debet (cash in)
 * - Fallback: largest single debet value
 */
export function getTransactionBelopp(rader: TransaktionsRad[]): number {
  const r1510 = rader.find((r) => r.konto === 1510)
  if (r1510 && r1510.debet > 0) return r1510.debet

  const r1930 = rader.find((r) => r.konto === 1930)
  if (r1930) {
    if (r1930.kredit > 0) return r1930.kredit
    if (r1930.debet > 0) return r1930.debet
  }

  return Math.max(0, ...rader.map((r) => r.debet))
}
