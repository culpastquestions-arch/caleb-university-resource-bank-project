# CURB Handover Guide

> This guide is for whoever takes over the Caleb University Resource Bank after the
> current team moves on. Read it fully before making any changes.

---

## Table of Contents

1. [What CURB Is](#what-curb-is)
2. [How the App Works (Overview)](#how-the-app-works)
3. [Project Files — What Each One Does](#project-files)
4. [The Google Drive Folder Structure](#google-drive-folder-structure)
5. [The Google Sheets (Team Data)](#google-sheets-team-data)
6. [Environment Variables](#environment-variables)
7. [Running Locally](#running-locally)
8. [Deploying to Vercel](#deploying-to-vercel)
9. [Deploying to cPanel (Backup Option)](#deploying-to-cpanel)
10. [Day-to-Day Maintenance](#day-to-day-maintenance)
11. [Common Problems and Fixes](#common-problems-and-fixes)
12. [How to Make Changes](#how-to-make-changes)
13. [Things That Will Eventually Break](#things-that-will-eventually-break)
14. [Account Access Checklist](#account-access-checklist)

---

## What CURB Is

CURB is a website where Caleb University students browse and download past exam questions
organized by department, level, semester, and academic session.

It has four pages:

| Page | URL | Purpose |
|---|---|---|
| Home | `#/` | Search and browse departments |
| Browse | `#/Computer Science/100 Level/...` | Navigate through folders to find PDFs |
| About | `#/about` | Shows the executive team and department reps |
| Track | `#/track` | Shows which departments have uploaded materials |

The PDFs themselves are NOT stored on the website. They live in Google Drive. The website
is just a nice way to browse the Drive folder structure and link students to the files.

---

## How the App Works

```
┌──────────────────────────────────────────────────────────────┐
│                     Student's Browser                        │
│                                                              │
│  index.html ──► js/app.js ──► js/drive-api.js               │
│                                      │                       │
│                                      │ fetch('/api/browse')  │
│                                      ▼                       │
├──────────────────────────────────────────────────────────────┤
│                  Vercel Serverless Functions                  │
│                                                              │
│  api/browse.js ───► Google Drive API                         │
│  api/coverage.js ─► Google Drive API                         │
│  api/team.js ─────► Google Sheets (CSV)                      │
│                                                              │
│  (These use the GOOGLE_DRIVE_API_KEY stored on the server.   │
│   The key is NEVER sent to the student's browser.)           │
└──────────────────────────────────────────────────────────────┘
```

**The flow for browsing past questions:**

1. Student opens the site and sees a list of departments.
2. They click a department → the browser calls `/api/browse?path=/Computer Science&type=folders`.
3. The serverless function calls the Google Drive API with the secret API key.
4. It returns the list of levels (100 Level, 200 Level, etc.) as JSON.
5. The browser displays them. This repeats at each navigation step.
6. At the final level, the student sees PDF files with direct Google Drive download links.

**The flow for team data:**

1. Student goes to `#/about`.
2. Browser calls `/api/team`.
3. The serverless function fetches the published CSV from Google Sheets.
4. It parses the CSV, formats the data, and returns JSON.
5. The browser renders the team cards.

---

## Project Files

### Root Files

| File | Purpose |
|---|---|
| `index.html` | The one and only HTML page. Everything renders inside `<div id="main-content">`. |
| `sw.js` | Service worker for offline support and caching. |
| `manifest.json` | PWA manifest — lets students "install" CURB on their phone's home screen. |
| `offline.html` | Shown when the student has no internet and no cached version. |
| `vercel.json` | Tells Vercel how to handle routing and security headers. |
| `.htaccess` | Same thing as vercel.json, but for Apache/cPanel hosting. |
| `server.js` | Local development server. Not used in production. |
| `.env` | Secret environment variables. **Never commit this to git.** |
| `env.example` | Template showing which env vars are needed. |
| `package.json` | Only contains dev tools (jest, eslint, prettier). No production dependencies. |

### Frontend — `js/` folder

Files are loaded in this order by `index.html`:

| File | What It Does |
|---|---|
| `js/bootstrap.js` | Runs first. Sets up the API endpoint, loads Font Awesome fallback, registers the service worker. |
| `js/config.js` | App configuration: department colors, team data fallbacks, version number. |
| `js/cache.js` | `PathCacheManager` — caches API responses in localStorage so pages load faster. |
| `js/drive-api.js` | `DriveAPI` class — makes requests to `/api/browse` and handles client-side caching. |
| `js/navigation.js` | `Navigator` class — hash-based SPA router (`#/department/level/semester/session`). |
| `js/pwa.js` | `PWAManager` — handles the "Install App" button and install flow. |
| `js/ui/notification-helper.js` | Toast notifications (success/error messages). |
| `js/ui/contact-modal-helper.js` | Opens/closes the contact form modal. |
| `js/renderers/team-renderer.js` | Renders the About page (executives + department reps). |
| `js/renderers/coverage-renderer.js` | Renders the Track page (coverage grid). |
| `js/renderer.js` | Main renderer — renders home, levels, semesters, sessions, and files views. |
| `js/app.js` | `App` class — orchestrates everything. Initialization, routing, event listeners. |

### Backend — `api/` folder

**Node.js handlers (used by Vercel):**

| File | Endpoint | Purpose |
|---|---|---|
| `api/browse.js` | `/api/browse` | Browses Google Drive folders and files. The main API. |
| `api/coverage.js` | `/api/coverage` | Checks which level/semester combos have PDFs uploaded. |
| `api/team.js` | `/api/team` | Fetches team member data from Google Sheets. |
| `api/_utils.js` | — | Shared utilities: CORS, HTTP helpers, folder normalization. |

> **PHP fallback:** A complete PHP implementation (for cPanel hosting) is preserved on
> the `php-archive` branch. If you ever need to migrate away from Vercel, check out
> that branch for the equivalent PHP handlers (`browse.php`, `coverage.php`, `team.php`,
> `_config.php`, `_utils.php`) and the `.htaccess` routing rules.


### Other Folders

| Folder | Purpose |
|---|---|
| `css/` | `variables.css` (design tokens) + `styles.css` (all styles). |
| `assets/` | Just `logo.png`. |
| `docs/` | This guide + `caching-policy.md`. |
| `scripts/` | `stamp-version.js` — auto-stamps git commit hash into version strings on deploy. |
| `test/` | Jest unit tests. Run with `npm test`. |

---

## Google Drive Folder Structure

The entire app depends on a specific folder structure in Google Drive. **Do not
reorganize these folders without understanding the impact.**

```
Root Folder (ID stored in GOOGLE_DRIVE_ROOT_FOLDER_ID)
│
├── Accounting/
│   ├── 100 Level/
│   │   ├── 1st Semester/
│   │   │   ├── 2024~25 Session/
│   │   │   │   ├── ACC101 - Intro to Accounting.pdf
│   │   │   │   └── ACC102 - Financial Accounting.pdf
│   │   │   └── 2023~24 Session/
│   │   │       └── ...
│   │   └── 2nd Semester/
│   │       └── ...
│   ├── 200 Level/
│   │   └── ...
│   └── ...
│
├── Computer Science/
│   └── (same structure)
│
├── Jupeb/                    ← Special case: no semester layer
│   ├── Art/
│   │   ├── 2024~25 Session/
│   │   │   └── files...
│   │   └── ...
│   ├── Business/
│   └── Science/
│
└── ... (other departments)
```

### Rules for the Drive Folder Structure

1. **Hierarchy:** Department → Level → Semester → Session → PDF files.
2. **Exception — Jupeb:** Department → Subject → Session → PDF files (no semester).
3. **Session folder names** must include "Session" (e.g., "2024/25 Session" or "2024~25 Session").
4. **Slashes in folder names:** Google Drive allows `/` in names. In the URL, `/` is
   replaced with `~` (e.g., "2024/25 Session" becomes "2024~25 Session" in the URL).
5. **Sharing:** The root folder AND all subfolders must be shared as
   **"Anyone with the link" → Viewer**. Otherwise the API can't read them.
6. **Only PDFs are shown.** The app filters for `mimeType='application/pdf'`.

### How to Add a New Department

1. Create a new folder in the root Drive folder with the department name.
2. Inside it, create level folders (e.g., "100 Level", "200 Level", etc.).
3. Inside each level, create semester folders ("1st Semester", "2nd Semester").
4. Inside each semester, create session folders ("2025/26 Session").
5. Upload PDFs into the session folders.
6. Make sure sharing permissions are set correctly.
7. The department will appear on the website automatically. No code changes needed.

---

## Google Sheets (Team Data)

The About page pulls team data from two tabs in a Google Sheet:

### Tab 1: Executives

| Column | Required | Example |
|---|---|---|
| `name` | Yes | Jesusegun |
| `role` | Yes | Founder & Coordinator |
| `photoUrl` | No | (Google Drive share link to a photo) |
| `order` | No | 1 (controls display order) |
| `session` | Yes | 2025/26 |

### Tab 2: Department Reps

| Column | Required | Example |
|---|---|---|
| `department` | Yes | Computer Science |
| `name` | Yes | John Doe |
| `photoUrl` | No | (Google Drive share link to a photo) |
| `session` | Yes | 2025/26 |

### How It Works

1. The Google Sheet must be **published to the web** as CSV:
   - `File → Share → Publish to web → select the tab → CSV format → Publish`
2. Each tab gets its own published URL. These URLs go into the environment variables:
   - Tab 1 URL → `TEAM_SHEET_EXECUTIVES_URL`
   - Tab 2 URL → `TEAM_SHEET_REPS_URL`

### How to Update Team Data for a New Session

1. Open the Google Sheet.
2. Add new rows with the new session value (e.g., "2026/27").
3. Keep the old rows — the app shows data per session and defaults to the latest.
4. That's it. No code changes or redeployment needed. The data refreshes automatically
   (cached for 24 hours).

### Photo URLs

- Upload the photo to Google Drive.
- Right-click → Share → "Anyone with the link" → Copy link.
- Paste the share link into the `photoUrl` column. The backend converts it to a
  thumbnail URL automatically.

---

## Environment Variables

These are secrets that must NEVER be in the code or git history.

| Variable | Where to Get It | What It Does |
|---|---|---|
| `GOOGLE_DRIVE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) | Authenticates API calls to Google Drive |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | The ID from the Drive folder URL | Points to the root folder with all departments |
| `TEAM_SHEET_EXECUTIVES_URL` | Google Sheets → Publish to web | Published CSV URL for executives tab |
| `TEAM_SHEET_REPS_URL` | Google Sheets → Publish to web | Published CSV URL for reps tab |
| `ALLOWED_ORIGIN` | Your production URL | Restricts API access (e.g., `https://curb.yourdomain.com`) |

### How to Find the Root Folder ID

The Google Drive folder URL looks like:
```
https://drive.google.com/drive/folders/1ABCDeFgHiJkLmNoPqRsTuVwXyZ_EXAMPLE
```
The folder ID is the long string at the end: `1ABCDeFgHiJkLmNoPqRsTuVwXyZ_EXAMPLE`.

### How to Create/Rotate the Google API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Select the project (or create one).
3. Go to **APIs & Services → Credentials**.
4. Click **Create Credentials → API Key**.
5. Restrict the key:
   - **Application restriction:** HTTP referrers → add your domain.
   - **API restriction:** Google Drive API only.
6. Copy the key and set it as `GOOGLE_DRIVE_API_KEY` in your hosting platform.

---

## Running Locally

### Option 1: Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally (one time)
npm install -g vercel

# Create a .env file from the template
cp env.example .env
# Fill in your actual values in .env

# Start the local dev server
npx vercel dev
```

Open http://localhost:3000.

### Option 2: Using the Built-In Server

```bash
# Set environment variables (or use .env file)
node server.js
```

Open http://localhost:3000. This uses `server.js` which wraps the same API handlers.

### Running Tests

```bash
npm test          # Run all tests
npm run lint      # Check for code issues
npm run quality   # Run tests + lint + format check
```

---

## Deploying to Vercel

### First-Time Setup

1. Create a [Vercel account](https://vercel.com) (free plan is fine).
2. Connect your GitHub repository.
3. In the Vercel dashboard, go to **Project Settings → Environment Variables**.
4. Add all five environment variables (see table above).
5. Set them for **Production**, **Preview**, and **Development** environments.
6. Deploy. Vercel auto-detects the project type and deploys.

### Subsequent Deployments

- **Automatic:** Push to `main` branch on GitHub → Vercel auto-deploys.
- **Manual:** Run `vercel --prod` from the project directory.

### Custom Domain

1. Buy a domain from a registrar (Namecheap, Cloudflare, etc.).
2. In Vercel dashboard → **Project Settings → Domains** → Add your domain.
3. Update DNS records as Vercel instructs (usually a CNAME record).
4. Update `ALLOWED_ORIGIN` to your new domain URL.
5. Wait for DNS propagation (up to 48 hours, usually much faster).

### After Deployment, Verify

- [ ] Home page loads and departments list appears.
- [ ] Clicking a department shows levels.
- [ ] Navigating to files shows PDFs with working download links.
- [ ] About page shows team members.
- [ ] Track page loads (accessible via `#/track`).

---

## Deploying to cPanel

If Vercel is no longer viable, the project can run on any cheap PHP hosting (cPanel).

### Steps

1. Upload the entire project to the `public_html` directory via FTP or File Manager.
2. Create a `.env` file in the project root with the same five environment variables.
3. Make sure `.htaccess` is present (it handles routing + security headers).
4. Make sure the `api/_cache/` directory exists and is writable by PHP.
5. No build step needed. No npm needed. The PHP handlers work independently.

### How It Works on cPanel

- `.htaccess` rewrites `/api/browse` → `api/browse.php`, etc.
- The PHP files (`api/browse.php`, `api/coverage.php`, `api/team.php`) do the exact
  same thing as the Node.js files, just in PHP.
- `api/_config.php` loads the `.env` file and defines constants.
- `api/_utils.php` has the shared helper functions.
- Caching uses the filesystem (`api/_cache/` directory) instead of in-memory Maps.

### What Doesn't Work on cPanel

- The `scripts/stamp-version.js` version stamping won't run automatically.
  You'd need to manually update the version in `sw.js`, `js/config.js`, and
  `manifest.json` when deploying, or set up a build script.

---

## Day-to-Day Maintenance

### Things That Do NOT Require Code Changes

| Task | How to Do It |
|---|---|
| **Upload new past questions** | Add PDFs to the correct Google Drive folders. |
| **Add a new department** | Create the folder structure in Google Drive (see above). |
| **Update team members** | Edit the Google Sheet. |
| **Start a new academic session** | Add rows with the new session value in the Google Sheet. Create new session folders in Google Drive. |
| **Change a team member's photo** | Upload a new photo to Drive, update the URL in the Sheet. |

### Things That DO Require Code Changes

| Task | What to Change |
|---|---|
| **Add a new special department like Jupeb** | Update `LEVEL_EXCEPTIONS` in `api/_utils.js`. |
| **Change the contact email/WhatsApp** | Edit `index.html` (around line 152-154). |
| **Change the Google Form for contact** | Edit the iframe `src` in `index.html` (around line 139). |
| **Update the fallback team data** | Edit `js/config.js` (the `about.executives` and `about.departmentReps` arrays). |
| **Change the app name or branding** | Edit `index.html`, `manifest.json`, `js/config.js`. |
| **Change the app colors** | Edit `css/variables.css`. |

### Version Bumping

When deploying changes, update the version in these three files to force cache refresh:

1. `sw.js` → Line 3: `const SW_VERSION = '...'`
2. `js/config.js` → Line 18: `version: "..."`
3. `manifest.json` → Line 6: `"version": "..."`

> On Vercel, this is done automatically by `scripts/stamp-version.js` during deploy.
> On cPanel, you must do it manually.

---

## Common Problems and Fixes

### "Departments list is empty"

- **Cause:** The Google Drive API key is invalid or the root folder ID is wrong.
- **Fix:**
  1. Check that `GOOGLE_DRIVE_API_KEY` is set correctly in Vercel/cPanel.
  2. Check that `GOOGLE_DRIVE_ROOT_FOLDER_ID` matches the actual folder.
  3. Confirm the root folder is shared as "Anyone with the link."

### "Team photos are not loading"

- **Cause:** Photos aren't shared publicly in Google Drive.
- **Fix:** Right-click the photo in Drive → Share → "Anyone with the link."

### "About page is empty"

- **Cause:** The Google Sheets CSV URLs are wrong or the sheet isn't published.
- **Fix:**
  1. Open the Google Sheet → File → Share → Publish to web.
  2. Make sure the correct tab is selected and format is CSV.
  3. Copy the new URL and update `TEAM_SHEET_EXECUTIVES_URL` / `TEAM_SHEET_REPS_URL`.

### "Site says 'Server configuration error'"

- **Cause:** One or more environment variables are missing.
- **Fix:** Check all five environment variables are set in your hosting dashboard.

### "Files show in Drive but not on the website"

- **Cause:** Files are not PDFs, or the folder isn't shared.
- **Fix:** Only PDFs show up. Make sure the file type is PDF (not Word/image).
  Also verify sharing permissions on the parent folders.

### "Old data is still showing after I updated Drive/Sheets"

- **Cause:** Caching at multiple levels.
- **Fix:**
  1. Click the refresh button (🔄) on the website.
  2. If that doesn't work, the server-side cache will expire:
     - Browse data: 30 minutes
     - Coverage data: 5 minutes
     - Team data: 24 hours
  3. If urgent, redeploy the app (Vercel re-deploys clear all server-side caches).

### "Error 429 on the coverage page"

- **Cause:** Too many people loading the coverage page at once.
- **Fix:** This is a rate limiter protecting the Google API quota. Wait a moment and retry.
  If it happens often, you may need to request a Google API quota increase.

### "Students can't install the app on their phone"

- **Cause:** PWA install requires HTTPS.
- **Fix:** Make sure your site is served over HTTPS (automatic on Vercel).

---

## How to Make Changes

### Editing Frontend Code

1. Make changes to files in `js/`, `css/`, or `index.html`.
2. Test locally using `npx vercel dev` or `node server.js`.
3. Commit and push to GitHub. Vercel auto-deploys.

### Editing Backend (API) Code

1. Make changes to the `.js` file in `api/`.
2. Test locally using `npx vercel dev` or `node server.js`.
3. Commit and push.

### Adding a New API Endpoint

1. Create `api/newname.js` following the pattern of existing handlers.
2. Add the handler mapping in `server.js` (for local dev).
3. If it has caching, document it in `docs/caching-policy.md`.

---

## Things That Will Eventually Break

These are guaranteed future issues. Not if, but when.

### 1. Google Drive API v3 Deprecation

Google will eventually deprecate Drive API v3. When this happens:
- The `api/browse.js`, `api/coverage.js` functions will stop working.
- You'll need to update the API URLs and potentially the response parsing.
- Check the [Google Drive API documentation](https://developers.google.com/drive/api)
  for migration guides.

### 2. Node.js Version Updates

Vercel periodically drops support for older Node.js versions. When your version is
deprecated, Vercel will warn you in the dashboard. Update by adding to `package.json`:
```json
{
  "engines": {
    "node": ">=20.x"
  }
}
```

### 3. Google API Key Expiration or Quota Limits

If the Google Cloud project is inactive for too long, Google may disable the API key.
Reactivate it in [Google Cloud Console](https://console.cloud.google.com/).

Default quota: 12,000 queries per 100 seconds. This is more than enough for 200 students
thanks to the CDN caching headers. But if the site grows significantly, you may need to
request a quota increase.

### 4. CDN/Library Updates

The site uses these external resources:
- **Font Awesome 6.5.1** from cdnjs (with SRI hash).
- **Lucide Icons 1.8.0** from unpkg (with SRI hash).
- **Google Fonts (Inter)** from fonts.googleapis.com.

If these CDNs change URLs or the SRI hashes become invalid, icons/fonts will break.
Fix by updating the `<link>` and `<script>` tags in `index.html` with new URLs/hashes.

### 5. Google Sheets CSV URL Changes

If someone un-publishes or reorganizes the Google Sheet, the CSV URLs will break.
Re-publish and update the environment variables.

---

## Account Access Checklist

Before the current team leaves, make sure the new team has access to ALL of these:

| Account | What It Controls | Who Has Access |
|---|---|---|
| **GitHub repository** | Source code, auto-deployment | _____________ |
| **Vercel account** | Hosting, environment variables, domain | _____________ |
| **Google Cloud Console** | API key, quota management | _____________ |
| **Google Drive** (owner) | Past question PDFs, folder structure | _____________ |
| **Google Sheets** (editor) | Team data (executives + reps) | _____________ |
| **Domain registrar** | DNS records, domain renewal | _____________ |
| **Google account for contact form** | Google Form responses | _____________ |
| **Email** (cul.pastquestions@gmail.com) | Contact email | _____________ |

> **Fill in the names/emails above and keep this in a secure location
> accessible to the incoming team.**

---

## Quick Reference Card

```
Website URL:     https://your-domain.com
Vercel Dashboard: https://vercel.com/dashboard
Google Cloud:    https://console.cloud.google.com
GitHub Repo:     https://github.com/your-org/curb

Run locally:     npx vercel dev
Run tests:       npm test
Deploy:          git push origin main (auto-deploys on Vercel)

Env vars needed: GOOGLE_DRIVE_API_KEY
                 GOOGLE_DRIVE_ROOT_FOLDER_ID
                 TEAM_SHEET_EXECUTIVES_URL
                 TEAM_SHEET_REPS_URL
                 ALLOWED_ORIGIN
```

---

*Last updated: June 2026*
*Written for the incoming CURB team by the founding technical team.*
