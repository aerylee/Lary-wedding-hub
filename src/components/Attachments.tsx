// File attachments on a vendor-log entry (main spec §11). Private bucket, signed URLs with a
// short expiry, 20 MB cap and MIME check. Without files:write you see the list, no uploader.
import { useState, type DragEvent } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type { Attachment } from '@/lib/types';
import { cls, fmtBytes, sortBy } from '@/lib/util';
import { IconButton, Pill } from './kit';
import { IconExternal, IconPaperclip, IconTrash } from './icons';

function badge(a: Attachment): string {
  const ext = a.name.split('.').pop()?.toUpperCase() ?? '';
  return ext.length <= 5 ? ext : a.mime.split('/').pop()?.toUpperCase() ?? 'FILE';
}

export function Attachments({ correspondenceId, saved }: { correspondenceId: string; saved: boolean }) {
  const { get, files } = useStore();
  const { can } = useAuth();
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  if (!can('files:read')) return null;
  const list = sortBy(get('attachments').filter((a) => a.correspondence_id === correspondenceId), (a) => a.created_at);
  const w = can('files:write');

  async function upload(fs: FileList | File[]) {
    for (const f of Array.from(fs)) {
      setBusy((n) => n + 1);
      try {
        await files.upload(correspondenceId, f);
      } catch {
        /* toasted */
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }

  async function open(a: Attachment) {
    // open the tab synchronously so pop-up blockers allow it, then point it at the signed URL
    const tab = window.open('about:blank', '_blank');
    try {
      const url = await files.signedUrl(a);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch {
      tab?.close();
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
        <IconPaperclip size={12} /> Attachments {list.length > 0 && `(${list.length})`}
      </div>
      {list.length > 0 && (
        <ul className="mb-2 divide-y divide-stone-100 rounded-lg border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
          {list.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <Pill tone="muted" className="w-12 justify-center">{badge(a)}</Pill>
              <span className="min-w-0 flex-1 truncate" title={a.name}>{a.name}</span>
              <span className="text-xs text-stone-500">{fmtBytes(Number(a.size))}</span>
              <IconButton label={`Open ${a.name}`} onClick={() => open(a)}><IconExternal /></IconButton>
              {w && <IconButton label={`Remove ${a.name}`} onClick={() => window.confirm(`Remove ${a.name}?`) && files.remove(a).catch(() => undefined)}><IconTrash /></IconButton>}
            </li>
          ))}
        </ul>
      )}
      {w &&
        (saved ? (
          <label
            onDragOver={(e: DragEvent) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e: DragEvent) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}
            className={cls('flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-3 py-4 text-center text-xs text-stone-500', over ? 'border-amber-500 bg-amber-50 dark:bg-amber-950' : 'border-stone-300 dark:border-stone-700')}
          >
            <input type="file" multiple className="sr-only" onChange={(e) => e.target.files && upload(e.target.files)} />
            {busy ? `Uploading ${busy} file${busy === 1 ? '' : 's'}…` : 'Drop quotes, contracts or saved emails here, or click to browse. 20 MB max each.'}
          </label>
        ) : (
          <p className="text-xs text-stone-500">Save the entry first, then attach files to it.</p>
        ))}
      {!w && list.length === 0 && <p className="text-xs text-stone-400">No files.</p>}
    </div>
  );
}
