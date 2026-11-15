import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ImageIcon, LoaderCircle, Play, RotateCcw, X } from "lucide-react";
import { getGetMediaPreviewQueryKey, useGetMediaPreview, useGetProfileMedia } from "@workspace/api-client-react";

/** Server-made thumbnail (never the original). Returns a blob URL or a failure state. */
export function useMediaThumbnail(reference: string | null | undefined, enabled = true) {
  const id = reference?.startsWith("media:") ? reference.slice(6) : "";
  const query = useGetMediaPreview(id, { query: { enabled: enabled && !!id, queryKey: getGetMediaPreviewQueryKey(id), staleTime: Infinity, gcTime: 10 * 60_000,
    retry: (count, error) => count < 3 && [503, 500, 502, 504].includes((error as { status?: number })?.status ?? 0), retryDelay: count => 1500 * (count + 1) } });
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!(query.data instanceof Blob)) { setUrl(""); return; }
    const next = URL.createObjectURL(query.data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [query.data]);
  return { url, loading: !!id && query.isLoading, failed: !id || query.isError, retry: () => void query.refetch() };
}

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

export function ChatMediaMessage({ reference, fullUrl, type }: { reference: string; fullUrl: string; type: "image" | "video" }) {
  const thumb = useMediaThumbnail(reference);
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
      className="relative block w-[min(260px,66vw)] overflow-hidden rounded-[10px] bg-[hsl(var(--chat-soft))] text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chat-accent)]"
      onClick={show}
      onTouchStart={event => { const point = event.touches[0]; touch.current = event.touches.length === 1 ? { x: point.clientX, y: point.clientY, moved: false, time: Date.now() } : null; }}
      onTouchMove={event => { const point = event.touches[0]; if (touch.current && point && (Math.abs(point.clientX - touch.current.x) > 10 || Math.abs(point.clientY - touch.current.y) > 10)) touch.current.moved = true; }}
      onTouchCancel={() => { touch.current = null; }}
      onTouchEnd={event => { const start = touch.current; touch.current = null; if (start && !start.moved && Date.now() - start.time < 600) { event.preventDefault(); event.stopPropagation(); show(); } }}>
      {thumb.url
        ? <img src={thumb.url} alt={`${label} thumbnail`} data-testid="img-chat-media-thumbnail" className="block max-h-[320px] min-h-24 w-full object-cover"/>
        : <span className={`flex h-40 w-full flex-col items-center justify-center gap-1.5 text-[hsl(var(--chat-muted))] ${thumb.loading ? "animate-pulse" : ""}`}>
            <Icon size={26}/>
            <span className="text-xs font-semibold">{thumb.loading ? "Loading preview" : `${label} · preview unavailable`}</span>
          </span>}
      {type === "video" && thumb.url && <span aria-hidden className="absolute inset-0 flex items-center justify-center"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm"><Play size={20} fill="currentColor" strokeWidth={0} className="ml-0.5"/></span></span>}
      <span className="absolute left-1.5 top-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white">{label}</span>
    </button>
    {thumb.failed && !thumb.loading && <button type="button" onClick={thumb.retry} data-testid="button-retry-chat-thumbnail" className="mt-1 flex items-center gap-1 text-[11px] font-semibold underline opacity-80"><RotateCcw size={11}/>Retry preview</button>}
    {open && createPortal(<div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${label} message viewer`} data-testid="chat-media-viewer" className="fixed inset-0 z-[1000] flex flex-col bg-background text-foreground outline-none" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="flex shrink-0 items-center justify-between px-4 py-3"><span className="font-bold">{label}</span><button aria-label="Close media" data-testid="button-close-chat-media" onClick={close} className="rounded-full bg-primary/10 p-3 text-primary"><X size={24}/></button></header>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        {loaded ? <LoadedMedia reference={reference} fullUrl={fullUrl} type={type}/> : <div className="relative max-h-full w-[min(420px,100%)] overflow-hidden rounded-2xl bg-muted">{thumb.url ? <img src={thumb.url} alt={`${label} preview`} className="max-h-[65dvh] w-full object-contain"/> : <div className="flex h-56 items-center justify-center text-muted-foreground"><Icon size={48}/></div>}{type === "video" && <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white"><Play size={26} fill="currentColor" strokeWidth={0}/></span></span>}</div>}
      </div>
      <footer className="shrink-0 space-y-3 px-5 pb-5 pt-3 text-center">
        {!loaded && <><p className="text-sm text-muted-foreground">This is a small preview. The full {label.toLowerCase()} has not been downloaded.</p><button data-testid="button-load-chat-media" onClick={() => setLoaded(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-primary-foreground"><Download size={20}/>Load</button></>}
        <button data-testid="button-leave-chat-media" onClick={close} className="min-h-12 w-full rounded-2xl border border-border font-semibold">Close</button>
      </footer>
    </div>, document.body)}
  </>;
}
