// ============================================================
// Google Apps Script — Stock Order Form Backend
// วิธีใช้:
//   1. เปิด https://script.google.com  สร้าง project ใหม่
//   2. Copy code นี้ทั้งหมดวางแทนที่โค้ดเดิม
//   3. Deploy > New deployment > Web app
//      - Execute as  : Me
//      - Who has access : Anyone
//   4. Copy URL แล้วใส่ใน order-form.html บรรทัด SCRIPT_URL
//
// หมายเหตุ: ทุกครั้งที่แก้ code ต้อง Deploy > Manage deployments
//           > Edit (icon ดินสอ) > Version "New version" > Deploy
// ============================================================

const SPREADSHEET_ID = 'YOUR_NEW_SPREADSHEET_ID'; // ← ใส่ ID ของ Google Sheet ใหม่
const NCOLS = 9; // Timestamp, Employee ID, Location Code, Shop Name, JAN, Product Name, Quantity, Tracking No., สาเหตุ

function doGet(e) {
  const action = e.parameter.action;
  let result = {};

  if (action === 'init') {
    result = getMasterData_();
  } else if (action === 'submit') {
    try {
      const payload = JSON.parse(e.parameter.data);
      writeOrder_(payload);
      result = { success: true, count: payload.items.length };
    } catch (err) {
      Logger.log('submit error: ' + err.message);
      result = { success: false, error: err.message };
    }
  } else if (action === 'test') {
    result = { ok: true, message: 'Apps Script is reachable' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getMasterData_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const shopRows = ss.getSheetByName('Shop').getDataRange().getValues();
  const shops = {};
  shopRows.slice(1).forEach(row => {
    const code = String(row[0]).trim();
    const name = String(row[1]).trim();
    if (code && name) shops[code] = name;
  });

  const productRows = ss.getSheetByName('Product').getDataRange().getValues();
  const products = {};
  productRows.slice(1).forEach(row => {
    const name = String(row[0]).trim();
    const jan  = String(row[1]).trim();
    if (jan && name) products[jan] = name;
  });

  return { shops, products };
}

function testWriteDirect() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  const allSheets = ss.getSheets().map(s => '"' + s.getName() + '"');
  Logger.log('All tabs: [' + allSheets.join(', ') + ']');

  const orderSheet = ss.getSheetByName('Order');
  if (!orderSheet) {
    Logger.log('ERROR: ไม่พบ tab ชื่อ "Order" — ดูชื่อ tab จริงจาก log บรรทัดบน');
    return;
  }

  Logger.log('rows before: ' + orderSheet.getLastRow());
  Logger.log('cols before: ' + orderSheet.getLastColumn());

  writeOrder_({
    timestamp:    new Date().toISOString(),
    employeeId:   '99999',
    locationCode: '000',
    shopName:     'TEST SHOP',
    trackingNo:   'TEST-TRK-001',
    items: [{ jan: '0000000000000', productName: 'TEST PRODUCT', qty: 1, reason: 'สินค้าแตก' }],
  });

  const lastRow  = orderSheet.getLastRow();
  const lastCols = orderSheet.getLastColumn();
  Logger.log('rows after: ' + lastRow + ', cols after: ' + lastCols);

  // Read back the row just written to confirm H/I values
  const written = orderSheet.getRange(lastRow, 1, 1, lastCols).getValues()[0];
  Logger.log('Last row values: ' + JSON.stringify(written));
  Logger.log('testWriteDirect: done');
}

function writeOrder_(payload) {
  const ss         = SpreadsheetApp.openById(SPREADSHEET_ID);
  const orderSheet = ss.getSheetByName('Order');

  const HEADERS = ['Timestamp', 'Employee ID', 'Location Code', 'Shop Name', 'JAN', 'Product Name', 'Quantity', 'Tracking No.', 'สาเหตุ'];
  const hasHeader    = orderSheet.getLastRow() > 0;
  const currentCols  = hasHeader ? orderSheet.getLastColumn() : 0;

  if (!hasHeader || currentCols < NCOLS) {
    orderSheet.getRange(1, 1, 1, NCOLS).setValues([HEADERS]);
    const hr = orderSheet.getRange(1, 1, 1, NCOLS);
    hr.setFontWeight('bold');
    hr.setBackground('#1a1a2e');
    hr.setFontColor('#ffffff');
    hr.setHorizontalAlignment('center');
    orderSheet.setFrozenRows(1);
  }

  const { timestamp, employeeId, locationCode, shopName, trackingNo = '', items } = payload;
  const ts = new Date(timestamp);

  const rows = items.map(item => [ts, employeeId, locationCode, shopName, item.jan, item.productName, item.qty, trackingNo, item.reason || '']);
  const firstRow = orderSheet.getLastRow() + 1;

  const dataRange = orderSheet.getRange(firstRow, 1, rows.length, NCOLS);
  dataRange.setValues(rows);

  // Reset formatting in one pass — header inherits white text so data rows need explicit black
  dataRange.setFontColor('#000000');
  dataRange.setBackground('#ffffff');
  dataRange.setFontWeight('normal');
  dataRange.setHorizontalAlignment('left');
  orderSheet.getRange(firstRow, 1, rows.length, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
}
