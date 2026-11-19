import { useEffect, useRef, useState, type TouchEvent } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMyReelsQueryKey, getGetReelsFeedQueryKey, useCreateReel, useRequestProfileMediaUpload, useTranscodeReelVideo,
} from "@workspace/api-client-react";
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, Film, Images, RotateCcw, X } from "lucide-react";
import { prepareProfilePhoto, uploadProfilePhotoBytes } from "@/lib/profile-photo-upload";
import { readVideoDuration, reelFileProblem, reelVideoContentType, safeReelReturnPath } from "@/lib/reels";
import { reelPostUnauthorizedMessage, uploadReelVideoBytes } from "@/lib/reel-upload";
import { userErrorMessage } from "@/lib/user-errors";
import "@/components/reels/reels.css";

type Stage = "idle" | "uploading" | "processing" | "publishing";
type ReelMode = "video" | "slides";
const STAGE_LABEL: Record<Stage, string> = { idle: "Post", uploading: "Uploading privately", processing: "Checking media safety", publishing: "Publishing" };

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
  const [mode, setMode] = useState<ReelMode>("video");
  const [slideFiles, setSlideFiles] = useState<File[]>([]);
  const [slidePreviews, setSlidePreviews] = useState<string[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [uploadAttempt, setUploadAttempt] = useState(0);
  const requestUpload = useRequestProfileMediaUpload();
  const transcode = useTranscodeReelVideo();
  const create = useCreateReel();
  const busy = stage !== "idle";

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

  async function choose(next: File | undefined) {
    if (!next || busy) return;
    setError("");
    const problem = reelFileProblem(next);
    if (problem) { setError(problem); return; }
    setChecking(true);
    try {
      await readVideoDuration(next);
      setFile(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This video could not be read.");
    } finally { setChecking(false); }
  }

  function chooseSlides(list: FileList | null) {
    if (!list || busy) return;
    const incoming = Array.from(list);
    setError("");
    const remaining = Math.max(0, 10 - slideFiles.length);
    if (incoming.length > remaining) setError("A Reel can contain up to 10 photos.");
    if (remaining) setSlideFiles((current) => [...current, ...incoming.slice(0, remaining)]);
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
    if (busy) return;
    if (mode === "slides" && (slideFiles.length < 2 || slideFiles.length > 10)) {
      setError("Choose between 2 and 10 photos for your slideshow.");
      return;
    }
    if (mode === "video" && !file) return;
    setError("");
    setUploadAttempt(0);
    try {
      setStage("uploading");
      if (mode === "slides") {
        const mediaIds: string[] = [];
        for (let position = 0; position < slideFiles.length; position++) {
          const photo = slideFiles[position];
          let mediaId = uploadedSlides.current.get(photo);
          if (!mediaId) {
            const prepared = await prepareProfilePhoto(photo);
            const signed = await requestUpload.mutateAsync({
              data: { name: prepared.name || "reel-slide.jpg", size: prepared.size, contentType: "image/jpeg", mediaType: "image" },
            });
            await uploadProfilePhotoBytes(signed.uploadURL, prepared, { onAttempt: setUploadAttempt });
            mediaId = signed.mediaId;
            uploadedSlides.current.set(photo, mediaId);
          }
          mediaIds.push(mediaId);
        }
        setStage("processing");
        const reel = await create.mutateAsync({
          data: { slideMediaIds: mediaIds, ...(caption.trim() ? { caption: caption.trim() } : {}) },
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
      const reel = await create.mutateAsync({ data: { mediaId: signed.mediaId, ...(caption.trim() ? { caption: caption.trim() } : {}) } });
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
    <input ref={cameraInput} type="file" accept="video/*" capture="user" className="hidden" onChange={(event) => { void choose(event.target.files?.[0]); event.currentTarget.value = ""; }} data-testid="input-reel-camera" />
    <input ref={libraryInput} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" className="hidden" onChange={(event) => { void choose(event.target.files?.[0]); event.currentTarget.value = ""; }} data-testid="input-reel-library" />
    <input ref={slidesInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif" multiple className="hidden" onChange={(event) => { chooseSlides(event.currentTarget.files); event.currentTarget.value = ""; }} data-testid="input-reel-slides" />
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-4 px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
      <div className="grid grid-cols-2 rounded-2xl bg-white/[.06] p-1" role="tablist" aria-label="Reel type">
        <button type="button" role="tab" aria-selected={mode === "video"} onClick={() => { setMode("video"); setError(""); }} className={`flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold ${mode === "video" ? "bg-primary text-primary-foreground" : "text-white/65"}`} data-testid="tab-reel-video"><Film size={16} />Video</button>
        <button type="button" role="tab" aria-selected={mode === "slides"} onClick={() => { setMode("slides"); setError(""); }} className={`flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold ${mode === "slides" ? "bg-primary text-primary-foreground" : "text-white/65"}`} data-testid="tab-reel-slides"><Images size={16} />Photo slides</button>
      </div>
      <div className="reel-preview">
        {mode === "slides" && slidePreviews.length ? <div className="relative h-full w-full overflow-hidden" onTouchStart={(event) => { const touch = event.changedTouches[0]; previewTouch.current = touch ? { x: touch.clientX, y: touch.clientY } : null; }} onTouchEnd={finishPreviewSwipe} data-testid="preview-reel-slideshow">
          <img src={slidePreviews[slideIndex]} alt={`Photo slide ${slideIndex + 1} of ${slideFiles.length}`} className="h-full w-full object-contain" />
          <span className="absolute right-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-bold text-white">{slideIndex + 1}/{slideFiles.length}</span>
          {slideIndex > 0 && <button type="button" onClick={() => moveSlide(-1)} aria-label="Previous photo" className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55" data-testid="button-previous-slide"><ChevronLeft size={20} /></button>}
          {slideIndex < slideFiles.length - 1 && <button type="button" onClick={() => moveSlide(1)} aria-label="Next photo" className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55" data-testid="button-next-slide"><ChevronRight size={20} /></button>}
        </div>
          : mode === "video" && preview ? <video src={preview} controls playsInline muted autoPlay loop className="h-full w-full object-contain" data-testid="preview-reel-video" />
          : <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <span className="reels-empty-mark">{mode === "slides" ? <Images size={28} /> : <Film size={28} />}</span>
            <p className="mt-5 text-lg font-bold">{mode === "slides" ? "Choose 2–10 photos" : "Record or choose a video"}</p>
            <p className="mt-1 text-sm leading-6 text-white/60">{mode === "slides" ? "Your photos become a swipeable Reel. Music is not included yet." : "There is no Reel duration limit. MP4 or MOV videos up to 500 MB are supported; longer videos may take more time to upload and process."}</p>
          </div>}
      </div>
      {mode === "slides" ? <div className="flex items-center gap-2">
        <button type="button" onClick={() => slidesInput.current?.click()} disabled={busy || checking || slideFiles.length >= 10} data-testid="button-choose-reel-slides" className="reel-sheet-action flex-1"><Images size={18} />{slideFiles.length ? `Add photos (${slideFiles.length}/10)` : "Choose photos"}</button>
        {slideFiles.length > 0 && <button type="button" onClick={() => { setSlideFiles((current) => current.filter((_, index) => index !== slideIndex)); setSlideIndex((current) => Math.max(0, current - 1)); }} disabled={busy} aria-label="Remove current photo" data-testid="button-remove-reel-slide" className="reel-sheet-action w-12 shrink-0 px-0"><X size={18} /></button>}
      </div> : <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => cameraInput.current?.click()} disabled={busy || checking} data-testid="button-record-reel" className="reel-sheet-action">{file ? <RotateCcw size={18} /> : <Camera size={18} />}{file ? "Record again" : "Record"}</button>
        <button type="button" onClick={() => libraryInput.current?.click()} disabled={busy || checking} data-testid="button-choose-reel" className="reel-sheet-action"><Film size={18} />{file ? "Choose another" : "Choose video"}</button>
      </div>}
      <label className="block text-xs font-semibold text-white/60">Caption<textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={300} rows={2} disabled={busy} placeholder="Say something about this moment" data-testid="input-reel-caption" className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3 text-[16px] text-white placeholder:text-white/35 focus:border-primary/60 focus:outline-none" /><span className="mt-1 block text-right font-normal text-white/40">{caption.length}/300</span></label>
      {checking && <p role="status" className="text-sm text-white/70">Checking video</p>}
      {stage === "uploading" && uploadAttempt > 1 && <p role="status" className="text-sm text-white/70">Reconnecting to media storage · attempt {uploadAttempt} of 3</p>}
      {error && <p role="alert" className="rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100" data-testid="error-reel-composer">{error}</p>}
      <button type="button" onClick={() => void post()} disabled={(mode === "video" ? !file : slideFiles.length < 2) || busy || checking} data-testid="button-post-reel" className="reels-primary mt-auto w-full disabled:opacity-40">
        {busy && <span className="reel-spinner" aria-hidden="true" />}{STAGE_LABEL[stage]}
      </button>
    </div>
  </div>;
}
