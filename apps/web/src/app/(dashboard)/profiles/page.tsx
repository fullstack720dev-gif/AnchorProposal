'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ProfileDetailModal } from '@/components/profile-detail-modal';
import { Plus, Search, Pencil, Trash2, Inbox, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city: string;
  state: string;
  isDefault?: boolean;
  _count?: { assignments: number; applications: number };
}

export default function ProfilesPage() {
  const { isAdmin, canBid } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Profile | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getProfiles();
      setProfiles(data as Profile[]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const hay = [
        p.firstName,
        p.lastName,
        `${p.firstName} ${p.lastName}`,
        p.email,
        p.phone,
        p.address,
        p.city,
        p.state,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [profiles, search]);

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await api.archiveProfile(archiveTarget.id);
      setProfiles((prev) => prev.filter((p) => p.id !== archiveTarget.id));
      toast.success('Profile archived');
      setArchiveTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to archive profile');
    } finally {
      setArchiving(false);
    }
  };

  const handleSetDefault = async (profileId: string) => {
    setSettingDefaultId(profileId);
    try {
      await api.setDefaultProfile(profileId);
      setProfiles((prev) =>
        prev.map((p) => ({
          ...p,
          isDefault: p.id === profileId,
        })),
      );
      toast.success('Default profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set default profile');
    } finally {
      setSettingDefaultId(null);
    }
  };

  const thClass = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400';
  const showCounts = isAdmin;
  const showActions = isAdmin;
  const showDefault = canBid;
  const computedColCount =
    5 + (showCounts ? 2 : 0) + (showDefault && !showActions ? 1 : 0) + (showActions ? 1 : 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Profiles</h1>
          <p className="text-slate-500 mt-1">Manage candidate profiles</p>
        </div>
        {isAdmin && (
          <Link
            href="/profiles/new"
            className="btn-primary"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} /> Create Profile
          </Link>
        )}
      </div>

      <div className="bg-white border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone, location…"
              className="w-full h-10 pl-9 pr-3 text-sm border border-[var(--border)] rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary-light)]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-slate-50/60">
                <th className={thClass}>First Name</th>
                <th className={thClass}>Last Name</th>
                <th className={thClass}>Location</th>
                <th className={thClass}>Mail</th>
                <th className={thClass}>Phone Number</th>
                {showCounts && <th className={thClass}>Assignments</th>}
                {showCounts && <th className={thClass}>Applications</th>}
                {showDefault && !showActions && <th className={cn(thClass, 'text-center')}>Default</th>}
                {showActions && <th className={cn(thClass, 'text-right')}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={computedColCount} className="px-4 py-12 text-center text-slate-400">
                    Loading profiles…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={computedColCount} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Inbox className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500">
                        {search.trim() ? 'No profiles match your search' : 'No profiles yet'}
                      </p>
                      {search.trim() && (
                        <button
                          type="button"
                          onClick={() => setSearch('')}
                          className="text-xs text-[var(--primary-light)] hover:underline"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setDetailId(p.id)}
                    className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {p.firstName || '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {p.lastName || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.address?.trim() || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.phone || '—'}</td>
                    {showCounts && (
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {p._count?.assignments ?? 0}
                      </td>
                    )}
                    {showCounts && (
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {p._count?.applications ?? 0}
                      </td>
                    )}
                    {showDefault && !showActions && (
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title={p.isDefault ? 'Default profile' : 'Set as default'}
                          disabled={settingDefaultId === p.id || Boolean(p.isDefault)}
                          onClick={() => handleSetDefault(p.id)}
                          className={cn(
                            'p-2 rounded-lg inline-flex',
                            p.isDefault
                              ? 'text-amber-500'
                              : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50',
                          )}
                        >
                          <Star className={cn('w-4 h-4', p.isDefault && 'fill-current')} />
                        </button>
                      </td>
                    )}
                    {showActions && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {showDefault && (
                            <button
                              type="button"
                              title={p.isDefault ? 'Default profile' : 'Set as default'}
                              disabled={settingDefaultId === p.id || Boolean(p.isDefault)}
                              onClick={() => handleSetDefault(p.id)}
                              className={cn(
                                'p-2 rounded-lg',
                                p.isDefault
                                  ? 'text-amber-500'
                                  : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50',
                              )}
                            >
                              <Star className={cn('w-4 h-4', p.isDefault && 'fill-current')} />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => router.push(`/profiles/${p.id}`)}
                            className="p-2 rounded-lg text-slate-500 hover:text-[var(--primary)] hover:bg-slate-100"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Archive"
                            onClick={() => setArchiveTarget(p)}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            Showing {filtered.length} of {profiles.length} profile{profiles.length === 1 ? '' : 's'}
          </div>
        )}
      </div>

      {detailId && <ProfileDetailModal profileId={detailId} onClose={() => setDetailId(null)} />}

      {archiveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !archiving && setArchiveTarget(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal
            className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl border border-[var(--border)] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800">Archive profile?</h3>
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">
                {archiveTarget.firstName} {archiveTarget.lastName}
              </span>{' '}
              will be hidden from the list. This does not permanently delete the record.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={archiving}
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-[var(--border)] rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={archiving}
                onClick={confirmArchive}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
