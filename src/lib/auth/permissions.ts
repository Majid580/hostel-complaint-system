/**
 * Central RBAC. Every authorisation decision in the app is made here — routes
 * call these helpers, and the UI uses the same functions to decide what to
 * render. Nothing checks `role === "..."` inline.
 */
import { isGlobalRole, type Hostel, type Role } from "@/lib/domain/constants";

export type Actor = {
  id: string;
  role: Role;
  hostel?: Hostel;
  name: string;
  email: string;
};

export type ComplaintScope = {
  hostel: Hostel;
  studentUserId: string;
};

/* --- Complaint visibility -------------------------------------------------- */

export function canViewComplaint(actor: Actor, c: ComplaintScope): boolean {
  switch (actor.role) {
    case "STUDENT":
      return c.studentUserId === actor.id;
    case "RT":
      return c.hostel === actor.hostel;
    case "WARDEN":
    case "COORDINATOR":
      return true;
    default:
      return false;
  }
}

/** Staff-side mutations: acknowledge, assign, change status, internal notes. */
export function canMutateComplaint(actor: Actor, c: ComplaintScope): boolean {
  switch (actor.role) {
    case "RT":
      return c.hostel === actor.hostel;
    case "WARDEN":
    case "COORDINATOR":
      return true;
    default:
      return false;
  }
}

/** Student-side actions on their own complaint (verify, reopen, escalate, flag). */
export function canActAsReporter(actor: Actor, c: ComplaintScope): boolean {
  return actor.role === "STUDENT" && c.studentUserId === actor.id;
}

export function canComment(actor: Actor, c: ComplaintScope): boolean {
  return canViewComplaint(actor, c);
}

export function canSeeInternalNotes(actor: Actor): boolean {
  return actor.role !== "STUDENT";
}

/** Only staff may see the reporter behind an anonymous complaint. */
export function canSeeReporterIdentity(actor: Actor, c: ComplaintScope, isAnonymous: boolean) {
  if (!isAnonymous) return true;
  if (actor.role === "STUDENT") return c.studentUserId === actor.id;
  return true;
}

/* --- Hostel scoping -------------------------------------------------------- */

/** Which hostels this actor may read. `null` means "all of them". */
export function visibleHostels(actor: Actor): Hostel[] | null {
  if (isGlobalRole(actor.role)) return null;
  return actor.hostel ? [actor.hostel] : [];
}

export function canAccessHostel(actor: Actor, hostel: Hostel): boolean {
  if (isGlobalRole(actor.role)) return true;
  return actor.hostel === hostel;
}

/* --- Administration -------------------------------------------------------- */

export function canManageUsers(actor: Actor): boolean {
  return actor.role === "COORDINATOR";
}

export function canManageSettings(actor: Actor): boolean {
  return actor.role === "COORDINATOR";
}

export function canViewAuditLog(actor: Actor): boolean {
  return actor.role === "COORDINATOR" || actor.role === "WARDEN";
}

export function canManageWorkers(actor: Actor, hostel?: Hostel): boolean {
  if (isGlobalRole(actor.role)) return true;
  if (actor.role !== "RT") return false;
  return hostel ? actor.hostel === hostel : true;
}

export function canViewAnalytics(actor: Actor): boolean {
  return actor.role !== "STUDENT";
}

export function canExportData(actor: Actor): boolean {
  return isGlobalRole(actor.role);
}

export function canPublishAnnouncement(actor: Actor): boolean {
  return actor.role !== "STUDENT";
}

/** Overrides that only the Warden / Coordinator may perform. */
export function canOverride(actor: Actor): boolean {
  return isGlobalRole(actor.role);
}

/* --- Landing page after login ---------------------------------------------- */

export function homePathFor(role: Role): string {
  return role === "STUDENT" ? "/student" : "/staff";
}
