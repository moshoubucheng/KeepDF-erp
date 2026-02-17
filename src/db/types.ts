// ===== Cloudflare Bindings =====
export type Bindings = {
    DB: D1Database
    BUCKET: R2Bucket
    KV: KVNamespace
    ORDER_QUEUE: Queue
    ENCRYPTION_KEY: string
    ASSETS: Fetcher
    VAPID_PUBLIC_KEY: string
    VAPID_PRIVATE_KEY: string
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
    email: string | null
    phone: string | null
    address: string | null
    contact_person: string | null
    onboarding_completed: number
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
    price_sync: number
    stock_sync: number
    platform_title: string | null
    platform_description: string | null
    is_active: number
    updated_at: string
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
    currency: string
    total_amount_jpy: number | null
    exchange_rate: number
    coupon_id: number | null
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
    actual_delivery: string | null
    delivery_notes: string | null
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

// ===== Sprint 9: Returns =====

export interface Return {
    id: number
    order_id: number
    shipment_id: number | null
    distributor_id: number
    status: 'REQUESTED' | 'APPROVED' | 'RECEIVED' | 'REFUNDED' | 'REJECTED'
    reason: string | null
    notes: string | null
    refund_type: 'FULL' | 'PARTIAL' | null
    refund_amount: number | null
    wallet_tx_id: number | null
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

// ===== Sprint 9: Suppliers & Procurement =====

export interface Supplier {
    id: number
    name: string
    contact_name: string | null
    contact_email: string | null
    contact_phone: string | null
    address: string | null
    payment_terms: string | null
    lead_time_days: number
    notes: string | null
    is_active: number
    created_at: string
    updated_at: string
}

export interface PurchaseOrder {
    id: number
    po_number: string
    supplier_id: number
    status: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'SHIPPED' | 'RECEIVED' | 'CLOSED'
    total_amount: number
    notes: string | null
    expected_delivery: string | null
    received_at: string | null
    created_by: number
    created_at: string
    updated_at: string
}

export interface PurchaseOrderItem {
    id: number
    po_id: number
    sku: string
    qty: number
    unit_cost: number
    received_qty: number
}

// ===== Sprint 9: Price Management =====

export interface PriceRule {
    id: number
    sku: string
    platform: 'TIKTOK' | 'TEMU' | 'RAKUTEN' | 'ALL'
    base_price: number
    sale_price: number | null
    valid_from: string | null
    valid_to: string | null
    is_active: number
    created_at: string
    updated_at: string
}

export interface PriceHistory {
    id: number
    sku: string
    platform: string
    old_price: number | null
    new_price: number
    change_type: 'BASE' | 'SALE' | 'COST'
    changed_by: number | null
    created_at: string
}

// ===== Sprint 9: Communication =====

export interface MessageTemplate {
    id: number
    name: string
    type: 'ORDER_CONFIRMATION' | 'SHIPPING_NOTIFICATION' | 'DELIVERY_CONFIRMATION' | 'RETURN_APPROVED' | 'RETURN_REJECTED' | 'CUSTOM'
    subject: string | null
    body: string
    channel: 'EMAIL' | 'SMS' | 'IN_APP'
    is_active: number
    distributor_id: number
    created_at: string
    updated_at: string
}

export interface CustomerMessage {
    id: number
    customer_id: number
    template_id: number | null
    type: string
    subject: string | null
    content: string
    channel: string
    status: 'SENT' | 'DELIVERED' | 'FAILED'
    related_order_id: number | null
    distributor_id: number
    sent_at: string
}

export interface MessageTrigger {
    id: number
    event_type: 'ORDER_CREATED' | 'ORDER_SHIPPED' | 'ORDER_DELIVERED' | 'ORDER_CANCELLED' | 'RETURN_APPROVED' | 'RETURN_REJECTED'
    template_id: number
    is_active: number
    distributor_id: number
    created_at: string
}

// ===== Sprint 9: Inventory Forecasting =====

export interface InventoryForecast {
    id: number
    sku: string
    daily_velocity: number
    weekly_velocity: number
    days_of_stock: number
    reorder_point: number
    safety_stock: number
    lead_time_days: number
    calculated_at: string
}

// ===== Sprint 11: Automation Rules =====

export interface AutomationRule {
    id: number
    name: string
    type: 'AUTO_REORDER' | 'AUTO_PRICE_ADJUST' | 'STOCK_ALERT'
    conditions: string  // JSON
    actions: string     // JSON
    is_active: number
    distributor_id: number
    last_run_at: string | null
    run_count: number
    created_at: string
    updated_at: string
}

export interface AutomationLog {
    id: number
    rule_id: number
    rule_name: string
    trigger_type: 'CRON' | 'EVENT' | 'MANUAL'
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'NO_MATCH'
    details: string | null
    items_affected: number
    execution_time_ms: number
    created_at: string
}

export interface AutoReorderConditions {
    threshold_type: 'reorder_point' | 'fixed'
    threshold_value?: number
    min_daily_velocity?: number
    sku_filter?: string[]
}

export interface AutoReorderActions {
    supplier_id?: number
    qty_multiplier?: number
    notify?: boolean
}

export interface AutoPriceAdjustConditions {
    margin_type: 'min_margin_pct' | 'min_margin_abs'
    threshold: number
    platform_filter?: string[]
    sku_filter?: string[]
}

export interface AutoPriceAdjustActions {
    adjust_type: 'set_margin_pct' | 'increase_pct' | 'increase_abs'
    adjust_value: number
    max_price?: number
    notify?: boolean
}

export interface StockAlertConditions {
    threshold_type: 'days_of_stock' | 'fixed_qty'
    threshold_value: number
    sku_filter?: string[]
}

export interface StockAlertActions {
    notify: boolean
    notification_level?: 'INFO' | 'WARNING' | 'CRITICAL'
}

// ===== Sprint 12: Exchange Rates =====

export interface ExchangeRate {
    id: number
    from_currency: 'JPY' | 'USD' | 'CNY'
    to_currency: 'JPY' | 'USD' | 'CNY'
    rate: number
    source: string
    updated_by: number | null
    created_at: string
    updated_at: string
}

// ===== Sprint 12: Shipment Events =====

export interface ShipmentEvent {
    id: number
    shipment_id: number
    status: 'SHIPPED' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED' | 'EXCEPTION'
    location: string | null
    description: string | null
    event_time: string
    created_at: string
}

// ===== Sprint 12: Coupons =====

export interface Coupon {
    id: number
    code: string
    name: string
    type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'
    value: number
    currency: string
    min_order_amount: number
    max_discount: number | null
    usage_limit: number
    usage_count: number
    per_user_limit: number
    platform: string
    valid_from: string
    valid_to: string
    is_active: number
    created_by: number
    created_at: string
    updated_at: string
}

export interface CouponUsage {
    id: number
    coupon_id: number
    order_id: number
    distributor_id: number
    discount_amount: number
    discount_amount_jpy: number
    used_at: string
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
