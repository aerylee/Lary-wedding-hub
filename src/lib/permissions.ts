// The role matrix as people see it: every permission in plain words, grouped by area,
// with the rules the editor keeps (edit needs view; owners keep everything).
import type { AppRole, Permission } from './types';

export type PermDef = {
  perm: Permission;
  label: string;
  hint?: string;
  /** holding this needs these too — ticking it ticks them; unticking them unticks it */
  needs?: Permission[];
  /** owner-only; nobody can hand it out */
  locked?: boolean;
};

export type PermGroup = { area: string; perms: PermDef[] };

export const PERMISSION_GROUPS: PermGroup[] = [
  {
    area: 'Dashboard & wedding settings',
    perms: [
      { perm: 'settings:read', label: 'See the dashboard and wedding settings', hint: 'Also the weekend’s events. Needed to open the hub at all.' },
      { perm: 'settings:write', label: 'Change the wedding settings', hint: 'Date, names, events, exchange rate.', needs: ['settings:read'] },
    ],
  },
  {
    area: 'Venues',
    perms: [
      { perm: 'venues:read', label: 'See venues' },
      { perm: 'venues:write', label: 'Add and edit venues', needs: ['venues:read'] },
    ],
  },
  {
    area: 'Timeline',
    perms: [
      { perm: 'tasks:read', label: 'See the timeline' },
      { perm: 'tasks:write', label: 'Add, edit and tick off tasks', needs: ['tasks:read'] },
    ],
  },
  {
    area: 'Budget & payments',
    perms: [
      { perm: 'finance:read', label: 'See the budget, payments and vendor prices' },
      { perm: 'finance:write', label: 'Change money', needs: ['finance:read'] },
    ],
  },
  {
    area: 'Vendors',
    perms: [
      { perm: 'vendors:read', label: 'See vendors' },
      { perm: 'vendors:write', label: 'Add and edit vendors', needs: ['vendors:read'] },
    ],
  },
  {
    area: 'Guests',
    perms: [
      { perm: 'guests:read', label: 'See the guest list and RSVPs' },
      { perm: 'guests:contact', label: 'See guest emails, phones and addresses', needs: ['guests:read'] },
      { perm: 'guests:write', label: 'Add and edit guests and RSVPs', needs: ['guests:read'] },
    ],
  },
  {
    area: 'Travel',
    perms: [
      { perm: 'travel:read', label: 'See travel and rooms' },
      { perm: 'travel:write', label: 'Edit travel and rooms', needs: ['travel:read'] },
    ],
  },
  {
    area: 'Seating',
    perms: [
      { perm: 'seating:read', label: 'See the seating plan' },
      { perm: 'seating:write', label: 'Edit the seating plan', needs: ['seating:read'] },
    ],
  },
  {
    area: 'Run of show',
    perms: [
      { perm: 'schedule:read', label: 'See the run of show' },
      { perm: 'schedule:write', label: 'Edit the run of show', needs: ['schedule:read'] },
    ],
  },
  {
    area: 'Comms',
    perms: [
      { perm: 'comms:read', label: 'See comms, templates, the FAQ and the vendor log' },
      { perm: 'comms:write', label: 'Edit comms', needs: ['comms:read'] },
    ],
  },
  {
    area: 'Legal',
    perms: [
      { perm: 'legal:read', label: 'See legal documents' },
      { perm: 'legal:write', label: 'Edit legal documents', needs: ['legal:read'] },
    ],
  },
  {
    area: 'Decisions',
    perms: [
      { perm: 'decisions:read', label: 'See decisions' },
      { perm: 'decisions:write', label: 'Edit decisions', needs: ['decisions:read'] },
    ],
  },
  {
    area: 'Files',
    perms: [
      { perm: 'files:read', label: 'Open attachments' },
      { perm: 'files:write', label: 'Upload and delete attachments', needs: ['files:read'] },
    ],
  },
  {
    area: 'Comments & chat',
    perms: [
      { perm: 'comments:write', label: 'Comment on pages and tag people', hint: 'People only see comments on pages they can open.' },
      { perm: 'chat:read', label: 'Read team chat' },
      { perm: 'chat:write', label: 'Post in team chat', needs: ['chat:read'] },
      { perm: 'chat:manage', label: 'Create, rename and organise channels', needs: ['chat:read'] },
    ],
  },
  {
    area: 'Assistant',
    perms: [
      { perm: 'assistant:use', label: 'Ask the assistant' },
      { perm: 'assistant:apply', label: 'Apply the assistant’s suggested changes', needs: ['assistant:use'] },
    ],
  },
  {
    area: 'Team',
    perms: [
      { perm: 'members:manage', label: 'Invite people, change roles and permissions', locked: true },
      { perm: 'wedding:delete', label: 'Delete the wedding', locked: true },
    ],
  },
];

