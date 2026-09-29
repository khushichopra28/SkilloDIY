# EventOps

EventOps is a workforce operations workspace for on-ground events. This repository contains a responsive Next.js interface, Supabase email/password authentication, role-gated route middleware, PostgreSQL schema with row-level security, private storage policies, authoritative attendance RPC, camera capture UI, and repeatable demo data seeding.

## Requirements

- Node.js 20.9 or newer and npm.
- A Supabase project with email/password enabled.
- Vercel account for deployment (optional for local development).

## Run locally

1. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and anon key. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only; it is used by demo seeding and must never use a `NEXT_PUBLIC_` prefix.
2. In Supabase SQL Editor, run `supabase/migrations/0001_eventops.sql`.
3. Install and start: `npm install`, then `npm run dev`; open `http://localhost:3000`.
4. Create an administrator through Supabase Auth, then provision the matching `profiles` row with `role='admin'` and an organization ID before first sign-in. This initial bootstrap prevents self-service role escalation. Create handlers through an authenticated admin workflow or provision their rows server-side.
5. To populate the demo org, set `DEMO_PASSWORD` to a strong temporary password and run `npm run seed`. Demo addresses are `ananya@skill-o.example`, `arjun@skill-o.example`, `meera@skill-o.example`, and `rohan@skill-o.example`. Change or remove demo users before production use.

With no Supabase credentials, `/` opens an illustrative design preview. Preview metrics are fixture content and actions indicate that a live workspace connection is required. No authentication or operational mutation should be inferred from preview mode.

## Supabase setup and security

- The migration provisions organization-scoped relational tables, constraints, indexes, RLS, private buckets, and a `record_attendance` RPC. RLS is the final data authorization boundary; middleware is an additional route boundary.
- Handler rows are provisioned by an administrator. There is no public sign-up. Handler IDs should be issued by a server-side provisioning function using a locked sequence per organization/city; never accept a caller-supplied ID in a production profile-create endpoint.
- The camera page captures from `getUserMedia` only (no gallery picker). It uploads to the caller’s private folder and invokes the RPC. The database supplies the authoritative timestamp and attendance state. The browser location is optional and only attached to this event attendance record.
- Storage accepts limited image/PDF types with size caps. Buckets are private; use short-lived signed URLs only after authorization. The SQL setup scopes uploads to the caller’s UUID folder.
- QR verification should use `digital_ids.verification_token` and return only active/valid status plus organization verification, never a profile lookup payload. Keep verification tokens revocable and rate-limit the public verification endpoint.
- Vercel environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`. Server-only: `SUPABASE_SERVICE_ROLE_KEY` (only for trusted admin jobs such as seeding); do not expose it to client bundles.

## Deployment

1. Apply the migration to production Supabase and enable email/password in Auth. Configure the production site URL and password reset redirect allow-list.
2. Create/provision the first administrator in a trusted environment; seed only a staging organization.
3. Add the public Supabase URL and anon key to Vercel. Keep any service key in a server-only environment variable and omit it if not needed at runtime.
4. Import this repository into Vercel; use the Next.js preset and deploy. Camera access requires HTTPS (provided by Vercel).
5. Validate RLS using a handler account and a separate organization admin before inviting the workforce.

## Product structure

- `app/`: App Router pages, auth screens, handler attendance route.
- `components/`: shared command-center views and device camera workflow.
- `lib/supabase/`: browser, request-scoped server, and server-only admin clients.
- `middleware.ts`: session refresh plus role-based route redirects/denials.
- `supabase/migrations/`: schema, RLS and storage policies.
- `scripts/seed.ts`: idempotent demo organization/users/events/assignments/checklist fixtures.
- `ARCHITECTURE.md`: entity outline, roles, route map and staged implementation plan.

## Scope note

The dashboard and schema are a product foundation, not yet a complete end-to-end deployment. Event authoring, handler provisioning, checklist mutation, review queues, exports, QR verification endpoint, and end-to-end notification workflows still need their server actions and corresponding screens. The no-credentials preview is intentionally illustrative. Do not use preview fixture counts to make live staffing or finance decisions.
