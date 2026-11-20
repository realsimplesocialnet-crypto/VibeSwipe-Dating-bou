import { useMemo } from "react";
import { useGetPublicLocationShare, getGetPublicLocationShareQueryKey } from "@workspace/api-client-react";
import { ExternalLink, MapPin, ShieldAlert } from "lucide-react";

function formattedDate(value: string | Date) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function PublicLocationSharePage() {
  const token = useMemo(
    () => new URLSearchParams(window.location.search).get("token") ?? "",
    [],
  );
  const location = useGetPublicLocationShare(
    { token },
    {
      query: {
        queryKey: getGetPublicLocationShareQueryKey({ token }),
        enabled: Boolean(token),
        refetchInterval: 15_000,
        refetchOnWindowFocus: true,
        retry: false,
      },
    },
  );

  const mapUrl =
    location.data &&
    `https://www.google.com/maps/search/?api=1&query=${location.data.latitude},${location.data.longitude}`;

  return (
    <main
      className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8 text-foreground"
      data-testid="page-public-location-share"
    >
      <section className="w-full max-w-md rounded-3xl border border-white/[.09] bg-card p-6 shadow-2xl shadow-black/30">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
          <MapPin size={22} />
        </div>
        <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[.2em] text-primary">
          VIBESWIPES safety link
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">Live location</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This private link shows only the latest shared location. It expires automatically.
        </p>

        {!token ? (
          <div className="mt-6 flex gap-3 rounded-2xl border border-rose-300/15 bg-rose-300/[.06] p-4 text-sm text-rose-100">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
            <span>This location link is invalid or has expired.</span>
          </div>
        ) : location.isLoading ? (
          <div className="mt-6 h-28 animate-pulse rounded-2xl bg-white/[.04]" aria-label="Loading location" />
        ) : location.isError || !location.data ? (
          <div className="mt-6 flex gap-3 rounded-2xl border border-rose-300/15 bg-rose-300/[.06] p-4 text-sm text-rose-100">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
            <span>This location link has stopped, expired, or is unavailable.</span>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/[.08] bg-white/[.035] p-4">
            <p className="text-xs text-muted-foreground">Last updated</p>
            <p className="mt-1 text-sm font-semibold">{formattedDate(location.data.updatedAt)}</p>
            <p className="mt-4 text-xs text-muted-foreground">Link expires</p>
            <p className="mt-1 text-sm font-semibold">{formattedDate(location.data.expiresAt)}</p>
            <a
              href={mapUrl!}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-[#24111b]"
              data-testid="link-open-map"
            >
              <ExternalLink size={16} /> Open in Maps
            </a>
          </div>
        )}
        <p className="mt-5 text-center text-[11px] leading-5 text-muted-foreground">
          The person sharing their location can stop access at any time.
        </p>
      </section>
    </main>
  );
}
