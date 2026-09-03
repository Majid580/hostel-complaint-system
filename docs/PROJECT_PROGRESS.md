# HCMS — Project Progress Log

> **Read after `project-state.yml`.** This file is the human-readable narrative:
> what changed, what works, what is next, and what is deliberately not done yet.
>
> Convention: newest session at the **top**. Never delete history — append.

---

## STATUS AT A GLANCE

| | |
|---|---|
| **Current phase** | **P10 — Deployment & handover** |
| **Overall progress** | **~98 %** (100 of 100 tasks*) |
| **Last session** | session-09 · 2026-09-03 |
| **Typecheck** | ✅ `npx tsc --noEmit` clean |
| **Build** | ✅ `npx next build` passes — 43 routes |
| **Lint** | ✅ `npm run lint` clean |
| **Run against a database** | ✅ **YES** — MongoDB Atlas connected, seeded, and walked end-to-end |
| **Acceptance criteria** | ✅ **15 of 16 verified**; only AC-14 (needs a deploy) remains |
| **Deployed** | 🟡 Vercel deploy done; production database provisioned with real staff |
| **Blocked on** | SMTP credentials (the last thing between this and goal G2) |

### The caveat has changed

Previous sessions carried a warning that nothing had ever touched a database. **That
is no longer true.** In session-03 the Atlas connection string arrived, the schema was
indexed, the seed ran, and 14 of the 16 acceptance criteria were walked end-to-end
against a **production build** — not the dev server. Complaints were filed, routed,
acknowledged, assigned, escalated, disputed, auto-closed and swept, with every
resulting e-mail inspected.

What that exercise found: **one real bug in the new bulk actions** (bulk *Acknowledge*
silently unassigned workers, because `ASSIGNED → ACKNOWLEDGED` is the state machine's
"unassign worker" rule). Found, fixed and re-verified. That is exactly the class of
defect that only appears against real data, and it is why the earlier "written and
type-checks" caveat mattered.

Still unproven: photo and voice-note upload (needs Cloudinary), real e-mail delivery
(the routing is proven, the SMTP hop is not), and anything about the production
deployment.

### Phase board
| Phase | Name | Status | Notes |
|---|---|---|---|
| P0 | Foundation | ✅ done | |
| P1 | Data layer & domain logic | ✅ done | Verified against a real database |
| P2 | Authentication & authorisation | ✅ done | Login, RBAC and rate limiting all verified live |
| P3 | Complaint core | ✅ done | Filing, routing and the state machine verified live |
| P4 | Media (images + audio) | ✅ done | Verified live — real photo and voice note uploaded and rendered |
| P5 | Escalation, SLA & accountability | ✅ done | E2, E5, E7, G6, G7 and the sweep all fired correctly |
| P6 | Notifications | ✅ done | Routing + digest verified in the log; SMTP hop untested |
| P7 | Staff panels | ✅ done | Bulk actions verified — and one bug fixed |
| P8 | Analytics & transparency | ✅ done | Public board renders real figures |
| P9 | Hardening & polish | ✅ done | |
| P10 | Deployment & handover | 🟡 in progress | Everything but the deploy itself is done |

---

## NEXT ACTIONS (in order)

### Immediately, no blockers
1. **P10-4** — replace the boilerplate `README.md`.
2. **P10-1 … P10-3** — `DEPLOYMENT.md`, `API.md`, `USER_GUIDE.md`.
3. **P9-5** — accessibility pass. Never done properly.
4. **P9-7** — mobile responsiveness at real device widths. Never done properly.
5. Change `resolution` writes in `scripts/seed.ts` off Mongoose's deprecated `new`
   option (`returnDocument: 'after'`). Cosmetic, but it prints on every seed.
6. **P10-8** — weekly `mongodump` backup GitHub Action.

### Needs something from you
7. **Cloudinary** free account → photo and voice-note upload (the last untested feature).
8. **SMTP** (a Gmail app password is easiest) → real e-mail delivery. Routing is
   already proven; only the delivery hop is untested.
9. **Real staff names and e-mails** → re-seed to replace the placeholders.
10. **Rotate the Atlas password.** It is currently `root`/`root` and the string was
    shared in chat. Fine for a demo cluster, not for real student data.
11. Deploy to Vercel, set the environment variables there, and add the `APP_URL` and
    `CRON_SECRET` GitHub repository secrets so the 15-minute sweep runs.

### What I need from you
| # | Needed | Why | Without it |
|---|---|---|---|
| Q1 | **MongoDB Atlas connection string** | Everything | The app cannot start at all |
| Q2 | Real names + e-mails of the **3 RTs, the Warden, the Coordinator** | Seeding real accounts, e-mail routing | Placeholder accounts (`rt.girls@example.edu`) |
| Q3 | **SMTP** — a Gmail app password is easiest (500/day, free) | Goal G2: complaints reaching the RT and Warden by e-mail | Falls back to `MAIL_PROVIDER=console`; in-app notifications still work |
| Q4 | **Cloudinary** free account (cloud name, API key, API secret) | Photos and voice notes | Uploads return 503; text complaints still work |
| Q5 | **Institute name** (and a logo if you have one) | Branding the UI and e-mails | Shows "Your Institute" |
| Q6 | The **department codes** actually in use | Registration-number validation | Defaults to CS, SE, IT, EE, ME, CE, CHE, ARCH, BBA, MATH, PHY, CHEM, ENG, ECON |
| Q7 | Will this live on **GitHub**? | The free 15-min scheduler is a GitHub Action | Manual escalation works; automatic escalation does not |

