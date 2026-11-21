import { getGetAdminAuditHistoryQueryKey, useGetAdminAuditHistory } from "@workspace/api-client-react";
import { useState } from "react";
import { EmptyState, ErrorBox, Pager, Skeleton, utc } from "../admin-ui";
import { SectionHeader } from "../section-kit";

export function AuditSection() {
  const [page, setPage] = useState(1);
  const audit = useGetAdminAuditHistory({ page }, {
    query: {
      queryKey: getGetAdminAuditHistoryQueryKey({ page }),
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      retry: 1,
    },
  });
  return <section data-testid="admin-audit-history">
    <SectionHeader eyebrow="Administration" title="Access history" detail="Administrator actions are recorded here, including access to private data and changes to reports." />
    {audit.isLoading && !audit.data ? <Skeleton rows={5} />
      : audit.isError && !audit.data ? <ErrorBox error={audit.error} text="Could not load access history." onRetry={() => void audit.refetch()} />
      : !audit.data?.items.length ? <EmptyState title="No administrator activity yet" detail="Recorded actions will appear here." />
      : <ol className="a-panel divide-y divide-[var(--a-line)] overflow-hidden" data-testid="list-admin-audit">
        {audit.data.items.map((item) => <li key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between" data-testid={`row-admin-audit-${item.id}`}>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{item.action.replaceAll("_", " ")}</p>
            <p className="mt-1 text-xs text-[var(--a-mute)]">{item.actorName || "Administrator"}{item.actorEmail ? ` · ${item.actorEmail}` : ""}</p>
            <p className="mono mt-1 break-all text-[10px] text-[var(--a-mute)]">Target {item.targetId}</p>
          </div>
          <time className="shrink-0 text-xs text-[var(--a-mute)]">{utc(item.createdAt)}</time>
        </li>)}
      </ol>}
    {audit.data && <div className="mt-4"><Pager page={page} total={audit.data.total} pageSize={audit.data.pageSize} onPage={setPage} testId="pager-admin-audit" /></div>}
  </section>;
}
