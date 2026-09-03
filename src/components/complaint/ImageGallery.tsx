"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/overlays";

type GalleryImage = { url: string; publicId: string; width?: number; height?: number };

export function ImageGallery({
  images,
  label = "Photos",
}: {
  images: GalleryImage[];
  label?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

  if (images.length === 0) return null;

  return (
    <>
      <div>
        <p className="mb-2 text-sm font-medium">
          {label} <span className="text-muted-foreground">({images.length})</span>
        </p>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.publicId}>
              <button
                type="button"
                onClick={() => setOpen(index)}
                className="relative block aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Open photo ${index + 1} of ${images.length}`}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 33vw, 160px"
                  className="object-cover"
                  unoptimized
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-4xl p-2">
          <DialogTitle className="sr-only">
            Photo {(open ?? 0) + 1} of {images.length}
          </DialogTitle>
          {open !== null && (
            <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-black">
              <Image
                src={images[open].url}
                alt={`Photo ${open + 1}`}
                fill
                sizes="90vw"
                className="object-contain"
                unoptimized
              />
            </div>
          )}
          {images.length > 1 && (
            <div className="flex justify-center gap-1.5 pb-1">
              {images.map((image, index) => (
                <button
                  key={image.publicId}
                  type="button"
                  onClick={() => setOpen(index)}
                  className={`size-2 rounded-full transition-colors ${
                    index === open ? "bg-primary" : "bg-border"
                  }`}
                  aria-label={`Show photo ${index + 1}`}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export { X };