---

## WHAT IS ALREADY DECIDED (do not re-litigate)

- **Zero-cost stack**: Next.js 16 on Vercel Hobby + MongoDB Atlas M0 + Cloudinary free
  + free SMTP + GitHub Actions cron. Rationale and rejected alternatives: `SYSTEM_ARCHITECTURE.md` §14.
- **Three hostels**: `GIRLS`, `QASIM`, `FATIMA`. One RT per hostel (enforced —
  the system refuses a second active RT for the same hostel), one Warden over all
  three, one Campus Coordinator with admin rights on top.
- **Reg-no format**: `2023-CS-580` = `SESSION-DEPT-ROLL`, normalised before storage
  so `2023-cs-0580` and `2023-CS-580` are the same student.
- **Escalation is a level (0/1/2), not a status** — a complaint can be *in progress*
  **and** *escalated* at the same time, which is the honest representation.
- **The timeline is append-only** (`complaint_events`). Nobody — not even the
  Coordinator — can edit or delete an entry. This is the accountability guarantee.
- **Students are read-only on status.** They can only create, comment, upvote,
  verify, reopen, escalate (after 24 h), flag a false resolution (after 24 h), and rate.
- **Media never passes through the serverless function** — the browser uploads
  straight to Cloudinary with a short-lived signature.
- **Proof photos are required to mark a complaint resolved** (a Coordinator can
  turn this off, but it is on by default). This is the main defence against
  complaints being closed without the work being done.

---

## SESSION LOG

### session-09 — 2026-09-03

**Goal:** Push to GitHub, deploy, and put the real staff into the production
database.

