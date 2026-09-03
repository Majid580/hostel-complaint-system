"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Progress } from "@/components/ui/primitives";
import { useUpload, type UploadedAttachment } from "./useUpload";
import { formatBytes } from "@/lib/utils";

export function ImageUploader({
  value,
  onChange,
  max = 5,
  folder = "complaints",
  label = "Photos",
  hint = "Clear photos help staff understand the problem before they arrive.",
}: {
  value: UploadedAttachment[];
  onChange: (next: UploadedAttachment[]) => void;
  max?: number;
  folder?: "complaints" | "proofs";
  label?: string;
  hint?: string;
}) {
  const { uploading, progress, error, upload, clearError } = useUpload("image", folder);
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState(0);

  const remaining = max - value.length;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    clearError();

    const selected = Array.from(files).slice(0, remaining);
    setQueue(selected.length);

    const uploaded: UploadedAttachment[] = [];
    for (const file of selected) {
      const result = await upload(file);
      if (result) uploaded.push(result);
      setQueue((q) => q - 1);
    }

    if (uploaded.length) onChange([...value, ...uploaded]);
    if (inputRef.current) inputRef.current.value = "";
    setQueue(0);
  };

  const remove = (publicId: string) => {
    onChange(value.filter((a) => a.publicId !== publicId));
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {value.length} of {max}
        </span>
      </div>

      {value.length > 0 && (
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {value.map((image) => (
            <li key={image.publicId} className="group relative">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 33vw, 160px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <button
                type="button"
                onClick={() => remove(image.publicId)}
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-md transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Remove this photo"
              >
                <X className="size-3.5" />
              </button>
              <p className="mt-1 truncate text-[10px] text-muted-foreground">
                {formatBytes(image.bytes)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            capture={undefined}
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            {uploading ? "Uploading…" : value.length ? "Add more photos" : "Choose photos"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.setAttribute("capture", "environment");
                inputRef.current.click();
                inputRef.current.removeAttribute("capture");
              }
            }}
            disabled={uploading}
            className="sm:hidden"
          >
            <Camera />
            Take a photo
          </Button>
        </div>
      )}

      {uploading && (
        <div className="space-y-1">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">
            Uploading… {progress}%{queue > 1 ? ` · ${queue} files left` : ""}
          </p>
        </div>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
      {!error && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
