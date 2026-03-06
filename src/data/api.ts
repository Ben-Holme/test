import { supabase } from './supabase'
import type { Transaction, TransactionStatus, TransaktionsRad } from '../types'

// Shape returned by Supabase join
interface RawTransaction {
  id: string
  nr?: number
  datum: string
  beskrivning: string
  typ: string
  status: string
  bilagor: string[]
  created_at: string
  transaction_rader: { id: string; konto: number; debet: number; kredit: number }[]
}

function mapRow(raw: RawTransaction): Transaction {
  return {
    id: raw.id,
    nr: raw.nr,
    datum: raw.datum,
    beskrivning: raw.beskrivning,
    typ: raw.typ as Transaction['typ'],
    status: raw.status as TransactionStatus,
    bilagor: raw.bilagor ?? [],
    rader: (raw.transaction_rader ?? []).map((r) => ({
      konto: r.konto,
      debet: Number(r.debet),
      kredit: Number(r.kredit),
    })),
  }
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, transaction_rader(*)')
    .order('datum', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data as RawTransaction[]) ?? []).map(mapRow)
}

export async function insertTransaction(
  t: Omit<Transaction, 'id'>
): Promise<Transaction> {
  const { data: txRow, error: txError } = await supabase
    .from('transactions')
    .insert({
      datum: t.datum,
      beskrivning: t.beskrivning,
      typ: t.typ,
      status: t.status,
      bilagor: t.bilagor,
    })
    .select('id')
    .single()

  if (txError || !txRow) throw new Error(txError?.message ?? 'Insert failed')

  const id = txRow.id as string

  if (t.rader.length > 0) {
    const raderRows = t.rader.map((r: TransaktionsRad) => ({
      transaction_id: id,
      konto: r.konto,
      debet: r.debet,
      kredit: r.kredit,
    }))

    const { error: raderError } = await supabase
      .from('transaction_rader')
      .insert(raderRows)

    if (raderError) throw new Error(raderError.message)
  }

  return { ...t, id }
}

export async function updateTransactionStatus(
  id: string,
  status: TransactionStatus
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ status })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function updateTransactionBilagor(id: string, bilagor: string[]): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ bilagor })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function uploadBilaga(transactionId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${transactionId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from('bilagor').upload(path, file)
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from('bilagor').getPublicUrl(path)
  return data.publicUrl
}

export async function deleteBilaga(url: string): Promise<void> {
  // Extract path after /object/public/bilagor/
  const marker = '/object/public/bilagor/'
  const idx = url.indexOf(marker)
  if (idx === -1) return
  const path = url.slice(idx + marker.length)

  const { error } = await supabase.storage.from('bilagor').remove([path])
  if (error) throw new Error(error.message)
}
