import { mkdir, rename, rm, access } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline as stream } from "node:stream/promises";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";
import { REEL_MODEL, REEL_MODEL_REVISION, type SafetyScore } from "./reel-safety-policy";

type Classifier = (image: string, options: { top_k: number }) => Promise<SafetyScore[]>;
let classifier: Promise<Classifier> | undefined;
const files = ["config.json", "preprocessor_config.json", "onnx/model_quantized.onnx"];

export async function getReelClassifier(): Promise<Classifier> {
  if (!classifier) classifier = load().catch(error => { classifier = undefined; throw error; });
  return classifier;
}
async function load(): Promise<Classifier> {
  const root = join(tmpdir(), "myage-reel-model", REEL_MODEL_REVISION);
  const storage = new ObjectStorageService();
  for (const name of files) {
    const path = join(root, name);
    try { await access(path); continue; } catch { /* Restore immutable model files. */ }
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${randomUUID()}.tmp`;
    const objectPath = `/objects/ai-reel-model/${REEL_MODEL_REVISION}/${name}`;
    try {
      try {
        const stored = await storage.getObjectEntityFile(objectPath);
        await stream(stored.createReadStream(), createWriteStream(temp));
      } catch (error) {
        if (!(error instanceof ObjectNotFoundError)) throw error;
        const response = await fetch(`https://huggingface.co/${REEL_MODEL}/resolve/${REEL_MODEL_REVISION}/${name}`, { signal: AbortSignal.timeout(180_000) });
        if (!response.ok || !response.body) throw new Error(`Could not download Reel safety model (${response.status})`);
        await stream(Readable.fromWeb(response.body as never), createWriteStream(temp));
        try { await storage.storePrivateFile(objectPath, temp, "system-reel-safety", "application/octet-stream"); }
        catch (saveError) { if ((saveError as { code?: number }).code !== 412) throw saveError; }
      }
      await rename(temp, path);
    } finally { await rm(temp, { force: true }); }
  }
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowRemoteModels = false;
  const result = await pipeline("image-classification", root, {
    local_files_only: true, dtype: "q8", device: "cpu",
    session_options: { intraOpNumThreads: 1, interOpNumThreads: 1 },
  });
  return result as unknown as Classifier;
}
