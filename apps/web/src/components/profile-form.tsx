'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TemplateOption = { id: string; name: string; isPublished?: boolean };

type ExperienceRow = {
  title: string;
  company: string;
  location: string;
  workArrangement: string;
  startDate: string;
  endDate: string;
  /** UI-only: skip end date when current role */
  isCurrent: boolean;
  /** preserved on edit */
  responsibilities?: string;
  technologies?: string;
  achievements?: string;
};

function isCurrentEndDate(endDate: string) {
  const v = endDate.trim();
  return !v || /^(present|current|now)$/i.test(v);
}

type EducationRow = {
  institution: string;
  degree: string;
  location: string;
  startDate: string;
  endDate: string;
  major?: string;
};

type CertRow = {
  name: string;
  issuer: string;
  issueDate: string;
  expirationDate: string;
  credentialId?: string;
  credentialUrl?: string;
};

export type ProfileFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  linkedin: string;
  education: EducationRow[];
  experiences: ExperienceRow[];
  certifications: CertRow[];
  defaultTemplateId: string;
  /** preserved advanced scalars (edit) */
  city?: string;
  state?: string;
  country?: string;
  profileTitle?: string;
  summary?: string;
  workAuthorization?: string;
  remoteOnly?: boolean;
  preferredRoles?: string;
  skills?: { category: string; name: string }[];
  otherLinks?: { type: string; url: string }[];
};

const inputClass =
  'w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary-light)]';

const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

const JOB_TYPES = [
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ONSITE', label: 'On-site' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

function blankEducation(): EducationRow {
  return { institution: '', degree: '', location: '', startDate: '', endDate: '', major: '' };
}

function blankExperience(): ExperienceRow {
  return {
    title: '',
    company: '',
    location: '',
    workArrangement: 'REMOTE',
    startDate: '',
    endDate: '',
    isCurrent: false,
    responsibilities: '',
    technologies: '',
    achievements: '',
  };
}

function blankCert(): CertRow {
  return {
    name: '',
    issuer: '',
    issueDate: '',
    expirationDate: '',
    credentialId: '',
    credentialUrl: '',
  };
}

export function emptyProfileFormValues(): ProfileFormValues {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    linkedin: '',
    education: [blankEducation()],
    experiences: [blankExperience()],
    certifications: [blankCert()],
    defaultTemplateId: '',
    city: '',
    state: '',
    country: 'USA',
    profileTitle: '',
    summary: '',
    workAuthorization: '',
    remoteOnly: true,
    preferredRoles: '',
    skills: [],
    otherLinks: [],
  };
}

export function profileToFormValues(profile: Record<string, unknown>): ProfileFormValues {
  const links = Array.isArray(profile.links) ? (profile.links as Record<string, unknown>[]) : [];
  const linkedin =
    links.find((l) => String(l.type || '').toLowerCase() === 'linkedin')?.url?.toString() || '';
  const otherLinks = links
    .filter((l) => String(l.type || '').toLowerCase() !== 'linkedin')
    .map((l) => ({ type: String(l.type || 'other'), url: String(l.url || '') }));

  const education = Array.isArray(profile.education)
    ? (profile.education as Record<string, unknown>[]).map((e) => ({
        institution: String(e.institution || ''),
        degree: String(e.degree || ''),
        location: String(e.location || ''),
        startDate: String(e.startDate || ''),
        endDate: String(e.endDate || ''),
        major: String(e.major || ''),
      }))
    : [];

  const experiences = Array.isArray(profile.experiences)
    ? (profile.experiences as Record<string, unknown>[]).map((e) => {
        const endDate = String(e.endDate || '');
        return {
          title: String(e.title || ''),
          company: String(e.company || ''),
          location: String(e.location || ''),
          workArrangement: String(e.workArrangement || 'REMOTE'),
          startDate: String(e.startDate || ''),
          endDate,
          isCurrent: isCurrentEndDate(endDate),
          responsibilities: String(e.responsibilities || ''),
          technologies: String(e.technologies || ''),
          achievements: String(e.achievements || ''),
        };
      })
    : [];

  const certifications = Array.isArray(profile.certifications)
    ? (profile.certifications as Record<string, unknown>[]).map((c) => ({
        name: String(c.name || ''),
        issuer: String(c.issuer || ''),
        issueDate: String(c.issueDate || ''),
        expirationDate: String(c.expirationDate || ''),
        credentialId: String(c.credentialId || ''),
        credentialUrl: String(c.credentialUrl || ''),
      }))
    : [];

  const skills = Array.isArray(profile.skills)
    ? (profile.skills as Record<string, unknown>[]).map((s) => ({
        category: String(s.category || 'General'),
        name: String(s.name || ''),
      }))
    : [];

  return {
    firstName: String(profile.firstName || ''),
    lastName: String(profile.lastName || ''),
    email: String(profile.email || ''),
    phone: String(profile.phone || ''),
    address: String(profile.address || ''),
    linkedin,
    education: education.length ? education : [blankEducation()],
    experiences: experiences.length ? experiences : [blankExperience()],
    certifications: certifications.length ? certifications : [blankCert()],
    defaultTemplateId: String(profile.defaultTemplateId || ''),
    city: String(profile.city || ''),
    state: String(profile.state || ''),
    country: String(profile.country || 'USA'),
    profileTitle: String(profile.profileTitle || ''),
    summary: String(profile.summary || ''),
    workAuthorization: String(profile.workAuthorization || ''),
    remoteOnly: Boolean(profile.remoteOnly ?? true),
    preferredRoles: String(profile.preferredRoles || ''),
    skills,
    otherLinks,
  };
}

