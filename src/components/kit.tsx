// A small hand-rolled component kit (main spec §12).
import {
  forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { cls } from '@/lib/util';
import { IconX } from './icons';

export type Tone = 'default' | 'good' | 'warn' | 'bad' | 'info' | 'muted';

const TONE_TEXT: Record<Tone, string> = {
  default: 'text-stone-900 dark:text-stone-100',
  good: 'text-emerald-700 dark:text-emerald-400',
  warn: 'text-amber-700 dark:text-amber-400',
  bad: 'text-rose-700 dark:text-rose-400',
  info: 'text-sky-700 dark:text-sky-400',
  muted: 'text-stone-500 dark:text-stone-400',
};

const TONE_PILL: Record<Tone, string> = {
  default: 'bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700',
  good: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
  bad: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900',
  info: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900',
  muted: 'bg-transparent text-stone-500 ring-stone-200 dark:text-stone-400 dark:ring-stone-700',
};

// ─── layout ──────────────────────────────────────────────────────────────────
export function Panel({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cls('rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900', className)}>
      {children}
    </section>
  );
}

export function PanelHead({ title, sub, actions, className }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cls('flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-4 py-3 dark:border-stone-800', className)}>
      <div className="min-w-0">
        <h2 className="font-serif text-xl font-semibold leading-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, sub, actions }: { children: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{children}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-stone-500 dark:text-stone-400">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone = 'default' }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">{label}</div>
      <div className={cls('mt-1 text-2xl font-semibold tabular-nums', TONE_TEXT[tone])}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{sub}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export function Pill({ children, tone = 'default', className, title }: { children: ReactNode; tone?: Tone; className?: string; title?: string }) {
  return (
    <span title={title} className={cls('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONE_PILL[tone], className)}>
      {children}
    </span>
  );
}

export function Banner({ tone = 'info', children, action }: { tone?: Tone; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={cls('mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset', TONE_PILL[tone])}>
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

// ─── buttons ─────────────────────────────────────────────────────────────────
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'outline' | 'primary' | 'subtle' | 'danger';
  size?: 'sm' | 'md';
};

const BTN: Record<NonNullable<ButtonProps['variant']>, string> = {
  outline: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800',
  primary: 'bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500',
  subtle: 'text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800',
  danger: 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:bg-stone-900 dark:text-rose-400 dark:hover:bg-rose-950',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'outline', size = 'md', className, title, disabled, type, ...rest }, ref) {
  const btn = (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled}
      title={title}
      className={cls(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        BTN[variant],
        className,
      )}
      {...rest}
    />
  );
  // disabled buttons swallow hover events in some browsers; the wrapper keeps the tooltip
  return disabled && title ? <span title={title} className="inline-flex">{btn}</span> : btn;
});

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  const btn = (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cls(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
  return rest.disabled ? <span title={label} className="inline-flex">{btn}</span> : btn;
}

// ─── form fields ─────────────────────────────────────────────────────────────
const INPUT =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:bg-stone-50 disabled:text-stone-500 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:disabled:bg-stone-900';

export function Field({ label, hint, children, className, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cls('block', className)}>
      <span className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cls(INPUT, className)} {...rest} />;
});

export const Area = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Area({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cls(INPUT, 'resize-y', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cls(INPUT, 'pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

/** A currency-prefixed numeric input. `value` null ⇄ empty field. */
export function Money({
  value, onChange, currency = 'EUR', disabled, placeholder, id,
}: { value: number | null | undefined; onChange: (v: number | null) => void; currency?: 'EUR' | 'USD'; disabled?: boolean; placeholder?: string; id?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-400">{currency === 'EUR' ? '€' : '$'}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step="any"
        disabled={disabled}
        placeholder={placeholder}
        className={cls(INPUT, 'pl-7 tabular-nums')}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </div>
  );
}

export function NumberInput({ value, onChange, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      {...rest}
    />
  );
}

export function Check({ checked, onChange, label, disabled, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean; hint?: ReactNode }) {
  return (
    <label className={cls('flex items-start gap-2 text-sm', disabled && 'opacity-60')}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-stone-300 text-amber-700 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-900"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-stone-500 dark:text-stone-400">{hint}</span>}
      </span>
    </label>
  );
}

// ─── segmented & bars ────────────────────────────────────────────────────────
export function Segmented<T extends string>({
  options, value, onChange, className, size = 'md',
}: { options: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div role="tablist" className={cls('inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-stone-100 p-1 dark:bg-stone-800', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cls(
            'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === o.value
              ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-950 dark:text-stone-100'
              : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="rounded bg-stone-200/70 px-1.5 text-[11px] tabular-nums dark:bg-stone-700">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Bar({ value, tone = 'default', className, label }: { value: number; tone?: Tone; className?: string; label?: string }) {
  const color = { default: 'bg-amber-600', good: 'bg-emerald-600', warn: 'bg-amber-500', bad: 'bg-rose-600', info: 'bg-sky-600', muted: 'bg-stone-400' }[tone];
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={cls('h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800', className)}
    >
      <div className={cls('h-full rounded-full transition-all', color)} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

// ─── modal ───────────────────────────────────────────────────────────────────
export function Modal({
  open, title, onClose, children, footer, wide,
}: { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])');
    first?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cls(
          'flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl dark:bg-stone-900 sm:rounded-2xl',
          wide ? 'sm:max-w-4xl' : 'sm:max-w-xl',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-3 dark:border-stone-800">
          <h2 id={titleId} className="font-serif text-xl font-semibold">{title}</h2>
          <IconButton label="Close" data-close onClick={onClose}>
            <IconX />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 px-5 py-3 dark:border-stone-800">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ title, body, action, icon }: { title: ReactNode; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-stone-400">{icon}</div>}
      <div className="font-serif text-lg font-semibold">{title}</div>
      {body && <p className="mt-1 max-w-md text-sm text-stone-500 dark:text-stone-400">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── tables ──────────────────────────────────────────────────────────────────
export function TWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cls('overflow-x-auto', className)}>
      <table className="w-full min-w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function TH({ children, className, align }: { children?: ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      scope="col"
      className={cls(
        'whitespace-nowrap border-b border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-400',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({ children, className, align, colSpan, onClick }: { children?: ReactNode; className?: string; align?: 'left' | 'right' | 'center'; colSpan?: number; onClick?: () => void }) {
  return (
    <td
      colSpan={colSpan}
      onClick={onClick}
      className={cls(
        'border-b border-stone-100 px-3 py-2 align-top dark:border-stone-800',
        align === 'right' ? 'text-right tabular-nums' : align === 'center' ? 'text-center' : '',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function TR({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' ? onClick() : undefined) : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cls(onClick && 'cursor-pointer hover:bg-amber-50/60 focus:bg-amber-50 focus:outline-none dark:hover:bg-stone-800/60 dark:focus:bg-stone-800', className)}
    >
      {children}
    </tr>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-full py-1.5 sm:w-56" aria-label={placeholder} />
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-stone-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-amber-600" />
      {label}
    </div>
  );
}
