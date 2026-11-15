import { BadgeCheck } from "lucide-react";

export function VerifiedBadge({ verified, className = "" }: { verified?: boolean; className?: string }) {
  return verified ? <span role="img" aria-label="Verified profile" title="Verified profile" data-testid="verified-profile-badge" className={`ml-1 inline-flex align-middle text-[#2997e8] ${className}`}><BadgeCheck size={20} fill="currentColor" stroke="white" strokeWidth={2}/></span> : null;
}
