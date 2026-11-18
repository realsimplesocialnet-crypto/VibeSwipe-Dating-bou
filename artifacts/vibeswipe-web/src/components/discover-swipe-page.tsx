import { useEffect, useMemo, useRef, useState } from "react";
import { discoveryFilterParams, type DiscoveryFilters } from "@/lib/discovery-filters";
import { DiscoveryFilterForm } from "@/components/discovery-filter-form";
import { VerifiedBadge } from "@/components/verified-badge";
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
  getGetSuperLikeStatusQueryKey,
  getGetVibeSwipeSettingsQueryKey,
  getProfileDatingState,
  getProfileFollowSummary,
  getMediaPreview,
  useActivateBoost,
  useBlockProfile,
  useCreateReaction,
  useGetBoostStatus,
  useGetDailyLikeStatus,
  useGetDiscoverProfiles,
  useGetMyProfile,
  useGetMediaPreview,
  useGetSuperLikeStatus,
  useGetVibeSwipeSettings,
  useRecordProfileView,
  useReportProfile,
  useUndoLastPass,
  type Profile,
  type ReportInputReason,
} from "@workspace/api-client-react";
import { ArrowLeft, Heart, MapPin, MoreHorizontal, Search, SlidersHorizontal, Star, X, Zap } from "lucide-react";
import { isDiscoverSetupRequired, shouldRetryDiscover } from "@/lib/profile-query-state";
import { StoriesRow } from "@/components/stories/stories-ui";
import { MatchCelebration } from "@/components/match-celebration";

const mediaUrl = (ref?: string | null) => ref
  ? ref.startsWith("http")
    ? ref
    : ref.startsWith("media:")
      ? `/api/vibeswipe/media/${encodeURIComponent(ref.slice(6))}`
      : ref.startsWith("demo:")
        ? ""
        : `/api/storage${ref.startsWith("/") ? ref : `/${ref}`}`
  : "";
const useDiscoveryDeck = createUseDiscoveryDeck(useState);

