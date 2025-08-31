# Supabase Edge Functions Deployment Fix

## Problem Statement
Supabase CLI expects edge functions to be in `/supabase/functions/`, but our functions are in `/apps/edge/`. This document provides a comprehensive plan to implement a just-in-time sync approach that maintains our current architecture while enabling standard Supabase deployments.

## Solution Overview
**Just-in-Time Sync**: Keep `apps/edge/` as the single source of truth, automatically mirror to `supabase/functions/` before deployment, then clean up.

## Current Architecture Analysis

### Function Structure
```
apps/edge/
├── _shared/                    # Shared utilities (9 files)
│   ├── account-service.ts      # Account sync logic
│   ├── transaction-service.ts  # Transaction processing
│   ├── plaid-client.ts        # Plaid API wrapper
│   ├── monitoring.ts          # Analytics & error tracking
│   ├── with-org.ts            # Auth middleware
│   └── *.test.ts              # Test files
├── plaid/                     # Plaid integration functions (5 functions)
│   ├── exchange/              # Token exchange
│   ├── sync-accounts/         # Account synchronization
│   ├── sync-transactions/     # Transaction sync
│   ├── backfill-transactions/ # Historical data
│   └── webhook/               # Plaid webhooks
├── jobs/                      # Scheduled functions (3 functions)
│   ├── plaid-daily-sync/      # Daily sync job
│   ├── embeddings-refresh/    # AI embeddings
│   └── categorize-queue/      # Transaction categorization
├── _test/                     # Test utilities
├── supabase/config.toml       # Function configuration
├── deno.json                  # Deno configuration
└── README.md                  # Documentation
```

### Dependencies
- All functions import from `_shared/` using relative paths (`../../_shared/`)
- Deno configuration in `apps/edge/deno.json`
- Function settings in `apps/edge/supabase/config.toml`
- Total: 8 deployable functions

## Implementation Plan

### Phase 1: Core Scripts Setup

#### 1.1 Create Sync Script
Create `scripts/sync-edge-functions.sh`:

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SOURCE_DIR="$PROJECT_ROOT/apps/edge"
TARGET_DIR="$PROJECT_ROOT/supabase/functions"

echo "🔄 Syncing edge functions..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"

# Create target directory if it doesn't exist
mkdir -p "$(dirname "$TARGET_DIR")"

# Sync with exclusions
rsync -av --delete "$SOURCE_DIR/" "$TARGET_DIR/" \
  --exclude='*.test.ts' \
  --exclude='*.spec.ts' \
  --exclude='test.sh' \
  --exclude='README.md' \
  --exclude='_test/' \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='deno.lock'

echo "✅ Sync completed"
echo "Functions ready for deployment in: $TARGET_DIR"
```

#### 1.2 Create Cleanup Script
Create `scripts/cleanup-edge-functions.sh`:

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TARGET_DIR="$PROJECT_ROOT/supabase/functions"

if [ -d "$TARGET_DIR" ]; then
  echo "🧹 Cleaning up mirrored functions..."
  rm -rf "$TARGET_DIR"
  echo "✅ Cleanup completed"
else
  echo "ℹ️  No functions directory to clean up"
fi
```

#### 1.3 Create Deployment Script
Create `scripts/deploy-edge-functions.sh`:

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Deploying Supabase Edge Functions"
echo "======================================"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI is not installed"
  echo "Install with: npm install -g supabase"
  exit 1
fi

# Check if we're in a Supabase project
if [ ! -f "$PROJECT_ROOT/supabase/config.toml" ]; then
  echo "❌ Not in a Supabase project directory"
  echo "Run 'supabase init' first"
  exit 1
fi

# Sync functions
echo "Step 1: Syncing functions..."
"$SCRIPT_DIR/sync-edge-functions.sh"

# Deploy functions
echo ""
echo "Step 2: Deploying to Supabase..."
cd "$PROJECT_ROOT"
supabase functions deploy

# Cleanup (optional - comment out if you want to keep for debugging)
echo ""
echo "Step 3: Cleaning up..."
"$SCRIPT_DIR/cleanup-edge-functions.sh"

