export const SUPER_ADMIN_EMAIL = 'adrien@hearstcorporation.io';

export function getAdminEmails(): string[] {
  return [
    SUPER_ADMIN_EMAIL,
    ...(process.env.ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean),
  ];
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
