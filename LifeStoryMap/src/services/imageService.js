import { post } from './api.js'
import { API_PATHS } from '../constants/paths.js'
import { fileToBase64 } from '../utils/imageUtils.js'

/**
 * Image service for upload operations
 */

/**
 * Uploads an image file
 * @param {File} file - Image file to upload
 * @returns {Promise<string>} - URL of uploaded image
 */
export async function uploadImage(file) {
  const base64Data = await fileToBase64(file)
  const data = await post(API_PATHS.UPLOAD_IMAGE, {
    filename: file.name,
    data: base64Data,
  })
  return data.url
}

