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
