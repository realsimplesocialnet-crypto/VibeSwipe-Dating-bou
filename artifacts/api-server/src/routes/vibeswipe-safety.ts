import { getAuth } from "@clerk/express";
import {
  AddEmergencyContactBody,
  AddEmergencyContactResponse,
  CreateLocationShareBody,
  CreateLocationShareResponse,
  DeleteEmergencyContactParams,
  GetMyLocationShareResponse,
  GetPublicLocationShareQueryParams,
  GetPublicLocationShareResponse,
  ListEmergencyContactsResponse,
  StopLocationShareParams,
  UpdateLocationShareBody,
  UpdateLocationShareParams,
  UpdateLocationShareResponse,
} from "@workspace/api-zod";
import {
  db,
  emergencyContactsTable,
  liveLocationSharesTable,
  profilesTable,
} from "@workspace/db";
import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const LOCATION_SHARE_DURATION_MS = 60 * 60 * 1000;

function currentUserId(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) throw new Error("Authenticated user is missing from the request");
  return userId;
}

function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

router.get("/vibeswipe/public/location-share", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");
  const query = GetPublicLocationShareQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const [share] = await db
    .select({
      latitude: liveLocationSharesTable.latitude,
      longitude: liveLocationSharesTable.longitude,
      updatedAt: liveLocationSharesTable.updatedAt,
      expiresAt: liveLocationSharesTable.expiresAt,
    })
    .from(liveLocationSharesTable)
    .where(
      and(
        eq(liveLocationSharesTable.tokenHash, tokenDigest(query.data.token)),
        isNull(liveLocationSharesTable.stoppedAt),
        gt(liveLocationSharesTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!share) {
    res.status(404).json({ error: "This location link is no longer available." });
    return;
  }

  res.json(
    GetPublicLocationShareResponse.parse({
      ...share,
      updatedAt: share.updatedAt.toISOString(),
      expiresAt: share.expiresAt.toISOString(),
    }),
  );
});

router.use(requireAuth);

router.get("/vibeswipe/safety/emergency-contacts", async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const contacts = await db
    .select()
    .from(emergencyContactsTable)
    .where(eq(emergencyContactsTable.userId, userId))
    .orderBy(asc(emergencyContactsTable.slot));

  res.json(
    ListEmergencyContactsResponse.parse(
      contacts.map((contact) => ({
        ...contact,
        createdAt: contact.createdAt.toISOString(),
      })),
    ),
  );
});

router.post("/vibeswipe/safety/emergency-contacts", async (req, res): Promise<void> => {
  const body = AddEmergencyContactBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const name = body.data.name.trim();
  const phone = body.data.phone.trim();
  if (!name || name.length > 80 || phone.length < 7 || phone.length > 32) {
    res.status(400).json({ error: "Enter a contact name and valid phone number." });
    return;
  }

  const userId = currentUserId(req);
  const contact = await db.transaction(async (tx) => {
    const [profile] = await tx
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1)
      .for("update");
    if (!profile) return null;

    const occupiedSlots = await tx
      .select({ slot: emergencyContactsTable.slot })
      .from(emergencyContactsTable)
      .where(eq(emergencyContactsTable.userId, userId));
    const occupied = new Set(occupiedSlots.map((item) => item.slot));
    const slot = [1, 2, 3].find((candidate) => !occupied.has(candidate));
    if (!slot) return null;

    const [created] = await tx
      .insert(emergencyContactsTable)
      .values({ userId, slot, name, phone })
      .returning();
    return created ?? null;
  });

  if (!contact) {
    const [profile] = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);
    if (!profile) {
      res.status(409).json({ error: "Complete your profile before adding contacts." });
      return;
    }
    res.status(409).json({ error: "You can save up to three emergency contacts." });
    return;
  }

  res.status(201).json(
    AddEmergencyContactResponse.parse({
      ...contact,
      createdAt: contact.createdAt.toISOString(),
    }),
  );
});

