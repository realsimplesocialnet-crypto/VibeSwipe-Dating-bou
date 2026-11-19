---
name: Mobile chat keyboard layout
description: Why the chat composer must follow the visible viewport on iPhone.
---

Anchor the web/PWA chat to the visible viewport, including its vertical offset, rather than relying on document height alone. Avoid scrolling the outer page to reveal a message, and do not retain the home-indicator bottom inset above an open keyboard.

**Why:** The user supplied an iPhone photo showing the composer far above the keyboard despite an existing viewport-height adjustment. Safari can pan the visible viewport when an input receives focus; a height-only, normal-flow layout does not account for that movement.

**How to apply:** Preserve viewport-offset tracking and conversation-only scrolling when changing chat layout. Keep mobile text fields at least 16px to avoid Safari's automatic input zoom. Send-message taps on iPhone must submit directly at touch release before keyboard viewport changes can move the composer; keep ordinary form submission for keyboard and desktop input. Distinguish simulated geometry checks from verification on a physical iPhone.
