/** Client-side tag normalization — mirrors API rules in httpserver. */
export function normalizeBlogTag(raw: string): string | null {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/\s+/g, '');
  if (!t || !/^[a-z0-9][a-z0-9_-]{0,23}$/.test(t)) return null;
  return t;
}
