import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ImageIcon, LoaderCircle, Play, X } from "lucide-react";
import { useGetProfileMedia } from "@workspace/api-client-react";

const PREVIEW_URL = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="150"><rect width="240" height="150" rx="16" fill="#fde0ec"/></svg>')}`;

function LoadedMedia({ reference, fullUrl, type }: { reference: string; fullUrl: string; type: "image" | "video" }) {
  const id = reference.startsWith("media:") ? reference.slice(6) : "";
  const asset = useGetProfileMedia(id, { query: { enabled: !!id, retry: false, gcTime: 0 } });
  const [blobUrl, setBlobUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!asset.data) return;
    const url = URL.createObjectURL(asset.data);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [asset.data]);
  if (failed || (id && asset.isError) || (!id && !fullUrl)) return <div role="alert" className="text-center"><p>Couldn’t load this {type === "image" ? "photo" : "video"}.</p><button className="mt-3 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground" onClick={() => { setFailed(false); if (id) void asset.refetch(); }}>Try again</button></div>;
  const src = id ? blobUrl : fullUrl;
  if (!src) return <div role="status" className="flex items-center gap-2"><LoaderCircle className="animate-spin text-primary"/>Loading media…</div>;
  return type === "image"
    ? <img src={src} alt="Full-size message attachment" onError={() => setFailed(true)} className="max-h-full max-w-full object-contain"/>
    : <video src={src} controls playsInline preload="auto" onError={() => setFailed(true)} className="max-h-full max-w-full object-contain"/>;
}

export function ChatMediaMessage({ reference, fullUrl, type, previewUrl = PREVIEW_URL }: { reference: string; fullUrl: string; type: "image" | "video"; previewUrl?: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number; moved: boolean; time: number } | null>(null);
  const label = type === "image" ? "Photo" : "Video";
  const Icon = type === "image" ? ImageIcon : Play;
  function close() { setOpen(false); setLoaded(false); }
  function show() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setLoaded(false);
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled]),video');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("keydown", keyboard); trigger.current?.focus({ preventScroll: true }); };
  }, [open]);
  return <>
    <button ref={trigger} type="button" aria-label={`Open ${label.toLowerCase()} preview`} data-testid="chat-media-preview"
      className="relative mb-2 block w-60 max-w-full overflow-hidden rounded-xl border border-pink-300/30 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-400"
      onClick={show}
      onTouchStart={event => { const point = event.touches[0]; touch.current = event.touches.length === 1 ? { x: point.clientX, y: point.clientY, moved: false, time: Date.now() } : null; }}
      onTouchMove={event => { const point = event.touches[0]; if (touch.current && point && (Math.abs(point.clientX - touch.current.x) > 10 || Math.abs(point.clientY - touch.current.y) > 10)) touch.current.moved = true; }}
      onTouchCancel={() => { touch.current = null; }}
      onTouchEnd={event => { const start = touch.current; touch.current = null; if (start && !start.moved && Date.now() - start.time < 600) { event.preventDefault(); event.stopPropagation(); show(); } }}>
      <img src={previewUrl} alt="" loading="lazy" className="h-36 w-full object-cover"/>
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#b72d68]"><Icon size={32}/><span className="text-sm font-bold">{label} · Tap to view</span><span className="text-xs">Loads only when you choose</span></span>
    </button>
    {open && createPortal(<div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${label} message viewer`} data-testid="chat-media-viewer" className="fixed inset-0 z-[1000] flex flex-col bg-background text-foreground outline-none" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="flex shrink-0 items-center justify-between px-4 py-3"><span className="font-bold">{label}</span><button aria-label="Close media" data-testid="button-close-chat-media" onClick={close} className="rounded-full bg-primary/10 p-3 text-primary"><X size={24}/></button></header>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        {loaded ? <LoadedMedia reference={reference} fullUrl={fullUrl} type={type}/> : <div className="relative w-72 max-w-full overflow-hidden rounded-2xl"><img src={previewUrl} alt={`${label} preview`} className="w-full"/><span className="absolute inset-0 flex items-center justify-center text-[#b72d68]"><Icon size={56}/></span></div>}
      </div>
      <footer className="shrink-0 space-y-3 px-5 pb-5 pt-3 text-center">
        {!loaded && <><p className="text-sm text-muted-foreground">The full {label.toLowerCase()} has not been loaded.</p><button data-testid="button-load-chat-media" onClick={() => setLoaded(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-primary-foreground"><Download size={20}/>Load</button></>}
        <button data-testid="button-leave-chat-media" onClick={close} className="min-h-12 w-full rounded-2xl border border-border font-semibold">{loaded ? "Close" : "Leave it / Close"}</button>
      </footer>
    </div>, document.body)}
  </>;
}
