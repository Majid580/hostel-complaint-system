import { env } from "@/lib/config/env";
import {
  CATEGORY_META,
  HOSTEL_META,
  SEVERITY_META,
  STATUS_META,
  type Category,
  type ComplaintStatus,
  type Hostel,
  type Severity,
} from "@/lib/domain/constants";

/**
 * E-mail templates.
 *
 * Written as table-based HTML with inline styles because Gmail, Outlook and
 * most webmail clients strip <style> blocks and ignore flexbox. Every template
 * also returns a plain-text body — some clients show it, and it is what the
 * `console` provider prints during development.
 */

export type RenderedMail = { subject: string; html: string; text: string };

const BRAND = "#1b6b80";
const BRAND_DARK = "#124d5d";
const INK = "#1e293b";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

function esc(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(opts: {
  heading: string;
  preheader: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  accent?: string;
  footerNote?: string;
}): string {
  const accent = opts.accent ?? BRAND;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${BORDER};">
      <tr>
        <td style="background:${accent};padding:22px 28px;">
          <div style="color:#ffffff;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;opacity:.85;">${esc(env.instituteName)}</div>
          <div style="color:#ffffff;font-size:19px;font-weight:700;margin-top:4px;">${esc(env.appName)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 28px 8px 28px;">
          <h1 style="margin:0 0 14px 0;font-size:20px;line-height:1.35;color:${INK};font-weight:700;">${esc(opts.heading)}</h1>
          ${opts.bodyHtml}
        </td>
      </tr>
      ${
        opts.ctaUrl && opts.ctaLabel
          ? `<tr><td style="padding:8px 28px 26px 28px;">
              <a href="${esc(opts.ctaUrl)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:600;font-size:15px;">${esc(opts.ctaLabel)}</a>
              <div style="margin-top:12px;font-size:12px;color:${MUTED};word-break:break-all;">Or open: ${esc(opts.ctaUrl)}</div>
            </td></tr>`
          : ""
      }
      <tr>
        <td style="padding:18px 28px 26px 28px;border-top:1px solid ${BORDER};">
          <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
            ${opts.footerNote ? `${esc(opts.footerNote)}<br><br>` : ""}
            This is an automated message from the ${esc(env.appName)}. Please do not reply to this e-mail —
            use the portal so that every response stays on the complaint record.
          </p>
        </td>
      </tr>
    </table>
    <div style="max-width:600px;margin:14px auto 0;font-size:11px;color:${MUTED};text-align:center;">
      ${esc(env.instituteName)} · Hostel Administration
    </div>
  </td></tr>
</table>
</body>
</html>`;
}

type ComplaintSummary = {
  code: string;
  title: string;
  description: string;
  hostel: Hostel;
  category: Category;
  severity: Severity;
  status: ComplaintStatus;
  studentName: string;
  regNo: string;
  roomNo?: string;
  location?: string;
  createdAt: Date;
  imageCount?: number;
  hasAudio?: boolean;
};

function detailRows(c: ComplaintSummary): string {
  const rows: [string, string][] = [
    ["Ticket", c.code],
    ["Hostel", HOSTEL_META[c.hostel].label],
    ["Category", CATEGORY_META[c.category].label],
    ["Severity", SEVERITY_META[c.severity].label],
    ["Status", STATUS_META[c.status].label],
    ["Reported by", `${c.studentName} (${c.regNo})`],
  ];
  if (c.roomNo) rows.push(["Room", c.roomNo]);
  if (c.location) rows.push(["Location", c.location]);
  rows.push(["Filed at", c.createdAt.toLocaleString()]);
  if (c.imageCount) rows.push(["Photos attached", String(c.imageCount)]);
  if (c.hasAudio) rows.push(["Voice note", "Yes — listen in the portal"]);

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
    ${rows
      .map(
        ([label, value], i) =>
          `<tr style="background:${i % 2 ? "#ffffff" : "#f8fafc"};">
            <td style="padding:9px 14px;font-size:13px;color:${MUTED};width:38%;">${esc(label)}</td>
            <td style="padding:9px 14px;font-size:13px;color:${INK};font-weight:600;">${esc(value)}</td>
          </tr>`,
      )
      .join("")}
  </table>`;
}

function quote(text: string): string {
  return `<div style="margin:14px 0;padding:14px 16px;background:#f8fafc;border-left:3px solid ${BRAND};border-radius:0 8px 8px 0;font-size:14px;line-height:1.65;color:${INK};white-space:pre-wrap;">${esc(text)}</div>`;
}

function textDetails(c: ComplaintSummary): string {
  return [
    `Ticket:      ${c.code}`,
    `Hostel:      ${HOSTEL_META[c.hostel].label}`,
    `Category:    ${CATEGORY_META[c.category].label}`,
    `Severity:    ${SEVERITY_META[c.severity].label}`,
    `Status:      ${STATUS_META[c.status].label}`,
    `Reported by: ${c.studentName} (${c.regNo})`,
    c.roomNo ? `Room:        ${c.roomNo}` : null,
    c.location ? `Location:    ${c.location}` : null,
    `Filed at:    ${c.createdAt.toLocaleString()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const studentLink = (id: string) => `${env.appUrl}/student/complaints/${id}`;

/* ---------------------------------------------------------------------------
 * Templates
 * ------------------------------------------------------------------------ */

/** To the RT of the hostel and the Warden, the moment a complaint is filed. */
export function newComplaintForStaff(c: ComplaintSummary, complaintId: string): RenderedMail {
  const urgent = c.severity === "CRITICAL" || c.severity === "HIGH";
  return {
    subject: `[${c.code}] ${urgent ? `${SEVERITY_META[c.severity].label.toUpperCase()} — ` : ""}${CATEGORY_META[c.category].label} · ${HOSTEL_META[c.hostel].label}`,
    html: layout({
      heading: "New complaint filed",
      preheader: `${c.title} — ${HOSTEL_META[c.hostel].label}`,
      accent: urgent ? "#b4451f" : BRAND,
      bodyHtml: `
        <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">
          A new complaint has been filed in <strong>${esc(HOSTEL_META[c.hostel].label)}</strong>.
          It must be acknowledged within <strong>${SEVERITY_META[c.severity].ackHours} hours</strong>
          and resolved within <strong>${SEVERITY_META[c.severity].resolveHours} hours</strong>.
        </p>
        <p style="margin:14px 0 0;font-size:16px;font-weight:700;color:${INK};">${esc(c.title)}</p>
        ${quote(c.description)}
        ${detailRows(c)}`,
      ctaLabel: "Open in the portal",
      ctaUrl: `${env.appUrl}/staff/complaints/${complaintId}`,
      footerNote:
        "If no action is recorded within 24 hours, the student can escalate this complaint directly to the Hostel Warden.",
    }),
    text: `NEW COMPLAINT — ${c.code}\n\n${c.title}\n\n${c.description}\n\n${textDetails(c)}\n\nOpen: ${env.appUrl}/staff/complaints/${complaintId}`,
  };
}

/** Receipt to the student. */
export function complaintReceipt(c: ComplaintSummary, complaintId: string): RenderedMail {
  return {
    subject: `We received your complaint — ${c.code}`,
    html: layout({
      heading: "Your complaint has been registered",
      preheader: `Ticket ${c.code} — ${c.title}`,
      bodyHtml: `
        <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">
          Thank you. Your complaint has been sent to the Resident Tutor of
          <strong>${esc(HOSTEL_META[c.hostel].label)}</strong> and to the Hostel Warden.
          Keep this ticket number for reference: <strong>${esc(c.code)}</strong>.
        </p>
        ${detailRows(c)}
        <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">
          <strong style="color:${INK};">What happens next</strong><br>
          Staff should acknowledge this within ${SEVERITY_META[c.severity].ackHours} hours.
          You will receive an e-mail at every step. If nothing happens for 24 hours, an
          <strong>Escalate to Warden</strong> button will appear on your complaint.
        </p>`,
      ctaLabel: "Track your complaint",
      ctaUrl: studentLink(complaintId),
    }),
    text: `Your complaint has been registered.\n\n${textDetails(c)}\n\nTrack it: ${studentLink(complaintId)}`,
  };
}

export function statusChangedForStudent(
  c: ComplaintSummary,
  complaintId: string,
  from: ComplaintStatus,
  note?: string,
): RenderedMail {
  return {
    subject: `[${c.code}] Status: ${STATUS_META[c.status].label}`,
    html: layout({
      heading: `Your complaint is now "${STATUS_META[c.status].label}"`,
      preheader: `${c.code} — ${STATUS_META[c.status].label}`,
      bodyHtml: `
        <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">
          <strong>${esc(c.title)}</strong> moved from
          <em>${esc(STATUS_META[from].label)}</em> to <strong>${esc(STATUS_META[c.status].label)}</strong>.
        </p>
        <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">${esc(STATUS_META[c.status].description)}</p>
        ${note ? quote(note) : ""}`,
      ctaLabel: "View the complaint",
      ctaUrl: studentLink(complaintId),
    }),
    text: `${c.code}: ${STATUS_META[from].label} -> ${STATUS_META[c.status].label}\n${note ?? ""}\n\n${studentLink(complaintId)}`,
  };
}

export function workerAssignedForStudent(
  c: ComplaintSummary,
  complaintId: string,
  worker: { name: string; trade: string; expected?: Date | null },
): RenderedMail {
  return {
    subject: `[${c.code}] A worker has been assigned`,
    html: layout({
      heading: "A worker has been assigned to your complaint",
      preheader: `${worker.name} — ${worker.trade}`,
      bodyHtml: `
        <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">
          <strong>${esc(worker.name)}</strong> (${esc(worker.trade)}) has been assigned to
          <strong>${esc(c.title)}</strong>.
        </p>
        ${
          worker.expected
            ? `<p style="margin:12px 0 0;font-size:14px;color:${INK};">Expected completion: <strong>${esc(worker.expected.toLocaleString())}</strong></p>`
            : ""
        }
        <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">
          Once the work is marked complete you will be asked to confirm it. If it is not actually
          done, you can report that and the Hostel Warden will be notified.
        </p>`,
      ctaLabel: "View the complaint",
      ctaUrl: studentLink(complaintId),
    }),
    text: `${c.code}: ${worker.name} (${worker.trade}) assigned.\n${worker.expected ? `Expected: ${worker.expected.toLocaleString()}\n` : ""}\n${studentLink(complaintId)}`,
  };
}

/** The critical one: asks the student to confirm or dispute the fix. */
export function resolvedForStudent(
  c: ComplaintSummary,
  complaintId: string,
  resolution: { note: string; by: string; proofCount: number },
): RenderedMail {
  return {
    subject: `[${c.code}] Marked resolved — please confirm`,
    html: layout({
      heading: "Staff marked your complaint as resolved",
      preheader: "Please confirm whether the problem is actually fixed.",
      accent: "#2f7d55",
      bodyHtml: `
        <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">
          <strong>${esc(resolution.by)}</strong> marked <strong>${esc(c.title)}</strong> as resolved${
            resolution.proofCount ? ` and attached ${resolution.proofCount} proof photo(s)` : ""
          }.
        </p>
        ${quote(resolution.note)}
        <p style="margin:14px 0 0;font-size:14px;line-height:1.7;color:${INK};">
          <strong>Please confirm.</strong> Open the portal and either confirm the fix, or report that
          the work is still pending. If you do nothing, the complaint closes automatically after
          72 hours — and if the work was <em>not</em> actually done, you can report it to the Hostel
          Warden 24 hours from now.
        </p>`,
      ctaLabel: "Confirm or report",
      ctaUrl: studentLink(complaintId),
    }),
    text: `${c.code} was marked RESOLVED by ${resolution.by}.\n\n"${resolution.note}"\n\nConfirm or report it here: ${studentLink(complaintId)}`,
  };
}

/** E1/E2 — escalation to the Warden. */
export function escalationForStaff(
  c: ComplaintSummary,
  complaintId: string,
  detail: { level: 1 | 2; reason?: string; byName: string; hoursWaiting: number },
): RenderedMail {
  const target = detail.level === 1 ? "Hostel Warden" : "Campus Coordinator";
  return {
    subject: `[${c.code}] ESCALATED to the ${target} — action required`,
    html: layout({
      heading: `Escalated to the ${target}`,
      preheader: `${c.code} has been waiting ${Math.round(detail.hoursWaiting)} hours.`,
      accent: "#b4451f",
      bodyHtml: `
        <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">
          Complaint <strong>${esc(c.code)}</strong> has been escalated by <strong>${esc(detail.byName)}</strong>
          after waiting <strong>${Math.round(detail.hoursWaiting)} hours</strong> without resolution.
        </p>
        <p style="margin:14px 0 0;font-size:16px;font-weight:700;color:${INK};">${esc(c.title)}</p>
        ${detail.reason ? quote(detail.reason) : quote(c.description)}
        ${detailRows(c)}`,
      ctaLabel: "Review now",
      ctaUrl: `${env.appUrl}/staff/complaints/${complaintId}`,
      footerNote: "Escalated complaints appear at the top of the priority queue until they are closed.",
    }),
    text: `ESCALATED (${target}) — ${c.code}\nWaiting ${Math.round(detail.hoursWaiting)}h.\n${detail.reason ?? c.description}\n\n${env.appUrl}/staff/complaints/${complaintId}`,
  };
}

/** E3 — the accountability e-mail: the RT said "done", the student says otherwise. */
export function falseResolutionForStaff(
  c: ComplaintSummary,
  complaintId: string,
  detail: { studentName: string; reason: string; resolvedBy: string; resolvedAt: Date },
): RenderedMail {
  return {
    subject: `[${c.code}] DISPUTED — marked resolved but the work is still pending`,
    html: layout({
      heading: "A resolution has been disputed",
      preheader: `${c.code}: the student reports the work was not actually done.`,
      accent: "#a4262c",
      bodyHtml: `
        <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">
          <strong>${esc(detail.resolvedBy)}</strong> marked <strong>${esc(c.code)}</strong> as resolved on
          ${esc(detail.resolvedAt.toLocaleString())}. More than 24 hours later,
          <strong>${esc(detail.studentName)}</strong> reports that the work is still not done.
        </p>
        <p style="margin:14px 0 6px;font-size:14px;font-weight:700;color:${INK};">What the student says</p>
        ${quote(detail.reason)}
        ${detailRows(c)}
        <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">
          The complaint has been reopened, flagged as disputed, and recorded against the resolving
          staff member's accountability record.
        </p>`,
      ctaLabel: "Investigate",
      ctaUrl: `${env.appUrl}/staff/complaints/${complaintId}`,
    }),
    text: `DISPUTED RESOLUTION — ${c.code}\nResolved by ${detail.resolvedBy} on ${detail.resolvedAt.toLocaleString()}.\nStudent (${detail.studentName}) says: ${detail.reason}\n\n${env.appUrl}/staff/complaints/${complaintId}`,
  };
}

export function autoClosedForStudent(c: ComplaintSummary, complaintId: string): RenderedMail {
  return {
    subject: `[${c.code}] Closed automatically`,
    html: layout({
      heading: "Your complaint has been closed",
      preheader: `${c.code} closed after 72 hours with no response.`,
      bodyHtml: `
        <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">
          <strong>${esc(c.title)}</strong> was marked resolved 72 hours ago and closed automatically
          because we did not hear back from you.
        </p>
        <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">
          If the problem is still there, open the complaint and ask the Hostel Warden to reopen it —
          you have 7 days.
        </p>`,
      ctaLabel: "View the complaint",
      ctaUrl: studentLink(complaintId),
    }),
    text: `${c.code} was closed automatically after 72 hours with no response.\n\n${studentLink(complaintId)}`,
  };
}

export function otpEmail(
  name: string,
  code: string,
  purpose: "VERIFY_EMAIL" | "RESET_PASSWORD",
): RenderedMail {
  const isReset = purpose === "RESET_PASSWORD";
  return {
    subject: isReset ? "Your password reset code" : "Verify your e-mail address",
    html: layout({
      heading: isReset ? "Reset your password" : "Verify your e-mail",
      preheader: `Your code is ${code}`,
      bodyHtml: `
        <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">
          Hello ${esc(name)}, use this code to ${isReset ? "reset your password" : "verify your e-mail address"}.
          It expires in 10 minutes.
        </p>
        <div style="margin:20px 0;text-align:center;">
          <span style="display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;letter-spacing:10px;font-weight:700;color:${BRAND_DARK};background:#f1f5f9;border:1px solid ${BORDER};border-radius:12px;padding:14px 22px;">${esc(code)}</span>
        </div>
        <p style="margin:0;font-size:13px;color:${MUTED};">
          If you did not request this, you can safely ignore this e-mail.
        </p>`,
    }),
    text: `Your ${isReset ? "password reset" : "verification"} code is ${code}. It expires in 10 minutes.`,
  };
}

export function slaDigestForStaff(
  recipientName: string,
  rows: { code: string; title: string; hostel: Hostel; overdueHours: number; id: string }[],
): RenderedMail {
  return {
    subject: `${rows.length} complaint(s) past their deadline`,
    html: layout({
      heading: "Complaints past their resolution deadline",
      preheader: `${rows.length} overdue complaint(s) need attention.`,
      accent: "#b4451f",
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${INK};">
          Hello ${esc(recipientName)}, the following complaints have missed their resolution deadline.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
          <tr style="background:#f8fafc;">
            <th align="left" style="padding:9px 12px;font-size:12px;color:${MUTED};">Ticket</th>
            <th align="left" style="padding:9px 12px;font-size:12px;color:${MUTED};">Complaint</th>
            <th align="right" style="padding:9px 12px;font-size:12px;color:${MUTED};">Overdue</th>
          </tr>
          ${rows
            .map(
              (r) => `<tr style="border-top:1px solid ${BORDER};">
                <td style="padding:9px 12px;font-size:13px;font-family:ui-monospace,monospace;color:${INK};">${esc(r.code)}</td>
                <td style="padding:9px 12px;font-size:13px;color:${INK};">${esc(r.title)}<br><span style="color:${MUTED};font-size:12px;">${esc(HOSTEL_META[r.hostel].label)}</span></td>
                <td align="right" style="padding:9px 12px;font-size:13px;color:#b4451f;font-weight:700;">${Math.round(r.overdueHours)} h</td>
              </tr>`,
            )
            .join("")}
        </table>`,
      ctaLabel: "Open the queue",
      ctaUrl: `${env.appUrl}/staff/complaints?slaBreached=true`,
    }),
    text:
      `Overdue complaints:\n\n` +
      rows.map((r) => `${r.code} — ${r.title} (${Math.round(r.overdueHours)}h overdue)`).join("\n"),
  };
}

