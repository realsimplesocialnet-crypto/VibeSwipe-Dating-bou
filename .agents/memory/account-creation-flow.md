---
name: Account creation
description: The user's requirements for one shared signup flow across the website and home-screen installations.
---

Use the same account-creation experience for website visitors, Android-installed app users, and iPhone Home Screen users.

Installation is optional. People who do not install VibeSwipe must still be able to create an account and use it directly on the website.

Offer email sign-in and email account creation only; do not show Google/social sign-in options.

**Why:** When asked which sign-in options should remain, the user selected “Email only.”

**How to apply:** Preserve email authentication and account creation on web and mobile. Keep public authentication branding below the device's status bar, not fixed over the clock or notch.

Apply iPhone safe-area spacing throughout profile setup, not only to the login page, and avoid opening the keyboard automatically on a new setup step.

**Why:** The user showed the first of thirteen setup steps overlapping the iPhone clock and asked for the whole account-creation experience to stay properly arranged.

**How to apply:** Give the shared setup wrapper top and bottom safe areas, allow long steps to scroll, and keep input text large enough to avoid Safari focus zoom.

Show Create account or Sign in first on both website and installed launches. Keep the main app and bottom navigation inaccessible until authentication and profile setup are complete, including on direct links.

Ask profile questions first, step by step: names, where the person is from using real countries and dependent states/cities, gender, who they are looking for, and the other profile details. Require a profile picture; that picture is what shows on the profile and Discover cards. Ask for email and verify its code at the end rather than starting with email/password signup.

**Why:** The user explicitly said the website, installed app, and Home Screen app must show “the same thing,” and that users “must put a picture” because it appears on their profile.

**How to apply:** Maintain one shared web/PWA signup implementation, not platform-specific forms. If authentication policy prevents code-only signup, report the blocker honestly rather than adding hidden passwords or pretending signup completed.
