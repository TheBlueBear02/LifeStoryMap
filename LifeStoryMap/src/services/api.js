/**
 * Base API client with error handling
 */

/**
 * Performs a fetch request with error handling
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      let error
      try {
        error = JSON.parse(errorText)
      } catch {
        error = { error: errorText || `Request failed with status ${response.status}` }
      }
      const errorMessage = error.error || `Request failed with status ${response.status}`
      console.error(`API request failed for ${url}:`, errorMessage, 'Response:', errorText)
      throw new Error(errorMessage)
    }

    return response
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('API request failed:', url, error)
    throw error
  }
}

/**
 * Performs a GET request
 * @param {string} url - Request URL
 * @returns {Promise<any>} - Parsed JSON response
 */
export async function get(url) {
  const response = await apiRequest(url, { method: 'GET' })
  return response.json()
}

/**
 * Performs a POST request
 * @param {string} url - Request URL
 * @param {Object} data - Request body data
 * @returns {Promise<any>} - Parsed JSON response
 */
export async function post(url, data) {
  const response = await apiRequest(url, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return response.json()
}

/**
 * Performs a PUT request
 * @param {string} url - Request URL
 * @param {Object} data - Request body data
 * @returns {Promise<any>} - Parsed JSON response
 */
export async function put(url, data) {
  const response = await apiRequest(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return response.json()
}

/**
 * Performs a DELETE request
 * @param {string} url - Request URL
 * @returns {Promise<any>} - Parsed JSON response
 */
export async function del(url) {
  const response = await apiRequest(url, { method: 'DELETE' })
  return response.json()
}

