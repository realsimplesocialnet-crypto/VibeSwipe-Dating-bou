import { useEffect, useState } from "react";
import { getGetProfileMediaQueryKey, useGetProfileMedia } from "@workspace/api-client-react";

export function ReelAvatar({ reference, name, size = 44 }: { reference: string | null; name: string; size?: number }) {
  const mediaId = reference?.startsWith("media:") ? reference.slice(6) : "";
  const media = useGetProfileMedia(mediaId, { query: { enabled: Boolean(mediaId), queryKey: getGetProfileMediaQueryKey(mediaId), retry: false } });
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!media.data) return;
    const url = URL.createObjectURL(media.data);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [media.data]);
  return <span className="reel-avatar" style={{ width: size, height: size }} aria-hidden="true">
    {src ? <img src={src} alt="" /> : <span>{name.trim().charAt(0).toUpperCase() || "M"}</span>}
  </span>;
}
