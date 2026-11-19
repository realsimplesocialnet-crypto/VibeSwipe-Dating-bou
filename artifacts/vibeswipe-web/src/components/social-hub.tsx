import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Eye, Heart, LoaderCircle, MessageCircle, RefreshCw, Search, Star, Users, UserPlus } from 'lucide-react';
import {
  getGetMatchesQueryKey, getGetNotificationsQueryKey, getGetProfileFollowSummaryQueryKey, getGetProfileFollowersQueryKey,
  getGetProfileFollowingQueryKey, getGetStoriesQueryKey, getGetWhoLikedYouQueryKey, getGetWhoViewedYouQueryKey,
  useCreateReaction, useFollowProfile, useGetMatches, useGetMyProfile, useGetNotifications, useGetProfileFollowSummary,
  useGetProfileFollowers, useGetProfileFollowing, useGetStories, useGetWhoLikedYou, useGetWhoViewedYou,
  useMarkNotificationRead, useUnfollowProfile,
  createUseMarkActivitySeen,
} from '@workspace/api-client-react';
import type { Match, Profile, ProfileFollowList } from '@workspace/api-client-react';
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
  return <div className="space-y-3" aria-label="Loading">{[0, 1, 2].map(i => <div key={i} className="sh-card flex items-center gap-4 rounded-[22px] p-4"><div className="h-14 w-14 animate-pulse rounded-full bg-muted" /><div className="flex-1 space-y-2"><div className="h-4 w-32 animate-pulse rounded bg-muted" /><div className="h-3 w-24 animate-pulse rounded bg-muted" /></div></div>)}</div>;
}
function Err({ onRetry, text }: { onRetry: () => void; text: string }) {
  return <div className="sh-card rounded-[22px] p-6 text-center" role="alert"><p className="sh-muted text-sm">{text}</p><button onClick={onRetry} data-testid="button-retry" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><RefreshCw size={15} aria-hidden="true" />Try again</button></div>;
}
function Empty({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="sh-card flex flex-col items-center rounded-[26px] px-6 py-12 text-center" data-testid="status-empty"><div className="sh-icon mb-4 flex h-14 w-14 items-center justify-center rounded-full">{icon}</div><h2 className="text-lg font-bold">{title}</h2><p className="sh-muted mt-1 max-w-xs text-sm">{detail}</p><Link href="/discover" data-testid="link-empty-discover" className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Go to Discover</Link></div>;
}
function Stack({ profiles, avatar }: { profiles: Profile[]; avatar: AvatarFn }) {
  return <div className="flex -space-x-3">{profiles.slice(0, 3).map(p => <div key={p.id} className="sh-stack h-10 w-10 overflow-hidden rounded-full">{avatar(p)}</div>)}</div>;
}

export function ActivityOverview({ avatar }: { avatar: AvatarFn }) {
  const readNotice = useNoticeReader();
  const qc = useQueryClient();
  const [, go] = useLocation();
  const notes = useGetNotifications({ query: { queryKey: getGetNotificationsQueryKey(), ...live } });
  const me = useGetMyProfile();
  const followSummary = useGetProfileFollowSummary(me.data?.id ?? '', { query: { enabled: !!me.data?.id, refetchInterval: 15000 } });
  const matches = useGetMatches({ query: { queryKey: getGetMatchesQueryKey(), ...live } });
  const likes = useGetWhoLikedYou({ query: { queryKey: getGetWhoLikedYouQueryKey(), ...live } });
  const views = useGetWhoViewedYou({ query: { queryKey: getGetWhoViewedYouQueryKey(), ...live } });
  const mark = useMarkNotificationRead();
  const am = useMemo(() => activeMatches(matches.data), [matches.data]);
  const reelNotices = (notes.data?.notifications ?? []).filter(n => n.type === 'reel_like' || n.type === 'reel_comment_reply');
  const followNotices = (notes.data?.notifications ?? []).filter(n => n.type === 'new_follow').slice(0, 8);
  const superNotices = useMemo(() => (notes.data?.notifications ?? []).filter(n => n.type === 'new_super_like').slice(0, 8), [notes.data]);
  const cards = [
    { key: 'matches', href: '/matches', label: 'Matches', sub: 'People you both liked — open to chat', icon: <Users size={20} />, q: matches, n: am.length, ps: am.map(m => m.profile), badge: notes.data?.unreadCounts.matches ?? 0 },
    { key: 'likes', href: '/likes', label: 'Likes', sub: 'People who liked you', icon: <Heart size={20} fill="currentColor" />, q: likes, n: likes.data?.length ?? 0, ps: (likes.data ?? []).map(l => l.profile), badge: notes.data?.unreadCounts.likes ?? 0 },
    { key: 'views', href: '/views', label: 'Views', sub: 'People who viewed your profile', icon: <Eye size={20} />, q: views, n: views.data?.length ?? 0, ps: (views.data ?? []).map(v => v.profile), badge: notes.data?.unreadCounts.views ?? 0 },
  ];
  return <div className="social-hub min-h-[calc(100dvh-48px)] lg:min-h-[100dvh]"><div className="page-in mx-auto max-w-[720px] px-4 pb-12 pt-6 md:px-8 md:pt-10">
    <Head title="Activity" />
    <section className="mb-6 space-y-3" aria-label="Summary" data-testid="activity-summary">
      {cards.map(c => <Link key={c.key} href={c.href} data-testid={`link-summary-${c.key}`} aria-label={`${c.label}, ${c.badge} new`} className="sh-card flex items-center gap-4 rounded-[24px] p-4 transition-transform hover:-translate-y-px md:p-5">
        <div className="sh-icon relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">{c.icon}{c.badge > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">{c.badge > 99 ? '99+' : c.badge}</span>}</div>
        <div className="min-w-0 flex-1"><div className="text-[17px] font-bold">{c.label}</div><div className="sh-muted truncate text-sm">{c.q.isLoading ? 'Loading' : c.q.isError ? 'Unavailable right now' : c.sub}</div></div>
        {c.ps.length > 0 && <div className="hidden sm:block"><Stack profiles={c.ps} avatar={avatar} /></div>}
        <span className="text-xl font-extrabold tabular-nums" data-testid={`text-count-${c.key}`}>{c.q.isLoading ? '-' : c.badge}</span>
        <ChevronRight size={18} className="sh-muted" aria-hidden="true" />
      </Link>)}
      {me.data?.id && <Link href={`/profile/${me.data.id}/followers`} data-testid="link-summary-followers" aria-label={`${followSummary.data?.followersCount ?? 0} followers`}
        className="sh-card flex items-center gap-4 rounded-[24px] p-4 transition-transform hover:-translate-y-px md:p-5">
        <div className="sh-icon relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
          <UserPlus size={20} aria-hidden="true" />
          {(notes.data?.unreadCounts.follows ?? 0) > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">{(notes.data?.unreadCounts.follows ?? 0) > 99 ? '99+' : notes.data?.unreadCounts.follows}</span>}
        </div>
        <div className="min-w-0 flex-1"><div className="text-[17px] font-bold">Followers</div><div className="sh-muted truncate text-sm">People following you</div></div>
        <span className="text-xl font-extrabold tabular-nums">{followSummary.data?.followersCount ?? (followSummary.isLoading ? '-' : 0)}</span>
        <ChevronRight size={18} className="sh-muted" aria-hidden="true" />
      </Link>}
    </section>
    {notes.isLoading ? <Skel /> : notes.isError && !notes.data ? <Err text="We couldn't load your activity." onRetry={() => void notes.refetch()} /> : null}
    {followNotices.length > 0 && <section className="mb-5" aria-label="New followers">
      <h2 className="mb-2 px-1 text-base font-bold">New followers</h2>
      <div className="space-y-1">
      {followNotices.map(n => <div key={n.id} data-testid={`follow-notice-${n.id}`}
        className="sh-follow-notice-row flex w-full items-center gap-3 py-2.5 text-left">
        <button type="button" onClick={async () => {
          if (!n.readAt) {
            try { await mark.mutateAsync({ notificationId: n.id }); } catch { /* Keep the profile reachable. */ }
            void qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
          }
          go(`/profile/${n.actor.id}?returnTo=%2Fnotifications`);
        }} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${n.actor.name} started following you. Open profile`}>
          {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-[#55cbe5]" aria-label="Unread" />}
          <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full">
            {avatar(n.actor)}
          </div>
          <span className="min-w-0 flex-1 text-sm">
            <strong className="block truncate text-foreground">{n.actor.name}</strong>
            <span className="sh-muted block truncate">started following you. <time dateTime={n.createdAt}>{ago(n.createdAt)}</time></span>
          </span>
        </button>
        <div className="sh-follow-notice-actions">
          <ProfileFollowNotificationAction profileId={n.actor.id} viewerId={me.data?.id} onFollow={() => {
            if (!n.readAt) void mark.mutateAsync({ notificationId: n.id }).catch(() => undefined).finally(() => qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }));
          }} />
        </div>
      </div>)}
      </div>
    </section>}
    {reelNotices.length > 0 && <section className="mb-4 space-y-2" aria-label="Reel likes">
      {reelNotices.map(n => <button key={n.id} type="button" data-testid={`reel-like-notice-${n.id}`}
        onClick={async () => {
          if (!n.readAt) {
            try { await mark.mutateAsync({ notificationId: n.id }); } catch { /* Keep the Reel reachable. */ }
            void qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
          }
          if (n.reelId) {
            const params = new URLSearchParams({ returnTo: '/notifications' });
            if (n.type === 'reel_comment_reply' && n.commentId) params.set('commentId', n.commentId);
            go(`/reels/${n.reelId}?${params.toString()}`);
          } else go(`/profile/${n.actor.id}?returnTo=%2Fnotifications`);
        }}
        className="sh-card flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left">
        {avatar(n.actor)}<span className="min-w-0 flex-1 text-sm"><strong className="text-primary">{n.actor.name}</strong> {n.type === 'reel_comment_reply' ? 'replied to your comment' : 'liked your video'}</span>
        <time className="sh-muted text-xs" dateTime={n.createdAt}>{ago(n.createdAt)}</time>
        {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
      </button>)}
    </section>}
    {superNotices.length > 0 && <section className="mt-3 space-y-3" aria-label="Super Likes">
      {superNotices.map(n => <Link key={n.id} href={`/profile/${n.actor.id}?returnTo=%2Fnotifications`} onClick={() => readNotice(n.actor.id, 'new_like')} data-testid={`super-like-notice-${n.id}`} className="sh-card flex items-center gap-3 rounded-[22px] border-primary/30 p-4">
        <span className="sh-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-full"><Star size={22} fill="currentColor" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><span className="block truncate font-bold">{n.actor.name}</span><span className="text-sm font-semibold text-primary">Super Liked you</span></span>
        <time className="sh-muted shrink-0 text-xs" dateTime={n.createdAt}>{ago(n.createdAt)}</time>
        {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
        <ChevronRight size={17} className="text-primary" aria-hidden="true" />
      </Link>)}
    </section>}
  </div></div>;
}

export function InboundPeoplePage({ avatar, kind }: { avatar: AvatarFn; kind: 'likes' | 'views' }) {
  const isLikes = kind === 'likes';
  const readNotice = useNoticeReader();
  const likes = useGetWhoLikedYou({ query: { queryKey: getGetWhoLikedYouQueryKey(), enabled: isLikes, ...live } });
  const views = useGetWhoViewedYou({ query: { queryKey: getGetWhoViewedYouQueryKey(), enabled: !isLikes, ...live } });
  const me = useGetMyProfile();
  const reaction = useCreateReaction();
  const [match, setMatch] = useState<{ profile: Profile; matchId: string | null } | null>(null);
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const qc = useQueryClient();
  const q = isLikes ? likes : views;
  const seen = useMarkActivitySeen(kind, { ready: q.isSuccess && !q.isFetching });
  const rows = useMemo(() => isLikes ? (likes.data ?? []).map(l => ({ profile: l.profile, at: l.likedAt, isSuperLike: l.isSuperLike })) : (views.data ?? []).map(v => ({ profile: v.profile, at: v.viewedAt, isSuperLike: false })), [isLikes, likes.data, views.data]);
  const rt = isLikes ? '%2Flikes' : '%2Fviews';
  return <div className="social-hub min-h-[calc(100dvh-48px)] lg:min-h-[100dvh]"><div className="page-in mx-auto max-w-[720px] px-4 pb-12 pt-6 md:px-8 md:pt-10">
    <Head back title={isLikes ? 'Dating Likes' : 'Views'} sub={isLikes ? 'People who liked your profile' : 'People who viewed your profile'} />
    <SeenError seen={seen} />
    {actionError && <p role="alert" className="mb-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm">{actionError}</p>}
    {q.isLoading ? <Skel /> : q.isError && !q.data ? <Err text={`We couldn't load your ${kind}.`} onRetry={() => void q.refetch()} />
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
          <div className="min-w-0 flex-1"><div className="truncate text-[17px] font-bold">{r.profile.name}{r.profile.age !== null && r.profile.showAge !== false ? `, ${r.profile.age}` : ''}</div><div className="sh-muted text-sm">{isLikes ? (r.isSuperLike ? 'Super Liked your profile' : 'Liked your profile') : 'Viewed your profile'} <span aria-hidden="true">·</span> <time dateTime={r.at}>{ago(r.at)}</time></div></div>
          {isLikes ? (r.isSuperLike ? <Star size={22} fill="currentColor" className="shrink-0 text-primary" aria-hidden="true" /> : <Heart size={22} fill="currentColor" className="shrink-0 text-primary" aria-hidden="true" />) : <span className="sh-pill inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"><Eye size={15} aria-hidden="true" />View</span>}
        </Link>
        {isLikes && <div className="flex w-full gap-2 pl-[4.5rem] sm:w-auto sm:pl-0">
          <button type="button" disabled={reaction.isPending || busyId === r.profile.id} data-testid={`button-pass-like-${r.profile.id}`}
            onClick={async () => {
              setBusyId(r.profile.id); setActionError('');
              try {
                await reaction.mutateAsync({ data: { toUserId: r.profile.id, type: 'pass' } });
                await Promise.all([
                  qc.invalidateQueries({ queryKey: getGetWhoLikedYouQueryKey() }),
                  qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
                ]);
              } catch { setActionError(`Your pass on ${r.profile.name} did not save. Please try again.`); }
              finally { setBusyId(''); }
            }}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-muted-foreground disabled:opacity-50">Pass</button>
          <button type="button" disabled={reaction.isPending || busyId === r.profile.id} data-testid={`button-like-back-${r.profile.id}`}
            onClick={async () => {
              setBusyId(r.profile.id); setActionError('');
              try {
                const result = await reaction.mutateAsync({ data: { toUserId: r.profile.id, type: 'like' } });
                await Promise.all([
                  qc.invalidateQueries({ queryKey: getGetWhoLikedYouQueryKey() }),
                  qc.invalidateQueries({ queryKey: getGetMatchesQueryKey() }),
                  qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
                ]);
                if (result.matched) setMatch({ profile: r.profile, matchId: result.matchId ?? null });
                else setActionError(`Your like to ${r.profile.name} was sent.`);
              } catch { setActionError(`Your Like Back to ${r.profile.name} did not go through. Please try again.`); }
              finally { setBusyId(''); }
            }}
            className="flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground sm:flex-none">Like Back</button>
        </div>}
      </li>)}</ul>}
    <MatchCelebration visible={!!match} self={me.data ?? null} other={match?.profile ?? null} canMessage={!!match?.matchId}
      onMessage={() => { if (!match?.matchId) return; const matchId = match.matchId; setMatch(null); window.location.assign(`/chat/${encodeURIComponent(matchId)}?returnTo=%2Flikes&focusComposer=1`); }}
      onKeepSwiping={() => setMatch(null)} />
  </div></div>;
}

function FollowActionButton({ profileId, viewerId, isFollowing, followsYou, requestPendingByMe = false, checking = false, onChange }: {
  profileId: string; viewerId?: string; isFollowing: boolean; followsYou: boolean; requestPendingByMe?: boolean; checking?: boolean; onChange?: (following: boolean) => void;
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
    <button type="button" onClick={() => void toggle()} disabled={pending || checking} aria-pressed={following}
      data-testid={`button-follow-${profileId}`} className={`sh-follow-button ${following ? 'sh-following' : ''}`}>
      {checking ? 'Checking…' : <span className="inline-flex items-center justify-center gap-1.5">{pending&&<LoaderCircle size={13} className="animate-spin" aria-hidden="true"/>}{following ? 'Following' : requested ? 'Requested · Cancel' : followsYou ? 'Follow back' : 'Follow'}</span>}
    </button>
    {error && <span role="alert" className="sh-follow-error">{error}</span>}
  </div>;
}

export function ProfileFollowNotificationAction({ profileId, viewerId, onFollow }: { profileId: string; viewerId?: string; onFollow: () => void }) {
  const summary = useGetProfileFollowSummary(profileId, { query: { queryKey: getGetProfileFollowSummaryQueryKey(profileId), refetchOnMount: 'always' } });
  if (!summary.data) return <button type="button" disabled={summary.isLoading} onClick={() => void summary.refetch()} aria-label={summary.isError ? 'Retry follow status' : 'Checking follow status'}
    className="sh-follow-button sh-follow-notice-loading">{summary.isError ? 'Retry' : <LoaderCircle size={15} className="animate-spin"/>}</button>;
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
    refetchOnMount: 'always',
  } });
  return <section className={`sh-profile-social${compact ? ' sh-profile-social-compact' : ''}`} data-testid="profile-follow-stats">
    <div className="sh-profile-stats">
      <Link href={`/profile/${profileId}/followers`} data-testid="link-profile-followers" className="sh-profile-stat">
        <strong>{summary.data?.followersCount ?? (summary.isError ? '—' : <span className="inline-block h-5 w-8 animate-pulse rounded bg-current/10 align-middle" aria-label="Loading followers"/>)}</strong><span>Followers</span>
      </Link>
      <Link href={`/profile/${profileId}/following`} data-testid="link-profile-following" className="sh-profile-stat">
        <strong>{summary.data?.followingCount ?? (summary.isError ? '—' : <span className="inline-block h-5 w-8 animate-pulse rounded bg-current/10 align-middle" aria-label="Loading following"/>)}</strong><span>Following</span>
      </Link>
    </div>
    {showAction && viewerId && viewerId !== profileId && <div className="sh-profile-actions">
      {summary.data ? <FollowActionButton profileId={profileId} viewerId={viewerId} isFollowing={summary.data.isFollowing} followsYou={summary.data.followsYou} requestPendingByMe={summary.data.requestPendingByMe} checking={summary.isFetching} />
        : <button type="button" disabled aria-label={summary.isError ? 'Follow status unavailable' : 'Loading follow status'} className="sh-follow-button">{summary.isError ? 'Unavailable' : <><LoaderCircle size={15} className="animate-spin"/><span>Checking…</span></>}</button>}
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
      <span className="block truncate text-[16px] font-bold">{entry.profile.name}{entry.profile.age !== null && entry.profile.showAge !== false ? `, ${entry.profile.age}` : ''}</span>
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
      onClick={() => setOffset(data.nextOffset!)} className="sh-follow-more mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50">{q.isFetching ? 'Loading…' : 'Load more'}</button>}
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
    {matches.isLoading ? <Skel /> : matches.isError && !matches.data ? <Err text="We couldn't load your matches." onRetry={() => void matches.refetch()} />
      : !list.length ? <Link href="/discover" data-testid="link-empty-discover" className="inline-flex rounded-2xl bg-primary px-5 py-3 font-bold text-primary-foreground">Explore profiles</Link>
      : <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{list.map(m => <li key={m.id} data-testid={`card-match-${m.id}`} className="sh-card flex items-center gap-3 rounded-[22px] p-3.5">
        <MatchStoryAvatar matchId={m.id} profile={m.profile} storyGroup={stories.data?.mutualFollows.find(g => g.poster.id === m.profile.id)} returnTo="/matches" />
        <Link href={`/chat/${m.id}?returnTo=%2Fmatches`} onClick={() => readNotice(m.profile.id, 'new_match')} data-testid={`link-match-name-${m.id}`} className="min-w-0 flex-1 truncate text-[17px] font-bold">{m.profile.name}{m.profile.age !== null && m.profile.showAge !== false ? `, ${m.profile.age}` : ''}</Link>
        <Link href={`/chat/${m.id}?returnTo=%2Fmatches`} onClick={() => readNotice(m.profile.id, 'new_match')} data-testid={`link-match-chat-${m.id}`} aria-label={`Chat with ${m.profile.name}`} className="sh-chat flex h-11 w-11 shrink-0 items-center justify-center rounded-full"><MessageCircle size={20} aria-hidden="true" /></Link>
      </li>)}</ul>}
  </div></div>;
}
