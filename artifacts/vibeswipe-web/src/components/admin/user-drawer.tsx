import { useState } from 'react';
import { useLocation } from 'wouter';
import { MessageCircle, RotateCw } from 'lucide-react';
import { useAdminData } from './admin-hooks';
import { AdminPhoto, ago, DrawerShell, EmptyState, ErrorBox, Skeleton, utc } from './admin-ui';
import { ChatRow } from './sections/chats';
import { ConnectionRow } from './sections/connections';
import { UserActions, UserStatus } from './user-actions';

export function UserDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const r = useAdminData({ section: 'user', userId }, { poll: 20_000 });
  const [, setLocation] = useLocation();
  // Never render placeholder data for another account while this drawer's query changes.
  const data = r.data?.selectedUser?.id === userId || r.data?.selectedUser === null ? r.data : undefined;
  const u = data?.selectedUser;
  const [photo, setPhoto] = useState(0);
  return <DrawerShell eyebrow="Member" title={u?.name ?? (r.isError ? 'Unavailable' : 'Loading')} onClose={onClose} testId="drawer-user">
    {r.isError && !data ? <ErrorBox error={r.error} onRetry={() => void r.refetch()} text="This member could not load." /> :
      !data ? <Skeleton rows={7} /> :
      !u ? <EmptyState title="Member not found" detail="They may have been deleted. Close this panel to continue." /> :
      <div className="a-fade">
        {r.isError && <div className="border-b border-[var(--a-line)]"><ErrorBox error={r.error} onRetry={() => void r.refetch()} text="Account details may be out of date." /></div>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--a-line)] px-5 py-3">
          <span className="text-xs text-[var(--a-mute)]" data-testid="text-user-updated">Updated {new Date(r.dataUpdatedAt).toLocaleTimeString()}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => void r.refetch()} disabled={r.isFetching} data-testid="button-refresh-user" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--a-line)] px-3 text-xs font-bold disabled:opacity-50"><RotateCw size={13} className={r.isFetching ? 'animate-spin' : ''} />Refresh</button>
            <button type="button" onClick={() => setLocation(`/admin/chats?userId=${encodeURIComponent(userId)}`)} data-testid="button-user-chats" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--a-line)] px-3 text-xs font-bold hover:bg-white/5"><MessageCircle size={13} />View chats</button>
          </div>
        </div>
        <div className="p-5">
          {u.photos.length > 0 ? <>
            <AdminPhoto key={u.photos[photo]} reference={u.photos[Math.min(photo, u.photos.length - 1)]} alt={`${u.name} photo ${photo + 1}`} className="aspect-[4/5] w-full max-w-[320px] rounded-2xl" />
            {u.photos.length > 1 && <div className="mt-2 flex gap-2 overflow-x-auto hide-scrollbar">{u.photos.map((p, i) => <button key={p} type="button" onClick={() => setPhoto(i)} data-testid={`button-user-photo-${i}`} className={`shrink-0 rounded-lg ring-2 ${i === photo ? 'ring-[var(--a-rose)]' : 'ring-transparent opacity-60'}`}><AdminPhoto reference={p} alt="" className="h-14 w-12 rounded-lg" /></button>)}</div>}
          </> : <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-[var(--a-line)] text-sm text-[var(--a-mute)]">No profile photos</div>}
          <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xl font-extrabold">{u.name}, {u.age}</span><UserStatus u={u} /></div>
          <p className="mt-1 text-sm text-[var(--a-mute)]">{[u.gender, u.occupation, [u.city, u.state, u.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</p>
          {u.bio && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{u.bio}</p>}
          {u.interests.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{u.interests.map(i => <span key={i} className="rounded-full bg-white/5 px-2.5 py-1 text-xs">{i}</span>)}</div>}
          <div className="mt-5"><UserActions u={u} onDeleted={onClose} /></div>
        </div>
        <dl className="grid grid-cols-2 border-y border-[var(--a-line)] text-sm">
          {([['Email', u.email], ['Username', u.username], ['Phone', u.phone], ['Matches', String(u.connectionCount)], ['Joined', utc(u.joinedAt)], ['Last seen', u.online ? 'Online now' : `${ago(u.lastSeenAt)}`], ['Account ID', u.id]] as [string, string | null][]).map(([k, v]) =>
            <div key={k} className="border-b border-r border-[var(--a-line)] px-5 py-3 even:border-r-0"><dt className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--a-mute)]">{k}</dt><dd className="mono mt-0.5 break-all text-xs" data-testid={`text-user-${k.toLowerCase().replace(' ', '-')}`}>{v || '—'}</dd></div>)}
        </dl>
        <h3 className="px-5 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[.16em] text-[var(--a-mute)]">Conversations ({data.chats.length})</h3>
        {data.chats.length ? <ul className="divide-y divide-[var(--a-line)]">{data.chats.map(c => <ChatRow key={c.id} c={c} />)}</ul> : <p className="px-5 pb-3 text-sm text-[var(--a-mute)]">No conversations.</p>}
        <h3 className="px-5 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[.16em] text-[var(--a-mute)]">Matches and likes ({data.connections.length})</h3>
        {data.connections.length ? <ul className="divide-y divide-[var(--a-line)] pb-6">{data.connections.map(c => <ConnectionRow key={c.id} c={c} />)}</ul> : <p className="px-5 pb-6 text-sm text-[var(--a-mute)]">No matches or likes.</p>}
      </div>}
  </DrawerShell>;
}
