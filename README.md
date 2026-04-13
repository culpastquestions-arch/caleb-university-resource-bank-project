# Caleb University Resource Bank (CURB)

CURB is a web app for Caleb University students to browse and download past questions by department, level, semester, and session.

## What It Includes

- Department-first navigation with hash routing.
- Team page with session-aware executive and department rep data.
- Coverage tracker for file availability checks.
- PWA support (installable, offline fallback, service worker cache).
- Serverless API layer for Google Drive and Google Sheets access.

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Vercel Serverless Functions (Node.js)
- Storage/Caching: LocalStorage + Service Worker

## Local Setup

1. Create a local env file from [env.example](env.example).
2. Set these required variables:
	- GOOGLE_DRIVE_API_KEY
	- GOOGLE_DRIVE_ROOT_FOLDER_ID
	- TEAM_SHEET_EXECUTIVES_URL
	- TEAM_SHEET_REPS_URL
3. Start local serverless runtime:

```bash
npx vercel dev
```

4. Open http://localhost:3000.

## API Routes

- [api/browse.js](api/browse.js): Drive folder/file browsing.
- [api/coverage.js](api/coverage.js): Department/session coverage scan.
- [api/team.js](api/team.js): Team data from published sheet CSV URLs.

## Security

- Google API keys are server-side only.
- Security headers are set in [vercel.json](vercel.json).
- API routes use validation and defensive caching.

## Deployment

Deploy to Vercel with the same environment variables used locally.

## License

MIT
