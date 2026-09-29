import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/kit';

export function FullScreen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-4 py-10">{children}</div>;
}

export function Splash({ label = 'Loading…' }: { label?: string }) {
  return (
    <FullScreen>
      <Spinner label={label} />
    </FullScreen>
  );
}

/** Signed-in only; otherwise off to /auth, remembering where they were going. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash label="Checking your session…" />;
  if (!session) return <Navigate to={`/auth?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

/** `/` — send people where they belong. */
export function Home() {
  const { loading, session, memberships, membershipsLoaded, lastWeddingId } = useAuth();
  if (loading) return <Splash label="Checking your session…" />;
  if (!session) return <Navigate to="/auth" replace />;
  if (!membershipsLoaded) return <Splash label="Finding your weddings…" />;
  if (memberships.length === 0) return <Navigate to="/onboarding" replace />;
  const last = lastWeddingId();
  const target = memberships.find((m) => m.wedding_id === last) ?? memberships[0];
  return <Navigate to={`/w/${target.wedding_id}/dashboard`} replace />;
}
