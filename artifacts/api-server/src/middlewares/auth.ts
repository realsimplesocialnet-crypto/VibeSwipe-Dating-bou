import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { adminDeletedUsersTable, db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // Several existing routers share this middleware. Check once per request,
  // not once per router, and never cache suspension across API instances.
  if (res.locals.checkedAccountId !== userId) {
    const [profile] = await db.select({ suspended: profilesTable.adminSuspended })
      .from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
    const [deletedAccount] = await db.select({ userId: adminDeletedUsersTable.userId })
      .from(adminDeletedUsersTable).where(eq(adminDeletedUsersTable.userId, userId)).limit(1);
    if (deletedAccount) {
      res.status(403).json({ error: "This account has been deleted." });
      return;
    }
    if (profile?.suspended) {
      res.status(403).json({ error: "This account has been suspended by an administrator." });
      return;
    }
    res.locals.checkedAccountId = userId;
  }
  next();
}

export function getCurrentUserId(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) {
    throw new Error("Authenticated user is missing from the request");
  }
  return userId;
}
