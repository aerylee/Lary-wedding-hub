// "Are you sure?" as an in-app dialog. The browser's own confirm() blocks the page and,
// in current Chrome, dims the whole window — which reads as the app going dark.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Button, Modal } from './kit';

type Ask = { title: string; body?: ReactNode; confirmLabel?: string; danger?: boolean };
type ConfirmFn = (ask: Ask) => Promise<boolean>;

const Ctx = createContext<ConfirmFn>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (a) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setAsk(a);
      }),
    [],
  );

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setAsk(null);
  }, []);
  const cancel = useCallback(() => finish(false), [finish]);

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal
        open={!!ask}
        title={ask?.title ?? ''}
        onClose={cancel}
        footer={
          <>
            <Button variant="subtle" onClick={cancel}>Cancel</Button>
            <Button variant={ask?.danger === false ? 'primary' : 'danger'} onClick={() => finish(true)}>{ask?.confirmLabel ?? 'Delete'}</Button>
          </>
        }
      >
        {ask?.body && <div className="text-sm text-stone-700 dark:text-stone-300">{ask.body}</div>}
      </Modal>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);
