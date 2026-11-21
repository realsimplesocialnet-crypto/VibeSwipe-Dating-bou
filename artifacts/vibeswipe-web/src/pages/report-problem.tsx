import { ArrowLeft, CheckCircle2, Flag, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { useSubmitSupportRequest } from "@workspace/api-client-react";
import { useAppLanguage } from "@/lib/app-language";

type Category = "bug" | "account" | "safety" | "accessibility" | "other";

export default function ReportProblemPage() {
  const { t } = useAppLanguage();
  const submit = useSubmitSupportRequest();
  const [category, setCategory] = useState<Category>("bug");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await submit.mutateAsync({ data: { category, details: details.trim() } });
      setSent(true);
    } catch {
      setError(t("Your request could not be sent. Check your connection and try again."));
    }
  }

  return <main className="min-h-[100dvh] bg-background px-4 pb-28 pt-[calc(env(safe-area-inset-top)+20px)] text-foreground sm:px-6">
    <div className="mx-auto max-w-2xl">
      <Link href="/settings" className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="link-report-problem-back"><ArrowLeft size={18}/>{t("Settings")}</Link>
      <header className="mb-7 flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary"><Flag size={22}/></span>
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">{t("Support")}</p><h1 className="mt-1 text-2xl font-extrabold">{t("Report a problem")}</h1></div>
      </header>
      {sent ? <section className="space-y-4 py-8" role="status" data-testid="support-request-success">
        <CheckCircle2 size={36} className="text-emerald-400"/>
        <h2 className="text-lg font-bold">{t("Your request was sent to the support team.")}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{t("Our team can review your request from the support inbox.")}</p>
        <Link href="/settings" className="inline-flex min-h-11 items-center rounded-xl bg-white/[.08] px-4 font-bold">{t("Back to settings")}</Link>
      </section> : <form onSubmit={handleSubmit} className="space-y-5" data-testid="form-report-problem">
        <p className="text-sm leading-6 text-muted-foreground">{t("Use this form for bugs, account access, or accessibility issues. Safety concerns have a separate report flow.")}</p>
        <label className="block text-sm font-semibold">
          {t("Category")}
          <select value={category} onChange={(event) => setCategory(event.target.value as Category)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#19161c] px-3 text-sm text-foreground outline-none focus:border-primary/60" data-testid="select-support-category">
            <option value="bug">{t("Bug or technical problem")}</option>
            <option value="account">{t("Account access")}</option>
            <option value="safety">{t("Safety concern")}</option>
            <option value="accessibility">{t("Accessibility")}</option>
            <option value="other">{t("Other")}</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">
          {t("Describe the problem")}
          <textarea value={details} onChange={(event) => setDetails(event.target.value.slice(0, 2000))} minLength={5} maxLength={2000} required rows={7} placeholder={t("Tell us what happened and which screen you were using.")} className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-[#19161c] p-4 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60" data-testid="textarea-support-details"/>
          <span className="mt-1 block text-right text-xs text-muted-foreground">{details.length}/2000</span>
        </label>
        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" data-testid="support-request-error">{error}</p>}
        <button type="submit" disabled={submit.isPending || details.trim().length < 5} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-[#25111c] disabled:opacity-50" data-testid="button-submit-support-request">
          {submit.isPending ? <><LoaderCircle size={18} className="animate-spin"/>{t("Sending…")}</> : t("Send to support")}
        </button>
        <p className="text-xs leading-5 text-muted-foreground">{t("Do not include your password, login code, or payment details.")}</p>
      </form>}
    </div>
  </main>;
}
