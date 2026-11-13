import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  canSubscribeToChat,
  ChatMessageStreams,
  messagesAfterCursor,
} from "../src/lib/chatEventStream.ts";

type TestMessage = { id: string; content: string };

class FakeResponse extends EventEmitter {
  destroyed = false;
  writableEnded = false;
  chunks: string[] = [];

  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }

  end(): void {
    this.writableEnded = true;
  }
}

const match = { userAId: "user-a", userBId: "user-b" };

test("only an unblocked match participant can subscribe", () => {
  assert.equal(canSubscribeToChat(match, "user-a", false), true);
  assert.equal(canSubscribeToChat(match, "user-b", false), true);
  assert.equal(canSubscribeToChat(match, "stranger", false), false);
  assert.equal(canSubscribeToChat(match, "user-a", true), false);
  assert.equal(canSubscribeToChat(null, "user-a", false), false);
});

test("participants receive newly published messages through the event stream", () => {
  const streams = new ChatMessageStreams<TestMessage>();
  const response = new FakeResponse();
  streams.subscribe("match-1", response);

  streams.replay("match-1", response, []);
  const message = { id: "message-1", content: "Hello" };
  streams.publish("match-1", message);

  assert.deepEqual(response.chunks, [
    `id: ${message.id}\nevent: message\ndata: ${JSON.stringify(message)}\n\n`,
  ]);
});

test("reconnect replay excludes the cursor and deduplicates messages arriving during replay", () => {
  const streams = new ChatMessageStreams<TestMessage>();
  const response = new FakeResponse();
  streams.subscribe("match-1", response);

  const cursor = { id: "message-1", content: "Already received" };
  const missed = { id: "message-2", content: "Missed while disconnected" };
  const arrivingDuringReplay = {
    id: "message-2",
    content: "Missed while disconnected",
  };
  const arrivingAfterReplay = { id: "message-3", content: "New message" };

  const messagesFromDatabase = [
    cursor,
    { id: "message-2", content: "Missed while disconnected" },
  ];
  const replayMessages = messagesAfterCursor(messagesFromDatabase, cursor.id);

  streams.publish("match-1", arrivingDuringReplay);
  streams.replay("match-1", response, replayMessages);
  streams.publish("match-1", arrivingAfterReplay);

  assert.deepEqual(
    response.chunks.map((chunk) => chunk.match(/^id: ([^\n]+)/)?.[1]),
    [missed.id, arrivingAfterReplay.id],
  );
  assert.equal(response.chunks.some((chunk) => chunk.includes(cursor.id)), false);
});

test("an unknown cursor does not replay an unrelated message history", () => {
  assert.deepEqual(
    messagesAfterCursor([{ id: "message-2" }], "missing-cursor"),
    [],
  );
});
