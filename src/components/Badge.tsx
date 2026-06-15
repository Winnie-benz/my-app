import type { Category } from '../types/product'

const CATEGORY_STYLES: Record<string, string> = {
  'กรอบ': 'bg-sky-50 text-sky-600 border-sky-200',
  'เลนส์': 'bg-violet-50 text-violet-600 border-violet-200',
  'อุปกรณ์อื่นๆ': 'bg-amber-50 text-amber-600 border-amber-200',
}

export function CategoryBadge({ category }: { category: Category | string }) {
  const cls = CATEGORY_STYLES[category] ?? 'bg-slate-100 text-slate-500 border-slate-200'
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${cls}`}>
      {category}
    </span>
  )
}

export function StockBadge({ qty }: { qty: number }) {
  const cls =
    qty === 0
      ? 'bg-red-100 text-red-600'
      : qty <= 3
      ? 'bg-amber-100 text-amber-600'
      : 'bg-emerald-100 text-emerald-700'
  const icon = qty === 0 ? '✕' : qty <= 3 ? '▲' : '●'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>
      {icon} {qty}
    </span>
  )
}
