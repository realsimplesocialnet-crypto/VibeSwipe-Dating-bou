import { type FormEvent, type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import type { AdminSession } from '@workspace/api-client-react';
import { Clapperboard, Gauge, HeartHandshake, LogOut, MessagesSquare, Radio, ScanFace, Search, Settings, Users } from 'lucide-react';
import { initials } from './admin-ui';

export const ADMIN_NAV = [
  { key: 'overview', href: '/admin', label: 'Overview', icon: Gauge },
  { key: 'users', href: '/admin/users', label: 'Users', icon: Users },
  { key: 'chats', href: '/admin/chats', label: 'Chats', icon: MessagesSquare },
  { key: 'posts', href: '/admin/posts', label: 'Posts', icon: Clapperboard },
  { key: 'connections', href: '/admin/connections', label: 'Friends/Connections', icon: HeartHandshake },
  { key: 'verifications', href: '/admin/verifications', label: 'Verifications', icon: ScanFace },
  { key: 'online', href: '/admin/online', label: 'Online', icon: Radio },
  { key: 'settings', href: '/admin/settings', label: 'Settings', icon: Settings },
] as const;
export type AdminSectionKey = typeof ADMIN_NAV[number]['key'];

export function AdminWordmark() {
  return <span className="flex items-center gap-2.5">
    <img src={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/icon.png`} alt="" className="h-8 w-8 rounded-lg ring-1 ring-white/10" />
    <span className="leading-none"><span className="brand block text-[17px] font-extrabold">vibe<span className="text-[var(--a-rose)]">swipe</span></span><span className="mono mt-0.5 block text-[9px] uppercase tracking-[.28em] text-[var(--a-mute)]">Admin console</span></span>
  </span>;
}

export function AdminShell({ active, session, onSignOut, children }: { active: AdminSectionKey; session: AdminSession; onSignOut: () => void; children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState('');
  function submit(e: FormEvent) { e.preventDefault(); const v = q.trim(); setLocation(`/admin/users${v ? `?q=${encodeURIComponent(v)}` : ''}`); }
  return <div className="lg:pl-[240px]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-[var(--a-line)] bg-[var(--a-panel)] px-4 py-5 lg:flex">
      <span className="text-sm font-bold">Admin console</span>
      <nav className="mt-9 space-y-0.5" aria-label="Admin">
        {ADMIN_NAV.map(({ key, href, label, icon: Icon }) => <Link key={key} href={href} data-testid={`nav-admin-${key}`} aria-current={active === key ? 'page' : undefined} className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${active === key ? 'bg-[#f34e9a]/10 text-[#ff8cc0]' : 'text-[var(--a-mute)] hover:bg-white/[.04] hover:text-[var(--a-ink)]'}`}>
          {active === key && <span className="absolute -left-4 top-2 bottom-2 w-[3px] rounded-r bg-[var(--a-rose)]" />}<Icon size={17} />{label}
        </Link>)}
      </nav>
      <div className="mt-auto rounded-xl border border-[var(--a-line)] p-3 text-xs text-[var(--a-mute)]">Every action here is checked by the server and applies to real members.</div>
    </aside>
    <header className="sticky top-0 z-20 border-b border-[var(--a-line)] bg-[var(--a-bg)]/90 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <div className="text-sm font-bold lg:hidden">Admin console</div>
        <form onSubmit={submit} className="relative ml-auto hidden max-w-md flex-1 sm:block lg:ml-0" role="search">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--a-mute)]" />
          <input value={q} onChange={e => setQ(e.target.value)} maxLength={150} placeholder="Find a member by name, email or phone" data-testid="input-admin-global-search" className="h-10 w-full rounded-xl border border-[var(--a-line)] bg-[var(--a-panel)] pl-9 pr-3 text-sm outline-none placeholder:text-[var(--a-mute)] focus:border-[#f34e9a]/55" />
        </form>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden text-right md:block"><div className="text-sm font-bold leading-tight" data-testid="text-admin-name">{session.name || 'Admin'}</div><div className="text-[11px] text-[var(--a-mute)]" data-testid="text-admin-email">{session.email}</div></div>
          <Link href="/admin/settings" aria-label="Admin account" data-testid="link-admin-identity" className="grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(145deg,#f34e9a,#8a3a6a)] text-xs font-extrabold text-[#24111b]">{initials(session.name || session.email)}</Link>
          <button type="button" onClick={onSignOut} aria-label="Sign out" data-testid="button-admin-header-signout" className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--a-line)] text-[var(--a-mute)] hover:bg-white/5 hover:text-[var(--a-ink)]"><LogOut size={15} /></button>
        </div>
      </div>
      <form onSubmit={submit} className="px-4 pb-3 sm:hidden" role="search">
        <div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--a-mute)]" />
          <input value={q} onChange={e => setQ(e.target.value)} maxLength={150} placeholder="Find a member" data-testid="input-admin-global-search-mobile" className="h-10 w-full rounded-xl border border-[var(--a-line)] bg-[var(--a-panel)] pl-9 pr-3 text-sm outline-none focus:border-[#f34e9a]/55" /></div>
      </form>
      <nav className="hide-scrollbar flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label="Admin sections">
        {ADMIN_NAV.map(({ key, href, label, icon: Icon }) => <Link key={key} href={href} data-testid={`mobile-nav-admin-${key}`} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${active === key ? 'bg-[#f34e9a]/15 text-[#ff8cc0]' : 'text-[var(--a-mute)]'}`}><Icon size={13} />{label}</Link>)}
      </nav>
    </header>
    <main className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">{children}</main>
  </div>;
}
