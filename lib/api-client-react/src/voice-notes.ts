/** A byte safety limit, not a recording time limit. */
export const MAX_VOICE_NOTE_BYTES = 500 * 1024 * 1024;

export function formatVoiceDuration(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const s = String(value % 60).padStart(2, "0");
  const m = Math.floor(value / 60);
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
