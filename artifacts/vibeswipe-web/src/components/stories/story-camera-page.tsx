import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Camera, ImagePlus, LoaderCircle, RefreshCw, Type } from "lucide-react";
import { stageStoryMediaFile } from "@/components/stories/stories-ui";

export function StoryCameraPage({ returnTo }: { returnTo: string }) {
  const [, setLocation] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [loading, setLoading] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [captureError, setCaptureError] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access isn’t available here. You can still choose a photo or video.");
      setLoading(false);
      return;
    }
    void navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1080 }, height: { ideal: 1920 } },
    }).then((stream) => {
      if (!active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }
      setLoading(false);
    }).catch((error: unknown) => {
      if (!active) return;
      const name = error instanceof DOMException ? error.name : "";
      setCameraError(name === "NotAllowedError"
        ? "Allow camera access to take a story photo. You can also choose media from your phone."
        : "The camera couldn’t start. You can still choose a photo or video.");
      setLoading(false);
    });
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facing]);

  function openComposer(file: File) {
    stageStoryMediaFile(file);
    const query = new URLSearchParams({ returnTo, mode: "media" });
    setLocation(`/stories/new?${query.toString()}`);
  }

  async function capturePhoto() {
    setCaptureError("");
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      setCaptureError("The camera is still starting. Try again in a moment.");
      return;
    }
    const maxDimension = 1920;
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      setCaptureError("This photo couldn’t be captured. Please try again.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) {
      setCaptureError("This photo couldn’t be captured. Please try again.");
      return;
    }
    openComposer(new File([blob], `myage-story-${Date.now()}.jpg`, { type: "image/jpeg" }));
  }

  return <main className="fixed inset-0 z-[100] flex min-h-[100dvh] flex-col bg-black text-white" data-testid="page-story-camera">
    <input
      ref={galleryRef}
      type="file"
      accept="image/*,video/*"
      className="hidden"
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) openComposer(file);
      }}
      data-testid="input-story-camera-gallery"
    />
    <header className="relative z-10 flex items-center justify-between px-5 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
      <button type="button" onClick={() => setLocation(returnTo)} aria-label="Close camera" data-testid="button-close-story-camera" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40"><ArrowLeft size={22}/></button>
      <span className="text-sm font-bold">Create story</span>
      <button type="button" onClick={() => setFacing((current) => current === "environment" ? "user" : "environment")} aria-label="Switch camera" data-testid="button-switch-story-camera" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40"><RefreshCw size={20}/></button>
    </header>
    <section className="relative mx-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[28px] bg-[#17131b]" aria-label="Story camera preview">
      {cameraError
        ? <div className="max-w-xs px-6 text-center"><Camera size={34} className="mx-auto text-primary"/><p className="mt-4 text-sm leading-6 text-white/80">{cameraError}</p></div>
        : <video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} data-testid="video-story-camera-preview"/>}
      {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/45" role="status"><LoaderCircle className="animate-spin" size={30}/><span className="sr-only">Starting camera</span></div>}
      {captureError && <p role="alert" className="absolute bottom-4 left-4 right-4 rounded-xl bg-black/65 px-3 py-2 text-center text-xs">{captureError}</p>}
    </section>
    <div className="flex items-center justify-between gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5">
      <button type="button" onClick={() => galleryRef.current?.click()} data-testid="button-story-camera-upload" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 text-sm font-semibold"><ImagePlus size={18}/>Upload media</button>
      <button type="button" onClick={() => void capturePhoto()} disabled={loading || Boolean(cameraError)} aria-label="Take story photo" data-testid="button-capture-story-photo" className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full border-[5px] border-white bg-primary text-[#24121d] shadow-[0_0_0_3px_rgba(255,255,255,.18)] disabled:opacity-45"><Camera size={29} fill="currentColor"/></button>
      <button type="button" onClick={() => setLocation(`/stories/new?${new URLSearchParams({ returnTo, mode: "text" }).toString()}`)} data-testid="button-story-camera-text" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 text-sm font-semibold"><Type size={18}/>Write text</button>
    </div>
  </main>;
}
