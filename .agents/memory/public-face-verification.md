---
name: Public face verification
description: Meaning of the user-requested public verification badge and the distinction between liveness and photo ownership.
---

Self-service face verification must confirm that a live person matches their submitted profile photo before awarding a verified badge visible to everyone. Passing liveness alone is insufficient. This is photo-ownership verification, not an attractiveness rating or proof of legal identity.

**Why:** The user asked for people to submit their picture, then verify their face to “confirm that they are the one,” with the resulting badge shown publicly.

**How to apply:** Require both liveness and a match against the specific photo submitted for verification. Do not claim that merely uploading a photo, displaying camera instructions, or completing a client-side animation verifies a person.

Members submit a specific photo during verification, even if they already uploaded multiple signup photos. After successful liveness, face-match, and gallery checks, that verification photo automatically becomes the main public profile photo with the blue tick. No administrator approval is required. The live camera capture is evidence for matching, not the replacement profile picture. The requested liveness interaction includes genuinely turning the head left and right; passive still-photo checking must not be described as that interaction.

**Why:** The user distinguished signup/gallery photos from the verification photo, then explicitly replaced manual approval: “Once your face is verified ... There's no need to approve it again.”

**How to apply:** Bind verification to the selected photo and promote it automatically after the server checks pass. Resume previously checked requests without another selfie, even if the member closes the app. The admin screen is read-only verification history, not an approval queue; keep the separate ability to revoke verification. Do not claim unsupported motion detection.

On opening verification, select and visibly mark the current main profile photo automatically. Members may choose another photo, but must not have to tap the main photo to activate it. Keep photo-processing consent unchecked until the member agrees.

**Why:** The user said members may not realize the main photo must be tapped and asked for it to be selected immediately unless they choose another.

**How to apply:** Derive the default selection from the main photo in both web and installed-app verification screens, show the selected state, and keep consent explicit.

Once a main photo is verified, any additional profile photo must match that verified face before it can be published. Nonmatching pictures must be rejected, not allowed with a warning.

**Why:** The user identified that a verified member could otherwise add photos of other people.

**How to apply:** Enforce matching on the server as well as during uploads, preserving the existing profile on failure.

Keep the verification provider's name out of the verification screen and use short consent wording. Keep processing details available in the Privacy Policy.

**Why:** The user explicitly said, “Don't mention the app name that we use.”

**How to apply:** Keep the provider as an implementation detail in the verification UI, without hiding photo-processing consent.

Luxand's public marketing pages omit the actual code widgets. Their dashboard publishes readable examples under `/docs/liveness.html` and `/docs/similarity.html`, with linked widget files under `/docs/widgets/javascript/`. The JavaScript similarity example erroneously calls `/photo/landmarks`; the official Python widget confirms `/photo/similarity`. Use the documented `similar` boolean plus score, not the landmarks response.

**Why:** The published JavaScript typo would silently call the wrong capability. Liveness and similarity are single-photo checks; instructions to hold still are supported, but a cosmetic head-turn animation does not prove motion.

**How to apply:** Verify provider examples and response shapes before changing the adapter; keep provider credentials server-side and do not claim this passive endpoint validates left/right challenges.

The user wants paid profile verification at ₦3,000 per month in Nigeria, with Paystack bank transfer locally and card payments for international users. They want to reuse the existing selfie-to-profile-photo match for the verification.

**Why:** The user explicitly requested this pricing and payment behavior for MyAgeBeauty.

**How to apply:** Treat this as the requested product model, but keep billing disabled until a supported payment provider and country/currency coverage are confirmed. Do not promise automatic currency conversion or payment methods without provider confirmation.
