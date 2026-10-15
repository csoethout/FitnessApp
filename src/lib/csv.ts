// CSV writing (RFC 4180), pure and unit tested. Used by the data export (Phase 6).

export type Cell = string | number | boolean | null | undefined | object

/** One cell: quoted when needed; objects/arrays as JSON; text that a spreadsheet would run as a formula is defused. */
export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  let s = typeof v === 'string' ? v : JSON.stringify(v)
  // Food names come from public databases: "=HYPERLINK(…)" must stay text in Excel/Sheets.
  if (/^[=+@\t\r]/.test(s) || (/^-/.test(s) && !/^-?\d+(\.\d+)?$/.test(s))) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** A whole file: header row, then one line per row (CRLF, as spreadsheets expect). */
export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** Raw table dump: columns = every key seen, in first-seen order. */
export function objectsToCsv(rows: Record<string, unknown>[]): string {
  const cols: string[] = []
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k)
  return toCsv(cols, rows.map((r) => cols.map((c) => r[c] as Cell)))
}
