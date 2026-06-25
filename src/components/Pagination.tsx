import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  onChange: (page: number) => void
  className?: string
}

// Compact prev/next pager. Renders nothing when everything fits on one page.
export default function Pagination({ page, totalPages, total, onChange, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <div className={`flex items-center justify-between gap-3 pt-3 ${className}`}>
      <p className="text-xs text-slate-400">ทั้งหมด {total.toLocaleString()} รายการ</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs text-slate-500 tabular-nums px-2 min-w-[64px] text-center">หน้า {page} / {totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
