import assert from "node:assert/strict";
import test from "node:test";
import { AsyncSemaphore } from "../src/lib/async-semaphore.ts";

test("safety semaphore admits bounded work and releases waiting posts in order", async () => {
  const slots = new AsyncSemaphore(2);
  const releaseFirst = await slots.acquire();
  const releaseSecond = await slots.acquire();
  const order = [];
  const waitingThird = slots.acquire().then((release) => { order.push("third"); return release; });
  const waitingFourth = slots.acquire().then((release) => { order.push("fourth"); return release; });

  assert.equal(slots.busy, true);
  releaseFirst();
  const releaseThird = await waitingThird;
  assert.deepEqual(order, ["third"]);
  releaseSecond();
  const releaseFourth = await waitingFourth;
  assert.deepEqual(order, ["third", "fourth"]);
  releaseThird();
  releaseFourth();
  releaseFourth();
  assert.equal(slots.busy, false);
});

test("safety semaphore rejects an invalid capacity", () => {
  assert.throws(() => new AsyncSemaphore(0), /positive integer/);
  assert.throws(() => new AsyncSemaphore(1.5), /positive integer/);
});
