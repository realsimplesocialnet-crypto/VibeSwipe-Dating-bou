import { AdminPreviewShell, MemberCard, Pill, PreviewNote } from './_shared';

export function SuspendedMember() {
  return <AdminPreviewShell>
    <div className="mb-3 flex items-center gap-2 text-xs text-[var(--a-mute)]">
      <span>Members</span><span aria-hidden="true">/</span><span className="text-[var(--a-ink)]">After suspension</span>
    </div>
    <MemberCard suspended />
    <section className="a-panel mt-4 p-4">
      <div className="flex items-center gap-2">
        <Pill tone="red">Suspended</Pill>
        <h2 className="text-sm font-bold">What changes</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--a-mute)]">The member is signed out of discovery and can’t message matches. Their stored data stays intact unless you separately choose Delete.</p>
      <PreviewNote>Blocking bans access (shown as <strong className="text-[var(--a-ink)]">Suspended</strong>). The Verified badge stays unless you separately choose <strong className="text-[var(--a-ink)]">Unverify</strong>. <strong className="text-[#9fe6c6]">Unblock</strong> restores access. No real account was changed for this preview.</PreviewNote>
    </section>
  </AdminPreviewShell>;
}
