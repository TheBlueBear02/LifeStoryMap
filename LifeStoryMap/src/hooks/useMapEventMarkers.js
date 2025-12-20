import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { MARKER_COLORS } from '../constants/mapConfig.js'
import { coordKeyFromLngLat } from '../utils/mapUtils.js'

/**
 * Hook for managing event markers on the map
 * @param {Object} mapRef - Map instance ref
 * @param {Array} events - Array of event objects
 * @param {number|null} activeEventIndex - Index of active event
 */
export function useMapEventMarkers(mapRef, events, activeEventIndex) {
  const eventMarkersRef = useRef(new Map()) // Map of coordKey -> { marker, color }

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

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
        desiredMarkers.get(key).isActive = true
      }
    })

    // Remove markers for places that are no longer present
    eventMarkersRef.current.forEach((markerData, coordKey) => {
      if (!desiredMarkers.has(coordKey)) {
        markerData.marker.remove()
        eventMarkersRef.current.delete(coordKey)
      }
    })

    // Add or update a single marker per unique place (coordinate key)
    desiredMarkers.forEach((info, coordKey) => {
      const markerColor = info.isActive ? MARKER_COLORS.ACTIVE : MARKER_COLORS.INACTIVE

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

    // Cleanup on unmount
    return () => {
      eventMarkersRef.current.forEach((markerData) => {
        markerData.marker.remove()
      })
      eventMarkersRef.current.clear()
    }
  }, [events, activeEventIndex, mapRef])
}

