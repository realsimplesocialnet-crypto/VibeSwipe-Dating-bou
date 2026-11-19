import type { NotificationsResponse, NotificationType } from "./generated/api.schemas";

export type ActivityCategory = "views" | "likes" | "matches";
type NotificationCountCategory = keyof NotificationsResponse["unreadCounts"];

const categoryFor = (type: NotificationType): NotificationCountCategory | null => {
  if (type === "profile_view") return "views";
  if (type === "new_like" || type === "new_super_like") return "likes";
  if (type === "new_match") return "matches";
  if (type === "new_follow") return "follows";
  if (type === "reel_like" || type === "reel_comment_reply") return "reels";
  if (type === "new_message") return "messages";
  return null;
};

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
    if (category) counts[category] = Math.max(0, counts[category] + (undo ? 1 : -1));
    return { ...n, readAt: undo ? null : stamp };
  });
  return { ...data, notifications, unreadCounts: counts };
}
