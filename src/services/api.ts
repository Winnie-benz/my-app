import { useAuthStore } from '../store/useAuthStore'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

export class ApiError extends Error {
  status: number
  payload: any

  constructor(message: string, status: number, payload: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

function apiErrorMessage(payload: any, status: number): string {
  const raw = payload?.message ?? payload?.error
  if (typeof raw === 'string' && raw) return raw
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.formErrors) && raw.formErrors[0]) {
      return String(raw.formErrors[0])
    }
    if (raw.fieldErrors && typeof raw.fieldErrors === 'object') {
      for (const messages of Object.values(raw.fieldErrors)) {
        if (Array.isArray(messages) && messages[0]) {
          return String(messages[0])
        }
      }
    }
  }
  return `API error ${status}`
}

async function req<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  useAuthStore.getState().refreshIfNeeded()   // silent background refresh, no await
  const token = useAuthStore.getState().token
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  const text = await res.text()
  let json: any = null

  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      throw new ApiError('Invalid server response', res.status, {
        success: false,
        error: 'ได้รับข้อมูลตอบกลับจาก server ไม่ถูกต้อง',
        raw: text,
      })
    }
  } else {
    json = { success: res.ok }
  }

  if (!json.success) {
    throw new ApiError(apiErrorMessage(json, res.status), res.status, json)
  }
  return json as T
}

