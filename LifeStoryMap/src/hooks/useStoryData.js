import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStory } from '../services/storyService.js'
import { getEvents } from '../services/eventService.js'

/**
 * Hook for fetching story and events data
 * @param {string} storyId - Story ID
 * @returns {Object} - { loading, story, events, error }
 */
export function useStoryData(storyId) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [story, setStory] = useState(null)
  const [events, setEvents] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!storyId) {
        navigate('/')
        return
      }

      setLoading(true)
      setError(null)
      try {
        const [storyData, eventsData] = await Promise.all([
          getStory(storyId),
          getEvents(storyId),
        ])

        if (cancelled) return

        const nextEvents = Array.isArray(eventsData) ? eventsData : []
        setStory(storyData)
        setEvents(nextEvents)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err)
        if (!cancelled) {
          setError(err)
          setStory(null)
          setEvents([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [storyId, navigate])

  return { loading, story, events, error }
}

