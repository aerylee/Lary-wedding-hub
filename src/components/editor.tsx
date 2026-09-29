// Editing is always a modal over a draft copy (main spec §8): Save commits, Cancel discards,
// Delete removes. A rejected write keeps the modal open so nothing typed is lost.
import { useCallback, useState, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { WRITE_PERM, type CollName, type Row } from '@/lib/types';
import { Button } from './kit';
import { whyNot } from './Gate';

export type Editor<T> = {
  draft: T | null;
  isNew: boolean;
  saving: boolean;
  readOnly: boolean;
  open: (row?: T) => void;
  close: () => void;
  set: <K extends keyof T>(k: K, v: T[K]) => void;
  patch: (p: Partial<T>) => void;
  save: (extra?: Partial<T>) => Promise<boolean>;
  del: (confirmText?: string) => Promise<void>;
};

export function useEditor<T extends { id?: string }>(coll: CollName, blank: () => T): Editor<T> {
  const { put, remove } = useStore();
  const { can } = useAuth();
  const [draft, setDraft] = useState<T | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const readOnly = !can(WRITE_PERM[coll]);

  const open = useCallback(
    (row?: T) => {
      setDraft(row ? structuredClone(row) : blank());
      setIsNew(!row);
    },
    [blank],
  );
  const close = useCallback(() => setDraft(null), []);
  const set = useCallback(<K extends keyof T>(k: K, v: T[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d)), []);
  const patch = useCallback((p: Partial<T>) => setDraft((d) => (d ? { ...d, ...p } : d)), []);

  const save = useCallback(
    async (extra?: Partial<T>) => {
      if (!draft) return false;
      setSaving(true);
      try {
        await put(coll, { ...draft, ...extra } as unknown as Row);
        setDraft(null);
        return true;
      } catch {
        return false; // the store rolled back and toasted; keep the modal open
      } finally {
        setSaving(false);
      }
    },
    [draft, put, coll],
  );

  const del = useCallback(
    async (confirmText = 'Delete this? This can’t be undone.') => {
      if (!draft?.id || isNew) return setDraft(null);
      if (!window.confirm(confirmText)) return;
      setSaving(true);
      try {
        await remove(coll, draft.id);
        setDraft(null);
      } catch {
        /* toasted; stay open */
      } finally {
        setSaving(false);
      }
    },
    [draft, isNew, remove, coll],
  );

  return { draft, isNew, saving, readOnly, open, close, set, patch, save, del };
}

export function EditorFooter<T extends { id?: string }>({ ed, coll, extra, saveLabel = 'Save', onSave }: { ed: Editor<T>; coll: CollName; extra?: ReactNode; saveLabel?: string; onSave?: () => void }) {
  const why = ed.readOnly ? whyNot(WRITE_PERM[coll]) : undefined;
  return (
    <>
      {!ed.isNew && (
        <Button variant="danger" className="mr-auto" disabled={ed.readOnly || ed.saving} title={why} onClick={() => ed.del()}>
          Delete
        </Button>
      )}
      {extra}
      <Button variant="subtle" onClick={ed.close}>
        {ed.readOnly ? 'Close' : 'Cancel'}
      </Button>
      <Button variant="primary" disabled={ed.readOnly || ed.saving} title={why} onClick={() => (onSave ? onSave() : ed.save())}>
        {ed.saving ? 'Saving…' : saveLabel}
      </Button>
    </>
  );
}
