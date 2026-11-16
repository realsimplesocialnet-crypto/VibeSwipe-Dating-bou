import { createHmac } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { verifyToken } from "@clerk/backend";
import {
  adminDeletedUsersTable,
  blocksTable,
  db,
  matchesTable,
  profilesTable,
} from "@workspace/db";
import { and, eq, inArray, or } from "drizzle-orm";
import { Server, type Socket } from "socket.io";
import { logger } from "./logger";

const SOCKET_PATH = "/api/socket.io";
const CALL_RING_TIMEOUT_MS = 35_000;
const CALL_HEARTBEAT_TIMEOUT_MS = 20_000;
const MAX_SDP_LENGTH = 48_000;
const MAX_CANDIDATE_LENGTH = 4_000;
const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

type Ack = ((result: { ok: boolean; error?: string }) => void) | undefined;
type CallRecord = {
  matchId: string;
  callerId: string;
  callerSocketId: string;
  calleeId: string;
  calleeSocketId?: string;
  status: "ringing" | "accepted";
  lastHeartbeatAt: number;
  ringTimer?: ReturnType<typeof setTimeout>;
  heartbeatTimer?: ReturnType<typeof setInterval>;
};
type CallCandidate = {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

const userRoom = (userId: string) => `video-call-user:${userId}`;

function respond(ack: Ack, ok: boolean, error?: string): void {
  if (typeof ack === "function") ack({ ok, ...(error ? { error } : {}) });
}

function getSocketUserId(socket: Socket): string | null {
  const userId: unknown = socket.data["userId"];
  return typeof userId === "string" ? userId : null;
}

function validateMatchId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 80;
}

function createIceServers(userId: string): Array<Record<string, unknown>> {
  const servers: Array<Record<string, unknown>> = [...DEFAULT_ICE_SERVERS];
  const urls = (process.env["TURN_URLS"] ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  const sharedSecret = process.env["TURN_SHARED_SECRET"];

  // Coturn's REST secret produces short-lived credentials; never send the
  // long-lived shared secret to a client.
  if (urls.length > 0 && sharedSecret) {
    const expiry = Math.floor(Date.now() / 1000) + 60 * 60;
    const username = `${expiry}:${userId}`;
    const credential = createHmac("sha1", sharedSecret)
      .update(username)
      .digest("base64");
    servers.push({ urls, username, credential });
  }

  return servers;
}

async function getAuthorizedMatch(matchId: string, userId: string) {
  const [match] = await db
    .select({
      id: matchesTable.id,
      userAId: matchesTable.userAId,
      userBId: matchesTable.userBId,
    })
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId))
    .limit(1);

  if (!match || (match.userAId !== userId && match.userBId !== userId)) {
    return null;
  }

  const memberIds = [match.userAId, match.userBId];
  const [[block], suspendedProfiles, deletedProfiles] = await Promise.all([
    db
      .select({ id: blocksTable.id })
      .from(blocksTable)
      .where(
        or(
          and(
            eq(blocksTable.blockerId, match.userAId),
            eq(blocksTable.blockedId, match.userBId),
          ),
          and(
            eq(blocksTable.blockerId, match.userBId),
            eq(blocksTable.blockedId, match.userAId),
          ),
        ),
      )
      .limit(1),
    db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(
        and(
          inArray(profilesTable.id, memberIds),
          eq(profilesTable.adminSuspended, true),
        ),
      )
      .limit(1),
    db
      .select({ userId: adminDeletedUsersTable.userId })
      .from(adminDeletedUsersTable)
      .where(inArray(adminDeletedUsersTable.userId, memberIds))
      .limit(1),
  ]);

  if (block || suspendedProfiles.length > 0 || deletedProfiles.length > 0) {
    return null;
  }

  return match;
}

function isCallParticipant(call: CallRecord, userId: string): boolean {
  return call.callerId === userId || call.calleeId === userId;
}

