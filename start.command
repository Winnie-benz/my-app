#!/bin/zsh
# ดับเบิลคลิกไฟล์นี้เพื่อเริ่มงาน: ดึงโค้ดล่าสุด + เริ่ม server ทั้งคู่
cd "$(dirname "$0")"

# ติดตั้ง auto-push hook ถ้าเครื่องนี้ยังไม่มี (ทำครั้งเดียวอัตโนมัติ)
HOOK=".git/hooks/post-commit"
if [ ! -f "$HOOK" ]; then
  printf '#!/bin/sh\ngit push origin "$(git rev-parse --abbrev-ref HEAD)"\n' > "$HOOK"
  chmod +x "$HOOK"
  echo "✅ ติดตั้ง auto-push สำหรับเครื่องนี้แล้ว (commit ครั้งต่อไป push เอง)"
fi

echo "📥 ดึงโค้ดล่าสุดจาก GitHub..."
git pull --rebase --autostash

echo ""
echo "🚀 เริ่ม frontend + backend — ปิดหน้าต่างนี้เพื่อหยุด server"
npm run dev:all
