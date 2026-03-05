import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { StoreProvider } from './data/store'
import { Shell } from './components/layout/Shell'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { NewTransaction } from './pages/NewTransaction'
import { EditTransaction } from './pages/EditTransaction'
import { Ledger } from './pages/Ledger'
import { VatReport } from './pages/VatReport'

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
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return (
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  )
}
