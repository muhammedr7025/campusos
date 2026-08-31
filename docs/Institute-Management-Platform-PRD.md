# Product Requirements Document
## Institute Management Platform (working name: "CampusOS" — replace with final brand)

**Version:** 1.0 (Draft)
**Prepared for:** Educational Institute Client
**Document owner:** Product
**Status:** Draft for stakeholder review

---

## 1. Executive Summary

This platform replaces the spreadsheet-and-WhatsApp operating model most small-to-mid-size institutes run on today with a single system of record that covers the full student lifecycle: **lead → follow-up → admission → fees → academics → attendance → assignments**, viewed through six distinct role-based experiences (Admin, Finance, Counselor/CRM, Admission Officer, Teacher, Student/Parent).

The core insight that shapes this PRD: **the student record is the spine of the product.** A lead, once converted, doesn't become a "new" record in the Admissions module — it becomes the same entity, now enrolled, that Finance bills, Teachers mark attendance for, and Parents view. If lead data, admission data, and academic data live in three disconnected tables, the institute ends up rebuilding the spreadsheet problem inside a database. Every module below is designed around that single-entity principle.

---

## 2. Problem Statement

Institutes at this scale (a few hundred to a few thousand students, multiple courses/batches, a small admin+counseling+finance team) typically run on:
- Excel for fee tracking → no accountability, no audit trail, easy to lose pending-fee visibility
- WhatsApp/notebooks for lead follow-up → leads go cold, no ownership, no funnel visibility
- Paper KYC files → admission data never reaches academics or finance cleanly
- No parent visibility → constant phone calls asking "did my child submit the assignment / what's pending fee"
- Teachers manually taking attendance on paper → delayed, error-prone, not visible to parents in real time

**The cost of this**: leads leak out of the funnel, fee collection is reactive instead of proactive, and parents (who are the paying customer) have zero visibility, which erodes trust and referrals — the primary growth channel for most institutes.

---

## 3. Goals & Success Metrics

| Goal | Metric | Target (6 months post-launch) |
|---|---|---|
| Reduce lead leakage | Lead → admission conversion rate | Baseline + 15–20% |
| Improve fee collection | % fees collected within due date | ≥ 85% |
| Reduce finance overhead | Time spent reconciling fees/month | −60% vs. spreadsheet baseline |
| Improve parent trust/retention | Parent portal weekly active usage | ≥ 60% of parents |
| Reduce teacher admin load | Time to mark attendance for a class | < 60 seconds |
| Data integrity | Duplicate/orphaned student records | 0 |

---

## 4. User Roles & Personas

| # | Role | Who they are | Primary jobs-to-be-done |
|---|---|---|---|
| 1 | **Super Admin** | Institute owner/director | Full visibility, configures batches/courses/divisions, manages all users, sees consolidated dashboards |
| 2 | **Branch/Center Admin** *(if multi-branch)* | Center-in-charge | Same as Super Admin but scoped to their branch |
| 3 | **Finance User** | Accountant | Defines fee structure, logs payments, tracks dues, sends reminders, issues receipts |
| 4 | **Counselor (CRM/Lead)** | Front-desk/sales counselor | Captures leads, does follow-ups, moves leads through pipeline, hands off qualified leads to Admissions |
| 5 | **Admission Officer** | Admissions desk | Collects KYC, finalizes course/batch/division mapping, converts lead → enrolled student |
| 6 | **Teacher** | Faculty | Views timetable, marks attendance, creates/grades assignments, records marks |
| 7 | **Student** | Enrolled learner | Views timetable, attendance %, assignments, submits work, sees fee status |
| 8 | **Parent** | Guardian | Views child's attendance, assignments, fee status, receives notifications |

