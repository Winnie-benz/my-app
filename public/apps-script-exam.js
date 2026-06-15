// ============================================================
// Google Apps Script — Exam Results Backend (Sheet + Email)
//
// วิธีติดตั้ง:
//   1. เปิด Testing score spreadsheet
//   2. Extensions > Apps Script
//   3. วางโค้ดนี้ทั้งหมดแทนที่โค้ดเดิม
//   4. Deploy > Manage deployments > Edit > New version > Deploy
//
// Spreadsheets ที่ใช้:
//   MASTER  → (2026) OWNDAYS Thai Employee Master data  (lookup ชื่อจริง + อัปเดต Assessment)
//   SCORE   → Testing score  (บันทึกผลสอบ + script นี้อยู่ที่นี่)
// ============================================================

const MASTER_SPREADSHEET_ID = '1FLIugt_XASi_vsP7FHdL2UVthQQDsdZpH6St3zVofMU';
const MASTER_SHEET_NAME     = 'Employee';
const PASS_THRESHOLD        = 80;

// mapping: exam sheetName → คอลัมน์ใน Assessment tab (1-based column number)
// type 'latest' = เขียนทับเสมอ  |  type 'round' = เลือก col ตาม round (1/2/3)
const ASSESSMENT_MAP = {
  'NJJ_Simulation':           { type: 'round',  cols: { '1': 20, '2': 21 } },        // T, U
  'NJJ_Checklist':            { type: 'round',  cols: { '1': 15, '2': 16, '3': 17 } }, // O, P, Q
  '1st_Grade':                { type: 'latest', col: 31 },  // AE
  '2nd_Grade':                { type: 'latest', col: 29 },  // AC
  '3rd_Grade':                { type: 'latest', col: 27 },  // AA
  'MVC_Checklist':            { type: 'latest', col: 23 },  // W
  'MOC_Checklist':            { type: 'latest', col: 22 },  // V
  '3rd_Grade [Auto proctor]': { type: 'latest', col: 26 },  // Z
  '2nd_Grade [Auto proctor]': { type: 'latest', col: 28 },  // AB
  '1st_Grade [Auto proctor]': { type: 'latest', col: 30 }   // AD
};

// ── Entry points ──────────────────────────────────────────────
function doPost(e) {
  try {
    var raw     = e.parameter.data || e.postData.contents;
    var payload = JSON.parse(raw);
    writeToSheet_(payload);
    updateAssessment_(payload);
    if (payload.staffEmail) {
      sendResultEmail_(payload);
    }
    return jsonResponse_({ success: true });
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return jsonResponse_({ success: false, error: err.message });
  }
}

function doGet(e) {
  if ((e.parameter.action || '') === 'test') {
    return jsonResponse_({ ok: true, message: 'Exam script is reachable' });
  }
  return jsonResponse_({ ok: false, message: 'Use POST to submit results' });
}

// ── อัปเดต Assessment tab ใน Employee Master ─────────────────
// ค้นหา row จาก EmpID (col B) แล้วเขียน P/F ลงคอลัมน์ที่ตรงกับ exam
function updateAssessment_(payload) {
  try {
    var mapping = ASSESSMENT_MAP[payload.sheetName];
    if (!mapping) return; // exam นี้ไม่มีใน map ข้ามได้

    var pf    = (payload.percentage || 0) >= PASS_THRESHOLD ? 'P' : 'F';
    var round = String(parseInt(payload.round) || 1);

    var col;
    if (mapping.type === 'round') {
      col = mapping.cols[round];
      if (!col) {
        Logger.log('updateAssessment_: unknown round "' + round + '" for ' + payload.sheetName);
        return;
      }
    } else {
      col = mapping.col;
    }

    var sheet = SpreadsheetApp
      .openById(MASTER_SPREADSHEET_ID)
      .getSheetByName('Assessment');
    if (!sheet) { Logger.log('Assessment sheet not found'); return; }

    // EmpID อยู่ที่ col B (column index 2) — เหมือนกับ Employee tab
    var empIds = sheet.getRange(1, 2, sheet.getLastRow(), 1).getValues();
    for (var i = 0; i < empIds.length; i++) {
      if (String(empIds[i][0]).trim() === String(payload.staffId).trim()) {
        sheet.getRange(i + 1, col).setValue(pf);
        Logger.log('Assessment updated: row=' + (i+1) + ' col=' + col + ' val=' + pf);
        return;
      }
    }
    Logger.log('updateAssessment_: staffId ' + payload.staffId + ' not found');
  } catch (err) {
    Logger.log('updateAssessment_ error: ' + err.message);
  }
}

// ── Lookup ชื่อจริงจาก Employee sheet ────────────────────────
// col A = ลำดับ, col B = EmpID, col C = First Name, col D = Last Name
function lookupFullName_(staffId) {
  try {
    var sheet = SpreadsheetApp
      .openById(MASTER_SPREADSHEET_ID)
      .getSheetByName(MASTER_SHEET_NAME);
    if (!sheet) return null;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(staffId).trim()) {
        var first = String(data[i][2] || '').trim();
        var last  = String(data[i][3] || '').trim();
        return (first + ' ' + last).trim() || null;
      }
    }
  } catch (err) {
    Logger.log('lookupFullName_ error: ' + err.message);
  }
  return null;
}

