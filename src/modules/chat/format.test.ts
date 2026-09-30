import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Formatted, hubLink, parseBlocks, plainText } from './format';

const people = [{ id: 'p1', name: 'Paola', email: 'p@x.test' }];
const html = (body: string, mentioned: string[] = []) =>
  renderToStaticMarkup(createElement(Formatted, { body, mentioned, people, origin: 'https://hub.test' }));

describe('message formatting', () => {
  it('handles inline marks', () => {
    expect(html('**bold** _it_ ~gone~ `x = 1`')).toBe(
      '<div class="space-y-1 break-words [overflow-wrap:anywhere]"><p><strong class="font-semibold">bold</strong> <em>it</em> <s>gone</s> <code class="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.85em] text-rose-700 dark:bg-stone-800 dark:text-rose-300">x = 1</code></p></div>',
    );
  });

  it('does not treat snake_case or code contents as formatting', () => {
    expect(html('file_name_here')).toContain('file_name_here');
    expect(html('`**not bold**`')).toContain('**not bold**');
  });

  it('never renders typed HTML', () => {
    expect(html('<img src=x onerror=alert(1)>')).toContain('&lt;img');
  });

  it('builds lists, quotes and code blocks', () => {
    expect(parseBlocks('- milk\n- eggs\n\n1. one\n2. two\n> said\n```\nconst a\n```')).toEqual([
      { type: 'ul', items: ['milk', 'eggs'] },
      { type: 'ol', items: ['one', 'two'], start: 1 },
      { type: 'quote', lines: ['said'] },
      { type: 'code', text: 'const a' },
    ]);
  });

  it('highlights only people who were actually mentioned', () => {
    expect(html('hi @Paola', ['p1'])).toContain('bg-sky-100');
    expect(html('hi @Paola', [])).not.toContain('bg-sky-100');
  });

  it('shows links to this hub as chips and other links as links', () => {
    expect(hubLink('https://hub.test/w/abc/budget?comment=1', 'https://hub.test')).toEqual({ page: 'budget', label: 'Budget', kind: 'comment' });
    expect(hubLink('https://hub.test/w/abc/chat?channel=1&message=2', 'https://hub.test')?.kind).toBe('message');
    expect(hubLink('https://evil.test/w/abc/budget', 'https://hub.test')).toBeNull();
    expect(html('see https://hub.test/w/abc/guests')).toContain('↗ Guests</a>');
    expect(html('see https://example.com/a.')).toContain('href="https://example.com/a"');
  });

  it('strips marks for previews', () => {
    expect(plainText('**Menu** tasting _Friday_\n- wine\n- cake')).toBe('Menu tasting Friday • wine • cake');
  });
});
