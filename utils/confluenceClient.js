import axios from 'axios';

/**
 * @typedef {Object} ConfluencePage
 * @property {string} id - Page ID
 * @property {string} title - Page title
 * @property {number} version - Page version number
 */

/**
 * Creates a Confluence API client
 */
export class ConfluenceClient {
  /**
   * @param {string} baseUrl - Confluence base URL
   * @param {string} email - User email
   * @param {string} apiToken - API token
   */
  constructor(baseUrl, email, apiToken) {
    this.baseUrl = baseUrl;
    this.auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    this.apiUrl = `${baseUrl}/wiki/api/v2`;
  }

  /**
   * Makes an authenticated request to Confluence API
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} [data] - Request data
   * @returns {Promise<any>} Response data
   */
  async request(method, endpoint, data = null) {
    try {
      const response = await axios({
        method,
        url: `${this.apiUrl}${endpoint}`,
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        data
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Confluence API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Searches for a page by title in a space
   * @param {string} spaceKey - Space key
   * @param {string} title - Page title
   * @returns {Promise<ConfluencePage|null>} Page if found, null otherwise
   */
  async findPageByTitle(spaceKey, title) {
    const response = await this.request('GET', `/pages?space-key=${spaceKey}&title=${encodeURIComponent(title)}`);

    if (response.results && response.results.length > 0) {
      const page = response.results[0];
      return {
        id: page.id,
        title: page.title,
        version: page.version.number
      };
    }

    return null;
  }

  /**
   * Creates a new page
   * @param {string} spaceKey - Space key
   * @param {string} title - Page title
   * @param {string} content - Page content in storage format
   * @param {string} [parentId] - Parent page ID (optional)
   * @returns {Promise<ConfluencePage>} Created page
   */
  async createPage(spaceKey, title, content, parentId = null) {
    const pageData = {
      spaceId: await this.getSpaceId(spaceKey),
      status: 'current',
      title: title,
      body: {
        representation: 'storage',
        value: content
      }
    };

    if (parentId) {
      pageData.parentId = parentId;
    }

    const response = await this.request('POST', '/pages', pageData);

    return {
      id: response.id,
      title: response.title,
      version: response.version.number
    };
  }

  /**
   * Updates an existing page
   * @param {string} pageId - Page ID
   * @param {string} title - Page title
   * @param {string} content - Page content in storage format
   * @param {number} currentVersion - Current version number
   * @returns {Promise<ConfluencePage>} Updated page
   */
  async updatePage(pageId, title, content, currentVersion) {
    const pageData = {
      id: pageId,
      status: 'current',
      title: title,
      body: {
        representation: 'storage',
        value: content
      },
      version: {
        number: currentVersion + 1
      }
    };

    const response = await this.request('PUT', `/pages/${pageId}`, pageData);

    return {
      id: response.id,
      title: response.title,
      version: response.version.number
    };
  }

  /**
   * Gets space ID from space key
   * @param {string} spaceKey - Space key
   * @returns {Promise<string>} Space ID
   */
  async getSpaceId(spaceKey) {
    const response = await this.request('GET', `/spaces?keys=${spaceKey}`);

    if (response.results && response.results.length > 0) {
      return response.results[0].id;
    }

    throw new Error(`Space not found: ${spaceKey}`);
  }

  /**
   * Creates or updates a page
   * @param {string} spaceKey - Space key
   * @param {string} title - Page title
   * @param {string} content - Page content
   * @param {string} [parentId] - Parent page ID
   * @returns {Promise<{action: string, page: ConfluencePage}>} Result
   */
  async createOrUpdatePage(spaceKey, title, content, parentId = null) {
    const existingPage = await this.findPageByTitle(spaceKey, title);

    if (existingPage) {
      const updatedPage = await this.updatePage(
        existingPage.id,
        title,
        content,
        existingPage.version
      );
      return { action: 'updated', page: updatedPage };
    } else {
      const createdPage = await this.createPage(spaceKey, title, content, parentId);
      return { action: 'created', page: createdPage };
    }
  }
}
