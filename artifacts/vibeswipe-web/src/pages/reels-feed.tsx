import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetMyReelsQueryKey, getGetNotificationsQueryKey, getGetProfileReelsQueryKey, getGetReelQueryKey,
  getGetReelsFeedQueryKey, getGetSavedReelsQueryKey, getProfileReels, getReelsFeed, downloadReel,
  useGetReel, useLikeReel, useRecordReelView, useSaveReel,
  useUnlikeReel, useUnsaveReel, useMarkReelNotInterested, type Reel,
} from "@workspace/api-client-react";
import { ArrowLeft, Bookmark, Clapperboard, Download, EyeOff, LoaderCircle, MoreHorizontal, Plus, Search, Users, X } from "lucide-react";
import { ReelSlide } from "@/components/reels/reel-slide";
import { ReelComments } from "@/components/reels/reel-comments";
import { ReelShareSheet } from "@/components/reels/reel-share-sheet";
import { ReelsNavigationVisibilityContext } from "@/components/reels/reels-navigation-context";
import { reelMediaUrl, safeReelReturnPath } from "@/lib/reels";
import { readOfflineReels, saveReelForOffline } from "@/lib/offline-reels";
import { reelSlideIndex, reelsViewportFrame } from "@/lib/reels-viewport";
import { mixReelsByCreator } from "@/lib/reels-feed-order";
import "@/components/reels/reels.css";

const REEL_COMMENTS_HISTORY_KEY = "__myageReelComments";

type ReelCommentsHistoryMarker = { reelId: string; activeIndex: number };

function readReelCommentsHistoryMarker(state: unknown): ReelCommentsHistoryMarker | null {
  if (!state || typeof state !== "object") return null;
  const marker = (state as Record<string, unknown>)[REEL_COMMENTS_HISTORY_KEY];
  if (typeof marker === "string" && marker) return { reelId: marker, activeIndex: 0 };
  if (!marker || typeof marker !== "object") return null;
  const value = marker as Record<string, unknown>;
  return typeof value.reelId === "string" && value.reelId
    ? { reelId: value.reelId, activeIndex: typeof value.activeIndex === "number" ? value.activeIndex : 0 }
    : null;
}

