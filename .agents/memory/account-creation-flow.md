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

At the start of profile setup, let the user choose their country without requesting device location permission. Lock the selected country for the rest of signup. Collect no state or city during signup; those can be added later in Profile. Save the country as manually selected; do not collect coordinates.

**Why:** The user reported that location permission was preventing people from completing signup and asked to remove the location prompt.

**How to apply:** Country selection is self-reported, not proof of a person's origin or residence. Face verification only compares a live selfie with the selected profile photo and must not be presented as country or legal-identity verification. Require a profile picture; it appears on the profile and Discover cards. Keep the web and installed-app signup aligned. If authentication policy prevents code-only signup, report the blocker honestly rather than adding hidden passwords or pretending signup completed.

Ask for email and verify its code at the end rather than starting with email/password signup.

**Why:** The user explicitly said the website, installed app, and Home Screen app must show “the same thing,” and that users “must put a picture” because it appears on their profile.

**How to apply:** Maintain one shared web/PWA signup implementation, not platform-specific forms. If authentication policy prevents code-only signup, report the blocker honestly rather than adding hidden passwords or pretending signup completed.

After authentication, keep a direct “Log in instead” action available throughout profile setup. Back must remain usable during photo upload or draft autosave; it moves to the prior setup step, while the login action safely signs out and opens the sign-in screen without clearing the saved draft.

**Why:** The user reported that someone was trapped on the required photo step and could not return to sign in with an account they had already created on another phone.

**How to apply:** Keep these exits available in web/PWA and native onboarding. Android hardware Back returns one setup step, and at the first step it opens sign-in. Never make photo upload or routine draft saving block leaving setup.
