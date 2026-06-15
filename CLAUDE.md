# Optical Shop Management System

## Project Overview
ระบบจัดการร้านแว่นตา — Single-page web application สำหรับใช้ภายในร้าน
- ร้านเดียว, พนักงานไม่เกิน 10 คน
- ใช้งานบน PC เป็นหลัก (browser)
- เริ่มจาก local server, อนาคตขึ้น cloud server
- ข้อมูลเริ่มจาก 0 (ไม่มี legacy data)

---

## Tech Stack

### Frontend
- React 18 + Vite 5 + TypeScript
- TailwindCSS v3 (ห้ามใช้ v4)
- Zustand v5 (state management)
- React Router v6 (createBrowserRouter)
- React Hook Form v7 + Zod (forms & validation)
- Lucide React (icons)

### Backend
- Node.js + Express.js
- JWT authentication (jsonwebtoken + bcryptjs)
- SQLite via better-sqlite3 (Phase 2+) — ปัจจุบันยังเป็น localStorage
- Google Apps Script Web App (employee authentication only)

### Dev Tools
- concurrently (run frontend + backend together)
- ts-node-dev (backend hot reload)
- Vite proxy: `/api` → `localhost:3001`

---

## Design System
- **Theme:** Minimal, clean — สี slate-900 (dark) / white / slate-50 (background)
- **Layout:** Left sidebar (w-56) + main content area
- **Border radius:** rounded-xl / rounded-2xl
- **Typography:** text-sm เป็นหลัก, labels เป็น text-xs
- **Buttons:** bg-slate-900 text-white (primary), border border-slate-200 (secondary)
- ห้ามใช้ emojis ใน UI เว้นแต่จะได้รับการยืนยัน

---

## User Roles
| Role  | คือใคร | สิทธิ์ |
|-------|--------|--------|
| admin | เจ้าของร้าน | เข้าถึงได้ทุกอย่าง รวมถึงรายงานและตั้งค่า |
| staff | พนักงาน | จัดการลูกค้า สินค้า คำสั่งซื้อ แต่ไม่เห็นรายงานกำไร |

---

## Business Rules (สำคัญ — อ่านก่อนเขียน code)

### Sale Flow
1. ลูกค้าเลือกกรอบ / วัดสายตา / เลือกเลนส์ (ลำดับสลับได้)
2. กรอกข้อมูลในระบบ: ข้อมูลลูกค้า + ค่าสายตา + รายการสินค้า
3. ชำระเงิน: จ่ายเต็ม หรือ **มัดจำ + ค้างจ่าย** ก็ได้
4. รอรับสินค้า (มีวันนัดรับ)
5. รับสินค้า + ชำระส่วนที่เหลือ (ถ้ามี)

### Payment
- รับทุกรูปแบบ: เงินสด, โอนธนาคาร, บัตรเครดิต/เดบิต, QR Code
- รองรับการมัดจำ (deposit) + ค้างจ่าย (remaining balance)
- ยังไม่มีการออกใบกำกับภาษี (รอจดทะเบียนภาษี)
- ออกได้เฉพาะ **ใบเสร็จรับเงิน** (export PDF)

### Stock
- เมื่อมีการขาย → หักลบ stock อัตโนมัติ (ผ่าน barcode)
- แจ้งเตือนเมื่อสินค้าเหลือน้อย (threshold กำหนดได้)

---

## Project Structure
```
my-app/
├── src/
│   ├── types/           product.ts, customer.ts, auth.ts
│   ├── mock/            products.ts, customers.ts
│   ├── store/           useProductStore.ts, useCustomerStore.ts, useAuthStore.ts
│   ├── hooks/           useAuth.ts, useStockFilter.ts, useCustomerFilter.ts
│   ├── services/        api.ts
│   ├── utils/           stockCalc.ts, customerUtils.ts
│   ├── components/
│   │   ├── customers/   CustomerForm, CustomerTable, PurchaseCard, PurchaseForm
│   │   ├── Badge.tsx, StockTable.tsx, StockMovementModal.tsx
│   │   └── ProtectedRoute.tsx
│   ├── pages/           LoginPage, StockPage, StockCheckPage, LowStockPage,
│   │                    ProductDetailPage, CustomersPage, CustomerDetailPage,
│   │                    DashboardPage
│   ├── layouts/         MainLayout.tsx (sidebar)
│   └── routes/          index.tsx
├── server/
│   ├── src/
│   │   ├── routes/      auth.ts
│   │   ├── services/    sheetsService.ts
│   │   ├── middleware/  requireAuth.ts
│   │   └── utils/       jwt.ts, hashPassword.ts
│   └── .env
└── public/
    └── apps-script-auth.js
```

---

