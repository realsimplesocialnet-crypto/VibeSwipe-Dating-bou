---
name: Temporary location sharing
description: Safety constraints for VibeSwipe live location links.
---

VibeSwipe location links expire after one hour, can be stopped immediately, and update only while the user keeps the Safety Center open in the foreground. The public link exposes coordinates and timestamps only. The raw token is returned only at creation and is stored as a SHA-256 hash.

**Why:** The user requested a simple Safety Center; these limits reduce exposure from sensitive location sharing while still supporting live meetup coordination.

**How to apply:** Preserve explicit location permission, the one-hour expiry, immediate revocation, the minimal public payload, and foreground-only updates unless the user changes these product rules.
