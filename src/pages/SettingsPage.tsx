import { useEffect, useState } from 'react'
import { Download, Trash2, Plus, HardDrive, Shield, RotateCcw, AlertTriangle, UserX, Lock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import { useAuthStore } from '../store/useAuthStore'
import { notify } from '../utils/notify'
import ConfirmDialog from '../components/ConfirmDialog'

interface BackupEntry {
  filename: string
  size: number
  created_at: string
}

interface BackupStatus {
  mode: 'turso' | 'local'
  supports_restore: boolean
  backup_dir: string
  export_dir: string
  auto_export_hour: number
  export_retention_count: number
}

interface DeletedCustomer {
  customer_id: string
  first_name: string
  last_name: string
  phone_no: string
  deleted_at: string
  deleted_by: string
}

interface DeletedProduct {
  id: number
  barcode: string
  sku: string
  name: string
  stock_current: number
  deleted_at: string
  deleted_by: string
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
  const token = useAuthStore(s => s.token)

  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [exports, setExports] = useState<BackupEntry[]>([])
  const [localBackups, setLocalBackups] = useState<BackupEntry[]>([])
  const [deletedCustomers, setDeletedCustomers] = useState<DeletedCustomer[]>([])
  const [deletedProducts, setDeletedProducts] = useState<DeletedProduct[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [creatingExport, setCreatingExport] = useState(false)
  const [creatingLocalBackup, setCreatingLocalBackup] = useState(false)
  const [deletingExport, setDeletingExport] = useState<string | null>(null)
  const [deletingLocalBackup, setDeletingLocalBackup] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [restoringCustomer, setRestoringCustomer] = useState<string | null>(null)
  const [restoringProduct, setRestoringProduct] = useState<number | null>(null)

  const [deleteExportCandidate, setDeleteExportCandidate] = useState<BackupEntry | null>(null)
  const [deleteLocalBackupCandidate, setDeleteLocalBackupCandidate] = useState<BackupEntry | null>(null)
  const [restoreCandidate, setRestoreCandidate] = useState<BackupEntry | null>(null)
  const [restoreConfirmed, setRestoreConfirmed] = useState(false)

  async function loadSettings() {
    setLoading(true)
    setLoadError('')
    try {
      const statusRes = await api.admin.backupStatus()
      const currentStatus = statusRes.data
      setStatus(currentStatus)

      const [exportRes, deletedCustomersRes, deletedProductsRes, backupRes] = await Promise.all([
        api.admin.listExports(),
        api.customers.listDeleted(),
        api.products.listDeleted(),
        currentStatus.supports_restore ? api.admin.listBackups() : Promise.resolve({ data: [] as BackupEntry[] }),
      ])

      setExports(exportRes.data)
      setDeletedCustomers(deletedCustomersRes.data)
      setDeletedProducts(deletedProductsRes.data)
      setLocalBackups(backupRes.data)
    } catch (e: any) {
      setLoadError(e?.message || 'โหลดข้อมูลตั้งค่าไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'admin') loadSettings()
  }, [user?.role])

  async function createExport() {
    setCreatingExport(true)
    try {
      const res = await api.admin.createExport()
      setExports(prev => [res.data, ...prev])
      notify('success', 'สร้าง export backup สำเร็จ')
    } catch (e: any) {
      notify('error', e?.message || 'สร้าง export backup ไม่สำเร็จ')
    } finally {
      setCreatingExport(false)
    }
  }

  async function createLocalBackup() {
    setCreatingLocalBackup(true)
    try {
      await api.admin.createBackup()
      const res = await api.admin.listBackups()
      setLocalBackups(res.data)
      notify('success', 'สร้าง local backup สำเร็จ')
    } catch (e: any) {
      notify('error', e?.message || 'สร้าง local backup ไม่สำเร็จ')
    } finally {
      setCreatingLocalBackup(false)
    }
  }

  async function deleteExport(filename: string) {
    setDeletingExport(filename)
    try {
      await api.admin.deleteExport(filename)
      setExports(prev => prev.filter(b => b.filename !== filename))
      setDeleteExportCandidate(null)
    } finally {
      setDeletingExport(null)
    }
  }

  async function deleteLocalBackup(filename: string) {
    setDeletingLocalBackup(filename)
    try {
      await api.admin.deleteBackup(filename)
      setLocalBackups(prev => prev.filter(b => b.filename !== filename))
      setDeleteLocalBackupCandidate(null)
    } finally {
      setDeletingLocalBackup(null)
    }
  }

  async function restoreLocalBackup() {
    if (!restoreCandidate || !restoreConfirmed) return

    setRestoring(restoreCandidate.filename)
    try {
      const res = await api.admin.restoreBackup(restoreCandidate.filename)
      notify('warning', `${res.message} กรุณารอ 5-10 วินาทีแล้ว refresh หน้าอีกครั้ง`)
      window.setTimeout(() => window.location.reload(), 8000)
    } catch (e: any) {
      notify('error', e?.message || 'Restore backup ไม่สำเร็จ')
      setRestoring(null)
    }
  }

  function closeRestoreDialog() {
    if (restoring) return
    setRestoreCandidate(null)
    setRestoreConfirmed(false)
  }

  function downloadFile(url: string, filename: string) {
    fetch(url, { headers: { Authorization: `Bearer ${token ?? ''}` } })
      .then(r => {
        if (!r.ok) throw new Error('download failed')
        return r.blob()
      })
      .then(blob => {
        const a = document.createElement('a')
        const blobUrl = URL.createObjectURL(blob)
        a.href = blobUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
      })
      .catch(() => notify('error', 'ดาวน์โหลดไฟล์ไม่สำเร็จ'))
  }

  async function restoreCustomer(customerId: string) {
    setRestoringCustomer(customerId)
    try {
      await api.customers.restore(customerId)
      setDeletedCustomers(prev => prev.filter(c => c.customer_id !== customerId))
      notify('success', 'กู้คืนลูกค้าสำเร็จ')
    } catch (e: any) {
      notify('error', e?.message || 'กู้คืนลูกค้าไม่สำเร็จ')
    } finally {
      setRestoringCustomer(null)
    }
  }

  async function restoreProduct(productId: number) {
    setRestoringProduct(productId)
    try {
      await api.products.restore(productId)
      setDeletedProducts(prev => prev.filter(p => p.id !== productId))
      notify('success', 'กู้คืนสินค้าสำเร็จ')
    } catch (e: any) {
      notify('error', e?.message || 'กู้คืนสินค้าไม่สำเร็จ')
    } finally {
      setRestoringProduct(null)
    }
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

      {loadError && (
        <section className="bg-red-50 border border-red-100 rounded-2xl p-5 text-sm text-red-700">
          {loadError}
          <button type="button" onClick={loadSettings} className="ml-3 underline font-medium">ลองโหลดใหม่</button>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-slate-600" />
            <h2 className="font-semibold text-slate-900">Export Backup (.db)</h2>
          </div>
          <button
            type="button"
            onClick={createExport}
            disabled={creatingExport || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            <Plus size={14} />
            {creatingExport ? 'กำลังสร้าง...' : 'สร้าง Export'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-2">
          ระบบจะ export อัตโนมัติทุกวันเวลา {String(status?.auto_export_hour ?? 19).padStart(2, '0')}:00 ถ้า server เปิดอยู่ และจะเก็บล่าสุด {status?.export_retention_count ?? 30} ไฟล์
        </p>
        <p className="text-xs text-slate-400 mb-5 break-all">
          Path: {status?.export_dir ?? 'server/data/exports'}
        </p>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-6">กำลังโหลด...</p>
        ) : exports.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">ยังไม่มี export backup</p>
        ) : (
          <BackupList
            entries={exports}
            restoring={null}
            deleting={deletingExport}
            onDownload={b => downloadFile(api.admin.downloadExport(b.filename), b.filename)}
            onDelete={setDeleteExportCandidate}
          />
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <UserX size={16} className="text-slate-600" />
            <h2 className="font-semibold text-slate-900">สินค้าที่ถูกลบ</h2>
          </div>
          <button
            type="button"
            onClick={loadSettings}
            disabled={loading || restoringProduct !== null}
            className="px-3 py-1.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            โหลดใหม่
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          การลบสินค้าจะซ่อนจากคลังสินค้า แต่ยังเก็บ stock history และยอดขายเดิมไว้
        </p>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-6">กำลังโหลด...</p>
        ) : deletedProducts.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">ยังไม่มีสินค้าที่ถูกลบ</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {deletedProducts.map(product => (
              <div key={product.id} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 font-medium truncate">
                    {product.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {product.sku || product.barcode} · คงเหลือ {product.stock_current} · ลบเมื่อ {fmtDate(product.deleted_at)}
                    {product.deleted_by ? ` โดย ${product.deleted_by}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => restoreProduct(product.id)}
                  disabled={restoringProduct !== null}
                  className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 hover:bg-green-50 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  <RotateCcw size={13} />
                  {restoringProduct === product.id ? 'กำลังกู้คืน...' : 'กู้คืน'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {status?.supports_restore ? (
        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <RotateCcw size={16} className="text-slate-600" />
              <h2 className="font-semibold text-slate-900">Local SQLite Restore</h2>
            </div>
            <button
              type="button"
              onClick={createLocalBackup}
              disabled={creatingLocalBackup || !!restoring}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <Plus size={14} />
              {creatingLocalBackup ? 'กำลังสร้าง...' : 'สร้าง Local Backup'}
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-5">
            ใช้ได้เฉพาะโหมด local SQLite เท่านั้น การ restore จะย้อนฐานทั้งก้อนและรีสตาร์ต server
          </p>

          {localBackups.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">ยังไม่มี local backup</p>
          ) : (
            <BackupList
              entries={localBackups}
              restoring={restoring}
              deleting={deletingLocalBackup}
              onRestore={b => { setRestoreCandidate(b); setRestoreConfirmed(false) }}
              onDownload={b => downloadFile(api.admin.downloadBackup(b.filename), b.filename)}
              onDelete={setDeleteLocalBackupCandidate}
            />
          )}
        </section>
      ) : (
        <section className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Lock size={17} />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Restore ถูกปิดเมื่อใช้ Turso</h2>
              <p className="text-sm text-amber-800 mt-1">
                Export backup ใช้เป็นสำเนาสำหรับ controlled restore เท่านั้น ไม่ใช่ปุ่มย้อนฐานกลางทั้งระบบจากหน้าเว็บ
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <UserX size={16} className="text-slate-600" />
            <h2 className="font-semibold text-slate-900">ลูกค้าที่ถูกลบ</h2>
          </div>
          <button
            type="button"
            onClick={loadSettings}
            disabled={loading || !!restoringCustomer}
            className="px-3 py-1.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            โหลดใหม่
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          การลบลูกค้าจะซ่อนจากรายการหลัก แต่ยังเก็บประวัติการขายไว้และสามารถกู้คืนได้
        </p>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-6">กำลังโหลด...</p>
        ) : deletedCustomers.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">ยังไม่มีลูกค้าที่ถูกลบ</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {deletedCustomers.map(customer => (
              <div key={customer.customer_id} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 font-medium truncate">
                    {customer.customer_id} · {customer.first_name} {customer.last_name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {customer.phone_no || 'ไม่มีเบอร์โทร'} · ลบเมื่อ {fmtDate(customer.deleted_at)}
                    {customer.deleted_by ? ` โดย ${customer.deleted_by}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => restoreCustomer(customer.customer_id)}
                  disabled={!!restoringCustomer}
                  className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 hover:bg-green-50 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  <RotateCcw size={13} />
                  {restoringCustomer === customer.customer_id ? 'กำลังกู้คืน...' : 'กู้คืน'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-900 mb-4">ข้อมูลระบบ</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">ผู้ใช้งาน</dt>
            <dd className="text-slate-900 font-medium">{user?.nickname || user?.first_name} ({user?.role})</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Database mode</dt>
            <dd className="text-slate-900 font-medium">{status?.mode ?? '-'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">เวอร์ชัน</dt>
            <dd className="text-slate-900 font-medium">1.0.0</dd>
          </div>
        </dl>
      </section>

      {restoreCandidate && status?.supports_restore && (
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
                <p className="text-xs text-slate-400">ไฟล์ Backup</p>
                <p className="text-sm font-medium text-slate-900 break-all">{restoreCandidate.filename}</p>
                <p className="text-xs text-slate-400">{fmtDate(restoreCandidate.created_at)} · {fmtSize(restoreCandidate.size)}</p>
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
                onClick={restoreLocalBackup}
                disabled={!restoreConfirmed || !!restoring}
                className="flex-1 bg-amber-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-40"
              >
                {restoring === restoreCandidate.filename ? 'กำลัง Restore...' : 'ยืนยัน Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteExportCandidate !== null}
        title="ยืนยันการลบ"
        message="ลบไฟล์ export backup นี้ใช่หรือไม่?"
        detail={deleteExportCandidate ? `${deleteExportCandidate.filename} · ${fmtDate(deleteExportCandidate.created_at)} · ${fmtSize(deleteExportCandidate.size)}` : undefined}
        busy={deletingExport === deleteExportCandidate?.filename}
        onCancel={() => setDeleteExportCandidate(null)}
        onConfirm={() => deleteExportCandidate && deleteExport(deleteExportCandidate.filename)}
      />

      <ConfirmDialog
        open={deleteLocalBackupCandidate !== null}
        title="ยืนยันการลบ"
        message="ลบไฟล์ local backup นี้ใช่หรือไม่?"
        detail={deleteLocalBackupCandidate ? `${deleteLocalBackupCandidate.filename} · ${fmtDate(deleteLocalBackupCandidate.created_at)} · ${fmtSize(deleteLocalBackupCandidate.size)}` : undefined}
        busy={deletingLocalBackup === deleteLocalBackupCandidate?.filename}
        onCancel={() => setDeleteLocalBackupCandidate(null)}
        onConfirm={() => deleteLocalBackupCandidate && deleteLocalBackup(deleteLocalBackupCandidate.filename)}
      />
    </div>
  )
}

function BackupList({
  entries,
  restoring,
  deleting,
  onRestore,
  onDownload,
  onDelete,
}: {
  entries: BackupEntry[]
  restoring: string | null
  deleting: string | null
  onRestore?: (entry: BackupEntry) => void
  onDownload: (entry: BackupEntry) => void
  onDelete: (entry: BackupEntry) => void
}) {
  return (
    <div className="divide-y divide-slate-100">
      {entries.map((entry, i) => (
        <div key={entry.filename} className="flex items-center gap-3 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800 font-medium truncate">
              {entry.filename}
              {i === 0 && (
                <span className="ml-2 text-[10px] bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 font-semibold">
                  ล่าสุด
                </span>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {fmtDate(entry.created_at)} · {fmtSize(entry.size)}
            </p>
          </div>
          {onRestore && (
            <button
              type="button"
              onClick={() => onRestore(entry)}
              disabled={!!restoring || deleting === entry.filename}
              className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-50 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              <RotateCcw size={13} />
              {restoring === entry.filename ? 'กำลัง Restore...' : 'Restore'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDownload(entry)}
            disabled={!!restoring}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            <Download size={13} />
            ดาวน์โหลด
          </button>
          <button
            type="button"
            title="ลบไฟล์นี้"
            onClick={() => onDelete(entry)}
            disabled={deleting === entry.filename || !!restoring}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
