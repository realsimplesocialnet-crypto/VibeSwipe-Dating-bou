import { useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMatchesQueryKey, getGetMyReelsQueryKey, getGetProfileLikedReelsQueryKey, getGetProfileReelsQueryKey, getGetProfileRepostedReelsQueryKey, getGetReelQueryKey,
  getGetReelsFeedQueryKey, getGetSavedReelsQueryKey, useGetMatches, useGetMyProfile, useRecordReelShare, useRemoveRepost, useRepostReel, useSendMessage, type Reel,
} from "@workspace/api-client-react";
import { Copy, Repeat2, Share2, X } from "lucide-react";
import { ReelAvatar } from "@/components/reels/reel-avatar";
import { reelShareMessage, reelShareUrl } from "@/lib/reels";
import { userErrorMessage } from "@/lib/user-errors";
import { QuietSpinner } from "@/components/ui/quiet-spinner";

export function ReelShareSheet({ reel, onClose, onCountChange, onCountError }: { reel: Reel; onClose: () => void; onCountChange: (count: number) => void; onCountError?: (message: string) => void }) {
  const client = useQueryClient();
  const matches = useGetMatches({ query: { queryKey: getGetMatchesQueryKey() } });
  const me = useGetMyProfile();
  const send = useSendMessage();
  const recordShare = useRecordReelShare();
  const repost = useRepostReel();
  const removeRepost = useRemoveRepost();
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [repostedByMe, setRepostedByMe] = useState(reel.repostedByMe);
  const url = reelShareUrl(window.location.origin, import.meta.env.BASE_URL, reel.id);
  const chats = (matches.data ?? []).filter((match) => !match.blockedByMe && !match.blockedMe && match.profile.id !== me.data?.id);
  const canNativeShare = typeof navigator.share === "function";

  async function trackShare() {
    const result = await recordShare.mutateAsync({ reelId: reel.id });
    onCountChange(result.shareCount);
    for (const queryKey of [
      getGetReelQueryKey(reel.id),
      getGetReelsFeedQueryKey(),
      getGetProfileReelsQueryKey({ profileId: reel.creatorId }),
      getGetMyReelsQueryKey(),
      getGetSavedReelsQueryKey(),
    ]) void client.invalidateQueries({ queryKey });
  }

  async function toggleRepost() {
    setStatus("");
    setPending("repost");
    try {
      const engagement = repostedByMe
        ? await removeRepost.mutateAsync({ reelId: reel.id })
        : await repost.mutateAsync({ reelId: reel.id });
      setRepostedByMe(engagement.repostedByMe);
      const profileIds = new Set([reel.creatorId, me.data?.id].filter((id): id is string => Boolean(id)));
      for (const queryKey of [
        getGetReelQueryKey(reel.id),
        getGetReelsFeedQueryKey(),
        getGetMyReelsQueryKey(),
        getGetSavedReelsQueryKey(),
      ]) void client.invalidateQueries({ queryKey });
      for (const profileId of profileIds) {
        void client.invalidateQueries({ queryKey: getGetProfileReelsQueryKey({ profileId }) });
        void client.invalidateQueries({ queryKey: getGetProfileLikedReelsQueryKey({ profileId }) });
        void client.invalidateQueries({ queryKey: getGetProfileRepostedReelsQueryKey({ profileId }) });
      }
    } catch (error) {
      setStatus(userErrorMessage(error, repostedByMe ? "Couldn’t remove the repost. Try again." : "Couldn’t repost this Reel. Try again."));
    } finally {
      setPending(null);
    }
  }

  function nativeShare() {
    let sharePromise: Promise<void>;
    try {
      sharePromise = navigator.share({ title: `${reel.creatorName} on Reels`, text: reel.caption || "Watch this Reel", url });
    } catch {
      setStatus("Sharing is not available here. Copy the link instead.");
      return;
    }
    onClose();
    void sharePromise.then(() => trackShare()).catch((error: unknown) => {
      if ((error as { name?: string }).name !== "AbortError") onCountError?.("Shared, but the share count could not be updated.");
    });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); }
    catch { setStatus("Copy failed. Long-press the link to copy it."); return; }
    onClose();
  }
  async function sendTo(matchId: string) {
    setPending(matchId); setStatus("");
    let sent = false;
    try {
      await send.mutateAsync({ matchId, data: { content: reelShareMessage(url, reel.creatorName) } });
      sent = true;
      void client.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
      onClose();
      void trackShare().catch(() => onCountError?.("Sent, but the share count could not be updated."));
    } catch (error) {
      setStatus(userErrorMessage(error, "That message did not send. Try again."));
    } finally { if (!sent) setPending(null); }
  }

  return createPortal(<div className="reel-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="reel-sheet" role="dialog" aria-modal="true" aria-label="Share Reel" data-testid="sheet-share-reel">
      <header className="reel-share-heading">
        <h2 className="text-base font-bold">Send to</h2>
        <button type="button" onClick={onClose} aria-label="Close" data-testid="button-close-share" className="reel-share-close"><X size={20} /></button>
      </header>
      <div className="reel-share-people" aria-label="Send to a match">
        {(matches.isLoading || (matches.isError && !matches.data)) ? <div className="flex min-h-[96px] w-full items-center justify-center"><QuietSpinner onRetry={() => void matches.refetch()} /></div>
          : !chats.length ? <p className="reel-share-empty" data-testid="text-no-share-chats">Your matches will appear here.</p>
          : chats.map((match) => <button
            key={match.id}
            type="button"
            onClick={() => void sendTo(match.id)}
            disabled={pending === match.id}
            aria-label={`Send Reel to ${match.profile.name}`}
            data-testid={`button-share-to-${match.id}`}
            className="reel-share-person"
          >
            <span className="reel-share-person-avatar">
              <ReelAvatar reference={match.profile.photos?.[0] ?? null} name={match.profile.name} size={54} />
              <span className="reel-share-send-mark">{pending === match.id ? <QuietSpinner size={14} /> : <Share2 size={14} />}</span>
            </span>
            <span className="reel-share-person-name">{match.profile.name}</span>
          </button>)}
      </div>
      {status && <p role="status" className="mt-2 text-xs text-white/70" data-testid="status-share-reel">{status}</p>}
      <div className="reel-share-destinations" aria-label="Other sharing options">
        <button type="button" onClick={() => void toggleRepost()} disabled={pending === "repost"}
          data-testid="button-toggle-repost" aria-pressed={repostedByMe} className="reel-share-destination">
          <span className={`reel-share-destination-icon ${repostedByMe ? "is-copy" : ""}`}>{pending === "repost" ? <QuietSpinner size={20}/> : <Repeat2 size={22}/>}</span>
          <span>{repostedByMe ? "Remove repost" : "Repost"}</span>
        </button>
        <button type="button" onClick={() => void copy()} data-testid="button-copy-reel-link" className="reel-share-destination">
          <span className="reel-share-destination-icon is-copy"><Copy size={22} /></span><span>Copy link</span>
        </button>
        <button type="button" onClick={() => void nativeShare()} disabled={!canNativeShare} data-testid="button-native-share" className="reel-share-destination" aria-label="Share to apps">
          <span className="reel-share-destination-icon"><Share2 size={22} /></span><span>More apps</span>
        </button>
      </div>
    </section>
  </div>, document.body);
}
