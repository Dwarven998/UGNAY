import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { reportClientError } from './reportClientError';

export interface ErrorFallbackProps {
  error: Error;
  /** Clears the error and renders the children again. */
  reset: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (props: ErrorFallbackProps) => ReactNode;
  /** Where the boundary sits, for the console report (e.g. "route", "analytics-chart"). */
  name: string;
  /** When any of these values change (e.g. the route path), an error state is cleared automatically. */
  resetKeys?: ReadonlyArray<unknown>;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function keysChanged(a: ReadonlyArray<unknown> = [], b: ReadonlyArray<unknown> = []): boolean {
  return a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]));
}

/**
 * Catches errors thrown while rendering its children so one broken component shows a fallback instead of
 * blanking the whole app. It does not catch errors in event handlers or async code (those are handled where
 * they happen, e.g. API errors become inline messages).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error('Rendering failed') };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError(this.props.name, error, info.componentStack ?? undefined);
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.error && keysChanged(previous.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }
    return this.props.children;
  }
}
