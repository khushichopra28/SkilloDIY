# Skillo EventOps architecture

## Application architecture

- **Web:** Next.js App Router, TypeScript, React and a shared Skillo aqua/white design system. Admin navigation is desktop-first; the handler experience has a mobile bottom bar and touch-sized event actions.
- **Identity:** Supabase Auth email/password. The server-managed `profiles` row is authoritative for active status and role. Roles are `super_admin`, `city_admin` and `handler`; signup is disabled.
- **Tenancy:** Organizations contain cities. City administrators manage their assigned city. Events, handlers, venues, inventory and reimbursements are scoped through organization/city relationships.
- **Data security:** PostgreSQL foreign keys, unique constraints, ID-generation triggers, guarded SECURITY DEFINER RPCs and RLS policies. Admin middleware redirects are a UI boundary; RLS remains the authorization boundary for database and storage data.
- **Files:** Private Supabase Storage for attendance evidence, receipts and documents. Attendance uses `getUserMedia` capture, not a file picker. The server-side RPC stamps attendance time. Location data is requested only for attendance verification.
- **Deployment:** Vercel-compatible Next.js build with Supabase Auth/PostgreSQL/Storage. Service-role access is server-only and used by trusted invitation/seeding code.

## Main route structure

```text
/                              Skillo entry page
/admin/login                  Admin email/password login
/handler/login                Handler email/password login
/forgot-password              Recovery email flow
/update-password              Password reset completion
/admin                        Live operations command center
/admin/calendar               Event schedule
/admin/events                 Search/filter event list
/admin/events/new             Event creation workflow
/admin/events/[eventId]       Assignment, checklist and event workspace
/admin/handlers               Handler directory
/admin/handlers/new           Auth invitation and profile provisioning
/admin/cities                 City workspaces
/admin/live-events            Live event health
/admin/attendance             Attendance register
/admin/expenses               Expense review
/admin/reports                Expense CSV export surface
/admin/notifications          Notifications addressed to admin
/admin/audit-log              Append-only audit records
/admin/clients                Clients
/admin/venues                 Venues
/admin/inventory              City inventory
/admin/settings               Organization identity
/handler                     Handler dashboard
/handler/events              Assigned event list
/handler/events/[eventId]    Assigned event workspace
/handler/check-in/[eventId]  Camera attendance capture
/handler/check-out/[eventId] Camera checkout capture
/handler/checklist           Assigned event tasks
/handler/expenses            Handler expense history
/handler/expenses/new        Camera receipt and expense submission
/handler/notifications       Handler in-app updates
/handler/id-card             Digital ID and QR verification
/handler/profile             Current handler profile
/verify/[token]              Minimal public ID status verification
```

## Database and workflow

`0001_eventops.sql` creates organizations, profiles, events, assignments, attendance, checklist items, expenses, notifications, digital IDs, event timeline, audit logs, RLS policies, private buckets, and guarded workflow RPCs. `0002_skillo_cities.sql` adds role and city tenancy, clients, activities, venues, inventory, reimbursement tracking, checklist templates, city-scoped identifiers, city-aware RLS and expense review/submit workflow. `0003_public_id_verification.sql` adds a minimal public QR verification function.

Key data flow:

1. An administrator creates an event; the database assigns a city event code and seeds its checklist from templates.
2. An administrator invites/provisions handlers and assigns eligible handlers; the handler sees assigned events under RLS.
3. During an active event, the handler captures attendance from the camera. A SECURITY DEFINER RPC verifies the current user, assignment, uploaded private photo path and event state, then stamps the authoritative time and logs timeline activity.
4. Assigned checklist tasks are completed through an authorization-checked RPC. Expenses are submitted with a private receipt path and linked to reimbursement tracking.
5. An authorized city or super admin reviews expense submissions through a guarded RPC; triggers maintain reimbursement summaries, notifications, timeline/audit records.

## Component boundaries

- `components/portal-shell.tsx`: role navigation, account identity and sign-out.
- `components/admin-section.tsx`: shared filtered operational register surfaces and CSV export.
- `components/handler-section.tsx`: account-scoped checklist, notifications, identity card and profile views.
- `components/event-create-form.tsx`, `components/event-detail.tsx`: persisted event creation, assignment and event operations.
- `components/camera-check-in.tsx`, `components/expense-form.tsx`: camera capture and secure evidence submission.
- `lib/services/events.ts`: validated RLS-backed event read/write boundary.
- `app/api/admin/handlers/route.ts`: authenticated admin invitation using server-only Auth Admin API.

## Implementation status and limitations

Implemented pages use Supabase reads/mutations where connected and show setup or empty states when data is unavailable. Not every requested enterprise capability is complete: organization settings are read-only, reports currently export expense records, notifications are in-app only, city/client/venue/inventory modules are read surfaces, and broad event-photo/document workflows are not complete. Migrations and RLS have not been executed against a live Supabase project in this workspace. Build success does not certify deployed database policies, camera permissions, invite delivery or real-world attendance behavior.
