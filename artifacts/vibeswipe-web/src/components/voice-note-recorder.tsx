import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Mic, RotateCcw, Trash2 } from "lucide-react";
import { formatVoiceDuration } from "@workspace/api-client-react";
import { startVoiceCapture, type VoiceCapture, type VoiceRecording } from "@/lib/voice-recording";

export function VoiceNoteRecorder({ disabled, onSend, onActiveChange }: {
  disabled: boolean;
  onSend: (file: File, duration: number) => Promise<void>;
  onActiveChange: (active: boolean) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "starting" | "recording" | "sending" | "retry">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const capture = useRef<VoiceCapture | null>(null);
  const pending = useRef<VoiceRecording | null>(null);
  const held = useRef(false);
  const working = useRef(false);
  const alive = useRef(true);
  const startX = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; held.current = false; onActiveChange(false);
      const current = capture.current; capture.current = null;
      if (current) void current.cancel().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => setElapsed(capture.current?.seconds() ?? 0), 250);
    return () => clearInterval(timer);
  }, [phase]);
  async function begin() {
    if (disabled || working.current || pending.current || held.current) return;
    held.current = true; working.current = true;
    setError(""); setElapsed(0); setPhase("starting"); onActiveChange(true);
    try {
      const current = await startVoiceCapture();
      if (!alive.current || !held.current) {
        await current.cancel();
        if (alive.current) { setPhase("idle"); onActiveChange(false); }
        return;
      }
      capture.current = current; setPhase("recording");
    } catch (error) {
      if (alive.current) {
        setError(error instanceof DOMException && error.name === "NotAllowedError" ? "Allow microphone access to record a voice note." : error instanceof Error ? error.message : "Recording couldn’t start.");
        setPhase("idle"); onActiveChange(false);
      }
      held.current = false;
    } finally { working.current = false; }
  }
  async function sendPending() {
    const note = pending.current;
    if (!note || working.current) return;
    working.current = true; setPhase("sending"); setError("");
    try {
      await onSend(note.file, note.duration);
      pending.current = null;
      if (alive.current) { setPhase("idle"); onActiveChange(false); }
    } catch (error) {
      if (alive.current) {
        setPhase("retry");
        const message = error instanceof Error ? error.message : "";
        setError(!message || /failed to fetch|network|load failed/i.test(message)
          ? "Your voice note wasn’t sent. It’s kept here—check your connection and tap Retry."
          : message);
      }
    } finally { working.current = false; }
  }
  async function end(cancel = false) {
    held.current = false;
    const current = capture.current; capture.current = null;
    if (!current) return; // Permission/setup is still pending; begin() will discard it.
    if (working.current) return;
    working.current = true;
    try {
      if (cancel) await current.cancel();
      else { setPhase("sending"); pending.current = await current.finish(); }
    } catch (error) {
      if (alive.current) setError(error instanceof Error ? error.message : "Recording could not finish.");
    } finally { working.current = false; }
    if (!alive.current) return;
    if (pending.current && !cancel) await sendPending();
    else { setPhase("idle"); onActiveChange(false); }
  }
  function discard() {
    if (working.current && phase !== "starting") return;
    pending.current = null; setError("");
    if (capture.current || phase === "starting") {
      void end(true);
      if (phase === "starting") { setPhase("idle"); onActiveChange(false); }
    } else { setPhase("idle"); onActiveChange(false); }
  }
  useEffect(() => { if (disabled && held.current) void end(true); }, [disabled]);
  return <div className="relative shrink-0">
    {(phase !== "idle" || error) && <div role="status" aria-live={phase === "recording" ? "off" : "polite"} className="absolute bottom-14 right-0 z-50 w-[min(280px,calc(100vw_-_8rem))] rounded-2xl border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-card))] p-3 text-sm text-[hsl(var(--chat-fg))] shadow-lg" data-testid="voice-recording-status">
      <div className="flex items-center gap-2">
        {phase === "recording" && <span className="h-2 w-2 rounded-full bg-[var(--chat-accent)]"/>}
        <span className="flex-1 font-semibold tabular-nums">{phase === "starting" ? "Allow microphone access…" : phase === "sending" ? "Sending voice note…" : phase === "retry" ? `Voice note · ${formatVoiceDuration(pending.current?.duration ?? elapsed)}` : formatVoiceDuration(elapsed)}</span>
        {phase === "retry" && <button type="button" onClick={() => void sendPending()} aria-label="Retry voice note" data-testid="retry-voice-note" className="p-2 text-[var(--chat-accent)]"><RotateCcw size={20}/></button>}
        {phase !== "sending" && <button type="button" onClick={discard} aria-label="Delete recording" data-testid="cancel-voice-note" className="p-2 text-[var(--chat-accent)]"><Trash2 size={20}/></button>}
      </div>
      {phase === "recording" && <p className="mt-1 text-xs text-[hsl(var(--chat-muted))]">Release to send · Slide left to cancel</p>}
      {error && <p role="alert" className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>}
    <button type="button" disabled={disabled || phase === "sending" || phase === "retry"}
      data-testid="record-voice-note" aria-label="Hold to record a voice note" aria-pressed={phase === "recording"}
      style={{ touchAction: "none" }} onContextMenu={event => event.preventDefault()}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); startX.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); void begin(); }}
      onPointerMove={event => { if (held.current && event.clientX < startX.current - 70) void end(true); }}
      onPointerUp={() => void end()} onPointerCancel={() => void end(true)}
      onKeyDown={event => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); void begin(); } }}
      onKeyUp={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); void end(); } }}
      onBlur={() => { if (held.current) void end(true); }}
      className={`flex h-11 w-11 select-none items-center justify-center rounded-full text-[var(--chat-accent)] disabled:opacity-50 ${phase === "recording" ? "bg-[hsl(var(--chat-soft))] ring-2 ring-[var(--chat-accent)]" : ""}`}>
      {phase === "sending" ? <LoaderCircle size={22} className="animate-spin"/> : <Mic size={23}/>}
    </button>
  </div>;
}
