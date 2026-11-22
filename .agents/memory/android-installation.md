---
name: Installed-app experience
description: Public installer-page behavior and Android WebView app detection.
---

The owner previously created Android APKs with FreeWebToApk, loading the live website at `myage.beauty`. That explains existing wrapper behavior, but is not the current native product direction.

**Why:** The owner has since explicitly requested a real native Android app and clarified that the social conversion must not be a web app.

**How to apply:** Use the existing native Expo project for the requested Android social app; see social-product-direction.md. Do not add install prompts or APK download links to the website; the owner subsequently asked to remove them. Native source work and producing a signed installer are separate deliverables.

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
