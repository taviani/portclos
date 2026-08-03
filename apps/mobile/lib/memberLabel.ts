/** Visible label for a house member / mention — never the opaque user id. */
export function memberLabel(person: {
  display_name?: string | null;
  email?: string | null;
}): string {
  const name = person.display_name?.trim();
  if (name) return name;
  const email = person.email?.trim();
  if (email) return email;
  return 'Membre';
}
