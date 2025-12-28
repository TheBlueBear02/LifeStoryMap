/**
 * Strips HTML tags and decodes HTML entities from text
 * @param {string} html - HTML string to process
 * @returns {string} Plain text with HTML removed and entities decoded
 */
export const stripHtml = (html) => {
  if (!html) return ''
  // Decode common HTML entities
  let text = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
  // Strip HTML tags
  text = text.replace(/<[^>]*>/g, '')
  // Decode numeric entities (e.g., &#8217;)
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
  // Decode hex entities (e.g., &#x27;)
  text = text.replace(/&#x([a-f\d]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
  // Clean up whitespace
  return text.replace(/\s+/g, ' ').trim()
}

