import fs from 'fs'
import path from 'path'
import { audioDir, storiesDataDir } from './paths.js'

/**
 * Maps language codes to ElevenLabs voice IDs by gender
 */
const VOICE_MAP = {
  'en': {
    female: 'EXAVITQu4vr4xnSDxMaL', 
    male: 'NOpBlnGInO9m6vDvFkFC', 
  },
  'he': {
    female: '21m00Tcm4TlvDq8ikWAM', // Rachel - Multilingual female (supports Hebrew well)
    male: 'VR6AewLTigWG4xSOukaG', // Arnold - Multilingual male (supports Hebrew well)
  },
}

/**
 * Gets available voices for a language
 * @param {string} language - Language code
 * @returns {Array} Array of voice objects with id, name, and gender
 */
export const getAvailableVoices = (language) => {
  const voices = VOICE_MAP[language] || VOICE_MAP['en']
  return [
    { id: voices.female, name: language === 'he' ? 'רחל (נקבה)' : 'Bella (Female)', gender: 'female' },
    { id: voices.male, name: language === 'he' ? 'ארנולד (זכר)' : 'Adam (Male)', gender: 'male' },
  ]
}

/**
 * Gets the default voice ID for a language (female by default)
 * @param {string} language - Language code
 * @returns {string} Voice ID
 */
export const getDefaultVoiceId = (language) => {
  const voices = VOICE_MAP[language] || VOICE_MAP['en']
  return voices.female
}

/**
 * Gets the appropriate voice ID for a language
 * @param {string} language - Language code
 * @param {string} voiceId - Optional specific voice ID (from story.voiceId)
 * @returns {string} Voice ID
 */
export const getVoiceId = (language, voiceId = null) => {
  if (voiceId) {
    // Validate that the voiceId exists in our map
    const voices = VOICE_MAP[language] || VOICE_MAP['en']
    if (voices.female === voiceId || voices.male === voiceId) {
      return voiceId
    }
    // If voiceId doesn't match, fall back to default
  }
  return getDefaultVoiceId(language)
}

/**
 * Gets the appropriate model ID for a language
 */
export const getModelId = (language) => {
  return language === 'he' 
    ? 'eleven_multilingual_v2' 
    : 'eleven_turbo_v2_5' // Faster model for English
}

/**
 * Checks if an error is critical and should stop processing
 */
export const isCriticalError = (errorMessage, statusCode) => {
  const errorLower = errorMessage.toLowerCase()
  return (
    errorLower.includes('free tier') ||
    errorLower.includes('abuse') ||
    errorLower.includes('unusual activity') ||
    errorLower.includes('paid plan') ||
    errorLower.includes('subscription') ||
    errorLower.includes('account') ||
    statusCode === 401 ||
    statusCode === 403
  )
}

/**
 * Generates audio for events in a story using ElevenLabs API
 */
export const generateAudioForStory = async (story, events, elevenLabsToken, stripHtmlFn) => {
  const storyLanguage = story.language || 'en'
  const voiceId = getVoiceId(storyLanguage, story.voiceId)
  const modelId = getModelId(storyLanguage)
  const defaultText = storyLanguage === 'he' ? 'טקסט מלא על האירוע' : 'Full text about the event'
  
  const generatedFiles = []
  const errors = []
  let hasUpdates = false
  let criticalError = null

  console.log(`Generating audio for story ${story.id} in language: ${storyLanguage} using voice: ${voiceId}`)

  const eventsFile = path.resolve(storiesDataDir, story.eventsFilePath)

  // Process each event
  for (const event of events) {
    // Skip Opening and Closing events
    if (event?.eventType === 'Opening' || event?.eventType === 'Closing') {
      continue
    }

    const textHtml = event?.content?.textHtml || ''
    const plainText = stripHtmlFn(textHtml)
    const trimmedText = plainText.trim()

    // Skip if text is empty, default text, or already has audio
    if (!trimmedText || trimmedText === defaultText || event?.content?.audioUrl) {
      continue
    }

    // ElevenLabs has a character limit (typically 5000 characters)
    const maxLength = 5000
    let textToSend = trimmedText
    if (textToSend.length > maxLength) {
      console.warn(`Event ${event.eventId} text exceeds ${maxLength} characters, truncating...`)
      textToSend = textToSend.substring(0, maxLength)
    }

    try {
      // Call ElevenLabs API with language-specific voice
      const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`

      // Build request body
      const requestBody = {
        text: textToSend,
        model_id: modelId,
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.75,
        },
      }
      
      // Set language_code only for English
      // The multilingual_v2 model auto-detects Hebrew from the text content
      // and does not support language_code parameter for Hebrew
      if (storyLanguage === 'en') {
        requestBody.language_code = 'en'
      }
      // For Hebrew, omit language_code - the multilingual model will auto-detect from text

      const response = await fetch(elevenLabsUrl, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsToken,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = ''
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.detail?.message || errorJson.detail || errorText
        } catch {
          errorMessage = errorText
        }
        
        if (isCriticalError(errorMessage, response.status)) {
          criticalError = {
            message: errorMessage,
            eventId: event.eventId,
            status: response.status,
          }
          console.error(`Critical ElevenLabs API error for event ${event.eventId}:`, errorMessage)
          console.error(`Text that failed: "${textToSend.substring(0, 100)}${textToSend.length > 100 ? '...' : ''}"`)
          break
        } else {
          errors.push({
            eventId: event.eventId,
            message: errorMessage,
          })
          console.error(`ElevenLabs API error for event ${event.eventId}:`, errorMessage)
          console.error(`Text that failed: "${textToSend.substring(0, 100)}${textToSend.length > 100 ? '...' : ''}"`)
          continue
        }
      }

      // Save audio file
      const audioBuffer = await response.arrayBuffer()
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).slice(2, 8)
      const audioFileName = `${event.eventId}-${timestamp}-${randomStr}.mp3`
      const audioFilePath = path.join(audioDir, audioFileName)
      
      await fs.promises.writeFile(audioFilePath, Buffer.from(audioBuffer))

      // Update event with audio URL
      if (!event.content) {
        event.content = {}
      }
      event.content.audioUrl = `/stories/audio/${audioFileName}`
      hasUpdates = true
      generatedFiles.push({
        eventId: event.eventId,
        audioUrl: event.content.audioUrl,
      })
    } catch (err) {
      errors.push({
        eventId: event.eventId,
        message: err.message || 'Unknown error occurred',
      })
      console.error(`Error generating audio for event ${event.eventId}:`, err)
    }
  }

  // Save updated events if any changes were made
  if (hasUpdates) {
    const formatted = JSON.stringify(events, null, 2)
    await fs.promises.writeFile(eventsFile, formatted, 'utf8')
  }

  return {
    generatedFiles,
    errors,
    criticalError,
  }
}

