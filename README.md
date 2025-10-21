# Caleb University Resource Bank (CURB)

A modern, mobile-first web application for accessing past questions and study materials at Caleb University.

![CURB](assets/logo-placeholder.svg)

## 🎯 Overview

CURB provides students with easy access to past questions organized by:
- **Department** (20 departments)
- **Level** (100-400)
- **Semester** (1st/2nd)
- **Session** (e.g., 2024/25)

Built with vanilla JavaScript, CSS, and HTML. Integrates with Google Drive for content storage and management.

## ✨ Features

- 📱 **Mobile-First Design** - Optimized for smartphones and tablets
- 🔄 **Dynamic Content** - Automatically syncs with Google Drive
- 💾 **Smart Caching** - Fast loading with 30-day cache
- 🔍 **Department Search** - Quickly find your department
- 📥 **PDF Viewer** - View and download files directly
- 🌓 **Dark Mode** - Easy on the eyes
- 📴 **Offline Support** - PWA with service worker
- 🚀 **Fast & Lightweight** - No heavy frameworks
- ♿ **Accessible** - WCAG AA compliant

## 🏗️ Tech Stack

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **API:** Google Drive API v3
- **Storage:** LocalStorage + Service Worker
- **Hosting:** Vercel (Free)
- **Design:** Material Design inspired, Green/Blue color scheme

## 📁 Project Structure

```
curb-resource-bank/
├── index.html              # Main HTML file
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── vercel.json             # Vercel configuration
├── env.example             # Environment variables template
├── css/
│   ├── variables.css       # Color scheme & design tokens
│   └── styles.css          # All styles (responsive)
├── js/
│   ├── config.js           # App configuration
│   ├── cache.js            # Cache management
│   ├── drive-api.js        # Google Drive integration
│   ├── navigation.js       # SPA routing
│   └── app.js              # Main application logic
├── assets/
│   ├── logo-placeholder.svg # Logo (replace with yours)
│   └── icons/              # Department icons
└── docs/
    ├── SETUP_DRIVE_API.md  # Drive API setup guide
    ├── DEPLOYMENT.md       # Deployment instructions
    └── GOOGLE_FORM_SETUP.md # Contact form setup
```

## 🚀 Quick Start

### Prerequisites

- Google account with Drive access
- GitHub account (for deployment)
- Text editor (VS Code recommended)

### Installation

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/yourusername/curb-resource-bank.git
   cd curb-resource-bank
   ```

2. **Organize your Google Drive**
   
   Create folder structure:
   ```
   Root Folder/
   ├── Accounting/
   │   ├── 100 Level/
   │   │   ├── 1st Semester/
   │   │   │   └── 2024/25 Session/
   │   │   │       └── *.pdf files
   │   │   └── 2nd Semester/
   │   └── 200 Level/
   └── Computer Science/
       └── ...
   ```

3. **Set up Google Drive API**
   
   Follow the detailed guide: [docs/SETUP_DRIVE_API.md](docs/SETUP_DRIVE_API.md)

4. **Configure credentials**
   
   Edit `index.html` (line ~150):
   ```javascript
   window.ENV = {
     GOOGLE_DRIVE_API_KEY: 'your_api_key_here',
     GOOGLE_DRIVE_ROOT_FOLDER_ID: 'your_folder_id_here'
   };
   ```

5. **Test locally**
   
   Open `index.html` in a browser (or use a local server):
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Or using Node.js
   npx serve
   ```
   
   Then visit: `http://localhost:8000`

6. **Deploy to Vercel**
   
   Follow the deployment guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 📖 Documentation

- **[Google Drive API Setup](docs/SETUP_DRIVE_API.md)** - Configure Drive API
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Deploy to Vercel
- **[Google Form Setup](docs/GOOGLE_FORM_SETUP.md)** - Add contact form

## 🎨 Customization

### Change Colors

Edit `css/variables.css`:
```css
:root {
  --primary-green: #0F9D58;  /* Your primary color */
  --primary-blue: #1967D2;   /* Your accent color */
}
```

### Replace Logo

1. Create your logo as SVG or PNG (48x48px recommended)
2. Replace `assets/logo-placeholder.svg`
3. Update `index.html` and `manifest.json` references

### Add Departments

Edit `js/config.js`:
```javascript
departments: [
  "Your New Department",
  // ... existing departments
]
```

### Configure Level Exceptions

Edit `js/config.js`:
```javascript
levelExceptions: {
  "New Department": [100, 200], // Only has 2 levels
}
```

## 🔧 Configuration

### Cache Duration

Default: 30 days

Change in `js/config.js`:
```javascript
cache: {
  durationDays: 30  // Change this value
}
```

### API Quota

Free tier: 1,000 requests/day

Monitor usage in [Google Cloud Console](https://console.cloud.google.com)

## 📱 Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (iOS 12+)
- ✅ Samsung Internet
- ✅ Chrome Android

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Usage Tips

### For Administrators

1. **Updating Content:**
   - Upload PDFs to appropriate Google Drive folder
   - Students click "Refresh" to see new files
   - No code changes needed!

2. **Announcements:**
   - Edit `index.html` announcement banner
   - Set `display: none` to hide
   - Or use JavaScript to manage dynamically

3. **Monitoring:**
   - Check Vercel Analytics for usage
   - Monitor Google API quota
   - Review contact form submissions

### For Students

1. Navigate: Department → Level → Semester → Session
2. Click "View" to open PDF in browser
3. Click "Download" to save locally
4. Use search bar to find departments quickly
5. Install as app on mobile for offline access

## 🐛 Troubleshooting

### Files not showing
- Check Google Drive folder permissions
- Verify API key and folder ID
- Check browser console for errors

### Slow loading
- Check internet connection
- Clear browser cache
- Check Google API quota hasn't been exceeded

### Deploy failed
- Check all files are committed to Git
- Verify `vercel.json` is present
- Check Vercel deployment logs

### Contact form not working
- Verify Google Form embed code
- Check iframe `src` URL
- Ensure form is public

## 📊 Analytics

Track usage with:
- **Vercel Analytics** (built-in)
- **Google Analytics** (add to `index.html`)
- **API Usage** (Google Cloud Console)

## 🔒 Security

- ✅ API key restricted to domain
- ✅ Read-only Drive access
- ✅ HTTPS enforced
- ✅ Security headers configured
- ✅ No sensitive data stored client-side

## 📄 License

MIT License - feel free to use for your institution!

## 🙏 Acknowledgments

- Built for Caleb University students
- Inspired by modern web design principles
- Uses Google's Material Design guidelines

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/curb-resource-bank/issues)
- **Email:** curb@example.com
- **Documentation:** Check the `docs/` folder

## 🗺️ Roadmap

- [ ] Add search across all files
- [ ] Implement user authentication
- [ ] Add download statistics
- [ ] Multi-language support
- [ ] Admin dashboard
- [ ] Contribution system

## ⚡ Performance

- **First Load:** < 2s
- **Cached Load:** < 500ms
- **Lighthouse Score:** 95+
- **Bundle Size:** < 100KB

## 🌟 Star History

If you find this useful, please star the repository!

---

**Built with ❤️ for Caleb University Students**

*Last updated: October 2025*

