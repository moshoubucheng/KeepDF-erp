export function downloadCsv(filename: string, csvContent: string) {
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function arrayToCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`
  const headerLine = headers.map(escape).join(',')
  const dataLines = rows.map(row => row.map(escape).join(','))
  return [headerLine, ...dataLines].join('\n')
}

export function downloadObjectsCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`
  const headerLine = headers.map(escape).join(',')
  const dataLines = rows.map(row => headers.map(h => escape(row[h])).join(','))
  downloadCsv(filename, [headerLine, ...dataLines].join('\n'))
}
