import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { Permission } from '@/lib/types';
import {
  IconBriefcase, IconClock, IconFlag, IconHome, IconListChecks, IconMail, IconMapPin, IconPlane,
  IconScale, IconSettings, IconTable, IconUsers, IconWallet,
} from '@/components/icons';

export type TabDef = {
  key: string;
  label: string;
  perm: Permission;
  icon: ComponentType<{ size?: number }>;
  component: LazyExoticComponent<ComponentType>;
};

// The thirteen modules. Read permission gates the tab; the nav hides tabs you can't open.
export const TABS: TabDef[] = [
  { key: 'dashboard', label: 'Dashboard', perm: 'settings:read', icon: IconHome, component: lazy(() => import('./Dashboard')) },
  { key: 'venues', label: 'Venues', perm: 'venues:read', icon: IconMapPin, component: lazy(() => import('./Venues')) },
  { key: 'timeline', label: 'Timeline', perm: 'tasks:read', icon: IconListChecks, component: lazy(() => import('./Timeline')) },
  { key: 'budget', label: 'Budget', perm: 'finance:read', icon: IconWallet, component: lazy(() => import('./Budget')) },
  { key: 'vendors', label: 'Vendors', perm: 'vendors:read', icon: IconBriefcase, component: lazy(() => import('./Vendors')) },
  { key: 'guests', label: 'Guests', perm: 'guests:read', icon: IconUsers, component: lazy(() => import('./Guests')) },
  { key: 'travel', label: 'Travel', perm: 'travel:read', icon: IconPlane, component: lazy(() => import('./Travel')) },
  { key: 'seating', label: 'Seating', perm: 'seating:read', icon: IconTable, component: lazy(() => import('./Seating')) },
  { key: 'run-of-show', label: 'Run of show', perm: 'schedule:read', icon: IconClock, component: lazy(() => import('./RunOfShow')) },
  { key: 'comms', label: 'Comms', perm: 'comms:read', icon: IconMail, component: lazy(() => import('./Comms')) },
  { key: 'legal', label: 'Legal', perm: 'legal:read', icon: IconScale, component: lazy(() => import('./Legal')) },
  { key: 'decisions', label: 'Decisions', perm: 'decisions:read', icon: IconFlag, component: lazy(() => import('./Decisions')) },
  { key: 'settings', label: 'Settings', perm: 'settings:read', icon: IconSettings, component: lazy(() => import('./Settings')) },
];

export const TAB_BY_KEY = new Map(TABS.map((t) => [t.key, t]));
