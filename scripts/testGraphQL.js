const CollibraClient = require('../src/collibraClient');
const CollibraGraphQLExporter = require('../src/collibraGraphQLExporter');

/**
 * Test GraphQL query syntax
 * Usage: node testGraphQL.js [community-name]
 */

const testQuery = async (communityName = 'Landing Zone') => {
  console.log('=== GraphQL Query Syntax Test ===\n');

  try {
    // Initialize
    const client = new CollibraClient();
    client.loadConfig();
    await client.authenticate();

    const exporter = new CollibraGraphQLExporter(client);

    // Build WHERE clause
    const whereClause = {
      domain: {
        parent: {
          name: { eq: communityName }
        }
      }
    };

    console.log('1. JavaScript WHERE clause:');
    console.log(JSON.stringify(whereClause, null, 2));
    console.log();

    console.log('2. GraphQL WHERE clause:');
    const graphqlWhere = exporter.toGraphQLInputObject(whereClause);
    console.log(graphqlWhere);
    console.log();

    console.log('3. Building full query...');
    const query = exporter.buildAssetsQuery({
      limit: 5,
      offset: null,
      whereClause,
      includeAttributes: true,
      includeRelations: false,
      includeResponsibilities: false
    });

    console.log('4. Full GraphQL query:');
    console.log(query);
    console.log();

    console.log('5. Testing query execution...');
    const response = await client.makeGraphQLRequest(query);

    if (response.errors) {
      console.error('❌ GraphQL errors:');
      console.error(JSON.stringify(response.errors, null, 2));
      process.exit(1);
    }

    const assets = response.data?.assets || [];
    console.log(`✅ Query successful! Retrieved ${assets.length} assets`);
    
    if (assets.length > 0) {
      console.log('\nSample asset:');
      console.log(`  Name: ${assets[0].displayName}`);
      console.log(`  Domain: ${assets[0].domain?.name || 'N/A'}`);
      console.log(`  Community: ${assets[0].domain?.parent?.name || 'N/A'}`);
      console.log(`  Type: ${assets[0].type?.name || 'N/A'}`);
      
      const attrCount = (assets[0].stringAttributes?.length || 0) +
                       (assets[0].booleanAttributes?.length || 0) +
                       (assets[0].numericAttributes?.length || 0) +
                       (assets[0].dateAttributes?.length || 0) +
                       (assets[0].multiValueAttributes?.length || 0);
      console.log(`  Attributes: ${attrCount}`);
    } else {
      console.log('\n⚠️  No assets found in this community.');
      console.log('   Check the community name or try a different one.');
    }

    console.log('\n✅ GraphQL syntax test passed!');
    console.log('You can now run: npm start');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
};

// Get community name from command line or use default
const communityName = process.argv[2] || 'Landing Zone';
console.log(`Testing with community: "${communityName}"\n`);

testQuery(communityName);
