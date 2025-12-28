import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// From vite/utils/paths.js, we need to go up to LifeStoryMap, then up to root, then into data
// So: ../../.. goes to root, then /data/stories/...
export const eventsFilePath = path.resolve(__dirname, '../../../data/stories/events/events.json')
export const imagesDir = path.resolve(__dirname, '../../../data/stories/images')
export const audioDir = path.resolve(__dirname, '../../../data/stories/audio')
export const storiesFilePath = path.resolve(__dirname, '../../../data/stories/stories.json')
export const storiesDataDir = path.resolve(__dirname, '../../../data/stories')
export const exampleStoriesFilePath = path.resolve(__dirname, '../../../data/stories/example-stories.json')

