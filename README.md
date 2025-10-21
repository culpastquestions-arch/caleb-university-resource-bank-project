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
- API: Google Drive API v3
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
├── css/
│   ├── variables.css       # Color scheme & design tokens
│   └── styles.css          # All styles
├── js/
│   ├── config.js           # App configuration
│   ├── cache.js            # Cache management
│   ├── drive-api.js        # Google Drive integration
│   ├── navigation.js       # SPA routing
│   └── app.js              # Main application logic
├── assets/
│   ├── logo-placeholder.svg
│   └── icons/
└── docs/
    ├── SETUP_DRIVE_API.md
    ├── DEPLOYMENT.md
    └── GOOGLE_FORM_SETUP.md
```

## Quick Start

### Prerequisites

- Google account with Drive access
- GitHub account for deployment
- Text editor

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/Caleb-university-resource-bank.git
   cd Caleb-university-resource-bank
   ```

2. Organize your Google Drive with the following structure:
   ```
   Root Folder/
   ├── Department Name/
   │   ├── 100 Level/
   │   │   ├── 1st Semester/
   │   │   │   └── 2024/25 Session/
   │   │   │       └── *.pdf files
   │   │   └── 2nd Semester/
   │   └── 200 Level/
   ```

3. Set up Google Drive API (see [docs/SETUP_DRIVE_API.md](docs/SETUP_DRIVE_API.md))

4. Configure credentials in `index.html` (line ~150):
   ```javascript
   window.ENV = {
     GOOGLE_DRIVE_API_KEY: 'your_api_key_here',
     GOOGLE_DRIVE_ROOT_FOLDER_ID: 'your_folder_id_here'
   };
   ```

5. Test locally:
   ```bash
   python -m http.server 8000
   # Or
   npx serve
   ```
   Visit `http://localhost:8000`

6. Deploy to Vercel (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))

## Documentation

- [Google Drive API Setup](docs/SETUP_DRIVE_API.md) - Configure Drive API
- [Deployment Guide](docs/DEPLOYMENT.md) - Deploy to Vercel
- [Google Form Setup](docs/GOOGLE_FORM_SETUP.md) - Add contact form

## Configuration

### Change Colors

Edit `css/variables.css`:
```css
:root {
  --primary-green: #0F9D58;
  --primary-blue: #1967D2;
}
```

### Add Departments

Edit `js/config.js`:
```javascript
departments: [
  "Your New Department",
  // ... existing departments
]
```

### Cache Duration

Change in `js/config.js`:
```javascript
cache: {
  durationDays: 30  // Default: 30 days
}
```

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

- API key restricted to domain
- Read-only Drive access
- HTTPS enforced
- Security headers configured

## License

MIT License - feel free to use for your institution.

## Support

- Issues: [GitHub Issues](https://github.com/yourusername/Caleb-university-resource-bank/issues)
- Documentation: Check the `docs/` folder

---

Built for Caleb University Students
