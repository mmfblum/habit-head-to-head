

# Make Zrizin an Installable Web App (PWA)

This will let users on iPhone and Android add Zrizin to their home screen so it looks and feels like a native app -- full-screen, with an app icon, splash screen, and offline fallback.

## What you'll get

- An "Add to Home Screen" prompt on Android (automatic) and iPhone (via Share > Add to Home Screen)
- Full-screen app experience with no browser address bar
- A custom app icon and splash screen
- Basic offline support (shows a friendly message if there's no internet)

## What needs to be created

### 1. Web App Manifest (`public/manifest.json`)
A JSON file that tells the browser about your app -- its name, icon, theme color, and how it should launch. This is the core of any PWA.

### 2. App Icons
Multiple sizes of the Zrizin icon for different devices:
- 192x192 and 512x512 PNG icons (required minimums)
- We'll generate simple placeholder icons using SVG for now. You can replace them with your real logo later.

### 3. Service Worker (`public/sw.js`)
A small script that runs in the background enabling:
- Caching of core app files for faster loads
- A basic offline fallback page

### 4. Register the Service Worker (`src/main.tsx`)
A few lines of code to activate the service worker when the app loads.

### 5. Update `index.html`
Add references to the manifest, theme color, and Apple-specific meta tags for iPhone support.

## Technical Details

### Files to create:
- `public/manifest.json` -- PWA manifest with app name "Zrizin", dark theme color (#0a0f1a), standalone display mode
- `public/sw.js` -- Service worker with cache-first strategy for static assets and network-first for API calls
- `public/icon-192.svg` and `public/icon-512.svg` -- Placeholder app icons

### Files to modify:
- `index.html` -- Add `<link rel="manifest">`, Apple meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`), and theme-color meta tag
- `src/main.tsx` -- Register the service worker on app startup

### No backend changes needed.

