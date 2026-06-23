import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '../services/api'
import ConfirmDialog from '../components/ConfirmDialog'

interface User {
  id: number
  username: string
  role: 'admin' | 'staff'
  first_name: string
  last_name: string
  nickname: string
  phone_no: string
  status: 'active' | 'inactive'
  created_at: string
}

const CreateSchema = z.object({
  username:   z.string().min(1, 'กรุณากรอก username'),
  password:   z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
  first_name: z.string().min(1, 'กรุณากรอกชื่อ'),
  last_name:  z.string().default(''),
  nickname:   z.string().default(''),
  phone_no:   z.string().default(''),
  role:       z.enum(['admin', 'staff']).default('staff'),
})

const EditSchema = z.object({
  first_name: z.string().min(1, 'กรุณากรอกชื่อ'),
  last_name:  z.string().default(''),
  nickname:   z.string().default(''),
  phone_no:   z.string().default(''),
  role:       z.enum(['admin', 'staff']),
  status:     z.enum(['active', 'inactive']),
  password:   z.string().optional(),
})

type CreateForm = z.infer<typeof CreateSchema>
type EditForm   = z.infer<typeof EditSchema>

function Badge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
    }`}>
      {status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      role === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
    }`}>
      {role === 'admin' ? 'Admin' : 'Staff'}
    </span>
  )
}

export default function UsersPage() {
  const [users, setUsers]         = useState<User[]>([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser]   = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]         = useState('')

  async function load() {
    setLoading(true)
    try {
      const r = await api.users.list()
      setUsers(r.data)
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete() {
    if (!deleteUser) return
    setDeleting(true)
    try {
      await api.users.remove(deleteUser.id)
      setDeleteUser(null)
      await load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">จัดการผู้ใช้</h1>
          <p className="text-sm text-slate-500 mt-0.5">เพิ่ม แก้ไข หรือปิดใช้งานบัญชีพนักงาน</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium"
        >
          <Plus size={15} />
          เพิ่มผู้ใช้
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">กำลังโหลด...</p>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          ยังไม่มีผู้ใช้ในระบบ — กดเพิ่มผู้ใช้เพื่อเริ่มต้น
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ชื่อ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Username</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">สิทธิ์</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">สถานะ</th>
                <th className="px-4 py-3" scope="col" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{u.first_name} {u.last_name}</p>
                    {u.nickname && <p className="text-xs text-slate-400">({u.nickname})</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.username}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3"><Badge status={u.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button type="button" title="แก้ไข" onClick={() => setEditUser(u)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                        <Pencil size={14} />
                      </button>
	                      <button type="button" title="ลบ" onClick={() => setDeleteUser(u)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
	                        <Trash2 size={14} />
	                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
      )}
      {editUser && (
        <EditModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); load() }} />
      )}
      <ConfirmDialog
        open={deleteUser !== null}
        title="ยืนยันการลบ"
        message="ลบผู้ใช้นี้ออกจากระบบใช่หรือไม่?"
        detail={deleteUser ? `${deleteUser.first_name} ${deleteUser.last_name} (${deleteUser.username})` : undefined}
        busy={deleting}
        onCancel={() => setDeleteUser(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(CreateSchema),
    defaultValues: { role: 'staff' },
  })

  async function onSubmit(data: CreateForm) {
    setServerError('')
    try {
      await api.users.create(data)
      onSaved()
    } catch (e: any) {
      setServerError(e.response?.data?.error || 'เกิดข้อผิดพลาด')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">เพิ่มผู้ใช้ใหม่</h2>
          <button type="button" title="ปิด" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
          {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">ชื่อ *</label>
              <input {...register('first_name')} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">นามสกุล</label>
              <input {...register('last_name')} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">ชื่อเล่น</label>
            <input {...register('nickname')} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Username *</label>
            <input {...register('username')} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">รหัสผ่าน *</label>
            <input {...register('password')} type="password" className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">สิทธิ์</label>
            <select {...register('role')} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white">
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm font-medium text-slate-600">ยกเลิก</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 bg-slate-900 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
              {isSubmitting ? 'กำลังบันทึก...' : 'เพิ่มผู้ใช้'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EditForm>({
    resolver: zodResolver(EditSchema),
    defaultValues: {
      first_name: user.first_name,
      last_name:  user.last_name,
      nickname:   user.nickname,
      phone_no:   user.phone_no,
      role:       user.role,
      status:     user.status,
      password:   '',
    },
  })

  async function onSubmit(data: EditForm) {
    setServerError('')
    const payload: Record<string, any> = { ...data }
    if (!payload.password) delete payload.password
    try {
      await api.users.update(user.id, payload)
      onSaved()
    } catch (e: any) {
      setServerError(e.response?.data?.error || 'เกิดข้อผิดพลาด')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">แก้ไขผู้ใช้ — {user.username}</h2>
          <button type="button" title="ปิด" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
          {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">ชื่อ *</label>
              <input {...register('first_name')} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">นามสกุล</label>
              <input {...register('last_name')} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">ชื่อเล่น</label>
            <input {...register('nickname')} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">สิทธิ์</label>
              <select {...register('role')} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white focus:ring-2 focus:ring-slate-900">
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">สถานะ</label>
              <select {...register('status')} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white focus:ring-2 focus:ring-slate-900">
                <option value="active">ใช้งาน</option>
                <option value="inactive">ปิดใช้งาน</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</label>
            <input {...register('password')} type="password" placeholder="ใส่เฉพาะถ้าต้องการเปลี่ยน" className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm font-medium text-slate-600">ยกเลิก</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 bg-slate-900 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
