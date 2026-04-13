# Caleb University Resource Bank (CURB)

CURB is a lightweight web app for browsing and downloading past questions by department, level, semester, and session.

## Run

1. Configure variables in env.example.
2. Deploy on Vercel (or run with your preferred static + serverless setup).

## Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Vercel Serverless Functions (Node.js)
- Storage/Caching: LocalStorage + Service Worker

## Security

- Google API keys are server-side only.
- Security headers are set in vercel.json.
- API routes use validation and defensive caching.

## License

MIT
