import { useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetWebPushConfigQueryKey,
  useDeleteWebPushSubscription,
  useGetWebPushConfig,
  useSaveWebPushSubscription,
} from "@workspace/api-client-react";

function isIOSDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandaloneApp(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function decodeApplicationServerKey(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function WebPushSettings() {
  const queryClient = useQueryClient();
  const config = useGetWebPushConfig({
    query: { queryKey: getGetWebPushConfigQueryKey(), enabled: false },
  });
  const saveSubscription = useSaveWebPushSubscription();
  const deleteSubscription = useDeleteWebPushSubscription();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const iosNeedsHomeScreen = supported && isIOSDevice() && !isStandaloneApp();

  useEffect(() => {
    if (!supported) return;
    let active = true;
    void navigator.serviceWorker
      .getRegistration(new URL(import.meta.env.BASE_URL, window.location.origin).href)
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => {
        if (active) setEnabled(Boolean(subscription));
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, [supported]);

  async function togglePush() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      if (!supported) {
        throw new Error("This browser does not support background notifications.");
      }
      if (iosNeedsHomeScreen) {
        throw new Error("On iPhone or iPad, add Myage to your Home Screen and open it there before enabling notifications.");
      }
      if (!import.meta.env.PROD) {
        throw new Error("Background notifications can be enabled on the published Myage website, not in this preview.");
      }

      const registration =
        (await navigator.serviceWorker.getRegistration(
          new URL(import.meta.env.BASE_URL, window.location.origin).href,
        )) ?? (await navigator.serviceWorker.ready);
      const existing = await registration.pushManager.getSubscription();
      if (enabled && existing) {
        await deleteSubscription.mutateAsync({
          data: { endpoint: existing.endpoint },
        });
        await existing.unsubscribe();
        setEnabled(false);
        setStatus("Message notifications are off on this browser.");
        return;
      }

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notifications are blocked. Allow them in your browser or phone settings, then try again.");
      }

      let applicationServerKey = config.data?.applicationServerKey;
      if (!applicationServerKey) {
        const loaded = await config.refetch();
        applicationServerKey = loaded.data?.applicationServerKey;
      }
      if (!applicationServerKey) {
        throw new Error("Myage could not prepare notifications. Please try again.");
      }

      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            decodeApplicationServerKey(applicationServerKey) as BufferSource,
        }));
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error("This browser returned an incomplete notification subscription. Please try again.");
      }
      await saveSubscription.mutateAsync({
        data: {
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      });
      setEnabled(true);
      setStatus("Message notifications are on for this browser.");
      await queryClient.invalidateQueries({
        queryKey: getGetWebPushConfigQueryKey(),
      });
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Notifications could not be enabled. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-white/[.08] bg-card p-5"
      data-testid="section-message-notifications"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          {enabled ? <Bell size={18} /> : <BellOff size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">Message notifications</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Get the sender’s name and message preview when Myage is closed or in the background.
          </p>
          {iosNeedsHomeScreen && (
            <p className="mt-2 text-xs leading-5 text-amber-200">
              On iPhone, open Myage from the Home Screen before turning notifications on.
            </p>
          )}
          {status && (
            <p role="status" className="mt-2 text-xs leading-5 text-muted-foreground">
              {status}
            </p>
          )}
          <button
            type="button"
            onClick={() => void togglePush()}
            disabled={busy || !supported}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-[#26111b] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="button-toggle-message-notifications"
          >
            {busy && <LoaderCircle size={16} className="animate-spin" />}
            {enabled ? "Turn off on this browser" : "Enable message notifications"}
          </button>
        </div>
      </div>
    </section>
  );
}
