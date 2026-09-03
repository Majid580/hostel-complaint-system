# Hostel Complaint Management System (HCMS) — System Architecture

> **Read this first in any new session.** Companion files:
> - `project-state.yml` — machine-readable current state (what is done / in progress / pending)
> - `docs/PROJECT_PROGRESS.md` — human-readable changelog + next actions
>
> Document version: **1.1** · Last updated: **2026-09-02**
>
> v1.1 reconciles this document with the code that now exists. Sections 8 and 8.1
> carry the real installed versions and the real folder layout; section 15 records
> where the implementation departed from the v1.0 design and why.

---

## 1. Purpose & Constraints

### 1.1 Problem statement
Students living in three campus hostels (**Girls Hostel**, **Qasim Hostel**, **Fatima Hostel**) have no
traceable way to report maintenance/facility problems. Complaints are made verbally, get lost, and
nobody is accountable for whether the work was actually done.

### 1.2 Goals
| # | Goal |
|---|------|
| G1 | Any student can file a complaint in under 60 seconds using their registration number, with photos + a voice note. |
| G2 | The complaint is instantly routed by e-mail to the **Resident Tutor (RT) of that hostel** and the **Hostel Warden**. |
| G3 | Every complaint has a **status**, a **severity**, an auto-computed **priority**, and a visible **age**. |
| G4 | RTs can assign real **workers** and move the complaint through its lifecycle. |
| G5 | Students see a **read-only** view of their complaints and the full timeline (transparency). |
| G6 | If nothing happens for **24 h**, the student can escalate directly to the **Warden**. |
| G7 | If an RT marks a complaint *Resolved* but the work is not actually done, the student can **flag a false resolution** to the Warden after 24 h. |
| G8 | Warden + Campus Coordinator get full cross-hostel visibility, analytics and accountability reports. |
| G9 | **Zero running cost.** No paid hosting, no paid database, no paid media storage, no paid e-mail. |

### 1.3 Hard constraints
- **Budget: PKR 0 / month.** Every component must have a permanent free tier.
- Must run on **Vercel Hobby** (free) + **MongoDB Atlas M0** (free).
- No native compile steps on the build server, so pure-JS dependencies only
  (`bcryptjs`, not `bcrypt`).
- Serverless: no long-running processes, no in-memory state between requests, no local disk writes.
- Vercel Hobby cron only fires **once per day**, so the scheduler is externalised (see 9.3).

---

## 2. Actors & Authorisation Model

### 2.1 Roles
| Role | Count | Scope | Capabilities |
|---|---|---|---|
| `STUDENT` | many | Own complaints only | Create complaint, read own complaints + timeline, comment, upvote same-hostel complaints, confirm/reopen resolution, escalate after 24 h, flag false resolution, rate the fix |
| `RT` (Resident Tutor) | 3 (one per hostel) | **Their own hostel only** | Everything a student sees for that hostel, plus acknowledge, set/override severity and category, assign worker, change status, add internal notes, reject with reason, manage that hostel's worker registry |
| `WARDEN` | 1 | **All three hostels** | Everything an RT can do in *any* hostel, plus receives all escalations and false-resolution flags, can reassign/override RT decisions, can force-reopen, sees accountability reports |
| `COORDINATOR` (Campus Coordinator) | 1 | **All three hostels + system admin** | Everything the Warden can do, plus user management (create/disable RT and warden accounts), system settings (SLA hours, escalation windows), audit-log access, data export |

`WARDEN` and `COORDINATOR` are both *global* roles; `COORDINATOR` additionally holds the admin
privileges. Permission checks are centralised in `src/lib/auth/permissions.ts` — never inline in a route.

### 2.2 Permission matrix (enforced server-side on every request)
```
canViewComplaint(user, c)    = STUDENT -> c.student.userId == user.id
                               RT      -> c.hostel == user.hostel
                               WARDEN / COORDINATOR -> true

canMutateComplaint(user, c)  = RT -> c.hostel == user.hostel ; WARDEN / COORDINATOR -> true
canManageUsers(user)         = role == COORDINATOR
canManageWorkers(user, h)    = RT -> h == user.hostel ; WARDEN / COORDINATOR -> true
canViewAnalytics(user, h)    = RT -> h == user.hostel ; WARDEN / COORDINATOR -> true
canSeeInternalNotes(user)    = role != STUDENT
```

### 2.3 Authentication
- **Students** self-register with `regNo` + institutional e-mail + password. `regNo` is the unique key.
- **Staff** accounts (3 RTs, 1 Warden, 1 Coordinator) are **seeded** by script, never self-registered.
  First login forces a password change (`mustChangePassword`).
