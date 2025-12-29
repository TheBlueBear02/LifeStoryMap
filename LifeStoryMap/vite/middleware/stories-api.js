import fs from 'fs'
import path from 'path'
import { storiesFilePath, storiesDataDir, imagesDir, audioDir } from '../utils/paths.js'
import { stripHtml } from '../utils/html-utils.js'
import { generateAudioForStory, getDefaultVoiceId } from '../utils/audio-generation.js'

/**
 * Helper to read request body
 */
const readBody = (req) => {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      resolve(body)
    })
  })
}

/**
 * Stories CRUD API middleware
 */
export const storiesApiMiddleware = async (req, res, next) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const pathParts = url.pathname.replace(/^\/api\/stories\/?/, '').split('/').filter(Boolean)
  const storyId = pathParts[0]
  const action = pathParts[1]

  // GET /api/stories - get all stories
  if (req.method === 'GET' && !storyId) {
    try {
      console.log('Reading stories from:', storiesFilePath)
      let stories = []
      try {
        const json = await fs.promises.readFile(storiesFilePath, 'utf8')
        stories = JSON.parse(json)
        console.log('Successfully loaded', stories.length, 'stories')
      } catch (err) {
        console.error('Error reading stories file:', err.message)
        console.error('File path:', storiesFilePath)
        stories = []
      }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(stories))
    } catch (err) {
      console.error('Error reading stories.json', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to read stories.json' }))
    }
    return
  }

  // GET /api/stories/:id - get single story
  if (req.method === 'GET' && storyId && !action) {
    try {
      const json = await fs.promises.readFile(storiesFilePath, 'utf8')
      const stories = JSON.parse(json)
      const story = stories.find((s) => s.id === storyId)
      if (!story) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Story not found' }))
        return
      }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(story))
    } catch (err) {
      console.error('Error reading story', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to read story' }))
    }
    return
  }

  // GET /api/stories/:id/events - get events for a story
  if (req.method === 'GET' && storyId && action === 'events') {
    try {
      const json = await fs.promises.readFile(storiesFilePath, 'utf8')
      const stories = JSON.parse(json)
      const story = stories.find((s) => s.id === storyId)
      if (!story) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Story not found' }))
        return
      }
      const eventsFile = path.resolve(storiesDataDir, story.eventsFilePath)
      const eventsJson = await fs.promises.readFile(eventsFile, 'utf8')
      res.setHeader('Content-Type', 'application/json')
      res.end(eventsJson)
    } catch (err) {
      console.error('Error reading story events', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to read story events' }))
    }
    return
  }

  // PUT /api/stories/:id/events - save events for a story
  if (req.method === 'PUT' && storyId && action === 'events') {
    try {
      const body = await readBody(req)
      try {
        const json = await fs.promises.readFile(storiesFilePath, 'utf8')
        const stories = JSON.parse(json)
        const story = stories.find((s) => s.id === storyId)
        if (!story) {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Story not found' }))
          return
        }
        const parsed = JSON.parse(body)
        const eventCount = Array.isArray(parsed) ? parsed.length : 0
        const eventsFile = path.resolve(storiesDataDir, story.eventsFilePath)
        const formatted = JSON.stringify(parsed, null, 2)
        await fs.promises.writeFile(eventsFile, formatted, 'utf8')
        
        // Update event count in story
        story.eventCount = eventCount
        await fs.promises.writeFile(storiesFilePath, JSON.stringify(stories, null, 2), 'utf8')
        
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      } catch (err) {
        console.error('Error writing story events', err)
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'Failed to write story events' }))
      }
    } catch (err) {
      console.error('Error handling PUT /api/stories/:id/events', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to handle request' }))
    }
    return
  }

  // POST /api/stories - create new story
  if (req.method === 'POST' && !storyId) {
    try {
      const body = await readBody(req)
      try {
        const json = await fs.promises.readFile(storiesFilePath, 'utf8')
        const stories = JSON.parse(json)
        
        // Check max 5 stories
        if (stories.length >= 5) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Maximum of 5 stories allowed' }))
          return
        }

        const { name, language } = JSON.parse(body || '{}')
        if (!name || typeof name !== 'string') {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Story name is required' }))
          return
        }

        // Validate language code (default to 'en' if not provided or invalid)
        const validLanguages = ['en', 'he']
        const storyLanguage = validLanguages.includes(language) ? language : 'en'

        const newId = `story-${Date.now()}`
        const eventsFileName = `events-${newId}.json`
        const eventsFilePath = path.join(storiesDataDir, 'events', eventsFileName)
        
        // Ensure events directory exists
        await fs.promises.mkdir(path.dirname(eventsFilePath), { recursive: true })
        
        // Create initial events with Opening and Closing events
        const initialEvents = [
          {
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
          },
          {
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
          },
        ]
        await fs.promises.writeFile(eventsFilePath, JSON.stringify(initialEvents, null, 2), 'utf8')

        const newStory = {
          id: newId,
          name: name.trim(),
          language: storyLanguage,
          voiceId: getDefaultVoiceId(storyLanguage),
          eventsFilePath: `events/${eventsFileName}`,
          dateCreated: new Date().toISOString(),
          eventCount: 2, // Opening and Closing events
          published: false,
        }

        stories.push(newStory)
        await fs.promises.writeFile(storiesFilePath, JSON.stringify(stories, null, 2), 'utf8')
        
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(newStory))
      } catch (err) {
        console.error('Error creating story', err)
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'Failed to create story' }))
      }
    } catch (err) {
      console.error('Error handling POST /api/stories', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to handle request' }))
    }
    return
  }

  // PUT /api/stories/:id - update story
  if (req.method === 'PUT' && storyId && !action) {
    try {
      const body = await readBody(req)
      try {
        const json = await fs.promises.readFile(storiesFilePath, 'utf8')
        const stories = JSON.parse(json)
        const storyIndex = stories.findIndex((s) => s.id === storyId)
        if (storyIndex === -1) {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Story not found' }))
          return
        }

        const updates = JSON.parse(body || '{}')
        stories[storyIndex] = { ...stories[storyIndex], ...updates }
        await fs.promises.writeFile(storiesFilePath, JSON.stringify(stories, null, 2), 'utf8')
        
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(stories[storyIndex]))
      } catch (err) {
        console.error('Error updating story', err)
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'Failed to update story' }))
      }
    } catch (err) {
      console.error('Error handling PUT /api/stories/:id', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to handle request' }))
    }
    return
  }

  // DELETE /api/stories/:id - delete story
  if (req.method === 'DELETE' && storyId && !action) {
    try {
      const json = await fs.promises.readFile(storiesFilePath, 'utf8')
      const stories = JSON.parse(json)
      const storyIndex = stories.findIndex((s) => s.id === storyId)
      if (storyIndex === -1) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Story not found' }))
        return
      }

      const story = stories[storyIndex]
      
      // Delete the events file if it exists
      try {
        const eventsFile = path.resolve(storiesDataDir, story.eventsFilePath)
        await fs.promises.unlink(eventsFile)
      } catch (err) {
        console.log('Events file not found or already deleted:', err.message)
      }

      // Remove story from array
      stories.splice(storyIndex, 1)
      await fs.promises.writeFile(storiesFilePath, JSON.stringify(stories, null, 2), 'utf8')
      
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      console.error('Error deleting story', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to delete story' }))
    }
    return
  }

  // POST /api/stories/:id/generate-audio - generate audio files for events
  if (req.method === 'POST' && storyId && action === 'generate-audio') {
    try {
      const json = await fs.promises.readFile(storiesFilePath, 'utf8')
      const stories = JSON.parse(json)
      const story = stories.find((s) => s.id === storyId)
      if (!story) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Story not found' }))
        return
      }

      const eventsFile = path.resolve(storiesDataDir, story.eventsFilePath)
      const eventsJson = await fs.promises.readFile(eventsFile, 'utf8')
      const events = JSON.parse(eventsJson)

      // Get token from env (passed from plugin)
      const elevenLabsToken = req.elevenLabsToken
      if (!elevenLabsToken) {
        console.error('ELEVENLABS_API_KEY not found in environment variables')
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'ElevenLabs API token not configured. Please check your .env file.' }))
        return
      }

      const result = await generateAudioForStory(story, events, elevenLabsToken, stripHtml)

      // If there was a critical error, return it immediately
      if (result.criticalError) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ 
          error: result.criticalError.message,
          eventId: result.criticalError.eventId,
          critical: true,
        }))
        return
      }

      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ 
        ok: true, 
        generated: result.generatedFiles.length,
        files: result.generatedFiles,
        errors: result.errors.length > 0 ? result.errors : undefined,
      }))
    } catch (err) {
      console.error('Error generating audio', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to generate audio' }))
    }
    return
  }

  // DELETE /api/stories/:id/audio - delete all audio files for a story
  if (req.method === 'DELETE' && storyId && action === 'audio' && pathParts.length === 2) {
    try {
      const json = await fs.promises.readFile(storiesFilePath, 'utf8')
      const stories = JSON.parse(json)
      const story = stories.find((s) => s.id === storyId)
      if (!story) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Story not found' }))
        return
      }

      const eventsFile = path.resolve(storiesDataDir, story.eventsFilePath)
      const eventsJson = await fs.promises.readFile(eventsFile, 'utf8')
      const events = JSON.parse(eventsJson)

      let deletedCount = 0
      let hasUpdates = false

      // Delete all audio files and remove audioUrl from events
      for (let i = 0; i < events.length; i++) {
        const event = events[i]
        const audioUrl = event?.content?.audioUrl

        if (audioUrl) {
          // Extract path from audioUrl (e.g., /stories/audio/filename.mp3 or /stories/audio/{storyId}/filename.mp3)
          // Remove /stories/audio/ prefix to get the relative path
          const audioPath = audioUrl.replace(/^\/stories\/audio\//, '')
          const audioFilePath = path.join(audioDir, audioPath)

          // Delete the audio file from filesystem
          try {
            await fs.promises.unlink(audioFilePath)
            deletedCount++
            console.log(`Deleted audio file: ${audioPath}`)
          } catch (err) {
            console.log('Audio file not found or already deleted:', err.message)
            // Continue even if file doesn't exist
          }

          // Remove audioUrl from event - explicitly update the events array
          if (event.content && event.content.audioUrl) {
            delete event.content.audioUrl
            events[i] = event // Explicitly update the array
            hasUpdates = true
            console.log(`Removed audioUrl from event ${event.eventId || i}`)
          }
        }
      }

      // Save updated events if any changes were made
      if (hasUpdates) {
        const formatted = JSON.stringify(events, null, 2)
        await fs.promises.writeFile(eventsFile, formatted, 'utf8')
        console.log(`Saved updated events file: ${eventsFile}`)
      } else {
        console.log('No audio URLs found to remove')
      }

      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true, deleted: deletedCount }))
    } catch (err) {
      console.error('Error deleting all audio files', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to delete all audio files' }))
    }
    return
  }

  // DELETE /api/stories/:id/audio/:eventId - delete audio file for an event
  if (req.method === 'DELETE' && storyId && action === 'audio') {
    try {
      const eventId = pathParts[2] // Get eventId from path
      if (!eventId) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Event ID is required' }))
        return
      }

      const json = await fs.promises.readFile(storiesFilePath, 'utf8')
      const stories = JSON.parse(json)
      const story = stories.find((s) => s.id === storyId)
      if (!story) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Story not found' }))
        return
      }

      const eventsFile = path.resolve(storiesDataDir, story.eventsFilePath)
      const eventsJson = await fs.promises.readFile(eventsFile, 'utf8')
      const events = JSON.parse(eventsJson)

      // Find the event
      const eventIndex = events.findIndex((e) => e.eventId === eventId)
      if (eventIndex === -1) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Event not found' }))
        return
      }

      const event = events[eventIndex]
      const audioUrl = event?.content?.audioUrl

      if (!audioUrl) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Audio file not found for this event' }))
        return
      }

      // Extract path from audioUrl (e.g., /stories/audio/filename.mp3 or /stories/audio/{storyId}/filename.mp3)
      // Remove /stories/audio/ prefix to get the relative path
      const audioPath = audioUrl.replace(/^\/stories\/audio\//, '')
      const audioFilePath = path.join(audioDir, audioPath)

      // Delete the audio file from filesystem
      try {
        await fs.promises.unlink(audioFilePath)
      } catch (err) {
        console.log('Audio file not found or already deleted:', err.message)
        // Continue even if file doesn't exist
      }

      // Remove audioUrl from event
      if (event.content) {
        delete event.content.audioUrl
      }
      events[eventIndex] = event

      // Save updated events
      const formatted = JSON.stringify(events, null, 2)
      await fs.promises.writeFile(eventsFile, formatted, 'utf8')

      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      console.error('Error deleting audio', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to delete audio' }))
    }
    return
  }

  next()
}

