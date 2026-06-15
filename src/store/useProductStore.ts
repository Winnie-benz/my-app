import { create } from 'zustand'
import type { Product, ProductFormData, StockCheckEntry, CheckStatus, InventorySession } from '../types/product'
import { api } from '../services/api'
import { notify } from '../utils/notify'

export type ModalState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; product: Product }
  | { mode: 'delete'; product: Product }
  | { mode: 'stock-in-notice'; product: Product; added: number; newAvg: number }
  | { mode: 'stock-in'; product: Product }
  | { mode: 'stock-out'; product: Product }

type ProcessCountResult = {
  status: CheckStatus
  warning?: string
  productName?: string
  finalCounted?: number
  expected?: number
}

type ProductStore = {
  products: Product[]
  loading: boolean
  fetchProducts: () => Promise<void>

  addProduct: (data: ProductFormData) => Promise<void>
  updateProduct: (id: number, data: ProductFormData) => Promise<void>
  deleteProduct: (id: number) => Promise<void>
  stockIn: (id: number, qty: number, cost: number) => Promise<void>
  stockOut: (id: number, qty: number, cost: number) => Promise<void>
  deductStock: (id: number, qty: number) => Promise<void>

  search: string
  setSearch: (q: string) => void
  categoryFilter: string
  setCategoryFilter: (c: string) => void

  modal: ModalState
  setModal: (m: ModalState) => void

  checkEntries: StockCheckEntry[]
  initCheckEntries: () => void
  processCount: (barcode: string, qty: number) => ProcessCountResult
  resetCheck: () => void
  submitCheck: (createdBy: string) => Promise<InventorySession | null>
}

function buildCheckEntries(products: Product[]): StockCheckEntry[] {
  return products.map(p => ({
    product: p,
    expected: p.stock_current,
    counted: 0,
    status: 'unchecked' as CheckStatus,
  }))
}

export const useProductStore = create<ProductStore>()((set, get) => ({
  products: [],
  loading:  false,

  async fetchProducts() {
    set({ loading: true })
    try {
      const res = await api.products.list()
      set({ products: res.data, loading: false })
    } catch {
      notify('error', 'โหลดข้อมูลสินค้าไม่สำเร็จ')
      set({ loading: false })
    }
  },

  async addProduct(data) {
    try {
      const res = await api.products.create(data)
      if (res.stockIn) {
        set(s => ({
          products: s.products.map((p: Product) => p.id === res.data.id ? res.data : p),
          modal: { mode: 'stock-in-notice', product: res.data, added: res.added, newAvg: res.newAvg },
        }))
      } else {
        set(s => ({
          products: [...s.products, res.data],
          modal: { mode: 'closed' },
        }))
      }
    } catch (e) {
      console.error('addProduct failed:', e)
      notify('error', 'เพิ่มสินค้าไม่สำเร็จ')
      set({ modal: { mode: 'closed' } })
    }
  },

  async updateProduct(id, data) {
    try {
      const res = await api.products.update(id, data)
      set(s => ({
        products: s.products.map((p: Product) => p.id === id ? res.data : p),
        modal: { mode: 'closed' },
      }))
    } catch (e) {
      console.error('updateProduct failed:', e)
      notify('error', 'แก้ไขสินค้าไม่สำเร็จ')
      set({ modal: { mode: 'closed' } })
    }
  },

  async deleteProduct(id) {
    try {
      await api.products.remove(id)
      set(s => ({
        products: s.products.filter((p: Product) => p.id !== id),
        modal: { mode: 'closed' },
      }))
    } catch (e) {
      console.error('deleteProduct failed:', e)
      notify('error', 'ลบสินค้าไม่สำเร็จ')
      set({ modal: { mode: 'closed' } })
    }
  },

  async stockIn(id, qty, cost) {
    try {
      const res = await api.products.stockIn(id, qty, cost)
      set(s => ({
        products: s.products.map((p: Product) => p.id === id ? res.data : p),
        modal: { mode: 'closed' },
      }))
    } catch (e) {
      console.error('stockIn failed:', e)
      notify('error', 'รับสินค้าเข้าไม่สำเร็จ')
      set({ modal: { mode: 'closed' } })
    }
  },

  async stockOut(id, qty, cost) {
    try {
      const res = await api.products.stockOut(id, qty, cost)
      set(s => ({
        products: s.products.map((p: Product) => p.id === id ? res.data : p),
        modal: { mode: 'closed' },
      }))
    } catch (e) {
      console.error('stockOut failed:', e)
      notify('error', 'ตัดสินค้าออกไม่สำเร็จ')
      set({ modal: { mode: 'closed' } })
    }
  },

  async deductStock(id, qty) {
    try {
      const res = await api.products.deduct(id, qty)
      set(s => ({
        products: s.products.map((p: Product) => p.id === id ? res.data : p),
      }))
    } catch (e) {
      console.error('deductStock failed:', e)
      notify('error', 'ตัดสต็อกไม่สำเร็จ')
    }
  },

  search: '',
  setSearch: q => set({ search: q }),

  categoryFilter: 'All',
  setCategoryFilter: c => set({ categoryFilter: c }),

  modal: { mode: 'closed' },
  setModal: m => set({ modal: m }),

  checkEntries: [],

  initCheckEntries() {
    set({ checkEntries: buildCheckEntries(get().products) })
  },

  processCount(barcode, qty) {
    const { checkEntries } = get()
    const idx = checkEntries.findIndex(e => e.product.barcode === barcode)
    if (idx < 0) return { status: 'unchecked' as CheckStatus }

    const entry = checkEntries[idx]
    const tentative = entry.counted + qty

    if (tentative > entry.expected) {
      set(s => ({
        checkEntries: s.checkEntries.map((e, i) =>
          i === idx ? { ...e, counted: 0, status: 'unchecked' as CheckStatus } : e,
        ),
      }))
      return { status: 'over' as CheckStatus, warning: 'Over scan detected. Please recount.', productName: entry.product.name }
    }

    const newStatus: CheckStatus = tentative === entry.expected ? 'ok' : 'missing'
    set(s => ({
      checkEntries: s.checkEntries.map((e, i) =>
        i === idx ? { ...e, counted: tentative, status: newStatus } : e,
      ),
    }))
    return { status: newStatus, productName: entry.product.name, finalCounted: tentative, expected: entry.expected }
  },

  resetCheck() {
    set({ checkEntries: buildCheckEntries(get().products) })
  },

  async submitCheck(createdBy) {
    try {
      const { checkEntries } = get()
      const items = checkEntries.map(e => ({
        product_id:   e.product.id,
        barcode:      e.product.barcode,
        sku:          e.product.sku,
        product_name: e.product.name,
        expected_qty: e.expected,
        counted_qty:  e.counted,
        difference:   e.counted - e.expected,
        status:       e.status,
      }))
      const res = await api.inventory.submitSession({ created_by: createdBy, items })
      return res.data as InventorySession
    } catch (e) {
      console.error('submitCheck failed:', e)
      notify('error', 'บันทึกการตรวจนับไม่สำเร็จ')
      return null
    }
  },
}))
