import { post, del } from './api.js'
import { API_PATHS } from '../constants/paths.js'

/**
 * Audio service for text-to-speech operations
 */

/**
 * Generates audio files for all events in a story that have custom text
 * @param {string} storyId - Story ID
 * @returns {Promise<Object>} - Response with generated files info
 */
export async function generateAudio(storyId) {
  const data = await post(API_PATHS.GENERATE_AUDIO(storyId), {})
  return data
}

/**
 * Gets the audio URL from an event object
 * @param {Object} event - Event object
 * @returns {string|null} - Audio URL or null if not available
 */
export function getAudioUrl(event) {
  return event?.content?.audioUrl || null
}

/**
 * Checks if an event has audio
 * @param {Object} event - Event object
 * @returns {boolean} - True if event has audio URL
 */
export function hasAudio(event) {
  return !!getAudioUrl(event)
}

/**
 * Deletes an audio file for an event
 * @param {string} storyId - Story ID
 * @param {string} eventId - Event ID
 * @returns {Promise<void>}
 */
export async function deleteAudio(storyId, eventId) {
  return del(API_PATHS.DELETE_AUDIO(storyId, eventId))
}

/**
 * Deletes all audio files for a story
 * @param {string} storyId - Story ID
 * @returns {Promise<Object>} - Response with deleted count
 */
export async function deleteAllAudio(storyId) {
  return del(API_PATHS.DELETE_ALL_AUDIO(storyId))
}

