/**
 * Voice constants for stories
 * Maps language codes to available voices with their IDs and display names
 */

export const VOICE_OPTIONS = {
  'en': [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female)', gender: 'female' },
    { id: 'NOpBlnGInO9m6vDvFkFC', name: 'Adam (Male)', gender: 'male' },
  ],
  'he': [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'רחל (נקבה)', gender: 'female' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'ארנולד (זכר)', gender: 'male' },
  ],
}

/**
 * Gets available voices for a language
 * @param {string} language - Language code
 * @returns {Array} Array of voice objects
 */
export const getVoicesForLanguage = (language) => {
  return VOICE_OPTIONS[language] || VOICE_OPTIONS['en']
}

/**
 * Gets the default voice ID for a language (female by default)
 * @param {string} language - Language code
 * @returns {string} Voice ID
 */
export const getDefaultVoiceId = (language) => {
  const voices = getVoicesForLanguage(language)
  return voices[0]?.id || 'EXAVITQu4vr4xnSDxMaL'
}

