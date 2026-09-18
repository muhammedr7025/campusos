# CampusOS

Multi-tenant, white-label institute operations platform — lead → follow-up → admission (KYC) → fees → academics (timetable/attendance/assignments), across six role-based portals (Super Admin, Finance, Counselor/CRM, Admission Officer, Teacher, Student/Parent).

Built from [`docs/Institute-Management-Platform-PRD.md`](docs/Institute-Management-Platform-PRD.md) and [`docs/Dev-Build-Prompt-Institute-Platform.md`](docs/Dev-Build-Prompt-Institute-Platform.md).

## Stack

Next.js 16 (App Router, TypeScript strict) · shadcn/ui (Radix-nova) + Tailwind v4 · React Hook Form + Zod · TanStack Table v8 · Recharts · Auth.js v5 (Credentials + JWT) · Prisma 7 + PostgreSQL · `sonner` toasts · `next-themes` dark mode · `cmdk` command palette.

## Getting started

1. **Database** — needs a local Postgres. Two options:
   - `docker compose up -d db` (uses `docker-compose.yml`, matches the `.env` default), **or**
   - Point `DATABASE_URL` in `.env` at any Postgres instance you already have (e.g. `brew services start postgresql@16`), and create a matching role/database.
2. **Install deps**: `npm install`
3. **Migrate + seed**:
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```
   Seeds two demo tenants (`acme` and `nova`) with distinct branding, one user per role in each, and a small sample dataset (batch/course/division, a converted lead → student with KYC + fee plan + a logged payment).
4. **Run**: `npm run dev` → http://localhost:3000

## Multi-tenant access in dev

Tenants are resolved by subdomain. Modern browsers resolve `*.localhost` to loopback, so:

- **Acme Institute**: http://acme.localhost:3000
- **Nova Learning Academy**: http://nova.localhost:3000

If your browser/tooling doesn't support that, append `?tenant=acme` once — it's saved to a cookie for subsequent requests.

**Seeded logins** (same pattern for both tenants, password `password123`):

| Role | Email (acme) | Email (nova) |
|---|---|---|
| Super Admin | admin@acme.test | admin@nova.test |
| Finance | finance@acme.test | finance@nova.test |
| Counselor | counselor@acme.test | counselor@nova.test |
| Admission Officer | admissions@acme.test | admissions@nova.test |
| Teacher | teacher@acme.test | teacher@nova.test |
| Student | student@acme.test | student@nova.test |
| Parent | parent@acme.test | parent@nova.test |

## Project structure

- `app/{admin,finance,crm,admissions,teacher,portal}/` — one literal URL-prefixed folder per role (not Next.js route groups — see note below), each behind `proxy.ts` role gating.
- `app/(auth)/login` — the one real route group, kept parenthesized so `/login` has no prefix.
- `lib/rbac/` — `permissions.ts` (config-table RBAC, edge-safe), `guard.ts` (`requireRole`/`requirePermission`, the layer that actually enforces access).
- `lib/tenant.ts` + `proxy.ts` — tenant resolution; every query goes through `getTenantId()`.
- `lib/storage/`, `lib/notifications/` — provider-agnostic interfaces (local filesystem / in-app DB are the only real V1 implementations; swap in S3/R2/SMS/WhatsApp later without touching call sites).
- `lib/fees/balance.ts` — fee balance is always derived (`total − Σpayments`), never a stored editable field.
- `prisma/schema.prisma` — full data model; `prisma/seed.ts` — demo data.

**Why plain folders instead of Next.js route groups for the six portals:** `(admin)/dashboard` and `(finance)/dashboard` are both route groups, which are transparent to the URL — they'd collide at the same `/dashboard` path. Real folders (`admin/`, `finance/`, …) give each portal its own URL prefix, which is what the middleware and nav links assume throughout.

## Known V1 scope decisions

- **No payment gateway, LMS, biometric attendance, exam/report cards, or alumni module** — explicit non-goals per the dev prompt.
- **SMS/WhatsApp notifications**: stubbed via the `NotificationProvider` interface; only the in-app (DB-backed) implementation is wired up, per the PRD's note that this is a client budget decision.
- **Time-based notification triggers** (fee due/overdue, follow-up due, KYC pending, assignment due soon) run from `lib/notifications/scheduled.ts`: opportunistically at most once an hour per institute whenever someone uses the app, and on demand via `POST /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` — point a cron job at it for punctual delivery. Every reminder is deduplicated, so running it often is safe. Event-triggered notifications (assignment posted/graded, attendance drop, exam result) fire immediately.
- **Receipts**: every payment gets a sequential receipt number (`RCP-0001`) and a printable receipt at `/receipts/<paymentId>` — linked from the ledger, the student's fee page and the family's portal; `?print=1` opens the print dialog on load.
- **Late fees** are derived from the fee structure's rule (flat per overdue installment, or a percentage of the overdue amount, after the grace period) every time a balance is shown — never stored.
- **Deploying**: the container runs `prisma migrate deploy` before `next start`, so the schema is always current when the app comes up.
- **Portal account provisioning**: student/parent accounts are created automatically at admission with a generated temp password shown once in the UI (no email/SMS delivery wired up yet — swap in a real provider before production use).
