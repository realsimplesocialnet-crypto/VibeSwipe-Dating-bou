---
name: Installed-app experience
description: The user's expected Android installation and iPhone home-screen launch experience.
---

Android users should visit the VibeSwipe website, install the app to their phone, and open it from its own home-screen icon without the browser address bar. An instruction-only popup is not the requested outcome.

The website and installed app must display the same screens, design, and core features. Do not make a separate, limited website experience or require installation to use the app.

**Why:** The user repeated, “the same way the app display when someone installs it is the same way when people go website because some people can use websites, some people can use the app.”

**How to apply:** Reuse the same welcome, account flow, authenticated pages, and navigation in browser and Home Screen modes. Keep optional install controls separate from access to app content.

Both normal website visits and home-screen launches on iPhone and Android should show Create account and Sign in for signed-out users. Signed-in users must finish their profile form before reaching the main app or its navigation; returning users with saved profiles can continue inside. Do not show installation buttons/cards inside the installed app. Browser users may optionally install, but must be able to create an account and use the website without installing.

**Why:** The user repeated the Android installation requirement, objected to seeing Install again inside the installed app, and clarified that website visitors must have the same account-first entry without seeing the whole app before completing their form.

**How to apply:** Detect the actual standalone window, including Safari's home-screen signal, rather than treating every mobile browser visit as an installed app. Distinguish verified website installability from completed physical-device installation, and do not describe an unpublished change as live.

Use PWA installation, not an APK download, for the website install banner. Show the install option to returning mobile website visitors after refresh as well as new visitors, even when no automatic browser install prompt fires. Keep it available until installation is detected, and do not let old dismissal flags suppress it for returning users.

Browser visitors must be able to close the install banner until the next refresh. Remember confirmed installations, including home-screen launches, so installed users are not repeatedly asked to add it again.

**Why:** The user reported permanent install prompts on installed Android and iPhone apps and explicitly wanted Cancel for website visitors, with the prompt eligible again after refresh.

**How to apply:** Distinguish temporary dismissal from remembered installation. iPhone Safari does not reliably expose a separate Home Screen installation to a normal browser tab; offer an explicit “Already installed” option rather than claiming universal detection.

**Why:** The user clarified “just show PWA install something” and said previous website users could not see the install option.

**How to apply:** Make the banner global across website pages, with a real browser prompt when available and platform-specific manual installation instructions otherwise. Never interpret a missing install prompt as proof that the app is installed.

The user wants the Android app to open “Without chrome”.

**Why:** The installed app displayed Android’s “Myage requires the following app: Chrome” dialog, and the user rejected installing Chrome as the solution.

**How to apply:** Do not insist on Chrome as the only option. Distinguish installing the website through another supporting browser from a standalone native Android APK. Website code cannot remove the host-browser dependency of an existing Chrome-owned install. Never claim an APK is available before one has actually been built.

Users installed the Android app from the website, not from a supplied TWA APK. The user reported that the “requires Chrome” dialog also occurs when Chrome is already installed.

**Why:** The user corrected the missing-Chrome diagnosis and confirmed website installation.

**How to apply:** Treat the message as a host-browser/installed-launcher availability problem, not proof Chrome is absent. Browser-created WebAPK launcher checks run before website JavaScript; manifest changes, service workers, and a website recovery page cannot intercept that native dialog. Do not fabricate TWA package names or signing fingerprints. Explain when affected users must replace the installed launcher, warn about unsent drafts/sign-in, and never clear account or browser data automatically.

The app should show its usable shell and cached screen content promptly on launch; do not hold the whole app on a loading screen while remote data refreshes. Never bypass authentication or show another account's private data to achieve this.

**Why:** The user repeatedly asked for Myage to open steadily without a prolonged or recurring loading screen.

**How to apply:** Render safe shell and same-account cached content first, then verify authentication and refresh data in the background. Use a clear retry only for a real failure, and preserve account and local drafts during recovery.
