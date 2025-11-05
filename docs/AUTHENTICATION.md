# Authentication System

This project uses [Better Auth](https://better-auth.com) for authentication, integrated with Drizzle ORM and PostgreSQL.

## Features

- ✅ Email/Password Authentication
- ✅ Session-based Authentication (HTTP-only cookies)
- ✅ Protected Routes via Middleware
- ✅ Multi-tenancy (Automatic Organization Creation)
- ✅ Role-Based Access Control (Admin/Member)
- ✅ Server-side & Client-side Auth Utilities
- ✅ Modern UI with Shadcn UI Components

## Tech Stack

- **Better Auth**: Modern authentication library for TypeScript
- **Drizzle ORM**: Type-safe database access
- **PostgreSQL**: Database
- **Next.js 16**: App Router with Server Components
- **Shadcn UI**: Beautiful, accessible UI components

## Database Schema

The authentication system uses the following tables:

### Users Table
```typescript
- id (UUID, primary key)
- organizationId (UUID, foreign key) - Multi-tenancy
- email (varchar, unique)
- emailVerified (timestamp, nullable)
- name (varchar)
- passwordHash (text) - Bcrypt hashed
- image (text, nullable)
- createdAt, updatedAt (timestamps)
```

### Sessions Table
```typescript
- id (text, primary key)
- userId (UUID, foreign key)
- token (text, unique) - Session token
- expiresAt (timestamp)
- ipAddress, userAgent (text, optional)
- createdAt, updatedAt (timestamps)
```

### Accounts Table
```typescript
- id (text, primary key)
- userId (UUID, foreign key)
- accountId, providerId (text) - For OAuth providers
- accessToken, refreshToken, idToken (text, optional)
- password (text, optional)
- createdAt, updatedAt (timestamps)
```

### Organizations Table
```typescript
- id (UUID, primary key)
- name (varchar)
- slug (varchar, unique)
- createdAt, updatedAt (timestamps)
```

### Teams & Team Members
- Multi-tenancy support with role-based access (admin/member)

## Setup Instructions

### 1. Install Dependencies

Already installed, but if needed:
```bash
npm install better-auth bcryptjs
npm install --save-dev @types/bcryptjs
```

### 2. Database Setup

Start the PostgreSQL database:
```bash
npm run dev:db
```

Push the schema to the database:
```bash
npm run db:push
```

### 3. Environment Variables

Create a `.env` file:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agentix
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Start Development Server

```bash
npm run dev
```

## Usage

### Client-Side Authentication

Import the auth client utilities:

```typescript
import { signIn, signOut, useSession } from "@/lib/auth-client";

// In a component
const { data: session, isPending } = useSession();

// Sign in
await signIn.email({
  email: "user@example.com",
  password: "password123",
});

// Sign out
await signOut();
```

### Server-Side Authentication

Use the server utilities in Server Components or Server Actions:

```typescript
import { getSession, getCurrentUser, requireAuth } from "@/lib/auth-server";

// Get current session
const session = await getSession();

// Get current user (null if not authenticated)
const user = await getCurrentUser();

// Require authentication (throws if not authenticated)
const session = await requireAuth();
```

### Protected Routes

Routes are protected via middleware in `src/middleware.ts`:

**Protected routes** (require authentication):
- `/dashboard`
- `/workflows`
- `/settings`

**Public routes**:
- `/` (home)
- `/login`
- `/signup`

To add more protected routes, edit the `protectedRoutes` array in `src/middleware.ts`.

## File Structure

```
src/
├── app/
│   ├── (auth)/              # Auth pages (login, signup)
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── api/
│   │   ├── auth/[...all]/   # Better Auth API routes
│   │   └── signup/          # Custom signup with organization
│   ├── actions/
│   │   └── auth.ts          # Server actions for signup
│   └── dashboard/           # Protected dashboard
├── lib/
│   ├── auth.ts              # Better Auth server config
│   ├── auth-client.ts       # Client-side auth utilities
│   ├── auth-server.ts       # Server-side auth utilities
│   └── db/
│       └── schema/
│           ├── auth.ts      # Auth-related tables
│           └── users.ts     # Users & team members
├── components/
│   ├── ui/                  # Shadcn UI components
│   └── logout-button.tsx    # Logout component
└── middleware.ts            # Route protection
```

## API Endpoints

Better Auth automatically creates the following endpoints:

- `POST /api/auth/sign-in/email` - Email/password sign in
- `POST /api/auth/sign-up/email` - Email/password sign up
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/get-session` - Get current session

Custom endpoints:
- `POST /api/signup` - Sign up with organization creation

## Multi-Tenancy

When a user signs up, the system automatically:

1. Creates an **Organization** (with a unique slug)
2. Creates the **User** (linked to the organization)
3. Creates a **Default Team** in the organization
4. Adds the user as **Team Admin**

This ensures every user is part of an organization from day one.

## Security Features

- ✅ **Password Hashing**: Using bcrypt with salt rounds
- ✅ **HTTP-only Cookies**: Session tokens are not accessible via JavaScript
- ✅ **CSRF Protection**: Built into Better Auth
- ✅ **Session Expiration**: 7 days, auto-refresh after 1 day
- ✅ **Secure Middleware**: Automatic redirect for unauthenticated users

## Customization

### Change Session Duration

Edit `src/lib/auth.ts`:

```typescript
session: {
  expiresIn: 60 * 60 * 24 * 30, // 30 days
  updateAge: 60 * 60 * 24 * 7,  // Update after 7 days
}
```

### Add OAuth Providers

Install the provider package and update `src/lib/auth.ts`:

```typescript
import { github } from "better-auth/providers";

export const auth = betterAuth({
  // ...
  providers: [
    github({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
});
```

### Add Email Verification

Better Auth has built-in email verification. Add an email provider:

```typescript
import { sendEmail } from "better-auth/email";

emailAndPassword: {
  enabled: true,
  requireEmailVerification: true,
  sendVerificationEmail: async (user, url) => {
    // Send email with verification link
    await sendEmail({
      to: user.email,
      subject: "Verify your email",
      html: `<a href="${url}">Verify Email</a>`,
    });
  },
}
```

## Troubleshooting

### "Unauthorized" error on protected routes

Make sure:
1. You're signed in
2. The session cookie is being sent
3. The middleware is not blocking the route incorrectly

### Database connection errors

1. Ensure PostgreSQL is running: `npm run dev:db`
2. Check your `DATABASE_URL` in `.env`
3. Push the schema: `npm run db:push`

### Type errors with Better Auth

Make sure to import types correctly:

```typescript
import type { Session, User } from "@/lib/auth";
```

## Resources

- [Better Auth Documentation](https://better-auth.com)
- [Better Auth with Drizzle](https://better-auth.com/docs/adapters/drizzle)
- [Next.js Authentication Best Practices](https://nextjs.org/docs/app/building-your-application/authentication)
- [Shadcn UI Components](https://ui.shadcn.com)

## Next Steps

- [ ] Add email verification
- [ ] Add password reset flow
- [ ] Add OAuth providers (Google, GitHub)
- [ ] Add two-factor authentication (2FA)
- [ ] Add user profile management
- [ ] Add team invitation system
- [ ] Add API key authentication for external clients
