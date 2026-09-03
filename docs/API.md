# API reference

Every route lives under `/api`. This is a reference for someone building against
it — a mobile client, a script, or a future maintainer — not a tutorial. For the
*why* behind a rule, see `docs/SYSTEM_ARCHITECTURE.md`; for role-by-role usage, see
`docs/USER_GUIDE.md`.

---

## Conventions

**Envelope.** Every response, success or failure, is JSON in one of two shapes:

```jsonc
{ "ok": true,  "data": { /* ... */ } }
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { "email": "..." } } }
```

`fields`, when present, is keyed by form field name — built for rendering inline
under an input. It only appears on `VALIDATION_ERROR`.

**Auth.** Session is an httpOnly JWT cookie (`hcms_session`), set by
`/api/auth/login` or `/api/auth/register`. There is no bearer-token mode — every
route reads the cookie. Requests from a browser send it automatically;
non-browser clients need a cookie jar.

**Mutating requests need a matching Origin.** `POST` / `PATCH` / `PUT` / `DELETE`
under `/api/` are rejected with `403 FORBIDDEN` if the `Origin` header's host does
not match the request's own host. This is CSRF protection, enforced in the proxy
before the route ever runs — send requests from the same origin the app is served
from.

**Errors and their HTTP status:**

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod rejected the body; `fields` names what to fix |
| `UNAUTHENTICATED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Signed in, but not allowed to do this |
| `NOT_FOUND` | 404 | Missing, **or** exists but you can't see it (see below) |
| `CONFLICT` | 409 | Duplicate, or a business rule blocks the action |
| `ILLEGAL_TRANSITION` | 409 | That status change isn't legal from here |
| `RATE_LIMITED` | 429 | Too many attempts; message says how long to wait |
| `PAYLOAD_TOO_LARGE` | 413 | Over an attachment/count limit |
| `NOT_CONFIGURED` | 503 | A feature's environment variables aren't set (e.g. Cloudinary) |
| `SERVER_ERROR` | 500 | Unexpected — logged, never leaks a stack trace |

**A complaint outside your hostel is `404`, never `403`.** RBAC is checked before
existence, so an RT probing another hostel's complaint ID learns nothing — a `403`
would confirm the complaint exists.

**IDs** are Mongo ObjectIds — 24 hex characters — everywhere in this document.

**Rate limits** (per identifier — usually the user id, sometimes the IP):

| Bucket | Limit | Window | Applies to |
|---|---|---|---|
| `login` | 8 | 15 min | Sign-in, and public complaint tracking |
| `register` | 5 | 1 hour | Registration |
| `otp` | 3 | 10 min | Forgot/reset password |
| `createComplaint` | 5 | 24 hours | Filing a complaint |
| `comment` | 30 | 1 hour | Comments, and bulk actions |
| `upload` | 40 | 1 hour | Getting a signed upload URL |
| `escalate` | 3 | 24 hours | Escalate, and flag-false-resolution (separate keys) |

A `429` response's message states the actual wait, e.g. *"You can try signing in
again in about 4 minute(s)."*

---

## Auth

### `POST /api/auth/register`
Creates a student account and signs in.

```jsonc
{
  "name": "Ayesha Khan",
  "regNo": "2023-CS-580",          // SESSION-DEPT-ROLL; normalised server-side
  "email": "ayesha@example.edu",
  "phone": "0300-1234567",          // optional
  "hostel": "GIRLS",                 // GIRLS | QASIM | FATIMA
  "roomNo": "F-214",                 // optional
  "password": "…", "confirmPassword": "…",
  "acceptTerms": true
}
```
The department in `regNo` (`CS` above) must be on the institute's configured
list — `VALIDATION_ERROR` on `regNo` if not, naming the valid codes. If
`policy.allowedEmailDomain` is set, `email` must end with `@<that domain>`.
→ `201` `{ user, redirectTo: "/student" }`

### `POST /api/auth/login`
```jsonc
{ "identifier": "2023-CS-580", "password": "…" }
```
`identifier` accepts a registration number **or** an e-mail — students typically
use the former, staff the latter. Wrong identifier and wrong password return the
identical `401` message; the API never confirms whether an account exists.
→ `200` `{ user, redirectTo }`. `redirectTo` is `/change-password` when
`mustChangePassword` is set (every staff account created by a Coordinator).

### `POST /api/auth/logout`
No body. Clears the cookie. → `200` `{ signedOut: true }`

### `GET /api/auth/me`
→ `200` `{ user: CurrentUser | null }` — `null`, not a `401`, when signed out.
This is the one auth endpoint safe to call unconditionally on page load.

### `POST /api/auth/change-password`
Requires a session.
```jsonc
{ "currentPassword": "…", "newPassword": "…", "confirmPassword": "…" }
```
Bumps `tokenVersion`, which signs the caller out of every other device. A fresh
session is issued for this one. → `200` `{ changed: true, redirectTo }`

### `POST /api/auth/forgot-password`
```jsonc
{ "email": "ayesha@example.edu" }
```
Always `200` with the same message, whether or not the account exists — no
enumeration. Queues a 6-digit code, 10-minute expiry, `MAIL_PROVIDER`-dependent
delivery (see README).

### `POST /api/auth/reset-password`
```jsonc
{ "email": "…", "code": "123456", "newPassword": "…", "confirmPassword": "…" }
```
5 wrong codes and the token is deleted — request a new one. Also bumps
`tokenVersion` (signs out everywhere). → `200` `{ reset: true }`

---

## Complaints

### `POST /api/complaints`
Student only.
```jsonc
{
  "hostel": "FATIMA",                       // must match the student's own hostel
  "category": "PLUMBING_WATER",
  "title": "Shower drain blocked",
  "description": "…",                       // 10-3000 chars
  "location": "Second floor washroom",      // optional
  "severity": "HIGH",                       // LOW | MEDIUM | HIGH | CRITICAL
  "images": [ /* up to 5, see Attachments */ ],
  "audio": null,                            // or one attachment
  "isAnonymous": false,
  "roomNo": "F-214"                          // optional
}
```
On success: allocates a ticket code, stamps SLA due dates from severity, computes
an initial priority score, writes the `CREATED` timeline event, and e-mails +
in-app-notifies the RT of that hostel and the Warden, plus a receipt to the
student.
→ `201` `{ id, code, status: "SUBMITTED", redirectTo }`

**Categories:** `ELECTRICITY`, `PLUMBING_WATER`, `INTERNET_WIFI`, `FURNITURE`,
`CLEANLINESS_SANITATION`, `MESS_FOOD`, `SECURITY_SAFETY`, `LAUNDRY`,
`AC_HEATING_FAN`, `PEST_CONTROL`, `CIVIL_STRUCTURAL`, `GAS`, `LIFT_ELEVATOR`,
`NOISE_DISCIPLINE`, `OTHER`.

### `GET /api/complaints`
Role-scoped list — a student sees only their own; an RT their hostel; a Warden
or Coordinator all three. Query params (all optional):

| Param | Type | Notes |
|---|---|---|
| `hostel` | enum | Ignored/rejected outside what the role can see |
| `status` | enum or repeated | |
| `category`, `severity` | enum | |
| `escalated`, `disputed`, `slaBreached` | boolean | |
| `assignedTo` | ObjectId | Worker id |
| `q` | string | Matches code/title/description |
| `from`, `to` | ISO date | Filed-date range |
| `view` | `all` \| `open` \| `closed` \| `actionRequired` | |
| `sort` | `priority` \| `newest` \| `oldest` \| `dueSoon` \| `severity` | default `priority` |
| `page`, `limit` | int | `limit` capped at 100 |

→ `200` `{ complaints: [...], pagination: { page, limit, total, pages, hasNext } }`

### `GET /api/complaints/:id`
→ `200` `{ complaint, timeline }`. `timeline` is filtered by visibility — a
student never sees an internal-only staff note. `404` if it's not yours to see,
`404` also for a malformed id (never leaks that the format itself was wrong).

### `PATCH /api/complaints/:id/status`
Drives the state machine (see the diagram in `README.md`). Staff can reach any
legal `to`; a student is restricted to the reporter-eligible transitions
(`RESOLVED → VERIFIED_CLOSED`, `RESOLVED → REOPENED` via dispute, escalate).
```jsonc
{
  "to": "RESOLVED",
  "note": "…",                    // optional context, most transitions
  "reason": "…",                  // required by some transitions (e.g. REJECTED) — 409 ILLEGAL_TRANSITION names which
  "proofImages": [ /* attachments */ ],   // required to resolve, unless the Coordinator disabled that policy
  "workerId": "…",                        // required to reach ASSIGNED
  "expectedCompletionAt": "2026-09-10T00:00:00Z",
  "holdUntil": "…"                         // for ON_HOLD
}
```
An illegal transition (e.g. `SUBMITTED → RESOLVED`) is `409 ILLEGAL_TRANSITION`
naming the current and requested status in plain English.
→ `200` `{ complaint }`

### `PATCH /api/complaints/:id/assign`
Staff only.
```jsonc
{ "workerId": "…", "expectedCompletionAt": "…", "remarks": "…" }
```
Moves the complaint to `ASSIGNED` and e-mails the student. → `200` `{ complaint }`

### `PATCH /api/complaints/:id/severity`
Staff only. Re-stamps the SLA due dates.
```jsonc
{ "severity": "CRITICAL", "reason": "…" }   // reason: min 5 chars, logged
```
→ `200` `{ complaint }`

### `POST /api/complaints/:id/comments`
Any party who can view the complaint.
```jsonc
{ "message": "…", "internal": false }   // internal: staff-only note, hidden from the student
```
→ `201` `{ timeline }`

### `POST /api/complaints/:id/escalate`
Student, and only the reporter — G6. Eligible after `studentEscalateAfterHours`
(default 24) of no activity, with a cooldown between escalations.
```jsonc
{ "reason": "…" }   // min 10 chars
```
Ineligible → `403 FORBIDDEN` with a message naming when it becomes available.
→ `200` `{ complaint, message }`

### `POST /api/complaints/:id/flag-false-resolution`
Student, reporter only — G7. Eligible `falseResolutionFlagAfterHours` (default
24) after a `RESOLVED` status.
```jsonc
{ "reason": "…" }   // min 10 chars
```
Reopens the complaint, sets `isDisputed: true`, escalates to level 1, e-mails the
Warden **and** Coordinator naming who marked it resolved.
→ `200` `{ complaint, message }`

### `POST /api/complaints/:id/verify`
Student, reporter only. Confirms a `RESOLVED` complaint is actually fixed.
```jsonc
{ "rating": 5, "feedback": "…" }   // both optional
```
→ `200` `{ complaint, message }` — status becomes `VERIFIED_CLOSED`.

### `POST /api/complaints/:id/upvote`
Student, same hostel (does not need to be the reporter — "me too"). Toggles;
calling twice removes the upvote. Raises priority. → `200` `{ upvoted, count }`

### `POST /api/complaints/bulk`
Staff only. Applies one action to up to 50 complaints at once.
```jsonc
{
  "ids": ["…", "…"],
  "action": "ACKNOWLEDGE",           // ACKNOWLEDGE | ASSIGN | CLOSE
  "note": "…",                        // optional
  "workerId": "…"                     // required when action is ASSIGN
}
```
Goes through the exact same per-complaint logic as the single-complaint routes —
no shortcut around the state machine or hostel scoping. **Partial success by
design**: an id that can't legally make the transition is skipped and reported,
the rest still go through. `ACKNOWLEDGE` is restricted to complaints genuinely
awaiting it (`SUBMITTED`/`REOPENED`) — reaching `ACKNOWLEDGED` from `ASSIGNED` is
the state machine's *unassign* rule, and a bulk button must never silently strip
a worker off a job.
→ `200` `{ action, requested, succeeded, skipped: [{ id, code, reason }] }`

### `POST /api/complaints/track`
**Public — no session.** Needs both values; a ticket number alone reveals
nothing.
```jsonc
{ "code": "HCMS-2026-000123", "regNo": "2023-CS-580" }
```
Returns a deliberately thin view: status, category, severity, assigned worker's
name and trade, SLA due date — never the description, photos, voice note, or
internal notes.
→ `200` `{ complaint, timeline }` (timeline entries marked `visibility: PUBLIC`
only) · `404` if the pair doesn't match any complaint.

---

## Attachments and uploads

Photos and the voice note never pass through a serverless function — the browser
uploads straight to Cloudinary with a short-lived signature this API issues.

### `POST /api/uploads/sign`
```jsonc
{ "kind": "image", "folder": "complaints" }   // kind: image | audio · folder: complaints | proofs
```
`folder: "proofs"` is silently downgraded to `"complaints"` for a student — only
staff resolving a complaint upload proof photos.
→ `200`
```jsonc
{
  "uploadUrl": "https://api.cloudinary.com/v1_1/<cloud>/image/upload",
  "fields": { "api_key": "…", "timestamp": …, "signature": "…", "folder": "…", "public_id": "<userId>_<ts>_<rand>" },
  "publicIdPrefix": "<userId>_",
  "maxBytes": 5242880,
  "acceptedMime": ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
}
```
`503 NOT_CONFIGURED` if Cloudinary env vars aren't set.

**Then, from the browser directly to Cloudinary** (not this API):
`POST <uploadUrl>` as `multipart/form-data` with the file plus every field from
`fields` above. Cloudinary's response gives you `secure_url`, `public_id`,
`bytes`, `width`/`height` or `duration` — assemble those into an `attachmentSchema`
object (`url`, `publicId`, `kind`, `bytes`, `mimeType`, plus `width`/`height` or
`duration`) and send it in the complaint or status-change body.

**Ownership is re-checked server-side** the moment an attachment is actually
used (filing a complaint, marking one resolved): the `publicId` must be prefixed
with the *current* user's id, and its existence in Cloudinary is confirmed with
a signed lookup. A forged `publicId` claiming someone else's upload is
`403 FORBIDDEN — "That attachment does not belong to you."` — this cannot be
bypassed by calling the complaint endpoints directly.

Limits (defaults, editable by the Coordinator): 5 images, 5 MB each; 1 voice
note, 10 MB, 120 seconds.

---

## Workers

### `GET /api/workers`
Staff only. `?hostel=`, `?trade=`, `?activeOnly=true`. RT sees their hostel;
Warden/Coordinator see all. → `200` `{ workers }`

### `POST /api/workers`
```jsonc
{ "name": "…", "phone": "…", "trade": "ELECTRICIAN", "hostels": ["FATIMA"], "isActive": true, "notes": "…" }
```
An RT may only register a worker for their own hostel(s).
**Trades:** `ELECTRICIAN`, `PLUMBER`, `CARPENTER`, `MASON`, `CLEANER`,
`IT_NETWORK`, `AC_TECHNICIAN`, `PEST_CONTROL`, `SECURITY`, `GENERAL`.
→ `201` `{ worker }`

### `PATCH /api/workers/:id`
Partial update, same schema. → `200` `{ worker }`

### `DELETE /api/workers/:id`
Deactivates, never deletes (history stays auditable). Blocked with `409` if the
worker has open jobs — reassign first. → `200` `{ deactivated: true }`

---

## Staff accounts (Coordinator only)

### `GET /api/users`
`?role=RT|WARDEN|COORDINATOR`, `?q=` (matches name/email/regNo).
→ `200` `{ users }`

### `POST /api/users`
```jsonc
{ "name": "…", "email": "…", "phone": "…", "role": "RT", "hostel": "GIRLS", "password": "…" }
```
`hostel` required when `role: "RT"`. `409 CONFLICT` if that hostel already has an
active RT — deactivate the current one first. `password` optional; omitted, one
is generated and returned once. Always e-mails the welcome message.
→ `201` `{ user, temporaryPassword, createdBy }`

Command-line equivalent, useful before any staff account exists to create one
from: `npm run create-staff -- --role COORDINATOR --name "…" --email "…"`.

### `PATCH /api/users/:id`
```jsonc
{ "name": "…", "phone": "…", "hostel": "…", "isActive": false, "role": "…", "notificationPrefs": { "email": true, "digest": "daily" } }
```
Deactivating bumps `tokenVersion`, ending that person's live sessions
immediately. A Coordinator cannot deactivate or demote their own account
(`409 CONFLICT`). → `200` `{ user }`

---

## Announcements

### `GET /api/announcements`
Returns currently-active notices for the caller's audience (student: their
hostel + `ALL`/`STUDENTS`; RT: their hostel; Warden/Coordinator: all, plus
`?includeExpired=true`). → `200` `{ announcements }`

### `POST /api/announcements`
Staff only.
```jsonc
{
  "title": "…", "body": "…", "hostels": ["GIRLS", "QASIM"],
  "audience": "ALL",                 // ALL | STUDENTS | STAFF
  "tone": "warning",                 // info | warning | danger | success
  "pinned": false,
  "startsAt": "2026-09-10T00:00:00Z", "endsAt": null
}
```
Notifies every matching user's in-app bell immediately. → `201` `{ id }`

---

## Notifications

### `GET /api/notifications`
`?countOnly=true` — a single `countDocuments`, the shape the header bell polls
with. Without it, also returns the list (`?limit=`, capped at 100).
→ `200` `{ unread }` or `{ unread, notifications }`

### `PATCH /api/notifications`
```jsonc
{ "id": "…" }   // omit to mark everything read
```
→ `200` `{ updated: <count> }`

---

## Analytics (staff only)

### `GET /api/analytics/overview`
`?hostel=` (Warden/Coordinator only — an RT is always scoped to their own),
`?days=` (default 30, max 365).
→ `200` — status mix, severity breakdown, category breakdown, ageing buckets,
trend, escalation/breach counts, and `performance` (SLA compliance, avg
resolution/response time, ratings).

### `GET /api/analytics/scorecards`
No params — scoped to the caller's visible hostels automatically.
→ `200` `{ staff, workers }` — per-RT and per-worker performance (resolved
count, on-time %, reopen %, avg turnaround, rating).

---

## Settings (Coordinator writes; any staff reads)

### `GET /api/settings`
→ `200` `{ settings }` — SLA hours per severity, escalation windows, priority
weights, attachment limits, policy toggles, department codes.

### `PATCH /api/settings`
Coordinator only. Every field optional — send only what changes.
```jsonc
{
  "sla": { "CRITICAL": { "ackHours": 2, "resolveHours": 8 } },
  "escalation": { "studentEscalateAfterHours": 24 },
  "policy": { "requireProofOnResolve": true, "allowAnonymous": true, "maxComplaintsPerStudentPerDay": 5, "allowedEmailDomain": "" },
  "departments": ["CS", "BSCPE", "EE", "ARCH", "CE", "ME", "BME"]
}
```
Every change is written to `SystemLog` with the before/after values and the
Coordinator's name — this is the audit trail behind **Audit log** in the staff
panel. → `200` `{ settings }`

---

## Export (Warden and Coordinator only)

### `GET /api/export/complaints`
`?hostel=`, `?from=`, `?to=` (ISO dates). Streams a 33-column CSV, RFC 4180
escaped, UTF-8 with a BOM (opens correctly in Excel on Windows), capped at 5,000
rows. → `200`, `content-type: text/csv`, `content-disposition: attachment`.

---

## Operational

### `GET /api/health`
No auth. → `200` `{ status, database, mail, media, time }`. `status` is
`"degraded"` (still `200`, not an error) if the database ping fails —
poll-friendly for an uptime monitor.

### `POST /api/cron/sweep` (also `GET`, identical)
Requires `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`.
`403 FORBIDDEN` otherwise. Recomputes priority and SLA-breach flags, auto-escalates
stale complaints (E2), escalates level 1 → 2 (E5), auto-closes resolved complaints
after the silence window (E7), sends the daily SLA digest (once per ~20 hours,
self-guarded so calling this every 15 minutes doesn't spam), and drains the mail
queue. Safe to call repeatedly — every step is idempotent.
→ `200` — a JSON report: `{ scanned, priorityUpdated, slaBreached, autoEscalated, level2Escalated, autoClosed, digestRecipients, mailSent, mailFailed, errors }`

Called every 15 minutes by `.github/workflows/cron.yml` — see
`docs/DEPLOYMENT.md` step 6. Vercel Hobby's own cron only fires once a day,
which cannot drive a 24-hour escalation clock.

---

## The attachment object

Referenced throughout as `{ /* attachment */ }`:

```jsonc
{
  "url": "https://res.cloudinary.com/…",
  "publicId": "hcms/complaints/image/<userId>_<ts>_<rand>",
  "kind": "image",              // image | audio
  "bytes": 184320,
  "mimeType": "image/jpeg",
  "width": 1080, "height": 1440,   // images
  "duration": 34.2                  // audio, seconds
}
```
