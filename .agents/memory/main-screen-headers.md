---
name: Main-screen headers
description: User's preference for compact branding and reduced top space on the main tabs.
---

Do not show a logo or app-name wordmark anywhere inside the signed-in dashboard, including Discover, the other tabs, and desktop navigation. Keep page titles and functional navigation controls.

**Why:** The user explicitly corrected the earlier compact-logo preference: “Once you just log in the app, I don't want you to see any logo.” They clarified this applies only inside the dashboard, not outside.

**How to apply:** Keep the welcome, login, and signup branding unchanged. Do not add branding back to authenticated headers or reserve an empty row for a removed logo.

Back controls must sit below the iPhone clock/notch and return to the screen the member entered from. Preserve the caller through nested flows such as opening the Story composer from Chats; Settings opened from Profile must go directly back to Profile.

**Why:** The user showed a Back label overlapping the iPhone time and repeatedly said, “Where you enter, you come back,” including when canceling a story started from Chats.

**How to apply:** Account for the device's safe area once, keep Back easy to tap, and carry a validated same-app return destination through settings, verification, story creation, and other nested flows. Do not force a global home destination on cancel or completion.

On phones, keep the Story composer compact and app-like: constrain photo/video previews, keep the selected filename from widening the page, and leave the posting controls easy to reach.

**Why:** The user showed the mobile Story composer becoming oversized and horizontally clipped after selecting media, and asked for a normal phone-app preview.

**How to apply:** Use a smaller centered media preview on narrow screens, preserve the full image with `object-fit: contain`, and truncate long filenames without allowing horizontal page overflow.

Discover's bottom tabs must stay at the same screen position as Matches, including after switching tabs and using the iPhone Home Screen app. Check the rendered interaction before declaring this fixed.

**Why:** The user repeatedly showed Discover alone leaving a large bottom gap and said to check it before asking them to try again.

**How to apply:** Compare actual tab bounds across routes. Do not treat CSS source assertions or a logged-out screenshot as proof that authenticated iPhone layout works.

Avoid visible decorative divider lines above or below the bottom tabs and extra outlines around Discover's header and photo card; keep the rounded surfaces.

**Why:** After showing Discover and Matches, the user said, “I dont like all those line,” and repeated that they do not want long demarcation lines around navigation.

**How to apply:** Keep these main-screen surfaces continuous without removing functional input boundaries or selected-state indicators elsewhere.

Keep Discover's branding, Stories, swipe card, actions, and bottom navigation within one screen. Do not let the swipe card scroll underneath Stories. When a swipe card is present, put the user's own story entry in the labelled Stories row, not as a separate personal avatar beside the branding. On iPhone home-screen launches, keep the action row directly above the bottom tabs without a large empty strip below them.

**Why:** The user clarified with screenshots that the card moving underneath the sticky Stories area was cutting off the head and hiding the action buttons. They later confirmed the raised controls happened only on Discover; Matches, Messages, and Activity were already positioned correctly.

**How to apply:** Fit the photo into the remaining space after the real header, install banner, actions, and navigation. Keep this Discover-only screen containment without affecting scrolling on other screens.
