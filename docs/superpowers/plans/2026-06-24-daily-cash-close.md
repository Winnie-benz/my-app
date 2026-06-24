# Daily Cash Close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มฟีเจอร์เปิด-ปิดกะรายวัน — สรุปยอดขายแยกตามวิธีจ่าย และตรวจเงินสดในลิ้นชัก (ตรง/ขาด/เกิน)

**Architecture:** ตารางใหม่ `daily_closes` (1 วัน 1 แถว, สถานะ open/closed). Backend route `dailyClose.ts` คำนวณยอดวันนี้จาก `payments` + `claim_payments` รวมกัน group ตาม method. Frontend หน้าเดียวแสดง UI ตามสถานะ + ประวัติ

**Tech Stack:** Express + better-sqlite3 + zod (backend), React + TypeScript + Tailwind v3 + Zustand (frontend) — ตาม stack เดิม

## Global Constraints

- TailwindCSS v3 เท่านั้น (ห้าม v4 syntax)
- ทุก `<button>` ที่ไม่ใช่ submit ต้องมี `type="button"`
- Sub-components ต้อง define นอก parent component (กัน input focus loss)
- ห้ามเพิ่ม comment เว้นแต่ logic ซับซ้อนจริง
- ห้ามเพิ่ม dependency ใหม่
- **Verification ของโปรเจกต์นี้** (ไม่มี test runner): `npx tsc --noEmit` ต้อง exit 0 + ทดสอบ runtime จริง (curl/เปิดแอป)
- วิธีจ่าย (method) มี 4 ค่า: `cash`, `transfer`, `card`, `qr`
- timestamp ใช้ `nowTH()` จาก `server/src/utils/time` (เวลาไทย +7), "วันนี้" = `nowTH().slice(0,10)` รูปแบบ `YYYY-MM-DD`
- API response format: `{ success: true, data: ... }` / error: `{ success: false, error: '...' }`

---

## Prerequisites (ทำก่อนเริ่ม Task 1)

ตอนนี้ working tree มีงาน Codex ค้างอยู่ ~18 ไฟล์ (รวม `server/src/index.ts` ที่ Task 2 ต้องแก้ด้วย) — **commit หรือ stash งาน Codex ให้เรียบร้อยก่อน** ไม่งั้น `git add server/src/index.ts` จะพ่วงงาน Codex ไปด้วย

ตรวจ: `git status --short` ควรสะอาด (หรือเหลือเฉพาะไฟล์ที่ไม่เกี่ยวข้องกับ plan นี้) ก่อนเริ่ม

---

## File Structure

| ไฟล์ | สร้าง/แก้ | หน้าที่ |
|------|---------|--------|
| `server/src/db/database.ts` | แก้ | เพิ่มตาราง `daily_closes` |
| `server/src/routes/dailyClose.ts` | สร้าง | 4 endpoints + ฟังก์ชันคำนวณยอด |
| `server/src/index.ts` | แก้ | register router |
| `src/services/api.ts` | แก้ | เพิ่ม namespace `dailyClose` |
| `src/pages/DailyClosePage.tsx` | สร้าง | หน้า UI 3 สถานะ + ประวัติ |
| `src/routes/index.tsx` | แก้ | เพิ่ม route `/daily-close` |
| `src/layouts/MainLayout.tsx` | แก้ | เพิ่มเมนู sidebar |

---

## Task 1: ตาราง `daily_closes`

**Files:**
- Modify: `server/src/db/database.ts` (เพิ่ม block `db.exec` ต่อท้ายกลุ่ม CREATE TABLE อื่นๆ)

**Interfaces:**
- Produces: ตาราง `daily_closes` ที่ Task 2 จะ query/insert

- [ ] **Step 1: เพิ่มตาราง** — แทรกบล็อกนี้ใน `server/src/db/database.ts` ต่อจาก `db.exec` ของตารางอื่น (เช่นหลัง `audit_logs`)

