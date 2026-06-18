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

## อัปเดตล่าสุด: 2026-06-18 — เครื่อง Air

### เพิ่งทำเสร็จ (Air session วันนี้)
- ตั้งค่าเครื่อง Air ให้ใช้งานได้ครบ: Homebrew, GitHub CLI, PM2
- PM2 รัน backend (owndays-server) auto-start ทุกครั้งที่เปิดเครื่อง
- git pull/push ข้ามเครื่องทำงานได้แล้ว

### เพิ่งทำเสร็จ (Pro session 2026-06-18)
- **ผู้ขาย (staff) บนบิล:** บันทึกจาก JWT, แก้ไขทีหลังได้ ไม่ทับค่าเดิม
- **อาชีพลูกค้า (occupation):** dropdown 10 แบบ + ป้อนเข้า AI snapshot
- **Auto-push hook:** แก้บั๊กให้ทน rebase (ข้าม detached HEAD) แล้ว
- Smoke test: 16 GET endpoints + frontend = 200 ทั้งหมด

### Stable tags (กู้คืนด้วย `git checkout <tag>`)
| Tag | สถานะ |
|-----|--------|
| `stable-2026-06-15-turso` | ก่อนแก้ staff/occupation |
| `stable-2026-06-17-staff-occupation` | ล่าสุด ผ่าน smoke test แล้ว |

---

## งานที่ต้องทำต่อ (เรียงตามลำดับความสำคัญ)

### 1. Phase D — Operations (ยังไม่ได้เริ่ม)
- [ ] **Order notes** — เพิ่มช่องหมายเหตุใน purchase/order
- [ ] **Session timeout warning** — แจ้งเตือน popup ก่อน JWT หมด 5 นาที
- [ ] **Shop name config** — ตั้งชื่อร้านใน Settings แสดงบนใบเสร็จ

### 2. Deploy to Render (ฟรี) — ค้างอยู่
- ผู้ใช้เลือก Render เพราะฟรี ทราฟฟิกต่ำ พนักงานใช้เอง
- **Blocker ก่อน deploy:** แก้ tsc error 3 จุด (`authToken` ใน database.ts + migrate-to-turso.ts)
- backend serve frontend ในตัวแล้ว (express.static) → deploy ที่เดียวจบ
- ตั้ง env vars บน Render: ดูจาก `server/.env`
- ตั้ง CORS เป็น domain จริงหลัง deploy

### 3. Phase 4 — Reports (ยังไม่ได้เริ่ม)
- [ ] Dashboard ยอดขายรายวัน/เดือน + กราฟ (recharts)
- [ ] สินค้าขายดี Top 10
- [ ] รายงานกำไร-ขาดทุน (admin only)

### 4. AI Analytics
- หน้า `/analytics` สร้างแล้ว รอแค่ใส่ `ANTHROPIC_API_KEY` ใน `server/.env`

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
