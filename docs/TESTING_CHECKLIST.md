# Testing Checklist

Use this checklist to verify CURB is working correctly.

## Pre-Deployment Testing

### ✅ Google Drive API Integration

- [ ] API key configured in `index.html`
- [ ] Root folder ID configured
- [ ] Folder structure matches expected format
- [ ] All folders shared publicly
- [ ] PDF files are accessible
- [ ] API responds with folder list
- [ ] Files metadata is retrieved correctly

**Test:**
1. Open browser Developer Tools (F12) → Console
2. Load the site
3. Check for API-related errors
4. Verify departments appear

---

### ✅ Navigation System

- [ ] Landing page displays all departments
- [ ] Clicking department shows levels
- [ ] Clicking level shows semesters
- [ ] Clicking semester shows sessions
- [ ] Clicking session shows files
- [ ] Back button works at each level
- [ ] Breadcrumbs show correct path
- [ ] Browser back/forward buttons work
- [ ] Deep links work (share a URL, open in new tab)
- [ ] Home link returns to departments

**Test:**
1. Navigate: Home → Department → Level → Semester → Session
2. Click back button at each level
3. Use browser back button
4. Copy URL at session level, open in new tab
5. Click breadcrumb items

---

### ✅ File Display & Access

- [ ] PDF files are listed correctly
- [ ] File names display properly
- [ ] File sizes show (if available)
- [ ] Modified dates show
- [ ] "View" button opens PDF in new tab
- [ ] "Download" button downloads file
- [ ] PDFs open correctly in browser
- [ ] Empty states show when no files exist

**Test:**
1. Navigate to a session with files
2. Click "View" on a PDF
3. Click "Download" on a PDF
4. Navigate to empty session (if any)

---

### ✅ Caching System

- [ ] Data caches on first load
- [ ] Subsequent loads are faster
- [ ] Cache status displays correctly
- [ ] Refresh button clears and reloads cache
- [ ] Cache expires after 30 days (check localStorage)
- [ ] Works offline after first load
- [ ] Invalid cache is cleared automatically

**Test:**
1. Load site (first time)
2. Close and reopen (should be faster)
3. Open Developer Tools → Application → Local Storage
4. Verify `curb_data` exists
5. Click Refresh button
6. Verify cache updates

---

### ✅ Search Functionality

- [ ] Search bar appears on home page
- [ ] Typing filters departments in real-time
- [ ] Case-insensitive search works
- [ ] Partial matches work (e.g., "comp" finds "Computer Science")
- [ ] Empty search shows all departments
- [ ] No results message (if applicable)

**Test:**
1. Go to home page
2. Type "computer" in search
3. Verify only Computer Science shows
4. Clear search
5. Type "law"
6. Clear search completely

---

### ✅ Responsive Design (Mobile)

#### Mobile (< 768px)
- [ ] Layout adapts to small screen
- [ ] Single column grid
- [ ] Touch targets are large enough (48px minimum)
- [ ] Text is readable without zooming
- [ ] No horizontal scrolling
- [ ] Header fits on screen
- [ ] Buttons are easily tappable
- [ ] Modals work on mobile

**Test:**
1. Open Developer Tools (F12)
2. Toggle device toolbar
3. Select iPhone/Android
4. Navigate through all views
5. Test all interactions

#### Tablet (768px - 1024px)
- [ ] 2-column grid for departments
- [ ] Layout uses available space well
- [ ] Both portrait and landscape work

**Test:**
1. Use device toolbar
2. Select iPad
3. Test portrait and landscape

#### Desktop (> 1024px)
- [ ] 3-4 column grid
- [ ] Maximum width constrained (1200px)
- [ ] Centered layout
- [ ] All elements properly spaced

**Test:**
1. Full-screen browser on desktop
2. Resize window
3. Check layouts at different widths

---

### ✅ Progressive Web App (PWA)

- [ ] Manifest.json loads correctly
- [ ] Service worker registers
- [ ] Install prompt appears (on supported browsers)
- [ ] Can be installed to home screen
- [ ] Works offline after first visit
- [ ] Icon displays correctly
- [ ] Splash screen shows (mobile)
- [ ] Standalone mode works (no browser UI)

**Test:**
1. Open in Chrome/Edge
2. Look for install icon in address bar
3. Install the app
4. Open from home screen
5. Turn off internet, verify works offline
6. Check Application tab in DevTools

---

### ✅ Browser Compatibility

Test on:
- [ ] Chrome (Windows/Mac/Android)
- [ ] Firefox (Windows/Mac)
- [ ] Safari (Mac/iOS)
- [ ] Edge (Windows)
- [ ] Samsung Internet (Android)

**For each browser:**
- [ ] Site loads correctly
- [ ] All features work
- [ ] No console errors
- [ ] Styles render properly
- [ ] PWA features work (where supported)

---

### ✅ Performance

