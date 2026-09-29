// Team management (main spec §7.14). Owner-only route, not a tab.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth, ROLE_BLURB, ROLE_LABEL } from '@/lib/auth';
import { useStore, type Member } from '@/lib/store';
import type { AppRole, Invitation } from '@/lib/types';
import { fmtDate, timeAgo } from '@/lib/util';
import { Button, Empty, Field, Input, Modal, Panel, PanelHead, Pill, Select, SectionTitle, TD, TH, TWrap } from '@/components/kit';
import { IconCopy, IconUsers } from '@/components/icons';
import { useToast } from '@/components/toast';

const ROLES: AppRole[] = ['owner', 'planner', 'collaborator', 'viewer'];

const LOSES: Record<AppRole, string> = {
  owner: 'the whole hub — every module, the budget, the team page',
  planner: 'every module, including the budget and payments',
  collaborator: 'the guest list, seating, comms, run of show, travel and the rest of the plan',
  viewer: 'read-only access to the plan',
};

export function Team() {
  const { members, team } = useStore();
  const { session } = useAuth();
  const toast = useToast();
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('collaborator');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  const reloadInvites = useCallback(() => team.invitations().then(setInvites), [team]);
  useEffect(() => {
    reloadInvites();
  }, [reloadInvites]);

  const activeOwners = members.filter((m) => m.role === 'owner' && m.status === 'active');
  const isLastOwner = (m: Member) => m.role === 'owner' && activeOwners.length <= 1;

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast('Invitation link copied', 'ok');
    } catch {
      window.prompt('Copy the invitation link:', link);
    }
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await team.invite(email.trim(), role);
      setEmail('');
      await reloadInvites();
      if (!r.link) toast(`${email.trim()} already had an account — they're on the team now.`, 'ok');
      else if (r.emailed) toast(`Invitation emailed to ${email.trim()}`, 'ok');
      else {
        toast('Invitation created, but the email could not be sent — copy the link and send it yourself.', 'info');
        copy(r.link);
      }
    } catch {
      /* toasted */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SectionTitle sub="Everyone signs in with an email link. Roles decide what they can see and change — money and guest contact details are the sensitive parts.">
        Team
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead title="Members" sub={`${members.length} ${members.length === 1 ? 'person' : 'people'}`} />
          <TWrap>
            <thead>
              <tr>
                <TH>Person</TH>
                <TH>Role</TH>
                <TH>Last active</TH>
                <TH />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const last = isLastOwner(m);
                const me = m.user_id === session?.user.id;
                return (
                  <tr key={m.id}>
                    <TD>
                      <div className="font-medium">{m.profile?.full_name || m.profile?.email || 'Unknown'} {me && <Pill tone="muted">you</Pill>}</div>
                      <div className="text-xs text-stone-500">{m.profile?.email}</div>
                    </TD>
                    <TD>
                      <span title={last ? 'A wedding must keep at least one owner. Make someone else an owner first.' : undefined}>
                        <Select
                          aria-label={`Role for ${m.profile?.email}`}
                          value={m.role}
                          disabled={last}
                          className="h-8 w-40 py-1"
                          onChange={(e) => team.setRole(m.id, e.target.value as AppRole).catch(() => undefined)}
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </Select>
                      </span>
                    </TD>
                    <TD className="text-stone-500">{m.profile?.last_seen_at ? timeAgo(m.profile.last_seen_at) : 'never'}</TD>
                    <TD align="right">
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={last}
                        title={last ? 'The last owner can’t be removed.' : undefined}
                        onClick={() => setRemoving(m)}
                      >
                        {me ? 'Leave' : 'Remove'}
                      </Button>
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </TWrap>
        </Panel>

        <Panel>
          <PanelHead title="Invite someone" />
          <form onSubmit={invite} className="space-y-3 p-4">
            <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aunt.jo@example.com" /></Field>
            <Field label="Role" hint={ROLE_BLURB[role]}>
              <Select value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </Select>
            </Field>
            <Button type="submit" variant="primary" className="w-full" disabled={busy || !email.includes('@')}>{busy ? 'Inviting…' : 'Send invitation'}</Button>
            <p className="text-xs text-stone-500">Invitations expire after 14 days. Re-inviting the same address replaces the old one.</p>
          </form>
        </Panel>
      </div>

      <Panel className="mt-5">
        <PanelHead title="Pending invitations" />
        {invites.length === 0 ? (
          <Empty icon={<IconUsers size={24} />} title="No pending invitations" body="Everyone you've invited has joined." />
        ) : (
          <TWrap>
            <thead>
              <tr><TH>Email</TH><TH>Role</TH><TH>Expires</TH><TH /></tr>
            </thead>
            <tbody>
              {invites.map((i) => {
                const expired = new Date(i.expires_at) < new Date();
                return (
                  <tr key={i.id}>
                    <TD>{i.email}</TD>
                    <TD>{ROLE_LABEL[i.role]}</TD>
                    <TD>{expired ? <Pill tone="bad">expired</Pill> : fmtDate(i.expires_at.slice(0, 10))}</TD>
                    <TD align="right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="subtle" onClick={() => copy(`${window.location.origin}/join?token=${i.token}`)}><IconCopy size={14} /> Link</Button>
                        <Button size="sm" onClick={async () => {
                          try {
                            const r = await team.resend(i.id);
                            await reloadInvites();
                            toast(r.emailed ? `Sent again to ${i.email}` : 'Renewed — the email could not be sent, so copy the link.', r.emailed ? 'ok' : 'info');
                          } catch { /* toasted */ }
                        }}>Resend</Button>
                        <Button size="sm" variant="danger" onClick={async () => {
                          try { await team.revoke(i.id); await reloadInvites(); } catch { /* toasted */ }
                        }}>Revoke</Button>
                      </div>
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </TWrap>
        )}
      </Panel>

      <Modal
        open={!!removing}
        title={removing?.user_id === session?.user.id ? 'Leave this wedding?' : 'Remove from the team?'}
        onClose={() => setRemoving(null)}
        footer={
          <>
            <Button variant="subtle" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="danger" onClick={async () => {
              try { await team.removeMember(removing!.id); setRemoving(null); } catch { /* toasted */ }
            }}>Remove</Button>
          </>
        }
      >
        {removing && (
          <p className="text-sm">
            <strong>{removing.profile?.full_name || removing.profile?.email}</strong> will lose access to {LOSES[removing.role]}, immediately — even on a device where
            they&rsquo;re already signed in. Their past changes stay in the activity feed. You can invite them again later.
          </p>
        )}
      </Modal>
    </div>
  );
}
