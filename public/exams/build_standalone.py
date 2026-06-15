#!/usr/bin/env python3
"""Builds a compressed self-contained portal HTML with all exams embedded."""

import os
import zlib
import base64

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
READY_DIR  = os.path.join(SCRIPT_DIR, 'ready')
OUT_FILE   = os.path.join(SCRIPT_DIR, 'portal-standalone.html')
PAKO_FILE  = os.path.join(SCRIPT_DIR, 'pako.min.js')

EXAMS = [
    ('njj-simulation.html', 'NJJ-Simulation Test'),
    ('1st-grade.html',      '1st Grade Simulation Test'),
    ('2nd-grade.html',      '2nd Grade Simulation Test'),
    ('3rd-grade.html',      '3rd Grade Simulation Test'),
    ('njj-checklist.html',  'NJJ Checklist'),
    ('mvc-checklist.html',  'MVC Checklist'),
    ('moc-checklist.html',  'MOC Checklist'),
]

entries = []
for filename, _ in EXAMS:
    path = os.path.join(READY_DIR, filename)
    with open(path, 'rb') as f:
        raw = f.read()
    compressed = zlib.compress(raw, level=9)
    b64 = base64.b64encode(compressed).decode('ascii')
    entries.append(f"'{filename}':'{b64}'")
    ratio = len(compressed) / len(raw) * 100
    print(f"  {filename}: {len(raw)//1024}KB → {len(compressed)//1024}KB ({ratio:.0f}%)")

exams_js    = ','.join(entries)
options_html = ''.join(f'<option value="{f}">{lbl}</option>' for f, lbl in EXAMS)

html = (
    '<!DOCTYPE html><html lang="en"><head>'
    '<meta charset="UTF-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
    '<title>OWNDAYS Exam Portal</title>'
    f'<script>{open(PAKO_FILE).read()}</script>'
    '<style>'
    '*{margin:0;padding:0;box-sizing:border-box}'
    'html,body{height:100%;overflow:hidden;font-family:sans-serif;background:#111}'
    '.bar{background:#111;color:#fff;padding:0 20px;display:flex;align-items:center;gap:14px;height:52px;border-bottom:1px solid #333}'
    '.bar label{font-size:13px;color:#999;white-space:nowrap}'
    '.bar select{padding:7px 12px;border-radius:6px;border:none;font-size:14px;background:#fff;cursor:pointer;min-width:260px}'
    '.ph{display:flex;align-items:center;justify-content:center;height:calc(100vh - 52px);color:#555;font-size:15px;background:#1a1a1a}'
    'iframe{width:100%;height:calc(100vh - 52px);border:none;display:none;background:#fff}'
    '</style></head><body>'
    '<div class="bar"><label>Select Course:</label>'
    '<select onchange="go(this.value)">'
    '<option value="">-- Select a Course --</option>'
    f'{options_html}'
    '</select></div>'
    '<div class="ph" id="ph">Please select a course above to begin.</div>'
    '<iframe id="fr" allowfullscreen></iframe>'
    '<script>'
    f'var E={{{exams_js}}},cur=null;'
    'function go(f){'
      'var fr=document.getElementById("fr"),ph=document.getElementById("ph");'
      'if(!f){fr.style.display="none";ph.style.display="flex";'
        'if(cur){URL.revokeObjectURL(cur);cur=null;}fr.src="about:blank";return;}'
      'var bin=Uint8Array.from(atob(E[f]),c=>c.charCodeAt(0));'
      'var out=pako.inflate(bin);'
      'var blob=new Blob([out],{type:"text/html;charset=utf-8"});'
      'if(cur)URL.revokeObjectURL(cur);'
      'cur=URL.createObjectURL(blob);'
      'ph.style.display="none";fr.style.display="block";fr.src=cur;'
    '}'
    '</script>'
    '</body></html>'
)

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write(html)

size_kb = os.path.getsize(OUT_FILE) / 1024
print(f"\nBuilt portal-standalone.html → {size_kb:.1f} KB")
print(f"Output: {OUT_FILE}")
