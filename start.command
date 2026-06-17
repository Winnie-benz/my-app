#!/bin/zsh
# ดับเบิลคลิกไฟล์นี้เพื่อเริ่มงาน: ดึงโค้ดล่าสุด + เริ่ม server ทั้งคู่
cd "$(dirname "$0")"

# ติดตั้ง/อัปเดต auto-push hook (push เฉพาะตอนอยู่บน branch จริง — ข้าม rebase)
HOOK=".git/hooks/post-commit"
printf '#!/bin/sh\nbranch=$(git symbolic-ref --short -q HEAD)\nif [ -n "$branch" ]; then\n  git push origin "$branch"\nfi\n' > "$HOOK"
chmod +x "$HOOK"

echo "📥 ดึงโค้ดล่าสุดจาก GitHub..."
git pull --rebase --autostash

echo ""
echo "🚀 เริ่ม frontend + backend — ปิดหน้าต่างนี้เพื่อหยุด server"
npm run dev:all
