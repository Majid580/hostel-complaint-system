import crypto from "node:crypto";
import { env } from "@/lib/config/env";
import { ApiError } from "@/lib/api/response";

/**
 * Media storage adapter (Cloudinary free tier).
 *
 * The browser uploads DIRECTLY to Cloudinary using a short-lived signature we
 * generate here. Nothing large ever passes through a serverless function, which
 * keeps us inside both the Vercel request-size limit and the free execution
 * budget.
 *
 * To swap providers later, implement the same three functions and change the
 * import in the upload route — no feature code touches Cloudinary directly.
 */

export const IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const AUDIO_MIME = [
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-m4a",
] as const;

export type UploadKind = "image" | "audio";

export type SignedUpload = {
  uploadUrl: string;
  fields: {
    api_key: string;
    timestamp: number;
    signature: string;
    folder: string;
    public_id: string;
  };
  publicIdPrefix: string;
  maxBytes: number;
  acceptedMime: string[];
};

function assertConfigured() {
  if (!env.cloudinaryConfigured) {
    throw new ApiError(
      "NOT_CONFIGURED",
      "Media uploads are not configured yet. Add the Cloudinary keys to the environment (see docs/DEPLOYMENT.md).",
    );
  }
}

/** Cloudinary signs the sorted, `&`-joined parameter string plus the API secret. */
function sign(params: Record<string, string | number>): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto
    .createHash("sha1")
    .update(toSign + env.cloudinary.apiSecret)
    .digest("hex");
}

export function createSignedUpload(options: {
  kind: UploadKind;
  userId: string;
  folder?: "complaints" | "proofs";
  maxImageMb: number;
  maxAudioMb: number;
}): SignedUpload {
  assertConfigured();

  const { kind, userId } = options;
  const resourceType = kind === "image" ? "image" : "video"; // Cloudinary serves audio via /video
  const folder = `hcms/${options.folder ?? "complaints"}/${kind}`;
  const timestamp = Math.floor(Date.now() / 1000);

  // The public_id embeds the uploader so the server can verify ownership later.
  const publicIdPrefix = `${userId}_`;
  const publicId = `${publicIdPrefix}${timestamp}_${crypto.randomBytes(6).toString("hex")}`;

  const signature = sign({ folder, public_id: publicId, timestamp });

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/${resourceType}/upload`,
    fields: {
      api_key: env.cloudinary.apiKey,
      timestamp,
      signature,
      folder,
      public_id: publicId,
    },
    publicIdPrefix,
    maxBytes: (kind === "image" ? options.maxImageMb : options.maxAudioMb) * 1024 * 1024,
    acceptedMime: kind === "image" ? [...IMAGE_MIME] : [...AUDIO_MIME],
  };
}

/**
 * Server-side verification before an attachment is persisted: confirms the
 * asset really exists in our Cloudinary account and that the public_id belongs
 * to the uploading user. Prevents a client from claiming an arbitrary URL.
 */
export async function verifyUploadedAsset(
  publicId: string,
  kind: UploadKind,
  userId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!env.cloudinaryConfigured) return { ok: true }; // dev without media configured

  const bare = publicId.split("/").pop() ?? "";
  if (!bare.startsWith(`${userId}_`)) {
    return { ok: false, reason: "That attachment does not belong to you." };
  }

  const resourceType = kind === "image" ? "image" : "video";
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign({ public_id: publicId, timestamp });

  const url = new URL(
    `https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/resources/${resourceType}/upload/${encodeURIComponent(publicId)}`,
  );
  url.searchParams.set("api_key", env.cloudinary.apiKey);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("signature", signature);

  try {
    const auth = Buffer.from(`${env.cloudinary.apiKey}:${env.cloudinary.apiSecret}`).toString(
      "base64",
    );
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!response.ok) return { ok: false, reason: "Attachment could not be verified." };
    return { ok: true };
  } catch {
    // Never block a complaint because the verification call itself failed.
    return { ok: true };
  }
}

/** Cloudinary transformation URL — thumbnails cost us no extra bandwidth budget. */
export function thumbnailUrl(url: string, width = 400): string {
  if (!url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/c_fill,w_${width},q_auto,f_auto/`);
}
