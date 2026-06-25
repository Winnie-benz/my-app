import { useState } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { useCustomerStore } from '../store/useCustomerStore'
import { useCustomerFilter } from '../hooks/useCustomerFilter'
import { usePagedList } from '../hooks/usePagedList'
import CustomerTable from '../components/customers/CustomerTable'
import CustomerForm from '../components/customers/CustomerForm'
import Pagination from '../components/Pagination'
import type { CustomerFormData } from '../types/customer'

export default function CustomersPage() {
  const search    = useCustomerStore(s => s.search)
  const setSearch = useCustomerStore(s => s.setSearch)
  const addCustomer = useCustomerStore(s => s.addCustomer)
  const customers  = useCustomerFilter()
  const { page, setPage, totalPages, total, pageItems } = usePagedList(customers, 20)

  const [showForm, setShowForm] = useState(false)

  function handleAdd(data: CustomerFormData) {
    addCustomer(data)
    setShowForm(false)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">ลูกค้า</h1>
          <p className="text-sm text-slate-500 mt-0.5">ลูกค้าทั้งหมด {customers.length} ราย</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          <UserPlus size={15} />
          ลงทะเบียนลูกค้าใหม่
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา ชื่อ / เบอร์ / รหัสลูกค้า"
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {/* Table */}
      <CustomerTable customers={pageItems} />
      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      {/* Registration modal */}
      {showForm && (
        <CustomerForm
          onSubmit={handleAdd}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
