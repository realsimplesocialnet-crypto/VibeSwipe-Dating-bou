import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetReelCommentsQueryKey, useCreateReelComment, useDeleteReelComment, useGetReelComments, type ReelComment,
} from "@workspace/api-client-react";
import { ArrowUp, X } from "lucide-react";
import { ReelAvatar } from "@/components/reels/reel-avatar";
import { userErrorMessage } from "@/lib/user-errors";

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

export function ReelComments({ reelId, onClose, onCountChange }: { reelId: string; onClose: () => void; onCountChange: (delta: number) => void }) {
  const client = useQueryClient();
  const key = getGetReelCommentsQueryKey(reelId);
  const comments = useGetReelComments(reelId, { query: { queryKey: key } });
  const create = useCreateReelComment();
  const remove = useDeleteReelComment();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const count = comments.data?.length ?? 0;
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [count]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || create.isPending) return;
    setError("");
    try {
      const comment = await create.mutateAsync({ reelId, data: { content } });
      client.setQueryData<ReelComment[]>(key, (old) => [...(old ?? []), comment]);
      setDraft("");
      onCountChange(1);
    } catch (reason) {
      setError(userErrorMessage(reason, "Your comment did not post. Try again."));
    }
  }

  async function deleteComment(id: string) {
    setError("");
    try {
      await remove.mutateAsync({ reelId, commentId: id });
      client.setQueryData<ReelComment[]>(key, (old) => (old ?? []).filter((comment) => comment.id !== id));
      setConfirming(null);
      onCountChange(-1);
    } catch (reason) {
      setError(userErrorMessage(reason, "That comment could not be deleted."));
    }
  }

  return <section className="reel-comments" aria-label="Comments" data-testid="panel-reel-comments">
    <header className="flex items-center justify-between px-4 pb-2 pt-3">
      <h2 className="text-sm font-bold">Comments <span className="font-medium text-white/50">{comments.data ? count : ""}</span></h2>
      <button type="button" onClick={onClose} aria-label="Close comments" data-testid="button-close-comments" className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"><X size={18} /></button>
    </header>
    <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
      {comments.isLoading ? <div className="space-y-3 py-2" aria-label="Loading comments">{[0, 1, 2].map((i) => <div key={i} className="flex gap-3"><span className="h-8 w-8 rounded-full bg-white/10" /><span className="h-8 flex-1 rounded-xl bg-white/[.06]" /></div>)}</div>
        : comments.isError ? <div className="py-6 text-center text-sm text-white/60">Comments could not load.<button type="button" onClick={() => void comments.refetch()} className="ml-2 font-semibold text-primary" data-testid="button-retry-comments">Retry</button></div>
        : !count ? <p className="py-6 text-center text-sm text-white/55" data-testid="text-no-comments">No comments yet. Say something kind.</p>
        : <ul className="space-y-3 pb-2">{comments.data!.map((comment) => <li key={comment.id} className="flex gap-3" data-testid={`comment-${comment.id}`}>
          <ReelAvatar reference={comment.authorPhoto} name={comment.authorName} size={32} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/55"><span className="font-semibold text-white/90">{comment.authorName}</span> {ago(comment.createdAt)}</p>
            <p className="break-words text-sm leading-5 text-white">{comment.content}</p>
            {comment.canDelete && (confirming === comment.id
              ? <p className="mt-1 text-xs"><button type="button" onClick={() => void deleteComment(comment.id)} disabled={remove.isPending} className="font-semibold text-rose-300" data-testid={`button-confirm-delete-comment-${comment.id}`}>Delete comment</button><button type="button" onClick={() => setConfirming(null)} className="ml-3 text-white/60">Keep</button></p>
              : <button type="button" onClick={() => setConfirming(comment.id)} className="mt-1 text-xs text-white/45 hover:text-white/80" data-testid={`button-delete-comment-${comment.id}`}>Delete</button>)}
          </div>
        </li>)}</ul>}
    </div>
    {error && <p role="alert" className="px-4 pb-1 text-xs text-rose-300" data-testid="error-reel-comment">{error}</p>}
    <form onSubmit={(event) => void submit(event)} className="flex items-center gap-2 border-t border-white/10 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5">
      <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} placeholder="Add a comment" aria-label="Add a comment" enterKeyHint="send" data-testid="input-reel-comment" className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[.07] px-4 text-[16px] text-white placeholder:text-white/40 focus:border-primary/60 focus:outline-none" />
      <button type="submit" disabled={!draft.trim() || create.isPending} aria-label="Post comment" data-testid="button-post-comment" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-35"><ArrowUp size={19} /></button>
    </form>
  </section>;
}
