import { Router, type IRouter } from "express";
import { pipeline } from "node:stream/promises";
import { ObjectStorageService } from "../lib/objectStorage";
import { parseByteRange } from "../lib/byte-range";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const APK_OBJECT_PATH = "installer/current/Myage.apk";
const APK_CONTENT_TYPE = "application/vnd.android.package-archive";

router.get(["/installer/MYAGEBEAUTY.apk", "/installer/VIBESWIPES.apk", "/installer/Myage.apk"], async (req, res): Promise<void> => {
  try {
    const file = await storage.searchPublicObject(APK_OBJECT_PATH);
    if (!file) {
      res.status(404).end();
      return;
    }

    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size <= 0) {
      throw new Error("Invalid Android download size");
    }

    res.set({
      "Content-Type": APK_CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="VibeSwipes.apk"',
      "Cache-Control": "public, max-age=300",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    });

    const range = parseByteRange(req.get("range"), size);
    if (range === "invalid") {
      res.status(416).set("Content-Range", `bytes */${size}`).end();
      return;
    }

    if (range) {
      res.status(206).set({
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(range.end - range.start + 1),
      });
    } else {
      res.set("Content-Length", String(size));
    }

    if (req.method === "HEAD") {
      res.end();
      return;
    }
    await pipeline(file.createReadStream(range ?? {}), res);
  } catch (error) {
    if (req.destroyed || res.destroyed) return;
    req.log.error({ err: error }, "Could not serve the VibeSwipes Android installer");
    if (!res.headersSent) res.status(503).json({ error: "The app download is temporarily unavailable." });
    else res.destroy();
  }
});

export default router;
