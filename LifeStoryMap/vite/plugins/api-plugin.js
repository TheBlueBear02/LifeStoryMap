import fs from 'fs'
import { imagesDir, audioDir, storiesDataDir } from '../utils/paths.js'
import { storiesApiMiddleware } from '../middleware/stories-api.js'
import { exampleStoriesApiMiddleware } from '../middleware/example-stories-api.js'
import { eventsApiMiddleware } from '../middleware/events-api.js'
import { uploadApiMiddleware } from '../middleware/upload-api.js'
import { imagesStaticMiddleware, audioStaticMiddleware } from '../middleware/static-files.js'

/**
 * Main API plugin that sets up all middleware
 */
export const createApiPlugin = (env) => {
  return {
    name: 'events-and-upload-api',
    configureServer(server) {
      // Ensure directories exist
      fs.promises.mkdir(imagesDir, { recursive: true }).catch(() => {})
      fs.promises.mkdir(audioDir, { recursive: true }).catch(() => {})
      fs.promises.mkdir(storiesDataDir, { recursive: true }).catch(() => {})

      // Inject ElevenLabs token into request for audio generation
      const elevenLabsToken = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY
      
      // Add token to request object for middleware to access
      server.middlewares.use((req, res, next) => {
        req.elevenLabsToken = elevenLabsToken
        next()
      })

      // Stories CRUD API
      server.middlewares.use('/api/stories', storiesApiMiddleware)

      // Example stories API
      server.middlewares.use('/api/example-stories', exampleStoriesApiMiddleware)

      // Legacy events API
      server.middlewares.use('/api/events', eventsApiMiddleware)

      // Image upload API
      server.middlewares.use('/api/upload-image', uploadApiMiddleware)

      // Static file serving
      server.middlewares.use('/stories/images', imagesStaticMiddleware)
      server.middlewares.use('/stories/audio', audioStaticMiddleware)
    },
  }
}

