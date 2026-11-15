import { Router, type IRouter } from "express";
import { pipeline } from "node:stream/promises";
import { ObjectStorageService } from "../lib/objectStorage";
import { parseByteRange } from "../lib/byte-range";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const assets = new Map([
  ["loop-v1.mp4", "video/mp4"],
  ["poster-v1.webp", "image/webp"],
  ["background-v1.webp", "image/webp"],
]);

// Only these public decorative assets are anonymous. Never accept arbitrary
// storage paths, and never reuse this route for member/profile/chat uploads.
router.get("/vibeswipe/onboarding-art/:file", async (req, res): Promise<void> => {
  const name = String(req.params.file);
  const contentType = assets.get(name);
  if (!contentType) { res.status(404).end(); return; }
  try {
    const file = await storage.searchPublicObject(`onboarding/v1/${name}`);
    if (!file) { res.status(404).end(); return; }
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size <= 0) throw new Error("Invalid onboarding asset size");
    res.set({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    });
    const range = parseByteRange(req.get("range"), size);
    if (range === "invalid") {
      res.status(416).set("Content-Range", `bytes */${size}`).end(); return;
    }
    if (range) {
      res.status(206).set({
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(range.end - range.start + 1),
      });
    } else res.set("Content-Length", String(size));
    if (req.method === "HEAD") { res.end(); return; }
    await pipeline(file.createReadStream(range ?? {}), res);
  } catch (error) {
    if (req.destroyed || res.destroyed) return;
    req.log.error({ err: error }, "Could not serve onboarding artwork");
    if (!res.headersSent) res.status(503).json({ error: "Onboarding preview is temporarily unavailable." });
    else res.destroy();
  }
});

export default router;
