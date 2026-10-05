import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Toast = { id: number; message: string; tone: 'neutral' | 'error'; action?: { label: string; onClick: () => void } }
type Api = (message: string, opts?: { tone?: Toast['tone']; action?: Toast['action'] }) => void

const ToastContext = createContext<Api>(() => {})
export const useToast = () => useContext(ToastContext)

/** Lightweight, accessible toasts announced via a polite live region. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback<Api>((message, opts) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, message, tone: opts?.tone ?? 'neutral', action: opts?.action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.action ? 7000 : 4200)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-[480px] items-center gap-4 rounded-full px-5 py-3 text-[13px] shadow-[0_12px_40px_rgba(0,0,0,0.25)] ${t.tone === 'error' ? 'bg-[#7a231b] text-white' : 'bg-ink text-white'}`}
            style={{ animation: 'fade-up 260ms ease-out' }}
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="shrink-0 text-[12px] uppercase underline underline-offset-4"
                onClick={() => {
                  t.action!.onClick()
                  setToasts((x) => x.filter((y) => y.id !== t.id))
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
