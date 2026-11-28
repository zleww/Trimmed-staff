// Turns rows into a CSV file and starts the download. Opens in Excel or Google Sheets.

type Column<T> = { header: string; value: (row: T) => string | number | boolean | null }

// A cell starting with = + - @ could run as a formula in a spreadsheet
// (a customer could type one into their name), so it gets a ' in front.
function cell(value: string | number | boolean | null): string {
  if (value === null) return ''
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(',')]
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(','))
  // the BOM makes Excel read ₱ and ñ correctly
  return '﻿' + lines.join('\r\n')
}

export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** centavos as a plain number of pesos for spreadsheets, like 350.00 */
export const pesos = (centavos: number) => (centavos / 100).toFixed(2)

const manila = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
/** "2026-11-28 14:30" in Manila time */
export const manilaStamp = (iso: string) => manila.format(new Date(iso)).replace(',', '')