- Stateless **JWT** (HS256, `jose`) in an **httpOnly, Secure, SameSite=Lax** cookie, 7-day expiry,
  sliding refresh. A `tokenVersion` counter on the user document allows instant global revocation.
- Passwords: `bcryptjs`, cost 10 (serverless-friendly).
- E-mail verification and password reset via 6-digit OTP with a 10-minute TTL (`otp_tokens`).

---

## 3. Registration-Number Contract

Format: `SESSION-DEPT-ROLL`, for example **`2023-CS-580`**

```
^(19|20)\d{2}-[A-Z]{2,5}-\d{1,4}$
```
- `SESSION` — 4-digit admission year (1900-2099)
- `DEPT` — 2-5 uppercase letters (CS, SE, EE, ME, CE, BBA, ARCH, ...)
- `ROLL` — 1-4 digits, stored **without** leading zeros after normalisation

Normalisation (applied before storage **and** before lookup):
`trim -> uppercase -> collapse whitespace -> strip leading zeros from roll`
so `2023-cs-0580` and ` 2023-CS-580 ` both resolve to `2023-CS-580`.

The department list is configurable in system settings so a new department never requires a redeploy.

---

## 4. Domain Model

### 4.1 Collections (MongoDB)

#### `users`
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `role` | enum | STUDENT / RT / WARDEN / COORDINATOR |
| `name` | string | |
| `email` | string | unique, lowercased |
| `passwordHash` | string | bcryptjs |
| `phone` | string? | |
| `regNo` | string? | **unique sparse** — students only |
| `hostel` | enum? | required for STUDENT and RT |
| `roomNo` | string? | students |
| `department` | string? | derived from regNo |
| `session` | number? | derived from regNo |
| `isActive` | bool | soft-disable instead of delete |
| `emailVerified` | bool | |
| `mustChangePassword` | bool | seeded staff = true |
| `tokenVersion` | number | bump to revoke all sessions |
| `notificationPrefs` | object | `{ email: bool, digest: 'none' | 'daily' }` |
| `lastLoginAt` | Date? | |
| `createdAt/updatedAt` | Date | |

Indexes: `{email:1}` unique, `{regNo:1}` unique sparse, `{role:1, hostel:1}`.

#### `complaints`
| Field | Type | Notes |
|---|---|---|
| `code` | string | human ID `HCMS-2026-000123`, unique |
| `student` | subdoc | `{ userId, regNo, name, email, phone, roomNo }` (snapshotted) |
| `hostel` | enum | GIRLS / QASIM / FATIMA |
| `category` | enum | see 4.2 |
| `title` | string | auto-suggested from category, editable |
| `description` | string | 10-3000 chars |
| `images` | Attachment[] | max 5 |
| `audio` | Attachment? | max 1, up to 2 min |
| `severity` | enum | LOW / MEDIUM / HIGH / CRITICAL (student proposes, RT may override — override is logged) |
| `severityOverriddenBy` | ObjectId? | |
| `status` | enum | see 5 |
| `priorityScore` | number | denormalised, see 6 |
| `escalationLevel` | 0/1/2 | 0 none, 1 warden, 2 coordinator |
| `isDisputed` | bool | student flagged a false resolution |
| `location` | string? | free text: "Room 214, washroom" |
| `assignment` | subdoc? | `{ workerId, workerName, workerPhone, trade, assignedBy, assignedAt, expectedCompletionAt, startedAt, completedAt, remarks }` |
| `resolution` | subdoc? | `{ resolvedBy, resolvedAt, note, proofImages[] }` |
| `verification` | subdoc? | `{ verifiedBy, verifiedAt, method: STUDENT/AUTO/STAFF, rating 1-5, feedback }` |
| `rejection` | subdoc? | `{ rejectedBy, rejectedAt, reason }` |
| `onHold` | subdoc? | `{ reason, until }` |
| `sla` | subdoc | `{ ackDueAt, resolveDueAt, ackBreached, resolveBreached, firstResponseAt }` |
| `upvotes` | ObjectId[] | same-hostel students "me too" |
| `upvoteCount` | number | denormalised |
| `duplicateOf` | ObjectId? | links to canonical complaint |
| `reopenCount` | number | |
| `lastEscalatedAt` | Date? | 24 h cooldown guard |
| `lastActivityAt` | Date | drives the stale-complaint sweep |
| `isAnonymous` | bool | hides student identity from other students only — never from staff |
| `deletedAt` | Date? | soft delete (coordinator only) |
| `createdAt/updatedAt` | Date | |

