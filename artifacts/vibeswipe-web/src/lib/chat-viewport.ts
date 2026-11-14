export function chatViewportFrame(height: number, top: number, fullHeight: number, editing: boolean) {
  return {
    height: Math.max(0, height),
    top: Math.max(0, top),
    keyboardOpen: editing && fullHeight - height > 100,
  };
}
