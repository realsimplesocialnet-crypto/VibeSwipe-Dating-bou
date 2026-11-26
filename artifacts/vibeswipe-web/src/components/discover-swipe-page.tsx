import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { discoveryFilterParams, type DiscoveryFilters } from "@/lib/discovery-filters";
import { DiscoveryFilterForm } from "@/components/discovery-filter-form";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocation } from "wouter";
import {
  createUseDiscoveryDeck,
  getGetBoostStatusQueryKey,
  getGetDailyLikeStatusQueryKey,
  getGetDiscoverProfilesQueryKey,
  getGetProfileByIdQueryKey,
  getGetProfileDatingStateQueryKey,
  getGetProfileFollowSummaryQueryKey,
  getGetMediaPreviewQueryKey,
  getGetMatchesQueryKey,
  getGetMessagesQueryKey,
  getGetSuperLikeStatusQueryKey,
  getGetVibeSwipeSettingsQueryKey,
  getProfileDatingState,
  getProfileFollowSummary,
  getMediaPreview,
  getMessages,
  useActivateBoost,
  useBlockProfile,
  useCreateReaction,
  useGetBoostStatus,
  useGetDailyLikeStatus,
  useGetDiscoverProfiles,
  useGetMyProfile,
  useGetSuperLikeStatus,
  useGetVibeSwipeSettings,
  useRecordProfileView,
  useReportProfile,
  useUndoLastPass,
  type Profile,
  type ReportInputReason,
} from "@workspace/api-client-react";
import { ArrowLeft, Heart, Search, SlidersHorizontal, Star, X, Zap } from "lucide-react";
import { isDiscoverSetupRequired, shouldRetryDiscover } from "@/lib/profile-query-state";
import { StoriesRow } from "@/components/stories/stories-ui";
import { MatchCelebration } from "@/components/match-celebration";
import { FetchErrorBanner } from "@/components/fetch-status";
import { SpringDialog } from "@/components/spring-motion";
import { QuietSpinner } from "@/components/ui/quiet-spinner";
import { DiscoverSwipeCard, type SwipeAction, type SwipeExit, type SwipeGesture } from "@/components/discover-swipe-card";
import { useAppLanguage } from "@/lib/app-language";
import { resetSwipePhotoWarmup, swipeCardPhotoUrl, warmSwipePhotoUrls } from "@/lib/swipe-photo-preload";

const useDiscoveryDeck = createUseDiscoveryDeck(useState);

