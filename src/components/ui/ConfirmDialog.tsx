"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/overlays";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * A yes/no step in front of something that is awkward to undo.
 *
 * Deliberately not used for everything: a confirmation on a harmless action is
 * noise, and noise is what trains people to tap through the ones that matter.
 * Reserve it for actions with a consequence the person cannot see from the
 * button alone — ending someone's session, for instance.
 *
 * `description` should say what will actually happen, not "are you sure".
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <div className="flex items-start gap-3">
          {destructive && (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive/12 text-destructive">
              <TriangleAlert className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription className="mt-1.5">{description}</AlertDialogDescription>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              // Keep the dialog open while the request is in flight, so a
              // failure can still be reported against it.
              event.preventDefault();
              void run();
            }}
            className={cn(destructive && buttonVariants({ variant: "destructive" }))}
          >
            {busy ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