export const api = {
  products: {
    list:      ()                                             => req<{ data: any[] }>('/products'),
    search:    (q: string)                                    => req<{ data: any[] }>(`/products/search?q=${encodeURIComponent(q)}`),
    create:    (body: unknown)                                => req<any>('/products', { method: 'POST', body: JSON.stringify(body) }),
    update:    (id: number, body: unknown)                    => req<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove:    (id: number)                                   => req<any>(`/products/${id}`, { method: 'DELETE' }),
    stockIn:   (id: number, qty: number, cost: number)       =>
      req<any>(`/products/${id}/stock-in`,  { method: 'POST', body: JSON.stringify({ qty, cost }) }),
    stockOut:  (id: number, qty: number, cost: number)       =>
      req<any>(`/products/${id}/stock-out`, { method: 'POST', body: JSON.stringify({ qty, cost }) }),
    deduct:    (id: number, qty: number)                     =>
      req<any>(`/products/${id}/deduct`,    { method: 'POST', body: JSON.stringify({ qty }) }),
    movements: (id: number)                                  =>
      req<{ data: any[] }>(`/products/${id}/movements`),
  },

  customers: {
    list:   (search?: string) =>
      req<{ data: any[] }>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    create: (body: unknown)   => req<{ data: any }>('/customers', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: unknown) =>
      req<{ data: any }>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: string)      => req<any>(`/customers/${id}`, { method: 'DELETE' }),
  },

  purchases: {
    all:        ()                                         => req<{ data: any[] }>('/purchases'),
    byCustomer: (cid: string)                             => req<{ data: any[] }>(`/customers/${cid}/purchases`),
    create:     (cid: string, body: unknown)              =>
      req<{ data: any }>(`/customers/${cid}/purchases`, { method: 'POST', body: JSON.stringify(body) }),
    update:     (cid: string, pid: string, body: unknown) =>
      req<{ data: any }>(`/customers/${cid}/purchases/${pid}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove:       (cid: string, pid: string)                =>
      req<any>(`/customers/${cid}/purchases/${pid}`, { method: 'DELETE' }),
    updateStatus: (purchaseId: string, order_status: string) =>
      req<{ data: any }>(`/purchases/${purchaseId}/status`, { method: 'PATCH', body: JSON.stringify({ order_status }) }),
    statusLogs: (purchaseId: string) =>
      req<{ data: any[] }>(`/purchases/${purchaseId}/status-logs`),
    outstanding: () =>
      req<{ data: { purchase: any; customer: any; last_payment_date: string | null }[]; count: number }>('/purchases/outstanding'),
    pendingCosts: () =>
      req<{ data: { purchase: any; customer: { customer_id: string; first_name: string; last_name: string } }[]; count: number }>('/purchases/pending-costs'),
    updateCosts: (purchaseId: string, costs: { cost_lens?: number | null; cost_frame?: number | null; cost_other?: number | null }) =>
      req<{ data: any }>(`/purchases/${purchaseId}/costs`, { method: 'PATCH', body: JSON.stringify(costs) }),
  },

  reports: {
    summary:     ()                          => req<{ data: any }>('/reports/summary'),
    sales:       (range: string, group: string) => req<{ data: any[] }>(`/reports/sales?range=${range}&group=${group}`),
    topProducts:    (limit = 10) => req<{ data: any[] }>(`/reports/top-products?limit=${limit}`),
    topCategories:  (limit = 5)  => req<{ data: { frames: any[]; lenses: any[] } }>(`/reports/top-categories?limit=${limit}`),
    profit:      (range: string)             => req<{ data: any[] }>(`/reports/profit?range=${range}`),
    monthly:     (month: string)             => req<{ data: any }>(`/reports/monthly?month=${encodeURIComponent(month)}`),
  },

  admin: {
    listBackups:    () =>
      req<{ data: { filename: string; size: number; created_at: string }[] }>('/admin/backups'),
    createBackup:   () =>
      req<{ filename: string }>('/admin/backups', { method: 'POST' }),
    restoreBackup:  (filename: string) =>
      req<{ message: string; filename: string; safety_backup: string }>(`/admin/backups/${encodeURIComponent(filename)}/restore`, { method: 'POST' }),
    deleteBackup:   (filename: string) =>
      req<any>(`/admin/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
    downloadBackup: (filename: string) =>
      `${BASE}/admin/backups/${encodeURIComponent(filename)}`,
  },

  inventory: {
    submitSession: (body: unknown) =>
      req<{ data: any }>('/inventory/sessions', { method: 'POST', body: JSON.stringify(body) }),
    listSessions: (params?: { search?: string; from?: string; to?: string }) => {
      const qs = new URLSearchParams()
      if (params?.search) qs.set('search', params.search)
      if (params?.from)   qs.set('from',   params.from)
      if (params?.to)     qs.set('to',     params.to)
      const q = qs.toString()
      return req<{ data: any[] }>(`/inventory/sessions${q ? `?${q}` : ''}`)
    },
    getSession:     (id: number)       => req<{ data: any }>(`/inventory/sessions/${id}`),
    deleteSession:  (id: number)       => req<any>(`/inventory/sessions/${id}`, { method: 'DELETE' }),
  },

  lensProducts: {
    list:            ()                            => req<{ data: any[] }>('/lens-products'),
    zeroStock:       ()                            => req<{ data: any[] }>('/lens-products/zero-stock'),
    create:          (body: unknown)               => req<{ data: any }>('/lens-products', { method: 'POST', body: JSON.stringify(body) }),
    update:          (id: number, body: unknown)   => req<{ data: any }>(`/lens-products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove:          (id: number)                  => req<any>(`/lens-products/${id}`, { method: 'DELETE' }),
    listVariants:    (id: number)                  => req<{ data: any[] }>(`/lens-products/${id}/variants`),
    cell:            (id: number, body: { sph: string; cyl: string; stock_qty: number; cost?: number }) =>
      req<{ data: any }>(`/lens-products/${id}/cell`, { method: 'PATCH', body: JSON.stringify(body) }),
    addVariant:      (id: number, body: unknown)   => req<{ data: any }>(`/lens-products/${id}/variants`, { method: 'POST', body: JSON.stringify(body) }),
    updateVariant:   (id: number, vid: number, body: unknown) =>
      req<{ data: any }>(`/lens-products/${id}/variants/${vid}`, { method: 'PUT', body: JSON.stringify(body) }),
    removeVariant:   (id: number, vid: number)     => req<any>(`/lens-products/${id}/variants/${vid}`, { method: 'DELETE' }),
    adjustStock:      (id: number, vid: number, delta: number) =>
      req<{ data: any }>(`/lens-products/${id}/variants/${vid}/stock`, { method: 'PATCH', body: JSON.stringify({ delta }) }),
    stockIn:          (id: number, vid: number, qty: number, cost: number, note?: string) =>
      req<{ data: any }>(`/lens-products/${id}/variants/${vid}/stock-in`, { method: 'POST', body: JSON.stringify({ qty, cost, note }) }),
    variantMovements: (id: number, vid: number) =>
      req<{ data: any[] }>(`/lens-products/${id}/variants/${vid}/movements`),
    variantLookup:    (ids: number[]) =>
      req<{ data: any[] }>(`/lens-products/variant-lookup?ids=${ids.join(',')}`),
    stockOut:         (id: number, vid: number, qty: number, note?: string) =>
      req<{ data: any }>(`/lens-products/${id}/variants/${vid}/stock-out`, { method: 'POST', body: JSON.stringify({ qty, note }) }),
  },

  claims: {
    list:        () => req<{ data: any[] }>('/claims'),
    outstanding: () => req<{ data: any[]; count: number }>('/claims/outstanding'),
    create: (body: { purchase_id: string; customer_id: string; claim_type: string; description: string; fee: number; pickup_date?: string; items?: { product_id: number; qty: number; cost: number }[] }) =>
      req<{ data: any; items: any[] }>('/claims', { method: 'POST', body: JSON.stringify(body) }),
    listItems: (id: string) => req<{ data: any[] }>(`/claims/${id}/items`),
    update: (id: string, body: Partial<{ status: string; order_status: string; description: string; fee: number; claim_type: string; pickup_date: string; payment_status: string }>) =>
      req<{ data: any }>(`/claims/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    statusLogs: (id: string) =>
      req<{ data: any[] }>(`/claims/${id}/status-logs`),
    remove: (id: string) => req<any>(`/claims/${id}`, { method: 'DELETE' }),
  },

  claimPayments: {
    list:   (claimId: string) =>
      req<{ data: any[] }>(`/claims/${claimId}/payments`),
    create: (claimId: string, body: { amount: number; method: string; note?: string; paid_at?: string }) =>
      req<{ data: any; claim: any }>(`/claims/${claimId}/payments`, { method: 'POST', body: JSON.stringify(body) }),
    remove: (claimId: string, paymentId: string) =>
      req<{ claim: any }>(`/claims/${claimId}/payments/${paymentId}`, { method: 'DELETE' }),
  },

  payments: {
    list:   (purchaseId: string) =>
      req<{ data: any[] }>(`/purchases/${purchaseId}/payments`),
    create: (purchaseId: string, body: unknown) =>
      req<{ data: any; purchase: any }>(`/purchases/${purchaseId}/payments`, { method: 'POST', body: JSON.stringify(body) }),
    remove: (purchaseId: string, paymentId: string) =>
      req<{ purchase: any }>(`/purchases/${purchaseId}/payments/${paymentId}`, { method: 'DELETE' }),
  },
  users: {
    list:   ()                          => req<{ data: any[] }>('/users'),
    create: (body: unknown)             => req<any>('/users', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: unknown) => req<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: number)                => req<any>(`/users/${id}`, { method: 'DELETE' }),
  },
}
