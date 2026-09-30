import { describe, expect, it } from 'vitest';
import type { ChatChannel, ChatFile, ChatMessage, ChatNote, ChatReaction } from '@/lib/types';
import { excerpt, highlight, searchChat } from './search';
import { groupReactions, typingText } from './shared';

const ch = { id: 'c1' } as ChatChannel;
const msg = (id: string, body: string, at: string) => ({ id, body, channel_id: 'c1', created_at: at } as ChatMessage);

describe('chat search', () => {
  const data = {
    channels: [ch],
    messages: [msg('a', '**Menu** tasting on Friday', '2027-01-01T10:00:00Z'), msg('b', 'Friday menu is final', '2027-01-02T10:00:00Z'), msg('c', 'hello', '2027-01-03T10:00:00Z')],
    files: [{ id: 'f', name: 'Menu-v3.pdf' } as ChatFile],
    notes: [{ channel_id: 'c1', body: 'Door code 1234, menu in the folder' } as ChatNote],
  };
  it('matches every word in any order, newest messages first, then files and notes', () => {
    const hits = searchChat('friday MENU', data);
    expect(hits.map((h) => (h.kind === 'message' ? h.message.id : h.kind))).toEqual(['b', 'a']);
    expect(searchChat('menu', data).map((h) => h.kind)).toEqual(['message', 'message', 'file', 'note']);
    expect(searchChat('   ', data)).toEqual([]);
  });
  it('ignores formatting marks when matching', () => {
    expect(searchChat('menu tasting', data)).toHaveLength(1);
  });
  it('shows the part of a long message that matched', () => {
    const long = `${'x '.repeat(200)}the florist called ${'y '.repeat(200)}`;
    expect(excerpt(long, 'florist')).toContain('the florist called');
    expect(excerpt(long, 'florist').startsWith('…')).toBe(true);
  });
  it('highlights matches', () => {
    expect(highlight('Menu on Friday', 'friday')).toEqual([{ text: 'Menu on ', hit: false }, { text: 'Friday', hit: true }]);
  });
});

describe('reactions and typing', () => {
  it('groups reactions by emoji and marks yours', () => {
    const rows = [
      { message_id: 'm', user_id: 'me', emoji: '🎉', created_at: '1' },
      { message_id: 'm', user_id: 'jo', emoji: '👍', created_at: '2' },
      { message_id: 'm', user_id: 'jo', emoji: '🎉', created_at: '3' },
    ] as ChatReaction[];
    expect(groupReactions(rows, 'me', () => 'Jo')).toEqual([
      { emoji: '🎉', count: 2, mine: true, who: ['You', 'Jo'] },
      { emoji: '👍', count: 1, mine: false, who: ['Jo'] },
    ]);
  });
  it('says who is typing', () => {
    expect(typingText([])).toBe('');
    expect(typingText(['Paola'])).toBe('Paola is typing…');
    expect(typingText(['Paola', 'Jo'])).toBe('Paola and Jo are typing…');
    expect(typingText(['a', 'b', 'c'])).toBe('Several people are typing…');
  });
});
