---
name: Account creation
description: The user's requirements for one shared signup flow across the website and home-screen installations.
---

Use the same account-creation experience for website visitors, Android-installed app users, and iPhone Home Screen users.

Ask profile questions first, step by step: names, where the person is from using real countries and dependent states/cities, gender, who they are looking for, and the other profile details. Require a profile picture; that picture is what shows on the profile and Discover cards. Ask for email and verify its code at the end rather than starting with email/password signup.

**Why:** The user explicitly said the website, installed app, and Home Screen app must show “the same thing,” and that users “must put a picture” because it appears on their profile.

**How to apply:** Maintain one shared web/PWA signup implementation, not platform-specific forms. If authentication policy prevents code-only signup, report the blocker honestly rather than adding hidden passwords or pretending signup completed.
