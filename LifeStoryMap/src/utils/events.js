export function generateNextEventId(events) {
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

export function createEmptyEvent(previousEventId) {
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
        // Start with no location; a pin should only appear after picking/searching.
        lat: null,
        lng: null,
      },
      mapView: {
        zoom: 10,
        pitch: 0,
        bearing: 0,
        mapStyle: 'mapbox://styles/mapbox/streets-v12',
      },
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

/**
 * Creates an Opening event (special event at the beginning of a story)
 * @returns {Object} Opening event object
 */
export function createOpeningEvent() {
  return {
    eventId: 'OPENING',
    eventType: 'Opening',
    title: 'Opening',
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

/**
 * Creates a Closing event (special event at the end of a story)
 * @returns {Object} Closing event object
 */
export function createClosingEvent() {
  return {
    eventId: 'CLOSING',
    eventType: 'Closing',
    title: 'Closing',
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

/**
 * Checks if an event is a special event (Opening or Closing)
 * @param {Object} event - Event object
 * @returns {boolean}
 */
export function isSpecialEvent(event) {
  return event?.eventType === 'Opening' || event?.eventType === 'Closing'
}

/**
 * Ensures Opening and Closing events are present in the events array
 * @param {Array} events - Array of events
 * @returns {Array} Events array with Opening and Closing events
 */
export function ensureSpecialEvents(events) {
  const filtered = events.filter((e) => !isSpecialEvent(e))
  const hasOpening = events.some((e) => e?.eventType === 'Opening')
  const hasClosing = events.some((e) => e?.eventType === 'Closing')

  const result = []
  if (!hasOpening) {
    result.push(createOpeningEvent())
  } else {
    const opening = events.find((e) => e?.eventType === 'Opening')
    if (opening) result.push(opening)
  }

  result.push(...filtered)

  if (!hasClosing) {
    result.push(createClosingEvent())
  } else {
    const closing = events.find((e) => e?.eventType === 'Closing')
    if (closing) result.push(closing)
  }

  return result
}
