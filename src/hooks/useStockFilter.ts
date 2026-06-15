import { useMemo } from 'react'
import { useProductStore } from '../store/useProductStore'

export function useStockFilter() {
  const products = useProductStore(s => s.products)
  const search = useProductStore(s => s.search)
  const categoryFilter = useProductStore(s => s.categoryFilter)

  return useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(p => {
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q)
      const matchCat = categoryFilter === 'All' || p.category === categoryFilter
      return matchSearch && matchCat
    })
  }, [products, search, categoryFilter])
}
