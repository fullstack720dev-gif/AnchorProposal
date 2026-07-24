'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TemplateDocThumbnail } from '@/components/template-doc-thumbnail';
import { resolveTemplateMeta } from '@/components/template-designer-panel';
import { cn } from '@/lib/utils';
import { Check, Eye, Loader2, Plus } from 'lucide-react';
import styles from './templates.module.css';

type Nested = Record<string, unknown>;

interface Template {
  id: string;
  name: string;
  preset: string | null;
  isPublished: boolean;
  version: number;
  isDefault?: boolean;
  updatedAt?: string;
  configJson?: Nested;
}

function asObj(value: unknown): Nested {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Nested) : {};
}

/** Keep the default template first so the checkmark is easy to find. */
function withDefaultFirst(list: Template[], defaultId: string | null): Template[] {
  return [...list]
    .map((t) => ({ ...t, isDefault: Boolean(defaultId) && t.id === defaultId }))
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
}

function TemplatesDashboardInner() {
  const { isAdmin } = useAuth();
  const canManageTemplates = isAdmin;
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialIdRef = useRef(searchParams.get('id'));

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialIdRef.current);
  const [previewHtml, setPreviewHtml] = useState('');
  const [pageSize, setPageSize] = useState('LETTER');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const loadedOnceRef = useRef(false);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) || null,
    [templates, selectedId],
  );

  const defaultTemplateId = useMemo(
    () => templates.find((t) => t.isDefault)?.id ?? null,
    [templates],
  );

  // Load list once on mount — do not re-fetch when ?id= changes (that was wiping default state).
  useEffect(() => {
    if (loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    let cancelled = false;

    (async () => {
      setLoadingList(true);
      try {
        const data = (await api.getTemplates()) as Template[];
        if (cancelled) return;
        const preferred =
          data.find((t) => t.isDefault)?.id ||
          (initialIdRef.current && data.some((t) => t.id === initialIdRef.current)
            ? initialIdRef.current
            : null) ||
          data[0]?.id ||
          null;
        const defaultId = data.find((t) => t.isDefault)?.id ?? null;
        setTemplates(withDefaultFirst(data, defaultId));
        setSelectedId(preferred);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to load templates');
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSetDefault = useCallback(async (templateId: string) => {
    setSettingDefaultId(templateId);
    // Optimistic: mark + pin to front immediately (no full-page reload / list flash).
    setTemplates((prev) => withDefaultFirst(prev, templateId));
    try {
      await api.setDefaultTemplate(templateId);
      toast.success('Default template updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set default');
      // Revert from server truth if the request failed.
      try {
        const data = (await api.getTemplates()) as Template[];
        const defaultId = data.find((t) => t.isDefault)?.id ?? null;
        setTemplates(withDefaultFirst(data, defaultId));
      } catch {
        /* keep optimistic state */
      }
    } finally {
      setSettingDefaultId(null);
    }
  }, []);

  const selectTemplate = useCallback(
    (t: Template) => {
      setSelectedId(t.id);
      if (!canManageTemplates) return;
      if (!t.isPublished) {
        toast.message('Publish this template before setting it as default');
        return;
      }
      if (t.isDefault || settingDefaultId === t.id) return;
      void handleSetDefault(t.id);
    },
    [canManageTemplates, handleSetDefault, settingDefaultId],
  );

  useEffect(() => {
    if (!selectedId) {
      setPreviewHtml('');
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    (async () => {
      try {
        const data = await api.getTemplate(selectedId);
        if (cancelled) return;
        const cfg = asObj(data.configJson);
        setPageSize(String(asObj(cfg.layout).pageSize || 'LETTER').toUpperCase());
        const preview = await api.getTemplatePreview(selectedId);
        if (cancelled) return;
        setPreviewHtml(preview.html);
        // Update URL without triggering a Next.js searchParams re-render / list reload.
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          if (url.searchParams.get('id') !== selectedId) {
            url.searchParams.set('id', selectedId);
            window.history.replaceState(window.history.state, '', url.pathname + url.search);
          }
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to load preview');
        }
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Templates</h1>
          <p className={styles.subtitle}>
            {canManageTemplates
              ? 'Click a published template to preview it and set it as default for applications. The checkmark stays on your default.'
              : 'Browse published templates available for generation.'}
          </p>
        </div>
        {canManageTemplates && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => router.push('/templates/new')}
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        )}
      </header>

      <div className={styles.workspace}>
        <div className={styles.left}>
          <section className={cn(styles.picker, styles.pickerScroll)}>
            <div className={styles.pickerHead}>
              <h2 className={styles.pickerTitle}>Choose a Template</h2>
              {defaultTemplateId && (
                <p className={styles.pickerHint}>
                  Default:{' '}
                  <span className={styles.pickerHintStrong}>
                    {templates.find((t) => t.id === defaultTemplateId)?.name || 'Selected'}
                  </span>
                </p>
              )}
            </div>

            {loadingList ? (
              <div className={styles.statusRow}>
                <Loader2 className={cn('w-4 h-4', styles.spin)} /> Loading templates…
              </div>
            ) : templates.length === 0 ? (
              <p className={styles.emptyHint}>No templates yet</p>
            ) : (
              <div className={styles.cardGrid}>
                {templates.map((t) => {
                  const meta = resolveTemplateMeta(t.name, t.preset, asObj(t.configJson));
                  const active = t.id === selectedId;
                  const isDefault = Boolean(t.isDefault);
                  return (
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      title={
                        canManageTemplates
                          ? t.isPublished
                            ? isDefault
                              ? 'Default template'
                              : 'Click to preview and set as default'
                            : 'Click to preview (publish to set as default)'
                          : 'Click to preview'
                      }
                      onClick={() => selectTemplate(t)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectTemplate(t);
                        }
                      }}
                      className={cn(
                        styles.card,
                        active && styles.cardActive,
                        isDefault && styles.cardDefault,
                      )}
                    >
                      <div className={styles.cardThumb}>
                        <TemplateDocThumbnail
                          config={asObj(t.configJson) as never}
                          className="h-36 border-b border-[var(--border)]"
                        />
                        {isDefault && (
                          <span className={styles.checkBadge} title="Default template">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {t.isPublished && (
                          <span className={styles.publishedBadge}>Published</span>
                        )}
                      </div>
                      <div className={styles.cardBody}>
                        <p className={styles.cardName}>
                          {t.name}
                          {isDefault ? (
                            <span className={styles.defaultInline}> · Default</span>
                          ) : null}
                        </p>
                        <p className={styles.cardDesc}>{meta.description}</p>
                        <div className={styles.tagRow}>
                          {meta.tags.map((tag) => (
                            <span
                              key={tag}
                              className={cn(styles.tag, active && styles.tagActive)}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        {canManageTemplates && (
                          <button
                            type="button"
                            className={styles.cardDetailBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/templates/${t.id}`);
                            }}
                          >
                            Detail
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <section className={styles.preview}>
          <div className={styles.previewHead}>
            <div className={styles.previewTitle}>
              <Eye className="w-4 h-4" />
              Live Preview
              {selected && <span className={styles.previewName}>— {selected.name}</span>}
            </div>
            {loadingPreview && (
              <span className={styles.previewUpdating}>
                <Loader2 className={cn('w-3 h-3', styles.spin)} /> Updating
              </span>
            )}
          </div>
          <div className={styles.previewBody}>
            {!selectedId ? (
              <p className={styles.emptyHint}>Select a template to preview</p>
            ) : (
              <>
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
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.fallback}>
          <Loader2 className={cn('w-4 h-4', styles.spin)} /> Loading templates…
        </div>
      }
    >
      <TemplatesDashboardInner />
    </Suspense>
  );
}
