import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMatchesQueryKey, getGetMyReelsQueryKey, getGetProfileReelsQueryKey, getGetReelQueryKey,
  getGetReelsFeedQueryKey, getGetSavedReelsQueryKey, useGetMatches, useRecordReelShare, useSendMessage, type Reel,
} from "@workspace/api-client-react";
import { Check, Copy, Share2, X } from "lucide-react";
import { ReelAvatar } from "@/components/reels/reel-avatar";
import { reelShareMessage, reelShareUrl } from "@/lib/reels";
import { userErrorMessage } from "@/lib/user-errors";

export function ReelShareSheet({ reel, onClose, onCountChange, onCountError }: { reel: Reel; onClose: () => void; onCountChange: (count: number) => void; onCountError?: (message: string) => void }) {
  const client = useQueryClient();
  const matches = useGetMatches({ query: { queryKey: getGetMatchesQueryKey() } });
  const send = useSendMessage();
  const recordShare = useRecordReelShare();
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const url = reelShareUrl(window.location.origin, import.meta.env.BASE_URL, reel.id);
  const chats = (matches.data ?? []).filter((match) => !match.blockedByMe && !match.blockedMe);
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

  async function nativeShare() {
    try { await navigator.share({ title: `${reel.creatorName} on Reels`, text: reel.caption || "Watch this Reel", url }); }
    catch (error) { if ((error as { name?: string }).name !== "AbortError") setStatus("Sharing is not available here. Copy the link instead."); return; }
    onClose();
    void trackShare().catch(() => onCountError?.("Shared, but the share count could not be updated."));
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); }
    catch { setStatus("Copy failed. Long-press the link to copy it."); return; }
    setStatus("Link copied.");
  }
  async function sendTo(matchId: string) {
    setPending(matchId); setStatus("");
    try {
      await send.mutateAsync({ matchId, data: { content: reelShareMessage(url, reel.creatorName) } });
      setSent((value) => ({ ...value, [matchId]: true }));
      void client.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
      void trackShare().catch(() => setStatus("Sent, but the share count could not be updated."));
    } catch (error) {
      setStatus(userErrorMessage(error, "That message did not send. Try again."));
    } finally { setPending(null); }
  }

  return <div className="reel-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="reel-sheet" role="dialog" aria-modal="true" aria-label="Share Reel" data-testid="sheet-share-reel">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-bold">Share Reel</h2><button type="button" onClick={onClose} aria-label="Close" data-testid="button-close-share" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"><X size={18} /></button></div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void nativeShare()} disabled={!canNativeShare} data-testid="button-native-share" className="reel-sheet-action"><Share2 size={18} />Share to apps</button>
        <button type="button" onClick={() => void copy()} data-testid="button-copy-reel-link" className="reel-sheet-action"><Copy size={18} />Copy link</button>
      </div>
      {status && <p role="status" className="mt-3 text-xs text-white/70" data-testid="status-share-reel">{status}</p>}
      <h3 className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[.16em] text-white/45">Send in a chat</h3>
      <div className="max-h-[38dvh] overflow-y-auto">
        {matches.isLoading ? <p className="py-4 text-sm text-white/55">Loading your chats...</p>
          : matches.isError ? <p className="py-4 text-sm text-white/55">Chats could not load. <button type="button" onClick={() => void matches.refetch()} className="font-semibold text-primary">Retry</button></p>
          : !chats.length ? <p className="py-4 text-sm text-white/55" data-testid="text-no-share-chats">Only mutual matches can message. Match with someone to share Reels in chat.</p>
          : <ul className="space-y-1">{chats.map((match) => <li key={match.id} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-white/[.05]">
            <ReelAvatar reference={match.profile.photos?.[0] ?? null} name={match.profile.name} size={40} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{match.profile.name}</span>
            <button type="button" onClick={() => void sendTo(match.id)} disabled={pending === match.id || sent[match.id]} data-testid={`button-share-to-${match.id}`} className={`inline-flex min-w-[72px] items-center justify-center gap-1 rounded-full px-4 py-2 text-xs font-bold ${sent[match.id] ? "bg-white/10 text-white/70" : "bg-primary text-primary-foreground"} disabled:cursor-default`}>
              {sent[match.id] ? <><Check size={13} />Sent</> : pending === match.id ? "Sending" : "Send"}
            </button>
          </li>)}</ul>}
      </div>
    </section>
  </div>;
}
