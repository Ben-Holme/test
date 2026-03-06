import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Transaction } from '../types'
import {
  fetchTransactions,
  insertTransaction,
  updateTransactionStatus,
  deleteTransaction,
  uploadBilaga,
  deleteBilaga,
  updateBilagor,
} from '../data/api'
import { raderBetalningFaktura, getInvoiceTotal } from '../data/bookingRules'
import { today } from '../lib/formatters'

export const TRANSACTIONS_KEY = ['transactions'] as const

export function useTransactions() {
  const queryClient = useQueryClient()

  const {
    data: transactions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: TRANSACTIONS_KEY,
    queryFn: fetchTransactions,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY })

  const addMutation = useMutation({
    mutationFn: (t: Omit<Transaction, 'id'>) => insertTransaction(t),
    onSuccess: invalidate,
  })

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const original = transactions.find((t) => t.id === id)
      if (!original) throw new Error('Transaction not found')

      await updateTransactionStatus(id, 'betald')

      const total = getInvoiceTotal(original.rader)
      await insertTransaction({
        datum: today(),
        beskrivning: `Betalning: ${original.beskrivning}`,
        typ: 'manuell',
        status: 'bokförd',
        rader: raderBetalningFaktura(total),
        bilagor: [],
      })
    },
    onSuccess: invalidate,
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: invalidate,
  })

  const attachMutation = useMutation({
    mutationFn: async ({ transactionId, file }: { transactionId: string; file: File }) => {
      const transaction = transactions.find((t) => t.id === transactionId)
      if (!transaction) throw new Error('Transaction not found')
      const path = await uploadBilaga(transactionId, file)
      await updateBilagor(transactionId, [...transaction.bilagor, path])
    },
    onSuccess: invalidate,
  })

  const detachMutation = useMutation({
    mutationFn: async ({ transactionId, path }: { transactionId: string; path: string }) => {
      const transaction = transactions.find((t) => t.id === transactionId)
      if (!transaction) throw new Error('Transaction not found')
      await deleteBilaga(path)
      await updateBilagor(transactionId, transaction.bilagor.filter((p) => p !== path))
    },
    onSuccess: invalidate,
  })

  return {
    transactions,
    isLoading,
    error,
    add: (t: Omit<Transaction, 'id'>) => addMutation.mutateAsync(t),
    markPaid: (id: string) => markPaidMutation.mutate(id),
    remove: (id: string) => removeMutation.mutate(id),
    isAdding: addMutation.isPending,
    attachFile: (args: { transactionId: string; file: File }) => attachMutation.mutateAsync(args),
    detachFile: (args: { transactionId: string; path: string }) => detachMutation.mutateAsync(args),
    isAttaching: attachMutation.isPending,
  }
}

export function useTransaction(id: string): Transaction | undefined {
  const { transactions } = useTransactions()
  return transactions.find((t) => t.id === id)
}
