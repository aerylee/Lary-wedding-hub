import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/kit';
import { FullScreen, Splash } from './Guards';

/** /join?token=… — an invitation link. Signed out: sign in first. Signed in: accept it. */
export function Join() {
  const { loading, session, refreshMemberships, signOut } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  useEffect(() => {
    if (!session || !token || tried.current) return;
    tried.current = true;
    (async () => {
      const { data: weddingId, error: err } = await supabase.rpc('accept_invitation', { p_token: token });
      if (err) {
        setError(err.message);
        return;
      }
      await refreshMemberships();
      navigate(`/w/${weddingId}/dashboard`, { replace: true });
    })();
  }, [session, token, refreshMemberships, navigate]);

  if (loading) return <Splash />;
  if (!token) return <Navigate to="/" replace />;
  if (!session) return <Navigate to={`/auth?next=${encodeURIComponent(`/join?token=${token}`)}`} replace />;
  if (!error) return <Splash label="Accepting your invitation…" />;

  return (
    <FullScreen>
      <div className="max-w-md rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <h1 className="font-serif text-2xl font-semibold">We couldn&rsquo;t use that invitation</h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{error}</p>
        <p className="mt-2 text-sm text-stone-500">
          You&rsquo;re signed in as <strong>{session.user.email}</strong>. Invitations only work for the address they were sent to.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => signOut()}>Sign in as someone else</Button>
          <Link to="/"><Button variant="primary">Go to my hub</Button></Link>
        </div>
      </div>
    </FullScreen>
  );
}
