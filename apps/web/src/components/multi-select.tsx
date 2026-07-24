'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MultiSelectOption = { id: string; name: string };

type MultiSelectProps = {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
};

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'All',
  emptyText = 'No options',
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selectedNames = options.filter((o) => value.includes(o.id)).map((o) => o.name);
  const triggerLabel =
    selectedNames.length === 0
      ? placeholder
      : selectedNames.length === 1
        ? selectedNames[0]
        : `${selectedNames[0]} +${selectedNames.length - 1}`;

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full h-10 items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-sm transition-colors',
          'border-[var(--border)] hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary-light)]',
          open && 'border-[var(--primary-light)] ring-2 ring-[var(--primary)]/20',
          selectedNames.length === 0 ? 'text-slate-400' : 'text-slate-800',
        )}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className={cn('w-4 h-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable
          className="absolute z-30 mt-1.5 w-full min-w-[12rem] max-h-56 overflow-auto rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg"
        >
          {options.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-slate-400">{emptyText}</p>
          ) : (
            options.map((opt) => {
              const checked = value.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggle(opt.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      checked
                        ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                        : 'border-slate-300 bg-white',
                    )}
                  >
                    {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                  </span>
                  <span className="truncate text-left">{opt.name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
