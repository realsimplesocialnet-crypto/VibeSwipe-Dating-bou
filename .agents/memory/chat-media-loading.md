---
name: Chat media data consent
description: Keep full photo and video downloads behind the user's explicit Load action.
---

Photo and video messages must open a preview-only viewer first. Fetch the original only after the user taps **Load**. Closing the viewer must not fetch it.

**Why:** The user explicitly asked to save mobile data, including avoiding automatic original downloads while displaying chat bubbles.

**How to apply:** Keep preview and original references separate. Small real thumbnails may load automatically so recipients can decide whether to load the original. Prefer privately authorized server-generated thumbnails for older attachments too; show an unavailable/retry tile only when a real preview cannot be obtained. Never use the original as an automatic fallback or download it client-side just to generate a thumbnail. Preserve the same consent gate on web/PWA and native.

**Why thumbnails matter:** The user supplied chat screenshots and explained that a generic photo tile forces recipients to download an unknown picture before deciding whether they want to see it.
