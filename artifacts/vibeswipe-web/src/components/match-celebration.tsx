import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getGetProfileMediaQueryKey, useGetProfileMedia, type Profile } from "@workspace/api-client-react";
import { Heart, MessageCircle, UserRound } from "lucide-react";
import "./match-celebration.css";

export type MatchCelebrationProps = {
  visible: boolean;
  self: Profile | null;
  other: Profile | null;
  canMessage: boolean;
  onMessage: () => void;
  onKeepSwiping: () => void;
};

function publicUrl(ref: string) {
  if (ref.startsWith("http")) return ref;
  return "";
}

function MatchPhoto({ profile, variant }: { profile: Profile | null; variant: "self" | "other" }) {
  const ref = profile?.photos?.[0] ?? "";
  const mediaId = ref.startsWith("media:") ? ref.slice(6) : "";
  const media = useGetProfileMedia(mediaId, { query: { enabled: Boolean(mediaId), queryKey: getGetProfileMediaQueryKey(mediaId) } });
  const [objectUrl, setObjectUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const data = media.data as unknown;
    if (!(data instanceof Blob)) return;
    const url = URL.createObjectURL(data);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [media.data]);
  const src = mediaId ? objectUrl : publicUrl(ref);
  const initial = profile?.name?.trim().slice(0, 1).toUpperCase();
  return (
    <div className={`mc-photo ${variant}`} data-testid={`img-match-${variant}`}>
      {src && !failed
        ? <img src={src} alt={profile ? `${profile.name}${variant === "self" ? " (you)" : ""}` : ""} onError={() => setFailed(true)} />
        : initial ? <span aria-hidden="true">{initial}</span> : <UserRound size={56} aria-hidden="true" />}
    </div>
  );
}

export function MatchCelebration({ visible, self, other, canMessage, onMessage, onKeepSwiping }: MatchCelebrationProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onKeepSwiping);
  closeRef.current = onKeepSwiping;

  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => (primaryRef.current && !primaryRef.current.disabled ? primaryRef.current : keepRef.current)?.focus(), 30);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== "Tab" || !rootRef.current) return;
      const items = Array.from(rootRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [visible]);

  if (!visible || typeof document === "undefined") return null;
  const name = other?.name?.trim() || "your match";

  return createPortal(
    <div ref={rootRef} className="mc-root" role="dialog" aria-modal="true" aria-labelledby="match-celebration-title" aria-describedby="match-celebration-sub" data-testid="match-celebration">
      <div className="mc-inner">
        <div className="mc-top">
          <Heart className="mc-small-heart" size={26} fill="currentColor" aria-hidden="true" />
          <h2 id="match-celebration-title" className="mc-title">It’s a match!</h2>
          <div className="mc-pair">
            <MatchPhoto profile={self} variant="self" />
            <MatchPhoto profile={other} variant="other" />
            <div className="mc-heart" aria-hidden="true"><Heart size={24} fill="currentColor" /></div>
          </div>
          <p id="match-celebration-sub" className="mc-sub" data-testid="text-match-subtitle">You and <strong>{name}</strong> liked each other.</p>
        </div>
        <div className="mc-actions">
          <button ref={primaryRef} type="button" className="mc-btn primary" onClick={onMessage} disabled={!canMessage} data-testid="match-send-message">
            <MessageCircle size={20} aria-hidden="true" />Send a message
          </button>
          {!canMessage && <p className="mc-note" role="status">Chat is getting ready. Find it in Matches shortly.</p>}
          <button ref={keepRef} type="button" className="mc-btn secondary" onClick={onKeepSwiping} data-testid="match-keep-swiping">Keep swiping</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
