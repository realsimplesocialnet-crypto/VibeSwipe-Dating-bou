import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMyReelsQueryKey, getGetReelsFeedQueryKey, useCreateReel, useRequestProfileMediaUpload, useTranscodeReelVideo,
} from "@workspace/api-client-react";
import { ArrowLeft, Camera, Film, RotateCcw } from "lucide-react";
import { readVideoDuration, reelFileProblem, reelVideoContentType, safeReelReturnPath } from "@/lib/reels";
import { reelPostUnauthorizedMessage, uploadReelVideoBytes } from "@/lib/reel-upload";
import { userErrorMessage } from "@/lib/user-errors";
import "@/components/reels/reels.css";

type Stage = "idle" | "uploading" | "processing" | "publishing";
const STAGE_LABEL: Record<Stage, string> = { idle: "Post", uploading: "Uploading privately", processing: "Checking video safety", publishing: "Publishing" };

export function ReelComposerPage() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const returnTo = safeReelReturnPath(new URLSearchParams(window.location.search).get("returnTo") ?? "/reels");
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
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

  async function post() {
    if (!file || busy) return;
    const contentType = reelVideoContentType(file);
    if (!contentType) { setError("Choose an MP4 or MOV video."); return; }
    setError("");
    setUploadAttempt(0);
    try {
      setStage("uploading");
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
      setError(reelPostUnauthorizedMessage(reason) ?? userErrorMessage(reason, "Your Reel was not posted. Try again."));
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
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-4 px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
      <div className="reel-preview">
        {preview ? <video src={preview} controls playsInline muted autoPlay loop className="h-full w-full object-contain" data-testid="preview-reel-video" />
          : <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <span className="reels-empty-mark"><Film size={28} /></span>
            <p className="mt-5 text-lg font-bold">Record or choose a video</p>
            <p className="mt-1 text-sm leading-6 text-white/60">There is no Reel duration limit. MP4 or MOV videos up to 500 MB are supported; longer videos may take more time to upload and process.</p>
          </div>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => cameraInput.current?.click()} disabled={busy || checking} data-testid="button-record-reel" className="reel-sheet-action">{file ? <RotateCcw size={18} /> : <Camera size={18} />}{file ? "Record again" : "Record"}</button>
        <button type="button" onClick={() => libraryInput.current?.click()} disabled={busy || checking} data-testid="button-choose-reel" className="reel-sheet-action"><Film size={18} />{file ? "Choose another" : "Choose video"}</button>
      </div>
      <label className="block text-xs font-semibold text-white/60">Caption<textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={300} rows={2} disabled={busy} placeholder="Say something about this moment" data-testid="input-reel-caption" className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3 text-[16px] text-white placeholder:text-white/35 focus:border-primary/60 focus:outline-none" /><span className="mt-1 block text-right font-normal text-white/40">{caption.length}/300</span></label>
      {checking && <p role="status" className="text-sm text-white/70">Checking video</p>}
      {stage === "uploading" && uploadAttempt > 1 && <p role="status" className="text-sm text-white/70">Reconnecting to video storage · attempt {uploadAttempt} of 3</p>}
      {error && <p role="alert" className="rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100" data-testid="error-reel-composer">{error}</p>}
      <button type="button" onClick={() => void post()} disabled={!file || busy || checking} data-testid="button-post-reel" className="reels-primary mt-auto w-full disabled:opacity-40">
        {busy && <span className="reel-spinner" aria-hidden="true" />}{STAGE_LABEL[stage]}
      </button>
    </div>
  </div>;
}
