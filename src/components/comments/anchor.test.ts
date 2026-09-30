// @vitest-environment jsdom
import { describe as suite, expect, it } from 'vitest';
import { computeAnchor, describe, pinTarget, resolveAnchor } from './anchor';

function page(html: string) {
  document.body.innerHTML = `<main id="root">${html}</main>`;
  return document.getElementById('root')!;
}

suite('comment anchors', () => {
  it('finds the same element again by its path', () => {
    const root = page('<section><h2>Venue</h2><p>Villa Cetinale</p></section><section><p>Lake Como</p></section>');
    const el = root.querySelectorAll('p')[1];
    const a = computeAnchor(el, root, 0, 0);
    expect(a.path).toEqual([1, 0]);
    expect(resolveAnchor(a, root)).toBe(el);
  });

  it('follows the text when the page has been reordered', () => {
    let root = page('<ul><li>Book photographer</li><li>Send invites</li></ul>');
    const a = computeAnchor(root.querySelectorAll('li')[1], root, 0, 0);
    root = page('<ul><li>Order cake</li><li>Book photographer</li><li>Send invites</li></ul>');
    expect(resolveAnchor(a, root)?.textContent).toBe('Send invites');
  });

  it('prefers a keyed ancestor, which survives any reshuffle', () => {
    let root = page('<table><tbody><tr data-comment-key="line-1"><td>Venue hire</td><td>€12,000</td></tr></tbody></table>');
    const target = pinTarget(root.querySelectorAll('td')[1], root)!;
    expect(target.tagName).toBe('TR');
    const a = computeAnchor(target, root, 0, 0);
    root = page('<div><table><tbody><tr><td>new</td></tr><tr data-comment-key="line-1"><td>Venue</td><td>€14,000</td></tr></tbody></table></div>');
    expect(resolveAnchor(a, root)?.getAttribute('data-comment-key')).toBe('line-1');
  });

  it('keeps the spot when only the words changed', () => {
    let root = page('<div><span>€12,000</span></div>');
    const a = computeAnchor(root.querySelector('span')!, root, 0, 0);
    root = page('<div><span>€14,500</span></div>');
    expect(resolveAnchor(a, root)?.textContent).toBe('€14,500');
  });

  it('gives up when the element is gone', () => {
    let root = page('<div><span>Old</span></div>');
    const a = computeAnchor(root.querySelector('span')!, root, 0, 0);
    root = page('<p>Different</p>');
    expect(resolveAnchor(a, root)).toBeNull();
  });

  it('describes what was clicked', () => {
    const root = page('<section><h2>Budget</h2><button aria-label="Add line"></button></section>');
    expect(describe(root.querySelector('button')!)).toBe('Add line');
    expect(describe(root.querySelector('section')!)).toBe('Budget');
    const table = page('<table><tbody><tr><td>Wedding cake<div>per guest</div></td><td>€650</td></tr></tbody></table>');
    expect(describe(table.querySelector('tr')!)).toBe('Wedding cakeper guest');
  });
});
