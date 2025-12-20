import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAP_CONFIG } from '../constants/mapConfig.js'

/**
 * Hook for initializing and managing Mapbox map instance
 * @param {Object} options - Options object
 * @param {Object} options.initialCamera - Initial camera state
 * @param {Function} options.onMapClick - Callback for map clicks
 * @param {Function} options.onCameraChange - Callback for camera changes
 * @returns {Object} - { mapRef, containerRef, map }
 */
export function useMapboxMap({ initialCamera, onMapClick, onCameraChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const onMapClickRef = useRef(onMapClick)
  const onCameraChangeRef = useRef(onCameraChange)
  const isSyncingFromPropsRef = useRef(false)

  // Update callback refs
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

    const initialCenter = initialCamera?.center || MAP_CONFIG.DEFAULT_CENTER
    const initialZoom = typeof initialCamera?.zoom === 'number' ? initialCamera.zoom : MAP_CONFIG.DEFAULT_ZOOM

    const customStyle = import.meta.env.VITE_MAPBOX_STYLE
    const mapStyle = customStyle || MAP_CONFIG.DEFAULT_STYLE

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: initialCenter,
      zoom: initialZoom,
      pitch: MAP_CONFIG.DEFAULT_PITCH,
      bearing: MAP_CONFIG.DEFAULT_BEARING,
      projection: MAP_CONFIG.PROJECTION,
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
        timestamp: Date.now(),
      })
    }

    const handleMoveEnd = () => {
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

    // Prevent pitch and bearing changes to keep map flat
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
    }
  }, []) // Empty dependency array - map should only initialize once

  return {
    mapRef,
    containerRef,
    isSyncingFromPropsRef,
  }
}

