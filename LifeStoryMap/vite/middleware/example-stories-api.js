import fs from 'fs'
import path from 'path'
import { exampleStoriesFilePath, storiesDataDir } from '../utils/paths.js'

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
 * Example stories API middleware
 */
export const exampleStoriesApiMiddleware = async (req, res, next) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const pathParts = url.pathname.replace(/^\/api\/example-stories\/?/, '').split('/').filter(Boolean)
  const storyId = pathParts[0]
  const action = pathParts[1]

  const readExampleStories = async () => {
    try {
      const json = await fs.promises.readFile(exampleStoriesFilePath, 'utf8')
      const parsed = JSON.parse(json)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  
  const writeExampleStories = async (stories) => {
    const formatted = JSON.stringify(Array.isArray(stories) ? stories : [], null, 2)
    await fs.promises.writeFile(exampleStoriesFilePath, formatted, 'utf8')
  }

  // GET /api/example-stories - get all example stories
  if (req.method === 'GET' && !storyId) {
    try {
      const stories = await readExampleStories()
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(stories))
    } catch (err) {
      console.error('Error reading example-stories.json', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to read example stories' }))
    }
    return
  }

  // GET /api/example-stories/:id - get single example story
  if (req.method === 'GET' && storyId && !action) {
    try {
      const stories = await readExampleStories()
      const story = stories.find((s) => s.id === storyId)
      if (!story) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Story not found' }))
        return
      }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(story))
    } catch (err) {
      console.error('Error reading example story', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to read example story' }))
    }
    return
  }

  // GET /api/example-stories/:id/events - get events for an example story
  if (req.method === 'GET' && storyId && action === 'events') {
    try {
      const stories = await readExampleStories()
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
      console.error('Error reading example story events', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to read example story events' }))
    }
    return
  }

  // PUT /api/example-stories/:id - update example story metadata (e.g. name/published)
  if (req.method === 'PUT' && storyId && !action) {
    try {
      const body = await readBody(req)
      try {
        const updates = JSON.parse(body || '{}')
        const stories = await readExampleStories()
        const idx = stories.findIndex((s) => s.id === storyId)
        if (idx === -1) {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Story not found' }))
          return
        }

        const prev = stories[idx]
        const next = { ...prev }
        if (typeof updates?.name === 'string') next.name = updates.name.trim()
        if (typeof updates?.published === 'boolean') next.published = updates.published
        if (typeof updates?.eventCount === 'number') next.eventCount = updates.eventCount

        stories[idx] = next
        await writeExampleStories(stories)

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(next))
      } catch (err) {
        console.error('Error updating example story', err)
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'Failed to update example story' }))
      }
    } catch (err) {
      console.error('Error handling PUT /api/example-stories/:id', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to handle request' }))
    }
    return
  }

  // PUT /api/example-stories/:id/events - save events for an example story
  if (req.method === 'PUT' && storyId && action === 'events') {
    try {
      const body = await readBody(req)
      try {
        const stories = await readExampleStories()
        const idx = stories.findIndex((s) => s.id === storyId)
        if (idx === -1) {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Story not found' }))
          return
        }

        const parsed = JSON.parse(body || '[]')
        const eventsArr = Array.isArray(parsed) ? parsed : []

        const story = stories[idx]
        const eventsFile = path.resolve(storiesDataDir, story.eventsFilePath)
        const formatted = JSON.stringify(eventsArr, null, 2)
        await fs.promises.writeFile(eventsFile, formatted, 'utf8')

        // Keep eventCount in sync
        stories[idx] = { ...story, eventCount: eventsArr.length }
        await writeExampleStories(stories)

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      } catch (err) {
        console.error('Error writing example story events', err)
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'Failed to write example story events' }))
      }
    } catch (err) {
      console.error('Error handling PUT /api/example-stories/:id/events', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to handle request' }))
    }
    return
  }

  next()
}