Indexes:
`{code:1}` unique, `{hostel:1,status:1,priorityScore:-1}`, `{'student.userId':1,createdAt:-1}`,
`{'student.regNo':1}`, `{status:1,'sla.resolveDueAt':1}`, `{escalationLevel:1,status:1}`,
`{lastActivityAt:1,status:1}`, text index on `{title, description, code}`.

#### `complaint_events` — immutable audit trail / timeline
`{ complaintId, actorId, actorName, actorRole, action, fromStatus, toStatus, message, visibility: PUBLIC|INTERNAL, meta, ip, userAgent, createdAt }`
Append-only. Never updated, never deleted. Index `{complaintId:1, createdAt:1}`.

#### `workers` — the people who actually do the job
`{ name, phone, trade (ELECTRICIAN|PLUMBER|CARPENTER|CLEANER|IT|GENERAL|MASON|WELDER), hostels[], isActive, createdBy, stats:{assigned, completed, onTime, reopened, avgTatHours} }`

#### `notifications` — in-app bell
`{ userId, type, title, body, link, isRead, createdAt }` with a 90-day TTL.

#### `announcements` — warden/RT notice board
`{ title, body, hostels[], audience: ALL|STUDENTS|STAFF, pinned, startsAt, endsAt, createdBy }`

#### `settings` — single document, editable by coordinator
SLA hours per severity, escalation windows, max attachments, feature flags, department list,
auto-close window, e-mail toggles, priority weights.

#### `otp_tokens` — `{ userId, purpose, codeHash, expiresAt, attempts }` with a TTL index.
#### `rate_limits` — `{ key, count, windowStart }` with a TTL index (serverless-safe rate limiting).
#### `mail_queue` — `{ to, subject, html, status, attempts, lastError, sendAfter }` retry queue.
#### `counters` — `{ _id: "complaint-2026", seq }`. Atomic `$inc` so two simultaneous submissions can never receive the same ticket number.
#### `system_logs` — `{ level, source, message, meta }`. Cron runs, mail failures and settings changes. 60-day TTL.

### 4.2 Categories
`ELECTRICITY`, `PLUMBING_WATER`, `INTERNET_WIFI`, `FURNITURE`, `CLEANLINESS_SANITATION`,
`MESS_FOOD`, `SECURITY_SAFETY`, `LAUNDRY`, `AC_HEATING_FAN`, `PEST_CONTROL`, `CIVIL_STRUCTURAL`,
`GAS`, `LIFT_ELEVATOR`, `NOISE_DISCIPLINE`, `OTHER`

Each category carries a **default severity**, a **default trade** (for worker suggestions) and a
**safety flag** (ELECTRICITY, GAS, SECURITY_SAFETY, LIFT_ELEVATOR) that boosts priority.

---

## 5. Complaint Lifecycle (State Machine)

```
                    +--------------+
                    |  SUBMITTED   |  <-- student creates
                    +------+-------+
              RT/Warden acknowledges
                    +------v-------+
       +------------| ACKNOWLEDGED |------------+
       |            +------+-------+            |
       |             assign worker              | reject (reason required)
       |            +------v-------+            |
       |     +------|   ASSIGNED   |------+     |
       |     |      +------+-------+      |     |
       |     |        work starts         |     |
       |     |      +------v-------+      |     |
       |  on hold   | IN_PROGRESS  |   on hold  |
       |     +----->|              |<-----+     |
       |            +------+-------+            |
       |               mark resolved            |
       |            +------v-------+            |
       |            |   RESOLVED   |            |
       |            +--+--------+--+            |
       |  student      |        |  student confirms / 72 h auto
       |  reopens      |        |
       |      +--------v-+   +--v-------------+    +----------+
       +----->| REOPENED |   | VERIFIED_CLOSED|    | REJECTED |
              +----+-----+   +----------------+    +----------+
                   | back to ACKNOWLEDGED / ASSIGNED
                   +-------------------->
```

`ON_HOLD` is reachable from ACKNOWLEDGED / ASSIGNED / IN_PROGRESS and returns to the same state.

