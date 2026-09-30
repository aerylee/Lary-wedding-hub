import { describe, expect, it } from 'vitest';
import { diffMatrix, effectiveMatrix, pageReadPerms, toggle } from './permissions';
import { extractMentions } from '@/components/MentionInput';

const defaults = [
  { role: 'owner' as const, permission: 'finance:read' },
  { role: 'planner' as const, permission: 'finance:read' },
  { role: 'planner' as const, permission: 'finance:write' },
  { role: 'collaborator' as const, permission: 'guests:read' },
];

describe('role matrix', () => {
  it('applies overrides over the defaults, never to owners', () => {
    const m = effectiveMatrix(defaults, [
      { role: 'collaborator', permission: 'finance:read', granted: true },
      { role: 'planner', permission: 'finance:write', granted: false },
      { role: 'owner', permission: 'finance:read', granted: false },
    ]);
    expect(m.collaborator.has('finance:read')).toBe(true);
    expect(m.planner.has('finance:write')).toBe(false);
    expect(m.owner.has('finance:read')).toBe(true);
  });

  it('ticking edit ticks view; unticking view unticks what depends on it', () => {
    let s = toggle(new Set(), 'finance:write', true);
    expect([...s].sort()).toEqual(['finance:read', 'finance:write']);
    s = toggle(new Set(['guests:read', 'guests:write', 'guests:contact', 'tasks:read']), 'guests:read', false);
    expect([...s]).toEqual(['tasks:read']);
  });

  it('diffs only editable roles and unlocked permissions', () => {
    const before = effectiveMatrix(defaults, []);
    const after = effectiveMatrix(defaults, [{ role: 'viewer', permission: 'finance:read', granted: true }]);
    after.owner.delete('finance:read');
    after.planner.add('members:manage');
    expect(diffMatrix(before, after)).toEqual([{ role: 'viewer', permission: 'finance:read', granted: true }]);
  });

  it('knows which permission reads each page', () => {
    expect(pageReadPerms('budget')).toEqual(['finance:read']);
    expect(pageReadPerms('run-of-show')).toEqual(['schedule:read']);
    expect(pageReadPerms('account')).toEqual(['settings:read']);
  });
});

describe('mentions', () => {
  const people = [
    { id: 'a', name: 'Jo', email: 'jo@x.test' },
    { id: 'b', name: 'Jo Ann', email: 'ann@x.test' },
    { id: 'c', name: 'Paola', email: 'p@x.test' },
  ];
  it('finds who is still named, longest names first', () => {
    expect(extractMentions('@Jo Ann can you check with @paola?', people).sort()).toEqual(['b', 'c']);
    expect(extractMentions('@Jo and @Jo Ann', people).sort()).toEqual(['a', 'b']);
    expect(extractMentions('email jo@x.test', people)).toEqual([]);
  });
});
