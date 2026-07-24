'use client';

import { FormEvent, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/auth-shell';
import { LoadingSpinner } from '@/components/loading-spinner';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('Missing reset token. Use the link from your email.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await api.resetPassword(token, password, confirmPassword);
      toast.success(res.message || 'Password updated');
      router.push('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-4xl sm:text-5xl font-semibold text-white tracking-tight">
        New Password
      </h1>
      <p className="mt-2 text-sm text-white/75">Choose a new password for your account</p>

      {!token && (
        <div className="mt-4 rounded-md bg-amber-400/20 text-amber-50 text-sm px-3 py-2 border border-amber-200/30">
          Open this page from the reset link in your email.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="auth-label" htmlFor="reset-password">
            New password
          </label>
          <div className="relative">
            <input
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input pr-11"
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        <div>
          <label className="auth-label" htmlFor="reset-confirm">
            Confirm password
          </label>
          <input
            id="reset-confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="auth-input"
            minLength={8}
            required
          />
        </div>

        <button type="submit" disabled={loading || !token} className="auth-btn mt-2">
          {loading ? <LoadingSpinner size="sm" className="text-primary-deep" /> : null}
          {loading ? 'Saving…' : 'Update password'}
        </button>
      </form>

      <p className="mt-8 text-sm text-white/70">
        <Link href="/login" className="font-semibold text-white hover:underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell watermark="Reset">
      <Suspense
        fallback={
          <div className="flex justify-center py-20 text-white">
            <LoadingSpinner size="md" className="text-white" label="Loading" />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
