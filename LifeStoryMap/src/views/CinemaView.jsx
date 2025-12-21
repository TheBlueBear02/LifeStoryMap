import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStoryData } from '../hooks/useStoryData.js'
import { formatDateRange } from '../utils/dateUtils.js'
import { getMainMedia } from '../utils/imageUtils.js'
import { getAudioUrl, hasAudio } from '../services/audioService.js'
import '../styles/cinema-view.css'

function CinemaView({ onEventsChange, onActiveEventIndexChange, onMapCameraChange }) {
  const navigate = useNavigate()
  const { storyId } = useParams()
  const [currentEventIndex, setCurrentEventIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioElementRef = useRef(null)

  // Use custom hooks
  const { loading, story, events } = useStoryData(storyId)

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

  // Handle audio playback
  useEffect(() => {
    if (!activeEvent) {
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        setIsPlaying(false)
      }
      return
    }

    const audioUrl = getAudioUrl(activeEvent)
    if (!audioUrl) {
      setIsPlaying(false)
      // Auto-advance to next event if no audio after 2 seconds
      const nextIndex = currentEventIndex + 1
      if (nextIndex < events.length) {
        const timeout = setTimeout(() => {
          goToEventIndex(nextIndex)
        }, 2000)
        return () => clearTimeout(timeout)
      } else {
        // End of story, exit cinema mode
        const timeout = setTimeout(() => {
          navigate(`/view-story/${storyId}`)
        }, 2000)
        return () => clearTimeout(timeout)
      }
    }

    // Create or update audio element
    let audio = audioElementRef.current
    if (!audio) {
      audio = new Audio()
      audioElementRef.current = audio
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        // Auto-advance to next event
        const nextIndex = currentEventIndex + 1
        if (nextIndex < events.length) {
          goToEventIndex(nextIndex)
        } else {
          // End of story, exit cinema mode
          navigate(`/view-story/${storyId}`)
        }
      })

      audio.addEventListener('play', () => setIsPlaying(true))
      audio.addEventListener('pause', () => setIsPlaying(false))
      audio.addEventListener('error', () => {
        setIsPlaying(false)
        console.error('Audio playback error')
        // Try to advance to next event on error
        const nextIndex = currentEventIndex + 1
        if (nextIndex < events.length) {
          setTimeout(() => goToEventIndex(nextIndex), 1000)
        }
      })
    }

    // Update audio source if changed
    if (audio.src !== audioUrl) {
      audio.src = audioUrl
    }

    // Play audio
    audio.play().catch((err) => {
      console.error('Failed to play audio:', err)
      setIsPlaying(false)
      // Try to advance to next event on play error
      const nextIndex = currentEventIndex + 1
      if (nextIndex < events.length) {
        setTimeout(() => goToEventIndex(nextIndex), 1000)
      }
    })

    return () => {
      if (audio) {
        audio.pause()
      }
    }
  }, [activeEvent, currentEventIndex, events.length, storyId, navigate])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current = null
      }
    }
  }, [])

  const handleExit = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause()
    }
    navigate(`/view-story/${storyId}`)
  }

  if (loading) {
    return (
      <div className="cinema-view-loading">
        <div className="cinema-view-loading-content">
          <p>Loading story...</p>
        </div>
      </div>
    )
  }

  if (!activeEvent) {
    return (
      <div className="cinema-view-loading">
        <div className="cinema-view-loading-content">
          <p>No events yet.</p>
          {storyTitle ? <p className="cinema-view-story-name">{storyTitle}</p> : null}
          <button type="button" className="cinema-view-exit-btn" onClick={handleExit}>
            Exit Cinema Mode
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="cinema-view" dir="rtl">
      <div className="cinema-view-content">
        <button
          type="button"
          className="cinema-view-close"
          onClick={handleExit}
          aria-label="Exit Cinema Mode"
        >
          ×
        </button>
        
        <div className="cinema-view-event">
          <h2 className="cinema-view-title">{eventTitle || 'שם האירוע'}</h2>
          {!isSpecialEvent && (
            <div className="cinema-view-date">{formattedDate || 'תאריך מלא'}</div>
          )}
          {media.oldUrl && (
            <figure className="cinema-view-media">
              <img className="cinema-view-image" src={media.oldUrl} alt="" />
              {media.caption && (
                <figcaption className="cinema-view-caption">{media.caption}</figcaption>
              )}
            </figure>
          )}
          <div className="cinema-view-text">{eventText || 'טקסט מלא על האירוע'}</div>
          {hasAudio(activeEvent) && (
            <div className="cinema-view-audio-indicator">
              {isPlaying ? '🔊 Playing...' : '🔇 Ready'}
            </div>
          )}
        </div>
        
        <div className="cinema-view-progress">
          <div className="cinema-view-progress-bar">
            <div 
              className="cinema-view-progress-fill"
              style={{ 
                width: `${((currentEventIndex + 1) / events.length) * 100}%` 
              }}
            />
          </div>
          <div className="cinema-view-progress-text">
            {currentEventIndex + 1} / {events.length}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CinemaView

