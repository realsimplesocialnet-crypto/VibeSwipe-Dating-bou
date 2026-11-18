import { useInfiniteQuery } from "@tanstack/react-query";
import { Bookmark, Clapperboard, Eye, Heart, MessageCircle, Play, Send } from "lucide-react";
import { Link } from "wouter";
import { getGetProfileReelsQueryKey, getProfileReels, type Reel } from "@workspace/api-client-react";
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
    refetchInterval: 5_000,
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
        <div className={isGrid ? "pp-reel-grid mt-3" : "hide-scrollbar -mx-1 mt-3 flex gap-2 overflow-hidden px-1"} role="status" aria-label="Loading Reels">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className={isGrid ? "aspect-[3/4] animate-pulse rounded-xl bg-white/10" : "aspect-[9/16] w-[76px] shrink-0 animate-pulse rounded-xl bg-white/10"} />
          ))}
        </div>
      ) : reelsQuery.isError && !reels.length ? (
        <div className="mt-2 flex items-center gap-3 px-1 text-sm text-[hsl(var(--pp-muted))]" role="alert">
          <span>Reels couldn’t load.</span>
          <button type="button" className="font-semibold text-primary" onClick={() => void reelsQuery.refetch()} data-testid="button-retry-profile-reels">Try again</button>
        </div>
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
            {reelsQuery.isFetchingNextPage && !isGrid && <div className="aspect-[9/16] w-[76px] shrink-0 animate-pulse rounded-xl bg-white/10" aria-label="Loading more Reels" />}
          </div>
          {isGrid && reelsQuery.hasNextPage && (
            <button type="button" onClick={() => void reelsQuery.fetchNextPage()} disabled={reelsQuery.isFetchingNextPage} className="mt-3 min-h-10 w-full rounded-xl border border-white/10 text-sm font-bold text-[hsl(var(--pp-pink))] disabled:opacity-60" data-testid="button-load-more-profile-reels">
              {reelsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      ) : (
        <p className="mt-2 px-1 text-sm text-[hsl(var(--pp-muted))]" data-testid="text-profile-reels-empty">No reels yet.</p>
      )}
    </section>
  );
}

function ProfileReelThumbnail({ reel, returnTo, layout }: { reel: Reel; returnTo: string; layout: "carousel" | "grid" }) {
  const viewCount = Number(reel.viewCount ?? 0);
  const interactionCounts = `${formatCount(reel.likeCount)} likes, ${formatCount(reel.commentCount)} comments, ${formatCount(reel.saveCount)} saves, ${formatCount(reel.shareCount)} shares`;
  return (
    <Link
      href={`/reels/${encodeURIComponent(reel.id)}?profileId=${encodeURIComponent(reel.creatorId)}&returnTo=${encodeURIComponent(returnTo)}`}
      aria-label={`Play Reel: ${reel.caption || `posted by ${reel.creatorName}`}, ${formatCount(viewCount)} ${viewCount === 1 ? "view" : "views"}, ${interactionCounts}`}
      data-testid={`link-profile-reel-${reel.id}`}
      className={`group relative overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-md ${layout === "grid" ? "aspect-[3/4] w-full min-w-0" : "aspect-[9/16] w-[76px] shrink-0 sm:w-[86px]"}`}
    >
      <video
        src={`${reelMediaUrl(reel.videoReference)}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        className="h-full w-full object-cover"
        aria-hidden="true"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/25">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white">
          <Play size={15} fill="currentColor" />
        </span>
      </span>
      <span className={`absolute inset-x-1 bottom-8 grid gap-x-1 gap-y-1 rounded-xl bg-black/85 px-1 py-1 text-[9px] font-extrabold leading-none text-white ${layout === "grid" ? "grid-cols-4" : "grid-cols-2"}`} aria-label={interactionCounts} data-testid={`text-profile-reel-interactions-${reel.id}`}>
          <span className="flex items-center gap-0.5"><Heart size={10} />{formatCount(reel.likeCount)}</span>
          <span className="flex items-center gap-0.5"><MessageCircle size={10} />{formatCount(reel.commentCount)}</span>
          <span className="flex items-center gap-0.5"><Bookmark size={10} />{formatCount(reel.saveCount)}</span>
          <span className="flex items-center gap-0.5"><Send size={10} />{formatCount(reel.shareCount)}</span>
      </span>
      <span className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-full border border-white/25 bg-black/85 px-1 py-1 text-[10px] font-extrabold leading-none tracking-tight text-white shadow-lg" data-testid={`text-profile-reel-views-${reel.id}`}>
        <Eye size={11} strokeWidth={2.5} aria-hidden="true" />
        {formatCount(viewCount)} {viewCount === 1 ? "view" : "views"}
      </span>
    </Link>
  );
}