### 5.1 Legal transitions (single source of truth: `src/lib/domain/statusMachine.ts`)
| From | Allowed To | Who |
|---|---|---|
| SUBMITTED | ACKNOWLEDGED, ASSIGNED, REJECTED | RT / Warden / Coordinator |
| ACKNOWLEDGED | ASSIGNED, IN_PROGRESS, ON_HOLD, RESOLVED, REJECTED | RT / W / C |
| ASSIGNED | IN_PROGRESS, ON_HOLD, RESOLVED, ACKNOWLEDGED | RT / W / C |
| IN_PROGRESS | RESOLVED, ON_HOLD, ASSIGNED | RT / W / C |
| ON_HOLD | ACKNOWLEDGED, ASSIGNED, IN_PROGRESS, REJECTED | RT / W / C |
| RESOLVED | VERIFIED_CLOSED (student/auto/staff), REOPENED (student/warden) | student, W / C, system |
| REOPENED | ACKNOWLEDGED, ASSIGNED, IN_PROGRESS, RESOLVED | RT / W / C |
| VERIFIED_CLOSED | REOPENED | WARDEN / COORDINATOR only (7-day window) |
| REJECTED | ACKNOWLEDGED | WARDEN / COORDINATOR only (appeal) |

Guards enforced on **every** transition:
- `RESOLVED` requires a resolution note (10+ chars) **and** at least one proof image *(configurable)*.
- `REJECTED` requires a reason (10+ chars).
- `ON_HOLD` requires a reason and an "until" date.
- `ASSIGNED` requires an active worker and an expected completion date.
- Illegal transitions return **409** and are logged.

---

## 6. Priority Engine

Older complaints and higher-severity complaints rise to the top. `priorityScore` is recomputed on
every mutation and by the scheduled sweep, then used for the default sort
(`priorityScore DESC, createdAt ASC`).

```
priorityScore =
    severityWeight       CRITICAL 100 | HIGH 60 | MEDIUM 30 | LOW 10
  + ageFactor            min(ageHours, 336) * 0.5          -> max 168
  + upvoteFactor         min(upvoteCount, 50) * 2          -> max 100
  + escalationFactor     escalationLevel * 75              -> max 150
  + reopenFactor         reopenCount * 40
  + slaFactor            resolveBreached ? 80 : 0  +  ackBreached ? 25 : 0
  + safetyFactor         category.isSafety ? 25 : 0
  + disputeFactor        isDisputed ? 60 : 0
```
Closed / rejected complaints are pinned to `0`.
Weights live in `settings` so the coordinator can retune them without a deploy.

### 6.1 SLA defaults (hours)
| Severity | Acknowledge within | Resolve within |
|---|---|---|
| CRITICAL | 2 | 8 |
| HIGH | 4 | 24 |
| MEDIUM | 12 | 72 |
| LOW | 24 | 168 |

`ackDueAt` / `resolveDueAt` are stamped at creation and recomputed if severity changes.

---

## 7. Escalation & Accountability Rules

| Rule | Trigger | Effect |
|---|---|---|
| **E1 — Student escalation (G6)** | Complaint still untouched **24 h** after creation. Student presses *Escalate to Warden*. | `escalationLevel = 1`, e-mail to Warden + RT, timeline entry, priority boost. Cooldown 24 h. |
| **E2 — Auto escalation** | Scheduled sweep finds an open complaint with **no activity for 24 h** and `escalationLevel = 0`. | Same as E1 but actor = `SYSTEM`. |
| **E3 — False-resolution flag (G7)** | Status is `RESOLVED`, **24 h** have passed since `resolvedAt`, student says the work is still pending. | `isDisputed = true`, `escalationLevel = 1`, status -> `REOPENED`, e-mail Warden + Coordinator, RT dispute counter increments. |
| **E4 — Immediate reopen** | Student rejects a resolution within the first 24 h. | Status -> `REOPENED`, `reopenCount++`, e-mail RT. No warden escalation yet. |
| **E5 — Second-level escalation** | `escalationLevel = 1` and still open after a further **48 h**. | `escalationLevel = 2`, e-mail Campus Coordinator. |
| **E6 — SLA breach** | `now > resolveDueAt` while open. | `sla.resolveBreached = true`, priority boost, appears in the *Breached* dashboard tile. |
| **E7 — Auto-close** | `RESOLVED` with no student response for **72 h**. | Status -> `VERIFIED_CLOSED`, `verification.method = AUTO`. Student keeps a 7-day reopen right via the Warden. |

All windows (24 h / 48 h / 72 h) are stored in `settings` and are editable by the Coordinator.

### 7.1 Accountability surfaces
- **Worker scorecard** — assigned, completed, on-time %, reopen rate, average turn-around.
- **RT scorecard** — average acknowledge time, average resolve time, SLA compliance %, disputes
  raised against them, escalations that bypassed them.
