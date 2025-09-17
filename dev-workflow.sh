#!/bin/bash

# Development workflow script for Halal Gelatin Project
# This script helps you switch between development and production environments

set -e

if [ "$1" == "dev" ]; then
    echo "🔧 Switching to DEVELOPMENT environment..."
    
    # Switch to dev Convex
    ./switch-env.sh dev
    
    # Start development servers
    echo "🚀 Starting development servers..."
    echo "   • Convex dev server will start in background"
    echo "   • Next.js dev server will start in foreground"
    echo ""
    echo "📋 To run both servers:"
    echo "   Terminal 1: npx convex dev"
    echo "   Terminal 2: npm run dev"
    echo ""
    echo "🌐 Development URLs:"
    echo "   • Frontend: http://localhost:3000"
    echo "   • Convex: https://patient-meadowlark-297.convex.cloud"
    
elif [ "$1" == "prod" ]; then
    echo "🚀 Switching to PRODUCTION environment..."
    
    # Switch to prod Convex
    ./switch-env.sh prod
    
    echo "📋 To test production locally:"
    echo "   npm run dev"
    echo ""
    echo "🌐 Production URLs:"
    echo "   • Frontend: http://localhost:3000 (pointing to production Convex)"
    echo "   • Convex: https://clever-hare-825.convex.cloud"
    
elif [ "$1" == "deploy" ]; then
    echo "🚀 Running complete deployment..."
    ./deploy.sh
    
else
    echo "Usage: ./dev-workflow.sh [dev|prod|deploy]"
    echo ""
    echo "Commands:"
    echo "  dev    - Switch to development environment"
    echo "  prod   - Switch to production environment (for testing)"
    echo "  deploy - Deploy to production (both Convex and Vercel)"
    echo ""
    echo "Current environment:"
    cat .env.local 2>/dev/null || echo "No .env.local file found"
fi
