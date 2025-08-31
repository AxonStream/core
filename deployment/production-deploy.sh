#!/bin/bash

# Production Deployment Script for Original API
# This script deploys the Original API as the production baseline

set -e  # Exit on any error

echo "🚀 Starting Original API Production Deployment..."

# Configuration
API_DIR="apps/api"
BACKUP_DIR="backup/$(date +%Y%m%d_%H%M%S)"
ENV_FILE=".env.production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Check if Original API directory exists
if [ ! -d "$API_DIR" ]; then
    print_error "Original API directory not found: $API_DIR"
    exit 1
fi

# Check if package.json exists
if [ ! -f "$API_DIR/package.json" ]; then
    print_error "package.json not found in $API_DIR"
    exit 1
fi

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    print_warning "Production environment file not found: $ENV_FILE"
    echo "Creating template environment file..."
    cat > "$ENV_FILE" << 'EOF'
# Production Environment Configuration
NODE_ENV=production

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/axonpuls_prod
DB_SSL=true

# Redis Configuration  
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-change-this
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-change-this
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=axonstream-core
JWT_AUDIENCE=axonstream-clients

# RSA Keys for JWT (Generate with: npm run generate:keys)
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nYOUR_PUBLIC_KEY_HERE\n-----END PUBLIC KEY-----"
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"

# Encryption
ENCRYPTION_MASTER_KEY=your-32-character-encryption-key

# Tenant Configuration
TENANT_STRICT_ISOLATION=true
TENANT_RESOURCE_LIMITS=true
TENANT_AUDIT_LOGGING=true
TENANT_DATA_ENCRYPTION=true

# WebSocket Configuration
WS_PORT=3001
WS_PATH=/ws

# Rate Limiting
AUTH_RATE_LIMIT_WINDOW=900000
AUTH_RATE_LIMIT_MAX=5

# Monitoring
MAGIC_METRICS_RETENTION_DAYS=30
MAGIC_REALTIME_METRICS=true
EOF
    print_warning "Please update $ENV_FILE with your production values before continuing"
    read -p "Press Enter when you've updated the environment file..."
fi

print_status "Pre-deployment checks completed"

# Create backup
echo "📦 Creating backup..."
mkdir -p "$BACKUP_DIR"
if [ -d "dist" ]; then
    cp -r dist "$BACKUP_DIR/"
    print_status "Backup created at $BACKUP_DIR"
fi

# Navigate to API directory
cd "$API_DIR"

# Install dependencies
echo "📥 Installing dependencies..."
npm ci --only=production
print_status "Dependencies installed"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate
print_status "Prisma client generated"

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy
print_status "Database migrations completed"

# Build application
echo "🔨 Building application..."
npm run build
print_status "Application built successfully"

# Validate configuration
echo "🔍 Validating production configuration..."
node -e "
const config = require('./dist/config/auth.config.js');
const dbConfig = require('./dist/config/database.config.js');
console.log('✅ Configuration validation passed');
"
print_status "Configuration validation completed"

# Start application (using PM2 for production)
echo "🚀 Starting application..."
if command -v pm2 &> /dev/null; then
    pm2 start dist/main.js --name "axonstream-api" --env production
    pm2 save
    print_status "Application started with PM2"
else
    print_warning "PM2 not found. Starting with node..."
    nohup node dist/main.js > ../logs/app.log 2>&1 &
    echo $! > ../logs/app.pid
    print_status "Application started in background"
fi

# Health check
echo "🏥 Running health check..."
sleep 5
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    print_status "Health check passed - API is running"
else
    print_error "Health check failed - please check logs"
    exit 1
fi

echo ""
echo "🎉 Original API deployed successfully to production!"
echo ""
echo "📊 Deployment Summary:"
echo "   • API Directory: $API_DIR"
echo "   • Environment: production"
echo "   • Backup Location: $BACKUP_DIR"
echo "   • Health Check: ✅ Passed"
echo ""
echo "🔗 Next Steps:"
echo "   1. Monitor application logs"
echo "   2. Run integration tests"
echo "   3. Update DNS/load balancer configuration"
echo "   4. Begin Phase 2: Security fixes for hardened API"
