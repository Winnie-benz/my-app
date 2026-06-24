import fs from 'fs'
import path from 'path'
import db, { DATA_DIR } from '../db/database'
import { nowTH, pad2, thaiClockParts, thaiNowDate } from '../utils/time'

const ARCHIVE_DIR = path.join(DATA_DIR, 'audit-archives')
const KEEP_DAYS = Number(process.env.AUDIT_LOG_KEEP_DAYS || '180') || 180
const ARCHIVE_RETENTION_DAYS = Number(process.env.AUDIT_LOG_ARCHIVE_RETENTION_DAYS || '1095') || 1095
const MAINTENANCE_HOUR = Number(process.env.AUDIT_LOG_MAINTENANCE_HOUR || '2') || 2
const MAINTENANCE_MINUTE = Number(process.env.AUDIT_LOG_MAINTENANCE_MINUTE || '15') || 15
const BATCH_SIZE = Math.max(100, Math.min(5000, Number(process.env.AUDIT_LOG_ARCHIVE_BATCH_SIZE || '1000') || 1000))

if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true })

type AuditArchiveEntry = {
  filename: string
  size: number
  created_at: string
}

type AuditLogRow = {
  id: number
  entity_type: string
  entity_id: string
  action: string
  before_data: string
  after_data: string
  changed_by: string
  changed_at: string
}

function archiveTimestamp(): string {
  const d = thaiNowDate()
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}_${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`
}

function cutoffTimestamp(days: number): string {
  const d = thaiNowDate()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

function fileAgeMs(createdAt: string): number {
  return Date.now() - new Date(createdAt).getTime()
}

export function getAuditLogPolicy() {
  const active = db.prepare('SELECT COUNT(*) AS count, MIN(changed_at) AS oldest_changed_at FROM audit_logs').get() as any

  return {
    keep_days: KEEP_DAYS,
    archive_retention_days: ARCHIVE_RETENTION_DAYS,
    archive_dir: ARCHIVE_DIR,
    maintenance_hour: MAINTENANCE_HOUR,
    maintenance_minute: MAINTENANCE_MINUTE,
    batch_size: BATCH_SIZE,
    active_count: Number(active?.count ?? 0),
    oldest_active_changed_at: active?.oldest_changed_at ?? null,
    archive_files_count: listAuditArchives().length,
  }
}

export function listAuditArchives(): AuditArchiveEntry[] {
  return fs.readdirSync(ARCHIVE_DIR)
    .filter(file => file.endsWith('.ndjson'))
    .map(file => {
      const stat = fs.statSync(path.join(ARCHIVE_DIR, file))
      return {
        filename: file,
        size: stat.size,
        created_at: stat.mtime.toISOString(),
      }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getAuditArchivePath(filename: string): string | null {
  const filePath = path.join(ARCHIVE_DIR, path.basename(filename))
  return fs.existsSync(filePath) ? filePath : null
}

function pruneOldAuditArchives() {
  if (ARCHIVE_RETENTION_DAYS <= 0) return

  const maxAgeMs = ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000
  for (const entry of listAuditArchives()) {
    if (fileAgeMs(entry.created_at) <= maxAgeMs) continue
    fs.rmSync(path.join(ARCHIVE_DIR, entry.filename), { force: true })
  }
}

function archiveRows(rows: AuditLogRow[], tag: 'auto' | 'catchup' | 'manual'): string {
  const filename = `audit_${tag}_${archiveTimestamp()}.ndjson`
  const filePath = path.join(ARCHIVE_DIR, filename)
  const archivedAt = nowTH()
  const payload = rows
    .map(row => JSON.stringify({ ...row, archived_at: archivedAt }))
    .join('\n') + '\n'

  fs.writeFileSync(filePath, payload, 'utf8')
  return filename
}

export function runAuditLogMaintenance(tag: 'auto' | 'catchup' | 'manual' = 'manual') {
  pruneOldAuditArchives()

  if (KEEP_DAYS <= 0) {
    return {
      archived_files: [] as string[],
      archived_rows: 0,
      deleted_rows: 0,
      policy: getAuditLogPolicy(),
    }
  }

  const cutoff = cutoffTimestamp(KEEP_DAYS)
  const archivedFiles: string[] = []
  let archivedRows = 0
  let deletedRows = 0

  while (true) {
    const rows = db.prepare(`
      SELECT id, entity_type, entity_id, action, before_data, after_data, changed_by, changed_at
      FROM audit_logs
      WHERE changed_at < ?
      ORDER BY changed_at ASC, id ASC
      LIMIT ?
    `).all(cutoff, BATCH_SIZE) as AuditLogRow[]

    if (rows.length === 0) break

    const filename = archiveRows(rows, tag)
    archivedFiles.push(filename)
    archivedRows += rows.length

    const placeholders = rows.map(() => '?').join(', ')
    db.prepare(`DELETE FROM audit_logs WHERE id IN (${placeholders})`).run(...rows.map(row => row.id))
    deletedRows += rows.length
  }

  pruneOldAuditArchives()

  return {
    archived_files: archivedFiles,
    archived_rows: archivedRows,
    deleted_rows: deletedRows,
    policy: getAuditLogPolicy(),
  }
}

export function scheduleAuditLogMaintenance() {
  console.log(
    `✅  Audit retention → active (keep ${KEEP_DAYS} days, archive ${ARCHIVE_RETENTION_DAYS} days, daily ${String(MAINTENANCE_HOUR).padStart(2, '0')}:${String(MAINTENANCE_MINUTE).padStart(2, '0')})`,
  )

  const maybeRun = (tag: 'auto' | 'catchup') => {
    const result = runAuditLogMaintenance(tag)
    if (result.archived_rows > 0) {
      console.log(`✅  Audit retention ${tag} → archived ${result.archived_rows} rows into ${result.archived_files.length} file(s)`)
    }
  }

  try {
    const now = thaiClockParts()
    if (
      now.hour > MAINTENANCE_HOUR ||
      (now.hour === MAINTENANCE_HOUR && now.minute >= MAINTENANCE_MINUTE)
    ) {
      maybeRun('catchup')
    }
  } catch (error) {
    console.error('Audit retention catch-up failed:', error)
  }

  setInterval(() => {
    const now = thaiClockParts()
    if (now.hour !== MAINTENANCE_HOUR || now.minute !== MAINTENANCE_MINUTE) return

    try {
      maybeRun('auto')
    } catch (error) {
      console.error('Audit retention failed:', error)
    }
  }, 60 * 1000)
}
