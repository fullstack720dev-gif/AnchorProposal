'use client';

import { type ReactNode } from 'react';
import {
  TemplateDesignerPanel,
  type DesignerTab,
} from '@/components/template-designer-panel';
import { cn } from '@/lib/utils';
import { Eye, Loader2 } from 'lucide-react';
import styles from '@/app/(dashboard)/templates/templates.module.css';

type Nested = Record<string, unknown>;

function asObj(value: unknown): Nested {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Nested) : {};
}

export function TemplateEditor({
  title,
  subtitle,
  actions,
  name,
  onNameChange,
  showNameField = true,
  tab,
  onTabChange,
  config,
  onConfigChange,
  previewHtml,
  previewLoading,
  nameDisabled,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  name: string;
  onNameChange: (name: string) => void;
  showNameField?: boolean;
  tab: DesignerTab;
  onTabChange: (tab: DesignerTab) => void;
  config: Nested;
  onConfigChange: (config: Nested) => void;
  previewHtml: string;
  previewLoading?: boolean;
  nameDisabled?: boolean;
}) {
  const pageSize = String(asObj(config.layout).pageSize || 'LETTER').toUpperCase();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>

      <div className={styles.workspace}>
        <div className={cn(styles.left, styles.editorLeft)}>
          {showNameField && (
            <div className={styles.nameFieldCard}>
              <label className={styles.fieldLabel} htmlFor="template-name">
                Template name
              </label>
              <input
                id="template-name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                disabled={nameDisabled}
                placeholder="Untitled template"
                className={styles.fieldInput}
              />
            </div>
          )}
          <TemplateDesignerPanel
            tab={tab}
            onTabChange={onTabChange}
            config={config}
            onChange={onConfigChange}
          />
        </div>

        <section className={styles.preview}>
          <div className={styles.previewHead}>
            <div className={styles.previewTitle}>
              <Eye className="w-4 h-4" />
              Live Preview
              {name.trim() ? <span className={styles.previewName}>— {name.trim()}</span> : null}
            </div>
            {previewLoading && (
              <span className={styles.previewUpdating}>
                <Loader2 className={cn('w-3 h-3', styles.spin)} /> Updating
              </span>
            )}
          </div>
          <div className={styles.previewBody}>
            <div
              className={cn(
                styles.paper,
                pageSize === 'A4' ? styles.paperA4 : styles.paperLetter,
              )}
            >
              <iframe srcDoc={previewHtml} title="Template Preview" />
            </div>
            <p className={styles.paperCaption}>
              {pageSize === 'A4' ? 'A4' : 'Letter'} · Preview
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
