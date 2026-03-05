import { useState, useEffect } from 'react'
import type { TransactionType, TransactionStatus, TransaktionsRad } from '../../../types'
import { autoBookRader } from '../../../data/bookingRules'
import { today } from '../../../lib/formatters'

export interface TransactionFormValues {
  datum: string
  beskrivning: string
  typ: TransactionType
  status: TransactionStatus
  belopp: string // string for controlled input
  rader: TransaktionsRad[]
}

const defaultValues: TransactionFormValues = {
  datum: today(),
  beskrivning: '',
  typ: 'faktura_ut',
  status: 'bokförd',
  belopp: '',
  rader: [],
}

export function useTransactionForm(initial?: Partial<TransactionFormValues>) {
  const [values, setValues] = useState<TransactionFormValues>({
    ...defaultValues,
    ...initial,
  })
  const [invoiceSubtype, setInvoiceSubtype] = useState<'se' | 'eu' | 'export'>('se')

  // Recompute booking rows when type or amount changes (for auto-bookable types)
  useEffect(() => {
    if (values.typ === 'manuell') return
    const belopp = parseFloat(values.belopp)
    if (!isNaN(belopp) && belopp > 0) {
      let typ = values.typ
      if (values.typ === 'faktura_ut') {
        if (invoiceSubtype === 'eu') typ = 'faktura_ut' // handled via different rule
        if (invoiceSubtype === 'export') typ = 'faktura_ut'
      }
      // Map faktura_ut subtypes to booking rules
      let rader: TransaktionsRad[]
      if (values.typ === 'faktura_ut') {
        if (invoiceSubtype === 'eu') {
          rader = [
            { konto: 1510, debet: belopp, kredit: 0 },
            { konto: 3004, debet: 0, kredit: belopp },
          ]
        } else if (invoiceSubtype === 'export') {
          rader = [
            { konto: 1510, debet: belopp, kredit: 0 },
            { konto: 3006, debet: 0, kredit: belopp },
          ]
        } else {
          rader = autoBookRader('faktura_ut', belopp)
        }
      } else {
        rader = autoBookRader(typ, belopp)
      }
      setValues((v) => ({ ...v, rader }))
    }
  }, [values.typ, values.belopp, invoiceSubtype])

  function setField<K extends keyof TransactionFormValues>(
    key: K,
    value: TransactionFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function setRader(rader: TransaktionsRad[]) {
    setValues((v) => ({ ...v, rader }))
  }

  const isAutoBooked = values.typ !== 'manuell'
  const isBalanced =
    values.rader.reduce((s, r) => s + r.debet - r.kredit, 0) === 0

  return {
    values,
    invoiceSubtype,
    setInvoiceSubtype,
    setField,
    setRader,
    isAutoBooked,
    isBalanced,
  }
}
