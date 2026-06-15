import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import { useAuthStore } from '../store/useAuthStore'
import { Download, Trash2, Plus, HardDrive, Shield, RotateCcw, AlertTriangle } from 'lucide-react'
import { notify } from '../utils/notify'

interface BackupEntry {
  filename: string
  size: number
  created_at: string
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function SettingsPage() {
  const { user } = useAuth()
  const token    = useAuthStore(s => s.token)

  const [backups,  setBackups]  = useState<BackupEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [restoreCandidate, setRestoreCandidate] = useState<BackupEntry | null>(null)
  const [restoreConfirmed, setRestoreConfirmed] = useState(false)
  const [loadError, setLoadError] = useState('')

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const res = await api.admin.listBackups()
      setBackups(res.data)
    } catch (e: any) {
      setLoadError(e?.message || 'โหลดรายการ backup ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate() {
    setCreating(true)
    try {
      await api.admin.createBackup()
      await load()
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(filename: string) {
    setDeleting(filename)
    try {
      await api.admin.deleteBackup(filename)
      setBackups(prev => prev.filter(b => b.filename !== filename))
    } finally {
      setDeleting(null)
    }
  }

  function openRestoreDialog(backup: BackupEntry) {
    setRestoreCandidate(backup)
    setRestoreConfirmed(false)
  }

  function closeRestoreDialog() {
    if (restoring) return
    setRestoreCandidate(null)
    setRestoreConfirmed(false)
  }

  async function handleRestore() {
    if (!restoreCandidate || !restoreConfirmed) return

    setRestoring(restoreCandidate.filename)
    try {
      const res = await api.admin.restoreBackup(restoreCandidate.filename)
      notify('warning', `${res.message} กรุณารอ 5-10 วินาทีแล้ว refresh หน้าอีกครั้ง`)
      window.setTimeout(() => {
        window.location.reload()
      }, 8000)
    } catch (e: any) {
      notify('error', e?.message || 'Restore backup ไม่สำเร็จ')
      setRestoring(null)
    }
  }

  function handleDownload(filename: string) {
    const url = api.admin.downloadBackup(filename)
    const a = document.createElement('a')
    fetch(url, { headers: { Authorization: `Bearer ${token ?? ''}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        a.href = blobUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
      })
  }

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <Shield size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">เฉพาะ Admin เท่านั้น</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <h1 className="text-xl font-semibold text-slate-900">ตั้งค่าระบบ</h1>

      {/* Backup section */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-slate-600" />
            <h2 className="font-semibold text-slate-900">สำรองข้อมูล (SQLite Backup)</h2>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !!restoring}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            <Plus size={14} />
            {creating ? 'กำลังสร้าง...' : 'สร้าง Backup'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          ระบบ backup อัตโนมัติทุกวันและทุกสัปดาห์ การ restore จะย้อนข้อมูลกลับไปตามเวลาของ backup และระบบจะรีสตาร์ตอัตโนมัติ
        </p>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-6">กำลังโหลด...</p>
        ) : loadError ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-red-600">{loadError}</p>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ลองโหลดใหม่
            </button>
          </div>
        ) : backups.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">ยังไม่มี backup</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {backups.map((b, i) => (
              <div key={b.filename} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 font-medium truncate">
                    {b.filename}
                    {i === 0 && (
                      <span className="ml-2 text-[10px] bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 font-semibold">
                        ล่าสุด
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {fmtDate(b.created_at)} · {fmtSize(b.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openRestoreDialog(b)}
                  disabled={!!restoring || deleting === b.filename}
                  className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-50 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  <RotateCcw size={13} />
                  {restoring === b.filename ? 'กำลัง Restore...' : 'Restore'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(b.filename)}
                  disabled={!!restoring}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  <Download size={13} />
                  ดาวน์โหลด
                </button>
                <button
                  type="button"
                  title="ลบ backup นี้"
                  onClick={() => handleDelete(b.filename)}
                  disabled={deleting === b.filename || !!restoring}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* System info */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-900 mb-4">ข้อมูลระบบ</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">ผู้ใช้งาน</dt>
            <dd className="text-slate-900 font-medium">{user?.nickname || user?.first_name} ({user?.role})</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">เวอร์ชัน</dt>
            <dd className="text-slate-900 font-medium">1.0.0</dd>
          </div>
        </dl>
      </section>

      {restoreCandidate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">ยืนยันการ Restore</h3>
                <p className="text-sm text-amber-800 mt-0.5">
                  การทำรายการนี้จะย้อนข้อมูลทั้งระบบกลับไปตาม backup ที่เลือก
                </p>
              </div>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="border border-slate-200 rounded-xl px-4 py-3 space-y-2">
                <div>
                  <p className="text-xs text-slate-400">ไฟล์ Backup</p>
                  <p className="text-sm font-medium text-slate-900 break-all">{restoreCandidate.filename}</p>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">วันที่สำรอง</p>
                    <p className="text-slate-700">{fmtDate(restoreCandidate.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">ขนาดไฟล์</p>
                    <p className="text-slate-700">{fmtSize(restoreCandidate.size)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-600 space-y-1">
                <p>ข้อมูลที่บันทึกหลังเวลาของ backup นี้จะหายไป</p>
                <p>ระบบจะสร้าง safety backup ให้ก่อน restore ทุกครั้ง</p>
                <p>หลังจากนั้น server จะรีสตาร์ตอัตโนมัติ</p>
              </div>

              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={restoreConfirmed}
                  onChange={e => setRestoreConfirmed(e.target.checked)}
                  className="mt-0.5 accent-slate-900"
                />
                <span className="text-slate-700">
                  ฉันเข้าใจว่าระบบจะย้อนข้อมูลกลับไปตาม backup นี้
                </span>
              </label>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
              <button
                type="button"
                onClick={closeRestoreDialog}
                disabled={!!restoring}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleRestore}
                disabled={!restoreConfirmed || !!restoring}
                className="flex-1 bg-amber-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-40"
              >
                {restoring === restoreCandidate.filename ? 'กำลัง Restore...' : 'ยืนยัน Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
