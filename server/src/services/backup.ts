import fs from 'fs'
import path from 'path'
import Database from 'libsql'
import db, { DATA_DIR, DB_PATH } from '../db/database'

const BACKUP_DIR  = path.join(DATA_DIR, 'backups')
const EXPORT_DIR  = path.join(DATA_DIR, 'exports')
const RESTORE_REQUEST_PATH = path.join(DATA_DIR, 'restore-request.json')
const MAX_DAILY_BACKUPS   = 30  // keep 30 days of daily backups
const MAX_WEEKLY_BACKUPS  = 12  // keep 12 weeks of weekly backups
const EXPORT_RETENTION_COUNT = Number(process.env.EXPORT_BACKUP_RETENTION_COUNT || '30') || 30
const EXPORT_HOUR = Number(process.env.EXPORT_BACKUP_HOUR || '19') || 19

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true })

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${ms}`
}

const USE_REMOTE = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN)

export function getBackupMode() {
  return {
    mode: USE_REMOTE ? 'turso' : 'local',
    supports_restore: !USE_REMOTE,
    backup_dir: BACKUP_DIR,
    export_dir: EXPORT_DIR,
    auto_export_hour: EXPORT_HOUR,
    export_retention_count: EXPORT_RETENTION_COUNT,
  }
}

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

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

function exportTimestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function exportTodayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

type ExportEntry = { filename: string; size: number; created_at: string }

export function listExportBackups(): ExportEntry[] {
  return fs.readdirSync(EXPORT_DIR)
    .filter(f => f.endsWith('.db'))
    .map(f => {
      const stat = fs.statSync(path.join(EXPORT_DIR, f))
      return { filename: f, size: stat.size, created_at: stat.mtime.toISOString() }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getExportBackupPath(filename: string): string | null {
  const p = path.join(EXPORT_DIR, path.basename(filename))
  return fs.existsSync(p) ? p : null
}

export function deleteExportBackup(filename: string): boolean {
  const p = path.join(EXPORT_DIR, path.basename(filename))
  if (!fs.existsSync(p)) return false
  fs.unlinkSync(p)
  return true
}

function pruneExportBackups(preserve: string[] = []) {
  const preserveSet = new Set(preserve)
  for (const f of listExportBackups().slice(EXPORT_RETENTION_COUNT).filter(f => !preserveSet.has(f.filename))) {
    fs.unlinkSync(path.join(EXPORT_DIR, f.filename))
  }
}

function exportRemoteDatabase(dest: string) {
  const local = new Database(dest)
  const schemaRows = db.prepare(`
    SELECT type, name, tbl_name, sql
    FROM sqlite_schema
    WHERE sql IS NOT NULL
      AND name NOT LIKE 'sqlite_%'
    ORDER BY CASE type
      WHEN 'table' THEN 0
      WHEN 'index' THEN 2
      WHEN 'trigger' THEN 3
      WHEN 'view' THEN 4
      ELSE 5
    END, name
  `).all() as { type: string; name: string; tbl_name: string; sql: string }[]
  const tables = schemaRows.filter(row => row.type === 'table')

  local.exec('PRAGMA foreign_keys = OFF')
  local.exec('BEGIN')
  try {
    for (const row of schemaRows) local.exec(row.sql)

    for (const table of tables) {
      const rows = db.prepare(`SELECT * FROM ${quoteIdent(table.name)}`).all() as Record<string, unknown>[]
      if (rows.length === 0) continue

      const columns = Object.keys(rows[0])
      const sql = `
        INSERT INTO ${quoteIdent(table.name)} (${columns.map(quoteIdent).join(', ')})
        VALUES (${columns.map(() => '?').join(', ')})
      `
      const stmt = local.prepare(sql)
      for (const row of rows) stmt.run(...columns.map(column => row[column]))
    }

    local.exec('COMMIT')
  } catch (error) {
    try { local.exec('ROLLBACK') } catch {}
    throw error
  } finally {
    try { local.exec('PRAGMA foreign_keys = ON') } catch {}
  }
}

export function createExportBackup(tag: 'manual' | 'auto' | 'catchup' = 'manual'): ExportEntry {
  const filename = `export_${tag}_${exportTimestamp()}.db`
  const dest = path.join(EXPORT_DIR, filename)

  try {
    if (USE_REMOTE) {
      exportRemoteDatabase(dest)
    } else {
      db.prepare('VACUUM INTO ?').run(dest)
    }
  } catch (error) {
    fs.rmSync(dest, { force: true })
    throw error
  }

  pruneExportBackups([filename])
  const stat = fs.statSync(dest)
  return { filename, size: stat.size, created_at: stat.mtime.toISOString() }
}

function alreadyExportedToday(): boolean {
  const today = exportTodayStr()
  return listExportBackups().some(f => f.filename.includes(`_${today}_`))
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
  if (USE_REMOTE) {
    throw new Error('Restore ถูกปิดเมื่อใช้ Turso — ให้ใช้ export backup สำหรับ controlled restore เท่านั้น')
  }
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
  console.log(`✅  Export backup  →  scheduler active (daily at ${String(EXPORT_HOUR).padStart(2, '0')}:00, retention ${EXPORT_RETENTION_COUNT})`)

  const maybeExport = (tag: 'auto' | 'catchup') => {
    if (alreadyExportedToday()) return
    const name = createExportBackup(tag).filename
    console.log(`✅  Export backup ${tag} →  ${name}`)
  }

  try {
    const now = new Date()
    if (now.getHours() >= EXPORT_HOUR) maybeExport('catchup')
  } catch (e) {
    console.error('Export backup catch-up failed:', e)
  }

  setInterval(() => {
    const now = new Date()
    const hour = now.getHours()

    try {
      if (hour === EXPORT_HOUR) maybeExport('auto')
    } catch (e) {
      console.error('Export backup failed:', e)
    }
  }, 60 * 1000)
}
