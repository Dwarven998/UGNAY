import { isAbortError, isApiError } from '../../api/errors';

/**
 * Writes a diagnostic line for an error the UI recovered from. There is no remote error collector, so this
 * goes to the browser console only: the error's name and message (and in development the component stack),
 * never request bodies, tokens or user data.
 */
export function reportClientError(where: string, error: unknown, componentStack?: string): void {
  if (isAbortError(error)) return;
  const label = `[UGNAY] ${where}:`;
  if (isApiError(error)) {
    console.error(label, `${error.code} (HTTP ${error.status})`, error.traceId ? `traceId=${error.traceId}` : '');
    return;
  }
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : '';
  if (import.meta.env.DEV) {
    console.error(label, error, componentStack ?? '');
  } else {
    console.error(label, `${name}: ${message}`);
  }
}

/**
 * Last-resort logging for promise rejections and errors nobody handled (Error Boundaries only see render
 * errors). Cancelled requests are ignored. Returns a function that removes the listeners.
 */
export function installGlobalErrorHandlers(target: Window = window): () => void {
  const onRejection = (event: PromiseRejectionEvent) => {
    if (isAbortError(event.reason)) {
      event.preventDefault();
      return;
    }
    reportClientError('unhandled promise rejection', event.reason);
  };
  const onError = (event: ErrorEvent) => {
    reportClientError('uncaught error', event.error ?? event.message);
  };
  target.addEventListener('unhandledrejection', onRejection);
  target.addEventListener('error', onError);
  return () => {
    target.removeEventListener('unhandledrejection', onRejection);
    target.removeEventListener('error', onError);
  };
}
