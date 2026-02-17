const fs = require('fs');
const path = require('path');

class CollibraExporter {
  constructor(client) {
    this.client = client;
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

  async exportCommunity(community, options = {}) {
    const {
      includeAssets = true,
      includeAttributes = true,
      includeRelations = false,
      includeResponsibilities = false,
      outputDir = './exports',
      includeSubcommunities = true
    } = options;

    console.log(`\n📦 Exporting community: ${community.name}`);
    console.log('─'.repeat(50));

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const exportData = {
      community: {
        id: community.id,
        name: community.name,
        description: community.description,
        exportedAt: new Date().toISOString()
      },
      domains: [],
      statistics: {
        totalCommunities: 1,
        totalDomains: 0,
        totalAssets: 0
      }
    };

    try {
      // Get subcommunities if requested
      let allCommunities = [community];
      
      if (includeSubcommunities) {
        console.log('Checking for subcommunities...');
        const subcommunities = await this.client.getAllSubcommunities(community.id);
        
        if (subcommunities.length > 0) {
          console.log(`✓ Found ${subcommunities.length} subcommunity(ies):`);
          subcommunities.forEach(sub => {
            console.log(`  - ${sub.name}`);
          });
          allCommunities = [community, ...subcommunities];
          
          exportData.community.includesSubcommunities = true;
          exportData.community.subcommunities = subcommunities.map(sub => ({
            id: sub.id,
            name: sub.name
          }));
        } else {
          console.log('✓ No subcommunities found');
          exportData.community.includesSubcommunities = false;
        }
        
        exportData.statistics.totalCommunities = allCommunities.length;
      }

      // Process all communities (main + subcommunities)
      for (const comm of allCommunities) {
        if (allCommunities.length > 1) {
          console.log(`\nProcessing community: ${comm.name}`);
        }
        
        // Get all domains in the community
        console.log('Fetching domains...');
        const domainsResponse = await this.client.getDomains(comm.id);
        const domains = domainsResponse.results || [];
        exportData.statistics.totalDomains += domains.length;
        console.log(`✓ Found ${domains.length} domains`);

        // Process each domain
        for (const domain of domains) {
          console.log(`  Processing domain: ${domain.name}`);
          
          const domainData = {
            id: domain.id,
            name: domain.name,
            description: domain.description,
            type: domain.type?.name,
            community: comm.name,  // Track which community this domain belongs to
            assets: []
          };

          if (includeAssets) {
            // Get all assets in the domain (with pagination)
            console.log(`    Fetching assets...`);
            const assets = await this.client.fetchAllPages('/assets', { domainId: domain.id, sortField: 'NAME', sortOrder: 'ASC', excludeMeta: true });
            exportData.statistics.totalAssets += assets.length;
            console.log(`    ✓ Found ${assets.length} assets`);

            // Process each asset
            let processedCount = 0;
            for (const asset of assets) {
              const assetData = {
                id: asset.id,
                name: asset.name,
                displayName: asset.displayName,
                type: asset.type?.name,
                status: asset.status?.name
              };

              if (includeAttributes) {
                try {
                  const attributes = await this.client.getAssetAttributes(asset.id);
                  assetData.attributes = (attributes.results || []).map(attr => ({
                    type: attr.type?.name,
                    value: attr.value
                  }));
                } catch (error) {
                  console.error(`      Error fetching attributes for ${asset.name}:`, error.message);
                  assetData.attributes = [];
                }
              }

              if (includeRelations) {
                try {
                  const relations = await this.client.getAssetRelations(asset.id);
                  assetData.relations = (relations.results || []).map(rel => ({
                    type: rel.type?.role || rel.type?.corole,
                    targetId: rel.target?.id,
                    targetName: rel.target?.name
                  }));
                } catch (error) {
                  console.error(`      Error fetching relations for ${asset.name}:`, error.message);
                  assetData.relations = [];
                }
              }

              if (includeResponsibilities) {
                try {
                  // Get responsibilities with enriched user details and inheritance
                  const responsibilitiesData = await this.client.getAssetResponsibilitiesEnriched(asset.id, true);
                  
                  assetData.responsibilities = {
                    summary: responsibilitiesData.summary,
                    direct: responsibilitiesData.direct.map(r => ({
                      role: r.role?.name,
                      owner: this.formatResponsibilityOwner(r.owner),
                      baseResource: r.baseResource?.name
                    })),
                    inherited: {
                      fromCommunity: responsibilitiesData.inherited.fromCommunity.map(r => ({
                        role: r.role?.name,
                        owner: this.formatResponsibilityOwner(r.owner),
                        baseResource: r.baseResource?.name,
                        baseResourceType: r.baseResource?.resourceType
                      })),
                      fromDomain: responsibilitiesData.inherited.fromDomain.map(r => ({
                        role: r.role?.name,
                        owner: this.formatResponsibilityOwner(r.owner),
                        baseResource: r.baseResource?.name,
                        baseResourceType: r.baseResource?.resourceType
                      }))
                    }
                  };
                } catch (error) {
                  console.error(`      Error fetching responsibilities for ${asset.name}:`, error.message);
                  assetData.responsibilities = { 
                    summary: { total: 0, direct: 0, inherited: 0 }, 
                    direct: [], 
                    inherited: { fromCommunity: [], fromDomain: [] } 
                  };
                }
              }

              domainData.assets.push(assetData);
              
              // Progress indicator
              processedCount++;
              if (processedCount % 10 === 0) {
                console.log(`    Processed ${processedCount}/${assets.length} assets...`);
              }
            }
          }

          exportData.domains.push(domainData);
        }
      }

      // Write to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${community.name.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.json`;
      const filepath = path.join(outputDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
      
      console.log('\n✓ Export completed successfully!');
      console.log(`📊 Statistics:`);
      console.log(`   - Communities: ${exportData.statistics.totalCommunities} (${community.name}${exportData.community.subcommunities?.length > 0 ? ` + ${exportData.community.subcommunities.length} subcommunities` : ''})`);
      console.log(`   - Domains: ${exportData.statistics.totalDomains}`);
      console.log(`   - Assets: ${exportData.statistics.totalAssets}`);
      console.log(`📁 Output file: ${filepath}`);
      
      return filepath;

    } catch (error) {
      console.error('\n❌ Export failed:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response:', error.response.data);
      }
      throw error;
    }
  }

  async exportMultipleCommunities(communities, options = {}) {
    const results = [];
    
    for (const community of communities) {
      try {
        const filepath = await this.exportCommunity(community, options);
        results.push({ community: community.name, success: true, filepath });
      } catch (error) {
        results.push({ community: community.name, success: false, error: error.message });
      }
    }

    return results;
  }
}

module.exports = CollibraExporter;
