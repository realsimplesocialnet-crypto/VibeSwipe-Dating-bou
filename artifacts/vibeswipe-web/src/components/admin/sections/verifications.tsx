import { useEffect, useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import {
  getGetAdminVerificationPhotoQueryKey, getGetAdminVerificationRequestsQueryKey,
  useGetAdminVerificationPhoto, useGetAdminVerificationRequests,
  type FaceVerificationReview, type GetAdminVerificationRequestsStatus,
} from '@workspace/api-client-react';
import { Camera, ImageOff } from 'lucide-react';
import { ago, EmptyState, ErrorBox, Pager, Pill, Skeleton, utc } from '../admin-ui';
import { SectionHeader } from '../section-kit';

const FILTERS: { key: GetAdminVerificationRequestsStatus; label: string }[] = [
  { key: 'awaiting_review', label: 'Checking' },
  { key: 'approved', label: 'Verified' },
  { key: 'rejected', label: 'Did not pass' },
  { key: 'cancelled', label: 'Cancelled' },
];

function statusPill(s: FaceVerificationReview['status']) {
  if (s === 'awaiting_review') return <Pill tone="amber">Automatic checks</Pill>;
  if (s === 'approved') return <Pill tone="mint">Verified</Pill>;
  if (s === 'rejected') return <Pill tone="red">Did not pass</Pill>;
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

export function VerificationsSection() {
  const [status, setStatus] = useState<GetAdminVerificationRequestsStatus>('awaiting_review');
  const [page, setPage] = useState(1);
  const params = { page, status };
  const q = useGetAdminVerificationRequests(params, { query: { queryKey: getGetAdminVerificationRequestsQueryKey(params), placeholderData: keepPreviousData, refetchInterval: status === 'awaiting_review' ? 30_000 : undefined, refetchIntervalInBackground: false, retry: 1 } });
  const data = q.data;
  return <div>
    <SectionHeader eyebrow="Trust" title="Photo verification" detail="Verification is automatic. Blue ticks activate after the live selfie, face match and gallery checks pass. No administrator approval is needed." />
    <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
      {FILTERS.map(f => <button key={f.key} type="button" role="tab" aria-selected={status === f.key} onClick={() => { setStatus(f.key); setPage(1); }} data-testid={`filter-verification-${f.key}`} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${status === f.key ? 'bg-[#f34e9a]/15 text-[#ff8cc0]' : 'text-[var(--a-mute)] hover:bg-white/5'}`}>{f.label}</button>)}
    </div>
    <div className="a-panel overflow-hidden">
      {q.isLoading ? <Skeleton rows={4} />
      : q.isError ? <ErrorBox error={q.error} onRetry={() => void q.refetch()} text="Verification history could not load." />
      : !data || data.requests.length === 0 ? <EmptyState title={status === 'awaiting_review' ? 'No checks pending' : 'Nothing here yet'} detail={status === 'awaiting_review' ? 'Successful checks activate verification automatically.' : 'No requests with this status.'} />
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
                {r.reviewedAt && <p className="mt-1 text-xs text-[var(--a-mute)]">Completed {utc(r.reviewedAt)}</p>}
                {r.status === 'awaiting_review' && <p className="mt-3 text-xs text-[var(--a-mute)]">Gallery checks finish automatically. Temporary failures are retried; no approval is required.</p>}
              </div>
            </li>)}
          </ul>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} testId="pager-verifications" />
        </>}
    </div>
  </div>;
}
