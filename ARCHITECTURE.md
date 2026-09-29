# EventOps architecture and implementation plan

## Product architecture
- **Web:** Next.js App Router, TypeScript, Tailwind, Lucide. Desktop-first admin workspace and mobile-first handler workspace share a design system, not navigation or authorization.
- **Identity:** Supabase Auth email/password + server-side profile lookup. `profiles.role` is the source of truth; middleware refreshes sessions and protected server layouts enforce role. Client route hiding is only presentation.
- **Data:** Supabase Postgres with organization-scoped foreign keys, constraints, indexes, immutable audit/timeline triggers, and RLS. Every user belongs to an organization; handlers can read only their own profile and events reached through an active assignment.
- **Files:** private Supabase Storage buckets (`attendance`, `receipts`, `documents`), short-lived signed URLs, MIME/size limits. Attendance photos are camera-captured in browser and uploaded to private storage; database RPC stamps authoritative server time and derives attendance state.
- **Deployment:** Vercel for Next.js; Supabase for Auth/Postgres/Storage. Keep service role key server-only. Apply SQL migrations before inviting users.

## Route map
- `/login`, `/forgot-password`, `/verify/[token]`
- `/admin` command center; `/admin/calendar`, `/admin/events`, `/admin/events/[id]`, `/admin/handlers`, `/admin/live`, `/admin/attendance`, `/admin/expenses`, `/admin/reports`, `/admin/notifications`, `/admin/settings`
- `/handler` dashboard; `/handler/events`, `/handler/events/[id]`, `/handler/check-in/[eventId]`, `/handler/tasks`, `/handler/expenses`, `/handler/notifications`, `/handler/id`
- `/api/attendance/[eventId]` server-validated camera evidence submission; `/api/expenses`, `/api/events`, `/api/handlers` protected server actions/handlers.

## Core schema
See `supabase/migrations/0001_eventops.sql` for the executable schema, indexes, private storage setup guidance, helper functions, RLS, and attendance RPC. Entities include organizations, profiles, events, assignments, attendance, checklist items, expenses, notifications, IDs, timeline, and audit log.

## Build sequence
1. Foundation, visual system, demo command center and role-specific navigation.
2. Supabase session utilities, middleware, auth pages, server-side role boundaries.
3. Organization data model, RLS, private file buckets and seed fixtures.
4. Event authoring, assignment notifications, handler event workspace and checklist.
5. Camera check-in/out RPC + storage upload, review fallback, timeline.
6. Expense submission/review, operational health, reports, search and settings.
7. Accessibility, responsive QA, production build, Vercel/Supabase deployment.

## Current implementation status
The visual system, responsive admin command center, role switcher demo, navigation surfaces and Supabase schema/security foundations are implemented. Demo metrics are illustrative in the no-credentials preview; they are not presented as live database state. The schema and architecture provide the secure foundation for connecting the workflow pages. Set Supabase credentials and apply the migration before production use.
