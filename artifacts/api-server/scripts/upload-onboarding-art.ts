import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ObjectStorageService, objectStorageClient } from "../src/lib/objectStorage";

const root = process.argv[2] || process.cwd();
const target = new ObjectStorageService().getPublicObjectSearchPaths()[0];
if (!target) throw new Error("Public App Storage is not configured");
const parts = target.replace(/^\/+/, "").split("/");
const bucket = objectStorageClient.bucket(parts.shift()!);
const prefix = parts.join("/");
for (const name of ["loop-v1.mp4", "poster-v1.webp", "background-v1.webp"]) {
  const bytes = await readFile(resolve(root, "attached_assets/generated_videos", name));
  await bucket.file(`${prefix}/onboarding/v1/${name}`).save(bytes, {
    resumable: false,
    metadata: {
      contentType: name.endsWith(".mp4") ? "video/mp4" : "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  console.log(`Uploaded onboarding ${name}: ${bytes.length} bytes`);
}
