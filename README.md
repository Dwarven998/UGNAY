# UGNAY

**AI-powered social media management for Philippine academic organizations.**

UGNAY helps academic organizations manage their social media workflow in one place—from creating AI-assisted captions and organizing media assets to scheduling Facebook content and reviewing engagement performance.

## Project at a Glance

| Area | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, React Router 7 |
| Backend | Java 21, Spring Boot 3.5, Maven |
| Database | PostgreSQL (Supabase) |
| Media storage | Supabase Storage |
| AI caption generation | Google Gemini API |
| Social publishing and insights | Facebook Graph API |
| Authentication and security | JWT, Google Sign-In, Facebook OAuth, Cloudflare Turnstile |
| Password reset email | SMTP |

## Key Features

- **AI-assisted captions** — Generate social media captions with Google Gemini and organization-specific AI profiles.
- **Post management** — Create, edit, schedule, and publish social media posts.
- **Facebook integration** — Connect Facebook Pages through OAuth and publish content to connected Pages.
- **Media library** — Upload and organize media assets into folders using Supabase Storage.
- **Analytics and insights** — Review post engagement and performance metrics.
- **Posting recommendations** — Use performance information to support better posting decisions.
- **Organization management** — Support organization workspaces, memberships, and administrative controls.
- **Account security** — JWT-based sessions, Google Sign-In, login rate limiting, Cloudflare Turnstile verification, and password-reset email workflows.

> Some integrations require credentials and the appropriate permissions/configuration in their respective provider dashboards. Facebook publishing and insights depend on the connected Page and the permissions granted to the Facebook app.

## Repository Structure

```text
UGNAY/
├── backend/
│   ├── src/main/java/       # Spring Boot application source
│   ├── src/main/resources/  # Application configuration and database scripts
│   ├── .env.example         # Backend environment variable template
│   ├── Dockerfile
│   ├── mvnw
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── features/
│   │   └── ...
│   ├── .env.example         # Frontend environment variable template
│   └── package.json
└── README.md
```

## Prerequisites

Install the following before running UGNAY locally:

- **Git**
- **Java Development Kit (JDK) 21**
- **Node.js** compatible with Vite 8 (use Node.js 20.19+ or 22.12+)
- **npm**
- A **Supabase** project with a PostgreSQL database and Storage bucket
- A **Google Gemini API key**
- Facebook app credentials for Facebook OAuth and Graph API access
- A Google OAuth 2.0 Web client ID for Google Sign-In
- Cloudflare Turnstile keys if Turnstile verification is enabled
- SMTP credentials if you want to test password-reset emails

The backend includes the Maven Wrapper, so a separate Maven installation is not required.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Dwarven998/UGNAY.git
cd UGNAY
```

### 2. Configure the backend

Open a terminal in the repository root:

```bash
cd backend
```

Copy the environment template:

**Windows PowerShell**
```powershell
Copy-Item .env.example .env
```

**macOS / Linux**
```bash
cp .env.example .env
```

Fill in the values in `backend/.env`:

| Variable | Description |
|---|---|
| `DB_URL` | Supabase PostgreSQL JDBC connection URL |
| `DB_USERNAME` | Database username |
| `DB_PASSWORD` | Database password |
| `JWT_SECRET` | Long, random secret used to sign JWTs |
| `GEMINI_API_KEY` | Google Gemini API key |
| `FACEBOOK_APP_ID` | Facebook app ID |
| `FACEBOOK_APP_SECRET` | Facebook app secret |
| `FACEBOOK_OAUTH_REDIRECT_URI` | Callback URL registered in the Facebook app |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web client ID |
| `FRONTEND_URL` | Frontend origin, such as `http://localhost:5173` |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origin(s) for CORS |
| `TURNSTILE_SECRET` | Cloudflare Turnstile secret key |
| `SMTP_HOST` | SMTP server host (defaults to Gmail SMTP) |
| `SMTP_PORT` | SMTP server port (defaults to 587) |
| `SMTP_USERNAME` | SMTP account username |
| `SMTP_PASSWORD` | SMTP account password or provider app password |
| `MAIL_FROM` | Sender address used for password-reset emails |
| `VITE_SUPABASE_URL` | Supabase project URL used by backend storage integration |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key used by backend storage integration |
| `VITE_SUPABASE_BUCKET` | Supabase Storage bucket (defaults to `media`) |

