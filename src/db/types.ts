// ===== Cloudflare Bindings =====
export type Bindings = {
    DB: D1Database
    BUCKET: R2Bucket
    KV: KVNamespace
    ORDER_QUEUE: Queue
    ENCRYPTION_KEY: string
}

// ===== Hono Context Variables =====
export type Variables = {
    distributorId: number
    role: 'admin' | 'distributor'
}

// ===== Database Models =====

export interface Distributor {
    id: number
    name: string
    token: string | null
    username: string | null
    password_hash: string | null
    totp_secret: string | null
    totp_enabled: number
    language: string
    balance: number
    frozen_balance: number
    tax_reg_number: string | null
    role: 'admin' | 'distributor'
    created_at: string
}

export interface Product {
    id: number
    sku: string
    name_cn: string | null
    name_jp: string | null
    cost_price: number
    tax_category: 'standard' | 'reduced'
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
    delivered_at: string | null
    cancelled_at: string | null
    customer_id: number | null
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
    invoice_number: string | null
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
    status: 'PENDING' | 'SETTLED' | 'FAILED'
    settled_at: string | null
    wallet_tx_id: number | null
    created_at: string
}

export interface Shipment {
    id: number
    order_id: number
    tracking_number: string
    carrier: 'YAMATO' | 'SAGAWA' | 'JAPAN_POST' | 'FEDEX' | 'DHL' | 'OTHER'
    status: 'SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED'
    shipped_at: string
    estimated_delivery: string | null
    distributor_id: number
    created_at: string
}

export interface Customer {
    id: number
    name: string
    email: string | null
    phone: string | null
    address_line1: string | null
    address_line2: string | null
    city: string | null
    prefecture: string | null
    postal_code: string | null
    country: string
    platform: string | null
    platform_customer_id: string | null
    tags: string
    notes: string | null
    distributor_id: number
    created_at: string
}

export interface ImportLog {
    id: number
    type: 'PRODUCTS' | 'ORDERS'
    filename: string
    total_rows: number
    success_count: number
    error_count: number
    error_details: string | null
    distributor_id: number
    created_at: string
}

export interface Notification {
    id: number
    distributor_id: number
    type: 'ORDER_SHIPPED' | 'ORDER_DELIVERED' | 'ORDER_CANCELLED' | 'LOW_STOCK' | 'COMMISSION_SETTLED' | 'IMPORT_COMPLETE' | 'SYSTEM_ALERT'
    title: string
    message: string
    is_read: number
    related_resource_type: string | null
    related_resource_id: string | null
    created_at: string
}

export interface NotificationPreference {
    id: number
    distributor_id: number
    event_type: string
    enabled: number
    channel: string
    webhook_url: string | null
    created_at: string
}

// ===== API Request/Response Types =====

export interface RechargeRequest {
    distributor_id: number
    amount: number
    note?: string
}

export interface PlatformSyncLog {
    id: number
    platform: 'TIKTOK' | 'TEMU' | 'RAKUTEN'
    sync_type: 'MANUAL' | 'CRON'
    orders_fetched: number
    orders_queued: number
    status: 'RUNNING' | 'COMPLETED' | 'FAILED'
    error_message: string | null
    started_at: string
    completed_at: string | null
}

export interface AuditLog {
    id: number
    distributor_id: number | null
    action: string
    resource_type: string
    resource_id: string | null
    details: string | null
    ip_address: string | null
    created_at: string
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

// ===== Report Types =====

export interface ReportParams {
    distributorId: number
    role: 'admin' | 'distributor'
    period: string
}

export interface CustomReportParams {
    distributorId: number
    role: 'admin' | 'distributor'
    startDate: string
    endDate: string
    dimensions: string[]
    metrics: string[]
}
