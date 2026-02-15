/**
 * ShipmentTrackingService - Shipment event timeline and tracking URLs
 */
import type { ShipmentEvent } from '../db/types'

const VALID_EVENT_STATUSES = ['SHIPPED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'EXCEPTION'] as const

const TRACKING_URLS: Record<string, (trackingNumber: string) => string> = {
    YAMATO: (tn) => `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number01=${tn}`,
    SAGAWA: (tn) => `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${tn}`,
    JAPAN_POST: (tn) => `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=${tn}`,
    FEDEX: (tn) => `https://www.fedex.com/fedextrack/?trknbr=${tn}`,
    DHL: (tn) => `https://www.dhl.com/jp-en/home/tracking/tracking-parcel.html?submit=1&tracking-id=${tn}`,
}

export class ShipmentTrackingService {
    constructor(private db: D1Database) {}

    async addEvent(shipmentId: number, status: string, location?: string, description?: string): Promise<ShipmentEvent> {
        status = status.toUpperCase()
        if (!VALID_EVENT_STATUSES.includes(status as typeof VALID_EVENT_STATUSES[number])) {
            throw new Error(`Invalid event status. Must be one of: ${VALID_EVENT_STATUSES.join(', ')}`)
        }

        const shipment = await this.db.prepare('SELECT id FROM shipments WHERE id = ?').bind(shipmentId).first()
        if (!shipment) throw new Error('Shipment not found')

        const { meta } = await this.db.prepare(
            `INSERT INTO shipment_events (shipment_id, status, location, description, event_time)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(shipmentId, status, location || null, description || null).run()

        return this.db.prepare('SELECT * FROM shipment_events WHERE id = ?')
            .bind(meta.last_row_id).first<ShipmentEvent>() as Promise<ShipmentEvent>
    }

    async getEvents(shipmentId: number): Promise<ShipmentEvent[]> {
        const { results } = await this.db.prepare(
            'SELECT * FROM shipment_events WHERE shipment_id = ? ORDER BY event_time ASC'
        ).bind(shipmentId).all<ShipmentEvent>()
        return results
    }

    getTrackingUrl(carrier: string, trackingNumber: string): string | null {
        const fn = TRACKING_URLS[carrier.toUpperCase()]
        return fn ? fn(trackingNumber) : null
    }

    async updateStatusWithEvent(shipmentId: number, status: string, params?: { location?: string; description?: string }): Promise<{ shipment: any; event: ShipmentEvent }> {
        status = status.toUpperCase()

        // Update shipment status
        const updateFields = ['status = ?']
        const updateBinds: (string | null)[] = [status]

        if (status === 'DELIVERED') {
            updateFields.push('actual_delivery = CURRENT_TIMESTAMP')
        }

        await this.db.prepare(
            `UPDATE shipments SET ${updateFields.join(', ')} WHERE id = ?`
        ).bind(...updateBinds, shipmentId).run()

        // Add event
        const event = await this.addEvent(shipmentId, status, params?.location, params?.description)

        const shipment = await this.db.prepare('SELECT * FROM shipments WHERE id = ?')
            .bind(shipmentId).first()

        return { shipment, event }
    }

    async getTimeline(shipmentId: number): Promise<{ shipment: any; events: ShipmentEvent[]; tracking_url: string | null; duration_hours: number | null }> {
        const shipment = await this.db.prepare('SELECT * FROM shipments WHERE id = ?')
            .bind(shipmentId).first()
        if (!shipment) throw new Error('Shipment not found')

        const events = await this.getEvents(shipmentId)
        const tracking_url = this.getTrackingUrl(shipment.carrier as string, shipment.tracking_number as string)

        let duration_hours: number | null = null
        if (events.length >= 2) {
            const first = new Date(events[0].event_time).getTime()
            const last = new Date(events[events.length - 1].event_time).getTime()
            duration_hours = Math.round((last - first) / (1000 * 60 * 60) * 10) / 10
        }

        return { shipment, events, tracking_url, duration_hours }
    }

    async batchAddEvents(events: { shipment_id: number; status: string; location?: string; description?: string }[]): Promise<{ success: number; errors: { index: number; error: string }[] }> {
        let success = 0
        const errors: { index: number; error: string }[] = []

        for (let i = 0; i < events.length; i++) {
            try {
                await this.addEvent(events[i].shipment_id, events[i].status, events[i].location, events[i].description)
                success++
            } catch (e: any) {
                errors.push({ index: i, error: e.message })
            }
        }

        return { success, errors }
    }
}
