export const PLATFORMS = ['TIKTOK', 'TEMU', 'RAKUTEN'] as const
export const ORDER_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const
export const RETURN_STATUSES = ['REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED', 'REJECTED'] as const
export const SHIPMENT_STATUSES = ['SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'] as const
export const CARRIERS = ['YAMATO', 'SAGAWA', 'JAPAN_POST', 'FEDEX', 'DHL', 'OTHER'] as const
export const WALLET_TX_TYPES = ['DEPOSIT', 'FREEZE', 'DEDUCT', 'REFUND'] as const

export const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400',
  PROCESSING: 'bg-blue-500/15 text-blue-400',
  SHIPPED: 'bg-purple-500/15 text-purple-400',
  DELIVERED: 'bg-emerald-500/15 text-emerald-400',
  CANCELLED: 'bg-red-500/15 text-red-400',
  IN_TRANSIT: 'bg-blue-500/15 text-blue-400',
  RETURNED: 'bg-red-500/15 text-red-400',
  REQUESTED: 'bg-amber-500/15 text-amber-400',
  APPROVED: 'bg-blue-500/15 text-blue-400',
  RECEIVED: 'bg-purple-500/15 text-purple-400',
  REFUNDED: 'bg-emerald-500/15 text-emerald-400',
  REJECTED: 'bg-red-500/15 text-red-400',
  SETTLED: 'bg-emerald-500/15 text-emerald-400',
  FAILED: 'bg-red-500/15 text-red-400',
  DEPOSIT: 'bg-emerald-500/15 text-emerald-400',
  FREEZE: 'bg-blue-500/15 text-blue-400',
  DEDUCT: 'bg-red-500/15 text-red-400',
  REFUND: 'bg-amber-500/15 text-amber-400',
}

export const PLATFORM_COLORS: Record<string, string> = {
  TIKTOK: 'bg-pink-500/15 text-pink-400',
  TEMU: 'bg-orange-500/15 text-orange-400',
  RAKUTEN: 'bg-red-500/15 text-red-400',
}
