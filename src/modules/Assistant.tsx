// The assistant panel (main spec §9.1): floats over every tab for assistant:use. Streams the
// answer, shows what it's reading, and renders staged changes as a before/after diff with
// Apply, Discard and Apply all. Applying goes through the store, so RLS checks it.
import { useRef, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { COLL_LABEL, WRITE_PERM, type CollName } from '@/lib/types';
import { cls } from '@/lib/util';
import { Button, IconButton } from '@/components/kit';
import { whyNot } from '@/components/Gate';
import { IconCheck, IconSend, IconSparkles, IconStop, IconX } from '@/components/icons';

type Proposal = {
  id: string;
  collection: CollName;
  action: 'insert' | 'update' | 'delete';
  rowId: string | null;
  fields: Record<string, unknown>;
  before: Record<string, unknown> | null;
  reason: string;
};
type Turn = { role: 'user' | 'assistant'; content: string; activity?: string[]; error?: string };

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v));

export default function Assistant() {
  const { weddingId, get, put, remove } = useStore();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const canApply = can('assistant:apply');

  const patchLast = (f: (t: Turn) => Turn) => setTurns((ts) => [...ts.slice(0, -1), f(ts[ts.length - 1])]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const history = [...turns.filter((t) => t.content), { role: 'user' as const, content: text }];
    setTurns([...history, { role: 'assistant', content: '', activity: [] }]);
    setInput('');
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token ?? ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ wedding_id: weddingId, messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `The assistant is unavailable (${res.status}).` }));
        patchLast((t) => ({ ...t, error: err.error }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop() ?? '';
        for (const ev of events) {
          const line = ev.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const msg = JSON.parse(line.slice(6));
          if (msg.type === 'text') patchLast((t) => ({ ...t, content: t.content + msg.text }));
          else if (msg.type === 'activity') patchLast((t) => ({ ...t, activity: [...(t.activity ?? []), msg.text] }));
          else if (msg.type === 'proposal') setProposals((p) => [...p, msg.proposal]);
          else if (msg.type === 'error') patchLast((t) => ({ ...t, error: msg.message }));
        }
        bottom.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') patchLast((t) => ({ ...t, error: 'Lost the connection to the assistant.' }));
      else patchLast((t) => ({ ...t, content: t.content + (t.content ? ' …' : ''), error: 'Stopped.' }));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  async function apply(p: Proposal): Promise<boolean> {
    try {
      if (p.action === 'delete' && p.rowId) await remove(p.collection, p.rowId);
      else if (p.action === 'update' && p.rowId) {
        const current = (get(p.collection) as unknown as { id: string }[]).find((r) => r.id === p.rowId);
        if (!current) throw new Error('gone');
        await put(p.collection, { ...current, ...p.fields });
      } else await put(p.collection, { ...p.fields });
      setProposals((ps) => ps.filter((x) => x.id !== p.id));
      return true;
    } catch {
      return false; // the store toasted why; the proposal stays for another look
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-amber-700 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-amber-800"
        >
          <IconSparkles size={16} /> Ask the hub
          {proposals.length > 0 && <span className="rounded-full bg-white px-1.5 text-xs text-amber-800">{proposals.length}</span>}
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="Assistant" className="fixed inset-x-0 bottom-0 z-40 flex h-[80vh] flex-col border-t border-stone-200 bg-white shadow-2xl dark:border-stone-800 dark:bg-stone-900 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[36rem] sm:w-[26rem] sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5 dark:border-stone-800">
            <div className="flex items-center gap-2 font-serif text-lg font-semibold"><IconSparkles size={16} className="text-amber-700" /> Assistant</div>
            <IconButton label="Close assistant" onClick={() => setOpen(false)}><IconX /></IconButton>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {turns.length === 0 && (
              <div className="text-stone-500">
                <p>Ask about the plan, or ask for changes — they&rsquo;re staged for you to review before anything is saved.</p>
                <ul className="mt-2 space-y-1">
                  {['What’s overdue, and what should I do first?', 'Which legal documents do we need for Italy?', 'Add a task to book the hair trial 5 months out'].map((s) => (
                    <li key={s}><button className="text-left text-amber-800 hover:underline dark:text-amber-400" onClick={() => setInput(s)}>{s}</button></li>
                  ))}
                </ul>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={cls(t.role === 'user' ? 'ml-8 rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950/40' : '')}>
                {t.activity && t.activity.length > 0 && (
                  <ul className="mb-1 space-y-0.5 text-xs text-stone-400">{t.activity.map((a, j) => <li key={j}>· {a}</li>)}</ul>
                )}
                <div className="whitespace-pre-wrap">{t.content || (t.role === 'assistant' && busy && i === turns.length - 1 ? '…' : '')}</div>
                {t.error && <div className="mt-1 text-xs text-rose-700 dark:text-rose-400">{t.error}</div>}
              </div>
            ))}

            {proposals.length > 0 && (
              <div className="space-y-2 rounded-xl border border-amber-200 p-2 dark:border-amber-900">
                <div className="flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Staged changes ({proposals.length})
                  <div className="flex gap-1">
                    <Button size="sm" variant="subtle" onClick={() => setProposals([])}>Discard all</Button>
                    <Button size="sm" variant="primary" disabled={!canApply} title={!canApply ? whyNot('assistant:apply') : undefined} onClick={async () => { for (const p of proposals) if (!(await apply(p))) break; }}>
                      Apply all
                    </Button>
                  </div>
                </div>
                {proposals.map((p) => (
                  <div key={p.id} className="rounded-lg bg-stone-50 p-2 dark:bg-stone-950">
                    <div className="text-xs font-medium">
                      {p.action === 'insert' ? 'Add to' : p.action === 'update' ? 'Change in' : 'Delete from'} {COLL_LABEL[p.collection] ?? p.collection}
                    </div>
                    <div className="text-xs text-stone-500">{p.reason}</div>
                    <table className="mt-1 w-full text-xs">
                      <tbody>
                        {p.action === 'delete' && p.before
                          ? Object.entries(p.before).slice(0, 5).map(([k, v]) => (
                              <tr key={k}><td className="pr-2 text-stone-500">{k}</td><td className="text-rose-700 line-through dark:text-rose-400">{show(v)}</td></tr>
                            ))
                          : Object.entries(p.fields).map(([k, v]) => (
                              <tr key={k}>
                                <td className="pr-2 align-top text-stone-500">{k}</td>
                                <td>
                                  {p.before && <span className="text-rose-700 line-through dark:text-rose-400">{show(p.before[k])}</span>}
                                  {p.before && ' → '}
                                  <span className="text-emerald-700 dark:text-emerald-400">{show(v)}</span>
                                </td>
                              </tr>
                            ))}
                      </tbody>
                    </table>
                    <div className="mt-1.5 flex justify-end gap-1">
                      <Button size="sm" variant="subtle" onClick={() => setProposals((ps) => ps.filter((x) => x.id !== p.id))}>Discard</Button>
                      <Button
                        size="sm"
                        disabled={!canApply || !can(WRITE_PERM[p.collection])}
                        title={!canApply ? whyNot('assistant:apply') : !can(WRITE_PERM[p.collection]) ? whyNot(WRITE_PERM[p.collection]) : undefined}
                        onClick={() => apply(p)}
                      >
                        <IconCheck size={12} /> Apply
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div ref={bottom} />
          </div>

          <form onSubmit={send} className="flex items-end gap-2 border-t border-stone-100 p-3 dark:border-stone-800">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about the plan…"
              className="flex-1 resize-none rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none dark:border-stone-700 dark:bg-stone-950"
            />
            {busy ? (
              <IconButton label="Stop" onClick={() => abort.current?.abort()}><IconStop /></IconButton>
            ) : (
              <IconButton label="Send" type="submit" disabled={!input.trim()}><IconSend /></IconButton>
            )}
          </form>
        </div>
      )}
    </>
  );
}