- **Hostel scorecard** — open/closed counts, ageing buckets (0-24 h, 1-3 d, 3-7 d, 7 d+), category mix.
- **Immutable timeline** on every complaint, visible to the student (internal notes excluded).
- **Public transparency board** (`/transparency`, no login) — anonymised per-hostel counts, average
  resolution time and SLA compliance, so the whole hostel can see performance.

---

## 8. Technology Stack (all free tiers)

Installed versions, verified from `package.json`:

| Layer | Choice | Free tier | Why |
|---|---|---|---|
| Framework | **Next.js 16.3.4 (App Router) + React 19.2.8 + TypeScript 5** | — | One deployable unit: UI + API. Server Components keep the bundle small. |
| Hosting | **Vercel Hobby** | 100 GB bandwidth/mo | Zero-config Next.js, free HTTPS + subdomain. |
| Database | **MongoDB Atlas M0** | 512 MB shared cluster | Free forever; the user already has a cluster. |
| ODM | **Mongoose 9.9.4** | — | Schema validation, indexes, hooks; cached connection for serverless. Note: v9 removed the exported `FilterQuery` type, so query objects are typed `Record<string, unknown>` and cast at the call site. |
| Media (images/audio) | **Cloudinary** (adapter-based) | 25 GB storage + 25 GB bandwidth/mo | Handles image *and* audio, auto-compression, direct signed browser upload keeps payloads off the serverless function. Swappable adapter (`src/lib/storage/`). |
| E-mail | **Nodemailer over SMTP** (adapter-based) | Gmail app password 500/day, Brevo 300/day | No domain purchase needed. Adapter also supports Resend. |
| Auth | **jose (JWT) + bcryptjs** | — | No paid auth vendor, no native modules. |
| Styling | **Tailwind CSS v4 + hand-written Radix primitives** | — | Accessible primitives, no runtime cost. Written by hand rather than pulled in via the shadcn CLI so there is no `components.json` and no generated code to reconcile later. |
| Validation | **Zod 4.5.4** | — | One schema for client + server. |
| Charts | **Recharts** | — | Analytics dashboards. |
| Scheduler | **GitHub Actions cron** (every 15 min) -> signed webhook | 2 000 min/mo | Vercel Hobby cron only runs daily; GH Actions gives real 15-minute SLA sweeps. `cron-job.org` documented as an alternative. |
| Error tracking | Console + Mongo `system_logs` | — | Sentry free tier optional, off by default. |

### 8.1 Repository layout (as built)

Route groups were dropped in favour of plain `student/` and `staff/` folders — the
URL and the folder then match, which is one less thing to hold in your head.

```
hostel/
├── project-state.yml               <- machine-readable state (read every session)
├── docs/
│   ├── SYSTEM_ARCHITECTURE.md      <- this file
│   ├── PROJECT_PROGRESS.md         <- changelog + next actions
│   ├── DEPLOYMENT.md               <- (P10-1, not written yet)
│   └── API.md                      <- (P10-2, not written yet)
├── .github/workflows/cron.yml      <- free 15-min scheduler
├── scripts/
│   ├── seed.ts                     <- staff, workers, demo students + complaints
│   ├── syncIndexes.ts              <- build indexes in production
│   └── runSweep.ts                 <- trigger the sweep locally
├── src/
│   ├── middleware.ts               <- route protection, role redirects, CSRF, headers
│   ├── app/
│   │   ├── page.tsx                        landing
│   │   ├── login|register|forgot-password|reset-password|change-password/
│   │   ├── student/                        layout + dashboard, new, complaints/[id],
│   │   │                                   hostel, notices, notifications
│   │   ├── staff/                          layout + dashboard, complaints, complaints/[id],
│   │   │                                   workers, analytics, announcements, audit,
│   │   │                                   users, settings, notifications
│   │   └── api/                            route handlers (section 9)
│   ├── components/
│   │   ├── ui/                     button.tsx, primitives.tsx, overlays.tsx
│   │   ├── complaint/              ComplaintCard, Timeline, StatusStepper,
│   │   │                           ImageGallery, StudentActions, CommentBox
│   │   ├── staff/                  QueueFilters, StaffActions
│   │   ├── media/                  useUpload, ImageUploader, AudioRecorder
│   │   ├── shared/                 badges, NotificationsList
│   │   ├── auth/                   AuthShell
│   │   ├── layout/                 AppShell
│   │   └── providers.tsx
│   ├── lib/
│   │   ├── api/                    response, rateLimit, loadComplaint
│   │   ├── auth/                   jwt, session, password, permissions
│   │   ├── config/                 env
│   │   ├── db/                     mongoose connection cache
│   │   ├── domain/                 constants, regNo, statusMachine, priority, sla
│   │   ├── mail/                   transport, templates
│   │   ├── services/               complaints, listComplaints, getComplaintDetail,
│   │   │                           serialize, events, notify, settings, workers,
│   │   │                           analytics, complaintCode
│   │   ├── storage/                cloudinary
│   │   ├── validation/             schemas
│   │   ├── apiClient.ts            typed fetch wrapper for the browser
│   │   └── utils.ts
│   └── models/                     12 Mongoose models + index.ts barrel
```

