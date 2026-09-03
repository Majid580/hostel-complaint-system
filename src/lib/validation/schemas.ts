import { z } from "zod";
import {
  CATEGORIES,
  HOSTELS,
  SEVERITIES,
  STATUSES,
  TRADES,
  ROLES,
} from "@/lib/domain/constants";
import { normalizeRegNo, explainRegNoError } from "@/lib/domain/regNo";
import { PASSWORD_RULES, checkPasswordStrength } from "@/lib/auth/password";

/**
 * One schema set, used by both the client forms and the API routes. If it
 * validates in the browser it validates on the server, and vice versa.
 */

/* --- Primitives ------------------------------------------------------------ */

export const regNoField = z
  .string()
  .trim()
  .min(1, "Registration number is required.")
  .transform((value, ctx) => {
    const normalized = normalizeRegNo(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: explainRegNoError(value) });
      return z.NEVER;
    }
    return normalized;
  });

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "E-mail is required.")
  .max(200)
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Enter a valid e-mail address.");

export const passwordField = z
  .string()
  .min(PASSWORD_RULES.minLength, `Password must be at least ${PASSWORD_RULES.minLength} characters.`)
  .max(PASSWORD_RULES.maxLength)
  .superRefine((value, ctx) => {
    const check = checkPasswordStrength(value);
    if (!check.ok) ctx.addIssue({ code: "custom", message: check.message ?? "Password is too weak." });
  });

export const phoneField = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === "" || /^[+()\d\s-]{7,20}$/.test(v), "Enter a valid phone number.")
  .optional()
  .or(z.literal(""));

export const objectIdField = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid identifier.");

export const hostelField = z.enum(HOSTELS);
export const categoryField = z.enum(CATEGORIES);
export const severityField = z.enum(SEVERITIES);
export const statusField = z.enum(STATUSES);
export const tradeField = z.enum(TRADES);
export const roleField = z.enum(ROLES);

export const attachmentSchema = z.object({
  url: z.string().url("Invalid attachment URL."),
  publicId: z.string().min(1),
  kind: z.enum(["image", "audio"]),
  bytes: z.number().int().nonnegative(),
  mimeType: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().nonnegative().optional(),
});

/* --- Auth ------------------------------------------------------------------ */

export const registerSchema = z
  .object({
    name: z.string().trim().min(3, "Enter your full name.").max(120),
    regNo: regNoField,
    email: emailField,
    phone: phoneField,
    hostel: hostelField,
    roomNo: z.string().trim().max(20).optional().or(z.literal("")),
    password: passwordField,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { error: "You must accept the usage policy." }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  /** Students may sign in with their registration number instead of an e-mail. */
  identifier: z.string().trim().min(1, "Enter your e-mail or registration number."),
  password: z.string().min(1, "Enter your password."),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({
    email: emailField,
    code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/* --- Complaints ------------------------------------------------------------ */

export const createComplaintSchema = z.object({
  hostel: hostelField,
  category: categoryField,
  title: z.string().trim().min(5, "Give the problem a short title.").max(160),
  description: z
    .string()
    .trim()
    .min(10, "Describe the problem in at least 10 characters.")
    .max(3000, "Keep the description under 3000 characters."),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  severity: severityField,
  images: z.array(attachmentSchema).max(5, "You can attach at most 5 photos.").default([]),
  audio: attachmentSchema.nullable().optional(),
  isAnonymous: z.boolean().default(false),
  /** Filled from the signed-in student; validated server-side against the session. */
  roomNo: z.string().trim().max(20).optional().or(z.literal("")),
});

export const complaintFilterSchema = z.object({
  hostel: hostelField.optional(),
  status: z.union([statusField, z.array(statusField)]).optional(),
  category: categoryField.optional(),
  severity: severityField.optional(),
  escalated: z.coerce.boolean().optional(),
  disputed: z.coerce.boolean().optional(),
  slaBreached: z.coerce.boolean().optional(),
  assignedTo: objectIdField.optional(),
  mine: z.coerce.boolean().optional(),
  q: z.string().trim().max(120).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z
    .enum(["priority", "newest", "oldest", "dueSoon", "severity"])
    .default("priority"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  view: z.enum(["all", "open", "closed", "actionRequired"]).optional(),
});

export const statusChangeSchema = z.object({
  to: statusField,
  note: z.string().trim().max(2000).optional(),
  reason: z.string().trim().max(2000).optional(),
  holdUntil: z.string().datetime().optional().or(z.literal("")),
  proofImages: z.array(attachmentSchema).max(5).optional(),
  workerId: objectIdField.optional(),
  expectedCompletionAt: z.string().datetime().optional().or(z.literal("")),
});

/**
 * Bulk queue actions. Deliberately narrow: only the three transitions that are
 * safe to apply without reading each complaint first. Resolving in bulk is not
 * offered, because a resolution needs its own proof photo per complaint.
 */
export const bulkActionSchema = z
  .object({
    ids: z
      .array(objectIdField)
      .min(1, "Select at least one complaint.")
      .max(50, "You can act on at most 50 complaints at a time."),
    action: z.enum(["ACKNOWLEDGE", "ASSIGN", "CLOSE"]),
    note: z.string().trim().max(2000).optional(),
    workerId: objectIdField.optional(),
    expectedCompletionAt: z.string().datetime().optional().or(z.literal("")),
  })
  .refine((d) => d.action !== "ASSIGN" || Boolean(d.workerId), {
    message: "Choose a worker to assign.",
    path: ["workerId"],
  });

export const assignWorkerSchema = z.object({
  workerId: objectIdField,
  expectedCompletionAt: z.string().datetime().optional().or(z.literal("")),
  remarks: z.string().trim().max(500).optional(),
});

export const severityChangeSchema = z.object({
  severity: severityField,
  reason: z.string().trim().min(5, "Explain why the severity is being changed.").max(500),
});

export const commentSchema = z.object({
  message: z.string().trim().min(1, "Write something first.").max(2000),
  internal: z.boolean().default(false),
});

export const escalateSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Tell the Warden what is still wrong (at least 10 characters).")
    .max(1000),
});

export const flagFalseResolutionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Describe what is still not done (at least 10 characters).")
    .max(1000),
});

export const verifyComplaintSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  feedback: z.string().trim().max(1000).optional(),
});

