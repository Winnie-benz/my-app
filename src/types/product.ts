export type Category = 'กรอบ' | 'อุปกรณ์อื่นๆ'

export const CATEGORIES: Category[] = ['กรอบ', 'อุปกรณ์อื่นๆ']

export type CheckStatus = 'unchecked' | 'ok' | 'missing' | 'over'

export type Product = {
  id: number
  barcode: string
  sku: string
  name: string
  category: Category
  cost_price: number
  sell_price: number
  stock_current: number
  avg_cost: number
  note: string
  reorder_point: number
  low_stock_ignored?: number
}

export type ProductFormData = Omit<Product, 'id' | 'avg_cost' | 'low_stock_ignored'>

export type StockCheckEntry = {
  product: Product
  expected: number
  counted: number
  status: CheckStatus
}

export type InventorySession = {
  id: number
  created_at: string
  created_by: string
  session_type: string
  total_items: number
  total_missing: number
  total_over: number
  total_ok: number
}

export type LensVariantMovement = {
  id: number
  variant_id: number
  product_id: number
  type: string
  qty: number
  cost: number
  avg_cost_after: number
  note: string
  created_at: string
}

export type InventorySessionItem = {
  id: number
  session_id: number
  product_id: number
  barcode: string
  sku: string
  product_name: string
  expected_qty: number
  counted_qty: number
  difference: number
  status: CheckStatus
}

export type InventorySessionDetail = InventorySession & {
  items: InventorySessionItem[]
}

export type LensProduct = {
  id: number
  brand: string
  series: string
  lens_type: string
  lens_index: string
  coating: string
  note: string
  default_cost: number
  sell_price: number
  variant_count: number
  total_stock: number
  created_at: string
  sph_min: number
  sph_max: number
  cyl_min: number
  cyl_max: number
  sph_step: number
  cyl_step: number
}

export type LensVariant = {
  id: number
  product_id: number
  sku: string
  barcode: string
  sph: string
  cyl: string
  axis: string
  add_power: string
  stock_qty: number
  cost: number
  created_at: string
  low_stock_ignored?: number
}