export const ALL_PERMS: PermDef[] = PERMISSION_GROUPS.flatMap((g) => g.perms);
export const PERM_DEF = new Map(ALL_PERMS.map((d) => [d.perm, d]));
export const EDITABLE_ROLES: AppRole[] = ['planner', 'collaborator', 'viewer'];

export type Matrix = Record<AppRole, Set<string>>;
export type Override = { role: AppRole; permission: string; granted: boolean };

/** Defaults from role_permissions, with this wedding's overrides applied. */
export function effectiveMatrix(defaults: { role: AppRole; permission: string }[], overrides: Override[]): Matrix {
  const m: Matrix = { owner: new Set(), planner: new Set(), collaborator: new Set(), viewer: new Set() };
  for (const d of defaults) m[d.role].add(d.permission);
  for (const o of overrides) {
    if (o.role === 'owner') continue;
    if (o.granted) m[o.role].add(o.permission);
    else m[o.role].delete(o.permission);
  }
  return m;
}

/**
 * Tick or untick one cell and keep the matrix coherent: granting something grants what it
 * needs; revoking something revokes what depends on it. Returns a new set.
 */
export function toggle(set: Set<string>, perm: Permission, on: boolean): Set<string> {
  const next = new Set(set);
  if (on) {
    const add = (p: Permission) => {
      if (next.has(p)) return;
      next.add(p);
      PERM_DEF.get(p)?.needs?.forEach(add);
    };
    add(perm);
  } else {
    const drop = (p: Permission) => {
      if (!next.has(p)) return;
      next.delete(p);
      ALL_PERMS.filter((d) => d.needs?.includes(p)).forEach((d) => drop(d.perm));
    };
    drop(perm);
  }
  return next;
}

/** The cells that differ between two matrices, as a batch for set_role_permissions. */
export function diffMatrix(before: Matrix, after: Matrix): Override[] {
  const out: Override[] = [];
  for (const role of EDITABLE_ROLES) {
    for (const d of ALL_PERMS) {
      if (d.locked) continue;
      const a = before[role].has(d.perm);
      const b = after[role].has(d.perm);
      if (a !== b) out.push({ role, permission: d.perm, granted: b });
    }
  }
  return out;
}

/** Can someone in this role read a page? Used to offer only people who will see a comment. */
export function roleCanAll(m: Matrix, role: AppRole, perms: string[]): boolean {
  return perms.every((p) => m[role].has(p));
}

/** Mirrors app.page_read_perms() in the database. */
export function pageReadPerms(page: string): Permission[] {
  const map: Record<string, Permission> = {
    venues: 'venues:read', timeline: 'tasks:read', budget: 'finance:read', vendors: 'vendors:read',
    guests: 'guests:read', travel: 'travel:read', seating: 'seating:read', 'run-of-show': 'schedule:read',
    comms: 'comms:read', legal: 'legal:read', decisions: 'decisions:read',
  };
  return [map[page] ?? 'settings:read'];
}
