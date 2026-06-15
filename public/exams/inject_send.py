#!/usr/bin/env python3
"""Injects sendToSheet into each individual exam HTML file."""

import os

SRC_DIR = os.path.join(os.path.dirname(__file__), 'cleaned')
OUT_DIR = os.path.join(os.path.dirname(__file__), 'ready')
os.makedirs(OUT_DIR, exist_ok=True)

APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzaRX-3Wko8Xuyg81OhsaoQoWjU3akRv2mKP7Y2YjZAoWmUek4JxsDwCZYhXzDiOjki/exec'

# Shared helper — posts payload via hidden form (works in any sandbox/iframe context)
POST_FN = """
  function _post(payload) {
    try {
      var ifr = document.createElement('iframe');
      ifr.name = '_sh' + Date.now();
      ifr.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden;';
      document.body.appendChild(ifr);
      var f = document.createElement('form');
      f.method = 'POST'; f.action = SEND_URL; f.target = ifr.name;
      var inp = document.createElement('input');
      inp.type = 'hidden'; inp.name = 'data'; inp.value = JSON.stringify(payload);
      f.appendChild(inp);
      document.body.appendChild(f);
      f.submit();
      setTimeout(function(){
        try{document.body.removeChild(f);document.body.removeChild(ifr);}catch(e){}
      }, 3000);
    } catch(e) { console.error('sendToSheet:', e); }
  }"""

