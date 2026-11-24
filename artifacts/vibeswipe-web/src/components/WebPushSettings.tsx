import { useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetWebPushConfigQueryKey,
  useDeleteWebPushSubscription,
  useGetWebPushConfig,
  useSaveWebPushSubscription,
  useGetVibeSwipeSettings,
  getGetMatchesQueryKey,
  getGetNotificationsQueryKey,
  getGetMessagesQueryKey,
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

function subscriptionInput(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("Please reconnect message notifications.");
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

function usesApplicationKey(subscription: PushSubscription, key: string) {
  const actual = subscription.options.applicationServerKey;
  if (!actual) return true;
  const expected = decodeApplicationServerKey(key);
  const bytes = new Uint8Array(actual);
  return bytes.length === expected.length && bytes.every((byte, index) => byte === expected[index]);
}

export function WebPushSettings({ compact = false, visible = true, accountId = "" }: { compact?: boolean; visible?: boolean; accountId?: string }) {
  const queryClient = useQueryClient();
  const preferences = useGetVibeSwipeSettings();
  const config = useGetWebPushConfig({
    query: { queryKey: getGetWebPushConfigQueryKey(), enabled: false },
  });
  const saveSubscription = useSaveWebPushSubscription();
  const deleteSubscription = useDeleteWebPushSubscription();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(`myage-push-reminder:${accountId}`) === "dismissed"; } catch { return false; }
  });
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const iosNeedsHomeScreen = isIOSDevice() && !isStandaloneApp();

  useEffect(() => {
    if (!supported) {
      setStatus(
        "This browser cannot receive background notifications. Use iOS 16.4 or newer with MyAgeBeauty on the Home Screen, or Chrome on Android.",
      );
      setChecked(true);
      return;
    }
    let active = true;
    let syncing = false;
    async function reconnect() {
      if (syncing || document.visibilityState === "hidden") return;
      syncing = true;
      try {
        if (!import.meta.env.PROD || iosNeedsHomeScreen || Notification.permission !== "granted") {
          if (active) setEnabled(false);
          return;
        }
        const registration = await navigator.serviceWorker.getRegistration(new URL(import.meta.env.BASE_URL, window.location.origin).href);
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) { if (active) setEnabled(false); return; }
        const loaded = await config.refetch();
        const key = loaded.data?.applicationServerKey;
        if (!key || !usesApplicationKey(subscription, key)) throw new Error("Reconnect message alerts using Enable notifications.");
        // A local subscription alone is not enrollment: bind it to the signed-in account.
        await saveSubscription.mutateAsync({ data: subscriptionInput(subscription) });
        if (active) { setEnabled(true); setStatus(""); }
      } catch {
        if (active) { setEnabled(false); setStatus("Message alerts need reconnecting. Tap Enable notifications."); }
      } finally {
        syncing = false;
        if (active) setChecked(true);
      }
    }
    void reconnect();
    window.addEventListener("focus", reconnect);
    window.addEventListener("online", reconnect);
    document.addEventListener("visibilitychange", reconnect);
    return () => {
      active = false;
      window.removeEventListener("focus", reconnect);
      window.removeEventListener("online", reconnect);
      document.removeEventListener("visibilitychange", reconnect);
    };
  }, [supported, iosNeedsHomeScreen, accountId]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const received = (event: MessageEvent) => {
      if (event.data?.type !== "myage:new-message") return;
      void queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
      if (typeof event.data.matchId === "string") void queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey(event.data.matchId) });
    };
    navigator.serviceWorker.addEventListener("message", received);
    return () => navigator.serviceWorker.removeEventListener("message", received);
  }, [queryClient]);

  async function enablePush() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      if (!supported) {
        throw new Error("This browser does not support background notifications.");
      }
      if (iosNeedsHomeScreen) {
        throw new Error("On iPhone or iPad, add MyAgeBeauty to your Home Screen and open it there before enabling notifications.");
      }
      if (!import.meta.env.PROD) {
        throw new Error("Background notifications can be enabled on the published MyAgeBeauty website, not in this preview.");
      }

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notifications are blocked. Allow them in your browser or phone settings, then try again.");
      }

      const registration =
        (await navigator.serviceWorker.getRegistration(
          new URL(import.meta.env.BASE_URL, window.location.origin).href,
        )) ?? (await navigator.serviceWorker.register(new URL("service-worker.js", new URL(import.meta.env.BASE_URL, window.location.origin)).href, { updateViaCache: "none" }));
      await navigator.serviceWorker.ready;
      let existing = await registration.pushManager.getSubscription();

      const loaded = await config.refetch();
      const applicationServerKey = loaded.data?.applicationServerKey;
      if (!applicationServerKey) {
        throw new Error("MyAgeBeauty could not prepare notifications. Please try again.");
      }
      if (existing && !usesApplicationKey(existing, applicationServerKey)) {
        await existing.unsubscribe();
        existing = null;
      }

      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            decodeApplicationServerKey(applicationServerKey) as BufferSource,
        }));
      await saveSubscription.mutateAsync({
        data: subscriptionInput(subscription),
      });
      setEnabled(true);
      setStatus("Message notifications are on for this browser.");
      await queryClient.invalidateQueries({
        queryKey: getGetWebPushConfigQueryKey(),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      const networkFailure = /failed to fetch|networkerror|load failed/i.test(detail);
      setStatus(
        networkFailure
          ? "Could not reach MyAgeBeauty. Check your connection and try again."
          : detail || "Notifications could not be enabled. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const registration =
        (await navigator.serviceWorker.getRegistration(
          new URL(import.meta.env.BASE_URL, window.location.origin).href,
        )) ?? (await navigator.serviceWorker.ready);
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await deleteSubscription.mutateAsync({
          data: { endpoint: existing.endpoint },
        });
        await existing.unsubscribe();
      }
      setEnabled(false);
      setStatus("Message notifications are off on this browser.");
    } catch {
      setStatus("Notifications could not be turned off. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!visible || !checked || enabled || dismissed || !mobile || !import.meta.env.PROD || preferences.data?.notifyMessages === false) return null;
    return <section data-testid="message-notification-reminder" className="fixed inset-x-3 bottom-[calc(78px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-2xl border border-primary/25 bg-card p-3 text-foreground shadow-xl">
      <button aria-label="Dismiss notification reminder" onClick={() => { setDismissed(true); try { sessionStorage.setItem(`myage-push-reminder:${accountId}`, "dismissed"); } catch { /* Storage may be unavailable. */ } }} className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground"><X size={16}/></button>
      <div className="flex items-center gap-3 pr-5"><Bell size={22} className="shrink-0 text-primary"/><div className="min-w-0 flex-1"><p className="text-sm font-bold">Get message notifications</p><p className="mt-0.5 text-xs text-muted-foreground">{iosNeedsHomeScreen ? "On iPhone, open MyAgeBeauty from your Home Screen first." : "Receive alerts even when MyAgeBeauty is closed."}</p></div></div>
      {!iosNeedsHomeScreen && <button data-testid="button-enable-background-notifications" disabled={busy || !supported} onClick={() => void enablePush()} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy && <LoaderCircle size={15} className="animate-spin"/>}Enable notifications</button>}
      {!!status && <p role="status" className="mt-2 text-xs text-muted-foreground">{status}</p>}
    </section>;
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
            Get the sender’s name and preview when MyAgeBeauty is closed. Tap an alert to open that chat.
          </p>
          {iosNeedsHomeScreen && (
            <p className="mt-2 text-xs leading-5 text-amber-200">
              On iPhone, open MyAgeBeauty from the Home Screen before turning notifications on.
            </p>
          )}
          {status && (
            <p role="status" className="mt-2 text-xs leading-5 text-muted-foreground">
              {status}
            </p>
          )}
          <button
            type="button"
            onClick={() => void enablePush()}
            disabled={busy || !supported}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-[#26111b] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="button-toggle-message-notifications"
          >
            {busy && <LoaderCircle size={16} className="animate-spin" />}
            {enabled ? "Keep notifications on" : "Enable message notifications"}
          </button>
          {enabled && (
            <button
              type="button"
              onClick={() => void disablePush()}
              disabled={busy}
              className="ml-2 mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 disabled:opacity-50"
              data-testid="button-disable-message-notifications"
            >
              Turn off
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