export function validateProfileForm(values: ProfileFormValues): string | null {
  if (!values.firstName.trim()) return 'First name is required';
  if (!values.lastName.trim()) return 'Last name is required';
  if (!values.email.trim()) return 'Email is required';
  if (!values.phone.trim()) return 'Phone is required';
  if (!values.address.trim()) return 'Address is required';
  const validExp = values.experiences.filter(
    (e) => e.title.trim() && e.company.trim(),
  );
  if (validExp.length === 0) {
    return 'At least one work experience with job title and company is required';
  }
  return null;
}

export function profileFormToApiPayload(values: ProfileFormValues): Record<string, unknown> {
  const experiences = values.experiences
    .filter((e) => e.title.trim() || e.company.trim())
    .map((e, i) => ({
      title: e.title.trim(),
      company: e.company.trim(),
      location: e.location.trim() || null,
      workArrangement: e.workArrangement || 'UNKNOWN',
      startDate: e.startDate.trim() || null,
      endDate: e.isCurrent ? null : e.endDate.trim() || null,
      responsibilities: e.responsibilities?.trim() || null,
      technologies: e.technologies?.trim() || null,
      achievements: e.achievements?.trim() || null,
      sortOrder: i,
    }));

  const education = values.education
    .filter((e) => e.institution.trim() || e.degree.trim())
    .map((e, i) => ({
      institution: e.institution.trim() || '—',
      degree: e.degree.trim() || '—',
      major: e.major?.trim() || null,
      location: e.location.trim() || null,
      startDate: e.startDate.trim() || null,
      endDate: e.endDate.trim() || null,
      sortOrder: i,
    }));

  const certifications = values.certifications
    .filter((c) => c.name.trim())
    .map((c) => ({
      name: c.name.trim(),
      issuer: c.issuer.trim() || null,
      issueDate: c.issueDate.trim() || null,
      expirationDate: c.expirationDate.trim() || null,
      credentialId: c.credentialId?.trim() || null,
      credentialUrl: c.credentialUrl?.trim() || null,
    }));

  const links: { type: string; url: string }[] = [];
  if (values.linkedin.trim()) {
    links.push({ type: 'linkedin', url: values.linkedin.trim() });
  }
  for (const l of values.otherLinks || []) {
    if (l.url.trim()) links.push({ type: l.type || 'other', url: l.url.trim() });
  }

  const skills = (values.skills || [])
    .filter((s) => s.name.trim())
    .map((s) => ({
      category: s.category || 'General',
      name: s.name.trim(),
    }));

  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    address: values.address.trim() || null,
    city: values.city?.trim() || null,
    state: values.state?.trim() || null,
    country: values.country?.trim() || 'USA',
    profileTitle: values.profileTitle?.trim() || null,
    summary: values.summary?.trim() || null,
    workAuthorization: values.workAuthorization?.trim() || null,
    remoteOnly: values.remoteOnly ?? true,
    preferredRoles: values.preferredRoles?.trim() || null,
    defaultTemplateId: values.defaultTemplateId || null,
    experiences,
    education,
    skills,
    certifications,
    links,
  };
}

