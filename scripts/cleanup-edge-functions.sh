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