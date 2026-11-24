import { useState } from 'react';
import { Link } from 'wouter';
import type { AdminUser } from '@workspace/api-client-react';
import { BadgeCheck, Ban, ShieldOff, Trash2, Undo2 } from 'lucide-react';
import { useModeration } from './admin-hooks';
import { ConfirmDialog, type ConfirmRequest } from './confirm-dialog';
import { Pill } from './admin-ui';

export function UserStatus({ u }: { u: AdminUser }) {
  return <span className="flex flex-wrap gap-1">
    {u.online && <Pill tone="mint">Online</Pill>}
    {u.verified ? <Pill tone="rose">Verified</Pill> : <Pill>Unverified</Pill>}
    {u.suspended && <Pill tone="red">Blocked</Pill>}
    {u.deactivated && <Pill tone="amber">Paused by member</Pill>}
  </span>;
}

/** Verify / block / delete controls for one member. Destructive actions are always confirmed. */
export function UserActions({ u, compact = false, onDeleted }: { u: AdminUser; compact?: boolean; onDeleted?: () => void }) {
  const { run, pending } = useModeration();
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const base = `inline-flex items-center justify-center gap-1.5 rounded-lg border font-bold transition-colors disabled:opacity-40 ${compact ? 'h-8 px-2.5 text-[11px]' : 'h-10 px-3.5 text-xs'}`;
  return <>
    <div className="flex flex-wrap gap-2">
      {u.verified
        ? <button type="button" disabled={pending} onClick={() => void run('unverify', u.id)} data-testid={`button-unverify-${u.id}`} className={`${base} border-[var(--a-line)] hover:bg-white/5`}><ShieldOff size={13} />Unverify</button>
        : <Link href="/admin/verifications" data-testid={`button-verify-${u.id}`} title="View automatic verification checks" className={`${base} border-[var(--a-line)] hover:bg-white/5`}><BadgeCheck size={13} className="text-white" />Verification status</Link>}
      {u.suspended
        ? <button type="button" disabled={pending} onClick={() => void run('unblock', u.id)} data-testid={`button-unblock-${u.id}`} className={`${base} border-[#7fd6b0]/30 text-[#9fe6c6] hover:bg-[#7fd6b0]/10`}><Undo2 size={13} />Unblock</button>
        : <button type="button" disabled={pending} onClick={() => setReq({ title: `Block ${u.name}?`, detail: 'They will be signed out of discovery and cannot message matches until you unblock them. Their data stays intact.', confirmLabel: 'Block member', tone: 'neutral', onConfirm: () => run('block', u.id) })} data-testid={`button-block-${u.id}`} className={`${base} border-[#f2b766]/30 text-[#f6c987] hover:bg-[#f2b766]/10`}><Ban size={13} />Block</button>}
      <button type="button" disabled={pending} onClick={() => setReq({ title: `Delete ${u.name} permanently?`, detail: 'This removes the profile, photos, matches and every conversation they are part of. It cannot be undone.', confirmLabel: 'Delete member', word: 'DELETE', onConfirm: async c => { const ok = await run('delete_user', u.id, c); if (ok) onDeleted?.(); return ok; } })} data-testid={`button-delete-user-${u.id}`} className={`${base} border-[#f06b76]/30 text-[#ff9aa3] hover:bg-[#f06b76]/10`}><Trash2 size={13} />Delete</button>
    </div>
    <ConfirmDialog req={req} onClose={() => setReq(null)} />
  </>;
}
