import { Router, Request, Response } from 'express'
import { spawn } from 'child_process'
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
