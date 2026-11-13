---
name: Production query context
description: Why shared query hooks must be checked in production builds, not only development.
---

App-level data providers and generated workspace hooks must share one runtime context. Validate this with a production-bundled hook, not only a development-server sign-in check.

**Why:** The public page and development checks passed while the production bundle included separate React Query copies associated with different React peer versions. Opening signed-in screens then threw “No QueryClient set” before any profile request could be sent. An isolated production probe reproduced the crash and passed after resolving a single shared provider.

**How to apply:** Preserve the singleton boundary when changing workspace dependencies or bundling. Production regression checks can use a disabled generated profile query, without creating accounts or accessing profile data. Only deduplicate packages resolvable from the consuming app: forcing a transitive-only package to resolve from that root can break the build.