export function staffWelcome(
  name: string,
  role: string,
  email: string,
  tempPassword: string,
): RenderedMail {
  return {
    subject: `Your ${env.appName} account is ready`,
    html: layout({
      heading: "Your account has been created",
      preheader: "Sign in and change your password.",
      bodyHtml: `
        <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">
          Hello ${esc(name)}, an account has been created for you as <strong>${esc(role)}</strong>.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
          <tr style="background:#f8fafc;"><td style="padding:9px 14px;font-size:13px;color:${MUTED};">E-mail</td><td style="padding:9px 14px;font-size:13px;font-weight:600;color:${INK};">${esc(email)}</td></tr>
          <tr><td style="padding:9px 14px;font-size:13px;color:${MUTED};">Temporary password</td><td style="padding:9px 14px;font-size:13px;font-weight:700;font-family:ui-monospace,monospace;color:${INK};">${esc(tempPassword)}</td></tr>
        </table>
        <p style="margin:0;font-size:14px;color:#b4451f;font-weight:600;">
          You will be asked to choose a new password the first time you sign in.
        </p>`,
      ctaLabel: "Sign in",
      ctaUrl: `${env.appUrl}/login`,
    }),
    text: `Your ${env.appName} account is ready.\nEmail: ${email}\nTemporary password: ${tempPassword}\nSign in: ${env.appUrl}/login`,
  };
}
