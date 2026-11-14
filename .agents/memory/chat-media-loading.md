---
name: Chat media data consent
description: Keep full photo and video downloads behind the user's explicit Load action.
---

Photo and video messages must open a preview-only viewer first. Fetch the original only after the user taps **Load**. Closing the viewer must not fetch it.

**Why:** The user explicitly asked to save mobile data, including avoiding automatic original downloads while displaying chat bubbles.

**How to apply:** Keep preview and original references separate. Where an older message has no separate thumbnail, use a lightweight local preview tile rather than the original as a fallback. Do not generate a client-side thumbnail by first downloading the original. Preserve the same consent gate on web/PWA and native.
