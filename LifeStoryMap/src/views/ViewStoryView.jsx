import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EventTimeline from '../components/EventTimeline'
import '../styles/view-story-view.css'
import '../styles/view-story-view-mobile.css'

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
  
  // Card state management for mobile
  const [cardState, setCardState] = useState('closed') // 'closed' | 'open'
  const cardDragRef = useRef(null)
  const cardDragStartYRef = useRef(0)
  const cardDragStartStateRef = useRef('closed')
  const isDraggingCardRef = useRef(false)

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
  }

  useEffect(() => {
    // Reset the compare slider when switching events.
    setRevealPct(50)
    // Reset card to closed state when switching events
    setCardState('closed')
  }, [currentEventIndex])

  // Prevent pull-to-refresh globally when card is open
  useEffect(() => {
    // Add/remove class to html/body to prevent pull-to-refresh
    if (cardState === 'open') {
      document.documentElement.classList.add('view-story-card-open')
      document.body.classList.add('view-story-card-open')
    } else {
      document.documentElement.classList.remove('view-story-card-open')
      document.body.classList.remove('view-story-card-open')
    }

    const preventPullToRefresh = (e) => {
      // If we're dragging the card, always prevent
      if (isDraggingCardRef.current) {
        e.preventDefault()
        e.stopPropagation()
        return true
      }

      const cardEl = cardDragRef.current
      if (!cardEl) return false

      const touch = e.touches?.[0] || e.changedTouches?.[0]
      if (!touch) return false

      const cardRect = cardEl.getBoundingClientRect()
      const touchY = touch.clientY
      const scrollTop = cardEl.scrollTop

      // Only prevent pull-to-refresh if:
      // 1. Touching within the card area
      // 2. At the very top of scroll (within 5px)
      // 3. Touching very near the top edge (within 60px from top)
      const isInCard = touchY >= cardRect.top && touchY <= cardRect.bottom
      const isAtTop = scrollTop <= 5
      const isNearTopEdge = touchY <= cardRect.top + 60

      if (isInCard && isAtTop && isNearTopEdge) {
        e.preventDefault()
        e.stopPropagation()
        return true
      }
      return false
    }

    // Prevent on document level with capture phase to catch early
    const handleTouchMove = (e) => {
      if (cardState === 'open' && !isDraggingCardRef.current) {
        // Only prevent if we're not dragging the card
        const prevented = preventPullToRefresh(e)
        if (prevented) {
          e.stopImmediatePropagation()
        }
      }
    }

    const handleTouchStart = (e) => {
      // Don't prevent on touchstart to allow drag handlers to work
      // The drag handlers will prevent if needed
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true })

    return () => {
      document.documentElement.classList.remove('view-story-card-open')
      document.body.classList.remove('view-story-card-open')
      document.removeEventListener('touchmove', handleTouchMove, { capture: true })
      document.removeEventListener('touchstart', handleTouchStart, { capture: true })
    }
  }, [cardState])

  // Card drag handlers
  const handleCardTouchStart = (e) => {
    if (e.touches.length !== 1) return
    
    // Check if touch is on a navigation button or within navigation area
    const target = e.target
    const isNavButton = target.closest('.view-story-nav-btn') || target.closest('.view-story-bottom-nav')
    if (isNavButton) {
      // Don't interfere with button clicks
      isDraggingCardRef.current = false
      return
    }
    
    const cardEl = cardDragRef.current
    if (!cardEl) return
    
    const touch = e.touches[0]
    const touchY = touch.clientY
    const cardRect = cardEl.getBoundingClientRect()
    const handleRect = cardEl.querySelector('.view-story-card-handle')?.getBoundingClientRect()
    
    // Check if touch is on the handle
    const isOnHandle = handleRect && 
      touchY >= handleRect.top && 
      touchY <= handleRect.bottom &&
      touch.clientX >= handleRect.left &&
      touch.clientX <= handleRect.right
    
    const scrollTop = cardEl.scrollTop
    
    // More permissive drag activation:
    // 1. Always allow drag from handle
    // 2. Always allow drag when card is closed (to open)
    // 3. When card is open, allow drag from anywhere if at top of scroll (within 10px)
    //    This makes it easy to close the card by dragging down from anywhere
    const isAtTop = scrollTop <= 10
    
    if (isOnHandle || cardState !== 'open' || (cardState === 'open' && isAtTop)) {
      isDraggingCardRef.current = true
      cardDragStartYRef.current = touchY
      cardDragStartStateRef.current = cardState
      // Prevent default to ensure drag works reliably
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      return false
    } else {
      // Allow normal scrolling - don't interfere
      isDraggingCardRef.current = false
    }
  }

  const handleCardTouchMove = (e) => {
    if (!isDraggingCardRef.current || e.touches.length !== 1) return
    
    // Check if touch is on a navigation button or within navigation area
    const target = e.target
    const isNavButton = target.closest('.view-story-nav-btn') || target.closest('.view-story-bottom-nav')
    if (isNavButton) {
      // Cancel drag if touching navigation area
      isDraggingCardRef.current = false
      const cardEl = cardDragRef.current
      if (cardEl) {
        cardEl.classList.remove('is-dragging')
        cardEl.style.removeProperty('--drag-height')
      }
      return
    }
    
    const cardEl = cardDragRef.current
    if (!cardEl) return
    
    const currentY = e.touches[0].clientY
    const deltaY = currentY - cardDragStartYRef.current // Positive = dragging down
    const absDeltaY = Math.abs(deltaY)
    
    // If card is open, check if user is actually scrolling (not dragging)
    if (cardState === 'open' && cardDragStartStateRef.current === 'open') {
      const scrollTop = cardEl.scrollTop
      const scrollHeight = cardEl.scrollHeight
      const clientHeight = cardEl.clientHeight
      const canScroll = scrollHeight > clientHeight
      
      // If there's scrollable content and we're not at the very top, allow scrolling
      if (canScroll && scrollTop > 10) {
        // User is scrolling, not dragging - cancel drag
        isDraggingCardRef.current = false
        cardEl.classList.remove('is-dragging')
        cardEl.style.removeProperty('--drag-height')
        return
      }
      
      // If at top, be more permissive - allow dragging down (to close) with smaller threshold
      if (scrollTop <= 10) {
        // If dragging down (positive deltaY), allow it immediately - user wants to close
        if (deltaY > 0) {
          // Dragging down to close - proceed with drag
        } else if (absDeltaY < 10) {
          // Very small movement - might be scroll attempt, but allow if dragging down
          if (deltaY <= 0) {
            // Dragging up or no movement - cancel drag to allow scrolling
            isDraggingCardRef.current = false
            cardEl.classList.remove('is-dragging')
            cardEl.style.removeProperty('--drag-height')
            return
          }
        }
      }
    }
    
    // We're definitely dragging - proceed with drag logic
    const dragDeltaY = cardDragStartYRef.current - currentY // Positive = dragging up
    
    const viewportHeight = window.innerHeight
    const states = ['closed', 'open']
    const stateHeights = {
      closed: 0.15, // 15% of viewport
      open: 0.9, // 90% of viewport
    }
    
    const startStateIndex = states.indexOf(cardDragStartStateRef.current)
    const startHeight = stateHeights[cardDragStartStateRef.current] * viewportHeight
    // When dragging up (dragDeltaY positive), increase height; when dragging down (dragDeltaY negative), decrease height
    const newHeight = Math.max(
      stateHeights.closed * viewportHeight,
      Math.min(
        stateHeights.open * viewportHeight,
        startHeight + dragDeltaY
      )
    )
    
    // Update card position during drag
    const heightPercent = (newHeight / viewportHeight) * 100
    cardEl.style.setProperty('--drag-height', `${heightPercent}%`)
    cardEl.classList.add('is-dragging')
    
    // Aggressively prevent all default behaviors
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    return false
  }

  const handleCardTouchEnd = (e) => {
    if (!isDraggingCardRef.current) return
    
    // Check if touch ended on a navigation button or within navigation area
    const target = e.target
    const isNavButton = target.closest('.view-story-nav-btn') || target.closest('.view-story-bottom-nav')
    if (isNavButton) {
      // Don't interfere with button clicks - let the click event fire
      isDraggingCardRef.current = false
      const cardEl = cardDragRef.current
      if (cardEl) {
        cardEl.classList.remove('is-dragging')
        cardEl.style.removeProperty('--drag-height')
      }
      return
    }
    
    const cardEl = cardDragRef.current
    if (!cardEl) {
      isDraggingCardRef.current = false
      return
    }
    
    const currentY = e.changedTouches?.[0]?.clientY || cardDragStartYRef.current
    const deltaY = cardDragStartYRef.current - currentY
    const viewportHeight = window.innerHeight
    
    // Determine snap threshold (25% of viewport height - lower threshold for easier closing)
    const snapThreshold = viewportHeight * 0.25
    
    const states = ['closed', 'open']
    const currentStateIndex = states.indexOf(cardDragStartStateRef.current)
    
    let nextState = cardDragStartStateRef.current
    
    // If dragging down (deltaY < 0) and card is open, use lower threshold to make closing easier
    const isDraggingDown = deltaY < 0
    const effectiveThreshold = (cardDragStartStateRef.current === 'open' && isDraggingDown) 
      ? viewportHeight * 0.15  // Lower threshold (15%) when trying to close
      : snapThreshold
    
    if (Math.abs(deltaY) > effectiveThreshold) {
      // Significant drag - move to adjacent state
      if (deltaY > 0 && currentStateIndex < states.length - 1) {
        // Dragging up - go to next state
        nextState = states[currentStateIndex + 1]
      } else if (deltaY < 0 && currentStateIndex > 0) {
        // Dragging down - go to previous state
        nextState = states[currentStateIndex - 1]
      }
    } else if (cardDragStartStateRef.current === 'open' && isDraggingDown && Math.abs(deltaY) > 20) {
      // Even small downward movements when open should close if user is clearly dragging down
      nextState = 'closed'
    }
    
    // Clean up drag styles
    cardEl.classList.remove('is-dragging')
    cardEl.style.removeProperty('--drag-height')
    
    setCardState(nextState)
    isDraggingCardRef.current = false
    
    // Aggressively prevent any default behavior
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    return false
  }

  const handleCardTouchCancel = (e) => {
    const cardEl = cardDragRef.current
    if (cardEl) {
      cardEl.classList.remove('is-dragging')
      cardEl.style.removeProperty('--drag-height')
    }
    isDraggingCardRef.current = false
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
  }



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

  // Determine what content to show based on card state
  const showDate = cardState === 'open'
  const showImage = cardState === 'open'
  const showText = cardState === 'open'
  const showNavButtons = cardState === 'closed'

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

      {/* Mobile event card overlay */}
      {!loading && activeEvent ? (
        <article 
          ref={cardDragRef}
          className={`view-story-card-mobile view-story-card-mobile-${cardState}`}
          aria-label="Story event"
          onTouchStart={handleCardTouchStart}
          onTouchMove={handleCardTouchMove}
          onTouchEnd={handleCardTouchEnd}
          onTouchCancel={handleCardTouchCancel}
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
                  onClick={() => goToEventIndex(currentEventIndex + 1)}
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

