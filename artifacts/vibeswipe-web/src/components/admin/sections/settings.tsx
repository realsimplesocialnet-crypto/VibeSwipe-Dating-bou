import { useState } from 'react';
import type { AdminSession } from '@workspace/api-client-react';
import { KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { SectionHeader } from '../section-kit';

export function SettingsSection({ session, onSignOut }: { session: AdminSession; onSignOut: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const rows: [string, string][] = [['Name', session.name || 'Not set'], ['Email', session.email || 'Not set'], ['Account ID', session.userId], ['Timezone', session.timezone]];
  return <div className="max-w-3xl">
    <SectionHeader eyebrow="Settings" title="Admin account" detail="The identity the server recognises for this session." />
    <section className="a-panel overflow-hidden">
      <dl className="divide-y divide-[var(--a-line)]">{rows.map(([k, v]) => <div key={k} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[160px_1fr]"><dt className="text-xs font-bold uppercase tracking-[.12em] text-[var(--a-mute)]">{k}</dt><dd className={`break-all text-sm ${k === 'Account ID' ? 'mono' : ''}`} data-testid={`text-admin-${k.toLowerCase().replace(' ', '-')}`}>{v}</dd></div>)}</dl>
    </section>
    <section className="a-panel mt-4 p-5">
      <h2 className="flex items-center gap-2 text-sm font-extrabold"><ShieldCheck size={16} className="text-[var(--a-mint)]" />How access works</h2>
      <ul className="mt-3 space-y-2.5 text-sm leading-6 text-[var(--a-mute)]">
        <li>Admin access is granted on the server. This browser never decides who is an admin, and every admin request is checked again by the API.</li>
        <li>Deleting a member, chat or message needs the word DELETE. Removing a match or like needs REMOVE. The server rejects the action without it.</li>
        <li>Member photos and chat media load through an admin-only endpoint and are released from memory when you close them.</li>
        <li>Dates in filters and exports use UTC.</li>
      </ul>
    </section>
    <section className="a-panel mt-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <KeyRound size={18} className="shrink-0 text-[var(--a-rose)]" />
      <div className="flex-1"><div className="text-sm font-bold">Sign out</div><p className="text-xs text-[var(--a-mute)]">Ends the session and clears all loaded admin data from this device.</p></div>
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); await onSignOut(); setBusy(false); }} data-testid="button-admin-signout" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--a-rose)] px-4 text-sm font-extrabold text-black disabled:opacity-50">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}Sign out
      </button>
    </section>
  </div>;
}
