import { create } from 'zustand'
import type { Customer, CustomerFormData, PurchaseRecord, InitialPayment, OrderStatus } from '../types/customer'
import { api } from '../services/api'
import { useProductStore } from './useProductStore'
import { notify } from '../utils/notify'

function firstFieldError(payload: any): string | null {
  const fieldErrors = payload?.error?.fieldErrors
  if (!fieldErrors || typeof fieldErrors !== 'object') return null
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (Array.isArray(messages) && messages[0]) {
      return `${field}: ${String(messages[0])}`
    }
  }
  return null
}

function purchaseErrorMessage(error: unknown, fallback: string) {
  const payload = (error as any)?.payload
  const raw = payload?.message || payload?.error || (error as any)?.message
  const detailedFieldError = firstFieldError(payload)

  if (raw === 'Authentication required' || raw === 'Invalid or expired token') {
    return 'เข้าสู่ระบบหมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่'
  }
  if (raw === 'Customer not found') return 'ไม่พบข้อมูลลูกค้าคนนี้ กรุณา refresh หน้าแล้วลองใหม่'
  if (raw === 'PURCHASE_SAVE_FAILED') return 'ระบบบันทึกฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
  if (detailedFieldError) return `ข้อมูลไม่ถูกต้อง: ${detailedFieldError}`
  if (payload?.error && typeof payload.error === 'object') return 'ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบรายการซื้ออีกครั้ง'
  if (typeof raw === 'string' && raw && raw !== 'Failed to fetch') return raw
  if (raw === 'Failed to fetch') return 'เชื่อมต่อ server ไม่ได้ กรุณาตรวจสอบว่า backend ยังเปิดอยู่'
  return fallback
}

interface CustomerStore {
  customers: Customer[]
  purchases: PurchaseRecord[]
  loading: boolean
  search: string

  setSearch: (s: string) => void
  fetchAll: () => Promise<void>

  addCustomer: (data: CustomerFormData) => Promise<void>
  updateCustomer: (id: string, data: Partial<CustomerFormData>) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>

  addPurchase: (record: Omit<PurchaseRecord, 'id' | 'created_at'>, initialPayment?: InitialPayment, stockOverrideConfirmed?: boolean) => Promise<void>
  updatePurchase: (id: string, record: Omit<PurchaseRecord, 'id' | 'created_at'>, stockOverrideConfirmed?: boolean) => Promise<void>
  deletePurchase: (id: string, customerId: string) => Promise<void>

  addPayment: (purchaseId: string, data: { amount: number; method: string; note: string; paid_at: string }) => Promise<PurchaseRecord | null>
  deletePayment: (purchaseId: string, paymentId: string) => Promise<PurchaseRecord | null>
  updateOrderStatus: (purchaseId: string, status: OrderStatus) => Promise<void>
  updatePurchaseCosts: (purchaseId: string, costs: { cost_lens?: number | null; cost_frame?: number | null; cost_other?: number | null }) => Promise<void>

  getCustomerPurchases: (customer_id: string) => PurchaseRecord[]
}

