import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMyReelsQueryKey, getGetReelsFeedQueryKey, useCreateReel, useGetReelMusic,
  useRequestProfileMediaUpload, useTranscodeReelVideo, type ReelMusicTrack,
} from "@workspace/api-client-react";
import { ArrowLeft, Camera, Check, ChevronLeft, ChevronRight, ExternalLink, Film, Images, Music2, Pause, Play, RotateCcw, Search, X } from "lucide-react";
import { prepareProfilePhoto, uploadProfilePhotoBytes, validatePreparedPhoto } from "@/lib/profile-photo-upload";
import { reelFileProblem, reelVideoContentType, safeReelReturnPath } from "@/lib/reels";
import { reelPostUnauthorizedMessage, uploadReelVideoBytes } from "@/lib/reel-upload";
import { userErrorMessage } from "@/lib/user-errors";
import { QuietSpinner } from "@/components/ui/quiet-spinner";
import "@/components/reels/reels.css";

type Stage = "idle" | "uploading" | "processing" | "publishing";
type ReelMode = "video" | "slides";
type ReelAudience = "public" | "friends";
const MAX_REEL_PHOTOS = 10;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let failed = false;
  let failure: unknown;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (!failed) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        results[index] = await task(items[index], index);
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
  });
  await Promise.all(workers);
  if (failed) throw failure;
  return results;
}

