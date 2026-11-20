import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ObjectStorageService, objectStorageClient } from "../src/lib/objectStorage";

const root = process.argv[2] || process.cwd();
const localApkPath = resolve(root, "attached_assets/myagebeauty_1795172841685.apk");
const publicSearchRoot = new ObjectStorageService().getPublicObjectSearchPaths()[0];
if (!publicSearchRoot) throw new Error("Public App Storage is not configured");

const [bucketName, ...prefixParts] = publicSearchRoot.replace(/^\/+/, "").split("/");
if (!bucketName) throw new Error("Public App Storage path is invalid");
const prefix = prefixParts.filter(Boolean).join("/");
const objectName = [prefix, "installer/current/Myage.apk"].filter(Boolean).join("/");
const apk = await readFile(localApkPath);

await objectStorageClient.bucket(bucketName).file(objectName).save(apk, {
  resumable: false,
  metadata: {
    contentType: "application/vnd.android.package-archive",
    cacheControl: "public, max-age=300",
  },
});

console.log(`Uploaded Myage APK (${apk.length} bytes).`);
