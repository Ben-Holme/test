import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StoreProvider } from './data/store'

const queryClient = new QueryClient()
import { Shell } from './components/layout/Shell'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { NewTransaction } from './pages/NewTransaction'
import { EditTransaction } from './pages/EditTransaction'
import { Ledger } from './pages/Ledger'
import { VatReport } from './pages/VatReport'
import { BankImport } from './pages/BankImport'
import { ClaudeChat } from './pages/ClaudeChat'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'transaktioner', element: <Transactions /> },
      { path: 'transaktioner/ny', element: <NewTransaction /> },
      { path: 'transaktioner/:id', element: <EditTransaction /> },
      { path: 'huvudbok', element: <Ledger /> },
      { path: 'momsrapport', element: <VatReport /> },
      { path: 'importera', element: <BankImport /> },
      { path: 'assistent', element: <ClaudeChat /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <RouterProvider router={router} />
      </StoreProvider>
    </QueryClientProvider>
  )
}
