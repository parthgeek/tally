# Supabase Edge Functions Deployment System

## Overview

This document describes the implementation of the Supabase Edge Functions deployment system that enables standard Supabase CLI workflows while maintaining our current `apps/edge/` architecture. The system uses a just-in-time sync approach to mirror functions from `apps/edge/` to `supabase/functions/` before deployment.

## Problem Solved

**Issue**: Supabase CLI expects edge functions to be in `/supabase/functions/`, but our functions are organized in `/apps/edge/` for better monorepo structure.

**Solution**: Automated sync system that maintains `apps/edge/` as the single source of truth while enabling standard Supabase deployments.

## Architecture

### Directory Structure
```
apps/edge/                     # Source of truth
├── _shared/                   # Shared utilities (9 files)
├── plaid/                     # Plaid integration functions (5 functions)
├── jobs/                      # Scheduled functions (3 functions)
└── supabase/config.toml       # Function configuration (moved to root)

supabase/functions/            # Mirrored for deployment (gitignored)
├── _shared/                   # Synced shared utilities
├── plaid-exchange/            # Flattened Plaid functions
├── plaid-sync-accounts/       # (Supabase requires flat structure)
├── plaid-webhook/
├── jobs-plaid-daily-sync/     # Flattened job functions
├── jobs-categorize-queue/     # (Nested dirs → flat names)
└── deno.json                  # Synced Deno configuration
```

### Key Components

1. **Sync Script** (`scripts/sync-edge-functions.sh`)
   - Mirrors `apps/edge/` to `supabase/functions/`
   - **Flattens directory structure** for Supabase CLI compatibility
   - **Automatically fixes import paths** from `../../_shared/` to `../_shared/`
   - Excludes test files, documentation, and temporary files
   - Uses `rsync` for efficient synchronization

2. **Deploy Script** (`scripts/deploy-edge-functions.sh`)
   - Orchestrates the complete deployment pipeline
   - Validates Supabase CLI installation and project setup
   - Syncs → Deploys → Cleans up

3. **Cleanup Script** (`scripts/cleanup-edge-functions.sh`)
   - Removes mirrored functions directory
   - Keeps development environment clean

4. **Validation Script** (`scripts/validate-edge-functions.sh`)
   - Tests sync operation
   - Validates function count and structure
   - Provides comprehensive setup verification

## Implementation Details

### Files Created/Modified

#### Scripts (`/scripts/`)
- `sync-edge-functions.sh` - Core synchronization logic
- `cleanup-edge-functions.sh` - Cleanup mirrored functions
- `deploy-edge-functions.sh` - Full deployment pipeline
- `validate-edge-functions.sh` - Setup validation

#### Configuration Changes
- `package.json` - Added 5 new function management scripts
- `supabase/config.toml` - Moved from `apps/edge/supabase/config.toml`, **removed invalid import_map**
- `.gitignore` - Added exclusion for `supabase/functions/`
- `.github/workflows/deploy-edge-functions.yml` - CI/CD automation

#### Package.json Scripts Added
```json
{
  "functions:sync": "bash scripts/sync-edge-functions.sh",
  "functions:deploy": "bash scripts/deploy-edge-functions.sh", 
  "functions:cleanup": "bash scripts/cleanup-edge-functions.sh",
  "functions:dev": "cd apps/edge && deno task test:watch",
  "functions:test": "cd apps/edge && deno task test"
}
```

### Function Configuration

All 8 edge functions are configured in `supabase/config.toml`:

**Plaid Functions:**
- `plaid-exchange` (JWT verification: ✅)
- `plaid-sync-accounts` (JWT verification: ❌ - service role)
- `plaid-backfill-transactions` (JWT verification: ❌ - service role)
- `plaid-sync-transactions` (JWT verification: ❌ - service role)
- `plaid-webhook` (JWT verification: ❌ - external webhook)

**Job Functions:**
- `jobs-plaid-daily-sync` (JWT verification: ❌ - scheduled)
- `jobs-embeddings-refresh` (JWT verification: ❌ - scheduled)
- `jobs-categorize-queue` (JWT verification: ❌ - scheduled)

## Usage

### Development Commands

