import { type FormEvent, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Copy,
  ExternalLink,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  getGetMyLocationShareQueryKey,
  getListEmergencyContactsQueryKey,
  useAddEmergencyContact,
  useCreateLocationShare,
  useDeleteEmergencyContact,
  useGetMyLocationShare,
  useListEmergencyContacts,
  useStopLocationShare,
  useUpdateLocationShare,
} from "@workspace/api-client-react";
import { Link } from "wouter";

function formatTime(value?: string | Date | null) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 20_000,
    });
  });
}

export default function SafetyCenterPage() {
  const queryClient = useQueryClient();
  const contacts = useListEmergencyContacts({
    query: { refetchOnWindowFocus: true },
  });
  const addContact = useAddEmergencyContact();
  const deleteContact = useDeleteEmergencyContact();
  const locationShare = useGetMyLocationShare({
    query: { refetchInterval: 30_000, refetchOnWindowFocus: true },
  });
  const createLocationShare = useCreateLocationShare();
  const updateLocationShare = useUpdateLocationShare();
  const stopLocationShare = useStopLocationShare();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactError, setContactError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [notice, setNotice] = useState("");
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [watchEnabled, setWatchEnabled] = useState(false);
  const lastUpdateAt = useRef(0);

  useEffect(() => {
    if (locationShare.data) setShareId(locationShare.data.shareId);
  }, [locationShare.data?.shareId]);

  useEffect(() => {
    if (!shareId || !watchEnabled || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastUpdateAt.current < 15_000) return;
        lastUpdateAt.current = now;
        updateLocationShare.mutate({
          shareId,
          data: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        }, {
          onError: () => {
            setLocationError("Live location could not update. Check your connection and try again.");
          },
        });
      },
      (error) => {
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Allow location access in your browser to keep this link up to date."
            : "Live location could not update. Check your device location and connection.",
        );
        setWatchEnabled(false);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [shareId, watchEnabled]);

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName || cleanPhone.length < 7) {
      setContactError("Enter a name and a phone number with at least 7 characters.");
      return;
    }
    if ((contacts.data?.length ?? 0) >= 3) {
      setContactError("You can save up to three emergency contacts.");
      return;
    }
    setContactError("");
    try {
      await addContact.mutateAsync({ data: { name: cleanName, phone: cleanPhone } });
      setName("");
      setPhone("");
      await queryClient.invalidateQueries({ queryKey: getListEmergencyContactsQueryKey() });
    } catch {
      setContactError("Could not save this contact. Check the details and try again.");
    }
  }

  async function removeContact(contactId: string) {
    setContactError("");
    try {
      await deleteContact.mutateAsync({ contactId });
      await queryClient.invalidateQueries({ queryKey: getListEmergencyContactsQueryKey() });
    } catch {
      setContactError("Could not remove this contact. Please try again.");
    }
  }

  async function shareLinkWithFriend(link: string) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "VibeSwipe live location",
          text: "My live location link",
          url: link,
        });
        setNotice("Share menu opened. Choose a friend to send the link.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNotice("The link is ready. Copy it and send it to someone you trust.");
      }
    } else {
      await copyLink(link);
    }
  }

  async function copyLink(link = shareLink) {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Link copied. Send it to someone you trust.");
    } catch {
      setLocationError("Could not copy the link. Try the browser share option or create a new link.");
    }
  }

  async function startLocationShare() {
    setLocationError("");
    setNotice("");
    try {
      const position = await getCurrentPosition();
      const created = await createLocationShare.mutateAsync({
        data: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
      });
      const url = new URL("/safety/location", window.location.origin);
      url.searchParams.set("token", created.token);
      const link = url.toString();
      setShareId(created.shareId);
      setShareLink(link);
      setWatchEnabled(true);
      lastUpdateAt.current = 0;
      await queryClient.invalidateQueries({ queryKey: getGetMyLocationShareQueryKey() });
      setNotice("Your link is ready. It expires in one hour.");
      await shareLinkWithFriend(link);
    } catch (error) {
      const geoError = error as GeolocationPositionError;
      if (typeof geoError?.code === "number") {
        setLocationError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location access was denied. Allow it in your browser to create a live link."
            : "Your location could not be read. Check device settings and try again.",
        );
      } else {
        setLocationError("Could not start location sharing. Check your connection and try again.");
      }
    }
  }

  async function resumeLocationUpdates() {
    if (!shareId) return;
    setLocationError("");
    try {
      const position = await getCurrentPosition();
      await updateLocationShare.mutateAsync({
        shareId,
        data: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
      });
      setWatchEnabled(true);
      lastUpdateAt.current = 0;
      setNotice("Live updates are on while this page stays open.");
      await queryClient.invalidateQueries({ queryKey: getGetMyLocationShareQueryKey() });
    } catch {
      setLocationError("Could not resume location updates. Allow location access and try again.");
    }
  }

  async function stopSharing() {
    if (!shareId) return;
    setLocationError("");
    try {
      await stopLocationShare.mutateAsync({ shareId });
      setWatchEnabled(false);
      setShareId(null);
      setShareLink(null);
      setNotice("Location sharing has stopped.");
      await queryClient.invalidateQueries({ queryKey: getGetMyLocationShareQueryKey() });
    } catch {
      setLocationError("Could not stop location sharing. Please try again.");
    }
  }

  const isActive = Boolean(shareId && locationShare.data?.shareId === shareId);
  const expiry = formatTime(locationShare.data?.expiresAt);

  return (
    <div className="mx-auto max-w-3xl px-4 py-7 md:px-8 md:py-10" data-testid="page-safety-center">
      <div className="mb-7">
        <Link
          href="/settings"
          className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          data-testid="link-safety-back-settings"
        >
          <ArrowLeft size={15} /> Back to Settings
        </Link>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
            <Shield size={22} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-primary">VibeSwipe</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Safety Center</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Practical tools and guidance to help you meet with confidence.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <section className="rounded-3xl border border-white/[.08] bg-card p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
              <HeartHandshake size={18} />
            </div>
            <div>
              <h2 className="font-bold">How to stay safe on VibeSwipe</h2>
              <p className="mt-1 text-xs text-muted-foreground">A few simple steps before you meet.</p>
            </div>
          </div>
          <ul className="mt-5 space-y-3">
            {[
              "Never share bank details or other financial information.",
              "Never send money to someone you have only met online.",
              "Meet in a public place first and tell someone you trust.",
            ].map((tip, index) => (
              <li key={tip} className="flex items-start gap-3 text-sm leading-6">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[.05] text-[10px] font-extrabold text-primary">
                  0{index + 1}
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-white/[.08] bg-card p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <Users size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold">Emergency contacts</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Save up to three trusted people. Only you can see these details.
                  </p>
                </div>
                <span className="rounded-full bg-white/[.05] px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                  {contacts.data?.length ?? 0}/3
                </span>
              </div>
            </div>
          </div>

          {contacts.isLoading ? (
            <div className="mt-5 h-12 animate-pulse rounded-xl bg-white/[.04]" />
          ) : contacts.isError ? (
            <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[.06] p-3 text-xs text-rose-200">
              <p>Contacts could not load.</p>
              <button
                type="button"
                onClick={() => void contacts.refetch()}
                className="mt-2 font-bold underline underline-offset-2"
                data-testid="button-retry-emergency-contacts"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-white/[.07]">
              {contacts.data?.map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 py-3" data-testid={`contact-${contact.id}`}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[.05] text-muted-foreground">
                    <Users size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{contact.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{contact.phone}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${contact.name}`}
                    onClick={() => void removeContact(contact.id)}
                    disabled={deleteContact.isPending}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-rose-300/10 hover:text-rose-300 disabled:opacity-50"
                    data-testid={`button-remove-contact-${contact.id}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {!contacts.data?.length && (
                <p className="py-4 text-xs text-muted-foreground">No trusted contacts saved yet.</p>
              )}
            </div>
          )}

          {(contacts.data?.length ?? 0) < 3 && (
            <form onSubmit={(event) => void saveContact(event)} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                aria-label="Emergency contact name"
                data-testid="input-emergency-contact-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Contact name"
                autoComplete="name"
                className="field"
                maxLength={80}
              />
              <input
                aria-label="Emergency contact phone"
                data-testid="input-emergency-contact-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone number"
                autoComplete="tel"
                inputMode="tel"
                className="field"
                maxLength={32}
              />
              <button
                type="submit"
                disabled={addContact.isPending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-secondary px-4 text-xs font-bold hover:bg-white/10 disabled:opacity-50"
                data-testid="button-add-emergency-contact"
              >
                <Plus size={15} /> {addContact.isPending ? "Saving…" : "Add contact"}
              </button>
            </form>
          )}
          {contactError && (
            <p role="alert" className="mt-3 text-xs text-rose-300" data-testid="text-contact-error">
              {contactError}
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-white/[.08] bg-card p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <MapPin size={18} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold">Share my location with a friend</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Create a private link that expires after one hour. It shows only your latest location.
              </p>
            </div>
          </div>
          <p className="mt-4 rounded-2xl bg-white/[.035] p-3 text-xs leading-5 text-muted-foreground">
            Location updates while this page stays open and location access is allowed. You can stop sharing at any time.
          </p>

          {locationShare.isError && (
            <div className="mt-3 text-xs text-rose-300" role="alert" data-testid="text-location-status-error">
              Your share status could not load. Refresh and try again.
            </div>
          )}
          {isActive && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.055] p-4">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Location link is active</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {expiry ? `Expires at ${expiry}.` : "It will expire after one hour."}
                  {watchEnabled ? " Live updates are on." : " Updates are paused until you resume them here."}
                </p>
                {shareLink && (
                  <p className="mt-2 break-all rounded-lg bg-black/20 px-2.5 py-2 text-[10px] leading-4 text-muted-foreground">
                    {shareLink}
                  </p>
                )}
                {shareLink && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/[.07] px-3 py-2 text-[11px] font-bold hover:bg-white/[.11]"
                      data-testid="button-copy-location-link"
                    >
                      <Copy size={13} /> Copy link
                    </button>
                    <button
                      type="button"
                      onClick={() => void shareLinkWithFriend(shareLink)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/[.07] px-3 py-2 text-[11px] font-bold hover:bg-white/[.11]"
                      data-testid="button-share-location-link-again"
                    >
                      <ExternalLink size={13} /> Share again
                    </button>
                  </div>
                )}
                {!shareLink && (
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                    For safety, an older link cannot be shown again. Create a new link if you need to share it again.
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Stop location sharing"
                onClick={() => void stopSharing()}
                disabled={stopLocationShare.isPending}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-300/10 hover:text-rose-300 disabled:opacity-50"
                data-testid="button-stop-location-share"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {locationError && (
            <p role="alert" className="mt-3 text-xs leading-5 text-rose-300" data-testid="text-location-error">
              {locationError}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-3 text-xs text-emerald-300" data-testid="text-location-notice">
              {notice}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {isActive && !watchEnabled && (
              <button
                type="button"
                onClick={() => void resumeLocationUpdates()}
                disabled={updateLocationShare.isPending}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-4 text-xs font-bold hover:bg-white/10 disabled:opacity-50"
                data-testid="button-resume-location-updates"
              >
                <Navigation size={15} /> Resume live updates
              </button>
            )}
            <button
              type="button"
              onClick={() => void startLocationShare()}
              disabled={createLocationShare.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-extrabold text-[#24111b] disabled:opacity-50"
              data-testid="button-start-location-share"
            >
              <Navigation size={15} />
              {createLocationShare.isPending
                ? "Preparing link…"
                : isActive
                  ? "Create a new link"
                  : "Share live location"}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/[.08] bg-card p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
              <Shield size={18} />
            </div>
            <div>
              <h2 className="font-bold">Quick safety actions</h2>
              <p className="mt-1 text-xs text-muted-foreground">Use the existing controls on your matches.</p>
            </div>
          </div>
          <Link
            href="/matches"
            className="mt-4 flex min-h-12 items-center gap-3 border-t border-white/[.07] pt-3 text-sm font-semibold hover:text-primary"
            data-testid="link-safety-matches"
          >
            <MessageCircle size={17} className="text-primary" />
            <span className="flex-1">Block, report, or unmatch</span>
            <ChevronRight size={17} className="text-muted-foreground" />
          </Link>
          <Link
            href="/community-guidelines"
            className="mt-1 flex min-h-12 items-center gap-3 border-t border-white/[.07] pt-3 text-sm font-semibold hover:text-primary"
            data-testid="link-community-guidelines"
          >
            <BookOpen size={17} className="text-primary" />
            <span className="flex-1">Community guidelines</span>
            <ChevronRight size={17} className="text-muted-foreground" />
          </Link>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            Block, Report, and Unmatch are available from your match or chat menu.
          </p>
        </section>
      </div>
    </div>
  );
}
