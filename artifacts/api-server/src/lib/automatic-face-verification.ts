import { db, profilesTable, faceVerificationSessionsTable as sessions } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { checkAdditionalPhoto } from "./additional-photo-check";
import { canApproveVerification, promoteVerificationPhoto } from "./face-verification-policy";
import { FaceVerificationError } from "./luxand";

/** Only server-checked evidence can activate a badge. Also resumes older review requests. */
export async function activateCheckedFace(userId: string, sessionId?: string): Promise<void> {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
  if (!profile || profile.deactivated || profile.adminSuspended || profile.isDemo) {
    throw new FaceVerificationError(409, "This account cannot verify.");
  }
  if (profile.isVerified) return;
  const [request] = await db.select().from(sessions).where(and(
    eq(sessions.userId, userId),
    sessionId ? eq(sessions.id, sessionId) : eq(sessions.status, "awaiting_review"),
  )).orderBy(desc(sessions.createdAt)).limit(1);
  const eligible = (current: typeof profile) => request && canApproveVerification({
    status: request.status, checked: Boolean(request.checkedAt && request.referencePhoto),
    sealedPhoto: request.sealedPhoto, expectedMainPhoto: request.mainPhoto,
    currentMainPhoto: current.photos[0], suspended: current.adminSuspended,
    deactivated: current.deactivated, demo: current.isDemo, alreadyVerified: current.isVerified,
    createdAt: request.createdAt,
  });
  if (!eligible(profile) || !request?.sealedPhoto || !request.referencePhoto) {
    throw new FaceVerificationError(409, "Your profile changed or the check expired. Choose your photo and verify again.");
  }
  const photos: string[] = [];
  for (const photo of promoteVerificationPhoto(profile.photos, request.referencePhoto, request.sealedPhoto)) {
    photos.push(await checkAdditionalPhoto(userId, photo, request.sealedPhoto));
  }
  await db.transaction(async tx => {
    // All profile/verification writers take locks in this order.
    const [current] = await tx.select().from(profilesTable).where(eq(profilesTable.id, userId)).for("update").limit(1);
    const [active] = await tx.select().from(sessions).where(eq(sessions.id, request.id)).for("update").limit(1);
    if (current?.isVerified && active?.status === "approved") return;
    if (!current || !eligible(current) || active?.status !== "awaiting_review"
      || JSON.stringify(current.photos) !== JSON.stringify(profile.photos)) {
      throw new FaceVerificationError(409, "Your profile changed during the check. Please try again.");
    }
    await tx.update(profilesTable).set({
      photos, isVerified: true, updatedAt: new Date(),
    }).where(eq(profilesTable.id, userId));
    await tx.update(sessions).set({
      status: "approved", reviewedAt: new Date(), reviewedBy: null, rejectionReason: null,
    }).where(eq(sessions.id, request.id));
    // No longer leave concurrent, older requests waiting for an administrator.
    await tx.update(sessions).set({
      status: "cancelled", rejectionReason: "Your profile is already verified.",
    }).where(and(eq(sessions.userId, userId), eq(sessions.status, "awaiting_review")));
  });
}
