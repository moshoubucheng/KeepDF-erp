/**
 * Cursor-based pagination utilities.
 * Cursor = base64( "{timestamp}:{id}" )
 * Uses lastIndexOf(':') to split, so ISO timestamps with colons are safe.
 */

export function encodeCursor(timestamp: string, id: number): string {
    return btoa(`${timestamp}:${id}`)
}

export function decodeCursor(cursor: string): { timestamp: string; id: number } | null {
    try {
        const decoded = atob(cursor)
        const lastColon = decoded.lastIndexOf(':')
        if (lastColon === -1) return null

        const timestamp = decoded.slice(0, lastColon)
        const id = Number(decoded.slice(lastColon + 1))

        if (!timestamp || Number.isNaN(id)) return null
        return { timestamp, id }
    } catch {
        return null
    }
}

/**
 * Build WHERE clause + binds for cursor pagination.
 * @param cursor - decoded cursor object
 * @param tsColumn - the timestamp column name (e.g. 'created_at', 'sent_at')
 * @param direction - 'DESC' for newest-first (default), 'ASC' for oldest-first
 */
export function buildCursorWhere(
    cursor: { timestamp: string; id: number },
    tsColumn = 'created_at',
    direction: 'DESC' | 'ASC' = 'DESC',
): { clause: string; binds: (string | number)[] } {
    // For DESC: rows BEFORE the cursor (older)
    // For ASC: rows AFTER the cursor (newer)
    const op = direction === 'DESC' ? '<' : '>'

    return {
        clause: `(${tsColumn} ${op} ? OR (${tsColumn} = ? AND id ${op} ?))`,
        binds: [cursor.timestamp, cursor.timestamp, cursor.id],
    }
}
