'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, ExternalLink } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { api } from '@/lib/api';

type ProfileDetailModalProps = {
  profileId: string;
  onClose: () => void;
};

export function ProfileDetailModal({ profileId, onClose }: ProfileDetailModalProps) {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getProfile(profileId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const experiences = (profile?.experiences as Record<string, unknown>[]) || [];
  const education = (profile?.education as Record<string, unknown>[]) || [];
  const skills = (profile?.skills as Record<string, unknown>[]) || [];
  const links = (profile?.links as { type?: string; url?: string }[]) || [];
  const linkedin = links.find((l) => String(l.type || '').toLowerCase() === 'linkedin')?.url;
  const otherLinks = links.filter((l) => String(l.type || '').toLowerCase() !== 'linkedin' && l.url);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="profile-modal-title"
        className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl border border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : (
              <>
                <h2 id="profile-modal-title" className="text-lg font-semibold text-slate-800 truncate">
                  {String(profile?.firstName ?? '')} {String(profile?.lastName ?? '')}
                </h2>
                <p className="text-sm text-slate-500 truncate">{String(profile?.profileTitle ?? '')}</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
              <LoadingSpinner size="sm" className="text-primary" />
              <span className="text-sm">Loading profile…</span>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          {!loading && !error && profile && (
            <>
              <section>
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">
                  Identity & Contact
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Email</dt>
                    <dd className="text-slate-800 break-all">{String(profile.email || '—')}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="text-slate-800">{String(profile.phone || '—')}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Location</dt>
                    <dd className="text-slate-800 whitespace-pre-wrap">
                      {String(profile.address || '').trim() || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">LinkedIn</dt>
                    <dd className="text-slate-800 break-all">
                      {linkedin ? (
                        <a
                          href={linkedin.startsWith('http') ? linkedin : `https://${linkedin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {linkedin}
                        </a>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Remote</dt>
                    <dd className="text-slate-800">{profile.remoteOnly ? 'Remote only' : 'Flexible'}</dd>
                  </div>
                  {otherLinks.map((link) => (
                    <div key={`${link.type}-${link.url}`}>
                      <dt className="text-slate-500 capitalize">{String(link.type || 'Link')}</dt>
                      <dd className="text-slate-800 break-all">
                        <a
                          href={
                            String(link.url).startsWith('http')
                              ? String(link.url)
                              : `https://${link.url}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {String(link.url)}
                        </a>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              {profile.summary ? (
                <section>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Summary</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {String(profile.summary)}
                  </p>
                </section>
              ) : null}

              {experiences.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Experience</h3>
                  <ul className="space-y-2">
                    {experiences.map((exp) => (
                      <li key={String(exp.id)} className="text-sm text-slate-700">
                        <span className="font-medium">{String(exp.title)}</span>
                        <span className="text-slate-400"> · </span>
                        <span className="text-slate-600">{String(exp.company)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {skills.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill) => (
                      <span
                        key={String(skill.id)}
                        className="rounded-full bg-slate-100 border border-[var(--border)] px-2.5 py-0.5 text-xs text-slate-700"
                      >
                        {String(skill.name)}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {education.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Education</h3>
                  <ul className="space-y-2">
                    {education.map((edu) => (
                      <li key={String(edu.id)} className="text-sm text-slate-700">
                        <span className="font-medium">
                          {[edu.degree, edu.major].filter(Boolean).join(' ')}
                        </span>
                        <span className="text-slate-400"> · </span>
                        <span className="text-slate-600">{String(edu.institution)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-[var(--border)] rounded-lg hover:bg-slate-50"
          >
            Close
          </button>
          <Link
            href={`/profiles/${profileId}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-light"
          >
            Open full profile
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
