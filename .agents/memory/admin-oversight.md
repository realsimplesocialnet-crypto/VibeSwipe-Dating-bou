---
name: Admin oversight
description: Owner's web-console scope and privacy/reliability boundaries for administrator inspection.
---

The owner wants one web admin overview showing members, online presence, accounts, conversations, posts and activity together, with access to their detailed sections.

**Why:** The user asked to sit at the web dashboard and see what is happening across the app at once, rather than switching through disconnected screens.

**How to apply:** Use real stored data and refresh timestamps. Keep bounded recent summaries on the overview and searchable, paginated detailed lists. Do not imply that device activity, other apps, passwords or unsent messages are available.

Keep the general overview and conversation list free of private message text. Private conversation inspection must be an explicit authorized-admin action, and private reads, attachments and exports must be audited.

**Why:** The owner requested chat oversight, but stored private conversations need stronger handling than public profile/post summaries.

**How to apply:** Preserve server-enforced administrator identity checks, no-store responses, the explicit inspection step and access recording. Do not add public admin registration or loosen authorization for testing.

Missing authentication accounts must not make all stored profiles impossible to review.

**Why:** Older stored profiles can outlive their sign-in identities; treating one missing identity as a failed entire overview prevented the owner from seeing otherwise valid stored records.

**How to apply:** Show stored profile details with unavailable contact information only for a confirmed missing identity. Provider outages and rate limits must remain explicit failures, not become invented or silently missing accounts.

Do not assume an aggregate timestamp has the same runtime type as an ordinary mapped timestamp column.

**Why:** In this environment, PostgreSQL's aggregate latest-message time arrived as a string even though its TypeScript annotation claimed it was a Date. Empty-conversation checks missed the resulting crash.

**How to apply:** Normalize aggregate dates at the response boundary and verify at least one conversation containing a real stored test message, not only empty-chat states.
