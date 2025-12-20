import { useEffect } from 'react'
import { MAP_CONFIG } from '../constants/mapConfig.js'

/**
 * Hook for synchronizing map camera with external state
 * @param {Object} mapRef - Map instance ref
 * @param {Object} camera - Camera state from props
 * @param {Object} isSyncingFromPropsRef - Ref to track if syncing from props
 */
export function useMapCamera(mapRef, camera, isSyncingFromPropsRef) {
  useEffect(() => {
    const map = mapRef.current
    if (!map || !camera) return

    const center = camera.center || MAP_CONFIG.DEFAULT_CENTER
    const zoom = typeof camera.zoom === 'number' ? camera.zoom : map.getZoom()
    const pitch = MAP_CONFIG.DEFAULT_PITCH
    const bearing = MAP_CONFIG.DEFAULT_BEARING

    const currentCenter = map.getCenter()
    const hasCenterChanged =
      Math.abs(currentCenter.lng - center[0]) > 0.0001 ||
      Math.abs(currentCenter.lat - center[1]) > 0.0001
    const hasZoomChanged = Math.abs(map.getZoom() - zoom) > 0.01

    if (hasCenterChanged || hasZoomChanged || map.getPitch() !== 0 || map.getBearing() !== 0) {
      isSyncingFromPropsRef.current = true
      map.easeTo({
        center,
        zoom,
        pitch,
        bearing,
        duration: 800,
      })
      setTimeout(() => {
        isSyncingFromPropsRef.current = false
      }, 850)
    }
  }, [camera, mapRef, isSyncingFromPropsRef])
}

/**
 * Hook for handling map resize when route changes
 * @param {Object} mapRef - Map instance ref
 * @param {string} routeKey - Route key that changes when route/layout changes
 */
export function useMapResize(mapRef, routeKey) {
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const id = window.requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          map.resize()
        } catch {
          // ignore resize failures
        }
      }, 0)
    })

    return () => {
      window.cancelAnimationFrame(id)
    }
  }, [routeKey, mapRef])
}

