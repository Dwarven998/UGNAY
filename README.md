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

## 🔧 Setup Instructions

### 1. Clone & Navigate

```bash
git clone <repo-url>
cd backend
```


### 2. Build & Run

```bash
# Build with Maven
./mvnw clean package

# Run the application
./mvnw spring-boot:run

# Or run the JAR directly
java -jar target/ugnay-0.0.1-SNAPSHOT.jar
```

The server will start on `http://localhost:8080`

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


## 🔧 Setup Instructions

### 1. Clone & Install Dependencies

```bash
git clone <repo-url>
cd frontend
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 3. Build for Production

```bash
npm run build
npm run preview  # Preview production build locally
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

## 📚 Additional Resources

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Router v6](https://reactrouter.com/en/main)
- [Tailwind CSS](https://tailwindcss.com) (CSS variable approach)
