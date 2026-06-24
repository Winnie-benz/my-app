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

## 🚨 อัปเดตล่าสุด: 2026-06-24 (รอบเย็น) — เครื่อง Air

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
- ⚠️ `.github/workflows/keep-alive.yml` **ซ้ำซ้อนแล้ว** — ยังไม่ลบ (ไม่ทำงานอยู่แล้วไม่เสียหาย) รอผู้ใช้ตัดสินใจว่าจะลบไหม

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
