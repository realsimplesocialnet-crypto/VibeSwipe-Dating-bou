---
name: Long voice notes
description: Product rules for recording and delivering long private chat audio.
---

Voice notes must not have an app-enforced recording-time cutoff. Hold to record and release to send unless the user slides up to lock recording. Locked recording must continue hands-free until an explicit Send or cancel/delete action. Show a timer and offer cancellation/deletion while recording. Recipients need the whole recording with pause, seeking, and visible duration.

**Why:** The user wants long voice messages, not silently shortened clips.

**How to apply:** Do not add duration clamps in either client, API validation, or playback. Retain unsent recordings for retry while the chat stays open, and keep audio private to authorized matched participants. Distinguish device/storage/upload capacity from a time cutoff; disclose file-size safety limits rather than calling storage unlimited.

Use compact WhatsApp-like voice-note players with a round sender photo and a clearly visible recording area that does not crowd the message input.

**Why:** The user supplied comparison screenshots, called the current recorder cramped, and specifically requested slide-up hands-free recording and round sender photos.

**How to apply:** Keep controls legible and tappable on mobile while preserving the app’s own branding and the existing keyboard-following layout.
