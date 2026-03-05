import { v4 as uuidv4 } from 'uuid'
import type { Transaction, TransactionType } from '../types'
import { useStore } from '../data/store'
import { autoBookRader } from '../data/bookingRules'
import { today } from '../lib/formatters'

export function useTransactions() {
  const { state, dispatch } = useStore()

  function add(
    partial: Omit<Transaction, 'id'> & { belopp?: number }
  ): Transaction {
    const { belopp, ...rest } = partial
    const rader =
      rest.rader.length === 0 && belopp !== undefined
        ? autoBookRader(rest.typ, belopp)
        : rest.rader

    const t: Transaction = {
      id: uuidv4(),
      ...rest,
      rader,
    }
    dispatch({ type: 'ADD_TRANSACTION', payload: t })
    return t
  }

  function update(t: Transaction) {
    dispatch({ type: 'UPDATE_TRANSACTION', payload: t })
  }

  function remove(id: string) {
    dispatch({ type: 'DELETE_TRANSACTION', payload: id })
  }

  function markPaid(id: string) {
    dispatch({ type: 'MARK_PAID', payload: id })
  }

  function createInvoice(params: {
    beskrivning: string
    typ: TransactionType
    belopp: number
    datum?: string
  }): Transaction {
    return add({
      datum: params.datum ?? today(),
      beskrivning: params.beskrivning,
      typ: params.typ,
      status: 'bokförd',
      rader: [],
      bilagor: [],
      belopp: params.belopp,
    })
  }

  return {
    transactions: state.transactions,
    add,
    update,
    remove,
    markPaid,
    createInvoice,
  }
}

export function useTransaction(id: string): Transaction | undefined {
  const { state } = useStore()
  return state.transactions.find((t) => t.id === id)
}
