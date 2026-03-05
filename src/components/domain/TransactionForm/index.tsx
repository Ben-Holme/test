import type { Transaction, TransactionType } from '../../../types'
import { useTransactionForm } from './useTransactionForm'
import { JournalRows } from './JournalRows'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Select } from '../../ui/Select'
import { v4 as uuidv4 } from 'uuid'

const typeOptions = [
  { value: 'faktura_ut', label: 'Faktura ut' },
  { value: 'kvitto_se', label: 'Kvitto (Sverige)' },
  { value: 'kvitto_eu_saas', label: 'SaaS utland (EU/USA)' },
  { value: 'kvitto_eu_vara', label: 'Kvitto EU-vara' },
  { value: 'manuell', label: 'Manuell kontering' },
]

const invoiceSubtypeOptions = [
  { value: 'se', label: 'Sverige (25% moms)' },
  { value: 'eu', label: 'EU-företag (omvänd skattskyldighet)' },
  { value: 'export', label: 'Export (utanför EU)' },
]

interface TransactionFormProps {
  initial?: Partial<Transaction>
  onSave: (t: Transaction) => void
  onCancel: () => void
}

export function TransactionForm({ initial, onSave, onCancel }: TransactionFormProps) {
  const {
    values,
    invoiceSubtype,
    setInvoiceSubtype,
    setField,
    setRader,
    isAutoBooked,
    isBalanced,
  } = useTransactionForm(
    initial
      ? {
          datum: initial.datum,
          beskrivning: initial.beskrivning,
          typ: initial.typ,
          status: initial.status,
          rader: initial.rader,
          belopp: '',
        }
      : undefined
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isBalanced && values.rader.length > 0) return

    const t: Transaction = {
      id: initial?.id ?? uuidv4(),
      datum: values.datum,
      beskrivning: values.beskrivning,
      typ: values.typ,
      status: values.status,
      rader: values.rader,
      bilagor: initial?.bilagor ?? [],
    }
    onSave(t)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Typ"
          value={values.typ}
          onChange={(e) => setField('typ', e.target.value as TransactionType)}
          options={typeOptions}
        />
        <Input
          label="Datum"
          type="date"
          value={values.datum}
          onChange={(e) => setField('datum', e.target.value)}
          required
        />
      </div>

      {values.typ === 'faktura_ut' && (
        <Select
          label="Mottagare"
          value={invoiceSubtype}
          onChange={(e) => setInvoiceSubtype(e.target.value as 'se' | 'eu' | 'export')}
          options={invoiceSubtypeOptions}
        />
      )}

      <Input
        label="Beskrivning"
        type="text"
        value={values.beskrivning}
        onChange={(e) => setField('beskrivning', e.target.value)}
        placeholder="t.ex. Konsulttjänster mars, Faktura #001"
        required
      />

      {isAutoBooked && (
        <Input
          label="Belopp (exkl. moms) SEK"
          type="number"
          value={values.belopp}
          onChange={(e) => setField('belopp', e.target.value)}
          placeholder="0.00"
          min="0"
          step="0.01"
        />
      )}

      <JournalRows
        rader={values.rader}
        onChange={isAutoBooked ? undefined : setRader}
        readOnly={isAutoBooked}
      />

      {values.typ === 'manuell' && (
        <JournalRows
          rader={values.rader}
          onChange={setRader}
          readOnly={false}
        />
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Avbryt
        </Button>
        <Button
          type="submit"
          disabled={values.rader.length === 0 || (!isBalanced && values.typ === 'manuell')}
        >
          Spara transaktion
        </Button>
      </div>
    </form>
  )
}
