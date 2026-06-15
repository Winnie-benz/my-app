import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import type { Customer, CustomerFormData, CustomerSource } from '../../types/customer'
import { calcAge } from '../../utils/customerUtils'

const schema = z.object({
  first_name: z.string().min(1, 'กรุณากรอกชื่อ'),
  last_name:  z.string().min(1, 'กรุณากรอกนามสกุล'),
  phone_no:   z.string().length(10, 'เบอร์โทรต้องมี 10 หลัก').regex(/^\d+$/, 'ตัวเลขเท่านั้น'),
  email:      z.string().email('รูปแบบอีเมลไม่ถูกต้อง').or(z.literal('')),
  birthday:   z.string().min(1, 'กรุณาเลือกวันเกิด'),
  gender:     z.enum(['male', 'female', 'unspecified']),
  address:    z.string(),
  note:       z.string(),
  source:     z.enum(['walk_in', 'referral', 'social_media', 'other']),
})

type Props = {
  initial?: Customer
  onSubmit: (data: CustomerFormData) => void
  onClose: () => void
}

const GENDERS = [
  { value: 'male',        label: 'ชาย'   },
  { value: 'female',      label: 'หญิง'  },
  { value: 'unspecified', label: 'ไม่ระบุ' },
] as const

const SOURCES: { value: CustomerSource; label: string }[] = [
  { value: 'walk_in',      label: 'เดินเข้าร้าน'    },
  { value: 'referral',     label: 'แนะนำ / บอกต่อ'  },
  { value: 'social_media', label: 'โซเชียลมีเดีย'   },
  { value: 'other',        label: 'อื่นๆ'            },
]

export default function CustomerForm({ initial, onSubmit, onClose }: Props) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<CustomerFormData>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? {
      first_name: '', last_name: '', phone_no: '', email: '',
      birthday: '', gender: 'unspecified', address: '', note: '', source: 'walk_in',
    },
  })

  const birthday = watch('birthday')
  const age = birthday ? calcAge(birthday) : null

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-semibold text-slate-900">
            {initial ? 'แก้ไขข้อมูลลูกค้า' : 'ลงทะเบียนลูกค้าใหม่'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ชื่อ *</label>
              <input {...register('first_name')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="ชื่อจริง" />
              {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">นามสกุล *</label>
              <input {...register('last_name')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="นามสกุล" />
              {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>}
            </div>
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">เบอร์โทร *</label>
              <input {...register('phone_no')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="0812345678" maxLength={10} />
              {errors.phone_no && <p className="text-red-500 text-xs mt-1">{errors.phone_no.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">อีเมล</label>
              <input {...register('email')} type="email"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="email@example.com" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
          </div>

          {/* Birthday + Age + Gender */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">วันเกิด *</label>
              <input {...register('birthday')} type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              {errors.birthday && <p className="text-red-500 text-xs mt-1">{errors.birthday.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">อายุ</label>
              <div className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500">
                {age !== null ? `${age} ปี` : '-'}
              </div>
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">เพศ</label>
            <div className="flex gap-2">
              {GENDERS.map(g => (
                <label key={g.value}
                  className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input {...register('gender')} type="radio" value={g.value}
                    className="accent-slate-900" />
                  {g.label}
                </label>
              ))}
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">รู้จักร้านจาก</label>
            <select {...register('source')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white">
              {SOURCES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">ที่อยู่</label>
            <textarea {...register('address')} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
              placeholder="ที่อยู่" />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">หมายเหตุ</label>
            <input {...register('note')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="หมายเหตุ (ถ้ามี)" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit"
              className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors">
              {initial ? 'บันทึกการแก้ไข' : 'ลงทะเบียน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
