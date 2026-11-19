import { useEffect, useRef, useState, type FormEvent, type TouchEvent as ReactTouchEvent } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMediaPreviewQueryKey, getGetReelCommentsQueryKey, useCreateReelComment, useDeleteReelComment,
  useGetMediaPreview, useGetMyProfile, useGetReelComments, useRequestProfileMediaUpload, type ReelComment,
} from "@workspace/api-client-react";
import { ArrowUp, AtSign, Image as ImageIcon, LoaderCircle, Smile, X } from "lucide-react";
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
  if (!url) return <div role="img" aria-label="Photo comment" data-testid="photo-reel-comment-placeholder" className="mt-2 flex h-24 w-24 items-center justify-center rounded-xl bg-white/10 text-white/45">{query.isError ? <ImageIcon size={24} /> : <span className="h-5 w-5 animate-pulse rounded-full bg-white/20" />}</div>;
  return <img src={url} alt="Photo comment" data-testid="img-reel-comment" className="mt-2 max-h-64 max-w-[min(260px,66vw)] rounded-xl object-cover" />;
}

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

export function ReelComments({ reelId, creatorId, returnTo, commentCount, canComment = true, onClose, onCountChange, focusCommentId }: { reelId: string; creatorId: string; returnTo: string; commentCount: number; canComment?: boolean; onClose: () => void; onCountChange: (delta: number) => void; focusCommentId?: string | null }) {
  const client = useQueryClient();
  const key = getGetReelCommentsQueryKey(reelId);
  const comments = useGetReelComments(reelId, { query: { queryKey: key } });
  const me = useGetMyProfile();
  const create = useCreateReelComment();
  const requestPhotoUpload = useRequestProfileMediaUpload();
  const remove = useDeleteReelComment();
  const [draft, setDraft] = useState("");
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
    <header className="flex items-center justify-between px-4 pb-2 pt-3">
      <h2 className="text-sm font-bold">Comments <span className="font-medium text-white/50">{comments.data ? count : ""}</span></h2>
      <button type="button" onClick={onClose} aria-label="Close comments" data-testid="button-close-comments" className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"><X size={18} /></button>
    </header>
    <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
      {comments.isLoading || (comments.isError && !comments.data) ? <div className="flex justify-center py-8"><QuietSpinner onRetry={() => void comments.refetch()} /></div>
        : !visibleCount ? <p className="py-6 text-center text-sm text-white/55" data-testid="text-no-comments">{count ? "Comments aren’t available right now." : "No comments yet. Say something kind."}</p>
        : <ul className="space-y-4 pb-2">{comments.data!.filter((comment) => !comment.parentCommentId).map((comment) => <li key={comment.id} data-testid={`comment-${comment.id}`}>
          <div className="flex gap-3" data-comment-id={comment.id}>
            <Link href={profileHref(comment.authorId, comment.id)} aria-label={`Open ${comment.authorName}'s profile`} data-testid={`link-reel-comment-profile-${comment.id}`} className="h-8 w-8 shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <ReelAvatar reference={comment.authorPhoto} name={comment.authorName} size={32} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/55"><Link href={profileHref(comment.authorId, comment.id)} className="font-semibold text-white/90 hover:text-primary">{comment.authorName}</Link>{comment.authorId === creatorId && <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">Creator</span>} <span>{ago(comment.createdAt)}</span></p>
               {comment.content && <ExpandableCommentText commentId={comment.id} content={comment.content} />}
               {comment.mediaReference && <ReelCommentPhoto reference={comment.mediaReference} />}
              <div className="mt-1 flex gap-3 text-xs">
                 {canComment&&<button type="button" onClick={() => { setReplyingTo(comment); setDraft(""); input.current?.focus(); }} className="font-semibold text-white/55 hover:text-primary" data-testid={`button-reply-comment-${comment.id}`}>Reply</button>}
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
                 {reply.content && <ExpandableCommentText
                   commentId={reply.id}
                   content={reply.content}
                   prefix={reply.parentCommentId && commentsById.has(reply.parentCommentId)
                     ? { label: `@${commentsById.get(reply.parentCommentId)!.authorName}`, href: profileHref(commentsById.get(reply.parentCommentId)!.authorId, reply.parentCommentId) }
                     : undefined}
                 />}
                 {reply.mediaReference && <ReelCommentPhoto reference={reply.mediaReference} />}
                {reply.canDelete && (confirming === reply.id
                  ? <p className="mt-1 text-xs"><button type="button" onClick={() => void deleteComment(reply.id)} disabled={remove.isPending} className="font-semibold text-rose-300" data-testid={`button-confirm-delete-comment-${reply.id}`}>Delete reply</button><button type="button" onClick={() => setConfirming(null)} className="ml-3 text-white/60">Keep</button></p>
                  : <button type="button" onClick={() => setConfirming(reply.id)} className="mt-1 text-xs text-white/45 hover:text-white/80" data-testid={`button-delete-comment-${reply.id}`}>Delete</button>)}
              </div>
            </li>)}
          </ul>}
        </li>)}</ul>}
    </div>
    {error && <p role="alert" className="px-4 pb-1 text-xs text-rose-300" data-testid="error-reel-comment">{error}</p>}
    {canComment&&replyingTo && <div className="flex items-center justify-between px-4 pt-2 text-xs text-white/60" data-testid="status-replying-to">
      <span>Replying to <strong className="text-white/85">{replyingTo.authorName}</strong></span>
      <button type="button" onClick={() => setReplyingTo(null)} className="font-semibold text-primary" aria-label="Cancel reply">Cancel</button>
    </div>}
    {canComment ? <form onSubmit={(event) => void submit(event)} className="reel-comment-composer">
      <div className="reel-comment-reactions" aria-label="Comment reactions">
        {["😂", "🤣", "🥰", "😁", "😳", "😉"].map((emoji) => <button key={emoji} type="button" onClick={() => addToDraft(emoji)} aria-label={`Add ${emoji}`} className="reel-comment-reaction">{emoji}</button>)}
      </div>
      {photo && <div className="reel-comment-photo-preview">
        <img src={photoPreview} alt="Selected comment photo" data-testid="img-reel-comment-selected" />
        <button type="button" onClick={removeSelectedPhoto} disabled={uploadingPhoto || create.isPending} aria-label="Remove photo" className="reel-comment-photo-remove"><X size={16} /></button>
      </div>}
      <input ref={photoInput} type="file" accept={PROFILE_PHOTO_ACCEPT} className="sr-only" aria-label="Choose a photo to comment" data-testid="input-reel-comment-photo" onChange={(event) => void choosePhoto(event.currentTarget.files?.[0])} />
      <div className="reel-comment-compose-row">
        <div className="h-9 w-9 shrink-0"><ReelAvatar reference={me.data?.photos?.[0] ?? null} name={me.data?.name ?? "Your profile"} size={36} /></div>
        <div className="reel-comment-input-wrap">
          <input ref={input} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} placeholder={replyingTo ? `Reply to ${replyingTo.authorName}` : "Add a comment"} aria-label={replyingTo ? `Reply to ${replyingTo.authorName}` : "Add a comment"} enterKeyHint="send" data-testid="input-reel-comment" className="reel-comment-input" />
          <div className="reel-comment-tools" aria-label="Comment tools">
            <button type="button" onClick={() => photoInput.current?.click()} disabled={preparingPhoto || uploadingPhoto || create.isPending} aria-label="Add photo" className="reel-comment-tool" title="Add photo" data-testid="button-add-reel-comment-photo">{preparingPhoto ? <LoaderCircle size={20} className="animate-spin" /> : <ImageIcon size={21} />}</button>
            <button type="button" onClick={() => addToDraft("😊")} aria-label="Add emoji" className="reel-comment-tool" title="Add emoji"><Smile size={21} /></button>
            <button type="button" onClick={() => addToDraft("@")} aria-label="Mention someone" className="reel-comment-tool" title="Mention someone"><AtSign size={21} /></button>
          </div>
        </div>
        <button type="submit" onPointerDown={(event) => event.preventDefault()} onTouchEnd={(event) => { event.preventDefault(); void postDraft(); }} disabled={(!draft.trim() && !photo) || create.isPending || preparingPhoto || uploadingPhoto} aria-label="Post comment" data-testid="button-post-comment" className="reel-comment-send disabled:opacity-35">{uploadingPhoto ? <LoaderCircle size={19} className="animate-spin" /> : <ArrowUp size={19} />}</button>
      </div>
    </form> : <p className="px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-3 text-center text-xs text-white/55">The creator has turned off new comments.</p>}
  </section>;
}
