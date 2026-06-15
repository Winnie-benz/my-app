import fs from 'fs'
import path from 'path'
import db, { DATA_DIR, DB_PATH, USE_REMOTE } from '../db/database'

const BACKUP_DIR  = path.join(DATA_DIR, 'backups')
const RESTORE_REQUEST_PATH = path.join(DATA_DIR, 'restore-request.json')
const MAX_DAILY_BACKUPS   = 30  // keep 30 days of daily backups
const MAX_WEEKLY_BACKUPS  = 12  // keep 12 weeks of weekly backups

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

ensureBackupDir()

const TURSO_BACKUP_MESSAGE = 'เปิดใช้งาน Turso อยู่ ระบบจึงปิด backup/restore แบบไฟล์ในเครื่องเพื่อป้องกันข้อมูลคนละเครื่องไม่ตรงกัน'

export function getBackupStatus() {
  return {
    enabled: !USE_REMOTE,
    mode: USE_REMOTE ? 'turso' : 'local',
    message: USE_REMOTE ? TURSO_BACKUP_MESSAGE : 'ระบบสำรองไฟล์ SQLite ในเครื่อง',
  } as const
}

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${ms}`
}

export function createBackup(
  tag: 'daily' | 'weekly' | 'manual' = 'manual',
  options?: { skipPrune?: boolean },
): string {
  if (USE_REMOTE) throw new Error(TURSO_BACKUP_MESSAGE)
  ensureBackupDir()
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
  if (USE_REMOTE) return []
  ensureBackupDir()
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db'))
    .flatMap(f => {
      try {
        const stat = fs.statSync(path.join(BACKUP_DIR, f))
        return [{ filename: f, size: stat.size, created_at: stat.mtime.toISOString() }]
      } catch (error: any) {
        if (error?.code !== 'ENOENT') throw error
        return []
      }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getBackupPath(filename: string): string | null {
  if (USE_REMOTE) return null
  const p = path.join(BACKUP_DIR, path.basename(filename))
  return fs.existsSync(p) ? p : null
}

export function deleteBackup(filename: string): boolean {
  if (USE_REMOTE) throw new Error(TURSO_BACKUP_MESSAGE)
  const p = path.join(BACKUP_DIR, path.basename(filename))
  if (!fs.existsSync(p)) return false
  fs.unlinkSync(p)
  return true
}

export function queueRestore(filename: string): { filename: string; safety_backup: string } {
  if (USE_REMOTE) throw new Error(TURSO_BACKUP_MESSAGE)
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
  if (USE_REMOTE) {
    console.log('✅  Auto-backup  →  disabled in app while Turso sync is active')
    return
  }
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