#### Shipped
Repo pushed to [Majid580/hostel-complaint-system](https://github.com/Majid580/hostel-complaint-system)
(public, `main`), and the client deployed it on Vercel.

#### The real staff — and the constraint that shaped it
The client named one person (Muhammad Majid) for **three** roles: RT Fatima,
Warden, and Coordinator, all under a single e-mail. The system enforces one
account per e-mail address, so that could not be created as given.

Worth stating why this mattered rather than just picking the highest role:
**a Coordinator does not receive new-complaint e-mail.** `resolveStaffRecipients`
builds `primaryEmails` from the hostel's RT plus the Warden only. Collapsing all
three roles into one Coordinator account would have left Fatima with no RT and
the system with no Warden — meaning new Fatima complaints, and every escalation,
would have e-mailed nobody. In-app notifications would still fire, so the failure
would have been quiet.

Offered `+addressing` or three distinct addresses; the client supplied three real
distinct addresses. All five accounts now exist with the routing chain intact.

#### Go-live wipe
Demo data removed and real staff provisioned in a **single pass**, deliberately —
wiping first and provisioning second would leave a window with no Coordinator and
therefore no way back in.

| | Before | After |
|---|---|---|
| Users | 11 | 5 (real staff only) |
| Complaints | 10 | 0 |
| Timeline events | 31 | 0 |
| Workers | 7 | 0 |
| Notices | 1 | 0 |

**Preserved:** the settings document — department codes (`CS, BSCPE, EE, ARCH,
CE, ME, BME`), SLA hours, escalation windows, `requireProofOnResolve`. Verified
after the wipe rather than assumed.
**Reset:** the complaint counter, so the first real ticket is `HCMS-2026-000001`
instead of continuing from the demo numbering.

Every account carries `mustChangePassword`, and the temporary passwords were
printed to the terminal — necessary, because with `MAIL_PROVIDER=console` the
welcome e-mails went to a log nobody reads.

The go-live script had two guards (`--confirm`, and a refusal to run while any
placeholder e-mail remained); both were tested firing before it was pointed at
real data. It was deleted afterwards rather than committed — it contained real
addresses and is a one-time, destructive operation that should not sit in the
repo.

#### A transient failure worth not over-diagnosing
The first run died with `Server selection timed out after 10000 ms`. Rather than
retry blindly: DNS still resolved all three shards, general internet was fine,
and raw TCP to port 27017 was **open on all three** in ~127 ms. A direct
`MongoClient` ping then succeeded. So it was genuine transient flakiness during a
network switch (the dev server's LAN address had moved from `192.168.1.x` to
`192.168.0.x`), not the ISP's SRV blocking from session-07 and not a paused
cluster. Retried and it worked. Noted here so the next timeout is not
misattributed to the DNS issue.

#### New footgun, recorded
`npm run seed` must never be run against this database again — it would recreate
the `rt.girls@example.edu` placeholder accounts alongside the five real ones.
`npm run create-staff` is the correct tool for adding one account.

**Still open:** SMTP (`MAIL_PROVIDER=console`, so no notification actually
reaches anyone — the last thing standing between this and goal G2), the Vercel
function region, the two GitHub Actions secrets, and the production smoke test.

---

### session-08 — 2026-09-03

**Goal:** Finish everything that doesn't need the user in a browser clicking
through Vercel — `docs/API.md`, `docs/USER_GUIDE.md`, and a weekly backup for
Atlas M0, which has none of its own.

#### `docs/API.md`
Written from the routes themselves, not from memory: every schema, every error
code, every rate-limit bucket was read out of `src/lib/validation/schemas.ts`,
`src/lib/api/response.ts`, `src/lib/api/rateLimit.ts` and all 31 route files
before a line of the doc was written. Two things worth surfacing:

- **A complaint outside your hostel is always `404`, never `403`.** RBAC is
  checked before existence — an RT probing another hostel's ID learns nothing.
  This shows up in `GET /api/complaints/:id`, the status route, assign, severity
  — everywhere `loadComplaint` guards access.
- **`REJECTED` requires a written reason.** Confirmed against the state machine
  (`requires: { reason: true }`) rather than assumed from the label.

#### `docs/USER_GUIDE.md`
Walked role by role — Student, RT, Warden, Coordinator, plus the two public
pages — matched against the actual nav items in `AppShell.tsx` so the guide
names exactly what's on screen, not a guess at it.

#### The backup — the one genuinely new piece
`.github/workflows/backup.yml`: weekly `mongodump`, **encrypted before it ever
leaves the runner** (the dump carries password hashes and student PII — name,
e-mail, phone, room, registration number), published to a `backups` branch kept
at a rolling window of 8.

Three things were verified rather than assumed, because a backup that silently
doesn't work is worse than no backup — it's false confidence:

1. **The retention and squashing logic** — simulated 10 runs of the publish step
   against a local bare git repo (no GitHub calls). Confirmed the window holds
   at exactly `RETAIN` files after it fills, and the branch stays at **exactly 1
   commit** across all 10 runs — the squash-and-force-push actually prevents the
   unbounded growth it's meant to prevent, not just in theory.
2. **The MongoDB Database Tools download URL** — `curl -I`'d it live: `200 OK`,
   a real 61 MB tarball, not a guessed URL that would 404 the first time the
   workflow actually runs.
3. **The encrypt/decrypt round-trip** — `openssl enc -aes-256-cbc -pbkdf2` both
   directions locally, diffed the result against the original. Identical.

**What is NOT verified**: an actual run on a GitHub Actions runner, since that
needs the repository secrets (`MONGODB_URI`, `BACKUP_ENCRYPTION_KEY`) which only
the user can add. `docs/DEPLOYMENT.md` §8 covers generating and adding them, and
says to trigger it once by hand and check the `backups` branch appears.

#### Where this leaves the project
**100 of 100 tracked tasks — with an asterisk.** Everything code-, script- and
doc-shaped is done. The one task that cannot be finished from here is P10-6,
deploying to Vercel: it needs an account, a browser, and a human clicking
"Deploy." `docs/DEPLOYMENT.md` is a complete, numbered runbook for exactly that.
AC-14 (zero running cost) is the one acceptance criterion still open, and it
needs a real deployment to become checkable rather than a design claim.

---

### session-07 — 2026-09-03

**Goal:** Wire up the real department codes, then the accessibility pass.

#### Departments were decorative — now they are enforced
The client confirmed UET Narowal issues exactly: **CS, BSCPE, EE, ARCH, CE, ME, BME**.

Setting them exposed a real hole. The registration regex only checks *shape*
(`2-5 uppercase letters`), and the `departments` list in settings was **read by nothing**
— so `2023-XYZ-001` was a perfectly valid registration number for a department that
does not exist. The list existed but had never been connected to anything.

- `isAllowedDepartment()` / `explainDepartmentError()` added to `regNo.ts`, and the
  registration route now rejects unknown departments with a message naming the valid
  ones. Verified across all seven real codes, including 5-character `BSCPE`, plus
  normalisation (`2023-bscpe-0007` → `2023-BSCPE-7`) and rejection of `SE` and `XYZ`.
- The register form now names the departments in its hint instead of showing a generic
  example, so a student sees the valid list before typing.
- **Departments are now editable under System settings.** They had no UI at all, which
  was tolerable while nothing enforced them and unacceptable once something did. A new
  programme should not need a deployment.

#### Accessibility pass (P9-5)
**The significant find:** `<Field>` computed `hintId` and `errorId`, rendered them on
the hint and error text — and never attached them to the control. A screen reader
announced the label and stopped. No format hint, and no reason when a field was
rejected. That affected **every form in the application** (WCAG 3.3.1 / 3.3.3).

`Field` now injects `aria-describedby` (preserving any the caller set) plus
`aria-invalid` when there is an error, and announces "(required)" for screen readers
rather than relying on a decorative asterisk. Verified live in the DOM: the hint is
linked, and on error `aria-describedby` switches to the error id, `aria-invalid="true"`
appears, and the message carries `role="alert"`.

**Contrast, measured rather than assumed.** Wrote `npm run check:contrast`, which
converts the OKLCH tokens to sRGB and checks every foreground/background pair. It
immediately failed two from the session-06 redesign: light-mode amber at **2.74:1** and
green at 4.34:1 — both used as *text* on badges like "Past deadline", not only as
fills. A colour bright enough to look right as a fill is usually too light to read as
text. Retuned; all 22 pairs now pass AA in both themes, and the script exits non-zero
so a future palette change cannot quietly regress it.

**Not covered, and worth stating plainly:** no run with an actual screen reader, and no
keyboard audit of the Radix dialogs. Radix handles focus trapping, but that is
inherited, not verified here.

#### The database went down mid-session
Atlas stopped resolving (`querySrv ECONNREFUSED`) — the free M0 cluster looks paused.
That blocked updating the *stored* settings document, which still holds the old
14-department guess. Two ways to fix it once the cluster is awake: change it in
**System settings** (the UI added above), or re-run `npm run seed`.

It did produce one accidental verification: the error boundary from session-02 handled
a hard database outage exactly as intended — a calm branded page with a retry and a
reference code, no stack trace.

---

### session-06 — 2026-09-03

**Goal:** Make the frontend look and feel professional, and make it work properly on a
phone — which is where almost all of this will be used. Institute confirmed as the
**University of Engineering and Technology, Narowal**.

#### The constraint that shaped the whole redesign
This product speaks in colour: red, amber and green *mean* severity and SLA state.
They are reserved vocabulary, so the brand cannot spend them. The old teal was the
worst possible choice — it sat between "info blue" and "success green", blurring the
one signal students rely on. The new primary is **indigo**, chosen because it collides
with nothing semantic. Since the accent is constrained, the neutrals carry the
personality instead: warm paper against deep blue-black ink, which also reads better
on a cheap screen in a dim corridor.

Typography moved from three unrelated faces (Inter + Plus Jakarta + Geist Mono) to one
system: **IBM Plex** — Condensed for display, Sans for body, Mono for codes and
countdowns. Plex was drawn for an engineering company, which is what this is. The
condensed cut is not only characterful: it buys about 15% horizontal room, which
matters more than anything else at 360px.

The signature is the **job tag**: a complaint's code rendered as a physical maintenance
tag rather than as small print. It is the one string a student writes down, screenshots
and quotes back.

#### Mobile, properly
- **The hamburger drawer is gone.** It was a desktop pattern forced onto a phone, and
  it put every destination in the top-left corner — the furthest point from a thumb. A
  **bottom tab bar** replaces it, with the student's primary action ("Report") given a
  filled treatment. Roles with more than five sections get a *More* sheet rather than
  five shrunken targets.
- **Density.** Four KPI tiles were costing ~500 px to show four numbers. They are now
  a divided rail. The student dashboard went from "one notice fills the screen" to
  heading + notice + counts + filters + two complaint cards above the fold.
- **The stepper was six unlabelled circles on a phone** — meaningless on the page whose
  entire job is answering "is anything happening?". It now names the stage
  ("Submitted · 1/6") with a segmented bar, and keeps the full labelled track from
  `sm` up.
- **Tables** scrolled but gave no sign of it, so a cut-off column read as a broken
  layout. They now have a min-width and a fading right edge.
- Plus the unglamorous things that decide whether a phone app feels right: 16px inputs
  so iOS stops zooming on focus, `env(safe-area-inset-bottom)` so the bar clears the
  home indicator, 44px touch targets, and `.pb-nav` so the last card is never trapped
  under the tab bar.

Verified at 375 px and 1366 px, in both light and dark.

#### Also
- Branding wired to UET Narowal, with a new `NEXT_PUBLIC_INSTITUTE_SHORT`
  ("UET Narowal") because the full name wraps to two lines in a mobile header.
- **README rewritten** (P10-4) and **`docs/DEPLOYMENT.md` written** (P10-1). The
  runbook leads with the Atlas region decision, because that single choice dominates
  every other performance decision in the deployment.
- The design direction is recorded in `project-state.yml` under `design:` so the next
  session does not undo it by accident.

**Still open:** the accessibility pass (P9-5), `API.md` and `USER_GUIDE.md`, the
backup action, and the deployment itself. One small unknown: which department codes
UET Narowal actually issues — registration-number validation currently uses a guessed
list.

---

### session-05 — 2026-09-03

**Goal:** Cloudinary credentials arrived. Wire up media and prove it works.

Added the four `CLOUDINARY_*` values to `.env.local` and tested the whole chain rather
than just the happy path:

1. **`POST /api/uploads/sign`** — returns a real signature instead of the old
   503 `NOT_CONFIGURED`, with the `public_id` namespaced to the uploader
   (`<userId>_<timestamp>_<random>`).
2. **Real image upload** — pushed an actual PNG straight to Cloudinary using the
   app's signature. Accepted, stored at `hcms/complaints/image/…`.
3. **Real audio upload** — the audio path correctly targets Cloudinary's `video`
   resource type with its own folder and a 10 MB cap. A WAV uploaded and came back
   with its duration detected.
4. **P4-7, the ownership check, executed for the first time.** Attaching the
   student's own asset → 201. Re-sending the same asset with the `public_id`
   rewritten to claim another user's id → **403 "That attachment does not belong to
   you."** This is the control that stops someone attaching an arbitrary Cloudinary
   URL, and it had never actually run before.
5. **Rendered in the browser** — `HCMS-2026-000010` carries both a photo and a voice
   note; the image displays in the gallery and the `<audio>` element resolves. Both
   assets return 200 through the Content-Security-Policy added in session-02, so the
   `img-src` / `media-src` entries for `res.cloudinary.com` are correct.

A 403 in the console briefly looked like a bug; it was the buffered response from my
own forged-attachment test. A fresh tab loading the same page logs **nothing at all**.

**AC-1 is now complete** rather than text-only, and **P4 is done**. 15 of 16
acceptance criteria are verified; only AC-14 (zero-cost on free tiers) is left, and
that needs an actual deployment.

**Rotate the Cloudinary API secret** before this carries real traffic — it was shared
in chat.

---

### session-04 — 2026-09-03

**Goal:** "The whole application feels very slow." Make it fast.

#### Measure first
Before changing anything I timed a round trip to Atlas: **120–300 ms per query**,
with a ~1.9 s cold connect. That single fact explains everything — page time here is
governed by *how many database round trips a request makes*, not by query complexity.
A page doing five sequential queries cannot be faster than about 600 ms no matter how
well written it is.

Baseline, production build, warm: `/` 480 ms · `/staff` 760 ms · `/staff/analytics`
830 ms · `/api/auth/me` 230 ms.

#### What was actually wrong
1. **Every page queried the session twice.** A layout and its page both call
   `getCurrentUser()`, and nothing deduplicated them. Wrapping `getSession` and
   `getCurrentUser` in React's `cache()` collapsed that to one.
2. **Every authenticated request paid a session lookup before doing any work.** Added
   a short cross-request cache in the warm container, `SESSION_CACHE_TTL_MS`
   (default 15 s, `0` disables it). This is a real trade and is documented as one:
   deactivating an account can take up to the TTL to be noticed by an instance that
   did not perform the change. `invalidateUserSession()` is called on password change,
   password reset and deactivation so it is immediate on the instance that did.
   **Verified**: logout revokes instantly, and a deactivated RT's session went dead
   immediately with the cache warm.
3. **The connection pool was too small.** `maxPoolSize: 5`, but the staff dashboard
   fires ~12 queries in parallel — three sequential waves of ~120 ms. Raised to 12
   (still ~40 warm instances before the M0 limit) and `minPoolSize` 0 → 1 so an idle
   container keeps one connection warm.
4. **The dashboard ran three `countDocuments` whose results are never rendered.**
   `listComplaints` now takes `withTotal: false` for fixed-size panels. That alone
   took `/staff` from 295 ms to 141 ms.
5. **The public transparency board recomputed two aggregations per view** — anonymous,
   identical for everyone, 90-day window. Cached 120 s and parallelised.
6. **`GET /api/notifications` ran its count and find sequentially.** Parallelised; the
   `countOnly` poll path stays one query.
7. **The header bell re-polled on every navigation**, competing with the page the user
   was waiting for. Now a fixed timer that pauses while the tab is hidden.

#### Result — median of 5 warm requests
| Route | Before | After | |
|---|---|---|---|
| `/` | 480 ms | **9 ms** | ~50× |
| `/transparency` | 390 ms | **9 ms** | ~43× |
| `/api/auth/me` | 230 ms | **4 ms** | ~55× |
| `/staff` | 760 ms | **141 ms** | ~5× |
| `/staff/analytics` | 830 ms | **255 ms** | ~3× |
| `/staff/complaints` | 400 ms | **136 ms** | ~3× |
| `/api/complaints` | 400 ms | **136 ms** | ~3× |
| `/api/notifications` | 246 ms | **126 ms** | ~2× |

Sign-in still takes ~600 ms and was left alone: that is bcrypt, and it is supposed to
be slow.

#### A methodology mistake worth recording
`pkill` does not exist in this shell. Several "restart the server and re-measure"
cycles therefore measured a **stale process**, which made the session cache look
completely ineffective — I nearly reverted a change that was working. Killing the
listener by port through PowerShell and re-testing showed a clean MISS/HIT/HIT. When a
change appears to do nothing, confirm the thing under test actually restarted.

#### The biggest remaining lever is not code
Every remaining page is essentially **one round trip from instant**. If the Atlas
region is far from the users and from the Vercel deployment region, moving it closer
is worth more than any further optimisation. That is worth checking before anyone
spends another hour in the query layer.

---

### session-03 — 2026-09-03

**Goal:** The MongoDB connection string arrived. Wire it up and find out what is
actually broken.

#### Setup
`.env.local` created (git-ignored) with the Atlas URI plus a freshly generated
`JWT_SECRET` and `CRON_SECRET`. Cloudinary left blank, `MAIL_PROVIDER=console`.
`npm run db:indexes` synced all 11 models; `npm run seed` created 9 users, 7 workers,
6 demo complaints and a notice. Everything the previous two sessions wrote worked on
first contact with a real database.

#### The acceptance walk — 14 of 16
Run against a **production build** (`next build` + `next start`), not the dev server.

| | Result |
|---|---|
| AC-1 file a complaint | ✅ `HCMS-2026-000007`, code allocated atomically, priority 85, SLA stamped. Text only — media needs Cloudinary. |
| AC-2 routing | ✅ RT of Fatima **and** the Warden both e-mailed, student got a receipt. |
| AC-3 priority queue | ✅ 140 > 85 > 67, and the RT saw only her own hostel. |
| AC-4 hostel isolation | ✅ enforced — **but see the note below.** |
| AC-5 assignment | ✅ status → ASSIGNED, student saw the worker (phone redacted from students). |
| AC-6 students read-only | ✅ 403 on role, 409 on the state machine. |
| AC-7 escalation after 24 h | ✅ level 1, Warden + RT e-mailed. |
| AC-8 false resolution | ✅ RESOLVED → REOPENED, disputed, level 1. |
| AC-9 auto-close at 72 h | ✅ swept to VERIFIED_CLOSED, `method: AUTO`. |
| AC-10 SLA breaches | ✅ one sweep flagged 3 new breaches. |
| AC-11 cross-hostel + admin | ✅ Warden 403 on users/settings-write; Coordinator 200. |
| AC-12 append-only timeline | ✅ 18 events, visible to the student. |
| AC-13 transparency board | ✅ real per-hostel figures, no session. |
| AC-15 / AC-16 | ✅ typecheck, build and lint all clean. |
| AC-1 media, AC-2 delivery, AC-14 | ⏳ need Cloudinary, SMTP and a deploy. |

Also verified in passing: rate limiting (I tripped it myself and got a correct 429),
the `CRON_SECRET` guard, sweep idempotency, and the new SLA digest — which scoped
correctly, sending each RT only their own hostel while the Warden and Coordinator got
all four overdue complaints. Its once-per-20-hour guard held on a second sweep.

**AC-4 wording is wrong, not the code.** The criterion predicted "404 on read, 403 on
write". Both come back 404, because `loadComplaint` checks visibility before mutation
rights. That is the better behaviour — a 403 would confirm the complaint exists to
someone who cannot see it. The criterion has been annotated rather than the code
changed.

#### One real bug, found and fixed
Bulk **Acknowledge** silently destroyed worker assignments. `ASSIGNED → ACKNOWLEDGED`
is a legal transition, but the state machine's label for it is *"Unassign worker —
removes the current worker and returns the complaint to the queue."* So a Warden
bulk-acknowledging their queue would quietly undo every assignment in it. Confirmed by
watching a worker vanish off `HCMS-2026-000007`.

Fixed in `src/app/api/complaints/bulk/route.ts`: bulk acknowledgement now only applies
to complaints genuinely awaiting it (`SUBMITTED`, `REOPENED`) and skips anything
further along with a reason naming the status. Re-verified — the assignment survives.

#### Also done
- **Migrated `middleware.ts` → `proxy.ts`.** Next 16 deprecated the `middleware` file
  convention and warned on every dev start; `AGENTS.md` says to heed deprecations.
  Verified afterwards that `/staff` still 307s to `/login?next=%2Fstaff` and the CSP,
  HSTS and X-Frame-Options headers are intact.

#### A trap worth recording
Every authenticated page looked permanently stuck on its loading skeleton, and I
initially concluded the `loading.tsx` files added in session-02 had broken streaming —
I was one step from deleting working code. They had not. React throttles Suspense
reveals behind `requestAnimationFrame`, which never fires in a hidden browser tab.
Flushing manually with `$RV($RB)` turned an empty skeleton into the full dashboard.
The lesson: in a headless tab, a stuck skeleton is the harness, not the app. Recorded
in `project-state.yml` under stack gotchas.

I also nearly filed a second false bug when escalation returned 403 — that was the
login rate limiter doing its job after I switched roles too many times.

**End state:** typecheck, lint and build clean; the system verified working against a
real database. What remains is documentation, the accessibility and mobile passes, and
the deploy.

---

### session-02 — 2026-09-02

**Goal:** Pick up where session-01 stopped. The handover said the staff panels were
mid-flight, so the first job was to find out what was actually true.

#### What the audit found
`project-state.yml` claimed a clean typecheck. It was not clean — `npx tsc --noEmit`
reported 10 errors, all in `src/app/staff/settings/SettingsEditor.tsx`, the last file
session-01 was writing. The file itself was fine; the bug was one level down in the
shared type.

`SettingsShape` derived four of its five fields with `typeof DEFAULT_SETTINGS.x`, and
`DEFAULT_SETTINGS` is declared `as const`. So `requireProofOnResolve` was typed `true`
rather than `boolean`, `maxComplaintsPerStudentPerDay` was typed `5` rather than
`number`, and so on — **the settings document could only ever legally hold the values
it shipped with.** The settings editor was the first code to try to change one, which
is why nothing caught it earlier. `withDefaults()` in `src/lib/services/settings.ts`
had an `as SettingsShape` cast that was quietly papering over the same thing.

Fixed by widening the type properly (an `Editable<T>` mapped type in
`src/lib/domain/constants.ts`), pointing the priority engine's `Weights` at it, and
deleting the cast — which now type-checks honestly without one.

#### Built
- **P3-11 — `/track`.** `src/app/track/{page.tsx,TrackForm.tsx}`. The API was already
  finished; the page was linked from the landing page and the header and 404ed.
- **P8-6 — `/transparency`.** `src/app/transparency/page.tsx`. `force-dynamic`, and it
  catches its own database read so an outage shows an empty state rather than a stack
  trace.
- **`PublicHeader`.** The landing page's top bar was about to be copy-pasted twice, so
  it moved to `src/components/layout/PublicHeader.tsx` and all three pages use it.
- **P9-3 — error pages.** `error.tsx`, `global-error.tsx`, `not-found.tsx`.
- **P9-6 — PWA manifest.** `src/app/manifest.ts` (generated, so it picks up the
  branding env vars) and `public/icon.svg`. `layout.tsx` had been referencing a
  manifest that did not exist, 404ing on every page load.
- **P9-4 — loading skeletons.** `src/components/shared/skeletons.tsx` plus six
  `loading.tsx` files.
- **P6-6 — daily SLA digest.** Step 6 of the cron sweep. The sweep runs every 15
  minutes, so the digest self-limits to one send per 20 hours using the `SystemLog`
  row it writes (`source: sla-digest`) — state in the database, so it survives
  redeploys. RTs get their own hostel; the Warden and Coordinator get all three.
- **P7-9 — bulk actions.** `POST /api/complaints/bulk` plus
  `src/components/staff/BulkActions.tsx`. Every id goes through the same
  `loadComplaint` + `transitionStatus` / `assignWorker` path as the single-complaint
  routes, so hostel scoping, the state machine, the timeline and the e-mails are
  identical — no shortcut around the rules. Partial success by design: a complaint
  that cannot legally make the transition is skipped and reported, and the rest still
  go through. Bulk assign is disabled for a mixed-hostel selection, because workers
  serve one hostel.
- **`scripts/createStaff.ts`.** `package.json` had a `create-staff` script pointing at
  a file that did not exist. It is the bootstrap path — the first Coordinator has
  nobody to create them — and the recovery path when everyone is locked out. It prints
  the temporary password instead of e-mailing it, so it works before SMTP exists.
- **P9-2 — Content-Security-Policy.** Nonce-based, built per request in
  `middleware.ts` and echoed onto the request headers so Next stamps its own scripts.
  Also removed a dead `isPublic` / `PUBLIC_PATHS` pair that was kept alive only by a
  `void isPublic;` — misleading code to leave sitting in a security file.

#### P9-8 — lint, run for the first time
8 errors and 5 warnings. Fixed as follows rather than blanket-suppressed:
- **4 × `set-state-in-effect`** — fixed properly. A `useHydrated()` hook
  (`useSyncExternalStore`) replaced two mount-guard effects; `loadingWorkers` in
  `StaffActions` became derived state; the mobile nav now closes on link click, which
  also fixes tapping the link for the page you are already on.
- **3 × `purity` (`Date.now()` during render)** — these are all server components, so
  the clock is read once per request and there is no client render to disagree with.
  Suppressed with an `eslint-disable-next-line` and a comment saying why.
- **1 dead helper** (`staffLink` in `templates.ts`) and one unused import, deleted.

#### First time in a browser
Started `next dev` and exercised everything that works without a database. This
immediately earned its keep: **the new CSP blocked `next-themes`' pre-paint theme
script**, which would have shipped a broken theme to production. next-themes needs the
nonce passed to it explicitly, so `layout.tsx` now reads the `x-nonce` header and hands
it to `Providers`. Re-verified: the theme script carries a nonce, React hydrates
(controlled inputs hold typed values), `/track`, `/transparency`, the 404 page and
`/manifest.webmanifest` all render.

The cost, stated plainly: reading `headers()` in the root layout opts every route into
dynamic rendering, so `/login`, `/register` and the other auth pages are no longer
statically prerendered. That is the documented price of a nonce-based CSP and worth it
here, but it is a real trade.

**End state:** typecheck, lint and build all clean. Everything that can be built
without credentials is built. What remains is documentation (P10-1…4), the
accessibility and mobile passes (P9-5, P9-7), and everything blocked on you.

---

### session-01 — 2026-09-02

**Goal:** Establish the design contract and the tracking system, then build as much
of the system as possible.

#### Part 1 — the three tracking documents (as requested)
- `docs/SYSTEM_ARCHITECTURE.md` (v1.0) — goals, roles, permission matrix, reg-no
  contract, all 12 collections with fields and indexes, the nine-state lifecycle
  with legal transitions and guards, the priority formula, SLA tables, escalation
  rules E1–E7, the zero-cost stack with justification, the API surface, the media
  upload flow, the notification matrix, security controls, non-functional targets,
  the 11-phase plan, and 10 ADRs.
- `project-state.yml` — machine-readable state: domain constants, locked stack,
  every phase broken into numbered tasks with individual statuses, an inventory of
  what actually exists, the env-var list, 16 acceptance criteria, open questions.
- `docs/PROJECT_PROGRESS.md` — this file.

#### Part 2 — the build
Scaffolded Next.js 16.3.4 + React 19 + TypeScript + Tailwind v4, installed the
dependency set, then built, in order:

**Domain layer** (`src/lib/domain/`) — the heart of the system, kept free of any
framework or database concern so the rules are readable and testable:
- `constants.ts` — 3 hostels, 4 roles, 9 statuses, 4 severities, 15 categories
  (each with a default severity, a default trade, and a safety flag), 10 trades,
  19 audit actions, and all default settings.
- `regNo.ts` — parse/normalise/validate/mask, plus `explainRegNoError()` which
  tells a student *why* their registration number was rejected instead of just
  refusing it.
- `statusMachine.ts` — the only place a status change is authorised. Each
  transition declares who may perform it and what payload it requires.
- `priority.ts` — the score, plus `explainPriority()` so staff can see *why* a
  complaint sits at the top of their queue.
- `sla.ts` — due dates, breach detection, ageing buckets, and `evaluateEscalation()`
  which is the single source of truth for the G6 and G7 button states.

**Data layer** — 12 Mongoose models with the indexes that back the real query
patterns, plus TTL indexes on notifications, OTPs, rate limits, sent mail and
system logs so the 512 MB free cluster does not fill up.

**Auth** — JWT in an httpOnly cookie, bcryptjs, central RBAC in
`permissions.ts`, `tokenVersion` for instant revocation, OTP password reset,
middleware for route protection and the CSRF origin check.

**Complaints** — creation with media, role-scoped listing with filters and
search, detail with a visibility-filtered timeline, guarded status transitions,
worker assignment, severity override, comments and internal notes.

**Media** — signed direct-to-Cloudinary upload, a multi-image picker, and an
in-browser voice recorder built on `MediaRecorder` with a live level meter and a
120-second cap.

**Escalation** — all seven rules, plus the `/api/cron/sweep` endpoint and the
GitHub Actions workflow that drives it every 15 minutes.

**Notifications** — a three-provider mail adapter, ten HTML e-mail templates with
plain-text fallbacks, a Mongo-backed retry queue, and the in-app bell.

**UI** — landing page, auth pages, the student panel (dashboard, complaint form,
detail with escalation/dispute/confirm actions, hostel feed, notices,
notifications), and the staff panel (dashboard, queue with filters, detail with
the full action set, workers, analytics with Recharts, announcements, audit log,
user management, system settings).

#### Key design calls made this session
1. **Cloudinary over GridFS.** Atlas M0 gives 512 MB total; one term of hostel
   photos and voice notes would exhaust it. Cloudinary's free tier (25 GB storage,
   25 GB bandwidth) handles both, behind an adapter so it can be swapped.
