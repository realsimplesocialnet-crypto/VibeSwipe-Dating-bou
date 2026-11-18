import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import type { Reel } from "@workspace/api-client-react";
import { Bookmark, Check, Download, Heart, MapPin, MessageCircle, Pause, Play, Send, Trash2 } from "lucide-react";
import { VerifiedBadge } from "@/components/verified-badge";
import { ReelAvatar } from "@/components/reels/reel-avatar";
import { formatCount, reelMediaUrl } from "@/lib/reels";
import { isOfflineReelWifi } from "@/lib/offline-reels";

type Props = {
  reel: Reel; index: number; active: boolean; near: boolean; muted: boolean; pageHidden: boolean;
  compact: boolean; navigationVisible: boolean; showHint: boolean; returnTo: string;
  likePending: boolean; savePending: boolean;
  onAutoplayMuted: () => void;
  onLike: () => void; onComment: () => void; onShare: () => void; onSave: () => void; onDelete: () => void;
  onView: () => void;
  offlineSaved: boolean; offlineSaving: boolean; onSaveOffline: () => void; onAutoCache: () => void;
};

export function ReelSlide({ reel, index, active, near, muted, pageHidden, compact, navigationVisible, showHint, returnTo, likePending, savePending, onAutoplayMuted, onLike, onComment, onShare, onSave, onDelete, onView, offlineSaved, offlineSaving, onSaveOffline, onAutoCache }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const autoCacheRequested = useRef(false);
  const viewRecorded = useRef(false);
  const flashTimer = useRef<number | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState<"play" | "pause" | null>(null);

  useEffect(() => { if (!active) setUserPaused(false); }, [active]);
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
        // iPhone permits inline autoplay when muted. A real tap on the sound
        // control can enable audio afterward without restarting the Reel.
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
      setFlash("play");
    } else {
      setUserPaused(true);
      element.pause();
      setFlash("pause");
    }
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => { flashTimer.current = null; setFlash(null); }, 520);
  }

  function retry() {
    setFailed(false);
    setReady(false);
    video.current?.load();
  }

  const src = reelMediaUrl(reel.videoReference);
  const paused = userPaused || blocked;
  const reelReturnParams = new URLSearchParams({ returnTo });
  const creatorProfileReturn = `/reels/${encodeURIComponent(reel.id)}?${reelReturnParams.toString()}`;
  const creatorProfileHref = `/profile/${encodeURIComponent(reel.creatorId)}?returnTo=${encodeURIComponent(creatorProfileReturn)}`;
  const creatorIdentity = <span className="reel-identity flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
    <ReelAvatar reference={reel.creatorPhoto} name={reel.creatorName} size={compact ? 36 : 46} />
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
        if (bar.current && element.duration) bar.current.style.transform = `scaleX(${element.currentTime / element.duration})`;
        if (element.duration && element.currentTime / element.duration >= 0.85 && !autoCacheRequested.current && isOfflineReelWifi() && !offlineSaved) {
          autoCacheRequested.current = true;
          onAutoCache();
        }
      }}
      data-testid={`video-reel-${reel.id}`}
    />
    {!ready && !failed && <div className="reel-loading" aria-hidden="true" />}
    <button type="button" className="reel-tap" onClick={togglePlayback} aria-label={userPaused || blocked ? "Play Reel" : "Pause Reel"} aria-pressed={!userPaused && !blocked} data-testid={`button-toggle-reel-playback-${reel.id}`} />
    {flash && <span className="reel-flash" aria-hidden="true">{flash === "play" ? <Play size={34} fill="currentColor" /> : <Pause size={34} fill="currentColor" />}</span>}
    {active && blocked && !failed && <button type="button" onClick={togglePlayback} aria-label="Play Reel" className="reel-blocked reel-blocked-play" data-testid="button-reel-autoplay-blocked">
      <Play size={26} fill="currentColor" />
    </button>}
    {failed && <div className="reel-blocked" role="alert"><span>This video could not load.</span><button type="button" onClick={retry} className="reel-pill" data-testid={`button-retry-reel-${reel.id}`}>Try again</button></div>}
    <div className="reel-shade" aria-hidden="true" />

    <div className={`reel-rail ${compact ? "is-compact" : ""} ${navigationVisible ? "is-nav-visible" : ""}`}>
      <button type="button" onClick={onLike} disabled={likePending} aria-pressed={reel.likedByMe} aria-label={reel.likedByMe ? "Unlike" : "Like"} data-testid={`button-like-reel-${reel.id}`} className={reel.likedByMe ? "is-on" : ""}>
        <Heart size={29} strokeWidth={1.8} fill={reel.likedByMe ? "currentColor" : "none"} /><span data-testid={`text-like-count-${reel.id}`}>{formatCount(reel.likeCount)}</span>
      </button>
      <button type="button" onClick={onComment} aria-label="Comments" data-testid={`button-comments-reel-${reel.id}`}>
        <MessageCircle size={28} strokeWidth={1.8} /><span data-testid={`text-comment-count-${reel.id}`}>{formatCount(reel.commentCount)}</span>
      </button>
      <button type="button" onClick={onShare} aria-label={`Share, ${formatCount(reel.shareCount)} shares`} data-testid={`button-share-reel-${reel.id}`}><Send size={27} strokeWidth={1.8} /><span data-testid={`text-share-count-${reel.id}`}>{formatCount(reel.shareCount)}</span></button>
      <button type="button" onClick={onSave} disabled={savePending} aria-pressed={reel.savedByMe} aria-label={reel.savedByMe ? "Remove from saved" : "Save"} data-testid={`button-save-reel-${reel.id}`} className={reel.savedByMe ? "is-saved" : ""}>
        <Bookmark size={28} strokeWidth={1.8} fill={reel.savedByMe ? "currentColor" : "none"} /><span data-testid={`text-save-count-${reel.id}`}>{formatCount(reel.saveCount)}</span>
      </button>
      <button type="button" onClick={onSaveOffline} disabled={offlineSaved || offlineSaving} aria-label={offlineSaved ? "Saved for offline replay" : offlineSaving ? "Saving video offline" : "Save video offline"} data-testid={`button-save-reel-offline-${reel.id}`} className={offlineSaved ? "is-saved" : ""}>
        {offlineSaved ? <Check size={25} strokeWidth={2}/> : <Download size={25} strokeWidth={1.8}/>}
      </button>
      {reel.isOwner && <button type="button" onClick={onDelete} aria-label="Delete your Reel" data-testid={`button-delete-reel-${reel.id}`}><Trash2 size={24} strokeWidth={1.8} /></button>}
      <div className="reel-music-slot" aria-hidden="true" data-testid={`reel-music-artwork-slot-${reel.id}`}>
        <ReelAvatar reference={reel.creatorPhoto} name={reel.creatorName} size={38} />
      </div>
    </div>

    <div className={`reel-meta ${compact ? "is-compact" : ""} ${navigationVisible ? "is-nav-visible" : ""}`}>
      {reel.isOwner ? creatorIdentity : <Link href={creatorProfileHref} aria-label={`Open ${reel.creatorName}'s profile`} data-testid={`link-reel-profile-${reel.id}`} className="inline-flex max-w-full no-underline">{creatorIdentity}</Link>}
      {!compact && reel.caption && <p className="reel-caption" data-testid={`text-reel-caption-${reel.id}`}>{reel.caption}</p>}
      {!compact && showHint && <p className="reel-hint">Swipe up for more</p>}
    </div>
    <div className="reel-progress" aria-hidden="true"><div ref={bar} /></div>
  </section>;
}
