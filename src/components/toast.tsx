import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { cls } from '@/lib/util';

type Toast = { id: number; text: string; tone: 'error' | 'ok' | 'info' };
type ToastFn = (text: string, tone?: Toast['tone']) => void;

const ToastCtx = createContext<ToastFn>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback<ToastFn>((text, tone = 'error') => {
    const id = next.current++;
    setToasts((t) => [...t.filter((x) => x.text !== text), { id, text, tone }].slice(-4));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cls(
              'pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm shadow-lg',
              t.tone === 'error' && 'bg-rose-700 text-white',
              t.tone === 'ok' && 'bg-emerald-700 text-white',
              t.tone === 'info' && 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900',
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastFn {
  return useContext(ToastCtx);
}
