import { useInfiniteQuery } from "@tanstack/react-query";
import { Clapperboard, Eye, Play } from "lucide-react";
import { Link } from "wouter";
import { QuietSpinner } from "@/components/ui/quiet-spinner";
import { getGetProfileLikedReelsQueryKey, getGetProfileReelsQueryKey, getProfileLikedReels, getProfileReels, type Reel } from "@workspace/api-client-react";
import { formatCount, reelMediaUrl } from "@/lib/reels";

export function ProfileReelsSection({
  profileId,
  returnTo,
  own = false,
  layout = "carousel",
}: {
  profileId: string;
  returnTo: string;
  own?: boolean;
  layout?: "carousel" | "grid";
}) {
  const isGrid = !own && layout === "grid";
  const reelsQuery = useInfiniteQuery({
    queryKey: getGetProfileReelsQueryKey({ profileId }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getProfileReels({ profileId, ...(pageParam ? { cursor: pageParam } : {}) }, { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(profileId),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const reels = reelsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  function loadNextPage(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    if (
      element.scrollWidth - element.scrollLeft - element.clientWidth < 180 &&
      reelsQuery.hasNextPage &&
      !reelsQuery.isFetchingNextPage
    ) {
      void reelsQuery.fetchNextPage();
    }
  }

  return (
    <section
      className={own ? "op-section shrink-0" : isGrid ? "pp-reels-grid-section" : "mt-6"}
      data-testid={own ? "section-profile-reels" : "section-public-profile-reels"}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className={own ? "op-label flex items-center gap-2" : "pp-label flex items-center gap-2"}>
          {own ? <span className="op-ico"><Clapperboard size={13} /></span> : <Clapperboard size={14} />}
          Reels
        </h2>
        {reels.length > 0 && (
          <span className="text-xs font-semibold text-[hsl(var(--pp-muted))]" data-testid="text-profile-reel-count">
            {reels.length}
          </span>
        )}
      </div>

      {reelsQuery.isLoading ? (
        <div className="flex justify-center py-8" role="status" aria-label="Loading Reels"><QuietSpinner /></div>
      ) : reelsQuery.isError && !reels.length ? (
        <div className="flex justify-center py-8" role="status" aria-label="Loading Reels"><QuietSpinner onRetry={() => void reelsQuery.refetch()} /></div>
      ) : reels.length ? (
        <>
          <div
            className={isGrid ? "pp-reel-grid mt-3" : `hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 ${own ? "-mx-1 px-1" : "-mx-5 gap-3 px-5"}`}
            onScroll={isGrid ? undefined : loadNextPage}
            data-testid={isGrid ? "profile-reels-grid" : "profile-reels-carousel"}
          >
            {reels.map((reel) => (
              <ProfileReelThumbnail key={reel.id} reel={reel} returnTo={returnTo} layout={isGrid ? "grid" : "carousel"} />
            ))}
            {reelsQuery.isFetchingNextPage && !isGrid && <div className="flex aspect-[9/16] w-[76px] shrink-0 items-center justify-center rounded-xl bg-white/[.04]" role="status" aria-label="Loading"><QuietSpinner size={18} /></div>}
          </div>
          {isGrid && reelsQuery.hasNextPage && (
            <button type="button" onClick={() => void reelsQuery.fetchNextPage()} disabled={reelsQuery.isFetchingNextPage} className="mt-3 min-h-10 w-full rounded-xl border border-white/10 text-sm font-bold text-[hsl(var(--pp-pink))] disabled:opacity-60" data-testid="button-load-more-profile-reels">
              {reelsQuery.isFetchingNextPage ? <QuietSpinner size={18} /> : "Load more"}
            </button>
          )}
        </>
      ) : (
        <p className="mt-2 px-1 text-sm text-[hsl(var(--pp-muted))]" data-testid="text-profile-reels-empty">No reels yet.</p>
      )}
    </section>
  );
}

export function ProfileLikedReelsSection({ profileId, returnTo, own = false, layout = "carousel" }: {
  profileId: string;
  returnTo: string;
  own?: boolean;
  layout?: "carousel" | "grid";
}) {
  const isGrid = !own && layout === "grid";
  const query = useInfiniteQuery({
    queryKey: getGetProfileLikedReelsQueryKey({ profileId }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getProfileLikedReels({ profileId, ...(pageParam ? { before: pageParam } : {}) }, { signal }),
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: Boolean(profileId),
    staleTime: 30_000,
  });
  const reels = query.data?.pages.flatMap(page => page.items) ?? [];
  function loadNext(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    if (element.scrollWidth - element.scrollLeft - element.clientWidth < 180 && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }
  return <section className={own ? "op-section shrink-0" : isGrid ? "pp-reels-grid-section" : "mt-6"} data-testid={own ? "section-profile-liked-reels" : "section-public-profile-liked-reels"}>
    <div className="flex items-center justify-between px-1"><h2 className={own ? "op-label flex items-center gap-2" : "pp-label flex items-center gap-2"}><span aria-hidden="true">♥</span>Liked videos</h2>{reels.length>0&&<span className="text-xs font-semibold text-[hsl(var(--pp-muted))]">{reels.length}</span>}</div>
    {query.isLoading ? <div className="flex justify-center py-8" role="status" aria-label="Loading liked videos"><QuietSpinner /></div>
      : query.isError ? <p role="status" className="mt-2 px-1 text-sm text-[hsl(var(--pp-muted))]">Liked videos aren’t available to this viewer.</p>
      : reels.length ? <>
        <div className={isGrid?"pp-reel-grid mt-3":`hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 ${own?"-mx-1 px-1":"-mx-5 gap-3 px-5"}`} onScroll={isGrid?undefined:loadNext} data-testid="profile-liked-reels-list">
          {reels.map(reel=><ProfileReelThumbnail key={reel.id} reel={reel} returnTo={returnTo} layout={isGrid?"grid":"carousel"} profileFeed={false}/>)}
        </div>
        {isGrid&&query.hasNextPage&&<button type="button" onClick={()=>void query.fetchNextPage()} disabled={query.isFetchingNextPage} className="mt-3 min-h-10 w-full rounded-xl border border-white/10 text-sm font-bold text-[hsl(var(--pp-pink))] disabled:opacity-60">{query.isFetchingNextPage?<QuietSpinner size={18}/>: "Load more"}</button>}
      </> : <p className="mt-2 px-1 text-sm text-[hsl(var(--pp-muted))]">No liked videos to show.</p>}
  </section>;
}

function ProfileReelThumbnail({ reel, returnTo, layout, profileFeed = true }: { reel: Reel; returnTo: string; layout: "carousel" | "grid"; profileFeed?: boolean }) {
  const viewCount = Number(reel.viewCount ?? 0);
  const href = `/reels/${encodeURIComponent(reel.id)}?${profileFeed ? `profileId=${encodeURIComponent(reel.creatorId)}&` : ""}returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <Link
      href={href}
      aria-label={`Play Reel: ${reel.caption || `posted by ${reel.creatorName}`}, ${formatCount(viewCount)} ${viewCount === 1 ? "view" : "views"}`}
      data-testid={`link-profile-reel-${reel.id}`}
      className={`group relative overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-md ${layout === "grid" ? "aspect-[3/4] w-full min-w-0" : "aspect-[9/16] w-[76px] shrink-0 sm:w-[86px]"}`}
    >
      {reel.mediaType === "slides"
        ? <img src={reelMediaUrl(reel.slideReferences[0])} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        : <video
          src={`${reelMediaUrl(reel.videoReference)}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full object-cover"
          aria-hidden="true"
        />}
      <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/25">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white">
          <Play size={15} fill="currentColor" />
        </span>
      </span>
      <span className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-full border border-white/25 bg-black/85 px-1 py-1 text-[10px] font-extrabold leading-none tracking-tight text-white shadow-lg" data-testid={`text-profile-reel-views-${reel.id}`}>
        <Eye size={11} strokeWidth={2.5} aria-hidden="true" />
        {formatCount(viewCount)} {viewCount === 1 ? "view" : "views"}
      </span>
    </Link>
  );
}
