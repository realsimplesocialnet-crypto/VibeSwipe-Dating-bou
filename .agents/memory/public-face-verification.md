---
name: Public face verification
description: Meaning of the user-requested public verification badge and the distinction between liveness and photo ownership.
---

Self-service face verification must confirm that a live person matches their submitted profile photo before awarding a verified badge visible to everyone. Passing liveness alone is insufficient. This is photo-ownership verification, not an attractiveness rating or proof of legal identity.

**Why:** The user asked for people to submit their picture, then verify their face to “confirm that they are the one,” with the resulting badge shown publicly.

**How to apply:** Require both liveness and a match against the specific photo submitted for verification. Do not claim that merely uploading a photo, displaying camera instructions, or completing a client-side animation verifies a person.

The user clarified that members submit a specific photo during verification, even if they already uploaded multiple signup photos. After successful checks and the owner's explicit administrator approval, that verification photo becomes the main public profile photo with the blue tick. Passing camera checks must only queue the request, never automatically grant the badge or change the main photo. The live camera capture is evidence for matching, not the replacement profile picture. The requested liveness interaction includes genuinely turning the head left and right; passive still-photo checking must not be described as that interaction.

**Why:** The user explicitly distinguished signup gallery photos, the photo submitted for verification, and the camera capture used to prove that the person matches it.

**How to apply:** Bind verification to the selected verification photo and promote that exact photo only after approval. Do not treat the remaining gallery photos as individually verified or claim unsupported motion detection.

Luxand's public marketing pages omit the actual code widgets. Their dashboard publishes readable examples under `/docs/liveness.html` and `/docs/similarity.html`, with linked widget files under `/docs/widgets/javascript/`. The JavaScript similarity example erroneously calls `/photo/landmarks`; the official Python widget confirms `/photo/similarity`. Use the documented `similar` boolean plus score, not the landmarks response.

**Why:** The published JavaScript typo would silently call the wrong capability. Liveness and similarity are single-photo checks; instructions to hold still are supported, but a cosmetic head-turn animation does not prove motion.

**How to apply:** Verify provider examples and response shapes before changing the adapter; keep provider credentials server-side and do not claim this passive endpoint validates left/right challenges.
