import type { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { MailQueue, Notification, SystemLog, User, type IUser } from "@/models";
import { sendMailNow, type MailMessage } from "@/lib/mail/transport";
import type { RenderedMail } from "@/lib/mail/templates";
import type { Hostel } from "@/lib/domain/constants";

/**
 * Notification fan-out.
 *
 * Two channels, always both:
 *   - e-mail (queued, retried — never blocks the user's request)
 *   - in-app notification (instant, free, always works even if SMTP is down)
 */

export type StaffRecipients = {
  rts: IUser[];
  wardens: IUser[];
  coordinators: IUser[];
  /** Everyone who should be e-mailed about a new complaint in this hostel. */
  primaryEmails: string[];
  allStaff: IUser[];
};

export async function resolveStaffRecipients(hostel: Hostel): Promise<StaffRecipients> {
  await connectDB();

  const staff = await User.find({
    isActive: true,
    $or: [{ role: "RT", hostel }, { role: "WARDEN" }, { role: "COORDINATOR" }],
  })
    .select("name email role hostel notificationPrefs")
    .lean();

  const rts = staff.filter((u) => u.role === "RT") as IUser[];
  const wardens = staff.filter((u) => u.role === "WARDEN") as IUser[];
  const coordinators = staff.filter((u) => u.role === "COORDINATOR") as IUser[];

  // G2: the RT of that hostel AND the warden are always e-mailed on creation.
  const primaryEmails = [...rts, ...wardens]
    .filter((u) => u.notificationPrefs?.email !== false)
    .map((u) => u.email);

  return {
    rts,
    wardens,
    coordinators,
    primaryEmails: [...new Set(primaryEmails)],
    allStaff: staff as IUser[],
  };
}

/**
 * Try to deliver immediately; on failure, persist to the queue so the cron sweep
 * retries. Either way the caller's request succeeds.
 */
export async function queueMail(
  to: string[],
  mail: RenderedMail,
  options: { cc?: string[]; relatedComplaint?: Types.ObjectId | string | null } = {},
): Promise<void> {
  const recipients = [...new Set(to.filter(Boolean))];
  if (recipients.length === 0) return;

  const message: MailMessage = {
    to: recipients,
    cc: options.cc,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  };

  try {
    const result = await sendMailNow(message);
    if (result.ok) return;

    await MailQueue.create({
      to: recipients,
      cc: options.cc ?? [],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      status: "PENDING",
      attempts: 1,
      lastError: result.error,
      sendAfter: new Date(Date.now() + 60_000),
      relatedComplaint: options.relatedComplaint ?? null,
    });
  } catch (error) {
    // Even the enqueue failing must not break the request.
    console.error("[notify] failed to queue mail:", error);
  }
}

export async function notifyInApp(
  userId: Types.ObjectId | string,
  input: {
    type: string;
    title: string;
    body: string;
    link?: string;
    tone?: "info" | "success" | "warning" | "danger";
  },
): Promise<void> {
  try {
    await Notification.create({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      tone: input.tone ?? "info",
    });
  } catch (error) {
    console.error("[notify] in-app notification failed:", error);
  }
}

export async function notifyManyInApp(
  userIds: (Types.ObjectId | string)[],
  input: {
    type: string;
    title: string;
    body: string;
    link?: string;
    tone?: "info" | "success" | "warning" | "danger";
  },
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await Notification.insertMany(
      userIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
        tone: input.tone ?? "info",
      })),
      { ordered: false },
    );
  } catch (error) {
    console.error("[notify] bulk in-app notification failed:", error);
  }
}

/** Called by the scheduled sweep. Exponential-ish backoff, gives up after 5 tries. */
export async function drainMailQueue(limit = 25): Promise<{ sent: number; failed: number }> {
  await connectDB();

  const pending = await MailQueue.find({
    status: "PENDING",
    sendAfter: { $lte: new Date() },
    attempts: { $lt: 5 },
  })
    .sort({ sendAfter: 1 })
    .limit(limit);

  let sent = 0;
  let failed = 0;

  for (const item of pending) {
    const result = await sendMailNow({
      to: item.to,
      cc: item.cc,
      subject: item.subject,
      html: item.html,
      text: item.text,
    });

    if (result.ok) {
      item.status = "SENT";
      item.sentAt = new Date();
      sent++;
    } else {
      item.attempts += 1;
      item.lastError = result.error;
      if (item.attempts >= 5) {
        item.status = "FAILED";
        await SystemLog.create({
          level: "ERROR",
          source: "mail-queue",
          message: `Giving up on e-mail "${item.subject}" after 5 attempts.`,
          meta: { to: item.to, error: result.error },
        });
      } else {
        // 2, 8, 18, 32 minutes
        item.sendAfter = new Date(Date.now() + item.attempts * item.attempts * 2 * 60_000);
      }
      failed++;
    }

    await item.save();
  }

  return { sent, failed };
}
