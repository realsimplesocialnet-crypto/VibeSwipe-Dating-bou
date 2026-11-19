export function chatViewportFrame(height: number, top: number, fullHeight: number, editing: boolean) {
  const visibleHeight = Math.max(0, Math.round(height));
  const visibleTop = Math.max(0, Math.round(top));
  return {
    // Keep the app anchored to the layout viewport's top. iOS Safari can pan
    // the visual viewport while focusing an input; fold that offset into the
    // height so the composer follows the keyboard without moving the header.
    height: visibleHeight + visibleTop,
    top: 0,
    keyboardOpen: editing && fullHeight - height > 100,
  };
}
