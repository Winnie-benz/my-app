#!/usr/bin/env python3
"""Generates exam-portal.html combining all 8 exam HTML files with sendToSheet."""

import os
import re

SRC_DIR = os.path.join(os.path.dirname(__file__), 'cleaned')
OUT_FILE = os.path.join(os.path.dirname(__file__), 'exam-portal.html')

APPS_SCRIPT_URL = 'PASTE_YOUR_APPS_SCRIPT_URL_HERE'

EXAMS = [
    {
        'key': 'njj_simulation',
        'label': 'NJJ-Simulation Test',
        'file': 'njj-simulation.html',
        'sheet': 'NJJ_Simulation',
        'inject': r"""
<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = 'NJJ_Simulation';
  function sendToSheet() {
    var scoreText = (document.getElementById('total-score-display') || {}).textContent || '';
    var match = scoreText.match(/([\d.]+)\s*\/\s*([\d.]+)\s*\(([\d.]+)%\)/);
    var payload = {
      sheetName: SHEET_NAME,
      staffName: (document.getElementById('staff_name') || {}).value || '',
      staffId: (document.getElementById('staff_id') || {}).value || '',
      branch: (document.getElementById('branch') || {}).value || '',
      trainerName: (document.getElementById('trainer_name') || {}).value || '',
      examDate: (document.getElementById('test_date') || {}).value || '',
      totalScore: match ? parseFloat(match[1]) : 0,
      maxScore: match ? parseFloat(match[2]) : 0,
      percentage: match ? parseFloat(match[3]) : 0
    };
    var fd = new URLSearchParams();
    fd.append('data', JSON.stringify(payload));
    fetch(SEND_URL, { method: 'POST', mode: 'no-cors', body: fd })
      .catch(function(e) { console.error('sendToSheet:', e); });
  }
  window.addEventListener('load', function() {
    var btn = document.getElementById('export-pdf-btn');
    if (btn) btn.addEventListener('click', function() { setTimeout(sendToSheet, 0); });
  });
})();
</script>
""",
    },
    {
        'key': '1st_grade',
        'label': '1st Grade Simulation Test',
        'file': '1st-grade.html',
        'sheet': '1st_Grade',
        'inject': r"""
<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = '1st_Grade';
  function sendToSheet() {
    var payload = {
      sheetName: SHEET_NAME,
      staffName: (document.getElementById('info-staff-name') || {}).value || '',
      staffId: (document.getElementById('info-staff-id') || {}).value || '',
      branch: (document.getElementById('info-branch') || {}).value || '',
      trainerName: (document.getElementById('info-trainer-name') || {}).value || '',
      examDate: (document.getElementById('info-date') || {}).value || '',
      totalScore: parseFloat((document.getElementById('current-score') || {}).textContent) || 0,
      maxScore: parseFloat((document.getElementById('max-score') || {}).textContent) || 0,
      percentage: parseFloat((document.getElementById('current-percentage') || {}).textContent) || 0
    };
    var fd = new URLSearchParams();
    fd.append('data', JSON.stringify(payload));
    fetch(SEND_URL, { method: 'POST', mode: 'no-cors', body: fd })
      .catch(function(e) { console.error('sendToSheet:', e); });
  }
  window.addEventListener('load', function() {
    var btn = document.getElementById('submit-btn');
    if (btn) btn.addEventListener('click', function() { setTimeout(sendToSheet, 0); });
  });
})();
</script>
""",
    },
    {
        'key': '2nd_grade',
        'label': '2nd Grade Simulation Test',
        'file': '2nd-grade.html',
        'sheet': '2nd_Grade',
        'inject': r"""
<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = '2nd_Grade';
  function sendToSheet() {
    var payload = {
      sheetName: SHEET_NAME,
      staffName: (document.getElementById('info-staff-name') || {}).value || '',
      staffId: (document.getElementById('info-staff-id') || {}).value || '',
      branch: (document.getElementById('info-branch') || {}).value || '',
      trainerName: (document.getElementById('info-trainer-name') || {}).value || '',
      examDate: (document.getElementById('info-date') || {}).value || '',
      totalScore: parseFloat((document.getElementById('current-score') || {}).textContent) || 0,
      maxScore: parseFloat((document.getElementById('max-score') || {}).textContent) || 0,
      percentage: parseFloat((document.getElementById('current-percentage') || {}).textContent) || 0
    };
    var fd = new URLSearchParams();
    fd.append('data', JSON.stringify(payload));
    fetch(SEND_URL, { method: 'POST', mode: 'no-cors', body: fd })
      .catch(function(e) { console.error('sendToSheet:', e); });
  }
  window.addEventListener('load', function() {
    var btn = document.getElementById('submit-btn');
    if (btn) btn.addEventListener('click', function() { setTimeout(sendToSheet, 0); });
  });
})();
</script>
""",
    },
    {
        'key': '3rd_grade',
        'label': '3rd Grade Simulation Test',
        'file': '3rd-grade.html',
        'sheet': '3rd_Grade',
        'inject': r"""
<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = '3rd_Grade';
  function sendToSheet() {
    var payload = {
      sheetName: SHEET_NAME,
      staffName: (document.getElementById('info-staff-name') || {}).value || '',
      staffId: (document.getElementById('info-staff-id') || {}).value || '',
      branch: (document.getElementById('info-branch') || {}).value || '',
      trainerName: (document.getElementById('info-trainer-name') || {}).value || '',
      examDate: (document.getElementById('info-date') || {}).value || '',
      totalScore: parseFloat((document.getElementById('current-score') || {}).textContent) || 0,
      maxScore: parseFloat((document.getElementById('max-score') || {}).textContent) || 0,
      percentage: parseFloat((document.getElementById('current-percentage') || {}).textContent) || 0
    };
    var fd = new URLSearchParams();
    fd.append('data', JSON.stringify(payload));
    fetch(SEND_URL, { method: 'POST', mode: 'no-cors', body: fd })
      .catch(function(e) { console.error('sendToSheet:', e); });
  }
  window.addEventListener('load', function() {
    var btn = document.getElementById('submit-btn');
    if (btn) btn.addEventListener('click', function() { setTimeout(sendToSheet, 0); });
  });
})();
</script>
""",
    },
    {
        'key': 'njj_checklist',
        'label': 'NJJ Checklist',
        'file': 'njj-checklist.html',
        'sheet': 'NJJ_Checklist',
        'inject': r"""
<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = 'NJJ_Checklist';
  function sendToSheet() {
    var scoreText = (document.getElementById('score') || {}).textContent || '';
    var match = scoreText.match(/([\d.]+)\s*\/\s*([\d.]+)\s*\(([\d.]+)%\)/);
    var payload = {
      sheetName: SHEET_NAME,
      staffName: (document.getElementById('staffNameInput') || {}).value || '',
      staffId: (document.getElementById('staffIdInput') || {}).value || '',
      branch: (document.getElementById('branchInput') || {}).value || '',
      trainerName: (document.getElementById('trainerInput') || {}).value || '',
      examDate: (document.getElementById('dateInput') || {}).value || '',
      totalScore: match ? parseFloat(match[1]) : 0,
      maxScore: match ? parseFloat(match[2]) : 0,
      percentage: match ? parseFloat(match[3]) : 0
    };
    var fd = new URLSearchParams();
    fd.append('data', JSON.stringify(payload));
    fetch(SEND_URL, { method: 'POST', mode: 'no-cors', body: fd })
      .catch(function(e) { console.error('sendToSheet:', e); });
  }
  window.addEventListener('load', function() {
    var btn = document.getElementById('submitButton');
    if (btn) btn.addEventListener('click', function() { setTimeout(sendToSheet, 0); });
  });
})();
</script>
""",
    },
    {
        'key': 'pe_checklist',
        'label': 'PE-Checklist',
        'file': 'pe-checklist.html',
        'sheet': 'PE_Checklist',
        'inject': r"""
<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = 'PE_Checklist';
  window.addEventListener('load', function() {
    var origShowDone = window.showDone;
    if (typeof origShowDone !== 'function') return;
    window.showDone = function(result) {
      origShowDone.call(this, result);
      try {
        var s = result.scores;
        var staff = window.selectedStaff || {};
        if (s) {
          var payload = {
            sheetName: SHEET_NAME,
            staffName: staff.name || '',
            staffId: staff.staffId || '',
            branch: staff.branch || '',
            trainerName: staff.checkerBy || '',
            examDate: staff.date || '',
            totalScore: s.totalScore || 0,
            maxScore: 100,
            percentage: s.totalScore || 0
          };
          var fd = new URLSearchParams();
          fd.append('data', JSON.stringify(payload));
          fetch(SEND_URL, { method: 'POST', mode: 'no-cors', body: fd })
            .catch(function(e) { console.error('sendToSheet:', e); });
        }
      } catch(e) { console.error('sendToSheet error:', e); }
    };
  });
})();
</script>
""",
    },
    {
        'key': 'mvc_checklist',
        'label': 'MVC Checklist',
        'file': 'mvc-checklist.html',
        'sheet': 'MVC_Checklist',
        'inject': r"""
<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = 'MVC_Checklist';
  function sendToSheet() {
    var payload = {
      sheetName: SHEET_NAME,
      staffName: (document.getElementById('info-staff-name') || {}).value || '',
      staffId: (document.getElementById('info-staff-id') || {}).value || '',
      branch: (document.getElementById('info-branch') || {}).value || '',
      trainerName: (document.getElementById('info-trainer-name') || {}).value || '',
      examDate: (document.getElementById('info-date') || {}).value || '',
      totalScore: parseFloat((document.getElementById('current-score') || {}).textContent) || 0,
      maxScore: parseFloat((document.getElementById('max-score') || {}).textContent) || 0,
      percentage: parseFloat((document.getElementById('current-percentage') || {}).textContent) || 0
    };
    var fd = new URLSearchParams();
    fd.append('data', JSON.stringify(payload));
    fetch(SEND_URL, { method: 'POST', mode: 'no-cors', body: fd })
      .catch(function(e) { console.error('sendToSheet:', e); });
  }
  window.addEventListener('load', function() {
    var btn = document.getElementById('submit-btn');
    if (btn) btn.addEventListener('click', function() { setTimeout(sendToSheet, 0); });
  });
})();
</script>
""",
    },
    {
        'key': 'moc_checklist',
        'label': 'MOC Checklist',
        'file': 'moc-checklist.html',
        'sheet': 'MOC_Checklist',
        'inject': r"""
<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = 'MOC_Checklist';
  function sendToSheet() {
    var payload = {
      sheetName: SHEET_NAME,
      staffName: (document.getElementById('staff-name') || {}).value || '',
      staffId: (document.getElementById('staff-id') || {}).value || '',
      branch: (document.getElementById('branch') || {}).value || '',
      trainerName: (document.getElementById('trainer-name') || {}).value || '',
      examDate: (document.getElementById('date') || {}).value || '',
      totalScore: parseFloat((document.getElementById('grand-total') || {}).textContent) || 0,
      maxScore: parseFloat((document.getElementById('grand-max') || {}).textContent) || 0,
      percentage: parseFloat((document.getElementById('grand-percent') || {}).textContent) || 0
    };
    var fd = new URLSearchParams();
    fd.append('data', JSON.stringify(payload));
    fetch(SEND_URL, { method: 'POST', mode: 'no-cors', body: fd })
      .catch(function(e) { console.error('sendToSheet:', e); });
  }
  window.addEventListener('load', function() {
    var btn = document.getElementById('submit-btn');
    if (btn) btn.addEventListener('click', function() { setTimeout(sendToSheet, 0); });
  });
})();
</script>
""",
    },
]


