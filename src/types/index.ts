export type AccountType =
  | 'tillgång'
  | 'skuld'
  | 'intäkt'
  | 'kostnad'
  | 'eget_kapital'

export interface Account {
  id: number
  namn: string
  typ: AccountType
}

export type TransactionType =
  | 'faktura_ut'
  | 'kvitto_se'
  | 'kvitto_eu_saas'
  | 'kvitto_eu_vara'
  | 'lön'
  | 'manuell'

export type TransactionStatus = 'utkast' | 'bokförd' | 'betald'

export interface TransaktionsRad {
  konto: number
  debet: number
  kredit: number
}

export interface Transaction {
  id: string
  nr?: number
  datum: string // YYYY-MM-DD
  beskrivning: string
  typ: TransactionType
  status: TransactionStatus
  rader: TransaktionsRad[]
  bilagor: string[]
}

export interface AppState {
  transactions: Transaction[]
  accounts: Account[]
}
