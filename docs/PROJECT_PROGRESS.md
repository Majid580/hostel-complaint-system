# HCMS — Project Progress Log

> **Read after `project-state.yml`.** This file is the human-readable narrative:
> what changed, what works, what is next, and what is deliberately not done yet.
>
> Convention: newest session at the **top**. Never delete history — append.

---

## STATUS AT A GLANCE

| | |
|---|---|
| **Current phase** | **P0 — Foundation** |
| **Overall progress** | ~4 % |
| **Last session** | session-01 · 2026-09-02 |
| **Build state** | Not yet scaffolded |
| **Deployed** | No |
| **Blocked on** | MongoDB URI, Cloudinary keys, SMTP creds, real staff e-mails (all from the user) |

### Phase board
| Phase | Name | Status |
|---|---|---|
| P0 | Foundation | 🟡 in progress |
| P1 | Data layer & domain logic | ⚪ pending |
| P2 | Authentication & authorisation | ⚪ pending |
| P3 | Complaint core | ⚪ pending |
| P4 | Media (images + audio) | ⚪ pending |
| P5 | Escalation, SLA & accountability | ⚪ pending |
| P6 | Notifications | ⚪ pending |
| P7 | Staff panels | ⚪ pending |
| P8 | Analytics & transparency | ⚪ pending |
| P9 | Hardening & polish | ⚪ pending |
| P10 | Deployment & handover | ⚪ pending |

---

## NEXT ACTIONS (do these first in the next session)

1. **P0-4** Scaffold the Next.js + TypeScript + Tailwind application in the repo root.
2. **P0-5** Install the locked dependency set (see `stack:` in `project-state.yml`).
3. **P0-6 / P0-7** Design tokens, dark mode, and the base UI primitive set.
4. **P0-8** `.env.example` + `src/lib/config/env.ts` with fail-fast runtime validation.
5. **P0-9** Serverless-safe Mongoose connection cache.
6. **P0-11** App shell (layout, header, role-aware nav, footer, toaster).
7. Then move to **P1** — domain constants, the state machine, the priority engine and all models.

**Ask the user for** (unblocks P1-16 seeding and P6 e-mail):
- MongoDB Atlas connection string
- Cloudinary cloud name / API key / secret (free account)
- SMTP credentials (Gmail app password is easiest) + the "from" address
- Real names and e-mail addresses of the 3 RTs, the Warden and the Campus Coordinator
- Institute name (for branding)

---

## WHAT IS ALREADY DECIDED (do not re-litigate)

- **Zero-cost stack**: Next.js on Vercel Hobby + MongoDB Atlas M0 + Cloudinary free + SMTP free +
  GitHub Actions cron. Rationale and rejected alternatives are in `SYSTEM_ARCHITECTURE.md` §14.
- **Three hostels**: `GIRLS`, `QASIM`, `FATIMA`. One RT per hostel, one Warden over all three,
  one Campus Coordinator with admin rights.
- **Reg-no format**: `2023-CS-580` = `SESSION-DEPT-ROLL`, normalised before storage.
- **Escalation is a level (0/1/2), not a status** — a complaint can be in progress *and* escalated.
- **The timeline is append-only** (`complaint_events`) — this is what makes the system auditable.
- **Students are read-only on status.** They can only: create, comment, upvote, verify, reopen,
  escalate (after 24 h), flag a false resolution (after 24 h), and rate.
- **Media never passes through the serverless function** — signed direct upload to Cloudinary.

---

## SESSION LOG

### session-01 — 2026-09-02

**Goal:** Establish the design contract and the tracking system before writing any code.

**Done**
- `docs/SYSTEM_ARCHITECTURE.md` (v1.0) — full design: goals, roles, permission matrix, reg-no
  contract, all 10 collections with fields and indexes, the 9-state complaint lifecycle with legal
  transitions and guards, the priority-score formula, SLA tables, seven escalation rules (E1–E7),
  the zero-cost stack with justification, the API surface, the media upload flow, the notification
  matrix, security/privacy controls, non-functional targets, the 11-phase build plan, and 10 ADRs.
- `project-state.yml` — machine-readable state: domain constants, locked stack, every phase broken
  into numbered tasks with individual statuses, the env-var inventory, 15 acceptance criteria and
  the open questions list.
- `docs/PROJECT_PROGRESS.md` — this file.

**Key design calls made this session**
1. **Cloudinary over GridFS.** Atlas M0 gives 512 MB total; a single hostel term of photos and voice
   notes would eat it. Cloudinary's free tier (25 GB storage + 25 GB bandwidth) handles both images
   and audio and is fronted by an adapter so it can be swapped without touching feature code.
2. **GitHub Actions as the scheduler.** Vercel Hobby cron only fires once per day, which cannot
   drive a 24-hour escalation clock. A GH Actions workflow hitting a `CRON_SECRET`-guarded endpoint
   every 15 minutes is free and precise.
3. **Escalation modelled as `escalationLevel` + `isDisputed`**, keeping `status` purely about the
   work itself. This is what lets "escalated but in progress" be represented honestly.
4. **False-resolution flag (G7) reopens the complaint AND marks it disputed**, incrementing a
   counter against the RT — that counter is what makes the accountability report meaningful.
5. **Student accounts rather than anonymous ticket codes.** Escalation rights, "my complaints" and
   spam control all need an identity. Anonymous *display* is still supported (`isAnonymous`) — staff
   always see the student, other students never do.

**Not done / deferred**
- No code yet. Scaffolding starts in P0-4.
- Worker self-service portal (workers updating their own job status via a magic link) is out of
  scope for v1 — RTs update on their behalf. Revisit after P8.
- SMS/WhatsApp notifications rejected for v1: no free tier exists that is reliable in Pakistan.
- Urdu translation: string table will be structured for it, actual translation deferred.

**Risks logged**
| Risk | Impact | Mitigation |
|---|---|---|
| Gmail SMTP daily cap (500) or account flagged | E-mails stop | Adapter supports Brevo/Resend; mail queue retries; in-app notifications always work |
| Atlas M0 512 MB fills up | Writes fail | Media offloaded to Cloudinary; TTL on notifications; CSV export + archive script |
| Vercel Hobby is non-commercial only | Terms violation if the institute monetises | It is a free student-welfare tool — compliant. Documented in DEPLOYMENT.md |
| Students abusing the escalation button | Warden inbox flooded | 24 h cooldown per complaint, rate limits, escalation reason required |
| RT marks everything resolved to game the SLA | False accountability | Proof photo required on resolve + student verification + dispute flag + dispute counter on the RT scorecard |

---

## CHANGELOG

| Date | Version | Change |
|---|---|---|
| 2026-09-02 | 0.1.0 | Architecture, state file and progress log created. |
