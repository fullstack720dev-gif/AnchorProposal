'use client';

import { cn } from '@/lib/utils';

type TemplateConfigLike = {
  typography?: {
    bodyFont?: string;
    headingFont?: string;
    baseFontSize?: number;
  };
  colors?: {
    primary?: string;
    heading?: string;
    body?: string;
    accent?: string;
    divider?: string;
  };
  layout?: {
    headerAlignment?: 'left' | 'center';
  };
};

type TemplateDocThumbnailProps = {
  config?: TemplateConfigLike | null;
  className?: string;
};

export function TemplateDocThumbnail({ config, className }: TemplateDocThumbnailProps) {
  const colors = config?.colors ?? {};
  const typography = config?.typography ?? {};
  const primary = colors.primary || '#1e3a5f';
  const heading = colors.heading || '#1e293b';
  const body = colors.body || '#334155';
  const accent = colors.accent || '#3b82f6';
  const divider = colors.divider || '#e2e8f0';
  const bodyFont = typography.bodyFont || 'Inter, system-ui, sans-serif';
  const headingFont = typography.headingFont || bodyFont;
  const align = config?.layout?.headerAlignment === 'center' ? 'center' : 'left';

  return (
    <div className={cn('relative h-48 w-full bg-white overflow-hidden', className)}>
      <div
        className="absolute inset-0 p-4 sm:p-5 leading-snug"
        style={{ fontFamily: bodyFont, color: body }}
      >
        <div style={{ textAlign: align, marginBottom: 12 }}>
          <div
            className="font-bold truncate"
            style={{
              fontFamily: headingFont,
              color: primary,
              fontSize: 18,
              lineHeight: 1.15,
            }}
          >
            Your Name
          </div>
          <div style={{ color: accent, fontSize: 12, marginTop: 4 }}>Professional Title</div>
          <div style={{ opacity: 0.7, fontSize: 10, marginTop: 3 }}>
            City · email@example.com · (000) 000-0000
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div
            className="font-semibold"
            style={{
              fontFamily: headingFont,
              color: heading,
              fontSize: 11,
              borderBottom: `1px solid ${divider}`,
              paddingBottom: 3,
              marginBottom: 6,
            }}
          >
            Professional Summary
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 rounded-sm w-full opacity-35" style={{ background: body }} />
            <div className="h-1.5 rounded-sm w-[94%] opacity-30" style={{ background: body }} />
            <div className="h-1.5 rounded-sm w-[82%] opacity-25" style={{ background: body }} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div
            className="font-semibold"
            style={{
              fontFamily: headingFont,
              color: heading,
              fontSize: 11,
              borderBottom: `1px solid ${divider}`,
              paddingBottom: 3,
              marginBottom: 6,
            }}
          >
            Experience
          </div>
          <div className="flex justify-between gap-2 font-semibold" style={{ color: heading, fontSize: 11 }}>
            <span className="truncate">Job Title — Company</span>
            <span className="shrink-0 opacity-70 font-normal text-[10px]">Dates</span>
          </div>
          <div className="mt-2 space-y-1.5 pl-0.5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
              <div className="h-1.5 rounded-sm flex-1 opacity-30" style={{ background: body }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
              <div className="h-1.5 rounded-sm w-[88%] opacity-25" style={{ background: body }} />
            </div>
          </div>
        </div>

        <div>
          <div
            className="font-semibold"
            style={{
              fontFamily: headingFont,
              color: heading,
              fontSize: 11,
              borderBottom: `1px solid ${divider}`,
              paddingBottom: 3,
              marginBottom: 6,
            }}
          >
            Skills
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['Skill', 'Skill', 'Skill', 'Skill'].map((tag, i) => (
              <span
                key={i}
                className="rounded px-2 py-0.5 text-[10px]"
                style={{
                  background: `${accent}22`,
                  border: `1px solid ${accent}44`,
                  color: heading,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
