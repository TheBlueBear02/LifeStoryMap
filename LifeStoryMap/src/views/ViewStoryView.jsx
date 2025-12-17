import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EventTimeline from '../components/EventTimeline'
import '../styles/view-story-view.css'

function normalizeFormDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return ''

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const year = match[1]
    const month = match[2]
    const day = match[3]
    return `${day}.${month}.${year}`
  }

  // Fallback: try to parse other date-like strings and normalize to DD.MM.YYYY.
  const parsed = new Date(dateStr)
  if (!Number.isFinite(parsed.getTime())) return ''
  const iso = parsed.toISOString().slice(0, 10) // YYYY-MM-DD
  const isoMatch = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!isoMatch) return ''
  return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`
}

function formatDateRange(dateStart, dateEnd) {
  const startText = normalizeFormDate(dateStart)
  const endText = normalizeFormDate(dateEnd)
  if (!startText) return ''
  if (!endText || endText === startText) return startText
  return `${startText} – ${endText}`
}

function getMainMedia(event) {
  const cmp = event?.content?.imageComparison
  const oldUrl = typeof cmp?.urlOld === 'string' ? cmp.urlOld : ''
  const newUrl = typeof cmp?.urlNew === 'string' ? cmp.urlNew : ''
  const caption = typeof cmp?.caption === 'string' ? cmp.caption : ''

  let mediaUrl = ''
  const media = event?.content?.media
  if (Array.isArray(media)) {
    const firstImage = media.find((m) => m && m.type === 'image' && typeof m.url === 'string' && m.url)
    mediaUrl = firstImage?.url || ''
  }

  return {
    oldUrl: oldUrl || mediaUrl,
    newUrl,
    caption,
  }
}

function ViewStoryView({ onEventsChange, onActiveEventIndexChange, onMapCameraChange }) {
  const navigate = useNavigate()
  const { storyId } = useParams()
  const [loading, setLoading] = useState(true)
  const [story, setStory] = useState(null)
  const [events, setEvents] = useState([])
  const [currentEventIndex, setCurrentEventIndex] = useState(0)
  const [revealPct, setRevealPct] = useState(50)
  const compareFrameRef = useRef(null)
  const draggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragMovedRef = useRef(false)
  const suppressClickRef = useRef(false)

  const clampPct = (n) => Math.max(0, Math.min(100, n))

  const setRevealFromClientX = (clientX) => {
    const el = compareFrameRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const width = rect.width || 1
    const next = ((clientX - rect.left) / width) * 100
    setRevealPct(clampPct(next))
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!storyId) {
        navigate('/')
        return
      }

      setLoading(true)
      try {
        const [storyRes, eventsRes] = await Promise.all([
          fetch(`/api/stories/${storyId}`),
          fetch(`/api/stories/${storyId}/events`),
        ])

        if (!storyRes.ok) throw new Error('Failed to load story')
        const storyJson = await storyRes.json()

        if (!eventsRes.ok) throw new Error('Failed to load events')
        const eventsJson = await eventsRes.json()

        if (cancelled) return

        const nextEvents = Array.isArray(eventsJson) ? eventsJson : []
        setStory(storyJson)
        setEvents(nextEvents)
        onEventsChange?.(nextEvents)

        const nextActiveIndex = nextEvents.length > 0 ? 0 : null
        setCurrentEventIndex(nextActiveIndex ?? 0)
        onActiveEventIndexChange?.(nextActiveIndex)

        const first = nextEvents[0]
        const coords = first?.location?.coordinates
        if (coords?.lng != null && coords?.lat != null && onMapCameraChange) {
          const zoomRaw = first?.location?.mapView?.zoom
          const zoom = typeof zoomRaw === 'number' ? zoomRaw : 10
          onMapCameraChange({
            center: [coords.lng, coords.lat],
            zoom,
            pitch: 0,
            bearing: 0,
          })
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err)
        setStory(null)
        setEvents([])
        setCurrentEventIndex(0)
        onEventsChange?.([])
        onActiveEventIndexChange?.(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [navigate, onActiveEventIndexChange, onEventsChange, onMapCameraChange, storyId])

  useEffect(() => {
    // Keep index within bounds if events array changes.
    setCurrentEventIndex((prev) => {
      if (!Array.isArray(events) || events.length === 0) return 0
      if (prev < 0) return 0
      if (prev > events.length - 1) return events.length - 1
      return prev
    })
  }, [events])

  const goToEventIndex = (nextIndex) => {
    if (!Array.isArray(events) || events.length === 0) return
    const clamped = Math.max(0, Math.min(events.length - 1, nextIndex))
    setCurrentEventIndex(clamped)
    onActiveEventIndexChange?.(clamped)

    const ev = events[clamped]
    const coords = ev?.location?.coordinates
    if (coords?.lng != null && coords?.lat != null && onMapCameraChange) {
      const zoomRaw = ev?.location?.mapView?.zoom
      const zoom = typeof zoomRaw === 'number' ? zoomRaw : 10
      onMapCameraChange({
        center: [coords.lng, coords.lat],
        zoom,
        pitch: 0,
        bearing: 0,
      })
    }
  }

  useEffect(() => {
    // Reset the compare slider when switching events.
    setRevealPct(50)
  }, [currentEventIndex])

  const activeEvent = events[currentEventIndex] || null
  const formattedDate = useMemo(() => {
    if (!activeEvent) return ''
    return formatDateRange(activeEvent?.timeline?.dateStart, activeEvent?.timeline?.dateEnd)
  }, [activeEvent])

  const media = useMemo(
    () => (activeEvent ? getMainMedia(activeEvent) : { oldUrl: '', newUrl: '', caption: '' }),
    [activeEvent],
  )

  const storyTitle = typeof story?.name === 'string' ? story.name : ''
  const eventTitle = typeof activeEvent?.title === 'string' ? activeEvent.title.trim() : ''
  const eventTextRaw = typeof activeEvent?.content?.textHtml === 'string' ? activeEvent.content.textHtml : ''
  const eventText = eventTextRaw.trim()
  const canGoPrev = currentEventIndex > 0
  const canGoNext = Array.isArray(events) && currentEventIndex < events.length - 1

  return (
    <div className="view-story-view" dir="rtl">
      <header className="app-header view-story-header">
        <div className="header-top-row">
          <button type="button" className="back-btn" onClick={() => navigate('/')} title="Back">
            <span aria-label="Back" role="img" style={{ marginRight: '0.4em' }}>←</span>back
          </button>
        </div>
      </header>

      <div className="view-story-content">
        {!loading && events.length > 0 ? (
          <EventTimeline events={events} currentEventIndex={currentEventIndex} />
        ) : null}
        {loading ? (
          <div className="empty-state">
            <p>Loading story...</p>
          </div>
        ) : !activeEvent ? (
          <div className="empty-state">
            <p>No events yet.</p>
            {storyTitle ? <p className="view-story-story-name">{storyTitle}</p> : null}
          </div>
        ) : (
          <article className="view-story-card" aria-label="Story event">
            <h2 className="view-story-title">{eventTitle || 'שם האירוע'}</h2>
            <div className="view-story-date">{formattedDate || 'תאריך מלא'}</div>

            {media.oldUrl ? (
              <figure className="view-story-media">
                {media.newUrl ? (
                  <div ref={compareFrameRef} className="view-story-image-frame view-story-compare">
                    <img className="view-story-image" src={media.oldUrl} alt="" />
                    <div
                      className="view-story-compare-new"
                      style={{ clipPath: `inset(0 0 0 ${clampPct(revealPct)}%)` }}
                      aria-hidden="true"
                    >
                      <img className="view-story-image" src={media.newUrl} alt="" />
                    </div>
                    <div className="view-story-compare-divider" style={{ left: `${clampPct(revealPct)}%` }} aria-hidden="true" />
                    <button
                      type="button"
                      className="view-story-compare-handle"
                      style={{ left: `${revealPct}%` }}
                      aria-label="Move to compare images"
                      onPointerDown={(e) => {
                        draggingRef.current = true
                        dragMovedRef.current = false
                        suppressClickRef.current = false
                        dragStartXRef.current = e.clientX
                        e.currentTarget.setPointerCapture?.(e.pointerId)
                        setRevealFromClientX(e.clientX)
                        // Prevent text selection and reduce "ghost click" behavior.
                        e.preventDefault()
                      }}
                      onPointerMove={(e) => {
                        if (!draggingRef.current) return
                        if (Math.abs(e.clientX - dragStartXRef.current) > 3) {
                          dragMovedRef.current = true
                        }
                        setRevealFromClientX(e.clientX)
                        e.preventDefault()
                      }}
                      onPointerUp={(e) => {
                        draggingRef.current = false
                        e.currentTarget.releasePointerCapture?.(e.pointerId)
                        setRevealFromClientX(e.clientX)
                        // Browsers fire a click after pointerup; suppress it if this was a drag.
                        if (dragMovedRef.current) {
                          suppressClickRef.current = true
                          setTimeout(() => {
                            suppressClickRef.current = false
                          }, 0)
                        }
                        e.preventDefault()
                      }}
                      onPointerCancel={() => {
                        draggingRef.current = false
                      }}
                      onClick={(e) => {
                        if (suppressClickRef.current) {
                          e.preventDefault()
                          return
                        }
                        // Quick toggle between the two images (only on true click, not drag).
                        setRevealPct((prev) => (prev >= 50 ? 0 : 100))
                      }}
                    >
                      ↔
                    </button>
                  </div>
                ) : (
                  <div className="view-story-image-frame">
                    <img className="view-story-image" src={media.oldUrl} alt="" />
                    <div className="view-story-image-hint" aria-hidden="true">↔</div>
                  </div>
                )}

                {media.caption ? <figcaption className="view-story-caption">{media.caption}</figcaption> : null}
              </figure>
            ) : null}

            <div className="view-story-text">{eventText || 'טקסט מלא על האירוע'}</div>
          </article>
        )}
      </div>

      {!loading && activeEvent ? (
        <nav className="view-story-bottom-nav" aria-label="Event navigation">
          <div className="view-story-bottom-nav-inner">
            <button
              type="button"
              className="view-story-nav-btn back"
              onClick={() => goToEventIndex(currentEventIndex - 1)}
              disabled={!canGoPrev}
            >
              back
            </button>
            <button
              type="button"
              className="view-story-nav-btn next"
              onClick={() => goToEventIndex(currentEventIndex + 1)}
              disabled={!canGoNext}
            >
              <span>Next Event</span>
              <span className="next-arrow">←</span>
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  )
}

export default ViewStoryView

