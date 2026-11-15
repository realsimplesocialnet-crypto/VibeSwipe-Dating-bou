import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getReelClassifier } from "./reel-safety-model";
import { ReelSafetyError, rejectExplicitFrame } from "./reel-safety-policy";

/** Sample the entire timeline, not just a poster or the first few seconds. */
export async function checkReelVideo(path: string, duration: number) {
  const classify = await getReelClassifier();
  const directory = await mkdtemp(join(tmpdir(), "myage-reel-frames-"));
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("ffmpeg", ["-v", "error", "-nostdin", "-threads", "1", "-i", path,
        "-vf", "fps=1:round=up,scale=224:224:force_original_aspect_ratio=decrease,pad=224:224:(ow-iw)/2:(oh-ih)/2",
        "-threads", "1", "-q:v", "3", join(directory, "%08d.jpg")], { stdio: ["ignore", "ignore", "pipe"] });
      let errors = "";
      child.stderr.on("data", data => { errors = `${errors}${data}`.slice(-2000); });
      const timer = setTimeout(() => child.kill("SIGKILL"), 180_000);
      child.once("error", error => { clearTimeout(timer); reject(error); });
      child.once("close", code => {
        clearTimeout(timer);
        code === 0 ? resolve() : reject(new Error(`Reel frame extraction failed: ${errors}`));
      });
    });
    const frames = (await readdir(directory)).filter(name => name.endsWith(".jpg")).sort();
    if (!frames.length || frames.length < Math.floor(duration)) throw new ReelSafetyError("The whole video could not be checked. Please try again.");
    const hashes = new Set<string>();
    let maximumScore = 0;
    const deadline = Date.now() + 600_000;
    for (const frame of frames) {
      if (Date.now() > deadline) throw new ReelSafetyError("The video safety check timed out. Please try again.");
      const file = join(directory, frame);
      const hash = createHash("sha256").update(await readFile(file)).digest("hex");
      if (hashes.has(hash)) continue;
      const score = rejectExplicitFrame(await classify(file, { top_k: 2 }));
      maximumScore = Math.max(maximumScore, score);
      hashes.add(hash);
      // Let HTTP requests continue between native ONNX inference calls.
      await new Promise(setImmediate);
    }
    return { sampledFrames: frames.length, uniqueFrames: hashes.size, maximumScore };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
