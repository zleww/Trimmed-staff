/** "1,250.50" or "₱1250" -> 125050 centavos. Empty -> 0. Anything else -> null. */
export function parsePeso(text: string): number | null {
  const clean = text.replace(/[₱,\s]/g, '')
  if (clean === '') return 0
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(clean)) return null
  return Math.round(Number(clean) * 100)
}
