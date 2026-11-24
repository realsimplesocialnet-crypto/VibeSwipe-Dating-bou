import { useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Shield } from "lucide-react";
import { Link } from "wouter";
import { useGetMatches, useReportProfile, type ReportInputReason } from "@workspace/api-client-react";

const reasons: { value: ReportInputReason; label: string }[] = [
  { value: "spam", label: "Spam or scam" },
  { value: "fake", label: "Fake profile" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Other safety issue" },
];

export default function ReportSafetyPage() {
  const matches = useGetMatches({ query: { refetchInterval: 15_000 } });
  const report = useReportProfile();
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState<ReportInputReason>("spam");
  const [details, setDetails] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const people = matches.data ?? [];
  const selectedId = targetUserId || people[0]?.profile.id || "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (!selectedId) {
      setError("Choose a profile to report.");
      return;
    }
    try {
      await report.mutateAsync({
        data: {
          targetUserId: selectedId,
          reason,
          ...(details.trim() ? { details: details.trim() } : {}),
        },
      });
      setNotice("Your report was sent to the MyAgeBeauty safety team. Thank you.");
      setDetails("");
    } catch {
      setError("The report could not be sent. Check your connection and try again.");
    }
  }

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-7 text-foreground" data-testid="page-report-safety">
      <div className="mx-auto max-w-2xl">
        <Link href="/settings" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground" data-testid="link-report-safety-back">
          <ArrowLeft size={15} /> Back to Settings
        </Link>

        <div className="mt-7 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
            <Shield size={22} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-primary">MyAgeBeauty Safety</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Report a Scam or Safety Issue</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Tell us about a profile that made you feel unsafe. Reports are sent privately for review.</p>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-200" />
            <div>
              <h2 className="text-sm font-bold text-amber-100">Watch for common dating scams</h2>
              <p className="mt-1 text-xs leading-5 text-amber-100/75">Never send money, bank details, passwords, or verification codes. For a first meeting, choose a public place and tell someone you trust.</p>
            </div>
          </div>
        </section>

        {matches.isLoading ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-card p-5 text-sm text-muted-foreground" role="status">Loading your conversations…</div>
        ) : people.length ? (
          <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-5 rounded-3xl border border-white/[.08] bg-card p-5 sm:p-6">
            <div>
              <label htmlFor="report-profile" className="text-xs font-bold text-foreground">Profile</label>
              <select id="report-profile" data-testid="select-report-profile" value={selectedId} onChange={(event) => setTargetUserId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#19161c] px-3 text-sm text-foreground">
                {people.map((match) => <option key={match.profile.id} value={match.profile.id}>{match.profile.name}{match.profile.city ? ` · ${match.profile.city}` : ""}</option>)}
              </select>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">For someone you have not matched with, open their profile in Discover and choose Report from the profile menu.</p>
            </div>

            <fieldset>
              <legend className="text-xs font-bold text-foreground">What happened?</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {reasons.map((item) => (
                  <button key={item.value} type="button" onClick={() => setReason(item.value)} aria-pressed={reason === item.value} className={`min-h-11 rounded-xl border px-3 text-left text-xs font-semibold transition-colors ${reason === item.value ? "border-primary/60 bg-primary/10 text-foreground" : "border-white/10 bg-[#191919] text-muted-foreground hover:text-foreground"}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="report-details" className="text-xs font-bold text-foreground">Details (optional)</label>
              <textarea id="report-details" data-testid="input-report-details" maxLength={1000} value={details} onChange={(event) => setDetails(event.target.value)} rows={4} placeholder="Share what happened. Do not include passwords, bank details, or verification codes." className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#19161c] px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">{details.length}/1000</p>
            </div>

            {notice && <p className="flex items-center gap-2 text-sm text-emerald-300" role="status"><CheckCircle2 size={16} />{notice}</p>}
            {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
            <button type="submit" data-testid="button-submit-safety-report" disabled={report.isPending || matches.isError} className="min-h-12 w-full rounded-xl bg-primary px-5 text-sm font-bold text-[#27111d] disabled:opacity-50">
              {report.isPending ? "Sending report…" : "Send report"}
            </button>
          </form>
        ) : matches.isError ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-card p-5 text-sm text-muted-foreground" role="alert">Your conversations could not be loaded. You can report a profile directly from its menu in Discover.</div>
        ) : (
          <section className="mt-6 rounded-3xl border border-white/[.08] bg-card p-5">
            <h2 className="font-bold">No matched profiles to choose from</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">You can still report anyone in Discover: open their profile menu and choose Report.</p>
            <Link href="/discover" data-testid="link-report-from-discover" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-[#27111d]">Open Discover</Link>
          </section>
        )}
        <footer className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[.08] pt-5 text-xs font-semibold text-muted-foreground">
          <Link href="/safety-center" className="hover:text-primary">Safety Center</Link>
          <Link href="/terms" className="hover:text-primary">Terms of Service</Link>
          <Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link>
        </footer>
      </div>
    </main>
  );
}
