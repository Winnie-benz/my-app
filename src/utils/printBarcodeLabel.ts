import JsBarcode from 'jsbarcode'
import type { Product } from '../types/product'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function makeBarcodeDataUrl(barcode: string): string {
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, barcode, {
    format: 'CODE128',
    width: 2,
    height: 60,
    displayValue: false,
    margin: 0,
    background: '#ffffff',
    lineColor: '#000000',
  })
  return canvas.toDataURL('image/png')
}

export function printBarcodeLabel(product: Product, qty = 1): void {
  const dataUrl = makeBarcodeDataUrl(product.barcode)

  const label = `
    <div class="label">
      <div class="name">${escapeHtml(product.name)}</div>
      ${product.sku ? `<div class="sku">${escapeHtml(product.sku)}</div>` : ''}
      <img src="${dataUrl}" class="barcode-img" alt="${escapeHtml(product.barcode)}" />
      <div class="barcode-num">${escapeHtml(product.barcode)}</div>
      ${product.sell_price > 0 ? `<div class="price">฿${product.sell_price.toLocaleString()}</div>` : ''}
    </div>`

  const labels = Array.from({ length: qty }, () => label).join('')

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<title>Barcode Labels</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; background: #f8fafc; }
  .page { display: flex; flex-wrap: wrap; gap: 4mm; padding: 10mm; }
  .label {
    width: 60mm;
    border: 1px solid #cbd5e1;
    border-radius: 2mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3mm 2mm;
    gap: 1.5mm;
    background: white;
  }
  .name {
    font-size: 9pt;
    font-weight: bold;
    text-align: center;
    max-width: 56mm;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: #0f172a;
  }
  .sku {
    font-size: 7pt;
    color: #64748b;
    font-family: 'Courier New', monospace;
  }
  .barcode-img { height: 14mm; max-width: 56mm; }
  .barcode-num {
    font-size: 8pt;
    font-family: 'Courier New', monospace;
    letter-spacing: 2px;
    color: #1e293b;
  }
  .price {
    font-size: 11pt;
    font-weight: bold;
    color: #0f172a;
    margin-top: 0.5mm;
  }
  @media print {
    body { background: white; }
    .label { border: 0.5pt solid #94a3b8; }
  }
</style>
</head>
<body>
<div class="page">${labels}</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=760,height=560')
  if (!win) { alert('กรุณาอนุญาต popup ในเบราว์เซอร์เพื่อพิมพ์ label'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 400)
}