def escape_for_js_template(html: str) -> str:
    html = html.replace('\\', '\\\\')
    html = html.replace('`', '\\`')
    html = html.replace('${', '\\${')
    # </script> inside a <script> block causes the browser HTML parser to close
    # the outer script early. Use < (unicode for '<') which JS evaluates
    # correctly but the HTML tokenizer does not treat as a closing tag.
    html = re.sub(r'<(/script)', r'\\u003c\1', html, flags=re.IGNORECASE)
    return html


def inject_send_to_sheet(html: str, inject_code: str, url: str) -> str:
    code = inject_code.replace('{{URL}}', url)
    if '</body>' in html:
        return html.replace('</body>', code + '</body>', 1)
    return html + code


def build_portal():
    exam_js_entries = []
    option_tags = []

    for exam in EXAMS:
        path = os.path.join(SRC_DIR, exam['file'])
        with open(path, 'r', encoding='utf-8') as f:
            html = f.read()

        html = inject_send_to_sheet(html, exam['inject'], APPS_SCRIPT_URL)
        escaped = escape_for_js_template(html)

        exam_js_entries.append(
            f"  '{exam['key']}': `{escaped}`"
        )
        option_tags.append(
            f'      <option value="{exam["key"]}">{exam["label"]}</option>'
        )

    exams_js = ',\n'.join(exam_js_entries)
    options_html = '\n'.join(option_tags)

    wrapper = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OWNDAYS Exam Portal</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    html, body {{ height: 100%; overflow: hidden; font-family: sans-serif; background: #f0f0f0; }}
    .top-bar {{
      background: #111;
      color: #fff;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      height: 48px;
    }}
    .top-bar label {{
      font-size: 13px;
      color: #bbb;
      white-space: nowrap;
    }}
    .top-bar select {{
      padding: 6px 12px;
      border-radius: 6px;
      border: none;
      font-size: 14px;
      background: #fff;
      cursor: pointer;
      min-width: 240px;
    }}
    .placeholder {{
      display: flex;
      align-items: center;
      justify-content: center;
      height: calc(100vh - 48px);
      color: #999;
      font-size: 15px;
    }}
    iframe {{
      width: 100%;
      height: calc(100vh - 48px);
      border: none;
      display: none;
    }}
  </style>
</head>
<body>
  <div class="top-bar">
    <label>Select Course:</label>
    <select id="courseSelect" onchange="loadCourse(this.value)">
      <option value="">-- Select a Course --</option>
{options_html}
    </select>
  </div>
  <div class="placeholder" id="placeholder">Please select a course above to begin.</div>
  <iframe id="examFrame" allowfullscreen></iframe>

  <script>
    var EXAMS = {{
{exams_js}
    }};

    function loadCourse(key) {{
      var frame = document.getElementById('examFrame');
      var placeholder = document.getElementById('placeholder');
      if (!key) {{
        frame.style.display = 'none';
        placeholder.style.display = 'flex';
        frame.srcdoc = '';
        return;
      }}
      var html = EXAMS[key];
      if (!html) return;
      placeholder.style.display = 'none';
      frame.style.display = 'block';
      frame.srcdoc = html;
    }}
  </script>
</body>
</html>
"""

    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        f.write(wrapper)

    size_kb = os.path.getsize(OUT_FILE) / 1024
    print(f"Generated: {OUT_FILE}")
    print(f"File size: {size_kb:.1f} KB")


if __name__ == '__main__':
    build_portal()
