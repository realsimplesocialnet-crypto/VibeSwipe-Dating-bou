import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  getGetMessagesQueryKey,
  getGetProfileMediaQueryKey,
  getGetStoriesQueryKey,
  useCreateStory,
  useGetMyProfile,
  useGetProfileMedia,
  useGetStories,
  useMarkStoryViewed,
  useRequestStoryMediaUpload,
  useSendMessage,
  useTranscodeStoryVideo,
  type StoryGroup,
  type StoryItem,
  type StoryInput,
  type StoriesFeed,
  type Profile,
} from "@workspace/api-client-react";
import { ArrowLeft, Check, ImagePlus, LoaderCircle, Plus, Send, ShieldCheck, Video, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const STORY_PREFIX = "Replied to your story: ";
const TEXT_BACKGROUNDS = ["#5c3b78", "#814e72", "#4e557f", "#8e5c69", "#594f70"];
const STORY_VIDEO_MAX_SECONDS = 15;
const STORY_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
const STORY_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

function storyContentType(file: File): string | null {
  const mime = file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (mime === "image/jpg") return "image/jpeg";
  if (["image/jpeg", "image/png", "image/webp", "image/heic", "video/mp4", "video/quicktime"].includes(mime)) return mime;
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic" || extension === "heif") return "image/heic";
  if (extension === "mp4" || extension === "m4v") return "video/mp4";
  if (extension === "mov") return "video/quicktime";
  return null;
}

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (duration?: number, error?: Error) => {
      window.clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(source);
      if (error) reject(error);
      else if (duration !== undefined) resolve(duration);
    };
    const timeout = window.setTimeout(
      () => finish(undefined, new Error("This video’s length couldn’t be checked. Choose another video.")),
      12_000,
    );
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        finish(undefined, new Error("This video’s length couldn’t be checked. Choose another video."));
        return;
      }
      finish(duration);
    };
    video.onerror = () =>
      finish(undefined, new Error("This video couldn’t be opened. Choose an MP4 or MOV video."));
    video.src = source;
    video.load();
  });
}

function useProtectedStoryMedia(reference: string | null) {
  const mediaId = reference?.startsWith("media:") ? reference.slice(6) : "";
  const query = useGetProfileMedia(mediaId, {
    query: { enabled: Boolean(mediaId), queryKey: getGetProfileMediaQueryKey(mediaId) },
  });
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!query.data) { setUrl(""); return; }
    const next = URL.createObjectURL(query.data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [query.data]);
  return { url, isLoading: query.isLoading, isError: query.isError, valid: Boolean(mediaId) };
}

