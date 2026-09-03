# Deployment runbook

Getting Hostel Complaints onto the internet for **PKR 0/month**. Everything below has
a permanent free tier — no card, no trial that expires.

Budget about an hour the first time. Work top to bottom; each step depends on the one
before it.

---

## Before you start

You need accounts for: MongoDB Atlas, Cloudinary, GitHub, Vercel, and a mailbox you
can generate an app password for (Gmail works).

---

## 1 · Database — MongoDB Atlas

1. Create a free **M0** cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. **Choose the region deliberately.** This is the single biggest performance
   decision in the whole deployment. Every page load costs one or more round trips
   to this cluster, and from the wrong region that is 250 ms each instead of 20 ms.
   Pick the region closest to Narowal — `ap-south-1` (Mumbai) is normally the right
   answer — and use the matching Vercel region in step 5.
3. **Database Access** → add a user with a strong generated password. Do not use
   `root`/`root`. If the password contains `@ : / ?` you must URL-encode it in the
   connection string.
4. **Network Access** → allow `0.0.0.0/0`. Vercel has no fixed egress IPs, so this is
   unavoidable on the free tier; the database user's password is what protects you,
   which is why step 3 matters.
5. Copy the connection string and add the database name:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/hcms?retryWrites=true&w=majority
   ```

> **If local development fails with `querySrv ECONNREFUSED`, the cluster is not
> down.** `mongodb+srv://` needs a DNS SRV lookup, and some ISP resolvers refuse
> SRV queries outright — they return a referral instead of the record. Check it:
>
> ```bash
> nslookup -type=SRV _mongodb._tcp.cluster0.xxxxx.mongodb.net 8.8.8.8
> ```
>
> If Google DNS answers and your default resolver does not, that is the cause.
> Either point the machine at `8.8.8.8` / `1.1.1.1`, or use the non-SRV form of
> the string, which lists the replica-set members and skips the lookup entirely
> (Atlas → Connect → Drivers → "Node.js 2.2.12 or later"). Vercel's DNS handles
> SRV correctly, so production can keep the `+srv` string either way.

---

## 2 · Media — Cloudinary

