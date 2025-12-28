import fs from 'fs'
import { eventsFilePath } from '../utils/paths.js'

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
 * Legacy events API middleware (for backward compatibility)
 */
export const eventsApiMiddleware = async (req, res, next) => {
  if (req.method === 'GET') {
    try {
      const json = await fs.promises.readFile(eventsFilePath, 'utf8')
      res.setHeader('Content-Type', 'application/json')
      res.end(json)
    } catch (err) {
      console.error('Error reading events.json', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to read events.json' }))
    }
    return
  }

  if (req.method === 'PUT') {
    try {
      const body = await readBody(req)
      try {
        const parsed = JSON.parse(body)
        const formatted = JSON.stringify(parsed, null, 2)
        await fs.promises.writeFile(eventsFilePath, formatted, 'utf8')
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      } catch (err) {
        console.error('Error writing events.json', err)
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'Failed to write events.json' }))
      }
    } catch (err) {
      console.error('Error handling PUT /api/events', err)
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to handle request' }))
    }
    return
  }

  next()
}