export function DiscoverSwipePage() {
  const { t } = useAppLanguage();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [appliedFilters, setAppliedFilters] = useState<DiscoveryFilters | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [likeConfirmation, setLikeConfirmation] = useState("");
  const [lastPass, setLastPass] = useState<string | null>(null);
  const [swipeExits, setSwipeExits] = useState<Record<string, SwipeExit>>({});
  const [pendingReactionCount, setPendingReactionCount] = useState(0);
  const [pendingLikeCount, setPendingLikeCount] = useState(0);
  const [pendingSuperLikeCount, setPendingSuperLikeCount] = useState(0);
  const swipeLock = useRef(false);
  const swipeExitTimers = useRef(new Map<string, number>());
  const lastSwipeAt = useRef(0);
  const [matchResult, setMatchResult] = useState<{ profile: Profile; matchId: string | null } | null>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const myProfile = useGetMyProfile();
  const filterValues: DiscoveryFilters = appliedFilters ?? {
    ageMin: myProfile.data?.preferences.ageMin ?? 22,
    ageMax: myProfile.data?.preferences.ageMax ?? 35,
    gender: undefined, country: null, state: null, city: "", includePassed: false,
  };
  function applyFilters(value: DiscoveryFilters) {
    if (swipeLock.current) return;
    setAppliedFilters(value);
    setFiltersOpen(false);
  }
  const noticeTimer = useRef<number | null>(null);
  const previousTravelFilter = useRef<string | null>(null);
  const settings = useGetVibeSwipeSettings({ query: { queryKey: getGetVibeSwipeSettingsQueryKey() } });
  useEffect(() => () => {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    for (const timer of swipeExitTimers.current.values()) window.clearTimeout(timer);
    swipeExitTimers.current.clear();
  }, []);

  const params = useMemo(() => discoveryFilterParams(appliedFilters), [appliedFilters]);
  const feedKey = JSON.stringify([params, settings.data?.travelMode, settings.data?.travelCity, myProfile.data?.id, myProfile.data?.country, myProfile.data?.preferences]);
  const discover = useGetDiscoverProfiles<Profile[]>(params, {
    query: {
      queryKey: [...getGetDiscoverProfilesQueryKey(params), feedKey],
      refetchOnWindowFocus: false,
      retry: shouldRetryDiscover,
      refetchInterval: 30_000,
    },
  });
  const { profiles, index, setIndex, refill } = useDiscoveryDeck(discover.data, feedKey);
  const profile = profiles[index];
  const reaction = useCreateReaction();
  const undo = useUndoLastPass();
  const likes = useGetDailyLikeStatus({ query: { queryKey: getGetDailyLikeStatusQueryKey(), refetchInterval: 60_000 } });
  const superLikes = useGetSuperLikeStatus({ query: { queryKey: getGetSuperLikeStatusQueryKey(), refetchInterval: 60_000 } });
  const boost = useGetBoostStatus({ query: { queryKey: getGetBoostStatusQueryKey(), refetchInterval: 10_000 } });
  const activateBoost = useActivateBoost();
  const recordView = useRecordProfileView();
  const block = useBlockProfile();
  const report = useReportProfile();
  const profilesRef = useRef(profiles);
  const indexRef = useRef(index);
  const activeProfileRef = useRef(profile);
  const profileByIdRef = useRef(new Map<string, Profile>());
  const setIndexRef = useRef(setIndex);
  const pendingLikeCountRef = useRef(0);
  const pendingSuperLikeCountRef = useRef(0);
  const reactionQueue = useRef<Promise<void>>(Promise.resolve());
  const reactionMutateRef = useRef(reaction.mutateAsync);
  const refetchDiscoverRef = useRef(discover.refetch);
  const likesRemainingRef = useRef(likes.data?.remaining);
  const superLikesRemainingRef = useRef(superLikes.data?.remaining);
  const matchResultRef = useRef(matchResult);
  profilesRef.current = profiles;
  indexRef.current = index;
  activeProfileRef.current = profile;
  profileByIdRef.current = new Map(profiles.map((item) => [item.id, item]));
  setIndexRef.current = setIndex;
  reactionMutateRef.current = reaction.mutateAsync;
  refetchDiscoverRef.current = discover.refetch;
  likesRemainingRef.current = likes.data?.remaining;
  superLikesRemainingRef.current = superLikes.data?.remaining;
  matchResultRef.current = matchResult;
  pendingLikeCountRef.current = pendingLikeCount;
  pendingSuperLikeCountRef.current = pendingSuperLikeCount;

  const stackProfiles = useMemo(() => profiles.slice(index, index + 4), [profiles, index]);
  useEffect(() => {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const preloadCount = memory !== undefined && memory <= 2 ? 3 : 5;
    const upcoming = profiles.slice(index, index + preloadCount);
    for (const candidate of upcoming) {
      const key = getGetProfileByIdQueryKey(candidate.id);
      const cached = queryClient.getQueryState(key);
      if (!cached?.data || Date.now() - cached.dataUpdatedAt > 10 * 60_000) {
        void queryClient.prefetchQuery({ queryKey: key, queryFn: async () => candidate, staleTime: 10 * 60_000, gcTime: 30 * 60_000 });
      }
    }
    for (const candidate of upcoming) {
      const reference = candidate.photos?.[0];
      if (!reference?.startsWith("media:")) continue;
      const mediaId = reference.slice(6);
      void queryClient.prefetchQuery({
        queryKey: getGetMediaPreviewQueryKey(mediaId),
        queryFn: ({ signal }) => getMediaPreview(mediaId, { signal }),
        staleTime: 10 * 60_000,
        gcTime: 30 * 60_000,
      });
    }
    const retained = profiles.slice(Math.max(0, index - 2), index + preloadCount);
    warmSwipePhotoUrls(
      retained.map((candidate) => swipeCardPhotoUrl(candidate.photos?.[0])),
      upcoming.slice(1).map((candidate) => swipeCardPhotoUrl(candidate.photos?.[0])),
    );
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };
    const warmScreens = () => {
      for (const candidate of profiles.slice(index, index + 2)) {
        const followKey = getGetProfileFollowSummaryQueryKey(candidate.id);
        const datingKey = getGetProfileDatingStateQueryKey(candidate.id);
        void queryClient.prefetchQuery({
          queryKey: followKey,
          queryFn: ({ signal }) => getProfileFollowSummary(candidate.id, { signal }),
          staleTime: 10 * 60_000,
          gcTime: 30 * 60_000,
        });
        void queryClient.prefetchQuery({
          queryKey: datingKey,
          queryFn: ({ signal }) => getProfileDatingState(candidate.id, { signal }),
          staleTime: 10 * 60_000,
          gcTime: 30 * 60_000,
        }).then(() => {
          const matchId = queryClient.getQueryData<{ matchId?: string | null }>(datingKey)?.matchId;
          if (!matchId) return;
          void queryClient.prefetchQuery({
            queryKey: getGetMessagesQueryKey(matchId),
            queryFn: ({ signal }) => getMessages(matchId, { signal }),
            staleTime: 30_000,
            gcTime: 10 * 60_000,
          });
        }, () => undefined);
      }
    };
    const idleId = idleWindow.requestIdleCallback?.(warmScreens, { timeout: 400 });
    if (idleId === undefined) warmScreens();
  }, [profiles, index, queryClient]);
  useEffect(() => () => resetSwipePhotoWarmup(), []);
  const worldwide = Boolean(profile?.discoveryExpanded || discover.data?.some(p => p.discoveryExpanded));
  const viewed = useRef(new Set<string>());
  const tailRequested = useRef("");
  useEffect(() => {
    const tailKey = `${feedKey}:${index}`;
    if (index < 1 || index < profiles.length - 2 || pendingReactionCount > 0 || discover.isFetching || tailRequested.current === tailKey) return;
    tailRequested.current = tailKey;
    const exhausted = index >= profiles.length;
    // A prefetch started before the last swipe can contain that now-liked card.
    // Only start a new round from a request sent after the stack was exhausted.
    void discover.refetch().then(result => { if (exhausted && !result.isError) refill(result.data); });
  }, [feedKey, index, profiles.length, pendingReactionCount, discover.isFetching]);
  const matchOverlay = <MatchCelebration
    visible={!!matchResult} self={(myProfile.data as Profile | undefined) ?? null}
    other={matchResult?.profile ?? null} canMessage={Boolean(matchResult?.matchId)}
    onMessage={() => { const id = matchResult?.matchId; if (!id) return; setMatchResult(null); setLocation(`/chat/${id}?returnTo=%2Fdiscover&focusComposer=1`); }}
    onKeepSwiping={() => setMatchResult(null)}
  />;

  useEffect(() => {
    if (!settings.data) return;
    const filter = `${settings.data.travelMode}:${settings.data.travelCity ?? ""}`;
    if (previousTravelFilter.current !== null && previousTravelFilter.current !== filter) {
      setIndex(0);
      setAppliedFilters(value => value ? { ...value, city: "", country: null, state: null, includePassed: false } : null);
    }
    previousTravelFilter.current = filter;
  }, [settings.data?.travelMode, settings.data?.travelCity]);

  useEffect(() => {
    if (!profile || profile.isDemo || viewed.current.has(profile.id)) return;
    let cancelled = false;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const record = () => {
      if (cancelled || viewed.current.has(profile.id)) return;
      viewed.current.add(profile.id);
      recordView.mutate({ profileId: profile.id });
    };
    const idleId = idleWindow.requestIdleCallback?.(record, { timeout: 700 });
    const fallbackId = idleId === undefined ? window.setTimeout(record, 120) : null;
    return () => {
      cancelled = true;
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId);
      if (fallbackId !== null) window.clearTimeout(fallbackId);
    };
  }, [profile?.id, profile?.isDemo, recordView.mutate]);

  const swipe = useCallback((profileId: string, type: SwipeAction, gesture: SwipeGesture = { offsetX: 0, velocityX: 0 }) => {
    const current = activeProfileRef.current;
    if (!current || current.id !== profileId || swipeLock.current || matchResultRef.current) return;
    if (Date.now() - lastSwipeAt.current < 180) return;
    lastSwipeAt.current = Date.now();
    const likesRemaining = likesRemainingRef.current;
    if (type === "like" && likesRemaining !== undefined && pendingLikeCountRef.current >= likesRemaining) {
      setNotice("You’ve reached your daily like limit. Come back in 24 hours.");
      return;
    }
    const superLikesRemaining = superLikesRemainingRef.current;
    if (type === "super" && superLikesRemaining !== undefined && pendingSuperLikeCountRef.current >= superLikesRemaining) {
      setNotice("You’ve used your available Super Likes.");
      return;
    }

    swipeLock.current = true;
    const direction = type === "pass" ? -1 : 1;
    const swipeExitTarget: SwipeExit = type === "super"
      ? { action: type, x: 0, y: -window.innerHeight * 1.15, rotate: 0, velocityX: 0, velocityY: -1400, reducedMotion }
      : {
          action: type,
          x: direction * Math.max(window.innerWidth * 1.15, Math.abs(gesture.offsetX) + Math.abs(gesture.velocityX) * 0.16),
          y: 0,
          rotate: direction * Math.min(15, 5 + Math.abs(gesture.velocityX) / 280),
          velocityX: direction * Math.max(900, Math.abs(gesture.velocityX)),
          velocityY: 0,
          reducedMotion,
        };

    const nextIndex = indexRef.current + 1;
    indexRef.current = nextIndex;
    activeProfileRef.current = profilesRef.current[nextIndex];
    setIndexRef.current(nextIndex);
    const previousExitTimer = swipeExitTimers.current.get(current.id);
    if (previousExitTimer !== undefined) window.clearTimeout(previousExitTimer);
    setSwipeExits((exits) => ({ ...exits, [current.id]: swipeExitTarget }));
    const exitTimer = window.setTimeout(() => {
      setSwipeExits((exits) => {
        if (!(current.id in exits)) return exits;
        const next = { ...exits };
        delete next[current.id];
        return next;
      });
      swipeExitTimers.current.delete(current.id);
    }, reducedMotion ? 0 : 170);
    swipeExitTimers.current.set(current.id, exitTimer);
    setNotice("");
    if (type === "like") {
      pendingLikeCountRef.current += 1;
      setPendingLikeCount(pendingLikeCountRef.current);
    }
    if (type === "super") {
      pendingSuperLikeCountRef.current += 1;
      setPendingSuperLikeCount(pendingSuperLikeCountRef.current);
    }
    setPendingReactionCount((count) => count + 1);
    swipeLock.current = false;

    const submit = async () => {
      try {
        const result = await reactionMutateRef.current({ data: { toUserId: current.id, type } });
        setLastPass(type === "pass" ? current.id : null);
        if (type === "like") void queryClient.invalidateQueries({ queryKey: getGetDailyLikeStatusQueryKey() });
        if (type === "super") void queryClient.invalidateQueries({ queryKey: getGetSuperLikeStatusQueryKey() });
        if (result.matched) void queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
        if (result.matched) {
          if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
          setLikeConfirmation("");
          setMatchResult({ profile: current, matchId: result.matchId ?? null });
        } else if (type === "like" || type === "super") {
          if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
          setLikeConfirmation(type === "super" ? `You super liked ${current.name}` : `You liked ${current.name}`);
          noticeTimer.current = window.setTimeout(() => {
            setLikeConfirmation("");
          }, 1500);
        }
      } catch (error) {
        const status = (error as { status?: number }).status;
        const failedIndex = nextIndex - 1;
        if (status !== 404 && indexRef.current === nextIndex) {
          indexRef.current = failedIndex;
          activeProfileRef.current = profilesRef.current[failedIndex];
          setIndexRef.current(failedIndex);
          setSwipeExits((exits) => {
            if (!(current.id in exits)) return exits;
            const next = { ...exits };
            delete next[current.id];
            return next;
          });
        }
        setNotice(status === 404
          ? "This profile is no longer available. Finding someone new."
          : "That swipe could not be saved. Try again.");
        if (status === 404) void refetchDiscoverRef.current();
      } finally {
        if (type === "like") {
          pendingLikeCountRef.current = Math.max(0, pendingLikeCountRef.current - 1);
          setPendingLikeCount(pendingLikeCountRef.current);
        }
        if (type === "super") {
          pendingSuperLikeCountRef.current = Math.max(0, pendingSuperLikeCountRef.current - 1);
          setPendingSuperLikeCount(pendingSuperLikeCountRef.current);
        }
        setPendingReactionCount((count) => Math.max(0, count - 1));
      }
    };

    reactionQueue.current = reactionQueue.current.then(submit, submit);
  }, [queryClient, reducedMotion]);

  const openProfile = useCallback((profileId: string) => {
    if (activeProfileRef.current?.id !== profileId) return;
    const selected = profileByIdRef.current.get(profileId);
    if (!selected) return;
    const key = getGetProfileByIdQueryKey(profileId);
    const cachedProfile = queryClient.getQueryState(key);
    if (!cachedProfile?.data || Date.now() - cachedProfile.dataUpdatedAt > 10 * 60_000) {
      void queryClient.prefetchQuery({ queryKey: key, queryFn: async () => selected, staleTime: 10 * 60_000, gcTime: 30 * 60_000 });
    }
    const followKey = getGetProfileFollowSummaryQueryKey(profileId);
    void queryClient.prefetchQuery({ queryKey: followKey, queryFn: ({ signal }) => getProfileFollowSummary(profileId, { signal }), staleTime: 10 * 60_000, gcTime: 30 * 60_000 });
    const datingKey = getGetProfileDatingStateQueryKey(profileId);
    void queryClient.prefetchQuery({ queryKey: datingKey, queryFn: ({ signal }) => getProfileDatingState(profileId, { signal }), staleTime: 10 * 60_000, gcTime: 30 * 60_000 });
    setLocation(`/profile/${profileId}?returnTo=%2Fdiscover`);
  }, [queryClient, setLocation]);

  const openOptions = useCallback((profileId: string) => {
    if (activeProfileRef.current?.id === profileId) setOptionsOpen(true);
  }, []);

  async function undoLastSwipe() {
    if (!lastPass || undo.isPending || swipeLock.current || pendingReactionCount > 0) return;
    try {
      const result = await undo.mutateAsync();
      if (result.undone && result.targetUserId === lastPass) {
        setIndex((value) => Math.max(0, value - 1));
        setLastPass(null);
        await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey(params) });
      }
    } catch {
      setNotice("Could not undo that pass. Try again.");
    }
  }

  async function blockCurrent() {
    if (!profile) return;
    try {
      await block.mutateAsync({ data: { targetUserId: profile.id } });
      setIndex(value => value + 1);
      setOptionsOpen(false);
      await queryClient.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey(params) });
    } catch {
      setNotice("Could not block this profile. Try again.");
    }
  }

  async function reportCurrent(reason: ReportInputReason) {
    if (!profile) return;
    try {
      await report.mutateAsync({ data: { targetUserId: profile.id, reason } });
      setOptionsOpen(false);
      setNotice("Report received. Thank you for looking out for the community.");
    } catch {
      setNotice("Could not submit this report. Try again.");
    }
  }

  async function startBoost() {
    if (!boost.data?.available || activateBoost.isPending) return;
    try {
      await activateBoost.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: getGetBoostStatusQueryKey() });
      setNotice("Your boost is active for 30 minutes.");
    } catch {
      setNotice("Boost is active or still cooling down.");
    }
  }

  const stickyHeader = <div className="discover-sticky sticky top-[var(--install-banner-height,0px)] z-30 -mx-4 mb-4 px-4 pb-1 pt-3 sm:-mx-6 sm:px-6" data-testid="discover-sticky-header">
    <header className="mb-3 rounded-[28px] bg-card/95 px-3 py-2.5 shadow-sm">
      <div className="flex min-h-11 items-center gap-2.5">{!profile && <StoriesRow mode="own"/>}<span className="min-w-0 flex-1 text-[11px] text-muted-foreground" data-testid="text-discover-likes">{likes.data?.remaining??"—"} {t("likes left")}</span><button type="button" onClick={()=>setLocation("/search")} aria-label={t("Search members")} data-testid="button-member-search" className="flex h-10 w-9 shrink-0 items-center justify-center text-primary"><Search size={20}/></button><button type="button" onClick={()=>setFiltersOpen(true)} aria-label={t("Discovery filters")} data-testid="button-discovery-filters" className="flex h-10 w-9 shrink-0 items-center justify-center text-primary"><SlidersHorizontal size={22}/></button></div>
      <div className="mt-1.5 flex items-center justify-between pl-1"><h1 className="text-[13px] font-semibold text-foreground">{t("Meet someone new")}</h1><button type="button" onClick={()=>void startBoost()} disabled={!boost.data?.available||activateBoost.isPending} aria-label={boost.data?.active?t("Boost active"):t("Activate boost")} data-testid="button-activate-boost" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-primary disabled:opacity-40"><Zap size={12}/>{t("Boost")}</button></div>
    </header>
    <StoriesRow mode={profile ? "all" : "matches"}/>
  </div>;
  const likeLimitReached = likes.data?.remaining === 0 ||
    (likes.data?.remaining !== undefined && pendingLikeCount >= likes.data.remaining);
  const superLikeLimitReached = superLikes.data?.remaining === 0 ||
    (superLikes.data?.remaining !== undefined && pendingSuperLikeCount >= superLikes.data.remaining);
  const hasCachedProfiles = profiles.length > 0 || (discover.data?.length ?? 0) > 0;
  if (discover.isLoading && !hasCachedProfiles) {
    return (
      <div role="status" aria-label="Loading Discover" data-testid="status-discover-loading" className="mx-auto flex min-h-[55dvh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <QuietSpinner />
        <p className="text-sm text-muted-foreground">{t("Getting your feed ready…")}</p>
      </div>
    );
  }
  if (discover.isError && isDiscoverSetupRequired(discover.error) && !hasCachedProfiles) return <Redirect to="/onboarding" />;
  if (discover.isError && !discover.data) {
    if (!hasCachedProfiles) {
      const status = discover.error.status;
      const message = status === 401
          ? t("Your session needs a refresh. Try loading Discover again.")
        : status === 403
          ? t("Discover is unavailable for this account right now.")
          : t("Check your connection, then try again.");
      return (
        <div role="alert" data-testid="error-discover-load" className="mx-auto flex min-h-[55dvh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <h1 className="brand text-xl font-bold">{t("Discover couldn’t load")}</h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{message}</p>
          <button
            type="button"
            onClick={() => void discover.refetch().then(result => { if (!result.isError) refill(result.data); })}
            data-testid="button-retry-discover-load"
            className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            {t("Try again")}
          </button>
        </div>
      );
    }
  }
  if (!profile) {
    return (
      <div className="mx-auto max-w-[680px] px-4 pb-5 text-center sm:px-6 sm:pb-7">
        {stickyHeader}
        <div className="mx-auto max-w-xl pt-10 pb-8">
          {!hasCachedProfiles && (discover.isFetching || reaction.isPending) ? <div className="flex justify-center py-6"><QuietSpinner /></div> : <>
            {discover.isError && <FetchErrorBanner text={t("Discover couldn’t refresh. Your last results are still here.")} onRetry={() => void discover.refetch()} />}
            <h1 className="brand text-2xl font-bold">{t("No matching profiles right now")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("Skipped profiles return automatically. Try another location or age range, or check back later.")}</p>
            <button onClick={() => setFiltersOpen(true)} data-testid="button-open-filters-empty" className="mt-5 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">{t("Adjust filters")}</button>
            <button disabled={discover.isFetching} onClick={() => void discover.refetch().then(result => { if (!result.isError) refill(result.data); })}
              data-testid="button-refresh-discovery" className="ml-3 mt-5 rounded-xl bg-secondary px-4 py-3 font-bold disabled:opacity-50">{t("Refresh")}</button>
          </>}
        </div>
        {matchOverlay}
        <FilterDialog open={filtersOpen} onClose={() => setFiltersOpen(false)} value={filterValues} travelMode={Boolean(settings.data?.travelMode)} onApply={applyFilters} />
      </div>
    );
  }

  return (
    <main className="discover-deck mx-auto flex h-full min-h-0 w-full max-w-[680px] flex-col px-4 sm:px-6">
      {stickyHeader}

      {discover.isError && <FetchErrorBanner text={t("Discover couldn’t refresh. Your last results are still here.")} onRetry={() => void discover.refetch()} />}
      <p role="status" data-testid="status-discovery-worldwide" className="mb-2 min-h-4 text-center text-xs text-muted-foreground">{worldwide ? t("Not many people near you yet — showing members worldwide") : ""}</p>
      {notice && <div role="status" data-testid="status-discover" className="mb-3 rounded-xl border border-primary/20 bg-accent px-4 py-3 text-sm text-primary">{t(notice)}<button onClick={() => setNotice("")} aria-label={t("Dismiss message")} className="float-right"><X size={16} /></button></div>}
      {likeConfirmation && <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+1rem)] z-[60] flex justify-center px-4" role="status" aria-live="polite" data-testid="status-discover-liked"><div className="flex items-center gap-2 rounded-full border border-primary/25 bg-[#211a27]/95 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl"><Heart size={17} fill="currentColor" className="text-primary"/>{t(likeConfirmation)}</div></div>}

      <div className="discover-card-slot" data-testid="discover-card-slot">
        <AnimatePresence initial={false} custom={swipeExits}>
          {stackProfiles.map((candidate, depth) => (
            <DiscoverSwipeCard
              key={candidate.id}
              profile={candidate}
              depth={depth}
              active={depth === 0}
              reducedMotion={reducedMotion}
              onSwipe={swipe}
              onOpen={openProfile}
              onOptions={openOptions}
            />
          ))}
        </AnimatePresence>
      </div>
        <div className="discover-actions flex items-center justify-center" aria-label={t("Profile actions")}>
          <button type="button" onClick={(event) => { event.stopPropagation(); swipe(profile.id, "pass"); }} disabled={!!matchResult} data-testid="button-pass-profile" aria-label={t("Pass")} className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-foreground shadow-lg disabled:opacity-40"><X size={27} /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); void undoLastSwipe(); }} disabled={!lastPass || undo.isPending || pendingReactionCount > 0} data-testid="button-undo-pass" aria-label={t("Undo last pass")} className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm disabled:opacity-40"><ArrowLeft size={18} /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); swipe(profile.id, "super"); }} disabled={!!matchResult || superLikeLimitReached} data-testid="button-super-like" aria-label={`${t("Super like")}, ${superLikes.data?.remaining??"unknown"} ${t("left")}`} className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-amber-400 shadow-lg disabled:opacity-40"><Star size={29} fill="currentColor"/></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); swipe(profile.id, "like"); }} disabled={!!matchResult || likeLimitReached} data-testid="button-like-profile" aria-label={t("Like")} className="flex h-16 w-16 items-center justify-center rounded-full bg-card text-primary shadow-lg disabled:opacity-40"><Heart size={31} fill="currentColor" /></button>
        </div>

      <ProfileOptionsDialog open={optionsOpen} onClose={() => setOptionsOpen(false)} onReport={(reason) => void reportCurrent(reason)} onBlock={() => void blockCurrent()} />
      <FilterDialog open={filtersOpen} onClose={() => setFiltersOpen(false)} value={filterValues} travelMode={Boolean(settings.data?.travelMode)} onApply={applyFilters} />
      {matchOverlay}
    </main>
  );
}

