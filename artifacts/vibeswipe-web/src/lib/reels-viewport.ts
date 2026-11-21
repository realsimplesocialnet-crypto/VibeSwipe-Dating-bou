/** Size both panes inside Safari's visible area, including its keyboard-time pan. */
export function reelsViewportFrame(height: number, top: number, fullHeight: number, editing: boolean) {
  const visibleHeight = Math.max(0, height);
  const keyboardOpen = editing && fullHeight - height > 100;
  const regularCommentsHeight = Math.round(visibleHeight * 0.62);
  const keyboardCommentsHeight = Math.min(
    visibleHeight * 0.72,
    Math.max(160, regularCommentsHeight),
  );
  const frame = {
    height: visibleHeight,
    top: Math.max(0, top),
    keyboardOpen,
  };
  return {
    ...frame,
    commentsHeight: Math.min(
      560,
      keyboardOpen ? keyboardCommentsHeight : regularCommentsHeight,
    ),
  };
}

/** Loading placeholders are not Reel slides and must never become the active index. */
export function reelSlideIndex(value: string | undefined, count: number): number | null {
  if (value === undefined || value.trim() === "") return null;
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < count ? index : null;
}
