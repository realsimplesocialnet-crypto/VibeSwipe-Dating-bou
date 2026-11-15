export type VoiceRecording = { file: File; duration: number };
export type VoiceCapture = {
  seconds: () => number;
  /** Microphone loudness 0..1 for the live waveform (0 when unavailable). */
  level: () => number;
  /** True when the engine can genuinely pause without ending the file. */
  canPause: boolean;
  pause: () => void;
  resume: () => void;
  paused: () => boolean;
  finish: () => Promise<VoiceRecording>;
  cancel: () => Promise<void>;
};

// PCM fallback for browsers that cannot record AAC. WAV plays on both iOS and
// Android; do not mislabel a WebM/Opus recording as M4A.
const pcmProcessor = `
class VoicePCM extends AudioWorkletProcessor {
  constructor() {
    super(); this.samples = new Int16Array(4096); this.used = 0;
    this.port.onmessage = () => { this.flush(); this.port.postMessage("done"); };
  }
  flush() {
    if (!this.used) return;
    const chunk = this.samples.slice(0, this.used);
    this.port.postMessage(chunk.buffer, [chunk.buffer]); this.used = 0;
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) for (const sample of channel) {
      const value = Math.max(-1, Math.min(1, sample));
      this.samples[this.used++] = value < 0 ? value * 32768 : value * 32767;
      if (this.used === this.samples.length) this.flush();
    }
    return true;
  }
}
registerProcessor("voice-pcm", VoicePCM);
`;

export function wavHeader(samples: number, sampleRate: number): ArrayBuffer {
  const bytes = new ArrayBuffer(44);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) => [...value].forEach((letter, i) => view.setUint8(offset + i, letter.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVE"); text(12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, samples * 2, true);
  return bytes;
}

function meter(context: AudioContext, node: AudioNode): () => number {
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  node.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  return () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) { const centered = (value - 128) / 128; sum += centered * centered; }
    return Math.min(1, Math.sqrt(sum / data.length) * 3.2);
  };
}

export async function startVoiceCapture(): Promise<VoiceCapture> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Voice recording needs a browser with microphone support and a secure connection.");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const release = () => stream.getTracks().forEach(track => track.stop());
  let context: AudioContext | undefined;
  try {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/mp4")) {
      const recorder = new MediaRecorder(stream, { mimeType: "audio/mp4", audioBitsPerSecond: 48_000 });
      let meterContext: AudioContext | undefined;
      let level = () => 0;
      try { meterContext = new AudioContext(); level = meter(meterContext, meterContext.createMediaStreamSource(stream)); } catch { level = () => 0; }
      const closeMeter = () => { if (meterContext && meterContext.state !== "closed") void meterContext.close().catch(() => undefined); };
      let chunks: BlobPart[] = [];
      let failure: Error | undefined;
      let stoppedAt = 0;
      const stopped = new Promise<Blob>(resolve => {
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => { failure = new Error("Your device interrupted recording. Please record the voice note again."); };
        recorder.onstop = () => {
          stoppedAt = performance.now(); release(); closeMeter();
          resolve(new Blob(chunks, { type: "audio/mp4" })); chunks = [];
        };
      });
      recorder.start(1000);
      const startedAt = performance.now();
      let pausedTotal = 0;
      let pausedAt = 0;
      const seconds = () => ((stoppedAt || pausedAt || performance.now()) - startedAt - pausedTotal) / 1000;
      const stop = async () => {
        if (pausedAt) { pausedTotal += performance.now() - pausedAt; pausedAt = 0; }
        if (recorder.state !== "inactive") recorder.stop();
        return stopped;
      };
      const canPause = typeof recorder.pause === "function" && typeof recorder.resume === "function";
      return {
        seconds,
        level: () => (pausedAt ? 0 : level()),
        canPause,
        pause: () => { if (canPause && recorder.state === "recording") { recorder.pause(); pausedAt = performance.now(); } },
        resume: () => { if (canPause && recorder.state === "paused") { recorder.resume(); pausedTotal += performance.now() - pausedAt; pausedAt = 0; } },
        paused: () => recorder.state === "paused",
        finish: async () => {
          const blob = await stop();
          if (failure) throw failure;
          if (!blob.size) throw new Error("No audio was recorded. Hold the microphone and try again.");
          return { file: new File([blob], `voice-${Date.now()}.m4a`, { type: "audio/mp4" }), duration: Math.max(1, Math.ceil(seconds())) };
        },
        cancel: async () => { await stop(); release(); },
      };
    }
    context = new AudioContext({ sampleRate: 16000 });
    await context.resume();
    const moduleUrl = URL.createObjectURL(new Blob([pcmProcessor], { type: "application/javascript" }));
    try { await context.audioWorklet.addModule(moduleUrl); }
    finally { URL.revokeObjectURL(moduleUrl); }
    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, "voice-pcm");
    const silent = context.createGain();
    silent.gain.value = 0;
    source.connect(node); node.connect(silent); silent.connect(context.destination);
    const pcmLevel = meter(context, source);
    let pcmPaused = false;
    const audioContext = context;
    const chunks: ArrayBuffer[] = [];
    let samples = 0;
    let flushDone: (() => void) | undefined;
    node.port.onmessage = event => {
      if (event.data === "done") { flushDone?.(); return; }
      const chunk = event.data as ArrayBuffer;
      chunks.push(chunk); samples += chunk.byteLength / 2;
    };
    let closed = false;
    const stop = async () => {
      if (closed) return;
      closed = true;
      try {
        // Stop accepting samples before flushing the last partial block.
        source.disconnect();
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Recording could not finish. Please try again.")), 5000);
          flushDone = () => { clearTimeout(timeout); resolve(); };
          node.port.postMessage("flush");
        });
      } finally {
        node.disconnect(); silent.disconnect(); release();
        await audioContext.close();
      }
    };
    return {
      seconds: () => samples / audioContext.sampleRate,
      level: () => (pcmPaused ? 0 : pcmLevel()),
      canPause: true,
      // Disconnecting the source stops samples reaching the encoder; nothing is lost or padded.
      pause: () => { if (!pcmPaused && !closed) { pcmPaused = true; source.disconnect(node); } },
      resume: () => { if (pcmPaused && !closed) { pcmPaused = false; source.connect(node); } },
      paused: () => pcmPaused,
      finish: async () => {
        await stop();
        if (!samples) throw new Error("No audio was recorded. Hold the microphone and try again.");
        const file = new File([wavHeader(samples, audioContext.sampleRate), ...chunks], `voice-${Date.now()}.wav`, { type: "audio/wav" });
        chunks.length = 0;
        return { file, duration: Math.max(1, Math.ceil(samples / audioContext.sampleRate)) };
      },
      cancel: async () => { await stop(); chunks.length = 0; },
    };
  } catch (error) {
    release(); if (context && context.state !== "closed") await context.close();
    throw error;
  }
}
