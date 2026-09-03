"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellOff, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/apiClient";
import { cn, relativeTime } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  tone: "info" | "success" | "warning" | "danger";
  isRead: boolean;
  createdAt: string;
};

const TONE: Record<Notification["tone"], string> = {
  info: "border-l-primary",
  success: "border-l-success",
  warning: "border-l-warning",
  danger: "border-l-destructive",
};

export function NotificationsList() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<{ notifications: Notification[] }>(
          "/api/notifications?limit=50",
        );
        if (!cancelled) setItems(data.notifications);
      } catch (caught) {
        if (!cancelled) setError(errorMessage(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markAllRead = async () => {
    await api.patch("/api/notifications").catch(() => undefined);
    setItems((list) => list.map((n) => ({ ...n, isRead: true })));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading notifications…
      </div>
    );
  }

  if (error) {
    return <p className="py-10 text-sm text-destructive">{error}</p>;
  }

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unread > 0 ? `${unread} unread` : "All caught up"}
        </p>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
            <CheckCheck />
            Mark all as read
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<BellOff className="size-6" />}
          title="No notifications yet"
          description="You will be notified here whenever something happens on a complaint that concerns you."
        />
      ) : (
        <div className="space-y-2">
          {items.map((notification) => {
            const content = (
              <Card
                className={cn(
                  "border-l-4 transition-colors",
                  TONE[notification.tone],
                  !notification.isRead && "bg-primary/4",
                  notification.link && "hover:border-primary/50",
                )}
              >
                <CardContent className="p-4 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium leading-snug">{notification.title}</p>
                    {!notification.isRead && (
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                        aria-label="Unread"
                      />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {relativeTime(notification.createdAt)}
                  </p>
                </CardContent>
              </Card>
            );

            return notification.link ? (
              <Link key={notification.id} href={notification.link} className="block">
                {content}
              </Link>
            ) : (
              <div key={notification.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
