---
name: Reels experience
description: Approved Reels visual direction and user-requested posting, sharing, saving, and commenting behavior.
---

The user liked the first Reels picture preview and wants that visual direction retained.

**Why:** The user said, “I like the way you edit it.”

**How to apply:** Use the approved picture as the visual reference rather than starting a different design without asking.

The general Reels entry belongs in the main navigation, not extra Discover-header or Profile shortcuts. Keep Saved Reels accessible from within Reels.

**Why:** The user requested Reels as the sixth navigation button, then clarified that it should only be there, without changing the existing colors.

**How to apply:** Do not add duplicate top-level Reels shortcuts elsewhere. Preserve working shared-video links and like notifications, which open specific videos rather than duplicate the main entry.

Back navigation should return to the place the member entered from, not a hardcoded Profile page. Saved/Posted library round trips must preserve that origin and the Reel being watched.

**Why:** The user reported Saved Reels incorrectly returning to Profile and explicitly asked that users return to where they came from.

**How to apply:** Carry validated return paths through nested Reels pages and preserve them when switching library tabs or opening a saved video.

Reels are videos. Posting must offer recording with the camera or selecting an existing video, then publishing after upload and processing finish. Private Reel shares are limited to existing, unblocked mutual-match chats; following alone never opens direct messages. Saving must make the video accessible again to that user.

**Why:** The user described recording or selecting videos, posting immediately, sharing with chat partners, and finding saved videos later. When offered the choice, they confirmed Reel share recipients should remain matched chats only.

**How to apply:** Keep Reel DM sharing within the existing match and block rules. Do not substitute static pictures for Reels or a nonfunctional share/save icon for the requested actions. Do not imply publishing occurs before the video is ready.

Use record-and-post, not live broadcasting.

**Why:** When asked to distinguish recording from broadcasting, the user selected “Record and post.”

**How to apply:** Offer recording or choosing a video, previewing it, and posting it. Do not add real-time streaming as part of this scope.

Comments must open low down without covering the video, including while the mobile keyboard is open. Tapping the video or swiping down on the comments closes the panel; the composer aligns the viewer's avatar beside its input, without extra divider lines.

**Why:** The user asked to keep the video visible while commenting, make it easy to return to full video by tap or swipe, align their profile picture with the composer and remove comment-panel divider lines.

**How to apply:** Reserve space below the visible video for the comment panel and input instead of placing an opaque sheet over the video. Keep the composer avatar adjacent to the input, omit panel/reply separator lines, and support both a video tap and a downward swipe to dismiss.

Long comment and reply text starts at three lines and expands with a “More” control only when it is clipped.

**Why:** The user wants comment text to stay compact in the feed, with the rest revealed when a viewer asks to see more.

**How to apply:** Clamp long text within its comment row and let it expand in place without obscuring the Reel or other comments.

Comment authors' names and photos open their public profiles. Members can reply to top-level Reel comments, and the original commenter receives an Activity and push notification for each reply.

**Why:** The user asked to open commenters' profiles and notify someone when another member replies to their comment.

**How to apply:** Keep the original comment visible with its replies, preserve the Reel as the return destination from a commenter profile, link reply alerts directly to the replied-to comment, prefix replies with a clickable mention of the original commenter, and label the Reel author's comments and replies “Creator.”

The public Reels feed remains full-screen and edge-to-edge, with Reels/Friends feed tabs at the top and the main app tabs at the bottom, Reels highlighted. Both navigation rows show by default and hide together on a video tap; the next tap shows them again. A video tap must not pause playback; use a separate playback control.

**Why:** The user asked to watch a full-screen Reel without navigation overlays and clarified that tapping must not pause the video.

**How to apply:** Overlay the feed tabs and app navigation without shrinking the video. Hide the navigation rows on a video tap and restore them on the next tap; keep playback controls separate from the video surface, and keep nested comments/search clear of the app tabs. Do not promise to suppress notifications generated by the phone's operating system.

Reels navigation, action icons, labels, and counts should use bold, high-contrast styling with a polished, professional appearance.