EXAMS = [
    {
        'file': 'njj-simulation.html',
        'inject': """<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = 'NJJ_Simulation';
  POSTFN
  document.addEventListener('click', function(e) {
    var t = e.target;
    if (!t) return;
    if (t.id !== 'export-pdf-btn' && (!t.closest || !t.closest('#export-pdf-btn'))) return;
    var scoreText = (document.getElementById('total-score-display') || {}).textContent || '';
    var match = scoreText.match(/([\\d.]+)\\s*\\/\\s*([\\d.]+)\\s*\\(([\\d.]+)%\\)/);
    _post({
      sheetName: SHEET_NAME,
      staffName: (document.getElementById('staff_name') || {}).value || '',
      staffId: (document.getElementById('staff_id') || {}).value || '',
      branch: (document.getElementById('branch') || {}).value || '',
      trainerName: (document.getElementById('trainer_name') || {}).value || '',
      examDate: (document.getElementById('test_date') || {}).value || '',
      totalScore: match ? parseFloat(match[1]) : 0,
      maxScore: match ? parseFloat(match[2]) : 0,
      percentage: match ? parseFloat(match[3]) : 0,
      round: (document.querySelector('input[name="sim_round"]:checked') || {}).value || ''
    });
  }, true);
})();
</script>""",
    },
    {
        'file': '1st-grade.html',
        'inject': """<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = '1st_Grade';
  POSTFN
  window.addEventListener('load', function() {
    var btn = document.getElementById('submit-btn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var optPct  = parseFloat((document.getElementById('optical-skill-percentage') || {}).textContent) || 0;
      var hlthPct = parseFloat((document.getElementById('health-check-percentage') || {}).textContent) || 0;
      _post({
        sheetName: SHEET_NAME,
        staffName: (document.getElementById('info-staff-name') || {}).value || '',
        staffId: (document.getElementById('info-staff-id') || {}).value || '',
        branch: (document.getElementById('info-branch') || {}).value || '',
        trainerName: (document.getElementById('info-trainer-name') || {}).value || '',
        examDate: (document.getElementById('info-date') || {}).value || '',
        totalScore: parseFloat((document.getElementById('current-score') || {}).textContent) || 0,
        maxScore: parseFloat((document.getElementById('max-score') || {}).textContent) || 0,
        percentage: parseFloat((document.getElementById('current-percentage') || {}).textContent) || 0,
        pf: (optPct >= 80 && hlthPct >= 80) ? 'P' : 'F'
      });
    });
  });
})();
</script>""",
    },
    {
        'file': '2nd-grade.html',
        'inject': """<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = '2nd_Grade';
  POSTFN
  window.addEventListener('load', function() {
    var btn = document.getElementById('submit-btn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var optPct  = parseFloat((document.getElementById('optical-skill-percentage') || {}).textContent) || 0;
      var hlthPct = parseFloat((document.getElementById('health-check-percentage') || {}).textContent) || 0;
      _post({
        sheetName: SHEET_NAME,
        staffName: (document.getElementById('info-staff-name') || {}).value || '',
        staffId: (document.getElementById('info-staff-id') || {}).value || '',
        branch: (document.getElementById('info-branch') || {}).value || '',
        trainerName: (document.getElementById('info-trainer-name') || {}).value || '',
        examDate: (document.getElementById('info-date') || {}).value || '',
        totalScore: parseFloat((document.getElementById('current-score') || {}).textContent) || 0,
        maxScore: parseFloat((document.getElementById('max-score') || {}).textContent) || 0,
        percentage: parseFloat((document.getElementById('current-percentage') || {}).textContent) || 0,
        pf: (optPct >= 80 && hlthPct >= 80) ? 'P' : 'F'
      });
    });
  });
})();
</script>""",
    },
    {
        'file': '3rd-grade.html',
        'inject': """<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = '3rd_Grade';
  POSTFN
  window.addEventListener('load', function() {
    var btn = document.getElementById('submit-btn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var optPct  = parseFloat((document.getElementById('section-15-percentage') || {}).textContent) || 0;
      var hlthPct = parseFloat((document.getElementById('section-16-percentage') || {}).textContent) || 0;
      _post({
        sheetName: SHEET_NAME,
        staffName: (document.getElementById('info-staff-name') || {}).value || '',
        staffId: (document.getElementById('info-staff-id') || {}).value || '',
        branch: (document.getElementById('info-branch') || {}).value || '',
        trainerName: (document.getElementById('info-trainer-name') || {}).value || '',
        examDate: (document.getElementById('info-date') || {}).value || '',
        totalScore: parseFloat((document.getElementById('current-score') || {}).textContent) || 0,
        maxScore: parseFloat((document.getElementById('max-score') || {}).textContent) || 0,
        percentage: parseFloat((document.getElementById('current-percentage') || {}).textContent) || 0,
        pf: (optPct >= 80 && hlthPct >= 80) ? 'P' : 'F'
      });
    });
  });
})();
</script>""",
    },
    {
        'file': 'njj-checklist.html',
        'inject': """<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = 'NJJ_Checklist';
  POSTFN
  window.addEventListener('load', function() {
    var btn = document.getElementById('submitButton');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var scoreText = (document.getElementById('score') || {}).textContent || '';
      var match = scoreText.match(/([\\d.]+)\\s*\\/\\s*([\\d.]+)\\s*\\(([\\d.]+)%\\)/);
      _post({
        sheetName: SHEET_NAME,
        staffName: (document.getElementById('staffNameInput') || {}).value || '',
        staffId: (document.getElementById('staffIdInput') || {}).value || '',
        branch: (document.getElementById('branchInput') || {}).value || '',
        trainerName: (document.getElementById('trainerInput') || {}).value || '',
        examDate: (document.getElementById('dateInput') || {}).value || '',
        totalScore: match ? parseFloat(match[1]) : 0,
        maxScore: match ? parseFloat(match[2]) : 0,
        percentage: match ? parseFloat(match[3]) : 0,
        round: (document.querySelector('input[name="round"]:checked') || {}).value || ''
      });
    });
  });
})();
</script>""",
    },
    {
        'file': 'pe-checklist.html',
        'inject': """<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = 'PE_Checklist';
  POSTFN
  window.addEventListener('load', function() {
    var origShowDone = window.showDone;
    if (typeof origShowDone !== 'function') return;
    window.showDone = function(result) {
      origShowDone.call(this, result);
      try {
        var s = result.scores;
        var staff = window.selectedStaff || {};
        if (s) {
          _post({
            sheetName: SHEET_NAME,
            staffName: staff.name || '',
            staffId: staff.staffId || '',
            branch: staff.branch || '',
            trainerName: staff.checkerBy || '',
            examDate: staff.date || '',
            totalScore: s.totalScore || 0,
            maxScore: 100,
            percentage: s.totalScore || 0
          });
        }
      } catch(e) { console.error('sendToSheet error:', e); }
    };
  });
})();
</script>""",
    },
    {
        'file': 'mvc-checklist.html',
        'inject': """<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = 'MVC_Checklist';
  POSTFN
  window.addEventListener('load', function() {
    var btn = document.getElementById('submit-btn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      _post({
        sheetName: SHEET_NAME,
        staffName: (document.getElementById('info-staff-name') || {}).value || '',
        staffId: (document.getElementById('info-staff-id') || {}).value || '',
        branch: (document.getElementById('info-branch') || {}).value || '',
        trainerName: (document.getElementById('info-trainer-name') || {}).value || '',
        examDate: (document.getElementById('info-date') || {}).value || '',
        totalScore: parseFloat((document.getElementById('health-check-score') || {}).textContent) || 0,
        maxScore: parseFloat((document.getElementById('health-check-max-score') || {}).textContent) || 0,
        percentage: parseFloat((document.getElementById('health-check-percentage') || {}).textContent) || 0
      });
    });
  });
})();
</script>""",
    },
    {
        'file': 'moc-checklist.html',
        'inject': """<script>
(function() {
  var SEND_URL = '{{URL}}';
  var SHEET_NAME = 'MOC_Checklist';
  POSTFN
  document.addEventListener('click', function(e) {
    var t = e.target;
    if (!t) return;
    if (t.id !== 'submit-btn' && (!t.closest || !t.closest('#submit-btn'))) return;
    _post({
      sheetName: SHEET_NAME,
      staffName: (document.getElementById('staff-name') || {}).value || '',
      staffId: (document.getElementById('staff-id') || {}).value || '',
      branch: (document.getElementById('branch') || {}).value || '',
      trainerName: (document.getElementById('trainer-name') || {}).value || '',
      examDate: (document.getElementById('date') || {}).value || '',
      totalScore: parseFloat((document.getElementById('grand-total') || {}).textContent) || 0,
      maxScore: parseFloat((document.getElementById('grand-max') || {}).textContent) || 0,
      percentage: parseFloat((document.getElementById('grand-percent') || {}).textContent) || 0
    });
  }, true);
})();
</script>""",
    },
]


def inject_and_save(exam):
    src_path = os.path.join(SRC_DIR, exam['file'])
    out_path = os.path.join(OUT_DIR, exam['file'])

    with open(src_path, 'r', encoding='utf-8') as f:
        html = f.read()

    code = exam['inject'].replace('{{URL}}', APPS_SCRIPT_URL).replace('POSTFN', POST_FN)

    if '</body>' in html:
        html = html.replace('</body>', code + '\n</body>', 1)
    else:
        html = html + '\n' + code

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)

    size_kb = os.path.getsize(out_path) / 1024
    print(f"  {exam['file']} → ready/{exam['file']} ({size_kb:.0f} KB)")


if __name__ == '__main__':
    print(f"Injecting sendToSheet into exam files → {OUT_DIR}/")
    for exam in EXAMS:
        inject_and_save(exam)
    print("Done.")
