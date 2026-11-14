import { useQueryClient } from "@tanstack/react-query";
import { getGetNotificationsQueryKey, useGetNotifications, useMarkNotificationsRead } from "./generated/api";
import type { NotificationsResponse, NotificationType } from "./generated/api.schemas";

export type ActivityCategory = "views" | "likes" | "matches";
const categoryFor = (type: NotificationType): ActivityCategory | "messages" =>
  type === "profile_view" ? "views" : type === "new_like" || type === "new_super_like" ? "likes" : type === "new_match" ? "matches" : "messages";

export function unreadActivityIds(data: NotificationsResponse, category: ActivityCategory) {
  return data.notifications.filter(n => !n.readAt && categoryFor(n.type) === category).map(n => n.id);
}

// Update only the captured IDs: concurrent new activity and other categories survive.
export function patchActivityReads(data: NotificationsResponse, ids: string[], stamp: string, undo = false): NotificationsResponse {
  const selected = new Set(ids);
  const counts = { ...data.unreadCounts };
  const notifications = data.notifications.map(n => {
    if (!selected.has(n.id) || (undo ? n.readAt !== stamp : !!n.readAt)) return n;
    const category = categoryFor(n.type);
    counts[category] = Math.max(0, counts[category] + (undo ? 1 : -1));
    return { ...n, readAt: undo ? null : stamp };
  });
  return { ...data, notifications, unreadCounts: counts };
}

type ActivityReactHooks = {
  useCallback<T extends (...args: never[]) => unknown>(callback: T, deps: readonly unknown[]): T;
  useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  useRef<T>(value: T): { current: T };
  useState<T>(value: T): [T, (next: T | ((current: T) => T)) => void];
};

// Web and Expo use different React versions; bind hooks from the consuming app.
export function createUseMarkActivitySeen({ useCallback, useEffect, useRef, useState }: ActivityReactHooks) {
return function useMarkActivitySeen(category: ActivityCategory, options: { active?: boolean; ready: boolean }) {
  const qc = useQueryClient();
  const { mutateAsync } = useMarkNotificationsRead();
  const [visible, setVisible] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const attempted = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const busy = useRef(false);
  const mounted = useRef(true);
  const currentCategory = useRef(category);
  const active = options.active !== false && visible;
  const notes = useGetNotifications({ query: { enabled: active, staleTime: 0, refetchOnMount: "always" } });

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setVisible(document.visibilityState !== "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const acknowledge = useCallback(async (ids: string[]) => {
    if (!ids.length || busy.current) return;
    busy.current = true;
    setPending(true);
    const startedCategory = category;
    const stamp = new Date().toISOString();
    const key = getGetNotificationsQueryKey();
    try {
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<NotificationsResponse>(key, data => data ? patchActivityReads(data, ids, stamp) : data);
      for (let offset = 0; offset < ids.length; offset += 500) {
        const batch = ids.slice(offset, offset + 500);
        try {
          await mutateAsync({ data: { notificationIds: batch } });
          if (currentCategory.current === startedCategory) batch.forEach(id => failed.current.delete(id));
        } catch {
          qc.setQueryData<NotificationsResponse>(key, data => data ? patchActivityReads(data, batch, stamp, true) : data);
          if (currentCategory.current === startedCategory) batch.forEach(id => failed.current.add(id));
        }
      }
    } finally {
      busy.current = false;
      if (mounted.current) {
        setPending(false);
        setError(failed.current.size > 0);
      }
      void qc.invalidateQueries({ queryKey: key });
    }
  }, [category, mutateAsync, qc]);

  useEffect(() => {
    if (!active || currentCategory.current !== category) {
      currentCategory.current = category;
      attempted.current.clear();
      failed.current.clear();
      setError(false);
    }
    if (!active || !options.ready || !notes.data || notes.isFetching || pending || busy.current) return;
    const ids = unreadActivityIds(notes.data, category).filter(id => !attempted.current.has(id));
    ids.forEach(id => attempted.current.add(id));
    if (ids.length) void acknowledge(ids);
  }, [active, options.ready, category, notes.data, notes.isFetching, pending, acknowledge]);

  return { pending, error, retry: () => acknowledge([...failed.current]) };
};
}
