---
name: Startup cache and Clerk identity
description: Safe client-side profile caching while keeping Clerk as the authentication source of truth.
---

Startup may use a short-lived, account-scoped copy of the signed-in member's own profile to render immediately while the API refreshes it.

**Why:** The user chose to keep Clerk. Fast startup must not expose one account's cached profile to another account or weaken Clerk's session handling.

**How to apply:** Read the profile cache only after Clerk supplies the active user ID. Clear it when the account changes, and never put Clerk tokens, credentials, or private conversations in browser storage.