// ── บันทึกผลสอบลง Testing score spreadsheet ──────────────────
function writeToSheet_(payload) {
  var passed = (payload.percentage || 0) >= PASS_THRESHOLD;
  var pf     = passed ? 'P' : 'F';
  var result = passed ? 'PASS' : 'FAIL';

  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = payload.sheetName || 'Results';
  var sheet     = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  var HEADERS = ['Timestamp', 'Staff Name', 'Staff ID', 'Branch', 'Trainer Name',
                 'Exam Date', 'Score', '%', 'P/F', 'Result', 'Round'];

  if (sheet.getLastRow() === 0) {
    var hr = sheet.getRange(1, 1, 1, HEADERS.length);
    hr.setValues([HEADERS]);
    hr.setFontWeight('bold');
    hr.setBackground('#1a1a2e');
    hr.setFontColor('#ffffff');
    hr.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }

  var row = [
    new Date(),
    payload.staffName   || '',
    payload.staffId     || '',
    payload.branch      || '',
    payload.trainerName || '',
    payload.examDate    || '',
    payload.totalScore  || 0,
    payload.percentage  || 0,
    pf,
    result,
    payload.round       || ''
  ];

  var newRow = sheet.getLastRow() + 1;
  sheet.getRange(newRow, 1, 1, row.length).setValues([row]);
  sheet.getRange(newRow, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
}

// ── ส่ง Email แจ้งผลสอบ ───────────────────────────────────────
function sendResultEmail_(payload) {
  var passed   = (payload.percentage || 0) >= PASS_THRESHOLD;
  var examName = (payload.sheetName  || 'Exam').replace(/_/g, ' ');
  var fullName = lookupFullName_(payload.staffId) || payload.staffName || 'Staff';

  var subject, html;
  if (passed) {
    subject = 'ยินดีด้วย! คุณสอบผ่าน — ' + examName;
    html = buildEmail_('ยินดีด้วย!', '#1a7a3c', fullName,
      '<p style="margin:0 0 16px;font-size:15px;color:#1a7a3c;font-weight:600">คุณสอบผ่านการประเมิน ' + examName + ' เรียบร้อยแล้ว</p>'
      + scoreTable_(payload, examName, passed)
      + '<p style="margin:20px 0 0;color:#334155">ขอแสดงความยินดีกับความสำเร็จครั้งนี้ และขอให้นำความรู้ที่ได้ไปใช้ในการทำงานให้เต็มที่นะครับ/ค่ะ</p>'
    );
  } else {
    subject = 'ผลการประเมิน — ' + examName;
    html = buildEmail_('ผลการประเมิน', '#1a1a2e', fullName,
      '<p style="margin:0 0 16px;font-size:15px;color:#b91c1c;font-weight:600">คุณยังไม่ผ่านการประเมิน ' + examName + ' ในครั้งนี้</p>'
      + scoreTable_(payload, examName, passed)
      + '<p style="margin:20px 0 0;color:#334155">คะแนนขั้นต่ำที่ต้องได้คือ <strong>' + PASS_THRESHOLD + '%</strong> กรุณาทบทวนเนื้อหาและติดต่อ Trainer เพื่อนัดสอบในครั้งถัดไปนะครับ/ค่ะ</p>'
    );
  }
  MailApp.sendEmail({ to: payload.staffEmail, subject: subject, htmlBody: html });
}

// ── Email helpers ─────────────────────────────────────────────
function buildEmail_(title, titleBg, fullName, body) {
  return '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">'
    + '<div style="background:' + titleBg + ';padding:20px 24px">'
    +   '<h2 style="margin:0;color:#fff;font-size:18px">' + title + '</h2>'
    +   '<p style="margin:4px 0 0;color:#94a3b8;font-size:13px">OWNDAYS Exam System</p>'
    + '</div>'
    + '<div style="padding:24px">'
    +   '<p style="margin:0 0 20px">เรียนคุณ <strong>' + fullName + '</strong>,</p>'
    +   body
    +   '<p style="margin:24px 0 0;font-size:12px;color:#94a3b8">อีเมลนี้ถูกส่งโดยอัตโนมัติจากระบบ OWNDAYS Exam System กรุณาอย่าตอบกลับ</p>'
    + '</div>'
    + '</div>';
}

function scoreTable_(payload, examName, passed) {
  var color = passed ? '#1a7a3c' : '#b91c1c';
  var text  = passed ? 'ผ่าน (PASS)' : 'ไม่ผ่าน (FAIL)';
  return '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:4px">'
    + row_('การประเมิน',  examName)
    + row_('วันที่สอบ',   payload.examDate    || '-')
    + row_('สาขา',        payload.branch      || '-')
    + row_('Trainer',     payload.trainerName || '-')
    + row_('คะแนนที่ได้', (payload.totalScore || 0) + ' / ' + (payload.maxScore || 0) + ' (' + (payload.percentage || 0) + '%)')
    + '<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:600">ผลการสอบ</td>'
    + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:' + color + '">' + text + '</td></tr>'
    + '</table>';
}

function row_(label, value) {
  return '<tr>'
    + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:600;white-space:nowrap">' + label + '</td>'
    + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">' + value + '</td>'
    + '</tr>';
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
