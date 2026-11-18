import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import type { Reel } from "@workspace/api-client-react";
import { Bookmark, Heart, MapPin, MessageCircle, Pause, Play, Search, Send, Volume2, VolumeX } from "lucide-react";
import { VerifiedBadge } from "@/components/verified-badge";
import { ReelAvatar } from "@/components/reels/reel-avatar";
import { formatCount, reelMediaUrl } from "@/lib/reels";
import { isOfflineReelWifi } from "@/lib/offline-reels";

type Props = {
  reel: Reel; index: number; active: boolean; near: boolean; muted: boolean; pageHidden: boolean;
  compact: boolean; navigationVisible: boolean; returnTo: string; searchSuggestion: string;
  likePending: boolean; savePending: boolean;
  onAutoplayMuted: () => void; onToggleSound: () => void;
  onLike: () => void; onComment: () => void; onShare: () => void; onSave: () => void; onSearchSuggestion: (query: string) => void;
  onView: () => void;
  offlineSaved: boolean; onAutoCache: () => void;
};

export function ReelSlide({ reel, index, active, near, muted, pageHidden, compact, navigationVisible, returnTo, searchSuggestion, likePending, savePending, onAutoplayMuted, onToggleSound, onLike, onComment, onShare, onSave, onSearchSuggestion, onView, offlineSaved, onAutoCache }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const autoCacheRequested = useRef(false);
  const viewRecorded = useRef(false);
  const flashTimer = useRef<number | null>(null);
  const lastVideoTap = useRef<{ at: number; wasPlaying: boolean } | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<"play" | "pause" | "sound-on" | "sound-off" | null>(null);

  useEffect(() => { if (!active) setUserPaused(false); }, [active]);
  useEffect(() => { setProgress(0); }, [reel.id]);
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
  const creatorIdentity = <span className="reel-identity flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
    <span className="reel-creator-avatar-ring" data-testid={`reel-creator-avatar-${reel.id}`}>
      {near
        ? <ReelAvatar reference={reel.creatorPhoto} name={reel.creatorName} size={54} />
        : <span className="reel-avatar" style={{ width: 54, height: 54 }} aria-hidden="true">{reel.creatorName.trim().charAt(0).toUpperCase() || "M"}</span>}
    </span>
    <span className="min-w-0">
      <span className="reel-name" data-testid={`text-reel-creator-${reel.id}`}>{reel.creatorName}{reel.creatorAge !== null && <span className="reel-age">, {reel.creatorAge}</span>}<VerifiedBadge verified={reel.creatorVerified} /></span>
      {reel.creatorLocation && <span className="reel-location"><MapPin size={14} className="shrink-0 text-primary" /><span className="truncate">{reel.creatorLocation}</span></span>}
    </span>
  </span>;
  return <section className="reel-slide" data-index={index} data-testid={`reel-slide-${reel.id}`} aria-roledescription="Reel" aria-label={`Reel by ${reel.creatorName}`}>
    <video
      ref={video}
      src={active || near ? src : undefined}
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
    />
    {!ready && !failed && <div className="reel-loading" aria-hidden="true" />}
    <button type="button" className="reel-tap" onClick={handleVideoTap} aria-label={`${userPaused || blocked ? "Play" : "Pause"} Reel. Double-tap to ${muted ? "turn sound on" : "mute"}.`} aria-pressed={!userPaused && !blocked} data-testid={`button-toggle-reel-playback-${reel.id}`} />
    {active && <button type="button" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-full focus:bg-black/80 focus:p-3 focus:text-white" onClick={toggleSound} aria-label={muted ? "Turn Reel sound on" : "Mute Reel"} data-testid={`button-toggle-reel-sound-accessible-${reel.id}`} />}
    {flash && <span className="reel-flash" aria-hidden="true">{flash === "play" ? <Play size={34} fill="currentColor" /> : flash === "pause" ? <Pause size={34} fill="currentColor" /> : flash === "sound-on" ? <Volume2 size={34} /> : <VolumeX size={34} />}</span>}
    {failed && <div className="reel-blocked" role="alert"><span>This video could not load.</span><button type="button" onClick={retry} className="reel-pill" data-testid={`button-retry-reel-${reel.id}`}>Try again</button></div>}
    <div className="reel-shade" aria-hidden="true" />

    <div className={`reel-rail ${compact ? "is-compact" : ""} ${navigationVisible ? "is-nav-visible" : ""}`}>
      <button type="button" onClick={onLike} disabled={likePending} aria-pressed={reel.likedByMe} aria-label={reel.likedByMe ? "Unlike" : "Like"} data-testid={`button-like-reel-${reel.id}`} className={reel.likedByMe ? "is-on" : ""}>
        <Heart size={28} strokeWidth={1.8} fill={reel.likedByMe ? "currentColor" : "none"} /><span data-testid={`text-like-count-${reel.id}`}>{formatCount(reel.likeCount)}</span>
      </button>
      <button type="button" onClick={onComment} aria-label="Comments" data-testid={`button-comments-reel-${reel.id}`}>
        <MessageCircle size={28} strokeWidth={1.8} /><span data-testid={`text-comment-count-${reel.id}`}>{formatCount(reel.commentCount)}</span>
      </button>
      <button type="button" onClick={onShare} aria-label={`Share, ${formatCount(reel.shareCount)} shares`} data-testid={`button-share-reel-${reel.id}`}><Send size={28} strokeWidth={1.8} /><span data-testid={`text-share-count-${reel.id}`}>{formatCount(reel.shareCount)}</span></button>
      <button type="button" onClick={onSave} disabled={savePending} aria-pressed={reel.savedByMe} aria-label={reel.savedByMe ? "Remove from saved" : "Save"} data-testid={`button-save-reel-${reel.id}`} className={reel.savedByMe ? "is-saved" : ""}>
        <Bookmark size={28} strokeWidth={1.8} fill={reel.savedByMe ? "currentColor" : "none"} /><span>Save</span>
      </button>
    </div>

    <div className={`reel-meta ${compact ? "is-compact" : ""} ${navigationVisible ? "is-nav-visible" : ""}`}>
      {searchSuggestion && !compact && <button
        type="button"
        className="reel-search-suggestion"
        aria-label={`Search Reels for ${searchSuggestion}`}
        data-testid={`button-reel-search-suggestion-${reel.id}`}
        onClick={() => onSearchSuggestion(searchSuggestion)}
      >
        <Search size={16} strokeWidth={2.1} />
        <span>Search “{searchSuggestion}”</span>
      </button>}
      {reel.isOwner ? creatorIdentity : <Link href={creatorProfileHref} aria-label={`Open ${reel.creatorName}'s profile`} data-testid={`link-reel-profile-${reel.id}`} className="inline-flex max-w-full no-underline">{creatorIdentity}</Link>}
      {!compact && reel.caption && <p className="reel-caption" data-testid={`text-reel-caption-${reel.id}`}>{reel.caption}</p>}
    </div>
    <input
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
    />
  </section>;
}
