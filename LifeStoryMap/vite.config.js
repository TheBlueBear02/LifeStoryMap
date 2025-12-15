import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const eventsFilePath = path.resolve(__dirname, '../data/events.json')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'events-api',
      configureServer(server) {
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
      },
    },
  ],
})
