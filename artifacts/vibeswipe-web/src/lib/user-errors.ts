/** Public messages only: never expose API bodies, signed URLs, or stack traces. */
export function userErrorMessage(error: unknown, fallback: string): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You’re offline. Reconnect to the internet, then try again. Keep this screen open to keep your latest changes.';
  }
  if (error && typeof error === 'object') {
    // Only this explicit public validation message may pass through from the API.
    // Never display arbitrary response bodies or provider errors.
    const photoMessages = new Set([
      "This photo doesn’t match your verified face. Please upload a photo of yourself.",
      "Photo checking could not be completed. Please try again.",
    ]);
    if ('data' in error && error.data && typeof error.data === 'object' &&
        'error' in error.data && typeof error.data.error === 'string' &&
        photoMessages.has(error.data.error)) return error.data.error;
    if ('userMessage' in error && typeof error.userMessage === 'string') return error.userMessage;
    const status = 'status' in error ? error.status : undefined;
    if (status === 401) return 'Your session has expired. Sign in again to continue.';
    if (status === 403) return 'This action is not available for your account. Refresh this screen and try again.';
    if (status === 413) return 'This file is too large. Choose a smaller file and try again.';
    if (status === 429) return 'Too many attempts. Wait a moment, then try again.';
    if (typeof status === 'number' && status >= 500) return 'VibeSwipes is having trouble responding. Please try again shortly.';
    if ('name' in error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      return 'The connection took too long. Check your internet connection and try again.';
    }
  }
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) {
    return 'Couldn’t connect to VibeSwipes. Check your internet connection and try again.';
  }
  return fallback;
}
