#!/bin/bash

# Complete deployment script for Halal Gelatin Project
# This script handles both frontend (GitHub/Vercel) and backend (Convex) deployment

set -e  # Exit on any error

echo "🚀 Starting complete deployment process..."

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Warning: You're not on the main branch (currently on $CURRENT_BRANCH)"
    echo "   Deploying from $CURRENT_BRANCH to production..."
fi

# Step 1: Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Found uncommitted changes. Please commit them first:"
    echo "   git add ."
    echo "   git commit -m 'Your commit message'"
    exit 1
fi

# Step 2: Deploy Convex to production
echo "🔧 Deploying Convex backend to production..."
npx convex deploy --yes

# Step 3: Push to GitHub (which triggers Vercel deployment)
echo "📤 Pushing to GitHub (triggers Vercel deployment)..."
git push origin $CURRENT_BRANCH

echo "✅ Deployment complete!"
echo ""
echo "📊 Deployment Summary:"
echo "   • Convex Backend: ✅ Deployed to production"
echo "   • Frontend: ✅ Pushed to GitHub (Vercel will auto-deploy)"
echo ""
echo "🔗 Production URLs:"
echo "   • Convex: https://clever-hare-825.convex.cloud"
echo "   • Frontend: Check your Vercel dashboard"
echo ""
echo "⚠️  Remember: Set NEXT_PUBLIC_CONVEX_URL in Vercel dashboard:"
echo "   NEXT_PUBLIC_CONVEX_URL=https://clever-hare-825.convex.cloud"
