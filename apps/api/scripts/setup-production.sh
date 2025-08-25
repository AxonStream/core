#!/bin/bash

# =============================================================================
# AxonPuls PLATFORM - PRODUCTION SETUP SCRIPT
# =============================================================================
# This script sets up the AxonPuls Platform for production deployment

set -e  # Exit on any error

echo "🚀 AxonPuls Platform - Production Setup"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

print_status "Node.js version check passed: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_status "npm version: $(npm --version)"

# =============================================================================
# ENVIRONMENT SETUP
# =============================================================================

echo ""
echo "🔧 Setting up environment configuration..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from .env.example..."
    cp .env.example .env
    print_info "Please update the .env file with your production values before continuing."
    print_info "Key values to update:"
    print_info "  - DATABASE_URL"
    print_info "  - REDIS_HOST, REDIS_PORT, REDIS_PASSWORD"
    print_info "  - JWT_SECRET, JWT_REFRESH_SECRET"
    print_info "  - CORS_ORIGIN"
    echo ""
    read -p "Press Enter after updating .env file to continue..."
fi

print_status "Environment configuration ready"

# =============================================================================
# DEPENDENCY INSTALLATION
# =============================================================================

echo ""
echo "📦 Installing dependencies..."

npm ci --production=false
print_status "Dependencies installed"

# =============================================================================
# DATABASE SETUP
# =============================================================================

echo ""
echo "🗄️  Setting up database..."

# Generate Prisma client
print_info "Generating Prisma client..."
npx prisma generate
print_status "Prisma client generated"

# Check database connection
print_info "Checking database connection..."
if npx prisma db push --accept-data-loss; then
    print_status "Database schema updated successfully"
else
    print_error "Database connection failed. Please check your DATABASE_URL in .env"
    exit 1
fi

# =============================================================================
# BUILD APPLICATION
# =============================================================================

echo ""
echo "🔨 Building application..."

npm run build
print_status "Application built successfully"

# =============================================================================
# SECURITY CHECKS
# =============================================================================

echo ""
echo "🔐 Running security checks..."

# Check for default JWT secrets
if grep -q "your-super-secret-jwt-key-change-in-production" .env; then
    print_error "Default JWT_SECRET detected! Please update JWT_SECRET in .env"
    exit 1
fi

if grep -q "your-super-secret-refresh-key-change-in-production" .env; then
    print_error "Default JWT_REFRESH_SECRET detected! Please update JWT_REFRESH_SECRET in .env"
    exit 1
fi

print_status "Security checks passed"

# =============================================================================
# RBAC SYSTEM VERIFICATION
# =============================================================================

echo ""
echo "🛡️  Verifying RBAC system..."

# Check if RBAC is enabled
if grep -q "ENABLE_RBAC=true" .env; then
    print_status "RBAC system enabled"
else
    print_warning "RBAC system is disabled. Enable it by setting ENABLE_RBAC=true in .env"
fi

# Check if multi-tenant is enabled
if grep -q "ENABLE_MULTI_TENANT=true" .env; then
    print_status "Multi-tenant system enabled"
else
    print_warning "Multi-tenant system is disabled. Enable it by setting ENABLE_MULTI_TENANT=true in .env"
fi

# =============================================================================
# FINAL SETUP
# =============================================================================

echo ""
echo "🎯 Final setup steps..."

# Create logs directory
mkdir -p logs
print_status "Logs directory created"

# Create uploads directory (if needed)
mkdir -p uploads
print_status "Uploads directory created"

# Set proper permissions
chmod +x scripts/*.sh 2>/dev/null || true
print_status "Script permissions set"

# =============================================================================
# COMPLETION
# =============================================================================

echo ""
echo "🎉 Production setup completed successfully!"
echo ""
print_info "Next steps:"
print_info "1. Review your .env configuration"
print_info "2. Start the application: npm run start:prod"
print_info "3. Test the authentication endpoints"
print_info "4. Initialize system roles for your organization"
echo ""
print_info "API will be available at: http://localhost:3001"
print_info "Health check: http://localhost:3001/health"
print_info "API documentation: http://localhost:3001/api"
echo ""
print_warning "Remember to:"
print_warning "- Set up SSL/TLS certificates for production"
print_warning "- Configure your reverse proxy (nginx/Apache)"
print_warning "- Set up monitoring and logging"
print_warning "- Configure backup strategies"
echo ""
echo "🚀 Ready for production deployment!"
