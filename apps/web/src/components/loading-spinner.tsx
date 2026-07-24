'use client';

import { cn } from '@/lib/utils';

type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
};

const SIZES = {
  sm: 'w-5 h-5',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
};

/** Geometric dual-frame spinner — not a standard circular loader. */
export function LoadingSpinner({ size = 'md', className, label }: LoadingSpinnerProps) {
  return (
    <div
      className={cn('inline-flex flex-col items-center gap-3', className)}
      role="status"
      aria-label={label || 'Loading'}
    >
      <div className={cn('relative', SIZES[size])}>
        <span
          className="absolute inset-0 border border-current opacity-90 animate-spin-slow"
          style={{ borderRadius: 2 }}
        />
        <span
          className="absolute inset-[18%] border border-current opacity-50 animate-spin-rev"
          style={{ borderRadius: 1 }}
        />
        <span className="absolute inset-[38%] bg-current opacity-80 animate-pulse" style={{ borderRadius: 1 }} />
      </div>
      {label ? <span className="text-xs tracking-wide uppercase opacity-70">{label}</span> : null}
      <span className="sr-only">{label || 'Loading'}</span>
    </div>
  );
}
