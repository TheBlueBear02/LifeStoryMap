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
 */
function MapView({ camera, markerLocation, onMapClick, onCameraChange, events = [], activeEventIndex = null }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const eventMarkersRef = useRef(new Map()) // Map of coordKey -> { marker, color }
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
            'line-opacity': 0.8,
          },
        },
        {
          id: 'event-path-dashed',
          filter: ['==', 'styleKey', 'Dashed'],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 6,
            'line-opacity': 0.8,
            'line-dasharray': [2, 2],
          },
        },
        {
          id: 'event-path-dotted',
          filter: ['==', 'styleKey', 'Dotted'],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 6,
            'line-opacity': 0.8,
            'line-dasharray': [0.6, 1.6],
          },
        },
        {
          id: 'event-path-golden-age',
          filter: ['==', 'styleKey', 'GoldenAgePath'],
          paint: {
            'line-color': '#f59e0b',
            'line-width': 6,
            'line-opacity': 0.85,
            'line-dasharray': [2.5, 1.5],
          },
        },
        {
          id: 'event-path-memory-trail',
          filter: ['==', 'styleKey', 'MemoryTrail'],
          paint: {
            'line-color': '#a855f7',
            'line-width': 6,
            'line-opacity': 0.85,
            'line-dasharray': [0.6, 1.6],
          },
        },
        {
          id: 'event-path-important-jump',
          filter: ['==', 'styleKey', 'ImportantJump'],
          paint: {
            'line-color': '#ef4444',
            'line-width': 6,
            'line-opacity': 0.9,
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
      ].forEach((id) => {
        if (map.getLayer(id)) {
          map.removeLayer(id)
        }
      })
      if (map.getSource('event-path')) {
        map.removeSource('event-path')
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
            'line-opacity': 0.8,
          },
        },
        {
          id: 'event-path-dashed',
          filter: ['==', 'styleKey', 'Dashed'],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 6,
            'line-opacity': 0.8,
            'line-dasharray': [2, 2],
          },
        },
        {
          id: 'event-path-dotted',
          filter: ['==', 'styleKey', 'Dotted'],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 6,
            'line-opacity': 0.8,
            'line-dasharray': [0.6, 1.6],
          },
        },
        {
          id: 'event-path-golden-age',
          filter: ['==', 'styleKey', 'GoldenAgePath'],
          paint: {
            'line-color': '#f59e0b',
            'line-width': 6,
            'line-opacity': 0.85,
            'line-dasharray': [2.5, 1.5],
          },
        },
        {
          id: 'event-path-memory-trail',
          filter: ['==', 'styleKey', 'MemoryTrail'],
          paint: {
            'line-color': '#a855f7',
            'line-width': 6,
            'line-opacity': 0.85,
            'line-dasharray': [0.6, 1.6],
          },
        },
        {
          id: 'event-path-important-jump',
          filter: ['==', 'styleKey', 'ImportantJump'],
          paint: {
            'line-color': '#ef4444',
            'line-width': 6,
            'line-opacity': 0.9,
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
  }, [events, activeEventIndex])

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

