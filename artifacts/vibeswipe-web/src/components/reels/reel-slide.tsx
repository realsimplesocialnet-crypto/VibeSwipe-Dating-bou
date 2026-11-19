import { useEffect, useId, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { Link } from "wouter";
import type { Reel } from "@workspace/api-client-react";
import { ChevronRight, MapPin, Pause, Play, Search, Volume2, VolumeX } from "lucide-react";
import { VerifiedBadge } from "@/components/verified-badge";
import { ReelAvatar } from "@/components/reels/reel-avatar";
import { formatCount, reelMediaUrl } from "@/lib/reels";
import { reelSearchSuggestion } from "@/lib/reel-search-suggestion";
import { isOfflineReelWifi } from "@/lib/offline-reels";

type Props = {
  reel: Reel; index: number; active: boolean; near: boolean; muted: boolean; pageHidden: boolean;
  compact: boolean; navigationVisible: boolean; returnTo: string;
  likePending: boolean; savePending: boolean;
  onAutoplayMuted: () => void; onToggleSound: () => void;
  onLike: () => void; onComment: () => void; onShare: () => void; onSave: () => void;
  onSearchSuggestion: (query: string) => void;
  onView: () => void;
  offlineSaved: boolean; onAutoCache: () => void;
};

type ReelIconName = "like" | "comment" | "share" | "save";

function ReelActionIcon({ name, filled = false }: { name: ReelIconName; filled?: boolean }) {
  const gradientId = `reel-icon-${useId().replace(/:/g, "")}`;
  const stroke = `url(#${gradientId})`;
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <defs><linearGradient id={gradientId} x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#ff63aa" /><stop offset="1" stopColor="#a875ff" /></linearGradient></defs>
    {name === "like" && <path d="M20.8 4.7a5.4 5.4 0 0 0-7.7 0L12 5.8l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.4 5.4 0 0 0 0-7.7Z" stroke={filled ? stroke : "#fff"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill={filled ? stroke : "#fff"} />}
    {name === "comment" && <><path d="M6 4.5h12a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2h-1v3.5L13 16H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /><circle cx="8.5" cy="10.5" r="1" fill="#fff" /><circle cx="12" cy="10.5" r="1" fill="#fff" /><circle cx="15.5" cy="10.5" r="1" fill="#fff" /></>}
    {name === "share" && <path d="M3.5 19.5c2.5-6.8 7.1-10.4 14.3-10.4h1.7V5l5 4.9-5 4.9V12h-1.7c-5.5 0-8.9 2.8-11.1 7.5H3.5Z" fill="#fff" />}
    {name === "save" && <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z" stroke={filled ? stroke : "#fff"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill={filled ? stroke : "#fff"} />}
  </svg>;
}

export function ReelSlide({ reel, index, active, near, muted, pageHidden, compact, navigationVisible, returnTo, likePending, savePending, onAutoplayMuted, onToggleSound, onLike, onComment, onShare, onSave, onSearchSuggestion, onView, offlineSaved, onAutoCache }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const autoCacheRequested = useRef(false);
  const viewRecorded = useRef(false);
  const flashTimer = useRef<number | null>(null);
  const lastVideoTap = useRef<{ at: number; wasPlaying: boolean } | null>(null);
  const mediaTouch = useRef<{ x: number; y: number } | null>(null);
  const skipNextTap = useRef(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const slideshow = reel.mediaType === "slides" && reel.slideReferences.length > 1;
  const slideCount = reel.slideReferences.length;
  const [userPaused, setUserPaused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<"play" | "pause" | "sound-on" | "sound-off" | null>(null);

  useEffect(() => {
    if (!slideshow) return;
    const neighborIndexes = [slideIndex - 1, slideIndex + 1, slideIndex + 2]
      .filter((slide) => slide >= 0 && slide < slideCount);
    const preloaded = neighborIndexes.map((slide) => {
      const image = new window.Image();
      image.decoding = "async";
      image.src = reelMediaUrl(reel.slideReferences[slide]);
      return image;
    });
    return () => {
      for (const image of preloaded) {
        image.onload = null;
        image.onerror = null;
      }
    };
  }, [reel.id, reel.slideReferences, slideCount, slideIndex, slideshow]);

  useEffect(() => { if (!active) setUserPaused(false); }, [active]);
  useEffect(() => { setProgress(0); setSlideIndex(0); setReady(false); setCaptionExpanded(false); }, [reel.id]);
  useEffect(() => () => { if (flashTimer.current !== null) window.clearTimeout(flashTimer.current); }, []);
  useEffect(() => { if (video.current) video.current.muted = muted; }, [muted]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (!active || pageHidden || userPaused || failed) { element.pause(); return; }
    element.muted = muted;
    const attempt = element.play();
    if (attempt) attempt.then(() => setBlocked(false)).catch((error: unknown) => {
      const name = (error as { name?: string }).name;
      if (name === "AbortError") return;
      if (name === "NotAllowedError" && !muted) {
        // iPhone permits inline autoplay when muted. Double-tap can request
        // sound without an always-visible volume button.
        element.muted = true;
        const mutedAttempt = element.play();
        if (mutedAttempt) {
          mutedAttempt.then(() => {
            setBlocked(false);
            onAutoplayMuted();
          }).catch((mutedError: unknown) => {
            if ((mutedError as { name?: string }).name !== "AbortError") setBlocked(true);
          });
        } else {
          setBlocked(false);
          onAutoplayMuted();
        }
        return;
      }
      setBlocked(true);
    });
    // muted is applied separately so toggling sound never restarts playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pageHidden, userPaused, failed, near]);

  function togglePlayback() {
    const element = video.current;
    if (!element || failed) return;
    if (blocked || element.paused) {
      setUserPaused(false);
      element.muted = muted;
      void element.play().then(() => setBlocked(false)).catch((error: unknown) => {
        const name = (error as { name?: string }).name;
        if (name === "NotAllowedError" && !muted) {
          element.muted = true;
          void element.play().then(() => { setBlocked(false); onAutoplayMuted(); }).catch(() => setBlocked(true));
        } else if (name !== "AbortError") setBlocked(true);
      });
      showFlash("play");
    } else {
      setUserPaused(true);
      element.pause();
      showFlash("pause");
    }
  }

  function showFlash(next: "play" | "pause" | "sound-on" | "sound-off") {
    setFlash(next);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => { flashTimer.current = null; setFlash(null); }, 520);
  }

  function toggleSound() {
    onToggleSound();
    showFlash(muted ? "sound-on" : "sound-off");
  }

  function handleVideoTap() {
    if (slideshow) return;
    const now = performance.now();
    const previousTap = lastVideoTap.current;
    if (previousTap && now - previousTap.at < 300) {
      lastVideoTap.current = null;
      const element = video.current;
      if (previousTap.wasPlaying && element) {
        setUserPaused(false);
        element.muted = muted;
        const attempt = element.play();
        if (attempt) void attempt.then(() => setBlocked(false)).catch(() => setBlocked(true));
      } else {
        setUserPaused(true);
        element?.pause();
      }
      toggleSound();
      return;
    }

    const element = video.current;
    lastVideoTap.current = {
      at: now,
      wasPlaying: Boolean(element && !element.paused && !blocked && !userPaused),
    };
    togglePlayback();
  }

  function startMediaTouch(event: ReactTouchEvent<HTMLButtonElement>) {
    const touch = event.changedTouches[0];
    mediaTouch.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function finishMediaTouch(event: ReactTouchEvent<HTMLButtonElement>) {
    const start = mediaTouch.current;
    mediaTouch.current = null;
    const touch = event.changedTouches[0];
    if (!slideshow || !start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 42 || Math.abs(dx) <= Math.abs(dy)) return;
    event.preventDefault();
    skipNextTap.current = true;
    setSlideIndex((current) => Math.max(0, Math.min(slideCount - 1, current + (dx < 0 ? 1 : -1))));
    window.setTimeout(() => { skipNextTap.current = false; }, 350);
  }

  function moveSlideTo(next: number) {
    setSlideIndex(Math.max(0, Math.min(slideCount - 1, next)));
  }

  function retry() {
    setFailed(false);
    setReady(false);
    video.current?.load();
  }

  function seekVideo(value: string) {
    const element = video.current;
    if (!element || !Number.isFinite(element.duration) || element.duration <= 0) return;
    const nextProgress = Math.min(100, Math.max(0, Number(value)));
    element.currentTime = (nextProgress / 100) * element.duration;
    setProgress(nextProgress);
  }

  const src = reelMediaUrl(reel.videoReference);
  const paused = userPaused || blocked;
  const reelReturnParams = new URLSearchParams({ returnTo });
  const creatorProfileReturn = `/reels/${encodeURIComponent(reel.id)}?${reelReturnParams.toString()}`;
  const creatorProfileHref = `/profile/${encodeURIComponent(reel.creatorId)}?returnTo=${encodeURIComponent(creatorProfileReturn)}`;
  const searchSuggestion = reelSearchSuggestion({ caption: reel.caption, creatorLocation: reel.creatorLocation });
  const creatorIdentity = <span className="reel-creator-identity">
    <span className="reel-creator-avatar-ring">
      <ReelAvatar reference={reel.creatorPhoto} name={reel.creatorName} size={34} />
    </span>
    <span className="reel-identity min-w-0">
      <span className="reel-name" data-testid={`text-reel-creator-${reel.id}`}>{reel.creatorName}<VerifiedBadge verified={reel.creatorVerified} /></span>
      {reel.creatorLocation && <span className="reel-location"><MapPin size={13} className="shrink-0 text-white" /><span className="truncate">{reel.creatorLocation}</span></span>}
    </span>
  </span>;
  return <section className="reel-slide" data-index={index} data-testid={`reel-slide-${reel.id}`} aria-roledescription="Reel" aria-label={`Reel by ${reel.creatorName}`}>
    {slideshow
      ? <div className="reel-photo-slides" data-testid={`reel-photo-slides-${reel.id}`} aria-label={`Photo slide ${slideIndex + 1} of ${slideCount}`}>
        <img src={reelMediaUrl(reel.slideReferences[slideIndex])} alt="" className="reel-photo-slide" loading="eager" decoding="async" fetchPriority={active ? "high" : "auto"} draggable={false} />
      </div>
      : <video
      ref={video}
      src={reel.mediaType === "video" && (active || near) ? src : undefined}
      className="reel-video"
      playsInline muted={muted} loop
      preload={active ? "auto" : "metadata"}
      onLoadedData={() => setReady(true)}
      onError={() => { if (near) setFailed(true); }}
      onPlaying={(event) => {
        const element = event.currentTarget;
        if (!viewRecorded.current && !element.paused) {
          viewRecorded.current = true;
          onView();
        }
      }}
      onTimeUpdate={(event) => {
        const element = event.currentTarget;
        if (element.duration) setProgress((element.currentTime / element.duration) * 100);
        if (element.duration && element.currentTime / element.duration >= 0.85 && !autoCacheRequested.current && isOfflineReelWifi() && !offlineSaved) {
          autoCacheRequested.current = true;
          onAutoCache();
        }
      }}
      data-testid={`video-reel-${reel.id}`}
    />}
    {!slideshow && !ready && !failed && <div className="reel-loading" aria-hidden="true" />}
    <button type="button" className={`reel-tap ${slideshow ? "is-slideshow" : ""}`} onTouchStart={startMediaTouch} onTouchEnd={finishMediaTouch} onClick={() => { if (skipNextTap.current) { skipNextTap.current = false; return; } handleVideoTap(); }} aria-label={slideshow ? `Photo slideshow, ${slideIndex + 1} of ${slideCount}. Swipe left or right to browse.` : `${userPaused || blocked ? "Play" : "Pause"} Reel. Double-tap to ${muted ? "turn sound on" : "mute"}.`} aria-pressed={!slideshow && !userPaused && !blocked} data-testid={`button-toggle-reel-playback-${reel.id}`} />
    {slideshow && <div className="reel-slide-counter" aria-live="polite" data-testid={`text-reel-slide-count-${reel.id}`}>{slideIndex + 1}/{slideCount}</div>}
    {slideshow && <div className="reel-slide-dots" role="group" aria-label="Choose photo slide">{reel.slideReferences.map((_, slide) => <button key={slide} type="button" onClick={() => moveSlideTo(slide)} aria-label={`Show photo ${slide + 1}`} aria-current={slide === slideIndex ? "step" : undefined} data-testid={`button-reel-slide-${reel.id}-${slide + 1}`} />)}</div>}
    {active && !slideshow && <button type="button" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-full focus:bg-black/80 focus:p-3 focus:text-white" onClick={toggleSound} aria-label={muted ? "Turn Reel sound on" : "Mute Reel"} data-testid={`button-toggle-reel-sound-accessible-${reel.id}`} />}
    {flash && <span className="reel-flash" aria-hidden="true">{flash === "play" ? <Play size={34} fill="currentColor" /> : flash === "pause" ? <Pause size={34} fill="currentColor" /> : flash === "sound-on" ? <Volume2 size={34} /> : <VolumeX size={34} />}</span>}
    {failed && <div className="reel-blocked" role="alert"><span>This video could not load.</span><button type="button" onClick={retry} className="reel-pill" data-testid={`button-retry-reel-${reel.id}`}>Try again</button></div>}
    <div className="reel-shade" aria-hidden="true" />

    <div className={`reel-rail ${compact ? "is-compact" : ""} ${navigationVisible ? "is-nav-visible" : ""}`}>
      <button type="button" className={`reel-action-button ${reel.likedByMe ? "is-on" : ""}`} onClick={onLike} disabled={likePending} aria-pressed={reel.likedByMe} aria-label={reel.likedByMe ? "Unlike" : "Like"} data-testid={`button-like-reel-${reel.id}`}>
        <ReelActionIcon name="like" filled={reel.likedByMe} /><span data-testid={`text-like-count-${reel.id}`}>{formatCount(reel.likeCount)}</span>
      </button>
      <button type="button" className="reel-action-button" onClick={onComment} aria-label="Comments" data-testid={`button-comments-reel-${reel.id}`}>
        <ReelActionIcon name="comment" /><span data-testid={`text-comment-count-${reel.id}`}>{formatCount(reel.commentCount)}</span>
      </button>
      <button type="button" className={`reel-action-button ${reel.savedByMe ? "is-saved" : ""}`} onClick={onSave} disabled={savePending} aria-pressed={reel.savedByMe} aria-label={reel.savedByMe ? "Remove from Saved Reels" : "Save Reel"} data-testid={`button-save-reel-${reel.id}`}>
        <ReelActionIcon name="save" filled={reel.savedByMe} /><span data-testid={`text-save-count-${reel.id}`}>{formatCount(reel.saveCount)}</span>
      </button>
      <button type="button" className="reel-action-button" onClick={onShare} aria-label={`Share, ${formatCount(reel.shareCount)} shares`} data-testid={`button-share-reel-${reel.id}`}><ReelActionIcon name="share" /><span data-testid={`text-share-count-${reel.id}`}>{formatCount(reel.shareCount)}</span></button>
    </div>

    <div className={`reel-meta ${searchSuggestion && !compact ? "has-search" : ""} ${compact ? "is-compact" : ""} ${navigationVisible ? "is-nav-visible" : ""}`}>
      {reel.isOwner ? creatorIdentity : <Link href={creatorProfileHref} aria-label={`Open ${reel.creatorName}'s profile`} data-testid={`link-reel-profile-${reel.id}`} className="inline-flex max-w-full no-underline">{creatorIdentity}</Link>}
      {!compact && reel.caption && <div className="reel-caption-wrap">
        <p className={`reel-caption ${captionExpanded ? "is-expanded" : ""}`} data-testid={`text-reel-caption-${reel.id}`}>{reel.caption}</p>
        {reel.caption.length > 96 && <button type="button" className="reel-caption-more" onClick={() => setCaptionExpanded((expanded) => !expanded)} aria-expanded={captionExpanded} data-testid={`button-reel-caption-more-${reel.id}`}>{captionExpanded ? "less" : "...more"}</button>}
      </div>}
    </div>
    {searchSuggestion && !compact && <button
      type="button"
      className={`reel-search-suggestion ${navigationVisible ? "" : "is-nav-hidden"}`}
      onClick={() => onSearchSuggestion(searchSuggestion)}
      aria-label={`Search Reels for ${searchSuggestion}`}
      data-testid={`button-reel-search-suggestion-${reel.id}`}
    >
      <Search size={17} aria-hidden="true" />
      <span>Search · {searchSuggestion}</span>
      <ChevronRight size={17} aria-hidden="true" />
    </button>}
    {!slideshow && <input
      className="reel-progress"
      type="range"
      min="0"
      max="100"
      step="0.1"
      value={progress}
      style={{ ["--reel-progress" as string]: `${progress}%` }}
      onChange={(event) => seekVideo(event.currentTarget.value)}
      aria-label={`Video progress for ${reel.creatorName}'s Reel`}
      aria-valuetext={`${Math.round(progress)}%`}
      data-testid={`input-reel-progress-${reel.id}`}
    />}
  </section>;
}
