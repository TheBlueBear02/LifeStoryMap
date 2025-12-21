import { post } from './api.js'
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

