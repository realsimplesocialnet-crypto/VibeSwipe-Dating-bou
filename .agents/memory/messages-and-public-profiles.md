---
name: Messages and public profiles
description: User's intentional navigation labels and separate visual direction for other members' profiles.
---

Keep exactly five bottom tabs: Discover, Reels, Chats, Activity, Profile. Matches belongs inside Activity, not in the bottom bar. Chats is the main and only conversation list, showing real mutual matches, real previews and timestamps, and unread counts. Keep its heading compact and top-left; do not add an oversized decorative logo. Provide name-based chat search, useful All/Unread/New matches filters, circular profile photos, and a camera shortcut to the existing story composer. Keep the app's pink navigation styling. Activity shows non-message activity only; never show individual chat-message notices there. Keep summary cards for Matches, Likes, Views and Followers at the top of Activity. Individual matches, likes and views belong on their separate pages, reached from Activity, with Activity still highlighted. Matches shows mutual matches rather than conversation previews. Chat remains mutual-match-only.

**Why:** The user said six navigation buttons felt cramped, asked to put Matches inside Activity, clarified that chat messages belong only in the conversation list, selected the Chats label, and corrected an oversized decorative header in favor of a WhatsApp-like searchable chat list with a story camera shortcut.

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

Stories are private to unblocked mutual followers, not public and not merely dating matches. A profile's active-story ring opens the story viewer without leaving the profile; closing it or using device Back returns to that same profile. Use the app's pink for Follow back actions. Story replies still require an existing mutual-match chat.

**Why:** The user chose mutual follows as the story audience, showed the desired story and Follow back references, and asked to use their own color.

**How to apply:** Enforce mutual-follow privacy for story lists, views, likes, and media reads. Keep the profile route behind the story viewer, and do not let following alone unlock messaging.

When opening a member profile from a feed or list, Back must restore the originating item and position, not restart the feed or show a different member.

**Why:** The user explicitly repeated that returning from a profile must show the same place and reported Discover replacing the viewed card.

**How to apply:** Preserve the selected card and relevant list position across profile navigation. Refresh in the background without changing the user's current selection; key cached state to the active account and feed.

The member's own profile defaults to their posted Reels in a straight three-column grid. Reposted, saved, and liked videos belong in separate icon tabs; saved videos are visible only to the signed-in owner. Never mix liked videos into the posted-Reels grid.

**Why:** The user asked for the profile media organization to match TikTok and clarified that only their own Reels belong in the main profile grid.

**How to apply:** Keep the same tab separation on web/PWA and Expo, enforce privacy in the API as well as the UI, and keep the active tab and grid simple.
