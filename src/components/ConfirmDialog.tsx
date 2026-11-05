import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { btn, input } from './ui'

export interface ConfirmOptions {
  title: string
  body: ReactNode
  confirmLabel: string
  danger?: boolean
  /** When set, the user must type this exact text to enable the confirm button. */
  requireText?: string
  /** Optional safer alternative (e.g. Archive instead of Delete). */
  alternative?: { label: string; onSelect: () => void }
  onConfirm: () => void
}

/** Native <dialog>: focus trap, Esc to cancel, and focus return come from the browser. */
export function ConfirmDialog({
  options,
  onClose,
}: {
  options: ConfirmOptions | null
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [typed, setTyped] = useState('')
  const titleId = useId()
  const inputId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (options && !d.open) {
      setTyped('')
      d.showModal()
    } else if (!options && d.open) d.close()
  }, [options])

  const blocked = Boolean(options?.requireText && typed.trim() !== options.requireText.trim())

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-xl p-0 text-slate-900 backdrop:bg-black/50"
    >
      {options && (
        <form
          method="dialog"
          className="p-6"
          onSubmit={(e) => {
            if (blocked) {
              e.preventDefault()
              return
            }
            options.onConfirm()
          }}
        >
          <h2 id={titleId} className="text-xl font-bold">
            {options.title}
          </h2>
          <div className="mt-3 space-y-2 text-slate-800">{options.body}</div>
          {options.requireText && (
            <div className="mt-4">
              <label htmlFor={inputId} className="block font-medium">
                Type <strong>{options.requireText}</strong> to confirm
              </label>
              <input
                id={inputId}
                className={input}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className={btn.secondary}
              onClick={() => ref.current?.close()}
              autoFocus
            >
              Cancel
            </button>
            {options.alternative && (
              <button
                type="button"
                className={btn.primary}
                onClick={() => {
                  options.alternative?.onSelect()
                  ref.current?.close()
                }}
              >
                {options.alternative.label}
              </button>
            )}
            <button
              type="submit"
              className={options.danger ? btn.danger : btn.primary}
              disabled={blocked}
            >
              {options.confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
