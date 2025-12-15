import { useEffect, useState } from 'react'
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
        labelOld: '',
        urlOld: '',
        labelNew: '',
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
        <div>
          <div className="event-block-id-type">
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
          <input
            className="event-title-input"
            type="text"
            placeholder="Event title"
            value={event.title || ''}
            onChange={(e) => handleInputChange(['title'], e.target.value)}
          />
          <div className="event-summary-row">
            <span className="event-dates">
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
            </span>
          </div>
          <input
            className="event-location-input"
            type="text"
            placeholder="Location name"
            value={event.location?.name || ''}
            onChange={(e) => handleInputChange(['location', 'name'], e.target.value)}
          />
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
            {isExpanded ? 'Hide details' : 'Show details'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="event-details">
          <div className="event-details-section">
            <h3>Time</h3>
            {isPeriod ? (
              <>
                <label>
                  Start date
                  <input
                    type="date"
                    value={event.timeline?.dateStart || ''}
                    onChange={(e) => handleInputChange(['timeline', 'dateStart'], e.target.value)}
                  />
                </label>
                <label>
                  End date
                  <input
                    type="date"
                    value={event.timeline?.dateEnd || ''}
                    onChange={(e) => handleInputChange(['timeline', 'dateEnd'], e.target.value)}
                  />
                </label>
              </>
            ) : (
              <label>
                Date
                <input
                  type="date"
                  value={event.timeline?.dateStart || ''}
                  onChange={(e) => handleInputChange(['timeline', 'dateStart'], e.target.value)}
                />
              </label>
            )}
          </div>

          <div className="event-details-section">
            <h3>Location</h3>
            <label>
              Name
              <input
                type="text"
                value={event.location?.name || ''}
                onChange={(e) => handleInputChange(['location', 'name'], e.target.value)}
              />
            </label>
            <div className="coords-row">
              <label>
                Lat
                <input
                  type="number"
                  step="0.0001"
                  value={event.location?.coordinates?.lat ?? ''}
                  onChange={(e) =>
                    handleInputChange(
                      ['location', 'coordinates', 'lat'],
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Lng
                <input
                  type="number"
                  step="0.0001"
                  value={event.location?.coordinates?.lng ?? ''}
                  onChange={(e) =>
                    handleInputChange(
                      ['location', 'coordinates', 'lng'],
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                />
              </label>
            </div>
          </div>

          <div className="event-details-section">
            <h3>Transition</h3>
            <label>
              Type
              <input
                type="text"
                value={event.transition?.type || ''}
                onChange={(e) => handleInputChange(['transition', 'type'], e.target.value)}
              />
            </label>
            <label>
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
              Source event ID
              <input
                type="text"
                value={event.transition?.sourceEventId || ''}
                onChange={(e) => handleInputChange(['transition', 'sourceEventId'], e.target.value)}
              />
            </label>
            <label>
              Line style key
              <input
                type="text"
                value={event.transition?.lineStyleKey || ''}
                onChange={(e) => handleInputChange(['transition', 'lineStyleKey'], e.target.value)}
              />
            </label>
          </div>

          <div className="event-details-section">
            <h3>Content</h3>
            <label>
              Text (HTML)
              <textarea
                value={event.content?.textHtml || ''}
                onChange={(e) => handleInputChange(['content', 'textHtml'], e.target.value)}
              />
            </label>
            <label className="image-comparison-toggle">
              <input
                type="checkbox"
                checked={Boolean(event.content?.imageComparison?.enabled)}
                onChange={(e) =>
                  handleInputChange(['content', 'imageComparison', 'enabled'], e.target.checked)
                }
              />
              Enable image comparison
            </label>
            {event.content?.imageComparison?.enabled && (
              <div className="image-comparison-grid">
                <div>
                  <label>
                    Old label
                    <input
                      type="text"
                      value={event.content.imageComparison.labelOld || ''}
                      onChange={(e) =>
                        handleInputChange(
                          ['content', 'imageComparison', 'labelOld'],
                          e.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    Old URL
                    <input
                      type="text"
                      value={event.content.imageComparison.urlOld || ''}
                      onChange={(e) =>
                        handleInputChange(
                          ['content', 'imageComparison', 'urlOld'],
                          e.target.value,
                        )
                      }
                    />
                  </label>
                </div>
                <div>
                  <label>
                    New label
                    <input
                      type="text"
                      value={event.content.imageComparison.labelNew || ''}
                      onChange={(e) =>
                        handleInputChange(
                          ['content', 'imageComparison', 'labelNew'],
                          e.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    New URL
                    <input
                      type="text"
                      value={event.content.imageComparison.urlNew || ''}
                      onChange={(e) =>
                        handleInputChange(
                          ['content', 'imageComparison', 'urlNew'],
                          e.target.value,
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

function App() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const [expandedIndexes, setExpandedIndexes] = useState(new Set())
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/events')
        if (!res.ok) throw new Error('Failed to load events')
        const data = await res.json()
        const initialEvents = Array.isArray(data) ? data : []
        setEvents(initialEvents)
        setIsDirty(false)
      } catch (err) {
        console.error(err)
        setEvents([])
      } finally {
        setLoading(false)
      }
    }

    loadEvents()
  }, [])

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
    if (!Array.isArray(events)) return
    try {
      setSaveStatus('saving')
      const res = await fetch('/api/events', {
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
    <div className="app-root">
      <header className="app-header">
        <div>
          <h1>Create New Story</h1>
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
            <div key={event.eventId || index} className="events-list-item">
              <EventBlock
                event={event}
                index={index}
                isExpanded={expandedIndexes.has(index)}
                onToggleExpand={toggleExpand}
                onChangeField={updateEventField}
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
    </div>
  )
}

export default App