export function attachVideoCallSignaling(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: SOCKET_PATH,
    cors: { origin: true, credentials: true },
    maxHttpBufferSize: 64 * 1024,
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  const callsByMatch = new Map<string, CallRecord>();
  const activeMatchByUser = new Map<string, string>();

  function finishCall(call: CallRecord, reason: string): void {
    if (callsByMatch.get(call.matchId) !== call) return;
    callsByMatch.delete(call.matchId);
    activeMatchByUser.delete(call.callerId);
    activeMatchByUser.delete(call.calleeId);
    if (call.ringTimer) clearTimeout(call.ringTimer);
    if (call.heartbeatTimer) clearInterval(call.heartbeatTimer);
    const message = { matchId: call.matchId, reason };
    io.to(userRoom(call.callerId)).emit("call:ended", message);
    io.to(userRoom(call.calleeId)).emit("call:ended", message);
  }

  async function authorizeCallEvent(
    socket: Socket,
    matchId: string,
  ): Promise<{ call: CallRecord; userId: string } | null> {
    const userId = getSocketUserId(socket);
    const call = callsByMatch.get(matchId);
    if (
      !userId ||
      !call ||
      !isCallParticipant(call, userId) ||
      (call.callerId === userId && call.callerSocketId !== socket.id) ||
      (call.calleeId === userId && call.calleeSocketId !== socket.id)
    ) {
      return null;
    }

    const match = await getAuthorizedMatch(matchId, userId);
    if (
      !match ||
      !(
        (match.userAId === call.callerId && match.userBId === call.calleeId) ||
        (match.userBId === call.callerId && match.userAId === call.calleeId)
      )
    ) {
      finishCall(call, "conversation_unavailable");
      return null;
    }

    return { call, userId };
  }

  io.use(async (socket, next) => {
    const token: unknown = socket.handshake.auth["token"];
    const secretKey = process.env["CLERK_SECRET_KEY"];
    if (typeof token !== "string" || token.length > 8_000 || !secretKey) {
      next(new Error("unauthorized"));
      return;
    }

    try {
      const claims = await verifyToken(token, { secretKey });
      const userId = claims.sub;
      if (typeof userId !== "string" || !userId) {
        next(new Error("unauthorized"));
        return;
      }

      const [[profile], [deletedAccount]] = await Promise.all([
        db
          .select({ id: profilesTable.id, adminSuspended: profilesTable.adminSuspended })
          .from(profilesTable)
          .where(eq(profilesTable.id, userId))
          .limit(1),
        db
          .select({ userId: adminDeletedUsersTable.userId })
          .from(adminDeletedUsersTable)
          .where(eq(adminDeletedUsersTable.userId, userId))
          .limit(1),
      ]);
      if (!profile || profile.adminSuspended || deletedAccount) {
        next(new Error("unauthorized"));
        return;
      }

      socket.data["userId"] = userId;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = getSocketUserId(socket);
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.join(userRoom(userId));
    socket.emit("call:config", { iceServers: createIceServers(userId) });

    socket.on("call:start", (payload: unknown, ack?: Ack) => {
      void (async () => {
        const matchId =
          payload && typeof payload === "object" && "matchId" in payload
            ? payload.matchId
            : undefined;
        if (!validateMatchId(matchId)) {
          respond(ack, false, "This conversation is not available for calls.");
          return;
        }

        const lastStarted = socket.data["lastCallStartAt"];
        const now = Date.now();
        if (typeof lastStarted === "number" && now - lastStarted < 5_000) {
          respond(ack, false, "Please wait before starting another call.");
          return;
        }

        const match = await getAuthorizedMatch(matchId, userId);
        if (!match) {
          respond(ack, false, "Video calls are only available in an active, unblocked match.");
          return;
        }
        const calleeId =
          match.userAId === userId ? match.userBId : match.userAId;
        if (
          callsByMatch.has(matchId) ||
          activeMatchByUser.has(userId) ||
          activeMatchByUser.has(calleeId)
        ) {
          respond(ack, false, "One of you is already on another call.");
          return;
        }
        if ((io.sockets.adapter.rooms.get(userRoom(calleeId))?.size ?? 0) === 0) {
          respond(ack, false, "They are not available right now.");
          return;
        }

        const call: CallRecord = {
          matchId,
          callerId: userId,
          callerSocketId: socket.id,
          calleeId,
          status: "ringing",
          lastHeartbeatAt: now,
        };
        socket.data["lastCallStartAt"] = now;
        callsByMatch.set(matchId, call);
        activeMatchByUser.set(userId, matchId);
        activeMatchByUser.set(calleeId, matchId);
        call.ringTimer = setTimeout(() => {
          if (call.status === "ringing") finishCall(call, "no_answer");
        }, CALL_RING_TIMEOUT_MS);
        call.ringTimer.unref?.();
        call.heartbeatTimer = setInterval(() => {
          if (Date.now() - call.lastHeartbeatAt > CALL_HEARTBEAT_TIMEOUT_MS) {
            finishCall(call, "connection_lost");
          }
        }, 5_000);
        call.heartbeatTimer.unref?.();

        io.to(userRoom(calleeId)).emit("call:incoming", { matchId });
        respond(ack, true);
      })().catch((error: unknown) => {
        logger.warn({ err: error }, "Video call request failed");
        respond(ack, false, "The call could not be started. Please try again.");
      });
    });

    socket.on("call:accept", (payload: unknown, ack?: Ack) => {
      void (async () => {
        const matchId =
          payload && typeof payload === "object" && "matchId" in payload
            ? payload.matchId
            : undefined;
        if (!validateMatchId(matchId)) {
          respond(ack, false, "This call is no longer available.");
          return;
        }
        const call = callsByMatch.get(matchId);
        if (!call || call.calleeId !== userId || call.status !== "ringing") {
          respond(ack, false, "This call is no longer available.");
          return;
        }
        if (!(await getAuthorizedMatch(matchId, userId))) {
          finishCall(call, "conversation_unavailable");
          respond(ack, false, "This conversation is no longer available.");
          return;
        }
        if (callsByMatch.get(matchId) !== call || call.status !== "ringing") {
          respond(ack, false, "This call is no longer available.");
          return;
        }

        if (call.ringTimer) clearTimeout(call.ringTimer);
        call.status = "accepted";
        call.calleeSocketId = socket.id;
        call.lastHeartbeatAt = Date.now();
        io.to(call.callerSocketId).emit("call:accepted", { matchId });
        io.to(userRoom(call.calleeId))
          .except(socket.id)
          .emit("call:answered_elsewhere", { matchId });
        respond(ack, true);
      })().catch((error: unknown) => {
        logger.warn({ err: error }, "Video call acceptance failed");
        respond(ack, false, "The call could not be answered. Please try again.");
      });
    });

    socket.on("call:decline", (payload: unknown, ack?: Ack) => {
      const matchId =
        payload && typeof payload === "object" && "matchId" in payload
          ? payload.matchId
          : undefined;
      const call = validateMatchId(matchId) ? callsByMatch.get(matchId) : undefined;
      if (!call || call.calleeId !== userId || call.status !== "ringing") {
        respond(ack, false, "This call is no longer available.");
        return;
      }
      finishCall(call, "declined");
      respond(ack, true);
    });

    socket.on("call:ready", (payload: unknown, ack?: Ack) => {
      void (async () => {
        const matchId =
          payload && typeof payload === "object" && "matchId" in payload
            ? payload.matchId
            : undefined;
        if (!validateMatchId(matchId)) {
          respond(ack, false, "This call is no longer available.");
          return;
        }
        const authorized = await authorizeCallEvent(socket, matchId);
        if (!authorized || authorized.call.status !== "accepted" || authorized.userId !== authorized.call.calleeId) {
          respond(ack, false, "This call is no longer available.");
          return;
        }
        authorized.call.lastHeartbeatAt = Date.now();
        io.to(authorized.call.callerSocketId).emit("call:ready", { matchId });
        respond(ack, true);
      })().catch((error: unknown) => {
        logger.warn({ err: error }, "Video call readiness check failed");
        respond(ack, false, "The call could not connect. Please try again.");
      });
    });

    socket.on("call:offer", (payload: unknown, ack?: Ack) => {
      void relayDescription(socket, payload, "offer", ack);
    });
    socket.on("call:answer", (payload: unknown, ack?: Ack) => {
      void relayDescription(socket, payload, "answer", ack);
    });

    socket.on("call:ice", (payload: unknown, ack?: Ack) => {
      void (async () => {
        if (!payload || typeof payload !== "object" || !("matchId" in payload) || !("candidate" in payload)) {
          respond(ack, false, "Invalid call signal.");
          return;
        }
        const { matchId, candidate } = payload;
        if (
          !validateMatchId(matchId) ||
          !candidate ||
          typeof candidate !== "object" ||
          !("candidate" in candidate) ||
          typeof candidate.candidate !== "string" ||
          candidate.candidate.length > MAX_CANDIDATE_LENGTH
        ) {
          respond(ack, false, "Invalid call signal.");
          return;
        }

        const authorized = await authorizeCallEvent(socket, matchId);
        if (!authorized || authorized.call.status !== "accepted") {
          respond(ack, false, "This call is no longer available.");
          return;
        }
        const candidateData = candidate as Record<string, unknown>;
        const cleanCandidate: CallCandidate = {
          candidate: candidateData["candidate"] as string,
          ...(typeof candidateData["sdpMid"] === "string" || candidateData["sdpMid"] === null
            ? { sdpMid: candidateData["sdpMid"] as string | null }
            : {}),
          ...(typeof candidateData["sdpMLineIndex"] === "number" || candidateData["sdpMLineIndex"] === null
            ? { sdpMLineIndex: candidateData["sdpMLineIndex"] as number | null }
            : {}),
          ...(typeof candidateData["usernameFragment"] === "string" || candidateData["usernameFragment"] === null
            ? { usernameFragment: candidateData["usernameFragment"] as string | null }
            : {}),
        };
        authorized.call.lastHeartbeatAt = Date.now();
        const recipientSocketId =
          authorized.userId === authorized.call.callerId
            ? authorized.call.calleeSocketId
            : authorized.call.callerSocketId;
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("call:ice", {
            matchId,
            candidate: cleanCandidate,
          });
        }
        respond(ack, true);
      })().catch((error: unknown) => {
        logger.warn({ err: error }, "Video call ICE relay failed");
        respond(ack, false, "A call connection signal could not be sent.");
      });
    });

    socket.on("call:heartbeat", (payload: unknown) => {
      void (async () => {
        const matchId =
          payload && typeof payload === "object" && "matchId" in payload
            ? payload.matchId
            : undefined;
        if (!validateMatchId(matchId)) return;
        const authorized = await authorizeCallEvent(socket, matchId);
        if (authorized) authorized.call.lastHeartbeatAt = Date.now();
      })().catch((error: unknown) => {
        logger.warn({ err: error }, "Video call heartbeat failed");
      });
    });

    socket.on("call:end", (payload: unknown, ack?: Ack) => {
      const matchId =
        payload && typeof payload === "object" && "matchId" in payload
          ? payload.matchId
          : undefined;
      const call = validateMatchId(matchId) ? callsByMatch.get(matchId) : undefined;
      if (
        !call ||
        !isCallParticipant(call, userId) ||
        (call.callerId === userId && call.callerSocketId !== socket.id) ||
        (call.calleeId === userId && call.calleeSocketId !== socket.id)
      ) {
        respond(ack, false, "This call is no longer active.");
        return;
      }
      finishCall(call, "ended");
      respond(ack, true);
    });

    socket.on("disconnect", () => {
      for (const call of callsByMatch.values()) {
        if (call.callerSocketId === socket.id || call.calleeSocketId === socket.id) {
          finishCall(call, "connection_lost");
        }
      }
    });
  });

  async function relayDescription(
    socket: Socket,
    payload: unknown,
    expectedType: "offer" | "answer",
    ack: Ack,
  ): Promise<void> {
    if (
      !payload ||
      typeof payload !== "object" ||
      !("matchId" in payload) ||
      !("description" in payload)
    ) {
      respond(ack, false, "Invalid call signal.");
      return;
    }
    const { matchId, description } = payload;
    if (
      !validateMatchId(matchId) ||
      !description ||
      typeof description !== "object" ||
      !("type" in description) ||
      description.type !== expectedType ||
      !("sdp" in description) ||
      typeof description.sdp !== "string" ||
      description.sdp.length === 0 ||
      description.sdp.length > MAX_SDP_LENGTH
    ) {
      respond(ack, false, "Invalid call signal.");
      return;
    }

    try {
      const authorized = await authorizeCallEvent(socket, matchId);
      if (!authorized || authorized.call.status !== "accepted") {
        respond(ack, false, "This call is no longer available.");
        return;
      }
      const senderIsCaller = authorized.userId === authorized.call.callerId;
      if (
        (expectedType === "offer" && !senderIsCaller) ||
        (expectedType === "answer" && senderIsCaller)
      ) {
        respond(ack, false, "This call signal is not allowed.");
        return;
      }
      authorized.call.lastHeartbeatAt = Date.now();
      const recipientSocketId = senderIsCaller
        ? authorized.call.calleeSocketId
        : authorized.call.callerSocketId;
      if (recipientSocketId) {
        io.to(recipientSocketId).emit(`call:${expectedType}`, {
          matchId,
          description: { type: expectedType, sdp: description.sdp },
        });
      }
      respond(ack, true);
    } catch (error) {
      logger.warn({ err: error }, "Video call description relay failed");
      respond(ack, false, "A call connection signal could not be sent.");
    }
  }

  logger.info({ path: SOCKET_PATH }, "Video call signaling server attached");
  return io;
}
