// Frontend API types — extracted from src/db/types.ts

export type Role = 'admin' | 'distributor'
export type Platform = 'TIKTOK' | 'TEMU' | 'RAKUTEN'
export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
export type ShipmentStatus = 'SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED'
export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'RECEIVED' | 'REFUNDED' | 'REJECTED'
export type WalletTxType = 'DEPOSIT' | 'FREEZE' | 'DEDUCT' | 'REFUND'
export type CommissionStatus = 'PENDING' | 'SETTLED' | 'FAILED'
export type Carrier = 'YAMATO' | 'SAGAWA' | 'JAPAN_POST' | 'FEDEX' | 'DHL' | 'OTHER'
export type TaxCategory = 'standard' | 'reduced'

export interface User {
  id: number
  name: string
  role: Role
  language: string
  username: string | null
  email: string | null
  phone: string | null
  address: string | null
  contact_person: string | null
  tax_reg_number: string | null
  balance: number
  frozen_balance: number
  totp_enabled: boolean | number
  onboarding_completed?: number
  created_at: string
}

export interface Order {
  id: number
  platform: Platform
  platform_order_id: string
  status: OrderStatus
  total_amount: number
  tax_total: number
  distributor_id: number
  created_at: string
  delivered_at: string | null
  cancelled_at: string | null
  customer_id: number | null
  currency: string
  discount_amount: number
}

export interface OrderItem {
  id: number
  order_id: number
  sku: string
  qty: number
  unit_price: number
  tax_rate: number
}

export interface Product {
  id: number
  sku: string
  name_cn: string | null
  name_jp: string | null
  cost_price: number
  tax_category: TaxCategory
  image_url: string | null
}

export interface ProductVariant {
  id: number
  product_id: number
  color: string | null
  size: string | null
  sku: string
  stock_qty: number
}

export interface InventoryItem extends Product {
  total_stock: number
  variants: ProductVariant[]
  locations: WarehouseLocation[]
}

export interface WarehouseLocation {
  id: number
  code: string
  sku: string
  qty: number
}

export interface Shipment {
  id: number
  order_id: number
  tracking_number: string
  carrier: Carrier
  status: ShipmentStatus
  shipped_at: string
  estimated_delivery: string | null
  actual_delivery: string | null
  delivery_notes: string | null
  distributor_id: number
  created_at: string
}

export interface ShipmentEvent {
  id: number
  shipment_id: number
  status: string
  location: string | null
  description: string | null
  event_time: string
}

export interface Return {
  id: number
  order_id: number
  shipment_id: number | null
  distributor_id: number
  status: ReturnStatus
  reason: string | null
  notes: string | null
  refund_type: 'FULL' | 'PARTIAL' | null
  refund_amount: number | null
  created_at: string
  updated_at: string
}

export interface ReturnItem {
  id: number
  return_id: number
  sku: string
  qty: number
  unit_price: number
  reason: string | null
}

export interface Customer {
  id: number
  name: string
  email: string | null
  phone: string | null
  address_line1: string | null
  city: string | null
  prefecture: string | null
  postal_code: string | null
  country: string
  platform: string | null
  tags: string
  notes: string | null
  distributor_id: number
  created_at: string
}

export interface Commission {
  id: number
  sku: string
  platform: string
  rate: number
}

export interface CommissionSettlement {
  id: number
  distributor_id: number
  order_id: number
  sku: string
  platform: string
  qty: number
  unit_price: number
  commission_rate: number
  commission_amount: number
  status: CommissionStatus
  settled_at: string | null
  created_at: string
}

export interface WalletTransaction {
  id: number
  distributor_id: number
  type: WalletTxType
  amount: number
  related_order_id: string | null
  balance_snapshot: number
  created_at: string
}

export interface Notification {
  id: number
  distributor_id: number
  type: string
  title: string
  message: string
  is_read: number
  created_at: string
}

// API Response wrappers
export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface ApiResponse<T> {
  success: boolean
  data: T
}

export interface LoginResponse {
  success: boolean
  token?: string
  requires_2fa?: boolean
  temp_token?: string
  distributor?: User
}

export interface DashboardStats {
  totalOrders: number
  totalRevenue: number
  activeOrders: number
  totalProducts: number
  distributorsCount?: number
  myOrders?: number
  myRevenue?: number
  myCommission?: number
  myBalance?: number
}
