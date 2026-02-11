// ===== Cloudflare Bindings =====
export type Bindings = {
    DB: D1Database
    BUCKET: R2Bucket
    KV: KVNamespace
    ORDER_QUEUE: Queue
    ENCRYPTION_KEY: string // Secret for AES-256
}

// ===== Database Models =====

export interface Distributor {
    id: number
    name: string
    token: string | null
    balance: number
    frozen_balance: number
    tax_reg_number: string | null
    created_at: string
}

export interface Product {
    id: number
    sku: string
    name_cn: string | null
    name_jp: string | null
    cost_price: number
    tax_category: 'standard' | 'reduced'
}

export interface ProductVariant {
    id: number
    product_id: number
    color: string | null
    size: string | null
    sku: string
    stock_qty: number
}

export interface PlatformMapping {
    id: number
    local_sku: string
    platform: 'TIKTOK' | 'TEMU' | 'RAKUTEN'
    platform_sku: string
}

export interface Order {
    id: number
    platform: 'TIKTOK' | 'TEMU' | 'RAKUTEN'
    platform_order_id: string
    status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
    total_amount: number
    tax_total: number
    distributor_id: number
    created_at: string
}

export interface OrderItem {
    id: number
    order_id: number
    sku: string
    qty: number
    unit_price: number
    tax_rate: number
}

export interface WalletTransaction {
    id: number
    distributor_id: number
    type: 'DEPOSIT' | 'FREEZE' | 'DEDUCT' | 'REFUND'
    amount: number
    related_order_id: string | null
    balance_snapshot: number
    created_at: string
}

export interface WarehouseLocation {
    id: number
    code: string
    sku: string
    qty: number
}

export interface Invoice {
    id: number
    order_id: number
    pdf_url: string | null
    tax_details: string // JSON string
    created_at: string
}

export interface ApiLog {
    id: number
    platform: string
    endpoint: string
    status_code: number
    response_time_ms: number
    error_message: string | null
    created_at: string
}

export interface NotificationLog {
    id: number
    type: 'INFO' | 'WARNING' | 'CRITICAL'
    channel: 'LARK' | 'SLACK' | 'LINE' | 'EMAIL'
    message: string
    created_at: string
}

export interface BackupSnapshot {
    id: number
    date: string
    r2_path: string
    checksum: string
    created_at: string
}

// ===== API Request/Response Types =====

export interface RechargeRequest {
    distributor_id: number
    amount: number
    note?: string
}

export interface OrderSyncMessage {
    platform: string
    payload: {
        order_id: string
        items: { sku: string; qty: number; price: number }[]
        total: number
    }
    receivedAt: string
}