```ts
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_closes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    close_date     TEXT NOT NULL UNIQUE,
    status         TEXT NOT NULL DEFAULT 'open',
    opening_float  REAL NOT NULL DEFAULT 0,
    opened_by      TEXT NOT NULL DEFAULT '',
    opened_at      TEXT NOT NULL DEFAULT '',
    total_cash     REAL NOT NULL DEFAULT 0,
    total_transfer REAL NOT NULL DEFAULT 0,
    total_card     REAL NOT NULL DEFAULT 0,
    total_qr       REAL NOT NULL DEFAULT 0,
    total_sales    REAL NOT NULL DEFAULT 0,
    expected_cash  REAL NOT NULL DEFAULT 0,
    counted_cash   REAL NOT NULL DEFAULT 0,
    difference     REAL NOT NULL DEFAULT 0,
    note           TEXT NOT NULL DEFAULT '',
    closed_by      TEXT NOT NULL DEFAULT '',
    closed_at      TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL DEFAULT (datetime('now','+7 hours'))
  );
`)
```

- [ ] **Step 2: ตรวจ tsc** — Run: `cd server && npx tsc --noEmit` — Expected: exit 0 ไม่มี error

- [ ] **Step 3: ตรวจว่าตารางสร้างจริง** — Run: `cd server && npm run dev` (รอจน log ขึ้น "Server →") แล้วเปิดอีก terminal:
```bash
sqlite3 server/data/app.db ".tables" | tr ' ' '\n' | grep daily_closes
```
Expected: เห็นบรรทัด `daily_closes` (ถ้าใช้ Turso/ไฟล์ db ชื่ออื่น ให้ปรับ path — ดู `server/src/db/database.ts` ว่าเปิดไฟล์ไหน) จากนั้นหยุด server (Ctrl+C)

- [ ] **Step 4: Commit**
```bash
git add server/src/db/database.ts
git commit -m "feat(daily-close): add daily_closes table"
```

---

## Task 2: Backend API

**Files:**
- Create: `server/src/routes/dailyClose.ts`
- Modify: `server/src/index.ts` (import + register)

**Interfaces:**
- Consumes: ตาราง `daily_closes` (Task 1), ตาราง `payments` + `claim_payments` (มีคอลัมน์ `method`, `amount`, `paid_at`)
- Produces: 4 endpoints ใต้ `/api/daily-close` ที่ frontend (Task 3) เรียก:
  - `GET /today` → `{ date, status:'none'|'open'|'closed', totals:{cash,transfer,card,qr,total}, opening_float:number|null, suggested_float:number, expected_cash:number, close:row|null, unclosed_previous:string|null }`
  - `POST /open` body `{ opening_float:number, date?:string }`
  - `POST /close` body `{ counted_cash:number, opening_float?:number, note?:string, date?:string }`
  - `GET /history?limit=` → `{ data: row[] }`

- [ ] **Step 1: สร้างไฟล์ route** — Create `server/src/routes/dailyClose.ts`:

```ts
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import db from '../db/database'
import { requireAuth } from '../middleware/requireAuth'
import { nowTH } from '../utils/time'

const router = Router()
router.use(requireAuth)

function actorName(req: Request): string {
  const u = req.user
  if (!u) return ''
  return [u.nickname || u.first_name, u.last_name].filter(Boolean).join(' ') || u.user
}

function todayStr(): string {
  return nowTH().slice(0, 10)
}

type Totals = { cash: number; transfer: number; card: number; qr: number; total: number }

function computeTotals(date: string): Totals {
  const rows = db.prepare(`
    SELECT method, COALESCE(SUM(amount), 0) AS total
    FROM (
      SELECT method, amount, paid_at FROM payments
      UNION ALL
      SELECT method, amount, paid_at FROM claim_payments
    )
    WHERE substr(paid_at, 1, 10) = ?
    GROUP BY method
  `).all(date) as { method: string; total: number }[]

  const t: Totals = { cash: 0, transfer: 0, card: 0, qr: 0, total: 0 }
  for (const r of rows) {
    if (r.method === 'cash') t.cash = r.total
    else if (r.method === 'transfer') t.transfer = r.total
    else if (r.method === 'card') t.card = r.total
    else if (r.method === 'qr') t.qr = r.total
    t.total += r.total
  }
  return t
}

function lastFloat(): number {
  const row = db.prepare(`
    SELECT opening_float FROM daily_closes
    ORDER BY close_date DESC LIMIT 1
  `).get() as { opening_float: number } | undefined
  return row?.opening_float ?? 0
}

router.get('/today', (_req: Request, res: Response) => {
  const date = todayStr()
  const totals = computeTotals(date)
  const row = db.prepare('SELECT * FROM daily_closes WHERE close_date = ?').get(date) as any
  const suggested_float = lastFloat()
  const opening_float: number | null = row ? row.opening_float : null
  const expected_cash = (opening_float ?? suggested_float) + totals.cash

  const unclosed = db.prepare(`
    SELECT close_date FROM daily_closes
    WHERE status = 'open' AND close_date < ?
    ORDER BY close_date DESC LIMIT 1
  `).get(date) as { close_date: string } | undefined

  res.json({ success: true, data: {
    date,
    status: row ? row.status : 'none',
    totals,
    opening_float,
    suggested_float,
    expected_cash,
    close: row || null,
    unclosed_previous: unclosed?.close_date ?? null,
  }})
})

