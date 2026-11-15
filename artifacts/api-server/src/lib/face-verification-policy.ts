export const REVIEW_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** A newly submitted picture replaces the main slot; an existing gallery picture is promoted without losing the others. */
export function promoteVerificationPhoto(photos: string[], submitted: string, sealed: string): string[] {
  const remaining = photos.includes(submitted) ? photos.filter(photo => photo !== submitted) : photos.slice(1);
  return [sealed, ...remaining.filter(photo => photo !== sealed)].slice(0, 6);
}

export function canApproveVerification(input: {
  status: string; checked: boolean; sealedPhoto: string | null;
  expectedMainPhoto: string; currentMainPhoto: string | undefined;
  suspended: boolean; deactivated: boolean; demo: boolean; alreadyVerified: boolean;
  createdAt: Date; now?: number;
}): boolean {
  return input.status === "awaiting_review" && input.checked
    && /^media:[0-9a-f-]{36}$/i.test(input.sealedPhoto ?? "")
    && (input.currentMainPhoto ?? "") === input.expectedMainPhoto
    && !input.suspended && !input.deactivated && !input.demo && !input.alreadyVerified
    && (input.now ?? Date.now()) - input.createdAt.getTime() < REVIEW_MAX_AGE_MS;
}
