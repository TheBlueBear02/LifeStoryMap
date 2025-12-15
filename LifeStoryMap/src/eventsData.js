// Initial events data, adapted from ../data/events.json (comments removed)
// In a real app this could be loaded from an API or external file.

export const initialEvents = [
  {
    eventId: 'E003',
    eventType: 'Period', // Event (point-in-time) or Period
    title: 'שירות צבאי והעלייה לארץ',
    timeline: {
      dateStart: '1960-07-01',
      dateEnd: '1962-12-31',
    },
    location: {
      name: 'תל אביב, נמל יפו',
      coordinates: {
        lat: 32.052,
        lng: 34.757,
      },
      mapView: {
        zoom: 15,
        pitch: 60,
        bearing: 45,
        mapStyle: 'mapbox://styles/mapbox/satellite-streets-v12',
      },
    },
    transition: {
      type: 'ArcFlyWithPoint',
      durationSeconds: 3,
      sourceEventId: 'E002',
      lineStyleKey: 'GoldenAgePath',
    },
    content: {
      textHtml:
        'כאן מתחילה תקופה חדשה. אחרי שירות צבאי קצר בסיביר, יוסף קיבל אישור עלייה והגיע לנמל יפו בסוף 1962.',
      media: [
        {
          type: 'image',
          url: 'uploaded:image.jpg-a02c8d80-61d3-48c2-b1a4-c6ce4ca803c9',
          caption: 'יוסף על סיפון האונייה המגיעה ליפו, דצמבר 1962',
          altText: 'תמונה היסטורית של עולים חדשים בנמל יפו',
        },
        {
          type: 'audio',
          url: 'tel-aviv-soundscape.mp3',
          autoplay: true,
          loop: true,
          volume: 0.5,
        },
      ],
      imageComparison: {
        enabled: true,
        caption: 'נמל יפו – אז והיום',
        urlOld: 'yfo-port-1962.jpg',
        urlNew: 'yfo-port-current.jpg',
      },
    },
  },
]