export function DiscoverSwipePage() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [appliedFilters, setAppliedFilters] = useState<DiscoveryFilters | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [likeConfirmation, setLikeConfirmation] = useState("");
  const [lastPass, setLastPass] = useState<string | null>(null);
  const [swipeMotion, setSwipeMotion] = useState<"pass" | "like" | "super" | null>(null);
  const swipeLock = useRef(false);
  const [matchResult, setMatchResult] = useState<{ profile: Profile; matchId: string | null } | null>(null);
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
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressCardOpen = useRef(false);
  const previousTravelFilter = useRef<string | null>(null);
  const settings = useGetVibeSwipeSettings({ query: { queryKey: getGetVibeSwipeSettingsQueryKey() } });
  useEffect(() => () => {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
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
  useEffect(() => {
    const upcoming = profiles.slice(index, index + 8);
    for (const candidate of upcoming) {
      const key = getGetProfileByIdQueryKey(candidate.id);
      const cached = queryClient.getQueryState(key);
      if (!cached?.data || Date.now() - cached.dataUpdatedAt > 10 * 60_000) {
        void queryClient.prefetchQuery({ queryKey: key, queryFn: async () => candidate, staleTime: 10 * 60_000, gcTime: 30 * 60_000 });
      }
    }
    for (const candidate of upcoming.slice(0, 3)) {
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
  }, [profiles, index, queryClient]);
  const worldwide = Boolean(profile?.discoveryExpanded || discover.data?.some(p => p.discoveryExpanded));
  const reaction = useCreateReaction();
  const undo = useUndoLastPass();
  const likes = useGetDailyLikeStatus({ query: { queryKey: getGetDailyLikeStatusQueryKey(), refetchInterval: 60_000 } });
  const superLikes = useGetSuperLikeStatus({ query: { queryKey: getGetSuperLikeStatusQueryKey(), refetchInterval: 60_000 } });
  const boost = useGetBoostStatus({ query: { queryKey: getGetBoostStatusQueryKey(), refetchInterval: 10_000 } });
  const activateBoost = useActivateBoost();
  const recordView = useRecordProfileView();
  const block = useBlockProfile();
  const report = useReportProfile();
  const viewed = useRef(new Set<string>());
  const tailRequested = useRef("");
  useEffect(() => {
    const tailKey = `${feedKey}:${index}`;
    if (index < 1 || index < profiles.length - 2 || reaction.isPending || discover.isFetching || tailRequested.current === tailKey) return;
    tailRequested.current = tailKey;
    const exhausted = index >= profiles.length;
    // A prefetch started before the last swipe can contain that now-liked card.
    // Only start a new round from a request sent after the stack was exhausted.
    void discover.refetch().then(result => { if (exhausted && !result.isError) refill(result.data); });
  }, [feedKey, index, profiles.length, reaction.isPending, discover.isFetching]);
  const matchOverlay = <MatchCelebration
    visible={!!matchResult} self={(myProfile.data as Profile | undefined) ?? null}
    other={matchResult?.profile ?? null} canMessage={Boolean(matchResult?.matchId)}
    onMessage={() => { const id = matchResult?.matchId; if (!id) return; setMatchResult(null); setLocation(`/chat/${id}?returnTo=%2Fdiscover`); }}
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
    if (profile && !profile.isDemo && !viewed.current.has(profile.id)) {
      viewed.current.add(profile.id);
      recordView.mutate({ profileId: profile.id });
    }
  }, [profile?.id]);

  async function swipe(type: "pass" | "like" | "super") {
    if (!profile || swipeLock.current || reaction.isPending || likeConfirmation || matchResult) return;
    if (type === "like" && likes.data?.remaining === 0) {
      setNotice("You’ve reached your daily like limit. Come back in 24 hours.");
      return;
    }
    const current = profile;
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    swipeLock.current = true;
    setSwipeMotion(type);
    setNotice("");
    try {
      const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220;
      const [result] = await Promise.all([
        reaction.mutateAsync({ data: { toUserId: current.id, type } }),
        new Promise<void>(resolve => window.setTimeout(resolve, duration)),
      ]);
      setIndex((value) => value + 1);
      setLastPass(type === "pass" ? current.id : null);
      if (type === "like") void queryClient.invalidateQueries({ queryKey: getGetDailyLikeStatusQueryKey() });
      if (type === "super") void queryClient.invalidateQueries({ queryKey: getGetSuperLikeStatusQueryKey() });
      if (result.matched) {
        void queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
      }
      if (type === "like" || type === "super" || result.matched) {
        setLikeConfirmation(result.matched ? `You and ${current.name} matched.` : type === "super" ? `You super liked ${current.name}` : `You liked ${current.name}`);
        noticeTimer.current = window.setTimeout(() => {
          setLikeConfirmation("");
          if (result.matched) setMatchResult({ profile: current, matchId: result.matchId ?? null });
        }, 1500);
      }
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        setIndex((value) => value + 1);
        setNotice("This profile is no longer available. Finding someone new.");
        void discover.refetch();
        return;
      }
      setNotice("That swipe did not save. Try again.");
    } finally {
      setSwipeMotion(null);
      swipeLock.current = false;
    }
  }

  async function undoLastSwipe() {
    if (!lastPass || undo.isPending || swipeLock.current) return;
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
      <div className="flex min-h-11 items-center gap-2.5">{!profile && <StoriesRow mode="own"/>}<span className="min-w-0 flex-1 text-[11px] text-muted-foreground" data-testid="text-discover-likes">{likes.data?.remaining??"—"} likes left</span><button type="button" onClick={()=>setLocation("/search")} aria-label="Search members" data-testid="button-member-search" className="flex h-10 w-9 shrink-0 items-center justify-center text-primary"><Search size={20}/></button><button type="button" onClick={()=>setFiltersOpen(true)} aria-label="Discovery filters" data-testid="button-discovery-filters" className="flex h-10 w-9 shrink-0 items-center justify-center text-primary"><SlidersHorizontal size={22}/></button></div>
      <div className="mt-1.5 flex items-center justify-between pl-1"><h1 className="text-[13px] font-semibold text-foreground">Meet someone new</h1><button type="button" onClick={()=>void startBoost()} disabled={!boost.data?.available||activateBoost.isPending} aria-label={boost.data?.active?"Boost active":"Activate boost"} data-testid="button-activate-boost" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-primary disabled:opacity-40"><Zap size={12}/>Boost</button></div>
    </header>
    <StoriesRow mode={profile ? "all" : "matches"}/>
  </div>;
  if (discover.isLoading) {
    return <div className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-muted-foreground">Finding people nearby…</div>;
  }
  if (discover.isError && isDiscoverSetupRequired(discover.error)) return <Redirect to="/onboarding" />;
  if (discover.isError && (!discover.data || [401, 403, 409].includes(discover.error.status))) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">Discovery could not load right now.</p>
        <button onClick={() => void discover.refetch().then(result => { if (!result.isError) refill(result.data); })} className="mt-4 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold">Try again</button>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="mx-auto max-w-[680px] px-4 pb-5 text-center sm:px-6 sm:pb-7">
        {stickyHeader}
        <div className="mx-auto max-w-xl pt-10 pb-8"><h1 className="brand text-2xl font-bold">{discover.isFetching || reaction.isPending ? "Finding more people…" : "No matching profiles right now"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{discover.isFetching || reaction.isPending ? "Checking for more matching profiles." : "Skipped profiles return automatically. Try another location or age range to meet more people."}</p>
        <button onClick={() => setFiltersOpen(true)} data-testid="button-open-filters-empty" className="mt-5 rounded-xl bg-primary px-4 py-3 font-bold text-[#27101d]">Adjust filters</button>
        <button disabled={discover.isFetching} onClick={() => void discover.refetch().then(result => { if (!result.isError) refill(result.data); })}
          data-testid="button-refresh-discovery" className="ml-3 mt-5 rounded-xl bg-secondary px-4 py-3 font-bold disabled:opacity-50">Try again</button></div>
        {matchOverlay}
        <FilterDialog open={filtersOpen} onClose={() => setFiltersOpen(false)} value={filterValues} travelMode={Boolean(settings.data?.travelMode)} onApply={applyFilters} />
      </div>
    );
  }

  return (
    <main className="discover-deck mx-auto flex h-full min-h-0 w-full max-w-[680px] flex-col px-4 sm:px-6">
      {stickyHeader}

      <p role="status" data-testid="status-discovery-worldwide" className="mb-2 min-h-4 text-center text-xs text-muted-foreground">{worldwide ? "Not many people near you yet — showing members worldwide" : ""}</p>
      {notice && <div role="status" data-testid="status-discover" className="mb-3 rounded-xl border border-primary/20 bg-accent px-4 py-3 text-sm text-[#ffafd1]">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message" className="float-right"><X size={16} /></button></div>}
      {likeConfirmation && <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+1rem)] z-[60] flex justify-center px-4" role="status" aria-live="polite" data-testid="status-discover-liked"><div className="flex items-center gap-2 rounded-full border border-primary/25 bg-[#211a27]/95 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl"><Heart size={17} fill="currentColor" className="text-primary"/>{likeConfirmation}</div></div>}

      <div className="discover-card-slot" data-testid="discover-card-slot">
      <article
        key={profile.id}
        data-swipe={swipeMotion ?? "idle"}
        aria-busy={!!swipeMotion}
        className="relative isolate flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-[30px] bg-[#17141b] shadow-xl"
        onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          if (!start) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
            suppressCardOpen.current = true;
            window.setTimeout(() => { suppressCardOpen.current = false; }, 350);
          }
          if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.2) void swipe(dx > 0 ? "like" : "pass");
          touchStart.current = null;
        }}
        onClick={() => {
          if (suppressCardOpen.current || swipeLock.current) return;
          const key = getGetProfileByIdQueryKey(profile.id);
          const cachedProfile = queryClient.getQueryState(key);
          if (!cachedProfile?.data || Date.now() - cachedProfile.dataUpdatedAt > 10 * 60_000) {
            void queryClient.prefetchQuery({ queryKey: key, queryFn: async () => profile, staleTime: 10 * 60_000, gcTime: 30 * 60_000 });
          }
          const followKey = getGetProfileFollowSummaryQueryKey(profile.id);
          void queryClient.prefetchQuery({ queryKey: followKey, queryFn: ({ signal }) => getProfileFollowSummary(profile.id, { signal }), staleTime: 10 * 60_000, gcTime: 30 * 60_000 });
          const datingKey = getGetProfileDatingStateQueryKey(profile.id);
          void queryClient.prefetchQuery({ queryKey: datingKey, queryFn: ({ signal }) => getProfileDatingState(profile.id, { signal }), staleTime: 10 * 60_000, gcTime: 30 * 60_000 });
          setLocation(`/profile/${profile.id}?returnTo=%2Fdiscover`);
        }}
        onKeyDown={(event) => {
          if (!swipeLock.current && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
             setLocation(`/profile/${profile.id}?returnTo=%2Fdiscover`);
          }
        }}
        data-testid={`card-discover-${profile.id}`}
        aria-label={`${profile.name}${profile.age !== null ? `, ${profile.age}` : ""}. Tap to view full profile.`}
        tabIndex={0}
      >
        <div className="relative min-h-0 flex-1">
          {profile.photos?.[0]
             ? <ProfilePhoto key={profile.id} reference={profile.photos[0]} alt={`${profile.name}${profile.age !== null ? `, ${profile.age}` : ""}`} className="absolute inset-0 h-full w-full object-cover object-top" />
            : <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_25%,#9f6076,#382b3a_55%,#1b1820)]" />}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#130f16] via-[#17121a]/10 to-[#17121a]/10" />
          <button type="button" onClick={(event) => { event.stopPropagation(); setOptionsOpen(true); }} data-testid="button-profile-details" aria-label={`Profile options for ${profile.name}`} className="absolute right-4 top-4 z-[2] rounded-full border border-white/20 bg-black/40 p-2.5 text-white backdrop-blur"><MoreHorizontal size={19} /></button>
          <div className="pointer-events-none absolute inset-x-5 bottom-5">
            <div className="flex min-w-0 items-end justify-between gap-3"><h2 className="min-w-0 break-words text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">{profile.name}<VerifiedBadge verified={profile.isVerified}/></h2>{profile.age !== null && <span className="shrink-0 pb-0.5 text-xl text-white/80 sm:text-2xl">{profile.age}</span>}</div>
            <div className="mt-2 flex min-w-0 items-center gap-1.5 text-sm text-white/80"><MapPin size={14} className="shrink-0" /><span className="truncate">{[profile.city, profile.state, profile.country].filter(Boolean).join(", ") || "Nearby"}</span></div>
            {!!profile.interests?.length && <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-white/20 bg-black/25 px-3 py-1 text-xs text-white backdrop-blur">{profile.interests[0]}</span></div>}
          </div>
        </div>

      </article>
      </div>
        <div className="discover-actions flex items-center justify-center" aria-label="Profile actions" aria-busy={!!swipeMotion}>
          <button type="button" onClick={(event) => { event.stopPropagation(); void swipe("pass"); }} disabled={reaction.isPending || !!likeConfirmation || !!matchResult} data-testid="button-pass-profile" aria-label="Pass" className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-foreground shadow-lg disabled:opacity-40"><X size={27} /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); void undoLastSwipe(); }} disabled={!lastPass || undo.isPending} data-testid="button-undo-pass" aria-label="Undo last pass" className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm disabled:opacity-40"><ArrowLeft size={18} /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); void swipe("super"); }} disabled={reaction.isPending || !!likeConfirmation || !!matchResult || superLikes.data?.remaining === 0} data-testid="button-super-like" aria-label={`Super like, ${superLikes.data?.remaining??"unknown"} left`} className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-amber-400 shadow-lg disabled:opacity-40"><Star size={29} fill="currentColor"/></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); void swipe("like"); }} disabled={reaction.isPending || !!likeConfirmation || !!matchResult || likes.data?.remaining === 0} data-testid="button-like-profile" aria-label="Like" className="flex h-16 w-16 items-center justify-center rounded-full bg-card text-primary shadow-lg disabled:opacity-40"><Heart size={31} fill="currentColor" /></button>
        </div>

      {optionsOpen && <ProfileOptionsDialog onClose={() => setOptionsOpen(false)} onReport={(reason) => void reportCurrent(reason)} onBlock={() => void blockCurrent()} />}
      <FilterDialog open={filtersOpen} onClose={() => setFiltersOpen(false)} value={filterValues} travelMode={Boolean(settings.data?.travelMode)} onApply={applyFilters} />
      {matchOverlay}
    </main>
  );
}

