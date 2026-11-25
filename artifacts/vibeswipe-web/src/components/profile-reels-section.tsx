import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getMyReels, getProfileLikedReels, getProfileReels, getSavedReels, getGetMyReelsQueryKey, getGetProfileLikedReelsQueryKey, getGetProfileReelsQueryKey, getGetSavedReelsQueryKey, type Reel } from "@workspace/api-client-react";
import { Bookmark, Eye, Heart, LayoutGrid, Play } from "lucide-react";
import { Link } from "wouter";
import { QuietSpinner } from "@/components/ui/quiet-spinner";
import { formatCount, reelMediaUrl } from "@/lib/reels";

type MediaTab = "reels" | "saved" | "liked";

export function ProfileReelsSection({ profileId, returnTo, own = false }: {
  profileId: string;
  returnTo: string;
  own?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<MediaTab>("reels");
  useEffect(() => { setActiveTab("reels"); }, [profileId, own]);
  const visibleTab = !own && activeTab === "saved" ? "reels" : activeTab;
  const tabs: { id: MediaTab; label: string; accessibleLabel: string; icon: typeof LayoutGrid }[] = [
    { id: "reels", label: "Reels", accessibleLabel: "Grid / Reels", icon: LayoutGrid },
    ...(own ? [{ id: "saved" as const, label: "Saved", accessibleLabel: "Saved", icon: Bookmark }] : []),
    { id: "liked", label: "Likes", accessibleLabel: "Likes", icon: Heart },
  ];
  const myReels = useInfiniteQuery({
    queryKey: getGetMyReelsQueryKey(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getMyReels(pageParam ? { cursor: pageParam } : undefined, { signal }),
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: own && visibleTab === "reels",
    staleTime: 30_000,
  });
  const profileReels = useInfiniteQuery({
    queryKey: getGetProfileReelsQueryKey({ profileId }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getProfileReels({ profileId, ...(pageParam ? { cursor: pageParam } : {}) }, { signal }),
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: Boolean(profileId) && !own && visibleTab === "reels",
    staleTime: 30_000,
  });
  const saved = useInfiniteQuery({
    queryKey: getGetSavedReelsQueryKey(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getSavedReels(pageParam ? { cursor: pageParam } : undefined, { signal }),
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: own && visibleTab === "saved",
    staleTime: 30_000,
  });
  const liked = useInfiniteQuery({
    queryKey: getGetProfileLikedReelsQueryKey({ profileId }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getProfileLikedReels({ profileId, ...(pageParam ? { cursor: pageParam } : {}) }, { signal }),
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: Boolean(profileId) && visibleTab === "liked",
    staleTime: 30_000,
  });

  const current = visibleTab === "reels" ? (own ? myReels : profileReels)
    : visibleTab === "saved" ? saved : liked;
  const loadedReels: Reel[] = current.data?.pages.flatMap(page => page.items) ?? [];
  const reels = visibleTab === "reels" ? loadedReels.filter(reel => reel.mediaType !== "slides") : loadedReels;
  const isPrivacyLimited = !own && visibleTab === "liked" && current.isError && !current.data;
  const sectionClass = own ? "op-section op-media-tabs shrink-0" : "pp-reels-grid-section pp-media-tabs";
  const tabClass = (tab: MediaTab) => `pp-media-tab ${visibleTab === tab ? "is-active" : ""}`;

  return <section className={sectionClass} data-testid={own ? "section-profile-reels" : "section-public-profile-reels"}>
    <div className="pp-media-tabs-list" role="tablist" aria-label="Profile videos" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map(({ id, label, accessibleLabel = label, icon: Icon }) => <button key={id} type="button" role="tab" aria-label={accessibleLabel} title={accessibleLabel} aria-selected={visibleTab === id}
        aria-controls="profile-media-panel" id={`profile-media-tab-${id}`} onClick={() => setActiveTab(id)}
        className={tabClass(id)} data-testid={`tab-profile-${id}`}>
        <Icon size={18} strokeWidth={2.1}/><span className="sr-only">{label}</span>
      </button>)}
    </div>

      <div id="profile-media-panel" role="tabpanel" aria-labelledby={`profile-media-tab-${visibleTab}`} className="pp-media-panel">
      {current.isLoading ? <div className="pp-media-loading" role="status" aria-label={`Loading ${visibleTab} videos`}>
        <span className="pp-media-skeleton"/><span className="pp-media-skeleton"/><span className="pp-media-skeleton"/>
      </div> : current.isError && !current.data ? <div className="pp-media-state" role="alert">
        <p>{isPrivacyLimited ? "Liked videos aren’t available to this viewer." : "These videos couldn’t be loaded."}</p>
        {!isPrivacyLimited && <button type="button" onClick={() => void current.refetch()} data-testid="button-retry-profile-videos">Try again</button>}
      </div> : reels.length ? <>
        <div className="pp-reel-grid" data-testid={`profile-${visibleTab}-grid`}>
          {reels.map(reel => <ProfileReelThumbnail key={reel.id} reel={reel} returnTo={returnTo}
            profileFeed={visibleTab === "reels"} dataTestPrefix={`profile-${visibleTab}`}/>)}
        </div>
        {current.hasNextPage && <div className="pp-media-pagination">
          {current.isFetchNextPageError && <p role="alert" className="pp-media-page-error">More videos couldn’t be loaded.</p>}
          <button type="button" onClick={() => void current.fetchNextPage()} disabled={current.isFetchingNextPage}
            className="pp-media-load-more" data-testid={`button-load-more-profile-${visibleTab}`}>
            {current.isFetchingNextPage ? <><QuietSpinner size={15}/> Loading</> : current.isFetchNextPageError ? "Try again" : "Load more"}
          </button>
        </div>}
      </> : <div className="pp-media-state" data-testid={`empty-profile-${visibleTab}`}>
        <span className="pp-media-empty-icon">{visibleTab === "saved" ? <Bookmark size={18}/> : visibleTab === "liked" ? <Heart size={18}/> : <LayoutGrid size={18}/>}</span>
        <p>{emptyCopy(visibleTab, own)}</p>
      </div>}
    </div>
  </section>;
}

function emptyCopy(tab: MediaTab, own: boolean) {
  if (tab === "reels") return own ? "Your first Reel will feel right at home here." : "No Reels to show yet.";
  if (tab === "saved") return "Videos you save are private to you.";
  return own ? "Videos you like will appear here." : "No liked videos to show.";
}

function ProfileReelThumbnail({ reel, returnTo, profileFeed, dataTestPrefix }: {
  reel: Reel;
  returnTo: string;
  profileFeed: boolean;
  dataTestPrefix: string;
}) {
  const viewCount = Number(reel.viewCount ?? 0);
  const href = `/reels/${encodeURIComponent(reel.id)}?${profileFeed ? `profileId=${encodeURIComponent(reel.creatorId)}&` : ""}returnTo=${encodeURIComponent(returnTo)}`;
  return <Link href={href}
    aria-label={`Play Reel: ${reel.caption || `posted by ${reel.creatorName}`}, ${formatCount(viewCount)} ${viewCount === 1 ? "view" : "views"}`}
    data-testid={`link-${dataTestPrefix}-${reel.id}`}
    className="pp-reel-tile group relative overflow-hidden rounded-xl">
    {reel.mediaType === "slides"
      ? <img src={reelMediaUrl(reel.slideReferences[0])} alt="" aria-hidden="true" className="h-full w-full object-cover"/>
      : <video src={`${reelMediaUrl(reel.videoReference)}#t=0.1`} preload="metadata" muted playsInline aria-hidden="true" className="h-full w-full object-cover"/>}
    <span className="pp-reel-overlay" aria-hidden="true"><span className="pp-reel-play"><Play size={15} fill="currentColor"/></span></span>
    <span className="pp-reel-views" data-testid={`text-profile-reel-views-${reel.id}`}><Eye size={11}/>{formatCount(viewCount)}</span>
  </Link>;
}
