import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetMyReelsQueryKey, getGetReelQueryKey, getGetReelsFeedQueryKey, getGetSavedReelsQueryKey, getReelsFeed,
  useDeleteReel, useGetReel, useLikeReel, useSaveReel, useUnlikeReel, useUnsaveReel, type Reel,
} from "@workspace/api-client-react";
import { ArrowLeft, Bookmark, Clapperboard, Plus, Volume2, VolumeX } from "lucide-react";
import { ReelSlide } from "@/components/reels/reel-slide";
import { ReelComments } from "@/components/reels/reel-comments";
import { ReelShareSheet } from "@/components/reels/reel-share-sheet";
import { safeReelReturnPath } from "@/lib/reels";
import { reelSlideIndex, reelsViewportFrame } from "@/lib/reels-viewport";
import "@/components/reels/reels.css";

function useReelsViewport() {
  const baseline = useRef(window.visualViewport?.height ?? window.innerHeight);
  const [frame, setFrame] = useState(() => reelsViewportFrame(window.visualViewport?.height ?? window.innerHeight, window.visualViewport?.offsetTop ?? 0, window.innerHeight, false));
  useEffect(() => {
    const viewport = window.visualViewport;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const update = () => {
      const focused = document.activeElement;
      const editing = focused instanceof HTMLElement && (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA" || focused.isContentEditable);
      const height = viewport?.height ?? window.innerHeight;
      if (!editing) baseline.current = height;
      setFrame(reelsViewportFrame(height, viewport?.offsetTop ?? 0, Math.max(baseline.current, window.innerHeight), editing));
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, []);
  return frame;
}

function usePageHidden() {
  const [hidden, setHidden] = useState(document.visibilityState === "hidden");
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return hidden;
}

export function ReelsFeedPage({ initialReelId }: { initialReelId?: string }) {
  const [location, setLocation] = useLocation();
  const client = useQueryClient();
  const returnTo = safeReelReturnPath(new URLSearchParams(window.location.search).get("returnTo"));
  const viewport = useReelsViewport();
  const pageHidden = usePageHidden();
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  activeRef.current = active;
  const [muted, setMuted] = useState(true);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [shareFor, setShareFor] = useState<Reel | null>(null);
  const [deleteFor, setDeleteFor] = useState<Reel | null>(null);
  const [patches, setPatches] = useState<Record<string, Partial<Reel>>>({});
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState("");

  const single = useGetReel(initialReelId ?? "", { query: { enabled: Boolean(initialReelId), queryKey: getGetReelQueryKey(initialReelId ?? ""), retry: false } });
  const feed = useInfiniteQuery({
    queryKey: [...getGetReelsFeedQueryKey(), "pages"],
    queryFn: ({ pageParam }) => getReelsFeed(pageParam ? { cursor: pageParam, limit: 6 } : { limit: 6 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchOnWindowFocus: false,
  });
  const like = useLikeReel(); const unlike = useUnlikeReel(); const save = useSaveReel(); const unsave = useUnsaveReel(); const del = useDeleteReel();
  const loading = feed.isLoading || (Boolean(initialReelId) && single.isLoading);

  const reels = useMemo(() => {
    const list: Reel[] = [];
    const seen = new Set<string>();
    if (single.data) { list.push(single.data); seen.add(single.data.id); }
    for (const page of feed.data?.pages ?? []) for (const reel of page.items) if (!seen.has(reel.id)) { seen.add(reel.id); list.push(reel); }
    return list.filter((reel) => !removed.has(reel.id)).map((reel) => ({ ...reel, ...patches[reel.id] }));
  }, [single.data, feed.data, patches, removed]);

  // Track which slide is on screen.
  useEffect(() => {
    const root = scroller.current;
    if (!root || loading) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
        const index = reelSlideIndex((entry.target as HTMLElement).dataset.index, reels.length);
        if (index !== null) setActive(index);
      }
    }, { root, threshold: 0.6 });
    root.querySelectorAll(".reel-slide[data-index]").forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [loading, reels.length]);

  // Keep the current Reel pinned when the stage resizes (comments panel, keyboard, rotation).
  useLayoutEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const pin = () => { root.scrollTop = activeRef.current * root.clientHeight; };
    pin();
    const observer = new ResizeObserver(pin);
    observer.observe(root);
    return () => observer.disconnect();
  }, [commentsFor, reels.length > 0]);

  useEffect(() => {
    if (active >= reels.length - 2 && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, [active, reels.length, feed.hasNextPage, feed.isFetchingNextPage]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const go = useCallback((delta: number) => {
    const root = scroller.current;
    if (!root) return;
    root.scrollTo({ top: Math.max(0, activeRef.current + delta) * root.clientHeight, behavior: "smooth" });
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("input,textarea")) return;
      if (event.key === "ArrowDown") { event.preventDefault(); go(1); }
      if (event.key === "ArrowUp") { event.preventDefault(); go(-1); }
      if (event.key === "Escape" && commentsFor) setCommentsFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, commentsFor]);

  function patch(id: string, value: Partial<Reel>) { setPatches((all) => ({ ...all, [id]: { ...all[id], ...value } })); }

  async function toggle(kind: "like" | "save", reel: Reel) {
    const before = { likedByMe: reel.likedByMe, likeCount: reel.likeCount, savedByMe: reel.savedByMe };
    const on = kind === "like" ? !reel.likedByMe : !reel.savedByMe;
    patch(reel.id, kind === "like" ? { likedByMe: on, likeCount: Math.max(0, reel.likeCount + (on ? 1 : -1)) } : { savedByMe: on });
    try {
      const mutation = kind === "like" ? (on ? like : unlike) : (on ? save : unsave);
      patch(reel.id, await mutation.mutateAsync({ reelId: reel.id }));
      if (kind === "save") { void client.invalidateQueries({ queryKey: getGetSavedReelsQueryKey() }); setNotice(on ? "Saved. Find it in Profile, Saved Reels." : "Removed from saved."); }
    } catch (error) {
      patch(reel.id, before);
      if ((error as { status?: number }).status === 404) { setRemoved((set) => new Set(set).add(reel.id)); setNotice("This Reel is no longer available."); }
      else setNotice(kind === "like" ? "Your like did not save. Try again." : "Saving did not work. Try again.");
    }
  }

  async function confirmDelete() {
    if (!deleteFor) return;
    try {
      await del.mutateAsync({ reelId: deleteFor.id });
      setRemoved((set) => new Set(set).add(deleteFor.id));
      if (commentsFor === deleteFor.id) setCommentsFor(null);
      void client.invalidateQueries({ queryKey: getGetMyReelsQueryKey() });
      void client.invalidateQueries({ queryKey: getGetSavedReelsQueryKey() });
      setDeleteFor(null);
      setNotice("Your Reel was deleted.");
    } catch {
      setNotice("Your Reel could not be deleted. Try again.");
    }
  }

  const back = () => setLocation(returnTo);
  const commentReel = commentsFor ? reels.find((reel) => reel.id === commentsFor) : undefined;
  const ownPath = `${location}${window.location.search}`;
  // Reopen the video being watched, not the first slide, when leaving the library.
  const resumePath = reels[active]
    ? `/reels/${reels[active].id}?returnTo=${encodeURIComponent(returnTo)}`
    : ownPath;

  return <div className="reels-root" style={{ top: viewport.top, bottom: "auto", height: viewport.height, ["--reels-comments-height" as string]: `${viewport.commentsHeight}px` }} data-keyboard-open={viewport.keyboardOpen} data-comments-open={Boolean(commentReel)} data-testid="page-reels">
    <div className="reels-stage">
      <div ref={scroller} className={`reels-scroller ${commentsFor ? "is-locked" : ""}`} data-testid="reels-scroller">
        {loading ? <div className="reel-slide"><div className="reel-loading" aria-label="Loading Reels" /></div>
          : feed.isError && !reels.length ? <div className="reels-empty" role="alert"><p className="text-lg font-bold">Reels could not load.</p><p className="mt-1 text-sm text-white/60">Check your connection and try again.</p><button type="button" onClick={() => void feed.refetch()} className="reel-pill mt-5" data-testid="button-retry-reels">Try again</button></div>
          : !reels.length ? <div className="reels-empty"><span className="reels-empty-mark"><Clapperboard size={30} /></span><p className="mt-5 text-xl font-bold">No Reels yet</p><p className="mt-1 max-w-[260px] text-sm leading-6 text-white/60">Be the first to share a short video with the community.</p><Link href="/reels/new" className="reels-primary mt-6" data-testid="link-post-first-reel">Post a Reel</Link></div>
          : reels.map((reel, index) => <ReelSlide
            key={reel.id} reel={reel} index={index} active={index === active} near={Math.abs(index - active) <= 1}
            muted={muted} pageHidden={pageHidden} compact={commentsFor === reel.id} showHint={index === 0 && reels.length > 1}
            returnTo={ownPath}
            onLike={() => void toggle("like", reel)} onSave={() => void toggle("save", reel)}
            onComment={() => setCommentsFor(reel.id)} onShare={() => setShareFor(reel)} onDelete={() => setDeleteFor(reel)}
          />)}
        {feed.isFetchingNextPage && <div className="reels-more" aria-live="polite">Loading more Reels</div>}
        {!feed.hasNextPage && reels.length > 1 && !feed.isLoading && <div className="reels-end">You are all caught up.</div>}
      </div>
      <header className="reels-top">
        <button type="button" onClick={back} aria-label="Back" data-testid="button-reels-back" className="reels-icon"><ArrowLeft size={24} /></button>
        <h1 className="reels-title">Reels</h1>
        <div className="ml-auto flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <Link href={`/reels/saved?returnTo=${encodeURIComponent(resumePath)}`} aria-label="Saved Reels" data-testid="link-reels-saved" className="reels-icon"><Bookmark size={20} /></Link>
            <Link href={`/reels/new?returnTo=${encodeURIComponent(ownPath)}`} aria-label="Post a Reel" data-testid="link-create-reel" className="reels-plus"><Plus size={20} /></Link>
          </div>
          {reels.length > 0 && <button type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Turn sound on" : "Mute"} aria-pressed={!muted} data-testid="button-reels-mute" className="reels-sound">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>}
        </div>
      </header>
      {notice && <p role="status" className="reels-notice" data-testid="status-reels">{notice}</p>}
      {initialReelId && single.isError && <p role="status" className="reels-notice" data-testid="status-reel-unavailable">That Reel is no longer available. Showing other Reels.</p>}
    </div>
    {commentReel && <ReelComments key={commentReel.id} reelId={commentReel.id} onClose={() => setCommentsFor(null)} onCountChange={(delta) => patch(commentReel.id, { commentCount: Math.max(0, commentReel.commentCount + delta) })} />}
    {shareFor && <ReelShareSheet reel={shareFor} onClose={() => setShareFor(null)} />}
    {deleteFor && <div className="reel-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteFor(null); }}>
      <section className="reel-sheet" role="alertdialog" aria-modal="true" aria-label="Delete Reel">
        <h2 className="text-base font-bold">Delete this Reel?</h2>
        <p className="mt-1 text-sm text-white/60">It will be removed from Reels, saved lists and shared links. This cannot be undone.</p>
        <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setDeleteFor(null)} className="reel-sheet-action" data-testid="button-cancel-delete-reel">Keep</button><button type="button" onClick={() => void confirmDelete()} disabled={del.isPending} className="reel-sheet-action !border-rose-400/30 !text-rose-300" data-testid="button-confirm-delete-reel">{del.isPending ? "Deleting" : "Delete"}</button></div>
      </section>
    </div>}
  </div>;
}
