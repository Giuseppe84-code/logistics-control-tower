// Lightweight CSV export — no dependencies. Quotes fields and triggers a download.

function escapeCell(value: unknown): string {
  const s = value == null ? '' : String(value)
  // Wrap in quotes if it contains a comma, quote, or newline; double up inner quotes.
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCSV<T>(rows: T[], columns: { key: keyof T | string; header: string; get?: (row: T) => unknown }[]): string {
  const head = columns.map(c => escapeCell(c.header)).join(',')
  const body = rows
    .map(row =>
      columns
        .map(c => escapeCell(c.get ? c.get(row) : (row as Record<string, unknown>)[c.key as string]))
        .join(','),
    )
    .join('\n')
  return `${head}\n${body}`
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
