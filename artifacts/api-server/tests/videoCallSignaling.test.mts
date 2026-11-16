import assert from "node:assert/strict";
import { createServer } from "node:http";
import { afterEach, beforeEach, test } from "node:test";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import type { Server as HttpServer } from "node:http";
import type { Server as SignalingServer } from "socket.io";
import {
  attachVideoCallSignaling,
  type VideoCallSignalingDependencies,
} from "../src/lib/videoCallSignaling.ts";

const matchId = "active-match";
const match = { id: matchId, userAId: "alice", userBId: "bob" };
const acknowledgementTimeoutMs = 3_000;

let httpServer: HttpServer;
let signalingServer: SignalingServer;
let serverUrl = "";
let clients: ClientSocket[] = [];

const dependencies: VideoCallSignalingDependencies = {
  authenticateUser: async (token) =>
    token === "alice-token"
      ? "alice"
      : token === "bob-token"
        ? "bob"
        : token === "mallory-token"
          ? "mallory"
          : null,
  authorizeMatch: async (requestedMatchId, userId) =>
    requestedMatchId === matchId && (userId === "alice" || userId === "bob")
      ? match
      : null,
};

beforeEach(async () => {
  httpServer = createServer();
  signalingServer = attachVideoCallSignaling(httpServer, dependencies);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  assert.ok(address && typeof address === "object");
  serverUrl = `http://127.0.0.1:${address.port}`;
  clients = [];
});

afterEach(async () => {
  for (const client of clients) client.disconnect();
  await new Promise<void>((resolve) => signalingServer.close(() => resolve()));
});

function connectUser(token: string): Promise<ClientSocket> {
  const socket = createClient(serverUrl, {
    path: "/api/socket.io",
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
    timeout: acknowledgementTimeoutMs,
  });
  clients.push(socket);
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

function receive<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timed out waiting for ${event}`));
    }, acknowledgementTimeoutMs);
    const listener = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, listener);
  });
}

function emitAck(
  socket: ClientSocket,
  event: string,
  payload: unknown,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event} acknowledgement`)),
      acknowledgementTimeoutMs,
    );
    socket.emit(event, payload, (result: { ok: boolean; error?: string }) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

test("two matched members can ring, accept, exchange call signals, and hang up", async () => {
  const alice = await connectUser("alice-token");
  const bob = await connectUser("bob-token");
  const bobSecondDevice = await connectUser("bob-token");

  const incoming = receive<{ matchId: string }>(bob, "call:incoming");
  const incomingOnSecondDevice = receive<{ matchId: string }>(bobSecondDevice, "call:incoming");
  assert.deepEqual(await emitAck(alice, "call:start", { matchId }), { ok: true });
  assert.deepEqual(await incoming, { matchId });
  assert.deepEqual(await incomingOnSecondDevice, { matchId });

  const accepted = receive<{ matchId: string }>(alice, "call:accepted");
  const answeredElsewhere = receive<{ matchId: string }>(
    bobSecondDevice,
    "call:answered_elsewhere",
  );
  assert.deepEqual(await emitAck(bob, "call:accept", { matchId }), { ok: true });
  assert.deepEqual(await accepted, { matchId });
  assert.deepEqual(await answeredElsewhere, { matchId });

  const ready = receive<{ matchId: string }>(alice, "call:ready");
  assert.deepEqual(await emitAck(bob, "call:ready", { matchId }), { ok: true });
  assert.deepEqual(await ready, { matchId });

  const offer = { type: "offer", sdp: "alice-offer" };
  const offerAtBob = receive<{ matchId: string; description: typeof offer }>(bob, "call:offer");
  assert.deepEqual(
    await emitAck(alice, "call:offer", { matchId, description: offer }),
    { ok: true },
  );
  assert.deepEqual(await offerAtBob, { matchId, description: offer });

  const answer = { type: "answer", sdp: "bob-answer" };
  const answerAtAlice = receive<{ matchId: string; description: typeof answer }>(
    alice,
    "call:answer",
  );
  assert.deepEqual(
    await emitAck(bob, "call:answer", { matchId, description: answer }),
    { ok: true },
  );
  assert.deepEqual(await answerAtAlice, { matchId, description: answer });

  const aliceCandidate = { candidate: "alice-ice", sdpMid: "0", sdpMLineIndex: 0 };
  const candidateAtBob = receive<{ matchId: string; candidate: typeof aliceCandidate }>(
    bob,
    "call:ice",
  );
  assert.deepEqual(
    await emitAck(alice, "call:ice", { matchId, candidate: aliceCandidate }),
    { ok: true },
  );
  assert.deepEqual(await candidateAtBob, { matchId, candidate: aliceCandidate });

  const bobCandidate = { candidate: "bob-ice", sdpMid: "0", sdpMLineIndex: 0 };
  const candidateAtAlice = receive<{ matchId: string; candidate: typeof bobCandidate }>(
    alice,
    "call:ice",
  );
  assert.deepEqual(
    await emitAck(bob, "call:ice", { matchId, candidate: bobCandidate }),
    { ok: true },
  );
  assert.deepEqual(await candidateAtAlice, { matchId, candidate: bobCandidate });

  const endedAtAlice = receive<{ matchId: string; reason: string }>(alice, "call:ended");
  const endedAtBob = receive<{ matchId: string; reason: string }>(bob, "call:ended");
  assert.deepEqual(await emitAck(alice, "call:end", { matchId }), { ok: true });
  assert.deepEqual(await endedAtAlice, { matchId, reason: "ended" });
  assert.deepEqual(await endedAtBob, { matchId, reason: "ended" });
});

test("rejects invalid credentials and calls outside an active match", async () => {
  const unauthenticated = createClient(serverUrl, {
    path: "/api/socket.io",
    auth: { token: "invalid-token" },
    transports: ["websocket"],
    reconnection: false,
    timeout: acknowledgementTimeoutMs,
  });
  clients.push(unauthenticated);
  await new Promise<void>((resolve, reject) => {
    unauthenticated.once("connect_error", (error) => {
      assert.equal(error.message, "unauthorized");
      resolve();
    });
    unauthenticated.once("connect", () => reject(new Error("Invalid credentials connected")));
  });

  const alice = await connectUser("alice-token");
  assert.deepEqual(
    await emitAck(alice, "call:start", { matchId: "not-a-match" }),
    { ok: false, error: "Video calls are only available in an active, unblocked match." },
  );
});

test("only the caller may send an offer and only the callee may send an answer", async () => {
  const alice = await connectUser("alice-token");
  const bob = await connectUser("bob-token");
  const incoming = receive(bob, "call:incoming");
  assert.deepEqual(await emitAck(alice, "call:start", { matchId }), { ok: true });
  await incoming;

  assert.deepEqual(await emitAck(bob, "call:accept", { matchId }), { ok: true });
  const ready = receive(alice, "call:ready");
  assert.deepEqual(await emitAck(bob, "call:ready", { matchId }), { ok: true });
  await ready;
  assert.deepEqual(
    await emitAck(bob, "call:offer", {
      matchId,
      description: { type: "offer", sdp: "not-allowed" },
    }),
    { ok: false, error: "This call signal is not allowed." },
  );
  assert.deepEqual(
    await emitAck(alice, "call:answer", {
      matchId,
      description: { type: "answer", sdp: "not-allowed" },
    }),
    { ok: false, error: "This call signal is not allowed." },
  );
  assert.deepEqual(await emitAck(alice, "call:end", { matchId }), { ok: true });
});
