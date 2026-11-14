export function isProfileMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && 'status' in error && error.status === 404;
}

export function shouldRetryProfile(failureCount: number, error: unknown): boolean {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? error.status
    : undefined;
  return status !== 404 && status !== 401 && status !== 403 && failureCount < 1;
}
