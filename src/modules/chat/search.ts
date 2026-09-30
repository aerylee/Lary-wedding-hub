// Searching the chat: messages, file names and channel notes. Everything is already in
// memory, so this is a plain filter; words can appear in any order.
import type { ChatChannel, ChatFile, ChatMessage, ChatNote } from '@/lib/types';
import { plainText } from './format';

export type SearchHit =
  | { kind: 'message'; message: ChatMessage; text: string }
  | { kind: 'file'; file: ChatFile }
  | { kind: 'note'; note: ChatNote; text: string };

export function terms(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

const hasAll = (hay: string, words: string[]) => {
  const h = hay.toLowerCase();
  return words.every((w) => h.includes(w));
};

/** Messages newest first; files and notes after. Archived channels are included. */
export function searchChat(
  q: string,
  data: { messages: ChatMessage[]; files: ChatFile[]; notes: ChatNote[]; channels: ChatChannel[] },
  limit = 100,
): SearchHit[] {
  const words = terms(q);
  if (!words.length) return [];
  const known = new Set(data.channels.map((c) => c.id));
  const messages: SearchHit[] = data.messages
    .filter((m) => known.has(m.channel_id))
    .map((m) => ({ m, text: plainText(m.body) }))
    .filter(({ text }) => hasAll(text, words))
    .sort((a, b) => b.m.created_at.localeCompare(a.m.created_at))
    .slice(0, limit)
    .map(({ m, text }) => ({ kind: 'message', message: m, text }));
  const files: SearchHit[] = data.files.filter((f) => hasAll(f.name, words)).slice(0, 30).map((file) => ({ kind: 'file', file }));
  const notes: SearchHit[] = data.notes
    .map((note) => ({ note, text: plainText(note.body) }))
    .filter(({ text }) => hasAll(text, words))
    .map(({ note, text }) => ({ kind: 'note', note, text }));
  return [...messages, ...files, ...notes];
}

/** A window of text around the first match, so long messages still show why they matched. */
export function excerpt(text: string, q: string, width = 160): string {
  const words = terms(q);
  const lower = text.toLowerCase();
  const at = Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0), Infinity);
  if (!Number.isFinite(at) || text.length <= width) return text.slice(0, width);
  const start = Math.max(0, at - Math.floor(width / 3));
  return `${start > 0 ? '…' : ''}${text.slice(start, start + width)}${start + width < text.length ? '…' : ''}`;
}

/** Split text into plain and matching parts, for highlighting. */
export function highlight(text: string, q: string): { text: string; hit: boolean }[] {
  const words = terms(q).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return [{ text, hit: false }];
  const whole = words.map((w) => new RegExp(`^${w}$`, 'i'));
  return text
    .split(new RegExp(`(${words.join('|')})`, 'gi'))
    .filter(Boolean)
    .map((t) => ({ text: t, hit: whole.some((re) => re.test(t)) }));
}