```bash
# Test edge functions locally
pnpm functions:test

# Test with watch mode for development
pnpm functions:dev

# Sync functions for inspection (without deployment)
pnpm functions:sync

# Deploy all functions to Supabase
pnpm functions:deploy

# Clean up mirrored functions
pnpm functions:cleanup

# Validate entire setup
bash scripts/validate-edge-functions.sh
```

## Critical Implementation Fixes

During implementation, two critical issues were discovered and resolved:

### 1. Configuration Error Fix
**Issue**: `supabase/config.toml` had invalid `import_map = "./functions/deno.json"` causing deployment failure.

**Solution**: Removed the `import_map` line to let Supabase CLI auto-detect `deno.json` in the functions directory.

```toml
# Before (BROKEN)
[functions]
import_map = "./functions/deno.json"

# After (WORKING)  
[functions]
# import_map removed - Supabase CLI auto-detects deno.json
```

### 2. Directory Structure Fix
**Issue**: Supabase CLI expects flat function structure but sync created nested directories.

**Problem**:
- Config expected: `plaid-sync-accounts/index.ts`
- Sync created: `plaid/sync-accounts/index.ts`
- Result: `failed to read file: supabase/functions/plaid-sync-accounts/index.ts`

**Solution**: Enhanced sync script to flatten directory structure and fix import paths automatically.

**Flattening Process**:
```bash
# Nested structure (from apps/edge/)
plaid/sync-accounts/ → plaid-sync-accounts/
plaid/exchange/ → plaid-exchange/
jobs/plaid-daily-sync/ → jobs-plaid-daily-sync/

# Import path fixes (automatic)
'../../_shared/' → '../_shared/'
```

### Deployment Workflow

1. **Development**: Work directly in `apps/edge/`
2. **Testing**: Run `pnpm functions:test`
3. **Deployment**: Run `pnpm functions:deploy`
4. **Verification**: Functions are deployed and mirrored directory is cleaned up

### CI/CD Pipeline

**Trigger**: Changes to `apps/edge/**` files

**Process**:
1. **Test Phase**: Run Deno tests for all edge functions
2. **Deploy Phase** (main branch only):
   - Setup Supabase CLI
   - Link to project using secrets
   - Execute deployment pipeline

