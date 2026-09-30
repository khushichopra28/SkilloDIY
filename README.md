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

The entry page links to `/admin/login` and `/handler/login`. There is no public registration. Access requires an active `profiles` row linked to the authenticated Supabase user. Do not run the demo seeder against production.

## Authentication and authorization

`profiles.role` is one of `super_admin`, `city_admin`, or `handler`. The profile row—not browser-supplied data—is authoritative for role and active status. Middleware protects the portal routes, and PostgreSQL RLS is the data authorization boundary. Handlers can access their own profile and data reachable through event assignments. Administrators are organization- or city-scoped. Supabase signup is disabled for this managed-account workflow.

Password recovery uses Supabase Auth email recovery and the existing `/auth/callback`. Google OAuth uses that same callback; it does not provision users. The Google provider must be enabled and configured in Supabase and Google Cloud. Follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

## Operations and privacy

Attendance uses `getUserMedia` camera capture, not a gallery picker. A database RPC records the authoritative timestamp after validating the authenticated handler, event assignment, active event, and private uploaded photo. Location is requested only for attendance verification. Receipts and attendance photos use private Storage buckets with access policies. The digital ID QR verification function returns only the limited identity fields required for verification.

## Deployment

Apply all migrations and complete the administrator bootstrap before deploying. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL` in Vercel. Add `SUPABASE_SERVICE_ROLE_KEY` only if server-side handler invitations are needed; it must remain server-only and must never use a `NEXT_PUBLIC_` prefix. Camera capture requires HTTPS, which Vercel provides. Review [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for Auth redirect configuration and local verification steps.

## Product structure

- `app/`: entry, authentication, admin and handler routes, API routes, and public ID verification.
- `components/`: portal shell, workflows, data views, camera capture, and ID card.
- `lib/supabase/`: browser, request-scoped server, and server-only admin clients.
- `middleware.ts`: Supabase session refresh and role-based portal routing.
- `supabase/migrations/`: versioned schema, RLS, Storage policies, and database workflows.
- `scripts/seed.ts`: demo organization and sample event data for non-production environments.
- `ARCHITECTURE.md`: route structure, authorization model, and implementation status.

## Verification status

`npm run build` checks production compilation. The local environment is configured with a Supabase project URL and publishable key. A read-only Auth check confirmed the project is reachable and email authentication is enabled; Google is currently disabled. The live REST check found that `public.profiles` is not present in the project schema cache, so database-backed login and portal workflows cannot succeed until the migrations are applied. See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for the exact status and setup steps. No credentials or service-role key are included in the repository.
