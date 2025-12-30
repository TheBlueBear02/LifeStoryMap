/**
 * Strips HTML tags and decodes HTML entities from text
 * @param {string} html - HTML string to process
 * @returns {string} Plain text with HTML removed and entities decoded
 */
export function stripHtml(html) {
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

/**
 * Parses HTML text into words with spans for highlighting
 * @param {string} htmlText - HTML text to parse
 * @returns {Array} Array of {word, isPunctuation} objects
 */
export function parseTextIntoWords(htmlText) {
  if (!htmlText) return []
  
  // First strip HTML to get plain text
  const plainText = stripHtml(htmlText)
  
  // Split into words and punctuation
  // This regex handles:
  // - Hebrew characters (\u0590-\u05FF)
  // - Arabic characters (\u0600-\u06FF)
  // - Cyrillic characters (\u0400-\u04FF)
  // - Chinese/Japanese/Korean characters (\u4E00-\u9FFF)
  // - English letters and numbers (\w)
  // - Punctuation and other characters
  const tokens = plainText.match(/[\u0590-\u05FF\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF\w]+|[^\s\w\u0590-\u05FF\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF]+/g) || []
  
  return tokens.map((token, index) => ({
    word: token,
    index,
    isPunctuation: /^[^\u0590-\u05FF\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF\w]+$/.test(token),
  }))
}

/**
 * Matches word timestamps to parsed words
 * @param {Array} words - Array of word objects from parseTextIntoWords
 * @param {Array} wordTimestamps - Array of {word, start, end} objects
 * @returns {Array} Array of word objects with timestamps added
 */
export function matchWordsWithTimestamps(words, wordTimestamps) {
  if (!wordTimestamps || wordTimestamps.length === 0) {
    return words.map(w => ({ ...w, start: null, end: null }))
  }
  
  // Simple index-based matching since both are generated from the same text
  // The word timestamps array should correspond to the words array by index
  const matchedWords = words.map((wordObj, index) => {
    const timestamp = index < wordTimestamps.length ? wordTimestamps[index] : null
    return {
      ...wordObj,
      start: timestamp ? timestamp.start : null,
      end: timestamp ? timestamp.end : null,
    }
  })
  
  return matchedWords
}

