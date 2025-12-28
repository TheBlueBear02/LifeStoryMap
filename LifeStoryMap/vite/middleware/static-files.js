import fs from 'fs'
import path from 'path'
import { imagesDir, audioDir } from '../utils/paths.js'

/**
 * Static file serving middleware for images
 */
export const imagesStaticMiddleware = async (req, res, next) => {
  if (req.method !== 'GET') {
    next()
    return
  }

  try {
    const urlPath = req.url || '/'
    const relative = urlPath.replace(/^\/+/, '')
    const filePath = path.join(imagesDir, relative.replace(/^stories\/images\/?/, ''))

    const stream = fs.createReadStream(filePath)
    stream.on('error', () => {
      res.statusCode = 404
      res.end('Not found')
    })
    stream.pipe(res)
  } catch (err) {
    console.error('Error serving image', err)
    res.statusCode = 500
    res.end('Server error')
  }
}

/**
 * Static file serving middleware for audio files
 */
export const audioStaticMiddleware = async (req, res, next) => {
  if (req.method !== 'GET') {
    next()
    return
  }

  try {
    const urlPath = req.url || '/'
    const relative = urlPath.replace(/^\/+/, '')
    const filePath = path.join(audioDir, relative.replace(/^stories\/audio\/?/, ''))

    // Set content type for audio files
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Accept-Ranges', 'bytes')

    const stream = fs.createReadStream(filePath)
    stream.on('error', () => {
      res.statusCode = 404
      res.end('Not found')
    })
    stream.pipe(res)
  } catch (err) {
    console.error('Error serving audio', err)
    res.statusCode = 500
    res.end('Server error')
  }
}

