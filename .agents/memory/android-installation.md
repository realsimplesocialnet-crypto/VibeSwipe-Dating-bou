---
name: Installed-app experience
description: Public installer-page behavior and Android WebView app detection.
---

In ordinary browsers, `myage.beauty` shows the Myage logo, one short tagline, and one pink platform-specific action. Android visitors download the APK; iPhone visitors get Safari/Add to Home Screen instructions and an `/app` link. Do not expose legacy app routes from ordinary browser URLs.

Inside the Android app's WebView, bypass the installer landing page and load the full VibeSwipe app from the same URL. Hide all install controls in that WebView. Detect it when the user agent contains `wv` or `window.Android` exists. The dedicated `/app` route is the iPhone PWA entry; standalone PWAs should also open the full app.

**Why:** The user specified one URL with two behaviors: normal browsers get the APK download page, while the APK opens the real app without asking users to install again.

**How to apply:** Keep the root installer and `/app` PWA entry separate, while allowing Android WebViews to open the app at the root URL. Keep the full app entry available for standalone launches and hide install controls in app shells.

The user wants the Android app to open “Without chrome”.

**Why:** The installed app displayed Android’s “Myage requires the following app: Chrome” dialog, and the user rejected installing Chrome as the solution.

**How to apply:** Do not insist on Chrome as the only option. Distinguish installing the website through another supporting browser from a standalone native Android APK. Website code cannot remove the host-browser dependency of an existing Chrome-owned install. Never claim an APK is available before one has actually been built.

Users installed the Android app from the website, not from a supplied TWA APK. The user reported that the “requires Chrome” dialog also occurs when Chrome is already installed.

**Why:** The user corrected the missing-Chrome diagnosis and confirmed website installation.

**How to apply:** Treat the message as a host-browser/installed-launcher availability problem, not proof Chrome is absent. Browser-created WebAPK launcher checks run before website JavaScript; manifest changes, service workers, and a website recovery page cannot intercept that native dialog. Do not fabricate TWA package names or signing fingerprints. Explain when affected users must replace the installed launcher, warn about unsent drafts/sign-in, and never clear account or browser data automatically.

The app should show its usable shell and cached screen content promptly on launch; do not hold the whole app on a loading screen while remote data refreshes. Never bypass authentication or show another account's private data to achieve this.

**Why:** The user repeatedly asked for Myage to open steadily without a prolonged or recurring loading screen.

**How to apply:** Render safe shell and same-account cached content first, then verify authentication and refresh data in the background. Use a clear retry only for a real failure, and preserve account and local drafts during recovery.

When a UI change affects precached JavaScript or CSS, bump the shell cache version so installed PWAs activate a cache containing the updated app entry assets. Keep the separate offline Reel and profile caches intact.

**Why:** The source showed the corrected profile Reel tiles, but an installed browser still displayed the old interaction strip because its active shell cache had not changed.

**How to apply:** For releases that update precached app assets, increment the shell cache name and verify the new worker is served; do not clear user data or offline media to force a UI refresh.

Avoid remote font requests on the web app's startup path; use device system fonts or bundle fonts locally.

**Why:** The user repeatedly asked for the app to open without unnecessary loading and errors.

**How to apply:** Do not add runtime Google Fonts imports or other third-party font fetches to the initial page.
