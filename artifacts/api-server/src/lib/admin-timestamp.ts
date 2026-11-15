/** PostgreSQL aggregate timestamps may be returned as strings, unlike mapped columns. */
export function adminTimestamp(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
