import Link from 'next/link';
import { cn } from '@/lib/utils';

type BrandMarkProps = {
  variant?: 'light' | 'dark';
  href?: string | null;
  className?: string;
  showWordmark?: boolean;
};

export function BrandMark({
  variant = 'dark',
  href = '/',
  className,
  showWordmark = true,
}: BrandMarkProps) {
  const color = variant === 'light' ? 'text-white' : 'text-primary-deep';
  const content = (
    <span className={cn('inline-flex items-center gap-2.5', color, className)}>
      <svg
        viewBox="0 0 40 40"
        className="w-8 h-8 shrink-0"
        fill="none"
        aria-hidden
      >
        <rect x="3" y="3" width="34" height="34" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M20 8 L20 28 M20 28 L12 20 M20 28 L28 20"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="11" r="2" fill="currentColor" />
      </svg>
      {showWordmark && (
        <span className="font-sans text-lg font-semibold tracking-tight leading-none">
          AnchorProposal
        </span>
      )}
    </span>
  );

  if (href === null) return content;
  return (
    <Link href={href} className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded">
      {content}
    </Link>
  );
}
