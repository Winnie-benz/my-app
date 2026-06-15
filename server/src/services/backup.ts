import fs from 'fs'
import path from 'path'
import db, { DATA_DIR, DB_PATH } from '../db/database'

const BACKUP_DIR  = path.join(DATA_DIR, 'backups')
const RESTORE_REQUEST_PATH = path.join(DATA_DIR, 'restore-request.json')
const MAX_DAILY_BACKUPS   = 30  // keep 30 days of daily backups
const MAX_WEEKLY_BACKUPS  = 12  // keep 12 weeks of weekly backups

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${ms}`
}

const USE_REMOTE = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN)

export function createBackup(
  tag: 'daily' | 'weekly' | 'manual' = 'manual',
  options?: { skipPrune?: boolean },
): string {
  if (USE_REMOTE) {
    // On Turso cloud, durability + point-in-time recovery is handled by Turso
    // itself; VACUUM INTO a local file is not supported over the remote connection.
    throw new Error('ใช้ Turso cloud อยู่ — สำรองข้อมูลผ่าน Turso (ไม่ต้องสำรองไฟล์ในเครื่อง)')
  }
  const filename = `shop_${tag}_${timestamp()}.db`
  const dest     = path.join(BACKUP_DIR, filename)
  db.prepare('VACUUM INTO ?').run(dest)
  if (!options?.skipPrune) pruneOldBackups()
  return filename
}

function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function alreadyBackedUpToday(tag: 'daily' | 'weekly'): boolean {
  const today = todayStr()
  return listBackups().some(f => f.filename.includes(`_${tag}_${today}`))
}

export function listBackups(): { filename: string; size: number; created_at: string }[] {
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db'))
    .map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f))
      return { filename: f, size: stat.size, created_at: stat.mtime.toISOString() }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getBackupPath(filename: string): string | null {
  const p = path.join(BACKUP_DIR, path.basename(filename))
  return fs.existsSync(p) ? p : null
}

export function deleteBackup(filename: string): boolean {
  const p = path.join(BACKUP_DIR, path.basename(filename))
  if (!fs.existsSync(p)) return false
  fs.unlinkSync(p)
  return true
}

export function queueRestore(filename: string): { filename: string; safety_backup: string } {
  const backupPath = getBackupPath(filename)
  if (!backupPath) throw new Error('Backup not found')

  const safetyBackup = createBackup('manual', { skipPrune: true })
  fs.writeFileSync(RESTORE_REQUEST_PATH, JSON.stringify({
    backupPath,
    requestedAt: new Date().toISOString(),
    safetyBackup,
    dbPath: DB_PATH,
  }, null, 2))
  pruneOldBackups([filename, safetyBackup])

  return { filename, safety_backup: safetyBackup }
}

function pruneOldBackups(preserve: string[] = []) {
  const preserveSet = new Set(preserve)
  const files = listBackups()
  const dailies  = files.filter(f => f.filename.includes('_daily_'))
  const weeklies = files.filter(f => f.filename.includes('_weekly_'))
  const manuals  = files.filter(f => f.filename.includes('_manual_') || (!f.filename.includes('_daily_') && !f.filename.includes('_weekly_')))

  for (const f of dailies.slice(MAX_DAILY_BACKUPS).filter(f => !preserveSet.has(f.filename))) {
    fs.unlinkSync(path.join(BACKUP_DIR, f.filename))
  }
  for (const f of weeklies.slice(MAX_WEEKLY_BACKUPS).filter(f => !preserveSet.has(f.filename))) {
    fs.unlinkSync(path.join(BACKUP_DIR, f.filename))
  }
  // keep up to 10 manual backups
  for (const f of manuals.slice(10).filter(f => !preserveSet.has(f.filename))) {
    fs.unlinkSync(path.join(BACKUP_DIR, f.filename))
  }
}

export function scheduleAutoBackup() {
  // Don't backup immediately on startup to avoid restart spam
  // Instead, check every hour and backup once per day at 02:00
  console.log('✅  Auto-backup  →  scheduler active (daily at 02:00, weekly on Sunday)')

  setInterval(() => {
    const now = new Date()
    const hour = now.getHours()
    const dow  = now.getDay()   // 0 = Sunday

    try {
      // Daily backup at 02:xx
      if (hour === 2 && !alreadyBackedUpToday('daily')) {
        const name = createBackup('daily')
        console.log(`✅  Auto-backup daily  →  ${name}`)
      }
      // Weekly backup on Sunday 03:xx
      if (dow === 0 && hour === 3 && !alreadyBackedUpToday('weekly')) {
        const name = createBackup('weekly')
        console.log(`✅  Auto-backup weekly →  ${name}`)
      }
    } catch (e) {
      console.error('Auto-backup failed:', e)
    }
  }, 60 * 60 * 1000)  // check every hour
}
