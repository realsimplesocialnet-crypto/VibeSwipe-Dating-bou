import { useEffect, useState } from 'react';
import { useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  getGetAdminVerificationPhotoQueryKey, getGetAdminVerificationRequestsQueryKey, getGetDiscoverProfilesQueryKey,
  getGetFaceVerificationStatusQueryKey, getGetMatchesQueryKey, getGetMyProfileQueryKey,
  useGetAdminVerificationPhoto, useGetAdminVerificationRequests, useReviewFaceVerification,
  type FaceVerificationReview, type GetAdminVerificationRequestsStatus,
} from '@workspace/api-client-react';
import { BadgeCheck, Camera, ImageOff, LoaderCircle, ShieldCheck, X, XCircle } from 'lucide-react';
import { invalidateAdmin, useAdminToast } from '../admin-hooks';
import { adminError, ago, EmptyState, ErrorBox, Pager, Pill, Skeleton, utc } from '../admin-ui';
import { SectionHeader } from '../section-kit';

const FILTERS: { key: GetAdminVerificationRequestsStatus; label: string }[] = [
  { key: 'awaiting_review', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
];

function statusPill(s: FaceVerificationReview['status']) {
  if (s === 'awaiting_review') return <Pill tone="amber">Awaiting review</Pill>;
  if (s === 'approved') return <Pill tone="mint">Approved</Pill>;
  if (s === 'rejected') return <Pill tone="red">Rejected</Pill>;
  return <Pill>Cancelled</Pill>;
}

function RequestPhoto({ r }: { r: FaceVerificationReview }) {
  const photo = useGetAdminVerificationPhoto(r.id, { query: { queryKey: getGetAdminVerificationPhotoQueryKey(r.id), enabled: r.photoAvailable, staleTime: 5 * 60_000, retry: 1 } });
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!photo.data) return;
    const u = URL.createObjectURL(photo.data);
    setUrl(u);
    return () => { URL.revokeObjectURL(u); setUrl(''); };
  }, [photo.data]);
  if (!r.photoAvailable || photo.isError) return <div className="grid h-full w-full place-items-center bg-white/[.03] text-center text-xs text-[var(--a-mute)]"><span><ImageOff size={20} className="mx-auto mb-2" />{photo.isError ? 'Photo could not load' : 'Photo no longer available'}</span></div>;
  if (!url) return <div className="a-skel h-full w-full rounded-none" aria-label="Loading submitted photo" />;
  return <img src={url} alt={`Photo submitted by ${r.name}`} className="a-fade h-full w-full object-cover" data-testid={`img-verification-${r.id}`} />;
}

type Pending = { r: FaceVerificationReview; decision: 'approve' | 'reject' };