function SectionCard({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-5 sm:p-6 space-y-4">
      <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
        {title}
        {required ? <span className="text-red-500 ml-0.5">*</span> : null}
      </h2>
      {children}
    </div>
  );
}

function RemoveBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title="Remove"
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

export function ProfileForm({
  values,
  onChange,
  templates,
  idPrefix = 'profile',
}: {
  values: ProfileFormValues;
  onChange: (next: ProfileFormValues) => void;
  templates: TemplateOption[];
  idPrefix?: string;
}) {
  const published = useMemo(
    () => templates.filter((t) => t.isPublished !== false),
    [templates],
  );

  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  const updateEdu = (index: number, patch: Partial<EducationRow>) => {
    set(
      'education',
      values.education.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const updateExp = (index: number, patch: Partial<ExperienceRow>) => {
    set(
      'experiences',
      values.experiences.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const updateCert = (index: number, patch: Partial<CertRow>) => {
    set(
      'certifications',
      values.certifications.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  return (
    <div className="space-y-5">
      {/* Personal */}
      <SectionCard title="Personal information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor={`${idPrefix}-firstName`}>
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              id={`${idPrefix}-firstName`}
              className={inputClass}
              placeholder="First Name"
              value={values.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`${idPrefix}-lastName`}>
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              id={`${idPrefix}-lastName`}
              className={inputClass}
              placeholder="Last Name"
              value={values.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`${idPrefix}-email`}>
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id={`${idPrefix}-email`}
              type="email"
              className={inputClass}
              placeholder="Email"
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`${idPrefix}-phone`}>
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              id={`${idPrefix}-phone`}
              className={inputClass}
              placeholder="Phone"
              value={values.phone}
              onChange={(e) => set('phone', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`${idPrefix}-address`}>
              Address <span className="text-red-500">*</span>
            </label>
            <input
              id={`${idPrefix}-address`}
              className={inputClass}
              placeholder="Address"
              value={values.address}
              onChange={(e) => set('address', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`${idPrefix}-linkedin`}>
              LinkedIn
            </label>
            <input
              id={`${idPrefix}-linkedin`}
              className={inputClass}
              placeholder="LinkedIn (optional)"
              value={values.linkedin}
              onChange={(e) => set('linkedin', e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      {/* Education */}
      <SectionCard title="Education">
        <div className="space-y-4">
          {values.education.map((row, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 space-y-3"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>University Name</label>
                    <input
                      className={inputClass}
                      placeholder="University Name"
                      value={row.institution}
                      onChange={(e) => updateEdu(index, { institution: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Degree</label>
                    <input
                      className={inputClass}
                      placeholder="Degree"
                      value={row.degree}
                      onChange={(e) => updateEdu(index, { degree: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Location</label>
                    <input
                      className={inputClass}
                      placeholder="Location"
                      value={row.location}
                      onChange={(e) => updateEdu(index, { location: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Enter Date</label>
                      <input
                        className={inputClass}
                        placeholder="e.g. Sep 2018"
                        value={row.startDate}
                        onChange={(e) => updateEdu(index, { startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Graduation Date</label>
                      <input
                        className={inputClass}
                        placeholder="e.g. May 2022"
                        value={row.endDate}
                        onChange={(e) => updateEdu(index, { endDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <RemoveBtn
                  disabled={values.education.length <= 1}
                  onClick={() =>
                    set(
                      'education',
                      values.education.filter((_, i) => i !== index),
                    )
                  }
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set('education', [...values.education, blankEducation()])}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 border border-[var(--border)] rounded-lg hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" /> Add Education
          </button>
        </div>
      </SectionCard>

      {/* Work Experience */}
      <SectionCard title="Work Experience" required>
        <div className="space-y-4">
          {values.experiences.map((row, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 space-y-3"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Job Title</label>
                    <input
                      className={inputClass}
                      placeholder="Job Title"
                      value={row.title}
                      onChange={(e) => updateExp(index, { title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Job Type</label>
                    <select
                      className={inputClass}
                      value={row.workArrangement}
                      onChange={(e) => updateExp(index, { workArrangement: e.target.value })}
                    >
                      {JOB_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Company Name</label>
                    <input
                      className={inputClass}
                      placeholder="Company Name"
                      value={row.company}
                      onChange={(e) => updateExp(index, { company: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Company Location</label>
                    <input
                      className={inputClass}
                      placeholder="Company Location"
                      value={row.location}
                      onChange={(e) => updateExp(index, { location: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Start Date</label>
                    <input
                      className={inputClass}
                      placeholder="e.g. Jan 2020"
                      value={row.startDate}
                      onChange={(e) => updateExp(index, { startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>End Date</label>
                    <input
                      className={cn(inputClass, row.isCurrent && 'bg-slate-100 text-slate-400')}
                      placeholder={row.isCurrent ? 'Present' : 'e.g. Dec 2023'}
                      value={row.isCurrent ? '' : row.endDate}
                      onChange={(e) => updateExp(index, { endDate: e.target.value })}
                      disabled={row.isCurrent}
                    />
                    <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={row.isCurrent}
                        onChange={(e) =>
                          updateExp(index, {
                            isCurrent: e.target.checked,
                            endDate: e.target.checked ? '' : row.endDate,
                          })
                        }
                        className="rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]/30"
                      />
                      Currently working
                    </label>
                  </div>
                </div>
                <RemoveBtn
                  disabled={values.experiences.length <= 1}
                  onClick={() =>
                    set(
                      'experiences',
                      values.experiences.filter((_, i) => i !== index),
                    )
                  }
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set('experiences', [...values.experiences, blankExperience()])}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 border border-[var(--border)] rounded-lg hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" /> Add Work Experience
          </button>
        </div>
      </SectionCard>

      {/* Certificates */}
      <SectionCard title="Certificates">
        <div className="space-y-4">
          {values.certifications.map((row, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 space-y-3"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-3">
                  <div>
                    <label className={labelClass}>Certificate Name</label>
                    <input
                      className={inputClass}
                      placeholder="Certificate Name"
                      value={row.name}
                      onChange={(e) => updateCert(index, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Issuing Organization</label>
                    <input
                      className={inputClass}
                      placeholder="Issuing Organization"
                      value={row.issuer}
                      onChange={(e) => updateCert(index, { issuer: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Start Date</label>
                      <input
                        className={inputClass}
                        placeholder="e.g. Mar 2022"
                        value={row.issueDate}
                        onChange={(e) => updateCert(index, { issueDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>End Date</label>
                      <input
                        className={inputClass}
                        placeholder="e.g. Mar 2024 (or blank)"
                        value={row.expirationDate}
                        onChange={(e) => updateCert(index, { expirationDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <RemoveBtn
                  disabled={values.certifications.length <= 1}
                  onClick={() =>
                    set(
                      'certifications',
                      values.certifications.filter((_, i) => i !== index),
                    )
                  }
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set('certifications', [...values.certifications, blankCert()])}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 border border-[var(--border)] rounded-lg hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" /> Add Certificate
          </button>
        </div>
      </SectionCard>

      {/* Resume Template */}
      <SectionCard title="Resume Template">
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-template`}>
            Select a template
          </label>
          <select
            id={`${idPrefix}-template`}
            className={cn(inputClass)}
            value={values.defaultTemplateId}
            onChange={(e) => set('defaultTemplateId', e.target.value)}
          >
            <option value="">Select a template</option>
            {published.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </SectionCard>
    </div>
  );
}

/** Controlled helper when parent wants local state convenience */
export function useProfileFormState(initial?: ProfileFormValues) {
  return useState<ProfileFormValues>(initial || emptyProfileFormValues());
}
