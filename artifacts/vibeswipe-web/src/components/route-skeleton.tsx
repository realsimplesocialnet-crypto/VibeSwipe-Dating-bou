export function RouteSkeleton({ label = "Loading page" }: { label?: string }) {
  const block = {
    borderRadius: 18,
    background: "rgba(255, 255, 255, .075)",
  } as const;
  return (
    <main
      role="status"
      aria-label={label}
      style={{
        minHeight: "100dvh",
        boxSizing: "border-box",
        background: "#0f0f12",
        padding: "28px 18px",
        color: "#fbf5f7",
      }}
    >
      <span style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>{label}</span>
      <div aria-hidden="true" style={{ width: "100%", maxWidth: 680, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ ...block, width: 160, height: 30, borderRadius: 999 }} />
        <div style={{ ...block, height: 48 }} />
        <div style={{ ...block, height: 96 }} />
        <div style={{ ...block, width: "100%", aspectRatio: "4 / 5", maxHeight: 560, borderRadius: 28 }} />
        <div style={{ ...block, height: 48 }} />
      </div>
    </main>
  );
}
