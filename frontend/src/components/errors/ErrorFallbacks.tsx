import type { ErrorFallbackProps } from './ErrorBoundary';
import '../ui/dialog.css';
import './errors.css';

/** Whole-app fallback: shown only if the app shell itself fails to render. Works without the router. */
export function AppErrorFallback({ reset }: Readonly<ErrorFallbackProps>) {
  return (
    <main className="ug-error-page" role="alert">
      <div className="ug-error-page__card">
        <img className="ug-error-page__logo" src="/ugnay_logo_ui.png" alt="" aria-hidden="true" />
        <h1>Something went wrong</h1>
        <p>
          UGNAY ran into an unexpected problem while showing this page. Your saved posts and files are not affected.
        </p>
        <div className="ug-error-actions">
          <button type="button" className="ug-btn ug-btn-primary" onClick={reset}>Try again</button>
          <button type="button" className="ug-btn ug-btn-secondary" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a className="ug-btn ug-btn-secondary" href="/">Go to dashboard</a>
        </div>
      </div>
    </main>
  );
}

/** Fallback for one page inside the dashboard: the sidebar and navigation keep working. */
export function RouteErrorFallback({ reset }: Readonly<ErrorFallbackProps>) {
  return (
    <section className="ug-error-route" role="alert">
      <h2>This page couldn't be displayed</h2>
      <p>Something went wrong while showing this page. You can try again or go to another page from the menu.</p>
      <div className="ug-error-actions">
        <button type="button" className="ug-btn ug-btn-primary" onClick={reset}>Try again</button>
        <button type="button" className="ug-btn ug-btn-secondary" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    </section>
  );
}

/** Inline fallback for one independent section (a chart, a card): the rest of the page stays usable. */
export function SectionErrorFallback({ reset, title }: Readonly<ErrorFallbackProps & { title?: string }>) {
  return (
    <div className="ug-error-section" role="alert">
      <span>{title ?? "This section couldn't be displayed."}</span>
      <button type="button" className="ug-btn ug-btn-secondary ug-btn-sm" onClick={reset}>Try again</button>
    </div>
  );
}
