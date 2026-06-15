import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, ShoppingBag, CreditCard, Clock, Trophy, Download, Pencil, Check, Glasses, Eye } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../hooks/useAuth'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function downloadCSV(rows: any[], group: string, label: string) {
  const headers = ['ช่วงเวลา', 'จำนวนรายการ', 'ยอดขาย (฿)', 'ชำระแล้ว (฿)', 'ค้างชำระ (฿)']
  const body = rows.map(r => [
    fmtPeriod(r.period, group),
    r.count, r.revenue, r.paid, r.revenue - r.paid,
  ])
  const csv = [headers, ...body].map(r => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `sales-${label}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

function fmtPeriod(p: string, group: string) {
  if (group === 'day') {
    const [, m, d] = p.split('-')
    return `${d}/${m}`
  }
  const [y, m] = p.split('-')
  const months = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  return `${months[parseInt(m)]} ${parseInt(y) - 2500 + 43}`
}

const THAI_MONTHS = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

const LENS_TYPE_LABEL: Record<string, string> = {
  single_vision: 'ตาเดียว', bi_focal: 'ไบโฟคัล', pal: 'โปรเกรสซีฟ', specialty: 'พิเศษ', other: 'อื่นๆ',
}

const GENDER_LABEL: Record<string, string> = { male: 'ชาย', female: 'หญิง', unspecified: 'ไม่ระบุ' }
const GENDER_COLOR: Record<string, string> = { male: '#3b82f6', female: '#ec4899', unspecified: '#94a3b8' }
const AGE_ORDER  = ['under18','18-30','31-45','46-60','over60']
const AGE_LABEL: Record<string, string> = {
  under18: 'ต่ำกว่า 18', '18-30': '18–30', '31-45': '31–45', '46-60': '46–60', over60: '60+',
}
const AGE_COLOR  = ['#818cf8','#60a5fa','#34d399','#fbbf24','#f87171']

// ── Sub-components ────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean
}
function KpiCard({ icon, label, value, sub, highlight }: KpiCardProps) {
  return (
    <div className={`rounded-2xl p-5 border ${highlight ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-2 mb-3 text-slate-400">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className={`text-2xl font-bold ${highlight ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs mt-1 text-slate-400">{sub}</p>}
    </div>
  )
}

interface CustomTooltipProps {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; group: string
}
function CustomTooltip({ active, payload, label, group }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 mb-1">{fmtPeriod(label, group)}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="text-xs">{p.name}: ฿{fmt(p.value)}</p>
      ))}
    </div>
  )
}

function DonutRing({ pct }: { pct: number }) {
  const r = 46, cx = 60
  const circ = 2 * Math.PI * r
  const filled = Math.min(pct, 1) * circ
  const isOver = pct >= 1
  const stroke = isOver ? '#22c55e' : '#0f172a'
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
      {filled > 0 && (
        <circle
          cx={cx} cy={cx} r={r} fill="none"
          stroke={stroke} strokeWidth="12"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      )}
      <text x={cx} y="57" textAnchor="middle" fill={stroke} fontSize="18" fontWeight="700">
        {Math.round(pct * 100)}%
      </text>
      <text x={cx} y="74" textAnchor="middle" fill="#94a3b8" fontSize="10">ของเป้า</text>
    </svg>
  )
}

interface BarItem { label: string; count: number; color: string }

