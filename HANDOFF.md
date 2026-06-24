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

## 🚨 อัปเดตล่าสุด: 2026-06-24 — เครื่อง Air (แชตนี้ยาวมาก กำลังจะเปิดแชตใหม่)

### ⛔ ค้างอยู่ตรงนี้ — ห้ามข้าม (อ่านก่อนทำต่อ)

**Codex ทำ security overhaul ไว้ = commit `7b0ebbb` (commit แล้วใน local แต่ยัง PUSH ไม่ได้)**
มันไม่ใช่แค่ soft-delete เคลม แต่รวม:
- 🔴 **เปลี่ยนระบบ login จาก Bearer token → httpOnly cookie** (auth.ts, useAuthStore, ProtectedRoute, SessionTimeoutWarning, api.ts) — **เสี่ยงสูง ถ้าพลาด = ทุกคน login ไม่ได้**
- rate limiting, productionEnv validation (`validateProductionEnv` crash ตอน boot ถ้า env อ่อน), audit retention, soft-delete เคลม

**ยังมี uncommitted ใน working tree (ของแชตนี้):**
- `package.json` + `package-lock.json` — **revert Vite 8 → 5 แล้ว** (vite 8 ที่ Codex อัปไม่ได้ขอ ขัด CLAUDE.md) build ผ่าน vite 5.4.21 ✅
- `server/src/services/backup.ts` — Codex เปลี่ยน timestamp ใช้เวลาไทย (ส่วนหนึ่งของงาน)

**ต้องทำก่อน push `7b0ebbb`:**
1. **ทดสอบ login flow จริง** (login → ใช้งาน → refresh → logout) — build ผ่าน ≠ login ใช้ได้ การเปลี่ยนเป็น cookie คือจุดเสี่ยงสุด **ห้าม push จนกว่าจะ verify**
2. **JWT_SECRET บน Render** — `validateProductionEnv` จะ throw ตอน boot ถ้า JWT_SECRET อ่อน → ตัวเลือก: (ก) เช็คใน Render dashboard → Environment ว่าเป็นค่ายาวสุ่ม / (ข) แก้ `server/src/config/productionEnv.ts` ให้ warn แทน throw (ปลอดภัยกว่า)
   - หมายเหตุ: CORS_ORIGIN บน Render = `https://my-app.onrender.com` → เช็คแล้ว ผ่าน
3. commit (backup.ts + vite revert) รวมกัน → push → auto-deploy → **ดู deploy ว่าสำเร็จ + login บน URL ยังได้**

> live URL ตอนนี้ยังรันโค้ด**ก่อน** Codex (Bearer auth เดิม) เพราะ `7b0ebbb` ยังไม่ push

### 🎯 งานหลักที่ผู้ใช้รออยู่: "ปิดยอดรายวัน"
- spec: `docs/superpowers/specs/2026-06-24-daily-cash-close-design.md`
- **plan พร้อม implement: `docs/superpowers/plans/2026-06-24-daily-cash-close.md`** (3 task: ตาราง daily_closes → backend API → frontend)
- แนวทาง: แบบ B (เปิด/ปิดกะ + เงินตั้งต้น), นับเงินค่าเคลมรวมเหมือนยอดขายปกติ, ทุกคนใช้ได้
- **ทำหลังจาก push Codex (7b0ebbb) เสร็จเท่านั้น** (เพราะแตะ database.ts/index.ts/api.ts ที่ Codex commit ไปแล้ว — ตอนนี้เคลียร์แล้ว)

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
