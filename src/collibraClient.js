const axios = require('axios');
const fs = require('fs');
const path = require('path');

class CollibraClient {
  constructor() {
    this.config = null;
    this.authHeader = null;
  }

  loadConfig() {
    const configPath = path.join(__dirname, '..', 'config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('config.json not found. Please run setup first.');
    }
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Create Basic Auth header
    const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
  }

  async authenticate() {
    try {
      // Test connectivity using Basic Auth
      const response = await axios.post(
        `https://${this.config.domain}/rest/2.0/auth/sessions`,
        {
          username: this.config.username,
          password: this.config.password
        }
      );
      console.log('✓ Authenticated successfully');
      return true;
    } catch (error) {
      console.error('Authentication failed:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response:', error.response.data);
      }
      return false;
    }
  }

  async makeRequest(endpoint, params = {}) {
    try {
      const response = await axios.get(`${this.config.apiURL}${endpoint}`, {
        params,
        headers: {
          'Authorization': this.authHeader
        }
      });
      return response.data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('URL:', error.response.config.url);
        console.error('Response:', error.response.data);
      }
      throw error;
    }
  }

  async makeGraphQLRequest(query, variables = {}) {
    try {
      const response = await axios.post(
        this.config.graphURL,
        { query, variables },
        {
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('GraphQL request failed:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response:', error.response.data);
      }
      throw error;
    }
  }

  async getCommunities(params = {}) {
    const defaultParams = {
      offset: 0,
      limit: 1000,
      sortField: 'NAME',
      sortOrder: 'ASC',
      excludeMeta: true
    };
    return await this.makeRequest('/communities', { ...defaultParams, ...params });
  }

  async getDomains(communityId, params = {}) {
    const defaultParams = {
      communityId,
      offset: 0,
      limit: 1000,
      sortField: 'NAME',
      sortOrder: 'ASC',
      excludeMeta: true
    };
    return await this.makeRequest('/domains', { ...defaultParams, ...params });
  }

  async getAssets(domainId, params = {}) {
    const defaultParams = {
      domainId,
      offset: 0,
      limit: 1000,
      sortField: 'NAME',
      sortOrder: 'ASC',
      excludeMeta: true
    };
    return await this.makeRequest('/assets', { ...defaultParams, ...params });
  }

  async getAssetsByCommunity(communityId, params = {}) {
    const defaultParams = {
      communityId,
      offset: 0,
      limit: 1000,
      sortField: 'NAME',
      sortOrder: 'ASC',
      excludeMeta: true
    };
    return await this.makeRequest('/assets', { ...defaultParams, ...params });
  }

  async getAssetDetails(assetId) {
    return await this.makeRequest(`/assets/${assetId}`);
  }

  async getAssetAttributes(assetId) {
    return await this.makeRequest(`/assets/${assetId}/attributes`);
  }

  async getAssetRelations(assetId, params = {}) {
    const defaultParams = {
      offset: 0,
      limit: 1000
    };
    return await this.makeRequest(`/assets/${assetId}/relations`, { ...defaultParams, ...params });
  }

  async getAssetResponsibilities(assetId, params = {}) {
    const defaultParams = {
      offset: 0,
      limit: 1000
    };
    return await this.makeRequest(`/assets/${assetId}/responsibilities`, { ...defaultParams, ...params });
  }

  /**
   * Get all subcommunities of a given community (recursive)
   */
  async getAllSubcommunities(communityId) {
    const allCommunities = [];
    
    // Get all communities
    const response = await this.getCommunities({ limit: 1000 });
    const communities = response.results || [];
    
    // Build a map for quick lookup
    const communityMap = new Map();
    communities.forEach(comm => communityMap.set(comm.id, comm));
    
    // Recursive function to find all descendants
    const findDescendants = (parentId) => {
      const descendants = [];
      
      for (const comm of communities) {
        if (comm.parent && comm.parent.id === parentId) {
          descendants.push(comm);
          // Recursively find children of this community
          const children = findDescendants(comm.id);
          descendants.push(...children);
        }
      }
      
      return descendants;
    };
    
    // Find all descendants of the given community
    const subcommunities = findDescendants(communityId);
    
    return subcommunities;
  }

  /**
   * Get community by name (exact match)
   */
  async getCommunityByName(name) {
    const response = await this.getCommunities({ name, nameMatchMode: 'EXACT' });
    const communities = response.results || [];
    
    if (communities.length === 0) {
      return null;
    }
    
    return communities[0];
  }

  /**
   * Batch fetch user details by IDs
   */
  async getUsersByIds(userIds) {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    try {
      const userParams = userIds.map(id => `userId=${id}`).join('&');
      const response = await this.makeRequest(`/users?${userParams}&limit=1000`);
      return response.results || [];
    } catch (error) {
      console.error('Failed to fetch user details:', error.message);
      return [];
    }
  }

  /**
   * Batch fetch user group details by IDs
   */
  async getUserGroupsByIds(groupIds) {
    if (!groupIds || groupIds.length === 0) {
      return [];
    }

    try {
      const groupParams = groupIds.map(id => `userGroupId=${id}`).join('&');
      const response = await this.makeRequest(`/userGroups?${groupParams}&limit=1000`);
      return response.results || [];
    } catch (error) {
      console.error('Failed to fetch user group details:', error.message);
      return [];
    }
  }

  /**
   * Get responsibilities with full user details and inheritance info
   */
  async getAssetResponsibilitiesEnriched(assetId, includeInherited = true) {
    try {
      // Get responsibilities with inheritance
      const response = await this.makeRequest(
        `/responsibilities?resourceIds=${assetId}&includeInherited=${includeInherited}&limit=1000`
      );
      
      let responsibilities = response.results || [];

      // Extract unique user and group IDs
      const userIds = new Set();
      const groupIds = new Set();

      responsibilities.forEach(r => {
        if (r.owner?.id) {
          if (r.owner.resourceType === 'User') {
            userIds.add(r.owner.id);
          } else if (r.owner.resourceType === 'UserGroup') {
            groupIds.add(r.owner.id);
          }
        }
      });

      // Batch fetch user and group details
      const [users, groups] = await Promise.all([
        this.getUsersByIds(Array.from(userIds)),
        this.getUserGroupsByIds(Array.from(groupIds))
      ]);

      // Create lookup maps
      const usersMap = new Map();
      users.forEach(user => usersMap.set(user.id, user));

      const groupsMap = new Map();
      groups.forEach(group => groupsMap.set(group.id, group));

      // Enrich responsibilities with full details
      responsibilities = responsibilities.map(r => {
        const enriched = { ...r };
        
        if (r.owner?.id) {
          if (r.owner.resourceType === 'User') {
            const userDetails = usersMap.get(r.owner.id);
            if (userDetails) {
              enriched.owner = {
                ...r.owner,
                userName: userDetails.userName,
                firstName: userDetails.firstName,
                lastName: userDetails.lastName,
                fullName: `${userDetails.firstName || ''} ${userDetails.lastName || ''}`.trim() || userDetails.userName,
                emailAddress: userDetails.emailAddress
              };
            }
          } else if (r.owner.resourceType === 'UserGroup') {
            const groupDetails = groupsMap.get(r.owner.id);
            if (groupDetails) {
              enriched.owner = {
                ...r.owner,
                name: groupDetails.name,
                description: groupDetails.description
              };
            }
          }
        }
        
        return enriched;
      });

      // Categorize by inheritance
      const direct = responsibilities.filter(r => r.baseResource?.id === assetId);
      const inherited = responsibilities.filter(r => r.baseResource?.id !== assetId);
      const inheritedFromCommunity = inherited.filter(r => r.baseResource?.resourceType === 'Community');
      const inheritedFromDomain = inherited.filter(r => r.baseResource?.resourceType === 'Domain');

      return {
        all: responsibilities,
        direct,
        inherited: {
          all: inherited,
          fromCommunity: inheritedFromCommunity,
          fromDomain: inheritedFromDomain
        },
        summary: {
          total: responsibilities.length,
          direct: direct.length,
          inherited: inherited.length,
          fromCommunity: inheritedFromCommunity.length,
          fromDomain: inheritedFromDomain.length
        }
      };
    } catch (error) {
      console.error('Failed to fetch enriched responsibilities:', error.message);
      return {
        all: [],
        direct: [],
        inherited: { all: [], fromCommunity: [], fromDomain: [] },
        summary: { total: 0, direct: 0, inherited: 0, fromCommunity: 0, fromDomain: 0 }
      };
    }
  }

  // Pagination helper - fetches all pages of results
  async fetchAllPages(endpoint, params = {}, itemsKey = 'results') {
    const allResults = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeRequest(endpoint, { ...params, offset, limit });
      const items = response[itemsKey] || [];
      allResults.push(...items);
      
      offset += limit;
      hasMore = items.length === limit; // Continue if we got a full page
      
      if (hasMore) {
        console.log(`  Fetched ${allResults.length} items, continuing...`);
      }
    }

    return allResults;
  }
}

module.exports = CollibraClient;
