export type Gender = 'male' | 'female' | 'unspecified'
export type CustomerSource = 'walk_in' | 'referral' | 'social_media' | 'other'
export type Occupation =
  | '' | 'office' | 'driver' | 'student' | 'teacher' | 'healthcare'
  | 'engineer' | 'business' | 'labor' | 'retiree' | 'other'
export type LensType = 'single_vision' | 'bi_focal' | 'pal' | 'specialty' | 'other'
export type LensKind = 'stock_order' | 'stock_store' | 'rx'
export type LensIndex = '1.50' | '1.56' | '1.60' | '1.67' | '1.74'
export type Coating = 'hmc' | 'blue_block' | 'photochromic' | 'anti_fog' | 'drive'
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'qr'
export type PaymentStatus = 'pending' | 'partial' | 'paid'
export type OrderStatus   = 'waiting' | 'arrived' | 'cutting' | 'ready' | 'completed'

export interface EyeRx {
  sph: string; cyl: string; axs: string; prism: string
  add: string; va: string; pd: string; fh: string
}

export const BLANK_EYE: EyeRx = {
  sph: '', cyl: '', axs: '', prism: '', add: '', va: '', pd: '', fh: '',
}

export interface LensPurchase {
  enabled: boolean
  product_id?: number | null
  product_name?: string
  sku?: string
  brand?: string
  right: EyeRx
  left: EyeRx
  lens_type: LensType
  sv_eye: 'far' | 'near' | ''
  lens_kind: LensKind
  barcode: string
  index: LensIndex
  coatings: Coating[]
  notes: string
}

export interface FramePurchase {
  enabled: boolean
  product_id?: number | null
  product_name?: string
  sku?: string
  source: 'store' | 'customer' | 'pre_order'
  barcode: string
  model?: string
}

export interface OtherPurchase {
  enabled: boolean
  product_id?: number | null
  product_name?: string
  sku?: string
  source?: 'store' | 'pre_order'
  barcode: string
}

export interface PriceBlock {
  full: number
  percent: number
  discounted: number
}

export interface Payment {
  id: string
  purchase_id: string
  amount: number
  method: PaymentMethod
  note: string
  paid_at: string
  created_at: string
}

export interface InitialPayment {
  amount: number
  method: PaymentMethod
  note: string
  paid_at: string
}

export interface StockOverrideWarning {
  kind: 'product' | 'lens_variant'
  label: string
  name: string
  identifier: string
  current_stock: number
  requested_qty: number
  after_stock: number
}

export interface StockOverrideAudit {
  by: string
  at: string
  warnings: StockOverrideWarning[]
}

export interface OrderStatusLog {
  id: number
  order_kind: 'purchase' | 'claim'
  order_id: string
  from_status: OrderStatus | ''
  to_status: OrderStatus
  changed_by: string
  changed_at: string
}

export interface PurchaseRecord {
  id: string
  customer_id: string
  date: string
  lens: LensPurchase
  frame: FramePurchase
  other: OtherPurchase
  price_lens: PriceBlock
  price_frame: PriceBlock
  price_other: PriceBlock
  special_discount: number
  total: number
  pickup_date: string
  pickup_time: string
  payment_status: PaymentStatus
  paid_amount: number
  order_status: OrderStatus
  cost_lens:  number | null
  cost_frame: number | null
  cost_other: number | null
  prev_rx:    { right: EyeRx; left: EyeRx; sv_eye?: 'far' | 'near' | '' } | null
  order_rx:   { right: EyeRx; left: EyeRx } | null
  lens_variant_id_r?: number | null
  lens_variant_id_l?: number | null
  stock_override?: StockOverrideAudit | null
  created_at: string
}

export interface Customer {
  customer_id: string
  first_name: string
  last_name: string
  phone_no: string
  email: string
  birthday: string
  gender: Gender
  address: string
  note: string
  source: CustomerSource
  occupation: Occupation
  created_at: string
}

export type CustomerFormData = Omit<Customer, 'customer_id' | 'created_at'>

export type ClaimStatus = 'pending' | 'in_progress' | 'resolved'
export type ClaimType = 'broken_frame' | 'scratched_lens' | 'rx_change' | 'adjustment' | 'other'

export type ClaimPaymentStatus = 'pending' | 'partial' | 'paid'

export interface ClaimStockItem {
  id?: number
  claim_id?: string
  product_id: number
  product_name: string
  barcode: string
  qty: number
  cost: number
}

export interface ClaimPayment {
  id: string
  claim_id: string
  amount: number
  method: PaymentMethod
  note: string
  paid_at: string
  created_at: string
}

export interface Claim {
  id: string
  purchase_id: string
  customer_id: string
  claim_type: ClaimType | string
  description: string
  status: ClaimStatus
  order_status: OrderStatus
  fee: number
  payment_status: ClaimPaymentStatus
  paid_amount: number
  pickup_date: string
  resolved_at: string
  created_at: string
  updated_at: string
  // joined fields from GET /claims
  first_name?: string
  last_name?: string
  phone_no?: string
  purchase_date?: string
  purchase_total?: number
  last_payment_date?: string | null
}