export const useCustomerStore = create<CustomerStore>()((set, get) => ({
  customers: [],
  purchases: [],
  loading:   false,
  search:    '',

  setSearch: s => set({ search: s }),

  async fetchAll() {
    set({ loading: true })
    try {
      const [custRes, purRes] = await Promise.all([
        api.customers.list(),
        api.purchases.all(),
      ])
      set({ customers: custRes.data, purchases: purRes.data, loading: false })
    } catch {
      notify('error', 'โหลดข้อมูลลูกค้าไม่สำเร็จ')
      set({ loading: false })
    }
  },

  async addCustomer(data) {
    try {
      const res = await api.customers.create(data)
      set(s => ({ customers: [res.data, ...s.customers] }))
    } catch (e) {
      console.error('addCustomer failed:', e)
      notify('error', 'เพิ่มลูกค้าไม่สำเร็จ')
    }
  },

  async updateCustomer(id, data) {
    try {
      const res = await api.customers.update(id, data)
      set(s => ({
        customers: s.customers.map(c => c.customer_id === id ? res.data : c),
      }))
    } catch (e) {
      console.error('updateCustomer failed:', e)
      notify('error', 'แก้ไขข้อมูลลูกค้าไม่สำเร็จ')
    }
  },

  async deleteCustomer(id) {
    try {
      await api.customers.remove(id)
      set(s => ({
        customers: s.customers.filter(c => c.customer_id !== id),
        purchases: s.purchases.filter(p => p.customer_id !== id),
      }))
    } catch (e) {
      console.error('deleteCustomer failed:', e)
      notify('error', 'ลบลูกค้าไม่สำเร็จ')
    }
  },

  async addPurchase(record, initialPayment?, stockOverrideConfirmed = false) {
    try {
      const body = {
        ...record,
        ...(initialPayment ? { initial_payment: initialPayment } : {}),
        ...(stockOverrideConfirmed ? { stock_override_confirmed: true } : {}),
      }
      const res = await api.purchases.create(record.customer_id, body)
      set(s => ({ purchases: [res.data, ...s.purchases] }))
      useProductStore.getState().fetchProducts()
    } catch (e) {
      console.error('addPurchase failed:', e)
      if ((e as any)?.payload?.error !== 'INSUFFICIENT_STOCK') {
        notify('error', purchaseErrorMessage(e, 'บันทึกการซื้อไม่สำเร็จ'))
      }
      throw e
    }
  },

  async updatePurchase(id, record, stockOverrideConfirmed = false) {
    try {
      const body = {
        ...record,
        ...(stockOverrideConfirmed ? { stock_override_confirmed: true } : {}),
      }
      const res = await api.purchases.update(record.customer_id, id, body)
      set(s => ({
        purchases: s.purchases.map(p => p.id === id ? res.data : p),
      }))
      useProductStore.getState().fetchProducts()
    } catch (e) {
      console.error('updatePurchase failed:', e)
      if ((e as any)?.payload?.error !== 'INSUFFICIENT_STOCK') {
        notify('error', purchaseErrorMessage(e, 'แก้ไขรายการซื้อไม่สำเร็จ'))
      }
      throw e
    }
  },

  async deletePurchase(id, customerId) {
    try {
      await api.purchases.remove(customerId, id)
      set(s => ({ purchases: s.purchases.filter(p => p.id !== id) }))
      useProductStore.getState().fetchProducts()
    } catch (e) {
      console.error('deletePurchase failed:', e)
      notify('error', 'ลบรายการซื้อไม่สำเร็จ')
    }
  },

  async addPayment(purchaseId, data) {
    try {
      const res = await api.payments.create(purchaseId, data)
      set(s => ({
        purchases: s.purchases.map(p => p.id === purchaseId ? res.purchase : p),
      }))
      return res.purchase as PurchaseRecord
    } catch (e) {
      console.error('addPayment failed:', e)
      notify('error', purchaseErrorMessage(e, 'บันทึกการชำระเงินไม่สำเร็จ'))
      return null
    }
  },

  async deletePayment(purchaseId, paymentId) {
    try {
      const res = await api.payments.remove(purchaseId, paymentId)
      set(s => ({
        purchases: s.purchases.map(p => p.id === purchaseId ? res.purchase : p),
      }))
      return res.purchase as PurchaseRecord
    } catch (e) {
      console.error('deletePayment failed:', e)
      notify('error', purchaseErrorMessage(e, 'ลบการชำระเงินไม่สำเร็จ'))
      return null
    }
  },

  async updateOrderStatus(purchaseId, status) {
    try {
      const res = await api.purchases.updateStatus(purchaseId, status)
      set(s => ({
        purchases: s.purchases.map(p => p.id === purchaseId ? res.data : p),
      }))
    } catch (e) {
      console.error('updateOrderStatus failed:', e)
      notify('error', 'อัปเดตสถานะ order ไม่สำเร็จ')
    }
  },

  async updatePurchaseCosts(purchaseId, costs) {
    try {
      const res = await api.purchases.updateCosts(purchaseId, costs)
      set(s => ({
        purchases: s.purchases.map(p => p.id === purchaseId ? res.data : p),
      }))
    } catch (e) {
      console.error('updatePurchaseCosts failed:', e)
      notify('error', 'บันทึกต้นทุนไม่สำเร็จ')
    }
  },

  getCustomerPurchases(customer_id) {
    return get().purchases
      .filter(p => p.customer_id === customer_id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  },
}))
