import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth, ROLE_LABEL } from '@/lib/auth';
import { Button, Field, Input, Panel, PanelHead, Pill } from '@/components/kit';
import { useToast } from '@/components/toast';

/** Standalone page, reachable before you belong to any wedding. */
export function Account() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Link to="/" className="text-sm text-amber-800 underline dark:text-amber-400">&larr; Back to the hub</Link>
      <h1 className="mt-3 mb-5 font-serif text-3xl font-semibold">Your account</h1>
      <AccountSections />
    </div>
  );
}

export function AccountSections({ wide = false }: { wide?: boolean }) {
  const { session, profile, memberships, refreshProfile, signOut } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  useEffect(() => {
    setName(profile?.full_name ?? '');
  }, [profile?.full_name]);

  async function save() {
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', session!.user.id);
    if (error) toast(`Couldn't save your name: ${error.message}`);
    else {
      toast('Saved', 'ok');
      refreshProfile();
    }
  }

  return (
    <div className={wide ? 'grid gap-4 lg:grid-cols-3' : 'grid gap-4'}>
      <Panel>
        <PanelHead title="Profile" />
        <div className="space-y-3 p-4">
          <Field label="Display name" hint="What the team sees in the activity feed.">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" hint="Sign-in links go here. It can't be changed from the app.">
            <Input value={session?.user.email ?? ''} readOnly disabled />
          </Field>
          <Button variant="primary" onClick={save} disabled={name.trim() === (profile?.full_name ?? '')}>Save</Button>
        </div>
      </Panel>
      <Panel>
        <PanelHead title="Your weddings" />
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {memberships.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <Link className="hover:underline" to={`/w/${m.wedding_id}/dashboard`}>{m.wedding.name}</Link>
              <Pill>{ROLE_LABEL[m.role]}</Pill>
            </li>
          ))}
          <li className="px-4 py-2.5 text-sm"><Link className="text-amber-800 underline dark:text-amber-400" to="/onboarding">Create another wedding</Link></li>
        </ul>
      </Panel>
      <Panel>
        <PanelHead title="Sign out" />
        <div className="flex flex-wrap gap-2 p-4">
          <Button onClick={() => signOut('local')}>Sign out</Button>
          <Button variant="danger" onClick={() => signOut('global')} title="Ends your session on every device">Sign out everywhere</Button>
        </div>
      </Panel>
    </div>
  );
}
