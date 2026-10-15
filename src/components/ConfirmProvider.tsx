import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const Ctx = createContext<ConfirmFn | null>(null)

/**
 * In-app confirmation sheet. We don't use window.confirm(): iOS Safari (especially home-screen apps) can
 * silently block it, which made buttons like Finish appear to do nothing.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => new Promise((resolve) => setPending({ ...options, resolve })), [])

  const close = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/60" onClick={() => close(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-3xl border-t border-border bg-surface px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <h2 id="confirm-title" className="text-lg font-semibold">{pending.title}</h2>
            {pending.message && <p className="mt-1 text-muted">{pending.message}</p>}
            <div className="mt-5 space-y-2">
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className={`min-h-14 w-full rounded-xl text-lg font-semibold ${
                  pending.danger ? 'bg-danger text-white' : 'bg-accent text-accent-ink'
                }`}
              >
                {pending.confirmLabel ?? 'OK'}
              </button>
              <button type="button" onClick={() => close(false)} className="min-h-12 w-full rounded-xl text-muted">
                {pending.cancelLabel ?? 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react/only-export-components
export function useConfirm(): ConfirmFn {
  const confirm = useContext(Ctx)
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider')
  return confirm
}
