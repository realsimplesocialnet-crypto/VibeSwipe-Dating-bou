import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { getGetAdminReportsQueryKey, useGetAdminReports, useUpdateAdminReportStatus } from "@workspace/api-client-react";
import type { GetAdminReportsParams } from "@workspace/api-client-react";
import { useState } from "react";
import { invalidateAdmin, useAdminToast, useDebounced } from "../admin-hooks";
import { adminError, EmptyState, ErrorBox, Pager, Pill, Skeleton, utc } from "../admin-ui";
import { SearchField, SectionHeader } from "../section-kit";

const buttonClass = "h-10 rounded-xl border border-[var(--a-line)] bg-[var(--a-panel)] px-3 text-xs font-bold text-[var(--a-ink)] outline-none focus:border-white/55";

export function ReportsSection() {
  const client = useQueryClient();
  const toast = useAdminToast();
  const [page, setPage] = useState(1);
  const [type, setType] = useState<NonNullable<GetAdminReportsParams["type"]>>("all");
  const [status, setStatus] = useState<NonNullable<GetAdminReportsParams["status"]>>("all");
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState("");
  const queryText = useDebounced(search.trim(), 300);
  const params: GetAdminReportsParams = {
    page,
    type,
    status,
    ...(queryText ? { q: queryText } : {}),
  };
  const reports = useGetAdminReports(params, {
    query: {
      queryKey: getGetAdminReportsQueryKey(params),
      placeholderData: keepPreviousData,
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      retry: 1,
    },
  });
  const update = useUpdateAdminReportStatus();
  async function setReportStatus(reportId: string, reportType: "problem" | "profile" | "reel", nextStatus: "new" | "in_review" | "resolved") {
    setPendingId(reportId);
    try {
      await update.mutateAsync({ reportId, data: { type: reportType, status: nextStatus } });
      await invalidateAdmin(client);
      toast("ok", "Report status updated.");
    } catch (error) {
      toast("err", adminError(error, "The report status could not be updated."));
    } finally {
      setPendingId("");
    }
  }

  return <section data-testid="admin-reports">
    <SectionHeader eyebrow="Member support" title="Reports and problems" detail="Review member-submitted problem reports, profile reports, and Reel reports. Private chats are not included." />
    <div className="mb-4 flex flex-col gap-2 sm:flex-row">
      <SearchField value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search people, reasons, or details" testId="input-admin-reports-search" />
      <select aria-label="Report type" value={type} onChange={(event) => { setType(event.target.value as typeof type); setPage(1); }} className={buttonClass} data-testid="select-admin-report-type">
        <option value="all">All reports</option>
        <option value="problem">Problems</option>
        <option value="profile">Profile reports</option>
        <option value="reel">Reel reports</option>
      </select>
      <select aria-label="Report status" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }} className={buttonClass} data-testid="select-admin-report-status">
        <option value="all">All statuses</option>
        <option value="new">New</option>
        <option value="in_review">In review</option>
        <option value="resolved">Resolved</option>
      </select>
    </div>
    {reports.isLoading && !reports.data ? <Skeleton rows={5} />
      : reports.isError && !reports.data ? <ErrorBox error={reports.error} text="Could not load member reports." onRetry={() => void reports.refetch()} />
      : !reports.data?.items.length ? <EmptyState title="No reports found" detail="New problem and safety reports will appear here." />
      : <ul className="a-panel divide-y divide-[var(--a-line)] overflow-hidden" data-testid="list-admin-reports">
        {reports.data.items.map((report) => <li key={`${report.type}:${report.id}`} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start" data-testid={`row-admin-report-${report.id}`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={report.type === "problem" ? "amber" : "rose"}>{report.type === "problem" ? "Problem" : report.type === "profile" ? "Profile report" : "Reel report"}</Pill>
              <span className="text-sm font-bold">{report.reporterName}</span>
              <span className="text-xs text-[var(--a-mute)]">{utc(report.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--a-ink)]">{report.category.replaceAll("_", " ")}</p>
            {report.targetName && <p className="mt-1 text-xs text-[var(--a-mute)]">About: {report.targetName}</p>}
            {report.details && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--a-mute)]">{report.details}</p>}
            <p className="mono mt-2 break-all text-[10px] text-[var(--a-mute)]">Member {report.reporterId}{report.targetId ? ` · Target ${report.targetId}` : ""}</p>
          </div>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--a-mute)]">
            Status
            <select
              value={report.status}
              disabled={pendingId === report.id}
              aria-label={`Status for ${report.reporterName}'s report`}
              data-testid={`select-admin-report-status-${report.id}`}
              onChange={(event) => void setReportStatus(report.id, report.type, event.target.value as "new" | "in_review" | "resolved")}
              className={buttonClass}
            >
              <option value="new">New</option>
              <option value="in_review">In review</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
        </li>)}
      </ul>}
    {reports.data && <div className="mt-4"><Pager page={page} total={reports.data.total} pageSize={reports.data.pageSize} onPage={setPage} testId="pager-admin-reports" /></div>}
  </section>;
}
