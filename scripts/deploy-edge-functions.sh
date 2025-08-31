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