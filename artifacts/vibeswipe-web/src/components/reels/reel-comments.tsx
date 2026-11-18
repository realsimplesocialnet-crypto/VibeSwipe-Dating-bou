import { useEffect, useRef, useState, type FormEvent, type TouchEvent as ReactTouchEvent } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetReelCommentsQueryKey, useCreateReelComment, useDeleteReelComment, useGetMyProfile, useGetReelComments, type ReelComment,
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

function ExpandableCommentText({ commentId, content, prefix }: { commentId: string; content: string; prefix?: { label: string; href: string } }) {
  const text = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const element = text.current;
    if (!element || expanded) return;
    const measure = () => setHasMore(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [content, expanded]);

  return <>
    <p ref={text} className={`break-words text-sm leading-5 text-white ${expanded ? "" : "reel-comment-clamp"}`} data-testid={`text-reel-comment-${commentId}`}>
      {prefix && <><Link href={prefix.href} className="font-semibold text-primary hover:underline">{prefix.label}</Link>{" "}</>}{content}
    </p>
    {hasMore && <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-0.5 text-xs font-semibold text-white/60 hover:text-primary" aria-expanded={expanded} data-testid={`button-more-comment-${commentId}`}>{expanded ? "Less" : "More"}</button>}
  </>;
}

export function ReelComments({ reelId, creatorId, returnTo, commentCount, onClose, onCountChange, focusCommentId }: { reelId: string; creatorId: string; returnTo: string; commentCount: number; onClose: () => void; onCountChange: (delta: number) => void; focusCommentId?: string | null }) {
  const client = useQueryClient();
  const key = getGetReelCommentsQueryKey(reelId);
  const comments = useGetReelComments(reelId, { query: { queryKey: key } });
  const me = useGetMyProfile();
  const create = useCreateReelComment();
  const remove = useDeleteReelComment();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReelComment | null>(null);
  const count = commentCount;
  const visibleCount = comments.data?.length ?? 0;
  function startCloseGesture(event: ReactTouchEvent<HTMLElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest("input, button, a, textarea")) {
      touchStart.current = null;
      return;
    }
    const touch = event.changedTouches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  function finishCloseGesture(event: ReactTouchEvent<HTMLElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (deltaY > 64 && Math.abs(deltaX) < 80 && (list.current?.scrollTop ?? 0) <= 0) onClose();
  }
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [visibleCount]);
  useEffect(() => {
    if (!focusCommentId || !comments.data) return;
    list.current?.querySelector<HTMLElement>(`[data-comment-id="${focusCommentId}"]`)?.scrollIntoView({ block: "center" });
  }, [focusCommentId, comments.data]);
  const repliesByParent = new Map<string, ReelComment[]>();
  const commentsById = new Map((comments.data ?? []).map((comment) => [comment.id, comment]));
  for (const comment of comments.data ?? []) {
    if (comment.parentCommentId) repliesByParent.set(comment.parentCommentId, [...(repliesByParent.get(comment.parentCommentId) ?? []), comment]);
  }
  const profileHref = (authorId: string, commentId: string) => {
    const params = new URLSearchParams({ returnTo });
    params.set("commentId", commentId);
    const reelPath = `/reels/${encodeURIComponent(reelId)}?${params.toString()}`;
    return `/profile/${encodeURIComponent(authorId)}?returnTo=${encodeURIComponent(reelPath)}`;
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || create.isPending) return;
    setError("");
    try {
      const comment = await create.mutateAsync({
        reelId,
        data: { content, ...(replyingTo ? { parentCommentId: replyingTo.id } : {}) },
      });
      client.setQueryData<ReelComment[]>(key, (old) => [...(old ?? []), comment]);
      setDraft("");
      setReplyingTo(null);
      onCountChange(1);
    } catch (reason) {
      setError(userErrorMessage(reason, "Your comment did not post. Try again."));
    }
  }

  async function deleteComment(id: string) {
    setError("");
    try {
      const descendants = comments.data?.filter((comment) => comment.parentCommentId === id).length ?? 0;
      await remove.mutateAsync({ reelId, commentId: id });
      client.setQueryData<ReelComment[]>(key, (old) => (old ?? []).filter((comment) => comment.id !== id && comment.parentCommentId !== id));
      setConfirming(null);
      if (replyingTo?.id === id) setReplyingTo(null);
      onCountChange(-(1 + descendants));
    } catch (reason) {
      setError(userErrorMessage(reason, "That comment could not be deleted."));
    }
  }

  return <section className="reel-comments" aria-label="Comments" data-testid="panel-reel-comments" onTouchStart={startCloseGesture} onTouchEnd={finishCloseGesture} onTouchCancel={() => { touchStart.current = null; }}>
    <header className="flex items-center justify-between px-4 pb-2 pt-3">
      <h2 className="text-sm font-bold">Comments <span className="font-medium text-white/50">{comments.data ? count : ""}</span></h2>
      <button type="button" onClick={onClose} aria-label="Close comments" data-testid="button-close-comments" className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"><X size={18} /></button>
    </header>
    <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
      {comments.isLoading ? <div className="space-y-3 py-2" aria-label="Loading comments">{[0, 1, 2].map((i) => <div key={i} className="flex gap-3"><span className="h-8 w-8 rounded-full bg-white/10" /><span className="h-8 flex-1 rounded-xl bg-white/[.06]" /></div>)}</div>
        : comments.isError ? <div className="py-6 text-center text-sm text-white/60">Comments could not load.<button type="button" onClick={() => void comments.refetch()} className="ml-2 font-semibold text-primary" data-testid="button-retry-comments">Retry</button></div>
        : !visibleCount ? <p className="py-6 text-center text-sm text-white/55" data-testid="text-no-comments">{count ? "Comments aren’t available right now." : "No comments yet. Say something kind."}</p>
        : <ul className="space-y-4 pb-2">{comments.data!.filter((comment) => !comment.parentCommentId).map((comment) => <li key={comment.id} data-testid={`comment-${comment.id}`}>
          <div className="flex gap-3" data-comment-id={comment.id}>
            <Link href={profileHref(comment.authorId, comment.id)} aria-label={`Open ${comment.authorName}'s profile`} data-testid={`link-reel-comment-profile-${comment.id}`} className="h-8 w-8 shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <ReelAvatar reference={comment.authorPhoto} name={comment.authorName} size={32} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/55"><Link href={profileHref(comment.authorId, comment.id)} className="font-semibold text-white/90 hover:text-primary">{comment.authorName}</Link>{comment.authorId === creatorId && <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">Creator</span>} <span>{ago(comment.createdAt)}</span></p>
              <ExpandableCommentText commentId={comment.id} content={comment.content} />
              <div className="mt-1 flex gap-3 text-xs">
                <button type="button" onClick={() => { setReplyingTo(comment); setDraft(""); input.current?.focus(); }} className="font-semibold text-white/55 hover:text-primary" data-testid={`button-reply-comment-${comment.id}`}>Reply</button>
                {comment.canDelete && (confirming === comment.id
                  ? <><button type="button" onClick={() => void deleteComment(comment.id)} disabled={remove.isPending} className="font-semibold text-rose-300" data-testid={`button-confirm-delete-comment-${comment.id}`}>Delete comment</button><button type="button" onClick={() => setConfirming(null)} className="text-white/60">Keep</button></>
                  : <button type="button" onClick={() => setConfirming(comment.id)} className="text-white/45 hover:text-white/80" data-testid={`button-delete-comment-${comment.id}`}>Delete</button>)}
              </div>
            </div>
          </div>
          {(repliesByParent.get(comment.id) ?? []).length > 0 && <ul className="ml-9 mt-3 space-y-3">
            {(repliesByParent.get(comment.id) ?? []).map((reply) => <li key={reply.id} className="flex gap-2.5" data-testid={`comment-${reply.id}`} data-comment-id={reply.id}>
              <Link href={profileHref(reply.authorId, reply.id)} aria-label={`Open ${reply.authorName}'s profile`} data-testid={`link-reel-comment-profile-${reply.id}`} className="h-7 w-7 shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <ReelAvatar reference={reply.authorPhoto} name={reply.authorName} size={28} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/55"><Link href={profileHref(reply.authorId, reply.id)} className="font-semibold text-white/90 hover:text-primary">{reply.authorName}</Link>{reply.authorId === creatorId && <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">Creator</span>} <span>{ago(reply.createdAt)}</span></p>
                <ExpandableCommentText
                  commentId={reply.id}
                  content={reply.content}
                  prefix={reply.parentCommentId && commentsById.has(reply.parentCommentId)
                    ? { label: `@${commentsById.get(reply.parentCommentId)!.authorName}`, href: profileHref(commentsById.get(reply.parentCommentId)!.authorId, reply.parentCommentId) }
                    : undefined}
                />
                {reply.canDelete && (confirming === reply.id
                  ? <p className="mt-1 text-xs"><button type="button" onClick={() => void deleteComment(reply.id)} disabled={remove.isPending} className="font-semibold text-rose-300" data-testid={`button-confirm-delete-comment-${reply.id}`}>Delete reply</button><button type="button" onClick={() => setConfirming(null)} className="ml-3 text-white/60">Keep</button></p>
                  : <button type="button" onClick={() => setConfirming(reply.id)} className="mt-1 text-xs text-white/45 hover:text-white/80" data-testid={`button-delete-comment-${reply.id}`}>Delete</button>)}
              </div>
            </li>)}
          </ul>}
        </li>)}</ul>}
    </div>
    {error && <p role="alert" className="px-4 pb-1 text-xs text-rose-300" data-testid="error-reel-comment">{error}</p>}
    {replyingTo && <div className="flex items-center justify-between px-4 pt-2 text-xs text-white/60" data-testid="status-replying-to">
      <span>Replying to <strong className="text-white/85">{replyingTo.authorName}</strong></span>
      <button type="button" onClick={() => setReplyingTo(null)} className="font-semibold text-primary" aria-label="Cancel reply">Cancel</button>
    </div>}
    <form onSubmit={(event) => void submit(event)} className="flex items-center gap-2 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5">
      <div className="h-9 w-9 shrink-0"><ReelAvatar reference={me.data?.photos?.[0] ?? null} name={me.data?.name ?? "Your profile"} size={36} /></div>
      <input ref={input} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} placeholder={replyingTo ? `Reply to ${replyingTo.authorName}` : "Add a comment"} aria-label={replyingTo ? `Reply to ${replyingTo.authorName}` : "Add a comment"} enterKeyHint="send" data-testid="input-reel-comment" className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[.07] px-4 text-[16px] text-white placeholder:text-white/40 focus:border-primary/60 focus:outline-none" />
      <button type="submit" disabled={!draft.trim() || create.isPending} aria-label="Post comment" data-testid="button-post-comment" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-35"><ArrowUp size={19} /></button>
    </form>
  </section>;
}
