# 🔄 HANDOFF — สถานะงานล่าสุด (sync ข้ามเครื่อง Air ↔ Pro ผ่าน git)

> ไฟล์นี้คือ "สมุดส่งงาน" ระหว่างสองเครื่อง — Claude บนเครื่องไหนก็อ่านไฟล์นี้ก่อนเริ่มงาน
> และอัปเดตเมื่อจบงาน เพราะ chat ของ Claude Code แยกกันคนละเครื่อง แต่ไฟล์นี้ sync ผ่าน git
>
> **ผู้ใช้:** ก่อนเริ่มงานแต่ละเครื่อง ให้ pull ก่อน (หรือดับเบิลคลิก start.command)

---

## อัปเดตล่าสุด: 2026-06-18 (ทำบนเครื่อง Pro)

### เพิ่งทำเสร็จ
- **Track A+B (B-OS Phase 0/1):** เพิ่มการบันทึก "ผู้ขาย" บนบิล (จาก JWT, แก้ไขทีหลังไม่ทับ) + ช่อง "อาชีพ" ลูกค้า (dropdown 10 แบบ) + ป้อนเข้า AI snapshot — verify ผ่าน HTTP จริงครบ
- **Backup system:** มี restore tag — `stable-2026-06-15-turso` (ก่อนแก้), `stable-2026-06-17-staff-occupation` (ปัจจุบัน) กลับด้วย `git checkout <tag>`
- **Auto-push hook:** แก้บั๊กให้ทน rebase (ข้าม detached HEAD) แล้ว
- Smoke test: 16 GET endpoints + frontend = 200 ทั้งหมด, frontend build ผ่าน

### กำลังจะทำ / ค้างอยู่
- **Deploy เป็น URL** — ผู้ใช้เอนเอียงไป **Render (ฟรี)** เพราะเป็นหลังบ้านพนักงานใช้เอง ทราฟฟิกต่ำ
  - ต้องทำก่อน deploy: แก้ backend build blocker (tsc error 3 จุด — `authToken` ใน database.ts + migrate-to-turso.ts), ตั้ง build/start command, ตั้ง env vars บน host, ตั้ง CORS เป็น domain จริง
  - backend serve frontend ได้ในตัวแล้ว (express.static) → deploy ที่เดียวจบ

### หลักการที่ต้องจำ (ผู้ใช้ย้ำ)
- **ห้ามรบกวน function เดิมที่ทำงานได้** เว้นแต่ task นั้นเกี่ยวโดยตรง — แก้แบบเพิ่มเข้า (additive)
- ปักหมุด `stable-YYYY-MM-DD-<desc>` ทุกครั้งที่งานเสร็จและทดสอบผ่าน

### สภาพแวดล้อม
- 2 เครื่อง: Air (M1) + Pro (M3) · ฐานข้อมูลร่วม = Turso cloud (`server/.env` ไม่อยู่ใน git ต้องมีทุกเครื่อง)
- รัน: `cd ~/my-app && npm run dev:all` (FE 5173 + BE 3001)
