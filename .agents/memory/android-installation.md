---
name: Installed-app experience
description: Public installer-page behavior and Android WebView app detection.
---

The owner creates Android APKs with FreeWebToApk. Treat the APK as a WebView wrapper that loads the live website at `myage.beauty`; website changes are how updates reach that installed wrapper.

**Why:** The owner clarified that Replit Agent's job is only the website, not creating or maintaining the APK.

**How to apply:** Never use Expo, build a native app, or create or replace an APK. The public root opens the VIBESWIPES welcome screen with Create Account and Login actions. Regular mobile browsers may show the Install App banner; Android WebViews and standalone PWAs must hide it. Public legal documents may remain on their own direct URLs.

If the owner later asks to expose an APK download, serve the exact uploaded bytes and verify its size and hash; use the Android APK content type and `VIBESWIPES.apk` filename. Never mistake an `.apk.html` page for an installer.

The app should show its usable shell and cached screen content promptly on launch; do not hold the whole app on a loading screen while remote data refreshes. Never bypass authentication or show another account's private data to achieve this.

**Why:** The user repeatedly asked for Myage to open steadily without a prolonged or recurring loading screen.

**How to apply:** Render safe shell and same-account cached content first, then verify authentication and refresh data in the background. Use a clear retry only for a real failure, and preserve account and local drafts during recovery.

When a UI change affects precached JavaScript or CSS, bump the shell cache version so installed PWAs activate a cache containing the updated app entry assets. Keep the separate offline Reel and profile caches intact.

**Why:** The source showed the corrected profile Reel tiles, but an installed browser still displayed the old interaction strip because its active shell cache had not changed.

**How to apply:** For releases that update precached app assets, increment the shell cache name and verify the new worker is served; do not clear user data or offline media to force a UI refresh.

Avoid remote font requests on the web app's startup path; use device system fonts or bundle fonts locally.

**Why:** The user repeatedly asked for the app to open without unnecessary loading and errors.

**How to apply:** Do not add runtime Google Fonts imports or other third-party font fetches to the initial page.
