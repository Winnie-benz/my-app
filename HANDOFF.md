# HANDOFF — สถานะงานล่าสุด (sync ข้ามเครื่อง Air ↔ Pro ผ่าน git)

> ไฟล์นี้คือ "สมุดส่งงาน" ระหว่างสองเครื่อง / ข้ามแชต
> - Claude บนเครื่องไหน/แชตไหนก็ **อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง**
> - อัปเดตไฟล์นี้ทุกครั้ง **เมื่อจบงาน** ก่อน push

---

## วิธีใช้ (ผู้ใช้)

| ขั้นตอน | คำสั่ง |
|---------|--------|
| เริ่มงาน | `cd ~/my-app && git pull && npm run dev:all` |
| จบงาน | `git add . && git commit -m "..." && git push` |

---

## 🚨 อัปเดตล่าสุด: 2026-06-25 — Fix กราฟปีผิด + ย้ายเครื่อง Air → Pro

### ✅ งานที่เสร็จในรอบนี้

1. **fix(reports): แก้สูตรคำนวณปีในกราฟ** (commit `4fc060a`, live)
   - เดิม: `parseInt(y) - 2500 + 43` → ได้ `-431` (ผิด)
   - แก้เป็น: `String(parseInt(y)).slice(-2)` → ได้ `26` (ถูก)
   - แก้ใน `fmtPeriod()` ใน [src/pages/ReportsPage.tsx](src/pages/ReportsPage.tsx)
   - โค้ดนี้ Codex แก้ไว้ใน working tree แต่ไม่ได้ commit → Claude commit + push ให้

### 📌 ไม่มีงานค้าง — พร้อมเริ่ม feature ใหม่

### 🖥️ ย้ายเครื่อง Air → Pro (ทำบน Pro ก่อนเริ่มงาน)
```bash
# 1. clone repo
cd ~ && git clone https://github.com/Winnie-benz/my-app.git my-app
cd my-app && npm install
cd server && npm install && cd ..

# 2. สร้าง server/.env (ดูค่าจาก Air: cat ~/my-app/server/.env)
nano ~/my-app/server/.env

# 3. ติดตั้ง Claude Code
npm install -g @anthropic-ai/claude-code

# 4. ติดตั้ง Skills
git clone --depth 1 https://github.com/obra/superpowers.git ~/.claude/superpowers
mkdir -p ~/.claude/skills
cp -R ~/.claude/superpowers/skills/* ~/.claude/skills/

# 5. ติดตั้ง Codex
npm install -g @openai/codex

# 6. รัน
npm run dev:all
```

---

## อัปเดตก่อนหน้า: 2026-06-25 — Pagination + Version system (deploy ✅)

### ✅ งานที่เสร็จในรอบนี้

1. **Pagination 20/หน้า ทุกหน้า list ที่ยาว** (commit `9192294`, live)
   - สร้าง `src/hooks/usePagedList.ts` + `src/components/Pagination.tsx` (shared)
   - ใช้ใน: สินค้า, ลูกค้า, Orders, เคลม, ค้างชำระ, ต้นทุนรอกรอก, สินค้าเลนส์ (sidebar), ประวัติตรวจนับ
   - `OutstandingPage` มี 2 pager อิสระ: purchases + claims
   - Pagination ซ่อนอัตโนมัติเมื่อข้อมูล ≤ 20 รายการ (totalPages ≤ 1 → return null)
   - search/filter ยังทำงานปกติ — page reset เองเมื่อ filter ทำให้ total น้อยลง

2. **Auto version ในหน้า Settings** (commit `3495d9f`, live)
   - แสดง `v1.0.0 · <git-hash 7 ตัว> · YYYY-MM-DD` (inject ตอน build ผ่าน Vite `define`)
   - Render ใช้ `RENDER_GIT_COMMIT` env var; local ใช้ `git rev-parse --short HEAD`
   - version bump `0.1.0` → `1.0.0` ใน package.json

3. **Codex — normalize alias + ReportsPage**: Codex เสร็จและ push แยกแล้ว

