import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import { routes } from './routes'
import { ToastProvider } from './app/ui/toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: (count, err) => count < 2 && !(err && 'status' in err && (err as { status: number }).status < 500 && (err as { status: number }).status > 0), refetchOnWindowFocus: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={createBrowserRouter(routes)} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
