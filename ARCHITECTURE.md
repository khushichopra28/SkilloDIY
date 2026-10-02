# Skillo EventOps architecture

This document separates the current application into frontend, backend, and shared responsibilities. The repository is a Next.js full-stack application: frontend pages and server routes share the `app/` tree by design. The map below describes ownership and trust boundaries; it does not imply that those files should be moved into separate projects.

## System overview

```text
Browser
  ├─ Next.js pages and interactive React components
  ├─ Supabase browser client ────────────┐
  └─ HTTPS camera capture                │ user session
                                         ▼
Next.js server                         Supabase
  ├─ middleware and route handlers        ├─ Auth
  ├─ request-scoped Supabase client       ├─ PostgreSQL + RLS + RPCs
  ├─ server-only Auth Admin client        └─ private Storage
  └─ event service layer
```

- **Frontend:** Next.js App Router, React, TypeScript, Lucide icons, and the Skillo aqua/white design system. Admin navigation is desktop-first; handler operations are mobile-first.
- **Backend:** Next.js server components, route handlers, middleware and service functions, plus Supabase Auth, PostgreSQL functions/RLS, and Storage policies.
- **Identity:** Supabase Auth supplies the session. Admin profiles are provisioned by administrators. Handler self-registration creates a unique `handler_applications` record keyed by the Auth UUID; only authorized verification approval creates an active, verified handler `profiles` row. Roles are lowercase `super_admin`, `city_admin`, and `handler`.
- **Data tenancy:** Organizations contain cities. City admins operate within assigned cities. Handlers are represented by profiles and can see assigned event data under RLS.
- **Privacy:** Attendance evidence, receipts, and documents are kept in private Storage buckets. Attendance uses camera capture and a database RPC records authoritative timestamps. Location is requested only for attendance verification.
- **Deployment:** Next.js deploys to Vercel; Supabase provides hosted Auth, PostgreSQL, and Storage. Service-role access is server-only.

## Frontend responsibilities

```text
app/
  layout.tsx                      Root HTML shell; imports globals.css once
  globals.css                     Global design system, component styles, responsive rules
  page.tsx                        Skillo entry/landing page
  admin/                           Admin portal route pages and layouts
  handler/                         Handler portal route pages and layouts
    signup/                         Email/password and Google account creation
    onboarding/                     Resumable profile, private identity and consent workflow
  login/                           Legacy/general login entry route
  forgot-password/                 Password recovery page
  update-password/                 Set a password from a recovery session
  verify/[token]/                  Public, minimal digital ID verification page

components/
  auth-form.tsx                    Email/password and Google sign-in interaction
  handler-signup-form.tsx          Handler Auth signup
  handler-onboarding.tsx           Resumable handler application UI
  handler-application-review.tsx   Authorized reviewer decision controls
  forgot-password.tsx              Recovery form interaction
  portal-shell.tsx                 Role-aware navigation and portal chrome
  event-create-form.tsx            Event creation interaction
  event-detail.tsx                 Event operations and assignment interaction
  camera-check-in.tsx              Camera-based attendance evidence capture
  expense-form.tsx                 Handler expense and receipt capture
  admin-section.tsx                Admin data views and CSV exports
  handler-section.tsx              Handler tasks, notifications, ID and profile views
  admin-global-search.tsx           Admin global search
```

The `app/` tree also contains server-rendered pages that load authorized data. Interactive controls live in client components under `components/`. Keep secrets and privileged database calls out of client components.

## Backend responsibilities

```text
app/
  api/admin/handlers/route.ts       Authenticated admin handler invitation endpoint
  admin/handler-applications/**     RLS-scoped identity review queue and detail
  auth/callback/route.ts            OAuth/recovery exchange and handler onboarding resume
  admin/**/page.tsx                 Server-rendered admin reads and server actions
  handler/**/page.tsx               Server-rendered handler reads

lib/
  supabase/server.ts                Cookie/session-aware server client
  supabase/admin.ts                 Server-only service-role client
  services/events.ts                Validated RLS-backed event data operations

middleware.ts                       Refreshes sessions and enforces portal routing
supabase/migrations/                Versioned SQL schema, constraints, RLS, RPCs,
                                   triggers, indexes, and private Storage policies
scripts/seed.ts                     Trusted demo/staging data provisioning
```

Backend trust rules:

1. Obtain the authenticated user from Supabase Auth; never trust a role supplied by the browser.
2. Resolve `profiles` using the Auth user UUID. Require the expected role and `status='active'` before entering a portal.
3. An authenticated user without a handler profile can access only their RLS-scoped application and onboarding routes. The database approval RPC is the only self-registration path that creates an active handler profile.
4. Use RLS as the database authorization boundary. Middleware redirects improve navigation but do not replace RLS.
5. Use guarded database RPCs for sensitive workflow changes such as identity review, attendance, task completion, and expense review. Database time is authoritative for review and attendance.
6. Use the service-role key only in `lib/supabase/admin.ts` and trusted server code. Never expose it through a `NEXT_PUBLIC_` variable or client bundle.
7. Store files privately. Government IDs use the separate `identity-documents` bucket, readable only by the owner and authorized verifiers.