- [ ] First load < 3 seconds
- [ ] Cached load < 1 second
- [ ] Images load quickly
- [ ] No layout shifts
- [ ] Smooth scrolling
- [ ] Animations are smooth (60fps)
- [ ] No memory leaks (check DevTools Memory tab)

**Test:**
1. Open DevTools → Network
2. Load site (check load time)
3. Reload page
4. Check Performance tab
5. Run Lighthouse audit

---

### ✅ Accessibility

- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Focus indicators visible
- [ ] ARIA labels present
- [ ] Screen reader friendly
- [ ] Color contrast meets WCAG AA
- [ ] Text is resizable
- [ ] No keyboard traps
- [ ] Alt text on images

**Test:**
1. Navigate using only keyboard
2. Use browser's accessibility inspector
3. Run Lighthouse accessibility audit
4. Test with screen reader (optional)

---

### ✅ Error Handling

- [ ] Invalid route shows 404 page
- [ ] API error shows friendly message
- [ ] Network offline shows cached data
- [ ] Empty folders show empty state
- [ ] Broken file links handled gracefully
- [ ] Console errors are handled

**Test:**
1. Type invalid URL hash
2. Disconnect internet, try to refresh
3. Simulate API error (block googleapis.com)
4. Check console for unhandled errors

---

### ✅ Contact System

- [ ] Contact button opens modal
- [ ] Modal displays correctly
- [ ] Close button works
- [ ] Click outside modal closes it
- [ ] Google Form loads (if configured)
- [ ] Alternative contact info shown
- [ ] Links work (email, WhatsApp)

**Test:**
1. Click "Contact Us"
2. Test form (if embedded)
3. Click close button
4. Click outside modal
5. Click email/WhatsApp links

---

### ✅ Announcements

- [ ] Announcement banner displays
- [ ] Message is visible
- [ ] Close button works
- [ ] Stays dismissed (localStorage)
- [ ] Different types styled correctly (info, warning, success)

**Test:**
1. Uncomment announcement in `index.html`
2. Reload page
3. Dismiss announcement
4. Reload page (should stay dismissed)

---

## Post-Deployment Testing

### ✅ Production Environment

- [ ] Site loads at production URL
- [ ] HTTPS works (secure)
- [ ] Custom domain works (if configured)
- [ ] API key restrictions work
- [ ] Service worker registers in production
- [ ] PWA installation works
- [ ] Analytics tracking (if configured)
- [ ] No console errors in production

**Test:**
1. Visit production URL
2. Check HTTPS in address bar
3. Install PWA from production
4. Check all features work in production

---

### ✅ Google Cloud Console

- [ ] API key is restricted to domain
- [ ] Quota is not exceeded
- [ ] Usage is being tracked
- [ ] No unusual activity

**Test:**
1. Go to Google Cloud Console
2. Check APIs & Services → Dashboard
3. View Google Drive API quotas
4. Monitor over first few days

---

### ✅ Real-World Usage

- [ ] Students can find their departments
- [ ] Navigation is intuitive
- [ ] Files download successfully
- [ ] Site works on campus WiFi
- [ ] Mobile experience is smooth
- [ ] No major bugs reported

**Test:**
1. Share with small group first
2. Gather feedback
3. Fix any issues
4. Roll out to all students

---

## Performance Benchmarks

Target metrics:
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3.0s
- **Lighthouse Performance:** > 90
- **Lighthouse Accessibility:** > 95
- **Lighthouse Best Practices:** > 90
- **Lighthouse SEO:** > 90

**Run Lighthouse:**
1. Open DevTools → Lighthouse
2. Select categories: Performance, Accessibility, Best Practices, SEO
3. Click "Analyze page load"
4. Address any issues

---

## Security Checklist

- [ ] API key is restricted to domain
- [ ] No sensitive data in console
- [ ] No API keys in GitHub
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] No XSS vulnerabilities
- [ ] No CSRF vulnerabilities
- [ ] Content Security Policy in place

---

## Final Verification

Before announcing to students:

- [ ] All critical features work
- [ ] Tested on multiple devices
- [ ] Tested on multiple browsers
- [ ] Performance is acceptable
- [ ] No major bugs
- [ ] Documentation is complete
- [ ] Contact system works
- [ ] Content is up to date

---

## Continuous Monitoring

After launch:

- [ ] Check Vercel analytics weekly
- [ ] Monitor Google API quota
- [ ] Review contact form submissions
- [ ] Track any reported issues
- [ ] Update content regularly
- [ ] Respond to student feedback

---

## Issue Reporting Template

If you find a bug, report it with:

```
**Description:** Brief description of the issue

**Steps to Reproduce:**
1. Go to...
2. Click on...
3. See error

**Expected Behavior:** What should happen

**Actual Behavior:** What actually happens

**Environment:**
- Browser: Chrome 120
- Device: iPhone 14
- OS: iOS 17
- URL: https://curb.example.com

**Screenshots:** [if applicable]

**Console Errors:** [from Developer Tools]
```

---

**Testing completed? Mark all checkboxes and deploy with confidence! 🚀**

