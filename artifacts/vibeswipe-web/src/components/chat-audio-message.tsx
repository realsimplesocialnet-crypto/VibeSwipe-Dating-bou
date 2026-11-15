import { useEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle, Mic, Pause, Play, RotateCcw } from "lucide-react";
import { formatVoiceDuration } from "@workspace/api-client-react";

const SPEEDS = [1, 1.5, 2] as const;

export function ChatAudioMessage({ url, duration, avatar, mine = false }: { url: string; duration?: number | null; avatar?: ReactNode; mine?: boolean }) {
  const player = useRef<HTMLAudioElement>(null);
  const [total, setTotal] = useState(duration ?? 0);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [error, setError] = useState(false);
  useEffect(() => () => { player.current?.pause(); }, []);

  function toggle() {
    const audio = player.current;
    if (!audio) return;
    if (playing) { audio.pause(); return; }
    setError(false);
    // Only one voice note plays at a time, like a phone messenger.
    document.querySelectorAll<HTMLAudioElement>("audio[data-voice-note]").forEach(other => { if (other !== audio) other.pause(); });
    audio.playbackRate = speed;
    setWaiting(true);
    void audio.play().catch(() => { setWaiting(false); setError(true); });
  }
  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed as typeof SPEEDS[number]) + 1) % SPEEDS.length];
    if (player.current) { player.current.defaultPlaybackRate = next; player.current.playbackRate = next; }
    setSpeed(next);
  }
  const progress = total ? Math.min(100, (position / total) * 100) : 0;
  const tone = mine ? "text-white" : "text-[var(--chat-accent)]";

  return <div className="flex w-[min(272px,68vw)] items-center gap-2 py-0.5" data-testid="voice-note-message">
    <audio ref={player} data-voice-note preload="none" src={url} aria-label="Voice note"
      onPlay={() => setPlaying(true)} onPlaying={() => setWaiting(false)} onPause={() => { setPlaying(false); setWaiting(false); }}
      onWaiting={() => setWaiting(true)} onEnded={() => { setPlaying(false); setPosition(0); }}
      onError={() => { setError(true); setPlaying(false); setWaiting(false); }}
      onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
      onLoadedMetadata={event => { if (Number.isFinite(event.currentTarget.duration)) setTotal(event.currentTarget.duration); }}/>
    {avatar && <span className="relative shrink-0">
      <span className="block h-10 w-10 overflow-hidden rounded-full">{avatar}</span>
      <Mic aria-hidden size={14} strokeWidth={2.5} className={`absolute -bottom-0.5 -right-1 rounded-full p-[1px] ${mine ? "bg-[var(--chat-accent)] text-white" : "bg-[hsl(var(--chat-card))] text-[var(--chat-accent)]"}`}/>
    </span>}
    <button type="button" onClick={error ? () => { setError(false); player.current?.load(); toggle(); } : toggle}
      aria-label={error ? "Retry voice note" : playing ? "Pause voice note" : "Play voice note"} data-testid="button-voice-play"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
      {error ? <RotateCcw size={20}/> : waiting && playing ? <LoaderCircle size={22} className="animate-spin"/> : playing ? <Pause size={24} fill="currentColor" strokeWidth={0}/> : <Play size={24} fill="currentColor" strokeWidth={0}/>}
    </button>
    <div className="min-w-0 flex-1">
      <input type="range" min={0} max={total || 1} step={0.1} value={Math.min(position, total || 1)} aria-label="Seek voice note" data-testid="input-voice-seek"
        onChange={event => { const value = Number(event.currentTarget.value); setPosition(value); if (player.current) player.current.currentTime = value; }}
        className="voice-seek block h-5 w-full cursor-pointer" style={{ ["--voice-progress" as string]: `${progress}%` }}/>
      <div className="-mt-0.5 flex items-center justify-between text-[11px] leading-4 opacity-80">
        <span className="tabular-nums" data-testid="text-voice-duration">{error ? "Couldn’t load, tap retry" : formatVoiceDuration(Math.floor(playing || position ? position : total))}</span>
        <button type="button" onClick={cycleSpeed} aria-label={`Playback speed ${speed}x`} data-testid="button-voice-speed"
          className={`-my-1 min-h-6 rounded-full px-1.5 text-[11px] font-bold tabular-nums ${mine ? "bg-white/20" : "bg-[hsl(var(--chat-soft))]"}`}>{speed}x</button>
      </div>
    </div>
  </div>;
}
