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
