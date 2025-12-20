import { get, put } from './api.js'
import { API_PATHS } from '../constants/paths.js'

/**
 * Event service for CRUD operations
 */

/**
 * Fetches all events for a story
 * @param {string} storyId - Story ID
 * @returns {Promise<Array>} - Array of event objects
 */
export async function getEvents(storyId) {
  const data = await get(API_PATHS.STORY_EVENTS(storyId))
  return Array.isArray(data) ? data : []
}

/**
 * Saves events for a story
 * @param {string} storyId - Story ID
 * @param {Array} events - Array of event objects
 * @returns {Promise<void>}
 */
export async function saveEvents(storyId, events) {
  return put(API_PATHS.STORY_EVENTS(storyId), events)
}

