---
name: Clerk Protect in automated tests
description: Clerk Development sign-up may require an interactive human check that blocks automated browser account creation.
---

Clerk Development sign-up can remain incomplete when an automated browser is required to pass a Protect check. In that state, email verification may not be sent.

**Why:** Bot protection is a security control, not a flaky form step.

**How to apply:** Use a human-interactive browser for a real signup test. Do not disable or bypass Protect just to automate signup; if an interactive session is unavailable, report the blocker and continue with independent UI and API checks.
