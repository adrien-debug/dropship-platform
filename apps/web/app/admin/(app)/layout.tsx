import { AdminShell } from '@/app/admin/_components/AdminShell';
import { getHeaderStats } from '@/app/admin/_components/getHeaderStats';

export const revalidate = 0;

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const stats = await getHeaderStats();
  return <AdminShell stats={stats}>{children}</AdminShell>;
}
