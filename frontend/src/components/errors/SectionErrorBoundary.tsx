import type { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { SectionErrorFallback } from './ErrorFallbacks';

/** Wraps one independent part of a page so a rendering failure there doesn't take the page down. */
export function SectionErrorBoundary({
  name,
  title,
  resetKeys,
  children,
}: Readonly<{ name: string; title?: string; resetKeys?: ReadonlyArray<unknown>; children: ReactNode }>) {
  return (
    <ErrorBoundary
      name={name}
      resetKeys={resetKeys}
      fallback={props => <SectionErrorFallback {...props} title={title} />}
    >
      {children}
    </ErrorBoundary>
  );
}
