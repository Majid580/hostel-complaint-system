# Hostel Complaints — UET Narowal

A complaint system for the three hostels at the University of Engineering and
Technology, Narowal. A student reports a broken thing from their phone; it reaches
the right Resident Tutor and the Hostel Warden the same second; and every step after
that is recorded where the student can see it.

It runs entirely on free tiers.

---

## The problem it solves

Most hostel complaint registers fail in the same three ways. Each one has a rule here
that closes it:

| Failure | The rule |
|---|---|
| **Nobody responded.** | After 24 hours of no action the student gets an *Escalate to Warden* button — and the scheduled sweep escalates it anyway, even if the student forgets. |
| **Marked done, but it isn't done.** | For 24 hours after staff mark a complaint resolved, the student can report that the work was never done. It reopens, is flagged as disputed, and the Warden and Coordinator are both e-mailed. |
| **No record of what happened.** | Every acknowledgement, assignment, note and status change is written to an append-only timeline. Nobody — not even the Coordinator — can edit or delete an entry, and the student can read all of it. |

Two more controls matter:

- **Students are read-only on status.** They can create, comment, upvote, confirm,
  reopen, escalate, dispute and rate. They cannot move a complaint through the
  workflow, and the API enforces this at two layers.
- **Proof photos are required to resolve.** On by default; a Coordinator can turn it
  off. This is the main defence against complaints being closed without the work
  being done.

---

## Roles

| Role | Sees | Can do |
|---|---|---|
| **Student** | Only their own complaints, plus an anonymised feed for their hostel | File, comment, upvote, escalate after 24 h, dispute a resolution, confirm and rate |
| **Resident Tutor** | One hostel — theirs | Acknowledge, assign a worker, update status, resolve with proof |
| **Hostel Warden** | All three hostels | Everything an RT can do, plus escalations, disputes and CSV export |
| **Campus Coordinator** | All three hostels | Everything, plus staff accounts and system settings |

The wall between hostels is real: an RT requesting a complaint from another hostel
gets a `404`, not a `403`, so the system never confirms that it exists.

---

## Stack

Everything here has a permanent free tier.

| | |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript |
| Database | MongoDB Atlas M0 via Mongoose 9 |
| Auth | `jose` JWT in an httpOnly cookie · bcryptjs |
| Media | Cloudinary — the browser uploads **directly**, signed server-side |
| E-mail | Nodemailer (Gmail or Brevo), with `console` and Resend adapters |
| Hosting | Vercel Hobby |
| Scheduler | GitHub Actions cron every 15 minutes → `POST /api/cron/sweep` |

Vercel Hobby's cron fires once a day, which cannot drive a 24-hour escalation clock —
hence the GitHub Actions workflow in `.github/workflows/cron.yml`.

---

## Running it locally

```bash
npm install
cp .env.example .env.local     # then fill in MONGODB_URI and JWT_SECRET
npm run db:indexes
npm run seed
npm run dev
```

The seed creates 5 staff accounts, 7 workers, 4 demo students and 6 demo complaints.
It prints every sign-in at the end. Re-running it updates rather than duplicates.

**The minimum to start:** `MONGODB_URI` and `JWT_SECRET`. Without Cloudinary, uploads
return a clear `503` and text complaints still work. Without SMTP, `MAIL_PROVIDER=console`
prints e-mails to the server log and in-app notifications work regardless.

### Scripts

| | |
|---|---|
| `npm run dev` | Development server |
| `npm run seed` | Seed settings, staff, workers and demo data |
| `npm run create-staff` | Create one staff account from the CLI — the bootstrap path for the first Coordinator, and the way back in if everyone is locked out |
| `npm run db:indexes` | Sync indexes (production does not auto-index) |
| `npm run sweep` | Run the escalation sweep once, by hand |
| `npm run typecheck` · `npm run lint` · `npm run build` | |

---

## How a complaint moves

```
SUBMITTED ─→ ACKNOWLEDGED ─→ ASSIGNED ─→ IN_PROGRESS ─→ RESOLVED ─→ VERIFIED_CLOSED
     │             │             │            │             │
     └─────────────┴─────────────┴────────────┘             ├─→ REOPENED  (student disputes)
                          ↓                                 └─→ auto-close after 72 h
                      REJECTED  (written reason required)
```

Escalation is a **level (0 / 1 / 2), not a status** — a complaint can be *in progress*
and *escalated at the same time*, which is the honest representation. Level 1 is the
Warden, level 2 the Campus Coordinator.

Priority is a computed score, not a field anyone sets: severity, age, upvotes,
escalation level, reopen count, SLA breaches and safety category all feed it.

### Deadlines

| Severity | Acknowledge | Resolve |
|---|---|---|
| Critical | 2 h | 8 h |
| High | 4 h | 24 h |
| Medium | 12 h | 72 h |
| Low | 24 h | 168 h |

All of these are editable at runtime under **System settings** by the Coordinator.

---

## Project documentation

| File | What it is |
|---|---|
| `docs/SYSTEM_ARCHITECTURE.md` | The design contract — collections, lifecycle, escalation rules, ADRs |
| `docs/API.md` | Every endpoint — request/response shapes, error codes, rate limits |
| `docs/USER_GUIDE.md` | Walkthroughs for each role, and the two public pages |
| `docs/DEPLOYMENT.md` | The free-tier runbook — Atlas through backups, numbered end to end |
| `docs/PROJECT_PROGRESS.md` | Session-by-session narrative: what changed, what broke, what is next |
| `project-state.yml` | Machine-readable state — phases, tasks, blockers, acceptance criteria |

**Read `project-state.yml` first** when picking the work back up. It records what is
verified against a real database versus what merely type-checks, which is not the same
thing.

---

## Status

15 of 16 acceptance criteria are verified end-to-end against a real MongoDB Atlas
database on a production build. Typecheck, lint, and an automated contrast audit
(`npm run check:contrast`) are all clean. A weekly encrypted database backup runs
on a schedule via GitHub Actions.

Everything that can be finished without a browser and a Vercel account is done.
What's left is the deployment itself — `docs/DEPLOYMENT.md` is a complete,
numbered runbook for it — after which the sixteenth acceptance criterion (zero
running cost) can actually be checked rather than claimed.
