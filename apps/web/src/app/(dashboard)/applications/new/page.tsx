'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — create now opens as a modal on the Applications list. */
export default function NewApplicationRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/applications?new=1');
  }, [router]);
  return (
    <div className="p-8 text-sm text-slate-500">Redirecting to Applications…</div>
  );
}