function ProfilePhoto({ reference, alt, className }: { reference: string; alt: string; className: string }) {
  const mediaId = reference.startsWith("media:") ? reference.slice(6) : "";
  const media = useGetMediaPreview(mediaId, {
    query: { enabled: Boolean(mediaId), queryKey: getGetMediaPreviewQueryKey(mediaId), staleTime: 10 * 60_000, gcTime: 30 * 60_000 },
  });
  const [objectUrl, setObjectUrl] = useState("");
  useEffect(() => {
    if (!media.data) return;
    const url = URL.createObjectURL(media.data);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [media.data]);
  const src = mediaId ? objectUrl : mediaUrl(reference);
  return src ? <img src={src} alt={alt} className={className} loading="eager" fetchPriority="high" decoding="async" /> : null;
}

function FilterDialog({ open, onClose, value, travelMode, onApply }: {
  open: boolean; onClose: () => void; value: DiscoveryFilters; travelMode: boolean;
  onApply: (value: DiscoveryFilters) => void;
}) {
  if (!open) return null;
  return <Dialog title="Discovery filters" onClose={onClose}><DiscoveryFilterForm initialValue={value} travelMode={travelMode} onApply={onApply} /></Dialog>;
}

function ProfileOptionsDialog({ onClose, onReport, onBlock }: { onClose: () => void; onReport: (reason: ReportInputReason) => void; onBlock: () => void }) {
  return <Dialog title="Profile options" onClose={onClose}><div className="space-y-4">
    <p className="text-sm text-muted-foreground">Manage this profile without opening its details.</p>
    <div className="grid grid-cols-2 gap-2 pt-2"><button type="button" onClick={() => onReport("inappropriate")} data-testid="button-report-profile" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold">Report</button><button type="button" onClick={onBlock} data-testid="button-block-profile" className="rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-semibold text-rose-300">Block profile</button></div>
  </div></Dialog>;
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[26px] border border-white/10 bg-[#211d25] p-5 shadow-2xl sm:rounded-[26px] sm:p-7">
      <div className="mb-6 flex items-center justify-between"><h2 className="brand text-2xl font-bold">{title}</h2><button type="button" onClick={onClose} aria-label="Close" data-testid="button-close-dialog" className="rounded-lg p-2 text-muted-foreground hover:bg-white/5"><X size={19} /></button></div>
      {children}
    </section>
  </div>;
}
