import type { HydratedDocument } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Complaint, type IComplaint } from "@/models";
import { ApiError } from "./response";
import type { CurrentUser } from "@/lib/auth/session";
import { canActAsReporter, canMutateComplaint, canViewComplaint } from "@/lib/auth/permissions";

/**
 * Loads a complaint and applies the right authorisation check in one place.
 * `access` decides which check runs:
 *   view     — anyone allowed to read it
 *   staff    — RT of that hostel, Warden, Coordinator
 *   reporter — only the student who filed it
 *   any      — either the reporter or authorised staff
 */
export async function loadComplaint(
  id: string,
  actor: CurrentUser,
  access: "view" | "staff" | "reporter" | "any",
): Promise<HydratedDocument<IComplaint>> {
  if (!/^[a-f\d]{24}$/i.test(id)) {
    throw new ApiError("NOT_FOUND", "Complaint not found.");
  }

  await connectDB();
  const complaint = await Complaint.findOne({ _id: id, deletedAt: null });
  if (!complaint) throw new ApiError("NOT_FOUND", "Complaint not found.");

  const scope = {
    hostel: complaint.hostel,
    studentUserId: String(complaint.student.userId),
  };

  // Not visible at all -> 404, so nobody can probe for complaints in other hostels.
  if (!canViewComplaint(actor, scope)) {
    throw new ApiError("NOT_FOUND", "Complaint not found.");
  }

  if (access === "staff" && !canMutateComplaint(actor, scope)) {
    throw new ApiError(
      "FORBIDDEN",
      actor.role === "STUDENT"
        ? "Students cannot change the status of a complaint."
        : "You can only act on complaints from your own hostel.",
    );
  }

  if (access === "reporter" && !canActAsReporter(actor, scope)) {
    throw new ApiError("FORBIDDEN", "Only the student who filed this complaint can do that.");
  }

  if (
    access === "any" &&
    !canActAsReporter(actor, scope) &&
    !canMutateComplaint(actor, scope)
  ) {
    throw new ApiError("FORBIDDEN", "You do not have permission to do that.");
  }

  return complaint;
}