**Required Secrets**:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`

## Development Workflow Integration

### Local Development
- Continue developing in `apps/edge/` as before
- All existing imports and relative paths work unchanged
- Use standard Deno testing with `deno task test`

### Deployment Process
1. Sync validates source structure
2. Copies functions from nested to flat directory structure
3. **Flattens directories**: `plaid/sync-accounts/` → `plaid-sync-accounts/`
4. **Fixes import paths**: `../../_shared/` → `../_shared/`
5. Excludes development files (tests, docs, temp files)
6. Deploys using standard Supabase CLI
7. Cleans up temporary sync directory

### Error Handling
- Scripts use `set -e` for fail-fast behavior
- Comprehensive validation checks before deployment
- Clear error messages with actionable guidance
- Automatic cleanup on script completion

## Dependencies and Requirements

### System Requirements
- **rsync** - File synchronization
- **Supabase CLI** - Function deployment
- **Deno** - Local function testing
- **bash** - Script execution

### Project Requirements
- Functions must be in `apps/edge/` directory
- Each function needs `index.ts` entry point
- Shared utilities should be in `apps/edge/_shared/`
- Supabase project must be initialized (`supabase/config.toml` exists)

## Integration Points

### Existing Systems
- **Plaid Integration**: All Plaid webhooks and sync functions
- **Job Scheduling**: Scheduled categorization and sync jobs
- **Authentication**: JWT verification configuration preserved
- **Monitoring**: Error tracking and analytics integration maintained

### Dependencies
- **apps/edge/_shared/**: Core utilities used by all functions
  - `account-service.ts` - Account synchronization logic
  - `transaction-service.ts` - Transaction processing
  - `plaid-client.ts` - Plaid API wrapper
  - `monitoring.ts` - Analytics and error tracking
  - `with-org.ts` - Authentication middleware

## Configuration Details

### Sync Exclusions
The following files/directories are excluded from sync:
- `*.test.ts` and `*.spec.ts` - Test files
- `README.md` - Documentation
- `_test/` - Test utilities
- `.git/` - Version control
- `node_modules/` - Dependencies
- `deno.lock` - Lock files

### Import Map Handling
- Deno configuration (`deno.json`) is synced to maintain import maps
- **Supabase CLI auto-detects** `deno.json` (no explicit import_map needed in config.toml)
- Preserves module resolution for `std/` and `@supabase/supabase-js`
- Maintains compiler options and linting configuration
- **Automatic import path fixing** during sync for flattened structure

## Rollback Strategy

If issues arise with the new deployment system:

1. **Immediate**: Continue using existing functions (they remain unchanged)
2. **Script Issues**: Revert to manual Supabase CLI deployment
3. **Sync Problems**: Check rsync exclusions and file paths
4. **CI/CD Issues**: Disable GitHub workflow, use manual deployment

The original `apps/edge/` structure and functions remain completely unchanged, providing a safe fallback path.

## Benefits Achieved

✅ **Zero Code Changes**: All existing imports and paths work unchanged  
✅ **Supabase CLI Compliance**: Standard deployment commands work  
✅ **Clean Development**: Source code stays in logical location  
✅ **Automated Deployment**: Single command deploys all functions  
✅ **CI/CD Integration**: Automated testing and deployment  
✅ **Easy Rollback**: Can revert to manual process anytime  
✅ **Environment Safety**: Mirrored files are gitignored  

## Validation and Testing

### Function Count Verification
- Source: 8 functions in `apps/edge/`
- Synced: 8 functions in `supabase/functions/`
- All shared utilities properly copied

### Sync Integrity
- Directory structure preserved
- File permissions maintained
- Import paths remain functional
- Configuration files properly placed

### Deployment Verification
- **✅ All 8 functions deploy successfully** (confirmed working)
- **✅ JWT verification settings preserved** per config.toml
- **✅ Function invocation works as expected**
- **✅ Monitoring and error tracking functional**

**Deployed Functions (All ACTIVE)**:
- `plaid-backfill-transactions`
- `plaid-exchange` 
- `plaid-webhook`
- `jobs-categorize-queue`
- `jobs-embeddings-refresh`
- `jobs-plaid-daily-sync`
- `plaid-sync-accounts`
- `plaid-sync-transactions`

## Known Limitations

1. **Platform Dependency**: Requires Unix-like environment with rsync
2. **Manual Secrets**: GitHub secrets must be configured manually
3. **Single Project**: Current setup assumes single Supabase project
4. **Cleanup Timing**: Functions directory cleaned immediately after deployment

## Future Enhancements

- **Selective Deployment**: Deploy individual functions
- **Environment Management**: Support staging/production environments
- **Performance Metrics**: Add deployment timing and success tracking
- **Hot Reloading**: Development-time function watching and redeployment
- **Cross-Platform**: Support for Windows environments

## Troubleshooting

### Common Issues

**Sync Fails**
- Check source directory exists: `apps/edge/`
- Verify rsync is available: `which rsync`
- Ensure proper permissions on target directory

**Deployment Fails**
- Verify Supabase CLI installed: `supabase --version`
- Check project linked: `supabase status`
- Validate configuration: `supabase/config.toml`
- **Check for import_map errors**: Remove `import_map` line from config.toml
- **Verify flat structure**: Functions should be in `supabase/functions/function-name/`
- **Check import paths**: Should use `../_shared/` not `../../_shared/`

**Function Count Mismatch**
- Run validation script: `bash scripts/validate-edge-functions.sh`
- Check for missing `index.ts` files
- Verify no functions in excluded directories

### Debug Commands

```bash
# List all functions in source
find apps/edge -name "index.ts" -not -path "*/_*" | wc -l

# Check sync status and flattening
pnpm functions:sync && ls -la supabase/functions/

# Verify flattened structure (should show flat directories)
find supabase/functions -maxdepth 1 -type d -name "*-*"

# Check import paths in synced functions
grep -r "_shared" supabase/functions/*/index.ts

# Validate complete setup
bash scripts/validate-edge-functions.sh

# Clean up for fresh start
pnpm functions:cleanup
```

This deployment system maintains the existing development workflow while enabling modern Supabase CLI tooling and CI/CD automation.