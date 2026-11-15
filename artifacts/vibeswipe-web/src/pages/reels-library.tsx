import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMyReelsQueryKey, getGetSavedReelsQueryKey, useDeleteReel, useGetMyReels, useGetSavedReels, type Reel,
} from "@workspace/api-client-react";
import { ArrowLeft, Bookmark, Clapperboard, Heart, Trash2 } from "lucide-react";
import { formatCount, reelLibraryNavigation, reelMediaUrl } from "@/lib/reels";
import "@/components/reels/reels.css";

export function ReelsLibraryPage() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const [tab, setTab] = useState<"saved" | "posted">(() => new URLSearchParams(window.location.search).get("tab") === "posted" ? "posted" : "saved");
  const saved = useGetSavedReels(undefined, { query: { queryKey: getGetSavedReelsQueryKey(), enabled: tab === "saved" } });
  const mine = useGetMyReels(undefined, { query: { queryKey: getGetMyReelsQueryKey(), enabled: tab === "posted" } });
  const del = useDeleteReel();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState("");
  const query = tab === "saved" ? saved : mine;
  const items = query.data?.items ?? [];
  const { returnTo, here } = reelLibraryNavigation(window.location.search, tab);

  async function remove(id: string) {
    setError("");
    try {
      await del.mutateAsync({ reelId: id });
      setConfirm(null);
      await client.invalidateQueries({ queryKey: getGetMyReelsQueryKey() });
      void client.invalidateQueries({ queryKey: getGetSavedReelsQueryKey() });
    } catch { setError("That Reel could not be deleted. Try again."); }
  }

  return <div className="reel-library" data-testid="page-reels-library">
    <header className="flex items-center gap-3 px-4 pb-3 pt-[max(env(safe-area-inset-top),14px)]">
      <button type="button" onClick={() => setLocation(returnTo)} aria-label="Back" data-testid="button-library-back" className="reels-icon"><ArrowLeft size={24} /></button>
      <h1 className="reels-title">Your Reels</h1>
      <Link href={`/reels?returnTo=${encodeURIComponent(here)}`} className="reel-pill ml-auto" data-testid="link-library-watch">Watch Reels</Link>
    </header>
    <div className="mx-auto w-full max-w-[680px] px-4">
      <div className="mb-4 flex rounded-full border border-white/10 bg-white/[.04] p-1" role="tablist">
        {(["saved", "posted"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} data-testid={`tab-reels-${value}`} className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold ${tab === value ? "bg-primary text-primary-foreground" : "text-white/60"}`}>
          {value === "saved" ? <Bookmark size={15} /> : <Clapperboard size={15} />}{value === "saved" ? "Saved" : "Posted"}
        </button>)}
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-rose-300">{error}</p>}
      {query.isLoading ? <div className="grid grid-cols-3 gap-1.5">{Array.from({ length: 6 }, (_, i) => <div key={i} className="reel-tile animate-pulse" />)}</div>
        : query.isError ? <div className="py-14 text-center text-sm text-white/60">Your Reels could not load.<button type="button" onClick={() => void query.refetch()} className="ml-2 font-semibold text-primary" data-testid="button-retry-library">Retry</button></div>
        : !items.length ? <div className="flex flex-col items-center py-16 text-center">
          <span className="reels-empty-mark">{tab === "saved" ? <Bookmark size={26} /> : <Clapperboard size={26} />}</span>
          <p className="mt-4 font-bold">{tab === "saved" ? "Nothing saved yet" : "You have not posted a Reel"}</p>
          <p className="mt-1 max-w-[260px] text-sm text-white/55">{tab === "saved" ? "Tap the bookmark on any Reel. Only you can see what you save." : "Record or choose a short video to share with the community."}</p>
          <Link href={tab === "saved" ? `/reels?returnTo=${encodeURIComponent(here)}` : `/reels/new?returnTo=${encodeURIComponent(here)}`} className="reels-primary mt-6" data-testid="link-library-empty-action">{tab === "saved" ? "Browse Reels" : "Post a Reel"}</Link>
        </div>
        : <ul className="grid grid-cols-3 gap-1.5 pb-10">{items.map((reel: Reel) => <li key={reel.id} className="relative">
          <Link href={`/reels/${reel.id}?returnTo=${encodeURIComponent(here)}`} className="reel-tile block" data-testid={`link-reel-tile-${reel.id}`} aria-label={`Open Reel by ${reel.creatorName}`}>
            <video src={`${reelMediaUrl(reel.videoReference)}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
            <span className="reel-tile-meta"><Heart size={12} fill="currentColor" />{formatCount(reel.likeCount)}<span className="ml-auto truncate">{tab === "saved" ? reel.creatorName : ""}</span></span>
          </Link>
          {tab === "posted" && (confirm === reel.id
            ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/80 p-2 text-center"><p className="text-xs font-semibold">Delete this Reel?</p><button type="button" onClick={() => void remove(reel.id)} disabled={del.isPending} className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-bold text-white" data-testid={`button-confirm-delete-tile-${reel.id}`}>Delete</button><button type="button" onClick={() => setConfirm(null)} className="text-xs text-white/70">Keep</button></div>
            : <button type="button" onClick={() => setConfirm(reel.id)} aria-label="Delete Reel" data-testid={`button-delete-tile-${reel.id}`} className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"><Trash2 size={15} /></button>)}
        </li>)}</ul>}
    </div>
  </div>;
}