2. **GitHub Actions as the scheduler.** Vercel Hobby cron fires only once a day,
   which cannot drive a 24-hour escalation clock. A workflow hitting a
   `CRON_SECRET`-guarded endpoint every 15 minutes is free and precise.
3. **Escalation modelled as `escalationLevel` + `isDisputed`**, keeping `status`
   purely about the work. This is what lets "escalated but in progress" be true.
4. **The false-resolution flag (G7) both reopens and disputes**, and increments a
   counter against the staff member who marked it resolved. That counter is what
   makes the accountability report meaningful rather than decorative.
5. **A 404, not a 403, when an RT opens another hostel's complaint** — so staff
   cannot probe for the existence of complaints outside their scope.
6. **Priority is denormalised onto the document.** MongoDB cannot sort and
   paginate on a computed value, so the score is stored and refreshed on every
   mutation and by the sweep (which is what makes *age* actually move).
7. **The public tracking endpoint requires both the ticket number and the
   registration number**, and returns a deliberately thin view — no description,
   no photos, no contact details.

#### Problems hit and how they were resolved
| Problem | Resolution |
|---|---|
| Bash heredocs mangled quoted content, breaking the first attempt at writing the architecture doc | Switched to the Write tool for anything large; heredocs still used for short files |
| Mongoose 9 removed the exported `FilterQuery` type | Queries typed as `Record<string, unknown>` and cast at the call site |
| `nodemailer` rejected `pool: false` under `SMTPTransport.Options` | Removed it — non-pooled is the default anyway, which is what serverless wants |
| `create-next-app` refused to scaffold into a non-empty directory | Moved `project-state.yml` aside for the duration of the scaffold |
| `IAttachment.uploadedAt` was required in TypeScript but defaulted in the schema | Made it optional in the interface |

