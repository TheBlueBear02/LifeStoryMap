import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const eventsFilePath = path.resolve(__dirname, '../data/events.json')
const imagesDir = path.resolve(__dirname, '../data/stories/images')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'events-and-upload-api',
      configureServer(server) {
        // Ensure images directory exists
        fs.promises.mkdir(imagesDir, { recursive: true }).catch(() => {})

        // Events CRUD
        server.middlewares.use('/api/events', async (req, res, next) => {
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
              let body = ''
              req.on('data', (chunk) => {
                body += chunk
              })
              req.on('end', async () => {
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
              })
            } catch (err) {
              console.error('Error handling PUT /api/events', err)
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Failed to handle request' }))
            }
            return
          }

          next()
        })

        // Simple JSON-based image upload: { filename, data } where data is base64 (no data: prefix)
        server.middlewares.use('/api/upload-image', async (req, res, next) => {
          if (req.method !== 'POST') {
            next()
            return
          }

          try {
            let body = ''
            req.on('data', (chunk) => {
              body += chunk
            })
            req.on('end', async () => {
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
            })
          } catch (err) {
            console.error('Error in /api/upload-image', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Failed to handle request' }))
          }
        })

        // Serve saved images
        server.middlewares.use('/stories/images', async (req, res, next) => {
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
        })
      },
    },
  ],
})
