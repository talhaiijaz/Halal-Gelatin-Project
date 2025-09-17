# 🚀 Deployment Guide - Halal Gelatin Project

## 📋 Complete Deployment Workflow

Your project has **two separate deployments** that need to be synchronized:

1. **Frontend (Next.js)** → Vercel (via GitHub)
2. **Backend (Convex)** → Convex Cloud (manual)

## 🔄 Development Workflow

### **Quick Commands:**
```bash
# Development
./dev-workflow.sh dev

# Production testing
./dev-workflow.sh prod

# Full deployment
./dev-workflow.sh deploy
```

### **Manual Workflow:**
```bash
# 1. Make changes locally
# ... edit your code ...

# 2. Commit changes
git add .
git commit -m "Your changes"
git push origin main

# 3. Deploy Convex to production
npx convex deploy

# 4. Vercel auto-deploys from GitHub
# (No manual action needed)
```

## 🌍 Environment Setup

### **Development Environment:**
- **Convex**: `patient-meadowlark-297` (dev)
- **Frontend**: `http://localhost:3000`
- **Command**: `./dev-workflow.sh dev`

### **Production Environment:**
- **Convex**: `clever-hare-825` (prod)
- **Frontend**: Vercel deployment
- **Command**: `./dev-workflow.sh prod` (for local testing)

## 📊 Deployment Components

| Component | Platform | Update Method | URL |
|-----------|----------|---------------|-----|
| **Frontend** | Vercel | `git push` (auto) | Your Vercel domain |
| **Backend** | Convex | `npx convex deploy` | `clever-hare-825.convex.cloud` |

## ⚙️ Vercel Configuration

Make sure your Vercel project has this environment variable:
```
NEXT_PUBLIC_CONVEX_URL=https://clever-hare-825.convex.cloud
```

## 🔧 Troubleshooting

### **If Vercel deployment fails:**
1. Check Vercel dashboard for error logs
2. Verify `NEXT_PUBLIC_CONVEX_URL` is set correctly
3. Check if Convex deployment is successful

### **If Convex deployment fails:**
1. Run `npx convex deploy --verbose` for detailed logs
2. Check if you're authenticated: `npx convex auth`
3. Verify your changes are committed

### **If data is not syncing:**
1. Check which environment you're pointing to: `cat .env.local`
2. Verify Convex deployment: `npx convex deploy --dry-run`
3. Check Vercel environment variables

## 📝 Best Practices

1. **Always test locally** with production data before deploying
2. **Deploy Convex first**, then push to GitHub
3. **Monitor Vercel logs** after deployment
4. **Keep environments synchronized**

## 🚨 Important Notes

- **Convex deployment is manual** - it doesn't auto-deploy from GitHub
- **Frontend deployment is automatic** - triggered by GitHub push
- **Environment variables must be set** in Vercel dashboard
- **Always test production locally** before full deployment