function StoryAvatar({ reference, name, className = "" }: { reference: string | null; name: string; className?: string }) {
  const media = useProtectedStoryMedia(reference);
  const remoteSource = reference?.startsWith("http")
    ? reference
    : reference?.startsWith("demo:")
      ? ""
      : reference && !reference.startsWith("media:")
        ? `/api/storage${reference.startsWith("/") ? reference : `/${reference}`}`
        : "";
  const source = media.valid ? media.url : remoteSource;
  return <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(145deg,#765493,#38263f)] font-bold text-[#f5dcff] ${className}`} aria-label={`${name}'s photo`}>
    {source ? <img src={source} alt="" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span>{name.trim().slice(0, 1).toUpperCase() || "M"}</span>}
  </div>;
}

export function StoriesRow({mode="all"}:{mode?:"all"|"own"|"matches"}) {
  const feed = useGetStories({ query: { queryKey: getGetStoriesQueryKey(), refetchInterval: 30_000 } });
  const profile = useGetMyProfile();
  const [active, setActive] = useState<{ stories: StoryItem[]; name: string; photo: string | null; matchId?: string } | null>(null);
  const own = feed.data?.ownStories ?? [];
  const matches = feed.data?.matches ?? [];
  if(mode==="own")return <div className="relative h-11 w-11 shrink-0">
    {own.length?<button type="button" onClick={()=>setActive({stories:own,name:profile.data?.name||"Your story",photo:profile.data?.photos?.[0]??null})} aria-label="View your story" className="h-11 w-11 overflow-hidden rounded-full border-2 border-primary p-[2px]"><StoryAvatar reference={profile.data?.photos?.[0]??null} name={profile.data?.name??"You"} className="h-full w-full"/></button>:<Link href="/stories/new" aria-label="Add your story" className="block h-11 w-11 overflow-hidden rounded-full border-2 border-primary/40"><StoryAvatar reference={profile.data?.photos?.[0]??null} name={profile.data?.name??"You"} className="h-full w-full"/></Link>}
    <Link href="/stories/new" aria-label="Add a story" className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"><Plus size={12}/></Link>
    <StoryViewer active={active} onClose={()=>setActive(null)}/>
  </div>;
  if(mode==="matches"&&!feed.isLoading&&!feed.isError&&!matches.length)return null;
  return <section className="mb-4 -mx-4 w-[calc(100%+2rem)]" aria-label="Stories" data-testid="section-stories">
    {feed.isLoading
      ? <div className="hide-scrollbar flex min-h-[100px] gap-3 overflow-x-auto px-5 pb-1" aria-label="Loading stories">
          {[0, 1, 2, 3].map((item) => <div key={item} className="flex w-[72px] shrink-0 flex-col items-center gap-2"><div className="h-[68px] w-[68px] animate-pulse rounded-full bg-white/[.08]" /><div className="h-2.5 w-12 animate-pulse rounded-full bg-white/[.07]" /></div>)}
        </div>
      : feed.isError
        ? <div role="alert" className="flex min-h-[84px] items-center px-5"><button type="button" onClick={() => void feed.refetch()} data-testid="button-retry-stories" aria-label="Retry loading stories" className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-foreground">Retry stories</button></div>
        : <div className="hide-scrollbar flex min-h-[100px] gap-3 overflow-x-auto px-5 pb-1" data-testid="list-story-circles">
          {mode!=="matches"&&<div className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-center">
            <span className="relative block h-[68px] w-[68px]">
              {own.length > 0
                ? <button type="button" onClick={() => setActive({ stories: own, name: profile.data?.name || "Your story", photo: profile.data?.photos?.[0] ?? null })} data-testid="button-own-story" aria-label="View your story" className="group absolute inset-0 h-full w-full rounded-full">
                    <span className={`flex h-full w-full items-center justify-center rounded-full p-[2px] transition-transform group-hover:scale-[1.04] ${own.some((story) => !story.viewed) ? "bg-gradient-to-br from-[#ef9bc7] via-[#bd8ae1] to-[#8e79d5]" : "bg-white/25"}`}>
                      <span className="h-full w-full overflow-hidden rounded-full"><StoryAvatar reference={profile.data?.photos?.[0] ?? null} name={profile.data?.name ?? "You"} className="h-full w-full text-xl"/></span>
                    </span>
                  </button>
                : <Link href="/stories/new" data-testid="button-own-story" aria-label="Add your story" className="group absolute inset-0 overflow-hidden rounded-full transition-transform hover:scale-[1.04]">
                    <StoryAvatar reference={profile.data?.photos?.[0] ?? null} name={profile.data?.name ?? "You"} className="h-full w-full text-xl"/>
                  </Link>}
              <Link href="/stories/new" data-testid="link-create-story" aria-label="Add a story" className="absolute -bottom-0.5 -right-0.5 z-[1] flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#17141b] bg-primary text-[#25131f] transition-transform hover:scale-110"><Plus size={14}/></Link>
            </span>
            <span className="w-full truncate text-[11px] font-medium text-foreground">Your story</span>
          </div>}
          {matches.map((group) => <button type="button" key={group.matchId} onClick={() => setActive({ stories: group.stories, name: group.poster.name, photo: group.poster.photo, matchId: group.matchId })} data-testid={`button-story-${group.matchId}`} aria-label={`View ${group.poster.name}'s story`} className="group flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-center">
            <span className={`flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full p-[2px] transition-transform group-hover:scale-[1.04] ${group.stories.some((story) => !story.viewed) ? "bg-gradient-to-br from-[#ef9bc7] via-[#bd8ae1] to-[#8e79d5]" : "bg-white/25"}`}><span className="h-full w-full overflow-hidden rounded-full"><StoryAvatar reference={group.poster.photo} name={group.poster.name} className="h-full w-full text-xl"/></span></span>
            <span className="w-full truncate text-[11px] font-medium text-foreground">{group.poster.name.split(/\s+/)[0].slice(0, 12)}</span>
          </button>)}
        </div>}
    <StoryViewer active={active} onClose={() => setActive(null)} />
  </section>;
}

type ActiveStory = { stories: StoryItem[]; name: string; photo: string | null; matchId?: string };

export function MatchStoryAvatar({
  matchId,
  profile,
  storyGroup,
  disabled = false,
  returnTo = "/matches",
}: {
  returnTo?: "/matches" | "/views" | "/messages" | "/notifications";
  matchId: string;
  profile: Pick<Profile, "name" | "photos">;
  storyGroup?: StoryGroup;
  disabled?: boolean;
}) {
  const [, setLocation] = useLocation();
  const [active, setActive] = useState<ActiveStory | null>(null);
  const hasStory = Boolean(storyGroup?.stories.length);

  function open() {
    if (disabled) return;
    if (!storyGroup?.stories.length) {
      setLocation(`/chat/${matchId}?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    setActive({
      stories: storyGroup.stories,
      name: storyGroup.poster.name,
      photo: storyGroup.poster.photo,
      matchId,
    });
  }

  function closeAndOpenChat() {
    setActive(null);
    setLocation(`/chat/${matchId}?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return <>
    <button
      type="button"
      onClick={open}
      disabled={disabled}
      aria-label={hasStory ? `View ${profile.name}'s story, then open chat` : `Open chat with ${profile.name}`}
      data-testid={`button-match-story-avatar-${matchId}`}
      className="shrink-0 rounded-full disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={`flex h-[50px] w-[50px] items-center justify-center rounded-full ${hasStory ? "bg-gradient-to-br from-[#f34e9a] via-[#c67be8] to-[#8265da] p-[2.5px]" : "border border-white/10 p-[2px]"}`}>
        <span className="h-full w-full overflow-hidden rounded-full border-2 border-[#211d25]">
          <StoryAvatar reference={profile.photos?.[0] ?? null} name={profile.name} className="h-full w-full text-sm"/>
        </span>
      </span>
    </button>
    <StoryViewer active={active} onClose={closeAndOpenChat}/>
  </>;
}

function StoryViewer({ active, onClose }: { active: ActiveStory | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const markViewed = useMarkStoryViewed();
  const send = useSendMessage();
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [reply, setReply] = useState("");
  const [notice, setNotice] = useState("");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const justOpened = useRef(false);
  const current = active?.stories[index];
  const media = useProtectedStoryMedia(current?.mediaUrl ?? null);

  useEffect(() => {
    justOpened.current = Boolean(active);
    setIndex(0);
    setElapsed(0);
    setReply("");
    setNotice("");
  }, [active]);
  useEffect(() => {
    if (!active || !current) return;
    setElapsed(0);
    if (!current.viewed && active.matchId) {
      queryClient.setQueryData<StoriesFeed>(getGetStoriesQueryKey(), (old) => old ? ({
        ...old, matches: old.matches.map((group) => group.matchId === active.matchId ? { ...group, stories: group.stories.map((story) => story.id === current.id ? { ...story, viewed: true } : story) } : group),
      }) : old);
      void markViewed.mutateAsync({ storyId: current.id }).then(() => queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() })).catch(() => undefined);
    }
  }, [active?.matchId, current?.id]);
  useEffect(() => {
    if (!active || !current || current.mediaType === "video") return;
    const progress = window.setInterval(() => setElapsed((value) => Math.min(5000, value + 50)), 50);
    const advance = window.setTimeout(() => setIndex((value) => value + 1), 5000);
    return () => {
      window.clearInterval(progress);
      window.clearTimeout(advance);
    };
  }, [active, current?.id, current?.mediaType]);
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); if (event.key === "ArrowRight") setIndex((value) => value + 1); if (event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1)); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active, onClose]);
  useEffect(() => {
    if (!active) return;
    if (justOpened.current) {
      justOpened.current = false;
      return;
    }
    if (index >= active.stories.length) onClose();
  }, [index, active, onClose]);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = reply.trim();
    if (!text || !active?.matchId || !current || send.isPending) return;
    try {
      await send.mutateAsync({ matchId: active.matchId, data: { content: `${STORY_PREFIX}${text}`, storyId: current.id } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey(active.matchId) }),
      ]);
      setReply(""); setNotice(`Reply sent. It appears in your chat with ${active.name}.`);
    } catch (reason) { setNotice((reason as { status?: number })?.status === 403 ? "This story is no longer available to reply to." : "Your reply didn’t send. Your text is kept, try again."); }
  }
  const textOnly = !current?.mediaUrl;
  return createPortal(<AnimatePresence>
    {active && current && <motion.div key="story-overlay" initial={{ opacity: 0, y: 28, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 22, scale: .985 }} transition={{ duration: .24, ease: [.22, .8, .2, 1] }} className="fixed inset-0 z-[80] flex items-center justify-center bg-[#100d14] sm:bg-[#100d14]/95 sm:p-4" data-testid="overlay-story-viewer" role="dialog" aria-modal="true" aria-label={`${active.name}'s story`}>
      <div className="relative flex h-[100dvh] w-full max-w-[510px] flex-col overflow-hidden bg-[#201a27] sm:h-[min(860px,94dvh)] sm:rounded-[30px] sm:border sm:border-white/10 sm:shadow-2xl"
        onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
        onTouchEnd={(event) => { const start = touchStart.current; if (!start) return; const dy = event.changedTouches[0].clientY - start.y; if (dy > 75) onClose(); touchStart.current = null; }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: textOnly ? `linear-gradient(150deg, ${current.backgroundColor || "#614777"}, #211b2b 82%)` : "#211b2b" }}>
          {media.url && current.mediaType === "video" ? <video key={current.id} src={media.url} autoPlay playsInline onTimeUpdate={(event) => { const video = event.currentTarget; if (video.duration) setElapsed((video.currentTime / video.duration) * 5000); }} onEnded={() => setIndex((value) => value + 1)} className="h-full w-full object-contain" aria-label="Story video" /> : media.url ? <img src={media.url} alt="" className="h-full w-full object-contain"/> : textOnly ? <div className="flex h-full items-center justify-center px-10 text-center"><p className="brand max-w-sm whitespace-pre-wrap text-3xl font-bold leading-[1.2] text-white sm:text-4xl">{current.caption || "A moment, shared."}</p></div> : <div className="flex h-full items-center justify-center text-sm text-white/75">{media.isLoading ? "Loading private story…" : media.isError ? "This story couldn’t load." : "Story media unavailable."}</div>}
          {!textOnly && current.caption && <div className="absolute inset-x-0 bottom-24 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-7 pb-6 pt-20 text-center text-[15px] leading-6 text-white">{current.caption}</div>}
        </div>
        <div className="relative z-10 px-3 pt-[max(env(safe-area-inset-top),14px)] sm:px-4">
          <div className="mb-4 flex gap-1.5" aria-label={`Story ${index + 1} of ${active.stories.length}`}>{active.stories.map((story, storyIndex) => <span key={story.id} className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/30"><motion.span className="block h-full origin-left rounded-full bg-white" animate={{ scaleX: storyIndex < index ? 1 : storyIndex === index ? Math.min(1, elapsed / 5000) : 0 }} transition={{ duration: .05, ease: "linear" }}/></span>)}</div>
          <div className="flex items-center gap-3"><StoryAvatar reference={active.photo} name={active.name} className="h-10 w-10 border border-white/30 text-sm shadow-md"/><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-white">{active.name}</div><div className="text-[10px] text-white/70">{timeAgo(current.createdAt)}</div></div><button type="button" onClick={onClose} data-testid="button-close-story" aria-label="Close story" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur"><X size={20}/></button></div>
        </div>
        <div className="absolute inset-x-0 top-20 bottom-20 z-[2] flex">
          <button type="button" onClick={() => { if (index > 0) setIndex(index - 1); else setElapsed(0); }} data-testid="button-story-previous" aria-label="Previous story" className="h-full w-1/3"/>
          <button type="button" onClick={() => setIndex(index + 1)} data-testid="button-story-next" aria-label="Next story" className="h-full flex-1"/>
        </div>
        <div className="relative z-10 mt-auto px-4 pb-[max(env(safe-area-inset-bottom),18px)] sm:px-5">
          {notice && <p role="status" data-testid="status-story-reply" className="mb-2 text-center text-xs text-white">{notice}</p>}
          {active.matchId && <form onSubmit={(event) => void sendReply(event)} className="flex items-center gap-2">
            <input value={reply} onChange={(event) => setReply(event.target.value)} maxLength={1900} disabled={send.isPending} placeholder={`Reply to ${active.name}…`} aria-label={`Reply to ${active.name}'s story`} data-testid="input-story-reply" className="min-h-12 min-w-0 flex-1 rounded-full border border-white/25 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-white/65 focus:border-white/60"/>
            <button type="submit" disabled={!reply.trim() || send.isPending} aria-label="Send story reply" data-testid="button-send-story-reply" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-[#24111b] disabled:opacity-45">{send.isPending ? <LoaderCircle className="animate-spin" size={17}/> : <Send size={17}/>}</button>
          </form>}
        </div>
      </div>
    </motion.div>}
  </AnimatePresence>, document.body);
}

function timeAgo(date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
  return minutes < 1 ? "Just now" : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
}

export function StoryComposerPage() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const requestUpload = useRequestStoryMediaUpload();
  const transcode = useTranscodeStoryVideo();
  const createStory = useCreateStory();
  const [caption, setCaption] = useState("");
  const [background, setBackground] = useState(TEXT_BACKGROUNDS[0]);
  const [mode, setMode] = useState<"text" | "media">("text");
  const [file, setFile] = useState<File | null>(null);
  const [fileContentType, setFileContentType] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [checkingVideo, setCheckingVideo] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const mediaType = fileContentType.startsWith("video/") ? "video" : "image";
  const busy = Boolean(busyLabel) || checkingVideo;
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function chooseFile(next?: File) {
    if (!next) return;
    const contentType = storyContentType(next);
    if (!contentType) { setError("Choose a JPEG, PNG, WebP or HEIC photo, or an MP4 or MOV video."); return; }
    const isVideo = contentType.startsWith("video/");
    if (isVideo && next.size > STORY_VIDEO_MAX_BYTES) { setError("Choose a video smaller than 100 MB."); return; }
    if (!isVideo && next.size > STORY_IMAGE_MAX_BYTES) { setError("Choose a photo smaller than 15 MB."); return; }
    setError("");
    if (isVideo) {
      setCheckingVideo(true);
      try {
        setBusyLabel("Checking video length…");
        const duration = await readVideoDuration(next);
        if (duration > STORY_VIDEO_MAX_SECONDS) {
          setError("Story videos must be 15 seconds or shorter.");
          return;
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "This video couldn’t be checked.");
        return;
      } finally {
        setCheckingVideo(false);
        setBusyLabel("");
      }
    }
    setFile(next);
    setFileContentType(contentType);
    setMode("media");
  }
  async function post() {
    if (busy || (!file && !caption.trim())) { if (!file && !caption.trim()) setError("Add a moment or write a few words first."); return; }
    setError(""); setBusyLabel(file ? "Preparing your story…" : "Posting your story…");
    try {
      let input: StoryInput;
      if (file) {
        const signed = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: fileContentType as "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "video/mp4" | "video/quicktime", mediaType } });
        setBusyLabel("Uploading privately…");
        const response = await fetch(signed.uploadURL, { method: "PUT", headers: { "Content-Type": fileContentType }, body: file });
        if (!response.ok) throw new Error("The private upload didn’t finish. Please try again.");
        let mediaReference = signed.mediaReference;
        if (mediaType === "video") {
          setBusyLabel("Checking video length…");
          const result = await transcode.mutateAsync({ mediaId: signed.mediaId });
          mediaReference = result.mediaReference;
        }
        input = { mediaUrl: mediaReference, mediaType, ...(caption.trim() ? { caption: caption.trim() } : {}) };
      } else {
        input = { caption: caption.trim(), backgroundColor: background };
      }
      setBusyLabel("Posting your story…");
      await createStory.mutateAsync({ data: input });
      await client.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
      setSuccess(true);
      toast({ title: "Story posted", description: "Your story is now available to your matches." });
      window.setTimeout(() => setLocation("/discover"), 700);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your story couldn’t be posted. Please try again.");
    } finally { setBusyLabel(""); }
  }
  return <main className="mx-auto min-h-[calc(100dvh-66px)] max-w-[980px] px-4 py-5 sm:px-7 sm:py-8 lg:min-h-[100dvh]" data-testid="page-story-composer">
    <header className="mb-6 flex items-center gap-3">
      <button type="button" onClick={() => setLocation("/discover")} aria-label="Back to discovery" data-testid="button-story-back" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-muted-foreground hover:bg-white/[.05]"><ArrowLeft size={18}/></button>
      <div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#d3a5ed]">A private moment</div><h1 className="brand mt-0.5 text-2xl font-bold tracking-[-.04em]">Add to your story</h1></div>
    </header>
    <div className="grid gap-5 md:grid-cols-[1fr_.8fr] md:gap-7">
      <section className="rounded-[26px] border border-white/[.08] bg-card p-4 sm:p-6">
        <div className="mb-5 flex rounded-full border border-white/[.08] bg-black/15 p-1">
          <button type="button" onClick={() => { setMode("text"); setFile(null); setFileContentType(""); setError(""); }} data-testid="button-story-text-mode" className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors ${mode === "text" ? "bg-[#684a7d] text-white" : "text-muted-foreground hover:text-foreground"}`}>Words</button>
          <button type="button" onClick={() => { setMode("media"); setError(""); }} data-testid="button-story-media-mode" className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors ${mode === "media" ? "bg-[#684a7d] text-white" : "text-muted-foreground hover:text-foreground"}`}><ImagePlus size={16}/>Photo or video</button>
        </div>
        {mode === "text" ? <div className="space-y-4">
          <label className="block text-xs font-semibold text-muted-foreground">Your words <span className="font-normal">(optional background)</span><textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={500} rows={6} placeholder="A small moment from today…" data-testid="input-story-caption" className="field mt-2 min-h-[164px] resize-none rounded-[20px] px-4 py-4 text-base leading-7 placeholder:text-muted-foreground/70"/></label>
          <div><div className="mb-2 text-xs font-semibold text-muted-foreground">Choose a tone</div><div className="flex flex-wrap gap-2">{TEXT_BACKGROUNDS.map((color) => <button key={color} type="button" onClick={() => setBackground(color)} aria-label={`Choose background ${color}`} aria-pressed={background === color} data-testid={`button-story-color-${color.slice(1)}`} className={`h-9 w-9 rounded-full border-2 transition-transform ${background === color ? "scale-110 border-white" : "border-white/20"}`} style={{ backgroundColor: color }}/>)}</div></div>
        </div> : <>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void chooseFile(event.target.files?.[0]); event.currentTarget.value = ""; }} data-testid="input-story-camera"/>
          <input ref={galleryRef} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => { void chooseFile(event.target.files?.[0]); event.currentTarget.value = ""; }} data-testid="input-story-gallery"/>
          <div className={`relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-[22px] border border-white/[.08] ${preview ? "bg-black" : "bg-[linear-gradient(145deg,#392c45,#241e2b)]"}`}>
            {preview ? mediaType === "video" ? <video src={preview} controls playsInline className="max-h-[390px] max-w-full object-contain" data-testid="preview-story-video"/> : <img src={preview} alt="Selected story preview" className="max-h-[390px] max-w-full object-contain" data-testid="preview-story-photo"/> : <div className="px-7 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[.07] text-[#d9b7ec]"><ImagePlus size={22}/></span><p className="mt-4 text-sm font-semibold">Your moment stays between you and your matches.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Add a photo or a short video, up to 15 seconds.</p></div>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => cameraRef.current?.click()} data-testid="button-story-camera" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.035] text-sm font-semibold hover:bg-white/[.07]"><ImagePlus size={16}/>Take photo</button><button type="button" onClick={() => galleryRef.current?.click()} data-testid="button-story-gallery" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.035] text-sm font-semibold hover:bg-white/[.07]"><Video size={16}/>Choose media</button></div>
          {file && <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span className="truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" onClick={() => { setFile(null); setFileContentType(""); }} data-testid="button-remove-story-media" aria-label="Remove selected media" className="rounded-lg p-2 text-muted-foreground hover:text-foreground"><X size={15}/></button></div>}
          <label className="mt-5 block text-xs font-semibold text-muted-foreground">Caption <span className="font-normal">· optional</span><textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={500} rows={2} placeholder="Add a thought…" data-testid="input-story-media-caption" className="field mt-2 min-h-[86px] resize-none rounded-[16px]"/></label>
        </>}
        {error && <p role="alert" data-testid="error-story-composer" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[.06] px-3 py-2.5 text-xs leading-5 text-rose-200">{error}</p>}
        {success && <p role="status" data-testid="status-story-posted" className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-300/[.06] px-3 py-2.5 text-xs text-emerald-200"><Check size={15}/>Your story is up. Heading back to discovery…</p>}
        <button type="button" onClick={() => void post()} disabled={busy || success} data-testid="button-post-story" className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-[#25121e] transition-colors hover:bg-[#ff78b8] disabled:cursor-wait disabled:opacity-60">{busy ? <><LoaderCircle size={17} className="animate-spin"/>{busyLabel}</> : success ? "Posted" : "Post story"}</button>
      </section>
      <aside className="hidden md:block">
        <div className="sticky top-8">
          <div className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">A close circle</div><h2 className="brand mt-3 max-w-sm text-3xl font-bold leading-tight">Not a post for everyone. A moment for your people.</h2><p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Stories are shared only with your mutual matches, disappear after their time, and never go on a public profile.</p>
          <div className="mt-7 flex items-center gap-3 rounded-2xl border border-white/[.08] bg-white/[.025] p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#694c7f]/25 text-[#d8b4ee]"><ShieldCheck size={18}/></span><p className="text-xs leading-5 text-muted-foreground">Keep it personal. Replies arrive in your existing match chat.</p></div>
        </div>
      </aside>
    </div>
  </main>;
}
