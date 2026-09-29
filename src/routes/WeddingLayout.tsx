// The app shell (main spec §6): header, switcher, role badge, permission-filtered nav,
// viewer banner, loading/error/no-access states, the assistant and the footer caveat.
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth, ROLE_LABEL } from '@/lib/auth';
import { StoreProvider, useStore } from '@/lib/store';
import { chosenVenue, countdown } from '@/lib/derive';
import { cls, fmtDateLong } from '@/lib/util';
import { Banner, Button, Empty, Pill, Spinner } from '@/components/kit';
import { IconChevronDown, IconLock, IconMenu, IconMoon, IconSun, IconX } from '@/components/icons';
import { useTheme } from '@/components/theme';
import { TABS, TAB_BY_KEY } from '@/modules/registry';
import { FullScreen, Splash } from './Guards';
import { Team } from './Team';

const Assistant = lazy(() => import('@/modules/Assistant'));

export function WeddingLayout() {
  const { weddingId = '' } = useParams();
  const { memberships, membershipsLoaded, selectWedding, permissionsLoaded, weddingId: current, refreshMemberships } = useAuth();

  useEffect(() => {
    selectWedding(weddingId);
  }, [weddingId, selectWedding]);

  if (!membershipsLoaded) return <Splash label="Loading your weddings…" />;
  const member = memberships.find((m) => m.wedding_id === weddingId);
  if (!member) return <NoAccess onRetry={refreshMemberships} />;
  if (!permissionsLoaded || current !== weddingId) return <Splash label="Loading the hub…" />;

  return (
    <StoreProvider key={weddingId} weddingId={weddingId}>
      <Shell />
    </StoreProvider>
  );
}

function NoAccess({ onRetry }: { onRetry: () => void }) {
  const { memberships, signOut } = useAuth();
  return (
    <FullScreen>
      <div className="max-w-md text-center">
        <IconLock size={28} className="mx-auto text-stone-400" />
        <h1 className="mt-3 font-serif text-2xl font-semibold">You no longer have access to this wedding</h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
          An owner may have removed you, or the link is for a wedding you were never part of. If you think that&rsquo;s a mistake, ask one of the couple to invite you again.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {memberships.length > 0 ? (
            <Link to="/"><Button variant="primary">Go to my other wedding{memberships.length > 1 ? 's' : ''}</Button></Link>
          ) : (
            <Link to="/onboarding"><Button variant="primary">Create a wedding</Button></Link>
          )}
          <Button onClick={onRetry}>Check again</Button>
          <Button variant="subtle" onClick={() => signOut()}>Sign out</Button>
        </div>
      </div>
    </FullScreen>
  );
}

