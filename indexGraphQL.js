const inquirer = require('inquirer');
const Table = require('cli-table3');
const createConfig = require('./src/setup');
const CollibraClient = require('./src/collibraClient');
const CollibraExporter = require('./src/collibraExporter');
const CollibraGraphQLExporter = require('./src/collibraGraphQLExporter');

const displayWelcome = () => {
  console.clear();
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Collibra Export Tool - GraphQL       ║');
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
      message: 'Include all asset attributes (string, numeric, date, etc.)?',
      default: true,
      when: (answers) => answers.includeAssets
    },
    {
      type: 'confirm',
      name: 'includeRelations',
      message: 'Include asset relations (incoming & outgoing)?',
      default: true,
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

    // GraphQL Export Flow (only option now)
    const { exportType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'exportType',
        message: 'What would you like to export?',
        choices: [
          { name: 'Community (browse and select from list)', value: 'community' },
          { name: 'Domain (browse and select from list)', value: 'domain' },
          { name: '❌ Exit', value: 'exit' }
        ]
      }
    ]);

    if (exportType === 'exit') {
      console.log('Goodbye!');
      process.exit(0);
    }

    let targetName;

      if (exportType === 'community') {
        // Fetch communities and show in a list
        console.log('\n📋 Fetching communities...\n');
        const communitiesResponse = await client.getCommunities();
        const communities = communitiesResponse.results || [];

        if (communities.length === 0) {
          console.log('No communities found in your Collibra instance.');
          process.exit(0);
        }

        // Separate root and all communities
        const rootCommunities = communities.filter(c => !c.parent);
        
        // Ask if user wants to see all or just roots
        const { showAllCommunities } = await inquirer.prompt([
          {
            type: 'list',
            name: 'showAllCommunities',
            message: 'Which communities do you want to see?',
            choices: [
              { name: `Root communities only (${rootCommunities.length})`, value: false },
              { name: `All communities including subcommunities (${communities.length})`, value: true }
            ]
          }
        ]);

        const communitiesToShow = showAllCommunities ? communities : rootCommunities;

        // Display communities table
        displayCommunities(communitiesToShow);

        // Let user select from list
        const { selectedIndex } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedIndex',
            message: 'Select community to export:',
            choices: communitiesToShow.map((comm, index) => {
              // Show parent info for subcommunities if showing all
              let display = comm.name;
              if (showAllCommunities && comm.parent) {
                display = `${comm.name} (child of: ${comm.parent.name})`;
              }
              if (comm.description) {
                display = `${display} - ${comm.description.substring(0, 40)}`;
              }
              return {
                name: display,
                value: index,
                short: comm.name
              };
            }),
            pageSize: 15
          }
        ]);

        targetName = communitiesToShow[selectedIndex].name;
        const selectedCommunity = communitiesToShow[selectedIndex];
        console.log(`\n✓ Selected: ${targetName}`);
        
        // Show note about subcommunities
        if (!selectedCommunity.parent) {
          console.log('ℹ️  Note: This export will include all subcommunities automatically.\n');
        } else {
          console.log('ℹ️  Note: This export will include any subcommunities of this community.\n');
        }

      } else {
        // Domain export - fetch and show list
        console.log('\n📋 Fetching domains...\n');
        
        const domainsResponse = await client.makeRequest('/domains', { 
          limit: 1000, 
          sortField: 'NAME', 
          sortOrder: 'ASC',
          excludeMeta: true 
        });
        const domains = domainsResponse.results || [];

        if (domains.length === 0) {
          console.log('No domains found in your Collibra instance.');
          process.exit(0);
        }

        console.log(`Found ${domains.length} domains\n`);

        // Let user select domain from list
        const { selectedDomainIndex } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedDomainIndex',
            message: 'Select domain to export:',
            choices: domains.map((domain, index) => ({
              name: domain.description 
                ? `${domain.name} - ${domain.description.substring(0, 50)}`
                : domain.name,
              value: index,
              short: domain.name
            })),
            pageSize: 15
          }
        ]);

        targetName = domains[selectedDomainIndex].name;
        console.log(`\n✓ Selected: ${targetName}\n`);
      }

      // Configure export options
      console.log('⚙️  Export Options\n');
      const exportOptions = await configureExportOptions();

      // Confirm export
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Ready to export ${exportType} "${targetName}" via GraphQL?`,
          default: true
        }
      ]);

      if (!confirm) {
        console.log('Export cancelled.');
        process.exit(0);
      }

      // Perform GraphQL export
      console.log('\n🚀 Starting GraphQL export...\n');
      const graphQLExporter = new CollibraGraphQLExporter(client);
      
      if (exportType === 'community') {
        await graphQLExporter.exportCommunityByName(targetName, exportOptions);
      } else {
        await graphQLExporter.exportDomainByName(targetName, exportOptions);
      }

    console.log('\n✨ All done!\n');

  } catch (error) {
    console.error('\n❌ An error occurred:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the application
main();
