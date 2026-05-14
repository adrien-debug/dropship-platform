import { AdminShell } from '../_components/AdminShell';
import { getHeaderStats } from '../_components/getHeaderStats';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const stats = await getHeaderStats();
  return <AdminShell stats={stats}>{children}</AdminShell>;
}