1. Sign up free at [cloudinary.com](https://cloudinary.com/users/register_free).
2. From the Dashboard copy **Cloud name**, **API key** and **API secret**.

No upload preset to configure: this app signs every upload server-side and creates its
own folders (`hcms/complaints/…`, `hcms/proofs/…`).

The free tier is 25 monthly credits — roughly 25 GB of storage and 25 GB of delivery.
Hostel photos will not come close.

---

## 3 · E-mail

Goal G2 is that a complaint reaches the RT and the Warden by e-mail. Pick one:

**Gmail (500/day, easiest)** — enable 2-Step Verification on the account, then create
an *App Password* and use it as `SMTP_PASS`:
```
MAIL_PROVIDER="smtp"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="hostel.complaints@gmail.com"
SMTP_PASS="the-16-character-app-password"
MAIL_FROM="Hostel Complaints <hostel.complaints@gmail.com>"
```

**Brevo (300/day)** — SMTP & API → SMTP keys. Host `smtp-relay.brevo.com`, port `587`,
`SMTP_SECURE="false"`.

Leaving `MAIL_PROVIDER="console"` is a valid choice for a pilot: e-mails are printed
to the server log and **in-app notifications still work**. Only the e-mail channel is
lost.

---

## 4 · Push to GitHub

```bash
git add -A
git commit -m "Hostel complaint system"
git branch -M main
git remote add origin https://github.com/<you>/hostel-complaints.git
git push -u origin main
```

`.env*` is git-ignored. Confirm before pushing:

```bash
git ls-files | grep -i env
```

That must print `.env.example` and nothing else.

---

## 5 · Deploy to Vercel

1. [vercel.com/new](https://vercel.com/new) → import the repository. Next.js is
   detected automatically; no build settings to change.
2. **Set the function region to match your Atlas region** (Project → Settings →
   Functions). Mumbai Atlas with a Washington Vercel region will make every page
   slow, and no amount of code tuning will fix it.
3. Add the environment variables below to **Production, Preview and Development**.
4. Deploy, then set `NEXT_PUBLIC_APP_URL` to the real URL and redeploy — e-mail links
   are built from it.

### Environment variables

| Variable | Notes |
|---|---|
| `MONGODB_URI` | From step 1 |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app`, no trailing slash |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | From step 2 |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Same value as the cloud name |
| `MAIL_PROVIDER`, `MAIL_FROM`, `SMTP_*` | From step 3 |
| `CRON_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXT_PUBLIC_INSTITUTE_NAME` | `University of Engineering and Technology Narowal` |
| `NEXT_PUBLIC_INSTITUTE_SHORT` | `UET Narowal` — used in tight mobile headers |
| `NEXT_PUBLIC_APP_NAME` | `Hostel Complaints` |
| `SESSION_CACHE_TTL_MS` | Optional, default `15000`. See the note at the end. |

---

## 6 · The scheduler

The 24-hour escalation clock needs a run every 15 minutes. Vercel Hobby's cron only
fires once a day, so `.github/workflows/cron.yml` does it instead.

In the GitHub repo → **Settings → Secrets and variables → Actions**, add:

- `APP_URL` — your production URL
- `CRON_SECRET` — the same value you set on Vercel

Then run the workflow once by hand (Actions → the workflow → *Run workflow*) and
confirm it returns `200`. Verify from your machine too:

```bash
curl -X POST https://your-app.vercel.app/api/cron/sweep -H "x-cron-secret: YOUR_SECRET"
```

It should return a JSON report. A wrong secret must return `403`.

**Without this, nothing escalates automatically.** Students can still escalate by
hand, but the safety net that catches ignored complaints is off.

---

## 7 · Seed production

Point `.env.local` at the production database, then create the real staff accounts.

Do **not** seed demo data into production:

```bash
SEED_DEMO_DATA=false npm run seed
```

Or create accounts one at a time — the better option once you have real names:

```bash
npm run create-staff -- --role COORDINATOR --name "Full Name" --email name@uetnarowal.edu.pk
npm run create-staff -- --role WARDEN       --name "Full Name" --email name@uetnarowal.edu.pk
npm run create-staff -- --role RT --hostel GIRLS  --name "Full Name" --email name@uetnarowal.edu.pk
npm run create-staff -- --role RT --hostel QASIM  --name "Full Name" --email name@uetnarowal.edu.pk
npm run create-staff -- --role RT --hostel FATIMA --name "Full Name" --email name@uetnarowal.edu.pk
```

Each prints a temporary password once. Pass it on over a channel you trust — everyone
is forced to change it at first sign-in.

Then sync indexes against production:

```bash
npm run db:indexes
```

---

## 8 · Backups

Atlas M0 has **no automated backups** — this is the only safety net for the
database. `.github/workflows/backup.yml` runs `mongodump` every Sunday at 03:00
UTC, encrypts the dump, and keeps a rolling window of the last 8 (about two
months) on a dedicated `backups` branch of this repo. No new account, no paid
storage — just GitHub, which you already have.

**The dump is encrypted before it ever leaves the runner.** It contains password
hashes and student PII — name, e-mail, phone, room number, registration number —
so it must never sit in plaintext anywhere, including a private repo.

Add two more repository secrets (**Settings → Secrets and variables → Actions**):

| Secret | Value |
|---|---|
| `MONGODB_URI` | The same connection string as production. This is a *separate* secret from Vercel's env var — GitHub Actions and Vercel don't share secrets. |
| `BACKUP_ENCRYPTION_KEY` | A long random passphrase: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. **Store this somewhere durable outside GitHub too** — a password manager, printed and locked away. If you lose it, every backup encrypted with it is permanently unreadable. |

Trigger it once by hand (Actions → *Weekly database backup* → *Run workflow*) and
confirm the `backups` branch appears with one file in it.

**Restoring**, if it's ever needed:

```bash
git clone --branch backups --depth=1 https://github.com/<you>/<repo>.git /tmp/hcms-backups
cd /tmp/hcms-backups

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in backup-2026-09-07.gz.enc -out dump.gz \
  -pass "pass:YOUR_BACKUP_ENCRYPTION_KEY"

# Into the SAME database, merging with what's there:
mongorestore --uri="$MONGODB_URI" --gzip --archive=dump.gz

# Into a brand-new empty database instead, to inspect a backup safely first
# without touching production:
mongorestore --uri="mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/hcms-restore-test?retryWrites=true&w=majority" \
  --gzip --archive=dump.gz
```

Never run `mongorestore --drop` against production without being certain — it
deletes each collection before restoring into it.

---

## 9 · Smoke test

Walk this in order on the live site. It exercises every rule that matters.

1. Register a student with a real registration number, e.g. `2023-CS-580`.
2. File a complaint with a photo and a voice note.
3. Confirm the RT for that hostel **and** the Warden received the e-mail.
4. Sign in as that RT — the complaint is at the top of the queue.
5. Sign in as a *different* hostel's RT — that complaint must be invisible (`404`).
6. Acknowledge, assign a worker, resolve with a proof photo.
7. As the student, confirm the fix and leave a rating.
8. Check `/transparency` in a private window — figures, no sign-in.
9. Check `/track` with the ticket number and registration number.

---

## Running costs

| | |
|---|---|
| Vercel Hobby | Free |
| MongoDB Atlas M0 | Free — 512 MB |
| Cloudinary | Free — 25 credits/month |
| Gmail SMTP | Free — 500/day |
| GitHub Actions | Free — well inside the public-repo allowance |

512 MB holds a very large number of complaints; photos live in Cloudinary, not in
Mongo. The realistic first limit is Cloudinary storage, years out.

---

## Notes for later

**`SESSION_CACHE_TTL_MS`.** Verifying a session costs one database round trip, paid by
every authenticated request. The default caches that check for 15 seconds in the warm
serverless instance. The trade: deactivating an account can take up to that long to
take effect on an instance that did not perform the change (the one that did clears it
immediately). Set it to `0` to check on every request instead.

**Rotate anything that has been shared.** Database passwords and the Cloudinary API
secret both grant full access to their service.
