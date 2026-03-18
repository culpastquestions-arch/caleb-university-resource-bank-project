# Quick Deployment Checklist

**Deploy CURB to Vercel in 5 minutes!**

## Prerequisites

✅ GitHub account
✅ Vercel account (free)
✅ Google Drive API key ([Get it here](./SETUP_DRIVE_API.md))
✅ Google Drive folder ID

---

## Step-by-Step Checklist

### 1️⃣ Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/curb-resource-bank.git
git push -u origin main
```

### 2️⃣ Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New..." → "Project"
4. Select your `curb-resource-bank` repo
5. Click "Import"

### 3️⃣ Add Environment Variables

**⚠️ CRITICAL: Add these TWO variables:**

| Key | Value | Where to Get It |
|-----|-------|-----------------|
| `GOOGLE_DRIVE_API_KEY` | Your API key | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Your folder ID | Google Drive URL |

**How to add:**
- During import: Expand "Environment Variables" section
- After deployment: Settings → Environment Variables

**Important:** Check all environments (Production, Preview, Development)

### 4️⃣ Deploy

1. Click "Deploy"
2. Wait 1-2 minutes
3. Visit your live site! 🎉

---

## Verify Deployment

### ✅ Quick Tests

1. **Visit your site** - Should load without errors
2. **Check backend** - Visit `/api/browse?path=/&type=folders` - Should return JSON
3. **Browse departments** - Click through to verify data loads
4. **View a PDF** - Ensure files open correctly

### 🔍 Debug if Needed

**If you see "Server configuration error":**
- Environment variables not set
- Go to Vercel Settings → Environment Variables
- Add missing variables
- Redeploy

**If data doesn't load:**
- Check Vercel function logs
- Verify Google Drive API is enabled
- Confirm folder ID is correct

---

## Custom Domain (Optional)

1. Vercel Settings → Domains
2. Enter your domain: `curb.yourschool.edu`
3. Add DNS record:
   - Type: `CNAME`
   - Name: `curb`
   - Value: `cname.vercel-dns.com`
4. Wait 24-48 hours for DNS propagation

---

## What Happens Next?

✅ **Automatic deployments** - Every git push redeploys
✅ **Preview deployments** - Each PR gets a preview URL
✅ **Server caching** - 30-minute cache for fast loads
✅ **Secure API** - Keys never exposed to clients

---

## Need More Help?

- [Full Deployment Guide](./DEPLOYMENT.md)
- [Backend Architecture](./BACKEND_ARCHITECTURE.md)
- [API Setup Guide](./SETUP_DRIVE_API.md)

---

## Estimated Traffic Capacity

With the serverless backend architecture:

- ✅ **500 concurrent users** - No problem
- ✅ **10,000 concurrent users** - Still fine
- ✅ **Google Drive API** - Stays within free tier
- ✅ **Vercel hosting** - Stays within free tier

**Total monthly cost: $0** 💰

See [Backend Architecture](./BACKEND_ARCHITECTURE.md) for scalability details.

