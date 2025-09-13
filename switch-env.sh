#!/bin/bash

# Script to switch between development and production environments

if [ "$1" == "dev" ]; then
    echo "Switching to DEVELOPMENT environment..."
    echo 'NEXT_PUBLIC_CONVEX_URL=https://patient-meadowlark-297.convex.cloud
CONVEX_DEPLOYMENT=dev:patient-meadowlark-297' > .env.local
    echo "✅ Development environment set"
    echo "🔗 Convex URL: https://patient-meadowlark-297.convex.cloud"
    echo "📋 Run: git checkout dev && npx convex dev && npm run dev"
    
elif [ "$1" == "prod" ]; then
    echo "Switching to PRODUCTION environment..."
    echo 'NEXT_PUBLIC_CONVEX_URL=https://clever-hare-825.convex.cloud' > .env.local
    echo "✅ Production environment set"
    echo "🔗 Convex URL: https://clever-hare-825.convex.cloud"
    echo "📋 Run: git checkout main && npm run dev"
    
else
    echo "Usage: ./switch-env.sh [dev|prod]"
    echo ""
    echo "Examples:"
    echo "  ./switch-env.sh dev   - Switch to development environment"
    echo "  ./switch-env.sh prod  - Switch to production environment"
    echo ""
    echo "Current environment:"
    cat .env.local 2>/dev/null || echo "No .env.local file found"
fi
