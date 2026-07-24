'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Star, X } from 'lucide-react';
import { api, type ApplicationOption } from '@/lib/api';
import { cn } from '@/lib/utils';

type OptionType = 'LOCATION' | 'SOURCE';

export function ManagedApplicationOption({
  type,
  label,
  value,
  onChange,
  options,
  onOptionsChange,
  placeholder,
}: {
  type: OptionType;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ApplicationOption[];
  onOptionsChange: () => Promise<{
    locations: ApplicationOption[];
    sources: ApplicationOption[];
  }>;
  placeholder?: string;
}) {
  const [managing, setManaging] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [busy, setBusy] = useState(false);

  const selectValues = [...options];
  if (value && !options.some((o) => o.value === value)) {
    selectValues.unshift({
      id: `__legacy_${value}`,
      type,
      value,
      normalizedValue: value.toLowerCase(),
      isDefault: false,
      sortOrder: -1,
    });
  }

  const handleAdd = async () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const created = await api.createApplicationOption({ type, value: trimmed });
      setNewValue('');
      await onOptionsChange();
      onChange(created.value);
      toast.success(`${label} added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to add ${label.toLowerCase()}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (id.startsWith('__legacy_')) return;
    setBusy(true);
    try {
      await api.updateApplicationOption(id, { isDefault: true });
      await onOptionsChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set default');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (opt: ApplicationOption) => {
    if (opt.id.startsWith('__legacy_')) return;
    setBusy(true);
    try {
      const wasSelected = value === opt.value;
      await api.deleteApplicationOption(opt.id);
      const lists = await onOptionsChange();
      if (wasSelected) {
        const list = type === 'LOCATION' ? lists.locations : lists.sources;
        const preferred = list.find((o) => o.isDefault) || list[0];
        onChange(preferred?.value || '');
      }
      toast.success(`${label} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to remove ${label.toLowerCase()}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        <button
          type="button"
          onClick={() => setManaging((v) => !v)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {managing ? 'Done' : 'Manage'}
        </button>
      </div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-white"
      >
        <option value="">{placeholder || `Select ${label.toLowerCase()}…`}</option>
        {selectValues.map((o) => (
          <option key={o.id} value={o.value}>
            {o.value}
            {o.isDefault ? ' (Default)' : ''}
          </option>
        ))}
      </select>

      {managing && (
        <div className="rounded-lg border border-[var(--border)] bg-slate-50 p-3 space-y-3">
          <div className="flex gap-2">
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder={
                type === 'LOCATION'
                  ? 'New location (e.g. Remote, NYC)...'
                  : 'New source name...'
              }
              className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-white"
              disabled={busy}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy || !newValue.trim()}
              className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-light disabled:opacity-50"
              title={`Add ${label.toLowerCase()}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <ul className="space-y-1.5">
            {options.length === 0 ? (
              <li className="text-xs text-slate-400 px-1">No saved options yet</li>
            ) : (
              options.map((opt) => (
                <li
                  key={opt.id}
                  className={cn(
                    'flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm',
                    opt.isDefault ? 'bg-amber-50' : 'bg-white border border-slate-100',
                  )}
                >
                  <span
                    className={cn(
                      'truncate',
                      opt.isDefault ? 'text-amber-700 font-medium' : 'text-slate-700',
                    )}
                  >
                    {opt.value}
                    {opt.isDefault ? ' (Default)' : ''}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      title={opt.isDefault ? 'Default' : 'Set as default'}
                      disabled={busy || opt.isDefault}
                      onClick={() => handleSetDefault(opt.id)}
                      className={cn(
                        'p-1 rounded hover:bg-slate-100 disabled:opacity-60',
                        opt.isDefault ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500',
                      )}
                    >
                      <Star className={cn('w-3.5 h-3.5', opt.isDefault && 'fill-current')} />
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      disabled={busy}
                      onClick={() => handleRemove(opt)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
