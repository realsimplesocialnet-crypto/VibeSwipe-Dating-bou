---
name: Installed-app experience
description: The user's expected Android installation and iPhone home-screen launch experience.
---

Android users should visit the VibeSwipe website, install the app to their phone, and open it from its own home-screen icon without the browser address bar. An instruction-only popup is not the requested outcome.

Both normal website visits and home-screen launches on iPhone and Android should show Create account and Sign in for signed-out users. Signed-in users must finish their profile form before reaching the main app or its navigation; returning users with saved profiles can continue inside. Do not show installation buttons/cards inside the installed app. Browser users may optionally install, but must be able to create an account and use the website without installing.

**Why:** The user repeated the Android installation requirement, objected to seeing Install again inside the installed app, and clarified that website visitors must have the same account-first entry without seeing the whole app before completing their form.

**How to apply:** Detect the actual standalone window, including Safari's home-screen signal, rather than treating every mobile browser visit as an installed app. Distinguish verified website installability from completed physical-device installation, and do not describe an unpublished change as live.