echo ""
echo "🎉 Deployment completed successfully!"
```

#### 1.4 Make Scripts Executable
```bash
chmod +x scripts/sync-edge-functions.sh
chmod +x scripts/cleanup-edge-functions.sh
chmod +x scripts/deploy-edge-functions.sh
```

### Phase 2: Package.json Integration

#### 2.1 Add Root Package.json Scripts
Update root `package.json` scripts section:

```json
{
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:categorization": "pnpm --filter @nexus/categorizer test",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "test:integration": "npx tsx scripts/verify-openai-integration.ts",
    "test:edge-functions": "npx tsx scripts/test-edge-functions.ts",
    "test:all": "pnpm run test:categorization && pnpm run test:e2e && pnpm run test:integration",
    "e2e": "pnpm --filter web exec playwright test",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc -b",
    "migrate": "pnpm --filter @nexus/db run migrate",
    "seed": "pnpm --filter @nexus/db run seed",
    
    // NEW EDGE FUNCTION SCRIPTS
    "functions:sync": "bash scripts/sync-edge-functions.sh",
    "functions:deploy": "bash scripts/deploy-edge-functions.sh",
    "functions:cleanup": "bash scripts/cleanup-edge-functions.sh",
    "functions:dev": "cd apps/edge && deno task test:watch",
    "functions:test": "cd apps/edge && deno task test"
  }
}
```

### Phase 3: Supabase Configuration

#### 3.1 Move Supabase Config to Root
Move `apps/edge/supabase/config.toml` to `supabase/config.toml`:

```toml
# Supabase CLI configuration file
project_id = "your-project-id"

[functions]
import_map = "./functions/deno.json"

[functions.plaid-exchange]
verify_jwt = true

[functions.plaid-sync-accounts]
verify_jwt = false  # Called by service role

[functions.plaid-backfill-transactions]
verify_jwt = false  # Called by service role

[functions.plaid-sync-transactions]
verify_jwt = false  # Called by service role

[functions.plaid-webhook]
verify_jwt = false  # External webhook

[functions.jobs-plaid-daily-sync]
verify_jwt = false  # Scheduled job

[functions.jobs-embeddings-refresh]
verify_jwt = false  # Scheduled job

[functions.jobs-categorize-queue]
verify_jwt = false  # Scheduled job
```

#### 3.2 Update .gitignore
Add to root `.gitignore`:

```gitignore
# Supabase Edge Functions (mirrored from apps/edge)
/supabase/functions/

# Supabase local development
.env.local
supabase/.temp/
```

### Phase 4: Development Workflow

#### 4.1 Local Development Commands

```bash
# Test edge functions locally
pnpm functions:test

# Test with watch mode
pnpm functions:dev

# Sync functions for inspection (without deploy)
pnpm functions:sync

# Deploy functions
pnpm functions:deploy

# Clean up mirrored functions
pnpm functions:cleanup
```

#### 4.2 Validation Script
Create `scripts/validate-edge-functions.sh`:

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔍 Validating Edge Functions Setup"
echo "=================================="

# Check source directory
if [ ! -d "$PROJECT_ROOT/apps/edge" ]; then
  echo "❌ Source directory apps/edge not found"
  exit 1
fi

# Check for required files
REQUIRED_FILES=(
  "apps/edge/deno.json"
  "apps/edge/_shared/account-service.ts"
  "apps/edge/plaid/exchange/index.ts"
  "apps/edge/jobs/plaid-daily-sync/index.ts"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$PROJECT_ROOT/$file" ]; then
    echo "❌ Required file not found: $file"
    exit 1
  fi
done

# Count functions
FUNCTION_COUNT=$(find "$PROJECT_ROOT/apps/edge" -name "index.ts" -not -path "*/node_modules/*" -not -path "*/_*" | wc -l)
echo "✅ Found $FUNCTION_COUNT edge functions"

# Test sync
echo "🧪 Testing sync operation..."
"$SCRIPT_DIR/sync-edge-functions.sh"

# Validate synced structure
if [ ! -d "$PROJECT_ROOT/supabase/functions" ]; then
  echo "❌ Sync failed - target directory not created"
  exit 1
fi

SYNCED_COUNT=$(find "$PROJECT_ROOT/supabase/functions" -name "index.ts" -not -path "*/node_modules/*" -not -path "*/_*" | wc -l)
echo "✅ Synced $SYNCED_COUNT functions successfully"

if [ "$FUNCTION_COUNT" != "$SYNCED_COUNT" ]; then
  echo "⚠️  Function count mismatch: source=$FUNCTION_COUNT, synced=$SYNCED_COUNT"
fi

# Cleanup
"$SCRIPT_DIR/cleanup-edge-functions.sh"

echo "✅ Validation completed successfully"
```

