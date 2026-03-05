import { createContext, useContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { AppState, Transaction } from '../types'
import { BAS_ACCOUNTS } from './basAccounts'
import { raderBetalningFaktura, getInvoiceTotal } from './bookingRules'
import { loadState, saveState } from './storage'
import { today } from '../lib/formatters'

type Action =
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'MARK_PAID'; payload: string }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_TRANSACTION':
      return { ...state, transactions: [...state.transactions, action.payload] }

    case 'UPDATE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      }

    case 'DELETE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.payload),
      }

    case 'MARK_PAID': {
      const original = state.transactions.find((t) => t.id === action.payload)
      if (!original) return state

      const total = getInvoiceTotal(original.rader)
      const settlement: Transaction = {
        id: uuidv4(),
        datum: today(),
        beskrivning: `Betalning: ${original.beskrivning}`,
        typ: 'manuell',
        status: 'bokförd',
        rader: raderBetalningFaktura(total),
        bilagor: [],
      }

      return {
        ...state,
        transactions: state.transactions
          .map((t) =>
            t.id === action.payload ? { ...t, status: 'betald' as const } : t
          )
          .concat(settlement),
      }
    }

    default:
      return state
  }
}

const defaultState: AppState = {
  transactions: [],
  accounts: BAS_ACCOUNTS,
}

interface StoreContextValue {
  state: AppState
  dispatch: (action: Action) => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const persisted = loadState()
    return persisted ?? defaultState
  })

  useEffect(() => {
    saveState(state)
  }, [state])

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
