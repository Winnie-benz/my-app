import type { PurchaseRecord, Customer } from '../types/customer'

const LENS_TYPE: Record<string, string> = {
  single_vision: 'Single Vision', bi_focal: 'Bi-Focal', pal: 'PAL',
  specialty: 'เฉพาะทาง', other: 'อื่นๆ',
}
const LENS_KIND: Record<string, string> = {
  stock_order: 'Stock (Order)', stock_store: 'Stock (หน้าร้าน)', rx: 'RX',
}
const COATING_LABEL: Record<string, string> = {
  hmc: 'HMC', blue_block: 'Blue Block', photochromic: 'Photochromic',
  anti_fog: 'Anti Fog', drive: 'Drive',
}

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function rxRow(eye: Record<string, string>, label: string) {
  const fields = ['sph','cyl','axs','add','va','pd']
  const vals = fields.map(f => esc(eye[f] || '-')).join(' / ')
  return `<tr><td style="font-weight:600;padding:2px 8px 2px 0;width:24px">${label}</td>
    <td style="font-size:11px;color:#475569;padding:2px 0">${vals}</td></tr>`
}

export function printReceipt(record: PurchaseRecord, customer?: Customer | null) {
  const remaining = Math.max(0, record.total - record.paid_amount)
  const dateStr = new Date(record.date + 'T00:00:00').toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const lensSection = record.lens.enabled ? `
    <div class="section">
      <div class="section-title">
        <span>เลนส์</span>
        <span>${LENS_TYPE[record.lens.lens_type] || ''} · ${LENS_KIND[record.lens.lens_kind] || ''} · ${record.lens.index}</span>
      </div>
      <table style="width:100%;font-size:12px;margin:4px 0 6px">
        <tbody>
          ${rxRow(record.lens.right as any, 'R')}
          ${rxRow(record.lens.left as any, 'L')}
        </tbody>
      </table>
      ${record.lens.coatings.length > 0 ? `<p style="font-size:11px;color:#64748b;margin-bottom:4px">Coating: ${record.lens.coatings.map(c => esc(COATING_LABEL[c])).join(', ')}</p>` : ''}
      <div class="item-row"><span>เลนส์</span><span class="price">฿${fmt(record.price_lens.discounted)}</span></div>
    </div>` : ''

  const frameSection = record.frame.enabled ? `
    <div class="section">
      <div class="section-title">
        <span>กรอบ</span>
        <span>${record.frame.source === 'store' ? 'กรอบร้าน' : record.frame.source === 'customer' ? 'ลูกค้านำมาเอง' : 'Pre-order'}</span>
      </div>
      ${record.frame.barcode ? `<p style="font-size:11px;color:#64748b;margin-bottom:4px">Barcode: ${esc(record.frame.barcode)}</p>` : ''}
      ${record.frame.model ? `<p style="font-size:11px;color:#64748b;margin-bottom:4px">รุ่น: ${esc(record.frame.model)}</p>` : ''}
      <div class="item-row"><span>กรอบ</span><span class="price">฿${fmt(record.price_frame.discounted)}</span></div>
    </div>` : ''

  const otherSection = record.other.enabled ? `
    <div class="section">
      <div class="section-title"><span>สินค้าอื่นๆ</span></div>
      ${record.other.barcode ? `<p style="font-size:11px;color:#64748b;margin-bottom:4px">Barcode: ${esc(record.other.barcode)}</p>` : ''}
      <div class="item-row"><span>สินค้าอื่นๆ</span><span class="price">฿${fmt(record.price_other.discounted)}</span></div>
    </div>` : ''

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<title>ใบเสร็จรับเงิน</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Sarabun',sans-serif; font-size:13px; color:#1e293b; max-width:360px; margin:0 auto; padding:20px 16px; }
  .header { text-align:center; padding-bottom:12px; border-bottom:2px solid #1e293b; margin-bottom:12px; }
  .shop-name { font-size:22px; font-weight:700; letter-spacing:1px; }
  .shop-sub { font-size:11px; color:#64748b; margin-top:2px; }
  .receipt-no { font-size:11px; color:#64748b; margin-top:8px; }
  .info-block { margin-bottom:12px; }
  .info-row { display:flex; justify-content:space-between; margin-bottom:3px; font-size:12px; }
  .info-label { color:#64748b; }
  .section { margin:8px 0; }
  .section-title { display:flex; justify-content:space-between; font-weight:600; font-size:12px; color:#475569; border-bottom:1px dashed #e2e8f0; padding-bottom:4px; margin-bottom:6px; }
  .item-row { display:flex; justify-content:space-between; font-size:13px; padding:2px 0; }
  .price { font-weight:600; }
  hr { border:none; border-top:1px dashed #94a3b8; margin:10px 0; }
  .total-row { display:flex; justify-content:space-between; font-weight:700; font-size:16px; margin:6px 0; }
  .paid-row { display:flex; justify-content:space-between; color:#16a34a; font-size:13px; margin:4px 0; }
  .due-row { display:flex; justify-content:space-between; color:#dc2626; font-size:13px; margin:4px 0; }
  .footer { text-align:center; margin-top:16px; font-size:11px; color:#94a3b8; border-top:1px dashed #e2e8f0; padding-top:12px; }
  @media print { body { padding:10px; } }
</style>
</head>
<body>
<div class="header">
  <div class="shop-name">ร้านแว่นตา</div>
  <div class="shop-sub">ใบเสร็จรับเงิน · Receipt</div>
  <div class="receipt-no">${esc(record.id)}</div>
</div>

<div class="info-block">
  <div class="info-row"><span class="info-label">วันที่</span><span>${dateStr}</span></div>
  ${customer ? `<div class="info-row"><span class="info-label">ลูกค้า</span><span><b>${esc(customer.first_name)} ${esc(customer.last_name)}</b></span></div>` : ''}
  ${customer?.phone_no ? `<div class="info-row"><span class="info-label">โทรศัพท์</span><span>${esc(customer.phone_no)}</span></div>` : ''}
</div>

<hr />

${lensSection}
${frameSection}
${otherSection}

<hr />

<div>
  ${record.lens.enabled && record.price_lens.percent > 0 ? `<div class="item-row"><span style="color:#16a34a">ส่วนลดเลนส์ (-${record.price_lens.percent}%)</span><span style="color:#16a34a">-฿${fmt(record.price_lens.full - record.price_lens.discounted)}</span></div>` : ''}
  ${record.frame.enabled && record.price_frame.percent > 0 ? `<div class="item-row"><span style="color:#16a34a">ส่วนลดกรอบ (-${record.price_frame.percent}%)</span><span style="color:#16a34a">-฿${fmt(record.price_frame.full - record.price_frame.discounted)}</span></div>` : ''}
  ${record.special_discount > 0 ? `<div class="item-row"><span style="color:#16a34a">ส่วนลดพิเศษ</span><span style="color:#16a34a">-฿${fmt(record.special_discount)}</span></div>` : ''}
  <div class="total-row"><span>รวมทั้งหมด</span><span>฿${fmt(record.total)}</span></div>
</div>

${record.paid_amount > 0 ? `
<hr />
<div class="paid-row"><span>ชำระแล้ว</span><span>฿${fmt(record.paid_amount)}</span></div>
${remaining > 0 ? `<div class="due-row"><span>ค้างชำระ</span><span>฿${fmt(remaining)}</span></div>` : ''}
` : ''}

${record.pickup_date ? `
<hr />
<div class="info-row">
  <span class="info-label">วันนัดรับสินค้า</span>
  <span><b>${esc(record.pickup_date)}${record.pickup_time ? ' · ' + esc(record.pickup_time) : ''}</b></span>
</div>` : ''}

<div class="footer">
  <p>ขอบคุณที่ใช้บริการ</p>
  <p style="margin-top:4px">Thank you for your business</p>
</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=420,height=700')
  if (!win) { alert('กรุณาอนุญาต popup ในเบราว์เซอร์เพื่อพิมพ์ใบเสร็จ'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 500)
}
