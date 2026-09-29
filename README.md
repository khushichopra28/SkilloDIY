# Skillo EventOps

Skillo EventOps is an internal workforce and event operations platform for planning events across cities, assigning handlers, recording event attendance, completing checklists, and reviewing reimbursements. The app uses Next.js App Router, TypeScript, Supabase Auth, PostgreSQL with row-level security, and private Supabase Storage.

## Requirements

- Node.js 20.9+ and npm.
- A Supabase project with email/password authentication enabled.
- Vercel for hosted deployment (optional for local development).

## Run locally

1. Install packages with `npm install`.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, and `SUPABASE_SERVICE_ROLE_KEY` (server-side only; needed by the seed and admin invitations).
3. Apply the SQL migrations in order using the Supabase SQL editor or Supabase CLI:
   - `supabase/migrations/0001_eventops.sql`
   - `supabase/migrations/0002_skillo_cities.sql`
   - `supabase/migrations/0003_public_id_verification.sql`
4. For a demo environment, set `DEMO_PASSWORD` in `.env.local` to a strong temporary password and run `npm run seed`. The seed provisions a `super_admin`, example handlers, seven cities, activities, venues, three events and event assignments. The demo emails are `ananya@skill-o.example`, `arjun@skill-o.example`, `meera@skill-o.example`, and `rohan@skill-o.example`.
5. Start the app with `npm run dev` and open `http://localhost:3000`.

The landing page links to `/admin/login` and `/handler/login`. Authentication requires an active `profiles` row with the matching role. There is no public registration. The seeder is intended for local/staging data and should not be run against production.

For a non-demo first administrator, create an Auth user in Supabase Auth, then run a trusted SQL bootstrap after all migrations. Replace the example UUID and email with that Auth user’s ID and email; keep the returned organization UUID for the profile row:

```sql
insert into public.organizations (name, slug)
values ('Your Organization', 'your-organization')
returning id;

insert into public.profiles (id, organization_id, role, full_name, email, status)
values ('AUTH-USER-UUID', 'ORGANIZATION-UUID', 'super_admin', 'Admin Name', 'admin@example.com', 'active');
```

Run the SQL from the Supabase SQL editor or another trusted administrative connection, never from a browser client.

## Supabase and authorization

`profiles.role` is one of `super_admin`, `city_admin`, or `handler`. Middleware and portal layouts enforce portal role boundaries, while RLS is the data boundary: super admins are organization scoped, city admins are restricted to managed city records, and handlers can access only their own profile and data reachable through event assignments. Sensitive mutations use database RPCs or server routes, including camera attendance, checklist completion, notification read state, expense submission/review and handler invitations.

Attendance photos are captured with `getUserMedia` (no gallery picker), stored in a private bucket, and submitted to a database RPC that records authoritative server time. Location is requested only for event attendance and stored with that record when permitted. A denied camera permission produces a review-required path rather than an unverified check-in. Receipt capture uses the device camera. Private file access uses owner/city authorization and short-lived signed URLs.

Digital ID QR codes point to `/verify/[token]`. The `verify_handler_id` database function returns only identity verification fields and no contact information, event history, or private profile data. The verification token is not a substitute for handler portal authentication.

## Deployment

1. Apply all migrations to the production Supabase project and confirm Auth email/password and password-reset redirect URLs.
2. Provision the first administrator from a trusted environment, or run the demo seeder against a staging project. Do not allow clients to self-assign roles.
3. Configure the four environment variables from `.env.example` in Vercel. `SUPABASE_SERVICE_ROLE_KEY` must remain server-only and must never use a `NEXT_PUBLIC_` prefix.
4. Deploy with the Vercel Next.js preset. Camera capture requires HTTPS, which Vercel provides.
5. Sign in separately as super admin, city admin and handler to verify intended RLS visibility and workflow access.

## Google OAuth setup

The handler login button is implemented with Supabase OAuth and the existing `/auth/callback` route. Google OAuth is **not configured by this repository**: an administrator must supply Google OAuth credentials in the Google Cloud and Supabase dashboards. The application does not create a handler profile after Google sign-in; the Google-authenticated user must already be linked to an active `profiles` row with `role='handler'` and a generated `handler_id`.

1. In Google Cloud Console, create an OAuth 2.0 Client ID with application type **Web application** and configure the OAuth consent screen for your organization.
2. Add **Authorized JavaScript origins** for local development (`http://localhost:3000`) and the production origin (for example, `https://events.example.com`). Do not include a path in the origin.
3. In the Google client, add the Supabase callback URL as the **Authorized redirect URI**: `https://<project-ref>.supabase.co/auth/v1/callback`. Find the exact URL in your Supabase project under Authentication → Providers → Google. This Google redirect is the Supabase Auth callback, not the application's `/auth/callback` route.
4. In Supabase, open Authentication → Sign In / Providers → Google, enable the provider, and enter the Google Client ID and Client Secret. Keep the client secret only in the Supabase provider settings; do not commit it or expose it through a `NEXT_PUBLIC_` environment variable.
5. Set the Supabase **Site URL** to the production origin. Add these **Redirect URLs** to the Supabase allow list: `http://localhost:3000/auth/callback` and `https://events.example.com/auth/callback` (replace the production example with your actual origin). The existing password recovery flow also uses this callback with an internal `next=/update-password` destination.
6. Configure app environment variables for each deployment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_APP_URL`. Locally, use `http://localhost:3000`; in production, use your deployed HTTPS origin. The handler OAuth button passes the current browser origin plus `/auth/callback` to Supabase.
7. Restart the local server after setting `.env.local`, then try an existing active handler whose Google email matches the email on their pre-provisioned profile. An unlinked Google account is denied and is not provisioned as a handler.

Email/password authentication also requires the Supabase Email provider to be enabled and an Auth user created by an administrator/invitation workflow. Confirm project URL, anon key, Auth provider settings, profile status, and `profiles.role`/`handler_id` when diagnosing a sign-in failure. This checkout had no `.env.local` and no Supabase URL/key environment variables when the login flow was inspected, so remote Auth users/provider configuration could not be queried here.

## Product structure

- `app/`: landing, login/recovery, admin and handler route groups, public ID verification.
- `components/`: portal shell, forms, event workflows, data views, camera capture and ID card.
- `lib/supabase/`: browser, request-scoped server and server-only admin clients.
- `middleware.ts`: Supabase session refresh and role-based portal routing.
- `supabase/migrations/`: core model/RLS, Skillo city model, public ID verification RPC.
- `scripts/seed.ts`: repeatable demo organization and sample event setup.
- `ARCHITECTURE.md`: route structure, authorization model and implementation status.

## Verification status and boundaries

`npm run build` is the production compilation check. No live Supabase credentials are included in this repository, so migrations, RLS behavior, Auth invitations, Storage policies, browser camera/location permissions and live database workflows must still be exercised in a configured Supabase project. The current demo seed does not manufacture attendance photos or checked-in records. The workspace uses live database reads and mutations where implemented; absent database credentials show setup states rather than fabricated operational metrics.
