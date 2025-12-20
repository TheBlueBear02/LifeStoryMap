/**
 * Normalizes a date string from YYYY-MM-DD format to DD.MM.YYYY format
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} - Normalized date string in DD.MM.YYYY format or empty string
 */
export function normalizeFormDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return ''

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const year = match[1]
    const month = match[2]
    const day = match[3]
    return `${day}.${month}.${year}`
  }

  // Fallback: try to parse other date-like strings and normalize to DD.MM.YYYY.
  const parsed = new Date(dateStr)
  if (!Number.isFinite(parsed.getTime())) return ''
  const iso = parsed.toISOString().slice(0, 10) // YYYY-MM-DD
  const isoMatch = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!isoMatch) return ''
  return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`
}

/**
 * Formats a date range from start and end dates
 * @param {string} dateStart - Start date string
 * @param {string} dateEnd - End date string
 * @returns {string} - Formatted date range string
 */
export function formatDateRange(dateStart, dateEnd) {
  const startText = normalizeFormDate(dateStart)
  const endText = normalizeFormDate(dateEnd)
  if (!startText) return ''
  if (!endText || endText === startText) return startText
  return `${startText} – ${endText}`
}

/**
 * Extracts year from a date string
 * @param {string} dateStr - Date string
 * @returns {string|null} - Year string or null
 */
export function extractYear(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const match = dateStr.match(/^(\d{4})/)
  return match ? match[1] : null
}

