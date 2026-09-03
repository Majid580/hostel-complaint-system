import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { TrackForm } from "./TrackForm";

export const metadata: Metadata = {
  title: "Track a complaint",
  description:
    "Check the status of a hostel complaint with your ticket number and registration number — no sign-in required.",
};

export default function TrackPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader current="track" />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
          <header className="mb-7">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              Track a complaint
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty">
              Enter the ticket number from your confirmation e-mail together with the registration
              number the complaint was filed under. Both are required — a ticket number on its own
              reveals nothing.
            </p>
          </header>

          <TrackForm />

          <p className="mt-8 text-sm text-muted-foreground">
            Lost your ticket number?{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
              Sign in
            </Link>{" "}
            — every complaint you have filed is listed on your dashboard.
          </p>
        </div>
      </main>
    </div>
  );
}
