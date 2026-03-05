/**
 * One-time migration: if the app previously stored data in localStorage
 * (key 'vantör_bokföring_v1'), import all transactions into Supabase
 * and then clear the local key so the migration only runs once.
 */
import { insertTransaction } from './api'
import type { AppState } from '../types'

const LEGACY_KEY = 'vantör_bokföring_v1'
const MIGRATED_KEY = 'vantör_bokföring_migrated'

export async function migrateFromLocalStorage(): Promise<void> {
  if (localStorage.getItem(MIGRATED_KEY)) return

  const raw = localStorage.getItem(LEGACY_KEY)
  if (!raw) return

  try {
    const state: AppState = JSON.parse(raw)
    if (!Array.isArray(state.transactions) || state.transactions.length === 0) {
      localStorage.removeItem(LEGACY_KEY)
      localStorage.setItem(MIGRATED_KEY, '1')
      return
    }

    for (const t of state.transactions) {
      // eslint-disable-next-line no-await-in-loop
      await insertTransaction({
        datum: t.datum,
        beskrivning: t.beskrivning,
        typ: t.typ,
        status: t.status,
        bilagor: t.bilagor ?? [],
        rader: t.rader,
      })
    }

    localStorage.removeItem(LEGACY_KEY)
    localStorage.setItem(MIGRATED_KEY, '1')
    console.info(`[migration] Migrated ${state.transactions.length} transactions to Supabase.`)
  } catch (err) {
    console.error('[migration] Failed to migrate localStorage data:', err)
  }
}