### ✅ Deploy ยืนยัน
- bundle hash: `index-CK9mOFoR.js` live บน `https://my-app-gjmf.onrender.com`
- tsc root + server ผ่าน, npm run build ผ่าน

### 📌 ไม่มีงานค้าง — พร้อมเริ่ม feature ใหม่

---

## อัปเดตก่อนหน้า: 2026-06-24 (รอบดึก) — Codex / local workspace

### ✅ Phase ถัดไปทำเสร็จแล้วในเครื่องนี้ — **push แล้วโดย Claude (รวมกับ 2 ฟีเจอร์ใหม่ ดูด้านล่าง)**

**งานที่เสร็จในรอบนี้:**

1. **Lens brand dropdown ในฟอร์มบันทึกการซื้อ**
   - เพิ่ม field `lens.brand` ใน purchase data
   - ใช้รายชื่อยี่ห้อเป็น dropdown ตามรายการล่าสุด: Essilor, Hoya, Nikon, Rodenstock, TOG, HITOP, Zeiss
   - normalize alias เก่า `Essi` → `Essilor` เพื่อให้ stock เก่ากับ dropdown ใหม่แมทกัน
   - ถ้าเลือกเลนส์แบบ `stock_store` จาก lens picker ระบบจะเติมยี่ห้อให้อัตโนมัติ
   - dropdown สีม่วงของ `สต็อกเลนส์ (ตัดอัตโนมัติ)` filter ตามยี่ห้อที่เลือก เช่นเลือก Hoya จะแสดงเฉพาะ stock lens ของ Hoya
   - ถ้าเปลี่ยนยี่ห้อหลังเลือก stock lens ไว้ ระบบจะเคลียร์สินค้า/ค่าสายตาที่ไม่ตรงยี่ห้อให้
   - รองรับทั้ง create + edit
   - รายชื่อยี่ห้อถูกย้ายไปใช้ shared constant เดียวกันที่ `src/constants/lensBrands.ts`

2. **สินค้าเลนส์ — เปลี่ยนช่องยี่ห้อเป็น dropdown ชุดเดียวกัน**
   - หน้า `/lens-products` modal เพิ่ม/แก้ไขสินค้าเลนส์ เปลี่ยน `ยี่ห้อ *` จาก text input เป็น dropdown
   - ใช้รายการเดียวกับฟอร์มบันทึกการซื้อ
   - เปลี่ยน `ประเภทเลนส์` เป็น dropdown: Single vision, PAL, Bifocal
   - เปลี่ยน `Index` เป็น dropdown: 1.50, 1.56, 1.60, 1.67, 1.74
   - ถ้า edit สินค้าเก่าที่มียี่ห้อนอกลิสต์ ระบบยังแสดงค่านั้นใน dropdown เพื่อไม่ให้ข้อมูลเดิมหาย

3. **รายงานรายเดือน — เพิ่มกราฟ `ยี่ห้อเลนส์ขายดี`**
   - `/reports/monthly` คืน `lens_brand_breakdown`
   - หน้า `/reports` แสดงกราฟใหม่ต่อจาก “ชนิดเลนส์ที่ขาย”
   - query ใช้ `lens_data.brand` เป็นหลัก และ fallback ไปที่ brand จาก `lens_variant`/`lens_product` สำหรับรายการเก่าแบบ stock lens

4. **แสดงยี่ห้อเลนส์ในจุดที่เกี่ยวข้อง**
   - Purchase card
   - ใบเสร็จ

