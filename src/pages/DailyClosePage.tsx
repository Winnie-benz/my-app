import { useEffect, useState } from 'react'
import { Wallet, Lock, Unlock, AlertTriangle } from 'lucide-react'
import { api } from '../services/api'
import { notify } from '../utils/notify'

const METHOD_LABEL: Record<string, string> = {
  cash: 'เงินสด', transfer: 'โอน', card: 'บัตร', qr: 'QR',
}

function baht(n: number): string {
  return `฿${(n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 0 })}`
}

interface Totals { cash: number; transfer: number; card: number; qr: number; total: number }
interface TodayData {
  date: string
  status: 'none' | 'open' | 'closed'
  totals: Totals
  opening_float: number | null
  suggested_float: number
  expected_cash: number
  close: any | null
  unclosed_previous: string | null
}

function SummaryCards({ totals }: { totals: Totals }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {(['cash', 'transfer', 'card', 'qr'] as const).map(k => (
        <div key={k} className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400">{METHOD_LABEL[k]}</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{baht(totals[k])}</p>
        </div>
      ))}
      <div className="bg-slate-900 rounded-xl p-4">
        <p className="text-xs text-slate-300">รวมทั้งวัน</p>
        <p className="text-lg font-semibold text-white mt-1">{baht(totals.total)}</p>
      </div>
    </div>
  )
}

function HistoryTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">ยังไม่มีประวัติปิดยอด</p>
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs">
          <tr>
            <th className="text-left px-4 py-2">วันที่</th>
            <th className="text-right px-4 py-2">ยอดรวม</th>
            <th className="text-right px-4 py-2">เงินสดควรมี</th>
            <th className="text-right px-4 py-2">นับได้</th>
            <th className="text-right px-4 py-2">ส่วนต่าง</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-4 py-2">{r.close_date}</td>
              <td className="px-4 py-2 text-right">{baht(r.total_sales)}</td>
              <td className="px-4 py-2 text-right">{baht(r.expected_cash)}</td>
              <td className="px-4 py-2 text-right">{baht(r.counted_cash)}</td>
              <td className={`px-4 py-2 text-right font-medium ${r.difference === 0 ? 'text-slate-500' : r.difference < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                {r.difference > 0 ? '+' : ''}{baht(r.difference)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DailyClosePage() {
  const [data, setData] = useState<TodayData | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [floatInput, setFloatInput] = useState('')
  const [countedInput, setCountedInput] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [t, h] = await Promise.all([api.dailyClose.today(), api.dailyClose.history()])
      setData(t.data)
      setHistory(h.data)
      setFloatInput(String(t.data.opening_float ?? t.data.suggested_float ?? 0))
    } catch (e: any) {
      notify('error', e?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleOpen() {
    setBusy(true)
    try {
      await api.dailyClose.open(Number(floatInput) || 0)
      notify('success', 'เปิดร้านแล้ว')
      await load()
    } catch (e: any) {
      notify('error', e?.message || 'เปิดร้านไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function handleClose() {
    setBusy(true)
    try {
      await api.dailyClose.close({
        counted_cash: Number(countedInput) || 0,
        opening_float: Number(floatInput) || 0,
        note,
      })
      notify('success', 'ปิดยอดแล้ว')
      setCountedInput(''); setNote('')
      await load()
    } catch (e: any) {
      notify('error', e?.message || 'ปิดยอดไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !data) return <div className="p-8 text-sm text-slate-400">กำลังโหลด...</div>

  const expectedCash = (Number(floatInput) || 0) + data.totals.cash
  const diff = (Number(countedInput) || 0) - expectedCash

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Wallet size={20} className="text-slate-700" />
        <h1 className="text-xl font-semibold text-slate-900">ปิดยอดรายวัน</h1>
        <span className="text-sm text-slate-400">{data.date}</span>
      </div>

      {data.unclosed_previous && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} />
          วันที่ {data.unclosed_previous} ยังไม่ได้ปิดยอด
        </div>
      )}

      <SummaryCards totals={data.totals} />

      {data.status === 'none' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Unlock size={16} /> เปิดร้าน</h2>
          <label className="block text-xs text-slate-500">เงินตั้งต้นในลิ้นชัก (บาท)</label>
          <input type="number" value={floatInput} onChange={e => setFloatInput(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
          <button type="button" onClick={handleOpen} disabled={busy}
            className="bg-slate-900 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50">
            เปิดร้าน
          </button>
        </div>
      )}

      {data.status === 'open' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Lock size={16} /> ปิดยอด</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-xs text-slate-500">เงินตั้งต้น</label>
              <input type="number" value={floatInput} onChange={e => setFloatInput(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-slate-500">เงินสดนับได้จริง</label>
              <input type="number" value={countedInput} onChange={e => setCountedInput(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2" />
            </div>
          </div>
          <div className="flex justify-between text-sm border-t border-slate-100 pt-3">
            <span className="text-slate-500">เงินสดที่ควรมี (ตั้งต้น + ขายสด)</span>
            <span className="font-medium">{baht(expectedCash)}</span>
          </div>
          {countedInput !== '' && (
            <div className={`flex justify-between text-sm font-semibold ${diff === 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-amber-600'}`}>
              <span>{diff === 0 ? 'ตรงพอดี' : diff < 0 ? 'ขาด' : 'เกิน'}</span>
              <span>{diff > 0 ? '+' : ''}{baht(diff)}</span>
            </div>
          )}
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="หมายเหตุ (ถ้าเงินไม่ตรง)"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" rows={2} />
          <button type="button" onClick={handleClose} disabled={busy || countedInput === ''}
            className="bg-slate-900 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50">
            บันทึกปิดยอด
          </button>
        </div>
      )}

      {data.status === 'closed' && data.close && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2 text-sm">
          <h2 className="font-semibold text-slate-900 mb-2">ปิดยอดแล้ว</h2>
          <div className="flex justify-between"><span className="text-slate-500">เงินตั้งต้น</span><span>{baht(data.close.opening_float)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">เงินสดที่ควรมี</span><span>{baht(data.close.expected_cash)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">นับได้จริง</span><span>{baht(data.close.counted_cash)}</span></div>
          <div className={`flex justify-between font-semibold ${data.close.difference === 0 ? 'text-emerald-600' : data.close.difference < 0 ? 'text-red-600' : 'text-amber-600'}`}>
            <span>ส่วนต่าง</span><span>{data.close.difference > 0 ? '+' : ''}{baht(data.close.difference)}</span>
          </div>
          {data.close.note && <p className="text-slate-500 pt-2">หมายเหตุ: {data.close.note}</p>}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="font-semibold text-slate-900 text-sm">ประวัติปิดยอด</h2>
        <HistoryTable rows={history} />
      </div>
    </div>
  )
}