function useReelsViewport() {
  const baseline = useRef(window.visualViewport?.height ?? window.innerHeight);
  const [frame, setFrame] = useState(() => reelsViewportFrame(window.visualViewport?.height ?? window.innerHeight, window.visualViewport?.offsetTop ?? 0, window.innerHeight, false));
  useEffect(() => {
    const viewport = window.visualViewport;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    let settledRefresh = 0;
    const update = () => {
      if (document.visibilityState === "hidden") return;
      const focused = document.activeElement;
      const editing = focused instanceof HTMLElement && (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA" || focused.isContentEditable);
      const height = viewport?.height ?? window.innerHeight;
      const frameHeight = editing ? height : Math.max(height, window.innerHeight);
      const frameTop = editing ? viewport?.offsetTop ?? 0 : 0;
      if (!editing) baseline.current = frameHeight;
      setFrame(reelsViewportFrame(frameHeight, frameTop, Math.max(baseline.current, window.innerHeight), editing));
    };
    const refreshAfterResume = () => {
      window.requestAnimationFrame(update);
      window.clearTimeout(settledRefresh);
      settledRefresh = window.setTimeout(update, 180);
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("focus", refreshAfterResume);
    window.addEventListener("pageshow", refreshAfterResume);
    document.addEventListener("visibilitychange", refreshAfterResume);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("focus", refreshAfterResume);
      window.removeEventListener("pageshow", refreshAfterResume);
      document.removeEventListener("visibilitychange", refreshAfterResume);
      window.clearTimeout(settledRefresh);
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
  const setAppNavigationVisible = useContext(ReelsNavigationVisibilityContext);
  const returnTo = safeReelReturnPath(new URLSearchParams(window.location.search).get("returnTo"));
  const profileId = new URLSearchParams(window.location.search).get("profileId") ?? "";
  const viewport = useReelsViewport();
  const pageHidden = usePageHidden();
  const scroller = useRef<HTMLDivElement>(null);
  const initialReelPositioned = useRef(false);
  const initialHistoryMarker = readReelCommentsHistoryMarker(window.history.state);
  const initialFeedMode = new URLSearchParams(window.location.search).get("tab") === "friends" ? "friends" : "reels";
  const [feedMode, setFeedMode] = useState<"reels" | "friends">(initialFeedMode);
  const [active, setActive] = useState(initialHistoryMarker?.activeIndex ?? 0);
  const activeRef = useRef(0);
  activeRef.current = active;
  const [muted, setMuted] = useState(false);
  const initialSearch = new URLSearchParams(window.location.search).get("q") ?? "";
  const [searchOpen, setSearchOpen] = useState(Boolean(initialSearch));
  const [searchText, setSearchText] = useState(initialSearch);
  const [debouncedSearchText, setDebouncedSearchText] = useState(initialSearch.trim());
  const initialCommentId = new URLSearchParams(window.location.search).get("commentId");
  const [commentsFor, setCommentsFor] = useState<string | null>(() => (
    initialReelId && initialCommentId ? initialReelId : initialHistoryMarker?.reelId ?? null
  ));
  const commentsHistoryOpen = useRef(Boolean(initialHistoryMarker));
  const [shareFor, setShareFor] = useState<Reel | null>(null);
  const [patches, setPatches] = useState<Record<string, Partial<Reel>>>({});
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState("");
  const [reelMenuOpen, setReelMenuOpen] = useState(false);
  const [offlineReels, setOfflineReels] = useState<Reel[]>([]);
  const [offlineIds, setOfflineIds] = useState<Set<string>>(() => new Set());
  const [offlineSavingIds, setOfflineSavingIds] = useState<Set<string>>(() => new Set());
  const [offline, setOffline] = useState(!navigator.onLine);
  const navigationVisible = !commentsFor && !searchOpen && !viewport.keyboardOpen;
  useEffect(() => {
    setAppNavigationVisible(navigationVisible);
  }, [navigationVisible, setAppNavigationVisible]);
  useEffect(() => () => setAppNavigationVisible(true), [setAppNavigationVisible]);
  useEffect(() => setReelMenuOpen(false), [active]);

  const openComments = useCallback((reelId: string) => {
    const currentState = window.history.state;
    const nextState = {
      ...(currentState && typeof currentState === "object" ? currentState : {}),
      [REEL_COMMENTS_HISTORY_KEY]: { reelId, activeIndex: activeRef.current },
    };
    if (commentsHistoryOpen.current) {
      window.history.replaceState(nextState, "", window.location.href);
    } else {
      window.history.pushState(nextState, "", window.location.href);
    }
    commentsHistoryOpen.current = true;
    setCommentsFor(reelId);
  }, []);

  const closeComments = useCallback(() => {
    if (commentsHistoryOpen.current) {
      window.history.back();
      return;
    }
    setCommentsFor(null);
  }, []);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state;
      const marker = readReelCommentsHistoryMarker(state);
      if (marker) {
        commentsHistoryOpen.current = true;
        setCommentsFor(marker.reelId);
        activeRef.current = marker.activeIndex;
        setActive(marker.activeIndex);
      } else if (commentsHistoryOpen.current) {
        commentsHistoryOpen.current = false;
        setCommentsFor(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!initialReelId || !initialCommentId) return;
    const currentState = window.history.state;
    const currentMarker = readReelCommentsHistoryMarker(currentState);
    if (currentMarker?.reelId === initialReelId) {
      commentsHistoryOpen.current = true;
      return;
    }
    window.history.pushState({
      ...(currentState && typeof currentState === "object" ? currentState : {}),
      [REEL_COMMENTS_HISTORY_KEY]: { reelId: initialReelId, activeIndex: 0 },
    }, "", window.location.href);
    commentsHistoryOpen.current = true;
  }, [initialReelId, initialCommentId]);

  const historyResumeReelId = initialHistoryMarker?.reelId;
  const singleReelId = initialReelId ?? historyResumeReelId;
  const single = useGetReel(singleReelId ?? "", { query: { enabled: Boolean(singleReelId), queryKey: getGetReelQueryKey(singleReelId ?? ""), retry: false, refetchInterval: 5_000 } });
  const feedParams = { feed: feedMode, limit: 6 };
  const feed = useInfiniteQuery({
    queryKey: [...getGetReelsFeedQueryKey(feedParams), "pages"],
    queryFn: ({ pageParam }) => getReelsFeed({ ...feedParams, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !profileId,
    refetchOnWindowFocus: false,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const profileFeed = useInfiniteQuery({
    queryKey: [...getGetProfileReelsQueryKey({ profileId }), "viewer"],
    queryFn: ({ pageParam, signal }) =>
      getProfileReels({ profileId, ...(pageParam ? { cursor: pageParam } : {}) }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(profileId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const searchFeed = useInfiniteQuery({
    queryKey: [...getGetReelsFeedQueryKey({ q: debouncedSearchText, limit: 6 }), "search-pages"],
    queryFn: ({ pageParam }) => getReelsFeed({
      q: debouncedSearchText,
      limit: 6,
      ...(pageParam ? { cursor: pageParam } : {}),
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: searchOpen && debouncedSearchText.trim().length >= 2,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const like = useLikeReel(); const unlike = useUnlikeReel(); const save = useSaveReel(); const unsave = useUnsaveReel();
  const markNotInterested = useMarkReelNotInterested();
  const recordView = useRecordReelView();
  const viewedReels = useRef(new Set<string>());
  const activeFeed = profileId ? profileFeed : feed;
  const loading = activeFeed.isLoading || (Boolean(initialReelId) && single.isLoading);
  const searchResults = useMemo(() => {
    const seen = new Set<string>();
    return (searchFeed.data?.pages ?? []).flatMap((page) => page.items)
      .filter((reel) => !seen.has(reel.id) && Boolean(seen.add(reel.id)));
  }, [searchFeed.data]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchText(searchText.trim().replace(/\s+/g, " "));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    let mounted = true;
    void readOfflineReels().then((items) => {
      if (!mounted) return;
      setOfflineReels(items);
      setOfflineIds(new Set(items.map((item) => item.id)));
    });
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      mounted = false;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const reels = useMemo(() => {
    const list: Reel[] = [];
    const seen = new Set<string>();
    const pages = profileId ? profileFeed.data?.pages : feed.data?.pages;
    let previousCreatorId: string | undefined;
    for (const page of pages ?? []) {
      const pageItems = profileId
        ? page.items
        : mixReelsByCreator(page.items, previousCreatorId);
      for (const reel of pageItems) {
        if (!seen.has(reel.id)) {
          seen.add(reel.id);
          list.push(reel);
        }
      }
      previousCreatorId = pageItems.at(-1)?.creatorId ?? previousCreatorId;
    }
    if (single.data && (!profileId || single.data.creatorId === profileId) && !seen.has(single.data.id)) {
      if (profileId) list.unshift(single.data);
      else list.unshift(single.data);
      seen.add(single.data.id);
    }
    if (!profileId && feedMode === "reels" && !list.length && feed.isError) for (const reel of offlineReels) if (!seen.has(reel.id)) { seen.add(reel.id); list.push(reel); }
    return list.filter((reel) => !removed.has(reel.id)).map((reel) => ({ ...reel, ...patches[reel.id] }));
  }, [single.data, profileId, profileFeed.data, feed.data, feed.isError, feedMode, offlineReels, patches, removed]);

  const resumeReelId = initialReelId ?? initialHistoryMarker?.reelId;
  useEffect(() => {
    if (!resumeReelId || initialReelPositioned.current || (profileId && profileFeed.isLoading)) return;
    const index = reels.findIndex((reel) => reel.id === resumeReelId);
    if (index < 0) return;
    initialReelPositioned.current = true;
    activeRef.current = index;
    setActive(index);
    window.requestAnimationFrame(() => {
      const root = scroller.current;
      if (root) root.scrollTop = index * root.clientHeight;
    });
  }, [profileId, resumeReelId, profileFeed.isLoading, reels]);

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
    if (active >= reels.length - 2 && activeFeed.hasNextPage && !activeFeed.isFetchingNextPage) void activeFeed.fetchNextPage();
  }, [active, reels.length, activeFeed.hasNextPage, activeFeed.isFetchingNextPage]);

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
      if (event.key === "Escape" && searchOpen) {
        event.preventDefault();
        setSearchOpen(false);
        return;
      }
      if ((event.target as HTMLElement).closest("input,textarea")) return;
      if (event.key === "ArrowDown") { event.preventDefault(); go(1); }
      if (event.key === "ArrowUp") { event.preventDefault(); go(-1); }
      if (event.key === "Escape" && commentsFor) closeComments();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, closeComments, commentsFor, searchOpen]);

  function patch(id: string, value: Partial<Reel>) { setPatches((all) => ({ ...all, [id]: { ...all[id], ...value } })); }
  function patchShareCount(id: string, shareCount: number) {
    setPatches((all) => ({ ...all, [id]: { ...all[id], shareCount: Math.max(all[id]?.shareCount ?? 0, shareCount) } }));
  }
  async function cacheOffline(reel: Reel, manual: boolean) {
    if (offlineIds.has(reel.id) || offlineSavingIds.has(reel.id)) return;
    setOfflineSavingIds((all) => new Set(all).add(reel.id));
    let result: { ok: boolean; message: string };
    try {
      result = await saveReelForOffline(reel, manual);
    } catch {
      result = { ok: false, message: "Could not save this video offline. Try again on Wi-Fi." };
    } finally {
      setOfflineSavingIds((all) => { const next = new Set(all); next.delete(reel.id); return next; });
    }
    if (result.ok) {
      setOfflineIds((all) => new Set(all).add(reel.id));
      setOfflineReels((all) => [reel, ...all.filter((item) => item.id !== reel.id)].slice(0, 3));
      setNotice(result.message);
    } else if (result.message) setNotice(result.message);
  }

  async function toggle(kind: "like" | "save", reel: Reel) {
    const before = { likedByMe: reel.likedByMe, likeCount: reel.likeCount, savedByMe: reel.savedByMe, saveCount: reel.saveCount };
    const on = kind === "like" ? !reel.likedByMe : !reel.savedByMe;
    patch(reel.id, kind === "like"
      ? { likedByMe: on, likeCount: Math.max(0, reel.likeCount + (on ? 1 : -1)) }
      : { savedByMe: on, saveCount: Math.max(0, reel.saveCount + (on ? 1 : -1)) });
    try {
      const mutation = kind === "like" ? (on ? like : unlike) : (on ? save : unsave);
      patch(reel.id, await mutation.mutateAsync({ reelId: reel.id }));
      if (kind === "save") void client.invalidateQueries({ queryKey: getGetSavedReelsQueryKey() });
      void client.invalidateQueries({ queryKey: getGetReelQueryKey(reel.id) });
      void client.invalidateQueries({ queryKey: getGetProfileReelsQueryKey({ profileId: reel.creatorId }) });
      void client.invalidateQueries({ queryKey: getGetMyReelsQueryKey() });
    } catch (error) {
      patch(reel.id, before);
      if ((error as { status?: number }).status === 404) { setRemoved((set) => new Set(set).add(reel.id)); setNotice("This Reel is no longer available."); }
      else setNotice(kind === "like" ? "Your like did not save. Try again." : "Saving did not work. Try again.");
    }
  }

  async function recordPlayback(reel: Reel) {
    if (reel.isOwner || viewedReels.current.has(reel.id)) return;
    viewedReels.current.add(reel.id);
    try {
      const result = await recordView.mutateAsync({ reelId: reel.id });
      setPatches((current) => ({ ...current, [reel.id]: { ...current[reel.id], viewCount: result.viewCount } }));
      void client.invalidateQueries({ queryKey: getGetProfileReelsQueryKey({ profileId: reel.creatorId }) });
    } catch {
      viewedReels.current.delete(reel.id);
    }
  }

  async function hideSimilarReels(reel: Reel) {
    try {
      await markNotInterested.mutateAsync({ reelId: reel.id });
      const words = (reel.caption ?? "").toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [];
      const related = reels.filter((candidate) => candidate.id === reel.id
        || candidate.creatorId === reel.creatorId
        || words.some((word) => (candidate.caption ?? "").toLowerCase().includes(word)));
      setRemoved((current) => new Set([...current, ...related.map((item) => item.id)]));
      void client.invalidateQueries({ queryKey: getGetReelsFeedQueryKey() });
      setNotice("We’ll show you fewer Reels like this.");
    } catch {
      setNotice("Couldn’t update your recommendations. Try again.");
    } finally {
      setReelMenuOpen(false);
    }
  }

  async function downloadCurrentReel(reel: Reel) {
    try {
      const blob = await downloadReel(reel.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `myage-reel-${reel.id}.mp4`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Download started.");
    } catch {
      setNotice("This Reel could not be downloaded.");
    } finally {
      setReelMenuOpen(false);
    }
  }

  const back = () => commentsFor ? closeComments() : setLocation(returnTo);
  function changeFeedMode(mode: "reels" | "friends") {
    setFeedMode(mode);
    const params = new URLSearchParams(window.location.search);
    if (mode === "friends") params.set("tab", "friends");
    else params.delete("tab");
    const query = params.toString();
    setLocation(`${location}${query ? `?${query}` : ""}`, { replace: true });
  }
  function closeSearch() {
    setSearchOpen(false);
    setSearchText("");
    setDebouncedSearchText("");
  }
  function openSearch(query = "") {
    const nextQuery = query.trim().slice(0, 120);
    setSearchText(nextQuery);
    setDebouncedSearchText(nextQuery);
    setSearchOpen(true);
  }
  function openSearchResult(reel: Reel) {
    const query = searchText.trim();
    const destination = `/reels/${reel.id}?returnTo=${encodeURIComponent(`/reels?q=${encodeURIComponent(query)}`)}`;
    setLocation(destination);
  }
  const commentReel = commentsFor ? reels.find((reel) => reel.id === commentsFor) : undefined;
  const activeReel = reels[active];
  const ownPath = `${location}${window.location.search}`;
  // Reopen the video being watched, not the first slide, when leaving the library.
  const resumeParams = new URLSearchParams({ returnTo });
  if (profileId) resumeParams.set("profileId", profileId);
  const resumePath = reels[active]
    ? `/reels/${reels[active].id}?${resumeParams.toString()}`
    : ownPath;

  return <div className="reels-root" style={{ top: viewport.top, bottom: "auto", ["--reels-viewport-height" as string]: `${viewport.height}px`, ["--reels-comments-height" as string]: `${viewport.commentsHeight}px` }} data-keyboard-open={viewport.keyboardOpen} data-comments-open={Boolean(commentReel)} data-navigation-visible={navigationVisible} data-testid="page-reels">
    <div className="reels-stage">
      <div ref={scroller} className={`reels-scroller ${commentsFor ? "is-locked" : ""}`} data-testid="reels-scroller">
        {loading ? <div className="reel-slide"><div className="reel-loading" aria-label="Loading Reels" /></div>
          : activeFeed.isError && !reels.length ? <div className="reels-empty" role="alert"><p className="text-lg font-bold">{offline ? "No Reels saved offline yet." : "Reels could not load."}</p><p className="mt-1 text-sm text-white/60">{offline ? "Connect to Wi-Fi and watch a Reel or tap Save offline first." : "Check your connection and try again."}</p>{!offline&&<button type="button" onClick={() => void activeFeed.refetch()} className="reel-pill mt-5" data-testid="button-retry-reels">Try again</button>}</div>
          : !reels.length && feedMode === "friends" && !profileId ? <div className="reels-empty"><span className="reels-empty-mark"><Users size={30} /></span><p className="mt-5 text-xl font-bold">No Friends Reels yet</p><p className="mt-1 max-w-[260px] text-sm leading-6 text-white/60">Reels from people you follow will appear here.</p><button type="button" onClick={() => changeFeedMode("reels")} className="reels-primary mt-6" data-testid="button-open-all-reels">Watch all Reels</button></div>
          : !reels.length ? <div className="reels-empty"><span className="reels-empty-mark"><Clapperboard size={30} /></span><p className="mt-5 text-xl font-bold">No Reels yet</p><p className="mt-1 max-w-[260px] text-sm leading-6 text-white/60">Be the first to share a video with the community.</p><Link href="/reels/new" className="reels-primary mt-6" data-testid="link-post-first-reel">Post a Reel</Link></div>
          : reels.map((reel, index) => <ReelSlide
             key={reel.id} reel={reel} index={index} active={index === active && !searchOpen} near={Math.abs(index - active) <= 1}
              muted={muted} pageHidden={pageHidden} compact={commentsFor === reel.id} navigationVisible={navigationVisible}
              likePending={like.isPending || unlike.isPending}
              savePending={save.isPending || unsave.isPending}
            returnTo={ownPath}
             onAutoplayMuted={() => setMuted(true)}
              onToggleSound={() => setMuted((value) => !value)}
              offlineSaved={offlineIds.has(reel.id)}
              onAutoCache={() => void cacheOffline(reel, false)}
               onLike={() => void toggle("like", reel)}
                onSave={() => void toggle("save", reel)}
                onSearchSuggestion={openSearch}
            onView={() => void recordPlayback(reel)}
              onComment={() => openComments(reel.id)} onShare={() => setShareFor(reel)}
          />)}
        {activeFeed.isFetchingNextPage && <div className="reels-more" aria-live="polite">Loading more Reels</div>}
        {!offline && !activeFeed.hasNextPage && reels.length > 1 && !activeFeed.isLoading && <div className="reels-end">{profileId ? "You’ve seen all of this person’s Reels." : "You are all caught up."}</div>}
      </div>
      <header className="reels-top">
        {(profileId || initialReelId) && <button type="button" onClick={back} aria-label="Back" data-testid="button-reels-back" className="reels-icon"><ArrowLeft size={23} /></button>}
        {!profileId && !initialReelId ? <nav aria-label="Reel feed" role="tablist" className={`reels-feed-tabs ${navigationVisible ? "" : "is-hidden"}`} data-testid="nav-reel-feed">
          <button type="button" role="tab" aria-selected={feedMode === "reels"} onClick={() => changeFeedMode("reels")} className={feedMode === "reels" ? "is-active" : ""} data-testid="tab-reels-feed">Reels</button>
          <button type="button" role="tab" aria-selected={feedMode === "friends"} onClick={() => changeFeedMode("friends")} className={feedMode === "friends" ? "is-active" : ""} data-testid="tab-friends-feed">Friends</button>
        </nav> : <h1 className="reels-title">Reels</h1>}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => openSearch()} aria-label="Search Reels" data-testid="button-search-reels" className="reels-search-trigger"><Search size={23} /></button>
          <Link href={`/reels/saved?returnTo=${encodeURIComponent(resumePath)}`} aria-label="Saved Reels" data-testid="link-reels-saved" className="reels-search-trigger"><Bookmark size={22} /></Link>
          <button type="button" onClick={() => setReelMenuOpen((open) => !open)} aria-label="More Reel options" aria-expanded={reelMenuOpen} data-testid="button-reel-more-options" className="reels-search-trigger"><MoreHorizontal size={23} /></button>
          <button type="button" onClick={() => setLocation(`/reels/new?returnTo=${encodeURIComponent(ownPath)}`)} aria-label="Post a Reel" title="Post a Reel" data-testid="button-post-reel" className="reels-search-trigger"><Plus size={25} strokeWidth={2.2} /></button>
        </div>
      </header>
      {reelMenuOpen && activeReel && <div className="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+54px)] z-30 min-w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#151319]/95 p-1.5 shadow-2xl backdrop-blur-xl" role="menu" data-testid="menu-reel-options">
        {activeReel.canDownload && activeReel.mediaType === "video" && <button type="button" role="menuitem" onClick={() => void downloadCurrentReel(activeReel)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-white hover:bg-white/10" data-testid={`button-download-reel-${activeReel.id}`}><Download size={17}/>Download Reel</button>}
        {!activeReel.isOwner && <button type="button" role="menuitem" disabled={markNotInterested.isPending} onClick={() => void hideSimilarReels(activeReel)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50" data-testid={`button-not-interested-${activeReel.id}`}><EyeOff size={17}/>Not interested</button>}
        {!activeReel.canDownload && activeReel.isOwner && <p className="px-3 py-2 text-xs text-white/65">You have disabled Reel downloads.</p>}
      </div>}
      {searchOpen && <section className="reels-search-overlay" role="dialog" aria-modal="true" aria-label="Search Reels" data-testid="reels-search-overlay">
        <div className="reels-search-toolbar">
          <button type="button" onClick={closeSearch} aria-label="Close Reel search" className="reels-icon"><ArrowLeft size={22} /></button>
          <label className="reels-search-field">
            <Search size={18} aria-hidden="true" />
            <input autoFocus type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} maxLength={120} placeholder="Search Reels" aria-label="Search Reels" data-testid="input-search-reels" />
            {searchText && <button type="button" onClick={() => setSearchText("")} aria-label="Clear Reel search"><X size={17} /></button>}
          </label>
        </div>
        <div className="reels-search-results" aria-live="polite">
          {debouncedSearchText.trim().length < 2
            ? null
            : searchFeed.isLoading
              ? <div className="reels-search-status"><LoaderCircle size={20} className="animate-spin" />Searching Reels…</div>
              : searchFeed.isError
                ? <div className="reels-search-status">Search is unavailable. Check your connection and try again.</div>
                : !searchResults.length
                  ? <div className="reels-search-status">No Reels match “{debouncedSearchText}” yet.</div>
                  : <>
                    <p className="reels-search-label">Reels matching “{debouncedSearchText}”</p>
                    <ul className="reels-search-list">
                      {searchResults.map((reel) => <li key={reel.id}>
                        <button type="button" onClick={() => openSearchResult(reel)} className="reels-search-result" data-testid={`button-open-search-reel-${reel.id}`}>
                          {reel.mediaType === "slides"
                            ? <img src={reelMediaUrl(reel.slideReferences[0])} alt="" aria-hidden="true" />
                            : <video src={`${reelMediaUrl(reel.videoReference)}#t=0.1`} preload="metadata" muted playsInline aria-hidden="true" />}
                          <span className="reels-search-copy">
                            <span className="reels-search-creator">{reel.creatorName}</span>
                            <span className="reels-search-caption">{reel.caption || "Reel"}</span>
                            <span className="reels-search-location">{reel.creatorLocation || "Location not added"}</span>
                          </span>
                          <span className="reels-search-open">Watch</span>
                        </button>
                      </li>)}
                    </ul>
                    {searchFeed.hasNextPage && <button type="button" onClick={() => void searchFeed.fetchNextPage()} disabled={searchFeed.isFetchingNextPage} className="reels-search-more">{searchFeed.isFetchingNextPage ? "Loading…" : "Load more Reels"}</button>}
                  </>}
        </div>
      </section>}
      {offline && <p role="status" className="reels-notice" data-testid="notice-reels-offline">{reels.length ? "Offline. Showing videos saved on this device." : "Offline. No videos are saved on this device yet."}</p>}
      {notice && <p role="status" className="reels-notice" data-testid="status-reels">{notice}</p>}
      {initialReelId && single.isError && <p role="status" className="reels-notice" data-testid="status-reel-unavailable">That Reel is no longer available. Showing other Reels.</p>}
    </div>
    {commentReel && <ReelComments key={commentReel.id} reelId={commentReel.id} creatorId={commentReel.creatorId} returnTo={returnTo} commentCount={commentReel.commentCount} canComment={commentReel.canComment} focusCommentId={initialCommentId} onClose={closeComments} onCountChange={(delta) => {
      patch(commentReel.id, { commentCount: Math.max(0, commentReel.commentCount + delta) });
      void client.invalidateQueries({ queryKey: getGetReelQueryKey(commentReel.id) });
      void client.invalidateQueries({ queryKey: getGetProfileReelsQueryKey({ profileId: commentReel.creatorId }) });
      void client.invalidateQueries({ queryKey: getGetMyReelsQueryKey() });
    }} />}
    {shareFor && <ReelShareSheet reel={shareFor} onClose={() => setShareFor(null)} onCountChange={(count) => patchShareCount(shareFor.id, count)} onCountError={setNotice} />}
  </div>;
}
