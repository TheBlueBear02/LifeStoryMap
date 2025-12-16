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
  const eventMarkersRef = useRef(new Map()) // Map of event index -> { marker, color }
  const latestEventPathCoordsRef = useRef([]) // latest [[lng,lat], ...] for the path
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
      if (!map.getSource('event-path')) {
        // Add empty GeoJSON source for the path
        map.addSource('event-path', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        })

        // Add line layer
        map.addLayer({
          id: 'event-path',
          type: 'line',
          source: 'event-path',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#3b82f6', // Blue color for better visibility
            'line-width': 6, // Increased from 2 to 4
            'line-opacity': 0.8, // Increased from 0.6 to 0.8
          },
        })
      }
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
      if (map.getLayer('event-path')) {
        map.removeLayer('event-path')
      }
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

    // Build array of coordinates for events with valid locations
    const coordinates = []
    const currentEventIndices = new Set()
    
    events.forEach((event, index) => {
      const coords = event?.location?.coordinates
      if (coords && coords.lng != null && coords.lat != null) {
        coordinates.push([coords.lng, coords.lat])
        currentEventIndices.add(index)
      }
    })

    // Keep latest coordinates in a ref so style-load callbacks can use them.
    latestEventPathCoordsRef.current = coordinates

    const buildPathGeoJson = (coords) => ({
      type: 'FeatureCollection',
      features:
        coords.length >= 2
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: coords,
                },
              },
            ]
          : [],
    })

    const ensureEventPathLayer = () => {
      if (!map.getSource('event-path')) {
        map.addSource('event-path', {
          type: 'geojson',
          data: buildPathGeoJson(latestEventPathCoordsRef.current),
        })
      }

      if (!map.getLayer('event-path')) {
        map.addLayer({
          id: 'event-path',
          type: 'line',
          source: 'event-path',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 6,
            'line-opacity': 0.8,
          },
        })
      }
    }

    const updateEventPath = () => {
      ensureEventPathLayer()
      const source = map.getSource('event-path')
      if (source && typeof source.setData === 'function') {
        source.setData(buildPathGeoJson(latestEventPathCoordsRef.current))
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

    // Remove markers for events that no longer exist or don't have locations
    eventMarkersRef.current.forEach((markerData, index) => {
      if (!currentEventIndices.has(index)) {
        markerData.marker.remove()
        eventMarkersRef.current.delete(index)
      }
    })

    // Add or update markers for events with locations
    events.forEach((event, index) => {
      const coords = event?.location?.coordinates
      if (!coords || coords.lng == null || coords.lat == null) {
        return
      }

      const isActive = index === activeEventIndex
      const markerColor = isActive ? '#1d4ed8' : '#6b7280' // Blue for active, grey for others

      if (eventMarkersRef.current.has(index)) {
        // Update existing marker
        const markerData = eventMarkersRef.current.get(index)
        markerData.marker.setLngLat([coords.lng, coords.lat])
        // Update color if needed (remove and recreate with new color)
        if (markerData.color !== markerColor) {
          markerData.marker.remove()
          const newMarker = new mapboxgl.Marker({ color: markerColor })
            .setLngLat([coords.lng, coords.lat])
          newMarker.addTo(map)
          eventMarkersRef.current.set(index, { marker: newMarker, color: markerColor })
        }
      } else {
        // Create new marker
        const marker = new mapboxgl.Marker({ color: markerColor })
          .setLngLat([coords.lng, coords.lat])
        marker.addTo(map)
        eventMarkersRef.current.set(index, { marker, color: markerColor })
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