## Run Commands
```bash
# Run everything (recommended)
cd /Users/benz/my-app && npm run dev:all

# Frontend only  →  localhost:5173
cd /Users/benz/my-app && npm run dev

# Backend only   →  localhost:3001
cd /Users/benz/my-app/server && npm run dev

# TypeScript check (run before reporting done)
cd /Users/benz/my-app && npx tsc --noEmit
```

---

## Phases

### ✅ Phase 1 — Core Foundation (เสร็จแล้ว)
- [x] Login system (JWT + Google Apps Script + bcrypt)
- [x] Inventory management (stock in/out, barcode, avg cost)
- [x] Stock check page (scanner mode)
- [x] Low stock alert page
- [x] Product detail page
- [x] Customer registration & CRUD
- [x] Purchase records (ค่าสายตา + เลนส์ + กรอบ + ราคา + นัดรับ)
- [x] Left sidebar layout + Dashboard

### ✅ Phase 2 — Database Migration (เสร็จแล้ว)
- [x] ติดตั้ง better-sqlite3 ใน backend
- [x] Schema: customers, purchases, products, payments, lens_products, lens_variants
- [x] REST API endpoints ครบทุก entity
- [x] Frontend เปลี่ยนจาก Zustand localStorage → API calls

### ✅ Phase 3 — Order & Payment System (เสร็จแล้ว)
- [x] ชำระเงิน: เต็มจำนวน / มัดจำ / ค้างจ่าย
- [x] Payment status: pending, partial, paid
- [x] ประวัติการชำระเงินต่อ order
- [x] Order status workflow: waiting → arrived → cutting → ready → completed
- [x] Lens variant inventory (matrix SPH×CYL, early stock deduction)
- [x] Print ใบเสร็จรับเงิน (browser print)
- [x] Orders page พร้อม search + filter

### ✅ Phase B — Barcode Label Printing (เสร็จแล้ว)
- [x] ติดตั้ง jsbarcode
- [x] สร้าง src/utils/printBarcodeLabel.ts (canvas → PNG → print window)
- [x] ปุ่ม "Label" + qty selector บน ProductDetailPage
- [x] ปุ่ม Printer icon (hover) บนแต่ละแถวใน StockTable (พิมพ์ 1 ใบทันที)
- [x] ดูย้อนหลัง: ใช้ ProductDetailPage/StockPage (barcode อยู่ในระบบตลอด)

### ✅ Phase C — Lens System Completion (เสร็จแล้ว)
- [x] **C1** Lens avg cost: stock in/out tracking per variant (lens_variant_movements table, weighted avg cost)
- [x] **C2** Matrix UI: StockInModal (รับเข้า + แก้ต้นทุนโดยตรง) แทน CostModal
- [x] **C3** Lens stock check: ปุ่มตรวจนับ → LensStockCheckModal → inventory_sessions (session_type='lens') → badge ใน InventoryHistoryPage

### 📋 Phase D — Operations & Quality of Life
- [ ] Order notes field (หมายเหตุพิเศษต่อ purchase)
- [ ] Scheduled daily backup (cron บน server)
- [ ] Session timeout warning (แจ้งเตือนก่อน JWT หมด 5 นาที)
- [ ] Shop name config (ตั้งค่าชื่อร้าน แสดงบนใบเสร็จ)

### 📋 Phase 4 — Reports & Analytics
- [ ] Dashboard ยอดขายรายวัน / รายเดือน
- [ ] สินค้าขายดี Top 10
- [ ] รายงานกำไร-ขาดทุน (admin only)
- [ ] กราฟ (recharts)

### 📋 Phase 5 — Deployment
- [ ] Cloud hosting: Railway / DigitalOcean (~$5-7/เดือน)
- [ ] Environment variables บน server
- [ ] SQLite backup strategy

---

## Coding Rules
1. ห้ามเพิ่ม feature เกินกว่าที่ถูกขอในแต่ละ task
2. ห้ามเพิ่ม comment ใน code เว้นแต่ logic ซับซ้อนจริงๆ
3. ใช้ TailwindCSS v3 เท่านั้น — ห้ามใช้ v4 syntax
4. รัน `npx tsc --noEmit` ให้ผ่านก่อนเสมอ
5. Sub-components ต้อง define นอก parent component เสมอ (ป้องกัน input focus loss)
6. ทุก `<button>` ที่ไม่ใช่ submit ต้องมี `type="button"`
7. ไม่ต้องสร้างไฟล์ README หรือ documentation เพิ่มเติม

---

## Known Issues / Tech Debt
- ข้อมูล products, customers, purchases ยังเก็บใน localStorage → หายเมื่อล้าง browser → แก้ใน Phase 2
- Google Apps Script token ต้องตรงกันระหว่าง deployed script กับ server/.env

---

## Environment
```
server/.env:
  APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
  APPS_SCRIPT_TOKEN=...
  JWT_SECRET=...
  JWT_EXPIRES_IN=8h
  PORT=3001
  NODE_ENV=development
  CORS_ORIGIN=http://localhost:5173
```
