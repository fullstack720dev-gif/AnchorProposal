'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/auth-shell';
import { LoadingSpinner } from '@/components/loading-spinner';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await api.requestRegisterOtp(form);
      setStep('otp');
      toast.success(res.message || 'Verification code sent');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.verifyRegister(form.email.trim().toLowerCase(), code.trim());
      toast.success(res.message || 'Account created — awaiting approval');
      router.push('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell watermark="Create Account">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-white tracking-tight">
          {step === 'form' ? 'Join AnchorProposal' : 'Verify Email'}
        </h1>
        <p className="mt-2 text-sm text-white/75">
          {step === 'form'
            ? 'Create your bidder account to start applying'
            : `Enter the code sent to ${form.email}`}
        </p>

        {step === 'form' ? (
          <form onSubmit={handleRequestOtp} className="mt-8 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="auth-label" htmlFor="reg-first">
                  First name
                </label>
                <input
                  id="reg-first"
                  type="text"
                  value={form.firstName}
                  onChange={set('firstName')}
                  className="auth-input"
                  required
                />
              </div>
              <div>
                <label className="auth-label" htmlFor="reg-last">
                  Last name
                </label>
                <input
                  id="reg-last"
                  type="text"
                  value={form.lastName}
                  onChange={set('lastName')}
                  className="auth-input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="auth-label" htmlFor="reg-email">
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set('email')}
                className="auth-input"
                required
              />
            </div>

            <div>
              <label className="auth-label" htmlFor="reg-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set('password')}
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
              <label className="auth-label" htmlFor="reg-confirm">
                Confirm password
              </label>
              <input
                id="reg-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                className="auth-input"
                minLength={8}
                required
              />
            </div>

            <button type="submit" disabled={loading} className="auth-btn mt-2">
              {loading ? <LoadingSpinner size="sm" className="text-primary-deep" /> : null}
              {loading ? 'Sending code…' : 'Create Account'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-8 space-y-4">
            <div>
              <label className="auth-label" htmlFor="reg-otp">
                Verification code
              </label>
              <input
                id="reg-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="auth-input tracking-widest text-center"
                placeholder="6-digit code"
                maxLength={6}
                required
              />
            </div>
            <button type="submit" disabled={loading || code.length !== 6} className="auth-btn">
              {loading ? <LoadingSpinner size="sm" className="text-primary-deep" /> : null}
              {loading ? 'Creating account…' : 'Verify and create account'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('form');
                setCode('');
              }}
              className="w-full text-sm text-white/70 hover:text-white"
            >
              Back
            </button>
          </form>
        )}

        <p className="mt-8 text-sm text-white/70">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-white hover:underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
