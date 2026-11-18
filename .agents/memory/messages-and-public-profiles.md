---
name: Messages and public profiles
description: User's intentional navigation labels and separate visual direction for other members' profiles.
---

Keep exactly five bottom tabs: Discover, Reels, Chats, Activity, Profile. Matches belongs inside Activity, not in the bottom bar. Chats is the main and only conversation list, showing real mutual matches, real previews and timestamps, and unread counts. Use a bold Chats heading with a rounded inbox icon and unread-count badge; keep the app's pink navigation styling. Activity shows non-message activity only; never show individual chat-message notices there. Keep summary cards for Matches, Likes, Views and Followers at the top of Activity. Individual matches, likes and views belong on their separate pages, reached from Activity, with Activity still highlighted. Matches shows mutual matches rather than conversation previews. Chat remains mutual-match-only.

**Why:** The user said six navigation buttons felt cramped, asked to put Matches inside Activity, clarified that chat messages belong only in the conversation list, and selected the Chats label and inbox/badge design.

**How to apply:** Do not restore Matches or Views as bottom tabs, show chat-message notifications in Activity, mix detailed social lists into Activity, or add a second Chats list elsewhere. Put Activity summary cards before notifications. Matches needs a clear Activity shortcut and a Back-to-Activity action. Existing message entry-point links should open the same Chats destination.

Leave paid upgrades out.

**Why:** The user chose “Leave paid upgrades out” when asked about the reference's premium bar.

**How to apply:** Do not add a non-working Upgrade button, payment gate, or premium banner merely to copy a screenshot.

Other members' full profiles use the current charcoal-and-gold palette: background `#0F0F12`, cards `#1A1A1E`, and accent `#C4A574`, without bright pink or an in-dashboard wordmark. Keep real name/location, age/work/looking-for/about details, and uploaded photos.

When opened from Likes, show the selected member's main photo prominently and present Pass plus Like Back; omit Super Like on that entry path. Like Back uses the normal like/match handling and returns to Likes when no match celebration takes over. Keep other profile entry paths' existing actions.

**Why:** The user asked for the Likes-to-profile flow to show a clear Like Back action and later replaced the bright-pink visual direction with charcoal and soft gold.

**How to apply:** Keep this public-profile behavior consistent in native and web/PWA, separate from the user's own profile overview, and preserve existing Activity/return navigation.

Super Like is the floating star action and produces a distinct “Super Liked you” Activity notice, not an ordinary like notice. Activity may show these special notices alongside its short message notices and summary shortcuts. A Super Like never unlocks chat by itself.

**Why:** The user explicitly clarified that Super Like is stronger than a normal like and must appear as “Super Liked you” in Activity; chat remains mutual-match-only.

**How to apply:** Preserve the distinction when revising profile actions, Likes, notification summaries, or match celebrations.

The default chat uses the user's light, white-and-pink reference. The header photo and name open the match's full profile. Suggested questions populate the editable draft only; selecting one must never send it automatically.

**Why:** The user explicitly requested that tapping a suggested question puts its text into the input, with a separate Send button.

**How to apply:** Preserve this distinction on both web/PWA and native, including when revising empty-conversation suggestions or icons.
