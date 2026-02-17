const CollibraClient = require('../src/collibraClient');

/**
 * Simple test script to verify Collibra API connectivity
 * Usage: node testConnection.js
 */

const test = async () => {
  console.log('=== Collibra API Connection Test ===\n');

  try {
    // Initialize client
    console.log('1. Loading configuration...');
    const client = new CollibraClient();
    client.loadConfig();
    console.log('✓ Configuration loaded');
    console.log(`   Domain: ${client.config.domain}`);
    console.log(`   Username: ${client.config.username}\n`);

    // Test authentication
    console.log('2. Testing authentication...');
    const authenticated = await client.authenticate();
    if (!authenticated) {
      console.error('✗ Authentication failed');
      process.exit(1);
    }
    console.log('✓ Authentication successful\n');

    // Test communities endpoint
    console.log('3. Testing /communities endpoint...');
    const communitiesResponse = await client.getCommunities({ limit: 5 });
    const communities = communitiesResponse.results || [];
    console.log(`✓ Retrieved ${communities.length} communities (limited to 5)`);
    if (communities.length > 0) {
      console.log('   Sample community:', communities[0].name);
    }
    console.log(`   Total available: ${communitiesResponse.total || 'unknown'}\n`);

    // Test domains endpoint
    if (communities.length > 0) {
      console.log('4. Testing /domains endpoint...');
      const domainsResponse = await client.getDomains(communities[0].id, { limit: 5 });
      const domains = domainsResponse.results || [];
      console.log(`✓ Retrieved ${domains.length} domains from "${communities[0].name}"`);
      if (domains.length > 0) {
        console.log('   Sample domain:', domains[0].name);
      }
      console.log(`   Total available: ${domainsResponse.total || 'unknown'}\n`);

      // Test assets endpoint
      if (domains.length > 0) {
        console.log('5. Testing /assets endpoint...');
        const assetsResponse = await client.getAssets(domains[0].id, { limit: 5 });
        const assets = assetsResponse.results || [];
        console.log(`✓ Retrieved ${assets.length} assets from "${domains[0].name}"`);
        if (assets.length > 0) {
          console.log('   Sample asset:', assets[0].displayName || assets[0].name);
          
          // Test asset details
          console.log('\n6. Testing asset details endpoint...');
          const assetDetails = await client.getAssetDetails(assets[0].id);
          console.log(`✓ Retrieved details for "${assetDetails.displayName || assetDetails.name}"`);
          console.log(`   Type: ${assetDetails.type?.name || 'N/A'}`);
          console.log(`   Status: ${assetDetails.status?.name || 'N/A'}`);

          // Test asset attributes
          console.log('\n7. Testing asset attributes endpoint...');
          const attributesResponse = await client.getAssetAttributes(assets[0].id);
          const attributes = attributesResponse.results || [];
          console.log(`✓ Retrieved ${attributes.length} attributes`);
          if (attributes.length > 0) {
            console.log(`   Sample attribute: ${attributes[0].type?.name || 'N/A'}`);
          }
        }
        console.log(`   Total available: ${assetsResponse.total || 'unknown'}\n`);
      }
    }

    // Test GraphQL endpoint
    console.log('8. Testing GraphQL endpoint...');
    const graphQLQuery = `{
      assets(limit: 5) {
        displayName
        type { name }
        status { name }
        domain {
          name
          parent { name }
        }
      }
    }`;
    
    try {
      const graphQLResponse = await client.makeGraphQLRequest(graphQLQuery);
      
      if (graphQLResponse.errors) {
        console.error('✗ GraphQL query returned errors:', JSON.stringify(graphQLResponse.errors, null, 2));
      } else {
        const graphAssets = graphQLResponse.data?.assets || [];
        console.log(`✓ Retrieved ${graphAssets.length} assets via GraphQL`);
        if (graphAssets.length > 0) {
          console.log(`   Sample asset: ${graphAssets[0].displayName}`);
          console.log(`   Domain: ${graphAssets[0].domain?.name || 'N/A'}`);
          console.log(`   Community: ${graphAssets[0].domain?.parent?.name || 'N/A'}`);
        }
      }
    } catch (error) {
      console.error('✗ GraphQL endpoint test failed:', error.message);
      if (error.response) {
        console.error('   Response:', JSON.stringify(error.response.data, null, 2));
      }
    }

    console.log('\n✅ All tests passed!');
    console.log('Your Collibra API connection is working correctly.');
    console.log('\n💡 Recommendation: Use GraphQL for faster exports!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('\nError details:');
      console.error('   Status:', error.response.status);
      console.error('   Status text:', error.response.statusText);
      console.error('   URL:', error.response.config.url);
      if (error.response.data) {
        console.error('   Response:', JSON.stringify(error.response.data, null, 2));
      }
    }
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
};

// Run the test
test();
