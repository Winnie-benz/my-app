import { useMemo } from 'react'
import { useCustomerStore } from '../store/useCustomerStore'

export function useCustomerFilter() {
  const customers = useCustomerStore(s => s.customers)
  const search    = useCustomerStore(s => s.search)

  return useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c =>
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      c.phone_no.includes(q) ||
      c.customer_id.includes(q)
    )
  }, [customers, search])
}
