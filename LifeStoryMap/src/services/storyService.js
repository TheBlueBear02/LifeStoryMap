import { get, post, put, del } from './api.js'
import { API_PATHS } from '../constants/paths.js'

/**
 * Story service for CRUD operations
 */

const isExampleStoryId = (storyId) => typeof storyId === 'string' && storyId.startsWith('example-story-')

/**
 * Fetches all stories
 * @returns {Promise<Array>} - Array of story objects
 */
export async function getStories() {
  const data = await get(API_PATHS.STORIES)
  return Array.isArray(data) ? data : []
}

/**
 * Fetches a single story by ID
 * @param {string} storyId - Story ID
 * @returns {Promise<Object>} - Story object
 */
export async function getStory(storyId) {
  return get(isExampleStoryId(storyId) ? API_PATHS.EXAMPLE_STORY(storyId) : API_PATHS.STORY(storyId))
}

/**
 * Creates a new story
 * @param {string} name - Story name
 * @param {string} language - Story language code (default: 'en')
 * @returns {Promise<Object>} - Created story object
 */
export async function createStory(name, language = 'en') {
  return post(API_PATHS.STORIES, { name: name.trim(), language })
}

/**
 * Updates a story
 * @param {string} storyId - Story ID
 * @param {Object} updates - Story updates (e.g., { name: 'New Name' })
 * @returns {Promise<Object>} - Updated story object
 */
export async function updateStory(storyId, updates) {
  return put(isExampleStoryId(storyId) ? API_PATHS.EXAMPLE_STORY(storyId) : API_PATHS.STORY(storyId), updates)
}

/**
 * Deletes a story
 * @param {string} storyId - Story ID
 * @returns {Promise<void>}
 */
export async function deleteStory(storyId) {
  return del(isExampleStoryId(storyId) ? API_PATHS.EXAMPLE_STORY(storyId) : API_PATHS.STORY(storyId))
}