5. **Verify แล้ว**
   - `npx tsc --noEmit` ที่ root ผ่าน
   - `npx tsc --noEmit` ที่ `server/` ผ่าน
   - `npm run build` ที่ root ผ่าน
   - `npm run build` ที่ `server/` ผ่าน
   - หลังปรับ dropdown เป็น 7 ยี่ห้อตามรายการล่าสุด รัน `npx tsc --noEmit` + `npm run build` ที่ root ผ่านอีกครั้ง
   - หลังเพิ่ม dropdown หน้า `สินค้าเลนส์` รัน `npx tsc --noEmit` + `npm run build` ที่ root ผ่านอีกครั้ง
   - หลังเพิ่ม dropdown `ประเภทเลนส์` + `Index` หน้า `สินค้าเลนส์` รัน `npx tsc --noEmit` + `npm run build` ที่ root ผ่านอีกครั้ง
   - หลัง filter dropdown stock lens ตามยี่ห้อในฟอร์มขาย รัน `npx tsc --noEmit` + `npm run build` ที่ root ผ่านอีกครั้ง
   - หลังเพิ่ม alias `Essi` → `Essilor` รัน `npx tsc --noEmit` + `npm run build` ที่ root ผ่านอีกครั้ง
   - dev server มีอยู่แล้ว 1 ชุด: `http://localhost:5173` ได้ 200 และ `http://localhost:3001/api/health` ได้ 200
   - browser click-through ผ่าน local app จริงแล้วด้วย session ของผู้ใช้:
     เปิด `/customers` → ลูกค้าคนแรก → `บันทึกการซื้อ` → เปิดส่วนเลนส์ → เลือก `Stock (หน้าร้าน)` → เลือก brand
   - ผลที่ยืนยันจาก UI จริง:
     `ยี่ห้อเลนส์` dropdown ไม่มี `Essi`, มี `Essilor`
   - เลือก `Hoya` แล้ว dropdown สีม่วงแสดงเฉพาะ `Hoya Hilux (1.50)` และ `Hoya Nulux`
   - เลือก `Essilor` แล้ว dropdown สีม่วงแสดงเฉพาะ `Essilor Varilux (1.60)`
   - เปลี่ยน brand หลังจากเลือก stock lens แล้ว picker ถูกล้างตามคาด
   - รัน SQL breakdown ใหม่ผ่าน `server/dist` + `server/.env` กับ Turso จริงแล้ว ได้ผลลัพธ์เดือน `2026-06` ออกมาเป็น sample brand เช่น `Essi`, `Hoya`

### ✅ ปิดงานโดย Claude (รอบถัดมา) — push 5 commits ทีเดียว
รวมงาน Codex (ยี่ห้อเลนส์) + cleanup + 2 ฟีเจอร์ใหม่ ขึ้น live รอบเดียว:
- **(Codex) ยี่ห้อเลนส์**: dropdown ฟอร์มขาย + หน้าสินค้าเลนส์ + กราฟยี่ห้อขายดี + filter stock lens ตามยี่ห้อ — ผ่าน code-review (ไม่พบ bug; flow ครบผ่าน `z.record` → `lens_data.$.brand` → report)
- **ลบ `.github/workflows/keep-alive.yml`** (ซ้ำซ้อนกับ cron-job.org)
- **(ใหม่) ปุ่มซ่อนจากแจ้งเตือน Low Stock**: column `low_stock_ignored` (products + lens_variants) + endpoint toggle + GET ignored-list; LowStockPage มีปุ่มซ่อนต่อแถว (สินค้า+เลนส์) + ส่วน "ซ่อนแล้ว" พับได้ เปิดกลับได้
- **(ใหม่) รายการที่ถูกลบใน Settings**: ช่องค้นหา + แสดง 5 ดูเพิ่มทีละ 5 (กันหน้า scroll ยาวเมื่อข้อมูลสะสม)
- verify: `tsc` root+server ผ่าน, `npm run build` ผ่าน, SQL logic ของ low-stock ทดสอบบน **throwaway DB (libsql local) 11/11 ผ่าน** — ไม่แตะ Turso live
- ⚠️ migration `low_stock_ignored` จะ ALTER บน Turso live ตอน deploy boot (additive + idempotent + try/catch ปลอดภัย)

