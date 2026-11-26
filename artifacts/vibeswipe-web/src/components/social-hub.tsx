import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { QuietSpinner } from "@/components/ui/quiet-spinner";
import { ArrowLeft, ChevronRight, Eye, Heart, LoaderCircle, MessageCircle, RefreshCw, Search, Star, ThumbsUp, UserRound, Users, UserPlus } from 'lucide-react';
import {
  getGetMatchesQueryKey, getGetNotificationsQueryKey, getGetProfileFollowSummaryQueryKey, getGetProfileFollowersQueryKey,
  getGetProfileFollowingQueryKey, getGetStoriesQueryKey, getGetWhoLikedYouQueryKey, getGetWhoViewedYouQueryKey,
  useCreateReaction, useFollowProfile, useGetMatches, useGetMyProfile, useGetNotifications, useGetProfileFollowSummary,
  useGetProfileFollowers, useGetProfileFollowing, useGetStories, useGetWhoLikedYou, useGetWhoViewedYou,
  useMarkNotificationRead, useUnfollowProfile,
  createUseMarkActivitySeen,
} from '@workspace/api-client-react';
import type { Match, NotificationsResponse, Profile, ProfileFollowList, ProfileLike } from '@workspace/api-client-react';
import { patchActivityReads } from '@workspace/api-client-react';
import { MatchStoryAvatar } from '@/components/stories/stories-ui';
import { MatchCelebration } from '@/components/match-celebration';
import './social-hub.css';

type AvatarFn = (profile: Profile) => ReactNode;
const live = { refetchInterval: 15000, refetchOnMount: 'always' as const, refetchOnWindowFocus: true, staleTime: 0 };
const useMarkActivitySeen = createUseMarkActivitySeen({ useCallback, useEffect, useRef, useState });

function ago(v: string) {
  const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(v).toLocaleDateString();
}
const activeMatches = (m?: Match[]) => (m ?? []).filter(x => !x.profile.isDemo && !x.blockedByMe && !x.blockedMe);

function restoreRemovedLike(current: ProfileLike[] | undefined, removed: ProfileLike, laterIds: ReadonlySet<string>) {
  const list = current ?? [];
  if (list.some((item) => item.profile.id === removed.profile.id)) return list;
  const insertAt = list.findIndex((item) => laterIds.has(item.profile.id));
  if (insertAt < 0) return [...list, removed];
  return [...list.slice(0, insertAt), removed, ...list.slice(insertAt)];
}

function useNoticeReader() {
  const qc = useQueryClient();
  const notes = useGetNotifications({ query: live });
  const mark = useMarkNotificationRead();
  return (actorId: string, type: 'new_match' | 'new_like' | 'profile_view') => {
    const unread = notes.data?.notifications.filter(n => n.actor.id === actorId && (n.type === type || (type === 'new_like' && n.type === 'new_super_like')) && !n.readAt) ?? [];
    if (unread.length) void Promise.allSettled(unread.map(n => mark.mutateAsync({ notificationId: n.id })))
      .then(() => qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }));
  };
}

function Head({ title, sub, back }: { title: string; sub?: string; back?: boolean }) {
  return <header className="mb-6">
    {back && <Link href="/notifications" data-testid="link-back-activity" className="sh-back mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold"><ArrowLeft size={16} aria-hidden="true" />Activity</Link>}
    <h1 className="brand text-[2.4rem] font-extrabold leading-none tracking-[-.05em] md:text-5xl" data-testid="text-page-title">{title}</h1>
    {sub && <p className="mt-2 text-[15px] sh-muted">{sub}</p>}
  </header>;
}

