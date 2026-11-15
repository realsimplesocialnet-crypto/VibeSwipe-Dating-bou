import assert from "node:assert/strict";
import test from "node:test";
import { SendMessageBody, SendMessageResponse } from "../../../lib/api-zod/src/generated/api.ts";
import { formatVoiceDuration, MAX_VOICE_NOTE_BYTES } from "../../../lib/api-client-react/src/voice-notes.ts";
import { startVoiceCapture, wavHeader } from "../../vibeswipe-web/src/lib/voice-recording.ts";
import { parseByteRange } from "../src/lib/byte-range.ts";

test("voice notes accept complete durations beyond one minute, including hours", () => {
  for (const seconds of [61, 125, 3600, 86400]) {
    const input = SendMessageBody.parse({ mediaReference: "media:11111111-1111-4111-8111-111111111111", mediaType: "audio", mediaDuration: seconds });
    assert.equal(input.mediaDuration, seconds);
    const output = SendMessageResponse.parse({
      id: "11111111-1111-4111-8111-111111111111", matchId: "22222222-2222-4222-8222-222222222222",
      senderId: "test-voice", content: "", createdAt: new Date().toISOString(),
      mediaType: "audio", mediaDuration: seconds, deletedForEveryone: false, isRead: false,
    });
    assert.equal(output.mediaDuration, seconds);
  }
});
test("duration validation rejects invalid values rather than clipping them", () => {
  for (const mediaDuration of [0, -1, 1.2, Infinity]) assert.equal(SendMessageBody.safeParse({ mediaDuration }).success, false);
});
test("recording and playback clocks display minutes and hours without wrapping", () => {
  for (const [seconds, expected] of [[0,"0:00"],[61,"1:01"],[125,"2:05"],[3601,"1:00:01"],[86400,"24:00:00"]] as const)
    assert.equal(formatVoiceDuration(seconds), expected);
  assert.equal(formatVoiceDuration(Infinity), "0:00");
  assert.equal(MAX_VOICE_NOTE_BYTES, 500 * 1024 * 1024);
});
test("WAV fallback describes every recorded sample, including a multi-minute note", () => {
  const sampleRate = 16000;
  const samples = sampleRate * 125;
  const header = wavHeader(samples, sampleRate);
  const data = new DataView(header);
  assert.equal(header.byteLength, 44);
  assert.equal(new TextDecoder().decode(header.slice(0,4)), "RIFF");
  assert.equal(data.getUint32(24,true), sampleRate);
  assert.equal(data.getUint32(40,true), samples * 2);
  assert.equal(data.getUint32(4,true), 36 + samples * 2);
  assert.equal(data.getUint16(22,true), 1);
});
test("audio range requests seek to arbitrary offsets without returning the entire file", () => {
  assert.deepEqual(parseByteRange("bytes=65536-131071", 200000), { start:65536,end:131071 });
  assert.deepEqual(parseByteRange("bytes=131072-", 200000), { start:131072,end:199999 });
  assert.deepEqual(parseByteRange("bytes=-4096", 200000), { start:195904,end:199999 });
  assert.equal(parseByteRange("bytes=200000-",200000), "invalid");
  assert.equal(parseByteRange("bytes=0-3,5-8",200000), "invalid");
});

test("browser capture retains all chunks after two minutes and releases the microphone", async t => {
  let now = 0;
  let released = 0;
  let state = "";
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis,"navigator");
  const recorderDescriptor = Object.getOwnPropertyDescriptor(globalThis,"MediaRecorder");
  Object.defineProperty(globalThis,"navigator",{ configurable:true, value:{ mediaDevices:{
    getUserMedia:async () => ({getTracks:() => [{stop:() => {released++;}}]}),
  }}});
  class Recorder {
    static isTypeSupported() { return true; }
    state = "inactive";
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    start(timeslice: number) {
      assert.equal(timeslice,1000);
      this.state = state = "recording";
      this.ondataavailable?.({data:new Blob(["first-"])});
      this.ondataavailable?.({data:new Blob(["middle-"])});
    }
    stop() {
      this.state = state = "inactive";
      this.ondataavailable?.({data:new Blob(["last"])});
      this.onstop?.();
    }
  }
  Object.defineProperty(globalThis,"MediaRecorder",{ configurable:true,value:Recorder });
  t.mock.method(performance,"now",() => now);
  t.after(() => {
    if(navigatorDescriptor)Object.defineProperty(globalThis,"navigator",navigatorDescriptor);
    else Reflect.deleteProperty(globalThis,"navigator");
    if(recorderDescriptor)Object.defineProperty(globalThis,"MediaRecorder",recorderDescriptor);
    else Reflect.deleteProperty(globalThis,"MediaRecorder");
  });
  const capture = await startVoiceCapture();
  now = 125000;
  assert.equal(state,"recording");
  assert.equal(capture.seconds(),125);
  const full = await capture.finish();
  assert.equal(full.duration,125);
  assert.equal(await full.file.text(),"first-middle-last");
  assert.equal(state,"inactive");
  assert.ok(released>0);
  const cancelled = await startVoiceCapture();
  assert.equal(await cancelled.cancel(),undefined);
  assert.equal(state,"inactive");
  assert.ok(released>1);
});
