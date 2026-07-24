'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { Sidebar } from '@/components/sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface-muted">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <Sidebar mobile open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-primary-deep text-white border-b border-white/10">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="p-2 -ml-1 rounded-md text-white/90 hover:bg-white/10"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <BrandMark variant="light" href="/dashboard" showWordmark className="text-base" />
        </header>
        <main className="flex-1 min-h-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
