// Files and images in chat: thumbnails, file cards, a lightbox, and the grid used by the
// channel's Files tab and the all-files view. Every URL is a short-lived signed URL.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCollab, usePeople } from '@/lib/collab';
import type { ChatFile } from '@/lib/types';
import { cls, fmtBytes, timeAgo } from '@/lib/util';
import { IconButton } from '@/components/kit';
import { IconChevronLeft, IconChevronRight, IconDownload, IconFile, IconX } from '@/components/icons';

export const isImage = (f: Pick<ChatFile, 'mime'>) => f.mime.startsWith('image/');
export const isVideo = (f: Pick<ChatFile, 'mime'>) => f.mime.startsWith('video/');

export function useSignedUrl(path: string | null) {
  const { signedUrl } = useCollab();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!path) {
      setUrl(null);
      return;
    }
    signedUrl(path).then((u) => {
      if (live) setUrl(u);
    }, () => undefined);
    return () => {
      live = false;
    };
  }, [path, signedUrl]);
  return url;
}

function ext(name: string) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name);
  return m ? m[1].toUpperCase() : 'FILE';
}

export function Thumb({ file, onOpen, className }: { file: ChatFile; onOpen: () => void; className?: string }) {
  const url = useSignedUrl(file.storage_path);
  const ratio = file.width && file.height ? `${file.width} / ${file.height}` : '4 / 3';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cls('block overflow-hidden rounded-lg border border-stone-200 bg-stone-100 hover:opacity-90 dark:border-stone-700 dark:bg-stone-800', className)}
      style={{ aspectRatio: ratio }}
      aria-label={`Open ${file.name}`}
      title={file.name}
    >
      {url ? (
        isVideo(file) ? (
          <video src={url} className="h-full w-full object-cover" muted preload="metadata" />
        ) : (
          <img src={url} alt={file.name} className="h-full w-full object-cover" loading="lazy" />
        )
      ) : (
        <span className="block h-full w-full animate-pulse" />
      )}
    </button>
  );
}

export function FileCard({ file, compact }: { file: ChatFile; compact?: boolean }) {
  const url = useSignedUrl(file.storage_path);
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer noopener"
      className={cls(
        'flex max-w-sm items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-left hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800',
        !url && 'pointer-events-none opacity-70',
      )}
      title={`Open ${file.name}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
        {compact ? <IconFile size={16} /> : ext(file.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{file.name}</span>
        <span className="block text-xs text-stone-500">{fmtBytes(file.size)}</span>
      </span>
      <IconDownload size={15} className="shrink-0 text-stone-400" />
    </a>
  );
}

/** The files attached to one message: images as a grid, everything else as cards. */
export function MessageFiles({ files }: { files: ChatFile[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const media = files.filter((f) => isImage(f) || isVideo(f));
  const others = files.filter((f) => !isImage(f) && !isVideo(f));
  if (!files.length) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      {media.length > 0 && (
        <div className={cls('grid max-w-md gap-1.5', media.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
          {media.slice(0, 4).map((f, i) => (
            <div key={f.id} className="relative">
              <Thumb file={f} onOpen={() => setOpen(i)} className={media.length === 1 ? 'max-h-80 w-full max-w-xs' : 'w-full'} />
              {i === 3 && media.length > 4 && (
                <button onClick={() => setOpen(3)} className="absolute inset-0 flex items-center justify-center rounded-lg bg-stone-950/50 text-lg font-semibold text-white">
                  +{media.length - 4}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {others.map((f) => <FileCard key={f.id} file={f} />)}
      {open !== null && <Lightbox files={media} index={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function Lightbox({ files, index, onClose }: { files: ChatFile[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const file = files[i];
  const url = useSignedUrl(file?.storage_path ?? null);
  const people = usePeople();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(files.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [files.length, onClose]);
  if (!file) return null;
  return createPortal(
    <div role="dialog" aria-label={file.name} className="fixed inset-0 z-[70] flex flex-col bg-stone-950/90 text-white" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{file.name}</div>
          <div className="text-xs text-white/60">{people.name(file.uploaded_by)} · {timeAgo(file.created_at)} · {fmtBytes(file.size)}</div>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer noopener" className="rounded-lg p-2 hover:bg-white/10" aria-label="Open original">
            <IconDownload size={18} />
          </a>
        )}
        <IconButton label="Close" onClick={onClose} className="text-white hover:bg-white/10 hover:text-white"><IconX size={18} /></IconButton>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-12 pb-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {url ? (
          isVideo(file) ? (
            <video src={url} controls autoPlay className="max-h-full max-w-full rounded-lg" />
          ) : (
            <img src={url} alt={file.name} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          )
        ) : (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}
        {i > 0 && (
          <button className="absolute left-2 rounded-full bg-white/10 p-2 hover:bg-white/20" onClick={() => setI(i - 1)} aria-label="Previous">
            <IconChevronLeft size={22} />
          </button>
        )}
        {i < files.length - 1 && (
          <button className="absolute right-2 rounded-full bg-white/10 p-2 hover:bg-white/20" onClick={() => setI(i + 1)} aria-label="Next">
            <IconChevronRight size={22} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** A browsable collection of files: images as tiles, then documents. */
export function FileGallery({ files, empty, onJump, channelName }: {
  files: ChatFile[]; empty: string; onJump?: (f: ChatFile) => void; channelName?: (id: string) => string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const people = usePeople();
  const media = files.filter((f) => isImage(f) || isVideo(f));
  const docs = files.filter((f) => !isImage(f) && !isVideo(f));
  if (!files.length) return <p className="px-4 py-8 text-center text-sm text-stone-500">{empty}</p>;
  return (
    <div className="space-y-4 p-3">
      {media.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">Photos &amp; videos</div>
          <div className="grid grid-cols-3 gap-1.5">
            {media.map((f, i) => <Thumb key={f.id} file={{ ...f, width: 1, height: 1 }} onOpen={() => setOpen(i)} className="w-full" />)}
          </div>
        </div>
      )}
      {docs.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">Documents</div>
          <ul className="space-y-1.5">
            {docs.map((f) => (
              <li key={f.id}>
                <FileCard file={f} />
                <div className="mt-0.5 flex gap-2 pl-1 text-[11px] text-stone-400">
                  <span>{people.name(f.uploaded_by)} · {timeAgo(f.created_at)}{channelName && ` · #${channelName(f.channel_id)}`}</span>
                  {onJump && <button className="text-amber-700 hover:underline dark:text-amber-400" onClick={() => onJump(f)}>Show in chat</button>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {open !== null && <Lightbox files={media} index={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
