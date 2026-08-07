/** Max length accepted by PATCH /me (API). */
export const DISPLAY_NAME_MAX_LEN = 80;

/** Trimmed display name, or null if empty / too long. */
export function normalizeDisplayName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return null;
  if (name.length > DISPLAY_NAME_MAX_LEN) return null;
  return name;
}

export function hasDisplayName(person: { display_name?: string | null }): boolean {
  return Boolean(person.display_name?.trim());
}
