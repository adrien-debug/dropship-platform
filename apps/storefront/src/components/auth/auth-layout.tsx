import type { ReactNode } from 'react';
import Link from 'next/link';

export interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-[#f5f0e8]">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <Link href="/shop" className="inline-block">
            <img
              src="/logo-onepiece.png"
              alt="One Peace Shop"
              className="mx-auto h-16"
            />
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-[#333333] font-[family-name:var(--font-body)]">
            {title}
          </h1>
          <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-[#D9312B]" />
          {subtitle ? (
            <p className="mt-3 text-sm text-[#999999]">{subtitle}</p>
          ) : null}
        </header>

        <div className="rounded-2xl border border-[#eeeeee] bg-white p-8 shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