function SeenError({ seen }: { seen: ReturnType<typeof useMarkActivitySeen> }) {
  return seen.error ? <div role="alert" className="mb-3 rounded-xl bg-primary/10 p-3 text-sm">Couldn’t clear the new count. <button disabled={seen.pending} onClick={() => void seen.retry()} className="font-bold text-primary">Retry</button></div> : null;
}
function Skel() {
  return <div className="flex justify-center py-10" role="status" aria-label="Loading"><QuietSpinner /></div>;
}
function Err({ onRetry, text }: { onRetry: () => void; text: string }) {
  return <div role="alert" className="sh-card mx-auto max-w-sm rounded-[26px] px-6 py-10 text-center"><p className="text-sm leading-6">{text}</p><button type="button" onClick={onRetry} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Retry</button></div>;
}
function Empty({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="sh-card flex flex-col items-center rounded-[26px] px-6 py-12 text-center" data-testid="status-empty"><div className="sh-icon mb-4 flex h-14 w-14 items-center justify-center rounded-full">{icon}</div><h2 className="text-lg font-bold">{title}</h2><p className="sh-muted mt-1 max-w-xs text-sm">{detail}</p><Link href="/discover" data-testid="link-empty-discover" className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Go to Discover</Link></div>;
}
export function ActivityOverview({ avatar: _avatar }: { avatar: AvatarFn }) {
  const qc = useQueryClient();
  const [, go] = useLocation();
  const notes = useGetNotifications({ query: { queryKey: getGetNotificationsQueryKey(), ...live } });
  const me = useGetMyProfile();
  const mark = useMarkNotificationRead();
  const [readError, setReadError] = useState('');
  const unreadCounts = notes.data?.unreadCounts;
  const metricCards = [
    { key: 'matches', label: 'Matches', href: '/matches', count: unreadCounts?.matches ?? 0, icon: Heart, color: '#171717' },
    { key: 'likes', label: 'Likes', href: '/likes', count: unreadCounts?.likes ?? 0, icon: ThumbsUp, color: '#171717' },
    { key: 'views', label: 'Views', href: '/views', count: unreadCounts?.views ?? 0, icon: Eye, color: '#171717' },
    { key: 'followers', label: 'Followers', href: me.data?.id ? `/profile/${me.data.id}/followers` : '', count: unreadCounts?.follows ?? 0, icon: UserRound, color: '#171717' },
  ];
  const items = useMemo(() => (notes.data?.notifications ?? [])
    .filter(n => n.type === 'new_match' || n.type === 'new_like' || n.type === 'new_super_like' || n.type === 'profile_view' || n.type === 'new_follow' || n.type === 'reel_like' || n.type === 'reel_comment_reply' || n.type === 'reel_comment_like')
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [notes.data?.notifications]);

  async function openActivityItem(n: NotificationsResponse['notifications'][number]) {
    if (n.type === 'new_match' && n.matchId) go(`/chat/${encodeURIComponent(n.matchId)}?returnTo=%2Fnotifications`);
    else if ((n.type === 'reel_like' || n.type === 'reel_comment_reply' || n.type === 'reel_comment_like') && n.reelId) {
      const params = new URLSearchParams({ returnTo: '/notifications' });
      if ((n.type === 'reel_comment_reply' || n.type === 'reel_comment_like') && n.commentId) params.set('commentId', n.commentId);
      go(`/reels/${encodeURIComponent(n.reelId)}?${params.toString()}`);
    } else go(`/profile/${encodeURIComponent(n.actor.id)}?returnTo=%2Fnotifications`);
    if (n.readAt) return;
    const key = getGetNotificationsQueryKey();
    const stamp = new Date().toISOString();
    await qc.cancelQueries({ queryKey: key });
    const current = qc.getQueryData<NotificationsResponse>(key);
    const canOptimisticallyMark = !!current?.notifications.some(item => item.id === n.id && !item.readAt);
    if (canOptimisticallyMark) qc.setQueryData<NotificationsResponse>(key, data => data ? patchActivityReads(data, [n.id], stamp) : data);
    try {
      await mark.mutateAsync({ notificationId: n.id });
    } catch {
      if (canOptimisticallyMark) qc.setQueryData<NotificationsResponse>(key, data => data ? patchActivityReads(data, [n.id], stamp, true) : data);
      setReadError('This activity could not be marked as read. Please try again.');
    } finally {
      void qc.invalidateQueries({ queryKey: key });
    }
  }

  const eventStyle = (type: NotificationsResponse['notifications'][number]['type']) => {
    if (type === 'new_match') return { label: 'matched with you', icon: Heart, color: '#171717' };
    if (type === 'new_like' || type === 'new_super_like') return { label: type === 'new_super_like' ? 'super liked you' : 'liked you', icon: ThumbsUp, color: '#171717' };
    if (type === 'reel_comment_like') return { label: 'liked your comment', icon: Heart, color: '#171717' };
    if (type === 'reel_comment_reply') return { label: 'replied to your comment', icon: MessageCircle, color: '#171717' };
    if (type === 'reel_like') return { label: 'liked your video', icon: Heart, color: '#171717' };
    if (type === 'profile_view') return { label: 'viewed your profile', icon: Eye, color: '#171717' };
    return { label: 'followed you', icon: UserRound, color: '#171717' };
  };

  return <div className="social-hub activity-screen min-h-[calc(100dvh-48px)] lg:min-h-[100dvh]"><div className="page-in mx-auto max-w-[720px] px-4 pb-12 pt-6 md:px-8 md:pt-10">
    <Head title="Activity" />
    <section className="activity-metric-grid" aria-label="Activity summary" data-testid="activity-summary">
      {metricCards.map(card => {
        const Icon = card.icon;
        const content = <>
          <span className="activity-metric-icon" style={{ backgroundColor: card.color }}><Icon size={23} strokeWidth={2.6} fill={card.key === 'matches' ? 'currentColor' : 'none'} aria-hidden="true" /></span>
          <span className="activity-metric-copy">
            <strong data-testid={`text-count-${card.key}`}>{notes.isLoading ? '—' : card.count}</strong>
            <span>{card.label}</span>
          </span>
        </>;
        return card.href
          ? <Link key={card.key} href={card.href} data-testid={`link-summary-${card.key}`} aria-label={`${card.label}, ${card.count} unread`} className="activity-metric-card">{content}</Link>
          : <div key={card.key} aria-label={`${card.label}, ${card.count} unread`} className="activity-metric-card is-loading">{content}</div>;
      })}
    </section>
    {readError && <p role="alert" className="activity-read-error">{readError}</p>}
    {notes.isError && notes.data && <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-card px-4 py-3 text-sm"><p className="text-muted-foreground">Activity couldn’t refresh.</p><button type="button" onClick={() => void notes.refetch()} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Retry</button></div>}
    {notes.isLoading && !notes.data ? <Skel /> : notes.isError && !notes.data ? <Err text="We couldn't load your activity. Check your connection and try again." onRetry={() => void notes.refetch()} /> : items.length === 0
      ? <div className="activity-empty" data-testid="status-empty-activity"><span className="activity-empty-icon"><Heart size={22}/></span><strong>You’re all caught up</strong><p>New follows, likes, and profile views will show up here. Check back later.</p><Link href="/discover" className="mt-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Discover people</Link></div>
      : <section className="activity-feed" aria-label="Activity feed" data-testid="activity-feed">
        {items.map(n => {
          const event = eventStyle(n.type);
          const Icon = event.icon;
          return <button key={n.id} type="button" onClick={() => void openActivityItem(n)} data-testid={`activity-item-${n.id}`} data-read={n.readAt ? 'true' : 'false'} aria-label={`${n.actor.name} ${event.label}, ${ago(n.createdAt)}${n.readAt ? ', read' : ', unread'}`} className={`activity-feed-row${n.readAt ? ' is-read' : ''}`}>
            <span className="activity-feed-icon" style={{ backgroundColor: event.color }}><Icon size={20} strokeWidth={2.5} fill={n.type === 'new_match' ? 'currentColor' : 'none'} aria-hidden="true"/></span>
            <span className="activity-feed-copy"><span><strong>{n.actor.name}</strong> {event.label}</span><time dateTime={n.createdAt}>{ago(n.createdAt)}</time></span>
            {!n.readAt && <span className="activity-unread-dot" aria-label="Unread"/>}
          </button>;
        })}
      </section>}
  </div></div>;
}

export function InboundPeoplePage({ avatar, kind }: { avatar: AvatarFn; kind: 'likes' | 'views' }) {
  const isLikes = kind === 'likes';
  const readNotice = useNoticeReader();
  const likes = useGetWhoLikedYou({ query: { queryKey: getGetWhoLikedYouQueryKey(), enabled: isLikes, ...live } });
  const views = useGetWhoViewedYou({ query: { queryKey: getGetWhoViewedYouQueryKey(), enabled: !isLikes, ...live } });
  const me = useGetMyProfile();
  const [, setLocation] = useLocation();
  const reaction = useCreateReaction();
  const [match, setMatch] = useState<{ profile: Profile; matchId: string | null } | null>(null);
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const likeInflight = useRef(new Set<string>());
  const qc = useQueryClient();
  const q = isLikes ? likes : views;
  const seen = useMarkActivitySeen(kind, { ready: q.isSuccess && !q.isFetching });
  const rows = useMemo(() => isLikes ? (likes.data ?? []).map(l => ({ profile: l.profile, at: l.likedAt, isSuperLike: l.isSuperLike })) : (views.data ?? []).map(v => ({ profile: v.profile, at: v.viewedAt, isSuperLike: false })), [isLikes, likes.data, views.data]);
  const rt = isLikes ? '%2Flikes' : '%2Fviews';
  return <div className="social-hub min-h-[calc(100dvh-48px)] lg:min-h-[100dvh]"><div className="page-in mx-auto max-w-[720px] px-4 pb-12 pt-6 md:px-8 md:pt-10">
    <Head back title={isLikes ? 'Dating Likes' : 'Views'} sub={isLikes ? 'People who liked your profile' : 'People who viewed your profile'} />
    <SeenError seen={seen} />
    {actionError && <p role="alert" className="mb-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm">{actionError}</p>}
    {q.isLoading && !q.data ? <Skel /> : q.isError && !q.data ? <Err text={`We couldn't load your ${kind}.`} onRetry={() => void q.refetch()} />
      : !rows.length && isLikes ? <div className="sh-card flex flex-col items-center rounded-[26px] px-6 py-12 text-center" data-testid="status-empty-likes">
        <div className="sh-icon mb-4 flex h-16 w-16 items-center justify-center rounded-full"><Heart size={30} fill="currentColor" aria-hidden="true" /></div>
        <h2 className="text-lg font-bold">No new likes yet.</h2>
        <p className="sh-muted mt-1 max-w-xs text-sm">Keep swiping!</p>
        <Link href="/discover" data-testid="link-empty-discover" className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Discover</Link>
      </div>
      : !rows.length ? <Empty icon={<Eye size={24} />} title="No views yet" detail="When someone opens your profile, they show up here." />
      : <ul className="space-y-3">{rows.map(r => <li key={`${r.profile.id}-${r.at}`} className="sh-card flex flex-wrap items-center gap-4 rounded-[22px] p-3.5 md:p-4">
        <Link href={`/profile/${r.profile.id}?returnTo=${rt}`} onClick={() => readNotice(r.profile.id, isLikes ? 'new_like' : 'profile_view')} data-testid={`link-${kind}-profile-${r.profile.id}`} aria-label={`View ${r.profile.name}'s profile`} className="flex min-w-0 flex-1 items-center gap-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full">{avatar(r.profile)}</div>
          <div className="min-w-0 flex-1"><div className="truncate text-[17px] font-bold">{r.profile.name}</div><div className="sh-muted text-sm">{isLikes ? (r.isSuperLike ? 'Super Liked your profile' : 'Liked your profile') : 'Viewed your profile'} <span aria-hidden="true">·</span> <time dateTime={r.at}>{ago(r.at)}</time></div></div>
          {isLikes ? (r.isSuperLike ? <Star size={22} fill="currentColor" className="shrink-0 text-primary" aria-hidden="true" /> : <Heart size={22} fill="currentColor" className="shrink-0 text-primary" aria-hidden="true" />) : <span className="sh-pill inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"><Eye size={15} aria-hidden="true" />View</span>}
        </Link>
        {isLikes && <div className="flex w-full gap-2 pl-[4.5rem] sm:w-auto sm:pl-0">
          <button type="button" disabled={busyId === r.profile.id} data-testid={`button-pass-like-${r.profile.id}`}
            onClick={() => {
              const id = r.profile.id;
              if (likeInflight.current.has(id)) return;
              likeInflight.current.add(id);
              setBusyId(id);
              setActionError('');
              const key = getGetWhoLikedYouQueryKey();
              const previous = qc.getQueryData<ProfileLike[]>(key) ?? [];
              const removedIndex = previous.findIndex((item) => item.profile.id === id);
              const removed = removedIndex >= 0 ? previous[removedIndex] : undefined;
              const laterIds = new Set((removedIndex >= 0 ? previous.slice(removedIndex + 1) : []).map((item) => item.profile.id));
              qc.setQueryData<ProfileLike[]>(key, (current) => current?.filter((item) => item.profile.id !== id));
              void reaction.mutateAsync({ data: { toUserId: id, type: 'pass' } }).then(() => {
                void qc.invalidateQueries({ queryKey: key });
                void qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
              }).catch(() => {
                if (removed) qc.setQueryData<ProfileLike[]>(key, (current) => restoreRemovedLike(current, removed, laterIds));
                setActionError(`Your pass on ${r.profile.name} did not save. Please try again.`);
              }).finally(() => {
                likeInflight.current.delete(id);
                setBusyId('');
              });
            }}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-muted-foreground disabled:opacity-50">Pass</button>
          <button type="button" disabled={busyId === r.profile.id} data-testid={`button-like-back-${r.profile.id}`}
            onClick={() => {
              const id = r.profile.id;
              if (likeInflight.current.has(id)) return;
              likeInflight.current.add(id);
              setBusyId(id);
              setActionError('');
              const key = getGetWhoLikedYouQueryKey();
              const previous = qc.getQueryData<ProfileLike[]>(key) ?? [];
              const removedIndex = previous.findIndex((item) => item.profile.id === id);
              const removed = removedIndex >= 0 ? previous[removedIndex] : undefined;
              const laterIds = new Set((removedIndex >= 0 ? previous.slice(removedIndex + 1) : []).map((item) => item.profile.id));
              qc.setQueryData<ProfileLike[]>(key, (current) => current?.filter((item) => item.profile.id !== id));
              void reaction.mutateAsync({ data: { toUserId: id, type: 'like' } }).then((result) => {
                void qc.invalidateQueries({ queryKey: key });
                void qc.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
                void qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
                if (result.matched) setMatch({ profile: r.profile, matchId: result.matchId ?? null });
              }).catch(() => {
                if (removed) qc.setQueryData<ProfileLike[]>(key, (current) => restoreRemovedLike(current, removed, laterIds));
                setActionError(`Your Like Back to ${r.profile.name} did not go through. Please try again.`);
              }).finally(() => {
                likeInflight.current.delete(id);
                setBusyId('');
              });
            }}
            className="flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground sm:flex-none">Like Back</button>
        </div>}
      </li>)}</ul>}
    <MatchCelebration visible={!!match} self={me.data ?? null} other={match?.profile ?? null} canMessage={!!match?.matchId}
      onMessage={() => { if (!match?.matchId) return; const matchId = match.matchId; setMatch(null); setLocation(`/chat/${encodeURIComponent(matchId)}?returnTo=%2Flikes&focusComposer=1`); }}
      onKeepSwiping={() => setMatch(null)} />
  </div></div>;
}

function FollowActionButton({ profileId, viewerId, isFollowing, followsYou, requestPendingByMe = false, onChange }: {
  profileId: string; viewerId?: string; isFollowing: boolean; followsYou: boolean; requestPendingByMe?: boolean; onChange?: (following: boolean) => void;
}) {
  const client = useQueryClient();
  const follow = useFollowProfile();
  const unfollow = useUnfollowProfile();
  const [override, setOverride] = useState<{ base: boolean; value: boolean } | null>(null);
  const [requestOverride, setRequestOverride] = useState<{ base: boolean; value: boolean } | null>(null);
  const [error, setError] = useState('');
  const following = override?.base === isFollowing ? override.value : isFollowing;
  const requested = requestOverride?.base === requestPendingByMe ? requestOverride.value : requestPendingByMe;
  const pending = follow.isPending || unfollow.isPending;
  async function toggle() {
    if (pending) return;
    setError('');
    const previous = following;
    const cancellingRequest = requested && !following;
    const next = cancellingRequest ? false : !following;
    const summaryKey = getGetProfileFollowSummaryQueryKey(profileId);
    const viewerKey = viewerId ? getGetProfileFollowSummaryQueryKey(viewerId) : null;
    const previousSummary = client.getQueryData<{ followersCount: number; followingCount: number; isFollowing: boolean; followsYou: boolean }>(summaryKey);
    const previousViewerSummary = viewerKey ? client.getQueryData<{ followersCount: number; followingCount: number; isFollowing: boolean; followsYou: boolean }>(viewerKey) : undefined;
    setOverride({ base: isFollowing, value: next });
    if (cancellingRequest) setRequestOverride({ base: requestPendingByMe, value: false });
    else if (previousSummary) client.setQueryData(summaryKey, {
        ...previousSummary,
        followersCount: Math.max(0, previousSummary.followersCount + (next ? 1 : -1)),
        isFollowing: next,
      });
    if (!cancellingRequest && viewerKey && previousViewerSummary) client.setQueryData(viewerKey, {
      ...previousViewerSummary,
      followingCount: Math.max(0, previousViewerSummary.followingCount + (next ? 1 : -1)),
    });
    try {
      if (next) {
        const result = await follow.mutateAsync({ profileId });
        client.setQueryData(summaryKey, result);
        setRequestOverride({ base: requestPendingByMe, value: result.requestPendingByMe });
      } else {
        await unfollow.mutateAsync({ profileId });
        if (cancellingRequest && previousSummary) client.setQueryData(summaryKey, { ...previousSummary, requestPendingByMe: false });
      }
      void Promise.all([
        client.invalidateQueries({ queryKey: summaryKey }),
        viewerKey ? client.invalidateQueries({ queryKey: viewerKey }) : Promise.resolve(),
        client.invalidateQueries({ queryKey: getGetProfileFollowersQueryKey() }),
        client.invalidateQueries({ queryKey: getGetProfileFollowingQueryKey() }),
        client.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
      ]);
      onChange?.(next);
    } catch {
      setOverride({ base: isFollowing, value: previous });
      if (previousSummary) client.setQueryData(summaryKey, previousSummary);
      if (viewerKey && previousViewerSummary) client.setQueryData(viewerKey, previousViewerSummary);
      setRequestOverride({ base: requestPendingByMe, value: requested });
      setError(cancellingRequest ? 'Could not cancel the request. Try again.' : next ? 'Could not follow. Try again.' : 'Could not unfollow. Try again.');
    }
  }
  return <div className="sh-follow-action">
    <button type="button" onClick={() => void toggle()} disabled={pending} aria-pressed={following}
      data-testid={`button-follow-${profileId}`} className={`sh-follow-button ${following ? 'sh-following' : ''}`}>
      <span className="inline-flex items-center justify-center gap-1.5">{pending&&<LoaderCircle size={13} className="animate-spin" aria-hidden="true"/>}{following ? 'Following' : requested ? 'Requested · Cancel' : followsYou ? 'Follow back' : 'Follow'}</span>
    </button>
    {error && <span role="alert" className="sh-follow-error">{error}</span>}
  </div>;
}

export function ProfileFollowNotificationAction({ profileId, viewerId, onFollow }: { profileId: string; viewerId?: string; onFollow: () => void }) {
  const summary = useGetProfileFollowSummary(profileId, { query: { queryKey: getGetProfileFollowSummaryQueryKey(profileId), refetchOnMount: 'always' } });
  if (!summary.data) return <button type="button" disabled aria-label="Loading follow status"
    className="sh-follow-button sh-follow-notice-loading"><QuietSpinner size={16} onRetry={() => void summary.refetch()} /></button>;
  if ((!summary.data.followsYou && !summary.data.requestPendingByMe) || summary.data.isFollowing) return null;
  return <FollowActionButton profileId={profileId} viewerId={viewerId} isFollowing={summary.data.isFollowing} followsYou={summary.data.followsYou}
    requestPendingByMe={summary.data.requestPendingByMe}
    onChange={following => { if (following) onFollow(); }} />;
}

export function ProfileSocialActions({ profileId, viewerId, showAction = true, compact = false, datingAction }: { profileId: string; viewerId?: string; showAction?: boolean; compact?: boolean; datingAction?: ReactNode }) {
  const summary = useGetProfileFollowSummary(profileId, { query: {
    queryKey: getGetProfileFollowSummaryQueryKey(profileId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  } });
  return <section className={`sh-profile-social${compact ? ' sh-profile-social-compact' : ''}`} data-testid="profile-follow-stats">
    <div className="sh-profile-stats">
      <div className="sh-profile-stat" data-testid="profile-match-count-stat" aria-label={`${summary.data?.matchCount ?? 0} matches`}>
        <strong>{summary.data?.matchCount ?? 0}</strong><span>Matches</span>
      </div>
      <Link href={`/profile/${profileId}/followers`} data-testid="link-profile-followers" className="sh-profile-stat">
        <strong>{summary.data?.followersCount ?? 0}</strong><span>Followers</span>
      </Link>
      <Link href={`/profile/${profileId}/following`} data-testid="link-profile-following" className="sh-profile-stat">
        <strong>{summary.data?.followingCount ?? 0}</strong><span>Following</span>
      </Link>
    </div>
    {showAction && viewerId && viewerId !== profileId && <div className="sh-profile-actions">
      <FollowActionButton
        profileId={profileId}
        viewerId={viewerId}
        isFollowing={summary.data?.isFollowing ?? false}
        followsYou={summary.data?.followsYou ?? false}
        requestPendingByMe={summary.data?.requestPendingByMe ?? false}
      />
      {datingAction}
    </div>}
  </section>;
}

type FollowEntry = ProfileFollowList['entries'][number];
function FollowListRow({ entry, profileId, viewerId, returnTo, avatar }: { entry: FollowEntry; profileId: string; viewerId?: string; returnTo: string; avatar: AvatarFn }) {
  const href = `/profile/${entry.profile.id}?returnTo=${encodeURIComponent(returnTo)}`;
  return <li className="sh-card flex items-center gap-3 rounded-[22px] p-3.5 md:p-4">
    <Link href={href} aria-label={`Open ${entry.profile.name}'s profile`} className="h-12 w-12 shrink-0 overflow-hidden rounded-full">{avatar(entry.profile)}</Link>
    <Link href={href} className="min-w-0 flex-1">
      <span className="block truncate text-[16px] font-bold">{entry.profile.name}</span>
      <span className="sh-muted block truncate text-xs">{[entry.profile.city, entry.profile.state, entry.profile.country].filter(Boolean).join(', ') || 'Location not shared'}</span>
    </Link>
    <FollowActionButton profileId={entry.profile.id} viewerId={viewerId} isFollowing={entry.isFollowing} followsYou={entry.followsYou} />
  </li>;
}

export function FollowListPage({ profileId, kind, avatar }: { profileId: string; kind: 'followers' | 'following'; avatar: AvatarFn }) {
  const me = useGetMyProfile();
  const [typedSearch, setTypedSearch] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState<FollowEntry[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(typedSearch.trim());
      setOffset(0);
      setEntries([]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [typedSearch]);
  const params = { profileId, limit: 30, offset, ...(search ? { search } : {}) };
  const followers = useGetProfileFollowers(params, { query: { queryKey: getGetProfileFollowersQueryKey(params), enabled: kind === 'followers' && !!profileId } });
  const following = useGetProfileFollowing(params, { query: { queryKey: getGetProfileFollowingQueryKey(params), enabled: kind === 'following' && !!profileId } });
  const q = kind === 'followers' ? followers : following;
  const data = q.data;
  useEffect(() => {
    if (!data) return;
    setEntries(current => offset === 0 ? data.entries : [
      ...current,
      ...data.entries.filter(entry => !current.some(item => item.profile.id === entry.profile.id)),
    ]);
  }, [data, offset]);
  const title = kind === 'followers' ? 'Followers' : 'Following';
  const returnTo = `/profile/${profileId}/${kind}`;
  return <div className="social-hub min-h-[calc(100dvh-48px)] lg:min-h-[100dvh]"><div className="page-in mx-auto max-w-[720px] px-4 pb-12 pt-6 md:px-8 md:pt-10">
    <Link href={`/profile/${profileId}`} data-testid="link-back-profile" className="sh-back mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold"><ArrowLeft size={16} aria-hidden="true" />Profile</Link>
    <Head title={title} sub={kind === 'followers' ? 'People who follow this profile' : 'Profiles this person follows'} />
    <label className="sh-search mb-5 flex items-center gap-2 rounded-2xl px-4 py-3">
      <Search size={17} aria-hidden="true" />
      <input aria-label={`Search ${title.toLowerCase()}`} data-testid={`input-search-${kind}`} value={typedSearch} onChange={e => setTypedSearch(e.target.value)} placeholder={`Search ${title.toLowerCase()}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
    </label>
    {q.isLoading && !data ? <Skel /> : q.isError && !data ? <Err text={`We couldn't load this ${kind} list.`} onRetry={() => void q.refetch()} />
      : !entries.length ? <Empty icon={<Users size={24} />} title={search ? 'No people found' : kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'} detail={search ? 'Try a different name.' : kind === 'followers' ? 'Followers will appear here.' : 'The profiles followed will appear here.'} />
      : <ul className="space-y-3">{entries.map(entry => <FollowListRow key={entry.profile.id} entry={entry} profileId={profileId} viewerId={me.data?.id} returnTo={returnTo} avatar={avatar} />)}</ul>}
    {data?.nextOffset !== null && data?.nextOffset !== undefined && <button type="button" data-testid="button-load-more-follows" disabled={q.isFetching}
      onClick={() => setOffset(data.nextOffset!)} className="sh-follow-more mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50">{q.isFetching ? <QuietSpinner size={18} /> : 'Load more'}</button>}
  </div></div>;
}

export function MutualMatchesPage(_props: { avatar: AvatarFn }) {
  const readNotice = useNoticeReader();
  const matches = useGetMatches({ query: { queryKey: getGetMatchesQueryKey(), ...live } });
  const seen = useMarkActivitySeen('matches', { ready: matches.isSuccess && !matches.isFetching });
  const stories = useGetStories({ query: { queryKey: getGetStoriesQueryKey(), refetchInterval: 60000 } });
  const list = useMemo(() => activeMatches(matches.data), [matches.data]);
  return <div className="social-hub min-h-[calc(100dvh-48px)] lg:min-h-[100dvh]"><div className="page-in mx-auto max-w-[720px] px-4 pb-12 pt-6 md:px-8 md:pt-10">
    <Head title="Matches" back />
    <SeenError seen={seen} />
    {matches.isLoading && !matches.data ? <Skel /> : matches.isError && !matches.data ? <Err text="We couldn't load your matches." onRetry={() => void matches.refetch()} />
      : !list.length ? <Link href="/discover" data-testid="link-empty-discover" className="inline-flex rounded-2xl bg-primary px-5 py-3 font-bold text-primary-foreground">Explore profiles</Link>
      : <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{list.map(m => <li key={m.id} data-testid={`card-match-${m.id}`} className="sh-card flex items-center gap-3 rounded-[22px] p-3.5">
        <MatchStoryAvatar matchId={m.id} profile={m.profile} storyGroup={stories.data?.mutualFollows.find(g => g.poster.id === m.profile.id)} returnTo="/matches" />
        <Link href={`/chat/${m.id}?returnTo=%2Fmatches`} onClick={() => readNotice(m.profile.id, 'new_match')} data-testid={`link-match-name-${m.id}`} className="min-w-0 flex-1 truncate text-[17px] font-bold">{m.profile.name}</Link>
        <Link href={`/chat/${m.id}?returnTo=%2Fmatches`} onClick={() => readNotice(m.profile.id, 'new_match')} data-testid={`link-match-chat-${m.id}`} aria-label={`Chat with ${m.profile.name}`} className="sh-chat flex h-11 w-11 shrink-0 items-center justify-center rounded-full"><MessageCircle size={20} aria-hidden="true" /></Link>
      </li>)}</ul>}
  </div></div>;
}