### Phase 5: CI/CD Integration

#### 5.1 GitHub Actions Workflow
Create `.github/workflows/deploy-edge-functions.yml`:

```yaml
name: Deploy Edge Functions

on:
  push:
    branches: [main]
    paths: ['apps/edge/**']
  pull_request:
    paths: ['apps/edge/**']

jobs:
  test-functions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Deno
        uses: denoland/setup-deno@v1
        with:
          deno-version: v1.42.0
      
      - name: Run Edge Function Tests
        run: |
          cd apps/edge
          deno task test
  
  deploy-functions:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: test-functions
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: Make scripts executable
        run: chmod +x scripts/*.sh
      
      - name: Deploy Edge Functions
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
        run: |
          supabase link --project-ref $SUPABASE_PROJECT_ID
          bash scripts/deploy-edge-functions.sh
```

### Phase 6: Testing & Validation

#### 6.1 Pre-Deployment Validation Checklist

```bash
# 1. Test current edge functions
cd apps/edge && deno task test

# 2. Validate sync operation
bash scripts/validate-edge-functions.sh

# 3. Test deployment process (dry run)
pnpm functions:sync
supabase functions deploy --dry-run
pnpm functions:cleanup

# 4. Test actual deployment
pnpm functions:deploy
```

#### 6.2 Post-Deployment Validation

```bash
# Test deployed functions
curl -X POST "https://your-project.supabase.co/functions/v1/plaid-exchange" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## Migration Steps

### Step 1: Setup Scripts (30 minutes)
1. Create all scripts in `scripts/` directory
2. Make them executable
3. Test sync operation

### Step 2: Update Configuration (15 minutes)
1. Move `supabase/config.toml` to project root
2. Update `.gitignore`
3. Add package.json scripts

### Step 3: Validate Setup (15 minutes)
1. Run validation script
2. Test sync/deploy/cleanup cycle
3. Verify function structure

### Step 4: Deploy (10 minutes)
1. Run full deployment
2. Test deployed functions
3. Verify monitoring/logging

### Step 5: CI/CD Setup (20 minutes)
1. Add GitHub Actions workflow
2. Configure secrets
3. Test automated deployment

## Rollback Plan

If issues arise:

1. **Immediate**: Keep using current manual deployment process
2. **Scripts fail**: Functions still work in `apps/edge/`, revert to manual deploy
3. **Sync issues**: Check/fix rsync excludes and paths
4. **CI/CD issues**: Disable workflow, use manual deployment

## Benefits Achieved

✅ **Zero code changes** - All existing imports and paths work unchanged  
✅ **Supabase CLI compliance** - Standard deployment commands work  
✅ **Clean development** - Source code stays in logical `apps/edge/` location  
✅ **Automated deployment** - Single command deploys all functions  
✅ **CI/CD ready** - Automated testing and deployment pipeline  
✅ **Easy rollback** - Can revert to manual process anytime  

## Future Considerations

- **Function-specific deployment**: Extend scripts to deploy individual functions
- **Environment management**: Add staging/production environment handling
- **Performance monitoring**: Add deployment timing and success metrics
- **Hot reloading**: Consider development-time function watching/redeployment

## Claude Code Optimization Notes

This plan is optimized for Claude Code workflows:

- **Single command deployment**: `pnpm functions:deploy`
- **Clear script separation**: Each script has a single responsibility
- **Comprehensive validation**: Built-in checks prevent deployment issues
- **Detailed logging**: Scripts provide clear feedback on each step
- **Error handling**: Scripts fail fast with clear error messages
- **Documentation**: Everything is self-documenting and scriptable

Execute this plan step-by-step to achieve a robust, maintainable edge function deployment process.
