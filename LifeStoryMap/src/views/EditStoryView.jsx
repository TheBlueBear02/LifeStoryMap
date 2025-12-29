import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EventBlock from '../components/EventBlock.jsx'
import { createEmptyEvent, generateNextEventId, isSpecialEvent, ensureSpecialEvents } from '../utils/events.js'
import { useStoryData } from '../hooks/useStoryData.js'
import { useLocationPicker } from '../hooks/useLocationPicker.js'
import { uploadImage } from '../services/imageService.js'
import { saveEvents } from '../services/eventService.js'
import { updateStory } from '../services/storyService.js'
import { deleteAudio, deleteAllAudio, generateAudio } from '../services/audioService.js'
import { getEvents } from '../services/eventService.js'
import { LANGUAGES, DEFAULT_LANGUAGE } from '../constants/languages.js'
import { getVoicesForLanguage, getDefaultVoiceId } from '../constants/voices.js'

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
  const [storyLanguage, setStoryLanguage] = useState(DEFAULT_LANGUAGE)
  const [storyVoiceId, setStoryVoiceId] = useState(null)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [isAudioSectionExpanded, setIsAudioSectionExpanded] = useState(false)
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false)
  const cameraBeforeEventFocusRef = useRef(null)
  const actionsBarRef = useRef(null)
  const actionsBarSentinelRef = useRef(null)
  const audioMenuRef = useRef(null)

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

  // Sync story language and voice when story loads
  useEffect(() => {
    if (story) {
      const language = story.language || DEFAULT_LANGUAGE
      setStoryLanguage(language)
      // Set voiceId from story, or use default for the language
      setStoryVoiceId(story.voiceId || getDefaultVoiceId(language))
    }
  }, [story])

  // Handle clicks outside audio menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target)) {
        setIsAudioMenuOpen(false)
      }
    }

    if (isAudioMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isAudioMenuOpen])

  // Sync loaded events to local state
  useEffect(() => {
    if (loadedEvents.length > 0 || !loading) {
      const ensuredEvents = ensureSpecialEvents(loadedEvents)
      setEvents(ensuredEvents)
      setIsDirty(false)
      if (onEventsChange) {
        onEventsChange(ensuredEvents)
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
          
          // For special events, use simple media array
          if (isSpecialEvent(clone)) {
            if (!Array.isArray(clone.content.media)) clone.content.media = []
            const nextItem = {
              type: 'image',
              url,
            }
            // Replace first image or add new one
            if (clone.content.media.length > 0) {
              clone.content.media[0] = nextItem
            } else {
              clone.content.media.push(nextItem)
            }
          } else {
            // For regular events, use imageComparison
            if (!Array.isArray(clone.content.media)) clone.content.media = []
            const imgIndex = clone.content.media.findIndex((m) => m && m.type === 'image')
            const nextItem = {
              ...(imgIndex >= 0 ? clone.content.media[imgIndex] : {}),
              type: 'image',
              url,
            }
            if (imgIndex >= 0) clone.content.media[imgIndex] = nextItem
            else clone.content.media.push(nextItem)
          }
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
      // Find special events
      const openingIndex = prev.findIndex((e) => e?.eventType === 'Opening')
      const closingIndex = prev.findIndex((e) => e?.eventType === 'Closing')
      
      // Adjust insertIndex to ensure we don't insert before Opening or after Closing
      let adjustedIndex = insertIndex
      if (openingIndex >= 0 && adjustedIndex <= openingIndex) {
        adjustedIndex = openingIndex
      }
      if (closingIndex >= 0 && adjustedIndex >= closingIndex) {
        adjustedIndex = closingIndex - 1
      }

      let nextEvents
      if (prev.length === 0) {
        nextEvents = [createEmptyEvent(null)]
      } else {
        const previous = prev[adjustedIndex] || prev[prev.length - 1]
        // Skip special events when finding previous
        let actualPrevious = previous
        if (isSpecialEvent(previous) && adjustedIndex > 0) {
          actualPrevious = prev[adjustedIndex - 1]
        }
        const previousEventId = actualPrevious && !isSpecialEvent(actualPrevious) ? actualPrevious.eventId : null
        const newEventId = generateNextEventId(prev.filter((e) => !isSpecialEvent(e)))
        const newEvent = {
          ...createEmptyEvent(previousEventId),
          eventId: newEventId,
          transition: {
            ...createEmptyEvent(previousEventId).transition,
            sourceEventId: previousEventId,
          },
        }

        nextEvents = [...prev]
        nextEvents.splice(adjustedIndex + 1, 0, newEvent)

        const nextIndex = adjustedIndex + 2
        if (nextIndex < nextEvents.length) {
          const nextEvent = { ...nextEvents[nextIndex] }
          if (!isSpecialEvent(nextEvent)) {
            nextEvent.transition = {
              ...(nextEvent.transition || {}),
              sourceEventId: newEventId,
            }
            nextEvents[nextIndex] = nextEvent
          }
        }

        const newIndex = adjustedIndex + 1
        const inserted = { ...nextEvents[newIndex] }
        if (!isSpecialEvent(inserted)) {
          inserted.transition = {
            ...(inserted.transition || {}),
            sourceEventId: previousEventId,
          }
          nextEvents[newIndex] = inserted
        }
      }
      
      const ensured = ensureSpecialEvents(nextEvents)
      if (onEventsChange) {
        onEventsChange(ensured)
      }
      return ensured
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

    // Prevent moving special events
    const fromEvent = list[fromIndex]
    const toEvent = list[toIndex]
    if (isSpecialEvent(fromEvent) || isSpecialEvent(toEvent)) {
      return list
    }

    // Find indices of special events
    const openingIndex = list.findIndex((e) => e?.eventType === 'Opening')
    const closingIndex = list.findIndex((e) => e?.eventType === 'Closing')

    // Prevent moving regular events to positions that would place them before Opening or after Closing
    if (openingIndex >= 0 && toIndex <= openingIndex) {
      return list
    }
    if (closingIndex >= 0 && toIndex >= closingIndex) {
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
    // Prevent dragging special events
    if (isSpecialEvent(events[index])) {
      event.preventDefault()
      return
    }
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
    // `beginPickLocation` updates internal state asynchronously; we need to tell App
    // the *next* picking state immediately so map clicks start being captured right away.
    const willToggleOff =
      locationPicker.isPickingLocation && locationPicker.activeEventIndex === index
    const nextIsPicking = !willToggleOff

    locationPicker.beginPickLocation(index, markerLocation)
    if (onPickingLocationChange) {
      onPickingLocationChange(nextIsPicking)
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
    const event = events[index]
    if (isSpecialEvent(event)) {
      window.alert('Opening and Closing events cannot be deleted.')
      return
    }
    
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

      const ensured = ensureSpecialEvents(next)
      if (onEventsChange) {
        onEventsChange(ensured)
      }
      return ensured
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

  const handleLanguageChange = (newLanguage) => {
    if (newLanguage === storyLanguage) return
    
    setStoryLanguage(newLanguage)
    // Reset voice to default for new language
    const defaultVoiceId = getDefaultVoiceId(newLanguage)
    setStoryVoiceId(defaultVoiceId)
    setIsDirty(true)
  }

  const handleVoiceChange = (newVoiceId) => {
    if (newVoiceId === storyVoiceId) return
    
    setStoryVoiceId(newVoiceId)
    setIsDirty(true)
  }

  const handleDeleteAudio = async (index) => {
    if (!storyId) return
    
    const event = events[index]
    if (!event?.eventId || !event?.content?.audioUrl) {
      alert('No audio file found for this event.')
      return
    }

    try {
      // Delete audio file via API
      await deleteAudio(storyId, event.eventId)
      
      // Update local state to remove audioUrl
      setEvents((prev) =>
        prev.map((ev, i) => {
          if (i !== index) return ev
          const clone = structuredClone ? structuredClone(ev) : JSON.parse(JSON.stringify(ev))
          if (clone.content && clone.content.audioUrl) {
            delete clone.content.audioUrl
          }
          return clone
        }),
      )
      setIsDirty(true)
      
      // Save changes immediately
      await saveToFile()
    } catch (err) {
      console.error('Error deleting audio:', err)
      alert('Failed to delete audio file. Please try again.')
    }
  }

  const handleDeleteAllAudio = async () => {
    if (!storyId) return

    // Count how many events have audio
    const eventsWithAudio = events.filter((ev) => ev?.content?.audioUrl)
    if (eventsWithAudio.length === 0) {
      alert('No audio files found for this story.')
      return
    }

    if (!window.confirm(`Are you sure you want to delete all ${eventsWithAudio.length} audio file${eventsWithAudio.length === 1 ? '' : 's'} for this story? This action cannot be undone.`)) {
      return
    }

    try {
      // Delete all audio files via API (this also removes audioUrls from the JSON file)
      const result = await deleteAllAudio(storyId)
      
      // Update local state to remove all audioUrl (API already saved the file)
      const updatedEvents = events.map((ev) => {
        const clone = structuredClone ? structuredClone(ev) : JSON.parse(JSON.stringify(ev))
        if (clone.content && clone.content.audioUrl) {
          delete clone.content.audioUrl
        }
        return clone
      })
      
      setEvents(updatedEvents)
      // Don't set isDirty since the API already saved the file
      setIsDirty(false)
      
      // Notify parent component of changes
      if (onEventsChange) {
        onEventsChange(updatedEvents)
      }
      
      const deletedCount = result?.deleted || eventsWithAudio.length
      alert(`Successfully deleted ${deletedCount} audio file${deletedCount === 1 ? '' : 's'} and removed audio URLs from the story.`)
    } catch (err) {
      console.error('Error deleting all audio files:', err)
      alert('Failed to delete all audio files. Please try again.')
    }
  }

  const handleGenerateAudio = async () => {
    if (!storyId || isGeneratingAudio) return

    setIsGeneratingAudio(true)
    
    try {
      const result = await generateAudio(storyId)
      
      // Check if there were errors
      if (result.errors && result.errors.length > 0) {
        const errorCount = result.errors.length
        const successCount = result.generated || 0
        if (successCount > 0) {
          alert(
            `Partially completed: Generated audio for ${successCount} event(s), but ${errorCount} event(s) failed.\n\n` +
            `First error: ${result.errors[0].message}`
          )
        } else {
          alert(
            `Failed to generate audio for ${errorCount} event(s).\n\n` +
            `Error: ${result.errors[0].message}`
          )
        }
      } else if (result.generated > 0) {
        alert(`Successfully generated audio for ${result.generated} event(s)!`)
      } else {
        alert('No audio files were generated. All events may already have audio or no events need audio generation.')
      }
      
      // Reload events to get updated audio URLs
      const reloadedEvents = await getEvents(storyId)
      const ensuredEvents = ensureSpecialEvents(reloadedEvents)
      setEvents(ensuredEvents)
      if (onEventsChange) {
        onEventsChange(ensuredEvents)
      }
    } catch (err) {
      console.error('Error generating audio:', err)
      const errorMessage = err.message || 'Failed to generate audio. Please try again.'
      alert(`Error: ${errorMessage}`)
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  const saveToFile = async () => {
    if (!Array.isArray(events) || !storyId) return
    try {
      setSaveStatus('saving')
      const ensuredEvents = ensureSpecialEvents(events)
      
      // Save events
      await saveEvents(storyId, ensuredEvents)
      
      // Save story metadata (language and voiceId) if they differ from the loaded story
      const storyUpdates = {}
      const originalLanguage = story?.language || DEFAULT_LANGUAGE
      if (storyLanguage !== originalLanguage) {
        storyUpdates.language = storyLanguage
      }
      const originalVoiceId = story?.voiceId || getDefaultVoiceId(originalLanguage)
      if (storyVoiceId !== originalVoiceId) {
        storyUpdates.voiceId = storyVoiceId
      }
      
      if (Object.keys(storyUpdates).length > 0) {
        await updateStory(storyId, storyUpdates)
      }
      
      setSaveStatus('saved')
      setIsDirty(false)
      if (onEventsChange) {
        onEventsChange(ensuredEvents)
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
            title="Home"
          >
            <span aria-label="Home" role="img" style={{ marginRight: '0.4em' }}>←</span>Home
          </button>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, flex: 1, minWidth: '200px' }}>{story ? story.name : 'Create New Story'}</h1>
            
          </div>
          <p className="app-subtitle">
            Create a story by adding events. Create new events by Inserting title, date, text and image and don't forget to add location!
          </p>
        </div>
        {story && (() => {
          // Calculate events with audio (excluding special events)
          const regularEvents = events.filter((ev) => !isSpecialEvent(ev))
          const eventsWithAudio = regularEvents.filter((ev) => ev?.content?.audioUrl)
          const totalEvents = regularEvents.length
          const audioCount = eventsWithAudio.length
          
          return (
            <div className="event-block" style={{ marginTop: '1rem' }}>
              <div className="event-block-header">
                <div className="event-block-meta-row">
                  <div className="event-block-id-type">
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.9rem', color: '#6b7280' }}>
                      <span
                        role="img"
                        aria-label="Audio"
                        style={{ marginRight: '0.4em', fontSize: '1.1em', verticalAlign: 'middle' }}
                      >🔊</span>
                      Voice Over Settings
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                  </div>
                  <div className="event-header-actions">
                    <button 
                      type="button" 
                      className="event-expand-btn" 
                      onClick={() => setIsAudioSectionExpanded(!isAudioSectionExpanded)}
                    >
                      {isAudioSectionExpanded ? 'Close' : 'Open'}
                    </button>
                    <div className="story-menu-container" ref={audioMenuRef}>
                      <button
                        type="button"
                        className="story-menu-icon"
                        onClick={() => setIsAudioMenuOpen((v) => !v)}
                        aria-label="Audio menu"
                        aria-expanded={isAudioMenuOpen}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="10" cy="4" r="1.5" fill="currentColor" />
                          <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                          <circle cx="10" cy="16" r="1.5" fill="currentColor" />
                        </svg>
                      </button>
                      {isAudioMenuOpen && (
                        <div className="story-menu-dropdown">
                          <button
                            type="button"
                            className="story-menu-item"
                            onClick={() => {
                              setIsAudioMenuOpen(false)
                              handleDeleteAllAudio()
                            }}
                          >
                            Delete All Audio files
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                </div>
                <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.9rem', color: '#374151' }}>
                      {audioCount} of {totalEvents} event{totalEvents === 1 ? '' : 's'} have audio
                    </span>
                  </div>
              </div>

              {isAudioSectionExpanded && (
                <div className="event-details">
                  <div className="event-details-section">
                    <h3>Language & Voice</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <label>
                        Language
                        <select
                          id="story-language-select"
                          value={storyLanguage}
                          onChange={(e) => handleLanguageChange(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            fontSize: '0.9rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.5rem',
                            backgroundColor: 'white',
                            cursor: 'pointer',
                            marginTop: '0.25rem',
                          }}
                        >
                          {LANGUAGES.map((lang) => (
                            <option key={lang.code} value={lang.code}>
                              {lang.nativeName} ({lang.name})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Voice
                        <select
                          id="story-voice-select"
                          value={storyVoiceId || getDefaultVoiceId(storyLanguage)}
                          onChange={(e) => handleVoiceChange(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            fontSize: '0.9rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.5rem',
                            backgroundColor: 'white',
                            cursor: 'pointer',
                            marginTop: '0.25rem',
                          }}
                        >
                          {getVoicesForLanguage(storyLanguage).map((voice) => (
                            <option key={voice.id} value={voice.id}>
                              {voice.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="event-details-section">
                    <h3>Audio Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={handleGenerateAudio}
                        disabled={isGeneratingAudio}
                        style={{ width: '100%' }}
                      >
                        {isGeneratingAudio ? 'Generating...' : 'Generate Audio'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}
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
          events.map((event, index) => {
            const isSpecial = isSpecialEvent(event)
            return (
            <div
              key={event.eventId || index}
              className={[
                'events-list-item',
                draggingIndex != null && dragOverTarget === index ? 'is-drop-target' : '',
                draggingIndex === index ? 'is-being-dragged' : '',
                isSpecial ? 'events-list-item-special' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              draggable={!isSpecial}
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
                onDeleteAudio={handleDeleteAudio}
              />

              {!isSpecialEvent(event) && (
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
              )}
            </div>
          )})}

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
