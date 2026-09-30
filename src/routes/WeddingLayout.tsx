// The app shell (main spec §6): header, switcher, role badge, permission-filtered nav,
// viewer banner, loading/error/no-access states, the assistant and the footer caveat.
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth, ROLE_LABEL } from '@/lib/auth';
import { StoreProvider, useStore } from '@/lib/store';
import { CollabProvider, useCollab } from '@/lib/collab';
import { chosenVenue, countdown } from '@/lib/derive';
import { cls, fmtDateLong } from '@/lib/util';
import { Banner, Button, Empty, Pill, Spinner } from '@/components/kit';
import {
  IconChat, IconChevronDown, IconChevronLeft, IconChevronRight, IconHeart, IconLock, IconMenu, IconMessage, IconMessagePlus, IconMoon, IconSun, IconX,
} from '@/components/icons';
import { CommentLayer, CommentSidebar, useCommentUi } from '@/components/comments/CommentLayer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useTheme } from '@/components/theme';
import { TABS, TAB_BY_KEY } from '@/modules/registry';
import { FullScreen, Splash } from './Guards';
import { AccountAndTeam } from './AccountAndTeam';

const Assistant = lazy(() => import('@/modules/Assistant'));
const Chat = lazy(() => import('@/modules/Chat'));

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
      <CollabProvider>
        <CommentLayer>
          <Shell />
        </CommentLayer>
      </CollabProvider>
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

const SIDEBAR_KEY = 'hub:sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

