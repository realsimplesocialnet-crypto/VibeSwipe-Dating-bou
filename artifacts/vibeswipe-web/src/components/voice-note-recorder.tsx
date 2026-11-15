import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronUp, LoaderCircle, Lock, Mic, Pause, RotateCcw, SendHorizontal, Trash2, X } from "lucide-react";
import { formatVoiceDuration } from "@workspace/api-client-react";
import { startVoiceCapture, type VoiceCapture, type VoiceRecording } from "@/lib/voice-recording";

type Phase = "idle" | "starting" | "holding" | "locked" | "finishing" | "sending" | "retry";
const CANCEL_DISTANCE = 90;
const LOCK_DISTANCE = 70;
const BARS = 32;

export function voiceGesture(dx: number, dy: number): "cancel" | "lock" | "none" {
  if (dx <= -CANCEL_DISTANCE) return "cancel";
  if (dy <= -LOCK_DISTANCE && Math.abs(dx) < CANCEL_DISTANCE) return "lock";
  return "none";
}

export function VoiceNoteRecorder({ disabled, onSend, onActiveChange, hidden = false }: {
  disabled: boolean;
  onSend: (file: File, duration: number) => Promise<void>;
  onActiveChange: (active: boolean) => void;
  hidden?: boolean;
}) {
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [paused, setPaused] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const phaseRef = useRef<Phase>("idle");
  const capture = useRef<VoiceCapture | null>(null);
  const pending = useRef<VoiceRecording | null>(null);
  const session = useRef(0);
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const working = useRef(false);
  const alive = useRef(true);
  const activeRef = useRef(onActiveChange);
  activeRef.current = onActiveChange;

  function setPhase(next: Phase) {
    phaseRef.current = next;
    setPhaseState(next);
    activeRef.current(next !== "idle");
  }

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; session.current += 1; pointer.current = null;
      activeRef.current(false);
      const current = capture.current; capture.current = null;
      if (current) void current.cancel().catch(() => {});
      pending.current = null;
    };
  }, []);

  const recording = phase === "holding" || phase === "locked";
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const current = capture.current;
      if (!current) return;
      setElapsed(current.seconds());
      setLevels(previous => [...previous.slice(-(BARS - 1)), current.paused() ? 0.04 : Math.max(0.06, current.level())]);
    }, 110);
    return () => clearInterval(timer);
  }, [recording]);

  async function begin() {
    if (disabled || working.current || pending.current || phaseRef.current !== "idle") return;
    const token = ++session.current;
    setError(""); setElapsed(0); setLevels([]); setPaused(false); setDrag({ x: 0, y: 0 });
    setPhase("starting");
    try {
      const current = await startVoiceCapture();
      // Released, cancelled or unmounted while the permission prompt was open.
      if (!alive.current || token !== session.current || (phaseRef.current as Phase) !== "starting") {
        await current.cancel().catch(() => {});
        return;
      }
      capture.current = current;
      setPhase(pointer.current ? "holding" : "locked");
    } catch (reason) {
      if (!alive.current || token !== session.current) return;
      setError(reason instanceof DOMException && reason.name === "NotAllowedError" ? "Allow microphone access to record a voice note." : reason instanceof Error ? reason.message : "Recording couldn’t start.");
      setPhase("idle");
    }
  }

  async function sendPending() {
    const note = pending.current;
    if (!note || working.current) return;
    working.current = true; setPhase("sending"); setError("");
    try {
      await onSend(note.file, note.duration);
      pending.current = null;
      if (alive.current) setPhase("idle");
    } catch (reason) {
      if (alive.current) {
        setPhase("retry");
        const message = reason instanceof Error ? reason.message : "";
        setError(!message || /failed to fetch|network|load failed/i.test(message) ? "Not sent. Your recording is kept here, tap Retry." : message);
      }
    } finally { working.current = false; }
  }

  async function finish() {
    const current = capture.current;
    if (!current || working.current) return;
    capture.current = null; pointer.current = null;
    working.current = true; setPhase("finishing");
    try { pending.current = await current.finish(); }
    catch (reason) {
      if (alive.current) { setError(reason instanceof Error ? reason.message : "Recording could not finish."); setPhase("idle"); }
      return;
    } finally { working.current = false; }
    if (alive.current) await sendPending();
  }

  async function cancel() {
    session.current += 1; pointer.current = null;
    const current = capture.current; capture.current = null;
    pending.current = null; setError(""); setPaused(false);
    setPhase("idle");
    if (current) await current.cancel().catch(() => {});
  }

  function togglePause() {
    const current = capture.current;
    if (!current?.canPause) return;
    if (current.paused()) { current.resume(); setPaused(false); } else { current.pause(); setPaused(true); }
  }

  useEffect(() => { if (disabled && (phaseRef.current === "holding" || phaseRef.current === "starting")) void cancel(); }, [disabled]);

  function down(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || phaseRef.current === "locked") return;
    event.preventDefault();
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* element may be detached */ }
    void begin();
  }
  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = Math.min(0, event.clientX - start.x), dy = Math.min(0, event.clientY - start.y);
    setDrag({ x: dx, y: dy });
    if (phaseRef.current !== "holding") return;
    const gesture = voiceGesture(dx, dy);
    if (gesture === "cancel") void cancel();
    if (gesture === "lock") {
      pointer.current = null; setDrag({ x: 0, y: 0 });
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released */ }
      setPhase("locked");
    }
  }
  function up(event: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) return;
    pointer.current = null; setDrag({ x: 0, y: 0 });
    if (phaseRef.current === "starting") { void cancel(); return; }
    if (phaseRef.current !== "holding") return;
    if (cancelled) void cancel(); else void finish();
  }

  const active = phase !== "idle";
  const time = formatVoiceDuration(Math.floor(phase === "retry" ? pending.current?.duration ?? elapsed : elapsed));
  const canPause = !!capture.current?.canPause;
  const iconButton = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[hsl(var(--chat-soft))] disabled:opacity-40";

  return <div className={`${active ? "flex min-w-0 flex-1" : hidden ? "hidden" : "flex shrink-0"} relative items-center gap-1`} data-testid="voice-recorder">
    {active && <div role="status" aria-live={recording ? "off" : "polite"} data-testid="voice-recording-status" className="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-full border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-card))] pr-1 text-[hsl(var(--chat-fg))]">
      {phase === "holding" && <>
        <span aria-hidden className="ml-2 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rose-500"/>
        <span className="w-12 shrink-0 text-[15px] font-semibold tabular-nums" data-testid="text-voice-timer">{time}</span>
        <span className="flex min-w-0 flex-1 items-center justify-center gap-0.5 truncate text-[13px] text-[hsl(var(--chat-muted))]" style={{ transform: `translateX(${Math.max(drag.x, -CANCEL_DISTANCE) * .6}px)`, opacity: 1 + drag.x / (CANCEL_DISTANCE * 1.4) }}>
          <ChevronLeft size={16}/>Slide to cancel
        </span>
      </>}
      {(phase === "locked" || phase === "finishing") && <>
        <button type="button" onClick={() => void cancel()} disabled={phase === "finishing"} aria-label="Delete recording" data-testid="cancel-voice-note" className={`${iconButton} text-rose-500`}><Trash2 size={20}/></button>
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${paused ? "bg-[hsl(var(--chat-muted))]" : "animate-pulse bg-rose-500"}`}/>
        <span className="w-11 shrink-0 text-[14px] font-semibold tabular-nums" data-testid="text-voice-timer">{time}</span>
        <Waveform levels={levels}/>
        {canPause && <button type="button" onClick={togglePause} disabled={phase === "finishing"} aria-label={paused ? "Resume recording" : "Pause recording"} data-testid="button-voice-pause" className={`${iconButton} text-[var(--chat-accent)]`}>{paused ? <Mic size={20}/> : <Pause size={20}/>}</button>}
      </>}
      {phase === "starting" && <span className="ml-2 flex items-center gap-2 text-[13px] text-[hsl(var(--chat-muted))]"><LoaderCircle size={16} className="animate-spin"/>Waiting for microphone</span>}
      {phase === "sending" && <span className="ml-2 flex items-center gap-2 text-[13px] text-[hsl(var(--chat-muted))]"><LoaderCircle size={16} className="animate-spin"/>Sending voice note · {time}</span>}
      {phase === "retry" && <>
        <button type="button" onClick={() => void cancel()} aria-label="Delete recording" data-testid="cancel-voice-note" className={`${iconButton} text-rose-500`}><Trash2 size={20}/></button>
        <span className="min-w-0 flex-1 truncate text-[13px] text-rose-500" role="alert">{error || "Voice note not sent"} · {time}</span>
      </>}
    </div>}
    {phase === "holding" && <div aria-hidden className="pointer-events-none absolute -top-[92px] right-0.5 flex h-[84px] w-10 flex-col items-center justify-start gap-1 rounded-full border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-card))] pt-2.5 text-[hsl(var(--chat-muted))] shadow-md" style={{ transform: `translateY(${Math.max(drag.y, -LOCK_DISTANCE) * .45}px)` }} data-testid="voice-lock-hint">
      <Lock size={16}/><ChevronUp size={16} className="animate-bounce"/>
    </div>}
    {phase === "retry"
      ? <button type="button" onClick={() => void sendPending()} aria-label="Retry voice note" data-testid="retry-voice-note" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--chat-accent)] text-white"><RotateCcw size={18}/></button>
      : <button type="button" disabled={disabled || phase === "sending" || phase === "finishing"}
        data-testid="record-voice-note"
        aria-label={phase === "locked" ? "Send voice note" : "Hold to record a voice note, slide up to lock"}
        aria-pressed={phase === "holding"}
        style={{ touchAction: "none", transform: phase === "holding" ? `translate(${drag.x * .35}px, ${drag.y * .35}px) scale(1.18)` : undefined }}
        onContextMenu={event => event.preventDefault()}
        onClick={() => { if (phaseRef.current === "locked") void finish(); }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={event => up(event, false)}
        onPointerCancel={event => {
          if (phaseRef.current === "holding" && pointer.current?.id === event.pointerId) {
            pointer.current = null;
            setPhase("locked");
          } else up(event, true);
        }}
        onLostPointerCapture={event => {
          if (phaseRef.current === "holding" && pointer.current?.id === event.pointerId) {
            pointer.current = null;
            setPhase("locked");
          } else up(event, true);
        }}
        onKeyDown={event => { if ((event.key === " " || event.key === "Enter") && !event.repeat && phaseRef.current === "idle") { event.preventDefault(); void begin(); } }}
        onKeyUp={event => { if ((event.key === " " || event.key === "Enter") && phaseRef.current === "holding") { event.preventDefault(); void finish(); } }}
        className={`flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full transition-transform disabled:opacity-50 ${phase === "holding" || phase === "locked" || phase === "finishing" ? "bg-[var(--chat-accent)] text-white shadow-md" : "text-[var(--chat-accent)] hover:bg-[hsl(var(--chat-soft))]"}`}>
        {phase === "finishing" || phase === "sending" ? <LoaderCircle size={20} className="animate-spin"/> : phase === "locked" ? <SendHorizontal size={19}/> : <Mic size={21}/>}
      </button>}
    {!active && error && <div role="alert" className="absolute bottom-12 right-0 z-50 flex w-[min(260px,calc(100vw_-_6rem))] items-start gap-2 rounded-xl border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-card))] px-3 py-2 text-xs text-rose-500 shadow-lg">
      <span className="flex-1">{error}</span>
      <button type="button" onClick={() => setError("")} aria-label="Dismiss" data-testid="button-dismiss-voice-error" className="-m-1 p-1"><X size={14}/></button>
    </div>}
  </div>;
}

function Waveform({ levels }: { levels: number[] }) {
  const bars = Array.from({ length: BARS }, (_, index) => levels[levels.length - BARS + index] ?? 0.04);
  return <span aria-hidden className="flex h-7 min-w-0 flex-1 items-center gap-[2px] overflow-hidden" data-testid="voice-waveform">
    {bars.map((level, index) => <span key={index} className="w-[3px] shrink-0 rounded-full bg-[var(--chat-accent)]" style={{ height: `${Math.round(4 + level * 22)}px`, opacity: level > 0.05 ? .9 : .35 }}/>)}
  </span>;
}
