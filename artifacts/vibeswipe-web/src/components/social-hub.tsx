import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Eye, Heart, MessageCircle, RefreshCw, Star, Users } from 'lucide-react';
import {
  getGetMatchesQueryKey, getGetNotificationsQueryKey, getGetStoriesQueryKey, getGetWhoLikedYouQueryKey, getGetWhoViewedYouQueryKey,
  useGetMatches, useGetNotifications, useGetStories, useGetWhoLikedYou, useGetWhoViewedYou, useMarkNotificationRead,
  createUseMarkActivitySeen,
} from '@workspace/api-client-react';
import type { Match, Profile } from '@workspace/api-client-react';
import { MatchStoryAvatar } from '@/components/stories/stories-ui';
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
  const matches = useGetMatches({ query: { queryKey: getGetMatchesQueryKey(), ...live } });
  const likes = useGetWhoLikedYou({ query: { queryKey: getGetWhoLikedYouQueryKey(), ...live } });
  const views = useGetWhoViewedYou({ query: { queryKey: getGetWhoViewedYouQueryKey(), ...live } });
  const mark = useMarkNotificationRead();
  const am = useMemo(() => activeMatches(matches.data), [matches.data]);
  const reelNotices = (notes.data?.notifications ?? []).filter(n => n.type === 'reel_like');
  const msgs = useMemo(() => (notes.data?.notifications ?? []).filter(n => n.type === 'new_message' && am.some(m => m.id === n.matchId && m.profile.id === n.actor.id)).slice(0, 8), [notes.data, am]);
  const superNotices = useMemo(() => (notes.data?.notifications ?? []).filter(n => n.type === 'new_super_like' && likes.data?.some(l => l.profile.id === n.actor.id && l.isSuperLike)).slice(0, 8), [notes.data, likes.data]);
  const openMsg = async (id: string, unread: boolean) => {
    if (unread) { try { await mark.mutateAsync({ notificationId: id }); } catch { /* still navigate */ } void qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }); }
    go('/messages');
  };
  const cards = [
    { key: 'matches', href: '/matches', label: 'Mutual Matches', sub: 'People you both said yes to', icon: <Users size={20} />, q: matches, n: am.length, ps: am.map(m => m.profile), badge: notes.data?.unreadCounts.matches ?? 0 },
    { key: 'likes', href: '/likes', label: 'Likes', sub: 'People who liked you', icon: <Heart size={20} fill="currentColor" />, q: likes, n: likes.data?.length ?? 0, ps: (likes.data ?? []).map(l => l.profile), badge: notes.data?.unreadCounts.likes ?? 0 },
    { key: 'views', href: '/views', label: 'Views', sub: 'People who viewed your profile', icon: <Eye size={20} />, q: views, n: views.data?.length ?? 0, ps: (views.data ?? []).map(v => v.profile), badge: notes.data?.unreadCounts.views ?? 0 },
  ];
  return <div className="social-hub min-h-[calc(100dvh-48px)] lg:min-h-[100dvh]"><div className="page-in mx-auto max-w-[720px] px-4 pb-12 pt-6 md:px-8 md:pt-10">
    <Head title="Activity" />
    {reelNotices.length > 0 && <section className="mb-4 space-y-2" aria-label="Reel likes">
      {reelNotices.map(n => <button key={n.id} type="button" data-testid={`reel-like-notice-${n.id}`}
        onClick={async () => {
          if (!n.readAt) {
            try { await mark.mutateAsync({ notificationId: n.id }); } catch { /* Keep the Reel reachable. */ }
            void qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
          }
          go(n.reelId ? `/reels/${n.reelId}?returnTo=%2Fnotifications` : `/profile/${n.actor.id}?returnTo=%2Fnotifications`);
        }}
        className="sh-card flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left">
        {avatar(n.actor)}<span className="min-w-0 flex-1 text-sm"><strong className="text-primary">{n.actor.name}</strong> liked your video</span>
        <time className="sh-muted text-xs" dateTime={n.createdAt}>{ago(n.createdAt)}</time>
        {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
      </button>)}
    </section>}
    <section aria-labelledby="sh-new-msgs">
      <h2 id="sh-new-msgs" className="sr-only">New messages</h2>
      {notes.isLoading ? <Skel /> : notes.isError && !notes.data ? <Err text="We couldn't load your activity." onRetry={() => void notes.refetch()} />
        : !msgs.length ? null
        : <ul className="space-y-2">{msgs.map(n => <li key={n.id}><button onClick={() => void openMsg(n.id, !n.readAt)} disabled={mark.isPending} data-testid={`button-message-notice-${n.id}`} aria-label={`New message from ${n.actor.name}. Open Messages`} className="sh-card flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left transition-transform hover:-translate-y-px">
          <MessageCircle size={18} className="shrink-0 text-primary" aria-hidden="true" />
          <span className={`min-w-0 flex-1 truncate text-sm ${n.readAt ? 'sh-muted' : 'font-semibold'}`}>{n.actor.name} sent you a message</span>
          <time className="sh-muted shrink-0 text-xs" dateTime={n.createdAt}>{ago(n.createdAt)}</time>
          {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
        </button></li>)}</ul>}
    </section>
    {superNotices.length > 0 && <section className="mt-3 space-y-3" aria-label="Super Likes">
      {superNotices.map(n => <Link key={n.id} href={`/profile/${n.actor.id}?returnTo=%2Fnotifications`} onClick={() => readNotice(n.actor.id, 'new_like')} data-testid={`super-like-notice-${n.id}`} className="sh-card flex items-center gap-3 rounded-[22px] border-primary/30 p-4">
        <span className="sh-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-full"><Star size={22} fill="currentColor" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><span className="block truncate font-bold">{n.actor.name}</span><span className="text-sm font-semibold text-primary">Super Liked you</span></span>
        <time className="sh-muted shrink-0 text-xs" dateTime={n.createdAt}>{ago(n.createdAt)}</time>
        {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
        <ChevronRight size={17} className="text-primary" aria-hidden="true" />
      </Link>)}
    </section>}
    <section className="mt-8 space-y-3" aria-label="Summary">
      {cards.map(c => <Link key={c.key} href={c.href} data-testid={`link-summary-${c.key}`} aria-label={`${c.label}, ${c.badge} new`} className="sh-card flex items-center gap-4 rounded-[24px] p-4 transition-transform hover:-translate-y-px md:p-5">
        <div className="sh-icon relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">{c.icon}{c.badge > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">{c.badge > 99 ? '99+' : c.badge}</span>}</div>
        <div className="min-w-0 flex-1"><div className="text-[17px] font-bold">{c.label}</div><div className="sh-muted truncate text-sm">{c.q.isLoading ? 'Loading' : c.q.isError ? 'Unavailable right now' : c.sub}</div></div>
        {c.ps.length > 0 && <div className="hidden sm:block"><Stack profiles={c.ps} avatar={avatar} /></div>}
        <span className="text-xl font-extrabold tabular-nums" data-testid={`text-count-${c.key}`}>{c.q.isLoading ? '-' : c.badge}</span>
        <ChevronRight size={18} className="sh-muted" aria-hidden="true" />
      </Link>)}
    </section>
  </div></div>;
}

export function InboundPeoplePage({ avatar, kind }: { avatar: AvatarFn; kind: 'likes' | 'views' }) {
  const isLikes = kind === 'likes';
  const readNotice = useNoticeReader();
  const likes = useGetWhoLikedYou({ query: { queryKey: getGetWhoLikedYouQueryKey(), enabled: isLikes, ...live } });
  const views = useGetWhoViewedYou({ query: { queryKey: getGetWhoViewedYouQueryKey(), enabled: !isLikes, ...live } });
  const q = isLikes ? likes : views;
  const seen = useMarkActivitySeen(kind, { ready: q.isSuccess && !q.isFetching });
  const rows = useMemo(() => isLikes ? (likes.data ?? []).map(l => ({ profile: l.profile, at: l.likedAt, isSuperLike: l.isSuperLike })) : (views.data ?? []).map(v => ({ profile: v.profile, at: v.viewedAt, isSuperLike: false })), [isLikes, likes.data, views.data]);
  const rt = isLikes ? '%2Flikes' : '%2Fviews';
  return <div className="social-hub min-h-[calc(100dvh-48px)] lg:min-h-[100dvh]"><div className="page-in mx-auto max-w-[720px] px-4 pb-12 pt-6 md:px-8 md:pt-10">
    <Head back title={isLikes ? 'Likes' : 'Views'} sub={isLikes ? 'People who liked you' : 'People who viewed your profile'} />
    <SeenError seen={seen} />
    {q.isLoading ? <Skel /> : q.isError && !q.data ? <Err text={`We couldn't load your ${kind}.`} onRetry={() => void q.refetch()} />
      : !rows.length ? <Empty icon={isLikes ? <Heart size={24} fill="currentColor" /> : <Eye size={24} />} title={isLikes ? 'No likes yet' : 'No views yet'} detail={isLikes ? 'When someone likes you, they show up here.' : 'When someone opens your profile, they show up here.'} />
      : <ul className="space-y-3">{rows.map(r => <li key={`${r.profile.id}-${r.at}`}><Link href={`/profile/${r.profile.id}?returnTo=${rt}`} onClick={() => readNotice(r.profile.id, isLikes ? 'new_like' : 'profile_view')} data-testid={`link-${kind}-profile-${r.profile.id}`} aria-label={`View ${r.profile.name}'s profile`} className="sh-card flex items-center gap-4 rounded-[22px] p-3.5 transition-transform hover:-translate-y-px md:p-4">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full">{avatar(r.profile)}</div>
        <div className="min-w-0 flex-1"><div className="truncate text-[17px] font-bold">{r.profile.name}{r.profile.age !== null && r.profile.showAge !== false ? `, ${r.profile.age}` : ''}</div><div className="sh-muted text-sm">{isLikes ? (r.isSuperLike ? 'Super Liked you' : 'Liked you') : 'Viewed your profile'} <span aria-hidden="true">·</span> <time dateTime={r.at}>{ago(r.at)}</time></div></div>
        {isLikes ? (r.isSuperLike ? <Star size={22} fill="currentColor" className="shrink-0 text-primary" aria-hidden="true" /> : <Heart size={22} fill="currentColor" className="shrink-0 text-primary" aria-hidden="true" />) : <span className="sh-pill inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"><Eye size={15} aria-hidden="true" />View</span>}
      </Link></li>)}</ul>}
  </div></div>;
}

export function MutualMatchesPage(_props: { avatar: AvatarFn }) {
  const readNotice = useNoticeReader();
  const matches = useGetMatches({ query: { queryKey: getGetMatchesQueryKey(), ...live } });
  const seen = useMarkActivitySeen('matches', { ready: matches.isSuccess && !matches.isFetching });
  const stories = useGetStories({ query: { queryKey: getGetStoriesQueryKey(), refetchInterval: 60000 } });
  const list = useMemo(() => activeMatches(matches.data), [matches.data]);
  return <div className="social-hub min-h-[calc(100dvh-48px)] lg:min-h-[100dvh]"><div className="page-in mx-auto max-w-[720px] px-4 pb-12 pt-6 md:px-8 md:pt-10">
    <Head title="Matches" />
    <SeenError seen={seen} />
    {matches.isLoading ? <Skel /> : matches.isError && !matches.data ? <Err text="We couldn't load your matches." onRetry={() => void matches.refetch()} />
      : !list.length ? <Link href="/discover" data-testid="link-empty-discover" className="inline-flex rounded-2xl bg-primary px-5 py-3 font-bold text-primary-foreground">Explore profiles</Link>
      : <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{list.map(m => <li key={m.id} data-testid={`card-match-${m.id}`} className="sh-card flex items-center gap-3 rounded-[22px] p-3.5">
        <MatchStoryAvatar matchId={m.id} profile={m.profile} storyGroup={stories.data?.matches.find(g => g.matchId === m.id)} returnTo="/matches" />
        <Link href={`/chat/${m.id}?returnTo=%2Fmatches`} onClick={() => readNotice(m.profile.id, 'new_match')} data-testid={`link-match-name-${m.id}`} className="min-w-0 flex-1 truncate text-[17px] font-bold">{m.profile.name}{m.profile.age !== null && m.profile.showAge !== false ? `, ${m.profile.age}` : ''}</Link>
        <Link href={`/chat/${m.id}?returnTo=%2Fmatches`} onClick={() => readNotice(m.profile.id, 'new_match')} data-testid={`link-match-chat-${m.id}`} aria-label={`Chat with ${m.profile.name}`} className="sh-chat flex h-11 w-11 shrink-0 items-center justify-center rounded-full"><MessageCircle size={20} aria-hidden="true" /></Link>
      </li>)}</ul>}
  </div></div>;
}
