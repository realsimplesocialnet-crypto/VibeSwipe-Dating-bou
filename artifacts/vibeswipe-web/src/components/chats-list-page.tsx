import { lazy, useMemo, useState, type ReactNode } from "react";
import { Bell, Camera, Heart, Search, Sparkles } from "lucide-react";
import {
  getGetDirectChatsQueryKey,
  getGetMatchesQueryKey,
  getGetStoriesQueryKey,
  useGetDirectChats,
  useGetMatches,
  useGetStories,
} from "@workspace/api-client-react";
import { Link } from "@/lib/router-compat";
import { searchChatsByPersonName } from "@/lib/chat-search";
import { FetchError, FetchErrorBanner } from "@/components/fetch-status";
import { QuietSpinner } from "@/components/ui/quiet-spinner";
import { MediaImage } from "@/App";

const MatchStoryAvatar = lazy(() => import("@/components/stories/stories-ui").then((module) => ({ default: module.MatchStoryAvatar })));
const StoryCameraTrigger = lazy(() => import("@/components/stories/stories-ui").then((module) => ({ default: module.StoryCameraTrigger })));

type MatchListExtras = { unreadCount?: number; lastMessageAt?: string | null };

function relativeTime(value?: string | null) {
  if (!value) return "";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return "";
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  if (elapsed < 604_800_000) return `${Math.floor(elapsed / 86_400_000)}d ago`;
  return new Date(value).toLocaleDateString();
}

function LoadingConversations() {
  return <div role="status" aria-label="Loading conversations" className="flex justify-center py-8"><QuietSpinner /></div>;
}

function RetryConversations({ onRetry }: { onRetry: () => void }) {
  return <FetchError text="We couldn’t load your messages. Check your connection and try again." onRetry={onRetry} />;
}

function EmptyConversations({ action }: { action: ReactNode }) {
  return <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[.02] px-6 py-14 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary"><Sparkles size={23} /></div>
    <h3 className="mt-5 text-lg font-bold">No conversations yet</h3>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">When you and someone both say yes, your conversation opens here.</p>
    <div className="mt-5">{action}</div>
  </div>;
}

