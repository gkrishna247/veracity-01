/**
 * Veracity AI — API Client
 *
 * Centralized HTTP client wrapping fetch() with error handling,
 * JSON parsing, and multipart form data support.
 */

const API = {
  /**
   * Send a GET request and parse JSON response.
   * @param {string} url - API endpoint path (e.g., '/api/evaluation')
   * @returns {Promise<any>} Parsed JSON response
   */
  async get(url) {
    const response = await fetch(url);
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /**
   * Send a POST request with JSON body.
   * @param {string} url - API endpoint path
   * @param {Object} body - Request body (will be JSON-stringified)
   * @returns {Promise<any>} Parsed JSON response
   */
  async post(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /**
   * Send a POST request with FormData (for file uploads).
   * @param {string} url - API endpoint path
   * @param {FormData} formData - Form data with files and fields
   * @returns {Promise<any>} Parsed JSON response
   */
  async postForm(url, formData) {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /**
   * Send a DELETE request.
   * @param {string} url - API endpoint path
   * @returns {Promise<any>} Parsed JSON response
   */
  async delete(url) {
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /**
   * Fetch raw HTML content.
   * @param {string} url - HTML endpoint path
   * @returns {Promise<string>} HTML string
   */
  async getHtml(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  },
};
