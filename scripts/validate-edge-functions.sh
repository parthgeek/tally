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