import { useState, useEffect } from 'react'

// Client-side pagination for already-loaded/filtered lists.
// Clamps the current page into range when the list shrinks (e.g. after search).
export function usePagedList<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const safePage = Math.min(page, totalPages)
  const pageItems = items.slice((safePage - 1) * pageSize, safePage * pageSize)

  return { page: safePage, setPage, totalPages, total: items.length, pageItems }
}