const openSchema = z.object({
  opening_float: z.number().min(0),
  date: z.string().optional(),
})

router.post('/open', (req: Request, res: Response) => {
  const parsed = openSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: 'opening_float ไม่ถูกต้อง' }); return }
  const date = parsed.data.date || todayStr()

  const existing = db.prepare('SELECT status FROM daily_closes WHERE close_date = ?').get(date) as any
  if (existing && existing.status === 'closed') {
    res.status(400).json({ success: false, error: 'วันนี้ปิดยอดไปแล้ว' }); return
  }

  db.prepare(`
    INSERT INTO daily_closes (close_date, status, opening_float, opened_by, opened_at)
    VALUES (?, 'open', ?, ?, ?)
    ON CONFLICT(close_date) DO UPDATE SET
      status = 'open', opening_float = excluded.opening_float,
      opened_by = excluded.opened_by, opened_at = excluded.opened_at
  `).run(date, parsed.data.opening_float, actorName(req), nowTH())

  const row = db.prepare('SELECT * FROM daily_closes WHERE close_date = ?').get(date)
  res.json({ success: true, data: row })
})

const closeSchema = z.object({
  counted_cash: z.number().min(0),
  opening_float: z.number().min(0).optional(),
  note: z.string().optional(),
  date: z.string().optional(),
})

router.post('/close', (req: Request, res: Response) => {
  const parsed = closeSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ success: false, error: 'ข้อมูลปิดยอดไม่ถูกต้อง' }); return }
  const date = parsed.data.date || todayStr()
  const existing = db.prepare('SELECT * FROM daily_closes WHERE close_date = ?').get(date) as any

  const totals = computeTotals(date)
  const opening_float = parsed.data.opening_float ?? (existing ? existing.opening_float : lastFloat())
  const expected_cash = opening_float + totals.cash
  const difference = parsed.data.counted_cash - expected_cash
  const note = parsed.data.note ?? ''

  db.prepare(`
    INSERT INTO daily_closes (
      close_date, status, opening_float, opened_by, opened_at,
      total_cash, total_transfer, total_card, total_qr, total_sales,
      expected_cash, counted_cash, difference, note, closed_by, closed_at
    ) VALUES (?, 'closed', ?, '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(close_date) DO UPDATE SET
      status = 'closed', opening_float = excluded.opening_float,
      total_cash = excluded.total_cash, total_transfer = excluded.total_transfer,
      total_card = excluded.total_card, total_qr = excluded.total_qr,
      total_sales = excluded.total_sales, expected_cash = excluded.expected_cash,
      counted_cash = excluded.counted_cash, difference = excluded.difference,
      note = excluded.note, closed_by = excluded.closed_by, closed_at = excluded.closed_at
  `).run(
    date, opening_float,
    totals.cash, totals.transfer, totals.card, totals.qr, totals.total,
    expected_cash, parsed.data.counted_cash, difference, note,
    actorName(req), nowTH(),
  )

  const row = db.prepare('SELECT * FROM daily_closes WHERE close_date = ?').get(date)
  res.json({ success: true, data: row })
})

router.get('/history', (req: Request, res: Response) => {
  const raw = Number(req.query.limit ?? 30)
  const limit = Number.isFinite(raw) ? Math.max(1, Math.min(100, Math.floor(raw))) : 30
  const rows = db.prepare(`
    SELECT * FROM daily_closes WHERE status = 'closed'
    ORDER BY close_date DESC LIMIT ?
  `).all(limit)
  res.json({ success: true, data: rows })
})

export default router
```

- [ ] **Step 2: Register router** — ใน `server/src/index.ts` เพิ่ม import กับ route อื่นๆ:
```ts
import dailyCloseRouter from './routes/dailyClose'
```
แล้วเพิ่มบรรทัด register ในกลุ่ม `app.use('/api/...', ...)`:
```ts
app.use('/api/daily-close', dailyCloseRouter)
```

- [ ] **Step 3: ตรวจ tsc** — Run: `cd server && npx tsc --noEmit` — Expected: exit 0

- [ ] **Step 4: ทดสอบ API จริงด้วย curl** — เปิด backend (`cd server && npm run dev`), ขอ token ก่อน (ใช้ user/pass จริงของร้าน):
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<USER>","password":"<PASS>"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# 1) ดูสถานะวันนี้ (ยังไม่เปิด)
curl -s http://localhost:3001/api/daily-close/today -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# Expected: status="none", totals มี cash/transfer/card/qr/total, suggested_float=0

# 2) เปิดร้าน
curl -s -X POST http://localhost:3001/api/daily-close/open -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"opening_float":2000}' | python3 -m json.tool
# Expected: data.status="open", data.opening_float=2000

# 3) ปิดยอด
curl -s -X POST http://localhost:3001/api/daily-close/close -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"counted_cash":2500}' | python3 -m json.tool
# Expected: data.status="closed", difference = 2500 - (2000 + total_cash)

# 4) ประวัติ
curl -s http://localhost:3001/api/daily-close/history -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# Expected: array มีแถววันนี้ status="closed"
```
หยุด server เมื่อตรวจเสร็จ

