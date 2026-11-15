import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Eye, MessageSquare, RefreshCw } from 'lucide-react';
import { useAdminData } from '../admin-hooks';
import { ago, EmptyState, ErrorBox, Pill, Skeleton, UserMark, utc } from '../admin-ui';
import { useAdminPosts } from './posts';
import { LiveDot, SectionHeader, Stat, useDrawers } from '../section-kit';

const POLL = 10_000;

function Panel({ title, meta, link, testId, children }: { title: string; meta?: ReactNode; link?: [string, string]; testId: string; children: ReactNode }) {
  return <section className="a-panel flex min-w-0 flex-col overflow-hidden" data-testid={testId}>
    <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5">
      <h2 className="text-sm font-extrabold">{title}</h2>
      <div className="flex items-center gap-3 text-[11px] text-[var(--a-mute)]">
        {meta}
        {link && <Link href={link[0]} data-testid={`link-${testId}-all`} className="inline-flex items-center gap-1 font-bold hover:text-[var(--a-rose)]">{link[1]}<ArrowRight size={12} /></Link>}
      </div>
    </header>
    <div className="max-h-[420px] min-h-[140px] overflow-y-auto xl:max-h-[220px]">{children}</div>
  </section>;
}

function InspectBtn({ onClick, testId, label = 'Inspect' }: { onClick: () => void; testId: string; label?: string }) {
  return <button type="button" onClick={onClick} data-testid={testId} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-[var(--a-line)] px-2 text-[11px] font-bold hover:border-[#f34e9a]/50 hover:text-[#ff8cc0]">
    <Eye size={12} />{label}
  </button>;
}

export function OverviewSection() {
  const q = useAdminData({ section: 'overview' }, { poll: POLL });
  const on = useAdminData({ section: 'online' }, { poll: POLL });
  const posts = useAdminPosts({ page: 1 });
  const recentPosts = (posts.data?.posts ?? []).slice(0, 6);
  const { openUser, openChat } = useDrawers();
  const s = q.data?.stats;
  const refreshedAt = q.dataUpdatedAt ? new Date(q.dataUpdatedAt) : null;
  const refresh = () => { void q.refetch(); void on.refetch(); void posts.refetch(); };
  const onlineStale = on.isError;
  const users = q.data?.users ?? [];
  const chats = q.data?.chats ?? [];
  const online = on.data?.users ?? [];

  return <div>
    <SectionHeader eyebrow="Overview" title="Command overview" detail="Members, presence, conversations and activity in one view. Polls every 10 seconds."
      right={<div className="flex flex-wrap items-center gap-2">
        <span className="mono text-[11px] text-[var(--a-mute)]" data-testid="text-last-refresh" title={refreshedAt ? refreshedAt.toISOString() : ''}>
          {refreshedAt ? `Updated ${refreshedAt.toLocaleTimeString()}` : 'Not loaded yet'}
        </span>
        <button type="button" onClick={refresh} disabled={q.isFetching || on.isFetching || posts.isFetching} data-testid="button-refresh-overview" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--a-line)] px-3 text-[11px] font-bold uppercase tracking-[.1em] hover:bg-white/5 disabled:opacity-60">
          <RefreshCw size={12} className={q.isFetching || on.isFetching || posts.isFetching ? 'animate-spin' : ''} />Refresh
        </button>
        <LiveDot fetching={q.isFetching || on.isFetching || posts.isFetching} label={q.isError || onlineStale ? 'Degraded' : 'Live'} />
      </div>} />

    {q.isError && !q.data ? <div className="a-panel"><ErrorBox error={q.error} onRetry={() => void q.refetch()} text="Overview could not load." /></div> : <>
      {q.isError && <div className="mb-3 rounded-xl border border-[#f6c987]/30 bg-[#f6c987]/10 px-4 py-2 text-xs text-[#f6c987]" data-testid="status-overview-stale">Latest refresh failed. Showing data from {refreshedAt ? refreshedAt.toLocaleTimeString() : 'earlier'}.</div>}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {!s ? Array.from({ length: 6 }, (_, i) => <div key={i} className="a-skel h-[104px]" />) : <>
          <Stat testId="stat-total-users" label="Members" value={s.totalUsers.toLocaleString()} hint="All registered profiles" />
          <Stat testId="stat-online-users" label="Online now" value={s.onlineUsers.toLocaleString()} tone="mint" hint="Presence heartbeat" />
          <Stat testId="stat-active-chats" label="Active chats" value={s.activeChats.toLocaleString()} tone="rose" hint="With messages since 00:00 UTC" />
          <Stat testId="stat-signups-today" label="Signups today" value={s.signupsToday.toLocaleString()} tone="amber" hint="Since 00:00 UTC" />
          <Stat testId="stat-total-matches" label="Mutual matches" value={s.totalMatches.toLocaleString()} hint="Both liked each other" />
          <Stat testId="stat-pending-likes" label="Pending likes" value={s.pendingLikes.toLocaleString()} hint="One-way, not returned" />
        </>}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Online members" testId="panel-online" link={['/admin/online', 'All online']}
          meta={onlineStale ? <Pill tone="amber">Unconfirmed</Pill> : on.data ? <span className="mono">{online.length} shown</span> : null}>
          {on.isError && !on.data ? <ErrorBox error={on.error} onRetry={() => void on.refetch()} text="Presence could not load." /> :
            !on.data ? <Skeleton rows={5} /> : online.length === 0 ? <EmptyState title="Nobody online" detail="Members appear here while their app sends a presence heartbeat." /> :
            <ul>{online.map(u => <li key={u.id} className="a-row flex items-center gap-3 px-4 py-2" data-testid={`row-online-${u.id}`}>
              <UserMark name={u.name} online={!onlineStale && u.online} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{u.name}<span className="ml-1.5 font-normal text-[var(--a-mute)]">{u.age}</span></div>
                <div className="truncate text-[11px] text-[var(--a-mute)]">{[u.city, u.country].filter(Boolean).join(', ')}{onlineStale ? ` · last seen ${ago(u.lastSeenAt)}` : ''}</div>
              </div>
              <InspectBtn onClick={() => openUser(u.id)} testId={`button-inspect-online-${u.id}`} />
            </li>)}</ul>}
        </Panel>

        <Panel title="Recent accounts" testId="panel-recent-users" link={['/admin/users', 'All members']} meta={q.data ? <span className="mono">{users.length} newest</span> : null}>
          {!q.data ? <Skeleton rows={5} /> : users.length === 0 ? <EmptyState title="No accounts yet" detail="New signups land here first for review." /> :
            <ul>{users.map(u => <li key={u.id} className="a-row flex items-center gap-3 px-4 py-2" data-testid={`row-recent-user-${u.id}`}>
              <UserMark name={u.name} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-sm font-bold">{u.name}
                  {u.verified && <Pill tone="mint">Verified</Pill>}
                  {u.suspended && <Pill tone="red">Blocked</Pill>}
                  {u.deactivated && <Pill tone="mute">Deactivated</Pill>}
                </div>
                <div className="truncate text-[11px] text-[var(--a-mute)]">{u.email || u.phone || u.username || 'No contact'} · joined <span title={utc(u.joinedAt)}>{ago(u.joinedAt)}</span></div>
              </div>
              <InspectBtn onClick={() => openUser(u.id)} testId={`button-inspect-user-${u.id}`} label="Review" />
            </li>)}</ul>}
        </Panel>

        <Panel title="Recent conversations" testId="panel-recent-chats" link={['/admin/chats', 'All chats']} meta={<span>Metadata only</span>}>
          {!q.data ? <Skeleton rows={5} /> : chats.length === 0 ? <EmptyState title="No conversations" detail="Chats open once two members match." /> :
            <ul>{chats.map(c => <li key={c.id} className="a-row flex items-center gap-3 px-4 py-2" data-testid={`row-recent-chat-${c.id}`}>
              <MessageSquare size={15} className="shrink-0 text-[var(--a-rose)]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{c.userAName} <span className="font-normal text-[var(--a-mute)]">and</span> {c.userBName}</div>
                <div className="mono truncate text-[11px] text-[var(--a-mute)]">{c.messageCount.toLocaleString()} msgs · {c.lastMessageAt ? <span title={utc(c.lastMessageAt)}>last {ago(c.lastMessageAt)}</span> : 'no messages'}</div>
              </div>
              <InspectBtn onClick={() => openChat(c.id)} testId={`button-inspect-chat-${c.id}`} label="Open" />
            </li>)}</ul>}
        </Panel>

        <Panel title="Activity" testId="panel-activity" meta={<span>Most recent first</span>}>
          {!q.data ? <Skeleton rows={6} /> : q.data.activity.length === 0 ? <EmptyState title="Quiet so far" detail="Signups, matches and moderation actions appear as they happen." /> :
            <ol>{q.data.activity.map(a => <li key={a.id} className="a-row flex items-start gap-3 px-4 py-2" data-testid={`row-activity-${a.id}`}>
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--a-rose)]" />
              <span className="flex-1 text-[13px] leading-5">{a.description}</span>
              <time className="mono shrink-0 text-[11px] text-[var(--a-mute)]" title={utc(a.createdAt)}>{ago(a.createdAt)}</time>
            </li>)}</ol>}
        </Panel>

        <Panel title="Recent posts" testId="panel-recent-posts" link={['/admin/posts', 'All posts']} meta={posts.data ? <span className="mono">{posts.data.total.toLocaleString()} total</span> : null}>
          {posts.isError && !posts.data ? <ErrorBox error={posts.error} onRetry={() => void posts.refetch()} text="Posts could not load." /> :
            !posts.data ? <Skeleton rows={5} /> : recentPosts.length === 0 ? <EmptyState title="No posts yet" detail="Reels and stories from members appear here." /> : <>
            {posts.isError && <div className="mx-4 mb-1 text-[11px] text-[#f6c987]" data-testid="status-posts-stale">Latest refresh failed; showing earlier posts.</div>}
            <ul>{recentPosts.map(p => <li key={p.id} className="a-row flex items-center gap-3 px-4 py-2" data-testid={`row-recent-post-${p.id}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-sm font-bold">
                  <button type="button" onClick={() => openUser(p.authorId)} data-testid={`button-post-author-${p.id}`} className="truncate hover:text-[#ff8cc0]">{p.authorName}</button>
                  <Pill tone="mute">{p.kind}</Pill>
                  <Pill tone={p.status === 'published' ? 'mint' : p.status === 'processing' ? 'amber' : p.status === 'blocked' || p.status === 'deleted' ? 'red' : 'mute'}>{p.status}</Pill>
                </div>
                <div className="truncate text-[11px] text-[var(--a-mute)]">{p.caption || 'No caption'} · <span title={utc(p.createdAt)}>{ago(p.createdAt)}</span></div>
              </div>
              <Link href={`/admin/posts?q=${encodeURIComponent(p.id)}`} data-testid={`link-inspect-post-${p.id}`} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-[var(--a-line)] px-2 text-[11px] font-bold hover:border-[#f34e9a]/50 hover:text-[#ff8cc0]"><Eye size={12} />Inspect</Link>
            </li>)}</ul></>}
        </Panel>
      </div>
    </>}
  </div>;
}
