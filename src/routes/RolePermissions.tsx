// The role matrix editor: which role can see and change what, on this wedding.
// Owners keep everything; the team-level powers stay owner-only. Everyone else is a
// checkbox. Changes are staged and saved together, and take effect for people who are
// signed in right now.
import { useMemo, useState } from 'react';
import { useAuth, ROLE_LABEL } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { EDITABLE_ROLES, PERMISSION_GROUPS, diffMatrix, toggle, type Matrix } from '@/lib/permissions';
import type { AppRole } from '@/lib/types';
import { cls } from '@/lib/util';
import { Button, Panel, PanelHead, Pill } from '@/components/kit';
import { IconCheck, IconLock } from '@/components/icons';

const ROLES: AppRole[] = ['owner', ...EDITABLE_ROLES];

const clone = (m: Matrix): Matrix => ({
  owner: new Set(m.owner), planner: new Set(m.planner), collaborator: new Set(m.collaborator), viewer: new Set(m.viewer),
});

export function RolePermissions() {
  const { roles, members } = useStore();
  const { can, role: myRole } = useAuth();
  const manage = can('members:manage');
  const [draft, setDraft] = useState<Matrix | null>(null);
  const [saving, setSaving] = useState(false);

  const shown = draft ?? roles.matrix;
  const changes = useMemo(() => (draft ? diffMatrix(roles.matrix, draft) : []), [draft, roles.matrix]);
  const custom = useMemo(() => diffMatrix(roles.defaults, roles.matrix).length, [roles.defaults, roles.matrix]);
  const counts = useMemo(() => {
    const c: Record<AppRole, number> = { owner: 0, planner: 0, collaborator: 0, viewer: 0 };
    for (const m of members) if (m.status === 'active') c[m.role]++;
    return c;
  }, [members]);

  const set = (role: AppRole, perm: Parameters<typeof toggle>[1], on: boolean) => {
    const next = clone(shown);
    next[role] = toggle(next[role], perm, on);
    setDraft(next);
  };

  const resetRole = (role: AppRole) => {
    const next = clone(shown);
    next[role] = new Set(roles.defaults[role]);
    setDraft(next);
  };

  async function save() {
    setSaving(true);
    try {
      await roles.save(changes);
      setDraft(null);
    } catch {
      /* toasted; keep the draft */
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel className="mt-5">
      <PanelHead
        title="What each role can do"
        sub={
          manage
            ? 'Tick what each role may see and change on this wedding. Changes apply to everyone in that role as soon as you save — even people signed in right now.'
            : 'What each role can see and change on this wedding. Only owners can change this.'
        }
        actions={custom > 0 && !draft ? <Pill tone="info">{custom} change{custom === 1 ? '' : 's'} from the defaults</Pill> : undefined}
      />

      <div className="overflow-x-auto md:overflow-visible">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-20 border-b border-stone-200 bg-stone-50 px-4 py-2 text-left md:top-[58px] text-xs font-semibold uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">
                Permission
              </th>
              {ROLES.map((r) => (
                <th key={r} scope="col" className="z-10 w-32 border-b border-stone-200 bg-stone-50 px-2 py-2 text-center align-bottom dark:border-stone-800 dark:bg-stone-900 md:sticky md:top-[58px]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-300">{ROLE_LABEL[r]}</div>
                  <div className="text-[11px] font-normal text-stone-400">{counts[r]} {counts[r] === 1 ? 'person' : 'people'}</div>
                  {manage && r !== 'owner' && (
                    <button
                      type="button"
                      className="mt-0.5 text-[11px] font-normal text-amber-700 hover:underline disabled:cursor-default disabled:text-stone-300 disabled:no-underline dark:text-amber-400 dark:disabled:text-stone-600"
                      disabled={sameSet(shown[r], roles.defaults[r])}
                      onClick={() => resetRole(r)}
                    >
                      Reset to defaults
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          {PERMISSION_GROUPS.map((g) => (
            <tbody key={g.area}>
              <tr>
                <th colSpan={ROLES.length + 1} scope="colgroup" className="sticky left-0 border-b border-stone-100 bg-white px-4 pb-1 pt-4 text-left font-serif text-base font-semibold dark:border-stone-800 dark:bg-stone-900">
                  {g.area}
                </th>
              </tr>
              {g.perms.map((d) => (
                <tr key={d.perm} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40">
                  <th scope="row" className="sticky left-0 border-b border-stone-100 bg-white px-4 py-2 text-left font-normal dark:border-stone-800 dark:bg-stone-900">
                    <div>{d.label}</div>
                    {d.hint && <div className="text-xs text-stone-500 dark:text-stone-400">{d.hint}</div>}
                  </th>
                  {ROLES.map((r) => {
                    const on = shown[r].has(d.perm);
                    const fixed = r === 'owner' || d.locked;
                    const pending = !!draft && on !== roles.matrix[r].has(d.perm);
                    const nonDefault = on !== roles.defaults[r].has(d.perm);
                    const label = `${ROLE_LABEL[r]}: ${d.label}`;
                    return (
                      <td key={r} className={cls('border-b border-stone-100 px-2 py-2 text-center dark:border-stone-800', pending && 'bg-amber-50 dark:bg-amber-950/40')}>
                        {fixed ? (
                          <span
                            className="inline-flex items-center justify-center text-stone-400"
                            title={r === 'owner' ? 'Owners always have every permission.' : 'Only owners can do this.'}
                            aria-label={`${label}: ${on ? 'yes' : 'no'} (fixed)`}
                          >
                            {on ? <IconCheck size={16} className="text-emerald-600" /> : <IconLock size={14} />}
                          </span>
                        ) : (
                          <label className="relative inline-flex cursor-pointer items-center justify-center p-1" title={nonDefault ? 'Changed from the default for this role' : undefined}>
                            <input
                              type="checkbox"
                              aria-label={label}
                              className="h-4 w-4 cursor-pointer accent-amber-700 disabled:cursor-not-allowed"
                              checked={on}
                              disabled={!manage || saving}
                              onChange={(e) => set(r, d.perm, e.target.checked)}
                            />
                            {nonDefault && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />}
                          </label>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {draft && changes.length > 0 && (
        <div className="sticky bottom-20 z-30 mx-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-900 px-4 py-3 text-sm text-white shadow-xl dark:bg-stone-100 dark:text-stone-900">
          <span>
            {changes.length} unsaved change{changes.length === 1 ? '' : 's'} to the permissions.
            {changes.some((c) => c.role === myRole && !c.granted) && ' Some take things away from your own role.'}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="subtle" className="text-white hover:bg-white/10 dark:text-stone-900 dark:hover:bg-stone-900/10" onClick={() => setDraft(null)} disabled={saving}>Discard</Button>
            <Button size="sm" variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : `Save ${changes.length} change${changes.length === 1 ? '' : 's'}`}</Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs text-stone-500 dark:text-stone-400">
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> differs from the default</span>
        <span className="inline-flex items-center gap-1.5"><IconLock size={12} /> owner-only</span>
        <span>Ticking an “edit” box ticks the matching “see” box too.</span>
      </div>
    </Panel>
  );
}

function sameSet(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}
