# Quick Start Guide

Get CURB up and running in 30 minutes!

## Prerequisites

✅ Google account  
✅ Google Drive folder with organized files  
✅ GitHub account  
✅ Vercel account (free)  
✅ 30 minutes of your time  

## Step-by-Step Setup

### 1. Organize Your Google Drive (5 minutes)

Create this folder structure:

```
Caleb University Past Questions/
├── Accounting/
│   ├── 100 Level/
│   │   ├── 1st Semester/
│   │   │   └── 2024/25 Session/
│   │   │       └── [your PDF files]
│   │   └── 2nd Semester/
│   │       └── 2024/25 Session/
│   ├── 200 Level/
│   └── ...
└── [other departments]/
```

**Important:**
- Share the root folder: Right-click → Share → "Anyone with the link" → Viewer
- Upload your PDF files to the appropriate session folders

### 2. Get Google Drive API Key (10 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "CURB"
3. Enable **Google Drive API**
4. Create credentials → **API Key**
5. Restrict key to **Google Drive API only** (API restriction)
6. Copy the API key

**Detailed guide:** [SETUP_DRIVE_API.md](./SETUP_DRIVE_API.md)

### 3. Get Your Folder ID (1 minute)

1. Open your root folder in Google Drive
2. Look at the URL:
   ```
   https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ
                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^
   ```
3. Copy the folder ID (the part after `/folders/`)

### 4. Configure CURB (2 minutes)

1. Download this project
2. Create your Vercel project (or open existing project)
3. In Vercel, go to **Settings** → **Environment Variables**
4. Add:
   - `GOOGLE_DRIVE_API_KEY` = your API key
   - `GOOGLE_DRIVE_ROOT_FOLDER_ID` = your root folder ID
5. (Optional but recommended) Add `ALLOWED_ORIGIN` = your production URL

**Important:** CURB now uses a serverless backend (`/api/browse`).
Your API key is read server-side and should **not** be placed in client files.

### 5. Test Locally (2 minutes)

Use Vercel local runtime so serverless API routes work:

```bash
npx vercel dev
```

Create `.env.local` (or copy from `env.example`) and set:
- `GOOGLE_DRIVE_API_KEY`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`

Visit `http://localhost:3000` and verify:
- ✅ Departments show up
- ✅ You can navigate through levels
- ✅ Files are visible
- ✅ PDFs can be viewed/downloaded
- ✅ `http://localhost:3000/api/browse?path=/&type=folders` returns JSON

### 6. Deploy to Vercel (10 minutes)

1. Create GitHub repository
2. Push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/curb.git
   git push -u origin main
   ```
3. Go to [Vercel](https://vercel.com)
4. Sign up with GitHub
5. Import your repository
6. Confirm environment variables are set:
   - `GOOGLE_DRIVE_API_KEY`
   - `GOOGLE_DRIVE_ROOT_FOLDER_ID`
7. Click Deploy
8. Done! Get your URL: `https://your-project.vercel.app`

**Detailed guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)

## That's It! 🎉

Your resource bank is now live!

## Next Steps

### Add Contact Form (Optional, 10 minutes)
1. Create a Google Form
2. Get embed code
3. Add to `index.html`

**Guide:** [GOOGLE_FORM_SETUP.md](./GOOGLE_FORM_SETUP.md)

### Customize Appearance (Optional)
- Replace logo in `assets/logo-placeholder.svg`
- Adjust colors in `css/variables.css`
- Update text in `index.html`

### Share With Students
- Share the Vercel URL
- Add to university website
- Share on social media
- Send via email/WhatsApp

## Common Issues & Fixes

### "API key not valid"
→ Check you copied the entire key  
→ Verify Drive API is enabled  
→ Check API restriction is set to Google Drive API  
→ Remove HTTP referrer restriction if using Vercel serverless backend  

### "Files not showing"
→ Verify folder is shared publicly  
→ Check folder ID is correct  
→ Ensure PDF files are uploaded  

### "Departments not loading"
→ Open browser console (F12)  
→ Check for error messages  
→ Verify `GOOGLE_DRIVE_API_KEY` and `GOOGLE_DRIVE_ROOT_FOLDER_ID` in Vercel Environment Variables  
→ Test `/api/browse?path=/&type=folders` directly in browser  

## Need Help?

- 📖 Read full documentation in `docs/` folder
- 🐛 Open an issue on GitHub
- 📧 Contact: curb@example.com

## Pro Tips

💡 **Updating content:** Just upload to Drive, students click "Refresh"  
💡 **Mobile:** Site works perfectly on phones - no app needed  
💡 **Offline:** Students can install as PWA for offline access  
💡 **Fast:** 30-day cache means lightning-fast loads  

---

**You're all set! Happy learning! 🎓**

