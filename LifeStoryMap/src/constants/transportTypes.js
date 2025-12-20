// Transport type definitions
export const TRANSPORT_TYPES = {
  WALKING: 'walking',
  CAR: 'car',
  TRAIN: 'train',
  AIRPLANE: 'airplane',
  HORSE: 'horse',
}

export const TRANSPORT_TYPE_OPTIONS = [
  { value: TRANSPORT_TYPES.WALKING, label: 'Walking', icon: '🚶' },
  { value: TRANSPORT_TYPES.CAR, label: 'Car', icon: '🚗' },
  { value: TRANSPORT_TYPES.TRAIN, label: 'Train', icon: '🚂' },
  { value: TRANSPORT_TYPES.AIRPLANE, label: 'Airplane', icon: '✈️' },
  { value: TRANSPORT_TYPES.HORSE, label: 'Horse', icon: '🐴' },
]

export const DEFAULT_TRANSPORT_TYPE = TRANSPORT_TYPES.AIRPLANE

