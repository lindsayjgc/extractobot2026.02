const inquirer = require('inquirer');
const Table = require('cli-table3');
const createConfig = require('./src/setup');
const CollibraClient = require('./src/collibraClient');
const CollibraExporter = require('./src/collibraExporter');

const displayWelcome = () => {
  console.clear();
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Collibra Community Export Tool      ║');
  console.log('╚════════════════════════════════════════╝\n');
};

const displayCommunities = (communities) => {
  const table = new Table({
    head: ['#', 'Community Name', 'Description'],
    colWidths: [5, 40, 50],
    wordWrap: true
  });

  communities.forEach((comm, index) => {
    table.push([
      index + 1,
      comm.name,
      comm.description || 'No description'
    ]);
  });

  console.log(table.toString());
  console.log(`\nTotal communities: ${communities.length}\n`);
};

const selectCommunities = async (communities) => {
  const choices = communities.map((comm, index) => ({
    name: `${comm.name}${comm.description ? ` - ${comm.description.substring(0, 60)}` : ''}`,
    value: index,
    short: comm.name
  }));

  const { selectedIndices } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedIndices',
      message: 'Select communities to export (use space to select, enter to confirm):',
      choices,
      pageSize: 15
    }
  ]);

  return selectedIndices.map(index => communities[index]);
};

const configureExportOptions = async () => {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'includeAssets',
      message: 'Include assets?',
      default: true
    },
    {
      type: 'confirm',
      name: 'includeAttributes',
      message: 'Include asset attributes?',
      default: true,
      when: (answers) => answers.includeAssets
    },
    {
      type: 'confirm',
      name: 'includeRelations',
      message: 'Include asset relations?',
      default: false,
      when: (answers) => answers.includeAssets
    },
    {
      type: 'confirm',
      name: 'includeResponsibilities',
      message: 'Include asset responsibilities (users & roles with inheritance)?',
      default: false,
      when: (answers) => answers.includeAssets
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory:',
      default: './exports'
    }
  ]);

  return answers;
};

const main = async () => {
  try {
    displayWelcome();

    // Check if config exists, if not create it
    const createConfig = require('./src/setup');
    await createConfig();

    console.log('\n🔌 Connecting to Collibra...\n');

    // Initialize client
    const client = new CollibraClient();
    client.loadConfig();
    
    const authenticated = await client.authenticate();
    if (!authenticated) {
      console.error('Failed to authenticate. Please check your credentials.');
      process.exit(1);
    }

    // Fetch communities
    console.log('📋 Fetching communities...\n');
    const communitiesResponse = await client.getCommunities();
    const communities = communitiesResponse.results || [];

    if (communities.length === 0) {
      console.log('No communities found in your Collibra instance.');
      process.exit(0);
    }

    // Display communities
    displayCommunities(communities);

    // Main menu
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Select specific communities to export', value: 'select' },
          { name: 'Export all communities', value: 'all' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);

    if (action === 'exit') {
      console.log('Goodbye!');
      process.exit(0);
    }

    // Select communities
    let selectedCommunities;
    if (action === 'select') {
      selectedCommunities = await selectCommunities(communities);
      if (selectedCommunities.length === 0) {
        console.log('No communities selected. Exiting.');
        process.exit(0);
      }
    } else {
      selectedCommunities = communities;
    }

    // Configure export options
    console.log('\n⚙️  Export Options\n');
    const exportOptions = await configureExportOptions();

    // Confirm export
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Ready to export ${selectedCommunities.length} communit${selectedCommunities.length === 1 ? 'y' : 'ies'}?`,
        default: true
      }
    ]);

    if (!confirm) {
      console.log('Export cancelled.');
      process.exit(0);
    }

    // Perform export
    console.log('\n🚀 Starting export...\n');
    const exporter = new CollibraExporter(client);
    
    if (selectedCommunities.length === 1) {
      await exporter.exportCommunity(selectedCommunities[0], exportOptions);
    } else {
      const results = await exporter.exportMultipleCommunities(selectedCommunities, exportOptions);
      
      console.log('\n📊 Export Summary:');
      results.forEach(result => {
        const status = result.success ? '✓' : '✗';
        console.log(`  ${status} ${result.community}`);
        if (!result.success) {
          console.log(`    Error: ${result.error}`);
        }
      });
    }

    console.log('\n✨ All done!\n');

  } catch (error) {
    console.error('\n❌ An error occurred:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the application
main();
