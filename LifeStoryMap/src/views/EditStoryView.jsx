import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EventBlock from '../components/EventBlock.jsx'
import { createEmptyEvent, generateNextEventId } from '../utils/events.js'
import { useStoryData } from '../hooks/useStoryData.js'
import { useLocationPicker } from '../hooks/useLocationPicker.js'
import { uploadImage } from '../services/imageService.js'
import { saveEvents } from '../services/eventService.js'

function EditStoryView({
  mapCamera,
  markerLocation,
  onMarkerLocationChange,
  onMapCameraChange,
  lastMapClick,
  onPickingLocationChange,
  onLastMapClickChange,
  onEventsChange,
  onExpandedEventIndexChange,
}) {
  const navigate = useNavigate()
  const { storyId } = useParams()
  const [events, setEvents] = useState([])
  const [saveStatus, setSaveStatus] = useState('idle')
  const [expandedIndexes, setExpandedIndexes] = useState(new Set())
  const [isDirty, setIsDirty] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState(null)
  const [dragOverTarget, setDragOverTarget] = useState(null) // number index or 'end'
  const [isActionsBarStuck, setIsActionsBarStuck] = useState(false)
  const cameraBeforeEventFocusRef = useRef(null)
  const actionsBarRef = useRef(null)
  const actionsBarSentinelRef = useRef(null)

  // Use custom hooks
  const { loading, story, events: loadedEvents } = useStoryData(storyId)
  const locationPicker = useLocationPicker({
    onLocationUpdate: (index, updates) => {
      // This will be handled by processMapClick
    },
    onMarkerChange: onMarkerLocationChange,
    onCameraChange: onMapCameraChange,
    mapCamera,
  })

  // Sync loaded events to local state
  useEffect(() => {
    if (loadedEvents.length > 0 || !loading) {
      setEvents(loadedEvents)
      setIsDirty(false)
      if (onEventsChange) {
        onEventsChange(loadedEvents)
      }
    }
  }, [loadedEvents, loading, onEventsChange])

  useEffect(() => {
    const bar = actionsBarRef.current
    const sentinel = actionsBarSentinelRef.current
    if (!bar || !sentinel) return
    if (typeof IntersectionObserver === 'undefined') return

    const findScrollParent = (node) => {
      let el = node?.parentElement || null
      while (el) {
        const style = window.getComputedStyle(el)
        const overflowY = style.overflowY
        if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
          return el
        }
        el = el.parentElement
      }
      return null
    }

    const root = findScrollParent(bar)
    const stickyTopPx = Number.parseFloat(window.getComputedStyle(bar).top || '0') || 0

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the sentinel scrolls past the sticky threshold, the bar is "stuck".
        setIsActionsBarStuck(!entry.isIntersecting)
      },
      {
        root,
        threshold: [0],
        // Align the intersection boundary with the element's sticky `top` value (even if it's negative).
        rootMargin: `${-stickyTopPx}px 0px 0px 0px`,
      },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // Image upload now uses the service

  const handleUploadMainImage = async (index, file) => {
    try {
      const url = await uploadImage(file)
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
      const url = await uploadImage(file)
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

  const handleRemoveComparisonImage = (index, which) => {
    setEvents((prev) =>
      prev.map((event, i) => {
        if (i !== index) return event
        const clone = structuredClone ? structuredClone(event) : JSON.parse(JSON.stringify(event))
        if (!clone.content || typeof clone.content !== 'object') clone.content = {}
        if (!clone.content.imageComparison || typeof clone.content.imageComparison !== 'object') {
          clone.content.imageComparison = { enabled: true, caption: '', urlOld: '', urlNew: '' }
        }
        if (which === 'old') clone.content.imageComparison.urlOld = ''
        else if (which === 'new') clone.content.imageComparison.urlNew = ''
        return clone
      }),
    )
    setIsDirty(true)
  }

  // Load events when story data is available
  useEffect(() => {
    if (story && storyId) {
      // Events are loaded via useStoryData hook, but we need to sync them
      // This will be handled by the parent component or we can fetch separately
      // For now, keeping the existing pattern but using the service
    }
  }, [story, storyId])

  const toggleExpand = (index) => {
    setExpandedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
        const remainingIndices = Array.from(next).sort((a, b) => b - a)
        const nextActiveIndex = remainingIndices.length > 0 ? remainingIndices[0] : null

        // If there are still expanded events, keep focus on the top-most expanded event.
        if (onExpandedEventIndexChange) {
          onExpandedEventIndexChange(nextActiveIndex)
        }

        if (nextActiveIndex != null) {
          const ev = events[nextActiveIndex]
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
        } else {
          // Closing the last expanded event: zoom back out to the camera we had before focusing.
          if (onMapCameraChange && cameraBeforeEventFocusRef.current) {
            onMapCameraChange(cameraBeforeEventFocusRef.current)
          }
          if (onMarkerLocationChange) {
            onMarkerLocationChange(null)
          }
          cameraBeforeEventFocusRef.current = null
        }
      } else {
        // Accordion behavior: only one expanded event at a time.
        const hadAnyExpanded = next.size > 0
        next.clear()

        // First expand (from none): remember current camera so Close can restore it.
        if (!hadAnyExpanded) {
          cameraBeforeEventFocusRef.current = mapCamera
            ? {
                center: Array.isArray(mapCamera.center) ? [...mapCamera.center] : [0, 0],
                zoom: typeof mapCamera.zoom === 'number' ? mapCamera.zoom : 3,
                pitch: typeof mapCamera.pitch === 'number' ? mapCamera.pitch : 0,
                bearing: typeof mapCamera.bearing === 'number' ? mapCamera.bearing : 0,
              }
            : null
        }
        next.add(index)
        if (onExpandedEventIndexChange) {
          onExpandedEventIndexChange(index)
        }
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
    setEvents((prev) => {
      const updated = prev.map((event, i) => {
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
      })
      if (onEventsChange) {
        onEventsChange(updated)
      }
      return updated
    })
    setIsDirty(true)
  }

  const insertEventAt = (insertIndex) => {
    setEvents((prev) => {
      let nextEvents
      if (prev.length === 0) {
        nextEvents = [createEmptyEvent(null)]
      } else {
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

        nextEvents = [...prev]
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
      }
      if (onEventsChange) {
        onEventsChange(nextEvents)
      }
      return nextEvents
    })
    setIsDirty(true)
  }

  const insertEventAtEnd = () => {
    if (events.length === 0) {
      const newEvents = [createEmptyEvent(null)]
      setEvents(newEvents)
      if (onEventsChange) {
        onEventsChange(newEvents)
      }
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
    setDragOverTarget(index)
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

  const handleDragOverItem = (targetIndex, event) => {
    handleDragOver(event)
    if (draggingIndex == null) return
    if (dragOverTarget !== targetIndex) {
      setDragOverTarget(targetIndex)
    }
  }

  const handleDragOverEnd = (event) => {
    handleDragOver(event)
    if (draggingIndex == null) return
    if (dragOverTarget !== 'end') {
      setDragOverTarget('end')
    }
  }

  const handleDropOnItem = (targetIndex, event) => {
    event.preventDefault()
    setEvents((prev) => {
      const updated = reorderWithUpdatedTransitions(prev, draggingIndex, targetIndex)
      if (onEventsChange) {
        onEventsChange(updated)
      }
      return updated
    })
    setDraggingIndex(null)
    setDragOverTarget(null)
    setIsDirty(true)
  }

  const handleDropAtEnd = (event) => {
    event.preventDefault()
    if (draggingIndex == null) return
    setEvents((prev) => {
      const updated = reorderWithUpdatedTransitions(prev, draggingIndex, prev.length - 1)
      if (onEventsChange) {
        onEventsChange(updated)
      }
      return updated
    })
    setDraggingIndex(null)
    setDragOverTarget(null)
    setIsDirty(true)
  }

  const handleDragEnd = () => {
    setDraggingIndex(null)
    setDragOverTarget(null)
  }

  const beginPickLocationForEvent = (index) => {
    locationPicker.beginPickLocation(index, markerLocation)
    if (onPickingLocationChange) {
      onPickingLocationChange(locationPicker.isPickingLocation)
    }
    if (onLastMapClickChange) {
      onLastMapClickChange(null)
    }
  }

  // Process map clicks when picking location
  useEffect(() => {
    if (locationPicker.isPickingLocation && lastMapClick) {
      locationPicker.processMapClick(lastMapClick, updateEventField)
      if (onLastMapClickChange) {
        onLastMapClickChange(null)
      }
      if (onPickingLocationChange) {
        onPickingLocationChange(false)
      }
    }
  }, [locationPicker.isPickingLocation, lastMapClick, locationPicker, updateEventField, onLastMapClickChange, onPickingLocationChange])

  const searchLocationForEvent = async (index, query) => {
    await locationPicker.searchLocationForEvent(index, query, updateEventField)
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

      if (onEventsChange) {
        onEventsChange(next)
      }
      return next
    })

    setExpandedIndexes((prev) => {
      const updated = new Set()
      prev.forEach((i) => {
        if (i < index) updated.add(i)
        else if (i > index) updated.add(i - 1)
      })
      if (onExpandedEventIndexChange) {
        if (updated.size > 0) {
          const expandedArray = Array.from(updated).sort((a, b) => b - a)
          onExpandedEventIndexChange(expandedArray[0])
        } else {
          onExpandedEventIndexChange(null)
        }
      }
      return updated
    })
    setIsDirty(true)
  }

  const saveToFile = async () => {
    if (!Array.isArray(events) || !storyId) return
    try {
      setSaveStatus('saving')
      await saveEvents(storyId, events)
      setSaveStatus('saved')
      setIsDirty(false)
      if (onEventsChange) {
        onEventsChange(events)
      }
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
          <button
            type="button"
            className="back-btn"
            onClick={() => {
              if (
                isDirty &&
                !window.confirm('You have unsaved changes. Leave this page without saving?')
              ) {
                return
              }
              navigate('/')
            }}
            title="Back"
          >
            <span aria-label="Back" role="img" style={{ marginRight: '0.4em' }}>←</span>back
          </button>
        </div>
        <div>
          <h1>{story ? story.name : 'Create New Story'}</h1>
          <p className="app-subtitle">
            Create a story by adding events. Create new events by Inserting title, date, text and image and don't forget to add location!
          </p>
        </div>
      </header>

      <div
        ref={actionsBarSentinelRef}
        className="edit-story-actions-sentinel"
        aria-hidden="true"
      />
      <div
        ref={actionsBarRef}
        className={`header-actions edit-story-actions-bar${isActionsBarStuck ? ' is-stuck' : ''}`}
      >
        <button type="button" className="primary-btn" onClick={insertEventAtEnd}>
          + New event
        </button>
        <div className="event-counter" aria-label={`Events count: ${events.length}`}>
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </div>
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
                ? 'Save Changes'
                : 'Changes Saved'}
        </button>
      </div>

      <main className={`events-list${draggingIndex != null ? ' is-dragging' : ''}`}>
        {loading && (
          <div className="empty-state">
            <p>Loading events from events.json...</p>
          </div>
        )}

        {!loading &&
          events.map((event, index) => (
            <div
              key={event.eventId || index}
              className={[
                'events-list-item',
                draggingIndex != null && dragOverTarget === index ? 'is-drop-target' : '',
                draggingIndex === index ? 'is-being-dragged' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              draggable
              onDragStart={(e) => handleDragStart(index, e)}
              onDragOver={(e) => handleDragOverItem(index, e)}
              onDrop={(e) => handleDropOnItem(index, e)}
              onDragEnd={handleDragEnd}
            >
              <EventBlock
                event={event}
                index={index}
                isExpanded={expandedIndexes.has(index)}
                isPickingLocation={locationPicker.isPickingLocation}
                activeEventIndex={locationPicker.activeEventIndex}
                onToggleExpand={toggleExpand}
                onChangeField={updateEventField}
                onUploadMainImage={handleUploadMainImage}
                onUploadComparisonImage={handleUploadComparisonImage}
                onRemoveComparisonImage={handleRemoveComparisonImage}
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
            className={[
              'events-list-end-dropzone',
              draggingIndex != null && dragOverTarget === 'end' ? 'is-drop-target' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onDragOver={handleDragOverEnd}
            onDrop={handleDropAtEnd}
          >
          </div>
        )}
      </main>
    </>
  )
}

export default EditStoryView
