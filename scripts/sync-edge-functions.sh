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


echo "🔄 Flattening directory structure for Supabase compatibility..."

# Navigate to functions directory
cd "$TARGET_DIR"

# Flatten plaid functions
if [ -d "plaid" ]; then
  echo "Flattening plaid functions..."
  mv plaid/sync-accounts ./plaid-sync-accounts
  mv plaid/exchange ./plaid-exchange  
  mv plaid/webhook ./plaid-webhook
  mv plaid/sync-transactions ./plaid-sync-transactions
  mv plaid/backfill-transactions ./plaid-backfill-transactions
  rmdir plaid
fi

# Flatten job functions
if [ -d "jobs" ]; then
  echo "Flattening job functions..."
  mv jobs/plaid-daily-sync ./jobs-plaid-daily-sync
  mv jobs/embeddings-refresh ./jobs-embeddings-refresh  
  mv jobs/categorize-queue ./jobs-categorize-queue
  rmdir jobs
fi

echo "🔧 Fixing import paths in flattened functions..."

# Fix import paths in all flattened functions
# Change from ../../_shared/ to ../_shared/
find . -name "index.ts" -not -path "./_shared/*" -exec sed -i '' "s|'../../_shared/|'../_shared/|g" {} \;
find . -name "index.ts" -not -path "./_shared/*" -exec sed -i '' 's|"../../_shared/|"../_shared/|g' {} \;

echo "✅ Sync and flattening completed"
echo "Functions ready for deployment in: $TARGET_DIR"
echo ""
echo "Flattened function structure:"
ls -la | grep "^d" | grep -v "^\.$" | grep -v "^\.\.$" | awk '{print "  - " $9}'