import { AdminPreviewShell, MemberCard, PreviewNote } from './_shared';

export function Confirmation() {
  return <AdminPreviewShell>
    <p className="mb-3 text-xs text-[var(--a-mute)]">The confirmation shown after selecting <strong className="text-[var(--a-ink)]">Block</strong> on a member.</p>
    <MemberCard suspended={false} initialConfirm />
    <PreviewNote>This is a visual preview only. Confirming here changes only the sample screen, not a real account.</PreviewNote>
  </AdminPreviewShell>;
}
