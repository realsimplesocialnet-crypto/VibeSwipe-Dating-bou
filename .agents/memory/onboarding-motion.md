---
name: Onboarding motion
description: The user's onboarding animation direction and a reference-image framing pitfall.
---

Use a real moving preview during account creation, not a set of static pictures. The user requested a gently floating phone, slow decorative hearts/badges/shapes, and automatic Welcome → Create Profile → Upload Photo → Verification → Success previews, inspired by ALAT by Wema's premium onboarding presentation. Keep Get Started and Log in fixed on the welcome screen. Use the soft beige studio and subtle blue-grid direction for this onboarding artwork, not as a request to redesign the main app.

**Why:** The user explicitly corrected the still-image interpretation, asked for video inside the app, and then clarified: “Don't put play button in, just animation.”

**How to apply:** Autoplay the moving phone without visible play buttons or video-player controls. Keep the real interactive account forms and verification. Respect reduced-motion and data-saving preferences; accessibility-only pause/resume actions must not become visible player buttons in the normal mobile interface.

Image-to-video output can contain black letterboxing from a square reference even when the output file is correctly reported as 9:16.

**Why:** A square concept image produced a 720×1280 video with a square animated scene and embedded black bars.

**How to apply:** Inspect actual frames, not only the file dimensions. Prefer a correctly composed portrait reference before generation; otherwise remove embedded bars and extend the studio background without cutting off the phone.
