# Extractobot - Collibra Community Export Tool

A Node.js application for exporting data from Collibra communities with **GraphQL** and REST API support.

## ⚡ New: GraphQL Support - 60-100x Faster!

Export entire communities in seconds instead of minutes with our new GraphQL exporter:

- **One query** gets all assets, attributes, relations, and responsibilities
- **Automatic pagination** for large datasets
- **60-100x faster** than REST API for typical communities
- **Same JSON output format** as REST exports

See [GRAPHQL_GUIDE.md](GRAPHQL_GUIDE.md) for details.

## Features

- 🚀 **GraphQL Export** - Blazing fast, single-query exports (Recommended)
- 🔧 **REST API Export** - Traditional multi-call exports with interactive browsing
- 🔐 Secure authentication with your Collibra instance (Basic Auth)
- 📋 Interactive community selection (REST mode)
- 📦 Export entire communities or specific domains
- 🎯 Configurable export options (assets, attributes, relations, responsibilities)
- 📊 Detailed export statistics
- 💾 JSON output format for easy data analysis
- ⚡ Automatic pagination for large datasets
- 🛡️ Robust error handling with detailed diagnostics

## Installation

1. Clone or download this repository
2. Install dependencies:

```bash
npm install
```

## Quick Start

### Method 1: GraphQL Export (Recommended - Fastest)

```bash
npm install
npm start
```

1. Select **GraphQL** when prompted
2. Choose to export a **Community** or **Domain**
3. Enter the exact name (e.g., "Oracle HR Cloud")
4. Configure what to include (attributes, relations, responsibilities)
5. Confirm and watch it export in seconds! ⚡

**Example:**
- Community with 147 assets
- GraphQL: ~5 seconds
- REST API: ~3-5 minutes

### Method 2: REST API Export (Interactive Browse)

```bash
npm start
```

1. Select **REST API** when prompted
2. Browse and select from list of communities
3. Configure export options
4. Export one or multiple communities

Good for: Exploring available communities, bulk exports

### Test Your Connection

Before running exports:

```bash
npm test
```

This tests both REST API and GraphQL endpoints.

## GraphQL vs REST API Comparison

| Feature | GraphQL ⚡ | REST API 🔧 |
|---------|---------|----------|
| **Speed** | 60-100x faster | Slower (many calls) |
| **API Calls** | 1-5 total | 100s-1000s |
| **All Attributes** | ✅ One call | ❌ Many calls |
| **Relations** | ✅ Included | ⚠️ Optional (slow) |
| **Responsibilities** | ✅ Included | ⚠️ Optional (slow) |
| **Browse Communities** | ❌ Manual entry | ✅ Interactive list |
| **Bulk Export** | One at a time | ✅ Multiple at once |
| **Best For** | Single community exports | Exploring & bulk operations |

**💡 Recommendation:** Use GraphQL for 90% of exports. Use REST only when browsing or bulk exporting unrelated communities.

## Usage

### First Time Setup

On your first run, the application will:
1. Prompt you for your Collibra instance URL (e.g., `your-company.collibra.com`)
2. Ask for your username and password
3. Test the connection
4. Save the configuration to `config.json`

### Exporting Communities

The interactive CLI will guide you through:

1. **View Communities** - See all available communities in a formatted table
2. **Select Communities** - Choose specific communities or export all
3. **Configure Options**:
   - Include/exclude assets
   - Include/exclude asset attributes
   - Include/exclude asset relations
   - Include/exclude asset responsibilities (stewards, owners)
   - Set output directory
4. **Confirm & Export** - Review your selections and start the export

### Export Output

Exports are saved as JSON files in the `./exports` directory (or your custom directory).

**File naming format:** `CommunityName_TIMESTAMP.json`

**Export structure:**
```json
{
  "community": {
    "id": "...",
    "name": "Community Name",
    "description": "...",
    "exportedAt": "2024-..."
  },
  "domains": [
    {
      "id": "...",
      "name": "Domain Name",
      "assets": [
        {
          "id": "...",
          "name": "Asset Name",
          "type": "Data Set",
          "attributes": [...],
          "relations": [...],
          "responsibilities": [...]
        }
      ]
    }
  ],
  "statistics": {
    "totalDomains": 10,
    "totalAssets": 150
  }
}
```

