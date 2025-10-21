# Caleb University Resource Bank (CURB)

A mobile-first web application for accessing past questions and study materials at Caleb University.

## Overview

CURB provides students with easy access to past questions organized by Department, Level, Semester, and Session. Built with vanilla JavaScript and integrated with Google Drive for content storage.

## Features

- Mobile-first responsive design
- Dynamic content syncing with Google Drive
- Smart caching for fast loading
- Department search functionality
- PDF viewer and download
- Dark mode support
- Offline PWA capabilities
- Lightweight with no heavy frameworks

## Tech Stack

- Frontend: HTML5, CSS3, JavaScript (Vanilla)
- Backend: Vercel Serverless Functions (Node.js)
- API: Google Drive API v3 (server-side proxy)
- Storage: LocalStorage + Service Worker
- Hosting: Vercel

## Project Structure

```
curb-resource-bank/
├── index.html              # Main HTML file
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── vercel.json             # Vercel configuration
├── env.example             # Environment variables template
├── api/
│   └── drive.js            # Serverless backend proxy (SECURE)
├── css/
│   ├── variables.css       # Color scheme & design tokens
│   └── styles.css          # All styles
├── js/
│   ├── config.js           # App configuration
│   ├── cache.js            # Cache management
│   ├── drive-api.js        # API client (calls backend)
│   ├── navigation.js       # SPA routing
│   └── app.js              # Main application logic
├── assets/
│   ├── logo-placeholder.svg
│   └── icons/
└── docs/
    ├── BACKEND_ARCHITECTURE.md  # Architecture & scalability
    ├── SETUP_DRIVE_API.md
    ├── DEPLOYMENT.md
    └── GOOGLE_FORM_SETUP.md
```

## Documentation

- [🚀 Quick Deployment (5 min)](docs/QUICK_DEPLOYMENT.md) ⭐ **START HERE**
- [Backend Architecture & Scalability](docs/BACKEND_ARCHITECTURE.md) ⭐ **NEW**
- [Google Drive API Setup](docs/SETUP_DRIVE_API.md)
- [Deployment Guide](docs/DEPLOYMENT.md) (Full guide)
- [Google Form Setup](docs/GOOGLE_FORM_SETUP.md)

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (iOS 12+)
- Samsung Internet
- Chrome Android

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to branch
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Security

CURB implements multiple security layers:

- **🔒 Serverless Backend Proxy**: API keys never exposed to clients
- **Server-side API calls**: All Google Drive requests happen server-side
- Content Security Policy (CSP) headers
- XSS and clickjacking protection
- Read-only Google Drive access
- HTTPS enforced via Vercel
- Comprehensive security headers
- No sensitive data storage

**Important:** API credentials are securely stored as Vercel environment variables and never exposed to the browser. See [Backend Architecture](docs/BACKEND_ARCHITECTURE.md) for details.

## License

MIT License - feel free to use for your institution.

## Support

- Issues: [GitHub Issues](https://github.com/yourusername/Caleb-university-resource-bank/issues)
- Documentation: Check the `docs/` folder

---

Built for Caleb University Students
