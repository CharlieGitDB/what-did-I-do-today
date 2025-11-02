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
    // Use v1 REST API for better stability and storage format support
    this.apiUrl = `${baseUrl}/wiki/rest/api`;
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
          'Accept': 'application/json',
          'User-Agent': 'wdidt-cli/1.0.0'
        },
        data,
        timeout: 30000 // 30 second timeout
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        // Check if it's an HTML error response (CloudFront blocking)
        if (typeof error.response.data === 'string' && error.response.data.includes('<!DOCTYPE HTML')) {
          throw new Error(`Confluence API blocked by CloudFront (${error.response.status}). This may be due to HTML content triggering security rules. Try simplifying the content or check your Confluence permissions.`);
        }
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
    const response = await this.request('GET', `/content?spaceKey=${spaceKey}&title=${encodeURIComponent(title)}&expand=version`);

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
      type: 'page',
      title: title,
      space: {
        key: spaceKey
      },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      }
    };

    if (parentId) {
      pageData.ancestors = [{ id: parentId }];
    }

    const response = await this.request('POST', '/content', pageData);

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
      type: 'page',
      title: title,
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      },
      version: {
        number: currentVersion + 1
      }
    };

    const response = await this.request('PUT', `/content/${pageId}`, pageData);

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
    const response = await this.request('GET', `/space/${spaceKey}`);

    if (response && response.id) {
      return response.id;
    }

    throw new Error(`Space not found: ${spaceKey}`);
  }

  /**
   * Tests the connection and authentication
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      await this.request('GET', '/user/current');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Lists all spaces the user has access to
   * @returns {Promise<Array<{key: string, name: string, id: string}>>} Array of spaces
   */
  async listSpaces() {
    try {
      const response = await this.request('GET', '/space?limit=100');

      if (response.results) {
        return response.results.map(space => ({
          key: space.key,
          name: space.name,
          id: space.id
        }));
      }

      return [];
    } catch (error) {
      throw new Error(`Failed to list spaces: ${error.message}`);
    }
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
