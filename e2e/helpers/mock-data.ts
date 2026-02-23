// Factory functions for typed mock objects matching frontend/src/api/types.ts

import type { Order, Shipment, ShipmentEvent, Return, WalletTransaction, Commission, CommissionSettlement, Customer, Product } from '../../frontend/src/api/types'

export function mockOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    platform: 'TIKTOK',
    platform_order_id: 'TT-001',
    status: 'PROCESSING',
    total_amount: 5000,
    tax_total: 500,
    distributor_id: 1,
    created_at: '2024-01-15T10:00:00Z',
    delivered_at: null,
    cancelled_at: null,
    customer_id: null,
    currency: 'JPY',
    discount_amount: 0,
    ...overrides,
  }
}

export function mockShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: 1,
    order_id: 1,
    tracking_number: 'TRK-001',
    carrier: 'YAMATO',
    status: 'SHIPPED',
    shipped_at: '2024-01-15T10:00:00Z',
    estimated_delivery: '2024-01-20',
    actual_delivery: null,
    delivery_notes: null,
    distributor_id: 1,
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

export function mockShipmentEvent(overrides: Partial<ShipmentEvent> = {}): ShipmentEvent {
  return {
    id: 1,
    shipment_id: 1,
    status: 'SHIPPED',
    location: 'Tokyo',
    description: 'Package shipped',
    event_time: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

export function mockReturn(overrides: Partial<Return> = {}): Return {
  return {
    id: 1,
    order_id: 1,
    shipment_id: null,
    distributor_id: 1,
    status: 'REQUESTED',
    reason: 'Defective item',
    notes: null,
    refund_type: 'FULL',
    refund_amount: 5000,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

export function mockWalletTransaction(overrides: Partial<WalletTransaction> = {}): WalletTransaction {
  return {
    id: 1,
    distributor_id: 1,
    type: 'DEPOSIT',
    amount: 10000,
    related_order_id: null,
    balance_snapshot: 150000,
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

export function mockCommission(overrides: Partial<Commission> = {}): Commission {
  return {
    id: 1,
    sku: 'SKU-001',
    platform: 'TIKTOK',
    rate: 0.1,
    ...overrides,
  }
}

export function mockCommissionSettlement(overrides: Partial<CommissionSettlement> = {}): CommissionSettlement {
  return {
    id: 1,
    distributor_id: 1,
    order_id: 1,
    sku: 'SKU-001',
    platform: 'TIKTOK',
    qty: 2,
    unit_price: 2500,
    commission_rate: 0.1,
    commission_amount: 500,
    status: 'PENDING',
    settled_at: null,
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

export function mockCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1,
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '03-1234-5678',
    address_line1: null,
    city: null,
    prefecture: null,
    postal_code: null,
    country: 'JP',
    platform: 'TIKTOK',
    tags: '',
    notes: null,
    distributor_id: 1,
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

export function mockProduct(overrides: Partial<Product & { total_stock: number }> = {}): Product & { total_stock: number } {
  return {
    id: 1,
    sku: 'SKU-001',
    name_jp: 'テスト商品',
    name_cn: 'Test Product',
    cost_price: 2500,
    tax_category: 'standard',
    image_url: null,
    total_stock: 100,
    ...overrides,
  }
}

export function mockCoupon(overrides: Partial<{
  id: number; code: string; name: string; type: string; value: number;
  min_order_amount: number; usage_limit: number; per_user_limit: number;
  usage_count: number; platform: string | null; valid_from: string;
  valid_to: string; is_active: number; created_by: number; created_at: string;
}> = {}) {
  return {
    id: 1,
    code: 'KDF-TEST0001',
    name: 'Test Coupon',
    type: 'PERCENTAGE',
    value: 10,
    min_order_amount: 1000,
    usage_limit: 100,
    per_user_limit: 1,
    usage_count: 5,
    platform: null,
    valid_from: '2024-01-01',
    valid_to: '2024-12-31',
    is_active: 1,
    created_by: 1,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

export function mockPriceRule(overrides: Partial<{
  id: number; sku: string; platform: string; base_price: number;
  sale_price: number | null; valid_from: string | null; valid_to: string | null;
  is_active: number; created_at: string; updated_at: string;
}> = {}) {
  return {
    id: 1,
    sku: 'SKU-001',
    platform: 'TIKTOK',
    base_price: 3000,
    sale_price: null,
    valid_from: null,
    valid_to: null,
    is_active: 1,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

export function mockPriceHistory(overrides: Partial<{
  id: number; sku: string; platform: string; old_price: number;
  new_price: number; created_at: string;
}> = {}) {
  return {
    id: 1,
    sku: 'SKU-001',
    platform: 'TIKTOK',
    old_price: 2500,
    new_price: 3000,
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

export function mockMarginAnalysis(overrides: Partial<{
  sku: string; platform: string; cost_price: number; base_price: number;
  margin: number; margin_percent: number;
}> = {}) {
  return {
    sku: 'SKU-001',
    platform: 'TIKTOK',
    cost_price: 2000,
    base_price: 3000,
    margin: 1000,
    margin_percent: 33.3,
    ...overrides,
  }
}

export function mockExchangeRate(overrides: Partial<{
  id: number; from_currency: string; to_currency: string; rate: number;
  updated_at: string; created_by: number; created_at: string;
}> = {}) {
  return {
    id: 1,
    from_currency: 'USD',
    to_currency: 'JPY',
    rate: 155.43,
    updated_at: '2024-01-15T10:00:00Z',
    created_by: 1,
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

export function mockInvoice(overrides: Partial<{
  id: number; order_id: number; invoice_number: string; platform: string;
  total_amount: number; pdf_url: string | null; created_at: string;
  tax_details: string;
}> = {}) {
  return {
    id: 1,
    order_id: 101,
    invoice_number: 'INV-202401-001',
    platform: 'TIKTOK',
    total_amount: 5500,
    pdf_url: null,
    created_at: '2024-01-15T10:00:00Z',
    tax_details: '{}',
    ...overrides,
  }
}

export function paginatedResponse<T>(items: T[], total?: number) {
  const t = total ?? items.length
  return {
    pagination: {
      total: t,
      page: 1,
      limit: 20,
      pages: Math.ceil(t / 20) || 1,
    },
    items,
  }
}