function FilterDialog({ open, onClose, value, travelMode, onApply }: {
  open: boolean; onClose: () => void; value: DiscoveryFilters; travelMode: boolean;
  onApply: (value: DiscoveryFilters) => void;
}) {
  const { t } = useAppLanguage();
  return <Dialog open={open} title={t("Discovery filters")} onClose={onClose}><DiscoveryFilterForm initialValue={value} travelMode={travelMode} onApply={onApply} /></Dialog>;
}

function ProfileOptionsDialog({ open, onClose, onReport, onBlock }: { open: boolean; onClose: () => void; onReport: (reason: ReportInputReason) => void; onBlock: () => void }) {
  const { t } = useAppLanguage();
  return <Dialog open={open} title={t("Profile options")} onClose={onClose}><div className="space-y-4">
    <p className="text-sm text-muted-foreground">{t("Manage this profile without opening its details.")}</p>
    <div className="grid grid-cols-2 gap-2 pt-2"><button type="button" onClick={() => onReport("inappropriate")} data-testid="button-report-profile" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold">{t("Report")}</button><button type="button" onClick={onBlock} data-testid="button-block-profile" className="rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-semibold text-rose-300">{t("Block profile")}</button></div>
  </div></Dialog>;
}

function Dialog({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  return <SpringDialog open={open} onClose={onClose} panelClassName="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[26px] border border-white/10 bg-[#211d25] p-5 shadow-2xl sm:rounded-[26px] sm:p-7">
    <div className="mb-6 flex items-center justify-between"><h2 className="brand text-2xl font-bold">{title}</h2><button type="button" onClick={onClose} aria-label="Close" data-testid="button-close-dialog" className="rounded-lg p-2 text-muted-foreground hover:bg-white/5"><X size={19} /></button></div>
    {children}
  </SpringDialog>;
}
