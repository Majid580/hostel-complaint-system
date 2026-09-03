import type { NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth/session";
import { ok, handleRoute, zodFail, ApiError } from "@/lib/api/response";
import { loadComplaint } from "@/lib/api/loadComplaint";
import { clientIp, enforceRateLimit } from "@/lib/api/rateLimit";
import { bulkActionSchema } from "@/lib/validation/schemas";
import { assignWorker, transitionStatus } from "@/lib/services/complaints";
import { STATUS_META, type ComplaintStatus } from "@/lib/domain/constants";

/** The only statuses for which "acknowledge" is a forward step. */
const AWAITING_ACKNOWLEDGEMENT: readonly ComplaintStatus[] = ["SUBMITTED", "REOPENED"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Applies one action to several complaints (P7-9).
 *
 * Each complaint goes through exactly the same `loadComplaint` +
 * `transitionStatus` / `assignWorker` path as the single-complaint routes, so
 * hostel scoping, the state machine, payload guards, the timeline and the
 * notification e-mails all behave identically. Nothing here is a shortcut
 * around those rules.
 *
 * It is deliberately partial-success: a complaint that cannot legally make the
 * transition is skipped and reported, rather than failing the whole batch. Ten
 * complaints where three are already acknowledged should acknowledge the seven.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await requireStaff();
    await enforceRateLimit("comment", `bulk:${actor.id ?? clientIp(request)}`, "run another bulk action");

    const body = await request.json().catch(() => ({}));
    const parsed = bulkActionSchema.safeParse(body);
    if (!parsed.success) return zodFail(parsed.error);

    const { ids, action, note, workerId, expectedCompletionAt } = parsed.data;

    const succeeded: string[] = [];
    const skipped: { id: string; code: string | null; reason: string }[] = [];

    // Sequential on purpose: the complaint-code counter and the mail queue are
    // both shared, and a free-tier M0 cluster does not enjoy 50 parallel writes.
    for (const id of ids) {
      let code: string | null = null;
      try {
        const complaint = await loadComplaint(id, actor, "staff");
        code = complaint.code;

        // The state machine allows ASSIGNED -> ACKNOWLEDGED, but that rule means
        // "unassign the worker". Reaching it from a bulk Acknowledge would throw
        // away an assignment the operator never intended to touch, so bulk
        // acknowledgement is restricted to complaints genuinely awaiting it.
        if (action === "ACKNOWLEDGE" && !AWAITING_ACKNOWLEDGEMENT.includes(complaint.status)) {
          skipped.push({
            id,
            code,
            reason:
              complaint.status === "ACKNOWLEDGED"
                ? "Already acknowledged."
                : `Already past acknowledgement (${STATUS_META[complaint.status].label}). Open it individually to change its status.`,
          });
          continue;
        }

        if (action === "ASSIGN") {
          await assignWorker(
            complaint,
            {
              workerId: workerId!,
              expectedCompletionAt: expectedCompletionAt || undefined,
              remarks: note,
            },
            actor,
            request,
          );
        } else {
          await transitionStatus(
            complaint,
            action === "ACKNOWLEDGE" ? "ACKNOWLEDGED" : "VERIFIED_CLOSED",
            actor,
            { note },
            request,
          );
        }

        succeeded.push(id);
      } catch (error) {
        skipped.push({
          id,
          code,
          reason:
            error instanceof ApiError
              ? error.message
              : "Something went wrong applying this action.",
        });
      }
    }

    return ok({
      action,
      requested: ids.length,
      succeeded: succeeded.length,
      skipped,
    });
  });
}
