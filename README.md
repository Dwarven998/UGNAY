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
