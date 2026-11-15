/** Size both panes inside Safari's visible area, including its keyboard-time pan. */
export function reelsViewportFrame(height: number, top: number, fullHeight: number, editing: boolean) {
  const frame = {
    height: Math.max(0, height),
    top: Math.max(0, top),
    keyboardOpen: editing && fullHeight - height > 100,
  };
  return {
    ...frame,
    commentsHeight: Math.min(300, Math.round(frame.height * 0.4)),
  };
}

/** Loading placeholders are not Reel slides and must never become the active index. */
export function reelSlideIndex(value: string | undefined, count: number): number | null {
  if (value === undefined || value.trim() === "") return null;
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < count ? index : null;
}
