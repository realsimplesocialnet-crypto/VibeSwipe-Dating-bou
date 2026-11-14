export function isProfileMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && 'status' in error && error.status === 404;
}

// The Discover endpoint returns 409 when this account has no saved profile.
// Do not mistake authorization, server, or network errors for unfinished setup.
export function isDiscoverSetupRequired(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && 'status' in error && error.status === 409;
}

export function shouldRetryDiscover(failureCount: number, error: unknown): boolean {
  return !isDiscoverSetupRequired(error) && shouldRetryProfile(failureCount, error);
}

export function shouldRetryProfile(failureCount: number, error: unknown): boolean {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? error.status
    : undefined;
  return status !== 404 && status !== 401 && status !== 403 && failureCount < 1;
}
