import { useRef, useState } from "react";
import { formatVoiceDuration } from "@workspace/api-client-react";

export function ChatAudioMessage({ url, duration }: { url: string; duration?: number | null }) {
  const player = useRef<HTMLAudioElement>(null);
  const [seconds, setSeconds] = useState(duration ?? 0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState(false);
  return <div className="max-w-full" data-testid="voice-note-message">
    <audio ref={player} controls preload="none" src={url} className="h-10 w-[240px] max-w-full"
      aria-label="Voice note" onError={() => setError(true)}
      onLoadedMetadata={event => { if (Number.isFinite(event.currentTarget.duration)) setSeconds(Math.ceil(event.currentTarget.duration)); }}/>
    <div className="mt-1 flex items-center justify-between gap-3 text-xs">
      <span>{seconds ? formatVoiceDuration(seconds) : "Voice note"}</span>
      <button type="button" aria-label={`Playback speed ${speed}x`} onClick={() => {
        const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
        if (player.current) { player.current.defaultPlaybackRate = next; player.current.playbackRate = next; }
        setSpeed(next);
      }} className="rounded-full px-2 py-1 font-semibold">{speed}x</button>
    </div>
    {error && <button type="button" className="mt-1 text-xs underline" onClick={() => { setError(false); player.current?.load(); }}>Couldn’t load audio. Tap to retry.</button>}
  </div>;
}
