'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { AuthShell } from '@/components/auth-shell';
import { LoadingSpinner } from '@/components/loading-spinner';

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [authLoading, user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success('Signed in successfully');
      // Hard navigation so dashboard always boots with tokens in localStorage
      // (avoids soft-nav races over ngrok).
      window.location.assign('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign in failed');
      setLoading(false);
    }
  };

  return (
    <AuthShell watermark="Sign In">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-white tracking-tight">
          Welcome Back
        </h1>
        <p className="mt-2 text-sm text-white/75">
          Sign in to continue to AnchorProposal
        </p>

        <form method="post" action="/login" onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="auth-label" htmlFor="login-email">
              Email or username
            </label>
            <input
              id="login-email"
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="you@example.com or Master"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="auth-label mb-0" htmlFor="login-password">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-white/80 hover:text-white underline-offset-2 hover:underline">
                Forgot your password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input pr-11"
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

          <button type="submit" disabled={loading} className="auth-btn mt-2">
            {loading ? <LoadingSpinner size="sm" className="text-primary-deep" /> : null}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-8 text-sm text-white/70">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-white hover:underline underline-offset-2">
            Register
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
