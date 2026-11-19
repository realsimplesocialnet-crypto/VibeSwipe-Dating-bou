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

Track previews in the Reel composer are temporary: stop and release playback when the picker closes, a track is chosen, the composer exits, or the app is backgrounded. The picker must use the selected app theme for readable text and background contrast.

**Why:** The user reported that preview music continued after leaving and that white text on the light-theme picker could not be read.

**How to apply:** Stop the audio element and discard its source on every exit path, guard against late playback promises restarting it, and use theme-aware foreground, muted, border, and surface colors.

Use record-and-post, not live broadcasting.

**Why:** When asked to distinguish recording from broadcasting, the user selected “Record and post.”

**How to apply:** Offer recording or choosing a video, previewing it, and posting it. Do not add real-time streaming as part of this scope.

Comments must open low down without covering the video, including while the mobile keyboard is open. Tapping the video or swiping down on the comments closes the panel; the composer aligns the viewer's avatar beside its input, without extra divider lines.

**Why:** The user asked to keep the video visible while commenting, make it easy to return to full video by tap or swipe, align their profile picture with the composer and remove comment-panel divider lines.

**How to apply:** Reserve space below the visible video for the comment panel and input instead of placing an opaque sheet over the video. Keep the composer avatar adjacent to the input, omit panel/reply separator lines, and support both a video tap and a downward swipe to dismiss. On iPhone, submit directly from the Send touch before Safari's keyboard-driven viewport resize can move the control; guard against duplicate touch and click submissions.

The comment panel should open wide enough for a comfortable conversation while leaving the video visible and playable; tapping the visible video can still pause or resume it.

**Why:** The user approved a TikTok-style wide comment view where the video continues playing behind the open comments and can still be paused.

**How to apply:** Size the panel to roughly three-fifths of the currently visible phone viewport, keep the remaining video area tappable, and keep the composer above the keyboard.

Long comment and reply text starts at three lines and expands with a “More” control only when it is clipped.

**Why:** The user wants comment text to stay compact in the feed, with the rest revealed when a viewer asks to see more.

**How to apply:** Clamp long text within its comment row and let it expand in place without obscuring the Reel or other comments.

Comment authors' names and photos open their public profiles. Members can reply to top-level Reel comments, and the original commenter receives an Activity and push notification for each reply.

**Why:** The user asked to open commenters' profiles and notify someone when another member replies to their comment.

**How to apply:** Keep the original comment visible with its replies, preserve the Reel as the return destination from a commenter profile, link reply alerts directly to the replied-to comment, prefix replies with a clickable mention of the original commenter, and label the Reel author's comments and replies “Creator.”

The public Reels feed remains full-screen and edge-to-edge, with Reels/Friends feed tabs at the top and the main app tabs at the bottom, Reels highlighted. A single video tap toggles playback and briefly shows a center play/pause icon; this does not hide navigation. Double-tapping toggles sound and briefly shows a center speaker icon.

**Why:** The user clarified that tapping the video should play or pause it, and asked to remove the permanent top volume and play controls.

**How to apply:** Keep the video tap target full-screen. Do not add permanent volume or pause controls to the top bar; preserve sound access with double-tap feedback and playback access with a single tap. Keep nested comments/search clear of the app tabs. Do not promise to suppress notifications generated by the phone's operating system.

The public Reels feed should mix videos older than seven days with recent videos, beginning with an older video when available. Keep the order stable while the viewer scrolls.

**Why:** The user said Reels should not always open on the newest post and asked for older and newer videos to be mixed.

**How to apply:** Mix the older and recent streams in the public and Friends feeds with independent cursors so pagination does not skip or repeat videos. Keep search and profile Reels in their existing order.

Photo-slide swipes must stay on the current Reel unless the viewer deliberately swipes vertically. Lock horizontal gestures to the image carousel; only a clear vertical swipe advances the feed.

**Why:** The user reported that sideways photo swipes were unintentionally advancing to other Reels.

**How to apply:** Use directional gesture locking and a deliberate threshold for vertical navigation so small diagonal movement never moves the feed.

The “Send to” share sheet must keep both matched recipients and copy/share destinations visible above the app navigation.

**Why:** The user showed the share panel with a recipient and a large empty area while the app navigation covered its sharing options.

**How to apply:** Let the sheet overlay the full viewport and scroll if needed; do not clip it to the Reels stage or place the app navigation above it.

Reels navigation, action icons, labels, and counts should use bold, high-contrast styling with a polished, professional appearance.

**Why:** The user asked for sharper, bolder Reels controls and text that remain easy to see on a phone.

**How to apply:** Give the Reels/Friends tabs, search and add controls, like/comment/share actions, navigation labels, and view/count badges clear weight and contrast without changing the brand palette.

