/**
 * Gets the main media URLs from an event object
 * @param {Object} event - Event object
 * @returns {Object} - Object with oldUrl, newUrl, and caption
 */
export function getMainMedia(event) {
  const cmp = event?.content?.imageComparison
  const oldUrl = typeof cmp?.urlOld === 'string' ? cmp.urlOld : ''
  const newUrl = typeof cmp?.urlNew === 'string' ? cmp.urlNew : ''
  const caption = typeof cmp?.caption === 'string' ? cmp.caption : ''

  let mediaUrl = ''
  const media = event?.content?.media
  if (Array.isArray(media)) {
    const firstImage = media.find((m) => m && m.type === 'image' && typeof m.url === 'string' && m.url)
    mediaUrl = firstImage?.url || ''
  }

  return {
    oldUrl: oldUrl || mediaUrl,
    newUrl,
    caption,
  }
}

/**
 * Converts a file to base64 string
 * @param {File} file - File object
 * @returns {Promise<string>} - Base64 string (without data URL prefix)
 */
export async function fileToBase64(file) {
  const reader = new FileReader()
  return new Promise((resolve, reject) => {
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        const commaIndex = result.indexOf(',')
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
      } else {
        reject(new Error('Unexpected file reader result'))
      }
    }
    reader.readAsDataURL(file)
  })
}

