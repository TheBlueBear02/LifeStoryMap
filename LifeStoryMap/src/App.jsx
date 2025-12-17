import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import './App.css'
import HomeView from './views/HomeView.jsx'
import EditStoryView from './views/EditStoryView.jsx'
import ViewStoryView from './views/ViewStoryView.jsx'
import MapView from './components/MapView.jsx'

function App() {
  const location = useLocation()
  const isEditMode = location.pathname.startsWith('/edit-story/') || location.pathname.startsWith('/create-story')
  const isViewMode = location.pathname.startsWith('/view-story/')
  const isStoryMode = isEditMode || isViewMode
  
  // Extract storyId from pathname
  const storyIdMatch = location.pathname.match(/\/(edit-story|view-story)\/([^/]+)/)
  const currentStoryId = storyIdMatch ? storyIdMatch[2] : (location.pathname === '/create-story' ? 'new' : null)
  
  const [mapCamera, setMapCamera] = useState({
    center: [34.7818, 32.0853], // Default center (Tel Aviv as a neutral starting point)
    zoom: 3,
    pitch: 0,
    bearing: 0,
  })

  const [markerLocation, setMarkerLocation] = useState(null)
  const [lastMapClick, setLastMapClick] = useState(null)
  const [isPickingLocation, setIsPickingLocation] = useState(false)
  const [events, setEvents] = useState([])
  const [expandedEventIndex, setExpandedEventIndex] = useState(null)

  // Reset marker location and picking state when switching stories or navigating away from edit mode
  useEffect(() => {
    if (!isStoryMode) {
      setIsPickingLocation(false)
      setMarkerLocation(null)
      setLastMapClick(null)
      setEvents([])
      setExpandedEventIndex(null)
    } else {
      // Reset marker when story changes (but keep it if we're just expanding/collapsing events)
      setMarkerLocation(null)
      setLastMapClick(null)
      setIsPickingLocation(false)
      setEvents([])
      setExpandedEventIndex(null)
    }
  }, [currentStoryId, isStoryMode])

  const handleMapClick = ({ lng, lat, camera }) => {
    // Only handle map clicks when picking location in edit mode
    if (!isPickingLocation || !isEditMode) return
    
    setLastMapClick({
      lng,
      lat,
      camera,
      timestamp: Date.now(),
    })
    setMarkerLocation({ lng, lat })
    if (camera) {
      setMapCamera(camera)
    }
  }

  const handleCameraChange = (camera) => {
    // Only update camera state if there's a meaningful change
    // This prevents unnecessary re-renders on every map movement
    if (!camera) return
    setMapCamera((prev) => {
      const newCenter = camera.center || prev.center
      const newZoom = typeof camera.zoom === 'number' ? camera.zoom : prev.zoom
      const newPitch = typeof camera.pitch === 'number' ? camera.pitch : prev.pitch
      const newBearing = typeof camera.bearing === 'number' ? camera.bearing : prev.bearing

      // Check if there's a meaningful change before updating state
      const centerChanged =
        Math.abs((prev.center[0] || 0) - (newCenter[0] || 0)) > 0.0001 ||
        Math.abs((prev.center[1] || 0) - (newCenter[1] || 0)) > 0.0001
      const zoomChanged = Math.abs((prev.zoom || 0) - (newZoom || 0)) > 0.01

      // Only update if there's a meaningful change
      if (!centerChanged && !zoomChanged && prev.pitch === newPitch && prev.bearing === newBearing) {
        return prev // Return same object to prevent re-render
      }

      return {
        center: newCenter,
        zoom: newZoom,
        pitch: newPitch,
        bearing: newBearing,
      }
    })
  }

  return (
    <div className="app-container">
      <div className="map-root">
        <MapView
          camera={mapCamera}
          markerLocation={isEditMode ? markerLocation : null}
          onMapClick={isEditMode ? handleMapClick : null}
          onCameraChange={handleCameraChange}
          events={isStoryMode ? events : []}
          activeEventIndex={isStoryMode ? expandedEventIndex : null}
        />
      </div>
      <div className="app-root">
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route
            path="/view-story/:storyId"
            element={(
              <ViewStoryView
                onEventsChange={setEvents}
                onActiveEventIndexChange={setExpandedEventIndex}
                onMapCameraChange={setMapCamera}
              />
            )}
          />
          <Route
            path="/edit-story/:storyId"
            element={(
              <EditStoryView
                mapCamera={mapCamera}
                markerLocation={markerLocation}
                onMarkerLocationChange={setMarkerLocation}
                onMapCameraChange={setMapCamera}
                lastMapClick={lastMapClick}
                onPickingLocationChange={setIsPickingLocation}
                onLastMapClickChange={setLastMapClick}
                onEventsChange={setEvents}
                onExpandedEventIndexChange={setExpandedEventIndex}
              />
            )}
          />
          <Route
            path="/create-story"
            element={(
              <EditStoryView
                mapCamera={mapCamera}
                markerLocation={markerLocation}
                onMarkerLocationChange={setMarkerLocation}
                onMapCameraChange={setMapCamera}
                lastMapClick={lastMapClick}
                onPickingLocationChange={setIsPickingLocation}
                onLastMapClickChange={setLastMapClick}
                onEventsChange={setEvents}
                onExpandedEventIndexChange={setExpandedEventIndex}
              />
            )}
          />
        </Routes>
      </div>
    </div>
  )
}

export default App
