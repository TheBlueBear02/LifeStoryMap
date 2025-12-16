import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EventBlock from '../components/EventBlock.jsx'
import { createEmptyEvent, generateNextEventId } from '../utils/events.js'

function EditStoryView({
  mapCamera,
  markerLocation,
  onMarkerLocationChange,
  onMapCameraChange,
  lastMapClick,
  onPickingLocationChange,
}) {
  const navigate = useNavigate()
  const { storyId } = useParams()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [story, setStory] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [expandedIndexes, setExpandedIndexes] = useState(new Set())
  const [isDirty, setIsDirty] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState(null)
  const [activeEventIndex, setActiveEventIndex] = useState(null)
  const [isPickingLocation, setIsPickingLocation] = useState(false)

  const uploadImageFile = async (file) => {
    const reader = new FileReader()
    const asBase64 = await new Promise((resolve, reject) => {
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
      reader.onload = () => {
        const result = reader.result
        if (typeof result === 'string') {
          const commaIndex = result.indexOf(',')
          resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
        } else {
          reject(new Error('Unexpected file reader result'))
        }
      }
      reader.readAsDataURL(file)
    })

    const res = await fetch('/api/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.name,
        data: asBase64,
      }),
    })

    if (!res.ok) {
      throw new Error('Failed to upload image')
    }
    const json = await res.json()
    return json.url
  }

  const handleUploadMainImage = async (index, file) => {
    try {
      const url = await uploadImageFile(file)
      setEvents((prev) =>
        prev.map((event, i) => {
          if (i !== index) return event
          const clone = structuredClone ? structuredClone(event) : JSON.parse(JSON.stringify(event))
          if (!clone.content || typeof clone.content !== 'object') clone.content = {}
          if (!Array.isArray(clone.content.media)) clone.content.media = []
          const imgIndex = clone.content.media.findIndex((m) => m && m.type === 'image')
          const nextItem = {
            ...(imgIndex >= 0 ? clone.content.media[imgIndex] : {}),
            type: 'image',
            url,
          }
          if (imgIndex >= 0) clone.content.media[imgIndex] = nextItem
          else clone.content.media.push(nextItem)
          return clone
        }),
      )
      setIsDirty(true)
    } catch (err) {
      console.error(err)
      window.alert('Failed to upload image')
    }
  }

  const handleUploadComparisonImage = async (index, which, file) => {
    try {
      const url = await uploadImageFile(file)
      setEvents((prev) =>
        prev.map((event, i) => {
          if (i !== index) return event
          const clone = structuredClone ? structuredClone(event) : JSON.parse(JSON.stringify(event))
          if (!clone.content || typeof clone.content !== 'object') clone.content = {}
          if (!clone.content.imageComparison || typeof clone.content.imageComparison !== 'object') {
            clone.content.imageComparison = { enabled: true, caption: '', urlOld: '', urlNew: '' }
          }
          if (which === 'old') clone.content.imageComparison.urlOld = url
          else if (which === 'new') clone.content.imageComparison.urlNew = url
          return clone
        }),
      )
      setIsDirty(true)
    } catch (err) {
      console.error(err)
      window.alert('Failed to upload comparison image')
    }
  }

  useEffect(() => {
    const loadStoryAndEvents = async () => {
      if (!storyId) {
        navigate('/')
        return
      }

      try {
        const storyRes = await fetch(`/api/stories/${storyId}`)
        if (!storyRes.ok) throw new Error('Failed to load story')
        const storyData = await storyRes.json()
        setStory(storyData)

        const eventsRes = await fetch(`/api/stories/${storyId}/events`)
        if (!eventsRes.ok) throw new Error('Failed to load events')
        const eventsData = await eventsRes.json()
        const initialEvents = Array.isArray(eventsData) ? eventsData : []
        setEvents(initialEvents)
        setIsDirty(false)
      } catch (err) {
        console.error(err)
        setEvents([])
      } finally {
        setLoading(false)
      }
    }

    loadStoryAndEvents()
  }, [storyId, navigate])

  const toggleExpand = (index) => {
    setExpandedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
        // When expanding an event, optionally sync map view to its saved location
        const ev = events[index]
        const coords = ev?.location?.coordinates
        if (
          ev &&
          coords &&
          coords.lng != null &&
          coords.lat != null &&
          onMarkerLocationChange &&
          onMapCameraChange
        ) {
          onMarkerLocationChange({ lng: coords.lng, lat: coords.lat })
          const view = ev.location.mapView || {}
          onMapCameraChange({
            center: [coords.lng, coords.lat],
            zoom: typeof view.zoom === 'number' ? view.zoom : (mapCamera?.zoom ?? 10),
            pitch: typeof view.pitch === 'number' ? view.pitch : (mapCamera?.pitch ?? 0),
            bearing:
              typeof view.bearing === 'number' ? view.bearing : (mapCamera?.bearing ?? 0),
          })
        }
      }
      return next
    })
  }

  const updateEventField = (index, path, value) => {
    setEvents((prev) =>
      prev.map((event, i) => {
        if (i !== index) return event

        const clone = structuredClone ? structuredClone(event) : JSON.parse(JSON.stringify(event))
        let cursor = clone
        for (let p = 0; p < path.length - 1; p += 1) {
          const key = path[p]
          if (cursor[key] == null || typeof cursor[key] !== 'object') {
            cursor[key] = {}
          }
          cursor = cursor[key]
        }
        cursor[path[path.length - 1]] = value

        if (
          path.length === 2 &&
          path[0] === 'timeline' &&
          path[1] === 'dateStart' &&
          (clone.eventType === 'Event' || !clone.eventType)
        ) {
          if (!clone.timeline || typeof clone.timeline !== 'object') {
            clone.timeline = {}
          }
          clone.timeline.dateEnd = value
        }

        if (path.length === 1 && path[0] === 'eventType' && value === 'Event') {
          if (!clone.timeline || typeof clone.timeline !== 'object') {
            clone.timeline = {}
          }
          if (clone.timeline.dateStart) {
            clone.timeline.dateEnd = clone.timeline.dateStart
          }
        }

        return clone
      }),
    )
    setIsDirty(true)
  }

  const insertEventAt = (insertIndex) => {
    setEvents((prev) => {
      if (prev.length === 0) {
        return [createEmptyEvent(null)]
      }

      const previous = prev[insertIndex] || prev[prev.length - 1]
      const previousEventId = previous?.eventId || null
      const newEventId = generateNextEventId(prev)
      const newEvent = {
        ...createEmptyEvent(previousEventId),
        eventId: newEventId,
        transition: {
          ...createEmptyEvent(previousEventId).transition,
          sourceEventId: previousEventId,
        },
      }

      const nextEvents = [...prev]
      nextEvents.splice(insertIndex + 1, 0, newEvent)

      const nextIndex = insertIndex + 2
      if (nextIndex < nextEvents.length) {
        const nextEvent = { ...nextEvents[nextIndex] }
        nextEvent.transition = {
          ...(nextEvent.transition || {}),
          sourceEventId: newEventId,
        }
        nextEvents[nextIndex] = nextEvent
      }

      const newIndex = insertIndex + 1
      const inserted = { ...nextEvents[newIndex] }
      inserted.transition = {
        ...(inserted.transition || {}),
        sourceEventId: previousEventId,
      }
      nextEvents[newIndex] = inserted

      return nextEvents
    })
    setIsDirty(true)
  }

  const insertEventAtEnd = () => {
    if (events.length === 0) {
      setEvents([createEmptyEvent(null)])
      setIsDirty(true)
      return
    }
    insertEventAt(events.length - 1)
  }

  const reorderWithUpdatedTransitions = (list, fromIndex, toIndex) => {
    if (
      fromIndex == null ||
      toIndex == null ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      fromIndex >= list.length ||
      toIndex < 0 ||
      toIndex >= list.length
    ) {
      return list
    }

    const updated = [...list]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)

    return updated.map((ev, i, arr) => {
      const prev = i > 0 ? arr[i - 1] : null
      return {
        ...ev,
        transition: {
          ...(ev.transition || {}),
          sourceEventId: prev ? prev.eventId || null : null,
        },
      }
    })
  }

  const handleDragStart = (index, event) => {
    setDraggingIndex(index)
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(index))
    }
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
  }

  const handleDropOnItem = (targetIndex, event) => {
    event.preventDefault()
    setEvents((prev) => reorderWithUpdatedTransitions(prev, draggingIndex, targetIndex))
    setDraggingIndex(null)
    setIsDirty(true)
  }

  const handleDropAtEnd = (event) => {
    event.preventDefault()
    if (draggingIndex == null) return
    setEvents((prev) =>
      reorderWithUpdatedTransitions(prev, draggingIndex, prev.length - 1),
    )
    setDraggingIndex(null)
    setIsDirty(true)
  }

  const handleDragEnd = () => {
    setDraggingIndex(null)
  }

  const beginPickLocationForEvent = (index) => {
    setActiveEventIndex(index)
    setIsPickingLocation(true)
    if (onPickingLocationChange) {
      onPickingLocationChange(true)
    }

    const ev = events[index]
    if (!ev || !onMarkerLocationChange || !onMapCameraChange) return

    const coords = ev.location?.coordinates
    if (coords && coords.lng != null && coords.lat != null) {
      onMarkerLocationChange({ lng: coords.lng, lat: coords.lat })
      const view = ev.location.mapView || {}
      onMapCameraChange({
        center: [coords.lng, coords.lat],
        zoom: typeof view.zoom === 'number' ? view.zoom : (mapCamera?.zoom ?? 10),
        pitch: typeof view.pitch === 'number' ? view.pitch : (mapCamera?.pitch ?? 0),
        bearing:
          typeof view.bearing === 'number' ? view.bearing : (mapCamera?.bearing ?? 0),
      })
    }
  }

  // When the user clicks on the map while picking a location, update the active event.
  useEffect(() => {
    if (!isPickingLocation) return
    if (activeEventIndex == null) return
    if (!lastMapClick) return

    const { lng, lat, camera } = lastMapClick
    if (lng == null || lat == null) return

    updateEventField(activeEventIndex, ['location', 'coordinates', 'lat'], lat)
    updateEventField(activeEventIndex, ['location', 'coordinates', 'lng'], lng)

    updateEventField(activeEventIndex, ['location', 'mapView'], {
      zoom: typeof camera?.zoom === 'number' ? camera.zoom : (mapCamera?.zoom ?? 10),
      pitch: typeof camera?.pitch === 'number' ? camera.pitch : (mapCamera?.pitch ?? 0),
      bearing:
        typeof camera?.bearing === 'number' ? camera.bearing : (mapCamera?.bearing ?? 0),
      mapStyle: 'mapbox://styles/mapbox/streets-v12',
    })

    if (onMarkerLocationChange) {
      onMarkerLocationChange({ lng, lat })
    }
    if (onMapCameraChange && camera) {
      onMapCameraChange(camera)
    }

    setIsPickingLocation(false)
    if (onPickingLocationChange) {
      onPickingLocationChange(false)
    }
  }, [activeEventIndex, isPickingLocation, lastMapClick, onPickingLocationChange])

  const searchLocationForEvent = async (index, query) => {
    const trimmed = (query || '').trim()
    if (!trimmed) return

    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) {
      window.alert('Map search is not available because VITE_MAPBOX_TOKEN is not set.')
      return
    }

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        trimmed,
      )}.json?access_token=${token}&limit=1`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to search location')
      const data = await res.json()
      const feature = data.features && data.features[0]
      if (!feature || !Array.isArray(feature.center)) {
        window.alert('No matching place found on the map.')
        return
      }

      const [lng, lat] = feature.center
      const normalizedName = feature.place_name || trimmed

      updateEventField(index, ['location', 'name'], normalizedName)
      updateEventField(index, ['location', 'coordinates', 'lat'], lat)
      updateEventField(index, ['location', 'coordinates', 'lng'], lng)
      updateEventField(index, ['location', 'mapView'], {
        zoom: 12,
        pitch: 0,
        bearing: 0,
        mapStyle: 'mapbox://styles/mapbox/streets-v12',
      })

      if (onMarkerLocationChange) {
        onMarkerLocationChange({ lng, lat })
      }
      if (onMapCameraChange) {
        onMapCameraChange({
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

  const deleteEventAt = (index) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return

    setEvents((prev) => {
      if (prev.length === 0 || index < 0 || index >= prev.length) return prev

      const next = [...prev]
      next.splice(index, 1)

      if (index < next.length) {
        const prevEvent = next[index - 1]
        const updatedNext = { ...next[index] }
        updatedNext.transition = {
          ...(updatedNext.transition || {}),
          sourceEventId: prevEvent ? prevEvent.eventId : null,
        }
        next[index] = updatedNext
      }

      return next
    })

    setExpandedIndexes((prev) => {
      const updated = new Set()
      prev.forEach((i) => {
        if (i < index) updated.add(i)
        else if (i > index) updated.add(i - 1)
      })
      return updated
    })
    setIsDirty(true)
  }

  const saveToFile = async () => {
    if (!Array.isArray(events) || !storyId) return
    try {
      setSaveStatus('saving')
      const res = await fetch(`/api/stories/${storyId}/events`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(events, null, 2),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaveStatus('saved')
      setIsDirty(false)
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch (err) {
      console.error(err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2500)
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="header-top-row">
          <button type="button" className="back-btn" onClick={() => navigate('/')} title="Back">
            <span aria-label="Back" role="img" style={{ marginRight: '0.4em' }}>←</span>back
          </button>
        </div>
        <div>
          <h1>{story ? story.name : 'Create New Story'}</h1>
          <p className="app-subtitle">
            Edit existing events and insert new ones between them. Transitions will automatically
            update their <code>sourceEventId</code>.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="primary-btn" onClick={insertEventAtEnd}>
            + New event
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={saveToFile}
            disabled={saveStatus === 'saving' || (!isDirty && saveStatus !== 'error')}
          >
            {saveStatus === 'saving'
              ? 'Saving...'
              : saveStatus === 'error'
                ? 'Error – retry'
                : isDirty
                  ? 'Save Events'
                  : 'Events Saved'}
          </button>
        </div>
      </header>

      <main className="events-list">
        {loading && (
          <div className="empty-state">
            <p>Loading events from events.json...</p>
          </div>
        )}

        {!loading &&
          events.map((event, index) => (
            <div
              key={event.eventId || index}
              className="events-list-item"
              draggable
              onDragStart={(e) => handleDragStart(index, e)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnItem(index, e)}
              onDragEnd={handleDragEnd}
            >
              <EventBlock
                event={event}
                index={index}
                isExpanded={expandedIndexes.has(index)}
                onToggleExpand={toggleExpand}
                onChangeField={updateEventField}
                onUploadMainImage={handleUploadMainImage}
                onUploadComparisonImage={handleUploadComparisonImage}
                onInsertAfter={insertEventAt}
                onDelete={deleteEventAt}
                onBeginPickLocation={beginPickLocationForEvent}
                onSearchLocation={searchLocationForEvent}
              />

              <button
                type="button"
                className="between-plus-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  insertEventAt(index)
                }}
              >
                + Add event here
              </button>
            </div>
          ))}

        {!loading && events.length === 0 && (
          <div className="empty-state">
            <p>No events yet.</p>
            <button type="button" className="primary-btn" onClick={insertEventAtEnd}>
              + Create first event
            </button>
          </div>
        )}

        {!loading && events.length > 0 && (
          <div
            className="events-list-end-dropzone"
            onDragOver={handleDragOver}
            onDrop={handleDropAtEnd}
          >
            <span>Drop here to move event to the end</span>
          </div>
        )}
      </main>
    </>
  )
}

export default EditStoryView