> **Open question for client**: Is this single-branch or does the institute (or Exatech's future customers) operate multiple branches/centers? This materially changes the data model (branch as a top-level scoping entity) and should be locked before backend design starts — retrofitting multi-branch later is expensive.

---

## 5. Scope

### In scope (V1)
- Academic structure setup (batches, courses, divisions)
- Fee structure + finance/payment logging + dues tracking
- Lead capture + follow-up + pipeline (CRM)
- Admission workflow (KYC + conversion + onboarding)
- Attendance (teacher-marked, student/parent visible)
- Assignments (teacher creates/grades, student submits)
- Timetable (admin/teacher managed, all roles view)
- Role-based dashboards for all 6 roles
- Notifications (in-app minimum; SMS/WhatsApp/email as stretch — see §11)

### Out of scope (V1) — candidates for Phase 2+
- Online payment gateway integration (V1 can be manual logging by Finance; gateway is a fast-follow)
- Learning content delivery / LMS (video lessons, quizzes) — this is an *operations* platform, not an LMS, unless the client explicitly wants one
- Biometric/RFID attendance hardware integration
- Multi-branch/franchise management
- Exam/report card generation with custom templates
- Alumni management
- Transport/hostel management

---

## 6. Functional Requirements by Module

### 6.1 Admin: Academic Structure Management

**User stories:**
- As a Super Admin, I want to create a batch (e.g. "2025-26", "2025-27") so that all courses and enrollments for that academic cycle are grouped correctly.
- As a Super Admin, I want to create courses under a batch (e.g. "NEET Foundation", "Spoken English") so that fee structures, timetables, and enrollments attach to the right course.
- As a Super Admin, I want to create divisions/sections within a course (e.g. "Batch A – Morning", "Batch B – Evening") so that class sizes stay manageable and teachers/timetables map correctly.
- As a Super Admin, I want to set capacity limits per division so the system warns me (or blocks admission) when a division is full.

**Key behaviors:**
- Batch → Course → Division is a strict hierarchy; a division cannot exist without a parent course, a course cannot exist without a parent batch.
- Batches have a start/end academic year and a status (Upcoming / Active / Archived). Archiving a batch should not delete data — it should freeze it (read-only) while keeping it queryable for records/reports.
- Courses carry: name, duration, description, default fee structure link, subject list (feeds into timetable/assignments later).
- Reassigning a student between divisions (e.g. moving sections) must preserve their attendance/assignment history — this is a common request and breaks naive implementations.

**Acceptance criteria:**
- Creating a batch/course/division takes < 5 fields and < 1 minute
- Deleting a course/division with active enrollments is blocked with a clear error, not a silent failure
- Batch/course/division changes are logged in the audit trail (who, when, what changed)

---

### 6.2 Fees & Finance Management

**User stories:**
- As a Finance user, I want to define a fee structure per course (total fee, installment plan, due dates, late fee rules) so that every student in that course is billed consistently.
- As a Finance user, I want to log a payment against a specific student and installment so that the system automatically updates their pending balance.
- As a Finance user, I want a dashboard of who has paid, who's pending, and who's overdue, filterable by course/batch/division, so I can prioritize follow-up.
- As a Finance user, I want to generate/print a receipt for every payment logged.
- As a Student/Parent, I want to see my fee status (paid, pending, next due date, amount) without calling the office.
- As a Counselor/Admission Officer, I want to apply a one-off discount or scholarship to a specific student's fee plan (with approval) so exceptions don't require going around the system.

**Key behaviors:**
- Fee structures support: one-time, installment-based (e.g. 3 installments with individual due dates), and course-level vs. custom (per-student override with reason + approver logged).
- Every payment log entry requires: amount, mode (cash/UPI/bank transfer/cheque), date, collected-by (auto-filled from logged-in Finance user), and optional note. This is the accountability trail the client explicitly asked for.
- Pending/overdue status should be computed, not manually set — derived from (fee structure − sum of logged payments) vs. today's date.
- Automated reminders (in-app + notification channel) at configurable intervals before/after due date.

**Acceptance criteria:**
- Fee balance for any student is always (structure total − sum of verified payments); no manual override of the *balance* field itself, only of the *structure*
- Every payment entry is immutable once logged (edits create a correction entry, not an overwrite) — this matters for audit/accountability, which was explicitly requested
- Finance dashboard loads course-wise pending totals in under 2 seconds for a few thousand students

---

### 6.3 Lead Management & CRM

**User stories:**
- As a Counselor, I want to capture a lead (name, phone, source, interested course) quickly — from a walk-in, phone call, or web form — so no inquiry is lost.
- As a Counselor, I want to schedule and log follow-ups (call, WhatsApp, visit) against a lead so I know who to contact and when.
- As a Counselor, I want a pipeline view (New → Contacted → Interested → Follow-up → Converted / Lost) so I can see funnel health at a glance.
- As a Super Admin, I want to see lead source performance (which channel converts best) so I can allocate marketing spend better.
- As a Counselor, I want to mark a lead "Lost" with a reason (price, location, timing, competitor) so we can analyze drop-off causes later.

**Key behaviors:**
- Leads support multiple follow-up entries over time (a timeline, not a single "next follow-up date" field) — this is what makes follow-up *management* rather than a to-do list.
- Overdue follow-ups (no activity logged past the scheduled date) should surface prominently — this is the #1 cause of lead leakage the client is trying to solve.
- Lead ownership: leads can be assigned to a specific counselor; reassignment should preserve history.
- Conversion is a status transition, not a data re-entry event — see 6.4.

**Acceptance criteria:**
- A counselor can log a follow-up in under 3 taps/clicks
- Pipeline view is filterable by counselor, source, course interest, and date range
- Converting a lead pre-fills the Admission module with all captured lead data (name, phone, course interest) — zero re-typing

---

### 6.4 Admissions & Onboarding

**User stories:**
- As an Admission Officer, when a lead is marked "ready to convert," I want to collect KYC documents (ID proof, previous marksheets, photo, address proof) so the enrollment is compliant.
- As an Admission Officer, I want to confirm the final course, batch, and division for the student (which may differ from the lead's original "interested course") so enrollment is accurate.
- As an Admission Officer, I want the system to auto-generate the fee plan for the assigned course upon conversion, which Finance can then adjust if needed.
- As an Admission Officer, I want to generate a unique student ID / enrollment number automatically upon conversion.

**Key behaviors:**
- This is the critical seam of the whole product: **Lead entity → Student entity is a conversion, not a copy.** The same underlying person record should carry a `lead_history` reference forward so nothing is lost, but from this point on the system treats them as a Student for attendance/academics/fees purposes.
- KYC documents are uploaded files with a checklist status (required docs pending vs. complete) — Admission Officer dashboard should show "students admitted but KYC incomplete" as a follow-up queue of its own.
- Parent/guardian contact details captured here become the parent portal login.

**Acceptance criteria:**
- Conversion flow (lead → enrolled student) completes in a single guided workflow, not scattered across modules
- A student cannot be marked "fully admitted" with mandatory KYC docs missing (configurable which docs are mandatory)
- Parent portal invite (SMS/email with login link) is triggered automatically on successful admission

---

### 6.5 Student Portal

**User stories:**
- As a Student, I want to see my timetable so I know what class is next.
- As a Student, I want to see my attendance percentage (overall and subject-wise) so I can track it against any minimum-attendance requirement.
- As a Student, I want to see assignments due, submit my work (file upload/text), and see my grade/feedback once graded.
- As a Student, I want to see my fee status.

**Acceptance criteria:**
- Assignment submission supports file upload with a clear due-date/late-submission indicator
- Attendance % updates same-day as the class is marked by the teacher
- Portal works acceptably on low-end Android devices and slow connections (important for this segment)

---

### 6.6 Parent Portal

**User stories:**
- As a Parent, I want a read-only view of my child's attendance, assignment status, and fee dues so I don't need to call the institute for routine updates.
- As a Parent, I want to receive a notification when attendance drops below a threshold, an assignment is missed, or a fee is overdue.
- As a Parent with multiple children at the same institute, I want to switch between their profiles from one login.

**Acceptance criteria:**
- Parent accounts are linked to student(s) via the Admission record, not a separate manual linking step
- Notification thresholds (attendance %, days-before-due for fees) are configurable by Admin

---

### 6.7 Teacher Module

**User stories:**
- As a Teacher, I want to see my timetable (which division, subject, time, room) so I know my schedule.
- As a Teacher, I want to mark attendance for a class in one screen (roster with present/absent/late toggle) in under a minute.
- As a Teacher, I want to create an assignment (title, description, attachment, due date) for a specific division/subject.
- As a Teacher, I want to view and grade submitted assignments, with a grade + feedback field.
- As a Teacher, I want to record test/exam marks per student (optional for V1 depending on scope decision — see open questions).

**Acceptance criteria:**
- Attendance marking supports "mark all present, then flag exceptions" for speed
- Assignment grading view shows submission status (submitted/late/missing) at a glance across the whole division
- Timetable conflicts (double-booking a teacher) are flagged at creation time by Admin

---

### 6.8 Notifications & Communication

- Fee due/overdue reminders (Finance → Student/Parent)
- Follow-up reminders (system → Counselor)
- KYC-pending reminders (system → Admission Officer)
- Attendance-drop alerts (system → Parent)
- Assignment posted/due-soon/graded (system → Student/Parent)
- Channel strategy: in-app + push notification as baseline for V1; SMS/WhatsApp Business API as a configurable add-on (cost-per-message, so this should be an explicit client decision, not assumed)

---

### 6.9 Reports & Dashboards

| Role | Key dashboard views |
|---|---|
| Super Admin | Enrollment trend, revenue vs. pending fees, lead-to-admission conversion rate, attendance trend across institute |
| Finance | Collection vs. target, overdue list, course-wise revenue |
| Counselor | Personal pipeline, follow-ups due today, conversion rate |
| Admission Officer | Pending KYC queue, recent admissions |
| Teacher | Class-wise attendance %, assignment completion rate |

---

### 6.10 Roles, Permissions & Audit

- Full role-based access control (RBAC): every module above must enforce that (e.g.) a Teacher cannot see fee data, a Counselor cannot edit attendance, etc. — permission matrix should be a config table, not hardcoded, so the client can adjust as their team structure evolves.
- **Audit log** on all financially or academically sensitive actions: fee payment logged/edited, KYC document uploaded/verified, attendance marked/edited after the fact, division reassignment. Captures who + when + what changed. This directly answers the "accountability" requirement in the fees module.

---

## 7. Key User Flows (narrative)

**Flow A — Lead to Enrolled Student:**
Lead captured (walk-in/call/web) → Counselor logs follow-ups over time → Lead marked "Interested/Ready" → Handed to Admission Officer → KYC collected → Course/batch/division confirmed → Fee plan generated → Student ID issued → Parent portal invite sent → Student appears in Teacher's roster for their division.

**Flow B — Fee Collection Cycle:**
Admin sets fee structure for a course → Auto-applied to every student admitted into that course → Finance logs payments as received → System recalculates pending balance in real time → Reminders fire automatically as due dates approach → Overdue students surface on Finance dashboard → Parent sees updated status instantly in portal.

**Flow C — Daily Academic Loop:**
Admin sets timetable → Teacher opens today's class → Marks attendance (1 screen) → Attendance instantly visible to Student/Parent → Teacher posts assignment with due date → Student submits → Teacher grades → Student/Parent notified of grade.

---

## 8. High-Level Data Model (key entities)

`Batch → Course → Division` (academic hierarchy)
`Lead` (with follow-up timeline, source, status) → converts into → `Student`
`Student` ↔ `Parent/Guardian` (many-to-many, since siblings share a parent)
`Student` ↔ `Division` (enrollment, with history if reassigned)
`FeeStructure` (per course) → `FeePlan` (per student, may override structure) → `Payment` (immutable log entries)
`Timetable` (Division + Subject + Teacher + Slot)
`Attendance` (Student + Date + Subject + Status)
`Assignment` (Division + Subject + Teacher) → `Submission` (Student + File/Text + Grade)
`AuditLog` (Actor + Action + Entity + Timestamp + Diff)
`User` (all roles, with RBAC permission set)

---

## 9. Non-Functional Requirements

- **Security & compliance**: Student/parent PII and payment data — encrypt sensitive fields at rest, HTTPS everywhere, role-scoped API access. If this platform will eventually handle payment gateway data, plan for PCI-relevant handling (even if V1 logs payments manually rather than processing them). Consider India's DPDP Act (Digital Personal Data Protection Act) implications for storing minors' data — parental consent flows may be relevant since students are often minors.
- **Performance**: Attendance marking and fee dashboards should feel instant (< 2s) even at a few thousand student records.
- **Offline tolerance**: Teachers marking attendance in low-connectivity classrooms — consider offline-first capture with sync, at least for the attendance-marking screen.
- **Scalability**: Even if V1 is single-branch, model `branch_id` as a scoping field from day one — it's cheap to add now, expensive to retrofit.
- **Auditability**: Every financially or academically consequential write is logged (see 6.10).
- **Device reality**: Parents/students in this segment skew toward Android, often budget devices — portal must be lightweight.

---

## 10. Technical Recommendation

Given the direction already set — **Flutter for the frontend** (single codebase for Student/Parent mobile app + potentially Admin/Teacher web via Flutter Web) — a few notes as you finalize backend:

- **Supabase vs. custom backend**: Supabase (Postgres + Auth + Row-Level Security + Storage) is a strong fit *if* the RBAC model above can be expressed cleanly in Postgres RLS policies — which it generally can for role-scoped data like this. It gets you auth, file storage (for KYC docs/assignment attachments), and realtime (useful for "attendance just got marked, parent sees it instantly") out of the box, which meaningfully cuts V1 build time versus a custom backend.
- Where a custom backend (e.g. a dedicated Node/Django/NestJS service in front of Postgres) starts to win: if you anticipate complex fee-calculation business logic (installment schedules, late-fee rules, discount approval chains) that's awkward to express as database policies/triggers, or if this platform is meant to become a **multi-tenant product sold to other institutes** (not just this one client) — multi-tenancy, billing, and tenant isolation are easier to reason about in an application layer you control.
- Practical middle ground many teams in this exact position land on: **Supabase as the backend, with a thin serverless function layer (Supabase Edge Functions) for the business-logic-heavy bits** (fee recalculation, conversion workflow, notification triggers) — you get the speed of Supabase without forcing complex logic into RLS/triggers.

---

## 11. MVP Scope & Phased Roadmap

**Phase 1 (MVP) — get one institute fully operational:**
Batches/Courses/Divisions · Fee structure + manual payment logging + dues dashboard · Lead capture + follow-up + pipeline · Admission + KYC + conversion · Attendance (teacher-marked) · Timetable (admin-set, all roles view) · Assignments (create/submit/grade) · Student & Parent portal (read + submit) · In-app notifications · Core RBAC + audit log

**Phase 2:**
Payment gateway integration (online fee payment) · SMS/WhatsApp notification channel · Marks/exam module + report cards · Richer analytics dashboards · Offline-first attendance

**Phase 3 (if this becomes a resellable product):**
Multi-branch/multi-tenant architecture · Billing/subscription layer for other institutes · White-labeling · Alumni module · LMS/content delivery

---

## 12. Assumptions & Open Questions

These need client sign-off before backend/data-model lock:

1. **Single institute vs. resellable product** — is this being built solely for the friend's institute, or is Exatech building a product to later sell to other institutes too? This changes whether multi-tenancy is designed in from day one.
2. **Single branch or multiple centers?**
3. Does the institute need **exam/marks/report cards** in V1, or is that explicitly Phase 2?
4. Online payment gateway in V1, or is manual Finance logging acceptable at launch?
5. SMS/WhatsApp notifications — budget for per-message cost, or in-app/push only for V1?
6. Who approves fee discounts/scholarships — is there an approval workflow needed, or does Finance have full discretion?
7. Any regulatory/board-specific reporting requirements (e.g. affiliation body attendance reporting) that need to be baked into the data model?

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Lead/Student data modeled as two separate entities, causing duplication and broken history on conversion | Design the conversion flow explicitly as a status/entity transition (see §6.4), not a re-entry form |
| Fee balance drifts from reality due to manual overrides | Balance is always derived from structure − payments; never a directly editable field |
| Teachers abandon the app if attendance marking is slow | Enforce the "mark all present, flag exceptions" pattern as a hard UX requirement, test on low-end Android |
| Scope creep toward a full LMS | Explicitly fence "assignments = submission + grading," not content delivery, unless client requests otherwise |
| Multi-branch/multi-tenant need discovered post-launch | Lock the branch-scoping and reseller questions (§12, items 1–2) before backend build starts |

---

## 14. Appendix: Glossary

- **Batch**: An academic year cohort (e.g. "2025-26")
- **Division**: A section/class-group within a course (e.g. "Morning Batch A")
- **Lead**: A prospective student inquiry, pre-enrollment
- **KYC**: Know Your Customer — identity/eligibility documents collected at admission
- **RBAC**: Role-Based Access Control
