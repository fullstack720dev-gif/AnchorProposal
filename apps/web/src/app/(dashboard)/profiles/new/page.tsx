'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { ArrowLeft, UserRound } from 'lucide-react';
import {
  ProfileForm,
  emptyProfileFormValues,
  profileFormToApiPayload,
  validateProfileForm,
  type ProfileFormValues,
  type TemplateOption,
} from '@/components/profile-form';

export default function NewProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileFormValues>(emptyProfileFormValues());
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .getTemplates()
      .then((data) => {
        const list = (data as TemplateOption[]).filter((t) => t.isPublished !== false);
        setTemplates(list);
      })
      .catch(() => undefined);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const error = validateProfileForm(form);
    if (error) {
      toast.error(error);
      return;
    }
    setLoading(true);
    try {
      const payload = profileFormToApiPayload(form);
      const result = (await api.createProfile(payload)) as { id: string };
      toast.success('Profile created');
      router.push(`/profiles/${result.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <Link
        href="/profiles"
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Profiles
      </Link>

      <div className="flex items-center gap-2 mb-6">
        <UserRound className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Profile Create</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <ProfileForm values={form} onChange={setForm} templates={templates} />
        <div className="flex justify-end gap-3 pb-8">
          <Link
            href="/profiles"
            className="px-4 py-2.5 text-sm font-medium text-slate-700 border border-[var(--border)] rounded-lg hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
