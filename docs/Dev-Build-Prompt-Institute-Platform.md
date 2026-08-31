# Build Prompt: Institute Management Platform

> Paste this into your AI coding tool (Claude Code, Cursor, etc.) as the project brief. It's written as a direct instruction set, not a PRD — the PRD it's derived from covers the *why*; this covers the *build*.

---

## 1. What you're building

A multi-tenant, white-label **institute operations platform** covering the full student lifecycle: lead capture → follow-up → admission (KYC) → fees → academics (timetable/attendance/assignments), served through six role-based experiences: **Super Admin, Finance, Counselor (CRM), Admission Officer, Teacher, Student/Parent**.

This is an internal-operations product, not an LMS — no video/content delivery. Focus on workflow speed (e.g., attendance marking in under a minute) and data integrity (a lead becomes a student via a status transition, never a duplicate record).

---

## 2. Tech stack (fixed)

- **Framework:** Next.js 14+, App Router, TypeScript strict mode
- **UI:** shadcn/ui ("new-york" style) + Tailwind CSS
- **Icons:** lucide-react (ships with shadcn)
- **Forms:** React Hook Form + Zod resolvers
- **Data tables:** TanStack Table (shadcn's data-table pattern)
- **Charts:** Recharts, wrapped in shadcn `Card`
- **Auth:** Auth.js (NextAuth) with credentials + role claims, or Clerk if the client wants managed auth — default to Auth.js unless told otherwise
- **ORM/DB:** Prisma + PostgreSQL (Neon or Supabase-as-Postgres-only — do not assume Supabase Auth/RLS given the stack change to Next.js-native auth)
- **File storage:** S3-compatible (Supabase Storage, UploadThing, or Cloudflare R2) for KYC docs and assignment attachments
- **State/data fetching:** Server Components + Server Actions as the default; React Query only where client-side interactivity needs it (e.g. live-updating dashboards)
- **Notifications:** in-app (DB-backed) + toast via `sonner`; SMS/WhatsApp as a pluggable provider interface (see §6), not hardwired
- **Animation:** Framer Motion, used sparingly for polish (page transitions, state changes) — not decorative
- **Dark mode:** `next-themes`, toggle available on all portals

Do not substitute the UI/data-table/form stack — the "awesome UI" requirement depends on shadcn's composability and TanStack Table's density-handling for the fee/lead/student lists, which is where most of this product's screen time lives.

---

## 3. White-label / multi-tenant system — build this first, not last

Every visual surface must resolve its branding from a `Tenant` config, not hardcoded values. This is the single most important architectural decision in this build — retrofitting it later means re-touching every component.

**How:**
1. `Tenant` table: `id, name, subdomain/customDomain, logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, fontFamily (optional)`.
2. Map tenant colors to **CSS custom properties** at the root layout (`:root { --primary: ...; --secondary: ...; }`), and configure `tailwind.config.ts` so shadcn's theme tokens (`--primary`, `--radius`, etc.) read from those CSS vars instead of static hex values. shadcn is built for exactly this — don't fight it with per-component overrides.
3. Tenant resolution: middleware reads subdomain (`{tenant}.yourdomain.com`) or custom domain mapping, injects `tenantId` into the request context server-side, and every Server Action/query is scoped by it. No cross-tenant query should be *possible* to write, not just policy-forbidden — scope it at the data-access layer (a `getTenantId()` helper every query must call).
4. Logo/favicon/app name pull from tenant config at layout level, so a white-labeled deployment needs zero code changes — only a config row.
5. Build an internal **Tenant Settings** screen (Super Admin only) to edit branding live with a preview pane.

---

## 4. Information architecture / route structure

```
app/
  (auth)/
    login/
    onboarding/            # tenant setup wizard for new institutes, if reselling
  (admin)/
    dashboard/
    batches/                # batch → course → division CRUD
    courses/
    divisions/
    users/                  # manage all role accounts
    settings/branding/       # white-label config (see §3)
    reports/
  (finance)/
    dashboard/
    fee-structures/
    payments/                # log payment, view ledger
    dues/                     # overdue/pending queue
  (crm)/
    leads/                   # pipeline (kanban + table view toggle)
    leads/[id]/               # follow-up timeline
  (admissions)/
    pending-kyc/
    convert/[leadId]/          # guided lead → student conversion flow
    students/
  (teacher)/
    timetable/
    attendance/[divisionId]/    # roster with present/absent/late
    assignments/
    assignments/[id]/submissions/
  (portal)/                   # student + parent, shared shell, role-gated content
    dashboard/
    attendance/
    assignments/
    assignments/[id]/submit/
    fees/
  api/
    webhooks/…                 # payment gateway, SMS provider, etc. (Phase 2 stubs)
```

Use **route groups per role** as shown — each gets its own layout with role-scoped nav, and middleware enforces that a session's role matches the route group (Finance user hitting `/admin/*` → redirect, not just hide the link).

---

## 5. Data model (Prisma schema — starting point)

Build this as the initial migration; extend as modules are implemented. Do not skip `tenantId` on any table — it's the multi-tenant boundary.

Core entities, each scoped by `tenantId`:
`Tenant`, `User` (role enum: SUPER_ADMIN, FINANCE, COUNSELOR, ADMISSION_OFFICER, TEACHER, STUDENT, PARENT), `Batch`, `Course`, `Division`, `Lead` (+ `FollowUp[]`), `Student` (references `convertedFromLeadId`, nullable), `ParentGuardian` (many-to-many with `Student` via join table — siblings share a parent), `FeeStructure`, `FeePlan` (per-student, may override structure — store `overrideReason`, `approvedBy`), `Payment` (immutable — corrections are new rows referencing the original, never an UPDATE on amount), `Timetable`, `Attendance` (`Student + Date + Subject + Status`), `Assignment`, `Submission` (+ grade/feedback), `AuditLog` (`actorId, action, entityType, entityId, diff (jsonb), createdAt`).

**Non-negotiable constraints:**
- `Payment` rows are append-only. A student's fee balance is *computed* (`FeePlan.total − SUM(Payment.amount)`), never stored as an editable field.
- Converting a `Lead` to a `Student` sets `Student.convertedFromLeadId` and copies contact data — it does not create an orphaned duplicate. The `Lead`'s follow-up history stays queryable from the `Student` record.
- Every write to `Payment`, `Attendance` (after the marking day), `FeePlan` overrides, and KYC document verification status must also write an `AuditLog` row in the same transaction.

---

## 6. Notification architecture

Build a provider-agnostic interface (`NotificationProvider` with `send(type, recipient, payload)`) with an in-app implementation as the default and stub adapters for SMS/WhatsApp so a provider can be plugged in later without touching call sites. Trigger points: fee due/overdue, follow-up due, KYC pending, attendance-drop threshold, assignment posted/due/graded.

---

## 7. UI/UX direction ("awesome" — specifics, not vibes)

- Use shadcn's **data-table** pattern (sortable, filterable, paginated) for every list-heavy screen: leads, payments, students, dues. This is where Finance and Counselor roles live all day — density and speed matter more than decoration here.
- **Command palette** (`cmdk`, shadcn's `Command` component) for Admin/Finance/Counselor — quick-jump to a student, lead, or action. This is a genuine time-saver at a few hundred+ records and a strong "feels premium" signal.
- **Kanban + table toggle** for the lead pipeline (§(crm)/leads) — visual funnel for daily triage, table for bulk actions/export.
- **Skeleton loaders** (shadcn `Skeleton`) on every data-fetching view, never a blank screen or spinner-only state.
- **Empty states** with a clear next action (e.g. "No leads yet — Add your first lead") rather than a bare "No data."
- **Status as color-coded `Badge` components** consistently across the app: lead pipeline stage, fee status (paid/pending/overdue), KYC completeness, submission status.
- Attendance marking screen: single-screen roster, "mark all present" default with tap-to-flag exceptions, large touch targets — this is used on a phone in a classroom, optimize for thumbs not mice.
- Toast (`sonner`) for every mutation's success/error feedback — never a silent save.

---

## 8. Mobile responsiveness — explicit requirements

- Mobile-first Tailwind breakpoints throughout; test every screen at 375px width before desktop.
- Admin/Finance/Teacher sidebar nav collapses to a `Sheet` (drawer) below `md`.
- Student/Parent portal is the highest-traffic mobile surface — design it mobile-first, desktop as the adaptation, not the other way around.
- Data tables degrade to stacked card lists below `md` (shadcn data-table + a card-view fallback component) — a wide table with horizontal scroll on mobile is a failure state, not an acceptable fallback.
- Attendance marking and assignment submission must be fully usable one-handed on a phone.

---

## 9. Auth & RBAC

- Role stored on `User`, enforced in three layers: (1) middleware route-group gating, (2) server-action/query-level `requireRole()` guard, (3) UI hides actions the role can't perform. Layer 2 is the one that actually matters for security — 1 and 3 are UX.
- Permission matrix should live in a config object/table (`role → allowed actions`), not scattered `if (role === 'FINANCE')` checks — makes future role adjustments a config change, not a code change (matches the PRD's note that this evolves with the client's team structure).

---

## 10. Build order (suggested milestones)

1. **Foundation:** Next.js + shadcn scaffold, Prisma schema + migrations, tenant resolution middleware, CSS-var theming wired end to end (prove white-label works with two dummy tenants before building any feature)
2. **Auth + RBAC:** login, session, role-gated route groups
3. **Academic structure:** Batch/Course/Division CRUD (Admin)
4. **CRM:** Lead capture, follow-up timeline, pipeline view
5. **Admissions:** KYC upload, lead→student conversion flow
6. **Finance:** Fee structures, payment logging, dues dashboard, audit log wiring
7. **Teacher module:** Timetable (admin-set), attendance marking, assignments
8. **Student/Parent portal:** all read views + assignment submission
9. **Notifications:** in-app layer + trigger wiring
10. **Polish pass:** empty states, skeletons, mobile QA at 375px, command palette, dark mode

---

## 11. Explicit non-goals for this build

Do not build: payment gateway integration, LMS/content delivery, biometric attendance hardware hooks, exam/report-card templating, alumni module. These are Phase 2+ per the PRD — stub interfaces where it's cheap (e.g. the `NotificationProvider` pattern), but don't build the features themselves.
