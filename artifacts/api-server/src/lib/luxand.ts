// Based on Luxand's JavaScript FormData examples, executed ONLY on the server.
// Official example responses: dashboard.luxand.cloud/docs/widgets/javascript/
// liveness-result.html and similarity-result.html.
export class FaceVerificationError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

type JsonObject = Record<string, unknown>;
export const PHOTO_FACE_MISMATCH = "This photo doesn’t match your verified face. Please upload a photo of yourself.";

/** Similarity only: additional gallery pictures do not require a new live selfie. */
export async function matchAdditionalProfilePhoto(
  main: Uint8Array, candidate: Uint8Array, mainType: string, candidateType: string,
  request: typeof fetch = fetch,
): Promise<void> {
  const token = process.env.LUXAND_API_TOKEN?.trim();
  if (!token) throw new FaceVerificationError(503, "Photo checking is temporarily unavailable. Please try again later.");
  const body = new FormData();
  body.append("face1", new Blob([new Uint8Array(main)], { type: mainType }), "verified-main");
  body.append("face2", new Blob([new Uint8Array(candidate)], { type: candidateType }), "additional-photo");
  try {
    const response = await request("https://api.luxand.cloud/photo/similarity", {
      method: "POST", headers: { token }, body, redirect: "error", signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 400 || response.status === 422) throw new FaceVerificationError(422, PHOTO_FACE_MISMATCH);
    if (!response.ok) throw new FaceVerificationError(503, "Photo checking is temporarily unavailable. Please try again later.");
    if (!faceMatchPassed(await response.json())) throw new FaceVerificationError(422, PHOTO_FACE_MISMATCH);
  } catch (error) {
    if (error instanceof FaceVerificationError) throw error;
    throw new FaceVerificationError(503, "Photo checking could not be completed. Please try again.");
  }
}
function object(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function score(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
export function livenessPassed(value: unknown): boolean {
  if (!object(value) || value.result !== "real" || !score(value.score) || value.score < 0.9 || !object(value.rectangle)) return false;
  const { left, top, right, bottom } = value.rectangle;
  return [left, top, right, bottom].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0)
    && (right as number) > (left as number) && (bottom as number) > (top as number);
}
export function faceMatchPassed(value: unknown): boolean {
  return object(value) && value.similar === true && score(value.score) && value.score >= 0.9;
}
export function isCameraJpeg(bytes: Buffer): boolean {
  return bytes.length >= 100 && bytes.length <= 5 * 1024 * 1024
    && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function verifyLiveProfilePhoto(
  selfie: Uint8Array, profilePhoto: Uint8Array, profileContentType: string,
  request: typeof fetch = fetch,
): Promise<void> {
  const token = process.env.LUXAND_API_TOKEN?.trim();
  if (!token) throw new FaceVerificationError(503, "Face verification is not available yet. Please try again later.");
  async function post(path: string, body: FormData): Promise<unknown> {
    try {
      const response = await request(`https://api.luxand.cloud/photo/${path}`, {
        method: "POST", headers: { token: token! }, body,
        redirect: "error", signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        if (response.status === 400 || response.status === 422) {
          throw new FaceVerificationError(422, "We could not check your face. Use a clear photo with only you in it, face the camera, and try again.");
        }
        throw new FaceVerificationError(503, "The verification service is temporarily unavailable. Please try again later.");
      }
      return await response.json();
    } catch (error) {
      if (error instanceof FaceVerificationError) throw error;
      throw new FaceVerificationError(503, "The verification service could not be reached. Please try again.");
    }
  }
  const selfieBlob = new Blob([new Uint8Array(selfie)], { type: "image/jpeg" });
  const live = new FormData();
  live.append("photo", selfieBlob, "selfie.jpg");
  if (!livenessPassed(await post("liveness", live))) {
    throw new FaceVerificationError(422, "Liveness did not pass. Use your camera, not a photo or another screen. Find good light and try again.");
  }
  const comparison = new FormData();
  comparison.append("face1", new Blob([new Uint8Array(profilePhoto)], { type: profileContentType }), "profile-photo");
  comparison.append("face2", selfieBlob, "selfie.jpg");
  // The published JavaScript example incorrectly says /landmarks here.
  // The official Python example confirms the correct /similarity endpoint.
  if (!faceMatchPassed(await post("similarity", comparison))) {
    throw new FaceVerificationError(422, "Your selfie did not match your main profile photo closely enough. Use a clear photo of yourself, then try again.");
  }
}
