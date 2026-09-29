// Permission-aware wrappers. Client checks are UX; every one has a policy behind it.
import type { ComponentProps, ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import type { Permission } from '@/lib/types';
import { Button } from './kit';

/** Renders nothing without the permission. */
export function Can({ perm, children, fallback = null }: { perm: Permission; children: ReactNode; fallback?: ReactNode }) {
  const { can } = useAuth();
  return <>{can(perm) ? children : fallback}</>;
}

const WHY: Partial<Record<Permission, string>> = {
  'finance:write': 'Only owners and planners can change money.',
  'finance:read': 'Only owners and planners can see money.',
  'settings:write': 'Only owners and planners can change the wedding settings.',
  'vendors:write': 'Only owners and planners can change vendors.',
  'members:manage': 'Only owners can manage the team.',
  'assistant:apply': 'Only owners and planners can apply the assistant’s changes.',
  'guests:contact': 'You can’t see guest contact details.',
};

export function whyNot(perm: Permission): string {
  return WHY[perm] ?? 'You have read-only access to this.';
}

/** Disabled with a tooltip explaining why — hiding a control makes the app feel broken. */
export function CanButton({ perm, title, disabled, ...rest }: { perm: Permission } & ComponentProps<typeof Button>) {
  const { can } = useAuth();
  const allowed = can(perm);
  return <Button {...rest} disabled={!allowed || disabled} title={allowed ? title : whyNot(perm)} />;
}
