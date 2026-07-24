'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { ArrowLeft, Download, Copy, Sparkles, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function ResumePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<Record<string, unknown> | null>(null);
  const [selectedGen, setSelectedGen] = useState<Record<string, unknown> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; isPublished: boolean }[]>([]);
  const [templateId, setTemplateId] = useState('');

  const load = () => {
    api.getApplication(id).then((data) => {
      setApp(data);
      const gens = (data.generations as Record<string, unknown>[]) || [];
      if (gens.length > 0) setSelectedGen(gens[0]);
    });
  };

  useEffect(() => {
    load();
    api
      .getTemplates()
      .then((data) => {
        const list = (data as { id: string; name: string; isPublished: boolean }[]).filter((t) => t.isPublished);
        setTemplates(list);
        if (list[0]) setTemplateId(list[0].id);
      })
      .catch(() => undefined);
  }, [id]);

  const pollGeneration = async (
    generationId: string,
    maxAttempts = 90,
  ): Promise<{ status: string; errorMessage?: string | null }> => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const gen = await api.getGeneration(generationId);
        const status = gen.status as string;
        if (status === 'COMPLETED' || status === 'FAILED') {
          return {
            status,
            errorMessage: (gen.errorMessage as string | null | undefined) || null,
          };
        }
      } catch {
        /* keep polling */
      }
      load();
    }
    return { status: 'FAILED', errorMessage: 'Generation timed out — check status on this page' };
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    try {
      const started = (await api.startGeneration(id, templateId || undefined)) as {
        id: string;
        status: string;
      };
      toast.message('Generation started…');
      const terminal = await pollGeneration(started.id);
      await load();
      if (terminal.status === 'COMPLETED') {
        toast.success('Resume regenerated');
      } else if (terminal.status === 'FAILED') {
        toast.error(terminal.errorMessage || 'Generation failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (fileId: string, filename: string) => {
    const token = api.getAccessToken();
    fetch(api.getDocumentUrl(fileId), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
      });
  };

  if (!app) return <div className="p-4 sm:p-6 lg:p-8">Loading...</div>;

  const generations = (app.generations as Record<string, unknown>[]) || [];
  const rawOutput = selectedGen?.structuredOutputJson as Record<string, unknown> | undefined;
  const content = (rawOutput?.resume as Record<string, unknown> | undefined) || rawOutput;
  const coverLetter = rawOutput?.coverLetter as Record<string, unknown> | undefined;
  const files = (selectedGen?.files as Record<string, unknown>[]) || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-0 flex flex-col h-[calc(100dvh-3.5rem)] md:h-screen">
      <Link href={`/applications/${id}`} className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary mb-4 shrink-0">
        <ArrowLeft className="w-4 h-4" /> Back to Application
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 shrink-0">
        <h1 className="text-lg sm:text-xl font-semibold text-slate-800 break-words">
          Resume Preview — {app.jobTitle as string}
        </h1>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm max-w-full"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button onClick={handleRegenerate} disabled={generating || templates.length === 0} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} /> Regenerate
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-4 lg:gap-6 min-h-0">
        <div className="w-full lg:w-56 shrink-0 bg-white border border-[var(--border)] rounded-xl p-4 overflow-y-auto max-h-48 lg:max-h-none">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Resume Versions</h3>
          {generations.length === 0 ? (
            <p className="text-sm text-slate-500">No versions yet</p>
          ) : generations.map((gen) => (
            <button
              key={gen.id as string}
              onClick={() => setSelectedGen(gen)}
              className={`w-full text-left p-3 rounded-lg mb-2 text-sm ${selectedGen?.id === gen.id ? 'bg-primary/10 text-primary border border-primary/20' : 'hover:bg-slate-50'}`}
            >
              <p className="font-medium">Version {gen.version as number}</p>
              <p className="text-xs text-slate-500">{gen.status as string}</p>
              {gen.status === 'FAILED' && gen.errorMessage ? (
                <p className="text-xs text-red-600 mt-1 line-clamp-3">{gen.errorMessage as string}</p>
              ) : null}
              {gen.completedAt ? <p className="text-xs text-slate-400">{formatDate(gen.completedAt as string)}</p> : null}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white border border-[var(--border)] rounded-xl p-4 sm:p-6 lg:p-8 overflow-y-auto min-h-0">
          {!content ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Sparkles className="w-12 h-12 mb-4 text-slate-300" />
              <p>No resume content yet. Generate a resume to see the preview.</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <h1 className="text-2xl font-bold text-primary">{(content.header as Record<string, unknown>)?.name as string}</h1>
              <p className="text-lg text-slate-500 mb-1">{(content.header as Record<string, unknown>)?.title as string}</p>
              <p className="text-sm text-slate-400 mb-6">
                {Object.values((content.header as Record<string, Record<string, string>>)?.contact || {}).filter(Boolean).join(' | ')}
              </p>
              {content.summary ? (
                <>
                  <h2 className="text-sm font-bold text-slate-800 border-b border-[var(--border)] pb-1 mb-2">Professional Summary</h2>
                  <p className="text-sm text-slate-600 mb-4">{content.summary as string}</p>
                </>
              ) : null}
              {(content.skills as { category: string; items: string[] }[])?.map((group) => (
                <div key={group.category} className="mb-4">
                  <h2 className="text-sm font-bold text-slate-800 border-b border-[var(--border)] pb-1 mb-2">Technical Skills</h2>
                  <p className="text-sm"><strong>{group.category}:</strong> {group.items.join(', ')}</p>
                </div>
              ))}
              {(content.experience as { title: string; company: string; dates: string; bullets: string[] }[])?.map((exp, i) => (
                <div key={i} className="mb-4">
                  {i === 0 && (
                    <h2 className="text-sm font-bold text-slate-800 border-b border-[var(--border)] pb-1 mb-2">Professional Experience</h2>
                  )}
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 text-sm font-semibold">
                    <span>{exp.title} — {exp.company}</span>
                    <span className="text-slate-500 font-normal sm:font-semibold">{exp.dates}</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-slate-600 mt-1">
                    {exp.bullets.map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                </div>
              ))}
              {coverLetter && (
                <div className="mt-10 pt-6 border-t border-[var(--border)]">
                  <h2 className="text-sm font-bold text-slate-800 mb-3">Cover Letter</h2>
                  <p className="text-sm text-slate-700 mb-3">{coverLetter.greeting as string}</p>
                  {((coverLetter.paragraphs as string[]) || []).map((p, i) => (
                    <p key={i} className="text-sm text-slate-600 mb-3">{p}</p>
                  ))}
                  <p className="text-sm text-slate-700">{coverLetter.closing as string}</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">{coverLetter.signatureName as string}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-48 shrink-0 space-y-2">
          <h3 className="text-sm font-medium text-slate-700 mb-3">File Actions</h3>
          {files
            .filter((f) => f.type === 'PDF' || f.type === 'DOCX')
            .map((f) => (
            <button
              key={f.id as string}
              onClick={() => handleDownload(f.id as string, f.filename as string)}
              className="w-full flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
            >
              <Download className="w-4 h-4" />
              {(f.kind as string) === 'COVER_LETTER' ? 'Cover' : 'Resume'} {f.type as string}
            </button>
          ))}
          {content && (
            <button
              onClick={() => navigator.clipboard.writeText(JSON.stringify(content, null, 2))}
              className="w-full flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
            >
              <Copy className="w-4 h-4" /> Copy JSON
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
