# Skillo EventOps

Skillo EventOps is an internal workforce and event operations platform for planning events across cities, assigning handlers, recording attendance, completing checklists, and reviewing reimbursements. It uses Next.js App Router, TypeScript, Supabase Auth, PostgreSQL with row-level security, and private Supabase Storage.

## Requirements

- Node.js 20.9+ and npm.
- A Supabase project with email/password authentication enabled.
- Vercel for hosted deployment (optional for local development).

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL`. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted for existing deployments. `.env.local` is ignored by Git.
3. Apply the versioned migrations in order. See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for the current remote-project status, CLI setup, and administrator bootstrap.
4. To provision handler invitations from the app, set `SUPABASE_SERVICE_ROLE_KEY` in the local server environment only. It is never exposed to browser code. For a staging demo only, set a strong `DEMO_PASSWORD` and run `npm run seed`.
5. Run `npm run dev` and open `http://localhost:3000`.

The entry page links to `/admin/login` and `/handler/login`. Handlers can register at `/handler/signup` and continue through a resumable application. Registration alone does not grant handler access: an authorized administrator must verify the application before an active handler `profiles` row is created. Do not run the demo seeder against production.

## Authentication and authorization

`profiles.role` is one of `super_admin`, `city_admin`, or `handler`. The profile row—not browser-supplied data—is authoritative for role, active status, and verification status. Middleware protects the portal routes, and PostgreSQL RLS is the data authorization boundary. Handlers can access their own profile and data reachable through event assignments. Administrators are organization- or city-scoped. Email signup must be enabled in Supabase. New users are stored in `handler_applications`; approval alone creates their active, verified handler profile.

Password recovery and both handler signup methods use the existing `/auth/callback`. Email/password and Google authentication enter the same onboarding flow. Existing Auth users resume the one application associated with their Auth UUID; duplicate profiles are not created. Google OAuth must be enabled and configured in Supabase and Google Cloud. Follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

## Operations and privacy

Attendance uses `getUserMedia` camera capture, not a gallery picker. A database RPC records the authoritative timestamp after validating the authenticated, active, verified handler, event assignment, active event, and private uploaded photo. Location is requested only for attendance verification. Government identity documents use the separate private `identity-documents` bucket and are available only to the applicant and authorized verification reviewers. Receipts and attendance photos retain their existing private Storage policies. The digital ID QR verification function returns only the limited identity fields required for verification.

## Deployment

Apply all migrations and complete the administrator bootstrap before deploying. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL` in Vercel. Add `SUPABASE_SERVICE_ROLE_KEY` only if server-side handler invitations are needed; it must remain server-only and must never use a `NEXT_PUBLIC_` prefix. Camera capture requires HTTPS, which Vercel provides. Review [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for Auth redirect configuration and local verification steps.

## Product structure

- `app/`: entry, authentication, admin and handler routes, API routes, and public ID verification.
- `components/`: portal shell, workflows, data views, camera capture, and ID card.
- `lib/supabase/`: browser, request-scoped server, and server-only admin clients.
- `middleware.ts`: Supabase session refresh and role-based portal routing.
- `supabase/migrations/`: versioned schema, RLS, Storage policies, and database workflows.
- `app/handler/signup` and `app/handler/onboarding`: self-service account registration and resumable application steps.
- `app/admin/handler-applications`: restricted identity verification queue and decision workflow.
- `scripts/seed.ts`: demo organization and sample event data for non-production environments.
- `ARCHITECTURE.md`: route structure, authorization model, and implementation status.

## Verification status

`npm run build` checks production compilation. Apply migrations through `0006_handler_self_onboarding.sql`, enable email signups, configure Google OAuth, and ensure exactly one organization is configured for public self-registration. Super admins can review applications; city admins need the `can_verify_handlers` permission as well as access to the applicant's city. See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for setup. No credentials or service-role key are included in the repository.
