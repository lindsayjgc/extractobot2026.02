const fs = require('fs');
const path = require('path');
const Table = require('cli-table3');

/**
 * Utility script to view summaries of exported Collibra data
 * Usage: node viewExport.js [filename]
 */

const viewExport = (filename) => {
  if (!fs.existsSync(filename)) {
    console.error(`File not found: ${filename}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     Export Summary                     ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Community info
  console.log('📦 Community Information:');
  console.log(`   Name: ${data.community.name}`);
  console.log(`   ID: ${data.community.id}`);
  if (data.community.description) {
    console.log(`   Description: ${data.community.description}`);
  }
  console.log(`   Exported: ${new Date(data.community.exportedAt).toLocaleString()}`);

  // Statistics
  console.log('\n📊 Statistics:');
  console.log(`   Domains: ${data.statistics.totalDomains}`);
  console.log(`   Total Assets: ${data.statistics.totalAssets}`);

  // Domain breakdown
  if (data.domains && data.domains.length > 0) {
    console.log('\n📁 Domains:\n');
    
    const table = new Table({
      head: ['Domain Name', 'Type', 'Assets'],
      colWidths: [40, 25, 10]
    });

    data.domains.forEach(domain => {
      table.push([
        domain.name,
        domain.type || 'N/A',
        domain.assets ? domain.assets.length : 0
      ]);
    });

    console.log(table.toString());

    // Asset type breakdown
    const assetTypes = {};
    let totalWithAttributes = 0;
    let totalWithRelations = 0;

    data.domains.forEach(domain => {
      if (domain.assets) {
        domain.assets.forEach(asset => {
          const type = asset.type || 'Unknown';
          assetTypes[type] = (assetTypes[type] || 0) + 1;
          
          if (asset.attributes && asset.attributes.length > 0) {
            totalWithAttributes++;
          }
          if (asset.relations && asset.relations.length > 0) {
            totalWithRelations++;
          }
        });
      }
    });

    if (Object.keys(assetTypes).length > 0) {
      console.log('\n🏷️  Asset Types:\n');
      
      const assetTable = new Table({
        head: ['Asset Type', 'Count'],
        colWidths: [50, 10]
      });

      Object.entries(assetTypes)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          assetTable.push([type, count]);
        });

      console.log(assetTable.toString());
    }

    // Additional metadata
    if (totalWithAttributes > 0 || totalWithRelations > 0) {
      console.log('\n📋 Additional Data:');
      if (totalWithAttributes > 0) {
        console.log(`   Assets with attributes: ${totalWithAttributes}`);
      }
      if (totalWithRelations > 0) {
        console.log(`   Assets with relations: ${totalWithRelations}`);
      }
    }
  }

  console.log('\n✓ View complete\n');
};

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node viewExport.js <export-file.json>');
  console.log('\nExample: node viewExport.js exports/MyCommunity_2024-01-15.json');
  
  // List available exports
  const exportsDir = './exports';
  if (fs.existsSync(exportsDir)) {
    const files = fs.readdirSync(exportsDir).filter(f => f.endsWith('.json'));
    if (files.length > 0) {
      console.log('\nAvailable exports:');
      files.forEach(file => {
        console.log(`  - ${file}`);
      });
    }
  }
  process.exit(0);
}

const filename = args[0];
viewExport(filename);
