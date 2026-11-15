import type { NextFunction, Request, Response } from "express";

type Identity = {
  id: string;
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string; verification: { status: string } | null }[];
  firstName?: string | null;
  lastName?: string | null;
  banned?: boolean;
  locked?: boolean;
};

export function hasVerifiedAdminEmail(user: Identity, configuredEmail: string): boolean {
  if (!configuredEmail.trim() || user.banned || user.locked) return false;
  return user.emailAddresses.some(email =>
    email.id === user.primaryEmailAddressId &&
    email.verification?.status === "verified" &&
    email.emailAddress.trim().toLowerCase() === configuredEmail.trim().toLowerCase());
}

export function createAdminGuard(deps: {
  userId: (req: Request) => string | null;
  loadUser: (id: string) => Promise<Identity>;
  email: () => string;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Vary", "Authorization, Cookie");
    const id = deps.userId(req);
    if (!id) { res.status(401).json({ error: "Sign in to continue." }); return; }
    if (!deps.email().trim()) { res.status(503).json({ error: "Admin access is not configured." }); return; }
    try {
      const user = await deps.loadUser(id);
      if (user.id !== id || !hasVerifiedAdminEmail(user, deps.email())) {
        res.status(403).json({ error: "This account does not have administrator access." }); return;
      }
      const primary = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId)!;
      res.locals.adminIdentity = {
        userId: id,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Administrator",
        email: primary.emailAddress,
        timezone: "UTC",
      };
      next();
    } catch {
      // Authentication-provider outages must never turn into an allow decision.
      res.status(503).json({ error: "Administrator access could not be verified. Try again shortly." });
    }
  };
}
