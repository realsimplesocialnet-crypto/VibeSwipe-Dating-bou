import { useCallback, useEffect, useRef, useState, type FormEvent, type TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMediaPreviewQueryKey, getGetProfileMediaQueryKey, getGetReelCommentsQueryKey, useCreateReelComment, useDeleteReelComment,
  useGetMediaPreview, useGetMyProfile, useGetProfileMedia, useGetReelComments, useRequestProfileMediaUpload, useSetReelCommentReaction,
  type ReelComment, type ReelCommentReaction,
} from "@workspace/api-client-react";
import { ArrowUp, AtSign, Check, ChevronDown, Heart, Image as ImageIcon, LoaderCircle, Search, SlidersHorizontal, Smile, ThumbsDown, X } from "lucide-react";
import { ReelAvatar } from "@/components/reels/reel-avatar";
import { userErrorMessage } from "@/lib/user-errors";
import { QuietSpinner } from "@/components/ui/quiet-spinner";
import { PROFILE_PHOTO_ACCEPT, prepareProfilePhoto, uploadProfilePhotoBytes } from "@/lib/profile-photo-upload";

function useObjectUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) { setUrl(""); return; }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

function ReelCommentPhoto({ reference }: { reference: string }) {
  const id = reference.startsWith("media:") ? reference.slice(6) : "";
  const query = useGetMediaPreview(id, { query: {
    enabled: Boolean(id),
    queryKey: getGetMediaPreviewQueryKey(id),
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: (count, error) => count < 3 && [500, 502, 503, 504].includes((error as { status?: number })?.status ?? 0),
    retryDelay: count => 1500 * (count + 1),
  } });
  const url = useObjectUrl(query.data instanceof Blob ? query.data : null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return <>
    <button
      type="button"
      aria-label="Open photo comment"
      aria-haspopup="dialog"
      data-testid="button-open-reel-comment-photo"
      onClick={() => setOpen(true)}
      className="reel-comment-photo-thumb mt-2"
    >
      {url
        ? <img src={url} alt="" data-testid="img-reel-comment" />
        : query.isError
          ? <ImageIcon size={24} aria-hidden="true" />
          : <span className="h-5 w-5 animate-pulse rounded-full bg-white/20" aria-hidden="true" />}
    </button>
    {open && id && <FullReelCommentPhoto mediaId={id} onClose={close} />}
  </>;
}

function FullReelCommentPhoto({ mediaId, onClose }: { mediaId: string; onClose: () => void }) {
  const photo = useGetProfileMedia(mediaId, { query: {
    enabled: Boolean(mediaId),
    queryKey: getGetProfileMediaQueryKey(mediaId),
    retry: false,
    gcTime: 0,
  } });
  const url = useObjectUrl(photo.data instanceof Blob ? photo.data : null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Photo comment"
      tabIndex={-1}
      data-testid="dialog-reel-comment-photo"
      className="reel-comment-photo-viewer"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <button type="button" onClick={onClose} aria-label="Close photo" className="reel-comment-photo-viewer-close">
        <X size={24} />
      </button>
      <div className="reel-comment-photo-viewer-content">
        {url
          ? <img src={url} alt="Full-size photo comment" data-testid="img-reel-comment-full" />
          : photo.isError
            ? <button type="button" onClick={() => void photo.refetch()} aria-label="Retry loading photo" className="text-white/75"><ImageIcon size={30} /></button>
            : <QuietSpinner />}
      </div>
    </div>,
    document.body,
  );
}

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

function compactCount(value: number): string {
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
}

function CommentReactions({ comment, pending, onReact }: {
  comment: ReelComment;
  pending: boolean;
  onReact: (reaction: ReelCommentReaction) => void;
}) {
  return <div className="reel-comment-reactions" aria-label="Comment reactions">
    <button
      type="button"
      className={`reel-comment-vote${comment.myReaction === "like" ? " is-active" : ""}`}
      aria-label={`Like comment, ${comment.likeCount} likes`}
      aria-pressed={comment.myReaction === "like"}
      disabled={pending}
      onClick={() => onReact("like")}
      data-testid={`button-like-reel-comment-${comment.id}`}
    >
      <Heart size={18} fill={comment.myReaction === "like" ? "currentColor" : "none"} />
      <span>{compactCount(comment.likeCount)}</span>
    </button>
    <button
      type="button"
      className={`reel-comment-vote${comment.myReaction === "dislike" ? " is-active" : ""}`}
      aria-label={`Dislike comment, ${comment.dislikeCount} dislikes`}
      aria-pressed={comment.myReaction === "dislike"}
      disabled={pending}
      onClick={() => onReact("dislike")}
      data-testid={`button-dislike-reel-comment-${comment.id}`}
    >
      <ThumbsDown size={18} />
      <span>{compactCount(comment.dislikeCount)}</span>
    </button>
  </div>;
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
    <p ref={text} className={`reel-comment-text break-words text-sm leading-5 ${expanded ? "" : "reel-comment-clamp"}`} data-testid={`text-reel-comment-${commentId}`}>
      {prefix && <><Link href={prefix.href} className="font-semibold text-primary hover:underline">{prefix.label}</Link>{" "}</>}{content}
    </p>
    {hasMore && <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-0.5 text-xs font-semibold text-muted-foreground hover:text-primary" aria-expanded={expanded} data-testid={`button-more-comment-${commentId}`}>{expanded ? "Less" : "More"}</button>}
  </>;
}

export function ReelComments({ reelId, creatorId, returnTo, commentCount, canComment = true, onClose, onCountChange, focusCommentId }: { reelId: string; creatorId: string; returnTo: string; commentCount: number; canComment?: boolean; onClose: () => void; onCountChange: (delta: number) => void; focusCommentId?: string | null }) {
  const client = useQueryClient();
  const key = getGetReelCommentsQueryKey(reelId);
  const comments = useGetReelComments(reelId, { query: { queryKey: key } });
  const me = useGetMyProfile();
  const create = useCreateReelComment();
  const requestPhotoUpload = useRequestProfileMediaUpload();
  const remove = useDeleteReelComment();
  const saveReaction = useSetReelCommentReaction();
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"newest" | "top">("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(() => new Set());
  const [reactingIds, setReactingIds] = useState<Set<string>>(() => new Set());
  const [photo, setPhoto] = useState<File | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const uploadedPhoto = useRef<{ file: File; mediaId: string } | null>(null);
  const photoPreview = useObjectUrl(photo);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const reactionRequests = useRef(new Set<string>());
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
  useEffect(() => { list.current?.scrollTo({ top: 0 }); }, [visibleCount]);
  useEffect(() => {
    if (!focusCommentId || !comments.data) return;
    list.current?.querySelector<HTMLElement>(`[data-comment-id="${focusCommentId}"]`)?.scrollIntoView({ block: "center" });
  }, [focusCommentId, comments.data]);
  const repliesByParent = new Map<string, ReelComment[]>();
  const commentsById = new Map((comments.data ?? []).map((comment) => [comment.id, comment]));
  for (const comment of comments.data ?? []) {
    if (comment.parentCommentId) repliesByParent.set(comment.parentCommentId, [...(repliesByParent.get(comment.parentCommentId) ?? []), comment]);
  }
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const rootComments = (comments.data ?? []).filter((comment) => !comment.parentCommentId);
  const filteredComments = rootComments.filter((comment) => {
    if (!normalizedSearch) return true;
    const replies = repliesByParent.get(comment.id) ?? [];
    return [comment, ...replies].some((item) => `${item.authorName} ${item.content}`.toLocaleLowerCase().includes(normalizedSearch));
  });
  const sortedComments = [...filteredComments].sort((a, b) => sortMode === "top"
    ? (b.likeCount - a.likeCount) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const profileHref = (authorId: string, commentId: string) => {
    const params = new URLSearchParams({ returnTo });
    params.set("commentId", commentId);
    const reelPath = `/reels/${encodeURIComponent(reelId)}?${params.toString()}`;
    return `/profile/${encodeURIComponent(authorId)}?returnTo=${encodeURIComponent(reelPath)}`;
  };

  async function reactToComment(comment: ReelComment, reaction: ReelCommentReaction) {
    if (reactionRequests.current.has(comment.id)) return;
    const current = comments.data?.find((item) => item.id === comment.id) ?? comment;
    const nextReaction = current.myReaction === reaction ? null : reaction;
    const likeDelta = Number(nextReaction === "like") - Number(current.myReaction === "like");
    const dislikeDelta = Number(nextReaction === "dislike") - Number(current.myReaction === "dislike");
    reactionRequests.current.add(comment.id);
    setReactingIds((ids) => new Set(ids).add(comment.id));
    setError("");
    client.setQueryData<ReelComment[]>(key, (old) => (old ?? []).map((item) => item.id === comment.id ? {
      ...item,
      likeCount: Math.max(0, item.likeCount + likeDelta),
      dislikeCount: Math.max(0, item.dislikeCount + dislikeDelta),
      myReaction: nextReaction,
    } : item));
    try {
      const summary = await saveReaction.mutateAsync({ reelId, commentId: comment.id, data: { reaction: nextReaction } });
      client.setQueryData<ReelComment[]>(key, (old) => (old ?? []).map((item) => item.id === comment.id ? { ...item, ...summary } : item));
    } catch (reason) {
      client.setQueryData<ReelComment[]>(key, (old) => old?.map((item) => item.id === comment.id ? current : item));
      setError(userErrorMessage(reason, "Your reaction did not save. Try again."));
    } finally {
      reactionRequests.current.delete(comment.id);
      setReactingIds((ids) => {
        const next = new Set(ids);
        next.delete(comment.id);
        return next;
      });
    }
  }

  async function postDraft() {
    const content = draft.trim();
    const selectedPhoto = photo;
    if ((!content && !selectedPhoto) || create.isPending || preparingPhoto || uploadingPhoto || submitting.current) return;
    submitting.current = true;
    setError("");
    try {
      let mediaId: string | undefined;
      if (selectedPhoto) {
        setUploadingPhoto(true);
        const cachedUpload = uploadedPhoto.current?.file === selectedPhoto ? uploadedPhoto.current : null;
        if (cachedUpload) {
          mediaId = cachedUpload.mediaId;
        } else {
          const upload = await requestPhotoUpload.mutateAsync({ data: {
            name: selectedPhoto.name || "reel-comment.jpg",
            size: selectedPhoto.size,
            contentType: "image/jpeg",
            mediaType: "image",
          } });
          await uploadProfilePhotoBytes(upload.uploadURL, selectedPhoto);
          mediaId = upload.mediaId;
          uploadedPhoto.current = { file: selectedPhoto, mediaId };
        }
        setUploadingPhoto(false);
      }
      const comment = await create.mutateAsync({
        reelId,
        data: {
          ...(content ? { content } : {}),
          ...(mediaId ? { mediaId } : {}),
          ...(replyingTo ? { parentCommentId: replyingTo.id } : {}),
        },
      });
      client.setQueryData<ReelComment[]>(key, (old) => [...(old ?? []), comment]);
      setDraft("");
      setPhoto(null);
      uploadedPhoto.current = null;
      if (photoInput.current) photoInput.current.value = "";
      setReplyingTo(null);
      onCountChange(1);
    } catch (reason) {
      setError(userErrorMessage(reason, "Your comment did not post. Try again."));
    } finally {
      setUploadingPhoto(false);
      submitting.current = false;
    }
  }

  async function choosePhoto(file?: File) {
    if (!file || preparingPhoto || uploadingPhoto) return;
    setError("");
    setPreparingPhoto(true);
    try {
      setPhoto(await prepareProfilePhoto(file));
    } catch (reason) {
      setError(userErrorMessage(reason, "Choose a readable photo."));
    } finally {
      setPreparingPhoto(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  function removeSelectedPhoto() {
    if (uploadingPhoto || create.isPending) return;
    setPhoto(null);
    uploadedPhoto.current = null;
    if (photoInput.current) photoInput.current.value = "";
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void postDraft();
  }

  function addToDraft(value: string) {
    setDraft((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${value}`);
    input.current?.focus({ preventScroll: true });
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
    <header className="reel-comments-header">
      <div className="reel-comments-handle" aria-hidden="true" />
      <div className="reel-comments-title-row">
        <h2>{count} comments</h2>
        <div className="reel-comments-header-actions">
          <div className="reel-comment-filter-wrap">
            <button type="button" onClick={() => setFilterOpen((open) => !open)} aria-label="Sort comments" aria-expanded={filterOpen} className="reel-comment-header-button" data-testid="button-filter-reel-comments"><SlidersHorizontal size={21} /></button>
            {filterOpen && <div className="reel-comment-sort-menu" role="group" aria-label="Sort comments">
              <button type="button" onClick={() => { setSortMode("newest"); setFilterOpen(false); }} aria-pressed={sortMode === "newest"}>Newest first {sortMode === "newest" && <Check size={16} />}</button>
              <button type="button" onClick={() => { setSortMode("top"); setFilterOpen(false); }} aria-pressed={sortMode === "top"}>Top comments {sortMode === "top" && <Check size={16} />}</button>
            </div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close comments" data-testid="button-close-comments" className="reel-comment-header-button"><ChevronDown size={22} /></button>
        </div>
      </div>
      <label className="reel-comment-search">
        <Search size={19} aria-hidden="true" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search comments" aria-label="Search comments" data-testid="input-search-reel-comments" />
        {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear comment search"><X size={17} /></button>}
      </label>
    </header>
    <div ref={list} className="reel-comment-list">
      {comments.isLoading || (comments.isError && !comments.data) ? <div className="flex justify-center py-8"><QuietSpinner onRetry={() => void comments.refetch()} /></div>
        : !visibleCount ? <p className="reel-comment-empty" data-testid="text-no-comments">{count ? "Comments aren’t available right now." : "No comments yet. Say something kind."}</p>
        : !sortedComments.length ? <p className="reel-comment-empty" data-testid="text-no-search-results">No comments match your search.</p>
        : <ul className="reel-comment-thread-list">{sortedComments.map((comment) => {
          const replies = repliesByParent.get(comment.id) ?? [];
          const matchingReplies = normalizedSearch
            ? replies.filter((reply) => `${reply.authorName} ${reply.content}`.toLocaleLowerCase().includes(normalizedSearch))
            : replies;
          const searchMatchedReply = normalizedSearch && matchingReplies.length > 0;
          const showReplies = expandedReplies.has(comment.id) || Boolean(searchMatchedReply);
          return <li key={comment.id} data-testid={`comment-${comment.id}`} className="reel-comment-thread">
            <div className="reel-comment-row" data-comment-id={comment.id}>
              <Link href={profileHref(comment.authorId, comment.id)} aria-label={`Open ${comment.authorName}'s profile`} data-testid={`link-reel-comment-profile-${comment.id}`} className="reel-comment-avatar-link">
                <ReelAvatar reference={comment.authorPhoto} name={comment.authorName} size={42} />
              </Link>
              <div className="reel-comment-main">
                <p className="reel-comment-meta"><Link href={profileHref(comment.authorId, comment.id)} className="reel-comment-author">{comment.authorName}</Link>{comment.authorId === creatorId && <span className="reel-comment-creator">Creator</span>} <span>{ago(comment.createdAt)}</span></p>
                {comment.content && <ExpandableCommentText commentId={comment.id} content={comment.content} />}
                {comment.mediaReference && <ReelCommentPhoto reference={comment.mediaReference} />}
                <div className="reel-comment-footer">
                  <div className="reel-comment-links">
                    {canComment && <button type="button" onClick={() => { setReplyingTo(comment); setDraft(""); input.current?.focus(); }} className="reel-comment-link" data-testid={`button-reply-comment-${comment.id}`}>Reply</button>}
                    {comment.canDelete && (confirming === comment.id
                      ? <><button type="button" onClick={() => void deleteComment(comment.id)} disabled={remove.isPending} className="reel-comment-link is-danger" data-testid={`button-confirm-delete-comment-${comment.id}`}>Delete comment</button><button type="button" onClick={() => setConfirming(null)} className="reel-comment-link">Keep</button></>
                      : <button type="button" onClick={() => setConfirming(comment.id)} className="reel-comment-link is-muted" data-testid={`button-delete-comment-${comment.id}`}>Delete</button>)}
                  </div>
                  <CommentReactions comment={comment} pending={reactingIds.has(comment.id)} onReact={(reaction) => void reactToComment(comment, reaction)} />
                </div>
                {replies.length > 0 && <button
                  type="button"
                  className="reel-comment-replies-toggle"
                  aria-expanded={showReplies}
                  onClick={() => setExpandedReplies((current) => {
                    const next = new Set(current);
                    if (next.has(comment.id)) next.delete(comment.id);
                    else next.add(comment.id);
                    return next;
                  })}
                  data-testid={`button-toggle-replies-${comment.id}`}
                >{showReplies ? "Hide replies" : `View ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`} <ChevronDown size={15} /></button>}
              </div>
            </div>
            {showReplies && matchingReplies.length > 0 && <ul className="reel-comment-replies">{matchingReplies.map((reply) => <li key={reply.id} className="reel-comment-row is-reply" data-testid={`comment-${reply.id}`} data-comment-id={reply.id}>
              <Link href={profileHref(reply.authorId, reply.id)} aria-label={`Open ${reply.authorName}'s profile`} data-testid={`link-reel-comment-profile-${reply.id}`} className="reel-comment-avatar-link is-reply-avatar">
                <ReelAvatar reference={reply.authorPhoto} name={reply.authorName} size={34} />
              </Link>
              <div className="reel-comment-main">
                <p className="reel-comment-meta"><Link href={profileHref(reply.authorId, reply.id)} className="reel-comment-author">{reply.authorName}</Link>{reply.authorId === creatorId && <span className="reel-comment-creator">Creator</span>} <span>{ago(reply.createdAt)}</span></p>
                {reply.content && <ExpandableCommentText
                  commentId={reply.id}
                  content={reply.content}
                  prefix={reply.parentCommentId && commentsById.has(reply.parentCommentId)
                    ? { label: `@${commentsById.get(reply.parentCommentId)!.authorName}`, href: profileHref(commentsById.get(reply.parentCommentId)!.authorId, reply.parentCommentId) }
                    : undefined}
                />}
                {reply.mediaReference && <ReelCommentPhoto reference={reply.mediaReference} />}
                <div className="reel-comment-footer">
                  <div className="reel-comment-links">
                    {canComment && <button type="button" onClick={() => { setReplyingTo(comment); setDraft(""); input.current?.focus(); }} className="reel-comment-link" data-testid={`button-reply-comment-${reply.id}`}>Reply</button>}
                    {reply.canDelete && (confirming === reply.id
                      ? <><button type="button" onClick={() => void deleteComment(reply.id)} disabled={remove.isPending} className="reel-comment-link is-danger" data-testid={`button-confirm-delete-comment-${reply.id}`}>Delete reply</button><button type="button" onClick={() => setConfirming(null)} className="reel-comment-link">Keep</button></>
                      : <button type="button" onClick={() => setConfirming(reply.id)} className="reel-comment-link is-muted" data-testid={`button-delete-comment-${reply.id}`}>Delete</button>)}
                  </div>
                  <CommentReactions comment={reply} pending={reactingIds.has(reply.id)} onReact={(reaction) => void reactToComment(reply, reaction)} />
                </div>
              </div>
            </li>)}</ul>}
          </li>;
        })}</ul>}
    </div>
    {error && <p role="alert" className="reel-comment-error" data-testid="error-reel-comment">{error}</p>}
    {canComment && replyingTo && <div className="reel-comment-replying" data-testid="status-replying-to">
      <span>Replying to <strong>{replyingTo.authorName}</strong></span>
      <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply"><X size={16} /></button>
    </div>}
    {canComment ? <form onSubmit={(event) => void submit(event)} className="reel-comment-composer">
      {photo && <div className="reel-comment-photo-preview">
        <img src={photoPreview} alt="Selected comment photo" data-testid="img-reel-comment-selected" />
        <button type="button" onClick={removeSelectedPhoto} disabled={uploadingPhoto || create.isPending} aria-label="Remove photo" className="reel-comment-photo-remove"><X size={16} /></button>
      </div>}
      <input ref={photoInput} type="file" accept={PROFILE_PHOTO_ACCEPT} className="sr-only" aria-label="Choose a photo to comment" data-testid="input-reel-comment-photo" onChange={(event) => void choosePhoto(event.currentTarget.files?.[0])} />
      <div className="reel-comment-compose-row">
        <div className="reel-comment-composer-avatar"><ReelAvatar reference={me.data?.photos?.[0] ?? null} name={me.data?.name ?? "Your profile"} size={38} /></div>
        <div className="reel-comment-input-wrap">
          <input ref={input} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} placeholder={replyingTo ? `Reply to ${replyingTo.authorName}` : "Add a comment..."} aria-label={replyingTo ? `Reply to ${replyingTo.authorName}` : "Add a comment"} enterKeyHint="send" data-testid="input-reel-comment" className="reel-comment-input" />
          <div className="reel-comment-tools" aria-label="Comment tools">
            <button type="button" onClick={() => photoInput.current?.click()} disabled={preparingPhoto || uploadingPhoto || create.isPending} aria-label="Add photo" className="reel-comment-tool" title="Add photo" data-testid="button-add-reel-comment-photo">{preparingPhoto ? <LoaderCircle size={20} className="animate-spin" /> : <ImageIcon size={21} />}</button>
            <button type="button" onClick={() => addToDraft(String.fromCodePoint(0x1f60a))} aria-label="Add emoji" className="reel-comment-tool" title="Add emoji"><Smile size={21} /></button>
            <button type="button" onClick={() => addToDraft("@")} aria-label="Mention someone" className="reel-comment-tool" title="Mention someone"><AtSign size={21} /></button>
          </div>
        </div>
        <button type="submit" onPointerDown={(event) => event.preventDefault()} onTouchEnd={(event) => { event.preventDefault(); void postDraft(); }} disabled={(!draft.trim() && !photo) || create.isPending || preparingPhoto || uploadingPhoto} aria-label="Post comment" data-testid="button-post-comment" className="reel-comment-send disabled:opacity-35">{uploadingPhoto ? <LoaderCircle size={19} className="animate-spin" /> : <ArrowUp size={19} />}</button>
      </div>
    </form> : <p className="reel-comment-disabled">The creator has turned off new comments.</p>}
  </section>;
}
