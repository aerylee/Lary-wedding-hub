// Pinning a comment to "anything on the screen" and finding that thing again later.
//
// An anchor prefers a stable key (an element marked data-comment-key, such as a task row
// keyed by its id). Otherwise it records the element's position in the page as a
// child-index path plus its text; if the page has moved around since, the text finds it.
import type { Anchor } from '@/lib/collab';

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const snippet = (el: Element) => norm(el.textContent).slice(0, 80);

/** The element a click should pin to: the target itself, or its keyed row if it has one. */
export function pinTarget(target: Element, root: Element): Element | null {
  let el: Element | null = target;
  // SVG icons are too small and too alike to find again; pin to their owner
  while (el && el !== root && el.namespaceURI === 'http://www.w3.org/2000/svg') el = el.parentElement;
  if (!el || !root.contains(el) || el === root) return null;
  const keyed = el.closest('[data-comment-key]');
  return keyed && root.contains(keyed) ? keyed : el;
}

export function computeAnchor(el: Element, root: Element, clientX: number, clientY: number): Anchor {
  const rect = el.getBoundingClientRect();
  const x = rect.width ? clamp01((clientX - rect.left) / rect.width) : 0.5;
  const y = rect.height ? clamp01((clientY - rect.top) / rect.height) : 0.5;
  const key = el.getAttribute('data-comment-key') ?? undefined;
  const path: number[] = [];
  for (let n: Element | null = el; n && n !== root; n = n.parentElement) {
    const parent: Element | null = n.parentElement;
    if (!parent) break;
    path.unshift(Array.prototype.indexOf.call(parent.children, n));
  }
  return { key, path, tag: el.tagName.toLowerCase(), text: snippet(el), x: round(x), y: round(y) };
}

export function resolveAnchor(a: Anchor, root: Element): Element | null {
  if (a.key) {
    const byKey = root.querySelector(`[data-comment-key="${cssEscape(a.key)}"]`);
    if (byKey) return byKey;
  }
  let el: Element | null = root;
  for (const i of a.path ?? []) {
    el = el?.children[i] ?? null;
    if (!el) break;
  }
  const sameTag = (e: Element | null) => !!e && (!a.tag || e.tagName.toLowerCase() === a.tag);
  if (el && el !== root && sameTag(el) && (!a.text || snippet(el) === a.text)) return el;

  // the page changed shape: look for the same text in the same kind of element
  if (a.text) {
    const candidates = Array.from(root.querySelectorAll(a.tag || '*'));
    const exact = candidates.find((c) => snippet(c) === a.text);
    if (exact) return exact;
  }
  // same place, different words (a figure that was edited) is still the right spot
  return el && el !== root && sameTag(el) ? el : null;
}

/** A few words saying what was commented on, for lists and notifications. */
export function describe(el: Element): string {
  // a table row is best named by its first cell ("Wedding cake"), not all its figures
  const first = el.tagName === 'TR' ? el.querySelector('td, th') : null;
  const text = (e: Element) => norm((e as HTMLElement).innerText ?? e.textContent).slice(0, 80);
  const own = norm(el.getAttribute('aria-label')) || text(first ?? el) || norm(el.getAttribute('title'));
  if (own) return own.length > 70 ? `${own.slice(0, 69)}…` : own;
  const section = el.closest('section, [role="dialog"], li, tr');
  const heading = section?.querySelector('h1, h2, h3, th');
  return heading ? `Near “${snippet(heading)}”` : 'This spot';
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
function round(n: number) {
  return Math.round(n * 1000) / 1000;
}
function cssEscape(s: string) {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
}
