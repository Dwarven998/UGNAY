# UGNAY

AI-powered social media management platform for Philippine college organizations. Built with Spring Boot and integrates with Facebook, Gemini AI, and Supabase.

## 🚀 Project Overview

UGNAY provides college organizations with tools to:
- Generate AI-powered social media captions using Google Gemini
- Manage and schedule posts to Facebook
- Organize media assets in folders
- Track engagement analytics
- Get posting recommendations based on performance

# UGNAY Backend

## 📋 Prerequisites

- **Java 17+**
- **Maven 3.8+**
- **PostgreSQL** (via Supabase)
- **Google Gemini API Key**
- **Facebook API Credentials**

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── main/
│   │   ├── java/com/ugnay/ugnay/
│   │   │   ├── UgnayApplication.java          # Main Spring Boot entry point
│   │   │   ├── auth/                          # Authentication module
│   │   │   │   ├── AuthController.java        # Login/Register endpoints
│   │   │   │   └── AuthRequest.java           # Auth DTOs
│   │   │   ├── core/                          # Core security & auth infrastructure
│   │   │   │   ├── User.java                  # User entity
│   │   │   │   ├── UserRepository.java        # User data access
│   │   │   │   ├── JwtUtil.java               # JWT token generation/validation
│   │   │   │   ├── JwtFilter.java             # JWT authentication filter
│   │   │   │   └── SecurityConfig.java        # Spring Security configuration
│   │   │   ├── post/                          # Post management module
│   │   │   │   ├── Post.java                  # Post entity (DRAFT, SCHEDULED, PUBLISHED, FAILED)
│   │   │   │   ├── PostController.java        # Post CRUD endpoints
│   │   │   │   ├── PostService.java           # Post business logic
│   │   │   │   ├── PostRepository.java        # Post data access
│   │   │   │   ├── PostSchedulerJob.java      # Background job for publishing scheduled posts
│   │   │   │   ├── PostEngagement.java        # Engagement tracking (likes, comments, shares)
│   │   │   │   └── PostEngagementRepository.java
│   │   │   ├── caption/                       # AI caption generation module
│   │   │   │   ├── CaptionController.java     # Generate/Rewrite/Hashtag endpoints
│   │   │   │   ├── GeminiClient.java          # Google Gemini AI integration
│   │   │   │   └── Request DTOs              # GenerateRequest, RewriteRequest, HashtagRequest
│   │   │   ├── media/                         # Media management module
│   │   │   │   ├── MediaAsset.java            # Media file entity
│   │   │   │   ├── MediaFolder.java           # Media folder entity
│   │   │   │   ├── MediaController.java       # Media endpoints
│   │   │   │   ├── MediaService.java          # Media business logic
│   │   │   │   ├── MediaAssetRepository.java
│   │   │   │   └── MediaFolderRepository.java
│   │   │   ├── analytics/                     # Analytics module
│   │   │   │   ├── AnalyticsController.java   # Analytics endpoints
│   │   │   │   ├── AnalyticsService.java      # Analytics calculations
│   │   │   │   └── PostEngagementRepository.java
│   │   │   └── facebook/                      # Facebook integration
│   │   │       └── FacebookService.java       # Graph API integration
│   │   └── resources/
│   │       └── application.properties         # Configuration (DB, JWT, APIs)
│   └── test/
│       └── UgnayApplicationTests.java
├── pom.xml                                    # Maven dependencies
├── mvnw / mvnw.cmd                           # Maven wrapper
└── target/                                    # Build artifacts
```

## 🔧 Setup Instructions

### 1. Clone & Navigate

```bash
git clone <repo-url>
cd backend
```

### 2. Configure Environment

Edit `src/main/resources/application.properties`:

```properties
# Database
spring.datasource.url=jdbc:postgresql://your-db-host:5432/your-db
spring.datasource.username=your-username
spring.datasource.password=your-password

# JWT
jwt.secret=your-256-bit-secret-key
jwt.expiration=86400000

# Gemini API
gemini.api.key=your-gemini-api-key
gemini.api.url=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent

# Facebook
facebook.api.url=https://graph.facebook.com/v20.0
facebook.app.id=your-app-id
facebook.app.secret=your-app-secret
```

### 3. Build & Run

```bash
# Build with Maven
./mvnw clean package

# Run the application
./mvnw spring-boot:run

# Or run the JAR directly
java -jar target/ugnay-0.0.1-SNAPSHOT.jar
```

The server will start on `http://localhost:8080`

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Posts
- `GET /api/posts` - Get all user posts
- `POST /api/posts` - Create new post
- `PUT /api/posts/{postId}` - Update post
- `DELETE /api/posts/{postId}` - Delete post
- `POST /api/posts/{postId}/publish` - Publish now

### Caption Generation (AI)
- `POST /api/caption/generate` - Generate captions from image URL & tone
- `POST /api/caption/rewrite` - Rewrite caption in different tone
- `POST /api/caption/hashtags` - Generate hashtags

