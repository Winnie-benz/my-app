// ============================================================
// Google Apps Script — Employee Auth API
//
// วิธีใช้:
//   1. เปิด Google Sheet ที่เก็บข้อมูล Employee
//   2. Extensions > Apps Script
//   3. Copy code นี้ทั้งหมดวางแทนที่โค้ดเดิม
//   4. แก้ไข SECRET_TOKEN และ SHEET_NAME ให้ตรง
//   5. Deploy > New deployment > Web app
//      - Execute as  : Me
//      - Who has access : Anyone
//   6. Copy URL ไปใส่ใน server/.env  →  APPS_SCRIPT_URL=...
//
// หมายเหตุ: ทุกครั้งที่แก้ code ต้อง Deploy > Manage deployments
//           > Edit (icon ดินสอ) > Version "New version" > Deploy
//
// Endpoints:
//   ?action=test&token=SECRET
//   ?action=getEmployee&username=xxx&token=SECRET
// ============================================================

const SECRET_TOKEN   = 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING'; // ← เปลี่ยนด้วย
const SPREADSHEET_ID = '1qL-z9F_3fy1PjCvmz62QaZYfa3F0nLA_VLwlQFbHleg';
const SHEET_NAME     = 'Employee'; // ← ชื่อ tab ใน Google Sheet

// ── Entry point ───────────────────────────────────────────────

function doGet(e) {
  try {
    // ตรวจ token ทุก request
    if (!e.parameter.token || e.parameter.token !== SECRET_TOKEN) {
      return respond({ success: false, error: 'Unauthorized' });
    }

    const action = e.parameter.action;

    if (action === 'test') {
      return respond({ success: true, message: 'Auth API is reachable' });
    }

    if (action === 'getEmployee') {
      return handleGetEmployee(e.parameter.username);
    }

    return respond({ success: false, error: 'Unknown action' });

  } catch (err) {
    Logger.log('doGet error: ' + err.message);
    return respond({ success: false, error: 'Internal script error: ' + err.message });
  }
}

// ── Handlers ──────────────────────────────────────────────────

function handleGetEmployee(username) {
  if (!username || !username.trim()) {
    return respond({ success: false, error: 'username is required' });
  }

  const employees = getEmployeesFromSheet_();
  const found = employees.find(function(e) { return e.user === username.trim(); });

  if (!found) {
    return respond({ success: false, error: 'Employee not found' });
  }

  return respond({ success: true, employee: found });
}

// ── Sheet reader ──────────────────────────────────────────────

function getEmployeesFromSheet_() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error('Sheet "' + SHEET_NAME + '" not found. Available: '
      + ss.getSheets().map(function(s) { return s.getName(); }).join(', '));
  }

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  var headers = rows[0].map(function(h) { return String(h).trim().toLowerCase().replace(/\s+/g, '_'); });
  var dataRows = rows.slice(1);

  return dataRows
    .filter(function(row) { return String(row[0]).trim() !== ''; })
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        obj[h] = String(row[i] !== undefined ? row[i] : '').trim();
      });
      // Normalise status and role to lowercase
      if (obj.status) obj.status = obj.status.toLowerCase();
      if (obj.role)   obj.role   = obj.role.toLowerCase();
      if (!obj.role || (obj.role !== 'admin' && obj.role !== 'staff')) {
        obj.role = 'staff';
      }
      return obj;
    });
}

// ── Helper ────────────────────────────────────────────────────

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Manual test (รันใน Apps Script editor ได้เลย) ─────────────

function testGetEmployee() {
  Logger.log(JSON.stringify(getEmployeesFromSheet_(), null, 2));
}
