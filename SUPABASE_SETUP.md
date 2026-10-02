# Supabase setup and connection status

This guide covers connecting this checkout to Supabase without putting credentials in source control.

## Status of the configured project

The local ignored `.env.local` contains a Supabase URL and publishable key. The application now accepts `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the variable in that environment) and continues to accept the older `NEXT_PUBLIC_SUPABASE_ANON_KEY` for compatibility. The values are intentionally not repeated here.

Read-only connectivity checks against that project confirmed:

- Supabase Auth is reachable and email authentication is enabled.
- Google Auth is currently disabled in the project.
- Auth signup was disabled when this project was last inspected. Enable email signup to use handler self-registration; admin accounts remain administrator-managed.
- A REST check reported `PGRST205`: `public.profiles` is not in the schema cache. The database migrations have not yet been applied to this project, so profile lookup and all database-backed portal workflows are not ready there.

The Supabase CLI is not installed or linked in this workspace, and no database password, access token, or service-role key is available. Therefore migrations were not remotely applied. This is not an application credential failure: the prior client code required the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`, while the local environment supplies `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; that mismatch caused the app to treat Supabase as unconfigured. That code mismatch is fixed, but the missing live schema still prevents end-to-end sign-in to a handler profile.

## Environment variables

Copy `.env.example` to `.env.local` and use the values from Supabase Project Settings → API. `.env.local` is ignored by Git.

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable/anon client key | Browser and server; protected data remains behind RLS |
| `NEXT_PUBLIC_APP_URL` | Canonical local/deployment origin used for invitation links | Browser and server |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Auth Admin API for administrator-created handler invitations and demo seeding | Server only; never prefix with `NEXT_PUBLIC_` |
| `DEMO_PASSWORD` | Temporary shared password set only for the demo seeder | Server only; optional |

Never commit `.env.local`, service-role credentials, or Google client secrets.

## Apply versioned migrations

The source of truth is `supabase/migrations/`. Apply these files in order:

1. `0001_eventops.sql`
2. `0002_skillo_cities.sql`
3. `0003_public_id_verification.sql`
4. `0004_fix_rls_recursion.sql`
5. `0005_event_creation_workflow.sql`
6. `0006_handler_self_onboarding.sql`

### Dashboard SQL Editor workflow (available now)

Use the exact files in `supabase/migrations`; do not copy SQL from another source or edit these files for this setup.

1. Sign in to the Supabase Dashboard and open the project that matches this checkout's configured project URL.
2. In the left navigation, open **SQL Editor** and choose **New query**.
3. In your code editor, open `supabase/migrations/0001_eventops.sql`, select the entire file, and copy it. Paste it into the new SQL Editor query and click **Run**. Wait for success before proceeding.
4. Create a new SQL Editor query. Repeat with the entire contents of `supabase/migrations/0002_skillo_cities.sql`. Run it only after 0001 succeeds.
5. Create a new SQL Editor query. Repeat with the entire contents of `supabase/migrations/0003_public_id_verification.sql`. Run it only after 0002 succeeds.
6. Run `0004_fix_rls_recursion.sql` as a new query, after 0003.
7. Run `0005_event_creation_workflow.sql` as a new query, after 0004. This adds the event `client_name`, allows legacy start/end times to be null for new records, and classifies attendance against expected handler arrival (falling back to start time for older events).
8. Run `0006_handler_self_onboarding.sql` as a new query after 0005. It adds the resumable handler application, restricted identity document bucket and reviewer workflow. It does not create any users or apply itself to the database.
6. If any migration reports an error, stop. Do not rerun that entire file blindly: SQL Editor may already have executed earlier statements from it. Save the full error message and inspect the database state before retrying.

The SQL Editor executes those exact migration statements, but does not make this checkout's local files part of CLI migration history. Keep applying these migrations through SQL Editor unless you later reconcile the remote migration history before using `db push`.

### CLI workflow (not configured here)

There is no installed/linked Supabase CLI project configuration in this workspace, so `supabase db push` is not currently safe to run. If you choose to set it up later, the command sequence is:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Use the project ref shown in the Supabase dashboard URL/settings. Review the pending migration list before confirming `db push`. Do not use this sequence after manually running migrations in SQL Editor until CLI migration history is reconciled.

After applying, verify in Supabase SQL Editor:

```sql
select to_regclass('public.profiles') as profiles_table,
       to_regclass('public.cities') as cities_table,
       to_regclass('public.events') as events_table,
       to_regclass('public.event_assignments') as assignments_table,
       to_regclass('public.attendance') as attendance_table,
       to_regclass('public.expenses') as expenses_table,
       to_regclass('public.notifications') as notifications_table,
       to_regclass('public.audit_log') as audit_log_table,
       to_regclass('public.handler_applications') as handler_applications_table,
       to_regclass('public.handler_verifications') as handler_verifications_table;