---

## 9. API Design

All handlers return a uniform envelope:
```jsonc
{ "ok": true,  "data": { } }
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { } } }
```

### 9.1 Endpoints
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | public | Student self-registration (regNo validated) |
| POST | `/api/auth/login` | public | Issue JWT cookie |
| POST | `/api/auth/logout` | any | Clear cookie |
| GET | `/api/auth/me` | any | Current session |
| POST | `/api/auth/forgot-password`, `/reset-password`, `/change-password`, `/verify-email` | mixed | OTP flows |
| POST | `/api/complaints` | STUDENT | Create complaint |
| GET | `/api/complaints` | any | List with filters/sort/pagination, scoped by role |
| GET | `/api/complaints/:id` | scoped | Detail + timeline |
| PATCH | `/api/complaints/:id/status` | RT/W/C | Guarded transition |
| PATCH | `/api/complaints/:id/assign` | RT/W/C | Assign worker |
| PATCH | `/api/complaints/:id/severity` | RT/W/C | Override severity (logged) |
| POST | `/api/complaints/:id/comments` | scoped | Public comment or internal note |
| POST | `/api/complaints/:id/escalate` | STUDENT | E1 — 24 h rule |
| POST | `/api/complaints/:id/flag-false-resolution` | STUDENT | E3 — 24 h rule |
| POST | `/api/complaints/:id/verify` | STUDENT | Confirm fix + rating |
| POST | `/api/complaints/:id/reopen` | STUDENT / W / C | E4 |
| POST | `/api/complaints/:id/upvote` | STUDENT | "Me too" (same hostel) |
| GET | `/api/complaints/track?code=` | public | Anonymous status lookup by code + regNo |
| GET/POST/PATCH/DELETE | `/api/workers` | RT/W/C | Worker registry (hostel-scoped) |
| GET | `/api/analytics/overview`, `/hostels`, `/workers`, `/rts` | RT/W/C | Dashboards |
| GET | `/api/export/complaints.csv` | W/C | CSV export |
| GET/POST/PATCH | `/api/announcements` | RT/W/C | Notice board |
| GET/POST/PATCH | `/api/users` | COORDINATOR | Staff management |
| GET/PATCH | `/api/settings` | COORDINATOR | SLA/escalation tuning |
| GET | `/api/notifications`, PATCH `/read` | any | In-app bell |
| POST | `/api/uploads/sign` | STUDENT+ | Signed direct-upload params for Cloudinary |
| POST | `/api/cron/sweep` | `x-cron-secret` | SLA + escalation + auto-close sweep |
| GET | `/api/health` | public | Liveness + DB ping |

### 9.2 Media upload flow (keeps us inside free limits)
```
browser --1--> POST /api/uploads/sign  (validates role, mime, size budget)
        <-2--  { signature, timestamp, apiKey, folder, publicId }
        --3--> POST direct to Cloudinary (multipart, never touches our function)
        <-4--  { secure_url, public_id, bytes, duration }
        --5--> POST /api/complaints with the attachment metadata (server re-verifies
               the public_id prefix and fetches resource metadata before persisting)
```
Limits: up to 5 images x 5 MB, 1 audio up to 10 MB / 120 s. Server-side allow-list on mime type.

### 9.3 Scheduled work
`POST /api/cron/sweep` (idempotent, guarded by `CRON_SECRET`) performs, in order:
1. Recompute `priorityScore` for all open complaints.
2. Mark `sla.ackBreached` / `sla.resolveBreached`.
3. **E2** auto-escalate stale complaints (no activity for 24 h+).
4. **E5** second-level escalation (48 h+ at level 1).
5. **E7** auto-close resolved complaints older than 72 h.
6. Drain the mail queue; write a `system_logs` run record.

