"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/apiClient";

/**
 * Direct-to-Cloudinary upload.
 *
 * The file never passes through our serverless function: we ask the server for
 * a short-lived signature, then POST straight to Cloudinary. That keeps us
 * inside the platform request-size limit and costs no function time.
 */

export type UploadedAttachment = {
  url: string;
  publicId: string;
  kind: "image" | "audio";
  bytes: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
};

type SignResponse = {
  uploadUrl: string;
  fields: {
    api_key: string;
    timestamp: number;
    signature: string;
    folder: string;
    public_id: string;
  };
  maxBytes: number;
  acceptedMime: string[];
};

export type UploadState = {
  uploading: boolean;
  progress: number;
  error: string;
};

export function useUpload(kind: "image" | "audio", folder: "complaints" | "proofs" = "complaints") {
  const [state, setState] = useState<UploadState>({ uploading: false, progress: 0, error: "" });

  const upload = useCallback(
    async (file: File | Blob, fileName?: string): Promise<UploadedAttachment | null> => {
      setState({ uploading: true, progress: 0, error: "" });

      try {
        const signed = await api.post<SignResponse>("/api/uploads/sign", { kind, folder });

        const type = file.type || (kind === "image" ? "image/jpeg" : "audio/webm");
        if (signed.acceptedMime.length && !signed.acceptedMime.includes(type)) {
          throw new Error(
            kind === "image"
              ? "That file type is not supported. Use a JPG, PNG or WEBP photo."
              : "That audio format is not supported.",
          );
        }
        if (file.size > signed.maxBytes) {
          throw new Error(
            `That file is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The limit is ${(
              signed.maxBytes /
              1024 /
              1024
            ).toFixed(0)} MB.`,
          );
        }

        const body = new FormData();
        body.append("file", file, fileName ?? (file instanceof File ? file.name : "recording.webm"));
        body.append("api_key", signed.fields.api_key);
        body.append("timestamp", String(signed.fields.timestamp));
        body.append("signature", signed.fields.signature);
        body.append("folder", signed.fields.folder);
        body.append("public_id", signed.fields.public_id);

        const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", signed.uploadUrl);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setState((s) => ({ ...s, progress: Math.round((event.loaded / event.total) * 100) }));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                reject(new Error("The upload service returned an unexpected response."));
              }
            } else {
              let message = `Upload failed (${xhr.status}).`;
              try {
                const parsed = JSON.parse(xhr.responseText) as { error?: { message?: string } };
                if (parsed.error?.message) message = parsed.error.message;
              } catch {
                /* keep the generic message */
              }
              reject(new Error(message));
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
          xhr.ontimeout = () => reject(new Error("The upload timed out. Try again."));
          xhr.timeout = 120_000;
          xhr.send(body);
        });

        setState({ uploading: false, progress: 100, error: "" });

        return {
          url: String(result.secure_url ?? result.url ?? ""),
          publicId: String(result.public_id ?? signed.fields.public_id),
          kind,
          bytes: Number(result.bytes ?? file.size),
          mimeType: type,
          width: result.width ? Number(result.width) : undefined,
          height: result.height ? Number(result.height) : undefined,
          duration: result.duration ? Number(result.duration) : undefined,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed. Please try again.";
        setState({ uploading: false, progress: 0, error: message });
        return null;
      }
    },
    [kind, folder],
  );

  const clearError = useCallback(() => setState((s) => ({ ...s, error: "" })), []);

  return { ...state, upload, clearError };
}