#### Deliberately not done
- **Worker self-service portal** (workers updating their own job status via a magic
  link). Out of scope for v1 — RTs update on their behalf. Revisit after P8.
- **SMS / WhatsApp notifications.** No reliable free tier exists in Pakistan.
- **Urdu translation.** Strings are structured for it; the translation itself is deferred.
- **Duplicate detection.** The `duplicateOf` field exists on the model and the
  hostel feed lets residents upvote instead of filing a duplicate, but automatic
  detection is not built.
- **Automated tests.** No test suite yet. Given the domain logic is pure
  functions (`priority.ts`, `sla.ts`, `statusMachine.ts`, `regNo.ts`), that is the
  obvious place to start when tests are added.

#### Risks logged
| Risk | Impact | Mitigation |
|---|---|---|
| **Nothing has been run against a database** | Unknown runtime bugs | Planned as P10-7: walk every acceptance criterion the moment `MONGODB_URI` arrives |
| Gmail SMTP daily cap (500) or the account being flagged | E-mails stop | Adapter supports Brevo and Resend; the queue retries; in-app notifications never depend on SMTP |
| Atlas M0 512 MB fills up | Writes fail | Media offloaded to Cloudinary; TTL indexes on notifications, OTPs, rate limits, sent mail and logs; CSV export for archiving |
| Vercel Hobby is non-commercial only | Terms violation if the institute monetises it | It is a free student-welfare tool — compliant. To be documented in `DEPLOYMENT.md` |
| Students abusing the escalation button | Warden inbox flooded | 24 h cooldown per complaint, rate limit of 3 per day, a written reason is required |
| An RT marking everything resolved to game the SLA | False accountability | Proof photo required on resolve, student verification, the dispute flag, and a dispute counter on the RT scorecard |
| The GitHub Actions sweep silently stopping | Nothing auto-escalates | Every sweep writes a run record to `system_logs`, visible on the audit page |

---

## CHANGELOG

| Date | Version | Change |
|---|---|---|
| 2026-09-02 | 0.4.0 | Full build: domain layer, 12 models, auth, complaints, media, escalation, notifications, student panel, staff panel, analytics. Typecheck and build green. Tracking documents corrected against the actual file inventory. |
| 2026-09-02 | 0.1.0 | Architecture, state file and progress log created. |
