import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { useAdminData } from '../admin-hooks';
import { ago, EmptyState, ErrorBox, Skeleton, utc } from '../admin-ui';
import { LiveDot, SectionHeader, Stat } from '../section-kit';

export function OverviewSection() {
  const q = useAdminData({ section: 'overview' }, { poll: 20_000 });
  const s = q.data?.stats;
  return <div>
    <SectionHeader eyebrow="Overview" title="Today on VibeSwipe" detail="Live totals straight from the member database. Refreshes every 20 seconds." right={<LiveDot fetching={q.isFetching} />} />
    {q.isError && !q.data ? <div className="a-panel"><ErrorBox error={q.error} onRetry={() => void q.refetch()} text="Overview could not load." /></div> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {!s ? Array.from({ length: 6 }, (_, i) => <div key={i} className="a-skel h-[112px]" />) : <>
          <Stat testId="stat-total-users" label="Members" value={s.totalUsers.toLocaleString()} hint="All registered profiles" />
          <Stat testId="stat-online-users" label="Online now" value={s.onlineUsers.toLocaleString()} tone="mint" hint="Active presence heartbeat" />
          <Stat testId="stat-active-chats" label="Active chats" value={s.activeChats.toLocaleString()} tone="rose" hint="Mutual-match conversations" />
          <Stat testId="stat-signups-today" label="Signups today" value={s.signupsToday.toLocaleString()} tone="amber" hint="Since 00:00 UTC" />
          <Stat testId="stat-total-matches" label="Mutual matches" value={s.totalMatches.toLocaleString()} hint="Both members liked each other" />
          <Stat testId="stat-pending-likes" label="Pending likes" value={s.pendingLikes.toLocaleString()} hint="One-way, not yet returned" />
        </>}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="a-panel overflow-hidden">
          <header className="flex items-center justify-between border-b border-[var(--a-line)] px-5 py-3.5"><h2 className="text-sm font-extrabold">Activity feed</h2><span className="text-xs text-[var(--a-mute)]">Most recent first</span></header>
          {!q.data ? <Skeleton rows={6} /> : q.data.activity.length === 0 ? <EmptyState title="Quiet so far" detail="New signups, matches and moderation actions appear here as they happen." /> :
            <ol className="ledger max-h-[460px] overflow-y-auto">{q.data.activity.map(a => <li key={a.id} className="a-row flex items-start gap-3 px-5 py-3" data-testid={`row-activity-${a.id}`}>
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--a-rose)]" />
              <span className="flex-1 text-sm leading-6">{a.description}</span>
              <time className="mono shrink-0 text-[11px] text-[var(--a-mute)]" title={utc(a.createdAt)}>{ago(a.createdAt)}</time>
            </li>)}</ol>}
        </section>
        <section className="a-panel p-5">
          <h2 className="text-sm font-extrabold">Jump to</h2>
          <div className="mt-3 divide-y divide-[var(--a-line)]">
            {[['/admin/users', 'Review members', 'Verify, block or remove profiles'], ['/admin/chats', 'Read conversations', 'Filter by day, export a range'], ['/admin/online', 'Who is online', 'Live presence, refreshed every 10s'], ['/admin/connections', 'Matches and likes', 'Mutual matches and pending likes']].map(([href, t, d]) =>
              <Link key={href} href={href} data-testid={`link-jump-${href.split('/').pop()}`} className="group flex items-center gap-3 py-3">
                <div className="flex-1"><div className="text-sm font-bold">{t}</div><div className="text-xs text-[var(--a-mute)]">{d}</div></div>
                <ArrowRight size={15} className="text-[var(--a-mute)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--a-rose)]" />
              </Link>)}
          </div>
        </section>
      </div>
    </>}
  </div>;
}