export function ChatsListPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "new">("all");
  const matches = useGetMatches({ query: { queryKey: getGetMatchesQueryKey(), refetchInterval: 10_000, refetchOnMount: "always", refetchOnWindowFocus: true, staleTime: 0 } });
  const direct = useGetDirectChats({ query: { queryKey: getGetDirectChatsQueryKey(), refetchInterval: 5_000, refetchOnMount: "always", refetchOnWindowFocus: true } });
  const stories = useGetStories({ query: { queryKey: getGetStoriesQueryKey(), refetchInterval: 60_000 } });
  const list = useMemo(() => (matches.data ?? [])
    .filter((match) => !match.profile.isDemo && !match.blockedByMe && !match.blockedMe)
    .sort((a, b) => new Date((b as MatchListExtras).lastMessageAt ?? b.updatedAt).getTime() - new Date((a as MatchListExtras).lastMessageAt ?? a.updatedAt).getTime()), [matches.data]);
  const searched = searchChatsByPersonName(list, search);
  const unreadTotal = list.reduce((sum, match) => sum + ((match as MatchListExtras).unreadCount ?? 0), 0) + (direct.data ?? []).reduce((sum, item) => sum + item.unreadCount, 0);
  const newMatches = filter === "unread" ? [] : searched.filter((match) => !match.lastMessage && (filter === "all" || filter === "new"));
  const chats = filter === "new" ? [] : searched.filter((match) => Boolean(match.lastMessage) && (filter !== "unread" || ((match as MatchListExtras).unreadCount ?? 0) > 0));
  const directList = (direct.data ?? [])
    .filter((item) => !item.profile.isDemo && item.profile.id)
    .filter((item) => !search || item.profile.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime());
  const visibleDirect = filter === "new" ? [] : directList.filter((item) => filter !== "unread" || item.unreadCount > 0);

  return <div className="messages-page min-h-[calc(100dvh-48px)] lg:min-h-[100dvh]">
    <div className="page-in mx-auto max-w-[720px] px-4 pb-10 pt-6 md:px-8 md:pt-10" data-testid="messages-page-content">
      <div className="flex items-center justify-between" data-testid="chats-header">
        <h1 className="text-3xl font-black leading-tight tracking-[-.04em] md:text-4xl">Inbox</h1>
        <div className="flex items-center gap-2">
          <Link href="/notifications" aria-label="Open activity and notifications" data-testid="link-inbox-activity" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"><Bell size={20} aria-hidden="true" /></Link>
          <Link href="/stories/new?returnTo=%2Fmessages&mode=text" aria-label="Write a text story" data-testid="button-write-story-from-chats" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-accent">Aa</Link>
          <StoryCameraTrigger returnTo="/messages" label="Open camera to create a story" testId="button-create-story-from-chats" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent">
            <Camera size={21} strokeWidth={2.4} aria-hidden="true" />
          </StoryCameraTrigger>
        </div>
      </div>
      <label className="mt-5 flex h-12 items-center gap-3 rounded-full border border-border bg-card px-4 shadow-sm focus-within:ring-2 focus-within:ring-primary/35">
        <Search size={19} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} placeholder="Search by name" aria-label="Search chats by person name" data-testid="input-search-chats" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear chat search" className="text-sm font-bold text-primary">Clear</button>}
      </label>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Chat filters">
        {([
          ["all", "All"],
          ["unread", unreadTotal ? `Unread ${unreadTotal > 99 ? "99+" : unreadTotal}` : "Unread"],
          ["new", "New matches"],
        ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} data-testid={`chat-filter-${value}`} onClick={() => setFilter(value)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${filter === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
      </div>
      <div className="mt-5">
        {(matches.isError || direct.isError) && (matches.data || direct.data) && <FetchErrorBanner text="Some conversations couldn’t refresh." onRetry={() => { void matches.refetch(); void direct.refetch(); }} />}
        {matches.isLoading && direct.isLoading ? <LoadingConversations />
          : matches.isError && !matches.data && direct.isError && !direct.data
            ? <RetryConversations onRetry={() => { void matches.refetch(); void direct.refetch(); }} />
            : !list.length && !directList.length
              ? <EmptyConversations action={<Link href="/discover" data-testid="link-messages-discover" className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Go to Discover</Link>} />
              : !newMatches.length && !chats.length && !visibleDirect.length
                ? <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm font-medium text-muted-foreground" data-testid="empty-chat-search">{search.trim() ? "No chats found for that name." : filter === "unread" ? "No unread chats." : "No new matches."}</div>
                : <div className="space-y-7">
                  {newMatches.length > 0 && <section aria-label="New matches" data-testid="section-new-matches">
                    <h2 className="mb-3 text-xs font-extrabold uppercase tracking-[.18em] text-primary">New Matches</h2>
                    <ul className="space-y-3">{newMatches.map((match) => <li key={match.id} className="flex items-center gap-4 py-3">
                      <div className="msg-avatar shrink-0"><MatchStoryAvatar matchId={match.id} profile={match.profile} storyGroup={stories.data?.mutualFollows.find((group) => group.poster.id === match.profile.id)} returnTo="/messages" /></div>
                      <Link href={`/chat/${match.id}?returnTo=%2Fmessages&focusComposer=1`} data-testid={`link-new-match-${match.id}`} aria-label={`Start a chat with ${match.profile.name}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="min-w-0 flex-1"><div className="truncate text-[17px] font-bold">{match.profile.name}</div><div className="mt-1 text-sm text-muted-foreground">You both liked each other ❤️</div></div>
                        <span className="shrink-0 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Message</span>
                      </Link>
                    </li>)}</ul>
                  </section>}
                  {chats.length > 0 && <section aria-label="Chats" data-testid="section-active-chats">
                    {newMatches.length > 0 && <h2 className="mb-3 text-xs font-extrabold uppercase tracking-[.18em] text-muted-foreground">Chats</h2>}
                    <ul className="space-y-0">{chats.map((match) => {
                      const extras = match as MatchListExtras;
                      const blocked = match.blockedByMe || match.blockedMe;
                      const unread = !blocked && (extras.unreadCount ?? 0) > 0;
                      const preview = match.blockedByMe ? "You blocked this person. Unblock from Matches to chat again." : match.blockedMe ? "Messaging is unavailable with this person." : match.lastMessage || "You matched. Say hello.";
                      return <li key={match.id} data-testid={`card-conversation-${match.id}`} className={`relative flex items-center gap-4 py-3 transition-colors hover:bg-accent/30 ${blocked ? "opacity-70" : ""}`}>
                        <div className="msg-avatar shrink-0"><MatchStoryAvatar matchId={match.id} profile={match.profile} storyGroup={stories.data?.mutualFollows.find((group) => group.poster.id === match.profile.id)} disabled={blocked} returnTo="/messages" /></div>
                        {blocked
                          ? <div className="min-w-0 flex-1" data-testid={`status-conversation-blocked-${match.id}`}><div className="truncate text-[17px] font-bold">{match.profile.name}</div><div className="mt-1 text-sm text-destructive">{preview}</div></div>
                          : <Link href={`/chat/${match.id}?returnTo=%2Fmessages`} data-testid={`link-conversation-${match.id}`} aria-label={`Open chat with ${match.profile.name}${unread ? `, ${extras.unreadCount} unread` : ""}`} className="flex min-w-0 flex-1 items-center gap-3 self-stretch">
                            <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[17px] font-bold"><span className="truncate">{match.profile.name}</span><Heart size={15} fill="currentColor" aria-hidden="true" className="shrink-0 text-primary" /></div><div className={`mt-1 line-clamp-2 text-sm leading-5 ${unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{preview}</div></div>
                            <div className="flex h-full shrink-0 flex-col items-end justify-between gap-5 self-stretch py-1">
                              <time dateTime={extras.lastMessageAt ?? match.updatedAt} className="text-xs text-muted-foreground">{relativeTime(extras.lastMessageAt ?? match.updatedAt)}</time>
                              {unread ? <span aria-label={`${extras.unreadCount} unread messages`} data-testid={`status-unread-${match.id}`} className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">{extras.unreadCount! > 99 ? "99+" : extras.unreadCount}</span> : <span className="h-7" />}
                            </div>
                          </Link>}
                      </li>;
                    })}</ul>
                  </section>}
                  {visibleDirect.length > 0 && <section aria-label="Direct messages" data-testid="section-direct-chats">
                    <h2 className="mb-3 text-xs font-extrabold uppercase tracking-[.18em] text-muted-foreground">Direct Messages</h2>
                    <ul>{visibleDirect.map((item) => <li key={item.id} className="flex items-center gap-3 py-3" data-testid={`card-direct-chat-${item.id}`}>
                      <Link href={`/direct-chat/${item.id}?returnTo=%2Fmessages`} aria-label={`Open direct chat with ${item.profile.name}`} className="flex min-w-0 flex-1 items-center gap-3">
                        {item.profile.photos?.[0] ? <MediaImage reference={item.profile.photos[0]} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-primary">{item.profile.name.slice(0, 1)}</span>}
                        <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-bold">{item.profile.name}</span><span className={`mt-1 block truncate text-sm ${item.unreadCount ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{item.lastMessage || "Start a conversation"}</span></span>
                        <span className="flex shrink-0 flex-col items-end gap-2"><time className="text-xs text-muted-foreground">{relativeTime(item.lastMessageAt)}</time>{item.unreadCount > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">{item.unreadCount > 99 ? "99+" : item.unreadCount}</span>}</span>
                      </Link>
                    </li>)}</ul>
                  </section>}
                  {!chats.length && !visibleDirect.length && newMatches.length > 0 && <p className="text-center text-sm text-muted-foreground">No chats yet. Start a conversation with a new match.</p>}
                </div>}
      </div>
    </div>
  </div>;
}