function HorizBars({ title, items, total }: { title: string; items: BarItem[]; total: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {total === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">ไม่มีข้อมูล</p>
      ) : (
        <div className="space-y-3">
          {items.map(({ label, count, color }) => {
            const pct = Math.round((count / total) * 100)
            return (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">{label}</span>
                  <span className="text-slate-500 tabular-nums">{count} ({pct}%)</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function rankCls(i: number) {
  if (i === 0) return 'bg-amber-100 text-amber-700'
  if (i === 1) return 'bg-slate-200 text-slate-600'
  if (i === 2) return 'bg-orange-100 text-orange-600'
  return 'bg-slate-100 text-slate-500'
}

interface RankItem { name: string; sub: string; count: number }

function RankList({ title, icon, items, emptyText }: { title: string; icon: React.ReactNode; items: RankItem[]; emptyText: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${rankCls(i)}`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                <p className="text-xs text-slate-400 truncate">{item.sub}</p>
              </div>
              <p className="text-sm font-semibold text-slate-700 shrink-0 tabular-nums">{item.count} ชิ้น</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Range = '30d' | '6m' | '12m'
const RANGES: { value: Range; label: string; group: 'day' | 'month' }[] = [
  { value: '30d', label: '30 วัน',  group: 'day'   },
  { value: '6m',  label: '6 เดือน', group: 'month' },
  { value: '12m', label: '1 ปี',    group: 'month' },
]

export default function ReportsPage() {
  const { user } = useAuth()
  const isAdmin  = user?.role === 'admin'

  // ── Existing state ──────────────────────────────────────────────────────────
  const [range,          setRange]          = useState<Range>('30d')
  const [summary,        setSummary]        = useState<any>(null)
  const [salesData,      setSalesData]      = useState<any[]>([])
  const [topProducts,    setTopProducts]    = useState<any[]>([])
  const [topCategories,  setTopCategories]  = useState<{ frames: any[]; lenses: any[] }>({ frames: [], lenses: [] })
  const [profitData,     setProfitData]     = useState<any[]>([])
  const [loading,        setLoading]        = useState(true)

  // ── Monthly state ───────────────────────────────────────────────────────────
  const now = new Date()
  const [selYear,       setSelYear]       = useState(now.getFullYear())
  const [selMonth,      setSelMonth]      = useState(now.getMonth() + 1)
  const [target,        setTarget]        = useState(() =>
    Number(localStorage.getItem('monthly_sales_target') || '100000'))
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetDraft,   setTargetDraft]   = useState('')
  const [monthlyData,   setMonthlyData]   = useState<any>(null)

  const monthStr = `${selYear}-${String(selMonth).padStart(2, '0')}`

  const currentRange = RANGES.find(r => r.value === range)!

  const fetchSales = useCallback(async (r: Range) => {
    const cfg = RANGES.find(x => x.value === r)!
    const res = await api.reports.sales(r, cfg.group)
    setSalesData(res.data)
  }, [])

  useEffect(() => {
    Promise.all([
      api.reports.summary(),
      api.reports.topProducts(10),
      api.reports.topCategories(5),
      isAdmin ? api.reports.profit('12m') : Promise.resolve({ data: [] }),
    ]).then(([s, t, tc, p]) => {
      setSummary(s.data)
      setTopProducts(t.data)
      setTopCategories(tc.data)
      setProfitData(p.data)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchSales(range) }, [range, fetchSales])

  useEffect(() => {
    api.reports.monthly(monthStr).then(r => setMonthlyData(r.data)).catch(() => {})
  }, [monthStr])

  function saveTarget() {
    const v = parseFloat(targetDraft)
    if (v > 0) { setTarget(v); localStorage.setItem('monthly_sales_target', String(v)) }
    setEditingTarget(false)
  }

  // ── Monthly derived values ──────────────────────────────────────────────────
  const revenue        = monthlyData?.revenue        ?? 0
  const orderCount     = monthlyData?.order_count    ?? 0
  const avgBill        = monthlyData?.avg_bill       ?? 0
  const customerCount  = monthlyData?.customer_count ?? 0
  const newCustomers   = monthlyData?.new_customers  ?? 0
  const pct            = target > 0 ? revenue / target : 0

  const genderItems: BarItem[] = (monthlyData?.gender ?? []).map((g: any) => ({
    label: GENDER_LABEL[g.gender] ?? g.gender,
    count: g.cnt,
    color: GENDER_COLOR[g.gender] ?? '#94a3b8',
  }))
  const genderTotal = genderItems.reduce((s, g) => s + g.count, 0)

  const ageMap: Record<string, number> = Object.fromEntries(
    (monthlyData?.age_groups ?? []).map((a: any) => [a.age_group, a.cnt])
  )
  const ageItems: BarItem[] = AGE_ORDER
    .map((k, i) => ({ label: AGE_LABEL[k], count: ageMap[k] ?? 0, color: AGE_COLOR[i] }))
    .filter(a => a.count > 0)
  const ageTotal = ageItems.reduce((s, a) => s + a.count, 0)

  // ── Year options ────────────────────────────────────────────────────────────
  const yearOptions = Array.from({ length: now.getFullYear() - 2022 }, (_, i) => now.getFullYear() - i)

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="h-8 w-32 bg-slate-100 rounded-lg animate-pulse mb-6" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">รายงาน</h1>
        <p className="text-slate-500 text-sm mt-0.5">ภาพรวมยอดขายและสถิติการขาย</p>
      </div>

      {/* ── Monthly Dashboard ─────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Month / Year selectors */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">สรุปรายเดือน</h2>
          <div className="flex items-center gap-2">
            <select
              value={selMonth}
              onChange={e => setSelMonth(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              {THAI_MONTHS.slice(1).map((label, i) => (
                <option key={i + 1} value={i + 1}>{label}</option>
              ))}
            </select>
            <select
              value={selYear}
              onChange={e => setSelYear(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Donut + KPIs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex gap-8 items-center">

            {/* Donut + target */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <DonutRing pct={pct} />
              {editingTarget ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={targetDraft}
                    onChange={e => setTargetDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveTarget()
                      if (e.key === 'Escape') setEditingTarget(false)
                    }}
                    onBlur={saveTarget}
                    autoFocus
                    min={1}
                    className="w-28 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button type="button" onClick={saveTarget}
                    className="text-slate-400 hover:text-slate-700">
                    <Check size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setTargetDraft(String(target)); setEditingTarget(true) }}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700"
                >
                  เป้า ฿{fmt(target)}
                  <Pencil size={10} />
                </button>
              )}
            </div>

            {/* KPI grid */}
            <div className="flex-1 grid grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-slate-400 mb-1">ยอดขาย</p>
                <p className="text-2xl font-bold text-slate-900">฿{fmt(Math.round(revenue))}</p>
                <p className="text-xs text-slate-400 mt-0.5">{orderCount} รายการ</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">เฉลี่ย/บิล</p>
                <p className="text-2xl font-bold text-slate-900">฿{fmt(Math.round(avgBill))}</p>
                <p className="text-xs text-slate-400 mt-0.5">unit price</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">ลูกค้า</p>
                <p className="text-2xl font-bold text-slate-900">{customerCount}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {newCustomers > 0
                    ? <span className="text-green-600 font-medium">+{newCustomers} ใหม่</span>
                    : 'คน'}
                  {newCustomers > 0 && customerCount - newCustomers > 0 && (
                    <span className="ml-1">· {customerCount - newCustomers} ประจำ</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">คงเหลือถึงเป้า</p>
                {pct >= 1 ? (
                  <p className="text-2xl font-bold text-green-600">บรรลุเป้า</p>
                ) : (
                  <p className="text-2xl font-bold text-slate-900">฿{fmt(Math.round(target - revenue))}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Demographics */}
        <div className="grid grid-cols-2 gap-4">
          <HorizBars title="เพศ" items={genderItems} total={genderTotal} />
          <HorizBars title="ช่วงอายุ" items={ageItems} total={ageTotal} />
        </div>
      </div>

      {/* ── Lifetime KPIs ─────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard highlight icon={<TrendingUp size={14} />} label="ยอดขายรวม (ตลอดเวลา)"
            value={`฿${fmt(summary.total_revenue)}`} sub={`${summary.total_orders} รายการ`} />
          <KpiCard icon={<CreditCard size={14} />} label="ชำระแล้ว" value={`฿${fmt(summary.total_paid)}`} />
          <KpiCard icon={<Clock size={14} />} label="ค้างชำระ" value={`฿${fmt(summary.outstanding)}`} />
          <KpiCard icon={<ShoppingBag size={14} />} label="เสร็จสิ้นแล้ว"
            value={`${summary.completed_orders}`} sub={`จาก ${summary.total_orders} รายการ`} />
        </div>
      )}

      {/* ── Sales Trend Chart ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-slate-900">แนวโน้มยอดขาย</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              {RANGES.map(r => (
                <button key={r.value} type="button" onClick={() => setRange(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    range === r.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {salesData.length > 0 && (
              <button type="button"
                onClick={() => downloadCSV(salesData, currentRange.group, range)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download size={12} />
                CSV
              </button>
            )}
          </div>
        </div>
        {salesData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">ไม่มีข้อมูลในช่วงเวลานี้</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={salesData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tickFormatter={p => fmtPeriod(p, currentRange.group)}
                tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `฿${fmt(v)}`}
                tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<CustomTooltip group={currentRange.group} />} />
              <Bar dataKey="revenue" name="ยอดขาย"   fill="#0f172a" radius={[4,4,0,0]} />
              <Bar dataKey="paid"    name="ชำระแล้ว" fill="#94a3b8" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Top 5 by Category ────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-amber-500" />
          <h2 className="font-semibold text-slate-900">5 อันดับขายดี</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <RankList
            title="กรอบ"
            icon={<Glasses size={14} className="text-slate-500" />}
            items={topCategories.frames.map(f => ({
              name: f.name,
              sub:  f.sku || f.barcode || '—',
              count: f.sold_count,
            }))}
            emptyText="ยังไม่มีข้อมูลการขายกรอบ"
          />
          <RankList
            title="เลนส์"
            icon={<Eye size={14} className="text-slate-500" />}
            items={topCategories.lenses.map(l => ({
              name: [l.brand, l.series].filter(Boolean).join(' ') || '—',
              sub:  [LENS_TYPE_LABEL[l.lens_type] ?? l.lens_type, l.lens_index ? `index ${l.lens_index}` : ''].filter(Boolean).join(' · '),
              count: l.sold_count,
            }))}
            emptyText="ยังไม่มีข้อมูลการใช้เลนส์"
          />
        </div>
      </div>

      {/* ── Profit (admin only) ───────────────────────────────────── */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-900">กำไร-ขาดทุน</h2>
              <p className="text-xs text-slate-400 mt-0.5">คำนวณจากต้นทุนรวม (เลนส์ + กรอบ + อื่นๆ) ต่อรายการขาย</p>
            </div>
          </div>
          {profitData.some((d: any) => d.pending_count > 0) && (
            <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="text-amber-500 text-sm mt-0.5">⚠</span>
              <p className="text-xs text-amber-700">
                มีรายการขายบางเดือนที่ยังไม่ได้กรอกต้นทุนครบ ตัวเลขกำไรในเดือนนั้นอาจสูงกว่าความเป็นจริง
                — ไปกรอกที่ <strong>ต้นทุนรอกรอก</strong> เพื่อให้ข้อมูลถูกต้อง
              </p>
            </div>
          )}
          {profitData.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">ไม่มีข้อมูลในช่วง 12 เดือนที่ผ่านมา</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={profitData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tickFormatter={p => fmtPeriod(p, 'month')}
                  tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `฿${fmt(v)}`}
                  tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip
                  formatter={(v, name) => [`฿${fmt(Number(v))}`, name as string]}
                  labelFormatter={p => fmtPeriod(p as string, 'month')}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="ยอดขาย" fill="#0f172a" radius={[4,4,0,0]} />
                <Bar dataKey="cost"    name="ต้นทุน"  fill="#e2e8f0" radius={[4,4,0,0]} />
                <Bar dataKey="profit"  name="กำไร"    fill="#22c55e" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  )
}
