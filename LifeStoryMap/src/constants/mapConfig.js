// Map configuration constants
export const MAP_CONFIG = {
  DEFAULT_CENTER: [34.7818, 32.0853], // Tel Aviv as neutral starting point
  DEFAULT_ZOOM: 3,
  DEFAULT_PITCH: 0,
  DEFAULT_BEARING: 0,
  DEFAULT_STYLE: 'mapbox://styles/mapbox/streets-v12',
  PROJECTION: 'mercator',
}

// Map layer IDs
export const LAYER_IDS = {
  EVENT_PATH_SOLID: 'event-path-solid',
  EVENT_PATH_DASHED: 'event-path-dashed',
  EVENT_PATH_DOTTED: 'event-path-dotted',
  EVENT_PATH_GOLDEN_AGE: 'event-path-golden-age',
  EVENT_PATH_MEMORY_TRAIL: 'event-path-memory-trail',
  EVENT_PATH_IMPORTANT_JUMP: 'event-path-important-jump',
  EVENT_OVERVIEW_PATH_DASHED: 'event-overview-path-dashed',
  EVENT_TRANSITION_LINE: 'event-transition-line',
}

// Map source IDs
export const SOURCE_IDS = {
  EVENT_PATH: 'event-path',
  EVENT_OVERVIEW_PATH: 'event-overview-path',
  EVENT_TRANSITION: 'event-transition',
}

// Path style keys
export const PATH_STYLE_KEYS = {
  SOLID: '',
  DASHED: 'Dashed',
  DOTTED: 'Dotted',
  GOLDEN_AGE: 'GoldenAgePath',
  MEMORY_TRAIL: 'MemoryTrail',
  IMPORTANT_JUMP: 'ImportantJump',
}

// Path layer configurations
export const PATH_LAYERS = [
  {
    id: LAYER_IDS.EVENT_PATH_SOLID,
    filter: ['!in', 'styleKey', PATH_STYLE_KEYS.DASHED, PATH_STYLE_KEYS.DOTTED, PATH_STYLE_KEYS.GOLDEN_AGE, PATH_STYLE_KEYS.MEMORY_TRAIL, PATH_STYLE_KEYS.IMPORTANT_JUMP],
    paint: {
      'line-color': '#3b82f6',
      'line-width': 6,
      'line-opacity': 0.8,
    },
  },
  {
    id: LAYER_IDS.EVENT_PATH_DASHED,
    filter: ['==', 'styleKey', PATH_STYLE_KEYS.DASHED],
    paint: {
      'line-color': '#3b82f6',
      'line-width': 6,
      'line-opacity': 0.8,
      'line-dasharray': [2, 2],
    },
  },
  {
    id: LAYER_IDS.EVENT_PATH_DOTTED,
    filter: ['==', 'styleKey', PATH_STYLE_KEYS.DOTTED],
    paint: {
      'line-color': '#3b82f6',
      'line-width': 6,
      'line-opacity': 0.8,
      'line-dasharray': [0.6, 1.6],
    },
  },
  {
    id: LAYER_IDS.EVENT_PATH_GOLDEN_AGE,
    filter: ['==', 'styleKey', PATH_STYLE_KEYS.GOLDEN_AGE],
    paint: {
      'line-color': '#f59e0b',
      'line-width': 6,
      'line-opacity': 0.85,
      'line-dasharray': [2.5, 1.5],
    },
  },
  {
    id: LAYER_IDS.EVENT_PATH_MEMORY_TRAIL,
    filter: ['==', 'styleKey', PATH_STYLE_KEYS.MEMORY_TRAIL],
    paint: {
      'line-color': '#a855f7',
      'line-width': 6,
      'line-opacity': 0.85,
      'line-dasharray': [0.6, 1.6],
    },
  },
  {
    id: LAYER_IDS.EVENT_PATH_IMPORTANT_JUMP,
    filter: ['==', 'styleKey', PATH_STYLE_KEYS.IMPORTANT_JUMP],
    paint: {
      'line-color': '#ef4444',
      'line-width': 6,
      'line-opacity': 0.9,
      'line-dasharray': [4, 2],
    },
  },
]

// Marker colors
export const MARKER_COLORS = {
  ACTIVE: '#1d4ed8',
  INACTIVE: '#6b7280',
  PICKING: '#1d4ed8',
}

// Animation configuration
export const ANIMATION_CONFIG = {
  MIN_DURATION_MS: 4000,
  MAX_DURATION_MS: 13000,
  BASE_DURATION_MS: 3000,
  DISTANCE_FACTOR: 500, // km per duration unit
  ZOOM_OUT_END: 0.25,
  MOVE_END: 0.75,
}

