import { useEffect, useState } from 'react'
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import './App.css'

function generateNextEventId(events) {
  const maxNum =
    events
      .map((e) => {
        const match = /^E(\d+)$/.exec(e.eventId || '')
        return match ? Number(match[1]) : 0
      })
      .reduce((a, b) => Math.max(a, b), 0) || 0

  const next = maxNum + 1
  return `E${String(next).padStart(3, '0')}`
}

function createEmptyEvent(previousEventId) {
  const newId = generateNextEventId(previousEventId ? [{ eventId: previousEventId }] : [])

  return {
    eventId: newId,
    eventType: 'Event',
    title: '',
    timeline: {
      dateStart: '',
      dateEnd: '',
    },
    location: {
      name: '',
      coordinates: {
        lat: 0,
        lng: 0,
      },
      mapView: {
        zoom: 10,
        pitch: 0,
        bearing: 0,
        mapStyle: 'mapbox://styles/mapbox/streets-v12',
      },
    },
    transition: {
      type: 'ArcFlyWithPoint',
      durationSeconds: 3,
      sourceEventId: previousEventId || null,
      lineStyleKey: '',
    },
    content: {
      textHtml: '',
      media: [],
      imageComparison: {
        enabled: false,
        caption: '',
        urlOld: '',
        urlNew: '',
      },
    },
  }
}

function EventBlock({
  event,
  index,
  isExpanded,
  onToggleExpand,
  onChangeField,
  onUploadMainImage,
  onUploadComparisonImage,
  onInsertAfter,
  onDelete,
}) {
  const handleInputChange = (path, value) => {
    onChangeField(index, path, value)
  }

  const isPeriod = event.eventType === 'Period'

  return (
    <div className="event-block">
      <div className="event-block-header">
        <div className="event-block-meta-row">
          <div className="event-block-id-type">
            <span className="event-drag-handle" title="Drag to reorder">⋮⋮</span>
            <span className="event-id">#{event.eventId}</span>
            <select
              className="event-type-select"
              value={event.eventType || 'Event'}
              onChange={(e) => handleInputChange(['eventType'], e.target.value)}
            >
              <option value="Event">Event</option>
              <option value="Period">Period</option>
            </select>
          </div>

          <div className="event-header-actions">
            <button
              type="button"
              className="event-delete-btn"
              onClick={() => onDelete(index)}
            >
              Remove
            </button>
            <button type="button" className="event-expand-btn" onClick={() => onToggleExpand(index)}>
              {isExpanded ? 'Close' : 'Open'}
            </button>
          </div>
        </div>

        <input
          className="event-title-input"
          type="text"
          placeholder="Event title"
          value={event.title || ''}
          onChange={(e) => handleInputChange(['title'], e.target.value)}
        />

        <div className="event-summary-row">
          <div className="event-dates">
            {isPeriod ? (
              <>
                <input
                  type="date"
                  value={event.timeline?.dateStart || ''}
                  onChange={(e) => handleInputChange(['timeline', 'dateStart'], e.target.value)}
                />
                <span className="date-separator">–</span>
                <input
                  type="date"
                  value={event.timeline?.dateEnd || ''}
                  onChange={(e) => handleInputChange(['timeline', 'dateEnd'], e.target.value)}
                />
              </>
            ) : (
              <input
                type="date"
                value={event.timeline?.dateStart || ''}
                onChange={(e) => handleInputChange(['timeline', 'dateStart'], e.target.value)}
              />
            )}
          </div>
          <div className="event-location">
            <input
              className="event-location-input"
              type="text"
              placeholder="Location name"
              value={event.location?.name || ''}
              onChange={(e) => handleInputChange(['location', 'name'], e.target.value)}
            />
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="event-details">
          <div className="event-details-section">
            <h3>Transition</h3>
            <div className="transition-row">
              <label>
                Type
                <select
                  value={event.transition?.type || 'ArcFlyWithPoint'}
                  onChange={(e) => handleInputChange(['transition', 'type'], e.target.value)}
                >
                  <option value="ArcFlyWithPoint">Arc fly with point</option>
                  <option value="FlyTo">Fly to</option>
                  <option value="Instant">Instant jump</option>
                </select>
              </label>
              <label className="transition-duration-field">
                Duration (seconds)
                <input
                  type="number"
                  min="0"
                  value={event.transition?.durationSeconds ?? ''}
                  onChange={(e) =>
                    handleInputChange(
                      ['transition', 'durationSeconds'],
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Line style key
                <select
                  value={event.transition?.lineStyleKey || ''}
                  onChange={(e) => handleInputChange(['transition', 'lineStyleKey'], e.target.value)}
                >
                  <option value="">None</option>
                  <option value="GoldenAgePath">Golden age path</option>
                  <option value="MemoryTrail">Memory trail</option>
                  <option value="ImportantJump">Important jump</option>
                </select>
              </label>
            </div>
          </div>

          <div className="event-details-section">
            <h3>Content</h3>
            <label>
              Text
              <textarea
                className="event-text-rtl"
                value={event.content?.textHtml || ''}
                onChange={(e) => handleInputChange(['content', 'textHtml'], e.target.value)}
              />
            </label>
            {event.content?.imageComparison && (
              <div className="image-comparison-section">
                <div className="image-comparison-row">
                  <label className="file-input-label">
                    Main image
                    <button type="button" className="file-input-button">
                      <span className="file-input-icon" aria-hidden="true">⭱</span>
                      <span>Choose file</span>
                    </button>
                    <input
                      className="file-input-native"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file && onUploadComparisonImage) {
                          onUploadComparisonImage(index, 'old', file)
                        }
                      }}
                    />
                  </label>
                  <label className="image-comparison-new-version file-input-label">
                    Add new version
                    <button type="button" className="file-input-button">
                      <span className="file-input-icon" aria-hidden="true">⭱</span>
                      <span>Choose file</span>
                    </button>
                    <input
                      className="file-input-native"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file && onUploadComparisonImage) {
                          onUploadComparisonImage(index, 'new', file)
                        }
                      }}
                    />
                  </label>
                </div>
                <label>
                  Caption
                  <input
                    className="rtl-input"
                    type="text"
                    value={event.content.imageComparison.caption || ''}
                    onChange={(e) =>
                      handleInputChange(
                        ['content', 'imageComparison', 'caption'],
                        e.target.value,
                      )
                    }
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