function Shell() {
  const { ready, loadError, settings, get } = useStore();
  const { can, role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenuOpen(false), [loc.pathname]);

  const tabs = TABS.filter((t) => can(t.perm));
  const { venue } = chosenVenue(get('venues'));
  const { days } = countdown(settings.target_date);
  const couple = [settings.couple_a, settings.couple_b].filter(Boolean).join(' & ');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-stone-50/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <button className="rounded-lg p-1.5 hover:bg-stone-200 dark:hover:bg-stone-800 lg:hidden" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? <IconX size={20} /> : <IconMenu size={20} />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-serif text-xl font-semibold leading-tight">{couple || 'Our wedding'}</div>
            <div className="truncate text-xs text-stone-500 dark:text-stone-400">
              {fmtDateLong(settings.target_date)}
              {!settings.date_is_firm && ' · date not final'}
              {venue && ` · ${venue.name}`}
            </div>
          </div>
          <div className="hidden text-right sm:block" title="Days until the wedding">
            <div className="text-lg font-semibold tabular-nums leading-tight">{days >= 0 ? days : 0}</div>
            <div className="text-[11px] uppercase tracking-wide text-stone-500">{days >= 0 ? 'days out' : 'married!'}</div>
          </div>
          <WeddingSwitcher />
          <ThemeToggle />
          <UserMenu />
        </div>
        <nav aria-label="Modules" className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-3 pb-2 lg:flex">
          {tabs.map((t) => (
            <NavLink
              key={t.key}
              to={t.key}
              className={({ isActive }) =>
                cls(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium',
                  isActive ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100',
                )
              }
            >
              <t.icon size={15} />
              {t.label}
            </NavLink>
          ))}
        </nav>
        {menuOpen && (
          <nav aria-label="Modules" className="grid grid-cols-2 gap-1 border-t border-stone-200 px-3 py-2 dark:border-stone-800 sm:grid-cols-3 lg:hidden">
            {tabs.map((t) => (
              <NavLink
                key={t.key}
                to={t.key}
                className={({ isActive }) =>
                  cls('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', isActive ? 'bg-amber-100 font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' : 'hover:bg-stone-200/60 dark:hover:bg-stone-800')
                }
              >
                <t.icon size={16} />
                {t.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {role === 'viewer' && <Banner tone="info">You have read-only access to this hub. Money and guest contact details are hidden.</Banner>}
        {loadError ? (
          <Empty title="The hub couldn't load" body={loadError} action={<Button onClick={() => window.location.reload()}>Try again</Button>} />
        ) : !ready ? (
          <div className="py-16"><Spinner label="Loading the plan…" /></div>
        ) : (
          <Suspense fallback={<div className="py-16"><Spinner /></div>}>
            <Routes>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="team" element={can('members:manage') ? <Team /> : <NoPermission what="the team page" />} />
              <Route path=":tab" element={<TabRoute />} />
            </Routes>
          </Suspense>
        )}
      </main>

      {ready && can('assistant:use') && (
        <Suspense fallback={null}>
          <Assistant />
        </Suspense>
      )}

      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-stone-500 dark:text-stone-500">
        Benchmark figures — prices, lead times, document validity — are planning estimates, not quotes or legal advice. Check everything with the people who will actually do it.
      </footer>
    </div>
  );
}

function TabRoute() {
  const { tab = '' } = useParams();
  const { can } = useAuth();
  const def = TAB_BY_KEY.get(tab);
  if (!def) return <Navigate to="../dashboard" replace />;
  if (!can(def.perm)) return <NoPermission what={def.label} />;
  const C = def.component;
  return <C />;
}

function NoPermission({ what }: { what: string }) {
  return (
    <Empty
      icon={<IconLock size={28} />}
      title={`${what} isn't available to you`}
      body="Your role on this wedding doesn't include it. If you need it, ask an owner to change your role."
      action={<Link to="../dashboard"><Button>Back to the dashboard</Button></Link>}
    />
  );
}

function WeddingSwitcher() {
  const { memberships, weddingId } = useAuth();
  const navigate = useNavigate();
  if (memberships.length <= 1) return null;
  return (
    <label className="hidden md:block">
      <span className="sr-only">Switch wedding</span>
      <select
        className="h-8 max-w-[11rem] rounded-lg border border-stone-300 bg-white px-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        value={weddingId ?? ''}
        onChange={(e) => navigate(`/w/${e.target.value}/dashboard`)}
      >
        {memberships.map((m) => (
          <option key={m.wedding_id} value={m.wedding_id}>{m.wedding.name}</option>
        ))}
      </select>
    </label>
  );
}

function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <button className="rounded-lg p-2 text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title="Light / dark">
      {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
    </button>
  );
}

function UserMenu() {
  const { profile, session, role, can, memberships, weddingId, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const name = profile?.full_name || session?.user.email || '';
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');

  return (
    <div className="relative" ref={ref}>
      <button className="flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 hover:bg-stone-200 dark:hover:bg-stone-800" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-700 text-xs font-semibold text-white">{initials || '?'}</span>
        {role && <Pill tone={role === 'viewer' ? 'muted' : role === 'owner' ? 'warn' : 'default'} className="hidden sm:inline-flex">{ROLE_LABEL[role]}</Pill>}
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg dark:border-stone-800 dark:bg-stone-900">
          <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <div className="truncate text-sm font-medium">{profile?.full_name || 'No name set'}</div>
            <div className="truncate text-xs text-stone-500">{session?.user.email}</div>
            {role && <div className="mt-1 text-xs text-stone-500">{ROLE_LABEL[role]} on this wedding</div>}
          </div>
          {memberships.length > 1 && (
            <div className="border-b border-stone-100 py-1 md:hidden dark:border-stone-800">
              {memberships.filter((m) => m.wedding_id !== weddingId).map((m) => (
                <MenuItem key={m.wedding_id} onClick={() => navigate(`/w/${m.wedding_id}/dashboard`)}>Switch to {m.wedding.name}</MenuItem>
              ))}
            </div>
          )}
          <div className="py-1">
            <MenuItem onClick={() => navigate('/account')}>Account</MenuItem>
            {can('members:manage') && <MenuItem onClick={() => navigate(`/w/${weddingId}/team`)}>Team</MenuItem>}
            <MenuItem onClick={() => navigate('/onboarding')}>Create another wedding</MenuItem>
            <MenuItem onClick={() => signOut()}>Sign out</MenuItem>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button role="menuitem" className="block w-full px-4 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800" onClick={onClick}>
      {children}
    </button>
  );
}
