import type { InventorySession, InventorySessionItem } from '../types/product'

const STATUS_LABEL: Record<string, string> = {
  ok: 'OK', missing: 'Missing', over: 'Over', unchecked: 'Unchecked',
}
const STATUS_COLOR: Record<string, string> = {
  ok:        '#16a34a',
  missing:   '#d97706',
  over:      '#dc2626',
  unchecked: '#94a3b8',
}

export function printInventoryReport(session: InventorySession, items: InventorySessionItem[]) {
  const dateStr = new Date(session.created_at).toLocaleString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const total_unchecked = session.total_items - session.total_ok - session.total_missing - session.total_over

  const rows = items.map(item => {
    const diff = item.difference
    const diffStr = diff === 0 ? '—' : (diff > 0 ? `+${diff}` : `${diff}`)
    const diffColor = diff < 0 ? '#d97706' : diff > 0 ? '#dc2626' : '#16a34a'
    const statusColor = STATUS_COLOR[item.status] ?? '#94a3b8'
    return `
      <tr>
        <td>${item.barcode}</td>
        <td style="color:#64748b;font-size:11px">${item.sku}</td>
        <td>${item.product_name}</td>
        <td class="num">${item.expected_qty}</td>
        <td class="num">${item.counted_qty}</td>
        <td class="num" style="color:${diffColor};font-weight:600">${diffStr}</td>
        <td style="color:${statusColor};font-weight:600">${STATUS_LABEL[item.status] ?? item.status}</td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<title>Inventory Report #${session.id}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Sarabun',sans-serif; font-size:12px; color:#1e293b; padding:24px 28px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; padding-bottom:16px; border-bottom:2px solid #1e293b; }
  .shop-name { font-size:20px; font-weight:700; }
  .title { font-size:13px; color:#64748b; margin-top:2px; }
  .meta { text-align:right; font-size:12px; color:#475569; line-height:1.8; }
  .meta strong { color:#1e293b; }
  .summary { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
  .summary-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; }
  .summary-card .num { font-size:22px; font-weight:700; margin-top:2px; }
  .ok-num    { color:#16a34a; }
  .miss-num  { color:#d97706; }
  .over-num  { color:#dc2626; }
  .unch-num  { color:#94a3b8; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  thead th { background:#f1f5f9; text-align:left; padding:8px 10px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; border-bottom:2px solid #e2e8f0; }
  tbody tr { border-bottom:1px solid #f1f5f9; }
  tbody tr:hover { background:#fafafa; }
  td { padding:7px 10px; vertical-align:middle; }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .footer { margin-top:20px; text-align:center; font-size:10px; color:#94a3b8; }
  @media print {
    body { padding:12px 16px; }
    .no-print { display:none; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="shop-name">ร้านแว่นตา</div>
    <div class="title">รายงานตรวจนับสต็อก · Inventory Count Report</div>
  </div>
  <div class="meta">
    <div>เลขที่ตรวจนับ: <strong>#${session.id}</strong></div>
    <div>วันที่: <strong>${dateStr}</strong></div>
    <div>ผู้ตรวจนับ: <strong>${session.created_by || '—'}</strong></div>
  </div>
</div>

<div class="summary">
  <div class="summary-card">
    <div style="color:#64748b;font-size:11px">รายการทั้งหมด</div>
    <div class="num" style="color:#1e293b">${session.total_items}</div>
  </div>
  <div class="summary-card">
    <div style="color:#64748b;font-size:11px">ถูกต้อง (OK)</div>
    <div class="num ok-num">${session.total_ok}</div>
  </div>
  <div class="summary-card">
    <div style="color:#64748b;font-size:11px">ขาด (Missing)</div>
    <div class="num miss-num">${session.total_missing}</div>
  </div>
  <div class="summary-card">
    <div style="color:#64748b;font-size:11px">เกิน (Over)</div>
    <div class="num over-num">${session.total_over}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Barcode</th>
      <th>SKU</th>
      <th>ชื่อสินค้า</th>
      <th class="num">คาดการณ์</th>
      <th class="num">นับได้</th>
      <th class="num">ผลต่าง</th>
      <th>สถานะ</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>

<div class="footer">
  <p>สร้างโดยระบบจัดการร้านแว่นตา · Session #${session.id} · ${dateStr}</p>
  ${total_unchecked > 0 ? `<p style="color:#d97706;margin-top:4px">* มีสินค้า ${total_unchecked} รายการที่ยังไม่ได้ตรวจนับ</p>` : ''}
</div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('กรุณาอนุญาต popup เพื่อพิมพ์รายงาน'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 500)
}
