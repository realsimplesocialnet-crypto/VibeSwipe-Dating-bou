export const REEL_MODEL = "onnx-community/nsfw_image_detection-ONNX";
export const REEL_MODEL_REVISION = "1ceb3c7fe1e9f3f2507e6df577437f23a9149fd5";
export const REEL_SAFETY_VERSION = `nsfw-v1-${REEL_MODEL_REVISION}`;
export const REEL_NSFW_THRESHOLD = 0.8;
export type SafetyScore = { label: string; score: number };
export class ReelSafetyError extends Error {
  status: number;
  constructor(message: string, status: number = 503) { super(message); this.name = "ReelSafetyError"; this.status = status; }
}
export function explicitScore(scores: SafetyScore[]): number {
  const normal = scores.find(s => s.label.toLowerCase() === "normal");
  const explicit = scores.find(s => s.label.toLowerCase() === "nsfw");
  if (!normal || !explicit || [normal.score, explicit.score].some(n => !Number.isFinite(n) || n < 0 || n > 1)
    || Math.abs(normal.score + explicit.score - 1) > 0.02) {
    throw new ReelSafetyError("The video safety check could not finish. Please try again.");
  }
  return explicit.score;
}
export function rejectExplicitFrame(scores: SafetyScore[]): number {
  const score = explicitScore(scores);
  if (score >= REEL_NSFW_THRESHOLD) {
    throw new ReelSafetyError("This video cannot be posted because it contains nudity or sexually explicit content. Please choose a different video.", 422);
  }
  return score;
}
