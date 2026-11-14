import type { Response } from "express";

export const CHAT_EVENT_CHANNEL = "vibeswipe_chat_events";

type ChatStreamMessage = { id: string };
type PendingStreamEvent<T extends ChatStreamMessage> =
  | { type: "message"; payload: T }
  | { type: "event"; name: string; payload: unknown };
type StreamResponse = Pick<Response, "write"> &
  Partial<Pick<Response, "destroyed" | "writableEnded" | "end">>;

type Subscriber<T extends ChatStreamMessage> = {
  response: StreamResponse;
  replaying: boolean;
  pending: PendingStreamEvent<T>[];
};

export function canSubscribeToChat(
  match: { userAId: string; userBId: string } | null,
  userId: string,
  blocked: boolean,
): boolean {
  return (
    !!match &&
    !blocked &&
    (match.userAId === userId || match.userBId === userId)
  );
}

export function messagesAfterCursor<T extends ChatStreamMessage>(
  messages: T[],
  cursorId: string,
): T[] {
  const cursorIndex = messages.findIndex((message) => message.id === cursorId);
  return cursorIndex === -1 ? [] : messages.slice(cursorIndex + 1);
}

export class ChatMessageStreams<T extends ChatStreamMessage> {
  private readonly subscribers = new Map<string, Set<Subscriber<T>>>();

  subscribe(matchId: string, response: StreamResponse): () => void {
    const subscriber: Subscriber<T> = {
      response,
      replaying: true,
      pending: [],
    };
    const matchSubscribers = this.subscribers.get(matchId) ?? new Set();
    matchSubscribers.add(subscriber);
    this.subscribers.set(matchId, matchSubscribers);

    return () => {
      matchSubscribers.delete(subscriber);
      if (matchSubscribers.size === 0) this.subscribers.delete(matchId);
    };
  }

  publish(matchId: string, message: T): void {
    for (const subscriber of this.subscribers.get(matchId) ?? []) {
      if (subscriber.replaying) {
        subscriber.pending.push({ type: "message", payload: message });
      } else {
        this.write(subscriber.response, message);
      }
    }
  }

  publishEvent(matchId: string, name: "typing" | "presence"): void {
    for (const subscriber of this.subscribers.get(matchId) ?? []) {
      if (subscriber.replaying) {
        subscriber.pending.push({ type: "event", name, payload: {} });
      } else {
        this.writeEvent(subscriber.response, name, {});
      }
    }
  }

  replay(matchId: string, response: StreamResponse, messages: T[]): void {
    const subscriber = [...(this.subscribers.get(matchId) ?? [])].find(
      (candidate) => candidate.response === response,
    );
    if (!subscriber) return;

    const replayedIds = new Set<string>();
    for (const message of messages) {
      replayedIds.add(message.id);
      this.write(response, message);
    }

    for (const pending of subscriber.pending) {
      if (pending.type === "event") {
        this.writeEvent(response, pending.name, pending.payload);
      } else if (!replayedIds.has(pending.payload.id)) {
        this.write(response, pending.payload);
      }
    }
    subscriber.pending = [];
    subscriber.replaying = false;
  }

  close(matchId: string): void {
    for (const subscriber of this.subscribers.get(matchId) ?? []) {
      if (this.isWritable(subscriber.response)) {
        subscriber.response.write("event: close\ndata: {}\n\n");
        subscriber.response.end?.();
      }
    }
  }

  closeAll(): void {
    for (const matchId of this.subscribers.keys()) this.close(matchId);
  }

  private write(response: StreamResponse, message: T): void {
    if (!this.isWritable(response)) return;
    response.write(
      `id: ${message.id}\nevent: message\ndata: ${JSON.stringify(message)}\n\n`,
    );
  }

  private writeEvent(
    response: StreamResponse,
    name: string,
    payload: unknown,
  ): void {
    if (!this.isWritable(response)) return;
    response.write(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`);
  }

  private isWritable(response: StreamResponse): boolean {
    return !response.destroyed && !response.writableEnded;
  }
}
