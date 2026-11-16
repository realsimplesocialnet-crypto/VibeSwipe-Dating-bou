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

The admin console is for the website only; do not add it to the installed mobile app or present it inside the installed web app.

**Why:** The user explicitly asked for admin access to stay on the website after Android opened the `/admin` link inside the installed app.

**How to apply:** Keep native app navigation free of admin screens, and route admin visits from the installed web app to a browser-only website origin while preserving server-side authorization.

Blocking a member bans their account access until an administrator unblocks them; removing verification is a separate administrator action.

**Why:** The user clarified that they want to independently ban/unban members and remove a member’s verification, and approved keeping those controls separate.

**How to apply:** Keep `block`/`unblock` independent from `unverify`; do not remove a verified badge automatically when a member is banned.

Missing authentication accounts must not make all stored profiles impossible to review.

**Why:** Older stored profiles can outlive their sign-in identities; treating one missing identity as a failed entire overview prevented the owner from seeing otherwise valid stored records.

**How to apply:** Show stored profile details with unavailable contact information only for a confirmed missing identity. Provider outages and rate limits must remain explicit failures, not become invented or silently missing accounts.

Do not assume an aggregate timestamp has the same runtime type as an ordinary mapped timestamp column.

**Why:** In this environment, PostgreSQL's aggregate latest-message time arrived as a string even though its TypeScript annotation claimed it was a Date. Empty-conversation checks missed the resulting crash.

**How to apply:** Normalize aggregate dates at the response boundary and verify at least one conversation containing a real stored test message, not only empty-chat states.
