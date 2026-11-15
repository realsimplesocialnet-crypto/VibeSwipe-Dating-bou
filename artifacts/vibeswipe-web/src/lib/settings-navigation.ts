/** Explicit local return destinations prevent Settings from returning to itself. */
export function settingsBackTarget(value: string | null, currentPath: string, origin: string): string {
  const isIndex = currentPath.replace(/\/+$/, "") === "/settings";
  const fallback = isIndex ? "/profile" : "/settings";
  if (!value || value.startsWith("//")) return fallback;
  try {
    const target = new URL(value, origin);
    const path = target.pathname.replace(/\/+$/, "") || "/";
    if (target.origin !== origin || target.username || target.password
      || path === currentPath.replace(/\/+$/, "")
      || (isIndex && path.startsWith("/settings/"))) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return fallback; }
}
