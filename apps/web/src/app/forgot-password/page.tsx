'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/auth-shell';
import { LoadingSpinner } from '@/components/loading-spinner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.forgotPassword(email.trim());
      toast.success(res.message || 'If this email is eligible, a reset link has been sent.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell watermark="Reset">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-white tracking-tight">
          Forgot Password
        </h1>
        <p className="mt-2 text-sm text-white/75">
          Enter your email and we&apos;ll send a reset link
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="auth-label" htmlFor="forgot-email">
              Email Address
            </label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="you@example.com"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="auth-btn mt-2">
            {loading ? <LoadingSpinner size="sm" className="text-primary-deep" /> : null}
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-8 text-sm text-white/70">
          <Link href="/login" className="font-semibold text-white hover:underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