**Important:** Keep real credentials in your local `.env` file or deployment secret manager. Never commit API keys, passwords, OAuth secrets, JWT secrets, or Turnstile secret keys.

### 3. Configure the frontend

Open a second terminal from the repository root:

```bash
cd frontend
```

Copy the frontend environment template:

**Windows PowerShell**
```powershell
Copy-Item .env.example .env
```

**macOS / Linux**
```bash
cp .env.example .env
```

Set the following values in `frontend/.env`:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_BUCKET` | Storage bucket name (defaults to `media`) |
| `VITE_GOOGLE_CLIENT_ID` | Same Google OAuth Web client ID configured in the backend |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key |

Only values intended for browser use should use the `VITE_` prefix. Never place private API secrets in frontend environment variables.

### 4. Run the backend

From the `backend/` directory:

**Windows**
```powershell
.\mvnw.cmd spring-boot:run
```

**macOS / Linux**
```bash
./mvnw spring-boot:run
```

The backend runs on:

```text
http://localhost:8080
```

The Vite development server proxies `/api` requests to `http://localhost:8080`.

### 5. Run the frontend

From the `frontend/` directory:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (typically):

```text
http://localhost:5173
```

Keep both backend and frontend development servers running while using the local application.

## Development Commands

### Frontend

Run these commands from `frontend/`:

| Command | Description |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest unit tests |

### Backend

Run these commands from `backend/`:

**Windows**
```powershell
.\mvnw.cmd clean package
.\mvnw.cmd test
```

**macOS / Linux**
```bash
./mvnw clean package
./mvnw test
```

Run the packaged application:

```bash
java -jar target/ugnay-0.0.1-SNAPSHOT.jar
```

## Integrations and Configuration Notes

### Supabase

UGNAY uses Supabase PostgreSQL for persistent application data and Supabase Storage for media assets. Configure the database connection and Storage values in the backend and frontend environment files. Ensure the configured bucket exists and its access policies match the application's upload and retrieval requirements.

### Google Gemini

The backend uses the Gemini API for AI-assisted caption generation. Create an API key in Google AI Studio and set it as `GEMINI_API_KEY` in the backend environment.

### Facebook

Facebook OAuth and Graph API features require a Facebook app. Configure the app ID, app secret, and an OAuth redirect URI that exactly matches the callback configured in the Facebook Developer dashboard. The connected Facebook account must grant the permissions required for the Pages and publishing features being used.

### Google Sign-In

Create an OAuth 2.0 Client ID of type **Web application**. Add the local frontend origin (`http://localhost:5173`) and your deployed frontend origin to the authorized JavaScript origins. Use the same client ID for `GOOGLE_CLIENT_ID` in the backend and `VITE_GOOGLE_CLIENT_ID` in the frontend.

### Cloudflare Turnstile

Configure a Turnstile widget in Cloudflare. Put the **site key** in `VITE_TURNSTILE_SITE_KEY` and the corresponding **secret key** in `TURNSTILE_SECRET` on the backend. Do not expose the secret key in frontend code.

### Password-reset email

Password-reset emails are sent by the backend through SMTP. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `MAIL_FROM`. For Gmail, use an app password where required by your Google account security settings.

## Deployment

The backend includes a Dockerfile that builds with Maven and Java 21, then runs the packaged Spring Boot application on the port supplied through the `PORT` environment variable (default: `8080`).

For deployment:

