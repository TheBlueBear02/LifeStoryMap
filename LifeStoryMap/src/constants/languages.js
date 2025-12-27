/**
 * Language constants for stories
 */

export const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
]

export const DEFAULT_LANGUAGE = 'en'

export function getLanguageByCode(code) {
  return LANGUAGES.find((lang) => lang.code === code) || LANGUAGES[0]
}

export function isValidLanguageCode(code) {
  return LANGUAGES.some((lang) => lang.code === code)
}

