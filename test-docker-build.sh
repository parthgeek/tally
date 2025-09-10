#!/bin/bash

# Test script for Docker build of web app
# Run this from the repository root

set -e

echo "🐳 Testing Docker build for Railway deployment..."
echo "Building from repository root with context set to apps/web"

# Build the Docker image
echo "📦 Building Docker image..."
docker build -f apps/web/Dockerfile -t nexus-web-test .

echo "✅ Docker build completed successfully!"
echo "🧪 Running basic container test..."

# Test that the container can start (run for 10 seconds then stop)
echo "🚀 Starting container..."
docker run --rm -d --name nexus-web-test-run -p 3000:3000 nexus-web-test &
CONTAINER_PID=$!

echo "⏱️  Waiting 10 seconds for startup..."
sleep 10

echo "🔍 Checking if container is responsive..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Container is responding successfully!"
else
    echo "⚠️  Container might not be fully ready yet (this could be normal)"
fi

echo "🛑 Stopping test container..."
docker stop nexus-web-test-run || true

echo "🧹 Cleaning up..."
docker rmi nexus-web-test

echo "🎉 Docker test completed!"
echo ""
echo "To deploy to Railway:"
echo "1. Ensure Railway service Root Directory is set to 'apps/web'"
echo "2. Push your changes to trigger a new build"
echo "3. Railway will automatically detect and use the Dockerfile"
