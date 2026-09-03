# User guide

Hostel Complaints, walked role by role. If you manage the system rather than use
it day to day, `docs/DEPLOYMENT.md` is the runbook and `docs/API.md` the endpoint
reference.

---

## Signing in

Go to the app and choose **Sign in**.

- **Students** sign in with their **registration number** (e.g. `2023-CS-580`) or
  their e-mail, plus their password.
- **Staff** (RT, Warden, Coordinator) sign in with e-mail only.

New here as a student? **Create a student account** — you need your registration
number, your e-mail, and which hostel you live in. You only do this once.

**First sign-in as staff:** every staff account is created with a temporary
password and you're required to change it before doing anything else. That's not
a bug — it's how a Coordinator hands you access without ever knowing your real
password.

**Forgot your password?** *Forgot your password?* on the sign-in page sends a
6-digit code to your e-mail, valid for 10 minutes. Using it signs you out of every
other device you were signed into, as a precaution.

---

## Student

### Filing a complaint
Tap **File a complaint** (top of your list, or **Report** in the bottom bar on a
phone).

1. **What kind of problem is it?** — pick a category. This decides who it's routed
   to and how it's prioritised.
2. **Describe the problem** — a short title, then details: what's broken, since
   when, how it affects you. Add a location if it helps ("second floor washroom").
   Attach up to 5 photos and one voice note (2 minutes max) — genuinely useful:
   staff assign a worker faster when they can see the problem.
3. **How urgent?** — pick severity honestly. *Critical* means a safety, health or
   security risk right now; it gets a 2-hour acknowledgement deadline and pulls in
   the Warden automatically. Overstating it doesn't make repairs faster — the
   Resident Tutor still assigns a real worker either way — but it does compete
   with someone else's Critical for attention.
4. Optionally file **anonymously** — other students never see your name on it, but
   staff always do; anonymity is between residents, not from the people who fix
   things.

Submitting sends it immediately to your hostel's Resident Tutor and the Hostel
Warden by e-mail, and gives you a ticket code like `HCMS-2026-000123`. Write it
down — with your registration number, anyone (even signed out) can look up its
status at **Track a complaint** on the home page.

### Following it
Your complaint's page shows a progress bar — *Submitted → Acknowledged → Assigned
→ In progress → Resolved → Closed* — and a full timeline of every action taken,
by whom, and when. Nothing on that timeline can be edited or deleted, by anyone,
including the Coordinator.

**When it's marked Resolved**, you're asked to confirm:
- **It's actually fixed** — confirm, optionally rate 1–5 stars. Done.
- **It isn't** — within 24 hours of the resolved mark, you can flag it. This
  reopens it, marks it disputed, and e-mails both the Warden and the Coordinator
  with your name attached to the report and staff's name attached to the false
  resolution. Use it for real disputes, not impatience — it's a serious signal.

If you do nothing for 72 hours after it's marked resolved, it closes on its own.

**If nothing happens at all** — no acknowledgement, no assignment — for 24 hours,
an **Escalate to the Warden** button appears on the complaint. You don't have to
use it; the system escalates automatically too, on the same clock. The button
just means you don't have to wait for that to happen.

You *cannot* set a complaint's status yourself — not even to close your own. That
control belongs entirely to staff and to the rules above. If you try through the
API directly, you'll get a clear "students cannot do that" rather than a silent
failure.

### Everything else on your dashboard
- **Hostel feed** — an anonymised view of what everyone else in your hostel has
  reported, so you can see a problem is already known (and add a "me too" upvote,
  which raises its priority) instead of filing a duplicate.
- **Notices** — announcements from your RT, Warden, or the Coordinator. Some are
  informational ("water shut off Sunday morning") — read those before filing
  something they already explain.
- The bell icon is your notification history — every status change on your own
  complaints, plus notices addressed to you.

---

## Resident Tutor (RT)

You see and act on complaints from **your hostel only**. A complaint filed
against another hostel is invisible to you — not filtered out of a list, genuinely
inaccessible, `404` if you try the URL directly.

### Your dashboard
Four counts up top — **Needs action**, **Escalated**, **Past deadline**,
**Disputed** — each a shortcut into that filtered slice of your queue. Below that,
your performance this period (SLA compliance, average resolution time, average
rating) and an ageing breakdown of what's still open.

### Working a complaint
Open one from the queue (sorted by priority — severity, age, and a few other
signals combined, so the thing that matters most is at the top, not just the
newest).

