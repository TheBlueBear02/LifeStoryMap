import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/event-timeline.css'

function extractYear(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const match = dateStr.match(/^(\d{4})/)
  return match ? match[1] : null
}

function EventTimeline({ events, currentEventIndex }) {
  const prevIndexRef = useRef(currentEventIndex)
  const [direction, setDirection] = useState('forward')
  const [animToken, setAnimToken] = useState(0)

  useEffect(() => {
    const prev = prevIndexRef.current
    if (currentEventIndex !== prev) {
      setDirection(currentEventIndex > prev ? 'forward' : 'backward')
      setAnimToken((t) => t + 1)
      prevIndexRef.current = currentEventIndex
    }
  }, [currentEventIndex])

  const model = useMemo(() => {
    const list = Array.isArray(events) ? events : []
    const currentEvent = list[currentEventIndex] || null
    const currentYear = currentEvent ? extractYear(currentEvent?.timeline?.dateStart) : null

    // Keep the year capsule fixed in the middle.
    // Map to 9 logical slots (0..8). Middle is slot 4.
    const capsuleSlot = 4

    const upcoming = Array.from({ length: 4 }, (_, i) => {
      const offset = i + 1
      const idx = currentEventIndex + offset
      const ev = idx >= 0 && idx < list.length ? list[idx] : null
      return {
        kind: 'upcoming',
        offset,
        slot: capsuleSlot - offset,
        hasEvent: Boolean(ev),
        year: ev ? extractYear(ev?.timeline?.dateStart) : null,
        index: idx,
      }
    })

    const past = Array.from({ length: 4 }, (_, i) => {
      const offset = i + 1
      const idx = currentEventIndex - offset
      const ev = idx >= 0 && idx < list.length ? list[idx] : null
      return {
        kind: 'past',
        offset,
        slot: capsuleSlot + offset,
        hasEvent: Boolean(ev),
        year: ev ? extractYear(ev?.timeline?.dateStart) : null,
        index: idx,
      }
    })

    return {
      hasCurrent: Boolean(currentEvent),
      currentYear,
      capsuleSlot,
      upcoming,
      past,
    }
  }, [events, currentEventIndex])

  if (!model.hasCurrent) return null

  return (
    <div className="event-timeline" dir="ltr">
      <div className="event-timeline-container" aria-label="Event timeline">
        <div className="event-timeline-track" aria-hidden="true">
          {/* Real event dots (keyed by event index so they animate between slots) */}
          {model.upcoming
            .filter((x) => x.hasEvent)
            .map((item) => (
              <div
                key={`ev-${item.index}`}
                className="timeline-item timeline-circle timeline-upcoming has-event"
                style={{ '--slot': item.slot }}
              />
            ))}
          {model.past
            .filter((x) => x.hasEvent)
            .map((item) => (
              <div
                key={`ev-${item.index}`}
                className="timeline-item timeline-circle timeline-past has-event"
                style={{ '--slot': item.slot }}
              />
            ))}

          {/* Placeholder dots (always keep 4 slots on each side) */}
          {model.upcoming
            .filter((x) => !x.hasEvent)
            .map((item) => (
              <div
                key={`empty-u-${item.offset}`}
                className="timeline-item timeline-circle timeline-upcoming empty"
                style={{ '--slot': item.slot }}
              />
            ))}
          {model.past
            .filter((x) => !x.hasEvent)
            .map((item) => (
              <div
                key={`empty-p-${item.offset}`}
                className="timeline-item timeline-circle timeline-past empty"
                style={{ '--slot': item.slot }}
              />
            ))}

          <div
            key={animToken}
            className={`timeline-item timeline-capsule ${direction === 'forward' ? 'anim-forward' : 'anim-backward'}`}
            style={{ '--slot': model.capsuleSlot }}
          >
            <span className="timeline-capsule-text">{model.currentYear || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EventTimeline
