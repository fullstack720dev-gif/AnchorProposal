'use client';

import { cn } from '@/lib/utils';

export type DesignerTab =
  | 'typography'
  | 'layout'
  | 'colors'
  | 'style'
  | 'contact'
  | 'experience'
  | 'education'
  | 'certifications'
  | 'sections'
  | 'pdf';

type Nested = Record<string, unknown>;

const SECTION_KEYS = ['summary', 'skills', 'experience', 'education', 'certifications'] as const;

const FONTS = ['Inter', 'Georgia', 'Arial', 'Times New Roman', 'Calibri', 'Garamond'];

const inputClass =
  'w-full px-2.5 py-1.5 rounded-lg text-sm bg-white border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

const labelClass = 'block text-xs font-medium text-slate-600 mb-1';

function asObj(value: unknown): Nested {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Nested) : {};
}

export const DESIGNER_TABS: { key: DesignerTab; label: string }[] = [
  { key: 'typography', label: 'Typography' },
  { key: 'layout', label: 'Layout' },
  { key: 'colors', label: 'Colors' },
  { key: 'style', label: 'Style' },
  { key: 'contact', label: 'Contact' },
  { key: 'experience', label: 'Experience' },
  { key: 'education', label: 'Education' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'sections', label: 'Sections' },
  { key: 'pdf', label: 'PDF Style' },
];