Triggered by GitHub Actions every 15 minutes (free), with Vercel Cron daily as a backstop.

---

## 10. Notifications

| Event | Student | RT (that hostel) | Warden | Coordinator |
|---|---|---|---|---|
| Complaint created | email confirmation | **email: new complaint** | **email: new complaint** | in-app |
| Status changed | email | in-app | in-app | — |
| Worker assigned | email | in-app | in-app | — |
| Resolved | email + confirm/reject call to action | in-app | in-app | — |
| Escalated (E1/E2) | email | email | **email: action required** | in-app |
| False resolution flagged (E3) | email | email | **email: action required** | email |
| Level-2 escalation (E5) | email | email | email | **email: action required** |
| SLA breach (E6) | — | daily digest | daily digest | daily digest |
| Auto-closed (E7) | email | in-app | — | — |

E-mail sending is queued so a failed SMTP call never fails the user request. Every e-mail is also
written to `notifications` for the in-app bell.

---

## 11. Security & Privacy

- **RBAC** enforced server-side on every route; the UI merely hides what the API already refuses.
- **Zod** validation on every input; unknown fields stripped.
- **Rate limiting** (Mongo-backed, serverless-safe): login 5/15 min/IP, register 3/h/IP,
  complaint creation 5/day/student, escalation 1/24 h/complaint, OTP 3/10 min.
- **Cookies**: httpOnly + Secure + SameSite=Lax; CSRF risk mitigated by SameSite plus an
  `Origin` check on all mutating requests.
