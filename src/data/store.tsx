import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { Account } from '../types'
import { BAS_ACCOUNTS } from './basAccounts'

interface AccountsContextValue {
  accounts: Account[]
}

const AccountsContext = createContext<AccountsContextValue>({
  accounts: BAS_ACCOUNTS,
})

export function StoreProvider({ children }: { children: ReactNode }) {
  return (
    <AccountsContext.Provider value={{ accounts: BAS_ACCOUNTS }}>
      {children}
    </AccountsContext.Provider>
  )
}

export function useStore(): AccountsContextValue {
  return useContext(AccountsContext)
}
