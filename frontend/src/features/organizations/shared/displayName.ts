/** Users only have an email, so derive a readable name from its local part. */
export function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  const words = local.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return email;
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