- [ ] **Step 5: Commit**
```bash
git add server/src/routes/dailyClose.ts server/src/index.ts
git commit -m "feat(daily-close): backend open/close/today/history endpoints"
```

---

## Task 3: Frontend (api client + หน้า + เมนู)

**Files:**
- Modify: `src/services/api.ts` (เพิ่ม namespace `dailyClose`)
- Create: `src/pages/DailyClosePage.tsx`
- Modify: `src/routes/index.tsx` (เพิ่ม route)
- Modify: `src/layouts/MainLayout.tsx` (เพิ่มเมนู)

**Interfaces:**
- Consumes: endpoints จาก Task 2
- Produces: หน้า `/daily-close` ใช้งานได้ในเบราว์เซอร์

- [ ] **Step 1: เพิ่ม api client** — ใน `src/services/api.ts` เพิ่ม namespace นี้ในอ็อบเจกต์ `api` (วางใกล้ namespace อื่น เช่นหลัง `admin`):
```ts
  dailyClose: {
    today:   () => req<{ data: any }>('/daily-close/today'),
    open:    (opening_float: number) =>
      req<{ data: any }>('/daily-close/open', { method: 'POST', body: JSON.stringify({ opening_float }) }),
    close:   (body: { counted_cash: number; opening_float?: number; note?: string }) =>
      req<{ data: any }>('/daily-close/close', { method: 'POST', body: JSON.stringify(body) }),
    history: (limit = 30) => req<{ data: any[] }>(`/daily-close/history?limit=${limit}`),
  },
```

- [ ] **Step 2: สร้างหน้า** — Create `src/pages/DailyClosePage.tsx`:

```tsx
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
```

- [ ] **Step 3: เพิ่ม route** — ใน `src/routes/index.tsx` เพิ่ม import + route object ตาม pattern เดิม (ดูตัวอย่าง `UsersPage`):
```tsx
import DailyClosePage from '../pages/DailyClosePage'
```
เพิ่มใน children ของ MainLayout:
```tsx
{ path: 'daily-close', element: <DailyClosePage /> },
```

- [ ] **Step 4: เพิ่มเมนู sidebar** — ใน `src/layouts/MainLayout.tsx`:
  - เพิ่ม `Calculator` ในบรรทัด import จาก `lucide-react`
  - เพิ่ม item ในกลุ่ม `'ลูกค้า'` ของ `BASE_NAV_GROUPS` (ทุกคนเห็นได้):
```tsx
{ to: '/daily-close', label: 'ปิดยอดรายวัน', icon: Calculator },
```

- [ ] **Step 5: ตรวจ tsc** — Run: `npx tsc --noEmit` (จาก root) — Expected: exit 0

- [ ] **Step 6: ทดสอบในเบราว์เซอร์** — Run: `npm run dev:all` → เปิด `http://localhost:5173` → login → คลิกเมนู "ปิดยอดรายวัน"
  - Expected: เห็นการ์ดสรุปยอด 5 ใบ + กล่อง "เปิดร้าน"
  - กรอกเงินตั้งต้น → กด "เปิดร้าน" → กล่องเปลี่ยนเป็น "ปิดยอด"
  - กรอกเงินนับได้ → เห็นส่วนต่างขึ้นสี (ตรง/ขาด/เกิน) → กด "บันทึกปิดยอด" → เปลี่ยนเป็น "ปิดยอดแล้ว" + แถวขึ้นในประวัติ

- [ ] **Step 7: Commit**
```bash
git add src/services/api.ts src/pages/DailyClosePage.tsx src/routes/index.tsx src/layouts/MainLayout.tsx
git commit -m "feat(daily-close): UI page, api client, route, sidebar menu"
```

---

## หมายเหตุ deploy

หลังจบทั้ง 3 task แล้ว push → GitHub Actions จะ auto-deploy ขึ้น Render เอง (workflow ที่ตั้งไว้แล้ว) ไม่ต้องกด Manual Deploy
