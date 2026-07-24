'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { LoadingSpinner } from '@/components/loading-spinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-primary-deep px-4">
        <LoadingSpinner size="lg" className="text-white" label="Loading" />
        <a
          href="/login"
          className="text-sm text-white/70 underline underline-offset-2 hover:text-white"
        >
          Taking too long? Open sign in
        </a>
      </div>
    );
  }

  if (!user) return null;

  return <AppShell>{children}</AppShell>;
}