### Media
- `GET /api/media/folders` - Get all folders
- `POST /api/media/folders` - Create folder
- `DELETE /api/media/folders/{folderId}` - Delete folder
- `GET /api/media/folders/{folderId}/assets` - Get folder assets
- `POST /api/media/assets` - Save asset metadata
- `DELETE /api/media/assets/{assetId}` - Delete asset

### Analytics
- `GET /api/analytics/summary` - Get analytics summary
- `GET /api/analytics/top-posts` - Get top performing posts
- `GET /api/analytics/recommendation` - Get posting recommendations

## 🔄 Key Components

### Authentication Flow
1. User registers/logs in via `AuthController`
2. `JwtUtil` generates JWT token
3. `JwtFilter` validates token on subsequent requests
4. Authenticated user accessible via `@AuthenticationPrincipal`

### Post Publishing
1. User creates post (saved as DRAFT)
2. User can schedule for future time (SCHEDULED)
3. `PostSchedulerJob` runs every minute, checks for due posts
4. Due posts published to Facebook via `FacebookService`
5. Status updated to PUBLISHED or FAILED

### AI Caption Generation
1. Frontend sends image URL + tone to `/api/caption/generate`
2. `GeminiClient` builds multimodal request (image + prompt)
3. Gemini returns 3 caption options
4. Frontend displays for user selection/editing

## 📦 Dependencies

Key Maven dependencies in `pom.xml`:
- `spring-boot-starter-web` - REST API
- `spring-boot-starter-data-jpa` - Database ORM
- `postgresql` - PostgreSQL driver
- `spring-security` - Authentication/Authorization
- `jjwt` - JWT library
- `lombok` - Code generation
- `spring-webflux` - Async HTTP client for APIs

## 🐛 Troubleshooting

### Database Connection Error
- Verify Supabase credentials in `application.properties`
- Ensure PostgreSQL is running
- Check firewall rules allow connection

### JWT Token Invalid
- Verify `jwt.secret` is consistent
- Check token hasn't expired (`jwt.expiration`)

### Gemini API Error
- Verify API key is correct and has quota
- Check internet connection
- Review error response in logs

## 📚 Additional Resources

- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [Google Gemini API](https://ai.google.dev/)
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api)
- [JWT Introduction](https://jwt.io/)


# UGNAY Frontend

React + TypeScript + Vite frontend for UGNAY — AI-powered social media management for college organizations.

## 🚀 Project Overview

The frontend provides a user-friendly interface for:
- User authentication (login/register)
- Post management (create, edit, schedule, publish)
- AI-powered caption generation with tone selection
- Media asset management organized in folders
- Social media analytics and insights
- Posting recommendations

## 📋 Prerequisites

- **Node.js 18+**
- **npm** or **yarn**
- **Vite** (included in project)

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── main.tsx                          # React entry point
│   ├── index.css                         # Global styles (CSS variables, theming)
│   ├── App.tsx                           # Root component with routing
│   ├── App.css                           # Root component styles
│   ├── api/                              # API client utilities
│   │   ├── axiosClient.ts                # Fetch-based HTTP client with auth
│   │   └── supabaseClient.ts             # Supabase Storage upload helper
│   ├── context/                          # React Context (global state)
│   │   └── AuthContext.tsx               # Authentication context & hooks
│   ├── types/                            # TypeScript type definitions
│   │   └── index.ts                      # Post, MediaFolder, MediaAsset, Tone types
│   └── features/                         # Feature modules (by domain)
│       ├── auth/
│       │   ├── pages/
│       │   │   └── AuthPage.tsx          # Login/Register page
│       │   └── api/
│       │       └── authApi.ts            # Auth API calls
│       ├── posts/
│       │   ├── pages/
│       │   │   └── PostManager.tsx       # Create/Edit/Delete/Publish posts
│       │   └── api/
│       │       └── postApi.ts            # Post API calls
│       ├── caption/
│       │   ├── pages/
│       │   │   └── CaptionStudio.tsx     # 4-step caption generation UI
│       │   └── api/
│       │       └── captionApi.ts         # Caption generation API calls
│       ├── media/
│       │   ├── pages/
│       │   │   └── MediaRepository.tsx   # Folder browser & file upload
│       │   └── api/
│       │       └── mediaApi.ts           # Media management API calls
│       ├── analytics/
│       │   ├── pages/
│       │   │   └── Analytics.tsx         # Dashboard with KPIs & insights
│       │   └── api/
│       │       └── analyticsApi.ts       # Analytics API calls
│       └── pages/
│           └── Dashboard.tsx             # Layout with sidebar navigation
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── index.html                            # HTML entry point
├── package.json                          # Dependencies & scripts
├── tsconfig.json                         # TypeScript config
├── vite.config.ts                        # Vite build config
├── eslint.config.js                      # ESLint rules
└── README.md
```

## 🔧 Setup Instructions

### 1. Clone & Install Dependencies

```bash
git clone <repo-url>
cd frontend
npm install
```

### 2. Configure Environment Variables

Create `.env` or `.env.local` in the frontend root:

```env
# API Backend
VITE_API_URL=http://localhost:8080

# Supabase (for media uploads)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_BUCKET=media
```

**Note:** If Supabase credentials are not configured, the app falls back to local Object URLs for development.

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
npm run preview  # Preview production build locally
```

## 📦 Dependencies

Key packages in `package.json`:
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS (via `index.css` variables)

## 🎨 Design & Styling

### CSS Variables
Global theme variables in `src/index.css`:
- `--text` - Primary text color
- `--text-h` - Heading text color
- `--bg` - Background color
- `--accent` - Primary accent (purple)
- `--border` - Border color
- Automatically switches for dark mode

### Component Styling
- **Tailwind-inspired utility classes** - `bg-blue-600`, `px-4`, `rounded-lg`, etc.
- **Responsive design** - Mobile-first with `@media` breakpoints
- **Dark mode support** - Via CSS variables

## 🔐 Authentication Flow

1. **Register/Login** - Submit email, password, org name
   - Credentials sent to `POST /api/auth/register` or `/api/auth/login`
   - JWT token received and stored in `localStorage`

2. **Protected Routes** - `<ProtectedRoute>` wrapper in `App.tsx`
   - Checks for valid token
   - Redirects to `/login` if unauthorized

3. **API Requests** - `axiosClient` automatically:
   - Attaches JWT token to `Authorization` header
   - Handles 401 (refresh to login)

## 🗂️ Feature Modules

### Post Manager (`/posts`)
- List all user posts with status badges
- Create new posts (caption, hashtags, tone, scheduling)
- Edit existing posts
- Delete posts
- Publish scheduled posts immediately
- Auto-load draft from Caption Studio

### Caption Studio (`/caption`)
**4-step workflow:**
1. **Image** - Paste Supabase media URL or upload
2. **Tone** - Select FORMAL, ENERGETIC, CELEBRATORY, or URGENT
3. **Captions** - Choose from 3 AI-generated options, rewrite in different tones
4. **Hashtags** - Auto-generate relevant hashtags
5. **Send** - Forward to Post Manager as draft

### Media Repository (`/media`)
- Browse media folders (left sidebar)
- Upload images/videos to Supabase Storage
- View media assets in grid
- Copy file URLs to clipboard
- Create/delete folders

### Analytics (`/analytics`)
- **Summary Cards** - Total posts, published count, engagement metrics
- **Top Performing Posts** - Ranked by engagement
- **Posting Recommendations** - Best time to post based on history
- Unlock personalized insights after 5+ published posts

### Dashboard (Layout)
- Sidebar navigation with icons
- User org name display
- Sign out button
- Main content area with `<Outlet />` for nested routes

## 🚀 API Integration

All API calls use `axiosClient` (fetch-based):

```typescript
// Example: Get posts
const posts = await postApi.getAll();

// Example: Create post
await postApi.create({
  caption: "Hello World!",
  hashtags: ["#event", "#college"],
  tone: "ENERGETIC",
  scheduledAt: "2024-12-25T10:00:00Z"
});
```

API modules:
- `authApi.ts` - Login, register
- `postApi.ts` - CRUD operations, publish
- `captionApi.ts` - Generate, rewrite, hashtags
- `mediaApi.ts` - Folders, uploads, assets
- `analyticsApi.ts` - Summary, top posts, recommendations

## 🎯 Key Hooks & Context

### `useAuth()` Hook
Access authentication state:
```typescript
const { user, login, register, logout, isLoading } = useAuth();
```

### Session Storage
Caption Studio passes draft to Post Manager via `sessionStorage`:
```typescript
sessionStorage.setItem('caption_draft', JSON.stringify({
  caption, hashtags, imageUrl, tone
}));
```

## 🧪 Development Tips

### Hot Module Replacement (HMR)
Changes automatically reload without losing state (Vite default).

### TypeScript Support
- Strict mode enabled in `tsconfig.json`
- All API responses typed
- Component props fully typed

### ESLint
```bash
npm run lint  # Check code style
```

## 🐛 Troubleshooting

### API Connection Error
- Verify backend is running on `http://localhost:8080`
- Check `VITE_API_URL` environment variable
- Review browser console for CORS issues

### Supabase Upload Fails
- Verify credentials in `.env`
- Check bucket exists and is public
- Falls back to local Object URL if not configured

### Token Expired
- Clear `localStorage` manually
- Refresh page or re-login

## 📚 Additional Resources

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Router v6](https://reactrouter.com/en/main)
- [Tailwind CSS](https://tailwindcss.com) (CSS variable approach)

## 🔄 Next Steps

1. Start the backend: `./mvnw spring-boot:run`
2. Start the frontend: `npm run dev`
3. Navigate to `http://localhost:5173`
4. Register as a new college organization
5. Start creating posts with AI-generated captions!
