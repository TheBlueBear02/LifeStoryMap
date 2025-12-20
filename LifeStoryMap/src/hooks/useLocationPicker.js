import { useState, useEffect, useRef } from 'react'
import { reverseGeocode, searchLocation } from '../services/mapboxService.js'

/**
 * Hook for managing location picking and searching
 * @param {Object} options - Options object
 * @param {Function} options.onLocationUpdate - Callback when location is updated
 * @param {Function} options.onMarkerChange - Callback when marker location changes
 * @param {Function} options.onCameraChange - Callback when camera changes
 * @param {Object} options.mapCamera - Current map camera state
 * @returns {Object} - Location picking state and handlers
 */
export function useLocationPicker({
  onLocationUpdate,
  onMarkerChange,
  onCameraChange,
  mapCamera,
}) {
  const [isPickingLocation, setIsPickingLocation] = useState(false)
  const [activeEventIndex, setActiveEventIndex] = useState(null)
  const [pickingStartTime, setPickingStartTime] = useState(null)
  const markerBeforePickingRef = useRef(null)

  /**
   * Begins location picking for an event
   * @param {number} index - Event index
   * @param {Object} currentMarkerLocation - Current marker location
   */
  const beginPickLocation = (index, currentMarkerLocation) => {
    // Toggle off if the user clicks the same button again
    if (isPickingLocation && activeEventIndex === index) {
      setIsPickingLocation(false)
      setActiveEventIndex(null)
      setPickingStartTime(null)
      if (onMarkerChange) {
        onMarkerChange(markerBeforePickingRef.current ?? null)
      }
      markerBeforePickingRef.current = null
      return
    }

    setActiveEventIndex(index)
    const startTime = Date.now()
    setPickingStartTime(startTime)
    setIsPickingLocation(true)
    markerBeforePickingRef.current = currentMarkerLocation ?? null
    if (onMarkerChange) {
      onMarkerChange(null)
    }
  }

  /**
   * Processes a map click when picking location
   * @param {Object} mapClick - Map click data { lng, lat, camera, timestamp }
   * @param {Function} updateEventField - Function to update event field
   */
  const processMapClick = (mapClick, updateEventField) => {
    if (!isPickingLocation) return
    if (activeEventIndex == null) return
    if (!mapClick) return
    if (pickingStartTime == null || mapClick.timestamp < pickingStartTime) return

    const { lng, lat, camera } = mapClick
    if (lng == null || lat == null) return

    const eventIndex = activeEventIndex

    // Update coordinates and map view immediately
    updateEventField(eventIndex, ['location', 'coordinates', 'lat'], lat)
    updateEventField(eventIndex, ['location', 'coordinates', 'lng'], lng)

    updateEventField(eventIndex, ['location', 'mapView'], {
      zoom: typeof camera?.zoom === 'number' ? camera.zoom : (mapCamera?.zoom ?? 10),
      pitch: typeof camera?.pitch === 'number' ? camera.pitch : (mapCamera?.pitch ?? 0),
      bearing: typeof camera?.bearing === 'number' ? camera.bearing : (mapCamera?.bearing ?? 0),
      mapStyle: 'mapbox://styles/mapbox/streets-v12',
    })

    // Reverse geocode to get location name
    reverseGeocode(lng, lat).then((locationName) => {
      if (locationName) {
        updateEventField(eventIndex, ['location', 'name'], locationName)
      }
    })

    if (onMarkerChange) {
      onMarkerChange({ lng, lat })
    }
    if (onCameraChange && camera) {
      onCameraChange(camera)
    }

    // Reset picking state
    setIsPickingLocation(false)
    setActiveEventIndex(null)
    setPickingStartTime(null)
  }

  /**
   * Searches for a location and updates the event
   * @param {number} index - Event index
   * @param {string} query - Search query
   * @param {Function} updateEventField - Function to update event field
   */
  const searchLocationForEvent = async (index, query, updateEventField) => {
    try {
      const feature = await searchLocation(query, 1)
      if (!feature || !Array.isArray(feature.center)) {
        window.alert('No matching place found on the map.')
        return
      }

      const [lng, lat] = feature.center
      const normalizedName = feature.place_name || query.trim()

      updateEventField(index, ['location', 'name'], normalizedName)
      updateEventField(index, ['location', 'coordinates', 'lat'], lat)
      updateEventField(index, ['location', 'coordinates', 'lng'], lng)
      updateEventField(index, ['location', 'mapView'], {
        zoom: 12,
        pitch: 0,
        bearing: 0,
        mapStyle: 'mapbox://styles/mapbox/streets-v12',
      })

      if (onMarkerChange) {
        onMarkerChange({ lng, lat })
      }
      if (onCameraChange) {
        onCameraChange({
          center: [lng, lat],
          zoom: 12,
          pitch: 0,
          bearing: 0,
        })
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err)
      window.alert('Failed to search for this place on the map.')
    }
  }

  return {
    isPickingLocation,
    activeEventIndex,
    beginPickLocation,
    processMapClick,
    searchLocationForEvent,
  }
}

