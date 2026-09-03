import { connectDB } from "@/lib/db/mongoose";
import { Complaint, ComplaintEvent } from "@/models";
import { canViewComplaint } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { getSettings } from "./settings";
import { serializeComplaint, serializeTimeline, type SerializedComplaint } from "./serialize";
import type { TimelineEntry } from "@/components/complaint/Timeline";

/**
 * Server-side loader shared by the student and staff detail pages so both
 * render exactly what the API would return for that viewer.
 */
export async function getComplaintDetail(
  id: string,
  viewer: CurrentUser,
): Promise<{ complaint: SerializedComplaint; timeline: TimelineEntry[] } | null> {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;

  await connectDB();
  const complaint = await Complaint.findOne({ _id: id, deletedAt: null }).lean();
  if (!complaint) return null;

  const scope = {
    hostel: complaint.hostel,
    studentUserId: String(complaint.student.userId),
  };
  if (!canViewComplaint(viewer, scope)) return null;

  const [events, settings] = await Promise.all([
    ComplaintEvent.find({ complaintId: id }).sort({ createdAt: 1 }).lean(),
    getSettings(),
  ]);

  return {
    complaint: serializeComplaint(complaint as never, viewer, settings, { includeActions: true }),
    timeline: serializeTimeline(events as never, viewer) as unknown as TimelineEntry[],
  };
}
