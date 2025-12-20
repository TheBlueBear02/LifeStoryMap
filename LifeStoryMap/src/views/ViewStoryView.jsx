import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EventTimeline from '../components/EventTimeline'
import { useStoryData } from '../hooks/useStoryData.js'
import { useImageComparison } from '../hooks/useImageComparison.js'
import { useCardDrag } from '../hooks/useCardDrag.js'
import { formatDateRange } from '../utils/dateUtils.js'
import { getMainMedia } from '../utils/imageUtils.js'
import '../styles/view-story-view.css'
import '../styles/view-story-view-mobile.css'

function ViewStoryView({ onEventsChange, onActiveEventIndexChange, onMapCameraChange }) {
  const navigate = useNavigate()
  const { storyId } = useParams()
  const [currentEventIndex, setCurrentEventIndex] = useState(0)
  const openingToFirstZoomTimeoutRef = useRef(null)

  // Use custom hooks
  const { loading, story, events } = useStoryData(storyId)
  const imageComparison = useImageComparison({
    resetOnChange: true,
    resetDependency: currentEventIndex,
  })
  const cardDrag = useCardDrag({
    initialState: 'closed',
    resetOnChange: true,
    resetDependency: currentEventIndex,
  })

  // Update parent when events change
  useEffect(() => {
    if (onEventsChange) {
      onEventsChange(events)
    }
  }, [events, onEventsChange])

  // Set initial active event and camera
  useEffect(() => {
    if (events.length > 0) {
      const nextActiveIndex = 0
      setCurrentEventIndex(nextActiveIndex)
      onActiveEventIndexChange?.(nextActiveIndex)

      const first = events[0]
      // If the first card is a real event with a location, center on it.
      // If the first card is the Opening event (no location), MapView will auto-fit to all events.
      const coords = first?.location?.coordinates
      if (first?.eventType !== 'Opening' && coords?.lng != null && coords?.lat != null && onMapCameraChange) {
        const zoomRaw = first?.location?.mapView?.zoom
        const zoom = typeof zoomRaw === 'number' ? zoomRaw : 10
        onMapCameraChange({
          center: [coords.lng, coords.lat],
          zoom,
          pitch: 0,
          bearing: 0,
        })
      }
    } else {
      onActiveEventIndexChange?.(null)
    }
  }, [events.length, onActiveEventIndexChange, onMapCameraChange])

  useEffect(() => {
    // Keep index within bounds if events array changes.
    setCurrentEventIndex((prev) => {
      if (!Array.isArray(events) || events.length === 0) return 0
      if (prev < 0) return 0
      if (prev > events.length - 1) return events.length - 1
      return prev
    })
  }, [events])

  // Cleanup any pending Opening -> first event zoom step.
  useEffect(() => {
    return () => {
      if (openingToFirstZoomTimeoutRef.current != null) {
        clearTimeout(openingToFirstZoomTimeoutRef.current)
        openingToFirstZoomTimeoutRef.current = null
      }
    }
  }, [])

  const goToEventIndex = (nextIndex) => {
    if (!Array.isArray(events) || events.length === 0) return
    const clamped = Math.max(0, Math.min(events.length - 1, nextIndex))
    setCurrentEventIndex(clamped)
    onActiveEventIndexChange?.(clamped)
  }

  const clampPct = (n) => Math.max(0, Math.min(100, n))



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

  const goToNext = () => {
    if (!canGoNext) return

    // Special behavior: from Opening → jump to the first real event with coordinates and zoom in.
    if (activeEvent?.eventType === 'Opening') {
      const firstRealIndex = Array.isArray(events)
        ? events.findIndex((ev) => {
            if (!ev || ev.eventType === 'Opening' || ev.eventType === 'Closing') return false
            const coords = ev?.location?.coordinates
            return coords?.lng != null && coords?.lat != null
          })
        : -1

      const targetIndex = firstRealIndex >= 0 ? firstRealIndex : currentEventIndex + 1
      goToEventIndex(targetIndex)

      const targetEvent = events[targetIndex]
      const coords = targetEvent?.location?.coordinates
      if (coords?.lng != null && coords?.lat != null && onMapCameraChange) {
        // Cancel any previous pending zoom step.
        if (openingToFirstZoomTimeoutRef.current != null) {
          clearTimeout(openingToFirstZoomTimeoutRef.current)
          openingToFirstZoomTimeoutRef.current = null
        }

        const zoomRaw = targetEvent?.location?.mapView?.zoom
        const zoom = typeof zoomRaw === 'number' ? zoomRaw : 12

        // Two-step animation:
        // 1) Pan to the target (keep current zoom by omitting `zoom`)
        // 2) Zoom in once panning finishes
        const totalMs = 3600
        const panMs = 2200
        const zoomMs = Math.max(300, totalMs - panMs)

        onMapCameraChange({
          center: [coords.lng, coords.lat],
          pitch: 0,
          bearing: 0,
          durationMs: panMs,
        })

        openingToFirstZoomTimeoutRef.current = setTimeout(() => {
          try {
            onMapCameraChange({
              center: [coords.lng, coords.lat],
              zoom,
              pitch: 0,
              bearing: 0,
              durationMs: zoomMs,
            })
          } finally {
            openingToFirstZoomTimeoutRef.current = null
          }
        }, panMs + 50)
      }
      return
    }

    goToEventIndex(currentEventIndex + 1)
  }

  // Determine what content to show based on card state
  const showDate = cardDrag.cardState === 'open'
  const showImage = cardDrag.cardState === 'open'
  const showText = cardDrag.cardState === 'open'
  const showNavButtons = cardDrag.cardState === 'closed'

  return (
    <div className="view-story-view" dir="rtl">
      {/* Fixed timeline at top for mobile */}
      {!loading && events.length > 0 ? (
        <div className="view-story-timeline-fixed">
          <EventTimeline events={events} currentEventIndex={currentEventIndex} />
        </div>
      ) : null}

      {/* Header - hidden on mobile, shown on desktop */}
      <header className="app-header view-story-header">
        <div className="header-top-row">
          <button type="button" className="back-btn" onClick={() => navigate('/')} title="Back">
            <span aria-label="Back" role="img" style={{ marginRight: '0.4em' }}>←</span>back
          </button>
        </div>
      </header>

      {/* Desktop content area */}
      <div className="view-story-content">
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
                  <div ref={imageComparison.compareFrameRef} className="view-story-image-frame view-story-compare">
                    <img className="view-story-image" src={media.oldUrl} alt="" />
                    <div
                      className="view-story-compare-new"
                      style={{ clipPath: `inset(0 0 0 ${clampPct(imageComparison.revealPct)}%)` }}
                      aria-hidden="true"
                    >
                      <img className="view-story-image" src={media.newUrl} alt="" />
                    </div>
                    <div className="view-story-compare-divider" style={{ left: `${clampPct(imageComparison.revealPct)}%` }} aria-hidden="true" />
                    <button
                      type="button"
                      className="view-story-compare-handle"
                      style={{ left: `${imageComparison.revealPct}%` }}
                      aria-label="Move to compare images"
                      {...imageComparison.handlers}
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

      {/* Mobile event card overlay */}
      {!loading && activeEvent ? (
        <article 
          ref={cardDrag.cardDragRef}
          className={`view-story-card-mobile view-story-card-mobile-${cardDrag.cardState}`}
          aria-label="Story event"
          {...cardDrag.handlers}
        >
          {/* Drag handle */}
          <div className="view-story-card-handle" />
          
          {/* Title - always visible */}
          <h2 className="view-story-title">{eventTitle || 'שם האירוע'}</h2>
          
          {/* Date - visible when open */}
          {showDate && (
            <div className="view-story-date">{formattedDate || 'תאריך מלא'}</div>
          )}

          {/* Image - visible when open */}
          {showImage && media.oldUrl ? (
            <figure className="view-story-media">
              {media.newUrl ? (
                <div ref={imageComparison.compareFrameRef} className="view-story-image-frame view-story-compare">
                  <img className="view-story-image" src={media.oldUrl} alt="" />
                  <div
                    className="view-story-compare-new"
                    style={{ clipPath: `inset(0 0 0 ${clampPct(imageComparison.revealPct)}%)` }}
                    aria-hidden="true"
                  >
                    <img className="view-story-image" src={media.newUrl} alt="" />
                  </div>
                  <div className="view-story-compare-divider" style={{ left: `${clampPct(imageComparison.revealPct)}%` }} aria-hidden="true" />
                  <button
                    type="button"
                    className="view-story-compare-handle"
                    style={{ left: `${imageComparison.revealPct}%` }}
                    aria-label="Move to compare images"
                    {...imageComparison.handlers}
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

          {/* Text - only visible when fully open */}
          {showText && (
            <div className="view-story-text">{eventText || 'טקסט מלא על האירוע'}</div>
          )}

          {/* Navigation buttons - visible when closed */}
          {showNavButtons && (
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
                  onClick={goToNext}
                  disabled={!canGoNext}
                >
                  <span>Next Event</span>
                  <span className="next-arrow">←</span>
                </button>
              </div>
            </nav>
          )}
        </article>
      ) : null}

      {/* Desktop bottom nav */}
      {!loading && activeEvent ? (
        <nav className="view-story-bottom-nav view-story-bottom-nav-desktop" aria-label="Event navigation">
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
              onClick={goToNext}
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