select enum_range(null::public.member_role);
```

Those names should resolve to tables; the enum should show `super_admin`, `city_admin`, and `handler`. `public.handlers` and `public.audit_logs` should return null because the existing schema intentionally uses `profiles` for handlers and `audit_log` for audit records. The existing migrations also define `organizations`, `event_timeline`, `digital_ids`, `checklist_items`, `clients`, `activities`, `venues`, `inventory_items`, `event_inventory`, `inventory_transactions`, `photo_categories`, `event_photos`, `reimbursements`, `checklist_templates`, and `id_counters`. They add constraints, indexes, role checks, database functions/triggers, RLS policies, three private Storage buckets (`attendance`, `receipts`, `documents`), and Storage access policies. Do not rename or add tables to match the alternate names in the request.

To confirm RLS is enabled on key tables, run this read-only catalog query after migration:

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles','cities','events','event_assignments','attendance','expenses','notifications','audit_log','handler_applications','handler_verifications')
order by c.relname;
```

All listed rows should show `rls_enabled = true`. The initial super admin can confirm the application-level role check by signing in at `/admin/login` and reaching `/admin`; the app reads the authenticated user's `profiles` row and middleware routes based on its role. SQL Editor runs as a privileged database role, so `auth.uid()`-based policy checks from there do not simulate an authenticated browser session.

The expected role values in this codebase are lowercase: `super_admin`, `city_admin`, and `handler`. The profile active flag is `status='active'` (or `inactive`), not `is_active=true`. The handler entity is a `profiles` row with `role='handler'` and a generated permanent `handler_id`; there is no separate `public.handlers` table. The audit table is `public.audit_log` (singular), not `public.audit_logs`. These names are intentional in the existing migrations and must be used for bootstrap and verification.

## Bootstrap the first administrator

After all three migrations succeed, create the administrator in Supabase Dashboard → Authentication → Users. Then copy the user's **UUID** from that row, open SQL Editor, and use the existing bootstrap below. Substitute that Auth user's UUID and email. First create one organization and note the returned organization UUID; then link the Auth user to it:

```sql
insert into public.organizations (name, slug)
values ('Your Organization', 'your-organization')
returning id;

insert into public.profiles (id, organization_id, role, full_name, email, status)
values ('AUTH-USER-UUID', 'ORGANIZATION-UUID', 'super_admin', 'Admin Name', 'admin@example.com', 'active');
```

For the profile row, replace `AUTH-USER-UUID`, `ORGANIZATION-UUID`, `Admin Name`, and `admin@example.com` with the Auth UUID, returned organization UUID, administrator's name, and the exact Auth email. Keep the role literal `super_admin` and status literal `active`; the SQL Editor accepts lowercase names from the enum. Run the profile insert once. Do not use `SUPER_ADMIN` or `is_active`—neither exists in these migrations. Do not allow a browser user to assign their own role.

Handler invitations through `/admin/handlers/new` use Supabase's Auth Admin API and therefore require `SUPABASE_SERVICE_ROLE_KEY` on the server. If you do not want that key configured in a local app server, create the Auth user through Supabase Dashboard and insert the matching `profiles` row from a trusted SQL session with role `handler`, status `active`, and an existing `home_city_id`. Database triggers generate the handler ID and digital ID. Never send the service-role key to a browser.

## Email/password and recovery

In Supabase Dashboard → Authentication → Sign In / Providers, keep Email enabled and enable new user signups for handler self-registration. Admin accounts remain administrator-provisioned; there is no public admin registration page. The profile ID must exactly equal `auth.users.id`. New handler applicants do not have a `profiles` row until an authorized application approval creates it.

In Authentication → URL Configuration, set:

- **Site URL:** `http://localhost:3000` for local-only development (use your deployed HTTPS origin in production).
- **Redirect URLs:** `http://localhost:3000/auth/callback` and `https://YOUR_PRODUCTION_HOST/auth/callback`.
- Include the matching application origin in `NEXT_PUBLIC_APP_URL` for each deployment.

The forgot-password form requests a Supabase recovery email and returns through `/auth/callback` to `/update-password`. Handler signup and email confirmation return through `/auth/callback` to `/handler/onboarding`. Configure the callback redirect allow list before testing. The UI intentionally gives the same success message whether or not the entered address has an account.

## Handler self-registration and verification

Apply migration `0006_handler_self_onboarding.sql` after `0005`. It reuses `profiles`, `digital_ids`, existing Storage, and Auth records while adding one `handler_applications` row and one `handler_verifications` row per Auth user. Registration uses the Auth UUID as the unique key. The application RPC chooses the organization only when this deployment has exactly one organization; if there are multiple organizations, registration fails closed until organization routing is configured.