export function TemplateDesignerPanel({
  tab,
  onTabChange,
  config,
  onChange,
}: {
  tab: DesignerTab;
  onTabChange: (tab: DesignerTab) => void;
  config: Nested;
  onChange: (next: Nested) => void;
}) {
  const typography = asObj(config.typography);
  const colors = asObj(config.colors);
  const layout = asObj(config.layout);
  const style = asObj(config.styles);
  const sections = asObj(config.sections);
  const visibility = asObj(sections.visibility);

  const setTypography = (key: string, value: unknown) => {
    onChange({
      ...config,
      typography: { ...typography, [key]: value },
    });
  };

  const setColors = (key: string, value: unknown) => {
    onChange({
      ...config,
      colors: { ...colors, [key]: value },
    });
  };

  const setLayout = (key: string, value: unknown) => {
    onChange({
      ...config,
      layout: { ...layout, [key]: value },
    });
  };

  const setStyle = (key: string, value: unknown) => {
    onChange({
      ...config,
      styles: { ...style, [key]: value },
    });
  };

  const setSectionVisible = (key: string, visible: boolean) => {
    const order =
      Array.isArray(sections.order) && sections.order.length ? sections.order : [...SECTION_KEYS];
    onChange({
      ...config,
      sections: {
        ...sections,
        order,
        visibility: { ...visibility, [key]: visible },
      },
    });
  };

  const sectionToggle = (key: string, label: string) => (
    <label className="flex items-center justify-between gap-3 text-sm text-slate-700 py-2">
      <span>Show {label}</span>
      <input
        type="checkbox"
        checked={visibility[key] !== false}
        onChange={(e) => setSectionVisible(key, e.target.checked)}
        className="rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500/30"
      />
    </label>
  );

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white overflow-hidden flex flex-col min-h-0 shadow-sm">
      <div className="flex flex-wrap gap-1 p-2 border-b border-[var(--border)] bg-slate-50/80">
        {DESIGNER_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTabChange(t.key)}
            className={cn(
              'px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors',
              tab === t.key
                ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {tab === 'typography' && (
          <>
            <div>
              <label className={labelClass}>Font Family</label>
              <select
                value={String(typography.bodyFont || 'Inter')}
                onChange={(e) => setTypography('bodyFont', e.target.value)}
                className={inputClass}
              >
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Heading font</label>
              <select
                value={String(typography.headingFont || typography.bodyFont || 'Inter')}
                onChange={(e) => setTypography('headingFont', e.target.value)}
                className={inputClass}
              >
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Body Size (pt)</label>
                <input
                  type="number"
                  min={8}
                  max={16}
                  value={Number(typography.baseFontSize ?? 11)}
                  onChange={(e) => setTypography('baseFontSize', parseInt(e.target.value, 10) || 11)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Heading Scale</label>
                <input
                  type="number"
                  step="0.05"
                  min={1}
                  max={2}
                  value={Number(typography.headingScale ?? 1.2)}
                  onChange={(e) => setTypography('headingScale', parseFloat(e.target.value) || 1.2)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Line Height</label>
                <input
                  type="number"
                  step="0.1"
                  min={1}
                  max={2.5}
                  value={Number(typography.lineHeight ?? 1.4)}
                  onChange={(e) => setTypography('lineHeight', parseFloat(e.target.value) || 1.4)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Letter Spacing</label>
                <input
                  type="number"
                  step="0.1"
                  value={Number(typography.letterSpacing ?? 0)}
                  onChange={(e) => setTypography('letterSpacing', parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center justify-between text-sm text-slate-700">
                <span>Name Uppercase</span>
                <input
                  type="checkbox"
                  checked={Boolean(typography.nameUppercase)}
                  onChange={(e) => setTypography('nameUppercase', e.target.checked)}
                  className="rounded border-slate-300 bg-white text-blue-600"
                />
              </label>
              <label className="flex items-center justify-between text-sm text-slate-700">
                <span>Heading Uppercase</span>
                <input
                  type="checkbox"
                  checked={typography.headingUppercase !== false}
                  onChange={(e) => setTypography('headingUppercase', e.target.checked)}
                  className="rounded border-slate-300 bg-white text-blue-600"
                />
              </label>
            </div>
          </>
        )}

        {tab === 'colors' && (
          <>
            {(
              [
                ['primary', 'Primary'],
                ['heading', 'Heading'],
                ['body', 'Body'],
                ['accent', 'Accent'],
                ['divider', 'Divider'],
                ['sectionLabelBg', 'Section label background'],
                ['sectionLabelText', 'Section label text'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={String(
                      colors[key] ||
                        (key === 'sectionLabelBg'
                          ? '#e8eef5'
                          : key === 'sectionLabelText'
                            ? '#1e293b'
                            : '#1e3a5f'),
                    )}
                    onChange={(e) => setColors(key, e.target.value)}
                    className="h-9 w-12 rounded border border-slate-300 cursor-pointer bg-white p-0.5"
                  />
                  <input
                    type="text"
                    value={String(colors[key] || '')}
                    onChange={(e) => setColors(key, e.target.value)}
                    className={cn(inputClass, 'font-mono text-xs')}
                    placeholder="#000000"
                  />
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'style' && (
          <>
            <div>
              <label className={labelClass}>Section heading style</label>
              <select
                value={String(style.sectionHeadingStyle || 'underline')}
                onChange={(e) => setStyle('sectionHeadingStyle', e.target.value)}
                className={inputClass}
              >
                <option value="underline">Underline</option>
                <option value="background">Background bar</option>
                <option value="bar">Left accent bar</option>
                <option value="plain">Plain text</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Background uses the Section label background color from Colors.
              </p>
            </div>
            <div>
              <label className={labelClass}>Experience list type</label>
              <select
                value={String(style.listStyle || 'disc')}
                onChange={(e) => setStyle('listStyle', e.target.value)}
                className={inputClass}
              >
                <option value="disc">Disc bullets</option>
                <option value="circle">Circle bullets</option>
                <option value="square">Square bullets</option>
                <option value="dash">Dashes</option>
                <option value="none">No markers</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Skills layout</label>
              <select
                value={String(style.skillsLayout || 'comma')}
                onChange={(e) => setStyle('skillsLayout', e.target.value)}
                className={inputClass}
              >
                <option value="comma">Category: item, item</option>
                <option value="lines">One category per line</option>
                <option value="bullets">Bullet list</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Job title weight</label>
              <select
                value={String(style.experienceTitleWeight || 'bold')}
                onChange={(e) => setStyle('experienceTitleWeight', e.target.value)}
                className={inputClass}
              >
                <option value="bold">Bold</option>
                <option value="normal">Normal</option>
              </select>
            </div>
            <label className="flex items-center justify-between text-sm text-slate-700 pt-1">
              <span>Show section dividers</span>
              <input
                type="checkbox"
                checked={style.showDividers !== false}
                onChange={(e) => setStyle('showDividers', e.target.checked)}
                className="rounded border-slate-300 bg-white text-blue-600"
              />
            </label>
          </>
        )}

        {tab === 'layout' && (
          <>
            <div>
              <label className={labelClass}>Header alignment</label>
              <select
                value={String(layout.headerAlignment || 'left')}
                onChange={(e) => setLayout('headerAlignment', e.target.value)}
                className={inputClass}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Section spacing</label>
              <input
                type="number"
                min={4}
                max={48}
                value={Number(layout.sectionSpacing ?? 16)}
                onChange={(e) => setLayout('sectionSpacing', parseInt(e.target.value, 10) || 16)}
                className={inputClass}
              />
            </div>
          </>
        )}

        {tab === 'pdf' && (
          <>
            <div>
              <label className={labelClass}>Page size</label>
              <select
                value={String(layout.pageSize || 'LETTER')}
                onChange={(e) => setLayout('pageSize', e.target.value)}
                className={inputClass}
              >
                <option value="LETTER">Letter</option>
                <option value="A4">A4</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['marginTop', 'Margin top'],
                  ['marginBottom', 'Margin bottom'],
                  ['marginLeft', 'Margin left'],
                  ['marginRight', 'Margin right'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className={labelClass}>{label}</label>
                  <input
                    type="number"
                    min={12}
                    max={96}
                    value={Number(
                      layout[key] ?? (key.includes('Left') || key.includes('Right') ? 48 : 36),
                    )}
                    onChange={(e) => setLayout(key, parseInt(e.target.value, 10) || 36)}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'contact' && sectionToggle('summary', 'Professional Summary / Contact block')}
        {tab === 'experience' && sectionToggle('experience', 'Experience')}
        {tab === 'education' && sectionToggle('education', 'Education')}
        {tab === 'certifications' && sectionToggle('certifications', 'Certifications')}

        {tab === 'sections' && (
          <div className="space-y-1">
            <p className="text-xs text-slate-500 mb-2">Toggle which sections appear in the resume.</p>
            {SECTION_KEYS.map((section) => (
              <label
                key={section}
                className="flex items-center gap-2.5 text-sm capitalize text-slate-700 py-1"
              >
                <input
                  type="checkbox"
                  checked={visibility[section] !== false}
                  onChange={(e) => setSectionVisible(section, e.target.checked)}
                  className="rounded border-slate-300 bg-white text-blue-600"
                />
                {section}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function resolveTemplateMeta(
  name: string,
  preset: string | null | undefined,
  config: Nested,
): { description: string; tags: string[] } {
  const meta = asObj(config.meta);
  const tags = Array.isArray(meta.tags) ? meta.tags.map(String) : [];
  if (meta.description || tags.length) {
    return {
      description: String(meta.description || ''),
      tags,
    };
  }

  const key = (preset || name || '').toLowerCase();
  if (key.includes('modern') || key.includes('minimal')) {
    return {
      description: 'Clean modern layout optimized for tech roles and ATS parsing.',
      tags: ['Modern', 'Tech', 'ATS'],
    };
  }
  if (key.includes('classic') || key.includes('professional')) {
    return {
      description: 'Traditional professional styling for corporate and executive resumes.',
      tags: ['Classic', 'Professional'],
    };
  }
  if (key.includes('federal') || key.includes('gov')) {
    return {
      description: 'Structured format suited for government and federal applications.',
      tags: ['Federal', 'Formal'],
    };
  }
  if (key.includes('health')) {
    return {
      description: 'Clear clinical-friendly layout for healthcare professionals.',
      tags: ['Healthcare', 'ATS'],
    };
  }
  return {
    description: 'Custom resume template for tailored generation.',
    tags: ['Custom'],
  };
}
