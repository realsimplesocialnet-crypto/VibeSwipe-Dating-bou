export type UnreadMessageConversation = {
  blockedByMe?: boolean;
  blockedMe?: boolean;
  unreadCount?: number | null;
};

export function totalUnreadMessages(conversations: readonly UnreadMessageConversation[]): number {
  return conversations.reduce((total, conversation) => {
    if (conversation.blockedByMe || conversation.blockedMe) return total;
    return total + Math.max(0, conversation.unreadCount ?? 0);
  }, 0);
}

export function unreadBadgeLabel(count: number): string {
  return count > 99 ? "99+" : String(count);
}