function Shell() {
  const { ready, loadError, settings, get } = useStore();
  const { can, permissions } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const loc = useLocation();
  useEffect(() => setMenuOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [menuOpen]);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, c ? '0' : '1');
      } catch {
        /* only a convenience */
      }
      return !c;
    });

  const tabs = TABS.filter((t) => can(t.perm));
  // no permission to change any part of the plan (commenting and chatting don't count)
  const readOnly = ![...permissions].some((p) => p.endsWith(':write') && !p.startsWith('comments') && !p.startsWith('chat'));
  const hidden = [!can('finance:read') && 'money', !can('guests:contact') && 'guest contact details'].filter(Boolean) as string[];
  const { venue } = chosenVenue(get('venues'));
  const { days } = countdown(settings.target_date);
  const couple = [settings.couple_a, settings.couple_b].filter(Boolean).join(' & ');

  return (
    <div className="min-h-screen lg:flex">
      {/* desktop: a sticky left rail that collapses to icons */}
      <aside
        className={cls(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-stone-200 bg-white transition-[width] duration-200 dark:border-stone-800 dark:bg-stone-900 lg:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <SideNav tabs={tabs} collapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>

      {/* mobile: the same nav as a drawer from the left */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-stone-950/40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col bg-white shadow-xl dark:bg-stone-900">
            <SideNav tabs={tabs} collapsed={false} onClose={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-stone-50/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
            <button className="rounded-lg p-1.5 hover:bg-stone-200 dark:hover:bg-stone-800 lg:hidden" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
              <IconMenu size={20} />
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
            <CommentButtons />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6" data-comment-root>
          {readOnly && !loc.pathname.endsWith('/chat') && (
            <Banner tone="info">
              You have read-only access to this hub{hidden.length ? ` — ${hidden.join(' and ')} ${hidden.length === 1 ? 'is' : 'are'} hidden` : ''}.
              {can('comments:write') && ' You can still comment and chat.'}
            </Banner>
          )}
          {loadError ? (
            <Empty title="The hub couldn't load" body={loadError} action={<Button onClick={() => window.location.reload()}>Try again</Button>} />
          ) : !ready ? (
            <div className="py-16"><Spinner label="Loading the plan…" /></div>
          ) : (
            <ErrorBoundary resetKey={loc.pathname}>
            <Suspense fallback={<div className="py-16"><Spinner /></div>}>
              <Routes>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="account" element={<AccountAndTeam />} />
                <Route path="chat" element={<Chat />} />
                <Route path="team" element={<Navigate to="../account" replace />} />
                <Route path=":tab" element={<TabRoute />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
          )}
        </main>

        <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-stone-500 dark:text-stone-500">
          Benchmark figures — prices, lead times, document validity — are planning estimates, not quotes or legal advice. Check everything with the people who will actually do it.
        </footer>
      </div>

      <CommentSidebar />

      {/* the chat has its own composer where the assistant's button would sit */}
      {ready && can('assistant:use') && !loc.pathname.endsWith('/chat') && (
        <Suspense fallback={null}>
          <Assistant />
        </Suspense>
      )}
    </div>
  );
}

function SideNav({ tabs, collapsed, onToggle, onClose }: { tabs: typeof TABS; collapsed: boolean; onToggle?: () => void; onClose?: () => void }) {
  const { can } = useAuth();
  const { totalUnread } = useCollab();
  return (
    <>
      <div className={cls('flex h-14 shrink-0 items-center border-b border-stone-100 dark:border-stone-800', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
        {!collapsed && (
          <span className="flex items-center gap-2 font-serif text-lg font-semibold">
            <IconHeart size={16} className="text-amber-700" /> Wedding Hub
          </span>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
          </button>
        )}
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800" aria-label="Close menu">
            <IconX size={18} />
          </button>
        )}
      </div>
      <nav aria-label="Modules" className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {can('chat:read') && (
          <>
            <NavLink
              to="chat"
              title={collapsed ? `Team chat${totalUnread ? ` (${totalUnread} unread)` : ''}` : undefined}
              className={({ isActive }) =>
                cls(
                  'relative flex items-center rounded-lg text-sm font-medium transition-colors',
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2',
                  isActive
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100',
                )
              }
            >
              <IconChat size={collapsed ? 18 : 16} />
              {!collapsed && <span className="truncate">Team chat</span>}
              {collapsed && <span className="sr-only">Team chat</span>}
              {totalUnread > 0 && (
                <span className={cls('rounded-full bg-amber-600 px-1.5 text-[10px] font-semibold leading-4 text-white', collapsed ? 'absolute right-1.5 top-1' : 'ml-auto')}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </NavLink>
            <div className="mx-2 my-2 border-t border-stone-100 dark:border-stone-800" />
          </>
        )}
        {tabs.map((t) => (
          <NavLink
            key={t.key}
            to={t.key}
            title={collapsed ? t.label : undefined}
            className={({ isActive }) =>
              cls(
                'flex items-center rounded-lg text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2',
                isActive
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100',
              )
            }
          >
            <t.icon size={collapsed ? 18 : 16} />
            {!collapsed && <span className="truncate">{t.label}</span>}
            {collapsed && <span className="sr-only">{t.label}</span>}
          </NavLink>
        ))}
      </nav>
    </>
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
      body="Your role on this wedding doesn't include it. If you need it, ask an owner to change your role or what it can do."
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

function CommentButtons() {
  const { commentable, mode, setMode, panel, setPanel, unreadMentions, pageCount } = useCommentUi();
  return (
    <div className="flex items-center" data-comment-ui>
      {commentable && (
        <button
          className={cls(
            'rounded-lg p-2 transition-colors',
            mode ? 'bg-amber-600 text-white hover:bg-amber-700' : 'text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800',
          )}
          onClick={() => setMode(!mode)}
          aria-pressed={mode}
          aria-label={mode ? 'Stop commenting' : 'Comment on something on this page'}
          title="Comment mode (C)"
        >
          <IconMessagePlus size={18} />
        </button>
      )}
      <button
        className={cls(
          'relative rounded-lg p-2 transition-colors',
          panel ? 'bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-100' : 'text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800',
        )}
        onClick={() => setPanel(!panel)}
        aria-pressed={panel}
        aria-label={`Comments${unreadMentions ? `, ${unreadMentions} new mentions` : ''}`}
        title="Comments and mentions"
      >
        <IconMessage size={18} />
        {unreadMentions > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-rose-600 px-1 text-center text-[10px] font-semibold leading-[1.1rem] text-white">{unreadMentions}</span>
        ) : pageCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-stone-500 px-1 text-center text-[10px] font-semibold leading-[1.1rem] text-white">{pageCount}</span>
        ) : null}
      </button>
    </div>
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
  const { profile, session, role, memberships, weddingId, signOut } = useAuth();
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
            <MenuItem onClick={() => navigate(`/w/${weddingId}/account`)}>Account &amp; team</MenuItem>
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
