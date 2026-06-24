# Design: เปิด-ปิดกะรายวัน (Daily Cash Close)

วันที่: 2026-06-24
สถานะ: รอ implement

## 1. วัตถุประสงค์

ให้ร้านปิดยอดสิ้นวันได้ — สรุปยอดขายแยกตามวิธีจ่าย และตรวจสอบเงินสดในลิ้นชักว่าตรงกับที่ระบบบันทึกไหม (ขาด/เกิน) เพื่อจับความผิดพลาด/เงินหาย และเก็บประวัติไว้ดูย้อนหลัง

แนวทาง: **แบบ B — เปิด/ปิดกะ** พนักงานยืนยันเงินตั้งต้นตอนเช้า ("เปิดร้าน") แล้วนับเงินตอนเย็น ("ปิดยอด")

## 2. ขอบเขต

**ทำในรอบนี้:**
- เปิดร้าน: บันทึกเงินตั้งต้น (opening float)
- ปิดยอด: นับเงินสดจริง เทียบกับที่ควรมี → ตรง/ขาด/เกิน
- สรุปยอดวันนี้แยกตามวิธีจ่าย (เงินสด / โอน / บัตร / QR)
- ประวัติการปิดยอดย้อนหลัง

**ไม่ทำในรอบนี้ (รอรอบหน้า):**
- คืนเงิน / จ่ายเงินออกจากลิ้นชักระหว่างวัน (ยังไม่มีระบบ refund)
- แยกยอดขายรายพนักงาน / KPI (ยอดรวมร้านพอ)

## 3. โมเดลข้อมูล

ตารางใหม่ `daily_closes` — 1 แถวต่อ 1 วัน:

| คอลัมน์ | ชนิด | หมายเหตุ |
|---------|------|---------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `close_date` | TEXT UNIQUE | รูปแบบ `YYYY-MM-DD` (เวลาไทย) — 1 วันมีได้แถวเดียว |
| `status` | TEXT | `'open'` หรือ `'closed'` |
| `opening_float` | REAL | เงินตั้งต้น กรอกตอนเปิดร้าน |
| `opened_by` | TEXT | ชื่อพนักงานที่เปิด |
| `opened_at` | TEXT | เวลาเปิด (nowTH) |
| `total_cash` | REAL | ยอดเงินสดวันนี้ (snapshot ตอนปิด) |
| `total_transfer` | REAL | ยอดโอน |
| `total_card` | REAL | ยอดบัตร |
| `total_qr` | REAL | ยอด QR |
| `total_sales` | REAL | รวมทุกวิธี |
| `expected_cash` | REAL | เงินสดที่ควรมี = opening_float + total_cash |
| `counted_cash` | REAL | เงินสดที่นับได้จริง |
| `difference` | REAL | counted_cash − expected_cash (+ = เกิน, − = ขาด) |
| `note` | TEXT | หมายเหตุ (เช่น เหตุผลที่เงินไม่ตรง) |
| `closed_by` | TEXT | ชื่อพนักงานที่ปิด |
| `closed_at` | TEXT | เวลาปิด (nowTH) |

สร้างด้วย `CREATE TABLE IF NOT EXISTS` ใน `server/src/db/database.ts` ตาม pattern เดิม

## 4. แหล่งข้อมูลยอดวันนี้

รวมรายได้จาก **2 ตาราง** โดยถือว่ารายได้จากเคลม = ยอดขายปกติ (แยกตามวิธีจ่าย เหมือนกัน):
- `payments` (ขายปกติ)
- `claim_payments` (ค่าเคลม)

เงื่อนไข: `paid_at` ตรงกับวันนี้ (เวลาไทย) — กรองด้วย `substr(paid_at,1,10) = <today>` แล้ว group ตาม `method`

> เคลมที่ไม่มีค่าใช้จ่ายจะไม่มีแถวใน `claim_payments` อยู่แล้ว จึงไม่นับเข้าโดยอัตโนมัติ

วิธีจ่าย: `cash`, `transfer`, `card`, `qr`

## 5. การคำนวณ

```
total_cash      = ผลรวม amount (payments + claim_payments) ที่ method='cash' วันนี้
expected_cash   = opening_float + total_cash
difference      = counted_cash − expected_cash
```
- `difference == 0` → ตรง (เขียว)
- `difference < 0`  → ขาด (แดง)
- `difference > 0`  → เกิน (เหลือง)

โอน/บัตร/QR แสดงเป็นยอดเฉยๆ ไม่ต้องนับมือ (เข้าระบบอิเล็กทรอนิกส์)

## 6. วงจรสถานะ (1 วัน)

```
🔴 ยังไม่เปิด → 🟢 เปิดแล้ว (กำลังขาย) → ⚫ ปิดแล้ว
```

## 7. หน้าจอ "ปิดยอด" (เมนูใหม่ใน sidebar)

แสดงตามสถานะของวันนี้:
- **ยังไม่เปิด:** ปุ่ม "เปิดร้าน" + ช่องเงินตั้งต้น (เติมค่าจากครั้งก่อนเป็นตัวอย่าง กดยืนยัน)
- **เปิดแล้ว:** การ์ดสรุปยอดสดวันนี้ (รวม + แยกวิธีจ่าย) + ปุ่ม "ปิดยอด" + ช่อง "เงินสดนับจริง" → โชว์ส่วนต่างทันที + ช่องหมายเหตุ
- **ปิดแล้ว:** สรุปสุดท้าย อ่านอย่างเดียว

ด้านล่าง: ตารางประวัติปิดยอดย้อนหลัง (วันที่ / ยอดรวม / ส่วนต่าง)

## 8. การกันพลาด

- **ลืมเปิดตอนเช้า แต่ขายไปแล้ว:** ไม่บล็อกการขายเด็ดขาด ตอนปิดให้กรอกเงินตั้งต้นย้อนหลังได้ (close สร้างแถวพร้อม opening_float ได้แม้ไม่มี open ก่อน)
- **ลืมปิดเมื่อวาน:** เปิดวันใหม่แล้วระบบเตือน "เมื่อวานยังไม่ปิด" + ปิดย้อนหลังได้

## 9. API (`server/src/routes/dailyClose.ts`)

| Method | Path | หน้าที่ |
|--------|------|--------|
| GET | `/api/daily-close/today` | สถานะวันนี้ + ยอดสดแยกวิธีจ่าย + opening_float ที่เติมให้ + ค่าที่ปิดไปแล้ว(ถ้ามี) |
| POST | `/api/daily-close/open` | เปิดร้าน — บันทึก opening_float, opened_by, opened_at, status='open' |
| POST | `/api/daily-close/close` | ปิดยอด — snapshot ยอดแยกวิธีจ่าย, บันทึก counted_cash, difference, note, status='closed' (ปิดซ้ำวันเดิม = อัปเดตทับ) |
| GET | `/api/daily-close/history?limit=` | ประวัติย้อนหลัง |

ทุก endpoint อยู่หลัง `requireAuth` (ไม่ต้อง requireAdmin)

## 10. สิทธิ์

**ทุกคน** (staff + admin) เปิด-ปิด และดูประวัติได้

## 11. ไฟล์ที่ต้องแตะ

- `server/src/db/database.ts` — เพิ่มตาราง `daily_closes`
- `server/src/routes/dailyClose.ts` — route ใหม่
- `server/src/index.ts` — register router
- `src/services/api.ts` — เพิ่ม namespace `dailyClose`
- `src/pages/DailyClosePage.tsx` — หน้าใหม่
- `src/routes/index.tsx` — เพิ่ม route
- `src/layouts/MainLayout.tsx` — เพิ่มเมนู sidebar
