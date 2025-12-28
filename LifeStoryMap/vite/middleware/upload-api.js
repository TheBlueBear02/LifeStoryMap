import fs from 'fs'
import path from 'path'
import { imagesDir } from '../utils/paths.js'

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
 * Image upload API middleware
 */
export const uploadApiMiddleware = async (req, res, next) => {
  if (req.method !== 'POST') {
    next()
    return
  }

  try {
    const body = await readBody(req)
    try {
      const parsed = JSON.parse(body || '{}')
      const { filename, data } = parsed || {}

      if (!filename || !data) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Missing filename or data' }))
        return
      }

      const safeBase = String(filename).replace(/[^a-zA-Z0-9.\-_]/g, '_')
      const ext = path.extname(safeBase) || '.bin'
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
      const filePath = path.join(imagesDir, uniqueName)

      const buffer = Buffer.from(data, 'base64')
      await fs.promises.writeFile(filePath, buffer)

      const publicUrl = `/stories/images/${uniqueName}`
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ url: publicUrl }))
    } catch (err) {
      console.error('Error handling image upload', err)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Failed to save image' }))
    }
  } catch (err) {
    console.error('Error in /api/upload-image', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to handle request' }))
  }
}

