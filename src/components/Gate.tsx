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

// Roles are editable per wedding, so the reasons talk about "your role", not role names.
const WHY: Partial<Record<Permission, string>> = {
  'finance:write': 'Your role can’t change money on this wedding.',
  'finance:read': 'Your role can’t see money on this wedding.',
  'settings:write': 'Your role can’t change the wedding settings.',
  'vendors:write': 'Your role can’t change vendors.',
  'members:manage': 'Only owners can manage the team.',
  'assistant:apply': 'Your role can’t apply the assistant’s changes.',
  'guests:contact': 'Your role can’t see guest contact details.',
  'comments:write': 'Your role can’t comment on this wedding.',
  'chat:write': 'Your role can read the chat but not post.',
  'chat:manage': 'Your role can’t create or organise channels.',
};

export function whyNot(perm: Permission): string {
  return WHY[perm] ?? 'Your role has read-only access to this.';
}

/** Disabled with a tooltip explaining why — hiding a control makes the app feel broken. */
export function CanButton({ perm, title, disabled, ...rest }: { perm: Permission } & ComponentProps<typeof Button>) {
  const { can } = useAuth();
  const allowed = can(perm);
  return <Button {...rest} disabled={!allowed || disabled} title={allowed ? title : whyNot(perm)} />;
}
