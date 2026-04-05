import { AccountGate } from '@/components/account/account-gate';
import { AccountLayout } from '@/components/account/account-layout';

export default function AccountSectionLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <AccountGate>
      <AccountLayout>{children}</AccountLayout>
    </AccountGate>
  );
}
