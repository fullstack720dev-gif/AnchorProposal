'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';

type MasterTab = 'prompts' | 'ai' | 'warnings' | 'audit';
type AdminTab = 'prompt' | 'account';
type BidderTab = 'prompt' | 'account';

type PromptRow = { id: string; content: string; version: number; isPublished: boolean };

export default function SettingsPage() {
  const { isMaster, isAdmin, user } = useAuth();
  const isAdminOnly = isAdmin && !isMaster;
  const isBidder = user?.role === 'BIDDER';

  const [masterTab, setMasterTab] = useState<MasterTab>('prompts');
  const [staffTab, setStaffTab] = useState<AdminTab | BidderTab>('prompt');

  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [savingVersionId, setSavingVersionId] = useState<string | null>(null);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
  const [newPrompt, setNewPrompt] = useState('');
  const [aiSettings, setAiSettings] = useState<{ hasApiKey: boolean; model: string } | null>(null);
  const [warnings, setWarnings] = useState<Record<string, unknown>[]>([]);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-v4-flash');
  const [savingAi, setSavingAi] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);

  const [myPrompt, setMyPrompt] = useState<{
    useMasterPrompt: boolean | null;
    promptSource?: 'initial' | 'custom' | null;
    masterPrompt: PromptRow | null;
    myPrompt: PromptRow | null;
    effectivePrompt: PromptRow | null;
  } | null>(null);
  const [adminContent, setAdminContent] = useState('');
  const [useMaster, setUseMaster] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [newRule, setNewRule] = useState({
    category: 'CITIZENSHIP',
    pattern: '',
    severity: 'CONFIRM',
    behavior: 'WARN',
  });

  const loadMaster = useCallback(async () => {
    const [p, ai, w, a] = await Promise.all([
      api.getPrompts().catch(() => []),
      api.getAiSettings().catch(() => null),
      api.getWarningRules().catch(() => []),
      api.getAuditLog().catch(() => []),
    ]);
    setPrompts(p as PromptRow[]);
    setPromptDrafts(
      Object.fromEntries((p as PromptRow[]).map((row) => [row.id, row.content])),
    );
    setEditingPromptId(null);
    if (ai) {
      setAiSettings(ai);
      setModel(ai.model || 'deepseek-v4-flash');
    }
    setWarnings(w as Record<string, unknown>[]);
    setAudit(a as Record<string, unknown>[]);
  }, []);

  const loadMyPrompt = useCallback(async () => {
    const data = await api.getMyPrompt();
    setMyPrompt({
      useMasterPrompt: data.useMasterPrompt,
      promptSource: data.promptSource ?? null,
      masterPrompt: data.masterPrompt,
      myPrompt: data.myPrompt,
      effectivePrompt: data.effectivePrompt,
    });
    setUseMaster(data.useMasterPrompt !== false);
    setAdminContent(data.myPrompt?.content || data.masterPrompt?.content || '');
  }, []);

  useEffect(() => {
    if (isMaster) {
      loadMaster().catch(() => undefined);
    } else {
      loadMyPrompt().catch((err) =>
        toast.error(err instanceof Error ? err.message : 'Failed to load prompt'),
      );
    }
  }, [isMaster, loadMaster, loadMyPrompt]);

  const handlePublishPrompt = async (id: string) => {
    try {
      await api.publishPrompt(id);
      toast.success('Initial prompt published');
      await loadMaster();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish prompt');
    }
  };

  const handleSavePromptVersion = async (id: string) => {
    const content = (promptDrafts[id] ?? '').trim();
    if (!content) {
      toast.error('Prompt content is required');
      return;
    }
    setSavingVersionId(id);
    try {
      await api.updatePrompt(id, content);
      toast.success('Prompt version saved');
      setEditingPromptId(null);
      await loadMaster();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setSavingVersionId(null);
    }
  };

  const handleCancelEditPrompt = (id: string, original: string) => {
    setPromptDrafts((prev) => ({ ...prev, [id]: original }));
    setEditingPromptId(null);
  };

  const handleDeletePromptVersion = async (id: string, version: number) => {
    const ok = window.confirm(
      `Delete prompt version ${version}? This cannot be undone.`,
    );
    if (!ok) return;
    setDeletingVersionId(id);
    try {
      await api.deletePrompt(id);
      toast.success(`Version ${version} deleted`);
      if (editingPromptId === id) setEditingPromptId(null);
      await loadMaster();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete prompt');
    } finally {
      setDeletingVersionId(null);
    }
  };

  const handleCreatePrompt = async () => {
    if (!newPrompt.trim()) {
      toast.error('Prompt content is required');
      return;
    }
    setSavingPrompt(true);
    try {
      const created = (await api.createPrompt(newPrompt.trim())) as PromptRow;
      await api.publishPrompt(created.id);
      setNewPrompt('');
      toast.success('Initial prompt created and published');
      await loadMaster();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create prompt');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleSaveAi = async () => {
    setSavingAi(true);
    try {
      const updated = await api.updateAiSettings({
        apiKey: apiKey.trim() || undefined,
        model: model.trim() || undefined,
      });
      setAiSettings(updated);
      setApiKey('');
      toast.success('AI settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save AI settings');
    } finally {
      setSavingAi(false);
    }
  };

  const handleSaveAdminPrompt = async () => {
    setSavingPrompt(true);
    try {
      const updated = await api.updateMyPrompt({
        useMasterPrompt: useMaster,
        content: useMaster ? undefined : adminContent,
      });
      setMyPrompt({
        useMasterPrompt: updated.useMasterPrompt,
        promptSource: updated.promptSource ?? null,
        masterPrompt: updated.masterPrompt,
        myPrompt: updated.myPrompt,
        effectivePrompt: updated.effectivePrompt,
      });
      toast.success('Prompt settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await api.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      toast.success(res.message || 'Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCreateRule = async () => {
    if (!newRule.pattern.trim()) {
      toast.error('Pattern is required');
      return;
    }
    try {
      await api.createWarningRule(newRule);
      toast.success('Warning rule created');
      setNewRule({ category: 'CITIZENSHIP', pattern: '', severity: 'CONFIRM', behavior: 'WARN' });
      const w = await api.getWarningRules();
      setWarnings(w as Record<string, unknown>[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create rule');
    }
  };

  const masterTabs = useMemo(
    () =>
      [
        { key: 'prompts' as const, label: 'Initial Prompt' },
        { key: 'ai' as const, label: 'AI Provider' },
        { key: 'warnings' as const, label: 'Warning Rules' },
        { key: 'audit' as const, label: 'Audit Log' },
      ] as const,
    [],
  );

  const accountTab = (
    <div className="bg-white border border-[var(--border)] rounded-xl p-6 max-w-md space-y-4">
      <h2 className="font-medium text-slate-800">Change password</h2>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Current password</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
          autoComplete="current-password"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
          autoComplete="new-password"
        />
      </div>
      <button
        type="button"
        disabled={savingPassword}
        onClick={handleChangePassword}
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50"
      >
        {savingPassword ? 'Updating…' : 'Update password'}
      </button>
    </div>
  );

  if (isMaster) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-800">Settings</h1>
          <p className="text-slate-500">Platform configuration (Master)</p>
        </div>

        <div className="flex gap-1 border-b border-[var(--border)] mb-6">
          {masterTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMasterTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
                masterTab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {masterTab === 'prompts' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              The published initial prompt is used by Admins who choose “Use Master prompt” and by their
              bidders. Ask DeepSeek for both <code className="text-xs bg-slate-100 px-1 rounded">resume</code>{' '}
              and <code className="text-xs bg-slate-100 px-1 rounded">coverLetter</code> JSON.
            </p>
            <div className="bg-white border border-[var(--border)] rounded-xl p-4 space-y-3">
              <h2 className="font-medium text-slate-800">New initial prompt version</h2>
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                className="w-full min-h-[20rem] px-3 py-2 border border-[var(--border)] rounded-lg text-sm font-mono whitespace-pre-wrap"
                placeholder="Paste prompt content…"
              />
              <button
                type="button"
                disabled={savingPrompt}
                onClick={handleCreatePrompt}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50"
              >
                {savingPrompt ? 'Saving…' : 'Create & publish'}
              </button>
            </div>
            {prompts.map((p) => {
              const draft = promptDrafts[p.id] ?? p.content;
              const isEditing = editingPromptId === p.id;
              const dirty = draft !== p.content;
              return (
                <div key={p.id} className="bg-white border border-[var(--border)] rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">Version {p.version}</span>
                    <div className="flex items-center gap-2">
                      {p.isPublished ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Published
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePublishPrompt(p.id)}
                          className="text-xs text-primary hover:underline"
                        >
                          Publish
                        </button>
                      )}
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={savingVersionId === p.id}
                            onClick={() => handleCancelEditPrompt(p.id, p.content)}
                            className="px-3 py-1.5 border border-[var(--border)] text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={savingVersionId === p.id || !dirty}
                            onClick={() => handleSavePromptVersion(p.id)}
                            className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium disabled:opacity-50"
                          >
                            {savingVersionId === p.id ? 'Saving…' : 'Save'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPromptDrafts((prev) => ({ ...prev, [p.id]: p.content }));
                            setEditingPromptId(p.id);
                          }}
                          className="px-3 py-1.5 border border-[var(--border)] text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deletingVersionId === p.id}
                        onClick={() => handleDeletePromptVersion(p.id, p.version)}
                        className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingVersionId === p.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  {isEditing ? (
                    <>
                      <textarea
                        value={draft}
                        onChange={(e) =>
                          setPromptDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        className="w-full min-h-[20rem] px-3 py-2 border border-[var(--border)] rounded-lg text-sm font-mono text-slate-700 whitespace-pre-wrap"
                      />
                      {dirty && <p className="text-xs text-amber-600">Unsaved changes</p>}
                    </>
                  ) : (
                    <pre className="w-full min-h-[12rem] max-h-[28rem] overflow-auto px-3 py-2 border border-slate-100 rounded-lg text-sm font-mono text-slate-700 whitespace-pre-wrap bg-slate-50">
                      {p.content}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {masterTab === 'ai' && (
          <div className="bg-white border border-[var(--border)] rounded-xl p-6 max-w-lg space-y-4">
            <div>
              <p className="text-sm text-slate-600">
                Provider: <strong>DeepSeek</strong>
              </p>
              <p className="text-sm text-slate-600">
                API Key:{' '}
                <strong className={aiSettings?.hasApiKey ? 'text-green-700' : 'text-amber-700'}>
                  {aiSettings?.hasApiKey ? 'Configured' : 'Not set'}
                </strong>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Only Master can change the platform API key. Env fallback:{' '}
                <code>DEEPSEEK_API_KEY</code>.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="deepseek-v4-flash"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Update API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="sk-... (leave blank to keep current)"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveAi}
              disabled={savingAi}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50"
            >
              {savingAi ? 'Saving…' : 'Save AI settings'}
            </button>
          </div>
        )}

        {masterTab === 'warnings' && (
          <div className="space-y-4">
            <div className="bg-white border border-[var(--border)] rounded-xl p-4 space-y-3 max-w-2xl">
              <h2 className="font-medium text-slate-800">Add warning rule</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={newRule.category}
                  onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  {[
                    'REMOTE_CONFLICT',
                    'CLEARANCE',
                    'TRUST_BACKGROUND',
                    'CITIZENSHIP',
                    'TRAVEL_LOCATION',
                    'DUPLICATE',
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={newRule.severity}
                  onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  {['INFO', 'CONFIRM', 'ADMIN_REVIEW', 'BLOCK'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={newRule.behavior}
                  onChange={(e) => setNewRule({ ...newRule, behavior: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm col-span-2"
                >
                  {['WARN', 'CONFIRM', 'ADMIN_REVIEW', 'BLOCK'].map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <input
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm col-span-2 font-mono"
                  placeholder="Regex pattern"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateRule}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
              >
                Create rule
              </button>
            </div>
            <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-left px-4 py-3">Pattern</th>
                    <th className="text-left px-4 py-3">Severity</th>
                    <th className="text-left px-4 py-3">Behavior</th>
                  </tr>
                </thead>
                <tbody>
                  {warnings.map((w) => (
                    <tr key={w.id as string} className="border-b border-slate-100">
                      <td className="px-4 py-3">{w.category as string}</td>
                      <td className="px-4 py-3 font-mono text-xs">{w.pattern as string}</td>
                      <td className="px-4 py-3">{w.severity as string}</td>
                      <td className="px-4 py-3">{w.behavior as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {masterTab === 'audit' && (
          <div className="space-y-2">
            {audit.map((e) => (
              <div
                key={e.id as string}
                className="bg-white border border-[var(--border)] rounded-lg p-3 flex justify-between text-sm"
              >
                <div>
                  <span className="font-medium">{e.action as string}</span>
                  <span className="text-slate-500 ml-2">{e.targetType as string}</span>
                </div>
                <span className="text-slate-400">{formatDate(e.createdAt as string)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Admin or Bidder
  const tabs =
    isAdminOnly
      ? ([
          { key: 'prompt' as const, label: 'Prompt' },
          { key: 'account' as const, label: 'Account' },
        ] as const)
      : ([
          { key: 'prompt' as const, label: 'Assigned Prompt' },
          { key: 'account' as const, label: 'Account' },
        ] as const);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Settings</h1>
        <p className="text-slate-500">
          {isAdminOnly ? 'Your prompt and account' : 'Your assigned prompt and account'}
        </p>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)] mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStaffTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              staffTab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {staffTab === 'prompt' && isAdminOnly && (
        <div className="space-y-4 max-w-3xl">
          <div className="bg-white border border-[var(--border)] rounded-xl p-6 space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-3 text-sm text-slate-700">
                <input
                  type="radio"
                  name="promptSource"
                  checked={useMaster}
                  onChange={() => setUseMaster(true)}
                />
                Use Master initial prompt
              </label>
              <label className="flex items-center gap-3 text-sm text-slate-700">
                <input
                  type="radio"
                  name="promptSource"
                  checked={!useMaster}
                  onChange={() => setUseMaster(false)}
                />
                Use my custom prompt
              </label>
            </div>

            {useMaster ? (
              <div>
                <p className="text-xs text-slate-500 mb-2">Master initial prompt (read-only)</p>
                <pre className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg overflow-x-auto max-h-64 whitespace-pre-wrap">
                  {myPrompt?.masterPrompt?.content || 'No published Master prompt yet.'}
                </pre>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your prompt</label>
                <textarea
                  value={adminContent}
                  onChange={(e) => setAdminContent(e.target.value)}
                  className="w-full h-56 px-3 py-2 border border-[var(--border)] rounded-lg text-sm font-mono"
                />
              </div>
            )}

            <button
              type="button"
              disabled={savingPrompt}
              onClick={handleSaveAdminPrompt}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50"
            >
              {savingPrompt ? 'Saving…' : 'Save'}
            </button>
            <p className="text-xs text-slate-400">
              This prompt is for your own generations. To give each bidder a different prompt, use Assign
              prompt on the Users page.
            </p>
          </div>
        </div>
      )}

      {staffTab === 'prompt' && isBidder && (
        <div className="bg-white border border-[var(--border)] rounded-xl p-6 max-w-3xl space-y-3">
          <p className="text-sm text-slate-500">
            This prompt is assigned by your Admin. You can view it but cannot edit it.
          </p>
          <p className="text-sm font-medium text-slate-700">
            Assigned:{' '}
            {myPrompt?.promptSource === 'custom' || myPrompt?.useMasterPrompt === false
              ? 'Custom prompt'
              : 'Initial (Master) prompt'}
          </p>
          <pre className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg overflow-auto min-h-[12rem] max-h-[28rem] whitespace-pre-wrap font-mono">
            {myPrompt?.effectivePrompt?.content || 'No prompt assigned yet. Contact your Admin.'}
          </pre>
        </div>
      )}

      {staffTab === 'account' && accountTab}
    </div>
  );
}
