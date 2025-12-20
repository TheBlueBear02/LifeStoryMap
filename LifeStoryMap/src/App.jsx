import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import './App.css'
import HomeView from './views/HomeView.jsx'
import EditStoryView from './views/EditStoryView.jsx'
import ViewStoryView from './views/ViewStoryView.jsx'
import MapView from './components/MapView.jsx'
import { get } from './services/api.js'
import { API_PATHS } from './constants/paths.js'

function App() {
  const location = useLocation()
  const isEditMode = location.pathname.startsWith('/edit-story/') || location.pathname.startsWith('/create-story')
  const isViewMode = location.pathname.startsWith('/view-story/')
  const isStoryMode = isEditMode || isViewMode
  const isHome = location.pathname === '/'
  
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
  const [homeMapOverlay, setHomeMapOverlay] = useState(null)

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

  // Home page: show all example stories together on the map (markers + per-story paths).
  useEffect(() => {
    let cancelled = false

    const isValidLngLat = (coords) =>
      coords && typeof coords.lng === 'number' && typeof coords.lat === 'number' && Number.isFinite(coords.lng) && Number.isFinite(coords.lat)

    const dedupeConsecutive = (coordsList) => {
      const out = []
      for (let i = 0; i < coordsList.length; i += 1) {
        const cur = coordsList[i]
        const prev = out[out.length - 1]
        if (!prev || prev[0] !== cur[0] || prev[1] !== cur[1]) out.push(cur)
      }
      return out
    }

    const loadHomeOverlay = async () => {
      if (!isHome) {
        setHomeMapOverlay(null)
        return
      }

      try {
        const stories = await get(API_PATHS.EXAMPLE_STORIES)
        if (cancelled) return

        const exampleStories = Array.isArray(stories) ? stories : []
        if (exampleStories.length === 0) {
          setHomeMapOverlay(null)
          return
        }

        const palette = ['#2563eb', '#f59e0b', '#a855f7', '#10b981', '#ef4444', '#06b6d4']
        const storyColorById = new Map(
          exampleStories.map((s, idx) => [s.id, palette[idx % palette.length]]),
        )

        const eventsByStory = await Promise.all(
          exampleStories.map(async (story) => {
            try {
              const ev = await get(API_PATHS.EXAMPLE_STORY_EVENTS(story.id))
              return { story, events: Array.isArray(ev) ? ev : [] }
            } catch {
              return { story, events: [] }
            }
          }),
        )
        if (cancelled) return

        const lineFeatures = []
        const pointFeatures = []

        eventsByStory.forEach(({ story, events: storyEvents }) => {
          const color = storyColorById.get(story.id) || '#2563eb'
          const storyName = typeof story?.name === 'string' ? story.name : story.id

          const validEventCoords = (Array.isArray(storyEvents) ? storyEvents : [])
            .filter((ev) => ev?.eventType !== 'Opening' && ev?.eventType !== 'Closing')
            .map((ev) => {
              const coords = ev?.location?.coordinates
              if (!isValidLngLat(coords)) return null
              return { ev, lngLat: [coords.lng, coords.lat] }
            })
            .filter(Boolean)

          validEventCoords.forEach(({ ev, lngLat }) => {
            pointFeatures.push({
              type: 'Feature',
              properties: {
                storyId: story.id,
                storyName,
                eventId: ev?.eventId || '',
                title: ev?.title || '',
                color,
              },
              geometry: {
                type: 'Point',
                coordinates: lngLat,
              },
            })
          })

          const lineCoords = dedupeConsecutive(validEventCoords.map((x) => x.lngLat))
          if (lineCoords.length >= 2) {
            lineFeatures.push({
              type: 'Feature',
              properties: {
                storyId: story.id,
                storyName,
                color,
              },
              geometry: {
                type: 'LineString',
                coordinates: lineCoords,
              },
            })
          }
        })

        const overlay = {
          key: `home:${exampleStories.length}:${pointFeatures.length}:${lineFeatures.length}`,
          points: { type: 'FeatureCollection', features: pointFeatures },
          lines: { type: 'FeatureCollection', features: lineFeatures },
        }

        setHomeMapOverlay(overlay)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err)
        if (!cancelled) setHomeMapOverlay(null)
      }
    }

    loadHomeOverlay()
    return () => {
      cancelled = true
    }
  }, [isHome])

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
    <div className={`app-container ${isViewMode ? 'view-story-mode' : ''}`}>
      <div className="map-root">
        <MapView
          camera={mapCamera}
          markerLocation={isEditMode ? markerLocation : null}
          onMapClick={isEditMode ? handleMapClick : null}
          onCameraChange={handleCameraChange}
          events={isStoryMode ? events : []}
          activeEventIndex={isStoryMode ? expandedEventIndex : null}
          showStaticPath={isEditMode}
          routeKey={location.pathname}
          homeOverlay={isHome ? homeMapOverlay : null}
        />
      </div>
      <div className={`app-root ${isViewMode ? 'view-story-mode' : ''}`}>
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
