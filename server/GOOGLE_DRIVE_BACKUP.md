# Google Drive Backup

ระบบนี้ใช้ `Export Snapshot` จากฐานข้อมูลปัจจุบัน แล้วอัปโหลดไฟล์ `.db` ไปยัง Google Drive ผ่าน `rclone`

ค่าที่ตั้งเป็นค่าเริ่มต้นไว้แล้ว:

- Google account: `winnieoptic@gmail.com`
- Drive folder: `my-app-backups`

## 1. ตั้งค่า `.env`

ตรวจสอบให้มีค่าเหล่านี้ใน `server/.env`

```env
GDRIVE_BACKUP_ACCOUNT=winnieoptic@gmail.com
GDRIVE_RCLONE_REMOTE=gdrive
GDRIVE_BACKUP_FOLDER=my-app-backups
GDRIVE_BACKUP_SUBDIR=
GDRIVE_BACKUP_RETENTION_DAYS=90
RCLONE_BIN=rclone
```

ถ้า `GDRIVE_BACKUP_SUBDIR` ว่าง ระบบจะใช้ชื่อเครื่องอัตโนมัติ

## 2. ติดตั้ง rclone

ตัวอย่างบน Ubuntu/Debian:

```bash
curl https://rclone.org/install.sh | sudo bash
```

ตัวอย่างบน macOS:

```bash
sudo -v
curl https://rclone.org/install.sh | sudo bash
```

## 3. login Google Drive

รัน:

```bash
rclone config
```

ตั้งค่าประมาณนี้:

1. `n` เพื่อสร้าง remote ใหม่
2. ชื่อ remote: `gdrive`
3. storage type: `drive`
4. login ด้วยบัญชี `winnieoptic@gmail.com`

ตรวจสอบหลัง login:

```bash
rclone lsd gdrive:
```

## 4. ทดสอบ backup ด้วยมือ

จากโฟลเดอร์ `server`

```bash
npm run build
npm run backup:drive
```

ถ้าอยากทดสอบเฉพาะสร้างไฟล์ export โดยยังไม่อัปโหลด:

```bash
npm run backup:export
```

## 5. ตั้ง cron รายสัปดาห์

เปิด cron:

```bash
crontab -e
```

ตัวอย่างรันทุกวันอาทิตย์ 03:30:

```cron
30 3 * * 0 /Users/benz/my-app/server/scripts/weekly-drive-backup.sh >> /Users/benz/my-app/server/backup-cron.log 2>&1
```

เปลี่ยน path ให้ตรงกับตำแหน่งจริงบนเซิร์ฟเวอร์ของคุณ

## พฤติกรรมของระบบ

- โหมด `Turso`: สร้าง snapshot ชั่วคราว แล้วอัปโหลดขึ้น Google Drive
- โหมด `local SQLite`: export ไฟล์จากฐาน local แล้วอัปโหลดขึ้น Google Drive
- retention: ลบไฟล์เก่าบน Drive ที่อายุมากกว่า `GDRIVE_BACKUP_RETENTION_DAYS`

## path บน Google Drive

ไฟล์จะไปอยู่ประมาณนี้:

```text
gdrive:my-app-backups/<hostname>/<mode>/
```

โดย `<mode>` จะเป็น `turso` หรือ `local`
