import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button, Field, Input } from '@/components/kit';
import { IconHeart, IconMail } from '@/components/icons';
import { FullScreen, Splash } from './Guards';

function safeNext(n: string | null): string {
  return n && n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

/** Read an auth error Supabase put in the URL (query or hash) after a failed magic link. */
function urlAuthError(): string | null {
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = q.get('error_code') ?? h.get('error_code');
  const desc = q.get('error_description') ?? h.get('error_description');
  if (!code && !desc) return null;
  if (code === 'otp_expired' || /expired|invalid/i.test(desc ?? '')) {
    return 'That sign-in link has expired or was already used. Links work once, for an hour — send yourself a new one.';
  }
  return desc ?? 'Sign-in failed. Send yourself a new link.';
}

export function AuthScreen() {
  const { loading, session } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    const e = urlAuthError();
    if (e) setError(e);
  }, []);

  if (!supabaseConfigured) return <NotConfigured />;
  if (loading) return <Splash label="Checking your session…" />;
  if (session) return <Navigate to={next} replace />;

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setState('sending');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
    });
    if (err) {
      setState('idle');
      setError(/rate|too many|seconds/i.test(err.message) ? 'Too many links requested — wait a minute and try again.' : err.message);
      return;
    }
    setState('sent');
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (err) setError('That code didn’t work — it may have expired. Send a new link.');
  }

  return (
    <FullScreen>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <IconHeart size={22} />
          </div>
          <h1 className="font-serif text-3xl font-semibold">Wedding Planning Hub</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Sign in with a link sent to your email. No password.</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900">
            {error}
          </div>
        )}

        {state === 'sent' ? (
          <div className="rounded-xl border border-stone-200 bg-white p-5 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <IconMail size={28} className="mx-auto text-amber-700" />
            <h2 className="mt-2 font-serif text-xl font-semibold">Check your inbox</h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              We sent a sign-in link to <strong>{email}</strong>. It works once, for an hour. If it isn&rsquo;t there in a minute, look in spam.
            </p>
            <form onSubmit={verifyCode} className="mt-4 space-y-2 text-left">
              <Field label="Or enter the 6-digit code from the email">
                <Input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
              </Field>
              <Button type="submit" className="w-full" disabled={code.trim().length < 6}>Sign in with code</Button>
            </form>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="subtle" size="sm" onClick={() => setState('idle')}>Use a different email</Button>
              <Button variant="subtle" size="sm" onClick={() => send()}>Send again</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-3 rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <Field label="Email">
              <Input type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            <Button type="submit" variant="primary" className="w-full" disabled={state === 'sending' || !email.includes('@')}>
              {state === 'sending' ? 'Sending…' : 'Send me a link'}
            </Button>
          </form>
        )}
      </div>
    </FullScreen>
  );
}

function NotConfigured() {
  return (
    <FullScreen>
      <div className="max-w-md rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <h1 className="font-serif text-xl font-semibold">Supabase isn&rsquo;t configured</h1>
        <p className="mt-2">
          Copy <code>.env.example</code> to <code>.env.local</code> and set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart the dev server. See the README.
        </p>
      </div>
    </FullScreen>
  );
}
