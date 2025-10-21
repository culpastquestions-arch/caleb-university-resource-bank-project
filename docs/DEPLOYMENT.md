# Deployment Guide

This guide will help you deploy CURB to Vercel for free hosting.

## Prerequisites

- GitHub account
- Vercel account (free - sign up with GitHub)
- Google Drive API configured (see [SETUP_DRIVE_API.md](./SETUP_DRIVE_API.md))

## Overview

The deployment process:
1. Push code to GitHub
2. Connect Vercel to your GitHub repository
3. Configure environment variables
4. Deploy!

---

## Step 1: Prepare Your Code

### Update API Configuration

Before deploying, update `index.html` to read API credentials properly:

```javascript
// Replace the window.ENV section with:
window.ENV = {
  GOOGLE_DRIVE_API_KEY: 'YOUR_API_KEY_HERE',
  GOOGLE_DRIVE_ROOT_FOLDER_ID: 'YOUR_FOLDER_ID_HERE'
};
```

**Important:** For production, you should either:
- Option A: Hardcode the credentials (less secure but simpler)
- Option B: Use a backend to serve config (more secure but complex)

For this static site, Option A is acceptable since API keys are meant to be restricted to your domain anyway.

---

## Step 2: Create GitHub Repository

### If you haven't initialized Git yet:

1. Open terminal in your project folder
2. Run these commands:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - CURB Resource Bank"
   ```

### Create repository on GitHub:

1. Go to [GitHub](https://github.com)
2. Click the **"+"** icon → **"New repository"**
3. Name it: `curb-resource-bank`
4. Keep it **Public** or **Private** (your choice)
5. **Don't** initialize with README (we already have code)
6. Click **"Create repository"**

### Push to GitHub:

```bash
git remote add origin https://github.com/YOUR_USERNAME/curb-resource-bank.git
git branch -M main
git push -u origin main
```

---

## Step 3: Set Up Vercel

### Create Vercel Account:

1. Go to [Vercel](https://vercel.com)
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"**
4. Authorize Vercel to access your GitHub

### Import Your Project:

1. On Vercel dashboard, click **"Add New..."** → **"Project"**
2. Find your `curb-resource-bank` repository
3. Click **"Import"**

### Configure Project:

**Framework Preset:** None (or select "Other")

**Root Directory:** `./` (default)

**Build Command:** Leave empty

**Output Directory:** Leave empty (we're deploying static files)

---

## Step 4: Configure Environment Variables (Optional)

If you want to use environment variables:

1. In the import screen, expand **"Environment Variables"**
2. Add:
   - **Key:** `GOOGLE_DRIVE_API_KEY`
   - **Value:** Your API key
3. Add:
   - **Key:** `GOOGLE_DRIVE_ROOT_FOLDER_ID`
   - **Value:** Your folder ID

**Note:** Since this is a static site, environment variables at build time won't automatically inject into `window.ENV`. You'll need to use the hardcoded approach in `index.html` or implement a build script.

---

## Step 5: Deploy

1. Click **"Deploy"**
2. Wait 1-2 minutes for deployment
3. Once complete, you'll get a URL like: `https://curb-resource-bank.vercel.app`
4. Click the URL to visit your live site!

---

## Step 6: Test Your Deployment

1. Visit your deployed URL
2. Open Developer Tools (F12) → Console
3. Check for any errors
4. Try navigating through departments
5. Verify PDFs can be viewed/downloaded

---

## Step 7: Custom Domain (Optional)

### Use Vercel Subdomain:

Your free subdomain: `https://your-project.vercel.app`

### Add Custom Domain:

1. In Vercel project, go to **"Settings"** → **"Domains"**
2. Enter your domain (e.g., `curb.calebuniversity.edu.ng`)
3. Follow instructions to update DNS records
4. Wait for DNS propagation (can take 24-48 hours)

**DNS Records needed:**
- Type: `CNAME`
- Name: `curb` (or `@` for root domain)
- Value: `cname.vercel-dns.com`

---

## Continuous Deployment

Once connected to GitHub, Vercel automatically:
- ✅ Deploys when you push to `main` branch
- ✅ Creates preview deployments for pull requests
- ✅ Provides deployment URLs for each commit

### To Update Your Site:

```bash
# Make changes to your code
git add .
git commit -m "Description of changes"
git push
```

Vercel will automatically redeploy in ~1 minute!

---

## Managing Deployments

### View Deployments:

1. Go to Vercel dashboard
2. Click your project
3. See all deployments under **"Deployments"** tab

### Rollback to Previous Version:

1. Find the deployment you want to restore
2. Click **"..."** menu
3. Click **"Promote to Production"**

---

## Troubleshooting

### Site not loading:

1. Check Vercel deployment logs
2. Look for build errors
3. Verify all files were committed to Git

### API not working:

1. Check API key in `index.html`
2. Verify domain is whitelisted in Google Cloud Console
3. Check browser console for specific errors

### Files returning 404:

1. Ensure all file paths are relative
2. Check `vercel.json` routing configuration
3. Verify files exist in repository

### Changes not appearing:

1. Make sure you pushed to GitHub
2. Check Vercel is connected to correct branch
3. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
4. Check if deployment succeeded in Vercel dashboard

---

## Performance Optimization

Vercel automatically provides:
- ✅ Global CDN
- ✅ Automatic HTTPS
- ✅ HTTP/2
- ✅ Brotli compression
- ✅ Edge caching

No additional configuration needed!

---

## Monitoring & Analytics

### Built-in Analytics:

1. Go to Vercel project
2. Click **"Analytics"** tab
3. View page views, top pages, performance metrics

### Error Tracking:

1. Check **"Logs"** in Vercel dashboard
2. Set up [Sentry](https://sentry.io) for detailed error tracking (optional)

---

## Cost

**Vercel Free Tier includes:**
- ✅ Unlimited projects
- ✅ 100 GB bandwidth per month
- ✅ Automatic SSL
- ✅ Custom domains
- ✅ Automatic deployments

**This should be more than enough for a university resource bank!**

If you exceed limits:
- Bandwidth overage: ~$0.10/GB (unlikely for a document site)

---

## Security

### Vercel automatically provides:

- ✅ DDoS protection
- ✅ SSL/TLS certificates
- ✅ Secure headers (configured in `vercel.json`)

### Additional recommendations:

1. Keep your API key restricted to your domain
2. Regularly check Google Cloud Console for unusual API activity
3. Monitor Vercel analytics for suspicious traffic patterns

---

## Alternative Hosting Platforms

If you prefer not to use Vercel, these also work:

### Netlify:
- Similar to Vercel
- Drag-and-drop deployment
- [netlify.com](https://netlify.com)

### GitHub Pages:
- Free with GitHub
- `username.github.io/repo-name`
- [docs.github.com/pages](https://docs.github.com/pages)

### Cloudflare Pages:
- Free tier
- Global CDN
- [pages.cloudflare.com](https://pages.cloudflare.com)

---

## Getting Help

**Vercel Documentation:** [vercel.com/docs](https://vercel.com/docs)

**Vercel Support:** Available in dashboard (bottom right chat icon)

**Community:** [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)

---

## Next Steps

- ✅ Site is deployed!
- Set up [Google Forms for contact](./GOOGLE_FORM_SETUP.md)
- Share the URL with students
- Monitor usage and feedback
- Regularly update Drive with new materials

