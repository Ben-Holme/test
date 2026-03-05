import { useStore } from '../data/store'
import type { Account } from '../types'

export function useAccounts() {
  const { accounts } = useStore()
  return accounts
}

export function useAccount(id: number): Account | undefined {
  const accounts = useAccounts()
  return accounts.find((a) => a.id === id)
}
