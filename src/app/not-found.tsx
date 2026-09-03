import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center"
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Compass className="size-7" />
      </span>

      <p className="mt-6 font-mono text-xs font-bold tracking-widest text-muted-foreground">404</p>
      <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Page not found</h1>
      <p className="mt-3 max-w-md text-balance text-muted-foreground">
        This page does not exist. If you followed a link to a complaint, it may have been filed in a
        hostel you do not have access to.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/">
          <Button>Go to the home page</Button>
        </Link>
        <Link href="/track">
          <Button variant="outline">Track a complaint</Button>
        </Link>
      </div>
    </main>
  );
}
