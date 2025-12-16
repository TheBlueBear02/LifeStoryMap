import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

/**
 * MapContainer - A Mapbox GL JS map component that prevents unnecessary re-renders.
 * 
 * This component initializes the map once on mount and does not update React state
 * when the map is panned or zoomed, preventing WebGL context breaks and flickering.
 * 
 * The map instance is stored in a ref and only cleaned up on component unmount.
 */
function MapContainer() {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    // Early return if container ref is not available
    if (!containerRef.current) return

    // Early return if map already exists (prevent double initialization)
    if (mapRef.current) return

    // Get Mapbox token from environment variable
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) {
      // eslint-disable-next-line no-console
      console.error(
        'Mapbox token is not configured. Set VITE_MAPBOX_TOKEN in your .env file and restart the dev server.',
      )
      return undefined
    }

    // Set the access token
    mapboxgl.accessToken = token

    // Default map configuration
    const defaultStyle = 'mapbox://styles/mapbox/streets-v11'
    const defaultCenter = [0, 0] // [longitude, latitude]
    const defaultZoom = 2

    // Create the map instance - this happens only once
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: defaultStyle,
      center: defaultCenter,
      zoom: defaultZoom,
      attributionControl: true,
    })

    // Store the map instance in a ref (does not trigger re-render)
    mapRef.current = map

    // Optional: Handle window resize to keep map properly sized
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize()
      }
    }
    window.addEventListener('resize', handleResize)

    // Cleanup function - runs only on component unmount
    return () => {
      // Remove resize listener
      window.removeEventListener('resize', handleResize)

      // Remove all event listeners and destroy the map instance
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // Empty dependency array ensures this runs only once on mount

  // Render error message if token is missing
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          color: '#666',
          backgroundColor: '#f5f5f5',
        }}
      >
        <div>Mapbox token not configured. Set VITE_MAPBOX_TOKEN in .env file.</div>
      </div>
    )
  }

  // Return the container div - React will not re-render this unless props/state change
  // Since we don't have any props or state that change, this component will render once
  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

export default MapContainer