### ✅ รอบล่าสุด (Claude) — follow-ups + runtime verify
- **ปุ่มลบสินค้าจากแจ้งเตือน Low Stock** (soft-delete + confirm, เฉพาะสินค้าทั่วไป) + **fix badge count ทุกจุด** (sidebar/stock/dashboard) ให้ข้าม `low_stock_ignored` — พบ bug นี้จาก code-review (สกิล)
- **ย่อ audit log** แสดง 8 (จาก 30) + โหลดเพิ่มได้
- **(Codex) normalize alias `Essi` → `Essilor`** ทุกจุด read/write/compare — Codex spot-check บน UI จริงแล้ว
- **runtime verify (สกิล verify)**: รัน backend local + ยิง API socket จริงบน **throwaway DB** (safety-gated, ไม่แตะ Turso live) — products + lens: hide/un-hide/delete ผ่านครบ
- push + deploy ขึ้น live ครบ (ยืนยัน bundle hash เปลี่ยน + GH Action success)

### 📌 ยังเหลือ (ทำต่อได้)
- ปุ่มซ่อน/ลบ Low Stock ยังไม่ได้กดบน browser จริง (verify ผ่าน API socket แทน — local/live ใช้ Turso เดียวกัน เลี่ยงเขียน junk); dropdown ยี่ห้อ Codex ยืนยัน UI แล้ว

---

## อัปเดตก่อนหน้า: 2026-06-24 (รอบเย็น) — เครื่อง Air

### ✅ ทุกอย่าง push + deploy ขึ้น live แล้ว — branch ตรงกับ origin (0 ahead), commit `a25b2a9`

**งานที่เสร็จในรอบนี้ (เรียงตามลำดับ):**

1. **Codex auth overhaul (cookie) + daily-close + keep-alive** — push 5 commits ขึ้น live
   - ยืนยัน deploy สำเร็จผ่าน `/api/health` = 200
   - ปุ่ม "แก้ไข" ยอดที่ปิดแล้วในหน้า `/daily-close` + ป้ายกำกับการ์ดยอดอัตโนมัติ

2. **รายงานรายเดือน — เพิ่ม 2 กราฟ** (`/reports` → สรุปรายเดือน)
   - **ช่องทางลูกค้าใหม่**: walk_in / referral / social_media / other — *เฉพาะลูกค้าที่ซื้อครั้งแรกในเดือนนั้น* (ดึงจาก `customers.source`)
   - **ชนิดเลนส์ที่ขาย**: SV / Bi-focal / PAL / พิเศษ / อื่นๆ
   - ทั้งคู่เป็น **live SQL query** — แก้รายการขายเมื่อไหร่ รายงานเปลี่ยนตามทันที (ไม่เก็บยอดแยก)

3. **แก้ 3 bug ที่ทำให้รายงานรายเดือนขึ้น 0 ทั้งหมด:**
   - `purchases.lens_type` column ไม่มีใน Turso (อยู่แต่ใน CREATE TABLE ไม่มี ALTER) → เพิ่ม migration `database.ts`
   - `lens_type` column ไม่เคยถูก populate (ข้อมูลจริงอยู่ใน `lens_data` JSON `$.lens_type`)
     → รายงานเปลี่ยนไปใช้ `json_extract(lens_data, '$.lens_type')`
     → INSERT/UPDATE purchases เพิ่ม populate column ด้วย (future-proof)
   - แก้ label เลนส์: ตาเดียว→**SV**, ไบโฟคัล→**Bi-focal**, โปรเกรสซีฟ→**PAL** (`LENS_TYPE_LABEL` ใน ReportsPage)

4. **แก้ปัญหา local dev โหลดข้อมูลไม่สำเร็จ (สำคัญ — รู้ไว้กันงง):**
   - ต้นเหตุ: ผู้ใช้รัน `npm run dev:all` ซ้อนหลายครั้งโดยไม่ปิดตัวเก่า → concurrently 3 ตัว + ts-node-dev 14 ตัว ทุกตัวใช้ `--respawn` แย่ง bind port 3001/5173 → request หลุดเป็นช่วงๆ
   - แก้: `pkill -9 -f "concurrently -n FE,BE"` + `pkill -9 -f "ts-node-dev"` แล้วเริ่มใหม่ตัวเดียว
   - **เช็คก่อนทุกครั้ง:** `pgrep -fl "concurrently -n FE,BE" | wc -l` — ถ้าได้ >1 แปลว่าซ้อน