1. **Acknowledge** — stops the acknowledgement-SLA clock. Do this the moment
   you've seen it, even before you have a worker lined up.
2. **Assign a worker** — from your registered worker list, with an expected
   completion date if you have one. The student is notified immediately, by name.
3. **In progress** once work starts, **On hold** with a reason if it stalls.
4. **Resolve** — attach a proof photo of the completed work (required by default;
   the Coordinator can turn this off, but it's your best defence against a
   dispute). The student is asked to confirm.

**Register your workers first** (once, under **Workers**) — name, phone, trade,
which hostel(s) they cover. You can't assign someone who isn't registered.

**Bulk actions**: select several complaints in the queue to acknowledge, assign
the same worker to all of them, or close several at once. Anything that can't
legally make that jump (already past it, already closed) is skipped and reported
back — the rest still go through.

### Notices
Post one under **Notices** for your hostel — a burst pipe, a scheduled outage,
anything worth telling residents before they file ten complaints about it.

---

## Hostel Warden

Everything an RT can do, across **all three hostels**, plus the escalation and
dispute view: filter the queue to `Escalated` or `Disputed` to see what actually
needs your attention rather than every hostel's whole backlog.

**Escalations reach you** two ways: a student presses *Escalate*, or the system
does it automatically after 24 hours of no activity. Either way you get an
e-mail and it shows on your dashboard.

**Disputes reach you and the Coordinator together**, always, with the name of
whoever marked the complaint resolved. Investigate — this is the signal that a
resolution wasn't real.

**CSV export**, under the queue view, is Warden-and-Coordinator only: every
complaint, 33 columns, opens correctly in Excel. Useful for a report to the
administration or an offline audit.

You do **not** manage staff accounts or system settings — that's Coordinator-only.

---

## Campus Coordinator

Everything a Warden can do, plus administration.

### Staff accounts (**Staff accounts**)
Create RT, Warden, or Coordinator accounts. An RT must be tied to one hostel, and
the system enforces **exactly one active RT per hostel** — creating a second for
a hostel that already has one is refused; deactivate the current one first.

Each new account gets a temporary password, e-mailed and shown to you once in
case the e-mail doesn't land. They're forced to change it on first sign-in.

**Deactivating** an account ends their sessions immediately, everywhere — not
"the next time they'd have to sign in," but right now. You can't deactivate or
demote your own account, so the system can't lock you out of itself.

### System settings (**System settings**)
Everything numeric that governs the system, editable without a deployment:

- **Response deadlines** — acknowledge/resolve hours per severity.
- **Escalation windows** — how long before a student can escalate, before the
  system auto-escalates, before it reaches you (level 2), before an unconfirmed
  resolution auto-closes.
- **Policy** — require a proof photo to resolve (strongly recommended, on by
  default), allow anonymous filing, max complaints per student per day, and
  whether to restrict registration to one e-mail domain.
- **Departments** — the codes your institute issues (`CS, BSCPE, EE, ARCH, CE, ME,
  BME` for UET Narowal). A registration number outside this list is rejected at
  sign-up. Add one here the day a new programme opens — no code change needed.

**Every change here is logged** — what changed, the before and after values, and
your name — visible in **Audit log**.

### Audit log
The permanent record: every settings change, every system-level event. Nobody,
including you, can edit or delete an entry.

---

## Public pages (no sign-in)

- **Track a complaint** (`/track`) — ticket code + registration number, both
  required, shows status and progress. Never the description, photos, voice note,
  or internal notes.
- **Transparency** (`/transparency`) — anonymised per-hostel statistics: volume,
  SLA compliance, average resolution time. Nobody is identifiable. Refreshed
  every couple of minutes, not computed live on every visit.

---

## Things that surprise people

- **A rejected complaint always carries a written reason** — staff can't just
  dismiss one silently.
- **The severity you pick doesn't fast-track your own complaint past the queue** —
  it changes the deadline staff are held to, and where it sorts among everyone
  else's. Marking something Critical that isn't wastes attention that a genuine
  emergency needs.
- **Nothing on the timeline can ever be edited or deleted** — that's deliberate;
  it's the whole accountability model. A mistake gets a new entry correcting it,
  not a rewritten history.
- **A worker can't be deleted while they have open jobs** — reassign those first.
  History for a deactivated worker stays intact.
