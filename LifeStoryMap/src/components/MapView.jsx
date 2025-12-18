import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

/**
 * Full-screen Mapbox map that sits behind the app sidebar.
 *
 * Props:
 * - camera: { center: [lng, lat], zoom, pitch, bearing }
 * - markerLocation: { lng, lat } | null
 * - onMapClick: ({ lng, lat, camera }) => void
 * - onCameraChange: (camera) => void
 * - events: Array of event objects with location.coordinates
 * - activeEventIndex: Index of the currently expanded/active event
 * - showStaticPath: whether to show the static path between all events
 */
function MapView({ camera, markerLocation, onMapClick, onCameraChange, events = [], activeEventIndex = null, showStaticPath = true }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const eventMarkersRef = useRef(new Map()) // Map of coordKey -> { marker, color }
  const prevActiveEventIndexRef = useRef(activeEventIndex)
  const transitionAnimationRef = useRef(null) // Stores current requestAnimationFrame id
  const latestEventPathGeoJsonRef = useRef({ type: 'FeatureCollection', features: [] }) // latest FeatureCollection for the path
  const isSyncingFromPropsRef = useRef(false) // Track if we're syncing from props to avoid feedback loop
  
  // Store callbacks in refs to avoid re-initializing the map when they change
  const onMapClickRef = useRef(onMapClick)
  const onCameraChangeRef = useRef(onCameraChange)
  
  // Update refs when callbacks change (without triggering re-initialization)
  useEffect(() => {
    onMapClickRef.current = onMapClick
    onCameraChangeRef.current = onCameraChange
  }, [onMapClick, onCameraChange])

  useEffect(() => {
    if (!containerRef.current) return
    
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) {
      // eslint-disable-next-line no-console
      console.error(
        'Mapbox token is not configured. Set VITE_MAPBOX_TOKEN in your .env file and restart the dev server.',
      )
      return undefined
    }

    if (mapRef.current) return undefined

    mapboxgl.accessToken = token

    const initialCenter = camera?.center || [0, 0]
    const initialZoom = typeof camera?.zoom === 'number' ? camera.zoom : 2
    const initialPitch = typeof camera?.pitch === 'number' ? camera.pitch : 0
    const initialBearing = typeof camera?.bearing === 'number' ? camera.bearing : 0

    // Use custom style from env var, or fall back to default
    const customStyle = import.meta.env.VITE_MAPBOX_STYLE
    const mapStyle = customStyle || 'mapbox://styles/mapbox/streets-v12'

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0, // Force flat view (no 3D tilt)
      bearing: 0, // Force north-up orientation
      projection: 'mercator', // Use flat mercator projection (Google Maps-like)
      attributionControl: true,
    })

    mapRef.current = map

    // Add event path source and layer after style loads
    const setupEventPath = () => {
      const sourceId = 'event-path'

      const ensureSource = () => {
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'geojson',
            data: latestEventPathGeoJsonRef.current,
          })
        }
      }

      const layers = [
        {
          id: 'event-path-solid',
          filter: ['!in', 'styleKey', 'Dashed', 'Dotted', 'GoldenAgePath', 'MemoryTrail', 'ImportantJump'],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 6,
            'line-opacity': showStaticPath ? 0.8 : 0.0,
          },
        },
        {
          id: 'event-path-dashed',
          filter: ['==', 'styleKey', 'Dashed'],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 6,
            'line-opacity': showStaticPath ? 0.8 : 0.0,
            'line-dasharray': [2, 2],
          },
        },
        {
          id: 'event-path-dotted',
          filter: ['==', 'styleKey', 'Dotted'],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 6,
            'line-opacity': showStaticPath ? 0.8 : 0.0,
            'line-dasharray': [0.6, 1.6],
          },
        },
        {
          id: 'event-path-golden-age',
          filter: ['==', 'styleKey', 'GoldenAgePath'],
          paint: {
            'line-color': '#f59e0b',
            'line-width': 6,
            'line-opacity': showStaticPath ? 0.85 : 0.0,
            'line-dasharray': [2.5, 1.5],
          },
        },
        {
          id: 'event-path-memory-trail',
          filter: ['==', 'styleKey', 'MemoryTrail'],
          paint: {
            'line-color': '#a855f7',
            'line-width': 6,
            'line-opacity': showStaticPath ? 0.85 : 0.0,
            'line-dasharray': [0.6, 1.6],
          },
        },
        {
          id: 'event-path-important-jump',
          filter: ['==', 'styleKey', 'ImportantJump'],
          paint: {
            'line-color': '#ef4444',
            'line-width': 6,
            'line-opacity': showStaticPath ? 0.9 : 0.0,
            'line-dasharray': [4, 2],
          },
        },
      ]

      ensureSource()

      layers.forEach((layer) => {
        if (map.getLayer(layer.id)) return
        map.addLayer({
          id: layer.id,
          type: 'line',
          source: sourceId,
          filter: layer.filter,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: layer.paint,
        })
      })
    }

    // Setup path when style loads
    if (map.isStyleLoaded()) {
      setupEventPath()
    } else {
      map.once('style.load', setupEventPath)
    }

    const handleClick = (e) => {
      if (!onMapClickRef.current) return
      const lng = e.lngLat.lng
      const lat = e.lngLat.lat

      const currentCamera = {
        center: [lng, lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      }

      onMapClickRef.current({
        lng,
        lat,
        camera: currentCamera,
      })
    }

    const handleMoveEnd = () => {
      // Don't trigger callback if we're currently syncing from props (avoids feedback loop)
      if (isSyncingFromPropsRef.current || !onCameraChangeRef.current) return
      const center = map.getCenter()
      onCameraChangeRef.current({
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      })
    }

    map.on('click', handleClick)
    map.on('moveend', handleMoveEnd)

    // Prevent pitch and bearing changes to keep map flat (Google Maps-like)
    const enforceFlatView = () => {
      if (map.getPitch() !== 0) {
        map.easeTo({ pitch: 0, duration: 0 })
      }
      if (map.getBearing() !== 0) {
        map.easeTo({ bearing: 0, duration: 0 })
      }
    }

    map.on('rotate', enforceFlatView)
    map.on('pitch', enforceFlatView)

    const handleResize = () => {
      map.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      map.off('click', handleClick)
      map.off('moveend', handleMoveEnd)
      map.off('rotate', enforceFlatView)
      map.off('pitch', enforceFlatView)
      // Clean up event path layer and source
      ;[
        'event-path-solid',
        'event-path-dashed',
        'event-path-dotted',
        'event-path-golden-age',
        'event-path-memory-trail',
        'event-path-important-jump',
        // legacy (older versions of the app)
        'event-path',
        'event-transition-line',
        'event-overview-path-dashed',
      ].forEach((id) => {
        if (map.getLayer(id)) {
          map.removeLayer(id)
        }
      })
      if (map.getSource('event-path')) {
        map.removeSource('event-path')
      }
      if (map.getSource('event-transition')) {
        map.removeSource('event-transition')
      }
      if (map.getSource('event-overview-path')) {
        map.removeSource('event-overview-path')
      }
      // Clean up all event markers
      eventMarkersRef.current.forEach((markerData) => {
        markerData.marker.remove()
      })
      eventMarkersRef.current.clear()
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, []) // Empty dependency array - map should only initialize once on mount

  // Keep camera in sync when props change (external flyTo)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !camera) return

    const center = camera.center || [0, 0]
    const zoom = typeof camera.zoom === 'number' ? camera.zoom : map.getZoom()
    // Force flat view - always keep pitch at 0 and bearing at 0 for Google Maps-like appearance
    const pitch = 0
    const bearing = 0

    const currentCenter = map.getCenter()
    const hasCenterChanged =
      Math.abs(currentCenter.lng - center[0]) > 0.0001 ||
      Math.abs(currentCenter.lat - center[1]) > 0.0001
    const hasZoomChanged = Math.abs(map.getZoom() - zoom) > 0.01

    // Only sync if there's a meaningful change and it's not from user interaction
    if (hasCenterChanged || hasZoomChanged || map.getPitch() !== 0 || map.getBearing() !== 0) {
      isSyncingFromPropsRef.current = true
      map.easeTo({
        center,
        zoom,
        pitch: 0, // Always keep flat
        bearing: 0, // Always keep north-up
        duration: 800,
      })
      // Reset flag after animation completes
      setTimeout(() => {
        isSyncingFromPropsRef.current = false
      }, 850)
    }
  }, [camera])

  // Keep marker in sync with markerLocation (for location picking)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!markerLocation || markerLocation.lng == null || markerLocation.lat == null) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }

    if (!markerRef.current) {
      markerRef.current = new mapboxgl.Marker({ color: '#1d4ed8' }).setLngLat([
        markerLocation.lng,
        markerLocation.lat,
      ])
      markerRef.current.addTo(map)
    } else {
      markerRef.current.setLngLat([markerLocation.lng, markerLocation.lat])
    }
  }, [markerLocation])

  // Update event markers (grey pins for all events, blue for active event) and path
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const buildPathGeoJsonFromEvents = (allEvents) => {
      const nodes = []
      allEvents.forEach((event) => {
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

      const fmt = (n) => {
        const num = typeof n === 'number' ? n : Number(n)
        if (!Number.isFinite(num)) return ''
        // Round to reduce accidental duplicates from tiny float differences.
        return num.toFixed(6)
      }

      const coordKey = (coord) => `${fmt(coord?.[0])},${fmt(coord?.[1])}`

      // Treat A->B and B->A as the same "between 2 places" segment.
      const segmentKey = (a, b) => {
        const ka = coordKey(a)
        const kb = coordKey(b)
        return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
      }

      for (let i = 1; i < nodes.length; i += 1) {
        const prev = nodes[i - 1]
        const cur = nodes[i]

        // Skip zero-length and duplicate segments.
        const key = segmentKey(prev.coord, cur.coord)
        if (!key || coordKey(prev.coord) === coordKey(cur.coord) || seenSegments.has(key)) {
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

    const geoJson = buildPathGeoJsonFromEvents(events)

    const fmt = (n) => {
      const num = typeof n === 'number' ? n : Number(n)
      if (!Number.isFinite(num)) return ''
      // Round to reduce accidental duplicates from tiny float differences.
      return num.toFixed(6)
    }

    const coordKeyFromLngLat = (lng, lat) => `${fmt(lng)},${fmt(lat)}`

    const desiredMarkers = new Map() // coordKey -> { lng, lat, isActive }

    events.forEach((event, index) => {
      const coords = event?.location?.coordinates
      if (!coords || coords.lng == null || coords.lat == null) return

      const key = coordKeyFromLngLat(coords.lng, coords.lat)
      if (!key || key.startsWith(',')) return

      const isActive = index === activeEventIndex
      if (!desiredMarkers.has(key)) {
        desiredMarkers.set(key, { lng: coords.lng, lat: coords.lat, isActive })
      } else if (isActive) {
        // If any event at this place is active, show the marker as active.
        desiredMarkers.get(key).isActive = true
      }
    })

    // Keep latest data in a ref so style-load callbacks can use it.
    latestEventPathGeoJsonRef.current = geoJson

    const ensureEventPathLayers = () => {
      if (!map.getSource('event-path')) {
        map.addSource('event-path', {
          type: 'geojson',
          data: latestEventPathGeoJsonRef.current,
        })
      }

      const layers = [
        {
          id: 'event-path-solid',
          filter: ['!in', 'styleKey', 'Dashed', 'Dotted', 'GoldenAgePath', 'MemoryTrail', 'ImportantJump'],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 6,
            'line-opacity': showStaticPath ? 0.8 : 0.0,
          },
        },
        {
          id: 'event-path-dashed',
          filter: ['==', 'styleKey', 'Dashed'],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 6,
            'line-opacity': showStaticPath ? 0.8 : 0.0,
            'line-dasharray': [2, 2],
          },
        },
        {
          id: 'event-path-dotted',
          filter: ['==', 'styleKey', 'Dotted'],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 6,
            'line-opacity': showStaticPath ? 0.8 : 0.0,
            'line-dasharray': [0.6, 1.6],
          },
        },
        {
          id: 'event-path-golden-age',
          filter: ['==', 'styleKey', 'GoldenAgePath'],
          paint: {
            'line-color': '#f59e0b',
            'line-width': 6,
            'line-opacity': showStaticPath ? 0.85 : 0.0,
            'line-dasharray': [2.5, 1.5],
          },
        },
        {
          id: 'event-path-memory-trail',
          filter: ['==', 'styleKey', 'MemoryTrail'],
          paint: {
            'line-color': '#a855f7',
            'line-width': 6,
            'line-opacity': showStaticPath ? 0.85 : 0.0,
            'line-dasharray': [0.6, 1.6],
          },
        },
        {
          id: 'event-path-important-jump',
          filter: ['==', 'styleKey', 'ImportantJump'],
          paint: {
            'line-color': '#ef4444',
            'line-width': 6,
            'line-opacity': showStaticPath ? 0.9 : 0.0,
            'line-dasharray': [4, 2],
          },
        },
      ]

      layers.forEach((layer) => {
        if (map.getLayer(layer.id)) return
        map.addLayer({
          id: layer.id,
          type: 'line',
          source: 'event-path',
          filter: layer.filter,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: layer.paint,
        })
      })
    }

    const updateEventPath = () => {
      ensureEventPathLayers()
      const source = map.getSource('event-path')
      if (source && typeof source.setData === 'function') {
        source.setData(latestEventPathGeoJsonRef.current)
        return true
      }
      return false
    }

    // Update the path now; if Mapbox isn't ready, retry on next idle.
    try {
      const updatedNow = updateEventPath()
      if (!updatedNow) {
        map.once('idle', () => {
          try {
            updateEventPath()
          } catch {
            // ignore
          }
        })
      }
    } catch {
      map.once('idle', () => {
        try {
          updateEventPath()
        } catch {
          // ignore
        }
      })
    }

    // Remove markers for places that are no longer present
    eventMarkersRef.current.forEach((markerData, coordKey) => {
      if (!desiredMarkers.has(coordKey)) {
        markerData.marker.remove()
        eventMarkersRef.current.delete(coordKey)
      }
    })

    // Add or update a single marker per unique place (coordinate key)
    desiredMarkers.forEach((info, coordKey) => {
      const markerColor = info.isActive ? '#1d4ed8' : '#6b7280' // Blue for active, grey otherwise

      if (eventMarkersRef.current.has(coordKey)) {
        const markerData = eventMarkersRef.current.get(coordKey)
        markerData.marker.setLngLat([info.lng, info.lat])

        if (markerData.color !== markerColor) {
          markerData.marker.remove()
          const newMarker = new mapboxgl.Marker({ color: markerColor }).setLngLat([info.lng, info.lat])
          newMarker.addTo(map)
          eventMarkersRef.current.set(coordKey, { marker: newMarker, color: markerColor })
        }
      } else {
        const marker = new mapboxgl.Marker({ color: markerColor }).setLngLat([info.lng, info.lat])
        marker.addTo(map)
        eventMarkersRef.current.set(coordKey, { marker, color: markerColor })
      }
    })

    // Grey dashed overview path: show all event connections when viewing first or last event.
    // Hide completely when events is empty (e.g., on homepage).
    const shouldShowOverviewPath = !showStaticPath && Array.isArray(events) && events.length > 0 && typeof activeEventIndex === 'number' && (activeEventIndex === 0 || activeEventIndex === events.length - 1)

    const buildOverviewPathGeoJson = (allEvents) => {
      const nodes = []
      allEvents.forEach((event) => {
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

    const ensureOverviewPathLayer = () => {
      if (!map.getSource('event-overview-path')) {
        map.addSource('event-overview-path', {
          type: 'geojson',
          data: buildOverviewPathGeoJson(events),
        })
      }

      if (!map.getLayer('event-overview-path-dashed')) {
        map.addLayer({
          id: 'event-overview-path-dashed',
          type: 'line',
          source: 'event-overview-path',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#e3e3e3', // Grey color
            'line-width': 4,
            'line-opacity': 0.6,
            'line-dasharray': [3, 3],
          },
        })
      }
    }

    const updateOverviewPath = () => {
      try {
        ensureOverviewPathLayer()
        const source = map.getSource('event-overview-path')
        if (source && typeof source.setData === 'function') {
          source.setData(buildOverviewPathGeoJson(events))
        }
      } catch {
        // ignore
      }
    }

    if (shouldShowOverviewPath) {
      try {
        updateOverviewPath()
        if (map.getLayer('event-overview-path-dashed')) {
          map.setLayoutProperty('event-overview-path-dashed', 'visibility', 'visible')
        }
      } catch {
        map.once('idle', () => {
          try {
            updateOverviewPath()
            if (map.getLayer('event-overview-path-dashed')) {
              map.setLayoutProperty('event-overview-path-dashed', 'visibility', 'visible')
            }
          } catch {
            // ignore
          }
        })
      }
    } else {
      if (map.getLayer('event-overview-path-dashed')) {
        try {
          map.setLayoutProperty('event-overview-path-dashed', 'visibility', 'none')
        } catch {
          // ignore
        }
      }
      // Clear overview path data when hidden (e.g., on homepage or middle events).
      const source = map.getSource('event-overview-path')
      if (source && typeof source.setData === 'function') {
        try {
          source.setData({ type: 'FeatureCollection', features: [] })
        } catch {
          // ignore
        }
      }
    }
  }, [events, activeEventIndex, showStaticPath])

  // Animate a line between the previous and current active event when the active index changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const allEvents = Array.isArray(events) ? events : []
    
    // Clear transition line when events is empty (e.g., on homepage).
    if (allEvents.length === 0) {
      const source = map.getSource('event-transition')
      if (source && typeof source.setData === 'function') {
        try {
          source.setData({ type: 'FeatureCollection', features: [] })
        } catch {
          // ignore
        }
      }
      prevActiveEventIndexRef.current = null
      return
    }

    const currentIndex = typeof activeEventIndex === 'number' ? activeEventIndex : null
    const prevIndex = typeof prevActiveEventIndexRef.current === 'number' ? prevActiveEventIndexRef.current : null

    // Nothing to animate on first selection or if index didn't really change.
    if (currentIndex == null || prevIndex == null || currentIndex === prevIndex) {
      prevActiveEventIndexRef.current = currentIndex
      return
    }
    const fromEvent = allEvents[prevIndex]
    const toEvent = allEvents[currentIndex]

    const fromCoords = fromEvent?.location?.coordinates
    const toCoords = toEvent?.location?.coordinates

    if (
      !fromCoords ||
      !toCoords ||
      fromCoords.lng == null ||
      fromCoords.lat == null ||
      toCoords.lng == null ||
      toCoords.lat == null
    ) {
      prevActiveEventIndexRef.current = currentIndex
      return
    }

    // Cancel any running animation before starting a new one.
    if (transitionAnimationRef.current != null) {
      cancelAnimationFrame(transitionAnimationRef.current)
      transitionAnimationRef.current = null
    }

    const from = [fromCoords.lng, fromCoords.lat]
    const to = [toCoords.lng, toCoords.lat]

    // Compute duration based on geographical distance between the two points (in km).
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
    const distanceKm = R * c

    // Map distance to duration: short hops are quick (but at least 4s), long jumps are slower.
    // Clamp final duration strictly to the 4–13s range.
    const secondsFromDistance = 4 + Math.min(9, (distanceKm / 3000) * 9) // base 4s, up to 13s for very long jumps
    const durationMs = Math.max(4000, Math.min(13000, secondsFromDistance * 1000))

    // Camera zoom interpolation: start closer, zoom out (higher "altitude") in the middle,
    // then zoom back in to the target at the end of the path.
    const currentZoom = map.getZoom()
    const fromZoomRaw = fromEvent?.location?.mapView?.zoom
    const toZoomRaw = toEvent?.location?.mapView?.zoom
    const startZoom = typeof fromZoomRaw === 'number' ? fromZoomRaw : currentZoom
    const targetZoom = typeof toZoomRaw === 'number' ? toZoomRaw : startZoom

    // Choose a "max height" zoom for the arc in the middle of the segment,
    // based on distance:
    // - very close points -> tiny zoom-out
    // - medium distance   -> moderate zoom-out
    // - very far points   -> strong zoom-out
    const baseMin = Math.min(startZoom, targetZoom)
    let extraZoomOut
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      extraZoomOut = 0.3
    } else if (distanceKm <= 50) {
      // 0–50km: from ~0.3 to ~1 zoom level farther out
      const f = distanceKm / 50 // 0..1
      extraZoomOut = 0.3 + f * 0.7
    } else {
      // >50km: start at 1 level out, then ramp up to +10 for very long jumps (~4000km+)
      const distanceFactor = Math.min(1, (distanceKm - 50) / 3950) // 0..1
      extraZoomOut = 1 + distanceFactor * 9
    }
    const midZoom = Math.max(0.5, baseMin - extraZoomOut)

    // During this manual animation, suppress automatic camera sync callbacks,
    // and notify the outer app once at the end instead.
    isSyncingFromPropsRef.current = true

    // Ensure a dedicated source + layer for the animated transition line.
    const ensureTransitionLayer = () => {
      if (!map.getSource('event-transition')) {
        map.addSource('event-transition', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        })
      }

      if (!map.getLayer('event-transition-line')) {
        map.addLayer({
          id: 'event-transition-line',
          type: 'line',
          source: 'event-transition',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            // Slightly brighter than the static path so the animation stands out.
            'line-color': '#2563eb',
            'line-width': 6,
            'line-opacity': 0.95,
          },
        })
      }
    }

    try {
      ensureTransitionLayer()
    } catch {
      prevActiveEventIndexRef.current = currentIndex
      return
    }

    const source = map.getSource('event-transition')
    if (!source || typeof source.setData !== 'function') {
      prevActiveEventIndexRef.current = currentIndex
      return
    }

    const startTime = performance.now()

    const animate = (now) => {
      const elapsed = now - startTime
      const tRaw = elapsed / durationMs
      const t = tRaw >= 1 ? 1 : tRaw

      // Three distinct phases:
      // 1) Zoom out while staying on the starting point.
      // 2) Move along the path at max height (midZoom).
      // 3) After arriving, zoom in while staying on the target point.
      const tZoomOutEnd = 0.25
      const tMoveEnd = 0.75

      let lng
      let lat
      let zoom

      if (t <= tZoomOutEnd) {
        // Phase 1: stay at the starting point, only change zoom.
        lng = from[0]
        lat = from[1]
        const tt = tZoomOutEnd === 0 ? 1 : t / tZoomOutEnd
        zoom = startZoom + (midZoom - startZoom) * tt
      } else if (t <= tMoveEnd) {
        // Phase 2: travel along the path at constant midZoom.
        const travelT = (t - tZoomOutEnd) / (tMoveEnd - tZoomOutEnd) // 0..1
        lng = from[0] + (to[0] - from[0]) * travelT
        lat = from[1] + (to[1] - from[1]) * travelT
        zoom = midZoom
      } else {
        // Phase 3: arrived at target, only zoom in.
        lng = to[0]
        lat = to[1]
        const tt = tMoveEnd === 1 ? 1 : (t - tMoveEnd) / (1 - tMoveEnd)
        zoom = midZoom + (targetZoom - midZoom) * tt
      }

      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [from, [lng, lat]],
            },
          },
        ],
      }

      try {
        source.setData(geojson)
      } catch {
        // If Mapbox blows up (e.g. style reloaded), stop animating.
        transitionAnimationRef.current = null
        isSyncingFromPropsRef.current = false
        return
      }

      // Move the camera along the same line with the same timing.
      try {
        map.jumpTo({
          center: [lng, lat],
          zoom,
          pitch: 0,
          bearing: 0,
        })
      } catch {
        // Ignore camera errors, but still try to finish the animation.
      }

      if (t < 1) {
        transitionAnimationRef.current = requestAnimationFrame(animate)
      } else {
        // Make sure the final frame reaches the target point exactly.
        try {
          source.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: [from, to],
                },
              },
            ],
          })
          map.jumpTo({
            center: to,
            zoom: targetZoom,
            pitch: 0,
            bearing: 0,
          })
          // Inform the outer app of the final camera state once.
          if (onCameraChangeRef.current) {
            onCameraChangeRef.current({
              center: to,
              zoom: targetZoom,
              pitch: 0,
              bearing: 0,
            })
          }
        } catch {
          // ignore
        }
        transitionAnimationRef.current = null
        isSyncingFromPropsRef.current = false
      }
    }

    transitionAnimationRef.current = requestAnimationFrame(animate)
    prevActiveEventIndexRef.current = currentIndex

    // Cleanup when dependencies change: handled by cancelling on next run / unmount.
    return () => {
      if (transitionAnimationRef.current != null) {
        cancelAnimationFrame(transitionAnimationRef.current)
        transitionAnimationRef.current = null
      }
      isSyncingFromPropsRef.current = false
    }
  }, [activeEventIndex, events])

  // Keep the static path visibility in sync with the current mode (edit vs view).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const layerConfigs = [
      { id: 'event-path-solid', visibleOpacity: 0.8 },
      { id: 'event-path-dashed', visibleOpacity: 0.8 },
      { id: 'event-path-dotted', visibleOpacity: 0.8 },
      { id: 'event-path-golden-age', visibleOpacity: 0.85 },
      { id: 'event-path-memory-trail', visibleOpacity: 0.85 },
      { id: 'event-path-important-jump', visibleOpacity: 0.9 },
    ]

    layerConfigs.forEach(({ id, visibleOpacity }) => {
      if (!map.getLayer(id)) return
      try {
        map.setPaintProperty(id, 'line-opacity', showStaticPath ? visibleOpacity : 0.0)
      } catch {
        // ignore paint update errors
      }
    })
  }, [showStaticPath])

  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) {
    return (
      <div className="mapbox-map-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        <div>Mapbox token not configured. Set VITE_MAPBOX_TOKEN in .env file.</div>
      </div>
    )
  }

  return <div ref={containerRef} className="mapbox-map-root" />
}

export default MapView