**Why:** The user asked for sharper, bolder Reels controls and text that remain easy to see on a phone.

**How to apply:** Give the Reels/Friends tabs, search and add controls, like/comment/share actions, navigation labels, and view/count badges clear weight and contrast without changing the brand palette.

Keep the vertical action rail compact and ordered Like, Comment, Share, Save, then offline save, with a music-artwork slot at the bottom. Do not show the creator avatar or a Follow/plus badge on the rail; show the creator avatar with a colored ring beside the lower-left name, which remains the profile link. Keep the top add button for posting a Reel.

**Why:** The user asked to remove the profile-attached plus badge, then shared a reference showing the creator avatar beside the name with a colored ring.

**How to apply:** Keep Reel engagement and offline-save controls stable, keep the profile link on the creator identity, and use a music icon until track artwork exists. Do not build music selection or playback until requested.

Keep the creator's photo, name, age, location, and caption compact at the lower left; do not duplicate the creator photo elsewhere on the Reel.

**Why:** The user approved a Reels reference with a ringed creator photo beside compact lower-left identity text and no Follow badge on the action rail.

**How to apply:** Keep the name and age on one line, location directly below, and caption at 15px in the web feed. Use the ringed avatar as the profile link; avoid banners or repeated profile photos.

Use a plain, unboxed search icon and flat search field; avoid circular buttons and pill-like borders around Reels search.

**Why:** The user compared Reels to TikTok and asked for search controls without the rounded visual demarcation.

**How to apply:** Keep the search target comfortably tappable but transparent and unrounded; keep typed search content functional.

Reels must not allow nudity or explicit sexual content. The user chose automatic content checks rather than manual Reel approval; normal videos should remain allowed. Run the Hugging Face content checker inside the app server.

**Why:** The user reported naked Reels, selected Hugging Face AI, and chose “Inside app server” rather than a hosted inference service.

**How to apply:** Check video content before it becomes publicly playable, reject disallowed material, and never treat face verification as a nudity/content check. Keep this separate from the existing face-verification provider.

Reels should request playback with sound enabled by default, with controls to pause and mute or unmute. Browser autoplay rules may still require a first viewer gesture before audible playback.

**Why:** The user clarified that Reels should start with sound and viewers should choose when to mute; browsers may block sound autoplay until interaction.

**How to apply:** Attempt to autoplay the active video unmuted, pause off-screen videos, and keep a clear play action if the browser blocks autoplay. Do not require the volume icon to be tapped just to request sound, and do not replace playback with static previews.

Reels have no app-imposed duration cap; Story videos are limited to 60 seconds. Keep file-size, safety and processing safeguards separate from Reel duration.

**Why:** The user clarified that Reels can be any length, including hours, while Story videos should be one minute maximum.

**How to apply:** Do not add duration checks or trim Reels in selection, upload, transcoding, moderation or publishing. Preserve the full clip, retain resource safeguards such as upload-size limits, and enforce the separate 60-second Story limit on client and server.

Safety approval must refer to the exact checked video, not a client-writable upload destination. Unknown, failed, outdated or rejected checks must never make a Reel public.

**Why:** A still-valid upload URL can overwrite bytes after a successful check. Automatic moderation also cannot promise to catch every explicit scene.

**How to apply:** Publish an immutable checked copy, enforce approval on both publishing and subsequent visibility, and invalidate approvals when changing the model, threshold or sampling policy. Keep automatic rechecks for existing Reels. Describe checks honestly without claiming perfect detection.

Watched Reels should be available for offline replay after they are saved on the device. Automatically cache them only on Wi-Fi; do not silently download videos over cellular data.

**Why:** The user wants to reopen and replay watched videos after losing data, and chose Wi-Fi-only automatic caching.

**How to apply:** Cache only approved public Reels, keep offline storage bounded and expiring, and do not treat a partial online stream as a guaranteed offline copy. If the browser cannot identify Wi-Fi, require an explicit save action rather than auto-downloading.
