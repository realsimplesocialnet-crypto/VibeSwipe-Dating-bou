---
name: Smart discovery locality
description: Default local-first worldwide fallback versus intentionally strict manual location filters.
---

Default discovery must expand beyond the member's home country when fewer than 20 eligible local profiles are available. Rank same country first, same continent second, worldwide last. As local membership grows, foreign profiles should naturally be replaced by local ones without changing the card currently being viewed.

**Why:** The user reported that newcomers in low-population countries saw empty feeds even though members existed elsewhere, and explicitly requested automatic worldwide expansion.

**How to apply:** Keep explicitly chosen country/city, saved discovery-area filters, and Travel Mode strict. Apply all age/gender, block, suspension, deactivation and incognito protections to every expansion tier. Do not solve sparse geography by exposing ineligible or fabricated profiles.

The swipe feed should continue with unseen eligible people first, then recycle skipped profiles when no unseen matches remain. Keep outgoing likes and existing matches out of recycled rounds.

**Why:** The user reported that after liking and skipping profiles the feed said everyone was finished, and asked for continued swiping rather than a permanent end.

**How to apply:** Revisit passes without deleting reaction history or weakening filters/privacy. Fetch a fresh round after swipes finish; a prefetch begun before the final swipe can still contain a now-liked profile. Do not promise infinitely many unique people.
