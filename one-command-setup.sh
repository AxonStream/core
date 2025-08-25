#!/bin/bash

# 🚀 AXONSTREAM ONE-COMMAND SETUP
# Run this ONCE and everything works: SDK + API + UI + Embed + CDN

set -e

echo "🔭 AXONSTREAM - ONE COMMAND ALL DONE"
echo "==================================="

# Check dependencies
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm required but not installed."; exit 1; }

echo "✅ Dependencies found"

# 1. Start infrastructure (Redis + PostgreSQL)
echo "🐳 Starting infrastructure..."
docker-compose up -d redis postgres

# 2. Install dependencies
echo "📦 Installing packages..."
npm install --workspaces

# 3. Build the ONE CORE PACKAGE
echo "🏗️  Building @axonstream/core..."
cd packages/core
npm run build
cd ../..

# 4. Build API
echo "🔧 Building API..."
cd apps/api
npm run build
cd ../..

# 5. Start API
echo "🚀 Starting API..."
cd apps/api
npm run start:prod &
API_PID=$!
cd ../..

# 6. Build docs
echo "📚 Building docs..."
cd apps/docs
npm run build
npm run start &
DOCS_PID=$!
cd ../..

# 7. Publish to CDN (simulated)
echo "🌐 Building CDN assets..."
mkdir -p public/cdn
cp packages/core/dist/axonui.min.js public/cdn/
cp packages/core/dist/axonui.min.js.map public/cdn/

echo ""
echo "🎉 AXONSTREAM IS READY!"
echo "======================"
echo ""
echo "📱 NPM:     npm install @axonstream/core"
echo "🌐 CDN:     <script src=\"http://localhost:3000/cdn/axonui.min.js\"></script>"
echo "🔗 API:     http://localhost:3001/v1/"
echo "📚 Docs:    http://localhost:3002"
echo "🎯 Embed:   AXONUI.mount({ el: '#app', token, channel })"
echo ""
echo "🧪 Test it:"
echo "curl http://localhost:3001/health"
echo ""

# Create test file
cat > test-axonstream.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>AxonStream Test</title>
    <script src="http://localhost:3000/cdn/axonui.min.js"></script>
</head>
<body>
    <div id="axon-app"></div>
    <script>
        // ONE LINE - EVERYTHING WORKS
        window.AXONUI.mount({
            el: '#axon-app',
            token: 'your-jwt-token',
            channel: 'test-channel'
        });
    </script>
</body>
</html>
EOF

echo "📄 Created test-axonstream.html"
echo ""
echo "🎯 FOUR WAYS TO USE AXONSTREAM:"
echo "1. NPM:    import { createAxonStream } from '@axonstream/core'"
echo "2. CDN:    <script src=\".../axonui.min.js\">"
echo "3. API:    curl -X POST /v1/events"
echo "4. Embed:  AXONUI.mount({ el, token, channel })"
echo ""

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    kill $API_PID 2>/dev/null || true
    kill $DOCS_PID 2>/dev/null || true
    docker-compose down
}

trap cleanup EXIT

echo "✅ Press Ctrl+C to stop all services"
wait
