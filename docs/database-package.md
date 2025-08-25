# Database Package Documentation

This document outlines the `packages/db` package implementation, providing Supabase client utilities and migration tooling for the Nexus financial automation platform.

## Overview

The `packages/db` package centralizes database access patterns and migration management. It provides typed Supabase clients with appropriate permission levels and automated SQL migration execution following **D-1** and **S-1** best practices from CLAUDE.md.

## Package Structure

```
packages/db/
├── package.json          # Package configuration and scripts
├── index.ts              # Main entry point with client functions
├── scripts/
│   └── migrate.ts        # Migration execution script
└── migrations/
    ├── 001_init.sql      # Initial schema and seed data
    └── 002_rls.sql       # Row Level Security policies
```

## Core Implementation

### Supabase Client Functions

**File**: `packages/db/index.ts`

Following **D-1** from CLAUDE.md, the package provides typed database helpers that work with both direct Supabase client and transaction instances:

```typescript
/**
 * Get Supabase client with service role key (bypasses RLS)
 * Use for admin operations, migrations, and background jobs
 */
export function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Get Supabase client with anonymous key (respects RLS)
 * Use for normal application operations
 */
export function getClient() {
  return createClient(supabaseUrl, anonKey);
}
```

**Key Features:**
- **Environment Validation**: Throws clear errors for missing required environment variables
- **Permission Separation**: Admin client bypasses RLS, regular client respects organization scoping
- **Type Safety**: Returns properly typed Supabase clients for IntelliSense and compile-time checks

### Migration System

**File**: `packages/db/scripts/migrate.ts`

Automated SQL migration execution with comprehensive error handling and logging:

```typescript
async function migrate() {
  const supabase = getAdminClient();
  const migrationsDir = resolve(process.cwd(), 'packages/db/migrations');
  
  // Read and sort SQL files numerically
  const sqlFiles = files
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  // Execute each migration sequentially
  for (const file of sqlFiles) {
    const sql = await readFile(filePath, 'utf-8');
    const { error } = await supabase.rpc('exec_sql', { sql });
    // Error handling and logging...
  }
}
```

**Key Features:**
- **Sequential Execution**: Migrations run in alphabetical/numerical order for consistency
- **Service Role Access**: Uses admin client to bypass RLS for schema operations
- **Comprehensive Logging**: Detailed progress and error reporting for debugging
- **Fail-Fast**: Stops on first error to prevent partial migrations
- **Exportable Function**: Can be imported and used programmatically

## Environment Configuration

The package requires three Supabase environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Security Notes:**
- **Service Role Key**: Has full database access, store securely and never expose to frontend
- **Anonymous Key**: Respects RLS policies, safe for client-side usage
- **Environment Validation**: Package throws descriptive errors for missing keys

## Usage Patterns

### Application Database Access

Following **S-1** from CLAUDE.md, use the regular client for organization-scoped operations:

```typescript
import { getClient } from '@nexus/db';

const supabase = getClient();

// Automatically respects RLS policies
const { data: transactions } = await supabase
  .from('transactions')
  .select('*')
  .eq('org_id', orgId);
```

### Administrative Operations

Use the admin client for operations that need to bypass RLS:

```typescript
import { getAdminClient } from '@nexus/db';

const supabase = getAdminClient();

// Bypasses RLS for system operations
const { data: allOrgs } = await supabase
  .from('orgs')
  .select('*');
```

### Running Migrations

Execute migrations via npm script:

```bash
cd packages/db
pnpm run migrate
```

**Migration Output:**
```
🔍 Reading migrations directory: /path/to/packages/db/migrations
📦 Found 2 migration files:
   - 001_init.sql
   - 002_rls.sql

🚀 Executing migration: 001_init.sql
✅ Successfully executed: 001_init.sql

🚀 Executing migration: 002_rls.sql
✅ Successfully executed: 002_rls.sql

🎉 All migrations completed successfully!
```

## Package Dependencies