## Shared contracts and configuration

```text
types/domain.ts                     Shared application/domain types
lib/supabase/config.ts              Public project URL/key resolution
.env.example                        Placeholder environment variable names
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are public client configuration. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted for compatibility. `SUPABASE_SERVICE_ROLE_KEY` is server-only. `.env.local` is ignored by Git.

## Route map

```text
/                              Skillo entry page
/admin/login                  Admin sign in
/handler/login                Handler sign in
/handler/signup               Email/password and Google registration
/handler/onboarding           Resumable handler application
/forgot-password              Recovery email request
/update-password              Password reset completion
/admin                        Operations dashboard
/admin/calendar               Event schedule
/admin/events                 Event list
/admin/events/new             Event creation
/admin/events/[eventId]       Assignment, checklist and event workspace
/admin/handlers               Handler directory
/admin/handlers/new           Admin-created handler invitation
/admin/handler-applications   Verification queue for authorized reviewers
/admin/handler-applications/[applicationId] Restricted profile and identity document review
/admin/cities                 City workspaces
/admin/live-events            Live event health
/admin/attendance             Attendance register
/admin/expenses               Expense review
/admin/reports                Expense CSV export
/admin/notifications          Admin notifications
/admin/audit-log              Audit history
/admin/clients                Clients
/admin/venues                 Venues
/admin/inventory              City inventory
/admin/settings               Organization settings
/handler                     Handler dashboard
/handler/events              Assigned event list
/handler/events/[eventId]    Assigned event workspace
/handler/check-in/[eventId]  Camera attendance capture
/handler/check-out/[eventId] Camera checkout capture
/handler/checklist           Assigned event tasks
/handler/expenses            Handler expense history
/handler/expenses/new        Expense and receipt submission
/handler/notifications       Handler in-app updates
/handler/id-card             Digital ID and QR verification
/handler/profile             Current handler profile
/verify/[token]              Minimal public identity verification
```

## Database and workflow

- `0001_eventops.sql` creates the organization/profile/event core, attendance, checklists, expenses, notifications, digital IDs, event timeline, `audit_log`, RLS, private Storage buckets, and workflow RPCs.
- `0002_skillo_cities.sql` adds `super_admin`/`city_admin` roles, cities, clients, activities, venues, inventory, reimbursements, checklist templates, city-aware IDs and RLS, and expense review/submission workflows.
- `0003_public_id_verification.sql` adds limited public QR verification and tightens attendance/checklist/review workflows.
- `0004_fix_rls_recursion.sql` resolves profile-policy recursion.
- `0005_event_creation_workflow.sql` adds client-name and handler-arrival support.
- `0006_handler_self_onboarding.sql` adds Auth-linked handler applications, identity verification, restricted storage, approval audit, and global future Handler ID generation. Existing handler profiles receive `verification_status='VERIFIED'` by migration default and keep their existing ID.

The schema intentionally stores handlers in `profiles` with role `handler`; it has no `public.handlers` table. Audit records are in `public.audit_log` (singular). Activation is `profiles.status='active'`, and role literals are lowercase.

Key workflow:

1. An administrator creates an event; database functions allocate its city event code and seed checklist items.
2. A handler creates an Auth account and resumes one application keyed by that Auth UUID. Profile details and government ID remain in RLS-protected application tables until review; identity files use a separate private bucket.
3. A super admin or city admin with `can_verify_handlers` and access to the applicant's city reviews the application. The decision RPC writes an audit record. Approval creates an active verified profile; existing triggers create the global `SKL-00001`-style Handler ID and digital ID.
4. An administrator assigns only active, verified handler profiles. Database guards also prevent pending users from receiving new assignments.
5. During an active event, a handler captures attendance evidence. A guarded RPC validates verified active status, assignment, event and private photo before recording server time and timeline activity.
6. Handlers complete authorized checklist tasks and submit expenses with private receipt evidence.
7. Authorized admins review expenses. Database functions and triggers maintain reimbursement state, notifications, timeline and audit entries.

## Local development and verification

1. Install packages with `npm install`.
2. Copy `.env.example` to `.env.local` and set the Supabase URL, publishable key and local app URL.
3. Apply `supabase/migrations/0001_eventops.sql` through `0006_handler_self_onboarding.sql` in order. The current setup procedure is documented in `SUPABASE_SETUP.md`.
4. Start one Next.js process for this checkout with `npm run dev` and open `http://localhost:3000`.
5. Enable email signup, configure OAuth, and test applicant registration, resumability, protected review, and approval against the configured Supabase project.

Build success confirms source compilation, not remote RLS or Auth behavior. Camera permissions, actual invitation delivery, and database workflow behavior must be verified against a configured Supabase project.

## Current limitations

Organization settings are read-only, reports currently export expense records, notifications are in-app only, and broad event-photo/document workflows are not complete. The schema migration files exist in this repository; the live project must be separately verified to confirm they have been applied.
