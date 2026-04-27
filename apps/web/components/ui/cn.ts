/**
 * Trim utility — joins truthy class fragments with spaces. Avoids pulling
 * a full clsx/tailwind-merge dep for what amounts to a one-liner.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
