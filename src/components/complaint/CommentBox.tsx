"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Checkbox, Textarea } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/apiClient";

export function CommentBox({
  complaintId,
  allowInternal,
}: {
  complaintId: string;
  allowInternal: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;

    setBusy(true);
    setError("");
    try {
      await api.post(`/api/complaints/${complaintId}/comments`, {
        message: message.trim(),
        internal,
      });
      setMessage("");
      toast.success(internal ? "Internal note added." : "Comment posted.");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2.5">
      {error && <Alert tone="danger">{error}</Alert>}

      <label htmlFor="comment" className="sr-only">
        Add a comment
      </label>
      <Textarea
        id="comment"
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
        placeholder={
          internal
            ? "Internal note — students cannot see this."
            : "Add an update or ask a question. Everyone on this complaint can see it."
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {allowInternal ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={internal} onCheckedChange={(v) => setInternal(v === true)} />
            <Lock className="size-3.5" />
            Internal note (hidden from the student)
          </label>
        ) : (
          <span className="text-xs text-muted-foreground">
            {message.length}/2000 · visible to hostel staff
          </span>
        )}

        <Button type="submit" size="sm" disabled={busy || !message.trim()}>
          <Send />
          {busy ? "Posting…" : internal ? "Add note" : "Post comment"}
        </Button>
      </div>
    </form>
  );
}
