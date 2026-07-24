'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TemplateEditor } from '@/components/template-editor';
import { type DesignerTab } from '@/components/template-designer-panel';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import styles from '../templates.module.css';
import { cn } from '@/lib/utils';

type Nested = Record<string, unknown>;

export default function NewTemplatePage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const canManageTemplates = isAdmin;
  const router = useRouter();

  const [name, setName] = useState('');
  const [config, setConfig] = useState<Nested>({});
  const [tab, setTab] = useState<DesignerTab>('typography');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => name.trim().length > 0 || Object.keys(config).length > 0, [name, config]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userEdited = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!canManageTemplates) router.replace('/templates');
  }, [authLoading, canManageTemplates, router]);

  const refreshPreview = useCallback(async (cfg: Nested) => {
    setPreviewLoading(true);
    try {
      const { html } = await api.previewTemplateConfig(cfg);
      setPreviewHtml(html);
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPreview({}).catch(() => undefined);
  }, [refreshPreview]);

  useEffect(() => {
    if (!userEdited.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      refreshPreview(config).catch(() => undefined);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [config, refreshPreview]);

  const handleConfigChange = (next: Nested) => {
    userEdited.current = true;
    setConfig(next);
  };

  const handleBack = () => {
    if (dirty) {
      const ok = window.confirm('Discard this draft and go back?');
      if (!ok) return;
    }
    router.push('/templates');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    setSaving(true);
    try {
      const created = await api.createTemplate({
        name: name.trim(),
        configJson: config,
      });
      toast.success('Template created');
      router.replace(`/templates/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !canManageTemplates) {
    return (
      <div className={styles.fallback}>
        <Loader2 className={cn('w-4 h-4', styles.spin)} /> Loading…
      </div>
    );
  }

  return (
    <TemplateEditor
      title="Create Template"
      subtitle="Design a new resume template. Nothing is saved until you click Save."
      name={name}
      onNameChange={setName}
      tab={tab}
      onTabChange={setTab}
      config={config}
      onConfigChange={handleConfigChange}
      previewHtml={previewHtml}
      previewLoading={previewLoading}
      actions={
        <>
          <button type="button" className={styles.btnSecondary} onClick={handleBack}>
            <ArrowLeft className="w-4 h-4" /> Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={saving}
            onClick={handleSave}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    />
  );
}