function DecisionDialog({ p, onClose }: { p: Pending; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useAdminToast();
  const review = useReviewFaceVerification();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const approve = p.decision === 'approve';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !review.isPending) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, review.isPending]);
  async function submit() {
    if (review.isPending) return;
    setErr('');
    try {
      const r = reason.trim();
      const res = await review.mutateAsync({ requestId: p.r.id, data: { decision: p.decision, confirmed: true, ...(!approve && r ? { reason: r } : {}) } });
      toast('ok', res.message || (approve ? `${p.r.name} is now verified.` : `Request from ${p.r.name} rejected.`));
      await Promise.all([
        invalidateAdmin(qc),
        qc.invalidateQueries({ queryKey: getGetFaceVerificationStatusQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetDiscoverProfilesQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetMatchesQueryKey() }),
      ]);
      onClose();
    } catch (e) { setErr(adminError(e, 'The decision did not save. Nothing was changed.')); }
  }
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-[#0b0910]/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="verify-dialog-title" data-testid={`dialog-${p.decision}-verification`}>
    <div className="a-fade a-panel w-full max-w-[440px] p-6">
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${approve ? 'bg-[#7fd6b0]/12 text-[#9fe6c6]' : 'bg-[#f06b76]/12 text-[#ff9aa3]'}`}>{approve ? <BadgeCheck size={20} /> : <XCircle size={20} />}</div>
        <button type="button" onClick={onClose} disabled={review.isPending} aria-label="Close" data-testid="button-close-verification-dialog" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--a-mute)] hover:bg-white/5"><X size={16} /></button>
      </div>
      <h2 id="verify-dialog-title" className="brand mt-4 text-xl font-extrabold">{approve ? `Approve ${p.r.name}?` : `Reject ${p.r.name}'s request?`}</h2>
      {approve
        ? <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--a-mute)]">
            <li>This exact photo becomes their <b className="text-[var(--a-ink)]">main profile photo</b>. Their other gallery photos stay.</li>
            <li>A <b className="text-[var(--a-ink)]">blue verified tick</b> appears on their profile for every member.</li>
            <li>Only approve if the photo clearly shows the same person who passed the camera check.</li>
          </ul>
        : <>
            <p className="mt-3 text-sm leading-6 text-[var(--a-mute)]">No badge is awarded and their profile photos are not changed. They can submit again.</p>
            <label className="mt-4 block text-xs font-bold uppercase tracking-[.12em] text-[var(--a-mute)]" htmlFor="reject-reason">Reason shown to member (optional)</label>
            <textarea id="reject-reason" value={reason} onChange={e => setReason(e.target.value.slice(0, 300))} rows={3} maxLength={300} placeholder="For example: the face in the photo isn’t clearly visible." data-testid="input-reject-reason" className="mt-2 w-full resize-none rounded-xl border border-[var(--a-line)] bg-[var(--a-bg)] p-3 text-sm outline-none focus:border-[#f34e9a]/55" />
            <div className="mono mt-1 text-right text-[10px] text-[var(--a-mute)]">{reason.length}/300</div>
          </>}
      {err && <p role="alert" className="mt-3 rounded-lg border border-[#f06b76]/30 bg-[#f06b76]/10 px-3 py-2 text-sm text-[#ffd0d5]">{err}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={review.isPending} data-testid="button-cancel-decision" className="h-10 rounded-xl border border-white/10 px-4 text-sm font-bold hover:bg-white/5">Cancel</button>
        <button type="button" onClick={() => void submit()} disabled={review.isPending} data-testid={`button-confirm-${p.decision}`} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-extrabold disabled:opacity-60 ${approve ? 'bg-[#7fd6b0] text-[#0f2219]' : 'bg-[#f06b76] text-[#2a0e12]'}`}>
          {review.isPending && <LoaderCircle size={14} className="animate-spin" />}{approve ? 'Approve and add tick' : 'Reject request'}
        </button>
      </div>
    </div>
  </div>;
}

export function VerificationsSection() {
  const [status, setStatus] = useState<GetAdminVerificationRequestsStatus>('awaiting_review');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<Pending | null>(null);
  const params = { page, status };
  const q = useGetAdminVerificationRequests(params, { query: { queryKey: getGetAdminVerificationRequestsQueryKey(params), placeholderData: keepPreviousData, refetchInterval: status === 'awaiting_review' ? 30_000 : undefined, refetchIntervalInBackground: false, retry: 1 } });
  const data = q.data;
  return <div>
    <SectionHeader eyebrow="Trust" title="Photo verification" detail="Each request passed a still-photo liveness check against the submitted photo. Nothing is public until you approve it." />
    <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
      {FILTERS.map(f => <button key={f.key} type="button" role="tab" aria-selected={status === f.key} onClick={() => { setStatus(f.key); setPage(1); }} data-testid={`filter-verification-${f.key}`} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${status === f.key ? 'bg-[#f34e9a]/15 text-[#ff8cc0]' : 'text-[var(--a-mute)] hover:bg-white/5'}`}>{f.label}</button>)}
    </div>
    <div className="a-panel overflow-hidden">
      {q.isLoading ? <Skeleton rows={4} />
      : q.isError ? <ErrorBox error={q.error} onRetry={() => void q.refetch()} text="The verification queue could not load." />
      : !data || data.requests.length === 0 ? <EmptyState title={status === 'awaiting_review' ? 'No requests waiting' : 'Nothing here yet'} detail={status === 'awaiting_review' ? 'New requests appear here after a member passes the camera check.' : 'No requests with this status.'} />
      : <>
          <ul className={`divide-y divide-[var(--a-line)] transition-opacity ${q.isFetching ? 'opacity-70' : ''}`}>
            {data.requests.map(r => <li key={r.id} className="a-fade grid gap-4 p-4 sm:grid-cols-[140px_1fr] md:p-5" data-testid={`row-verification-${r.id}`}>
              <div className="aspect-[3/4] w-full max-w-[200px] overflow-hidden rounded-xl bg-white/[.03] ring-1 ring-white/10 sm:w-[140px]"><RequestPhoto r={r} /></div>
              <div className="flex min-w-0 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-extrabold" data-testid={`text-verification-name-${r.id}`}>{r.name}, {r.age}</span>{statusPill(r.status)}
                </div>
                <div className="mt-1 text-xs text-[var(--a-mute)]">Submitted <span title={utc(r.submittedAt)}>{ago(r.submittedAt)}</span> · {utc(r.submittedAt)}</div>
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#7fd6b0]/20 bg-[#7fd6b0]/[.05] px-3 py-2 text-xs text-[#c9f1de]"><Camera size={14} className="mt-0.5 shrink-0" />Camera check passed: a live still selfie matched this photo. No video was recorded.</div>
                {r.rejectionReason && <p className="mt-2 text-xs text-[#ffb8bf]">Reason: {r.rejectionReason}</p>}
                {r.reviewedAt && <p className="mt-1 text-xs text-[var(--a-mute)]">Reviewed {utc(r.reviewedAt)}</p>}
                {r.status === 'awaiting_review' && <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <button type="button" onClick={() => setPending({ r, decision: 'approve' })} data-testid={`button-approve-${r.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#7fd6b0]/15 px-3.5 text-xs font-extrabold text-[#9fe6c6] ring-1 ring-[#7fd6b0]/30 hover:bg-[#7fd6b0]/25"><ShieldCheck size={14} />Approve</button>
                  <button type="button" onClick={() => setPending({ r, decision: 'reject' })} data-testid={`button-reject-${r.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-extrabold text-[#ff9aa3] ring-1 ring-[#f06b76]/30 hover:bg-[#f06b76]/10"><XCircle size={14} />Reject</button>
                </div>}
              </div>
            </li>)}
          </ul>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} testId="pager-verifications" />
        </>}
    </div>
    {pending && <DecisionDialog key={pending.r.id + pending.decision} p={pending} onClose={() => setPending(null)} />}
  </div>;
}
