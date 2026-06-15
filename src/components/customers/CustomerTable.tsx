import { useNavigate } from 'react-router-dom'
import type { Customer } from '../../types/customer'
import { calcAge } from '../../utils/customerUtils'

const GENDER_LABEL: Record<string, string> = {
  male: 'ชาย', female: 'หญิง', unspecified: 'ไม่ระบุ',
}

type Props = { customers: Customer[] }

export default function CustomerTable({ customers }: Props) {
  const navigate = useNavigate()

  if (customers.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        ไม่พบข้อมูลลูกค้า
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3 text-left font-medium">รหัสลูกค้า</th>
            <th className="px-4 py-3 text-left font-medium">ชื่อ</th>
            <th className="px-4 py-3 text-left font-medium">นามสกุล</th>
            <th className="px-4 py-3 text-left font-medium">เบอร์โทร</th>
            <th className="px-4 py-3 text-left font-medium">อายุ</th>
            <th className="px-4 py-3 text-left font-medium">เพศ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {customers.map(c => (
            <tr
              key={c.customer_id}
              onClick={() => navigate(`/customers/${c.customer_id}`)}
              className="hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 font-mono text-slate-500">{c.customer_id}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{c.first_name}</td>
              <td className="px-4 py-3 text-slate-700">{c.last_name}</td>
              <td className="px-4 py-3 text-slate-600">{c.phone_no}</td>
              <td className="px-4 py-3 text-slate-600">{calcAge(c.birthday)} ปี</td>
              <td className="px-4 py-3 text-slate-600">{GENDER_LABEL[c.gender] ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
