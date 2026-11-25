---
name: Codemagic and managed Clerk
description: Compatibility limits when building standalone Android APKs outside Replit with Replit-managed Clerk.
---

Replit-managed Clerk production keys are injected by Replit's publishing flow and are not available to external build services such as Codemagic. A Codemagic APK using a development Clerk key can verify a development account but will receive 401 responses from the production API.

**Why:** Production investigation observed authenticated profile, onboarding, and settings requests returning 401 from the release APK. Replit's official documentation confirms production Clerk keys are managed during Replit publishing and cannot be manually substituted for external builds.

**How to apply:** Before shipping a standalone APK through Codemagic, decide whether to use Replit's supported managed-auth flow or migrate both the mobile app and API to an app-owned auth provider. Never point a development Clerk key at the production API.
