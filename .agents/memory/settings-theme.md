---
name: Settings theme persistence
description: The selected app theme must remain consistent across Settings sections.
---

Settings routes must follow the member's existing app theme. Opening a settings section must not change its colors or the saved theme preference.

**Why:** The user reported that opening Notification Settings changed the screen colors without them changing the theme.

**How to apply:** Use shared theme tokens for Settings screens and verify the saved light or dark preference remains consistent while navigating between sections.
