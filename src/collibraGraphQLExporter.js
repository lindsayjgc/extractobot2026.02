const fs = require('fs');
const path = require('path');

class CollibraGraphQLExporter {
  constructor(client) {
    this.client = client;
  }

  /**
   * Convert JavaScript object to GraphQL input object syntax
   * GraphQL uses: {field: value} not JSON's {"field": "value"}
   */
  toGraphQLInputObject(obj) {
    if (obj === null || obj === undefined) {
      return 'null';
    }
    
    if (typeof obj === 'string') {
      return `"${obj}"`;
    }
    
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }
    
    if (Array.isArray(obj)) {
      return `[${obj.map(item => this.toGraphQLInputObject(item)).join(', ')}]`;
    }
    
    if (typeof obj === 'object') {
      const fields = Object.keys(obj).map(key => {
        return `${key}: ${this.toGraphQLInputObject(obj[key])}`;
      });
      return `{${fields.join(', ')}}`;
    }
    
    return String(obj);
  }

  /**
   * Build GraphQL query for fetching assets with all attributes, relations, and responsibilities
   */
  buildAssetsQuery(options = {}) {
    const {
      limit = 100,
      offset = null,
      whereClause = null,
      includeAttributes = true,
      includeRelations = true,
      includeResponsibilities = true
    } = options;

    const attributesFragment = includeAttributes ? `
      stringAttributes {
        type { name }
        stringValue
      }
      booleanAttributes {
        type { name }
        booleanValue
      }
      numericAttributes {
        type { name }
        numericValue
      }
      dateAttributes {
        type { name }
        dateValue
      }
      multiValueAttributes {
        type { name }
        stringValues
      }
    ` : '';

    const responsibilitiesFragment = '';  // Fetched separately via REST API with inheritance

    const relationsFragment = includeRelations ? `
      outgoingRelations {
        target {
          id
          displayName
          type { name }
        }
        type {
          source { name }
          role
          target { name }
          corole
        }
      }
      incomingRelations {
        source {
          id
          displayName
          type { name }
        }
        type {
          source { name }
          role
          target { name }
          corole
        }
      }
    ` : '';

    // Build WHERE clause
    let whereString = '';
    if (whereClause) {
      whereString = `, where: ${this.toGraphQLInputObject(whereClause)}`;
    }

    const query = `{
      assets(limit: ${limit}, offset: ${offset}${whereString}) {
        id
        displayName
        domain {
          id
          name
          type { name }
          parent {
            id
            name
          }
        }
        type { name }
        status { name }
        tags { name }
        ${attributesFragment}
        ${responsibilitiesFragment}
        ${relationsFragment}
      }
    }`;

    return query;
  }

  /**
   * Fetch all assets with pagination using GraphQL
   */
  async fetchAllAssets(options = {}) {
    const {
      whereClause = null,
      includeAttributes = true,
      includeRelations = true,
      includeResponsibilities = false,
      batchSize = 100
    } = options;

    const allAssets = [];
    let offset = 0;
    let hasMore = true;

    console.log('Fetching assets via GraphQL...');

    while (hasMore) {
      const query = this.buildAssetsQuery({
        limit: batchSize,
        offset: offset === 0 ? null : offset,
        whereClause,
        includeAttributes,
        includeRelations,
        includeResponsibilities
      });

      // Debug: Show query on first call
      if (offset === 0) {
        console.log('GraphQL Query:');
        console.log(query.substring(0, 500) + '...\n');
      }

      try {
        const response = await this.client.makeGraphQLRequest(query);
        
        if (response.errors) {
          console.error('GraphQL errors:', JSON.stringify(response.errors, null, 2));
          console.error('\nQuery that caused the error:');
          console.error(query);
          throw new Error('GraphQL query failed');
        }

        const assets = response.data?.assets || [];
        allAssets.push(...assets);

        console.log(`  Fetched ${allAssets.length} assets...`);

        hasMore = assets.length === batchSize;
        offset += batchSize;
      } catch (error) {
        console.error('GraphQL query failed:', error.message);
        throw error;
      }
    }

    console.log(`✓ Total assets fetched: ${allAssets.length}`);
    return allAssets;
  }

  /**
   * Get all community IDs for a community and its subcommunities
   */
  async getCommunityWithSubcommunities(communityName) {
    console.log(`Looking up community: ${communityName}`);
    
    // Get the main community by name
    const mainCommunity = await this.client.getCommunityByName(communityName);
    
    if (!mainCommunity) {
      throw new Error(`Community "${communityName}" not found`);
    }
    
    console.log(`✓ Found community: ${mainCommunity.name} (${mainCommunity.id})`);
    
    // Get all subcommunities recursively
    console.log('Checking for subcommunities...');
    const subcommunities = await this.client.getAllSubcommunities(mainCommunity.id);
    
    if (subcommunities.length > 0) {
      console.log(`✓ Found ${subcommunities.length} subcommunity(ies):`);
      subcommunities.forEach(sub => {
        console.log(`  - ${sub.name}`);
      });
    } else {
      console.log('✓ No subcommunities found');
    }
    
    // Return all communities (main + subcommunities)
    const allCommunities = [mainCommunity, ...subcommunities];
    return {
      mainCommunity,
      subcommunities,
      allCommunities,
      communityIds: allCommunities.map(c => c.id),
      communityNames: allCommunities.map(c => c.name)
    };
  }

  /**
   * Format responsibility owner for export
   */
  formatResponsibilityOwner(owner) {
    if (!owner) return null;
    
    if (owner.resourceType === 'User') {
      return {
        type: 'User',
        userName: owner.userName,
        fullName: owner.fullName,
        firstName: owner.firstName,
        lastName: owner.lastName,
        emailAddress: owner.emailAddress
      };
    } else if (owner.resourceType === 'UserGroup') {
      return {
        type: 'UserGroup',
        name: owner.name,
        description: owner.description
      };
    }
    
    return { type: owner.resourceType, id: owner.id };
  }

  /**
   * Transform GraphQL asset to export format
   */
  transformAsset(asset) {
    const transformed = {
      id: asset.id,
      name: asset.displayName,  // Use displayName since 'name' field doesn't exist in GraphQL
      displayName: asset.displayName,
      type: asset.type?.name,
      status: asset.status?.name,
      domain: {
        id: asset.domain?.id,
        name: asset.domain?.name,
        type: asset.domain?.type?.name
      },
      community: {
        id: asset.domain?.parent?.id,
        name: asset.domain?.parent?.name
      },
      tags: (asset.tags || []).map(tag => tag.name)
    };

    // Consolidate all attributes into a single array
    const allAttributes = [];
    
    if (asset.stringAttributes) {
      asset.stringAttributes.forEach(attr => {
        allAttributes.push({
          type: attr.type?.name,
          value: attr.stringValue,
          dataType: 'string'
        });
      });
    }

    if (asset.booleanAttributes) {
      asset.booleanAttributes.forEach(attr => {
        allAttributes.push({
          type: attr.type?.name,
          value: attr.booleanValue,
          dataType: 'boolean'
        });
      });
    }

    if (asset.numericAttributes) {
      asset.numericAttributes.forEach(attr => {
        allAttributes.push({
          type: attr.type?.name,
          value: attr.numericValue,
          dataType: 'numeric'
        });
      });
    }

    if (asset.dateAttributes) {
      asset.dateAttributes.forEach(attr => {
        allAttributes.push({
          type: attr.type?.name,
          value: attr.dateValue,
          dataType: 'date'
        });
      });
    }

    if (asset.multiValueAttributes) {
      asset.multiValueAttributes.forEach(attr => {
        allAttributes.push({
          type: attr.type?.name,
          value: attr.stringValues,
          dataType: 'multiValue'
        });
      });
    }

    if (allAttributes.length > 0) {
      transformed.attributes = allAttributes;
    }

    // Note: Responsibilities are fetched separately via REST API with inheritance
    // and added to the asset in exportCommunityByName method

    // Add relations
    const allRelations = [];

    if (asset.outgoingRelations) {
      asset.outgoingRelations.forEach(rel => {
        allRelations.push({
          direction: 'outgoing',
          relationType: rel.type?.role,
          relationTypeReverse: rel.type?.corole,
          relatedAsset: {
            id: rel.target?.id,
            displayName: rel.target?.displayName,
            type: rel.target?.type?.name
          }
        });
      });
    }

    if (asset.incomingRelations) {
      asset.incomingRelations.forEach(rel => {
        allRelations.push({
          direction: 'incoming',
          relationType: rel.type?.corole,
          relationTypeReverse: rel.type?.role,
          relatedAsset: {
            id: rel.source?.id,
            displayName: rel.source?.displayName,
            type: rel.source?.type?.name
          }
        });
      });
    }

    if (allRelations.length > 0) {
      transformed.relations = allRelations;
    }

    return transformed;
  }

  /**
   * Export community by name using GraphQL (includes subcommunities)
   */
  async exportCommunityByName(communityName, options = {}) {
    const {
      includeAttributes = true,
      includeRelations = true,
      outputDir = './exports'
    } = options;

    console.log(`\n📦 Exporting community: ${communityName} (via GraphQL)`);
    console.log('─'.repeat(50));

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      // Get community and all subcommunities
      const communityInfo = await this.getCommunityWithSubcommunities(communityName);
      const { mainCommunity, subcommunities, allCommunities, communityIds } = communityInfo;

      // Build WHERE clause - filter by all community IDs
      const whereClause = {
        domain: {
          parent: {
            id: { in: communityIds }
          }
        }
      };

      console.log(`\nExporting assets from ${allCommunities.length} communit${allCommunities.length === 1 ? 'y' : 'ies'}...\n`);

      // Fetch all assets across all communities
      const assets = await this.fetchAllAssets({
        whereClause,
        includeAttributes,
        includeRelations,
        includeResponsibilities: false
      });

      // Transform assets
      console.log('Transforming assets...');
      const transformedAssets = assets.map(asset => this.transformAsset(asset));

      // Group by domain
      const domainMap = {};
      transformedAssets.forEach(asset => {
        const domainName = asset.domain.name;
        if (!domainMap[domainName]) {
          domainMap[domainName] = {
            id: asset.domain.id,
            name: asset.domain.name,
            community: asset.community.name,  // Track which community each domain belongs to
            assets: []
          };
        }
        domainMap[domainName].assets.push(asset);
      });

      // Build export data structure
      const exportData = {
        community: {
          name: mainCommunity.name,
          id: mainCommunity.id,
          exportedAt: new Date().toISOString(),
          method: 'GraphQL',
          includesSubcommunities: subcommunities.length > 0,
          subcommunities: subcommunities.map(sub => ({
            id: sub.id,
            name: sub.name
          }))
        },
        domains: Object.values(domainMap),
        statistics: {
          totalCommunities: allCommunities.length,
          totalDomains: Object.keys(domainMap).length,
          totalAssets: transformedAssets.length,
          assetsWithAttributes: transformedAssets.filter(a => a.attributes && a.attributes.length > 0).length,
          assetsWithRelations: transformedAssets.filter(a => a.relations && a.relations.length > 0).length
        }
      };

      // Write to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${communityName.replace(/[^a-z0-9]/gi, '_')}_GraphQL_${timestamp}.json`;
      const filepath = path.join(outputDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
      
      console.log('\n✓ Export completed successfully!');
      console.log(`📊 Statistics:`);
      console.log(`   - Communities: ${exportData.statistics.totalCommunities} (${mainCommunity.name}${subcommunities.length > 0 ? ` + ${subcommunities.length} subcommunities` : ''})`);
      console.log(`   - Domains: ${exportData.statistics.totalDomains}`);
      console.log(`   - Assets: ${exportData.statistics.totalAssets}`);
      console.log(`   - With Attributes: ${exportData.statistics.assetsWithAttributes}`);
      console.log(`   - With Relations: ${exportData.statistics.assetsWithRelations}`);
      console.log(`📁 Output file: ${filepath}`);
      
      return filepath;

    } catch (error) {
      console.error('\n❌ Export failed:', error.message);
      throw error;
    }
  }

  /**
   * Export domain by name using GraphQL
   */
  async exportDomainByName(domainName, options = {}) {
    const {
      includeAttributes = true,
      includeRelations = true,
      outputDir = './exports'
    } = options;

    console.log(`\n📦 Exporting domain: ${domainName} (via GraphQL)`);
    console.log('─'.repeat(50));

    // Build WHERE clause to filter by domain name
    const whereClause = {
      domain: {
        name: { eq: domainName }
      }
    };

    try {
      // Fetch all assets in the domain
      const assets = await this.fetchAllAssets({
        whereClause,
        includeAttributes,
        includeRelations,
        includeResponsibilities: false  // We'll fetch these separately
      });

      // Transform assets
      console.log('Transforming assets...');
      const transformedAssets = assets.map(asset => this.transformAsset(asset));

      // Get community name from first asset
      const communityName = transformedAssets.length > 0 ? transformedAssets[0].community.name : 'Unknown';

      // Build export data structure
      const exportData = {
        community: {
          name: communityName,
          exportedAt: new Date().toISOString(),
          method: 'GraphQL'
        },
        domains: [{
          name: domainName,
          assets: transformedAssets
        }],
        statistics: {
          totalDomains: 1,
          totalAssets: transformedAssets.length,
          assetsWithAttributes: transformedAssets.filter(a => a.attributes && a.attributes.length > 0).length,
          assetsWithRelations: transformedAssets.filter(a => a.relations && a.relations.length > 0).length
        }
      };

      // Create output directory
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `Domain_${domainName.replace(/[^a-z0-9]/gi, '_')}_GraphQL_${timestamp}.json`;
      const filepath = path.join(outputDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
      
      console.log('\n✓ Export completed successfully!');
      console.log(`📊 Statistics:`);
      console.log(`   - Assets: ${exportData.statistics.totalAssets}`);
      console.log(`   - With Attributes: ${exportData.statistics.assetsWithAttributes}`);
      console.log(`   - With Relations: ${exportData.statistics.assetsWithRelations}`);
      console.log(`📁 Output file: ${filepath}`);
      
      return filepath;

    } catch (error) {
      console.error('\n❌ Export failed:', error.message);
      throw error;
    }
  }
}

module.exports = CollibraGraphQLExporter;
