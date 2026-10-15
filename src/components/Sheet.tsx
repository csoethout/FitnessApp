import type { ReactNode } from 'react'

/** Bottom sheet: slides up over the screen, tap outside to close. Thumb-friendly for one-handed use. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full flex-col rounded-t-3xl border-t border-border bg-surface pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h2 className="flex-1 text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-12 px-3 text-muted">
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-4">{children}</div>
      </div>
    </div>
  )
}

export function SheetAction(props: { onClick: () => void; danger?: boolean; children: ReactNode; detail?: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex min-h-14 w-full flex-col justify-center border-b border-border text-left last:border-b-0 ${props.danger ? 'text-danger' : ''}`}
    >
      <span>{props.children}</span>
      {props.detail && <span className="text-xs text-muted">{props.detail}</span>}
    </button>
  )
}
