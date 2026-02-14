/**
 * CSV utility - RFC 4180 compliant
 */

export interface CsvColumn {
    key: string
    header: string
}

/**
 * Convert data array to CSV string (RFC 4180)
 */
export function toCSV(data: Record<string, unknown>[], columns: CsvColumn[]): string {
    const header = columns.map((col) => escapeField(col.header)).join(',')

    const rows = data.map((row) =>
        columns.map((col) => escapeField(row[col.key])).join(',')
    )

    return [header, ...rows].join('\r\n')
}

/**
 * Escape a single CSV field per RFC 4180
 */
function escapeField(value: unknown): string {
    if (value == null) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

/**
 * Create a CSV Response with proper headers
 */
export function csvResponse(csv: string, filename: string): Response {
    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    })
}
