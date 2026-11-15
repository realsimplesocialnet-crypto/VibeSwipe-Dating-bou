---
name: Long voice notes
description: Product rules for recording and delivering long private chat audio.
---

Voice notes must not have an app-enforced recording-time cutoff. The user explicitly asked for full-length recordings rather than a 60-second cap: hold to record, release to send, show a timer, and offer cancellation/deletion while recording. Recipients need the whole recording with pause, seeking, and visible duration.

**Why:** The user wants long voice messages, not silently shortened clips.

**How to apply:** Do not add duration clamps in either client, API validation, or playback. Retain unsent recordings for retry while the chat stays open, and keep audio private to authorized matched participants. Distinguish device/storage/upload capacity from a time cutoff; disclose file-size safety limits rather than calling storage unlimited.
