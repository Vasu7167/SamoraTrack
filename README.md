# SamoraTrack — PWA Auto-Update System

## The problem this solves
Previously: users had to clear cache or reinstall the PWA every time you pushed an update.
Now: users get updates automatically in the background. A small banner appears saying "New version available — Update now". One tap. Done.

## Files in this folder

```
sw.js              ← Service worker (handles caching + auto-update)
manifest.json      ← PWA manifest (icons, name, theme, shortcuts)
ADD-TO-INDEX.html  ← HTML snippets to paste into your index.html
icons/
  icon-48.png
  icon-72.png
  icon-96.png
  icon-144.png
  icon-192.png     ← Used for Android homescreen icon
  icon-512.png     ← Used for Play Store / splash screen
  screenshot-mobile.png
```

## Setup (one time)

1. Add `sw.js`, `manifest.json` and the `icons/` folder to the ROOT of your samoratrack repo
2. Open your `index.html`
3. Copy the STEP 1 snippet from `ADD-TO-INDEX.html` → paste inside your `<head>` tag
4. Copy the STEP 2 snippet from `ADD-TO-INDEX.html` → paste just before `</body>`
5. Push to GitHub → Vercel deploys → done

## Every future update (the only thing you need to do)

Open `sw.js` and change the version number on line 4:

```js
const VERSION = 'v1.0.0';  // change to v1.0.1, v1.0.2, etc.
```

That's it. Push to GitHub. Within minutes, every user who opens the app will see a "New version available" banner. One tap to update. No reinstalling. No cache clearing. No support tickets.

## How it works

- `sw.js` intercepts all network requests
- HTML document always fetches from network first (so index.html is always fresh)
- Supabase and Anthropic API calls always go direct to network (never cached)
- Icons and fonts are cached for performance
- When a new SW version is detected, it deletes ALL old caches and notifies open tabs
- The banner appears — user taps "Update now" → page reloads with new version

## Icon replacement

The icons in this folder are auto-generated placeholders with an "S" symbol.
Replace them with your actual branded icons before submitting to stores.
Keep the exact same filenames and sizes.

Recommended tool: figma.com or realfavicongenerator.net
