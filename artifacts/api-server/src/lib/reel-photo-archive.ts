import { ZipArchive } from "archiver";

export function createReelPhotoArchive(): ZipArchive {
  return new ZipArchive({ store: true });
}
