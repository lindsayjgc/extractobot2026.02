const CollibraClient = require('../src/collibraClient');

/**
 * Display community hierarchy
 * Usage: node showCommunities.js
 */

const showHierarchy = async () => {
  console.log('=== Collibra Community Hierarchy ===\n');

  try {
    const client = new CollibraClient();
    client.loadConfig();
    await client.authenticate();
    
    console.log('Fetching communities...\n');
    const response = await client.getCommunities({ limit: 1000 });
    const communities = response.results || [];
    
    console.log(`Found ${communities.length} total communities\n`);
    
    // Separate root and child communities
    const roots = communities.filter(c => !c.parent);
    const children = communities.filter(c => c.parent);
    
    console.log(`Root communities: ${roots.length}`);
    console.log(`Subcommunities: ${children.length}\n`);
    console.log('─'.repeat(60));
    console.log();
    
    // Build hierarchy
    const printHierarchy = (parentId, indent = 0) => {
      const childComms = communities.filter(c => c.parent?.id === parentId);
      
      childComms.forEach((child, index) => {
        const isLast = index === childComms.length - 1;
        const prefix = '  '.repeat(indent) + (isLast ? '└─ ' : '├─ ');
        
        console.log(`${prefix}${child.name}`);
        
        // Check if this child has children
        const grandchildren = communities.filter(c => c.parent?.id === child.id);
        if (grandchildren.length > 0) {
          printHierarchy(child.id, indent + 1);
        }
      });
    };
    
    // Print each root and its tree
    roots.forEach((root, rootIndex) => {
      const childCount = communities.filter(c => c.parent?.id === root.id).length;
      
      // Count all descendants recursively
      const countDescendants = (parentId) => {
        const directChildren = communities.filter(c => c.parent?.id === parentId);
        let total = directChildren.length;
        directChildren.forEach(child => {
          total += countDescendants(child.id);
        });
        return total;
      };
      
      const totalDescendants = countDescendants(root.id);
      
      console.log(`${root.name}`);
      if (totalDescendants > 0) {
        console.log(`  (${totalDescendants} subcommunity(ies))`);
      }
      
      printHierarchy(root.id, 1);
      
      if (rootIndex < roots.length - 1) {
        console.log();
      }
    });
    
    console.log();
    console.log('─'.repeat(60));
    console.log();
    console.log('💡 Tips:');
    console.log('  - Exporting a root community includes ALL subcommunities');
    console.log('  - Exporting a subcommunity includes only its children');
    console.log('  - Use GraphQL for fastest hierarchical exports');
    console.log();
    console.log('To export a community with subcommunities:');
    console.log('  npm start');
    console.log('  → GraphQL → Community → [community name]');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

showHierarchy();
