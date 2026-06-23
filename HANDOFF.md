# HANDOFF — สถานะงานล่าสุด (sync ข้ามเครื่อง Air ↔ Pro ผ่าน git)

> ไฟล์นี้คือ "สมุดส่งงาน" ระหว่างสองเครื่อง
> - Claude บนเครื่องไหนก็ **อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง**
> - อัปเดตไฟล์นี้ทุกครั้ง **เมื่อจบงาน** ก่อน push
> - chat ของ Claude Code แยกกันคนละเครื่อง แต่ไฟล์นี้ sync ผ่าน git

---

## วิธีใช้ (ผู้ใช้)

| ขั้นตอน | คำสั่ง |
|---------|--------|
| เริ่มงาน | `cd ~/my-app && git pull && npm run dev:all` |
| จบงาน (Pro) | auto-push hook จัดการให้อัตโนมัติ |
| จบงาน (Air) | `git add . && git commit -m "..." && git push` |

---

## อัปเดตล่าสุด: 2026-06-23 — เครื่อง Air

### เพิ่งทำเสร็จ (Air session 2026-06-23)
- **Deploy บน Render** — `https://my-app-gjmf.onrender.com` live แล้ว (free tier)
- **เปลี่ยนชื่อ Owndays → Winnie** ใน sidebar และหน้า Login
- **หน้าจัดการผู้ใช้** (`/users`) — admin เพิ่ม/แก้ไข/ลบ user ผ่านหน้าเว็บได้เลย
- **Local auth** — login ตรวจ `users` table ใน DB ก่อน แล้ว fallback ไป Google Apps Script
- แก้ tsc errors ทั้งหมดก่อน deploy (tsconfig, authToken, exportBackupToDrive)

### Stable tags (กู้คืนด้วย `git checkout <tag>`)
| Tag | สถานะ |
|-----|--------|
| `stable-2026-06-15-turso` | ก่อนแก้ staff/occupation |
| `stable-2026-06-17-staff-occupation` | ก่อน deploy |

### หมายเหตุ Render
- **URL:** `https://my-app-gjmf.onrender.com`
- **Free tier:** spin down หลัง 15 นาที ไม่มีคนใช้ — ครั้งแรกช้า 30-50 วินาที
- auto-deploy ทุกครั้งที่ `git push` ไม่ต้อง deploy manual

---

## งานที่ต้องทำต่อ (เรียงตามลำดับความสำคัญ)

### 1. แก้ bug — เพิ่ม user ใน local ยัง error
- หน้า `/users` โหลดไม่สำเร็จ + เพิ่ม user ไม่ได้ — ยังไม่ได้ debug เพราะ port 3001 ชน PM2
- ต้องรัน `pm2 stop all` ก่อน แล้วค่อย `npm run dev:all` เพื่อ test local

### 2. Phase D — Operations
- [ ] **Order notes** — เพิ่มช่องหมายเหตุใน purchase/order
- [ ] **Session timeout warning** — แจ้งเตือน popup ก่อน JWT หมด 5 นาที
- [ ] **Shop name config** — ตั้งชื่อร้านใน Settings แสดงบนใบเสร็จ

### 3. Phase 4 — Reports
- [ ] Dashboard ยอดขายรายวัน/เดือน + กราฟ (recharts)
- [ ] สินค้าขายดี Top 10
- [ ] รายงานกำไร-ขาดทุน (admin only)

### 4. AI Analytics
- หน้า `/analytics` สร้างแล้ว รอแค่ใส่ `ANTHROPIC_API_KEY` ใน `server/.env` และ Render environment

---

## หลักการที่ต้องจำ (ผู้ใช้ย้ำ)
- **ห้ามรบกวน function เดิมที่ทำงานได้** เว้นแต่ task นั้นเกี่ยวโดยตรง — แก้แบบ additive เท่านั้น
- ปักหมุด `stable-YYYY-MM-DD-<desc>` ทุกครั้งที่งานเสร็จและทดสอบผ่าน
- รัน `npx tsc --noEmit` ให้ผ่านก่อน push ทุกครั้ง

---

## สภาพแวดล้อม
- 2 เครื่อง: **Air (M1)** + **Pro (M3)**
- Database: Turso cloud (sync อัตโนมัติทุก 30 วินาที)
- `server/.env` ไม่อยู่ใน git — ต้องมีทุกเครื่อง (เก็บใน Notes)
- รัน: `cd ~/my-app && npm run dev:all` (FE :5173 + BE :3001)
