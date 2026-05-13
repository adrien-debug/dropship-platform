import { AppShell } from '@/components/layout/AppShell';

/**
 * Admin app layout — wraps all authenticated admin routes in the new
 * AppShell with stable 3-panel layout.
 *
 * The AppShell provides:
 *   - Sidebar (navigation)
 *   - LeftContextPanel (contextual info)
 *   - ChatPanel (central, stable)
 *   - RightContextPanel (metrics/actions)
 *
 * Children (page content) renders inside ChatPanel as fallback
 * until we migrate each page to the new panel-based architecture.
 */
export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
