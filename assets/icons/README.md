# Department Icons

This directory is reserved for custom department icons if you want to replace the emoji icons with custom graphics.

## Current Implementation

The app currently uses emoji icons defined in `js/app.js` (getDepartmentIcon method):

```javascript
'Accounting': '📊',
'Computer Science': '💻',
'Law': '⚖️',
// etc...
```

## Adding Custom Icons (Optional)

If you want to use custom SVG or PNG icons instead:

### 1. Create icons

- **Format:** SVG (recommended) or PNG
- **Size:** 48x48px
- **Naming:** `department-name.svg` (e.g., `accounting.svg`, `computer-science.svg`)
- **Style:** Match the overall design (green/blue theme)

### 2. Place icons here

```
assets/icons/
├── accounting.svg
├── architecture.svg
├── computer-science.svg
└── ...
```

### 3. Update app.js

Modify the `getDepartmentIcon` method in `js/app.js`:

```javascript
getDepartmentIcon(dept) {
  // Convert department name to filename
  const filename = dept.toLowerCase().replace(/ /g, '-');
  return `<img src="assets/icons/${filename}.svg" alt="${dept}" width="32" height="32">`;
}
```

### 4. Update CSS

You may need to adjust styles in `css/styles.css`:

```css
.department-icon img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}
```

## Icon Design Guidelines

### Style
- Simple, recognizable symbols
- Consistent stroke width
- Clear at small sizes
- Work in both light and dark themes

### Colors
- Use green (#0F9D58) as primary
- Use blue (#1967D2) as accent
- Ensure good contrast

### Examples
- Accounting: Calculator or ledger book
- Computer Science: Monitor or code brackets
- Law: Scales of justice or gavel
- Medicine: Stethoscope or medical cross

## Icon Resources

Free icon sources:
- [Heroicons](https://heroicons.com) - MIT licensed
- [Iconoir](https://iconoir.com) - MIT licensed
- [Feather Icons](https://feathericons.com) - MIT licensed
- [Font Awesome](https://fontawesome.com) - Free tier available
- [Material Icons](https://fonts.google.com/icons) - Apache 2.0

## Note

The emoji icons work great for most use cases! Only add custom icons if:
- You want a more professional/branded look
- Emojis render inconsistently across devices
- You have specific design requirements

**Current emoji implementation is perfectly acceptable for launch.**

