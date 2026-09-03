"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Megaphone,
  MoreHorizontal,
  Moon,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  Wrench,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { api } from "@/lib/apiClient";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { HOSTEL_META, ROLE_META, type Hostel, type Role } from "@/lib/domain/constants";
import { publicEnv } from "@/lib/config/env";

export type ShellUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  hostel?: Hostel;
  regNo?: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  /** Shorter label for the bottom bar, where there is room for one word. */
  short?: string;
};

function isActive(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "My complaints", icon: Home, exact: true, short: "Mine" },
  { href: "/student/new", label: "File a complaint", icon: Plus, short: "Report" },
  { href: "/student/hostel", label: "Hostel feed", icon: Building2, short: "Hostel" },
  { href: "/student/notices", label: "Notices", icon: Megaphone, short: "Notices" },
];

function staffNav(role: Role): NavItem[] {
  const base: NavItem[] = [
    { href: "/staff", label: "Dashboard", icon: Home, exact: true, short: "Home" },
    { href: "/staff/complaints", label: "Complaints", icon: ClipboardList, short: "Queue" },
    { href: "/staff/workers", label: "Workers", icon: Wrench, short: "Workers" },
    { href: "/staff/analytics", label: "Analytics", icon: BarChart3, short: "Stats" },
    { href: "/staff/announcements", label: "Notices", icon: Megaphone, short: "Notices" },
  ];
  if (role === "WARDEN" || role === "COORDINATOR") {
    base.push({ href: "/staff/audit", label: "Audit log", icon: ScrollText });
  }
  if (role === "COORDINATOR") {
    base.push(
      { href: "/staff/users", label: "Staff accounts", icon: Users },
      { href: "/staff/settings", label: "System settings", icon: Settings },
    );
  }
  return base;
}

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const nav = user.role === "STUDENT" ? STUDENT_NAV : staffNav(user.role);

  // Five tabs is the most a thumb can aim at comfortably; anything beyond that
  // moves into a sheet rather than shrinking every target.
  const barItems = nav.length <= 5 ? nav : nav.slice(0, 4);
  const overflow = nav.length <= 5 ? [] : nav.slice(4);

  // A route change should close the sheet.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (moreOpen) setMoreOpen(false);
  }


  /**
   * Unread badge polling.
   *
   * Deliberately NOT keyed on `pathname`: that re-ran the whole effect on every
   * navigation, firing an extra request that competed with the page the user
   * was actually waiting for. It now polls on a fixed timer, pauses entirely
   * while the tab is hidden, and refreshes once on return — so a backgrounded
   * tab costs nothing and the badge is still current when you come back.
   */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (document.hidden) return;
      try {
        const data = await api.get<{ unread: number }>("/api/notifications?countOnly=true");
        if (!cancelled) setUnread(data.unread);
      } catch {
        /* the bell is not important enough to surface an error */
      }
    };

    void load();
    const timer = setInterval(load, 90_000);
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const signOut = async () => {
    await api.post("/api/auth/logout").catch(() => undefined);
    router.push("/login");
    router.refresh();
  };

  const scopeLabel =
    user.role === "RT" && user.hostel
      ? HOSTEL_META[user.hostel].label
      : user.role === "STUDENT"
        ? user.regNo
        : "All hostels";

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-5">
          <Link
            href={user.role === "STUDENT" ? "/student" : "/staff"}
            className="flex min-w-0 items-center gap-2.5 rounded-lg font-semibold"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-[18px]" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display text-[15px] font-semibold">
                {publicEnv.appName}
              </span>
              <span className="block truncate text-[10.5px] font-normal uppercase tracking-[0.09em] text-muted-foreground">
                {publicEnv.instituteShort}
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-1.5">
            <Link href={user.role === "STUDENT" ? "/student/notifications" : "/staff/notifications"}>
              <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
                <Bell />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Button>
            </Link>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Account menu"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-bold text-primary">
                    {initials(user.name)}
                  </span>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block max-w-36 truncate text-sm font-medium">{user.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {ROLE_META[user.role].short}
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="pb-0">{user.name}</DropdownMenuLabel>
                <div className="px-2.5 pb-2 pt-0.5 text-xs text-muted-foreground">{user.email}</div>
                <div className="px-2.5 pb-2">
                  <Badge tone="primary">{ROLE_META[user.role].label}</Badge>
                  {scopeLabel && (
                    <Badge tone="neutral" className="ml-1.5">
                      {scopeLabel}
                    </Badge>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/change-password">
                    <Settings />
                    Change password
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-7 px-4 py-5 sm:px-5">
        {/* ---------- Sidebar (desktop only) ---------- */}
        <aside className="hidden shrink-0 lg:block lg:w-56">
          <nav className="sticky top-20 space-y-0.5" aria-label="Main">
            {nav.map((item) => {
              const active = isActive(item, pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}

            {user.role === "STUDENT" && (
              <Link href="/student/new" className="!mt-4 block">
                <Button className="w-full">
                  <Plus />
                  New complaint
                </Button>
              </Link>
            )}

            <div className="!mt-6 rounded-xl border border-border bg-card p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <FileText className="size-3.5" />
                Need help?
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {user.role === "STUDENT"
                  ? "If nothing happens for 24 hours you can escalate your complaint straight to the Hostel Warden."
                  : "Complaints are ranked by severity and by how long they have been waiting. The oldest and most serious rise to the top."}
              </p>
            </div>
          </nav>
        </aside>

        {/* ---------- Main ---------- */}
        <main id="main" className="min-w-0 flex-1 pb-nav">
          {children}
        </main>
      </div>

      {/* ---------- Bottom bar (mobile only) ----------
          This app is used one-handed, standing in a corridor. A drawer behind a
          hamburger in the top-left corner is the furthest point from a thumb;
          the destinations belong at the bottom of the screen instead. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg lg:hidden pb-safe"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
          {barItems.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            const isPrimaryAction = user.role === "STUDENT" && item.href === "/student/new";

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-w-0 flex-1 flex-col items-center gap-1 px-1 pb-1.5 pt-2 text-[10px] font-medium transition-colors touch-target",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid place-items-center rounded-full transition-colors",
                    isPrimaryAction
                      ? "size-8 bg-primary text-primary-foreground"
                      : active
                        ? "size-8 bg-primary-soft"
                        : "size-8",
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>
                <span className="max-w-full truncate leading-none">{item.short ?? item.label}</span>
              </Link>
            );
          })}

          {overflow.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-label="More sections"
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 px-1 pb-1.5 pt-2 text-[10px] font-medium transition-colors touch-target",
                moreOpen || overflow.some((i) => isActive(i, pathname))
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            >
              <span className="grid size-8 place-items-center rounded-full">
                <MoreHorizontal className="size-[18px]" />
              </span>
              <span className="leading-none">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* Overflow sheet for roles with more sections than the bar can hold. */}
      {moreOpen && overflow.length > 0 && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-card p-3 pb-nav shadow-2xl lg:hidden">
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-border" />
            <div className="grid grid-cols-2 gap-1.5">
              {overflow.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium transition-colors touch-target",
                      isActive(item, pathname)
                        ? "bg-primary-soft text-primary"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHydrated();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle dark mode"
    >
      {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
