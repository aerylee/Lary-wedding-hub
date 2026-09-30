import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button, Field, Input } from '@/components/kit';
import { addDays, dayOfWeek, isMidweek, todayISO } from '@/lib/util';
import { FullScreen } from './Guards';

/** Signed in, no wedding yet → create one. The invited path never lands here. */
export function Onboarding() {
  const { session, memberships, refreshMemberships, signOut } = useAuth();
  const navigate = useNavigate();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [date, setDate] = useState(addDays(todayISO(), 540));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const name = [a.trim(), b.trim()].filter(Boolean).join(' & ');
    const { data: id, error: err } = await supabase.rpc('create_wedding', { p_name: name, p_target_date: date, p_couple_a: a.trim(), p_couple_b: b.trim() });
    setBusy(false);
    if (err || !id) {
      setError(err?.message ?? 'Something went wrong.');
      return;
    }
    await refreshMemberships();
    navigate(`/w/${id}/dashboard`, { replace: true });
  }

  return (
    <FullScreen>
      <div className="w-full max-w-md">
        <h1 className="text-center font-serif text-3xl font-semibold">Create your wedding</h1>
        <p className="mt-1 text-center text-sm text-stone-500 dark:text-stone-400">
          You&rsquo;ll get a planner&rsquo;s first draft to edit: a timeline, a benchmark budget, the legal paperwork and more.
        </p>
        <p className="mt-2 text-center text-xs text-stone-500">
          Were you invited to someone else&rsquo;s? Open the link in their invitation email — it adds you automatically.
        </p>
        <form onSubmit={create} className="mt-6 space-y-3 rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div className="grid grid-cols-2 gap-3">
            <Field label="One of you"><Input required value={a} onChange={(e) => setA(e.target.value)} placeholder="First name" /></Field>
            <Field label="The other"><Input required value={b} onChange={(e) => setB(e.target.value)} placeholder="First name" /></Field>
          </div>
          <Field label="Working wedding date" hint={`${dayOfWeek(date)}${isMidweek(date) ? ' — a midweek date; guests will need leave' : ''}. You can change it any time; the whole plan moves with it.`}>
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          {(!a.trim() || !b.trim()) && <p className="text-xs text-stone-500">Enter both names to continue.</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={busy || !a.trim() || !b.trim()}>
            {busy ? 'Setting things up…' : 'Create the hub'}
          </Button>
        </form>
        <div className="mt-4 flex justify-center gap-3 text-sm text-stone-500">
          <span>{session?.user.email}</span>
          {memberships.length > 0 && <button className="underline" onClick={() => navigate('/')}>Back to my hub</button>}
          <button className="underline" onClick={() => signOut()}>Sign out</button>
        </div>
      </div>
    </FullScreen>
  );
}
