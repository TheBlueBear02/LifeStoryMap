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
 */
function MapView({ camera, markerLocation, onMapClick, onCameraChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
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

  // Keep marker in sync with markerLocation
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

