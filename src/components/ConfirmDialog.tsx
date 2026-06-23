import { AlertTriangle } from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  detail?: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = 'ลบ',
  cancelLabel = 'ยกเลิก',
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  useEscapeKey(onCancel, open && !busy)

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-[80] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-red-100 bg-red-50 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-red-800 mt-0.5">{message}</p>
          </div>
        </div>

        {detail && (
          <div className="px-5 py-4">
            <p className="text-sm text-slate-600 break-words">{detail}</p>
          </div>
        )}

        <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-40"
          >
            {busy ? 'กำลังลบ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
