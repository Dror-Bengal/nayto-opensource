import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Dashboard } from './pages/Dashboard'
import './index.css'

const client = new QueryClient({defaultOptions: {queries: {retry: 1}}})
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <BrowserRouter>
      <main className="mx-auto max-w-[1600px] p-4 sm:p-7">
        <h1 className="mb-6 border-b pb-4 text-3xl font-semibold tracking-tight">Marketing analytics</h1>
        <Dashboard />
      </main>
    </BrowserRouter>
  </QueryClientProvider>
)