router.delete(
  "/vibeswipe/safety/emergency-contacts/:contactId",
  async (req, res): Promise<void> => {
    const params = DeleteEmergencyContactParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [deleted] = await db
      .delete(emergencyContactsTable)
      .where(
        and(
          eq(emergencyContactsTable.id, params.data.contactId),
          eq(emergencyContactsTable.userId, currentUserId(req)),
        ),
      )
      .returning({ id: emergencyContactsTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Emergency contact not found." });
      return;
    }
    res.status(204).end();
  },
);

router.get("/vibeswipe/safety/location-share", async (req, res): Promise<void> => {
  const [share] = await db
    .select({
      shareId: liveLocationSharesTable.id,
      expiresAt: liveLocationSharesTable.expiresAt,
      updatedAt: liveLocationSharesTable.updatedAt,
    })
    .from(liveLocationSharesTable)
    .where(
      and(
        eq(liveLocationSharesTable.ownerId, currentUserId(req)),
        isNull(liveLocationSharesTable.stoppedAt),
        gt(liveLocationSharesTable.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(liveLocationSharesTable.createdAt))
    .limit(1);

  res.json(
    GetMyLocationShareResponse.parse(
      share
        ? {
            shareId: share.shareId,
            expiresAt: share.expiresAt.toISOString(),
            updatedAt: share.updatedAt.toISOString(),
          }
        : { shareId: null, expiresAt: null, updatedAt: null },
    ),
  );
});

router.post("/vibeswipe/safety/location-share", async (req, res): Promise<void> => {
  const body = CreateLocationShareBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const userId = currentUserId(req);
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCATION_SHARE_DURATION_MS);
  const share = await db.transaction(async (tx) => {
    const [profile] = await tx
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1)
      .for("update");
    if (!profile) return null;

    await tx
      .update(liveLocationSharesTable)
      .set({ stoppedAt: now })
      .where(
        and(
          eq(liveLocationSharesTable.ownerId, userId),
          isNull(liveLocationSharesTable.stoppedAt),
          gt(liveLocationSharesTable.expiresAt, now),
        ),
      );

    const [created] = await tx
      .insert(liveLocationSharesTable)
      .values({
        ownerId: userId,
        tokenHash: tokenDigest(token),
        latitude: body.data.latitude,
        longitude: body.data.longitude,
        updatedAt: now,
        expiresAt,
      })
      .returning({ id: liveLocationSharesTable.id });
    return created ?? null;
  });

  if (!share) {
    res.status(409).json({ error: "Complete your profile before sharing location." });
    return;
  }

  res.status(201).json(
    CreateLocationShareResponse.parse({
      shareId: share.id,
      token,
      expiresAt: expiresAt.toISOString(),
    }),
  );
});

router.patch(
  "/vibeswipe/safety/location-share/:shareId",
  async (req, res): Promise<void> => {
    const params = UpdateLocationShareParams.safeParse(req.params);
    const body = UpdateLocationShareBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const updatedAt = new Date();
    const [share] = await db
      .update(liveLocationSharesTable)
      .set({
        latitude: body.data.latitude,
        longitude: body.data.longitude,
        updatedAt,
      })
      .where(
        and(
          eq(liveLocationSharesTable.id, params.data.shareId),
          eq(liveLocationSharesTable.ownerId, currentUserId(req)),
          isNull(liveLocationSharesTable.stoppedAt),
          gt(liveLocationSharesTable.expiresAt, updatedAt),
        ),
      )
      .returning({ updatedAt: liveLocationSharesTable.updatedAt });

    if (!share) {
      res.status(404).json({ error: "Active location share not found." });
      return;
    }
    res.json(
      UpdateLocationShareResponse.parse({
        updatedAt: share.updatedAt.toISOString(),
      }),
    );
  },
);

router.delete(
  "/vibeswipe/safety/location-share/:shareId",
  async (req, res): Promise<void> => {
    const params = StopLocationShareParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [share] = await db
      .update(liveLocationSharesTable)
      .set({ stoppedAt: new Date() })
      .where(
        and(
          eq(liveLocationSharesTable.id, params.data.shareId),
          eq(liveLocationSharesTable.ownerId, currentUserId(req)),
          isNull(liveLocationSharesTable.stoppedAt),
        ),
      )
      .returning({ id: liveLocationSharesTable.id });

    if (!share) {
      res.status(404).json({ error: "Location share not found." });
      return;
    }
    res.status(204).end();
  },
);

export default router;