- **Headers**: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`.
- **Passwords** hashed with bcryptjs; never logged, never returned.
- **Uploads**: mime allow-list, size caps, signed uploads only, `public_id` prefix verification.
- **Audit trail** is append-only; deletes are soft (`deletedAt`) and coordinator-only.
- **PII minimisation**: students may file anonymously — identity is hidden from *other students*
  but always visible to RT/Warden/Coordinator (accountability beats anonymity for staff).
- **Secrets** only in environment variables; `.env*` git-ignored; `.env.example` documents each key.
- No third-party analytics, no trackers, no ad scripts.

---

## 12. Non-Functional Requirements

| Aspect | Target |
|---|---|
| Cost | PKR 0 / month, permanently |
| Mobile | Mobile-first; installable PWA; works on a 3G connection |
| Accessibility | WCAG 2.1 AA — keyboard navigable, labelled controls, 4.5:1 contrast, screen-reader-friendly timeline |
| Performance | LCP under 2.5 s on 3G; list endpoints paginated (20/page), lean queries, projections |
| Availability | Vercel + Atlas free tiers; health endpoint; graceful DB-down page |
| Data volume | ~1 500 students x ~8 complaints/yr = ~12 k docs/yr, comfortably inside 512 MB with media offloaded |
| Backup | Weekly `mongodump` GitHub Action artifact (free) + CSV export |
| Browser support | Last 2 versions of Chrome/Edge/Firefox/Safari, Android Chrome, iOS Safari |
| i18n | String table ready for English + Urdu |

---

## 13. Build Phases

| Phase | Scope |
|---|---|
| **P0 — Foundation** | Docs, Next.js scaffold, Tailwind/shadcn, env config, DB connection, base UI shell |
| **P1 — Data layer** | All Mongoose models, indexes, Zod schemas, domain logic (regNo, statusMachine, priority, sla), seed script |
| **P2 — Auth** | Register/login/logout/me, JWT cookies, middleware guards, permissions, password reset, staff seeding |
| **P3 — Complaint core** | Create (with media), list with filters, detail + timeline, status transitions, assignment, comments |
| **P4 — Media** | Cloudinary signed uploads, image gallery, in-browser audio recorder + player |
| **P5 — Escalation & SLA** | Escalate, flag false resolution, verify, reopen, upvote, cron sweep, priority recompute |
| **P6 — Notifications** | SMTP adapter, HTML e-mail templates, retry queue, in-app notification centre |
| **P7 — Staff panels** | RT queue, warden cross-hostel view, coordinator admin, workers, announcements, users, settings |
| **P8 — Analytics** | Dashboards, scorecards, ageing buckets, CSV export, public transparency board |
| **P9 — Hardening** | Security headers, rate limits, error boundaries, empty/loading states, a11y pass, PWA |
| **P10 — Deploy** | `.env` runbook, Vercel deploy, GitHub Actions cron, smoke tests, handover docs |

---

## 14. Key Decisions & Rationale (ADR-lite)

| ID | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| D1 | Next.js full-stack monolith | One free deployment covers UI + API | Separate Express API (needs a second free host, more CORS/ops) |
| D2 | Mongoose over the raw driver | Schema validation + indexes declared in code; safer for a multi-person project | Raw driver, Prisma (weaker Mongo support) |
| D3 | Cloudinary, not GridFS | Atlas M0 is only 512 MB — audio/photos would exhaust it in weeks | GridFS, Vercel Blob (smaller free tier) |
| D4 | JWT cookie, not a paid auth vendor | Zero cost, no vendor lock-in, full control of the reg-no login rule | Clerk/Auth0 free tiers (user caps, lock-in) |
| D5 | GitHub Actions for cron | Vercel Hobby cron fires only once a day, useless for a 24 h SLA clock | Vercel Cron alone, paid scheduler |
| D6 | Escalation as `escalationLevel`, not a status | A complaint can be escalated *and* in progress simultaneously | An `ESCALATED` status (loses workflow position) |
| D7 | Append-only `complaint_events` | Transparency and accountability need a tamper-evident history | Mutable `history[]` array inside the complaint |
| D8 | Denormalised `priorityScore` | Sorting/pagination in Mongo needs a stored field; recomputed on write + sweep | Compute at read time (breaks pagination) |
| D9 | Student accounts (not anonymous-only) | Needed for "my complaints", escalation rights and spam control | Reg-no-only ticket with a tracking code (no accountability) |
| D10 | `bcryptjs` over `bcrypt` | No native build on the deploy platform | `bcrypt`, `argon2` |
| D11 | Plain `student/` and `staff/` folders, not route groups | The URL matches the folder; less indirection for a team that will hand this over | `(student)` / `(staff)` route groups |
| D12 | Radix primitives written by hand, not the shadcn CLI | No `components.json`, no generated code to reconcile, full control over the token names | `npx shadcn add` |
| D13 | `next/image` with `unoptimized` on Cloudinary URLs | Vercel's free image-optimisation quota is small and Cloudinary already transforms and compresses on delivery | Vercel image optimisation |
| D14 | A 404, not a 403, when staff open another hostel's complaint | A 403 confirms the complaint exists; a 404 does not. Staff must not be able to probe outside their scope | 403 Forbidden |

---

## 15. Implementation Notes (where the build departed from v1.0)

| # | v1.0 said | What was built | Why |
|---|---|---|---|
| 1 | Mongoose 8 | **Mongoose 9.9.4** | It is what npm installed. v9 dropped the exported `FilterQuery` type, so query objects are typed `Record<string, unknown>` and cast at the call site. Noted here because it will look odd otherwise. |
| 2 | shadcn/ui via the CLI | Radix primitives written by hand in `components/ui/` | See D12. Three files: `button.tsx`, `primitives.tsx`, `overlays.tsx`. |
| 3 | `/api/complaints/track?code=` (GET) | `POST /api/complaints/track` | It requires the registration number as well as the ticket number. Putting a registration number in a query string would leak it into server logs and browser history. |
| 4 | `GET /api/export/complaints.csv` | `GET /api/export/complaints` | Next.js route segments do not take a file extension. The `Content-Disposition` header still names the download `hcms-complaints-YYYY-MM-DD.csv`. |
| 5 | Separate analytics endpoints per report | `/api/analytics/overview` and `/api/analytics/scorecards` | Two aggregation round trips instead of four, which matters on a shared free cluster. |
| 6 | A `WORKER` role was considered | Workers are records, not accounts | v1 keeps the login surface small. RTs update on their behalf. A magic-link worker portal is a post-P8 idea. |
| 7 | Email verification gating access | Accounts are usable before e-mail verification | Free SMTP is flaky enough that blocking a student from filing a complaint over an undelivered e-mail would be worse than the risk it prevents. `emailVerified` is still tracked. |

### 15.1 Things referenced but not yet built

These are wired into the UI or metadata and will 404 until their task lands:

- `/track` — the page. `POST /api/complaints/track` is finished. *(task P3-11)*
- `/transparency` — the page. `getPublicStats()` is finished. *(task P8-6)*
- `/manifest.webmanifest` — referenced by `src/app/layout.tsx`. *(task P9-6)*

### 15.2 Verification status

**No part of this system has been executed against a database.** `npx tsc --noEmit`
and `npx next build` both pass, which means the code is internally consistent — it
does not mean the behaviour is correct. The 16 acceptance criteria in
`project-state.yml` are the real test, and they run in task P10-7 once
`MONGODB_URI` is available.
