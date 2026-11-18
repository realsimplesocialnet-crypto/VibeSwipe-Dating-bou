const MAX_REEL_SAFETY_SAMPLES = 600;
const MAX_TIMER_MS = 2_147_000_000;

export function reelSafetySamplingPlan(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RangeError("Video duration must be a positive finite number.");
  }
  const sampleCount = Math.max(1, Math.min(MAX_REEL_SAFETY_SAMPLES, Math.ceil(duration)));
  return {
    framesPerSecond: Math.min(1, sampleCount / duration),
    minimumFrameCount: Math.max(1, Math.floor(sampleCount * 0.95)),
  };
}

export function reelSafetyExtractionTimeoutMs(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RangeError("Video duration must be a positive finite number.");
  }
  return Math.min(MAX_TIMER_MS, Math.max(180_000, Math.ceil(duration * 2_000)));
}
