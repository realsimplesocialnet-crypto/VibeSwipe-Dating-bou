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
  compact: boolean; showHint: boolean; returnTo: string;
  onLike: () => void; onComment: () => void; onShare: () => void; onSave: () => void; onDelete: () => void;
  offlineSaved: boolean; offlineSaving: boolean; onSaveOffline: () => void; onAutoCache: () => void;
};

export function ReelSlide({ reel, index, active, near, muted, pageHidden, compact, showHint, returnTo, onLike, onComment, onShare, onSave, onDelete, offlineSaved, offlineSaving, onSaveOffline, onAutoCache }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const autoCacheRequested = useRef(false);
  const [userPaused, setUserPaused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState<"play" | "pause" | null>(null);

  useEffect(() => { if (!active) setUserPaused(false); }, [active]);
  useEffect(() => { if (video.current) video.current.muted = muted; }, [muted]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (!active || pageHidden || userPaused || failed) { element.pause(); return; }
    element.muted = muted;
    const attempt = element.play();
    if (attempt) attempt.then(() => setBlocked(false)).catch((error: unknown) => {
      // Browsers may refuse autoplay (data saver, power saving). Say so and wait for a tap.
      if ((error as { name?: string }).name !== "AbortError") setBlocked(true);
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
      void element.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
      setFlash("play");
    } else {
      setUserPaused(true);
      element.pause();
      setFlash("pause");
    }
    window.setTimeout(() => setFlash(null), 520);
  }

  function retry() {
    setFailed(false);
    setReady(false);
    video.current?.load();
  }

  const src = reelMediaUrl(reel.videoReference);
  const paused = userPaused || blocked;
  return <section className="reel-slide" data-index={index} data-testid={`reel-slide-${reel.id}`} aria-roledescription="Reel" aria-label={`Reel by ${reel.creatorName}`}>
    <video
      ref={video}
      src={active || near ? src : undefined}
      className="reel-video"
      playsInline muted loop
      preload={active ? "auto" : "metadata"}
      onLoadedData={() => setReady(true)}
      onError={() => { if (near) setFailed(true); }}
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
    <button type="button" className="reel-tap" onClick={togglePlayback} aria-label={paused ? "Play Reel" : "Pause Reel"} data-testid={`button-toggle-play-${reel.id}`} />
    {flash && <span className="reel-flash" aria-hidden="true">{flash === "play" ? <Play size={34} fill="currentColor" /> : <Pause size={34} fill="currentColor" />}</span>}
    {active && blocked && !failed && <button type="button" onClick={togglePlayback} className="reel-blocked" data-testid="button-reel-autoplay-blocked">
      <Play size={20} fill="currentColor" /><span>Your browser paused autoplay. Tap to play.</span>
    </button>}
    {failed && <div className="reel-blocked" role="alert"><span>This video could not load.</span><button type="button" onClick={retry} className="reel-pill" data-testid={`button-retry-reel-${reel.id}`}>Try again</button></div>}
    <div className="reel-shade" aria-hidden="true" />

    <div className={`reel-rail ${compact ? "is-compact" : ""}`}>
      <button type="button" onClick={onLike} aria-pressed={reel.likedByMe} aria-label={reel.likedByMe ? "Unlike" : "Like"} data-testid={`button-like-reel-${reel.id}`} className={reel.likedByMe ? "is-on" : ""}>
        <Heart size={29} strokeWidth={1.8} fill={reel.likedByMe ? "currentColor" : "none"} /><span data-testid={`text-like-count-${reel.id}`}>{formatCount(reel.likeCount)}</span>
      </button>
      <button type="button" onClick={onComment} aria-label="Comments" data-testid={`button-comments-reel-${reel.id}`}>
        <MessageCircle size={28} strokeWidth={1.8} /><span data-testid={`text-comment-count-${reel.id}`}>{formatCount(reel.commentCount)}</span>
      </button>
      <button type="button" onClick={onShare} aria-label="Share" data-testid={`button-share-reel-${reel.id}`}><Send size={27} strokeWidth={1.8} /></button>
      <button type="button" onClick={onSave} aria-pressed={reel.savedByMe} aria-label={reel.savedByMe ? "Remove from saved" : "Save"} data-testid={`button-save-reel-${reel.id}`} className={reel.savedByMe ? "is-saved" : ""}>
        <Bookmark size={28} strokeWidth={1.8} fill={reel.savedByMe ? "currentColor" : "none"} />
      </button>
      <button type="button" onClick={onSaveOffline} disabled={offlineSaved || offlineSaving} aria-label={offlineSaved ? "Saved for offline replay" : offlineSaving ? "Saving video offline" : "Save video offline"} data-testid={`button-save-reel-offline-${reel.id}`} className={offlineSaved ? "is-saved" : ""}>
        {offlineSaved ? <Check size={25} strokeWidth={2}/> : <Download size={25} strokeWidth={1.8}/>}
      </button>
      {reel.isOwner && <button type="button" onClick={onDelete} aria-label="Delete your Reel" data-testid={`button-delete-reel-${reel.id}`}><Trash2 size={24} strokeWidth={1.8} /></button>}
    </div>

    <div className={`reel-meta ${compact ? "is-compact" : ""}`}>
      <div className="flex items-center gap-3">
        <ReelAvatar reference={reel.creatorPhoto} name={reel.creatorName} size={compact ? 38 : 52} />
        <div className="min-w-0">
          <p className="reel-name" data-testid={`text-reel-creator-${reel.id}`}>{reel.creatorName}{reel.creatorAge !== null && <span className="reel-age">, {reel.creatorAge}</span>}<VerifiedBadge verified={reel.creatorVerified} /></p>
          {reel.creatorLocation && <p className="reel-location"><MapPin size={14} className="shrink-0 text-primary" /><span className="truncate">{reel.creatorLocation}</span></p>}
        </div>
      </div>
      {!compact && reel.caption && <p className="reel-caption" data-testid={`text-reel-caption-${reel.id}`}>{reel.caption}</p>}
      {!compact && !reel.isOwner && <Link href={`/profile/${reel.creatorId}?returnTo=${encodeURIComponent(returnTo)}`} className="reel-pill mt-3" data-testid={`link-reel-profile-${reel.id}`}>View profile</Link>}
      {!compact && showHint && <p className="reel-hint">Swipe up for more</p>}
    </div>
    <div className="reel-progress" aria-hidden="true"><div ref={bar} /></div>
  </section>;
}
