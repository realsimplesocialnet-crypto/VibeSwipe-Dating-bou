export function chatViewportFrame(height: number, top: number, fullHeight: number, editing: boolean) {
  return {
    height: Math.max(0, Math.round(height)),
    top: Math.max(0, Math.round(top)),
    keyboardOpen: editing && fullHeight - height > 100,
  };
}
