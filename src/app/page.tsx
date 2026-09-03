import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Camera,
  Mic,
  ScrollText,
  Siren,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";
import { HOSTELS, HOSTEL_META } from "@/lib/domain/constants";
import { publicEnv } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/auth/session";
import { PublicHeader } from "@/components/layout/PublicHeader";

export default async function LandingPage() {
  const user = await getCurrentUser();
  const homeHref = user ? (user.role === "STUDENT" ? "/student" : "/staff") : "/login";

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ---------- Top bar ---------- */}
      <PublicHeader />

      <main id="main" className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="bg-grid relative border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-success" />
                Girls Hostel · Qasim Hostel · Fatima Hostel
              </span>

              <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-balance sm:text-5xl md:text-6xl">
                Report a hostel problem.
                <br />
                <span className="text-primary">Watch it actually get fixed.</span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                File a complaint with photos and a voice note in under a minute. It reaches your
                Resident Tutor and the Hostel Warden the same second. Every status change is
                recorded, timed and visible to you — and if nothing happens in 24 hours, you can
                escalate it yourself.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={user ? homeHref : "/register"}>
                  <Button size="lg">
                    {user ? "Open dashboard" : "File a complaint"}
                    <ArrowRight />
                  </Button>
                </Link>
                <Link href="/track">
                  <Button size="lg" variant="outline">
                    Track with a ticket number
                  </Button>
                </Link>
              </div>

              <p className="mt-5 text-sm text-muted-foreground">
                Free for every resident. Your registration number is all you need —{" "}
                <span className="font-mono text-foreground">2023-CS-580</span>
              </p>
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">How it works</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Four steps, and you can see exactly where your complaint is at every moment.
            </p>

            <ol className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: ClipboardList,
                  step: "01",
                  title: "Describe the problem",
                  body: "Pick your hostel and a category, write what is wrong, and add up to five photos plus a voice note if it is easier to explain out loud.",
                },
                {
                  icon: BellRing,
                  step: "02",
                  title: "It reaches the right people",
                  body: "Your hostel's Resident Tutor and the Hostel Warden are e-mailed immediately. Nothing sits in a register waiting to be noticed.",
                },
                {
                  icon: UserCheck,
                  step: "03",
                  title: "A worker is assigned",
                  body: "The RT assigns a named electrician, plumber or technician with an expected completion date. You see who and when.",
                },
                {
                  icon: CheckCircle2,
                  step: "04",
                  title: "You confirm the fix",
                  body: "Staff must attach a photo of the completed work. It only closes when you confirm it is genuinely done.",
                },
              ].map((item) => (
                <li key={item.step}>
                  <Card className="h-full">
                    <CardContent className="p-5 pt-5">
                      <div className="flex items-center justify-between">
                        <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
                          <item.icon className="size-5" />
                        </span>
                        <span className="font-mono text-xs font-bold text-muted-foreground">
                          {item.step}
                        </span>
                      </div>
                      <p className="mt-4 font-semibold leading-tight">{item.title}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Accountability ---------- */}
        <section className="border-b border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold sm:text-3xl">
                Built so complaints cannot quietly disappear
              </h2>
              <p className="mt-2 text-muted-foreground text-pretty">
                Most complaint registers fail in the same three ways. Each one has a rule here that
                closes it.
              </p>
            </div>

            <div className="mt-9 grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: Clock3,
                  title: "Nobody responded",
                  body: "If 24 hours pass with no action, an Escalate to Warden button appears on your complaint — and the system escalates it on its own even if you forget.",
                  tone: "text-warning",
                },
                {
                  icon: Siren,
                  title: "Marked done, but it is not done",
                  body: "24 hours after staff mark a complaint resolved, you can report that the work is still pending. It reopens, is flagged as disputed, and the Warden and Coordinator are both e-mailed.",
                  tone: "text-destructive",
                },
                {
                  icon: ScrollText,
                  title: "No record of what happened",
                  body: "Every acknowledgement, assignment, note and status change is written to a timeline that can never be edited or deleted, and you can read all of it.",
                  tone: "text-primary",
                },
              ].map((item) => (
                <Card key={item.title} className="h-full">
                  <CardContent className="p-5 pt-5">
                    <item.icon className={`size-6 ${item.tone}`} />
                    <p className="mt-3.5 font-semibold leading-tight">{item.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Hostels + attachments ---------- */}
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl font-bold">Three hostels, one system</h2>
              <p className="mt-2 text-muted-foreground text-pretty">
                Each hostel has its own Resident Tutor who sees only their own residents&apos;
                complaints. The Hostel Warden and the Campus Coordinator see all three, so nothing
                falls between them.
              </p>

              <ul className="mt-6 space-y-3">
                {HOSTELS.map((hostel) => (
                  <li
                    key={hostel}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <span className="grid size-10 place-items-center rounded-lg bg-primary/12 font-display text-sm font-bold text-primary">
                      {HOSTEL_META[hostel].short.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-medium leading-tight">{HOSTEL_META[hostel].label}</p>
                      <p className="text-xs text-muted-foreground">
                        One dedicated Resident Tutor · Warden and Coordinator oversight
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-display text-2xl font-bold">Show it, do not just describe it</h2>
              <p className="mt-2 text-muted-foreground text-pretty">
                A photo of a burnt socket says more than a paragraph. If typing in English is
                awkward, record a voice note in whatever language you are comfortable with.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="p-5 pt-5">
                    <Camera className="size-6 text-primary" />
                    <p className="mt-3 font-semibold">Up to 5 photos</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Attach clear pictures of the problem. Staff must attach proof photos when they
                      mark it fixed.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5 pt-5">
                    <Mic className="size-6 text-primary" />
                    <p className="mt-3 font-semibold">A 2-minute voice note</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Record straight from your phone browser. No app to install, nothing to pay.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="rounded-2xl border border-border bg-card p-8 text-center card-elevated sm:p-12">
              <h2 className="font-display text-2xl font-bold sm:text-3xl">
                Something broken in your room?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-muted-foreground text-pretty">
                Register once with your registration number. After that, filing a complaint takes
                less than a minute.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href={user ? homeHref : "/register"}>
                  <Button size="lg">
                    {user ? "Open dashboard" : "Create your account"}
                    <ArrowRight />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline">
                    I already have an account
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            {publicEnv.appName} · {publicEnv.instituteName}
          </p>
          <div className="flex gap-4">
            <Link href="/track" className="hover:text-foreground">
              Track a complaint
            </Link>
            <Link href="/transparency" className="hover:text-foreground">
              Transparency board
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Staff sign-in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
