/**
 * Mapbox service for geocoding operations
 */

/**
 * Searches for a location using Mapbox Geocoding API
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results (default: 1)
 * @returns {Promise<Object|null>} - First matching feature or null
 */
export async function searchLocation(query, limit = 1) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) {
    throw new Error('Mapbox token is not configured')
  }

  const trimmed = (query || '').trim()
  if (!trimmed) {
    return null
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      trimmed,
    )}.json?access_token=${token}&limit=${limit}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to search location')
    const data = await res.json()
    const feature = data.features && data.features[0]
    return feature || null
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Mapbox search failed:', err)
    throw err
  }
}

/**
 * Reverse geocodes coordinates to get location name
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude
 * @returns {Promise<string|null>} - Location name (city, country) or null
 */
export async function reverseGeocode(lng, lat) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) {
    return null
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to reverse geocode location')
    const data = await res.json()
    const feature = data.features && data.features[0]
    if (!feature) return null

    // Extract city and country from context
    const context = feature.context || []
    let city = null
    let country = null

    for (const item of context) {
      if (item.id && item.id.startsWith('place.')) {
        city = item.text
      } else if (item.id && item.id.startsWith('country.')) {
        country = item.text
      }
    }

    // If we found both city and country, return them formatted
    if (city && country) {
      return `${city}, ${country}`
    }
    // If only country found, return country
    if (country) {
      return country
    }
    // If only city found, return city
    if (city) {
      return city
    }
    // Fallback to place_name if context doesn't have the info
    return feature.place_name || null
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Reverse geocoding failed:', err)
    return null
  }
}

