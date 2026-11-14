import { getAuth } from "@clerk/express";
import {
  DeleteNativePushTokenBody,
  DeleteWebPushSubscriptionBody,
  GetWebPushConfigResponse,
  SaveNativePushTokenBody,
  SaveWebPushSubscriptionBody,
} from "@workspace/api-zod";
import { db, vibeSwipePushSubscriptionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { requireAuth } from "../middlewares/auth";
import { getWebPushApplicationServerKey } from "../lib/vibeswipePush";
import {
  isAllowedWebPushEndpoint,
  isValidExpoPushToken,
} from "../lib/vibeswipePushPayload";

const router: IRouter = Router();
router.use(requireAuth);

function currentUserId(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) throw new Error("Authenticated user is missing from the request");
  return userId;
}

router.get("/vibeswipe/push/web/config", async (_req, res): Promise<void> => {
  const applicationServerKey = await getWebPushApplicationServerKey();
  res.json(GetWebPushConfigResponse.parse({ applicationServerKey }));
});

router.put(
  "/vibeswipe/push/web/subscription",
  async (req, res): Promise<void> => {
    const body = SaveWebPushSubscriptionBody.safeParse(req.body);
    if (!body.success || !isAllowedWebPushEndpoint(body.data?.endpoint ?? "")) {
      res.status(400).json({ error: "This browser push subscription is invalid." });
      return;
    }
    await db
      .insert(vibeSwipePushSubscriptionsTable)
      .values({
        userId: currentUserId(req),
        platform: "web",
        endpoint: body.data.endpoint,
        p256dh: body.data.keys.p256dh,
        auth: body.data.keys.auth,
        expoToken: null,
      })
      .onConflictDoUpdate({
        target: vibeSwipePushSubscriptionsTable.endpoint,
        set: {
          userId: currentUserId(req),
          platform: "web",
          p256dh: body.data.keys.p256dh,
          auth: body.data.keys.auth,
          expoToken: null,
          updatedAt: new Date(),
        },
      });
    res.status(204).end();
  },
);

router.delete(
  "/vibeswipe/push/web/subscription",
  async (req, res): Promise<void> => {
    const body = DeleteWebPushSubscriptionBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "This browser push subscription is invalid." });
      return;
    }
    await db
      .delete(vibeSwipePushSubscriptionsTable)
      .where(
        and(
          eq(vibeSwipePushSubscriptionsTable.userId, currentUserId(req)),
          eq(vibeSwipePushSubscriptionsTable.endpoint, body.data.endpoint),
        ),
      );
    res.status(204).end();
  },
);

router.put(
  "/vibeswipe/push/native-token",
  async (req, res): Promise<void> => {
    const body = SaveNativePushTokenBody.safeParse(req.body);
    if (!body.success || !isValidExpoPushToken(body.data?.token ?? "")) {
      res.status(400).json({ error: "This app push token is invalid." });
      return;
    }
    await db
      .insert(vibeSwipePushSubscriptionsTable)
      .values({
        userId: currentUserId(req),
        platform: "expo",
        endpoint: null,
        p256dh: null,
        auth: null,
        expoToken: body.data.token,
      })
      .onConflictDoUpdate({
        target: vibeSwipePushSubscriptionsTable.expoToken,
        set: {
          userId: currentUserId(req),
          platform: "expo",
          endpoint: null,
          p256dh: null,
          auth: null,
          updatedAt: new Date(),
        },
      });
    res.status(204).end();
  },
);

router.delete(
  "/vibeswipe/push/native-token",
  async (req, res): Promise<void> => {
    const body = DeleteNativePushTokenBody.safeParse(req.body);
    if (!body.success || !isValidExpoPushToken(body.data?.token ?? "")) {
      res.status(400).json({ error: "This app push token is invalid." });
      return;
    }
    await db
      .delete(vibeSwipePushSubscriptionsTable)
      .where(
        and(
          eq(vibeSwipePushSubscriptionsTable.userId, currentUserId(req)),
          eq(vibeSwipePushSubscriptionsTable.expoToken, body.data.token),
        ),
      );
    res.status(204).end();
  },
);

export default router;
