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

## 🚨 อัปเดตล่าสุด: 2026-06-24 (รอบบ่าย) — เครื่อง Air

### ✅ Codex auth overhaul = PUSH + DEPLOY ขึ้น live แล้ว (commit `7b0ebbb` + `c52a80a`)

**deploy แล้วและเซิร์ฟเวอร์รันอยู่บน live** — ยืนยันแล้วว่า:
- frontend bundle บน live = hash เดียวกับ build ใหม่ (`index-CFHbNmBT.js`) → โค้ดใหม่ขึ้นจริง
- backend `/api/auth/me`, `/api/auth/refresh` ตอบ 401 JSON → route ใหม่มีจริง
- **server ไม่ crash ตอน boot** (แก้ `validateProductionEnv` ให้ warn แทน throw แล้ว — commit `c52a80a`)
- login flow (cookie: login → me → refresh → logout) verify ผ่าน 12/12 ผ่าน curl บน local (โค้ด+Turso เดียวกับ live)

**สิ่งที่ตัดสินใจไปในรอบนี้:**
- `validateProductionEnv` → **warn แทน throw** (ผู้ใช้เลือก) กัน boot crash จาก env อ่อน; ปัญหายัง log เตือนอยู่ — `isWeakSecret` ปัด secret ที่ <32 ตัว หรือมีสตริง secret/password/default
- revert Vite 8 → 5 (`@vitejs/plugin-react` ^4.3.4 + vite ^5.4.11) ตาม CLAUDE.md, build ผ่าน
- backup.ts: timestamp เวลาไทยผ่าน `utils/time`

**⏳ เหลือขั้นเดียว — ต้องให้ผู้ใช้ทำเอง (classifier บล็อกการเขียน user ลง prod DB):**
- login จริงด้วย account จริงผ่านเบราว์เซอร์บน https://my-app-gjmf.onrender.com → ใช้งาน → refresh → logout
- ถ้าพัง: `git revert 7b0ebbb c52a80a` + push (auto-deploy กลับ Bearer เดิม)

### ✅ "ปิดยอดรายวัน" — implement + ทดสอบเสร็จแล้ว (commit `0efd5e4`, ยังไม่ push)
- spec/plan: `docs/superpowers/specs|plans/2026-06-24-daily-cash-close*.md`
- ทำครบ 3 task: ตาราง `daily_closes` → backend `/api/daily-close` (today/open/close/history) → หน้า `/daily-close` + เมนู sidebar (กลุ่ม **วิเคราะห์** ข้างรายงาน)
- **ปรับจาก plan เพื่อความถูกต้อง:**
  - คำนวณยอด **ตัด payments ที่ voided_at != '' ออก** (กันนับยอดที่ยกเลิก)
  - `/close` คงค่า `opened_by`/`opened_at` เดิมไว้ (plan เขียนทับเป็นค่าว่าง)
  - เมนูอยู่กลุ่ม "วิเคราะห์" (plan บอก "ลูกค้า") — ตรงที่ผู้ใช้มองหา
- **verify:** tsc (root+server) + build ผ่าน; ทดสอบ runtime จริงบน SQLite local (ไม่แตะ Turso prod) — auth, voided excluded, claim_payments รวม, open/close/expected_cash/difference, re-open blocked, history ผ่านทั้งหมด
- ⚠️ ตาราง `daily_closes` ถูกสร้างใน Turso prod แล้ว (dev server respawn รัน CREATE TABLE IF NOT EXISTS) — ตารางว่าง additive ปลอดภัย
- **ยังไม่ push** (รอจังหวะ deploy) — branch นำหน้า origin 2 commits: HANDOFF + daily-close

### เสร็จแล้วในแชตนี้ (2026-06-24)
- แก้ bug หน้า Settings crash (`loadSettings` artifacts) — push แล้ว
- **Auto-deploy ใช้งานได้จริงแล้ว** ผ่าน GitHub Actions (`.github/workflows/deploy.yml` ยิง Render Deploy Hook) — webhook เดิมของ Render หลุด ต้องใช้วิธีนี้แทน (secret `RENDER_DEPLOY_HOOK` ตั้งใน GitHub แล้ว)
- **Keep-alive** (`.github/workflows/keep-alive.yml`) ping ทุก 14 นาที ช่วง ~09:00–21:00 ICT กัน Render หลับ
- ติดตั้ง **superpowers skills** (14 ตัว) ที่ `~/.claude/skills/` — *per-machine, เครื่อง Pro ต้องติดตั้งเอง:* `git clone --depth 1 https://github.com/obra/superpowers.git ~/.claude/superpowers && mkdir -p ~/.claude/skills && cp -R ~/.claude/superpowers/skills/* ~/.claude/skills/`

---

## หมายเหตุ Render
- **URL:** `https://my-app-gjmf.onrender.com`
- **Free tier:** หลับหลัง 15 นาที — มี keep-alive ping กันแล้ว (ช่วงร้านเปิด)
- **Auto-deploy:** push เข้า main → GitHub Actions ยิง Deploy Hook → Render deploy เอง (ไม่ต้องกด Manual แล้ว)
- Env (JWT_SECRET, TURSO_*, CORS_ORIGIN ฯลฯ) ตั้งใน Render dashboard → Environment (แยกจาก server/.env ของ local)

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

## สภาพแวดล้อม
- 2 เครื่อง: **Air (M1)** + **Pro (M3)**
- Database: Turso cloud (sync อัตโนมัติ)
- `server/.env` ไม่อยู่ใน git — ต้องมีทุกเครื่อง
- รัน: `cd ~/my-app && npm run dev:all` (FE :5173 + BE :3001)
- Stack: React 18 + **Vite 5** (ห้าม v8 ที่ Codex เผลออัป) + Tailwind v3 + Express + better-sqlite3/libsql