### 🔧 Keep-alive Render — เปลี่ยนไปใช้ external แล้ว
- **GitHub Actions cron ไม่เคย fire เลย** (มีแต่ workflow_dispatch ที่กดมือ) → พึ่งไม่ได้
- ✅ ผู้ใช้ตั้ง **cron-job.org** ยิง `https://my-app-gjmf.onrender.com/api/health` ทุก 10 นาทีแล้ว
- ✅ `.github/workflows/keep-alive.yml` **ลบแล้ว** (ซ้ำซ้อนกับ cron-job.org) — เหลือแต่ `deploy.yml`

### 📋 ไอเดียที่ผู้ใช้ฝากไว้ทำ phase หน้า
- **Lens brand dropdown**: เพิ่ม field ยี่ห้อเลนส์ตอนเพิ่มรายการขาย → แล้วเพิ่มรายงาน "ยี่ห้อเลนส์ขายดี" (เลื่อนจากรอบนี้ตามที่ผู้ใช้เลือก)

---

## หมายเหตุ Render
- **URL:** `https://my-app-gjmf.onrender.com`
- **Free tier:** หลับหลัง 15 นาที — ตอนนี้กันด้วย **cron-job.org** (ทุก 10 นาที) ไม่ใช่ GitHub Actions แล้ว
- **Auto-deploy:** push เข้า main → GitHub Actions ยิง Deploy Hook → Render deploy เอง (secret `RENDER_DEPLOY_HOOK` ตั้งใน GitHub แล้ว)
- Env (JWT_SECRET, TURSO_*, CORS_ORIGIN ฯลฯ) ตั้งใน Render dashboard → Environment (แยกจาก server/.env ของ local)
- ⚠️ **local dev ใช้ Turso เดียวกับ live** — เขียน test data ลง DB = กระทบร้านจริง ระวัง

## Stable tags
| Tag | สถานะ |
|-----|--------|
| `stable-2026-06-15-turso` | ก่อนแก้ staff/occupation |
| `stable-2026-06-17-staff-occupation` | ก่อน deploy |

## หลักการที่ต้องจำ (ผู้ใช้ย้ำ)
- **ห้ามรบกวน function เดิมที่ทำงานได้** เว้นแต่ task เกี่ยวโดยตรง — แก้แบบ additive
- รัน `npx tsc --noEmit` (ทั้ง root + server) ให้ผ่านก่อน push ทุกครั้ง
- **verify ของจริงก่อนเคลมว่าเสร็จ** (รัน/curl/เปิดแอป ไม่ใช่แค่ build ผ่าน)
- โปรเจกต์**ไม่มี test runner** — verify = tsc + curl/เปิดแอป
- **สื่อสารเป็นภาษาไทย**

## สภาพแวดล้อม
- 2 เครื่อง: **Air (M1)** + **Pro (M3)**
- Database: Turso cloud (sync อัตโนมัติ ทุกเครื่องเห็นข้อมูลเดียวกัน)
- `server/.env` ไม่อยู่ใน git — ต้องมีทุกเครื่อง (มี TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
- รัน: `cd ~/my-app && npm run dev:all` (FE :5173 + BE :3001) — **รันตัวเดียวพอ อย่ารันซ้อน**
- Stack: React 18 + **Vite 5** (ห้าม v8 ที่ Codex เผลออัป) + Tailwind v3 + Express + better-sqlite3/libsql
- Superpowers skills (14 ตัว) ที่ `~/.claude/skills/` — *per-machine, เครื่อง Pro ต้องติดตั้งเอง:*
  `git clone --depth 1 https://github.com/obra/superpowers.git ~/.claude/superpowers && mkdir -p ~/.claude/skills && cp -R ~/.claude/superpowers/skills/* ~/.claude/skills/`