1. Deploy the backend using the `backend/` directory and its Dockerfile.
2. Provide the backend environment variables through the hosting provider's secret/environment configuration.
3. Deploy the frontend as a Vite static site using `frontend/` as the project root.
4. Set the frontend `VITE_` variables at build time.
5. Update `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, OAuth redirect URLs, and provider dashboard origins to match the deployed domains.
6. Confirm that Supabase, Facebook, Google OAuth, Turnstile, and SMTP credentials are configured for the production environment.

Do not commit production `.env` files or secrets.

## Troubleshooting

- **Frontend cannot reach the backend:** Confirm the Spring Boot service is running on port 8080 and that the frontend is using the Vite `/api` proxy during local development.
- **Database connection fails:** Recheck the Supabase JDBC URL, username, password, SSL settings, and network access.
- **Google Sign-In fails:** Confirm the OAuth client ID is identical in frontend and backend and that the current frontend origin is listed in Google Cloud Console.
- **Facebook OAuth fails:** Confirm the redirect URI is an exact match and that the Facebook app has the required products, permissions, and app configuration.
- **Turnstile verification fails:** Ensure the frontend site key and backend secret belong to the same Turnstile widget and that the hostname is allowed.
- **Media does not load:** Verify the Supabase project URL, anon/public key, bucket name, and bucket policies.
- **Password-reset email is not delivered:** Check SMTP credentials, sender configuration, provider security requirements, and spam filtering.

## Error Handling

How UGNAY detects, reports, logs and recovers from errors across the Spring Boot backend and the React frontend.
Read this before adding an endpoint, a third-party integration, or a screen that calls the API.

- [1. Architecture](#1-architecture)
- [2. API error response](#2-api-error-response)
- [3. Error codes](#3-error-codes)
- [4. Backend](#4-backend)
- [5. Frontend](#5-frontend)
- [6. Authentication and session recovery](#6-authentication-and-session-recovery)
- [7. Logging, correlation IDs and secrets](#7-logging-correlation-ids-and-secrets)
- [8. Retry and recovery](#8-retry-and-recovery)
- [9. Testing](#9-testing)
- [10. Known limitations and open risks](#10-known-limitations-and-open-risks)

---

### 1. Architecture

```
Browser ──► axiosClient (fetch wrapper) ──► Spring Boot
   ▲            │ timeout, GET-only retry,     │
   │            │ 401 → sessionEvents           ├─ CorrelationIdFilter   (X-Request-Id, MDC traceId)
   │            ▼                               ├─ Spring Security       (401 / 403 JSON)
   │      ApiError (safe message, code,         ├─ LoginRateLimitFilter  (429 JSON + Retry-After)
   │      status, traceId, details, data)       ├─ Controllers / services throw ApiException subclasses
   │            │                               ├─ GlobalExceptionHandler (all MVC errors → ApiErrorResponse)
   │            ▼                               ├─ ApiErrorController     (/error: failures outside MVC)
   │   inline message / section fallback /      └─ JsonErrorReportValve   (requests Tomcat rejects itself)
   │   Error Boundary / login redirect
```

Principles:

1. **One response shape.** Every error the API returns, wherever it originates, is an `ApiErrorResponse`
   (one documented exception: the scheduling conflict, §2).
2. **Messages are safe by construction.** Expected (operational) errors carry a message written for users.
   Unexpected errors always produce a generic message; their details go to the log only.
3. **Defects are not disguised.** `NullPointerException`, `IllegalStateException`, `IllegalArgumentException`,
   `NoSuchElementException` and anything unknown are HTTP 500, never a 4xx.
4. **Secrets never leave the server.** Request URLs to Facebook carry `client_secret`/`access_token`; they are
   redacted before logging and never returned or redirected.
5. **Only reads are retried.** Writes (create/schedule/delete) are never repeated automatically.

### 2. API error response

```json
{
  "status": "error",
  "code": "RESOURCE_NOT_FOUND",
  "message": "Post not found",
  "error": "Not Found",
  "details": [],
  "timestamp": "2026-11-22T10:30:00Z",
  "path": "/api/posts/1d2e…",
  "traceId": "4cb7348c-8d7b-4a11-8db2-8c44d3e71aef"
}
```

| Field | Meaning |
|---|---|
| `status` | Always `"error"`. The HTTP status is the response status. |
| `code` | Stable identifier from `ErrorCode` (§3). Clients branch on this, not on `message`. |
| `message` | Safe to show the user as-is. |
| `error` | HTTP reason phrase (kept for older clients that fall back to it). |
| `details` | Per-field problems for validation errors: `[{ "field": "newPassword", "message": "…" }]`. |
| `path` | Request path **without the query string** (which can carry tokens). `null` for Tomcat-level rejections. |
| `traceId` | Same value as the `X-Request-Id` response header. Quote it when reporting a problem. |

**Scheduling conflict (409 `SCHEDULE_CONFLICT`)** keeps the conflicting post's fields at the top level because
the composer renders them as a `PostConflict`:

```json
{ "postId": "…", "caption": "…", "scheduledAt": "…", "status": "SCHEDULED", "mediaUrl": null,
  "code": "SCHEDULE_CONFLICT", "message": "…", "error": "Conflict", "details": [], "timestamp": "…",
  "path": "/api/posts", "traceId": "…" }