export function ReelComposerPage() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const returnTo = safeReelReturnPath(new URLSearchParams(window.location.search).get("returnTo") ?? "/reels");
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const slidesInput = useRef<HTMLInputElement>(null);
  const previewTouch = useRef<{ x: number; y: number } | null>(null);
  const uploadedSlides = useRef(new Map<File, string>());
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [videoPreviewUnavailable, setVideoPreviewUnavailable] = useState(false);
  const [mode, setMode] = useState<ReelMode>("video");
  const [slideFiles, setSlideFiles] = useState<File[]>([]);
  const [slidePreviews, setSlidePreviews] = useState<string[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [soundtrackId, setSoundtrackId] = useState<string | null>(null);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [musicSearch, setMusicSearch] = useState("");
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);
  const [audience, setAudience] = useState<ReelAudience | null>(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [uploadAttempt, setUploadAttempt] = useState(0);
  const [slideProgress, setSlideProgress] = useState<{ completed: number; total: number } | null>(null);
  const [preparingSlides, setPreparingSlides] = useState(false);
  const [slidePrepareProgress, setSlidePrepareProgress] = useState<{ completed: number; total: number } | null>(null);
  const requestUpload = useRequestProfileMediaUpload();
  const transcode = useTranscodeReelVideo();
  const create = useCreateReel();
  const musicQuery = useGetReelMusic({ query: { staleTime: 24 * 60 * 60 * 1000 } });
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const busy = stage !== "idle";
  const hasValidSlideCount = slideFiles.length >= 1 && slideFiles.length <= MAX_REEL_PHOTOS;
  const tracks = musicQuery.data?.tracks ?? [];
  const selectedTrack = tracks.find((track) => track.id === soundtrackId);
  const normalizedMusicSearch = musicSearch.trim().toLocaleLowerCase();
  const filteredTracks = tracks.filter((track) =>
    `${track.title} ${track.artist} ${track.category}`.toLocaleLowerCase().includes(normalizedMusicSearch),
  );
  const previewGeneration = useRef(0);

  const releasePreviewAudio = useCallback(() => {
    previewGeneration.current += 1;
    const audio = previewAudio.current;
    previewAudio.current = null;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute("src");
    audio.load();
  }, []);

  const stopTrackPreview = useCallback(() => {
    releasePreviewAudio();
    setPreviewingTrackId(null);
  }, [releasePreviewAudio]);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const urls = slideFiles.map((item) => URL.createObjectURL(item));
    setSlidePreviews(urls);
    setSlideIndex((current) => Math.min(current, Math.max(0, urls.length - 1)));
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [slideFiles]);

  useEffect(() => () => releasePreviewAudio(), [releasePreviewAudio]);

  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.visibilityState !== "visible") stopTrackPreview();
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => document.removeEventListener("visibilitychange", stopWhenHidden);
  }, [stopTrackPreview]);

  async function toggleTrackPreview(track: ReelMusicTrack) {
    if (previewingTrackId === track.id) {
      stopTrackPreview();
      return;
    }
    releasePreviewAudio();
    setPreviewingTrackId(null);
    const audio = new Audio(track.audioUrl);
    audio.preload = "none";
    const generation = previewGeneration.current;
    audio.onended = () => {
      if (previewAudio.current !== audio || generation !== previewGeneration.current) return;
      stopTrackPreview();
    };
    previewAudio.current = audio;
    try {
      await audio.play();
      if (previewAudio.current !== audio || generation !== previewGeneration.current) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        return;
      }
      setPreviewingTrackId(track.id);
    } catch {
      if (previewAudio.current === audio && generation === previewGeneration.current) {
        setError("This preview couldn’t start. Try again.");
        stopTrackPreview();
      }
    }
  }

  function choose(next: File | undefined) {
    if (!next || busy) return;
    setError("");
    const problem = reelFileProblem(next);
    if (problem) { setError(problem); return; }
    setVideoPreviewUnavailable(false);
    setFile(next);
  }

  async function chooseSlides(list: FileList | null) {
    if (!list || busy || preparingSlides) return;
    const incoming = Array.from(list);
    if (!incoming.length) return;
    setError("");
    const remaining = Math.max(0, MAX_REEL_PHOTOS - slideFiles.length);
    const exceededLimit = incoming.length > remaining;
    const candidates = incoming.slice(0, remaining);
    if (!candidates.length) {
      setError(`A Reel can contain up to ${MAX_REEL_PHOTOS} photos. Remove a photo before adding more.`);
      return;
    }

    const preparationErrors: string[] = [];
    setPreparingSlides(true);
    setSlidePrepareProgress({ completed: 0, total: candidates.length });
    try {
      const prepared = await mapWithConcurrency(candidates, 2, async (photo, index) => {
        try {
          return await prepareProfilePhoto(photo);
        } catch (reason) {
          preparationErrors[index] = reason instanceof Error
            ? reason.message
            : "This photo could not be prepared. Save it to your device and select it again.";
          return undefined;
        } finally {
          setSlidePrepareProgress((current) => current ? { ...current, completed: current.completed + 1 } : current);
        }
      });
      const ready = prepared.filter((photo): photo is File => Boolean(photo));
      if (ready.length) setSlideFiles((current) => [...current, ...ready].slice(0, MAX_REEL_PHOTOS));
      if (preparationErrors.length) setError(preparationErrors.find(Boolean) ?? "Some photos could not be read. Save them to your device and select them again.");
      else if (exceededLimit) setError(`A Reel can contain up to ${MAX_REEL_PHOTOS} photos. Added the first ${candidates.length} from this selection.`);
    } finally {
      setPreparingSlides(false);
      setSlidePrepareProgress(null);
    }
  }

  function moveSlide(delta: number) {
    setSlideIndex((current) => Math.max(0, Math.min(slideFiles.length - 1, current + delta)));
  }

  function finishPreviewSwipe(event: TouchEvent<HTMLDivElement>) {
    const start = previewTouch.current;
    previewTouch.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) moveSlide(dx < 0 ? 1 : -1);
  }

  async function post() {
    if (busy || preparingSlides) return;
    if (mode === "slides" && !hasValidSlideCount) {
      setError(`Choose 1 to ${MAX_REEL_PHOTOS} photos for this Reel.`);
      return;
    }
    if (mode === "video" && !file) return;
    setError("");
    setUploadAttempt(0);
    setSlideProgress(mode === "slides" ? { completed: 0, total: slideFiles.length } : null);
    try {
      if (mode === "slides") {
        setStage("processing");
        await mapWithConcurrency(slideFiles, 2, async (photo) => {
          await validatePreparedPhoto(photo);
          setSlideProgress((current) => current ? { ...current, completed: current.completed + 1 } : current);
        });
        setSlideProgress({ completed: 0, total: slideFiles.length });
      }
      setStage("uploading");
      if (mode === "slides") {
        const mediaIds = await mapWithConcurrency(slideFiles, 3, async (photo) => {
          let mediaId = uploadedSlides.current.get(photo);
          if (!mediaId) {
            const signed = await requestUpload.mutateAsync({
              data: { name: photo.name || "reel-slide.jpg", size: photo.size, contentType: "image/jpeg", mediaType: "image" },
            });
            await uploadProfilePhotoBytes(signed.uploadURL, photo, { onAttempt: setUploadAttempt });
            mediaId = signed.mediaId;
            uploadedSlides.current.set(photo, mediaId);
          }
          setSlideProgress((current) => current ? { ...current, completed: current.completed + 1 } : current);
          return mediaId;
        });
        setStage("processing");
        const reel = await create.mutateAsync({
          data: { slideMediaIds: mediaIds, audience: audience!, ...(caption.trim() ? { caption: caption.trim() } : {}), ...(soundtrackId ? { soundtrackId } : {}) },
        });
        void client.invalidateQueries({ queryKey: getGetReelsFeedQueryKey() });
        void client.invalidateQueries({ queryKey: getGetMyReelsQueryKey() });
        setLocation(`/reels/${reel.id}?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
        return;
      }
      if (!file) { setStage("idle"); return; }
      const contentType = reelVideoContentType(file);
      if (!contentType) { setError("Choose an MP4 or MOV video."); setStage("idle"); return; }
      const signed = await requestUpload.mutateAsync({ data: { name: file.name || "reel.mp4", size: file.size, contentType, mediaType: "video" } });
      await uploadReelVideoBytes(signed.uploadURL, file, contentType, { onAttempt: setUploadAttempt });
      setStage("processing");
      await transcode.mutateAsync({ mediaId: signed.mediaId });
      setStage("publishing");
      const reel = await create.mutateAsync({ data: { mediaId: signed.mediaId, audience: audience!, ...(caption.trim() ? { caption: caption.trim() } : {}), ...(soundtrackId ? { soundtrackId } : {}) } });
      void client.invalidateQueries({ queryKey: getGetReelsFeedQueryKey() });
      void client.invalidateQueries({ queryKey: getGetMyReelsQueryKey() });
      setLocation(`/reels/${reel.id}?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    } catch (reason) {
      setError(reelPostUnauthorizedMessage(reason) ?? userErrorMessage(reason, "Your Reel was not posted. Your selected media is still here; check your connection and try again."));
      setStage("idle");
    }
  }

  return <div className="reel-composer" data-testid="page-reel-composer">
    <header className="flex items-center gap-3 px-4 pb-3 pt-[max(env(safe-area-inset-top),14px)]">
      <button type="button" onClick={() => setLocation(returnTo)} disabled={busy} aria-label="Back" data-testid="button-composer-back" className="reels-icon"><ArrowLeft size={24} /></button>
      <h1 className="reels-title">New Reel</h1>
    </header>
    <input ref={cameraInput} type="file" accept="video/*" capture="user" className="hidden" onChange={(event) => { choose(event.target.files?.[0]); event.currentTarget.value = ""; }} data-testid="input-reel-camera" />
    <input ref={libraryInput} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" className="hidden" onChange={(event) => { choose(event.target.files?.[0]); event.currentTarget.value = ""; }} data-testid="input-reel-library" />
    <input ref={slidesInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif" multiple disabled={busy || preparingSlides} className="hidden" onChange={(event) => { void chooseSlides(event.currentTarget.files); event.currentTarget.value = ""; }} data-testid="input-reel-slides" />
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-4 px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
      <div className="grid grid-cols-2 rounded-2xl bg-white/[.06] p-1" role="tablist" aria-label="Reel type">
        <button type="button" role="tab" aria-selected={mode === "video"} onClick={() => { setMode("video"); setError(""); }} className={`flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold ${mode === "video" ? "bg-primary text-primary-foreground" : "text-white/65"}`} data-testid="tab-reel-video"><Film size={16} />Video</button>
        <button type="button" role="tab" aria-selected={mode === "slides"} onClick={() => { setMode("slides"); setError(""); }} className={`flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold ${mode === "slides" ? "bg-primary text-primary-foreground" : "text-white/65"}`} data-testid="tab-reel-slides"><Images size={16} />Photo</button>
      </div>
      <div className="reel-preview relative">
        {mode === "slides" && slidePreviews.length ? <div className="relative h-full w-full overflow-hidden" onTouchStart={(event) => { const touch = event.changedTouches[0]; previewTouch.current = touch ? { x: touch.clientX, y: touch.clientY } : null; }} onTouchEnd={finishPreviewSwipe} data-testid="preview-reel-slideshow">
          <img src={slidePreviews[slideIndex]} alt={`Photo slide ${slideIndex + 1} of ${slideFiles.length}`} className="h-full w-full object-contain" />
          <span className="absolute right-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-bold text-white">{slideIndex + 1}/{slideFiles.length}</span>
          {slideIndex > 0 && <button type="button" onClick={() => moveSlide(-1)} aria-label="Previous photo" className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55" data-testid="button-previous-slide"><ChevronLeft size={20} /></button>}
          {slideIndex < slideFiles.length - 1 && <button type="button" onClick={() => moveSlide(1)} aria-label="Next photo" className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55" data-testid="button-next-slide"><ChevronRight size={20} /></button>}
        </div>
          : mode === "video" && preview ? <video src={preview} controls playsInline muted autoPlay loop preload="metadata" onLoadedData={() => setVideoPreviewUnavailable(false)} onError={() => setVideoPreviewUnavailable(true)} className="h-full w-full object-contain" data-testid="preview-reel-video" />
          : <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <span className="reels-empty-mark">{mode === "slides" ? <Images size={28} /> : <Film size={28} />}</span>
            <p className="mt-5 text-lg font-bold">{mode === "slides" ? `Choose 1–${MAX_REEL_PHOTOS} photos` : "Record or choose a video"}</p>
          </div>}
      </div>
      {mode === "video" && videoPreviewUnavailable && <p role="status" className="rounded-xl bg-white/[.06] px-3 py-2 text-center text-xs text-white/65" data-testid="status-video-preview-unavailable">This phone can’t preview this video format. The video is still selected and can be posted.</p>}
      {mode === "slides" ? <div className="flex items-center gap-2">
        <button type="button" onClick={() => slidesInput.current?.click()} disabled={busy || preparingSlides || slideFiles.length >= MAX_REEL_PHOTOS} data-testid="button-choose-reel-slides" className="reel-sheet-action flex-1">{preparingSlides ? <QuietSpinner size={17} /> : <Images size={18} />}{preparingSlides ? `Preparing photos ${slidePrepareProgress?.completed ?? 0}/${slidePrepareProgress?.total ?? 0}` : slideFiles.length ? `Add photos (${slideFiles.length}/${MAX_REEL_PHOTOS})` : `Choose photos (up to ${MAX_REEL_PHOTOS})`}</button>
        {slideFiles.length > 0 && <button type="button" onClick={() => { setSlideFiles((current) => current.filter((_, index) => index !== slideIndex)); setSlideIndex((current) => Math.max(0, current - 1)); }} disabled={busy} aria-label="Remove current photo" data-testid="button-remove-reel-slide" className="reel-sheet-action w-12 shrink-0 px-0"><X size={18} /></button>}
      </div> : <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => cameraInput.current?.click()} disabled={busy} data-testid="button-record-reel" className="reel-sheet-action">{file ? <RotateCcw size={18} /> : <Camera size={18} />}{file ? "Record again" : "Record"}</button>
        <button type="button" onClick={() => libraryInput.current?.click()} disabled={busy} data-testid="button-choose-reel" className="reel-sheet-action"><Film size={18} />{file ? "Choose another" : "Choose video"}</button>
      </div>}
      <section aria-label="Reel music" className="rounded-2xl border border-white/10 bg-white/[.04] p-3" data-testid="section-reel-music">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Music2 size={19}/></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">{selectedTrack?.title ?? "Add music"}</p>
            {selectedTrack ? <p className="truncate text-xs text-white/55">{selectedTrack.artist}</p> : null}
          </div>
          {selectedTrack ? <button type="button" onClick={() => setMusicPickerOpen(true)} disabled={busy} className="rounded-full px-3 py-2 text-xs font-bold text-primary" data-testid="button-change-reel-music">Change</button> : null}
          {selectedTrack ? <button type="button" onClick={() => { setSoundtrackId(null); stopTrackPreview(); }} disabled={busy} aria-label="Remove music" className="flex h-9 w-9 items-center justify-center rounded-full text-white/65" data-testid="button-remove-reel-music"><X size={18}/></button> : null}
          {!selectedTrack ? <button type="button" onClick={() => setMusicPickerOpen(true)} disabled={busy} className="rounded-full bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground" data-testid="button-add-reel-music">Choose</button> : null}
        </div>
      </section>
      <label className="block text-xs font-semibold text-white/60">Caption<textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={300} rows={2} disabled={busy} placeholder="Say something about this moment" data-testid="input-reel-caption" className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3 text-[16px] text-white placeholder:text-white/35 focus:border-primary/60 focus:outline-none" /><span className="mt-1 block text-right font-normal text-white/40">{caption.length}/300</span></label>
      <label className="block text-xs font-semibold text-white/60">
        Who can see this Reel?
        <select value={audience ?? ""} onChange={(event) => setAudience(event.target.value as ReelAudience || null)} disabled={busy} aria-label="Who can see this Reel?" data-testid="select-reel-audience" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[.04] px-4 text-sm font-semibold text-white focus:border-primary/60 focus:outline-none">
          <option value="" disabled className="bg-[#151319]">Choose audience</option>
          <option value="public" className="bg-[#151319]">Public</option>
          <option value="friends" className="bg-[#151319]">Friends</option>
        </select>
      </label>
      {stage === "uploading" && uploadAttempt > 1 && <div role="status" aria-label="Loading" className="flex justify-center"><QuietSpinner /></div>}
      {preparingSlides && <p role="status" className="text-center text-xs text-white/55" data-testid="status-reel-photo-preparation">Reading and preparing photos {slidePrepareProgress?.completed ?? 0}/{slidePrepareProgress?.total ?? 0}…</p>}
      {stage !== "idle" && <p role="status" className="text-center text-xs text-white/55" data-testid="status-reel-post">
        {stage === "uploading" && mode === "slides" && slideProgress
          ? `Uploading photo ${slideProgress.completed}/${slideProgress.total}…`
          : stage === "uploading" ? "Uploading your video…"
            : stage === "processing" && mode === "slides" ? "Checking your photo and preparing the Reel…"
              : stage === "processing" ? "Checking your video…"
                : "Publishing your Reel…"}
      </p>}
      {error && <p role="alert" className="rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100" data-testid="error-reel-composer">{error}</p>}
      <button type="button" onClick={() => void post()} disabled={(mode === "video" ? !file : !hasValidSlideCount) || !audience || busy || preparingSlides} aria-label={busy ? "Posting Reel" : "Post Reel"} data-testid="button-post-reel" className="reels-primary mt-auto w-full disabled:opacity-40">
        {busy ? <QuietSpinner size={20} /> : "Post"}
      </button>
    </div>
    {musicPickerOpen && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setMusicPickerOpen(false); stopTrackPreview(); } }}>
      <section role="dialog" aria-modal="true" aria-labelledby="reel-music-title" className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-background text-foreground shadow-2xl sm:rounded-3xl" data-testid="dialog-reel-music">
        <header className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1"><h2 id="reel-music-title" className="text-lg font-extrabold text-foreground">Choose music</h2><p className="mt-0.5 text-xs text-muted-foreground">Free tracks with creator credit included</p></div>
          <button type="button" onClick={() => { setMusicPickerOpen(false); stopTrackPreview(); }} aria-label="Close music picker" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/40 text-foreground" data-testid="button-close-reel-music"><X size={19}/></button>
        </header>
        <label className="mx-4 mt-4 flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted/35 px-3 text-muted-foreground">
          <Search size={17}/><input type="search" value={musicSearch} onChange={(event) => setMusicSearch(event.target.value)} placeholder="Search tracks" aria-label="Search free music" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" data-testid="input-reel-music-search"/>
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
          {musicQuery.isLoading ? <div className="flex justify-center py-8" aria-label="Loading music"><QuietSpinner/></div> : null}
          {musicQuery.isError ? <div className="py-8 text-center text-sm text-muted-foreground"><p>Music is unavailable right now.</p><button type="button" onClick={() => void musicQuery.refetch()} className="mt-3 font-bold text-primary">Try again</button></div> : null}
          {!musicQuery.isLoading && !musicQuery.isError && filteredTracks.map((track) => {
            const isSelected = soundtrackId === track.id;
            const isPreviewing = previewingTrackId === track.id;
            return <article key={track.id} className="flex items-center gap-3 border-b border-border py-3" data-testid={`reel-music-track-${track.id}`}>
              <button type="button" onClick={() => void toggleTrackPreview(track)} aria-label={`${isPreviewing ? "Pause" : "Preview"} ${track.title}`} aria-pressed={isPreviewing} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary" data-testid={`button-preview-music-${track.id}`}>{isPreviewing ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}</button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{track.title}</p>
                <p className="truncate text-xs text-muted-foreground">{track.artist} · {track.category}</p>
                <a href={track.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground underline underline-offset-2" data-testid={`link-music-license-${track.id}`}>{track.license} · details <ExternalLink size={10}/></a>
              </div>
              <button type="button" onClick={() => { setSoundtrackId(track.id); setMusicPickerOpen(false); stopTrackPreview(); setError(""); }} className={`flex min-h-9 min-w-[70px] items-center justify-center gap-1 rounded-full px-3 text-xs font-extrabold ${isSelected ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground"}`} aria-label={isSelected ? `${track.title} selected` : `Use ${track.title}`} data-testid={`button-use-music-${track.id}`}>{isSelected ? <><Check size={14}/>Added</> : "Use"}</button>
            </article>;
          })}
          {!musicQuery.isLoading && !musicQuery.isError && !filteredTracks.length ? <p className="py-8 text-center text-sm text-muted-foreground">No tracks match that search.</p> : null}
          <p className="pt-4 text-center text-[11px] leading-4 text-muted-foreground">Tracks are licensed for reuse. The creator, source, and license stay attached to the Reel.</p>
        </div>
      </section>
    </div>}
  </div>;
}
