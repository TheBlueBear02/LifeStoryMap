import { get, put } from './api.js'
import { API_PATHS } from '../constants/paths.js'

/**
 * Event service for CRUD operations
 */

const isExampleStoryId = (storyId) => typeof storyId === 'string' && storyId.startsWith('example-story-')

/**
 * Fetches all events for a story
 * @param {string} storyId - Story ID
 * @returns {Promise<Array>} - Array of event objects
 */
export async function getEvents(storyId) {
  const data = await get(isExampleStoryId(storyId) ? API_PATHS.EXAMPLE_STORY_EVENTS(storyId) : API_PATHS.STORY_EVENTS(storyId))
  return Array.isArray(data) ? data : []
}

/**
 * Saves events for a story
 * @param {string} storyId - Story ID
 * @param {Array} events - Array of event objects
 * @returns {Promise<void>}
 */
export async function saveEvents(storyId, events) {
  return put(isExampleStoryId(storyId) ? API_PATHS.EXAMPLE_STORY_EVENTS(storyId) : API_PATHS.STORY_EVENTS(storyId), events)
}