```

Here `status` is the *post's* status, so the envelope's `"status": "error"` is intentionally absent.

**Facebook OAuth callback** is a browser redirect, not JSON. On failure it redirects to
`/posts?facebook=failed&reason=<code>&message=<fixed text>`. Only the fixed `reason` code is used by the frontend;
exception messages are never placed in the URL. Reasons: `cancelled`, `missing_code`, `invalid_state`, `no_page`,
`org_not_found`, `token_exchange`, `facebook_unavailable`, `unknown`.

### 3. Error codes

Defined in `backend/.../core/error/ErrorCode.java` and mirrored in `frontend/src/api/errorMessages.ts`.
Never rename a code (clients depend on it); add a new one.

| Code | HTTP | Raised when |
|---|---|---|
| `BAD_REQUEST` | 400 | Generic invalid request; invalid/expired password-reset link |
| `VALIDATION_ERROR` | 400 | Bean Validation failure, malformed parameter, bad `scheduledAt` |
| `MALFORMED_REQUEST` | 400 | Unreadable JSON body |
| `MISSING_PARAMETER` | 400 | Required query parameter / multipart part missing |
| `SECURITY_VERIFICATION_FAILED` | 400 | Cloudflare Turnstile check failed |
| `UNAUTHORIZED` | 401 | No session on a protected endpoint |
| `SESSION_EXPIRED` | 401 | A session token was sent but refused (expired, invalid, issued before a password change) |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `AUTHENTICATION_FAILED` | 401 | Google sign-in failed |
| `FORBIDDEN` | 403 | Signed in but not allowed (e.g. not officer/admin) |
| `RESOURCE_NOT_FOUND` | 404 | Missing or out-of-scope resource; unknown route |
| `METHOD_NOT_ALLOWED` | 405 | Wrong HTTP method |
| `RESOURCE_CONFLICT` | 409 | Duplicate record (e.g. email already registered), concurrent update |
| `SCHEDULE_CONFLICT` | 409 | Another post within 30 minutes |
| `PAYLOAD_TOO_LARGE` | 413 | Upload too large |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Wrong content type |
| `OPERATION_NOT_ALLOWED` | 423 | Business rule (e.g. "Only pending posts can be approved or rejected") |
| `ACCOUNT_LOCKED` | 423 | Too many failed logins / password-change attempts |
| `PRECONDITION_REQUIRED` | 428 | Generic precondition |
| `FACEBOOK_CONNECTION_REQUIRED` | 428 | Scheduling without a connected Page |
| `RATE_LIMIT_EXCEEDED` | 429 | Login rate limit (with `Retry-After`) |
| `AI_QUOTA_EXCEEDED` | 429 | Gemini quota reached |
| `INTERNAL_SERVER_ERROR` | 500 | Any unexpected error (defect) |
| `DATABASE_ERROR` | 500 | Unexpected database error |
| `EXTERNAL_SERVICE_ERROR` | 502 | Facebook/Gemini/other service answered unusably |
| `SERVICE_UNAVAILABLE` | 503 | Generic temporary unavailability |
| `EXTERNAL_SERVICE_UNAVAILABLE` | 503 | Facebook/Gemini/email unreachable or overloaded |
| `DATABASE_UNAVAILABLE` | 503 | Database unreachable / connection or transaction could not start |
| `EXTERNAL_SERVICE_TIMEOUT` | 504 | Third-party timeout |

Frontend-only codes (no response reached the app): `NETWORK_ERROR`, `TIMEOUT`, `UNEXPECTED_RESPONSE`,
`STORAGE_UPLOAD_FAILED` (Supabase Storage).

### 4. Backend

Package `com.ugnay.ugnay.core.error`.

#### Exception hierarchy

`ApiException` extends Spring's `ResponseStatusException`, so existing `catch (ResponseStatusException e)` code and
`getStatusCode()` / `getReason()` keep working. `getReason()` is the user-safe message.

| Class | Status | Use |
|---|---|---|
| `ApiException(ErrorCode, message)` | from code | Base; also used directly for one-off codes (`ACCOUNT_LOCKED`, …) |
| `ResourceNotFoundException` | 404 | Missing or out-of-scope entity |
| `RequestValidationException` | 400 | Input rejected by code (not annotations) |
| `AuthenticationRequiredException` | 401 | `requireAuthenticated(user)` for endpoints under the public `/api/auth/**` prefix |
| `ForbiddenOperationException` | 403 | Permission denied |
| `ResourceConflictException` | 409 | Duplicates |
| `BusinessRuleException` | 423 | Business-rule violation in the current state |
| `RateLimitExceededException` | 429 | Adds `Retry-After` |
| `ExternalServiceException(Service, code, …)` | 429/502/503/504 | Third-party failure; stores a **scrubbed** cause |
| `post.SchedulingConflictException` | 409 | Carries the `PostConflictDto` |
| `post.FacebookConnectionRequiredException` | 428 | |

The ~40 pre-existing `throw new ResponseStatusException(status, "user text")` sites remain valid: the handler maps
the status to a generic code and keeps the reason (except a plain 500, whose reason is replaced).

#### Which handler answers

| Failure | Answered by |
|---|---|
| Thrown by a controller/service | `GlobalExceptionHandler` |
| No/refused session on a protected route | `JsonAuthenticationEntryPoint` (401) |
| Spring Security denies a signed-in user | `JsonAccessDeniedHandler` (403) |
| Login rate limit | `LoginRateLimitFilter` via `ErrorResponseWriter` |
| Exception thrown by a filter, firewall rejection, `response.sendError` | `ApiErrorController` (`/error`) |
| Rejected by Tomcat before any filter (bad URL encoding, huge headers) | `JsonErrorReportValve` |

#### Classification rules (`GlobalExceptionHandler`)

- `ApiException` / `ResponseStatusException`: status and message as thrown.
- Binding/validation (`MethodArgumentNotValidException`, `ConstraintViolationException`,
  `HandlerMethodValidationException`, `HttpMessageNotReadableException`, missing/mistyped parameters): 400. The
  `message` is the first constraint message **if the constraint declares its own** (`@Size(message = "…")`);
  library defaults ("must not be blank") only appear in `details`.
- Database: `DataIntegrityViolationException` → 409 (only the constraint name is logged — the SQL message
  contains values); `ConcurrencyFailureException` → 409; connection/transaction/timeout failures → 503
  `DATABASE_UNAVAILABLE`; other `DataAccessException` → 500 `DATABASE_ERROR`.
- Third parties: untranslated `WebClientResponseException` → 502/503, `WebClientRequestException` /
  `RestClientException` → 503, Facebook `GraphException`s → 502/503/504. Their messages (which embed URLs) are
  never returned.
- Everything else → 500 `INTERNAL_SERVER_ERROR`.

Transactions: handlers run after the `@Transactional` method has exited, so rollback-on-`RuntimeException` is
unchanged. No database write is retried automatically.

#### Adding an endpoint

- Validate request bodies with `@Valid` and Jakarta constraints; give user-facing `message`s.
- Throw a typed exception with a message written for the user; pass the original exception as the cause.
- Endpoints under `/api/auth/**` are public: call `AuthenticationRequiredException.requireAuthenticated(user)`
  if they need a user.
- Never put exception messages, SQL, URLs or tokens in a response or a redirect.

#### Integrations

| Service | Behaviour |
|---|---|
| Facebook Graph (OAuth) | Retries transient errors (existing). Failures become `FacebookGraphException` / `FacebookOAuthException` with scrubbed causes; the callback redirects with a fixed `reason`. |
| Facebook Graph (publishing) | Unchanged: the publishing job marks the post `FAILED` and logs the Graph error body. |
| Facebook Insights | Graph errors keep their status; causes are scrubbed (URLs carry the Page token). |
| Gemini | Model racing / retry unchanged. API key sent in the `x-goog-api-key` **header** (never the URL). Final failure: `AI_QUOTA_EXCEEDED` (429), `EXTERNAL_SERVICE_UNAVAILABLE` (503, busy) or `EXTERNAL_SERVICE_ERROR` (502); Google's own error text is logged, not shown. |
| Email (Brevo/SMTP) | Profile "send reset link" failure → 503 `EXTERNAL_SERVICE_UNAVAILABLE`. Public forgot-password still always answers the same (no account enumeration). |
| Turnstile / Google sign-in | Fail closed with 400 / 401 and fixed messages. |

### 5. Frontend

| File | Role |
|---|---|
| `src/api/axiosClient.ts` | The only API client (`get/post/put/patch/delete`, optional `{ signal, timeoutMs, retries }`). Timeouts, GET-only retry, 401 handling. |
| `src/api/errors.ts` | `ApiError`, `errorFromResponse` (normalizer), `getErrorMessage`, `isAbortError`, `parseRetryAfter`. |
| `src/api/errorMessages.ts` | Code → message map, status → code fallback. |
| `src/api/sessionEvents.ts` | "Session ended" signal from the client to `AuthContext`. |
| `src/api/supabaseClient.ts` | Direct Supabase Storage upload (separate path); failures become friendly `ApiError`s. |
| `src/components/errors/*` | `ErrorBoundary`, `SectionErrorBoundary`, fallbacks, `NetworkStatusBanner`, global handlers. |

#### `ApiError`

Every failed call rejects with `ApiError` (cancellation rejects with an `AbortError` instead):
`status` (0 = no response), `message` (always safe), `code`, `kind` (`http`/`network`/`timeout`), `traceId`,
`details`, `retryAfterMs`, `data` (raw body — e.g. the `PostConflict` on 409).

Message rules in `errorFromResponse`:

| Response | Message shown |
|---|---|
| 4xx with a message | the server's message |
| 500 | always the generic message — never server text |
| 502/503/504 in UGNAY format (`code` present) | the server's message |
| 502/503/504 from a proxy (HTML/plain text) | generic message for the status |
| Network failure / timeout | "Unable to connect…" / "The server is taking too long…" |

In components: `setError(getErrorMessage(err, 'Could not save the post.'))` — non-API errors (e.g. a
`TypeError`) get the fallback, so internal text never reaches the screen.

#### Error Boundaries

| Level | Where | Fallback |
|---|---|---|
| App | `main.tsx` | Full page: Try again / Reload / Go to dashboard |
| Page | Dashboard `<Outlet/>` (`UnifiedManagementDashboard`) | Page card; sidebar stays usable; resets on navigation |
| Section | Analytics chart, recommendation card, overview; post-insights chart; post calendar; media preview | Inline card with "Try again"; rest of the page keeps working |

Boundaries only catch **render** errors. Async/API errors are handled where they occur (inline error states with
retry, e.g. Home dashboard `ErrorState`, Analytics polling notice). Unhandled promise rejections are logged by
`installGlobalErrorHandlers` (cancelled requests ignored). Console reports contain the error name/message and the
trace id, never request bodies or tokens.

`NetworkStatusBanner` shows an app-wide notice while the browser is offline and a short "back online" message.

### 6. Authentication and session recovery

The JWT lives in the HttpOnly `ugnay_token` cookie (24 h). There are no refresh tokens.

| Situation | Behaviour |
|---|---|
| Any API call returns **401** (except login, `/api/auth/me`, Google, logout) | `axiosClient` purges sensitive storage and emits `sessionEvents` **once** (concurrent 401s are collapsed). `AuthContext` clears the user in-app (no page reload). `ProtectedRoute` redirects to `/login` with `state.from` = current page. Login shows "Your session has expired…" for `SESSION_EXPIRED`. After signing in the user returns to `state.from`. |
| **403** | Never signs out. The screen shows the backend's message (e.g. "Requires officer or admin role"). |
| Session check (`/api/auth/me`) fails with network error, timeout or 5xx | **Not** a sign-out. The session hint is kept; `ProtectedRoute` shows "Can't reach the server — Try again" (`sessionError`). Covers the Render cold start. |
| Another tab signed out | This tab re-checks `/me`; signs out only on 401. |

`safeReturnPath` accepts only same-app paths (rejects `//host`, `https://…`, backslashes, and the auth pages).

### 7. Logging, correlation IDs and secrets

**Correlation ID.** `CorrelationIdFilter` runs first. It reuses an incoming `X-Request-Id` only if it matches
`^[A-Za-z0-9._-]{8,64}$`; anything else (line breaks, spaces, markup, oversized) is replaced with a UUID. The id
is put in the MDC as `traceId`, returned in the `X-Request-Id` header (CORS-exposed, along with `Retry-After`) and
in every error body. Log lines carry it via `logging.pattern.correlation=[%X{traceId:-}]`. Background jobs
(scheduled publishing, engagement sync) run outside requests and have no trace id.

**Levels.**

| Event | Level |
|---|---|
| Routine 4xx (validation, not found, conflict, 401) | DEBUG |
| 403, 429 | WARN |
| Third-party failure | WARN, one line, cause redacted, no stack trace |
| Defect, database failure, 5xx | ERROR with stack trace (scrubbed) |

**Secrets.** `LogSanitizer`:

- `redact(text)` masks credential parameters in URLs and form/JSON text — including percent-encoded and
  double-encoded names/separators (`client%5Fsecret%3D…`, `%26access_token%3D…`, `%253D`) — plus `Bearer …`
  values, JWTs, Google `AIza…` keys and Facebook `EAA…` tokens; it flattens line breaks (no forged log lines).
  Facebook error codes such as `"code":190` stay readable.
- `describe(throwable)` — one-line, redacted.
- `scrub(throwable)` — a copy of the exception chain with redacted messages and original stack frames; used for
  every logged stack trace and for causes attached to `ExternalServiceException` / Facebook exceptions.

Rules: never log request bodies, query strings or headers; never log `state`, `code`, tokens or keys.

**Structured logs.** For JSON log lines (e.g. on Render) set `LOGGING_STRUCTURED_FORMAT_CONSOLE=ecs`
(built into Spring Boot 3.5; `traceId` appears as a field). Not enabled by default.

### 8. Retry and recovery

| Layer | Policy |
|---|---|
| Frontend GET | Up to 2 retries on network error, 502, 503, 504. Back-off 600 ms × 2ⁿ + jitter, max 8 s. `Retry-After` honoured when ≤ 15 s (429 retried only then). |
| Frontend POST/PUT/PATCH/DELETE | Never retried (no idempotency keys → could duplicate a post or schedule). |
| Polling (analytics dashboard, post insights) | `retries: 0` — the next 4 s tick is the retry. |
| Timeouts | 60 s default; 90 s for `/api/auth/me` (Render wake-up); 150 s for AI calls; 5 min for storage uploads. A timeout is not retried. |
| Cancellation | `signal` aborts the request and any back-off wait; rejects with `AbortError`, never shown as an error. |
| Backend Facebook / Gemini / image download | Existing bounded retries of transient failures (unchanged). |
| Backend database | No automatic retry. |

Graceful degradation: section boundaries and per-section error states keep the rest of a page usable; the
Facebook connection status falls back to cached details; Gemini failures affect only AI features.

### 9. Testing

```bash
# Backend (from backend/) — includes a Spring context test that connects to the database in backend/.env
mvn test

# Frontend (from frontend/)
npm test          # Vitest, jsdom
npm run build     # tsc -b + vite build
npm run lint
```

Note (Windows): run the frontend tests from a terminal opened in the project folder. If the shell's current
directory uses a different drive-letter case than the project path (`c:\` vs `C:\`), Vitest can load two copies
of itself and every file fails with "Vitest failed to find the runner".

| Area | Tests |
|---|---|
| Error responses, classification, redaction in logs | `GlobalExceptionHandlerTest` |
| Security filter chain: 401/`SESSION_EXPIRED`/403, rate limit, CORS headers, correlation id | `SecurityErrorHandlingTest` |
| Tomcat-level rejections → JSON, no server version | `JsonErrorReportValveTest` |
| Redaction rules | `LogSanitizerTest` |
| OAuth redirect never contains secrets | `FacebookOAuthControllerTest`, `FacebookOAuthServiceTest` |
| Normalizer, code mapping | `errors.test.ts` |
| 401/403 handling, retries, Retry-After, timeouts, cancellation | `axiosClient.test.ts` |
| Session recovery | `AuthContext.test.tsx` |
| Boundaries, fallbacks, global handlers | `ErrorBoundary.test.tsx` |
| Storage upload errors | `supabaseClient.test.ts` |
| Return-path safety, Facebook failure messages | `safeReturnPath.test.ts` |

Manual checks against a running backend (examples):

```bash
curl -i http://localhost:8080/api/posts                                 # 401 UNAUTHORIZED JSON, X-Request-Id
curl -i -H 'Cookie: ugnay_token=bad' http://localhost:8080/api/posts    # 401 SESSION_EXPIRED
curl -i -H 'X-Request-Id: <script>' http://localhost:8080/api/health    # id replaced with a UUID
curl -i --path-as-is 'http://localhost:8080/api/auth//login'            # firewall → /error → JSON
curl -i --path-as-is 'http://localhost:8080/api/auth/%zz'               # Tomcat-level → JSON, no "Tomcat"
curl -i 'http://localhost:8080/api/auth/facebook/callback?error=access_denied'   # 302 reason=cancelled
```

### 10. Known limitations and open risks

**Security (unresolved — tracked, not fixed here):**

1. **Possible historical exposure of the Meta App Secret and Page tokens.** Before the Checkpoint 1 fix, failed or
   retried Facebook token exchanges logged the full request URL (including `client_secret`), and a failed OAuth
   callback could put it in the browser address bar. The code no longer does this, but existing Render logs and
   browser histories are not cleaned by a code change. Rotation of the App Secret and re-connection of Pages is
   **pending a decision by the credential owner**; until then treat this as open.
2. The login rate limiter trusts the first `X-Forwarded-For` value, so the per-IP limit can be bypassed by
   changing that header (the per-account lockout still applies).
3. `GeminiClient` downloads any `http(s)` image URL supplied by the client (server-side request forgery risk).
4. Facebook Page access tokens are stored in plaintext; Supabase Storage deletes use the anon key.
5. Free-text redaction recognises Google keys only in the classic `AIza…` format. The Gemini key is no longer sent
   in URLs, and the `x-goog-api-key` header name is redacted, so this only matters for a key appearing in
   unrelated free text.

**Functional limitations:**

- `FACEBOOK_TOKEN_INVALID` (Graph error 190) is not surfaced as its own code: publishing marks the post `FAILED`
  and the status check falls back to cached details.
- Background jobs have no trace id.
- The backend test suite's `UgnayApplicationTests` starts the full application (including the post scheduler)
  against the configured database.
- Dependency audit (Nov 2026): 18 advisories (9 high, 8 moderate, 1 low), all pre-existing; production-relevant:
  `react-router` / `react-router-dom` (includes an open-redirect-via-backslash advisory; `safeReturnPath` rejects
  backslashes). Upgrades pending approval.

## Useful Documentation

- [React](https://react.dev/)
- [Vite](https://vite.dev/)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [Spring Boot](https://spring.io/projects/spring-boot)
- [Maven](https://maven.apache.org/guides/)
- [Supabase](https://supabase.com/docs)
- [Google AI for Developers](https://ai.google.dev/)
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api/)
- [Google Identity](https://developers.google.com/identity)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)

---

<p align="center">
  Built for Philippine academic organizations.
</p>