**File**: `packages/db/package.json`

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.45.4"
  },
  "devDependencies": {
    "ts-node": "^10.9.2",
    "typescript": "^5.6.0"
  },
  "scripts": {
    "migrate": "ts-node scripts/migrate.ts"
  }
}
```

**Dependency Rationale:**
- **@supabase/supabase-js**: Official Supabase client with full TypeScript support
- **ts-node**: Enables direct TypeScript execution for migration scripts
- **typescript**: Required for TypeScript compilation and type checking

## Integration Points

### Workspace Configuration

Following **O-1** from CLAUDE.md, the package is designed for use across multiple apps and packages:

```json
// Root pnpm-workspace.yaml
packages:
  - 'packages/*'  # Includes packages/db

// Consumer package.json
{
  "dependencies": {
    "@nexus/db": "workspace:*"
  }
}
```

### Import Patterns

```typescript
// Import specific client functions
import { getClient, getAdminClient } from '@nexus/db';

// Import migration function for programmatic use
import { migrate } from '@nexus/db/scripts/migrate';
```

### CI/CD Integration

Migration script can be integrated into deployment pipelines:

```bash
# Production deployment
cd packages/db && pnpm run migrate
```

## Migration File Conventions

### Naming Pattern
- **Format**: `NNN_description.sql` (e.g., `001_init.sql`, `002_rls.sql`)
- **Execution Order**: Alphabetical/numerical sorting ensures consistent application
- **Descriptions**: Use clear, descriptive names for migration purpose

### Content Guidelines
- **Idempotent Operations**: Use `CREATE OR REPLACE` and `IF NOT EXISTS` where possible
- **Rollback Support**: Include `CASCADE` relationships for safe teardown
- **Comments**: Document complex operations and business logic
- **Error Handling**: Structure SQL to fail fast on conflicts

## Error Handling

### Environment Validation
```typescript
if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL environment variable');
}
```

### Migration Failures
- **Fail-Fast**: Migration stops on first SQL error
- **Error Context**: Includes file name and error details
- **Exit Codes**: Non-zero exit code for CI/CD integration
- **Detailed Logging**: Console output shows progress and failure points

## Testing Strategy

Following **T-1** and **T-3** from CLAUDE.md:

### Unit Tests
- Test client initialization with various environment configurations
- Validate error handling for missing environment variables
- Test migration file discovery and sorting logic

### Integration Tests
- Test actual database connections using test Supabase instance
- Verify migration execution against clean database
- Test RLS policy enforcement with different client types

**Recommended Test Structure:**
```
packages/db/
├── __tests__/
│   ├── client.spec.ts      # Unit tests for client functions
│   ├── migrate.spec.ts     # Unit tests for migration logic
│   └── integration.spec.ts # Database integration tests
```

## Known Limitations

1. **Migration State**: No migration tracking table, relies on manual coordination
2. **Rollback**: No automated rollback functionality, requires manual intervention
3. **Parallel Execution**: Migrations run sequentially, no parallel execution support
4. **Environment Dependency**: Requires Supabase environment variables at import time

## Future Enhancements

1. **Migration Tracking**: Add `_migrations` table to track applied migrations
2. **Rollback Support**: Implement down migrations with automatic rollback
3. **Environment Flexibility**: Support multiple environment configurations
4. **Connection Pooling**: Add connection pool management for high-throughput scenarios
5. **Dry Run Mode**: Add migration preview without execution

## Development Workflow

### Adding New Migrations
1. Create new SQL file: `packages/db/migrations/003_feature.sql`
2. Test locally: `cd packages/db && pnpm run migrate`
3. Commit migration file with descriptive commit message
4. Deploy via CI/CD pipeline

### Local Development
```bash
# Install dependencies
cd packages/db && pnpm install

# Run migrations
pnpm run migrate

# Type check
pnpm run typecheck
```

### Production Deployment
- Migrations execute automatically during deployment
- Service role key managed via secure environment variables
- Failed migrations halt deployment process

This database package provides a solid foundation for secure, type-safe database operations while following all established best practices from CLAUDE.md.