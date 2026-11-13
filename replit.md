# VibeSwipe

A mobile-first dating app for profiles, mutual likes, matches, and private chat.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/vibeswipe run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: Postgres connection and Clerk keys are provided through Replit-managed secrets.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Authentication: Clerk
- Private photos and videos: Replit Object Storage
- Mobile: Expo Router, React Native, Expo Video
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/vibeswipe/` — Expo app, screens, uploads, and media preload queue
- `artifacts/api-server/src/routes/vibeswipe.ts` — authenticated app API
- `lib/db/src/schema/vibeswipe.ts` — PostgreSQL schema
- `lib/api-spec/openapi.yaml` — API source of truth; run codegen after changes
- `artifacts/vibeswipe/constants/colors.ts` — mobile theme tokens

## Architecture decisions

- Use Clerk + PostgreSQL + Replit Object Storage; Supabase is not connected in this project.
- Chat messages refresh by polling because no realtime service is configured.
- Private media is served through authenticated API routes rather than public object URLs.

## Product

- Email/password and Google sign-in, 18+ onboarding, profile editing, and media uploads.
- VibeSwipe sign-up collects email and password on separate screens. Email uses format validation without a minimum length; the password screen keeps the at-least-8 rule, visible-by-default field, show/hide control, and exact minimum-length error.
- Profile discovery, pass/like/super-like, mutual matches, match-gated chat, and reporting/blocking.
- Discover video playback is muted by default and keeps the active and next two profiles buffered.

## User preferences

- Continue the existing project in place; do not restart or delete anything.

## Gotchas

- Google OAuth must be enabled in the Clerk configuration before its button can complete sign-in.
- Profile videos are limited to 720p dimensions, 30 seconds, and 50 MB; users may need to select a lower-resolution file.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
