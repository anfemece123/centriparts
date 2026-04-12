import { useEffect, useState } from 'react'
import Button from './Button'

interface Props {
  title: string
  message: string | React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onClose,
}: Props) {
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch {
      setError('Ocurrió un error. Intente de nuevo.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}
    >
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex flex-col gap-2 px-6 pt-6 pb-4">
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          <div className="text-sm text-zinc-500">{message}</div>
          {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            disabled={busy}
            onClick={handleConfirm}
          >
            {busy ? 'Procesando…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
