import { downloadReel, type Reel } from "@workspace/api-client-react";

export async function saveReelDownload(reel: Reel): Promise<void> {
  const blob = await downloadReel(reel.id);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const extension = reel.mediaType === "slides" ? "zip" : "mp4";
  anchor.href = url;
  anchor.download = `vibeswipes-reel-${reel.id}${reel.mediaType === "slides" ? "-photos" : ""}.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
