import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EventTimeline from '../components/EventTimeline'
import { useStoryData } from '../hooks/useStoryData.js'
import { useImageComparison } from '../hooks/useImageComparison.js'
import { formatDateRange } from '../utils/dateUtils.js'
import { getMainMedia } from '../utils/imageUtils.js'
import { calculateDistanceKm } from '../utils/mapUtils.js'
import { getAudioUrl } from '../services/audioService.js'
import { parseTextIntoWords, matchWordsWithTimestamps } from '../utils/textUtils.js'
import '../styles/view-story-view.css'
import '../styles/view-story-view-mobile.css'
import '../styles/cinema-view.css'
import '../styles/cinema-view-mobile.css'

function CinemaView({ onEventsChange, onActiveEventIndexChange, onMapCameraChange }) {
  const navigate = useNavigate()
  const { storyId } = useParams()
  const [currentEventIndex, setCurrentEventIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const autoAdvanceTimeoutRef = useRef(null)
  const cameraAnimationTimeoutRef = useRef(null)
  const lastEventIndexRef = useRef(null)
  const timerIntervalRef = useRef(null)
  const audioRef = useRef(null)
  const lastAudioEventIdRef = useRef(null)
  const [currentWordIndex, setCurrentWordIndex] = useState(-1)
  const wordHighlightIntervalRef = useRef(null)
  const wordsWithTimestampsRef = useRef([])

  // Use custom hooks
  const { loading, story, events } = useStoryData(storyId)
  const imageComparison = useImageComparison({
    resetOnChange: true,
    resetDependency: currentEventIndex,
  })

  // Calculate animation duration based on distance between events
  const calculateAnimationDuration = (fromEvent, toEvent) => {
    const fromCoords = fromEvent?.location?.coordinates
    const toCoords = toEvent?.location?.coordinates
    
    if (!fromCoords || !toCoords || 
        fromCoords.lng == null || fromCoords.lat == null ||
        toCoords.lng == null || toCoords.lat == null) {
      // Default duration if coordinates are missing
      return 2000
    }

    const from = [fromCoords.lng, fromCoords.lat]
    const to = [toCoords.lng, toCoords.lat]
    const distanceKm = calculateDistanceKm(from, to)

    // Map distance to duration: short hops are quick (but at least 4s), long jumps are slower.
    // Clamp final duration strictly to the 4–13s range (same logic as MapView.jsx)
    const secondsFromDistance = 3 + Math.min(9, (distanceKm / 500) * 9) // base 3s, up to 12s for very long jumps
    const durationMs = Math.max(4000, Math.min(13000, secondsFromDistance * 1000))
    
    return durationMs
  }

  // Helper function to advance to next event
  const advanceToNextEvent = () => {
    // Use current state value, not closure value
    setCurrentEventIndex((currentIdx) => {
      const nextIndex = currentIdx + 1
      if (nextIndex < events.length) {
        const currentEvent = events[currentIdx] || null
        // Handle special Opening event behavior - jump to first real event
        if (currentEvent?.eventType === 'Opening') {
          const firstRealIndex = Array.isArray(events)
            ? events.findIndex((ev) => {
                if (!ev || ev.eventType === 'Opening' || ev.eventType === 'Closing') return false
                const coords = ev?.location?.coordinates
                return coords?.lng != null && coords?.lat != null
              })
            : -1

          const targetIndex = firstRealIndex >= 0 ? firstRealIndex : nextIndex
          const clamped = Math.max(0, Math.min(events.length - 1, targetIndex))
          onActiveEventIndexChange?.(clamped)

          // Update map camera for the new event
          const targetEvent = events[clamped]
          const coords = targetEvent?.location?.coordinates
          if (coords?.lng != null && coords?.lat != null && onMapCameraChange) {
            const zoomRaw = targetEvent?.location?.mapView?.zoom
            const zoom = typeof zoomRaw === 'number' ? zoomRaw : 12
            // Calculate animation duration based on distance
            const animationDuration = calculateAnimationDuration(currentEvent, targetEvent)
            onMapCameraChange({
              center: [coords.lng, coords.lat],
              zoom,
              pitch: 0,
              bearing: 0,
              durationMs: animationDuration,
            })
          }
          return clamped
        } else {
          // Normal advance to next event
          const clamped = Math.max(0, Math.min(events.length - 1, nextIndex))
          onActiveEventIndexChange?.(clamped)

          // Update map camera for the new event
          const nextEvent = events[clamped]
          const coords = nextEvent?.location?.coordinates
          if (nextEvent?.eventType !== 'Opening' && coords?.lng != null && coords?.lat != null && onMapCameraChange) {
            const zoomRaw = nextEvent?.location?.mapView?.zoom
            const zoom = typeof zoomRaw === 'number' ? zoomRaw : 10
            // Calculate animation duration based on distance
            const animationDuration = calculateAnimationDuration(currentEvent, nextEvent)
            onMapCameraChange({
              center: [coords.lng, coords.lat],
              zoom,
              pitch: 0,
              bearing: 0,
              durationMs: animationDuration,
            })
          }
          return clamped
        }
      } else {
        // End of story, exit cinema mode
        navigate('/')
        return currentIdx
      }
    })
  }

  // Start the timer after camera animation completes
  // The timer duration is 5 seconds (display time after animation completes)
  const startAutoAdvanceTimer = (totalDurationMs) => {
    // Clear any existing timeout and interval
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current)
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }

    // Set initial time remaining
    setTimeRemaining(totalDurationMs)

    // Update timer every 100ms for smooth animation
    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = Math.max(0, prev - 100)
        if (newTime === 0) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current)
            timerIntervalRef.current = null
          }
        }
        return newTime
      })
    }, 100)

    // Auto-advance to next event after total duration
    autoAdvanceTimeoutRef.current = setTimeout(() => {
      advanceToNextEvent()
    }, totalDurationMs)
  }

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
      lastEventIndexRef.current = nextActiveIndex

      const first = events[0]
      const coords = first?.location?.coordinates
      if (first?.eventType !== 'Opening' && coords?.lng != null && coords?.lat != null && onMapCameraChange) {
        const zoomRaw = first?.location?.mapView?.zoom
        const zoom = typeof zoomRaw === 'number' ? zoomRaw : 10
        
        // Calculate animation duration based on distance to next event
        let cameraAnimationDuration = 2000 // Default fallback
        if (events.length > 1) {
          const nextEvent = events[1]
          cameraAnimationDuration = calculateAnimationDuration(first, nextEvent)
        }
        
        onMapCameraChange({
          center: [coords.lng, coords.lat],
          zoom,
          pitch: 0,
          bearing: 0,
          durationMs: cameraAnimationDuration,
        })
        // Wait for initial camera animation before starting timer
        if (cameraAnimationTimeoutRef.current) {
          clearTimeout(cameraAnimationTimeoutRef.current)
        }
        const displayDuration = 5000 // 5 seconds display time per event
        const totalDuration = cameraAnimationDuration + displayDuration
        cameraAnimationTimeoutRef.current = setTimeout(() => {
          startAutoAdvanceTimer(displayDuration)
        }, cameraAnimationDuration)
      } else {
        // No camera change needed, start timer immediately
        startAutoAdvanceTimer()
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

  const goToEventIndex = (nextIndex) => {
    if (!Array.isArray(events) || events.length === 0) return
    const clamped = Math.max(0, Math.min(events.length - 1, nextIndex))
    setCurrentEventIndex(clamped)
    onActiveEventIndexChange?.(clamped)
  }

  const activeEvent = events[currentEventIndex] || null
  const isSpecialEvent = activeEvent?.eventType === 'Opening' || activeEvent?.eventType === 'Closing'
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

  const clampPct = (n) => Math.max(0, Math.min(100, n))

  // Parse text into words with timestamps for highlighting
  const wordsWithTimestamps = useMemo(() => {
    if (!eventText) return []
    const words = parseTextIntoWords(eventText)
    const wordTimestamps = activeEvent?.content?.wordTimestamps || []
    const matched = matchWordsWithTimestamps(words, wordTimestamps)
    // Update ref so event listeners can access current value
    wordsWithTimestampsRef.current = matched
    return matched
  }, [eventText, activeEvent])

  // Determine text direction based on story language
  const textDirection = useMemo(() => {
    const storyLanguage = story?.language || 'en'
    return storyLanguage === 'he' ? 'rtl' : 'ltr'
  }, [story])

  // Render text with word highlighting
  const renderTextWithHighlighting = () => {
    if (!eventText) {
      const defaultText = textDirection === 'rtl' ? 'טקסט מלא על האירוע' : 'Full text about the event'
      return <div className="view-story-text" style={{ direction: textDirection }}>{defaultText}</div>
    }

    return (
      <div className="view-story-text" style={{ direction: textDirection }}>
        {wordsWithTimestamps.map((wordObj, index) => {
          const isHighlighted = index === currentWordIndex
          const className = isHighlighted ? 'word-highlighted' : ''
          // Add space after word if it's not punctuation and not the last word
          const needsSpace = !wordObj.isPunctuation && index < wordsWithTimestamps.length - 1
          return (
            <span key={index} className={className} data-word-index={index}>
              {wordObj.word}{needsSpace ? ' ' : ''}
            </span>
          )
        })}
      </div>
    )
  }

  const textContent = (
    <div className="view-story-scroll-area">
      {renderTextWithHighlighting()}
    </div>
  )

  // Handle audio playback when event changes
  useEffect(() => {
    if (!activeEvent || !audioRef.current) {
      return
    }

    const currentEventId = activeEvent.eventId
    const isNewEvent = lastAudioEventIdRef.current !== currentEventId

    if (isNewEvent) {
      // Stop and reset any currently playing audio
      const audio = audioRef.current
      audio.pause()
      audio.currentTime = 0
      audio.src = ''

      // Clear word highlighting
      setCurrentWordIndex(-1)
      if (wordHighlightIntervalRef.current) {
        clearInterval(wordHighlightIntervalRef.current)
        wordHighlightIntervalRef.current = null
      }

      // Get audio URL for the current event
      const audioUrl = getAudioUrl(activeEvent)
      
      if (audioUrl) {
        // Set the audio source and play
        audio.src = audioUrl
        
        // Set up word highlighting based on audio playback
        const setupWordHighlighting = () => {
          if (wordHighlightIntervalRef.current) {
            clearInterval(wordHighlightIntervalRef.current)
          }

          // Get current words from ref (always up-to-date)
          const currentWords = wordsWithTimestampsRef.current
          
          // Check if we have word timestamps
          if (!currentWords || currentWords.length === 0) {
            return
          }
          
          // Check if any words have timestamps
          const hasTimestamps = currentWords.some(w => w.start != null && w.end != null)
          if (!hasTimestamps) {
            return
          }

          // Update word highlighting based on current audio time
          wordHighlightIntervalRef.current = setInterval(() => {
            if (!audioRef.current) return
            
            const currentTimeMs = audioRef.current.currentTime * 1000 // Convert to milliseconds
            
            // Get fresh words from ref
            const words = wordsWithTimestampsRef.current
            
            // Find the word currently being spoken
            let highlightedIndex = -1
            for (let i = 0; i < words.length; i++) {
              const wordObj = words[i]
              if (wordObj.start != null && wordObj.end != null) {
                if (currentTimeMs >= wordObj.start && currentTimeMs < wordObj.end) {
                  highlightedIndex = i
                  break
                }
              }
            }
            
            // Also check if we're past the last word (highlight last word)
            if (highlightedIndex === -1 && words.length > 0) {
              const lastWord = words[words.length - 1]
              if (lastWord.end != null && currentTimeMs >= lastWord.end) {
                highlightedIndex = words.length - 1
              }
            }
            
            setCurrentWordIndex(highlightedIndex)
          }, 50) // Update every 50ms for smooth highlighting
        }

        // Start highlighting when audio starts playing
        audio.addEventListener('play', setupWordHighlighting, { once: true })
        
        // Stop highlighting when audio ends
        audio.addEventListener('ended', () => {
          if (wordHighlightIntervalRef.current) {
            clearInterval(wordHighlightIntervalRef.current)
            wordHighlightIntervalRef.current = null
          }
          setCurrentWordIndex(-1)
        })

        audio.play().catch((error) => {
          // Handle autoplay restrictions (browsers may block autoplay)
          console.warn('Audio autoplay was prevented:', error)
        })
      }

      // Update the last event ID we played audio for
      lastAudioEventIdRef.current = currentEventId
    }
  }, [activeEvent, currentEventIndex])

  // Handle camera changes and start timer after animation completes
  useEffect(() => {
    if (!activeEvent) {
      return
    }

    // Check if this is a new event (not just a re-render)
    const isNewEvent = lastEventIndexRef.current !== currentEventIndex
    lastEventIndexRef.current = currentEventIndex

    if (isNewEvent) {
      // Clear any existing timeouts and reset timer
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current)
        autoAdvanceTimeoutRef.current = null
      }
      if (cameraAnimationTimeoutRef.current) {
        clearTimeout(cameraAnimationTimeoutRef.current)
        cameraAnimationTimeoutRef.current = null
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      setTimeRemaining(0)

      // Check if this event needs a camera change
      const needsCameraChange = activeEvent?.eventType !== 'Opening' && 
                                 activeEvent?.location?.coordinates?.lng != null && 
                                 activeEvent?.location?.coordinates?.lat != null

      if (needsCameraChange && onMapCameraChange) {
        // Calculate animation duration based on distance to next event
        const nextIndex = currentEventIndex + 1
        let cameraAnimationDuration = 2000 // Default fallback
        
        if (nextIndex < events.length) {
          const nextEvent = events[nextIndex]
          // Calculate distance-based animation duration
          cameraAnimationDuration = calculateAnimationDuration(activeEvent, nextEvent)
        } else {
          // Last event - use default duration
          cameraAnimationDuration = 2000
        }
        
        // Wait for camera animation to complete, then start the 5-second timer
        const displayDuration = 5000 // 5 seconds display time per event
        cameraAnimationTimeoutRef.current = setTimeout(() => {
          startAutoAdvanceTimer(displayDuration)
        }, cameraAnimationDuration)
      } else {
        // No camera change needed, start timer immediately
        startAutoAdvanceTimer()
      }
    }

    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current)
        autoAdvanceTimeoutRef.current = null
      }
      if (cameraAnimationTimeoutRef.current) {
        clearTimeout(cameraAnimationTimeoutRef.current)
        cameraAnimationTimeoutRef.current = null
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [activeEvent, currentEventIndex, events, navigate, onActiveEventIndexChange, onMapCameraChange])

  // Cleanup timeouts and audio on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current)
        autoAdvanceTimeoutRef.current = null
      }
      if (cameraAnimationTimeoutRef.current) {
        clearTimeout(cameraAnimationTimeoutRef.current)
        cameraAnimationTimeoutRef.current = null
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      if (wordHighlightIntervalRef.current) {
        clearInterval(wordHighlightIntervalRef.current)
        wordHighlightIntervalRef.current = null
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  const handleExit = () => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current)
      autoAdvanceTimeoutRef.current = null
    }
    if (cameraAnimationTimeoutRef.current) {
      clearTimeout(cameraAnimationTimeoutRef.current)
      cameraAnimationTimeoutRef.current = null
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    if (wordHighlightIntervalRef.current) {
      clearInterval(wordHighlightIntervalRef.current)
      wordHighlightIntervalRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    navigate('/')
  }

  if (loading) {
    return (
      <div className="view-story-view" dir="rtl">
        <div className="empty-state">
          <p>Loading story...</p>
        </div>
      </div>
    )
  }

  if (!activeEvent) {
    return (
      <div className="view-story-view" dir="rtl">
        <div className="empty-state">
          <p>No events yet.</p>
          {storyTitle ? <p className="view-story-story-name">{storyTitle}</p> : null}
          <button type="button" className="cinema-view-exit-btn" onClick={handleExit}>
            Exit Cinema Mode
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="view-story-view cinema-view-overlay" dir="rtl">
      {/* Hidden audio element for auto-play */}
      <audio ref={audioRef} preload="auto" />
      
      {/* Fixed timeline at top */}
      {events.length > 0 ? (
        <div className="view-story-timeline-fixed">
          <EventTimeline events={events} currentEventIndex={currentEventIndex} />
        </div>
      ) : null}

      {/* Header with home button */}
      <header className="app-header view-story-header">
        <div className="header-top-row">
          <button type="button" className="cinema-view-exit-btn" onClick={handleExit} title="Home">
            
          </button>
        </div>
      </header>

      {/* Content area */}
      <div className="view-story-content">
        <article className="view-story-card" aria-label="Story event">
          <h2 className="view-story-title">{eventTitle || 'שם האירוע'}</h2>
          {!isSpecialEvent ? (
            <div className="view-story-date">{formattedDate || 'תאריך מלא'}</div>
          ) : null}

          {isSpecialEvent ? (
            <>
              {textContent}
              {media.oldUrl ? (
                <figure className="view-story-media">
                  {media.newUrl ? (
                    <div
                      ref={imageComparison.compareFrameRef}
                      className="view-story-image-frame view-story-compare"
                    >
                      <img className="view-story-image" src={media.oldUrl} alt="" />
                      <div
                        className="view-story-compare-new"
                        style={{ clipPath: `inset(0 0 0 ${clampPct(imageComparison.revealPct)}%)` }}
                        aria-hidden="true"
                      >
                        <img className="view-story-image" src={media.newUrl} alt="" />
                      </div>
                      <div
                        className="view-story-compare-divider"
                        style={{ left: `${clampPct(imageComparison.revealPct)}%` }}
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        className="view-story-compare-handle"
                        style={{ left: `${imageComparison.revealPct}%` }}
                        aria-label="Move to compare images"
                        {...imageComparison.handlers}
                      >
                        <span className="view-story-compare-handle-icon" aria-hidden="true">
                          ↔
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="view-story-image-frame">
                      <img className="view-story-image" src={media.oldUrl} alt="" />
                      <div className="view-story-image-hint" aria-hidden="true">
                        ↔
                      </div>
                    </div>
                  )}

                  {media.caption ? (
                    <figcaption className="view-story-caption">{media.caption}</figcaption>
                  ) : null}
                </figure>
              ) : null}
            </>
          ) : (
            <>
              {media.oldUrl ? (
                <figure className="view-story-media">
                  {media.newUrl ? (
                    <div
                      ref={imageComparison.compareFrameRef}
                      className="view-story-image-frame view-story-compare"
                    >
                      <img className="view-story-image" src={media.oldUrl} alt="" />
                      <div
                        className="view-story-compare-new"
                        style={{ clipPath: `inset(0 0 0 ${clampPct(imageComparison.revealPct)}%)` }}
                        aria-hidden="true"
                      >
                        <img className="view-story-image" src={media.newUrl} alt="" />
                      </div>
                      <div
                        className="view-story-compare-divider"
                        style={{ left: `${clampPct(imageComparison.revealPct)}%` }}
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        className="view-story-compare-handle"
                        style={{ left: `${imageComparison.revealPct}%` }}
                        aria-label="Move to compare images"
                        {...imageComparison.handlers}
                      >
                        <span className="view-story-compare-handle-icon" aria-hidden="true">
                          ↔
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="view-story-image-frame">
                      <img className="view-story-image" src={media.oldUrl} alt="" />
                      <div className="view-story-image-hint" aria-hidden="true">
                        ↔
                      </div>
                    </div>
                  )}

                  {media.caption ? (
                    <figcaption className="view-story-caption">{media.caption}</figcaption>
                  ) : null}
                </figure>
              ) : null}

              {textContent}
            </>
          )}

          {/* Timer indicator - anchored inside the card */}
          <div className="cinema-view-progress">
            <div className="cinema-view-timer-bar">
              <div
                className="cinema-view-timer-fill"
                style={{
                  width: `${Math.max(0, Math.min(100, (timeRemaining / 5000) * 100))}%`,
                }}
              />
            </div>
            <div className="cinema-view-progress-text">
              {timeRemaining > 0 ? `${(timeRemaining / 1000).toFixed(1)}s` : '0.0s'}
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}

export default CinemaView

