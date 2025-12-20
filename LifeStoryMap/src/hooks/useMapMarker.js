import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { MARKER_COLORS } from '../constants/mapConfig.js'

/**
 * Hook for managing a single location picker marker
 * @param {Object} mapRef - Map instance ref
 * @param {Object} markerLocation - Marker location { lng, lat } | null
 */
export function useMapMarker(mapRef, markerLocation) {
  const markerRef = useRef(null)

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
      markerRef.current = new mapboxgl.Marker({ color: MARKER_COLORS.PICKING }).setLngLat([
        markerLocation.lng,
        markerLocation.lat,
      ])
      markerRef.current.addTo(map)
    } else {
      markerRef.current.setLngLat([markerLocation.lng, markerLocation.lat])
    }
  }, [markerLocation, mapRef])
}

