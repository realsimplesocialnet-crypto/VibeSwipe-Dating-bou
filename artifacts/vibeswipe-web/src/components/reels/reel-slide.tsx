import { memo, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { Link } from "wouter";
import { getGetMediaPreviewQueryKey, useGetMediaPreview, type Reel } from "@workspace/api-client-react";
import { ChevronRight, MapPin, Music2, Pause, Play, Search } from "lucide-react";
import { VerifiedBadge } from "@/components/verified-badge";
import { ReelAvatar } from "@/components/reels/reel-avatar";
import { formatCount, reelMediaUrl } from "@/lib/reels";
import { reelSearchSuggestion } from "@/lib/reel-search-suggestion";
import { isOfflineReelWifi } from "@/lib/offline-reels";
import { QuietSpinner } from "@/components/ui/quiet-spinner";

type Props = {
  reel: Reel; index: number; active: boolean; near: boolean; posterEnabled: boolean;
  preload: "auto" | "metadata"; pageHidden: boolean;
  compact: boolean; navigationVisible: boolean; returnTo: string;
  likePending: boolean; savePending: boolean;
  onLike: (reel: Reel) => void; onComment: (reelId: string) => void;
  onShare: (reel: Reel) => void; onSave: (reel: Reel) => void;
  onSearchSuggestion: (query: string) => void;
  onView: (reel: Reel) => void;
  offlineSaved: boolean; onAutoCache: (reel: Reel) => void;
  onNavigateFeed: (direction: number) => void;
};

type ReelIconName = "like" | "comment" | "share" | "save";

function ReelActionIcon({ name }: { name: ReelIconName }) {
  if (name === "like") return <svg width="36" height="36" viewBox="0 0 24 24" className="drop-shadow-lg" aria-hidden="true">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" fill="currentColor" />
  </svg>;
  if (name === "comment") return <svg width="36" height="36" viewBox="0 0 24 24" className="drop-shadow-lg" aria-hidden="true">
    <path d="M12 2.8c-5.15 0-9.3 3.7-9.3 8.25 0 2.3 1.1 4.43 3.04 5.96L5 21l4.42-2.12c.82.23 1.68.35 2.58.35 5.15 0 9.3-3.7 9.3-8.25S17.15 2.8 12 2.8Z" fill="currentColor" />
    <circle cx="8.2" cy="11.1" r="1.05" fill="#17121a" />
    <circle cx="12" cy="11.1" r="1.05" fill="#17121a" />
    <circle cx="15.8" cy="11.1" r="1.05" fill="#17121a" />
  </svg>;
  if (name === "share") return <svg width="36" height="36" viewBox="0 0 24 24" className="drop-shadow-lg" aria-hidden="true">
    <path d="M15.2 3.6 22 10l-6.8 6.4v-3.5c-5.5 0-9.1 1.8-11.1 6.6.4-7.3 4.3-11.3 11.1-11.3V3.6Z" fill="currentColor" />
  </svg>;
  return <svg width="36" height="36" viewBox="0 0 24 24" className="drop-shadow-lg" aria-hidden="true">
    <path d="M6 3.5h12v17l-6-4-6 4v-17Z" fill="currentColor" />
  </svg>;
}

export const ReelSlide = memo(function ReelSlide({ reel, index, active, near, posterEnabled, preload, pageHidden, compact, navigationVisible, returnTo, likePending, savePending, onLike, onComment, onShare, onSave, onSearchSuggestion, onView, offlineSaved, onAutoCache, onNavigateFeed }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const progressInput = useRef<HTMLInputElement>(null);
  const soundtrackAudio = useRef<HTMLAudioElement>(null);
  const autoCacheRequested = useRef(false);
  const viewRecorded = useRef(false);
  const flashTimer = useRef<number | null>(null);
  const mediaTouch = useRef<{ x: number; y: number; axis: "undecided" | "horizontal" | "vertical" } | null>(null);
  const skipNextTap = useRef(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideDragOffset, setSlideDragOffset] = useState(0);
  const [draggingSlide, setDraggingSlide] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const slideshow = reel.mediaType === "slides" && reel.slideReferences.length > 1;
  const slideCount = reel.slideReferences.length;
  const videoMediaId = reel.mediaType === "video" && reel.videoReference.startsWith("media:")
    ? reel.videoReference.slice(6)
    : "";
  const shouldLoadPoster = Boolean(videoMediaId) && posterEnabled;
  const posterQuery = useGetMediaPreview(videoMediaId, {
    query: {
      enabled: shouldLoadPoster,
      queryKey: getGetMediaPreviewQueryKey(videoMediaId),
      staleTime: 5 * 60_000,
      gcTime: 5 * 60_000,
    },
  });
  const [posterUrl, setPosterUrl] = useState("");
  const [userPaused, setUserPaused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState<"play" | "pause" | null>(null);
  const progressValue = useRef(0);

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

  useEffect(() => {
    if (!posterQuery.data) return;
    const nextUrl = URL.createObjectURL(posterQuery.data);
    setPosterUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [posterQuery.data]);

  useEffect(() => () => {
    const element = video.current;
    if (!element) return;
    element.pause();
    element.removeAttribute("src");
    element.load();
    soundtrackAudio.current?.pause();
  }, []);

  useEffect(() => { if (!active) setUserPaused(false); }, [active]);
  useEffect(() => { updateProgress(0); setSlideIndex(0); setSlideDragOffset(0); setDraggingSlide(false); setReady(false); setCaptionExpanded(false); }, [reel.id]);
  useEffect(() => () => { if (flashTimer.current !== null) window.clearTimeout(flashTimer.current); }, []);
  useEffect(() => {
    const audio = soundtrackAudio.current;
    if (!audio) return;
    if (!reel.soundtrack || !active || pageHidden || userPaused || failed || blocked) {
      audio.pause();
      if (!active || pageHidden) audio.currentTime = 0;
      return;
    }
    if (audio.paused) void audio.play().catch(() => undefined);
  }, [active, pageHidden, userPaused, failed, blocked, reel.soundtrack?.id]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (!active || pageHidden || userPaused || failed) { element.pause(); soundtrackAudio.current?.pause(); return; }
    element.muted = false;
    const attempt = element.play();
    if (attempt) attempt.then(() => setBlocked(false)).catch((error: unknown) => {
      const name = (error as { name?: string }).name;
      if (name !== "AbortError") setBlocked(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pageHidden, userPaused, failed, near]);

  function togglePlayback() {
    const element = video.current;
    if ((!element && !slideshow) || failed) return;
    if (slideshow) {
      if (!reel.soundtrack) return;
      if (userPaused || blocked) {
        setUserPaused(false);
        setBlocked(false);
        const audio = soundtrackAudio.current;
        if (audio) void audio.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
        showFlash("play");
      } else {
        setUserPaused(true);
        soundtrackAudio.current?.pause();
        showFlash("pause");
      }
      return;
    }
    if (!element) return;
    if (blocked || element.paused) {
      setUserPaused(false);
      setBlocked(false);
      element.muted = false;
      void element.play().then(() => setBlocked(false)).catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") setBlocked(true);
      });
      if (reel.soundtrack && soundtrackAudio.current) {
        void soundtrackAudio.current.play().catch(() => undefined);
      }
      showFlash("play");
    } else {
      setUserPaused(true);
      element.pause();
      soundtrackAudio.current?.pause();
      showFlash("pause");
    }
  }

  function showFlash(next: "play" | "pause") {
    setFlash(next);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => { flashTimer.current = null; setFlash(null); }, 520);
  }

  function handleVideoTap() {
    togglePlayback();
  }

  function startMediaTouch(event: ReactTouchEvent<HTMLButtonElement>) {
    const touch = event.changedTouches[0];
    mediaTouch.current = touch ? { x: touch.clientX, y: touch.clientY, axis: "undecided" } : null;
    setSlideDragOffset(0);
    setDraggingSlide(false);
  }

  function moveMediaTouch(event: ReactTouchEvent<HTMLButtonElement>) {
    const start = mediaTouch.current;
    const touch = event.touches[0];
    if (!slideshow || !start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (start.axis === "undecided" && Math.max(absX, absY) > 12) {
      if (absX >= absY * 1.2) start.axis = "horizontal";
      else if (absY > 28 && absY >= absX * 1.4) start.axis = "vertical";
      if (start.axis === "horizontal") {
        setDraggingSlide(true);
        skipNextTap.current = true;
      }
      if (start.axis === "vertical") skipNextTap.current = true;
    }
    if (start.axis === "horizontal") {
      event.preventDefault();
      setSlideDragOffset(dx);
    }
  }

  function finishMediaTouch(event: ReactTouchEvent<HTMLButtonElement>) {
    const start = mediaTouch.current;
    mediaTouch.current = null;
    const touch = event.changedTouches[0];
    if (!slideshow || !start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const horizontalSwipe = start.axis === "horizontal" || (absX > 24 && absX >= absY * 1.2);
    const verticalSwipe = start.axis === "vertical" || (absY > 24 && absY >= absX * 1.2);
    if (horizontalSwipe) {
      event.preventDefault();
      const threshold = Math.max(28, Math.min(72, window.innerWidth * 0.14));
      const direction = absX >= threshold ? (dx < 0 ? 1 : -1) : 0;
      skipNextTap.current = true;
      if (direction) setSlideIndex((current) => Math.max(0, Math.min(slideCount - 1, current + direction)));
      setSlideDragOffset(0);
      setDraggingSlide(false);
      window.setTimeout(() => { skipNextTap.current = false; }, 350);
      return;
    }
    if (verticalSwipe) {
      const threshold = Math.max(56, Math.min(96, window.innerHeight * 0.09));
      const direction = absY >= threshold ? (dy < 0 ? 1 : -1) : 0;
      skipNextTap.current = true;
      if (direction) onNavigateFeed(direction);
      window.setTimeout(() => { skipNextTap.current = false; }, 350);
    }
    setSlideDragOffset(0);
    setDraggingSlide(false);
  }

  function cancelMediaTouch() {
    mediaTouch.current = null;
    skipNextTap.current = false;
    setSlideDragOffset(0);
    setDraggingSlide(false);
  }

  function moveSlideTo(next: number) {
    setSlideIndex(Math.max(0, Math.min(slideCount - 1, next)));
  }

  function retry() {
    setFailed(false);
    setReady(false);
    video.current?.load();
  }

  function updateProgress(value: number) {
    const next = Math.min(100, Math.max(0, value));
    progressValue.current = next;
    const input = progressInput.current;
    if (!input) return;
    input.value = String(next);
    input.style.setProperty("--reel-progress", `${next}%`);
    input.setAttribute("aria-valuetext", `${Math.round(next)}%`);
  }

  function seekVideo(value: string) {
    const element = video.current;
    if (!element || !Number.isFinite(element.duration) || element.duration <= 0) return;
    const nextProgress = Math.min(100, Math.max(0, Number(value)));
    element.currentTime = (nextProgress / 100) * element.duration;
    updateProgress(nextProgress);
  }

  const src = reelMediaUrl(reel.videoReference);
  const tapLabel = slideshow
    ? `${slideCount > 1 ? `Photo slideshow, ${slideIndex + 1} of ${slideCount}. Swipe left or right to browse.` : "Photo Reel."} Swipe up for the next Reel or down for the previous Reel.${reel.soundtrack ? " Tap to play or pause the soundtrack." : ""}`
    : `${userPaused || blocked ? "Tap to play" : "Tap to pause"} Reel. Video audio plays automatically.`;
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
        <div className="reel-photo-track" style={{
          width: `${slideCount * 100}%`,
          transform: `translate3d(calc(-${slideIndex * 100 / slideCount}% + ${slideDragOffset}px),0,0)`,
          transition: draggingSlide ? "none" : undefined,
        }}>
          {reel.slideReferences.map((reference, slide) => <img
            key={`${reference}-${slide}`}
            src={reelMediaUrl(reference)}
            alt=""
            className="reel-photo-slide"
            style={{ width: `${100 / slideCount}%` }}
            loading={Math.abs(slide - slideIndex) <= 1 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={slide === slideIndex && active ? "high" : "auto"}
            draggable={false}
          />)}
        </div>
      </div>
      : <video
      ref={video}
      src={reel.mediaType === "video" && (active || near) ? src : undefined}
      poster={posterUrl || undefined}
      className="reel-video"
      playsInline muted={false} loop
      preload={preload}
      onLoadedData={() => setReady(true)}
      onError={() => { if (near) setFailed(true); }}
      onPlaying={(event) => {
        const element = event.currentTarget;
        if (!viewRecorded.current && !element.paused) {
          viewRecorded.current = true;
          onView(reel);
        }
      }}
      onTimeUpdate={(event) => {
        const element = event.currentTarget;
        if (element.duration) updateProgress((element.currentTime / element.duration) * 100);
        if (element.duration && element.currentTime / element.duration >= 0.85 && !autoCacheRequested.current && isOfflineReelWifi() && !offlineSaved) {
          autoCacheRequested.current = true;
          onAutoCache(reel);
        }
      }}
      data-testid={`video-reel-${reel.id}`}
    />}
    {reel.soundtrack ? <audio
      ref={soundtrackAudio}
      src={reel.soundtrack.audioUrl}
      loop
      preload={active ? "metadata" : "none"}
      aria-hidden="true"
      tabIndex={-1}
      data-testid={`audio-reel-soundtrack-${reel.id}`}
    /> : null}
    {!slideshow && !ready && !posterUrl && !failed && <div className="reel-loading" aria-hidden="true" />}
    {blocked && active && !pageHidden && !failed && <div className="reel-autoplay-prompt" role="status">Tap the video to play with sound</div>}
    <button type="button" className={`reel-tap ${slideshow ? "is-slideshow" : ""}`} onTouchStart={startMediaTouch} onTouchMove={moveMediaTouch} onTouchEnd={finishMediaTouch} onTouchCancel={cancelMediaTouch} onClick={() => { if (skipNextTap.current) { skipNextTap.current = false; return; } handleVideoTap(); }} aria-label={tapLabel} aria-pressed={!slideshow && !userPaused && !blocked} data-testid={`button-toggle-reel-playback-${reel.id}`} />
    {slideshow && <div className="reel-slide-counter" aria-live="polite" data-testid={`text-reel-slide-count-${reel.id}`}>{slideIndex + 1}/{slideCount}</div>}
    {slideshow && <div className="reel-slide-dots" role="group" aria-label="Choose photo slide">{reel.slideReferences.map((_, slide) => <button key={slide} type="button" onClick={() => moveSlideTo(slide)} aria-label={`Show photo ${slide + 1}`} aria-current={slide === slideIndex ? "step" : undefined} data-testid={`button-reel-slide-${reel.id}-${slide + 1}`} />)}</div>}
    {flash && <span className="reel-flash" aria-hidden="true">{flash === "play" ? <Play size={34} fill="currentColor" /> : <Pause size={34} fill="currentColor" />}</span>}
    {failed && <div className="reel-blocked" role="status" aria-label="Loading video"><QuietSpinner onRetry={retry} /></div>}
    <div className="reel-shade" aria-hidden="true" />

    <div className={`reel-rail ${compact ? "is-compact" : ""} ${navigationVisible ? "is-nav-visible" : ""} ${searchSuggestion && !compact ? "has-search" : ""}`}>
      <button type="button" className={`reel-action-button ${reel.likedByMe ? "is-on" : ""}`} onClick={() => onLike(reel)} disabled={likePending} aria-pressed={reel.likedByMe} aria-label={reel.likedByMe ? "Unlike" : "Like"} data-testid={`button-like-reel-${reel.id}`}>
        <ReelActionIcon name="like" /><span data-testid={`text-like-count-${reel.id}`}>{formatCount(reel.likeCount)}</span>
      </button>
      <button type="button" className="reel-action-button" onClick={() => onComment(reel.id)} aria-label="Comments" data-testid={`button-comments-reel-${reel.id}`}>
        <ReelActionIcon name="comment" /><span data-testid={`text-comment-count-${reel.id}`}>{formatCount(reel.commentCount)}</span>
      </button>
      <button type="button" className={`reel-action-button ${reel.savedByMe ? "is-saved" : ""}`} onClick={() => onSave(reel)} disabled={savePending} aria-pressed={reel.savedByMe} aria-label={reel.savedByMe ? "Remove from Saved Reels" : "Save Reel"} data-testid={`button-save-reel-${reel.id}`}>
        <ReelActionIcon name="save" /><span data-testid={`text-save-count-${reel.id}`}>{formatCount(reel.saveCount)}</span>
      </button>
      <button type="button" className="reel-action-button" onClick={() => onShare(reel)} aria-label={`Share, ${formatCount(reel.shareCount)} shares`} data-testid={`button-share-reel-${reel.id}`}><ReelActionIcon name="share" /><span data-testid={`text-share-count-${reel.id}`}>{formatCount(reel.shareCount)}</span></button>
    </div>

    <div className={`reel-meta ${searchSuggestion && !compact ? "has-search" : ""} ${compact ? "is-compact" : ""} ${navigationVisible ? "is-nav-visible" : ""}`}>
      {reel.isOwner ? creatorIdentity : <Link href={creatorProfileHref} aria-label={`Open ${reel.creatorName}'s profile`} data-testid={`link-reel-profile-${reel.id}`} className="inline-flex max-w-full no-underline">{creatorIdentity}</Link>}
      {!compact && reel.caption && <div className="reel-caption-wrap">
        <p className={`reel-caption ${captionExpanded ? "is-expanded" : ""}`} data-testid={`text-reel-caption-${reel.id}`}>{reel.caption}</p>
        {reel.caption.length > 96 && <button type="button" className="reel-caption-more" onClick={() => setCaptionExpanded((expanded) => !expanded)} aria-expanded={captionExpanded} data-testid={`button-reel-caption-more-${reel.id}`}>{captionExpanded ? "less" : "...more"}</button>}
      </div>}
      {!compact && reel.soundtrack && <div className="reel-track-credit" aria-label={reel.soundtrack.attribution}>
        <Music2 size={12} aria-hidden="true"/>
        <a href={reel.soundtrack.sourceUrl} target="_blank" rel="noreferrer">{reel.soundtrack.title} · {reel.soundtrack.artist}</a>
        <a href={reel.soundtrack.licenseUrl} target="_blank" rel="noreferrer">{reel.soundtrack.license}</a>
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
      ref={progressInput}
      className="reel-progress"
      type="range"
      min="0"
      max="100"
      step="0.1"
      defaultValue={0}
      onChange={(event) => seekVideo(event.currentTarget.value)}
      aria-label={`Video progress for ${reel.creatorName}'s Reel`}
      aria-valuetext={`${Math.round(progressValue.current)}%`}
      data-testid={`input-reel-progress-${reel.id}`}
    />}
  </section>;
});

ReelSlide.displayName = "ReelSlide";
