import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useCustomerStore } from '../store/useCustomerStore'
import { ClipboardList, Check, ChevronDown, ChevronUp } from 'lucide-react'

interface PendingItem {
  purchase: {
    id: string
    customer_id: string
    date: string
    lens: { enabled: boolean; lens_kind: string }
    frame: { enabled: boolean; source: string }
    other: { enabled: boolean; source: string }
    cost_lens: number | null
    cost_frame: number | null
    cost_other: number | null
    total: number
  }
  customer: { customer_id: string; first_name: string; last_name: string }
}

interface CostDraft {
  cost_lens?: string
  cost_frame?: string
  cost_other?: string
}

function needsCost(item: PendingItem): { lens: boolean; frame: boolean; other: boolean } {
  const { purchase: p } = item
  return {
    lens:  p.cost_lens  === null,
    frame: p.cost_frame === null,
    other: p.cost_other === null,
  }
}

function CostRow({ label, value, field, draft, onChange }: {
  label: string
  value: number | null
  field: keyof CostDraft
  draft: CostDraft
  onChange: (f: keyof CostDraft, v: string) => void
}) {
  if (value !== null) return null
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-20 shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-400">฿</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft[field] ?? ''}
          onChange={e => onChange(field, e.target.value)}
          placeholder="0"
          className="w-28 border border-slate-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>
    </div>
  )
}

export default function PendingCostsPage() {
  const [items, setItems]     = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts]   = useState<Record<string, CostDraft>>({})
  const [saving, setSaving]   = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const updatePurchaseCosts = useCustomerStore(s => s.updatePurchaseCosts)

  async function load() {
    setLoading(true)
    try {
      const res = await api.purchases.pendingCosts()
      setItems(res.data)
      const initial: Record<string, CostDraft> = {}
      for (const item of res.data) initial[item.purchase.id] = {}
      setDrafts(initial)
      const exp: Record<string, boolean> = {}
      for (const item of res.data) exp[item.purchase.id] = true
      setExpanded(exp)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function setDraft(purchaseId: string, field: keyof CostDraft, value: string) {
    setDrafts(prev => ({ ...prev, [purchaseId]: { ...prev[purchaseId], [field]: value } }))
  }

  async function save(item: PendingItem) {
    const pid = item.purchase.id
    const draft = drafts[pid] ?? {}
    const needs = needsCost(item)

    const costs: { cost_lens?: number | null; cost_frame?: number | null; cost_other?: number | null } = {}
    if (needs.lens)  costs.cost_lens  = draft.cost_lens  !== undefined && draft.cost_lens  !== '' ? Number(draft.cost_lens)  : null
    if (needs.frame) costs.cost_frame = draft.cost_frame !== undefined && draft.cost_frame !== '' ? Number(draft.cost_frame) : null
    if (needs.other) costs.cost_other = draft.cost_other !== undefined && draft.cost_other !== '' ? Number(draft.cost_other) : null

    const allFilled = Object.values(costs).every(v => v !== null)
    if (!allFilled) return

    setSaving(prev => ({ ...prev, [pid]: true }))
    try {
      await updatePurchaseCosts(pid, costs)
      await load()
    } finally {
      setSaving(prev => ({ ...prev, [pid]: false }))
    }
  }

  function toggle(pid: string) {
    setExpanded(prev => ({ ...prev, [pid]: !prev[pid] }))
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-sm text-slate-400">กำลังโหลด...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList size={20} className="text-slate-700" />
        <h1 className="text-xl font-semibold text-slate-900">ต้นทุนรอกรอก</h1>
        {items.length > 0 && (
          <span className="text-xs font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
            {items.length} รายการ
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Check size={32} className="text-green-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">กรอกต้นทุนครบทุกรายการแล้ว</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const pid   = item.purchase.id
            const needs = needsCost(item)
            const draft = drafts[pid] ?? {}
            const isExpanded = expanded[pid] ?? true

            const allFilled =
              (!needs.lens  || (draft.cost_lens  !== undefined && draft.cost_lens  !== '')) &&
              (!needs.frame || (draft.cost_frame !== undefined && draft.cost_frame !== '')) &&
              (!needs.other || (draft.cost_other !== undefined && draft.cost_other !== ''))

            return (
              <div key={pid} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(pid)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {item.customer.first_name} {item.customer.last_name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.purchase.date} · #{pid}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {needs.lens  && <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium">เลนส์</span>}
                      {needs.frame && <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium">กรอบ</span>}
                      {needs.other && <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium">อื่นๆ</span>}
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-slate-100 pt-4 space-y-3">
                    <CostRow label="เลนส์" value={item.purchase.cost_lens} field="cost_lens" draft={draft} onChange={(f, v) => setDraft(pid, f, v)} />
                    <CostRow label="กรอบ" value={item.purchase.cost_frame} field="cost_frame" draft={draft} onChange={(f, v) => setDraft(pid, f, v)} />
                    <CostRow label="อื่นๆ" value={item.purchase.cost_other} field="cost_other" draft={draft} onChange={(f, v) => setDraft(pid, f, v)} />

                    <div className="pt-1">
                      <button
                        type="button"
                        disabled={!allFilled || saving[pid]}
                        onClick={() => save(item)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-900 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                      >
                        <Check size={14} />
                        {saving[pid] ? 'กำลังบันทึก...' : 'บันทึกต้นทุน'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
