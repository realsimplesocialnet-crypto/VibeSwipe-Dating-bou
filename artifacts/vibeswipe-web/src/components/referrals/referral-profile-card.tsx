import { getGetMyReferralSummaryQueryKey, useGetMyReferralSummary } from "@workspace/api-client-react";
import { Copy, Share2, Sparkles } from "lucide-react";
import { useState } from "react";

const SIGNUP_URL = "https://myage.beauty/sign-up";

export function ReferralProfileCard() {
  const summary = useGetMyReferralSummary({
    query: {
      queryKey: getGetMyReferralSummaryQueryKey(),
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });
  const [feedback, setFeedback] = useState("");

  async function copyCode() {
    if (!summary.data) return;
    try {
      await navigator.clipboard.writeText(summary.data.referralCode);
      setFeedback("Code copied");
    } catch {
      setFeedback("Could not copy code");
    }
  }

  async function shareCode() {
    if (!summary.data) return;
    const url = `${SIGNUP_URL}?ref=${encodeURIComponent(summary.data.referralCode)}`;
    const text = `Join me on Myage with my referral code ${summary.data.referralCode}. Your signup helps me earn points.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join me on Myage", text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setFeedback("Invite link copied");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFeedback("Could not share invite");
    }
  }

  return (
    <section data-testid="referral-profile-card" className="op-section shrink-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="op-label">
            <span className="op-ico"><Sparkles size={13} /></span>
            Referral points
          </h3>
          {summary.isLoading ? (
            <p className="op-muted mt-1.5 text-xs">Loading your referral code…</p>
          ) : summary.isError || !summary.data ? (
            <button type="button" onClick={() => void summary.refetch()} className="op-muted mt-1.5 text-xs underline">
              Could not load. Tap to retry.
            </button>
          ) : (
            <>
              <p className="mt-1.5 text-[13px] font-semibold tracking-[.12em]">{summary.data.referralCode}</p>
              <p className="op-muted mt-0.5 text-xs">
                {summary.data.points} points · {summary.data.referralCount} joined
              </p>
            </>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            data-testid="button-copy-referral-code"
            disabled={!summary.data}
            onClick={() => void copyCode()}
            className="op-manage inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold disabled:opacity-50"
          >
            <Copy size={13} /> Copy
          </button>
          <button
            type="button"
            data-testid="button-share-referral-code"
            disabled={!summary.data}
            onClick={() => void shareCode()}
            className="op-manage inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold disabled:opacity-50"
          >
            <Share2 size={13} /> Share
          </button>
        </div>
      </div>
      {feedback ? <p role="status" className="op-muted mt-1 text-[11px]">{feedback}</p> : null}
    </section>
  );
}
