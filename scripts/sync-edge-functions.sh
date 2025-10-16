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
  mv plaid/disconnect ./plaid-disconnect
  rmdir plaid
fi

# Flatten job functions
if [ -d "jobs" ]; then
  echo "Flattening job functions..."
  mv jobs/plaid-daily-sync ./jobs-plaid-daily-sync
  mv jobs/embeddings-refresh ./jobs-embeddings-refresh
  mv jobs/categorize-queue ./jobs-categorize-queue
  mv jobs/categorize-worker ./jobs-categorize-worker
  mv jobs/recategorize-historical ./jobs-recategorize-historical
  rmdir jobs
fi

echo "🔧 Copying package dependencies..."

# Copy categorizer package files for jobs-categorize-queue
mkdir -p packages/categorizer/src
cp -r "$PROJECT_ROOT/packages/categorizer/src"/* packages/categorizer/src/

# Copy types package (required by categorizer)
mkdir -p packages/types/src
cp -r "$PROJECT_ROOT/packages/types/src"/* packages/types/src/

echo "🔧 Fixing import paths in flattened functions..."

# Fix import paths in all flattened functions
# Change from ../../_shared/ to ../_shared/
find . -name "index.ts" -not -path "./_shared/*" -exec sed -i '' "s|'../../_shared/|'../_shared/|g" {} \;
find . -name "index.ts" -not -path "./_shared/*" -exec sed -i '' 's|"../../_shared/|"../_shared/|g' {} \;

# Fix package import paths for jobs that use categorizer
if [ -f "jobs-categorize-queue/index.ts" ]; then
  sed -i '' "s|'../../../packages/|'../packages/|g" jobs-categorize-queue/index.ts
  sed -i '' 's|"../../../packages/|"../packages/|g' jobs-categorize-queue/index.ts
fi

if [ -f "jobs-recategorize-historical/index.ts" ]; then
  sed -i '' "s|'../../../packages/|'../packages/|g" jobs-recategorize-historical/index.ts
  sed -i '' 's|"../../../packages/|"../packages/|g' jobs-recategorize-historical/index.ts
fi

# Fix .js imports to .ts for Supabase deployment (both categorizer and types)
find packages/categorizer/src -name "*.ts" -exec sed -i '' "s|from '\.\./\([^']*\)\.js'|from '../\1.ts'|g" {} \;
find packages/categorizer/src -name "*.ts" -exec sed -i '' 's|from "\.\./\([^"]*\)\.js"|from "../\1.ts"|g' {} \;
find packages/categorizer/src -name "*.ts" -exec sed -i '' "s|from '\./\([^']*\)\.js'|from './\1.ts'|g" {} \;
find packages/categorizer/src -name "*.ts" -exec sed -i '' 's|from "\./\([^"]*\)\.js"|from "./\1.ts"|g' {} \;

find packages/types/src -name "*.ts" -exec sed -i '' "s|from '\.\./\([^']*\)\.js'|from '../\1.ts'|g" {} \;
find packages/types/src -name "*.ts" -exec sed -i '' 's|from "\.\./\([^"]*\)\.js"|from "../\1.ts"|g' {} \;
find packages/types/src -name "*.ts" -exec sed -i '' "s|from '\./\([^']*\)\.js'|from './\1.ts'|g" {} \;
find packages/types/src -name "*.ts" -exec sed -i '' 's|from "\./\([^"]*\)\.js"|from "./\1.ts"|g' {} \;

echo "✅ Sync and flattening completed"
echo "Functions ready for deployment in: $TARGET_DIR"
echo ""
echo "Flattened function structure:"
ls -la | grep "^d" | grep -v "^\.$" | grep -v "^\.\.$" | awk '{print "  - " $9}'