1. In Authentication → Sign In / Providers → Email, enable signups. Keep email/password authentication enabled. If email confirmation is enabled, the user follows the confirmation email to continue onboarding.
2. For Google signup, enable the existing Google provider and configure its client in Supabase. Use the same Google Cloud origins and Supabase callback settings described above. Both methods continue to `/handler/onboarding`.
3. Apply the application migration before enabling the public signup link. Confirm the organization has at least one active city. Applicants receive only that organization's city choices through a narrow database function.
4. Super admins can review applications by default. A city admin may review applicants in a city they manage only after a super admin grants `can_verify_handlers=true` on that admin's `profiles` row through a trusted SQL session. Do not grant this permission to ordinary event admins.
5. Government IDs are stored in the private `identity-documents` bucket (PDF/JPG/PNG, maximum 10 MB). Only the applicant and authorized verifiers can read the corresponding object. The workflow does not collect or copy the ID number into a regular profile field.
6. Approval is a guarded database RPC. It records the reviewer and database timestamp in `audit_log`, creates an active `profiles` row with `verification_status='VERIFIED'`, and invokes the existing ID triggers. New Handler IDs use a global `SKL-00001` sequence independent of city. The existing digital ID trigger creates the QR record.
7. Request resubmission or rejection records the same audit data and does not activate the applicant. The application remains resumable under the same Auth user.

No migration has been applied remotely by this setup guide. If migrations 0001–0005 are already applied, apply 0006 only. If the CLI is configured and migration history is accurate, `supabase db push` applies pending local migrations; review the pending list first. Do not use it after SQL Editor application until remote migration history is reconciled.

## Google OAuth (optional)

Google authentication code is implemented using Supabase OAuth and the existing `/auth/callback` route. **It is not operational until configured in Google Cloud and Supabase.** The project currently reports Google disabled. An existing Auth user resumes the single application linked to that Auth UUID. A new Google Auth user is routed to the same handler application flow as email signup; OAuth does not activate a handler or create a `profiles` row. Only the approval RPC creates an active, verified handler profile.

1. In Google Cloud Console, create an OAuth 2.0 Client ID of type **Web application** and configure its consent screen.
2. Add JavaScript origins `http://localhost:3000` and `https://YOUR_PRODUCTION_HOST` (origin only, without a path).
3. In Supabase Dashboard → Authentication → Sign In / Providers → Google, enable Google and copy its displayed callback URL. It normally has the form `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
4. Add that exact Supabase callback URL to Google Cloud **Authorized redirect URIs**. It is different from the app URL `/auth/callback`.
5. Paste the Google Client ID and Client Secret into Supabase's Google provider settings. Keep the secret in Supabase; do not add it to source or `.env.local`.
6. Set Supabase **Site URL** to the production origin and add both application callback URLs to the Supabase **Redirect URLs** allow list: `http://localhost:3000/auth/callback` and `https://YOUR_PRODUCTION_HOST/auth/callback`.
7. Add the deployed app variables in Vercel and redeploy. No Google client secret is required by the app runtime; Supabase holds it.

## Local test flow

1. Apply migrations 0001–0006 in order and bootstrap a test administrator, enable handler email signup, and configure Google if needed; then set `.env.local` and run `npm run dev`.
2. Open `http://localhost:3000/admin/login` and sign in as the active administrator. Confirm the result is `/admin`.
3. Open `http://localhost:3000/handler/signup`; register with email or Google. Complete the profile, upload a test identity document, accept both declarations, and submit. Sign out and back in to confirm the application resumes at its saved step/status.
4. Confirm the applicant shows `verification_pending` and cannot open assigned-event/check-in data. Review it from `/admin/handler-applications` using a super admin or a city admin with `can_verify_handlers=true` and applicant-city scope.
5. Approve the application and confirm the new `profiles` row is active and verified, has a unique `SKL-` Handler ID, and has an associated digital ID. Assign an event and sign in as the handler to confirm assigned events are visible.
6. Confirm an administrator visiting `/handler` is redirected to `/admin`, a handler visiting `/admin` is redirected to `/handler`, and a signed-out browser visiting `/handler` is sent to `/handler/login`. Verify underlying table access with the corresponding authenticated sessions; redirects alone are not an RLS test.
6. Try a wrong password (friendly error), an inactive handler (activation message), and an Auth user without a profile (contact administrator message).
7. For password recovery, use **Forgot password?**, follow the email link, set a new password, then sign in again.
8. For Google, complete provider configuration first. Test a linked active handler (allowed) and a Google account with no handler profile (denied). The current remote project has Google disabled, so this case cannot pass until the manual configuration above is complete.
9. Use HTTPS (or `localhost`) and grant browser camera permission when verifying camera attendance workflows. Geolocation is optional and requested only for attendance.
10. Register a handler using Email and Google (after provider setup), save profile progress and resume, submit a private identity document with consent, then sign in as an authorized reviewer at `/admin/handler-applications`. Approve and confirm the user receives an active profile, global Handler ID and digital ID. Confirm a pending applicant cannot access `/handler/events` or receive an assignment.

## Deployment

Apply migrations to the production project, configure Auth redirect URLs, create the initial administrator securely, and set the environment variables in Vercel. Use the `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` name for the public key. Set `SUPABASE_SERVICE_ROLE_KEY` only if server-side invitations are enabled. Deploy with the Vercel Next.js preset; camera capture requires HTTPS.
