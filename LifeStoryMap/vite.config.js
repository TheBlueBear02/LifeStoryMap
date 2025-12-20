import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const eventsFilePath = path.resolve(__dirname, '../data/stories/events/events.json')
const imagesDir = path.resolve(__dirname, '../data/stories/images')
const storiesFilePath = path.resolve(__dirname, '../data/stories/stories.json')
const storiesDataDir = path.resolve(__dirname, '../data/stories')
const exampleStoriesFilePath = path.resolve(__dirname, '../data/stories/example-stories.json')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'events-and-upload-api',
      configureServer(server) {
        // Ensure images directory exists
        fs.promises.mkdir(imagesDir, { recursive: true }).catch(() => {})
        // Ensure stories directory exists
        fs.promises.mkdir(storiesDataDir, { recursive: true }).catch(() => {})

        // Stories CRUD API
        server.middlewares.use('/api/stories', async (req, res, next) => {
          const url = new URL(req.url || '/', `http://${req.headers.host}`)
          const pathParts = url.pathname.replace(/^\/api\/stories\/?/, '').split('/').filter(Boolean)
          const storyId = pathParts[0]
          const action = pathParts[1]

          // GET /api/stories - get all stories
          if (req.method === 'GET' && !storyId) {
            try {
              let stories = []
              try {
                const json = await fs.promises.readFile(storiesFilePath, 'utf8')
                stories = JSON.parse(json)
              } catch (err) {
                // File doesn't exist, return empty array
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
              let body = ''
              req.on('data', (chunk) => {
                body += chunk
              })
              req.on('end', async () => {
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
              })
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
              let body = ''
              req.on('data', (chunk) => {
                body += chunk
              })
              req.on('end', async () => {
                try {
                  const json = await fs.promises.readFile(storiesFilePath, 'utf8')
                  const stories = JSON.parse(json)
                  
                  // Check max 5 stories
                  if (stories.length >= 5) {
                    res.statusCode = 400
                    res.end(JSON.stringify({ error: 'Maximum of 5 stories allowed' }))
                    return
                  }

                  const { name } = JSON.parse(body || '{}')
                  if (!name || typeof name !== 'string') {
                    res.statusCode = 400
                    res.end(JSON.stringify({ error: 'Story name is required' }))
                    return
                  }

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
              })
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
              let body = ''
              req.on('data', (chunk) => {
                body += chunk
              })
              req.on('end', async () => {
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
              })
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
                // File might not exist, ignore error
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

          next()
        })

        // Example stories (read-only) API
        // - GET /api/example-stories
        // - GET /api/example-stories/:id
        // - GET /api/example-stories/:id/events
        server.middlewares.use('/api/example-stories', async (req, res, next) => {
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
              let body = ''
              req.on('data', (chunk) => {
                body += chunk
              })
              req.on('end', async () => {
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
              })
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
              let body = ''
              req.on('data', (chunk) => {
                body += chunk
              })
              req.on('end', async () => {
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
              })
            } catch (err) {
              console.error('Error handling PUT /api/example-stories/:id/events', err)
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Failed to handle request' }))
            }
            return
          }

          next()
        })

        // Events CRUD (legacy support - now uses story-specific endpoints)
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
