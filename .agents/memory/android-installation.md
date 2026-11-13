---
name: Installed-app experience
description: The user's expected Android installation and iPhone home-screen launch experience.
---

Android users should visit the VibeSwipe website, install the app to their phone, and open it from its own home-screen icon without the browser address bar. An instruction-only popup is not the requested outcome.

Home-screen launches on iPhone and Android should show Create account and Sign in for signed-out users, or continue inside the app for signed-in users. Do not show the marketing landing page or installation buttons/cards inside the installed app. Normal browser visits should retain the public website and installation options.

**Why:** The user repeated the Android installation requirement and explicitly objected to seeing Install again after opening the iPhone home-screen app.

**How to apply:** Detect the actual standalone window, including Safari's home-screen signal, rather than treating every mobile browser visit as an installed app. Distinguish verified website installability from completed physical-device installation, and do not describe an unpublished change as live.
