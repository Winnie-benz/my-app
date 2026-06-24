import { Router, Request, Response } from 'express'
import { spawn } from 'child_process'
import db from '../db/database'
import { requireAuth, requireAdmin } from '../middleware/requireAuth'
import {
  createBackup,
  createExportBackup,
  deleteBackup,
  deleteExportBackup,
  getBackupMode,
  getBackupPath,
  getExportBackupPath,
  listBackups,
  listExportBackups,
  queueRestore,
} from '../services/backup'
import {
  getAuditArchivePath,
  getAuditLogPolicy,
  listAuditArchives,
  runAuditLogMaintenance,
} from '../services/auditRetention'

const router = Router()
router.use(requireAuth, requireAdmin)

function scheduleRestartAfterRestore() {
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      process.exit(0)
    }, 300)
    return
  }

  const shell = process.platform === 'win32' ? 'cmd' : 'sh'
  const args = process.platform === 'win32'
    ? ['/c', 'timeout /t 1 >nul && npm run dev']
    : ['-lc', 'sleep 1 && npm run dev']

  const child = spawn(shell, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  setTimeout(() => {
    process.exit(0)
  }, 100)
}

router.get('/backups/status', (_req: Request, res: Response) => {
  res.json({ success: true, data: getBackupMode() })
})

router.get('/audit-logs', (req: Request, res: Response) => {
  const rawLimit = Number(req.query.limit ?? 30)
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(100, Math.floor(rawLimit)))
    : 30
  const rawOffset = Number(req.query.offset ?? 0)
  const offset = Number.isFinite(rawOffset)
    ? Math.max(0, Math.floor(rawOffset))
    : 0
  const entityType = String(req.query.entity_type ?? '').trim()
  const action = String(req.query.action ?? '').trim()
  const q = String(req.query.q ?? '').trim()
  const from = String(req.query.from ?? '').trim()
  const to = String(req.query.to ?? '').trim()

  const conditions: string[] = []
  const params: Array<string | number> = []

  if (entityType) {
    conditions.push('entity_type = ?')
    params.push(entityType)
  }
  if (action) {
    conditions.push('action = ?')
    params.push(action)
  }
  if (q) {
    conditions.push('(entity_id LIKE ? OR changed_by LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  if (from) {
    conditions.push('changed_at >= ?')
    params.push(`${from} 00:00:00`)
  }
  if (to) {
    conditions.push('changed_at <= ?')
    params.push(`${to} 23:59:59`)
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = db.prepare(`
    SELECT COUNT(*) AS total
    FROM audit_logs
    ${whereSql}
  `).get(...params) as any

  const rows = db.prepare(`
    SELECT id, entity_type, entity_id, action, changed_by, changed_at
    FROM audit_logs
    ${whereSql}
    ORDER BY changed_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  const total = Number(totalRow?.total ?? 0)
  res.json({
    success: true,
    data: rows,
    meta: {
      total,
      limit,
      offset,
      has_more: offset + rows.length < total,
    },
  })
})

router.get('/audit-logs/status', (_req: Request, res: Response) => {
  res.json({ success: true, data: getAuditLogPolicy() })
})

router.post('/audit-logs/maintenance', (_req: Request, res: Response) => {
  try {
    const result = runAuditLogMaintenance('manual')
    res.json({ success: true, data: result })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/audit-archives', (_req: Request, res: Response) => {
  res.json({ success: true, data: listAuditArchives() })
})

router.get('/audit-archives/:filename', (req: Request, res: Response) => {
  const p = getAuditArchivePath(req.params.filename)
  if (!p) { res.status(404).json({ success: false, error: 'Audit archive not found' }); return }
  res.download(p)
})

router.get('/backups', (_req: Request, res: Response) => {
  res.json({ success: true, data: listBackups() })
})

router.post('/backups', (_req: Request, res: Response) => {
  try {
    const filename = createBackup('manual')
    res.json({ success: true, filename })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/backups/:filename', (req: Request, res: Response) => {
  const p = getBackupPath(req.params.filename)
  if (!p) { res.status(404).json({ success: false, error: 'Backup not found' }); return }
  res.download(p)
})

router.post('/backups/:filename/restore', (req: Request, res: Response) => {
  try {
    const result = queueRestore(req.params.filename)
    res.json({
      success: true,
      message: 'ระบบกำลัง restore backup และจะรีสตาร์ตอัตโนมัติ',
      ...result,
    })
    scheduleRestartAfterRestore()
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/exports', (_req: Request, res: Response) => {
  res.json({ success: true, data: listExportBackups() })
})

router.post('/exports', (_req: Request, res: Response) => {
  try {
    const data = createExportBackup('manual')
    res.json({ success: true, data })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/exports/:filename', (req: Request, res: Response) => {
  const p = getExportBackupPath(req.params.filename)
  if (!p) { res.status(404).json({ success: false, error: 'Export backup not found' }); return }
  res.download(p)
})

router.delete('/exports/:filename', (req: Request, res: Response) => {
  const ok = deleteExportBackup(req.params.filename)
  if (!ok) { res.status(404).json({ success: false, error: 'Export backup not found' }); return }
  res.json({ success: true })
})

router.delete('/backups/:filename', (req: Request, res: Response) => {
  const ok = deleteBackup(req.params.filename)
  if (!ok) { res.status(404).json({ success: false, error: 'Backup not found' }); return }
  res.json({ success: true })
})

export default router
