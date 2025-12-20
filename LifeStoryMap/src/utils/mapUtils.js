/**
 * Formats a coordinate number to a fixed precision string
 * @param {number} n - Coordinate number
 * @returns {string} - Formatted coordinate string
 */
export function formatCoordinate(n) {
  const num = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(num)) return ''
  // Round to reduce accidental duplicates from tiny float differences.
  return num.toFixed(6)
}

/**
 * Creates a coordinate key from longitude and latitude
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude
 * @returns {string} - Coordinate key string
 */
export function coordKeyFromLngLat(lng, lat) {
  return `${formatCoordinate(lng)},${formatCoordinate(lat)}`
}

/**
 * Creates a segment key from two coordinates (treats A->B and B->A as the same)
 * @param {Array<number>} a - First coordinate [lng, lat]
 * @param {Array<number>} b - Second coordinate [lng, lat]
 * @returns {string} - Segment key string
 */
export function segmentKey(a, b) {
  const ka = coordKeyFromLngLat(a?.[0], a?.[1])
  const kb = coordKeyFromLngLat(b?.[0], b?.[1])
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
}

/**
 * Calculates the distance between two coordinates in kilometers using Haversine formula
 * @param {Array<number>} from - Start coordinate [lng, lat]
 * @param {Array<number>} to - End coordinate [lng, lat]
 * @returns {number} - Distance in kilometers
 */
export function calculateDistanceKm(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const R = 6371 // Earth radius in km
  const dLat = toRad(to[1] - from[1])
  const dLng = toRad(to[0] - from[0])
  const lat1 = toRad(from[1])
  const lat2 = toRad(to[1])
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calculates bearing between two coordinates in degrees
 * @param {Array<number>} from - Start coordinate [lng, lat]
 * @param {Array<number>} to - End coordinate [lng, lat]
 * @returns {number} - Bearing in degrees
 */
export function calculateBearing(from, to) {
  const dLng = (to[0] - from[0]) * Math.PI / 180
  const lat1Rad = from[1] * Math.PI / 180
  const lat2Rad = to[1] * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2Rad)
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)
  return Math.atan2(y, x) * 180 / Math.PI
}

/**
 * Builds GeoJSON FeatureCollection from events for path rendering
 * @param {Array} events - Array of event objects
 * @returns {Object} - GeoJSON FeatureCollection
 */
export function buildPathGeoJsonFromEvents(events) {
  const nodes = []
  events.forEach((event) => {
    const coords = event?.location?.coordinates
    if (coords && coords.lng != null && coords.lat != null) {
      const styleKeyRaw = event?.transition?.lineStyleKey
      nodes.push({
        coord: [coords.lng, coords.lat],
        styleKey: typeof styleKeyRaw === 'string' ? styleKeyRaw : '',
      })
    }
  })

  const features = []
  const seenSegments = new Set()

  // Treat A->B and B->A as the same "between 2 places" segment.
  for (let i = 1; i < nodes.length; i += 1) {
    const prev = nodes[i - 1]
    const cur = nodes[i]

    // Skip zero-length and duplicate segments.
    const key = segmentKey(prev.coord, cur.coord)
    if (!key || coordKeyFromLngLat(prev.coord[0], prev.coord[1]) === coordKeyFromLngLat(cur.coord[0], cur.coord[1]) || seenSegments.has(key)) {
      continue
    }
    seenSegments.add(key)

    features.push({
      type: 'Feature',
      properties: {
        styleKey: cur.styleKey || '',
      },
      geometry: {
        type: 'LineString',
        coordinates: [prev.coord, cur.coord],
      },
    })
  }

  return {
    type: 'FeatureCollection',
    features,
  }
}

/**
 * Builds overview path GeoJSON (simplified, no style keys)
 * @param {Array} events - Array of event objects
 * @returns {Object} - GeoJSON FeatureCollection
 */
export function buildOverviewPathGeoJson(events) {
  const nodes = []
  events.forEach((event) => {
    const coords = event?.location?.coordinates
    if (coords && coords.lng != null && coords.lat != null) {
      nodes.push([coords.lng, coords.lat])
    }
  })

  const features = []
  for (let i = 1; i < nodes.length; i += 1) {
    const prev = nodes[i - 1]
    const cur = nodes[i]
    if (prev && cur && prev[0] === cur[0] && prev[1] === cur[1]) continue // Skip zero-length segments
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [prev, cur],
      },
    })
  }

  return {
    type: 'FeatureCollection',
    features,
  }
}

