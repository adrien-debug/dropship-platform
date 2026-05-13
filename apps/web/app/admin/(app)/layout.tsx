import { AdminShell } from '../_components/AdminShell';

export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