function HomeView() {
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newStoryName, setNewStoryName] = useState('')

  useEffect(() => {
    const loadStories = async () => {
      try {
        const res = await fetch('/api/stories')
        if (!res.ok) throw new Error('Failed to load stories')
        const data = await res.json()
        setStories(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
        setStories([])
      } finally {
        setLoading(false)
      }
    }
    loadStories()
  }, [])

  const handleCreateStory = async (e) => {
    e.preventDefault()
    if (!newStoryName.trim()) return

    try {
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStoryName.trim() }),
      })
      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Failed to create story')
        return
      }
      const newStory = await res.json()
      setStories([...stories, newStory])
      setNewStoryName('')
      setShowCreateForm(false)
      window.location.href = `/edit-story/${newStory.id}`
    } catch (err) {
      console.error(err)
      alert('Failed to create story')
    }
  }

  const handleDeleteStory = async (storyId) => {
    if (!window.confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Failed to delete story')
        return
      }
      // Remove the story from the list
      setStories(stories.filter((s) => s.id !== storyId))
    } catch (err) {
      console.error(err)
      alert('Failed to delete story')
    }
  }

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return dateString
    }
  }

  return (
    <div className="home-view">
      <div className="home-content">
        <h1>Life Story Maps</h1>
        <p className="home-subtitle">Create and manage your life story maps</p>

        {loading ? (
          <div className="stories-loading">Loading stories...</div>
        ) : (
          <>
            <div className="stories-list">
              {stories.length === 0 ? (
                <div className="empty-stories">
                  <p>No stories yet. Create your first story to get started!</p>
                </div>
              ) : (
                stories.map((story) => (
                  <div key={story.id} className="story-card">
                    <div className="story-card-header">
                      <h3 className="story-name">{story.name}</h3>
                      <div className="story-header-actions">
                        <button
                          type="button"
                          className="story-delete-btn"
                          onClick={() => handleDeleteStory(story.id)}
                        >
                          Remove
                        </button>
                        <div className="story-badge">
                          {story.published ? (
                            <span className="badge published">Published</span>
                          ) : (
                            <span className="badge draft">Draft</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="story-card-info">
                      <div className="story-info-item">
                        <span className="info-label">Events:</span>
                        <span className="info-value">{story.eventCount}</span>
                      </div>
                      <div className="story-info-item">
                        <span className="info-label">Created:</span>
                        <span className="info-value">{formatDate(story.dateCreated)}</span>
                      </div>
                    </div>
                    <div className="story-card-actions">
                      <Link
                        to={`/view-story/${story.id}`}
                        className="primary-btn story-view-btn"
                      >
                        View
                      </Link>
                      <Link
                        to={`/edit-story/${story.id}`}
                        className="secondary-btn story-edit-btn"
                      >
                        Edit Story
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            {!showCreateForm && stories.length < 5 && (
              <div className="create-story-btn-wrapper">
                <button
                  type="button"
                  className="primary-btn create-story-btn"
                  onClick={() => setShowCreateForm(true)}
                >
                  + Create New Story
                </button>
              </div>
            )}

            {showCreateForm && (
              <form className="create-story-form" onSubmit={handleCreateStory}>
                <input
                  type="text"
                  className="story-name-input"
                  placeholder="Enter story name"
                  value={newStoryName}
                  onChange={(e) => setNewStoryName(e.target.value)}
                  autoFocus
                />
                <div className="create-story-form-actions">
                  <button type="submit" className="primary-btn" disabled={!newStoryName.trim()}>
                    Create
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setShowCreateForm(false)
                      setNewStoryName('')
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {stories.length >= 5 && (
              <p className="max-stories-message">Maximum of 5 stories reached</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CreateStoryView() {
  const navigate = useNavigate()
  const { storyId } = useParams()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [story, setStory] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const [expandedIndexes, setExpandedIndexes] = useState(new Set())
  const [isDirty, setIsDirty] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState(null)

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
        // Redirect to home if no storyId provided
        navigate('/')
        return
      }

      try {
        // Load story info
        const storyRes = await fetch(`/api/stories/${storyId}`)
        if (!storyRes.ok) throw new Error('Failed to load story')
        const storyData = await storyRes.json()
        setStory(storyData)

        // Load events for this story
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
  }, [storyId])
  const toggleExpand = (index) => {
    setExpandedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
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

        // For single-point events, always mirror dateStart into dateEnd
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

        // When switching to Event type, collapse any period into a single date
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

      // Update transition.sourceEventId of the *next* event in the list (if it exists)
      const nextIndex = insertIndex + 2
      if (nextIndex < nextEvents.length) {
        const nextEvent = { ...nextEvents[nextIndex] }
        nextEvent.transition = {
          ...(nextEvent.transition || {}),
          sourceEventId: newEventId,
        }
        nextEvents[nextIndex] = nextEvent
      }

      // Also ensure the new event's transition source points to the previous event
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

    // After reordering, make each event's sourceEventId point to the previous event in the list
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
      // Some browsers require data to be set for drag to start
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

  const deleteEventAt = (index) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return

    setEvents((prev) => {
      if (prev.length === 0 || index < 0 || index >= prev.length) return prev

      const next = [...prev]
      next.splice(index, 1)

      // Fix sourceEventId of the event that now sits at this index (the next event)
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
            ← Back
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
              />

              <button
                type="button"
                className="between-plus-btn"
                onClick={() => insertEventAt(index)}
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
      </main>
    </>
  )
}

function SidebarMenu() {
  const location = useLocation()

  return (
    <div className="sidebar-menu">
      <nav className="sidebar-nav">
        <Link
          to="/"
          className={`sidebar-nav-item ${location.pathname === '/' ? 'active' : ''}`}
        >
          <span className="nav-icon">🏠</span>
          <span>Home</span>
        </Link>
      </nav>
    </div>
  )
}

function App() {
  return (
    <div className="app-container">
      <div className="app-root">
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/edit-story/:storyId" element={<CreateStoryView />} />
          <Route path="/create-story" element={<CreateStoryView />} />
        </Routes>
      </div>
      <SidebarMenu />
    </div>
  )
}

export default App
