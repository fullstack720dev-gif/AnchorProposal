'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/loading-spinner';

/** Legacy designer URL → template detail editor. */
export default function TemplateDesignerRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (id) router.replace(`/templates/${id}`);
    else router.replace('/templates');
  }, [id, router]);

  return (
    <div className="min-h-screen bg-surface-muted text-primary flex items-center justify-center">
      <LoadingSpinner size="md" className="text-primary" label="Opening template" />
    </div>
  );
}
