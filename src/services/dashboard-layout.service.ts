const DEFAULT_LAYOUT = [
    { widgetId: 'stats', order: 0, visible: true },
    { widgetId: 'platformDonut', order: 1, visible: true },
    { widgetId: 'ordersChart', order: 2, visible: true },
    { widgetId: 'salesHeatmap', order: 3, visible: true },
    { widgetId: 'turnoverChart', order: 4, visible: true },
]

export class DashboardLayoutService {
    constructor(private db: D1Database) {}

    async getLayout(distributorId: number): Promise<any[]> {
        const row = await this.db.prepare(
            'SELECT layout FROM dashboard_layouts WHERE distributor_id = ?'
        ).bind(distributorId).first<{ layout: string }>()

        if (!row) return DEFAULT_LAYOUT

        try {
            return JSON.parse(row.layout)
        } catch {
            return DEFAULT_LAYOUT
        }
    }

    async saveLayout(distributorId: number, layout: any[]): Promise<any[]> {
        if (!Array.isArray(layout)) throw new Error('layout must be an array')

        const layoutJson = JSON.stringify(layout)

        await this.db.prepare(
            `INSERT INTO dashboard_layouts (distributor_id, layout, updated_at)
             VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(distributor_id) DO UPDATE SET layout = ?, updated_at = CURRENT_TIMESTAMP`
        ).bind(distributorId, layoutJson, layoutJson).run()

        return layout
    }
}