export const reopenSchema = z.object({
  reason: z.string().trim().min(10, "Explain what is still wrong.").max(1000),
});

export const trackSchema = z.object({
  code: z.string().trim().min(4, "Enter your ticket number."),
  regNo: regNoField,
});

/* --- Workers, announcements, users, settings ------------------------------- */

export const workerSchema = z.object({
  name: z.string().trim().min(3, "Enter the worker's name.").max(120),
  phone: phoneField,
  trade: tradeField,
  hostels: z.array(hostelField).min(1, "Select at least one hostel."),
  isActive: z.boolean().default(true),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(4, "Give the notice a title.").max(160),
  body: z.string().trim().min(10, "Write the notice.").max(2000),
  hostels: z.array(hostelField).min(1, "Select at least one hostel."),
  audience: z.enum(["ALL", "STUDENTS", "STAFF"]).default("ALL"),
  tone: z.enum(["info", "warning", "danger", "success"]).default("info"),
  pinned: z.boolean().default(false),
  startsAt: z.string().datetime().optional().or(z.literal("")),
  endsAt: z.string().datetime().optional().or(z.literal("")),
});

export const createStaffSchema = z
  .object({
    name: z.string().trim().min(3, "Enter the full name.").max(120),
    email: emailField,
    phone: phoneField,
    role: z.enum(["RT", "WARDEN", "COORDINATOR"]),
    hostel: hostelField.optional(),
    password: passwordField.optional(),
  })
  .refine((d) => d.role !== "RT" || Boolean(d.hostel), {
    message: "A Resident Tutor must be assigned to a hostel.",
    path: ["hostel"],
  });

export const updateUserSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  phone: phoneField,
  hostel: hostelField.optional(),
  roomNo: z.string().trim().max(20).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  role: roleField.optional(),
  notificationPrefs: z
    .object({ email: z.boolean(), digest: z.enum(["none", "daily"]) })
    .partial()
    .optional(),
});

export const settingsUpdateSchema = z.object({
  sla: z
    .record(
      severityField,
      z.object({
        ackHours: z.number().min(1).max(720),
        resolveHours: z.number().min(1).max(2160),
      }),
    )
    .optional(),
  escalation: z
    .object({
      studentEscalateAfterHours: z.number().min(1).max(168),
      falseResolutionFlagAfterHours: z.number().min(1).max(168),
      autoEscalateStaleAfterHours: z.number().min(1).max(168),
      level2AfterHours: z.number().min(1).max(336),
      autoCloseResolvedAfterHours: z.number().min(1).max(336),
      wardenReopenWindowDays: z.number().min(1).max(60),
      escalationCooldownHours: z.number().min(1).max(168),
    })
    .partial()
    .optional(),
  policy: z
    .object({
      requireProofOnResolve: z.boolean(),
      allowAnonymous: z.boolean(),
      maxComplaintsPerStudentPerDay: z.number().min(1).max(50),
      allowedEmailDomain: z.string().trim().max(80),
    })
    .partial()
    .optional(),
  departments: z.array(z.string().trim().toUpperCase().min(2).max(5)).optional(),
});

export const uploadSignSchema = z.object({
  kind: z.enum(["image", "audio"]),
  folder: z.enum(["complaints", "proofs"]).default("complaints"),
});

/* --- Inferred types -------------------------------------------------------- */

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type ComplaintFilterInput = z.infer<typeof complaintFilterSchema>;
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;
export type WorkerInput = z.infer<typeof workerSchema>;
export type AnnouncementInput = z.infer<typeof announcementSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
