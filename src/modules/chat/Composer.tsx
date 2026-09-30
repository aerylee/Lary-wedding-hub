// Writing a message: formatting toolbar, @mentions, emoji, files (attach, drop or paste),
// a draft kept per conversation, and a "someone is typing" line.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { useCollab, usePeople, type PendingFile } from '@/lib/collab';
import { cls, fmtBytes } from '@/lib/util';
import { Button, IconButton } from '@/components/kit';
import { IconPaperclip, IconSend, IconX } from '@/components/icons';
import { MentionInput, extractMentions, type MentionInputHandle, type Person } from '@/components/MentionInput';
import { prefixLines, wrapSelection } from './format';
import { EmojiGrid, Menu, keys, local, typingText } from './shared';

const LIMIT = 4000;

type Upload = { id: string; file: File; status: 'uploading' | 'ready' | 'failed'; pending?: PendingFile; preview?: string };

export type ComposerHandle = { addFiles: (files: File[]) => void; focus: () => void };

type Props = {
  channelId: string;
  /** where the draft and typing notices belong: a channel id, or "thread:<id>" */
  where: string;
  placeholder: string;
  people: Person[];
  onSend: (body: string, mentions: string[], files: PendingFile[]) => Promise<void>;
  /** ↑ in an empty box edits your last message */
  onEditLast?: () => void;
  compact?: boolean;
};

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ channelId, where, placeholder, people, onSend, onEditLast, compact }, ref) {
  const { weddingId } = useStore();
  const { uploadFile, discardUpload, typing, notifyTyping } = useCollab();
  const everyone = usePeople();
  const draftKey = keys.draft(weddingId, where);
  const [text, setText] = useState(() => local.get(draftKey) ?? '');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [sending, setSending] = useState(false);
  const input = useRef<MentionInputHandle>(null);
  const picker = useRef<HTMLInputElement>(null);

  // the draft follows you around: switch channel and back, it's still there
  useEffect(() => {
    local.set(draftKey, text);
  }, [draftKey, text]);

  // previews are object URLs; let them go
  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;
  useEffect(() => {
    return () => {
      for (const u of uploadsRef.current) if (u.preview) URL.revokeObjectURL(u.preview);
    };
  }, []);

  const addFiles = (files: File[]) => {
    for (const file of files) {
      const id = crypto.randomUUID();
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      setUploads((l) => [...l, { id, file, status: 'uploading', preview }]);
      uploadFile(channelId, file).then(
        (pending) => setUploads((l) => l.map((u) => (u.id === id ? { ...u, status: 'ready', pending } : u))),
        () => setUploads((l) => l.map((u) => (u.id === id ? { ...u, status: 'failed' } : u))),
      );
    }
    input.current?.focus();
  };

  useImperativeHandle(ref, () => ({ addFiles, focus: () => input.current?.focus() }));

  const removeUpload = (u: Upload) => {
    setUploads((l) => l.filter((x) => x.id !== u.id));
    if (u.preview) URL.revokeObjectURL(u.preview);
    if (u.pending) discardUpload(u.pending.path).catch(() => undefined);
  };

  const busy = uploads.some((u) => u.status === 'uploading');
  const ready = uploads.filter((u) => u.status === 'ready' && u.pending).map((u) => u.pending!);
  const canSend = !sending && !busy && (text.trim().length > 0 || ready.length > 0) && text.length <= LIMIT;

  const send = async () => {
    if (!canSend) return;
    const body = text.trim();
    const sent = uploads;
    setSending(true);
    setText('');
    setUploads([]);
    try {
      await onSend(body, extractMentions(body, people), ready);
      for (const u of sent) if (u.preview) URL.revokeObjectURL(u.preview);
    } catch {
      setText(body);
      setUploads(sent);
    } finally {
      setSending(false);
      input.current?.focus();
    }
  };

  const el = () => input.current?.el() ?? null;
  const wrap = (a: string, b = a) => {
    const t = el();
    if (t) setText(wrapSelection(t, a, b));
  };
  const lines = (p: (i: number) => string) => {
    const t = el();
    if (t) setText(prefixLines(t, p));
  };
  const insert = (s: string) => {
    const t = el();
    if (!t) return setText((x) => x + s);
    const a = t.selectionStart;
    setText((x) => x.slice(0, a) + s + x.slice(t.selectionEnd));
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(a + s.length, a + s.length);
    });
  };
  const link = () => {
    const t = el();
    if (!t) return;
    const url = window.prompt('Link address', 'https://');
    if (!url || url === 'https://') return;
    const picked = t.value.slice(t.selectionStart, t.selectionEnd);
    insert(picked ? `${picked} (${url})` : url);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); wrap('**'); return true; }
    if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); wrap('_'); return true; }
    if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); wrap('`'); return true; }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'x') { e.preventDefault(); wrap('~'); return true; }
    if (e.key === 'ArrowUp' && !text && onEditLast) { e.preventDefault(); onEditLast(); return true; }
    return false;
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files];
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const who = (typing.get(where) ?? []).map((id) => everyone.name(id));
  const left = LIMIT - text.length;

  return (
    <div className={cls('shrink-0 border-t border-stone-200 dark:border-stone-800', compact ? 'p-2' : 'p-3')}>
      <div className="rounded-lg border border-stone-300 bg-white focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/30 dark:border-stone-700 dark:bg-stone-950">
        {uploads.length > 0 && (
          <ul className="flex flex-wrap gap-2 border-b border-stone-100 p-2 dark:border-stone-800" aria-label="Files to send">
            {uploads.map((u) => (
              <li key={u.id} className={cls('relative flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs', u.status === 'failed' ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40' : 'border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-900')}>
                {u.preview ? <img src={u.preview} alt="" className="h-9 w-9 rounded object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded bg-amber-100 text-[9px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{u.file.name.split('.').pop()?.slice(0, 4).toUpperCase()}</span>}
                <span className="min-w-0">
                  <span className="block max-w-[10rem] truncate font-medium">{u.file.name}</span>
                  <span className={cls('block', u.status === 'failed' ? 'text-rose-700 dark:text-rose-400' : 'text-stone-500')}>
                    {u.status === 'uploading' ? 'Uploading…' : u.status === 'failed' ? "Couldn't upload" : fmtBytes(u.file.size)}
                  </span>
                </span>
                {u.status === 'uploading' && <span className="absolute inset-x-2 bottom-0.5 h-0.5 overflow-hidden rounded bg-stone-200 dark:bg-stone-700"><span className="block h-full w-1/3 animate-[slide_1s_ease-in-out_infinite] bg-amber-600" /></span>}
                <IconButton label={`Remove ${u.file.name}`} className="h-6 w-6" onClick={() => removeUpload(u)}><IconX size={12} /></IconButton>
              </li>
            ))}
          </ul>
        )}
        <MentionInput
          ref={input}
          value={text}
          onChange={(v) => {
            setText(v);
            if (v.trim()) notifyTyping(where);
          }}
          people={people}
          onSubmit={send}
          enterSends
          rows={compact ? 1 : 2}
          placeholder={placeholder}
          onPaste={onPaste}
          onKeyDownExtra={onKey}
          bare
        />
        <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
          <Tool label="Bold (⌘B)" onClick={() => wrap('**')}><b>B</b></Tool>
          <Tool label="Italic (⌘I)" onClick={() => wrap('_')}><i className="font-serif">I</i></Tool>
          <Tool label="Strikethrough (⌘⇧X)" onClick={() => wrap('~')}><s>S</s></Tool>
          <Tool label="Code (⌘E)" onClick={() => wrap('`')}><span className="font-mono text-[11px]">{'</>'}</span></Tool>
          <Tool label="Bulleted list" onClick={() => lines(() => '- ')}><span className="text-base leading-none">•≡</span></Tool>
          <Tool label="Numbered list" onClick={() => lines((i) => `${i + 1}. `)}><span className="text-[11px]">1.</span></Tool>
          <Tool label="Quote" onClick={() => lines(() => '> ')}><span className="text-base leading-none">❝</span></Tool>
          <Tool label="Link" onClick={link}><span className="text-[13px]">🔗</span></Tool>
          <span className="mx-1 h-4 w-px bg-stone-200 dark:bg-stone-700" />
          <Menu label="Emoji" icon={<span className="text-[15px] leading-none">🙂</span>} buttonClass="h-7 w-7" width={296}>
            <EmojiGrid onPick={insert} />
          </Menu>
          <Tool label="Attach files" onClick={() => picker.current?.click()}><IconPaperclip size={15} /></Tool>
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addFiles([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
          <div className="ml-auto flex items-center gap-2">
            {left < 500 && <span className={cls('text-[11px] tabular-nums', left < 0 ? 'text-rose-600' : 'text-stone-400')}>{left}</span>}
            <Button size="sm" variant="primary" onClick={send} disabled={!canSend} aria-label="Send" title={busy ? 'Waiting for uploads…' : 'Send (Enter)'}>
              <IconSend size={14} />
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-1 flex h-4 items-center justify-between gap-2 text-[11px] text-stone-400">
        <span className="truncate italic text-stone-500" aria-live="polite">{typingText(who)}</span>
        {!compact && <span className="hidden shrink-0 sm:inline">Enter to send · Shift+Enter new line · ↑ edit last</span>}
      </div>
    </div>
  );
});

function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
    >
      {children}
    </button>
  );
}
