// If a page throws while rendering, show what happened and a way back instead of an
// empty (and, in dark mode, black) window.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './kit';
import { IconAlert } from './icons';

type Props = { children: ReactNode; /** changing this clears the error, e.g. the route */ resetKey?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-lg rounded-xl border border-rose-200 bg-white p-6 text-center shadow-sm dark:border-rose-900 dark:bg-stone-900">
        <IconAlert size={24} className="mx-auto text-rose-600" />
        <h2 className="mt-2 font-serif text-xl font-semibold">Something went wrong on this page</h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          Your data is safe — this is a display problem. Try again, or reload the page.
        </p>
        <p className="mt-3 break-words rounded-md bg-stone-50 px-3 py-2 text-left font-mono text-xs text-stone-500 dark:bg-stone-950">{this.state.error.message}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
          <Button variant="primary" onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    );
  }
}