Keep the vertical action rail compact and ordered Like, Comment, Save, Share. Use simple solid-white icons with no pink decorations inside; show pink only for a liked or saved state. Do not put icons in circular backgrounds. Do not show Message, Follow/plus, Remix, download, or music controls on the rail. Put a direct Post Reel plus control in the top-right header and a separate Saved Reels bookmark link there; keep owner-only deletion in the Posted Reels library. Show the creator avatar with a colored ring beside the lower-left name, which remains the profile link. Keep the active Reels bottom tab and its indicator pink to match the app-wide navigation; keep the action rail visually compact.

**Why:** The user asked for a visible save control instead of hiding Save in the three-dot menu, and asked that the top-right control lead directly to Reel posting instead of leaving a plus on the action rail.

**How to apply:** Keep the profile link on the creator identity, keep Wi-Fi auto-caching separate from the visible action rail, and retain the four requested buttons in this order. Use the app’s pink selected-state treatment for Reels navigation. Do not add a direct-message control or music selection/playback to the Reels rail.

Keep the creator's photo, name, age, location, and caption compact at the lower left; do not duplicate the creator photo elsewhere on the Reel.

**Why:** The user approved a Reels reference with a ringed creator photo beside compact lower-left identity text and no Follow badge on the action rail.

**How to apply:** Keep the name and age on one line, location directly below, and caption at 15px in the web feed. Use the ringed avatar as the profile link; avoid banners or repeated profile photos.

Use a plain, unboxed search icon and flat search field; avoid circular buttons and pill-like borders around Reels search. Do not show automatic caption-derived search suggestion pills on videos.

**Why:** The user compared Reels to TikTok and asked for search controls without the rounded visual demarcation, then said caption-based search prompts on videos looked unnecessary and confusing.

**How to apply:** Keep the search target comfortably tappable but transparent and unrounded; keep typed search content functional through the top search control, without prompting from each Reel's caption.

Reels must not allow nudity or explicit sexual content. The user chose automatic content checks rather than manual Reel approval; normal videos should remain allowed. Run the Hugging Face content checker inside the app server.

**Why:** The user reported naked Reels, selected Hugging Face AI, and chose “Inside app server” rather than a hosted inference service.

**How to apply:** Check video content before it becomes publicly playable, reject disallowed material, and never treat face verification as a nudity/content check. Keep this separate from the existing face-verification provider.

Reels should request playback with sound enabled by default. Single-tap the video to pause/play; double-tap it to mute/unmute. Do not show permanent top volume or pause buttons. Browser autoplay rules may still require a viewer gesture before audible playback.

**Why:** The user asked to remove visible top volume and playback controls while keeping video taps for playback and sound interaction.

**How to apply:** Attempt to autoplay the active video unmuted and pause off-screen videos. Use a single tap for playback and a double tap for sound, with only brief center feedback; a video tap should resume playback if autoplay is blocked. Do not replace playback with static previews.

Reels have no app-imposed duration cap; Story videos are limited to 60 seconds. Keep file-size, safety and processing safeguards separate from Reel duration.

**Why:** The user clarified that Reels can be any length, including hours, while Story videos should be one minute maximum.

**How to apply:** Do not add duration checks or trim Reels in selection, upload, transcoding, moderation or publishing. Preserve the full clip, retain resource safeguards such as upload-size limits, and enforce the separate 60-second Story limit on client and server.

Keep the Reel posting screen concise: show action labels, field labels, choices, errors, and necessary status only; omit explanatory paragraphs about duration, music, and privacy.

**Why:** The user said they do not like explanatory text on this screen.

**How to apply:** Prefer a short label or control over explanatory copy on the Reel composer.

Safety approval must refer to the exact checked video, not a client-writable upload destination. Unknown, failed, outdated or rejected checks must never make a Reel public.

**Why:** A still-valid upload URL can overwrite bytes after a successful check. Automatic moderation also cannot promise to catch every explicit scene.

**How to apply:** Publish an immutable checked copy, enforce approval on both publishing and subsequent visibility, and invalidate approvals when changing the model, threshold or sampling policy. Keep automatic rechecks for existing Reels. Describe checks honestly without claiming perfect detection.

Watched Reels should be available for offline replay after they are saved on the device. Automatically cache them only on Wi-Fi; do not silently download videos over cellular data.

**Why:** The user wants to reopen and replay watched videos after losing data, and chose Wi-Fi-only automatic caching.

**How to apply:** Cache only approved public Reels, keep offline storage bounded and expiring, and do not treat a partial online stream as a guaranteed offline copy. If the browser cannot identify Wi-Fi, require an explicit save action rather than auto-downloading.