## Configuration

The `config.json` file stores your connection details:

```json
{
  "domain": "your-company.collibra.com",
  "apiURL": "https://your-company.collibra.com/rest/2.0",
  "graphURL": "https://your-company.collibra.com/graphql/knowledgeGraph/v1",
  "username": "your-username",
  "password": "your-password"
}
```

⚠️ **Security Note:** Keep `config.json` secure and never commit it to version control.

## Project Structure

```
extractobot/
├── indexGraphQL.js              # Main application (GraphQL + REST)
├── index.js                     # REST API only application
├── 1-getStarted.js              # Configuration setup module
├── collibraClient.js            # Collibra API client (Basic Auth)
├── collibraExporter.js          # REST API export logic
├── collibraGraphQLExporter.js   # GraphQL export logic
├── testConnection.js            # Connection test utility (REST + GraphQL)
├── viewExport.js                # Export analysis utility
├── package.json                 # Dependencies
├── config.json                  # Connection configuration (generated)
├── README.md                    # This file
├── GRAPHQL_GUIDE.md             # GraphQL usage guide
├── API_REFERENCE.md             # REST API quick reference
├── CHANGELOG.md                 # Version history
└── exports/                     # Export output directory (generated)
```

## API Coverage

### GraphQL API (Recommended)
**Endpoint:** POST /graphql/knowledgeGraph/v1

Single query retrieves:
- Assets with filtering (by community, domain, type, status, etc.)
- All attribute types (string, boolean, numeric, date, multi-value)
- Relations (incoming and outgoing)
- Responsibilities
- Domain and Community hierarchy
- Tags

See [GRAPHQL_GUIDE.md](GRAPHQL_GUIDE.md) for query examples.

### REST API 2.0
**Base URL:** /rest/2.0

Endpoints used:
- Communities (GET /communities)
- Domains (GET /domains)
- Assets (GET /assets)
- Asset Attributes (GET /assets/{id}/attributes)
- Asset Relations (GET /assets/{id}/relations)
- Asset Responsibilities (GET /assets/{id}/responsibilities)

**Authentication:** HTTP Basic Authentication (both APIs)

## Requirements

- Node.js 14.x or higher
- Access to a Collibra instance
- Valid Collibra user credentials with read permissions

## Troubleshooting

### 405 Method Not Allowed
- **Fixed:** Updated to use Basic Authentication instead of session cookies
- Ensure your credentials are correct in `config.json`

### Authentication Failed
- Verify your credentials are correct
- Check that your user has appropriate permissions
- Ensure the Collibra instance URL is correct (without `https://`)
- Try running `node testConnection.js` to diagnose the issue

### No Communities Found
- Verify your user has access to communities
- Check your user permissions in Collibra
- Meta communities are excluded by default (set `excludeMeta: false` to include them)

### Export Fails
- Check network connectivity
- Verify you have read permissions for the selected communities
- Ensure sufficient disk space for exports
- Check error messages for specific API endpoint failures

### Connection Test Failures
Run the test utility for detailed diagnostics:
```bash
node testConnection.js
```

This will show exactly where the connection is failing.

## Performance Considerations

- **Large Communities:** Exports with thousands of assets may take several minutes
- **Pagination:** The tool automatically handles pagination for large datasets
- **API Limits:** Respects Collibra's 1000-item limit per request
- **Progress Indicators:** Shows progress every 10 assets processed

## Utilities

### View Export Summary
Analyze exported data without opening the JSON file:

```bash
node viewExport.js exports/YourCommunity_timestamp.json
```

Shows:
- Community information
- Domain breakdown
- Asset type statistics
- Attribute and relation counts

## Future Enhancements

Potential features for future versions:
- Export to CSV format
- Filter assets by type or status
- Incremental exports (only changed data)
- Schedule automated exports
- GraphQL query support for complex data structures
- Excel output with multiple sheets
- Comparison between export versions

## License

ISC

## Support

For issues or questions:
- Collibra API Documentation: https://developer.collibra.com/
- REST API Reference: https://developer.collibra.com/rest/2.0/reference/

