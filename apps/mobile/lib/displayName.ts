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

/**
 * Soft suggestion from the email local-part (e.g. marie.dupont@… → Marie).
 * User can edit freely; never used as a stable identifier.
 */
export function suggestDisplayNameFromEmail(
  email: string | null | undefined,
): string {
  if (!email) return '';
  const at = email.indexOf('@');
  const local = (at >= 0 ? email.slice(0, at) : email).trim();
  if (!local) return '';

  const first = local.split(/[._+\-]+/).find((p) => p.replace(/\d/g, '').length > 0);
  if (!first) return '';

  const letters = first.replace(/^\d+|\d+$/g, '');
  const base = (letters || first).slice(0, DISPLAY_NAME_MAX_LEN);
  if (!base) return '';

  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}
