import { useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMatchesQueryKey, getGetMyReelsQueryKey, getGetProfileReelsQueryKey, getGetReelQueryKey,
  getGetReelsFeedQueryKey, getGetSavedReelsQueryKey, useGetMatches, useGetMyProfile, useRecordReelShare, useSendMessage, type Reel,
} from "@workspace/api-client-react";
import { Copy, Download, Share2, X } from "lucide-react";
import { ReelAvatar } from "@/components/reels/reel-avatar";
import { reelShareMessage, reelShareUrl } from "@/lib/reels";
import { userErrorMessage } from "@/lib/user-errors";
import { QuietSpinner } from "@/components/ui/quiet-spinner";

export function ReelShareSheet({ reel, onClose, onCountChange, onCountError, onDownload }: { reel: Reel; onClose: () => void; onCountChange: (count: number) => void; onCountError?: (message: string) => void; onDownload: () => Promise<void> }) {
  const client = useQueryClient();
  const matches = useGetMatches({ query: { queryKey: getGetMatchesQueryKey() } });
  const me = useGetMyProfile();
  const send = useSendMessage();
  const recordShare = useRecordReelShare();
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState("");
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
  async function download() {
    setPending("download");
    setStatus("Preparing download…");
    try {
      await onDownload();
      onClose();
    } catch {
      setStatus("This Reel could not be downloaded. Try again.");
    } finally {
      setPending(null);
    }
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
        <button type="button" onClick={() => void copy()} data-testid="button-copy-reel-link" className="reel-share-destination">
          <span className="reel-share-destination-icon is-copy"><Copy size={22} /></span><span>Copy link</span>
        </button>
        {reel.canDownload && <button type="button" onClick={() => void download()} disabled={pending === "download"} data-testid="button-download-reel" className="reel-share-destination">
          <span className="reel-share-destination-icon is-copy">{pending === "download" ? <QuietSpinner size={18} /> : <Download size={22} />}</span><span>Download</span>
        </button>}
        <button type="button" onClick={() => void nativeShare()} disabled={!canNativeShare} data-testid="button-native-share" className="reel-share-destination" aria-label="Share to apps">
          <span className="reel-share-destination-icon"><Share2 size={22} /></span><span>More apps</span>
        </button>
      </div>
    </section>
  </div>, document.body);
}
