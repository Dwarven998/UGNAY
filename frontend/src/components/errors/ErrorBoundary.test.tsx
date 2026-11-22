import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';
import { AppErrorFallback, RouteErrorFallback } from './ErrorFallbacks';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import { installGlobalErrorHandlers } from './reportClientError';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const crash = { on: true };

function Bomb({ label = 'child content' }: { label?: string }) {
  if (crash.on) throw new Error('render failed: secret internal detail');
  return <p>{label}</p>;
}

function render(node: React.ReactNode) {
  act(() => root.render(node));
}

function click(text: string) {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent === text);
  if (!button) throw new Error(`No button "${text}"`);
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

beforeEach(() => {
  crash.on = true;
  // React and the boundary both report caught errors to the console; keep the test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ErrorBoundary', () => {
  it('shows the app fallback instead of a blank screen, without the error text', () => {
    render(
      <ErrorBoundary name="app" fallback={props => <AppErrorFallback {...props} />}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain('Something went wrong');
    expect(container.textContent).not.toContain('secret internal detail');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('"Try again" renders the children again once the problem is gone', () => {
    render(
      <ErrorBoundary name="route" fallback={props => <RouteErrorFallback {...props} />}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain("This page couldn't be displayed");

    crash.on = false;
    click('Try again');
    expect(container.textContent).toContain('child content');
  });

  it('clears itself when a reset key changes (navigating to another page)', () => {
    const tree = (path: string) => (
      <ErrorBoundary name="route" resetKeys={[path]} fallback={props => <RouteErrorFallback {...props} />}>
        <Bomb label={path} />
      </ErrorBoundary>
    );
    render(tree('/analytics'));
    expect(container.textContent).toContain("This page couldn't be displayed");

    crash.on = false;
    render(tree('/posts'));
    expect(container.textContent).toContain('/posts');
  });

  it('a failing section leaves the rest of the page working', () => {
    render(
      <div>
        <p>Dashboard stats</p>
        <SectionErrorBoundary name="analytics-chart" title="The chart couldn't be displayed.">
          <Bomb />
        </SectionErrorBoundary>
        <p>Upcoming posts</p>
      </div>,
    );
    expect(container.textContent).toContain('Dashboard stats');
    expect(container.textContent).toContain('Upcoming posts');
    expect(container.textContent).toContain("The chart couldn't be displayed.");
  });

  it('reports the failure to the console with where it happened', () => {
    render(
      <SectionErrorBoundary name="recommendation-card">
        <Bomb />
      </SectionErrorBoundary>,
    );
    const reported = vi.mocked(console.error).mock.calls.some(call => String(call[0]).includes('recommendation-card'));
    expect(reported).toBe(true);
  });
});

describe('installGlobalErrorHandlers', () => {
  it('ignores cancelled requests and reports other unhandled rejections', () => {
    const target = new EventTarget() as unknown as Window;
    const remove = installGlobalErrorHandlers(target);
    const rejection = (reason: unknown) => {
      const event = new Event('unhandledrejection', { cancelable: true }) as PromiseRejectionEvent;
      Object.defineProperty(event, 'reason', { value: reason });
      target.dispatchEvent(event);
      return event;
    };

    const aborted = rejection(new DOMException('cancelled', 'AbortError'));
    expect(aborted.defaultPrevented).toBe(true);
    expect(console.error).not.toHaveBeenCalled();

    rejection(new Error('boom'));
    expect(console.error).toHaveBeenCalledTimes(1);
    remove();
  });
});
