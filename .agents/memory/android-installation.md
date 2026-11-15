---
name: Installed-app experience
description: The user's expected Android installation and iPhone home-screen launch experience.
---

Android users should visit the VibeSwipe website, install the app to their phone, and open it from its own home-screen icon without the browser address bar. An instruction-only popup is not the requested outcome.

Both normal website visits and home-screen launches on iPhone and Android should show Create account and Sign in for signed-out users. Signed-in users must finish their profile form before reaching the main app or its navigation; returning users with saved profiles can continue inside. Do not show installation buttons/cards inside the installed app. Browser users may optionally install, but must be able to create an account and use the website without installing.

**Why:** The user repeated the Android installation requirement, objected to seeing Install again inside the installed app, and clarified that website visitors must have the same account-first entry without seeing the whole app before completing their form.

**How to apply:** Detect the actual standalone window, including Safari's home-screen signal, rather than treating every mobile browser visit as an installed app. Distinguish verified website installability from completed physical-device installation, and do not describe an unpublished change as live.

Use PWA installation, not an APK download, for the website install banner. Show the install option to returning mobile website visitors after refresh as well as new visitors, even when no automatic browser install prompt fires. Keep it available until installation is detected, and do not let old dismissal flags suppress it for returning users.

**Why:** The user clarified “just show PWA install something” and said previous website users could not see the install option.

**How to apply:** Make the banner global across website pages, with a real browser prompt when available and platform-specific manual installation instructions otherwise. Never interpret a missing install prompt as proof that the app is installed.

The user wants the Android app to open “Without chrome”.

**Why:** The installed app displayed Android’s “Myage requires the following app: Chrome” dialog, and the user rejected installing Chrome as the solution.

**How to apply:** Do not insist on Chrome as the only option. Distinguish installing the website through another supporting browser from a standalone native Android APK. Website code cannot remove the host-browser dependency of an existing Chrome-owned install. Never claim an APK is available before one has actually been built.
